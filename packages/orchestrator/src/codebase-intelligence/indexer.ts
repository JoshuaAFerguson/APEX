/**
 * CodebaseIndexer - Directory Indexing and RepositoryMap Generation
 *
 * Provides functionality to index entire codebases and generate structured
 * RepositoryMap objects containing all code intelligence data: files, symbols,
 * metadata, and statistics.
 *
 * Key Features:
 * - Discovers files by supported extensions
 * - Parallel processing with configurable concurrency
 * - Symbol extraction using language-specific extractors
 * - Error handling with continue-on-error support
 * - Progress tracking for UI integration
 * - Statistics calculation and content hashing
 *
 * @example
 * ```typescript
 * const indexer = CodebaseIndexer.getInstance();
 * const repoMap = await indexer.indexDirectory('/path/to/project');
 * console.log(`Indexed ${repoMap.stats?.totalFiles} files with ${repoMap.stats?.totalSymbols} symbols`);
 * ```
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { glob } from 'glob';

import type {
  RepositoryMap,
  CodeFile,
  CodeSymbol,
  SymbolType
} from '@apexcli/core/types';

import { TreeSitterWrapper } from './parsers/tree-sitter-wrapper.js';
import { getExtractorForLanguage } from './extractors/index.js';
import {
  getLanguageForExtension,
  getSupportedExtensions,
  EXTENSION_LANGUAGE_MAP,
  type SupportedLanguage
} from './parsers/types.js';
import {
  SymbolKind,
  hasExtractorSupport,
  ExtractionError,
  type ExtractedSymbol,
  type ExtractionResult,
  type ExtractionOptions
} from './extractors/types.js';
import { TypeAwarenessAnalyzer, type TypeAnalysisOptions, type TypeInformation } from './type-awareness-analyzer.js';

/**
 * Configuration options for directory indexing
 */
export interface IndexingOptions {
  /** File patterns to include (glob patterns) */
  includePatterns?: string[];

  /** File patterns to exclude (glob patterns) */
  excludePatterns?: string[];

  /** Maximum file size in bytes to process (0 = unlimited) */
  maxFileSize?: number;

  /** Whether to extract documentation comments */
  includeDocumentation?: boolean;

  /** Whether to extract function/method signatures */
  includeSignatures?: boolean;

  /** Maximum depth for nested symbols (classes with methods, etc.) */
  maxSymbolDepth?: number;

  /** Whether to compute content hashes for change detection */
  computeHashes?: boolean;

  /** Whether to continue processing on individual file errors */
  continueOnError?: boolean;

  /** Concurrency limit for parallel file processing */
  concurrency?: number;

  /** Whether to enable enhanced TypeScript type analysis */
  enableTypeAnalysis?: boolean;

  /** Type analysis configuration */
  typeAnalysisOptions?: TypeAnalysisOptions;
}

/**
 * Progress information during indexing
 */
export interface IndexingProgress {
  /** Current file being processed */
  currentFile: string;
  /** Number of files processed */
  filesProcessed: number;
  /** Total files to process */
  totalFiles: number;
  /** Errors encountered so far */
  errors: IndexingError[];
}

/**
 * Error information from indexing process
 */
export interface IndexingError {
  /** File where error occurred */
  file: string;
  /** Error message */
  message: string;
  /** Error severity */
  severity: 'warning' | 'error';
}

/**
 * Default indexing configuration
 */
const DEFAULT_INDEXING_OPTIONS: Required<IndexingOptions> = {
  includePatterns: ['**/*'],
  excludePatterns: [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/.git/**',
    '**/coverage/**',
    '**/__pycache__/**',
    '**/venv/**',
    '**/.venv/**',
    '**/*.min.js',
    '**/*.bundle.js',
    '**/.*', // Hidden files/directories
    '**/temp/**',
    '**/tmp/**'
  ],
  maxFileSize: 1024 * 1024, // 1MB
  includeDocumentation: true,
  includeSignatures: true,
  maxSymbolDepth: undefined, // unlimited
  computeHashes: true,
  continueOnError: true,
  concurrency: 4,
  enableTypeAnalysis: true,
  typeAnalysisOptions: {
    includeDependencies: true,
    includeDetailedAnnotations: true,
    includeGenerics: true,
    includeImportsExports: true,
    maxTypeDepth: 5,
    resolveTypeAliases: true
  }
};

