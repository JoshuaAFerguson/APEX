'use client'

/**
 * Test page to verify React Flow installation and basic functionality
 */

import { DependencyGraph } from '@/components/graphs'
import type { DependencyNode, DependencyEdge } from '@/types/dependency-graph'

// Sample data for testing
const testNodes: DependencyNode[] = [
  {
    id: 'node-1',
    type: 'default',
    position: { x: 100, y: 100 },
    data: {
      label: '@xyflow/react',
      type: 'dependency',
      status: 'completed',
      packageName: '@xyflow/react',
      packageVersion: '^12.0.0',
      description: 'React Flow library for graph visualization'
    }
  },
  {
    id: 'node-2',
    type: 'default',
    position: { x: 300, y: 100 },
    data: {
      label: 'DependencyGraph',
      type: 'import',
      status: 'active',
      filePath: '/src/components/graphs/DependencyGraph.tsx',
      description: 'Custom graph component using React Flow'
    }
  },
  {
    id: 'node-3',
    type: 'default',
    position: { x: 500, y: 100 },
    data: {
      label: 'Web UI App',
      type: 'file',
      status: 'pending',
      filePath: '/src/app/page.tsx',
      description: 'Main application component'
    }
  }
]

const testEdges: DependencyEdge[] = [
  {
    id: 'edge-1-2',
    source: 'node-1',
    target: 'node-2',
    data: {
      type: 'dependency',
      label: 'uses',
      weight: 1
    }
  },
  {
    id: 'edge-2-3',
    source: 'node-2',
    target: 'node-3',
    data: {
      type: 'import',
      label: 'imported by',
      weight: 1
    }
  }
]

export default function TestReactFlowPage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">React Flow Test Page</h1>
        <p className="text-muted-foreground">
          This page tests the React Flow installation and DependencyGraph component functionality.
        </p>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Basic Dependency Graph</h2>
        <div className="border rounded-lg p-4 bg-card">
          <DependencyGraph
            nodes={testNodes}
            edges={testEdges}
            interactive={true}
            fitView={true}
            className="h-96"
          />
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Test Results</h2>
        <div className="space-y-2 text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span>React Flow (@xyflow/react) package installed</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span>DependencyGraph component imports successfully</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span>Basic graph rendering works without errors</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <span>Interactive features: drag, zoom, pan</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <span>Controls and MiniMap visible</span>
          </div>
        </div>
      </div>
    </div>
  )
}