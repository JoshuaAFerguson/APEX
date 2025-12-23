/**
 * Acceptance Criteria Tests for Documentation Reference Extraction
 *
 * This test file specifically validates the acceptance criteria:
 * "CrossReferenceValidator can extract symbol references from markdown code blocks,
 * @see tags, and inline code patterns like FunctionName(), ClassName, TypeName"
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { CrossReferenceValidator, type DocumentationReference } from './cross-reference-validator';

describe('Documentation Reference Extraction - Acceptance Criteria', () => {
  let validator: CrossReferenceValidator;

  beforeEach(() => {
    validator = new CrossReferenceValidator();
  });

  test('should extract symbol references from markdown code blocks', () => {
    const content = `
# API Documentation

Example usage:

\`\`\`javascript
const processor = new DataProcessor();
const result = await processor.validateInput(data);
const service = new UserService();
service.createUser();
\`\`\`

TypeScript example:

\`\`\`typescript
class TaskManager {
  execute() {}
}
const manager = new TaskManager();
\`\`\`
`;

    const references = validator.extractCodeBlockReferences('docs.md', content);
    const symbolNames = references.map(ref => ref.symbolName);

    // Should extract class names and function calls from code blocks
    expect(symbolNames).toContain('DataProcessor');
    expect(symbolNames).toContain('validateInput');
    expect(symbolNames).toContain('UserService');
    expect(symbolNames).toContain('createUser');
    expect(symbolNames).toContain('TaskManager');
    expect(symbolNames).toContain('execute');

    // All should be marked as code-block references
    expect(references.every(ref => ref.referenceType === 'code-block')).toBe(true);
  });

  test('should extract symbol references from @see tags', () => {
    const content = `
/**
 * Process user data and validate input
 * @see validateInput
 * @see UserService
 * @see {@link DataProcessor}
 * @see module.UserValidator
 */
function processUserData() {}

/**
 * Another function with multiple see references
 * @see createUser
 * @see utils.formatData
 */
function handleUser() {}
`;

    const references = validator.extractSeeTagReferences('service.ts', content);
    const symbolNames = references.map(ref => ref.symbolName);

    // Should extract all referenced symbols from @see tags
    expect(symbolNames).toContain('validateInput');
    expect(symbolNames).toContain('UserService');
    expect(symbolNames).toContain('DataProcessor');
    expect(symbolNames).toContain('UserValidator'); // From module.UserValidator
    expect(symbolNames).toContain('createUser');
    expect(symbolNames).toContain('formatData'); // From utils.formatData

    // All should be marked as see-tag references
    expect(references.every(ref => ref.referenceType === 'see-tag')).toBe(true);
  });

  test('should extract symbol references from inline code patterns like FunctionName(), ClassName, TypeName', () => {
    const content = `
# User Guide

To process data, call \`processData()\` function.
The \`UserService\` class provides user management functionality.
Use the \`ConfigType\` interface to define configuration.
Call \`validateUser()\` before creating accounts.
The \`DatabaseManager\` handles data persistence.
You can also use \`calculateSum()\` for mathematical operations.
`;

    const references = validator.extractInlineCodeReferences('guide.md', content);

    // Should extract function names (with parentheses)
    const functionReferences = references.filter(ref =>
      ['processData', 'validateUser', 'calculateSum'].includes(ref.symbolName)
    );
    expect(functionReferences).toHaveLength(3);

    // Should extract class names
    const classReferences = references.filter(ref =>
      ['UserService', 'DatabaseManager'].includes(ref.symbolName)
    );
    expect(classReferences).toHaveLength(2);

    // Should extract type names
    const typeReferences = references.filter(ref =>
      ['ConfigType'].includes(ref.symbolName)
    );
    expect(typeReferences).toHaveLength(1);

    // All should be marked as inline-code references
    expect(references.every(ref => ref.referenceType === 'inline-code')).toBe(true);
  });

  test('ACCEPTANCE CRITERIA INTEGRATION: should extract all types of references in a combined document', () => {
    const content = `
# Complete API Documentation

The \`ApiClient\` class is the main entry point for API operations.

## Usage Examples

\`\`\`javascript
const client = new ApiClient();
const result = await client.processRequest();
\`\`\`

## Methods

### processRequest()

Processes API requests and returns results.

/**
 * Implementation details
 * @see validateRequest
 * @see {@link RequestValidator}
 */

You can also use \`validateData()\` for input validation.
The \`ResponseHandler\` manages response processing.

\`\`\`typescript
interface RequestConfig {
  timeout: number;
}

class RequestValidator {
  validate(config: RequestConfig): boolean {
    return true;
  }
}
\`\`\`
`;

    const allReferences = validator.extractDocumentationReferences('api.md', content);

    // Group by reference type
    const inlineRefs = allReferences.filter(r => r.referenceType === 'inline-code');
    const seeRefs = allReferences.filter(r => r.referenceType === 'see-tag');
    const codeRefs = allReferences.filter(r => r.referenceType === 'code-block');

    // Should have all three types
    expect(inlineRefs.length).toBeGreaterThan(0);
    expect(seeRefs.length).toBeGreaterThan(0);
    expect(codeRefs.length).toBeGreaterThan(0);

    const allSymbolNames = allReferences.map(r => r.symbolName);

    // Inline code references
    expect(allSymbolNames).toContain('ApiClient');
    expect(allSymbolNames).toContain('validateData');
    expect(allSymbolNames).toContain('ResponseHandler');

    // @see tag references
    expect(allSymbolNames).toContain('validateRequest');
    expect(allSymbolNames).toContain('RequestValidator');

    // Code block references
    expect(allSymbolNames).toContain('processRequest');
    expect(allSymbolNames).toContain('RequestConfig');
    expect(allSymbolNames).toContain('validate');

    // Verify this covers all the acceptance criteria patterns:
    // ✅ Markdown code blocks
    // ✅ @see tags
    // ✅ Inline code patterns like FunctionName(), ClassName, TypeName
    expect(allReferences.length).toBeGreaterThanOrEqual(8);
  });
});