/**
 * WebFetch Tool Implementation
 *
 * Provides HTTP request capabilities with support for:
 * - Multiple HTTP methods (GET, POST, PUT, DELETE)
 * - Custom headers and request bodies
 * - Timeout handling
 * - Error handling with detailed error information
 * - Enhanced HTML-to-markdown conversion with edge case handling:
 *   - Scripts and styles removal
 *   - Image preservation with alt text and titles
 *   - Form and interactive element descriptions
 *   - Navigation element filtering
 *   - Enhanced HTML entity handling
 *   - Structured content formatting suitable for AI analysis
 * - 15-minute self-cleaning cache system:
 *   - Configurable TTL (default 15 minutes)
 *   - Cache by URL+method+headers+body hash
 *   - Automatic cache cleanup every 5 minutes
 *   - Cache bypass option
 *   - Cache management API for monitoring and control
 */

import TurndownService from 'turndown';
import crypto from 'crypto';

/**
 * HTTP methods supported by WebFetch tool
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

/**
 * Parameters for WebFetch tool invocation
 */
export interface WebFetchParams {
  /** The URL to fetch */
  url: string;
  /** HTTP method to use (default: GET) */
  method?: HttpMethod;
  /** HTTP headers to send */
  headers?: Record<string, string>;
  /** Request body for POST/PUT requests */
  body?: string;
  /** Request timeout in milliseconds (default: 10000) */
  timeout?: number;
  /** Whether to convert HTML responses to markdown (default: true) */
  convertToMarkdown?: boolean;
  /** Whether to bypass cache (default: false) */
  bypassCache?: boolean;
  /** Cache TTL in milliseconds (default: 900000 = 15 minutes) */
  cacheTtl?: number;
}

/**
 * Result of WebFetch operation
 */
export interface WebFetchResult {
  /** Whether the request was successful */
  success: boolean;
  /** HTTP status code */
  status?: number;
  /** Response headers */
  headers?: Record<string, string>;
  /** Response body (converted to markdown if HTML and convertToMarkdown is true) */
  data?: string;
  /** Error message if request failed */
  error?: string;
  /** Whether this result was served from cache */
  fromCache?: boolean;
  /** Request metadata */
  metadata?: {
    url: string;
    method: string;
    responseTime: number;
    contentLength?: number;
    contentType?: string;
    redirected?: boolean;
    finalUrl?: string;
    cacheKey?: string;
  };
}

/**
 * Cache entry for WebFetch responses
 */
interface WebFetchCacheEntry {
  /** The cached result */
  result: WebFetchResult;
  /** Timestamp when this entry was created */
  createdAt: number;
  /** TTL in milliseconds */
  ttl: number;
}

/**
 * WebFetch Tool Class
 *
 * Handles HTTP requests with comprehensive error handling and optional
 * HTML-to-markdown conversion for better content processing by AI agents.
 */
