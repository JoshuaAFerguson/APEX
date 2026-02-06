/**
 * Browser Form Handling Integration Tests
 *
 * Comprehensive integration tests for browser form handling scenarios covering:
 * - Text/number/checkbox/radio inputs
 * - Form validation errors
 * - Form submission with various methods (GET/POST)
 * - File upload handling
 * - Dynamic form elements
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BrowserManager } from '../browser-manager.js';
import { BrowserSession } from '../browser-session.js';
import type { BrowserActionResult } from '../types.js';

describe('Form Handling Integration Tests', () => {
  let manager: BrowserManager;
  let session: BrowserSession;

  beforeEach(async () => {
    manager = new BrowserManager();
    session = new BrowserSession(manager, {
      browserType: 'chromium',
      headless: true,
      timeout: 30000,
    });
    await session.launch();
  });

  afterEach(async () => {
    if (session) await session.close();
    if (manager) await manager.shutdown();
  });

  // Helper functions
  const createFormHtml = (formContent: string, includeSubmitCapture: boolean = true): string => {
    const submitScript = includeSubmitCapture ? `
      <script>
        window.submittedData = null;
        window.submissionMethod = null;
        function captureSubmit(event) {
          event.preventDefault();
          const form = event.target;
          const formData = new FormData(form);
          window.submittedData = {};
          for (const [key, value] of formData.entries()) {
            if (window.submittedData[key]) {
              if (!Array.isArray(window.submittedData[key])) {
                window.submittedData[key] = [window.submittedData[key]];
              }
              window.submittedData[key].push(value);
            } else {
              window.submittedData[key] = value;
            }
          }
          window.submissionMethod = form.method || 'GET';
        }
      </script>
    ` : '';

    return `data:text/html,
      <!DOCTYPE html>
      <html>
      <head><title>Form Test</title></head>
      <body>
        ${formContent}
        ${submitScript}
      </body>
      </html>
    `;
  };

  const getFormValue = async (selector: string): Promise<string> => {
    const result = await session.evaluate(`document.querySelector('${selector}').value`);
    return result.success ? result.data : '';
  };

  const getCheckedState = async (selector: string): Promise<boolean> => {
    const result = await session.evaluate(`document.querySelector('${selector}').checked`);
    return result.success ? result.data : false;
  };

  const isFormValid = async (formSelector: string = 'form'): Promise<boolean> => {
    const result = await session.evaluate(`document.querySelector('${formSelector}').checkValidity()`);
    return result.success ? result.data : false;
  };

  const getValidationMessage = async (selector: string): Promise<string> => {
    const result = await session.evaluate(`document.querySelector('${selector}').validationMessage`);
    return result.success ? result.data : '';
  };

  const getSubmittedData = async (): Promise<any> => {
    const result = await session.evaluate(`window.submittedData`);
    return result.success ? result.data : null;
  };

  describe('Text and Number Inputs', () => {
    it('should handle text input typing and clearing', async () => {
      const html = createFormHtml(`
        <form>
          <input type="text" id="textInput" name="text" placeholder="Enter text" />
          <input type="text" id="textWithValue" name="textWithValue" value="Initial Value" />
        </form>
      `);

      await session.navigate(html);

      // Type into empty text input
      const typeResult = await session.type('#textInput', 'Hello World');
      expect(typeResult.success).toBe(true);
      expect(await getFormValue('#textInput')).toBe('Hello World');

      // Clear and retype in input with existing value
      const clearAndTypeResult = await session.type('#textWithValue', 'New Value');
      expect(clearAndTypeResult.success).toBe(true);
      expect(await getFormValue('#textWithValue')).toBe('New Value');
    });

    it('should handle number input validation and constraints', async () => {
      const html = createFormHtml(`
        <form>
          <input type="number" id="numberInput" name="number" min="0" max="100" step="1" />
          <input type="number" id="decimalInput" name="decimal" step="0.01" />
        </form>
      `);

      await session.navigate(html);

      // Type valid number
      const numberResult = await session.type('#numberInput', '42');
      expect(numberResult.success).toBe(true);
      expect(await getFormValue('#numberInput')).toBe('42');

      // Type decimal number
      const decimalResult = await session.type('#decimalInput', '123.45');
      expect(decimalResult.success).toBe(true);
      expect(await getFormValue('#decimalInput')).toBe('123.45');
    });

    it('should handle input attributes like maxlength and placeholder', async () => {
      const html = createFormHtml(`
        <form>
          <input type="text" id="limitedInput" name="limited" maxlength="5" placeholder="Max 5 chars" />
          <textarea id="textArea" name="description" rows="3" cols="40" placeholder="Enter description"></textarea>
        </form>
      `);

      await session.navigate(html);

      // Test maxlength constraint
      const longTextResult = await session.type('#limitedInput', 'This is a very long text');
      expect(longTextResult.success).toBe(true);

      // Browser will enforce maxlength, so value should be truncated
      const actualValue = await getFormValue('#limitedInput');
      expect(actualValue.length).toBeLessThanOrEqual(5);

      // Test textarea
      const textareaResult = await session.type('#textArea', 'Multi-line\ntext content\nwith breaks');
      expect(textareaResult.success).toBe(true);
      expect(await getFormValue('#textArea')).toContain('Multi-line');
    });
  });

  describe('Checkbox Inputs', () => {
    it('should handle single checkbox check and uncheck', async () => {
      const html = createFormHtml(`
        <form>
          <input type="checkbox" id="singleCheckbox" name="agree" value="yes" />
          <label for="singleCheckbox">I agree to terms</label>
          <input type="checkbox" id="preChecked" name="newsletter" value="subscribe" checked />
          <label for="preChecked">Subscribe to newsletter</label>
        </form>
      `);

      await session.navigate(html);

      // Initially unchecked checkbox
      expect(await getCheckedState('#singleCheckbox')).toBe(false);

      const checkResult = await session.click('#singleCheckbox');
      expect(checkResult.success).toBe(true);
      expect(await getCheckedState('#singleCheckbox')).toBe(true);

      // Click again to uncheck
      const uncheckResult = await session.click('#singleCheckbox');
      expect(uncheckResult.success).toBe(true);
      expect(await getCheckedState('#singleCheckbox')).toBe(false);

      // Pre-checked checkbox
      expect(await getCheckedState('#preChecked')).toBe(true);
    });

    it('should handle checkbox groups with same name', async () => {
      const html = createFormHtml(`
        <form>
          <input type="checkbox" id="hobby1" name="hobbies" value="reading" />
          <label for="hobby1">Reading</label>
          <input type="checkbox" id="hobby2" name="hobbies" value="sports" />
          <label for="hobby2">Sports</label>
          <input type="checkbox" id="hobby3" name="hobbies" value="music" />
          <label for="hobby3">Music</label>
        </form>
      `);

      await session.navigate(html);

      // Check multiple checkboxes
      await session.click('#hobby1');
      await session.click('#hobby3');

      expect(await getCheckedState('#hobby1')).toBe(true);
      expect(await getCheckedState('#hobby2')).toBe(false);
      expect(await getCheckedState('#hobby3')).toBe(true);
    });

    it('should handle disabled checkbox behavior', async () => {
      const html = createFormHtml(`
        <form>
          <input type="checkbox" id="disabledCheckbox" name="disabled" value="disabled" disabled />
          <label for="disabledCheckbox">Disabled checkbox</label>
        </form>
      `);

      await session.navigate(html);

      // Attempt to click disabled checkbox - should not change state
      const clickResult = await session.click('#disabledCheckbox');
      // Click might succeed but checkbox state shouldn't change
      expect(await getCheckedState('#disabledCheckbox')).toBe(false);
    });
  });

  describe('Radio Inputs', () => {
    it('should handle radio button selection and group behavior', async () => {
      const html = createFormHtml(`
        <form>
          <input type="radio" id="color1" name="color" value="red" />
          <label for="color1">Red</label>
          <input type="radio" id="color2" name="color" value="blue" />
          <label for="color2">Blue</label>
          <input type="radio" id="color3" name="color" value="green" checked />
          <label for="color3">Green</label>
        </form>
      `);

      await session.navigate(html);

      // Initial state - green should be selected
      expect(await getCheckedState('#color3')).toBe(true);
      expect(await getCheckedState('#color1')).toBe(false);
      expect(await getCheckedState('#color2')).toBe(false);

      // Select red - should deselect green
      const selectRedResult = await session.click('#color1');
      expect(selectRedResult.success).toBe(true);
      expect(await getCheckedState('#color1')).toBe(true);
      expect(await getCheckedState('#color3')).toBe(false);

      // Select blue - should deselect red
      await session.click('#color2');
      expect(await getCheckedState('#color2')).toBe(true);
      expect(await getCheckedState('#color1')).toBe(false);
    });

    it('should handle multiple radio groups independently', async () => {
      const html = createFormHtml(`
        <form>
          <fieldset>
            <legend>Size</legend>
            <input type="radio" id="small" name="size" value="small" />
            <label for="small">Small</label>
            <input type="radio" id="large" name="size" value="large" />
            <label for="large">Large</label>
          </fieldset>
          <fieldset>
            <legend>Priority</legend>
            <input type="radio" id="low" name="priority" value="low" />
            <label for="low">Low</label>
            <input type="radio" id="high" name="priority" value="high" />
            <label for="high">High</label>
          </fieldset>
        </form>
      `);

      await session.navigate(html);

      // Select options in both groups
      await session.click('#small');
      await session.click('#high');

      // Both selections should be independent
      expect(await getCheckedState('#small')).toBe(true);
      expect(await getCheckedState('#high')).toBe(true);
      expect(await getCheckedState('#large')).toBe(false);
      expect(await getCheckedState('#low')).toBe(false);
    });
  });

  describe('Select/Dropdown Elements', () => {
    it('should handle single select dropdown selection', async () => {
      const html = createFormHtml(`
        <form>
          <select id="countrySelect" name="country">
            <option value="">Select a country</option>
            <option value="us">United States</option>
            <option value="uk">United Kingdom</option>
            <option value="ca">Canada</option>
          </select>
        </form>
      `);

      await session.navigate(html);

      // Select option using evaluate (since BrowserSession doesn't have selectOption method)
      const selectResult = await session.evaluate(`
        const select = document.getElementById('countrySelect');
        select.value = 'us';
        select.dispatchEvent(new Event('change', { bubbles: true }));
        return select.value;
      `);

      expect(selectResult.success).toBe(true);
      expect(selectResult.data).toBe('us');
    });

    it('should handle multi-select elements', async () => {
      const html = createFormHtml(`
        <form>
          <select id="skillsSelect" name="skills" multiple>
            <option value="js">JavaScript</option>
            <option value="ts">TypeScript</option>
            <option value="py">Python</option>
            <option value="go">Go</option>
          </select>
        </form>
      `);

      await session.navigate(html);

      // Select multiple options
      const multiSelectResult = await session.evaluate(`
        const select = document.getElementById('skillsSelect');
        const options = select.querySelectorAll('option');
        options[0].selected = true; // JavaScript
        options[2].selected = true; // Python
        select.dispatchEvent(new Event('change', { bubbles: true }));
        return Array.from(select.selectedOptions).map(opt => opt.value);
      `);

      expect(multiSelectResult.success).toBe(true);
      expect(multiSelectResult.data).toEqual(['js', 'py']);
    });
  });

  describe('Form Validation Errors', () => {
    it('should handle HTML5 required field validation', async () => {
      const html = createFormHtml(`
        <form id="validationForm">
          <input type="text" id="requiredField" name="required" required />
          <input type="email" id="emailField" name="email" required />
          <button type="submit">Submit</button>
        </form>
      `, false);

      await session.navigate(html);

      // Check form validity before filling - should be invalid
      expect(await isFormValid('#validationForm')).toBe(false);

      // Check validation message for empty required field
      const requiredMessage = await getValidationMessage('#requiredField');
      expect(requiredMessage).toBeTruthy();

      // Fill required field
      await session.type('#requiredField', 'Some text');

      // Check if field is now valid
      const fieldValidResult = await session.evaluate(`
        document.getElementById('requiredField').checkValidity()
      `);
      expect(fieldValidResult.success).toBe(true);
      expect(fieldValidResult.data).toBe(true);

      // Test invalid email
      await session.type('#emailField', 'invalid-email');
      const emailMessage = await getValidationMessage('#emailField');
      expect(emailMessage).toBeTruthy();

      // Fix email and check form validity
      await session.type('#emailField', 'valid@example.com');
      expect(await isFormValid('#validationForm')).toBe(true);
    });

    it('should handle pattern validation', async () => {
      const html = createFormHtml(`
        <form>
          <input type="text" id="phoneField" name="phone" pattern="[0-9]{3}-[0-9]{3}-[0-9]{4}"
                 title="Format: 123-456-7890" />
          <input type="text" id="zipField" name="zip" pattern="[0-9]{5}"
                 title="5-digit ZIP code" />
        </form>
      `);

      await session.navigate(html);

      // Test invalid pattern
      await session.type('#phoneField', '1234567890');
      const phoneValidResult = await session.evaluate(`
        document.getElementById('phoneField').checkValidity()
      `);
      expect(phoneValidResult.success).toBe(true);
      expect(phoneValidResult.data).toBe(false);

      // Test valid pattern
      await session.type('#phoneField', '123-456-7890');
      const phoneValidResult2 = await session.evaluate(`
        document.getElementById('phoneField').checkValidity()
      `);
      expect(phoneValidResult2.success).toBe(true);
      expect(phoneValidResult2.data).toBe(true);
    });

    it('should handle min/max validation for numbers', async () => {
      const html = createFormHtml(`
        <form>
          <input type="number" id="ageField" name="age" min="18" max="100" />
          <input type="range" id="ratingField" name="rating" min="1" max="10" value="5" />
        </form>
      `);

      await session.navigate(html);

      // Test value below minimum
      await session.type('#ageField', '15');
      const belowMinResult = await session.evaluate(`
        document.getElementById('ageField').checkValidity()
      `);
      expect(belowMinResult.success).toBe(true);
      expect(belowMinResult.data).toBe(false);

      // Test value above maximum
      await session.type('#ageField', '150');
      const aboveMaxResult = await session.evaluate(`
        document.getElementById('ageField').checkValidity()
      `);
      expect(aboveMaxResult.success).toBe(true);
      expect(aboveMaxResult.data).toBe(false);

      // Test valid value
      await session.type('#ageField', '25');
      const validAgeResult = await session.evaluate(`
        document.getElementById('ageField').checkValidity()
      `);
      expect(validAgeResult.success).toBe(true);
      expect(validAgeResult.data).toBe(true);
    });
  });

  describe('Form Submission Methods', () => {
    it('should handle GET method form submission', async () => {
      const html = createFormHtml(`
        <form id="getForm" method="GET" onsubmit="captureSubmit(event)">
          <input type="text" name="query" value="search term" />
          <input type="hidden" name="page" value="1" />
          <button type="submit" id="submitBtn">Search</button>
        </form>
      `);

      await session.navigate(html);

      // Submit form
      const submitResult = await session.click('#submitBtn');
      expect(submitResult.success).toBe(true);

      // Check captured data
      const submittedData = await getSubmittedData();
      expect(submittedData).toEqual({
        query: 'search term',
        page: '1'
      });

      // Verify submission method
      const method = await session.evaluate(`window.submissionMethod`);
      expect(method.success).toBe(true);
      expect(method.data).toBe('GET');
    });

    it('should handle POST method form submission', async () => {
      const html = createFormHtml(`
        <form id="postForm" method="POST" action="/submit" onsubmit="captureSubmit(event)">
          <input type="text" name="username" value="testuser" />
          <input type="text" name="userinfo" value="publicinfo" />
          <input type="checkbox" name="remember" value="1" checked />
          <button type="submit" id="postSubmit">Login</button>
        </form>
      `);

      await session.navigate(html);

      const submitResult = await session.click('#postSubmit');
      expect(submitResult.success).toBe(true);

      const submittedData = await getSubmittedData();
      expect(submittedData).toEqual({
        username: 'testuser',
        userinfo: 'publicinfo',
        remember: '1'
      });

      const method = await session.evaluate(`window.submissionMethod`);
      expect(method.success).toBe(true);
      expect(method.data).toBe('POST');
    });

    it('should handle form submission with multiple submit buttons', async () => {
      const html = createFormHtml(`
        <form onsubmit="captureSubmit(event)">
          <input type="text" name="data" value="test" />
          <button type="submit" name="action" value="save" id="saveBtn">Save</button>
          <button type="submit" name="action" value="delete" id="deleteBtn">Delete</button>
        </form>
      `);

      await session.navigate(html);

      // Test save button
      await session.click('#saveBtn');
      let submittedData = await getSubmittedData();
      expect(submittedData.action).toBe('save');

      // Reset captured data
      await session.evaluate(`window.submittedData = null`);

      // Test delete button
      await session.click('#deleteBtn');
      submittedData = await getSubmittedData();
      expect(submittedData.action).toBe('delete');
    });
  });

  describe('File Upload Handling', () => {
    it('should handle single file upload input', async () => {
      const html = createFormHtml(`
        <form enctype="multipart/form-data">
          <input type="file" id="singleFile" name="document" accept=".txt,.pdf" />
          <label for="singleFile">Upload document</label>
        </form>
      `);

      await session.navigate(html);

      // For file upload, we need to access the page directly
      const page = session.getPage();
      if (page) {
        // Create a test file content
        const testFileContent = 'This is a test file content';

        // Set up file input handling
        await page.setInputFiles('#singleFile', {
          name: 'test.txt',
          mimeType: 'text/plain',
          buffer: Buffer.from(testFileContent)
        });

        // Verify file was set
        const filesResult = await session.evaluate(`
          const input = document.getElementById('singleFile');
          return input.files.length > 0 ? {
            count: input.files.length,
            name: input.files[0].name,
            size: input.files[0].size
          } : null;
        `);

        expect(filesResult.success).toBe(true);
        expect(filesResult.data?.count).toBe(1);
        expect(filesResult.data?.name).toBe('test.txt');
        expect(filesResult.data?.size).toBe(testFileContent.length);
      }
    });

    it('should handle multiple file upload input', async () => {
      const html = createFormHtml(`
        <form enctype="multipart/form-data">
          <input type="file" id="multipleFiles" name="documents" multiple accept="image/*" />
          <label for="multipleFiles">Upload images</label>
        </form>
      `);

      await session.navigate(html);

      const page = session.getPage();
      if (page) {
        // Set multiple files
        await page.setInputFiles('#multipleFiles', [
          {
            name: 'image1.png',
            mimeType: 'image/png',
            buffer: Buffer.from('fake-png-content')
          },
          {
            name: 'image2.jpg',
            mimeType: 'image/jpeg',
            buffer: Buffer.from('fake-jpg-content')
          }
        ]);

        // Verify multiple files were set
        const filesResult = await session.evaluate(`
          const input = document.getElementById('multipleFiles');
          return {
            count: input.files.length,
            names: Array.from(input.files).map(f => f.name)
          };
        `);

        expect(filesResult.success).toBe(true);
        expect(filesResult.data?.count).toBe(2);
        expect(filesResult.data?.names).toEqual(['image1.png', 'image2.jpg']);
      }
    });
  });

  describe('Dynamic Form Elements', () => {
    it('should handle dynamically added form elements', async () => {
      const html = createFormHtml(`
        <form id="dynamicForm">
          <div id="inputContainer">
            <input type="text" name="field1" value="existing" />
          </div>
          <button type="button" id="addField" onclick="addNewField()">Add Field</button>
        </form>
        <script>
          let fieldCount = 1;
          function addNewField() {
            fieldCount++;
            const container = document.getElementById('inputContainer');
            const newInput = document.createElement('input');
            newInput.type = 'text';
            newInput.name = 'field' + fieldCount;
            newInput.id = 'field' + fieldCount;
            newInput.placeholder = 'Dynamic field ' + fieldCount;
            container.appendChild(newInput);
          }
        </script>
      `);

      await session.navigate(html);

      // Add a dynamic field
      const addResult = await session.click('#addField');
      expect(addResult.success).toBe(true);

      // Wait for the new element to be added
      const waitResult = await session.waitForElement('#field2');
      expect(waitResult.success).toBe(true);

      // Type into the dynamic field
      const typeResult = await session.type('#field2', 'Dynamic value');
      expect(typeResult.success).toBe(true);
      expect(await getFormValue('#field2')).toBe('Dynamic value');

      // Add another field
      await session.click('#addField');
      await session.waitForElement('#field3');
      await session.type('#field3', 'Another dynamic value');
      expect(await getFormValue('#field3')).toBe('Another dynamic value');
    });

    it('should handle conditionally shown form fields', async () => {
      const html = createFormHtml(`
        <form>
          <input type="checkbox" id="showExtra" onchange="toggleExtraFields(this.checked)" />
          <label for="showExtra">Show additional fields</label>

          <div id="extraFields" style="display: none;">
            <input type="text" id="extraField1" name="extra1" placeholder="Extra field 1" />
            <input type="text" id="extraField2" name="extra2" placeholder="Extra field 2" />
          </div>
        </form>
        <script>
          function toggleExtraFields(show) {
            const fields = document.getElementById('extraFields');
            fields.style.display = show ? 'block' : 'none';
          }
        </script>
      `);

      await session.navigate(html);

      // Initially, extra fields should be hidden
      const isVisible = await session.evaluate(`
        document.getElementById('extraFields').style.display !== 'none'
      `);
      expect(isVisible.success).toBe(true);
      expect(isVisible.data).toBe(false);

      // Check the checkbox to show fields
      await session.click('#showExtra');

      // Wait a bit for the change to take effect
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check if fields are now visible
      const isNowVisible = await session.evaluate(`
        document.getElementById('extraFields').style.display !== 'none'
      `);
      expect(isNowVisible.success).toBe(true);
      expect(isNowVisible.data).toBe(true);

      // Type into the now-visible fields
      await session.type('#extraField1', 'Conditional value 1');
      await session.type('#extraField2', 'Conditional value 2');

      expect(await getFormValue('#extraField1')).toBe('Conditional value 1');
      expect(await getFormValue('#extraField2')).toBe('Conditional value 2');
    });

    it('should handle form field removal', async () => {
      const html = createFormHtml(`
        <form>
          <div id="removableFields">
            <div class="field-group" id="group1">
              <input type="text" name="item1" value="Item 1" />
              <button type="button" onclick="removeField('group1')">Remove</button>
            </div>
            <div class="field-group" id="group2">
              <input type="text" name="item2" value="Item 2" />
              <button type="button" onclick="removeField('group2')">Remove</button>
            </div>
          </div>
        </form>
        <script>
          function removeField(groupId) {
            const group = document.getElementById(groupId);
            if (group) {
              group.remove();
            }
          }
        </script>
      `);

      await session.navigate(html);

      // Verify both fields exist initially
      const field1Exists = await session.evaluate(`!!document.querySelector('[name="item1"]')`);
      const field2Exists = await session.evaluate(`!!document.querySelector('[name="item2"]')`);
      expect(field1Exists.data).toBe(true);
      expect(field2Exists.data).toBe(true);

      // Remove the first field
      await session.click('#group1 button');

      // Wait for removal to take effect
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify field1 is removed but field2 remains
      const field1ExistsAfter = await session.evaluate(`!!document.querySelector('[name="item1"]')`);
      const field2ExistsAfter = await session.evaluate(`!!document.querySelector('[name="item2"]')`);
      expect(field1ExistsAfter.data).toBe(false);
      expect(field2ExistsAfter.data).toBe(true);

      // Verify we can still interact with the remaining field
      await session.type('[name="item2"]', ' - Modified');
      expect(await getFormValue('[name="item2"]')).toBe('Item 2 - Modified');
    });

    it('should handle real-time validation and updates', async () => {
      const html = createFormHtml(`
        <form>
          <input type="text" id="field1" name="field1" oninput="validateFields()" />
          <input type="text" id="field2" name="field2" oninput="validateFields()" />
          <div id="validationMessage" style="color: red;"></div>
        </form>
        <script>
          function validateFields() {
            const field1 = document.getElementById('field1').value;
            const field2 = document.getElementById('field2').value;
            const message = document.getElementById('validationMessage');

            if (field1 && field2) {
              if (field1 === field2) {
                message.textContent = 'Fields match';
                message.style.color = 'green';
              } else {
                message.textContent = 'Fields do not match';
                message.style.color = 'red';
              }
            } else {
              message.textContent = '';
            }
          }
        </script>
      `);

      await session.navigate(html);

      // Type mismatching values
      await session.type('#field1', 'value123');
      await session.type('#field2', 'value456');

      // Check validation message
      let messageResult = await session.evaluate(`document.getElementById('validationMessage').textContent`);
      expect(messageResult.data).toBe('Fields do not match');

      // Fix the second field
      await session.type('#field2', 'value123');

      // Check updated validation message
      messageResult = await session.evaluate(`document.getElementById('validationMessage').textContent`);
      expect(messageResult.data).toBe('Fields match');

      // Verify color change
      const colorResult = await session.evaluate(`document.getElementById('validationMessage').style.color`);
      expect(colorResult.data).toBe('green');
    });
  });
});