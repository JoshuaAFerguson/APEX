/**
 * Test URL generation utilities for browser testing scenarios
 *
 * This module provides functions to generate various types of URLs
 * for testing browser navigation, error handling, and edge cases.
 */

/**
 * Test URL options interface
 */
export interface TestUrlOptions {
  /** Protocol (http, https, ftp, etc.) */
  protocol?: string;
  /** Hostname */
  hostname?: string;
  /** Port number */
  port?: number;
  /** Path */
  path?: string;
  /** Query parameters */
  query?: Record<string, string>;
  /** Fragment/hash */
  fragment?: string;
  /** Include random elements */
  randomize?: boolean;
}

/**
 * Generates a test URL with given options
 */
export function generateTestUrl(options: TestUrlOptions = {}): string {
  const protocol = options.protocol || 'http';
  const hostname = options.hostname || 'localhost';
  const port = options.port || (protocol === 'https' ? 443 : 3000);
  const path = options.path || '/';

  let url = `${protocol}://${hostname}`;

  // Add port if not default
  if ((protocol === 'http' && port !== 80) || (protocol === 'https' && port !== 443)) {
    url += `:${port}`;
  }

  url += path;

  // Add query parameters
  if (options.query && Object.keys(options.query).length > 0) {
    const queryString = new URLSearchParams(options.query).toString();
    url += `?${queryString}`;
  }

  // Add fragment
  if (options.fragment) {
    url += `#${options.fragment}`;
  }

  // Add random elements if requested
  if (options.randomize) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    const connector = url.includes('?') ? '&' : '?';
    url += `${connector}_t=${timestamp}&_r=${random}`;
  }

  return url;
}

/**
 * Generates multiple test URLs
 */
export function generateTestUrls(count: number, options: TestUrlOptions = {}): string[] {
  const urls: string[] = [];

  for (let i = 0; i < count; i++) {
    const urlOptions = {
      ...options,
      randomize: true,
      path: options.path || `/test-page-${i}`
    };
    urls.push(generateTestUrl(urlOptions));
  }

  return urls;
}

/**
 * Creates a URL from a pattern with parameter substitution
 */
export function createUrlPattern(pattern: string, params: Record<string, string> = {}): string {
  let url = pattern;

  // Replace :param patterns
  Object.entries(params).forEach(([key, value]) => {
    url = url.replace(`:${key}`, encodeURIComponent(value));
    url = url.replace(`{${key}}`, encodeURIComponent(value));
  });

  return url;
}

/**
 * Predefined test URL collections for common scenarios
 */
export const testUrls = {
  /**
   * Well-formed URLs for positive testing
   */
  valid: [
    'http://localhost:3000',
    'https://example.com',
    'http://127.0.0.1:8080/path',
    'https://subdomain.example.com/api/v1',
    'http://localhost:3000/users/123',
    'https://api.example.com/search?q=test&limit=10',
    'http://test.local:8000/dashboard#overview'
  ],

  /**
   * Malformed URLs for error testing
   */
  invalid: [
    'not-a-url',
    'http://',
    'https:///',
    'ftp://incomplete',
    '://missing-protocol.com',
    'http://localhost:99999', // Invalid port
    'https://example..com', // Double dots
    'http://[invalid-ipv6]',
    'https://example.com:abc', // Non-numeric port
  ],

  /**
   * Various protocol schemes
   */
  protocols: [
    'http://example.com',
    'https://example.com',
    'ftp://ftp.example.com',
    'ws://websocket.example.com',
    'wss://secure-websocket.example.com',
    'file:///local/file.html',
    'data:text/html,<h1>Hello</h1>',
    'mailto:test@example.com',
    'tel:+1234567890'
  ],

  /**
   * Edge cases and special URLs
   */
  special: [
    'https://例え.テスト', // Unicode domain
    'http://localhost:3000/path/with spaces',
    'https://example.com/query?param=value with spaces',
    'http://localhost:3000/' + 'x'.repeat(2000), // Very long path
    'https://user:pass@example.com', // Basic auth
    'http://192.168.1.1:3000', // IP address
    'https://[::1]:8080', // IPv6
    'http://example.com:3000/path?a=1&b=2&c=3&d=4&e=5', // Many query params
    'https://example.com/path#fragment-with-special-chars!@#$%',
  ],

  /**
   * Generates a localhost URL with optional port
   */
  localhost: (port = 3000): string => `http://localhost:${port}`,

  /**
   * Creates a data URI
   */
  dataUri: (content: string, mimeType = 'text/html'): string =>
    `data:${mimeType};charset=utf-8,${encodeURIComponent(content)}`,

  /**
   * Creates a file URI (cross-platform)
   */
  fileUri: (path: string): string => {
    // Normalize path separators
    const normalizedPath = path.replace(/\\/g, '/');

    // Add leading slash if not present (Unix-style)
    const filePath = normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`;

    return `file://${filePath}`;
  }
};