/**
 * Mapping from SymbolKind (extractors) to SymbolType (core types)
 */
const SYMBOL_KIND_TO_TYPE_MAP: Record<SymbolKind, SymbolType> = {
  [SymbolKind.Function]: 'function',
  [SymbolKind.ArrowFunction]: 'function',
  [SymbolKind.Class]: 'class',
  [SymbolKind.Interface]: 'interface',
  [SymbolKind.TypeAlias]: 'type',
  [SymbolKind.Enum]: 'enum',
  [SymbolKind.Constant]: 'constant',
  [SymbolKind.Variable]: 'variable',
  [SymbolKind.Method]: 'method',
  [SymbolKind.Property]: 'property',
  [SymbolKind.Constructor]: 'method',
  [SymbolKind.Getter]: 'method',
  [SymbolKind.Setter]: 'method',
  [SymbolKind.Parameter]: 'parameter',
  [SymbolKind.EnumMember]: 'constant',
  [SymbolKind.Decorator]: 'decorator',
  [SymbolKind.Import]: 'import',
  [SymbolKind.ImportFrom]: 'import',
  [SymbolKind.Module]: 'module'
};

/**
 * CodebaseIndexer - Main class for indexing directory structures
 *
 * Uses singleton pattern for consistent state management and resource sharing.
 * Leverages TreeSitterWrapper and language extractors for comprehensive code analysis.
 */
export class CodebaseIndexer {
  /** Singleton instance */
  private static instance: CodebaseIndexer | null = null;

  /** Tree-sitter wrapper for parsing */
  private wrapper: TreeSitterWrapper;

  /**
   * Private constructor - use getInstance() instead
   */
  private constructor() {
    this.wrapper = TreeSitterWrapper.getInstance();
  }

  /**
   * Get the singleton instance of CodebaseIndexer
   *
   * @returns The CodebaseIndexer singleton instance
   */
  public static getInstance(): CodebaseIndexer {
    if (!CodebaseIndexer.instance) {
      CodebaseIndexer.instance = new CodebaseIndexer();
    }
    return CodebaseIndexer.instance;
  }

  /**
   * Reset the singleton instance (primarily for testing)
   */
  public static resetInstance(): void {
    CodebaseIndexer.instance = null;
  }

  /**
   * Index a directory and return a RepositoryMap
   *
   * @param rootPath - Path to directory to index
   * @param options - Optional indexing configuration
   * @returns Promise resolving to RepositoryMap with complete code intelligence data
   */
  public async indexDirectory(
    rootPath: string,
    options: IndexingOptions = {}
  ): Promise<RepositoryMap> {
    return this.indexDirectoryWithProgress(rootPath, options);
  }

