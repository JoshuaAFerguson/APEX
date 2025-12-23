/**
 * Documentation Strategy Analyzer
 *
 * Analyzes documentation coverage and identifies opportunities such as:
 * - Missing documentation for key modules
 * - Low overall documentation coverage
 * - Outdated or incomplete documentation
 */

import { BaseAnalyzer, TaskCandidate } from './index';
import type { ProjectAnalysis } from '../idle-processor';
import type { OutdatedDocumentation } from '@apexcli/core';

export class DocsAnalyzer extends BaseAnalyzer {
  readonly type = 'docs' as const;

  analyze(analysis: ProjectAnalysis): TaskCandidate[] {
    const candidates: TaskCandidate[] = [];

    const { coverage, missingDocs, outdatedDocs } = analysis.documentation;

    // Priority 1: Critically low documentation coverage
    if (coverage < 20) {
      candidates.push(
        this.createCandidate(
          'critical-docs',
          'Add Critical Documentation',
          'Create essential documentation for the project including README, API docs, and setup guide',
          {
            priority: 'high',
            effort: 'high',
            workflow: 'documentation',
            rationale: 'Projects with less than 20% documentation coverage are difficult to onboard new developers',
            score: 0.9,
          }
        )
      );
    }

    // Priority 2: Missing documentation for specific files
    if (missingDocs.length > 0) {
      // Identify high-priority files (core modules, API endpoints, etc.)
      const coreFiles = missingDocs.filter(
        (file) =>
          file.includes('index') ||
          file.includes('core') ||
          file.includes('main') ||
          file.includes('api') ||
          file.includes('service')
      );

      if (coreFiles.length > 0) {
        candidates.push(
          this.createCandidate(
            'core-module-docs',
            'Document Core Modules',
            `Add documentation for ${coreFiles.length} core ${coreFiles.length === 1 ? 'module' : 'modules'}: ${coreFiles.slice(0, 3).join(', ')}${coreFiles.length > 3 ? '...' : ''}`,
            {
              priority: 'normal',
              effort: 'medium',
              workflow: 'documentation',
              rationale: 'Core modules should be well-documented as they are the foundation of the project',
              score: 0.7,
            }
          )
        );
      }

      // General missing documentation
      if (missingDocs.length > 5) {
        candidates.push(
          this.createCandidate(
            'missing-docs',
            'Add Missing Documentation',
            `Add documentation for ${missingDocs.length} undocumented ${missingDocs.length === 1 ? 'file' : 'files'}`,
            {
              priority: 'low',
              effort: missingDocs.length > 10 ? 'high' : 'medium',
              workflow: 'documentation',
              rationale: 'Good documentation improves maintainability and developer experience',
              score: 0.5,
            }
          )
        );
      }
    }

    // Priority 3: Low but not critical documentation coverage
    if (coverage >= 20 && coverage < 50) {
      candidates.push(
        this.createCandidate(
          'improve-docs-coverage',
          'Improve Documentation Coverage',
          `Increase documentation coverage from ${coverage.toFixed(1)}% to at least 50%`,
          {
            priority: 'low',
            effort: 'medium',
            workflow: 'documentation',
            rationale: 'Better documentation coverage makes the project more accessible to contributors',
            score: 0.4,
          }
        )
      );
    }

    // Priority 4: README improvements (if we can detect it)
    if (coverage < 30 && missingDocs.some((f) => f.toLowerCase().includes('readme'))) {
      candidates.push(
        this.createCandidate(
          'readme-improvements',
          'Improve README',
          'Enhance the project README with installation instructions, usage examples, and contribution guidelines',
          {
            priority: 'normal',
            effort: 'low',
            workflow: 'documentation',
            rationale: 'A good README is the first thing new users and contributors see',
            score: 0.6,
          }
        )
      );
    }

    // Priority 5: Stale TODO/FIXME/HACK comments
    this.processStaleComments(outdatedDocs, candidates);

    // Priority 6: Version mismatches
    this.processVersionMismatches(outdatedDocs, candidates);

    // Priority 7: Broken links
    this.processBrokenLinks(outdatedDocs, candidates);

    // Priority 8: Deprecated API documentation issues
    this.processDeprecatedApiDocs(outdatedDocs, candidates);

    return candidates;
  }

