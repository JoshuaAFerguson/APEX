/**
 * Import Auto-Fixer Types and Interfaces
 *
 * This module defines all TypeScript interfaces, types, and constants
 * used by the ImportAutoFixer service and its components.
 *
 * @module orchestrator/import-auto-fixer/types
 */

import { EventEmitter } from 'eventemitter3';

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Detector type options
 * - 'eslint': Use ESLint rules for detection (recommended for most cases)
 * - 'typescript': Use TypeScript compiler API (more accurate but slower)
 * - 'auto': Automatically select based on project configuration
 */
export type DetectorType = 'eslint' | 'typescript' | 'auto';

/**
 * Import style preferences
 * - 'named': Prefer named imports `import { foo } from 'bar'`
 * - 'default': Prefer default imports `import foo from 'bar'`
 * - 'namespace': Prefer namespace imports `import * as foo from 'bar'`
 * - 'auto': Automatically determine based on export type
 */
export type ImportStyle = 'named' | 'default' | 'namespace' | 'auto';

/**
 * Quote style for import statements
 */
export type QuoteStyle = 'single' | 'double' | 'auto';

/**
 * Import type classification
 */
export type ImportType = 'named' | 'default' | 'namespace' | 'side-effect';

/**
 * Local resolver configuration
 */
export interface LocalResolverConfig {
  /** Whether local resolution is enabled */
  enabled: boolean;
  /** Additional paths to search for local modules */
  searchPaths: string[];
  /** Glob patterns to exclude from search */
  excludePatterns: string[];
}

/**
 * Alias resolver configuration
 */
export interface AliasResolverConfig {
  /** Whether alias resolution is enabled */
  enabled: boolean;
  /** Custom path mappings (overrides tsconfig paths) */
  customMappings?: Record<string, string[]>;
}

/**
 * Package resolver configuration
 */
export interface PackageResolverConfig {
  /** Whether package resolution is enabled */
  enabled: boolean;
  /** Preferred package mappings for common identifiers */
  preferredPackages: Record<string, string>;
  /** Packages to never suggest */
  excludePackages: string[];
}

/**
 * Resolver configuration group
 */
export interface ResolversConfig {
  local: LocalResolverConfig;
  alias: AliasResolverConfig;
  package: PackageResolverConfig;
}

/**
 * Import style configuration
 */
export interface StyleConfig {
  /** Preferred import style */
  preferredImportStyle: ImportStyle;
  /** Use `import type` for type-only imports (TypeScript) */
  useTypeImports: boolean;
  /** Organize imports after fixing (sort and group) */
  organizeImports: boolean;
  /** Match existing import style in the file */
  respectExistingStyle: boolean;
  /** Quote style for import paths */
  quoteStyle: QuoteStyle;
  /** Include semicolons at end of import statements */
  semicolons: boolean;
}

/**
 * Behavior configuration
 */
export interface BehaviorConfig {
  /** Dry run mode - analyze but don't modify files */
  dryRun: boolean;
  /** Interactive mode - prompt for ambiguous resolutions */
  interactive: boolean;
  /** Auto-install missing packages via npm/yarn/pnpm */
  autoInstallPackages: boolean;
  /** Maximum number of suggestions per missing import */
  maxSuggestionsPerImport: number;
}

/**
 * Complete ImportAutoFixer configuration
 */
export interface ImportAutoFixerConfig {
  /** Detection method to use */
  detector: DetectorType;
  /** Resolver configurations */
  resolvers: ResolversConfig;
  /** Import style preferences */
  style: StyleConfig;
  /** Behavior settings */
  behavior: BehaviorConfig;
}

/**
 * Options for creating an ImportAutoFixer instance
 */
export interface ImportAutoFixerOptions {
  /** Root project path */
  projectPath: string;
  /** Detection method (default: 'auto') */
  detector?: DetectorType;
  /** Custom resolver configuration */
  resolvers?: Partial<ResolversConfig>;
  /** Dry run mode */
  dryRun?: boolean;
  /** Preferred import style */
  preferredImportStyle?: ImportStyle;
  /** Organize imports after fixing */
  organizeImports?: boolean;
  /** Respect existing import style in files */
  respectExistingStyle?: boolean;
}

// ============================================================================
// Detection Types
// ============================================================================

/**
 * A missing import detected in a source file
 */
export interface MissingImport {
  /** The identifier/symbol that is missing */
  identifier: string;
  /** Line number where the identifier is used (1-based) */
  line: number;
  /** Column number where the identifier is used (1-based) */
  column: number;
  /** End line number (if available) */
  endLine?: number;
  /** End column number (if available) */
  endColumn?: number;
  /** Usage context that may help with resolution */
  context?: ImportContext;
  /** Potential import sources suggested by the detector */
  suggestedSources?: string[];
  /** Whether this is a type-only usage (TypeScript) */
  isTypeOnly?: boolean;
}

