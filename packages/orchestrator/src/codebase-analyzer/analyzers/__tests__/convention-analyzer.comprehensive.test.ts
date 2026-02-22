/**
 * ConventionAnalyzer Comprehensive Validation Tests
 *
 * Comprehensive tests that validate every aspect of ConventionAnalysis output
 * against the schema, ensuring complete coverage of all edge cases, mixed
 * conventions, and inconsistent patterns.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { join } from 'path';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { ConventionAnalyzer } from '../convention-analyzer.js';
import { ConventionAnalysisSchema, type ConventionAnalysis } from '@apexcli/core';

describe('ConventionAnalyzer Comprehensive Validation', () => {
  let analyzer: ConventionAnalyzer;
  let tempTestDir: string;

  beforeAll(() => {
    analyzer = new ConventionAnalyzer();
  });

  beforeEach(async () => {
    tempTestDir = join(tmpdir(), `convention-comp-${Date.now()}-${Math.random().toString(36).substring(7)}`);
    await fs.mkdir(tempTestDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(tempTestDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Complete Field Validation', () => {
    it('should validate all required fields are present and correct types', async () => {
      const srcDir = join(tempTestDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const comprehensiveCode = `
/**
 * Comprehensive test file with all conventions
 * @author Test Author
 * @since 1.0.0
 * @example
 * \`\`\`typescript
 * const service = new UserService();
 * const user = await service.createUser({ name: 'John' });
 * \`\`\`
 */
import { logger } from './logger.js';
import * as utils from './utils/index.js';
const fs = require('fs');

const MAX_USERS = 1000;
const DEFAULT_TIMEOUT = 30000;
let activeConnections = 0;

/**
 * User service class
 * @public
 * @readonly
 */
export class UserService {
  private readonly databaseUrl: string;
  private userCount: number = 0;

  constructor(dbUrl: string) {
    this.databaseUrl = dbUrl;
  }

  /**
   * Create a new user
   * @param userData - User creation data
   * @returns Promise resolving to created user
   * @throws Error if user creation fails
   * @example
   * const user = await service.createUser({ name: 'Alice' });
   */
  async createUser(userData: UserData): Promise<User> {
    const userId = this.generateId();
    const timestamp = new Date();

    if (this.userCount >= MAX_USERS) {
      throw new Error('User limit exceeded');
    }

    const newUser: User = {
      id: userId,
      name: userData.name,
      createdAt: timestamp,
      isActive: true
    };

    this.userCount++;
    logger.info(\`Created user: \${userId}\`);
    return newUser;
  }

  // Simple comment for method
  updateUser(userId: string, updates: Partial<User>): User | null {
    // Implementation here
    return null;
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 15);
  }
}

interface User {
  id: string;
  name: string;
  createdAt: Date;
  isActive: boolean;
}

interface UserData {
  name: string;
}

type UserStatus = 'active' | 'inactive' | 'suspended';

export { UserService, User, UserData };
`;

      await fs.writeFile(join(srcDir, 'userService.ts'), comprehensiveCode);

      const result = await analyzer.analyze(tempTestDir);

      // Strict schema validation
      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      const parsed = ConventionAnalysisSchema.parse(result);

      // Validate all required fields exist with correct types
      expect(typeof parsed.fileNaming).toBe('string');
      expect(typeof parsed.functionNaming).toBe('string');
      expect(typeof parsed.variableNaming).toBe('string');
      expect(typeof parsed.indentation.type).toBe('string');
      expect(typeof parsed.imports.style).toBe('string');
      expect(typeof parsed.documentation.style).toBe('string');
      expect(typeof parsed.documentation.coverage).toBe('number');

      // Validate enum values for required fields
      expect(['camelCase', 'PascalCase', 'kebab-case', 'snake_case', 'mixed', 'inconsistent']).toContain(parsed.fileNaming);
      expect(['camelCase', 'PascalCase', 'snake_case', 'mixed', 'inconsistent']).toContain(parsed.functionNaming);
      expect(['camelCase', 'PascalCase', 'snake_case', 'SCREAMING_SNAKE_CASE', 'mixed', 'inconsistent']).toContain(parsed.variableNaming);
      expect(['spaces', 'tabs', 'mixed']).toContain(parsed.indentation.type);
      expect(['es6', 'commonjs', 'amd', 'umd', 'mixed']).toContain(parsed.imports.style);
      expect(['jsdoc', 'tsdoc', 'inline', 'markdown', 'none', 'mixed']).toContain(parsed.documentation.style);

      // Validate numeric constraints
      expect(parsed.documentation.coverage).toBeGreaterThanOrEqual(0);
      expect(parsed.documentation.coverage).toBeLessThanOrEqual(100);
      expect(Number.isInteger(parsed.documentation.coverage)).toBe(true);

      if (parsed.indentation.size !== undefined) {
        expect(parsed.indentation.size).toBeGreaterThanOrEqual(1);
        expect(parsed.indentation.size).toBeLessThanOrEqual(8);
      }

      // Validate optional fields when present
      if (parsed.classNaming !== undefined) {
        expect(['PascalCase', 'camelCase', 'snake_case', 'mixed', 'inconsistent']).toContain(parsed.classNaming);
      }

      if (parsed.constantNaming !== undefined) {
        expect(['SCREAMING_SNAKE_CASE', 'camelCase', 'PascalCase', 'mixed', 'inconsistent']).toContain(parsed.constantNaming);
      }

      if (parsed.imports.quotes !== undefined) {
        expect(['single', 'double', 'mixed']).toContain(parsed.imports.quotes);
      }

      if (parsed.formatting !== undefined) {
        if (parsed.formatting.lineLength !== undefined) {
          expect(parsed.formatting.lineLength).toBeGreaterThanOrEqual(40);
          expect(parsed.formatting.lineLength).toBeLessThanOrEqual(200);
        }
        if (parsed.formatting.semicolons !== undefined) {
          expect(['required', 'optional', 'mixed']).toContain(parsed.formatting.semicolons);
        }
        if (parsed.formatting.quotes !== undefined) {
          expect(['single', 'double', 'backtick', 'mixed']).toContain(parsed.formatting.quotes);
        }
      }

      if (parsed.organization !== undefined) {
        expect(['separate-__tests__', 'separate-tests', 'colocated', 'mixed']).toContain(parsed.organization.testLocation);
        expect(['suffix-.test', 'suffix-.spec', 'suffix-Test', 'prefix-test-', 'mixed']).toContain(parsed.organization.testNaming);
        expect(['src', 'lib', 'app', 'source', 'root-level', 'mixed']).toContain(parsed.organization.sourceStructure);
        if (parsed.organization.configLocation !== undefined) {
          expect(['root', 'config-dir', 'mixed']).toContain(parsed.organization.configLocation);
        }
      }
    });

