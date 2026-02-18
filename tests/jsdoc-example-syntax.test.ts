import { describe, it, expect, beforeAll } from 'vitest';
import { promises as fs } from 'fs';
import * as glob from 'glob';

/**
 * Interface representing an extracted JSDoc example
 */
interface JSDocExample {
  /** The example code content */
  code: string;
  /** File path where example was found */
  filePath: string;
  /** Line number where example starts */
  lineNumber: number;
  /** Associated function/class name */
  associatedName?: string;
  /** Language specified in code block (if any) */
  language?: string;
  /** Whether this is a standalone code block or inline code */
  isCodeBlock: boolean;
}

/**
 * Test suite for validating JSDoc example code syntax
 * Ensures all example code has correct basic syntax
 */
describe('JSDoc Example Code Syntax Validation', () => {
  let allExamples: JSDocExample[] = [];

  /**
   * Extract JSDoc examples from a file
   */
  async function extractExamplesFromFile(filePath: string): Promise<JSDocExample[]> {
    const content = await fs.readFile(filePath, 'utf-8');
    const examples: JSDocExample[] = [];

    // Match JSDoc comments
    const jsDocRegex = /\/\*\*([\s\S]*?)\*\//g;
    let jsDocMatch;

    while ((jsDocMatch = jsDocRegex.exec(content)) !== null) {
      const jsDocContent = jsDocMatch[1];
      const commentStart = jsDocMatch.index;
      const lineNumber = content.substring(0, commentStart).split('\n').length;

      // Find the associated function/class name
      const afterComment = content.substring(jsDocMatch.index + jsDocMatch[0].length);
      const associatedMatch = afterComment.match(
        /^\s*(?:export\s+)?(?:async\s+)?(?:function\s+(\w+)|class\s+(\w+)|interface\s+(\w+)|const\s+(\w+))/
      );
      const associatedName = associatedMatch ?
        (associatedMatch[1] || associatedMatch[2] || associatedMatch[3] || associatedMatch[4]) :
        undefined;

      // Extract examples from this JSDoc comment
      const commentExamples = extractExamplesFromJSDocContent(jsDocContent, filePath, lineNumber, associatedName);
      examples.push(...commentExamples);
    }

    return examples;
  }

  /**
   * Extract example code blocks from JSDoc content
   */
  function extractExamplesFromJSDocContent(
    jsDocContent: string,
    filePath: string,
    baseLineNumber: number,
    associatedName?: string
  ): JSDocExample[] {
    const examples: JSDocExample[] = [];

    // Match @example tags with content
    const exampleRegex = /@example\s*([\s\S]*?)(?=@\w+|$)/g;
    let exampleMatch;

    while ((exampleMatch = exampleRegex.exec(jsDocContent)) !== null) {
      const exampleContent = exampleMatch[1].trim();
      if (!exampleContent) continue;

      const exampleLineOffset = jsDocContent.substring(0, exampleMatch.index).split('\n').length;
      const lineNumber = baseLineNumber + exampleLineOffset;

      // Check for code blocks within the example
      const codeBlockRegex = /```(\w+)?\s*([\s\S]*?)```/g;
      let codeBlockMatch;
      let hasCodeBlocks = false;

      while ((codeBlockMatch = codeBlockRegex.exec(exampleContent)) !== null) {
        hasCodeBlocks = true;
        const [, language, code] = codeBlockMatch;

        examples.push({
          code: code.trim(),
          filePath,
          lineNumber: lineNumber + exampleContent.substring(0, codeBlockMatch.index).split('\n').length,
          associatedName,
          language: language || 'typescript',
          isCodeBlock: true
        });
      }

      // If no code blocks found, treat entire content as code (common in simple examples)
      if (!hasCodeBlocks && exampleContent.length > 0) {
        // Remove leading asterisks and clean up
        const cleanedCode = exampleContent
          .split('\n')
          .map(line => line.replace(/^\s*\*\s?/, ''))
          .join('\n')
          .trim();

        if (cleanedCode) {
          examples.push({
            code: cleanedCode,
            filePath,
            lineNumber,
            associatedName,
            language: 'typescript',
            isCodeBlock: false
          });
        }
      }
    }

    return examples;
  }

  /**
   * Basic syntax validation for example code
   */
  function validateBasicSyntax(example: JSDocExample): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (example.code.length === 0) {
      errors.push('Example code is empty');
      return { isValid: false, errors };
    }

    // Skip validation for non-code languages
    if (example.language && !['typescript', 'javascript', 'ts', 'js'].includes(example.language.toLowerCase())) {
      return { isValid: true, errors: [] };
    }

    // Check for basic syntax issues
    const braces = (example.code.match(/\{/g) || []).length - (example.code.match(/\}/g) || []).length;
    const brackets = (example.code.match(/\[/g) || []).length - (example.code.match(/\]/g) || []).length;
    const parens = (example.code.match(/\(/g) || []).length - (example.code.match(/\)/g) || []).length;

    if (braces !== 0) errors.push('Unmatched braces in example code');
    if (brackets !== 0) errors.push('Unmatched brackets in example code');
    if (parens !== 0) errors.push('Unmatched parentheses in example code');

    // Check for proper string quoting
    const singleQuotes = (example.code.match(/'/g) || []).length;
    const doubleQuotes = (example.code.match(/"/g) || []).length;
    const backticks = (example.code.match(/`/g) || []).length;

    if (singleQuotes % 2 !== 0) errors.push('Unmatched single quotes');
    if (doubleQuotes % 2 !== 0) errors.push('Unmatched double quotes');
    if (backticks % 2 !== 0) errors.push('Unmatched backticks');

    // Check for incomplete function declarations
    if (example.code.includes('function ') && !example.code.includes('{')) {
      errors.push('Function declaration appears incomplete');
    }

    return { isValid: errors.length === 0, errors };
  }

  // Setup: extract all examples
  beforeAll(async () => {
    const sourceFiles = glob.sync('packages/**/*.{ts,tsx}', {
      ignore: ['**/node_modules/**', '**/dist/**', '**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts']
    });

    console.log(`Analyzing ${sourceFiles.length} files for JSDoc examples...`);

    for (const file of sourceFiles) {
      try {
        const examples = await extractExamplesFromFile(file);
        allExamples.push(...examples);
      } catch (error) {
        console.warn(`Failed to extract examples from ${file}: ${error}`);
      }
    }

    console.log(`Found ${allExamples.length} JSDoc examples`);
  }, 20000);

  describe('Basic Syntax Validation', () => {
    it('should have syntactically correct example code', () => {
      const syntaxErrors: Array<{ example: JSDocExample; errors: string[] }> = [];

      for (const example of allExamples) {
        const validation = validateBasicSyntax(example);
        if (!validation.isValid) {
          syntaxErrors.push({ example, errors: validation.errors });
        }
      }

      if (syntaxErrors.length > 0) {
        console.log(`\nFound ${syntaxErrors.length} examples with syntax errors:`);
        syntaxErrors.slice(0, 5).forEach(({ example, errors }) => {
          console.log(`  ${example.filePath}:${example.lineNumber} (${example.associatedName || 'unknown'})`);
          errors.forEach(error => console.log(`    Error: ${error}`));
        });
      }

      // Allow some syntax errors in examples (might be showing error cases)
      expect(syntaxErrors.length).toBeLessThan(allExamples.length * 0.1);
    });

    it('should have meaningful example content', () => {
      const trivialExamples = allExamples.filter(example => {
        const code = example.code.trim();
        return code.length < 10 ||
               code === '' ||
               code.includes('...') ||
               code.includes('// ...');
      });

      if (trivialExamples.length > 0) {
        console.log(`\nFound ${trivialExamples.length} potentially trivial examples:`);
        trivialExamples.slice(0, 3).forEach(example => {
          const preview = example.code.substring(0, 30).replace(/\n/g, ' ');
          console.log(`  ${example.filePath}:${example.lineNumber} - "${preview}..."`);
        });
      }

      // Allow some trivial examples for simple cases
      expect(trivialExamples.length).toBeLessThan(allExamples.length * 0.2);
    });

    it('should have proper code block formatting', () => {
      const codeBlockExamples = allExamples.filter(ex => ex.isCodeBlock);
      const malformedBlocks = codeBlockExamples.filter(example => {
        const validation = validateBasicSyntax(example);
        return !validation.isValid;
      });

      if (malformedBlocks.length > 0) {
        console.log(`\nFound ${malformedBlocks.length} malformed code blocks out of ${codeBlockExamples.length} total`);
      }

      expect(malformedBlocks.length).toBeLessThan(codeBlockExamples.length * 0.05);
    });
  });

  describe('Example Coverage', () => {
    it('should have examples distributed across packages', () => {
      const packageDistribution = allExamples.reduce((acc, example) => {
        const packageMatch = example.filePath.match(/packages\/([^\/]+)\//);
        const packageName = packageMatch ? packageMatch[1] : 'unknown';
        acc[packageName] = (acc[packageName] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      console.log('\nExample distribution by package:');
      Object.entries(packageDistribution).forEach(([pkg, count]) => {
        console.log(`  ${pkg}: ${count} examples`);
      });

      expect(Object.keys(packageDistribution).length).toBeGreaterThan(0);
    });

    it('should have examples for utility functions', () => {
      const utilityExamples = allExamples.filter(example =>
        example.filePath.includes('utils') ||
        example.filePath.includes('helpers') ||
        example.filePath.includes('tools')
      );

      console.log(`Found ${utilityExamples.length} examples in utility files`);
      expect(utilityExamples.length).toBeGreaterThan(0);
    });
  });

  describe('Summary', () => {
    it('should provide example validation summary', () => {
      const summary = {
        totalExamples: allExamples.length,
        codeBlockExamples: allExamples.filter(ex => ex.isCodeBlock).length,
        inlineExamples: allExamples.filter(ex => !ex.isCodeBlock).length,
        filesWithExamples: [...new Set(allExamples.map(ex => ex.filePath))].length,
        languages: [...new Set(allExamples.map(ex => ex.language || 'typescript'))]
      };

      console.log('\n=== JSDoc Example Validation Summary ===');
      console.log(`📝 Total examples: ${summary.totalExamples}`);
      console.log(`📋 Code block examples: ${summary.codeBlockExamples}`);
      console.log(`💬 Inline examples: ${summary.inlineExamples}`);
      console.log(`📁 Files with examples: ${summary.filesWithExamples}`);
      console.log(`🔤 Languages: ${summary.languages.join(', ')}`);

      expect(summary.totalExamples).toBeGreaterThan(0);
    });
  });
});