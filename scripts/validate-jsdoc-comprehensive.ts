#!/usr/bin/env ts-node

/**
 * Comprehensive JSDoc Coverage Validation Tool
 *
 * This script performs comprehensive JSDoc documentation validation by:
 * 1. Running TypeScript compilation with strict settings to validate JSDoc types
 * 2. Analyzing all public APIs for JSDoc coverage and consistency
 * 3. Generating detailed coverage reports with formatting guidelines
 * 4. Providing actionable suggestions for improvement
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as glob from 'fast-glob';
import { exec } from 'child_process';
import { promisify } from 'util';
import { analyzeFile, type FileAnalysisResult, type ExportInfo, type JSDocInfo } from '../packages/core/src/jsdoc-detector.js';

const execAsync = promisify(exec);

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration for JSDoc validation
 */
interface ValidationConfig {
  /** Minimum coverage percentage required to pass validation */
  minCoverageThreshold: number;
  /** Minimum JSDoc description length in characters */
  minDescriptionLength: number;
  /** Required JSDoc tags for functions */
  requiredFunctionTags: string[];
  /** Required JSDoc tags for classes */
  requiredClassTags: string[];
  /** Whether to validate @param tags for function parameters */
  validateParamTags: boolean;
  /** Whether to validate @returns tags for non-void functions */
  validateReturnTags: boolean;
  /** Whether to include type-only exports in validation */
  includeTypeExports: boolean;
}

/**
 * TypeScript compilation error information
 */
interface TSError {
  file: string;
  line: number;
  column: number;
  message: string;
  code: string;
}

/**
 * JSDoc formatting issues
 */
interface FormattingIssue {
  export: string;
  file: string;
  line: number;
  type: 'missing-period' | 'inconsistent-tags' | 'malformed-param' | 'missing-example' | 'poor-description';
  message: string;
  suggestion: string;
}

/**
 * Comprehensive validation report
 */
interface ValidationReport {
  /** Overall coverage statistics */
  coverageStats: {
    totalExports: number;
    documentedExports: number;
    coveragePercentage: number;
  };
  /** TypeScript compilation results */
  typeScriptValidation: {
    success: boolean;
    errors: TSError[];
  };
  /** Per-file analysis results */
  fileResults: FileAnalysisResult[];
  /** Formatting and consistency issues */
  formattingIssues: FormattingIssue[];
  /** Overall validation result */
  passed: boolean;
  /** Summary of issues found */
  summary: {
    totalIssues: number;
    missingDocumentation: number;
    formattingIssues: number;
    typeScriptErrors: number;
  };
}

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_CONFIG: ValidationConfig = {
  minCoverageThreshold: 85,
  minDescriptionLength: 15,
  requiredFunctionTags: [], // Optional: ['param', 'returns']
  requiredClassTags: [], // Optional: ['example']
  validateParamTags: true,
  validateReturnTags: true,
  includeTypeExports: true,
};

// ============================================================================
// Core Validation Functions
// ============================================================================

/**
 * Run TypeScript compilation with strict JSDoc validation settings
 * @param configPath Path to the TypeScript config file for JSDoc validation
 * @returns Compilation results with any errors found
 */
async function validateTypeScriptCompilation(configPath: string): Promise<{ success: boolean; errors: TSError[] }> {
  try {
    const { stdout, stderr } = await execAsync(`npx tsc --project ${configPath} --noEmit`);

    // If no errors, compilation succeeded
    if (!stderr && !stdout) {
      return { success: true, errors: [] };
    }

    // Parse TypeScript errors
    const errors: TSError[] = [];
    const errorOutput = stderr || stdout;
    const errorLines = errorOutput.split('\n').filter(line => line.trim() !== '');

    for (const line of errorLines) {
      // Parse TS error format: file.ts(line,column): error TSxxxx: message
      const match = line.match(/^(.+)\((\d+),(\d+)\): error (TS\d+): (.+)$/);
      if (match) {
        const [, file, line, column, code, message] = match;
        errors.push({
          file: file.trim(),
          line: parseInt(line, 10),
          column: parseInt(column, 10),
          message: message.trim(),
          code: code.trim(),
        });
      }
    }

    return { success: errors.length === 0, errors };
  } catch (error) {
    console.error('TypeScript compilation failed:', error);
    return {
      success: false,
      errors: [{
        file: 'compilation',
        line: 0,
        column: 0,
        message: error instanceof Error ? error.message : String(error),
        code: 'TS_COMPILE_ERROR'
      }]
    };
  }
}

