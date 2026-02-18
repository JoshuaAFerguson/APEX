#!/usr/bin/env ts-node
/**
 * JSDoc Coverage Report Generator
 *
 * Analyzes TypeScript source files to generate a coverage report of JSDoc documentation.
 * Reports on exports that are missing JSDoc comments and validates existing JSDoc formatting.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as glob from 'fast-glob';

interface JSDocIssue {
  file: string;
  line: number;
  export: string;
  type: 'missing' | 'malformed' | 'incomplete';
  message: string;
}

interface CoverageReport {
  totalExports: number;
  documentedExports: number;
  coverage: number;
  issues: JSDocIssue[];
}

/**
 * Extract exports and their JSDoc documentation from a TypeScript file
 */
async function analyzeFile(filePath: string): Promise<JSDocIssue[]> {
  const content = await fs.readFile(filePath, 'utf-8');
  const lines = content.split('\n');
  const issues: JSDocIssue[] = [];

  const exportRegex = /^export\s+(class|interface|function|const|type|enum)\s+([A-Za-z_$][A-Za-z0-9_$]*)/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(exportRegex);

    if (match) {
      const exportType = match[1];
      const exportName = match[2];

      // Look for JSDoc comment in preceding lines
      let hasJSDoc = false;
      let jsDocStartLine = -1;

      // Look backwards for JSDoc comment
      for (let j = i - 1; j >= Math.max(0, i - 10); j--) {
        const prevLine = lines[j].trim();

        // Skip empty lines
        if (prevLine === '') continue;

        // If we hit non-comment content, stop looking
        if (!prevLine.startsWith('*') && !prevLine.startsWith('/**') && !prevLine.startsWith('//')) {
          break;
        }

        // Found JSDoc start
        if (prevLine.startsWith('/**')) {
          hasJSDoc = true;
          jsDocStartLine = j;
          break;
        }
      }

      if (!hasJSDoc) {
        issues.push({
          file: filePath,
          line: i + 1,
          export: exportName,
          type: 'missing',
          message: `${exportType} '${exportName}' is missing JSDoc documentation`
        });
      } else {
        // Validate JSDoc quality
        const jsDocLines = [];
        for (let j = jsDocStartLine; j < i; j++) {
          jsDocLines.push(lines[j]);
        }
        const jsDocContent = jsDocLines.join('\n');

        // Check for minimal JSDoc requirements
        if (!jsDocContent.includes('*') || jsDocContent.trim().length < 20) {
          issues.push({
            file: filePath,
            line: jsDocStartLine + 1,
            export: exportName,
            type: 'incomplete',
            message: `JSDoc for ${exportType} '${exportName}' is too brief or malformed`
          });
        }
      }
    }
  }

  return issues;
}

/**
 * Generate JSDoc coverage report for all packages
 */
async function generateCoverageReport(): Promise<CoverageReport> {
  const sourceFiles = await glob([
    'packages/*/src/**/*.ts',
    '!packages/*/src/**/*.test.ts',
    '!packages/*/src/**/__tests__/**',
  ], {
    cwd: path.resolve(__dirname, '..'),
    absolute: true
  });

  let allIssues: JSDocIssue[] = [];
  let totalExports = 0;

  for (const file of sourceFiles) {
    const issues = await analyzeFile(file);
    allIssues = allIssues.concat(issues);

    // Count total exports in this file
    const content = await fs.readFile(file, 'utf-8');
    const exportMatches = content.match(/^export\s+(class|interface|function|const|type|enum)/gm);
    totalExports += exportMatches?.length || 0;
  }

  const missingDocs = allIssues.filter(issue => issue.type === 'missing').length;
  const documentedExports = totalExports - missingDocs;
  const coverage = totalExports > 0 ? (documentedExports / totalExports) * 100 : 100;

  return {
    totalExports,
    documentedExports,
    coverage,
    issues: allIssues
  };
}

/**
 * Print the coverage report to console
 */
function printReport(report: CoverageReport): void {
  console.log('\n📊 JSDoc Coverage Report');
  console.log('========================\n');

  console.log(`Total Exports: ${report.totalExports}`);
  console.log(`Documented Exports: ${report.documentedExports}`);
  console.log(`Coverage: ${report.coverage.toFixed(1)}%\n`);

  if (report.issues.length > 0) {
    console.log('📋 Issues Found:\n');

    const issuesByType = {
      missing: report.issues.filter(i => i.type === 'missing'),
      incomplete: report.issues.filter(i => i.type === 'incomplete'),
      malformed: report.issues.filter(i => i.type === 'malformed')
    };

    for (const [type, issues] of Object.entries(issuesByType)) {
      if (issues.length > 0) {
        console.log(`\n${type.toUpperCase()} (${issues.length}):`);
        for (const issue of issues) {
          const relativePath = path.relative(process.cwd(), issue.file);
          console.log(`  📄 ${relativePath}:${issue.line} - ${issue.message}`);
        }
      }
    }
  } else {
    console.log('✅ All exports are properly documented!');
  }

  console.log('\n');

  // Exit with error code if coverage is below threshold
  const threshold = 85;
  if (report.coverage < threshold) {
    console.error(`❌ Coverage ${report.coverage.toFixed(1)}% is below threshold ${threshold}%`);
    process.exit(1);
  } else {
    console.log(`✅ Coverage ${report.coverage.toFixed(1)}% meets threshold ${threshold}%`);
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    console.log('Analyzing JSDoc coverage...');
    const report = await generateCoverageReport();
    printReport(report);
  } catch (error) {
    console.error('Error generating JSDoc coverage report:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}