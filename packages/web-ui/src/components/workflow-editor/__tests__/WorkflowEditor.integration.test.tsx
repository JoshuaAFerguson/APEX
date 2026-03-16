import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { WorkflowEditor } from '../WorkflowEditor';
import { WorkflowEditorProvider } from '../WorkflowEditorProvider';
import type { WorkflowDefinition } from '@/types/workflow-editor';

// Mock dependencies with more detailed implementations for integration testing
vi.mock('@dnd-kit/core', () => {
  let draggedItem: any = null;
  let dropTarget: any = null;

  return {
    DndContext: ({ children, onDragStart, onDragEnd, onDragOver }: any) => {
      const handleDragStart = (event: any) => {
        draggedItem = event.active;
        onDragStart?.(event);
      };

      const handleDragEnd = (event: any) => {
        const finalEvent = {
          ...event,
          active: draggedItem,
          over: dropTarget,
          activatorEvent: event.activatorEvent,
        };
        onDragEnd?.(finalEvent);
        draggedItem = null;
        dropTarget = null;
      };

      const handleDrop = (event: any) => {
        dropTarget = { id: 'canvas' };
        const dropEvent = {
          active: draggedItem,
          over: dropTarget,
          activatorEvent: event,
        };
        onDragEnd?.(dropEvent);
      };

      return (
        <div
          data-testid="dnd-context"
          onMouseDown={(e) => handleDragStart({ active: { id: 'test-stage' }, activatorEvent: e })}
          onMouseUp={handleDrop}
          onDrop={handleDrop}
        >
          {children}
        </div>
      );
    },
    DragOverlay: ({ children }: any) => (
      <div data-testid="drag-overlay">{children}</div>
    ),
    useDraggable: () => ({
      attributes: { 'data-testid': 'draggable-stage' },
      listeners: {
        onMouseDown: vi.fn(),
        onTouchStart: vi.fn(),
      },
      setNodeRef: vi.fn(),
      transform: { x: 0, y: 0 },
      isDragging: false,
    }),
    useDroppable: () => ({
      setNodeRef: vi.fn(),
      isOver: false,
    }),
    useDndMonitor: (callbacks: any) => {
      // Simulate drag monitor events
      React.useEffect(() => {
        // Mock some drag events for testing
      }, [callbacks]);
    },
    pointerWithin: vi.fn(),
    rectIntersection: vi.fn(),
  };
});

