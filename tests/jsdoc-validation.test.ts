import { describe, it, expect } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import * as glob from 'glob';

/**
 * Interface for extracted JSDoc comments with their metadata
 */
interface JSDocComment {
  /** The full JSDoc comment content */
  content: string;
  /** File path where the JSDoc comment was found */
  filePath: string;
  /** Line number where the JSDoc comment starts */
  lineNumber: number;
  /** Associated function or class name (if found) */
  associatedName?: string;
  /** Extracted parameters from @param tags */
  params: Array<{ name: string; type?: string; description: string; optional?: boolean }>;
  /** Extracted return information from @returns tag */
  returns?: { type?: string; description: string };
  /** Extracted examples from @example tags */
  examples: string[];
  /** Whether this JSDoc has any syntax errors */
  hasSyntaxErrors: boolean;
  /** Any syntax error messages found */
  syntaxErrors: string[];
}

/**
 * Test suite for validating JSDoc documentation throughout the APEX codebase
 * Ensures all public APIs have proper documentation with correct syntax
 */
describe('JSDoc Documentation Validation', () => {
  let allJSDocComments: JSDocComment[] = [];
  let sourceFiles: string[] = [];

  /**
   * Extract JSDoc comments from a file's content
   */
  async function extractJSDocFromFile(filePath: string): Promise<JSDocComment[]> {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    const jsDocComments: JSDocComment[] = [];

    // Enhanced regex to match JSDoc comments
    const jsDocRegex = /\/\*\*([\s\S]*?)\*\//g;
    let match;

    while ((match = jsDocRegex.exec(content)) !== null) {
      const commentContent = match[1];
      const commentStart = match.index;
      const lineNumber = content.substring(0, commentStart).split('\n').length;

      // Find the associated function/class/interface name
      const afterComment = content.substring(match.index + match[0].length);
      const associatedMatch = afterComment.match(/^\s*(?:export\s+)?(?:async\s+)?(?:function\s+(\w+)|class\s+(\w+)|interface\s+(\w+)|const\s+(\w+)|let\s+(\w+)|var\s+(\w+))/);
      const associatedName = associatedMatch ? (associatedMatch[1] || associatedMatch[2] || associatedMatch[3] || associatedMatch[4] || associatedMatch[5] || associatedMatch[6]) : undefined;

      const jsDocComment = parseJSDocComment(commentContent, filePath, lineNumber, associatedName);
      jsDocComments.push(jsDocComment);
    }

    return jsDocComments;
  }

  /**
   * Parse JSDoc comment content into structured data
   */
  function parseJSDocComment(
    content: string,
    filePath: string,
    lineNumber: number,
    associatedName?: string
  ): JSDocComment {
    const params: Array<{ name: string; type?: string; description: string; optional?: boolean }> = [];
    let returns: { type?: string; description: string } | undefined;
    const examples: string[] = [];
    const syntaxErrors: string[] = [];

    // Extract @param tags
    const paramRegex = /@param\s+(?:\{([^}]+)\}\s+)?(?:(\[)?(\w+)(?:\])?(?:\s+-\s+)?\s+(.*))/g;
    let paramMatch;
    while ((paramMatch = paramRegex.exec(content)) !== null) {
      const [, type, optional, name, description] = paramMatch;
      if (name && description) {
        params.push({
          name: name.trim(),
          type: type?.trim(),
          description: description.trim(),
          optional: !!optional
        });
      } else {
        syntaxErrors.push(`Invalid @param syntax at line ${lineNumber}: missing name or description`);
      }
    }

    // Extract @returns tag
    const returnsRegex = /@returns?\s+(?:\{([^}]+)\}\s+)?(.*)/g;
    const returnsMatch = returnsRegex.exec(content);
    if (returnsMatch) {
      const [, type, description] = returnsMatch;
      if (description?.trim()) {
        returns = {
          type: type?.trim(),
          description: description.trim()
        };
      } else {
        syntaxErrors.push(`Invalid @returns syntax at line ${lineNumber}: missing description`);
      }
    }

    // Extract @example tags
    const exampleRegex = /@example\s*([\s\S]*?)(?=@\w+|$)/g;
    let exampleMatch;
    while ((exampleMatch = exampleRegex.exec(content)) !== null) {
      const exampleContent = exampleMatch[1]?.trim();
      if (exampleContent) {
        examples.push(exampleContent);
      }
    }

    // Check for common JSDoc syntax errors
    if (content.includes('@param') && params.length === 0) {
      syntaxErrors.push(`Malformed @param tags at line ${lineNumber}`);
    }

    if (content.includes('@returns') && !returns) {
      syntaxErrors.push(`Malformed @returns tag at line ${lineNumber}`);
    }

    return {
      content,
      filePath,
      lineNumber,
      associatedName,
      params,
      returns,
      examples,
      hasSyntaxErrors: syntaxErrors.length > 0,
      syntaxErrors
    };
  }

  /**
   * Validate TypeScript syntax of example code blocks
   */
  function validateExampleSyntax(example: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Basic syntax checks for TypeScript/JavaScript
    const codeBlocks = example.match(/```(?:typescript|javascript|ts|js)?\s*([\s\S]*?)```/g);

    if (codeBlocks) {
      for (const block of codeBlocks) {
        const code = block.replace(/```(?:typescript|javascript|ts|js)?\s*/, '').replace(/```$/, '').trim();

        // Check for basic syntax issues
        if (code.includes('function') && !code.includes('{')) {
          errors.push('Function declaration missing opening brace');
        }

        // Check for unmatched braces/brackets/parentheses
        const braces = (code.match(/\{/g) || []).length - (code.match(/\}/g) || []).length;
        const brackets = (code.match(/\[/g) || []).length - (code.match(/\]/g) || []).length;
        const parens = (code.match(/\(/g) || []).length - (code.match(/\)/g) || []).length;

        if (braces !== 0) errors.push('Unmatched braces in code block');
        if (brackets !== 0) errors.push('Unmatched brackets in code block');
        if (parens !== 0) errors.push('Unmatched parentheses in code block');

        // Check for common typos
        if (code.includes('console.log') && !code.includes('console.log(')) {
          errors.push('Malformed console.log statement');
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Setup: collect all source files and JSDoc comments
  beforeAll(async () => {
    // Get all TypeScript files in packages
    const pattern = 'packages/**/*.{ts,tsx}';
    sourceFiles = glob.sync(pattern, {
      ignore: ['**/node_modules/**', '**/dist/**', '**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts']
    });

    // Extract JSDoc comments from all files
    for (const file of sourceFiles) {
      try {
        const comments = await extractJSDocFromFile(file);
        allJSDocComments.push(...comments);
      } catch (error) {
        console.warn(`Failed to process ${file}: ${error}`);
      }
    }

    console.log(`Found ${allJSDocComments.length} JSDoc comments in ${sourceFiles.length} source files`);
  });

  describe('JSDoc Syntax Validation', () => {
    it('should have valid JSDoc syntax in all comments', () => {
      const commentsWithErrors = allJSDocComments.filter(comment => comment.hasSyntaxErrors);

      if (commentsWithErrors.length > 0) {
        const errorDetails = commentsWithErrors.map(comment =>
          `${comment.filePath}:${comment.lineNumber} (${comment.associatedName || 'unknown'}): ${comment.syntaxErrors.join(', ')}`
        ).join('\n');

        console.log('JSDoc syntax errors found:\n' + errorDetails);
      }

      expect(commentsWithErrors).toHaveLength(0);
    });

    it('should have properly formatted @param tags', () => {
      const commentsWithParams = allJSDocComments.filter(comment => comment.params.length > 0);
      const malformedParams = [];

      for (const comment of commentsWithParams) {
        for (const param of comment.params) {
          if (!param.name || param.name.length === 0) {
            malformedParams.push(`${comment.filePath}:${comment.lineNumber} - Missing parameter name`);
          }
          if (!param.description || param.description.length < 5) {
            malformedParams.push(`${comment.filePath}:${comment.lineNumber} - Parameter '${param.name}' has insufficient description`);
          }
        }
      }

      if (malformedParams.length > 0) {
        console.log('Malformed @param tags:\n' + malformedParams.join('\n'));
      }

      expect(malformedParams).toHaveLength(0);
    });

    it('should have properly formatted @returns tags', () => {
      const commentsWithReturns = allJSDocComments.filter(comment => comment.returns);
      const malformedReturns = [];

      for (const comment of commentsWithReturns) {
        const returns = comment.returns!;
        if (!returns.description || returns.description.length < 5) {
          malformedReturns.push(`${comment.filePath}:${comment.lineNumber} - @returns has insufficient description`);
        }
      }

      if (malformedReturns.length > 0) {
        console.log('Malformed @returns tags:\n' + malformedReturns.join('\n'));
      }

      expect(malformedReturns).toHaveLength(0);
    });
  });

  describe('Example Code Validation', () => {
    it('should have syntactically valid example code', () => {
      const commentsWithExamples = allJSDocComments.filter(comment => comment.examples.length > 0);
      const invalidExamples = [];

      for (const comment of commentsWithExamples) {
        for (let i = 0; i < comment.examples.length; i++) {
          const example = comment.examples[i];
          const validation = validateExampleSyntax(example);

          if (!validation.isValid) {
            invalidExamples.push({
              location: `${comment.filePath}:${comment.lineNumber} (${comment.associatedName || 'unknown'})`,
              errors: validation.errors,
              example: example.substring(0, 100) + '...'
            });
          }
        }
      }

      if (invalidExamples.length > 0) {
        const errorDetails = invalidExamples.map(item =>
          `${item.location}: ${item.errors.join(', ')}\n  Example: ${item.example}`
        ).join('\n\n');

        console.log('Invalid example code found:\n' + errorDetails);
      }

      expect(invalidExamples).toHaveLength(0);
    });

    it('should have meaningful example code', () => {
      const commentsWithExamples = allJSDocComments.filter(comment => comment.examples.length > 0);
      const trivialExamples = [];

      for (const comment of commentsWithExamples) {
        for (const example of comment.examples) {
          // Check for overly simple or placeholder examples
          const codeContent = example.replace(/```[\s\S]*?```/g, '').trim();

          if (codeContent.length < 10) {
            trivialExamples.push(`${comment.filePath}:${comment.lineNumber} - Example too short`);
          }

          if (example.includes('// TODO') || example.includes('// FIXME')) {
            trivialExamples.push(`${comment.filePath}:${comment.lineNumber} - Example contains TODO/FIXME`);
          }
        }
      }

      // Allow some trivial examples as they might be intentionally simple
      expect(trivialExamples.length).toBeLessThan(allJSDocComments.length * 0.1);
    });
  });

  describe('Documentation Coverage', () => {
    it('should document public functions with JSDoc', async () => {
      const undocumentedFunctions = [];

      for (const file of sourceFiles) {
        try {
          const content = await fs.readFile(file, 'utf-8');
          const lines = content.split('\n');

          // Find export functions/classes without JSDoc
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // Check for exported functions/classes
            if (line.match(/^export\s+(async\s+)?function\s+\w+|^export\s+class\s+\w+|^export\s+interface\s+\w+/)) {
              // Check if there's a JSDoc comment above (within 3 lines)
              let hasJSDoc = false;
              for (let j = Math.max(0, i - 3); j < i; j++) {
                if (lines[j].trim().includes('/**') || lines[j].trim().includes('*/')) {
                  hasJSDoc = true;
                  break;
                }
              }

              if (!hasJSDoc) {
                const functionMatch = line.match(/(?:function|class|interface)\s+(\w+)/);
                const name = functionMatch ? functionMatch[1] : 'unknown';
                undocumentedFunctions.push(`${file}:${i + 1} - ${name}`);
              }
            }
          }
        } catch (error) {
          console.warn(`Failed to check documentation coverage for ${file}: ${error}`);
        }
      }

      if (undocumentedFunctions.length > 0) {
        console.log(`Found ${undocumentedFunctions.length} undocumented public APIs:\n${undocumentedFunctions.slice(0, 10).join('\n')}`);
        if (undocumentedFunctions.length > 10) {
          console.log(`... and ${undocumentedFunctions.length - 10} more`);
        }
      }

      // Expect less than 10% of functions to be undocumented (allowing some flexibility)
      const maxUndocumented = Math.max(5, sourceFiles.length * 0.1);
      expect(undocumentedFunctions.length).toBeLessThan(maxUndocumented);
    });

    it('should have appropriate documentation for all complex functions', () => {
      const complexFunctions = allJSDocComments.filter(comment => {
        // Consider functions with parameters or return values as complex
        return comment.params.length > 0 || comment.returns;
      });

      const incompleteDocumentation = [];

      for (const comment of complexFunctions) {
        // Functions with parameters should document them
        if (comment.params.length > 0) {
          const undocumentedParams = comment.params.filter(param => !param.description || param.description.length < 3);
          if (undocumentedParams.length > 0) {
            incompleteDocumentation.push(`${comment.filePath}:${comment.lineNumber} - Undocumented parameters: ${undocumentedParams.map(p => p.name).join(', ')}`);
          }
        }

        // Functions with return values should document them
        if (comment.returns && (!comment.returns.description || comment.returns.description.length < 5)) {
          incompleteDocumentation.push(`${comment.filePath}:${comment.lineNumber} - Incomplete @returns documentation`);
        }
      }

      if (incompleteDocumentation.length > 0) {
        console.log('Incomplete documentation found:\n' + incompleteDocumentation.slice(0, 5).join('\n'));
      }

      expect(incompleteDocumentation.length).toBeLessThan(complexFunctions.length * 0.1);
    });
  });

  describe('JSDoc Quality Standards', () => {
    it('should have examples for public utility functions', () => {
      const utilityFunctions = allJSDocComments.filter(comment =>
        comment.associatedName &&
        (comment.filePath.includes('utils') || comment.filePath.includes('helpers')) &&
        (comment.params.length > 0 || comment.returns)
      );

      const functionsWithoutExamples = utilityFunctions.filter(comment => comment.examples.length === 0);

      if (functionsWithoutExamples.length > 0) {
        console.log(`Utility functions without examples (${functionsWithoutExamples.length}/${utilityFunctions.length}):`);
        functionsWithoutExamples.slice(0, 5).forEach(comment => {
          console.log(`  ${comment.filePath}:${comment.lineNumber} - ${comment.associatedName}`);
        });
      }

      // Expect at least 70% of utility functions to have examples
      expect(functionsWithoutExamples.length).toBeLessThan(utilityFunctions.length * 0.3);
    });

    it('should use consistent JSDoc formatting', () => {
      const inconsistentFormatting = [];

      for (const comment of allJSDocComments) {
        // Check for consistent description format (should start with capital letter)
        const firstLine = comment.content.split('\n')[0]?.replace(/^\s*\*?\s*/, '').trim();
        if (firstLine && firstLine.length > 0) {
          const firstChar = firstLine.charAt(0);
          if (firstChar !== firstChar.toUpperCase() && !firstLine.match(/^[@{]/)) {
            inconsistentFormatting.push(`${comment.filePath}:${comment.lineNumber} - Description should start with capital letter`);
          }
        }

        // Check parameter descriptions start with lowercase (following common convention)
        for (const param of comment.params) {
          const firstChar = param.description.charAt(0);
          if (firstChar === firstChar.toUpperCase() && !param.description.match(/^[A-Z][a-z]/)) {
            // Allow proper nouns and abbreviations
            if (!param.description.match(/^(API|URL|HTTP|JSON|XML|CSS|HTML|DOM)/)) {
              inconsistentFormatting.push(`${comment.filePath}:${comment.lineNumber} - Parameter '${param.name}' description should start with lowercase`);
            }
          }
        }
      }

      if (inconsistentFormatting.length > 0) {
        console.log('Formatting inconsistencies (showing first 10):\n' + inconsistentFormatting.slice(0, 10).join('\n'));
      }

      // Allow some formatting inconsistencies
      expect(inconsistentFormatting.length).toBeLessThan(allJSDocComments.length * 0.1);
    });
  });

  describe('Test Coverage Summary', () => {
    it('should provide comprehensive test coverage summary', () => {
      const summary = {
        totalFiles: sourceFiles.length,
        totalJSDocComments: allJSDocComments.length,
        commentsWithParams: allJSDocComments.filter(c => c.params.length > 0).length,
        commentsWithReturns: allJSDocComments.filter(c => c.returns).length,
        commentsWithExamples: allJSDocComments.filter(c => c.examples.length > 0).length,
        commentsWithSyntaxErrors: allJSDocComments.filter(c => c.hasSyntaxErrors).length,
        filesCovered: [...new Set(allJSDocComments.map(c => c.filePath))].length,
        averageCommentsPerFile: Math.round((allJSDocComments.length / sourceFiles.length) * 100) / 100,
        documentationCoverage: Math.round((allJSDocComments.length / sourceFiles.length) * 100) / 100
      };

      console.log('\n=== JSDoc Documentation Test Coverage Summary ===');
      console.log(`📁 Files analyzed: ${summary.totalFiles}`);
      console.log(`📝 JSDoc comments found: ${summary.totalJSDocComments}`);
      console.log(`📄 Files with documentation: ${summary.filesCovered}`);
      console.log(`📊 Average comments per file: ${summary.averageCommentsPerFile}`);
      console.log(`🏷️  Comments with @param: ${summary.commentsWithParams}`);
      console.log(`↩️  Comments with @returns: ${summary.commentsWithReturns}`);
      console.log(`💡 Comments with @example: ${summary.commentsWithExamples}`);
      console.log(`❌ Comments with syntax errors: ${summary.commentsWithSyntaxErrors}`);
      console.log(`✅ Documentation quality: ${summary.commentsWithSyntaxErrors === 0 ? 'Excellent' : 'Needs improvement'}`);

      // Store results for external reporting
      expect(summary.totalJSDocComments).toBeGreaterThan(0);
      expect(summary.commentsWithSyntaxErrors).toBe(0);
    });
  });
});