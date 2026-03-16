/**
 * Editor Canvas Component
 *
 * React Flow canvas wrapper for the workflow editor.
 * Handles node/edge rendering, interactions, and drag-and-drop
 * from the stage palette.
 */

'use client'

import React, { useCallback, useMemo } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  type NodeTypes,
  type EdgeTypes,
  BackgroundVariant,
} from '@xyflow/react'
import { useDroppable } from '@dnd-kit/core'
import '@xyflow/react/dist/style.css'

import { cn } from '@/lib/utils'
import { StageNode } from './StageNode'
import { DependencyEdge } from './DependencyEdge'
import { useWorkflowEditorContext } from './WorkflowEditorProvider'

interface EditorCanvasProps {
  className?: string
}

/**
 * Node types for React Flow
 */
const nodeTypes: NodeTypes = {
  stageNode: StageNode,
}

/**
 * Edge types for React Flow
 */
const edgeTypes: EdgeTypes = {
  dependencyEdge: DependencyEdge,
}

/**
 * Editor Canvas Component
 *
 * Main visual canvas for editing workflows using React Flow.
 * Supports drag-and-drop, node connections, and real-time updates.
 */
export function EditorCanvas({ className }: EditorCanvasProps) {
  const {
    state,
    addStage,
    removeDependency,
  } = useWorkflowEditorContext()

  const { nodes, edges } = state

  // Set up drop zone for palette items
  const { setNodeRef, isOver } = useDroppable({
    id: 'workflow-canvas',
  })

  // Handle edge deletion
  const onEdgeClick = useCallback((event: React.MouseEvent, edge: any) => {
    // For now, just log - would implement deletion in full version
    console.log('Edge clicked:', edge)
  }, [])

  // Handle node deletion on key press
  const onNodeDelete = useCallback((nodesToDelete: any[]) => {
    // Would implement node deletion
    console.log('Nodes to delete:', nodesToDelete)
  }, [])

  // Custom styles for the React Flow container
  const reactFlowStyle = useMemo(() => ({
    backgroundColor: isOver ? '#f0f9ff' : '#fafafa',
  }), [isOver])

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "relative h-full bg-gray-50 rounded-lg overflow-hidden",
        "transition-colors duration-200",
        isOver && "bg-blue-50 ring-2 ring-blue-300 ring-inset",
        className
      )}
    >
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onEdgeClick={onEdgeClick}
          onNodesDelete={onNodeDelete}
          style={reactFlowStyle}
          defaultViewport={{ x: 0, y: 0, zoom: 1 }}
          minZoom={0.1}
          maxZoom={2}
          snapToGrid
          snapGrid={[20, 20]}
          connectionMode={'strict' as any}
          attributionPosition="bottom-left"
        >
          {/* Background pattern */}
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            className="opacity-50"
          />

          {/* Controls for zoom/pan */}
          <Controls
            position="bottom-right"
            className="bg-white shadow-lg rounded-lg border"
            showZoom
            showFitView
            showInteractive
          />

          {/* Mini map for navigation */}
          <MiniMap
            position="top-right"
            className="bg-white shadow-lg rounded-lg border"
            nodeClassName="fill-gray-200 stroke-gray-300"
            maskColor="rgb(240, 240, 240)"
            pannable
            zoomable
          />
        </ReactFlow>
      </ReactFlowProvider>

      {/* Drop zone indicator */}
      {isOver && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-4 border-2 border-dashed border-blue-400 rounded-lg flex items-center justify-center">
            <div className="bg-blue-100 text-blue-800 px-4 py-2 rounded-lg font-medium">
              Drop here to add stage
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {nodes.length === 0 && !isOver && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-gray-500">
            <div className="text-lg font-medium mb-2">No stages yet</div>
            <div className="text-sm">
              Drag stages from the palette to get started
            </div>
          </div>
        </div>
      )}
    </div>
  )
}