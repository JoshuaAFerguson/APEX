/**
 * @fileoverview Navigation Test Template System
 *
 * Exports the complete template system for creating dynamic HTML pages
 * in navigation tests.
 */

export {
  TemplateEngine,
  defaultTemplateEngine,
  TemplateConfigs,
  TemplateUtils,
  type TemplateVariables,
  type TemplateOptions,
  type BasicPageVariables,
  type LinksPageVariables,
  type FormPageVariables,
  type IframePageVariables
} from './template-engine';

/**
 * Template file names for easy reference
 */
export const TemplateFiles = {
  BASIC_PAGE: 'basic-page.html',
  LINKS_PAGE: 'links-page.html',
  FORM_PAGE: 'form-page.html',
  IFRAME_PAGE: 'iframe-page.html'
} as const;

/**
 * Quick template rendering functions
 */
export const Templates = {
  /**
   * Render basic page template
   */
  basicPage: TemplateUtils.renderBasicPage,

  /**
   * Render links page template
   */
  linksPage: TemplateUtils.renderLinksPage,

  /**
   * Render form page template
   */
  formPage: TemplateUtils.renderFormPage,

  /**
   * Render iframe page template
   */
  iframePage: TemplateUtils.renderIframePage
};

/**
 * Example configurations for common test scenarios
 */
export const ExampleConfigs = {
  /**
   * Simple test page with basic navigation
   */
  simpleTestPage: (): string => {
    return Templates.basicPage({
      title: 'Simple Test Page',
      heading: '📄 Simple Test Page',
      content: `
        <p>This is a simple test page for basic navigation testing.</p>
        <ul>
          <li>✅ Basic HTML structure</li>
          <li>✅ Navigation tracking</li>
          <li>✅ Performance metrics</li>
        </ul>
      `,
      page_id: 'simple-test'
    });
  },

  /**
   * Comprehensive links page for link testing
   */
  comprehensiveLinksPage: (): string => {
    const additionalLinks = TemplateUtils.createNavigationLinks([
      { href: '/api/data', text: '📊 API Data', className: 'nav-button' },
      { href: '/empty', text: '🗂️ Empty Page', className: 'nav-button' }
    ]);

    return Templates.linksPage({
      title: 'Comprehensive Links Test',
      heading: '🔗 Comprehensive Link Testing',
      description: 'This page contains a comprehensive set of links for testing all navigation scenarios.',
      page_id: 'comprehensive-links',
      internal_links: additionalLinks,
      external_links_style: ''
    });
  },

  /**
   * Interactive form page with all input types
   */
  interactiveFormPage: (): string => {
    const additionalOptions = TemplateUtils.createSelectOptions([
      { value: 'option4', text: 'Option 4' },
      { value: 'option5', text: 'Option 5' }
    ]);

    const additionalRadios = TemplateUtils.createRadioButtons('extraRadio', [
      { value: 'extra1', text: 'Extra Choice 1' },
      { value: 'extra2', text: 'Extra Choice 2' }
    ]);

    return Templates.formPage({
      title: 'Interactive Form Test',
      heading: '📋 Interactive Form Testing',
      description: 'This page contains comprehensive form elements for testing form interactions.',
      page_id: 'interactive-form',
      select_options: additionalOptions,
      radio_options: additionalRadios,
      default_text: 'Sample text',
      default_textarea: 'This is sample textarea content for testing.',
      secondary_form_style: '',
      allow_form_submit: 'false'
    });
  },

  /**
   * Iframe test page with various frame configurations
   */
  comprehensiveIframePage: (): string => {
    return Templates.iframePage({
      title: 'Comprehensive Iframe Test',
      heading: '🖼️ Comprehensive Iframe Testing',
      description: 'This page contains various iframe configurations for testing frame navigation and interactions.',
      page_id: 'comprehensive-iframe',
      external_iframe_style: '',
      nested_iframe_style: '',
      internal_iframe_height: '350',
      comparison_iframe_height: '300'
    });
  },

  /**
   * Error test page for error handling scenarios
   */
  errorTestPage: (): string => {
    const errorLinks = TemplateUtils.createNavigationLinks([
      { href: '/timeout', text: '⏱️ Timeout Error', className: 'nav-button error-button' },
      { href: '/crash', text: '💥 Crash Error', className: 'nav-button error-button' }
    ]);

    return Templates.linksPage({
      title: 'Error Handling Test',
      heading: '⚠️ Error Handling Test Page',
      description: 'This page is designed to test error handling scenarios in navigation.',
      page_id: 'error-test',
      error_links: errorLinks
    });
  },

  /**
   * Performance test page with delayed content
   */
  performanceTestPage: (): string => {
    const performanceScript = `
      // Simulate heavy computation
      setTimeout(() => {
        console.log('Heavy computation completed');
        const element = document.getElementById('computation-result');
        if (element) {
          element.textContent = 'Computation completed at ' + new Date().toISOString();
        }
      }, 2000);

      // Track performance
      window.addEventListener('load', () => {
        if (performance.timing) {
          const loadTime = performance.timing.loadEventEnd - performance.timing.navigationStart;
          console.log('Page load time:', loadTime, 'ms');
        }
      });
    `;

    return Templates.basicPage({
      title: 'Performance Test Page',
      heading: '🚀 Performance Test Page',
      content: `
        <p>This page tests performance scenarios and delayed content loading.</p>
        <div id="computation-result">Computing...</div>
        <div style="margin-top: 20px;">
          <h3>Performance Metrics</h3>
          <ul>
            <li>Expected load time: ~2 seconds</li>
            <li>Heavy computation simulation</li>
            <li>Performance timing collection</li>
          </ul>
        </div>
      `,
      page_id: 'performance-test',
      custom_script: performanceScript
    });
  }
};

/**
 * Validation helpers for template rendering
 */
export const TemplateValidation = {
  /**
   * Validate that a rendered template contains required elements
   */
  validateRenderedTemplate: (html: string): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    // Check for basic HTML structure
    if (!html.includes('<!DOCTYPE html>')) {
      errors.push('Missing DOCTYPE declaration');
    }

    if (!html.includes('<html>')) {
      errors.push('Missing HTML tag');
    }

    if (!html.includes('<head>')) {
      errors.push('Missing HEAD tag');
    }

    if (!html.includes('<body>')) {
      errors.push('Missing BODY tag');
    }

    // Check for required elements
    if (!html.includes('data-page=')) {
      errors.push('Missing page identifier (data-page attribute)');
    }

    if (!html.includes('data-template=')) {
      errors.push('Missing template identifier (data-template attribute)');
    }

    // Check for navigation tracking scripts
    if (!html.includes('navigationTestHistory')) {
      errors.push('Missing navigation tracking code');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  },

  /**
   * Check if template contains unresolved variables
   */
  hasUnresolvedVariables: (html: string): { hasUnresolved: boolean; variables: string[] } => {
    const pattern = /\{\{\s*([^}]+)\s*\}\}/g;
    const matches = [...html.matchAll(pattern)];
    const variables = matches.map(match => match[1].trim());

    return {
      hasUnresolved: variables.length > 0,
      variables: [...new Set(variables)]
    };
  }
};