/**
 * @fileoverview Tests for BrowserStateBuilder
 *
 * Tests the BrowserStateBuilder class and createBrowserState factory function
 * to ensure they create proper browser state objects for testing purposes.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  BrowserStateBuilder,
  createBrowserState,
  browserFixtures
} from '../browser-fixtures.js';
import type { BrowserState } from '../types.js';

describe('BrowserStateBuilder', () => {
  describe('Constructor', () => {
    it('should create builder with clean state by default', () => {
      const builder = new BrowserStateBuilder();
      const state = builder.build();

      expect(state.url).toBe('about:blank');
      expect(state.title).toBe('');
      expect(state.isLoading).toBe(false);
      expect(state.hasError).toBe(false);
      expect(state.isAuthenticated).toBe(false);
      expect(state.localStorage).toEqual({});
      expect(state.sessionStorage).toEqual({});
      expect(state.cookies).toEqual([]);
      expect(state.consoleMessages).toEqual([]);
      expect(state.networkRequests).toEqual([]);
    });

    it('should create builder with initial state when provided', () => {
      const initialState: Partial<BrowserState> = {
        url: 'https://example.com',
        title: 'Example Page',
        isAuthenticated: true,
        localStorage: { token: 'abc123' }
      };

      const builder = new BrowserStateBuilder(initialState);
      const state = builder.build();

      expect(state.url).toBe('https://example.com');
      expect(state.title).toBe('Example Page');
      expect(state.isAuthenticated).toBe(true);
      expect(state.localStorage).toEqual({ token: 'abc123' });
      // Other properties should still be defaults from clean state
      expect(state.isLoading).toBe(false);
      expect(state.hasError).toBe(false);
      expect(state.sessionStorage).toEqual({});
      expect(state.cookies).toEqual([]);
      expect(state.consoleMessages).toEqual([]);
      expect(state.networkRequests).toEqual([]);
    });

    it('should create builder without initial state (empty object)', () => {
      const builder = new BrowserStateBuilder({});
      const state = builder.build();

      expect(state).toEqual(browserFixtures.cleanState());
    });
  });

  describe('Fluent methods', () => {
    let builder: BrowserStateBuilder;

    beforeEach(() => {
      builder = new BrowserStateBuilder();
    });

    describe('withUrl', () => {
      it('should set the URL', () => {
        const state = builder.withUrl('https://test.com').build();
        expect(state.url).toBe('https://test.com');
      });

      it('should return the builder for chaining', () => {
        const result = builder.withUrl('https://test.com');
        expect(result).toBe(builder);
      });
    });

    describe('withTitle', () => {
      it('should set the title', () => {
        const state = builder.withTitle('Test Page').build();
        expect(state.title).toBe('Test Page');
      });

      it('should return the builder for chaining', () => {
        const result = builder.withTitle('Test Page');
        expect(result).toBe(builder);
      });
    });

    describe('withLoading', () => {
      it('should set loading state to true', () => {
        const state = builder.withLoading(true).build();
        expect(state.isLoading).toBe(true);
      });

      it('should set loading state to false', () => {
        const state = builder.withLoading(false).build();
        expect(state.isLoading).toBe(false);
      });

      it('should return the builder for chaining', () => {
        const result = builder.withLoading(true);
        expect(result).toBe(builder);
      });
    });

    describe('withError', () => {
      it('should set error state to true', () => {
        const state = builder.withError(true).build();
        expect(state.hasError).toBe(true);
      });

      it('should set error state to false', () => {
        const state = builder.withError(false).build();
        expect(state.hasError).toBe(false);
      });

      it('should return the builder for chaining', () => {
        const result = builder.withError(true);
        expect(result).toBe(builder);
      });
    });

    describe('withAuth', () => {
      it('should set authentication state to true', () => {
        const state = builder.withAuth(true).build();
        expect(state.isAuthenticated).toBe(true);
      });

      it('should set authentication state to false', () => {
        const state = builder.withAuth(false).build();
        expect(state.isAuthenticated).toBe(false);
      });

      it('should return the builder for chaining', () => {
        const result = builder.withAuth(true);
        expect(result).toBe(builder);
      });
    });

    describe('withLocalStorage', () => {
      it('should add local storage data', () => {
        const data = { token: 'abc123', theme: 'dark' };
        const state = builder.withLocalStorage(data).build();
        expect(state.localStorage).toEqual(data);
      });

      it('should merge with existing local storage data', () => {
        const state = builder
          .withLocalStorage({ first: 'value1' })
          .withLocalStorage({ second: 'value2' })
          .build();

        expect(state.localStorage).toEqual({
          first: 'value1',
          second: 'value2'
        });
      });

      it('should overwrite existing keys', () => {
        const state = builder
          .withLocalStorage({ key: 'original' })
          .withLocalStorage({ key: 'updated' })
          .build();

        expect(state.localStorage).toEqual({ key: 'updated' });
      });

      it('should return the builder for chaining', () => {
        const result = builder.withLocalStorage({ key: 'value' });
        expect(result).toBe(builder);
      });
    });

    describe('withSessionStorage', () => {
      it('should add session storage data', () => {
        const data = { sessionId: 'sess123', state: 'active' };
        const state = builder.withSessionStorage(data).build();
        expect(state.sessionStorage).toEqual(data);
      });

      it('should merge with existing session storage data', () => {
        const state = builder
          .withSessionStorage({ first: 'value1' })
          .withSessionStorage({ second: 'value2' })
          .build();

        expect(state.sessionStorage).toEqual({
          first: 'value1',
          second: 'value2'
        });
      });

      it('should overwrite existing keys', () => {
        const state = builder
          .withSessionStorage({ key: 'original' })
          .withSessionStorage({ key: 'updated' })
          .build();

        expect(state.sessionStorage).toEqual({ key: 'updated' });
      });

      it('should return the builder for chaining', () => {
        const result = builder.withSessionStorage({ key: 'value' });
        expect(result).toBe(builder);
      });
    });

    describe('withConsoleMessages', () => {
      it('should add console messages', () => {
        const messages = [
          { type: 'log' as const, message: 'Test log' },
          { type: 'error' as const, message: 'Test error' }
        ];

        const state = builder.withConsoleMessages(messages).build();

        expect(state.consoleMessages).toHaveLength(2);
        expect(state.consoleMessages[0].type).toBe('log');
        expect(state.consoleMessages[0].message).toBe('Test log');
        expect(state.consoleMessages[0].timestamp).toBeInstanceOf(Date);
        expect(state.consoleMessages[1].type).toBe('error');
        expect(state.consoleMessages[1].message).toBe('Test error');
        expect(state.consoleMessages[1].timestamp).toBeInstanceOf(Date);
      });

      it('should preserve provided timestamps', () => {
        const customTimestamp = new Date('2024-01-01T10:00:00Z');
        const messages = [
          {
            type: 'info' as const,
            message: 'Custom timestamp',
            timestamp: customTimestamp
          }
        ];

        const state = builder.withConsoleMessages(messages).build();

        expect(state.consoleMessages[0].timestamp).toEqual(customTimestamp);
      });

      it('should accumulate with existing console messages', () => {
        const firstMessages = [
          { type: 'log' as const, message: 'First' }
        ];
        const secondMessages = [
          { type: 'warn' as const, message: 'Second' }
        ];

        const state = builder
          .withConsoleMessages(firstMessages)
          .withConsoleMessages(secondMessages)
          .build();

        expect(state.consoleMessages).toHaveLength(2);
        expect(state.consoleMessages[0].message).toBe('First');
        expect(state.consoleMessages[1].message).toBe('Second');
      });

      it('should return the builder for chaining', () => {
        const result = builder.withConsoleMessages([]);
        expect(result).toBe(builder);
      });
    });

    describe('withNetworkRequests', () => {
      it('should add network requests', () => {
        const requests = [
          {
            url: 'https://api.test.com/data',
            method: 'GET',
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          },
          {
            url: 'https://api.test.com/post',
            method: 'POST'
          }
        ];

        const state = builder.withNetworkRequests(requests).build();

        expect(state.networkRequests).toEqual(requests);
      });

      it('should accumulate with existing network requests', () => {
        const firstRequests = [
          { url: 'https://first.com', method: 'GET' }
        ];
        const secondRequests = [
          { url: 'https://second.com', method: 'POST' }
        ];

        const state = builder
          .withNetworkRequests(firstRequests)
          .withNetworkRequests(secondRequests)
          .build();

        expect(state.networkRequests).toHaveLength(2);
        expect(state.networkRequests[0].url).toBe('https://first.com');
        expect(state.networkRequests[1].url).toBe('https://second.com');
      });

      it('should return the builder for chaining', () => {
        const result = builder.withNetworkRequests([]);
        expect(result).toBe(builder);
      });
    });
  });

  describe('Method chaining', () => {
    it('should allow chaining all fluent methods', () => {
      const state = new BrowserStateBuilder()
        .withUrl('https://test.com')
        .withTitle('Test Page')
        .withLoading(true)
        .withError(false)
        .withAuth(true)
        .withLocalStorage({ token: 'abc123' })
        .withSessionStorage({ sessionId: 'sess456' })
        .withConsoleMessages([
          { type: 'info', message: 'Page loaded' }
        ])
        .withNetworkRequests([
          { url: 'https://api.test.com', method: 'GET', status: 200 }
        ])
        .build();

      expect(state.url).toBe('https://test.com');
      expect(state.title).toBe('Test Page');
      expect(state.isLoading).toBe(true);
      expect(state.hasError).toBe(false);
      expect(state.isAuthenticated).toBe(true);
      expect(state.localStorage).toEqual({ token: 'abc123' });
      expect(state.sessionStorage).toEqual({ sessionId: 'sess456' });
      expect(state.consoleMessages).toHaveLength(1);
      expect(state.networkRequests).toHaveLength(1);
    });

    it('should allow multiple calls to accumulating methods', () => {
      const state = new BrowserStateBuilder()
        .withLocalStorage({ first: 'value1' })
        .withLocalStorage({ second: 'value2' })
        .withSessionStorage({ session1: 'sess1' })
        .withSessionStorage({ session2: 'sess2' })
        .withConsoleMessages([{ type: 'log', message: 'Log 1' }])
        .withConsoleMessages([{ type: 'warn', message: 'Warn 1' }])
        .withNetworkRequests([{ url: 'https://first.com', method: 'GET' }])
        .withNetworkRequests([{ url: 'https://second.com', method: 'POST' }])
        .build();

      expect(state.localStorage).toEqual({ first: 'value1', second: 'value2' });
      expect(state.sessionStorage).toEqual({ session1: 'sess1', session2: 'sess2' });
      expect(state.consoleMessages).toHaveLength(2);
      expect(state.networkRequests).toHaveLength(2);
    });
  });

  describe('build() method', () => {
    it('should return a copy of the state', () => {
      const builder = new BrowserStateBuilder()
        .withUrl('https://test.com')
        .withLocalStorage({ key: 'value' });

      const state1 = builder.build();
      const state2 = builder.build();

      // Should be different objects
      expect(state1).not.toBe(state2);
      // But with same content
      expect(state1).toEqual(state2);
    });

    it('should not affect returned state when builder is modified after build', () => {
      const builder = new BrowserStateBuilder().withUrl('https://original.com');
      const originalState = builder.build();

      builder.withUrl('https://modified.com');
      const modifiedState = builder.build();

      expect(originalState.url).toBe('https://original.com');
      expect(modifiedState.url).toBe('https://modified.com');
    });

    it('should deep copy nested objects', () => {
      const builder = new BrowserStateBuilder()
        .withLocalStorage({ nested: 'value' })
        .withConsoleMessages([{ type: 'log', message: 'test' }])
        .withNetworkRequests([{ url: 'https://test.com', method: 'GET' }]);

      const state1 = builder.build();
      const state2 = builder.build();

      // Nested objects should be different instances
      expect(state1.localStorage).not.toBe(state2.localStorage);
      expect(state1.consoleMessages).not.toBe(state2.consoleMessages);
      expect(state1.networkRequests).not.toBe(state2.networkRequests);

      // But with same content
      expect(state1.localStorage).toEqual(state2.localStorage);
      expect(state1.consoleMessages).toEqual(state2.consoleMessages);
      expect(state1.networkRequests).toEqual(state2.networkRequests);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty data gracefully', () => {
      const state = new BrowserStateBuilder()
        .withLocalStorage({})
        .withSessionStorage({})
        .withConsoleMessages([])
        .withNetworkRequests([])
        .build();

      expect(state.localStorage).toEqual({});
      expect(state.sessionStorage).toEqual({});
      expect(state.consoleMessages).toEqual([]);
      expect(state.networkRequests).toEqual([]);
    });

    it('should handle undefined and null values in storage', () => {
      const state = new BrowserStateBuilder()
        .withLocalStorage({
          'undefined-value': undefined as any,
          'null-value': null as any,
          'valid-value': 'test'
        })
        .build();

      expect(state.localStorage).toEqual({
        'undefined-value': undefined,
        'null-value': null,
        'valid-value': 'test'
      });
    });

    it('should handle special characters in storage keys and values', () => {
      const specialData = {
        'key with spaces': 'value with spaces',
        'key-with-dashes': 'value-with-dashes',
        'key.with.dots': 'value.with.dots',
        'unicode-key-😀': 'unicode-value-😀',
        'json-data': '{"nested": "object", "array": [1, 2, 3]}'
      };

      const state = new BrowserStateBuilder()
        .withLocalStorage(specialData)
        .build();

      expect(state.localStorage).toEqual(specialData);
    });

    it('should handle large data sets', () => {
      const largeStorageData: Record<string, string> = {};
      const largeMessages: Array<{ type: 'log', message: string }> = [];
      const largeRequests: Array<{ url: string, method: string }> = [];

      // Create large datasets
      for (let i = 0; i < 100; i++) {
        largeStorageData[`key${i}`] = `value${i}`;
        largeMessages.push({ type: 'log', message: `Message ${i}` });
        largeRequests.push({ url: `https://api${i}.com`, method: 'GET' });
      }

      const state = new BrowserStateBuilder()
        .withLocalStorage(largeStorageData)
        .withConsoleMessages(largeMessages)
        .withNetworkRequests(largeRequests)
        .build();

      expect(Object.keys(state.localStorage)).toHaveLength(100);
      expect(state.consoleMessages).toHaveLength(100);
      expect(state.networkRequests).toHaveLength(100);
    });
  });
});

describe('createBrowserState factory function', () => {
  it('should create a new BrowserStateBuilder instance', () => {
    const builder = createBrowserState();
    expect(builder).toBeInstanceOf(BrowserStateBuilder);
  });

  it('should create builder with initial state when provided', () => {
    const initialState: Partial<BrowserState> = {
      url: 'https://factory.com',
      isAuthenticated: true
    };

    const builder = createBrowserState(initialState);
    const state = builder.build();

    expect(state.url).toBe('https://factory.com');
    expect(state.isAuthenticated).toBe(true);
  });

  it('should create builder without initial state', () => {
    const builder = createBrowserState();
    const state = builder.build();

    expect(state).toEqual(browserFixtures.cleanState());
  });

  it('should create independent builder instances', () => {
    const builder1 = createBrowserState().withUrl('https://first.com');
    const builder2 = createBrowserState().withUrl('https://second.com');

    const state1 = builder1.build();
    const state2 = builder2.build();

    expect(state1.url).toBe('https://first.com');
    expect(state2.url).toBe('https://second.com');
  });

  it('should support method chaining from factory', () => {
    const state = createBrowserState({ isAuthenticated: true })
      .withUrl('https://chained.com')
      .withTitle('Chained Page')
      .withLocalStorage({ token: 'chain123' })
      .build();

    expect(state.url).toBe('https://chained.com');
    expect(state.title).toBe('Chained Page');
    expect(state.isAuthenticated).toBe(true);
    expect(state.localStorage).toEqual({ token: 'chain123' });
  });
});

describe('Integration with browser fixtures', () => {
  it('should work with browserFixtures.cleanState as initial state', () => {
    const cleanState = browserFixtures.cleanState();
    const builder = new BrowserStateBuilder(cleanState);
    const state = builder.build();

    expect(state).toEqual(cleanState);
  });

  it('should override specific properties from fixture state', () => {
    const loggedInState = browserFixtures.loggedInPage();
    const builder = new BrowserStateBuilder(loggedInState)
      .withUrl('https://custom.com')
      .withTitle('Custom Title');

    const state = builder.build();

    expect(state.url).toBe('https://custom.com');
    expect(state.title).toBe('Custom Title');
    // Should preserve other properties from logged in fixture
    expect(state.isAuthenticated).toBe(true);
    expect(state.localStorage['auth-token']).toBe('mock-jwt-token');
  });

  it('should extend fixture state with additional data', () => {
    const errorState = browserFixtures.errorPage();
    const builder = new BrowserStateBuilder(errorState)
      .withLocalStorage({ 'debug-mode': 'true' })
      .withConsoleMessages([
        { type: 'error', message: 'Custom error message' }
      ]);

    const state = builder.build();

    // Should have original error state data plus new data
    expect(state.hasError).toBe(true);
    expect(state.localStorage['last-error']).toBeDefined();
    expect(state.localStorage['debug-mode']).toBe('true');
    expect(state.consoleMessages.length).toBeGreaterThan(3); // Original + new messages
  });
});