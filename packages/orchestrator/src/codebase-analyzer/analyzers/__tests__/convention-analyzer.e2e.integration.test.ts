/**
 * ConventionAnalyzer End-to-End Integration Tests
 *
 * Comprehensive integration tests that run ConventionAnalyzer on sample codebases
 * and verify complete ConventionAnalysis output. Tests cover edge cases including
 * mixed conventions, inconsistent patterns, empty projects, and complex real-world scenarios.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { ConventionAnalyzer } from '../convention-analyzer.js';
import { ConventionAnalysisSchema, type ConventionAnalysis } from '@apexcli/core';

// Get the current file's directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const FIXTURES_PATH = join(__dirname, '../../../__fixtures__/convention-analyzer');

describe('ConventionAnalyzer End-to-End Integration Tests', () => {
  let analyzer: ConventionAnalyzer;
  let tempTestDir: string;

  beforeAll(() => {
    analyzer = new ConventionAnalyzer();
  });

  beforeEach(async () => {
    // Create unique temporary directory for each test
    tempTestDir = join(tmpdir(), `convention-e2e-${Date.now()}-${Math.random().toString(36).substring(7)}`);
    await fs.mkdir(tempTestDir, { recursive: true });
  });

  afterEach(async () => {
    // Cleanup temporary directory
    try {
      await fs.rm(tempTestDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Complete ConventionAnalysis Output Validation', () => {
    it('should return complete ConventionAnalysis for consistent camelCase project', async () => {
      const projectPath = join(FIXTURES_PATH, 'sample-codebases/consistent-camelcase');
      const result = await analyzer.analyze(projectPath);

      // Strict schema validation
      const parsed = ConventionAnalysisSchema.parse(result);

      // Validate all required fields exist and are correct types
      expect(parsed.fileNaming).toBe('camelCase');
      expect(parsed.functionNaming).toBe('camelCase');
      expect(parsed.variableNaming).toBe('camelCase');

      // Validate indentation
      expect(parsed.indentation.type).toBe('spaces');
      expect(parsed.indentation.size).toBeGreaterThanOrEqual(1);
      expect(parsed.indentation.size).toBeLessThanOrEqual(8);

      // Validate imports
      expect(parsed.imports.style).toBe('es6');
      expect(['single', 'double']).toContain(parsed.imports.quotes);

      // Validate documentation
      expect(['jsdoc', 'tsdoc', 'inline', 'none']).toContain(parsed.documentation.style);
      expect(parsed.documentation.coverage).toBeGreaterThanOrEqual(0);
      expect(parsed.documentation.coverage).toBeLessThanOrEqual(100);
      expect(Number.isInteger(parsed.documentation.coverage)).toBe(true);

      // Validate optional fields when present
      if (parsed.classNaming !== undefined) {
        expect(['PascalCase', 'camelCase', 'snake_case', 'mixed', 'inconsistent']).toContain(parsed.classNaming);
      }

      if (parsed.constantNaming !== undefined) {
        expect(['SCREAMING_SNAKE_CASE', 'camelCase', 'PascalCase', 'mixed', 'inconsistent']).toContain(parsed.constantNaming);
      }

      // Validate organization patterns
      if (parsed.organization) {
        expect(['separate-__tests__', 'separate-tests', 'colocated', 'mixed']).toContain(parsed.organization.testLocation);
        expect(['suffix-.test', 'suffix-.spec', 'suffix-Test', 'prefix-test-', 'mixed']).toContain(parsed.organization.testNaming);
        expect(['src', 'lib', 'app', 'source', 'root-level', 'mixed']).toContain(parsed.organization.sourceStructure);
      }

      // Validate formatting when present
      if (parsed.formatting) {
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
    });

    it('should return complete ConventionAnalysis for mixed conventions project', async () => {
      const projectPath = join(FIXTURES_PATH, 'sample-codebases/mixed-conventions');
      const result = await analyzer.analyze(projectPath);

      // Strict schema validation
      const parsed = ConventionAnalysisSchema.parse(result);

      // Mixed conventions should be detected
      expect(['mixed', 'inconsistent']).toContain(parsed.fileNaming);
      expect(['mixed', 'inconsistent']).toContain(parsed.functionNaming);
      expect(['mixed', 'inconsistent']).toContain(parsed.variableNaming);

      // Mixed indentation and imports should be detected
      expect(parsed.indentation.type).toBe('mixed');
      expect(['mixed', 'es6', 'commonjs']).toContain(parsed.imports.style);
      expect(['mixed', 'single', 'double']).toContain(parsed.imports.quotes);

      // Documentation should still be analyzable
      expect(['jsdoc', 'tsdoc', 'inline', 'markdown', 'none', 'mixed']).toContain(parsed.documentation.style);
      expect(parsed.documentation.coverage).toBeGreaterThanOrEqual(0);
      expect(parsed.documentation.coverage).toBeLessThanOrEqual(100);

      // All other validations should still pass
      if (parsed.organization) {
        expect(['separate-__tests__', 'separate-tests', 'colocated', 'mixed']).toContain(parsed.organization.testLocation);
        expect(['suffix-.test', 'suffix-.spec', 'suffix-Test', 'prefix-test-', 'mixed']).toContain(parsed.organization.testNaming);
        expect(['src', 'lib', 'app', 'source', 'root-level', 'mixed']).toContain(parsed.organization.sourceStructure);
      }
    });
  });

  describe('Edge Case Coverage - Complex Scenarios', () => {
    it('should handle project with deeply nested file structure', async () => {
      const srcDir = join(tempTestDir, 'src/modules/user/services/validation/rules');
      await fs.mkdir(srcDir, { recursive: true });

      const deeplyNestedCode = `
/**
 * Deep validation rule
 */
