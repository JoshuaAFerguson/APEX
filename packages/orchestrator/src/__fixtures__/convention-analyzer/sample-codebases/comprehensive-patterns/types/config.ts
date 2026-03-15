/**
 * Configuration type definitions for the application
 * Defines database, logging, and other system configurations
 */

/**
 * Database connection configuration
 */
export interface DatabaseConfig {
  /** Database server hostname */
  host: string;
  /** Database server port */
  port: number;
  /** Database name */
  database: string;
  /** Connection timeout in milliseconds */
  connectionTimeout: number;
  /** Query timeout in milliseconds */
  queryTimeout: number;
  /** Maximum number of connections in pool */
  maxConnections: number;
  /** Whether to use SSL connection */
  ssl?: boolean;
  /** Connection retry attempts */
  retryAttempts?: number;
  /** Retry delay in milliseconds */
  retryDelay?: number;
}

/**
 * Logging configuration options
 */
export interface LoggingConfig {
  /** Minimum log level to output */
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  /** Whether to enable console output */
  console: boolean;
  /** File logging configuration */
  file?: FileLoggingConfig;
  /** Whether to include stack traces in error logs */
  includeStackTrace: boolean;
  /** Custom log format string */
  format?: string;
}

/**
 * File logging specific configuration
 */
export interface FileLoggingConfig {
  /** Log file path */
  path: string;
  /** Maximum file size before rotation */
  maxSize: string;
  /** Number of files to keep in rotation */
  maxFiles: number;
  /** Whether to compress rotated files */
  compress: boolean;
}

/**
 * Server configuration for HTTP/HTTPS services
 */
export interface ServerConfig {
  /** Server port number */
  port: number;
  /** Server hostname or IP address */
  host: string;
  /** Whether to enable HTTPS */
  https: boolean;
  /** SSL certificate configuration */
  ssl?: SslConfig;
  /** Request timeout in milliseconds */
  requestTimeout: number;
  /** Maximum request body size */
  maxBodySize: string;
  /** CORS configuration */
  cors?: CorsConfig;
}

/**
 * SSL certificate configuration
 */
export interface SslConfig {
  /** Path to SSL certificate file */
  cert: string;
  /** Path to SSL private key file */
  key: string;
  /** Path to certificate authority file */
  ca?: string;
  /** SSL passphrase */
  passphrase?: string;
}

/**
 * Cross-Origin Resource Sharing configuration
 */
export interface CorsConfig {
  /** Allowed origins */
  origin: string | string[] | boolean;
  /** Allowed HTTP methods */
  methods: string[];
  /** Allowed headers */
  allowedHeaders: string[];
  /** Headers exposed to client */
  exposedHeaders: string[];
  /** Whether to include credentials */
  credentials: boolean;
  /** Preflight cache duration */
  maxAge: number;
}

/**
 * Caching configuration
 */
export interface CacheConfig {
  /** Cache provider type */
  provider: 'memory' | 'redis' | 'memcached';
  /** Cache TTL in seconds */
  ttl: number;
  /** Maximum cache entries */
  maxEntries?: number;
  /** Cache key prefix */
  keyPrefix: string;
  /** Provider-specific options */
  options?: Record<string, unknown>;
}

/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
  /** Number of requests allowed per window */
  requests: number;
  /** Time window in milliseconds */
  window: number;
  /** Whether to skip successful requests */
  skipSuccessfulRequests: boolean;
  /** Custom key generator function name */
  keyGenerator?: string;
  /** Custom response message */
  message?: string;
}

/**
 * Security configuration options
 */
export interface SecurityConfig {
  /** JWT token configuration */
  jwt?: JwtConfig;
  /** Session configuration */
  session?: SessionConfig;
  /** Password hashing configuration */
  passwordHashing?: PasswordHashingConfig;
  /** Security headers configuration */
  headers?: SecurityHeadersConfig;
}

/**
 * JWT token configuration
 */
export interface JwtConfig {
  /** Token expiration time */
  expiresIn: string;
  /** JWT issuer */
  issuer: string;
  /** JWT audience */
  audience: string;
  /** Token algorithm */
  algorithm: 'HS256' | 'HS384' | 'HS512' | 'RS256' | 'RS384' | 'RS512';
}

/**
 * Session configuration
 */
export interface SessionConfig {
  /** Session store type */
  store: 'memory' | 'redis' | 'database';
  /** Session timeout in milliseconds */
  timeout: number;
  /** Whether to use secure cookies */
  secure: boolean;
  /** Cookie same-site policy */
  sameSite: 'strict' | 'lax' | 'none';
  /** Session ID regeneration interval */
  regenerateInterval: number;
}

