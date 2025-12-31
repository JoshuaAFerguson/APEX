import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { WebFetchTool, type WebFetchParams } from './webfetch';

// Mock the global fetch function
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Helper function to create mock Response objects
function createMockResponse(options: {
  ok: boolean;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  url: string;
  redirected: boolean;
  text: string;
}): any {
  const headersMap = new Map(Object.entries(options.headers));

  return {
    ok: options.ok,
    status: options.status,
    statusText: options.statusText,
    headers: {
      forEach: (callback: (value: string, key: string) => void) => {
        for (const [key, value] of headersMap) {
          callback(value, key);
        }
      }
    },
    url: options.url,
    redirected: options.redirected,
    text: () => Promise.resolve(options.text),
  };
}

describe('WebFetchTool - Unit Tests with Mocks', () => {
  let tool: WebFetchTool;

  beforeEach(() => {
    tool = new WebFetchTool();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('HTML to Markdown conversion - Mocked', () => {
    it('should convert simple HTML to markdown', async () => {
      const mockHtml = '<h1>Test Title</h1><p>Test paragraph with <strong>bold</strong> text.</p>';

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'content-length': mockHtml.length.toString(),
        },
        url: 'https://test.com',
        redirected: false,
        text: mockHtml,
      }));

      const params: WebFetchParams = {
        url: 'https://test.com',
        convertToMarkdown: true,
      };

      const result = await tool.execute(params);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data).toContain('# Test Title');
      expect(result.data).toContain('**bold**');
      expect(result.data).not.toContain('<h1>');
      expect(result.data).not.toContain('<strong>');
    });

    it('should handle HTML with code blocks', async () => {
      const mockHtml = '<h1>Code Example</h1><pre><code class="language-javascript">console.log("Hello, World!");</code></pre>';

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'content-length': mockHtml.length.toString(),
        },
        url: 'https://test.com',
        redirected: false,
        text: mockHtml,
      }));

      const params: WebFetchParams = {
        url: 'https://test.com',
        convertToMarkdown: true,
      };

      const result = await tool.execute(params);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data).toContain('```javascript');
      expect(result.data).toContain('console.log');
      expect(result.data).toContain('```');
    });

    it('should remove scripts and styles from HTML', async () => {
      const mockHtml = `
        <html>
          <head>
            <style>body { color: red; }</style>
            <script>alert('test');</script>
          </head>
          <body>
            <h1>Clean Content</h1>
            <p>This should remain</p>
            <script>console.log('remove me');</script>
          </body>
        </html>
      `;

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'content-length': mockHtml.length.toString(),
        },
        url: 'https://test.com',
        redirected: false,
        text: mockHtml,
      }));

      const params: WebFetchParams = {
        url: 'https://test.com',
        convertToMarkdown: true,
      };

      const result = await tool.execute(params);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data).toContain('Clean Content');
      expect(result.data).toContain('This should remain');
      expect(result.data).not.toContain('alert');
      expect(result.data).not.toContain('console.log');
      expect(result.data).not.toContain('color: red');
    });

    it('should handle images with alt text and preserve them in markdown', async () => {
      const mockHtml = `
        <html>
          <body>
            <h1>Page with Images</h1>
            <img src="/image1.jpg" alt="First image" title="Image title">
            <img src="/image2.png" alt="Second image">
            <img src="/image3.gif">
            <p>Some text after images</p>
          </body>
        </html>
      `;

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'content-length': mockHtml.length.toString(),
        },
        url: 'https://test.com',
        redirected: false,
        text: mockHtml,
      }));

      const params: WebFetchParams = {
        url: 'https://test.com',
        convertToMarkdown: true,
      };

      const result = await tool.execute(params);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data).toContain('![First image](/image1.jpg "Image title")');
      expect(result.data).toContain('![Second image](/image2.png)');
      expect(result.data).toContain('![](/image3.gif)');
      expect(result.data).toContain('Some text after images');
    });

    it('should handle forms and interactive elements descriptively', async () => {
      const mockHtml = `
        <html>
          <body>
            <h1>Contact Form</h1>
            <form action="/submit" method="post">
              <input type="text" name="name" placeholder="Enter your name">
              <input type="email" name="email" placeholder="Enter your email">
              <textarea name="message" placeholder="Your message"></textarea>
              <select name="category">
                <option value="general">General</option>
                <option value="support">Support</option>
              </select>
              <button type="submit">Submit Form</button>
            </form>
          </body>
        </html>
      `;

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'content-length': mockHtml.length.toString(),
        },
        url: 'https://test.com',
        redirected: false,
        text: mockHtml,
      }));

      const params: WebFetchParams = {
        url: 'https://test.com',
        convertToMarkdown: true,
      };

      const result = await tool.execute(params);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data).toContain('[Input: text, placeholder: "Enter your name"]');
      expect(result.data).toContain('[Input: email, placeholder: "Enter your email"]');
      expect(result.data).toContain('[Textarea: Your message]');
      expect(result.data).toContain('[Button: Submit Form]');
    });

    it('should remove navigation elements and preserve main content', async () => {
      const mockHtml = `
        <html>
          <body>
            <nav>
              <a href="/home">Home</a>
              <a href="/about">About</a>
            </nav>
            <header>
              <h1>Site Header</h1>
            </header>
            <main>
              <h1>Main Content</h1>
              <p>This is the important content</p>
            </main>
            <aside>
              <h3>Sidebar</h3>
              <p>Sidebar content</p>
            </aside>
            <footer>
              <p>Footer content</p>
            </footer>
          </body>
        </html>
      `;

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'content-length': mockHtml.length.toString(),
        },
        url: 'https://test.com',
        redirected: false,
        text: mockHtml,
      }));

      const params: WebFetchParams = {
        url: 'https://test.com',
        convertToMarkdown: true,
      };

      const result = await tool.execute(params);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data).toContain('Main Content');
      expect(result.data).toContain('This is the important content');
      // Should not contain navigation elements
      expect(result.data).not.toContain('Home');
      expect(result.data).not.toContain('About');
      expect(result.data).not.toContain('Site Header');
      expect(result.data).not.toContain('Sidebar');
      expect(result.data).not.toContain('Footer content');
    });

    it('should handle HTML conversion fallback on error', async () => {
      const mockHtml = '<h1>Test &nbsp; Title</h1><p>Content with &amp; entities</p>';

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'content-length': mockHtml.length.toString(),
        },
        url: 'https://test.com',
        redirected: false,
        text: mockHtml,
      }));

      // Mock console.warn to suppress warning during test
      const originalConsoleWarn = console.warn;
      console.warn = vi.fn();

      const params: WebFetchParams = {
        url: 'https://test.com',
        convertToMarkdown: true,
      };

      const result = await tool.execute(params);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      // Should clean up HTML entities even in fallback
      expect(result.data).toContain('Test');
      expect(result.data).toContain('Content with');

      console.warn = originalConsoleWarn;
    });

    it('should handle enhanced HTML entities in fallback', async () => {
      const mockHtml = `
        <h1>Quote Test: &ldquo;Hello&rdquo; &amp; &lsquo;World&rsquo;</h1>
        <p>Symbols: &mdash; &ndash; &hellip;</p>
        <img src="/test.jpg" alt="Test Image">
        <a href="/link">Test Link</a>
        <strong>Bold text</strong> and <em>italic text</em>
      `;

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'content-length': mockHtml.length.toString(),
        },
        url: 'https://test.com',
        redirected: false,
        text: mockHtml,
      }));

      // Mock console.warn to suppress warning during test
      const originalConsoleWarn = console.warn;
      console.warn = vi.fn();

      const params: WebFetchParams = {
        url: 'https://test.com',
        convertToMarkdown: true,
      };

      const result = await tool.execute(params);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      // Check HTML entities are properly converted
      expect(result.data).toContain('"Hello"');
      expect(result.data).toContain("'World'");
      expect(result.data).toContain('—'); // mdash
      expect(result.data).toContain('–'); // ndash
      expect(result.data).toContain('...'); // hellip
      // Check markdown formatting
      expect(result.data).toContain('# Quote Test');
      expect(result.data).toContain('![Test Image](/test.jpg)');
      expect(result.data).toContain('[Test Link](/link)');
      expect(result.data).toContain('**Bold text**');
      expect(result.data).toContain('*italic text*');

      console.warn = originalConsoleWarn;
    });

    it('should not convert non-HTML content', async () => {
      const mockJson = '{"message": "Hello, World!"}';

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'content-length': mockJson.length.toString(),
        },
        url: 'https://test.com',
        redirected: false,
        text: mockJson,
      }));

      const params: WebFetchParams = {
        url: 'https://test.com',
        convertToMarkdown: true,
      };

      const result = await tool.execute(params);

      expect(result.success).toBe(true);
      expect(result.data).toBe(mockJson); // Should remain unchanged
    });
  });

  describe('Network error handling - Mocked', () => {
    it('should handle fetch abort error', async () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValueOnce(abortError);

      const params: WebFetchParams = {
        url: 'https://test.com',
        timeout: 1000,
      };

      const result = await tool.execute(params);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Request timed out');
      expect(result.metadata?.responseTime).toBeGreaterThan(0);
    });

    it('should handle network fetch error', async () => {
      const networkError = new Error('fetch failed');
      mockFetch.mockRejectedValueOnce(networkError);

      const params: WebFetchParams = {
        url: 'https://test.com',
      };

      const result = await tool.execute(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error: fetch failed');
    });

    it('should handle generic error', async () => {
      const genericError = new Error('Something went wrong');
      mockFetch.mockRejectedValueOnce(genericError);

      const params: WebFetchParams = {
        url: 'https://test.com',
      };

      const result = await tool.execute(params);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Something went wrong');
    });

    it('should handle non-Error objects', async () => {
      mockFetch.mockRejectedValueOnce('string error');

      const params: WebFetchParams = {
        url: 'https://test.com',
      };

      const result = await tool.execute(params);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown error: string error');
    });
  });

  describe('Response processing - Mocked', () => {
    it('should process successful response correctly', async () => {
      const mockResponseText = 'Mock response content';

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          'content-type': 'text/plain',
          'content-length': mockResponseText.length.toString(),
          'x-custom-header': 'custom-value',
        },
        url: 'https://final.com',
        redirected: true,
        text: mockResponseText,
      }));

      const params: WebFetchParams = {
        url: 'https://original.com',
      };

      const result = await tool.execute(params);

      expect(result.success).toBe(true);
      expect(result.status).toBe(200);
      expect(result.data).toBe(mockResponseText);
      expect(result.headers).toEqual({
        'content-type': 'text/plain',
        'content-length': mockResponseText.length.toString(),
        'x-custom-header': 'custom-value',
      });
      expect(result.metadata).toEqual({
        url: params.url,
        method: 'GET',
        responseTime: expect.any(Number),
        contentLength: mockResponseText.length,
        contentType: 'text/plain',
        redirected: true,
        finalUrl: 'https://final.com',
      });
    });

    it('should handle HTTP error responses', async () => {
      const mockResponseText = 'Not Found';

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: {
          'content-type': 'text/plain',
        },
        url: 'https://test.com',
        redirected: false,
        text: mockResponseText,
      }));

      const params: WebFetchParams = {
        url: 'https://test.com',
      };

      const result = await tool.execute(params);

      expect(result.success).toBe(false);
      expect(result.status).toBe(404);
      expect(result.error).toBe('HTTP 404: Not Found');
      expect(result.data).toBe(mockResponseText);
    });

    it('should handle response without content-length header', async () => {
      const mockResponseText = 'Response without content-length';

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          'content-type': 'text/plain',
          // No content-length header
        },
        url: 'https://test.com',
        redirected: false,
        text: mockResponseText,
      }));

      const params: WebFetchParams = {
        url: 'https://test.com',
      };

      const result = await tool.execute(params);

      expect(result.success).toBe(true);
      expect(result.metadata?.contentLength).toBe(mockResponseText.length);
    });
  });

  describe('Request configuration - Mocked', () => {
    it('should set correct headers including User-Agent', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {},
        url: 'https://test.com',
        redirected: false,
        text: 'OK',
      }));

      const params: WebFetchParams = {
        url: 'https://test.com',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer token',
        },
        body: '{"test": true}',
      };

      await tool.execute(params);

      expect(mockFetch).toHaveBeenCalledWith('https://test.com', {
        method: 'POST',
        headers: {
          'User-Agent': 'APEX-Agent/1.0',
          'Content-Type': 'application/json',
          'Authorization': 'Bearer token',
        },
        body: '{"test": true}',
        signal: expect.any(AbortSignal),
      });
    });

    it('should handle timeout configuration', async () => {
      // Mock AbortController
      const mockAbort = vi.fn();
      const mockAbortController = {
        abort: mockAbort,
        signal: { aborted: false },
      };
      const mockAbortConstructor = vi.fn(() => mockAbortController);
      global.AbortController = mockAbortConstructor as any;

      // Mock setTimeout to immediately call the timeout callback
      const mockSetTimeout = vi.fn((callback: () => void) => {
        callback(); // Immediately call to simulate timeout
        return 123;
      });
      const mockClearTimeout = vi.fn();
      global.setTimeout = mockSetTimeout as any;
      global.clearTimeout = mockClearTimeout;

      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValueOnce(abortError);

      const params: WebFetchParams = {
        url: 'https://test.com',
        timeout: 5000,
      };

      const result = await tool.execute(params);

      expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), 5000);
      expect(mockAbort).toHaveBeenCalled();
      expect(result.error).toBe('Request timed out');
    });
  });

  describe('Error message formatting', () => {
    it('should format AbortError as timeout', async () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValueOnce(abortError);

      const params: WebFetchParams = {
        url: 'https://test.com',
        timeout: 1000,
      };

      const result = await tool.execute(params);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Request timed out');
    });

    it('should format fetch errors with network prefix', async () => {
      const fetchError = new Error('fetch request failed');
      mockFetch.mockRejectedValueOnce(fetchError);

      const params: WebFetchParams = {
        url: 'https://test.com',
      };

      const result = await tool.execute(params);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error: fetch request failed');
    });

    it('should handle unknown error types', () => {
      const tool = new WebFetchTool();
      // Use type assertion to access private method for testing
      const formatError = (tool as any).formatError.bind(tool);

      const result = formatError('unknown error type');
      expect(result).toBe('Unknown error: unknown error type');
    });
  });
});