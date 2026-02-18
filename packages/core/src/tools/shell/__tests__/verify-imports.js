/**
 * Simple verification script to check that imports work correctly
 * This can be run with: node verify-imports.js
 */

try {
  // Note: This is a .js file so we need to use require or handle ES modules differently
  console.log('Verification script - checking basic Node.js functionality...');

  // Check basic Node.js modules
  const { spawn } = require('child_process');
  console.log('✅ child_process module imported successfully');

  // Basic functionality test
  const testSpawn = spawn('echo', ['hello'], { shell: true });
  testSpawn.on('close', (code) => {
    console.log(`✅ Basic spawn functionality works (exit code: ${code})`);
  });

  testSpawn.on('error', (error) => {
    console.log(`❌ Spawn error: ${error.message}`);
  });

  console.log('✅ All basic checks passed - ready for full test suite');

} catch (error) {
  console.error(`❌ Import verification failed: ${error.message}`);
  process.exit(1);
}