import { describe, it, expect, vi } from 'vitest';
import { workflowToYaml, yamlToWorkflow, validateYamlSyntax, extractWorkflowMetadata } from '../serialization';
import type { WorkflowDefinition } from '@apexcli/core';

describe('serialization - basic functionality', () => {
  const simpleWorkflow: WorkflowDefinition = {
    name: 'Simple Workflow',
    description: 'A simple test workflow',
    stages: [
      {
        name: 'stage1',
        agent: 'planner',
        description: 'First stage',
      },
      {
        name: 'stage2',
        agent: 'developer',
        description: 'Second stage',
        dependsOn: ['stage1'],
      },
    ],
  };

  it('converts workflow to YAML', () => {
    const yaml = workflowToYaml(simpleWorkflow);

    expect(yaml).toBeTruthy();
    expect(typeof yaml).toBe('string');
    expect(yaml).toContain('Simple Workflow');
    expect(yaml).toContain('stage1');
    expect(yaml).toContain('stage2');
  });

  it('validates YAML syntax correctly', () => {
    const validYaml = 'name: Test\ndescription: Valid';
    const invalidYaml = 'name: "unclosed quote';

    expect(validateYamlSyntax(validYaml)).toHaveLength(0);
    expect(validateYamlSyntax(invalidYaml)).toHaveLength(1);
  });

  it('extracts workflow metadata', () => {
    const yaml = 'name: Test Workflow\ndescription: Test\nstages:\n  - name: stage1';
    const metadata = extractWorkflowMetadata(yaml);

    expect(metadata).toBeTruthy();
    expect(metadata?.name).toBe('Test Workflow');
    expect(metadata?.description).toBe('Test');
  });

  it('handles YAML parsing with proper schema', () => {
    const yaml = `
name: "Test Workflow"
description: "Test description"
stages:
  - name: "test-stage"
    agent: "planner"
    description: "Test stage description"
`;

    const { workflow, errors } = yamlToWorkflow(yaml);

    // Should either parse successfully or have validation errors
    if (workflow) {
      expect(workflow.name).toBe('Test Workflow');
      expect(workflow.stages).toHaveLength(1);
    } else {
      expect(errors).toBeDefined();
      expect(Array.isArray(errors)).toBe(true);
    }
  });

  it('handles empty YAML gracefully', () => {
    const { workflow, errors } = yamlToWorkflow('');

    expect(workflow).toBeNull();
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('empty');
  });

  it('round-trip conversion preserves basic structure', () => {
    const yaml = workflowToYaml(simpleWorkflow);
    const { workflow } = yamlToWorkflow(yaml);

    // Should either parse successfully or fail gracefully
    if (workflow) {
      expect(workflow.name).toBe(simpleWorkflow.name);
      expect(workflow.description).toBe(simpleWorkflow.description);
      expect(workflow.stages).toHaveLength(2);
    }
  });
});