    it('should handle all edge cases in naming convention detection', async () => {
      const srcDir = join(tempTestDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      // Test extreme edge cases in naming conventions
      const edgeCaseFiles = [
        // Single letter names
        {
          name: 'a.ts',
          content: `
export function a() { return 'single'; }
export const b = 'constant';
export class C {}
const d = 'variable';
`
        },
        // Numbers and special characters
        {
          name: 'file-with-123.ts',
          content: `
export function func123() { return 'numbered'; }
export const CONST_123 = 'numbered constant';
export class Class123 {}
const var123 = 'numbered variable';
`
        },
        // Very long names
        {
          name: 'veryLongFileNameWithManyWords.ts',
          content: `
export function veryLongFunctionNameWithManyWordsAndParameters() { return 'long'; }
export const VERY_LONG_CONSTANT_NAME_WITH_MANY_WORDS = 'long constant';
export class VeryLongClassNameWithManyWordsAndProperties {}
const veryLongVariableNameWithManyWords = 'long variable';
`
        },
        // Mixed styles within single file
        {
          name: 'mixedFile.ts',
          content: `
export function camelCaseFunction() { return 'camel'; }
export function snake_case_function() { return 'snake'; }
export function PascalCaseFunction() { return 'pascal'; }
export const camelCaseConst = 'camel';
export const SCREAMING_SNAKE = 'screaming';
export const PascalConst = 'pascal';
export class CamelClass {}
export class snake_class {}
export class PascalClass {}
`
        },
        // Unicode and international characters
        {
          name: 'unicode-file.ts',
          content: `
export function créateUser() { return 'french'; }
export function создатьПользователя() { return 'russian'; }
export const MAX_用户 = 100;
export class UsuarioService {}
`
        }
      ];

      for (const file of edgeCaseFiles) {
        await fs.writeFile(join(srcDir, file.name), file.content);
      }

      const result = await analyzer.analyze(tempTestDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();

      // Should detect mixed/inconsistent patterns due to variety
      expect(['mixed', 'inconsistent']).toContain(result.fileNaming);
      expect(['mixed', 'inconsistent']).toContain(result.functionNaming);
      expect(['mixed', 'inconsistent']).toContain(result.variableNaming);
      expect(['mixed', 'inconsistent']).toContain(result.classNaming);
      expect(['mixed', 'inconsistent']).toContain(result.constantNaming);

      // All other validations should still pass
      expect(result.documentation.coverage).toBeGreaterThanOrEqual(0);
      expect(result.documentation.coverage).toBeLessThanOrEqual(100);
    });
  });

