/**
 * Tests for Enhanced Documentation Analysis Methods in IdleProcessor
 *
 * Tests the new utility methods added to IdleProcessor for enhanced
 * documentation analysis: findUndocumentedExports, findOutdatedDocumentation,
 * findMissingReadmeSections, and analyzeAPICompleteness
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { IdleProcessor } from './idle-processor';
import type { DaemonConfig } from '@apexcli/core';
import { TaskStore } from './store';

// Mock the filesystem operations
vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn(),
  },
}));

// Mock child_process.exec
vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

describe('IdleProcessor Enhanced Documentation Analysis', () => {
  let idleProcessor: IdleProcessor;
  let mockTaskStore: TaskStore;
  let mockConfig: DaemonConfig;
  const testProjectPath = '/test/project';

  beforeEach(() => {
    // Setup mocks
    vi.clearAllMocks();

    // Mock config with idle processing enabled
    mockConfig = {
      pollInterval: 5000,
      autoStart: false,
      logLevel: 'info',
      idleProcessing: {
        enabled: true,
        idleThreshold: 300000,
        taskGenerationInterval: 3600000,
        maxIdleTasks: 3
      }
    };

    // Mock TaskStore
    mockTaskStore = {
      getTasksByStatus: vi.fn().mockResolvedValue([]),
      getAllTasks: vi.fn().mockResolvedValue([]),
      createTask: vi.fn(),
    } as any;

    idleProcessor = new IdleProcessor(testProjectPath, mockConfig, mockTaskStore);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================================
  // findUndocumentedExports Tests
  // ============================================================================

  describe('findUndocumentedExports', () => {
    it('should find exports without JSDoc comments', async () => {
      // Mock exec for finding source files
      const { exec } = await import('child_process');
      const mockExec = exec as any;

      // Mock file finding
      mockExec.mockImplementationOnce((command: string, options: any, callback: any) => {
        if (command.includes('find')) {
          callback(null, { stdout: './src/utils.ts\n./src/api.ts\n', stderr: '' });
        }
      });

      // Mock file reading
      const mockReadFile = fs.readFile as any;
      mockReadFile
        .mockResolvedValueOnce(`
// utils.ts content
export function documentedFunction() {
  return 'test';
}

/**
 * This function has JSDoc
 */
export function hasJSDoc() {
  return 'documented';
}

export class UndocumentedClass {
  method() {}
}

export interface UndocumentedInterface {
  prop: string;
}
        `)
        .mockResolvedValueOnce(`
// api.ts content
/**
 * This is documented
 */
export const DOCUMENTED_CONST = 'value';

export function undocumentedApiFunction() {
  return 'no docs';
}
        `);

      // Call the private method using type assertion to access it
      const processor = idleProcessor as any;
      const undocumentedExports = await processor.findUndocumentedExports();

      expect(undocumentedExports).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            file: 'src/utils.ts',
            name: 'documentedFunction',
            type: 'function',
            line: 3,
            isPublic: true
          }),
          expect.objectContaining({
            file: 'src/utils.ts',
            name: 'UndocumentedClass',
            type: 'class',
            line: 11,
            isPublic: true
          }),
          expect.objectContaining({
            file: 'src/utils.ts',
            name: 'UndocumentedInterface',
            type: 'interface',
            line: 15,
            isPublic: true
          }),
          expect.objectContaining({
            file: 'src/api.ts',
            name: 'undocumentedApiFunction',
            type: 'function',
            line: 7,
            isPublic: true
          })
        ])
      );

      // Should not include the documented function
      const documentedExport = undocumentedExports.find(
        (e: any) => e.name === 'hasJSDoc'
      );
      expect(documentedExport).toBeUndefined();

      const documentedConst = undocumentedExports.find(
        (e: any) => e.name === 'DOCUMENTED_CONST'
      );
      expect(documentedConst).toBeUndefined();
    });

    it('should handle files with no exports', async () => {
      const { exec } = await import('child_process');
      const mockExec = exec as any;

      mockExec.mockImplementationOnce((command: string, options: any, callback: any) => {
        callback(null, { stdout: './src/empty.ts\n', stderr: '' });
      });

      const mockReadFile = fs.readFile as any;
      mockReadFile.mockResolvedValueOnce(`
