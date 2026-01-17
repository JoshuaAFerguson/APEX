/**
 * Import Auto-Fixer Service
 *
 * Main service class that orchestrates detection and fixing of missing imports.
 * Combines multiple detectors and resolvers to provide comprehensive import
 * auto-fixing capabilities.
 *
 * @module orchestrator/import-auto-fixer/import-auto-fixer
 */

import { EventEmitter } from 'eventemitter3';
import * as fs from 'fs/promises';
import * as path from 'path';
import type {
  ImportAutoFixerOptions,
  ImportAutoFixerConfig,
  ImportAutoFixerEvents,
  MissingImportAnalysis,
  MissingImport,
  ImportFixResult,
  ImportFixSummary,
  AddedImport,
  ImportFixError,
  IImportDetector,
  IImportResolver,
  ResolverContext,
  ImportResolution,
  ExistingImport,
  TsConfigInfo,
  PackageJsonInfo,
} from './types';
import { DEFAULT_CONFIG } from './types';
import { ESLintDetector } from './detectors/eslint-detector';
import { LocalResolver } from './resolvers/local-resolver';
import { AliasResolver } from './resolvers/alias-resolver';
import { PackageResolver } from './resolvers/package-resolver';

// ============================================================================
// Import Auto-Fixer Implementation
// ============================================================================

/**
 * Service for automatically detecting and fixing missing imports
 *
 * @example
 * ```typescript
 * const fixer = new ImportAutoFixer({
 *   projectPath: '/path/to/project',
 *   detector: 'auto',
 * });
 *
 * // Analyze files for missing imports
 * const analysis = await fixer.analyze(['src/index.ts']);
 *
 * // Fix missing imports
 * const results = await fixer.fix(['src/index.ts']);
 * console.log(`Added ${results[0].importsAdded.length} imports`);
 * ```
 */
export class ImportAutoFixer extends EventEmitter<ImportAutoFixerEvents> {
  private projectPath: string;
  private config: ImportAutoFixerConfig;
  private detector: IImportDetector;
  private resolvers: IImportResolver[];
  private initialized = false;

  // Cached project info
  private tsConfigCache: TsConfigInfo | null = null;
  private packageJsonCache: PackageJsonInfo | null = null;

