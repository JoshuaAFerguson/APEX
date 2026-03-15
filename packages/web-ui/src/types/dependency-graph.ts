/**
 * Type definitions for dependency graph visualization using React Flow
 *
 * This module defines the interfaces for rendering dependency graphs
 * in the APEX web dashboard.
 */

import type { Node, Edge, NodeProps, EdgeProps, Position } from '@xyflow/react'

/**
 * Types of dependencies that can be visualized
 */
export type DependencyType =
  | 'import'      // Module import relationship
  | 'export'      // Module export relationship
  | 'dependency'  // Package dependency
  | 'devDependency' // Development dependency
  | 'peerDependency' // Peer dependency
  | 'task'        // Task dependency (task A blocks task B)
  | 'file'        // File reference relationship

/**
 * Node status for visual styling
 */
export type DependencyNodeStatus =
  | 'default'
  | 'active'
  | 'completed'
  | 'error'
  | 'warning'
  | 'pending'

/**
 * Custom data structure for dependency graph nodes
 * Extends Record<string, unknown> for React Flow v12 compatibility
 */
export interface DependencyNodeData extends Record<string, unknown> {
  /** Display label for the node */
  label: string
  /** Type of the node for styling and categorization */
  type?: DependencyType
  /** Current status of the node */
  status?: DependencyNodeStatus
  /** Optional description or tooltip content */
  description?: string
  /** File path if this node represents a file */
  filePath?: string
  /** Package name if this node represents a package */
  packageName?: string
  /** Package version if applicable */
  packageVersion?: string
  /** Additional metadata for the node */
  metadata?: Record<string, unknown>
}

/**
 * Custom data structure for dependency graph edges
 * Extends Record<string, unknown> for React Flow v12 compatibility
 */
export interface DependencyEdgeData extends Record<string, unknown> {
  /** Type of relationship this edge represents */
  type?: DependencyType
  /** Optional label for the edge */
  label?: string
  /** Whether this is a circular dependency */
  isCircular?: boolean
  /** Relationship strength (for weighted graphs) */
  weight?: number
  /** Additional metadata for the edge */
  metadata?: Record<string, unknown>
}

/**
 * Typed node for dependency graphs
 */
export type DependencyNode = Node<DependencyNodeData>

/**
 * Typed edge for dependency graphs
 */
export type DependencyEdge = Edge<DependencyEdgeData>

/**
 * Props for the DependencyGraph component
 */
export interface DependencyGraphProps {
  /** Array of nodes to render */
  nodes: DependencyNode[]
  /** Array of edges connecting nodes */
  edges: DependencyEdge[]
  /** Callback when nodes change (for controlled mode) */
  onNodesChange?: (nodes: DependencyNode[]) => void
  /** Callback when edges change (for controlled mode) */
  onEdgesChange?: (edges: DependencyEdge[]) => void
  /** Callback when a node is clicked */
  onNodeClick?: (node: DependencyNode) => void
  /** Callback when an edge is clicked */
  onEdgeClick?: (edge: DependencyEdge) => void
  /** Optional CSS class for the container */
  className?: string
  /** Whether the graph is interactive (draggable/zoomable) */
  interactive?: boolean
  /** Layout direction */
  direction?: 'TB' | 'BT' | 'LR' | 'RL'
  /** Whether to fit the view to show all nodes */
  fitView?: boolean
  /** Minimum zoom level */
  minZoom?: number
  /** Maximum zoom level */
  maxZoom?: number
}

/**
 * Props for custom dependency node component
 */
export interface DependencyNodeComponentProps extends NodeProps<DependencyNode> {
  /** Custom onClick handler */
  onClick?: () => void
}

/**
 * Props for custom dependency edge component
 */
export interface DependencyEdgeComponentProps extends EdgeProps<DependencyEdge> {
  /** Custom onClick handler */
  onClick?: () => void
}

/**
 * Configuration for automatic graph layout
 */
export interface GraphLayoutConfig {
  /** Layout algorithm to use */
  algorithm: 'dagre' | 'elk' | 'force' | 'manual'
  /** Direction of the layout */
  direction: 'TB' | 'BT' | 'LR' | 'RL'
  /** Spacing between nodes */
  nodeSpacing: number
  /** Spacing between ranks/levels */
  rankSpacing: number
  /** Whether to center the graph */
  center?: boolean
}

/**
 * Default layout configuration
 */
export const DEFAULT_LAYOUT_CONFIG: GraphLayoutConfig = {
  algorithm: 'dagre',
  direction: 'TB',
  nodeSpacing: 50,
  rankSpacing: 100,
  center: true,
}

/**
 * Color scheme for different dependency types
 */
export const DEPENDENCY_COLORS: Record<DependencyType, string> = {
  import: 'var(--apex-500)',
  export: 'var(--apex-600)',
  dependency: '#10b981', // green
  devDependency: '#6366f1', // indigo
  peerDependency: '#f59e0b', // amber
  task: '#8b5cf6', // violet
  file: '#64748b', // slate
}

/**
 * Color scheme for different node statuses
 */
export const STATUS_COLORS: Record<DependencyNodeStatus, string> = {
  default: 'var(--foreground-secondary)',
  active: 'var(--apex-500)',
  completed: '#10b981', // green
  error: '#ef4444', // red
  warning: '#f59e0b', // amber
  pending: '#6366f1', // indigo
}

// Re-export commonly used types from @xyflow/react for convenience
export type { Node, Edge, NodeProps, EdgeProps, Position }
