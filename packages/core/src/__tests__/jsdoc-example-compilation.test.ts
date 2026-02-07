/**
 * @fileoverview JSDoc Example Compilation Tests
 *
 * Tests that verify JSDoc @example tags contain valid TypeScript code
 * that would compile successfully. This ensures examples are accurate
 * and helpful to developers.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

describe('JSDoc Example Code Compilation', () => {
  const utilsFilePath = path.join(__dirname, '..', 'utils.ts');
  let utilsContent: string;

  beforeAll(() => {
    utilsContent = fs.readFileSync(utilsFilePath, 'utf8');
  });

  /**
   * Extracts example code from JSDoc comments for a given interface
   */
  function extractExampleCode(interfaceName: string): string | null {
    const pattern = new RegExp(`\\/\\*\\*([\\s\\S]*?)\\*\\/\\s*export interface ${interfaceName}`);
    const match = utilsContent.match(pattern);

    if (!match) return null;

    const jsdocContent = match[1];
    const exampleMatch = jsdocContent.match(/@example\s*\n([\s\S]*?)(?=\n\s*\*\s*@|\n\s*\*\/|$)/);

    if (!exampleMatch) return null;

    // Clean up the example code by removing JSDoc formatting
    const rawExample = exampleMatch[1];
    const lines = rawExample.split('\n');

    return lines
      .map(line => {
        // Remove leading asterisk and whitespace from JSDoc
        const cleaned = line.replace(/^\s*\*\s?/, '');
        // Remove ``` typescript and ``` markers
        if (cleaned.trim() === '```typescript' || cleaned.trim() === '```') {
          return '';
        }
        return cleaned;
      })
      .filter(line => line.trim() !== '')
      .join('\n')
      .trim();
  }

  /**
   * Compiles TypeScript code and returns compilation diagnostics
   */
  function compileTypeScript(code: string, interfaceDefinitions: string): ts.Diagnostic[] {
    // Create a virtual source file with the interface definitions and example code
    const sourceCode = `
${interfaceDefinitions}

${code}
    `;

    const sourceFile = ts.createSourceFile(
      'test.ts',
      sourceCode,
      ts.ScriptTarget.ES2022,
      true
    );

    const compilerOptions: ts.CompilerOptions = {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      strict: true,
      noImplicitAny: false,
      strictNullChecks: false,
      noEmit: true,
    };

    const program = ts.createProgram(['test.ts'], compilerOptions, {
      getSourceFile: (fileName) => fileName === 'test.ts' ? sourceFile : undefined,
      writeFile: () => {},
      getCurrentDirectory: () => '',
      getDirectories: () => [],
      fileExists: () => true,
      readFile: () => '',
      getCanonicalFileName: (fileName) => fileName,
      useCaseSensitiveFileNames: () => true,
      getNewLine: () => '\n',
    });

    return ts.getPreEmitDiagnostics(program);
  }

  /**
   * Extracts interface definition from source code
   */
  function extractInterfaceDefinition(interfaceName: string): string {
    const pattern = new RegExp(`(export interface ${interfaceName}[\\s\\S]*?^})`, 'gm');
    const match = utilsContent.match(pattern);
    return match ? match[0] : '';
  }

  describe('Critical Interface Examples', () => {
    const criticalInterfaces = [
      'SemVer',
      'ConventionalCommit',
      'CodeBlock',
      'ConflictInfo',
      'GitLogEntry',
      'TruncateOptions',
      'TruncateResult'
    ];

    criticalInterfaces.forEach(interfaceName => {
      describe(`${interfaceName} example`, () => {
        it('should have an @example tag', () => {
          const pattern = new RegExp(`\\/\\*\\*([\\s\\S]*?)\\*\\/\\s*export interface ${interfaceName}`);
          const match = utilsContent.match(pattern);

          expect(match).toBeTruthy();

          if (match) {
            const jsdocContent = match[1];
            expect(jsdocContent).toMatch(/@example/);
          }
        });

        it('should contain valid TypeScript code', () => {
          const exampleCode = extractExampleCode(interfaceName);

          expect(exampleCode).toBeTruthy();
          expect(exampleCode!.length).toBeGreaterThan(0);

          if (exampleCode) {
            // Basic syntax checks
            expect(exampleCode).toMatch(/const\s+\w+/); // Should have const declaration
            expect(exampleCode).toMatch(new RegExp(interfaceName)); // Should reference the interface
            expect(exampleCode).toMatch(/[{}]/); // Should have object literal
            expect(exampleCode).not.toMatch(/TODO|FIXME|XXX/i); // No placeholder comments
          }
        });

        it('should compile without TypeScript errors', () => {
          const exampleCode = extractExampleCode(interfaceName);
          const interfaceDefinition = extractInterfaceDefinition(interfaceName);

          if (!exampleCode || !interfaceDefinition) {
            throw new Error(`Could not extract example code or interface definition for ${interfaceName}`);
          }

          // Get related type definitions that might be needed
          const relatedTypes = extractRelatedTypes(interfaceName);
          const allDefinitions = [interfaceDefinition, ...relatedTypes].join('\n\n');

          const diagnostics = compileTypeScript(exampleCode, allDefinitions);

          // Filter out only error-level diagnostics (warnings are ok)
          const errors = diagnostics.filter(d => d.category === ts.DiagnosticCategory.Error);

          if (errors.length > 0) {
            const errorMessages = errors.map(d =>
              `${d.messageText} at line ${d.start ? ts.getLineAndCharacterOfPosition(
                d.file!, d.start
              ).line + 1 : 'unknown'}`
            ).join('; ');

            throw new Error(`TypeScript compilation errors in ${interfaceName} example: ${errorMessages}`);
          }

          expect(errors.length).toBe(0);
        });

        it('should demonstrate typical usage patterns', () => {
          const exampleCode = extractExampleCode(interfaceName);

          if (exampleCode) {
            // Should show object creation with interface type annotation
            expect(exampleCode).toMatch(new RegExp(`:\\s*${interfaceName}`));

            // Should provide realistic example values
            expect(exampleCode).not.toMatch(/foo|bar|baz|example|test/i); // Avoid generic placeholder values

            // Interface-specific checks
            switch (interfaceName) {
              case 'SemVer':
                expect(exampleCode).toMatch(/major:\s*\d+/);
                expect(exampleCode).toMatch(/minor:\s*\d+/);
                expect(exampleCode).toMatch(/patch:\s*\d+/);
                break;
              case 'ConventionalCommit':
                expect(exampleCode).toMatch(/type:\s*['"](?:feat|fix|docs|style|refactor|test|chore)/);
                expect(exampleCode).toMatch(/description:\s*['"]/);
                break;
              case 'CodeBlock':
                expect(exampleCode).toMatch(/language:\s*['"]/);
                expect(exampleCode).toMatch(/code:\s*['"]/);
                break;
              case 'GitLogEntry':
                expect(exampleCode).toMatch(/hash:\s*['"]/);
                expect(exampleCode).toMatch(/author:\s*['"]/);
                expect(exampleCode).toMatch(/message:\s*['"]/);
                break;
            }
          }
        });
      });
    });
  });

  /**
   * Extracts related type definitions that might be needed for compilation
   */
  function extractRelatedTypes(interfaceName: string): string[] {
    const relatedTypes: string[] = [];

    // Map interfaces to their dependencies
    const dependencies: Record<string, string[]> = {
      'ConflictInfo': ['ConflictMarker'],
      'GitLogEntry': [], // No dependencies
      'SemVer': [], // No dependencies
      'CodeBlock': [], // No dependencies
      'TruncateOptions': [], // No dependencies
      'TruncateResult': [], // No dependencies
    };

    const deps = dependencies[interfaceName] || [];

    deps.forEach(depName => {
      // Try to extract the dependent type definition
      const typePattern = new RegExp(`(export (?:interface|type) ${depName}[\\s\\S]*?^})`, 'gm');
      const enumPattern = new RegExp(`(export enum ${depName}[\\s\\S]*?^})`, 'gm');

      const typeMatch = utilsContent.match(typePattern);
      const enumMatch = utilsContent.match(enumPattern);

      if (typeMatch) {
        relatedTypes.push(typeMatch[0]);
      } else if (enumMatch) {
        relatedTypes.push(enumMatch[0]);
      }
    });

    return relatedTypes;
  }

  describe('Example Code Quality', () => {
    it('should use consistent formatting across all examples', () => {
      const criticalInterfaces = ['SemVer', 'ConventionalCommit', 'CodeBlock', 'ConflictInfo', 'GitLogEntry', 'TruncateOptions', 'TruncateResult'];
      const examples = criticalInterfaces.map(name => extractExampleCode(name)).filter(Boolean) as string[];

      examples.forEach(code => {
        // Should use 2-space indentation
        expect(code).not.toMatch(/\t/); // No tabs

        // Should have consistent object formatting
        expect(code).toMatch(/{\s*\n/); // Opening brace followed by newline

        // Should end statements with semicolons
        expect(code).toMatch(/;\s*$/m);
      });
    });

    it('should not contain any hardcoded file paths or system-specific content', () => {
      const criticalInterfaces = ['SemVer', 'ConventionalCommit', 'CodeBlock', 'ConflictInfo', 'GitLogEntry', 'TruncateOptions', 'TruncateResult'];
      const examples = criticalInterfaces.map(name => extractExampleCode(name)).filter(Boolean) as string[];

      examples.forEach(code => {
        expect(code).not.toMatch(/\/Users\/|C:\\/); // No absolute paths
        expect(code).not.toMatch(/localhost|127\.0\.0\.1/); // No localhost references
        expect(code).not.toMatch(/\.env|config\.json/); // No config file references
      });
    });

    it('should demonstrate best practices for each interface', () => {
      const semVerExample = extractExampleCode('SemVer');
      if (semVerExample) {
        // SemVer should show a realistic version number
        expect(semVerExample).toMatch(/\d+\.\d+\.\d+/);
      }

      const commitExample = extractExampleCode('ConventionalCommit');
      if (commitExample) {
        // ConventionalCommit should follow the conventional commits spec
        expect(commitExample).toMatch(/type:\s*['"](?:feat|fix|docs|style|refactor|test|chore)/);
      }

      const truncateExample = extractExampleCode('TruncateOptions');
      if (truncateExample) {
        // TruncateOptions should show reasonable defaults
        expect(truncateExample).toMatch(/maxLength:\s*\d+/);
      }
    });
  });
});