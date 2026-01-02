import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ApexOrchestrator } from './index';
import { initializeApex } from '@apexcli/core';

// Mock the claude-agent-sdk
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
}));

// Mock child_process
vi.mock('child_process', () => ({
  exec: vi.fn((cmd: string, opts: unknown, callback?: unknown) => {
    if (typeof opts === 'function') {
      callback = opts;
    }
    const cb = callback as (error: Error | null, result?: { stdout: string }) => void;
    cb(null, { stdout: '' });
  }),
}));

describe('ApexOrchestrator - Gate Configuration Loading', () => {
  let testDir: string;
  let orchestrator: ApexOrchestrator;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-gate-test-'));

    // Initialize APEX in the test directory
    await initializeApex(testDir, {
      projectName: 'test-project',
      language: 'typescript',
      framework: 'node',
    });

    orchestrator = new ApexOrchestrator({ projectPath: testDir });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  describe('loadGates() method', () => {
    it('should load gates from config.autonomy.gates array', async () => {
      // Create config with approval gates
      const configContent = `
project:
  name: test-project
  language: typescript
  framework: node
  description: Test project

autonomy:
  level: review-before-commit
  gates:
    - id: config-gate-1
      type: pre-stage
      name: Config Gate One
      description: Gate loaded from config
      required: true
      autoApprove: false
      tags:
        - config
        - testing
    - id: config-gate-2
      type: post-task
      name: Config Gate Two
      description: Second gate from config
      required: false
      autoApprove: true
      timeout: 30
      tags:
        - config
        - optional

limits:
  budget:
    max: 100.0
    currency: USD
  tokens:
    input: 1000000
    output: 100000
  changes:
    files: 50
    lines: 5000
  time:
    max: 3600
`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'config.yaml'),
        configContent
      );

      await orchestrator.initialize();

      // Access the private gates map using reflection for testing
      const gates = (orchestrator as any).gates as Map<string, any>;

      expect(gates.size).toBe(2);

      const gate1 = gates.get('config-gate-1');
      expect(gate1).toBeDefined();
      expect(gate1.id).toBe('config-gate-1');
      expect(gate1.name).toBe('Config Gate One');
      expect(gate1.description).toBe('Gate loaded from config');
      expect(gate1.required).toBe(true);
      expect(gate1.autoApprove).toBe(false);
      expect(gate1.tags).toEqual(['config', 'testing']);

      const gate2 = gates.get('config-gate-2');
      expect(gate2).toBeDefined();
      expect(gate2.id).toBe('config-gate-2');
      expect(gate2.name).toBe('Config Gate Two');
      expect(gate2.description).toBe('Second gate from config');
      expect(gate2.required).toBe(false);
      expect(gate2.autoApprove).toBe(true);
      expect(gate2.timeout).toBe(30);
      expect(gate2.tags).toEqual(['config', 'optional']);
    });

    it('should load gates from workflow definitions', async () => {
      // Create a workflow with gates
      const workflowContent = `
name: feature-with-gates
description: Workflow with gates
gates:
  - id: workflow-gate-1
    name: Planning Review
    description: Review planning stage output
    required: true
    autoApprove: false
    timeout: 60
    tags:
      - workflow
      - planning
  - id: workflow-gate-2
    name: Implementation Review
    description: Review implementation before testing
    required: false
    autoApprove: true
    tags:
      - workflow
      - implementation

stages:
  - name: planning
    agent: planner
    description: Create implementation plan
  - name: implementation
    agent: developer
    dependsOn:
      - planning
    description: Implement the feature
`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'feature-with-gates.yaml'),
        workflowContent
      );

      // Create basic agent files
      const plannerContent = `---
name: planner
description: Plans implementation tasks
tools: Read, Glob, Grep
model: sonnet
---
You are a planning agent.`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'agents', 'planner.md'),
        plannerContent
      );

      const developerContent = `---
name: developer
description: Implements code changes
tools: Read, Write, Edit, Bash
model: sonnet
---
You are a developer agent.`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'agents', 'developer.md'),
        developerContent
      );

      await orchestrator.initialize();

      // Access the private gates and workflows maps
      const gates = (orchestrator as any).gates as Map<string, any>;
      const workflows = (orchestrator as any).workflows as Record<string, any>;

      expect(workflows['feature-with-gates']).toBeDefined();
      expect(gates.size).toBe(2);

      const gate1 = gates.get('workflow-gate-1');
      expect(gate1).toBeDefined();
      expect(gate1.id).toBe('workflow-gate-1');
      expect(gate1.name).toBe('Planning Review');
      expect(gate1.description).toBe('Review planning stage output');
      expect(gate1.required).toBe(true);
      expect(gate1.autoApprove).toBe(false);
      expect(gate1.timeout).toBe(60);
      expect(gate1.tags).toEqual(['workflow', 'planning']);

      const gate2 = gates.get('workflow-gate-2');
      expect(gate2).toBeDefined();
      expect(gate2.id).toBe('workflow-gate-2');
      expect(gate2.name).toBe('Implementation Review');
      expect(gate2.description).toBe('Review implementation before testing');
      expect(gate2.required).toBe(false);
      expect(gate2.autoApprove).toBe(true);
      expect(gate2.tags).toEqual(['workflow', 'implementation']);
    });

    it('should create default gates for stage.gate references', async () => {
      // Create a workflow with stage gate references
      const workflowContent = `
name: feature-with-stage-gates
description: Workflow with stage gate references
stages:
  - name: planning
    agent: planner
    description: Create implementation plan
    gate: planning-approval
  - name: implementation
    agent: developer
    dependsOn:
      - planning
    description: Implement the feature
    gate: implementation-approval
  - name: testing
    agent: tester
    dependsOn:
      - implementation
    description: Test the implementation
    gate: testing-approval
`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'feature-with-stage-gates.yaml'),
        workflowContent
      );

      // Create basic agent files
      const agentFiles = ['planner', 'developer', 'tester'];
      for (const agent of agentFiles) {
        const agentContent = `---
name: ${agent}
description: ${agent} agent
tools: Read, Write, Edit, Bash
model: sonnet
---
You are a ${agent} agent.`;

        await fs.writeFile(
          path.join(testDir, '.apex', 'agents', `${agent}.md`),
          agentContent
        );
      }

      await orchestrator.initialize();

      // Access the private gates map
      const gates = (orchestrator as any).gates as Map<string, any>;

      expect(gates.size).toBe(3);

      // Check planning gate
      const planningGate = gates.get('planning-approval');
      expect(planningGate).toBeDefined();
      expect(planningGate.id).toBe('planning-approval');
      expect(planningGate.name).toBe('planning-approval');
      expect(planningGate.description).toBe('Approval gate for stage planner in workflow feature-with-stage-gates');
      expect(planningGate.required).toBe(true);
      expect(planningGate.autoApprove).toBe(false);
      expect(planningGate.tags).toEqual(['workflow:feature-with-stage-gates', 'stage:planner']);

      // Check implementation gate
      const implementationGate = gates.get('implementation-approval');
      expect(implementationGate).toBeDefined();
      expect(implementationGate.id).toBe('implementation-approval');
      expect(implementationGate.name).toBe('implementation-approval');
      expect(implementationGate.description).toBe('Approval gate for stage developer in workflow feature-with-stage-gates');
      expect(implementationGate.required).toBe(true);
      expect(implementationGate.autoApprove).toBe(false);
      expect(implementationGate.tags).toEqual(['workflow:feature-with-stage-gates', 'stage:developer']);

      // Check testing gate
      const testingGate = gates.get('testing-approval');
      expect(testingGate).toBeDefined();
      expect(testingGate.id).toBe('testing-approval');
      expect(testingGate.name).toBe('testing-approval');
      expect(testingGate.description).toBe('Approval gate for stage tester in workflow feature-with-stage-gates');
      expect(testingGate.required).toBe(true);
      expect(testingGate.autoApprove).toBe(false);
      expect(testingGate.tags).toEqual(['workflow:feature-with-stage-gates', 'stage:tester']);
    });

    it('should load gates from both config and workflows combined', async () => {
      // Create config with gates
      const configContent = `
project:
  name: test-project
  language: typescript
  framework: node
  description: Test project

autonomy:
  level: review-before-commit
  gates:
    - id: config-gate
      type: pre-stage
      name: Config Gate
      description: Gate from config
      required: true
      autoApprove: false
      tags: [config]

limits:
  budget:
    max: 100.0
    currency: USD
  tokens:
    input: 1000000
    output: 100000
  changes:
    files: 50
    lines: 5000
  time:
    max: 3600
`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'config.yaml'),
        configContent
      );

      // Create a workflow with gates
      const workflowContent = `
name: mixed-gates-workflow
description: Workflow with gates and stage references
gates:
  - id: workflow-gate
    name: Workflow Gate
    description: Gate from workflow
    required: true
    autoApprove: false
    tags: [workflow]

stages:
  - name: planning
    agent: planner
    description: Create implementation plan
    gate: stage-gate
`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'mixed-gates-workflow.yaml'),
        workflowContent
      );

      // Create planner agent
      const plannerContent = `---
name: planner
description: Plans implementation tasks
tools: Read, Glob, Grep
model: sonnet
---
You are a planning agent.`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'agents', 'planner.md'),
        plannerContent
      );

      await orchestrator.initialize();

      // Access the private gates map
      const gates = (orchestrator as any).gates as Map<string, any>;

      expect(gates.size).toBe(3);

      // Check config gate
      const configGate = gates.get('config-gate');
      expect(configGate).toBeDefined();
      expect(configGate.tags).toEqual(['config']);

      // Check workflow gate
      const workflowGate = gates.get('workflow-gate');
      expect(workflowGate).toBeDefined();
      expect(workflowGate.tags).toEqual(['workflow']);

      // Check stage gate
      const stageGate = gates.get('stage-gate');
      expect(stageGate).toBeDefined();
      expect(stageGate.tags).toEqual(['workflow:mixed-gates-workflow', 'stage:planner']);
    });

    it('should handle empty gates configuration gracefully', async () => {
      // Create config without gates
      const configContent = `
project:
  name: test-project
  language: typescript
  framework: node
  description: Test project

limits:
  budget:
    max: 100.0
    currency: USD
  tokens:
    input: 1000000
    output: 100000
  changes:
    files: 50
    lines: 5000
  time:
    max: 3600
`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'config.yaml'),
        configContent
      );

      // Create a simple workflow without gates
      const workflowContent = `
name: simple-workflow
description: Simple workflow without gates
stages:
  - name: planning
    agent: planner
    description: Create implementation plan
`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'simple-workflow.yaml'),
        workflowContent
      );

      // Create planner agent
      const plannerContent = `---
name: planner
description: Plans implementation tasks
tools: Read, Glob, Grep
model: sonnet
---
You are a planning agent.`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'agents', 'planner.md'),
        plannerContent
      );

      await orchestrator.initialize();

      // Access the private gates map
      const gates = (orchestrator as any).gates as Map<string, any>;

      expect(gates.size).toBe(0);
    });

    it('should not create duplicate gates when stage references existing gate', async () => {
      // Create a workflow with both gate definition and stage reference to same gate
      const workflowContent = `
name: duplicate-gate-workflow
description: Workflow that defines and references the same gate
gates:
  - id: shared-gate
    name: Shared Gate
    description: Gate defined in workflow
    required: true
    autoApprove: false
    timeout: 45
    tags: [workflow, shared]

stages:
  - name: planning
    agent: planner
    description: Create implementation plan
    gate: shared-gate
`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'duplicate-gate-workflow.yaml'),
        workflowContent
      );

      // Create planner agent
      const plannerContent = `---
name: planner
description: Plans implementation tasks
tools: Read, Glob, Grep
model: sonnet
---
You are a planning agent.`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'agents', 'planner.md'),
        plannerContent
      );

      await orchestrator.initialize();

      // Access the private gates map
      const gates = (orchestrator as any).gates as Map<string, any>;

      expect(gates.size).toBe(1);

      const sharedGate = gates.get('shared-gate');
      expect(sharedGate).toBeDefined();
      expect(sharedGate.name).toBe('Shared Gate');
      expect(sharedGate.description).toBe('Gate defined in workflow');
      expect(sharedGate.timeout).toBe(45);
      expect(sharedGate.tags).toEqual(['workflow', 'shared']);
    });

    it('should clear existing gates when reloading', async () => {
      // First initialization with gates
      const configContent = `
project:
  name: test-project
  language: typescript
  framework: node
  description: Test project

autonomy:
  level: review-before-commit
  gates:
    - id: initial-gate
      type: pre-stage
      name: Initial Gate
      description: Initial gate
      required: true

limits:
  budget:
    max: 100.0
    currency: USD
  tokens:
    input: 1000000
    output: 100000
  changes:
    files: 50
    lines: 5000
  time:
    max: 3600
`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'config.yaml'),
        configContent
      );

      await orchestrator.initialize();

      // Access the private gates map
      const gates = (orchestrator as any).gates as Map<string, any>;
      expect(gates.size).toBe(1);
      expect(gates.has('initial-gate')).toBe(true);

      // Call loadGates again (simulating re-initialization)
      await (orchestrator as any).loadGates();

      // Gates should still be there (same config)
      expect(gates.size).toBe(1);
      expect(gates.has('initial-gate')).toBe(true);

      // Now modify config to remove gates
      const updatedConfigContent = `
project:
  name: test-project
  language: typescript
  framework: node
  description: Test project

limits:
  budget:
    max: 100.0
    currency: USD
  tokens:
    input: 1000000
    output: 100000
  changes:
    files: 50
    lines: 5000
  time:
    max: 3600
`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'config.yaml'),
        updatedConfigContent
      );

      // Reload config and gates
      (orchestrator as any).effectiveConfig = null; // Clear cached config
      await (orchestrator as any).loadGates();

      // Gates should be cleared
      expect(gates.size).toBe(0);
    });
  });

  describe('gate data structure validation', () => {
    it('should properly convert WorkflowGate to ApprovalGate with default values', async () => {
      const workflowContent = `
name: validation-workflow
description: Workflow for testing gate validation
gates:
  - id: minimal-gate
    name: Minimal Gate
    description: Gate with minimal properties
    # No required, autoApprove, timeout, or tags - should get defaults
  - id: complete-gate
    name: Complete Gate
    description: Gate with all properties
    required: false
    autoApprove: true
    timeout: 120
    tags: [complete, test]

stages:
  - name: planning
    agent: planner
    description: Create implementation plan
`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'validation-workflow.yaml'),
        workflowContent
      );

      const plannerContent = `---
name: planner
description: Plans implementation tasks
tools: Read, Glob, Grep
model: sonnet
---
You are a planning agent.`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'agents', 'planner.md'),
        plannerContent
      );

      await orchestrator.initialize();

      const gates = (orchestrator as any).gates as Map<string, any>;

      expect(gates.size).toBe(2);

      // Check minimal gate gets proper defaults
      const minimalGate = gates.get('minimal-gate');
      expect(minimalGate).toBeDefined();
      expect(minimalGate.required).toBe(true); // default to true when not specified
      expect(minimalGate.autoApprove).toBe(false); // default value
      expect(minimalGate.timeout).toBeUndefined(); // no default for timeout
      expect(minimalGate.tags).toEqual([]); // default empty array

      // Check complete gate preserves all values
      const completeGate = gates.get('complete-gate');
      expect(completeGate).toBeDefined();
      expect(completeGate.required).toBe(false);
      expect(completeGate.autoApprove).toBe(true);
      expect(completeGate.timeout).toBe(120);
      expect(completeGate.tags).toEqual(['complete', 'test']);
    });

    it('should handle malformed gate configurations gracefully', async () => {
      // Create a workflow with gates that have missing required fields
      const workflowContent = `
name: malformed-workflow
description: Workflow with malformed gates (for error testing)
gates:
  - id: valid-gate
    name: Valid Gate
    description: This gate is properly formed
  - id: incomplete-gate
    # Missing name and description - should still work with defaults

stages:
  - name: planning
    agent: planner
    description: Create implementation plan
`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'malformed-workflow.yaml'),
        workflowContent
      );

      const plannerContent = `---
name: planner
description: Plans implementation tasks
tools: Read, Glob, Grep
model: sonnet
---
You are a planning agent.`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'agents', 'planner.md'),
        plannerContent
      );

      // Should not throw errors during initialization
      await expect(orchestrator.initialize()).resolves.not.toThrow();

      const gates = (orchestrator as any).gates as Map<string, any>;

      // Only the valid gate should be loaded (assuming YAML validation rejects malformed entries)
      expect(gates.size).toBe(1);
      expect(gates.has('valid-gate')).toBe(true);
    });
  });

  describe('multiple workflow handling', () => {
    it('should load gates from multiple workflows without conflicts', async () => {
      // Create first workflow
      const workflow1Content = `
name: workflow-1
description: First workflow
gates:
  - id: workflow-1-gate
    name: Workflow 1 Gate
    description: Gate from first workflow
    tags: [workflow1]

stages:
  - name: step1
    agent: planner
    description: Step 1
    gate: workflow-1-stage-gate
`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'workflow-1.yaml'),
        workflow1Content
      );

      // Create second workflow
      const workflow2Content = `
name: workflow-2
description: Second workflow
gates:
  - id: workflow-2-gate
    name: Workflow 2 Gate
    description: Gate from second workflow
    tags: [workflow2]

stages:
  - name: step1
    agent: developer
    description: Step 1 in workflow 2
    gate: workflow-2-stage-gate
`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'workflow-2.yaml'),
        workflow2Content
      );

      // Create agent files
      const plannerContent = `---
name: planner
description: Planning agent
tools: Read, Glob, Grep
model: sonnet
---
You are a planning agent.`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'agents', 'planner.md'),
        plannerContent
      );

      const developerContent = `---
name: developer
description: Developer agent
tools: Read, Write, Edit, Bash
model: sonnet
---
You are a developer agent.`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'agents', 'developer.md'),
        developerContent
      );

      await orchestrator.initialize();

      const gates = (orchestrator as any).gates as Map<string, any>;

      // Should have 4 gates total: 2 from workflow definitions + 2 from stage references
      expect(gates.size).toBe(4);

      // Check workflow gates
      expect(gates.has('workflow-1-gate')).toBe(true);
      expect(gates.has('workflow-2-gate')).toBe(true);

      // Check stage gates
      expect(gates.has('workflow-1-stage-gate')).toBe(true);
      expect(gates.has('workflow-2-stage-gate')).toBe(true);

      // Verify workflow-specific tagging for stage gates
      const workflow1StageGate = gates.get('workflow-1-stage-gate');
      expect(workflow1StageGate.tags).toEqual(['workflow:workflow-1', 'stage:planner']);

      const workflow2StageGate = gates.get('workflow-2-stage-gate');
      expect(workflow2StageGate.tags).toEqual(['workflow:workflow-2', 'stage:developer']);
    });

    it('should handle gate ID conflicts between workflows gracefully', async () => {
      // Create workflows with conflicting gate IDs
      const workflow1Content = `
name: conflict-workflow-1
description: First workflow with conflicting gate ID
gates:
  - id: shared-gate-id
    name: Gate from Workflow 1
    description: This gate is from workflow 1
    tags: [workflow1]

stages:
  - name: step1
    agent: planner
    description: Step 1
`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'conflict-workflow-1.yaml'),
        workflow1Content
      );

      const workflow2Content = `
name: conflict-workflow-2
description: Second workflow with conflicting gate ID
gates:
  - id: shared-gate-id
    name: Gate from Workflow 2
    description: This gate is from workflow 2
    tags: [workflow2]

stages:
  - name: step1
    agent: developer
    description: Step 1
`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'conflict-workflow-2.yaml'),
        workflow2Content
      );

      // Create agent files
      const plannerContent = `---
name: planner
description: Planning agent
tools: Read, Glob, Grep
model: sonnet
---
You are a planning agent.`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'agents', 'planner.md'),
        plannerContent
      );

      const developerContent = `---
name: developer
description: Developer agent
tools: Read, Write, Edit, Bash
model: sonnet
---
You are a developer agent.`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'agents', 'developer.md'),
        developerContent
      );

      await orchestrator.initialize();

      const gates = (orchestrator as any).gates as Map<string, any>;

      // Should have only 1 gate (the conflicting ID gets overwritten)
      expect(gates.size).toBe(1);
      expect(gates.has('shared-gate-id')).toBe(true);

      // The last loaded gate should win (depends on file system order, but ensure one exists)
      const gate = gates.get('shared-gate-id');
      expect(gate).toBeDefined();
      expect(gate.id).toBe('shared-gate-id');
      expect(['Gate from Workflow 1', 'Gate from Workflow 2']).toContain(gate.name);
    });
  });
});

