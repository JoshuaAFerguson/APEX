/**
 * @fileoverview Enhanced Mock Server with Template Support
 *
 * Extends the base mock server to use the template system for generating
 * dynamic HTML pages with proper variable substitution.
 */

import { MockNavigationServer, MockServerOptions, NavigationScenario, RouteHandler } from './mock-server';
import { Templates, TemplateConfigs, type TemplateVariables } from './templates';
import type { IncomingMessage, ServerResponse } from 'http';

export interface TemplateScenario extends Omit<NavigationScenario, 'body'> {
  /** Template type to use */
  template: 'basic' | 'links' | 'form' | 'iframe';
  /** Template variables for substitution */
  variables?: TemplateVariables;
  /** Custom template content override */
  customTemplate?: string;
}

export interface EnhancedMockServerOptions extends MockServerOptions {
  /** Whether to use template system (default: true) */
  useTemplates?: boolean;
  /** Default template variables applied to all templates */
  defaultTemplateVariables?: TemplateVariables;
}

/**
 * Enhanced mock server with template system integration
 */
export class EnhancedMockNavigationServer extends MockNavigationServer {
  private templateScenarios: Map<string, TemplateScenario> = new Map();
  private enhancedOptions: Required<EnhancedMockServerOptions>;

  constructor(options: EnhancedMockServerOptions = {}) {
    const { useTemplates, defaultTemplateVariables, ...baseOptions } = options;

    super(baseOptions);

    this.enhancedOptions = {
      ...this.getBaseOptions(),
      useTemplates: useTemplates ?? true,
      defaultTemplateVariables: defaultTemplateVariables ?? {},
    };

    if (this.enhancedOptions.useTemplates) {
      this.setupTemplateScenarios();
    }
  }

  /**
   * Get base options from parent class (protected method workaround)
   */
  private getBaseOptions(): Required<MockServerOptions> {
    return {
      port: 0,
      host: 'localhost',
      baseDelay: 2000,
      verbose: false,
      customRoutes: {},
      ...this.enhancedOptions
    };
  }

  /**
   * Add a template-based scenario
   */
  addTemplateScenario(scenario: TemplateScenario): void {
    this.templateScenarios.set(scenario.path, scenario);

    // Convert template scenario to regular scenario
    const regularScenario: NavigationScenario = {
      ...scenario,
      body: () => this.renderTemplate(scenario)
    };

    this.addScenario(regularScenario);

    if (this.enhancedOptions.verbose) {
      console.log(`Added template scenario: ${scenario.name} -> ${scenario.path} (${scenario.template})`);
    }
  }

  /**
   * Remove a template scenario
   */
  removeTemplateScenario(path: string): void {
    this.templateScenarios.delete(path);
    this.removeScenario(path);
  }

  /**
   * Get all template scenarios
   */
  getTemplateScenarios(): TemplateScenario[] {
    return Array.from(this.templateScenarios.values());
  }

  /**
   * Render a template scenario to HTML
   */
  private renderTemplate(scenario: TemplateScenario): string {
    try {
      const variables = {
        ...this.enhancedOptions.defaultTemplateVariables,
        ...scenario.variables
      };

      // Use custom template if provided
      if (scenario.customTemplate) {
        // You could implement custom template processing here
        return scenario.customTemplate;
      }

      // Render based on template type
      switch (scenario.template) {
        case 'basic':
          return Templates.basicPage(variables);
        case 'links':
          return Templates.linksPage(variables);
        case 'form':
          return Templates.formPage(variables);
        case 'iframe':
          return Templates.iframePage(variables);
        default:
          throw new Error(`Unknown template type: ${scenario.template}`);
      }
    } catch (error) {
      const errorMessage = `Template rendering failed for ${scenario.path}: ${error}`;
      console.error(errorMessage);
      return this.createErrorPage(scenario.name, errorMessage);
    }
  }

  /**
   * Create an error page for template rendering failures
   */
  private createErrorPage(scenarioName: string, error: string): string {
    return Templates.basicPage({
      title: 'Template Error',
      heading: '⚠️ Template Rendering Error',
      content: `
        <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 4px; margin: 20px 0;">
          <strong>Scenario:</strong> ${scenarioName}<br>
          <strong>Error:</strong> ${error}
        </div>
        <p>This page was generated due to a template rendering error. Please check the template configuration.</p>
      `,
      page_id: 'template-error',
      navigation: '<a href="/" class="nav-button">🏠 Return Home</a>'
    });
  }

