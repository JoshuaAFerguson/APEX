/**
 * Maintenance Strategy Analyzer
 *
 * Analyzes project dependencies and identifies maintenance tasks such as:
 * - Security vulnerabilities in dependencies
 * - Outdated dependencies that need updates
 */

import { BaseAnalyzer, TaskCandidate } from './index';
import type { ProjectAnalysis } from '../idle-processor';

export class MaintenanceAnalyzer extends BaseAnalyzer {
  readonly type = 'maintenance' as const;

  analyze(analysis: ProjectAnalysis): TaskCandidate[] {
    const candidates: TaskCandidate[] = [];

    // Priority 1: Security vulnerabilities (highest priority)
    if (analysis.dependencies.security.length > 0) {
      const securityCount = analysis.dependencies.security.length;
      candidates.push(
        this.createCandidate(
          'security-deps',
          'Fix Security Vulnerabilities',
          `Fix ${securityCount} security ${securityCount === 1 ? 'vulnerability' : 'vulnerabilities'} in dependencies: ${analysis.dependencies.security.slice(0, 3).join(', ')}${securityCount > 3 ? '...' : ''}`,
          {
            priority: 'urgent',
            effort: 'medium',
            workflow: 'maintenance',
            rationale: 'Security vulnerabilities can expose the system to attacks and data breaches',
            score: 1.0, // Highest priority
          }
        )
      );
    }

    // Priority 2: Outdated dependencies
    if (analysis.dependencies.outdated.length > 0) {
      const outdatedCount = analysis.dependencies.outdated.length;
      const hasMultiple = outdatedCount > 1;

      // Group by severity (0.x versions are more risky)
      const criticalOutdated = analysis.dependencies.outdated.filter(
        (dep) => dep.includes('@^0.') || dep.includes('@~0.')
      );

      if (criticalOutdated.length > 0) {
        candidates.push(
          this.createCandidate(
            'critical-outdated-deps',
            'Update Pre-1.0 Dependencies',
            `Update ${criticalOutdated.length} pre-1.0 ${criticalOutdated.length === 1 ? 'dependency' : 'dependencies'}: ${criticalOutdated.slice(0, 3).join(', ')}${criticalOutdated.length > 3 ? '...' : ''}`,
            {
              priority: 'high',
              effort: 'medium',
              workflow: 'maintenance',
              rationale: 'Pre-1.0 dependencies may have breaking changes and security issues',
              score: 0.8,
            }
          )
        );
      }

      // General outdated dependencies
      candidates.push(
        this.createCandidate(
          'outdated-deps',
          'Update Outdated Dependencies',
          `Update ${outdatedCount} outdated ${hasMultiple ? 'dependencies' : 'dependency'}`,
          {
            priority: 'normal',
            effort: outdatedCount > 10 ? 'high' : 'medium',
            workflow: 'maintenance',
            rationale: 'Outdated dependencies may have security vulnerabilities and missing features',
            score: 0.5,
          }
        )
      );
    }

    return candidates;
  }
}
