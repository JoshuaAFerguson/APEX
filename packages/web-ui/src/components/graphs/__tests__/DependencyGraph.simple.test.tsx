/**
 * Simple component tests for DependencyGraph using React Testing Library
 *
 * These tests verify that the React Flow integration works properly.
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import '@testing-library/jest-dom'

// Mock React Flow with factory function
vi.mock('@xyflow/react', () => ({
  ReactFlow: vi.fn().mockImplementation(() => (
    <div data-testid="react-flow-mock">React Flow Mock</div>
  )),
  MiniMap: vi.fn().mockImplementation(() => <div data-testid="minimap-mock">MiniMap Mock</div>),
  Controls: vi.fn().mockImplementation(() => <div data-testid="controls-mock">Controls Mock</div>),
  Background: vi.fn().mockImplementation(() => <div data-testid="background-mock">Background Mock</div>),
  useNodesState: vi.fn().mockImplementation(() => [
    [],
    vi.fn(),
    vi.fn()
  ]),
  useEdgesState: vi.fn().mockImplementation(() => [
    [],
    vi.fn(),
    vi.fn()
  ]),
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

describe('DependencyGraph Simple Tests', () => {
  const sampleNodes: DependencyNode[] = [
    {
      id: 'node-1',
      type: 'default',
      position: { x: 100, y: 100 },
      data: {
        label: 'Test Node',
        type: 'dependency',
        status: 'completed',
      },
    },
  ]

  const sampleEdges: DependencyEdge[] = []

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render without crashing', () => {
    expect(() => {
      render(<DependencyGraph nodes={sampleNodes} edges={sampleEdges} />)
    }).not.toThrow()
  })

  it('should render the React Flow mock component', () => {
    render(<DependencyGraph nodes={sampleNodes} edges={sampleEdges} />)

    const reactFlowMock = screen.getByTestId('react-flow-mock')
    expect(reactFlowMock).toBeInTheDocument()
    expect(reactFlowMock).toHaveTextContent('React Flow Mock')
  })

  it('should render with empty nodes and edges', () => {
    expect(() => {
      render(<DependencyGraph nodes={[]} edges={[]} />)
    }).not.toThrow()
  })

  it('should accept className prop', () => {
    const { container } = render(
      <DependencyGraph
        nodes={sampleNodes}
        edges={sampleEdges}
        className="test-class"
      />
    )

    const wrapper = container.firstChild as HTMLElement
    expect(wrapper).toHaveClass('test-class')
  })

  it('should have default container styling', () => {
    const { container } = render(
      <DependencyGraph nodes={sampleNodes} edges={sampleEdges} />
    )

    const wrapper = container.firstChild as HTMLElement
    expect(wrapper).toHaveStyle('width: 100%')
    expect(wrapper).toHaveStyle('height: 400px')
  })
})