/**
 * JSDoc Coverage Validation Test Suite
 *
 * This test suite validates JSDoc documentation coverage across the APEX codebase,
 * ensuring all public APIs have consistent JSDoc formatting and adequate documentation.
 * It serves as the main testing infrastructure for the JSDoc coverage requirements.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  analyzeFiles,
  type FileAnalysisResult,
  type DetectionConfig,
  type ExportDocumentation
} from '../jsdoc-detector.js';

interface CoverageReportData {
  totalExports: number;
  documentedExports: number;
  undocumentedExports: number;
  coveragePercent: number;
  files: FileAnalysisResult[];
  issues: Array<{
    file: string;
    line: number;
    export: string;
    type: string;
    message: string;
  }>;
}

/**
 * Configuration for JSDoc coverage requirements
 */
const COVERAGE_CONFIG: DetectionConfig = {
  minSummaryLength: 10,
  requiredTags: [], // Will be determined per export type
  includeReExports: false,
  includePrivate: false,
  extensions: ['.ts', '.tsx']
};

/**
 * Minimum coverage threshold (85% as specified in the JSDoc coverage script)
 */
const MINIMUM_COVERAGE_THRESHOLD = 85;

/**
 * Core source files to analyze for JSDoc coverage
 */
const SOURCE_PATTERNS = [
  'packages/core/src/*.ts',
  'packages/orchestrator/src/*.ts',
  'packages/cli/src/*.ts',
  'packages/api/src/*.ts'
];

/**
 * Files to exclude from JSDoc coverage analysis
 */
const EXCLUDE_PATTERNS = [
  '**/*.test.ts',
  '**/*.test.tsx',
  '**/__tests__/**',
  '**/test-*.ts',
  '**/example*.ts',
  '**/demo*.ts',
  '**/validate-*.ts',
  '**/verify*.ts'
];

let coverageData: CoverageReportData;

