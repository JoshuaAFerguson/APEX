/**
 * Integration tests for DependencyGraph component
 *
 * These tests verify the integration between different parts of the component
 * and real-world usage scenarios.
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import '@testing-library/jest-dom'

// Mock React Flow with more realistic behavior
let mockNodes: any[] = []
let mockEdges: any[] = []
let mockOnNodesChange: any
let mockOnEdgesChange: any

const mockUseNodesState = vi.fn(() => {
  const setNodes = vi.fn((newNodes) => {
    mockNodes = typeof newNodes === 'function' ? newNodes(mockNodes) : newNodes
    if (mockOnNodesChange) mockOnNodesChange(mockNodes)
  })
  return [mockNodes, setNodes, vi.fn()]
})

const mockUseEdgesState = vi.fn(() => {
  const setEdges = vi.fn((newEdges) => {
    mockEdges = typeof newEdges === 'function' ? newEdges(mockEdges) : newEdges
    if (mockOnEdgesChange) mockOnEdgesChange(mockEdges)
  })
  return [mockEdges, setEdges, vi.fn()]
})

const mockReactFlow = vi.fn(({ nodes, edges, onNodesChange, onEdgesChange, ...props }) => {
  mockNodes = nodes || []
  mockEdges = edges || []
  mockOnNodesChange = onNodesChange
  mockOnEdgesChange = onEdgesChange

  return (
    <div data-testid="react-flow-integration" {...props}>
      <div data-testid="nodes-count">{mockNodes.length}</div>
      <div data-testid="edges-count">{mockEdges.length}</div>
      {props.onNodeClick && <button onClick={() => props.onNodeClick({}, mockNodes[0])}>Click Node</button>}
      {props.onEdgeClick && <button onClick={() => props.onEdgeClick({}, mockEdges[0])}>Click Edge</button>}
    </div>
  )
})

vi.mock('@xyflow/react', () => ({
  ReactFlow: mockReactFlow,
  MiniMap: vi.fn(() => <div data-testid="minimap">MiniMap</div>),
  Controls: vi.fn(() => <div data-testid="controls">Controls</div>),
  Background: vi.fn(() => <div data-testid="background">Background</div>),
  useNodesState: mockUseNodesState,
  useEdgesState: mockUseEdgesState,
  BackgroundVariant: {
    Dots: 'dots',
    Lines: 'lines',
    Cross: 'cross',
  },
}))

vi.mock('@xyflow/react/dist/style.css', () => ({}))

vi.mock('@/lib/utils', () => ({
  cn: vi.fn((...classes) => classes.filter(Boolean).join(' ')),
}))

import { DependencyGraph } from '../DependencyGraph'
import type { DependencyNode, DependencyEdge } from '@/types/dependency-graph'

describe('DependencyGraph Integration Tests', () => {
  const sampleNodes: DependencyNode[] = [
    {
      id: 'core',
      type: 'default',
      position: { x: 100, y: 100 },
      data: {
        label: '@apexcli/core',
        type: 'dependency',
        status: 'completed',
        packageName: '@apexcli/core',
        packageVersion: '0.6.0',
      },
    },
    {
      id: 'web-ui',
      type: 'default',
      position: { x: 300, y: 100 },
      data: {
        label: '@apexcli/web-ui',
        type: 'dependency',
        status: 'active',
        packageName: '@apexcli/web-ui',
        packageVersion: '0.6.0',
      },
    },
    {
      id: 'react',
      type: 'default',
      position: { x: 500, y: 200 },
      data: {
        label: 'React',
        type: 'peerDependency',
        status: 'completed',
        packageName: 'react',
        packageVersion: '^18.3.0',
      },
    },
  ]

  const sampleEdges: DependencyEdge[] = [
    {
      id: 'core-web-ui',
      source: 'core',
      target: 'web-ui',
      data: {
        type: 'dependency',
        label: 'used by',
        weight: 1,
      },
    },
    {
      id: 'web-ui-react',
      source: 'web-ui',
      target: 'react',
      data: {
        type: 'peerDependency',
        label: 'peer',
        weight: 0.8,
      },
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    mockNodes = []
    mockEdges = []
    mockOnNodesChange = null
    mockOnEdgesChange = null
  })

  describe('Real-world Package Dependency Scenarios', () => {
    it('should render APEX package dependencies correctly', () => {
      render(<DependencyGraph nodes={sampleNodes} edges={sampleEdges} />)

      expect(screen.getByTestId('react-flow-integration')).toBeInTheDocument()
      expect(screen.getByTestId('nodes-count')).toHaveTextContent('3')
      expect(screen.getByTestId('edges-count')).toHaveTextContent('2')
    })

    it('should handle package dependency graph with circular dependencies', () => {
      const circularNodes: DependencyNode[] = [
        {
          id: 'pkg-a',
          type: 'default',
          position: { x: 0, y: 0 },
          data: { label: 'Package A', type: 'dependency', status: 'warning' },
        },
        {
          id: 'pkg-b',
          type: 'default',
          position: { x: 200, y: 0 },
          data: { label: 'Package B', type: 'dependency', status: 'warning' },
        },
        {
          id: 'pkg-c',
          type: 'default',
          position: { x: 100, y: 200 },
          data: { label: 'Package C', type: 'dependency', status: 'warning' },
        },
      ]

      const circularEdges: DependencyEdge[] = [
        {
          id: 'a-b',
          source: 'pkg-a',
          target: 'pkg-b',
          data: { type: 'dependency', isCircular: false },
        },
        {
          id: 'b-c',
          source: 'pkg-b',
          target: 'pkg-c',
          data: { type: 'dependency', isCircular: false },
        },
        {
          id: 'c-a',
          source: 'pkg-c',
          target: 'pkg-a',
          data: { type: 'dependency', isCircular: true },
        },
      ]

      render(<DependencyGraph nodes={circularNodes} edges={circularEdges} />)

      expect(screen.getByTestId('nodes-count')).toHaveTextContent('3')
      expect(screen.getByTestId('edges-count')).toHaveTextContent('3')
    })

    it('should handle monorepo package structure', () => {
      const monorepoNodes: DependencyNode[] = [
        {
          id: 'workspace-root',
          type: 'default',
          position: { x: 300, y: 50 },
          data: { label: 'Workspace Root', type: 'file', status: 'default' },
        },
        {
          id: 'packages-core',
          type: 'default',
          position: { x: 100, y: 150 },
          data: { label: 'packages/core', type: 'dependency', status: 'completed' },
        },
        {
          id: 'packages-cli',
          type: 'default',
          position: { x: 300, y: 150 },
          data: { label: 'packages/cli', type: 'dependency', status: 'completed' },
        },
        {
          id: 'packages-web-ui',
          type: 'default',
          position: { x: 500, y: 150 },
          data: { label: 'packages/web-ui', type: 'dependency', status: 'active' },
        },
      ]

      const monorepoEdges: DependencyEdge[] = [
        {
          id: 'root-core',
          source: 'workspace-root',
          target: 'packages-core',
          data: { type: 'file', label: 'contains' },
        },
        {
          id: 'root-cli',
          source: 'workspace-root',
          target: 'packages-cli',
          data: { type: 'file', label: 'contains' },
        },
        {
          id: 'root-web-ui',
          source: 'workspace-root',
          target: 'packages-web-ui',
          data: { type: 'file', label: 'contains' },
        },
        {
          id: 'cli-core',
          source: 'packages-cli',
          target: 'packages-core',
          data: { type: 'dependency', label: 'depends on' },
        },
        {
          id: 'web-ui-core',
          source: 'packages-web-ui',
          target: 'packages-core',
          data: { type: 'dependency', label: 'depends on' },
        },
      ]

      render(<DependencyGraph nodes={monorepoNodes} edges={monorepoEdges} />)

      expect(screen.getByTestId('nodes-count')).toHaveTextContent('4')
      expect(screen.getByTestId('edges-count')).toHaveTextContent('5')
    })
  })

  describe('Task Workflow Scenarios', () => {
    it('should render task dependency pipeline', () => {
      const taskNodes: DependencyNode[] = [
        {
          id: 'install',
          type: 'default',
          position: { x: 0, y: 0 },
          data: { label: 'Install Dependencies', type: 'task', status: 'completed' },
        },
        {
          id: 'lint',
          type: 'default',
          position: { x: 200, y: 0 },
          data: { label: 'Lint Code', type: 'task', status: 'completed' },
        },
        {
          id: 'test',
          type: 'default',
          position: { x: 400, y: 0 },
          data: { label: 'Run Tests', type: 'task', status: 'active' },
        },
        {
          id: 'build',
          type: 'default',
          position: { x: 600, y: 0 },
          data: { label: 'Build Project', type: 'task', status: 'pending' },
        },
        {
          id: 'deploy',
          type: 'default',
          position: { x: 800, y: 0 },
          data: { label: 'Deploy', type: 'task', status: 'pending' },
        },
      ]

      const taskEdges: DependencyEdge[] = [
        {
          id: 'install-lint',
          source: 'install',
          target: 'lint',
          data: { type: 'task', label: 'blocks' },
        },
        {
          id: 'lint-test',
          source: 'lint',
          target: 'test',
          data: { type: 'task', label: 'blocks' },
        },
        {
          id: 'test-build',
          source: 'test',
          target: 'build',
          data: { type: 'task', label: 'blocks' },
        },
        {
          id: 'build-deploy',
          source: 'build',
          target: 'deploy',
          data: { type: 'task', label: 'blocks' },
        },
      ]

      render(<DependencyGraph nodes={taskNodes} edges={taskEdges} />)

      expect(screen.getByTestId('nodes-count')).toHaveTextContent('5')
      expect(screen.getByTestId('edges-count')).toHaveTextContent('4')
    })

    it('should handle parallel task execution', () => {
      const parallelTaskNodes: DependencyNode[] = [
        {
          id: 'setup',
          type: 'default',
          position: { x: 200, y: 0 },
          data: { label: 'Setup', type: 'task', status: 'completed' },
        },
        {
          id: 'lint',
          type: 'default',
          position: { x: 100, y: 100 },
          data: { label: 'Lint', type: 'task', status: 'active' },
        },
        {
          id: 'test',
          type: 'default',
          position: { x: 300, y: 100 },
          data: { label: 'Test', type: 'task', status: 'active' },
        },
        {
          id: 'typecheck',
          type: 'default',
          position: { x: 200, y: 100 },
          data: { label: 'Typecheck', type: 'task', status: 'active' },
        },
        {
          id: 'build',
          type: 'default',
          position: { x: 200, y: 200 },
          data: { label: 'Build', type: 'task', status: 'pending' },
        },
      ]

      const parallelTaskEdges: DependencyEdge[] = [
        { id: 'setup-lint', source: 'setup', target: 'lint', data: { type: 'task' } },
        { id: 'setup-test', source: 'setup', target: 'test', data: { type: 'task' } },
        { id: 'setup-typecheck', source: 'setup', target: 'typecheck', data: { type: 'task' } },
        { id: 'lint-build', source: 'lint', target: 'build', data: { type: 'task' } },
        { id: 'test-build', source: 'test', target: 'build', data: { type: 'task' } },
        { id: 'typecheck-build', source: 'typecheck', target: 'build', data: { type: 'task' } },
      ]

      render(<DependencyGraph nodes={parallelTaskNodes} edges={parallelTaskEdges} />)

      expect(screen.getByTestId('nodes-count')).toHaveTextContent('5')
      expect(screen.getByTestId('edges-count')).toHaveTextContent('6')
    })
  })

  describe('Interactive Features', () => {
    it('should handle node click interactions', async () => {
      const onNodeClick = vi.fn()

      render(
        <DependencyGraph
          nodes={sampleNodes}
          edges={sampleEdges}
          onNodeClick={onNodeClick}
        />
      )

      const nodeClickButton = screen.getByText('Click Node')
      fireEvent.click(nodeClickButton)

      await waitFor(() => {
        expect(onNodeClick).toHaveBeenCalledWith({}, sampleNodes[0])
      })
    })

    it('should handle edge click interactions', async () => {
      const onEdgeClick = vi.fn()

      render(
        <DependencyGraph
          nodes={sampleNodes}
          edges={sampleEdges}
          onEdgeClick={onEdgeClick}
        />
      )

      const edgeClickButton = screen.getByText('Click Edge')
      fireEvent.click(edgeClickButton)

      await waitFor(() => {
        expect(onEdgeClick).toHaveBeenCalledWith({}, sampleEdges[0])
      })
    })

    it('should render with all React Flow controls', () => {
      render(<DependencyGraph nodes={sampleNodes} edges={sampleEdges} />)

      expect(screen.getByTestId('controls')).toBeInTheDocument()
      expect(screen.getByTestId('minimap')).toBeInTheDocument()
      expect(screen.getByTestId('background')).toBeInTheDocument()
    })
  })

  describe('Configuration and Customization', () => {
    it('should apply custom zoom limits', () => {
      render(
        <DependencyGraph
          nodes={sampleNodes}
          edges={sampleEdges}
          minZoom={0.2}
          maxZoom={4}
        />
      )

      expect(mockReactFlow).toHaveBeenCalledWith(
        expect.objectContaining({
          minZoom: 0.2,
          maxZoom: 4,
        }),
        expect.any(Object)
      )
    })

    it('should apply custom styling', () => {
      const { container } = render(
        <DependencyGraph
          nodes={sampleNodes}
          edges={sampleEdges}
          className="custom-graph-style"
        />
      )

      const graphContainer = container.firstChild
      expect(graphContainer).toHaveClass('custom-graph-style')
    })

    it('should disable interactivity when requested', () => {
      render(
        <DependencyGraph
          nodes={sampleNodes}
          edges={sampleEdges}
          interactive={false}
        />
      )

      expect(mockReactFlow).toHaveBeenCalledWith(
        expect.objectContaining({
          nodesDraggable: false,
          elementsSelectable: false,
          panOnDrag: false,
          zoomOnScroll: false,
        }),
        expect.any(Object)
      )
    })
  })

  describe('Performance and Scale', () => {
    it('should handle medium-sized graphs efficiently', () => {
      const mediumNodes = Array.from({ length: 50 }, (_, i) => ({
        id: `node-${i}`,
        type: 'default' as const,
        position: { x: (i % 10) * 100, y: Math.floor(i / 10) * 100 },
        data: {
          label: `Node ${i}`,
          type: 'dependency' as const,
          status: 'default' as const,
        },
      }))

      const mediumEdges = Array.from({ length: 49 }, (_, i) => ({
        id: `edge-${i}`,
        source: `node-${i}`,
        target: `node-${i + 1}`,
        data: { type: 'dependency' as const },
      }))

      const startTime = performance.now()
      render(<DependencyGraph nodes={mediumNodes} edges={mediumEdges} />)
      const endTime = performance.now()

      expect(endTime - startTime).toBeLessThan(100) // Should render in under 100ms
      expect(screen.getByTestId('nodes-count')).toHaveTextContent('50')
      expect(screen.getByTestId('edges-count')).toHaveTextContent('49')
    })
  })
})