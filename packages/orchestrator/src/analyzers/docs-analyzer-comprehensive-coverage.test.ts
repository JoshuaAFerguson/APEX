/**
 * Comprehensive Test Coverage for DocsAnalyzer Enhancement
 *
 * This test suite provides comprehensive unit tests covering:
 * - JSDoc detection on various export patterns
 * - Outdated documentation detection edge cases
 * - README analysis edge cases
 * - Integration tests for the full analysis pipeline
 * - Error handling and boundary conditions
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DocsAnalyzer } from './docs-analyzer';
import type { ProjectAnalysis } from '../idle-processor';
import type { TaskCandidate } from './index';
import type {
  EnhancedDocumentationAnalysis,
  UndocumentedExport,
  OutdatedDocumentation,
  MissingReadmeSection,
  APICompleteness
} from '@apexcli/core';

describe('DocsAnalyzer Comprehensive Coverage', () => {
  let docsAnalyzer: DocsAnalyzer;
  let baseProjectAnalysis: ProjectAnalysis;

  beforeEach(() => {
    docsAnalyzer = new DocsAnalyzer();

    baseProjectAnalysis = {
      codebaseSize: {
        files: 50,
        lines: 5000,
        languages: { 'ts': 40, 'js': 10 }
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
        missingDocs: [],
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

  // ============================================================================
  // JSDoc Detection on Various Export Patterns
  // ============================================================================

  describe('JSDoc detection on various export patterns', () => {
    it('should detect undocumented default exports', () => {
      const undocumentedExports: UndocumentedExport[] = [
        {
          file: 'src/components/Button.tsx',
          name: 'default',
          type: 'function',
          line: 15,
          isPublic: true
        }
      ];

      baseProjectAnalysis.documentation.undocumentedExports = undocumentedExports;

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);
      const publicExportsTask = candidates.find(c =>
        c.candidateId === 'docs-undocumented-public-exports'
      );

      expect(publicExportsTask).toBeDefined();
      expect(publicExportsTask?.description).toContain('default (function)');
    });

    it('should detect undocumented named exports with various types', () => {
      const undocumentedExports: UndocumentedExport[] = [
        {
          file: 'src/types/User.ts',
          name: 'UserInterface',
          type: 'interface',
          line: 5,
          isPublic: true
        },
        {
          file: 'src/types/User.ts',
          name: 'UserRole',
          type: 'enum',
          line: 15,
          isPublic: true
        },
        {
          file: 'src/utils/constants.ts',
          name: 'API_CONFIG',
          type: 'const',
          line: 1,
          isPublic: true
        },
        {
          file: 'src/validators/schema.ts',
          name: 'ValidationSchema',
          type: 'type',
          line: 8,
          isPublic: true
        }
      ];

      baseProjectAnalysis.documentation.undocumentedExports = undocumentedExports;

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);
      const publicExportsTask = candidates.find(c =>
        c.candidateId === 'docs-undocumented-public-exports'
      );

      expect(publicExportsTask).toBeDefined();
      expect(publicExportsTask?.description).toContain('UserInterface (interface)');
      expect(publicExportsTask?.description).toContain('UserRole (enum)');
      expect(publicExportsTask?.description).toContain('API_CONFIG (const)');
    });

    it('should detect undocumented namespace exports', () => {
      const undocumentedExports: UndocumentedExport[] = [
        {
          file: 'src/namespaces/Utils.ts',
          name: 'StringUtils',
          type: 'namespace',
          line: 1,
          isPublic: true
        }
      ];

      baseProjectAnalysis.documentation.undocumentedExports = undocumentedExports;

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);
      const publicExportsTask = candidates.find(c =>
        c.candidateId === 'docs-undocumented-public-exports'
      );

      expect(publicExportsTask).toBeDefined();
      expect(publicExportsTask?.description).toContain('StringUtils (namespace)');
    });

    it('should differentiate between public and internal exports correctly', () => {
      const undocumentedExports: UndocumentedExport[] = [
        {
          file: 'src/api/public.ts',
          name: 'publicFunction',
          type: 'function',
          line: 1,
          isPublic: true
        },
        {
          file: 'src/internal/helper.ts',
          name: 'InternalHelper',
          type: 'class',
          line: 1,
          isPublic: false
        },
        {
          file: 'src/internal/config.ts',
          name: 'InternalConfig',
          type: 'interface',
          line: 1,
          isPublic: false
        }
      ];

      baseProjectAnalysis.documentation.undocumentedExports = undocumentedExports;

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      // Should generate public exports task (high priority)
      const publicExportsTask = candidates.find(c =>
        c.candidateId === 'docs-undocumented-public-exports'
      );
      expect(publicExportsTask).toBeDefined();
      expect(publicExportsTask?.description).toContain('publicFunction (function)');

      // Should NOT generate critical types task because public exports take priority
      const criticalTypesTask = candidates.find(c =>
        c.candidateId === 'docs-undocumented-critical-types'
      );
      expect(criticalTypesTask).toBeUndefined();
    });

    it('should handle mixed export patterns with line number tracking', () => {
      const undocumentedExports: UndocumentedExport[] = [
        {
          file: 'src/complex.ts',
          name: 'ComplexClass',
          type: 'class',
          line: 42,
          isPublic: true
        },
        {
          file: 'src/complex.ts',
          name: 'helperFunction',
          type: 'function',
          line: 156,
          isPublic: true
        },
        {
          file: 'src/complex.ts',
          name: 'UtilityType',
          type: 'type',
          line: 203,
          isPublic: true
        }
      ];

      baseProjectAnalysis.documentation.undocumentedExports = undocumentedExports;

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);
      const publicExportsTask = candidates.find(c =>
        c.candidateId === 'docs-undocumented-public-exports'
      );

      expect(publicExportsTask).toBeDefined();
      expect(publicExportsTask?.description).toContain('ComplexClass (class)');
      expect(publicExportsTask?.description).toContain('helperFunction (function)');
      expect(publicExportsTask?.description).toContain('UtilityType (type)');
    });

    it('should handle variable export patterns correctly', () => {
      const undocumentedExports: UndocumentedExport[] = [
        {
          file: 'src/config/env.ts',
          name: 'DATABASE_URL',
          type: 'variable',
          line: 5,
          isPublic: true
        },
        {
          file: 'src/config/env.ts',
          name: 'API_TIMEOUT',
          type: 'const',
          line: 6,
          isPublic: true
        }
      ];

      baseProjectAnalysis.documentation.undocumentedExports = undocumentedExports;

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);
      const publicExportsTask = candidates.find(c =>
        c.candidateId === 'docs-undocumented-public-exports'
      );

      expect(publicExportsTask).toBeDefined();
      expect(publicExportsTask?.description).toContain('DATABASE_URL (variable)');
      expect(publicExportsTask?.description).toContain('API_TIMEOUT (const)');
    });
  });

  // ============================================================================
  // Outdated Documentation Detection Edge Cases
  // ============================================================================

  describe('outdated documentation detection edge cases', () => {
    it('should handle stale comments with complex aging scenarios', () => {
      const outdatedDocs: OutdatedDocumentation[] = [
        {
          file: 'src/legacy/auth.ts',
          type: 'stale-reference',
          description: 'TODO: Refactor this when OAuth 2.0 is implemented (from 6 months ago)',
          severity: 'high',
          line: 25,
          suggestion: 'OAuth 2.0 has been implemented - remove TODO or update implementation'
        },
        {
          file: 'src/components/Form.tsx',
          type: 'stale-reference',
          description: 'FIXME: Handle edge case for validation (45 days old)',
          severity: 'medium',
          line: 67
        },
        {
          file: 'src/utils/helpers.ts',
          type: 'stale-reference',
          description: 'HACK: Temporary solution until library update (20 days old)',
          severity: 'low',
          line: 15
        }
      ];

      baseProjectAnalysis.documentation.outdatedDocs = outdatedDocs;

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      // Should generate critical stale comments task for high severity
      const criticalStaleTask = candidates.find(c =>
        c.candidateId === 'docs-resolve-stale-comments-critical'
      );
      expect(criticalStaleTask).toBeDefined();
      expect(criticalStaleTask?.priority).toBe('high');
      expect(criticalStaleTask?.description).toContain('90 days');

      // Should not generate medium task when critical exists
      const mediumStaleTask = candidates.find(c =>
        c.candidateId === 'docs-resolve-stale-comments-medium'
      );
      expect(mediumStaleTask).toBeUndefined();
    });

    it('should handle version mismatch edge cases with semantic versioning', () => {
      const outdatedDocs: OutdatedDocumentation[] = [
        {
          file: 'README.md',
          type: 'version-mismatch',
          description: 'Installation instructions reference v1.0.0 but current is v3.0.0',
          severity: 'high',
          line: 15,
          suggestion: 'Update installation instructions to reflect v3.0.0 breaking changes'
        },
        {
          file: 'docs/api.md',
          type: 'version-mismatch',
          description: 'API examples show v2.1.0 syntax but current is v2.3.0',
          severity: 'medium',
          line: 42
        },
        {
          file: 'CHANGELOG.md',
          type: 'version-mismatch',
          description: 'Latest entry is v2.2.1 but current is v2.3.0',
          severity: 'low',
          line: 1
        }
      ];

      baseProjectAnalysis.documentation.outdatedDocs = outdatedDocs;

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      // Should generate critical version mismatch task
      const criticalVersionTask = candidates.find(c =>
        c.candidateId === 'docs-fix-version-mismatches-critical'
      );
      expect(criticalVersionTask).toBeDefined();
      expect(criticalVersionTask?.priority).toBe('high');
      expect(criticalVersionTask?.description).toContain('1 critical version mismatch');
      expect(criticalVersionTask?.rationale).toContain('Version mismatches cause confusion');
    });

    it('should handle broken link edge cases with different link types', () => {
      const outdatedDocs: OutdatedDocumentation[] = [
        {
          file: 'src/api/users.ts',
          type: 'broken-link',
          description: 'JSDoc @see reference to deleted getUserById method',
          severity: 'high',
          line: 25,
          suggestion: 'Update @see reference to point to new getUserByIdV2 method'
        },
        {
          file: 'docs/setup.md',
          type: 'broken-link',
          description: 'Link to configuration guide returns 404',
          severity: 'medium',
          line: 67
        },
        {
          file: 'README.md',
          type: 'broken-link',
          description: 'Badge URL for build status is outdated',
          severity: 'low',
          line: 5
        }
      ];

      baseProjectAnalysis.documentation.outdatedDocs = outdatedDocs;

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      // Should generate critical broken links task
      const criticalLinksTask = candidates.find(c =>
        c.candidateId === 'docs-fix-broken-links-critical'
      );
      expect(criticalLinksTask).toBeDefined();
      expect(criticalLinksTask?.priority).toBe('high');
      expect(criticalLinksTask?.description).toContain('1 critical broken link');
      expect(criticalLinksTask?.rationale).toContain('@see tags');
    });

    it('should handle deprecated API documentation edge cases', () => {
      const outdatedDocs: OutdatedDocumentation[] = [
        {
          file: 'src/auth/legacy.ts',
          type: 'deprecated-api',
          description: '@deprecated tag without migration path or timeline',
          severity: 'high',
          line: 15,
          suggestion: 'Add migration timeline and alternative API guidance'
        },
        {
          file: 'src/utils/old-helpers.ts',
          type: 'deprecated-api',
          description: '@deprecated tag has vague "use new API" guidance',
          severity: 'medium',
          line: 30,
          suggestion: 'Specify exact replacement function name and usage examples'
        },
        {
          file: 'src/types/legacy-types.ts',
          type: 'deprecated-api',
          description: '@deprecated interface could use better documentation',
          severity: 'low',
          line: 8
        }
      ];

      baseProjectAnalysis.documentation.outdatedDocs = outdatedDocs;

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      // Should generate critical deprecated API task
      const criticalDeprecatedTask = candidates.find(c =>
        c.candidateId === 'docs-fix-deprecated-api-docs-critical'
      );
      expect(criticalDeprecatedTask).toBeDefined();
      expect(criticalDeprecatedTask?.priority).toBe('high');
      expect(criticalDeprecatedTask?.description).toContain('1 critical @deprecated tag');
      expect(criticalDeprecatedTask?.rationale).toContain('migration difficult');
    });

    it('should handle mixed outdated documentation types with complex prioritization', () => {
      const outdatedDocs: OutdatedDocumentation[] = [
        // High severity items from different types
        {
          file: 'README.md',
          type: 'version-mismatch',
          description: 'Major version mismatch',
          severity: 'high'
        },
        {
          file: 'src/api.ts',
          type: 'broken-link',
          description: 'Critical JSDoc link broken',
          severity: 'high'
        },
        {
          file: 'src/deprecated.ts',
          type: 'deprecated-api',
          description: 'Critical @deprecated missing guidance',
          severity: 'high'
        },
        {
          file: 'src/old.ts',
          type: 'stale-reference',
          description: 'Critical stale TODO',
          severity: 'high'
        },
        // Medium severity items
        {
          file: 'docs/guide.md',
          type: 'version-mismatch',
          description: 'Minor version mismatch',
          severity: 'medium'
        },
        {
          file: 'docs/api.md',
          type: 'broken-link',
          description: 'Documentation link broken',
          severity: 'medium'
        }
      ];

      baseProjectAnalysis.documentation.outdatedDocs = outdatedDocs;

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      // Should generate all critical tasks
      const criticalVersionTask = candidates.find(c =>
        c.candidateId === 'docs-fix-version-mismatches-critical'
      );
      const criticalLinksTask = candidates.find(c =>
        c.candidateId === 'docs-fix-broken-links-critical'
      );
      const criticalDeprecatedTask = candidates.find(c =>
        c.candidateId === 'docs-fix-deprecated-api-docs-critical'
      );
      const criticalStaleTask = candidates.find(c =>
        c.candidateId === 'docs-resolve-stale-comments-critical'
      );

      expect(criticalVersionTask).toBeDefined();
      expect(criticalLinksTask).toBeDefined();
      expect(criticalDeprecatedTask).toBeDefined();
      expect(criticalStaleTask).toBeDefined();

      // Should NOT generate medium priority tasks when critical exist for same type
      const mediumVersionTask = candidates.find(c =>
        c.candidateId === 'docs-fix-version-mismatches-medium'
      );
      const mediumLinksTask = candidates.find(c =>
        c.candidateId === 'docs-fix-broken-links-medium'
      );

      expect(mediumVersionTask).toBeUndefined();
      expect(mediumLinksTask).toBeUndefined();

      // All critical tasks should have high priority and score 0.8
      [criticalVersionTask, criticalLinksTask, criticalDeprecatedTask, criticalStaleTask].forEach(task => {
        expect(task?.priority).toBe('high');
        expect(task?.score).toBe(0.8);
      });
    });

    it('should handle unknown or malformed outdated documentation types gracefully', () => {
      const outdatedDocs: any[] = [
        {
          file: 'test.md',
          type: 'unknown-type',
          description: 'Unknown issue type',
          severity: 'high'
        },
        {
          file: 'test2.md',
          type: 'version-mismatch',
          // Missing description
          severity: 'medium'
        },
        {
          file: 'test3.md',
          type: 'broken-link',
          description: 'Valid description',
          // Missing severity should default gracefully
        }
      ];

      baseProjectAnalysis.documentation.outdatedDocs = outdatedDocs as OutdatedDocumentation[];

      expect(() => {
        const candidates = docsAnalyzer.analyze(baseProjectAnalysis);
        expect(candidates).toBeDefined();
      }).not.toThrow();
    });
  });

  // ============================================================================
  // README Analysis Edge Cases
  // ============================================================================

  describe('README analysis edge cases', () => {
    it('should handle complex missing README section prioritization', () => {
      const missingReadmeSections: MissingReadmeSection[] = [
        // Required sections
        {
          section: 'installation',
          priority: 'required',
          description: 'Step-by-step installation guide with prerequisites'
        },
        {
          section: 'usage',
          priority: 'required',
          description: 'Basic usage examples and getting started guide'
        },
        {
          section: 'api',
          priority: 'required',
          description: 'Complete API reference documentation'
        },
        // Recommended sections
        {
          section: 'contributing',
          priority: 'recommended',
          description: 'Guidelines for contributing to the project'
        },
        {
          section: 'troubleshooting',
          priority: 'recommended',
          description: 'Common issues and their solutions'
        },
        // Optional sections
        {
          section: 'faq',
          priority: 'optional',
          description: 'Frequently asked questions'
        },
        {
          section: 'changelog',
          priority: 'optional',
          description: 'Version history and release notes'
        },
        {
          section: 'deployment',
          priority: 'optional',
          description: 'Deployment instructions and best practices'
        }
      ];

      baseProjectAnalysis.documentation.missingReadmeSections = missingReadmeSections;

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      // Should generate only required sections task (highest priority)
      const requiredTask = candidates.find(c =>
        c.candidateId === 'docs-readme-required-sections'
      );
      expect(requiredTask).toBeDefined();
      expect(requiredTask?.priority).toBe('high');
      expect(requiredTask?.description).toContain('3 required README sections');
      expect(requiredTask?.description).toContain('installation, usage, api');
      expect(requiredTask?.score).toBe(0.8);

      // Should NOT generate recommended or optional tasks when required exist
      const recommendedTask = candidates.find(c =>
        c.candidateId === 'docs-readme-recommended-sections'
      );
      const optionalTask = candidates.find(c =>
        c.candidateId === 'docs-readme-optional-sections'
      );

      expect(recommendedTask).toBeUndefined();
      expect(optionalTask).toBeUndefined();
    });

    it('should handle README section effort estimation edge cases', () => {
      const testCases = [
        {
          sectionCount: 2,
          expectedEffort: 'low',
          sections: ['installation', 'usage']
        },
        {
          sectionCount: 3,
          expectedEffort: 'medium',
          sections: ['installation', 'usage', 'api']
        },
        {
          sectionCount: 5,
          expectedEffort: 'high',
          sections: ['installation', 'usage', 'api', 'examples', 'contributing']
        }
      ];

      testCases.forEach(({ sectionCount, expectedEffort, sections }) => {
        const missingReadmeSections: MissingReadmeSection[] = sections.map(section => ({
          section: section as any,
          priority: 'required' as const,
          description: `${section} section`
        }));

        baseProjectAnalysis.documentation.missingReadmeSections = missingReadmeSections;

        const candidates = docsAnalyzer.analyze(baseProjectAnalysis);
        const requiredTask = candidates.find(c =>
          c.candidateId === 'docs-readme-required-sections'
        );

        expect(requiredTask?.estimatedEffort).toBe(expectedEffort);
        expect(requiredTask?.description).toContain(`${sectionCount} required README section`);
      });
    });

    it('should handle README sections with comprehensive section types', () => {
      const allSectionTypes: MissingReadmeSection[] = [
        { section: 'title', priority: 'required', description: 'Project title and badge' },
        { section: 'description', priority: 'required', description: 'Project description' },
        { section: 'installation', priority: 'required', description: 'Installation instructions' },
        { section: 'usage', priority: 'required', description: 'Usage examples' },
        { section: 'api', priority: 'required', description: 'API documentation' },
        { section: 'examples', priority: 'recommended', description: 'Code examples' },
        { section: 'contributing', priority: 'recommended', description: 'Contribution guidelines' },
        { section: 'license', priority: 'recommended', description: 'License information' },
        { section: 'changelog', priority: 'optional', description: 'Change log' },
        { section: 'troubleshooting', priority: 'optional', description: 'Troubleshooting guide' },
        { section: 'faq', priority: 'optional', description: 'FAQ section' },
        { section: 'dependencies', priority: 'optional', description: 'Dependencies list' },
        { section: 'testing', priority: 'optional', description: 'Testing instructions' },
        { section: 'deployment', priority: 'optional', description: 'Deployment guide' }
      ];

      baseProjectAnalysis.documentation.missingReadmeSections = allSectionTypes;

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      // Should generate only required task despite many sections
      const requiredTask = candidates.find(c =>
        c.candidateId === 'docs-readme-required-sections'
      );
      expect(requiredTask).toBeDefined();
      expect(requiredTask?.priority).toBe('high');
      expect(requiredTask?.estimatedEffort).toBe('high'); // 5 required sections
      expect(requiredTask?.description).toContain('5 required README sections');

      // Should include first 3 in description with "and X more"
      expect(requiredTask?.description).toContain('title, description, installation and 2 more');
    });

    it('should handle edge case with only recommended sections', () => {
      const missingReadmeSections: MissingReadmeSection[] = [
        {
          section: 'contributing',
          priority: 'recommended',
          description: 'Contribution guidelines'
        },
        {
          section: 'license',
          priority: 'recommended',
          description: 'License information'
        }
      ];

      baseProjectAnalysis.documentation.missingReadmeSections = missingReadmeSections;

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      // Should generate recommended task since no required sections
      const recommendedTask = candidates.find(c =>
        c.candidateId === 'docs-readme-recommended-sections'
      );
      expect(recommendedTask).toBeDefined();
      expect(recommendedTask?.priority).toBe('normal');
      expect(recommendedTask?.score).toBe(0.55);
      expect(recommendedTask?.description).toContain('2 recommended README sections');
      expect(recommendedTask?.description).toContain('contributing, license');
    });

    it('should handle edge case with only optional sections', () => {
      const missingReadmeSections: MissingReadmeSection[] = [
        {
          section: 'faq',
          priority: 'optional',
          description: 'FAQ section'
        },
        {
          section: 'changelog',
          priority: 'optional',
          description: 'Change log'
        },
        {
          section: 'deployment',
          priority: 'optional',
          description: 'Deployment guide'
        }
      ];

      baseProjectAnalysis.documentation.missingReadmeSections = missingReadmeSections;

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      // Should generate optional task since >= 3 optional sections
      const optionalTask = candidates.find(c =>
        c.candidateId === 'docs-readme-optional-sections'
      );
      expect(optionalTask).toBeDefined();
      expect(optionalTask?.priority).toBe('low');
      expect(optionalTask?.score).toBe(0.35);
      expect(optionalTask?.description).toContain('3 optional README sections');
    });

    it('should not generate task for insufficient optional sections', () => {
      const missingReadmeSections: MissingReadmeSection[] = [
        {
          section: 'faq',
          priority: 'optional',
          description: 'FAQ section'
        },
        {
          section: 'changelog',
          priority: 'optional',
          description: 'Change log'
        }
      ];

      baseProjectAnalysis.documentation.missingReadmeSections = missingReadmeSections;

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      // Should NOT generate task for only 2 optional sections (< 3)
      const optionalTask = candidates.find(c =>
        c.candidateId === 'docs-readme-optional-sections'
      );
      expect(optionalTask).toBeUndefined();
    });
  });

  // ============================================================================
  // Integration Tests for Full Analysis Pipeline
  // ============================================================================

  describe('integration tests for full analysis pipeline', () => {
    it('should integrate all documentation analysis features comprehensively', () => {
      // Setup comprehensive documentation analysis with all features
      const comprehensiveAnalysis: EnhancedDocumentationAnalysis = {
        coverage: 12, // Critical coverage
        missingDocs: ['src/core/engine.ts', 'src/api/routes.ts', 'src/main.ts'], // Core files
        undocumentedExports: [
          {
            file: 'src/api/public.ts',
            name: 'PublicAPI',
            type: 'class',
            line: 1,
            isPublic: true
          },
          {
            file: 'src/api/public.ts',
            name: 'createResource',
            type: 'function',
            line: 25,
            isPublic: true
          }
        ],
        outdatedDocs: [
          {
            file: 'README.md',
            type: 'version-mismatch',
            description: 'References v1.0.0 but current is v4.0.0',
            severity: 'high',
            suggestion: 'Update all version references to v4.0.0'
          },
          {
            file: 'src/auth/legacy.ts',
            type: 'stale-reference',
            description: 'TODO: Remove when OAuth is implemented (180 days old)',
            severity: 'high',
            line: 15
          },
          {
            file: 'src/api/endpoints.ts',
            type: 'broken-link',
            description: 'JSDoc @see reference to deleted validateToken method',
            severity: 'high',
            line: 42
          },
          {
            file: 'src/utils/deprecated.ts',
            type: 'deprecated-api',
            description: '@deprecated tag lacks migration guidance',
            severity: 'high',
            line: 8
          }
        ],
        missingReadmeSections: [
          {
            section: 'installation',
            priority: 'required',
            description: 'Installation instructions'
          },
          {
            section: 'usage',
            priority: 'required',
            description: 'Usage examples'
          }
        ],
        apiCompleteness: {
          percentage: 20,
          details: {
            totalEndpoints: 50,
            documentedEndpoints: 10,
            undocumentedItems: [
              { name: 'criticalEndpoint', file: 'src/api/critical.ts', type: 'function' },
              { name: 'UserController', file: 'src/controllers/user.ts', type: 'class' }
            ],
            wellDocumentedExamples: ['src/api/auth.ts:login'],
            commonIssues: ['Missing JSDoc', 'No parameter descriptions', 'No return value docs']
          }
        }
      };

      baseProjectAnalysis.documentation = comprehensiveAnalysis;

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      // Verify all expected task types are generated
      const taskTypes = candidates.map(c => c.candidateId);

      expect(taskTypes).toContain('docs-critical-docs'); // Critical coverage
      expect(taskTypes).toContain('docs-core-module-docs'); // Core modules
      expect(taskTypes).toContain('docs-undocumented-public-exports'); // Public exports
      expect(taskTypes).toContain('docs-fix-version-mismatches-critical'); // Version mismatch
      expect(taskTypes).toContain('docs-resolve-stale-comments-critical'); // Stale comments
      expect(taskTypes).toContain('docs-fix-broken-links-critical'); // Broken links
      expect(taskTypes).toContain('docs-fix-deprecated-api-docs-critical'); // Deprecated API
      expect(taskTypes).toContain('docs-readme-required-sections'); // README sections
      expect(taskTypes).toContain('docs-api-docs-critical'); // API completeness

      // Verify high-priority tasks are correctly identified
      const highPriorityTasks = candidates.filter(c => c.priority === 'high');
      expect(highPriorityTasks.length).toBeGreaterThanOrEqual(6);

      // Verify score-based prioritization
      const sortedByScore = candidates.sort((a, b) => b.score - a.score);
      expect(sortedByScore[0].score).toBe(0.9); // Critical coverage should be highest
      expect(sortedByScore[1].score).toBe(0.85); // Public exports should be second

      // Verify all tasks have valid structure
      candidates.forEach(candidate => {
        expect(candidate.candidateId).toMatch(/^docs-/);
        expect(candidate.suggestedWorkflow).toBe('documentation');
        expect(['low', 'normal', 'high']).toContain(candidate.priority);
        expect(['low', 'medium', 'high']).toContain(candidate.estimatedEffort);
        expect(candidate.score).toBeGreaterThan(0);
        expect(candidate.score).toBeLessThanOrEqual(1);
      });

      expect(candidates.length).toBeGreaterThanOrEqual(9);
    });

    it('should handle optimal documentation state correctly', () => {
      // Setup optimal documentation analysis
      const optimalAnalysis: EnhancedDocumentationAnalysis = {
        coverage: 95, // Excellent coverage
        missingDocs: [], // No missing docs
        undocumentedExports: [], // All exports documented
        outdatedDocs: [], // No outdated docs
        missingReadmeSections: [], // Complete README
        apiCompleteness: {
          percentage: 100,
          details: {
            totalEndpoints: 20,
            documentedEndpoints: 20,
            undocumentedItems: [],
            wellDocumentedExamples: [
              'src/api/auth.ts:login',
              'src/api/users.ts:getUser',
              'src/api/posts.ts:createPost'
            ],
            commonIssues: []
          }
        }
      };

      baseProjectAnalysis.documentation = optimalAnalysis;

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      // Should generate no documentation tasks for optimal state
      expect(candidates).toHaveLength(0);
    });

    it('should handle severely degraded documentation state', () => {
      // Setup severely degraded documentation analysis
      const degradedAnalysis: EnhancedDocumentationAnalysis = {
        coverage: 5, // Extremely poor coverage
        missingDocs: Array(25).fill(0).map((_, i) => `src/file${i}.ts`), // Many missing files
        undocumentedExports: Array(20).fill(0).map((_, i) => ({
          file: `src/exports${i}.ts`,
          name: `export${i}`,
          type: 'function' as const,
          line: 1,
          isPublic: true
        })),
        outdatedDocs: [
          {
            file: 'README.md',
            type: 'version-mismatch',
            description: 'References ancient v0.1.0',
            severity: 'high'
          },
          {
            file: 'docs/everything.md',
            type: 'broken-link',
            description: 'All links are broken',
            severity: 'high'
          }
        ],
        missingReadmeSections: [
          { section: 'title', priority: 'required', description: 'Title' },
          { section: 'description', priority: 'required', description: 'Description' },
          { section: 'installation', priority: 'required', description: 'Installation' },
          { section: 'usage', priority: 'required', description: 'Usage' },
          { section: 'api', priority: 'required', description: 'API' }
        ],
        apiCompleteness: {
          percentage: 2,
          details: {
            totalEndpoints: 100,
            documentedEndpoints: 2,
            undocumentedItems: Array(98).fill(0).map((_, i) => ({
              name: `api${i}`,
              file: `src/api${i}.ts`,
              type: 'function' as const
            })),
            wellDocumentedExamples: [],
            commonIssues: [
              'No JSDoc comments',
              'Missing parameter descriptions',
              'No return type documentation',
              'No usage examples',
              'Missing error documentation'
            ]
          }
        }
      };

      baseProjectAnalysis.documentation = degradedAnalysis;

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      // Should prioritize the most critical issues
      const criticalCoverageTask = candidates.find(c => c.candidateId === 'docs-critical-docs');
      expect(criticalCoverageTask).toBeDefined();
      expect(criticalCoverageTask?.priority).toBe('high');
      expect(criticalCoverageTask?.score).toBe(0.9);

      // Should handle large datasets appropriately
      const publicExportsTask = candidates.find(c => c.candidateId === 'docs-undocumented-public-exports');
      expect(publicExportsTask).toBeDefined();
      expect(publicExportsTask?.estimatedEffort).toBe('high');

      // Should limit description lengths for readability
      candidates.forEach(candidate => {
        expect(candidate.description.length).toBeLessThan(300);
      });
    });

    it('should maintain consistency across multiple analysis runs', () => {
      const consistentAnalysis: EnhancedDocumentationAnalysis = {
        coverage: 25,
        missingDocs: ['src/consistent.ts'],
        undocumentedExports: [
          {
            file: 'src/consistent.ts',
            name: 'consistentFunction',
            type: 'function',
            line: 1,
            isPublic: true
          }
        ],
        outdatedDocs: [
          {
            file: 'README.md',
            type: 'version-mismatch',
            description: 'Consistent version mismatch',
            severity: 'medium'
          }
        ],
        missingReadmeSections: [
          {
            section: 'usage',
            priority: 'required',
            description: 'Usage section'
          }
        ],
        apiCompleteness: {
          percentage: 40,
          details: {
            totalEndpoints: 10,
            documentedEndpoints: 4,
            undocumentedItems: [],
            wellDocumentedExamples: [],
            commonIssues: []
          }
        }
      };

      baseProjectAnalysis.documentation = consistentAnalysis;

      // Run analysis multiple times
      const run1 = docsAnalyzer.analyze(baseProjectAnalysis);
      const run2 = docsAnalyzer.analyze(baseProjectAnalysis);
      const run3 = docsAnalyzer.analyze(baseProjectAnalysis);

      // Results should be identical
      expect(run1).toEqual(run2);
      expect(run2).toEqual(run3);

      // Candidate IDs should be consistent
      const ids1 = run1.map(c => c.candidateId).sort();
      const ids2 = run2.map(c => c.candidateId).sort();
      const ids3 = run3.map(c => c.candidateId).sort();

      expect(ids1).toEqual(ids2);
      expect(ids2).toEqual(ids3);
    });
  });

  // ============================================================================
  // Error Handling and Boundary Conditions
  // ============================================================================

  describe('error handling and boundary conditions', () => {
    it('should handle null and undefined inputs gracefully', () => {
      const problematicAnalysis: any = {
        coverage: null,
        missingDocs: undefined,
        undocumentedExports: null,
        outdatedDocs: undefined,
        missingReadmeSections: null,
        apiCompleteness: undefined
      };

      baseProjectAnalysis.documentation = problematicAnalysis;

      expect(() => {
        const candidates = docsAnalyzer.analyze(baseProjectAnalysis);
        expect(candidates).toBeDefined();
        expect(Array.isArray(candidates)).toBe(true);
      }).not.toThrow();
    });

    it('should handle extremely large datasets without performance issues', () => {
      const largeAnalysis: EnhancedDocumentationAnalysis = {
        coverage: 30,
        missingDocs: Array(1000).fill(0).map((_, i) => `src/large/file${i}.ts`),
        undocumentedExports: Array(500).fill(0).map((_, i) => ({
          file: `src/exports/file${i}.ts`,
          name: `export${i}`,
          type: 'function' as const,
          line: i + 1,
          isPublic: true
        })),
        outdatedDocs: Array(200).fill(0).map((_, i) => ({
          file: `docs/file${i}.md`,
          type: 'version-mismatch' as const,
          description: `Version issue ${i}`,
          severity: 'medium' as const
        })),
        missingReadmeSections: Array(14).fill(0).map((_, i) => ({
          section: 'usage' as any,
          priority: 'optional' as const,
          description: `Section ${i}`
        })),
        apiCompleteness: {
          percentage: 25,
          details: {
            totalEndpoints: 1000,
            documentedEndpoints: 250,
            undocumentedItems: Array(750).fill(0).map((_, i) => ({
              name: `api${i}`,
              file: `src/api/file${i}.ts`,
              type: 'function' as const
            })),
            wellDocumentedExamples: [],
            commonIssues: Array(50).fill(0).map((_, i) => `Issue ${i}`)
          }
        }
      };

      baseProjectAnalysis.documentation = largeAnalysis;

      const startTime = Date.now();
      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
      expect(candidates).toBeDefined();
      expect(candidates.length).toBeGreaterThan(0);

      // Should still generate appropriate tasks
      const publicExportsTask = candidates.find(c => c.candidateId === 'docs-undocumented-public-exports');
      expect(publicExportsTask).toBeDefined();
      expect(publicExportsTask?.estimatedEffort).toBe('high');
    });

    it('should validate all output candidates meet interface requirements', () => {
      baseProjectAnalysis.documentation.undocumentedExports = [
        {
          file: 'src/test.ts',
          name: 'testExport',
          type: 'function',
          line: 1,
          isPublic: true
        }
      ];

      const candidates = docsAnalyzer.analyze(baseProjectAnalysis);

      expect(candidates.length).toBeGreaterThan(0);

      candidates.forEach((candidate, index) => {
        // Check all required TaskCandidate properties exist and are valid
        expect(candidate.candidateId, `Candidate ${index} candidateId`).toBeDefined();
        expect(typeof candidate.candidateId, `Candidate ${index} candidateId type`).toBe('string');
        expect(candidate.candidateId.length, `Candidate ${index} candidateId length`).toBeGreaterThan(0);
        expect(candidate.candidateId, `Candidate ${index} candidateId prefix`).toMatch(/^docs-/);

        expect(candidate.title, `Candidate ${index} title`).toBeDefined();
        expect(typeof candidate.title, `Candidate ${index} title type`).toBe('string');
        expect(candidate.title.length, `Candidate ${index} title length`).toBeGreaterThan(0);

        expect(candidate.description, `Candidate ${index} description`).toBeDefined();
        expect(typeof candidate.description, `Candidate ${index} description type`).toBe('string');
        expect(candidate.description.length, `Candidate ${index} description length`).toBeGreaterThan(0);

        expect(candidate.priority, `Candidate ${index} priority`).toBeDefined();
        expect(['high', 'normal', 'low'], `Candidate ${index} priority value`).toContain(candidate.priority);

        expect(candidate.estimatedEffort, `Candidate ${index} estimatedEffort`).toBeDefined();
        expect(['low', 'medium', 'high'], `Candidate ${index} estimatedEffort value`).toContain(candidate.estimatedEffort);

        expect(candidate.suggestedWorkflow, `Candidate ${index} suggestedWorkflow`).toBeDefined();
        expect(candidate.suggestedWorkflow, `Candidate ${index} suggestedWorkflow value`).toBe('documentation');

        expect(candidate.rationale, `Candidate ${index} rationale`).toBeDefined();
        expect(typeof candidate.rationale, `Candidate ${index} rationale type`).toBe('string');
        expect(candidate.rationale.length, `Candidate ${index} rationale length`).toBeGreaterThan(0);

        expect(candidate.score, `Candidate ${index} score`).toBeDefined();
        expect(typeof candidate.score, `Candidate ${index} score type`).toBe('number');
        expect(candidate.score, `Candidate ${index} score range min`).toBeGreaterThan(0);
        expect(candidate.score, `Candidate ${index} score range max`).toBeLessThanOrEqual(1);
      });
    });
  });
});