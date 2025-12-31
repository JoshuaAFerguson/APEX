/**
 * WebFetch Cache Usage Examples
 *
 * This file demonstrates how to use the new caching features in WebFetch.
 */

import { webFetch, WebFetchTool, type WebFetchParams } from './webfetch';

// Example 1: Basic usage with default caching (15 minutes)
async function basicCaching() {
  const params: WebFetchParams = {
    url: 'https://api.example.com/data',
    method: 'GET',
  };

  // First request - hits the network
  const result1 = await webFetch(params);
  console.log('First request from network:', result1.fromCache); // false

  // Second identical request - served from cache
  const result2 = await webFetch(params);
  console.log('Second request from cache:', result2.fromCache); // true
  console.log('Cache response time:', result2.metadata?.responseTime); // 0
}

// Example 2: Custom cache TTL
async function customTTL() {
  const params: WebFetchParams = {
    url: 'https://api.example.com/fast-changing-data',
    method: 'GET',
    cacheTtl: 60000, // Cache for only 1 minute
  };

  const result = await webFetch(params);
  console.log('Cached with 1 minute TTL');
}

// Example 3: Bypassing cache
async function bypassCache() {
  const params: WebFetchParams = {
    url: 'https://api.example.com/always-fresh',
    method: 'GET',
    bypassCache: true, // Always fetch fresh data
  };

  const result = await webFetch(params);
  console.log('Always fresh from network:', result.fromCache); // false
}

// Example 4: Cache management with WebFetchTool instance
async function cacheManagement() {
  const tool = new WebFetchTool();

  // Make some cached requests
  await tool.execute({ url: 'https://example1.com' });
  await tool.execute({ url: 'https://example2.com' });

  // Check cache statistics
  const stats = tool.getCacheStats();
  console.log(`Cache contains ${stats.size} entries:`);
  stats.entries.forEach((entry, index) => {
    console.log(`${index + 1}. URL: ${entry.url}, Age: ${Date.now() - entry.createdAt}ms`);
  });

  // Clear specific cache entry
  tool.removeCacheEntry({ url: 'https://example1.com' });

  // Clear entire cache
  tool.clearCache();

  // Force cleanup of expired entries
  tool.forceCleanup();
}

// Example 5: Cache behavior with different parameters
async function cacheKeyBehavior() {
  const tool = new WebFetchTool();

  // These will create different cache entries
  await tool.execute({ url: 'https://api.com/data' }); // GET request
  await tool.execute({ url: 'https://api.com/data', method: 'POST', body: '{}' }); // POST request
  await tool.execute({ url: 'https://api.com/data', headers: { 'Authorization': 'Bearer token' } }); // Different headers

  const stats = tool.getCacheStats();
  console.log(`Created ${stats.size} different cache entries`); // 3 entries
}

// Example 6: Disabling cache completely
async function disableCache() {
  const params: WebFetchParams = {
    url: 'https://api.example.com/no-cache',
    cacheTtl: 0, // Zero TTL = no caching
  };

  const result = await webFetch(params);
  console.log('Never cached due to zero TTL');
}

export {
  basicCaching,
  customTTL,
  bypassCache,
  cacheManagement,
  cacheKeyBehavior,
  disableCache,
};