// Empty file with no exports
const localVariable = 'not exported';

function internalFunction() {
  return 'internal';
}
      `);

      const processor = idleProcessor as any;
      const undocumentedExports = await processor.findUndocumentedExports();

      expect(undocumentedExports).toEqual([]);
    });

    it('should detect public vs private exports', async () => {
      const { exec } = await import('child_process');
      const mockExec = exec as any;

      mockExec.mockImplementationOnce((command: string, options: any, callback: any) => {
        callback(null, { stdout: './src/internal/private.ts\n', stderr: '' });
      });

      const mockReadFile = fs.readFile as any;
      mockReadFile.mockResolvedValueOnce(`
// Internal file
export function _internalFunction() {
  return 'internal';
}

export function publicFunction() {
  return 'public';
}
      `);

      const processor = idleProcessor as any;
      const undocumentedExports = await processor.findUndocumentedExports();

      const internalExport = undocumentedExports.find((e: any) => e.name === '_internalFunction');
      const publicExport = undocumentedExports.find((e: any) => e.name === 'publicFunction');

      expect(internalExport?.isPublic).toBe(false);
      expect(publicExport?.isPublic).toBe(true);
    });

    it('should handle different export syntax patterns', async () => {
      const { exec } = await import('child_process');
      const mockExec = exec as any;

      mockExec.mockImplementationOnce((command: string, options: any, callback: any) => {
        callback(null, { stdout: './src/exports.ts\n', stderr: '' });
      });

      const mockReadFile = fs.readFile as any;
      mockReadFile.mockResolvedValueOnce(`
export function namedFunction() {}
export const namedConst = 'value';
export let namedLet = 'value';
export var namedVar = 'value';
export class NamedClass {}
export interface NamedInterface {}
export type NamedType = string;
export enum NamedEnum { A, B }
export namespace NamedNamespace {}
      `);

      const processor = idleProcessor as any;
      const undocumentedExports = await processor.findUndocumentedExports();

      expect(undocumentedExports).toHaveLength(9);

      const exportTypes = undocumentedExports.map((e: any) => e.type);
      expect(exportTypes).toContain('function');
      expect(exportTypes).toContain('const');
      expect(exportTypes).toContain('let');
      expect(exportTypes).toContain('var');
      expect(exportTypes).toContain('class');
      expect(exportTypes).toContain('interface');
      expect(exportTypes).toContain('type');
      expect(exportTypes).toContain('enum');
      expect(exportTypes).toContain('namespace');
    });
  });

  // ============================================================================
  // findOutdatedDocumentation Tests
  // ============================================================================

  describe('findOutdatedDocumentation', () => {
    it('should detect deprecated API references', async () => {
      const { exec } = await import('child_process');
      const mockExec = exec as any;

      mockExec.mockImplementationOnce((command: string, options: any, callback: any) => {
        callback(null, { stdout: './README.md\n./docs/api.md\n', stderr: '' });
      });

      const mockReadFile = fs.readFile as any;
      mockReadFile
        .mockResolvedValueOnce(`
# Project README

This API is @deprecated and should not be used.
Use the new API instead.

Some other content here.
        `)
        .mockResolvedValueOnce(`
# API Documentation

The following method is DEPRECATED:
- oldMethod(): use newMethod() instead

Current version: v1.2.3
        `);

      const processor = idleProcessor as any;
      const outdatedDocs = await processor.findOutdatedDocumentation();

      expect(outdatedDocs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            file: 'README.md',
            type: 'deprecated-api',
            description: 'Contains references to deprecated APIs',
            line: 4,
            severity: 'medium'
          }),
          expect.objectContaining({
            file: 'docs/api.md',
            type: 'deprecated-api',
            description: 'Contains references to deprecated APIs',
            line: 4,
            severity: 'medium'
          })
        ])
      );
    });

    it('should detect version mismatches', async () => {
      const { exec } = await import('child_process');
      const mockExec = exec as any;

      mockExec.mockImplementationOnce((command: string, options: any, callback: any) => {
        callback(null, { stdout: './CHANGELOG.md\n', stderr: '' });
      });

      const mockReadFile = fs.readFile as any;
      mockReadFile.mockResolvedValueOnce(`
