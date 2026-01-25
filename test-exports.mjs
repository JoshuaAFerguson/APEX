#!/usr/bin/env node

// Simple test to verify @apexcli/core exports are working
// This script attempts to import from the main index to verify all exports

async function testExports() {
  console.log('🧪 Testing @apexcli/core exports...\n');

  try {
    // Import the main package (assuming it's built)
    const core = await import('./packages/core/dist/index.js');

    console.log('✅ Main package imports successfully');

    // Check for key exports
    const expectedExports = [
      'ApexConfigSchema',
      'TaskStatus',
      'loadConfig',
      'formatElapsed',
      'validateTypes', // from type-validation
      'mockCodeQuality', // from type-validation
      'detectEnvironment',
      'detectPackageManager',
      'sanitizePath',
      'validateDirectoryAccess',
      'detectDangerousOperations',
      'ApexError',
      'scanForSecrets',
      'BaseTool',
      'ToolRegistry',
      'GrepTool',
      'ErrorPresets', // from test-fixtures
    ];

    let foundExports = 0;
    let missingExports = [];

    for (const expectedExport of expectedExports) {
      if (expectedExport in core) {
        console.log(`  ✓ ${expectedExport}`);
        foundExports++;
      } else {
        console.log(`  ❌ ${expectedExport} - MISSING`);
        missingExports.push(expectedExport);
      }
    }

    console.log(`\n📊 Export Summary:`);
    console.log(`  Found: ${foundExports}/${expectedExports.length} expected exports`);

    if (missingExports.length > 0) {
      console.log(`  Missing: ${missingExports.join(', ')}`);
      console.log('\n❌ Some exports are missing - check index.ts file');
      process.exit(1);
    } else {
      console.log('\n🎉 All expected exports are available!');
    }

  } catch (error) {
    console.error('❌ Failed to import @apexcli/core:');
    console.error(error.message);
    console.log('\n💡 Make sure the package is built: npm run build --workspace=@apexcli/core');
    process.exit(1);
  }
}

testExports();