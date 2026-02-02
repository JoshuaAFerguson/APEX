/**
 * Fastify Auth Middleware Plugin
 *
 * Validates Bearer token or X-API-Key header against configured API keys.
 * Supports public route exclusions for endpoints that don't require authentication.
 *
 * @module auth-middleware
 */

import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { timingSafeEqual } from 'crypto';

/**
 * Configuration options for the auth middleware
 */
export interface AuthMiddlewareOptions {
  /** Whether authentication is enabled */
  enabled?: boolean;
  /** Array of valid API keys for authentication */
  apiKeys?: string[];
  /** Routes that don't require authentication */
  publicRoutes?: string[];
}

/**
 * Default configuration for auth middleware
 */
const DEFAULT_OPTIONS: Required<AuthMiddlewareOptions> = {
  enabled: false,
  apiKeys: [],
  publicRoutes: ['/health']
};

/**
 * Safely compare two strings using constant-time comparison
 * to prevent timing attacks
 */
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  try {
    const bufferA = Buffer.from(a, 'utf8');
    const bufferB = Buffer.from(b, 'utf8');

    if (bufferA.length !== bufferB.length) {
      return false;
    }

    return timingSafeEqual(bufferA, bufferB);
  } catch {
    return false;
  }
}

/**
 * Check if a route is in the public routes list
 */
function isPublicRoute(path: string, publicRoutes: string[]): boolean {
  return publicRoutes.some(route => {
    if (route.includes('*')) {
      // Simple wildcard matching
      const pattern = route.replace(/\*/g, '.*');
      const regex = new RegExp(`^${pattern}$`);
      return regex.test(path);
    }
    return route === path;
  });
}

/**
 * Extract Bearer token from Authorization header
 */
function extractBearerToken(authHeader: string): string | null {
  if (!authHeader || typeof authHeader !== 'string') {
    return null;
  }

  const match = authHeader.match(/^Bearer\s+(.+)$/);
  return match ? match[1].trim() : null;
}

/**
 * Validate API key against configured keys
 */
function validateApiKey(providedKey: string, validKeys: string[]): boolean {
  if (!providedKey || typeof providedKey !== 'string' || providedKey.trim() === '') {
    return false;
  }

  return validKeys.some(validKey =>
    validKey && typeof validKey === 'string' && safeCompare(providedKey, validKey)
  );
}

/**
 * Fastify auth middleware plugin
 */
const authMiddleware: FastifyPluginAsync<AuthMiddlewareOptions> = async (
  fastify,
  options
) => {
  const config = { ...DEFAULT_OPTIONS, ...options };

  // Skip authentication if disabled
  if (!config.enabled) {
    return;
  }

  // Add authentication hook
  fastify.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    // Skip authentication for public routes
    if (isPublicRoute(request.url, config.publicRoutes)) {
      return;
    }

    const authHeader = request.headers.authorization as string;
    const apiKeyHeader = request.headers['x-api-key'] as string;

    let isAuthenticated = false;

    // Check Bearer token first (if present)
    if (authHeader) {
      const token = extractBearerToken(authHeader);
      if (token && validateApiKey(token, config.apiKeys)) {
        isAuthenticated = true;
      }
    }

    // Fall back to X-API-Key header if Bearer token failed
    if (!isAuthenticated && apiKeyHeader) {
      if (validateApiKey(apiKeyHeader, config.apiKeys)) {
        isAuthenticated = true;
      }
    }

    // Reject if no valid authentication found
    if (!isAuthenticated) {
      if (!authHeader && !apiKeyHeader) {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'Authentication required',
          statusCode: 401
        });
      } else {
        return reply.code(403).send({
          error: 'Forbidden',
          message: 'Invalid authentication credentials',
          statusCode: 403
        });
      }
    }
  });
};

const authPlugin = fp(authMiddleware, {
  name: 'auth-middleware',
  fastify: '4.x'
});

export default authPlugin;
export { authMiddleware, AuthMiddlewareOptions };