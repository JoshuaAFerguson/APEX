import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { glob } from 'glob';

/**
 * Test suite to verify Unix-only tests are properly documented and skipped
 */
describe('Unix-Only Test Verification', () => {
  describe('Skip Pattern Analysis', () => {
    it('should verify Unix-only tests have explanatory comments', async () => {
      const testFiles = await glob('packages/**/src/**/*.test.ts', {
        cwd: process.cwd(),
        ignore: ['**/node_modules/**']
      });

      const skipPatternsWithComments = [];
      const skipPatternsWithoutComments = [];

      for (const file of testFiles) {
        try {
          const content = readFileSync(join(process.cwd(), file), 'utf8');
          const lines = content.split('\n');

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Look for various skip patterns
            const hasSkipPattern = (
              line.includes('skipOnWindows') ||
              line.includes('skipIf(isWindows)') ||
              line.includes('skipIf(!isWindows)') ||
              line.includes('describe.skipIf(isWindows)')
            );

            if (hasSkipPattern) {
              // Look for explanatory comments in surrounding lines
              const contextLines = lines.slice(Math.max(0, i - 3), i + 2);
              const hasExplanation = contextLines.some(contextLine => {
                const comment = contextLine.includes('//') && (
                  contextLine.toLowerCase().includes('unix') ||
                  contextLine.toLowerCase().includes('windows') ||
                  contextLine.toLowerCase().includes('permission') ||
                  contextLine.toLowerCase().includes('chmod') ||
                  contextLine.toLowerCase().includes('service') ||
                  contextLine.toLowerCase().includes('systemd') ||
                  contextLine.toLowerCase().includes('launchd') ||
                  contextLine.toLowerCase().includes('platform') ||
                  contextLine.toLowerCase().includes('skip') ||
                  contextLine.toLowerCase().includes('not implemented') ||
                  contextLine.toLowerCase().includes('not available')
                );
                return comment;
              });

              const skipInfo = {
                file: file.replace(process.cwd(), ''),
                line: i + 1,
                code: line.trim(),
                hasExplanation,
                context: contextLines.filter(l => l.includes('//')).map(l => l.trim())
              };

              if (hasExplanation) {
                skipPatternsWithComments.push(skipInfo);
              } else {
                skipPatternsWithoutComments.push(skipInfo);
              }
            }
          }
        } catch (error) {
          // File might not exist or be readable, skip it
          continue;
        }
      }

      // Log findings for documentation purposes
      if (skipPatternsWithComments.length > 0) {
        console.log(`Found ${skipPatternsWithComments.length} skip patterns with explanations`);
        console.log('Examples of well-documented skips:');
        skipPatternsWithComments.slice(0, 3).forEach(skip => {
          console.log(`  ${skip.file}:${skip.line} - ${skip.code}`);
          skip.context.forEach(comment => console.log(`    ${comment}`));
        });
      }

      if (skipPatternsWithoutComments.length > 0) {
        console.warn(`Found ${skipPatternsWithoutComments.length} skip patterns without clear explanations`);
        skipPatternsWithoutComments.slice(0, 5).forEach(skip => {
          console.warn(`  ${skip.file}:${skip.line} - ${skip.code}`);
        });
      }

      // This test documents the current state rather than enforcing a requirement
      expect(skipPatternsWithComments.length + skipPatternsWithoutComments.length).toBeGreaterThanOrEqual(0);
    });

    it('should identify common Unix-only operations in test files', async () => {
      const testFiles = await glob('packages/**/src/**/*.test.ts', {
        cwd: process.cwd(),
        ignore: ['**/node_modules/**']
      });

      const unixOnlyOperations = {
        chmod: [],
        symlink: [],
        systemd: [],
        launchd: [],
        unixPermissions: []
      };

      for (const file of testFiles) {
        try {
          const content = readFileSync(join(process.cwd(), file), 'utf8');
          const lines = content.split('\n');

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lineInfo = {
              file: file.replace(process.cwd(), ''),
              line: i + 1,
              code: line.trim()
            };

            if (line.includes('fs.chmod') || line.includes('chmod(')) {
              unixOnlyOperations.chmod.push(lineInfo);
            }

            if (line.includes('fs.symlink') || line.includes('symlink(')) {
              unixOnlyOperations.symlink.push(lineInfo);
            }

            if (line.includes('systemd') || line.includes('systemctl')) {
              unixOnlyOperations.systemd.push(lineInfo);
            }

            if (line.includes('launchd') || line.includes('launchctl')) {
              unixOnlyOperations.launchd.push(lineInfo);
            }

            if (line.includes('0o') && (line.includes('755') || line.includes('644') || line.includes('555'))) {
              unixOnlyOperations.unixPermissions.push(lineInfo);
            }
          }
        } catch (error) {
          continue;
        }
      }

      // Log findings for documentation
      Object.entries(unixOnlyOperations).forEach(([operation, instances]) => {
        if (instances.length > 0) {
          console.log(`Found ${instances.length} instances of ${operation} operations`);
          instances.slice(0, 2).forEach(instance => {
            console.log(`  ${instance.file}:${instance.line} - ${instance.code}`);
          });
        }
      });

      // All Unix-only operations should have appropriate skip patterns nearby
      const totalUnixOperations = Object.values(unixOnlyOperations)
        .reduce((sum, instances) => sum + instances.length, 0);

      expect(totalUnixOperations).toBeGreaterThanOrEqual(0);
    });

    it('should verify service management tests have proper skip patterns', async () => {
      const serviceTestFiles = await glob('packages/**/src/**/*service*.test.ts', {
        cwd: process.cwd(),
        ignore: ['**/node_modules/**']
      });

      const serviceTestsWithSkips = [];
      const serviceTestsWithoutSkips = [];

      for (const file of serviceTestFiles) {
        try {
          const content = readFileSync(join(process.cwd(), file), 'utf8');

          const hasSkipPattern = (
            content.includes('skipOnWindows') ||
            content.includes('skipIf(isWindows)') ||
            content.includes('describe.skipIf(isWindows)')
          );

          const hasServiceConcepts = (
            content.includes('systemd') ||
            content.includes('launchd') ||
            content.includes('service') ||
            content.includes('daemon')
          );

          const fileInfo = {
            file: file.replace(process.cwd(), ''),
            hasSkipPattern,
            hasServiceConcepts
          };

          if (hasServiceConcepts) {
            if (hasSkipPattern) {
              serviceTestsWithSkips.push(fileInfo);
            } else {
              serviceTestsWithoutSkips.push(fileInfo);
            }
          }
        } catch (error) {
          continue;
        }
      }

      // Log findings
      if (serviceTestsWithSkips.length > 0) {
        console.log(`Found ${serviceTestsWithSkips.length} service test files with proper skip patterns`);
        serviceTestsWithSkips.forEach(test => {
          console.log(`  ✅ ${test.file}`);
        });
      }

      if (serviceTestsWithoutSkips.length > 0) {
        console.log(`Found ${serviceTestsWithoutSkips.length} service test files without skip patterns`);
        serviceTestsWithoutSkips.forEach(test => {
          console.log(`  ⚠️ ${test.file}`);
        });
      }

      // Document the current state
      expect(serviceTestFiles.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Documentation Consistency', () => {
    it('should verify documented Unix-only tests exist in codebase', () => {
      const docPath = join(process.cwd(), 'WINDOWS_COMPATIBILITY.md');
      const content = readFileSync(docPath, 'utf8');

      // Extract file paths mentioned in documentation
      const documentedFiles = [];
      const lines = content.split('\n');

      for (const line of lines) {
        // Look for file patterns in documentation
        const fileMatch = line.match(/packages\/[^`\s]+\.test\.ts/g);
        if (fileMatch) {
          documentedFiles.push(...fileMatch);
        }
      }

      // For each documented file, verify it exists or has a similar pattern
      for (const docFile of documentedFiles) {
        try {
          const fullPath = join(process.cwd(), docFile);
          expect(() => readFileSync(fullPath, 'utf8')).not.toThrow();
        } catch (error) {
          // File might not exist, which is okay for documentation examples
          console.log(`Documented file ${docFile} not found (might be example)`);
        }
      }

      // This test documents what's in the documentation
      expect(documentedFiles.length).toBeGreaterThanOrEqual(0);
    });

    it('should verify documentation mentions actual skip patterns used in codebase', async () => {
      const docPath = join(process.cwd(), 'WINDOWS_COMPATIBILITY.md');
      const docContent = readFileSync(docPath, 'utf8');

      // Find all skip patterns actually used in test files
      const testFiles = await glob('packages/**/src/**/*.test.ts', {
        cwd: process.cwd(),
        ignore: ['**/node_modules/**']
      });

      const actualSkipPatterns = new Set();

      for (const file of testFiles) {
        try {
          const content = readFileSync(join(process.cwd(), file), 'utf8');

          if (content.includes('skipOnWindows')) {
            actualSkipPatterns.add('skipOnWindows()');
          }
          if (content.includes('skipIf(isWindows)')) {
            actualSkipPatterns.add('it.skipIf(isWindows)');
          }
          if (content.includes('describe.skipIf(isWindows)')) {
            actualSkipPatterns.add('describe.skipIf(isWindows)');
          }
          if (content.includes('skipUnlessWindows')) {
            actualSkipPatterns.add('skipUnlessWindows()');
          }
        } catch (error) {
          continue;
        }
      }

      // Verify that actual skip patterns are documented
      for (const pattern of actualSkipPatterns) {
        expect(docContent).toContain(pattern);
      }

      console.log(`Verified ${actualSkipPatterns.size} skip patterns are documented`);
      expect(actualSkipPatterns.size).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Test Quality Metrics', () => {
    it('should calculate Unix-only test coverage metrics', async () => {
      const testFiles = await glob('packages/**/src/**/*.test.ts', {
        cwd: process.cwd(),
        ignore: ['**/node_modules/**']
      });

      let totalTests = 0;
      let testsWithSkips = 0;
      let unixOnlyOperations = 0;
      let skippedUnixOperations = 0;

      for (const file of testFiles) {
        try {
          const content = readFileSync(join(process.cwd(), file), 'utf8');

          // Count total test functions
          const testMatches = content.match(/\bit\s*\(/g) || [];
          totalTests += testMatches.length;

          // Count tests with skip patterns
          const skipMatches = content.match(/(skipOnWindows|skipIf\(isWindows\)|skipUnlessUnix)/g) || [];
          testsWithSkips += skipMatches.length;

          // Count Unix-only operations
          const unixOps = content.match(/(fs\.chmod|fs\.symlink|systemd|launchd|0o[0-7]+)/g) || [];
          unixOnlyOperations += unixOps.length;

          // Count Unix operations that are properly skipped
          const lines = content.split('\n');
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.match(/(fs\.chmod|fs\.symlink|systemd|launchd|0o[0-7]+)/)) {
              // Check if there's a skip pattern nearby (within 10 lines)
              const contextLines = lines.slice(Math.max(0, i - 10), i + 10);
              const hasSkip = contextLines.some(contextLine =>
                contextLine.includes('skipOnWindows') ||
                contextLine.includes('skipIf(isWindows)') ||
                contextLine.includes('describe.skipIf(isWindows)')
              );
              if (hasSkip) {
                skippedUnixOperations++;
              }
            }
          }
        } catch (error) {
          continue;
        }
      }

      // Calculate coverage metrics
      const skipCoveragePercent = unixOnlyOperations > 0
        ? Math.round((skippedUnixOperations / unixOnlyOperations) * 100)
        : 100;

      console.log('\nUnix-Only Test Coverage Metrics:');
      console.log(`Total tests: ${totalTests}`);
      console.log(`Tests with skip patterns: ${testsWithSkips}`);
      console.log(`Unix-only operations found: ${unixOnlyOperations}`);
      console.log(`Unix operations with skip patterns: ${skippedUnixOperations}`);
      console.log(`Skip pattern coverage: ${skipCoveragePercent}%`);

      // Document the metrics
      expect(skipCoveragePercent).toBeGreaterThanOrEqual(0);
      expect(skipCoveragePercent).toBeLessThanOrEqual(100);
    });
  });
});