export class EmailValidationRule {
  private static readonly EMAIL_REGEX = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;

  /**
   * Validate email format
   * @param email - Email to validate
   * @returns true if valid
   */
  static validateEmailFormat(email: string): boolean {
    const trimmedEmail = email.trim();
    const isValidFormat = this.EMAIL_REGEX.test(trimmedEmail);
    const hasValidDomain = this.checkDomainValidity(trimmedEmail);

    return isValidFormat && hasValidDomain;
  }

  private static checkDomainValidity(email: string): boolean {
    const domain = email.split('@')[1];
    return domain && domain.includes('.');
  }
}
`;

      await fs.writeFile(join(srcDir, 'emailValidationRule.ts'), deeplyNestedCode);

      const result = await analyzer.analyze(tempTestDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();

      // Should still detect consistent naming despite deep nesting
      expect(result.fileNaming).toBe('camelCase');
      expect(result.functionNaming).toBe('camelCase');
      expect(result.variableNaming).toBe('camelCase');
      expect(result.classNaming).toBe('PascalCase');
      expect(result.constantNaming).toBe('SCREAMING_SNAKE_CASE');

      // Organization should reflect deep structure
      expect(result.organization?.sourceStructure).toBe('src');
    });

    it('should handle project with mixed file extensions and languages', async () => {
      const srcDir = join(tempTestDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      // Create mixed language files with different conventions
      const jsFile = `
function processDataOld(rawData) {
  const cleaned_data = rawData.filter(item => item !== null);
  return cleaned_data.map(item => item.toString());
}

module.exports = { processDataOld };
`;

      const tsFile = `
/**
 * Modern data processor
 */
export class DataProcessor {
  private readonly CONFIG_TIMEOUT = 5000;

  /**
   * Process data with validation
   */
  processDataModern<T>(data: T[]): string[] {
    const validData = this.validateInput(data);
    return validData.map(item => String(item));
  }

  private validateInput<T>(data: T[]): T[] {
    if (!Array.isArray(data)) {
      throw new Error('Input must be array');
    }
    return data.filter(item => item != null);
  }
}
`;

      const pythonFile = `
def process_data_python(raw_data):
    """Process data Python style."""
    cleaned_data = [item for item in raw_data if item is not None]
    return [str(item) for item in cleaned_data]

class DataProcessorPython:
    CONFIG_TIMEOUT = 5000

    def process_data_method(self, data):
        validated_data = self._validate_input(data)
        return [str(item) for item in validated_data]
`;

      const cssFile = `
.button-primary {
  background-color: #007cba;
  border-radius: 4px;
  font-size: 14px;
}

.form_container {
  max-width: 600px;
  margin: 0 auto;
}