/**
 * URL validation utilities
 */
export const urlValidation = {
  /**
   * Checks if a string is a valid URL
   */
  isValidUrl: (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Checks if a URL uses HTTPS
   */
  isSecure: (url: string): boolean => {
    try {
      return new URL(url).protocol === 'https:';
    } catch {
      return false;
    }
  },

  /**
   * Checks if a URL is localhost
   */
  isLocalhost: (url: string): boolean => {
    try {
      const parsed = new URL(url);
      return parsed.hostname === 'localhost' ||
             parsed.hostname === '127.0.0.1' ||
             parsed.hostname === '::1';
    } catch {
      return false;
    }
  },

  /**
   * Extracts domain from URL
   */
  extractDomain: (url: string): string | null => {
    try {
      return new URL(url).hostname;
    } catch {
      return null;
    }
  }
};

/**
 * URL manipulation utilities for testing
 */
export const urlUtils = {
  /**
   * Adds query parameters to a URL
   */
  addQueryParams: (url: string, params: Record<string, string>): string => {
    try {
      const urlObj = new URL(url);
      Object.entries(params).forEach(([key, value]) => {
        urlObj.searchParams.set(key, value);
      });
      return urlObj.toString();
    } catch {
      return url;
    }
  },

  /**
   * Removes query parameters from a URL
   */
  removeQueryParams: (url: string, paramsToRemove?: string[]): string => {
    try {
      const urlObj = new URL(url);
      if (paramsToRemove) {
        paramsToRemove.forEach(param => {
          urlObj.searchParams.delete(param);
        });
      } else {
        urlObj.search = '';
      }
      return urlObj.toString();
    } catch {
      return url;
    }
  },

  /**
   * Changes the port of a URL
   */
  changePort: (url: string, newPort: number): string => {
    try {
      const urlObj = new URL(url);
      urlObj.port = newPort.toString();
      return urlObj.toString();
    } catch {
      return url;
    }
  },

  /**
   * Changes the protocol of a URL
   */
  changeProtocol: (url: string, newProtocol: string): string => {
    try {
      const urlObj = new URL(url);
      urlObj.protocol = newProtocol;
      return urlObj.toString();
    } catch {
      return url;
    }
  }
};

/**
 * Generates URLs for specific test scenarios
 */
export const testScenarios = {
  /**
   * Authentication-related URLs
   */
  auth: {
    login: () => generateTestUrl({ path: '/login' }),
    logout: () => generateTestUrl({ path: '/logout' }),
    register: () => generateTestUrl({ path: '/register' }),
    profile: (userId: string) => generateTestUrl({ path: `/users/${userId}` }),
    resetPassword: () => generateTestUrl({ path: '/password/reset' })
  },

  /**
   * API endpoint URLs
   */
  api: {
    users: () => generateTestUrl({ path: '/api/users' }),
    user: (id: string) => generateTestUrl({ path: `/api/users/${id}` }),
    posts: () => generateTestUrl({ path: '/api/posts' }),
    search: (query: string) => generateTestUrl({
      path: '/api/search',
      query: { q: query }
    })
  },

  /**
   * Error page URLs
   */
  errors: {
    notFound: () => generateTestUrl({ path: '/404' }),
    serverError: () => generateTestUrl({ path: '/500' }),
    forbidden: () => generateTestUrl({ path: '/403' }),
    unauthorized: () => generateTestUrl({ path: '/401' })
  }
};