  describe('Mixed Conventions Edge Cases', () => {
    it('should accurately detect 40-60% mixed thresholds', async () => {
      const srcDir = join(tempTestDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      // Create files with exactly 50/50 split to test boundary conditions
      const mixedFiles = [
        // 50% camelCase, 50% snake_case file names
        { name: 'camelCaseFile1.ts', content: 'export const test = 1;' },
        { name: 'camelCaseFile2.ts', content: 'export const test = 2;' },
        { name: 'snake_case_file1.ts', content: 'export const test = 3;' },
        { name: 'snake_case_file2.ts', content: 'export const test = 4;' },

        // Functions with deliberate 50/50 split
        {
          name: 'functions.ts',
          content: `
export function camelCaseFunc1() { return 1; }
export function camelCaseFunc2() { return 2; }
export function snake_case_func1() { return 3; }
export function snake_case_func2() { return 4; }
`
        }
      ];

      for (const file of mixedFiles) {
        await fs.writeFile(join(srcDir, file.name), file.content);
      }

      const result = await analyzer.analyze(tempTestDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();

      // With 50/50 split, should detect mixed patterns
      expect(['mixed', 'inconsistent']).toContain(result.fileNaming);
      expect(['mixed', 'inconsistent']).toContain(result.functionNaming);
    });

    it('should handle inconsistent indentation patterns', async () => {
      const srcDir = join(tempTestDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const indentationFiles = [
        {
          name: 'tabs.ts',
          content: `
export class TabsClass {
\tconstructor() {
\t\tthis.value = 'tabs';
\t}
}
`
        },
        {
          name: 'spaces2.ts',
          content: `
export class Spaces2Class {
  constructor() {
    this.value = 'spaces2';
  }
}
`
        },
        {
          name: 'spaces4.ts',
          content: `
export class Spaces4Class {
    constructor() {
        this.value = 'spaces4';
    }
}
`
        },
        {
          name: 'mixed.ts',
          content: `
export class MixedClass {
\tconstructor() {
  \t  this.value = 'chaos';
    }
}
`
        }
      ];

      for (const file of indentationFiles) {
        await fs.writeFile(join(srcDir, file.name), file.content);
      }

      const result = await analyzer.analyze(tempTestDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();

      // Should detect mixed indentation
      expect(result.indentation.type).toBe('mixed');

      // Size should still be reasonable despite mixed patterns
      if (result.indentation.size !== undefined) {
        expect(result.indentation.size).toBeGreaterThanOrEqual(1);
        expect(result.indentation.size).toBeLessThanOrEqual(8);
      }
    });

    it('should handle mixed import styles and quote patterns', async () => {
      const srcDir = join(tempTestDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const importFiles = [
        {
          name: 'es6Single.ts',
          content: `
import { func } from './utils';
import * as helpers from './helpers';
export const value = func();
`
        },
        {
          name: 'es6Double.ts',
          content: `
import { func } from "./utils";
import * as helpers from "./helpers";
export const value = func();
`
        },
        {
          name: 'commonjs.js',
          content: `
const { func } = require('./utils');
const helpers = require('./helpers');
module.exports = { value: func() };
`
        },
        {
          name: 'mixedQuotes.ts',
          content: `
import { func } from './single-quotes';
import { other } from "./double-quotes";
const message = 'single quote string';
const other_message = "double quote string";
const template = \`template string\`;
`
        }
      ];

      for (const file of importFiles) {
        await fs.writeFile(join(srcDir, file.name), file.content);
      }

      const result = await analyzer.analyze(tempTestDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();

      // Should detect mixed import styles
      expect(result.imports.style).toBe('mixed');
      expect(result.imports.quotes).toBe('mixed');

      // Formatting quotes should also be mixed
      if (result.formatting?.quotes !== undefined) {
        expect(['mixed', 'single', 'double', 'backtick']).toContain(result.formatting.quotes);
      }
    });
  });

  describe('Documentation Coverage Accuracy', () => {
    it('should calculate precise documentation coverage percentages', async () => {
      const srcDir = join(tempTestDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      // Create file with exactly known documentation ratios
      const documentedFile = `
/**
 * Documented function 1
 */
export function documentedFunc1() { return 1; }

/**
 * Documented function 2
 */
export function documentedFunc2() { return 2; }

// Undocumented function 1
export function undocumentedFunc1() { return 3; }

// Undocumented function 2
export function undocumentedFunc2() { return 4; }

/**
 * Documented class
 */
export class DocumentedClass {
  method() { return 'method'; }
}

export class UndocumentedClass {
  method() { return 'method'; }
}
`;

      await fs.writeFile(join(srcDir, 'precise.ts'), documentedFile);

      const result = await analyzer.analyze(tempTestDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();

      // With 3 documented elements (2 functions + 1 class) out of 6 total elements
      // Coverage should be 50%
      expect(result.documentation.coverage).toBeGreaterThanOrEqual(40);
      expect(result.documentation.coverage).toBeLessThanOrEqual(60);
      expect(result.documentation.style).toBe('jsdoc');
    });

    it('should distinguish between documentation styles correctly', async () => {
      const srcDir = join(tempTestDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const jsdocFile = `
/**
 * JSDoc function
 * @param param - Parameter
 * @returns Result
 */
export function jsdocFunc(param: string): string { return param; }
`;

      const tsdocFile = `
/**
 * TSDoc function
 * @param param - Parameter
 * @returns Result
 * @example
 * \`\`\`typescript
 * const result = tsdocFunc('test');
 * \`\`\`
 * @since 1.0.0
 * @public
 */
export function tsdocFunc(param: string): string { return param; }
`;

      const inlineFile = `
// Simple inline comment
export function inlineFunc(): string { return 'inline'; }
`;

      const markdownFile = `
/*
 * # Markdown Documentation
 *
 * This function uses **markdown** formatting.
 *
 * ## Usage
 *
 * \`\`\`javascript
 * const result = markdownFunc();
 * \`\`\`
 *
 * [More info](https://example.com)
 */
export function markdownFunc(): string { return 'markdown'; }
`;

      await fs.writeFile(join(srcDir, 'jsdoc.ts'), jsdocFile);
      await fs.writeFile(join(srcDir, 'tsdoc.ts'), tsdocFile);
      await fs.writeFile(join(srcDir, 'inline.ts'), inlineFile);
      await fs.writeFile(join(srcDir, 'markdown.ts'), markdownFile);

      const result = await analyzer.analyze(tempTestDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();

      // Should detect mixed or dominant TSDoc style
      expect(['tsdoc', 'mixed', 'jsdoc']).toContain(result.documentation.style);
      expect(result.documentation.coverage).toBeGreaterThan(75);
    });
  });

  describe('Schema Compliance Edge Cases', () => {
    it('should never return undefined for required fields', async () => {
      // Test with minimal project
      const result = await analyzer.analyze(tempTestDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();

      // Required fields must never be undefined
      expect(result.fileNaming).toBeDefined();
      expect(result.functionNaming).toBeDefined();
      expect(result.variableNaming).toBeDefined();
      expect(result.indentation).toBeDefined();
      expect(result.indentation.type).toBeDefined();
      expect(result.imports).toBeDefined();
      expect(result.imports.style).toBeDefined();
      expect(result.documentation).toBeDefined();
      expect(result.documentation.style).toBeDefined();
      expect(result.documentation.coverage).toBeDefined();

      // Values must be valid enum values
      expect(['camelCase', 'PascalCase', 'kebab-case', 'snake_case', 'mixed', 'inconsistent']).toContain(result.fileNaming);
      expect(['camelCase', 'PascalCase', 'snake_case', 'mixed', 'inconsistent']).toContain(result.functionNaming);
      expect(['camelCase', 'PascalCase', 'snake_case', 'SCREAMING_SNAKE_CASE', 'mixed', 'inconsistent']).toContain(result.variableNaming);
      expect(['spaces', 'tabs', 'mixed']).toContain(result.indentation.type);
      expect(['es6', 'commonjs', 'amd', 'umd', 'mixed']).toContain(result.imports.style);
      expect(['jsdoc', 'tsdoc', 'inline', 'markdown', 'none', 'mixed']).toContain(result.documentation.style);
    });

    it('should handle all possible enum combinations', async () => {
      const srcDir = join(tempTestDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      // Create files that test various enum combinations
      const enumTestFiles = [
        {
          name: 'kebab-case-file.ts',
          content: `
// Test kebab-case file naming
export function test() { return 'kebab'; }
`
        },
        {
          name: 'PascalCaseFile.ts',
          content: `
// Test PascalCase file naming
export function TestPascal() { return 'pascal'; }
`
        },
        {
          name: 'snake_case_file.py',
          content: `
def snake_function():
    """Test snake_case function."""
    return 'snake'

SCREAMING_CONSTANT = 'CONSTANT'
`
        },
        {
          name: 'amd.js',
          content: `
define(['dependency'], function(dep) {
  return {
    amdFunction: function() { return 'amd'; }
  };
});
`
        },
        {
          name: 'umd.js',
          content: `
(function (root, factory) {
  if (typeof exports === 'object') {
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    define(factory);
  } else {
    root.myModule = factory();
  }
}(this, function () {
  return {
    umdFunction: function() { return 'umd'; }
  };
}));
`
        }
      ];

      for (const file of enumTestFiles) {
        await fs.writeFile(join(srcDir, file.name), file.content);
      }

      const result = await analyzer.analyze(tempTestDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();

      // Should handle all the different enum values gracefully
      expect(['camelCase', 'PascalCase', 'kebab-case', 'snake_case', 'mixed', 'inconsistent']).toContain(result.fileNaming);
      expect(['es6', 'commonjs', 'amd', 'umd', 'mixed']).toContain(result.imports.style);
    });
  });
});