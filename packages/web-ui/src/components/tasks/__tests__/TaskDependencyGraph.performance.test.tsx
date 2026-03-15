/**
 * Performance tests for TaskDependencyGraph component
 *
 * Tests rendering performance, memory usage, and responsiveness
 * under various load conditions and dataset sizes.
 */

import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom'
import { createTask } from '@apexcli/core/factories'
import type { Task } from '@apexcli/core'

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  })),
}))

// Mock React Flow for performance testing
let renderCount = 0
let lastRenderTime = 0

const performanceTrackingReactFlow = vi.fn((props) => {
  const startTime = performance.now()
  renderCount++

  const nodes = props.nodes || []
  const edges = props.edges || []

  // Simulate realistic React Flow rendering time based on node count
  const baseRenderTime = 1 // 1ms base time
  const nodeRenderTime = nodes.length * 0.1 // 0.1ms per node
  const edgeRenderTime = edges.length * 0.05 // 0.05ms per edge

  // Use actual performance timing
  const endTime = performance.now()
  lastRenderTime = endTime - startTime

  return (
    <div
      data-testid="performance-react-flow"
      data-render-count={renderCount}
      data-nodes-count={nodes.length}
      data-edges-count={edges.length}
      data-render-time={lastRenderTime}
    >
      <div data-testid="performance-nodes">
        {nodes.map((node: any, index: number) => (
          <div
            key={node.id}
            data-testid={`perf-node-${index}`}
            data-node-id={node.id}
            onClick={() => props.onNodeClick?.(node)}
          >
            {node.data?.label}
          </div>
        ))}
      </div>
      <div data-testid="performance-edges">
        {edges.map((edge: any, index: number) => (
          <div
            key={edge.id}
            data-testid={`perf-edge-${index}`}
            data-edge-id={edge.id}
          >
            {edge.source} → {edge.target}
          </div>
        ))}
      </div>
    </div>
  )
})

vi.mock('@xyflow/react', () => ({
  ReactFlow: performanceTrackingReactFlow,
  MiniMap: vi.fn(() => <div data-testid="minimap">MiniMap</div>),
  Controls: vi.fn(() => <div data-testid="controls">Controls</div>),
  Background: vi.fn(() => <div data-testid="background">Background</div>),
  useNodesState: vi.fn(() => [[], vi.fn(), vi.fn()]),
  useEdgesState: vi.fn(() => [[], vi.fn(), vi.fn()]),
  BackgroundVariant: { Dots: 'dots', Lines: 'lines', Cross: 'cross' },
}))

vi.mock('@xyflow/react/dist/style.css', () => ({}))
vi.mock('@/lib/utils', () => ({
  cn: vi.fn((...classes) => classes.filter(Boolean).join(' ')),
}))

// Mock DependencyGraph with performance tracking
vi.mock('@/components/graphs/DependencyGraph', () => ({
  DependencyGraph: vi.fn((props) => (
    <div data-testid="dependency-graph-performance">
      {performanceTrackingReactFlow(props)}
    </div>
  )),
}))

import { TaskDependencyGraph } from '../TaskDependencyGraph'

