/**
 * CrossReferenceValidator Integration Tests
 *
 * Integration tests that work with real-like file system scenarios,
 * testing the complete workflow from file discovery to broken link reporting.
 * These tests create temporary file structures and test realistic scenarios.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CrossReferenceValidator } from '../cross-reference-validator';
import type { OutdatedDocumentation } from '@apexcli/core';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock fs module for controlled testing
vi.mock('fs/promises');
const mockFs = vi.mocked(fs);

describe('CrossReferenceValidator Integration', () => {
  let validator: CrossReferenceValidator;
  let mockFileSystem: Map<string, string>;
  let mockDirectoryStructure: Map<string, string[]>;

  beforeEach(() => {
    validator = new CrossReferenceValidator();
    mockFileSystem = new Map();
    mockDirectoryStructure = new Map();
    vi.clearAllMocks();

    // Setup mock file system
    setupMockFileSystem();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  function setupMockFileSystem() {
    // Mock readdir to simulate directory structure
    mockFs.readdir.mockImplementation(async (dirPath: any, options?: any) => {
      const normalizedPath = path.normalize(dirPath);
      const entries = mockDirectoryStructure.get(normalizedPath) || [];

      return entries.map(entry => ({
        name: path.basename(entry),
        isFile: () => mockFileSystem.has(entry),
        isDirectory: () => mockDirectoryStructure.has(entry),
      })) as any;
    });

    // Mock readFile to return file contents
    mockFs.readFile.mockImplementation(async (filePath: any, encoding?: any) => {
      const normalizedPath = path.normalize(filePath);
      const content = mockFileSystem.get(normalizedPath);
      if (!content) {
        throw new Error(`ENOENT: no such file or directory, open '${filePath}'`);
      }
      return content;
    });
  }

  function addMockFile(filePath: string, content: string) {
    const normalizedPath = path.normalize(filePath);
    mockFileSystem.set(normalizedPath, content);

    // Add to parent directory
    const parentDir = path.dirname(normalizedPath);
    if (!mockDirectoryStructure.has(parentDir)) {
      mockDirectoryStructure.set(parentDir, []);
    }
    const dirContents = mockDirectoryStructure.get(parentDir)!;
    if (!dirContents.includes(normalizedPath)) {
      dirContents.push(normalizedPath);
    }
  }

  function addMockDirectory(dirPath: string) {
    const normalizedPath = path.normalize(dirPath);
    if (!mockDirectoryStructure.has(normalizedPath)) {
      mockDirectoryStructure.set(normalizedPath, []);
    }

    // Add to parent directory
    const parentDir = path.dirname(normalizedPath);
    if (parentDir !== normalizedPath && !mockDirectoryStructure.has(parentDir)) {
      mockDirectoryStructure.set(parentDir, []);
    }
    if (parentDir !== normalizedPath) {
      const parentContents = mockDirectoryStructure.get(parentDir)!;
      if (!parentContents.includes(normalizedPath)) {
        parentContents.push(normalizedPath);
      }
    }
  }

  describe('realistic project scenarios', () => {
    it('should handle a typical TypeScript project structure', async () => {
      // Setup a realistic project structure
      addMockDirectory('/project/src');
      addMockDirectory('/project/src/components');
      addMockDirectory('/project/src/services');
      addMockDirectory('/project/src/utils');
      addMockDirectory('/project/docs');

      // Add source files
      addMockFile('/project/src/index.ts', `
export { UserService } from './services/user-service';
export { Button } from './components/button';
export { formatDate, validateEmail } from './utils/helpers';

/**
 * Main application entry point
 */
export class App {
  private userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  public async start(): Promise<void> {
    console.log('Application starting...');
  }
}
`);

      addMockFile('/project/src/services/user-service.ts', `
import { validateEmail } from '../utils/helpers';

export interface User {
  id: string;
  name: string;
  email: string;
}

/**
 * Service for managing users
 * @see User interface for user data structure
 */
export class UserService {
  private apiUrl = 'https://api.example.com';

