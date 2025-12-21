/**
 * JSDoc/TSDoc Detection Module
 *
 * Analyzes TypeScript/JavaScript files to identify exports that are missing
 * JSDoc/TSDoc documentation. Supports various export patterns including named
 * exports, default exports, and re-exports.
 */

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Types of exports that can be detected
 */
export type ExportKind =
  | 'function'
  | 'class'
  | 'interface'
  | 'type'
  | 'const'
  | 'let'
  | 'var'
  | 'enum'
  | 'namespace'
  | 're-export'
  | 'default'
  | 'unknown';

/**
 * Information about a detected export
 */
export interface ExportInfo {
  /** Name of the exported item (empty string for anonymous default exports) */
  name: string;
  /** Type of export */
  kind: ExportKind;
  /** Line number where the export is defined (1-indexed) */
  line: number;
  /** Column number where the export starts (1-indexed) */
  column: number;
  /** Whether this is a default export */
  isDefault: boolean;
  /** Whether this is a re-export from another module */
  isReExport: boolean;
  /** Source module for re-exports */
  sourceModule?: string;
  /** The raw export statement */
  rawStatement: string;
}

/**
 * A single JSDoc tag
 */
export interface JSDocTag {
  /** Tag name (e.g., 'param', 'returns', 'deprecated') */
  name: string;
  /** Tag value/content */
  value: string;
  /** Parameter name for @param tags */
  paramName?: string;
  /** Type annotation if present */
  type?: string;
}

/**
 * Parsed JSDoc/TSDoc comment
 */
export interface JSDocInfo {
  /** The full raw JSDoc comment */
  raw: string;
  /** The summary/description text */
  summary: string;
  /** Line where the JSDoc starts */
  startLine: number;
  /** Line where the JSDoc ends */
  endLine: number;
  /** Parsed JSDoc tags */
  tags: JSDocTag[];
  /** Whether the JSDoc has meaningful content (not just empty) */
  hasContent: boolean;
}

/**
 * Result of analyzing an export for documentation
 */
export interface ExportDocumentation {
  /** The export information */
  export: ExportInfo;
  /** Associated JSDoc comment, if present */
  jsdoc: JSDocInfo | null;
  /** Whether the export has adequate documentation */
  isDocumented: boolean;
  /** Suggestions for improving documentation */
  suggestions: string[];
}

/**
 * Configuration options for detection
 */
export interface DetectionConfig {
  /** Check for specific required tags (default: none required) */
  requiredTags?: string[];
  /** Minimum summary length to consider documented (default: 10) */
  minSummaryLength?: number;
  /** Include re-exports in analysis (default: false) */
  includeReExports?: boolean;
  /** Include private exports (underscore prefix) (default: false) */
  includePrivate?: boolean;
  /** File extensions to analyze (default: ['.ts', '.tsx', '.js', '.jsx']) */
  extensions?: string[];
}

/**
 * Result of analyzing a file
 */
export interface FileAnalysisResult {
  /** File path that was analyzed */
  filePath: string;
  /** All detected exports */
  exports: ExportInfo[];
  /** Documentation status for each export */
  documentation: ExportDocumentation[];
  /** Summary statistics */
  stats: {
    totalExports: number;
    documentedExports: number;
    undocumentedExports: number;
    coveragePercent: number;
  };
  /** Any parsing errors encountered */
  errors: string[];
}

// ============================================================================
// Regex Patterns
// ============================================================================

const PATTERNS = {
  // Named exports: export function foo, export class Bar, etc.
  namedExport: /^export\s+(async\s+)?(function|class|interface|type|const|let|var|enum|namespace)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/,

  // Default exports: export default function foo, export default class, etc.
  defaultExport: /^export\s+default\s+(async\s+)?(function|class)?\s*([a-zA-Z_$][a-zA-Z0-9_$]*)?/,

  // Re-exports: export { foo } from './module', export * from './module'
  reExport: /^export\s+(?:(\*)|{([^}]+)})\s+from\s+['"]([^'"]+)['"]/,

  // Export list: export { foo, bar as baz }
  exportList: /^export\s+{([^}]+)}/,

  // JSDoc block: /** ... */
  jsDocBlock: /\/\*\*([\s\S]*?)\*\//g,

  // JSDoc tag: @tagname content
  jsDocTag: /@(\w+)(?:\s+{([^}]*)})?(?:\s+(\w+))?(?:\s+(.*))?/,

  // Comment line inside JSDoc: * content
  jsDocLine: /^\s*\*\s?(.*)/,

  // Function with parameters for validation
  functionWithParams: /^export\s+(async\s+)?function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\([^)]*\)/,
} as const;

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Parse a JSDoc comment block into structured information
 * @param comment - The raw JSDoc comment including /** and */
 * @param startLine - Line number where the comment starts
 * @returns Parsed JSDoc information or null if invalid
 */