/**
 * Context about how an identifier is used
 */
export interface ImportContext {
  /** Type of usage */
  usageType: 'value' | 'type' | 'jsx' | 'decorator' | 'unknown';
  /** Is it called as a function? */
  isFunctionCall?: boolean;
  /** Is it used as a constructor? */
  isConstructor?: boolean;
  /** Is it accessed as a property of something? */
  isPropertyAccess?: boolean;
  /** Parent identifier if this is a property access */
  parentIdentifier?: string;
  /** Code snippet around the usage */
  codeSnippet?: string;
}

/**
 * Analysis result for a single file
 */
export interface MissingImportAnalysis {
  /** File path that was analyzed */
  filePath: string;
  /** Missing imports detected */
  missingImports: MissingImport[];
  /** Any errors during analysis */
  errors: DetectionError[];
  /** Duration of analysis in milliseconds */
  duration: number;
}

/**
 * Error during import detection
 */
export interface DetectionError {
  /** Error type */
  type: 'parse' | 'lint' | 'io' | 'unknown';
  /** Error message */
  message: string;
  /** Line number if applicable */
  line?: number;
  /** Column number if applicable */
  column?: number;
}

// ============================================================================
// Resolution Types
// ============================================================================

/**
 * Context provided to resolvers
 */
export interface ResolverContext {
  /** Path of the file being fixed */
  filePath: string;
  /** Project root path */
  projectPath: string;
  /** TypeScript configuration (if available) */
  tsConfig?: TsConfigInfo;
  /** Package.json information (if available) */
  packageJson?: PackageJsonInfo;
  /** Existing imports in the file */
  existingImports: ExistingImport[];
  /** The missing import being resolved */
  missingImport: MissingImport;
}

/**
 * TypeScript configuration information
 */
export interface TsConfigInfo {
  /** tsconfig.json path */
  configPath: string;
  /** Compiler options */
  compilerOptions?: {
    baseUrl?: string;
    paths?: Record<string, string[]>;
    moduleResolution?: string;
    esModuleInterop?: boolean;
  };
}

/**
 * Package.json information
 */
export interface PackageJsonInfo {
  /** package.json path */
  packagePath: string;
  /** Package name */
  name?: string;
  /** Direct dependencies */
  dependencies: Record<string, string>;
  /** Dev dependencies */
  devDependencies: Record<string, string>;
  /** Peer dependencies */
  peerDependencies?: Record<string, string>;
}

/**
 * An existing import in a file
 */
export interface ExistingImport {
  /** Import source/path */
  source: string;
  /** Named imports */
  namedImports?: string[];
  /** Default import name */
  defaultImport?: string;
  /** Namespace import name */
  namespaceImport?: string;
  /** Is it a type-only import? */
  isTypeOnly?: boolean;
  /** Line number of the import */
  line: number;
}

/**
 * Resolution result from a resolver
 */
export interface ImportResolution {
  /** Import source path */
  source: string;
  /** Type of import to use */
  importType: ImportType;
  /** Whether to use type-only import */
  isTypeOnly: boolean;
  /** Confidence score (0-1) */
  confidence: number;
  /** Resolver that produced this resolution */
  resolvedBy: string;
  /** Alternative specifier name (if different from identifier) */
  aliasAs?: string;
}

// ============================================================================
// Fix Result Types
// ============================================================================

/**
 * An import that was added to a file
 */
export interface AddedImport {
  /** Import specifier (e.g., "React", "{ useState }") */
  specifier: string;
  /** Import source (e.g., "react", "./utils") */
  source: string;
  /** Type of import */
  importType: ImportType;
  /** Line number where import was added */
  line: number;
  /** Whether it's a type-only import */
  isTypeOnly?: boolean;
  /** Original identifier that triggered this import */
  originalIdentifier: string;
}

/**
 * Error during import fix operation
 */
export interface ImportFixError {
  /** Error category */
  type: 'detection' | 'resolution' | 'application' | 'io';
  /** The identifier that failed (if applicable) */
  identifier?: string;
  /** Error message */
  message: string;
  /** Whether the error is recoverable */
  recoverable: boolean;
  /** Suggestion for fixing the error */
  suggestion?: string;
}

/**
 * Result of fixing imports in a single file
 */
export interface ImportFixResult {
  /** Whether the fix operation succeeded */
  success: boolean;
  /** Path of the file that was processed */
  filePath: string;
  /** Imports that were added */
  importsAdded: AddedImport[];
  /** Errors encountered during fixing */
  errors: ImportFixError[];
  /** Modified file content (if dryRun or for preview) */
  modifiedContent?: string;
  /** Duration of the fix operation in milliseconds */
  duration: number;
}