  /**
   * Index directory with progress callback for UI updates
   *
   * @param rootPath - Path to directory to index
   * @param options - Optional indexing configuration
   * @param onProgress - Optional callback for progress updates
   * @returns Promise resolving to RepositoryMap with complete code intelligence data
   */
  public async indexDirectoryWithProgress(
    rootPath: string,
    options: IndexingOptions = {},
    onProgress?: (progress: IndexingProgress) => void
  ): Promise<RepositoryMap> {
    const config = { ...DEFAULT_INDEXING_OPTIONS, ...options };
    const errors: IndexingError[] = [];
    const startTime = Date.now();

    try {
      // Ensure directory exists
      const stats = await fs.stat(rootPath);
      if (!stats.isDirectory()) {
        throw new Error(`Path is not a directory: ${rootPath}`);
      }

      // Step 1: Discover files
      const fileList = await this.discoverFiles(rootPath, config);

      if (fileList.length === 0) {
        // Return empty repository map for directories with no supported files
        return {
          rootPath: path.resolve(rootPath),
          name: path.basename(rootPath),
          files: [],
          references: [],
          stats: {
            totalFiles: 0,
            totalSymbols: 0,
            totalReferences: 0,
            totalLines: 0,
            languageBreakdown: {},
            symbolTypeBreakdown: {}
          },
          createdAt: new Date(),
          version: '1.0.0',
          config: {
            includePatterns: config.includePatterns,
            excludePatterns: config.excludePatterns,
            languages: [],
            maxFileSize: config.maxFileSize
          },
          errors: []
        };
      }

      // Step 2: Process files in parallel with concurrency control
      const codeFiles: CodeFile[] = [];
      const concurrency = Math.max(1, config.concurrency);

      for (let i = 0; i < fileList.length; i += concurrency) {
        const batch = fileList.slice(i, i + concurrency);

        const batchPromises = batch.map(async (filePath, batchIndex) => {
          const overallIndex = i + batchIndex;
          const progress: IndexingProgress = {
            currentFile: filePath,
            filesProcessed: overallIndex,
            totalFiles: fileList.length,
            errors: [...errors]
          };

          if (onProgress) {
            onProgress(progress);
          }

          try {
            return await this.processFile(filePath, rootPath, config);
          } catch (error) {
            const errorInfo: IndexingError = {
              file: filePath,
              message: error instanceof Error ? error.message : String(error),
              severity: 'error'
            };
            errors.push(errorInfo);

            if (!config.continueOnError) {
              throw error;
            }
            return null;
          }
        });

        const batchResults = await Promise.all(batchPromises);
        const validResults = batchResults.filter((result): result is CodeFile => result !== null);
        codeFiles.push(...validResults);
      }

      // Final progress update
      if (onProgress) {
        onProgress({
          currentFile: '',
          filesProcessed: fileList.length,
          totalFiles: fileList.length,
          errors
        });
      }

      // Step 3: Calculate statistics
      const stats = this.calculateStatistics(codeFiles);

      // Step 4: Build RepositoryMap
      const repositoryMap: RepositoryMap = {
        rootPath: path.resolve(rootPath),
        name: path.basename(rootPath),
        files: codeFiles,
        references: [], // TODO: Implement reference extraction in future version
        stats,
        createdAt: new Date(),
        version: '1.0.0',
        config: {
          includePatterns: config.includePatterns,
          excludePatterns: config.excludePatterns,
          languages: [...new Set(codeFiles.map(f => f.language).filter(Boolean))],
          maxFileSize: config.maxFileSize
        },
        errors
      };

      return repositoryMap;

    } catch (error) {
      throw new Error(
        `Failed to index directory ${rootPath}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Discover files to process based on supported extensions and patterns
   *
   * @private
   * @param rootPath - Root directory path
   * @param config - Indexing configuration
   * @returns List of file paths to process
   */
  private async discoverFiles(rootPath: string, config: Required<IndexingOptions>): Promise<string[]> {
    const supportedExtensions = getSupportedExtensions();

    // Create include patterns for supported extensions
    const extensionPatterns = supportedExtensions.map(ext => `**/*${ext}`);
    const includePatterns = config.includePatterns.length > 0
      ? config.includePatterns
      : extensionPatterns;

    // Find files matching patterns
    const allPatterns = includePatterns.flatMap(pattern =>
      supportedExtensions.map(ext => pattern.endsWith(ext) ? pattern : `${pattern}${ext}`)
    );

    let files: string[] = [];

    for (const pattern of allPatterns) {
      try {
        const matches = await glob(pattern, {
          cwd: rootPath,
          ignore: config.excludePatterns,
          absolute: false,
          nodir: true
        });
        files.push(...matches);
      } catch (error) {
        // Continue with other patterns if one fails
        console.warn(`Failed to process pattern ${pattern}:`, error);
      }
    }

    // Remove duplicates and convert to absolute paths
    const uniqueFiles = [...new Set(files)];
    const absolutePaths = uniqueFiles.map(file => path.resolve(rootPath, file));

    // Filter by file size if specified
    if (config.maxFileSize > 0) {
      const filteredFiles: string[] = [];

      for (const filePath of absolutePaths) {
        try {
          const stats = await fs.stat(filePath);
          if (stats.size <= config.maxFileSize) {
            filteredFiles.push(filePath);
          }
        } catch (error) {
          // Skip files that can't be stat'ed
          continue;
        }
      }

      return filteredFiles;
    }

    return absolutePaths;
  }

  /**
   * Process a single file: parse, extract symbols, and create CodeFile object
   *
   * @private
   * @param filePath - Absolute path to file
   * @param rootPath - Root directory path for relativization
   * @param config - Indexing configuration
   * @returns CodeFile object with extracted symbols and metadata
   */
  private async processFile(
    filePath: string,
    rootPath: string,
    config: Required<IndexingOptions>
  ): Promise<CodeFile> {
    const relativePath = path.relative(rootPath, filePath);
    const extension = path.extname(filePath);
    const language = getLanguageForExtension(extension);

    if (!language) {
      throw new Error(`Unsupported file extension: ${extension}`);
    }

    // Read file stats
    const fileStats = await fs.stat(filePath);

    // Read file content
    const content = await fs.readFile(filePath, 'utf-8');

    // Calculate content hash if requested
    const contentHash = config.computeHashes
      ? crypto.createHash('sha256').update(content).digest('hex')
      : undefined;

    // Count lines
    const lineCount = content.split('\n').length;

    // Initialize CodeFile structure
    const codeFile: CodeFile = {
      path: relativePath,
      language: language,
      symbols: [],
      imports: [],
      exports: [],
      lineCount,
      size: fileStats.size,
      lastModified: fileStats.mtime,
      contentHash,
      hasParseErrors: false,
      errors: []
    };

    // Skip symbol extraction if language doesn't have extractor support
    if (!hasExtractorSupport(language)) {
      return codeFile;
    }

    try {
      // Extract symbols using appropriate extractor
      const extractor = getExtractorForLanguage(language);

      const extractionOptions: ExtractionOptions = {
        includeDocumentation: config.includeDocumentation,
        includeSignatures: config.includeSignatures,
        maxDepth: config.maxSymbolDepth,
        includeImports: true // Always include imports for reference tracking
      };

      const extractionResult = await extractor.extractFromFile(filePath, extractionOptions);

      // Convert extracted symbols to CodeSymbol format
      codeFile.symbols = this.convertSymbols(extractionResult.symbols, relativePath);
      codeFile.hasParseErrors = extractionResult.hasErrors;

      // Convert parse errors
      if (extractionResult.errors.length > 0) {
        codeFile.errors = extractionResult.errors.map(error => ({
          message: error.message,
          line: error.startPosition.row + 1, // Convert to 1-based
          column: error.startPosition.column
        }));
      }

      // Enhanced TypeScript type analysis for TS/JS files
      if (config.enableTypeAnalysis && this.isTypeScriptFile(relativePath, language)) {
        try {
          const typeAnalyzer = TypeAwarenessAnalyzer.getInstance();
          const typeInfo = await typeAnalyzer.analyzeContent(
            content,
            relativePath,
            config.typeAnalysisOptions
          );

          // Enrich the CodeFile with type information
          const enrichedFile = await this.enrichFileWithTypeInfo(codeFile, typeInfo);
          return enrichedFile;

        } catch (typeError) {
          // Log type analysis error but don't fail the indexing
          console.warn(`Type analysis failed for ${relativePath}:`, typeError);

          if (codeFile.errors) {
            codeFile.errors.push({
              message: `Type analysis error: ${typeError instanceof Error ? typeError.message : String(typeError)}`
            });
          }
        }
      }

    } catch (error) {
      // Mark file as having errors but continue
      codeFile.hasParseErrors = true;
      codeFile.errors = [{
        message: error instanceof Error ? error.message : String(error)
      }];

      if (error instanceof ExtractionError && !config.continueOnError) {
        throw error;
      }
    }

    return codeFile;
  }

  /**
   * Convert ExtractedSymbol objects to CodeSymbol format
   *
   * @private
   * @param symbols - Array of extracted symbols
   * @param filePath - File path for symbol reference
   * @returns Array of CodeSymbol objects
   */
  private convertSymbols(symbols: ExtractedSymbol[], filePath: string): CodeSymbol[] {
    const convertSymbol = (symbol: ExtractedSymbol): CodeSymbol => {
      const codeSymbol: CodeSymbol = {
        name: symbol.name,
        type: SYMBOL_KIND_TO_TYPE_MAP[symbol.kind] || 'unknown',
        filePath,
        startLine: symbol.location.start.row + 1, // Convert to 1-based
        endLine: symbol.location.end.row + 1,
        startColumn: symbol.location.start.column,
        endColumn: symbol.location.end.column,
        signature: symbol.signature,
        exported: symbol.exportKind !== 'none',
        isDefault: symbol.exportKind === 'default',
        documentation: symbol.documentation,
        modifiers: symbol.modifiers
      };

      return codeSymbol;
    };

    const result: CodeSymbol[] = [];

    // Process symbols recursively (including nested children)
    const processSymbols = (symbolList: ExtractedSymbol[]) => {
      for (const symbol of symbolList) {
        result.push(convertSymbol(symbol));

        // Process children recursively
        if (symbol.children && symbol.children.length > 0) {
          processSymbols(symbol.children);
        }
      }
    };

    processSymbols(symbols);
    return result;
  }

  /**
   * Check if file should use TypeScript type analysis
   *
   * @private
   * @param filePath - File path to check
   * @param language - Language of the file
   * @returns Whether type analysis should be applied
   */
  private isTypeScriptFile(filePath: string, language: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return (
      language === 'typescript' ||
      language === 'javascript' ||
      ['.ts', '.tsx', '.d.ts', '.js', '.jsx'].includes(ext)
    );
  }

  /**
   * Enrich CodeFile with type information from TypeAwarenessAnalyzer
   *
   * @private
   * @param codeFile - Original CodeFile object
   * @param typeInfo - Type information from analyzer
   * @returns Enhanced CodeFile with type data
   */
  private async enrichFileWithTypeInfo(
    codeFile: CodeFile,
    typeInfo: TypeInformation
  ): Promise<CodeFile> {
    // Add type information to file metadata
    const enrichedMetadata = {
      ...codeFile.metadata,
      typeInfo: {
        interfaceCount: typeInfo.interfaces.length,
        typeAliasCount: typeInfo.typeAliases.length,
        genericCount: typeInfo.generics.length,
        typeImportCount: typeInfo.typeImports.length,
        typeExportCount: typeInfo.typeExports.length,
        typeDependencyCount: typeInfo.typeDependencies.length,
        interfaces: typeInfo.interfaces.map(i => i.name),
        typeAliases: typeInfo.typeAliases.map(t => t.name),
        referencedTypes: Array.from(
          new Set(
            Array.from(typeInfo.typeAnnotations.values())
              .flatMap(annotation => annotation.referencedTypes)
          )
        ),
        hasComplexTypes: typeInfo.typeAliases.some(t => t.definition.kind !== 'primitive'),
        hasGenerics: typeInfo.interfaces.some(i => i.typeParameters.length > 0) ||
                     typeInfo.typeAliases.some(t => t.typeParameters.length > 0),
        analysisErrors: typeInfo.errors
      }
    };

    // Enhance existing symbols with type annotations
    const enhancedSymbols: CodeSymbol[] = codeFile.symbols.map(symbol => {
      const typeAnnotation = typeInfo.typeAnnotations.get(symbol.name);

      return {
        ...symbol,
        typeAnnotation: typeAnnotation?.raw,
        metadata: {
          ...symbol.metadata,
          typeKind: typeAnnotation?.kind,
          referencedTypes: typeAnnotation?.referencedTypes,
          isNullable: typeAnnotation?.nullable,
          isOptional: typeAnnotation?.optional
        }
      };
    });

    // Add interfaces as symbols
    const interfaceSymbols: CodeSymbol[] = typeInfo.interfaces.map(iface => ({
      name: iface.name,
      type: 'interface',
      filePath: codeFile.path,
      startLine: iface.startLine,
      endLine: iface.endLine,
      exported: iface.exported,
      isDefault: iface.exportKind === 'default',
      documentation: iface.documentation,
      typeAnnotation: `interface ${iface.name}`,
      modifiers: iface.modifiers,
      metadata: {
        extends: iface.extends,
        propertyCount: iface.properties.length,
        typeParameterCount: iface.typeParameters.length,
        hasTypeParameters: iface.typeParameters.length > 0,
        properties: iface.properties.map(p => ({
          name: p.name,
          type: p.type.raw,
          optional: p.optional,
          readonly: p.readonly
        }))
      }
    }));

    // Add type aliases as symbols
    const typeAliasSymbols: CodeSymbol[] = typeInfo.typeAliases.map(alias => ({
      name: alias.name,
      type: 'type',
      filePath: codeFile.path,
      startLine: alias.startLine,
      endLine: alias.endLine,
      exported: alias.exported,
      isDefault: alias.exportKind === 'default',
      documentation: alias.documentation,
      typeAnnotation: `type ${alias.name} = ${alias.definition.raw}`,
      metadata: {
        definition: alias.definition.raw,
        typeKind: alias.definition.kind,
        typeParameterCount: alias.typeParameters.length,
        hasTypeParameters: alias.typeParameters.length > 0,
        referencedTypes: alias.definition.referencedTypes,
        isUnionType: alias.definition.kind === 'union',
        isIntersectionType: alias.definition.kind === 'intersection',
        isGenericType: alias.definition.kind === 'generic'
      }
    }));

    return {
      ...codeFile,
      metadata: enrichedMetadata,
      symbols: [...enhancedSymbols, ...interfaceSymbols, ...typeAliasSymbols]
    };
  }

  /**
   * Calculate statistics for the repository map
   *
   * @private
   * @param codeFiles - Array of processed CodeFile objects
   * @returns Statistics object
   */
  private calculateStatistics(codeFiles: CodeFile[]) {
    const languageBreakdown: Record<string, number> = {};
    const symbolTypeBreakdown: Record<string, number> = {};
    let totalSymbols = 0;
    let totalLines = 0;

    for (const file of codeFiles) {
      // Count files by language
      if (file.language) {
        languageBreakdown[file.language] = (languageBreakdown[file.language] || 0) + 1;
      }

      // Count symbols by type
      for (const symbol of file.symbols || []) {
        symbolTypeBreakdown[symbol.type] = (symbolTypeBreakdown[symbol.type] || 0) + 1;
        totalSymbols++;
      }

      // Sum line counts
      if (file.lineCount) {
        totalLines += file.lineCount;
      }
    }

    return {
      totalFiles: codeFiles.length,
      totalSymbols,
      totalReferences: 0, // TODO: Implement reference tracking
      totalLines,
      languageBreakdown,
      symbolTypeBreakdown
    };
  }
}

// Export convenience function for getting the singleton
export function getCodebaseIndexer(): CodebaseIndexer {
  return CodebaseIndexer.getInstance();
}