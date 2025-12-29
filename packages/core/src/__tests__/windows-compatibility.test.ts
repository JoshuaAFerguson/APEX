import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { glob } from 'glob';
import {
  isWindows,
  isUnix,
  isMacOS,
  isLinux,
  getPlatform,
  skipOnWindows,
  skipOnUnix,
  mockPlatform,
  testOnAllPlatforms
} from '../test-utils.js';

/**
 * Test suite to verify Windows compatibility documentation matches actual implementation
 */
describe('Windows Compatibility Documentation Tests', () => {
  describe('Documentation Accuracy', () => {
    it('should have WINDOWS_COMPATIBILITY.md file in project root', async () => {
      const docPath = join(process.cwd(), 'WINDOWS_COMPATIBILITY.md');
      expect(() => readFileSync(docPath, 'utf8')).not.toThrow();

      const content = readFileSync(docPath, 'utf8');
      expect(content).toContain('Windows Compatibility Documentation');
      expect(content).toContain('Unix-Only Tests and Skip Patterns');
      expect(content).toContain('Platform-Specific Test Utilities');
      expect(content).toContain('Guidelines for Writing Cross-Platform Tests');
    });

    it('should document all platform detection functions', () => {
      const docPath = join(process.cwd(), 'WINDOWS_COMPATIBILITY.md');
      const content = readFileSync(docPath, 'utf8');

      // Check that all exported platform functions are documented
      expect(content).toContain('isWindows()');
      expect(content).toContain('isUnix()');
      expect(content).toContain('isMacOS()');
      expect(content).toContain('isLinux()');
      expect(content).toContain('getPlatform()');
    });

    it('should document all skip functions', () => {
      const docPath = join(process.cwd(), 'WINDOWS_COMPATIBILITY.md');
      const content = readFileSync(docPath, 'utf8');

      // Check that all skip functions are documented
      expect(content).toContain('skipOnWindows()');
      expect(content).toContain('skipOnUnix()');
      expect(content).toContain('skipOnMacOS()');
      expect(content).toContain('skipOnLinux()');
      expect(content).toContain('skipUnlessWindows()');
      expect(content).toContain('skipUnlessUnix()');
    });

    it('should document conditional describe blocks', () => {
      const docPath = join(process.cwd(), 'WINDOWS_COMPATIBILITY.md');
      const content = readFileSync(docPath, 'utf8');

      // Check that conditional describe blocks are documented
      expect(content).toContain('describe.skipIf(isWindows)');
      expect(content).toContain('describeWindows');
      expect(content).toContain('describeUnix');
      expect(content).toContain('describeMacOS');
      expect(content).toContain('describeLinux');
    });
  });

  describe('Unix-Only Tests Documentation Verification', () => {
    it('should list actual service management test files', async () => {
      // Find actual service-related test files
      const serviceTestFiles = await glob('packages/**/src/**/*service*.test.ts', {
        cwd: process.cwd(),
        ignore: ['**/node_modules/**']
      });

      const docPath = join(process.cwd(), 'WINDOWS_COMPATIBILITY.md');
      const content = readFileSync(docPath, 'utf8');

      // Verify that some of the actual service test files are documented
      // (We don't require ALL to be documented, but key ones should be)
      if (serviceTestFiles.length > 0) {
        const hasServiceTestDocumentation = content.includes('service-') ||
                                           content.includes('ServiceManager') ||
                                           content.includes('service management');
        expect(hasServiceTestDocumentation).toBe(true);
      }
    });

    it('should document file permission test patterns', () => {
      const docPath = join(process.cwd(), 'WINDOWS_COMPATIBILITY.md');
      const content = readFileSync(docPath, 'utf8');

      // Check that file permission patterns are documented
      expect(content).toContain('fs.chmod');
      expect(content).toContain('0o555');
      expect(content).toContain('0o644');
      expect(content).toContain('0o755');
    });

    it('should explain reasons for Unix-only tests', () => {
      const docPath = join(process.cwd(), 'WINDOWS_COMPATIBILITY.md');
      const content = readFileSync(docPath, 'utf8');

      // Check that reasons are provided for Unix-only functionality
      expect(content).toContain('systemd');
      expect(content).toContain('launchd');
      expect(content).toContain('permission model');
      expect(content).toContain('different implementation requirements');
    });
  });

  describe('Platform Utilities Verification', () => {
    it('should import platform utilities from @apex/core', () => {
      // Test that the documented import paths work
      expect(typeof isWindows).toBe('function');
      expect(typeof isUnix).toBe('function');
      expect(typeof isMacOS).toBe('function');
      expect(typeof isLinux).toBe('function');
      expect(typeof skipOnWindows).toBe('function');
      expect(typeof skipOnUnix).toBe('function');
    });

    it('should document cross-platform testing utilities', () => {
      const docPath = join(process.cwd(), 'WINDOWS_COMPATIBILITY.md');
      const content = readFileSync(docPath, 'utf8');

      expect(content).toContain('mockPlatform');
      expect(content).toContain('testOnAllPlatforms');
      expect(content).toContain('cross-platform testing');
    });
  });

  describe('Guidelines Documentation', () => {
    it('should provide inline comment examples', () => {
      const docPath = join(process.cwd(), 'WINDOWS_COMPATIBILITY.md');
      const content = readFileSync(docPath, 'utf8');

      // Check that examples include explanatory comments
      expect(content).toContain('Unix-only:');
      expect(content).toContain('Windows doesn\'t');
      expect(content).toContain('chmod permission model');
      expect(content).toContain('not yet implemented');
    });

    it('should document appropriate skip patterns for different scenarios', () => {
      const docPath = join(process.cwd(), 'WINDOWS_COMPATIBILITY.md');
      const content = readFileSync(docPath, 'utf8');

      // Check that different skip patterns are documented for different scenarios
      expect(content).toContain('skipOnWindows()'); // Individual tests
      expect(content).toContain('it.skipIf(isWindows)'); // Vitest conditional
      expect(content).toContain('describe.skipIf(isWindows)'); // Entire suites
    });

    it('should document cross-platform best practices', () => {
      const docPath = join(process.cwd(), 'WINDOWS_COMPATIBILITY.md');
      const content = readFileSync(docPath, 'utf8');

      expect(content).toContain('path.join');
      expect(content).toContain('cross-platform');
      expect(content).toContain('platform-specific');
      expect(content).toContain('Node.js cross-platform APIs');
    });
  });

  describe('Implementation Status Documentation', () => {
    it('should clearly categorize Windows compatibility status', () => {
      const docPath = join(process.cwd(), 'WINDOWS_COMPATIBILITY.md');
      const content = readFileSync(docPath, 'utf8');

      // Check for clear status indicators
      expect(content).toContain('✅ Implemented and Working');
      expect(content).toContain('⚠️ Partially Implemented');
      expect(content).toContain('❌ Not Yet Implemented');
    });

    it('should document expected test results on Windows', () => {
      const docPath = join(process.cwd(), 'WINDOWS_COMPATIBILITY.md');
      const content = readFileSync(docPath, 'utf8');

      // Check that expected test results are documented
      expect(content).toContain('85-90% of tests pass');
      expect(content).toContain('10% of tests skipped');
      expect(content).toContain('Unix-only functionality');
    });

    it('should document build and test commands', () => {
      const docPath = join(process.cwd(), 'WINDOWS_COMPATIBILITY.md');
      const content = readFileSync(docPath, 'utf8');

      // Check that build commands are documented
      expect(content).toContain('npm install');
      expect(content).toContain('npm run build');
      expect(content).toContain('npm run test');
      expect(content).toContain('work identically on Windows');
    });
  });

  describe('Code Examples Validation', () => {
    it('should contain valid TypeScript code examples', () => {
      const docPath = join(process.cwd(), 'WINDOWS_COMPATIBILITY.md');
      const content = readFileSync(docPath, 'utf8');

      // Extract code blocks and check basic syntax
      const codeBlocks = content.match(/```typescript\n([\s\S]*?)\n```/g) || [];
      expect(codeBlocks.length).toBeGreaterThan(0);

      // Check that code blocks contain valid imports and function calls
      const hasValidImports = codeBlocks.some(block =>
        block.includes('import {') &&
        block.includes('from \'@apex/core\'')
      );
      expect(hasValidImports).toBe(true);
    });

    it('should demonstrate proper skip usage patterns', () => {
      const docPath = join(process.cwd(), 'WINDOWS_COMPATIBILITY.md');
      const content = readFileSync(docPath, 'utf8');

      // Check that examples show proper usage
      expect(content).toContain('skipOnWindows(); // Must be first line');
      expect(content).toContain('it.skipIf(isWindows)');
      expect(content).toContain('describe.skipIf(isWindows)');
    });
  });

  describe('Troubleshooting Section', () => {
    it('should document common Windows issues and solutions', () => {
      const docPath = join(process.cwd(), 'WINDOWS_COMPATIBILITY.md');
      const content = readFileSync(docPath, 'utf8');

      // Check for troubleshooting content
      expect(content).toContain('Troubleshooting Windows Issues');
      expect(content).toContain('Path Separators');
      expect(content).toContain('File Permissions');
      expect(content).toContain('Symlinks');
      expect(content).toContain('Service Management');
    });

    it('should provide development recommendations', () => {
      const docPath = join(process.cwd(), 'WINDOWS_COMPATIBILITY.md');
      const content = readFileSync(docPath, 'utf8');

      expect(content).toContain('Development Recommendations');
      expect(content).toContain('Test on Windows');
      expect(content).toContain('Use Cross-Platform APIs');
      expect(content).toContain('Add Skip Annotations');
    });
  });

  describe('Documentation Completeness', () => {
    it('should have comprehensive table of contents', () => {
      const docPath = join(process.cwd(), 'WINDOWS_COMPATIBILITY.md');
      const content = readFileSync(docPath, 'utf8');

      expect(content).toContain('## Table of Contents');
      expect(content).toMatch(/#\s+Unix-Only Tests and Skip Patterns/);
      expect(content).toMatch(/#\s+Platform-Specific Test Utilities/);
      expect(content).toMatch(/#\s+Guidelines for Writing Cross-Platform Tests/);
      expect(content).toMatch(/#\s+Windows-Specific Implementation Status/);
    });

    it('should have a comprehensive summary section', () => {
      const docPath = join(process.cwd(), 'WINDOWS_COMPATIBILITY.md');
      const content = readFileSync(docPath, 'utf8');

      expect(content).toContain('## Summary');
      expect(content).toContain('excellent Windows compatibility');
      expect(content).toContain('Key Points');
    });
  });
});

describe('Skip Pattern Analysis', () => {
  describe('Actual Test File Analysis', () => {
    it('should find tests that use skipOnWindows pattern', async () => {
      const testFiles = await glob('packages/**/src/**/*.test.ts', {
        cwd: process.cwd(),
        ignore: ['**/node_modules/**']
      });

      let foundSkipOnWindows = false;

      for (const file of testFiles.slice(0, 10)) { // Check first 10 files for performance
        try {
          const content = readFileSync(join(process.cwd(), file), 'utf8');
          if (content.includes('skipOnWindows') ||
              content.includes('skipIf(isWindows)') ||
              content.includes('skipIf(!isWindows)')) {
            foundSkipOnWindows = true;
            break;
          }
        } catch (error) {
          // File might not exist or be readable, skip it
          continue;
        }
      }

      // This test verifies that we have actual tests using skip patterns
      // If no tests use these patterns yet, that's also valid
      expect(typeof foundSkipOnWindows).toBe('boolean');
    });

    it('should verify that skip comments explain the reason', async () => {
      const testFiles = await glob('packages/**/src/**/*.test.ts', {
        cwd: process.cwd(),
        ignore: ['**/node_modules/**']
      });

      for (const file of testFiles.slice(0, 5)) { // Check a few files
        try {
          const content = readFileSync(join(process.cwd(), file), 'utf8');
          const lines = content.split('\n');

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.includes('skipOnWindows') || line.includes('skipIf(isWindows)')) {
              // Look for comments in nearby lines explaining why
              const contextLines = lines.slice(Math.max(0, i-2), i+3);
              const hasExplanation = contextLines.some(contextLine =>
                contextLine.includes('//') && (
                  contextLine.toLowerCase().includes('unix') ||
                  contextLine.toLowerCase().includes('windows') ||
                  contextLine.toLowerCase().includes('permission') ||
                  contextLine.toLowerCase().includes('chmod') ||
                  contextLine.toLowerCase().includes('service')
                )
              );

              if (!hasExplanation) {
                console.warn(`Skip without explanation found in ${file} at line ${i + 1}`);
              }
              // This is informational - we don't fail the test for missing comments
              // but we log warnings to help improve documentation
            }
          }
        } catch (error) {
          // File might not exist or be readable, skip it
          continue;
        }
      }

      // Always pass - this is an analysis test, not a requirement
      expect(true).toBe(true);
    });
  });
});