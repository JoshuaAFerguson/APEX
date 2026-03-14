/**
 * Test fixtures for timing event streaming testing
 * Provides various timing scenarios to test duration tracking and real-time updates
 */

export interface TimingEventFixture {
  name: string;
  description: string;
  scenario: TimingScenario;
  expectedEvents: string[];
  expectedDurationRange: [number, number]; // [min, max] in ms
}

export interface TimingScenario {
  toolName: string;
  startDelay: number;
  duration: number;
  emitProgress: boolean;
  progressInterval: number;
  progressSteps?: number;
  simulateVariableLatency?: boolean;
  failureChance?: number; // 0-1 probability of failure
  pausePoints?: number[]; // Array of ms points where execution pauses
}

/**
 * Collection of timing event test fixtures
 */
export const timingEventFixtures = {
  /**
   * Fast tool execution (< 100ms)
   */
  fastTool: (): TimingEventFixture => ({
    name: 'Fast Tool Execution',
    description: 'Quick tool that completes in under 100ms',
    scenario: {
      toolName: 'Glob',
      startDelay: 0,
      duration: 50,
      emitProgress: false,
      progressInterval: 10,
    },
    expectedEvents: ['tool:start', 'tool:timing', 'tool:complete'],
    expectedDurationRange: [45, 60], // Allow for timing variance
  }),

  /**
   * Normal tool execution (1-10s)
   */
  normalTool: (): TimingEventFixture => ({
    name: 'Normal Tool Execution',
    description: 'Standard tool execution lasting 1-10 seconds',
    scenario: {
      toolName: 'Read',
      startDelay: 0,
      duration: 2000,
      emitProgress: true,
      progressInterval: 200,
    },
    expectedEvents: [
      'tool:start',
      'tool:timing',
      'tool:progress',
      'tool:progress',
      'tool:progress',
      'tool:complete'
    ],
    expectedDurationRange: [1900, 2100],
  }),

  /**
   * Long tool execution (> 60s)
   */
  longTool: (): TimingEventFixture => ({
    name: 'Long Tool Execution',
    description: 'Long-running tool that takes over a minute',
    scenario: {
      toolName: 'Bash',
      startDelay: 0,
      duration: 65000, // 65 seconds
      emitProgress: true,
      progressInterval: 1000, // Every second
    },
    expectedEvents: [
      'tool:start',
      'tool:timing',
      'tool:progress',
      'tool:complete'
    ],
    expectedDurationRange: [64000, 66000],
  }),

  /**
   * Multiple concurrent tools with different durations
   */
  concurrentTools: (): TimingEventFixture => ({
    name: 'Concurrent Tool Execution',
    description: 'Multiple tools running simultaneously',
    scenario: {
      toolName: 'Write',
      startDelay: 0,
      duration: 1500,
      emitProgress: true,
      progressInterval: 150,
    },
    expectedEvents: [
      'tool:start',
      'tool:timing',
      'tool:progress',
      'tool:complete'
    ],
    expectedDurationRange: [1400, 1600],
  }),

  /**
   * Tool with variable latency simulation
   */
  variableLatencyTool: (): TimingEventFixture => ({
    name: 'Variable Latency Tool',
    description: 'Tool with simulated network/disk latency variations',
    scenario: {
      toolName: 'WebFetch',
      startDelay: 100,
      duration: 3000,
      emitProgress: true,
      progressInterval: 300,
      simulateVariableLatency: true,
    },
    expectedEvents: [
      'tool:start',
      'tool:timing',
      'tool:progress',
      'tool:complete'
    ],
    expectedDurationRange: [2800, 3200], // More variance allowed
  }),

  /**
   * Tool with pause points (simulating user input or waiting)
   */
  pausingTool: (): TimingEventFixture => ({
    name: 'Pausing Tool Execution',
    description: 'Tool that pauses at specific points',
    scenario: {
      toolName: 'Bash',
      startDelay: 0,
      duration: 5000,
      emitProgress: true,
      progressInterval: 500,
      pausePoints: [1000, 3000], // Pause at 1s and 3s
    },
    expectedEvents: [
      'tool:start',
      'tool:timing',
      'tool:progress',
      'tool:pause',
      'tool:resume',
      'tool:progress',
      'tool:pause',
      'tool:resume',
      'tool:complete'
    ],
    expectedDurationRange: [4900, 5100],
  }),

  /**
   * Rapid succession of tools
   */
  rapidSuccession: (): TimingEventFixture => ({
    name: 'Rapid Tool Succession',
    description: 'Multiple tools starting in rapid succession',
    scenario: {
      toolName: 'Grep',
      startDelay: 0,
      duration: 200,
      emitProgress: false,
      progressInterval: 50,
    },
    expectedEvents: [
      'tool:start',
      'tool:timing',
      'tool:complete'
    ],
    expectedDurationRange: [180, 220],
  }),

  /**
   * Tool with high-frequency progress updates
   */
  highFrequencyProgress: (): TimingEventFixture => ({
    name: 'High Frequency Progress',
    description: 'Tool with very frequent progress updates',
    scenario: {
      toolName: 'Bash',
      startDelay: 0,
      duration: 2000,
      emitProgress: true,
      progressInterval: 50, // Every 50ms
      progressSteps: 40,
    },
    expectedEvents: [
      'tool:start',
      'tool:timing',
      'tool:progress',
      'tool:complete'
    ],
    expectedDurationRange: [1950, 2050],
  }),

  /**
   * Tool with potential failure
   */
  potentiallyFailingTool: (): TimingEventFixture => ({
    name: 'Potentially Failing Tool',
    description: 'Tool that might fail during execution',
    scenario: {
      toolName: 'WebFetch',
      startDelay: 0,
      duration: 1000,
      emitProgress: true,
      progressInterval: 200,
      failureChance: 0.3, // 30% chance of failure
    },
    expectedEvents: [
      'tool:start',
      'tool:timing',
      'tool:progress',
      // Could be 'tool:complete' or 'tool:error'
    ],
    expectedDurationRange: [950, 1050],
  }),

  /**
   * Ultra-fast tool (< 10ms)
   */
  ultraFastTool: (): TimingEventFixture => ({
    name: 'Ultra-Fast Tool',
    description: 'Extremely quick tool completion',
    scenario: {
      toolName: 'LSP',
      startDelay: 0,
      duration: 5,
      emitProgress: false,
      progressInterval: 1,
    },
    expectedEvents: ['tool:start', 'tool:timing', 'tool:complete'],
    expectedDurationRange: [3, 15], // Allow wider variance for very short durations
  }),

  /**
   * Get timing scenarios for concurrent execution testing
   */
  getConcurrentScenarios: (count: number = 5): TimingScenario[] => {
    const baseScenarios = [
      { toolName: 'Read', duration: 1000 },
      { toolName: 'Write', duration: 1500 },
      { toolName: 'Bash', duration: 2000 },
      { toolName: 'Grep', duration: 800 },
      { toolName: 'Glob', duration: 600 },
    ];

    return Array.from({ length: count }, (_, i) => {
      const base = baseScenarios[i % baseScenarios.length];
      return {
        ...base,
        startDelay: i * 100, // Stagger starts
        emitProgress: true,
        progressInterval: 200,
      };
    });
  },

  /**
   * Get stress test scenarios (many rapid tools)
   */
  getStressTestScenarios: (toolsPerSecond: number = 10, durationSeconds: number = 10): TimingScenario[] => {
    const totalTools = toolsPerSecond * durationSeconds;
    const intervalMs = 1000 / toolsPerSecond;

    return Array.from({ length: totalTools }, (_, i) => ({
      toolName: `StressTool${i % 5}`,
      startDelay: i * intervalMs,
      duration: 50 + Math.random() * 100, // 50-150ms random duration
      emitProgress: false,
      progressInterval: 10,
    }));
  },

  /**
   * Get performance benchmark scenarios
   */
  getPerformanceBenchmarkScenarios: (): TimingScenario[] => {
    return [
      // Test various duration ranges
      { toolName: 'Micro', startDelay: 0, duration: 1, emitProgress: false, progressInterval: 1 },
      { toolName: 'Fast', startDelay: 0, duration: 50, emitProgress: false, progressInterval: 10 },
      { toolName: 'Normal', startDelay: 0, duration: 1000, emitProgress: true, progressInterval: 100 },
      { toolName: 'Slow', startDelay: 0, duration: 5000, emitProgress: true, progressInterval: 500 },
      { toolName: 'VerySlow', startDelay: 0, duration: 30000, emitProgress: true, progressInterval: 1000 },
    ];
  },

  /**
   * Get all fixtures for comprehensive testing
   */
  getAllFixtures: (): TimingEventFixture[] => {
    return [
      timingEventFixtures.fastTool(),
      timingEventFixtures.normalTool(),
      timingEventFixtures.longTool(),
      timingEventFixtures.concurrentTools(),
      timingEventFixtures.variableLatencyTool(),
      timingEventFixtures.pausingTool(),
      timingEventFixtures.rapidSuccession(),
      timingEventFixtures.highFrequencyProgress(),
      timingEventFixtures.potentiallyFailingTool(),
      timingEventFixtures.ultraFastTool(),
    ];
  },

  /**
   * Get boundary test fixtures (edge cases)
   */
  getBoundaryFixtures: (): TimingEventFixture[] => {
    return [
      timingEventFixtures.ultraFastTool(),
      timingEventFixtures.fastTool(),
      // Test duration boundaries
      {
        name: 'Zero Duration',
        description: 'Tool that completes instantly',
        scenario: {
          toolName: 'Instant',
          startDelay: 0,
          duration: 0,
          emitProgress: false,
          progressInterval: 1,
        },
        expectedEvents: ['tool:start', 'tool:complete'],
        expectedDurationRange: [0, 5],
      },
      {
        name: 'One Second Boundary',
        description: 'Tool that takes exactly 1 second',
        scenario: {
          toolName: 'OneSec',
          startDelay: 0,
          duration: 1000,
          emitProgress: true,
          progressInterval: 250,
        },
        expectedEvents: ['tool:start', 'tool:timing', 'tool:progress', 'tool:complete'],
        expectedDurationRange: [950, 1050],
      },
      {
        name: 'One Minute Boundary',
        description: 'Tool that takes exactly 1 minute',
        scenario: {
          toolName: 'OneMin',
          startDelay: 0,
          duration: 60000,
          emitProgress: true,
          progressInterval: 5000,
        },
        expectedEvents: ['tool:start', 'tool:timing', 'tool:progress', 'tool:complete'],
        expectedDurationRange: [59000, 61000],
      },
    ];
  },
};

