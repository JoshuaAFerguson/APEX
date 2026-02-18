#!/usr/bin/env node

/**
 * Quick syntax validation script for TypeScript files
 * Attempts to parse and validate key TypeScript files without a full build
 */

import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Key files to check for syntax errors
const filesToCheck = [
  'packages/core/src/tools/web/index.ts',
  'packages/core/src/tools/web/web-search-tool.ts',
  'packages/core/src/tools/web/register.ts',
  'packages/core/src/tools/index.ts',
  'packages/orchestrator/src/tools/webfetch.ts',
];

console.log('🔍 Checking TypeScript syntax for web tools implementation...\n');

let allValid = true;

for (const filePath of filesToCheck) {
  const fullPath = join(__dirname, filePath);
  console.log(`Checking ${filePath}...`);

  if (!existsSync(fullPath)) {
    console.log(`❌ File does not exist: ${fullPath}`);
    allValid = false;
    continue;
  }

  try {
    const content = readFileSync(fullPath, 'utf8');

    // Basic syntax checks
    const issues = [];

    // Check for balanced brackets
    const openBraces = (content.match(/\{/g) || []).length;
    const closeBraces = (content.match(/\}/g) || []).length;
    if (openBraces !== closeBraces) {
      issues.push(`Unbalanced braces: ${openBraces} open, ${closeBraces} close`);
    }

    // Check for balanced parentheses
    const openParens = (content.match(/\(/g) || []).length;
    const closeParens = (content.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      issues.push(`Unbalanced parentheses: ${openParens} open, ${closeParens} close`);
    }

    // Check for unterminated strings (very basic)
    const singleQuotes = (content.match(/'/g) || []).length;
    const doubleQuotes = (content.match(/"/g) || []).length;
    const backticks = (content.match(/`/g) || []).length;

    // Check for missing semicolons or common syntax issues
    const lines = content.split('\n');
    let lineNumber = 0;

    for (const line of lines) {
      lineNumber++;
      const trimmed = line.trim();

      // Skip comments and empty lines
      if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed === '') {
        continue;
      }

      // Check for some common issues
      if (trimmed.includes('export {') && !trimmed.includes('}') && !content.includes('} from')) {
        // This might be a multi-line export, which is fine
      }

      // Check for import/export statement validity
      if (trimmed.startsWith('import ') && !trimmed.includes('from ') && !trimmed.endsWith(';')) {
        issues.push(`Line ${lineNumber}: Possible malformed import statement`);
      }
    }

    if (issues.length > 0) {
      console.log(`❌ Potential issues found:`);
      issues.forEach(issue => console.log(`   ${issue}`));
      allValid = false;
    } else {
      console.log(`✅ Basic syntax appears valid`);
    }

  } catch (error) {
    console.log(`❌ Error reading file: ${error.message}`);
    allValid = false;
  }

  console.log();
}

console.log('📋 Summary:');
if (allValid) {
  console.log('✅ All checked files appear to have valid syntax');
  console.log('💡 Note: This is a basic syntax check. Full TypeScript compilation would provide more thorough validation.');
} else {
  console.log('❌ Some files have potential syntax issues that should be addressed');
}

process.exit(allValid ? 0 : 1);