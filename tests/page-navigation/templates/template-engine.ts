/**
 * @fileoverview Template Engine for Navigation Testing HTML Templates
 *
 * Provides template variable substitution and template loading functionality
 * for creating dynamic HTML pages in navigation tests.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

export interface TemplateVariables {
  [key: string]: string | number | boolean | undefined | null;
}

export interface TemplateOptions {
  /** Whether to throw an error for undefined variables (default: false) */
  strict?: boolean;
  /** Default value for undefined variables when not in strict mode */
  defaultValue?: string;
  /** Custom variable prefix (default: '{{') */
  prefix?: string;
  /** Custom variable suffix (default: '}}') */
  suffix?: string;
}

/**
 * Template engine for processing HTML templates with variable substitution
 */
export class TemplateEngine {
  private readonly options: Required<TemplateOptions>;
  private readonly templateCache: Map<string, string> = new Map();

  constructor(options: TemplateOptions = {}) {
    this.options = {
      strict: false,
      defaultValue: '',
      prefix: '{{',
      suffix: '}}',
      ...options
    };
  }

  /**
   * Load a template from file system
   */
  loadTemplate(templatePath: string): string {
    if (this.templateCache.has(templatePath)) {
      return this.templateCache.get(templatePath)!;
    }

    try {
      const template = readFileSync(templatePath, 'utf-8');
      this.templateCache.set(templatePath, template);
      return template;
    } catch (error) {
      throw new Error(`Failed to load template: ${templatePath} - ${error}`);
    }
  }

  /**
   * Process a template string with variable substitution
   */
  processTemplate(template: string, variables: TemplateVariables = {}): string {
    const { prefix, suffix, strict, defaultValue } = this.options;

    // Create regex pattern for finding template variables
    const pattern = new RegExp(
      `${this.escapeRegExp(prefix)}\\s*([^\\s{}]+)\\s*${this.escapeRegExp(suffix)}`,
      'g'
    );

    return template.replace(pattern, (match, variableName) => {
      const value = variables[variableName];

      if (value === undefined || value === null) {
        if (strict) {
          throw new Error(`Undefined template variable: ${variableName}`);
        }
        return defaultValue;
      }

      return String(value);
    });
  }

  /**
   * Load and process a template file
   */
  renderTemplate(templatePath: string, variables: TemplateVariables = {}): string {
    const template = this.loadTemplate(templatePath);
    return this.processTemplate(template, variables);
  }

  /**
   * Clear the template cache
   */
  clearCache(): void {
    this.templateCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; templates: string[] } {
    return {
      size: this.templateCache.size,
      templates: Array.from(this.templateCache.keys())
    };
  }

