/**
 * v0.2.0 Documentation Auditor Implementation
 *
 * Programmatic verification tool for the v0.2.0 documentation audit requirements.
 * Based on the architecture design in docs/adr/v020-documentation-audit-architecture.md
 */

import { readFile, access } from 'fs/promises';
import { constants } from 'fs';
import { join } from 'path';
import { parse } from 'yaml';

/**
 * Result of auditing a single documentation item
 */
export interface DocumentationItemAudit {
  /** Whether the file exists */
  exists: boolean;
  /** Whether the content meets substantive content threshold */
  hasSubstantiveContent: boolean;
  /** Number of lines in the document */
  lineCount: number;
  /** Assessment of implementation accuracy */
  accuracy: 'accurate' | 'mostly-accurate' | 'outdated';
  /** Detailed findings from the audit */
  details: string[];
  /** File path that was audited */
  filePath: string;
}

/**
 * Complete v0.2.0 documentation audit results
 */
export interface V020DocumentationAudit {
  /** API Reference (OpenAPI/Swagger) audit results */
  apiReference: DocumentationItemAudit;
  /** Agent Authoring Guide audit results */
  agentAuthoring: DocumentationItemAudit;
  /** Workflow Authoring Guide audit results */
  workflowAuthoring: DocumentationItemAudit;
  /** Best Practices Guide audit results */
  bestPractices: DocumentationItemAudit;
  /** Troubleshooting Guide audit results */
  troubleshooting: DocumentationItemAudit;
  /** Overall audit status */
  overallStatus: 'passing' | 'failing';
  /** Human-readable summary */
  summary: string;
  /** Timestamp when audit was performed */
  auditDate: string;
}

/**
 * Configuration options for the documentation auditor
 */
export interface DocumentationAuditorConfig {
  /** Base directory where docs are located (default: 'docs') */
  docsDirectory?: string;
  /** Minimum lines to consider substantive content (default: 50) */
  minimumLineThreshold?: number;
  /** Whether to perform detailed content analysis (default: true) */
  detailedAnalysis?: boolean;
}

/**
 * v0.2.0 Documentation Auditor
 *
 * Implements the comprehensive verification of all 5 required documentation items
 * as specified in the v0.2.0 release requirements.
 */
export class V020DocumentationAuditor {
  private readonly config: Required<DocumentationAuditorConfig>;

  constructor(config: DocumentationAuditorConfig = {}) {
    this.config = {
      docsDirectory: config.docsDirectory ?? 'docs',
      minimumLineThreshold: config.minimumLineThreshold ?? 50,
      detailedAnalysis: config.detailedAnalysis ?? true
    };
  }

  /**
   * Perform complete v0.2.0 documentation audit
   */
  async performAudit(): Promise<V020DocumentationAudit> {
    const auditResults: V020DocumentationAudit = {
      apiReference: await this.auditApiReference(),
      agentAuthoring: await this.auditAgentAuthoring(),
      workflowAuthoring: await this.auditWorkflowAuthoring(),
      bestPractices: await this.auditBestPractices(),
      troubleshooting: await this.auditTroubleshooting(),
      overallStatus: 'passing',
      summary: '',
      auditDate: new Date().toISOString()
    };

    // Determine overall status
    auditResults.overallStatus = this.calculateOverallStatus(auditResults);
    auditResults.summary = this.generateAuditSummary(auditResults);

    return auditResults;
  }

