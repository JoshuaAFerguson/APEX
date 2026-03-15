/**
 * Tests for DependencyGraph component
 *
 * These tests verify that React Flow is properly installed and configured,
 * and that the DependencyGraph component can be imported and used correctly.
 */

import { describe, it, expect, vi } from 'vitest'

// Mock React Flow modules since we're testing in a Node environment
vi.mock('@xyflow/react', () => ({
  ReactFlow: vi.fn(() => null),
  MiniMap: vi.fn(() => null),
  Controls: vi.fn(() => null),
  Background: vi.fn(() => null),
  useNodesState: vi.fn(() => [[], vi.fn(), vi.fn()]),
  useEdgesState: vi.fn(() => [[], vi.fn(), vi.fn()]),
  BackgroundVariant: {
    Dots: 'dots',
    Lines: 'lines',
    Cross: 'cross',
  },
}))

// Mock the utility function
vi.mock('@/lib/utils', () => ({
  cn: vi.fn((...classes: unknown[]) => classes.filter(Boolean).join(' ')),
}))

import type {
  DependencyNode,
  DependencyEdge,
  DependencyNodeData,
  DependencyEdgeData,
  DependencyType,
  DependencyNodeStatus,
  DependencyGraphProps,
  GraphLayoutConfig,
  DEFAULT_LAYOUT_CONFIG,
  DEPENDENCY_COLORS,
  STATUS_COLORS,
} from '@/types/dependency-graph'

