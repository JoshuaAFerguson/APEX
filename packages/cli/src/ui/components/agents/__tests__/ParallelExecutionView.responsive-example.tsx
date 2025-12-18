import React from 'react';
import { ParallelExecutionView, ParallelAgent } from '../ParallelExecutionView.js';

/**
 * Example demonstrating responsive maxColumns behavior
 * This shows how ParallelExecutionView adapts to different terminal widths
 */

// Example agents for testing
const exampleAgents: ParallelAgent[] = [
  {
    name: 'planner',
    status: 'parallel',
    stage: 'planning',
    progress: 75,
    startedAt: new Date('2024-01-01T10:00:00Z'),
  },
  {
    name: 'architect',
    status: 'active',
    stage: 'design',
    progress: 60,
    startedAt: new Date('2024-01-01T10:02:00Z'),
  },
  {
    name: 'developer',
    status: 'parallel',
    stage: 'implementation',
    progress: 45,
    startedAt: new Date('2024-01-01T10:05:00Z'),
  },
  {
    name: 'reviewer',
    status: 'parallel',
    stage: 'review',
    progress: 30,
    startedAt: new Date('2024-01-01T10:08:00Z'),
  },
  {
    name: 'tester',
    status: 'active',
    stage: 'testing',
    progress: 15,
    startedAt: new Date('2024-01-01T10:10:00Z'),
  },
];

/**
 * Example usage showing responsive behavior:
 *
 * Terminal Width < 60 (narrow):
 * - maxColumns = 1 (single column to prevent overflow)
 *
 * Terminal Width 60-99 (compact):
 * - maxColumns = 2 in full mode, 1 in compact mode
 *
 * Terminal Width 100-159 (normal):
 * - maxColumns calculated based on card width (~4 in full, ~6 in compact)
 *
 * Terminal Width >= 160 (wide):
 * - maxColumns calculated based on card width (more columns available)
 */

// Automatic responsive behavior (recommended)
export function ResponsiveExample() {
  return <ParallelExecutionView agents={exampleAgents} />;
}

// With explicit maxColumns override (for specific layouts)
export function ExplicitColumnsExample() {
  return <ParallelExecutionView agents={exampleAgents} maxColumns={3} />;
}

// Compact mode (smaller cards, more agents per row)
export function CompactResponsiveExample() {
  return <ParallelExecutionView agents={exampleAgents} compact={true} />;
}

/**
 * Breakpoint behaviors:
 *
 * isNarrow (< 60 columns):
 * - Always 1 column to prevent horizontal overflow
 *
 * isCompact (60-99 columns):
 * - 2 columns in full mode, 1 column in compact mode
 *
 * isNormal (100-159 columns):
 * - Calculated based on card width:
 *   - Full mode: ~28 chars per card → ~4 columns at 120 width
 *   - Compact mode: ~20 chars per card → ~6 columns at 120 width
 *
 * isWide (≥ 160 columns):
 * - Calculated based on card width (allows more columns)
 *   - Full mode: ~28 chars per card → ~7 columns at 200 width
 *   - Compact mode: ~20 chars per card → ~10 columns at 200 width
 */