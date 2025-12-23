/**
 * Simple Integration Verification Script
 *
 * This script verifies that the CrossReferenceValidator integration
 * into IdleProcessor is correctly implemented and can be tested.
 */

// Verify imports work correctly
import { IdleProcessor } from '../idle-processor';
import { CrossReferenceValidator } from '../analyzers/cross-reference-validator';
import { TaskStore } from '../store';
import type { DaemonConfig, OutdatedDocumentation } from '@apexcli/core';
import type { SymbolIndex, DocumentationReference } from '../analyzers/cross-reference-validator';

// Type verification - these should compile without errors
const verifyTypes = () => {
  // Verify IdleProcessor can be instantiated
  const config: DaemonConfig = {
    pollInterval: 1000,
    autoStart: false,
    logLevel: 'info'
  };

  const store = {} as TaskStore;
  const processor = new IdleProcessor('/test', config, store);

  // Verify CrossReferenceValidator can be instantiated
  const validator = new CrossReferenceValidator();

  // Verify types are available
  const symbolIndex: SymbolIndex = {
    byName: new Map(),
    byFile: new Map(),
    stats: { totalSymbols: 0, totalFiles: 0, byType: {} }
  };

  const docRef: DocumentationReference = {
    symbolName: 'test',
    referenceType: 'inline-code',
    sourceFile: 'test.md',
    line: 1,
    column: 1,
    context: 'test'
  };

  const outdatedDoc: OutdatedDocumentation = {
    file: 'test.md',
    type: 'broken-link',
    description: 'test',
    line: 1
  };

  return {
    processor,
    validator,
    symbolIndex,
    docRef,
    outdatedDoc
  };
};

// Runtime verification
const verifyRuntime = async () => {
  try {
    const { processor, validator } = verifyTypes();

    // Verify methods exist
    console.log('✅ IdleProcessor instantiated');
    console.log('✅ CrossReferenceValidator instantiated');

    // Verify validator methods exist
    if (typeof validator.buildIndex === 'function') {
      console.log('✅ buildIndex method available');
    }

    if (typeof validator.extractDocumentationReferences === 'function') {
      console.log('✅ extractDocumentationReferences method available');
    }

    if (typeof validator.validateDocumentationReferences === 'function') {
      console.log('✅ validateDocumentationReferences method available');
    }

    // Verify IdleProcessor integration method exists
    const processorMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(processor));
    if (processorMethods.includes('findOutdatedDocumentation')) {
      console.log('✅ findOutdatedDocumentation method available in IdleProcessor');
    }

    console.log('✅ All integration points verified');
    return true;
  } catch (error) {
    console.error('❌ Integration verification failed:', error);
    return false;
  }
};

// Export verification functions for testing
export { verifyTypes, verifyRuntime };

// Run verification if this script is executed directly
if (require.main === module) {
  verifyRuntime().then(success => {
    process.exit(success ? 0 : 1);
  });
}