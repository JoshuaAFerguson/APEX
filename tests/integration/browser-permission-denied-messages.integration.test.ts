/**
 * Browser Permission-Denied Error Messages Integration Tests
 *
 * This test suite verifies the quality and user-friendliness of error messages
 * when browser permissions are denied. Tests ensure error messages are clear,
 * helpful, and do not expose internal implementation details.
 *
 * Tests verify:
 * 1. User-friendly error messages for each permission type
 * 2. Resolution suggestions are helpful and actionable
 * 3. Permission-type-specific messages are accurate
 * 4. Sanitized error messages without internal paths/secrets
 * 5. Proper error message formatting and structure
 *
 * @module tests/integration/browser-permission-denied-messages
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createPermissionTestContext,
  createPermissionDenialScenarios,
  assertPermissionDeniedResponse,
  assertErrorMessageQuality,
  type PermissionTestContext
} from '../test-utils/permission-test-helpers.js';
import { BrowserPermissionDeniedError } from '../../packages/core/src/tools/browser/browser-permission-denied-error.js';

describe('Browser Permission-Denied Error Messages Integration Tests', () => {
  let testContext: PermissionTestContext;
  const scenarios = createPermissionDenialScenarios();

  afterEach(async () => {
    if (testContext) {
      await testContext.browserTool.cleanup();
      testContext = null as any;
    }
    vi.restoreAllMocks();
  });

  describe('User-Friendly Messages', () => {
    it('should provide clear navigation denial messages', async () => {
      testContext = scenarios.denyNavigation();

      const result = await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      assertPermissionDeniedResponse(result, 'navigate');
      assertErrorMessageQuality(result.error);

      // Should be clear about navigation denial
      expect(result.error).toMatch(/navigation|access|permission.*denied|blocked/i);

      // Should not contain technical jargon
      expect(result.error).not.toMatch(/chromium|playwright|browser.*instance/i);
      expect(result.error).not.toContain('TypeError');
      expect(result.error).not.toContain('undefined');

      // Should be sentence-like
      expect(result.error).toMatch(/^[A-Z].*[.!?]$/);
    });

    it('should provide clear JavaScript execution denial messages', async () => {
      testContext = scenarios.denyJavaScript();

      const result = await testContext.browserTool.execute({
        operation: 'evaluate',
        params: { script: 'document.title' }
      });

      assertPermissionDeniedResponse(result, 'evaluate');
      assertErrorMessageQuality(result.error);

      // Should explain JavaScript execution is not permitted
      expect(result.error).toMatch(/javascript.*execution|script.*execution|evaluation.*not.*permitted/i);

      // Should not expose the actual script
      expect(result.error).not.toContain('document.title');

      // Should be user-friendly
      expect(result.error).not.toContain('eval()');
      expect(result.error).not.toContain('Function');
    });

    it('should provide clear form interaction denial messages', async () => {
      testContext = createPermissionTestContext({ denyOperations: ['submit', 'type'] });

      const typeResult = await testContext.browserTool.execute({
        operation: 'type',
        params: { selector: '#input', text: 'test data' }
      });

      assertPermissionDeniedResponse(typeResult, 'type');
      assertErrorMessageQuality(typeResult.error);

      expect(typeResult.error).toMatch(/typing|input|text.*entry.*not.*permitted/i);

      const submitResult = await testContext.browserTool.execute({
        operation: 'submit',
        params: { selector: '#form' }
      });

      assertPermissionDeniedResponse(submitResult, 'submit');
      assertErrorMessageQuality(submitResult.error);

      expect(submitResult.error).toMatch(/form.*submission|submit.*not.*permitted/i);
    });

    it('should provide clear screenshot denial messages', async () => {
      testContext = scenarios.denyScreenshots();

      const result = await testContext.browserTool.execute({
        operation: 'screenshot',
        params: { fullPage: true }
      });

      assertPermissionDeniedResponse(result, 'screenshot');
      assertErrorMessageQuality(result.error);

      expect(result.error).toMatch(/screenshot|image.*capture|screen.*capture.*not.*permitted/i);
      expect(result.error).not.toContain('Buffer');
      expect(result.error).not.toContain('PNG');
    });

    it('should provide clear data extraction denial messages', async () => {
      testContext = scenarios.denyDataExtraction();

      const getTextResult = await testContext.browserTool.execute({
        operation: 'getText',
        params: { selector: 'h1' }
      });

      assertPermissionDeniedResponse(getTextResult, 'getText');
      assertErrorMessageQuality(getTextResult.error);

      expect(getTextResult.error).toMatch(/text.*extraction|content.*access.*not.*permitted/i);

      const getAttrResult = await testContext.browserTool.execute({
        operation: 'getAttribute',
        params: { selector: '#element', attribute: 'href' }
      });

      assertPermissionDeniedResponse(getAttrResult, 'getAttribute');
      assertErrorMessageQuality(getAttrResult.error);

      expect(getAttrResult.error).toMatch(/attribute.*access|element.*attribute.*not.*permitted/i);
    });

    it('should provide clear click interaction denial messages', async () => {
      testContext = scenarios.denyInteraction();

      const result = await testContext.browserTool.execute({
        operation: 'click',
        params: { selector: '#button' }
      });

      assertPermissionDeniedResponse(result, 'click');
      assertErrorMessageQuality(result.error);

      expect(result.error).toMatch(/click|interaction|element.*interaction.*not.*permitted/i);

      // Should not expose the selector
      expect(result.error).not.toContain('#button');
    });
  });

  describe('Resolution Suggestions', () => {
    it('should provide actionable suggestions for navigation denials', async () => {
      testContext = scenarios.denyNavigation();

      const result = await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      assertPermissionDeniedResponse(result, 'navigate');

      expect(result.metadata.suggestions).toBeInstanceOf(Array);
      expect(result.metadata.suggestions.length).toBeGreaterThan(0);

      const suggestionsText = result.metadata.suggestions.join(' ').toLowerCase();

      // Should contain actionable advice
      expect(suggestionsText).toMatch(/permission|setting|configuration|allow/);

      // Each suggestion should be a proper sentence
      result.metadata.suggestions.forEach((suggestion: string) => {
        expect(suggestion).toMatch(/^[A-Z].*[.!]$/);
        expect(suggestion.length).toBeGreaterThan(10);
      });
    });

    it('should provide specific suggestions for JavaScript denial', async () => {
      testContext = scenarios.denyJavaScript();

      const result = await testContext.browserTool.execute({
        operation: 'evaluate',
        params: { script: 'window.location.href' }
      });

      assertPermissionDeniedResponse(result, 'evaluate');

      const suggestionsText = result.metadata.suggestions.join(' ').toLowerCase();

      // Should suggest alternatives and configuration changes
      expect(suggestionsText).toMatch(/javascript|configuration|different.*operation|alternative/);

      // Should be actionable
      expect(suggestionsText).toMatch(/enable|configure|use.*different|try.*alternative/);
    });

    it('should provide domain-specific suggestions for blocked domains', async () => {
      testContext = scenarios.blockDomains(['blocked.com']);

      const result = await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://blocked.com' }
      });

      assertPermissionDeniedResponse(result, 'navigate');

      const suggestionsText = result.metadata.suggestions.join(' ').toLowerCase();

      // Should suggest domain management actions
      expect(suggestionsText).toMatch(/domain|allowed.*list|administrator|security.*polic/);

      // Should be specific to domain issues
      expect(suggestionsText).toMatch(/add.*domain|contact.*administrator|update.*polic/);
    });

    it('should provide helpful suggestions for screenshot denials', async () => {
      testContext = scenarios.denyScreenshots();

      const result = await testContext.browserTool.execute({
        operation: 'screenshot',
        params: { fullPage: true }
      });

      assertPermissionDeniedResponse(result, 'screenshot');

      const suggestionsText = result.metadata.suggestions.join(' ').toLowerCase();

      expect(suggestionsText).toMatch(/screenshot|capture|permission|configuration/);
      expect(suggestionsText).toMatch(/enable|allow|configure/);
    });

    it('should provide contextual suggestions for mixed denials', async () => {
      testContext = scenarios.partialDenial();

      // Test JavaScript denial
      const evalResult = await testContext.browserTool.execute({
        operation: 'evaluate',
        params: { script: 'document.title' }
      });

      assertPermissionDeniedResponse(evalResult, 'evaluate');

      const evalSuggestions = evalResult.metadata.suggestions.join(' ').toLowerCase();
      expect(evalSuggestions).toMatch(/javascript.*execution|configuration|different.*operation/);

      // Test form submission denial
      const submitResult = await testContext.browserTool.execute({
        operation: 'submit',
        params: { selector: '#form' }
      });

      assertPermissionDeniedResponse(submitResult, 'submit');

      const submitSuggestions = submitResult.metadata.suggestions.join(' ').toLowerCase();
      expect(submitSuggestions).toMatch(/form.*submission|manual.*interaction|configuration/);
    });
  });

  describe('Permission Type Specific Messages', () => {
    it('should provide specific messages for geolocation permission type', async () => {
      const error = BrowserPermissionDeniedError.fromBrowserPermissionError(
        'geolocation',
        'getLocation',
        'https://example.com'
      );

      const message = error.getUserFriendlyMessage();
      const suggestions = error.getResolutionSuggestions();

      expect(message).toMatch(/location.*access.*denied|location.*permission/i);
      expect(suggestions.some(s => s.toLowerCase().includes('location'))).toBe(true);
      expect(suggestions.some(s => s.toLowerCase().includes('browser'))).toBe(true);
    });

    it('should provide specific messages for camera permission type', async () => {
      const error = BrowserPermissionDeniedError.fromBrowserPermissionError(
        'camera',
        'captureVideo',
        'https://example.com'
      );

      const message = error.getUserFriendlyMessage();
      const suggestions = error.getResolutionSuggestions();

      expect(message).toMatch(/camera.*access.*denied|camera.*permission/i);
      expect(suggestions.some(s => s.toLowerCase().includes('camera'))).toBe(true);
      expect(suggestions.some(s => s.toLowerCase().includes('application'))).toBe(true);
    });

    it('should provide specific messages for microphone permission type', async () => {
      const error = BrowserPermissionDeniedError.fromBrowserPermissionError(
        'microphone',
        'recordAudio',
        'https://example.com'
      );

      const message = error.getUserFriendlyMessage();
      const suggestions = error.getResolutionSuggestions();

      expect(message).toMatch(/microphone.*access.*denied|microphone.*permission/i);
      expect(suggestions.some(s => s.toLowerCase().includes('microphone'))).toBe(true);
      expect(suggestions.some(s => s.toLowerCase().includes('audio'))).toBe(true);
    });

    it('should provide specific messages for clipboard permission type', async () => {
      const error = BrowserPermissionDeniedError.fromBrowserPermissionError(
        'clipboard-write',
        'writeClipboard',
        'document'
      );

      const message = error.getUserFriendlyMessage();
      const suggestions = error.getResolutionSuggestions();

      expect(message).toMatch(/clipboard.*access.*denied|clipboard.*permission/i);
      expect(suggestions.some(s => s.toLowerCase().includes('clipboard'))).toBe(true);
      expect(suggestions.some(s => s.toLowerCase().includes('context.*menu'))).toBe(true);
    });

    it('should provide specific messages for storage permission type', async () => {
      const error = BrowserPermissionDeniedError.fromBrowserPermissionError(
        'persistent-storage',
        'storeData',
        'localStorage'
      );

      const message = error.getUserFriendlyMessage();
      const suggestions = error.getResolutionSuggestions();

      expect(message).toMatch(/storage.*access.*denied|storage.*permission/i);
      expect(suggestions.some(s => s.toLowerCase().includes('storage'))).toBe(true);
      expect(suggestions.some(s => s.toLowerCase().includes('privacy'))).toBe(true);
    });

    it('should provide specific messages for domain permission type', async () => {
      const error = BrowserPermissionDeniedError.forDomainRestriction(
        'blocked-site.com',
        'navigate',
        'Domain not in allowed list'
      );

      const message = error.getUserFriendlyMessage();
      const suggestions = error.getResolutionSuggestions();

      expect(message).toMatch(/domain.*blocked|access.*blocked.*security/i);
      expect(suggestions.some(s => s.toLowerCase().includes('domain'))).toBe(true);
      expect(suggestions.some(s => s.toLowerCase().includes('allowed'))).toBe(true);
    });

    it('should provide specific messages for JavaScript permission type', async () => {
      const error = BrowserPermissionDeniedError.forDisabledFeature(
        'javascript',
        'evaluate'
      );

      const message = error.getUserFriendlyMessage();
      const suggestions = error.getResolutionSuggestions();

      expect(message).toMatch(/javascript.*execution.*not.*permitted/i);
      expect(suggestions.some(s => s.toLowerCase().includes('javascript'))).toBe(true);
      expect(suggestions.some(s => s.toLowerCase().includes('configuration'))).toBe(true);
    });

    it('should provide specific messages for form submission permission type', async () => {
      const error = BrowserPermissionDeniedError.forDisabledFeature(
        'form',
        'submit'
      );

      const message = error.getUserFriendlyMessage();
      const suggestions = error.getResolutionSuggestions();

      expect(message).toMatch(/form.*submission.*not.*permitted/i);
      expect(suggestions.some(s => s.toLowerCase().includes('form'))).toBe(true);
      expect(suggestions.some(s => s.toLowerCase().includes('manual'))).toBe(true);
    });
  });

  describe('Sanitized Error Messages', () => {
    it('should not expose internal file paths in error messages', async () => {
      testContext = scenarios.denyAllOperations();

      const result = await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      assertPermissionDeniedResponse(result, 'navigate');

      // Should not contain any file system paths
      expect(result.error).not.toMatch(/\/Users\/|\/home\/|C:\\/);
      expect(result.error).not.toContain('node_modules');
      expect(result.error).not.toContain('packages/');
      expect(result.error).not.toContain('.ts');
      expect(result.error).not.toContain('.js');
      expect(result.error).not.toContain('src/');
      expect(result.error).not.toContain('dist/');
    });

    it('should not expose internal error types in messages', async () => {
      testContext = scenarios.denyNavigation();

      const result = await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      assertPermissionDeniedResponse(result, 'navigate');

      // Should not contain JavaScript error types
      expect(result.error).not.toContain('TypeError');
      expect(result.error).not.toContain('ReferenceError');
      expect(result.error).not.toContain('Error:');
      expect(result.error).not.toContain('undefined');
      expect(result.error).not.toContain('null');

      // Should not start with error class names
      expect(result.error).not.toMatch(/^[A-Z][a-z]+Error:/);
    });

    it('should not expose sensitive configuration details', async () => {
      testContext = createPermissionTestContext({
        denyOperations: ['navigate'],
        blockedDomains: ['internal.company.com', 'secret.api']
      });

      const result = await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      assertPermissionDeniedResponse(result, 'navigate');

      // Should not expose internal domain names
      expect(result.error).not.toContain('internal.company.com');
      expect(result.error).not.toContain('secret.api');

      // Should not expose configuration structure
      expect(result.error).not.toContain('denyOperations');
      expect(result.error).not.toContain('blockedDomains');
    });

    it('should not expose stack traces in error messages', async () => {
      testContext = scenarios.simulateFailure();

      const result = await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      expect(result.success).toBe(false);

      // Should not contain stack trace information
      expect(result.error).not.toContain('at ');
      expect(result.error).not.toContain('.js:');
      expect(result.error).not.toContain('.ts:');
      expect(result.error).not.toMatch(/\(\/.+:\d+:\d+\)/);
    });

    it('should not expose browser engine details in error messages', async () => {
      testContext = scenarios.denyAllOperations();

      const operations = ['navigate', 'click', 'screenshot', 'evaluate'];

      for (const operation of operations) {
        const result = await testContext.browserTool.execute({
          operation,
          params: operation === 'navigate'
            ? { url: 'https://example.com' }
            : { selector: '#test' }
        });

        assertPermissionDeniedResponse(result, operation as any);

        // Should not contain browser engine details
        expect(result.error).not.toContain('chromium');
        expect(result.error).not.toContain('playwright');
        expect(result.error).not.toContain('puppeteer');
        expect(result.error).not.toContain('CDP');
        expect(result.error).not.toContain('DevTools');
      }
    });
  });

  describe('Error Message Formatting and Structure', () => {
    it('should have consistent error message formatting', async () => {
      testContext = scenarios.denyAllOperations();

      const operations = [
        { operation: 'navigate', params: { url: 'https://example.com' } },
        { operation: 'click', params: { selector: '#button' } },
        { operation: 'type', params: { selector: '#input', text: 'test' } },
        { operation: 'screenshot', params: { fullPage: true } },
        { operation: 'evaluate', params: { script: 'document.title' } },
      ];

      for (const op of operations) {
        const result = await testContext.browserTool.execute(op);

        assertPermissionDeniedResponse(result, op.operation as any);

        // All error messages should follow consistent formatting
        expect(result.error).toMatch(/^[A-Z]/); // Start with capital letter
        expect(result.error).toMatch(/[.!?]$/); // End with punctuation
        expect(result.error.length).toBeGreaterThan(10); // Reasonable length
        expect(result.error.length).toBeLessThan(200); // Not too verbose

        // Should not have double spaces or formatting issues
        expect(result.error).not.toMatch(/\s{2,}/); // No multiple spaces
        expect(result.error).not.toMatch(/\s[.!?]/); // No space before punctuation
      }
    });

    it('should provide consistent metadata structure across all denials', async () => {
      testContext = scenarios.partialDenial();

      const operations = [
        { operation: 'evaluate', params: { script: 'document.title' } },
        { operation: 'submit', params: { selector: '#form' } },
      ];

      for (const op of operations) {
        const result = await testContext.browserTool.execute(op);

        assertPermissionDeniedResponse(result, op.operation as any);

        // Verify consistent metadata structure
        expect(result.metadata).toMatchObject({
          permissionDenied: true,
          deniedBy: expect.any(String),
          timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
          suggestions: expect.any(Array),
        });

        // Verify timestamp is valid and recent
        const timestamp = new Date(result.metadata.timestamp);
        expect(timestamp.getTime()).toBeLessThanOrEqual(Date.now());
        expect(timestamp.getTime()).toBeGreaterThan(Date.now() - 5000); // Within last 5 seconds

        // Verify suggestions are all strings and non-empty
        expect(result.metadata.suggestions.length).toBeGreaterThan(0);
        result.metadata.suggestions.forEach((suggestion: string) => {
          expect(typeof suggestion).toBe('string');
          expect(suggestion.trim().length).toBeGreaterThan(0);
        });
      }
    });

    it('should have proper grammar and readability in error messages', async () => {
      testContext = scenarios.denyAllOperations();

      const result = await testContext.browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      assertPermissionDeniedResponse(result, 'navigate');

      // Should be grammatically correct
      expect(result.error).not.toMatch(/\b(a|an)\s+((?:the|this|that|these|those))/i); // No double articles
      expect(result.error).not.toMatch(/\s+(is|are|was|were)\s+(is|are|was|were)/i); // No double verbs
      expect(result.error).not.toMatch(/\.\s*[a-z]/); // Sentences should start with capitals

      // Should be readable (no excessive technical jargon)
      const technicalTerms = ['instantiation', 'implementation', 'serialization', 'deserialization'];
      technicalTerms.forEach(term => {
        expect(result.error.toLowerCase()).not.toContain(term);
      });
    });
  });
});