/**
 * Analyze JSDoc formatting and consistency
 * @param documentation Export documentation to analyze
 * @param filePath Path to the file being analyzed
 * @param config Validation configuration
 * @returns Array of formatting issues found
 */
function analyzeJSDocFormatting(
  documentation: Array<{ export: ExportInfo; jsdoc: JSDocInfo | null; isDocumented: boolean }>,
  filePath: string,
  config: ValidationConfig
): FormattingIssue[] {
  const issues: FormattingIssue[] = [];

  for (const doc of documentation) {
    if (!doc.jsdoc) continue;

    const { export: exportInfo, jsdoc } = doc;

    // Check description quality
    if (jsdoc.summary.length > 0) {
      // Description should end with period (unless it's very short)
      if (jsdoc.summary.length > 10 && !jsdoc.summary.endsWith('.') && !jsdoc.summary.endsWith('!') && !jsdoc.summary.endsWith('?')) {
        issues.push({
          export: exportInfo.name,
          file: filePath,
          line: exportInfo.line,
          type: 'missing-period',
          message: 'JSDoc description should end with proper punctuation',
          suggestion: 'Add a period at the end of the description'
        });
      }

      // Description should be meaningful (not too generic)
      const genericDescriptions = [
        'function',
        'method',
        'class',
        'interface',
        'type',
        'constant',
        'variable'
      ];

      if (jsdoc.summary.length < config.minDescriptionLength ||
          genericDescriptions.some(generic =>
            jsdoc.summary.toLowerCase().includes(`${generic} for`) ||
            jsdoc.summary.toLowerCase().includes(`${generic} to`) ||
            jsdoc.summary.toLowerCase() === generic
          )) {
        issues.push({
          export: exportInfo.name,
          file: filePath,
          line: exportInfo.line,
          type: 'poor-description',
          message: `JSDoc description is too generic or brief (${jsdoc.summary.length} chars)`,
          suggestion: `Provide a more specific description (minimum ${config.minDescriptionLength} characters) explaining what ${exportInfo.name} does and why it's useful`
        });
      }
    }

    // Validate @param tags formatting
    const paramTags = jsdoc.tags.filter(tag => tag.name === 'param');
    for (const paramTag of paramTags) {
      if (!paramTag.paramName || !paramTag.value) {
        issues.push({
          export: exportInfo.name,
          file: filePath,
          line: exportInfo.line,
          type: 'malformed-param',
          message: `@param tag is missing parameter name or description`,
          suggestion: 'Use format: @param {Type} parameterName Description of the parameter'
        });
      }
    }

    // Check for missing @example tag for public functions (optional but recommended)
    if (exportInfo.kind === 'function' && exportInfo.name && !exportInfo.name.startsWith('_')) {
      const hasExampleTag = jsdoc.tags.some(tag => tag.name === 'example');
      if (!hasExampleTag && jsdoc.summary.length > 50) { // Only for substantial functions
        issues.push({
          export: exportInfo.name,
          file: filePath,
          line: exportInfo.line,
          type: 'missing-example',
          message: 'Complex public function would benefit from an @example tag',
          suggestion: 'Consider adding an @example tag showing how to use this function'
        });
      }
    }
  }

  return issues;
}

/**
 * Find all TypeScript source files to analyze
 * @returns Array of file paths to analyze
 */
async function findSourceFiles(): Promise<string[]> {
  const patterns = [
    'packages/*/src/**/*.ts',
    '!packages/*/src/**/*.test.ts',
    '!packages/*/src/**/__tests__/**',
    '!packages/*/src/test-*.ts'
  ];

  const files = await glob(patterns, {
    cwd: path.resolve(__dirname, '..'),
    absolute: true
  });

  return files;
}

/**
 * Perform comprehensive JSDoc validation
 * @param config Validation configuration options
 * @returns Complete validation report
 */