  /**
   * Retrieves a user by ID
   * @param id User identifier
   * @returns Promise resolving to user data
   */
  public async getUser(id: string): Promise<User> {
    const response = await fetch(\`\${this.apiUrl}/users/\${id}\`);
    return response.json();
  }

  /**
   * Creates a new user
   * @param userData User data to create
   * @see validateEmail for email validation
   */
  public async createUser(userData: Omit<User, 'id'>): Promise<User> {
    if (!validateEmail(userData.email)) {
      throw new Error('Invalid email');
    }
    // Implementation
    return { id: '123', ...userData };
  }
}
`);

      addMockFile('/project/src/components/button.tsx', `
import React from 'react';

export interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}

/**
 * Reusable button component
 */
export const Button: React.FC<ButtonProps> = ({ children, onClick, disabled }) => {
  return (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
};
`);

      addMockFile('/project/src/utils/helpers.ts', `
/**
 * Formats a date to ISO string
 * @param date Date to format
 * @returns Formatted date string
 */
export function formatDate(date: Date): string {
  return date.toISOString();
}

/**
 * Validates an email address
 * @param email Email to validate
 * @returns True if valid, false otherwise
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Utility function for data processing
 */
export const processData = (data: any[]): any[] => {
  return data.filter(item => item !== null);
};
`);

      // Add documentation files with various reference types
      addMockFile('/project/docs/api.md', `
# API Documentation

## User Management

Use the \`UserService\` class to manage users in your application.

### Getting a User

\`\`\`typescript
import { UserService } from '../src/services/user-service';

const service = new UserService();
const user = await service.getUser('123');
\`\`\`

### Creating a User

The \`createUser\` method validates email addresses using \`validateEmail\`.

\`\`\`typescript
const newUser = await service.createUser({
  name: 'John Doe',
  email: 'john@example.com'
});
\`\`\`

## Utilities

Use \`formatDate\` for consistent date formatting:

\`\`\`typescript
import { formatDate } from '../src/utils/helpers';
console.log(formatDate(new Date()));
\`\`\`

## Components

The \`Button\` component provides a reusable UI element:

\`\`\`tsx
import { Button } from '../src/components/button';

<Button onClick={() => console.log('clicked')}>
  Click me
</Button>
\`\`\`
`);

      addMockFile('/project/docs/broken-references.md', `
# Documentation with Broken References

This file contains references to non-existent symbols for testing.

## Broken Inline References

Use the \`NonExistentService\` class for advanced operations.
Call \`missingFunction()\` to process data.
The \`UndefinedClass\` handles special cases.

## Broken Code Examples

\`\`\`typescript
import { FakeImport } from './nowhere';

const instance = new NotRealClass();
const result = nonExistentFunction(data);
\`\`\`

## Broken JSDoc References

/**
 * This function does something
 * @see NonExistentFunction for related functionality
 * @see {MissingClass} for configuration
 */

## Mixed Valid and Invalid References

Use \`UserService\` (valid) and \`FakeService\` (invalid) together.
Call \`formatDate\` (valid) or \`fakeFormat\` (invalid).
`);

      addMockFile('/project/docs/README.md', `
# Project Documentation

## Getting Started

1. Import the main \`App\` class
2. Use \`UserService\` for user management
3. Utilize \`Button\` components in your UI

## Examples

\`\`\`typescript
import { App, UserService } from './src';

const app = new App();
await app.start();
\`\`\`

## Utilities

- \`formatDate\`: Date formatting utility
- \`validateEmail\`: Email validation helper
- \`processData\`: Data processing utility
`);

      // Build the symbol index
      const index = await validator.buildIndex('/project/src');

      // Verify index was built correctly
      expect(index.stats.totalFiles).toBeGreaterThan(0);
      expect(index.stats.totalSymbols).toBeGreaterThan(0);

      // Check for expected symbols
      expect(index.byName.has('App')).toBe(true);
      expect(index.byName.has('UserService')).toBe(true);
      expect(index.byName.has('Button')).toBe(true);
      expect(index.byName.has('formatDate')).toBe(true);
      expect(index.byName.has('validateEmail')).toBe(true);
      expect(index.byName.has('User')).toBe(true); // interface

      // Extract references from documentation
      const apiRefs = validator.extractDocumentationReferences('/project/docs/api.md',
        mockFileSystem.get('/project/docs/api.md')!);
      const brokenRefs = validator.extractDocumentationReferences('/project/docs/broken-references.md',
        mockFileSystem.get('/project/docs/broken-references.md')!);
      const readmeRefs = validator.extractDocumentationReferences('/project/docs/README.md',
        mockFileSystem.get('/project/docs/README.md')!);

      const allRefs = [...apiRefs, ...brokenRefs, ...readmeRefs];
      expect(allRefs.length).toBeGreaterThan(0);

      // Validate all references
      const brokenLinks = validator.validateDocumentationReferences(index, allRefs);

      // Should have broken links from the broken-references.md file
      expect(brokenLinks.length).toBeGreaterThan(0);

      // Check specific broken references
      const nonExistentService = brokenLinks.find(issue =>
        issue.description.includes('NonExistentService'));
      expect(nonExistentService).toBeDefined();
      expect(nonExistentService?.type).toBe('broken-link');
      expect(nonExistentService?.file).toBe('/project/docs/broken-references.md');

      // Valid references should not appear in broken links
      const validUserService = brokenLinks.find(issue =>
        issue.description.includes('UserService') && issue.description.includes('broken-link'));
      expect(validUserService).toBeUndefined();

      // Check that suggestions are provided for similar names
      const issuesWithSuggestions = brokenLinks.filter(issue => issue.suggestion);
      expect(issuesWithSuggestions.length).toBeGreaterThan(0);
    });

    it('should handle monorepo structure with multiple packages', async () => {
      // Setup monorepo structure
      addMockDirectory('/monorepo/packages');
      addMockDirectory('/monorepo/packages/core');
      addMockDirectory('/monorepo/packages/core/src');
      addMockDirectory('/monorepo/packages/ui');
      addMockDirectory('/monorepo/packages/ui/src');
      addMockDirectory('/monorepo/packages/api');
      addMockDirectory('/monorepo/packages/api/src');

      // Core package
      addMockFile('/monorepo/packages/core/src/index.ts', `
export interface BaseConfig {
  apiUrl: string;
  timeout: number;
}

export abstract class BaseService {
  protected config: BaseConfig;

  constructor(config: BaseConfig) {
    this.config = config;
  }

  protected async request<T>(endpoint: string): Promise<T> {
    // Base request implementation
    throw new Error('Not implemented');
  }
}

export function createConfig(overrides: Partial<BaseConfig> = {}): BaseConfig {
  return {
    apiUrl: 'https://api.example.com',
    timeout: 5000,
    ...overrides
  };
}
`);

      // UI package
      addMockFile('/monorepo/packages/ui/src/index.ts', `
export interface Theme {
  primary: string;
  secondary: string;
}

export const defaultTheme: Theme = {
  primary: '#007bff',
  secondary: '#6c757d'
};

export interface ComponentProps {
  theme?: Theme;
  className?: string;
}

export const Modal = ({ theme = defaultTheme, className }: ComponentProps) => {
  // Modal implementation
  return null;
};
`);

      // API package
      addMockFile('/monorepo/packages/api/src/index.ts', `
import { BaseService, BaseConfig } from '@monorepo/core';

export interface ApiResponse<T> {
  data: T;
  status: number;
  message?: string;
}

export class ApiService extends BaseService {
  public async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<ApiResponse<T>>(endpoint);
  }

  public async post<T>(endpoint: string, data: any): Promise<ApiResponse<T>> {
    return this.request<ApiResponse<T>>(endpoint);
  }
}

export function createApiService(config?: Partial<BaseConfig>): ApiService {
  return new ApiService(createConfig(config));
}
`);

      // Test each package individually
      const coreIndex = await validator.buildIndex('/monorepo/packages/core/src');
      expect(coreIndex.byName.has('BaseConfig')).toBe(true);
      expect(coreIndex.byName.has('BaseService')).toBe(true);
      expect(coreIndex.byName.has('createConfig')).toBe(true);

      const uiIndex = await validator.buildIndex('/monorepo/packages/ui/src');
      expect(uiIndex.byName.has('Theme')).toBe(true);
      expect(uiIndex.byName.has('defaultTheme')).toBe(true);
      expect(uiIndex.byName.has('Modal')).toBe(true);

      const apiIndex = await validator.buildIndex('/monorepo/packages/api/src');
      expect(apiIndex.byName.has('ApiService')).toBe(true);
      expect(apiIndex.byName.has('createApiService')).toBe(true);

      // Test combined index building (simulate scanning all packages)
      const allFiles = [
        ...Array.from(coreIndex.byFile.keys()),
        ...Array.from(uiIndex.byFile.keys()),
        ...Array.from(apiIndex.byFile.keys())
      ];

      // Manual combination for testing purposes
      const combinedIndex = {
        byName: new Map([
          ...coreIndex.byName.entries(),
          ...uiIndex.byName.entries(),
          ...apiIndex.byName.entries()
        ]),
        byFile: new Map([
          ...coreIndex.byFile.entries(),
          ...uiIndex.byFile.entries(),
          ...apiIndex.byFile.entries()
        ]),
        stats: {
          totalSymbols: coreIndex.stats.totalSymbols + uiIndex.stats.totalSymbols + apiIndex.stats.totalSymbols,
          totalFiles: coreIndex.stats.totalFiles + uiIndex.stats.totalFiles + apiIndex.stats.totalFiles,
          byType: {}
        }
      };

      expect(combinedIndex.byName.size).toBeGreaterThan(5);
    });

    it('should handle large project with many symbols and references', async () => {
      // Generate a larger project structure programmatically
      addMockDirectory('/large-project/src');
      addMockDirectory('/large-project/src/modules');

      // Generate multiple modules
      const moduleCount = 5;
      const symbolsPerModule = 10;

      for (let i = 1; i <= moduleCount; i++) {
        addMockDirectory(`/large-project/src/modules/module${i}`);

        const moduleContent = `
// Module ${i} - Generated for testing
${Array.from({ length: symbolsPerModule }, (_, j) => {
  const funcName = `module${i}Function${j + 1}`;
  const className = `Module${i}Class${j + 1}`;
  const interfaceName = `Module${i}Interface${j + 1}`;

  return `
export function ${funcName}(param: string): string {
  return 'result_' + param;
}

export class ${className} {
  public method${j + 1}(): void {
    ${funcName}('test');
  }
}

export interface ${interfaceName} {
  prop${j + 1}: string;
}
`;
}).join('\n')}
`;

        addMockFile(`/large-project/src/modules/module${i}/index.ts`, moduleContent);
      }

      // Create main index that imports from all modules
      const mainIndexContent = `
${Array.from({ length: moduleCount }, (_, i) =>
  `export * from './modules/module${i + 1}';`
).join('\n')}

export class MainApp {
  public start(): void {
    // Use some functions from modules
    ${Array.from({ length: Math.min(3, moduleCount) }, (_, i) =>
      `module${i + 1}Function1('test');`
    ).join('\n    ')}
  }
}
`;

      addMockFile('/large-project/src/index.ts', mainIndexContent);

      // Create documentation with many references
      const docsContent = `
# Large Project Documentation

This project contains ${moduleCount} modules with various functions and classes.

## Available Functions

${Array.from({ length: moduleCount }, (_, i) =>
  Array.from({ length: Math.min(3, symbolsPerModule) }, (_, j) =>
    `- \`module${i + 1}Function${j + 1}\`: Function from module ${i + 1}`
  ).join('\n')
).join('\n')}