  constructor(options: ImportAutoFixerOptions) {
    super();
    this.projectPath = path.resolve(options.projectPath);
    this.config = this.mergeConfig(options);

    // Initialize detector
    this.detector = new ESLintDetector({ cwd: this.projectPath });

    // Initialize resolvers (sorted by priority)
    this.resolvers = [
      new LocalResolver(this.config.resolvers.local),
      new AliasResolver(this.config.resolvers.alias),
      new PackageResolver(this.config.resolvers.package),
    ].sort((a, b) => a.priority - b.priority);
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  /**
   * Analyze files for missing imports without modifying them
   *
   * @param files - Array of file paths to analyze
   * @returns Analysis results for each file
   */
  async analyze(files: string[]): Promise<MissingImportAnalysis[]> {
    await this.ensureInitialized();

    const absolutePaths = files.map(f => this.toAbsolutePath(f));

    this.emit('analysis:started', {
      files: absolutePaths,
      timestamp: new Date(),
    });

    const results: MissingImportAnalysis[] = [];

    for (const filePath of absolutePaths) {
      const result = await this.analyzeFile(filePath);
      results.push(result);
    }

    this.emit('analysis:completed', {
      results,
      timestamp: new Date(),
    });

    return results;
  }

  /**
   * Fix missing imports in the specified files
   *
   * @param files - Array of file paths to fix
   * @returns Fix results for each file
   */
  async fix(files: string[]): Promise<ImportFixResult[]> {
    await this.ensureInitialized();

    const absolutePaths = files.map(f => this.toAbsolutePath(f));
    const results: ImportFixResult[] = [];

    for (const filePath of absolutePaths) {
      const result = await this.fixFile(filePath);
      results.push(result);
    }

    return results;
  }

  /**
   * Fix missing imports in a single file
   *
   * @param filePath - Path to the file to fix
   * @returns Fix result
   */
  async fixFile(filePath: string): Promise<ImportFixResult> {
    const startTime = Date.now();
    const absolutePath = this.toAbsolutePath(filePath);

    try {
      // Read file content
      const content = await fs.readFile(absolutePath, 'utf-8');

      // Analyze for missing imports
      const analysis = await this.analyzeFile(absolutePath);

      this.emit('fix:started', {
        filePath: absolutePath,
        missingImports: analysis.missingImports.length,
        timestamp: new Date(),
      });

      if (analysis.missingImports.length === 0) {
        return {
          success: true,
          filePath: absolutePath,
          importsAdded: [],
          errors: [],
          duration: Date.now() - startTime,
        };
      }

      // Resolve and add imports
      const { modifiedContent, importsAdded, errors } = await this.resolveAndApplyImports(
        absolutePath,
        content,
        analysis.missingImports
      );

      // Write file if not dry run
      if (!this.config.behavior.dryRun && importsAdded.length > 0) {
        await fs.writeFile(absolutePath, modifiedContent, 'utf-8');
      }

      const result: ImportFixResult = {
        success: errors.length === 0,
        filePath: absolutePath,
        importsAdded,
        errors,
        modifiedContent: this.config.behavior.dryRun ? modifiedContent : undefined,
        duration: Date.now() - startTime,
      };

      this.emit('fix:completed', {
        result,
        timestamp: new Date(),
      });

      return result;
    } catch (error) {
      const fixError: ImportFixError = {
        type: 'io',
        message: error instanceof Error ? error.message : String(error),
        recoverable: false,
      };

      this.emit('fix:error', {
        filePath: absolutePath,
        error: fixError,
        timestamp: new Date(),
      });

      return {
        success: false,
        filePath: absolutePath,
        importsAdded: [],
        errors: [fixError],
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Get fix summary statistics for multiple results
   *
   * @param results - Array of fix results
   * @returns Summary statistics
   */
  getSummary(results: ImportFixResult[]): ImportFixSummary {
    return {
      filesProcessed: results.length,
      filesModified: results.filter(r => r.importsAdded.length > 0).length,
      totalImportsAdded: results.reduce((sum, r) => sum + r.importsAdded.length, 0),
      totalErrors: results.reduce((sum, r) => sum + r.errors.length, 0),
      totalDuration: results.reduce((sum, r) => sum + r.duration, 0),
    };
  }

  /**
   * Update configuration
   *
   * @param config - Partial configuration to merge
   */
  configure(config: Partial<ImportAutoFixerConfig>): void {
    this.config = {
      ...this.config,
      ...config,
      resolvers: {
        ...this.config.resolvers,
        ...config.resolvers,
      },
      style: {
        ...this.config.style,
        ...config.style,
      },
      behavior: {
        ...this.config.behavior,
        ...config.behavior,
      },
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): ImportAutoFixerConfig {
    return { ...this.config };
  }

  /**
   * Check if the service is available (detector is ready)
   */
  async isAvailable(): Promise<boolean> {
    return this.detector.isAvailable();
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Ensure the service is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    // Load project configuration
    await this.loadProjectConfig();
    this.initialized = true;
  }

  /**
   * Load project-specific configuration
   */
  private async loadProjectConfig(): Promise<void> {
    // Load tsconfig.json
    const tsConfigPath = path.join(this.projectPath, 'tsconfig.json');
    try {
      const content = await fs.readFile(tsConfigPath, 'utf-8');
      const parsed = JSON.parse(this.stripJsonComments(content));
      this.tsConfigCache = {
        configPath: tsConfigPath,
        compilerOptions: parsed.compilerOptions,
      };
    } catch {
      this.tsConfigCache = null;
    }

    // Load package.json
    const packageJsonPath = path.join(this.projectPath, 'package.json');
    try {
      const content = await fs.readFile(packageJsonPath, 'utf-8');
      const parsed = JSON.parse(content);
      this.packageJsonCache = {
        packagePath: packageJsonPath,
        name: parsed.name,
        dependencies: parsed.dependencies || {},
        devDependencies: parsed.devDependencies || {},
        peerDependencies: parsed.peerDependencies,
      };
    } catch {
      this.packageJsonCache = null;
    }
  }

  /**
   * Analyze a single file for missing imports
   */
  private async analyzeFile(filePath: string): Promise<MissingImportAnalysis> {
    const startTime = Date.now();
    const errors: MissingImportAnalysis['errors'] = [];

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const missingImports = await this.detector.detect(filePath, content);

      return {
        filePath,
        missingImports,
        errors,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      errors.push({
        type: 'io',
        message: error instanceof Error ? error.message : String(error),
      });

      return {
        filePath,
        missingImports: [],
        errors,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Resolve and apply imports to file content
   */
  private async resolveAndApplyImports(
    filePath: string,
    content: string,
    missingImports: MissingImport[]
  ): Promise<{
    modifiedContent: string;
    importsAdded: AddedImport[];
    errors: ImportFixError[];
  }> {
    const importsAdded: AddedImport[] = [];
    const errors: ImportFixError[] = [];
    const existingImports = this.parseExistingImports(content);

    // Build resolver context
    const context: ResolverContext = {
      filePath,
      projectPath: this.projectPath,
      tsConfig: this.tsConfigCache ?? undefined,
      packageJson: this.packageJsonCache ?? undefined,
      existingImports,
      missingImport: missingImports[0], // Will be updated per import
    };

    // Resolve each missing import
    const resolutions: Array<{ identifier: string; resolution: ImportResolution }> = [];

    for (const missingImport of missingImports) {
      context.missingImport = missingImport;
      const resolution = await this.resolveImport(missingImport.identifier, context);

      if (resolution) {
        resolutions.push({ identifier: missingImport.identifier, resolution });
      } else {
        errors.push({
          type: 'resolution',
          identifier: missingImport.identifier,
          message: `Could not resolve import for '${missingImport.identifier}'`,
          recoverable: true,
          suggestion: `Add the import manually or check if the module is installed`,
        });
      }
    }

    // Apply resolutions to content
    const { modifiedContent, addedImports } = this.applyResolutions(
      content,
      resolutions,
      existingImports
    );

    for (const added of addedImports) {
      importsAdded.push(added);
      this.emit('fix:import-added', {
        filePath,
        import: added,
        timestamp: new Date(),
      });
    }

    return { modifiedContent, importsAdded, errors };
  }

  /**
   * Resolve a single import using available resolvers
   */
  private async resolveImport(
    identifier: string,
    context: ResolverContext
  ): Promise<ImportResolution | null> {
    for (const resolver of this.resolvers) {
      if (await resolver.canResolve(identifier, context)) {
        const resolution = await resolver.resolve(identifier, context);
        if (resolution) {
          return resolution;
        }
      }
    }
    return null;
  }

  /**
   * Apply resolutions to file content
   */
  private applyResolutions(
    content: string,
    resolutions: Array<{ identifier: string; resolution: ImportResolution }>,
    existingImports: ExistingImport[]
  ): { modifiedContent: string; addedImports: AddedImport[] } {
    const addedImports: AddedImport[] = [];

    // Group resolutions by source
    const bySource = new Map<string, Array<{ identifier: string; resolution: ImportResolution }>>();

    for (const { identifier, resolution } of resolutions) {
      const existing = bySource.get(resolution.source) || [];
      existing.push({ identifier, resolution });
      bySource.set(resolution.source, existing);
    }

    // Build import statements
    const newImports: string[] = [];
    const quote = this.config.style.quoteStyle === 'double' ? '"' : "'";
    const semi = this.config.style.semicolons ? ';' : '';

    for (const [source, items] of bySource) {
      // Check if we can extend an existing import
      const existingImport = existingImports.find(imp => imp.source === source);

      if (existingImport) {
        // TODO: Extend existing import (more complex modification)
        // For now, create a new import line
      }

      // Group by import type
      const namedImports = items.filter(i => i.resolution.importType === 'named');
      const defaultImports = items.filter(i => i.resolution.importType === 'default');
      const namespaceImports = items.filter(i => i.resolution.importType === 'namespace');

      // Build import statement
      const parts: string[] = [];

      // Default import
      if (defaultImports.length > 0) {
        parts.push(defaultImports[0].identifier);
        addedImports.push({
          specifier: defaultImports[0].identifier,
          source,
          importType: 'default',
          line: 1, // Will be adjusted
          isTypeOnly: defaultImports[0].resolution.isTypeOnly,
          originalIdentifier: defaultImports[0].identifier,
        });
      }

      // Named imports
      if (namedImports.length > 0) {
        const names = namedImports.map(i => i.identifier);
        const isTypeOnly = namedImports.every(i => i.resolution.isTypeOnly) &&
                          this.config.style.useTypeImports;

        if (parts.length > 0) {
          parts.push(', ');
        }
        parts.push(`{ ${names.join(', ')} }`);

        for (const item of namedImports) {
          addedImports.push({
            specifier: item.identifier,
            source,
            importType: 'named',
            line: 1,
            isTypeOnly: item.resolution.isTypeOnly,
            originalIdentifier: item.identifier,
          });
        }
      }

      // Namespace import
      if (namespaceImports.length > 0) {
        const name = namespaceImports[0].identifier;
        if (parts.length > 0) {
          parts.push(', ');
        }
        parts.push(`* as ${name}`);
        addedImports.push({
          specifier: `* as ${name}`,
          source,
          importType: 'namespace',
          line: 1,
          isTypeOnly: namespaceImports[0].resolution.isTypeOnly,
          originalIdentifier: name,
        });
      }

      // Build final import statement
      if (parts.length > 0) {
        const typePrefix = namedImports.length > 0 &&
                          namedImports.every(i => i.resolution.isTypeOnly) &&
                          this.config.style.useTypeImports
          ? 'type '
          : '';

        newImports.push(`import ${typePrefix}${parts.join('')} from ${quote}${source}${quote}${semi}`);
      }
    }

    // Insert imports at the top of the file
    let modifiedContent = content;

    if (newImports.length > 0) {
      const insertPosition = this.findImportInsertPosition(content);
      const importBlock = newImports.join('\n') + '\n';

      modifiedContent =
        content.slice(0, insertPosition) +
        importBlock +
        (insertPosition === 0 && !content.startsWith('\n') ? '\n' : '') +
        content.slice(insertPosition);

      // Update line numbers
      const insertLine = content.slice(0, insertPosition).split('\n').length;
      for (const added of addedImports) {
        added.line = insertLine;
      }
    }

    return { modifiedContent, addedImports };
  }

  /**
   * Find position to insert new imports
   */
  private findImportInsertPosition(content: string): number {
    // Find the last existing import or the start of the file
    const lines = content.split('\n');
    let lastImportLineIndex = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Skip comments and empty lines at the top
      if (lastImportLineIndex === -1) {
        if (line === '' || line.startsWith('//') || line.startsWith('/*') || line.startsWith('*')) {
          continue;
        }
      }

      // Check for import statement
      if (line.startsWith('import ')) {
        lastImportLineIndex = i;
        // Continue to find multi-line imports
        if (!line.includes(' from ') && !line.includes("'") && !line.includes('"')) {
          // Multi-line import, continue until we find the end
          while (i < lines.length && !lines[i].includes(' from ')) {
            i++;
          }
          lastImportLineIndex = i;
        }
      } else if (lastImportLineIndex >= 0 && line !== '' && !line.startsWith('//')) {
        // We've found non-import code after imports
        break;
      }
    }

    if (lastImportLineIndex >= 0) {
      // Insert after last import
      let position = 0;
      for (let i = 0; i <= lastImportLineIndex; i++) {
        position += lines[i].length + 1; // +1 for newline
      }
      return position;
    }

    // Insert at the beginning of the file
    // But skip any leading comments or 'use strict'
    let position = 0;
    for (const line of lines) {
      const trimmed = line.trim();
      if (
        trimmed === '' ||
        trimmed.startsWith('//') ||
        trimmed.startsWith('/*') ||
        trimmed.startsWith('*') ||
        trimmed.startsWith("'use strict'") ||
        trimmed.startsWith('"use strict"')
      ) {
        position += line.length + 1;
      } else {
        break;
      }
    }

    return position;
  }

  /**
   * Parse existing imports from file content
   */
  private parseExistingImports(content: string): ExistingImport[] {
    const imports: ExistingImport[] = [];
    const importRegex = /^import\s+(?:type\s+)?(.+?)\s+from\s+['"]([^'"]+)['"]/gm;

    let match;
    while ((match = importRegex.exec(content)) !== null) {
      const specifiers = match[1];
      const source = match[2];
      const line = content.slice(0, match.index).split('\n').length;

      const importInfo: ExistingImport = {
        source,
        line,
        isTypeOnly: match[0].includes('import type'),
      };

      // Parse specifiers
      if (specifiers.includes('{')) {
        // Named imports
        const namedMatch = specifiers.match(/\{([^}]+)\}/);
        if (namedMatch) {
          importInfo.namedImports = namedMatch[1]
            .split(',')
            .map(s => s.trim().split(/\s+as\s+/).pop()!.trim())
            .filter(Boolean);
        }

        // Check for default import with named
        const defaultMatch = specifiers.match(/^(\w+)\s*,/);
        if (defaultMatch) {
          importInfo.defaultImport = defaultMatch[1];
        }
      } else if (specifiers.includes('* as')) {
        // Namespace import
        const nsMatch = specifiers.match(/\*\s+as\s+(\w+)/);
        if (nsMatch) {
          importInfo.namespaceImport = nsMatch[1];
        }
      } else {
        // Default import only
        const defaultMatch = specifiers.match(/^(\w+)$/);
        if (defaultMatch) {
          importInfo.defaultImport = defaultMatch[1];
        }
      }

      imports.push(importInfo);
    }

    return imports;
  }

  /**
   * Strip JSON comments for tsconfig parsing
   */
  private stripJsonComments(json: string): string {
    return json
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
  }

  /**
   * Convert path to absolute
   */
  private toAbsolutePath(filePath: string): string {
    if (path.isAbsolute(filePath)) {
      return filePath;
    }
    return path.join(this.projectPath, filePath);
  }

  /**
   * Merge options with default config
   */
  private mergeConfig(options: ImportAutoFixerOptions): ImportAutoFixerConfig {
    return {
      detector: options.detector || DEFAULT_CONFIG.detector,
      resolvers: {
        local: {
          ...DEFAULT_CONFIG.resolvers.local,
          ...options.resolvers?.local,
        },
        alias: {
          ...DEFAULT_CONFIG.resolvers.alias,
          ...options.resolvers?.alias,
        },
        package: {
          ...DEFAULT_CONFIG.resolvers.package,
          ...options.resolvers?.package,
        },
      },
      style: {
        ...DEFAULT_CONFIG.style,
        preferredImportStyle: options.preferredImportStyle || DEFAULT_CONFIG.style.preferredImportStyle,
        organizeImports: options.organizeImports ?? DEFAULT_CONFIG.style.organizeImports,
        respectExistingStyle: options.respectExistingStyle ?? DEFAULT_CONFIG.style.respectExistingStyle,
      },
      behavior: {
        ...DEFAULT_CONFIG.behavior,
        dryRun: options.dryRun ?? DEFAULT_CONFIG.behavior.dryRun,
      },
    };
  }
}