# Changelog

## Version 0.1.0
Initial release

## Current version: v0.2.5
Added new features

Version 1.0.0 will include breaking changes.
      `);

      const processor = idleProcessor as any;
      const outdatedDocs = await processor.findOutdatedDocumentation();

      const versionMismatches = outdatedDocs.filter((d: any) => d.type === 'version-mismatch');
      expect(versionMismatches.length).toBeGreaterThan(0);

      expect(versionMismatches).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'version-mismatch',
            severity: 'low',
            suggestion: 'Update to current version'
          })
        ])
      );
    });

    it('should detect broken links', async () => {
      const { exec } = await import('child_process');
      const mockExec = exec as any;

      mockExec.mockImplementationOnce((command: string, options: any, callback: any) => {
        callback(null, { stdout: './docs/links.md\n', stderr: '' });
      });

      const mockReadFile = fs.readFile as any;
      mockReadFile.mockResolvedValueOnce(`
# Documentation

Check out this broken link: http://example.com/404

This link is also broken: https://oldsite.com/broken

Good link: https://example.com/working
      `);

      const processor = idleProcessor as any;
      const outdatedDocs = await processor.findOutdatedDocumentation();

      const brokenLinks = outdatedDocs.filter((d: any) => d.type === 'broken-link');
      expect(brokenLinks.length).toBeGreaterThan(0);

      expect(brokenLinks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            file: 'docs/links.md',
            type: 'broken-link',
            description: 'Potentially broken external link',
            severity: 'low'
          })
        ])
      );
    });
  });

  // ============================================================================
  // findMissingReadmeSections Tests
  // ============================================================================

  describe('findMissingReadmeSections', () => {
    it('should return all required sections when no README exists', async () => {
      const { exec } = await import('child_process');
      const mockExec = exec as any;

      mockExec.mockImplementationOnce((command: string, options: any, callback: any) => {
        callback(null, { stdout: '', stderr: '' });
      });

      const processor = idleProcessor as any;
      const missingReadmeSections = await processor.findMissingReadmeSections();

      expect(missingReadmeSections).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            section: 'title',
            priority: 'required',
            description: 'Project title and brief description'
          }),
          expect.objectContaining({
            section: 'description',
            priority: 'required',
            description: 'Detailed project description'
          }),
          expect.objectContaining({
            section: 'installation',
            priority: 'required',
            description: 'Installation instructions'
          }),
          expect.objectContaining({
            section: 'usage',
            priority: 'required',
            description: 'Usage examples and instructions'
          })
        ])
      );
    });

    it('should identify missing sections in existing README', async () => {
      const { exec } = await import('child_process');
      const mockExec = exec as any;

      mockExec.mockImplementationOnce((command: string, options: any, callback: any) => {
        callback(null, { stdout: './README.md\n', stderr: '' });
      });

      const mockReadFile = fs.readFile as any;
      mockReadFile.mockResolvedValueOnce(`
# My Project

This project does amazing things.

## Usage

Run the following command:
npm start

That's it!
      `);

      const processor = idleProcessor as any;
      const missingReadmeSections = await processor.findMissingReadmeSections();

      const missingSections = missingReadmeSections.map((s: any) => s.section);

      // Should be missing installation, API, contributing, license, testing sections
      expect(missingSections).toContain('installation');
      expect(missingSections).toContain('api');
      expect(missingSections).toContain('contributing');
      expect(missingSections).toContain('license');
      expect(missingSections).toContain('testing');

      // Should NOT be missing usage (it's present)
      expect(missingSections).not.toContain('usage');
    });

    it('should handle comprehensive README with all sections', async () => {
      const { exec } = await import('child_process');
      const mockExec = exec as any;

      mockExec.mockImplementationOnce((command: string, options: any, callback: any) => {
        callback(null, { stdout: './README.md\n', stderr: '' });
      });

      const mockReadFile = fs.readFile as any;
      mockReadFile.mockResolvedValueOnce(`