/**
 * Password hashing configuration
 */
export interface PasswordHashingConfig {
  /** Hashing algorithm */
  algorithm: 'bcrypt' | 'scrypt' | 'argon2';
  /** Salt rounds or cost factor */
  rounds: number;
  /** Memory cost for scrypt/argon2 */
  memoryCost?: number;
  /** Time cost for argon2 */
  timeCost?: number;
}

/**
 * Security headers configuration
 */
export interface SecurityHeadersConfig {
  /** Content Security Policy */
  contentSecurityPolicy?: string;
  /** X-Frame-Options header */
  frameOptions: 'deny' | 'sameorigin' | 'allow-from';
  /** X-Content-Type-Options header */
  noSniff: boolean;
  /** X-XSS-Protection header */
  xssProtection: boolean;
  /** Referrer Policy header */
  referrerPolicy: string;
}

/**
 * Application-wide configuration
 */
export interface AppConfig {
  /** Application environment */
  environment: 'development' | 'staging' | 'production' | 'test';
  /** Application name */
  name: string;
  /** Application version */
  version: string;
  /** Database configuration */
  database: DatabaseConfig;
  /** Logging configuration */
  logging: LoggingConfig;
  /** Server configuration */
  server: ServerConfig;
  /** Caching configuration */
  cache?: CacheConfig;
  /** Rate limiting configuration */
  rateLimit?: RateLimitConfig;
  /** Security configuration */
  security?: SecurityConfig;
  /** Feature flags */
  features?: Record<string, boolean>;
  /** External service configurations */
  services?: Record<string, ServiceConfig>;
}

/**
 * External service configuration
 */
export interface ServiceConfig {
  /** Service base URL */
  baseUrl: string;
  /** Request timeout in milliseconds */
  timeout: number;
  /** Maximum retry attempts */
  retries: number;
  /** Retry delay in milliseconds */
  retryDelay: number;
  /** API key or authentication token */
  apiKey?: string;
  /** Custom headers to include */
  headers?: Record<string, string>;
}

/**
 * Configuration validation utilities
 */
export const ConfigValidation = {
  /**
   * Validate database configuration
   * @param config - Database config to validate
   * @returns Validation result
   */
  validateDatabaseConfig(config: Partial<DatabaseConfig>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.host) {
      errors.push('Database host is required');
    }

    if (!config.port || config.port < 1 || config.port > 65535) {
      errors.push('Database port must be between 1 and 65535');
    }

    if (!config.database) {
      errors.push('Database name is required');
    }

    if (config.connectionTimeout && config.connectionTimeout < 1000) {
      errors.push('Connection timeout must be at least 1000ms');
    }

    if (config.maxConnections && config.maxConnections < 1) {
      errors.push('Maximum connections must be at least 1');
    }

    return { valid: errors.length === 0, errors };
  },

  /**
   * Validate server configuration
   * @param config - Server config to validate
   * @returns Validation result
   */
  validateServerConfig(config: Partial<ServerConfig>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.port || config.port < 1 || config.port > 65535) {
      errors.push('Server port must be between 1 and 65535');
    }

    if (!config.host) {
      errors.push('Server host is required');
    }

    if (config.https && !config.ssl) {
      errors.push('SSL configuration is required when HTTPS is enabled');
    }

    if (config.requestTimeout && config.requestTimeout < 1000) {
      errors.push('Request timeout must be at least 1000ms');
    }

    return { valid: errors.length === 0, errors };
  },

  /**
   * Get default application configuration
   * @returns Default configuration object
   */
  getDefaultConfig(): AppConfig {
    return {
      environment: 'development',
      name: 'DefaultApp',
      version: '1.0.0',
      database: {
        host: 'localhost',
        port: 5432,
        database: 'app_db',
        connectionTimeout: 10000,
        queryTimeout: 30000,
        maxConnections: 10,
        ssl: false,
        retryAttempts: 3,
        retryDelay: 1000,
      },
      logging: {
        level: 'info',
        console: true,
        includeStackTrace: true,
        format: 'json',
      },
      server: {
        port: 3000,
        host: '0.0.0.0',
        https: false,
        requestTimeout: 30000,
        maxBodySize: '10mb',
        cors: {
          origin: true,
          methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
          allowedHeaders: ['Content-Type', 'Authorization'],
          exposedHeaders: [],
          credentials: true,
          maxAge: 86400,
        },
      },
      features: {},
      services: {},
    };
  },
};