/**
 * ConventionAnalyzer Tests
 * Tests for documentation style detection and coverage calculation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConventionAnalyzer } from '../convention-analyzer.js';
import { ConventionAnalysisSchema } from '@apexcli/core';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('ConventionAnalyzer', () => {
  let analyzer: ConventionAnalyzer;
  let testDir: string;

  beforeEach(async () => {
    analyzer = new ConventionAnalyzer();
    // Create unique test directory
    testDir = join(tmpdir(), `convention-test-${Date.now()}-${Math.random().toString(36).substring(7)}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Cleanup test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Documentation Style Detection', () => {
    it('should detect JSDoc style documentation', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const jsdocCode = `
/**
 * Calculates the sum of two numbers
 * @param {number} a - First number
 * @param {number} b - Second number
 * @returns {number} The sum of a and b
 */
function add(a, b) {
  return a + b;
}

/**
 * User class for managing user data
 */
class User {
  constructor(name) {
    this.name = name;
  }
}
`;

      await fs.writeFile(join(srcDir, 'math.js'), jsdocCode);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.documentation.style).toBe('jsdoc');
      expect(result.documentation.coverage).toBeGreaterThan(50);
    });

    it('should detect TSDoc style documentation', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const tsdocCode = `
/**
 * Calculates the sum of two numbers
 * @param a - First number
 * @param b - Second number
 * @returns The sum of a and b
 * @example
 * \`\`\`typescript
 * const result = add(5, 3); // returns 8
 * \`\`\`
 * @since 1.0.0
 * @beta
 */
function add(a: number, b: number): number {
  return a + b;
}

/**
 * User interface for type definitions
 * @public
 * @readonly
 */
interface User {
  name: string;
  age: number;
}
`;

      await fs.writeFile(join(srcDir, 'math.ts'), tsdocCode);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.documentation.style).toBe('tsdoc');
      expect(result.documentation.coverage).toBeGreaterThan(50);
    });

    it('should detect inline comment style documentation', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const inlineCode = `
// Calculates the sum of two numbers
// Takes two parameters and returns their sum
function add(a, b) {
  return a + b;
}

// User class for managing user data
// Stores user information and provides methods
class User {
  constructor(name) {
    this.name = name;
  }
}
`;

      await fs.writeFile(join(srcDir, 'math.js'), inlineCode);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.documentation.style).toBe('inline');
      expect(result.documentation.coverage).toBeGreaterThan(0);
    });

    it('should detect markdown style documentation', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const markdownCode = `
/*
 * # Math Utilities
 *
 * This module provides basic mathematical operations.
 *
 * ## Functions
 *
 * ### add(a, b)
 *
 * Calculates the sum of two numbers.
 *
 * **Parameters:**
 * - \`a\` (number): First number
 * - \`b\` (number): Second number
 *
 * **Returns:** number - The sum of a and b
 *
 * **Example:**
 * \`\`\`javascript
 * const result = add(5, 3);
 * console.log(result); // 8
 * \`\`\`
 */
function add(a, b) {
  return a + b;
}

/*
 * ## Classes
 *
 * ### User
 *
 * Represents a user with basic information.
 *
 * [More info](https://example.com/user-docs)
 */
class User {
  constructor(name) {
    this.name = name;
  }
}
`;

      await fs.writeFile(join(srcDir, 'math.js'), markdownCode);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.documentation.style).toBe('markdown');
    });

    it('should detect mixed documentation styles', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const mixedCode1 = `
/**
 * JSDoc documented function
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
function add(a, b) {
  return a + b;
}
`;

      const mixedCode2 = `
// Inline documented function
// This function multiplies two numbers
function multiply(a, b) {
  return a * b;
}
`;

      await fs.writeFile(join(srcDir, 'math1.js'), mixedCode1);
      await fs.writeFile(join(srcDir, 'math2.js'), mixedCode2);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(['mixed', 'jsdoc', 'inline']).toContain(result.documentation.style);
    });

    it('should detect no documentation', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const undocumentedCode = `
function add(a, b) {
  return a + b;
}

class User {
  constructor(name) {
    this.name = name;
  }
}

const PI = 3.14159;

interface Config {
  apiUrl: string;
  timeout: number;
}
`;

      await fs.writeFile(join(srcDir, 'undocumented.ts'), undocumentedCode);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.documentation.style).toBe('none');
      expect(result.documentation.coverage).toBe(0);
    });
  });

  describe('Documentation Coverage Calculation', () => {
    it('should calculate accurate coverage for partially documented code', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const partiallyDocumentedCode = `
/**
 * Documented function
 */
function documented() {
  return 'documented';
}

function undocumented1() {
  return 'undocumented';
}

/**
 * Another documented function
 */
function documented2() {
  return 'documented2';
}

function undocumented2() {
  return 'undocumented';
}
`;

      await fs.writeFile(join(srcDir, 'partial.js'), partiallyDocumentedCode);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.documentation.coverage).toBe(50); // 2 out of 4 functions documented
    });

    it('should handle 100% documentation coverage', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const fullyDocumentedCode = `
/**
 * First documented function
 */
function func1() {
  return 1;
}

/**
 * Second documented function
 */
function func2() {
  return 2;
}

/**
 * Documented class
 */
class DocumentedClass {
  constructor() {}
}
`;

      await fs.writeFile(join(srcDir, 'full.js'), fullyDocumentedCode);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.documentation.coverage).toBe(100);
    });

    it('should handle edge cases for coverage calculation', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      // File with no documentable elements
      await fs.writeFile(join(srcDir, 'constants.js'), `
