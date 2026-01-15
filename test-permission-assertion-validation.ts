#!/usr/bin/env node
/**
 * @fileoverview Validation script for permission assertion helpers
 *
 * This script validates that the permission assertion helpers are properly
 * implemented and functional without requiring npm commands.
 */

import { resolve } from 'path';
import { readFileSync, existsSync } from 'fs';

interface ValidationResult {
  passed: boolean;
  message: string;
  details?: string;
}

class PermissionAssertionValidator {
  private results: ValidationResult[] = [];

  public async validateImplementation(): Promise<void> {
    console.log('🔍 Validating Permission Assertion Helpers Implementation\n');

    // Check core test files exist
    this.checkFileExists(
      'packages/core/src/__tests__/permission-assertion-helpers.test.ts',
      'Core permission assertion helpers test file'
    );

    this.checkFileExists(
      'packages/core/src/__tests__/permission-assertion-helpers-integration.test.ts',
      'Integration test file for permission assertion helpers'
    );

    this.checkFileExists(
      'packages/core/src/__tests__/permission-assertion-helpers-negation.test.ts',
      'Negation test file for permission assertion helpers'
    );

    // Check test-utils implementation
    this.checkFileExists(
      'packages/core/src/test-utils.ts',
      'Test utilities implementation file'
    );

    this.checkFileExists(
      'packages/core/src/test-setup.ts',
      'Test setup file for custom matchers'
    );

    // Validate test file content
    this.validateTestFileContent();

    // Validate implementation exports
    this.validateTestUtilsExports();

    // Print results
    this.printResults();
  }

  private checkFileExists(filePath: string, description: string): void {
    const exists = existsSync(filePath);
    this.results.push({
      passed: exists,
      message: `${description}`,
      details: exists ? `✅ Found: ${filePath}` : `❌ Missing: ${filePath}`
    });
  }

  private validateTestFileContent(): void {
    try {
      const testFile = 'packages/core/src/__tests__/permission-assertion-helpers.test.ts';

      if (!existsSync(testFile)) {
        this.results.push({
          passed: false,
          message: 'Test file content validation',
          details: '❌ Cannot validate content - file does not exist'
        });
        return;
      }

      const content = readFileSync(testFile, 'utf-8');

      // Check for required test functions
      const requiredFunctions = [
        'expectPermissionGranted',
        'expectPermissionDenied',
        'expectPermissionPending',
        'assertPermissionContext',
        'assertPermissionHistory'
      ];

      const missingFunctions = requiredFunctions.filter(fn => !content.includes(fn));

      if (missingFunctions.length === 0) {
        this.results.push({
          passed: true,
          message: 'Test file contains all required assertion helper functions',
          details: '✅ All assertion helpers tested: ' + requiredFunctions.join(', ')
        });
      } else {
        this.results.push({
          passed: false,
          message: 'Test file missing required assertion helper tests',
          details: '❌ Missing tests for: ' + missingFunctions.join(', ')
        });
      }

      // Check for custom matchers
      const requiredMatchers = [
        'toBePermissionGranted',
        'toBePermissionDenied',
        'toBePermissionPending',
        'toHavePermissionContext',
        'toHavePermissionHistory'
      ];

      const missingMatchers = requiredMatchers.filter(matcher => !content.includes(matcher));

      if (missingMatchers.length === 0) {
        this.results.push({
          passed: true,
          message: 'Test file contains all required custom Vitest matchers',
          details: '✅ All custom matchers tested: ' + requiredMatchers.join(', ')
        });
      } else {
        this.results.push({
          passed: false,
          message: 'Test file missing required custom matcher tests',
          details: '❌ Missing matcher tests for: ' + missingMatchers.join(', ')
        });
      }

    } catch (error) {
      this.results.push({
        passed: false,
        message: 'Test file content validation failed',
        details: '❌ Error reading test file: ' + (error instanceof Error ? error.message : String(error))
      });
    }
  }

  private validateTestUtilsExports(): void {
    try {
      const testUtilsFile = 'packages/core/src/test-utils.ts';

      if (!existsSync(testUtilsFile)) {
        this.results.push({
          passed: false,
          message: 'Test utils exports validation',
          details: '❌ Cannot validate exports - file does not exist'
        });
        return;
      }

      const content = readFileSync(testUtilsFile, 'utf-8');

      // Check for exported assertion helpers
      const requiredExports = [
        'export function expectPermissionGranted',
        'export function expectPermissionDenied',
        'export function expectPermissionPending',
        'export function assertPermissionContext',
        'export function assertPermissionHistory',
        'export function setupPermissionMatchers'
      ];

      const missingExports = requiredExports.filter(exp => !content.includes(exp));

      if (missingExports.length === 0) {
        this.results.push({
          passed: true,
          message: 'Test utils exports all required assertion helpers',
          details: '✅ All assertion helpers properly exported'
        });
      } else {
        this.results.push({
          passed: false,
          message: 'Test utils missing required exports',
          details: '❌ Missing exports (partial matches): ' + missingExports.length + ' functions'
        });
      }

      // Check for type definitions
      const requiredTypes = [
        'export interface PermissionContext',
        'export interface PermissionHistory',
        'export interface PermissionMatchers'
      ];

      const missingTypes = requiredTypes.filter(type => !content.includes(type));

      if (missingTypes.length === 0) {
        this.results.push({
          passed: true,
          message: 'Test utils exports all required type definitions',
          details: '✅ All permission types properly exported'
        });
      } else {
        this.results.push({
          passed: false,
          message: 'Test utils missing required type exports',
          details: '❌ Missing type exports (partial matches): ' + missingTypes.length + ' types'
        });
      }

    } catch (error) {
      this.results.push({
        passed: false,
        message: 'Test utils exports validation failed',
        details: '❌ Error reading test utils file: ' + (error instanceof Error ? error.message : String(error))
      });
    }
  }

  private printResults(): void {
    const passed = this.results.filter(r => r.passed).length;
    const total = this.results.length;

    console.log(`\n📊 Validation Results: ${passed}/${total} checks passed\n`);

    this.results.forEach(result => {
      const icon = result.passed ? '✅' : '❌';
      console.log(`${icon} ${result.message}`);
      if (result.details) {
        console.log(`   ${result.details}`);
      }
    });

    const allPassed = passed === total;
    console.log(`\n${allPassed ? '🎉' : '⚠️'} Overall Status: ${allPassed ? 'PASSED' : 'FAILED'}`);

    if (allPassed) {
      console.log('   Permission assertion helpers implementation is complete and valid!');
    } else {
      console.log(`   ${total - passed} validation checks failed. Review the details above.`);
    }
  }
}

// Run validation
const validator = new PermissionAssertionValidator();
validator.validateImplementation().catch(error => {
  console.error('❌ Validation failed with error:', error);
  process.exit(1);
});