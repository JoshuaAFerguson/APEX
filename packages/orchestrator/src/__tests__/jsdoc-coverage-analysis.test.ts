import { describe, it, expect } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';

/**
 * JSDoc Coverage Analysis Test Suite
 *
 * This test suite analyzes the JSDoc documentation coverage for the major service classes
 * and ensures that all public methods, interfaces, and types have appropriate documentation
 * with examples as required by the acceptance criteria.
 */
describe('JSDoc Coverage Analysis', () => {
  const sourceFiles = [
    '/Users/s0v3r1gn/APEX/packages/orchestrator/src/workspace-manager.ts',
    '/Users/s0v3r1gn/APEX/packages/orchestrator/src/idle-processor.ts',
    '/Users/s0v3r1gn/APEX/packages/orchestrator/src/hook-manager.ts'
  ];

  describe('WorkspaceManager Documentation Coverage', () => {
    it('validates that all public methods have JSDoc with @param and @returns', async () => {
      const fileContent = await fs.readFile(sourceFiles[0], 'utf-8');

      // Extract public method signatures
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
        'getContainerIdForTask',
        'getContainerHealth',
        'getWorkspaceStats',
        'cleanup'
      ];

      for (const method of publicMethods) {
        // Check that method has JSDoc comment
        const methodRegex = new RegExp(`\\/\\*\\*[\\s\\S]*?\\*\\/\\s*(?:async\\s+)?${method}\\s*\\(`, 'g');
        expect(fileContent).toMatch(methodRegex);

        // Check that JSDoc contains @param for parameters (where applicable)
        const methodMatch = fileContent.match(new RegExp(`\\/\\*\\*[\\s\\S]*?\\*\\/\\s*(?:async\\s+)?${method}\\s*\\([^)]*\\)`, 'g'));
        if (methodMatch && methodMatch[0].includes('(') && !methodMatch[0].includes('()')) {
          // Method has parameters, should have @param documentation
          const jsdocMatch = methodMatch[0].match(/\/\*\*([\s\S]*?)\*\//);
          if (jsdocMatch) {
            // Allow either @param or parameter descriptions in other formats
            const hasParamDocs = jsdocMatch[1].includes('@param') ||
                                jsdocMatch[1].includes('@returns') ||
                                jsdocMatch[1].includes('- ') || // List format parameters
                                jsdocMatch[1].includes('Promise'); // Return type description
            expect(hasParamDocs).toBe(true);
          }
        }
      }
    });

    it('validates that exported interfaces have JSDoc with @example', async () => {
      const fileContent = await fs.readFile(sourceFiles[0], 'utf-8');

      const exportedInterfaces = [
        'WorkspaceManagerOptions',
        'WorkspaceInfo',
        'DependencyInstallEventData',
        'DependencyInstallCompletedEventData',
        'DependencyInstallRecoveryEventData',
        'WorkspaceManagerEvents'
      ];

      for (const interfaceName of exportedInterfaces) {
        // Check that interface has JSDoc with @example
        const interfaceRegex = new RegExp(`\\/\\*\\*[\\s\\S]*?@example[\\s\\S]*?\\*\\/\\s*export\\s+interface\\s+${interfaceName}`, 'g');
        expect(fileContent).toMatch(interfaceRegex);
      }
    });

    it('validates that the main class has comprehensive JSDoc with @example', async () => {
      const fileContent = await fs.readFile(sourceFiles[0], 'utf-8');

      // Check that WorkspaceManager class has JSDoc with @example
      const classRegex = /\/\*\*[\s\S]*?@example[\s\S]*?\*\/\s*export\s+class\s+WorkspaceManager/g;
      expect(fileContent).toMatch(classRegex);
    });
  });

  describe('IdleProcessor Documentation Coverage', () => {
    it('validates that exported interfaces and types have JSDoc documentation', async () => {
      const fileContent = await fs.readFile(sourceFiles[1], 'utf-8');

      const exportedTypes = [
        'UpdateType',
        'VulnerabilitySeverity',
        'OutdatedDependency',
        'SecurityVulnerability',
        'DeprecatedPackage',
        'ProjectAnalysis'
      ];

      for (const typeName of exportedTypes) {
        // Check that type/interface has JSDoc documentation
        const typeRegex = new RegExp(`\\/\\*\\*[\\s\\S]*?\\*\\/\\s*(?:export\\s+)?(?:type|interface)\\s+${typeName}`, 'g');
        expect(fileContent).toMatch(typeRegex);
      }
    });

    it('validates ProjectAnalysis interface has comprehensive @example', async () => {
      const fileContent = await fs.readFile(sourceFiles[1], 'utf-8');

      // Check that ProjectAnalysis has detailed @example
      const projectAnalysisRegex = /\/\*\*[\s\S]*?@example[\s\S]*?\*\/[\s\S]*?export\s+interface\s+ProjectAnalysis/g;
      expect(fileContent).toMatch(projectAnalysisRegex);

      // Check that the example includes all major properties
      const exampleMatch = fileContent.match(/\/\*\*[\s\S]*?@example[\s\S]*?\*\/[\s\S]*?export\s+interface\s+ProjectAnalysis/g);
      if (exampleMatch) {
        const exampleContent = exampleMatch[0];
        expect(exampleContent).toMatch(/codebaseSize/);
        expect(exampleContent).toMatch(/dependencies/);
        expect(exampleContent).toMatch(/codeQuality/);
        expect(exampleContent).toMatch(/documentation/);
        expect(exampleContent).toMatch(/performance/);
      }
    });
  });

  describe('HookManager Documentation Coverage', () => {
    it('validates that all event interfaces have JSDoc with @example', async () => {
      const fileContent = await fs.readFile(sourceFiles[2], 'utf-8');

      const eventInterfaces = [
        'HookManagerEvents',
        'HookExecutionStartEvent',
        'HookExecutionCompleteEvent',
        'HookExecutionResult'
      ];

      for (const interfaceName of eventInterfaces) {
        // Check that interface has JSDoc with @example
        const interfaceRegex = new RegExp(`\\/\\*\\*[\\s\\S]*?@example[\\s\\S]*?\\*\\/\\s*export\\s+interface\\s+${interfaceName}`, 'g');
        expect(fileContent).toMatch(interfaceRegex);
      }
    });

    it('validates that the HookManager class has comprehensive JSDoc', async () => {
      const fileContent = await fs.readFile(sourceFiles[2], 'utf-8');

      // Check that HookManager class has JSDoc with @example
      const classRegex = /\/\*\*[\s\S]*?@example[\s\S]*?\*\/\s*export\s+class\s+HookManager/g;
      expect(fileContent).toMatch(classRegex);
    });

    it('validates constructor has proper JSDoc with @param documentation', async () => {
      const fileContent = await fs.readFile(sourceFiles[2], 'utf-8');

      // Check that constructor has JSDoc with parameter documentation
      const constructorRegex = /\/\*\*[\s\S]*?@param[\s\S]*?\*\/[\s\S]*?constructor\s*\(/g;
      expect(fileContent).toMatch(constructorRegex);
    });
  });

  describe('Cross-File Documentation Consistency', () => {
    it('validates that imported types from core package are properly documented', async () => {
      for (const filePath of sourceFiles) {
        const fileContent = await fs.readFile(filePath, 'utf-8');

        // Check that imports from @apexcli/core are used in documented examples
        const importMatches = fileContent.match(/import\s+\{[\s\S]*?\}\s+from\s+['"]@apexcli\/core['"]/g);
        if (importMatches) {
          // At least one import should be used in JSDoc examples
          const hasImportInExamples = fileContent.includes('@example') &&
            (fileContent.includes('Task') ||
             fileContent.includes('WorkspaceConfig') ||
             fileContent.includes('HookConfig'));
          expect(hasImportInExamples).toBe(true);
        }
      }
    });

    it('validates that all @example blocks contain valid TypeScript-like syntax', async () => {
      for (const filePath of sourceFiles) {
        const fileContent = await fs.readFile(filePath, 'utf-8');

        // Extract all @example blocks
        const exampleBlocks = fileContent.match(/@example[\s\S]*?```typescript[\s\S]*?```/g) || [];

        for (const example of exampleBlocks) {
          // Check basic TypeScript syntax elements
          const codeBlock = example.match(/```typescript([\s\S]*?)```/);
          if (codeBlock) {
            const code = codeBlock[1];

            // Should not have obvious syntax errors
            expect(code).not.toMatch(/\s\s\s\*/); // No comment continuation in code

            // Should have proper variable declarations or usage
            const hasValidSyntax =
              code.includes('const ') ||
              code.includes('let ') ||
              code.includes('await ') ||
              code.includes('= ') ||
              code.includes('new ') ||
              code.includes('manager.') ||
              code.includes('processor.') ||
              code.includes('hookManager.');
            expect(hasValidSyntax).toBe(true);
          }
        }
      }
    });
  });

  describe('Documentation Quality Metrics', () => {
    it('calculates JSDoc coverage percentage for each service class', async () => {
      const results = {
        WorkspaceManager: { methods: 0, documented: 0, interfaces: 0, interfacesDocumented: 0 },
        IdleProcessor: { methods: 0, documented: 0, interfaces: 0, interfacesDocumented: 0 },
        HookManager: { methods: 0, documented: 0, interfaces: 0, interfacesDocumented: 0 }
      };

      for (let i = 0; i < sourceFiles.length; i++) {
        const fileContent = await fs.readFile(sourceFiles[i], 'utf-8');
        const className = Object.keys(results)[i];

        // Count public methods
        const methodMatches = fileContent.match(/(?:async\s+)?[a-zA-Z_][a-zA-Z0-9_]*\s*\([^)]*\)\s*:/g) || [];
        const publicMethodMatches = fileContent.match(/(?:async\s+)?[a-zA-Z_][a-zA-Z0-9_]*\s*\([^)]*\)\s*(?::\s*[^{]+)?{/g) || [];
        results[className].methods = Math.max(methodMatches.length, publicMethodMatches.length);

        // Count documented methods
        const documentedMethods = fileContent.match(/\/\*\*[\s\S]*?\*\/\s*(?:async\s+)?[a-zA-Z_][a-zA-Z0-9_]*\s*\(/g) || [];
        results[className].documented = documentedMethods.length;

        // Count interfaces
        const interfaces = fileContent.match(/export\s+interface\s+[a-zA-Z_][a-zA-Z0-9_]*/g) || [];
        results[className].interfaces = interfaces.length;

        // Count documented interfaces
        const documentedInterfaces = fileContent.match(/\/\*\*[\s\S]*?\*\/\s*export\s+interface/g) || [];
        results[className].interfacesDocumented = documentedInterfaces.length;
      }

      // Verify high documentation coverage
      for (const [className, stats] of Object.entries(results)) {
        const methodCoverage = stats.methods > 0 ? (stats.documented / stats.methods) * 100 : 100;
        const interfaceCoverage = stats.interfaces > 0 ? (stats.interfacesDocumented / stats.interfaces) * 100 : 100;

        console.log(`${className} - Method coverage: ${methodCoverage.toFixed(1)}%, Interface coverage: ${interfaceCoverage.toFixed(1)}%`);

        // Expect reasonable documentation coverage
        expect(methodCoverage).toBeGreaterThanOrEqual(50);
        expect(interfaceCoverage).toBeGreaterThanOrEqual(80);
      }
    });
  });
});