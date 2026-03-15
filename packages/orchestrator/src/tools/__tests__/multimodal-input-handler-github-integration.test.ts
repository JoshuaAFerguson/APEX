import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest';
import {
  MultimodalInputHandler,
  MultimodalInputError,
  type GitHubIssueImageResult,
  type MultimodalInputHandlerConfig,
} from '../multimodal-input-handler';
import { WebFetchTool, type WebFetchResult } from '../webfetch';

// Mock WebFetchTool
vi.mock('../webfetch', () => ({
  WebFetchTool: vi.fn(() => ({
    execute: vi.fn(),
  })),
}));

const MockWebFetchTool = WebFetchTool as unknown as vi.MockedClass<typeof WebFetchTool>;

describe('MultimodalInputHandler - GitHub Integration Tests', () => {
  let handler: MultimodalInputHandler;
  let mockWebFetchTool: { execute: MockedFunction<any> };

  beforeEach(() => {
    handler = new MultimodalInputHandler();
    mockWebFetchTool = {
      execute: vi.fn(),
    };
    MockWebFetchTool.mockImplementation(() => mockWebFetchTool as any);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Real-world GitHub Issue Scenarios', () => {
    it('should handle typical bug report with multiple screenshots', async () => {
      const realIssueContent = `
# Bug Report: Authentication Flow Broken

## Description
The login process is failing after the recent update. Users cannot authenticate properly.

## Steps to Reproduce
1. Navigate to login page
2. Enter valid credentials
3. Click "Sign In"

## Screenshots

Here's the initial error:
![Login Error](https://user-images.githubusercontent.com/12345/login-error.png)

And here's the console output:
![Console Output](https://user-images.githubusercontent.com/12345/console-log.jpg)

## Browser Information
- Chrome 120.0.0
- Firefox 119.0.1

## Additional Context
<img src="https://user-images.githubusercontent.com/12345/network-tab.png" alt="Network Tab" width="800" />

The network tab shows a 500 error from the auth endpoint.

Related logs: https://raw.githubusercontent.com/company/app/main/logs/auth-error.png
      `;

      // Mock successful downloads for all images
      const mockPngData = Buffer.from('png-image-data');
      const mockJpgData = Buffer.from('jpg-image-data');

      mockWebFetchTool.execute
        .mockResolvedValueOnce({
          success: true,
          status: 200,
          headers: { 'content-type': 'image/png' },
          data: mockPngData.toString('base64'),
          metadata: { url: 'login-error-url', method: 'GET', responseTime: 180 },
        })
        .mockResolvedValueOnce({
          success: true,
          status: 200,
          headers: { 'content-type': 'image/jpeg' },
          data: mockJpgData.toString('base64'),
          metadata: { url: 'console-log-url', method: 'GET', responseTime: 220 },
        })
        .mockResolvedValueOnce({
          success: true,
          status: 200,
          headers: { 'content-type': 'image/png' },
          data: mockPngData.toString('base64'),
          metadata: { url: 'network-tab-url', method: 'GET', responseTime: 160 },
        })
        .mockResolvedValueOnce({
          success: true,
          status: 200,
          headers: { 'content-type': 'image/png' },
          data: mockPngData.toString('base64'),
          metadata: { url: 'auth-error-log-url', method: 'GET', responseTime: 190 },
        });

      const result = await handler.processGitHubIssueImages(realIssueContent);

      expect(result.issueContent).toBe(realIssueContent);
      expect(result.imageUrls).toHaveLength(4);
      expect(result.imageUrls).toContain('https://user-images.githubusercontent.com/12345/login-error.png');
      expect(result.imageUrls).toContain('https://user-images.githubusercontent.com/12345/console-log.jpg');
      expect(result.imageUrls).toContain('https://user-images.githubusercontent.com/12345/network-tab.png');
      expect(result.imageUrls).toContain('https://raw.githubusercontent.com/company/app/main/logs/auth-error.png');

      expect(result.imageBlocks).toHaveLength(4);
      expect(result.imageMetadata).toHaveLength(4);

      // Verify media types
      const loginErrorIndex = result.imageUrls.findIndex(url => url.includes('login-error.png'));
      const consoleLogIndex = result.imageUrls.findIndex(url => url.includes('console-log.jpg'));

      expect(result.imageBlocks[loginErrorIndex].source.media_type).toBe('image/png');
      expect(result.imageBlocks[consoleLogIndex].source.media_type).toBe('image/jpeg');

      expect(result.errors).toBeUndefined();
      expect(result.totalProcessingTime).toBeGreaterThan(0);
    });

    it('should handle pull request with mixed content and code blocks', async () => {
      const prContent = `
## Pull Request: Add Dark Mode Support

### Changes Made
- Updated CSS variables for theme switching
- Added toggle component in header

### Before & After Screenshots

Before:
![Before Dark Mode](https://user-images.githubusercontent.com/54321/before-light.png)

After:
![After Dark Mode](https://user-images.githubusercontent.com/54321/after-dark.png)

### Code Changes
\`\`\`css
:root {
  --bg-color: #ffffff;
  --text-color: #000000;
}

[data-theme="dark"] {
  --bg-color: #1a1a1a;
  --text-color: #ffffff;
}
\`\`\`

### Component Demo
<img src="https://user-images.githubusercontent.com/54321/toggle-component.gif" alt="Toggle Animation" />

### Test Results
All tests passing: https://raw.githubusercontent.com/team/frontend/feature/dark-mode/test-results.png

Not an image: https://raw.githubusercontent.com/team/frontend/feature/dark-mode/README.md

### Reviewers
@alice @bob - please check the dark mode implementation!
      `;

      const mockImageData = Buffer.from('test-image-data');
      mockWebFetchTool.execute.mockResolvedValue({
        success: true,
        status: 200,
        headers: {},
        data: mockImageData.toString('base64'),
        metadata: { url: 'test-url', method: 'GET', responseTime: 150 },
      });

      const result = await handler.processGitHubIssueImages(prContent);

      // Should extract 4 images (before, after, toggle gif, test results) but NOT the README.md
      expect(result.imageUrls).toHaveLength(4);
      expect(result.imageUrls).toContain('https://user-images.githubusercontent.com/54321/before-light.png');
      expect(result.imageUrls).toContain('https://user-images.githubusercontent.com/54321/after-dark.png');
      expect(result.imageUrls).toContain('https://user-images.githubusercontent.com/54321/toggle-component.gif');
      expect(result.imageUrls).toContain('https://raw.githubusercontent.com/team/frontend/feature/dark-mode/test-results.png');

      // Should NOT include README.md
      expect(result.imageUrls).not.toContain('https://raw.githubusercontent.com/team/frontend/feature/dark-mode/README.md');

      expect(result.imageBlocks).toHaveLength(4);
      expect(mockWebFetchTool.execute).toHaveBeenCalledTimes(4);
    });

    it('should handle issue with partial failures and continue processing', async () => {
      const issueWithMixedResults = `
## Performance Issue Report

### Test Results

Working test: ![Working Test](https://user-images.githubusercontent.com/99999/working-test.png)

Broken link: ![Broken Test](https://user-images.githubusercontent.com/99999/broken-test.png)

Another working test: ![Second Test](https://user-images.githubusercontent.com/99999/second-test.jpg)

Timeout image: ![Timeout Test](https://user-images.githubusercontent.com/99999/timeout-test.png)

Final working image: ![Final Test](https://user-images.githubusercontent.com/99999/final-test.webp)
      `;

      const mockImageData = Buffer.from('test-data');

      mockWebFetchTool.execute
        // First image: success
        .mockResolvedValueOnce({
          success: true,
          status: 200,
          headers: {},
          data: mockImageData.toString('base64'),
          metadata: { url: 'working-url', method: 'GET', responseTime: 100 },
        })
        // Second image: failure (404)
        .mockResolvedValueOnce({
          success: false,
          error: 'Image not found (404)',
        })
        // Third image: success
        .mockResolvedValueOnce({
          success: true,
          status: 200,
          headers: {},
          data: mockImageData.toString('base64'),
          metadata: { url: 'second-test-url', method: 'GET', responseTime: 120 },
        })
        // Fourth image: network error
        .mockRejectedValueOnce(new Error('Network timeout'))
        // Fifth image: success
        .mockResolvedValueOnce({
          success: true,
          status: 200,
          headers: {},
          data: mockImageData.toString('base64'),
          metadata: { url: 'final-test-url', method: 'GET', responseTime: 110 },
        });

      const result = await handler.processGitHubIssueImages(issueWithMixedResults);

      expect(result.imageUrls).toHaveLength(5); // All URLs extracted
      expect(result.imageBlocks).toHaveLength(3); // Only 3 successful downloads
      expect(result.imageMetadata).toHaveLength(3);
      expect(result.errors).toHaveLength(2); // 2 failures

      // Verify error messages
      expect(result.errors![0]).toContain('broken-test.png');
      expect(result.errors![0]).toContain('Image not found (404)');
      expect(result.errors![1]).toContain('timeout-test.png');
      expect(result.errors![1]).toContain('Network timeout');

      // Verify successful images have correct media types
      const workingIndex = result.imageUrls.findIndex(url => url.includes('working-test.png'));
      const secondIndex = result.imageUrls.findIndex(url => url.includes('second-test.jpg'));
      const finalIndex = result.imageUrls.findIndex(url => url.includes('final-test.webp'));

      // Note: We need to find indices in the successful results array
      const successfulUrls = result.imageUrls.filter((url, idx) =>
        !result.errors?.some(error => error.includes(url.split('/').pop() || ''))
      );

      expect(successfulUrls).toHaveLength(3);
    });

    it('should handle large GitHub issue with many images efficiently', async () => {
      // Create content with many images
      const imageCount = 20;
      let issueContent = '# Large Issue Report\n\n';

      for (let i = 1; i <= imageCount; i++) {
        issueContent += `Image ${i}: ![Image ${i}](https://user-images.githubusercontent.com/12345/image${i}.png)\n\n`;
      }

      const mockImageData = Buffer.from('test-image-data');

      // Mock all responses as successful
      for (let i = 0; i < imageCount; i++) {
        mockWebFetchTool.execute.mockResolvedValueOnce({
          success: true,
          status: 200,
          headers: {},
          data: mockImageData.toString('base64'),
          metadata: { url: `image${i + 1}-url`, method: 'GET', responseTime: 100 + i },
        });
      }

      const startTime = Date.now();
      const result = await handler.processGitHubIssueImages(issueContent);
      const endTime = Date.now();

      expect(result.imageUrls).toHaveLength(imageCount);
      expect(result.imageBlocks).toHaveLength(imageCount);
      expect(result.imageMetadata).toHaveLength(imageCount);
      expect(result.errors).toBeUndefined();

      // Verify all images were processed
      for (let i = 1; i <= imageCount; i++) {
        expect(result.imageUrls).toContain(`https://user-images.githubusercontent.com/12345/image${i}.png`);
      }

      // Performance check - should complete in reasonable time
      const totalTime = endTime - startTime;
      expect(totalTime).toBeLessThan(10000); // Less than 10 seconds for 20 images

      expect(result.totalProcessingTime).toBeGreaterThan(0);
      expect(result.totalProcessingTime).toBeLessThanOrEqual(totalTime + 10);
    });

    it('should handle issue comments format correctly', async () => {
      const commentContent = `
Thanks for reporting this! I can reproduce the issue.

Here's what I see on my end:
![My reproduction](https://user-images.githubusercontent.com/88888/my-repro.png)

Compared to the expected behavior:
<img src="https://user-images.githubusercontent.com/88888/expected-behavior.jpg" width="600" />

I think the problem is in the authentication middleware. Let me check the logs:
https://raw.githubusercontent.com/company/backend/main/debug-logs.png

Will fix this in the next update!
      `;

      const mockImageData = Buffer.from('comment-image-data');
      mockWebFetchTool.execute.mockResolvedValue({
        success: true,
        status: 200,
        headers: {},
        data: mockImageData.toString('base64'),
        metadata: { url: 'comment-url', method: 'GET', responseTime: 130 },
      });

      const result = await handler.processGitHubIssueImages(commentContent);

      expect(result.imageUrls).toHaveLength(3);
      expect(result.imageUrls).toContain('https://user-images.githubusercontent.com/88888/my-repro.png');
      expect(result.imageUrls).toContain('https://user-images.githubusercontent.com/88888/expected-behavior.jpg');
      expect(result.imageUrls).toContain('https://raw.githubusercontent.com/company/backend/main/debug-logs.png');

      expect(result.imageBlocks).toHaveLength(3);
      expect(result.errors).toBeUndefined();
    });
  });

  describe('Edge Cases and Complex Scenarios', () => {
    it('should handle malformed markdown with images', async () => {
      const malformedContent = `
# Issue with Broken Markdown

This has broken markdown but valid images:

![Broken markdown](https://user-images.githubusercontent.com/12345/image1.png
![Missing closing bracket](https://user-images.githubusercontent.com/12345/image2.jpg)
![Valid markdown](https://user-images.githubusercontent.com/12345/image3.png)

<img src="https://user-images.githubusercontent.com/12345/html-image.gif" alt="Missing quote>

And a direct URL that works: https://user-images.githubusercontent.com/12345/direct.webp
      `;

      const mockImageData = Buffer.from('test-data');
      mockWebFetchTool.execute.mockResolvedValue({
        success: true,
        status: 200,
        headers: {},
        data: mockImageData.toString('base64'),
        metadata: { url: 'test-url', method: 'GET', responseTime: 100 },
      });

      const result = await handler.processGitHubIssueImages(malformedContent);

      // Should still extract valid URLs despite markdown formatting issues
      expect(result.imageUrls.length).toBeGreaterThan(0);

      // The regex should handle these cases reasonably
      const extractedUrls = result.imageUrls;

      // Direct URL should always work
      expect(extractedUrls).toContain('https://user-images.githubusercontent.com/12345/direct.webp');

      // Should handle some of the other cases too
      expect(extractedUrls.some(url => url.includes('image'))).toBe(true);
    });

    it('should handle images with query parameters and anchors', async () => {
      const contentWithParams = `
Images with parameters:
![Image with params](https://user-images.githubusercontent.com/12345/image.png?raw=true)
![Image with anchor](https://user-images.githubusercontent.com/12345/diagram.jpg#section1)
![Complex URL](https://raw.githubusercontent.com/org/repo/main/assets/chart.png?token=ABC123&version=v1.0)
      `;

      const mockImageData = Buffer.from('test-data');
      mockWebFetchTool.execute.mockResolvedValue({
        success: true,
        status: 200,
        headers: {},
        data: mockImageData.toString('base64'),
        metadata: { url: 'test-url', method: 'GET', responseTime: 100 },
      });

      const result = await handler.processGitHubIssueImages(contentWithParams);

      expect(result.imageUrls).toHaveLength(3);
      expect(result.imageUrls).toContain('https://user-images.githubusercontent.com/12345/image.png?raw=true');
      expect(result.imageUrls).toContain('https://user-images.githubusercontent.com/12345/diagram.jpg#section1');
      expect(result.imageUrls).toContain('https://raw.githubusercontent.com/org/repo/main/assets/chart.png?token=ABC123&version=v1.0');
    });

    it('should handle mixed success/failure with file size validation', async () => {
      const issueContent = `
![Small Image](https://user-images.githubusercontent.com/12345/small.png)
![Large Image](https://user-images.githubusercontent.com/12345/large.jpg)
![Normal Image](https://user-images.githubusercontent.com/12345/normal.gif)
      `;

      const smallImageData = Buffer.from('small-data'); // Small image
      const largeImageData = Buffer.alloc(25 * 1024 * 1024); // 25MB - exceeds 20MB limit
      const normalImageData = Buffer.from('normal-size-data'); // Normal image

      mockWebFetchTool.execute
        .mockResolvedValueOnce({
          success: true,
          status: 200,
          headers: {},
          data: smallImageData.toString('base64'),
          metadata: { url: 'small-url', method: 'GET', responseTime: 100 },
        })
        .mockResolvedValueOnce({
          success: true,
          status: 200,
          headers: {},
          data: largeImageData.toString('base64'),
          metadata: { url: 'large-url', method: 'GET', responseTime: 2000 },
        })
        .mockResolvedValueOnce({
          success: true,
          status: 200,
          headers: {},
          data: normalImageData.toString('base64'),
          metadata: { url: 'normal-url', method: 'GET', responseTime: 150 },
        });

      const result = await handler.processGitHubIssueImages(issueContent);

      expect(result.imageUrls).toHaveLength(3);
      expect(result.imageBlocks).toHaveLength(2); // Small and normal images only
      expect(result.imageMetadata).toHaveLength(2);
      expect(result.errors).toHaveLength(1);
      expect(result.errors![0]).toContain('large.jpg');
      expect(result.errors![0]).toContain('exceeds maximum allowed size');
    });

    it('should handle custom configuration with restrictive settings', async () => {
      const restrictiveHandler = new MultimodalInputHandler({
        maxFileSizeBytes: 1024, // 1KB limit
        supportedFormats: ['png'], // Only PNG
      });

      const issueContent = `
![PNG Image](https://user-images.githubusercontent.com/12345/small.png)
![JPG Image](https://user-images.githubusercontent.com/12345/photo.jpg)
![Large PNG](https://user-images.githubusercontent.com/12345/large.png)
      `;

      const smallPngData = Buffer.alloc(512); // 512 bytes - within limit
      const largePngData = Buffer.alloc(2048); // 2KB - exceeds limit

      mockWebFetchTool.execute
        .mockResolvedValueOnce({
          success: true,
          status: 200,
          headers: {},
          data: smallPngData.toString('base64'),
          metadata: { url: 'small-png-url', method: 'GET', responseTime: 100 },
        })
        .mockResolvedValueOnce({
          success: true,
          status: 200,
          headers: {},
          data: largePngData.toString('base64'),
          metadata: { url: 'large-png-url', method: 'GET', responseTime: 150 },
        });

      const result = await restrictiveHandler.processGitHubIssueImages(issueContent);

      // Should only extract PNG files (JPG filtered out)
      expect(result.imageUrls).toHaveLength(2); // Only 2 PNGs
      expect(result.imageUrls).toContain('https://user-images.githubusercontent.com/12345/small.png');
      expect(result.imageUrls).toContain('https://user-images.githubusercontent.com/12345/large.png');
      expect(result.imageUrls).not.toContain('https://user-images.githubusercontent.com/12345/photo.jpg');

      // Should only successfully process small PNG (large one fails size check)
      expect(result.imageBlocks).toHaveLength(1);
      expect(result.imageMetadata).toHaveLength(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors![0]).toContain('large.png');
      expect(result.errors![0]).toContain('exceeds maximum allowed size');
    });
  });

  describe('Performance and Resource Management', () => {
    it('should handle concurrent image downloads efficiently', async () => {
      const issueContent = `
Multiple images for concurrent download:
![Image 1](https://user-images.githubusercontent.com/12345/concurrent1.png)
![Image 2](https://user-images.githubusercontent.com/12345/concurrent2.jpg)
![Image 3](https://user-images.githubusercontent.com/12345/concurrent3.gif)
![Image 4](https://user-images.githubusercontent.com/12345/concurrent4.webp)
![Image 5](https://user-images.githubusercontent.com/12345/concurrent5.png)
      `;

      const mockImageData = Buffer.from('concurrent-test-data');
      const downloadDelay = 100; // 100ms per download

      // Mock downloads with delay to simulate network latency
      const createDelayedResponse = (index: number) =>
        new Promise(resolve => setTimeout(() => resolve({
          success: true,
          status: 200,
          headers: {},
          data: mockImageData.toString('base64'),
          metadata: { url: `concurrent${index}-url`, method: 'GET', responseTime: downloadDelay },
        }), downloadDelay));

      mockWebFetchTool.execute
        .mockImplementation(() => createDelayedResponse(1))
        .mockImplementation(() => createDelayedResponse(2))
        .mockImplementation(() => createDelayedResponse(3))
        .mockImplementation(() => createDelayedResponse(4))
        .mockImplementation(() => createDelayedResponse(5));

      const startTime = Date.now();
      const result = await handler.processGitHubIssueImages(issueContent);
      const endTime = Date.now();

      const totalTime = endTime - startTime;

      expect(result.imageUrls).toHaveLength(5);
      expect(result.imageBlocks).toHaveLength(5);
      expect(result.imageMetadata).toHaveLength(5);

      // Verify all downloads completed
      expect(mockWebFetchTool.execute).toHaveBeenCalledTimes(5);

      // Should process sequentially but still be reasonably fast
      expect(totalTime).toBeLessThan(1000); // Less than 1 second
      expect(result.totalProcessingTime).toBeGreaterThan(0);
    });

    it('should provide detailed metadata for each processed image', async () => {
      const issueContent = `
![PNG Image](https://user-images.githubusercontent.com/12345/test.png)
![JPEG Image](https://user-images.githubusercontent.com/12345/test.jpg)
      `;

      const pngData = Buffer.from('png-specific-data');
      const jpegData = Buffer.from('jpeg-specific-data');

      mockWebFetchTool.execute
        .mockResolvedValueOnce({
          success: true,
          status: 200,
          headers: { 'content-type': 'image/png', 'content-length': '1024' },
          data: pngData.toString('base64'),
          metadata: { url: 'png-url', method: 'GET', responseTime: 180 },
        })
        .mockResolvedValueOnce({
          success: true,
          status: 200,
          headers: { 'content-type': 'image/jpeg', 'content-length': '2048' },
          data: jpegData.toString('base64'),
          metadata: { url: 'jpeg-url', method: 'GET', responseTime: 220 },
        });

      const result = await handler.processGitHubIssueImages(issueContent);

      expect(result.imageMetadata).toHaveLength(2);

      // Verify PNG metadata
      const pngMetadata = result.imageMetadata.find(m => m.url.includes('test.png'));
      expect(pngMetadata).toBeDefined();
      expect(pngMetadata!.fileSizeBytes).toBe(pngData.length);
      expect(pngMetadata!.mediaType).toBe('image/png');
      expect(pngMetadata!.downloadTime).toBeGreaterThan(0);

      // Verify JPEG metadata
      const jpegMetadata = result.imageMetadata.find(m => m.url.includes('test.jpg'));
      expect(jpegMetadata).toBeDefined();
      expect(jpegMetadata!.fileSizeBytes).toBe(jpegData.length);
      expect(jpegMetadata!.mediaType).toBe('image/jpeg');
      expect(jpegMetadata!.downloadTime).toBeGreaterThan(0);
    });
  });

  describe('Integration with Existing MultimodalInputHandler Features', () => {
    it('should work seamlessly with other handler methods', async () => {
      const issueContent = '![GitHub Image](https://user-images.githubusercontent.com/12345/integration-test.png)';

      const mockImageData = Buffer.from('integration-test-data');
      mockWebFetchTool.execute.mockResolvedValue({
        success: true,
        status: 200,
        headers: {},
        data: mockImageData.toString('base64'),
        metadata: { url: 'integration-url', method: 'GET', responseTime: 100 },
      });

      // Test GitHub image processing
      const githubResult = await handler.processGitHubIssueImages(issueContent);

      expect(githubResult.imageBlocks).toHaveLength(1);
      expect(githubResult.imageBlocks[0].type).toBe('image');
      expect(githubResult.imageBlocks[0].source.type).toBe('base64');

      // Verify the image block structure matches what processImageFile would produce
      const imageBlock = githubResult.imageBlocks[0];
      expect(imageBlock).toMatchObject({
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/png',
          data: expect.any(String),
        },
      });

      // Verify helper methods work correctly
      expect(handler.isSupportedFormat('/path/to/test.png')).toBe(true);
      expect(handler.getSupportedMediaTypes()).toContain('image/png');

      const config = handler.getConfig();
      expect(config.maxFileSizeBytes).toBe(20 * 1024 * 1024);
      expect(config.supportedFormats).toContain('png');
    });

    it('should maintain consistency with base64 encoding across methods', async () => {
      const testData = Buffer.from('consistent-test-data');
      const expectedBase64 = testData.toString('base64');

      const issueContent = '![Test](https://user-images.githubusercontent.com/12345/consistency.png)';

      mockWebFetchTool.execute.mockResolvedValue({
        success: true,
        status: 200,
        headers: {},
        data: expectedBase64,
        metadata: { url: 'consistency-url', method: 'GET', responseTime: 100 },
      });

      const result = await handler.processGitHubIssueImages(issueContent);

      expect(result.imageBlocks).toHaveLength(1);
      expect(result.imageBlocks[0].source.data).toBe(expectedBase64);
    });
  });
});