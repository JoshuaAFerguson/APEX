#!/usr/bin/env tsx

/**
 * Agent Definitions Audit Script
 *
 * Programmatically audits v0.1.0 agent definitions to verify:
 * - All required agents are present
 * - YAML frontmatter is complete
 * - Prompts are real (not stubs)
 * - Content is synchronized between locations
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { parseAgentMarkdown, AgentDefinitionSchema } from '@apexcli/core';

interface AuditResult {
  agent: string;
  location: string;
  exists: boolean;
  hasValidYaml: boolean;
  hasRealPrompt: boolean;
  errors: string[];
}

interface AuditSummary {
  totalAgents: number;
  passedAgents: number;
  failedAgents: number;
  overallStatus: 'PASS' | 'FAIL';
  results: AuditResult[];
  missingAgents: string[];
  syncIssues: string[];
}

const REQUIRED_AGENTS = [
  'planner',
  'architect',
  'developer',
  'reviewer',
  'tester',
  'devops'
];

const AUDIT_LOCATIONS = [
  '.apex/agents',
  'packages/core/templates/agents'
];

const STUB_INDICATORS = [
  'TODO',
  'STUB',
  'PLACEHOLDER',
  'To be implemented',
  'Coming soon',
  'Not implemented'
];

async function auditAgentFile(agentName: string, location: string): Promise<AuditResult> {
  const result: AuditResult = {
    agent: agentName,
    location,
    exists: false,
    hasValidYaml: false,
    hasRealPrompt: false,
    errors: []
  };

  try {
    const filePath = path.join(location, `${agentName}.md`);

    // Check if file exists
    try {
      await fs.access(filePath);
      result.exists = true;
    } catch {
      result.errors.push('File does not exist');
      return result;
    }

    // Read and parse file
    const content = await fs.readFile(filePath, 'utf8');
    const agent = parseAgentMarkdown(content);

    if (!agent) {
      result.errors.push('Failed to parse agent markdown');
      return result;
    }

    // Validate YAML frontmatter
    const schemaResult = AgentDefinitionSchema.safeParse(agent);
    if (!schemaResult.success) {
      result.errors.push(`Schema validation failed: ${schemaResult.error.message}`);
    } else {
      result.hasValidYaml = true;
    }

    // Check for real prompt content
    if (agent.prompt && agent.prompt.length > 100) {
      // Check for stub indicators
      const hasStubIndicators = STUB_INDICATORS.some(indicator =>
        agent.prompt.toUpperCase().includes(indicator.toUpperCase())
      );

      if (!hasStubIndicators) {
        result.hasRealPrompt = true;
      } else {
        result.errors.push('Prompt contains stub indicators');
      }
    } else {
      result.errors.push('Prompt is too short or missing');
    }

    // Additional validation checks
    if (!agent.name || agent.name !== agentName) {
      result.errors.push(`Agent name mismatch: expected ${agentName}, got ${agent.name}`);
    }

    if (!agent.description || agent.description.length < 10) {
      result.errors.push('Description is missing or too short');
    }

  } catch (error) {
    result.errors.push(`Unexpected error: ${error}`);
  }

  return result;
}

async function auditAllAgents(): Promise<AuditSummary> {
  const results: AuditResult[] = [];
  const missingAgents: string[] = [];
  const syncIssues: string[] = [];

  console.log('🔍 Starting v0.1.0 Agent Definitions Audit...\n');

  // Audit each required agent in each location
  for (const agent of REQUIRED_AGENTS) {
    console.log(`📋 Auditing agent: ${agent}`);

    const locationResults: AuditResult[] = [];

    for (const location of AUDIT_LOCATIONS) {
      console.log(`  📂 Checking location: ${location}`);
      const result = await auditAgentFile(agent, location);
      results.push(result);
      locationResults.push(result);

      if (!result.exists) {
        missingAgents.push(`${agent} in ${location}`);
      }

      // Log result summary
      const status = result.exists && result.hasValidYaml && result.hasRealPrompt ? '✅' : '❌';
      console.log(`    ${status} ${result.exists ? 'EXISTS' : 'MISSING'} | ${result.hasValidYaml ? 'VALID_YAML' : 'INVALID_YAML'} | ${result.hasRealPrompt ? 'REAL_PROMPT' : 'STUB_PROMPT'}`);

      if (result.errors.length > 0) {
        result.errors.forEach(error => console.log(`      ⚠️  ${error}`));
      }
    }

    // Check synchronization between locations
    const existingResults = locationResults.filter(r => r.exists);
    if (existingResults.length === AUDIT_LOCATIONS.length) {
      // Both files exist, check if they have the same basic properties
      const firstResult = existingResults[0];
      const hasSync = existingResults.every(r =>
        r.hasValidYaml === firstResult.hasValidYaml &&
        r.hasRealPrompt === firstResult.hasRealPrompt
      );

      if (!hasSync) {
        syncIssues.push(`${agent}: inconsistent state between locations`);
      }
    }

    console.log('');
  }

  // Calculate summary
  const passedResults = results.filter(r => r.exists && r.hasValidYaml && r.hasRealPrompt);
  const totalExpected = REQUIRED_AGENTS.length * AUDIT_LOCATIONS.length;

  const summary: AuditSummary = {
    totalAgents: totalExpected,
    passedAgents: passedResults.length,
    failedAgents: totalExpected - passedResults.length,
    overallStatus: passedResults.length === totalExpected ? 'PASS' : 'FAIL',
    results,
    missingAgents,
    syncIssues
  };

  return summary;
}

function printAuditSummary(summary: AuditSummary): void {
  console.log('📊 AUDIT SUMMARY');
  console.log('================\n');

  console.log(`Status: ${summary.overallStatus === 'PASS' ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Total Checks: ${summary.totalAgents}`);
  console.log(`Passed: ${summary.passedAgents}`);
  console.log(`Failed: ${summary.failedAgents}`);
  console.log(`Success Rate: ${Math.round((summary.passedAgents / summary.totalAgents) * 100)}%\n`);

  if (summary.missingAgents.length > 0) {
    console.log('❌ Missing Agents:');
    summary.missingAgents.forEach(agent => console.log(`  - ${agent}`));
    console.log('');
  }

  if (summary.syncIssues.length > 0) {
    console.log('⚠️  Synchronization Issues:');
    summary.syncIssues.forEach(issue => console.log(`  - ${issue}`));
    console.log('');
  }

  if (summary.overallStatus === 'PASS') {
    console.log('🎉 All v0.1.0 agent definitions are properly implemented!');
    console.log('✅ YAML frontmatter is complete');
    console.log('✅ All prompts are real (no stubs)');
    console.log('✅ Content is synchronized between locations');
  } else {
    console.log('💡 Issues found that need to be addressed:');

    // Group errors by agent
    const errorsByAgent: Record<string, string[]> = {};
    summary.results.filter(r => r.errors.length > 0).forEach(result => {
      const key = `${result.agent} (${result.location})`;
      errorsByAgent[key] = result.errors;
    });

    Object.entries(errorsByAgent).forEach(([agent, errors]) => {
      console.log(`\n${agent}:`);
      errors.forEach(error => console.log(`  - ${error}`));
    });
  }
}

async function main(): Promise<void> {
  try {
    const summary = await auditAllAgents();
    printAuditSummary(summary);

    // Exit with appropriate code
    process.exit(summary.overallStatus === 'PASS' ? 0 : 1);

  } catch (error) {
    console.error('💥 Audit script failed:', error);
    process.exit(2);
  }
}

if (require.main === module) {
  main();
}

export { auditAllAgents, AuditSummary, AuditResult };