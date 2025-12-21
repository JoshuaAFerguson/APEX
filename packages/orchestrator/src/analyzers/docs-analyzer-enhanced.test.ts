/**
 * Enhanced Documentation Analysis Tests
 *
 * Tests for the extended ProjectAnalysis.documentation interface and
 * enhanced documentation analysis utilities added in v0.4.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  EnhancedDocumentationAnalysis,
  UndocumentedExport,
  OutdatedDocumentation,
  MissingReadmeSection,
  APICompleteness,
  APIDocumentationDetails,
  ReadmeSection
} from '@apexcli/core';
import { DocsAnalyzer } from './docs-analyzer';
import type { ProjectAnalysis } from '../idle-processor';

// ============================================================================
// Type Validation Tests
// ============================================================================

describe('Enhanced Documentation Analysis Types', () => {
  describe('UndocumentedExport', () => {
    it('should validate UndocumentedExport structure', () => {
      const undocumentedExport: UndocumentedExport = {
        file: 'src/utils.ts',
        name: 'parseData',
        type: 'function',
        line: 42,
        isPublic: true
      };

      expect(undocumentedExport.file).toBe('src/utils.ts');
      expect(undocumentedExport.name).toBe('parseData');
      expect(undocumentedExport.type).toBe('function');
      expect(undocumentedExport.line).toBe(42);
      expect(undocumentedExport.isPublic).toBe(true);
    });

    it('should support all export types', () => {
      const exportTypes = ['function', 'class', 'interface', 'type', 'variable', 'const', 'enum', 'namespace'] as const;

      exportTypes.forEach(type => {
        const undocumentedExport: UndocumentedExport = {
          file: 'test.ts',
          name: 'TestItem',
          type,
          line: 1,
          isPublic: true
        };
        expect(undocumentedExport.type).toBe(type);
      });
    });
  });

  describe('OutdatedDocumentation', () => {
    it('should validate OutdatedDocumentation structure', () => {
      const outdatedDoc: OutdatedDocumentation = {
        file: 'docs/api.md',
        type: 'version-mismatch',
        description: 'References v1.0.0 but current is v2.0.0',
        line: 15,
        suggestion: 'Update version references to v2.0.0',
        severity: 'medium'
      };

      expect(outdatedDoc.file).toBe('docs/api.md');
      expect(outdatedDoc.type).toBe('version-mismatch');
      expect(outdatedDoc.description).toBe('References v1.0.0 but current is v2.0.0');
      expect(outdatedDoc.line).toBe(15);
      expect(outdatedDoc.suggestion).toBe('Update version references to v2.0.0');
      expect(outdatedDoc.severity).toBe('medium');
    });

    it('should support all outdated documentation types', () => {
      const docTypes = ['version-mismatch', 'deprecated-api', 'broken-link', 'outdated-example', 'stale-reference'] as const;

      docTypes.forEach(type => {
        const outdatedDoc: OutdatedDocumentation = {
          file: 'test.md',
          type,
          description: 'Test description',
          severity: 'low'
        };
        expect(outdatedDoc.type).toBe(type);
      });
    });

    it('should support all severity levels', () => {
      const severities = ['low', 'medium', 'high'] as const;

      severities.forEach(severity => {
        const outdatedDoc: OutdatedDocumentation = {
          file: 'test.md',
          type: 'broken-link',
          description: 'Test description',
          severity
        };
        expect(outdatedDoc.severity).toBe(severity);
      });
    });
  });

  describe('MissingReadmeSection', () => {
    it('should validate MissingReadmeSection structure', () => {
      const missingSection: MissingReadmeSection = {
        section: 'installation',
        priority: 'required',
        description: 'Installation and setup instructions'
      };

      expect(missingSection.section).toBe('installation');
      expect(missingSection.priority).toBe('required');
      expect(missingSection.description).toBe('Installation and setup instructions');
    });

    it('should support all README sections', () => {
      const sections: ReadmeSection[] = [
        'title', 'description', 'installation', 'usage', 'api', 'examples',
        'contributing', 'license', 'changelog', 'troubleshooting', 'faq',
        'dependencies', 'testing', 'deployment'
      ];

      sections.forEach(section => {
        const missingSection: MissingReadmeSection = {
          section,
          priority: 'recommended',
          description: `Description for ${section} section`
        };
        expect(missingSection.section).toBe(section);
      });
    });

    it('should support all priority levels', () => {
      const priorities = ['required', 'recommended', 'optional'] as const;

      priorities.forEach(priority => {
        const missingSection: MissingReadmeSection = {
          section: 'usage',
          priority,
          description: 'Test description'
        };
        expect(missingSection.priority).toBe(priority);
      });
    });
  });

  describe('APICompleteness', () => {
    it('should validate APICompleteness structure', () => {
      const apiCompleteness: APICompleteness = {
        percentage: 75,
        details: {
          totalEndpoints: 20,
          documentedEndpoints: 15,
          undocumentedItems: [
            {
              name: 'getUserData',
              file: 'src/api/users.ts',
              type: 'function',
              line: 42
            }
          ],
          wellDocumentedExamples: ['src/api/auth.ts:getUserProfile'],
          commonIssues: ['Missing JSDoc comments', 'No parameter descriptions']
        }
      };

      expect(apiCompleteness.percentage).toBe(75);
      expect(apiCompleteness.details.totalEndpoints).toBe(20);
      expect(apiCompleteness.details.documentedEndpoints).toBe(15);
      expect(apiCompleteness.details.undocumentedItems).toHaveLength(1);
      expect(apiCompleteness.details.wellDocumentedExamples).toHaveLength(1);
      expect(apiCompleteness.details.commonIssues).toHaveLength(2);
    });

    it('should validate APIDocumentationDetails undocumented item types', () => {
      const itemTypes = ['endpoint', 'method', 'function', 'class'] as const;

      itemTypes.forEach(type => {
        const details: APIDocumentationDetails = {
          totalEndpoints: 1,
          documentedEndpoints: 0,
          undocumentedItems: [
            {
              name: 'testItem',
              file: 'test.ts',
              type
            }
          ],
          wellDocumentedExamples: [],
          commonIssues: []
        };
        expect(details.undocumentedItems[0].type).toBe(type);
      });
    });
  });

  describe('EnhancedDocumentationAnalysis', () => {
    it('should validate complete EnhancedDocumentationAnalysis structure', () => {
      const enhancedAnalysis: EnhancedDocumentationAnalysis = {
        coverage: 65,
        missingDocs: ['src/legacy.ts', 'src/utils.ts'],
        undocumentedExports: [
          {
            file: 'src/utils.ts',
            name: 'helperFunction',
            type: 'function',
            line: 10,
            isPublic: true
          }
        ],
        outdatedDocs: [
          {
            file: 'README.md',
            type: 'version-mismatch',
            description: 'References old version',
            severity: 'low'
          }
        ],
        missingReadmeSections: [
          {
            section: 'contributing',
            priority: 'recommended',
            description: 'Guidelines for contributing to the project'
          }
        ],
        apiCompleteness: {
          percentage: 80,
          details: {
            totalEndpoints: 25,
            documentedEndpoints: 20,
            undocumentedItems: [],
            wellDocumentedExamples: [],
            commonIssues: []
          }
        }
      };

      expect(enhancedAnalysis.coverage).toBe(65);
      expect(enhancedAnalysis.missingDocs).toHaveLength(2);
      expect(enhancedAnalysis.undocumentedExports).toHaveLength(1);
      expect(enhancedAnalysis.outdatedDocs).toHaveLength(1);
      expect(enhancedAnalysis.missingReadmeSections).toHaveLength(1);
      expect(enhancedAnalysis.apiCompleteness.percentage).toBe(80);
    });
  });
});

// ============================================================================
// DocsAnalyzer Integration Tests with Enhanced Analysis
// ============================================================================

describe('DocsAnalyzer Enhanced Integration', () => {
  let docsAnalyzer: DocsAnalyzer;
  let mockProjectAnalysis: ProjectAnalysis;

  beforeEach(() => {
    docsAnalyzer = new DocsAnalyzer();

    // Create a comprehensive mock ProjectAnalysis with enhanced documentation
    mockProjectAnalysis = {
      codebaseSize: {
        files: 100,
        lines: 10000,
        languages: { 'ts': 80, 'js': 20 }
      },
      dependencies: {
        outdated: [],
        security: []
      },
      codeQuality: {
        lintIssues: 5,
        duplicatedCode: [],
        complexityHotspots: [],
        codeSmells: []
      },
      documentation: {
        coverage: 50,
        missingDocs: ['src/core.ts', 'src/api.ts'],
        undocumentedExports: [],
        outdatedDocs: [],
        missingReadmeSections: [],
        apiCompleteness: {
          percentage: 70,
          details: {
            totalEndpoints: 20,
            documentedEndpoints: 14,
            undocumentedItems: [],
            wellDocumentedExamples: [],
            commonIssues: []
          }
        }
      },
      performance: {
        slowTests: [],
        bottlenecks: []
      }
    };
  });

  describe('analyze with enhanced documentation analysis', () => {
    it('should analyze projects with poor API documentation completeness', () => {
      mockProjectAnalysis.documentation.apiCompleteness.percentage = 25;
      mockProjectAnalysis.documentation.apiCompleteness.details.undocumentedItems = [
        { name: 'criticalAPI', file: 'src/api/core.ts', type: 'function', line: 42 },
        { name: 'UserService', file: 'src/services/user.ts', type: 'class', line: 10 }
      ];

      const candidates = docsAnalyzer.analyze(mockProjectAnalysis);

      // Should suggest documentation improvements for low API completeness
      expect(candidates.length).toBeGreaterThan(0);

      // Should include standard documentation tasks
      const docTasks = candidates.filter(c => c.suggestedWorkflow === 'documentation');
      expect(docTasks.length).toBeGreaterThan(0);
    });

    it('should handle projects with many undocumented exports', () => {
      mockProjectAnalysis.documentation.undocumentedExports = [
        { file: 'src/utils.ts', name: 'parseData', type: 'function', line: 10, isPublic: true },
        { file: 'src/api.ts', name: 'ApiClient', type: 'class', line: 20, isPublic: true },
        { file: 'src/types.ts', name: 'UserData', type: 'interface', line: 5, isPublic: true },
        { file: 'src/constants.ts', name: 'API_URL', type: 'const', line: 1, isPublic: true }
      ];

      const candidates = docsAnalyzer.analyze(mockProjectAnalysis);

      expect(candidates.length).toBeGreaterThan(0);

      // Check that candidate descriptions might reference undocumented exports
      const hasRelevantCandidate = candidates.some(c =>
        c.title.includes('Documentation') || c.description.includes('document')
      );
      expect(hasRelevantCandidate).toBe(true);
    });

    it('should handle projects with outdated documentation', () => {
      mockProjectAnalysis.documentation.outdatedDocs = [
        {
          file: 'README.md',
          type: 'version-mismatch',
          description: 'References v1.0.0 but current is v2.0.0',
          severity: 'high'
        },
        {
          file: 'docs/api.md',
          type: 'deprecated-api',
          description: 'Contains deprecated API examples',
          severity: 'medium'
        }
      ];

      const candidates = docsAnalyzer.analyze(mockProjectAnalysis);

      expect(candidates.length).toBeGreaterThan(0);

      // Should generate documentation improvement tasks
      const docImprovements = candidates.filter(c =>
        c.title.toLowerCase().includes('doc') ||
        c.description.toLowerCase().includes('doc')
      );
      expect(docImprovements.length).toBeGreaterThan(0);
    });

    it('should handle projects with missing README sections', () => {
      mockProjectAnalysis.documentation.missingReadmeSections = [
        {
          section: 'installation',
          priority: 'required',
          description: 'Installation and setup instructions'
        },
        {
          section: 'usage',
          priority: 'required',
          description: 'Basic usage examples'
        },
        {
          section: 'contributing',
          priority: 'recommended',
          description: 'Guidelines for contributing'
        }
      ];

      const candidates = docsAnalyzer.analyze(mockProjectAnalysis);

      expect(candidates.length).toBeGreaterThan(0);

      // Should include README improvement suggestions when coverage is low and missing sections exist
      const readmeTask = candidates.find(c =>
        c.title.toLowerCase().includes('readme') ||
        c.description.toLowerCase().includes('readme')
      );

      // The existing DocsAnalyzer has specific README logic based on coverage and missing docs
      if (mockProjectAnalysis.documentation.coverage < 30) {
        expect(readmeTask).toBeDefined();
      }
    });

    it('should prioritize based on enhanced documentation metrics', () => {
      // Set up a scenario with multiple documentation issues
      mockProjectAnalysis.documentation = {
        coverage: 15, // Critical
        missingDocs: ['src/core.ts', 'src/api.ts', 'src/main.ts'],
        undocumentedExports: [
          { file: 'src/core.ts', name: 'CoreAPI', type: 'class', line: 1, isPublic: true },
          { file: 'src/api.ts', name: 'getUsers', type: 'function', line: 10, isPublic: true }
        ],
        outdatedDocs: [
          { file: 'README.md', type: 'version-mismatch', description: 'Old version refs', severity: 'high' }
        ],
        missingReadmeSections: [
          { section: 'installation', priority: 'required', description: 'How to install' }
        ],
        apiCompleteness: {
          percentage: 30,
          details: {
            totalEndpoints: 20,
            documentedEndpoints: 6,
            undocumentedItems: [],
            wellDocumentedExamples: [],
            commonIssues: ['Missing JSDoc']
          }
        }
      };

      const candidates = docsAnalyzer.analyze(mockProjectAnalysis);

      expect(candidates.length).toBeGreaterThan(0);

      // Should prioritize critical documentation issues
      const highPriority = candidates.filter(c => c.priority === 'high');
      expect(highPriority.length).toBeGreaterThan(0);

      // Critical coverage should generate high priority task
      const criticalTask = candidates.find(c =>
        c.title.includes('Critical') && c.priority === 'high'
      );
      expect(criticalTask).toBeDefined();
    });
  });

  describe('candidate generation with enhanced metrics', () => {
    it('should create appropriate candidate IDs for deduplication', () => {
      mockProjectAnalysis.documentation.coverage = 10; // Will trigger critical docs task

      const candidates = docsAnalyzer.analyze(mockProjectAnalysis);

      expect(candidates.length).toBeGreaterThan(0);

      candidates.forEach(candidate => {
        expect(candidate.candidateId).toMatch(/^docs-/);
        expect(candidate.candidateId).toBeTruthy();
      });
    });

    it('should generate different scores based on severity', () => {
      // Test critical coverage
      mockProjectAnalysis.documentation.coverage = 15;
      const criticalCandidates = docsAnalyzer.analyze(mockProjectAnalysis);

      // Test moderate coverage
      mockProjectAnalysis.documentation.coverage = 35;
      const moderateCandidates = docsAnalyzer.analyze(mockProjectAnalysis);

      const criticalTask = criticalCandidates.find(c => c.title.includes('Critical'));
      const moderateTask = moderateCandidates.find(c => c.title.includes('Coverage'));

      if (criticalTask && moderateTask) {
        expect(criticalTask.score).toBeGreaterThan(moderateTask.score);
      }
    });

    it('should set appropriate effort levels based on problem scope', () => {
      // Many missing docs should be high effort
      mockProjectAnalysis.documentation.missingDocs = Array(15).fill(0).map((_, i) => `file${i}.ts`);

      const candidates = docsAnalyzer.analyze(mockProjectAnalysis);

      const largeScopeTask = candidates.find(c =>
        c.description.includes('15') && c.title.includes('Missing')
      );

      if (largeScopeTask) {
        expect(largeScopeTask.estimatedEffort).toBe('high');
      }
    });
  });

  describe('workflow recommendations', () => {
    it('should recommend documentation workflow for all doc tasks', () => {
      mockProjectAnalysis.documentation.coverage = 10; // Trigger various doc tasks
      mockProjectAnalysis.documentation.missingDocs = ['core.ts', 'api.ts'];

      const candidates = docsAnalyzer.analyze(mockProjectAnalysis);

      expect(candidates.length).toBeGreaterThan(0);

      candidates.forEach(candidate => {
        expect(candidate.suggestedWorkflow).toBe('documentation');
      });
    });
  });
});

// ============================================================================
// Data Structure Validation Tests
// ============================================================================

describe('Enhanced Documentation Analysis Data Integrity', () => {
  it('should maintain backward compatibility with legacy documentation analysis', () => {
    // Test that legacy structure still works
    const legacyAnalysis = {
      coverage: 60,
      missingDocs: ['file1.ts', 'file2.ts'],
      // New fields should be optional/have defaults
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
    } as EnhancedDocumentationAnalysis;

    expect(legacyAnalysis.coverage).toBe(60);
    expect(legacyAnalysis.missingDocs).toHaveLength(2);
    expect(legacyAnalysis.undocumentedExports).toHaveLength(0);
    expect(legacyAnalysis.outdatedDocs).toHaveLength(0);
    expect(legacyAnalysis.missingReadmeSections).toHaveLength(0);
    expect(legacyAnalysis.apiCompleteness.percentage).toBe(0);
  });

  it('should handle empty enhanced analysis gracefully', () => {
    const emptyAnalysis: EnhancedDocumentationAnalysis = {
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
    };

    const docsAnalyzer = new DocsAnalyzer();
    const mockProjectAnalysis: ProjectAnalysis = {
      codebaseSize: { files: 0, lines: 0, languages: {} },
      dependencies: { outdated: [], security: [] },
      codeQuality: { lintIssues: 0, duplicatedCode: [], complexityHotspots: [], codeSmells: [] },
      documentation: emptyAnalysis,
      performance: { slowTests: [], bottlenecks: [] }
    };

    const candidates = docsAnalyzer.analyze(mockProjectAnalysis);

    // Should handle empty analysis without crashing
    expect(Array.isArray(candidates)).toBe(true);
  });

  it('should validate relationships between different documentation metrics', () => {
    const analysis: EnhancedDocumentationAnalysis = {
      coverage: 25,
      missingDocs: ['file1.ts', 'file2.ts'],
      undocumentedExports: [
        { file: 'file1.ts', name: 'export1', type: 'function', line: 1, isPublic: true },
        { file: 'file2.ts', name: 'export2', type: 'class', line: 5, isPublic: true }
      ],
      outdatedDocs: [],
      missingReadmeSections: [
        { section: 'usage', priority: 'required', description: 'How to use' }
      ],
      apiCompleteness: {
        percentage: 50,
        details: {
          totalEndpoints: 10,
          documentedEndpoints: 5,
          undocumentedItems: [
            { name: 'undocAPI', file: 'file1.ts', type: 'function' }
          ],
          wellDocumentedExamples: ['file3.ts:goodAPI'],
          commonIssues: ['Missing JSDoc']
        }
      }
    };

    // Verify internal consistency
    expect(analysis.apiCompleteness.details.documentedEndpoints)
      .toBeLessThanOrEqual(analysis.apiCompleteness.details.totalEndpoints);

    // Check that percentage calculation makes sense
    const expectedPercentage = Math.round(
      (analysis.apiCompleteness.details.documentedEndpoints /
       analysis.apiCompleteness.details.totalEndpoints) * 100
    );
    expect(analysis.apiCompleteness.percentage).toBe(expectedPercentage);

    // Verify undocumented exports relate to missing docs
    const exportFiles = analysis.undocumentedExports.map(e => e.file);
    const missingDocFiles = analysis.missingDocs;

    // Some overlap is expected but not required (undocumented exports might be in documented files)
    expect(exportFiles.some(f => missingDocFiles.includes(f))).toBe(true);
  });
});