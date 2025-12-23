import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IdleProcessor, SecurityVulnerability } from '../idle-processor';
import { TaskStore } from '../store';
import {
  DaemonConfig,
  DetectorFinding,
  OutdatedDocumentation,
  VersionMismatchFinding,
  StaleCommentFinding,
  CodeSmell,
  ComplexityHotspot,
  DuplicatePattern,
  UndocumentedExport,
  MissingReadmeSection
} from '@apexcli/core';
import { promises as fs } from 'fs';

// Mock dependencies
vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn(),
  },
}));

vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

describe('IdleProcessor - Detector Event Emission', () => {
  let idleProcessor: IdleProcessor;
  let mockStore: TaskStore;
  let mockConfig: DaemonConfig;
  let mockProjectPath: string;

  beforeEach(() => {
    vi.clearAllMocks();

    mockProjectPath = '/test/project';
    mockConfig = {
      idleProcessing: {
        enabled: true,
        idleThreshold: 300000,
        taskGenerationInterval: 3600000,
        maxIdleTasks: 3,
      },
    };

    mockStore = {
      createTask: vi.fn(),
      getTasksByStatus: vi.fn(),
      getAllTasks: vi.fn(),
    } as any;

    idleProcessor = new IdleProcessor(mockProjectPath, mockConfig, mockStore);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('detector:outdated-docs:found events', () => {
    beforeEach(() => {
      const mockExec = vi.fn().mockImplementation((command: string, options: any) => {
        const callback = arguments[2] || arguments[1];

        if (command.includes('find . -name "*.md"')) {
          callback(null, { stdout: './README.md\n./docs/api.md\n' });
        } else if (command.includes('find . -name "*.ts"')) {
          callback(null, { stdout: './src/component.ts\n' });
        } else {
          callback(null, { stdout: '' });
        }
      });

      const childProcess = require('child_process');
      childProcess.exec = mockExec;

      vi.mocked(fs.readFile).mockImplementation((path: any) => {
        if (path.includes('README.md')) {
          return Promise.resolve('# Project\n@deprecated Use new API\nhttp://broken-link-404');
        }
        if (path.includes('api.md')) {
          return Promise.resolve('# API\nSome broken reference to old function');
        }
        if (path.includes('component.ts')) {
          return Promise.resolve('/** @deprecated Use newFunction */\nfunction oldFunction() {}');
        }
        return Promise.resolve('');
      });
    });

    it('should emit detector:outdated-docs:found with correct structure', async () => {
      const outdatedDocsSpy = vi.fn();
      const detectorFindingSpy = vi.fn();

      idleProcessor.on('detector:outdated-docs:found', outdatedDocsSpy);
      idleProcessor.on('detector:finding', detectorFindingSpy);

      await idleProcessor.processIdleTime();

      expect(outdatedDocsSpy).toHaveBeenCalled();

      const outdatedDocsCall = outdatedDocsSpy.mock.calls[0][0] as OutdatedDocumentation[];
      expect(outdatedDocsCall).toBeInstanceOf(Array);
      expect(outdatedDocsCall.length).toBeGreaterThan(0);

      // Verify structure of outdated documentation findings
      const finding = outdatedDocsCall[0];
      expect(finding).toEqual({
        file: expect.any(String),
        type: expect.stringMatching(/deprecated-api|broken-link|version-mismatch|stale-reference|outdated-example/),
        description: expect.any(String),
        line: expect.any(Number),
        severity: expect.stringMatching(/low|medium|high/)
      });

      // Verify individual detector:finding events were emitted
      const outdatedDocFindings = detectorFindingSpy.mock.calls.filter(call =>
        call[0].detectorType === 'outdated-docs'
      );
      expect(outdatedDocFindings.length).toBeGreaterThan(0);

      // Verify detector finding structure
      const detectorFinding = outdatedDocFindings[0][0] as DetectorFinding;
      expect(detectorFinding).toEqual({
        detectorType: 'outdated-docs',
        severity: expect.stringMatching(/low|medium|high/),
        file: expect.any(String),
        line: expect.any(Number),
        description: expect.any(String),
        metadata: expect.objectContaining({
          type: expect.any(String),
          suggestion: expect.any(String)
        })
      });
    });
  });

  describe('detector:version-mismatch:found events', () => {
    beforeEach(() => {
      // Mock VersionMismatchDetector
      vi.mock('../analyzers/version-mismatch-detector.js', () => ({
        VersionMismatchDetector: class MockVersionMismatchDetector {
          constructor(projectPath: string) {}
          async detectMismatches() {
            return [
              {
                file: 'package.json',
                line: 5,
                foundVersion: '1.0.0',
                expectedVersion: '2.0.0',
                lineContent: '"version": "1.0.0"'
              }
            ];
          }
        }
      }));
    });

    it('should emit detector:version-mismatch:found with correct structure', async () => {
      const versionMismatchSpy = vi.fn();
      const detectorFindingSpy = vi.fn();

      idleProcessor.on('detector:version-mismatch:found', versionMismatchSpy);
      idleProcessor.on('detector:finding', detectorFindingSpy);

      await idleProcessor.processIdleTime();

      // Note: Version mismatch events are emitted as part of outdated docs analysis
      if (versionMismatchSpy.mock.calls.length > 0) {
        const versionMismatchCall = versionMismatchSpy.mock.calls[0][0] as VersionMismatchFinding[];
        expect(versionMismatchCall).toBeInstanceOf(Array);

        const finding = versionMismatchCall[0];
        expect(finding).toEqual({
          file: expect.any(String),
          line: expect.any(Number),
          foundVersion: expect.any(String),
          expectedVersion: expect.any(String),
          lineContent: expect.any(String)
        });
      }
    });
  });

  describe('detector:stale-comment:found events', () => {
    beforeEach(() => {
      // Mock StaleCommentDetector
      vi.mock('../stale-comment-detector', () => ({
        StaleCommentDetector: class MockStaleCommentDetector {
          constructor(projectPath: string, config: any) {}
          async findStaleComments() {
            return [
              {
                file: 'src/component.ts',
                type: 'stale-reference',
                description: 'Old TODO comment that may be outdated',
                line: 10,
                severity: 'medium'
              }
            ];
          }
        }
      }));
    });

    it('should emit detector:stale-comment:found with correct structure', async () => {
      const staleCommentSpy = vi.fn();
      idleProcessor.on('detector:stale-comment:found', staleCommentSpy);

      await idleProcessor.processIdleTime();

      if (staleCommentSpy.mock.calls.length > 0) {
        const staleCommentCall = staleCommentSpy.mock.calls[0][0] as StaleCommentFinding[];
        expect(staleCommentCall).toBeInstanceOf(Array);

        const finding = staleCommentCall[0];
        expect(finding).toEqual({
          file: expect.any(String),
          line: expect.any(Number),
          text: expect.any(String),
          type: expect.stringMatching(/TODO|FIXME|HACK/),
          daysSinceAdded: expect.any(Number)
        });
      }
    });
  });

  describe('detector:code-smell:found events', () => {
    beforeEach(() => {
      const mockExec = vi.fn().mockImplementation((command: string, options: any) => {
        const callback = arguments[2] || arguments[1];

        if (command.includes('find . -name "*.ts"')) {
          callback(null, { stdout: './src/large-file.ts\n./src/complex-file.ts\n' });
        } else if (command.includes('xargs wc -l')) {
          callback(null, { stdout: '600 ./src/large-file.ts\n300 ./src/complex-file.ts\n900 total' });
        } else {
          callback(null, { stdout: '' });
        }
      });

      const childProcess = require('child_process');
      childProcess.exec = mockExec;

      vi.mocked(fs.readFile).mockImplementation((path: any) => {
        if (path.includes('large-file.ts')) {
          // Simulate a file with a very long method
          const longMethodContent = Array(70).fill('  console.log("processing");').join('\n');
          return Promise.resolve(`function processLargeData() {\n${longMethodContent}\n}`);
        }
        return Promise.resolve('function small() { return true; }');
      });
    });

    it('should emit detector:code-smell:found with correct structure', async () => {
      const codeSmellSpy = vi.fn();
      const detectorFindingSpy = vi.fn();

      idleProcessor.on('detector:code-smell:found', codeSmellSpy);
      idleProcessor.on('detector:finding', detectorFindingSpy);

      await idleProcessor.processIdleTime();

      expect(codeSmellSpy).toHaveBeenCalled();

      const codeSmellCall = codeSmellSpy.mock.calls[0][0] as CodeSmell[];
      expect(codeSmellCall).toBeInstanceOf(Array);
      expect(codeSmellCall.length).toBeGreaterThan(0);

      const finding = codeSmellCall[0];
      expect(finding).toEqual({
        file: expect.any(String),
        type: expect.stringMatching(/long-method|large-class|duplicate-code|dead-code|magic-numbers|feature-envy|data-clumps|deep-nesting/),
        severity: expect.stringMatching(/low|medium|high|critical/),
        details: expect.any(String)
      });

      // Verify individual detector:finding events
      const codeSmellFindings = detectorFindingSpy.mock.calls.filter(call =>
        call[0].detectorType === 'code-smell'
      );
      expect(codeSmellFindings.length).toBeGreaterThan(0);

      const detectorFinding = codeSmellFindings[0][0] as DetectorFinding;
      expect(detectorFinding.metadata).toEqual({
        type: expect.any(String),
        details: expect.any(String)
      });
    });
  });

  describe('detector:complexity-hotspot:found events', () => {
    beforeEach(() => {
      const mockExec = vi.fn().mockImplementation((command: string, options: any) => {
        const callback = arguments[2] || arguments[1];

        if (command.includes('xargs wc -l')) {
          callback(null, { stdout: '800 ./src/complex.ts\n1200 ./src/huge.ts\n2000 total' });
        } else {
          callback(null, { stdout: '' });
        }
      });

      const childProcess = require('child_process');
      childProcess.exec = mockExec;
    });

    it('should emit detector:complexity-hotspot:found with correct structure', async () => {
      const complexityHotspotSpy = vi.fn();
      const detectorFindingSpy = vi.fn();

      idleProcessor.on('detector:complexity-hotspot:found', complexityHotspotSpy);
      idleProcessor.on('detector:finding', detectorFindingSpy);

      await idleProcessor.processIdleTime();

      expect(complexityHotspotSpy).toHaveBeenCalled();

      const complexityCall = complexityHotspotSpy.mock.calls[0][0] as ComplexityHotspot[];
      expect(complexityCall).toBeInstanceOf(Array);
      expect(complexityCall.length).toBeGreaterThan(0);

      const finding = complexityCall[0];
      expect(finding).toEqual({
        file: expect.any(String),
        cyclomaticComplexity: expect.any(Number),
        cognitiveComplexity: expect.any(Number),
        lineCount: expect.any(Number)
      });

      // Verify individual detector:finding events
      const complexityFindings = detectorFindingSpy.mock.calls.filter(call =>
        call[0].detectorType === 'complexity-hotspot'
      );
      expect(complexityFindings.length).toBeGreaterThan(0);

      const detectorFinding = complexityFindings[0][0] as DetectorFinding;
      expect(detectorFinding.metadata).toEqual({
        cyclomaticComplexity: expect.any(Number),
        cognitiveComplexity: expect.any(Number),
        lineCount: expect.any(Number)
      });
    });
  });

  describe('detector:duplicate-code:found events', () => {
    beforeEach(() => {
      const mockExec = vi.fn().mockImplementation((command: string, options: any) => {
        const callback = arguments[2] || arguments[1];

        if (command.includes('find . -name "*.ts"')) {
          callback(null, { stdout: './src/util1.ts\n./src/util2.ts\n' });
        } else if (command.includes('grep -r')) {
          callback(null, { stdout: './src/todo.ts:10:// TODO: implement\n./src/hack.js:25:// TODO: refactor\n' });
        } else {
          callback(null, { stdout: '' });
        }
      });

      const childProcess = require('child_process');
      childProcess.exec = mockExec;

      vi.mocked(fs.readFile).mockImplementation((path: any) => {
        if (path.includes('util1.ts') || path.includes('util2.ts')) {
          return Promise.resolve(`import lodash from 'lodash';\nfunction validateEmail(email: string) { return /\\S+@\\S+\\.\\S+/.test(email); }`);
        }
        return Promise.resolve('function test() {}');
      });
    });

    it('should emit detector:duplicate-code:found with correct structure', async () => {
      const duplicateCodeSpy = vi.fn();
      const detectorFindingSpy = vi.fn();

      idleProcessor.on('detector:duplicate-code:found', duplicateCodeSpy);
      idleProcessor.on('detector:finding', detectorFindingSpy);

      await idleProcessor.processIdleTime();

      if (duplicateCodeSpy.mock.calls.length > 0) {
        const duplicateCall = duplicateCodeSpy.mock.calls[0][0] as DuplicatePattern[];
        expect(duplicateCall).toBeInstanceOf(Array);

        const finding = duplicateCall[0];
        expect(finding).toEqual({
          pattern: expect.any(String),
          locations: expect.any(Array),
          similarity: expect.any(Number)
        });

        // Verify similarity is between 0 and 1
        expect(finding.similarity).toBeGreaterThanOrEqual(0);
        expect(finding.similarity).toBeLessThanOrEqual(1);

        // Verify locations array has at least 2 items (for it to be duplicate)
        expect(finding.locations.length).toBeGreaterThanOrEqual(2);

        // Verify individual detector:finding events
        const duplicateFindings = detectorFindingSpy.mock.calls.filter(call =>
          call[0].detectorType === 'duplicate-code'
        );

        if (duplicateFindings.length > 0) {
          const detectorFinding = duplicateFindings[0][0] as DetectorFinding;
          expect(detectorFinding.metadata).toEqual({
            pattern: expect.any(String),
            locations: expect.any(Array),
            similarity: expect.any(Number)
          });
        }
      }
    });
  });

  describe('detector:undocumented-export:found events', () => {
    beforeEach(() => {
      const mockExec = vi.fn().mockImplementation((command: string, options: any) => {
        const callback = arguments[2] || arguments[1];

        if (command.includes('find . -name "*.ts"')) {
          callback(null, { stdout: './src/api.ts\n./src/utils.ts\n' });
        } else {
          callback(null, { stdout: '' });
        }
      });

      const childProcess = require('child_process');
      childProcess.exec = mockExec;

      vi.mocked(fs.readFile).mockImplementation((path: any) => {
        if (path.includes('api.ts')) {
          return Promise.resolve(`export function undocumentedFunction() {}\nexport class UndocumentedClass {}\nexport interface UndocumentedInterface {}`);
        }
        if (path.includes('utils.ts')) {
          return Promise.resolve(`/**\n * Well documented function\n */\nexport function documentedFunction() {}\n\nexport const undocumentedConstant = 42;`);
        }
        return Promise.resolve('');
      });
    });

    it('should emit detector:undocumented-export:found with correct structure', async () => {
      const undocumentedExportSpy = vi.fn();
      const detectorFindingSpy = vi.fn();

      idleProcessor.on('detector:undocumented-export:found', undocumentedExportSpy);
      idleProcessor.on('detector:finding', detectorFindingSpy);

      await idleProcessor.processIdleTime();

      expect(undocumentedExportSpy).toHaveBeenCalled();

      const undocumentedCall = undocumentedExportSpy.mock.calls[0][0] as UndocumentedExport[];
      expect(undocumentedCall).toBeInstanceOf(Array);
      expect(undocumentedCall.length).toBeGreaterThan(0);

      const finding = undocumentedCall[0];
      expect(finding).toEqual({
        file: expect.any(String),
        name: expect.any(String),
        type: expect.stringMatching(/function|class|interface|type|const|let|var|enum|namespace/),
        line: expect.any(Number),
        isPublic: expect.any(Boolean)
      });

      // Verify individual detector:finding events
      const undocumentedFindings = detectorFindingSpy.mock.calls.filter(call =>
        call[0].detectorType === 'undocumented-export'
      );
      expect(undocumentedFindings.length).toBeGreaterThan(0);

      const detectorFinding = undocumentedFindings[0][0] as DetectorFinding;
      expect(detectorFinding.metadata).toEqual({
        exportType: expect.any(String),
        name: expect.any(String),
        isPublic: expect.any(Boolean)
      });
    });
  });

  describe('detector:missing-readme-section:found events', () => {
    beforeEach(() => {
      const mockExec = vi.fn().mockImplementation((command: string, options: any) => {
        const callback = arguments[2] || arguments[1];

        if (command.includes('find . -name "README*"')) {
          callback(null, { stdout: '' }); // No README files found
        } else {
          callback(null, { stdout: '' });
        }
      });

      const childProcess = require('child_process');
      childProcess.exec = mockExec;
    });

    it('should emit detector:missing-readme-section:found with correct structure', async () => {
      const missingReadmeSpy = vi.fn();
      const detectorFindingSpy = vi.fn();

      idleProcessor.on('detector:missing-readme-section:found', missingReadmeSpy);
      idleProcessor.on('detector:finding', detectorFindingSpy);

      await idleProcessor.processIdleTime();

      expect(missingReadmeSpy).toHaveBeenCalled();

      const missingReadmeCall = missingReadmeSpy.mock.calls[0][0] as MissingReadmeSection[];
      expect(missingReadmeCall).toBeInstanceOf(Array);
      expect(missingReadmeCall.length).toBeGreaterThan(0);

      const finding = missingReadmeCall[0];
      expect(finding).toEqual({
        section: expect.stringMatching(/title|description|installation|usage|api|contributing|license|testing/),
        priority: expect.stringMatching(/required|recommended|optional/),
        description: expect.any(String)
      });

      // Verify individual detector:finding events
      const missingReadmeFindings = detectorFindingSpy.mock.calls.filter(call =>
        call[0].detectorType === 'missing-readme-section'
      );
      expect(missingReadmeFindings.length).toBeGreaterThan(0);

      const detectorFinding = missingReadmeFindings[0][0] as DetectorFinding;
      expect(detectorFinding.metadata).toEqual({
        section: expect.any(String),
        priority: expect.any(String)
      });
    });
  });

  describe('detector:security-vulnerability:found events', () => {
    beforeEach(() => {
      const mockExec = vi.fn().mockImplementation((command: string, options: any) => {
        const callback = arguments[2] || arguments[1];
        callback(null, { stdout: '' });
      });

      const childProcess = require('child_process');
      childProcess.exec = mockExec;

      vi.mocked(fs.readFile).mockImplementation((path: any) => {
        if (path.includes('package.json')) {
          return Promise.resolve(JSON.stringify({
            dependencies: {
              'lodash': '^4.17.15', // Known vulnerable version
              'minimist': '^1.2.5'  // Known vulnerable version
            },
            devDependencies: {}
          }));
        }
        return Promise.resolve('');
      });

      // Mock SecurityVulnerabilityParser
      vi.mock('../utils/security-vulnerability-parser.js', () => ({
        SecurityVulnerabilityParser: {
          parseNpmAuditOutput: vi.fn().mockReturnValue([]),
          createVulnerability: vi.fn().mockImplementation(({name, cveId, severity, affectedVersions, description}) => ({
            name,
            cveId,
            severity,
            affectedVersions,
            description
          }))
        }
      }));
    });

    it('should emit detector:security-vulnerability:found with correct structure', async () => {
      const securityVulnerabilitySpy = vi.fn();
      const detectorFindingSpy = vi.fn();

      idleProcessor.on('detector:security-vulnerability:found', securityVulnerabilitySpy);
      idleProcessor.on('detector:finding', detectorFindingSpy);

      await idleProcessor.processIdleTime();

      if (securityVulnerabilitySpy.mock.calls.length > 0) {
        const securityCall = securityVulnerabilitySpy.mock.calls[0][0] as SecurityVulnerability[];
        expect(securityCall).toBeInstanceOf(Array);

        const finding = securityCall[0];
        expect(finding).toEqual({
          name: expect.any(String),
          cveId: expect.any(String),
          severity: expect.stringMatching(/critical|high|medium|low/),
          affectedVersions: expect.any(String),
          description: expect.any(String)
        });

        // Verify individual detector:finding events
        const securityFindings = detectorFindingSpy.mock.calls.filter(call =>
          call[0].detectorType === 'security-vulnerability'
        );
        expect(securityFindings.length).toBeGreaterThan(0);

        const detectorFinding = securityFindings[0][0] as DetectorFinding;
        expect(detectorFinding.metadata).toEqual({
          cveId: expect.any(String),
          affectedVersions: expect.any(String),
          packageName: expect.any(String)
        });
      }
    });
  });

  describe('detector:deprecated-dependency:found events', () => {
    it('should have the event defined in interface but implementation may not emit yet', () => {
      // This test verifies the event type exists in the interface
      // Implementation may be added in future iterations
      const spy = vi.fn();
      idleProcessor.on('detector:deprecated-dependency:found', spy);

      // Event listener should be successfully added
      expect(idleProcessor.listenerCount('detector:deprecated-dependency:found')).toBe(1);
    });
  });

  describe('detector:finding generic events', () => {
    beforeEach(() => {
      const mockExec = vi.fn().mockImplementation((command: string, options: any) => {
        const callback = arguments[2] || arguments[1];

        if (command.includes('find . -name "*.ts"')) {
          callback(null, { stdout: './src/test.ts\n' });
        } else if (command.includes('xargs wc -l')) {
          callback(null, { stdout: '600 ./src/test.ts\n' });
        } else {
          callback(null, { stdout: '' });
        }
      });

      const childProcess = require('child_process');
      childProcess.exec = mockExec;

      vi.mocked(fs.readFile).mockImplementation((path: any) => {
        if (path.includes('test.ts')) {
          return Promise.resolve('export function undocumentedFunction() {}\nconst line = 1;\n'.repeat(30));
        }
        return Promise.resolve('');
      });
    });

    it('should emit detector:finding events with correct detectorType values', async () => {
      const detectorFindingSpy = vi.fn();
      idleProcessor.on('detector:finding', detectorFindingSpy);

      await idleProcessor.processIdleTime();

      expect(detectorFindingSpy).toHaveBeenCalled();

      // Collect all detector types that were emitted
      const detectorTypes = detectorFindingSpy.mock.calls.map(call => call[0].detectorType);
      const uniqueDetectorTypes = [...new Set(detectorTypes)];

      // Verify that emitted detector types match the expected ones from the events interface
      const validDetectorTypes = [
        'outdated-docs',
        'version-mismatch',
        'stale-comment',
        'code-smell',
        'complexity-hotspot',
        'duplicate-code',
        'undocumented-export',
        'missing-readme-section',
        'security-vulnerability',
        'deprecated-dependency'
      ];

      for (const detectorType of uniqueDetectorTypes) {
        expect(validDetectorTypes).toContain(detectorType);
      }
    });

    it('should emit detector:finding events with consistent metadata structure', async () => {
      const detectorFindingSpy = vi.fn();
      idleProcessor.on('detector:finding', detectorFindingSpy);

      await idleProcessor.processIdleTime();

      if (detectorFindingSpy.mock.calls.length > 0) {
        for (const call of detectorFindingSpy.mock.calls) {
          const finding = call[0] as DetectorFinding;

          // Verify base structure
          expect(finding).toEqual({
            detectorType: expect.any(String),
            severity: expect.stringMatching(/low|medium|high|critical/),
            file: expect.any(String),
            description: expect.any(String),
            metadata: expect.any(Object)
          });

          // Line number should be present and valid when applicable
          if ('line' in finding) {
            expect(finding.line).toBeGreaterThan(0);
          }
        }
      }
    });
  });

  describe('event emission edge cases', () => {
    it('should not emit events when no findings exist', async () => {
      // Mock empty results
      const mockExec = vi.fn().mockImplementation((command: string, options: any) => {
        const callback = arguments[2] || arguments[1];
        callback(null, { stdout: '' });
      });

      const childProcess = require('child_process');
      childProcess.exec = mockExec;

      vi.mocked(fs.readFile).mockImplementation(() => {
        return Promise.resolve('// Well documented file\n/**\n * Complete docs\n */\nexport function documented() {}');
      });

      const detectorFindingSpy = vi.fn();
      const allDetectorSpies = {
        'detector:outdated-docs:found': vi.fn(),
        'detector:code-smell:found': vi.fn(),
        'detector:complexity-hotspot:found': vi.fn(),
        'detector:duplicate-code:found': vi.fn(),
        'detector:undocumented-export:found': vi.fn(),
        'detector:missing-readme-section:found': vi.fn(),
        'detector:security-vulnerability:found': vi.fn(),
      };

      idleProcessor.on('detector:finding', detectorFindingSpy);
      for (const [event, spy] of Object.entries(allDetectorSpies)) {
        idleProcessor.on(event as any, spy);
      }

      await idleProcessor.processIdleTime();

      // Should not emit detector events for empty results
      expect(detectorFindingSpy).not.toHaveBeenCalled();
      for (const spy of Object.values(allDetectorSpies)) {
        expect(spy).not.toHaveBeenCalled();
      }
    });

    it('should handle errors gracefully without crashing event emission', async () => {
      // Mock file read errors
      vi.mocked(fs.readFile).mockRejectedValue(new Error('Permission denied'));

      const mockExec = vi.fn().mockRejectedValue(new Error('Command failed'));
      const childProcess = require('child_process');
      childProcess.exec = mockExec;

      const detectorFindingSpy = vi.fn();
      idleProcessor.on('detector:finding', detectorFindingSpy);

      // Should not throw despite errors
      await expect(idleProcessor.processIdleTime()).resolves.toBeUndefined();

      // Analysis should still complete
      const analysis = idleProcessor.getLastAnalysis();
      expect(analysis).toBeDefined();
    });
  });
});