export function parseJSDocComment(comment: string, startLine: number): JSDocInfo | null {
  if (!comment || !comment.includes('/**')) {
    return null;
  }

  // Extract content between /** and */
  const match = comment.match(/\/\*\*([\s\S]*?)\*\//);
  if (!match) {
    return null;
  }

  const content = match[1];
  const lines = content.split('\n');

  let summary = '';
  const tags: JSDocTag[] = [];
  let currentTag: JSDocTag | null = null;
  let inSummary = true;

  for (const line of lines) {
    const cleanLine = line.replace(PATTERNS.jsDocLine, '$1').trim();

    if (!cleanLine) {
      if (inSummary && summary) {
        inSummary = false; // Empty line ends summary
      }
      continue;
    }

    // Check if this line is a JSDoc tag
    const tagMatch = cleanLine.match(PATTERNS.jsDocTag);
    if (tagMatch) {
      // Save previous tag if exists
      if (currentTag) {
        tags.push(currentTag);
      }

      const [, tagName, type, paramName, value] = tagMatch;
      currentTag = {
        name: tagName,
        value: value?.trim() || '',
        type: type?.trim() || undefined,
        paramName: paramName?.trim() || undefined,
      };
      inSummary = false;
    } else if (currentTag) {
      // Continue previous tag
      currentTag.value += (currentTag.value ? ' ' : '') + cleanLine;
    } else if (inSummary) {
      // Add to summary
      summary += (summary ? ' ' : '') + cleanLine;
    }
  }

  // Save last tag
  if (currentTag) {
    tags.push(currentTag);
  }

  const endLine = startLine + lines.length - 1;
  const hasContent = summary.length > 0 || tags.length > 0;

  return {
    raw: comment,
    summary: summary.trim(),
    startLine,
    endLine,
    tags,
    hasContent,
  };
}

/**
 * Find all exports in source code
 * @param source - The source code to analyze
 * @returns Array of export information
 */
export function findExportsInSource(source: string): ExportInfo[] {
  const lines = source.split('\n');
  const exports: ExportInfo[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lineNumber = i + 1;

    if (!line || line.startsWith('//') || line.startsWith('/*')) {
      continue;
    }

    // Check for named exports
    const namedMatch = line.match(PATTERNS.namedExport);
    if (namedMatch) {
      const [fullMatch, asyncKeyword, kind, name] = namedMatch;
      const column = lines[i].indexOf(fullMatch) + 1;

      exports.push({
        name,
        kind: mapStringToExportKind(kind),
        line: lineNumber,
        column,
        isDefault: false,
        isReExport: false,
        rawStatement: line,
      });
      continue;
    }

    // Check for default exports
    const defaultMatch = line.match(PATTERNS.defaultExport);
    if (defaultMatch) {
      const [fullMatch, asyncKeyword, kind, name] = defaultMatch;
      const column = lines[i].indexOf(fullMatch) + 1;

      exports.push({
        name: name || '',
        kind: kind ? mapStringToExportKind(kind) : 'default',
        line: lineNumber,
        column,
        isDefault: true,
        isReExport: false,
        rawStatement: line,
      });
      continue;
    }

    // Check for re-exports
    const reExportMatch = line.match(PATTERNS.reExport);
    if (reExportMatch) {
      const [fullMatch, star, namedExports, sourceModule] = reExportMatch;
      const column = lines[i].indexOf(fullMatch) + 1;

      if (star) {
        // export * from './module'
        exports.push({
          name: '*',
          kind: 're-export',
          line: lineNumber,
          column,
          isDefault: false,
          isReExport: true,
          sourceModule,
          rawStatement: line,
        });
      } else if (namedExports) {
        // export { foo, bar } from './module'
        const names = parseExportNames(namedExports);
        for (const name of names) {
          exports.push({
            name,
            kind: 're-export',
            line: lineNumber,
            column,
            isDefault: false,
            isReExport: true,
            sourceModule,
            rawStatement: line,
          });
        }
      }
      continue;
    }

    // Check for export lists
    const exportListMatch = line.match(PATTERNS.exportList);
    if (exportListMatch) {
      const [fullMatch, namedExports] = exportListMatch;
      const column = lines[i].indexOf(fullMatch) + 1;
      const names = parseExportNames(namedExports);

      for (const name of names) {
        exports.push({
          name,
          kind: 'unknown', // Can't determine type from export list alone
          line: lineNumber,
          column,
          isDefault: false,
          isReExport: false,
          rawStatement: line,
        });
      }
    }
  }

  return exports;
}

/**
 * Detect undocumented exports in source code
 * @param source - The source code to analyze
 * @param config - Configuration options
 * @returns Documentation analysis for each export
 */
export function detectUndocumentedExports(
  source: string,
  config: DetectionConfig = {}
): ExportDocumentation[] {
  const {
    requiredTags = [],
    minSummaryLength = 10,
    includeReExports = false,
    includePrivate = false,
  } = config;

  const lines = source.split('\n');
  const exports = findExportsInSource(source);

  // Find all JSDoc comments and their positions
  const jsDocMap = new Map<number, JSDocInfo>();
  let match: RegExpExecArray | null;

  while ((match = PATTERNS.jsDocBlock.exec(source)) !== null) {
    const comment = match[0];
    const beforeComment = source.substring(0, match.index);
    const startLine = beforeComment.split('\n').length;

    const jsDocInfo = parseJSDocComment(comment, startLine);
    if (jsDocInfo) {
      jsDocMap.set(jsDocInfo.endLine, jsDocInfo);
    }
  }

  const documentation: ExportDocumentation[] = [];

  for (const exportInfo of exports) {
    // Apply filters
    if (!includeReExports && exportInfo.isReExport) {
      continue;
    }
    if (!includePrivate && exportInfo.name.startsWith('_')) {
      continue;
    }

    // Look for JSDoc comment immediately before the export
    const jsDoc = jsDocMap.get(exportInfo.line - 1) || null;

    // Determine if adequately documented
    const isDocumented = evaluateDocumentation(exportInfo, jsDoc, {
      requiredTags,
      minSummaryLength,
    });

    // Generate suggestions
    const suggestions = generateSuggestions(exportInfo, jsDoc, {
      requiredTags,
      minSummaryLength,
    });

    documentation.push({
      export: exportInfo,
      jsdoc: jsDoc,
      isDocumented,
      suggestions,
    });
  }

  return documentation;
}

/**
 * Analyze a single file for JSDoc documentation
 * @param filePath - Path to the file being analyzed
 * @param source - The file's source code
 * @param config - Configuration options
 * @returns Complete analysis results
 */
export function analyzeFile(
  filePath: string,
  source: string,
  config: DetectionConfig = {}
): FileAnalysisResult {
  const errors: string[] = [];

  try {
    const documentation = detectUndocumentedExports(source, config);
    const exports = documentation.map(d => d.export);

    const documentedCount = documentation.filter(d => d.isDocumented).length;
    const totalCount = documentation.length;
    const coveragePercent = totalCount > 0 ? (documentedCount / totalCount) * 100 : 100;

    return {
      filePath,
      exports,
      documentation,
      stats: {
        totalExports: totalCount,
        documentedExports: documentedCount,
        undocumentedExports: totalCount - documentedCount,
        coveragePercent: Math.round(coveragePercent * 100) / 100,
      },
      errors,
    };
  } catch (error) {
    errors.push(`Failed to analyze file: ${error instanceof Error ? error.message : String(error)}`);

    return {
      filePath,
      exports: [],
      documentation: [],
      stats: {
        totalExports: 0,
        documentedExports: 0,
        undocumentedExports: 0,
        coveragePercent: 0,
      },
      errors,
    };
  }
}

/**
 * Analyze multiple files for JSDoc documentation
 * @param files - Array of files to analyze
 * @param config - Configuration options
 * @returns Analysis results for all files
 */
export function analyzeFiles(
  files: Array<{ path: string; content: string }>,
  config: DetectionConfig = {}
): FileAnalysisResult[] {
  const {
    extensions = ['.ts', '.tsx', '.js', '.jsx'],
  } = config;

  return files
    .filter(file => {
      const hasValidExtension = extensions.some(ext => file.path.endsWith(ext));
      return hasValidExtension;
    })
    .map(file => analyzeFile(file.path, file.content, config));
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Map string export kind to ExportKind enum
 */
function mapStringToExportKind(kind: string): ExportKind {
  switch (kind.toLowerCase()) {
    case 'function':
      return 'function';
    case 'class':
      return 'class';
    case 'interface':
      return 'interface';
    case 'type':
      return 'type';
    case 'const':
      return 'const';
    case 'let':
      return 'let';
    case 'var':
      return 'var';
    case 'enum':
      return 'enum';
    case 'namespace':
      return 'namespace';
    default:
      return 'unknown';
  }
}

/**
 * Parse export names from export list (handles aliases)
 */
function parseExportNames(exportList: string): string[] {
  const names: string[] = [];
  const exports = exportList.split(',');

  for (const exp of exports) {
    const trimmed = exp.trim();
    // Handle "foo as bar" -> use "bar"
    const asMatch = trimmed.match(/(.+)\s+as\s+(.+)/);
    if (asMatch) {
      names.push(asMatch[2].trim());
    } else {
      names.push(trimmed);
    }
  }

  return names.filter(name => name.length > 0);
}

/**
 * Evaluate if an export is adequately documented
 */
function evaluateDocumentation(
  exportInfo: ExportInfo,
  jsDoc: JSDocInfo | null,
  criteria: { requiredTags: string[]; minSummaryLength: number }
): boolean {
  // No JSDoc found
  if (!jsDoc || !jsDoc.hasContent) {
    return false;
  }

  // Check summary length
  if (jsDoc.summary.length < criteria.minSummaryLength) {
    return false;
  }

  // Check required tags
  const tagNames = jsDoc.tags.map(tag => tag.name);
  for (const requiredTag of criteria.requiredTags) {
    if (!tagNames.includes(requiredTag)) {
      return false;
    }
  }

  // Additional validation for functions
  if (exportInfo.kind === 'function' && exportInfo.rawStatement.includes('(')) {
    // Check if function has parameters but no @param tags
    const hasParams = exportInfo.rawStatement.match(/\([^)]*\w/); // Has non-empty params
    const hasParamTags = jsDoc.tags.some(tag => tag.name === 'param');

    if (hasParams && !hasParamTags) {
      return false;
    }
  }

  return true;
}

/**
 * Generate documentation suggestions for an export
 */
function generateSuggestions(
  exportInfo: ExportInfo,
  jsDoc: JSDocInfo | null,
  criteria: { requiredTags: string[]; minSummaryLength: number }
): string[] {
  const suggestions: string[] = [];

  if (!jsDoc) {
    suggestions.push(`Add JSDoc comment above the ${exportInfo.kind} declaration`);
    return suggestions;
  }

  if (!jsDoc.hasContent) {
    suggestions.push('Add meaningful content to the JSDoc comment');
    return suggestions;
  }

  if (jsDoc.summary.length < criteria.minSummaryLength) {
    suggestions.push(`Expand the description (current: ${jsDoc.summary.length} chars, minimum: ${criteria.minSummaryLength})`);
  }

  // Check for missing required tags
  const tagNames = jsDoc.tags.map(tag => tag.name);
  for (const requiredTag of criteria.requiredTags) {
    if (!tagNames.includes(requiredTag)) {
      suggestions.push(`Add @${requiredTag} tag`);
    }
  }

  // Function-specific suggestions
  if (exportInfo.kind === 'function') {
    const hasParams = exportInfo.rawStatement.match(/\([^)]*\w/);
    const hasParamTags = jsDoc.tags.some(tag => tag.name === 'param');
    const hasReturnTag = jsDoc.tags.some(tag => tag.name === 'returns' || tag.name === 'return');

    if (hasParams && !hasParamTags) {
      suggestions.push('Document function parameters with @param tags');
    }

    if (!hasReturnTag && !exportInfo.rawStatement.includes('void')) {
      suggestions.push('Document return value with @returns tag');
    }
  }

  // Class-specific suggestions
  if (exportInfo.kind === 'class') {
    const hasConstructorDocs = jsDoc.tags.some(tag => tag.name === 'constructor');
    if (!hasConstructorDocs && exportInfo.rawStatement.includes('constructor')) {
      suggestions.push('Consider documenting constructor parameters');
    }
  }

  return suggestions;
}