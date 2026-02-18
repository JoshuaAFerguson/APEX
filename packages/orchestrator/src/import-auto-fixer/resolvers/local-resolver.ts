/**
 * Local Import Resolver
 *
 * Resolves imports from local project files by searching for exports
 * in the project's source directories.
 *
 * @module orchestrator/import-auto-fixer/resolvers/local-resolver
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { ImportResolution, ResolverContext, LocalResolverConfig } from '../types';
import { BaseResolver } from './base-resolver';

/**
 * Cache entry for export information
 */
interface ExportInfo {
  filePath: string;
  exports: {
    name: string;
    isDefault: boolean;
    isType: boolean;
  }[];
  lastModified: number;
}

/**
 * Resolver that searches local project files for exports
 *
 * @example
 * ```typescript
 * const resolver = new LocalResolver({
 *   searchPaths: ['src', 'lib'],
 *   excludePatterns: ['**\/*.test.*'],
 * });
 *
 * const resolution = await resolver.resolve('MyComponent', context);
 * // { source: './components/MyComponent', importType: 'default', ... }
 * ```
 */
export class LocalResolver extends BaseResolver {
  readonly id = 'local';
  readonly priority = 1; // Highest priority - prefer local imports

  private config: LocalResolverConfig;
  private exportCache: Map<string, ExportInfo> = new Map();
  private projectExports: Map<string, ExportInfo[]> = new Map(); // identifier -> files exporting it

  constructor(config: Partial<LocalResolverConfig> = {}) {
    super();
    this.config = {
      enabled: true,
      searchPaths: ['src', 'lib'],
      excludePatterns: ['**/node_modules/**', '**/*.test.*', '**/*.spec.*', '**/__tests__/**'],
      ...config,
    };
  }

  /**
   * Check if this resolver can potentially resolve the identifier
   */
  async canResolve(identifier: string, context: ResolverContext): Promise<boolean> {
    if (!this.config.enabled) {
      return false;
    }

    // Skip if already imported
    if (this.isAlreadyImported(identifier, context)) {
      return false;
    }

    // Check cache first
    if (this.projectExports.has(identifier)) {
      return true;
    }

    // Scan project if not cached
    await this.scanProjectExports(context.projectPath);

    return this.projectExports.has(identifier);
  }

  /**
   * Resolve the import source for an identifier
   */
  async resolve(
    identifier: string,
    context: ResolverContext
  ): Promise<ImportResolution | null> {
    if (!this.config.enabled) {
      return null;
    }

    // Ensure exports are scanned
    await this.scanProjectExports(context.projectPath);

    const exportingSources = this.projectExports.get(identifier);
    if (!exportingSources || exportingSources.length === 0) {
      return null;
    }

    // Find the best source
    const bestSource = this.selectBestSource(exportingSources, context);
    if (!bestSource) {
      return null;
    }

    // Find the specific export
    const exportInfo = bestSource.exports.find(e => e.name === identifier);
    if (!exportInfo) {
      return null;
    }

    // Calculate relative path
    const relativePath = this.getRelativePath(context.filePath, bestSource.filePath);

    return this.createResolution({
      source: relativePath,
      importType: exportInfo.isDefault ? 'default' : 'named',
      isTypeOnly: exportInfo.isType,
      confidence: this.calculateConfidence(bestSource, context),
    });
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Scan project for all exports
   */
  private async scanProjectExports(projectPath: string): Promise<void> {
    // Clear existing cache for this project
    this.projectExports.clear();

    const searchDirs = this.config.searchPaths.map(p => path.join(projectPath, p));

    for (const searchDir of searchDirs) {
      try {
        await this.scanDirectory(searchDir);
      } catch {
        // Directory may not exist, skip it
      }
    }
  }

  /**
   * Recursively scan a directory for exports
   */
  private async scanDirectory(dirPath: string): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(dirPath, { withFileTypes: true });
    } catch {
      return; // Directory doesn't exist or isn't accessible
    }

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      // Check exclusion patterns
      if (this.isExcluded(fullPath)) {
        continue;
      }

