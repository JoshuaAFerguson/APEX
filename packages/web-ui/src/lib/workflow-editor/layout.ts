/**
 * Layout calculation utilities for the Visual Workflow Editor
 *
 * Handles automatic positioning of workflow stages based on dependencies
 * using topological sorting and layered layout algorithms.
 */

import type { WorkflowStage } from '@apexcli/core'
import type { LayoutConfig, Position } from '@/types/workflow-editor'
import { DEFAULT_LAYOUT_CONFIG } from './constants'

/**
 * Calculate positions for workflow stages using topological sort
 *
 * Stages are arranged in layers based on dependencies, with independent
 * stages placed in parallel and dependent stages placed in sequence.
 *
 * @param stages - Array of workflow stages to position
 * @param config - Layout configuration options
 * @returns Map of stage names to their calculated positions
 */
export function calculateStageLayout(
  stages: WorkflowStage[],
  config: LayoutConfig = DEFAULT_LAYOUT_CONFIG
): Map<string, Position> {
  const positions = new Map<string, Position>()

  if (stages.length === 0) {
    return positions
  }

  // Handle single stage
  if (stages.length === 1) {
    const stageName = stages[0].name
    if (stageName) {
      positions.set(stageName, { x: config.startX, y: config.startY })
    }
    return positions
  }

  // Build dependency graph
  const inDegree = new Map<string, number>()
  const adjacency = new Map<string, string[]>()

  // Initialize all stages
  for (const stage of stages) {
    if (stage.name) {
      inDegree.set(stage.name, 0)
      adjacency.set(stage.name, [])
    }
  }

  // Build adjacency list and calculate in-degrees
  for (const stage of stages) {
    if (stage.dependsOn && stage.name) {
      for (const dep of stage.dependsOn) {
        // Only add dependency if both stages exist
        if (adjacency.has(dep)) {
          adjacency.get(dep)?.push(stage.name)
          inDegree.set(stage.name, (inDegree.get(stage.name) || 0) + 1)
        }
      }
    }
  }

  // Topological sort into layers
  const layers: string[][] = []
  const remaining = new Set(stages.map(s => s.name).filter((name): name is string => Boolean(name)))

  while (remaining.size > 0) {
    const layer: string[] = []

    // Find all nodes with no incoming edges
    for (const name of remaining) {
      if (inDegree.get(name) === 0) {
        layer.push(name)
      }
    }

    // If no nodes found, we have a cycle - place remaining nodes arbitrarily
    if (layer.length === 0) {
      const remaining_array = Array.from(remaining)
      layer.push(remaining_array[0])
    }

    // Remove layer nodes from graph
    for (const name of layer) {
      remaining.delete(name)
      // Reduce in-degree of dependent nodes
      for (const dependent of adjacency.get(name) || []) {
        inDegree.set(dependent, Math.max(0, (inDegree.get(dependent) || 0) - 1))
      }
    }

    layers.push(layer)
  }

  // Calculate positions based on layers
  calculateLayeredPositions(layers, config, positions)

  return positions
}

/**
 * Calculate positions for stages arranged in layers
 *
 * @param layers - Array of stage name arrays, each representing a layer
 * @param config - Layout configuration
 * @param positions - Map to populate with positions
 */
function calculateLayeredPositions(
  layers: string[][],
  config: LayoutConfig,
  positions: Map<string, Position>
): void {
  // Calculate the maximum width needed
  const maxLayerWidth = Math.max(...layers.map(layer => layer.length))
  const totalWidth = maxLayerWidth * config.nodeWidth + (maxLayerWidth - 1) * config.horizontalSpacing

  for (let layerIdx = 0; layerIdx < layers.length; layerIdx++) {
    const layer = layers[layerIdx]
    const layerWidth = layer.length * config.nodeWidth + (layer.length - 1) * config.horizontalSpacing

    // Center the layer horizontally
    const layerStartX = config.startX + (totalWidth - layerWidth) / 2

    for (let nodeIdx = 0; nodeIdx < layer.length; nodeIdx++) {
      const x = layerStartX + nodeIdx * (config.nodeWidth + config.horizontalSpacing)
      const y = config.startY + layerIdx * (config.nodeHeight + config.verticalSpacing)

      positions.set(layer[nodeIdx], { x, y })
    }
  }
}

/**
 * Calculate optimal position for a new stage being added
 *
 * Finds a good position that doesn't overlap with existing stages.
 *
 * @param existingPositions - Positions of existing stages
 * @param config - Layout configuration
 * @param preferredPosition - Preferred position (e.g., from mouse cursor)
 * @returns Calculated position for the new stage
 */
