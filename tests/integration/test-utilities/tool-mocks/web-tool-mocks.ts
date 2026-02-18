/**
 * @fileoverview Web Tool Mocks
 *
 * This file provides mock implementations for web-related tools including
 * WebFetch and WebSearch with realistic network simulation.
 */

import { vi } from 'vitest';
import type { ToolMock } from '../types.js';
import { createToolMock } from './tool-mock-factory.js';

// ============================================================================
// Mock Web Response Types
// ============================================================================

interface MockWebResponse {
  url: string;
  status: number;
  headers: Record<string, string>;
  content: string;
  contentType: string;
  responseTime: number;
}

interface MockSearchResult {
  title: string;
  url: string;
  snippet: string;
  timestamp?: Date;
}

// ============================================================================
// WebFetch Tool Mocks
// ============================================================================

/**
 * Create a WebFetch tool mock with configurable responses
 */
export function createWebFetchMock(
  responses: Record<string, MockWebResponse | string> = {},
  options: {
    defaultDelay?: number;
    simulateNetworkFailure?: boolean;
    blockedDomains?: string[];
    timeout?: number;
  } = {}
): ToolMock {
  const calls: ToolMock['calls'] = [];
  const { defaultDelay = 100, simulateNetworkFailure = false, blockedDomains = [], timeout = 5000 } = options;

  const mockFn = vi.fn().mockImplementation(async (params: {
    url: string;
    prompt: string;
    timeout?: number;
  }) => {
    const callInfo = {
      args: [params],
      timestamp: new Date(),
      result: undefined as any,
      error: undefined as Error | undefined,
    };

    try {
      const { url, prompt, timeout: requestTimeout = timeout } = params;

      if (!url) {
        const error = new Error('URL parameter is required');
        callInfo.error = error;
        throw error;
      }

      // Validate URL format
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(url);
      } catch {
        const error = new Error(`Invalid URL format: ${url}`);
        callInfo.error = error;
        throw error;
      }

      // Check if domain is blocked
      const domain = parsedUrl.hostname;
      if (blockedDomains.some((blocked) => domain.includes(blocked))) {
        const error = new Error(`Access to domain ${domain} is blocked`);
        callInfo.error = error;
        throw error;
      }

      // Simulate network failure
      if (simulateNetworkFailure && Math.random() < 0.1) {
        const error = new Error('Network error: Connection timeout');
        callInfo.error = error;
        throw error;
      }

      // Simulate network delay
      if (defaultDelay > 0) {
        await new Promise((resolve) => setTimeout(resolve, defaultDelay));
      }

      // Check for configured response
      let response: MockWebResponse;
      const configuredResponse = responses[url] || responses[domain] || responses['*'];

      if (configuredResponse) {
        if (typeof configuredResponse === 'string') {
          response = {
            url,
            status: 200,
            headers: { 'content-type': 'text/html; charset=utf-8' },
            content: configuredResponse,
            contentType: 'text/html',
            responseTime: defaultDelay,
          };
        } else {
          response = { ...configuredResponse, url };
        }
      } else {
        // Generate default response based on URL
        response = generateDefaultWebResponse(url);
      }

      // Process content with the prompt (simulate AI processing)
      const processedContent = processContentWithPrompt(response.content, prompt);

      const result = {
        success: true,
        url: response.url,
        status: response.status,
        headers: response.headers,
        content: response.content,
        processed_content: processedContent,
        response_time_ms: response.responseTime,
        final_url: url, // In case of redirects
      };

      callInfo.result = result;
      return result;
    } finally {
      calls.push(callInfo);
    }
  });

  return {
    mock: mockFn,
    config: { tool: 'WebFetch', shouldSucceed: true, trackCalls: true },
    calls,
    reset: () => {
      mockFn.mockClear();
      calls.length = 0;
    },
    getCallHistory: () => [...calls],
  };
}

/**
 * Create a WebFetch mock that simulates different HTTP status codes
 */
export function createHttpStatusWebFetchMock(statusCode: number, message?: string): ToolMock {
  return createToolMock({
    tool: 'WebFetch',
    shouldSucceed: statusCode >= 200 && statusCode < 300,
    response: statusCode >= 200 && statusCode < 300 ? {
      success: true,
      status: statusCode,
      content: message || `HTTP ${statusCode} response content`,
      headers: { 'content-type': 'text/html' },
    } : undefined,
    error: statusCode >= 400 ? new Error(`HTTP ${statusCode}: ${message || getHttpStatusMessage(statusCode)}`) : undefined,
    trackCalls: true,
  });
}

// ============================================================================
// WebSearch Tool Mocks
// ============================================================================

/**
 * Create a WebSearch tool mock with configurable search results
 */
