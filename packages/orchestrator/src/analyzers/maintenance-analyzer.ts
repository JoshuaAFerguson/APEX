/**
 * Maintenance Strategy Analyzer
 *
 * Analyzes project dependencies and identifies maintenance tasks such as:
 * - Security vulnerabilities in dependencies with CVE pattern matching
 * - CVSS-based severity categorization
 * - Outdated dependencies that need updates
 */

import { BaseAnalyzer, TaskCandidate } from './index';
import type { ProjectAnalysis, SecurityVulnerability, VulnerabilitySeverity } from '../idle-processor';

export class MaintenanceAnalyzer extends BaseAnalyzer {
  readonly type = 'maintenance' as const;

  analyze(analysis: ProjectAnalysis): TaskCandidate[] {
    const candidates: TaskCandidate[] = [];

    // Priority 1: Security vulnerabilities with enhanced analysis
    const vulnerabilities = analysis.dependencies.securityIssues ?? [];

    if (vulnerabilities.length > 0) {
      // Group vulnerabilities by severity for prioritized task generation
      const bySeverity = this.groupBySeverity(vulnerabilities);

      // Critical vulnerabilities get individual urgent tasks
      for (const critical of bySeverity.critical) {
        candidates.push(this.createSecurityTask(critical, 'urgent', 1.0));
      }

      // High vulnerabilities - group if many, individual if few
      if (bySeverity.high.length > 0) {
        if (bySeverity.high.length <= 2) {
          // Individual tasks for small numbers
          for (const high of bySeverity.high) {
            candidates.push(this.createSecurityTask(high, 'high', 0.9));
          }
        } else {
          // Grouped task for many
          candidates.push(this.createSecurityGroupTask(bySeverity.high, 'high', 0.9));
        }
      }

      // Medium vulnerabilities - always group
      if (bySeverity.medium.length > 0) {
        candidates.push(this.createSecurityGroupTask(bySeverity.medium, 'normal', 0.7));
      }

      // Low vulnerabilities - group as low priority
      if (bySeverity.low.length > 0) {
        candidates.push(this.createSecurityGroupTask(bySeverity.low, 'low', 0.4));
      }
    } else if (analysis.dependencies.security.length > 0) {
      // Fallback to legacy format when rich data unavailable
      const securityCount = analysis.dependencies.security.length;
      candidates.push(
        this.createCandidate(
          'security-deps-legacy',
          'Fix Security Vulnerabilities',
          `Fix ${securityCount} security ${securityCount === 1 ? 'vulnerability' : 'vulnerabilities'} in dependencies: ${analysis.dependencies.security.slice(0, 3).join(', ')}${securityCount > 3 ? '...' : ''}`,
          {
            priority: 'urgent',
            effort: 'medium',
            workflow: 'maintenance',
            rationale: 'Security vulnerabilities can expose the system to attacks and data breaches',
            score: 1.0,
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

  /**
   * Group vulnerabilities by severity level
   */
  private groupBySeverity(vulnerabilities: SecurityVulnerability[]): Record<VulnerabilitySeverity, SecurityVulnerability[]> {
    const grouped: Record<VulnerabilitySeverity, SecurityVulnerability[]> = {
      critical: [],
      high: [],
      medium: [],
      low: [],
    };

    for (const vuln of vulnerabilities) {
      grouped[vuln.severity].push(vuln);
    }

    return grouped;
  }

  /**
   * Create task for individual security vulnerability
   */
  private createSecurityTask(
    vulnerability: SecurityVulnerability,
    priority: 'urgent' | 'high' | 'normal' | 'low',
    score: number
  ): TaskCandidate {
    const effort = vulnerability.severity === 'critical' ? 'high' : 'medium';
    const severityLabel = vulnerability.severity.charAt(0).toUpperCase() + vulnerability.severity.slice(1);

    // Create a URL-safe candidate ID
    const safeCveId = vulnerability.cveId.replace(/[^a-zA-Z0-9-]/g, '-');

    return this.createCandidate(
      `security-${vulnerability.severity}-${safeCveId}`,
      `Fix ${severityLabel} Security Vulnerability: ${vulnerability.cveId}`,
      this.buildSecurityDescription(vulnerability),
      {
        priority,
        effort,
        workflow: 'maintenance',
        rationale: this.buildSecurityRationale(vulnerability),
        score,
      }
    );
  }

  /**
   * Create grouped task for multiple vulnerabilities of the same severity
   */
  private createSecurityGroupTask(
    vulnerabilities: SecurityVulnerability[],
    priority: 'urgent' | 'high' | 'normal' | 'low',
    score: number
  ): TaskCandidate {
    const count = vulnerabilities.length;
    const severity = vulnerabilities[0].severity;
    const severityLabel = severity.charAt(0).toUpperCase() + severity.slice(1);
    const effort = count > 5 ? 'high' : 'medium';

    // Collect unique CVE IDs
    const cveIds = [...new Set(vulnerabilities.map(v => v.cveId))].slice(0, 3);
    const cveList = cveIds.join(', ') + (cveIds.length > 3 ? '...' : '');

    return this.createCandidate(
      `security-group-${severity}`,
      `Fix ${count} ${severityLabel} Security ${count === 1 ? 'Vulnerability' : 'Vulnerabilities'}`,
      `Address ${count} ${severity} severity security ${count === 1 ? 'vulnerability' : 'vulnerabilities'} in dependencies: ${cveList}`,
      {
        priority,
        effort,
        workflow: 'maintenance',
        rationale: this.buildGroupSecurityRationale(vulnerabilities),
        score,
      }
    );
  }

  /**
   * Build detailed description for individual vulnerability
   */
  private buildSecurityDescription(vulnerability: SecurityVulnerability): string {
    const parts = [
      `${vulnerability.severity.charAt(0).toUpperCase() + vulnerability.severity.slice(1)} vulnerability in ${vulnerability.name}@${vulnerability.affectedVersions}:`,
      vulnerability.description
    ];

    if (vulnerability.cveId && vulnerability.cveId !== 'unknown' && !vulnerability.cveId.startsWith('NO-CVE-')) {
      parts.push(`CVE: ${vulnerability.cveId}`);
    }

    return parts.join(' ');
  }

  /**
   * Build rationale for individual vulnerability
   */
  private buildSecurityRationale(vulnerability: SecurityVulnerability): string {
    const severityMessages = {
      critical: 'Critical vulnerabilities require immediate attention to prevent system compromise',
      high: 'High severity vulnerabilities pose significant security risks',
      medium: 'Medium severity vulnerabilities should be addressed promptly',
      low: 'Low severity vulnerabilities help maintain overall security posture',
    };

    const baseMessage = severityMessages[vulnerability.severity];

    if (vulnerability.cveId && !vulnerability.cveId.startsWith('NO-CVE-')) {
      return `${baseMessage}. ${vulnerability.cveId} has been publicly disclosed and may be actively exploited.`;
    }

    return baseMessage;
  }

  /**
   * Build rationale for grouped vulnerabilities
   */
  private buildGroupSecurityRationale(vulnerabilities: SecurityVulnerability[]): string {
    const count = vulnerabilities.length;
    const severity = vulnerabilities[0].severity;
    const withCVE = vulnerabilities.filter(v => v.cveId && !v.cveId.startsWith('NO-CVE-')).length;

    const baseMessage = `${count} ${severity} severity vulnerabilities need to be addressed`;

    if (withCVE > 0) {
      return `${baseMessage}. ${withCVE} have public CVE identifiers and may be actively exploited.`;
    }

    return `${baseMessage} to maintain security posture.`;
  }
}