const PI = 3.14159;
const E = 2.71828;
`);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.documentation.coverage).toBe(0);
    });
  });

  describe('Schema Compliance', () => {
    it('should return valid ConventionAnalysis schema for any input', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      // Create a complex mixed file
      const complexCode = `
/**
 * @param {string} name
 * @returns {User}
 * @example
 * const user = createUser('John');
 */
export function createUser(name) {
  return new User(name);
}

// Simple utility function
function utils() {}

/*
 * # Markdown Documentation
 *
 * This is a [link](https://example.com)
 *
 * \`\`\`javascript
 * console.log('code block');
 * \`\`\`
 */
class DocumentedClass {}

class UndocumentedClass {}

/**
 * TypeScript interface
 * @since 1.0.0
 * @public
 */
interface Config {
  api: string;
}

type UserType = string | number;
`;

      await fs.writeFile(join(srcDir, 'complex.ts'), complexCode);

      const result = await analyzer.analyze(testDir);

      // This should not throw
      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();

      // Validate all required fields are present
      expect(result).toHaveProperty('documentation');
      expect(result.documentation).toHaveProperty('style');
      expect(result.documentation).toHaveProperty('coverage');

      // Validate style is one of the allowed values
      expect(['jsdoc', 'tsdoc', 'inline', 'markdown', 'none', 'mixed']).toContain(result.documentation.style);

      // Validate coverage is a number between 0 and 100
      expect(result.documentation.coverage).toBeGreaterThanOrEqual(0);
      expect(result.documentation.coverage).toBeLessThanOrEqual(100);
      expect(Number.isInteger(result.documentation.coverage)).toBe(true);
    });
  });

  describe('File Organization Pattern Detection', () => {
    describe('Test File Location Patterns', () => {
      it('should detect colocated test files', async () => {
        const srcDir = join(testDir, 'src');
        await fs.mkdir(srcDir, { recursive: true });

        // Create source file and colocated test
        await fs.writeFile(join(srcDir, 'utils.js'), 'export function add() {}');
        await fs.writeFile(join(srcDir, 'utils.test.js'), 'import { add } from "./utils"; test("add", () => {});');
        await fs.writeFile(join(srcDir, 'auth.ts'), 'export class Auth {}');
        await fs.writeFile(join(srcDir, 'auth.spec.ts'), 'import { Auth } from "./auth"; describe("Auth", () => {});');

        const result = await analyzer.analyze(testDir);

        expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
        expect(result.organization?.testLocation).toBe('colocated');
      });

      it('should detect separate __tests__ directories', async () => {
        const srcDir = join(testDir, 'src');
        const testsDir = join(srcDir, '__tests__');
        await fs.mkdir(srcDir, { recursive: true });
        await fs.mkdir(testsDir, { recursive: true });

        // Create source files and separate test directory
        await fs.writeFile(join(srcDir, 'utils.js'), 'export function add() {}');
        await fs.writeFile(join(srcDir, 'auth.js'), 'export class Auth {}');
        await fs.writeFile(join(testsDir, 'utils.test.js'), 'test("utils", () => {});');
        await fs.writeFile(join(testsDir, 'auth.test.js'), 'test("auth", () => {});');
        await fs.writeFile(join(testsDir, 'integration.test.js'), 'test("integration", () => {});');

        const result = await analyzer.analyze(testDir);

        expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
        expect(result.organization?.testLocation).toBe('separate-__tests__');
      });

      it('should detect separate tests directories', async () => {
        const srcDir = join(testDir, 'src');
        const testsDir = join(testDir, 'tests');
        await fs.mkdir(srcDir, { recursive: true });
        await fs.mkdir(testsDir, { recursive: true });

        // Create source files and separate test directory
        await fs.writeFile(join(srcDir, 'utils.js'), 'export function add() {}');
        await fs.writeFile(join(srcDir, 'auth.js'), 'export class Auth {}');
        await fs.writeFile(join(testsDir, 'utils.test.js'), 'test("utils", () => {});');
        await fs.writeFile(join(testsDir, 'auth.test.js'), 'test("auth", () => {});');

        const result = await analyzer.analyze(testDir);

        expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
        expect(result.organization?.testLocation).toBe('separate-tests');
      });

      it('should detect mixed test location patterns', async () => {
        const srcDir = join(testDir, 'src');
        const testsDir = join(srcDir, '__tests__');
        await fs.mkdir(srcDir, { recursive: true });
        await fs.mkdir(testsDir, { recursive: true });

        // Create mixed patterns
        await fs.writeFile(join(srcDir, 'utils.js'), 'export function add() {}');
        await fs.writeFile(join(srcDir, 'utils.test.js'), 'test("utils colocated", () => {});'); // Colocated
        await fs.writeFile(join(testsDir, 'auth.test.js'), 'test("auth separate", () => {});'); // Separate

        const result = await analyzer.analyze(testDir);

        expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
        expect(result.organization?.testLocation).toBe('mixed');
      });
    });

    describe('Test File Naming Patterns', () => {
      it('should detect .test suffix naming convention', async () => {
        const srcDir = join(testDir, 'src');
        await fs.mkdir(srcDir, { recursive: true });

        await fs.writeFile(join(srcDir, 'utils.test.js'), 'test("utils", () => {});');
        await fs.writeFile(join(srcDir, 'auth.test.ts'), 'test("auth", () => {});');
        await fs.writeFile(join(srcDir, 'api.test.jsx'), 'test("api", () => {});');

        const result = await analyzer.analyze(testDir);

        expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
        expect(result.organization?.testNaming).toBe('suffix-.test');
      });

      it('should detect .spec suffix naming convention', async () => {
        const srcDir = join(testDir, 'src');
        await fs.mkdir(srcDir, { recursive: true });

        await fs.writeFile(join(srcDir, 'utils.spec.js'), 'describe("utils", () => {});');
        await fs.writeFile(join(srcDir, 'auth.spec.ts'), 'describe("auth", () => {});');
        await fs.writeFile(join(srcDir, 'api.spec.tsx'), 'describe("api", () => {});');

        const result = await analyzer.analyze(testDir);

        expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
        expect(result.organization?.testNaming).toBe('suffix-.spec');
      });

      it('should detect Test suffix naming convention', async () => {
        const srcDir = join(testDir, 'src');
        await fs.mkdir(srcDir, { recursive: true });

        await fs.writeFile(join(srcDir, 'UtilsTest.java'), 'public class UtilsTest {}');
        await fs.writeFile(join(srcDir, 'AuthTest.kt'), 'class AuthTest');
        await fs.writeFile(join(srcDir, 'ApiTest.cs'), 'public class ApiTest {}');

        const result = await analyzer.analyze(testDir);

        expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
        expect(result.organization?.testNaming).toBe('suffix-Test');
      });

      it('should detect test- prefix naming convention', async () => {
        const srcDir = join(testDir, 'src');
        await fs.mkdir(srcDir, { recursive: true });

        await fs.writeFile(join(srcDir, 'test-utils.js'), 'test("utils", () => {});');
        await fs.writeFile(join(srcDir, 'test_auth.py'), 'def test_auth(): pass');
        await fs.writeFile(join(srcDir, 'Test-api.rb'), 'describe "api" do; end');

        const result = await analyzer.analyze(testDir);

        expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
        expect(result.organization?.testNaming).toBe('prefix-test-');
      });

      it('should detect mixed test naming conventions', async () => {
        const srcDir = join(testDir, 'src');
        await fs.mkdir(srcDir, { recursive: true });

        await fs.writeFile(join(srcDir, 'utils.test.js'), 'test("utils", () => {});');
        await fs.writeFile(join(srcDir, 'auth.spec.ts'), 'describe("auth", () => {});');
        await fs.writeFile(join(srcDir, 'ApiTest.java'), 'public class ApiTest {}');

        const result = await analyzer.analyze(testDir);

        expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
        expect(result.organization?.testNaming).toBe('mixed');
      });
    });

    describe('Source Directory Structure Patterns', () => {
      it('should detect src directory structure', async () => {
        const srcDir = join(testDir, 'src');
        await fs.mkdir(srcDir, { recursive: true });

        await fs.writeFile(join(srcDir, 'index.js'), 'export * from "./utils";');
        await fs.writeFile(join(srcDir, 'utils.js'), 'export function add() {}');
        await fs.writeFile(join(srcDir, 'components', 'Button.jsx'), 'export const Button = () => {};');
        await fs.mkdir(join(srcDir, 'components'), { recursive: true });
        await fs.writeFile(join(srcDir, 'components', 'Button.jsx'), 'export const Button = () => {};');

        const result = await analyzer.analyze(testDir);

        expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
        expect(result.organization?.sourceStructure).toBe('src');
      });

      it('should detect lib directory structure', async () => {
        const libDir = join(testDir, 'lib');
        await fs.mkdir(libDir, { recursive: true });

        await fs.writeFile(join(libDir, 'index.js'), 'export * from "./utils";');
        await fs.writeFile(join(libDir, 'utils.js'), 'export function add() {}');
        await fs.writeFile(join(libDir, 'helpers', 'format.js'), 'export function format() {}');
        await fs.mkdir(join(libDir, 'helpers'), { recursive: true });
        await fs.writeFile(join(libDir, 'helpers', 'format.js'), 'export function format() {}');

        const result = await analyzer.analyze(testDir);

        expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
        expect(result.organization?.sourceStructure).toBe('lib');
      });

      it('should detect app directory structure', async () => {
        const appDir = join(testDir, 'app');
        await fs.mkdir(appDir, { recursive: true });

        await fs.writeFile(join(appDir, 'page.tsx'), 'export default function Page() {}');
        await fs.writeFile(join(appDir, 'layout.tsx'), 'export default function Layout() {}');
        await fs.writeFile(join(appDir, 'api', 'route.ts'), 'export function GET() {}');
        await fs.mkdir(join(appDir, 'api'), { recursive: true });
        await fs.writeFile(join(appDir, 'api', 'route.ts'), 'export function GET() {}');

        const result = await analyzer.analyze(testDir);

        expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
        expect(result.organization?.sourceStructure).toBe('app');
      });

      it('should detect root-level structure', async () => {
        await fs.writeFile(join(testDir, 'index.js'), 'console.log("main");');
        await fs.writeFile(join(testDir, 'utils.js'), 'export function add() {}');
        await fs.writeFile(join(testDir, 'config.js'), 'export const config = {};');

        const result = await analyzer.analyze(testDir);

        expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
        expect(result.organization?.sourceStructure).toBe('root-level');
      });

      it('should detect mixed directory structures', async () => {
        const srcDir = join(testDir, 'src');
        const libDir = join(testDir, 'lib');
        await fs.mkdir(srcDir, { recursive: true });
        await fs.mkdir(libDir, { recursive: true });

        await fs.writeFile(join(srcDir, 'main.js'), 'console.log("src");');
        await fs.writeFile(join(libDir, 'utils.js'), 'export function add() {}');
        await fs.writeFile(join(testDir, 'index.js'), 'console.log("root");');

        const result = await analyzer.analyze(testDir);

        expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
        expect(result.organization?.sourceStructure).toBe('mixed');
      });
    });

    describe('Configuration File Location Patterns', () => {
      it('should detect root configuration files', async () => {
        await fs.writeFile(join(testDir, 'package.json'), '{"name": "test"}');
        await fs.writeFile(join(testDir, 'tsconfig.json'), '{"compilerOptions": {}}');
        await fs.writeFile(join(testDir, '.eslintrc.js'), 'module.exports = {};');
        await fs.writeFile(join(testDir, 'jest.config.js'), 'module.exports = {};');

        const result = await analyzer.analyze(testDir);

        expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
        expect(result.organization?.configLocation).toBe('root');
      });

      it('should detect config directory structure', async () => {
        const configDir = join(testDir, 'config');
        await fs.mkdir(configDir, { recursive: true });

        await fs.writeFile(join(configDir, 'jest.config.js'), 'module.exports = {};');
        await fs.writeFile(join(configDir, 'webpack.config.js'), 'module.exports = {};');
        await fs.writeFile(join(configDir, 'babel.config.js'), 'module.exports = {};');

        const result = await analyzer.analyze(testDir);

        expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
        expect(result.organization?.configLocation).toBe('config-dir');
      });

      it('should detect mixed configuration file locations', async () => {
        const configDir = join(testDir, 'config');
        await fs.mkdir(configDir, { recursive: true });

        // Root configs
        await fs.writeFile(join(testDir, 'package.json'), '{"name": "test"}');
        await fs.writeFile(join(testDir, 'tsconfig.json'), '{"compilerOptions": {}}');

        // Config dir
        await fs.writeFile(join(configDir, 'jest.config.js'), 'module.exports = {};');
        await fs.writeFile(join(configDir, 'webpack.config.js'), 'module.exports = {};');

        const result = await analyzer.analyze(testDir);

        expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
        expect(result.organization?.configLocation).toBe('mixed');
      });

      it('should handle no configuration files', async () => {
        const srcDir = join(testDir, 'src');
        await fs.mkdir(srcDir, { recursive: true });
        await fs.writeFile(join(srcDir, 'index.js'), 'console.log("hello");');

        const result = await analyzer.analyze(testDir);

        expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
        expect(result.organization?.configLocation).toBeUndefined();
      });
    });

    describe('Empty Project Handling', () => {
      it('should handle projects with no test files', async () => {
        const srcDir = join(testDir, 'src');
        await fs.mkdir(srcDir, { recursive: true });
        await fs.writeFile(join(srcDir, 'index.js'), 'console.log("no tests");');
        await fs.writeFile(join(srcDir, 'utils.js'), 'export function add() {}');

        const result = await analyzer.analyze(testDir);

        expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
        expect(result.organization?.testLocation).toBe('mixed');
        expect(result.organization?.testNaming).toBe('mixed');
        expect(result.organization?.sourceStructure).toBe('src');
      });

      it('should handle completely empty project', async () => {
        const result = await analyzer.analyze(testDir);

        expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
        expect(result.organization?.testLocation).toBe('mixed');
        expect(result.organization?.testNaming).toBe('mixed');
        expect(result.organization?.sourceStructure).toBe('mixed');
      });
    });
  });

  describe('Integration with Other Convention Analysis', () => {
    it('should return complete ConventionAnalysis with all fields including organization', async () => {
      const srcDir = join(testDir, 'src');
      const testsDir = join(srcDir, '__tests__');
      await fs.mkdir(srcDir, { recursive: true });
      await fs.mkdir(testsDir, { recursive: true });

      const basicCode = `