async function performValidation(config: ValidationConfig = DEFAULT_CONFIG): Promise<ValidationReport> {
  console.log('🔍 Starting comprehensive JSDoc validation...\n');

  // Step 1: TypeScript compilation validation
  console.log('📋 Step 1: Validating TypeScript compilation with strict JSDoc settings...');
  const tsConfigPath = path.resolve(__dirname, '..', 'tsconfig.jsdoc-validation.json');
  const tsValidation = await validateTypeScriptCompilation(tsConfigPath);

  if (tsValidation.success) {
    console.log('✅ TypeScript compilation passed\n');
  } else {
    console.log(`❌ TypeScript compilation failed with ${tsValidation.errors.length} errors\n`);
  }

  // Step 2: Find and analyze source files
  console.log('📋 Step 2: Analyzing source files for JSDoc coverage...');
  const sourceFiles = await findSourceFiles();
  console.log(`Found ${sourceFiles.length} source files to analyze`);

  const fileResults: FileAnalysisResult[] = [];
  const allFormattingIssues: FormattingIssue[] = [];
  let totalExports = 0;
  let documentedExports = 0;

  for (const filePath of sourceFiles) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const result = analyzeFile(filePath, content, {
        minSummaryLength: config.minDescriptionLength,
        includeReExports: false,
        includePrivate: false,
      });

      fileResults.push(result);
      totalExports += result.stats.totalExports;
      documentedExports += result.stats.documentedExports;

      // Analyze formatting issues
      const formattingIssues = analyzeJSDocFormatting(result.documentation, filePath, config);
      allFormattingIssues.push(...formattingIssues);

    } catch (error) {
      console.error(`Error analyzing file ${filePath}:`, error);
    }
  }

  console.log(`✅ Analyzed ${fileResults.length} files\n`);

  // Step 3: Calculate coverage and generate report
  const coveragePercentage = totalExports > 0 ? (documentedExports / totalExports) * 100 : 100;
  const passed = tsValidation.success &&
                 coveragePercentage >= config.minCoverageThreshold &&
                 allFormattingIssues.filter(issue => issue.type !== 'missing-example').length === 0;

  const report: ValidationReport = {
    coverageStats: {
      totalExports,
      documentedExports,
      coveragePercentage: Math.round(coveragePercentage * 100) / 100,
    },
    typeScriptValidation: tsValidation,
    fileResults,
    formattingIssues: allFormattingIssues,
    passed,
    summary: {
      totalIssues: tsValidation.errors.length + allFormattingIssues.length + (totalExports - documentedExports),
      missingDocumentation: totalExports - documentedExports,
      formattingIssues: allFormattingIssues.length,
      typeScriptErrors: tsValidation.errors.length,
    },
  };

  return report;
}

/**
 * Print a detailed validation report to the console
 * @param report The validation report to display
 */
