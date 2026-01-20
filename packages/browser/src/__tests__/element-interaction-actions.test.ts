import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BrowserSession } from '../browser-session';
import { BrowserConfig } from '../types';

describe('Element Interaction Actions', () => {
  let session: BrowserSession;
  const config: BrowserConfig = {
    headless: true,
    timeout: 30000,
    browserType: 'chromium'
  };

  beforeEach(async () => {
    session = new BrowserSession(config);
    await session.launch();
  });

  afterEach(async () => {
    await session.close();
  });

  describe('click() method', () => {
    it('should click on elements with different selector types', async () => {
      const html = `
        <div>
          <button id="btn1" onclick="this.textContent = 'Clicked'">Button 1</button>
          <button class="test-btn" onclick="this.textContent = 'Class Clicked'">Button 2</button>
          <button data-testid="btn3" onclick="this.textContent = 'Data Clicked'">Button 3</button>
        </div>
      `;
      await session.navigate(`data:text/html,${html}`);

      // Test ID selector
      const result1 = await session.click('#btn1');
      expect(result1.success).toBe(true);
      expect(typeof result1.duration).toBe('number');

      // Test class selector
      const result2 = await session.click('.test-btn');
      expect(result2.success).toBe(true);

      // Test data-testid selector
      const result3 = await session.click('[data-testid="btn3"]');
      expect(result3.success).toBe(true);
    });

    it('should handle click with timeout and modifiers', async () => {
      const html = `
        <button id="test-btn" onclick="this.textContent = 'Modified Click'">Test Button</button>
      `;
      await session.navigate(`data:text/html,${html}`);

      const result = await session.click('#test-btn', {
        timeout: 5000,
        button: 'left',
        clickCount: 1
      });
      expect(result.success).toBe(true);
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should handle element waiting before click', async () => {
      const html = `
        <div id="container">
          <script>
            setTimeout(() => {
              const btn = document.createElement('button');
              btn.id = 'delayed-btn';
              btn.textContent = 'Delayed Button';
              btn.onclick = () => btn.textContent = 'Delayed Clicked';
              document.getElementById('container').appendChild(btn);
            }, 100);
          </script>
        </div>
      `;
      await session.navigate(`data:text/html,${html}`);

      const result = await session.click('#delayed-btn', { timeout: 3000 });
      expect(result.success).toBe(true);
    });

    it('should fail gracefully when element is not clickable', async () => {
      const html = `
        <div id="hidden" style="display: none;">Hidden Element</div>
      `;
      await session.navigate(`data:text/html,${html}`);

      const result = await session.click('#hidden');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle ElementSelector object', async () => {
      const html = `<button id="test-btn">Test Button</button>`;
      await session.navigate(`data:text/html,${html}`);

      const result = await session.click({
        type: 'selector',
        value: '#test-btn'
      });
      expect(result.success).toBe(true);
    });
  });

  describe('type() method', () => {
    it('should type text into various input elements', async () => {
      const html = `
        <div>
          <input id="text-input" type="text" placeholder="Enter text">
          <textarea id="textarea" placeholder="Enter text area content"></textarea>
          <input id="email-input" type="email" placeholder="Enter email">
          <input id="password-input" type="password" placeholder="Enter password">
        </div>
      `;
      await session.navigate(`data:text/html,${html}`);

      // Test text input
      const result1 = await session.type('#text-input', 'Hello World');
      expect(result1.success).toBe(true);

      // Test textarea
      const result2 = await session.type('#textarea', 'This is a long text\nwith line breaks');
      expect(result2.success).toBe(true);

      // Test email input
      const result3 = await session.type('#email-input', 'test@example.com');
      expect(result3.success).toBe(true);

      // Test password input
      const result4 = await session.type('#password-input', 'secretPassword123');
      expect(result4.success).toBe(true);
    });

    it('should handle typing with delay option', async () => {
      const html = `<input id="slow-input" type="text">`;
      await session.navigate(`data:text/html,${html}`);

      const startTime = Date.now();
      const result = await session.type('#slow-input', 'Slow typing', { delay: 50 });
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeGreaterThan(500); // Should take at least 500ms for 10 chars with 50ms delay
    });

    it('should clear input before typing when specified', async () => {
      const html = `<input id="pre-filled" type="text" value="Pre-existing text">`;
      await session.navigate(`data:text/html,${html}`);

      const result = await session.type('#pre-filled', 'New text', { clear: true });
      expect(result.success).toBe(true);
    });

    it('should handle special characters and unicode', async () => {
      const html = `<input id="unicode-input" type="text">`;
      await session.navigate(`data:text/html,${html}`);

      const specialText = 'Special: !@#$%^&*()_+ 中文 😀 🚀';
      const result = await session.type('#unicode-input', specialText);
      expect(result.success).toBe(true);
    });

    it('should fail when element is not typeable', async () => {
      const html = `<div id="not-input">Not an input</div>`;
      await session.navigate(`data:text/html,${html}`);

      const result = await session.type('#not-input', 'This should fail');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle typing into content-editable elements', async () => {
      const html = `<div id="editable" contenteditable="true">Edit me</div>`;
      await session.navigate(`data:text/html,${html}`);

      const result = await session.type('#editable', 'New content');
      expect(result.success).toBe(true);
    });
  });

  describe('scroll() method', () => {
    it('should scroll page to specific coordinates', async () => {
      const html = `
        <div style="height: 2000px; width: 2000px;">
          <div id="top">Top of page</div>
          <div id="bottom" style="position: absolute; bottom: 0;">Bottom of page</div>
        </div>
      `;
      await session.navigate(`data:text/html,${html}`);

      // Scroll down
      const result1 = await session.scroll({ x: 0, y: 1000 });
      expect(result1.success).toBe(true);

      // Scroll right
      const result2 = await session.scroll({ x: 500, y: 1000 });
      expect(result2.success).toBe(true);
    });

    it('should scroll specific element into view', async () => {
      const html = `
        <div style="height: 2000px;">
          <div id="top">Top of page</div>
          <div id="middle" style="margin-top: 1500px;">Middle element</div>
          <div id="bottom" style="margin-top: 500px;">Bottom of page</div>
        </div>
      `;
      await session.navigate(`data:text/html,${html}`);

      const result = await session.scroll({ selector: '#middle' });
      expect(result.success).toBe(true);
    });

    it('should handle smooth scrolling', async () => {
      const html = `
        <div style="height: 2000px;">
          <div id="content">Scrollable content</div>
        </div>
      `;
      await session.navigate(`data:text/html,${html}`);

      const result = await session.scroll({ x: 0, y: 500, smooth: true });
      expect(result.success).toBe(true);
    });

    it('should scroll with ElementSelector object', async () => {
      const html = `
        <div style="height: 2000px;">
          <div id="target" style="margin-top: 1500px;">Target element</div>
        </div>
      `;
      await session.navigate(`data:text/html,${html}`);

      const result = await session.scroll({
        selector: { type: 'selector', value: '#target' }
      });
      expect(result.success).toBe(true);
    });

    it('should handle scroll with no parameters (scroll to top)', async () => {
      const html = `<div style="height: 2000px;">Long content</div>`;
      await session.navigate(`data:text/html,${html}`);

      // First scroll down
      await session.scroll({ y: 1000 });

      // Then scroll with no parameters
      const result = await session.scroll();
      expect(result.success).toBe(true);
    });
  });

  describe('hover() method', () => {
    it('should hover over different element types', async () => {
      const html = `
        <div>
          <button id="btn-hover" onmouseover="this.style.background='red'">Hover Button</button>
          <div id="div-hover" onmouseover="this.textContent='Hovered'" style="width:100px;height:100px;">Hover Div</div>
          <a id="link-hover" href="#" onmouseover="this.style.color='blue'">Hover Link</a>
        </div>
      `;
      await session.navigate(`data:text/html,${html}`);

      const result1 = await session.hover('#btn-hover');
      expect(result1.success).toBe(true);

      const result2 = await session.hover('#div-hover');
      expect(result2.success).toBe(true);

      const result3 = await session.hover('#link-hover');
      expect(result3.success).toBe(true);
    });

    it('should handle hover with timeout and force options', async () => {
      const html = `
        <div id="hover-target" style="width: 100px; height: 100px; background: blue;">
          Hover target
        </div>
      `;
      await session.navigate(`data:text/html,${html}`);

      const result = await session.hover('#hover-target', {
        timeout: 5000,
        force: true
      });
      expect(result.success).toBe(true);
    });

    it('should trigger hover events correctly', async () => {
      const html = `
        <div id="hover-element"
             onmouseover="this.setAttribute('data-hovered', 'true')"
             style="width: 100px; height: 100px; background: green;">
          Hover me
        </div>
      `;
      await session.navigate(`data:text/html,${html}`);

      const result = await session.hover('#hover-element');
      expect(result.success).toBe(true);

      // Verify the hover event was triggered by checking if attribute was set
      const hasAttribute = await session.evaluate(`
        document.getElementById('hover-element').hasAttribute('data-hovered')
      `);
      expect(hasAttribute.success).toBe(true);
      expect(hasAttribute.result).toBe(true);
    });

    it('should handle hover on hidden elements with force option', async () => {
      const html = `
        <div id="hidden-hover" style="opacity: 0; width: 100px; height: 100px;">
          Hidden but hoverable with force
        </div>
      `;
      await session.navigate(`data:text/html,${html}`);

      const result = await session.hover('#hidden-hover', { force: true });
      expect(result.success).toBe(true);
    });

    it('should hover using ElementSelector object', async () => {
      const html = `
        <div id="selector-hover" style="width: 100px; height: 100px;">
          Hover target
        </div>
      `;
      await session.navigate(`data:text/html,${html}`);

      const result = await session.hover({
        type: 'selector',
        value: '#selector-hover'
      });
      expect(result.success).toBe(true);
    });
  });

  describe('focus() method', () => {
    it('should focus on different focusable elements', async () => {
      const html = `
        <div>
          <input id="text-focus" type="text" onfocus="this.style.border='2px solid blue'">
          <textarea id="textarea-focus" onfocus="this.style.background='lightblue'"></textarea>
          <button id="button-focus" onfocus="this.style.outline='2px solid red'">Focus Button</button>
          <a id="link-focus" href="#" onfocus="this.style.color='purple'">Focus Link</a>
          <div id="tabindex-focus" tabindex="0" onfocus="this.textContent='Focused'">Focusable Div</div>
        </div>
      `;
      await session.navigate(`data:text/html,${html}`);

      const result1 = await session.focus('#text-focus');
      expect(result1.success).toBe(true);

      const result2 = await session.focus('#textarea-focus');
      expect(result2.success).toBe(true);

      const result3 = await session.focus('#button-focus');
      expect(result3.success).toBe(true);

      const result4 = await session.focus('#link-focus');
      expect(result4.success).toBe(true);

      const result5 = await session.focus('#tabindex-focus');
      expect(result5.success).toBe(true);
    });

    it('should handle focus with timeout option', async () => {
      const html = `
        <input id="delayed-focus" type="text" style="visibility: hidden;">
        <script>
          setTimeout(() => {
            document.getElementById('delayed-focus').style.visibility = 'visible';
          }, 500);
        </script>
      `;
      await session.navigate(`data:text/html,${html}`);

      const result = await session.focus('#delayed-focus', { timeout: 3000 });
      expect(result.success).toBe(true);
    });

    it('should trigger focus events correctly', async () => {
      const html = `
        <input id="focus-element"
               type="text"
               onfocus="this.setAttribute('data-focused', 'true')"
               onblur="this.setAttribute('data-blurred', 'true')">
      `;
      await session.navigate(`data:text/html,${html}`);

      const result = await session.focus('#focus-element');
      expect(result.success).toBe(true);

      // Verify focus event was triggered
      const hasFocusAttribute = await session.evaluate(`
        document.getElementById('focus-element').hasAttribute('data-focused')
      `);
      expect(hasFocusAttribute.result).toBe(true);
    });

    it('should fail on non-focusable elements', async () => {
      const html = `<div id="not-focusable">Cannot focus</div>`;
      await session.navigate(`data:text/html,${html}`);

      const result = await session.focus('#not-focusable');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should focus using ElementSelector object', async () => {
      const html = `<input id="selector-focus" type="text">`;
      await session.navigate(`data:text/html,${html}`);

      const result = await session.focus({
        type: 'selector',
        value: '#selector-focus'
      });
      expect(result.success).toBe(true);
    });

    it('should handle focus sequence across multiple elements', async () => {
      const html = `
        <div>
          <input id="input1" type="text">
          <input id="input2" type="text">
          <input id="input3" type="text">
        </div>
      `;
      await session.navigate(`data:text/html,${html}`);

      // Focus elements in sequence
      const result1 = await session.focus('#input1');
      expect(result1.success).toBe(true);

      const result2 = await session.focus('#input2');
      expect(result2.success).toBe(true);

      const result3 = await session.focus('#input3');
      expect(result3.success).toBe(true);
    });
  });

  describe('Element state verification', () => {
    it('should verify element visibility states', async () => {
      const html = `
        <div>
          <button id="visibleBtn" style="display: block;">Visible Button</button>
          <button id="hiddenBtn" style="display: none;">Hidden Button</button>
          <button id="invisibleBtn" style="visibility: hidden;">Invisible Button</button>
        </div>
      `;
      await session.navigate(`data:text/html,${html}`);

      // Test visible element can be found
      const visibleResult = await session.waitForElement('#visibleBtn', {
        state: 'visible',
        timeout: 3000
      });
      expect(visibleResult.success).toBe(true);

      // Test hidden element cannot be found in visible state
      const hiddenResult = await session.waitForElement('#hiddenBtn', {
        state: 'visible',
        timeout: 1000
      });
      expect(hiddenResult.success).toBe(false);
    });

    it('should verify element enabled/disabled states', async () => {
      const html = `
        <div>
          <button id="enabledBtn">Enabled Button</button>
          <button id="disabledBtn" disabled>Disabled Button</button>
          <input id="enabledInput" type="text" />
          <input id="disabledInput" type="text" disabled />
        </div>
      `;
      await session.navigate(`data:text/html,${html}`);

      // Test clicking enabled vs disabled elements
      const enabledClick = await session.click('#enabledBtn');
      expect(enabledClick.success).toBe(true);

      const disabledClick = await session.click('#disabledBtn');
      expect(disabledClick.success).toBe(false);

      // Test typing into enabled vs disabled inputs
      const enabledType = await session.type('#enabledInput', 'test');
      expect(enabledType.success).toBe(true);

      const disabledType = await session.type('#disabledInput', 'test');
      expect(disabledType.success).toBe(false);
    });

    it('should handle dynamic state changes', async () => {
      const html = `
        <div>
          <button id="toggleBtn" onclick="
            const target = document.getElementById('targetBtn');
            target.disabled = !target.disabled;
          ">Toggle State</button>
          <button id="targetBtn">Target Button</button>
        </div>
      `;
      await session.navigate(`data:text/html,${html}`);

      // Initial state - should be clickable
      const initialClick = await session.click('#targetBtn');
      expect(initialClick.success).toBe(true);

      // Toggle to disabled
      await session.click('#toggleBtn');

      // Should now fail to click
      const disabledClick = await session.click('#targetBtn');
      expect(disabledClick.success).toBe(false);

      // Toggle back to enabled
      await session.click('#toggleBtn');

      // Should be clickable again
      const reenableddClick = await session.click('#targetBtn');
      expect(reenableddClick.success).toBe(true);
    });
  });

  describe('Select option functionality', () => {
    it('should handle dropdown selections', async () => {
      const html = `
        <div>
          <select id="dropdown">
            <option value="">Select option</option>
            <option value="option1">Option 1</option>
            <option value="option2">Option 2</option>
            <option value="option3">Option 3</option>
          </select>
          <div id="selected"></div>
          <script>
            document.getElementById('dropdown').onchange = function() {
              document.getElementById('selected').textContent = this.value;
            }
          </script>
        </div>
      `;
      await session.navigate(`data:text/html,${html}`);

      // Select option by evaluating JavaScript directly
      await session.evaluate(`
        const dropdown = document.getElementById('dropdown');
        dropdown.value = 'option1';
        dropdown.dispatchEvent(new Event('change', { bubbles: true }));
      `);

      // Verify selection was made
      const selectedValue = await session.evaluate(`
        document.getElementById('dropdown').value
      `);
      expect(selectedValue.result).toBe('option1');
    });

    it('should handle checkbox state changes', async () => {
      const html = `
        <div>
          <input type="checkbox" id="checkbox" onchange="
            document.getElementById('status').textContent = this.checked ? 'checked' : 'unchecked';
          " />
          <label for="checkbox">Test Checkbox</label>
          <div id="status">unchecked</div>
        </div>
      `;
      await session.navigate(`data:text/html,${html}`);

      // Check the checkbox
      await session.click('#checkbox');

      const checkedStatus = await session.evaluate(`
        document.getElementById('status').textContent
      `);
      expect(checkedStatus.result).toBe('checked');

      // Uncheck the checkbox
      await session.click('#checkbox');

      const uncheckedStatus = await session.evaluate(`
        document.getElementById('status').textContent
      `);
      expect(uncheckedStatus.result).toBe('unchecked');
    });
  });

  describe('Integration tests for element interactions', () => {
    it('should perform complex interaction sequences', async () => {
      const html = `
        <div>
          <input id="username" type="text" placeholder="Username">
          <input id="password" type="password" placeholder="Password">
          <button id="login-btn" onclick="
            const user = document.getElementById('username').value;
            const pass = document.getElementById('password').value;
            if (user && pass) {
              document.getElementById('result').textContent = 'Login Success';
            }
          ">Login</button>
          <div id="result"></div>
        </div>
      `;
      await session.navigate(`data:text/html,${html}`);

      // Complete login flow
      await session.focus('#username');
      await session.type('#username', 'testuser');

      await session.focus('#password');
      await session.type('#password', 'testpass');

      await session.hover('#login-btn');
      await session.click('#login-btn');

      // Verify the interaction sequence worked
      const result = await session.evaluate(`
        document.getElementById('result').textContent
      `);
      expect(result.result).toBe('Login Success');
    });

    it('should handle rapid successive interactions', async () => {
      const html = `
        <div>
          <button id="counter" onclick="
            const current = parseInt(this.textContent) || 0;
            this.textContent = current + 1;
          ">0</button>
        </div>
      `;
      await session.navigate(`data:text/html,${html}`);

      // Perform multiple rapid clicks
      for (let i = 0; i < 5; i++) {
        const result = await session.click('#counter');
        expect(result.success).toBe(true);
      }

      // Verify final count
      const finalCount = await session.evaluate(`
        document.getElementById('counter').textContent
      `);
      expect(finalCount.result).toBe('5');
    });

    it('should handle interactions with dynamically created elements', async () => {
      const html = `
        <div id="container">
          <button id="create-btn" onclick="
            const newInput = document.createElement('input');
            newInput.id = 'dynamic-input';
            newInput.type = 'text';
            newInput.placeholder = 'Dynamic input';
            this.parentNode.appendChild(newInput);
            this.style.display = 'none';
          ">Create Input</button>
        </div>
      `;
      await session.navigate(`data:text/html,${html}`);

      // Click to create element
      await session.click('#create-btn');

      // Wait and interact with dynamically created element
      const typeResult = await session.type('#dynamic-input', 'Dynamic text', { timeout: 3000 });
      expect(typeResult.success).toBe(true);
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle browser not launched error for all interaction methods', async () => {
      const closedSession = new BrowserSession(config);

      const clickResult = await closedSession.click('#test');
      expect(clickResult.success).toBe(false);
      expect(clickResult.error).toContain('browser');

      const typeResult = await closedSession.type('#test', 'text');
      expect(typeResult.success).toBe(false);
      expect(typeResult.error).toContain('browser');

      const scrollResult = await closedSession.scroll();
      expect(scrollResult.success).toBe(false);
      expect(scrollResult.error).toContain('browser');

      const hoverResult = await closedSession.hover('#test');
      expect(hoverResult.success).toBe(false);
      expect(hoverResult.error).toContain('browser');

      const focusResult = await closedSession.focus('#test');
      expect(focusResult.success).toBe(false);
      expect(focusResult.error).toContain('browser');
    });

    it('should handle invalid selectors gracefully', async () => {
      await session.navigate('data:text/html,<div>Test</div>');

      const invalidSelectors = ['', '   ', 'invalid..selector', '###bad'];

      for (const selector of invalidSelectors) {
        const clickResult = await session.click(selector);
        expect(clickResult.success).toBe(false);

        const typeResult = await session.type(selector, 'text');
        expect(typeResult.success).toBe(false);

        const hoverResult = await session.hover(selector);
        expect(hoverResult.success).toBe(false);

        const focusResult = await session.focus(selector);
        expect(focusResult.success).toBe(false);
      }
    });

    it('should handle timeout scenarios for all actions', async () => {
      await session.navigate('data:text/html,<div>No target elements</div>');

      const shortTimeout = { timeout: 100 };

      const clickResult = await session.click('#nonexistent', shortTimeout);
      expect(clickResult.success).toBe(false);
      expect(clickResult.duration).toBeGreaterThan(100);

      const typeResult = await session.type('#nonexistent', 'text', shortTimeout);
      expect(typeResult.success).toBe(false);

      const hoverResult = await session.hover('#nonexistent', shortTimeout);
      expect(hoverResult.success).toBe(false);

      const focusResult = await session.focus('#nonexistent', shortTimeout);
      expect(focusResult.success).toBe(false);
    });

    it('should handle interactions with iframe elements', async () => {
      const html = `
        <iframe id="test-frame" src="data:text/html,
          <button id='frame-button' onclick='this.textContent=\\'Frame Clicked\\''>Frame Button</button>
        "></iframe>
      `;
      await session.navigate(`data:text/html,${html}`);

      // Note: This tests the error handling for iframe interactions
      // In a real scenario, you'd need to switch to the frame context first
      const result = await session.click('#frame-button');
      expect(result.success).toBe(false); // Expected to fail without frame switching
    });
  });

  describe('Performance and timing tests', () => {
    it('should complete interactions within reasonable time limits', async () => {
      const html = `
        <div>
          <input id="perf-input" type="text">
          <button id="perf-button">Button</button>
        </div>
      `;
      await session.navigate(`data:text/html,${html}`);

      const startTime = Date.now();

      await session.click('#perf-button');
      await session.type('#perf-input', 'Performance test');
      await session.hover('#perf-button');
      await session.focus('#perf-input');

      const totalTime = Date.now() - startTime;
      expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should provide accurate duration measurements', async () => {
      const html = `<button id="duration-test">Test Button</button>`;
      await session.navigate(`data:text/html,${html}`);

      const result = await session.click('#duration-test');
      expect(result.duration).toBeGreaterThan(0);
      expect(result.duration).toBeLessThan(1000); // Should be sub-second for simple click
    });
  });
});