/**
 * Simple function
 */
function simpleFunction() {
  const variableName = 'camelCase';
  return variableName;
}
`;

      await fs.writeFile(join(srcDir, 'simple.js'), basicCode);
      await fs.writeFile(join(testsDir, 'simple.test.js'), 'test("simple", () => {});');
      await fs.writeFile(join(testDir, 'package.json'), '{"name": "test"}');

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();

      // Verify all top-level fields exist
      expect(result).toHaveProperty('fileNaming');
      expect(result).toHaveProperty('functionNaming');
      expect(result).toHaveProperty('variableNaming');
      expect(result).toHaveProperty('indentation');
      expect(result).toHaveProperty('imports');
      expect(result).toHaveProperty('documentation');
      expect(result).toHaveProperty('organization');

      // Verify organization field structure
      expect(result.organization).toHaveProperty('testLocation');
      expect(result.organization).toHaveProperty('testNaming');
      expect(result.organization).toHaveProperty('sourceStructure');
      expect(result.organization).toHaveProperty('configLocation');

      expect(result.organization?.testLocation).toBe('separate-__tests__');
      expect(result.organization?.testNaming).toBe('suffix-.test');
      expect(result.organization?.sourceStructure).toBe('src');
      expect(result.organization?.configLocation).toBe('root');
    });
  });

  describe('Import Grouping Pattern Detection', () => {
    it('should detect type-separate import grouping', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const typeSeparateCode = `