      if (entry.isDirectory()) {
        await this.scanDirectory(fullPath);
      } else if (this.isSourceFile(entry.name)) {
        await this.extractExports(fullPath);
      }
    }
  }

  /**
   * Check if path matches exclusion patterns
   */
  private isExcluded(filePath: string): boolean {
    const normalizedPath = filePath.replace(/\\/g, '/');

    return this.config.excludePatterns.some(pattern => {
      // Simple glob matching for common patterns
      if (pattern.includes('**')) {
        const regex = pattern
          .replace(/\*\*/g, '.*')
          .replace(/\*/g, '[^/]*')
          .replace(/\./g, '\\.');
        return new RegExp(regex).test(normalizedPath);
      }
      return normalizedPath.includes(pattern);
    });
  }

  /**
   * Check if file is a source file we should scan
   */
  private isSourceFile(filename: string): boolean {
    const ext = path.extname(filename).toLowerCase();
    return ['.ts', '.tsx', '.js', '.jsx', '.mts', '.mjs'].includes(ext);
  }

  /**
   * Extract exports from a source file
   */
  private async extractExports(filePath: string): Promise<void> {
    let content;
    try {
      content = await fs.readFile(filePath, 'utf-8');
    } catch {
      return;
    }

    const stat = await fs.stat(filePath);
    const exports: ExportInfo['exports'] = [];

    // Extract named exports: export const/let/var/function/class/type/interface
    const namedExportRegex = /export\s+(?:const|let|var|function|class|type|interface|enum)\s+(\w+)/g;
    let match;
    while ((match = namedExportRegex.exec(content)) !== null) {
      exports.push({
        name: match[1],
        isDefault: false,
        isType: match[0].includes('type') || match[0].includes('interface'),
      });
    }

    // Extract named exports from export { ... }
    const exportBlockRegex = /export\s*\{([^}]+)\}/g;
    while ((match = exportBlockRegex.exec(content)) !== null) {
      const names = match[1].split(',').map(s => s.trim().split(/\s+as\s+/).pop()!.trim());
      for (const name of names) {
        if (name && !exports.some(e => e.name === name)) {
          exports.push({ name, isDefault: false, isType: false });
        }
      }
    }

    // Extract default export
    const defaultExportRegex = /export\s+default\s+(?:class|function)?\s*(\w+)?/;
    const defaultMatch = content.match(defaultExportRegex);
    if (defaultMatch) {
      const name = defaultMatch[1] || this.getDefaultExportName(filePath);
      if (name && !exports.some(e => e.name === name && e.isDefault)) {
        exports.push({ name, isDefault: true, isType: false });
      }
    }

    // Store in cache
    const exportInfo: ExportInfo = {
      filePath,
      exports,
      lastModified: stat.mtimeMs,
    };

    this.exportCache.set(filePath, exportInfo);

    // Index by identifier
    for (const exp of exports) {
      const existing = this.projectExports.get(exp.name) || [];
      existing.push(exportInfo);
      this.projectExports.set(exp.name, existing);
    }
  }

  /**
   * Generate a default export name from file path
   */
  private getDefaultExportName(filePath: string): string {
    const basename = path.basename(filePath, path.extname(filePath));
    // Convert to PascalCase
    return basename
      .split(/[-_]/)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join('');
  }

  /**
   * Select the best source from multiple options
   */
  private selectBestSource(
    sources: ExportInfo[],
    context: ResolverContext
  ): ExportInfo | null {
    if (sources.length === 0) return null;
    if (sources.length === 1) return sources[0];

    // Score each source
    const scored = sources.map(source => ({
      source,
      score: this.scoreSource(source, context),
    }));

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    return scored[0].source;
  }

  /**
   * Score a source based on proximity and relevance
   */
  private scoreSource(source: ExportInfo, context: ResolverContext): number {
    let score = 0;

    // Prefer sources closer to the importing file
    const relPath = path.relative(path.dirname(context.filePath), source.filePath);
    const depth = relPath.split(path.sep).filter(p => p === '..').length;
    score -= depth * 10;

    // Prefer index files
    if (path.basename(source.filePath, path.extname(source.filePath)) === 'index') {
      score += 5;
    }

    // Prefer files in the same directory
    if (path.dirname(source.filePath) === path.dirname(context.filePath)) {
      score += 20;
    }

    return score;
  }

  /**
   * Calculate confidence score for a resolution
   */
  private calculateConfidence(source: ExportInfo, context: ResolverContext): number {
    let confidence = 0.7; // Base confidence for local resolution

    // Higher confidence if in same directory
    if (path.dirname(source.filePath) === path.dirname(context.filePath)) {
      confidence += 0.15;
    }

    // Slightly lower confidence for deeply nested paths
    const relPath = path.relative(path.dirname(context.filePath), source.filePath);
    const depth = relPath.split(path.sep).filter(p => p === '..').length;
    confidence -= depth * 0.05;

    return Math.max(0.3, Math.min(1, confidence));
  }
}
