/**
 * CLI command for v0.2.0 documentation audit
 *
 * Provides a command-line interface to run the v0.2.0 documentation audit
 * and display results in a user-friendly format.
 */

import { Command } from 'commander';
import { auditV020Documentation } from '@apexcli/core';

interface AuditDocsOptions {
  /** Output format: 'text' | 'json' | 'summary' */
  format?: 'text' | 'json' | 'summary';
  /** Directory containing documentation (default: docs) */
  docsDir?: string;
  /** Minimum lines for substantive content (default: 50) */
  threshold?: number;
  /** Skip detailed analysis for faster execution */
  skipDetails?: boolean;
  /** Exit with non-zero code if audit fails */
  strict?: boolean;
}

/**
 * Create the audit-docs-v020 command
 */
export function createAuditDocsV020Command(): Command {
  return new Command('audit-docs-v020')
    .description('Audit v0.2.0 documentation completeness and accuracy')
    .option('-f, --format <format>', 'Output format (text|json|summary)', 'text')
    .option('-d, --docs-dir <dir>', 'Documentation directory', 'docs')
    .option('-t, --threshold <number>', 'Minimum lines for substantive content', '50')
    .option('--skip-details', 'Skip detailed content analysis for faster execution')
    .option('--strict', 'Exit with non-zero code if audit fails')
    .action(async (options: AuditDocsOptions) => {
      try {
        await executeAuditDocsV020(options);
      } catch (error) {
        console.error('❌ Failed to execute v0.2.0 documentation audit:', error);
        process.exit(1);
      }
    });
}

/**
 * Execute the v0.2.0 documentation audit
 */
async function executeAuditDocsV020(options: AuditDocsOptions): Promise<void> {
  const { format = 'text', docsDir = 'docs', threshold = 50, skipDetails = false, strict = false } = options;

  console.log('🔍 Starting v0.2.0 documentation audit...');

  // Perform the audit
  const auditResults = await auditV020Documentation({
    docsDirectory: docsDir,
    minimumLineThreshold: Number(threshold),
    detailedAnalysis: !skipDetails
  });

  // Output results based on format
  switch (format) {
    case 'json':
      console.log(JSON.stringify(auditResults, null, 2));
      break;

    case 'summary':
      console.log(auditResults.summary);
      break;

    case 'text':
    default:
      outputTextFormat(auditResults);
      break;
  }

  // Exit with error code if strict mode and audit failed
  if (strict && auditResults.overallStatus === 'failing') {
    console.error('❌ Documentation audit failed - exiting with error code 1');
    process.exit(1);
  }

  console.log('✅ Documentation audit completed');
}

/**
 * Output audit results in detailed text format
 */
function outputTextFormat(results: Awaited<ReturnType<typeof auditV020Documentation>>): void {
  console.log('\n📋 v0.2.0 Documentation Audit Report');
  console.log('=====================================\n');

  // Overall status
  const statusEmoji = results.overallStatus === 'passing' ? '✅' : '❌';
  console.log(`Overall Status: ${statusEmoji} ${results.overallStatus.toUpperCase()}`);
  console.log(`Audit Date: ${results.auditDate}`);
  console.log('');

  // Individual document results
  const documents = [
    { name: 'API Reference (openapi.yaml)', result: results.apiReference },
    { name: 'Agent Authoring Guide (agents.md)', result: results.agentAuthoring },
    { name: 'Workflow Authoring Guide (workflows.md)', result: results.workflowAuthoring },
    { name: 'Best Practices Guide (best-practices.md)', result: results.bestPractices },
    { name: 'Troubleshooting Guide (troubleshooting.md)', result: results.troubleshooting },
  ];

  for (const { name, result } of documents) {
    console.log(`📄 ${name}`);
    console.log(`   Path: ${result.filePath}`);
    console.log(`   Exists: ${result.exists ? '✅' : '❌'}`);

    if (result.exists) {
      console.log(`   Lines: ${result.lineCount}`);
      console.log(`   Substantive Content: ${result.hasSubstantiveContent ? '✅' : '❌'}`);
      console.log(`   Accuracy: ${result.accuracy}`);

      if (result.details.length > 0) {
        console.log(`   Details:`);
        for (const detail of result.details) {
          console.log(`     ${detail}`);
        }
      }
    }
    console.log('');
  }

  // Summary
  console.log('Summary');
  console.log('-------');
  console.log(results.summary);
}

// Export for use in main CLI
export { AuditDocsOptions, executeAuditDocsV020 };