/**
 * Helper function to format duration for display
 */
export function formatDurationForTest(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  } else {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }
}

/**
 * Helper function to validate timing event sequence
 */
export function validateTimingEventSequence(events: any[]): {
  isValid: boolean;
  errors: string[];
  timing: {
    startTime?: number;
    endTime?: number;
    duration?: number;
    progressCount: number;
  };
} {
  const errors: string[] = [];
  let startTime: number | undefined;
  let endTime: number | undefined;
  let progressCount = 0;

  // Check for required start event
  const startEvent = events.find(e => e.type === 'tool:start');
  if (!startEvent) {
    errors.push('Missing tool:start event');
  } else {
    startTime = startEvent.timestamp || startEvent.data?.timing?.startTime;
  }

  // Check for completion event (either complete or error)
  const completeEvent = events.find(e => e.type === 'tool:complete' || e.type === 'tool:error');
  if (!completeEvent) {
    errors.push('Missing tool completion event (tool:complete or tool:error)');
  } else {
    endTime = completeEvent.timestamp || completeEvent.data?.timing?.endTime;
  }

  // Count progress events
  progressCount = events.filter(e => e.type === 'tool:progress').length;

  // Validate timing sequence
  if (startTime && endTime && endTime < startTime) {
    errors.push('End time is before start time');
  }

  // Check for timing events
  const timingEvents = events.filter(e => e.type === 'tool:timing');
  if (timingEvents.length === 0) {
    errors.push('No timing events found');
  }

  return {
    isValid: errors.length === 0,
    errors,
    timing: {
      startTime,
      endTime,
      duration: startTime && endTime ? endTime - startTime : undefined,
      progressCount,
    },
  };
}

/**
 * Helper function to calculate average duration from multiple runs
 */
export function calculateAverageDuration(timings: number[]): {
  average: number;
  min: number;
  max: number;
  stdDev: number;
} {
  if (timings.length === 0) {
    return { average: 0, min: 0, max: 0, stdDev: 0 };
  }

  const average = timings.reduce((sum, t) => sum + t, 0) / timings.length;
  const min = Math.min(...timings);
  const max = Math.max(...timings);

  const variance = timings.reduce((sum, t) => sum + Math.pow(t - average, 2), 0) / timings.length;
  const stdDev = Math.sqrt(variance);

  return { average, min, max, stdDev };
}

export default timingEventFixtures;