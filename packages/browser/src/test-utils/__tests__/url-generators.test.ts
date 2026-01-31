/**
 * @apexcli/browser - URL Generators Test Suite
 *
 * Comprehensive tests for URL generation utilities
 */

import { describe, it, expect } from 'vitest';
import {
  generateTestUrl,
  generateTestUrls,
  createUrlPattern,
  testUrls,
  urlValidators,
  urlUtils,
  urlScenarios,
  type TestUrlOptions
} from '../url-generators.js';

describe('URL Generators', () => {
  describe('generateTestUrl', () => {
    it('should generate a basic URL with default values', () => {
      const url = generateTestUrl();

      expect(url).toBe('https://example.com');
    });

    it('should handle custom protocol', () => {
      const url = generateTestUrl({ protocol: 'http' });

      expect(url).toBe('http://example.com');
    });

    it('should handle custom host', () => {
      const url = generateTestUrl({ host: 'test.org' });

      expect(url).toBe('https://test.org');
    });

    it('should handle custom port', () => {
      const url = generateTestUrl({ port: 8080 });

      expect(url).toBe('https://example.com:8080');
    });

    it('should handle custom path', () => {
      const url = generateTestUrl({ path: '/api/users' });

      expect(url).toBe('https://example.com/api/users');
    });

    it('should automatically add leading slash to path if missing', () => {
      const url = generateTestUrl({ path: 'api/users' });

      expect(url).toBe('https://example.com/api/users');
    });

    it('should handle query parameters', () => {
      const url = generateTestUrl({
        query: {
          search: 'test',
          page: 1,
          active: true
        }
      });

      expect(url).toBe('https://example.com?search=test&page=1&active=true');
    });

    it('should handle query parameter encoding', () => {
      const url = generateTestUrl({
        query: {
          'special chars': 'hello world & more!',
          encoded: 'test@example.com'
        }
      });

      expect(url).toContain('special%20chars=hello%20world%20%26%20more%21');
      expect(url).toContain('encoded=test%40example.com');
    });

    it('should skip undefined and null query parameters', () => {
      const url = generateTestUrl({
        query: {
          valid: 'value',
          undefined: undefined,
          null: null,
          empty: ''
        } as any
      });

      expect(url).toContain('valid=value');
      expect(url).toContain('empty=');
      expect(url).not.toContain('undefined');
      expect(url).not.toContain('null');
    });

    it('should handle fragment', () => {
      const url = generateTestUrl({ fragment: 'section1' });

      expect(url).toBe('https://example.com#section1');
    });

    it('should handle all parameters together', () => {
      const url = generateTestUrl({
        protocol: 'http',
        host: 'api.test.com',
        port: 3000,
        path: '/v1/users',
        query: { limit: 10, sort: 'name' },
        fragment: 'top'
      });

      expect(url).toBe('http://api.test.com:3000/v1/users?limit=10&sort=name#top');
    });

    it('should handle special protocols like file and about', () => {
      const fileUrl = generateTestUrl({
        protocol: 'file',
        path: '/path/to/file.html'
      });

      const aboutUrl = generateTestUrl({
        protocol: 'about',
        path: 'blank'
      });

      expect(fileUrl).toBe('file:///path/to/file.html');
      expect(aboutUrl).toBe('about:blank');
    });

    it('should handle data protocol', () => {
      const dataUrl = generateTestUrl({
        protocol: 'data',
        path: 'text/html,<h1>Hello</h1>'
      });

      expect(dataUrl).toBe('data:text/html,<h1>Hello</h1>');
    });
  });

  describe('generateTestUrls', () => {
    it('should generate multiple URLs with default settings', () => {
      const urls = generateTestUrls(3);

      expect(urls).toHaveLength(3);
      expect(urls[0]).toBe('https://example.com/page-0?id=0');
      expect(urls[1]).toBe('https://example.com/page-1?id=1');
      expect(urls[2]).toBe('https://example.com/page-2?id=2');
    });

    it('should use custom base options', () => {
      const urls = generateTestUrls(2, {
        host: 'api.test.com',
        path: '/users',
        query: { format: 'json' }
      });

      expect(urls[0]).toBe('https://api.test.com/users/page-0?format=json&id=0');
      expect(urls[1]).toBe('https://api.test.com/users/page-1?format=json&id=1');
    });

    it('should handle zero count', () => {
      const urls = generateTestUrls(0);

      expect(urls).toHaveLength(0);
    });

    it('should handle large count', () => {
      const urls = generateTestUrls(100);

      expect(urls).toHaveLength(100);
      expect(urls[50]).toContain('/page-50');
      expect(urls[99]).toContain('id=99');
    });
  });

  describe('createUrlPattern', () => {
    it('should replace colon-style parameters', () => {
      const url = createUrlPattern('/users/:id/posts/:postId', {
        id: '123',
        postId: '456'
      });

      expect(url).toBe('/users/123/posts/456');
    });

    it('should replace brace-style parameters', () => {
      const url = createUrlPattern('/users/{id}/posts/{postId}', {
        id: '123',
        postId: '456'
      });

      expect(url).toBe('/users/123/posts/456');
    });

    it('should handle mixed parameter styles', () => {
      const url = createUrlPattern('/users/:id/posts/{postId}', {
        id: '123',
        postId: '456'
      });

      expect(url).toBe('/users/123/posts/456');
    });

    it('should handle missing parameters', () => {
      const url = createUrlPattern('/users/:id/posts/:postId', {
        id: '123'
        // postId missing
      });

      expect(url).toBe('/users/123/posts/:postId');
    });

    it('should handle empty parameters object', () => {
      const url = createUrlPattern('/users/:id/posts/:postId', {});

      expect(url).toBe('/users/:id/posts/:postId');
    });

    it('should handle full URLs with parameters', () => {
      const url = createUrlPattern('https://api.example.com/users/:id', {
        id: '123'
      });

      expect(url).toBe('https://api.example.com/users/123');
    });

    it('should handle parameter values with special characters', () => {
      const url = createUrlPattern('/search/:query', {
        query: 'hello world'
      });

      expect(url).toBe('/search/hello world');
    });
  });

  describe('testUrls', () => {
    describe('valid URLs', () => {
      it('should provide a collection of valid URLs', () => {
        expect(testUrls.valid).toBeInstanceOf(Array);
        expect(testUrls.valid.length).toBeGreaterThan(0);

        testUrls.valid.forEach(url => {
          expect(() => new URL(url)).not.toThrow();
        });
      });

      it('should include various URL types', () => {
        expect(testUrls.valid).toContain('https://example.com');
        expect(testUrls.valid.some(url => url.includes('localhost'))).toBe(true);
        expect(testUrls.valid.some(url => url.includes('?'))).toBe(true); // Query params
        expect(testUrls.valid.some(url => url.includes('#'))).toBe(true); // Fragment
      });
    });

    describe('invalid URLs', () => {
      it('should provide a collection of invalid URLs', () => {
        expect(testUrls.invalid).toBeInstanceOf(Array);
        expect(testUrls.invalid.length).toBeGreaterThan(0);

        testUrls.invalid.forEach(url => {
          expect(() => new URL(url)).toThrow();
        });
      });
    });

    describe('protocol URLs', () => {
      it('should provide URLs with different protocols', () => {
        expect(testUrls.protocols).toBeInstanceOf(Array);
        expect(testUrls.protocols.some(url => url.startsWith('https:'))).toBe(true);
        expect(testUrls.protocols.some(url => url.startsWith('http:'))).toBe(true);
        expect(testUrls.protocols.some(url => url.startsWith('file:'))).toBe(true);
        expect(testUrls.protocols.some(url => url.startsWith('about:'))).toBe(true);
        expect(testUrls.protocols.some(url => url.startsWith('data:'))).toBe(true);
      });
    });

    describe('special URLs', () => {
      it('should provide URLs with special cases', () => {
        expect(testUrls.special).toBeInstanceOf(Array);
        expect(testUrls.special.some(url => url.includes('%20'))).toBe(true); // Encoded spaces
        expect(testUrls.special.some(url => url.includes('192.168'))).toBe(true); // IP address
        expect(testUrls.special.some(url => url.includes('[::1]'))).toBe(true); // IPv6
      });
    });

    describe('utility functions', () => {
      it('should generate localhost URLs', () => {
        expect(testUrls.localhost()).toBe('http://localhost:3000');
        expect(testUrls.localhost(8080)).toBe('http://localhost:8080');
      });

      it('should generate data URIs', () => {
        const dataUri = testUrls.dataUri('<h1>Test</h1>');
        expect(dataUri).toContain('data:text/html,');
        expect(dataUri).toContain('%3Ch1%3ETest%3C%2Fh1%3E');

        const customDataUri = testUrls.dataUri('{"test": true}', 'application/json');
        expect(customDataUri).toContain('data:application/json,');
      });

      it('should generate file URIs', () => {
        expect(testUrls.fileUri('/path/to/file.html')).toBe('file:///path/to/file.html');
        expect(testUrls.fileUri('relative/path.html')).toBe('file:///relative/path.html');
      });
    });
  });

  describe('urlValidators', () => {
    describe('isValidUrl', () => {
      it('should validate correct URLs', () => {
        expect(urlValidators.isValidUrl('https://example.com')).toBe(true);
        expect(urlValidators.isValidUrl('http://localhost:3000')).toBe(true);
        expect(urlValidators.isValidUrl('ftp://files.example.com')).toBe(true);
        expect(urlValidators.isValidUrl('file:///path/to/file')).toBe(true);
      });

      it('should reject invalid URLs', () => {
        expect(urlValidators.isValidUrl('not-a-url')).toBe(false);
        expect(urlValidators.isValidUrl('http://')).toBe(false);
        expect(urlValidators.isValidUrl('')).toBe(false);
      });
    });

    describe('isHttps', () => {
      it('should detect HTTPS URLs', () => {
        expect(urlValidators.isHttps('https://example.com')).toBe(true);
        expect(urlValidators.isHttps('https://secure.example.com:443')).toBe(true);
      });

      it('should reject non-HTTPS URLs', () => {
        expect(urlValidators.isHttps('http://example.com')).toBe(false);
        expect(urlValidators.isHttps('ftp://example.com')).toBe(false);
        expect(urlValidators.isHttps('invalid-url')).toBe(false);
      });
    });

    describe('isLocalhost', () => {
      it('should detect localhost URLs', () => {
        expect(urlValidators.isLocalhost('http://localhost:3000')).toBe(true);
        expect(urlValidators.isLocalhost('https://localhost')).toBe(true);
        expect(urlValidators.isLocalhost('http://127.0.0.1:8080')).toBe(true);
      });

      it('should reject non-localhost URLs', () => {
        expect(urlValidators.isLocalhost('https://example.com')).toBe(false);
        expect(urlValidators.isLocalhost('http://192.168.1.1')).toBe(false);
        expect(urlValidators.isLocalhost('invalid-url')).toBe(false);
      });
    });

    describe('hasQuery', () => {
      it('should detect URLs with query parameters', () => {
        expect(urlValidators.hasQuery('https://example.com?q=test')).toBe(true);
        expect(urlValidators.hasQuery('https://example.com?a=1&b=2')).toBe(true);
      });

      it('should reject URLs without query parameters', () => {
        expect(urlValidators.hasQuery('https://example.com')).toBe(false);
        expect(urlValidators.hasQuery('https://example.com#fragment')).toBe(false);
        expect(urlValidators.hasQuery('invalid-url')).toBe(false);
      });
    });

    describe('hasFragment', () => {
      it('should detect URLs with fragments', () => {
        expect(urlValidators.hasFragment('https://example.com#section')).toBe(true);
        expect(urlValidators.hasFragment('https://example.com/path#top')).toBe(true);
      });

      it('should reject URLs without fragments', () => {
        expect(urlValidators.hasFragment('https://example.com')).toBe(false);
        expect(urlValidators.hasFragment('https://example.com?q=test')).toBe(false);
        expect(urlValidators.hasFragment('invalid-url')).toBe(false);
      });
    });
  });

  describe('urlUtils', () => {
    describe('addQuery', () => {
      it('should add query parameters to URL', () => {
        const url = urlUtils.addQuery('https://example.com', { q: 'test', page: 1 });
        expect(url).toBe('https://example.com/?q=test&page=1');
      });

      it('should add to existing query parameters', () => {
        const url = urlUtils.addQuery('https://example.com?existing=value', { new: 'param' });
        expect(url).toContain('existing=value');
        expect(url).toContain('new=param');
      });

      it('should handle boolean values', () => {
        const url = urlUtils.addQuery('https://example.com', { active: true, disabled: false });
        expect(url).toContain('active=true');
        expect(url).toContain('disabled=false');
      });

      it('should handle invalid URLs gracefully', () => {
        const url = urlUtils.addQuery('invalid-url', { test: 'value' });
        expect(url).toBe('invalid-url');
      });
    });

    describe('removeQuery', () => {
      it('should remove specific query parameters', () => {
        const url = urlUtils.removeQuery('https://example.com?a=1&b=2&c=3', 'b');
        expect(url).toContain('a=1');
        expect(url).toContain('c=3');
        expect(url).not.toContain('b=2');
      });

      it('should remove multiple parameters', () => {
        const url = urlUtils.removeQuery('https://example.com?a=1&b=2&c=3', 'a', 'c');
        expect(url).toContain('b=2');
        expect(url).not.toContain('a=1');
        expect(url).not.toContain('c=3');
      });

      it('should handle non-existent parameters', () => {
        const url = urlUtils.removeQuery('https://example.com?a=1', 'b', 'c');
        expect(url).toContain('a=1');
      });

      it('should handle invalid URLs gracefully', () => {
        const url = urlUtils.removeQuery('invalid-url', 'test');
        expect(url).toBe('invalid-url');
      });
    });

    describe('setFragment', () => {
      it('should set fragment on URL', () => {
        const url = urlUtils.setFragment('https://example.com', 'section1');
        expect(url).toBe('https://example.com/#section1');
      });

      it('should handle fragment with hash prefix', () => {
        const url = urlUtils.setFragment('https://example.com', '#section1');
        expect(url).toBe('https://example.com/#section1');
      });

      it('should replace existing fragment', () => {
        const url = urlUtils.setFragment('https://example.com#old', 'new');
        expect(url).toBe('https://example.com/#new');
      });

      it('should handle invalid URLs gracefully', () => {
        const url = urlUtils.setFragment('invalid-url', 'fragment');
        expect(url).toBe('invalid-url');
      });
    });

    describe('getDomain', () => {
      it('should extract domain from URL', () => {
        expect(urlUtils.getDomain('https://example.com/path')).toBe('example.com');
        expect(urlUtils.getDomain('http://subdomain.test.org:8080')).toBe('subdomain.test.org');
      });

      it('should handle invalid URLs gracefully', () => {
        expect(urlUtils.getDomain('invalid-url')).toBe('');
      });
    });

    describe('getPath', () => {
      it('should extract path from URL', () => {
        expect(urlUtils.getPath('https://example.com/api/users')).toBe('/api/users');
        expect(urlUtils.getPath('https://example.com')).toBe('/');
      });

      it('should handle invalid URLs gracefully', () => {
        expect(urlUtils.getPath('invalid-url')).toBe('');
      });
    });

    describe('parseQuery', () => {
      it('should parse query parameters from URL', () => {
        const params = urlUtils.parseQuery('https://example.com?a=1&b=test&c=true');
        expect(params).toEqual({ a: '1', b: 'test', c: 'true' });
      });

      it('should handle URLs without query parameters', () => {
        const params = urlUtils.parseQuery('https://example.com');
        expect(params).toEqual({});
      });

      it('should handle URL encoding', () => {
        const params = urlUtils.parseQuery('https://example.com?query=hello%20world');
        expect(params.query).toBe('hello world');
      });

      it('should handle invalid URLs gracefully', () => {
        const params = urlUtils.parseQuery('invalid-url');
        expect(params).toEqual({});
      });
    });
  });

  describe('urlScenarios', () => {
    describe('api scenarios', () => {
      it('should generate REST API URLs', () => {
        expect(urlScenarios.api.rest()).toContain('/v1/users');
        expect(urlScenarios.api.rest('v2')).toContain('/v2/users');
        expect(urlScenarios.api.rest()).toContain('api.example.com');
      });

      it('should generate GraphQL API URL', () => {
        const url = urlScenarios.api.graphql();
        expect(url).toContain('api.example.com');
        expect(url).toContain('/graphql');
      });

      it('should generate webhook URLs', () => {
        const url = urlScenarios.api.webhook('payment');
        expect(url).toContain('webhooks.example.com');
        expect(url).toContain('/payment');
      });
    });

    describe('file scenarios', () => {
      it('should generate download URLs', () => {
        const url = urlScenarios.files.download('document.pdf');
        expect(url).toContain('/downloads/document.pdf');
      });

      it('should generate upload URL', () => {
        const url = urlScenarios.files.upload();
        expect(url).toContain('/upload');
        expect(url).toContain('type=file');
      });

      it('should generate preview URLs', () => {
        const url = urlScenarios.files.preview('123');
        expect(url).toContain('/preview/123');
      });
    });
  });

  describe('Integration tests', () => {
    it('should work together to build complex URL scenarios', () => {
      // Generate base URL
      const baseUrl = generateTestUrl({
        protocol: 'https',
        host: 'api.myapp.com',
        port: 443,
        path: '/v1'
      });

      // Add query parameters
      const urlWithQuery = urlUtils.addQuery(baseUrl, {
        apiKey: 'test-key',
        format: 'json'
      });

      // Create pattern URL
      const patternUrl = createUrlPattern(`${urlWithQuery}/users/:userId/posts`, {
        userId: '123'
      });

      // Validate the final URL
      expect(urlValidators.isValidUrl(patternUrl)).toBe(true);
      expect(urlValidators.isHttps(patternUrl)).toBe(true);
      expect(urlValidators.hasQuery(patternUrl)).toBe(true);

      // Parse components
      expect(urlUtils.getDomain(patternUrl)).toBe('api.myapp.com');
      expect(urlUtils.getPath(patternUrl)).toBe('/v1/users/123/posts');
      expect(urlUtils.parseQuery(patternUrl)).toEqual({
        apiKey: 'test-key',
        format: 'json'
      });

      expect(patternUrl).toBe('https://api.myapp.com:443/v1/users/123/posts?apiKey=test-key&format=json');
    });

    it('should handle edge cases and error conditions', () => {
      // Test with malformed URL
      const invalidUrl = 'not-a-url';

      expect(urlValidators.isValidUrl(invalidUrl)).toBe(false);
      expect(urlUtils.addQuery(invalidUrl, { test: 'value' })).toBe(invalidUrl);
      expect(urlUtils.getDomain(invalidUrl)).toBe('');
      expect(urlUtils.parseQuery(invalidUrl)).toEqual({});

      // Test with empty/null values
      expect(generateTestUrls(0)).toHaveLength(0);
      expect(createUrlPattern('/test/:id', {})).toBe('/test/:id');
      expect(urlUtils.parseQuery('https://example.com')).toEqual({});
    });
  });
});