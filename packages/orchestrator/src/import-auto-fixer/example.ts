/**
 * ImportAutoFixer Usage Example
 *
 * Demonstrates how to use the ImportAutoFixer service to detect and fix
 * missing imports in TypeScript/JavaScript projects.
 */

import { ImportAutoFixer } from './import-auto-fixer';
import type { ImportFixResult } from './types';

/**
 * Basic usage example
 */
async function basicExample() {
  const fixer = new ImportAutoFixer({
    projectPath: '/path/to/your/project',
    detector: 'auto', // Uses ESLint if available, falls back to TypeScript
  });

  // Check if the service is available
  if (!(await fixer.isAvailable())) {
    console.log('ImportAutoFixer is not available (ESLint not found)');
    return;
  }

  // Analyze files for missing imports (without modifying them)
  const analysisResults = await fixer.analyze(['src/components/Button.tsx']);

  for (const analysis of analysisResults) {
    console.log(`File: ${analysis.filePath}`);
    console.log(`Missing imports: ${analysis.missingImports.length}`);

    for (const missing of analysis.missingImports) {
      console.log(`  - ${missing.identifier} at line ${missing.line}`);
    }
  }

  // Fix missing imports
  const fixResults = await fixer.fix(['src/components/Button.tsx']);

  for (const result of fixResults) {
    if (result.success) {
      console.log(`✅ Fixed ${result.filePath}`);
      console.log(`   Added ${result.importsAdded.length} imports:`);

      for (const added of result.importsAdded) {
        console.log(`   - ${added.specifier} from '${added.source}'`);
      }
    } else {
      console.log(`❌ Failed to fix ${result.filePath}`);
      for (const error of result.errors) {
        console.log(`   Error: ${error.message}`);
      }
    }
  }

  // Get summary statistics
  const summary = fixer.getSummary(fixResults);
  console.log('\nSummary:', summary);
}

/**
 * Configuration example
 */
async function configurationExample() {
  const fixer = new ImportAutoFixer({
    projectPath: '/path/to/your/project',
    detector: 'eslint',
    dryRun: true, // Don't actually modify files
    preferredImportStyle: 'named',
    organizeImports: true,
    resolvers: {
      local: {
        enabled: true,
        searchPaths: ['src', 'lib', 'components'],
      },
      package: {
        enabled: true,
        preferredPackages: {
          // Custom mappings
          _: 'lodash',
          $: 'jquery',
        },
      },
    },
  });

  // Update configuration at runtime
  fixer.configure({
    style: {
      quoteStyle: 'double',
      semicolons: false,
      useTypeImports: true,
    },
    behavior: {
      dryRun: false, // Actually write files now
    },
  });

  const files = ['src/utils.ts', 'src/types.ts', 'src/components/App.tsx'];
  const results = await fixer.fix(files);

  console.log(`Processed ${results.length} files`);
}

/**
 * Event handling example
 */
async function eventHandlingExample() {
  const fixer = new ImportAutoFixer({
    projectPath: '/path/to/your/project',
  });

  // Listen to events for progress tracking
  fixer.on('analysis:started', ({ files }) => {
    console.log(`🔍 Starting analysis of ${files.length} files...`);
  });

  fixer.on('fix:import-added', ({ filePath, import: added }) => {
    console.log(`➕ Added import: ${added.specifier} from '${added.source}' to ${filePath}`);
  });

  fixer.on('fix:error', ({ filePath, error }) => {
    console.log(`❌ Error in ${filePath}: ${error.message}`);
  });

  fixer.on('fix:completed', ({ result }) => {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} Completed ${result.filePath} (${result.duration}ms)`);
  });

  // Process files
  const results = await fixer.fix(['src/**/*.ts', 'src/**/*.tsx']);
  console.log('All files processed!');
}

/**
 * Batch processing example
 */
async function batchProcessingExample() {
  const fixer = new ImportAutoFixer({
    projectPath: '/path/to/your/project',
    detector: 'eslint',
  });

  // Process multiple files in batches
  const filesToProcess = [
    'src/components/Button.tsx',
    'src/components/Modal.tsx',
    'src/hooks/useApi.ts',
    'src/utils/validation.ts',
    'src/types/user.ts',
  ];

  const batchSize = 3;
  const results: ImportFixResult[] = [];

  for (let i = 0; i < filesToProcess.length; i += batchSize) {
    const batch = filesToProcess.slice(i, i + batchSize);
    console.log(`Processing batch ${Math.floor(i / batchSize) + 1}: ${batch.join(', ')}`);

    const batchResults = await fixer.fix(batch);
    results.push(...batchResults);

    // Optional: Add delay between batches
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Generate final summary
  const summary = fixer.getSummary(results);
  console.log('\n📊 Final Summary:');
  console.log(`Files processed: ${summary.filesProcessed}`);
  console.log(`Files modified: ${summary.filesModified}`);
  console.log(`Total imports added: ${summary.totalImportsAdded}`);
  console.log(`Total errors: ${summary.totalErrors}`);
  console.log(`Total duration: ${summary.totalDuration}ms`);
}

/**
 * Type-only imports example
 */
async function typeImportsExample() {
  const fixer = new ImportAutoFixer({
    projectPath: '/path/to/typescript/project',
    preferredImportStyle: 'named',
  });

  // Configure for TypeScript type imports
  fixer.configure({
    style: {
      useTypeImports: true, // Use "import type" for type-only imports
      preferredImportStyle: 'named',
    },
  });

  // This would generate: import type { User, ApiResponse } from './types'
  // instead of: import { User, ApiResponse } from './types'
  const results = await fixer.fix(['src/api/userService.ts']);

  for (const result of results) {
    console.log(`Processed: ${result.filePath}`);
    for (const added of result.importsAdded) {
      const typePrefix = added.isTypeOnly ? 'type ' : '';
      console.log(`  Added: import ${typePrefix}${added.specifier} from '${added.source}'`);
    }
  }
}

// Export examples for documentation
export {
  basicExample,
  configurationExample,
  eventHandlingExample,
  batchProcessingExample,
  typeImportsExample,
};