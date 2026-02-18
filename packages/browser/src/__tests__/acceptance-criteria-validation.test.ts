import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BrowserSession } from '../browser-session';
import { BrowserConfig } from '../types';

describe('Element Interaction Actions - Acceptance Criteria Validation', () => {
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

  describe('Acceptance Criteria: Actions API with required methods', () => {
    it('should implement click(selector) method with element waiting', async () => {
      const html = `
        <div>
          <button id="test-button" onclick="this.textContent = 'Clicked'">Click Me</button>
          <script>
            // Simulate delayed element availability
            setTimeout(() => {
              const btn = document.createElement('button');
              btn.id = 'delayed-button';
              btn.textContent = 'Delayed Button';
              btn.onclick = () => btn.textContent = 'Delayed Clicked';
              document.body.appendChild(btn);
            }, 500);
          </script>
        </div>
      `;
      await session.navigate(`data:text/html,${html}`);

      // Test immediate click
      const immediateResult = await session.click('#test-button');
      expect(immediateResult.success).toBe(true);
      expect(typeof immediateResult.duration).toBe('number');

      // Test waiting for delayed element
      const delayedResult = await session.click('#delayed-button', { timeout: 3000 });
      expect(delayedResult.success).toBe(true);
      expect(delayedResult.duration).toBeGreaterThan(500);
    });

    it('should implement type(selector, text) method with element waiting', async () => {
      const html = `
        <div>
          <input id="immediate-input" type="text" placeholder="Immediate input">
          <script>
            setTimeout(() => {
              const input = document.createElement('input');
              input.id = 'delayed-input';
              input.type = 'text';
              input.placeholder = 'Delayed input';
              document.body.appendChild(input);
            }, 300);
          </script>
        </div>
      `;
      await session.navigate(`data:text/html,${html}`);

      // Test immediate typing
      const immediateResult = await session.type('#immediate-input', 'Immediate text');
      expect(immediateResult.success).toBe(true);
      expect(typeof immediateResult.duration).toBe('number');

      // Test waiting for delayed element
      const delayedResult = await session.type('#delayed-input', 'Delayed text', { timeout: 3000 });
      expect(delayedResult.success).toBe(true);
      expect(delayedResult.duration).toBeGreaterThan(300);
    });

    it('should implement scroll(options) method', async () => {
      const html = `
        <div style="height: 2000px; width: 2000px;">
          <div id="top" style="position: absolute; top: 0;">Top</div>
          <div id="middle" style="position: absolute; top: 1000px; left: 500px;">Middle</div>
          <div id="bottom" style="position: absolute; bottom: 0; right: 0;">Bottom</div>
        </div>
      `;
      await session.navigate(`data:text/html,${html}`);

      // Test coordinate-based scrolling
      const coordinateResult = await session.scroll({ x: 500, y: 1000 });
      expect(coordinateResult.success).toBe(true);
      expect(typeof coordinateResult.duration).toBe('number');

      // Test element-based scrolling
      const elementResult = await session.scroll({ selector: '#bottom' });
      expect(elementResult.success).toBe(true);

      // Test smooth scrolling
      const smoothResult = await session.scroll({ x: 0, y: 0, smooth: true });
      expect(smoothResult.success).toBe(true);
    });

    it('should implement hover(selector) method with element waiting', async () => {
      const html = `
        <div>
          <div id="hover-target"
               onmouseover="this.setAttribute('data-hovered', 'true')"
               style="width: 100px; height: 100px; background: blue;">
            Hover Me
          </div>
          <script>
            setTimeout(() => {
              const div = document.createElement('div');
              div.id = 'delayed-hover';
              div.style.width = '100px';
              div.style.height = '100px';
              div.style.background = 'green';
              div.onmouseover = () => div.setAttribute('data-delayed-hovered', 'true');
              document.body.appendChild(div);
            }, 400);
          </script>
        </div>
      `;
      await session.navigate(`data:text/html,${html}`);

      // Test immediate hover
      const immediateResult = await session.hover('#hover-target');
      expect(immediateResult.success).toBe(true);
      expect(typeof immediateResult.duration).toBe('number');

      // Verify hover event was triggered
      const hoverCheck = await session.evaluate(`
        document.getElementById('hover-target').getAttribute('data-hovered')
      `);
      expect(hoverCheck.result).toBe('true');

      // Test waiting for delayed element
      const delayedResult = await session.hover('#delayed-hover', { timeout: 3000 });
      expect(delayedResult.success).toBe(true);
      expect(delayedResult.duration).toBeGreaterThan(400);
    });

    it('should implement focus(selector) method with element waiting', async () => {
      const html = `
        <div>
          <input id="focus-input" type="text"
                 onfocus="this.setAttribute('data-focused', 'true')"
                 placeholder="Focus me">
          <script>
            setTimeout(() => {
              const input = document.createElement('input');
              input.id = 'delayed-focus';
              input.type = 'text';
              input.placeholder = 'Delayed focus';
              input.onfocus = () => input.setAttribute('data-delayed-focused', 'true');
              document.body.appendChild(input);
            }, 600);
          </script>
        </div>
      `;
      await session.navigate(`data:text/html,${html}`);

      // Test immediate focus
      const immediateResult = await session.focus('#focus-input');
      expect(immediateResult.success).toBe(true);
      expect(typeof immediateResult.duration).toBe('number');

      // Verify focus event was triggered
      const focusCheck = await session.evaluate(`
        document.getElementById('focus-input').getAttribute('data-focused')
      `);
      expect(focusCheck.result).toBe('true');

      // Test waiting for delayed element
      const delayedResult = await session.focus('#delayed-focus', { timeout: 3000 });
      expect(delayedResult.success).toBe(true);
      expect(delayedResult.duration).toBeGreaterThan(600);
    });
  });

  describe('Acceptance Criteria: Element waiting and visibility checks', () => {
    it('should wait for elements to become visible before interaction', async () => {
      const html = `
        <div>
          <button id="show-elements" onclick="showElements()">Show Elements</button>
          <div id="hidden-container" style="display: none;">
            <input id="hidden-input" type="text" placeholder="Hidden input">
            <button id="hidden-button">Hidden Button</button>
            <div id="hidden-hover" style="width: 100px; height: 100px; background: red;">Hidden Hover</div>
            <input id="hidden-focus" type="text" placeholder="Hidden focus">
          </div>
        </div>
        <script>
          function showElements() {
            setTimeout(() => {
              document.getElementById('hidden-container').style.display = 'block';
            }, 200);
          }
        </script>
      `;
      await session.navigate(`data:text/html,${html}`);

      // Trigger showing of elements
      await session.click('#show-elements');

      // All interactions should wait for visibility and succeed
      const typeResult = await session.type('#hidden-input', 'Now visible text', { timeout: 3000 });
      expect(typeResult.success).toBe(true);

      const clickResult = await session.click('#hidden-button', { timeout: 3000 });
      expect(clickResult.success).toBe(true);

      const hoverResult = await session.hover('#hidden-hover', { timeout: 3000 });
      expect(hoverResult.success).toBe(true);

      const focusResult = await session.focus('#hidden-focus', { timeout: 3000 });
      expect(focusResult.success).toBe(true);
    });

    it('should handle opacity-based visibility changes', async () => {
      const html = `
        <div>
          <button id="fade-in" onclick="fadeInElements()">Fade In</button>
          <div id="fade-container" style="opacity: 0; transition: opacity 0.5s;">
            <button id="fade-button">Fade Button</button>
            <input id="fade-input" type="text" placeholder="Fade input">
          </div>
        </div>
        <script>
          function fadeInElements() {
            setTimeout(() => {
              document.getElementById('fade-container').style.opacity = '1';
            }, 100);
          }
        </script>
      `;
      await session.navigate(`data:text/html,${html}`);

      await session.click('#fade-in');

      // Should wait for opacity transition
      const clickResult = await session.click('#fade-button', { timeout: 3000 });
      expect(clickResult.success).toBe(true);

      const typeResult = await session.type('#fade-input', 'Faded in text', { timeout: 3000 });
      expect(typeResult.success).toBe(true);
    });

    it('should automatically scroll elements into view when needed', async () => {
      const html = `
        <div style="height: 3000px;">
          <div id="top-section">Top of page</div>
          <div id="bottom-section" style="position: absolute; bottom: 50px;">
            <input id="bottom-input" type="text" placeholder="Bottom input">
            <button id="bottom-button">Bottom Button</button>
            <div id="bottom-hover" style="width: 100px; height: 100px; background: green;">Bottom Hover</div>
          </div>
        </div>
      `;
      await session.navigate(`data:text/html,${html}`);

      // These should automatically scroll elements into view
      const typeResult = await session.type('#bottom-input', 'Bottom text');
      expect(typeResult.success).toBe(true);

      const clickResult = await session.click('#bottom-button');
      expect(clickResult.success).toBe(true);

      const hoverResult = await session.hover('#bottom-hover');
      expect(hoverResult.success).toBe(true);
    });
  });

  describe('Acceptance Criteria: Comprehensive error handling', () => {
    it('should handle timeouts gracefully for all methods', async () => {
      const html = `<div>No target elements exist</div>`;
      await session.navigate(`data:text/html,${html}`);

      const shortTimeout = { timeout: 500 };

      // All methods should timeout gracefully with proper error messages
      const clickResult = await session.click('#nonexistent', shortTimeout);
      expect(clickResult.success).toBe(false);
      expect(clickResult.error).toBeDefined();
      expect(clickResult.duration).toBeGreaterThanOrEqual(500);

      const typeResult = await session.type('#nonexistent', 'text', shortTimeout);
      expect(typeResult.success).toBe(false);
      expect(typeResult.error).toBeDefined();
      expect(typeResult.duration).toBeGreaterThanOrEqual(500);

      const hoverResult = await session.hover('#nonexistent', shortTimeout);
      expect(hoverResult.success).toBe(false);
      expect(hoverResult.error).toBeDefined();
      expect(hoverResult.duration).toBeGreaterThanOrEqual(500);

      const focusResult = await session.focus('#nonexistent', shortTimeout);
      expect(focusResult.success).toBe(false);
      expect(focusResult.error).toBeDefined();
      expect(focusResult.duration).toBeGreaterThanOrEqual(500);
    });

    it('should handle browser not launched errors for all methods', async () => {
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

    it('should handle invalid selector errors', async () => {
      await session.navigate('data:text/html,<div>Test</div>');

      const invalidSelectors = ['', '   ', null as any, undefined as any];

      for (const selector of invalidSelectors) {
        const clickResult = await session.click(selector);
        expect(clickResult.success).toBe(false);
        expect(clickResult.error).toBeDefined();

        const typeResult = await session.type(selector, 'text');
        expect(typeResult.success).toBe(false);
        expect(typeResult.error).toBeDefined();

        const hoverResult = await session.hover(selector);
        expect(hoverResult.success).toBe(false);
        expect(hoverResult.error).toBeDefined();

        const focusResult = await session.focus(selector);
        expect(focusResult.success).toBe(false);
        expect(focusResult.error).toBeDefined();
      }
    });
  });

  describe('Acceptance Criteria: Consistent API response format', () => {
    it('should return BrowserActionResult with consistent structure', async () => {
      const html = `
        <div>
          <button id="test-btn">Test Button</button>
          <input id="test-input" type="text">
          <div id="hover-target" style="width: 100px; height: 100px;"></div>
        </div>
      `;
      await session.navigate(`data:text/html,${html}`);

      // Test successful results have consistent structure
      const clickResult = await session.click('#test-btn');
      expect(clickResult).toHaveProperty('success');
      expect(clickResult).toHaveProperty('duration');
      expect(clickResult.success).toBe(true);
      expect(typeof clickResult.duration).toBe('number');

      const typeResult = await session.type('#test-input', 'test text');
      expect(typeResult).toHaveProperty('success');
      expect(typeResult).toHaveProperty('duration');
      expect(typeResult.success).toBe(true);
      expect(typeof typeResult.duration).toBe('number');

      const scrollResult = await session.scroll({ x: 0, y: 100 });
      expect(scrollResult).toHaveProperty('success');
      expect(scrollResult).toHaveProperty('duration');
      expect(scrollResult.success).toBe(true);
      expect(typeof scrollResult.duration).toBe('number');

      const hoverResult = await session.hover('#hover-target');
      expect(hoverResult).toHaveProperty('success');
      expect(hoverResult).toHaveProperty('duration');
      expect(hoverResult.success).toBe(true);
      expect(typeof hoverResult.duration).toBe('number');

      const focusResult = await session.focus('#test-input');
      expect(focusResult).toHaveProperty('success');
      expect(focusResult).toHaveProperty('duration');
      expect(focusResult.success).toBe(true);
      expect(typeof focusResult.duration).toBe('number');
    });

    it('should return consistent error result structure', async () => {
      await session.navigate('data:text/html,<div>Test</div>');

      // Test failed results have consistent structure
      const clickResult = await session.click('#nonexistent', { timeout: 100 });
      expect(clickResult).toHaveProperty('success');
      expect(clickResult).toHaveProperty('duration');
      expect(clickResult).toHaveProperty('error');
      expect(clickResult.success).toBe(false);
      expect(typeof clickResult.duration).toBe('number');
      expect(typeof clickResult.error).toBe('string');

      const typeResult = await session.type('#nonexistent', 'text', { timeout: 100 });
      expect(typeResult).toHaveProperty('success');
      expect(typeResult).toHaveProperty('duration');
      expect(typeResult).toHaveProperty('error');
      expect(typeResult.success).toBe(false);
      expect(typeof typeResult.duration).toBe('number');
      expect(typeof typeResult.error).toBe('string');
    });
  });

  describe('Acceptance Criteria: Integration workflow validation', () => {
    it('should handle complete user interaction workflows', async () => {
      const html = `
        <div>
          <h1>User Registration</h1>
          <form id="registration-form">
            <div>
              <label for="username">Username:</label>
              <input id="username" type="text" required>
            </div>
            <div>
              <label for="email">Email:</label>
              <input id="email" type="email" required>
            </div>
            <div>
              <label for="password">Password:</label>
              <input id="password" type="password" required>
            </div>
            <div>
              <label>
                <input id="terms" type="checkbox" required> I agree to terms
              </label>
            </div>
            <div>
              <button id="submit-btn" type="submit" onclick="handleSubmit(event)">Register</button>
            </div>
          </form>
          <div id="result" style="margin-top: 20px;"></div>
        </div>
        <script>
          function handleSubmit(event) {
            event.preventDefault();
            const form = document.getElementById('registration-form');
            const formData = new FormData(form);
            const result = document.getElementById('result');

            if (formData.get('username') && formData.get('email') &&
                formData.get('password') && formData.get('terms')) {
              result.textContent = 'Registration Successful!';
              result.style.color = 'green';
            } else {
              result.textContent = 'Please fill all fields';
              result.style.color = 'red';
            }
          }
        </script>
      `;
      await session.navigate(`data:text/html,${html}`);

      // Complete registration workflow using all interaction methods

      // Focus and fill username
      await session.focus('#username');
      await session.type('#username', 'testuser123');

      // Focus and fill email
      await session.focus('#email');
      await session.type('#email', 'test@example.com');

      // Focus and fill password
      await session.focus('#password');
      await session.type('#password', 'SecurePassword123!');

      // Hover over terms checkbox before clicking
      await session.hover('#terms');
      await session.click('#terms');

      // Scroll to submit button if needed and hover before clicking
      await session.scroll({ selector: '#submit-btn' });
      await session.hover('#submit-btn');
      await session.click('#submit-btn');

      // Verify successful registration
      const result = await session.evaluate(`
        document.getElementById('result').textContent
      `);
      expect(result.result).toBe('Registration Successful!');
    });

    it('should handle dynamic content interaction sequences', async () => {
      const html = `
        <div>
          <button id="load-content" onclick="loadDynamicContent()">Load Dynamic Content</button>
          <div id="dynamic-container"></div>
        </div>
        <script>
          function loadDynamicContent() {
            setTimeout(() => {
              const container = document.getElementById('dynamic-container');
              container.innerHTML = \`
                <div id="step1">
                  <h3>Step 1</h3>
                  <input id="step1-input" type="text" placeholder="Enter something">
                  <button id="step1-next" onclick="loadStep2()">Next</button>
                </div>
              \`;
            }, 300);
          }

          function loadStep2() {
            const container = document.getElementById('dynamic-container');
            container.innerHTML = \`
              <div id="step2">
                <h3>Step 2</h3>
                <div id="hover-area" style="width: 200px; height: 100px; background: lightblue;
                     text-align: center; line-height: 100px;"
                     onmouseover="this.style.background='lightgreen'"
                     onclick="loadStep3()">
                  Hover and Click Me
                </div>
              </div>
            \`;
          }

          function loadStep3() {
            const container = document.getElementById('dynamic-container');
            container.innerHTML = \`
              <div id="step3">
                <h3>Step 3 - Complete!</h3>
                <input id="final-focus" type="text" placeholder="Final input">
                <button id="finish" onclick="this.textContent='Finished!'">Finish</button>
              </div>
            \`;
          }
        </script>
      `;
      await session.navigate(`data:text/html,${html}`);

      // Start the dynamic content workflow
      await session.click('#load-content');

      // Step 1: Wait for content to load and interact
      await session.type('#step1-input', 'Step 1 data', { timeout: 3000 });
      await session.click('#step1-next');

      // Step 2: Hover and click dynamic element
      await session.hover('#hover-area', { timeout: 2000 });
      await session.click('#hover-area');

      // Step 3: Focus and interact with final elements
      await session.focus('#final-focus', { timeout: 2000 });
      await session.type('#final-focus', 'Final step data');
      await session.click('#finish');

      // Verify completion
      const result = await session.evaluate(`
        document.getElementById('finish').textContent
      `);
      expect(result.result).toBe('Finished!');
    });
  });
});