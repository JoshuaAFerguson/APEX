/**
 * Simple compilation test for CodebaseIndexer
 *
 * This file is designed to test that all the imports and types
 * compile correctly without runtime execution.
 */

// Test imports
import { CodebaseIndexer, type IndexingOptions } from './indexer.js';
import type { RepositoryMap } from '@apexcli/core/types';

// Type-only tests to verify compilation
export function testCompilation(): void {
  // Test that CodebaseIndexer can be instantiated
  const indexer: CodebaseIndexer = CodebaseIndexer.getInstance();

  // Test that IndexingOptions interface is correctly typed
  const options: IndexingOptions = {
    includePatterns: ['**/*.ts'],
    excludePatterns: ['**/node_modules/**'],
    maxFileSize: 1024,
    includeDocumentation: true,
    includeSignatures: true,
    maxSymbolDepth: 10,
    computeHashes: true,
    continueOnError: true,
    concurrency: 4
  };

  // Test that the main method signature is correct
  const indexResult: Promise<RepositoryMap> = indexer.indexDirectory('/test', options);

  // Test that progress callback is correctly typed
  const progressCallback = (progress: import('./indexer.js').IndexingProgress) => {
    console.log(`Processing ${progress.currentFile} (${progress.filesProcessed}/${progress.totalFiles})`);
  };

  const indexWithProgressResult: Promise<RepositoryMap> = indexer.indexDirectoryWithProgress(
    '/test',
    options,
    progressCallback
  );

  // Test static methods
  const anotherIndexer: CodebaseIndexer = CodebaseIndexer.getInstance();
  CodebaseIndexer.resetInstance();

  // Verify types are available
  const _indexer: typeof indexer = CodebaseIndexer.getInstance();
  const _options: typeof options = {};
  const _result: typeof indexResult = indexer.indexDirectory('/test');

  console.log('✅ All types compile correctly');
}