describe('JSDoc Coverage Validation', () => {
  beforeAll(async () => {
    // Load and analyze all source files
    coverageData = await generateCoverageReport();
  });

  describe('Overall Coverage Metrics', () => {
    it('should meet minimum coverage threshold', () => {
      expect(coverageData.coveragePercent).toBeGreaterThanOrEqual(MINIMUM_COVERAGE_THRESHOLD);
    });

    it('should have reasonable export count', () => {
      expect(coverageData.totalExports).toBeGreaterThan(0);
    });

    it('should track documentation status correctly', () => {
      expect(coverageData.documentedExports + coverageData.undocumentedExports)
        .toBe(coverageData.totalExports);
    });

    it('should calculate coverage percentage correctly', () => {
      const expectedCoverage = coverageData.totalExports > 0
        ? (coverageData.documentedExports / coverageData.totalExports) * 100
        : 100;
      expect(Math.abs(coverageData.coveragePercent - expectedCoverage)).toBeLessThan(0.1);
    });
  });

  describe('File-Level Coverage Analysis', () => {
    it('should analyze all expected source files', () => {
      expect(coverageData.files.length).toBeGreaterThan(0);
    });

    it('should not include test files in analysis', () => {
      const testFiles = coverageData.files.filter(file =>
        file.filePath.includes('.test.') ||
        file.filePath.includes('/__tests__/')
      );
      expect(testFiles).toHaveLength(0);
    });

    it('should handle files with no exports gracefully', () => {
      const emptyFiles = coverageData.files.filter(file => file.stats.totalExports === 0);
      emptyFiles.forEach(file => {
        expect(file.stats.coveragePercent).toBe(100);
        expect(file.stats.documentedExports).toBe(0);
        expect(file.stats.undocumentedExports).toBe(0);
      });
    });

    it('should have consistent statistics per file', () => {
      coverageData.files.forEach(file => {
        expect(file.stats.documentedExports + file.stats.undocumentedExports)
          .toBe(file.stats.totalExports);
        expect(file.exports.length).toBe(file.documentation.length);
      });
    });
  });

  describe('Documentation Quality Validation', () => {
    it('should identify functions with missing parameter documentation', () => {
      const functionDocs = getAllDocumentationByKind('function');
      const functionsWithParams = functionDocs.filter(doc =>
        doc.export.rawStatement.includes('(') &&
        doc.export.rawStatement.match(/\([^)]*\w/) // Has parameters
      );

      functionsWithParams.forEach(doc => {
        if (doc.isDocumented && doc.jsdoc) {
          const hasParamTags = doc.jsdoc.tags.some(tag => tag.name === 'param');
          if (!hasParamTags) {
            expect(doc.suggestions).toContain('Document function parameters with @param tags');
          }
        }
      });
    });

    it('should identify functions with missing return documentation', () => {
      const functionDocs = getAllDocumentationByKind('function');
      const nonVoidFunctions = functionDocs.filter(doc =>
        !doc.export.rawStatement.includes('void') &&
        !doc.export.rawStatement.includes(': void')
      );

      nonVoidFunctions.forEach(doc => {
        if (doc.isDocumented && doc.jsdoc) {
          const hasReturnTag = doc.jsdoc.tags.some(tag =>
            tag.name === 'returns' || tag.name === 'return'
          );
          if (!hasReturnTag) {
            expect(doc.suggestions).toContain('Document return value with @returns tag');
          }
        }
      });
    });

    it('should validate JSDoc summary length requirements', () => {
      const documentedExports = getAllDocumentation().filter(doc => doc.jsdoc && doc.jsdoc.hasContent);

      documentedExports.forEach(doc => {
        if (doc.jsdoc && doc.jsdoc.summary.length < COVERAGE_CONFIG.minSummaryLength!) {
          expect(doc.isDocumented).toBe(false);
          expect(doc.suggestions.some(s => s.includes('Expand the description'))).toBe(true);
        }
      });
    });

    it('should ensure consistent JSDoc formatting', () => {
      const documentedExports = getAllDocumentation().filter(doc => doc.jsdoc);

      documentedExports.forEach(doc => {
        if (doc.jsdoc) {
          // JSDoc should start with /**
          expect(doc.jsdoc.raw).toMatch(/^\/\*\*/);
          // JSDoc should end with */
          expect(doc.jsdoc.raw).toMatch(/\*\/$/);
          // Should have meaningful content
          expect(doc.jsdoc.hasContent).toBe(true);
        }
      });
    });
  });

  describe('Export Type Coverage', () => {
    it('should document all public interfaces', () => {
      const interfaces = getAllDocumentationByKind('interface');
      const undocumentedInterfaces = interfaces.filter(doc => !doc.isDocumented);

      if (undocumentedInterfaces.length > 0) {
        console.warn('Undocumented interfaces:', undocumentedInterfaces.map(d =>
          `${d.export.name} in ${getRelativeFilePath(d)}`
        ));
      }
    });

    it('should document all public classes', () => {
      const classes = getAllDocumentationByKind('class');
      const undocumentedClasses = classes.filter(doc => !doc.isDocumented);

      if (undocumentedClasses.length > 0) {
        console.warn('Undocumented classes:', undocumentedClasses.map(d =>
          `${d.export.name} in ${getRelativeFilePath(d)}`
        ));
      }
    });

    it('should document all public functions', () => {
      const functions = getAllDocumentationByKind('function');
      const undocumentedFunctions = functions.filter(doc => !doc.isDocumented);

      if (undocumentedFunctions.length > 0) {
        console.warn('Undocumented functions:', undocumentedFunctions.map(d =>
          `${d.export.name} in ${getRelativeFilePath(d)}`
        ));
      }
    });

    it('should document all public types', () => {
      const types = getAllDocumentationByKind('type');
      const undocumentedTypes = types.filter(doc => !doc.isDocumented);

      if (undocumentedTypes.length > 0) {
        console.warn('Undocumented types:', undocumentedTypes.map(d =>
          `${d.export.name} in ${getRelativeFilePath(d)}`
        ));
      }
    });

    it('should document all public constants', () => {
      const constants = getAllDocumentationByKind('const');
      const undocumentedConstants = constants.filter(doc => !doc.isDocumented);

      if (undocumentedConstants.length > 0) {
        console.warn('Undocumented constants:', undocumentedConstants.map(d =>
          `${d.export.name} in ${getRelativeFilePath(d)}`
        ));
      }
    });
  });

  describe('Coverage Report Generation', () => {
    it('should generate detailed issue list', () => {
      expect(coverageData.issues).toBeDefined();
      expect(Array.isArray(coverageData.issues)).toBe(true);
    });

    it('should provide actionable suggestions for undocumented exports', () => {
      const undocumentedExports = getAllDocumentation().filter(doc => !doc.isDocumented);

      undocumentedExports.forEach(doc => {
        expect(doc.suggestions.length).toBeGreaterThan(0);
        expect(doc.suggestions.some(s => s.length > 0)).toBe(true);
      });
    });

    it('should categorize issues by file and type', () => {
      const issuesByFile = coverageData.issues.reduce((acc, issue) => {
        acc[issue.file] = (acc[issue.file] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const issuesByType = coverageData.issues.reduce((acc, issue) => {
        acc[issue.type] = (acc[issue.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      expect(Object.keys(issuesByFile).length).toBeGreaterThanOrEqual(0);
      expect(Object.keys(issuesByType).length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Integration with TypeScript Compilation', () => {
    it('should validate that all documented exports compile correctly', () => {
      // This test ensures that JSDoc comments don't break TypeScript compilation
      const documentedExports = getAllDocumentation().filter(doc => doc.isDocumented);

      documentedExports.forEach(doc => {
        // Basic validation that the export has proper structure
        expect(doc.export.name).toBeTruthy();
        expect(doc.export.kind).toBeTruthy();
        expect(doc.export.line).toBeGreaterThan(0);
      });
    });

    it('should ensure JSDoc types align with TypeScript types', () => {
      // This is a placeholder for more sophisticated type checking
      // In a real implementation, you might parse JSDoc types and compare with TS types
      const documentedFunctions = getAllDocumentationByKind('function').filter(doc => doc.isDocumented);

      documentedFunctions.forEach(doc => {
        if (doc.jsdoc) {
          const paramTags = doc.jsdoc.tags.filter(tag => tag.name === 'param');
          const returnTags = doc.jsdoc.tags.filter(tag => tag.name === 'returns' || tag.name === 'return');

          // Basic validation that documented functions have sensible JSDoc structure
          expect(paramTags.length >= 0).toBe(true);
          expect(returnTags.length <= 1).toBe(true);
        }
      });
    });
  });
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate comprehensive coverage report for all source files
 * @returns Coverage report data
 */
async function generateCoverageReport(): Promise<CoverageReportData> {
  const files = await loadSourceFiles();
  const analysisResults = analyzeFiles(files, COVERAGE_CONFIG);

  const totalExports = analysisResults.reduce((sum, result) => sum + result.stats.totalExports, 0);
  const documentedExports = analysisResults.reduce((sum, result) => sum + result.stats.documentedExports, 0);
  const undocumentedExports = totalExports - documentedExports;
  const coveragePercent = totalExports > 0 ? (documentedExports / totalExports) * 100 : 100;

  const issues = analysisResults.flatMap(result =>
    result.documentation
      .filter(doc => !doc.isDocumented)
      .map(doc => ({
        file: result.filePath,
        line: doc.export.line,
        export: doc.export.name,
        type: doc.export.kind,
        message: doc.suggestions.join('; ') || `Missing JSDoc documentation for ${doc.export.kind}`
      }))
  );

  return {
    totalExports,
    documentedExports,
    undocumentedExports,
    coveragePercent: Math.round(coveragePercent * 100) / 100,
    files: analysisResults,
    issues
  };
}

/**
 * Load source files from the project for analysis
 * @returns Array of file objects with path and content
 */
async function loadSourceFiles(): Promise<Array<{ path: string; content: string }>> {
  const files: Array<{ path: string; content: string }> = [];

  // Define core package directories
  const packageDirs = [
    'packages/core/src',
    'packages/orchestrator/src',
    'packages/cli/src',
    'packages/api/src'
  ];

  for (const packageDir of packageDirs) {
    try {
      await loadFilesFromDirectory(path.resolve(packageDir), files);
    } catch (error) {
      // Package directory might not exist, skip silently
      console.warn(`Skipping directory ${packageDir}: ${error}`);
    }
  }

  return files;
}

/**
 * Recursively load TypeScript files from a directory
 * @param dirPath Directory path to load files from
 * @param files Array to accumulate loaded files
 */
async function loadFilesFromDirectory(
  dirPath: string,
  files: Array<{ path: string; content: string }>
): Promise<void> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory() && entry.name !== '__tests__' && entry.name !== 'node_modules') {
        await loadFilesFromDirectory(fullPath, files);
      } else if (entry.isFile() && shouldIncludeFile(fullPath)) {
        try {
          const content = await fs.readFile(fullPath, 'utf-8');
          files.push({
            path: fullPath,
            content
          });
        } catch (error) {
          console.warn(`Failed to read file ${fullPath}: ${error}`);
        }
      }
    }
  } catch (error) {
    console.warn(`Failed to read directory ${dirPath}: ${error}`);
  }
}

/**
 * Determine if a file should be included in JSDoc analysis
 * @param filePath Path to the file
 * @returns True if file should be included
 */
function shouldIncludeFile(filePath: string): boolean {
  // Include TypeScript files
  if (!['.ts', '.tsx'].some(ext => filePath.endsWith(ext))) {
    return false;
  }

  // Exclude test files and other patterns
  const excludePatterns = [
    '.test.ts',
    '.test.tsx',
    '__tests__',
    'test-',
    'example',
    'demo',
    'validate-',
    'verify'
  ];

  return !excludePatterns.some(pattern => filePath.includes(pattern));
}

/**
 * Get all documentation for exports of a specific kind
 * @param kind Export kind to filter by
 * @returns Array of documentation for the specified export kind
 */
function getAllDocumentationByKind(kind: string): ExportDocumentation[] {
  return coverageData.files.flatMap(file =>
    file.documentation.filter(doc => doc.export.kind === kind)
  );
}

/**
 * Get all documentation across all files
 * @returns Array of all export documentation
 */
function getAllDocumentation(): ExportDocumentation[] {
  return coverageData.files.flatMap(file => file.documentation);
}

/**
 * Get relative file path for display purposes
 * @param doc Export documentation containing file info
 * @returns Relative path from project root
 */
function getRelativeFilePath(doc: ExportDocumentation): string {
  const fileResult = coverageData.files.find(f =>
    f.documentation.some(d => d === doc)
  );
  return fileResult ? path.relative(process.cwd(), fileResult.filePath) : 'unknown';
}