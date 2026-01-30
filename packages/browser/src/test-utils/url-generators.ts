/**
 * @apexcli/browser - Test URL Generation
 *
 * Utilities for generating test URLs and URL patterns
 */

export interface TestUrlOptions {
  protocol?: 'http' | 'https' | 'file' | 'data' | 'about';
  host?: string;
  port?: number;
  path?: string;
  query?: Record<string, string | number | boolean>;
  fragment?: string;
}

/**
 * Generate a test URL with specified options
 */
export function generateTestUrl(options: TestUrlOptions = {}): string {
  const {
    protocol = 'https',
    host = 'example.com',
    port,
    path = '',
    query = {},
    fragment
  } = options;

  let url = `${protocol}://`;

  // Add host and port
  if (protocol !== 'file' && protocol !== 'about' && protocol !== 'data') {
    url += host;
    if (port) {
      url += `:${port}`;
    }
  }

  // Add path
  if (path && !path.startsWith('/')) {
    url += '/';
  }
  url += path;

  // Add query parameters
  const queryString = Object.entries(query)
    .filter(([_, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');

  if (queryString) {
    url += `?${queryString}`;
  }

  // Add fragment
  if (fragment) {
    url += `#${fragment}`;
  }

  return url;
}

/**
 * Generate multiple test URLs with variations
 */
export function generateTestUrls(count: number, options: TestUrlOptions = {}): string[] {
  const urls: string[] = [];
  const baseOptions = { ...options };

  for (let i = 0; i < count; i++) {
    const urlOptions = {
      ...baseOptions,
      path: baseOptions.path ? `${baseOptions.path}/page-${i}` : `/page-${i}`,
      query: {
        ...baseOptions.query,
        id: i
      }
    };

    urls.push(generateTestUrl(urlOptions));
  }

  return urls;
}

/**
 * Create a URL from a pattern with parameter substitution
 */
export function createUrlPattern(pattern: string, params: Record<string, string> = {}): string {
  let url = pattern;

  // Replace named parameters like :param or {param}
  Object.entries(params).forEach(([key, value]) => {
    const colonPattern = new RegExp(`:${key}\\b`, 'g');
    const bracePattern = new RegExp(`\\{${key}\\}`, 'g');
    url = url.replace(colonPattern, value);
    url = url.replace(bracePattern, value);
  });

  return url;
}

/**
 * Predefined URL collections for common test scenarios
 */
export const testUrls = {
  /**
   * Well-formed URLs for general testing
   */
  valid: [
    'https://example.com',
    'https://www.google.com',
    'http://localhost:3000',
    'https://api.github.com/users/octocat',
    'https://subdomain.example.org/path/to/page',
    'https://example.com/search?q=test&sort=date',
    'https://example.com/page#section1'
  ],

  /**
   * Malformed URLs for error testing
   */
  invalid: [
    'not-a-url',
    'http://.',
    'https://',
    'ftp://invalid..domain',
    'https://example.com:999999'
  ],

  /**
   * URLs with different protocol schemes
   */
  protocols: [
    'https://example.com',
    'http://example.com',
    'ftp://example.com',
    'file:///path/to/file.html',
    'about:blank',
    'data:text/html,<h1>Hello</h1>',
    'mailto:test@example.com',
    'tel:+1-555-123-4567'
  ],

  /**
   * Special and edge case URLs
   */
  special: [
    'https://example.com/path/with%20spaces',
    'https://example.com/very/long/path/that/goes/on/and/on/and/on/and/on',
    'https://example.com/?query=value%20with%20special%20chars%21%40%23%24%25',
    'https://example.com/#fragment-with-special-chars!@#$%',
    'https://192.168.1.1:8080/admin',
    'https://[::1]:8080/ipv6-localhost',
    'https://example.com:443/default-https-port'
  ],

  /**
   * Generate a localhost URL with optional port
   */
  localhost: (port: number = 3000): string => `http://localhost:${port}`,

  /**
   * Generate a data URI with content
   */
  dataUri: (content: string, mimeType: string = 'text/html'): string => {
    const encodedContent = encodeURIComponent(content);
    return `data:${mimeType},${encodedContent}`;
  },

  /**
   * Generate a file URI from a path
   */
  fileUri: (path: string): string => {
    // Ensure path starts with /
    if (!path.startsWith('/')) {
      path = '/' + path;
    }
    return `file://${path}`;
  }
};

/**
 * URL validation utilities
 */
export const urlValidators = {
  /**
   * Check if a string is a valid URL format
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
   * Check if a URL uses HTTPS
   */
  isHttps: (url: string): boolean => {
    try {
      return new URL(url).protocol === 'https:';
    } catch {
      return false;
    }
  },

  /**
   * Check if a URL is localhost
   */
  isLocalhost: (url: string): boolean => {
    try {
      const parsedUrl = new URL(url);
      return parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1';
    } catch {
      return false;
    }
  },

  /**
   * Check if a URL has query parameters
   */
  hasQuery: (url: string): boolean => {
    try {
      return new URL(url).search.length > 0;
    } catch {
      return false;
    }
  },

  /**
   * Check if a URL has a fragment
   */
  hasFragment: (url: string): boolean => {
    try {
      return new URL(url).hash.length > 0;
    } catch {
      return false;
    }
  }
};

/**
 * URL manipulation utilities
 */
export const urlUtils = {
  /**
   * Add query parameters to a URL
   */
  addQuery: (url: string, params: Record<string, string | number | boolean>): string => {
    try {
      const parsedUrl = new URL(url);
      Object.entries(params).forEach(([key, value]) => {
        parsedUrl.searchParams.set(key, String(value));
      });
      return parsedUrl.toString();
    } catch {
      return url;
    }
  },

  /**
   * Remove query parameters from a URL
   */
  removeQuery: (url: string, ...keys: string[]): string => {
    try {
      const parsedUrl = new URL(url);
      keys.forEach(key => parsedUrl.searchParams.delete(key));
      return parsedUrl.toString();
    } catch {
      return url;
    }
  },

  /**
   * Set the fragment of a URL
   */
  setFragment: (url: string, fragment: string): string => {
    try {
      const parsedUrl = new URL(url);
      parsedUrl.hash = fragment.startsWith('#') ? fragment : `#${fragment}`;
      return parsedUrl.toString();
    } catch {
      return url;
    }
  },

  /**
   * Extract the domain from a URL
   */
  getDomain: (url: string): string => {
    try {
      return new URL(url).hostname;
    } catch {
      return '';
    }
  },

  /**
   * Extract the path from a URL
   */
  getPath: (url: string): string => {
    try {
      return new URL(url).pathname;
    } catch {
      return '';
    }
  },

  /**
   * Parse query parameters from a URL
   */
  parseQuery: (url: string): Record<string, string> => {
    try {
      const params: Record<string, string> = {};
      const urlObj = new URL(url);
      urlObj.searchParams.forEach((value, key) => {
        params[key] = value;
      });
      return params;
    } catch {
      return {};
    }
  }
};

/**
 * Generate URLs for common test scenarios
 */
export const urlScenarios = {
  /**
   * Generate URLs for API testing
   */
  api: {
    rest: (version: string = 'v1') =>
      generateTestUrl({ host: 'api.example.com', path: `/${version}/users` }),
    graphql: () =>
      generateTestUrl({ host: 'api.example.com', path: '/graphql' }),
    webhook: (endpoint: string) =>
      generateTestUrl({ host: 'webhooks.example.com', path: `/${endpoint}` })
  },

  /**
   * Generate URLs for file operations
   */
  files: {
    download: (filename: string) =>
      generateTestUrl({ path: `/downloads/${filename}` }),
    upload: () =>
      generateTestUrl({ path: '/upload', query: { type: 'file' } }),
    preview: (fileId: string) =>
      generateTestUrl({ path: `/preview/${fileId}` })
  }
};