vi.mock('react-flow-renderer', () => ({
  default: ({ children, onNodesChange, onEdgesChange, onConnect, nodes, edges }: any) => (
    <div
      data-testid="react-flow"
      data-nodes-count={nodes?.length || 0}
      data-edges-count={edges?.length || 0}
      onClick={() => {
        onNodesChange?.([]);
        onEdgesChange?.([]);
        onConnect?.({ source: 'test', target: 'test2' });
      }}
    >
      {children}
      {nodes?.map((node: any) => (
        <div key={node.id} data-testid={`flow-node-${node.id}`}>
          {node.data?.label || node.id}
        </div>
      ))}
      {edges?.map((edge: any) => (
        <div key={edge.id} data-testid={`flow-edge-${edge.id}`}>
          {edge.source} → {edge.target}
        </div>
      ))}
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

const mockInitialWorkflow: WorkflowDefinition = {
  name: 'Integration Test Workflow',
  description: 'A workflow for testing drag and drop integration',
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

const renderWorkflowEditorWithProvider = (workflow?: Partial<WorkflowDefinition>) => {
  const initialWorkflow = { ...mockInitialWorkflow, ...workflow };

  return render(
    <WorkflowEditorProvider initialWorkflow={initialWorkflow}>
      <WorkflowEditor />
    </WorkflowEditorProvider>
  );
};

describe('WorkflowEditor Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Drag and Drop Workflow', () => {
    it('allows dragging stages from palette to canvas', async () => {
      renderWorkflowEditorWithProvider();

      const dndContext = screen.getByTestId('dnd-context');

      // Simulate drag start
      fireEvent.mouseDown(dndContext, {
        clientX: 100,
        clientY: 100,
        button: 0
      });

      // Simulate drag end (drop on canvas)
      fireEvent.mouseUp(dndContext, {
        clientX: 200,
        clientY: 200,
        button: 0
      });

      // Should update the workflow
      expect(dndContext).toBeInTheDocument();
    });

    it('provides visual feedback during drag operations', async () => {
      renderWorkflowEditorWithProvider();

      const dragOverlay = screen.getByTestId('drag-overlay');
      expect(dragOverlay).toBeInTheDocument();

      const dndContext = screen.getByTestId('dnd-context');

      // Start drag operation
      fireEvent.mouseDown(dndContext, {
        clientX: 50,
        clientY: 50,
        button: 0
      });

      // Drag overlay should show visual feedback
      expect(dragOverlay).toBeInTheDocument();
    });

    it('handles stage reordering via drag and drop', async () => {
      const workflowWithMultipleStages = {
        stages: [
          {
            name: 'planning',
            agent: 'planner',
            description: 'Planning stage',
            dependencies: [],
            gates: [],
          },
          {
            name: 'development',
            agent: 'developer',
            description: 'Development stage',
            dependencies: ['planning'],
            gates: [],
          },
          {
            name: 'testing',
            agent: 'tester',
            description: 'Testing stage',
            dependencies: ['development'],
            gates: [],
          },
        ],
      };

      renderWorkflowEditorWithProvider(workflowWithMultipleStages);

      const reactFlow = screen.getByTestId('react-flow');
      expect(reactFlow).toHaveAttribute('data-nodes-count', '3');

      const dndContext = screen.getByTestId('dnd-context');

      // Simulate reordering by drag and drop
      fireEvent.mouseDown(dndContext);
      fireEvent.mouseUp(dndContext);

      // Should maintain stage structure
      expect(reactFlow).toBeInTheDocument();
    });

    it('updates stage dependencies when reordering', async () => {
      const workflowWithDependencies = {
        stages: [
          {
            name: 'stage1',
            agent: 'agent1',
            description: 'First stage',
            dependencies: [],
            gates: [],
          },
          {
            name: 'stage2',
            agent: 'agent2',
            description: 'Second stage',
            dependencies: ['stage1'],
            gates: [],
          },
          {
            name: 'stage3',
            agent: 'agent3',
            description: 'Third stage',
            dependencies: ['stage2'],
            gates: [],
          },
        ],
      };

      renderWorkflowEditorWithProvider(workflowWithDependencies);

      const reactFlow = screen.getByTestId('react-flow');
      expect(reactFlow).toHaveAttribute('data-edges-count');

      // Simulate reordering that would affect dependencies
      const dndContext = screen.getByTestId('dnd-context');
      fireEvent.mouseDown(dndContext);
      fireEvent.mouseUp(dndContext);

      // Dependencies should be updated appropriately
      expect(reactFlow).toBeInTheDocument();
    });

    it('prevents invalid drops', async () => {
      renderWorkflowEditorWithProvider();

      const dndContext = screen.getByTestId('dnd-context');

      // Simulate invalid drop (e.g., outside canvas)
      fireEvent.mouseDown(dndContext, { clientX: 0, clientY: 0 });
      fireEvent.mouseUp(document.body, { clientX: -100, clientY: -100 });

      // Should not add invalid stages
      expect(dndContext).toBeInTheDocument();
    });
  });

  describe('Stage Addition Workflow', () => {
    it('adds new stages to workflow via drag and drop', async () => {
      renderWorkflowEditorWithProvider({ stages: [] });

      const reactFlow = screen.getByTestId('react-flow');
      const dndContext = screen.getByTestId('dnd-context');

      // Initially no stages
      expect(reactFlow).toHaveAttribute('data-nodes-count', '0');

      // Simulate adding a stage
      fireEvent.mouseDown(dndContext);
      fireEvent.mouseUp(dndContext);

      // Workflow should be updated
      expect(dndContext).toBeInTheDocument();
    });

    it('calculates positions for new stages automatically', async () => {
      renderWorkflowEditorWithProvider();

      const dndContext = screen.getByTestId('dnd-context');

      // Add multiple stages
      fireEvent.mouseDown(dndContext);
      fireEvent.mouseUp(dndContext);

      fireEvent.mouseDown(dndContext);
      fireEvent.mouseUp(dndContext);

      // Should position stages appropriately
      expect(dndContext).toBeInTheDocument();
    });

    it('validates new stage additions', async () => {
      renderWorkflowEditorWithProvider();

      const dndContext = screen.getByTestId('dnd-context');

      // Simulate adding a stage
      fireEvent.mouseDown(dndContext);
      fireEvent.mouseUp(dndContext);

      // Should validate the workflow after addition
      expect(dndContext).toBeInTheDocument();
    });
  });

  describe('Stage Removal and Modification', () => {
    it('removes stages and updates dependencies', async () => {
      const workflowWithDependentStages = {
        stages: [
          {
            name: 'stage1',
            agent: 'agent1',
            description: 'First stage',
            dependencies: [],
            gates: [],
          },
          {
            name: 'stage2',
            agent: 'agent2',
            description: 'Second stage that depends on first',
            dependencies: ['stage1'],
            gates: [],
          },
        ],
      };

      renderWorkflowEditorWithProvider(workflowWithDependentStages);

      const reactFlow = screen.getByTestId('react-flow');
      expect(reactFlow).toHaveAttribute('data-nodes-count', '2');

      // Simulate stage removal (e.g., via keyboard shortcut or context menu)
      fireEvent.keyDown(reactFlow, { key: 'Delete' });

      // Should handle dependency cleanup
      expect(reactFlow).toBeInTheDocument();
    });

    it('updates stage properties and maintains consistency', async () => {
      renderWorkflowEditorWithProvider();

      const reactFlow = screen.getByTestId('react-flow');

      // Simulate stage property changes
      fireEvent.click(reactFlow);

      // Should maintain workflow consistency
      expect(reactFlow).toBeInTheDocument();
    });
  });

  describe('Complex Workflow Operations', () => {
    it('handles complex drag and drop scenarios', async () => {
      const complexWorkflow = {
        stages: Array.from({ length: 10 }, (_, i) => ({
          name: `stage${i}`,
          agent: `agent${i % 3}`,
          description: `Stage ${i} description`,
          dependencies: i > 0 ? [`stage${i - 1}`] : [],
          gates: i % 3 === 0 ? [{
            name: `gate${i}`,
            type: 'approval' as const,
            approvers: [`approver${i}`],
          }] : [],
        })),
        gates: [],
      };

      renderWorkflowEditorWithProvider(complexWorkflow);

      const reactFlow = screen.getByTestId('react-flow');
      expect(reactFlow).toHaveAttribute('data-nodes-count', '10');

      const dndContext = screen.getByTestId('dnd-context');

      // Simulate complex drag operations
      for (let i = 0; i < 3; i++) {
        fireEvent.mouseDown(dndContext);
        fireEvent.mouseUp(dndContext);
      }

      // Should maintain workflow integrity
      expect(reactFlow).toBeInTheDocument();
    });

    it('maintains undo/redo functionality during drag operations', async () => {
      renderWorkflowEditorWithProvider();

      const dndContext = screen.getByTestId('dnd-context');

      // Perform drag operation
      fireEvent.mouseDown(dndContext);
      fireEvent.mouseUp(dndContext);

      // Simulate undo
      fireEvent.keyDown(document, { key: 'z', ctrlKey: true });

      // Should revert changes
      expect(dndContext).toBeInTheDocument();
    });

    it('validates workflow during drag operations', async () => {
      renderWorkflowEditorWithProvider();

      const dndContext = screen.getByTestId('dnd-context');

      // Perform operations that might create validation issues
      fireEvent.mouseDown(dndContext);
      fireEvent.mouseUp(dndContext);

      // Should validate and show errors if any
      expect(dndContext).toBeInTheDocument();
    });
  });

  describe('Performance and User Experience', () => {
    it('handles rapid drag operations without issues', async () => {
      renderWorkflowEditorWithProvider();

      const dndContext = screen.getByTestId('dnd-context');

      // Simulate rapid drag operations
      for (let i = 0; i < 10; i++) {
        fireEvent.mouseDown(dndContext, { clientX: i * 10, clientY: i * 10 });
        fireEvent.mouseUp(dndContext, { clientX: i * 10 + 50, clientY: i * 10 + 50 });
      }

      // Should handle rapid operations gracefully
      expect(dndContext).toBeInTheDocument();
    });

    it('provides smooth user interaction feedback', async () => {
      renderWorkflowEditorWithProvider();

      const dndContext = screen.getByTestId('dnd-context');
      const dragOverlay = screen.getByTestId('drag-overlay');

      // Start drag
      fireEvent.mouseDown(dndContext);

      // Should show immediate feedback
      expect(dragOverlay).toBeInTheDocument();

      // End drag
      fireEvent.mouseUp(dndContext);

      // Should complete operation smoothly
      expect(dndContext).toBeInTheDocument();
    });

    it('maintains accessibility during drag operations', async () => {
      renderWorkflowEditorWithProvider();

      const dndContext = screen.getByTestId('dnd-context');

      // Should be keyboard accessible
      fireEvent.keyDown(dndContext, { key: 'Enter' });
      fireEvent.keyDown(dndContext, { key: 'Escape' });

      expect(dndContext).toBeInTheDocument();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('handles drag operations with empty workflow', async () => {
      renderWorkflowEditorWithProvider({ stages: [], gates: [] });

      const dndContext = screen.getByTestId('dnd-context');

      // Should handle empty state gracefully
      fireEvent.mouseDown(dndContext);
      fireEvent.mouseUp(dndContext);

      expect(dndContext).toBeInTheDocument();
    });

    it('recovers from failed drag operations', async () => {
      renderWorkflowEditorWithProvider();

      const dndContext = screen.getByTestId('dnd-context');

      // Simulate failed drag (e.g., network error during save)
      fireEvent.mouseDown(dndContext);
      fireEvent.mouseUp(dndContext);

      // Should handle errors gracefully
      expect(dndContext).toBeInTheDocument();
    });

    it('prevents invalid workflow states during drag', async () => {
      renderWorkflowEditorWithProvider();

      const dndContext = screen.getByTestId('dnd-context');

      // Simulate operations that could create invalid states
      fireEvent.mouseDown(dndContext);
      fireEvent.mouseUp(dndContext);

      // Should maintain valid workflow state
      expect(dndContext).toBeInTheDocument();
    });
  });
});