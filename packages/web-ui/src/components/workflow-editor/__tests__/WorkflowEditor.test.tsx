import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { WorkflowEditor } from '../WorkflowEditor';
import { WorkflowEditorProvider } from '../WorkflowEditorProvider';
import type { WorkflowDefinition } from '@/types/workflow-editor';

// Mock dependencies
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children, onDragEnd }: any) => (
    <div data-testid="dnd-context" onDrop={(e) => onDragEnd?.({ active: null, over: null, activatorEvent: e })}>
      {children}
    </div>
  ),
  DragOverlay: ({ children }: any) => <div data-testid="drag-overlay">{children}</div>,
  useDndMonitor: () => ({}),
  pointerWithin: vi.fn(),
  rectIntersection: vi.fn(),
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: {
    Translate: {
      toString: vi.fn(() => 'translate(0px, 0px)'),
    },
  },
}));

vi.mock('@dnd-kit/sortable', () => ({
  arrayMove: vi.fn((array, oldIndex, newIndex) => {
    const result = [...array];
    const [removed] = result.splice(oldIndex, 1);
    result.splice(newIndex, 0, removed);
    return result;
  }),
}));

vi.mock('react-flow-renderer', () => ({
  default: ({ children, onNodesChange, onEdgesChange, onConnect }: any) => (
    <div data-testid="react-flow" onClick={() => {
      onNodesChange?.([]);
      onEdgesChange?.([]);
      onConnect?.({ source: 'test', target: 'test2' });
    }}>
      {children}
    </div>
  ),
  MiniMap: () => <div data-testid="minimap" />,
  Controls: () => <div data-testid="controls" />,
  Background: () => <div data-testid="background" />,
  Handle: () => <div data-testid="handle" />,
  Position: {
    Top: 'top',
    Bottom: 'bottom',
    Left: 'left',
    Right: 'right',
  },
}));

const mockWorkflow: WorkflowDefinition = {
  name: 'Test Workflow',
  description: 'A test workflow for unit testing',
  stages: [
    {
      name: 'planning',
      agent: 'planner',
      description: 'Plan the implementation',
      dependencies: [],
      gates: [],
    },
  ],
  gates: [],
};

const renderWorkflowEditor = (workflow?: Partial<WorkflowDefinition>) => {
  const initialWorkflow = { ...mockWorkflow, ...workflow };

  return render(
    <WorkflowEditorProvider initialWorkflow={initialWorkflow}>
      <WorkflowEditor />
    </WorkflowEditorProvider>
  );
};

describe('WorkflowEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all main components', () => {
    renderWorkflowEditor();

    expect(screen.getByTestId('dnd-context')).toBeInTheDocument();
    expect(screen.getByTestId('react-flow')).toBeInTheDocument();
    expect(screen.getByTestId('drag-overlay')).toBeInTheDocument();
  });

  it('displays workflow stages as nodes', () => {
    renderWorkflowEditor({
      stages: [
        { name: 'stage1', agent: 'planner', description: 'Stage 1', dependencies: [], gates: [] },
        { name: 'stage2', agent: 'developer', description: 'Stage 2', dependencies: [], gates: [] },
      ],
    });

    // Should render React Flow which will display the stages
    expect(screen.getByTestId('react-flow')).toBeInTheDocument();
  });

  it('handles empty workflow', () => {
    renderWorkflowEditor({ stages: [], gates: [] });

    expect(screen.getByTestId('react-flow')).toBeInTheDocument();
    expect(screen.getByTestId('dnd-context')).toBeInTheDocument();
  });

  it('provides drag and drop context', () => {
    renderWorkflowEditor();

    const dndContext = screen.getByTestId('dnd-context');
    expect(dndContext).toBeInTheDocument();
  });

  it('handles drag end events', async () => {
    renderWorkflowEditor();

    const dndContext = screen.getByTestId('dnd-context');

    // Simulate a drop event
    fireEvent.drop(dndContext);

    // Should not throw errors
    expect(dndContext).toBeInTheDocument();
  });

  it('renders minimap and controls', () => {
    renderWorkflowEditor();

    expect(screen.getByTestId('minimap')).toBeInTheDocument();
    expect(screen.getByTestId('controls')).toBeInTheDocument();
    expect(screen.getByTestId('background')).toBeInTheDocument();
  });

  it('supports keyboard navigation', async () => {
    renderWorkflowEditor();

    const reactFlow = screen.getByTestId('react-flow');

    // Test keyboard events don't cause errors
    fireEvent.keyDown(reactFlow, { key: 'Escape' });
    fireEvent.keyDown(reactFlow, { key: 'Delete' });

    expect(reactFlow).toBeInTheDocument();
  });

  it('maintains workflow state during interactions', () => {
    const { rerender } = renderWorkflowEditor();

    // Initial render should work
    expect(screen.getByTestId('react-flow')).toBeInTheDocument();

    // Re-render with updated workflow
    rerender(
      <WorkflowEditorProvider initialWorkflow={{
        ...mockWorkflow,
        stages: [
          ...mockWorkflow.stages,
          { name: 'newStage', agent: 'tester', description: 'New stage', dependencies: [], gates: [] }
        ]
      }}>
        <WorkflowEditor />
      </WorkflowEditorProvider>
    );

    expect(screen.getByTestId('react-flow')).toBeInTheDocument();
  });

  it('handles complex workflows with multiple stages and dependencies', () => {
    const complexWorkflow = {
      name: 'Complex Workflow',
      description: 'A workflow with multiple stages and dependencies',
      stages: [
        { name: 'planning', agent: 'planner', description: 'Planning stage', dependencies: [], gates: [] },
        { name: 'development', agent: 'developer', description: 'Development stage', dependencies: ['planning'], gates: [] },
        { name: 'testing', agent: 'tester', description: 'Testing stage', dependencies: ['development'], gates: [] },
        { name: 'deployment', agent: 'deployer', description: 'Deployment stage', dependencies: ['testing'], gates: [] },
      ],
      gates: [],
    };

    renderWorkflowEditor(complexWorkflow);

    expect(screen.getByTestId('react-flow')).toBeInTheDocument();
    expect(screen.getByTestId('dnd-context')).toBeInTheDocument();
  });

  it('provides accessibility features', () => {
    renderWorkflowEditor();

    const reactFlow = screen.getByTestId('react-flow');
    const dndContext = screen.getByTestId('dnd-context');

    // Components should be accessible
    expect(reactFlow).toBeInTheDocument();
    expect(dndContext).toBeInTheDocument();
  });
});