import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWorkflowEditor } from '../useWorkflowEditor';
import { WorkflowEditorProvider } from '@/components/workflow-editor/WorkflowEditorProvider';
import type { WorkflowDefinition, Stage } from '@/types/workflow-editor';

// Mock React Flow
vi.mock('react-flow-renderer', () => ({
  useReactFlow: () => ({
    getNodes: vi.fn(() => []),
    getEdges: vi.fn(() => []),
    setNodes: vi.fn(),
    setEdges: vi.fn(),
    addNodes: vi.fn(),
    addEdges: vi.fn(),
    deleteElements: vi.fn(),
    fitView: vi.fn(),
    zoomToFit: vi.fn(),
    getViewport: vi.fn(() => ({ x: 0, y: 0, zoom: 1 })),
    setViewport: vi.fn(),
  }),
}));

const mockWorkflow: WorkflowDefinition = {
  name: 'Test Workflow',
  description: 'A test workflow for hook testing',
  stages: [
    {
      name: 'planning',
      agent: 'planner',
      description: 'Plan the implementation',
      dependencies: [],
      gates: [],
    },
    {
      name: 'development',
      agent: 'developer',
      description: 'Implement the feature',
      dependencies: ['planning'],
      gates: [],
    },
  ],
  gates: [],
};

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <WorkflowEditorProvider initialWorkflow={mockWorkflow}>
    {children}
  </WorkflowEditorProvider>
);

