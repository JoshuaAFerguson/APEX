/**
 * @fileoverview Registration utilities for browser tools
 *
 * This module provides convenience functions for registering browser tools
 * with the global tool registry and parameterized registries.
 *
 * @module @apex/core/tools/browser/register
 */

import { getToolRegistry } from '../tool-registry.js';
import type { ToolRegistry } from '../tool-registry.js';
import { BrowserTool, type BrowserToolOptions } from './browser-tool.js';

/**
 * Registers all browser tools with the provided registry.
 * This is the main function that matches the pattern of other tool modules.
 *
 * @param registry - The tool registry to register tools with
 * @param config - Optional configuration for browser tools
 * @throws {DuplicateToolError} If any tool is already registered
 *
 * @example
 * ```typescript
 * import { ToolRegistry } from '@apex/core/tools';
 * import { registerBrowserTools } from '@apex/core/tools/browser/register';
 *
 * const registry = new ToolRegistry();
 * registerBrowserTools(registry);
 * ```
 */
export function registerBrowserTools(
  registry: ToolRegistry,
  config?: BrowserToolOptions
): void {
  registerBrowserTool(registry, config);
}

/**
 * Registers all browser tools with the global registry.
 * This is a convenience function that uses the global registry.
 *
 * @param config - Optional configuration for browser tools
 * @throws {DuplicateToolError} If any tool is already registered
 *
 * @example
 * ```typescript
 * import { registerBrowserToolsGlobal } from '@apex/core/tools/browser/register';
 *
 * // Register all browser tools with default configuration
 * registerBrowserToolsGlobal();
 * ```
 */
export function registerBrowserToolsGlobal(config?: BrowserToolOptions): void {
  const registry = getToolRegistry();
  registerBrowserTools(registry, config);
}

/**
 * Registers the Browser tool with the provided registry.
 *
 * @param registry - The tool registry to register the tool with
 * @param config - Optional configuration for the BrowserTool
 * @throws {DuplicateToolError} If the Browser tool is already registered
 *
 * @example
 * ```typescript
 * import { ToolRegistry } from '@apex/core/tools';
 * import { registerBrowserTool } from '@apex/core/tools/browser/register';
 *
 * const registry = new ToolRegistry();
 * registerBrowserTool(registry, {
 *   allowedDomains: ['example.com'],
 *   headless: true
 * });
 * ```
 */
export function registerBrowserTool(
  registry: ToolRegistry,
  config?: BrowserToolOptions
): void {
  registry.register(new BrowserTool(config));
}

/**
 * Creates a new instance of the Browser tool.
 *
 * @param config - Optional configuration
 * @returns A new BrowserTool instance
 *
 * @example
 * ```typescript
 * import { createBrowserTool } from '@apex/core/tools/browser/register';
 *
 * const browserTool = createBrowserTool({
 *   allowedDomains: ['example.com'],
 *   allowScreenshots: true
 * });
 * // Use the tool instance directly or register it manually
 * ```
 */
export function createBrowserTool(config?: BrowserToolOptions): BrowserTool {
  return new BrowserTool(config);
}

/**
 * Array of all browser tool constructors for easy access
 */
export const browserToolClasses = [BrowserTool] as const;

/**
 * Array of browser tool instances with default configuration
 */
export const browserTools = browserToolClasses.map(ToolClass => new ToolClass());
