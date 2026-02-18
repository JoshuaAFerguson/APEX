/**
 * Acceptance Criteria Validation for ImportAutoFixer
 *
 * This script validates that the ImportAutoFixer implementation meets
 * all the requirements specified in the acceptance criteria.
 */

import { ImportAutoFixer } from './import-auto-fixer';
import type {
  ImportAutoFixerOptions,
  MissingImport,
  ImportFixResult,
  AddedImport,
} from './types';

/**
 * Validation results
 */
interface ValidationResult {
  criterion: string;
  passed: boolean;
  details: string;
}

/**
 * Validate that ImportAutoFixer class exists and can be instantiated
 */
function validateClassExists(): ValidationResult {
  try {
    const options: ImportAutoFixerOptions = {
      projectPath: '/test',
      detector: 'eslint',
    };

    const fixer = new ImportAutoFixer(options);

    return {
      criterion: 'ImportAutoFixer class exists',
      passed: fixer instanceof ImportAutoFixer,
      details: 'Class can be instantiated successfully',
    };
  } catch (error) {
    return {
      criterion: 'ImportAutoFixer class exists',
      passed: false,
      details: `Failed to instantiate: ${error instanceof Error ? error.message : error}`,
    };
  }
}

/**
 * Validate missing import detection capability
 */
async function validateDetection(): Promise<ValidationResult> {
  try {
    const fixer = new ImportAutoFixer({
      projectPath: '/test',
      detector: 'eslint',
      dryRun: true,
    });

    // Mock the detector to simulate detection
    const mockDetector = {
      id: 'test-detector',
      name: 'Test Detector',
      detect: async (): Promise<MissingImport[]> => [
        {
          identifier: 'testFunction',
          line: 1,
          column: 1,
          context: { usageType: 'value' as const },
        },
      ],
      isAvailable: async () => true,
    };

    // Replace detector for testing
    (fixer as any).detector = mockDetector;

    const analysis = await fixer.analyze(['/test/file.ts']);

    const hasDetectionCapability = analysis.length > 0 && analysis[0].missingImports.length > 0;

    return {
      criterion: 'Detects missing imports',
      passed: hasDetectionCapability,
      details: hasDetectionCapability
        ? `Detected ${analysis[0].missingImports.length} missing imports`
        : 'No missing imports detected',
    };
  } catch (error) {
    return {
      criterion: 'Detects missing imports',
      passed: false,
      details: `Detection failed: ${error instanceof Error ? error.message : error}`,
    };
  }
}

/**
 * Validate import addition capability
 */
async function validateImportAddition(): Promise<ValidationResult> {
  try {
    const fixer = new ImportAutoFixer({
      projectPath: '/test',
      detector: 'eslint',
      dryRun: true, // Don't actually write files
    });

    // Mock the detector and resolver
    (fixer as any).detector = {
      id: 'test-detector',
      name: 'Test Detector',
      detect: async (): Promise<MissingImport[]> => [
        {
          identifier: 'testFunction',
          line: 1,
          column: 1,
          context: { usageType: 'value' as const },
        },
      ],
      isAvailable: async () => true,
    };

    // Mock resolver
    const mockResolver = {
      id: 'test-resolver',
      priority: 1,
      canResolve: async () => true,
      resolve: async () => ({
        source: './test-module',
        importType: 'named' as const,
        isTypeOnly: false,
        confidence: 1.0,
        resolvedBy: 'test-resolver',
      }),
    };

    (fixer as any).resolvers = [mockResolver];

    // Mock file system
    const originalReadFile = require('fs/promises').readFile;
    require('fs/promises').readFile = async () => 'const x = testFunction();';

    const results = await fixer.fix(['/test/file.ts']);

    // Restore original function
    require('fs/promises').readFile = originalReadFile;

    const hasAddedImports = results.length > 0 && results[0].importsAdded.length > 0;

    return {
      criterion: 'Adds missing imports',
      passed: hasAddedImports,
      details: hasAddedImports
        ? `Added ${results[0].importsAdded.length} imports`
        : 'No imports were added',
    };
  } catch (error) {
    return {
      criterion: 'Adds missing imports',
      passed: false,
      details: `Import addition failed: ${error instanceof Error ? error.message : error}`,
    };
  }
}

/**
 * Validate that the service returns a list of imports added
 */
