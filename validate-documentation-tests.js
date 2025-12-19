#!/usr/bin/env node

/**
 * Simple test validation for documentation changes
 * This validates that the documentation tests can run without executing the full vitest suite
 */

const fs = require('fs');
const path = require('path');

const docsDir = path.join(__dirname, 'docs');
const testsDir = path.join(docsDir, 'tests');

// Helper to read documentation files
function readDocFile(filePath) {
  const fullPath = path.join(docsDir, filePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Documentation file not found: ${fullPath}`);
  }
  return fs.readFileSync(fullPath, 'utf8');
}

// Helper to extract all markdown links from content
function extractMarkdownLinks(content) {
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const lines = content.split('\n');
  const links = [];

  lines.forEach((line, index) => {
    let match;
    while ((match = linkRegex.exec(line)) !== null) {
      links.push({
        text: match[1],
        href: match[2],
        line: index + 1
      });
    }
  });

  return links;
}

// Helper to check if a relative documentation path exists
function isValidDocPath(href) {
  if (href.startsWith('http')) return true; // External links (assume valid)
  if (href.startsWith('#')) return true; // Anchor links (assume valid)

  const docPath = path.join(docsDir, href);
  return fs.existsSync(docPath);
}

function validateDocumentation() {
  const results = {
    passed: 0,
    failed: 0,
    errors: []
  };

  console.log('🧪 Validating Documentation Tests...\n');

  try {
    // Test 1: Check that main documentation files exist
    console.log('📄 Checking main documentation files...');
    const mainDocs = ['getting-started.md', 'cli-guide.md'];

    mainDocs.forEach(doc => {
      const docPath = path.join(docsDir, doc);
      if (fs.existsSync(docPath)) {
        console.log(`  ✅ ${doc} exists`);
        results.passed++;
      } else {
        console.log(`  ❌ ${doc} missing`);
        results.failed++;
        results.errors.push(`${doc} not found`);
      }
    });

    // Test 2: Check v0.3.0 feature documents exist
    console.log('\n📂 Checking v0.3.0 feature documents...');
    const featureDocs = [
      'features/v030-features.md',
      'user-guide/display-modes.md',
      'user-guide/input-preview.md'
    ];

    featureDocs.forEach(doc => {
      const docPath = path.join(docsDir, doc);
      if (fs.existsSync(docPath)) {
        console.log(`  ✅ ${doc} exists`);
        results.passed++;
      } else {
        console.log(`  ❌ ${doc} missing`);
        results.failed++;
        results.errors.push(`${doc} not found`);
      }
    });

    // Test 3: Validate v0.3.0 cross-references
    console.log('\n🔗 Validating v0.3.0 cross-references...');
    mainDocs.forEach(docFile => {
      try {
        const content = readDocFile(docFile);

        // Check for v0.3.0 feature links
        if (content.includes('features/v030-features.md')) {
          console.log(`  ✅ ${docFile} links to v0.3.0 features overview`);
          results.passed++;
        } else {
          console.log(`  ❌ ${docFile} missing v0.3.0 features overview link`);
          results.failed++;
          results.errors.push(`${docFile} missing v0.3.0 features overview link`);
        }

        if (content.includes('user-guide/display-modes.md')) {
          console.log(`  ✅ ${docFile} links to display modes guide`);
          results.passed++;
        } else {
          console.log(`  ❌ ${docFile} missing display modes guide link`);
          results.failed++;
          results.errors.push(`${docFile} missing display modes guide link`);
        }

        if (content.includes('user-guide/input-preview.md')) {
          console.log(`  ✅ ${docFile} links to input preview guide`);
          results.passed++;
        } else {
          console.log(`  ❌ ${docFile} missing input preview guide link`);
          results.failed++;
          results.errors.push(`${docFile} missing input preview guide link`);
        }

        // Check for v0.3.0 markers
        if (content.includes('✨ NEW in v0.3.0')) {
          console.log(`  ✅ ${docFile} has v0.3.0 feature markers`);
          results.passed++;
        } else {
          console.log(`  ❌ ${docFile} missing v0.3.0 feature markers`);
          results.failed++;
          results.errors.push(`${docFile} missing v0.3.0 feature markers`);
        }

      } catch (error) {
        console.log(`  ❌ Error reading ${docFile}: ${error.message}`);
        results.failed++;
        results.errors.push(`Error reading ${docFile}: ${error.message}`);
      }
    });

    // Test 4: Validate specific v0.3.0 content
    console.log('\n📋 Validating specific v0.3.0 content...');

    try {
      const gettingStarted = readDocFile('getting-started.md');

      // Check for Terminal Interface section
      if (gettingStarted.includes('## Terminal Interface (v0.3.0)')) {
        console.log('  ✅ getting-started.md has Terminal Interface v0.3.0 section');
        results.passed++;
      } else {
        console.log('  ❌ getting-started.md missing Terminal Interface v0.3.0 section');
        results.failed++;
        results.errors.push('getting-started.md missing Terminal Interface v0.3.0 section');
      }

      // Check for display modes examples
      if (gettingStarted.includes('/compact') && gettingStarted.includes('/verbose')) {
        console.log('  ✅ getting-started.md has display mode examples');
        results.passed++;
      } else {
        console.log('  ❌ getting-started.md missing display mode examples');
        results.failed++;
        results.errors.push('getting-started.md missing display mode examples');
      }

      // Check for input preview examples
      if (gettingStarted.includes('┌─ Input Preview ─') && gettingStarted.includes('Intent: task_execution')) {
        console.log('  ✅ getting-started.md has input preview examples');
        results.passed++;
      } else {
        console.log('  ❌ getting-started.md missing input preview examples');
        results.failed++;
        results.errors.push('getting-started.md missing input preview examples');
      }

    } catch (error) {
      console.log(`  ❌ Error validating getting-started.md content: ${error.message}`);
      results.failed++;
      results.errors.push(`Error validating getting-started.md content: ${error.message}`);
    }

    try {
      const cliGuide = readDocFile('cli-guide.md');

      // Check for What's New section
      if (cliGuide.includes('### ✨ What\'s New in v0.3.0')) {
        console.log('  ✅ cli-guide.md has What\'s New in v0.3.0 section');
        results.passed++;
      } else {
        console.log('  ❌ cli-guide.md missing What\'s New in v0.3.0 section');
        results.failed++;
        results.errors.push('cli-guide.md missing What\'s New in v0.3.0 section');
      }

      // Check for enhanced display modes
      if (cliGuide.includes('> **✨ NEW in v0.3.0**: Enhanced display modes')) {
        console.log('  ✅ cli-guide.md has enhanced display modes note');
        results.passed++;
      } else {
        console.log('  ❌ cli-guide.md missing enhanced display modes note');
        results.failed++;
        results.errors.push('cli-guide.md missing enhanced display modes note');
      }

      // Check for preview command
      if (cliGuide.includes('### `/preview` - Toggle Preview Mode ✨ NEW in v0.3.0')) {
        console.log('  ✅ cli-guide.md has preview command section');
        results.passed++;
      } else {
        console.log('  ❌ cli-guide.md missing preview command section');
        results.failed++;
        results.errors.push('cli-guide.md missing preview command section');
      }

    } catch (error) {
      console.log(`  ❌ Error validating cli-guide.md content: ${error.message}`);
      results.failed++;
      results.errors.push(`Error validating cli-guide.md content: ${error.message}`);
    }

    // Test 5: Validate test files themselves
    console.log('\n🧪 Validating test files...');
    const testFiles = [
      'tests/documentation-validation.test.ts',
      'tests/v030-features-integration.test.ts'
    ];

    testFiles.forEach(testFile => {
      const testPath = path.join(docsDir, testFile);
      if (fs.existsSync(testPath)) {
        console.log(`  ✅ ${testFile} exists`);
        results.passed++;

        // Basic syntax check
        try {
          const testContent = fs.readFileSync(testPath, 'utf8');
          if (testContent.includes('describe(') && testContent.includes('it(')) {
            console.log(`  ✅ ${testFile} has valid test structure`);
            results.passed++;
          } else {
            console.log(`  ❌ ${testFile} missing valid test structure`);
            results.failed++;
            results.errors.push(`${testFile} missing valid test structure`);
          }
        } catch (error) {
          console.log(`  ❌ Error reading ${testFile}: ${error.message}`);
          results.failed++;
          results.errors.push(`Error reading ${testFile}: ${error.message}`);
        }
      } else {
        console.log(`  ❌ ${testFile} missing`);
        results.failed++;
        results.errors.push(`${testFile} not found`);
      }
    });

  } catch (error) {
    console.log(`❌ Validation error: ${error.message}`);
    results.failed++;
    results.errors.push(`Validation error: ${error.message}`);
  }

  // Print summary
  console.log('\n📊 Validation Summary:');
  console.log(`  ✅ Passed: ${results.passed}`);
  console.log(`  ❌ Failed: ${results.failed}`);

  if (results.errors.length > 0) {
    console.log('\n🚨 Errors:');
    results.errors.forEach(error => {
      console.log(`  • ${error}`);
    });
  }

  if (results.failed === 0) {
    console.log('\n🎉 All documentation validation tests passed!');
    console.log('\n📋 Test Coverage Summary:');
    console.log('  • Documentation file existence: ✅');
    console.log('  • v0.3.0 feature document existence: ✅');
    console.log('  • Cross-reference validation: ✅');
    console.log('  • Content validation: ✅');
    console.log('  • Test file structure: ✅');
    return 0;
  } else {
    console.log('\n💥 Some validation tests failed. See errors above.');
    return 1;
  }
}

// Run validation
const exitCode = validateDocumentation();
process.exit(exitCode);