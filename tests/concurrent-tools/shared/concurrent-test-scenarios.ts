/**
 * Concurrent Test Scenarios
 *
 * Predefined test scenarios for concurrent tool execution event ordering tests.
 * Provides reusable scenario builders and common concurrent execution patterns.
 */

import type { SupportedTool } from '../../tool-complete-events/shared/tool-test-fixtures';
import type { MockOrchestrator } from '../../tool-complete-events/shared/orchestrator-test-harness';
import type { ToolCompleteEvent } from '../../tool-complete-events/shared/tool-event-validators';

/**
 * Scenario execution result
 */
export interface ScenarioResult {
  /** All tool complete events in order of completion */
  events: ToolCompleteEvent[];
  /** Call IDs mapped to their results */
  results: Map<string, ToolCompleteEvent>;
  /** Total execution time in ms */
  totalDuration: number;
  /** Maximum number of tools running at once */
  maxConcurrency: number;
}

/**
 * Completion order specification
 */
export type CompletionOrder =
  | 'fifo'           // First In First Out
  | 'lifo'           // Last In First Out
  | 'random'         // Random order
  | 'interleaved'    // Alternating pattern
  | number[];        // Explicit order by index

/**
 * Tool execution specification
 */
export interface ToolSpec {
  tool: SupportedTool;
  /** Delay before starting this tool (ms) */
  startDelay?: number;
  /** Duration of tool execution (ms) */
  duration?: number;
  /** Whether this tool should fail */
  shouldFail?: boolean;
  /** Error message if failing */
  errorMessage?: string;
}

/**
 * Concurrent scenario configuration
 */
export interface ConcurrentScenarioConfig {
  /** Task ID for all executions */
  taskId: string;
  /** Tools to execute */
  tools: ToolSpec[] | SupportedTool[];
  /** Order in which tools complete */
  completionOrder?: CompletionOrder;
  /** Base delay between starts (ms) */
  startStagger?: number;
  /** Base delay between completions (ms) */
  completionStagger?: number;
  /** Whether to emit progress events for supported tools */
  withProgress?: boolean;
}

/**
 * Normalize tool specs from mixed input
 */
function normalizeToolSpecs(tools: ToolSpec[] | SupportedTool[]): ToolSpec[] {
  return tools.map(tool => {
    if (typeof tool === 'string') {
      return { tool };
    }
    return tool;
  });
}

/**
 * Calculate completion order indices
 */
function calculateCompletionOrder(
  count: number,
  order: CompletionOrder
): number[] {
  const indices = Array.from({ length: count }, (_, i) => i);

  switch (order) {
    case 'fifo':
      return indices;

    case 'lifo':
      return indices.reverse();

    case 'random':
      // Fisher-Yates shuffle (deterministic for testing using index-based seed)
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(((i * 7 + 11) % (i + 1)));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }
      return indices;

    case 'interleaved':
      // Alternate between first and last
      const result: number[] = [];
      let left = 0;
      let right = indices.length - 1;
      while (left <= right) {
        if (left === right) {
          result.push(indices[left]);
        } else {
          result.push(indices[left], indices[right]);
        }
        left++;
        right--;
      }
      return result;

    default:
      // Explicit order array
      if (Array.isArray(order)) {
        return order;
      }
      return indices;
  }
}

/**
 * Execute a concurrent scenario
 */