import type { User, Product } from './types.js';
import type { APIResponse } from '../api/types.js';

import { userService } from './services/userService.js';
import { productService } from './services/productService.js';
import { validateInput } from './utils/validation.js';

export class UserController {
  async getUser(id: string): Promise<User> {
    return await userService.getUserById(id);
  }
}
`;

      await fs.writeFile(join(srcDir, 'userController.ts'), typeSeparateCode);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.imports.style).toBe('es6');
      expect(result.imports.grouping).toBe('type-separate');
    });

    it('should detect source-separate import grouping', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const sourceSeparateCode = `
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import { userService } from './services/userService.js';
import { authMiddleware } from './middleware/auth.js';
import { validateInput } from '../utils/validation.js';

const app = express();
app.use(cors());
`;

      await fs.writeFile(join(srcDir, 'server.ts'), sourceSeparateCode);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.imports.style).toBe('es6');
      expect(result.imports.grouping).toBe('source-separate');
    });

    it('should detect alphabetical import ordering', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const alphabeticalCode = `
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

import { authMiddleware } from './middleware/auth.js';
import { userService } from './services/userService.js';
import { validateInput } from './utils/validation.js';

const app = express();
`;

      await fs.writeFile(join(srcDir, 'alphabetical.ts'), alphabeticalCode);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.imports.style).toBe('es6');
      expect(result.imports.grouping).toBe('alphabetical');
    });

    it('should detect custom import grouping with blank line separators', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const customGroupingCode = `