## Classes

${Array.from({ length: moduleCount }, (_, i) =>
  `- \`Module${i + 1}Class1\`: Main class from module ${i + 1}`
).join('\n')}

## Code Examples

\`\`\`typescript
import { MainApp } from './src';
${Array.from({ length: Math.min(2, moduleCount) }, (_, i) =>
  `import { module${i + 1}Function1 } from './src/modules/module${i + 1}';`
).join('\n')}

const app = new MainApp();
app.start();
\`\`\`

## Non-existent references for testing
- \`NonExistentFunction\`
- \`FakeClass\`
- \`UndefinedInterface\`
`;

      addMockFile('/large-project/docs/README.md', docsContent);

      // Build index and validate
      const index = await validator.buildIndex('/large-project/src');

      expect(index.stats.totalSymbols).toBeGreaterThan(moduleCount * 3); // At least 3 symbols per module
      expect(index.stats.totalFiles).toBe(moduleCount + 1); // Module files + main index

      // Extract and validate references
      const references = validator.extractDocumentationReferences('/large-project/docs/README.md', docsContent);
      expect(references.length).toBeGreaterThan(10);

      const brokenLinks = validator.validateDocumentationReferences(index, references);

      // Should have some broken links (the non-existent ones)
      const nonExistentRefs = brokenLinks.filter(link =>
        link.description.includes('NonExistentFunction') ||
        link.description.includes('FakeClass') ||
        link.description.includes('UndefinedInterface')
      );

      expect(nonExistentRefs.length).toBeGreaterThan(0);
      expect(brokenLinks.length).toBe(3); // Only the 3 non-existent references should be broken
    });
  });

  describe('real-world edge cases', () => {
    it('should handle mixed file extensions correctly', async () => {
      addMockDirectory('/mixed-project/src');

      // TypeScript file
      addMockFile('/mixed-project/src/service.ts', `
export class TypeScriptService {
  public process(): string {
    return 'typescript';
  }
}
`);

      // TypeScript React file
      addMockFile('/mixed-project/src/component.tsx', `
import React from 'react';

export const ReactComponent: React.FC<{title: string}> = ({ title }) => {
  return <div>{title}</div>;
};
`);

      // JavaScript file
      addMockFile('/mixed-project/src/utils.js', `
export function jsUtility(value) {
  return value.toString();
}

export const jsConstant = 'javascript';
`);

      // JavaScript React file
      addMockFile('/mixed-project/src/legacy.jsx', `
import React from 'react';

export const LegacyComponent = ({ name }) => {
  return React.createElement('span', null, name);
};
`);

      const index = await validator.buildIndex('/mixed-project/src', {
        extensions: ['.ts', '.tsx', '.js', '.jsx']
      });

      expect(index.byName.has('TypeScriptService')).toBe(true);
      expect(index.byName.has('ReactComponent')).toBe(true);
      expect(index.byName.has('jsUtility')).toBe(true);
      expect(index.byName.has('LegacyComponent')).toBe(true);
      expect(index.stats.totalFiles).toBe(4);
    });

    it('should handle files with syntax errors gracefully', async () => {
      addMockDirectory('/error-prone/src');

      // Valid file
      addMockFile('/error-prone/src/valid.ts', `
export class ValidClass {
  public method(): void {}
}
`);

      // File with syntax errors
      addMockFile('/error-prone/src/broken.ts', `
export class BrokenClass {
  public method(: void {
    // Missing closing brace and syntax errors
`);

      // File with TypeScript errors but valid JS
      addMockFile('/error-prone/src/mixed.ts', `
export function mixedFunction(param) {
  // Valid JavaScript but may have TS issues
  return param.someProperty.that.may.not.exist;
}
`);

      const index = await validator.buildIndex('/error-prone/src');

      // Should extract what it can
      expect(index.byName.has('ValidClass')).toBe(true);
      expect(index.byName.has('mixedFunction')).toBe(true);

      // Should handle broken files gracefully (may or may not extract symbols)
      expect(index.stats.totalFiles).toBeGreaterThan(0);
      expect(index.stats.totalSymbols).toBeGreaterThan(0);
    });

    it('should handle deeply nested directory structures', async () => {
      const depth = 5;
      let currentPath = '/deep-project';

      // Create nested structure
      for (let i = 0; i < depth; i++) {
        currentPath = path.join(currentPath, `level${i + 1}`);
        addMockDirectory(currentPath);
      }

      // Add file at the deepest level
      const deepFilePath = path.join(currentPath, 'deep-file.ts');
      addMockFile(deepFilePath, `
export class DeepClass {
  public deepMethod(): string {
    return 'deeply nested';
  }
}

export function deepFunction(): void {
  console.log('from the depths');
}
`);

      const index = await validator.buildIndex('/deep-project');

      expect(index.byName.has('DeepClass')).toBe(true);
      expect(index.byName.has('deepFunction')).toBe(true);
      expect(index.stats.totalFiles).toBe(1);
    });

    it('should handle files with no exports correctly', async () => {
      addMockDirectory('/no-exports/src');

      // File with only internal functions
      addMockFile('/no-exports/src/internal.ts', `
function internalFunction(): void {
  console.log('internal');
}

class InternalClass {
  private value: string = 'private';
}

const INTERNAL_CONSTANT = 'internal';
`);

      // File with only imports and side effects
      addMockFile('/no-exports/src/side-effects.ts', `
import './internal';

console.log('Side effect executed');

// Global modification
(window as any).customProperty = 'value';
`);

      const index = await validator.buildIndex('/no-exports/src', {
        includePrivate: false // Default setting
      });

      // Should not include non-exported symbols by default
      expect(index.byName.has('internalFunction')).toBe(false);
      expect(index.byName.has('InternalClass')).toBe(false);
      expect(index.stats.totalFiles).toBe(2);

      // Test with includePrivate: true
      const privateIndex = await validator.buildIndex('/no-exports/src', {
        includePrivate: true
      });

      expect(privateIndex.byName.has('internalFunction')).toBe(true);
      expect(privateIndex.byName.has('InternalClass')).toBe(true);
      expect(privateIndex.stats.totalSymbols).toBeGreaterThan(0);
    });
  });

  describe('performance characteristics', () => {
    it('should handle reasonable performance with many files', async () => {
      // Create a project with many small files
      const fileCount = 50;
      addMockDirectory('/performance-test/src');

      for (let i = 0; i < fileCount; i++) {
        addMockFile(`/performance-test/src/file${i}.ts`, `
export function func${i}(): string {
  return 'result${i}';
}

export class Class${i} {
  public method${i}(): number {
    return ${i};
  }
}

export interface Interface${i} {
  prop${i}: string;
}
`);
      }

      const startTime = Date.now();
      const index = await validator.buildIndex('/performance-test/src');
      const buildTime = Date.now() - startTime;

      expect(index.stats.totalFiles).toBe(fileCount);
      expect(index.stats.totalSymbols).toBeGreaterThan(fileCount * 2); // At least 3 symbols per file
      expect(buildTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle many documentation references efficiently', async () => {
      // Setup project with symbols
      addMockDirectory('/ref-performance/src');
      addMockFile('/ref-performance/src/index.ts', `
export function targetFunction(): void {}
export class TargetClass {}
export interface TargetInterface { prop: string; }
`);

      const index = await validator.buildIndex('/ref-performance/src');

      // Create documentation with many references
      const referenceCount = 100;
      const references = [];

      for (let i = 0; i < referenceCount; i++) {
        references.push({
          symbolName: i % 3 === 0 ? 'targetFunction' : i % 3 === 1 ? 'TargetClass' : 'TargetInterface',
          referenceType: 'inline-code' as const,
          sourceFile: `/ref-performance/docs/file${Math.floor(i / 10)}.md`,
          line: (i % 10) + 1,
          column: 1,
          context: `Reference ${i} to symbol`
        });
      }

      const startTime = Date.now();
      const brokenLinks = validator.validateDocumentationReferences(index, references);
      const validateTime = Date.now() - startTime;

      expect(brokenLinks).toHaveLength(0); // All references should be valid
      expect(validateTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });
});