function printValidationReport(report: ValidationReport): void {
  console.log('\n📊 JSDoc Coverage & Validation Report');
  console.log('=====================================\n');

  // Coverage Summary
  console.log('📈 Coverage Summary:');
  console.log(`   Total Exports: ${report.coverageStats.totalExports}`);
  console.log(`   Documented: ${report.coverageStats.documentedExports}`);
  console.log(`   Coverage: ${report.coverageStats.coveragePercentage}%`);
  console.log(`   Required: ${DEFAULT_CONFIG.minCoverageThreshold}%\n`);

  // TypeScript Validation
  console.log('🔧 TypeScript Validation:');
  if (report.typeScriptValidation.success) {
    console.log('   ✅ All TypeScript checks passed\n');
  } else {
    console.log(`   ❌ ${report.typeScriptValidation.errors.length} TypeScript errors found:\n`);
    for (const error of report.typeScriptValidation.errors) {
      const relativePath = path.relative(process.cwd(), error.file);
      console.log(`      📄 ${relativePath}:${error.line}:${error.column}`);
      console.log(`         ${error.code}: ${error.message}\n`);
    }
  }

  // Formatting Issues
  if (report.formattingIssues.length > 0) {
    console.log(`📝 Formatting & Style Issues (${report.formattingIssues.length}):\n`);

    const issuesByType = report.formattingIssues.reduce((acc, issue) => {
      if (!acc[issue.type]) acc[issue.type] = [];
      acc[issue.type].push(issue);
      return acc;
    }, {} as Record<string, FormattingIssue[]>);

    for (const [type, issues] of Object.entries(issuesByType)) {
      console.log(`   ${type.toUpperCase().replace('-', ' ')} (${issues.length}):`);
      for (const issue of issues.slice(0, 5)) { // Limit to 5 examples per type
        const relativePath = path.relative(process.cwd(), issue.file);
        console.log(`      📄 ${relativePath}:${issue.line} - ${issue.export}`);
        console.log(`         ${issue.message}`);
        console.log(`         💡 ${issue.suggestion}\n`);
      }
      if (issues.length > 5) {
        console.log(`      ... and ${issues.length - 5} more\n`);
      }
    }
  } else {
    console.log('📝 Formatting & Style: ✅ No issues found\n');
  }

  // Missing Documentation
  const undocumentedExports = report.fileResults.reduce((acc, file) => {
    const undocumented = file.documentation.filter(doc => !doc.isDocumented);
    return acc.concat(undocumented.map(doc => ({ file: file.filePath, export: doc.export })));
  }, [] as Array<{ file: string; export: ExportInfo }>);

  if (undocumentedExports.length > 0) {
    console.log(`📋 Missing Documentation (${undocumentedExports.length}):\n`);

    // Group by file
    const byFile = undocumentedExports.reduce((acc, item) => {
      if (!acc[item.file]) acc[item.file] = [];
      acc[item.file].push(item.export);
      return acc;
    }, {} as Record<string, ExportInfo[]>);

    for (const [file, exports] of Object.entries(byFile)) {
      const relativePath = path.relative(process.cwd(), file);
      console.log(`   📄 ${relativePath}:`);
      for (const exp of exports.slice(0, 10)) { // Limit to 10 per file
        console.log(`      - ${exp.kind} ${exp.name} (line ${exp.line})`);
      }
      if (exports.length > 10) {
        console.log(`      ... and ${exports.length - 10} more exports`);
      }
      console.log();
    }
  }

  // Overall Result
  console.log('🎯 Overall Result:');
  if (report.passed) {
    console.log('   ✅ JSDoc validation PASSED');
    console.log('   All public APIs are properly documented with consistent formatting');
  } else {
    console.log('   ❌ JSDoc validation FAILED');
    console.log(`   Issues found: ${report.summary.totalIssues}`);
    console.log('   Please address the issues above before proceeding');
  }
  console.log();
}

/**
 * Generate a JSON report file with detailed results
 * @param report The validation report
 * @param outputPath Path where to save the JSON report
 */
async function generateJSONReport(report: ValidationReport, outputPath: string): Promise<void> {
  try {
    const jsonReport = {
      ...report,
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    };

    await fs.writeFile(outputPath, JSON.stringify(jsonReport, null, 2), 'utf-8');
    console.log(`📄 Detailed JSON report saved to: ${outputPath}`);
  } catch (error) {
    console.error('Failed to generate JSON report:', error);
  }
}

// ============================================================================
// Main Execution
// ============================================================================

/**
 * Main function - entry point for the validation script
 */
async function main(): Promise<void> {
  try {
    const config = { ...DEFAULT_CONFIG };

    // Parse command line arguments
    const args = process.argv.slice(2);
    let generateJSON = false;
    let jsonOutputPath = 'jsdoc-validation-report.json';

    for (let i = 0; i < args.length; i++) {
      switch (args[i]) {
        case '--json':
          generateJSON = true;
          if (args[i + 1] && !args[i + 1].startsWith('--')) {
            jsonOutputPath = args[i + 1];
            i++; // Skip the next argument
          }
          break;
        case '--threshold':
          if (args[i + 1]) {
            config.minCoverageThreshold = parseInt(args[i + 1], 10);
            i++;
          }
          break;
        case '--help':
          console.log('JSDoc Validation Tool');
          console.log('Usage: validate-jsdoc-comprehensive.ts [options]');
          console.log('');
          console.log('Options:');
          console.log('  --json [path]     Generate JSON report (default: jsdoc-validation-report.json)');
          console.log('  --threshold N     Set minimum coverage threshold (default: 85)');
          console.log('  --help           Show this help message');
          return;
      }
    }

    // Run validation
    const report = await performValidation(config);

    // Print results
    printValidationReport(report);

    // Generate JSON report if requested
    if (generateJSON) {
      await generateJSONReport(report, jsonOutputPath);
    }

    // Exit with appropriate code
    process.exit(report.passed ? 0 : 1);

  } catch (error) {
    console.error('❌ JSDoc validation failed with error:', error);
    process.exit(1);
  }
}

// Run the script if called directly
if (require.main === module) {
  main();
}

export { performValidation, type ValidationReport, type ValidationConfig };