  /**
   * Process stale TODO/FIXME/HACK comments
   */
  private processStaleComments(outdatedDocs: OutdatedDocumentation[], candidates: TaskCandidate[]): void {
    const staleComments = outdatedDocs.filter((doc) => doc.type === 'stale-reference');
    if (staleComments.length > 0) {
      // Group by severity
      const highSeverityComments = staleComments.filter((c) => c.severity === 'high');
      const mediumSeverityComments = staleComments.filter((c) => c.severity === 'medium');

      if (highSeverityComments.length > 0) {
        candidates.push(
          this.createCandidate(
            'resolve-stale-comments-critical',
            'Resolve Critical Stale Comments',
            `Review and resolve ${highSeverityComments.length} TODO/FIXME/HACK comment${highSeverityComments.length === 1 ? '' : 's'} that have been open for over 90 days`,
            {
              priority: 'high',
              effort: 'medium',
              workflow: 'documentation',
              rationale: 'Long-standing TODO comments may indicate technical debt or forgotten features',
              score: 0.8,
            }
          )
        );
      } else if (mediumSeverityComments.length > 0) {
        candidates.push(
          this.createCandidate(
            'resolve-stale-comments-medium',
            'Resolve Stale Comments',
            `Review and resolve ${mediumSeverityComments.length} TODO/FIXME/HACK comment${mediumSeverityComments.length === 1 ? '' : 's'} that have been open for over 60 days`,
            {
              priority: 'normal',
              effort: 'low',
              workflow: 'documentation',
              rationale: 'Stale TODO comments should be reviewed and either resolved or updated',
              score: 0.6,
            }
          )
        );
      } else if (staleComments.length > 0) {
        candidates.push(
          this.createCandidate(
            'resolve-stale-comments',
            'Review Stale Comments',
            `Review ${staleComments.length} TODO/FIXME/HACK comment${staleComments.length === 1 ? '' : 's'} that have been open for over 30 days`,
            {
              priority: 'low',
              effort: 'low',
              workflow: 'documentation',
              rationale: 'Regular review of TODO comments prevents them from becoming forgotten technical debt',
              score: 0.4,
            }
          )
        );
      }
    }
  }

  /**
   * Process version mismatch issues from VersionMismatchDetector
   */
  private processVersionMismatches(outdatedDocs: OutdatedDocumentation[], candidates: TaskCandidate[]): void {
    const versionMismatches = outdatedDocs.filter((doc) => doc.type === 'version-mismatch');
    if (versionMismatches.length > 0) {
      // Group by severity
      const highSeverityMismatches = versionMismatches.filter((c) => c.severity === 'high');
      const mediumSeverityMismatches = versionMismatches.filter((c) => c.severity === 'medium');

      if (highSeverityMismatches.length > 0) {
        candidates.push(
          this.createCandidate(
            'fix-version-mismatches-critical',
            'Fix Critical Version Mismatches',
            `Update ${highSeverityMismatches.length} critical version mismatch${highSeverityMismatches.length === 1 ? '' : 'es'} between package.json and documentation`,
            {
              priority: 'high',
              effort: 'medium',
              workflow: 'documentation',
              rationale: 'Version mismatches cause confusion for users following outdated installation/upgrade instructions',
              score: 0.8,
            }
          )
        );
      } else if (mediumSeverityMismatches.length > 0) {
        candidates.push(
          this.createCandidate(
            'fix-version-mismatches-medium',
            'Fix Version Mismatches',
            `Update ${mediumSeverityMismatches.length} version mismatch${mediumSeverityMismatches.length === 1 ? '' : 'es'} between package.json and documentation`,
            {
              priority: 'normal',
              effort: 'low',
              workflow: 'documentation',
              rationale: 'Version mismatches should be resolved to maintain accurate documentation',
              score: 0.6,
            }
          )
        );
      } else if (versionMismatches.length > 0) {
        candidates.push(
          this.createCandidate(
            'fix-version-mismatches',
            'Review Version References',
            `Review ${versionMismatches.length} version reference${versionMismatches.length === 1 ? '' : 's'} in documentation for accuracy`,
            {
              priority: 'low',
              effort: 'low',
              workflow: 'documentation',
              rationale: 'Regular review of version references ensures documentation stays current',
              score: 0.4,
            }
          )
        );
      }
    }
  }