.alertMessage {
  color: #d63031;
  font-weight: bold;
}
`;

      await fs.writeFile(join(srcDir, 'oldProcessor.js'), jsFile);
      await fs.writeFile(join(srcDir, 'dataProcessor.ts'), tsFile);
      await fs.writeFile(join(srcDir, 'processor.py'), pythonFile);
      await fs.writeFile(join(srcDir, 'styles.css'), cssFile);

      const result = await analyzer.analyze(tempTestDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();

      // Should detect mixed conventions from different languages
      expect(['mixed', 'inconsistent']).toContain(result.fileNaming);
      expect(['mixed', 'inconsistent', 'camelCase']).toContain(result.functionNaming);
      expect(['mixed', 'inconsistent']).toContain(result.variableNaming);

      // Should handle mixed import styles
      expect(['mixed', 'es6', 'commonjs']).toContain(result.imports.style);

      // Documentation should be detected from TypeScript files
      expect(['jsdoc', 'tsdoc', 'inline', 'none', 'mixed']).toContain(result.documentation.style);
    });

    it('should handle project with no analyzable files', async () => {
      // Create project with only non-code files
      await fs.writeFile(join(tempTestDir, 'README.md'), '# Project README');
      await fs.writeFile(join(tempTestDir, 'LICENSE'), 'MIT License');
      await fs.writeFile(join(tempTestDir, '.gitignore'), 'node_modules/\n*.log');

      const binaryDir = join(tempTestDir, 'bin');
      await fs.mkdir(binaryDir, { recursive: true });
      await fs.writeFile(join(binaryDir, 'binary-file'), Buffer.from([0x00, 0x01, 0x02]));

      const result = await analyzer.analyze(tempTestDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();

      // Should return default values for empty project
      expect(result.fileNaming).toBe('mixed');
      expect(result.functionNaming).toBe('mixed');
      expect(result.variableNaming).toBe('mixed');
      expect(result.documentation.style).toBe('none');
      expect(result.documentation.coverage).toBe(0);
      expect(result.indentation.type).toBe('spaces');
      expect(result.indentation.size).toBe(2);
      expect(result.imports.style).toBe('es6');
    });

    it('should handle project with extreme indentation inconsistencies', async () => {
      const srcDir = join(tempTestDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const tabIndentedFile = `
class TabIndented {
\tconstructor() {
\t\tthis.value = 'tabs';
\t\tthis.nested = {
\t\t\tprop: 'deeply nested'
\t\t};
\t}

\tgetValue() {
\t\treturn this.value;
\t}
}
`;

      const spaceIndentedFile = `
class SpaceIndented {
  constructor() {
    this.value = 'spaces';
    this.nested = {
      prop: 'deeply nested'
    };
  }

  getValue() {
    return this.value;
  }
}
`;

      const mixedIndentedFile = `
class MixedIndented {
\tconstructor() {
  \t  this.value = 'mixed tabs and spaces';
    \tthis.nested = {
\t    prop: 'chaos'
  \t};
\t}

  getValue() {
\t\treturn this.value;
  }
}
`;

      const inconsistentSpacesFile = `
class InconsistentSpaces {
  constructor() {
      this.value = 'four spaces';
        this.nested = {
          prop: 'six spaces then eight'
        };
  }

   getValue() {
     return this.value;
   }
}
`;

      await fs.writeFile(join(srcDir, 'tabFile.ts'), tabIndentedFile);
      await fs.writeFile(join(srcDir, 'spaceFile.ts'), spaceIndentedFile);
      await fs.writeFile(join(srcDir, 'mixedFile.ts'), mixedIndentedFile);
      await fs.writeFile(join(srcDir, 'inconsistentFile.ts'), inconsistentSpacesFile);

      const result = await analyzer.analyze(tempTestDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();

      // Should detect mixed indentation
      expect(result.indentation.type).toBe('mixed');

      // Size might vary but should be reasonable
      if (result.indentation.size !== undefined) {
        expect(result.indentation.size).toBeGreaterThanOrEqual(1);
        expect(result.indentation.size).toBeLessThanOrEqual(8);
      }

      // Other conventions should still be detected properly
      expect(result.classNaming).toBe('PascalCase');
      expect(result.functionNaming).toBe('camelCase');
    });
  });

  describe('Real-world Scenario Validation', () => {
    it('should handle large project with multiple patterns', async () => {
      const srcDir = join(tempTestDir, 'src');
      const testDir = join(tempTestDir, '__tests__');
      const libDir = join(tempTestDir, 'lib');
      const configDir = join(tempTestDir, 'config');

      await fs.mkdir(srcDir, { recursive: true });
      await fs.mkdir(testDir, { recursive: true });
      await fs.mkdir(libDir, { recursive: true });
      await fs.mkdir(configDir, { recursive: true });

      // Main application files with consistent patterns
      const mainFiles = [
        {
          name: 'userManager.ts',
          content: `
