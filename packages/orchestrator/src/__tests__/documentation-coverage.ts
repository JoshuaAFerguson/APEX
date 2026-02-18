#!/usr/bin/env node

/**
 * Documentation Coverage Validation Script
 *
 * This script validates that the JSDoc documentation meets the acceptance criteria:
 * - TaskStore class has JSDoc with @example
 * - All public methods have @param and @returns tags
 * - ToolActionStore class is fully documented
 * - Constructor and initialization methods documented
 */

import * as fs from 'fs';
import * as path from 'path';

interface DocumentationCheck {
  name: string;
  passed: boolean;
  details?: string;
}

function validateDocumentation(): DocumentationCheck[] {
  const storeFilePath = path.join(__dirname, '..', 'store.ts');
  const storeContent = fs.readFileSync(storeFilePath, 'utf8');

  const checks: DocumentationCheck[] = [];

  // Check 1: TaskStore class has JSDoc with @example
  const taskStoreClassDoc = storeContent.match(/\/\*\*[\s\S]*?\*\/\s*export class TaskStore/);
  checks.push({
    name: 'TaskStore class has JSDoc with @example',
    passed: !!(taskStoreClassDoc && taskStoreClassDoc[0].includes('@example')),
    details: taskStoreClassDoc ? 'Found class documentation' : 'Missing class documentation'
  });

  // Check 2: TaskStore constructor documented
  const taskStoreConstructor = storeContent.match(/\/\*\*[\s\S]*?\*\/\s*constructor\s*\(\s*projectPath:\s*string/);
  checks.push({
    name: 'TaskStore constructor has @param documentation',
    passed: !!(taskStoreConstructor && taskStoreConstructor[0].includes('@param')),
    details: taskStoreConstructor ? 'Found constructor documentation' : 'Missing constructor documentation'
  });

  // Check 3: TaskStore initialize method documented
  const initializeMethod = storeContent.match(/\/\*\*[\s\S]*?\*\/\s*async initialize/);
  checks.push({
    name: 'TaskStore initialize method has @returns',
    passed: !!(initializeMethod && initializeMethod[0].includes('@returns')),
    details: initializeMethod ? 'Found initialize documentation' : 'Missing initialize documentation'
  });

  // Check 4: Core public methods documented
  const coreMethods = ['createTask', 'getTask', 'updateTask', 'updateTaskStatus', 'listTasks'];
  coreMethods.forEach(methodName => {
    const methodPattern = new RegExp(`\\/\\*\\*[\\s\\S]*?\\*\\/\\s*(async\\s+)?${methodName}\\s*\\(`);
    const methodMatch = storeContent.match(methodPattern);
    const hasParams = methodMatch && methodMatch[0].includes('@param');
    const hasReturns = methodMatch && methodMatch[0].includes('@returns');

    checks.push({
      name: `${methodName} method has @param and @returns`,
      passed: !!(hasParams && hasReturns),
      details: `@param: ${hasParams ? 'yes' : 'no'}, @returns: ${hasReturns ? 'yes' : 'no'}`
    });
  });

  // Check 5: ToolActionStore class documented
  const toolStoreClassDoc = storeContent.match(/\/\*\*[\s\S]*?\*\/\s*export class ToolActionStore/);
  checks.push({
    name: 'ToolActionStore class has JSDoc with @example',
    passed: !!(toolStoreClassDoc && toolStoreClassDoc[0].includes('@example')),
    details: toolStoreClassDoc ? `Found ${toolStoreClassDoc[0].length} chars of documentation` : 'Missing class documentation'
  });

  // Check 6: ToolActionStore constructor documented
  const toolStoreConstructor = storeContent.match(/\/\*\*[\s\S]*?\*\/\s*constructor\s*\(\s*taskStore:\s*TaskStore/);
  checks.push({
    name: 'ToolActionStore constructor has @param documentation',
    passed: !!(toolStoreConstructor && toolStoreConstructor[0].includes('@param')),
    details: toolStoreConstructor ? 'Found constructor documentation' : 'Missing constructor documentation'
  });

  // Check 7: ToolActionStore key methods documented
  const toolMethods = ['recordToolAction', 'createFileSnapshot'];
  toolMethods.forEach(methodName => {
    const methodPattern = new RegExp(`\\/\\*\\*[\\s\\S]*?\\*\\/[\\s\\S]*?${methodName}\\s*\\(`);
    const methodMatch = storeContent.match(methodPattern);

    checks.push({
      name: `${methodName} method has documentation`,
      passed: !!(methodMatch && methodMatch[0].length > 50),
      details: methodMatch ? `Found ${methodMatch[0].length} chars of documentation` : 'Missing documentation'
    });
  });

  return checks;
}

function generateCoverageReport(): string {
  const checks = validateDocumentation();
  const passedChecks = checks.filter(c => c.passed).length;
  const totalChecks = checks.length;
  const coveragePercent = Math.round((passedChecks / totalChecks) * 100);

  let report = `
# JSDoc Documentation Coverage Report

## Summary
- **Total Checks**: ${totalChecks}
- **Passed**: ${passedChecks}
- **Failed**: ${totalChecks - passedChecks}
- **Coverage**: ${coveragePercent}%

## Detailed Results

`;

  checks.forEach(check => {
    const status = check.passed ? '✅ PASS' : '❌ FAIL';
    report += `### ${status} ${check.name}\n`;
    if (check.details) {
      report += `   ${check.details}\n`;
    }
    report += '\n';
  });

  if (coveragePercent >= 80) {
    report += `## 🎉 Documentation Quality: Excellent (${coveragePercent}%)\n`;
    report += `The JSDoc documentation meets the acceptance criteria.\n`;
  } else {
    report += `## ⚠️ Documentation Quality: Needs Improvement (${coveragePercent}%)\n`;
    report += `Some documentation requirements are not met.\n`;
  }

  return report;
}

// Export for use in tests
export { validateDocumentation, generateCoverageReport };

// CLI usage
if (require.main === module) {
  const report = generateCoverageReport();
  console.log(report);

  const checks = validateDocumentation();
  const allPassed = checks.every(c => c.passed);
  process.exit(allPassed ? 0 : 1);
}