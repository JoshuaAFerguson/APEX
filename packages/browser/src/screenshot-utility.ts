/**
 * @apexcli/browser - Screenshot Utility
 *
 * Base screenshot capture utility with format and quality support
 */

import type { Page, BrowserContext } from 'playwright';

/**
 * Screenshot format options
 */
export type ScreenshotFormat = 'png' | 'jpeg';

/**
 * Screenshot capture options
 */
export interface ScreenshotCaptureOptions {
  /** Image format - PNG or JPEG */
  format?: ScreenshotFormat;
  /** JPEG quality (1-100). Only applies when format is 'jpeg' */
  quality?: number;
  /** Whether to capture full scrollable page */
  fullPage?: boolean;
  /** Whether to omit the background (transparent for PNG) */
  omitBackground?: boolean;
  /** Optional file path to save the screenshot */
  path?: string;
}

/**
 * Screenshot capture result
 */
export interface ScreenshotResult {
  /** Whether the capture was successful */
  success: boolean;
  /** Screenshot buffer data if successful */
  data?: Buffer;
  /** Error message if failed */
  error?: string;
  /** Time taken to capture in milliseconds */
  duration: number;
}

/**
 * Base screenshot capture utility function
 *
 * Accepts a page or browser context, captures screenshot with PNG/JPEG format support,
 * configurable quality (1-100 for JPEG), and returns Buffer.
 *
 * @param target - Page or BrowserContext to capture screenshot from
 * @param options - Screenshot capture options
 * @returns Promise resolving to screenshot result with Buffer
 *
 * @example
 * ```typescript
 * import { captureScreenshot } from '@apexcli/browser';
 * import { chromium } from 'playwright';
 *
 * const browser = await chromium.launch();
 * const context = await browser.newContext();
 * const page = await context.newPage();
 *
 * await page.goto('https://example.com');
 *
 * // Capture PNG screenshot
 * const pngResult = await captureScreenshot(page, {
 *   format: 'png',
 *   fullPage: true
 * });
 *
 * // Capture JPEG screenshot with quality
 * const jpegResult = await captureScreenshot(page, {
 *   format: 'jpeg',
 *   quality: 80,
 *   fullPage: false
 * });
 *
 * if (jpegResult.success) {
 *   console.log(`Screenshot captured: ${jpegResult.data!.length} bytes`);
 * }
 * ```
 */
export async function captureScreenshot(
  target: Page | BrowserContext,
  options: ScreenshotCaptureOptions = {}
): Promise<ScreenshotResult> {
  const startTime = Date.now();

  try {
    // Validate quality parameter
    if (options.quality !== undefined && (options.quality < 1 || options.quality > 100)) {
      return {
        success: false,
        error: 'Quality must be between 1 and 100',
        duration: Date.now() - startTime,
      };
    }

    // Get the page to capture from
    let page: Page;

    if ('screenshot' in target) {
      // Target is already a Page
      page = target as Page;
    } else {
      // Target is a BrowserContext, get the first page or create one
      const pages = target.pages();
      if (pages.length === 0) {
        page = await target.newPage();
      } else {
        page = pages[0];
      }
    }

    // Set default options
    const {
      format = 'png',
      quality,
      fullPage = false,
      omitBackground,
      path
    } = options;

    // Capture screenshot with Playwright
    const screenshot = await page.screenshot({
      type: format,
      quality: format === 'jpeg' ? quality : undefined,
      fullPage,
      omitBackground,
      path,
    });

    return {
      success: true,
      data: screenshot,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Convenience function for capturing PNG screenshots
 *
 * @param target - Page or BrowserContext to capture screenshot from
 * @param options - Screenshot capture options (format will be set to 'png')
 * @returns Promise resolving to screenshot result
 */
export async function capturePNG(
  target: Page | BrowserContext,
  options: Omit<ScreenshotCaptureOptions, 'format'> = {}
): Promise<ScreenshotResult> {
  return captureScreenshot(target, { ...options, format: 'png' });
}

/**
 * Convenience function for capturing JPEG screenshots
 *
 * @param target - Page or BrowserContext to capture screenshot from
 * @param quality - JPEG quality (1-100)
 * @param options - Screenshot capture options (format will be set to 'jpeg')
 * @returns Promise resolving to screenshot result
 */
export async function captureJPEG(
  target: Page | BrowserContext,
  quality: number = 80,
  options: Omit<ScreenshotCaptureOptions, 'format' | 'quality'> = {}
): Promise<ScreenshotResult> {
  return captureScreenshot(target, { ...options, format: 'jpeg', quality });
}

/**
 * Capture full page screenshot (scrollable content)
 *
 * @param target - Page or BrowserContext to capture screenshot from
 * @param options - Screenshot capture options (fullPage will be set to true)
 * @returns Promise resolving to screenshot result
 */
export async function captureFullPageScreenshot(
  target: Page | BrowserContext,
  options: Omit<ScreenshotCaptureOptions, 'fullPage'> = {}
): Promise<ScreenshotResult> {
  return captureScreenshot(target, { ...options, fullPage: true });
}

/**
 * Capture viewport screenshot (visible area only)
 *
 * @param target - Page or BrowserContext to capture screenshot from
 * @param options - Screenshot capture options (fullPage will be set to false)
 * @returns Promise resolving to screenshot result
 */
export async function captureViewportScreenshot(
  target: Page | BrowserContext,
  options: Omit<ScreenshotCaptureOptions, 'fullPage'> = {}
): Promise<ScreenshotResult> {
  return captureScreenshot(target, { ...options, fullPage: false });
}