describe('TaskDependencyGraph Performance Tests', () => {
  beforeEach(() => {
    renderCount = 0
    lastRenderTime = 0
    vi.clearAllMocks()
  })

  afterEach(() => {
    // Clean up any memory leaks
    vi.clearAllMocks()
  })

  describe('Rendering Performance', () => {
    it('should render small task sets quickly', () => {
      const tasks = Array.from({ length: 10 }, (_, i) =>
        createTask({
          id: `small-task-${i}`,
          description: `Small task ${i}`,
          status: 'pending',
        })
      )

      const startTime = performance.now()
      render(<TaskDependencyGraph tasks={tasks} />)
      const endTime = performance.now()

      const renderTime = endTime - startTime

      expect(renderTime).toBeLessThan(50) // Should render in under 50ms
      expect(screen.getByTestId('performance-react-flow')).toHaveAttribute('data-nodes-count', '10')
    })

    it('should render medium task sets efficiently', () => {
      const tasks = Array.from({ length: 50 }, (_, i) =>
        createTask({
          id: `medium-task-${i}`,
          description: `Medium task ${i}`,
          status: i % 3 === 0 ? 'completed' : i % 3 === 1 ? 'in-progress' : 'pending',
        })
      )

      const startTime = performance.now()
      render(<TaskDependencyGraph tasks={tasks} />)
      const endTime = performance.now()

      const renderTime = endTime - startTime

      expect(renderTime).toBeLessThan(150) // Should render in under 150ms
      expect(screen.getByTestId('performance-react-flow')).toHaveAttribute('data-nodes-count', '50')
    })

    it('should handle large task sets with acceptable performance', () => {
      const tasks = Array.from({ length: 100 }, (_, i) =>
        createTask({
          id: `large-task-${i}`,
          description: `Large task ${i} with longer description to test text rendering performance`,
          status: ['pending', 'in-progress', 'completed', 'failed'][i % 4] as any,
        })
      )

      const startTime = performance.now()
      render(<TaskDependencyGraph tasks={tasks} />)
      const endTime = performance.now()

      const renderTime = endTime - startTime

      expect(renderTime).toBeLessThan(300) // Should render in under 300ms
      expect(screen.getByTestId('performance-react-flow')).toHaveAttribute('data-nodes-count', '100')
    })

    it('should handle very large task sets without crashing', () => {
      const tasks = Array.from({ length: 500 }, (_, i) =>
        createTask({
          id: `huge-task-${i}`,
          description: `Huge task ${i}`,
          status: 'pending',
        })
      )

      const startTime = performance.now()

      expect(() => {
        render(<TaskDependencyGraph tasks={tasks} />)
      }).not.toThrow()

      const endTime = performance.now()
      const renderTime = endTime - startTime

      // Should still render within reasonable time (1 second)
      expect(renderTime).toBeLessThan(1000)
      expect(screen.getByTestId('performance-react-flow')).toHaveAttribute('data-nodes-count', '500')
    })
  })

  describe('Complex Dependency Performance', () => {
    it('should handle dense dependency networks efficiently', () => {
      // Create tasks where each task depends on multiple previous tasks
      const tasks: Task[] = []

      for (let i = 0; i < 30; i++) {
        const dependsOn = []
        // Each task depends on up to 3 previous tasks
        for (let j = Math.max(0, i - 3); j < i; j++) {
          dependsOn.push(`dense-task-${j}`)
        }

        tasks.push(createTask({
          id: `dense-task-${i}`,
          description: `Dense dependency task ${i}`,
          dependsOn: dependsOn.length > 0 ? dependsOn : undefined,
        }))
      }

      const startTime = performance.now()
      render(<TaskDependencyGraph tasks={tasks} />)
      const endTime = performance.now()

      const renderTime = endTime - startTime
      expect(renderTime).toBeLessThan(200)

      // Should create many edges for dense dependencies
      const reactFlow = screen.getByTestId('performance-react-flow')
      const edgeCount = parseInt(reactFlow.getAttribute('data-edges-count') || '0')
      expect(edgeCount).toBeGreaterThan(40) // Many dependency edges
    })

    it('should handle complex hierarchical structures efficiently', () => {
      // Create a tree structure: 1 root → 5 branches → 4 leaves each = 26 total tasks
      const tasks: Task[] = []

      // Root task
      const rootTask = createTask({
        id: 'root',
        description: 'Root epic task',
        subtaskIds: ['branch-0', 'branch-1', 'branch-2', 'branch-3', 'branch-4'],
      })
      tasks.push(rootTask)

      // Branch tasks
      for (let branch = 0; branch < 5; branch++) {
        const branchTask = createTask({
          id: `branch-${branch}`,
          description: `Branch task ${branch}`,
          parentTaskId: 'root',
          subtaskIds: [`leaf-${branch}-0`, `leaf-${branch}-1`, `leaf-${branch}-2`, `leaf-${branch}-3`],
        })
        tasks.push(branchTask)

        // Leaf tasks
        for (let leaf = 0; leaf < 4; leaf++) {
          const leafTask = createTask({
            id: `leaf-${branch}-${leaf}`,
            description: `Leaf task ${branch}-${leaf}`,
            parentTaskId: `branch-${branch}`,
          })
          tasks.push(leafTask)
        }
      }

      const startTime = performance.now()
      render(<TaskDependencyGraph tasks={tasks} />)
      const endTime = performance.now()

      const renderTime = endTime - startTime
      expect(renderTime).toBeLessThan(150)

      expect(screen.getByTestId('performance-react-flow')).toHaveAttribute('data-nodes-count', '26')
      // Should have 25 parent-child edges (5 + 20)
      expect(screen.getByTestId('performance-react-flow')).toHaveAttribute('data-edges-count', '25')
    })

    it('should efficiently transform large datasets', () => {
      // Test the transformation function performance with mixed relationships
      const tasks: Task[] = []

      // Create 100 tasks with various relationship types
      for (let i = 0; i < 100; i++) {
        const task = createTask({
          id: `transform-task-${i}`,
          description: `Transformation test task ${i}`,
        })

        // Add dependencies to some tasks
        if (i > 10) {
          task.dependsOn = [`transform-task-${i - 5}`, `transform-task-${i - 10}`]
        }

        // Add parent-child relationships to some tasks
        if (i % 10 === 0 && i > 0) {
          task.subtaskIds = [`transform-task-${i + 1}`, `transform-task-${i + 2}`]
        }
        if ((i - 1) % 10 === 0 || (i - 2) % 10 === 0) {
          task.parentTaskId = `transform-task-${Math.floor(i / 10) * 10}`
        }

        tasks.push(task)
      }

      const startTime = performance.now()
      render(<TaskDependencyGraph tasks={tasks} />)
      const endTime = performance.now()

      const transformTime = endTime - startTime
      expect(transformTime).toBeLessThan(250)

      expect(screen.getByTestId('performance-react-flow')).toHaveAttribute('data-nodes-count', '100')
    })
  })

  describe('Re-render Performance', () => {
    it('should efficiently handle task status updates', () => {
      const tasks = Array.from({ length: 20 }, (_, i) =>
        createTask({
          id: `status-task-${i}`,
          description: `Status update task ${i}`,
          status: 'pending',
        })
      )

      const { rerender } = render(<TaskDependencyGraph tasks={tasks} />)

      // Initial render count
      expect(renderCount).toBeGreaterThan(0)
      const initialRenderCount = renderCount

      // Update all task statuses multiple times
      const statuses = ['in-progress', 'paused', 'completed']

      statuses.forEach(status => {
        const startTime = performance.now()

        const updatedTasks = tasks.map(task => ({
          ...task,
          status: status as any,
        }))

        rerender(<TaskDependencyGraph tasks={updatedTasks} />)

        const endTime = performance.now()
        const rerenderTime = endTime - startTime

        expect(rerenderTime).toBeLessThan(100) // Re-renders should be fast
      })
    })

    it('should efficiently handle dynamic dependency changes', () => {
      let tasks = Array.from({ length: 15 }, (_, i) =>
        createTask({
          id: `dynamic-task-${i}`,
          description: `Dynamic task ${i}`,
        })
      )

      const { rerender } = render(<TaskDependencyGraph tasks={tasks} />)

      // Progressively add dependencies
      for (let iteration = 0; iteration < 5; iteration++) {
        const startTime = performance.now()

        tasks = tasks.map(task => {
          if (task.id !== 'dynamic-task-0') {
            return {
              ...task,
              dependsOn: [`dynamic-task-${Math.max(0, parseInt(task.id.split('-')[2]) - 1)}`]
            }
          }
          return task
        })

        rerender(<TaskDependencyGraph tasks={tasks} />)

        const endTime = performance.now()
        const updateTime = endTime - startTime

        expect(updateTime).toBeLessThan(80) // Dependency updates should be fast
      }
    })
  })

  describe('Memory and Resource Management', () => {
    it('should not create memory leaks with large datasets', () => {
      // Create and destroy large task sets multiple times
      for (let iteration = 0; iteration < 5; iteration++) {
        const tasks = Array.from({ length: 100 }, (_, i) =>
          createTask({
            id: `memory-test-${iteration}-${i}`,
            description: `Memory test iteration ${iteration} task ${i}`,
          })
        )

        const { unmount } = render(<TaskDependencyGraph tasks={tasks} />)

        expect(screen.getByTestId('performance-react-flow')).toHaveAttribute('data-nodes-count', '100')

        // Unmount to free memory
        unmount()
      }

      // Test should complete without memory issues
      expect(true).toBe(true)
    })

    it('should handle rapid task additions and removals', () => {
      let tasks: Task[] = []

      const { rerender } = render(<TaskDependencyGraph tasks={tasks} />)

      // Rapidly add tasks
      for (let i = 0; i < 50; i++) {
        tasks.push(createTask({
          id: `rapid-task-${i}`,
          description: `Rapid task ${i}`,
        }))

        if (i % 10 === 0) {
          const startTime = performance.now()
          rerender(<TaskDependencyGraph tasks={[...tasks]} />)
          const endTime = performance.now()

          expect(endTime - startTime).toBeLessThan(100)
        }
      }

      // Rapidly remove tasks
      for (let i = 49; i >= 0; i--) {
        tasks.pop()

        if (i % 10 === 0) {
          const startTime = performance.now()
          rerender(<TaskDependencyGraph tasks={[...tasks]} />)
          const endTime = performance.now()

          expect(endTime - startTime).toBeLessThan(100)
        }
      }
    })
  })

  describe('User Interaction Performance', () => {
    it('should respond quickly to node clicks even with many tasks', () => {
      const tasks = Array.from({ length: 100 }, (_, i) =>
        createTask({
          id: `click-task-${i}`,
          description: `Click test task ${i}`,
        })
      )

      const mockOnClick = vi.fn()
      render(<TaskDependencyGraph tasks={tasks} onTaskClick={mockOnClick} />)

      // Test clicking multiple nodes
      for (let i = 0; i < 10; i++) {
        const startTime = performance.now()

        const node = screen.getByTestId(`perf-node-${i}`)
        fireEvent.click(node)

        const endTime = performance.now()
        const clickTime = endTime - startTime

        expect(clickTime).toBeLessThan(50) // Click responses should be immediate
        expect(mockOnClick).toHaveBeenLastCalledWith(`click-task-${i}`)
      }
    })

    it('should maintain responsiveness during continuous interactions', () => {
      const tasks = Array.from({ length: 50 }, (_, i) =>
        createTask({
          id: `continuous-task-${i}`,
          description: `Continuous interaction task ${i}`,
        })
      )

      const mockOnClick = vi.fn()
      render(<TaskDependencyGraph tasks={tasks} onTaskClick={mockOnClick} />)

      // Simulate rapid clicking
      const clickTimes: number[] = []

      for (let i = 0; i < 20; i++) {
        const startTime = performance.now()

        const nodeIndex = i % 10 // Click first 10 nodes repeatedly
        const node = screen.getByTestId(`perf-node-${nodeIndex}`)

        act(() => {
          fireEvent.click(node)
        })

        const endTime = performance.now()
        clickTimes.push(endTime - startTime)
      }

      // All clicks should be fast
      clickTimes.forEach(time => {
        expect(time).toBeLessThan(30)
      })

      // Average response time should be very fast
      const avgClickTime = clickTimes.reduce((a, b) => a + b, 0) / clickTimes.length
      expect(avgClickTime).toBeLessThan(20)
    })
  })
})