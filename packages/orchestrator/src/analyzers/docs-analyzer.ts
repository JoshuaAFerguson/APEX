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
import type { OutdatedDocumentation, UndocumentedExport, MissingReadmeSection, APICompleteness } from '@apexcli/core';

export class DocsAnalyzer extends BaseAnalyzer {
  readonly type = 'docs' as const;

  analyze(analysis: ProjectAnalysis): TaskCandidate[] {
    const candidates: TaskCandidate[] = [];

    const {
      coverage,
      missingDocs,
      outdatedDocs,
      undocumentedExports,
      missingReadmeSections,
      apiCompleteness
    } = analysis.documentation;

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

    // Priority 9: Undocumented exports
    if (undocumentedExports) {
      this.processUndocumentedExports(undocumentedExports, candidates);
    }

    // Priority 10: Missing README sections
    if (missingReadmeSections) {
      this.processMissingReadmeSections(missingReadmeSections, candidates);
    }

    // Priority 11: Incomplete API documentation
    if (apiCompleteness) {
      this.processIncompleteApiDocs(apiCompleteness, candidates);
    }

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
   * Process undocumented exports
   */
  private processUndocumentedExports(undocumentedExports: UndocumentedExport[], candidates: TaskCandidate[]): void {
    if (undocumentedExports.length === 0) return;

    // Group by priority: public APIs first, then critical types, then others
    const publicExports = undocumentedExports.filter(exp => exp.isPublic);
    const criticalTypeExports = undocumentedExports.filter(
      exp => !exp.isPublic && (exp.type === 'class' || exp.type === 'interface')
    );
    const otherExports = undocumentedExports.filter(
      exp => !exp.isPublic && exp.type !== 'class' && exp.type !== 'interface'
    );

    // Priority 1: Public API exports (highest priority)
    if (publicExports.length > 0) {
      const effort = this.estimateEffortForExportCount(publicExports.length);
      const examples = publicExports.slice(0, 3).map(exp => `${exp.name} (${exp.type})`).join(', ');
      const moreCount = publicExports.length > 3 ? publicExports.length - 3 : 0;

      candidates.push(
        this.createCandidate(
          'undocumented-public-exports',
          'Document Public API Exports',
          `Add JSDoc documentation for ${publicExports.length} public API export${publicExports.length === 1 ? '' : 's'}: ${examples}${moreCount > 0 ? ` and ${moreCount} more` : ''}`,
          {
            priority: 'high',
            effort,
            workflow: 'documentation',
            rationale: 'Public APIs are user-facing and require documentation for usability and maintainability',
            score: 0.85,
          }
        )
      );
    }

    // Priority 2: Critical types (classes, interfaces) - only if no public exports
    else if (criticalTypeExports.length > 0) {
      const effort = this.estimateEffortForExportCount(criticalTypeExports.length);
      const examples = criticalTypeExports.slice(0, 3).map(exp => `${exp.name} (${exp.type})`).join(', ');
      const moreCount = criticalTypeExports.length > 3 ? criticalTypeExports.length - 3 : 0;

      candidates.push(
        this.createCandidate(
          'undocumented-critical-types',
          'Document Core Type Exports',
          `Add JSDoc documentation for ${criticalTypeExports.length} core type export${criticalTypeExports.length === 1 ? '' : 's'}: ${examples}${moreCount > 0 ? ` and ${moreCount} more` : ''}`,
          {
            priority: 'normal',
            effort,
            workflow: 'documentation',
            rationale: 'Classes and interfaces define contracts and require clear documentation for proper usage',
            score: 0.65,
          }
        )
      );
    }

    // Priority 3: Other undocumented exports - only if more than 5 and no higher priority exports
    else if (otherExports.length > 5) {
      const effort = this.estimateEffortForExportCount(otherExports.length);

      candidates.push(
        this.createCandidate(
          'undocumented-exports',
          'Add JSDoc to Undocumented Exports',
          `Add JSDoc documentation for ${otherExports.length} undocumented export${otherExports.length === 1 ? '' : 's'}`,
          {
            priority: 'low',
            effort,
            workflow: 'documentation',
            rationale: 'Complete documentation improves code maintainability and developer experience',
            score: 0.45,
          }
        )
      );
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

  /**
   * Process missing README sections
   */
  private processMissingReadmeSections(missingReadmeSections: MissingReadmeSection[], candidates: TaskCandidate[]): void {
    if (missingReadmeSections.length === 0) return;

    // Group by priority
    const requiredSections = missingReadmeSections.filter(section => section.priority === 'required');
    const recommendedSections = missingReadmeSections.filter(section => section.priority === 'recommended');
    const optionalSections = missingReadmeSections.filter(section => section.priority === 'optional');

    // Priority 1: Required sections (highest priority)
    if (requiredSections.length > 0) {
      const effort = this.estimateEffortForSectionCount(requiredSections.length);
      const sections = requiredSections.slice(0, 3).map(s => s.section).join(', ');
      const moreCount = requiredSections.length > 3 ? requiredSections.length - 3 : 0;

      candidates.push(
        this.createCandidate(
          'readme-required-sections',
          'Add Required README Sections',
          `Add ${requiredSections.length} required README section${requiredSections.length === 1 ? '' : 's'}: ${sections}${moreCount > 0 ? ` and ${moreCount} more` : ''}`,
          {
            priority: 'high',
            effort,
            workflow: 'documentation',
            rationale: 'Required README sections are essential for project usability and onboarding',
            score: 0.8,
          }
        )
      );
    }

    // Priority 2: Recommended sections - only if no required sections
    else if (recommendedSections.length > 0) {
      const effort = this.estimateEffortForSectionCount(recommendedSections.length);
      const sections = recommendedSections.slice(0, 3).map(s => s.section).join(', ');
      const moreCount = recommendedSections.length > 3 ? recommendedSections.length - 3 : 0;

      candidates.push(
        this.createCandidate(
          'readme-recommended-sections',
          'Add Recommended README Sections',
          `Add ${recommendedSections.length} recommended README section${recommendedSections.length === 1 ? '' : 's'}: ${sections}${moreCount > 0 ? ` and ${moreCount} more` : ''}`,
          {
            priority: 'normal',
            effort,
            workflow: 'documentation',
            rationale: 'Recommended README sections improve developer experience and project accessibility',
            score: 0.55,
          }
        )
      );
    }

    // Priority 3: Optional sections - only if more than 2 and no higher priority sections
    else if (optionalSections.length > 2) {
      const effort = this.estimateEffortForSectionCount(optionalSections.length);

      candidates.push(
        this.createCandidate(
          'readme-optional-sections',
          'Enhance README with Additional Sections',
          `Add ${optionalSections.length} optional README section${optionalSections.length === 1 ? '' : 's'} to provide comprehensive project documentation`,
          {
            priority: 'low',
            effort,
            workflow: 'documentation',
            rationale: 'Optional sections provide polish and completeness to project documentation',
            score: 0.35,
          }
        )
      );
    }
  }

  /**
   * Estimate effort based on the number of exports to document
   */
  private estimateEffortForExportCount(count: number): 'low' | 'medium' | 'high' {
    if (count <= 5) return 'low';
    if (count <= 15) return 'medium';
    return 'high';
  }

  /**
   * Process incomplete API documentation
   */
  private processIncompleteApiDocs(apiCompleteness: APICompleteness, candidates: TaskCandidate[]): void {
    const { percentage, details } = apiCompleteness;

    // Priority 1: Critical API coverage (< 30%)
    if (percentage < 30) {
      const effort = this.estimateEffortForApiItems(details.undocumentedItems.length);

      candidates.push(
        this.createCandidate(
          'api-docs-critical',
          'Document Critical API Surface',
          `Increase API documentation coverage from ${percentage.toFixed(1)}% to at least 30% by documenting ${details.undocumentedItems.length} API item${details.undocumentedItems.length === 1 ? '' : 's'}`,
          {
            priority: 'high',
            effort,
            workflow: 'documentation',
            rationale: 'Low API coverage indicates major gaps affecting usability and developer adoption',
            score: 0.75,
          }
        )
      );
    }

    // Priority 2: Medium API coverage (30-60%)
    else if (percentage >= 30 && percentage < 60) {
      const effort = this.estimateEffortForApiItems(details.undocumentedItems.length);

      candidates.push(
        this.createCandidate(
          'api-docs-improvement',
          'Improve API Documentation Coverage',
          `Increase API documentation coverage from ${percentage.toFixed(1)}% to at least 60% by documenting ${details.undocumentedItems.length} remaining API item${details.undocumentedItems.length === 1 ? '' : 's'}`,
          {
            priority: 'normal',
            effort,
            workflow: 'documentation',
            rationale: 'Good API coverage improves developer experience and reduces support burden',
            score: 0.55,
          }
        )
      );
    }

    // Priority 3: Good coverage with remaining items (60-80%)
    else if (percentage >= 60 && percentage < 80 && details.undocumentedItems.length > 0) {
      const effort = this.estimateEffortForApiItems(details.undocumentedItems.length);

      candidates.push(
        this.createCandidate(
          'api-docs-completion',
          'Complete API Documentation',
          `Complete API documentation by documenting the remaining ${details.undocumentedItems.length} undocumented API item${details.undocumentedItems.length === 1 ? '' : 's'}`,
          {
            priority: 'low',
            effort,
            workflow: 'documentation',
            rationale: 'Completing API documentation provides comprehensive coverage for all public interfaces',
            score: 0.4,
          }
        )
      );
    }

    // Priority 4: Quality issues (even with good coverage)
    else if (details.commonIssues.length > 0) {
      candidates.push(
        this.createCandidate(
          'api-docs-quality',
          'Address API Documentation Quality Issues',
          `Address ${details.commonIssues.length} common API documentation issue${details.commonIssues.length === 1 ? '' : 's'}: ${details.commonIssues.slice(0, 2).join(', ')}${details.commonIssues.length > 2 ? '...' : ''}`,
          {
            priority: 'low',
            effort: 'low',
            workflow: 'documentation',
            rationale: 'Improving documentation quality enhances clarity and reduces developer confusion',
            score: 0.3,
          }
        )
      );
    }
  }

  /**
   * Estimate effort based on the number of README sections to add
   */
  private estimateEffortForSectionCount(count: number): 'low' | 'medium' | 'high' {
    if (count <= 2) return 'low';
    if (count <= 4) return 'medium';
    return 'high';
  }

  /**
   * Estimate effort based on the number of API items to document
   */
  private estimateEffortForApiItems(count: number): 'low' | 'medium' | 'high' {
    if (count <= 10) return 'low';
    if (count <= 25) return 'medium';
    return 'high';
  }
}