  /**
   * Setup default template scenarios
   */
  private setupTemplateScenarios(): void {
    // Enhanced home page
    this.addTemplateScenario({
      name: 'enhanced-home',
      path: '/',
      template: 'links',
      statusCode: 200,
      contentType: 'text/html',
      variables: {
        title: 'Navigation Test Home - Enhanced',
        heading: '🧪 Enhanced Navigation Test Home',
        description: 'Enhanced mock server with template support for comprehensive navigation testing.',
        page_id: 'enhanced-home'
      }
    });

    // Test pages with templates
    this.addTemplateScenario({
      name: 'template-page1',
      path: '/page1',
      template: 'basic',
      statusCode: 200,
      contentType: 'text/html',
      variables: {
        title: 'Test Page 1 - Template',
        heading: '📄 Test Page 1 (Template)',
        content: `
          <p>This is <strong>Page 1</strong> generated using the template system.</p>
          <div style="background: #e7f3ff; padding: 15px; border-radius: 4px; margin: 15px 0;">
            <strong>Template Features:</strong>
            <ul>
              <li>✅ Dynamic content injection</li>
              <li>✅ Variable substitution</li>
              <li>✅ Navigation tracking</li>
              <li>✅ Performance monitoring</li>
            </ul>
          </div>
        `,
        page_id: 'template-page1',
        navigation: `
          <nav>
            <a href="/" class="nav-button">🏠 Home</a>
            <a href="/page2" class="nav-button">➡️ Page 2</a>
            <a href="/links-demo" class="nav-button">🔗 Links Demo</a>
            <a href="/form-demo" class="nav-button">📋 Form Demo</a>
          </nav>
        `
      }
    });

    this.addTemplateScenario({
      name: 'template-page2',
      path: '/page2',
      template: 'basic',
      statusCode: 200,
      contentType: 'text/html',
      variables: {
        title: 'Test Page 2 - Template',
        heading: '📄 Test Page 2 (Template)',
        content: `
          <p>This is <strong>Page 2</strong> with enhanced template features.</p>
          <div style="background: #d4edda; padding: 15px; border-radius: 4px; margin: 15px 0; border-left: 4px solid #28a745;">
            <strong>Navigation Features:</strong>
            <ul>
              <li>🔄 Browser history management</li>
              <li>📊 Performance metrics collection</li>
              <li>🎯 Element targeting support</li>
              <li>📝 Form interaction tracking</li>
            </ul>
          </div>
        `,
        page_id: 'template-page2',
        navigation: `
          <nav>
            <a href="/" class="nav-button">🏠 Home</a>
            <a href="/page1" class="nav-button">⬅️ Page 1</a>
            <a href="/page3" class="nav-button">➡️ Page 3</a>
            <a href="/iframe-demo" class="nav-button">🖼️ Iframe Demo</a>
          </nav>
        `
      }
    });

    this.addTemplateScenario({
      name: 'template-page3',
      path: '/page3',
      template: 'basic',
      statusCode: 200,
      contentType: 'text/html',
      variables: {
        title: 'Test Page 3 - Template',
        heading: '📄 Test Page 3 (Template)',
        content: `
          <p>This is <strong>Page 3</strong> - the final page in the basic navigation sequence.</p>
          <div style="background: #f8d7da; padding: 15px; border-radius: 4px; margin: 15px 0; border-left: 4px solid #dc3545;">
            <strong>Testing Capabilities:</strong>
            <ul>
              <li>🧪 Cross-browser compatibility</li>
              <li>⚡ Performance benchmarking</li>
              <li>🔒 Error handling validation</li>
              <li>📱 Responsive design testing</li>
            </ul>
          </div>
        `,
        page_id: 'template-page3',
        navigation: `
          <nav>
            <a href="/" class="nav-button">🏠 Home</a>
            <a href="/page2" class="nav-button">⬅️ Page 2</a>
            <a href="/links-demo" class="nav-button">🔗 Links Demo</a>
          </nav>
        `
      }
    });

    // Specialized demo pages
    this.addTemplateScenario({
      name: 'links-demo',
      path: '/links-demo',
      template: 'links',
      statusCode: 200,
      contentType: 'text/html',
      variables: {
        title: 'Links Demo - Template',
        heading: '🔗 Links Demo Page',
        description: 'Comprehensive link testing page generated from template with various link types and scenarios.',
        page_id: 'links-demo'
      }
    });

    this.addTemplateScenario({
      name: 'form-demo',
      path: '/form-demo',
      template: 'form',
      statusCode: 200,
      contentType: 'text/html',
      variables: {
        title: 'Form Demo - Template',
        heading: '📋 Form Demo Page',
        description: 'Interactive form testing page with various input types and validation scenarios.',
        page_id: 'form-demo',
        form_action: '/form-submit',
        default_text: 'Sample input text',
        default_textarea: 'This is sample textarea content for demonstration.'
      }
    });

    this.addTemplateScenario({
      name: 'iframe-demo',
      path: '/iframe-demo',
      template: 'iframe',
      statusCode: 200,
      contentType: 'text/html',
      variables: {
        title: 'Iframe Demo - Template',
        heading: '🖼️ Iframe Demo Page',
        description: 'Iframe testing page with various frame configurations and interaction scenarios.',
        page_id: 'iframe-demo',
        internal_iframe_src: '/page1',
        left_iframe_src: '/page1',
        right_iframe_src: '/page2'
      }
    });

    // Form submission handler
    this.addScenario({
      name: 'form-submit-handler',
      path: '/form-submit',
      statusCode: 200,
      contentType: 'text/html',
      body: () => this.createFormSubmitResponse()
    });

    // Slow template page for performance testing
    this.addTemplateScenario({
      name: 'slow-template',
      path: '/slow',
      template: 'basic',
      statusCode: 200,
      contentType: 'text/html',
      delay: this.enhancedOptions.baseDelay,
      variables: {
        title: 'Slow Page - Template',
        heading: '🐌 Slow Loading Page (Template)',
        content: `
          <p>This page was intentionally delayed by ${this.enhancedOptions.baseDelay}ms for performance testing.</p>
          <div style="background: #fff3cd; padding: 15px; border-radius: 4px; margin: 15px 0;">
            <strong>Performance Test:</strong><br>
            Expected delay: ${this.enhancedOptions.baseDelay}ms<br>
            Loaded at: <span id="load-time"></span>
          </div>
          <script>
            document.getElementById('load-time').textContent = new Date().toISOString();
          </script>
        `,
        page_id: 'slow-template'
      }
    });

    if (this.enhancedOptions.verbose) {
      console.log('Enhanced template scenarios configured');
    }
  }

