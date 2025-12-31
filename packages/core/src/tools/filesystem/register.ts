/**
 * @fileoverview Registration utilities for filesystem tools
 *
 * This module provides convenience functions for registering filesystem tools
 * with the global tool registry.
 *
 * @module @apex/core/tools/filesystem/register
 */

import { getToolRegistry } from '../tool-registry.js';
import { ReadTool } from './read-tool.js';
import { EditTool } from './edit-tool.js';
import { MultiEditTool } from './multi-edit-tool.js';
import { WriteTool } from './write-tool.js';
import { GlobTool } from './glob-tool.js';
import { NotebookEditTool } from './notebook-edit-tool.js';

/**
 * Registers all filesystem tools with the global registry.
 *
 * This function registers the following tools:
 * - ReadTool: File reading with line numbers and multimodal support
 * - EditTool: Surgical file editing with string replacement
 * - MultiEditTool: Batch file editing with atomic rollback
 * - WriteTool: File creation and writing with safety features
 * - GlobTool: Fast file pattern matching with modification time sorting
 * - NotebookEditTool: Jupyter notebook cell editing with format preservation
 *
 * @throws {DuplicateToolError} If any tool is already registered
 *
 * @example
 * ```typescript
 * import { registerFilesystemTools } from '@apex/core/tools/filesystem/register';
 *
 * // Register all filesystem tools
 * registerFilesystemTools();
 * ```
 */
export function registerFilesystemTools(): void {
  const registry = getToolRegistry();

  // Register filesystem tools
  registry.register(new ReadTool());
  registry.register(new EditTool());
  registry.register(new MultiEditTool());
  registry.register(new WriteTool());
  registry.register(new GlobTool());
  registry.register(new NotebookEditTool());
}

/**
 * Registers only the Read tool with the global registry.
 *
 * @throws {DuplicateToolError} If the Read tool is already registered
 *
 * @example
 * ```typescript
 * import { registerReadTool } from '@apex/core/tools/filesystem/register';
 *
 * // Register only the Read tool
 * registerReadTool();
 * ```
 */
export function registerReadTool(): void {
  const registry = getToolRegistry();
  registry.register(new ReadTool());
}

/**
 * Creates a new Read tool instance.
 *
 * @returns A new ReadTool instance
 *
 * @example
 * ```typescript
 * import { createReadTool } from '@apex/core/tools/filesystem/register';
 *
 * const readTool = createReadTool();
 * // Use the tool instance directly or register it manually
 * ```
 */
export function createReadTool(): ReadTool {
  return new ReadTool();
}

/**
 * Registers only the Edit tool with the global registry.
 *
 * @throws {DuplicateToolError} If the Edit tool is already registered
 *
 * @example
 * ```typescript
 * import { registerEditTool } from '@apex/core/tools/filesystem/register';
 *
 * // Register only the Edit tool
 * registerEditTool();
 * ```
 */
export function registerEditTool(): void {
  const registry = getToolRegistry();
  registry.register(new EditTool());
}

/**
 * Creates a new Edit tool instance.
 *
 * @returns A new EditTool instance
 *
 * @example
 * ```typescript
 * import { createEditTool } from '@apex/core/tools/filesystem/register';
 *
 * const editTool = createEditTool();
 * // Use the tool instance directly or register it manually
 * ```
 */
export function createEditTool(): EditTool {
  return new EditTool();
}

/**
 * Registers only the Write tool with the global registry.
 *
 * @throws {DuplicateToolError} If the Write tool is already registered
 *
 * @example
 * ```typescript
 * import { registerWriteTool } from '@apex/core/tools/filesystem/register';
 *
 * // Register only the Write tool
 * registerWriteTool();
 * ```
 */
export function registerWriteTool(): void {
  const registry = getToolRegistry();
  registry.register(new WriteTool());
}

/**
 * Creates a new Write tool instance.
 *
 * @returns A new WriteTool instance
 *
 * @example
 * ```typescript
 * import { createWriteTool } from '@apex/core/tools/filesystem/register';
 *
 * const writeTool = createWriteTool();
 * // Use the tool instance directly or register it manually
 * ```
 */
export function createWriteTool(): WriteTool {
  return new WriteTool();
}

/**
 * Registers only the Glob tool with the global registry.
 *
 * @throws {DuplicateToolError} If the Glob tool is already registered
 *
 * @example
 * ```typescript
 * import { registerGlobTool } from '@apex/core/tools/filesystem/register';
 *
 * // Register only the Glob tool
 * registerGlobTool();
 * ```
 */
export function registerGlobTool(): void {
  const registry = getToolRegistry();
  registry.register(new GlobTool());
}

/**
 * Registers only the MultiEdit tool with the global registry.
 *
 * @throws {DuplicateToolError} If the MultiEdit tool is already registered
 *
 * @example
 * ```typescript
 * import { registerMultiEditTool } from '@apex/core/tools/filesystem/register';
 *
 * // Register only the MultiEdit tool
 * registerMultiEditTool();
 * ```
 */
export function registerMultiEditTool(): void {
  const registry = getToolRegistry();
  registry.register(new MultiEditTool());
}

/**
 * Creates a new MultiEdit tool instance.
 *
 * @returns A new MultiEditTool instance
 *
 * @example
 * ```typescript
 * import { createMultiEditTool } from '@apex/core/tools/filesystem/register';
 *
 * const multiEditTool = createMultiEditTool();
 * // Use the tool instance directly or register it manually
 * ```
 */
export function createMultiEditTool(): MultiEditTool {
  return new MultiEditTool();
}

/**
 * Creates a new Glob tool instance.
 *
 * @returns A new GlobTool instance
 *
 * @example
 * ```typescript
 * import { createGlobTool } from '@apex/core/tools/filesystem/register';
 *
 * const globTool = createGlobTool();
 * // Use the tool instance directly or register it manually
 * ```
 */
export function createGlobTool(): GlobTool {
  return new GlobTool();
}

/**
 * Registers only the NotebookEdit tool with the global registry.
 *
 * @throws {DuplicateToolError} If the NotebookEdit tool is already registered
 *
 * @example
 * ```typescript
 * import { registerNotebookEditTool } from '@apex/core/tools/filesystem/register';
 *
 * // Register only the NotebookEdit tool
 * registerNotebookEditTool();
 * ```
 */
export function registerNotebookEditTool(): void {
  const registry = getToolRegistry();
  registry.register(new NotebookEditTool());
}

/**
 * Creates a new NotebookEdit tool instance.
 *
 * @returns A new NotebookEditTool instance
 *
 * @example
 * ```typescript
 * import { createNotebookEditTool } from '@apex/core/tools/filesystem/register';
 *
 * const notebookEditTool = createNotebookEditTool();
 * // Use the tool instance directly or register it manually
 * ```
 */
export function createNotebookEditTool(): NotebookEditTool {
  return new NotebookEditTool();
}