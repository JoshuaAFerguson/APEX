/**
 * Comprehensive Unit Tests for v0.2.0 Documentation Auditor
 *
 * Tests the V020DocumentationAuditor class implementation with various scenarios
 * including mocked file system interactions, configuration options, and edge cases.
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { readFile, access } from 'fs/promises';
import { constants } from 'fs';
import { join } from 'path';
import { parse } from 'yaml';
import {
  V020DocumentationAuditor,
  auditV020Documentation,
  type V020DocumentationAudit,
  type DocumentationItemAudit,
  type DocumentationAuditorConfig
} from '../packages/core/src/audits/v020-documentation-auditor';

// Mock filesystem functions
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  access: vi.fn()
}));

vi.mock('yaml', () => ({
  parse: vi.fn()
}));

vi.mock('fs', () => ({
  constants: {
    F_OK: 0
  }
}));

const mockReadFile = readFile as Mock;
const mockAccess = access as Mock;
const mockParse = parse as Mock;

describe('V020DocumentationAuditor Class', () => {
  let auditor: V020DocumentationAuditor;

  beforeEach(() => {
    vi.clearAllMocks();
    auditor = new V020DocumentationAuditor();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Constructor and Configuration', () => {
    it('should use default configuration when none provided', () => {
      const defaultAuditor = new V020DocumentationAuditor();
      expect(defaultAuditor).toBeInstanceOf(V020DocumentationAuditor);
    });

    it('should accept custom configuration', () => {
      const config: DocumentationAuditorConfig = {
        docsDirectory: 'custom-docs',
        minimumLineThreshold: 100,
        detailedAnalysis: false
      };
      const customAuditor = new V020DocumentationAuditor(config);
      expect(customAuditor).toBeInstanceOf(V020DocumentationAuditor);
    });

    it('should use partial configuration with defaults', () => {
      const partialConfig: DocumentationAuditorConfig = {
        minimumLineThreshold: 75
      };
      const partialAuditor = new V020DocumentationAuditor(partialConfig);
      expect(partialAuditor).toBeInstanceOf(V020DocumentationAuditor);
    });
  });

  describe('performAudit() Method', () => {
    it('should perform complete audit and return results', async () => {
      // Mock all files as existing with substantive content
      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockResolvedValue('# Test Content\n'.repeat(60));
      mockParse.mockReturnValue({
        openapi: '3.0.3',
        info: { version: '1.0.0' },
        paths: { '/test': {} },
        components: { schemas: { TestSchema: {} } }
      });

      const result = await auditor.performAudit();

      expect(result).toMatchObject({
        overallStatus: 'passing',
        auditDate: expect.any(String)
      });
      expect(result.apiReference.exists).toBe(true);
      expect(result.agentAuthoring.exists).toBe(true);
      expect(result.workflowAuthoring.exists).toBe(true);
      expect(result.bestPractices.exists).toBe(true);
      expect(result.troubleshooting.exists).toBe(true);
    });

    it('should handle missing files gracefully', async () => {
      mockAccess.mockRejectedValue(new Error('File not found'));

      const result = await auditor.performAudit();

      expect(result.overallStatus).toBe('failing');
      expect(result.apiReference.exists).toBe(false);
      expect(result.agentAuthoring.exists).toBe(false);
      expect(result.workflowAuthoring.exists).toBe(false);
      expect(result.bestPractices.exists).toBe(false);
      expect(result.troubleshooting.exists).toBe(false);
    });

    it('should detect insufficient content', async () => {
      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockResolvedValue('# Short content\nOnly two lines');
      mockParse.mockReturnValue({
        openapi: '3.0.3',
        info: {},
        paths: {}
      });

      const result = await auditor.performAudit();

      expect(result.overallStatus).toBe('failing');
      expect(result.apiReference.hasSubstantiveContent).toBe(false);
      expect(result.apiReference.lineCount).toBe(2);
    });
  });

  describe('API Reference Audit', () => {
    it('should validate proper OpenAPI structure', async () => {
      const validOpenApiContent = `
openapi: 3.0.3
info:
  title: Test API
  version: 1.0.0
paths:
  /health:
    get:
      summary: Health check
  /tasks:
    post:
      summary: Create task
  /agents:
    get:
      summary: List agents
  /config:
    get:
      summary: Get config
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

      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockResolvedValue(validOpenApiContent);
      mockParse.mockReturnValue({
        openapi: '3.0.3',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/health': {},
          '/tasks': {},
          '/agents': {},
          '/config': {}
        },
        components: {
          schemas: { Task: {} }
        }
      });

      const result = await auditor.performAudit();

      expect(result.apiReference.exists).toBe(true);
      expect(result.apiReference.hasSubstantiveContent).toBe(true);
      expect(result.apiReference.accuracy).toBe('accurate');
      expect(result.apiReference.details).toContain('✅ OpenAPI version: 3.0.3');
      expect(result.apiReference.details).toContain('✅ All expected API endpoints documented');
    });

    it('should handle invalid YAML format', async () => {
      const invalidYamlContent = `
openapi: 3.0.3
info:
  title: Test API
  version: 1.0.0
paths:
  invalid: [unclosed bracket
`.repeat(3);

      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockResolvedValue(invalidYamlContent);
      mockParse.mockImplementation(() => {
        throw new Error('Invalid YAML');
      });

      const result = await auditor.performAudit();

      expect(result.apiReference.exists).toBe(true);
      expect(result.apiReference.accuracy).toBe('outdated');
      expect(result.apiReference.details).toContain('❌ Invalid YAML format');
    });

    it('should detect missing critical sections', async () => {
      const incompleteContent = `
# Just a title
Some basic content without proper OpenAPI structure
`.repeat(30);

      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockResolvedValue(incompleteContent);
      mockParse.mockReturnValue({
        // Missing required sections
      });

      const result = await auditor.performAudit();

      expect(result.apiReference.accuracy).toBe('outdated');
      expect(result.apiReference.details.some(d => d.includes('❌ Missing'))).toBe(true);
    });
  });

  describe('Agent Authoring Guide Audit', () => {
    it('should recognize comprehensive agent documentation', async () => {
      const comprehensiveAgentContent = `
# Agent Authoring Guide

## Agent Basics
Learn how to create agents for APEX.

## Frontmatter Reference
Agents use YAML frontmatter to define metadata.

## Tools Reference
Available tools:
- Bash: Execute shell commands
- Read: Read files
- Write: Write files
- Edit: Edit existing files
- Grep: Search in files
- Glob: Find files by pattern

## Examples
Here are example agent configurations.

## Best Practices
Follow these best practices when creating agents.
`.repeat(3);

      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockResolvedValue(comprehensiveAgentContent);

      const result = await auditor.performAudit();

      expect(result.agentAuthoring.exists).toBe(true);
      expect(result.agentAuthoring.hasSubstantiveContent).toBe(true);
      expect(result.agentAuthoring.accuracy).toBe('accurate');
      expect(result.agentAuthoring.details).toContain('✅ Contains Agent Basics');
      expect(result.agentAuthoring.details).toContain('📋 Documents 6/6 common tools');
    });

    it('should handle incomplete agent documentation', async () => {
      const incompleteContent = `
# Agents
Basic information about agents.
Tools: Some tools are available.
`.repeat(20);

      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockResolvedValue(incompleteContent);

      const result = await auditor.performAudit();

      expect(result.agentAuthoring.accuracy).not.toBe('accurate');
      expect(result.agentAuthoring.details.some(d => d.includes('⚠️  Missing'))).toBe(true);
    });
  });

  describe('Workflow Authoring Guide Audit', () => {
    it('should recognize comprehensive workflow documentation', async () => {
      const comprehensiveWorkflowContent = `
# Workflow Authoring Guide

## Workflow Basics
Learn how to create workflows.

## Field Reference
Workflow fields:
- name: Workflow name
- agent: Agent type
- description: Description
- dependsOn: Dependencies
- outputs: Output specifications

## Examples
Here are workflow examples showing different patterns.

## Dependencies
How to set up task dependencies using dependsOn field.

## Conditional Stages
Using condition field to create conditional workflow stages.
`.repeat(2);

      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockResolvedValue(comprehensiveWorkflowContent);

      const result = await auditor.performAudit();

      expect(result.workflowAuthoring.exists).toBe(true);
      expect(result.workflowAuthoring.hasSubstantiveContent).toBe(true);
      expect(result.workflowAuthoring.accuracy).toBe('accurate');
      expect(result.workflowAuthoring.details).toContain('✅ Contains Workflow Basics');
      expect(result.workflowAuthoring.details).toContain('📋 Documents 5/5 workflow fields');
    });
  });

  describe('Best Practices Guide Audit', () => {
    it('should recognize comprehensive best practices documentation', async () => {
      const comprehensiveBestPracticesContent = `
# Best Practices Guide

## Task Descriptions
How to write effective task descriptions.

## Workflow Selection
Guidelines for selecting appropriate workflows.

## Autonomy Levels
Understanding different autonomy levels:
- full: Full autonomy
- review-before-commit: Review before commit
- review-before-merge: Review before merge
- manual: Manual approval required

## Cost Management
Managing costs and budget considerations.

## Security
Security practices and considerations.
`.repeat(2);

      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockResolvedValue(comprehensiveBestPracticesContent);

      const result = await auditor.performAudit();

      expect(result.bestPractices.exists).toBe(true);
      expect(result.bestPractices.hasSubstantiveContent).toBe(true);
      expect(result.bestPractices.accuracy).toBe('accurate');
      expect(result.bestPractices.details).toContain('✅ Contains Task Descriptions');
      expect(result.bestPractices.details).toContain('📋 Documents 4/4 autonomy levels');
    });
  });

  describe('Troubleshooting Guide Audit', () => {
    it('should recognize comprehensive troubleshooting documentation', async () => {
      const comprehensiveTroubleshootingContent = `
# Troubleshooting Guide

## Quick Diagnostics
Quick diagnostic steps to identify issues.

## Common Issues
Most common issues and their solutions.

## Debugging
How to debug APEX applications.

## Windows Support
Special considerations for Windows and PowerShell.

## Configuration Issues
Resolving configuration problems.

Supported platforms:
- Unix systems
- Linux distributions
- macOS
- Windows
`.repeat(2);

      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockResolvedValue(comprehensiveTroubleshootingContent);

      const result = await auditor.performAudit();

      expect(result.troubleshooting.exists).toBe(true);
      expect(result.troubleshooting.hasSubstantiveContent).toBe(true);
      expect(result.troubleshooting.accuracy).toBe('accurate');
      expect(result.troubleshooting.details).toContain('✅ Contains Quick Diagnostics');
      expect(result.troubleshooting.details).toContain('📋 Documents 4/4 platforms');
    });
  });

  describe('Configuration Options', () => {
    it('should respect custom docs directory', async () => {
      const customAuditor = new V020DocumentationAuditor({
        docsDirectory: 'custom-docs'
      });

      mockAccess.mockRejectedValue(new Error('File not found'));

      await customAuditor.performAudit();

      expect(mockAccess).toHaveBeenCalledWith(
        join('custom-docs', 'openapi.yaml'),
        constants.F_OK
      );
    });

    it('should respect custom line threshold', async () => {
      const customAuditor = new V020DocumentationAuditor({
        minimumLineThreshold: 100
      });

      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockResolvedValue('# Content\n'.repeat(75)); // 75 lines

      const result = await customAuditor.performAudit();

      expect(result.apiReference.hasSubstantiveContent).toBe(false);
      expect(result.apiReference.lineCount).toBe(75);
    });

    it('should skip detailed analysis when disabled', async () => {
      const simpleAuditor = new V020DocumentationAuditor({
        detailedAnalysis: false
      });

      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockResolvedValue('# Simple content\n'.repeat(60));

      const result = await simpleAuditor.performAudit();

      expect(result.apiReference.details).toEqual([]);
      expect(mockParse).not.toHaveBeenCalled();
    });
  });

  describe('Summary Generation', () => {
    it('should generate accurate summary for passing audit', async () => {
      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockResolvedValue('# Test Content\n'.repeat(60));
      mockParse.mockReturnValue({
        openapi: '3.0.3',
        info: { version: '1.0.0' },
        paths: { '/test': {} },
        components: { schemas: {} }
      });

      const result = await auditor.performAudit();

      expect(result.summary).toContain('PASSING ✅');
      expect(result.summary).toContain('Documents found: 5/5');
      expect(result.summary).toContain('Substantive content: 5/5');
      expect(result.summary).toContain('Individual Results:');
    });

    it('should generate accurate summary for failing audit', async () => {
      mockAccess.mockRejectedValue(new Error('File not found'));

      const result = await auditor.performAudit();

      expect(result.summary).toContain('FAILING ❌');
      expect(result.summary).toContain('Documents found: 0/5');
      expect(result.summary).toContain('Missing ❌');
    });

    it('should include audit timestamp', async () => {
      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockResolvedValue('# Test\n'.repeat(60));

      const beforeTime = new Date().toISOString();
      const result = await auditor.performAudit();
      const afterTime = new Date().toISOString();

      expect(result.auditDate).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(result.auditDate).toBeGreaterThanOrEqual(beforeTime);
      expect(result.auditDate).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('Error Handling', () => {
    it('should handle file system permission errors', async () => {
      mockAccess.mockRejectedValue(new Error('Permission denied'));

      const result = await auditor.performAudit();

      expect(result.overallStatus).toBe('failing');
      expect(result.apiReference.details).toContain('❌ File not found');
    });

    it('should handle corrupted file content', async () => {
      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockRejectedValue(new Error('File corrupted'));

      const result = await auditor.performAudit();

      expect(result.apiReference.exists).toBe(false);
      expect(result.apiReference.details).toContain('❌ File not found');
    });

    it('should handle empty files', async () => {
      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockResolvedValue('');

      const result = await auditor.performAudit();

      expect(result.apiReference.exists).toBe(true);
      expect(result.apiReference.hasSubstantiveContent).toBe(false);
      expect(result.apiReference.lineCount).toBe(1); // Empty file still has 1 line count
    });
  });
});

describe('auditV020Documentation() Convenience Function', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should create auditor with default config and perform audit', async () => {
    mockAccess.mockResolvedValue(undefined);
    mockReadFile.mockResolvedValue('# Test Content\n'.repeat(60));
    mockParse.mockReturnValue({
      openapi: '3.0.3',
      info: {},
      paths: {},
      components: { schemas: {} }
    });

    const result = await auditV020Documentation();

    expect(result).toMatchObject({
      overallStatus: expect.any(String),
      summary: expect.any(String),
      auditDate: expect.any(String)
    });
  });

  it('should create auditor with custom config', async () => {
    const customConfig: DocumentationAuditorConfig = {
      docsDirectory: 'test-docs',
      minimumLineThreshold: 25
    };

    mockAccess.mockResolvedValue(undefined);
    mockReadFile.mockResolvedValue('# Test\n'.repeat(30));

    const result = await auditV020Documentation(customConfig);

    expect(result.apiReference.hasSubstantiveContent).toBe(true);
  });
});

describe('Type Definitions', () => {
  it('should have correct DocumentationItemAudit structure', () => {
    const mockResult: DocumentationItemAudit = {
      exists: true,
      hasSubstantiveContent: true,
      lineCount: 100,
      accuracy: 'accurate',
      details: ['Test detail'],
      filePath: '/test/path'
    };

    expect(mockResult.exists).toBe(true);
    expect(mockResult.accuracy).toBe('accurate');
  });

  it('should have correct V020DocumentationAudit structure', () => {
    const mockAudit: V020DocumentationAudit = {
      apiReference: {} as DocumentationItemAudit,
      agentAuthoring: {} as DocumentationItemAudit,
      workflowAuthoring: {} as DocumentationItemAudit,
      bestPractices: {} as DocumentationItemAudit,
      troubleshooting: {} as DocumentationItemAudit,
      overallStatus: 'passing',
      summary: 'Test summary',
      auditDate: new Date().toISOString()
    };

    expect(mockAudit.overallStatus).toBe('passing');
    expect(mockAudit.summary).toBe('Test summary');
  });
});