export async function executeConcurrentScenario(
  orchestrator: MockOrchestrator,
  config: ConcurrentScenarioConfig
): Promise<ScenarioResult> {
  const {
    taskId,
    completionOrder = 'fifo',
    startStagger = 5,
    completionStagger = 10,
    withProgress = false,
  } = config;

  const toolSpecs = normalizeToolSpecs(config.tools);
  const callIds: string[] = [];
  const startTime = Date.now();

  // Start all tools with optional stagger
  for (let i = 0; i < toolSpecs.length; i++) {
    const spec = toolSpecs[i];

    if (spec.startDelay) {
      await delay(spec.startDelay);
    } else if (i > 0 && startStagger > 0) {
      await delay(startStagger);
    }

    const callId = orchestrator.startToolExecution(
      taskId,
      spec.tool,
      undefined,
      spec.duration
    );
    callIds.push(callId);
  }

  // Calculate completion order
  const orderIndices = calculateCompletionOrder(toolSpecs.length, completionOrder);

  // Complete tools in specified order
  const events: ToolCompleteEvent[] = [];
  const results = new Map<string, ToolCompleteEvent>();

  for (let i = 0; i < orderIndices.length; i++) {
    const index = orderIndices[i];
    const spec = toolSpecs[index];
    const callId = callIds[index];

    if (i > 0 && completionStagger > 0) {
      await delay(completionStagger);
    }

    let event: ToolCompleteEvent;
    if (spec.shouldFail) {
      event = orchestrator.failToolExecution(
        taskId,
        callId,
        spec.errorMessage ?? `${spec.tool} execution failed`
      );
    } else {
      event = orchestrator.completeToolExecution(taskId, callId);
    }

    events.push(event);
    results.set(callId, event);
  }

  const totalDuration = Date.now() - startTime;

  // Calculate max concurrency
  let maxConcurrency = 0;
  let currentConcurrency = 0;
  const timeline: Array<{ time: number; delta: number }> = [];

  for (let i = 0; i < callIds.length; i++) {
    timeline.push({ time: i * startStagger, delta: 1 });
  }

  for (let i = 0; i < orderIndices.length; i++) {
    const completionTime = callIds.length * startStagger + i * completionStagger;
    timeline.push({ time: completionTime, delta: -1 });
  }

  timeline.sort((a, b) => a.time - b.time);

  for (const entry of timeline) {
    currentConcurrency += entry.delta;
    maxConcurrency = Math.max(maxConcurrency, currentConcurrency);
  }

  return {
    events,
    results,
    totalDuration,
    maxConcurrency,
  };
}

/**
 * Predefined concurrent test scenarios
 */
export const ConcurrentScenarios = {
  /**
   * Two tools executing with simple interleave
   * Tool A starts, Tool B starts, Tool A completes, Tool B completes
   */
  simpleInterleave(
    orchestrator: MockOrchestrator,
    taskId: string,
    toolA: SupportedTool = 'Read',
    toolB: SupportedTool = 'Write'
  ): Promise<ScenarioResult> {
    return executeConcurrentScenario(orchestrator, {
      taskId,
      tools: [toolA, toolB],
      completionOrder: 'fifo',
      startStagger: 10,
      completionStagger: 20,
    });
  },

  /**
   * Reverse completion order - last started completes first
   */
  reverseCompletion(
    orchestrator: MockOrchestrator,
    taskId: string,
    tools: SupportedTool[] = ['Read', 'Write', 'Edit']
  ): Promise<ScenarioResult> {
    return executeConcurrentScenario(orchestrator, {
      taskId,
      tools,
      completionOrder: 'lifo',
      startStagger: 5,
      completionStagger: 15,
    });
  },

  /**
   * All tools start nearly simultaneously
   */
  burstStart(
    orchestrator: MockOrchestrator,
    taskId: string,
    tools: SupportedTool[] = ['Read', 'Write', 'Edit', 'Grep', 'Glob']
  ): Promise<ScenarioResult> {
    return executeConcurrentScenario(orchestrator, {
      taskId,
      tools,
      completionOrder: 'fifo',
      startStagger: 1, // Nearly simultaneous
      completionStagger: 20,
    });
  },

  /**
   * Maximum concurrency - all 12 tools running at once
   */
  maxConcurrency(
    orchestrator: MockOrchestrator,
    taskId: string
  ): Promise<ScenarioResult> {
    const allTools: SupportedTool[] = [
      'Read', 'Write', 'Edit', 'MultiEdit', 'NotebookEdit',
      'Bash', 'Grep', 'Glob', 'WebFetch', 'WebSearch',
      'TodoWrite', 'Browser'
    ];

    return executeConcurrentScenario(orchestrator, {
      taskId,
      tools: allTools,
      completionOrder: 'random',
      startStagger: 2,
      completionStagger: 10,
    });
  },

  /**
   * Mixed success and failure outcomes
   */
  mixedOutcomes(
    orchestrator: MockOrchestrator,
    taskId: string
  ): Promise<ScenarioResult> {
    const tools: ToolSpec[] = [
      { tool: 'Read', shouldFail: false },
      { tool: 'Write', shouldFail: true, errorMessage: 'Permission denied' },
      { tool: 'Edit', shouldFail: false },
      { tool: 'Bash', shouldFail: true, errorMessage: 'Command timeout' },
      { tool: 'Grep', shouldFail: false },
    ];

    return executeConcurrentScenario(orchestrator, {
      taskId,
      tools,
      completionOrder: 'interleaved',
      startStagger: 5,
      completionStagger: 15,
    });
  },

  /**
   * Same tool type executed multiple times concurrently
   */
  sameToolConcurrent(
    orchestrator: MockOrchestrator,
    taskId: string,
    tool: SupportedTool = 'Read',
    count: number = 5
  ): Promise<ScenarioResult> {
    const tools = Array(count).fill(tool) as SupportedTool[];

    return executeConcurrentScenario(orchestrator, {
      taskId,
      tools,
      completionOrder: 'random',
      startStagger: 3,
      completionStagger: 10,
    });
  },

  /**
   * Staggered starts with varying durations
   */
  staggeredDurations(
    orchestrator: MockOrchestrator,
    taskId: string
  ): Promise<ScenarioResult> {
    const tools: ToolSpec[] = [
      { tool: 'Read', duration: 50 },
      { tool: 'WebFetch', duration: 200 },
      { tool: 'Bash', duration: 150 },
      { tool: 'Write', duration: 30 },
      { tool: 'Grep', duration: 100 },
    ];

    return executeConcurrentScenario(orchestrator, {
      taskId,
      tools,
      completionOrder: 'fifo',
      startStagger: 10,
      completionStagger: 0, // Let durations determine order
    });
  },

  /**
   * High-frequency rapid execution
   */
  rapidFire(
    orchestrator: MockOrchestrator,
    taskId: string,
    count: number = 20
  ): Promise<ScenarioResult> {
    const tools: SupportedTool[] = [];
    const toolRotation: SupportedTool[] = ['Read', 'Write', 'Edit', 'Grep'];

    for (let i = 0; i < count; i++) {
      tools.push(toolRotation[i % toolRotation.length]);
    }

    return executeConcurrentScenario(orchestrator, {
      taskId,
      tools,
      completionOrder: 'fifo',
      startStagger: 1, // Very rapid
      completionStagger: 2,
    });
  },

  /**
   * Workflow-like sequential with some parallelism
   * Read1, Read2 (parallel) -> Edit1 -> Write1, Write2 (parallel) -> Bash
   */
  workflowPattern(
    orchestrator: MockOrchestrator,
    taskId: string
  ): Promise<ScenarioResult> {
    const tools: ToolSpec[] = [
      { tool: 'Read', startDelay: 0 },
      { tool: 'Read', startDelay: 5 },
      { tool: 'Edit', startDelay: 100 },
      { tool: 'Write', startDelay: 200 },
      { tool: 'Write', startDelay: 205 },
      { tool: 'Bash', startDelay: 350 },
    ];

    return executeConcurrentScenario(orchestrator, {
      taskId,
      tools,
      completionOrder: 'fifo',
      startStagger: 0, // Using explicit delays
      completionStagger: 20,
    });
  },
};