import express from 'express';
import cors from 'cors';

import { userService } from './services/userService.js';

import { validateInput } from './utils/validation.js';
import { logger } from './utils/logger.js';

const app = express();
`;

      await fs.writeFile(join(srcDir, 'custom.ts'), customGroupingCode);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.imports.style).toBe('es6');
      expect(result.imports.grouping).toBe('custom');
    });

    it('should detect no grouping pattern for unorganized imports', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const noGroupingCode = `
import { userService } from './services/userService.js';
import express from 'express';
import { validateInput } from './utils/validation.js';
import cors from 'cors';

const app = express();
`;

      await fs.writeFile(join(srcDir, 'noGrouping.ts'), noGroupingCode);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.imports.style).toBe('es6');
      expect(result.imports.grouping).toBe('none');
    });

    it('should handle files with single imports (no grouping applicable)', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const singleImportCode = `
import express from 'express';

const app = express();
`;

      await fs.writeFile(join(srcDir, 'single.ts'), singleImportCode);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.imports.style).toBe('es6');
      expect(result.imports.grouping).toBeUndefined();
    });

    it('should detect mixed imports with CommonJS and ES6', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const mixedImportCode = `
const express = require('express');
import cors from 'cors';
const fs = require('fs');
import { userService } from './services/userService.js';

const app = express();
`;

      await fs.writeFile(join(srcDir, 'mixed.js'), mixedImportCode);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.imports.style).toBe('mixed');
      expect(result.imports.grouping).toBe('none'); // Mixed styles typically don't follow grouping patterns
    });

    it('should detect AMD import style', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const amdCode = `
define(['jquery', 'underscore'], function($, _) {
  // Module content
  return {
    initialize: function() {
      console.log('AMD module initialized');
    }
  };
});

define(function() {
  return 'simple module';
});
`;

      await fs.writeFile(join(srcDir, 'amd.js'), amdCode);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.imports.style).toBe('amd');
    });

    it('should detect UMD import style', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const umdCode = `
