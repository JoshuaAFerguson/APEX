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

describe('WebFetchTool - HTML-to-Markdown Edge Cases', () => {
  let tool: WebFetchTool;

  beforeEach(() => {
    tool = new WebFetchTool();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Complex HTML structures', () => {
    it('should handle nested lists with mixed content', async () => {
      const mockHtml = `
        <html>
          <body>
            <h2>Shopping List</h2>
            <ul>
              <li>Fruits
                <ul>
                  <li>Apples <strong>(red)</strong></li>
                  <li>Bananas</li>
                  <li>Oranges <em>organic</em></li>
                </ul>
              </li>
              <li>Vegetables
                <ol>
                  <li>Carrots</li>
                  <li>Broccoli</li>
                </ol>
              </li>
            </ul>
          </body>
        </html>
      `;

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          'content-type': 'text/html; charset=utf-8',
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
      expect(result.data).toContain('## Shopping List');
      expect(result.data).toContain('- Fruits');
      expect(result.data).toContain('- Apples **');
      expect(result.data).toContain('*organic*');
      expect(result.data).toContain('1. Carrots');
      expect(result.data).toContain('2. Broccoli');
    });

    it('should handle complex tables with headers and cells', async () => {
      const mockHtml = `
        <html>
          <body>
            <h1>Data Table</h1>
            <table border="1">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Age</th>
                  <th>City</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>John Doe</strong></td>
                  <td>30</td>
                  <td>New York</td>
                  <td><em>Active</em></td>
                </tr>
                <tr>
                  <td>Jane Smith</td>
                  <td>25</td>
                  <td>Los Angeles</td>
                  <td>Inactive</td>
                </tr>
                <tr>
                  <td colspan="2">Total Users: 2</td>
                  <td colspan="2">Updated: Today</td>
                </tr>
              </tbody>
            </table>
          </body>
        </html>
      `;

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          'content-type': 'text/html; charset=utf-8',
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
      expect(result.data).toContain('# Data Table');
      expect(result.data).toContain('Name');
      expect(result.data).toContain('Age');
      expect(result.data).toContain('**John Doe**');
      expect(result.data).toContain('*Active*');
      expect(result.data).toContain('Total Users: 2');
    });

    it('should handle complex forms with multiple input types', async () => {
      const mockHtml = `
        <html>
          <body>
            <h1>Registration Form</h1>
            <form action="/register" method="post">
              <fieldset>
                <legend>Personal Information</legend>
                <input type="text" name="firstName" placeholder="First Name" required>
                <input type="text" name="lastName" placeholder="Last Name" required>
                <input type="email" name="email" placeholder="Email Address">
                <input type="password" name="password" placeholder="Password">
                <input type="date" name="birthDate">
                <input type="number" name="age" min="18" max="99">
                <input type="tel" name="phone" placeholder="+1-234-567-8900">
              </fieldset>
              <fieldset>
                <legend>Preferences</legend>
                <input type="radio" name="theme" value="light" checked> Light Theme
                <input type="radio" name="theme" value="dark"> Dark Theme
                <input type="checkbox" name="newsletter" checked> Subscribe to newsletter
                <input type="checkbox" name="terms"> Accept terms and conditions
                <select name="country">
                  <option value="">Select Country</option>
                  <option value="us" selected>United States</option>
                  <option value="ca">Canada</option>
                  <option value="uk">United Kingdom</option>
                </select>
                <textarea name="bio" rows="4" placeholder="Tell us about yourself"></textarea>
              </fieldset>
              <input type="file" name="avatar" accept="image/*">
              <button type="submit">Create Account</button>
              <button type="reset">Clear Form</button>
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
      expect(result.data).toContain('# Registration Form');
      expect(result.data).toContain('[Input: text, placeholder: "First Name"]');
      expect(result.data).toContain('[Input: email, placeholder: "Email Address"]');
      expect(result.data).toContain('[Input: password, placeholder: "Password"]');
      expect(result.data).toContain('[Input: date]');
      expect(result.data).toContain('[Input: number]');
      expect(result.data).toContain('[Input: tel, placeholder: "+1-234-567-8900"]');
      expect(result.data).toContain('[Input: radio]');
      expect(result.data).toContain('[Input: checkbox]');
      expect(result.data).toContain('[Input: file]');
      expect(result.data).toContain('[Select:');
      expect(result.data).toContain('[Textarea: Tell us about yourself]');
      expect(result.data).toContain('[Button: Create Account]');
      expect(result.data).toContain('[Button: Clear Form]');
    });

    it('should handle inline code and syntax highlighting', async () => {
      const mockHtml = `
        <html>
          <body>
            <h1>Code Examples</h1>
            <p>Use the <code>console.log()</code> function to output debug information.</p>
            <p>Here's a JavaScript example:</p>
            <pre><code class="language-javascript">
function greet(name) {
  console.log(\`Hello, \${name}!\`);
  return \`Welcome, \${name}\`;
}

greet("World");
            </code></pre>
            <p>And here's some <code>inline code</code> with backticks.</p>
            <pre><code class="language-python">
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)

print(fibonacci(10))
            </code></pre>
          </body>
        </html>
      `;

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          'content-type': 'text/html; charset=utf-8',
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
      expect(result.data).toContain('# Code Examples');
      expect(result.data).toContain('`console.log()`');
      expect(result.data).toContain('```javascript');
      expect(result.data).toContain('function greet');
      expect(result.data).toContain('```python');
      expect(result.data).toContain('def fibonacci');
      expect(result.data).toContain('`inline code`');
    });
  });

  describe('Malformed HTML handling', () => {
    it('should handle unclosed tags gracefully', async () => {
      const mockHtml = `
        <html>
          <body>
            <h1>Unclosed Tags Test
            <p>This paragraph is not closed
            <div>This div is not closed
            <strong>This strong tag is not closed
            <em>This emphasis tag is not closed
            Some text without any tags
          </body>
        </html>
      `;

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          'content-type': 'text/html; charset=utf-8',
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
      expect(result.data).toContain('Unclosed Tags Test');
      expect(result.data).toContain('This paragraph is not closed');
      expect(result.data).toContain('Some text without any tags');
    });

    it('should handle self-closing tags and void elements', async () => {
      const mockHtml = `
        <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <link rel="stylesheet" href="styles.css">
          </head>
          <body>
            <h1>Self-Closing Tags</h1>
            <p>Here's a line break: <br> And another one <br/></p>
            <hr>
            <img src="image.jpg" alt="Test image" />
            <input type="text" name="test" />
            <area shape="rect" coords="0,0,100,100" href="link.html">
            <p>Some text after void elements.</p>
          </body>
        </html>
      `;

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          'content-type': 'text/html; charset=utf-8',
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
      expect(result.data).toContain('# Self-Closing Tags');
      expect(result.data).toContain('![Test image](image.jpg)');
      expect(result.data).toContain('[Input: text]');
      expect(result.data).toContain('Some text after void elements');
    });

    it('should handle mixed case HTML tags', async () => {
      const mockHtml = `
        <HTML>
          <BODY>
            <H1>Mixed Case Tags</H1>
            <P>This paragraph has <STRONG>strong text</STRONG> and <EM>emphasized text</EM>.</P>
            <UL>
              <LI>First item</LI>
              <LI>Second item</LI>
            </UL>
            <A href="http://example.com">Mixed Case Link</A>
            <IMG src="image.jpg" alt="Mixed Case Image">
          </BODY>
        </HTML>
      `;

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          'content-type': 'text/html; charset=utf-8',
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
      expect(result.data).toContain('# Mixed Case Tags');
      expect(result.data).toContain('**strong text**');
      expect(result.data).toContain('*emphasized text*');
      expect(result.data).toContain('- First item');
      expect(result.data).toContain('- Second item');
      expect(result.data).toContain('[Mixed Case Link](http://example.com)');
      expect(result.data).toContain('![Mixed Case Image](image.jpg)');
    });
  });

  describe('Special content handling', () => {
    it('should handle HTML comments and CDATA sections', async () => {
      const mockHtml = `
        <html>
          <body>
            <!-- This is a comment that should be removed -->
            <h1>Comments and CDATA Test</h1>
            <!-- Another comment here -->
            <p>This text should remain.</p>
            <![CDATA[
              This is CDATA content that should be handled
            ]]>
            <script>
              /* This JavaScript should be removed */
              console.log("This script should be gone");
            </script>
            <!-- Final comment -->
            <p>Final paragraph.</p>
          </body>
        </html>
      `;

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          'content-type': 'text/html; charset=utf-8',
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
      expect(result.data).toContain('# Comments and CDATA Test');
      expect(result.data).toContain('This text should remain');
      expect(result.data).toContain('Final paragraph');
      expect(result.data).not.toContain('This is a comment');
      expect(result.data).not.toContain('console.log');
      expect(result.data).not.toContain('This script should be gone');
    });

    it('should handle special HTML entities and Unicode characters', async () => {
      const mockHtml = `
        <html>
          <body>
            <h1>Special Characters &amp; Entities</h1>
            <p>Basic entities: &lt; &gt; &quot; &#39; &amp;</p>
            <p>Quotes: &ldquo;Hello&rdquo; &amp; &lsquo;World&rsquo;</p>
            <p>Dashes: &mdash; &ndash; and ellipsis &hellip;</p>
            <p>Currency: &euro; &pound; &yen; &cent;</p>
            <p>Math: &plusmn; &times; &divide; &infin;</p>
            <p>Unicode: \u00A9 \u00AE \u2122 \u2661</p>
            <p>Non-breaking spaces: word&nbsp;word&nbsp;word</p>
            <p>Accented characters: caf&eacute; r&eacute;sum&eacute; na&iuml;ve</p>
          </body>
        </html>
      `;

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          'content-type': 'text/html; charset=utf-8',
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
      expect(result.data).toContain('# Special Characters & Entities');
      expect(result.data).toContain('Basic entities: < > " \' &');
      expect(result.data).toContain('"Hello" & \'World\'');
      expect(result.data).toContain('— – and ellipsis ...');
      expect(result.data).toContain('word word word');
      expect(result.data).toContain('café résumé naïve');
    });

    it('should handle deeply nested and complex structures', async () => {
      const mockHtml = `
        <html>
          <body>
            <article>
              <header>
                <h1>Complex Article</h1>
                <p>By <strong>Author Name</strong> on <time datetime="2023-12-01">December 1, 2023</time></p>
              </header>
              <section>
                <h2>Introduction</h2>
                <p>This is a <em>complex</em> document with <strong>nested</strong> elements.</p>
                <blockquote cite="http://example.com">
                  <p>This is a blockquote with <a href="http://example.com">a link</a> inside.</p>
                  <footer>— <cite>Famous Person</cite></footer>
                </blockquote>
              </section>
              <section>
                <h2>Data Section</h2>
                <figure>
                  <img src="chart.png" alt="Data chart" title="Sales Data">
                  <figcaption>Figure 1: Sales data for <abbr title="Quarter 1">Q1</abbr></figcaption>
                </figure>
                <details>
                  <summary>Click to see details</summary>
                  <p>Hidden content that can be revealed.</p>
                  <ul>
                    <li>Detail 1</li>
                    <li>Detail 2</li>
                  </ul>
                </details>
              </section>
              <footer>
                <p><small>Copyright © 2023 Company Name</small></p>
              </footer>
            </article>
          </body>
        </html>
      `;

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          'content-type': 'text/html; charset=utf-8',
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
      expect(result.data).toContain('# Complex Article');
      expect(result.data).toContain('**Author Name**');
      expect(result.data).toContain('## Introduction');
      expect(result.data).toContain('*complex*');
      expect(result.data).toContain('**nested**');
      expect(result.data).toContain('[a link](http://example.com)');
      expect(result.data).toContain('![Data chart](chart.png "Sales Data")');
      expect(result.data).toContain('Figure 1: Sales data');
      expect(result.data).toContain('- Detail 1');
      expect(result.data).toContain('Copyright © 2023');
    });
  });

  describe('Performance and stress tests', () => {
    it('should handle very large HTML documents efficiently', async () => {
      // Create a large HTML document with repetitive structure
      const largeContent = Array.from({ length: 1000 }, (_, i) => `
        <article>
          <h2>Article ${i + 1}</h2>
          <p>This is paragraph 1 of article ${i + 1} with <strong>bold text</strong> and <em>italic text</em>.</p>
          <p>This is paragraph 2 with a <a href="http://example.com/${i}">link ${i}</a>.</p>
          <ul>
            <li>Item 1</li>
            <li>Item 2</li>
            <li>Item 3</li>
          </ul>
        </article>
      `).join('');

      const mockHtml = `
        <html>
          <head><title>Large Document</title></head>
          <body>
            <h1>Large Document Test</h1>
            ${largeContent}
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

      const startTime = Date.now();
      const result = await tool.execute(params);
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data).toContain('# Large Document Test');
      expect(result.data).toContain('## Article 1');
      expect(result.data).toContain('## Article 1000');

      // Performance check - should complete within reasonable time (10 seconds)
      const processingTime = endTime - startTime;
      expect(processingTime).toBeLessThan(10000);

      // Verify content length is reasonable
      expect(result.data!.length).toBeGreaterThan(1000);
      expect(result.metadata?.contentLength).toBeGreaterThan(1000);
    });

    it('should handle documents with many images and links', async () => {
      const imageContent = Array.from({ length: 100 }, (_, i) =>
        `<img src="image${i}.jpg" alt="Image ${i}" title="Title ${i}">`
      ).join('\n');

      const linkContent = Array.from({ length: 100 }, (_, i) =>
        `<a href="http://example.com/link${i}">Link ${i}</a>`
      ).join(' | ');

      const mockHtml = `
        <html>
          <body>
            <h1>Images and Links Test</h1>
            <div class="images">
              ${imageContent}
            </div>
            <div class="links">
              ${linkContent}
            </div>
          </body>
        </html>
      `;

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          'content-type': 'text/html; charset=utf-8',
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
      expect(result.data).toContain('# Images and Links Test');
      expect(result.data).toContain('![Image 0](image0.jpg "Title 0")');
      expect(result.data).toContain('![Image 99](image99.jpg "Title 99")');
      expect(result.data).toContain('[Link 0](http://example.com/link0)');
      expect(result.data).toContain('[Link 99](http://example.com/link99)');
    });
  });

  describe('Fallback HTML cleanup edge cases', () => {
    it('should handle complex HTML entities in fallback mode', async () => {
      const mockHtml = `
        <div class="complex">
          <h1>Mathematical &amp; Scientific Symbols</h1>
          <p>&alpha; &beta; &gamma; &delta; &epsilon; &zeta; &eta; &theta;</p>
          <p>&sum; &prod; &int; &infin; &part; &nabla; &exist; &forall;</p>
          <p>&le; &ge; &ne; &equiv; &asymp; &cong; &sim; &prop;</p>
          <p>&and; &or; &not; &cap; &cup; &sub; &sup; &sube; &supe;</p>
          <p>Arrows: &larr; &uarr; &rarr; &darr; &harr; &crarr;</p>
          <p>Cards: &spades; &clubs; &hearts; &diams;</p>
          <p>Currency: &euro; &pound; &yen; &cent; &curren;</p>
        </div>
      `;

      // Mock console.warn to suppress the fallback warning
      const originalConsoleWarn = console.warn;
      console.warn = vi.fn();

      // Mock TurndownService to throw an error to force fallback
      const mockTurndownError = new Error('TurndownService failed');
      vi.doMock('turndown', () => ({
        default: class MockTurndownService {
          constructor() {}
          addRule() {}
          turndown() {
            throw mockTurndownError;
          }
        }
      }));

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          'content-type': 'text/html; charset=utf-8',
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
      expect(result.data).toContain('# Mathematical & Scientific Symbols');

      console.warn = originalConsoleWarn;
    });
  });
});