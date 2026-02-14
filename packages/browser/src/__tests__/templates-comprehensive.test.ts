/**
 * @apexcli/browser - Comprehensive Template System Tests
 *
 * Tests for HTML page templates for navigation testing including:
 * - TemplateProcessor variable injection system
 * - TestPages template generation
 * - Template builders (NavigationTemplateBuilder, FormTemplateBuilder)
 * - HTML fixture validation
 * - Test data generators
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  TemplateProcessor,
  TemplateVariables,
  TestPages,
  NavigationTemplateBuilder,
  FormTemplateBuilder,
  TestDataGenerators
} from '../test-utils/test-pages.js';
import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { JSDOM } from 'jsdom';

describe('Template System - Comprehensive Tests', () => {

  describe('TemplateProcessor', () => {
    it('should process simple variable substitution', () => {
      const template = 'Hello {{name}}, your age is {{age}}';
      const variables: TemplateVariables = { name: 'John', age: 25 };

      const result = TemplateProcessor.process(template, variables);

      expect(result).toBe('Hello John, your age is 25');
    });

    it('should handle missing variables by leaving placeholders intact', () => {
      const template = 'Hello {{name}}, your role is {{role}}';
      const variables: TemplateVariables = { name: 'John' };

      const result = TemplateProcessor.process(template, variables);

      expect(result).toBe('Hello John, your role is {{role}}');
    });

    it('should handle boolean and numeric variables', () => {
      const template = 'Active: {{active}}, Count: {{count}}';
      const variables: TemplateVariables = { active: true, count: 42 };

      const result = TemplateProcessor.process(template, variables);

      expect(result).toBe('Active: true, Count: 42');
    });

    it('should handle empty template', () => {
      const template = '';
      const variables: TemplateVariables = { name: 'John' };

      const result = TemplateProcessor.process(template, variables);

      expect(result).toBe('');
    });

    it('should handle template with no variables', () => {
      const template = 'Static content without variables';
      const variables: TemplateVariables = { name: 'John' };

      const result = TemplateProcessor.process(template, variables);

      expect(result).toBe('Static content without variables');
    });

    it('should create processor with default variables', () => {
      const defaultVariables: TemplateVariables = { name: 'Default', age: 30 };
      const processor = TemplateProcessor.createProcessor(defaultVariables);

      const result1 = processor('Hello {{name}}, age {{age}}');
      expect(result1).toBe('Hello Default, age 30');

      const result2 = processor('Hello {{name}}, age {{age}}', { age: 25 });
      expect(result2).toBe('Hello Default, age 25');

      const result3 = processor('Hello {{name}}, age {{age}}', { name: 'Override', age: 35 });
      expect(result3).toBe('Hello Override, age 35');
    });

    it('should handle special characters in variables', () => {
      const template = 'Message: {{message}}';
      const variables: TemplateVariables = { message: 'Hello & "World" <test>' };

      const result = TemplateProcessor.process(template, variables);

      expect(result).toBe('Message: Hello & "World" <test>');
    });
  });

  describe('TestPages Templates', () => {
    describe('simple() template', () => {
      it('should generate basic HTML with default parameters', () => {
        const html = TestPages.simple();

        expect(html).toContain('<title>Test Page</title>');
        expect(html).toContain('<h1>Test Page</h1>');
        expect(html).toContain('background:#ffffff');
        expect(html).toContain('This is a test page for screenshot utilities');
      });

      it('should accept custom title and background color', () => {
        const html = TestPages.simple('Custom Title', '#ff0000');

        expect(html).toContain('<title>Custom Title</title>');
        expect(html).toContain('<h1>Custom Title</h1>');
        expect(html).toContain('background:#ff0000');
      });

      it('should generate valid HTML structure', () => {
        const html = TestPages.simple();
        const dom = new JSDOM(html);
        const document = dom.window.document;

        expect(document.querySelector('html')).toBeTruthy();
        expect(document.querySelector('head')).toBeTruthy();
        expect(document.querySelector('body')).toBeTruthy();
        expect(document.querySelector('title')).toBeTruthy();
        expect(document.querySelector('h1')).toBeTruthy();
      });
    });

    describe('tall() template', () => {
      it('should generate tall page with default height', () => {
        const html = TestPages.tall();

        expect(html).toContain('height:5000px');
        expect(html).toContain('Tall Page Test');
        expect(html).toContain('Middle Content');
        expect(html).toContain('Bottom Content');
      });

      it('should accept custom height', () => {
        const html = TestPages.tall(3000);

        expect(html).toContain('height:3000px');
      });

      it('should include gradient background and positioned elements', () => {
        const html = TestPages.tall();

        expect(html).toContain('linear-gradient');
        expect(html).toContain('position:absolute');
        expect(html).toContain('top:50%');
        expect(html).toContain('bottom:20px');
      });
    });

    describe('complex() template', () => {
      it('should generate complex page with CSS animations', () => {
        const html = TestPages.complex();

        expect(html).toContain('@keyframes pulse');
        expect(html).toContain('animation: pulse');
        expect(html).toContain('Complex Test Page');
        expect(html).toContain('gradient-text');
      });

      it('should include multiple CSS features', () => {
        const html = TestPages.complex();

        expect(html).toContain('border-radius');
        expect(html).toContain('box-shadow');
        expect(html).toContain('rgba(');
        expect(html).toContain('background-clip: text');
        expect(html).toContain('CSS Gradients');
        expect(html).toContain('Animations');
      });
    });

    describe('unicode() template', () => {
      it('should include unicode characters and multiple languages', () => {
        const html = TestPages.unicode();

        expect(html).toContain('🌟');
        expect(html).toContain('🚀🎉🔥💯⚡🌈🎨');
        expect(html).toContain('你好');
        expect(html).toContain('こんにちは');
        expect(html).toContain('Здравствуйте');
        expect(html).toContain('مرحبا');
        expect(html).toContain('$¥€£₹₿');
        expect(html).toContain('UTF-8');
      });
    });

    describe('empty() template', () => {
      it('should generate minimal HTML', () => {
        const html = TestPages.empty();

        expect(html).toBe('<html><body></body></html>');
      });
    });

    describe('transparent() template', () => {
      it('should generate page with transparent background', () => {
        const html = TestPages.transparent();

        expect(html).toContain('background:transparent');
        expect(html).toContain('Transparent Background');
      });
    });
  });

  describe('Form Template', () => {
    it('should generate comprehensive form with default variables', () => {
      const html = TestPages.formTest();

      // Check template variable substitution
      expect(html).toContain('<title>Form Test Page</title>');
      expect(html).toContain('background-color: #f0f8ff');
      expect(html).toContain('value="Sample text"');
      expect(html).toContain('value="user@example.com"');
      expect(html).toContain('value="25"');

      // Check form structure
      expect(html).toContain('id="test-form"');
      expect(html).toContain('Text Input Fields');
      expect(html).toContain('Number and Date Fields');
      expect(html).toContain('Selection Fields');
      expect(html).toContain('Radio Buttons');
      expect(html).toContain('Checkboxes');
    });

    it('should accept custom variables', () => {
      const variables: TemplateVariables = {
        title: 'Custom Form',
        backgroundColor: '#ffeeee',
        defaultText: 'Custom Text',
        defaultEmail: 'custom@test.com',
        defaultNumber: '99'
      };

      const html = TestPages.formTest(variables);

      expect(html).toContain('<title>Custom Form</title>');
      expect(html).toContain('background-color: #ffeeee');
      expect(html).toContain('value="Custom Text"');
      expect(html).toContain('value="custom@test.com"');
      expect(html).toContain('value="99"');
    });

    it('should include form validation JavaScript', () => {
      const html = TestPages.formTest();

      expect(html).toContain('function validateForm()');
      expect(html).toContain('function fillFormWithTestData()');
      expect(html).toContain('window.testHelpers');
      expect(html).toContain('getFormData');
      expect(html).toContain('submitForm');
    });

    it('should include comprehensive form input types', () => {
      const html = TestPages.formTest();

      // Text inputs
      expect(html).toContain('type="text"');
      expect(html).toContain('type="email"');
      expect(html).toContain('type="password"');
      expect(html).toContain('type="url"');
      expect(html).toContain('type="tel"');
      expect(html).toContain('type="search"');

      // Number and date inputs
      expect(html).toContain('type="number"');
      expect(html).toContain('type="range"');
      expect(html).toContain('type="date"');
      expect(html).toContain('type="time"');
      expect(html).toContain('type="datetime-local"');

      // Selection inputs
      expect(html).toContain('<select');
      expect(html).toContain('multiple');
      expect(html).toContain('type="radio"');
      expect(html).toContain('type="checkbox"');
      expect(html).toContain('type="file"');
      expect(html).toContain('<textarea');
    });

    it('should generate valid HTML form structure', () => {
      const html = TestPages.formTest();
      const dom = new JSDOM(html);
      const document = dom.window.document;

      expect(document.querySelector('form')).toBeTruthy();
      expect(document.querySelector('input[type="text"]')).toBeTruthy();
      expect(document.querySelector('input[type="email"]')).toBeTruthy();
      expect(document.querySelector('select')).toBeTruthy();
      expect(document.querySelector('textarea')).toBeTruthy();
      expect(document.querySelector('input[type="checkbox"]')).toBeTruthy();
      expect(document.querySelector('input[type="radio"]')).toBeTruthy();
      expect(document.querySelector('button[type="submit"]')).toBeTruthy();
    });
  });

  describe('Iframe Template', () => {
    it('should generate iframe test page with default variables', () => {
      const html = TestPages.iframeTest();

      expect(html).toContain('<title>Iframe Test Page</title>');
      expect(html).toContain('background-color: #f5f5f5');
      expect(html).toContain('src="test-page.html"');
      expect(html).toContain('height: 400px');
      expect(html).toContain('changeIframeSrc');
    });

    it('should accept custom variables', () => {
      const variables: TemplateVariables = {
        title: 'Custom Iframe Test',
        backgroundColor: '#eeeeff',
        iframeSrc: 'custom-page.html',
        iframeHeight: '600px'
      };

      const html = TestPages.iframeTest(variables);

      expect(html).toContain('<title>Custom Iframe Test</title>');
      expect(html).toContain('background-color: #eeeeff');
      expect(html).toContain('src="custom-page.html"');
      expect(html).toContain('height: 600px');
    });

    it('should include iframe manipulation functionality', () => {
      const html = TestPages.iframeTest();

      expect(html).toContain('function changeIframeSrc');
      expect(html).toContain('window.testHelpers');
      expect(html).toContain('getPageInstance');
      expect(html).toContain('Load Alternate Content');
    });
  });

  describe('Navigation Template', () => {
    it('should generate navigation test page with default variables', () => {
      const html = TestPages.navigationTest();

      expect(html).toContain('<title>Navigation Test Page</title>');
      expect(html).toContain('background-color: #e8f5e8');
      expect(html).toContain('multiple navigation links');
      expect(html).toContain('#007bff');
    });

    it('should accept custom variables', () => {
      const variables: TemplateVariables = {
        title: 'Custom Navigation',
        backgroundColor: '#fff0f0',
        linkColor: '#ff0000'
      };

      const html = TestPages.navigationTest(variables);

      expect(html).toContain('<title>Custom Navigation</title>');
      expect(html).toContain('background-color: #fff0f0');
      expect(html).toContain('#ff0000');
    });
  });

  describe('NavigationTemplateBuilder', () => {
    let builder: NavigationTemplateBuilder;

    beforeEach(() => {
      builder = new NavigationTemplateBuilder();
    });

    it('should build basic navigation page', () => {
      const html = builder.build();

      expect(html).toContain('<title>Navigation Test Page</title>');
      expect(html).toContain('background-color: #ffffff');
      expect(html).toContain('Links Count: 0');
    });

    it('should allow customization of title and styling', () => {
      const html = builder
        .setTitle('Custom Nav Page')
        .setBackgroundColor('#f0f0f0')
        .setDescription('Custom description')
        .build();

      expect(html).toContain('<title>Custom Nav Page</title>');
      expect(html).toContain('background-color: #f0f0f0');
      expect(html).toContain('Custom description');
    });

    it('should add single links', () => {
      const html = builder
        .addLink('page1.html', 'Page 1')
        .addLink('page2.html', 'Page 2', '_blank')
        .build();

      expect(html).toContain('href="page1.html">Page 1</a>');
      expect(html).toContain('href="page2.html" target="_blank">Page 2</a>');
      expect(html).toContain('Links Count: 2');
    });

    it('should add multiple links at once', () => {
      const links = [
        { url: 'home.html', text: 'Home' },
        { url: 'about.html', text: 'About', target: '_self' },
        { url: 'contact.html', text: 'Contact' }
      ];

      const html = builder.addMultipleLinks(links).build();

      expect(html).toContain('href="home.html">Home</a>');
      expect(html).toContain('href="about.html" target="_self">About</a>');
      expect(html).toContain('href="contact.html">Contact</a>');
      expect(html).toContain('Links Count: 3');
    });

    it('should include JavaScript test helpers', () => {
      const html = builder.build();

      expect(html).toContain('window.testHelpers');
      expect(html).toContain('getPageInstance');
      expect(html).toContain('getLinksCount');
      expect(html).toContain('getAllLinks');
    });

    it('should generate valid HTML structure', () => {
      const html = builder
        .addLink('test.html', 'Test')
        .build();

      const dom = new JSDOM(html);
      const document = dom.window.document;

      expect(document.querySelector('html')).toBeTruthy();
      expect(document.querySelector('head')).toBeTruthy();
      expect(document.querySelector('body')).toBeTruthy();
      expect(document.querySelector('.nav-links')).toBeTruthy();
      expect(document.querySelector('a[href="test.html"]')).toBeTruthy();
      expect(document.querySelector('#page-instance')).toBeTruthy();
    });
  });

  describe('FormTemplateBuilder', () => {
    let builder: FormTemplateBuilder;

    beforeEach(() => {
      builder = new FormTemplateBuilder();
    });

    it('should build basic form page', () => {
      const html = builder.build();

      expect(html).toContain('<title>Form Test Page</title>');
      expect(html).toContain('background-color: #f0f8ff');
      expect(html).toContain('<form id="test-form">');
    });

    it('should allow customization', () => {
      const html = builder
        .setTitle('Custom Form')
        .setBackgroundColor('#fff0f0')
        .build();

      expect(html).toContain('<title>Custom Form</title>');
      expect(html).toContain('background-color: #fff0f0');
    });

    it('should add various field types', () => {
      const html = builder
        .addTextField('name', 'Full Name', { placeholder: 'Enter name' })
        .addEmailField('email', 'Email Address', { required: 'true' })
        .addPasswordField('password', 'Password')
        .addNumberField('age', 'Age', 18, 100)
        .addTextareaField('comments', 'Comments', 5)
        .build();

      expect(html).toContain('type="text" id="name"');
      expect(html).toContain('placeholder="Enter name"');
      expect(html).toContain('type="email" id="email"');
      expect(html).toContain('required="true"');
      expect(html).toContain('type="password" id="password"');
      expect(html).toContain('type="number" id="age"');
      expect(html).toContain('min="18" max="100"');
      expect(html).toContain('<textarea id="comments"');
      expect(html).toContain('rows="5"');
    });

    it('should add select fields with options', () => {
      const options = [
        { value: 'opt1', text: 'Option 1' },
        { value: 'opt2', text: 'Option 2' }
      ];

      const html = builder
        .addSelectField('category', 'Category', options)
        .build();

      expect(html).toContain('<select id="category"');
      expect(html).toContain('<option value="opt1">Option 1</option>');
      expect(html).toContain('<option value="opt2">Option 2</option>');
    });

    it('should include JavaScript functionality', () => {
      const html = builder.build();

      expect(html).toContain('function fillTestData()');
      expect(html).toContain('window.testHelpers');
      expect(html).toContain('getFormData');
      expect(html).toContain('getFieldsCount');
    });

    it('should generate valid HTML form structure', () => {
      const html = builder
        .addTextField('test', 'Test Field')
        .build();

      const dom = new JSDOM(html);
      const document = dom.window.document;

      expect(document.querySelector('form#test-form')).toBeTruthy();
      expect(document.querySelector('input[type="text"]')).toBeTruthy();
      expect(document.querySelector('button[type="submit"]')).toBeTruthy();
      expect(document.querySelector('button[type="reset"]')).toBeTruthy();
    });
  });

  describe('TestDataGenerators', () => {
    describe('generateHeavyContent()', () => {
      it('should generate specified number of elements', () => {
        const html = TestDataGenerators.generateHeavyContent(100);

        expect(html).toContain('Heavy Content Test (100 elements)');
        expect(html).toContain('Element 1');
        expect(html).toContain('Element 100');

        // Count actual elements in generated HTML
        const elementMatches = html.match(/Element \d+/g);
        expect(elementMatches).toHaveLength(100);
      });

      it('should generate unique colors for elements', () => {
        const html = TestDataGenerators.generateHeavyContent(10);

        // Check that different hue values are used
        const hueMatches = html.match(/hsl\((\d+),/g);
        expect(hueMatches!.length).toBeGreaterThan(5); // Should have multiple different hues
      });
    });

    describe('randomColor()', () => {
      it('should generate valid HSL color strings', () => {
        for (let i = 0; i < 10; i++) {
          const color = TestDataGenerators.randomColor();

          expect(color).toMatch(/^hsl\(\d+, \d+%, \d+%\)$/);

          // Extract values and validate ranges
          const match = color.match(/hsl\((\d+), (\d+)%, (\d+)%\)/);
          expect(match).toBeTruthy();

          const [, hue, saturation, lightness] = match!;
          expect(parseInt(hue)).toBeGreaterThanOrEqual(0);
          expect(parseInt(hue)).toBeLessThan(360);
          expect(parseInt(saturation)).toBeGreaterThanOrEqual(50);
          expect(parseInt(saturation)).toBeLessThan(100);
          expect(parseInt(lightness)).toBeGreaterThanOrEqual(40);
          expect(parseInt(lightness)).toBeLessThan(80);
        }
      });

      it('should generate different colors on multiple calls', () => {
        const colors = new Set();
        for (let i = 0; i < 50; i++) {
          colors.add(TestDataGenerators.randomColor());
        }

        // Should generate at least 10 different colors in 50 calls
        expect(colors.size).toBeGreaterThan(10);
      });
    });

    describe('randomTestPage()', () => {
      it('should generate valid HTML with random content', () => {
        const html = TestDataGenerators.randomTestPage();

        expect(html).toContain('<html>');
        expect(html).toContain('<body');
        expect(html).toContain('Random Test Page');
        expect(html).toContain('Random content');

        // Should contain color styles
        expect(html).toContain('hsl(');
      });

      it('should generate different content on multiple calls', () => {
        const pages = new Set();
        for (let i = 0; i < 5; i++) {
          pages.add(TestDataGenerators.randomTestPage());
        }

        // All pages should be different
        expect(pages.size).toBe(5);
      });

      it('should generate valid HTML structure', () => {
        const html = TestDataGenerators.randomTestPage();
        const dom = new JSDOM(html);
        const document = dom.window.document;

        expect(document.querySelector('html')).toBeTruthy();
        expect(document.querySelector('body')).toBeTruthy();
        expect(document.querySelector('h1')).toBeTruthy();
        expect(document.querySelectorAll('p').length).toBeGreaterThan(10);
      });
    });
  });

  describe('Integration Tests', () => {
    it('should work together - template with builder and processor', () => {
      // Use template processor with navigation builder
      const customVariables: TemplateVariables = {
        title: 'Integrated Test Page',
        backgroundColor: '#f0f8ff'
      };

      const builder = new NavigationTemplateBuilder();
      const html = builder
        .setTitle(customVariables.title as string)
        .setBackgroundColor(customVariables.backgroundColor as string)
        .addLink('page1.html', 'Page 1')
        .addLink('page2.html', 'Page 2')
        .build();

      expect(html).toContain('Integrated Test Page');
      expect(html).toContain('#f0f8ff');
      expect(html).toContain('href="page1.html"');
      expect(html).toContain('href="page2.html"');
    });

    it('should handle complex template scenarios', () => {
      // Test form template with custom data generator content
      const formHtml = TestPages.formTest({
        title: 'Generated Form',
        defaultText: TestDataGenerators.randomColor(),
        defaultNumber: '42'
      });

      expect(formHtml).toContain('Generated Form');
      expect(formHtml).toContain('hsl('); // From random color generator
      expect(formHtml).toContain('value="42"');
    });

    it('should generate templates that work with DOM parsing', () => {
      // Test that all major templates generate parseable HTML
      const templates = [
        TestPages.simple(),
        TestPages.tall(),
        TestPages.complex(),
        TestPages.formTest(),
        TestPages.iframeTest(),
        TestPages.navigationTest(),
        new NavigationTemplateBuilder().addLink('test.html', 'Test').build(),
        new FormTemplateBuilder().addTextField('test', 'Test').build()
      ];

      templates.forEach((html, index) => {
        expect(() => new JSDOM(html)).not.toThrow();
        const dom = new JSDOM(html);
        expect(dom.window.document.querySelector('html')).toBeTruthy();
      });
    });
  });

  describe('Template Acceptance Criteria Validation', () => {
    it('should have at least 4 HTML templates as specified', () => {
      // Test all major template types exist and work
      const basicPage = TestPages.simple();
      const linksPage = new NavigationTemplateBuilder()
        .addLink('page1.html', 'Page 1')
        .addLink('page2.html', 'Page 2')
        .build();
      const formPage = TestPages.formTest();
      const iframePage = TestPages.iframeTest();

      // Verify each template generates valid HTML
      expect(basicPage).toContain('<html>');
      expect(basicPage).toContain('<body>');

      expect(linksPage).toContain('<a href=');
      expect(linksPage).toContain('Page 1');

      expect(formPage).toContain('<form');
      expect(formPage).toContain('<input');

      expect(iframePage).toContain('<iframe');
    });

    it('should support dynamic content injection via template variables', () => {
      // Test variable injection across different templates
      const variables: TemplateVariables = {
        title: 'Dynamic Title',
        backgroundColor: '#customcolor',
        description: 'Dynamic Description'
      };

      const formHtml = TestPages.formTest(variables);
      const iframeHtml = TestPages.iframeTest(variables);

      expect(formHtml).toContain('Dynamic Title');
      expect(formHtml).toContain('#customcolor');
      expect(formHtml).toContain('Dynamic Description');

      expect(iframeHtml).toContain('Dynamic Title');
      expect(iframeHtml).toContain('#customcolor');
      expect(iframeHtml).toContain('Dynamic Description');
    });

    it('should provide comprehensive template functionality', () => {
      // Verify template system provides comprehensive functionality
      const processor = TemplateProcessor.createProcessor({ default: 'value' });
      expect(typeof processor).toBe('function');

      const navBuilder = new NavigationTemplateBuilder();
      expect(navBuilder.addLink).toBeTruthy();
      expect(navBuilder.build).toBeTruthy();

      const formBuilder = new FormTemplateBuilder();
      expect(formBuilder.addTextField).toBeTruthy();
      expect(formBuilder.build).toBeTruthy();

      expect(TestDataGenerators.generateHeavyContent).toBeTruthy();
      expect(TestDataGenerators.randomColor).toBeTruthy();
      expect(TestDataGenerators.randomTestPage).toBeTruthy();
    });

    it('should support reusable templates across different test scenarios', () => {
      // Test template reusability
      const baseVariables: TemplateVariables = { title: 'Base Test' };

      const scenario1 = { ...baseVariables, backgroundColor: '#ff0000' };
      const scenario2 = { ...baseVariables, backgroundColor: '#00ff00' };

      const page1 = TestPages.simple(scenario1.title as string, scenario1.backgroundColor as string);
      const page2 = TestPages.simple(scenario2.title as string, scenario2.backgroundColor as string);

      expect(page1).toContain('Base Test');
      expect(page1).toContain('#ff0000');
      expect(page2).toContain('Base Test');
      expect(page2).toContain('#00ff00');
      expect(page1).not.toEqual(page2);
    });
  });
});