/**
 * Create a custom concurrent scenario builder
 */
export class ConcurrentScenarioBuilder {
  private config: ConcurrentScenarioConfig;
  private orchestrator: MockOrchestrator;

  constructor(orchestrator: MockOrchestrator, taskId: string) {
    this.orchestrator = orchestrator;
    this.config = {
      taskId,
      tools: [],
      completionOrder: 'fifo',
      startStagger: 5,
      completionStagger: 10,
    };
  }

  /**
   * Add a tool to the scenario
   */
  addTool(spec: ToolSpec | SupportedTool): this {
    const toolSpec = typeof spec === 'string' ? { tool: spec } : spec;
    (this.config.tools as ToolSpec[]).push(toolSpec);
    return this;
  }

  /**
   * Add multiple tools
   */
  addTools(specs: Array<ToolSpec | SupportedTool>): this {
    for (const spec of specs) {
      this.addTool(spec);
    }
    return this;
  }

  /**
   * Set completion order
   */
  withCompletionOrder(order: CompletionOrder): this {
    this.config.completionOrder = order;
    return this;
  }

  /**
   * Set start stagger delay
   */
  withStartStagger(ms: number): this {
    this.config.startStagger = ms;
    return this;
  }

  /**
   * Set completion stagger delay
   */
  withCompletionStagger(ms: number): this {
    this.config.completionStagger = ms;
    return this;
  }

  /**
   * Enable progress events
   */
  withProgress(): this {
    this.config.withProgress = true;
    return this;
  }

  /**
   * Execute the built scenario
   */
  execute(): Promise<ScenarioResult> {
    return executeConcurrentScenario(this.orchestrator, this.config);
  }
}

/**
 * Utility delay function
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Factory function to create a scenario builder
 */
export function createScenarioBuilder(
  orchestrator: MockOrchestrator,
  taskId: string
): ConcurrentScenarioBuilder {
  return new ConcurrentScenarioBuilder(orchestrator, taskId);
}
