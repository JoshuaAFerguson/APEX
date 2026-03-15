/**
 * Component rendering tests for DependencyGraph using React Testing Library
 *
 * These tests verify the React component behavior, rendering, and user interactions
 * of the DependencyGraph component.
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom'

// Mock React Flow completely for testing
const mockReactFlow = vi.fn(() => (
  <div data-testid="react-flow-mock">React Flow Mock</div>
))
const mockMiniMap = vi.fn(() => <div data-testid="minimap-mock">MiniMap Mock</div>)
const mockControls = vi.fn(() => <div data-testid="controls-mock">Controls Mock</div>)
const mockBackground = vi.fn(() => <div data-testid="background-mock">Background Mock</div>)

const mockUseNodesState = vi.fn(() => [
  [],
  vi.fn(),
  vi.fn()
])
const mockUseEdgesState = vi.fn(() => [
  [],
  vi.fn(),
  vi.fn()
])

vi.mock('@xyflow/react', () => ({
  ReactFlow: mockReactFlow,
  MiniMap: mockMiniMap,
  Controls: mockControls,
  Background: mockBackground,
  useNodesState: mockUseNodesState,
  useEdgesState: mockUseEdgesState,
  BackgroundVariant: {
    Dots: 'dots',
    Lines: 'lines',
    Cross: 'cross',
  },
}))

// Mock CSS imports
vi.mock('@xyflow/react/dist/style.css', () => ({}))

// Mock utils
vi.mock('@/lib/utils', () => ({
  cn: vi.fn((...classes) => classes.filter(Boolean).join(' ')),
}))

import { DependencyGraph } from '../DependencyGraph'
import type { DependencyNode, DependencyEdge } from '@/types/dependency-graph'

describe('DependencyGraph Component Rendering', () => {
  const basicNodes: DependencyNode[] = [
    {
      id: 'node-1',
      type: 'default',
      position: { x: 100, y: 100 },
      data: {
        label: 'Module A',
        type: 'import',
        status: 'completed',
      },
    },
    {
      id: 'node-2',
      type: 'default',
      position: { x: 200, y: 200 },
      data: {
        label: 'Module B',
        type: 'dependency',
        status: 'active',
      },
    },
  ]

  const basicEdges: DependencyEdge[] = [
    {
      id: 'edge-1-2',
      source: 'node-1',
      target: 'node-2',
      data: {
        type: 'import',
        label: 'imports',
      },
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Basic Rendering', () => {
    it('should render the component container', () => {
      render(<DependencyGraph nodes={basicNodes} edges={basicEdges} />)

      const container = screen.getByTestId('react-flow-mock')
      expect(container).toBeInTheDocument()
    })

    it('should render with custom className', () => {
      const { container } = render(
        <DependencyGraph
          nodes={basicNodes}
          edges={basicEdges}
          className="custom-test-class"
        />
      )

      const wrapper = container.firstChild as HTMLElement
      expect(wrapper).toHaveClass('custom-test-class')
    })

    it('should have default container styling', () => {
      const { container } = render(
        <DependencyGraph nodes={basicNodes} edges={basicEdges} />
      )

      const wrapper = container.firstChild as HTMLElement
      expect(wrapper).toHaveStyle({
        width: '100%',
        height: '400px'
      })
    })
  })

  describe('Props Handling', () => {
    it('should pass nodes to ReactFlow', () => {
      render(<DependencyGraph nodes={basicNodes} edges={basicEdges} />)

      expect(mockReactFlow).toHaveBeenCalled()
      const lastCall = mockReactFlow.mock.calls[mockReactFlow.mock.calls.length - 1]
      const props = lastCall[0]
      expect(props.nodes).toBeDefined()
    })

    it('should pass edges to ReactFlow', () => {
      render(<DependencyGraph nodes={basicNodes} edges={basicEdges} />)

      expect(mockReactFlow).toHaveBeenCalled()
      const lastCall = mockReactFlow.mock.calls[mockReactFlow.mock.calls.length - 1]
      const props = lastCall[0]
      expect(props.edges).toBeDefined()
    })

    it('should set interactive props correctly when interactive=true', () => {
      render(<DependencyGraph nodes={basicNodes} edges={basicEdges} interactive={true} />)

      expect(mockReactFlow).toHaveBeenCalled()
      const lastCall = mockReactFlow.mock.calls[mockReactFlow.mock.calls.length - 1]
      const props = lastCall[0]
      expect(props.nodesDraggable).toBe(true)
      expect(props.elementsSelectable).toBe(true)
      expect(props.panOnDrag).toBe(true)
      expect(props.zoomOnScroll).toBe(true)
    })

    it('should set interactive props correctly when interactive=false', () => {
      render(<DependencyGraph nodes={basicNodes} edges={basicEdges} interactive={false} />)

      expect(mockReactFlow).toHaveBeenCalled()
      const lastCall = mockReactFlow.mock.calls[mockReactFlow.mock.calls.length - 1]
      const props = lastCall[0]
      expect(props.nodesDraggable).toBe(false)
      expect(props.elementsSelectable).toBe(false)
      expect(props.panOnDrag).toBe(false)
      expect(props.zoomOnScroll).toBe(false)
    })

    it('should pass fitView prop to ReactFlow', () => {
      render(<DependencyGraph nodes={basicNodes} edges={basicEdges} fitView={true} />)

      expect(mockReactFlow).toHaveBeenCalled()
      const lastCall = mockReactFlow.mock.calls[mockReactFlow.mock.calls.length - 1]
      const props = lastCall[0]
      expect(props.fitView).toBe(true)
    })

    it('should pass zoom limits to ReactFlow', () => {
      render(<DependencyGraph nodes={basicNodes} edges={basicEdges} minZoom={0.5} maxZoom={3} />)

      expect(mockReactFlow).toHaveBeenCalled()
      const lastCall = mockReactFlow.mock.calls[mockReactFlow.mock.calls.length - 1]
      const props = lastCall[0]
      expect(props.minZoom).toBe(0.5)
      expect(props.maxZoom).toBe(3)
    })
  })

  describe('Node Styling', () => {
    it('should apply default styling to nodes without status', () => {
      const nodesWithoutStatus: DependencyNode[] = [
        {
          id: 'node-1',
          type: 'default',
          position: { x: 100, y: 100 },
          data: {
            label: 'Module A',
          },
        },
      ]

      render(<DependencyGraph nodes={nodesWithoutStatus} edges={[]} />)

      expect(mockReactFlow).toHaveBeenCalled()
      const lastCall = mockReactFlow.mock.calls[mockReactFlow.mock.calls.length - 1]
      const props = lastCall[0]
      expect(props.nodes).toHaveLength(1)
      expect(props.nodes[0].style).toBeDefined()
    })

    it('should apply status-specific styling to nodes', () => {
      const nodesWithStatus: DependencyNode[] = [
        {
          id: 'node-1',
          type: 'default',
          position: { x: 100, y: 100 },
          data: {
            label: 'Module A',
            status: 'error',
          },
        },
      ]

      render(<DependencyGraph nodes={nodesWithStatus} edges={[]} />)

      expect(mockReactFlow).toHaveBeenCalled()
      const lastCall = mockReactFlow.mock.calls[mockReactFlow.mock.calls.length - 1]
      const props = lastCall[0]
      expect(props.nodes[0].style).toBeDefined()
      expect(props.nodes[0].style.borderColor).toBe('#ef4444') // error color
      expect(props.nodes[0].style.borderWidth).toBe('2px')
    })
  })

  describe('Event Handlers', () => {
    it('should handle node click events', () => {
      const onNodeClick = vi.fn()
      render(
        <DependencyGraph
          nodes={basicNodes}
          edges={basicEdges}
          onNodeClick={onNodeClick}
        />
      )

      expect(mockReactFlow).toHaveBeenCalled()
      const lastCall = mockReactFlow.mock.calls[mockReactFlow.mock.calls.length - 1]
      const props = lastCall[0]
      expect(props.onNodeClick).toBeDefined()

      // Simulate node click
      const mockEvent = { preventDefault: vi.fn() }
      const mockNode = basicNodes[0]
      props.onNodeClick(mockEvent, mockNode)

      expect(onNodeClick).toHaveBeenCalledWith(mockNode)
    })

    it('should handle edge click events', () => {
      const onEdgeClick = vi.fn()
      render(
        <DependencyGraph
          nodes={basicNodes}
          edges={basicEdges}
          onEdgeClick={onEdgeClick}
        />
      )

      expect(mockReactFlow).toHaveBeenCalled()
      const lastCall = mockReactFlow.mock.calls[mockReactFlow.mock.calls.length - 1]
      const props = lastCall[0]
      expect(props.onEdgeClick).toBeDefined()

      // Simulate edge click
      const mockEvent = { preventDefault: vi.fn() }
      const mockEdge = basicEdges[0]
      props.onEdgeClick(mockEvent, mockEdge)

      expect(onEdgeClick).toHaveBeenCalledWith(mockEdge)
    })

    it('should not throw when click handlers are not provided', () => {
      render(<DependencyGraph nodes={basicNodes} edges={basicEdges} />)

      expect(mockReactFlow).toHaveBeenCalled()
      const lastCall = mockReactFlow.mock.calls[mockReactFlow.mock.calls.length - 1]
      const props = lastCall[0]

      // Simulate clicks without handlers
      const mockEvent = { preventDefault: vi.fn() }
      expect(() => {
        props.onNodeClick(mockEvent, basicNodes[0])
        props.onEdgeClick(mockEvent, basicEdges[0])
      }).not.toThrow()
    })
  })

  describe('Empty Data Handling', () => {
    it('should render with empty nodes array', () => {
      render(<DependencyGraph nodes={[]} edges={[]} />)

      const container = screen.getByTestId('react-flow-mock')
      expect(container).toBeInTheDocument()

      expect(mockReactFlow).toHaveBeenCalled()
      const lastCall = mockReactFlow.mock.calls[mockReactFlow.mock.calls.length - 1]
      const props = lastCall[0]
      expect(props.nodes).toEqual([])
    })

    it('should render with empty edges array', () => {
      render(<DependencyGraph nodes={basicNodes} edges={[]} />)

      expect(mockReactFlow).toHaveBeenCalled()
      const lastCall = mockReactFlow.mock.calls[mockReactFlow.mock.calls.length - 1]
      const props = lastCall[0]
      expect(props.edges).toEqual([])
    })
  })

  describe('React Flow Components', () => {
    it('should render Controls component', () => {
      render(<DependencyGraph nodes={basicNodes} edges={basicEdges} />)
      expect(mockControls).toHaveBeenCalled()
    })

    it('should render MiniMap component', () => {
      render(<DependencyGraph nodes={basicNodes} edges={basicEdges} />)
      expect(mockMiniMap).toHaveBeenCalled()
    })

    it('should render Background component', () => {
      render(<DependencyGraph nodes={basicNodes} edges={basicEdges} />)
      expect(mockBackground).toHaveBeenCalled()
    })

    it('should configure MiniMap with node color function', () => {
      render(<DependencyGraph nodes={basicNodes} edges={basicEdges} />)

      expect(mockMiniMap).toHaveBeenCalled()
      const lastCall = mockMiniMap.mock.calls[mockMiniMap.mock.calls.length - 1]
      const props = lastCall[0]

      expect(props.nodeColor).toBeInstanceOf(Function)
      expect(props.maskColor).toBe('rgba(0, 0, 0, 0.1)')
    })

    it('should configure Background with dots variant', () => {
      render(<DependencyGraph nodes={basicNodes} edges={basicEdges} />)

      expect(mockBackground).toHaveBeenCalled()
      const lastCall = mockBackground.mock.calls[mockBackground.mock.calls.length - 1]
      const props = lastCall[0]

      expect(props.variant).toBe('dots')
      expect(props.gap).toBe(16)
      expect(props.size).toBe(1)
    })
  })
})

describe('DependencyGraph Edge Cases and Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should handle nodes with complex metadata', () => {
    const complexNodes: DependencyNode[] = [
      {
        id: 'complex-node',
        type: 'default',
        position: { x: 0, y: 0 },
        data: {
          label: 'Complex Module',
          type: 'dependency',
          status: 'active',
          description: 'A module with complex metadata',
          filePath: '/src/components/complex.tsx',
          packageName: '@complex/package',
          packageVersion: '1.2.3',
          metadata: {
            nested: {
              deep: {
                value: 'test',
                array: [1, 2, 3],
              },
            },
            functions: ['fn1', 'fn2'],
            config: { enabled: true },
          },
        },
      },
    ]

    expect(() => {
      render(<DependencyGraph nodes={complexNodes} edges={[]} />)
    }).not.toThrow()

    expect(mockReactFlow).toHaveBeenCalled()
  })

  it('should handle edges with complex data', () => {
    const complexEdges: DependencyEdge[] = [
      {
        id: 'complex-edge',
        source: 'node-1',
        target: 'node-2',
        data: {
          type: 'dependency',
          label: 'complex relationship',
          isCircular: false,
          weight: 0.75,
          metadata: {
            strength: 'strong',
            confidence: 0.9,
            analysis: {
              cyclomatic: 15,
              coupling: 'loose',
            },
          },
        },
      },
    ]

    expect(() => {
      render(<DependencyGraph nodes={[]} edges={complexEdges} />)
    }).not.toThrow()

    expect(mockReactFlow).toHaveBeenCalled()
  })

  it('should handle invalid node data gracefully', () => {
    const invalidNodes = [
      {
        id: 'invalid-node',
        type: 'default',
        position: { x: 0, y: 0 },
        data: {
          label: 'Invalid Node',
          // Missing required fields, invalid types
          status: 'invalid-status' as any,
          type: 'invalid-type' as any,
        },
      },
    ] as DependencyNode[]

    expect(() => {
      render(<DependencyGraph nodes={invalidNodes} edges={[]} />)
    }).not.toThrow()
  })

  it('should handle very large datasets', () => {
    // Generate 100 nodes and edges to test performance
    const largeNodes: DependencyNode[] = Array.from({ length: 100 }, (_, i) => ({
      id: `node-${i}`,
      type: 'default',
      position: { x: Math.random() * 1000, y: Math.random() * 1000 },
      data: {
        label: `Node ${i}`,
        type: 'dependency',
        status: 'default',
      },
    }))

    const largeEdges: DependencyEdge[] = Array.from({ length: 99 }, (_, i) => ({
      id: `edge-${i}`,
      source: `node-${i}`,
      target: `node-${i + 1}`,
      data: {
        type: 'dependency',
      },
    }))

    expect(() => {
      render(<DependencyGraph nodes={largeNodes} edges={largeEdges} />)
    }).not.toThrow()

    expect(mockReactFlow).toHaveBeenCalled()
    const lastCall = mockReactFlow.mock.calls[mockReactFlow.mock.calls.length - 1]
    const props = lastCall[0]
    expect(props.nodes).toHaveLength(100)
    expect(props.edges).toHaveLength(99)
  })
})