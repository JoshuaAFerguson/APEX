/**
 * Maintenance Strategy Analyzer
 *
 * Analyzes project dependencies and identifies maintenance tasks such as:
 * - Security vulnerabilities in dependencies with CVE pattern matching
 * - CVSS-based severity categorization
 * - Outdated dependencies that need updates
 */

import { BaseAnalyzer, TaskCandidate, RemediationSuggestion } from './index';
import type { ProjectAnalysis, SecurityVulnerability, VulnerabilitySeverity, DeprecatedPackage } from '../idle-processor';

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
        candidates.push(this.createSecurityGroupTask(bySeverity.low, 'low', 0.5));
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
            remediationSuggestions: this.buildLegacySecurityRemediation(analysis.dependencies.security),
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
              remediationSuggestions: this.buildOutdatedDependenciesRemediation(criticalOutdated, true),
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
            remediationSuggestions: this.buildOutdatedDependenciesRemediation(analysis.dependencies.outdated, false),
          }
        )
      );
    }

    // Priority 3: Deprecated packages
    if (analysis.dependencies.deprecatedPackages && analysis.dependencies.deprecatedPackages.length > 0) {
      const deprecatedPackages = analysis.dependencies.deprecatedPackages;

      for (const deprecatedPkg of deprecatedPackages) {
        candidates.push(this.createDeprecatedPackageTask(deprecatedPkg));
      }
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
        remediationSuggestions: this.buildSecurityRemediationSuggestions(vulnerability),
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
        remediationSuggestions: this.buildGroupSecurityRemediationSuggestions(vulnerabilities),
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

  /**
   * Create task for deprecated package replacement
   */
  private createDeprecatedPackageTask(deprecatedPkg: DeprecatedPackage): TaskCandidate {
    // Determine priority based on whether there's a replacement suggestion
    const priority = deprecatedPkg.replacement ? 'normal' : 'high';
    const score = deprecatedPkg.replacement ? 0.6 : 0.8;

    // Create title with replacement info
    const title = deprecatedPkg.replacement
      ? `Replace Deprecated Package: ${deprecatedPkg.name} → ${deprecatedPkg.replacement}`
      : `Replace Deprecated Package: ${deprecatedPkg.name}`;

    // Build description
    const description = this.buildDeprecatedPackageDescription(deprecatedPkg);

    // Build rationale
    const rationale = this.buildDeprecatedPackageRationale(deprecatedPkg);

    // Create a URL-safe candidate ID
    const safePackageName = deprecatedPkg.name.replace(/[^a-zA-Z0-9-]/g, '-');

    return this.createCandidate(
      `deprecated-pkg-${safePackageName}`,
      title,
      description,
      {
        priority,
        effort: 'medium',
        workflow: 'maintenance',
        rationale,
        score,
        remediationSuggestions: this.buildDeprecatedPackageRemediation(deprecatedPkg),
      }
    );
  }

  /**
   * Build detailed description for deprecated package
   */
  private buildDeprecatedPackageDescription(deprecatedPkg: DeprecatedPackage): string {
    const parts = [
      `Package ${deprecatedPkg.name}@${deprecatedPkg.currentVersion} is deprecated.`
    ];

    if (deprecatedPkg.reason) {
      parts.push(`Reason: ${deprecatedPkg.reason}`);
    }

    if (deprecatedPkg.replacement) {
      parts.push(`Recommended replacement: ${deprecatedPkg.replacement}`);
    } else {
      parts.push('No direct replacement available - manual migration required.');
    }

    return parts.join(' ');
  }

  /**
   * Build rationale for deprecated package replacement
   */
  private buildDeprecatedPackageRationale(deprecatedPkg: DeprecatedPackage): string {
    if (deprecatedPkg.replacement) {
      return `Deprecated packages may stop receiving security updates and bug fixes. Migration to ${deprecatedPkg.replacement} ensures continued support and compatibility.`;
    }

    return 'Deprecated packages may stop receiving security updates and bug fixes, requiring urgent attention to find alternative solutions.';
  }

  /**
   * Build remediation suggestions for individual security vulnerability
   */
  private buildSecurityRemediationSuggestions(vulnerability: SecurityVulnerability): RemediationSuggestion[] {
    const suggestions: RemediationSuggestion[] = [];

    // Primary update suggestion
    suggestions.push({
      type: 'npm_update',
      description: `Update ${vulnerability.name} to the latest secure version`,
      command: `npm update ${vulnerability.name}`,
      priority: vulnerability.severity === 'critical' ? 'critical' : vulnerability.severity as 'high' | 'medium' | 'low',
      expectedOutcome: `${vulnerability.name} will be updated to resolve the security vulnerability`,
    });

    // Alternative yarn command
    suggestions.push({
      type: 'yarn_upgrade',
      description: `Alternative: Use Yarn to upgrade ${vulnerability.name}`,
      command: `yarn upgrade ${vulnerability.name}`,
      priority: vulnerability.severity === 'critical' ? 'critical' : vulnerability.severity as 'high' | 'medium' | 'low',
      expectedOutcome: `${vulnerability.name} will be updated using Yarn package manager`,
    });

    // Security advisory link
    if (vulnerability.cveId && !vulnerability.cveId.startsWith('NO-CVE-')) {
      const isRealCVE = /^CVE-\d{4}-\d{4,}$/.test(vulnerability.cveId);
      if (isRealCVE) {
        suggestions.push({
          type: 'security_advisory',
          description: `Review official security advisory for ${vulnerability.cveId}`,
          link: `https://nvd.nist.gov/vuln/detail/${vulnerability.cveId}`,
          priority: 'medium',
          expectedOutcome: 'Better understanding of the vulnerability impact and mitigation strategies',
        });
      }
    }

    // Manual review for critical vulnerabilities
    if (vulnerability.severity === 'critical') {
      suggestions.push({
        type: 'manual_review',
        description: `Manually review code using ${vulnerability.name} for potential exploitation`,
        priority: 'high',
        expectedOutcome: 'Identification of any vulnerable code patterns that need immediate attention',
        warning: 'Critical vulnerabilities may require immediate mitigation steps beyond just updating',
      });
    }

    return suggestions;
  }

  /**
   * Build remediation suggestions for grouped security vulnerabilities
   */
  private buildGroupSecurityRemediationSuggestions(vulnerabilities: SecurityVulnerability[]): RemediationSuggestion[] {
    const suggestions: RemediationSuggestion[] = [];
    const packageNames = [...new Set(vulnerabilities.map(v => v.name))];
    const highestSeverity = this.getHighestSeverity(vulnerabilities);

    // Bulk update command
    suggestions.push({
      type: 'npm_update',
      description: `Update all vulnerable packages in batch`,
      command: `npm update ${packageNames.join(' ')}`,
      priority: highestSeverity === 'critical' ? 'critical' : highestSeverity as 'high' | 'medium' | 'low',
      expectedOutcome: `All ${vulnerabilities.length} security vulnerabilities will be resolved`,
    });

    // npm audit fix
    suggestions.push({
      type: 'command',
      description: 'Run npm audit fix to automatically apply security fixes',
      command: 'npm audit fix',
      priority: 'high',
      expectedOutcome: 'Automatic resolution of vulnerabilities where possible',
      warning: 'May update packages to breaking versions. Review changes carefully.',
    });

    // Alternative yarn audit
    suggestions.push({
      type: 'command',
      description: 'Alternative: Use Yarn audit to review and fix vulnerabilities',
      command: 'yarn audit --fix',
      priority: 'medium',
      expectedOutcome: 'Security vulnerabilities resolved using Yarn package manager',
    });

    return suggestions;
  }

  /**
   * Build remediation suggestions for legacy security format
   */
  private buildLegacySecurityRemediation(securityDependencies: string[]): RemediationSuggestion[] {
    const suggestions: RemediationSuggestion[] = [];

    // npm audit fix
    suggestions.push({
      type: 'command',
      description: 'Run npm audit fix to automatically resolve security vulnerabilities',
      command: 'npm audit fix',
      priority: 'critical',
      expectedOutcome: 'Automatic resolution of known security vulnerabilities',
      warning: 'May update packages to breaking versions. Test thoroughly after applying.',
    });

    // Manual audit review
    suggestions.push({
      type: 'command',
      description: 'Review detailed security audit report',
      command: 'npm audit',
      priority: 'high',
      expectedOutcome: 'Detailed information about each vulnerability for manual resolution',
    });

    // Yarn alternative
    suggestions.push({
      type: 'command',
      description: 'Alternative: Use Yarn to audit and fix vulnerabilities',
      command: 'yarn audit --fix',
      priority: 'medium',
      expectedOutcome: 'Security fixes applied using Yarn package manager',
    });

    return suggestions;
  }

  /**
   * Build remediation suggestions for outdated dependencies
   */
  private buildOutdatedDependenciesRemediation(outdatedDeps: string[], isCritical: boolean): RemediationSuggestion[] {
    const suggestions: RemediationSuggestion[] = [];

    // Extract package names from version strings
    const packageNames = outdatedDeps.map(dep => dep.split('@')[0]).filter(Boolean);

    if (isCritical) {
      // Special handling for pre-1.0 versions
      suggestions.push({
        type: 'migration_guide',
        description: 'Review migration guides before updating pre-1.0 dependencies',
        priority: 'high',
        expectedOutcome: 'Understanding of breaking changes and migration requirements',
        warning: 'Pre-1.0 versions may introduce breaking changes. Plan for testing and potential code updates.',
      });
    }

    // Update all outdated packages
    suggestions.push({
      type: 'npm_update',
      description: `Update ${isCritical ? 'critical ' : ''}outdated dependencies`,
      command: packageNames.length > 0 ? `npm update ${packageNames.join(' ')}` : 'npm update',
      priority: isCritical ? 'high' : 'medium',
      expectedOutcome: `All outdated dependencies updated to latest compatible versions`,
    });

    // Check for outdated packages first
    suggestions.push({
      type: 'command',
      description: 'Check which packages are outdated and their available versions',
      command: 'npm outdated',
      priority: 'medium',
      expectedOutcome: 'List of outdated packages with current, wanted, and latest versions',
    });

    // Yarn alternative
    suggestions.push({
      type: 'yarn_upgrade',
      description: 'Alternative: Use Yarn to upgrade outdated dependencies',
      command: 'yarn upgrade',
      priority: 'medium',
      expectedOutcome: 'Dependencies updated using Yarn package manager',
    });

    return suggestions;
  }

  /**
   * Build remediation suggestions for deprecated packages
   */
  private buildDeprecatedPackageRemediation(deprecatedPkg: DeprecatedPackage): RemediationSuggestion[] {
    const suggestions: RemediationSuggestion[] = [];

    if (deprecatedPkg.replacement) {
      // Package has a direct replacement
      suggestions.push({
        type: 'package_replacement',
        description: `Replace ${deprecatedPkg.name} with ${deprecatedPkg.replacement}`,
        command: `npm uninstall ${deprecatedPkg.name} && npm install ${deprecatedPkg.replacement}`,
        priority: 'high',
        expectedOutcome: `${deprecatedPkg.name} replaced with modern alternative ${deprecatedPkg.replacement}`,
      });

      // Migration guide
      suggestions.push({
        type: 'migration_guide',
        description: `Review migration guide for transitioning from ${deprecatedPkg.name} to ${deprecatedPkg.replacement}`,
        priority: 'high',
        expectedOutcome: 'Understanding of API changes and required code updates',
        warning: 'API changes may require updates to existing code',
      });

      // Update imports and usage
      suggestions.push({
        type: 'manual_review',
        description: `Update all imports and usage of ${deprecatedPkg.name} to use ${deprecatedPkg.replacement}`,
        priority: 'medium',
        expectedOutcome: 'All code updated to use the new package API',
      });
    } else {
      // No direct replacement available
      suggestions.push({
        type: 'manual_review',
        description: `Research alternative packages to replace ${deprecatedPkg.name}`,
        priority: 'critical',
        expectedOutcome: 'Identification of suitable alternative packages or implementations',
        warning: 'No direct replacement available. Manual research and potentially significant code changes required.',
      });

      // Documentation link
      suggestions.push({
        type: 'documentation',
        description: `Check ${deprecatedPkg.name} documentation for recommended alternatives`,
        priority: 'high',
        expectedOutcome: 'Official guidance on migration paths and alternatives',
      });
    }

    return suggestions;
  }

  /**
   * Get the highest severity level from a list of vulnerabilities
   */
  private getHighestSeverity(vulnerabilities: SecurityVulnerability[]): VulnerabilitySeverity {
    const severityOrder: VulnerabilitySeverity[] = ['critical', 'high', 'medium', 'low'];

    for (const severity of severityOrder) {
      if (vulnerabilities.some(v => v.severity === severity)) {
        return severity;
      }
    }

    return 'low';
  }
}
