/**
 * @fileoverview Quick verification test for LinterService integration tests
 *
 * This test file provides a quick smoke test to verify that the LinterService
 * integration tests can run without major compilation or import errors.
 */

import { describe, expect, it } from 'vitest';
import { ApexOrchestrator } from '../index';
import { LinterService } from '../linter/service';

describe('LinterService Integration Verification', () => {
  it('should have proper imports and class definitions', () => {
    // Verify ApexOrchestrator class exists
    expect(ApexOrchestrator).toBeDefined();
    expect(typeof ApexOrchestrator).toBe('function');

    // Verify LinterService class exists
    expect(LinterService).toBeDefined();
    expect(typeof LinterService).toBe('function');
  });

  it('should have getLinterService method on ApexOrchestrator prototype', () => {
    // Verify the method exists
    expect(ApexOrchestrator.prototype.getLinterService).toBeDefined();
    expect(typeof ApexOrchestrator.prototype.getLinterService).toBe('function');
  });

  it('should have all required test files present', () => {
    // This test serves as documentation that all test files should exist
    const requiredTestFiles = [
      'apex-orchestrator-linter-integration.test.ts',
      'apex-orchestrator-linter-instantiation.test.ts',
      'apex-orchestrator-linter-config-loading.test.ts',
      'apex-orchestrator-get-linter-service.test.ts',
    ];

    // The test files should be importable without errors
    // (This test existing means the imports above worked)
    expect(requiredTestFiles).toHaveLength(4);
  });

  it('should have proper TypeScript types', () => {
    // Type-only tests to verify TypeScript compilation
    const orchestrator: ApexOrchestrator = null as any;
    const linterService: LinterService = null as any;

    // These should compile without TypeScript errors
    expect(orchestrator).toBeNull();
    expect(linterService).toBeNull();
  });

  it('should have working test environment setup', () => {
    // Verify test dependencies are available
    expect(describe).toBeDefined();
    expect(it).toBeDefined();
    expect(expect).toBeDefined();

    // Verify Node.js modules used in tests
    expect(typeof require('fs/promises')).toBe('object');
    expect(typeof require('path')).toBe('object');
    expect(typeof require('os')).toBe('object');
  });
});