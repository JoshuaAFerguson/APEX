/**
 * @fileoverview Template System Demo Tests
 *
 * Demonstrates the template system functionality and validates
 * template rendering with various configurations.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  Templates,
  TemplateConfigs,
  TemplateUtils,
  ExampleConfigs,
  TemplateValidation,
  type TemplateVariables
} from './templates';
import { EnhancedMockNavigationServer, EnhancedMockServerLifecycle } from './enhanced-mock-server';

describe('Template System Demo', () => {
  let mockServer: EnhancedMockNavigationServer;
  let baseUrl: string;

  beforeAll(async () => {
    mockServer = await EnhancedMockServerLifecycle.startForTest('template-demo', {
      verbose: true,
      useTemplates: true,
      defaultTemplateVariables: {
        global_test_mode: 'true'
      }
    });
    baseUrl = mockServer.baseUrl;
  });

  afterAll(async () => {
    await EnhancedMockServerLifecycle.stopForTest('template-demo');
  });

  describe('Basic Template Rendering', () => {
    it('should render basic page template', () => {
      const html = Templates.basicPage({
        title: 'Test Basic Page',
        heading: 'Test Heading',
        content: '<p>Test content</p>',
        page_id: 'test-basic'
      });

      expect(html).toContain('Test Basic Page');
      expect(html).toContain('Test Heading');
      expect(html).toContain('<p>Test content</p>');
      expect(html).toContain('data-page="test-basic"');
      expect(html).toContain('data-template="basic-page"');
    });

    it('should render links page template', () => {
      const customLinks = TemplateUtils.createNavigationLinks([
        { href: '/test1', text: 'Test Link 1' },
        { href: '/test2', text: 'Test Link 2' }
      ]);

      const html = Templates.linksPage({
        title: 'Test Links Page',
        heading: 'Test Links',
        description: 'Test description',
        page_id: 'test-links',
        internal_links: customLinks
      });

      expect(html).toContain('Test Links Page');
      expect(html).toContain('Test Links');
      expect(html).toContain('Test description');
      expect(html).toContain('Test Link 1');
      expect(html).toContain('Test Link 2');
      expect(html).toContain('data-template="links-page"');
    });

    it('should render form page template', () => {
      const additionalOptions = TemplateUtils.createSelectOptions([
        { value: 'test1', text: 'Test Option 1' },
        { value: 'test2', text: 'Test Option 2', selected: true }
      ]);

      const html = Templates.formPage({
        title: 'Test Form Page',
        heading: 'Test Form',
        description: 'Form testing page',
        page_id: 'test-form',
        select_options: additionalOptions,
        default_text: 'Default input text'
      });

      expect(html).toContain('Test Form Page');
      expect(html).toContain('Test Form');
      expect(html).toContain('Form testing page');
      expect(html).toContain('Test Option 1');
      expect(html).toContain('selected');
      expect(html).toContain('Default input text');
      expect(html).toContain('data-template="form-page"');
    });

    it('should render iframe page template', () => {
      const html = Templates.iframePage({
        title: 'Test Iframe Page',
        heading: 'Test Iframes',
        description: 'Iframe testing page',
        page_id: 'test-iframe',
        internal_iframe_src: '/test-page',
        internal_iframe_height: '400'
      });

      expect(html).toContain('Test Iframe Page');
      expect(html).toContain('Test Iframes');
      expect(html).toContain('Iframe testing page');
      expect(html).toContain('src="/test-page"');
      expect(html).toContain('height="400"');
      expect(html).toContain('data-template="iframe-page"');
    });
  });

  describe('Template Configuration', () => {
    it('should use template configs correctly', () => {
      const config = TemplateConfigs.basicPage({
        title: 'Custom Title',
        page_id: 'custom-page'
      });

      expect(config.title).toBe('Custom Title');
      expect(config.page_id).toBe('custom-page');
      expect(config.heading).toBe('Test Page'); // default value
    });

    it('should merge template variables properly', () => {
      const config = TemplateConfigs.formPage({
        form_method: 'GET',
        custom_script: 'console.log("test");'
      });

      expect(config.form_method).toBe('GET');
      expect(config.custom_script).toBe('console.log("test");');
      expect(config.form_action).toBe('/form-submit'); // default value
    });
  });

  describe('Template Utilities', () => {
    it('should create navigation links correctly', () => {
      const links = TemplateUtils.createNavigationLinks([
        { href: '/home', text: 'Home' },
        { href: '/about', text: 'About', className: 'special-link' }
      ]);

      expect(links).toContain('href="/home"');
      expect(links).toContain('Home');
      expect(links).toContain('href="/about"');
      expect(links).toContain('About');
      expect(links).toContain('special-link');
    });

    it('should create select options correctly', () => {
      const options = TemplateUtils.createSelectOptions([
        { value: 'val1', text: 'Option 1' },
        { value: 'val2', text: 'Option 2', selected: true }
      ]);

      expect(options).toContain('value="val1"');
      expect(options).toContain('Option 1');
      expect(options).toContain('value="val2"');
      expect(options).toContain('Option 2');
      expect(options).toContain('selected');
    });

    it('should create radio buttons correctly', () => {
      const radios = TemplateUtils.createRadioButtons('testRadio', [
        { value: 'choice1', text: 'Choice 1' },
        { value: 'choice2', text: 'Choice 2', checked: true }
      ]);

      expect(radios).toContain('name="testRadio"');
      expect(radios).toContain('value="choice1"');
      expect(radios).toContain('Choice 1');
      expect(radios).toContain('value="choice2"');
      expect(radios).toContain('Choice 2');
      expect(radios).toContain('checked');
    });

    it('should create checkboxes correctly', () => {
      const checkboxes = TemplateUtils.createCheckboxes('testCheck', [
        { value: 'opt1', text: 'Option 1' },
        { value: 'opt2', text: 'Option 2', checked: true }
      ]);

      expect(checkboxes).toContain('name="testCheck"');
      expect(checkboxes).toContain('value="opt1"');
      expect(checkboxes).toContain('Option 1');
      expect(checkboxes).toContain('value="opt2"');
      expect(checkboxes).toContain('Option 2');
      expect(checkboxes).toContain('checked');
    });
  });

  describe('Example Configurations', () => {
    it('should create simple test page', () => {
      const html = ExampleConfigs.simpleTestPage();

      expect(html).toContain('Simple Test Page');
      expect(html).toContain('Basic HTML structure');
      expect(html).toContain('Navigation tracking');
      expect(html).toContain('data-page="simple-test"');
    });

    it('should create comprehensive links page', () => {
      const html = ExampleConfigs.comprehensiveLinksPage();

      expect(html).toContain('Comprehensive Link Testing');
      expect(html).toContain('API Data');
      expect(html).toContain('Empty Page');
      expect(html).toContain('data-page="comprehensive-links"');
    });

    it('should create interactive form page', () => {
      const html = ExampleConfigs.interactiveFormPage();

      expect(html).toContain('Interactive Form Testing');
      expect(html).toContain('Option 4');
      expect(html).toContain('Extra Choice 1');
      expect(html).toContain('Sample text');
      expect(html).toContain('data-page="interactive-form"');
    });

    it('should create comprehensive iframe page', () => {
      const html = ExampleConfigs.comprehensiveIframePage();

      expect(html).toContain('Comprehensive Iframe Testing');
      expect(html).toContain('height="350"');
      expect(html).toContain('height="300"');
      expect(html).toContain('data-page="comprehensive-iframe"');
    });

    it('should create error test page', () => {
      const html = ExampleConfigs.errorTestPage();

      expect(html).toContain('Error Handling Test Page');
      expect(html).toContain('Timeout Error');
      expect(html).toContain('Crash Error');
      expect(html).toContain('data-page="error-test"');
    });

    it('should create performance test page', () => {
      const html = ExampleConfigs.performanceTestPage();

      expect(html).toContain('Performance Test Page');
      expect(html).toContain('Heavy computation');
      expect(html).toContain('~2 seconds');
      expect(html).toContain('data-page="performance-test"');
    });
  });

  describe('Template Validation', () => {
    it('should validate well-formed templates', () => {
      const html = Templates.basicPage({
        title: 'Valid Page',
        heading: 'Valid Heading',
        content: '<p>Valid content</p>',
        page_id: 'valid-page'
      });

      const validation = TemplateValidation.validateRenderedTemplate(html);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect missing required elements', () => {
      const invalidHtml = '<html><body><h1>Invalid</h1></body></html>';
      const validation = TemplateValidation.validateRenderedTemplate(invalidHtml);

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('should detect unresolved variables', () => {
      const htmlWithUnresolved = '<html><body>{{unresolved_var}}</body></html>';
      const check = TemplateValidation.hasUnresolvedVariables(htmlWithUnresolved);

      expect(check.hasUnresolved).toBe(true);
      expect(check.variables).toContain('unresolved_var');
    });

    it('should not detect variables in properly rendered templates', () => {
      const html = Templates.basicPage({
        title: 'Complete Page',
        heading: 'Complete Heading',
        content: '<p>Complete content</p>',
        page_id: 'complete-page'
      });

      const check = TemplateValidation.hasUnresolvedVariables(html);
      expect(check.hasUnresolved).toBe(false);
      expect(check.variables).toHaveLength(0);
    });
  });

  describe('Enhanced Mock Server Integration', () => {
    it('should provide template statistics', () => {
      const stats = mockServer.getTemplateStats();

      expect(stats.totalScenarios).toBeGreaterThan(0);
      expect(stats.templateScenarios).toBeGreaterThan(0);
      expect(stats.templateTypes).toBeDefined();
      expect(Object.keys(stats.templateTypes)).toContain('basic');
      expect(Object.keys(stats.templateTypes)).toContain('links');
    });

    it('should update template variables', () => {
      mockServer.updateTemplateVariables('/page1', {
        custom_content: '<div>Updated content</div>'
      });

      // Variables should be updated (we can't directly test the rendered output
      // in this test, but the method should not throw)
      expect(() => {
        mockServer.updateTemplateVariables('/page1', { title: 'New Title' });
      }).not.toThrow();
    });

    it('should list template scenarios', () => {
      const templateScenarios = mockServer.getTemplateScenarios();

      expect(templateScenarios.length).toBeGreaterThan(0);
      expect(templateScenarios.some(s => s.path === '/')).toBe(true);
      expect(templateScenarios.some(s => s.template === 'basic')).toBe(true);
    });
  });

  describe('Server Response Validation', () => {
    it('should serve templated home page', async () => {
      const response = await fetch(`${baseUrl}/`);
      expect(response.status).toBe(200);

      const html = await response.text();
      expect(html).toContain('Enhanced Navigation Test Home');
      expect(html).toContain('data-page="enhanced-home"');
      expect(html).toContain('data-template="links-page"');
    });

    it('should serve templated basic pages', async () => {
      const response = await fetch(`${baseUrl}/page1`);
      expect(response.status).toBe(200);

      const html = await response.text();
      expect(html).toContain('Test Page 1 (Template)');
      expect(html).toContain('data-page="template-page1"');
      expect(html).toContain('data-template="basic-page"');
    });

    it('should serve demo pages', async () => {
      const linksResponse = await fetch(`${baseUrl}/links-demo`);
      expect(linksResponse.status).toBe(200);

      const linksHtml = await linksResponse.text();
      expect(linksHtml).toContain('Links Demo Page');
      expect(linksHtml).toContain('data-template="links-page"');

      const formResponse = await fetch(`${baseUrl}/form-demo`);
      expect(formResponse.status).toBe(200);

      const formHtml = await formResponse.text();
      expect(formHtml).toContain('Form Demo Page');
      expect(formHtml).toContain('data-template="form-page"');
    });

    it('should handle form submissions', async () => {
      const response = await fetch(`${baseUrl}/form-submit`);
      expect(response.status).toBe(200);

      const html = await response.text();
      expect(html).toContain('Form Submission Received');
      expect(html).toContain('data-page="form-submit-result"');
    });
  });
});