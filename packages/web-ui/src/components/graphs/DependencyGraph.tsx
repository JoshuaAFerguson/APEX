'use client'

/**
 * DependencyGraph Component
 *
 * A React Flow-based component for visualizing dependency relationships.
 * This component provides an interactive graph visualization for displaying
 * module imports, package dependencies, task relationships, and more.
 *
 * @example
 * ```tsx
 * import { DependencyGraph } from '@/components/graphs/DependencyGraph'
 *
 * const nodes = [
 *   { id: '1', data: { label: 'Module A' }, position: { x: 0, y: 0 } },
 *   { id: '2', data: { label: 'Module B' }, position: { x: 200, y: 100 } },
 * ]
 *
 * const edges = [
 *   { id: 'e1-2', source: '1', target: '2' },
 * ]
 *
 * <DependencyGraph nodes={nodes} edges={edges} />
 * ```
 */

import { useCallback, useMemo } from 'react'
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  type Node,
  type Edge,
  type NodeMouseHandler,
  type EdgeMouseHandler,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { cn } from '@/lib/utils'
import type {
  DependencyNode,
  DependencyEdge,
  DependencyGraphProps,
  DependencyNodeStatus,
  DependencyNodeData,
} from '@/types/dependency-graph'

/**
 * Default styling for the graph container
 */
const defaultContainerStyles = {
  width: '100%',
  height: '400px',
}

/**
 * Get node style based on status
 */
function getNodeStyle(status?: DependencyNodeStatus): React.CSSProperties {
  const baseStyle: React.CSSProperties = {
    padding: '10px 15px',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    backgroundColor: 'var(--background-secondary)',
    color: 'var(--foreground)',
    fontSize: '12px',
    fontWeight: 500,
  }

  if (!status || status === 'default') {
    return baseStyle
  }

  const statusBorderColors: Record<DependencyNodeStatus, string> = {
    default: 'var(--border)',
    active: 'var(--apex-500)',
    completed: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
    pending: '#6366f1',
  }

  return {
    ...baseStyle,
    borderColor: statusBorderColors[status],
    borderWidth: '2px',
  }
}

/**
 * DependencyGraph Component
 *
 * Renders an interactive dependency graph using React Flow.
 */
export function DependencyGraph({
  nodes: initialNodes,
  edges: initialEdges,
  onNodesChange: externalOnNodesChange,
  onEdgesChange: externalOnEdgesChange,
  onNodeClick,
  onEdgeClick,
  className,
  interactive = true,
  fitView = true,
  minZoom = 0.1,
  maxZoom = 2,
}: DependencyGraphProps) {
  // Use internal state for nodes and edges with proper typing
  // Cast to Node[] for React Flow compatibility
  const [nodes, , onNodesChange] = useNodesState(initialNodes as Node[])
  const [edges, , onEdgesChange] = useEdgesState(initialEdges as Edge[])

  // Handle node click
  const handleNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      if (onNodeClick) {
        onNodeClick(node as DependencyNode)
      }
    },
    [onNodeClick]
  )

  // Handle edge click
  const handleEdgeClick: EdgeMouseHandler = useCallback(
    (_event, edge) => {
      if (onEdgeClick) {
        onEdgeClick(edge as DependencyEdge)
      }
    },
    [onEdgeClick]
  )

  // Compute styled nodes
  const styledNodes = useMemo(() => {
    return nodes.map((node) => ({
      ...node,
      style: getNodeStyle((node.data as DependencyNodeData)?.status),
    }))
  }, [nodes])

  // Compute default edge options based on direction
  const defaultEdgeOptions = useMemo(
    () => ({
      animated: false,
      style: {
        stroke: 'var(--border)',
        strokeWidth: 1.5,
      },
    }),
    []
  )

  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-background overflow-hidden',
        className
      )}
      style={defaultContainerStyles}
    >
      <ReactFlow
        nodes={styledNodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView={fitView}
        minZoom={minZoom}
        maxZoom={maxZoom}
        nodesDraggable={interactive}
        nodesConnectable={false}
        elementsSelectable={interactive}
        panOnDrag={interactive}
        zoomOnScroll={interactive}
        proOptions={{ hideAttribution: true }}
      >
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor={(node) => {
            const status = (node.data as DependencyNodeData)?.status
            if (!status || status === 'default') {
              return 'var(--background-tertiary)'
            }
            const colors: Record<DependencyNodeStatus, string> = {
              default: 'var(--background-tertiary)',
              active: '#0ea5e9',
              completed: '#10b981',
              error: '#ef4444',
              warning: '#f59e0b',
              pending: '#6366f1',
            }
            return colors[status] || 'var(--background-tertiary)'
          }}
          maskColor="rgba(0, 0, 0, 0.1)"
        />
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
      </ReactFlow>
    </div>
  )
}

/**
 * Export type for external use
 */
export type { DependencyGraphProps }
