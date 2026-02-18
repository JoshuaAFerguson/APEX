#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Documentation Coverage Validation Script
 */
function validateDocumentation() {
  const storeFilePath = path.join(__dirname, 'src', 'store.ts');
  const storeContent = fs.readFileSync(storeFilePath, 'utf8');

  const checks = [];

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

  return checks;
}

function generateCoverageReport() {
  const checks = validateDocumentation();
  const passedChecks = checks.filter(c => c.passed).length;
  const totalChecks = checks.length;
  const coveragePercent = Math.round((passedChecks / totalChecks) * 100);

  console.log('\n# JSDoc Documentation Coverage Report\n');
  console.log('## Summary');
  console.log(`- **Total Checks**: ${totalChecks}`);
  console.log(`- **Passed**: ${passedChecks}`);
  console.log(`- **Failed**: ${totalChecks - passedChecks}`);
  console.log(`- **Coverage**: ${coveragePercent}%\n`);

  console.log('## Detailed Results\n');

  checks.forEach(check => {
    const status = check.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`### ${status} ${check.name}`);
    if (check.details) {
      console.log(`   ${check.details}`);
    }
    console.log('');
  });

  if (coveragePercent >= 80) {
    console.log(`## 🎉 Documentation Quality: Excellent (${coveragePercent}%)`);
    console.log(`The JSDoc documentation meets the acceptance criteria.`);
  } else {
    console.log(`## ⚠️ Documentation Quality: Needs Improvement (${coveragePercent}%)`);
    console.log(`Some documentation requirements are not met.`);
  }

  return {
    totalChecks,
    passedChecks,
    coveragePercent,
    allPassed: checks.every(c => c.passed)
  };
}

// Run the validation
const result = generateCoverageReport();
process.exit(result.allPassed ? 0 : 1);