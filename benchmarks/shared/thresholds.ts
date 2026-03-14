/**
 * @fileoverview Performance Benchmark Threshold Definitions
 *
 * Defines baseline performance thresholds for all benchmarked operations.
 * Values are in milliseconds unless otherwise specified.
 *
 * Threshold Guidelines:
 * - maxMean: Maximum acceptable average execution time
 * - maxP95: Maximum acceptable 95th percentile execution time
 * - maxP99: Maximum acceptable 99th percentile (optional, for critical operations)
 * - minThroughput: Minimum operations per second (optional)
 */

export interface BenchmarkThreshold {
  /** Maximum acceptable mean execution time in ms */
  maxMean: number;
  /** Maximum acceptable 95th percentile execution time in ms */
  maxP95: number;
  /** Maximum acceptable 99th percentile execution time in ms (optional) */
  maxP99?: number;
  /** Minimum operations per second (optional) */
  minThroughput?: number;
}

/**
 * Performance thresholds for @apexcli/browser package
 */
export const BROWSER_THRESHOLDS = {
  launch: {
    /** Chromium browser launch time */
    chromium: {
      maxMean: 5000,
      maxP95: 8000,
      maxP99: 10000,
    } satisfies BenchmarkThreshold,

    /** Firefox browser launch time */
    firefox: {
      maxMean: 6000,
      maxP95: 9000,
      maxP99: 12000,
    } satisfies BenchmarkThreshold,

    /** WebKit browser launch time */
    webkit: {
      maxMean: 6000,
      maxP95: 9000,
      maxP99: 12000,
    } satisfies BenchmarkThreshold,
  },

  screenshot: {
    png: {
      /** Viewport-only PNG screenshot */
      viewport: {
        maxMean: 200,
        maxP95: 500,
      } satisfies BenchmarkThreshold,

      /** Full page PNG screenshot (5000px height) */
      fullPage: {
        maxMean: 1000,
        maxP95: 2000,
      } satisfies BenchmarkThreshold,

      /** Large viewport PNG screenshot (2560x1440) */
      largeViewport: {
        maxMean: 400,
        maxP95: 800,
      } satisfies BenchmarkThreshold,
    },

    jpeg: {
      /** Viewport-only JPEG screenshot */
      viewport: {
        maxMean: 150,
        maxP95: 400,
      } satisfies BenchmarkThreshold,

      /** Full page JPEG screenshot (5000px height) */
      fullPage: {
        maxMean: 800,
        maxP95: 1500,
      } satisfies BenchmarkThreshold,

      /** Large viewport JPEG screenshot (2560x1440) */
      largeViewport: {
        maxMean: 300,
        maxP95: 600,
      } satisfies BenchmarkThreshold,
    },
  },
} as const;

/**
 * Performance thresholds for @apexcli/core package
 */
export const CORE_THRESHOLDS = {
  configParsing: {
    /** Minimal config parsing (required fields only) */
    simple: {
      maxMean: 5,
      maxP95: 10,
    } satisfies BenchmarkThreshold,

    /** Full config parsing with all optional fields */
    complex: {
      maxMean: 20,
      maxP95: 50,
    } satisfies BenchmarkThreshold,

    /** Config parsing with container validation */
    withValidation: {
      maxMean: 30,
      maxP95: 75,
    } satisfies BenchmarkThreshold,
  },

  schemaValidation: {
    /** AgentDefinition schema validation */
    agentDefinition: {
      maxMean: 1,
      maxP95: 3,
      minThroughput: 1000,
    } satisfies BenchmarkThreshold,

    /** WorkflowDefinition schema validation */
    workflowDefinition: {
      maxMean: 2,
      maxP95: 5,
      minThroughput: 500,
    } satisfies BenchmarkThreshold,

    /** Full ApexConfig schema validation */
    fullConfig: {
      maxMean: 10,
      maxP95: 25,
      minThroughput: 100,
    } satisfies BenchmarkThreshold,

    /** ToolAlias schema validation */
    toolAlias: {
      maxMean: 0.5,
      maxP95: 2,
      minThroughput: 2000,
    } satisfies BenchmarkThreshold,

    /** MCPConfig schema validation */
    mcpConfig: {
      maxMean: 2,
      maxP95: 5,
      minThroughput: 500,
    } satisfies BenchmarkThreshold,
  },
} as const;

/**
 * Performance thresholds for @apexcli/orchestrator package (TaskStore)
 */
export const ORCHESTRATOR_THRESHOLDS = {
  taskStore: {
    /** Create single task */
    create: {
      maxMean: 5,
      maxP95: 15,
      minThroughput: 200,
    } satisfies BenchmarkThreshold,

    /** Read single task by ID */
    read: {
      maxMean: 2,
      maxP95: 5,
      minThroughput: 500,
    } satisfies BenchmarkThreshold,

    /** Update task status */
    update: {
      maxMean: 3,
      maxP95: 10,
      minThroughput: 300,
    } satisfies BenchmarkThreshold,

    /** Delete single task */
    delete: {
      maxMean: 2,
      maxP95: 5,
      minThroughput: 500,
    } satisfies BenchmarkThreshold,

    /** Bulk create 100 tasks */
    bulkCreate100: {
      maxMean: 50,
      maxP95: 100,
    } satisfies BenchmarkThreshold,

    /** Query all tasks */
    queryAll: {
      maxMean: 10,
      maxP95: 25,
    } satisfies BenchmarkThreshold,

    /** Query tasks by status */
    queryByStatus: {
      maxMean: 5,
      maxP95: 15,
    } satisfies BenchmarkThreshold,
  },
} as const;

/**
 * Combined thresholds for all packages
 */
export const THRESHOLDS = {
  browser: BROWSER_THRESHOLDS,
  core: CORE_THRESHOLDS,
  orchestrator: ORCHESTRATOR_THRESHOLDS,
} as const;

export type ThresholdType = typeof THRESHOLDS;