  private escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

/**
 * Default template engine instance
 */
export const defaultTemplateEngine = new TemplateEngine();

/**
 * Predefined template configurations for common scenarios
 */
export const TemplateConfigs = {
  /**
   * Basic page template variables
   */
  basicPage: (overrides: Partial<BasicPageVariables> = {}): BasicPageVariables => ({
    title: 'Test Page',
    heading: 'Test Page',
    content: '<p>This is a test page for navigation testing.</p>',
    page_id: 'basic-page',
    custom_css: '',
    custom_content: '',
    custom_script: '',
    navigation: '<nav><a href="/" class="nav-button">🏠 Home</a></nav>',
    ...overrides
  }),

  /**
   * Links page template variables
   */
  linksPage: (overrides: Partial<LinksPageVariables> = {}): LinksPageVariables => ({
    title: 'Links Test Page',
    heading: 'Links Test Page',
    description: 'This page contains various types of links for navigation testing.',
    page_id: 'links-page',
    custom_css: '',
    custom_script: '',
    internal_links: '',
    external_links: '',
    external_links_style: 'display: none;',
    error_links: '',
    performance_links: '',
    redirect_links: '',
    custom_link_sections: '',
    ...overrides
  }),

  /**
   * Form page template variables
   */
  formPage: (overrides: Partial<FormPageVariables> = {}): FormPageVariables => ({
    title: 'Form Test Page',
    heading: 'Form Test Page',
    description: 'This page contains various form elements for testing.',
    page_id: 'form-page',
    custom_css: '',
    custom_script: '',
    form_method: 'POST',
    form_action: '/form-submit',
    default_text: '',
    default_textarea: '',
    file_accept: '.txt,.pdf,.jpg,.png',
    select_options: '',
    multi_select_options: '',
    radio_options: '',
    checkbox_options: '',
    custom_form_sections: '',
    navigation_links: '',
    secondary_form_style: '',
    form_submit_handler: '',
    allow_form_submit: 'false',
    ...overrides
  }),

  /**
   * Iframe page template variables
   */
  iframePage: (overrides: Partial<IframePageVariables> = {}): IframePageVariables => ({
    title: 'Iframe Test Page',
    heading: 'Iframe Test Page',
    description: 'This page contains various iframe configurations for testing.',
    page_id: 'iframe-page',
    custom_css: '',
    custom_script: '',
    internal_iframe_src: '/page1',
    internal_iframe_width: '100%',
    internal_iframe_height: '300',
    external_iframe_src: 'https://example.com',
    external_iframe_width: '100%',
    external_iframe_height: '400',
    external_iframe_style: 'display: none;',
    left_iframe_src: '/page1',
    right_iframe_src: '/page2',
    comparison_iframe_height: '250',
    nested_iframe_src: '/nested-frame-test',
    nested_iframe_height: '350',
    nested_iframe_style: 'display: none;',
    dynamic_iframe_default_url: '/page1',
    custom_iframe_sections: '',
    navigation_links: '',
    ...overrides
  })
};

// Type definitions for template variables
export interface BasicPageVariables extends TemplateVariables {
  title: string;
  heading: string;
  content: string;
  page_id: string;
  custom_css: string;
  custom_content: string;
  custom_script: string;
  navigation: string;
}

export interface LinksPageVariables extends TemplateVariables {
  title: string;
  heading: string;
  description: string;
  page_id: string;
  custom_css: string;
  custom_script: string;
  internal_links: string;
  external_links: string;
  external_links_style: string;
  error_links: string;
  performance_links: string;
  redirect_links: string;
  custom_link_sections: string;
}

export interface FormPageVariables extends TemplateVariables {
  title: string;
  heading: string;
  description: string;
  page_id: string;
  custom_css: string;
  custom_script: string;
  form_method: string;
  form_action: string;
  default_text: string;
  default_textarea: string;
  file_accept: string;
  select_options: string;
  multi_select_options: string;
  radio_options: string;
  checkbox_options: string;
  custom_form_sections: string;
  navigation_links: string;
  secondary_form_style: string;
  form_submit_handler: string;
  allow_form_submit: string;
}

export interface IframePageVariables extends TemplateVariables {
  title: string;
  heading: string;
  description: string;
  page_id: string;
  custom_css: string;
  custom_script: string;
  internal_iframe_src: string;
  internal_iframe_width: string;
  internal_iframe_height: string;
  external_iframe_src: string;
  external_iframe_width: string;
  external_iframe_height: string;
  external_iframe_style: string;
  left_iframe_src: string;
  right_iframe_src: string;
  comparison_iframe_height: string;
  nested_iframe_src: string;
  nested_iframe_height: string;
  nested_iframe_style: string;
  dynamic_iframe_default_url: string;
  custom_iframe_sections: string;
  navigation_links: string;
}

/**
 * Utility functions for working with templates
 */
export const TemplateUtils = {
  /**
   * Get the full path to a template file
   */
  getTemplatePath: (templateName: string): string => {
    return join(__dirname, `${templateName}.html`);
  },

  /**
   * Render a basic page template
   */
  renderBasicPage: (variables: Partial<BasicPageVariables> = {}): string => {
    const templatePath = TemplateUtils.getTemplatePath('basic-page');
    const config = TemplateConfigs.basicPage(variables);
    return defaultTemplateEngine.renderTemplate(templatePath, config);
  },

  /**
   * Render a links page template
   */
  renderLinksPage: (variables: Partial<LinksPageVariables> = {}): string => {
    const templatePath = TemplateUtils.getTemplatePath('links-page');
    const config = TemplateConfigs.linksPage(variables);
    return defaultTemplateEngine.renderTemplate(templatePath, config);
  },

  /**
   * Render a form page template
   */
  renderFormPage: (variables: Partial<FormPageVariables> = {}): string => {
    const templatePath = TemplateUtils.getTemplatePath('form-page');
    const config = TemplateConfigs.formPage(variables);
    return defaultTemplateEngine.renderTemplate(templatePath, config);
  },

  /**
   * Render an iframe page template
   */
  renderIframePage: (variables: Partial<IframePageVariables> = {}): string => {
    const templatePath = TemplateUtils.getTemplatePath('iframe-page');
    const config = TemplateConfigs.iframePage(variables);
    return defaultTemplateEngine.renderTemplate(templatePath, config);
  },

  /**
   * Create navigation links HTML
   */
  createNavigationLinks: (links: Array<{href: string; text: string; className?: string}>): string => {
    return links.map(link =>
      `<a href="${link.href}" class="${link.className || 'nav-button'}">${link.text}</a>`
    ).join('\n');
  },

  /**
   * Create form options HTML
   */
  createSelectOptions: (options: Array<{value: string; text: string; selected?: boolean}>): string => {
    return options.map(option =>
      `<option value="${option.value}"${option.selected ? ' selected' : ''}>${option.text}</option>`
    ).join('\n');
  },

  /**
   * Create radio button group HTML
   */
  createRadioButtons: (name: string, options: Array<{value: string; text: string; checked?: boolean}>): string => {
    return options.map((option, index) =>
      `<div class="radio-item">
        <input type="radio" id="${name}${index}" name="${name}" value="${option.value}"${option.checked ? ' checked' : ''}>
        <label for="${name}${index}">${option.text}</label>
      </div>`
    ).join('\n');
  },

  /**
   * Create checkbox group HTML
   */
  createCheckboxes: (name: string, options: Array<{value: string; text: string; checked?: boolean}>): string => {
    return options.map((option, index) =>
      `<div class="checkbox-item">
        <input type="checkbox" id="${name}${index}" name="${name}" value="${option.value}"${option.checked ? ' checked' : ''}>
        <label for="${name}${index}">${option.text}</label>
      </div>`
    ).join('\n');
  }
};