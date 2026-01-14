import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BrowserSession } from '../browser-session';
import { BrowserConfig, ElementSelector } from '../types';

describe('Advanced Selector and Element Interactions', () => {
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

  describe('ElementSelector object patterns', () => {
    it('should handle various ElementSelector configurations', async () => {
      const html = `
        <div>
          <input id="test-input" type="text" class="form-input" data-testid="main-input">
          <button class="btn primary" data-action="submit">Submit</button>
          <div role="button" tabindex="0" aria-label="Custom Button">Custom Button</div>
        </div>
      `;
      await session.navigate(`data:text/html,${html}`);

      // Test different selector configurations
      const selectors: ElementSelector[] = [
        { type: 'selector', value: '#test-input' },
        { type: 'selector', value: '.form-input' },
        { type: 'selector', value: '[data-testid="main-input"]' },
        { type: 'selector', value: '.btn.primary' },
        { type: 'selector', value: '[role="button"]' }
      ];

      // Test type operation with different selectors
      const typeResult1 = await session.type(selectors[0], 'ID selector');
      expect(typeResult1.success).toBe(true);

      const typeResult2 = await session.type(selectors[1], 'Class selector');
      expect(typeResult2.success).toBe(true);

      const typeResult3 = await session.type(selectors[2], 'Data attribute selector');
      expect(typeResult3.success).toBe(true);

      // Test click with button selectors
      const clickResult1 = await session.click(selectors[3]);
      expect(clickResult1.success).toBe(true);

      const clickResult2 = await session.click(selectors[4]);
      expect(clickResult2.success).toBe(true);
    });

    it('should handle pseudo-selectors and complex CSS selectors', async () => {
      const html = `
        <div>
          <ul class="nav">
            <li><a href="#" class="nav-link">First</a></li>
            <li><a href="#" class="nav-link active">Second</a></li>
            <li><a href="#" class="nav-link">Third</a></li>
          </ul>
          <div class="content">
            <p>First paragraph</p>
            <p class="highlighted">Second paragraph</p>
            <p>Third paragraph</p>
          </div>
        </div>
      `;
      await session.navigate(`data:text/html,${html}`);

      // Test first-child, last-child, nth-child selectors
      const firstNavResult = await session.click('.nav li:first-child a');
      expect(firstNavResult.success).toBe(true);

      const lastNavResult = await session.click('.nav li:last-child a');
      expect(lastNavResult.success).toBe(true);

      const secondNavResult = await session.click('.nav li:nth-child(2) a');
      expect(secondNavResult.success).toBe(true);

      // Test attribute selectors
      const activeNavResult = await session.hover('.nav-link.active');
      expect(activeNavResult.success).toBe(true);

      // Test descendant and sibling selectors
      const contentParaResult = await session.hover('.content p.highlighted');
      expect(contentParaResult.success).toBe(true);
    });

    it('should handle xpath-style selections through CSS equivalents', async () => {
      const html = `
        <div class="form-container">
          <div class="form-section" data-section="personal">
            <input name="firstName" type="text" placeholder="First Name">
            <input name="lastName" type="text" placeholder="Last Name">
          </div>
          <div class="form-section" data-section="contact">
            <input name="email" type="email" placeholder="Email">
            <input name="phone" type="tel" placeholder="Phone">
          </div>
        </div>
      `;
      await session.navigate(`data:text/html,${html}`);

      // Test attribute-based selections
      const firstNameResult = await session.type('[name="firstName"]', 'John');
      expect(firstNameResult.success).toBe(true);

      const lastNameResult = await session.type('[name="lastName"]', 'Doe');
      expect(lastNameResult.success).toBe(true);

      // Test compound attribute selections
      const emailResult = await session.type('[data-section="contact"] [name="email"]', 'john@example.com');
      expect(emailResult.success).toBe(true);

      const phoneResult = await session.type('.form-section[data-section="contact"] input[type="tel"]', '555-1234');
      expect(phoneResult.success).toBe(true);
    });
  });

  describe('Form interaction patterns', () => {
    it('should handle complete form interaction workflows', async () => {
      const html = `
        <form id="registration-form">
          <fieldset>
            <legend>Personal Information</legend>
            <label for="username">Username:</label>
            <input id="username" name="username" type="text" required>

            <label for="password">Password:</label>
            <input id="password" name="password" type="password" required>

            <label for="confirm-password">Confirm Password:</label>
            <input id="confirm-password" name="confirmPassword" type="password" required>
          </fieldset>

          <fieldset>
            <legend>Preferences</legend>
            <label>
              <input type="radio" name="theme" value="light" checked> Light Theme
            </label>
            <label>
              <input type="radio" name="theme" value="dark"> Dark Theme
            </label>

            <label>
              <input type="checkbox" name="newsletter" value="yes"> Subscribe to newsletter
            </label>

            <label for="country">Country:</label>
            <select id="country" name="country">
              <option value="">Select Country</option>
              <option value="us">United States</option>
              <option value="ca">Canada</option>
              <option value="uk">United Kingdom</option>
            </select>
          </fieldset>

          <button type="submit">Register</button>
          <button type="reset">Reset Form</button>
        </form>
      `;
      await session.navigate(`data:text/html,${html}`);

      // Fill text inputs
      await session.type('#username', 'testuser123');
      await session.type('#password', 'SecurePass123!');
      await session.type('#confirm-password', 'SecurePass123!');

      // Select radio button
      await session.click('input[name="theme"][value="dark"]');

      // Check checkbox
      await session.click('input[name="newsletter"]');

      // Select dropdown option
      await session.click('#country');
      await session.click('option[value="us"]');

      // Submit form
      const submitResult = await session.click('button[type="submit"]');
      expect(submitResult.success).toBe(true);
    });

    it('should handle dynamic form validation interactions', async () => {
      const html = `
        <form id="validation-form">
          <input id="email-input" type="email" placeholder="Email" onblur="validateEmail(this)">
          <span id="email-error" style="color: red; display: none;">Invalid email</span>

          <input id="phone-input" type="tel" placeholder="Phone" onblur="validatePhone(this)">
          <span id="phone-error" style="color: red; display: none;">Invalid phone</span>

          <button id="submit-btn" type="submit" disabled>Submit</button>
        </form>

        <script>
          function validateEmail(input) {
            const isValid = input.value.includes('@');
            const error = document.getElementById('email-error');
            error.style.display = isValid ? 'none' : 'inline';
            updateSubmitButton();
          }

          function validatePhone(input) {
            const isValid = input.value.length >= 10;
            const error = document.getElementById('phone-error');
            error.style.display = isValid ? 'none' : 'inline';
            updateSubmitButton();
          }

          function updateSubmitButton() {
            const emailValid = !document.getElementById('email-error').offsetParent;
            const phoneValid = !document.getElementById('phone-error').offsetParent;
            document.getElementById('submit-btn').disabled = !(emailValid && phoneValid);
          }
        </script>
      `;
      await session.navigate(`data:text/html,${html}`);

      // Test invalid email
      await session.type('#email-input', 'invalid-email');
      await session.focus('#phone-input'); // Trigger blur on email

      // Test invalid phone
      await session.type('#phone-input', '123');
      await session.focus('#email-input'); // Trigger blur on phone

      // Submit should still be disabled
      const submitDisabledResult = await session.click('#submit-btn');
      expect(submitDisabledResult.success).toBe(false); // Should fail because button is disabled

      // Fix email
      await session.focus('#email-input');
      await session.type('#email-input', 'valid@email.com', { clear: true });
      await session.focus('#phone-input');

      // Fix phone
      await session.focus('#phone-input');
      await session.type('#phone-input', '1234567890', { clear: true });
      await session.focus('#email-input');

      // Now submit should work
      const submitResult = await session.click('#submit-btn');
      expect(submitResult.success).toBe(true);
    });
  });

  describe('Table and list interaction patterns', () => {
    it('should handle table cell interactions', async () => {
      const html = `
        <table id="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr data-id="1">
              <td>John Doe</td>
              <td>john@example.com</td>
              <td>
                <button class="edit-btn" onclick="editUser(1)">Edit</button>
                <button class="delete-btn" onclick="deleteUser(1)">Delete</button>
              </td>
            </tr>
            <tr data-id="2">
              <td>Jane Smith</td>
              <td>jane@example.com</td>
              <td>
                <button class="edit-btn" onclick="editUser(2)">Edit</button>
                <button class="delete-btn" onclick="deleteUser(2)">Delete</button>
              </td>
            </tr>
          </tbody>
        </table>

        <script>
          function editUser(id) {
            console.log('Editing user', id);
          }

          function deleteUser(id) {
            const row = document.querySelector(\`[data-id="\${id}"]\`);
            row.remove();
          }
        </script>
      `;
      await session.navigate(`data:text/html,${html}`);

      // Click edit button in first row
      const editResult = await session.click('tr[data-id="1"] .edit-btn');
      expect(editResult.success).toBe(true);

      // Click delete button in second row
      const deleteResult = await session.click('tr[data-id="2"] .delete-btn');
      expect(deleteResult.success).toBe(true);

      // Verify row was deleted by trying to interact with it (should fail)
      const deletedRowResult = await session.click('tr[data-id="2"] .edit-btn', { timeout: 1000 });
      expect(deletedRowResult.success).toBe(false);
    });

    it('should handle sortable and filterable list interactions', async () => {
      const html = `
        <div>
          <input id="filter-input" type="text" placeholder="Filter items" oninput="filterItems(this.value)">
          <button id="sort-btn" onclick="sortItems()">Sort A-Z</button>

          <ul id="item-list">
            <li data-name="zebra">Zebra</li>
            <li data-name="apple">Apple</li>
            <li data-name="banana">Banana</li>
            <li data-name="cherry">Cherry</li>
          </ul>
        </div>

        <script>
          function filterItems(filter) {
            const items = document.querySelectorAll('#item-list li');
            items.forEach(item => {
              const name = item.getAttribute('data-name');
              item.style.display = name.includes(filter.toLowerCase()) ? 'block' : 'none';
            });
          }

          function sortItems() {
            const list = document.getElementById('item-list');
            const items = Array.from(list.querySelectorAll('li'));
            items.sort((a, b) => a.getAttribute('data-name').localeCompare(b.getAttribute('data-name')));
            items.forEach(item => list.appendChild(item));
          }
        </script>
      `;
      await session.navigate(`data:text/html,${html}`);

      // Test filtering
      await session.type('#filter-input', 'a');

      // Test sorting
      await session.click('#sort-btn');

      // Clear filter to see all sorted items
      await session.type('#filter-input', '', { clear: true });

      // Click on specific items after sorting
      const appleResult = await session.click('[data-name="apple"]');
      expect(appleResult.success).toBe(true);

      const zebraResult = await session.click('[data-name="zebra"]');
      expect(zebraResult.success).toBe(true);
    });
  });

  describe('Shadow DOM and complex component interactions', () => {
    it('should handle interactions within shadow DOM components', async () => {
      const html = `
        <div id="shadow-host">
          <script>
            const host = document.getElementById('shadow-host');
            const shadowRoot = host.attachShadow({mode: 'open'});
            shadowRoot.innerHTML = \`
              <style>
                .shadow-button {
                  background: blue;
                  color: white;
                  padding: 10px;
                  border: none;
                  cursor: pointer;
                }
              </style>
              <div>
                <button id="shadow-button" class="shadow-button" onclick="this.textContent = 'Shadow Clicked'">
                  Shadow Button
                </button>
                <input id="shadow-input" type="text" placeholder="Shadow Input">
              </div>
            \`;
          </script>
        </div>
      `;
      await session.navigate(`data:text/html,${html}`);

      // Note: Direct interaction with shadow DOM content requires piercing through shadow root
      // These interactions will likely fail with standard selectors, which is expected behavior
      const shadowButtonResult = await session.click('#shadow-button');
      expect(shadowButtonResult.success).toBe(false); // Expected to fail due to shadow DOM

      const shadowInputResult = await session.type('#shadow-input', 'shadow text');
      expect(shadowInputResult.success).toBe(false); // Expected to fail due to shadow DOM
    });

    it('should handle custom web components with light DOM content', async () => {
      const html = `
        <script>
          class CustomButton extends HTMLElement {
            connectedCallback() {
              this.innerHTML = \`
                <button id="custom-btn" onclick="this.textContent = 'Custom Clicked'">
                  \${this.getAttribute('label') || 'Custom Button'}
                </button>
              \`;
            }
          }
          customElements.define('custom-button', CustomButton);
        </script>

        <div>
          <custom-button label="Click Me"></custom-button>
          <custom-button id="second-custom" label="Second Button"></custom-button>
        </div>
      `;
      await session.navigate(`data:text/html,${html}`);

      // Wait for custom elements to be defined and rendered
      await session.evaluate(`customElements.whenDefined('custom-button')`);

      // These should work since the content is in light DOM
      const customBtnResult = await session.click('custom-button button');
      expect(customBtnResult.success).toBe(true);

      const secondCustomResult = await session.click('#second-custom button');
      expect(secondCustomResult.success).toBe(true);
    });
  });

  describe('Accessibility-focused interactions', () => {
    it('should handle ARIA-labeled elements and roles', async () => {
      const html = `
        <div>
          <div role="button" aria-label="Custom Submit" tabindex="0"
               onclick="this.setAttribute('aria-pressed', 'true')"
               onkeydown="if(event.key==='Enter'||event.key===' ') this.click()">
            Submit
          </div>

          <div role="textbox" aria-label="Custom Input" contenteditable="true"
               aria-describedby="input-help">
            Type here...
          </div>
          <div id="input-help">Enter your message</div>

          <ul role="listbox" aria-label="Options">
            <li role="option" aria-selected="false" onclick="selectOption(this)">Option 1</li>
            <li role="option" aria-selected="false" onclick="selectOption(this)">Option 2</li>
            <li role="option" aria-selected="true" onclick="selectOption(this)">Option 3</li>
          </ul>
        </div>

        <script>
          function selectOption(option) {
            document.querySelectorAll('[role="option"]').forEach(opt =>
              opt.setAttribute('aria-selected', 'false')
            );
            option.setAttribute('aria-selected', 'true');
          }
        </script>
      `;
      await session.navigate(`data:text/html,${html}`);

      // Test role-based selections
      const buttonResult = await session.click('[role="button"]');
      expect(buttonResult.success).toBe(true);

      const textboxResult = await session.type('[role="textbox"]', 'Accessible text input');
      expect(textboxResult.success).toBe(true);

      // Test ARIA selections
      const option1Result = await session.click('[role="option"]:first-child');
      expect(option1Result.success).toBe(true);

      const option2Result = await session.click('[role="option"]:nth-child(2)');
      expect(option2Result.success).toBe(true);
    });

    it('should handle focus management and keyboard navigation', async () => {
      const html = `
        <div>
          <button id="focus-trap-start" onclick="focusNext()">Start Focus Trap</button>

          <div id="modal" style="display: none; border: 2px solid black; padding: 20px;">
            <h2 id="modal-title">Modal Dialog</h2>
            <input id="modal-input1" type="text" placeholder="First input">
            <input id="modal-input2" type="text" placeholder="Second input">
            <button id="modal-ok" onclick="closeModal()">OK</button>
            <button id="modal-cancel" onclick="closeModal()">Cancel</button>
          </div>
        </div>

        <script>
          function focusNext() {
            document.getElementById('modal').style.display = 'block';
            document.getElementById('modal-input1').focus();
          }

          function closeModal() {
            document.getElementById('modal').style.display = 'none';
            document.getElementById('focus-trap-start').focus();
          }
        </script>
      `;
      await session.navigate(`data:text/html,${html}`);

      // Open modal and test focus management
      await session.click('#focus-trap-start');

      // Focus should be on first input
      await session.type('#modal-input1', 'First field');

      // Move focus to second input
      await session.focus('#modal-input2');
      await session.type('#modal-input2', 'Second field');

      // Test button interactions
      await session.hover('#modal-ok');
      await session.click('#modal-cancel');
    });
  });

  describe('Error handling with complex selectors', () => {
    it('should handle malformed CSS selectors gracefully', async () => {
      await session.navigate('data:text/html,<div>Test content</div>');

      const malformedSelectors = [
        '::invalid::pseudo',
        '[unclosed-bracket',
        'div > > child',
        '.class..double-dot',
        '#id##double-hash',
        'div:unknown-pseudo()',
        'element[attr="unclosed'
      ];

      for (const selector of malformedSelectors) {
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

    it('should handle selectors that match multiple elements', async () => {
      const html = `
        <div>
          <button class="action-btn">Button 1</button>
          <button class="action-btn">Button 2</button>
          <button class="action-btn">Button 3</button>
        </div>
      `;
      await session.navigate(`data:text/html,${html}`);

      // These should succeed by interacting with the first matching element
      const clickResult = await session.click('.action-btn');
      expect(clickResult.success).toBe(true);

      const hoverResult = await session.hover('.action-btn');
      expect(hoverResult.success).toBe(true);

      const focusResult = await session.focus('.action-btn');
      expect(focusResult.success).toBe(true);
    });

    it('should handle ElementSelector objects with invalid configurations', async () => {
      await session.navigate('data:text/html,<input id="test" type="text">');

      const invalidSelectors = [
        { type: 'invalid' as any, value: 'test' },
        { type: 'selector', value: '' },
        { type: 'selector', value: null as any },
        { type: 'selector', value: undefined as any }
      ];

      for (const selector of invalidSelectors) {
        const clickResult = await session.click(selector);
        expect(clickResult.success).toBe(false);
        expect(clickResult.error).toBeDefined();

        const typeResult = await session.type(selector, 'text');
        expect(typeResult.success).toBe(false);
        expect(typeResult.error).toBeDefined();
      }
    });
  });
});