export class WebFetchTool {
  private readonly defaultTimeout: number = 10000; // 10 seconds
  private readonly maxTimeout: number = 60000; // 1 minute
  private readonly userAgent: string = 'APEX-Agent/1.0';
  private readonly defaultCacheTtl: number = 900000; // 15 minutes
  private readonly cache = new Map<string, WebFetchCacheEntry>();
  private readonly cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Set up automatic cache cleanup every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredEntries();
    }, 300000); // 5 minutes

    // Cleanup on process exit
    if (typeof process !== 'undefined') {
      process.on('exit', () => {
        clearInterval(this.cleanupInterval);
      });
    }
  }

  /**
   * Generate a cache key based on URL, method, headers, and body
   */
  private generateCacheKey(params: WebFetchParams): string {
    const normalizedParams = {
      url: params.url,
      method: params.method || 'GET',
      headers: params.headers || {},
      body: params.body || '',
    };

    // Create a stable string representation for hashing
    const cacheData = JSON.stringify(normalizedParams, Object.keys(normalizedParams).sort());

    // Generate SHA-256 hash
    return crypto.createHash('sha256').update(cacheData).digest('hex');
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupExpiredEntries(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.createdAt > entry.ttl) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => this.cache.delete(key));

    if (expiredKeys.length > 0) {
      console.debug(`WebFetch cache: Cleaned up ${expiredKeys.length} expired entries`);
    }
  }

  /**
   * Get cached result if available and not expired
   */
  private getCachedResult(cacheKey: string): WebFetchResult | null {
    const entry = this.cache.get(cacheKey);
    if (!entry) {
      return null;
    }

    const now = Date.now();
    if (now - entry.createdAt > entry.ttl) {
      this.cache.delete(cacheKey);
      return null;
    }

    // Return a copy of the cached result with fromCache flag
    return {
      ...entry.result,
      fromCache: true,
      metadata: {
        ...entry.result.metadata!,
        responseTime: 0, // Cache hits have zero response time
        cacheKey,
      }
    };
  }

  /**
   * Store result in cache
   */
  private setCachedResult(cacheKey: string, result: WebFetchResult, ttl: number): void {
    // Don't cache error results
    if (!result.success) {
      return;
    }

    const entry: WebFetchCacheEntry = {
      result: {
        ...result,
        metadata: {
          ...result.metadata!,
          cacheKey,
        }
      },
      createdAt: Date.now(),
      ttl,
    };

    this.cache.set(cacheKey, entry);
  }

  /**
   * Execute a WebFetch operation
   */
  async execute(params: WebFetchParams): Promise<WebFetchResult> {
    const startTime = Date.now();

    try {
      // Validate and sanitize parameters
      const validatedParams = this.validateParams(params);

      // Check cache if not bypassed
      if (!validatedParams.bypassCache) {
        const cacheKey = this.generateCacheKey(validatedParams);
        const cachedResult = this.getCachedResult(cacheKey);
        if (cachedResult) {
          return cachedResult;
        }
      }

      // Create abort controller for timeout handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, validatedParams.timeout);

      try {
        // Perform the HTTP request
        const response = await fetch(validatedParams.url, {
          method: validatedParams.method,
          headers: {
            'User-Agent': this.userAgent,
            ...validatedParams.headers,
          },
          body: validatedParams.body,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        const endTime = Date.now();

        // Read response body
        const responseText = await response.text();

        // Get response headers as plain object
        const responseHeaders: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          responseHeaders[key] = value;
        });

        const contentType = responseHeaders['content-type'] || '';
        const contentLength = responseHeaders['content-length']
          ? parseInt(responseHeaders['content-length'], 10)
          : responseText.length;

        // Convert HTML to markdown if requested and content is HTML
        let processedData = responseText;
        if (validatedParams.convertToMarkdown && this.isHtmlContent(contentType)) {
          processedData = await this.convertHtmlToMarkdown(responseText);
        }

        const result: WebFetchResult = {
          success: response.ok,
          status: response.status,
          headers: responseHeaders,
          data: processedData,
          metadata: {
            url: validatedParams.url,
            method: validatedParams.method,
            responseTime: endTime - startTime,
            contentLength,
            contentType,
            redirected: response.redirected,
            finalUrl: response.url !== validatedParams.url ? response.url : undefined,
          },
        };

        // Add error for non-2xx responses
        if (!response.ok) {
          result.error = `HTTP ${response.status}: ${response.statusText}`;
        }

        // Cache successful results if caching is enabled
        if (!validatedParams.bypassCache && result.success) {
          const cacheKey = this.generateCacheKey(validatedParams);
          this.setCachedResult(cacheKey, result, validatedParams.cacheTtl);
        }

        return result;

      } catch (fetchError) {
        clearTimeout(timeoutId);
        throw fetchError;
      }

    } catch (error) {
      const endTime = Date.now();

      return {
        success: false,
        error: this.formatError(error),
        metadata: {
          url: params.url,
          method: params.method || 'GET',
          responseTime: endTime - startTime,
        },
      };
    }
  }

  /**
   * Validate and normalize parameters
   */
  private validateParams(params: WebFetchParams): Required<WebFetchParams> {
    // Validate URL
    if (!params.url) {
      throw new Error('URL is required');
    }

    try {
      new URL(params.url);
    } catch {
      throw new Error('Invalid URL format');
    }

    // Validate method
    const method = params.method || 'GET';
    if (!['GET', 'POST', 'PUT', 'DELETE'].includes(method)) {
      throw new Error(`Unsupported HTTP method: ${method}`);
    }

    // Validate timeout
    const timeout = params.timeout || this.defaultTimeout;
    if (timeout < 1000 || timeout > this.maxTimeout) {
      throw new Error(`Timeout must be between 1000 and ${this.maxTimeout} milliseconds`);
    }

    // Validate body for GET/DELETE requests
    if ((method === 'GET' || method === 'DELETE') && params.body) {
      throw new Error(`${method} requests cannot have a body`);
    }

    // Validate cache TTL
    const cacheTtl = params.cacheTtl || this.defaultCacheTtl;
    if (cacheTtl < 0) {
      throw new Error('Cache TTL cannot be negative');
    }

    return {
      url: params.url,
      method,
      headers: params.headers || {},
      body: params.body,
      timeout,
      convertToMarkdown: params.convertToMarkdown !== false, // default to true
      bypassCache: params.bypassCache || false,
      cacheTtl,
    };
  }

  /**
   * Check if content type indicates HTML
   */
  private isHtmlContent(contentType: string): boolean {
    return contentType.toLowerCase().includes('text/html');
  }

  /**
   * Convert HTML to Markdown using Turndown service with enhanced edge case handling
   *
   * Features:
   * - Removes scripts, styles, and noscript elements
   * - Preserves code blocks with language detection
   * - Enhanced image handling with alt text and titles
   * - Removes navigation elements (nav, header, footer, aside, menu)
   * - Describes form elements for AI comprehension
   * - Preserves table structure
   * - Fallback HTML cleanup with comprehensive entity handling
   *
   * @param html - The HTML string to convert
   * @returns Promise resolving to clean markdown suitable for AI analysis
   */
  private async convertHtmlToMarkdown(html: string): Promise<string> {
    try {
      const turndownService = new TurndownService({
        headingStyle: 'atx', // Use # for headings
        bulletListMarker: '-', // Use - for bullet lists
        codeBlockStyle: 'fenced', // Use ``` for code blocks
        emDelimiter: '*', // Use * for emphasis
        strongDelimiter: '**', // Use ** for strong
        linkStyle: 'inlined', // Use [text](url) for links
      });

      // Add custom rules for better conversion
      turndownService.addRule('removeScript', {
        filter: ['script', 'style', 'noscript'],
        replacement: () => ''
      });

      turndownService.addRule('preserveCodeBlocks', {
        filter: ['pre', 'code'],
        replacement: (content: string, node: any) => {
          const lang = node.getAttribute('class')?.replace(/language-/, '') || '';
          return node.tagName === 'PRE' ? `\n\`\`\`${lang}\n${content}\n\`\`\`\n` : `\`${content}\``;
        }
      });

      // Enhanced image handling to preserve image information
      turndownService.addRule('preserveImages', {
        filter: 'img',
        replacement: (content: string, node: any) => {
          const alt = node.getAttribute('alt') || '';
          const src = node.getAttribute('src') || '';
          const title = node.getAttribute('title');

          if (!src) return alt ? `[${alt}]` : '';

          // Preserve image with descriptive text for AI analysis
          let imageText = `![${alt}](${src}`;
          if (title) imageText += ` "${title}"`;
          imageText += ')';

          return imageText;
        }
      });

      // Handle navigation and non-content elements
      turndownService.addRule('removeNonContent', {
        filter: ['nav', 'header', 'footer', 'aside', 'menu'],
        replacement: () => ''
      });

      // Preserve table structure for better readability
      turndownService.addRule('preserveTables', {
        filter: 'table',
        replacement: (content: string, node: any) => {
          // Let turndown handle table conversion but ensure proper spacing
          return `\n${content}\n`;
        }
      });

      // Handle forms and interactive elements by describing them
      turndownService.addRule('describeForms', {
        filter: ['form', 'input', 'button', 'select', 'textarea'],
        replacement: (content: string, node: any) => {
          const tagName = node.tagName.toLowerCase();

          switch (tagName) {
            case 'form':
              return `\n[Form: ${content}]\n`;
            case 'input':
              const type = node.getAttribute('type') || 'text';
              const placeholder = node.getAttribute('placeholder');
              const value = node.getAttribute('value');
              let description = `[Input: ${type}`;
              if (placeholder) description += `, placeholder: "${placeholder}"`;
              if (value) description += `, value: "${value}"`;
              description += ']';
              return description;
            case 'button':
              return `[Button: ${content || node.getAttribute('value') || 'Submit'}]`;
            case 'select':
              return `[Select: ${content}]`;
            case 'textarea':
              return `[Textarea: ${content || node.getAttribute('placeholder') || ''}]`;
            default:
              return content;
          }
        }
      });

      return turndownService.turndown(html);
    } catch (error) {
      // If conversion fails, fall back to basic HTML cleanup
      console.warn('HTML to Markdown conversion failed, using fallback:', error);
      return html
        // Remove non-content elements first
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // Remove scripts
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '') // Remove styles
        .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '') // Remove navigation
        .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '') // Remove headers
        .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '') // Remove footers
        .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '') // Remove asides

        // Preserve important structural elements
        .replace(/<h([1-6])[^>]*>(.*?)<\/h\1>/gi, (match, level, content) => {
          const hashLevel = '#'.repeat(parseInt(level));
          return `\n${hashLevel} ${content}\n`;
        })
        .replace(/<p[^>]*>(.*?)<\/p>/gi, '\n$1\n') // Convert paragraphs
        .replace(/<br\s*\/?>/gi, '\n') // Convert line breaks
        .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**') // Convert bold
        .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**') // Convert bold
        .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*') // Convert italic
        .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*') // Convert italic
        .replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`') // Convert inline code
        .replace(/<pre[^>]*>(.*?)<\/pre>/gi, '\n```\n$1\n```\n') // Convert code blocks

        // Handle links and images
        .replace(/<a[^>]*href\s*=\s*["']([^"']*)["'][^>]*>(.*?)<\/a>/gi, '[$2]($1)')
        .replace(/<img[^>]*src\s*=\s*["']([^"']*)["'][^>]*alt\s*=\s*["']([^"']*)["'][^>]*>/gi, '![$2]($1)')
        .replace(/<img[^>]*alt\s*=\s*["']([^"']*)["'][^>]*src\s*=\s*["']([^"']*)["'][^>]*>/gi, '![$1]($2)')
        .replace(/<img[^>]*src\s*=\s*["']([^"']*)["'][^>]*>/gi, '![]($1)')

        // Remove remaining HTML tags
        .replace(/<[^>]*>/g, '')

        // Clean up HTML entities
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&#x27;/g, "'")
        .replace(/&rsquo;/g, "'")
        .replace(/&lsquo;/g, "'")
        .replace(/&rdquo;/g, '"')
        .replace(/&ldquo;/g, '"')
        .replace(/&hellip;/g, '...')
        .replace(/&mdash;/g, '—')
        .replace(/&ndash;/g, '–')

        // Normalize whitespace and format
        .replace(/\n\s*\n\s*\n/g, '\n\n') // Remove excessive line breaks
        .replace(/[ \t]+/g, ' ') // Normalize spaces and tabs
        .replace(/\n /g, '\n') // Remove leading spaces on lines
        .trim();
    }
  }

  /**
   * Format error messages for consistent error reporting
   */
  private formatError(error: unknown): string {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return 'Request timed out';
      }
      if (error.message.includes('fetch')) {
        return `Network error: ${error.message}`;
      }
      return error.message;
    }

    return `Unknown error: ${String(error)}`;
  }

  /**
   * Get cache statistics for monitoring
   */
  public getCacheStats(): { size: number; entries: Array<{ key: string; createdAt: number; ttl: number; url: string }> } {
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      createdAt: entry.createdAt,
      ttl: entry.ttl,
      url: entry.result.metadata?.url || 'unknown',
    }));

    return {
      size: this.cache.size,
      entries,
    };
  }

  /**
   * Clear the entire cache
   */
  public clearCache(): void {
    this.cache.clear();
  }

  /**
   * Remove specific cache entry by URL and parameters
   */
  public removeCacheEntry(params: WebFetchParams): boolean {
    const cacheKey = this.generateCacheKey(params);
    return this.cache.delete(cacheKey);
  }

  /**
   * Force cleanup of expired entries (useful for testing)
   */
  public forceCleanup(): void {
    this.cleanupExpiredEntries();
  }
}

/**
 * Create and export a default instance of WebFetchTool
 */
export const webFetchTool = new WebFetchTool();

/**
 * Convenience function for executing WebFetch operations
 */
export async function webFetch(params: WebFetchParams): Promise<WebFetchResult> {
  return webFetchTool.execute(params);
}