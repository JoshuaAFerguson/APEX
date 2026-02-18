/**
 * Alias Import Resolver
 *
 * Resolves imports using TypeScript path aliases from tsconfig.json.
 * This resolver handles path mappings like @/ or ~/components.
 *
 * @module orchestrator/import-auto-fixer/resolvers/alias-resolver
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type {
  ImportResolution,
  ResolverContext,
  AliasResolverConfig,
  TsConfigInfo,
} from '../types';
import { BaseResolver } from './base-resolver';

/**
 * Resolver that uses TypeScript path aliases
 *
 * @example
 * ```typescript
 * const resolver = new AliasResolver();
 * const resolution = await resolver.resolve('MyComponent', context);
 * // { source: '@/components/MyComponent', importType: 'default', ... }
 * ```
 */
export class AliasResolver extends BaseResolver {
  readonly id = 'alias';
  readonly priority = 2; // Second priority after local

  private config: AliasResolverConfig;
  private tsConfigCache: Map<string, TsConfigInfo | null> = new Map();

  constructor(config: Partial<AliasResolverConfig> = {}) {
    super();
    this.config = {
      enabled: true,
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

    // We need tsConfig with paths configured
    const tsConfig = await this.loadTsConfig(context.projectPath);
    if (!tsConfig?.compilerOptions?.paths) {
      return false;
    }

    return true;
  }

  /**
   * Resolve the import source for an identifier using path aliases
   */
  async resolve(
    identifier: string,
    context: ResolverContext
  ): Promise<ImportResolution | null> {
    if (!this.config.enabled) {
      return null;
    }

    const tsConfig = await this.loadTsConfig(context.projectPath);
    if (!tsConfig?.compilerOptions?.paths) {
      return null;
    }

    const baseUrl = tsConfig.compilerOptions.baseUrl || '.';
    const paths = tsConfig.compilerOptions.paths;
    const configDir = path.dirname(tsConfig.configPath);

    // Try to find the identifier in aliased paths
    for (const [alias, targets] of Object.entries(paths)) {
      for (const target of targets) {
        const resolution = await this.tryResolveInAlias(
          identifier,
          alias,
          target,
          baseUrl,
          configDir,
          context
        );

        if (resolution) {
          return resolution;
        }
      }
    }

    return null;
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Load and cache tsconfig.json
   */
  private async loadTsConfig(projectPath: string): Promise<TsConfigInfo | null> {
    if (this.tsConfigCache.has(projectPath)) {
      return this.tsConfigCache.get(projectPath) ?? null;
    }

    const tsConfigPath = path.join(projectPath, 'tsconfig.json');

    try {
      const content = await fs.readFile(tsConfigPath, 'utf-8');
      // Simple JSON parse - doesn't handle comments or extends
      const parsed = JSON.parse(this.stripJsonComments(content));

      const tsConfig: TsConfigInfo = {
        configPath: tsConfigPath,
        compilerOptions: parsed.compilerOptions,
      };

      this.tsConfigCache.set(projectPath, tsConfig);
      return tsConfig;
    } catch {
      this.tsConfigCache.set(projectPath, null);
      return null;
    }
  }

  /**
   * Strip comments from JSON (tsconfig allows comments)
   */
  private stripJsonComments(json: string): string {
    return json
      .replace(/\/\*[\s\S]*?\*\//g, '') // Block comments
      .replace(/\/\/.*$/gm, '');         // Line comments
  }

  /**
   * Try to resolve identifier within an alias path
   */
  private async tryResolveInAlias(
    identifier: string,
    alias: string,
    target: string,
    baseUrl: string,
    configDir: string,
    context: ResolverContext
  ): Promise<ImportResolution | null> {
    // Handle wildcard aliases (e.g., "@/*" -> "src/*")
    const isWildcard = alias.endsWith('/*') && target.endsWith('/*');

    let searchDir: string;
    let aliasPrefix: string;

    if (isWildcard) {
      searchDir = path.resolve(configDir, baseUrl, target.slice(0, -2));
      aliasPrefix = alias.slice(0, -2);
    } else {
      searchDir = path.resolve(configDir, baseUrl, target);
      aliasPrefix = alias;
    }

    // Search for the identifier in the alias target directory
    const found = await this.findExportInDirectory(identifier, searchDir);
    if (!found) {
      return null;
    }

    // Build the aliased import path
    const relativePath = path.relative(searchDir, found.filePath);
    const aliasPath = isWildcard
      ? `${aliasPrefix}/${this.normalizeImportPath(relativePath, false)}`
      : aliasPrefix;

    return this.createResolution({
      source: aliasPath,
      importType: found.isDefault ? 'default' : 'named',
      isTypeOnly: found.isType,
      confidence: 0.75, // Slightly lower than local since aliases can be tricky
    });
  }

  /**
   * Search for an export in a directory
   */
  private async findExportInDirectory(
    identifier: string,
    dirPath: string
  ): Promise<{ filePath: string; isDefault: boolean; isType: boolean } | null> {
    // Check for direct file match (e.g., MyComponent.ts)
    const possibleFiles = [
      `${identifier}.ts`,
      `${identifier}.tsx`,
      `${identifier}.js`,
      `${identifier}.jsx`,
      `${identifier}/index.ts`,
      `${identifier}/index.tsx`,
      `${identifier}/index.js`,
      `${identifier}/index.jsx`,
    ];

    for (const file of possibleFiles) {
      const filePath = path.join(dirPath, file);
      try {
        await fs.access(filePath);
        // Found a file, check if it exports the identifier
        const content = await fs.readFile(filePath, 'utf-8');
        const exportInfo = this.findExportInContent(identifier, content);
        if (exportInfo) {
          return { filePath, ...exportInfo };
        }
      } catch {
        // File doesn't exist, continue
      }
    }

    // Scan directory for exports
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile()) continue;

        const ext = path.extname(entry.name).toLowerCase();
        if (!['.ts', '.tsx', '.js', '.jsx'].includes(ext)) continue;

        const filePath = path.join(dirPath, entry.name);
        const content = await fs.readFile(filePath, 'utf-8');
        const exportInfo = this.findExportInContent(identifier, content);
        if (exportInfo) {
          return { filePath, ...exportInfo };
        }
      }
    } catch {
      // Directory doesn't exist or isn't accessible
    }

    return null;
  }

  /**
   * Find an export in file content
   */
  private findExportInContent(
    identifier: string,
    content: string
  ): { isDefault: boolean; isType: boolean } | null {
    // Check for named export
    const namedExportRegex = new RegExp(
      `export\\s+(?:const|let|var|function|class|type|interface|enum)\\s+${identifier}\\b`
    );
    if (namedExportRegex.test(content)) {
      const isType = new RegExp(
        `export\\s+(?:type|interface)\\s+${identifier}\\b`
      ).test(content);
      return { isDefault: false, isType };
    }

    // Check for export { identifier }
    const exportBlockRegex = /export\s*\{([^}]+)\}/g;
    let match;
    while ((match = exportBlockRegex.exec(content)) !== null) {
      const names = match[1].split(',').map(s => {
        const parts = s.trim().split(/\s+as\s+/);
        return parts[parts.length - 1].trim();
      });
      if (names.includes(identifier)) {
        return { isDefault: false, isType: false };
      }
    }

    // Check for default export
    const defaultExportRegex = new RegExp(
      `export\\s+default\\s+(?:class|function)?\\s*${identifier}\\b`
    );
    if (defaultExportRegex.test(content)) {
      return { isDefault: true, isType: false };
    }

    return null;
  }
}
