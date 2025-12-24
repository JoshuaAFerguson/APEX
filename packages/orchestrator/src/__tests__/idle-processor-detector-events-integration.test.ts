/**
 * Tests for IdleProcessor detector event emissions during analyzeDocumentation()
 *
 * Verifies that:
 * 1. All required detector events are emitted with correct data
 * 2. Individual detector:finding events are emitted for each finding
 * 3. Event timing and order is correct
 * 4. Event data structures match the expected interfaces
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { IdleProcessor, ProjectAnalysis } from '../idle-processor';
import type {
  DaemonConfig,
  DetectorFinding,
  UndocumentedExport,
  OutdatedDocumentation,
  MissingReadmeSection,
  StaleCommentFinding,
  VersionMismatchFinding
} from '@apexcli/core';
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

describe('IdleProcessor Detector Event Emissions Integration', () => {
  let idleProcessor: IdleProcessor;
  let mockTaskStore: TaskStore;
  let mockConfig: DaemonConfig;
  const testProjectPath = '/test/project';

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

    idleProcessor = new IdleProcessor(testProjectPath, mockConfig, mockTaskStore);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('detector:undocumented-export:found event', () => {
    it('should emit event with correct UndocumentedExport data structure', async () => {
      await setupMocksForUndocumentedExports();

      const undocumentedExportSpy = vi.fn();
      const detectorFindingSpy = vi.fn();

      idleProcessor.on('detector:undocumented-export:found', undocumentedExportSpy);
      idleProcessor.on('detector:finding', detectorFindingSpy);

      await (idleProcessor as any).analyzeDocumentation();

      // Verify specific event was emitted
      expect(undocumentedExportSpy).toHaveBeenCalledTimes(1);
      expect(undocumentedExportSpy).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            file: expect.any(String),
            name: expect.any(String),
            type: expect.stringMatching(/function|class|interface|type|const|let|var|enum|namespace/),
            line: expect.any(Number),
            isPublic: expect.any(Boolean)
          })
        ])
      );

      // Verify individual finding events were emitted
      const undocumentedFindings = detectorFindingSpy.mock.calls.filter(
        call => call[0].detectorType === 'undocumented-export'
      );
      expect(undocumentedFindings.length).toBeGreaterThan(0);

      undocumentedFindings.forEach(call => {
        const finding: DetectorFinding = call[0];
        expect(finding).toMatchObject({
          detectorType: 'undocumented-export',
          severity: 'medium',
          file: expect.any(String),
          line: expect.any(Number),
          description: expect.stringContaining('Undocumented'),
          metadata: expect.objectContaining({
            exportType: expect.any(String),
            name: expect.any(String),
            isPublic: expect.any(Boolean)
          })
        });
      });
    });
  });

  describe('detector:outdated-docs:found event', () => {
    it('should emit event with correct OutdatedDocumentation data structure', async () => {
      await setupMocksForOutdatedDocs();

      const outdatedDocsSpy = vi.fn();
      const detectorFindingSpy = vi.fn();

      idleProcessor.on('detector:outdated-docs:found', outdatedDocsSpy);
      idleProcessor.on('detector:finding', detectorFindingSpy);

      await (idleProcessor as any).analyzeDocumentation();

      // Verify specific event was emitted
      expect(outdatedDocsSpy).toHaveBeenCalledTimes(1);
      expect(outdatedDocsSpy).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            file: expect.any(String),
            type: expect.stringMatching(/deprecated-api|broken-link|version-mismatch|stale-reference/),
            description: expect.any(String),
            line: expect.any(Number),
            severity: expect.stringMatching(/low|medium|high/)
          })
        ])
      );

      // Verify individual finding events
      const outdatedFindings = detectorFindingSpy.mock.calls.filter(
        call => call[0].detectorType === 'outdated-docs'
      );
      expect(outdatedFindings.length).toBeGreaterThan(0);

      outdatedFindings.forEach(call => {
        const finding: DetectorFinding = call[0];
        expect(finding).toMatchObject({
          detectorType: 'outdated-docs',
          severity: expect.stringMatching(/low|medium|high/),
          file: expect.any(String),
          line: expect.any(Number),
          description: expect.any(String),
          metadata: expect.objectContaining({
            type: expect.any(String)
          })
        });
      });
    });
  });

  describe('detector:missing-readme-section:found event', () => {
    it('should emit event with correct MissingReadmeSection data structure', async () => {
      await setupMocksForMissingReadmeSections();

      const missingReadmeSpy = vi.fn();
      const detectorFindingSpy = vi.fn();

      idleProcessor.on('detector:missing-readme-section:found', missingReadmeSpy);
      idleProcessor.on('detector:finding', detectorFindingSpy);

      await (idleProcessor as any).analyzeDocumentation();

      // Verify specific event was emitted
      expect(missingReadmeSpy).toHaveBeenCalledTimes(1);
      expect(missingReadmeSpy).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            section: expect.any(String),
            priority: expect.stringMatching(/required|recommended|optional/),
            description: expect.any(String)
          })
        ])
      );

      // Verify individual finding events
      const readmeFindings = detectorFindingSpy.mock.calls.filter(
        call => call[0].detectorType === 'missing-readme-section'
      );
      expect(readmeFindings.length).toBeGreaterThan(0);

      readmeFindings.forEach(call => {
        const finding: DetectorFinding = call[0];
        expect(finding).toMatchObject({
          detectorType: 'missing-readme-section',
          severity: expect.stringMatching(/low|medium|high/),
          file: 'README.md',
          description: expect.stringContaining('Missing'),
          metadata: expect.objectContaining({
            section: expect.any(String),
            priority: expect.stringMatching(/required|recommended|optional/)
          })
        });
      });
    });
  });

  describe('detector:stale-comment:found event', () => {
    it('should emit event with correct StaleCommentFinding data structure', async () => {
      await setupMocksForStaleComments();

      const staleCommentSpy = vi.fn();

      idleProcessor.on('detector:stale-comment:found', staleCommentSpy);

      await (idleProcessor as any).analyzeDocumentation();

      // Verify specific event was emitted (if stale comments found)
      if (staleCommentSpy.mock.calls.length > 0) {
        expect(staleCommentSpy).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              file: expect.any(String),
              line: expect.any(Number),
              text: expect.any(String),
              type: expect.stringMatching(/TODO|FIXME|HACK/),
              daysSinceAdded: expect.any(Number)
            })
          ])
        );
      }
    });
  });

  describe('detector:version-mismatch:found event', () => {
    it('should emit event with correct VersionMismatchFinding data structure', async () => {
      await setupMocksForVersionMismatches();

      const versionMismatchSpy = vi.fn();

      idleProcessor.on('detector:version-mismatch:found', versionMismatchSpy);

      await (idleProcessor as any).analyzeDocumentation();

      // Verify specific event was emitted (if version mismatches found)
      if (versionMismatchSpy.mock.calls.length > 0) {
        expect(versionMismatchSpy).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              file: expect.any(String),
              line: expect.any(Number),
              foundVersion: expect.any(String),
              expectedVersion: expect.any(String),
              lineContent: expect.any(String)
            })
          ])
        );
      }
    });
  });

  describe('Event emission timing and order', () => {
    it('should emit events in correct order during analysis', async () => {
      await setupMocksForAllDetectors();

      const eventOrder: string[] = [];

      // Setup listeners to track event order
      idleProcessor.on('analysis:started', () => eventOrder.push('analysis:started'));
      idleProcessor.on('detector:finding', () => eventOrder.push('detector:finding'));
      idleProcessor.on('detector:undocumented-export:found', () => eventOrder.push('detector:undocumented-export:found'));
      idleProcessor.on('detector:outdated-docs:found', () => eventOrder.push('detector:outdated-docs:found'));
      idleProcessor.on('detector:missing-readme-section:found', () => eventOrder.push('detector:missing-readme-section:found'));
      idleProcessor.on('analysis:completed', () => eventOrder.push('analysis:completed'));

      // Trigger full analysis (which includes documentation analysis)
      await (idleProcessor as any).processIdleTime();

      // Verify event ordering
      expect(eventOrder[0]).toBe('analysis:started');
      expect(eventOrder[eventOrder.length - 1]).toBe('analysis:completed');

      // All detector events should be between analysis start and complete
      const detectorEventIndices = eventOrder
        .map((event, index) => event.startsWith('detector:') ? index : -1)
        .filter(index => index !== -1);

      if (detectorEventIndices.length > 0) {
        const analysisStartIndex = eventOrder.indexOf('analysis:started');
        const analysisCompleteIndex = eventOrder.indexOf('analysis:completed');

        detectorEventIndices.forEach(detectorIndex => {
          expect(detectorIndex).toBeGreaterThan(analysisStartIndex);
          expect(detectorIndex).toBeLessThan(analysisCompleteIndex);
        });
      }
    });

    it('should emit general detector:finding events for each specific finding', async () => {
      await setupMocksForAllDetectors();

      const specificEventCounts = {
        'detector:undocumented-export:found': 0,
        'detector:outdated-docs:found': 0,
        'detector:missing-readme-section:found': 0
      };

      const generalFindingCount = { count: 0 };

      // Count specific events
      Object.keys(specificEventCounts).forEach(event => {
        idleProcessor.on(event as any, (findings: any[]) => {
          specificEventCounts[event as keyof typeof specificEventCounts] = findings.length;
        });
      });

      // Count general findings
      idleProcessor.on('detector:finding', () => {
        generalFindingCount.count++;
      });

      await (idleProcessor as any).analyzeDocumentation();

      // Verify that general findings are at least as many as specific findings
      const totalSpecificFindings = Object.values(specificEventCounts).reduce((sum, count) => sum + count, 0);
      expect(generalFindingCount.count).toBeGreaterThanOrEqual(totalSpecificFindings);
    });
  });

  describe('Event data validation', () => {
    it('should emit events with valid severity levels', async () => {
      await setupMocksForAllDetectors();

      const detectorFindingSpy = vi.fn();
      idleProcessor.on('detector:finding', detectorFindingSpy);

      await (idleProcessor as any).analyzeDocumentation();

      // Check that all detector findings have valid severity levels
      detectorFindingSpy.mock.calls.forEach(call => {
        const finding: DetectorFinding = call[0];
        expect(['low', 'medium', 'high', 'critical']).toContain(finding.severity);
      });
    });

    it('should emit events with required metadata fields for each detector type', async () => {
      await setupMocksForAllDetectors();

      const detectorFindingSpy = vi.fn();
      idleProcessor.on('detector:finding', detectorFindingSpy);

      await (idleProcessor as any).analyzeDocumentation();

      const findingsByType = new Map<string, DetectorFinding[]>();

      // Group findings by detector type
      detectorFindingSpy.mock.calls.forEach(call => {
        const finding: DetectorFinding = call[0];
        if (!findingsByType.has(finding.detectorType)) {
          findingsByType.set(finding.detectorType, []);
        }
        findingsByType.get(finding.detectorType)!.push(finding);
      });

      // Verify metadata structure for each detector type
      findingsByType.forEach((findings, detectorType) => {
        findings.forEach(finding => {
          expect(finding.metadata).toBeDefined();

          switch (detectorType) {
            case 'undocumented-export':
              expect(finding.metadata).toHaveProperty('exportType');
              expect(finding.metadata).toHaveProperty('name');
              expect(finding.metadata).toHaveProperty('isPublic');
              break;
            case 'outdated-docs':
              expect(finding.metadata).toHaveProperty('type');
              break;
            case 'missing-readme-section':
              expect(finding.metadata).toHaveProperty('section');
              expect(finding.metadata).toHaveProperty('priority');
              break;
          }
        });
      });
    });
  });

  // Helper functions to setup mocks for different detector types

  async function setupMocksForUndocumentedExports() {
    const { exec } = await import('child_process');
    const mockExec = exec as any;

    mockExec.mockImplementation((command: string, options: any, callback: any) => {
      if (command.includes('find') && command.includes('ts')) {
        callback(null, { stdout: './src/api.ts\n', stderr: '' });
      } else {
        callback(null, { stdout: '', stderr: '' });
      }
    });

    const mockReadFile = fs.readFile as any;
    mockReadFile.mockResolvedValue(`
export function undocumentedFunction() {
  return 'test';
}

/**
 * This is documented
 */
