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
  });
});