  /**
   * Create form submission response page
   */
  private createFormSubmitResponse(): string {
    return Templates.basicPage({
      title: 'Form Submitted',
      heading: '✅ Form Submission Received',
      content: `
        <div style="background: #d4edda; padding: 20px; border-radius: 4px; border-left: 4px solid #28a745; margin: 20px 0;">
          <h3>Form Submission Successful</h3>
          <p>Your form data has been received and processed.</p>
          <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
          <p><strong>Status:</strong> Success</p>
        </div>
        <div id="form-data" style="background: #f8f9fa; padding: 15px; border-radius: 4px; margin: 15px 0;">
          <strong>Form Data Processing:</strong><br>
          <pre>Processing complete...</pre>
        </div>
      `,
      page_id: 'form-submit-result',
      navigation: `
        <nav>
          <a href="/" class="nav-button">🏠 Home</a>
          <a href="/form-demo" class="nav-button">📋 Back to Form</a>
        </nav>
      `
    });
  }

  /**
   * Update template variables for a scenario
   */
  updateTemplateVariables(path: string, variables: TemplateVariables): void {
    const scenario = this.templateScenarios.get(path);
    if (scenario) {
      scenario.variables = {
        ...scenario.variables,
        ...variables
      };

      if (this.enhancedOptions.verbose) {
        console.log(`Updated template variables for ${path}`);
      }
    }
  }

  /**
   * Get template statistics
   */
  getTemplateStats(): {
    totalScenarios: number;
    templateScenarios: number;
    regularScenarios: number;
    templateTypes: Record<string, number>;
  } {
    const templateScenarios = this.getTemplateScenarios();
    const allScenarios = this.getScenarios();

    const templateTypes: Record<string, number> = {};
    templateScenarios.forEach(scenario => {
      templateTypes[scenario.template] = (templateTypes[scenario.template] || 0) + 1;
    });

    return {
      totalScenarios: allScenarios.length,
      templateScenarios: templateScenarios.length,
      regularScenarios: allScenarios.length - templateScenarios.length,
      templateTypes
    };
  }
}

/**
 * Create and start an enhanced mock navigation server with templates
 */
export async function createEnhancedMockNavigationServer(
  options: EnhancedMockServerOptions = {}
): Promise<EnhancedMockNavigationServer> {
  const server = new EnhancedMockNavigationServer(options);
  await server.start();
  return server;
}

/**
 * Enhanced server lifecycle management
 */
export class EnhancedMockServerLifecycle {
  private static instances: Map<string, EnhancedMockNavigationServer> = new Map();

  /**
   * Start a named enhanced mock server instance
   */
  static async startForTest(
    name: string,
    options: EnhancedMockServerOptions = {}
  ): Promise<EnhancedMockNavigationServer> {
    if (this.instances.has(name)) {
      throw new Error(`Enhanced mock server '${name}' is already running`);
    }

    const server = await createEnhancedMockNavigationServer(options);
    this.instances.set(name, server);
    return server;
  }

  /**
   * Stop a named enhanced mock server instance
   */
  static async stopForTest(name: string): Promise<void> {
    const server = this.instances.get(name);
    if (server) {
      await server.stop();
      this.instances.delete(name);
    }
  }

  /**
   * Get a running enhanced mock server instance by name
   */
  static getInstance(name: string): EnhancedMockNavigationServer | undefined {
    return this.instances.get(name);
  }

  /**
   * Stop all running enhanced mock server instances
   */
  static async stopAll(): Promise<void> {
    const promises = Array.from(this.instances.values()).map(server => server.stop());
    await Promise.all(promises);
    this.instances.clear();
  }

  /**
   * Get all running instance names
   */
  static getInstanceNames(): string[] {
    return Array.from(this.instances.keys());
  }

  /**
   * Get statistics for all running instances
   */
  static getAllStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    this.instances.forEach((server, name) => {
      stats[name] = server.getTemplateStats();
    });
    return stats;
  }
}