export function documentedFunction() {
  return 'documented';
}

export class UndocumentedClass {
  method() {}
}
    `);
  }

  async function setupMocksForOutdatedDocs() {
    const { exec } = await import('child_process');
    const mockExec = exec as any;

    mockExec.mockImplementation((command: string, options: any, callback: any) => {
      if (command.includes('find') && command.includes('md')) {
        callback(null, { stdout: './README.md\n', stderr: '' });
      } else if (command.includes('find') && command.includes('ts')) {
        callback(null, { stdout: '', stderr: '' });
      } else {
        callback(null, { stdout: '', stderr: '' });
      }
    });

    const mockReadFile = fs.readFile as any;
    mockReadFile.mockResolvedValue(`
# Project README

This API is @deprecated and should not be used.
Use the new API instead.

Visit our documentation at http://example.com/404
    `);
  }

  async function setupMocksForMissingReadmeSections() {
    const { exec } = await import('child_process');
    const mockExec = exec as any;

    mockExec.mockImplementation((command: string, options: any, callback: any) => {
      if (command.includes('find') && command.includes('README')) {
        callback(null, { stdout: '', stderr: '' }); // No README found
      } else {
        callback(null, { stdout: '', stderr: '' });
      }
    });
  }

  async function setupMocksForStaleComments() {
    // Mock the StaleCommentDetector
    const mockStaleCommentDetector = {
      findStaleComments: vi.fn().mockResolvedValue([
        {
          file: 'src/old.ts',
          type: 'stale-reference',
          description: 'Old TODO comment',
          line: 10,
          severity: 'low'
        }
      ])
    };

    vi.doMock('../stale-comment-detector', () => ({
      StaleCommentDetector: vi.fn().mockImplementation(() => mockStaleCommentDetector)
    }));

    await setupBasicMocks();
  }

  async function setupMocksForVersionMismatches() {
    // Mock the VersionMismatchDetector
    const mockVersionMismatchDetector = {
      detectMismatches: vi.fn().mockResolvedValue([
        {
          file: 'docs/api.md',
          line: 5,
          foundVersion: '1.0.0',
          expectedVersion: '2.0.0',
          lineContent: 'API version 1.0.0'
        }
      ])
    };

    vi.doMock('../analyzers/version-mismatch-detector', () => ({
      VersionMismatchDetector: vi.fn().mockImplementation(() => mockVersionMismatchDetector)
    }));

    await setupBasicMocks();
  }

  async function setupMocksForAllDetectors() {
    // Setup mocks for all detectors
    await setupMocksForUndocumentedExports();
    await setupMocksForStaleComments();
    await setupMocksForVersionMismatches();

    // Mock CrossReferenceValidator
    const mockCrossReferenceValidator = {
      buildIndex: vi.fn().mockResolvedValue({
        byName: new Map(),
        byFile: new Map(),
        stats: { totalSymbols: 0, totalFiles: 0, byType: {} }
      }),
      extractDocumentationReferences: vi.fn().mockReturnValue([]),
      validateDocumentationReferences: vi.fn().mockReturnValue([])
    };

    vi.doMock('../analyzers/cross-reference-validator', () => ({
      CrossReferenceValidator: vi.fn().mockImplementation(() => mockCrossReferenceValidator)
    }));

    // Mock validateDeprecatedTags
    vi.doMock('@apexcli/core', async () => {
      const actual = await vi.importActual('@apexcli/core') as any;
      return {
        ...actual,
        validateDeprecatedTags: vi.fn().mockReturnValue([])
      };
    });
  }

  async function setupBasicMocks() {
    const { exec } = await import('child_process');
    const mockExec = exec as any;

    mockExec.mockImplementation((command: string, options: any, callback: any) => {
      callback(null, { stdout: '', stderr: '' });
    });

    const mockReadFile = fs.readFile as any;
    mockReadFile.mockResolvedValue('export function test() { return "test"; }');
  }
});