  /**
   * Audit API Reference (OpenAPI/Swagger) documentation
   */
  private async auditApiReference(): Promise<DocumentationItemAudit> {
    const filePath = join(this.config.docsDirectory, 'openapi.yaml');

    try {
      await access(filePath, constants.F_OK);
      const content = await readFile(filePath, 'utf-8');
      const lineCount = content.split('\n').length;

      const details: string[] = [];
      let accuracy: 'accurate' | 'mostly-accurate' | 'outdated' = 'accurate';

      if (this.config.detailedAnalysis) {
        // Verify OpenAPI format and structure
        try {
          const openApiSpec = parse(content);

          if (openApiSpec.openapi) {
            details.push(`✅ OpenAPI version: ${openApiSpec.openapi}`);
          } else {
            details.push('❌ Missing OpenAPI version');
            accuracy = 'outdated';
          }

          if (openApiSpec.info) {
            details.push('✅ Contains info section');
            if (openApiSpec.info.version) {
              details.push(`📋 API version: ${openApiSpec.info.version}`);
            }
          } else {
            details.push('❌ Missing info section');
            accuracy = 'outdated';
          }

          if (openApiSpec.paths) {
            const pathCount = Object.keys(openApiSpec.paths).length;
            details.push(`✅ Contains ${pathCount} API path${pathCount === 1 ? '' : 's'}`);
          } else {
            details.push('❌ Missing paths section');
            accuracy = 'outdated';
          }

          if (openApiSpec.components?.schemas) {
            const schemaCount = Object.keys(openApiSpec.components.schemas).length;
            details.push(`✅ Contains ${schemaCount} schema definition${schemaCount === 1 ? '' : 's'}`);
          } else {
            details.push('⚠️  Missing or limited schema definitions');
            if (accuracy === 'accurate') accuracy = 'mostly-accurate';
          }

          // Check for specific API endpoints mentioned in architecture analysis
          const expectedEndpoints = ['/health', '/tasks', '/agents', '/config'];
          const actualPaths = Object.keys(openApiSpec.paths || {});
          const foundEndpoints = expectedEndpoints.filter(endpoint =>
            actualPaths.some(path => path.includes(endpoint.replace('/', '')))
          );

          if (foundEndpoints.length === expectedEndpoints.length) {
            details.push('✅ All expected API endpoints documented');
          } else {
            details.push(`⚠️  ${foundEndpoints.length}/${expectedEndpoints.length} expected endpoints found`);
            if (accuracy === 'accurate') accuracy = 'mostly-accurate';
          }

        } catch (parseError) {
          details.push('❌ Invalid YAML format');
          accuracy = 'outdated';
        }
      }

      return {
        exists: true,
        hasSubstantiveContent: lineCount > this.config.minimumLineThreshold,
        lineCount,
        accuracy,
        details,
        filePath
      };

    } catch {
      return {
        exists: false,
        hasSubstantiveContent: false,
        lineCount: 0,
        accuracy: 'outdated',
        details: ['❌ File not found'],
        filePath
      };
    }
  }

  /**
   * Audit Agent Authoring Guide documentation
   */
  private async auditAgentAuthoring(): Promise<DocumentationItemAudit> {
    const filePath = join(this.config.docsDirectory, 'agents.md');

    try {
      await access(filePath, constants.F_OK);
      const content = await readFile(filePath, 'utf-8');
      const lineCount = content.split('\n').length;

      const details: string[] = [];
      let accuracy: 'accurate' | 'mostly-accurate' | 'outdated' = 'accurate';

      if (this.config.detailedAnalysis) {
        // Check for key sections based on architecture analysis
        const expectedSections = [
          { name: 'Agent Basics', patterns: ['# Agent', 'agent basics', 'Agent Basics'] },
          { name: 'Frontmatter Reference', patterns: ['frontmatter', 'Frontmatter', 'front matter'] },
          { name: 'Tools Reference', patterns: ['tools', 'Tools', '## Tools'] },
          { name: 'Examples', patterns: ['example', 'Example', '## Example'] },
          { name: 'Best Practices', patterns: ['best practices', 'Best Practices', 'practices'] }
        ];

        let foundSections = 0;
        for (const section of expectedSections) {
          const found = section.patterns.some(pattern => content.includes(pattern));
          if (found) {
            details.push(`✅ Contains ${section.name}`);
            foundSections++;
          } else {
            details.push(`⚠️  Missing or unclear ${section.name}`);
          }
        }

        // Check for tool documentation coverage
        const toolPatterns = ['Bash', 'Read', 'Write', 'Edit', 'Grep', 'Glob'];
        const documentedTools = toolPatterns.filter(tool => content.includes(tool));
        details.push(`📋 Documents ${documentedTools.length}/${toolPatterns.length} common tools`);

        // Assessment based on findings
        if (foundSections >= 4) {
          accuracy = 'accurate';
        } else if (foundSections >= 3) {
          accuracy = 'mostly-accurate';
        } else {
          accuracy = 'outdated';
        }
      }

      return {
        exists: true,
        hasSubstantiveContent: lineCount > this.config.minimumLineThreshold,
        lineCount,
        accuracy,
        details,
        filePath
      };

    } catch {
      return {
        exists: false,
        hasSubstantiveContent: false,
        lineCount: 0,
        accuracy: 'outdated',
        details: ['❌ File not found'],
        filePath
      };
    }
  }

