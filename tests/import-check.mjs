#!/usr/bin/env node

/**
 * Import validation script
 * Attempts to verify import paths and basic module structure
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔍 Validating import/export structure for web tools implementation...\n');

// Check web tools exports
const webToolsIndex = join(__dirname, 'packages/core/src/tools/web/index.ts');
const webSearchTool = join(__dirname, 'packages/core/src/tools/web/web-search-tool.ts');
const webRegister = join(__dirname, 'packages/core/src/tools/web/register.ts');
const toolsIndex = join(__dirname, 'packages/core/src/tools/index.ts');
const webfetchTool = join(__dirname, 'packages/orchestrator/src/tools/webfetch.ts');

const filesToCheck = [
  { path: webToolsIndex, name: 'Web Tools Index' },
  { path: webSearchTool, name: 'Web Search Tool' },
  { path: webRegister, name: 'Web Tools Register' },
  { path: toolsIndex, name: 'Main Tools Index' },
  { path: webfetchTool, name: 'WebFetch Tool' },
];

let allValid = true;

for (const { path, name } of filesToCheck) {
  console.log(`Checking ${name}...`);

  if (!existsSync(path)) {
    console.log(`❌ File missing: ${path}`);
    allValid = false;
    continue;
  }

  try {
    const content = readFileSync(path, 'utf8');

    // Check for exports
    const hasExports = content.includes('export');
    if (!hasExports && !path.includes('webfetch')) {
      console.log(`⚠️  No exports found`);
    }

    // Check imports are using .js extension for local imports
    const localImportMatches = content.match(/from ['"]\.\/[^'"]*(?!\.js)['"]/g);
    if (localImportMatches) {
      console.log(`❌ Local imports missing .js extension:`, localImportMatches);
      allValid = false;
    }

    // Check for type exports
    const hasTypeExports = content.includes('type ');
    if (hasTypeExports) {
      console.log(`✅ Contains type exports`);
    }

    console.log(`✅ File exists and has basic structure`);

  } catch (error) {
    console.log(`❌ Error reading file: ${error.message}`);
    allValid = false;
  }

  console.log();
}

// Check if main tools index includes web tools
console.log('Checking main tools index for web tools exports...');
try {
  const mainIndex = readFileSync(toolsIndex, 'utf8');
  if (mainIndex.includes('./web/index.js')) {
    console.log('✅ Main index includes web tools');
  } else {
    console.log('❌ Main index missing web tools import');
    allValid = false;
  }
} catch (error) {
  console.log(`❌ Error checking main index: ${error.message}`);
  allValid = false;
}

console.log('\n📋 Summary:');
if (allValid) {
  console.log('✅ Import/export structure appears valid');
} else {
  console.log('❌ Import/export structure has issues that need to be addressed');
}

process.exit(allValid ? 0 : 1);