describe('useWorkflowEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('provides initial workflow state', () => {
    const { result } = renderHook(() => useWorkflowEditor(), { wrapper });

    expect(result.current.workflow).toEqual(mockWorkflow);
    expect(result.current.nodes).toBeDefined();
    expect(result.current.edges).toBeDefined();
    expect(result.current.selectedStage).toBeNull();
  });

  it('adds new stage to workflow', () => {
    const { result } = renderHook(() => useWorkflowEditor(), { wrapper });

    const newStage: Stage = {
      name: 'testing',
      agent: 'tester',
      description: 'Test the implementation',
      dependencies: ['development'],
      gates: [],
    };

    act(() => {
      result.current.addStage(newStage);
    });

    expect(result.current.workflow.stages).toContain(
      expect.objectContaining({ name: 'testing' })
    );
  });

  it('removes stage from workflow', () => {
    const { result } = renderHook(() => useWorkflowEditor(), { wrapper });

    act(() => {
      result.current.removeStage('planning');
    });

    expect(result.current.workflow.stages).not.toContain(
      expect.objectContaining({ name: 'planning' })
    );
  });

  it('updates stage in workflow', () => {
    const { result } = renderHook(() => useWorkflowEditor(), { wrapper });

    const updatedStage: Stage = {
      name: 'planning',
      agent: 'senior-planner',
      description: 'Updated planning description',
      dependencies: [],
      gates: [],
    };

    act(() => {
      result.current.updateStage('planning', updatedStage);
    });

    const planningStage = result.current.workflow.stages.find(s => s.name === 'planning');
    expect(planningStage?.agent).toBe('senior-planner');
    expect(planningStage?.description).toBe('Updated planning description');
  });

  it('adds dependency between stages', () => {
    const { result } = renderHook(() => useWorkflowEditor(), { wrapper });

    const newStage: Stage = {
      name: 'testing',
      agent: 'tester',
      description: 'Test the implementation',
      dependencies: [],
      gates: [],
    };

    act(() => {
      result.current.addStage(newStage);
    });

    act(() => {
      result.current.addDependency('testing', 'development');
    });

    const testingStage = result.current.workflow.stages.find(s => s.name === 'testing');
    expect(testingStage?.dependencies).toContain('development');
  });

  it('removes dependency between stages', () => {
    const { result } = renderHook(() => useWorkflowEditor(), { wrapper });

    act(() => {
      result.current.removeDependency('development', 'planning');
    });

    const developmentStage = result.current.workflow.stages.find(s => s.name === 'development');
    expect(developmentStage?.dependencies).not.toContain('planning');
  });

  it('selects and deselects stages', () => {
    const { result } = renderHook(() => useWorkflowEditor(), { wrapper });

    expect(result.current.selectedStage).toBeNull();

    act(() => {
      result.current.selectStage('planning');
    });

    expect(result.current.selectedStage).toBe('planning');

    act(() => {
      result.current.selectStage(null);
    });

    expect(result.current.selectedStage).toBeNull();
  });

  it('handles node changes from React Flow', () => {
    const { result } = renderHook(() => useWorkflowEditor(), { wrapper });

    const nodeChanges = [
      {
        id: 'planning',
        type: 'position',
        position: { x: 100, y: 100 },
      },
    ];

    act(() => {
      result.current.handleNodesChange(nodeChanges as any);
    });

    // Should update node positions
    expect(result.current.nodes).toBeDefined();
  });

  it('handles edge changes from React Flow', () => {
    const { result } = renderHook(() => useWorkflowEditor(), { wrapper });

    const edgeChanges = [
      {
        id: 'planning-development',
        type: 'remove',
      },
    ];

    act(() => {
      result.current.handleEdgesChange(edgeChanges as any);
    });

    // Should update edges
    expect(result.current.edges).toBeDefined();
  });

  it('handles new connections between stages', () => {
    const { result } = renderHook(() => useWorkflowEditor(), { wrapper });

    const connection = {
      source: 'planning',
      target: 'development',
    };

    act(() => {
      result.current.handleConnect(connection as any);
    });

    // Should create new dependency
    const developmentStage = result.current.workflow.stages.find(s => s.name === 'development');
    expect(developmentStage?.dependencies).toContain('planning');
  });

  it('prevents duplicate dependencies', () => {
    const { result } = renderHook(() => useWorkflowEditor(), { wrapper });

    // development already depends on planning
    act(() => {
      result.current.addDependency('development', 'planning');
    });

    const developmentStage = result.current.workflow.stages.find(s => s.name === 'development');
    const planningCount = developmentStage?.dependencies.filter(d => d === 'planning').length;
    expect(planningCount).toBe(1);
  });

  it('prevents circular dependencies', () => {
    const { result } = renderHook(() => useWorkflowEditor(), { wrapper });

    // Try to make planning depend on development (would create a cycle)
    act(() => {
      result.current.addDependency('planning', 'development');
    });

    const planningStage = result.current.workflow.stages.find(s => s.name === 'planning');
    expect(planningStage?.dependencies).not.toContain('development');
  });

  it('handles stage removal with dependency cleanup', () => {
    const { result } = renderHook(() => useWorkflowEditor(), { wrapper });

    // Add a stage that depends on planning
    const newStage: Stage = {
      name: 'testing',
      agent: 'tester',
      description: 'Test the implementation',
      dependencies: ['planning'],
      gates: [],
    };

    act(() => {
      result.current.addStage(newStage);
    });

    // Remove planning stage
    act(() => {
      result.current.removeStage('planning');
    });

    // Testing stage should no longer depend on planning
    const testingStage = result.current.workflow.stages.find(s => s.name === 'testing');
    expect(testingStage?.dependencies).not.toContain('planning');
  });

  it('provides validation status', () => {
    const { result } = renderHook(() => useWorkflowEditor(), { wrapper });

    expect(result.current.isValid).toBeDefined();
    expect(typeof result.current.isValid).toBe('boolean');
  });

  it('provides dirty state tracking', () => {
    const { result } = renderHook(() => useWorkflowEditor(), { wrapper });

    expect(result.current.isDirty).toBe(false);

    // Make a change
    act(() => {
      result.current.updateStage('planning', {
        ...mockWorkflow.stages[0],
        description: 'Updated description',
      });
    });

    expect(result.current.isDirty).toBe(true);
  });

  it('supports undo functionality', () => {
    const { result } = renderHook(() => useWorkflowEditor(), { wrapper });

    const originalDescription = result.current.workflow.stages[0].description;

    // Make a change
    act(() => {
      result.current.updateStage('planning', {
        ...mockWorkflow.stages[0],
        description: 'Updated description',
      });
    });

    expect(result.current.workflow.stages[0].description).toBe('Updated description');

    // Undo the change
    act(() => {
      result.current.undo?.();
    });

    expect(result.current.workflow.stages[0].description).toBe(originalDescription);
  });

  it('supports redo functionality', () => {
    const { result } = renderHook(() => useWorkflowEditor(), { wrapper });

    const originalDescription = result.current.workflow.stages[0].description;

    // Make a change
    act(() => {
      result.current.updateStage('planning', {
        ...mockWorkflow.stages[0],
        description: 'Updated description',
      });
    });

    // Undo the change
    act(() => {
      result.current.undo?.();
    });

    expect(result.current.workflow.stages[0].description).toBe(originalDescription);

    // Redo the change
    act(() => {
      result.current.redo?.();
    });

    expect(result.current.workflow.stages[0].description).toBe('Updated description');
  });

  it('provides undo/redo status', () => {
    const { result } = renderHook(() => useWorkflowEditor(), { wrapper });

    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);

    // Make a change
    act(() => {
      result.current.updateStage('planning', {
        ...mockWorkflow.stages[0],
        description: 'Updated description',
      });
    });

    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);

    // Undo the change
    act(() => {
      result.current.undo?.();
    });

    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);
  });

  it('handles stage with gates', () => {
    const { result } = renderHook(() => useWorkflowEditor(), { wrapper });

    const stageWithGates: Stage = {
      name: 'deployment',
      agent: 'deployer',
      description: 'Deploy the application',
      dependencies: ['development'],
      gates: [
        {
          name: 'approval-gate',
          type: 'approval',
          approvers: ['manager', 'senior-dev'],
        },
      ],
    };

    act(() => {
      result.current.addStage(stageWithGates);
    });

    const deploymentStage = result.current.workflow.stages.find(s => s.name === 'deployment');
    expect(deploymentStage?.gates).toHaveLength(1);
    expect(deploymentStage?.gates[0].name).toBe('approval-gate');
  });

  it('handles complex workflows with multiple dependencies', () => {
    const { result } = renderHook(() => useWorkflowEditor(), { wrapper });

    // Add multiple stages with complex dependencies
    const stages: Stage[] = [
      {
        name: 'testing',
        agent: 'tester',
        description: 'Test the implementation',
        dependencies: ['development'],
        gates: [],
      },
      {
        name: 'security-review',
        agent: 'security',
        description: 'Security review',
        dependencies: ['development'],
        gates: [],
      },
      {
        name: 'deployment',
        agent: 'deployer',
        description: 'Deploy the application',
        dependencies: ['testing', 'security-review'],
        gates: [],
      },
    ];

    stages.forEach(stage => {
      act(() => {
        result.current.addStage(stage);
      });
    });

    const deploymentStage = result.current.workflow.stages.find(s => s.name === 'deployment');
    expect(deploymentStage?.dependencies).toContain('testing');
    expect(deploymentStage?.dependencies).toContain('security-review');
  });

  it('handles workflow reset', () => {
    const { result } = renderHook(() => useWorkflowEditor(), { wrapper });

    // Make some changes
    act(() => {
      result.current.addStage({
        name: 'testing',
        agent: 'tester',
        description: 'Test',
        dependencies: [],
        gates: [],
      });
    });

    expect(result.current.workflow.stages).toHaveLength(3);

    // Reset workflow
    act(() => {
      result.current.resetWorkflow?.();
    });

    expect(result.current.workflow.stages).toHaveLength(2);
    expect(result.current.isDirty).toBe(false);
  });
});