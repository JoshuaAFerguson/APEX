/**
 * WebFetch AI Analysis - Usage Examples
 *
 * This file demonstrates how to use the new AI-powered content analysis feature
 * in the WebFetch tool. These are practical examples showing different use cases.
 */

import { webFetch, type WebFetchParams, type WebFetchResult } from './webfetch';

/**
 * Example 1: Extract specific information from a pricing page
 */
export async function extractPricingInfo(): Promise<void> {
  const params: WebFetchParams = {
    url: 'https://example.com/pricing',
    prompt: 'Extract all pricing tiers and their features. Format as a structured list.',
  };

  const result: WebFetchResult = await webFetch(params);

  if (result.success && result.analysis) {
    console.log('Pricing Analysis:');
    console.log(result.analysis.content);
    console.log(`Tokens used: ${result.analysis.usage.inputTokens} input, ${result.analysis.usage.outputTokens} output`);

    if (result.analysis.truncated) {
      console.log(`⚠️ Content was truncated: ${result.analysis.analyzedContentLength} of ${result.analysis.originalContentLength} chars analyzed`);
    }
  } else if (result.analysisError) {
    console.log('Analysis failed:', result.analysisError);
    console.log('Raw content still available:', result.data?.substring(0, 200) + '...');
  }
}

/**
 * Example 2: Summarize a blog article
 */
export async function summarizeArticle(): Promise<void> {
  const params: WebFetchParams = {
    url: 'https://blog.example.com/ai-trends-2024',
    prompt: 'Summarize the main points of this article in 3-5 bullet points. Focus on actionable insights.',
    maxAnalysisContent: 50000, // Allow larger content for articles
  };

  const result: WebFetchResult = await webFetch(params);

  if (result.success && result.analysis) {
    console.log('Article Summary:');
    console.log(result.analysis.content);
  }
}

/**
 * Example 3: Extract API endpoints from documentation
 */
export async function extractApiEndpoints(): Promise<void> {
  const params: WebFetchParams = {
    url: 'https://api.example.com/docs',
    prompt: `List all available API endpoints in this format:
- Method: Endpoint - Description
- Example: GET /users - Retrieve all users

Include query parameters and request body requirements where mentioned.`,
  };

  const result: WebFetchResult = await webFetch(params);

  if (result.success && result.analysis) {
    console.log('API Endpoints:');
    console.log(result.analysis.content);
  }
}

/**
 * Example 4: Extract contact information
 */
export async function extractContactInfo(): Promise<void> {
  const params: WebFetchParams = {
    url: 'https://company.com/contact',
    prompt: 'Extract all contact information including: email addresses, phone numbers, physical addresses, and business hours. If any information is missing, state that clearly.',
  };

  const result: WebFetchResult = await webFetch(params);

  if (result.success && result.analysis) {
    console.log('Contact Information:');
    console.log(result.analysis.content);
  }
}

/**
 * Example 5: Compare with and without AI analysis
 */
export async function compareWithAndWithoutAnalysis(): Promise<void> {
  const url = 'https://example.com/complex-page';

  // Without AI analysis - raw content
  const rawResult = await webFetch({ url });

  // With AI analysis - extracted insights
  const analyzedResult = await webFetch({
    url,
    prompt: 'Extract the top 3 most important pieces of information from this page. Ignore navigation, ads, and boilerplate content.',
  });

  console.log('Raw content length:', rawResult.data?.length || 0);
  console.log('Analysis:', analyzedResult.analysis?.content || 'No analysis available');

  // Both results contain the same raw data
  console.log('Raw data identical:', rawResult.data === analyzedResult.data);
}

/**
 * Example 6: Handle large content with truncation
 */
export async function handleLargeContent(): Promise<void> {
  const params: WebFetchParams = {
    url: 'https://example.com/very-long-document',
    prompt: 'Extract the executive summary and key recommendations from this document.',
    maxAnalysisContent: 75000, // Limit analysis to ~18k tokens
  };

  const result: WebFetchResult = await webFetch(params);

  if (result.success && result.analysis) {
    console.log('Document Analysis:');
    console.log(result.analysis.content);

    if (result.analysis.truncated) {
      console.log(`📄 Large document processed: analyzed ${result.analysis.analyzedContentLength.toLocaleString()} of ${result.analysis.originalContentLength.toLocaleString()} characters`);
    }
  }
}

/**
 * Example 7: Error handling best practices
 */
export async function demonstrateErrorHandling(): Promise<void> {
  const params: WebFetchParams = {
    url: 'https://example.com/page',
    prompt: 'Analyze this content',
  };

  try {
    const result: WebFetchResult = await webFetch(params);

    if (result.success) {
      if (result.analysis) {
        // AI analysis succeeded
        console.log('✅ Analysis successful:', result.analysis.content);

        // Check for performance metrics
        const totalTokens = result.analysis.usage.inputTokens + result.analysis.usage.outputTokens;
        console.log(`📊 Performance: ${totalTokens} tokens, ${result.metadata?.responseTime}ms`);

      } else if (result.analysisError) {
        // Fetch succeeded but AI analysis failed - graceful degradation
        console.log('⚠️ Analysis failed, using raw content:', result.analysisError);
        console.log('Raw content available:', !!result.data);

        // You can still work with the raw markdown content
        const firstParagraph = result.data?.split('\n\n')[0];
        console.log('First paragraph:', firstParagraph);

      } else {
        // No prompt provided - normal operation
        console.log('📄 Raw content fetched successfully');
      }
    } else {
      // Fetch itself failed
      console.log('❌ Fetch failed:', result.error);
    }
  } catch (error) {
    // Network or other unexpected errors
    console.log('💥 Unexpected error:', error);
  }
}

/**
 * Example 8: Caching behavior with prompts
 */
export async function demonstrateCaching(): Promise<void> {
  const baseUrl = 'https://example.com/page';

  // These will be cached separately due to different prompts
  const summaryResult = await webFetch({
    url: baseUrl,
    prompt: 'Provide a brief summary',
  });

  const keyPointsResult = await webFetch({
    url: baseUrl,
    prompt: 'Extract key points as bullet list',
  });

  // This will hit the cache for the summary
  const cachedSummaryResult = await webFetch({
    url: baseUrl,
    prompt: 'Provide a brief summary',
  });

  console.log('Summary from cache:', cachedSummaryResult.fromCache); // Should be true
  console.log('Key points fresh:', keyPointsResult.fromCache); // Should be false/undefined
}

// Export all examples for easy testing
export const examples = {
  extractPricingInfo,
  summarizeArticle,
  extractApiEndpoints,
  extractContactInfo,
  compareWithAndWithoutAnalysis,
  handleLargeContent,
  demonstrateErrorHandling,
  demonstrateCaching,
};

/**
 * Usage patterns summary:
 *
 * 1. **Information Extraction**: Use specific prompts to extract structured data
 * 2. **Content Summarization**: Ask for summaries, key points, or executive summaries
 * 3. **Data Mining**: Extract specific types of information (contact details, prices, etc.)
 * 4. **Documentation Processing**: Parse API docs, technical documentation
 * 5. **Content Analysis**: Analyze sentiment, intent, or key themes
 * 6. **Comparison and Filtering**: Ask AI to focus on relevant information only
 *
 * Best practices:
 * - Be specific in your prompts
 * - Handle both analysis success and failure cases
 * - Monitor token usage for cost optimization
 * - Use maxAnalysisContent for very large pages
 * - Remember that raw content is always available as fallback
 */