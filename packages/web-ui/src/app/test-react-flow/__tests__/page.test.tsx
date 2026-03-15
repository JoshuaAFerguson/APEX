/**
 * Tests for the React Flow test page
 *
 * These tests verify that the test page renders correctly and demonstrates
 * the React Flow integration working properly.
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import '@testing-library/jest-dom'

// Mock the DependencyGraph component
const mockDependencyGraph = vi.fn(({ nodes, edges, ...props }) => (
  <div
    data-testid="dependency-graph-test-page"
    data-nodes-count={nodes?.length || 0}
    data-edges-count={edges?.length || 0}
    {...props}
  >
    Mocked DependencyGraph Component
  </div>
))

vi.mock('@/components/graphs', () => ({
  DependencyGraph: mockDependencyGraph,
}))

import TestReactFlowPage from '../page'

describe('TestReactFlowPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Page Structure', () => {
    it('should render the page title', () => {
      render(<TestReactFlowPage />)

      const title = screen.getByRole('heading', { level: 1 })
      expect(title).toHaveTextContent('React Flow Test Page')
    })

    it('should render the page description', () => {
      render(<TestReactFlowPage />)

      const description = screen.getByText(/This page tests the React Flow installation/i)
      expect(description).toBeInTheDocument()
    })

    it('should render the section heading', () => {
      render(<TestReactFlowPage />)

      const sectionHeading = screen.getByRole('heading', { level: 2, name: /Basic Dependency Graph/i })
      expect(sectionHeading).toBeInTheDocument()
    })

    it('should render the test results section', () => {
      render(<TestReactFlowPage />)

      const testResultsHeading = screen.getByRole('heading', { level: 2, name: /Test Results/i })
      expect(testResultsHeading).toBeInTheDocument()
    })
  })

  describe('DependencyGraph Integration', () => {
    it('should render the DependencyGraph component', () => {
      render(<TestReactFlowPage />)

      const graphComponent = screen.getByTestId('dependency-graph-test-page')
      expect(graphComponent).toBeInTheDocument()
    })

    it('should pass the correct number of nodes to DependencyGraph', () => {
      render(<TestReactFlowPage />)

      const graphComponent = screen.getByTestId('dependency-graph-test-page')
      expect(graphComponent).toHaveAttribute('data-nodes-count', '3')
    })

    it('should pass the correct number of edges to DependencyGraph', () => {
      render(<TestReactFlowPage />)

      const graphComponent = screen.getByTestId('dependency-graph-test-page')
      expect(graphComponent).toHaveAttribute('data-edges-count', '2')
    })

    it('should pass interactive=true to DependencyGraph', () => {
      render(<TestReactFlowPage />)

      expect(mockDependencyGraph).toHaveBeenCalledWith(
        expect.objectContaining({
          interactive: true,
        }),
        expect.any(Object)
      )
    })

    it('should pass fitView=true to DependencyGraph', () => {
      render(<TestReactFlowPage />)

      expect(mockDependencyGraph).toHaveBeenCalledWith(
        expect.objectContaining({
          fitView: true,
        }),
        expect.any(Object)
      )
    })

    it('should pass custom className to DependencyGraph', () => {
      render(<TestReactFlowPage />)

      expect(mockDependencyGraph).toHaveBeenCalledWith(
        expect.objectContaining({
          className: 'h-96',
        }),
        expect.any(Object)
      )
    })
  })

  describe('Test Data Validation', () => {
    it('should create valid test nodes', () => {
      render(<TestReactFlowPage />)

      expect(mockDependencyGraph).toHaveBeenCalledWith(
        expect.objectContaining({
          nodes: expect.arrayContaining([
            expect.objectContaining({
              id: 'node-1',
              data: expect.objectContaining({
                label: '@xyflow/react',
                type: 'dependency',
                status: 'completed',
                packageName: '@xyflow/react',
                packageVersion: '^12.0.0',
              }),
            }),
            expect.objectContaining({
              id: 'node-2',
              data: expect.objectContaining({
                label: 'DependencyGraph',
                type: 'import',
                status: 'active',
                filePath: '/src/components/graphs/DependencyGraph.tsx',
              }),
            }),
            expect.objectContaining({
              id: 'node-3',
              data: expect.objectContaining({
                label: 'Web UI App',
                type: 'file',
                status: 'pending',
                filePath: '/src/app/page.tsx',
              }),
            }),
          ]),
        }),
        expect.any(Object)
      )
    })

    it('should create valid test edges', () => {
      render(<TestReactFlowPage />)

      expect(mockDependencyGraph).toHaveBeenCalledWith(
        expect.objectContaining({
          edges: expect.arrayContaining([
            expect.objectContaining({
              id: 'edge-1-2',
              source: 'node-1',
              target: 'node-2',
              data: expect.objectContaining({
                type: 'dependency',
                label: 'uses',
                weight: 1,
              }),
            }),
            expect.objectContaining({
              id: 'edge-2-3',
              source: 'node-2',
              target: 'node-3',
              data: expect.objectContaining({
                type: 'import',
                label: 'imported by',
                weight: 1,
              }),
            }),
          ]),
        }),
        expect.any(Object)
      )
    })
  })

  describe('Test Results Indicators', () => {
    it('should display package installation status', () => {
      render(<TestReactFlowPage />)

      const packageStatus = screen.getByText(/React Flow.*package installed/i)
      expect(packageStatus).toBeInTheDocument()

      const greenIndicator = packageStatus.previousElementSibling
      expect(greenIndicator).toHaveClass('bg-green-500')
    })

    it('should display component import status', () => {
      render(<TestReactFlowPage />)

      const importStatus = screen.getByText(/DependencyGraph component imports successfully/i)
      expect(importStatus).toBeInTheDocument()

      const greenIndicator = importStatus.previousElementSibling
      expect(greenIndicator).toHaveClass('bg-green-500')
    })

    it('should display rendering status', () => {
      render(<TestReactFlowPage />)

      const renderingStatus = screen.getByText(/Basic graph rendering works without errors/i)
      expect(renderingStatus).toBeInTheDocument()

      const greenIndicator = renderingStatus.previousElementSibling
      expect(greenIndicator).toHaveClass('bg-green-500')
    })

    it('should display interactive features status', () => {
      render(<TestReactFlowPage />)

      const interactiveStatus = screen.getByText(/Interactive features: drag, zoom, pan/i)
      expect(interactiveStatus).toBeInTheDocument()

      const blueIndicator = interactiveStatus.previousElementSibling
      expect(blueIndicator).toHaveClass('bg-blue-500')
    })

    it('should display controls and minimap status', () => {
      render(<TestReactFlowPage />)

      const controlsStatus = screen.getByText(/Controls and MiniMap visible/i)
      expect(controlsStatus).toBeInTheDocument()

      const blueIndicator = controlsStatus.previousElementSibling
      expect(blueIndicator).toHaveClass('bg-blue-500')
    })
  })

  describe('Layout and Styling', () => {
    it('should have proper container structure', () => {
      const { container } = render(<TestReactFlowPage />)

      const mainContainer = container.firstChild
      expect(mainContainer).toHaveClass('container', 'mx-auto', 'p-6', 'space-y-6')
    })

    it('should style the graph container properly', () => {
      render(<TestReactFlowPage />)

      const graphContainer = screen.getByTestId('dependency-graph-test-page').parentElement
      expect(graphContainer).toHaveClass('border', 'rounded-lg', 'p-4', 'bg-card')
    })

    it('should render with proper semantic structure', () => {
      render(<TestReactFlowPage />)

      // Check for proper heading hierarchy
      const h1 = screen.getByRole('heading', { level: 1 })
      const h2Elements = screen.getAllByRole('heading', { level: 2 })

      expect(h1).toBeInTheDocument()
      expect(h2Elements).toHaveLength(2)
    })
  })

  describe('Node and Edge Data Structure', () => {
    it('should have nodes with proper position data', () => {
      render(<TestReactFlowPage />)

      expect(mockDependencyGraph).toHaveBeenCalledWith(
        expect.objectContaining({
          nodes: expect.arrayContaining([
            expect.objectContaining({
              position: { x: 100, y: 100 },
            }),
            expect.objectContaining({
              position: { x: 300, y: 100 },
            }),
            expect.objectContaining({
              position: { x: 500, y: 100 },
            }),
          ]),
        }),
        expect.any(Object)
      )
    })

    it('should have edges with proper source and target', () => {
      render(<TestReactFlowPage />)

      expect(mockDependencyGraph).toHaveBeenCalledWith(
        expect.objectContaining({
          edges: expect.arrayContaining([
            expect.objectContaining({
              source: 'node-1',
              target: 'node-2',
            }),
            expect.objectContaining({
              source: 'node-2',
              target: 'node-3',
            }),
          ]),
        }),
        expect.any(Object)
      )
    })

    it('should demonstrate different node types', () => {
      render(<TestReactFlowPage />)

      expect(mockDependencyGraph).toHaveBeenCalledWith(
        expect.objectContaining({
          nodes: expect.arrayContaining([
            expect.objectContaining({
              data: expect.objectContaining({ type: 'dependency' }),
            }),
            expect.objectContaining({
              data: expect.objectContaining({ type: 'import' }),
            }),
            expect.objectContaining({
              data: expect.objectContaining({ type: 'file' }),
            }),
          ]),
        }),
        expect.any(Object)
      )
    })

    it('should demonstrate different node statuses', () => {
      render(<TestReactFlowPage />)

      expect(mockDependencyGraph).toHaveBeenCalledWith(
        expect.objectContaining({
          nodes: expect.arrayContaining([
            expect.objectContaining({
              data: expect.objectContaining({ status: 'completed' }),
            }),
            expect.objectContaining({
              data: expect.objectContaining({ status: 'active' }),
            }),
            expect.objectContaining({
              data: expect.objectContaining({ status: 'pending' }),
            }),
          ]),
        }),
        expect.any(Object)
      )
    })

    it('should demonstrate different edge types', () => {
      render(<TestReactFlowPage />)

      expect(mockDependencyGraph).toHaveBeenCalledWith(
        expect.objectContaining({
          edges: expect.arrayContaining([
            expect.objectContaining({
              data: expect.objectContaining({ type: 'dependency' }),
            }),
            expect.objectContaining({
              data: expect.objectContaining({ type: 'import' }),
            }),
          ]),
        }),
        expect.any(Object)
      )
    })
  })
})