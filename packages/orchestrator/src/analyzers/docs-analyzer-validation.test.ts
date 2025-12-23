/**
 * DocsAnalyzer Validation Test
 *
 * Simple validation test to verify the DocsAnalyzer correctly handles
 * the new OutdatedDocumentation types according to the acceptance criteria.
 * This is a focused integration test for the core functionality.
 */

import { describe, it, expect } from 'vitest';
import { DocsAnalyzer } from './docs-analyzer';
import type { ProjectAnalysis } from '../idle-processor';
import type { OutdatedDocumentation } from '@apexcli/core';

describe('DocsAnalyzer Validation - OutdatedDocumentation Types', () => {

  function createBaseAnalysis(outdatedDocs: OutdatedDocumentation[]): ProjectAnalysis {
    return {
      codebaseSize: { files: 50, lines: 5000, languages: { 'ts': 40, 'js': 10 } },
      dependencies: { outdated: [], security: [] },
      codeQuality: { lintIssues: 0, duplicatedCode: [], complexityHotspots: [], codeSmells: [] },
      documentation: {
        coverage: 60, // Good coverage to isolate outdated docs tests
        missingDocs: [],
        undocumentedExports: [],
        outdatedDocs,
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
      performance: { slowTests: [], bottlenecks: [] }
    };
  }

  it('validates version-mismatch type handling from VersionMismatchDetector', () => {
    const analyzer = new DocsAnalyzer();
    const analysis = createBaseAnalysis([
      {
        file: 'README.md',
        type: 'version-mismatch',
        description: 'References v1.0 but current is v2.0',
        severity: 'high'
      }
    ]);

    const candidates = analyzer.analyze(analysis);

    const versionTask = candidates.find(c => c.candidateId === 'docs-fix-version-mismatches-critical');

    expect(versionTask).toBeDefined();
    expect(versionTask!.priority).toBe('high');
    expect(versionTask!.score).toBe(0.8);
    expect(versionTask!.suggestedWorkflow).toBe('documentation');
    expect(versionTask!.title).toBe('Fix Critical Version Mismatches');
  });

  it('validates broken-link type handling from CrossReferenceValidator', () => {
    const analyzer = new DocsAnalyzer();
    const analysis = createBaseAnalysis([
      {
        file: 'src/api.ts',
        type: 'broken-link',
        description: 'JSDoc @see reference to non-existent method',
        severity: 'high',
        line: 42
      }
    ]);

    const candidates = analyzer.analyze(analysis);

    const linkTask = candidates.find(c => c.candidateId === 'docs-fix-broken-links-critical');

    expect(linkTask).toBeDefined();
    expect(linkTask!.priority).toBe('high');
    expect(linkTask!.score).toBe(0.8);
    expect(linkTask!.title).toBe('Fix Critical Broken Links');
    expect(linkTask!.rationale).toContain('@see tags');
  });

  it('validates deprecated-api type handling from JSDocDetector', () => {
    const analyzer = new DocsAnalyzer();
    const analysis = createBaseAnalysis([
      {
        file: 'src/auth.ts',
        type: 'deprecated-api',
        description: '@deprecated tag missing migration guidance',
        severity: 'high',
        line: 25,
        suggestion: 'Add migration path to new auth API'
      }
    ]);

    const candidates = analyzer.analyze(analysis);

    const deprecatedTask = candidates.find(c => c.candidateId === 'docs-fix-deprecated-api-docs-critical');

    expect(deprecatedTask).toBeDefined();
    expect(deprecatedTask!.priority).toBe('high');
    expect(deprecatedTask!.score).toBe(0.8);
    expect(deprecatedTask!.title).toBe('Document Critical Deprecated APIs');
    expect(deprecatedTask!.rationale).toContain('migration difficult');
  });

  it('validates appropriate priority mapping for all severity levels', () => {
    const analyzer = new DocsAnalyzer();

    // Test high severity -> high priority
    const highSeverityAnalysis = createBaseAnalysis([
      { file: 'test.md', type: 'version-mismatch', description: 'Test', severity: 'high' }
    ]);
    const highCandidates = analyzer.analyze(highSeverityAnalysis);
    const highTask = highCandidates.find(c => c.candidateId.includes('version-mismatches'));
    expect(highTask!.priority).toBe('high');
    expect(highTask!.score).toBe(0.8);

    // Test medium severity -> normal priority
    const mediumSeverityAnalysis = createBaseAnalysis([
      { file: 'test.md', type: 'version-mismatch', description: 'Test', severity: 'medium' }
    ]);
    const mediumCandidates = analyzer.analyze(mediumSeverityAnalysis);
    const mediumTask = mediumCandidates.find(c => c.candidateId.includes('version-mismatches'));
    expect(mediumTask!.priority).toBe('normal');
    expect(mediumTask!.score).toBe(0.6);

    // Test low severity -> low priority
    const lowSeverityAnalysis = createBaseAnalysis([
      { file: 'test.md', type: 'version-mismatch', description: 'Test', severity: 'low' }
    ]);
    const lowCandidates = analyzer.analyze(lowSeverityAnalysis);
    const lowTask = lowCandidates.find(c => c.candidateId.includes('version-mismatches'));
    expect(lowTask!.priority).toBe('low');
    expect(lowTask!.score).toBe(0.4);
  });

  it('validates all candidates have required properties', () => {
    const analyzer = new DocsAnalyzer();
    const analysis = createBaseAnalysis([
      { file: 'test1.md', type: 'version-mismatch', description: 'Test', severity: 'high' },
      { file: 'test2.ts', type: 'broken-link', description: 'Test', severity: 'medium' },
      { file: 'test3.ts', type: 'deprecated-api', description: 'Test', severity: 'low' }
    ]);

    const candidates = analyzer.analyze(analysis);

    expect(candidates.length).toBeGreaterThan(0);

    candidates.forEach(candidate => {
      expect(candidate.candidateId).toMatch(/^docs-/);
      expect(candidate.suggestedWorkflow).toBe('documentation');
      expect(['low', 'normal', 'high']).toContain(candidate.priority);
      expect(['low', 'medium', 'high']).toContain(candidate.estimatedEffort);
      expect(candidate.score).toBeGreaterThan(0);
      expect(candidate.score).toBeLessThanOrEqual(1);
      expect(candidate.title).toBeTruthy();
      expect(candidate.description).toBeTruthy();
      expect(candidate.rationale).toBeTruthy();
    });
  });

  it('validates integration with existing DocsAnalyzer functionality', () => {
    const analyzer = new DocsAnalyzer();
    const analysis = createBaseAnalysis([
      { file: 'README.md', type: 'version-mismatch', description: 'Version issue', severity: 'medium' }
    ]);

    // Also add some existing conditions
    analysis.documentation.coverage = 35; // Will trigger improvement task
    analysis.documentation.missingDocs = ['src/core.ts']; // Will trigger core module task

    const candidates = analyzer.analyze(analysis);

    // Should have both new and existing tasks
    const versionTask = candidates.find(c => c.candidateId.includes('version-mismatches'));
    const improvementTask = candidates.find(c => c.candidateId.includes('improve-docs-coverage'));
    const coreTask = candidates.find(c => c.candidateId.includes('core-module-docs'));

    expect(versionTask).toBeDefined();
    expect(improvementTask).toBeDefined();
    expect(coreTask).toBeDefined();
    expect(candidates.length).toBeGreaterThanOrEqual(3);
  });

  it('validates empty outdated docs do not generate tasks', () => {
    const analyzer = new DocsAnalyzer();
    const analysis = createBaseAnalysis([]);

    const candidates = analyzer.analyze(analysis);

    const outdatedTasks = candidates.filter(c =>
      c.candidateId.includes('version-mismatch') ||
      c.candidateId.includes('broken-link') ||
      c.candidateId.includes('deprecated-api')
    );

    expect(outdatedTasks).toHaveLength(0);
  });
});