/**
 * @fileoverview Browser integration tests for modifier key combinations
 *
 * This test suite validates modifier key functionality in real browser environments,
 * ensuring that Shift+Enter and Ctrl/Cmd+A work correctly across different platforms
 * and browser implementations.
 */

import { describe, it, expect } from 'vitest';
import { Page } from 'playwright';
import { withBrowserTest } from './utils/browser-test-utils.js';
import { waitForElement, takeScreenshot } from './utils/element-interaction-helpers.js';

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Get platform-specific modifier for select all
 */
async function getSelectAllModifier(page: Page): Promise<string> {
  const userAgent = await page.evaluate(() => navigator.userAgent);
  const isMac = userAgent.includes('Mac');
  return isMac ? 'Meta+a' : 'Control+a';
}

/**
 * Setup test input element with specified properties
 */
async function setupTestInput(page: Page, multiline = false): Promise<void> {
  const elementType = multiline ? 'textarea' : 'input';

  await page.setContent(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Modifier Keys Test Page</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          padding: 20px;
          background-color: #f5f5f5;
        }
        .test-container {
          max-width: 800px;
          margin: 0 auto;
          background: white;
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        input, textarea {
          width: 100%;
          padding: 12px;
          border: 2px solid #ddd;
          border-radius: 4px;
          font-size: 16px;
          font-family: 'Courier New', monospace;
          transition: border-color 0.3s ease;
        }
        input:focus, textarea:focus {
          outline: none;
          border-color: #4CAF50;
        }
        textarea {
          resize: vertical;
          min-height: 120px;
        }
        .status {
          margin-top: 10px;
          padding: 8px;
          border-radius: 4px;
          font-size: 14px;
        }
        .success { background-color: #d4edda; color: #155724; }
        .info { background-color: #d1ecf1; color: #0c5460; }
        .warning { background-color: #fff3cd; color: #856404; }
        .debug {
          font-family: monospace;
          font-size: 12px;
          background: #f8f9fa;
          padding: 8px;
          border: 1px solid #e9ecef;
          border-radius: 4px;
          margin-top: 8px;
        }
      </style>
    </head>
    <body>
      <div class="test-container">
        <h2>Modifier Keys Integration Test</h2>
        <p>Testing ${multiline ? 'multi-line' : 'single-line'} input with modifier keys</p>

        ${multiline ?
          '<textarea id="test-input" placeholder="Type here and test Shift+Enter for newlines, Ctrl/Cmd+A for select all..."></textarea>' :
          '<input id="test-input" type="text" placeholder="Type here and test Ctrl/Cmd+A for select all...">'
        }

        <div id="status" class="status info">Ready for testing</div>
        <div id="debug" class="debug">Events will be logged here...</div>
      </div>

      <script>
        const input = document.getElementById('test-input');
        const status = document.getElementById('status');
        const debug = document.getElementById('debug');

        let eventLog = [];

        function logEvent(type, data) {
          const timestamp = new Date().toISOString().substr(11, 8);
          eventLog.push({ timestamp, type, data });
          debug.textContent = eventLog.slice(-5).map(e =>
            \`[\${e.timestamp}] \${e.type}: \${JSON.stringify(e.data)}\`
          ).join('\\n');
        }

        input.addEventListener('keydown', (e) => {
          logEvent('keydown', {
            key: e.key,
            code: e.code,
            ctrl: e.ctrlKey,
            shift: e.shiftKey,
            alt: e.altKey,
            meta: e.metaKey,
            target: e.target.tagName
          });
        });

        input.addEventListener('keyup', (e) => {
          logEvent('keyup', {
            key: e.key,
            value: e.target.value,
            selectionStart: e.target.selectionStart,
            selectionEnd: e.target.selectionEnd
          });
        });

        input.addEventListener('input', (e) => {
          logEvent('input', {
            value: e.target.value,
            inputType: e.inputType || 'unknown'
          });
        });

        input.addEventListener('beforeinput', (e) => {
          logEvent('beforeinput', {
            inputType: e.inputType,
            data: e.data
          });
        });

        // Global event listeners for testing
        window.addEventListener('keydown', (e) => {
          if (e.target === input) {
            // Update status based on key combination
            if (e.key === 'Enter' && e.shiftKey && input.tagName === 'TEXTAREA') {
              status.className = 'status success';
              status.textContent = 'Shift+Enter detected - should insert newline';
            } else if (e.key === 'Enter' && !e.shiftKey) {
              status.className = 'status info';
              status.textContent = 'Enter detected - behavior depends on context';
            } else if (e.key.toLowerCase() === 'a' && (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
              status.className = 'status success';
              status.textContent = 'Select All detected - should select all text';
            }
          }
        });

        // Expose functions for testing
        window.getEventLog = () => eventLog;
        window.clearEventLog = () => { eventLog = []; debug.textContent = ''; };
        window.getInputState = () => ({
          value: input.value,
          selectionStart: input.selectionStart,
          selectionEnd: input.selectionEnd,
          focused: document.activeElement === input
        });
      </script>
    </body>
    </html>
  `);

  // Focus the input element
  await page.focus('#test-input');
}

/**
 * Get current input state from the page
 */
async function getInputState(page: Page) {
  return await page.evaluate(() => window.getInputState());
}

/**
 * Get event log from the page
 */
async function getEventLog(page: Page) {
  return await page.evaluate(() => window.getEventLog());
}

/**
 * Clear event log on the page
 */
async function clearEventLog(page: Page) {
  await page.evaluate(() => window.clearEventLog());
}

// ============================================================================
// Test Suites
// ============================================================================

describe('Modifier Keys - Browser Integration Tests', () => {

  describe('Shift+Enter Behavior in Textarea', () => {
    it('should insert newlines with Shift+Enter in textarea', async () => {
      await withBrowserTest(async (page) => {
        await setupTestInput(page, true); // multiline = true

        // Type initial text
        await page.type('#test-input', 'First line');

        // Verify initial state
        let state = await getInputState(page);
        expect(state.value).toBe('First line');

        // Press Shift+Enter to create new line
        await page.keyboard.press('Shift+Enter');

        // Type second line
        await page.type('#test-input', 'Second line');

        // Verify final state
        state = await getInputState(page);
        expect(state.value).toBe('First line\nSecond line');

        // Verify the newline character is actually present
        const lines = state.value.split('\n');
        expect(lines).toHaveLength(2);
        expect(lines[0]).toBe('First line');
        expect(lines[1]).toBe('Second line');

        // Take screenshot for visual verification
        await takeScreenshot(page, 'shift-enter-textarea-newlines');
      });
    });

    it('should handle multiple consecutive Shift+Enter presses', async () => {
      await withBrowserTest(async (page) => {
        await setupTestInput(page, true);

        await page.type('#test-input', 'Line 1');
        await page.keyboard.press('Shift+Enter');
        await page.keyboard.press('Shift+Enter');
        await page.keyboard.press('Shift+Enter');
        await page.type('#test-input', 'Line 4');

        const state = await getInputState(page);
        expect(state.value).toBe('Line 1\n\n\nLine 4');

        const lines = state.value.split('\n');
        expect(lines).toHaveLength(4);
        expect(lines[0]).toBe('Line 1');
        expect(lines[1]).toBe('');
        expect(lines[2]).toBe('');
        expect(lines[3]).toBe('Line 4');
      });
    });

    it('should handle Shift+Enter in middle of text', async () => {
      await withBrowserTest(async (page) => {
        await setupTestInput(page, true);

        await page.type('#test-input', 'FirstSecond');

        // Move cursor to middle (after 'First')
        await page.keyboard.press('Home');
        for (let i = 0; i < 5; i++) {
          await page.keyboard.press('ArrowRight');
        }

        // Insert newline in middle
        await page.keyboard.press('Shift+Enter');

        const state = await getInputState(page);
        expect(state.value).toBe('First\nSecond');
        expect(state.selectionStart).toBe(6); // After newline
      });
    });
  });

  describe('Regular Enter Behavior', () => {
    it('should not create newlines with regular Enter in single-line input', async () => {
      await withBrowserTest(async (page) => {
        await setupTestInput(page, false); // single-line

        await page.type('#test-input', 'Single line');
        await page.keyboard.press('Enter');

        const state = await getInputState(page);
        expect(state.value).toBe('Single line');
        expect(state.value).not.toContain('\n');
      });
    });

    it('should create newlines with regular Enter in textarea', async () => {
      await withBrowserTest(async (page) => {
        await setupTestInput(page, true); // multiline

        await page.type('#test-input', 'Line 1');
        await page.keyboard.press('Enter');
        await page.type('#test-input', 'Line 2');

        const state = await getInputState(page);
        expect(state.value).toBe('Line 1\nLine 2');
      });
    });
  });

  describe('Ctrl/Cmd+A Select All Behavior', () => {
    it('should select all text with platform-appropriate modifier', async () => {
      await withBrowserTest(async (page) => {
        await setupTestInput(page, false);

        const testText = 'Text to select with modifier key';
        await page.type('#test-input', testText);

        // Get platform-specific modifier
        const selectAllKey = await getSelectAllModifier(page);

        // Clear current selection and place cursor in middle
        await page.click('#test-input');
        await page.keyboard.press('Home');
        for (let i = 0; i < 5; i++) {
          await page.keyboard.press('ArrowRight');
        }

        let state = await getInputState(page);
        expect(state.selectionStart).toBe(5);
        expect(state.selectionEnd).toBe(5);

        // Press select all
        await page.keyboard.press(selectAllKey);

        state = await getInputState(page);
        expect(state.selectionStart).toBe(0);
        expect(state.selectionEnd).toBe(testText.length);
        expect(state.value).toBe(testText);

        // Type replacement text
        await page.type('#test-input', 'Replaced');

        state = await getInputState(page);
        expect(state.value).toBe('Replaced');
      });
    });

    it('should work with Ctrl+A on Windows/Linux and Cmd+A on Mac', async () => {
      await withBrowserTest(async (page) => {
        await setupTestInput(page, true); // multiline for more complex test

        const testText = 'Line 1\nLine 2\nLine 3';
        await page.type('#test-input', testText);

        // Test both Control+A and Meta+A to ensure cross-platform compatibility
        await page.click('#test-input');

        // Try Ctrl+A (Windows/Linux style)
        await page.keyboard.press('Control+a');

        let state = await getInputState(page);
        const ctrlAWorked = state.selectionStart === 0 && state.selectionEnd === testText.length;

        // Reset cursor
        await page.click('#test-input');
        await page.keyboard.press('Home');

        // Try Cmd+A (Mac style)
        try {
          await page.keyboard.press('Meta+a');

          state = await getInputState(page);
          const cmdAWorked = state.selectionStart === 0 && state.selectionEnd === testText.length;

          // At least one should work depending on platform
          expect(ctrlAWorked || cmdAWorked).toBe(true);

        } catch (error) {
          // Meta key might not be available on some platforms
          console.log('Meta key not available, Ctrl+A should work instead');
          expect(ctrlAWorked).toBe(true);
        }
      });
    });

    it('should handle select all with empty input', async () => {
      await withBrowserTest(async (page) => {
        await setupTestInput(page, false);

        const selectAllKey = await getSelectAllModifier(page);
        await page.keyboard.press(selectAllKey);

        const state = await getInputState(page);
        expect(state.selectionStart).toBe(0);
        expect(state.selectionEnd).toBe(0);
        expect(state.value).toBe('');
      });
    });

    it('should not trigger select all with additional modifiers', async () => {
      await withBrowserTest(async (page) => {
        await setupTestInput(page, false);

        await page.type('#test-input', 'Should not select');

        // Position cursor in middle
        await page.keyboard.press('Home');
        for (let i = 0; i < 5; i++) {
          await page.keyboard.press('ArrowRight');
        }

        let state = await getInputState(page);
        const initialSelection = { start: state.selectionStart, end: state.selectionEnd };

        // Try Ctrl+Shift+A (should not select all)
        await page.keyboard.press('Control+Shift+a');

        state = await getInputState(page);
        expect(state.selectionStart).toBe(initialSelection.start);
        expect(state.selectionEnd).toBe(initialSelection.end);

        // Try Ctrl+Alt+A (should not select all)
        await page.keyboard.press('Control+Alt+a');

        state = await getInputState(page);
        expect(state.selectionStart).toBe(initialSelection.start);
        expect(state.selectionEnd).toBe(initialSelection.end);
      });
    });
  });

  describe('Combined Modifier Key Sequences', () => {
    it('should handle Ctrl/Cmd+A followed by Shift+Enter', async () => {
      await withBrowserTest(async (page) => {
        await setupTestInput(page, true); // multiline

        await page.type('#test-input', 'Original text to replace');

        // Select all
        const selectAllKey = await getSelectAllModifier(page);
        await page.keyboard.press(selectAllKey);

        // Replace with newline using Shift+Enter
        await page.keyboard.press('Shift+Enter');

        const state = await getInputState(page);
        expect(state.value).toBe('\n');
        expect(state.selectionStart).toBe(1);
      });
    });

    it('should handle rapid modifier key combinations', async () => {
      await withBrowserTest(async (page) => {
        await setupTestInput(page, true);

        // Rapid sequence: type, select all, type, newline, type
        await page.type('#test-input', 'Initial');

        const selectAllKey = await getSelectAllModifier(page);
        await page.keyboard.press(selectAllKey);

        await page.type('#test-input', 'New');
        await page.keyboard.press('Shift+Enter');
        await page.type('#test-input', 'Line');

        const state = await getInputState(page);
        expect(state.value).toBe('New\nLine');
      });
    });
  });

  describe('Event Logging and Debugging', () => {
    it('should correctly log modifier key events', async () => {
      await withBrowserTest(async (page) => {
        await setupTestInput(page, true);
        await clearEventLog(page);

        // Perform test sequence
        await page.type('#test-input', 'Test');
        await page.keyboard.press('Shift+Enter');

        const selectAllKey = await getSelectAllModifier(page);
        await page.keyboard.press(selectAllKey);

        const events = await getEventLog(page);

        // Verify Shift+Enter event
        const shiftEnterEvent = events.find(e =>
          e.type === 'keydown' &&
          e.data.key === 'Enter' &&
          e.data.shift === true
        );
        expect(shiftEnterEvent).toBeDefined();

        // Verify select all event
        const selectAllEvent = events.find(e =>
          e.type === 'keydown' &&
          e.data.key.toLowerCase() === 'a' &&
          (e.data.ctrl === true || e.data.meta === true)
        );
        expect(selectAllEvent).toBeDefined();
      });
    });
  });

  describe('Cross-Platform Compatibility Tests', () => {
    it('should handle platform detection correctly', async () => {
      await withBrowserTest(async (page) => {
        await setupTestInput(page, false);

        const userAgent = await page.evaluate(() => navigator.userAgent);
        const isMac = userAgent.includes('Mac');

        await page.type('#test-input', 'Platform test');

        // Test expected modifier for platform
        if (isMac) {
          await page.keyboard.press('Meta+a');
        } else {
          await page.keyboard.press('Control+a');
        }

        const state = await getInputState(page);
        expect(state.selectionStart).toBe(0);
        expect(state.selectionEnd).toBe('Platform test'.length);
      });
    });
  });

  describe('Performance and Stress Tests', () => {
    it('should handle large text operations efficiently', async () => {
      await withBrowserTest(async (page) => {
        await setupTestInput(page, true);

        // Generate large text (about 10KB)
        const largeText = 'Large text content. '.repeat(500);

        const startTime = Date.now();

        await page.evaluate((text) => {
          document.getElementById('test-input').value = text;
        }, largeText);

        // Select all large text
        const selectAllKey = await getSelectAllModifier(page);
        await page.keyboard.press(selectAllKey);

        // Replace with newline
        await page.keyboard.press('Shift+Enter');

        const endTime = Date.now();
        const duration = endTime - startTime;

        const state = await getInputState(page);
        expect(state.value).toBe('\n');

        // Should complete in reasonable time (under 1 second)
        expect(duration).toBeLessThan(1000);
      });
    });

    it('should handle rapid key sequences without errors', async () => {
      await withBrowserTest(async (page) => {
        await setupTestInput(page, true);

        const selectAllKey = await getSelectAllModifier(page);

        // Rapid sequence: type, select, replace, repeat
        for (let i = 0; i < 10; i++) {
          await page.type('#test-input', `Text ${i}`);
          await page.keyboard.press(selectAllKey);
          await page.keyboard.press('Shift+Enter');
        }

        const state = await getInputState(page);
        expect(state.value).toBe('\n');
      });
    });
  });
});