  /**
   * Audit Workflow Authoring Guide documentation
   */
  private async auditWorkflowAuthoring(): Promise<DocumentationItemAudit> {
    const filePath = join(this.config.docsDirectory, 'workflows.md');

    try {
      await access(filePath, constants.F_OK);
      const content = await readFile(filePath, 'utf-8');
      const lineCount = content.split('\n').length;

      const details: string[] = [];
      let accuracy: 'accurate' | 'mostly-accurate' | 'outdated' = 'accurate';

      if (this.config.detailedAnalysis) {
        // Check for key sections based on architecture analysis
        const expectedSections = [
          { name: 'Workflow Basics', patterns: ['# Workflow', 'workflow', 'Workflow Basics'] },
          { name: 'Field Reference', patterns: ['field', 'Field', 'Field Reference'] },
          { name: 'Examples', patterns: ['example', 'Example', 'workflow example'] },
          { name: 'Dependencies', patterns: ['dependencies', 'Dependencies', 'dependsOn'] },
          { name: 'Conditional Stages', patterns: ['condition', 'Condition', 'conditional'] }
        ];

        let foundSections = 0;
        for (const section of expectedSections) {
          const found = section.patterns.some(pattern => content.includes(pattern));
          if (found) {
            details.push(`✅ Contains ${section.name}`);
            foundSections++;
          } else {
            details.push(`⚠️  Missing or unclear ${section.name}`);
          }
        }

        // Check for workflow field documentation
        const workflowFields = ['name', 'agent', 'description', 'dependsOn', 'outputs'];
        const documentedFields = workflowFields.filter(field => content.includes(field));
        details.push(`📋 Documents ${documentedFields.length}/${workflowFields.length} workflow fields`);

        // Assessment based on findings
        if (foundSections >= 4) {
          accuracy = 'accurate';
        } else if (foundSections >= 3) {
          accuracy = 'mostly-accurate';
        } else {
          accuracy = 'outdated';
        }
      }

      return {
        exists: true,
        hasSubstantiveContent: lineCount > this.config.minimumLineThreshold,
        lineCount,
        accuracy,
        details,
        filePath
      };

    } catch {
      return {
        exists: false,
        hasSubstantiveContent: false,
        lineCount: 0,
        accuracy: 'outdated',
        details: ['❌ File not found'],
        filePath
      };
    }
  }

  /**
   * Audit Best Practices Guide documentation
   */
  private async auditBestPractices(): Promise<DocumentationItemAudit> {
    const filePath = join(this.config.docsDirectory, 'best-practices.md');

    try {
      await access(filePath, constants.F_OK);
      const content = await readFile(filePath, 'utf-8');
      const lineCount = content.split('\n').length;

      const details: string[] = [];
      let accuracy: 'accurate' | 'mostly-accurate' | 'outdated' = 'accurate';

      if (this.config.detailedAnalysis) {
        // Check for key sections based on architecture analysis
        const expectedSections = [
          { name: 'Task Descriptions', patterns: ['task', 'Task', 'Task Description'] },
          { name: 'Workflow Selection', patterns: ['workflow', 'Workflow', 'Workflow Selection'] },
          { name: 'Autonomy Levels', patterns: ['autonomy', 'Autonomy', 'autonomy level'] },
          { name: 'Cost Management', patterns: ['cost', 'Cost', 'budget', 'Budget'] },
          { name: 'Security', patterns: ['security', 'Security', 'secure'] }
        ];

        let foundSections = 0;
        for (const section of expectedSections) {
          const found = section.patterns.some(pattern => content.includes(pattern));
          if (found) {
            details.push(`✅ Contains ${section.name}`);
            foundSections++;
          } else {
            details.push(`⚠️  Missing or unclear ${section.name}`);
          }
        }

        // Check for autonomy level documentation
        const autonomyLevels = ['full', 'review-before-commit', 'review-before-merge', 'manual'];
        const documentedLevels = autonomyLevels.filter(level => content.includes(level));
        details.push(`📋 Documents ${documentedLevels.length}/${autonomyLevels.length} autonomy levels`);

        // Assessment based on findings
        if (foundSections >= 4) {
          accuracy = 'accurate';
        } else if (foundSections >= 3) {
          accuracy = 'mostly-accurate';
        } else {
          accuracy = 'outdated';
        }
      }

      return {
        exists: true,
        hasSubstantiveContent: lineCount > this.config.minimumLineThreshold,
        lineCount,
        accuracy,
        details,
        filePath
      };

    } catch {
      return {
        exists: false,
        hasSubstantiveContent: false,
        lineCount: 0,
        accuracy: 'outdated',
        details: ['❌ File not found'],
        filePath
      };
    }
  }