export function createWebSearchMock(
  searchResults: Record<string, MockSearchResult[]> = {},
  options: {
    defaultResultCount?: number;
    simulateNoResults?: boolean;
    simulateError?: boolean;
    delay?: number;
  } = {}
): ToolMock {
  const calls: ToolMock['calls'] = [];
  const {
    defaultResultCount = 5,
    simulateNoResults = false,
    simulateError = false,
    delay = 200,
  } = options;

  const mockFn = vi.fn().mockImplementation(async (params: {
    query: string;
    allowed_domains?: string[];
    blocked_domains?: string[];
  }) => {
    const callInfo = {
      args: [params],
      timestamp: new Date(),
      result: undefined as any,
      error: undefined as Error | undefined,
    };

    try {
      const { query, allowed_domains, blocked_domains = [] } = params;

      if (!query) {
        const error = new Error('Query parameter is required');
        callInfo.error = error;
        throw error;
      }

      // Simulate search error
      if (simulateError && Math.random() < 0.1) {
        const error = new Error('Search service temporarily unavailable');
        callInfo.error = error;
        throw error;
      }

      // Simulate search delay
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      let results: MockSearchResult[];

      // Check for configured results
      const configuredResults = searchResults[query] || searchResults[query.toLowerCase()] || searchResults['*'];

      if (configuredResults) {
        results = [...configuredResults];
      } else if (simulateNoResults) {
        results = [];
      } else {
        // Generate default search results
        results = generateDefaultSearchResults(query, defaultResultCount);
      }

      // Filter by domain restrictions
      if (allowed_domains && allowed_domains.length > 0) {
        results = results.filter((result) => {
          const domain = new URL(result.url).hostname;
          return allowed_domains.some((allowed) => domain.includes(allowed));
        });
      }

      if (blocked_domains.length > 0) {
        results = results.filter((result) => {
          const domain = new URL(result.url).hostname;
          return !blocked_domains.some((blocked) => domain.includes(blocked));
        });
      }

      // Add sources formatted as markdown
      const sources = results.map((result) => `[${result.title}](${result.url})`);

      const result = {
        success: true,
        query,
        results,
        result_count: results.length,
        search_time_ms: delay,
        sources,
      };

      callInfo.result = result;
      return result;
    } finally {
      calls.push(callInfo);
    }
  });

  return {
    mock: mockFn,
    config: { tool: 'WebSearch', shouldSucceed: true, trackCalls: true },
    calls,
    reset: () => {
      mockFn.mockClear();
      calls.length = 0;
    },
    getCallHistory: () => [...calls],
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate a default web response for a URL
 */
function generateDefaultWebResponse(url: string): MockWebResponse {
  const parsedUrl = new URL(url);
  const domain = parsedUrl.hostname;

  const content = `<!DOCTYPE html>
<html>
<head>
    <title>Mock Page - ${domain}</title>
    <meta charset="utf-8">
</head>
<body>
    <h1>Welcome to ${domain}</h1>
    <p>This is a mock web page generated for testing purposes.</p>
    <p>URL: ${url}</p>
    <p>Domain: ${domain}</p>
    <p>Generated at: ${new Date().toISOString()}</p>

    <nav>
        <ul>
            <li><a href="/">Home</a></li>
            <li><a href="/about">About</a></li>
            <li><a href="/contact">Contact</a></li>
        </ul>
    </nav>

    <main>
        <article>
            <h2>Article Title</h2>
            <p>This is sample content for testing web scraping and content analysis.</p>
            <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>
        </article>
    </main>

    <footer>
        <p>&copy; 2024 Mock Website. All rights reserved.</p>
    </footer>
</body>
</html>`;

  return {
    url,
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'content-length': content.length.toString(),
      'server': 'Mock-Server/1.0',
    },
    content,
    contentType: 'text/html',
    responseTime: 100 + Math.random() * 200,
  };
}

/**
 * Generate default search results for a query
 */
function generateDefaultSearchResults(query: string, count: number): MockSearchResult[] {
  const results: MockSearchResult[] = [];

  for (let i = 0; i < count; i++) {
    results.push({
      title: `${query} - Result ${i + 1}`,
      url: `https://example${i + 1}.com/${query.replace(/\s+/g, '-').toLowerCase()}`,
      snippet: `This is a mock search result for "${query}". This result contains relevant information about ${query} and related topics. Generated for testing purposes.`,
      timestamp: new Date(Date.now() - Math.random() * 86400000), // Random time within last 24 hours
    });
  }

  return results;
}

/**
 * Simulate AI processing of web content with a prompt
 */
function processContentWithPrompt(content: string, prompt: string): string {
  // Extract key information based on the prompt
  const lowerPrompt = prompt.toLowerCase();

  if (lowerPrompt.includes('summary') || lowerPrompt.includes('summarize')) {
    return `Summary: This is a mock webpage containing sample content. The page includes navigation, main content, and footer sections. Generated for testing web content processing.`;
  }

  if (lowerPrompt.includes('title') || lowerPrompt.includes('heading')) {
    const titleMatch = content.match(/<title>(.*?)<\/title>/i);
    const h1Match = content.match(/<h1[^>]*>(.*?)<\/h1>/i);
    return titleMatch ? titleMatch[1] : h1Match ? h1Match[1] : 'No title found';
  }

  if (lowerPrompt.includes('links') || lowerPrompt.includes('urls')) {
    const linkMatches = content.match(/<a[^>]+href="([^"]*)"[^>]*>(.*?)<\/a>/gi);
    return linkMatches ? linkMatches.join(', ') : 'No links found';
  }

  // Default: return first paragraph or snippet
  const paragraphMatch = content.match(/<p[^>]*>(.*?)<\/p>/i);
  return paragraphMatch ? paragraphMatch[1] : 'Mock content processed based on the provided prompt.';
}

/**
 * Get standard HTTP status messages
 */
function getHttpStatusMessage(statusCode: number): string {
  const messages: Record<number, string> = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    405: 'Method Not Allowed',
    408: 'Request Timeout',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout',
  };

  return messages[statusCode] || 'Unknown Status';
}