import { describe, it, expect } from 'vitest';
import { readFile, readdir } from 'fs/promises';
import * as path from 'path';

/**
 * Integration test suite for JSDoc coverage across orchestrator service classes
 *
 * This test suite validates that all major service classes have comprehensive
 * JSDoc documentation following the project's documentation standards.
 */
describe('JSDoc Coverage Integration Tests', () => {
  const serviceFiles = [
    'workspace-manager.ts',
    'idle-processor.ts',
    'hook-manager.ts'
  ];

  describe('Documentation Standards Compliance', () => {
    serviceFiles.forEach(filename => {
      describe(`${filename} compliance`, () => {
        let sourceCode: string;

        beforeAll(async () => {
          const filePath = path.join(__dirname, '..', filename);
          sourceCode = await readFile(filePath, 'utf-8');
        });

        it('should have JSDoc for all exported classes', async () => {
          const exportedClasses = sourceCode.match(/export class \w+/g) || [];
          expect(exportedClasses.length).toBeGreaterThan(0);

          exportedClasses.forEach(exportedClass => {
            const className = exportedClass.replace('export class ', '');
            const classRegex = new RegExp(`\\/\\*\\*[\\s\\S]*?\\*\\/\\s*export class ${className}`);
            const hasJSDoc = classRegex.test(sourceCode);
            expect(hasJSDoc).toBeTruthy();
          });
        });

        it('should have JSDoc for all exported interfaces', async () => {
          const exportedInterfaces = sourceCode.match(/export interface \w+/g) || [];

          exportedInterfaces.forEach(exportedInterface => {
            const interfaceName = exportedInterface.replace('export interface ', '');
            const interfaceRegex = new RegExp(`\\/\\*\\*[\\s\\S]*?\\*\\/\\s*export interface ${interfaceName}`);
            const hasJSDoc = interfaceRegex.test(sourceCode);
            expect(hasJSDoc).toBeTruthy();
          });
        });

        it('should have examples in class documentation', async () => {
          const exportedClasses = sourceCode.match(/export class \w+/g) || [];

          exportedClasses.forEach(exportedClass => {
            const className = exportedClass.replace('export class ', '');
            const classRegex = new RegExp(`\\/\\*\\*[\\s\\S]*?\\*\\/\\s*export class ${className}`);
            const classMatch = sourceCode.match(classRegex);

            if (classMatch) {
              expect(classMatch[0]).toContain('@example');
            }
          });
        });

        it('should have consistent JSDoc formatting', async () => {
          const jsdocBlocks = sourceCode.match(/\/\*\*[\s\S]*?\*\//g) || [];
          expect(jsdocBlocks.length).toBeGreaterThan(5);

          jsdocBlocks.forEach(block => {
            // Each JSDoc should be well-formed
            expect(block.startsWith('/**')).toBeTruthy();
            expect(block.endsWith('*/')).toBeTruthy();

            // Should have proper line formatting
            const lines = block.split('\n');
            lines.forEach((line, index) => {
              if (index > 0 && index < lines.length - 1) {
                expect(line.trim()).toMatch(/^\*/);
              }
            });
          });
        });
      });
    });
  });

  describe('Cross-File Documentation Consistency', () => {
    it('should use consistent @example code style across all files', async () => {
      const allExamples: string[] = [];

      for (const filename of serviceFiles) {
        const filePath = path.join(__dirname, '..', filename);
        const sourceCode = await readFile(filePath, 'utf-8');
        const exampleBlocks = sourceCode.match(/```typescript\s*([\s\S]*?)```/g) || [];
        allExamples.push(...exampleBlocks);
      }

      expect(allExamples.length).toBeGreaterThan(10);

      allExamples.forEach(example => {
        const code = example.replace(/```typescript\s*/, '').replace(/```$/, '');

        // All examples should follow consistent patterns
        expect(code).not.toContain('TODO');
        expect(code).not.toContain('...');
        expect(code.trim().length).toBeGreaterThan(10);

        // Should show realistic usage patterns
        const hasRealisticUsage = [
          'new ',
          'await ',
          '.',
          'console.log',
          '=>'
        ].some(pattern => code.includes(pattern));
        expect(hasRealisticUsage).toBeTruthy();
      });
    });

    it('should use consistent parameter documentation style', async () => {
      const allParams: string[] = [];

      for (const filename of serviceFiles) {
        const filePath = path.join(__dirname, '..', filename);
        const sourceCode = await readFile(filePath, 'utf-8');
        const paramMatches = sourceCode.match(/@param\s+\w+\s+-\s+.+/g) || [];
        allParams.push(...paramMatches);
      }

      expect(allParams.length).toBeGreaterThan(15);

      allParams.forEach(param => {
        // Consistent format: @param paramName - Description
        expect(param).toMatch(/@param\s+\w+\s+-\s+.+/);

        // Description should start with capital letter
        const description = param.replace(/@param\s+\w+\s+-\s+/, '');
        expect(description.charAt(0)).toMatch(/[A-Z]/);
        expect(description.length).toBeGreaterThan(3);
      });
    });

    it('should use consistent return documentation style', async () => {
      const allReturns: string[] = [];

      for (const filename of serviceFiles) {
        const filePath = path.join(__dirname, '..', filename);
        const sourceCode = await readFile(filePath, 'utf-8');
        const returnsMatches = sourceCode.match(/@returns\s+.+/g) || [];
        allReturns.push(...returnsMatches);
      }

      if (allReturns.length > 0) {
        allReturns.forEach(returns => {
          // Consistent format: @returns Description
          expect(returns).toMatch(/@returns\s+.+/);

          // Description should start with capital letter
          const description = returns.replace(/@returns\s+/, '');
          expect(description.charAt(0)).toMatch(/[A-Z]/);
          expect(description.length).toBeGreaterThan(5);
        });
      }
    });
  });

  describe('JSDoc Tag Usage', () => {
    it('should have appropriate @interface tags for interfaces', async () => {
      let interfaceTagCount = 0;

      for (const filename of serviceFiles) {
        const filePath = path.join(__dirname, '..', filename);
        const sourceCode = await readFile(filePath, 'utf-8');
        const interfaceTags = sourceCode.match(/@interface\s+\w+/g) || [];
        interfaceTagCount += interfaceTags.length;
      }

      expect(interfaceTagCount).toBeGreaterThan(8); // Should have many interface tags
    });

    it('should have @example tags in major classes', async () => {
      let exampleTagCount = 0;

      for (const filename of serviceFiles) {
        const filePath = path.join(__dirname, '..', filename);
        const sourceCode = await readFile(filePath, 'utf-8');
        const exampleTags = sourceCode.match(/@example/g) || [];
        exampleTagCount += exampleTags.length;
      }

      expect(exampleTagCount).toBeGreaterThan(15); // Should have many examples
    });

    it('should use @throws for error documentation where appropriate', async () => {
      let throwsTagCount = 0;

      for (const filename of serviceFiles) {
        const filePath = path.join(__dirname, '..', filename);
        const sourceCode = await readFile(filePath, 'utf-8');
        const throwsTags = sourceCode.match(/@throws\s+\{[^}]+\}/g) || [];
        throwsTagCount += throwsTags.length;
      }

      expect(throwsTagCount).toBeGreaterThan(2); // Should have some error documentation
    });
  });

  describe('Documentation Quality Metrics', () => {
    it('should have substantial documentation coverage', async () => {
      let totalLines = 0;
      let documentedLines = 0;

      for (const filename of serviceFiles) {
        const filePath = path.join(__dirname, '..', filename);
        const sourceCode = await readFile(filePath, 'utf-8');
        const lines = sourceCode.split('\n');
        totalLines += lines.length;

        // Count lines with JSDoc comments
        const jsdocLines = lines.filter(line =>
          line.trim().startsWith('/**') ||
          line.trim().startsWith('*') ||
          line.trim().startsWith('*/')
        );
        documentedLines += jsdocLines.length;
      }

      // Should have reasonable documentation ratio
      const documentationRatio = documentedLines / totalLines;
      expect(documentationRatio).toBeGreaterThan(0.15); // At least 15% documentation lines
    });

    it('should have meaningful descriptions in JSDoc blocks', async () => {
      const allDescriptions: string[] = [];

      for (const filename of serviceFiles) {
        const filePath = path.join(__dirname, '..', filename);
        const sourceCode = await readFile(filePath, 'utf-8');
        const jsdocBlocks = sourceCode.match(/\/\*\*[\s\S]*?\*\//g) || [];

        jsdocBlocks.forEach(block => {
          const lines = block.split('\n');
          const firstContentLine = lines.find(line => {
            const content = line.replace(/^\s*\*\s*/, '').trim();
            return content && !content.startsWith('@');
          });

          if (firstContentLine) {
            const description = firstContentLine.replace(/^\s*\*\s*/, '').trim();
            if (description.length > 10) {
              allDescriptions.push(description);
            }
          }
        });
      }

      expect(allDescriptions.length).toBeGreaterThan(20);

      allDescriptions.forEach(description => {
        // Should be substantial descriptions
        expect(description.length).toBeGreaterThan(10);

        // Should not be placeholder text
        expect(description.toLowerCase()).not.toContain('todo');
        expect(description).not.toContain('...');
      });
    });
  });

  describe('TypeScript Integration', () => {
    it('should have proper TypeScript types in @param and @returns', async () => {
      for (const filename of serviceFiles) {
        const filePath = path.join(__dirname, '..', filename);
        const sourceCode = await readFile(filePath, 'utf-8');

        // Check that complex types are properly documented
        const typeMatches = sourceCode.match(/:\s*Promise<[^>]+>/g) || [];
        const asyncMethods = sourceCode.match(/async\s+\w+\s*\([^)]*\)/g) || [];

        // Files with async methods should document return types
        if (asyncMethods.length > 0) {
          const returnsPromise = sourceCode.match(/@returns\s+Promise/g) || [];
          expect(returnsPromise.length).toBeGreaterThan(0);
        }
      }
    });

    it('should document generic types appropriately', async () => {
      for (const filename of serviceFiles) {
        const filePath = path.join(__dirname, '..', filename);
        const sourceCode = await readFile(filePath, 'utf-8');

        // Look for generic classes or methods
        const generics = sourceCode.match(/<T[^>]*>/g) || [];

        if (generics.length > 0) {
          // Should have documentation about generic usage
          const hasGenericDocs = sourceCode.includes('@template') ||
                                sourceCode.includes('generic') ||
                                sourceCode.includes('type parameter');
          expect(hasGenericDocs).toBeTruthy();
        }
      }
    });
  });
});