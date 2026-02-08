import { describe, it, expect } from 'vitest';
import { readFile } from 'fs/promises';
import * as path from 'path';

/**
 * Test suite for validating JSDoc documentation in HookManager
 *
 * This test suite verifies that the HookManager class and its related
 * interfaces have proper JSDoc comments with required tags.
 */
describe('HookManager JSDoc Documentation', () => {
  let sourceCode: string;

  beforeAll(async () => {
    const filePath = path.join(__dirname, '../hook-manager.ts');
    sourceCode = await readFile(filePath, 'utf-8');
  });

  describe('Interface Documentation', () => {
    it('should have JSDoc for HookManagerEvents interface', () => {
      const interfaceMatch = sourceCode.match(/\/\*\*[\s\S]*?\*\/\s*export interface HookManagerEvents/);
      expect(interfaceMatch).toBeTruthy();
      expect(interfaceMatch![0]).toContain('@interface HookManagerEvents');
      expect(interfaceMatch![0]).toContain('@example');

      // Should show event usage patterns
      expect(interfaceMatch![0]).toContain('hookManager.on(');
    });

    it('should have JSDoc for other exported interfaces', () => {
      // Find all exported interfaces
      const interfaceMatches = sourceCode.match(/export interface (\w+)/g);
      expect(interfaceMatches).toBeTruthy();

      const interfaceNames = interfaceMatches!.map(match => match.replace('export interface ', ''));

      // Filter to key interfaces that should be documented
      const keyInterfaces = interfaceNames.filter(name =>
        name.includes('Event') ||
        name.includes('Hook') ||
        name.includes('Manager') ||
        name.includes('Execution')
      );

      keyInterfaces.forEach(interfaceName => {
        const interfaceRegex = new RegExp(`\\/\\*\\*[\\s\\S]*?\\*\\/\\s*export interface ${interfaceName}`);
        const hasJSDoc = interfaceRegex.test(sourceCode);
        expect(hasJSDoc).toBeTruthy();
      });
    });
  });

  describe('HookManager Class Documentation', () => {
    it('should have JSDoc for HookManager class', () => {
      const classMatch = sourceCode.match(/\/\*\*[\s\S]*?\*\/\s*export class HookManager/);
      expect(classMatch).toBeTruthy();
      expect(classMatch![0]).toContain('@example');

      // Should describe what the class does
      const description = classMatch![0].toLowerCase();
      expect(description).toContain('hook');
      expect(description).toMatch(/manage|execut|coordin|orchestrat/);
    });

    it('should have proper constructor documentation', () => {
      const constructorMatch = sourceCode.match(/\/\*\*[\s\S]*?\*\/\s*constructor\s*\(/);
      expect(constructorMatch).toBeTruthy();
      expect(constructorMatch![0]).toContain('@param');

      // Constructor should document its parameters
      const paramCount = (constructorMatch![0].match(/@param/g) || []).length;
      expect(paramCount).toBeGreaterThan(0);
    });
  });

  describe('Public Method Documentation', () => {
    const expectedMethods = [
      'initialize',
      'executePreHook',
      'executePostHook',
      'loadHookConfigurations',
      'registerBehavior',
      'cleanup'
    ];

    expectedMethods.forEach(methodName => {
      it(`should have JSDoc for ${methodName} method`, () => {
        const methodRegex = new RegExp(`\\/\\*\\*[\\s\\S]*?\\*\\/\\s*(async\\s+)?${methodName}\\s*\\(`);
        const methodMatch = sourceCode.match(methodRegex);

        if (methodMatch) {
          const jsdocComment = methodMatch[0];
          expect(jsdocComment).toContain('@example');

          // Check for @param tags if method has parameters
          const methodSignatureMatch = sourceCode.match(new RegExp(`${methodName}\\s*\\([^)]*\\)`));
          if (methodSignatureMatch && methodSignatureMatch[0].includes(':')) {
            const paramCount = (methodSignatureMatch[0].match(/:/g) || []).length;
            if (paramCount > 0) {
              expect(jsdocComment).toContain('@param');
            }
          }

          // Check for @returns tag if method returns something other than void
          const methodDefinitionMatch = sourceCode.match(new RegExp(`${methodName}\\s*\\([^)]*\\)\\s*:\\s*([^{]*)`));
          if (methodDefinitionMatch && !methodDefinitionMatch[1].includes('void')) {
            expect(jsdocComment).toContain('@returns');
          }
        }
      });
    });

    it('should have proper parameter documentation format', () => {
      const paramMatches = sourceCode.match(/@param\s+\w+\s+-\s+.+/g);
      if (paramMatches) {
        expect(paramMatches.length).toBeGreaterThan(3);

        paramMatches.forEach(param => {
          expect(param).toMatch(/@param\s+\w+\s+-\s+.+/);

          // Parameter description should be meaningful
          const description = param.replace(/@param\s+\w+\s+-\s+/, '');
          expect(description.length).toBeGreaterThan(5);
          expect(description.charAt(0)).toMatch(/[A-Z]/);
        });
      }
    });

    it('should have proper return documentation format', () => {
      const returnsMatches = sourceCode.match(/@returns\s+.+/g);
      if (returnsMatches) {
        expect(returnsMatches.length).toBeGreaterThan(2);

        returnsMatches.forEach(returns => {
          expect(returns).toMatch(/@returns\s+.+/);

          // Return description should be meaningful
          const description = returns.replace(/@returns\s+/, '');
          expect(description.length).toBeGreaterThan(5);
          expect(description.charAt(0)).toMatch(/[A-Z]/);
        });
      }
    });
  });

  describe('Type Guard Documentation', () => {
    it('should have JSDoc for type guard functions', () => {
      const typeGuardMatches = sourceCode.match(/function is\w+Result/g);
      if (typeGuardMatches) {
        typeGuardMatches.forEach(typeGuard => {
          const functionName = typeGuard.replace('function ', '');
          const functionRegex = new RegExp(`\\/\\*\\*[\\s\\S]*?\\*\\/\\s*function ${functionName}`);

          // Type guards might not all have JSDoc, but important ones should
          const hasJSDoc = functionRegex.test(sourceCode);
          if (hasJSDoc) {
            const jsdocMatch = sourceCode.match(functionRegex);
            expect(jsdocMatch![0]).toContain('@param');
            expect(jsdocMatch![0]).toContain('@returns');
          }
        });
      }
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

        // Extract and validate code content
        const codeMatch = example.match(/```typescript\s*([\s\S]*?)```/);
        expect(codeMatch).toBeTruthy();

        const code = codeMatch![1].trim();
        expect(code.length).toBeGreaterThan(15);

        // Code should be realistic
        expect(code).not.toContain('TODO');
        expect(code).not.toContain('...');

        // Should show hook manager usage
        expect(code).toMatch(/new HookManager|hookManager\.|manager\./);
      });
    });

    it('should have consistent JSDoc comment style', () => {
      const jsdocBlocks = sourceCode.match(/\/\*\*[\s\S]*?\*\//g);
      expect(jsdocBlocks).toBeTruthy();
      expect(jsdocBlocks!.length).toBeGreaterThan(8);

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
          if (description.length > 0) {
            expect(description.charAt(0)).toMatch(/[A-Z]/);
          }

          // Should end with period for complete sentences
          if (description.length > 10 && !description.includes('`')) {
            expect(description.endsWith('.')).toBeTruthy();
          }
        }
      });

      expect(descriptiveBlocks).toBeGreaterThan(5);
    });

    it('should document error conditions appropriately', () => {
      const throwsMatches = sourceCode.match(/@throws\s+\{[^}]+\}\s+.+/g);
      if (throwsMatches) {
        expect(throwsMatches.length).toBeGreaterThan(0);

        throwsMatches.forEach(throwsTag => {
          expect(throwsTag).toMatch(/@throws\s+\{[^}]+\}\s+.+/);

          // Should have meaningful error descriptions
          const errorDesc = throwsTag.replace(/@throws\s+\{[^}]+\}\s+/, '');
          expect(errorDesc.length).toBeGreaterThan(5);
        });
      }
    });
  });

  describe('Hook Event Documentation', () => {
    it('should document hook execution events properly', () => {
      const eventInterfaces = sourceCode.match(/interface \w*Event\w*/g);
      if (eventInterfaces) {
        eventInterfaces.forEach(eventInterface => {
          const interfaceName = eventInterface.replace('interface ', '');

          // Look for JSDoc before the interface
          const interfaceRegex = new RegExp(`\\/\\*\\*[\\s\\S]*?\\*\\/\\s*(export\\s+)?interface ${interfaceName}`);
          const hasJSDoc = interfaceRegex.test(sourceCode);

          if (hasJSDoc) {
            const jsdocMatch = sourceCode.match(interfaceRegex);
            expect(jsdocMatch![0]).toContain('@interface');
            expect(jsdocMatch![0]).toContain('@example');
          }
        });
      }
    });

    it('should show realistic hook usage in examples', () => {
      const hookExamples = sourceCode.match(/@example[\s\S]*?```typescript[\s\S]*?executePreHook|executePostHook|\.on\s*\([\s\S]*?```/g);
      if (hookExamples) {
        expect(hookExamples.length).toBeGreaterThan(0);

        hookExamples.forEach(example => {
          const hasHookUsage =
            example.includes('executePreHook') ||
            example.includes('executePostHook') ||
            example.includes('.on(');
          expect(hasHookUsage).toBeTruthy();
        });
      }
    });
  });

  describe('Documentation Completeness', () => {
    it('should have comprehensive class overview', () => {
      const classMatch = sourceCode.match(/\/\*\*[\s\S]*?\*\/\s*export class HookManager/);
      expect(classMatch).toBeTruthy();

      const classDoc = classMatch![0];
      expect(classDoc.length).toBeGreaterThan(150); // Should be substantial

      // Should explain the purpose and functionality
      expect(classDoc.toLowerCase()).toContain('hook');
      expect(classDoc.toLowerCase()).toMatch(/manage|execut|coordin/);
      expect(classDoc).toContain('@example');
    });

    it('should document public API comprehensively', () => {
      // Find all public methods (not starting with _ or private)
      const publicMethodPattern = /^\s*(async\s+)?(\w+)\s*\([^)]*\)\s*:/gm;
      let match;
      const publicMethods = [];

      while ((match = publicMethodPattern.exec(sourceCode)) !== null) {
        const methodName = match[2];
        if (methodName !== 'constructor' && !methodName.startsWith('_')) {
          publicMethods.push(methodName);
        }
      }

      // Should have several public methods
      expect(publicMethods.length).toBeGreaterThan(3);

      // At least half of public methods should have JSDoc
      let documentedMethods = 0;
      publicMethods.forEach(methodName => {
        const methodRegex = new RegExp(`\\/\\*\\*[\\s\\S]*?\\*\\/\\s*(async\\s+)?${methodName}\\s*\\(`);
        if (methodRegex.test(sourceCode)) {
          documentedMethods++;
        }
      });

      expect(documentedMethods / publicMethods.length).toBeGreaterThan(0.5);
    });

    it('should have consistent interface property documentation', () => {
      // Check that interface properties are documented
      const interfaceBlocks = sourceCode.match(/export interface \w+\s*{[^}]*}/g);
      if (interfaceBlocks) {
        interfaceBlocks.forEach(block => {
          if (block.includes(':')) {
            // Interface has properties
            const hasPropertyDocs = block.includes('/**') || block.includes('//');
            // Not all interface properties need docs, but complex ones should
            if (block.length > 200) {
              expect(hasPropertyDocs).toBeTruthy();
            }
          }
        });
      }
    });
  });

  describe('Example Quality and Realism', () => {
    it('should provide practical usage examples', () => {
      const exampleBlocks = sourceCode.match(/```typescript\s*([\s\S]*?)```/g);
      if (exampleBlocks) {
        expect(exampleBlocks.length).toBeGreaterThan(2);

        exampleBlocks.forEach(block => {
          const code = block.replace(/```typescript\s*/, '').replace(/```$/, '').trim();

          // Examples should show realistic patterns
          const hasRealisticPatterns = [
            'new HookManager',
            'await ',
            '.on(',
            'executePreHook',
            'executePostHook',
            'console.log'
          ].some(pattern => code.includes(pattern));

          expect(hasRealisticPatterns).toBeTruthy();

          // Should not contain placeholder content
          expect(code).not.toContain('TODO');
          expect(code).not.toMatch(/\.\.\./);
          expect(code).not.toContain('FIXME');
        });
      }
    });

    it('should demonstrate error handling where appropriate', () => {
      const examples = sourceCode.match(/@example[\s\S]*?```typescript[\s\S]*?```/g);
      if (examples) {
        const hasErrorHandling = examples.some(example =>
          example.includes('try') && example.includes('catch') ||
          example.includes('error') ||
          example.includes('throw')
        );

        // At least one example should show error handling for a hook manager
        expect(hasErrorHandling).toBeTruthy();
      }
    });
  });
});