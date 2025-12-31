/**
 * WebFetch Tool Implementation
 *
 * Provides HTTP request capabilities with support for:
 * - Multiple HTTP methods (GET, POST, PUT, DELETE)
 * - Custom headers and request bodies
 * - Timeout handling
 * - Error handling with detailed error information
 * - HTML-to-markdown conversion for better content processing
 */

import TurndownService from 'turndown';

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
  /** Request metadata */
  metadata?: {
    url: string;
    method: string;
    responseTime: number;
    contentLength?: number;
    contentType?: string;
    redirected?: boolean;
    finalUrl?: string;
  };
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

  /**
   * Execute a WebFetch operation
   */
  async execute(params: WebFetchParams): Promise<WebFetchResult> {
    const startTime = Date.now();

    try {
      // Validate and sanitize parameters
      const validatedParams = this.validateParams(params);

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

    return {
      url: params.url,
      method,
      headers: params.headers || {},
      body: params.body,
      timeout,
      convertToMarkdown: params.convertToMarkdown !== false, // default to true
    };
  }

  /**
   * Check if content type indicates HTML
   */
  private isHtmlContent(contentType: string): boolean {
    return contentType.toLowerCase().includes('text/html');
  }

  /**
   * Convert HTML to Markdown using Turndown service
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

      return turndownService.turndown(html);
    } catch (error) {
      // If conversion fails, fall back to basic HTML cleanup
      console.warn('HTML to Markdown conversion failed, using fallback:', error);
      return html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // Remove scripts
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '') // Remove styles
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/&nbsp;/g, ' ') // Replace HTML entities
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ') // Normalize whitespace
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