(function (root, factory) {
  if (typeof exports === 'object' && typeof module !== 'undefined') {
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else {
    root.myModule = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  return {
    hello: function() {
      return 'Hello from UMD module';
    }
  };
}));
`;

      await fs.writeFile(join(srcDir, 'umd.js'), umdCode);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.imports.style).toBe('umd');
    });

    it('should validate all import grouping enum values are handled', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      // Create a minimal file to get some result
      await fs.writeFile(join(srcDir, 'test.js'), 'console.log("hello");');

      const result = await analyzer.analyze(testDir);

      // If grouping is defined, it should be one of the valid enum values
      if (result.imports.grouping !== undefined) {
        expect(['none', 'type-separate', 'source-separate', 'alphabetical', 'custom']).toContain(result.imports.grouping);
      }
    });
  });

  describe('Documentation Edge Cases and Complex Scenarios', () => {
    describe('Complex Documentation Detection', () => {
      it('should correctly handle multi-line JSDoc with complex formatting', async () => {
        const srcDir = join(testDir, 'src');
        await fs.mkdir(srcDir, { recursive: true });

        const complexJsdocCode = `
/**
 * Complex function with detailed JSDoc
 * This is a multi-paragraph description.
 *
 * It includes various formatting elements and edge cases.
 *
 * @param {string|number} input - Can be string or number
 * @param {Object} options - Configuration object
 * @param {boolean} [options.strict=false] - Enable strict mode
 * @param {Array<string>} [options.filters=[]] - Array of filter strings
 * @returns {Promise<Array<Object>>} Promise resolving to array of results
 * @throws {ValidationError} When input is invalid
 * @throws {NetworkError} When network request fails
 * @example
 * // Basic usage
 * const result = await processData('test', { strict: true });
 *
 * @example
 * // With filters
 * const filtered = await processData(123, {
 *   filters: ['active', 'verified']
 * });
 *
 * @since 1.2.0
 * @deprecated Use processDataV2 instead
 * @see {@link processDataV2} for the new implementation
 */
async function processData(input, options = {}) {
  return Promise.resolve([]);
}

/**
 * Undocumented helper function
 */
function helperFunction() {}

function undocumentedFunction() {
  // This function has no documentation
  return 'no docs';
}

/**
 * Simple documented class
 * @class
 */
class DocumentedClass {
  /**
   * Constructor with documentation
   * @param {string} name - The name
   */
  constructor(name) {
    this.name = name;
  }

  undocumentedMethod() {
    return this.name;
  }
}

class UndocumentedClass {
  constructor() {}

  someMethod() {}
}
`;

        await fs.writeFile(join(srcDir, 'complex.js'), complexJsdocCode);
        const result = await analyzer.analyze(testDir);

        expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
        expect(result.documentation.style).toBe('jsdoc');
        expect(result.documentation.coverage).toBeGreaterThan(50);
        expect(result.documentation.coverage).toBeLessThan(100);
      });

      it('should properly distinguish TSDoc from regular JSDoc', async () => {
        const srcDir = join(testDir, 'src');
        await fs.mkdir(srcDir, { recursive: true });

        const tsdocSpecificCode = `
/**
 * Function with TSDoc-specific features
 * @param input - Input parameter (no type in TSDoc style)
 * @returns The processed result
 * @beta This is a beta feature
 * @internal For internal use only
 * @sealed This class cannot be extended
 * @virtual This method can be overridden
 * @override This method overrides a parent method
 * @readonly This property is read-only
 * @eventProperty Fired when data changes
 * @defaultValue \`null\`
 * @remarks
 * This is a remarks section with additional details.
 * It can span multiple lines.
 */
function tsdocFunction(input: string): string {
  return input;
}

/**
 * Regular JSDoc function for comparison
 * @param {string} input - Input with JSDoc type syntax
 * @returns {string} Return value with JSDoc type syntax
 */
function jsdocFunction(input: string): string {
  return input;
}

/**
 * Interface with TSDoc features
 * @public This is a public interface
 * @since 2.0.0
 */
interface TSDocInterface {
  /** @readonly */
  readonly name: string;

  /** @beta This property is in beta */
  betaProperty?: number;
}
`;

        await fs.writeFile(join(srcDir, 'tsdoc-specific.ts'), tsdocSpecificCode);
        const result = await analyzer.analyze(testDir);

        expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
        expect(result.documentation.style).toBe('tsdoc');
        expect(result.documentation.coverage).toBe(100);
      });

      it('should handle inline comments with varying quality and length', async () => {
        const srcDir = join(testDir, 'src');
        await fs.mkdir(srcDir, { recursive: true });

        const inlineVariationsCode = `
// Short comment
function shortDoc() {}

// This is a longer inline comment that provides more detail
// It spans multiple lines and gives substantial information
// about what the function does and how to use it
function wellDocumentedInline() {}

// TODO: implement this
function todoComment() {}

// FIXME: broken implementation
function fixmeComment() {}

// NOTE: special handling required
function noteComment() {}

/// Triple slash comment (C# style)
function tripleSlash() {}

//! Rust-style important comment
function rustStyle() {}

// Brief
function briefInline() {}

function noComment() {}

//
function emptyComment() {}

//
// Multi-line inline comment block
// with several lines of documentation
// explaining the complex logic below
//
function blockInlineComment() {}
`;

        await fs.writeFile(join(srcDir, 'inline-variations.js'), inlineVariationsCode);
        const result = await analyzer.analyze(testDir);

        expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
        expect(result.documentation.style).toBe('inline');
        expect(result.documentation.coverage).toBeGreaterThan(70);
      });

      it('should detect markdown-style documentation accurately', async () => {
        const srcDir = join(testDir, 'src');
        await fs.mkdir(srcDir, { recursive: true });

        const markdownDocsCode = `
/*
 * # Advanced Math Module
 *
 * This module provides advanced mathematical operations with markdown documentation.
 *
 * ## Features
 *
 * - **Complex calculations**: Support for complex number operations
 * - **Performance optimized**: Uses efficient algorithms
 * - **Type safe**: Full TypeScript support
 *
 * ## Usage
 *
 * \`\`\`typescript
 * import { calculate, MathOptions } from './math';
 *
 * const result = calculate(42, {
 *   precision: 'high',
 *   mode: 'safe'
 * });
 * \`\`\`
 *
 * ### Error Handling
 *
 * The module throws specific errors:
 *
 * | Error Type | Cause | Solution |
 * |-----------|--------|----------|
 * | ValidationError | Invalid input | Check input types |
 * | RangeError | Value out of bounds | Use valid range |
 *
 * > **Warning**: This is a performance-critical module
 *
 * [Documentation](https://example.com/math-docs)
 */
function calculate(value, options) {
  return value * 2;
}

/*
 * ## Helper Functions
 *
 * ### validateInput(input)
 *
 * Validates input parameters using **strict mode**.
 *
 * #### Parameters:
 * - \`input\` (*any*): The value to validate
 *
 * #### Returns:
 * - \`boolean\`: True if valid
 *
 * #### Example:
 * \`\`\`js
 * if (validateInput(userInput)) {
 *   // Process input
 * }
 * \`\`\`
 */
function validateInput(input) {
  return typeof input === 'number';
}

function undocumented() {
  return false;
}
`;

        await fs.writeFile(join(srcDir, 'markdown-docs.js'), markdownDocsCode);
        const result = await analyzer.analyze(testDir);

        expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
        expect(result.documentation.style).toBe('markdown');
        expect(result.documentation.coverage).toBeGreaterThan(60);
      });
    });

    describe('Coverage Calculation Edge Cases', () => {
      it('should handle export declarations correctly', async () => {
        const srcDir = join(testDir, 'src');
        await fs.mkdir(srcDir, { recursive: true });

        const exportsCode = `
/**
 * Documented named export function
 */
export function namedExportFunc() {}

export function undocumentedNamedExport() {}

/**
 * Documented default export
 */
export default function defaultExportFunc() {}

/**
 * Documented export class
 */
export class ExportedClass {}

export class UndocumentedExportClass {}

/**
 * Documented export interface
 */
export interface ExportedInterface {
  prop: string;
}

export interface UndocumentedExportInterface {
  prop: number;
}

/**
 * Documented export type
 */
export type ExportedType = string | number;

export type UndocumentedExportType = boolean;

/**
 * Documented export const
 */
export const exportedConst = 42;

export const undocumentedExportConst = 'test';

// Internal function not exported
function internalFunction() {}
`;

        await fs.writeFile(join(srcDir, 'exports.ts'), exportsCode);
        const result = await analyzer.analyze(testDir);

        expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
        // Should count exports as documentable elements
        expect(result.documentation.coverage).toBeGreaterThan(40);
        expect(result.documentation.coverage).toBeLessThan(70);
      });

      it('should handle nested and complex structures', async () => {
        const srcDir = join(testDir, 'src');
        await fs.mkdir(srcDir, { recursive: true });

        const nestedCode = `
/**
 * Outer namespace with documentation
 */
namespace OuterNamespace {
  /**
   * Inner function
   */
  function innerFunction() {}

  function undocumentedInner() {}

  /**
   * Inner class
   */
  class InnerClass {
    /**
     * Documented method
     */
    method1() {}

    method2() {} // Undocumented
  }

  /**
   * Inner interface
   */
  interface InnerInterface {
    prop: string;
  }
}

/**
 * Module with mixed documentation
 */
module TestModule {
  /**
   * Module function
   */
  export function moduleFunc() {}

  export function undocumentedModuleFunc() {}
}

/**
 * Generic function with constraints
 */
function genericFunction<T extends string>(param: T): T {
  return param;
}

function undocumentedGeneric<T>(param: T): T {
  return param;
}

/**
 * Function with function parameter
 */
function higherOrder(callback: () => void): void {
  callback();
}

// Arrow function assigned to const
const arrowFunc = () => {};

/**
 * Documented arrow function
 */
const documentedArrow = (x: number) => x * 2;
`;

        await fs.writeFile(join(srcDir, 'nested.ts'), nestedCode);
        const result = await analyzer.analyze(testDir);

        expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
        expect(result.documentation.coverage).toBeGreaterThan(30);
        expect(result.documentation.coverage).toBeLessThanOrEqual(100);
      });

      it('should handle files with only non-documentable elements', async () => {
        const srcDir = join(testDir, 'src');
        await fs.mkdir(srcDir, { recursive: true });

        const nonDocumentableCode = `
// Configuration constants
const API_URL = 'https://api.example.com';
const TIMEOUT = 5000;
const MAX_RETRIES = 3;

// Simple variable assignments
let currentUser = null;
let isAuthenticated = false;

// Object literals
const config = {
  debug: true,
  version: '1.0.0',
  features: {
    darkMode: true,
    notifications: false
  }
};

// Array definitions
const supportedFormats = ['json', 'xml', 'yaml'];
const errorCodes = [400, 401, 403, 404, 500];

// Regular expressions
const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
const phoneRegex = /^\\+?[1-9]\\d{1,14}$/;

// Immediate execution
console.log('Module loaded');

if (config.debug) {
  console.log('Debug mode enabled');
}
`;

        await fs.writeFile(join(srcDir, 'constants.js'), nonDocumentableCode);
        const result = await analyzer.analyze(testDir);

        expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
        expect(result.documentation.coverage).toBe(0);
        expect(result.documentation.style).toBe('none');
      });

      it('should calculate coverage with mixed file types correctly', async () => {
        const srcDir = join(testDir, 'src');
        await fs.mkdir(srcDir, { recursive: true });

        // JavaScript file
        const jsCode = `
/**
 * JS function with docs
 */
function jsFunction() {}

function jsUndocumented() {}
`;

        // TypeScript file
        const tsCode = `
/**
 * TS interface with docs
 */
interface TSInterface {
  prop: string;
}

interface TSUndocumented {
  prop: number;
}

/**
 * TS function
 */
function tsFunction(): void {}
`;

        // Vue file (should be analyzed)
        const vueCode = `
<template>
  <div>Vue component</div>
</template>

<script>
/**
 * Vue component method
 */
export default {
  methods: {
    documentedMethod() {},
    undocumentedMethod() {}
  }
}
</script>
`;

        // CSS file (should be ignored)
        const cssCode = `
.container {
  display: flex;
  justify-content: center;
}
`;

        await fs.writeFile(join(srcDir, 'file.js'), jsCode);
        await fs.writeFile(join(srcDir, 'file.ts'), tsCode);
        await fs.writeFile(join(srcDir, 'component.vue'), vueCode);
        await fs.writeFile(join(srcDir, 'styles.css'), cssCode);

        const result = await analyzer.analyze(testDir);

        expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
        // Should analyze JS, TS, and Vue but not CSS
        expect(result.documentation.coverage).toBeGreaterThan(40);
        expect(result.documentation.coverage).toBeLessThan(80);
      });
    });

    describe('Mixed Documentation Styles', () => {
      it('should correctly identify mixed when no single style dominates', async () => {
        const srcDir = join(testDir, 'src');
        await fs.mkdir(srcDir, { recursive: true });

        const mixedStylesCode = `
/**
 * JSDoc style function
 * @param {string} input
 * @returns {string}
 */
function jsdocStyle(input) { return input; }

/**
 * TSDoc style function
 * @param input - Input parameter
 * @returns The result
 * @beta
 */
function tsdocStyle(input) { return input; }

// Inline comment for this function
// Explains what it does simply
function inlineStyle() { return true; }

/*
 * # Markdown Style
 *
 * This function uses **markdown** formatting.
 *
 * - Feature 1
 * - Feature 2
 *
 * \`\`\`javascript
 * markdownStyle();
 * \`\`\`
 */
function markdownStyle() { return 'markdown'; }
`;

        await fs.writeFile(join(srcDir, 'mixed-styles.js'), mixedStylesCode);
        const result = await analyzer.analyze(testDir);

        expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
        expect(result.documentation.style).toBe('mixed');
        expect(result.documentation.coverage).toBe(100);
      });

      it('should handle projects with some documented and some undocumented files', async () => {
        const srcDir = join(testDir, 'src');
        const utilsDir = join(srcDir, 'utils');
        await fs.mkdir(srcDir, { recursive: true });
        await fs.mkdir(utilsDir, { recursive: true });

        // Well-documented file
        const wellDocumentedCode = `
/**
 * Utility functions for string manipulation
 */

/**
 * Capitalizes first letter of string
 * @param {string} str - Input string
 * @returns {string} Capitalized string
 */
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Reverses a string
 * @param {string} str - Input string
 * @returns {string} Reversed string
 */
function reverse(str) {
  return str.split('').reverse().join('');
}
`;

        // Poorly documented file
        const poorlyDocumentedCode = `
function processData(data) {
  return data.map(item => item.value);
}

function validateInput(input) {
  return input && input.length > 0;
}

/**
 * Only one function documented
 */
function formatOutput(output) {
  return JSON.stringify(output, null, 2);
}

function handleError(error) {
  console.error(error);
}
`;

        // Completely undocumented file
        const undocumentedCode = `
function helper1() { return 1; }
function helper2() { return 2; }
function helper3() { return 3; }
class HelperClass {}
interface HelperInterface { prop: string; }
`;

        await fs.writeFile(join(srcDir, 'strings.js'), wellDocumentedCode);
        await fs.writeFile(join(srcDir, 'data.js'), poorlyDocumentedCode);
        await fs.writeFile(join(utilsDir, 'helpers.ts'), undocumentedCode);

        const result = await analyzer.analyze(testDir);

        expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
        expect(result.documentation.style).toBe('jsdoc');
        // Should be around 30-40% coverage (3 out of ~11 documentable elements)
        expect(result.documentation.coverage).toBeGreaterThan(20);
        expect(result.documentation.coverage).toBeLessThan(50);
      });
    });

    describe('Performance and Scale', () => {
      it('should handle large files with many documentable elements efficiently', async () => {
        const srcDir = join(testDir, 'src');
        await fs.mkdir(srcDir, { recursive: true });

        // Generate a large file with many functions
        let largeFileCode = '// Large file with many functions\n\n';

        for (let i = 0; i < 100; i++) {
          if (i % 3 === 0) {
            largeFileCode += `
/**
 * Function number ${i} - documented
 * @param {number} input - Input parameter
 * @returns {number} Output value
 */
function func${i}(input) {
  return input * ${i};
}
`;
          } else {
            largeFileCode += `
function func${i}(input) {
  return input * ${i};
}
`;
          }
        }

        // Add some classes and interfaces
        for (let i = 0; i < 20; i++) {
          if (i % 2 === 0) {
            largeFileCode += `
/**
 * Class number ${i}
 */
class Class${i} {
  constructor() {}
}
`;
          } else {
            largeFileCode += `
class Class${i} {
  constructor() {}
}
`;
          }
        }

        await fs.writeFile(join(srcDir, 'large.js'), largeFileCode);

        const startTime = Date.now();
        const result = await analyzer.analyze(testDir);
        const endTime = Date.now();

        expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
        expect(result.documentation.coverage).toBeCloseTo(33, 0); // ~33% documented
        expect(endTime - startTime).toBeLessThan(5000); // Should complete in < 5 seconds
      });
    });
  });

  describe('hasDocumentationBefore Method Edge Cases', () => {
    it('should detect documentation with various comment formats', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const edgeCaseCode = `
/**
 * Standard JSDoc before function
 */
function standardJsdoc() {}

/*
 * Block comment without JSDoc syntax
 */
function blockComment() {}

// Single line comment that is long enough to be considered documentation
function singleLineDoc() {}

//Short comment
function shortComment() {}

/* Single line block comment */
function singleLineBlock() {}

/***/
function emptyJsdoc() {}

/**/
function emptyBlock() {}

//
function emptyInline() {}

/**
 * Multi-line with gap


 */


function withGaps() {}

// Comment 1
// Comment 2
// Multi-line inline
function multiLineInline() {}

function noDocumentation() {}

    // Indented comment
function indentedComment() {}

/**
 * JSDoc with code in between
 */
const someVar = 42;
function afterVariable() {}
`;

      await fs.writeFile(join(srcDir, 'edge-cases.js'), edgeCaseCode);
      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.documentation.coverage).toBeGreaterThan(50);
      expect(result.documentation.coverage).toBeLessThanOrEqual(100);
    });

    it('should handle complex spacing and formatting around documentation', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const spacingCode = `

/**
 * Function with leading blank lines
 */


function withLeadingSpaces() {}

/**
 * Immediately followed
 */
function immediatelyAfter() {}


// Inline with spacing
// Multiple lines


function spacedInline() {}

/**
 * Documentation with weird spacing
 *
 *
 *     Indented content
 *
 *
 */



function weirdSpacing() {}

function noDoc1() {}
function noDoc2() {}

/**
 * Doc for next function
 */
function documented() {}

// Comment not for the function below
let variable = 42;

function notForThisFunction() {}
`;

      await fs.writeFile(join(srcDir, 'spacing.js'), spacingCode);
      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.documentation.coverage).toBeGreaterThan(40);
      expect(result.documentation.coverage).toBeLessThan(80);
    });
  });
});