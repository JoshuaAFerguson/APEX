#!/usr/bin/env node
/**
 * Ink Framework Integration Verification Script
 *
 * This script automatically verifies the Ink framework integration
 * by checking all acceptance criteria programmatically.
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// ANSI color codes for output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

/**
 * Print colored output
 */
function print(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Check if a file contains specific patterns
 */
function checkFileContains(filePath, patterns, description) {
  try {
    if (!existsSync(filePath)) {
      print(`❌ ${description}: File not found - ${filePath}`, 'red');
      return false;
    }

    const content = readFileSync(filePath, 'utf8');
    const results = [];

    for (const [name, pattern] of Object.entries(patterns)) {
      const found = content.match(pattern);
      results.push({
        name,
        found: !!found,
        match: found?.[0]?.slice(0, 100) + (found?.[0]?.length > 100 ? '...' : '')
      });
    }

    const allFound = results.every(r => r.found);

    if (allFound) {
      print(`✅ ${description}`, 'green');
      results.forEach(r => {
        print(`   ✓ ${r.name}: ${r.match}`, 'cyan');
      });
    } else {
      print(`❌ ${description}`, 'red');
      results.forEach(r => {
        if (r.found) {
          print(`   ✓ ${r.name}: ${r.match}`, 'green');
        } else {
          print(`   ✗ ${r.name}: Not found`, 'red');
        }
      });
    }

    return allFound;
  } catch (error) {
    print(`❌ ${description}: Error reading file - ${error.message}`, 'red');
    return false;
  }
}

/**
 * Check package.json for dependencies
 */
function checkPackageJson(filePath) {
  try {
    if (!existsSync(filePath)) {
      print(`❌ Package.json not found - ${filePath}`, 'red');
      return false;
    }

    const pkg = JSON.parse(readFileSync(filePath, 'utf8'));
    const dependencies = { ...pkg.dependencies, ...pkg.devDependencies };

    // Required ink dependency
    if (!dependencies.ink) {
      print(`❌ ink dependency not found in package.json`, 'red');
      return false;
    }

    print(`✅ Package.json has ink dependency`, 'green');
    print(`   ✓ ink: ${dependencies.ink}`, 'cyan');

    // Count Ink ecosystem packages
    const inkPackages = Object.entries(dependencies)
      .filter(([name]) => name.startsWith('ink-'))
      .sort();

    print(`   ✓ Ink ecosystem packages: ${inkPackages.length}`, 'cyan');
    inkPackages.forEach(([name, version]) => {
      print(`     - ${name}: ${version}`, 'blue');
    });

    return true;
  } catch (error) {
    print(`❌ Error reading package.json - ${error.message}`, 'red');
    return false;
  }
}

/**
 * Main verification function
 */
function verifyInkIntegration() {
  print(`${colors.bold}🔍 Ink Framework Integration Verification${colors.reset}\n`);

  const results = [];

  // Check App.tsx for Ink components usage
  results.push(checkFileContains(
    join(rootDir, 'packages/cli/src/ui/App.tsx'),
    {
      'Box import': /import.*\{[^}]*Box[^}]*\}.*from ['"]ink['"]/,
      'Text import': /import.*\{[^}]*Text[^}]*\}.*from ['"]ink['"]/,
      'useInput import': /import.*\{[^}]*useInput[^}]*\}.*from ['"]ink['"]/,
      'useApp import': /import.*\{[^}]*useApp[^}]*\}.*from ['"]ink['"]/,
      'Box usage': /<Box[^>]*>/,
      'Text usage': /<Text[^>]*>/,
      'useInput call': /useInput\s*\(/,
      'useApp call': /useApp\s*\(/
    },
    'App.tsx uses core Ink components (Box, Text, useInput, useApp)'
  ));

  // Check index.tsx for render call
  results.push(checkFileContains(
    join(rootDir, 'packages/cli/src/ui/index.tsx'),
    {
      'render import': /import.*\{[^}]*render[^}]*\}.*from ['"]ink['"]/,
      'render call': /render\s*\(/
    },
    'index.tsx has render() call'
  ));

  // Check package.json for ink dependency
  results.push(checkPackageJson(join(rootDir, 'packages/cli/package.json')));

  // Summary
  const passedCount = results.filter(Boolean).length;
  const totalCount = results.length;

  print(`\n${colors.bold}📋 Verification Summary${colors.reset}`);
  if (passedCount === totalCount) {
    print(`✅ All ${totalCount} acceptance criteria passed!`, 'green');
    print(`🎉 Ink framework integration is complete and properly wired`, 'green');
  } else {
    print(`❌ ${totalCount - passedCount}/${totalCount} acceptance criteria failed`, 'red');
    print(`🔧 Ink framework integration needs attention`, 'yellow');
  }

  return passedCount === totalCount;
}

// Run verification if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const success = verifyInkIntegration();
  process.exit(success ? 0 : 1);
}

export { verifyInkIntegration };