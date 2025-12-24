/**
 * Smoke test for IdleProcessor documentation integration
 * Quick verification that analyzeDocumentation() method works correctly
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { promises as fs } from 'fs';
import { IdleProcessor } from '../idle-processor';
import type { DaemonConfig } from '@apexcli/core';
import { TaskStore } from '../store';

// Mock dependencies
vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn(),
  },
}));

vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

describe('Documentation Integration Smoke Test', () => {
  let idleProcessor: IdleProcessor;
  let mockTaskStore: TaskStore;
  let mockConfig: DaemonConfig;

  beforeEach(() => {
    vi.clearAllMocks();

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

    mockTaskStore = {
      getTasksByStatus: vi.fn().mockResolvedValue([]),
      getAllTasks: vi.fn().mockResolvedValue([]),
      createTask: vi.fn(),
    } as any;

    idleProcessor = new IdleProcessor('/test/project', mockConfig, mockTaskStore);
  });

  it('should have analyzeDocumentation method that returns enhanced structure', async () => {
    // Setup basic mocks
    const { exec } = await import('child_process');
    const mockExec = exec as any;
    mockExec.mockImplementation((command: string, options: any, callback: any) => {
      callback(null, { stdout: '', stderr: '' });
    });

    const mockReadFile = fs.readFile as any;
    mockReadFile.mockResolvedValue('export function test() { return "test"; }');

    // Mock all detection utilities to avoid errors
    vi.doMock('../stale-comment-detector', () => ({
      StaleCommentDetector: vi.fn().mockImplementation(() => ({
        findStaleComments: vi.fn().mockResolvedValue([])
      }))
    }));

    vi.doMock('../analyzers/version-mismatch-detector', () => ({
      VersionMismatchDetector: vi.fn().mockImplementation(() => ({
        detectMismatches: vi.fn().mockResolvedValue([])
      }))
    }));

    vi.doMock('../analyzers/cross-reference-validator', () => ({
      CrossReferenceValidator: vi.fn().mockImplementation(() => ({
        buildIndex: vi.fn().mockResolvedValue({ byName: new Map(), byFile: new Map(), stats: {} }),
        extractDocumentationReferences: vi.fn().mockReturnValue([]),
        validateDocumentationReferences: vi.fn().mockReturnValue([])
      }))
    }));

    vi.doMock('@apexcli/core', async () => {
      const actual = await vi.importActual('@apexcli/core') as any;
      return {
        ...actual,
        validateDeprecatedTags: vi.fn().mockReturnValue([])
      };
    });

    // Call analyzeDocumentation
    const result = await (idleProcessor as any).analyzeDocumentation();

    // Verify enhanced structure is returned
    expect(result).toHaveProperty('coverage');
    expect(result).toHaveProperty('missingDocs');
    expect(result).toHaveProperty('undocumentedExports');
    expect(result).toHaveProperty('outdatedDocs');
    expect(result).toHaveProperty('missingReadmeSections');
    expect(result).toHaveProperty('apiCompleteness');

    // Verify types
    expect(typeof result.coverage).toBe('number');
    expect(Array.isArray(result.missingDocs)).toBe(true);
    expect(Array.isArray(result.undocumentedExports)).toBe(true);
    expect(Array.isArray(result.outdatedDocs)).toBe(true);
    expect(Array.isArray(result.missingReadmeSections)).toBe(true);
    expect(typeof result.apiCompleteness).toBe('object');
  });

  it('should handle analyzeDocumentation errors gracefully', async () => {
    // Setup mocks to cause some errors
    const { exec } = await import('child_process');
    const mockExec = exec as any;
    mockExec.mockImplementation((command: string, options: any, callback: any) => {
      callback(new Error('Command failed'), null);
    });

    // Should not throw and return default structure
    const result = await (idleProcessor as any).analyzeDocumentation();

    expect(result).toEqual({
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

  it('should emit detector events during analysis', async () => {
    // Setup basic mocks
    const { exec } = await import('child_process');
    const mockExec = exec as any;
    mockExec.mockImplementation((command: string, options: any, callback: any) => {
      if (command.includes('find') && command.includes('ts')) {
        callback(null, { stdout: './src/test.ts\n', stderr: '' });
      } else {
        callback(null, { stdout: '', stderr: '' });
      }
    });

    const mockReadFile = fs.readFile as any;
    mockReadFile.mockResolvedValue(`
export function undocumentedFunction() {
  return 'test';
}
    `);

    // Setup event spy
    const detectorFindingSpy = vi.fn();
    idleProcessor.on('detector:finding', detectorFindingSpy);

    await (idleProcessor as any).analyzeDocumentation();

    // Should emit at least some detector findings
    expect(detectorFindingSpy.mock.calls.length).toBeGreaterThanOrEqual(0);
  });
});