/**
 * User management service
 * @example
 * const manager = new UserManager();
 * await manager.createUser({ name: 'John' });
 */
export class UserManager {
  private readonly DATABASE_URL = 'mongodb://localhost';
  private users: Map<string, User> = new Map();

  /**
   * Create a new user
   * @param userData - User information
   * @returns Created user
   */
  async createUser(userData: CreateUserRequest): Promise<User> {
    const userId = this.generateUserId();
    const newUser = {
      id: userId,
      ...userData,
      createdAt: new Date()
    };

    this.users.set(userId, newUser);
    return newUser;
  }

  private generateUserId(): string {
    return Math.random().toString(36).substring(7);
  }
}

interface User {
  id: string;
  name: string;
  createdAt: Date;
}

interface CreateUserRequest {
  name: string;
}
`
        },
        {
          name: 'orderProcessor.ts',
          content: `
import { UserManager } from './userManager.js';

/**
 * Order processing service
 */
export class OrderProcessor {
  private readonly MAX_ORDER_VALUE = 10000;

  constructor(private userManager: UserManager) {}

  /**
   * Process order with validation
   */
  async processOrder(orderData: OrderRequest): Promise<OrderResult> {
    const isValidOrder = this.validateOrder(orderData);
    if (!isValidOrder) {
      throw new Error('Invalid order');
    }

    const processedOrder = {
      id: this.generateOrderId(),
      ...orderData,
      status: 'processed' as const,
      processedAt: new Date()
    };

    return processedOrder;
  }

  private validateOrder(order: OrderRequest): boolean {
    return order.value > 0 && order.value <= this.MAX_ORDER_VALUE;
  }