  /**
   * Audit Troubleshooting Guide documentation
   */
  private async auditTroubleshooting(): Promise<DocumentationItemAudit> {
    const filePath = join(this.config.docsDirectory, 'troubleshooting.md');

    try {
      await access(filePath, constants.F_OK);
      const content = await readFile(filePath, 'utf-8');
      const lineCount = content.split('\n').length;

      const details: string[] = [];
      let accuracy: 'accurate' | 'mostly-accurate' | 'outdated' = 'accurate';

      if (this.config.detailedAnalysis) {
        // Check for key sections based on architecture analysis
        const expectedSections = [
          { name: 'Quick Diagnostics', patterns: ['diagnostic', 'Diagnostic', 'Quick Diagnostic'] },
          { name: 'Common Issues', patterns: ['issue', 'Issue', 'Common Issue'] },
          { name: 'Debugging', patterns: ['debug', 'Debug', 'Debugging'] },
          { name: 'Windows Support', patterns: ['Windows', 'PowerShell', 'windows'] },
          { name: 'Configuration Issues', patterns: ['config', 'Configuration', 'configuration'] }
        ];

        let foundSections = 0;
        for (const section of expectedSections) {
          const found = section.patterns.some(pattern => content.includes(pattern));
          if (found) {
            details.push(`✅ Contains ${section.name}`);
            foundSections++;
          } else {
            details.push(`⚠️  Missing or unclear ${section.name}`);
          }
        }

        // Check for platform-specific documentation
        const platforms = ['Unix', 'Linux', 'macOS', 'Windows'];
        const documentedPlatforms = platforms.filter(platform => content.includes(platform));
        details.push(`📋 Documents ${documentedPlatforms.length}/${platforms.length} platforms`);

        // Assessment based on findings
        if (foundSections >= 4) {
          accuracy = 'accurate';
        } else if (foundSections >= 3) {
          accuracy = 'mostly-accurate';
        } else {
          accuracy = 'outdated';
        }
      }

      return {
        exists: true,
        hasSubstantiveContent: lineCount > this.config.minimumLineThreshold,
        lineCount,
        accuracy,
        details,
        filePath
      };

    } catch {
      return {
        exists: false,
        hasSubstantiveContent: false,
        lineCount: 0,
        accuracy: 'outdated',
        details: ['❌ File not found'],
        filePath
      };
    }
  }

  /**
   * Calculate overall audit status based on individual results
   */
  private calculateOverallStatus(audit: Omit<V020DocumentationAudit, 'overallStatus' | 'summary' | 'auditDate'>): 'passing' | 'failing' {
    const allDocuments = [
      audit.apiReference,
      audit.agentAuthoring,
      audit.workflowAuthoring,
      audit.bestPractices,
      audit.troubleshooting
    ];

    const allExist = allDocuments.every(doc => doc.exists);
    const allSubstantive = allDocuments.every(doc => doc.hasSubstantiveContent);
    const allAccurate = allDocuments.every(doc => doc.accuracy === 'accurate' || doc.accuracy === 'mostly-accurate');

    return allExist && allSubstantive && allAccurate ? 'passing' : 'failing';
  }

  /**
   * Generate human-readable audit summary
   */
  private generateAuditSummary(audit: Omit<V020DocumentationAudit, 'summary'>): string {
    const totalDocs = 5;
    const documents = [audit.apiReference, audit.agentAuthoring, audit.workflowAuthoring, audit.bestPractices, audit.troubleshooting];

    const existingDocs = documents.filter(doc => doc.exists).length;
    const substantiveDocs = documents.filter(doc => doc.hasSubstantiveContent).length;
    const accurateDocs = documents.filter(doc => doc.accuracy === 'accurate' || doc.accuracy === 'mostly-accurate').length;

    const summaryLines = [
      `v0.2.0 Documentation Audit Results`,
      `Status: ${audit.overallStatus === 'passing' ? 'PASSING ✅' : 'FAILING ❌'}`,
      `Performed: ${audit.auditDate}`,
      '',
      `Summary:`,
      `  • Documents found: ${existingDocs}/${totalDocs}`,
      `  • Substantive content: ${substantiveDocs}/${totalDocs}`,
      `  • Implementation accuracy: ${accurateDocs}/${totalDocs}`,
      '',
      'Individual Results:',
      `  • API Reference: ${this.formatDocumentStatus(audit.apiReference)}`,
      `  • Agent Authoring: ${this.formatDocumentStatus(audit.agentAuthoring)}`,
      `  • Workflow Authoring: ${this.formatDocumentStatus(audit.workflowAuthoring)}`,
      `  • Best Practices: ${this.formatDocumentStatus(audit.bestPractices)}`,
      `  • Troubleshooting: ${this.formatDocumentStatus(audit.troubleshooting)}`,
    ];

    return summaryLines.join('\n');
  }

  /**
   * Format a document audit result for display
   */
  private formatDocumentStatus(doc: DocumentationItemAudit): string {
    if (!doc.exists) return 'Missing ❌';
    if (!doc.hasSubstantiveContent) return `Insufficient content (${doc.lineCount} lines) ⚠️`;
    if (doc.accuracy === 'outdated') return `Outdated (${doc.lineCount} lines) ⚠️`;
    return `OK (${doc.lineCount} lines, ${doc.accuracy}) ✅`;
  }
}

/**
 * Convenience function to perform a v0.2.0 documentation audit
 */
export async function auditV020Documentation(config?: DocumentationAuditorConfig): Promise<V020DocumentationAudit> {
  const auditor = new V020DocumentationAuditor(config);
  return auditor.performAudit();
}