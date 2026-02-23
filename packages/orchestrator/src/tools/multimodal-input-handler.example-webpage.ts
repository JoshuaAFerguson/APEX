#!/usr/bin/env node
/**
 * Example usage of MultimodalInputHandler web page processing functionality
 *
 * This example demonstrates the various ways to process web pages using the
 * MultimodalInputHandler, including basic fetching, AI analysis, and custom options.
 */

import { MultimodalInputHandler, processWebPage, type WebPageOptions } from './multimodal-input-handler';

// Example URLs (using httpbin.org for testing - it provides reliable test endpoints)
const TEST_URLS = {
  html: 'https://httpbin.org/html', // Returns HTML content
  json: 'https://httpbin.org/json', // Returns JSON data
  status: 'https://httpbin.org/status/200', // Returns specific status code
  userAgent: 'https://httpbin.org/user-agent', // Echoes user agent
};

async function demonstrateBasicUsage() {
  console.log('📄 Basic Web Page Processing\n');

  const handler = new MultimodalInputHandler();

  try {
    // Basic usage - fetch and convert to markdown
    console.log('🔗 Fetching HTML page...');
    const result = await handler.processWebPage(TEST_URLS.html);

    console.log(`✅ Success: ${result.statusCode} ${result.headers['content-type']}`);
    console.log(`📝 Content length: ${result.metadata.contentLength} bytes`);
    console.log(`⏱️  Response time: ${result.metadata.responseTime}ms`);
    console.log(`📋 Title: ${result.title || 'No title found'}`);
    console.log(`💾 From cache: ${result.fromCache}`);

    if (result.markdown) {
      console.log(`📄 Markdown preview (first 200 chars):`);
      console.log(`   ${result.markdown.substring(0, 200)}...`);
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }

  console.log('\n' + '='.repeat(60) + '\n');
}

async function demonstrateCustomOptions() {
  console.log('⚙️  Custom Options Demo\n');

  const handler = new MultimodalInputHandler();

  const options: WebPageOptions = {
    method: 'GET',
    headers: {
      'User-Agent': 'APEX-MultimodalInputHandler/1.0',
      'Accept': 'text/html,application/json',
    },
    timeout: 15000,
    convertToMarkdown: false, // Get raw HTML
    bypassCache: true,
    cacheTtl: 300000, // 5 minutes
  };

  try {
    console.log('🔧 Using custom options...');
    const result = await handler.processWebPage(TEST_URLS.userAgent, options);

    console.log(`✅ Success: ${result.statusCode}`);
    console.log(`🔄 Bypassed cache: ${!result.fromCache}`);

    if (result.html) {
      console.log(`🔤 Raw HTML/JSON preview:`);
      const preview = result.html.substring(0, 300);
      console.log(`   ${preview}...`);
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }

  console.log('\n' + '='.repeat(60) + '\n');
}

async function demonstrateAIAnalysis() {
  console.log('🤖 AI Analysis Demo\n');

  // Note: This requires ANTHROPIC_API_KEY environment variable to be set
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('⚠️  Skipping AI analysis demo - ANTHROPIC_API_KEY not set');
    return;
  }

  const handler = new MultimodalInputHandler();

  const options: WebPageOptions = {
    prompt: 'Extract and summarize the main content of this page. Focus on key information and structure.',
    maxAnalysisContent: 50000,
  };

  try {
    console.log('🧠 Analyzing page with AI...');
    const result = await handler.processWebPage(TEST_URLS.html, options);

    console.log(`✅ Success: ${result.statusCode}`);

    if (result.analysis) {
      console.log(`🤖 AI Analysis Results:`);
      console.log(`   Model: ${result.analysis.model}`);
      console.log(`   Tokens: ${result.analysis.usage.inputTokens} in, ${result.analysis.usage.outputTokens} out`);
      console.log(`   Truncated: ${result.analysis.truncated}`);
      console.log(`   Content length: ${result.analysis.originalContentLength} → ${result.analysis.analyzedContentLength}`);
      console.log(`\n📝 Analysis:`);
      console.log(`   ${result.analysis.content}`);
    }

    if (result.analysisError) {
      console.log(`❌ Analysis error: ${result.analysisError}`);
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }

  console.log('\n' + '='.repeat(60) + '\n');
}

async function demonstrateConvenienceFunction() {
  console.log('🎯 Convenience Function Demo\n');

  try {
    console.log('📞 Using processWebPage convenience function...');

    // Using the convenience function
    const result = await processWebPage(TEST_URLS.json, {
      convertToMarkdown: false,
    });

    console.log(`✅ Success: ${result.statusCode}`);
    console.log(`📊 JSON data preview:`);
    if (result.html) {
      const jsonData = JSON.parse(result.html);
      console.log(`   Keys: ${Object.keys(jsonData).join(', ')}`);
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }

  console.log('\n' + '='.repeat(60) + '\n');
}

async function demonstrateErrorHandling() {
  console.log('⚠️  Error Handling Demo\n');

  const handler = new MultimodalInputHandler();

  const testCases = [
    { url: 'invalid-url', description: 'Invalid URL format' },
    { url: 'ftp://example.com', description: 'Unsupported protocol' },
    { url: 'https://httpbin.org/status/404', description: 'HTTP 404 error' },
    { url: 'https://httpbin.org/status/500', description: 'HTTP 500 error' },
  ];

  for (const testCase of testCases) {
    try {
      console.log(`🔍 Testing: ${testCase.description}`);
      await handler.processWebPage(testCase.url);
      console.log(`   ❌ Unexpected success for ${testCase.url}`);
    } catch (error: any) {
      console.log(`   ✅ Expected error: ${error.code || 'UNKNOWN'} - ${error.message}`);
    }
  }

  console.log('\n' + '='.repeat(60) + '\n');
}

async function main() {
  console.log('🚀 MultimodalInputHandler Web Page Processing Examples\n');
  console.log('='.repeat(60));

  try {
    await demonstrateBasicUsage();
    await demonstrateCustomOptions();
    await demonstrateAIAnalysis();
    await demonstrateConvenienceFunction();
    await demonstrateErrorHandling();

    console.log('🎉 All examples completed successfully!');
    console.log('\n📚 Key Features Demonstrated:');
    console.log('   ✅ Basic web page fetching and markdown conversion');
    console.log('   ✅ Custom HTTP options (headers, timeout, methods)');
    console.log('   ✅ AI-powered content analysis with Claude');
    console.log('   ✅ Caching and performance optimizations');
    console.log('   ✅ Comprehensive error handling');
    console.log('   ✅ Convenience functions for easy integration');
    console.log('   ✅ Type safety and robust validation');

  } catch (error: any) {
    console.error('❌ Example execution failed:', error.message);
    process.exit(1);
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  main();
}

export {
  demonstrateBasicUsage,
  demonstrateCustomOptions,
  demonstrateAIAnalysis,
  demonstrateConvenienceFunction,
  demonstrateErrorHandling,
};