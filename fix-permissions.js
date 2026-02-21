#!/usr/bin/env node
/**
 * Fix file permissions for project-context-analyzer test files
 * Changes from 600 (rw-------) to 644 (rw-r--r--)
 */

const fs = require('fs');
const path = require('path');
const { glob } = require('glob');

async function fixPermissions() {
  try {
    // Find all project-context-analyzer test files
    const pattern = 'packages/core/src/__tests__/project-context-analyzer*.test.ts';
    const files = await glob(pattern);

    console.log(`Found ${files.length} test files to fix:`);

    for (const file of files) {
      const stats = fs.statSync(file);
      const currentMode = (stats.mode & parseInt('777', 8)).toString(8);

      console.log(`${file}: ${currentMode} -> 644`);

      // Change permissions to 644 (rw-r--r--)
      fs.chmodSync(file, 0o644);
    }

    console.log('✅ Fixed permissions for all files');
  } catch (error) {
    console.error('❌ Error fixing permissions:', error.message);
    process.exit(1);
  }
}

fixPermissions();