# Complete Project

Complete description here.

## Installation
npm install

## Usage
How to use this

## API Reference
API documentation

## Contributing
How to contribute

## License
MIT License

## Testing
How to run tests
      `);

      const processor = idleProcessor as any;
      const missingReadmeSections = await processor.findMissingReadmeSections();

      // Should have very few missing sections since most are covered
      expect(missingReadmeSections.length).toBeLessThan(6);

      // Check that present sections are not marked as missing
      const missingSections = missingReadmeSections.map((s: any) => s.section);
      expect(missingSections).not.toContain('installation');
      expect(missingSections).not.toContain('usage');
      expect(missingSections).not.toContain('api');
      expect(missingSections).not.toContain('contributing');
      expect(missingSections).not.toContain('license');
      expect(missingSections).not.toContain('testing');
    });
  });

  // ============================================================================
  // analyzeAPICompleteness Tests
  // ============================================================================

  describe('analyzeAPICompleteness', () => {
    it('should calculate API documentation percentage correctly', async () => {
      const { exec } = await import('child_process');
      const mockExec = exec as any;

      mockExec.mockImplementationOnce((command: string, options: any, callback: any) => {
        callback(null, { stdout: './src/api.ts\n./src/service.ts\n', stderr: '' });
      });

      const mockReadFile = fs.readFile as any;
      mockReadFile
        .mockResolvedValueOnce(`
/**
 * Documented function with JSDoc
 * @param data Input data
 * @returns Processed result
 */
export function documentedFunction(data: any) {
  return data;
}

function undocumentedFunction() {
  return 'no docs';
}

/**
 * Another documented function
 */
async function anotherDocumentedFunction() {
  return 'async';
}
        `)
        .mockResolvedValueOnce(`
export function apiMethod1() {
  return 'no docs';
}

/**
 * Well documented API method
 * @example
 * const result = await apiMethod2();
 */
export function apiMethod2() {
  return 'documented';
}

class UndocumentedClass {
  method() {}
}
        `);

      const processor = idleProcessor as any;
      const apiCompleteness = await processor.analyzeAPICompleteness();

      expect(apiCompleteness.percentage).toBeGreaterThan(0);
      expect(apiCompleteness.percentage).toBeLessThanOrEqual(100);

      // Should have documented and undocumented items
      expect(apiCompleteness.details.totalEndpoints).toBeGreaterThan(0);
      expect(apiCompleteness.details.documentedEndpoints).toBeGreaterThan(0);
      expect(apiCompleteness.details.undocumentedItems.length).toBeGreaterThan(0);

      // Check percentage calculation
      const expectedPercentage = Math.round(
        (apiCompleteness.details.documentedEndpoints /
         apiCompleteness.details.totalEndpoints) * 100
      );
      expect(apiCompleteness.percentage).toBe(expectedPercentage);

      // Should identify well-documented examples
      expect(apiCompleteness.details.wellDocumentedExamples).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/api\.ts.*documentedFunction/),
        ])
      );

      // Should identify common issues
      expect(apiCompleteness.details.commonIssues).toContain('Missing JSDoc comments');
    });

    it('should handle files with no functions', async () => {
      const { exec } = await import('child_process');
      const mockExec = exec as any;

      mockExec.mockImplementationOnce((command: string, options: any, callback: any) => {
        callback(null, { stdout: './src/constants.ts\n', stderr: '' });
      });

      const mockReadFile = fs.readFile as any;
      mockReadFile.mockResolvedValueOnce(`
// Constants file with no functions
export const API_URL = 'https://api.example.com';
export const VERSION = '1.0.0';