/**
 * Summary statistics for a batch fix operation
 */
export interface ImportFixSummary {
  /** Total files processed */
  filesProcessed: number;
  /** Files that were modified */
  filesModified: number;
  /** Total imports added across all files */
  totalImportsAdded: number;
  /** Total errors across all files */
  totalErrors: number;
  /** Total duration in milliseconds */
  totalDuration: number;
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * Events emitted by ImportAutoFixer
 */
export interface ImportAutoFixerEvents {
  /** Emitted when analysis starts */
  'analysis:started': (event: AnalysisStartedEvent) => void;
  /** Emitted when analysis completes */
  'analysis:completed': (event: AnalysisCompletedEvent) => void;
  /** Emitted when a file fix starts */
  'fix:started': (event: FixStartedEvent) => void;
  /** Emitted when an import is added */
  'fix:import-added': (event: ImportAddedEvent) => void;
  /** Emitted when a file fix completes */
  'fix:completed': (event: FixCompletedEvent) => void;
  /** Emitted when an error occurs during fixing */
  'fix:error': (event: FixErrorEvent) => void;
  /** Emitted when resolution is ambiguous */
  'resolution:ambiguous': (event: AmbiguousResolutionEvent) => void;
}

export interface AnalysisStartedEvent {
  files: string[];
  timestamp: Date;
}

export interface AnalysisCompletedEvent {
  results: MissingImportAnalysis[];
  timestamp: Date;
}

export interface FixStartedEvent {
  filePath: string;
  missingImports: number;
  timestamp: Date;
}

export interface ImportAddedEvent {
  filePath: string;
  import: AddedImport;
  timestamp: Date;
}

export interface FixCompletedEvent {
  result: ImportFixResult;
  timestamp: Date;
}

export interface FixErrorEvent {
  filePath: string;
  error: ImportFixError;
  timestamp: Date;
}

export interface AmbiguousResolutionEvent {
  identifier: string;
  filePath: string;
  options: ImportResolution[];
  timestamp: Date;
}

// ============================================================================
// Detector Interface
// ============================================================================

/**
 * Interface for import detection strategies
 */
export interface IImportDetector {
  /** Unique identifier for the detector */
  readonly id: string;
  /** Human-readable name */
  readonly name: string;

  /**
   * Detect missing imports in a file
   * @param filePath - Path to the file
   * @param content - File content
   * @returns Array of missing imports
   */
  detect(filePath: string, content: string): Promise<MissingImport[]>;

  /**
   * Check if the detector is available (dependencies installed)
   */
  isAvailable(): Promise<boolean>;
}

// ============================================================================
// Resolver Interface
// ============================================================================

/**
 * Interface for import resolution strategies
 */
export interface IImportResolver {
  /** Unique identifier for the resolver */
  readonly id: string;
  /** Priority order (lower = higher priority) */
  readonly priority: number;

  /**
   * Check if this resolver can potentially resolve the identifier
   * @param identifier - The missing identifier
   * @param context - Resolution context
   */
  canResolve(identifier: string, context: ResolverContext): Promise<boolean>;

  /**
   * Attempt to resolve the import source for an identifier
   * @param identifier - The missing identifier
   * @param context - Resolution context
   * @returns Resolution result or null if not resolved
   */
  resolve(identifier: string, context: ResolverContext): Promise<ImportResolution | null>;
}

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: ImportAutoFixerConfig = {
  detector: 'auto',
  resolvers: {
    local: {
      enabled: true,
      searchPaths: ['src', 'lib'],
      excludePatterns: ['**/node_modules/**', '**/*.test.*', '**/*.spec.*'],
    },
    alias: {
      enabled: true,
    },
    package: {
      enabled: true,
      preferredPackages: {
        // React ecosystem
        React: 'react',
        useState: 'react',
        useEffect: 'react',
        useCallback: 'react',
        useMemo: 'react',
        useRef: 'react',
        useContext: 'react',
        useReducer: 'react',
        ReactDOM: 'react-dom',
        // Node.js built-ins
        path: 'path',
        fs: 'fs',
        util: 'util',
        os: 'os',
        crypto: 'crypto',
        http: 'http',
        https: 'https',
        // Common libraries
        lodash: 'lodash',
        _: 'lodash',
        axios: 'axios',
        moment: 'moment',
        dayjs: 'dayjs',
      },
      excludePackages: [],
    },
  },
  style: {
    preferredImportStyle: 'auto',
    useTypeImports: true,
    organizeImports: true,
    respectExistingStyle: true,
    quoteStyle: 'single',
    semicolons: true,
  },
  behavior: {
    dryRun: false,
    interactive: false,
    autoInstallPackages: false,
    maxSuggestionsPerImport: 5,
  },
};
