/**
 * @fileoverview Sample Form Controls Integration Test
 *
 * This test demonstrates the form control testing infrastructure
 * with basic form interactions and validation scenarios.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  simulateTyping,
  simulateFileSelection,
  createMockFile,
  waitForValidation,
  fillFormWithTestData,
} from './setup';

function createSampleForm(): HTMLFormElement {
  const form = document.createElement('form');
  form.id = 'sample-form';

  form.innerHTML = `
    <div class="form-group">
      <label for="textfield">Text Field *</label>
      <input type="text" id="textfield" name="textfield" required />
      <div id="textfield-error" role="alert"></div>
    </div>

    <div class="form-group">
      <label for="numberfield">Number Field</label>
      <input type="number" id="numberfield" name="numberfield" min="1" max="100" />
    </div>

    <div class="form-group">
      <label for="selectfield">Select Option</label>
      <select id="selectfield" name="selectfield">
        <option value="">Choose...</option>
        <option value="option1">Option 1</option>
        <option value="option2">Option 2</option>
      </select>
    </div>

    <div class="form-group">
      <label>
        <input type="checkbox" id="checkbox1" name="checkbox1" />
        Check this box
      </label>
    </div>

    <div class="form-group">
      <label for="filefield">File Upload</label>
      <input type="file" id="filefield" name="filefield" />
    </div>

    <button type="submit" id="submit-btn">Submit</button>
    <button type="reset" id="reset-btn">Reset</button>
  `;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const textfield = form.querySelector('#textfield') as HTMLInputElement;

    if (!textfield.value.trim()) {
      const errorEl = form.querySelector('#textfield-error') as HTMLElement;
      errorEl.textContent = 'Text field is required';
      return;
    }

    console.log('Form submitted successfully');
  });

  return form;
}

describe('Form Controls Integration Test Sample', () => {
  let form: HTMLFormElement;

  beforeEach(() => {
    form = createSampleForm();
    document.body.appendChild(form);
  });

  it('should validate test infrastructure is working', () => {
    expect(form).toBeTruthy();
    expect(form.id).toBe('sample-form');
  });

  it('should handle text input', async () => {
    const textInput = form.querySelector('#textfield') as HTMLInputElement;
    await simulateTyping(textInput, 'sample text');
    expect(textInput.value).toBe('sample text');
  });

  it('should handle number input', async () => {
    const numberInput = form.querySelector('#numberfield') as HTMLInputElement;
    await simulateTyping(numberInput, '42');
    expect(numberInput.value).toBe('42');
    expect(parseInt(numberInput.value)).toBe(42);
  });

  it('should handle select dropdown', () => {
    const select = form.querySelector('#selectfield') as HTMLSelectElement;
    select.value = 'option1';
    select.dispatchEvent(new Event('change'));
    expect(select.value).toBe('option1');
  });

  it('should handle checkbox', () => {
    const checkbox = form.querySelector('#checkbox1') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);

    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));
    expect(checkbox.checked).toBe(true);
  });

  it('should handle file upload', () => {
    const fileInput = form.querySelector('#filefield') as HTMLInputElement;
    const mockFile = createMockFile('test.txt', 'test content', 'text/plain');

    simulateFileSelection(fileInput, [mockFile]);

    expect(fileInput.files).toBeTruthy();
    expect(fileInput.files!.length).toBe(1);
    expect(fileInput.files![0].name).toBe('test.txt');
  });

  it('should validate required fields', async () => {
    const submitBtn = form.querySelector('#submit-btn') as HTMLButtonElement;
    submitBtn.click();

    await new Promise(resolve => setTimeout(resolve, 100));

    const errorEl = form.querySelector('#textfield-error') as HTMLElement;
    expect(errorEl.textContent).toBe('Text field is required');
  });

  it('should pass validation with data', async () => {
    await fillFormWithTestData(form, {
      textfield: 'valid text',
      numberfield: 25,
      selectfield: 'option1',
      checkbox1: true,
    });

    const textInput = form.querySelector('#textfield') as HTMLInputElement;
    const numberInput = form.querySelector('#numberfield') as HTMLInputElement;
    const select = form.querySelector('#selectfield') as HTMLSelectElement;
    const checkbox = form.querySelector('#checkbox1') as HTMLInputElement;

    expect(textInput.value).toBe('valid text');
    expect(numberInput.value).toBe('25');
    expect(select.value).toBe('option1');
    expect(checkbox.checked).toBe(true);
  });

  it('should handle form reset', () => {
    const textInput = form.querySelector('#textfield') as HTMLInputElement;
    const checkbox = form.querySelector('#checkbox1') as HTMLInputElement;

    textInput.value = 'some text';
    checkbox.checked = true;

    const resetBtn = form.querySelector('#reset-btn') as HTMLButtonElement;
    resetBtn.click();

    expect(textInput.value).toBe('');
    expect(checkbox.checked).toBe(false);
  });

  it('should validate test utilities work', async () => {
    // Test simulateTyping
    const input = form.querySelector('#textfield') as HTMLInputElement;
    await simulateTyping(input, 'test');
    expect(input.value).toBe('test');

    // Test createMockFile
    const file = createMockFile('sample.txt', 'content');
    expect(file.name).toBe('sample.txt');

    // Test form environment
    expect(document).toBeDefined();
    expect(window.File).toBeDefined();
    expect(window.FileReader).toBeDefined();

    console.log('✅ Form integration test utilities validated');
  });
});