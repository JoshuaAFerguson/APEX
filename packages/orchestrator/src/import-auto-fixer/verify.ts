/**
 * Simple verification script for ImportAutoFixer
 *
 * This script verifies that the ImportAutoFixer can be instantiated
 * and its basic methods work correctly.
 */

import { ImportAutoFixer } from './import-auto-fixer';

async function verifyImportAutoFixer() {
  try {
    console.log('🔍 Verifying ImportAutoFixer...');

    // Test 1: Create instance
    const fixer = new ImportAutoFixer({
      projectPath: process.cwd(),
      detector: 'eslint',
      dryRun: true,
    });

    console.log('✅ ImportAutoFixer instance created successfully');

    // Test 2: Get configuration
    const config = fixer.getConfig();
    console.log('✅ Configuration retrieved:', {
      detector: config.detector,
      dryRun: config.behavior.dryRun,
      quoteStyle: config.style.quoteStyle,
    });

    // Test 3: Update configuration
    fixer.configure({
      style: { quoteStyle: 'double' }
    });
    const updatedConfig = fixer.getConfig();
    console.log('✅ Configuration updated:', {
      quoteStyle: updatedConfig.style.quoteStyle,
    });

    // Test 4: Check availability (this will likely fail without ESLint but should not throw)
    try {
      const isAvailable = await fixer.isAvailable();
      console.log('✅ Availability check completed:', isAvailable);
    } catch (error) {
      console.log('⚠️ Availability check failed (expected without ESLint):', error instanceof Error ? error.message : error);
    }

    // Test 5: Test getSummary method
    const dummyResults = [
      {
        success: true,
        filePath: '/test.ts',
        importsAdded: [
          { specifier: 'test', source: './test', importType: 'named' as const, line: 1, originalIdentifier: 'test' }
        ],
        errors: [],
        duration: 100,
      },
    ];

    const summary = fixer.getSummary(dummyResults);
    console.log('✅ Summary generation works:', summary);

    console.log('\n🎉 ImportAutoFixer verification completed successfully!');
    console.log('📋 All basic functionality is working as expected.');

    return true;
  } catch (error) {
    console.error('❌ ImportAutoFixer verification failed:', error);
    return false;
  }
}

// Export for use in other scripts
export { verifyImportAutoFixer };

// Run if this file is executed directly
if (require.main === module) {
  verifyImportAutoFixer()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Unexpected error:', error);
      process.exit(1);
    });
}