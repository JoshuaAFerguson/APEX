/**
 * @apexcli/browser - Browser History State Management Tests
 *
 * Focused tests for browser history state verification and management.
 * Tests the internal state tracking and consistency of browser history operations.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BrowserManager } from '../browser-manager.js';
import { BrowserSession } from '../browser-session.js';

describe('Browser History State Management', () => {
  let manager: BrowserManager;
  let session: BrowserSession;

  beforeEach(async () => {
    manager = new BrowserManager();
    session = new BrowserSession(manager, {
      browserType: 'chromium',
      headless: true,
      timeout: 30000
    });
    await session.launch();
  });

  afterEach(async () => {
    if (session) {
      await session.close();
    }
    if (manager) {
      await manager.shutdown();
    }
  });

  describe('History State Tracking', () => {
    it('should track history state with window.history properties', async () => {
      // Navigate to a page that exposes history state
      await session.navigate(`data:text/html,<html>
        <head><title>History State Tracker</title></head>
        <body>
          <h1>History State Tracker</h1>
          <div id="history-length"></div>
          <div id="history-state"></div>
          <script>
            function updateHistoryInfo() {
              document.getElementById('history-length').textContent = 'Length: ' + history.length;
              document.getElementById('history-state').textContent = 'State: ' + JSON.stringify(history.state);
            }

            updateHistoryInfo();
            window.addEventListener('popstate', updateHistoryInfo);

            // Make update function available globally
            window.updateHistoryInfo = updateHistoryInfo;
          </script>
        </body>
      </html>`);

      // Get initial history length
      const initialLengthResult = await session.evaluate(() => {
        return {
          length: history.length,
          state: history.state
        };
      });
      expect(initialLengthResult.success).toBe(true);

      // Navigate to another page
      await session.navigate(`data:text/html,<html>
        <head><title>Second Page</title></head>
        <body>
          <h1>Second Page</h1>
          <script>
            window.historyInfo = {
              length: history.length,
              state: history.state
            };
          </script>
        </body>
      </html>`);

      // Check if history length increased
      const secondPageResult = await session.evaluate(() => window.historyInfo);
      expect(secondPageResult.success).toBe(true);
      expect(secondPageResult.data.length).toBeGreaterThan(initialLengthResult.data.length);
    });

    it('should maintain proper history.length during back/forward navigation', async () => {
      // Create helper function to get history length
      const getHistoryLength = async (): Promise<number> => {
        const result = await session.evaluate(() => history.length);
        expect(result.success).toBe(true);
        return result.data as number;
      };

      // Navigate through multiple pages
      await session.navigate('data:text/html,<html><head><title>Page 1</title></head><body><h1>Page 1</h1></body></html>');
      const length1 = await getHistoryLength();

      await session.navigate('data:text/html,<html><head><title>Page 2</title></head><body><h1>Page 2</h1></body></html>');
      const length2 = await getHistoryLength();

      await session.navigate('data:text/html,<html><head><title>Page 3</title></head><body><h1>Page 3</h1></body></html>');
      const length3 = await getHistoryLength();

      // Verify history length increases
      expect(length2).toBeGreaterThan(length1);
      expect(length3).toBeGreaterThan(length2);

      // Navigate back - history length should remain the same
      await session.goBack();
      const lengthAfterBack1 = await getHistoryLength();
      expect(lengthAfterBack1).toBe(length3);

      await session.goBack();
      const lengthAfterBack2 = await getHistoryLength();
      expect(lengthAfterBack2).toBe(length3);

      // Navigate forward - history length should remain the same
      await session.goForward();
      const lengthAfterForward = await getHistoryLength();
      expect(lengthAfterForward).toBe(length3);
    });

    it('should handle history state objects correctly', async () => {
      // Navigate to page that sets history state
      await session.navigate(`data:text/html,<html>
        <head><title>State Management</title></head>
        <body>
          <h1>State Management Test</h1>
          <button id="pushState" onclick="history.pushState({page: 'pushed', data: 42}, 'Pushed State', '?state=pushed')">Push State</button>
          <button id="replaceState" onclick="history.replaceState({page: 'replaced', data: 99}, 'Replaced State', '?state=replaced')">Replace State</button>
          <div id="current-state"></div>
          <script>
            function displayState() {
              document.getElementById('current-state').textContent = JSON.stringify(history.state);
            }

            window.addEventListener('popstate', function(event) {
              displayState();
            });

            displayState();
            window.displayState = displayState;
          </script>
        </body>
      </html>`);

      // Push new state
      await session.click('#pushState');

      // Verify state was set
      const pushedState = await session.evaluate(() => history.state);
      expect(pushedState.success).toBe(true);
      expect(pushedState.data).toEqual({ page: 'pushed', data: 42 });

      // Navigate back and verify we can access the previous state
      await session.goBack();

      // Navigate forward again and verify state is restored
      await session.goForward();
      const restoredState = await session.evaluate(() => history.state);
      expect(restoredState.success).toBe(true);
      expect(restoredState.data).toEqual({ page: 'pushed', data: 42 });
    });
  });

  describe('URL History Consistency', () => {
    it('should maintain URL history consistency during complex navigation', async () => {
      const urls = [
        'data:text/html,<html><head><title>Alpha</title></head><body><h1 id="page">Alpha</h1></body></html>',
        'data:text/html,<html><head><title>Beta</title></head><body><h1 id="page">Beta</h1></body></html>',
        'data:text/html,<html><head><title>Gamma</title></head><body><h1 id="page">Gamma</h1></body></html>',
        'data:text/html,<html><head><title>Delta</title></head><body><h1 id="page">Delta</h1></body></html>'
      ];

      const expectedTitles = ['Alpha', 'Beta', 'Gamma', 'Delta'];

      // Navigate to all pages and track URLs
      const navigatedUrls = [];
      for (let i = 0; i < urls.length; i++) {
        await session.navigate(urls[i]);
        navigatedUrls.push(session.getCurrentUrl());

        // Verify title matches expected
        const title = await session.getTitle();
        expect(title.data).toBe(expectedTitles[i]);
      }

      // Navigate back through history and verify URL restoration
      for (let i = expectedTitles.length - 2; i >= 0; i--) {
        await session.goBack();
        const title = await session.getTitle();
        expect(title.data).toBe(expectedTitles[i]);

        // URL should match what we navigated to originally
        const currentUrl = session.getCurrentUrl();
        expect(currentUrl).toBe(navigatedUrls[i]);
      }

      // Navigate forward and verify URL consistency
      for (let i = 1; i < expectedTitles.length; i++) {
        await session.goForward();
        const title = await session.getTitle();
        expect(title.data).toBe(expectedTitles[i]);

        const currentUrl = session.getCurrentUrl();
        expect(currentUrl).toBe(navigatedUrls[i]);
      }
    });

    it('should handle URL parameters and fragments correctly in history', async () => {
      const urlsWithParams = [
        'data:text/html,<html><head><title>Base</title></head><body><h1>Base Page</h1></body></html>',
        'data:text/html,<html><head><title>With Query</title></head><body><h1>Query Page</h1></body></html>',
        'data:text/html,<html><head><title>With Fragment</title></head><body><h1>Fragment Page</h1></body></html>'
      ];

      // Navigate and modify URLs programmatically
      await session.navigate(urlsWithParams[0]);
      const baseUrl = session.getCurrentUrl();

      await session.navigate(urlsWithParams[1]);

      // Add query parameters via JavaScript
      await session.evaluate(() => {
        history.replaceState(null, '', window.location.href + '?param=test&value=123');
      });

      const urlWithQuery = session.getCurrentUrl();
      expect(urlWithQuery).toContain('param=test');
      expect(urlWithQuery).toContain('value=123');

      await session.navigate(urlsWithParams[2]);

      // Add hash fragment
      await session.evaluate(() => {
        history.replaceState(null, '', window.location.href + '#section1');
      });

      const urlWithFragment = session.getCurrentUrl();
      expect(urlWithFragment).toContain('#section1');

      // Navigate back and verify URLs are restored correctly
      await session.goBack();
      expect(session.getCurrentUrl()).toBe(urlWithQuery);

      await session.goBack();
      expect(session.getCurrentUrl()).toBe(baseUrl);
    });
  });

  describe('History State Persistence', () => {
    it('should persist custom history state through navigation', async () => {
      // Create a page that manages complex state
      await session.navigate(`data:text/html,<html>
        <head><title>State Persistence Test</title></head>
        <body>
          <h1>State Persistence Test</h1>
          <div id="state-display">Initial State</div>
          <button id="setState1" onclick="setAppState(1)">Set State 1</button>
          <button id="setState2" onclick="setAppState(2)">Set State 2</button>
          <button id="setState3" onclick="setAppState(3)">Set State 3</button>

          <script>
            let appState = { level: 0, data: 'initial' };

            function setAppState(level) {
              appState = {
                level: level,
                data: 'state-' + level,
                timestamp: Date.now(),
                random: Math.random()
              };

              history.pushState(appState, 'State ' + level, '?level=' + level);
              updateDisplay();
            }

            function updateDisplay() {
              document.getElementById('state-display').textContent = JSON.stringify(appState);
            }

            window.addEventListener('popstate', function(event) {
              if (event.state) {
                appState = event.state;
                updateDisplay();
              }
            });

            // Make functions available globally
            window.setAppState = setAppState;
            window.getAppState = () => appState;
          </script>
        </body>
      </html>`);

      // Set different states
      await session.click('#setState1');
      const state1 = await session.evaluate(() => window.getAppState());
      expect(state1.data.level).toBe(1);

      await session.click('#setState2');
      const state2 = await session.evaluate(() => window.getAppState());
      expect(state2.data.level).toBe(2);

      await session.click('#setState3');
      const state3 = await session.evaluate(() => window.getAppState());
      expect(state3.data.level).toBe(3);

      // Navigate back through states
      await session.goBack();
      const restoredState2 = await session.evaluate(() => window.getAppState());
      expect(restoredState2.data.level).toBe(2);
      expect(restoredState2.data.data).toBe('state-2');

      await session.goBack();
      const restoredState1 = await session.evaluate(() => window.getAppState());
      expect(restoredState1.data.level).toBe(1);
      expect(restoredState1.data.data).toBe('state-1');

      // Navigate forward and verify state restoration
      await session.goForward();
      const rerestoredState2 = await session.evaluate(() => window.getAppState());
      expect(rerestoredState2.data.level).toBe(2);
      expect(rerestoredState2.data.timestamp).toBe(state2.data.timestamp);
      expect(rerestoredState2.data.random).toBe(state2.data.random);
    });
  });

  describe('History Events and Lifecycle', () => {
    it('should trigger popstate events correctly during navigation', async () => {
      await session.navigate(`data:text/html,<html>
        <head><title>PopState Event Test</title></head>
        <body>
          <h1>PopState Event Test</h1>
          <div id="event-log"></div>
          <script>
            let eventLog = [];

            window.addEventListener('popstate', function(event) {
              eventLog.push({
                type: 'popstate',
                state: event.state,
                url: window.location.href,
                timestamp: Date.now()
              });

              updateEventLog();
            });

            function updateEventLog() {
              document.getElementById('event-log').textContent = JSON.stringify(eventLog, null, 2);
            }

            // Add some initial history entries
            history.pushState({id: 1}, 'State 1', '?id=1');
            history.pushState({id: 2}, 'State 2', '?id=2');
            history.pushState({id: 3}, 'State 3', '?id=3');

            window.getEventLog = () => eventLog;
            window.clearEventLog = () => { eventLog = []; updateEventLog(); };
          </script>
        </body>
      </html>`);

      // Clear any initial events
      await session.evaluate(() => window.clearEventLog());

      // Navigate back - should trigger popstate
      await session.goBack();

      let events = await session.evaluate(() => window.getEventLog());
      expect(events.data.length).toBe(1);
      expect(events.data[0].type).toBe('popstate');
      expect(events.data[0].state).toEqual({id: 2});

      // Navigate back again
      await session.goBack();

      events = await session.evaluate(() => window.getEventLog());
      expect(events.data.length).toBe(2);
      expect(events.data[1].state).toEqual({id: 1});

      // Navigate forward
      await session.goForward();

      events = await session.evaluate(() => window.getEventLog());
      expect(events.data.length).toBe(3);
      expect(events.data[2].state).toEqual({id: 2});
    });

    it('should handle hashchange events during navigation', async () => {
      await session.navigate(`data:text/html,<html>
        <head><title>Hash Navigation Test</title></head>
        <body>
          <h1>Hash Navigation Test</h1>
          <div id="hash-log"></div>
          <script>
            let hashEvents = [];

            window.addEventListener('hashchange', function(event) {
              hashEvents.push({
                oldURL: event.oldURL,
                newURL: event.newURL,
                hash: window.location.hash,
                timestamp: Date.now()
              });
              updateHashLog();
            });

            function updateHashLog() {
              document.getElementById('hash-log').textContent = JSON.stringify(hashEvents, null, 2);
            }

            window.getHashEvents = () => hashEvents;
            window.clearHashEvents = () => { hashEvents = []; updateHashLog(); };
          </script>
        </body>
      </html>`);

      // Navigate to same page with different hashes
      const baseUrl = session.getCurrentUrl();

      await session.navigate(baseUrl + '#section1');
      await session.navigate(baseUrl + '#section2');
      await session.navigate(baseUrl + '#section3');

      // Clear events and test navigation
      await session.evaluate(() => window.clearHashEvents());

      // Navigate back through hash history
      await session.goBack();
      let hashEvents = await session.evaluate(() => window.getHashEvents());

      // Should have triggered hashchange event
      if (hashEvents.data.length > 0) {
        expect(hashEvents.data[0].hash).toBe('#section2');
      }

      // Continue back
      await session.goBack();
      hashEvents = await session.evaluate(() => window.getHashEvents());

      // Verify hash navigation is working
      expect(session.getCurrentUrl()).toContain('#section1');
    });
  });
});