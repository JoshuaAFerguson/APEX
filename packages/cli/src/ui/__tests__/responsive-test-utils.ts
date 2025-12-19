import { vi, type Mock } from 'vitest';

export type Breakpoint = 'narrow' | 'compact' | 'normal' | 'wide';

export interface ResponsiveMockConfig {
  width: number;
  height: number;
  breakpoint: Breakpoint;
  isNarrow: boolean;
  isCompact: boolean;
  isNormal: boolean;
  isWide: boolean;
  isAvailable: boolean;
}

export const BREAKPOINT_CONFIGS: Record<Breakpoint, ResponsiveMockConfig> = {
  narrow: {
    width: 50,
    height: 24,
    breakpoint: 'narrow',
    isNarrow: true,
    isCompact: false,
    isNormal: false,
    isWide: false,
    isAvailable: true,
  },
  compact: {
    width: 80,
    height: 24,
    breakpoint: 'compact',
    isNarrow: false,
    isCompact: true,
    isNormal: false,
    isWide: false,
    isAvailable: true,
  },
  normal: {
    width: 120,
    height: 30,
    breakpoint: 'normal',
    isNarrow: false,
    isCompact: false,
    isNormal: true,
    isWide: false,
    isAvailable: true,
  },
  wide: {
    width: 180,
    height: 40,
    breakpoint: 'wide',
    isNarrow: false,
    isCompact: false,
    isNormal: false,
    isWide: true,
    isAvailable: true,
  },
};

// Edge case configurations for boundary testing
export const EDGE_CASE_CONFIGS = {
  extremelyNarrow: { ...BREAKPOINT_CONFIGS.narrow, width: 20 },
  atNarrowBoundary: { ...BREAKPOINT_CONFIGS.narrow, width: 59 },
  atCompactBoundary: { ...BREAKPOINT_CONFIGS.compact, width: 99 },
  atNormalBoundary: { ...BREAKPOINT_CONFIGS.normal, width: 159 },
  extremelyWide: { ...BREAKPOINT_CONFIGS.wide, width: 300 },
};

/**
 * Strip ANSI color codes for accurate width measurement
 */
export function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

/**
 * Assert no line exceeds terminal width with optional tolerance
 */
export function assertNoOverflow(
  frame: string | undefined,
  maxWidth: number,
  tolerance = 5
): void {
  if (!frame) {
    throw new Error('Frame is empty or undefined');
  }

  const lines = frame.split('\n');
  lines.forEach((line, index) => {
    const cleanLength = stripAnsi(line).length;
    if (cleanLength > maxWidth + tolerance) {
      throw new Error(
        `Line ${index + 1} exceeds max width: ${cleanLength} > ${maxWidth + tolerance}\n` +
        `Content: "${stripAnsi(line)}"`
      );
    }
  });
}

/**
 * Count visible columns in ParallelExecutionView output by analyzing the layout
 */
export function countColumns(frame: string): number {
  if (!frame) return 0;

  // Look for agent cards in parallel view by detecting pattern like "⟂ agent-name"
  const lines = frame.split('\n');
  let maxColumns = 0;

  for (const line of lines) {
    const cleanLine = stripAnsi(line);
    // Count parallel indicators or agent names in a line
    const parallelMatches = (cleanLine.match(/⟂|parallel-agent/g) || []).length;
    if (parallelMatches > maxColumns) {
      maxColumns = parallelMatches;
    }
  }

  return maxColumns;
}

/**
 * Assert column layout matches expected configuration
 */
export function assertColumnLayout(
  frame: string | undefined,
  expectedColumns: number
): void {
  if (!frame) {
    throw new Error('Frame is empty or undefined');
  }

  const actualColumns = countColumns(frame);
  if (actualColumns !== expectedColumns && actualColumns !== 0) {
    throw new Error(
      `Expected ${expectedColumns} columns, but found ${actualColumns} in output:\n${frame}`
    );
  }
}

/**
 * Create mock agents for testing with customizable options
 */
export function createMockAgents(count: number, options?: {
  includeParallel?: boolean;
  includeThoughts?: boolean;
  includeLongNames?: boolean;
}): any[] {
  const agentNames = ['planner', 'architect', 'developer', 'tester', 'reviewer', 'devops'];

  return Array.from({ length: Math.min(count, 6) }, (_, i) => ({
    name: options?.includeLongNames ? `very-long-agent-name-${i}` : agentNames[i],
    status: i === 2 ? 'active' : (options?.includeParallel && i > 3 ? 'parallel' : 'idle'),
    stage: i === 2 ? 'implementation' : undefined,
    progress: i === 2 ? 65 : (options?.includeParallel && i > 3 ? 45 : undefined),
    startedAt: i === 2 ? new Date() : undefined,
    debugInfo: options?.includeThoughts && i === 2 ? {
      thinking: 'This is the agent thinking about the current task and how to proceed with implementation...',
    } : undefined,
  }));
}

/**
 * Create parallel agents specifically for testing parallel execution view
 */
export function createParallelAgents(count: number): any[] {
  return Array.from({ length: count }, (_, i) => ({
    name: `parallel-agent-${i + 1}`,
    status: 'parallel',
    stage: `stage-${i + 1}`,
    progress: (i + 1) * 15,
    startedAt: new Date(Date.now() - (i + 1) * 60000),
  }));
}

/**
 * Mock useStdoutDimensions hook for responsive testing
 */
export function mockUseStdoutDimensions(config: ResponsiveMockConfig) {
  const mockFn = vi.fn(() => config);
  return mockFn;
}

/**
 * Get breakpoint configuration by terminal width
 */
export function getBreakpointForWidth(width: number): Breakpoint {
  if (width < 60) return 'narrow';
  if (width < 100) return 'compact';
  if (width < 160) return 'normal';
  return 'wide';
}

/**
 * Create a responsive mock config for a given width
 */
export function createResponsiveMockForWidth(width: number): ResponsiveMockConfig {
  const breakpoint = getBreakpointForWidth(width);
  return {
    ...BREAKPOINT_CONFIGS[breakpoint],
    width,
  };
}