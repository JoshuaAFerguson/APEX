import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * Tests for verifying consistent formatting across API reference documentation files
 */
describe('API Reference Formatting Consistency', () => {
  const docsPath = join(process.cwd(), 'docs');

  const docFiles = {
    browserStateFixtures: join(docsPath, 'browser-state-fixtures-api.md'),
    mockHelpers: join(docsPath, 'mock-helpers-api.md'),
    testUtilities: join(docsPath, 'test-utilities.md')
  };

  // Helper function to check if all files exist
  beforeAll(() => {
    Object.entries(docFiles).forEach(([name, path]) => {
      if (!existsSync(path)) {
        throw new Error(`Documentation file ${name} does not exist at ${path}`);
      }
    });
  });

  // Test consistent markdown structure
  describe('Markdown Structure Consistency', () => {
    it('should have consistent heading hierarchy (# then ##)', () => {
      Object.entries(docFiles).forEach(([name, filePath]) => {
        const content = readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');

        let foundMainTitle = false;
        let foundSecondLevelHeading = false;

        for (const line of lines) {
          if (line.startsWith('# ')) {
            expect(foundSecondLevelHeading).toBe(false); // Main title should come before ## headings
            foundMainTitle = true;
          } else if (line.startsWith('## ')) {
            expect(foundMainTitle).toBe(true); // Should have main title before ## headings
            foundSecondLevelHeading = true;
          } else if (line.startsWith('### ')) {
            expect(foundSecondLevelHeading).toBe(true); // Should have ## heading before ### headings
          }
        }

        expect(foundMainTitle).toBe(true); // Every file should have a main title
      });
    });

    it('should use consistent emoji patterns in section headers', () => {
      Object.entries(docFiles).forEach(([name, filePath]) => {
        const content = readFileSync(filePath, 'utf-8');

        // Check for emoji usage in headers (if any emojis are used, they should be consistent)
        const headers = content.match(/^#+\s+.*$/gm) || [];
        const headersWithEmoji = headers.filter(header => /[\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u.test(header));

        // If emojis are used, they should follow a consistent pattern
        if (headersWithEmoji.length > 0) {
          // All emojis should be at the beginning of the header text (after #'s and space)
          headersWithEmoji.forEach(header => {
            expect(header).toMatch(/^#+\s+[\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u);
          });
        }
      });
    });
  });

  // Test TypeScript code block consistency
  describe('TypeScript Code Block Formatting', () => {
    it('should use TypeScript code blocks consistently', () => {
      Object.entries(docFiles).forEach(([name, filePath]) => {
        const content = readFileSync(filePath, 'utf-8');

        // Find all code blocks
        const codeBlocks = content.match(/```([a-zA-Z]*)\n([\s\S]*?)\n```/g) || [];

        // TypeScript code blocks should be properly labeled
        const typescriptBlocks = codeBlocks.filter(block =>
          block.startsWith('```typescript') ||
          block.startsWith('```ts')
        );

        // If there are TypeScript examples, they should use proper syntax
        typescriptBlocks.forEach(block => {
          expect(block).toMatch(/```typescript\n|```ts\n/);

          // Check for common TypeScript patterns
          const blockContent = block.replace(/```(typescript|ts)\n/, '').replace(/\n```$/, '');

          // If it contains interface/type definitions, they should be properly formatted
          if (blockContent.includes('interface ') || blockContent.includes('type ')) {
            expect(blockContent).toMatch(/^(interface|type)\s+\w+/m);
          }

          // If it contains function signatures, they should have proper return types
          if (blockContent.includes('function ')) {
            // Functions should typically have return types in API docs
            expect(blockContent).toMatch(/function\s+\w+\([^)]*\):\s*\w+/);
          }
        });
      });
    });

    it('should have consistent import statement formatting', () => {
      Object.entries(docFiles).forEach(([name, filePath]) => {
        const content = readFileSync(filePath, 'utf-8');

        // Find import statements in code blocks
        const imports = content.match(/import\s+.*from\s+['"].*['"]/g) || [];

        imports.forEach(importStatement => {
          // Import statements should be consistently formatted
          expect(importStatement).toMatch(/^import\s+(\{[^}]+\}|\w+|\*\s+as\s+\w+)\s+from\s+['"][^'"]+['"]$/);

          // Should use single quotes consistently (if specified in project style)
          // or be consistent within the same file
        });
      });
    });
  });

  // Test parameter table consistency
  describe('Parameter Table Formatting', () => {
    it('should have consistent parameter table structure', () => {
      Object.entries(docFiles).forEach(([name, filePath]) => {
        const content = readFileSync(filePath, 'utf-8');

        // Find parameter tables
        const tableHeaders = content.match(/\|\s*Parameter\s*\|\s*Type\s*\|\s*.*\s*\|/g) || [];

        tableHeaders.forEach(header => {
          // Parameter tables should have consistent column headers
          expect(header).toMatch(/\|\s*Parameter\s*\|/);
          expect(header).toMatch(/\|\s*Type\s*\|/);

          // Common column patterns
          const hasRequired = header.includes('Required');
          const hasDefault = header.includes('Default');
          const hasDescription = header.includes('Description');

          // At minimum should have Parameter, Type, Description
          expect(hasDescription).toBe(true);
        });

        // Check table alignment rows
        const alignmentRows = content.match(/\|[-\s]*\|[-\s]*\|[-\s]*\|/g) || [];

        if (tableHeaders.length > 0) {
          expect(alignmentRows.length).toBeGreaterThanOrEqual(tableHeaders.length);
        }
      });
    });

    it('should use consistent type formatting in tables', () => {
      Object.entries(docFiles).forEach(([name, filePath]) => {
        const content = readFileSync(filePath, 'utf-8');

        // Look for type information in tables
        const tableRows = content.match(/\|[^|]*\|[^|]*\|[^|]*\|/g) || [];

        tableRows.forEach(row => {
          const columns = row.split('|').map(col => col.trim());

          if (columns.length >= 3 && columns[2]) { // Type column
            const typeCol = columns[2];

            // TypeScript types should use code formatting
            if (typeCol.includes('string') || typeCol.includes('number') || typeCol.includes('boolean') ||
                typeCol.includes('Array') || typeCol.includes('Record') || typeCol.includes('Function')) {
              expect(typeCol).toMatch(/`.*`/); // Should be wrapped in backticks
            }
          }
        });
      });
    });
  });

  // Test section structure consistency
  describe('Section Structure Consistency', () => {
    it('should have consistent API section structure', () => {
      const browserFixturesContent = readFileSync(docFiles.browserStateFixtures, 'utf-8');
      const mockHelpersContent = readFileSync(docFiles.mockHelpers, 'utf-8');

      // Both API reference files should have similar section structures
      const commonSections = [
        'Overview',
        'Installation', // or Import
        'API Reference',
        'Examples'
      ];

      commonSections.forEach(section => {
        // Check if section exists in both files (case insensitive)
        const sectionRegex = new RegExp(`##\\s+${section}`, 'i');

        const inBrowserFixtures = sectionRegex.test(browserFixturesContent);
        const inMockHelpers = sectionRegex.test(mockHelpersContent);

        // If one has it, both should have it for consistency
        if (inBrowserFixtures || inMockHelpers) {
          expect(inBrowserFixtures).toBe(true);
          expect(inMockHelpers).toBe(true);
        }
      });
    });

    it('should have consistent method documentation structure', () => {
      Object.entries(docFiles).forEach(([name, filePath]) => {
        const content = readFileSync(filePath, 'utf-8');

        // Find method/function documentation sections
        const methodSections = content.match(/####\s+\w+\(\)/g) || [];

        methodSections.forEach(methodHeader => {
          const methodName = methodHeader.match(/####\s+(\w+)\(\)/)?.[1];

          if (methodName) {
            // Look for the method section content
            const sectionStart = content.indexOf(methodHeader);
            const nextMethodIndex = content.indexOf('####', sectionStart + 1);
            const sectionEnd = nextMethodIndex === -1 ? content.length : nextMethodIndex;
            const sectionContent = content.slice(sectionStart, sectionEnd);

            // Method sections should have consistent subsections
            const hasSignature = sectionContent.includes('**Signature:**') ||
                               sectionContent.includes('**TypeScript Signature:**');
            const hasParameters = sectionContent.includes('**Parameters:**') ||
                                sectionContent.includes('| Parameter |');
            const hasReturns = sectionContent.includes('**Returns:**') ||
                             sectionContent.includes('**Return Type:**');
            const hasExample = sectionContent.includes('**Usage Example:**') ||
                             sectionContent.includes('**Example:**');

            // API methods should have these basic elements
            if (sectionContent.length > 200) { // Only check substantial method docs
              expect(hasSignature || hasParameters).toBe(true); // Should have either signature or parameters
              expect(hasExample).toBe(true); // Should have usage examples
            }
          }
        });
      });
    });
  });

  // Test cross-reference formatting consistency
  describe('Cross-Reference Link Formatting', () => {
    it('should use consistent link formatting for cross-references', () => {
      Object.entries(docFiles).forEach(([name, filePath]) => {
        const content = readFileSync(filePath, 'utf-8');

        // Find markdown links
        const links = content.match(/\[([^\]]+)\]\(([^)]+)\)/g) || [];

        links.forEach(link => {
          const match = link.match(/\[([^\]]+)\]\(([^)]+)\)/);

          if (match) {
            const linkText = match[1];
            const linkUrl = match[2];

            // Internal documentation links should follow consistent patterns
            if (linkUrl.endsWith('.md')) {
              // Should use relative paths
              expect(linkUrl).toMatch(/^\.?\//);

              // Link text should be descriptive and consistent
              expect(linkText.length).toBeGreaterThan(2);

              // Common link text patterns for consistency
              if (linkUrl.includes('api')) {
                expect(linkText.toLowerCase()).toMatch(/(api|reference)/);
              }
            }
          }
        });
      });
    });

    it('should have consistent Related Documentation section formatting', () => {
      Object.entries(docFiles).forEach(([name, filePath]) => {
        const content = readFileSync(filePath, 'utf-8');

        const relatedDocsMatch = content.match(/## Related Documentation\s*([\s\S]*?)(?=\n##|\n$|$)/);

        if (relatedDocsMatch) {
          const sectionContent = relatedDocsMatch[1];

          // Should use bullet points for related docs
          const bulletPoints = sectionContent.match(/^-\s+/gm) || [];
          const links = sectionContent.match(/\[([^\]]+)\]\(([^)]+)\)/g) || [];

          if (links.length > 0) {
            expect(bulletPoints.length).toBeGreaterThan(0); // Should use bullet point formatting
          }

          // Each line with a link should start with a bullet point
          const lines = sectionContent.split('\n').filter(line => line.trim());
          lines.forEach(line => {
            if (line.includes('[') && line.includes('](')) {
              expect(line.trim()).toMatch(/^-\s+/); // Should start with bullet point
            }
          });
        }
      });
    });
  });

  // Test overall documentation conventions
  describe('Documentation Convention Consistency', () => {
    it('should use consistent code highlighting for inline code', () => {
      Object.entries(docFiles).forEach(([name, filePath]) => {
        const content = readFileSync(filePath, 'utf-8');

        // Check for consistent use of backticks for inline code
        const inlineCode = content.match(/`[^`]+`/g) || [];

        inlineCode.forEach(code => {
          // Inline code should not contain newlines
          expect(code).not.toMatch(/\n/);

          // Should be meaningful code snippets
          expect(code.length).toBeGreaterThan(2); // More than just backticks
        });

        // Function names should be consistently formatted
        const functionMatches = content.match(/\b\w+\(\)/g) || [];

        // In API docs, function names should often be in code format
        functionMatches.forEach(func => {
          // Check if this function name appears in backticks somewhere in the doc
          const funcName = func.replace('()', '');
          const codeFormatted = content.includes(`\`${funcName}\``);
          const inCodeBlock = content.includes(`\`${func}\``);

          // API docs should format function names consistently
          // This is more of a style check than a strict requirement
        });
      });
    });

    it('should maintain consistent tone and terminology', () => {
      Object.entries(docFiles).forEach(([name, filePath]) => {
        const content = readFileSync(filePath, 'utf-8');

        // Check for consistent terminology
        const commonTerms = {
          'APEX': content.match(/APEX/g) || [],
          'TypeScript': content.match(/TypeScript/g) || [],
          'API': content.match(/API/g) || []
        };

        // Terminology should be consistent (not mixed case)
        Object.entries(commonTerms).forEach(([term, matches]) => {
          if (matches.length > 0) {
            // Should not have inconsistent casing
            const lowercaseVariant = content.match(new RegExp(term.toLowerCase(), 'g')) || [];
            const uppercaseVariant = content.match(new RegExp(term.toUpperCase(), 'g')) || [];

            // Allow for some flexibility, but major inconsistencies should be caught
            if (lowercaseVariant.length > 0 && uppercaseVariant.length > 0) {
              const ratio = Math.min(lowercaseVariant.length, uppercaseVariant.length) /
                          Math.max(lowercaseVariant.length, uppercaseVariant.length);

              // If there's significant inconsistency, flag it
              if (ratio > 0.3) { // Allow some flexibility
                console.warn(`Potential terminology inconsistency in ${name}: ${term}`);
              }
            }
          }
        });
      });
    });
  });
});