describe('ApexOrchestrator - Gate Trigger Logic', () => {
  let testDir: string;
  let orchestrator: ApexOrchestrator;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-gate-trigger-test-'));

    // Initialize APEX in the test directory
    await initializeApex(testDir, {
      projectName: 'test-project',
      language: 'typescript',
      framework: 'node',
    });

    orchestrator = new ApexOrchestrator({ projectPath: testDir });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  describe('shouldPauseForGate() method', () => {
    beforeEach(async () => {
      // Create config with gates for testing
      const configContent = `
project:
  name: test-project
  language: typescript
  framework: node
  description: Test project

autonomy:
  level: review-before-commit
  gates:
    - id: required-gate
      type: pre-stage
      name: Required Gate
      description: A required gate for testing
      required: true
      autoApprove: false
    - id: auto-approve-gate
      type: pre-stage
      name: Auto Approve Gate
      description: An auto-approve gate for testing
      required: true
      autoApprove: true
    - id: optional-gate
      type: pre-stage
      name: Optional Gate
      description: An optional gate for testing
      required: false
      autoApprove: false

limits:
  budget:
    max: 100.0
    currency: USD
  tokens:
    input: 1000000
    output: 100000
  changes:
    files: 50
    lines: 5000
  time:
    max: 3600
`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'config.yaml'),
        configContent
      );

      // Create test agent
      const agentContent = `---
name: test-agent
description: Test agent for gate testing
tools: Read, Write, Edit, Bash
model: sonnet
---
You are a test agent.`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'agents', 'test-agent.md'),
        agentContent
      );

      await orchestrator.initialize();
    });

    it('should return pause: false for stage without gate', () => {
      const stage = {
        name: 'test-stage',
        agent: 'test-agent',
        description: 'Test stage without gate',
      };

      const result = (orchestrator as any).shouldPauseForGate(stage);
      expect(result.pause).toBe(false);
      expect(result.gate).toBeUndefined();
    });

    it('should return pause: false for stage with non-existent gate', () => {
      const stage = {
        name: 'test-stage',
        agent: 'test-agent',
        description: 'Test stage with non-existent gate',
        gate: 'non-existent-gate',
      };

      // Mock console.warn to verify warning is logged
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = (orchestrator as any).shouldPauseForGate(stage);
      expect(result.pause).toBe(false);
      expect(result.gate).toBeUndefined();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Gate "non-existent-gate" referenced by stage "test-stage" not found'
      );

      consoleSpy.mockRestore();
    });

    it('should return pause: false for stage with auto-approve gate', () => {
      const stage = {
        name: 'test-stage',
        agent: 'test-agent',
        description: 'Test stage with auto-approve gate',
        gate: 'auto-approve-gate',
      };

      const result = (orchestrator as any).shouldPauseForGate(stage);
      expect(result.pause).toBe(false);
      expect(result.gate).toBeUndefined();
    });

    it('should return pause: false for stage with optional gate', () => {
      const stage = {
        name: 'test-stage',
        agent: 'test-agent',
        description: 'Test stage with optional gate',
        gate: 'optional-gate',
      };

      const result = (orchestrator as any).shouldPauseForGate(stage);
      expect(result.pause).toBe(false);
      expect(result.gate).toBeUndefined();
    });

    it('should return pause: true for stage with required gate', () => {
      const stage = {
        name: 'test-stage',
        agent: 'test-agent',
        description: 'Test stage with required gate',
        gate: 'required-gate',
      };

      const result = (orchestrator as any).shouldPauseForGate(stage);
      expect(result.pause).toBe(true);
      expect(result.gate).toBeDefined();
      expect(result.gate?.id).toBe('required-gate');
      expect(result.gate?.required).toBe(true);
      expect(result.gate?.autoApprove).toBe(false);
    });
  });

  describe('runWorkflow() gate triggering', () => {
    beforeEach(async () => {
      // Create workflow with gated stage
      const workflowContent = `
name: gated-workflow
description: Workflow with approval gate
gates:
  - id: implementation-gate
    name: Implementation Approval
    description: Requires approval before implementation
    required: true
    autoApprove: false
    timeout: 60
    minApprovals: 1

stages:
  - name: planning
    agent: test-agent
    description: Planning stage
  - name: implementation
    agent: test-agent
    description: Implementation stage
    gate: implementation-gate
    dependsOn:
      - planning
`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'gated-workflow.yaml'),
        workflowContent
      );

      // Create test agent
      const agentContent = `---
name: test-agent
description: Test agent for gate testing
tools: Read, Write, Edit, Bash
model: sonnet
---
You are a test agent.`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'agents', 'test-agent.md'),
        agentContent
      );

      await orchestrator.initialize();
    });

    it('should pause task when hitting approval gate', async () => {
      // Mock the executeWorkflowStage method to simulate planning stage completion
      const originalExecuteStage = (orchestrator as any).executeWorkflowStage;
      (orchestrator as any).executeWorkflowStage = vi.fn().mockResolvedValue({
        stageName: 'planning',
        agent: 'test-agent',
        status: 'completed',
        outputs: {},
        artifacts: [],
        summary: 'Planning completed successfully',
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150, estimatedCost: 0.001 },
        startedAt: new Date(),
        completedAt: new Date(),
      });

      // Create a task
      const task = await orchestrator.createTask({
        title: 'Test Task with Gate',
        description: 'Testing gate trigger functionality',
        workflow: 'gated-workflow',
      });

      // Mock the store methods to track calls
      const updateTaskSpy = vi.spyOn((orchestrator as any).store, 'updateTask');
      const setGateSpy = vi.spyOn((orchestrator as any).store, 'setGate');
      const saveCheckpointSpy = vi.spyOn(orchestrator as any, 'saveCheckpoint');

      // Mock event emission
      const emitSpy = vi.spyOn(orchestrator, 'emit');

      // Start the task
      await orchestrator.startTask(task.id);

      // Wait a bit for async operations to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check that task was paused with awaiting-approval status
      expect(updateTaskSpy).toHaveBeenCalledWith(
        task.id,
        expect.objectContaining({
          status: 'awaiting-approval',
          pauseReason: 'approval_gate',
          approvalState: expect.objectContaining({
            gateName: 'implementation-gate',
            status: 'pending',
            stage: 'implementation',
            agent: 'test-agent',
          }),
        })
      );

      // Check that gate was created in store
      expect(setGateSpy).toHaveBeenCalledWith(
        task.id,
        expect.objectContaining({
          gateName: 'implementation-gate',
          status: 'pending',
        })
      );

      // Check that checkpoint was saved
      expect(saveCheckpointSpy).toHaveBeenCalledWith(
        task.id,
        expect.objectContaining({
          stage: 'implementation',
          metadata: expect.objectContaining({
            pauseReason: 'approval_gate',
            gateName: 'implementation-gate',
          }),
        })
      );

      // Check that gate:required event was emitted
      expect(emitSpy).toHaveBeenCalledWith(
        'gate:required',
        expect.objectContaining({
          gateName: 'implementation-gate',
          taskId: task.id,
          stage: 'implementation',
          agent: 'test-agent',
          blocking: true,
        })
      );

      // Restore original method
      (orchestrator as any).executeWorkflowStage = originalExecuteStage;
    });

    it('should proceed without pause for auto-approve gate', async () => {
      // Create workflow with auto-approve gate
      const workflowContent = `
name: auto-approve-workflow
description: Workflow with auto-approve gate
gates:
  - id: auto-gate
    name: Auto Approval Gate
    description: Auto-approve gate for testing
    required: true
    autoApprove: true

stages:
  - name: implementation
    agent: test-agent
    description: Implementation stage
    gate: auto-gate
`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'workflows', 'auto-approve-workflow.yaml'),
        workflowContent
      );

      await orchestrator.initialize();

      // Mock the executeWorkflowStage method
      const executeStagespy = vi.fn().mockResolvedValue({
        stageName: 'implementation',
        agent: 'test-agent',
        status: 'completed',
        outputs: {},
        artifacts: [],
        summary: 'Implementation completed successfully',
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150, estimatedCost: 0.001 },
        startedAt: new Date(),
        completedAt: new Date(),
      });
      (orchestrator as any).executeWorkflowStage = executeStagespy;

      // Create a task
      const task = await orchestrator.createTask({
        title: 'Test Task with Auto-Approve Gate',
        description: 'Testing auto-approve gate behavior',
        workflow: 'auto-approve-workflow',
      });

      // Mock the store methods
      const updateTaskSpy = vi.spyOn((orchestrator as any).store, 'updateTask');

      // Start the task
      await orchestrator.startTask(task.id);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check that executeWorkflowStage was called (stage should proceed)
      expect(executeStagespy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ name: 'implementation' }),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything()
      );

      // Task should not be paused with approval_gate reason
      const pauseCalls = updateTaskSpy.mock.calls.filter(call =>
        call[1] && typeof call[1] === 'object' && 'pauseReason' in call[1] &&
        call[1].pauseReason === 'approval_gate'
      );
      expect(pauseCalls).toHaveLength(0);
    });
  });
});