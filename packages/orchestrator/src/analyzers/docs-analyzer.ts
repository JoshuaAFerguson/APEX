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

export class DocsAnalyzer extends BaseAnalyzer {
  readonly type = 'docs' as const;

  analyze(analysis: ProjectAnalysis): TaskCandidate[] {
    const candidates: TaskCandidate[] = [];

    const { coverage, missingDocs } = analysis.documentation;

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

    return candidates;
  }
}