  private generateOrderId(): string {
    return \`ORD-\${Date.now()}\`;
  }
}
`
        }
      ];

      // Test files following consistent patterns
      const testFiles = [
        {
          name: 'userManager.test.ts',
          content: `
import { describe, it, expect } from 'vitest';
import { UserManager } from '../src/userManager.js';

describe('UserManager', () => {
  it('should create user successfully', async () => {
    const userManager = new UserManager();
    const userData = { name: 'Test User' };

    const result = await userManager.createUser(userData);

    expect(result.name).toBe('Test User');
    expect(result.id).toBeDefined();
  });

  it('should handle multiple users', async () => {
    const userManager = new UserManager();

    const user1 = await userManager.createUser({ name: 'User 1' });
    const user2 = await userManager.createUser({ name: 'User 2' });

    expect(user1.id).not.toBe(user2.id);
  });
});
`
        },
        {
          name: 'orderProcessor.test.ts',
          content: `
import { describe, it, expect, vi } from 'vitest';
import { OrderProcessor } from '../src/orderProcessor.js';
import { UserManager } from '../src/userManager.js';

describe('OrderProcessor', () => {
  it('should process valid order', async () => {
    const mockUserManager = vi.mocked(new UserManager());
    const orderProcessor = new OrderProcessor(mockUserManager);

    const orderData = { value: 100, description: 'Test order' };
    const result = await orderProcessor.processOrder(orderData);

    expect(result.status).toBe('processed');
    expect(result.value).toBe(100);
  });
});
`
        }
      ];

      // Library files with different conventions (simulating legacy code)
      const libFiles = [
        {
          name: 'legacy_utils.js',
          content: `
// Legacy utility functions
function format_date(date) {
  return date.toISOString().split('T')[0];
}

function validate_email_address(email) {
  const EMAIL_PATTERN = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
  return EMAIL_PATTERN.test(email);
}

module.exports = {
  format_date,
  validate_email_address
};
`
        }
      ];

      // Config files
      const configFiles = [
        {
          name: 'database.config.js',
          content: `
const DATABASE_CONFIG = {
  host: 'localhost',
  port: 5432,
  database: 'myapp',
  ssl: false
};

module.exports = DATABASE_CONFIG;
`
        }
      ];

      // Write all files
      for (const file of mainFiles) {
        await fs.writeFile(join(srcDir, file.name), file.content);
      }

      for (const file of testFiles) {
        await fs.writeFile(join(testDir, file.name), file.content);
      }

      for (const file of libFiles) {
        await fs.writeFile(join(libDir, file.name), file.content);
      }

      for (const file of configFiles) {
        await fs.writeFile(join(configDir, file.name), file.content);
      }

      const result = await analyzer.analyze(tempTestDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();

      // Should detect mixed conventions due to legacy files
      expect(['mixed', 'inconsistent', 'camelCase']).toContain(result.fileNaming);
      expect(['mixed', 'inconsistent', 'camelCase']).toContain(result.functionNaming);

      // Should detect proper indentation
      expect(['spaces', 'mixed']).toContain(result.indentation.type);

      // Should detect modern ES6 imports
      expect(['es6', 'mixed']).toContain(result.imports.style);

      // Should detect good documentation in main files
      expect(['jsdoc', 'tsdoc', 'mixed']).toContain(result.documentation.style);
      expect(result.documentation.coverage).toBeGreaterThan(0);

      // Should detect test organization
      expect(result.organization).toBeDefined();
      expect(result.organization!.testLocation).toBe('separate-__tests__');
      expect(result.organization!.testNaming).toBe('suffix-.test');
      expect(result.organization!.sourceStructure).toBe('src');
      expect(result.organization!.configLocation).toBe('config-dir');
    });
  });

  describe('Performance and Error Handling', () => {
    it('should handle analysis of large codebase within reasonable time', async () => {
      const srcDir = join(tempTestDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      // Generate large number of files to test performance
      const filePromises = [];
      for (let i = 0; i < 50; i++) {
        const content = `
/**
 * Generated file ${i}
 */
export class GeneratedClass${i} {
  private value${i}: string = 'value${i}';

  /**
   * Get value method ${i}
   */
  getValue${i}(): string {
    const transformedValue = this.value${i}.toUpperCase();
    const processedValue = transformedValue.replace(/\\d+/g, '');
    return processedValue;
  }

  /**
   * Set value method ${i}
   */
  setValue${i}(newValue: string): void {
    if (!newValue || newValue.trim().length === 0) {
      throw new Error('Invalid value');
    }
    this.value${i} = newValue;
  }
}

export interface GeneratedInterface${i} {
  property${i}: string;
  method${i}(): void;
}
`;
        filePromises.push(
          fs.writeFile(join(srcDir, `generated${i}.ts`), content)
        );
      }

      await Promise.all(filePromises);

      const startTime = Date.now();
      const result = await analyzer.analyze(tempTestDir);
      const duration = Date.now() - startTime;

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();

      // Should complete within reasonable time (less than 10 seconds for 50 files)
      expect(duration).toBeLessThan(10000);

      // Should detect consistent patterns despite large size
      expect(result.fileNaming).toBe('camelCase');
      expect(result.functionNaming).toBe('camelCase');
      expect(result.classNaming).toBe('PascalCase');
      expect(result.documentation.style).toBe('jsdoc');
      expect(result.documentation.coverage).toBeGreaterThan(80);
    });

    it('should handle gracefully when encountering corrupted files', async () => {
      const srcDir = join(tempTestDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      // Create valid file
      await fs.writeFile(join(srcDir, 'valid.ts'), `
/**
 * Valid TypeScript file
 */
export class ValidClass {
  getValue(): string {
    return 'valid';
  }
}
`);

      // Create file with binary content (should be skipped)
      const binaryContent = Buffer.from([0x00, 0x01, 0x02, 0x03, 0xFF, 0xFE]);
      await fs.writeFile(join(srcDir, 'binary.ts'), binaryContent);

      // Create file with unusual encoding issues (but still readable)
      const weirdContent = 'export function weirdFunction() { return "weird\\u0000content"; }';
      await fs.writeFile(join(srcDir, 'weird.js'), weirdContent);

      const result = await analyzer.analyze(tempTestDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();

      // Should analyze the valid files and skip problematic ones
      expect(result.fileNaming).toBe('camelCase');
      expect(result.functionNaming).toBe('camelCase');
      expect(result.classNaming).toBe('PascalCase');
    });
  });
});