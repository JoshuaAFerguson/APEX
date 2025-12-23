/**
 * Integration validation test for updateType scoring
 *
 * This test validates the basic functionality works end-to-end.
 */

import { MaintenanceAnalyzer } from './maintenance-analyzer';
import type { ProjectAnalysis } from '../idle-processor';

describe('MaintenanceAnalyzer - Integration Validation', () => {
  it('should score outdated dependencies correctly with updateType', () => {
    const analyzer = new MaintenanceAnalyzer();

    const analysis: ProjectAnalysis = {
      codebaseSize: { files: 1, lines: 100, languages: { ts: 1 } },
      dependencies: {
        outdated: [],
        security: [],
        outdatedPackages: [
          {
            name: 'react',
            currentVersion: '16.0.0',
            latestVersion: '18.0.0',
            updateType: 'major'
          },
          {
            name: 'lodash',
            currentVersion: '4.17.20',
            latestVersion: '4.17.21',
            updateType: 'patch'
          }
        ]
      },
      codeQuality: { lintIssues: 0, duplicatedCode: [], complexityHotspots: [], codeSmells: [] },
      documentation: {
        coverage: 100,
        missingDocs: [],
        undocumentedExports: [],
        outdatedDocs: [],
        missingReadmeSections: [],
        apiCompleteness: {
          percentage: 100,
          details: {
            totalEndpoints: 0,
            documentedEndpoints: 0,
            undocumentedItems: [],
            wellDocumentedExamples: [],
            commonIssues: []
          }
        }
      },
      performance: { slowTests: [], bottlenecks: [] }
    };

    const candidates = analyzer.analyze(analysis);

    // Verify we get the expected scoring
    const majorTask = candidates.find(c => c.candidateId.includes('major'));
    const patchTask = candidates.find(c => c.candidateId.includes('patch'));

    expect(majorTask).toBeDefined();
    expect(majorTask!.score).toBe(0.8);
    expect(majorTask!.priority).toBe('high');

    expect(patchTask).toBeDefined();
    expect(patchTask!.score).toBe(0.4);
    expect(patchTask!.priority).toBe('low');

    expect(candidates.length).toBe(2);
  });

  it('should maintain backward compatibility with legacy format', () => {
    const analyzer = new MaintenanceAnalyzer();

    const analysis: ProjectAnalysis = {
      codebaseSize: { files: 1, lines: 100, languages: { ts: 1 } },
      dependencies: {
        outdated: ['old-package@1.0.0'],
        security: [],
        outdatedPackages: [] // Empty rich format
      },
      codeQuality: { lintIssues: 0, duplicatedCode: [], complexityHotspots: [], codeSmells: [] },
      documentation: {
        coverage: 100,
        missingDocs: [],
        undocumentedExports: [],
        outdatedDocs: [],
        missingReadmeSections: [],
        apiCompleteness: {
          percentage: 100,
          details: {
            totalEndpoints: 0,
            documentedEndpoints: 0,
            undocumentedItems: [],
            wellDocumentedExamples: [],
            commonIssues: []
          }
        }
      },
      performance: { slowTests: [], bottlenecks: [] }
    };

    const candidates = analyzer.analyze(analysis);

    // Should get legacy outdated dependency task
    const legacyTask = candidates.find(c => c.candidateId === 'outdated-deps');
    expect(legacyTask).toBeDefined();
    expect(legacyTask!.score).toBe(0.5);
    expect(legacyTask!.priority).toBe('normal');
  });
});