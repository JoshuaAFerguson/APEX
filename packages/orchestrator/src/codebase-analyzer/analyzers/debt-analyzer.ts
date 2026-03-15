/**
 * Technical Debt Analyzer - Code Quality and Debt Assessment
 *
 * Analyzes technical debt and code quality issues including:
 * - Code complexity hotspots and cyclomatic complexity
 * - Code duplication detection
 * - TODO/FIXME comment analysis
 * - Deprecated pattern usage
 * - Dead code detection
 * - Maintainability metrics calculation
 * - Technical debt categorization and scoring
 *
 * Returns structured TechnicalDebtAnalysis data validated against schema.
 */

import { promises as fs } from 'fs';
import { join, relative, dirname, basename, extname } from 'path';
import type { TechnicalDebtAnalysis } from '@apexcli/core';
import type { CodebaseAnalyzer } from '../types.js';

/**
 * TODO/FIXME patterns for debt detection
 */
const TODO_PATTERNS = [
  { pattern: /\/\/\s*(TODO|FIXME|HACK|BUG|XXX|NOTE)\s*:?\s*(.+)/gi, type: 'comment' },
  { pattern: /\/\*\s*(TODO|FIXME|HACK|BUG|XXX|NOTE)\s*:?\s*([^*]+)\*\//gi, type: 'block' },
  { pattern: /#\s*(TODO|FIXME|HACK|BUG|XXX|NOTE)\s*:?\s*(.+)/gi, type: 'python' },
];

/**
 * Code smell patterns
 */
const CODE_SMELL_PATTERNS = [
  { pattern: /function\s+\w+\s*\([^)]*\)\s*{[^{}]*{[^{}]*{[^{}]*{/g, category: 'complexity', description: 'Deeply nested function' },
  { pattern: /if\s*\([^{]*{\s*if\s*\([^{]*{\s*if\s*\(/g, category: 'complexity', description: 'Deeply nested conditionals' },
  { pattern: /\.length\s*>\s*\d{3,}/g, category: 'performance', description: 'Large collection operation' },
  { pattern: /console\.(log|warn|error|debug)/g, category: 'code-smell', description: 'Debug statements left in code' },
  { pattern: /debugger;?/g, category: 'code-smell', description: 'Debugger statements left in code' },
  { pattern: /eval\s*\(/g, category: 'security-vulnerability', description: 'Use of eval() function' },
  { pattern: /innerHTML\s*=\s*[^;]+\+/g, category: 'security-vulnerability', description: 'Potential XSS vulnerability' },
  { pattern: /document\.write\s*\(/g, category: 'security-vulnerability', description: 'Use of document.write()' },
];

/**
 * Deprecated pattern detection
 */
const DEPRECATED_PATTERNS = [
  { pattern: /var\s+\w+\s*=/g, category: 'technical-design', description: 'Use of var instead of let/const' },
  { pattern: /function\s*\(\s*\)\s*{/g, category: 'technical-design', description: 'Anonymous function expressions' },
  { pattern: /new\s+Array\s*\(/g, category: 'technical-design', description: 'Array constructor usage' },
  { pattern: /==\s*(?!==)/g, category: 'technical-design', description: 'Loose equality comparison' },
  { pattern: /!=\s*(?!==)/g, category: 'technical-design', description: 'Loose inequality comparison' },
  { pattern: /with\s*\(/g, category: 'technical-design', description: 'Use of with statement' },
];

/**
 * Duplication detection patterns
 */
const DUPLICATION_THRESHOLD = 5; // Minimum lines to consider duplication
const SIMILARITY_THRESHOLD = 0.8; // Minimum similarity ratio

export class TechnicalDebtAnalyzer implements CodebaseAnalyzer<TechnicalDebtAnalysis> {
  /**
   * Analyze technical debt in a codebase
   */
  async analyze(projectPath: string): Promise<TechnicalDebtAnalysis> {
    try {
      // Find all source files
      const files = await this.findSourceFiles(projectPath);

      if (files.length === 0) {
        return this.createEmptyAnalysis();
      }

      // 1. Calculate complexity hotspots
      const complexityHotspots = await this.analyzeComplexity(files, projectPath);

      // 2. Detect code duplication
      const duplication = await this.detectDuplication(files, projectPath);

      // 3. Find TODO/FIXME comments
      const todoItems = await this.findTodoComments(files, projectPath);

      // 4. Detect code smells
      const codeSmells = await this.detectCodeSmells(files, projectPath);

      // 5. Detect deprecated patterns
      const deprecatedUsage = await this.findDeprecatedUsage(files, projectPath);

      // 6. Calculate maintainability metrics
      const metrics = await this.calculateMetrics(files);

      // 7. Aggregate into categories
      const allIssues = [
        ...complexityHotspots,
        ...duplication,
        ...todoItems,
        ...codeSmells,
        ...deprecatedUsage,
      ];

      const categories = this.categorizeDebt(allIssues);

      // 8. Find top hotspots
      const hotspots = await this.identifyHotspots(files, projectPath, allIssues);

      // 9. Calculate total score
      const totalScore = this.calculateDebtScore(categories);

      return {
        totalScore,
        categories,
        hotspots,
        metrics,
      };
    } catch (error) {
      throw new Error(`Technical debt analysis failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Find source files for analysis
   */
  private async findSourceFiles(projectPath: string): Promise<string[]> {
    const files: string[] = [];
    const relevantExtensions = new Set([
      '.js', '.jsx', '.ts', '.tsx', '.vue', '.svelte',
      '.py', '.rb', '.go', '.rs', '.java', '.kt',
      '.php', '.cs', '.cpp', '.c', '.swift', '.dart'
    ]);

    const walkDir = async (dir: string) => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = join(dir, entry.name);

          if (entry.isDirectory()) {
            const skipDirs = new Set([
              'node_modules', '.git', 'dist', 'build', 'coverage',
              '.next', '.nuxt', 'target', '.venv', 'venv', '__pycache__',
              'vendor', '.gradle', '.mvn'
            ]);
            if (!skipDirs.has(entry.name)) {
              await walkDir(fullPath);
            }
          } else if (entry.isFile()) {
            const ext = extname(entry.name).toLowerCase();
            if (relevantExtensions.has(ext)) {
              files.push(fullPath);
            }
          }
        }
      } catch (error) {
        // Skip directories that can't be read
        console.warn(`Skipping directory ${dir}: ${error}`);
      }
    };

    await walkDir(projectPath);
    return files;
  }

  /**
   * Analyze code complexity and identify hotspots
   */
  private async analyzeComplexity(files: string[], projectPath: string): Promise<any[]> {
    const issues: any[] = [];

    // Analyze a subset for performance
    const filesToAnalyze = files.slice(0, 100);

    for (const file of filesToAnalyze) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const lines = content.split('\n');
        const complexity = this.calculateCyclomaticComplexity(content);

        if (complexity > 10) {
          issues.push({
            type: 'complexity',
            file: relative(projectPath, file),
            message: `High cyclomatic complexity (${complexity})`,
            severity: complexity > 20 ? 'high' : 'medium',
            line: 1,
            score: Math.min(100, complexity * 5),
          });
        }

        // Check function length
        const longFunctions = this.findLongFunctions(content, file, projectPath);
        issues.push(...longFunctions);

      } catch (error) {
        // Skip files that can't be read
        continue;
      }
    }

    return issues;
  }

  /**
   * Calculate cyclomatic complexity for code
   */
  private calculateCyclomaticComplexity(content: string): number {
    // Simplified cyclomatic complexity calculation
    let complexity = 1; // Base complexity

    // Count decision points
    const patterns = [
      /\bif\s*\(/g,
      /\belse\s+if\s*\(/g,
      /\bwhile\s*\(/g,
      /\bfor\s*\(/g,
      /\bswitch\s*\(/g,
      /\bcase\s+/g,
      /\bcatch\s*\(/g,
      /\&\&/g,
      /\|\|/g,
      /\?[^:]*:/g, // Ternary operators
    ];

    for (const pattern of patterns) {
      const matches = content.match(pattern);
      complexity += matches ? matches.length : 0;
    }

    return complexity;
  }

  /**
   * Find functions that are too long
   */
  private findLongFunctions(content: string, file: string, projectPath: string): any[] {
    const issues: any[] = [];
    const lines = content.split('\n');

    // Simple function detection (works for JavaScript/TypeScript)
    const functionPattern = /function\s+(\w+)\s*\(|const\s+(\w+)\s*=\s*(?:async\s+)?\(|(\w+)\s*:\s*(?:async\s+)?\(/g;
    let match;

    while ((match = functionPattern.exec(content)) !== null) {
      const functionName = match[1] || match[2] || match[3];
      const startIndex = match.index;
      const startLine = content.substring(0, startIndex).split('\n').length;

      // Find function end (simplified - just count braces)
      let braceCount = 0;
      let functionEnd = startIndex;
      let inFunction = false;

      for (let i = startIndex; i < content.length; i++) {
        const char = content[i];
        if (char === '{') {
          braceCount++;
          inFunction = true;
        } else if (char === '}') {
          braceCount--;
          if (inFunction && braceCount === 0) {
            functionEnd = i;
            break;
          }
        }
      }

      const functionContent = content.substring(startIndex, functionEnd);
      const functionLines = functionContent.split('\n').length;

      if (functionLines > 50) {
        issues.push({
          type: 'complexity',
          file: relative(projectPath, file),
          message: `Long function "${functionName}" (${functionLines} lines)`,
          severity: functionLines > 100 ? 'high' : 'medium',
          line: startLine,
          score: Math.min(100, functionLines),
        });
      }
    }

    return issues;
  }

  /**
   * Detect code duplication
   */
  private async detectDuplication(files: string[], projectPath: string): Promise<any[]> {
    const issues: any[] = [];
    const codeBlocks = new Map<string, { file: string; lineNumber: number; content: string }[]>();

    // Analyze a subset for performance
    const filesToAnalyze = files.slice(0, 50);

    // Extract code blocks from each file
    for (const file of filesToAnalyze) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const lines = content.split('\n');

        // Look for duplicated blocks of code
        for (let i = 0; i < lines.length - DUPLICATION_THRESHOLD; i++) {
          const block = lines.slice(i, i + DUPLICATION_THRESHOLD).join('\n').trim();
          const normalizedBlock = this.normalizeCodeBlock(block);

          if (normalizedBlock.length > 50) { // Skip very short blocks
            if (!codeBlocks.has(normalizedBlock)) {
              codeBlocks.set(normalizedBlock, []);
            }
            codeBlocks.get(normalizedBlock)!.push({
              file: relative(projectPath, file),
              lineNumber: i + 1,
              content: block,
            });
          }
        }
      } catch (error) {
        // Skip files that can't be read
        continue;
      }
    }

    // Find duplicated blocks
    for (const [block, occurrences] of codeBlocks.entries()) {
      if (occurrences.length > 1) {
        const locations = occurrences.map(occ => `${occ.file}:${occ.lineNumber}`);
        issues.push({
          type: 'duplication',
          file: occurrences[0].file,
          message: `Code duplication detected in ${occurrences.length} locations`,
          severity: occurrences.length > 3 ? 'high' : 'medium',
          line: occurrences[0].lineNumber,
          score: occurrences.length * 10,
          locations,
        });
      }
    }

    return issues.slice(0, 20); // Limit number of duplication issues
  }

  /**
   * Normalize code block for duplication detection
   */
  private normalizeCodeBlock(code: string): string {
    return code
      .replace(/\/\/.*$/gm, '') // Remove line comments
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/\b\w+\b/g, 'IDENTIFIER') // Replace identifiers
      .replace(/\d+/g, 'NUMBER') // Replace numbers
      .replace(/['"`][^'"`]*['"`]/g, 'STRING') // Replace strings
      .trim();
  }

  /**
   * Find TODO/FIXME comments
   */
  private async findTodoComments(files: string[], projectPath: string): Promise<any[]> {
    const issues: any[] = [];

    // Analyze a subset for performance
    const filesToAnalyze = files.slice(0, 100);

    for (const file of filesToAnalyze) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const lines = content.split('\n');

        for (const { pattern, type } of TODO_PATTERNS) {
          let match;
          pattern.lastIndex = 0; // Reset regex

          while ((match = pattern.exec(content)) !== null) {
            const lineNumber = content.substring(0, match.index).split('\n').length;
            const todoType = match[1].toUpperCase();
            const description = match[2]?.trim() || 'No description';

            issues.push({
              type: 'documentation',
              file: relative(projectPath, file),
              message: `${todoType}: ${description}`,
              severity: todoType === 'FIXME' || todoType === 'BUG' ? 'high' : 'medium',
              line: lineNumber,
              score: todoType === 'FIXME' || todoType === 'BUG' ? 15 : 5,
            });
          }
        }
      } catch (error) {
        // Skip files that can't be read
        continue;
      }
    }

    return issues;
  }

  /**
   * Detect code smells
   */
  private async detectCodeSmells(files: string[], projectPath: string): Promise<any[]> {
    const issues: any[] = [];

    // Analyze a subset for performance
    const filesToAnalyze = files.slice(0, 100);

    for (const file of filesToAnalyze) {
      try {
        const content = await fs.readFile(file, 'utf-8');

        for (const { pattern, category, description } of CODE_SMELL_PATTERNS) {
          const matches = content.match(pattern);

          if (matches && matches.length > 0) {
            const lineNumber = content.indexOf(matches[0])
              ? content.substring(0, content.indexOf(matches[0])).split('\n').length
              : 1;

            issues.push({
              type: category,
              file: relative(projectPath, file),
              message: `${description} (${matches.length} occurrences)`,
              severity: category.includes('security') ? 'critical' : 'medium',
              line: lineNumber,
              score: matches.length * (category.includes('security') ? 20 : 5),
            });
          }
        }
      } catch (error) {
        // Skip files that can't be read
        continue;
      }
    }

    return issues;
  }

  /**
   * Find deprecated pattern usage
   */
  private async findDeprecatedUsage(files: string[], projectPath: string): Promise<any[]> {
    const issues: any[] = [];

    // Analyze a subset for performance
    const filesToAnalyze = files.slice(0, 100);

    for (const file of filesToAnalyze) {
      try {
        const content = await fs.readFile(file, 'utf-8');

        for (const { pattern, category, description } of DEPRECATED_PATTERNS) {
          const matches = content.match(pattern);

          if (matches && matches.length > 0) {
            const lineNumber = content.indexOf(matches[0])
              ? content.substring(0, content.indexOf(matches[0])).split('\n').length
              : 1;

            issues.push({
              type: category,
              file: relative(projectPath, file),
              message: `${description} (${matches.length} occurrences)`,
              severity: 'low',
              line: lineNumber,
              score: matches.length * 3,
            });
          }
        }
      } catch (error) {
        // Skip files that can't be read
        continue;
      }
    }

    return issues;
  }

  /**
   * Calculate maintainability metrics
   */
  private async calculateMetrics(files: string[]): Promise<TechnicalDebtAnalysis['metrics']> {
    let totalLines = 0;
    let totalComplexity = 0;
    let fileCount = 0;

    // Analyze a subset for performance
    const filesToAnalyze = files.slice(0, 100);

    for (const file of filesToAnalyze) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const lines = content.split('\n').length;
        const complexity = this.calculateCyclomaticComplexity(content);

        totalLines += lines;
        totalComplexity += complexity;
        fileCount++;
      } catch (error) {
        // Skip files that can't be read
        continue;
      }
    }

    const avgComplexity = fileCount > 0 ? totalComplexity / fileCount : 0;
    const maintainabilityIndex = this.calculateMaintainabilityIndex(avgComplexity, totalLines);

    return {
      codeComplexity: Math.round(avgComplexity * 10) / 10,
      maintainabilityIndex: Math.round(maintainabilityIndex * 10) / 10,
    };
  }

  /**
   * Calculate maintainability index
   */
  private calculateMaintainabilityIndex(avgComplexity: number, totalLines: number): number {
    // Simplified maintainability index calculation
    // Real calculation would include Halstead metrics and other factors
    const complexityFactor = Math.max(0, 100 - avgComplexity * 3);
    const sizeFactor = Math.max(0, 100 - Math.log10(totalLines + 1) * 10);

    return (complexityFactor + sizeFactor) / 2;
  }

  /**
   * Categorize all debt issues into categories
   */
  private categorizeDebt(issues: any[]): TechnicalDebtAnalysis['categories'] {
    const categoryMap = new Map<string, {
      count: number;
      severity: 'low' | 'medium' | 'high' | 'critical';
      examples: string[];
      totalScore: number;
    }>();

    for (const issue of issues) {
      const category = issue.type;
      if (!categoryMap.has(category)) {
        categoryMap.set(category, {
          count: 0,
          severity: 'low',
          examples: [],
          totalScore: 0,
        });
      }

      const categoryInfo = categoryMap.get(category)!;
      categoryInfo.count++;
      categoryInfo.totalScore += issue.score || 1;

      // Update severity to highest found
      const severityOrder = { 'low': 0, 'medium': 1, 'high': 2, 'critical': 3 };
      if (severityOrder[issue.severity] > severityOrder[categoryInfo.severity]) {
        categoryInfo.severity = issue.severity;
      }

      // Add example (limit to 3)
      if (categoryInfo.examples.length < 3) {
        categoryInfo.examples.push(`${issue.file}:${issue.line} - ${issue.message}`);
      }
    }

    return Array.from(categoryMap.entries()).map(([category, info]) => ({
      category: category as TechnicalDebtAnalysis['categories'][0]['category'],
      count: info.count,
      severity: info.severity,
      examples: info.examples,
      estimatedEffort: this.estimateEffort(info.count, info.severity),
    }));
  }

  /**
   * Estimate effort to fix issues
   */
  private estimateEffort(count: number, severity: string): string {
    const baseHours = count * (severity === 'critical' ? 4 : severity === 'high' ? 2 : severity === 'medium' ? 1 : 0.5);

    if (baseHours < 2) return '1-2 hours';
    if (baseHours < 8) return '1 day';
    if (baseHours < 40) return '1 week';
    if (baseHours < 160) return '1 month';
    return '3+ months';
  }

  /**
   * Identify files with highest technical debt (hotspots)
   */
  private async identifyHotspots(files: string[], projectPath: string, issues: any[]): Promise<TechnicalDebtAnalysis['hotspots']> {
    const fileScores = new Map<string, { score: number; issues: string[]; loc: number; lastModified?: Date }>();

    // Aggregate scores by file
    for (const issue of issues) {
      const file = issue.file;
      if (!fileScores.has(file)) {
        fileScores.set(file, { score: 0, issues: [], loc: 0 });
      }
      const fileInfo = fileScores.get(file)!;
      fileInfo.score += issue.score || 1;
      fileInfo.issues.push(issue.message);
    }

    // Add file metadata
    for (const [file, info] of fileScores.entries()) {
      try {
        const fullPath = join(projectPath, file);
        const content = await fs.readFile(fullPath, 'utf-8');
        info.loc = content.split('\n').length;

        const stats = await fs.stat(fullPath);
        info.lastModified = stats.mtime;
      } catch (error) {
        // Skip if can't read file stats
      }
    }

    // Sort by score and return top hotspots
    return Array.from(fileScores.entries())
      .sort(([,a], [,b]) => b.score - a.score)
      .slice(0, 10)
      .map(([path, info]) => ({
        path,
        score: Math.min(100, Math.round(info.score)),
        issues: info.issues.slice(0, 5), // Limit to top 5 issues
        loc: info.loc,
        lastModified: info.lastModified,
      }));
  }

  /**
   * Calculate overall technical debt score
   */
  private calculateDebtScore(categories: TechnicalDebtAnalysis['categories']): number {
    let totalScore = 0;
    let weightedIssues = 0;

    for (const category of categories) {
      const weight = category.severity === 'critical' ? 4 :
                    category.severity === 'high' ? 3 :
                    category.severity === 'medium' ? 2 : 1;

      weightedIssues += category.count * weight;
    }

    // Normalize to 0-100 scale
    totalScore = Math.min(100, Math.log10(weightedIssues + 1) * 25);

    return Math.round(totalScore);
  }

  /**
   * Create empty analysis for projects with no detectable technical debt
   */
  private createEmptyAnalysis(): TechnicalDebtAnalysis {
    return {
      totalScore: 0,
      categories: [],
      hotspots: [],
      metrics: {
        codeComplexity: 0,
        maintainabilityIndex: 100,
      },
    };
  }
}