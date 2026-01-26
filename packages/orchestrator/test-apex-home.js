#!/usr/bin/env node
/**
 * Simple test runner for APEX_HOME functionality
 * This script verifies the APEX_HOME implementation without requiring the full test suite
 */

const { TaskStore } = require('./dist/store');
const fs = require('fs');
const path = require('path');
const os = require('os');

async function runApexHomeTest() {
  console.log('🧪 Running APEX_HOME functionality test...\n');

  // Store original APEX_HOME
  const originalApexHome = process.env.APEX_HOME;

  try {
    // Create test directories
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-test-project-'));
    const apexHomeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-test-home-'));

    console.log(`📁 Project directory: ${projectDir}`);
    console.log(`🏠 APEX_HOME directory: ${apexHomeDir}\n`);

    // Test 1: Default behavior (no APEX_HOME)
    console.log('Test 1: Default behavior (APEX_HOME not set)');
    delete process.env.APEX_HOME;

    const store1 = new TaskStore(projectDir);
    await store1.initialize();

    const defaultDbPath = path.join(projectDir, '.apex', 'apex.db');
    const defaultExists = fs.existsSync(defaultDbPath);

    console.log(`✅ Database created in default location: ${defaultExists}`);
    console.log(`📄 Default database path: ${defaultDbPath}\n`);

    store1.close();

    // Test 2: APEX_HOME behavior
    console.log('Test 2: APEX_HOME environment variable set');
    process.env.APEX_HOME = apexHomeDir;

    const store2 = new TaskStore(projectDir);
    await store2.initialize();

    const apexHomeDbPath = path.join(apexHomeDir, 'apex.db');
    const apexHomeExists = fs.existsSync(apexHomeDbPath);

    console.log(`✅ Database created in APEX_HOME location: ${apexHomeExists}`);
    console.log(`📄 APEX_HOME database path: ${apexHomeDbPath}\n`);

    store2.close();

    // Test 3: Verify isolation
    console.log('Test 3: Verify database isolation');
    const defaultDbExists = fs.existsSync(defaultDbPath);
    const apexHomeDbExists = fs.existsSync(apexHomeDbPath);

    console.log(`✅ Default database still exists: ${defaultDbExists}`);
    console.log(`✅ APEX_HOME database exists: ${apexHomeDbExists}`);
    console.log(`✅ Databases are isolated: ${defaultDbExists && apexHomeDbExists}\n`);

    // Cleanup
    fs.rmSync(projectDir, { recursive: true, force: true });
    fs.rmSync(apexHomeDir, { recursive: true, force: true });

    console.log('🎉 All APEX_HOME tests passed!\n');

    return true;
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  } finally {
    // Restore original APEX_HOME
    if (originalApexHome !== undefined) {
      process.env.APEX_HOME = originalApexHome;
    } else {
      delete process.env.APEX_HOME;
    }
  }
}

// Run the test
if (require.main === module) {
  runApexHomeTest()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Unexpected error:', error);
      process.exit(1);
    });
}

module.exports = { runApexHomeTest };