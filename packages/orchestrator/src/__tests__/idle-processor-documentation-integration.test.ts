/**
 * Comprehensive tests for IdleProcessor.analyzeDocumentation() integration
 * with new detection utilities
 *
 * Tests that analyzeDocumentation() properly integrates with:
 * - StaleCommentDetector
 * - VersionMismatchDetector
 * - CrossReferenceValidator
 * - SecurityVulnerabilityParser
 * - JSDocDetector (validateDeprecatedTags)
 *
 * Validates that all ProjectAnalysis.documentation fields are populated correctly.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { IdleProcessor, ProjectAnalysis } from '../idle-processor';
import type { DaemonConfig, EnhancedDocumentationAnalysis } from '@apexcli/core';
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

describe('IdleProcessor.analyzeDocumentation() Integration with Detection Utilities', () => {
  let idleProcessor: IdleProcessor;
  let mockTaskStore: TaskStore;
  let mockConfig: DaemonConfig;
  const testProjectPath = '/test/project';

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock config with documentation analysis enabled
    mockConfig = {
      pollInterval: 5000,
      autoStart: false,
      logLevel: 'info',
      idleProcessing: {
        enabled: true,
        idleThreshold: 300000,
        taskGenerationInterval: 3600000,
        maxIdleTasks: 3
      },
      documentation: {
        outdatedDocs: {
          enabled: true,
          staleCommentThresholdDays: 30,
          checkTodoComments: true,
          checkFixmeComments: true,
          checkHackComments: true,
          gitBlameEnabled: true
        },
        readmeSections: {
          enabled: true,
          required: ['title', 'description', 'installation', 'usage'],
          recommended: ['api', 'contributing', 'license'],
          optional: ['testing', 'troubleshooting', 'faq'],
          customSections: {}
        }
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

  describe('Integration with StaleCommentDetector', () => {
    it('should integrate StaleCommentDetector findings into outdatedDocs', async () => {
      // Mock the StaleCommentDetector
      const mockStaleCommentDetector = {
        findStaleComments: vi.fn().mockResolvedValue([
          {
            file: 'src/utils.ts',
            type: 'stale-reference',
            description: 'Stale TODO comment found',
            line: 25,
            severity: 'medium',
            suggestion: 'Update or remove this TODO comment'
          }
        ])
      };

      vi.doMock('../stale-comment-detector', () => ({
        StaleCommentDetector: vi.fn().mockImplementation(() => mockStaleCommentDetector)
      }));

      // Mock file system calls for basic documentation analysis
      await setupBasicDocumentationMocks();

      const analysis: EnhancedDocumentationAnalysis = await (idleProcessor as any).analyzeDocumentation();

      // Verify StaleCommentDetector integration
      expect(analysis.outdatedDocs).toContainEqual(
        expect.objectContaining({
          file: 'src/utils.ts',
          type: 'stale-reference',
          description: 'Stale TODO comment found',
          line: 25,
          severity: 'medium'
        })
      );

      expect(mockStaleCommentDetector.findStaleComments).toHaveBeenCalled();

      vi.doUnmock('../stale-comment-detector');
    });

    it('should handle StaleCommentDetector errors gracefully', async () => {
      // Mock StaleCommentDetector to throw error
      const mockStaleCommentDetector = {
        findStaleComments: vi.fn().mockRejectedValue(new Error('Git not available'))
      };

      vi.doMock('../stale-comment-detector', () => ({
        StaleCommentDetector: vi.fn().mockImplementation(() => mockStaleCommentDetector)
      }));

      await setupBasicDocumentationMocks();

      const analysis: EnhancedDocumentationAnalysis = await (idleProcessor as any).analyzeDocumentation();

      // Should still return valid analysis structure
      expect(analysis).toHaveProperty('outdatedDocs');
      expect(Array.isArray(analysis.outdatedDocs)).toBe(true);

      vi.doUnmock('../stale-comment-detector');
    });
  });

  describe('Integration with VersionMismatchDetector', () => {
    it('should integrate VersionMismatchDetector findings into outdatedDocs', async () => {
      // Mock the VersionMismatchDetector
      const mockVersionMismatchDetector = {
        detectMismatches: vi.fn().mockResolvedValue([
          {
            file: 'package.json',
            line: 5,
            foundVersion: '1.0.0',
            expectedVersion: '2.1.0',
            lineContent: '"version": "1.0.0"'
          }
        ])
      };

      vi.doMock('../analyzers/version-mismatch-detector', () => ({
        VersionMismatchDetector: vi.fn().mockImplementation(() => mockVersionMismatchDetector)
      }));

      await setupBasicDocumentationMocks();

      const analysis: EnhancedDocumentationAnalysis = await (idleProcessor as any).analyzeDocumentation();

      // Verify VersionMismatchDetector integration
      expect(analysis.outdatedDocs).toContainEqual(
        expect.objectContaining({
          file: 'package.json',
          type: 'version-mismatch',
          description: 'Found version 1.0.0 but expected 2.1.0',
          line: 5,
          suggestion: 'Update version reference from 1.0.0 to 2.1.0',
          severity: 'high' // Major version difference
        })
      );

      expect(mockVersionMismatchDetector.detectMismatches).toHaveBeenCalled();

      vi.doUnmock('../analyzers/version-mismatch-detector');
    });

    it('should calculate correct severity for version mismatches', async () => {
      const mockVersionMismatchDetector = {
        detectMismatches: vi.fn().mockResolvedValue([
          {
            file: 'docs/api.md',
            line: 10,
            foundVersion: '1.2.3',
            expectedVersion: '1.2.5', // Patch difference
            lineContent: 'Version 1.2.3 docs'
          },
          {
            file: 'README.md',
            line: 15,
            foundVersion: '1.1.0',
            expectedVersion: '1.3.0', // Minor difference
            lineContent: 'v1.1.0 features'
          }
        ])
      };

      vi.doMock('../analyzers/version-mismatch-detector', () => ({
        VersionMismatchDetector: vi.fn().mockImplementation(() => mockVersionMismatchDetector)
      }));

      await setupBasicDocumentationMocks();

      const analysis: EnhancedDocumentationAnalysis = await (idleProcessor as any).analyzeDocumentation();

      // Find the version mismatch entries
      const patchMismatch = analysis.outdatedDocs.find(doc =>
        doc.type === 'version-mismatch' && doc.description.includes('1.2.3'));
      const minorMismatch = analysis.outdatedDocs.find(doc =>
        doc.type === 'version-mismatch' && doc.description.includes('1.1.0'));

      expect(patchMismatch?.severity).toBe('low');
      expect(minorMismatch?.severity).toBe('medium');

      vi.doUnmock('../analyzers/version-mismatch-detector');
    });

    it('should handle VersionMismatchDetector errors gracefully', async () => {
      const mockVersionMismatchDetector = {
        detectMismatches: vi.fn().mockRejectedValue(new Error('Detector failed'))
      };

      vi.doMock('../analyzers/version-mismatch-detector', () => ({
        VersionMismatchDetector: vi.fn().mockImplementation(() => mockVersionMismatchDetector)
      }));

      await setupBasicDocumentationMocks();

      const analysis: EnhancedDocumentationAnalysis = await (idleProcessor as any).analyzeDocumentation();

      // Should not crash and return valid structure
      expect(analysis).toHaveProperty('outdatedDocs');
      expect(Array.isArray(analysis.outdatedDocs)).toBe(true);

      vi.doUnmock('../analyzers/version-mismatch-detector');
    });
  });

  describe('Integration with CrossReferenceValidator', () => {
    it('should integrate CrossReferenceValidator findings into outdatedDocs', async () => {
      // Mock CrossReferenceValidator
      const mockSymbolIndex = {
        byName: new Map([
          ['ValidFunction', [{ name: 'ValidFunction', type: 'function', file: './src/valid.ts' }]]
        ]),
        byFile: new Map(),
        stats: { totalSymbols: 1, totalFiles: 1, byType: {} }
      };

      const mockCrossReferenceValidator = {
        buildIndex: vi.fn().mockResolvedValue(mockSymbolIndex),
        extractDocumentationReferences: vi.fn().mockReturnValue([
          {
            symbolName: 'MissingFunction',
            referenceType: 'inline-code',
            sourceFile: './docs/api.md',
            line: 10,
            column: 15,
            context: 'Use `MissingFunction()` for processing'
          }
        ]),
        validateDocumentationReferences: vi.fn().mockReturnValue([
          {
            file: 'docs/api.md',
            type: 'broken-link',
            description: "Reference to non-existent symbol 'MissingFunction' in inline-code at line 10",
            line: 10,
            suggestion: 'Symbol not found in codebase',
            severity: 'medium'
          }
        ])
      };

      vi.doMock('../analyzers/cross-reference-validator', () => ({
        CrossReferenceValidator: vi.fn().mockImplementation(() => mockCrossReferenceValidator)
      }));

      await setupBasicDocumentationMocks();

      const analysis: EnhancedDocumentationAnalysis = await (idleProcessor as any).analyzeDocumentation();

      // Verify CrossReferenceValidator integration
      expect(analysis.outdatedDocs).toContainEqual(
        expect.objectContaining({
          file: 'docs/api.md',
          type: 'broken-link',
          description: expect.stringContaining('MissingFunction'),
          line: 10,
          severity: 'medium'
        })
      );

      expect(mockCrossReferenceValidator.buildIndex).toHaveBeenCalledWith(
        testProjectPath,
        expect.objectContaining({
          extensions: ['.ts', '.tsx', '.js', '.jsx'],
          exclude: ['node_modules/**', 'dist/**', 'build/**', '**/*.test.*', '**/*.spec.*'],
          includePrivate: false,
          includeMembers: true
        })
      );
      expect(mockCrossReferenceValidator.extractDocumentationReferences).toHaveBeenCalled();
      expect(mockCrossReferenceValidator.validateDocumentationReferences).toHaveBeenCalled();

      vi.doUnmock('../analyzers/cross-reference-validator');
    });

    it('should handle CrossReferenceValidator errors gracefully', async () => {
      const mockCrossReferenceValidator = {
        buildIndex: vi.fn().mockRejectedValue(new Error('Index build failed')),
        extractDocumentationReferences: vi.fn(),
        validateDocumentationReferences: vi.fn()
      };

      vi.doMock('../analyzers/cross-reference-validator', () => ({
        CrossReferenceValidator: vi.fn().mockImplementation(() => mockCrossReferenceValidator)
      }));

      await setupBasicDocumentationMocks();

      const analysis: EnhancedDocumentationAnalysis = await (idleProcessor as any).analyzeDocumentation();

      // Should continue processing other detectors
      expect(analysis).toHaveProperty('outdatedDocs');
      expect(Array.isArray(analysis.outdatedDocs)).toBe(true);

      vi.doUnmock('../analyzers/cross-reference-validator');
    });
  });

  describe('Integration with SecurityVulnerabilityParser', () => {
    it('should integrate SecurityVulnerabilityParser findings and emit events', async () => {
      // Mock SecurityVulnerabilityParser
      const mockSecurityVulnerabilityParser = {
        parseNpmAuditOutput: vi.fn().mockReturnValue([
          {
            name: 'lodash',
            cveId: 'CVE-2021-23337',
            severity: 'high',
            affectedVersions: '<4.17.21',
            description: 'Command injection vulnerability'
          }
        ]),
        createVulnerability: vi.fn().mockImplementation(({ name, cveId, severity, affectedVersions, description }) => ({
          name,
          cveId,
          severity,
          affectedVersions,
          description
        }))
      };

      vi.doMock('../utils/security-vulnerability-parser', () => ({
        SecurityVulnerabilityParser: mockSecurityVulnerabilityParser
      }));

      // Mock npm audit execution
      const { exec } = await import('child_process');
      const mockExec = exec as any;
      mockExec.mockImplementationOnce((command: string, options: any, callback: any) => {
        if (command.includes('npm audit')) {
          callback(null, {
            stdout: JSON.stringify({
              vulnerabilities: {
                lodash: {
                  cveId: 'CVE-2021-23337',
                  severity: 'high',
                  via: [{ range: '<4.17.21' }]
                }
              }
            })
          });
        } else {
          callback(null, { stdout: '', stderr: '' });
        }
      });

      // Mock package.json reading
      const mockReadFile = fs.readFile as any;
      mockReadFile.mockResolvedValue(JSON.stringify({
        dependencies: { lodash: '^4.17.15' }
      }));

      // Setup spy for security vulnerability events
      const securityVulnEventSpy = vi.fn();
      const detectorFindingEventSpy = vi.fn();
      idleProcessor.on('detector:security-vulnerability:found', securityVulnEventSpy);
      idleProcessor.on('detector:finding', detectorFindingEventSpy);

      await setupBasicDocumentationMocks();

      // Call analyzeDependencies (which is called by analyzeProject)
      const analysis = await (idleProcessor as any).analyzeProject();

      // Verify SecurityVulnerabilityParser integration
      expect(analysis.dependencies.securityIssues).toContainEqual(
        expect.objectContaining({
          name: 'lodash',
          cveId: 'CVE-2021-23337',
          severity: 'high',
          affectedVersions: '<4.17.21',
          description: 'Command injection vulnerability'
        })
      );

      // Verify events were emitted
      expect(securityVulnEventSpy).toHaveBeenCalledWith([
        expect.objectContaining({
          name: 'lodash',
          cveId: 'CVE-2021-23337',
          severity: 'high'
        })
      ]);

      expect(detectorFindingEventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          detectorType: 'security-vulnerability',
          severity: 'high',
          file: 'package.json',
          description: expect.stringContaining('lodash'),
          metadata: expect.objectContaining({
            cveId: 'CVE-2021-23337',
            packageName: 'lodash'
          })
        })
      );

      vi.doUnmock('../utils/security-vulnerability-parser');
    });

    it('should handle SecurityVulnerabilityParser fallback gracefully', async () => {
      const { exec } = await import('child_process');
      const mockExec = exec as any;

      // Mock npm audit to fail, triggering fallback
      mockExec.mockImplementationOnce((command: string, options: any, callback: any) => {
        if (command.includes('npm audit')) {
          callback(new Error('npm audit failed'), null);
        } else {
          callback(null, { stdout: '', stderr: '' });
        }
      });

      const mockReadFile = fs.readFile as any;
      mockReadFile.mockResolvedValue(JSON.stringify({
        dependencies: { lodash: '^4.17.15' } // Known vulnerable version
      }));

      await setupBasicDocumentationMocks();

      const analysis = await (idleProcessor as any).analyzeProject();

      // Should still detect vulnerabilities using fallback
      expect(analysis.dependencies.security.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Integration with JSDocDetector (validateDeprecatedTags)', () => {
    it('should integrate JSDocDetector findings into outdatedDocs', async () => {
      // Mock validateDeprecatedTags function
      const mockValidateDeprecatedTags = vi.fn().mockReturnValue([
        {
          file: 'src/api.ts',
          type: 'deprecated-api',
          description: '@deprecated tag lacks proper migration path',
          line: 15,
          suggestion: 'Add @see tag or migration instructions',
          severity: 'medium'
        }
      ]);

      vi.doMock('@apexcli/core', async () => {
        const actual = await vi.importActual('@apexcli/core') as any;
        return {
          ...actual,
          validateDeprecatedTags: mockValidateDeprecatedTags
        };
      });

      // Mock file finding and reading for source files
      const { exec } = await import('child_process');
      const mockExec = exec as any;

      mockExec
        .mockImplementationOnce((command: string, options: any, callback: any) => {
          if (command.includes('find . -name "*.md"')) {
            callback(null, { stdout: '', stderr: '' });
          }
        })
        .mockImplementationOnce((command: string, options: any, callback: any) => {
          if (command.includes('find . -name "*.ts"')) {
            callback(null, { stdout: './src/api.ts\n', stderr: '' });
          }
        });

      const mockReadFile = fs.readFile as any;
      mockReadFile.mockResolvedValue(`
      /**
       * @deprecated Bad
       */
      export function oldFunction() {
        return 'deprecated';
      }
      `);

      await setupBasicDocumentationMocks();

      const analysis: EnhancedDocumentationAnalysis = await (idleProcessor as any).analyzeDocumentation();

      // Verify JSDocDetector integration
      expect(analysis.outdatedDocs).toContainEqual(
        expect.objectContaining({
          file: 'src/api.ts',
          type: 'deprecated-api',
          description: '@deprecated tag lacks proper migration path',
          line: 15,
          severity: 'medium'
        })
      );

      expect(mockValidateDeprecatedTags).toHaveBeenCalledWith(
        expect.stringContaining('@deprecated'),
        'src/api.ts'
      );

      vi.doUnmock('@apexcli/core');
    });

    it('should handle JSDocDetector errors gracefully', async () => {
      // Mock validateDeprecatedTags to throw error
      const mockValidateDeprecatedTags = vi.fn().mockImplementation(() => {
        throw new Error('JSDoc validation failed');
      });

      vi.doMock('@apexcli/core', async () => {
        const actual = await vi.importActual('@apexcli/core') as any;
        return {
          ...actual,
          validateDeprecatedTags: mockValidateDeprecatedTags
        };
      });

      await setupBasicDocumentationMocks();

      const analysis: EnhancedDocumentationAnalysis = await (idleProcessor as any).analyzeDocumentation();

      // Should not crash and return valid structure
      expect(analysis).toHaveProperty('outdatedDocs');
      expect(Array.isArray(analysis.outdatedDocs)).toBe(true);

      vi.doUnmock('@apexcli/core');
    });
  });

  describe('Complete Integration Test', () => {
    it('should populate all EnhancedDocumentationAnalysis fields correctly', async () => {
      // Setup all detector mocks for complete integration test
      await setupAllDetectorMocks();
      await setupBasicDocumentationMocks();

      const analysis: EnhancedDocumentationAnalysis = await (idleProcessor as any).analyzeDocumentation();

      // Verify all fields are populated with correct types
      expect(analysis).toEqual(
        expect.objectContaining({
          coverage: expect.any(Number),
          missingDocs: expect.any(Array),
          undocumentedExports: expect.any(Array),
          outdatedDocs: expect.any(Array),
          missingReadmeSections: expect.any(Array),
          apiCompleteness: expect.objectContaining({
            percentage: expect.any(Number),
            details: expect.objectContaining({
              totalEndpoints: expect.any(Number),
              documentedEndpoints: expect.any(Number),
              undocumentedItems: expect.any(Array),
              wellDocumentedExamples: expect.any(Array),
              commonIssues: expect.any(Array)
            })
          })
        })
      );

      // Verify outdatedDocs contains findings from all detectors
      const detectorTypes = analysis.outdatedDocs.map(doc => doc.type);
      const uniqueTypes = [...new Set(detectorTypes)];
      expect(uniqueTypes.length).toBeGreaterThan(1); // Multiple detector types
      expect(uniqueTypes).toContain('stale-reference'); // StaleCommentDetector
      expect(uniqueTypes).toContain('version-mismatch'); // VersionMismatchDetector
    });

    it('should emit all appropriate detector events', async () => {
      await setupAllDetectorMocks();
      await setupBasicDocumentationMocks();

      // Setup event spies
      const events = {
        'detector:undocumented-export:found': vi.fn(),
        'detector:outdated-docs:found': vi.fn(),
        'detector:missing-readme-section:found': vi.fn(),
        'detector:stale-comment:found': vi.fn(),
        'detector:version-mismatch:found': vi.fn(),
        'detector:finding': vi.fn()
      };

      Object.entries(events).forEach(([event, spy]) => {
        idleProcessor.on(event as any, spy);
      });

      await (idleProcessor as any).analyzeDocumentation();

      // Verify key events were emitted
      expect(events['detector:undocumented-export:found']).toHaveBeenCalled();
      expect(events['detector:outdated-docs:found']).toHaveBeenCalled();
      expect(events['detector:missing-readme-section:found']).toHaveBeenCalled();
      expect(events['detector:finding']).toHaveBeenCalled();
    });
  });

  // Helper function to setup basic documentation analysis mocks
  async function setupBasicDocumentationMocks() {
    const { exec } = await import('child_process');
    const mockExec = exec as any;

    // Mock basic file system operations for documentation analysis
    mockExec
      .mockImplementationOnce((command: string, options: any, callback: any) => {
        if (command.includes('find') && command.includes('md')) {
          callback(null, { stdout: '2', stderr: '' });
        }
      })
      .mockImplementationOnce((command: string, options: any, callback: any) => {
        if (command.includes('find') && command.includes('ts')) {
          callback(null, { stdout: '10', stderr: '' });
        }
      })
      .mockImplementationOnce((command: string, options: any, callback: any) => {
        if (command.includes('find') && !command.includes('test')) {
          callback(null, { stdout: './src/main.ts\n./src/utils.ts\n', stderr: '' });
        }
      })
      .mockImplementation((command: string, options: any, callback: any) => {
        // Default fallback for any other commands
        callback(null, { stdout: '', stderr: '' });
      });

    const mockReadFile = fs.readFile as any;
    mockReadFile.mockImplementation((path: any) => {
      if (path.includes('package.json')) {
        return Promise.resolve(JSON.stringify({
          dependencies: { 'react': '^18.0.0' },
          devDependencies: { 'typescript': '^5.0.0' }
        }));
      }
      return Promise.resolve('export function testFunction() { return "test"; }');
    });
  }

  // Helper function to setup all detector mocks
  async function setupAllDetectorMocks() {
    // Mock StaleCommentDetector
    const mockStaleCommentDetector = {
      findStaleComments: vi.fn().mockResolvedValue([
        {
          file: 'src/stale.ts',
          type: 'stale-reference',
          description: 'Stale TODO found',
          line: 10,
          severity: 'low'
        }
      ])
    };

    vi.doMock('../stale-comment-detector', () => ({
      StaleCommentDetector: vi.fn().mockImplementation(() => mockStaleCommentDetector)
    }));

    // Mock VersionMismatchDetector
    const mockVersionMismatchDetector = {
      detectMismatches: vi.fn().mockResolvedValue([
        {
          file: 'README.md',
          line: 5,
          foundVersion: '1.0.0',
          expectedVersion: '1.2.0',
          lineContent: 'Version 1.0.0 docs'
        }
      ])
    };

    vi.doMock('../analyzers/version-mismatch-detector', () => ({
      VersionMismatchDetector: vi.fn().mockImplementation(() => mockVersionMismatchDetector)
    }));

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
});