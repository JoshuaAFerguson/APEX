/**
 * @fileoverview Test Suite Validation
 *
 * Validates that our JSDoc testing infrastructure is working correctly
 * and can detect documentation issues.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('JSDoc Test Suite Validation', () => {
  const testDir = __dirname;
  const utilsFilePath = path.join(__dirname, '..', 'utils.ts');

  beforeAll(() => {
    // Ensure required files exist
    expect(fs.existsSync(utilsFilePath)).toBe(true);
  });

  it('should have created JSDoc validation test files', () => {
    const expectedTestFiles = [
      'jsdoc-interface-validation.test.ts',
      'jsdoc-example-compilation.test.ts',
      'jsdoc-coverage-report.test.ts'
    ];

    expectedTestFiles.forEach(fileName => {
      const filePath = path.join(testDir, fileName);
      expect(fs.existsSync(filePath)).toBe(true);

      // Verify file has meaningful content
      const content = fs.readFileSync(filePath, 'utf8');
      expect(content.length).toBeGreaterThan(1000);
      expect(content).toMatch(/describe|it|expect/);
    });
  });

  it('should detect JSDoc presence for critical interfaces', () => {
    const utilsContent = fs.readFileSync(utilsFilePath, 'utf8');
    const criticalInterfaces = ['SemVer', 'ConventionalCommit', 'CodeBlock', 'ConflictInfo', 'GitLogEntry', 'TruncateOptions', 'TruncateResult'];

    criticalInterfaces.forEach(interfaceName => {
      // Check if interface exists
      const interfacePattern = new RegExp(`export interface ${interfaceName}`);
      expect(interfacePattern.test(utilsContent)).toBe(true);

      // Check if it has JSDoc
      const jsdocPattern = new RegExp(`\\/\\*\\*[\\s\\S]*?\\*\\/\\s*export interface ${interfaceName}`);
      expect(jsdocPattern.test(utilsContent)).toBe(true);
    });
  });

  it('should verify example tags are present', () => {
    const utilsContent = fs.readFileSync(utilsFilePath, 'utf8');
    const criticalInterfaces = ['SemVer', 'ConventionalCommit', 'CodeBlock', 'ConflictInfo', 'GitLogEntry', 'TruncateOptions', 'TruncateResult'];

    criticalInterfaces.forEach(interfaceName => {
      const jsdocPattern = new RegExp(`\\/\\*\\*([\\s\\S]*?)\\*\\/\\s*export interface ${interfaceName}`);
      const match = utilsContent.match(jsdocPattern);

      expect(match).toBeTruthy();

      if (match) {
        const jsdocContent = match[1];
        expect(jsdocContent).toMatch(/@example/);
      }
    });
  });

  it('should validate test file structure', () => {
    const testFiles = [
      'jsdoc-interface-validation.test.ts',
      'jsdoc-example-compilation.test.ts',
      'jsdoc-coverage-report.test.ts'
    ];

    testFiles.forEach(fileName => {
      const filePath = path.join(testDir, fileName);
      const content = fs.readFileSync(filePath, 'utf8');

      // Should have proper imports
      expect(content).toMatch(/import.*vitest/);
      expect(content).toMatch(/import.*fs/);
      expect(content).toMatch(/import.*path/);

      // Should have describe blocks
      expect(content).toMatch(/describe\(/);

      // Should have test cases
      expect(content).toMatch(/it\(/);

      // Should have expectations
      expect(content).toMatch(/expect\(/);
    });
  });

  it('should generate coverage insights', () => {
    const utilsContent = fs.readFileSync(utilsFilePath, 'utf8');

    // Count total exported interfaces
    const exportedInterfaces = (utilsContent.match(/export interface \w+/g) || []).length;

    // Count documented interfaces (with JSDoc)
    const jsdocBlocks = utilsContent.match(/\/\*\*[\s\S]*?\*\/\s*export interface/g) || [];
    const documentedInterfaces = jsdocBlocks.length;

    console.log(`\n📊 Quick Coverage Check:`);
    console.log(`   Total exported interfaces: ${exportedInterfaces}`);
    console.log(`   Documented interfaces: ${documentedInterfaces}`);
    console.log(`   Coverage: ${exportedInterfaces > 0 ? ((documentedInterfaces / exportedInterfaces) * 100).toFixed(1) : 100}%`);

    expect(exportedInterfaces).toBeGreaterThan(0);
    expect(documentedInterfaces).toBeGreaterThan(0);
  });

  it('should pass basic compilation check', () => {
    // This test validates that our test files are syntactically correct
    // by the fact that they loaded and are running

    const testFiles = [
      'jsdoc-interface-validation.test.ts',
      'jsdoc-example-compilation.test.ts',
      'jsdoc-coverage-report.test.ts'
    ];

    testFiles.forEach(fileName => {
      const filePath = path.join(testDir, fileName);
      expect(fs.existsSync(filePath)).toBe(true);

      // If we can read and parse the file, it passed basic syntax check
      const content = fs.readFileSync(filePath, 'utf8');
      expect(content).toBeTruthy();
      expect(() => {
        // Basic JavaScript parsing - would throw if syntax is invalid
        new Function(content.replace(/import.*from.*;/g, '// import'));
      }).not.toThrow();
    });
  });
});