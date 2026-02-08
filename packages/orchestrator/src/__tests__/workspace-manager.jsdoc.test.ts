import { describe, it, expect } from 'vitest';
import { readFile } from 'fs/promises';
import * as path from 'path';

/**
 * Test suite for validating JSDoc documentation in WorkspaceManager
 *
 * This test suite verifies that all major classes, interfaces, and public methods
 * have proper JSDoc comments with required tags.
 */
describe('WorkspaceManager JSDoc Documentation', () => {
  let sourceCode: string;

  beforeAll(async () => {
    const filePath = path.join(__dirname, '../workspace-manager.ts');
    sourceCode = await readFile(filePath, 'utf-8');
  });

  describe('Interface Documentation', () => {
    it('should have JSDoc for WorkspaceManagerOptions interface', () => {
      const interfaceMatch = sourceCode.match(/\/\*\*[\s\S]*?\*\/\s*export interface WorkspaceManagerOptions/);
      expect(interfaceMatch).toBeTruthy();
      expect(interfaceMatch![0]).toContain('@interface WorkspaceManagerOptions');
      expect(interfaceMatch![0]).toContain('@example');
    });

    it('should have JSDoc for WorkspaceInfo interface', () => {
      const interfaceMatch = sourceCode.match(/\/\*\*[\s\S]*?\*\/\s*export interface WorkspaceInfo/);
      expect(interfaceMatch).toBeTruthy();
      expect(interfaceMatch![0]).toContain('@interface WorkspaceInfo');
      expect(interfaceMatch![0]).toContain('@example');
    });

    it('should have JSDoc for DependencyInstallEventData interface', () => {
      const interfaceMatch = sourceCode.match(/\/\*\*[\s\S]*?\*\/\s*export interface DependencyInstallEventData/);
      expect(interfaceMatch).toBeTruthy();
      expect(interfaceMatch![0]).toContain('@interface DependencyInstallEventData');
      expect(interfaceMatch![0]).toContain('@example');
    });

    it('should have JSDoc for DependencyInstallCompletedEventData interface', () => {
      const interfaceMatch = sourceCode.match(/\/\*\*[\s\S]*?\*\/\s*export interface DependencyInstallCompletedEventData/);
      expect(interfaceMatch).toBeTruthy();
      expect(interfaceMatch![0]).toContain('@interface DependencyInstallCompletedEventData');
      expect(interfaceMatch![0]).toContain('@extends DependencyInstallEventData');
      expect(interfaceMatch![0]).toContain('@example');
    });

    it('should have JSDoc for DependencyInstallRecoveryEventData interface', () => {
      const interfaceMatch = sourceCode.match(/\/\*\*[\s\S]*?\*\/\s*export interface DependencyInstallRecoveryEventData/);
      expect(interfaceMatch).toBeTruthy();
      expect(interfaceMatch![0]).toContain('@interface DependencyInstallRecoveryEventData');
      expect(interfaceMatch![0]).toContain('@example');
    });

    it('should have JSDoc for WorkspaceManagerEvents interface', () => {
      const interfaceMatch = sourceCode.match(/\/\*\*[\s\S]*?\*\/\s*export interface WorkspaceManagerEvents/);
      expect(interfaceMatch).toBeTruthy();
      expect(interfaceMatch![0]).toContain('@interface WorkspaceManagerEvents');
      expect(interfaceMatch![0]).toContain('@example');
    });
  });

  describe('WorkspaceManager Class Documentation', () => {
    it('should have JSDoc for WorkspaceManager class', () => {
      const classMatch = sourceCode.match(/\/\*\*[\s\S]*?\*\/\s*export class WorkspaceManager/);
      expect(classMatch).toBeTruthy();
      expect(classMatch![0]).toContain('@example');
    });

    it('should have proper property documentation in interface definitions', () => {
      // Check that interface properties have proper documentation
      const workspaceOptionsMatch = sourceCode.match(/export interface WorkspaceManagerOptions\s*{([^}]*)}/);
      expect(workspaceOptionsMatch).toBeTruthy();
      expect(workspaceOptionsMatch![1]).toContain('/** The root path of the project');
      expect(workspaceOptionsMatch![1]).toContain('/** The default workspace isolation strategy');
    });
  });

  describe('Public Method Documentation', () => {
    const publicMethods = [
      'initialize',
      'createWorkspaceWithIsolation',
      'createWorkspace',
      'getWorkspace',
      'accessWorkspace',
      'cleanupWorkspace',
      'cleanupOldWorkspaces',
      'listWorkspaces',
      'getContainerRuntime',
      'supportsContainerWorkspaces',
      'getHealthMonitor',
      'getContainerManager',
      'getContainerHealth',
      'getWorkspaceStats',
      'cleanup'
    ];

    publicMethods.forEach(methodName => {
      it(`should have JSDoc for ${methodName} method`, () => {
        // Look for JSDoc comment before the method definition
        const methodRegex = new RegExp(`\\/\\*\\*[\\s\\S]*?\\*\\/\\s*async\\s+${methodName}\\s*\\(|^\\/\\*\\*[\\s\\S]*?\\*\\/\\s*${methodName}\\s*\\(`, 'm');
        const methodMatch = sourceCode.match(methodRegex);
        expect(methodMatch).toBeTruthy();

        const jsdocComment = methodMatch![0];
        expect(jsdocComment).toContain('@example');

        // Check for @param tags if method has parameters
        const methodSignatureMatch = sourceCode.match(new RegExp(`${methodName}\\s*\\([^)]*\\)`));
        if (methodSignatureMatch && methodSignatureMatch[0].includes(':')) {
          // Method has parameters, should have @param tags
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
      });
    });
  });

  describe('JSDoc Format Validation', () => {
    it('should have properly formatted @example blocks', () => {
      const exampleMatches = sourceCode.match(/@example\s*\n\s*\*\s*```typescript[\s\S]*?```/g);
      expect(exampleMatches).toBeTruthy();
      expect(exampleMatches!.length).toBeGreaterThan(10); // Should have many examples

      // Verify examples use TypeScript code blocks
      exampleMatches!.forEach(example => {
        expect(example).toContain('```typescript');
        expect(example).toContain('```');
      });
    });

    it('should have proper @param documentation format', () => {
      const paramMatches = sourceCode.match(/@param\s+\w+\s+-\s+.+/g);
      expect(paramMatches).toBeTruthy();
      expect(paramMatches!.length).toBeGreaterThan(15); // Should have many param docs

      // Verify param format: @param paramName - description
      paramMatches!.forEach(param => {
        expect(param).toMatch(/@param\s+\w+\s+-\s+.+/);
      });
    });

    it('should have proper @returns documentation format', () => {
      const returnsMatches = sourceCode.match(/@returns\s+.+/g);
      expect(returnsMatches).toBeTruthy();
      expect(returnsMatches!.length).toBeGreaterThan(10); // Should have many return docs

      // Verify returns format: @returns description
      returnsMatches!.forEach(returns => {
        expect(returns).toMatch(/@returns\s+.+/);
      });
    });

    it('should have proper @throws documentation for error cases', () => {
      const throwsMatches = sourceCode.match(/@throws\s+\{Error\}\s+.+/g);
      expect(throwsMatches).toBeTruthy();
      expect(throwsMatches!.length).toBeGreaterThan(2); // Should have some throw docs
    });
  });

  describe('Example Code Quality', () => {
    it('should have realistic and executable examples', () => {
      const exampleBlocks = sourceCode.match(/```typescript\s*([\s\S]*?)```/g);
      expect(exampleBlocks).toBeTruthy();

      exampleBlocks!.forEach(block => {
        const code = block.replace(/```typescript\s*/, '').replace(/```$/, '');

        // Examples should be non-trivial
        expect(code.trim().length).toBeGreaterThan(20);

        // Examples should show realistic usage
        expect(code).toMatch(/new WorkspaceManager|manager\.|await\s+manager/);

        // Examples should not contain placeholder text like "TODO" or "..."
        expect(code).not.toContain('TODO');
        expect(code).not.toContain('...');
      });
    });

    it('should show proper error handling in examples', () => {
      const exampleBlocks = sourceCode.match(/```typescript\s*([\s\S]*?)```/g);
      const hasErrorHandlingExample = exampleBlocks!.some(block =>
        block.includes('try') && block.includes('catch') ||
        block.includes('if (') && block.includes('error')
      );
      expect(hasErrorHandlingExample).toBeTruthy();
    });
  });

  describe('Documentation Completeness', () => {
    it('should document all exported interfaces', () => {
      const exportedInterfaces = sourceCode.match(/export interface \w+/g);
      expect(exportedInterfaces).toBeTruthy();

      exportedInterfaces!.forEach(exportInterface => {
        const interfaceName = exportInterface.replace('export interface ', '');
        const hasJSDoc = sourceCode.includes(`@interface ${interfaceName}`);
        expect(hasJSDoc).toBeTruthy();
      });
    });

    it('should document all exported types', () => {
      const exportedTypes = sourceCode.match(/export type \w+/g) || [];

      exportedTypes.forEach(exportType => {
        const typeName = exportType.replace('export type ', '');
        // Look for JSDoc comment before the type definition
        const typeRegex = new RegExp(`\\/\\*\\*[\\s\\S]*?\\*\\/\\s*export type ${typeName}`);
        const hasJSDoc = typeRegex.test(sourceCode);
        expect(hasJSDoc).toBeTruthy();
      });
    });

    it('should have consistent documentation style', () => {
      const jsdocBlocks = sourceCode.match(/\/\*\*[\s\S]*?\*\//g);
      expect(jsdocBlocks).toBeTruthy();

      jsdocBlocks!.forEach(block => {
        // Each JSDoc block should start with a capital letter and end with a period
        const firstLine = block.split('\n')[0];
        const description = firstLine.replace(/\/\*\*\s*/, '').trim();

        if (description && !description.startsWith('@')) {
          expect(description.charAt(0)).toMatch(/[A-Z]/);
          expect(description.endsWith('.')).toBeTruthy();
        }
      });
    });
  });
});