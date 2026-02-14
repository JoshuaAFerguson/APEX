/**
 * @apexcli/browser - Test Page Generators
 *
 * Migrated from __tests__/test-utils.ts
 * Extended with template variable injection and navigation test templates
 */

/**
 * Template variable interface for dynamic content injection
 */
export interface TemplateVariables {
  [key: string]: string | number | boolean;
}

/**
 * Template processing utility for variable injection
 */
export class TemplateProcessor {
  /**
   * Process template string with variable substitution
   * Variables are referenced as {{variableName}} in the template
   */
  static process(template: string, variables: TemplateVariables = {}): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, variableName) => {
      const value = variables[variableName];
      return value !== undefined ? String(value) : match;
    });
  }

  /**
   * Create a template processor function with pre-set variables
   */
  static createProcessor(defaultVariables: TemplateVariables) {
    return (template: string, overrideVariables: TemplateVariables = {}): string => {
      const mergedVariables = { ...defaultVariables, ...overrideVariables };
      return TemplateProcessor.process(template, mergedVariables);
    };
  }
}

/**
 * Test page content generators
 */
export const TestPages = {
  /**
   * Create a simple test page with basic content
   */
  simple: (title: string = 'Test Page', backgroundColor: string = '#ffffff') => `
    <html>
      <head><title>${title}</title></head>
      <body style="background:${backgroundColor};margin:0;padding:20px;font-family:Arial,sans-serif;">
        <h1>${title}</h1>
        <p>This is a test page for screenshot utilities.</p>
      </body>
    </html>
  `,

  /**
   * Create a tall page for testing full page screenshots
   */
  tall: (height: number = 5000) => `
    <html>
      <body style="margin:0;padding:0;">
        <div style="height:${height}px;background:linear-gradient(to bottom,#ff6b6b,#4ecdc4,#45b7d1);">
          <h1 style="padding:20px;color:white;">Tall Page Test</h1>
          <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:white;">
            <h2>Middle Content</h2>
          </div>
          <div style="position:absolute;bottom:20px;left:20px;color:white;">
            <h3>Bottom Content</h3>
          </div>
        </div>
      </body>
    </html>
  `,

  /**
   * Create a complex page with CSS animations and effects
   */
  complex: () => `
    <html>
      <head>
        <style>
          body {
            margin: 0;
            background: linear-gradient(45deg, #667eea, #764ba2);
            font-family: Arial, sans-serif;
          }
          .container {
            padding: 20px;
          }
          .card {
            background: rgba(255,255,255,0.9);
            border-radius: 15px;
            padding: 20px;
            margin: 20px 0;
            box-shadow: 0 8px 32px rgba(0,0,0,0.1);
          }
          @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.05); }
            100% { transform: scale(1); }
          }
          .pulse { animation: pulse 2s infinite; }
          .gradient-text {
            background: linear-gradient(45deg, #ff6b6b, #4ecdc4);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="card pulse">
            <h1 class="gradient-text">Complex Test Page</h1>
            <p>This page includes CSS gradients, animations, and effects.</p>
          </div>
          <div class="card">
            <h2>Features Tested:</h2>
            <ul>
              <li>CSS Gradients</li>
              <li>Border Radius</li>
              <li>Box Shadows</li>
              <li>Animations</li>
              <li>Transparency</li>
            </ul>
          </div>
        </div>
      </body>
    </html>
  `,

  /**
   * Create a page with special characters and unicode
   */
  unicode: () => `
    <html>
      <head><meta charset="UTF-8"></head>
      <body style="padding:20px;font-family:Arial,sans-serif;">
        <h1>Unicode & Special Characters Test 🌟</h1>
        <div>
          <h2>Emojis: 🚀🎉🔥💯⚡🌈🎨</h2>
          <h2>Languages: Hello, 你好, こんにちは, Здравствуйте, مرحبا</h2>
          <h2>Symbols: ♠♣♥♦ ☀☁☂☃ ✓✗⚠ ∑∏∫∆√∞</h2>
          <h2>Currency: $¥€£₹₿</h2>
        </div>
      </body>
    </html>
  `,

  /**
   * Create an empty page
   */
  empty: () => '<html><body></body></html>',

  /**
   * Create a transparent page
   */
  transparent: () => `
    <html>
      <body style="background:transparent;padding:20px;">
        <h1 style="color:#333;">Transparent Background</h1>
      </body>
    </html>
  `,

  /**
   * Create a comprehensive form test page with various input types
   */
  formTest: (variables: TemplateVariables = {}) => {
    const template = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>{{title}}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: {{backgroundColor}};
          }
          .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          .form-section {
            margin: 20px 0;
            padding: 20px;
            border: 1px solid #ddd;
            border-radius: 8px;
          }
          .form-section h3 {
            margin-top: 0;
            color: #333;
          }
          label {
            display: block;
            margin: 10px 0 5px;
            font-weight: bold;
          }
          input, textarea, select {
            width: 100%;
            padding: 8px;
            margin: 5px 0 15px;
            border: 1px solid #ccc;
            border-radius: 4px;
            font-size: 14px;
            box-sizing: border-box;
          }
          input[type="checkbox"], input[type="radio"] {
            width: auto;
            margin-right: 8px;
          }
          button {
            padding: 10px 20px;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            margin: 5px;
          }
          button:hover {
            background: #0056b3;
          }
          .status {
            margin: 20px 0;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 4px;
            font-family: monospace;
          }
          .radio-group, .checkbox-group {
            display: flex;
            gap: 15px;
            margin: 10px 0;
          }
          .radio-item, .checkbox-item {
            display: flex;
            align-items: center;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1 id="page-title">{{title}}</h1>
          <p>{{description}}</p>

          <form id="test-form" novalidate>
            <!-- Text Inputs Section -->
            <div class="form-section">
              <h3>Text Input Fields</h3>
              <label for="text-input">Regular Text Input:</label>
              <input type="text" id="text-input" name="textInput" placeholder="Enter text here" value="{{defaultText}}">

              <label for="password-input">Password Input:</label>
              <input type="password" id="password-input" name="passwordInput" placeholder="Enter password">

              <label for="email-input">Email Input:</label>
              <input type="email" id="email-input" name="emailInput" placeholder="user@example.com" value="{{defaultEmail}}">

              <label for="url-input">URL Input:</label>
              <input type="url" id="url-input" name="urlInput" placeholder="https://example.com">

              <label for="tel-input">Phone Input:</label>
              <input type="tel" id="tel-input" name="telInput" placeholder="(555) 123-4567">

              <label for="search-input">Search Input:</label>
              <input type="search" id="search-input" name="searchInput" placeholder="Search...">
            </div>

            <!-- Number and Date Inputs -->
            <div class="form-section">
              <h3>Number and Date Fields</h3>
              <label for="number-input">Number Input:</label>
              <input type="number" id="number-input" name="numberInput" min="0" max="100" value="{{defaultNumber}}">

              <label for="range-input">Range Input:</label>
              <input type="range" id="range-input" name="rangeInput" min="0" max="100" value="50">

              <label for="date-input">Date Input:</label>
              <input type="date" id="date-input" name="dateInput" value="{{defaultDate}}">

              <label for="time-input">Time Input:</label>
              <input type="time" id="time-input" name="timeInput">

              <label for="datetime-input">DateTime Input:</label>
              <input type="datetime-local" id="datetime-input" name="datetimeInput">
            </div>

            <!-- Selection Fields -->
            <div class="form-section">
              <h3>Selection Fields</h3>
              <label for="select-single">Single Select:</label>
              <select id="select-single" name="selectSingle">
                <option value="">Choose an option</option>
                <option value="option1">Option 1</option>
                <option value="option2">Option 2</option>
                <option value="option3">Option 3</option>
              </select>

              <label for="select-multiple">Multiple Select:</label>
              <select id="select-multiple" name="selectMultiple" multiple size="4">
                <option value="item1">Item 1</option>
                <option value="item2">Item 2</option>
                <option value="item3">Item 3</option>
                <option value="item4">Item 4</option>
              </select>
            </div>

            <!-- Radio Buttons -->
            <div class="form-section">
              <h3>Radio Buttons</h3>
              <label>Choose your favorite color:</label>
              <div class="radio-group">
                <div class="radio-item">
                  <input type="radio" id="radio-red" name="favoriteColor" value="red">
                  <label for="radio-red">Red</label>
                </div>
                <div class="radio-item">
                  <input type="radio" id="radio-blue" name="favoriteColor" value="blue">
                  <label for="radio-blue">Blue</label>
                </div>
                <div class="radio-item">
                  <input type="radio" id="radio-green" name="favoriteColor" value="green" checked>
                  <label for="radio-green">Green</label>
                </div>
              </div>
            </div>

            <!-- Checkboxes -->
            <div class="form-section">
              <h3>Checkboxes</h3>
              <label>Select your interests:</label>
              <div class="checkbox-group">
                <div class="checkbox-item">
                  <input type="checkbox" id="checkbox-tech" name="interests" value="technology">
                  <label for="checkbox-tech">Technology</label>
                </div>
                <div class="checkbox-item">
                  <input type="checkbox" id="checkbox-sports" name="interests" value="sports">
                  <label for="checkbox-sports">Sports</label>
                </div>
                <div class="checkbox-item">
                  <input type="checkbox" id="checkbox-music" name="interests" value="music" checked>
                  <label for="checkbox-music">Music</label>
                </div>
                <div class="checkbox-item">
                  <input type="checkbox" id="checkbox-travel" name="interests" value="travel">
                  <label for="checkbox-travel">Travel</label>
                </div>
              </div>
            </div>

            <!-- File and Textarea -->
            <div class="form-section">
              <h3>File and Text Area</h3>
              <label for="file-input">File Upload:</label>
              <input type="file" id="file-input" name="fileInput" accept=".jpg,.png,.pdf,.txt">

              <label for="textarea-input">Text Area:</label>
              <textarea id="textarea-input" name="textareaInput" rows="4" placeholder="Enter long text here...">{{defaultTextarea}}</textarea>
            </div>

            <!-- Buttons -->
            <div class="form-section">
              <h3>Form Actions</h3>
              <button type="submit" id="submit-btn">Submit Form</button>
              <button type="reset" id="reset-btn">Reset Form</button>
              <button type="button" id="validate-btn" onclick="validateForm()">Validate Form</button>
              <button type="button" id="fill-btn" onclick="fillFormWithTestData()">Fill Test Data</button>
            </div>
          </form>

          <!-- Status Display -->
          <div class="status">
            <strong>Form Status:</strong><br>
            <div id="form-status">Ready for input</div>
            <div id="validation-results"></div>
          </div>

          <!-- Navigation Links -->
          <div style="margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 4px;">
            <strong>Navigation:</strong><br>
            <button onclick="location.href='test-page.html'">Go to Basic Test Page</button>
            <button onclick="location.href='page2.html'">Go to Page 2</button>
            <button onclick="location.href='iframe-test.html'">Go to Iframe Test</button>
          </div>
        </div>

        <script>
          // Set load timestamp
          document.addEventListener('DOMContentLoaded', () => {
            updateStatus('Form loaded and ready');
          });

          function updateStatus(message) {
            const statusElement = document.getElementById('form-status');
            const timestamp = new Date().toISOString();
            statusElement.innerHTML = \`\${message} at \${timestamp}\`;
          }

          function validateForm() {
            const form = document.getElementById('test-form');
            const results = [];

            // Validate required fields
            const textInput = document.getElementById('text-input').value;
            const emailInput = document.getElementById('email-input').value;

            if (!textInput.trim()) {
              results.push('❌ Text input is required');
            } else {
              results.push('✅ Text input is valid');
            }

            if (!emailInput.trim()) {
              results.push('❌ Email input is required');
            } else if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(emailInput)) {
              results.push('❌ Email format is invalid');
            } else {
              results.push('✅ Email input is valid');
            }

            document.getElementById('validation-results').innerHTML = results.join('<br>');
            updateStatus('Form validation completed');
          }

          function fillFormWithTestData() {
            // Fill form with test data
            document.getElementById('text-input').value = 'Test Text Input';
            document.getElementById('email-input').value = 'test@example.com';
            document.getElementById('url-input').value = 'https://example.com';
            document.getElementById('tel-input').value = '(555) 123-4567';
            document.getElementById('number-input').value = '42';
            document.getElementById('date-input').value = '2023-12-25';
            document.getElementById('time-input').value = '14:30';
            document.getElementById('select-single').value = 'option2';
            document.getElementById('textarea-input').value = 'This is test content for the textarea field.';

            // Select multiple options
            const multiSelect = document.getElementById('select-multiple');
            multiSelect.options[1].selected = true;
            multiSelect.options[2].selected = true;

            // Check some checkboxes
            document.getElementById('checkbox-tech').checked = true;
            document.getElementById('checkbox-sports').checked = true;

            updateStatus('Form filled with test data');
          }

          // Form submission handler
          document.getElementById('test-form').addEventListener('submit', (e) => {
            e.preventDefault();
            updateStatus('Form submission prevented (test mode)');

            // Collect form data
            const formData = new FormData(e.target);
            const data = {};
            for (let [key, value] of formData.entries()) {
              data[key] = value;
            }

            console.log('Form data:', data);
            document.getElementById('validation-results').innerHTML =
              'Form data logged to console (F12 to view)';
          });

          // Add a unique identifier for this page instance
          window.pageInstance = Math.random().toString(36).substr(2, 9);

          // Expose test helpers to global scope
          window.testHelpers = {
            getPageInstance: () => window.pageInstance,
            fillForm: fillFormWithTestData,
            validateForm: validateForm,
            getFormData: () => {
              const formData = new FormData(document.getElementById('test-form'));
              const data = {};
              for (let [key, value] of formData.entries()) {
                data[key] = value;
              }
              return data;
            },
            submitForm: () => document.getElementById('test-form').dispatchEvent(new Event('submit')),
            resetForm: () => document.getElementById('test-form').reset()
          };
        </script>
      </body>
      </html>
    `;

    const defaultVariables: TemplateVariables = {
      title: 'Form Test Page',
      backgroundColor: '#f0f8ff',
      description: 'This page tests various form input types, validation, and interaction for browser automation testing.',
      defaultText: 'Sample text',
      defaultEmail: 'user@example.com',
      defaultNumber: '25',
      defaultDate: '2023-12-01',
      defaultTextarea: 'Default textarea content for testing purposes.'
    };

    return TemplateProcessor.process(template, { ...defaultVariables, ...variables });
  },

  /**
   * Create an iframe test page template with variable injection
   */
  iframeTest: (variables: TemplateVariables = {}) => {
    const template = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>{{title}}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: {{backgroundColor}};
          }
          .container {
            max-width: 1000px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          .iframe-section {
            margin: 20px 0;
            border: 2px solid #ddd;
            border-radius: 8px;
            overflow: hidden;
          }
          iframe {
            width: 100%;
            height: {{iframeHeight}};
            border: none;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>{{title}}</h1>
          <p>{{description}}</p>

          <div class="iframe-section">
            <iframe id="test-iframe" src="{{iframeSrc}}" title="{{iframeTitle}}"></iframe>
          </div>

          <button onclick="changeIframeSrc('{{alternateIframeSrc}}')">Load Alternate Content</button>
        </div>

        <script>
          function changeIframeSrc(newSrc) {
            document.getElementById('test-iframe').src = newSrc;
          }

          window.testHelpers = {
            getPageInstance: () => Math.random().toString(36).substr(2, 9),
            changeIframeSrc: changeIframeSrc
          };
        </script>
      </body>
      </html>
    `;

    const defaultVariables: TemplateVariables = {
      title: 'Iframe Test Page',
      backgroundColor: '#f5f5f5',
      description: 'This page tests iframe loading and navigation.',
      iframeSrc: 'test-page.html',
      alternateIframeSrc: 'page2.html',
      iframeTitle: 'Test iframe',
      iframeHeight: '400px'
    };

    return TemplateProcessor.process(template, { ...defaultVariables, ...variables });
  },

  /**
   * Create a navigation test page with links and template variables
   */
  navigationTest: (variables: TemplateVariables = {}) => {
    const template = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>{{title}}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: {{backgroundColor}};
          }
          .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          .nav-links {
            margin: 20px 0;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 8px;
          }
          .nav-links a {
            display: inline-block;
            margin: 5px 10px 5px 0;
            padding: 10px 15px;
            background: {{linkColor}};
            color: white;
            text-decoration: none;
            border-radius: 4px;
          }
          .nav-links a:hover {
            opacity: 0.8;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1 id="page-title">{{title}}</h1>
          <p>{{description}}</p>

          <div class="nav-links">
            <h3>Navigation Links:</h3>
            {{#linkUrls}}
            <a href="{{url}}">{{text}}</a>
            {{/linkUrls}}
          </div>

          <p>Use this page to test navigation between multiple pages.</p>
          <p>Page loaded at: <span id="load-time"></span></p>
        </div>

        <script>
          document.getElementById('load-time').textContent = new Date().toISOString();

          window.testHelpers = {
            getPageInstance: () => Math.random().toString(36).substr(2, 9),
            getLoadTime: () => document.getElementById('load-time').textContent
          };
        </script>
      </body>
      </html>
    `;

    const defaultVariables: TemplateVariables = {
      title: 'Navigation Test Page',
      backgroundColor: '#e8f5e8',
      description: 'This page contains multiple navigation links for testing browser navigation capabilities.',
      linkColor: '#007bff'
    };

    // Note: Complex template features like loops would need a more sophisticated template engine
    // For now, we'll handle simple variable substitution
    return TemplateProcessor.process(template, { ...defaultVariables, ...variables });
  }
};

/**
 * Navigation Template Builder - for creating sophisticated navigation test scenarios
 */
export class NavigationTemplateBuilder {
  private links: Array<{ url: string; text: string; target?: string }> = [];
  private title: string = 'Navigation Test Page';
  private backgroundColor: string = '#ffffff';
  private description: string = 'Navigation test page with dynamic links';

  setTitle(title: string): NavigationTemplateBuilder {
    this.title = title;
    return this;
  }

  setBackgroundColor(color: string): NavigationTemplateBuilder {
    this.backgroundColor = color;
    return this;
  }

  setDescription(description: string): NavigationTemplateBuilder {
    this.description = description;
    return this;
  }

  addLink(url: string, text: string, target?: string): NavigationTemplateBuilder {
    this.links.push({ url, text, target });
    return this;
  }

  addMultipleLinks(links: Array<{ url: string; text: string; target?: string }>): NavigationTemplateBuilder {
    this.links.push(...links);
    return this;
  }

  generateLinksHtml(): string {
    return this.links
      .map(link => {
        const targetAttr = link.target ? ` target="${link.target}"` : '';
        return `<a href="${link.url}"${targetAttr}>${link.text}</a>`;
      })
      .join('\n            ');
  }

  build(): string {
    const template = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${this.title}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: ${this.backgroundColor};
          }
          .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          .nav-links {
            margin: 20px 0;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 8px;
          }
          .nav-links a {
            display: inline-block;
            margin: 8px 10px 8px 0;
            padding: 12px 20px;
            background: #007bff;
            color: white;
            text-decoration: none;
            border-radius: 6px;
            transition: all 0.3s ease;
          }
          .nav-links a:hover {
            background: #0056b3;
            transform: translateY(-2px);
          }
          .page-info {
            margin: 20px 0;
            padding: 15px;
            background: #e9ecef;
            border-radius: 4px;
            font-family: monospace;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1 id="page-title">${this.title}</h1>
          <p>${this.description}</p>

          <div class="nav-links">
            <h3>Navigation Links (${this.links.length} total):</h3>
            ${this.generateLinksHtml()}
          </div>

          <div class="page-info">
            <strong>Page Information:</strong><br>
            Links Count: <span id="links-count">${this.links.length}</span><br>
            Load Time: <span id="load-time"></span><br>
            Page Instance: <span id="page-instance"></span>
          </div>
        </div>

        <script>
          // Initialize page
          document.addEventListener('DOMContentLoaded', () => {
            document.getElementById('load-time').textContent = new Date().toISOString();
            const instance = Math.random().toString(36).substr(2, 9);
            document.getElementById('page-instance').textContent = instance;
            window.pageInstance = instance;
          });

          // Expose test helpers
          window.testHelpers = {
            getPageInstance: () => window.pageInstance,
            getLoadTime: () => document.getElementById('load-time').textContent,
            getLinksCount: () => document.querySelectorAll('.nav-links a').length,
            getAllLinks: () => Array.from(document.querySelectorAll('.nav-links a')).map(a => ({
              href: a.href,
              text: a.textContent,
              target: a.target
            }))
          };
        </script>
      </body>
      </html>
    `;

    return template.trim();
  }
}

/**
 * Form Template Builder - for creating sophisticated form test scenarios
 */
export class FormTemplateBuilder {
  private fields: Array<{ type: string; id: string; name: string; label: string; attributes?: Record<string, string> }> = [];
  private title: string = 'Form Test Page';
  private backgroundColor: string = '#f0f8ff';
  private sections: Array<{ title: string; fields: string[] }> = [];

  setTitle(title: string): FormTemplateBuilder {
    this.title = title;
    return this;
  }

  setBackgroundColor(color: string): FormTemplateBuilder {
    this.backgroundColor = color;
    return this;
  }

  addTextField(id: string, label: string, attributes: Record<string, string> = {}): FormTemplateBuilder {
    this.fields.push({ type: 'text', id, name: id, label, attributes });
    return this;
  }

  addEmailField(id: string, label: string, attributes: Record<string, string> = {}): FormTemplateBuilder {
    this.fields.push({ type: 'email', id, name: id, label, attributes });
    return this;
  }

  addPasswordField(id: string, label: string, attributes: Record<string, string> = {}): FormTemplateBuilder {
    this.fields.push({ type: 'password', id, name: id, label, attributes });
    return this;
  }

  addNumberField(id: string, label: string, min?: number, max?: number, attributes: Record<string, string> = {}): FormTemplateBuilder {
    const attrs = { ...attributes };
    if (min !== undefined) attrs.min = String(min);
    if (max !== undefined) attrs.max = String(max);
    this.fields.push({ type: 'number', id, name: id, label, attributes: attrs });
    return this;
  }

  addSelectField(id: string, label: string, options: Array<{ value: string; text: string }>, attributes: Record<string, string> = {}): FormTemplateBuilder {
    const optionsHtml = options.map(opt => `<option value="${opt.value}">${opt.text}</option>`).join('');
    this.fields.push({
      type: 'select',
      id,
      name: id,
      label,
      attributes: { ...attributes, innerHTML: optionsHtml }
    });
    return this;
  }

  addTextareaField(id: string, label: string, rows: number = 4, attributes: Record<string, string> = {}): FormTemplateBuilder {
    this.fields.push({ type: 'textarea', id, name: id, label, attributes: { ...attributes, rows: String(rows) } });
    return this;
  }

  generateFieldsHtml(): string {
    return this.fields.map(field => {
      const attrs = Object.entries(field.attributes || {})
        .filter(([key]) => key !== 'innerHTML')
        .map(([key, value]) => `${key}="${value}"`)
        .join(' ');

      let fieldHtml = '';
      if (field.type === 'select') {
        fieldHtml = `<select id="${field.id}" name="${field.name}" ${attrs}>${field.attributes?.innerHTML || ''}</select>`;
      } else if (field.type === 'textarea') {
        fieldHtml = `<textarea id="${field.id}" name="${field.name}" ${attrs}></textarea>`;
      } else {
        fieldHtml = `<input type="${field.type}" id="${field.id}" name="${field.name}" ${attrs}>`;
      }

      return `
        <div class="form-field">
          <label for="${field.id}">${field.label}:</label>
          ${fieldHtml}
        </div>`;
    }).join('');
  }

  build(): string {
    const template = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${this.title}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: ${this.backgroundColor};
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          .form-field {
            margin: 15px 0;
          }
          label {
            display: block;
            margin: 5px 0;
            font-weight: bold;
            color: #333;
          }
          input, textarea, select {
            width: 100%;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 14px;
            box-sizing: border-box;
          }
          button {
            padding: 12px 24px;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            margin: 10px 5px;
            font-size: 14px;
          }
          button:hover {
            background: #0056b3;
          }
          .form-actions {
            margin: 20px 0;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>${this.title}</h1>

          <form id="test-form">
            ${this.generateFieldsHtml()}

            <div class="form-actions">
              <button type="submit">Submit</button>
              <button type="reset">Reset</button>
              <button type="button" onclick="fillTestData()">Fill Test Data</button>
            </div>
          </form>

          <div id="form-status" style="margin-top: 20px; padding: 10px; background: #f8f9fa; border-radius: 4px;">
            Form ready for testing
          </div>
        </div>

        <script>
          function fillTestData() {
            // Fill form with sample test data
            const fields = document.querySelectorAll('#test-form input, #test-form textarea, #test-form select');
            fields.forEach((field, index) => {
              if (field.type === 'text') field.value = \`Test Text \${index + 1}\`;
              else if (field.type === 'email') field.value = 'test@example.com';
              else if (field.type === 'number') field.value = '42';
              else if (field.type === 'password') field.value = 'testpassword';
              else if (field.tagName === 'TEXTAREA') field.value = 'Sample textarea content';
              else if (field.tagName === 'SELECT' && field.options.length > 1) field.selectedIndex = 1;
            });
            document.getElementById('form-status').textContent = 'Form filled with test data';
          }

          document.getElementById('test-form').addEventListener('submit', (e) => {
            e.preventDefault();
            document.getElementById('form-status').textContent = 'Form submitted (prevented in test mode)';
          });

          window.testHelpers = {
            fillTestData: fillTestData,
            getFormData: () => {
              const formData = new FormData(document.getElementById('test-form'));
              return Object.fromEntries(formData.entries());
            },
            getFieldsCount: () => document.querySelectorAll('#test-form input, #test-form textarea, #test-form select').length
          };
        </script>
      </body>
      </html>
    `;

    return template.trim();
  }
}

/**
 * Test data generators
 */
export const TestDataGenerators = {
  /**
   * Generate test content with specified number of elements
   */
  generateHeavyContent: (elementCount: number): string => {
    const elements = Array.from({ length: elementCount }, (_, i) =>
      `<div style="padding:10px;background:hsl(${i % 360}, 50%, 75%);">Element ${i + 1}</div>`
    ).join('');

    return `
      <html>
        <body>
          <h1>Heavy Content Test (${elementCount} elements)</h1>
          ${elements}
        </body>
      </html>
    `;
  },

  /**
   * Generate random color values
   */
  randomColor: (): string => {
    const hue = Math.floor(Math.random() * 360);
    const saturation = 50 + Math.floor(Math.random() * 50);
    const lightness = 40 + Math.floor(Math.random() * 40);
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  },

  /**
   * Generate test page with random content
   */
  randomTestPage: (): string => {
    const backgroundColor = TestDataGenerators.randomColor();
    const textColor = TestDataGenerators.randomColor();
    const numElements = Math.floor(Math.random() * 50) + 10;

    const elements = Array.from({ length: numElements }, (_, i) =>
      `<p style="color:${TestDataGenerators.randomColor()};">Random content ${i + 1}</p>`
    ).join('');

    return `
      <html>
        <body style="background:${backgroundColor};color:${textColor};padding:20px;">
          <h1>Random Test Page</h1>
          ${elements}
        </body>
      </html>
    `;
  }
};