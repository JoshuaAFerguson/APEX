/**
 * WebFetch AI Analysis Integration Tests
 *
 * End-to-end integration tests for the AI-powered content analysis feature.
 * Tests real-world scenarios and workflow integration.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { WebFetchTool, type WebFetchParams, type WebFetchResult } from './webfetch';

// Mock Anthropic SDK with different response patterns
let mockResponseIndex = 0;
const mockResponses = [
  {
    content: [{ type: 'text', text: 'Extracted pricing: $10/month basic, $25/month pro' }],
    usage: { input_tokens: 150, output_tokens: 20 },
  },
  {
    content: [{ type: 'text', text: 'Summary: This article discusses AI trends including automation and machine learning advances.' }],
    usage: { input_tokens: 200, output_tokens: 30 },
  },
  {
    content: [{ type: 'text', text: 'API Endpoints:\n- GET /users - List users\n- POST /users - Create user\n- DELETE /users/:id - Delete user' }],
    usage: { input_tokens: 300, output_tokens: 40 },
  },
];

const mockAnthropic = {
  messages: {
    create: vi.fn(() => {
      const response = mockResponses[mockResponseIndex % mockResponses.length];
      mockResponseIndex++;
      return Promise.resolve(response);
    }),
  },
};

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(() => mockAnthropic),
}));

// Mock fetch with realistic responses
global.fetch = vi.fn(function() {
  return Promise.resolve(new Response());
});

describe('WebFetch AI Analysis Integration', () => {
  let webFetchTool: WebFetchTool;

  beforeEach(() => {
    webFetchTool = new WebFetchTool();
    webFetchTool.clearCache();
    vi.clearAllMocks();
    mockResponseIndex = 0;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('real-world content analysis workflows', () => {
    it('should analyze pricing page and extract structured data', async () => {
      // Mock a realistic pricing page
      const pricingPageHtml = `
        <html>
        <head><title>Pricing - APEX Service</title></head>
        <body>
          <nav>Skip navigation</nav>
          <header>
            <h1>Choose Your Plan</h1>
          </header>
          <main>
            <div class="pricing-tier">
              <h2>Basic Plan</h2>
              <div class="price">$10/month</div>
              <ul>
                <li>5 Projects</li>
                <li>Basic Support</li>
                <li>1GB Storage</li>
              </ul>
            </div>
            <div class="pricing-tier featured">
              <h2>Pro Plan</h2>
              <div class="price">$25/month</div>
              <ul>
                <li>Unlimited Projects</li>
                <li>Priority Support</li>
                <li>10GB Storage</li>
                <li>Advanced Analytics</li>
              </ul>
            </div>
            <div class="pricing-tier">
              <h2>Enterprise</h2>
              <div class="price">Contact Sales</div>
              <ul>
                <li>Everything in Pro</li>
                <li>Custom Integrations</li>
                <li>Dedicated Support</li>
              </ul>
            </div>
          </main>
          <footer>© 2024 APEX Service</footer>
        </body>
        </html>
      `;

      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([
          ['content-type', 'text/html'],
          ['content-length', pricingPageHtml.length.toString()]
        ]),
        text: () => Promise.resolve(pricingPageHtml),
        url: 'https://example.com/pricing',
        redirected: false,
      });

      const params: WebFetchParams = {
        url: 'https://example.com/pricing',
        prompt: 'Extract all pricing tiers with their prices and features. Format as structured data.',
      };

      const result: WebFetchResult = await webFetchTool.execute(params);

      // Verify fetch success
      expect(result.success).toBe(true);
      expect(result.status).toBe(200);
      expect(result.data).toBeDefined();
      expect(result.data).not.toContain('<nav>'); // Navigation should be removed
      expect(result.data).toContain('Basic Plan');

      // Verify AI analysis
      expect(result.analysis).toBeDefined();
      expect(result.analysis?.content).toContain('pricing');
      expect(result.analysis?.model).toBe('claude-3-5-haiku-latest');
      expect(result.analysis?.usage.inputTokens).toBeGreaterThan(0);
      expect(result.analysis?.usage.outputTokens).toBeGreaterThan(0);

      // Verify the AI was called with processed content
      expect(mockAnthropic.messages.create).toHaveBeenCalledTimes(1);
      const aiCall = mockAnthropic.messages.create.mock.calls[0][0];
      expect(aiCall.messages[0].content).toContain('Basic Plan');
      expect(aiCall.messages[0].content).toContain('Extract all pricing tiers');
      expect(aiCall.messages[0].content).not.toContain('<nav>'); // Should be cleaned
    });

    it('should handle blog article summarization workflow', async () => {
      const blogArticleHtml = `
        <html>
        <head>
          <title>AI Trends 2024: The Future of Automation</title>
          <meta name="description" content="Exploring the latest trends in AI">
        </head>
        <body>
          <article>
            <header>
              <h1>AI Trends 2024: The Future of Automation</h1>
              <time datetime="2024-01-15">January 15, 2024</time>
              <div class="author">By Jane Smith</div>
            </header>
            <div class="content">
              <h2>Introduction</h2>
              <p>Artificial Intelligence continues to reshape industries worldwide. This year brings several key trends that will define the future of automation and machine learning.</p>

              <h2>Key Trends</h2>
              <h3>1. Multimodal AI</h3>
              <p>AI systems that can process text, images, audio, and video simultaneously are becoming more prevalent. This enables more comprehensive understanding and analysis.</p>

              <h3>2. Edge AI Computing</h3>
              <p>Moving AI processing closer to data sources reduces latency and improves privacy. Edge computing is crucial for real-time applications.</p>

              <h3>3. AI Governance</h3>
              <p>As AI becomes more powerful, governance frameworks and ethical considerations are becoming paramount for responsible deployment.</p>

              <h2>Conclusion</h2>
              <p>These trends will shape how businesses leverage AI technology. Organizations must prepare for these changes to remain competitive.</p>
            </div>
          </article>
          <aside class="sidebar">Related articles...</aside>
        </body>
        </html>
      `;

      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([
          ['content-type', 'text/html'],
          ['content-length', blogArticleHtml.length.toString()]
        ]),
        text: () => Promise.resolve(blogArticleHtml),
        url: 'https://blog.example.com/ai-trends-2024',
        redirected: false,
      });

      const params: WebFetchParams = {
        url: 'https://blog.example.com/ai-trends-2024',
        prompt: 'Provide a 3-point summary of the main AI trends discussed in this article',
        maxAnalysisContent: 10000, // Allow larger content for articles
      };

      const result: WebFetchResult = await webFetchTool.execute(params);

      expect(result.success).toBe(true);
      expect(result.analysis).toBeDefined();
      expect(result.analysis?.content).toContain('AI trends');
      expect(result.analysis?.truncated).toBe(false); // Should fit in 10k chars
      expect(result.data).toContain('Multimodal AI');
      expect(result.data).not.toContain('sidebar'); // Sidebar should be removed
    });

    it('should extract API documentation with complex structure', async () => {
      const apiDocsHtml = `
        <html>
        <body>
          <div class="api-docs">
            <h1>API Reference</h1>

            <section id="users">
              <h2>Users</h2>

              <div class="endpoint">
                <h3>List Users</h3>
                <div class="method">GET</div>
                <div class="path">/api/v1/users</div>
                <div class="description">Retrieve a list of all users</div>
                <div class="parameters">
                  <h4>Query Parameters</h4>
                  <ul>
                    <li><code>limit</code> - Maximum number of users to return (default: 20)</li>
                    <li><code>offset</code> - Number of users to skip (default: 0)</li>
                  </ul>
                </div>
              </div>

              <div class="endpoint">
                <h3>Create User</h3>
                <div class="method">POST</div>
                <div class="path">/api/v1/users</div>
                <div class="description">Create a new user account</div>
                <div class="request-body">
                  <h4>Request Body</h4>
                  <pre><code>{
  "name": "string",
  "email": "string",
  "password": "string"
}</code></pre>
                </div>
              </div>

              <div class="endpoint">
                <h3>Delete User</h3>
                <div class="method">DELETE</div>
                <div class="path">/api/v1/users/{id}</div>
                <div class="description">Delete a user account</div>
                <div class="parameters">
                  <h4>Path Parameters</h4>
                  <ul>
                    <li><code>id</code> - User ID (required)</li>
                  </ul>
                </div>
              </div>
            </section>
          </div>
        </body>
        </html>
      `;

      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([
          ['content-type', 'text/html'],
          ['content-length', apiDocsHtml.length.toString()]
        ]),
        text: () => Promise.resolve(apiDocsHtml),
        url: 'https://api.example.com/docs',
        redirected: false,
      });

      const params: WebFetchParams = {
        url: 'https://api.example.com/docs',
        prompt: 'Extract all API endpoints with their HTTP methods, paths, and descriptions. Format as a list.',
      };

      const result: WebFetchResult = await webFetchTool.execute(params);

      expect(result.success).toBe(true);
      expect(result.analysis).toBeDefined();
      expect(result.analysis?.content).toContain('API Endpoints');

      // Verify the markdown conversion preserved code blocks
      expect(result.data).toContain('```');
      expect(result.data).toContain('GET');
      expect(result.data).toContain('/api/v1/users');

      // Check AI was called with structured content
      const aiCall = mockAnthropic.messages.create.mock.calls[0][0];
      expect(aiCall.messages[0].content).toContain('List Users');
      expect(aiCall.messages[0].content).toContain('Create User');
      expect(aiCall.messages[0].content).toContain('Delete User');
    });
  });

  describe('workflow combinations and patterns', () => {
    it('should handle multiple analysis requests on same content with different prompts', async () => {
      const contentHtml = `
        <html>
        <body>
          <h1>Company Profile</h1>
          <div class="contact">
            <h2>Contact Information</h2>
            <p>Email: contact@example.com</p>
            <p>Phone: +1-555-0123</p>
            <p>Address: 123 Main St, City, State 12345</p>
          </div>
          <div class="services">
            <h2>Our Services</h2>
            <ul>
              <li>Web Development</li>
              <li>Mobile Apps</li>
              <li>Consulting</li>
            </ul>
          </div>
          <div class="pricing">
            <h2>Starting Prices</h2>
            <p>Web Development: $5,000</p>
            <p>Mobile Apps: $10,000</p>
            <p>Consulting: $150/hour</p>
          </div>
        </body>
        </html>
      `;

      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'text/html']]),
        text: () => Promise.resolve(contentHtml),
        url: 'https://example.com/company',
        redirected: false,
      });

      // First analysis - extract contact info
      const contactResult = await webFetchTool.execute({
        url: 'https://example.com/company',
        prompt: 'Extract all contact information including email, phone, and address',
      });

      // Second analysis - extract services (different prompt, should not be cached)
      const servicesResult = await webFetchTool.execute({
        url: 'https://example.com/company',
        prompt: 'List all services offered by this company',
      });

      // Third analysis - same as first (should be cached)
      const contactResult2 = await webFetchTool.execute({
        url: 'https://example.com/company',
        prompt: 'Extract all contact information including email, phone, and address',
      });

      expect(contactResult.success).toBe(true);
      expect(servicesResult.success).toBe(true);
      expect(contactResult2.success).toBe(true);

      expect(contactResult.analysis).toBeDefined();
      expect(servicesResult.analysis).toBeDefined();
      expect(contactResult2.analysis).toBeDefined();

      expect(contactResult.fromCache).toBeFalsy();
      expect(servicesResult.fromCache).toBeFalsy(); // Different prompt
      expect(contactResult2.fromCache).toBe(true); // Same prompt, cached

      // Should have called AI twice, not three times
      expect(mockAnthropic.messages.create).toHaveBeenCalledTimes(2);

      // Both results should have same raw data
      expect(contactResult.data).toBe(servicesResult.data);
      expect(contactResult.data).toBe(contactResult2.data);
    });

    it('should handle analysis workflow with content truncation', async () => {
      const largeContentHtml = `
        <html>
        <body>
          <h1>Large Document</h1>
          <div class="summary">
            <h2>Executive Summary</h2>
            <p>This document contains critical information about our new product launch.</p>
          </div>
          <div class="content">
            ${'<p>This is a very long paragraph with detailed information. '.repeat(500)}
          </div>
          <div class="conclusion">
            <h2>Conclusion</h2>
            <p>The key takeaway is that we should proceed with the launch.</p>
          </div>
        </body>
        </html>
      `;

      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'text/html']]),
        text: () => Promise.resolve(largeContentHtml),
        url: 'https://example.com/large-doc',
        redirected: false,
      });

      const params: WebFetchParams = {
        url: 'https://example.com/large-doc',
        prompt: 'Extract the executive summary and conclusion',
        maxAnalysisContent: 2000, // Force truncation
      };

      const result = await webFetchTool.execute(params);

      expect(result.success).toBe(true);
      expect(result.analysis).toBeDefined();
      expect(result.analysis?.truncated).toBe(true);
      expect(result.analysis?.originalContentLength).toBeGreaterThan(2000);
      expect(result.analysis?.analyzedContentLength).toBeLessThanOrEqual(2000);

      // Verify truncation notice was added
      const aiCall = mockAnthropic.messages.create.mock.calls[0][0];
      expect(aiCall.messages[0].content).toContain('[Content truncated');
    });

    it('should handle error recovery workflow', async () => {
      const htmlContent = '<html><body><h1>Test Page</h1><p>Content here</p></body></html>';

      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'text/html']]),
        text: () => Promise.resolve(htmlContent),
        url: 'https://example.com/test',
        redirected: false,
      });

      // First request fails AI analysis
      mockAnthropic.messages.create.mockRejectedValueOnce(new Error('Temporary API error'));

      const params: WebFetchParams = {
        url: 'https://example.com/test',
        prompt: 'Analyze this page',
      };

      const failedResult = await webFetchTool.execute(params);

      // Verify graceful degradation
      expect(failedResult.success).toBe(true);
      expect(failedResult.data).toBeDefined();
      expect(failedResult.analysis).toBeUndefined();
      expect(failedResult.analysisError).toContain('API error');

      // Second request should succeed (no cache due to analysis failure)
      mockAnthropic.messages.create.mockResolvedValue({
        content: [{ type: 'text', text: 'Successful analysis' }],
        usage: { input_tokens: 100, output_tokens: 20 },
      });

      const successResult = await webFetchTool.execute(params);

      expect(successResult.success).toBe(true);
      expect(successResult.analysis).toBeDefined();
      expect(successResult.analysis?.content).toBe('Successful analysis');
      expect(successResult.fromCache).toBeFalsy(); // Not from cache due to previous failure
    });
  });

  describe('performance and scalability scenarios', () => {
    it('should handle concurrent analysis requests efficiently', async () => {
      const baseContent = '<html><body><h1>Page {{index}}</h1><p>Content for page {{index}}</p></body></html>';

      // Mock different responses for each concurrent request
      (global.fetch as any).mockImplementation(async (url: string) => {
        const index = url.match(/page(\d+)/)?.[1] || '1';
        const content = baseContent.replace(/\{\{index\}\}/g, index);

        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: new Map([['content-type', 'text/html']]),
          text: () => Promise.resolve(content),
          url,
          redirected: false,
        };
      });

      const concurrentRequests = Array.from({ length: 5 }, (_, i) => ({
        url: `https://example.com/page${i}`,
        prompt: `Extract the main content from page ${i}`,
      }));

      const startTime = Date.now();
      const results = await Promise.all(
        concurrentRequests.map(params => webFetchTool.execute(params))
      );
      const endTime = Date.now();

      // All requests should succeed
      results.forEach((result, i) => {
        expect(result.success).toBe(true);
        expect(result.analysis).toBeDefined();
        expect(result.data).toContain(`Page ${i}`);
      });

      // Should complete in reasonable time (concurrent execution)
      expect(endTime - startTime).toBeLessThan(5000);

      // Should have made all AI analysis calls
      expect(mockAnthropic.messages.create).toHaveBeenCalledTimes(5);
    });

    it('should maintain cache efficiency across multiple requests', async () => {
      const content = '<html><body><h1>Cached Page</h1><p>This content will be cached</p></body></html>';

      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'text/html']]),
        text: () => Promise.resolve(content),
        url: 'https://example.com/cached',
        redirected: false,
      });

      const baseParams = {
        url: 'https://example.com/cached',
        prompt: 'Extract main heading',
      };

      // Make multiple identical requests
      const results = await Promise.all([
        webFetchTool.execute(baseParams),
        webFetchTool.execute(baseParams),
        webFetchTool.execute(baseParams),
      ]);

      expect(results[0].fromCache).toBeFalsy();
      expect(results[1].fromCache).toBe(true);
      expect(results[2].fromCache).toBe(true);

      // Should only make one AI call due to caching
      expect(mockAnthropic.messages.create).toHaveBeenCalledTimes(1);

      // All results should be identical
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.analysis?.content).toBe('Extracted pricing: $10/month basic, $25/month pro');
      });
    });
  });

  describe('content type and format handling', () => {
    it('should handle analysis request on non-HTML content gracefully', async () => {
      const jsonContent = JSON.stringify({
        name: 'Test API',
        version: '1.0.0',
        endpoints: ['/users', '/posts', '/comments']
      });

      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'application/json']]),
        text: () => Promise.resolve(jsonContent),
        url: 'https://api.example.com/info',
        redirected: false,
      });

      const params: WebFetchParams = {
        url: 'https://api.example.com/info',
        prompt: 'Extract the API endpoints from this JSON response',
        convertToMarkdown: false, // Disable markdown conversion for JSON
      };

      const result = await webFetchTool.execute(params);

      expect(result.success).toBe(true);
      expect(result.analysis).toBeDefined();
      expect(result.data).toBe(jsonContent); // Should be raw JSON
      expect(result.metadata?.contentType).toContain('application/json');

      // AI should still be able to analyze JSON content
      const aiCall = mockAnthropic.messages.create.mock.calls[0][0];
      expect(aiCall.messages[0].content).toContain('endpoints');
    });

    it('should handle empty response with analysis request', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 204, // No Content
        statusText: 'No Content',
        headers: new Map([['content-type', 'text/html']]),
        text: () => Promise.resolve(''),
        url: 'https://example.com/empty',
        redirected: false,
      });

      const params: WebFetchParams = {
        url: 'https://example.com/empty',
        prompt: 'Analyze this content',
      };

      const result = await webFetchTool.execute(params);

      expect(result.success).toBe(true);
      expect(result.data).toBe('');
      expect(result.analysis).toBeUndefined(); // No content to analyze
      expect(mockAnthropic.messages.create).not.toHaveBeenCalled();
    });
  });
});