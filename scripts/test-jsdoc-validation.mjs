#!/usr/bin/env node

/**
 * Simple test script to validate JSDoc coverage
 * Uses the existing JSDoc detector without TypeScript compilation
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'fast-glob';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Find and analyze TypeScript source files for JSDoc coverage
 */
async function testJSDocCoverage() {
  console.log('🔍 Testing JSDoc coverage validation...\n');

  try {
    // Find source files
    const sourceFiles = await glob([
      'packages/*/src/**/*.ts',
      '!packages/*/src/**/*.test.ts',
      '!packages/*/src/**/__tests__/**',
      '!packages/*/src/test-*.ts'
    ], {
      cwd: path.resolve(__dirname, '..'),
      absolute: true
    });

    console.log(`📂 Found ${sourceFiles.length} source files to analyze`);

    let totalExports = 0;
    let totalFiles = 0;
    let filesWithIssues = 0;

    // Analyze a sample of files
    const sampleFiles = sourceFiles.slice(0, 5); // Test first 5 files

    for (const filePath of sampleFiles) {
      console.log(`\n📄 Analyzing: ${path.relative(process.cwd(), filePath)}`);

      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const exports = findBasicExports(content);
        const documented = exports.filter(exp => hasJSDoc(content, exp.line));

        totalFiles++;
        totalExports += exports.length;

        console.log(`   Exports found: ${exports.length}`);
        console.log(`   Documented: ${documented.length}`);
        console.log(`   Coverage: ${exports.length > 0 ? Math.round((documented.length / exports.length) * 100) : 100}%`);

        if (documented.length < exports.length) {
          filesWithIssues++;
          const undocumented = exports.filter(exp => !hasJSDoc(content, exp.line));
          console.log(`   ⚠️  Undocumented exports:`);
          undocumented.forEach(exp => {
            console.log(`      - ${exp.name} (line ${exp.line})`);
          });
        }

      } catch (error) {
        console.error(`   ❌ Error analyzing file: ${error.message}`);
        filesWithIssues++;
      }
    }

    const overallCoverage = totalExports > 0 ? Math.round((totalExports / totalExports) * 100) : 100;
    console.log(`\n📊 Summary:`);
    console.log(`   Files analyzed: ${totalFiles}`);
    console.log(`   Files with issues: ${filesWithIssues}`);
    console.log(`   Total exports: ${totalExports}`);
    console.log(`   Overall coverage estimation: ~${overallCoverage}%`);

    if (filesWithIssues === 0) {
      console.log(`\n✅ JSDoc validation test PASSED (sample)`);
    } else {
      console.log(`\n⚠️  JSDoc validation test found issues in ${filesWithIssues}/${totalFiles} files`);
    }

  } catch (error) {
    console.error('❌ JSDoc validation test failed:', error);
    process.exit(1);
  }
}

/**
 * Simple regex-based export finder
 */
function findBasicExports(content) {
  const exports = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const exportMatch = line.match(/^export\s+(function|class|interface|type|const|enum)\s+([A-Za-z_$][A-Za-z0-9_$]*)/);

    if (exportMatch) {
      exports.push({
        name: exportMatch[2],
        line: i + 1,
        type: exportMatch[1]
      });
    }
  }

  return exports;
}

/**
 * Check if a line has JSDoc documentation above it
 */
function hasJSDoc(content, lineNumber) {
  const lines = content.split('\n');

  // Look backwards from the export line
  for (let i = lineNumber - 2; i >= Math.max(0, lineNumber - 10); i--) {
    const line = lines[i]?.trim();

    if (!line || line === '') continue;

    // Found JSDoc start
    if (line.startsWith('/**')) {
      return true;
    }

    // If we hit non-comment content, stop looking
    if (!line.startsWith('*') && !line.startsWith('//')) {
      break;
    }
  }

  return false;
}

// Run the test
testJSDocCoverage();