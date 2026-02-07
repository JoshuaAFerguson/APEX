#!/usr/bin/env node

/**
 * Cleanup utility that removes .apex-test directory
 *
 * This script provides cross-platform removal of .apex-test directories,
 * handling cases where the directory doesn't exist and ensuring compatibility
 * with Windows, macOS, and Linux.
 *
 * Usage:
 *   node scripts/cleanup-test-directory.mjs
 *   npm run cleanup:test
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Remove a directory recursively with cross-platform compatibility
 * @param {string} dirPath - Path to directory to remove
 */
async function removeDirectory(dirPath) {
  try {
    const stats = await fs.stat(dirPath);
    if (stats.isDirectory()) {
      console.log(`Removing directory: ${dirPath}`);
      await fs.rm(dirPath, { recursive: true, force: true });
      console.log(`✅ Successfully removed: ${dirPath}`);
    } else {
      console.log(`⚠️  Path exists but is not a directory: ${dirPath}`);
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log(`ℹ️  Directory does not exist: ${dirPath}`);
    } else if (error.code === 'EPERM' || error.code === 'EACCES') {
      // Permission-related errors - attempt alternative cleanup methods
      console.log(`⚠️  Permission denied for: ${dirPath} - attempting alternative cleanup...`);

      try {
        // Try to change permissions first, then remove
        await fs.chmod(dirPath, 0o755);
        await fs.rm(dirPath, { recursive: true, force: true });
        console.log(`✅ Successfully removed after permission fix: ${dirPath}`);
      } catch (permError) {
        console.error(`❌ Failed to remove ${dirPath} due to permission restrictions: ${permError.message}`);
        console.log(`💡 Manual cleanup may be required for: ${dirPath}`);
        // Don't throw - just warn and continue
      }
    } else {
      throw error;
    }
  }
}

/**
 * Find all .apex-test directories starting from a root directory
 * @param {string} rootDir - Root directory to search from
 * @returns {Promise<string[]>} Array of .apex-test directory paths
 */
async function findApexTestDirectories(rootDir) {
  const apexTestDirs = [];

  try {
    const entries = await fs.readdir(rootDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(rootDir, entry.name);

      if (entry.isDirectory()) {
        if (entry.name === '.apex-test') {
          apexTestDirs.push(fullPath);
        } else if (!entry.name.startsWith('.') && !entry.name.startsWith('node_modules')) {
          // Recursively search subdirectories (but skip hidden dirs and node_modules)
          const subDirs = await findApexTestDirectories(fullPath);
          apexTestDirs.push(...subDirs);
        }
      }
    }
  } catch (error) {
    if (error.code === 'EPERM' || error.code === 'EACCES') {
      console.warn(`⚠️  Permission denied accessing directory ${rootDir}: ${error.message}`);
    } else if (error.code !== 'ENOENT') {
      console.warn(`Warning: Could not read directory ${rootDir}: ${error.message}`);
    }
  }

  return apexTestDirs;
}

/**
 * Main cleanup function
 */
async function cleanupTestDirectories() {
  const projectRoot = path.resolve(__dirname, '..');

  console.log('🧹 Starting .apex-test directory cleanup...');
  console.log(`📂 Searching from project root: ${projectRoot}`);

  try {
    // Find all .apex-test directories
    const apexTestDirs = await findApexTestDirectories(projectRoot);

    if (apexTestDirs.length === 0) {
      console.log('ℹ️  No .apex-test directories found.');
      return;
    }

    console.log(`📁 Found ${apexTestDirs.length} .apex-test director${apexTestDirs.length === 1 ? 'y' : 'ies'}:`);
    apexTestDirs.forEach(dir => console.log(`   - ${dir}`));

    // Remove all found directories
    const errors = [];
    for (const dir of apexTestDirs) {
      try {
        await removeDirectory(dir);
      } catch (error) {
        const errorMsg = `Failed to remove ${dir}: ${error.message}`;
        errors.push(errorMsg);
        console.error(`❌ ${errorMsg}`);
      }
    }

    if (errors.length > 0) {
      console.error(`\n❌ Cleanup completed with ${errors.length} error${errors.length === 1 ? '' : 's'}:`);
      errors.forEach(error => console.error(`   - ${error}`));
      process.exit(1);
    } else {
      console.log('\n✅ Cleanup completed successfully!');
    }

  } catch (error) {
    console.error('❌ Cleanup failed:', error.message);
    process.exit(1);
  }
}

/**
 * Handle cleanup for a specific directory path
 * @param {string} targetPath - Specific path to clean up
 */
async function cleanupSpecificDirectory(targetPath) {
  const resolvedPath = path.resolve(targetPath);

  console.log(`🧹 Cleaning up specific directory: ${resolvedPath}`);

  try {
    await removeDirectory(resolvedPath);
    console.log('✅ Specific directory cleanup completed successfully!');
  } catch (error) {
    console.error('❌ Specific directory cleanup failed:', error.message);
    process.exit(1);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);

  // Show help if requested
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
🧹 APEX Test Directory Cleanup Utility

Usage:
  node scripts/cleanup-test-directory.mjs [options] [path]
  npm run cleanup:test

Options:
  --help, -h     Show this help message
  path          Specific .apex-test directory path to remove

Examples:
  # Clean up all .apex-test directories in project
  npm run cleanup:test

  # Clean up specific directory
  node scripts/cleanup-test-directory.mjs /path/to/.apex-test

  # Show help
  node scripts/cleanup-test-directory.mjs --help

Features:
  ✅ Cross-platform compatibility (Windows, macOS, Linux)
  ✅ Handles cases where directory doesn't exist
  ✅ Recursive directory removal
  ✅ Safe error handling
  ✅ Detailed logging
`);
    return;
  }

  // Check if a specific path was provided
  if (args.length > 0 && !args[0].startsWith('-')) {
    await cleanupSpecificDirectory(args[0]);
  } else {
    await cleanupTestDirectories();
  }
}

// Execute if this script is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  });
}

export { cleanupTestDirectories, cleanupSpecificDirectory, removeDirectory, findApexTestDirectories };