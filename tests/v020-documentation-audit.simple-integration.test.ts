/**
 * Simple Integration Tests for v0.2.0 Documentation Audit
 *
 * Tests the actual integration with real file system behavior
 * without complex template strings that cause parsing issues.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { V020DocumentationAuditor, auditV020Documentation } from '../packages/core/src/audits/v020-documentation-auditor';

describe('v0.2.0 Documentation Audit Simple Integration', () => {
  const testDir = join(tmpdir(), 'apex-v020-simple-integration');
  const testDocsDir = join(testDir, 'docs');

  beforeAll(async () => {
    await mkdir(testDocsDir, { recursive: true });

    // Create simple test files
    const simpleApiSpec = `
openapi: 3.0.3
info:
  title: Test API
  version: 1.0.0
  description: Simple API for testing

paths:
  /health:
    get:
      summary: Health check
      responses:
        '200':
          description: OK
  /tasks:
    get:
      summary: Get tasks
      responses:
        '200':
          description: List of tasks
  /agents:
    get:
      summary: Get agents
      responses:
        '200':
          description: List of agents
  /config:
    get:
      summary: Get configuration
      responses:
        '200':
          description: System configuration

components:
  schemas:
    Task:
      type: object
      properties:
        id:
          type: string
        name:
          type: string
`.repeat(2); // Make it substantial

    const simpleAgentGuide = `
# Agent Authoring Guide

## Agent Basics
Learn how to create agents for APEX.

## Frontmatter Reference
Agents use YAML frontmatter to define metadata.

## Tools Reference
Available tools:
- Bash: Execute commands
- Read: Read files
- Write: Write files
- Edit: Edit files
- Grep: Search files
- Glob: Find files

## Examples
Example agent configurations are provided.

## Best Practices
Follow these best practices for agent development.
`.repeat(3);

    const simpleWorkflowGuide = `
# Workflow Authoring Guide

## Workflow Basics
Learn how to create workflows.

## Field Reference
Workflow fields:
- name: Workflow name
- agent: Agent type
- description: Description
- dependsOn: Dependencies
- outputs: Outputs

## Examples
Example workflow configurations.

## Dependencies
How to set up dependencies.

## Conditional Stages
Using conditional execution.
`.repeat(3);

    const simpleBestPractices = `
# Best Practices Guide

## Task Descriptions
Writing effective task descriptions.

## Workflow Selection
Selecting appropriate workflows.

## Autonomy Levels
Understanding autonomy levels:
- full: Full autonomy
- review-before-commit: Review before commit
- review-before-merge: Review before merge
- manual: Manual approval

## Cost Management
Managing costs effectively.

## Security
Security considerations.
`.repeat(3);

    const simpleTroubleshooting = `
# Troubleshooting Guide

## Quick Diagnostics
Quick diagnostic steps.

## Common Issues
Most common issues and solutions.

## Debugging
Debugging techniques.

## Windows Support
Windows-specific guidance.

## Configuration Issues
Configuration troubleshooting.

Supported platforms:
- Unix
- Linux
- macOS
- Windows
`.repeat(3);

    await writeFile(join(testDocsDir, 'openapi.yaml'), simpleApiSpec);
    await writeFile(join(testDocsDir, 'agents.md'), simpleAgentGuide);
    await writeFile(join(testDocsDir, 'workflows.md'), simpleWorkflowGuide);
    await writeFile(join(testDocsDir, 'best-practices.md'), simpleBestPractices);
    await writeFile(join(testDocsDir, 'troubleshooting.md'), simpleTroubleshooting);
  });

  afterAll(async () => {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should successfully audit all documentation files', async () => {
    const auditor = new V020DocumentationAuditor({
      docsDirectory: testDocsDir
    });

    const result = await auditor.performAudit();

    // Debug output
    console.log('Audit result:', JSON.stringify(result, null, 2));

    expect(result.overallStatus).toBe('passing');
    expect(result.apiReference.exists).toBe(true);
    expect(result.apiReference.hasSubstantiveContent).toBe(true);
    expect(result.agentAuthoring.exists).toBe(true);
    expect(result.agentAuthoring.hasSubstantiveContent).toBe(true);
    expect(result.workflowAuthoring.exists).toBe(true);
    expect(result.workflowAuthoring.hasSubstantiveContent).toBe(true);
    expect(result.bestPractices.exists).toBe(true);
    expect(result.bestPractices.hasSubstantiveContent).toBe(true);
    expect(result.troubleshooting.exists).toBe(true);
    expect(result.troubleshooting.hasSubstantiveContent).toBe(true);

    expect(result.summary).toContain('PASSING');
    expect(result.auditDate).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('should provide detailed OpenAPI analysis', async () => {
    const auditor = new V020DocumentationAuditor({
      docsDirectory: testDocsDir,
      detailedAnalysis: true
    });

    const result = await auditor.performAudit();

    expect(result.apiReference.details).toContain('✅ OpenAPI version: 3.0.3');
    expect(result.apiReference.details).toContain('✅ Contains info section');
    expect(result.apiReference.details).toContain('✅ All expected API endpoints documented');
    expect(result.apiReference.accuracy).toBe('accurate');
  });

  it('should work with convenience function', async () => {
    const result = await auditV020Documentation({
      docsDirectory: testDocsDir
    });

    expect(result.overallStatus).toBe('passing');
    expect(result.summary).toContain('PASSING');
  });

  it('should handle custom configuration', async () => {
    const result = await auditV020Documentation({
      docsDirectory: testDocsDir,
      minimumLineThreshold: 10,
      detailedAnalysis: true
    });

    expect(result.overallStatus).toBe('passing');
    expect(result.apiReference.hasSubstantiveContent).toBe(true);
  });

  it('should handle missing documentation gracefully', async () => {
    const emptyDir = join(testDir, 'empty');
    await mkdir(emptyDir, { recursive: true });

    const result = await auditV020Documentation({
      docsDirectory: emptyDir
    });

    expect(result.overallStatus).toBe('failing');
    expect(result.apiReference.exists).toBe(false);
    expect(result.agentAuthoring.exists).toBe(false);
    expect(result.workflowAuthoring.exists).toBe(false);
    expect(result.bestPractices.exists).toBe(false);
    expect(result.troubleshooting.exists).toBe(false);

    expect(result.summary).toContain('FAILING');

    await rm(emptyDir, { recursive: true, force: true });
  });
});