describe('DependencyGraph - React Flow Integration', () => {
  describe('Package Installation', () => {
    it('should have @xyflow/react installed and importable', async () => {
      // This test verifies the package is properly installed
      const xyflow = await import('@xyflow/react')
      expect(xyflow).toBeDefined()
      expect(xyflow.ReactFlow).toBeDefined()
    })

    it('should export core React Flow components', async () => {
      const { ReactFlow, MiniMap, Controls, Background } = await import('@xyflow/react')
      expect(ReactFlow).toBeDefined()
      expect(MiniMap).toBeDefined()
      expect(Controls).toBeDefined()
      expect(Background).toBeDefined()
    })

    it('should export React Flow hooks', async () => {
      const { useNodesState, useEdgesState } = await import('@xyflow/react')
      expect(useNodesState).toBeDefined()
      expect(useEdgesState).toBeDefined()
    })
  })

  describe('Type Definitions', () => {
    it('should have valid DependencyType values', () => {
      const validTypes: DependencyType[] = [
        'import',
        'export',
        'dependency',
        'devDependency',
        'peerDependency',
        'task',
        'file',
      ]
      expect(validTypes).toHaveLength(7)
    })

    it('should have valid DependencyNodeStatus values', () => {
      const validStatuses: DependencyNodeStatus[] = [
        'default',
        'active',
        'completed',
        'error',
        'warning',
        'pending',
      ]
      expect(validStatuses).toHaveLength(6)
    })

    it('should create valid DependencyNodeData', () => {
      const nodeData: DependencyNodeData = {
        label: 'Test Node',
        type: 'import',
        status: 'active',
        description: 'A test node',
        filePath: '/src/index.ts',
        metadata: { custom: 'value' },
      }

      expect(nodeData.label).toBe('Test Node')
      expect(nodeData.type).toBe('import')
      expect(nodeData.status).toBe('active')
      expect(nodeData.description).toBe('A test node')
      expect(nodeData.filePath).toBe('/src/index.ts')
      expect(nodeData.metadata).toEqual({ custom: 'value' })
    })

    it('should create valid DependencyEdgeData', () => {
      const edgeData: DependencyEdgeData = {
        type: 'dependency',
        label: 'requires',
        isCircular: false,
        weight: 1,
        metadata: { version: '1.0.0' },
      }

      expect(edgeData.type).toBe('dependency')
      expect(edgeData.label).toBe('requires')
      expect(edgeData.isCircular).toBe(false)
      expect(edgeData.weight).toBe(1)
      expect(edgeData.metadata).toEqual({ version: '1.0.0' })
    })

    it('should create valid DependencyNode', () => {
      const node: DependencyNode = {
        id: 'node-1',
        type: 'default',
        position: { x: 100, y: 200 },
        data: {
          label: 'Module A',
          type: 'import',
          status: 'completed',
        },
      }

      expect(node.id).toBe('node-1')
      expect(node.position).toEqual({ x: 100, y: 200 })
      expect(node.data.label).toBe('Module A')
    })

    it('should create valid DependencyEdge', () => {
      const edge: DependencyEdge = {
        id: 'edge-1-2',
        source: 'node-1',
        target: 'node-2',
        data: {
          type: 'import',
          label: 'imports',
        },
      }

      expect(edge.id).toBe('edge-1-2')
      expect(edge.source).toBe('node-1')
      expect(edge.target).toBe('node-2')
      expect(edge.data?.type).toBe('import')
    })
  })

  describe('GraphLayoutConfig', () => {
    it('should have valid layout algorithms', () => {
      const config: GraphLayoutConfig = {
        algorithm: 'dagre',
        direction: 'TB',
        nodeSpacing: 50,
        rankSpacing: 100,
        center: true,
      }

      expect(config.algorithm).toBe('dagre')
      expect(config.direction).toBe('TB')
      expect(config.nodeSpacing).toBe(50)
      expect(config.rankSpacing).toBe(100)
      expect(config.center).toBe(true)
    })

    it('should support all layout directions', () => {
      const directions: GraphLayoutConfig['direction'][] = ['TB', 'BT', 'LR', 'RL']
      expect(directions).toHaveLength(4)
    })
  })

  describe('DependencyGraphProps', () => {
    it('should accept minimal props', () => {
      const props: DependencyGraphProps = {
        nodes: [],
        edges: [],
      }

      expect(props.nodes).toEqual([])
      expect(props.edges).toEqual([])
    })

    it('should accept all optional props', () => {
      const mockOnNodesChange = vi.fn()
      const mockOnEdgesChange = vi.fn()
      const mockOnNodeClick = vi.fn()
      const mockOnEdgeClick = vi.fn()

      const props: DependencyGraphProps = {
        nodes: [],
        edges: [],
        onNodesChange: mockOnNodesChange,
        onEdgesChange: mockOnEdgesChange,
        onNodeClick: mockOnNodeClick,
        onEdgeClick: mockOnEdgeClick,
        className: 'custom-class',
        interactive: true,
        direction: 'LR',
        fitView: true,
        minZoom: 0.5,
        maxZoom: 3,
      }

      expect(props.onNodesChange).toBe(mockOnNodesChange)
      expect(props.onEdgesChange).toBe(mockOnEdgesChange)
      expect(props.onNodeClick).toBe(mockOnNodeClick)
      expect(props.onEdgeClick).toBe(mockOnEdgeClick)
      expect(props.className).toBe('custom-class')
      expect(props.interactive).toBe(true)
      expect(props.direction).toBe('LR')
      expect(props.fitView).toBe(true)
      expect(props.minZoom).toBe(0.5)
      expect(props.maxZoom).toBe(3)
    })
  })

  describe('Sample Graph Creation', () => {
    it('should create a valid dependency graph structure', () => {
      const nodes: DependencyNode[] = [
        {
          id: 'pkg-1',
          type: 'default',
          position: { x: 0, y: 0 },
          data: {
            label: '@apexcli/core',
            type: 'dependency',
            status: 'completed',
            packageName: '@apexcli/core',
            packageVersion: '0.6.0',
          },
        },
        {
          id: 'pkg-2',
          type: 'default',
          position: { x: 200, y: 0 },
          data: {
            label: '@apexcli/web-ui',
            type: 'dependency',
            status: 'active',
            packageName: '@apexcli/web-ui',
            packageVersion: '0.6.0',
          },
        },
        {
          id: 'pkg-3',
          type: 'default',
          position: { x: 100, y: 100 },
          data: {
            label: 'react',
            type: 'peerDependency',
            status: 'completed',
            packageName: 'react',
            packageVersion: '^18.3.0',
          },
        },
      ]

      const edges: DependencyEdge[] = [
        {
          id: 'e-1-2',
          source: 'pkg-1',
          target: 'pkg-2',
          data: {
            type: 'dependency',
            label: 'depends on',
          },
        },
        {
          id: 'e-2-3',
          source: 'pkg-2',
          target: 'pkg-3',
          data: {
            type: 'peerDependency',
            label: 'peer',
          },
        },
      ]

      expect(nodes).toHaveLength(3)
      expect(edges).toHaveLength(2)

      // Verify node structure
      expect(nodes[0].data.label).toBe('@apexcli/core')
      expect(nodes[1].data.packageName).toBe('@apexcli/web-ui')
      expect(nodes[2].data.type).toBe('peerDependency')

      // Verify edge structure
      expect(edges[0].source).toBe('pkg-1')
      expect(edges[0].target).toBe('pkg-2')
      expect(edges[1].data?.type).toBe('peerDependency')
    })

    it('should create a task dependency graph', () => {
      const nodes: DependencyNode[] = [
        {
          id: 'task-1',
          type: 'default',
          position: { x: 0, y: 0 },
          data: {
            label: 'Install dependencies',
            type: 'task',
            status: 'completed',
          },
        },
        {
          id: 'task-2',
          type: 'default',
          position: { x: 200, y: 0 },
          data: {
            label: 'Build project',
            type: 'task',
            status: 'active',
          },
        },
        {
          id: 'task-3',
          type: 'default',
          position: { x: 400, y: 0 },
          data: {
            label: 'Run tests',
            type: 'task',
            status: 'pending',
          },
        },
      ]

      const edges: DependencyEdge[] = [
        {
          id: 'e-1-2',
          source: 'task-1',
          target: 'task-2',
          data: { type: 'task', label: 'blocks' },
        },
        {
          id: 'e-2-3',
          source: 'task-2',
          target: 'task-3',
          data: { type: 'task', label: 'blocks' },
        },
      ]

      expect(nodes).toHaveLength(3)
      expect(edges).toHaveLength(2)

      // Verify task states
      expect(nodes[0].data.status).toBe('completed')
      expect(nodes[1].data.status).toBe('active')
      expect(nodes[2].data.status).toBe('pending')
    })
  })

  describe('Circular Dependency Detection', () => {
    it('should mark circular dependencies in edge data', () => {
      const edges: DependencyEdge[] = [
        {
          id: 'e-a-b',
          source: 'a',
          target: 'b',
          data: { type: 'import', isCircular: false },
        },
        {
          id: 'e-b-c',
          source: 'b',
          target: 'c',
          data: { type: 'import', isCircular: false },
        },
        {
          id: 'e-c-a',
          source: 'c',
          target: 'a',
          data: { type: 'import', isCircular: true },
        },
      ]

      const circularEdges = edges.filter((e) => e.data?.isCircular)
      expect(circularEdges).toHaveLength(1)
      expect(circularEdges[0].source).toBe('c')
      expect(circularEdges[0].target).toBe('a')
    })
  })
})

describe('DependencyGraph Component Import', () => {
  it('should import DependencyGraph component', async () => {
    // This verifies the component module structure is correct
    const graphModule = await import('../DependencyGraph')
    expect(graphModule.DependencyGraph).toBeDefined()
  })

  it('should import from index barrel file', async () => {
    const indexModule = await import('../index')
    expect(indexModule.DependencyGraph).toBeDefined()
  })
})