export function calculateNewStagePosition(
  existingPositions: Map<string, Position>,
  config: LayoutConfig = DEFAULT_LAYOUT_CONFIG,
  preferredPosition?: Position
): Position {
  // If no existing stages, start at the default position
  if (existingPositions.size === 0) {
    return { x: config.startX, y: config.startY }
  }

  // If a preferred position is given, try to use it
  if (preferredPosition) {
    const snapPosition = snapToGrid(preferredPosition, config)
    if (!isPositionOccupied(snapPosition, existingPositions, config)) {
      return snapPosition
    }
  }

  // Find the rightmost and bottommost positions
  let maxX = config.startX
  let maxY = config.startY

  for (const position of existingPositions.values()) {
    maxX = Math.max(maxX, position.x)
    maxY = Math.max(maxY, position.y)
  }

  // Try placing to the right of the rightmost stage
  const rightPosition = {
    x: maxX + config.nodeWidth + config.horizontalSpacing,
    y: config.startY,
  }

  if (!isPositionOccupied(rightPosition, existingPositions, config)) {
    return rightPosition
  }

  // Try placing below the existing stages
  const belowPosition = {
    x: config.startX,
    y: maxY + config.nodeHeight + config.verticalSpacing,
  }

  return belowPosition
}

/**
 * Snap a position to the layout grid
 *
 * @param position - Position to snap
 * @param config - Layout configuration
 * @returns Grid-aligned position
 */
export function snapToGrid(position: Position, config: LayoutConfig): Position {
  const gridX = config.nodeWidth + config.horizontalSpacing
  const gridY = config.nodeHeight + config.verticalSpacing

  return {
    x: Math.round((position.x - config.startX) / gridX) * gridX + config.startX,
    y: Math.round((position.y - config.startY) / gridY) * gridY + config.startY,
  }
}

/**
 * Check if a position is occupied by an existing stage
 *
 * @param position - Position to check
 * @param existingPositions - Map of existing stage positions
 * @param config - Layout configuration
 * @returns True if position is occupied
 */
function isPositionOccupied(
  position: Position,
  existingPositions: Map<string, Position>,
  config: LayoutConfig
): boolean {
  const tolerance = 10 // Allow small positioning differences

  for (const existing of existingPositions.values()) {
    const deltaX = Math.abs(existing.x - position.x)
    const deltaY = Math.abs(existing.y - position.y)

    if (deltaX < config.nodeWidth + tolerance && deltaY < config.nodeHeight + tolerance) {
      return true
    }
  }

  return false
}

/**
 * Calculate bounding box for all stage positions
 *
 * @param positions - Map of stage positions
 * @param config - Layout configuration
 * @returns Bounding box containing all stages
 */
export function calculateBoundingBox(
  positions: Map<string, Position>,
  config: LayoutConfig
): { x: number; y: number; width: number; height: number } {
  if (positions.size === 0) {
    return { x: 0, y: 0, width: 0, height: 0 }
  }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const position of positions.values()) {
    minX = Math.min(minX, position.x)
    minY = Math.min(minY, position.y)
    maxX = Math.max(maxX, position.x + config.nodeWidth)
    maxY = Math.max(maxY, position.y + config.nodeHeight)
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  }
}

/**
 * Adjust layout to fit within canvas bounds
 *
 * Scales and translates positions to fit within the given dimensions.
 *
 * @param positions - Map of current positions
 * @param canvasWidth - Target canvas width
 * @param canvasHeight - Target canvas height
 * @param padding - Padding around the edges
 * @returns New map with adjusted positions
 */
export function fitToCanvas(
  positions: Map<string, Position>,
  canvasWidth: number,
  canvasHeight: number,
  padding = 50
): Map<string, Position> {
  if (positions.size === 0) {
    return new Map()
  }

  const bbox = calculateBoundingBox(positions, DEFAULT_LAYOUT_CONFIG)
  const availableWidth = canvasWidth - 2 * padding
  const availableHeight = canvasHeight - 2 * padding

  if (bbox.width <= availableWidth && bbox.height <= availableHeight) {
    // Already fits, just center it
    const offsetX = (canvasWidth - bbox.width) / 2 - bbox.x
    const offsetY = (canvasHeight - bbox.height) / 2 - bbox.y

    const adjusted = new Map<string, Position>()
    for (const [name, pos] of positions) {
      adjusted.set(name, {
        x: pos.x + offsetX,
        y: pos.y + offsetY,
      })
    }
    return adjusted
  }

  // Need to scale down
  const scaleX = availableWidth / bbox.width
  const scaleY = availableHeight / bbox.height
  const scale = Math.min(scaleX, scaleY)

  const adjusted = new Map<string, Position>()
  for (const [name, pos] of positions) {
    adjusted.set(name, {
      x: padding + (pos.x - bbox.x) * scale,
      y: padding + (pos.y - bbox.y) * scale,
    })
  }

  return adjusted
}