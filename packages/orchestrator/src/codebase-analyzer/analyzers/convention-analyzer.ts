/**
 * Convention Analyzer - Coding Patterns and Style Analysis
 *
 * Analyzes coding conventions across a codebase including:
 * - File and identifier naming conventions
 * - Indentation patterns (tabs vs spaces, size)
 * - Import/export styles
 * - Documentation patterns and coverage
 * - Code formatting conventions
 *
 * Returns structured ConventionAnalysis data validated against schema.
 */

import { promises as fs } from 'fs';
import { join, extname, basename, dirname } from 'path';
import type { ConventionAnalysis } from '@apexcli/core';
import type { CodebaseAnalyzer } from '../types.js';

/**
 * File extension patterns for different programming languages
 */
const ANALYZABLE_EXTENSIONS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.vue',
  '.py', '.rb', '.go', '.rs', '.java', '.kt',
  '.php', '.cs', '.cpp', '.c', '.h', '.hpp',
  '.swift', '.m', '.scala', '.clj', '.dart',
  '.html', '.css', '.scss', '.sass', '.less',
  '.json', '.yaml', '.yml', '.toml', '.xml'
]);

/**
 * Naming convention patterns
 */
const NAMING_PATTERNS = {
  camelCase: /^[a-z][a-zA-Z0-9]*$/,
  PascalCase: /^[A-Z][a-zA-Z0-9]*$/,
  kebabCase: /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/,
  snakeCase: /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/,
  // Enhanced SCREAMING_SNAKE_CASE pattern - allows single uppercase words too
  screamingSnakeCase: /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/
};

/**
 * Code pattern matchers for different conventions
 */
