/**
 * @apexcli/api - Screenshot Service
 *
 * High-level service for handling screenshot capture operations
 * through the browser automation package.
 */

import {
  BrowserManager,
  BrowserSession,
  createBrowserManager,
  createBrowserSession,
  type ScreenshotCaptureOptions,
  type ElementScreenshotOptions,
  type BrowserSessionConfig,
  type BrowserActionResult,
} from '@apexcli/browser';

/**
 * Configuration options for screenshot capture
 */
export interface ScreenshotConfig {
  /** Image format - PNG or JPEG */
  format?: 'png' | 'jpeg';
  /** JPEG quality (0-100). Only applies when format is 'jpeg' */
  quality?: number;
  /** Optional file path to save the screenshot */
  savePath?: string;
  /** Whether to omit the background (transparent for PNG) */
  omitBackground?: boolean;
  /** Viewport dimensions for browser */
  viewport?: {
    width: number;
    height: number;
  };
  /** Browser configuration options */
  browserOptions?: Partial<BrowserSessionConfig>;
}

/**
 * Options for element screenshot capture
 */
export interface ElementScreenshotConfig extends ScreenshotConfig {
  /** Timeout in milliseconds for finding the element */
  timeout?: number;
  /** CSS selector for the target element */
  selector: string;
}

/**
 * Screenshot capture result
 */
export interface ScreenshotResult {
  /** Whether the capture succeeded */
  success: boolean;
  /** Image buffer if successful */
  buffer?: Buffer;
  /** File path if saved to file */
  filePath?: string;
  /** Error message if failed */
  error?: string;
  /** Time taken in milliseconds */
  duration: number;
  /** Image format used */
  format: 'png' | 'jpeg';
  /** Image dimensions */
  dimensions?: {
    width: number;
    height: number;
  };
}

/**
 * Service for managing screenshot capture operations
 */
export class ScreenshotService {
  private browserManager: BrowserManager;

  constructor() {
    this.browserManager = createBrowserManager({
      maxInstances: 5,
      instanceIdleTimeout: 30000, // 30 seconds
      reuseInstances: true,
    });
  }

  /**
   * Captures a screenshot of the current viewport
   */
  async captureViewport(
    url: string,
    config: ScreenshotConfig = {}
  ): Promise<ScreenshotResult> {
    const startTime = Date.now();
    let session: BrowserSession | undefined;

    try {
      // Create browser session
      session = await this.createSession(config);

      // Navigate to URL
      const navigationResult = await session.navigate(url);
      if (!navigationResult.success) {
        return {
          success: false,
          error: `Navigation failed: ${navigationResult.error}`,
          duration: Date.now() - startTime,
          format: config.format || 'png',
        };
      }

      // Wait for page to load
      await this.waitForPageReady(session);

      // Capture viewport screenshot
      const screenshotOptions: ScreenshotCaptureOptions = {
        type: config.format || 'png',
        quality: config.format === 'jpeg' ? config.quality : undefined,
        path: config.savePath,
        omitBackground: config.omitBackground,
      };

      const result = await session.captureViewport(screenshotOptions);

      return {
        success: result.success,
        buffer: result.data,
        filePath: config.savePath,
        error: result.error,
        duration: Date.now() - startTime,
        format: config.format || 'png',
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
        format: config.format || 'png',
      };
    } finally {
      if (session) {
        await session.close().catch(() => {
          // Ignore close errors
        });
      }
    }
  }

  /**
   * Captures a screenshot of the full scrollable page
   */
  async captureFullPage(
    url: string,
    config: ScreenshotConfig = {}
  ): Promise<ScreenshotResult> {
    const startTime = Date.now();
    let session: BrowserSession | undefined;

    try {
      // Create browser session
      session = await this.createSession(config);

      // Navigate to URL
      const navigationResult = await session.navigate(url);
      if (!navigationResult.success) {
        return {
          success: false,
          error: `Navigation failed: ${navigationResult.error}`,
          duration: Date.now() - startTime,
          format: config.format || 'png',
        };
      }

      // Wait for page to load
      await this.waitForPageReady(session);

      // Capture full page screenshot
      const screenshotOptions: ScreenshotCaptureOptions = {
        type: config.format || 'png',
        quality: config.format === 'jpeg' ? config.quality : undefined,
        path: config.savePath,
        omitBackground: config.omitBackground,
      };

      const result = await session.captureFullPage(screenshotOptions);

      return {
        success: result.success,
        buffer: result.data,
        filePath: config.savePath,
        error: result.error,
        duration: Date.now() - startTime,
        format: config.format || 'png',
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
        format: config.format || 'png',
      };
    } finally {
      if (session) {
        await session.close().catch(() => {
          // Ignore close errors
        });
      }
    }
  }

  /**
   * Captures a screenshot of a specific element
   */
  async captureElement(
    url: string,
    config: ElementScreenshotConfig
  ): Promise<ScreenshotResult> {
    const startTime = Date.now();
    let session: BrowserSession | undefined;

    try {
      // Create browser session
      session = await this.createSession(config);

      // Navigate to URL
      const navigationResult = await session.navigate(url);
      if (!navigationResult.success) {
        return {
          success: false,
          error: `Navigation failed: ${navigationResult.error}`,
          duration: Date.now() - startTime,
          format: config.format || 'png',
        };
      }

      // Wait for page to load
      await this.waitForPageReady(session);

      // Capture element screenshot
      const screenshotOptions: ElementScreenshotOptions = {
        type: config.format || 'png',
        quality: config.format === 'jpeg' ? config.quality : undefined,
        path: config.savePath,
        omitBackground: config.omitBackground,
        timeout: config.timeout,
      };

      const result = await session.captureElement(config.selector, screenshotOptions);

      return {
        success: result.success,
        buffer: result.data,
        filePath: config.savePath,
        error: result.error,
        duration: Date.now() - startTime,
        format: config.format || 'png',
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
        format: config.format || 'png',
      };
    } finally {
      if (session) {
        await session.close().catch(() => {
          // Ignore close errors
        });
      }
    }
  }

  /**
   * Creates a new browser session with the specified configuration
   */
  private async createSession(config: ScreenshotConfig): Promise<BrowserSession> {
    const sessionConfig: Partial<BrowserSessionConfig> = {
      browserType: 'chromium',
      headless: true,
      viewport: config.viewport || { width: 1280, height: 720 },
      timeout: 30000,
      ignoreHTTPSErrors: true,
      ...config.browserOptions,
    };

    const session = createBrowserSession(this.browserManager, sessionConfig);

    const launchResult = await session.launch();
    if (!launchResult.success) {
      throw new Error(`Failed to launch browser session: ${launchResult.error}`);
    }

    return session;
  }

  /**
   * Waits for the page to be ready for screenshot capture
   */
  private async waitForPageReady(session: BrowserSession): Promise<void> {
    // Wait for network idle and DOM content loaded
    await session.waitForLoadState('networkidle', { timeout: 15000 });

    // Small additional delay to ensure rendering is complete
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  /**
   * Cleanup browser manager and all active sessions
   */
  async cleanup(): Promise<void> {
    await this.browserManager.closeAll();
  }
}

/**
 * Default screenshot service instance
 */
export const screenshotService = new ScreenshotService();