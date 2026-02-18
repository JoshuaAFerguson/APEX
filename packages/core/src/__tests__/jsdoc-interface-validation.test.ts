/**
 * @fileoverview JSDoc Interface Validation Tests
 *
 * Comprehensive tests for JSDoc coverage across all core package interfaces,
 * with particular focus on the interfaces mentioned in the acceptance criteria:
 * SemVer, ConventionalCommit, CodeBlock, ConflictInfo, GitLogEntry,
 * TruncateOptions, and TruncateResult.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('JSDoc Interface Coverage Validation', () => {
  const utilsFilePath = path.join(__dirname, '..', 'utils.ts');
  const typesFilePath = path.join(__dirname, '..', 'types.ts');
  let utilsContent: string;
  let typesContent: string;

  beforeAll(() => {
    utilsContent = fs.readFileSync(utilsFilePath, 'utf8');
    typesContent = fs.readFileSync(typesFilePath, 'utf8');
  });

  describe('Critical Interface Documentation', () => {
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
      describe(`${interfaceName} interface`, () => {
        it('should have JSDoc documentation', () => {
          const pattern = new RegExp(`\\/\\*\\*[\\s\\S]*?\\*\\/\\s*export interface ${interfaceName}`);
          const hasDocsInUtils = pattern.test(utilsContent);
          const hasDocsInTypes = pattern.test(typesContent);

          expect(hasDocsInUtils || hasDocsInTypes).toBe(true);
        });

        it('should have meaningful description', () => {
          const pattern = new RegExp(`\\/\\*\\*([\\s\\S]*?)\\*\\/\\s*export interface ${interfaceName}`);
          const utilsMatch = utilsContent.match(pattern);
          const typesMatch = typesContent.match(pattern);
          const match = utilsMatch || typesMatch;

          expect(match).toBeTruthy();

          if (match) {
            const jsdocContent = match[1];
            // Should have actual description, not just property docs
            expect(jsdocContent.length).toBeGreaterThan(20);
            expect(jsdocContent).toMatch(/[a-zA-Z]{10,}/); // Has meaningful words
            expect(jsdocContent).not.toMatch(/^[\s\*@]*$/); // Not just whitespace and tags
          }
        });

        it('should have @example tag with valid TypeScript syntax', () => {
          const pattern = new RegExp(`\\/\\*\\*([\\s\\S]*?)\\*\\/\\s*export interface ${interfaceName}`);
          const utilsMatch = utilsContent.match(pattern);
          const typesMatch = typesContent.match(pattern);
          const match = utilsMatch || typesMatch;

          expect(match).toBeTruthy();

          if (match) {
            const jsdocContent = match[1];
            expect(jsdocContent).toMatch(/@example/);

            // Extract example code block
            const exampleMatch = jsdocContent.match(/@example\s*\n\s*\*\s*```typescript([\s\S]*?)```/);
            if (exampleMatch) {
              const exampleCode = exampleMatch[1];
              // Basic syntax validation
              expect(exampleCode).toMatch(new RegExp(`const.*${interfaceName.toLowerCase()}`));
              expect(exampleCode).toMatch(/[{}]/); // Should have object literal
              expect(exampleCode.trim().length).toBeGreaterThan(10);
            }
          }
        });

        it('should document all properties with descriptions', () => {
          // Find the interface declaration
          const interfacePattern = new RegExp(
            `export interface ${interfaceName}\\s*{([\\s\\S]*?)}`,
            'g'
          );

          const utilsMatch = utilsContent.match(interfacePattern);
          const typesMatch = typesContent.match(interfacePattern);
          const match = utilsMatch?.[0] || typesMatch?.[0];

          expect(match).toBeTruthy();

          if (match) {
            // Extract property lines
            const propertiesSection = match.match(/{([\s\S]*?)}/)?.[1];
            if (propertiesSection) {
              const propertyLines = propertiesSection
                .split('\n')
                .filter(line => line.trim() && !line.trim().startsWith('//') && !line.trim().startsWith('*'));

              const propertyDeclarations = propertyLines.filter(line =>
                line.includes(':') && !line.trim().startsWith('/**') && !line.trim().startsWith('*')
              );

              // Each property should have a JSDoc comment before it
              propertyDeclarations.forEach(propertyLine => {
                const propertyName = propertyLine.split(':')[0].trim().replace(/[?]$/, '');
                if (propertyName && propertyName !== '{' && propertyName !== '}') {
                  const propertyPattern = new RegExp(`\\/\\*\\*.*?\\*\\/\\s*${propertyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
                  expect(propertyPattern.test(match)).toBe(true);
                }
              });
            }
          }
        });
      });
    });
  });

  describe('JSDoc Format Validation', () => {
    it('should use consistent JSDoc formatting', () => {
      const jsdocBlocks = utilsContent.match(/\/\*\*[\s\S]*?\*\//g) || [];
      const interfaceJsdocs = jsdocBlocks.filter(block =>
        /export interface (SemVer|ConventionalCommit|CodeBlock|ConflictInfo|GitLogEntry|TruncateOptions|TruncateResult)/.test(
          utilsContent.substr(utilsContent.indexOf(block) + block.length, 100)
        )
      );

      interfaceJsdocs.forEach(jsdoc => {
        // Should start with /** and end with */
        expect(jsdoc).toMatch(/^\/\*\*/);
        expect(jsdoc).toMatch(/\*\/$/);

        // Should have proper line formatting with asterisks
        const lines = jsdoc.split('\n');
        if (lines.length > 2) {
          lines.slice(1, -1).forEach(line => {
            expect(line.trim()).toMatch(/^\*/);
          });
        }
      });
    });

    it('should not have placeholder or TODO comments', () => {
      const todoPattern = /TODO:|FIXME:|XXX:|placeholder|TBD/i;
      const jsdocBlocks = utilsContent.match(/\/\*\*[\s\S]*?\*\//g) || [];

      jsdocBlocks.forEach(block => {
        expect(todoPattern.test(block)).toBe(false);
      });
    });

    it('should have proper @interface tags where appropriate', () => {
      const criticalInterfaces = ['SemVer', 'ConventionalCommit', 'CodeBlock', 'ConflictInfo', 'GitLogEntry', 'TruncateOptions', 'TruncateResult'];

      criticalInterfaces.forEach(interfaceName => {
        const pattern = new RegExp(`\\/\\*\\*([\\s\\S]*?)\\*\\/\\s*export interface ${interfaceName}`);
        const match = utilsContent.match(pattern);

        if (match) {
          const jsdocContent = match[1];
          expect(jsdocContent).toMatch(new RegExp(`@interface ${interfaceName}`));
        }
      });
    });
  });

  describe('Example Code Compilation', () => {
    it('should have syntactically valid TypeScript examples', () => {
      const criticalInterfaces = ['SemVer', 'ConventionalCommit', 'CodeBlock', 'ConflictInfo', 'GitLogEntry', 'TruncateOptions', 'TruncateResult'];

      criticalInterfaces.forEach(interfaceName => {
        const pattern = new RegExp(`\\/\\*\\*([\\s\\S]*?)\\*\\/\\s*export interface ${interfaceName}`);
        const match = utilsContent.match(pattern);

        if (match) {
          const jsdocContent = match[1];
          const exampleMatch = jsdocContent.match(/@example\s*\n\s*\*\s*```typescript([\s\S]*?)```/);

          if (exampleMatch) {
            const exampleCode = exampleMatch[1]
              .split('\n')
              .map(line => line.replace(/^\s*\*\s?/, ''))
              .join('\n')
              .trim();

            // Basic TypeScript syntax checks
            expect(exampleCode).not.toMatch(/\s{/); // No space before opening brace
            expect(exampleCode).toMatch(/;\s*$/m); // Lines should end with semicolon
            expect(exampleCode).not.toMatch(/\t/); // Should use spaces, not tabs

            // Should be valid object assignment
            if (exampleCode.includes('const')) {
              expect(exampleCode).toMatch(/const\s+\w+:\s*\w+\s*=/);
            }
          }
        }
      });
    });
  });

  describe('Public API Documentation Coverage', () => {
    it('should document all exported interfaces', () => {
      const exportedInterfaces = utilsContent.match(/export interface \w+/g) || [];

      exportedInterfaces.forEach(exportStatement => {
        const interfaceName = exportStatement.replace('export interface ', '');
        const pattern = new RegExp(`\\/\\*\\*[\\s\\S]*?\\*\\/\\s*export interface ${interfaceName}`);
        expect(pattern.test(utilsContent)).toBe(true);
      });
    });

    it('should document all exported types', () => {
      const exportedTypes = utilsContent.match(/export type \w+/g) || [];

      exportedTypes.forEach(exportStatement => {
        const typeName = exportStatement.replace('export type ', '').split(' ')[0];
        const pattern = new RegExp(`\\/\\*\\*[\\s\\S]*?\\*\\/\\s*export type ${typeName}`);
        expect(pattern.test(utilsContent)).toBe(true);
      });
    });

    it('should have consistent documentation style across interfaces', () => {
      const criticalInterfaces = ['SemVer', 'ConventionalCommit', 'CodeBlock', 'ConflictInfo', 'GitLogEntry', 'TruncateOptions', 'TruncateResult'];
      const documentationPatterns = criticalInterfaces.map(interfaceName => {
        const pattern = new RegExp(`\\/\\*\\*([\\s\\S]*?)\\*\\/\\s*export interface ${interfaceName}`);
        const match = utilsContent.match(pattern);
        return match ? match[1] : null;
      }).filter(Boolean);

      // All should have @interface tag
      documentationPatterns.forEach(doc => {
        expect(doc).toMatch(/@interface/);
      });

      // All should have @example tag
      documentationPatterns.forEach(doc => {
        expect(doc).toMatch(/@example/);
      });

      // All should have meaningful description
      documentationPatterns.forEach(doc => {
        const lines = doc.split('\n').filter(line =>
          !line.trim().startsWith('*') ||
          (line.trim().startsWith('*') && !line.includes('@') && line.trim() !== '*')
        );
        expect(lines.length).toBeGreaterThan(0);
      });
    });
  });
});