// Just constants, no functions to document
      `);

      const processor = idleProcessor as any;
      const apiCompleteness = await processor.analyzeAPICompleteness();

      expect(apiCompleteness.details.totalEndpoints).toBe(0);
      expect(apiCompleteness.details.documentedEndpoints).toBe(0);
      expect(apiCompleteness.percentage).toBe(0);
    });

    it('should identify different types of undocumented items', async () => {
      const { exec } = await import('child_process');
      const mockExec = exec as any;

      mockExec.mockImplementationOnce((command: string, options: any, callback: any) => {
        callback(null, { stdout: './src/mixed.ts\n', stderr: '' });
      });

      const mockReadFile = fs.readFile as any;
      mockReadFile.mockResolvedValueOnce(`
function undocumentedFunction() {}

class UndocumentedClass {
  method() {}
}

export function undocumentedExportedFunction() {}

const undocumentedHandler = () => {};
      `);

      const processor = idleProcessor as any;
      const apiCompleteness = await processor.analyzeAPICompleteness();

      const itemTypes = apiCompleteness.details.undocumentedItems.map((item: any) => item.type);

      expect(itemTypes).toContain('function');
      expect(itemTypes).toContain('class');
    });
  });

  // ============================================================================
  // Integration Tests for analyzeDocumentation
  // ============================================================================

  describe('analyzeDocumentation integration', () => {
    it('should combine all enhanced analysis methods', async () => {
      const { exec } = await import('child_process');
      const mockExec = exec as any;

      // Mock multiple command calls
      mockExec
        .mockImplementationOnce((command: string, options: any, callback: any) => {
          if (command.includes('find') && command.includes('md')) {
            callback(null, { stdout: '2\n', stderr: '' });
          }
        })
        .mockImplementationOnce((command: string, options: any, callback: any) => {
          if (command.includes('find') && command.includes('ts')) {
            callback(null, { stdout: '10\n', stderr: '' });
          }
        })
        .mockImplementationOnce((command: string, options: any, callback: any) => {
          if (command.includes('find') && !command.includes('test')) {
            callback(null, { stdout: './src/main.ts\n./src/utils.ts\n', stderr: '' });
          }
        });

      const processor = idleProcessor as any;
      const documentation = await processor.analyzeDocumentation();

      // Should have all enhanced documentation analysis fields
      expect(documentation).toHaveProperty('coverage');
      expect(documentation).toHaveProperty('missingDocs');
      expect(documentation).toHaveProperty('undocumentedExports');
      expect(documentation).toHaveProperty('outdatedDocs');
      expect(documentation).toHaveProperty('missingReadmeSections');
      expect(documentation).toHaveProperty('apiCompleteness');

      // All fields should be arrays or have the correct structure
      expect(Array.isArray(documentation.undocumentedExports)).toBe(true);
      expect(Array.isArray(documentation.outdatedDocs)).toBe(true);
      expect(Array.isArray(documentation.missingReadmeSections)).toBe(true);
      expect(typeof documentation.apiCompleteness).toBe('object');
      expect(typeof documentation.apiCompleteness.percentage).toBe('number');
      expect(typeof documentation.apiCompleteness.details).toBe('object');
    });

    it('should handle errors gracefully and return default structure', async () => {
      const { exec } = await import('child_process');
      const mockExec = exec as any;

      // Make exec throw errors
      mockExec.mockImplementation((command: string, options: any, callback: any) => {
        callback(new Error('Command failed'), null);
      });

      const processor = idleProcessor as any;
      const documentation = await processor.analyzeDocumentation();

      // Should return default structure even on errors
      expect(documentation).toEqual({
        coverage: 0,
        missingDocs: [],
        undocumentedExports: [],
        outdatedDocs: [],
        missingReadmeSections: [],
        apiCompleteness: {
          percentage: 0,
          details: {
            totalEndpoints: 0,
            documentedEndpoints: 0,
            undocumentedItems: [],
            wellDocumentedExamples: [],
            commonIssues: []
          }
        }
      });
    });
  });
});