  /**
   * Process broken link issues from CrossReferenceValidator
   */
  private processBrokenLinks(outdatedDocs: OutdatedDocumentation[], candidates: TaskCandidate[]): void {
    const brokenLinks = outdatedDocs.filter((doc) => doc.type === 'broken-link');
    if (brokenLinks.length > 0) {
      // Group by severity
      const highSeverityLinks = brokenLinks.filter((c) => c.severity === 'high');
      const mediumSeverityLinks = brokenLinks.filter((c) => c.severity === 'medium');

      if (highSeverityLinks.length > 0) {
        candidates.push(
          this.createCandidate(
            'fix-broken-links-critical',
            'Fix Critical Broken Links',
            `Fix ${highSeverityLinks.length} critical broken link${highSeverityLinks.length === 1 ? '' : 's'} in documentation and JSDoc comments`,
            {
              priority: 'high',
              effort: 'medium',
              workflow: 'documentation',
              rationale: 'Broken links in documentation (especially @see tags) indicate API changes that haven\'t been reflected in documentation',
              score: 0.8,
            }
          )
        );
      } else if (mediumSeverityLinks.length > 0) {
        candidates.push(
          this.createCandidate(
            'fix-broken-links-medium',
            'Fix Broken Documentation Links',
            `Fix ${mediumSeverityLinks.length} broken link${mediumSeverityLinks.length === 1 ? '' : 's'} in documentation`,
            {
              priority: 'normal',
              effort: 'low',
              workflow: 'documentation',
              rationale: 'Broken links reduce documentation usability and user experience',
              score: 0.6,
            }
          )
        );
      } else if (brokenLinks.length > 0) {
        candidates.push(
          this.createCandidate(
            'fix-broken-links',
            'Review Documentation Links',
            `Review ${brokenLinks.length} documentation link${brokenLinks.length === 1 ? '' : 's'} for accuracy`,
            {
              priority: 'low',
              effort: 'low',
              workflow: 'documentation',
              rationale: 'Regular review of documentation links maintains content quality',
              score: 0.4,
            }
          )
        );
      }
    }
  }

  /**
   * Process deprecated API documentation issues from JSDocDetector
   */
  private processDeprecatedApiDocs(outdatedDocs: OutdatedDocumentation[], candidates: TaskCandidate[]): void {
    const deprecatedApiDocs = outdatedDocs.filter((doc) => doc.type === 'deprecated-api');
    if (deprecatedApiDocs.length > 0) {
      // Group by severity
      const highSeverityDocs = deprecatedApiDocs.filter((c) => c.severity === 'high');
      const mediumSeverityDocs = deprecatedApiDocs.filter((c) => c.severity === 'medium');

      if (highSeverityDocs.length > 0) {
        candidates.push(
          this.createCandidate(
            'fix-deprecated-api-docs-critical',
            'Document Critical Deprecated APIs',
            `Improve ${highSeverityDocs.length} critical @deprecated tag${highSeverityDocs.length === 1 ? '' : 's'} with migration guidance`,
            {
              priority: 'high',
              effort: 'medium',
              workflow: 'documentation',
              rationale: 'Poorly documented @deprecated tags make migration difficult for API consumers',
              score: 0.8,
            }
          )
        );
      } else if (mediumSeverityDocs.length > 0) {
        candidates.push(
          this.createCandidate(
            'fix-deprecated-api-docs-medium',
            'Improve Deprecated API Documentation',
            `Enhance ${mediumSeverityDocs.length} @deprecated tag${mediumSeverityDocs.length === 1 ? '' : 's'} with better documentation`,
            {
              priority: 'normal',
              effort: 'low',
              workflow: 'documentation',
              rationale: '@deprecated tags should provide clear alternatives and migration paths',
              score: 0.6,
            }
          )
        );
      } else if (deprecatedApiDocs.length > 0) {
        candidates.push(
          this.createCandidate(
            'fix-deprecated-api-docs',
            'Review Deprecated API Tags',
            `Review ${deprecatedApiDocs.length} @deprecated tag${deprecatedApiDocs.length === 1 ? '' : 's'} for completeness`,
            {
              priority: 'low',
              effort: 'low',
              workflow: 'documentation',
              rationale: 'Regular review of @deprecated tags ensures they provide adequate guidance',
              score: 0.4,
            }
          )
        );
      }
    }
  }
}