const CODE_PATTERNS = {
  // Function declarations - improved to catch more patterns
  functionDeclaration: /(?:export\s+)?(?:function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)|(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:async\s+)?(?:function|\([^)]*\)\s*=>))/g,

  // Variable declarations - separate from function assignments
  variableDeclaration: /(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?!(?:async\s+)?(?:function|\([^)]*\)\s*=>))/g,

  // Class declarations
  classDeclaration: /(?:export\s+)?class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g,

  // Import statements
  importStatement: /import\s+(?:(?:(?:\{[^}]*\}|[^,\{]+)\s*,?\s*)*)\s*from\s+(['"`])([^'"`]+)\1/g,
  requireStatement: /(?:const|let|var)\s+.*?\s*=\s*require\s*\(\s*(['"`])([^'"`]+)\1\s*\)/g,

  // AMD pattern detection
  amdDefine: /define\s*\(\s*(?:\[([^\]]*)\]\s*,\s*)?(?:function|\([^)]*\))/g,

  // UMD pattern detection (typical UMD wrapper patterns)
  umdPattern: /\(\s*function\s*\(\s*root\s*,\s*factory\s*\)|typeof\s+exports\s*===\s*['"']object['"']\s*&&\s*typeof\s+module|typeof\s+define\s*===\s*['"']function['"']\s*&&\s*define\.amd/g,

  // TypeScript type import patterns
  typeImportStatement: /import\s+type\s+[^from]*from\s+(['"`])([^'"`]+)\1/g,
  typeInImportStatement: /import\s+\{[^}]*type\s+[^}]*\}\s*from\s+(['"`])([^'"`]+)\1/g,

  // Documentation patterns
  jsdocComment: /\/\*\*[\s\S]*?\*\//g,
  tsdocComment: /\/\*\*[\s\S]*?@(?:param|returns?|throws?|example|since|deprecated|beta|alpha|public|private|internal|readonly|override|virtual|sealed|see|remarks|defaultValue)[\s\S]*?\*\//g,
  inlineComment: /\/\/.*$/gm,
  markdownComment: /\/\*[\s\S]*?(?:\n\s*\*\s*#+|\n\s*\*\s*\[.*?\]\(.*?\)|\n\s*\*\s*```[\s\S]*?```)[\s\S]*?\*\//g,

  // Indentation detection
  indentationLine: /^(\s+)\S/gm
};

export class ConventionAnalyzer implements CodebaseAnalyzer<ConventionAnalysis> {
  /**
   * Analyze coding conventions in a codebase
   */
  async analyze(projectPath: string): Promise<ConventionAnalysis> {
    try {
      // Find all analyzable files in the project
      const files = await this.findAnalyzableFiles(projectPath);

      if (files.length === 0) {
        // Return default conventions for empty projects
        return this.createDefaultAnalysis();
      }

      // Read and analyze all files
      const fileContents = await this.readFiles(files);

      // Analyze different convention aspects
      const fileNaming = this.analyzeFileNaming(files);
      const functionNaming = this.analyzeFunctionNaming(fileContents);
      const variableNaming = this.analyzeVariableNaming(fileContents);
      const classNaming = this.analyzeClassNaming(fileContents);
      const constantNaming = this.analyzeConstantNaming(fileContents);
      const indentation = this.analyzeIndentation(fileContents);
      const imports = this.analyzeImportStyle(fileContents);
      const documentation = this.analyzeDocumentation(fileContents);
      const formatting = this.analyzeFormatting(fileContents);
      const organization = this.analyzeOrganizationPatterns(projectPath, files);

      return {
        fileNaming,
        functionNaming,
        variableNaming,
        classNaming,
        constantNaming,
        indentation,
        imports,
        documentation,
        formatting,
        organization
      };
    } catch (error) {
      throw new Error(`Convention analysis failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Find all analyzable files in the project directory
   */
  private async findAnalyzableFiles(projectPath: string): Promise<string[]> {
    const files: string[] = [];

    try {
      const stats = await fs.stat(projectPath);
      if (!stats.isDirectory()) {
        throw new Error(`Project path is not a directory: ${projectPath}`);
      }

      await this.walkDirectory(projectPath, files);
      return files.filter(file => ANALYZABLE_EXTENSIONS.has(extname(file).toLowerCase()));
    } catch (error) {
      throw new Error(`Failed to scan project directory: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Recursively walk directory tree to find files
   */
  private async walkDirectory(dirPath: string, files: string[]): Promise<void> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dirPath, entry.name);

        // Skip common directories that shouldn't be analyzed
        if (entry.isDirectory()) {
          const skipDirs = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.nuxt', 'target']);
          if (!skipDirs.has(entry.name)) {
            await this.walkDirectory(fullPath, files);
          }
        } else if (entry.isFile()) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Skip directories that can't be read (permissions, etc.)
      console.warn(`Skipping directory ${dirPath}: ${error}`);
    }
  }

  /**
   * Read contents of all files
   */
  private async readFiles(filePaths: string[]): Promise<Array<{ path: string; content: string }>> {
    const results = await Promise.allSettled(
      filePaths.map(async (path) => ({
        path,
        content: await fs.readFile(path, 'utf-8')
      }))
    );

    return results
      .filter((result): result is PromiseFulfilledResult<{ path: string; content: string }> =>
        result.status === 'fulfilled'
      )
      .map(result => result.value);
  }

  /**
   * Analyze file naming conventions
   */
  private analyzeFileNaming(files: string[]): ConventionAnalysis['fileNaming'] {
    const fileNames = files.map(file => {
      const name = basename(file, extname(file));
      // Remove directory prefixes and focus on the actual filename
      return name;
    }).filter(name => name.length > 0);

    if (fileNames.length === 0) return 'mixed';

    const counts = {
      camelCase: 0,
      PascalCase: 0,
      'kebab-case': 0,
      snake_case: 0,
      other: 0
    };

    fileNames.forEach(name => {
      if (NAMING_PATTERNS.camelCase.test(name)) {
        counts.camelCase++;
      } else if (NAMING_PATTERNS.PascalCase.test(name)) {
        counts.PascalCase++;
      } else if (NAMING_PATTERNS.kebabCase.test(name)) {
        counts['kebab-case']++;
      } else if (NAMING_PATTERNS.snakeCase.test(name)) {
        counts.snake_case++;
      } else {
        counts.other++;
      }
    });

    return this.determineDominantNaming(counts);
  }

  /**
   * Analyze function naming conventions
   */
  private analyzeFunctionNaming(files: Array<{ path: string; content: string }>): ConventionAnalysis['functionNaming'] {
    const functionNames: string[] = [];

    files.forEach(file => {
      const matches = [...file.content.matchAll(CODE_PATTERNS.functionDeclaration)];
      matches.forEach(match => {
        // Handle both capture groups from the improved regex
        const functionName = match[1] || match[2];
        if (functionName) {
          functionNames.push(functionName);
        }
      });
    });

    if (functionNames.length === 0) return 'mixed';

    const counts = {
      camelCase: 0,
      PascalCase: 0,
      snake_case: 0,
      other: 0
    };

    functionNames.forEach(name => {
      if (NAMING_PATTERNS.camelCase.test(name)) {
        counts.camelCase++;
      } else if (NAMING_PATTERNS.PascalCase.test(name)) {
        counts.PascalCase++;
      } else if (NAMING_PATTERNS.snakeCase.test(name)) {
        counts.snake_case++;
      } else {
        counts.other++;
      }
    });

    return this.determineDominantFunctionNaming(counts);
  }

  /**
   * Analyze variable naming conventions
   */
  private analyzeVariableNaming(files: Array<{ path: string; content: string }>): ConventionAnalysis['variableNaming'] {
    const variableNames: string[] = [];

    files.forEach(file => {
      // Match all variable declarations (const, let, var)
      const allVariableMatches = [...file.content.matchAll(/(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=/g)];
      allVariableMatches.forEach(match => {
        if (match[1]) {
          const name = match[1];
          // Exclude constants from variable analysis - they're handled separately
          if (!this.isLikelyConstant(name)) {
            variableNames.push(name);
          }
        }
      });
    });

    if (variableNames.length === 0) return 'mixed';

    const counts = {
      camelCase: 0,
      PascalCase: 0,
      snake_case: 0,
      SCREAMING_SNAKE_CASE: 0,
      other: 0
    };

    variableNames.forEach(name => {
      if (NAMING_PATTERNS.screamingSnakeCase.test(name)) {
        counts.SCREAMING_SNAKE_CASE++;
      } else if (NAMING_PATTERNS.camelCase.test(name)) {
        counts.camelCase++;
      } else if (NAMING_PATTERNS.PascalCase.test(name)) {
        counts.PascalCase++;
      } else if (NAMING_PATTERNS.snakeCase.test(name)) {
        counts.snake_case++;
      } else {
        counts.other++;
      }
    });

    return this.determineDominantVariableNaming(counts);
  }

  /**
   * Analyze class naming conventions
   */
  private analyzeClassNaming(files: Array<{ path: string; content: string }>): ConventionAnalysis['classNaming'] {
    const classNames: string[] = [];

    files.forEach(file => {
      const matches = [...file.content.matchAll(CODE_PATTERNS.classDeclaration)];
      matches.forEach(match => {
        if (match[1]) classNames.push(match[1]);
      });
    });

    if (classNames.length === 0) return undefined;

    const counts = {
      PascalCase: 0,
      camelCase: 0,
      snake_case: 0,
      other: 0
    };

    classNames.forEach(name => {
      if (NAMING_PATTERNS.PascalCase.test(name)) {
        counts.PascalCase++;
      } else if (NAMING_PATTERNS.camelCase.test(name)) {
        counts.camelCase++;
      } else if (NAMING_PATTERNS.snakeCase.test(name)) {
        counts.snake_case++;
      } else {
        counts.other++;
      }
    });

    return this.determineDominantClassNaming(counts);
  }

  /**
   * Analyze constant naming conventions
   */
  private analyzeConstantNaming(files: Array<{ path: string; content: string }>): ConventionAnalysis['constantNaming'] {
    // Look for const declarations that appear to be constants based on naming or context
    const constantNames: string[] = [];

    files.forEach(file => {
      // Match const declarations and analyze which ones are likely constants
      const constMatches = [...file.content.matchAll(/const\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=/g)];
      constMatches.forEach(match => {
        if (match[1]) {
          const name = match[1];
          // Consider it a constant if it's all caps, or starts with uppercase followed by underscore
          // or appears to be a constant based on common patterns
          if (this.isLikelyConstant(name)) {
            constantNames.push(name);
          }
        }
      });
    });

    if (constantNames.length === 0) return undefined;

    const counts = {
      SCREAMING_SNAKE_CASE: 0,
      camelCase: 0,
      PascalCase: 0,
      other: 0
    };

    constantNames.forEach(name => {
      if (NAMING_PATTERNS.screamingSnakeCase.test(name)) {
        counts.SCREAMING_SNAKE_CASE++;
      } else if (NAMING_PATTERNS.camelCase.test(name)) {
        counts.camelCase++;
      } else if (NAMING_PATTERNS.PascalCase.test(name)) {
        counts.PascalCase++;
      } else {
        counts.other++;
      }
    });

    return this.determineDominantConstantNaming(counts);
  }

  /**
   * Determine if a const declaration name is likely a constant
   */
  private isLikelyConstant(name: string): boolean {
    // SCREAMING_SNAKE_CASE or single uppercase word
    if (/^[A-Z][A-Z0-9_]*$/.test(name)) return true;

    // Common constant prefixes
    if (/^(MAX|MIN|DEFAULT|API|URL|KEY|SECRET|CONFIG|TIMEOUT|LIMIT|SIZE)/.test(name)) return true;

    // Less likely constants (but still possible): camelCase/PascalCase that look like config
    if (/^(max|min|default|api|url|key|secret|config|timeout|limit|size)[A-Z]/.test(name)) return true;

    return false;
  }

  /**
   * Analyze indentation patterns with improved detection algorithm
   */
  private analyzeIndentation(files: Array<{ path: string; content: string }>): ConventionAnalysis['indentation'] {
    interface IndentationSample {
      indent: string;
      type: 'spaces' | 'tabs';
      size: number;
      file: string;
      line: number;
    }

    const indentSamples: IndentationSample[] = [];

    // Extract indentation samples from all files
    files.forEach(file => {
      const samples = this.detectIndentationFromContent(file.content, file.path);
      indentSamples.push(...samples);
    });

    if (indentSamples.length === 0) {
      return { type: 'spaces', size: 2 };
    }

    return this.aggregateIndentationSamples(indentSamples);
  }

  /**
   * Detect indentation from file content using improved algorithm
   */
  private detectIndentationFromContent(content: string, filePath: string): Array<{ indent: string; type: 'spaces' | 'tabs'; size: number; file: string; line: number }> {
    const lines = content.split('\n');
    const samples: Array<{ indent: string; type: 'spaces' | 'tabs'; size: number; file: string; line: number }> = [];
    let previousIndentLevel = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Skip empty lines and comment-only lines
      if (this.isEmptyOrCommentLine(line)) continue;

      // Extract leading whitespace
      const match = line.match(/^(\s+)/);
      if (!match) {
        previousIndentLevel = 0;
        continue;
      }

      const indent = match[1];
      const currentIndentLevel = indent.length;

      // Only sample when indent level increases (indicates one indent unit)
      if (currentIndentLevel > previousIndentLevel) {
        const indentDiff = currentIndentLevel - previousIndentLevel;
        const indentUnit = indent.slice(previousIndentLevel, previousIndentLevel + indentDiff);

        // Determine if this unit is tabs or spaces
        const type = indentUnit.includes('\t') ? 'tabs' : 'spaces';

        samples.push({
          indent: indentUnit,
          type,
          size: type === 'tabs' ? 1 : indentUnit.length,
          file: filePath,
          line: i + 1,
        });
      }

      previousIndentLevel = currentIndentLevel;
    }

    return samples;
  }

  /**
   * Check if line is empty or only contains comments
   */
  private isEmptyOrCommentLine(line: string): boolean {
    const trimmed = line.trim();
    return !trimmed ||
           trimmed.startsWith('//') ||
           trimmed.startsWith('/*') ||
           trimmed.startsWith('*') ||
           trimmed.startsWith('#');
  }

  /**
   * Aggregate indentation samples into final analysis
   */
  private aggregateIndentationSamples(samples: Array<{ indent: string; type: 'spaces' | 'tabs'; size: number; file: string; line: number }>): ConventionAnalysis['indentation'] {
    // Count by type
    const tabCount = samples.filter(s => s.type === 'tabs').length;
    const spaceCount = samples.filter(s => s.type === 'spaces').length;
    const total = samples.length;

    // Determine dominant type
    const tabRatio = tabCount / total;
    let type: 'spaces' | 'tabs' | 'mixed';

    if (tabRatio > 0.8) {
      type = 'tabs';
    } else if (tabRatio < 0.2) {
      type = 'spaces';
    } else {
      type = 'mixed';
    }

    // Calculate size for spaces (mode of sizes)
    let size: number | undefined;
    if (type === 'spaces' || type === 'mixed') {
      const spaceSamples = samples.filter(s => s.type === 'spaces');
      if (spaceSamples.length > 0) {
        const sizeCounts = new Map<number, number>();
        for (const sample of spaceSamples) {
          sizeCounts.set(sample.size, (sizeCounts.get(sample.size) || 0) + 1);
        }

        // Find mode (most common size)
        let maxCount = 0;
        for (const [sz, count] of sizeCounts) {
          if (count > maxCount) {
            maxCount = count;
            size = sz;
          }
        }
      }
    }

    // For tabs, size is typically not relevant, but some systems use it
    if (type === 'tabs' && !size) {
      size = 1;
    }

    return { type, size };
  }

  /**
   * Analyze import/export style patterns
   */
  private analyzeImportStyle(files: Array<{ path: string; content: string }>): ConventionAnalysis['imports'] {
    let es6Count = 0;
    let commonjsCount = 0;
    let amdCount = 0;
    let umdCount = 0;
    let singleQuoteCount = 0;
    let doubleQuoteCount = 0;
    const groupingPatterns: ConventionAnalysis['imports']['grouping'][] = [];

    files.forEach(file => {
      const es6Matches = [...file.content.matchAll(CODE_PATTERNS.importStatement)];
      const requireMatches = [...file.content.matchAll(CODE_PATTERNS.requireStatement)];

      // AMD detection: define() function calls
      const amdMatches = [...file.content.matchAll(CODE_PATTERNS.amdDefine)];

      // UMD detection: typical UMD pattern with factory function
      const umdMatches = [...file.content.matchAll(CODE_PATTERNS.umdPattern)];

      es6Count += es6Matches.length;
      commonjsCount += requireMatches.length;
      amdCount += amdMatches.length;
      umdCount += umdMatches.length;

      // Count quote styles from imports and requires
      [...es6Matches, ...requireMatches].forEach(match => {
        if (match[1] === "'") singleQuoteCount++;
        else if (match[1] === '"') doubleQuoteCount++;
      });

      // Analyze import grouping patterns for files with multiple imports
      if (es6Matches.length > 1) {
        const groupingPattern = this.analyzeImportGrouping(file.content, es6Matches);
        if (groupingPattern) {
          groupingPatterns.push(groupingPattern);
        }
      }
    });

    // Determine dominant import style
    const totalImports = es6Count + commonjsCount + amdCount + umdCount;
    if (totalImports === 0) {
      return { style: 'es6' }; // Default to es6 if no imports found
    }

    const styleRatios = {
      es6: es6Count / totalImports,
      commonjs: commonjsCount / totalImports,
      amd: amdCount / totalImports,
      umd: umdCount / totalImports
    };

    // Find the dominant style (must be > 60% to be considered dominant)
    const sortedStyles = Object.entries(styleRatios).sort(([,a], [,b]) => b - a);
    const [dominantStyle, dominantRatio] = sortedStyles[0];

    let style: ConventionAnalysis['imports']['style'];
    if (dominantRatio > 0.6) {
      style = dominantStyle as ConventionAnalysis['imports']['style'];
    } else {
      // If no single style dominates, check if there are multiple significant styles
      const significantStyles = sortedStyles.filter(([, ratio]) => ratio > 0.2);
      style = significantStyles.length > 1 ? 'mixed' : dominantStyle as ConventionAnalysis['imports']['style'];
    }

    // Determine quote style
    const totalQuotes = singleQuoteCount + doubleQuoteCount;
    let quotes: ConventionAnalysis['imports']['quotes'];
    if (totalQuotes === 0) {
      quotes = undefined;
    } else {
      const singleRatio = singleQuoteCount / totalQuotes;
      if (singleRatio > 0.7) {
        quotes = 'single';
      } else if (singleRatio < 0.3) {
        quotes = 'double';
      } else {
        quotes = 'mixed';
      }
    }

    // Determine dominant grouping pattern
    const grouping = this.determineDominantGroupingPattern(groupingPatterns);

    return { style, quotes, grouping };
  }

  /**
   * Analyze import grouping patterns within a single file
   */
  private analyzeImportGrouping(fileContent: string, importMatches: RegExpMatchArray[]): ConventionAnalysis['imports']['grouping'] | null {
    if (importMatches.length < 2) return null;

    // Extract import information
    const imports = importMatches.map(match => {
      const fullMatch = match[0];
      const quote = match[1];
      const source = match[2];
      const lineIndex = fileContent.substring(0, match.index || 0).split('\n').length - 1;

      // Determine import type
      const isTypeImport = /^import\s+type\s+/.test(fullMatch) || /import\s+\{[^}]*type\s+/.test(fullMatch);
      const isRelativeImport = source.startsWith('.') || source.startsWith('/');
      const isExternalImport = !isRelativeImport && !source.includes('@types/');

      return {
        source,
        lineIndex,
        isTypeImport,
        isRelativeImport,
        isExternalImport,
        fullMatch
      };
    });

    // Sort imports by line index to analyze order
    imports.sort((a, b) => a.lineIndex - b.lineIndex);

    // Check for type-separate grouping
    if (this.hasTypeSeparateGrouping(imports)) {
      return 'type-separate';
    }

    // Check for source-separate grouping (external vs internal)
    if (this.hasSourceSeparateGrouping(imports)) {
      return 'source-separate';
    }

    // Check for alphabetical ordering
    if (this.hasAlphabeticalOrdering(imports)) {
      return 'alphabetical';
    }

    // If none of the standard patterns match but there's some consistent grouping
    if (this.hasCustomGrouping(imports, fileContent)) {
      return 'custom';
    }

    return 'none';
  }

  /**
   * Check if imports are grouped with types separate from values
   */
  private hasTypeSeparateGrouping(imports: Array<{source: string, lineIndex: number, isTypeImport: boolean, isRelativeImport: boolean, isExternalImport: boolean, fullMatch: string}>): boolean {
    const typeImports = imports.filter(imp => imp.isTypeImport);
    const valueImports = imports.filter(imp => !imp.isTypeImport);

    if (typeImports.length === 0 || valueImports.length === 0) return false;

    // Type imports should be grouped together and separate from value imports
    const typeLines = typeImports.map(imp => imp.lineIndex);
    const valueLines = valueImports.map(imp => imp.lineIndex);

    // Check if type imports are consecutive
    const typeConsecutive = this.areConsecutive(typeLines);
    const valueConsecutive = this.areConsecutive(valueLines);

    // Check if there's clear separation between groups
    const maxTypeLine = Math.max(...typeLines);
    const minValueLine = Math.min(...valueLines);
    const maxValueLine = Math.max(...valueLines);
    const minTypeLine = Math.min(...typeLines);

    return typeConsecutive && valueConsecutive &&
           (maxTypeLine < minValueLine - 1 || maxValueLine < minTypeLine - 1);
  }

  /**
   * Check if imports are grouped by source (external packages vs internal/relative)
   */
  private hasSourceSeparateGrouping(imports: Array<{source: string, lineIndex: number, isTypeImport: boolean, isRelativeImport: boolean, isExternalImport: boolean, fullMatch: string}>): boolean {
    const externalImports = imports.filter(imp => imp.isExternalImport);
    const internalImports = imports.filter(imp => imp.isRelativeImport);

    if (externalImports.length === 0 || internalImports.length === 0) return false;

    const externalLines = externalImports.map(imp => imp.lineIndex);
    const internalLines = internalImports.map(imp => imp.lineIndex);

    // Check if each group is consecutive
    const externalConsecutive = this.areConsecutive(externalLines);
    const internalConsecutive = this.areConsecutive(internalLines);

    // Check if there's clear separation between groups
    const maxExternalLine = Math.max(...externalLines);
    const minInternalLine = Math.min(...internalLines);
    const maxInternalLine = Math.max(...internalLines);
    const minExternalLine = Math.min(...externalLines);

    return externalConsecutive && internalConsecutive &&
           (maxExternalLine < minInternalLine - 1 || maxInternalLine < minExternalLine - 1);
  }

  /**
   * Check if imports are ordered alphabetically
   */
  private hasAlphabeticalOrdering(imports: Array<{source: string, lineIndex: number, isTypeImport: boolean, isRelativeImport: boolean, isExternalImport: boolean, fullMatch: string}>): boolean {
    // Group imports by type (external vs internal) as they're often sorted separately
    const externalImports = imports.filter(imp => imp.isExternalImport).sort((a, b) => a.lineIndex - b.lineIndex);
    const internalImports = imports.filter(imp => imp.isRelativeImport).sort((a, b) => a.lineIndex - b.lineIndex);

    // Check if external imports are alphabetically sorted
    const externalSorted = externalImports.length <= 1 ||
      externalImports.every((imp, i) => i === 0 || imp.source >= externalImports[i - 1].source);

    // Check if internal imports are alphabetically sorted
    const internalSorted = internalImports.length <= 1 ||
      internalImports.every((imp, i) => i === 0 || imp.source >= internalImports[i - 1].source);

    return externalSorted && internalSorted;
  }

  /**
   * Check if there's some other consistent custom grouping pattern
   */
  private hasCustomGrouping(imports: Array<{source: string, lineIndex: number, isTypeImport: boolean, isRelativeImport: boolean, isExternalImport: boolean, fullMatch: string}>, fileContent: string): boolean {
    // Look for blank lines between import groups as a sign of intentional grouping
    const lines = fileContent.split('\n');
    const importLines = imports.map(imp => imp.lineIndex);
    let groupCount = 0;

    for (let i = 1; i < importLines.length; i++) {
      const currentLine = importLines[i];
      const previousLine = importLines[i - 1];

      // Check if there's a blank line between imports (indicates grouping)
      if (currentLine - previousLine > 1) {
        const betweenLine = lines[previousLine + 1];
        if (betweenLine?.trim() === '') {
          groupCount++;
        }
      }
    }

    // If there are intentional blank line separators, consider it custom grouping
    return groupCount >= 1 && imports.length >= 3;
  }

  /**
   * Check if line numbers are consecutive (allowing for comments/blank lines in between)
   */
  private areConsecutive(lineNumbers: number[]): boolean {
    if (lineNumbers.length <= 1) return true;

    const sorted = [...lineNumbers].sort((a, b) => a - b);
    const maxGap = 3; // Allow up to 3 lines gap (for comments, blank lines)

    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] - sorted[i - 1] > maxGap) {
        return false;
      }
    }
    return true;
  }

  /**
   * Determine the dominant grouping pattern across all files
   */
  private determineDominantGroupingPattern(patterns: (ConventionAnalysis['imports']['grouping'])[]): ConventionAnalysis['imports']['grouping'] {
    if (patterns.length === 0) return undefined;

    // Count occurrences of each pattern
    const counts = patterns.reduce((acc, pattern) => {
      acc[pattern || 'none'] = (acc[pattern || 'none'] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Find the most common pattern
    let maxCount = 0;
    let dominantPattern: ConventionAnalysis['imports']['grouping'] = 'none';

    for (const [pattern, count] of Object.entries(counts)) {
      if (count > maxCount) {
        maxCount = count;
        dominantPattern = pattern as ConventionAnalysis['imports']['grouping'];
      }
    }

    // If no clear dominant pattern (too much variation), return 'none'
    const totalFiles = patterns.length;
    const dominantRatio = maxCount / totalFiles;

    if (dominantRatio < 0.6) { // Less than 60% consistency
      return 'none';
    }

    return dominantPattern;
  }

  /**
   * Analyze documentation patterns and coverage
   */
  private analyzeDocumentation(files: Array<{ path: string; content: string }>): ConventionAnalysis['documentation'] {
    let jsdocCount = 0;
    let tsdocCount = 0;
    let inlineCount = 0;
    let markdownCount = 0;
    let totalDocumentableElements = 0;
    let documentedElements = 0;

    files.forEach(file => {
      // Only analyze code files that typically have documentation
      const isCodeFile = /\.(js|jsx|ts|tsx|vue)$/i.test(file.path);
      if (!isCodeFile) return;

      const content = file.content;

      // Match different documentation styles
      const jsdocMatches = [...content.matchAll(CODE_PATTERNS.jsdocComment)];
      const tsdocMatches = [...content.matchAll(CODE_PATTERNS.tsdocComment)];
      const inlineMatches = [...content.matchAll(CODE_PATTERNS.inlineComment)];
      const markdownMatches = [...content.matchAll(CODE_PATTERNS.markdownComment)];

      // Count documentable elements (functions, classes, interfaces, types)
      const functionMatches = [...content.matchAll(CODE_PATTERNS.functionDeclaration)];
      const classMatches = [...content.matchAll(CODE_PATTERNS.classDeclaration)];
      const interfaceMatches = [...content.matchAll(/interface\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g)];
      const typeMatches = [...content.matchAll(/type\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g)];
      const exportMatches = [...content.matchAll(/export\s+(?:function|class|interface|type|const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g)];

      const fileDocumentableElements = functionMatches.length + classMatches.length + interfaceMatches.length + typeMatches.length + exportMatches.length;
      totalDocumentableElements += fileDocumentableElements;

      // Count documented elements by checking for comments immediately before declarations
      let fileDocumentedElements = 0;

      // Check for documentation before functions
      functionMatches.forEach(match => {
        const beforeFunction = content.substring(0, match.index || 0);
        if (this.hasDocumentationBefore(beforeFunction)) {
          fileDocumentedElements++;
        }
      });

      // Check for documentation before classes
      classMatches.forEach(match => {
        const beforeClass = content.substring(0, match.index || 0);
        if (this.hasDocumentationBefore(beforeClass)) {
          fileDocumentedElements++;
        }
      });

      // Check for documentation before interfaces
      interfaceMatches.forEach(match => {
        const beforeInterface = content.substring(0, match.index || 0);
        if (this.hasDocumentationBefore(beforeInterface)) {
          fileDocumentedElements++;
        }
      });

      // Check for documentation before types
      typeMatches.forEach(match => {
        const beforeType = content.substring(0, match.index || 0);
        if (this.hasDocumentationBefore(beforeType)) {
          fileDocumentedElements++;
        }
      });

      // Check for documentation before exports
      exportMatches.forEach(match => {
        const beforeExport = content.substring(0, match.index || 0);
        if (this.hasDocumentationBefore(beforeExport)) {
          fileDocumentedElements++;
        }
      });

      documentedElements += fileDocumentedElements;

      // Count different documentation styles
      jsdocCount += jsdocMatches.length;
      tsdocCount += tsdocMatches.length;
      inlineCount += inlineMatches.length;
      markdownCount += markdownMatches.length;
    });

    // Determine dominant documentation style
    const styleCounts = {
      tsdoc: tsdocCount,
      jsdoc: jsdocCount - tsdocCount, // JSDoc that isn't TSDoc
      markdown: markdownCount,
      inline: inlineCount
    };

    const totalComments = tsdocCount + (jsdocCount - tsdocCount) + markdownCount + inlineCount;
    const sortedStyles = Object.entries(styleCounts).sort(([,a], [,b]) => b - a);

    let style: ConventionAnalysis['documentation']['style'];

    if (totalComments === 0) {
      style = 'none';
    } else {
      const [dominantStyle, dominantCount] = sortedStyles[0];
      const secondHighest = sortedStyles[1]?.[1] || 0;

      // If no single style dominates (less than 50% of total), it's mixed
      if (dominantCount / totalComments < 0.5 && sortedStyles.filter(([, count]) => count > 0).length > 1) {
        style = 'mixed';
      } else {
        style = dominantStyle as ConventionAnalysis['documentation']['style'];
      }
    }

    // Calculate coverage percentage
    const coverage = totalDocumentableElements > 0
      ? Math.min(100, Math.round((documentedElements / totalDocumentableElements) * 100))
      : 0;

    return { style, coverage };
  }

  /**
   * Check if there's documentation (comment block) immediately before a code position
   */
  private hasDocumentationBefore(contentBefore: string): boolean {
    // Look for the last block comment or JSDoc comment before this position
    const lines = contentBefore.split('\n');
    let foundDoc = false;

    // Check the last few lines (up to 5) for documentation
    for (let i = Math.max(0, lines.length - 5); i < lines.length; i++) {
      const line = lines[i].trim();

      // Skip empty lines
      if (!line) continue;

      // Check for various documentation patterns
      if (line.startsWith('/**') ||
          line.startsWith('*') ||
          line.includes('*/') ||
          line.startsWith('//') && line.length > 5) { // Substantial inline comments
        foundDoc = true;
      } else if (line.length > 0 && !foundDoc) {
        // Found non-empty, non-comment line without prior documentation
        break;
      }
    }

    return foundDoc;
  }

  /**
   * Analyze code formatting patterns with enhanced detection
   */
  private analyzeFormatting(files: Array<{ path: string; content: string }>): ConventionAnalysis['formatting'] {
    interface FormattingSample {
      file: string;
      hasSemicolons: boolean;
      quoteStyle: 'single' | 'double' | 'backtick' | null;
      hasTrailingComma: boolean;
      maxLineLength: number;
    }

    const samples: FormattingSample[] = [];

    // Analyze each file individually
    files.forEach(file => {
      // Only analyze JS/TS files for detailed formatting
      if (!this.isJavaScriptFile(file.path)) return;

      const sample = this.analyzeFileFormatting(file.content, file.path);
      samples.push(sample);
    });

    if (samples.length === 0) {
      return undefined;
    }

    // Aggregate all samples
    return this.aggregateFormattingSamples(samples);
  }

  /**
   * Check if file is a JavaScript/TypeScript file
   */
  private isJavaScriptFile(filePath: string): boolean {
    const ext = filePath.split('.').pop()?.toLowerCase();
    return ['js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs'].includes(ext ?? '');
  }

  /**
   * Analyze formatting for a single file
   */
  private analyzeFileFormatting(content: string, filePath: string): { file: string; hasSemicolons: boolean; quoteStyle: 'single' | 'double' | 'backtick' | null; hasTrailingComma: boolean; maxLineLength: number } {
    const lines = content.split('\n');

    // Analyze semicolons
    const hasSemicolons = this.detectSemicolons(content);

    // Analyze quote styles
    const quoteStyle = this.detectQuoteStyle(content);

    // Analyze trailing commas
    const hasTrailingComma = this.detectTrailingCommas(content);

    // Calculate max line length (95th percentile to avoid outliers)
    const lineLengths = lines.map(l => l.length).filter(l => l > 0);
    lineLengths.sort((a, b) => a - b);
    const p95Index = Math.floor(lineLengths.length * 0.95);
    const maxLineLength = lineLengths[p95Index] || 80;

    return {
      file: filePath,
      hasSemicolons,
      quoteStyle,
      hasTrailingComma,
      maxLineLength
    };
  }

  /**
   * Detect semicolon usage pattern
   */
  private detectSemicolons(content: string): boolean {
    const lines = content.split('\n');
    let withSemi = 0;
    let withoutSemi = 0;

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip empty, comments, and structural lines
      if (this.isStatementEndingLine(trimmed)) {
        if (trimmed.endsWith(';')) {
          withSemi++;
        } else {
          withoutSemi++;
        }
      }
    }

    const total = withSemi + withoutSemi;
    if (total === 0) return false;

    return withSemi > withoutSemi;
  }

  /**
   * Determine if line represents a statement that could end with semicolon
   */
  private isStatementEndingLine(line: string): boolean {
    // Skip empty lines
    if (!line) return false;

    // Skip comments
    if (line.startsWith('//') || line.startsWith('/*') || line.startsWith('*')) {
      return false;
    }

    // Skip lines ending with structural characters
    const structuralEndings = ['{', '}', '(', ')', '[', ']', ',', ':'];
    const lastChar = line.slice(-1);
    if (structuralEndings.includes(lastChar)) return false;

    // Skip lines that are clearly not statements
    if (line.startsWith('import ') && !line.endsWith(';')) {
      // Could be multi-line import
      return false;
    }

    // Must have some content that looks like a statement
    return /^(const|let|var|return|throw|break|continue|\w+\s*=|\w+\(.*\))/.test(line);
  }

  /**
   * Detect quote style preferences
   */
  private detectQuoteStyle(content: string): 'single' | 'double' | 'backtick' | null {
    // Find all string literals using regex
    const singleQuotes = (content.match(/'[^'\\]*(?:\\.[^'\\]*)*'/g) || []).length;
    const doubleQuotes = (content.match(/"[^"\\]*(?:\\.[^"\\]*)*"/g) || []).length;
    const backticks = (content.match(/`[^`\\]*(?:\\.[^`\\]*)*`/g) || []).length;

    const total = singleQuotes + doubleQuotes + backticks;
    if (total === 0) return null;

    const max = Math.max(singleQuotes, doubleQuotes, backticks);

    if (max === singleQuotes) return 'single';
    if (max === doubleQuotes) return 'double';
    return 'backtick';
  }

  /**
   * Detect trailing comma preferences
   */
  private detectTrailingCommas(content: string): boolean {
    // Find multiline arrays and objects
    const multilineStructures = this.findMultilineStructures(content);

    let withTrailing = 0;
    let withoutTrailing = 0;

    for (const structure of multilineStructures) {
      if (structure.hasTrailingComma) {
        withTrailing++;
      } else {
        withoutTrailing++;
      }
    }

    const total = withTrailing + withoutTrailing;
    if (total === 0) return false;

    return withTrailing > withoutTrailing;
  }

  /**
   * Find multiline array/object structures and check for trailing commas
   */
  private findMultilineStructures(content: string): Array<{ hasTrailingComma: boolean; isFunction: boolean }> {
    const structures: Array<{ hasTrailingComma: boolean; isFunction: boolean }> = [];

    // Simple regex patterns to find array/object literals that span multiple lines
    // This is approximate - full AST parsing would be more accurate

    // Match array literals that span multiple lines
    const arrayMatches = content.matchAll(/\[\s*\n[\s\S]*?\n\s*\]/g);
    for (const match of arrayMatches) {
      const structure = match[0];
      const lines = structure.split('\n');
      if (lines.length > 2) {
        // Look for trailing comma before the closing bracket
        const beforeClosing = lines[lines.length - 2]?.trim() || '';
        const hasTrailingComma = beforeClosing.endsWith(',');
        structures.push({ hasTrailingComma, isFunction: false });
      }
    }

    // Match object literals that span multiple lines
    const objectMatches = content.matchAll(/\{\s*\n[\s\S]*?\n\s*\}/g);
    for (const match of objectMatches) {
      const structure = match[0];
      const lines = structure.split('\n');
      if (lines.length > 2) {
        // Look for trailing comma before the closing brace
        const beforeClosing = lines[lines.length - 2]?.trim() || '';
        const hasTrailingComma = beforeClosing.endsWith(',');
        structures.push({ hasTrailingComma, isFunction: false });
      }
    }

    return structures;
  }

  /**
   * Aggregate formatting samples into final analysis
   */
  private aggregateFormattingSamples(samples: Array<{ file: string; hasSemicolons: boolean; quoteStyle: 'single' | 'double' | 'backtick' | null; hasTrailingComma: boolean; maxLineLength: number }>): ConventionAnalysis['formatting'] {
    // Analyze semicolons
    const semicolonUsers = samples.filter(s => s.hasSemicolons).length;
    const semicolonRatio = semicolonUsers / samples.length;

    let semicolons: 'required' | 'optional' | 'mixed' | undefined;
    if (semicolonRatio > 0.8) semicolons = 'required';
    else if (semicolonRatio < 0.2) semicolons = 'optional';
    else if (samples.length > 0) semicolons = 'mixed';

    // Analyze quotes
    const quoteStyles = samples.map(s => s.quoteStyle).filter(q => q !== null);
    const singleCount = quoteStyles.filter(q => q === 'single').length;
    const doubleCount = quoteStyles.filter(q => q === 'double').length;
    const backtickCount = quoteStyles.filter(q => q === 'backtick').length;

    let quotes: 'single' | 'double' | 'backtick' | 'mixed' | undefined;
    if (quoteStyles.length === 0) {
      quotes = undefined;
    } else {
      const max = Math.max(singleCount, doubleCount, backtickCount);
      const dominantRatio = max / quoteStyles.length;

      if (dominantRatio < 0.7) {
        quotes = 'mixed';
      } else if (max === singleCount) {
        quotes = 'single';
      } else if (max === doubleCount) {
        quotes = 'double';
      } else {
        quotes = 'backtick';
      }
    }

    // Analyze trailing commas
    const trailingCommaUsers = samples.filter(s => s.hasTrailingComma).length;
    const trailingCommaRatio = trailingCommaUsers / samples.length;

    let trailingCommas: 'always' | 'never' | 'es5' | 'mixed' | undefined;
    if (trailingCommaRatio > 0.8) trailingCommas = 'always';
    else if (trailingCommaRatio < 0.2) trailingCommas = 'never';
    else if (samples.length > 0) trailingCommas = 'mixed';

    // Analyze line length (find common limits)
    const lineLengths = samples.map(s => s.maxLineLength);
    const avgLength = lineLengths.reduce((a, b) => a + b, 0) / lineLengths.length;

    const commonLimits = [80, 100, 120, 140, 160, 200];
    let lineLength: number | undefined;
    for (const limit of commonLimits) {
      if (avgLength <= limit) {
        lineLength = limit;
        break;
      }
    }
    if (!lineLength) lineLength = 200;

    return {
      lineLength,
      semicolons,
      quotes,
      trailingCommas
    };
  }

  /**
   * Create default analysis for empty projects
   */
  private createDefaultAnalysis(): ConventionAnalysis {
    return {
      fileNaming: 'mixed',
      functionNaming: 'mixed',
      variableNaming: 'mixed',
      indentation: { type: 'spaces', size: 2 },
      imports: { style: 'es6' },
      documentation: { style: 'none', coverage: 0 },
      organization: {
        testLocation: 'mixed',
        testNaming: 'mixed',
        sourceStructure: 'mixed'
      }
    };
  }

  /**
   * Determine dominant naming convention from counts
   */
  private determineDominantNaming(counts: Record<string, number>): ConventionAnalysis['fileNaming'] {
    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
    if (total === 0) return 'mixed';

    const sortedEntries = Object.entries(counts).sort(([,a], [,b]) => b - a);
    const [dominantType, dominantCount] = sortedEntries[0];

    // If the dominant pattern is less than 60% of the total, consider it mixed
    if (dominantCount / total < 0.6) return 'mixed';

    // If there are multiple patterns with significant usage, it's inconsistent
    const secondHighest = sortedEntries[1]?.[1] || 0;
    if (secondHighest / total > 0.3) return 'inconsistent';

    return dominantType as ConventionAnalysis['fileNaming'];
  }

  private determineDominantFunctionNaming(counts: Record<string, number>): ConventionAnalysis['functionNaming'] {
    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
    if (total === 0) return 'mixed';

    const sortedEntries = Object.entries(counts).sort(([,a], [,b]) => b - a);
    const [dominantType, dominantCount] = sortedEntries[0];

    if (dominantCount / total < 0.6) return 'mixed';

    const secondHighest = sortedEntries[1]?.[1] || 0;
    if (secondHighest / total > 0.3) return 'inconsistent';

    return dominantType as ConventionAnalysis['functionNaming'];
  }

  private determineDominantVariableNaming(counts: Record<string, number>): ConventionAnalysis['variableNaming'] {
    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
    if (total === 0) return 'mixed';

    const sortedEntries = Object.entries(counts).sort(([,a], [,b]) => b - a);
    const [dominantType, dominantCount] = sortedEntries[0];

    if (dominantCount / total < 0.6) return 'mixed';

    const secondHighest = sortedEntries[1]?.[1] || 0;
    if (secondHighest / total > 0.3) return 'inconsistent';

    return dominantType as ConventionAnalysis['variableNaming'];
  }

  private determineDominantClassNaming(counts: Record<string, number>): ConventionAnalysis['classNaming'] {
    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
    if (total === 0) return undefined;

    const sortedEntries = Object.entries(counts).sort(([,a], [,b]) => b - a);
    const [dominantType, dominantCount] = sortedEntries[0];

    if (dominantCount / total < 0.6) return 'mixed';

    const secondHighest = sortedEntries[1]?.[1] || 0;
    if (secondHighest / total > 0.3) return 'inconsistent';

    return dominantType as ConventionAnalysis['classNaming'];
  }

  private determineDominantConstantNaming(counts: Record<string, number>): ConventionAnalysis['constantNaming'] {
    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
    if (total === 0) return undefined;

    const sortedEntries = Object.entries(counts).sort(([,a], [,b]) => b - a);
    const [dominantType, dominantCount] = sortedEntries[0];

    if (dominantCount / total < 0.6) return 'mixed';

    const secondHighest = sortedEntries[1]?.[1] || 0;
    if (secondHighest / total > 0.3) return 'inconsistent';

    return dominantType as ConventionAnalysis['constantNaming'];
  }

  /**
   * Analyze file organization patterns including test location and structure
   */
  private analyzeOrganizationPatterns(projectPath: string, files: string[]): NonNullable<ConventionAnalysis['organization']> {
    const testLocation = this.analyzeTestLocation(files);
    const testNaming = this.analyzeTestNaming(files);
    const sourceStructure = this.analyzeSourceStructure(projectPath, files);
    const configLocation = this.analyzeConfigLocation(files);

    return {
      testLocation,
      testNaming,
      sourceStructure,
      configLocation
    };
  }

  /**
   * Analyze test file location patterns
   */
  private analyzeTestLocation(files: string[]): NonNullable<ConventionAnalysis['organization']>['testLocation'] {
    const testFiles = files.filter(file => this.isTestFile(file));

    if (testFiles.length === 0) return 'mixed';

    let colocatedCount = 0;
    let separateTestsCount = 0;
    let separateUnderscoreTestsCount = 0;

    testFiles.forEach(testFile => {
      const dir = dirname(testFile);
      const dirName = basename(dir);

      if (dirName === '__tests__') {
        separateUnderscoreTestsCount++;
      } else if (dirName === 'tests' || dirName === 'test') {
        separateTestsCount++;
      } else {
        // Check if there's a corresponding source file in the same directory
        const testName = basename(testFile);
        const sourceFileName = testName
          .replace(/\.(test|spec)\.(js|jsx|ts|tsx|py|rb|go|rs|java|kt|php|cs|cpp|c|swift|m|scala|clj|dart)$/, '.$2');

        const sourcePath = join(dir, sourceFileName);
        if (files.includes(sourcePath)) {
          colocatedCount++;
        } else {
          separateTestsCount++;
        }
      }
    });

    // Determine the dominant pattern
    const total = testFiles.length;
    if (separateUnderscoreTestsCount / total >= 0.6) return 'separate-__tests__';
    if (separateTestsCount / total >= 0.6) return 'separate-tests';
    if (colocatedCount / total >= 0.6) return 'colocated';

    return 'mixed';
  }

  /**
   * Analyze test file naming patterns
   */
  private analyzeTestNaming(files: string[]): NonNullable<ConventionAnalysis['organization']>['testNaming'] {
    const testFiles = files.filter(file => this.isTestFile(file));

    if (testFiles.length === 0) return 'mixed';

    let suffixTestCount = 0;
    let suffixSpecCount = 0;
    let suffixCapitalTestCount = 0;
    let prefixTestCount = 0;

    testFiles.forEach(testFile => {
      const fileName = basename(testFile);

      if (/\.(test|tests)\.(js|jsx|ts|tsx|py|rb|go|rs|java|kt|php|cs|cpp|c|swift|m|scala|clj|dart)$/i.test(fileName)) {
        suffixTestCount++;
      } else if (/\.(spec|specs)\.(js|jsx|ts|tsx|py|rb|go|rs|java|kt|php|cs|cpp|c|swift|m|scala|clj|dart)$/i.test(fileName)) {
        suffixSpecCount++;
      } else if (/Test\.(js|jsx|ts|tsx|py|rb|go|rs|java|kt|php|cs|cpp|c|swift|m|scala|clj|dart)$/i.test(fileName)) {
        suffixCapitalTestCount++;
      } else if (/^(test|Test)[-_]/.test(fileName)) {
        prefixTestCount++;
      }
    });

    const total = testFiles.length;
    if (suffixTestCount / total >= 0.6) return 'suffix-.test';
    if (suffixSpecCount / total >= 0.6) return 'suffix-.spec';
    if (suffixCapitalTestCount / total >= 0.6) return 'suffix-Test';
    if (prefixTestCount / total >= 0.6) return 'prefix-test-';

    return 'mixed';
  }

  /**
   * Analyze source directory structure patterns
   */
  private analyzeSourceStructure(projectPath: string, files: string[]): NonNullable<ConventionAnalysis['organization']>['sourceStructure'] {
    // Look for common source directory patterns
    const sourceFiles = files.filter(file => !this.isTestFile(file) && !this.isConfigFile(file));

    if (sourceFiles.length === 0) return 'mixed';

    let srcCount = 0;
    let libCount = 0;
    let appCount = 0;
    let sourceCount = 0;
    let rootLevelCount = 0;

    sourceFiles.forEach(file => {
      const relativePath = file.replace(projectPath, '').replace(/^\/+/, '');
      const pathSegments = relativePath.split('/');

      if (pathSegments.length > 1) {
        const topLevelDir = pathSegments[0];

        switch (topLevelDir) {
          case 'src':
            srcCount++;
            break;
          case 'lib':
          case 'libs':
            libCount++;
            break;
          case 'app':
          case 'apps':
            appCount++;
            break;
          case 'source':
          case 'sources':
            sourceCount++;
            break;
          default:
            rootLevelCount++;
            break;
        }
      } else {
        rootLevelCount++;
      }
    });

    const total = sourceFiles.length;
    if (srcCount / total >= 0.6) return 'src';
    if (libCount / total >= 0.6) return 'lib';
    if (appCount / total >= 0.6) return 'app';
    if (sourceCount / total >= 0.6) return 'source';
    if (rootLevelCount / total >= 0.6) return 'root-level';

    return 'mixed';
  }

  /**
   * Analyze configuration file location patterns
   */
  private analyzeConfigLocation(files: string[]): NonNullable<ConventionAnalysis['organization']>['configLocation'] {
    const configFiles = files.filter(file => this.isConfigFile(file));

    if (configFiles.length === 0) return undefined;

    let rootCount = 0;
    let configDirCount = 0;

    configFiles.forEach(file => {
      const dir = dirname(file);
      const dirName = basename(dir);

      if (dirName === 'config' || dirName === 'configs' || dirName === '.config') {
        configDirCount++;
      } else {
        rootCount++;
      }
    });

    const total = configFiles.length;
    if (rootCount / total >= 0.6) return 'root';
    if (configDirCount / total >= 0.6) return 'config-dir';

    return 'mixed';
  }

  /**
   * Check if a file is a test file based on naming patterns
   */
  private isTestFile(filePath: string): boolean {
    const fileName = basename(filePath);
    const dir = dirname(filePath);
    const dirName = basename(dir);

    // Check directory patterns
    if (dirName === '__tests__' || dirName === 'tests' || dirName === 'test') {
      return true;
    }

    // Check file name patterns
    return /\.(test|spec|tests|specs)\./.test(fileName) ||
           /Test\.(js|jsx|ts|tsx|py|rb|go|rs|java|kt|php|cs|cpp|c|swift|m|scala|clj|dart)$/i.test(fileName) ||
           /^(test|Test)[-_]/.test(fileName);
  }

  /**
   * Check if a file is a configuration file
   */
  private isConfigFile(filePath: string): boolean {
    const fileName = basename(filePath);

    const configPatterns = [
      /^package\.json$/,
      /^tsconfig.*\.json$/,
      /^jest\.config\./,
      /^webpack\.config\./,
      /^babel\.config\./,
      /^rollup\.config\./,
      /^vite\.config\./,
      /^eslint\.config\./,
      /^\.eslintrc/,
      /^\.prettierrc/,
      /^\.gitignore$/,
      /^\.gitattributes$/,
      /^\.editorconfig$/,
      /^\.npmrc$/,
      /^\.nvmrc$/,
      /^\.dockerignore$/,
      /^Dockerfile$/,
      /^docker-compose/,
      /^Makefile$/,
      /^Rakefile$/,
      /^Gemfile$/,
      /^requirements\.txt$/,
      /^setup\.py$/,
      /^cargo\.toml$/i,
      /^composer\.json$/,
      /^pom\.xml$/,
      /^build\.gradle$/,
      /^\.gradle$/
    ];

    return configPatterns.some(pattern => pattern.test(fileName));
  }
}