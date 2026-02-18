import { describe, it, expect } from 'vitest';
import { readFile } from 'fs/promises';
import * as path from 'path';

/**
 * Test suite for validating JSDoc documentation in IdleProcessor
 *
 * This test suite verifies that the IdleProcessor class and its related
 * interfaces have proper JSDoc comments with required tags.
 */
describe('IdleProcessor JSDoc Documentation', () => {
  let sourceCode: string;

  beforeAll(async () => {
    const filePath = path.join(__dirname, '../idle-processor.ts');
    sourceCode = await readFile(filePath, 'utf-8');
  });

  describe('Type Documentation', () => {
    it('should have JSDoc for UpdateType', () => {
      const typeMatch = sourceCode.match(/\/\*\*[\s\S]*?\*\/\s*export type UpdateType/);
      expect(typeMatch).toBeTruthy();
      expect(typeMatch![0]).toContain('@typedef');
      expect(typeMatch![0]).toContain('Type of update required');
    });

    it('should have JSDoc for VulnerabilitySeverity', () => {
      const typeMatch = sourceCode.match(/\/\*\*[\s\S]*?\*\/\s*export type VulnerabilitySeverity/);
      expect(typeMatch).toBeTruthy();
      expect(typeMatch![0]).toContain('@typedef');
      expect(typeMatch![0]).toContain('Vulnerability severity level');
    });
  });

  describe('Interface Documentation', () => {
    it('should have JSDoc for exported interfaces', () => {
      // Look for interface definitions that should have JSDoc
      const interfacePattern = /export interface (\w+)/g;
      let match;
      const interfaces = [];

      while ((match = interfacePattern.exec(sourceCode)) !== null) {
        interfaces.push(match[1]);
      }

      expect(interfaces.length).toBeGreaterThan(0);

      // Check some key interfaces that should be documented
      const keyInterfaces = interfaces.filter(name =>
        name.includes('IdleProcessor') ||
        name.includes('Events') ||
        name.includes('Config') ||
        name.includes('Options')
      );

      keyInterfaces.forEach(interfaceName => {
        const interfaceRegex = new RegExp(`\\/\\*\\*[\\s\\S]*?\\*\\/\\s*export interface ${interfaceName}`);
        const hasJSDoc = interfaceRegex.test(sourceCode);
        expect(hasJSDoc).toBeTruthy();
      });
    });
  });

  describe('IdleProcessor Class Documentation', () => {
    it('should have JSDoc for IdleProcessor class', () => {
      const classMatch = sourceCode.match(/\/\*\*[\s\S]*?\*\/\s*export class IdleProcessor/);
      expect(classMatch).toBeTruthy();
      expect(classMatch![0]).toContain('@example');

      // Should describe what the class does
      expect(classMatch![0]).toContain('idle');
      expect(classMatch![0]).toContain('process');
    });

    it('should have proper constructor documentation', () => {
      const constructorMatch = sourceCode.match(/\/\*\*[\s\S]*?\*\/\s*constructor\s*\(/);
      expect(constructorMatch).toBeTruthy();
      expect(constructorMatch![0]).toContain('@param');
    });
  });

  describe('Public Method Documentation', () => {
    it('should identify and validate public methods', () => {
      // Extract public method names from the class
      const methodPattern = /^\s*(async\s+)?(\w+)\s*\([^)]*\)\s*:\s*[^{]*/gm;
      let match;
      const methods = [];

      while ((match = methodPattern.exec(sourceCode)) !== null) {
        const methodName = match[2];
        // Skip constructor and private methods (starting with _)
        if (methodName !== 'constructor' && !methodName.startsWith('_')) {
          methods.push(methodName);
        }
      }

      expect(methods.length).toBeGreaterThan(5); // Should have several public methods

      // Check that key methods have JSDoc
      const keyMethods = methods.filter(name =>
        !name.startsWith('get') ||
        name.includes('start') ||
        name.includes('stop') ||
        name.includes('initialize') ||
        name.includes('process')
      ).slice(0, 5); // Test first 5 key methods

      keyMethods.forEach(methodName => {
        const methodRegex = new RegExp(`\\/\\*\\*[\\s\\S]*?\\*\\/\\s*(async\\s+)?${methodName}\\s*\\(`);
        const hasJSDoc = methodRegex.test(sourceCode);
        expect(hasJSDoc).toBeTruthy();
      });
    });

    it('should have proper parameter documentation for methods with parameters', () => {
      // Find methods with parameters and check they have @param tags
      const methodsWithParams = sourceCode.match(/\/\*\*[\s\S]*?@param[\s\S]*?\*\/\s*(async\s+)?\w+\s*\([^)]+\)/g);
      expect(methodsWithParams).toBeTruthy();
      expect(methodsWithParams!.length).toBeGreaterThan(3);
    });

    it('should have proper return documentation for methods that return values', () => {
      // Find methods with return types and check they have @returns tags
      const methodsWithReturns = sourceCode.match(/\/\*\*[\s\S]*?@returns[\s\S]*?\*\/\s*(async\s+)?\w+\s*\([^)]*\)\s*:\s*(?!void)/g);
      expect(methodsWithReturns).toBeTruthy();
      expect(methodsWithReturns!.length).toBeGreaterThan(2);
    });
  });

  describe('JSDoc Format Validation', () => {
    it('should have properly formatted @example blocks with TypeScript code', () => {
      const exampleMatches = sourceCode.match(/@example\s*\n\s*\*\s*```typescript[\s\S]*?```/g);
      expect(exampleMatches).toBeTruthy();
      expect(exampleMatches!.length).toBeGreaterThan(3);

      exampleMatches!.forEach(example => {
        expect(example).toContain('```typescript');
        expect(example).toContain('```');

        // Extract code content
        const codeMatch = example.match(/```typescript\s*([\s\S]*?)```/);
        expect(codeMatch).toBeTruthy();

        const code = codeMatch![1].trim();
        expect(code.length).toBeGreaterThan(10);
        expect(code).not.toContain('TODO');
        expect(code).not.toContain('...');
      });
    });

    it('should have consistent parameter documentation format', () => {
      const paramMatches = sourceCode.match(/@param\s+\w+\s+-\s+.+/g);
      if (paramMatches) {
        paramMatches.forEach(param => {
          expect(param).toMatch(/@param\s+\w+\s+-\s+.+/);

          // Parameter description should start with capital letter
          const description = param.replace(/@param\s+\w+\s+-\s+/, '');
          expect(description.charAt(0)).toMatch(/[A-Z]/);
        });
      }
    });

    it('should have consistent return documentation format', () => {
      const returnsMatches = sourceCode.match(/@returns\s+.+/g);
      if (returnsMatches) {
        returnsMatches.forEach(returns => {
          expect(returns).toMatch(/@returns\s+.+/);

          // Return description should start with capital letter
          const description = returns.replace(/@returns\s+/, '');
          expect(description.charAt(0)).toMatch(/[A-Z]/);
        });
      }
    });
  });

  describe('Event Documentation', () => {
    it('should document event-related interfaces properly', () => {
      // Look for event-related interfaces
      const eventInterfaces = sourceCode.match(/export interface \w*Event\w*/g);
      if (eventInterfaces) {
        eventInterfaces.forEach(eventInterface => {
          const interfaceName = eventInterface.replace('export interface ', '');
          const interfaceRegex = new RegExp(`\\/\\*\\*[\\s\\S]*?\\*\\/\\s*export interface ${interfaceName}`);
          const hasJSDoc = interfaceRegex.test(sourceCode);
          expect(hasJSDoc).toBeTruthy();
        });
      }
    });

    it('should have examples showing event usage', () => {
      const eventExamples = sourceCode.match(/@example[\s\S]*?```typescript[\s\S]*?\.on\s*\([\s\S]*?```/g);
      if (eventExamples) {
        expect(eventExamples.length).toBeGreaterThan(0);

        eventExamples.forEach(example => {
          expect(example).toContain('.on(');
          expect(example).toContain('=>');
        });
      }
    });
  });

  describe('Documentation Completeness', () => {
    it('should have comprehensive class description', () => {
      const classMatch = sourceCode.match(/\/\*\*[\s\S]*?\*\/\s*export class IdleProcessor/);
      expect(classMatch).toBeTruthy();

      const description = classMatch![0];
      expect(description.length).toBeGreaterThan(100); // Should be substantial
      expect(description).toContain('idle');
      expect(description).toContain('@example');
    });

    it('should document error conditions with @throws tags', () => {
      const throwsMatches = sourceCode.match(/@throws\s+\{[^}]+\}\s+.+/g);
      if (throwsMatches) {
        expect(throwsMatches.length).toBeGreaterThan(0);

        throwsMatches.forEach(throwsTag => {
          expect(throwsTag).toMatch(/@throws\s+\{[^}]+\}\s+.+/);
        });
      }
    });

    it('should have consistent documentation style across all JSDoc blocks', () => {
      const jsdocBlocks = sourceCode.match(/\/\*\*[\s\S]*?\*\//g);
      expect(jsdocBlocks).toBeTruthy();
      expect(jsdocBlocks!.length).toBeGreaterThan(10);

      let descriptiveBlocks = 0;

      jsdocBlocks!.forEach(block => {
        const lines = block.split('\n');
        const firstContentLine = lines.find(line => {
          const content = line.replace(/^\s*\*\s*/, '').trim();
          return content && !content.startsWith('@');
        });

        if (firstContentLine) {
          descriptiveBlocks++;
          const description = firstContentLine.replace(/^\s*\*\s*/, '').trim();

          // Should start with capital letter
          expect(description.charAt(0)).toMatch(/[A-Z]/);

          // Should end with period (unless it's very short or contains special formatting)
          if (description.length > 10 && !description.includes('`') && !description.includes('@')) {
            expect(description.endsWith('.')).toBeTruthy();
          }
        }
      });

      expect(descriptiveBlocks).toBeGreaterThan(5);
    });
  });

  describe('Code Quality in Examples', () => {
    it('should have realistic usage examples', () => {
      const exampleBlocks = sourceCode.match(/```typescript\s*([\s\S]*?)```/g);
      if (exampleBlocks) {
        expect(exampleBlocks.length).toBeGreaterThan(2);

        exampleBlocks.forEach(block => {
          const code = block.replace(/```typescript\s*/, '').replace(/```$/, '').trim();

          // Should show actual instantiation or usage
          const hasRealisticUsage =
            code.includes('new IdleProcessor') ||
            code.includes('processor.') ||
            code.includes('await ') ||
            code.includes('.on(') ||
            code.includes('console.log');

          expect(hasRealisticUsage).toBeTruthy();
        });
      }
    });
  });
});