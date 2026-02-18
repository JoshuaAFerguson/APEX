import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BrowserSession } from '../browser-session';
import { BrowserConfig } from '../types';

describe('Element Visibility and Waiting Tests', () => {
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

  describe('Element waiting and visibility checks', () => {
    it('should wait for elements to become visible before interaction', async () => {
      const html = `
        <div>
          <button id="show-btn" onclick="
            document.getElementById('hidden-element').style.display = 'block';
          ">Show Element</button>
          <div id="hidden-element" style="display: none;">
            <input id="hidden-input" type="text">
            <button id="hidden-button">Hidden Button</button>
          </div>
        </div>
      `;
      await session.navigate(`data:text/html,${html}`);

      // First show the hidden element
      await session.click('#show-btn');

      // Now interactions with previously hidden elements should work
      const typeResult = await session.type('#hidden-input', 'Now visible');
      expect(typeResult.success).toBe(true);

      const clickResult = await session.click('#hidden-button');
      expect(clickResult.success).toBe(true);
    });

    it('should handle elements becoming available after delay', async () => {
      const html = `
        <div id="container">
          <script>
            setTimeout(() => {
              const input = document.createElement('input');
              input.id = 'delayed-input';
              input.type = 'text';
              input.placeholder = 'Delayed input';
              document.getElementById('container').appendChild(input);
            }, 1000);

            setTimeout(() => {
              const button = document.createElement('button');
              button.id = 'delayed-button';
              button.textContent = 'Delayed Button';
              document.getElementById('container').appendChild(button);
            }, 1500);
          </script>
        </div>
      `;
      await session.navigate(`data:text/html,${html}`);

      // These should wait for elements to appear
      const typeResult = await session.type('#delayed-input', 'Delayed text', { timeout: 5000 });
      expect(typeResult.success).toBe(true);

      const clickResult = await session.click('#delayed-button', { timeout: 5000 });
      expect(clickResult.success).toBe(true);
    });

    it('should handle opacity transitions for visibility', async () => {
      const html = `
        <div>
          <button id="fade-trigger" onclick="
            const target = document.getElementById('fade-target');
            target.style.transition = 'opacity 0.5s';
            target.style.opacity = '1';
          ">Fade In</button>
          <div id="fade-target" style="opacity: 0; width: 100px; height: 100px; background: blue;">
            <button id="fade-button">Fade Button</button>
          </div>
        </div>
      `;
      await session.navigate(`data:text/html,${html}`);

      await session.click('#fade-trigger');

      // Should wait for the element to become visible (opacity > 0)
      const hoverResult = await session.hover('#fade-target', { timeout: 3000 });
      expect(hoverResult.success).toBe(true);

      const clickResult = await session.click('#fade-button', { timeout: 3000 });
      expect(clickResult.success).toBe(true);
    });

    it('should handle elements outside viewport that need scrolling', async () => {
      const html = `
        <div style="height: 3000px;">
          <div id="top-element">Top of page</div>
          <div id="bottom-element" style="position: absolute; bottom: 100px;">
            <input id="bottom-input" type="text" placeholder="Bottom input">
            <button id="bottom-button">Bottom Button</button>
          </div>
        </div>
      `;
      await session.navigate(`data:text/html,${html}`);

      // These should automatically scroll elements into view
      const typeResult = await session.type('#bottom-input', 'Bottom text');
      expect(typeResult.success).toBe(true);

      const clickResult = await session.click('#bottom-button');
      expect(clickResult.success).toBe(true);

      const hoverResult = await session.hover('#bottom-input');
      expect(hoverResult.success).toBe(true);
    });

    it('should handle elements with transform animations', async () => {
      const html = `
        <style>
          .sliding {
            transform: translateX(-100%);
            transition: transform 1s ease-in-out;
          }
          .sliding.visible {
            transform: translateX(0);
          }
        </style>
        <div>
          <button id="slide-trigger" onclick="
            document.getElementById('sliding-element').classList.add('visible');
          ">Slide In</button>
          <div id="sliding-element" class="sliding" style="width: 200px; height: 100px; background: green;">
            <button id="sliding-button">Sliding Button</button>
          </div>
        </div>
      `;
      await session.navigate(`data:text/html,${html}`);

      await session.click('#slide-trigger');

      // Should wait for the animation to complete before interaction
      const clickResult = await session.click('#sliding-button', { timeout: 5000 });
      expect(clickResult.success).toBe(true);
    });

    it('should handle dynamically loaded content', async () => {
      const html = `
        <div id="dynamic-container">
          <button id="load-content" onclick="loadContent()">Load Content</button>
        </div>
        <script>
          function loadContent() {
            setTimeout(() => {
              const form = document.createElement('div');
              form.innerHTML = \`
                <input id="dynamic-name" type="text" placeholder="Name">
                <input id="dynamic-email" type="email" placeholder="Email">
                <button id="dynamic-submit">Submit</button>
              \`;
              document.getElementById('dynamic-container').appendChild(form);
            }, 800);
          }
        </script>
      `;
      await session.navigate(`data:text/html,${html}`);

      await session.click('#load-content');

      // Fill in the dynamically loaded form
      const nameResult = await session.type('#dynamic-name', 'John Doe', { timeout: 3000 });
      expect(nameResult.success).toBe(true);

      const emailResult = await session.type('#dynamic-email', 'john@example.com', { timeout: 1000 });
      expect(emailResult.success).toBe(true);

      const submitResult = await session.click('#dynamic-submit', { timeout: 1000 });
      expect(submitResult.success).toBe(true);
    });

    it('should handle elements that change position', async () => {
      const html = `
        <div>
          <button id="move-trigger" onclick="
            const target = document.getElementById('moving-target');
            target.style.position = 'absolute';
            target.style.top = '200px';
            target.style.left = '300px';
          ">Move Element</button>
          <button id="moving-target" style="position: absolute; top: 50px; left: 50px;">
            Moving Target
          </button>
        </div>
      `;
      await session.navigate(`data:text/html,${html}`);

      // Click to move the element
      await session.click('#move-trigger');

      // Should still be able to interact with moved element
      const clickResult = await session.click('#moving-target');
      expect(clickResult.success).toBe(true);

      const hoverResult = await session.hover('#moving-target');
      expect(hoverResult.success).toBe(true);
    });

    it('should handle elements that become disabled/enabled', async () => {
      const html = `
        <div>
          <button id="toggle-btn" onclick="
            const target = document.getElementById('toggleable-input');
            target.disabled = !target.disabled;
            this.textContent = target.disabled ? 'Enable Input' : 'Disable Input';
          ">Disable Input</button>
          <input id="toggleable-input" type="text" placeholder="Can be disabled">
        </div>
      `;
      await session.navigate(`data:text/html,${html}`);

      // First, input should be enabled
      const typeResult1 = await session.type('#toggleable-input', 'Enabled text');
      expect(typeResult1.success).toBe(true);

      // Disable the input
      await session.click('#toggle-btn');

      // Typing should fail when disabled
      const typeResult2 = await session.type('#toggleable-input', 'Disabled text', { timeout: 1000 });
      expect(typeResult2.success).toBe(false);

      // Enable again
      await session.click('#toggle-btn');

      // Should work again
      const typeResult3 = await session.type('#toggleable-input', 'Re-enabled text');
      expect(typeResult3.success).toBe(true);
    });

    it('should handle elements in modal dialogs', async () => {
      const html = `
        <div>
          <button id="open-modal" onclick="
            document.getElementById('modal').style.display = 'block';
          ">Open Modal</button>
          <div id="modal" style="display: none; position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
                                 background: white; padding: 20px; border: 2px solid black; z-index: 1000;">
            <h3>Modal Dialog</h3>
            <input id="modal-input" type="text" placeholder="Modal input">
            <button id="modal-close" onclick="
              document.getElementById('modal').style.display = 'none';
            ">Close</button>
          </div>
        </div>
      `;
      await session.navigate(`data:text/html,${html}`);

      // Open modal
      await session.click('#open-modal');

      // Interact with modal content
      const typeResult = await session.type('#modal-input', 'Modal text');
      expect(typeResult.success).toBe(true);

      const focusResult = await session.focus('#modal-input');
      expect(focusResult.success).toBe(true);

      // Close modal
      const closeResult = await session.click('#modal-close');
      expect(closeResult.success).toBe(true);
    });

    it('should handle elements with complex CSS selectors', async () => {
      const html = `
        <div>
          <div class="form-group" data-section="user-info">
            <input class="form-control" data-field="username" type="text" placeholder="Username">
          </div>
          <div class="form-group" data-section="contact-info">
            <input class="form-control" data-field="email" type="email" placeholder="Email">
          </div>
          <div class="actions">
            <button class="btn btn-primary" data-action="submit">Submit Form</button>
          </div>
        </div>
      `;
      await session.navigate(`data:text/html,${html}`);

      // Test complex CSS selectors
      const usernameResult = await session.type('[data-section="user-info"] [data-field="username"]', 'testuser');
      expect(usernameResult.success).toBe(true);

      const emailResult = await session.type('.form-group[data-section="contact-info"] input.form-control', 'test@example.com');
      expect(emailResult.success).toBe(true);

      const submitResult = await session.click('button.btn-primary[data-action="submit"]');
      expect(submitResult.success).toBe(true);
    });
  });

  describe('Error cases for element waiting and visibility', () => {
    it('should timeout when element never becomes visible', async () => {
      const html = `<div id="always-hidden" style="display: none;">Never shown</div>`;
      await session.navigate(`data:text/html,${html}`);

      const clickResult = await session.click('#always-hidden', { timeout: 1000 });
      expect(clickResult.success).toBe(false);
      expect(clickResult.error).toBeDefined();
      expect(clickResult.duration).toBeGreaterThan(1000);
    });

    it('should handle elements that are removed from DOM', async () => {
      const html = `
        <div>
          <button id="remove-btn" onclick="
            document.getElementById('target-element').remove();
          ">Remove Element</button>
          <div id="target-element">
            <button id="removable-button">Will be removed</button>
          </div>
        </div>
      `;
      await session.navigate(`data:text/html,${html}`);

      // Remove the element
      await session.click('#remove-btn');

      // Should fail to interact with removed element
      const clickResult = await session.click('#removable-button', { timeout: 1000 });
      expect(clickResult.success).toBe(false);
      expect(clickResult.error).toBeDefined();
    });

    it('should handle elements with zero dimensions', async () => {
      const html = `
        <div id="zero-size" style="width: 0; height: 0; overflow: hidden;">
          <button id="zero-button">Zero Size Button</button>
        </div>
      `;
      await session.navigate(`data:text/html,${html}`);

      const clickResult = await session.click('#zero-button');
      expect(clickResult.success).toBe(false);
      expect(clickResult.error).toBeDefined();
    });

    it('should handle elements covered by other elements', async () => {
      const html = `
        <div style="position: relative;">
          <button id="covered-button" style="position: absolute; top: 0; left: 0;">Covered Button</button>
          <div style="position: absolute; top: 0; left: 0; width: 200px; height: 100px;
                      background: red; z-index: 10;">Overlay</div>
        </div>
      `;
      await session.navigate(`data:text/html,${html}`);

      const clickResult = await session.click('#covered-button');
      expect(clickResult.success).toBe(false);
      expect(clickResult.error).toBeDefined();
    });
  });

  describe('Performance tests for element waiting', () => {
    it('should efficiently wait for multiple elements in sequence', async () => {
      const html = `
        <div id="container">
          <script>
            let delay = 200;
            ['input1', 'input2', 'input3', 'input4', 'input5'].forEach((id, index) => {
              setTimeout(() => {
                const input = document.createElement('input');
                input.id = id;
                input.type = 'text';
                input.placeholder = \`Input \${index + 1}\`;
                document.getElementById('container').appendChild(input);
              }, delay * (index + 1));
            });
          </script>
        </div>
      `;
      await session.navigate(`data:text/html,${html}`);

      const startTime = Date.now();

      // Type in each input as it appears
      for (let i = 1; i <= 5; i++) {
        const result = await session.type(`#input${i}`, `Text ${i}`, { timeout: 5000 });
        expect(result.success).toBe(true);
      }

      const totalTime = Date.now() - startTime;
      expect(totalTime).toBeGreaterThan(1000); // Should take at least 1 second for the delays
      expect(totalTime).toBeLessThan(8000); // But not too long
    });

    it('should have reasonable timeout behavior', async () => {
      await session.navigate('data:text/html,<div>No target</div>');

      const shortTimeoutStart = Date.now();
      const shortResult = await session.click('#nonexistent', { timeout: 500 });
      const shortDuration = Date.now() - shortTimeoutStart;

      expect(shortResult.success).toBe(false);
      expect(shortDuration).toBeGreaterThan(400);
      expect(shortDuration).toBeLessThan(700);

      const longTimeoutStart = Date.now();
      const longResult = await session.click('#nonexistent', { timeout: 2000 });
      const longDuration = Date.now() - longTimeoutStart;

      expect(longResult.success).toBe(false);
      expect(longDuration).toBeGreaterThan(1800);
      expect(longDuration).toBeLessThan(2500);
    });
  });
});