async function validateReturnsImportsList(): Promise<ValidationResult> {
  try {
    const fixer = new ImportAutoFixer({
      projectPath: '/test',
      detector: 'eslint',
      dryRun: true,
    });

    // Test getSummary method with mock data
    const mockResults: ImportFixResult[] = [
      {
        success: true,
        filePath: '/test/file.ts',
        importsAdded: [
          {
            specifier: 'testFunction',
            source: './test-module',
            importType: 'named',
            line: 1,
            originalIdentifier: 'testFunction',
          },
          {
            specifier: 'anotherFunction',
            source: 'test-package',
            importType: 'named',
            line: 2,
            originalIdentifier: 'anotherFunction',
          },
        ],
        errors: [],
        duration: 100,
      },
    ];

    const summary = fixer.getSummary(mockResults);

    const hasImportsList =
      summary.totalImportsAdded === 2 &&
      mockResults[0].importsAdded.length === 2;

    return {
      criterion: 'Returns list of imports added',
      passed: hasImportsList,
      details: hasImportsList
        ? `Successfully tracks ${summary.totalImportsAdded} imports added`
        : 'Failed to properly track imports added',
    };
  } catch (error) {
    return {
      criterion: 'Returns list of imports added',
      passed: false,
      details: `List generation failed: ${error instanceof Error ? error.message : error}`,
    };
  }
}

/**
 * Validate configuration support
 */
function validateConfiguration(): ValidationResult {
  try {
    const fixer = new ImportAutoFixer({
      projectPath: '/test',
      detector: 'eslint',
      dryRun: true,
      preferredImportStyle: 'named',
      organizeImports: true,
    });

    const config = fixer.getConfig();

    // Test configuration update
    fixer.configure({
      style: {
        quoteStyle: 'double',
        semicolons: false,
      },
      behavior: {
        dryRun: false,
      },
    });

    const updatedConfig = fixer.getConfig();

    const configurationWorks =
      config.detector === 'eslint' &&
      config.behavior.dryRun === true &&
      updatedConfig.style.quoteStyle === 'double' &&
      updatedConfig.style.semicolons === false &&
      updatedConfig.behavior.dryRun === false;

    return {
      criterion: 'Respects configuration',
      passed: configurationWorks,
      details: configurationWorks
        ? 'Configuration loading and updating works correctly'
        : 'Configuration handling failed',
    };
  } catch (error) {
    return {
      criterion: 'Respects configuration',
      passed: false,
      details: `Configuration failed: ${error instanceof Error ? error.message : error}`,
    };
  }
}

/**
 * Validate that unit tests exist
 */
function validateUnitTests(): ValidationResult {
  try {
    // Check if test file exists
    const fs = require('fs');
    const path = require('path');

    const testFilePath = path.join(__dirname, 'import-auto-fixer.test.ts');
    const integrationTestPath = path.join(__dirname, 'integration.test.ts');

    const unitTestExists = fs.existsSync(testFilePath);
    const integrationTestExists = fs.existsSync(integrationTestPath);

    return {
      criterion: 'Unit tests exist',
      passed: unitTestExists && integrationTestExists,
      details: unitTestExists && integrationTestExists
        ? 'Both unit and integration tests are present'
        : `Missing tests - Unit: ${unitTestExists}, Integration: ${integrationTestExists}`,
    };
  } catch (error) {
    return {
      criterion: 'Unit tests exist',
      passed: false,
      details: `Test validation failed: ${error instanceof Error ? error.message : error}`,
    };
  }
}

/**
 * Run all validation tests
 */
async function validateAllCriteria(): Promise<ValidationResult[]> {
  console.log('🧪 Validating ImportAutoFixer Implementation...\n');

  const results: ValidationResult[] = [
    validateClassExists(),
    await validateDetection(),
    await validateImportAddition(),
    await validateReturnsImportsList(),
    validateConfiguration(),
    validateUnitTests(),
  ];

  return results;
}

/**
 * Print validation results
 */
function printResults(results: ValidationResult[]): void {
  console.log('📋 Acceptance Criteria Validation Results:\n');

  const passed = results.filter(r => r.passed).length;
  const total = results.length;

  for (const result of results) {
    const icon = result.passed ? '✅' : '❌';
    console.log(`${icon} ${result.criterion}`);
    console.log(`   ${result.details}\n`);
  }

  console.log(`📊 Summary: ${passed}/${total} criteria passed`);

  if (passed === total) {
    console.log('🎉 All acceptance criteria met! Implementation is complete.');
  } else {
    console.log('⚠️ Some criteria not met. Review implementation.');
  }
}

/**
 * Main validation function
 */
async function main(): Promise<boolean> {
  try {
    const results = await validateAllCriteria();
    printResults(results);

    const allPassed = results.every(r => r.passed);
    return allPassed;
  } catch (error) {
    console.error('❌ Validation failed with error:', error);
    return false;
  }
}

// Export for use in other scripts
export { validateAllCriteria, printResults, main as validateAcceptanceCriteria };

// Run if this file is executed directly
if (require.main === module) {
  main()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Unexpected error:', error);
      process.exit(1);
    });
}