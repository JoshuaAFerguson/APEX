/**
 * CodebaseMapper Service
 *
 * Orchestrates parallel analysis agents for comprehensive codebase mapping.
 * Built on the existing ProjectContextAnalyzer foundation with enhanced
 * event-driven progress tracking and parallel agent execution.
 */

import { EventEmitter } from 'eventemitter3';
import { query, type AgentDefinition as SDKAgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import type { CodebaseAnalysis, ApexConfig } from '@apexcli/core';
import { createCodebaseAnalyzer } from './codebase-analyzer/index.js';
import type {
  CodebaseAnalysisOrchestrator,
  AnalysisOptions,
  AnalysisProgress,
  AnalysisError,
} from './codebase-analyzer/types.js';

// =============================================================================
// Types and Interfaces
// =============================================================================

/**
 * Configuration for CodebaseMapper operations
 */
export interface CodebaseMapperConfig {
  /** Project path to analyze */
  projectPath: string;

  /** Maximum concurrent analysis agents */
  maxConcurrentAgents?: number;

  /** Timeout for individual agent operations (ms) */
  agentTimeout?: number;

  /** Include patterns for file discovery */
  includePatterns?: string[];

  /** Exclude patterns for file discovery */
  excludePatterns?: string[];

  /** Quick analysis mode */
  quickMode?: boolean;

  /** Verbose logging */
  verbose?: boolean;
}

/**
 * Analysis agent definition for parallel execution
 */
export interface AnalysisAgent {
  id: string;
  name: string;
  domain: string;
  description: string;
  estimatedComplexity: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime?: Date;
  endTime?: Date;
  result?: unknown;
  error?: string;
}

/**
 * Progress information with agent-specific details
 */
export interface CodebaseMapperProgress {
  /** Overall progress percentage (0-100) */
  overallProgress: number;

  /** Current phase of mapping */
  phase: 'initializing' | 'discovering' | 'analyzing' | 'aggregating' | 'complete';

  /** Active agents count */
  activeAgents: number;

  /** Completed agents count */
  completedAgents: number;

  /** Total agents count */
  totalAgents: number;

  /** Current operation description */
  currentOperation: string;

  /** Individual agent progress */
  agentProgress: Array<{
    id: string;
    name: string;
    progress: number;
    status: string;
    message?: string;
  }>;
}

/**
 * CodebaseMapper events
 */
export interface CodebaseMapperEvents {
  'analysis:started': { projectPath: string; config: CodebaseMapperConfig };
  'analysis:progress': CodebaseMapperProgress;
  'analysis:agent-started': { agent: AnalysisAgent };
  'analysis:agent-progress': { agentId: string; progress: number; message: string };
  'analysis:agent-completed': { agent: AnalysisAgent; result: unknown };
  'analysis:agent-failed': { agent: AnalysisAgent; error: string };
  'analysis:completed': { analysis: CodebaseAnalysis; duration: number };
  'analysis:error': { error: string; phase: string };
}

// =============================================================================
// Main CodebaseMapper Class
// =============================================================================

/**
 * CodebaseMapper orchestrates parallel analysis agents for comprehensive
 * codebase mapping and understanding. It builds on the existing codebase
 * analyzer foundation while adding enhanced agent coordination and
 * real-time progress tracking.
 */
export class CodebaseMapper extends EventEmitter<CodebaseMapperEvents> {
  private config: Required<CodebaseMapperConfig>;
  private analysisOrchestrator: CodebaseAnalysisOrchestrator;
  private agents: Map<string, AnalysisAgent> = new Map();
  private isRunning = false;
  private startTime?: Date;

  constructor(config: CodebaseMapperConfig) {
    super();

    this.config = {
      maxConcurrentAgents: 3,
      agentTimeout: 300000, // 5 minutes default
      includePatterns: ['**/*'],
      excludePatterns: [],
      quickMode: false,
      verbose: false,
      ...config,
    };

    // Initialize the underlying codebase analysis orchestrator
    this.analysisOrchestrator = createCodebaseAnalyzer();

    // Forward events from the orchestrator with enhanced context
    this.setupEventForwarding();
  }

  /**
   * Start comprehensive codebase analysis with parallel agents
   */
  async analyze(): Promise<CodebaseAnalysis> {
    if (this.isRunning) {
      throw new Error('Analysis already in progress');
    }

    this.isRunning = true;
    this.startTime = new Date();

    try {
      // Emit started event
      this.emit('analysis:started', {
        projectPath: this.config.projectPath,
        config: this.config,
      });

      // Initialize agents
      await this.initializeAgents();

      // Create analysis options for the orchestrator
      const analysisOptions: AnalysisOptions = {
        includeDetails: !this.config.quickMode,
        maxDepth: 10,
        excludePatterns: this.config.excludePatterns,
        enableParsing: true,
      };

      // Run the analysis
      const results = await this.analysisOrchestrator.analyze(this.config.projectPath, analysisOptions);

      // Aggregate results into CodebaseAnalysis
      const analysis: CodebaseAnalysis = {
        timestamp: new Date(),
        projectPath: this.config.projectPath,
        stack: {} as any, // Will be filled from results
        architecture: {} as any,
        conventions: {} as any,
        technicalDebt: {} as any,
        summary: {
          totalFiles: 0,
          totalLines: 0,
          analysisVersion: '0.6.0',
        },
      };

      for (const result of results) {
        if (result.success && result.data) {
          switch (result.phase) {
            case 'stack':
              analysis.stack = result.data;
              break;
            case 'architecture':
              analysis.architecture = result.data;
              break;
            case 'conventions':
              analysis.conventions = result.data;
              break;
            case 'testing-patterns':
              analysis.testingPatterns = result.data;
              break;
            case 'integrations':
              analysis.integrations = result.data;
              break;
            case 'technical-debt':
              analysis.technicalDebt = result.data;
              break;
          }
        }
      }

      // Calculate duration and emit completion
      const duration = Date.now() - (this.startTime?.getTime() || Date.now());
      this.emit('analysis:completed', { analysis, duration });

      return analysis;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.emit('analysis:error', {
        error: errorMessage,
        phase: this.getCurrentPhase(),
      });
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Get current analysis progress
   */
  getProgress(): CodebaseMapperProgress {
    const agents = Array.from(this.agents.values());
    const completedAgents = agents.filter(a => a.status === 'completed').length;
    const activeAgents = agents.filter(a => a.status === 'running').length;
    const totalAgents = agents.length;

    let overallProgress = 0;
    if (totalAgents > 0) {
      overallProgress = (completedAgents / totalAgents) * 100;
    }

    return {
      overallProgress,
      phase: this.getCurrentPhase(),
      activeAgents,
      completedAgents,
      totalAgents,
      currentOperation: this.getCurrentOperation(),
      agentProgress: agents.map(agent => ({
        id: agent.id,
        name: agent.name,
        progress: agent.status === 'completed' ? 100 :
                 agent.status === 'running' ? 50 : 0,
        status: agent.status,
        message: agent.error || undefined,
      })),
    };
  }

  /**
   * Cancel ongoing analysis
   */
  cancel(): void {
    if (this.isRunning) {
      this.isRunning = false;

      // Mark all running agents as failed
      for (const agent of this.agents.values()) {
        if (agent.status === 'running') {
          agent.status = 'failed';
          agent.error = 'Analysis cancelled';
          agent.endTime = new Date();
          this.emit('analysis:agent-failed', { agent, error: 'Analysis cancelled' });
        }
      }
    }
  }

  /**
   * Get list of available analysis agents
   */
  getAvailableAgents(): AnalysisAgent[] {
    return Array.from(this.agents.values());
  }

  // =============================================================================
  // Private Implementation Methods
  // =============================================================================

  private async initializeAgents(): Promise<void> {
    // Create agents from supported analysis phases
    const phases = this.analysisOrchestrator.getSupportedPhases();

    this.agents.clear();

    for (const phase of phases) {
      const agent: AnalysisAgent = {
        id: `agent-${phase}`,
        name: `${phase} analyzer`,
        domain: phase,
        description: `Analyzes ${phase} aspects of the codebase`,
        estimatedComplexity: 5,
        status: 'pending',
      };

      this.agents.set(agent.id, agent);
    }

    if (this.config.verbose) {
      console.log(`Initialized ${this.agents.size} analysis agents`);
    }
  }

  private setupEventForwarding(): void {
    // Forward analysis progress events with enhanced context
    this.analysisOrchestrator.onProgress((progress: AnalysisProgress) => {
      // Find corresponding agent and update status
      const agentId = `agent-${progress.phase}`;
      const agent = this.agents.get(agentId);

      if (agent && agent.status === 'pending') {
        agent.status = 'running';
        agent.startTime = new Date();
        this.emit('analysis:agent-started', { agent });
      }

      // Emit agent progress
      this.emit('analysis:agent-progress', {
        agentId,
        progress: progress.progress,
        message: progress.currentFile || '',
      });

      // Emit overall progress
      this.emit('analysis:progress', this.getProgress());
    });

    // Forward error events
    this.analysisOrchestrator.onError((error: AnalysisError) => {
      this.emit('analysis:error', {
        error: error.message,
        phase: this.getCurrentPhase(),
      });
    });
  }

  private getCurrentPhase(): CodebaseMapperProgress['phase'] {
    if (!this.isRunning) {
      return 'complete';
    }

    const agents = Array.from(this.agents.values());

    if (agents.length === 0) {
      return 'initializing';
    }

    if (agents.every(a => a.status === 'pending')) {
      return 'discovering';
    }

    if (agents.some(a => a.status === 'running')) {
      return 'analyzing';
    }

    if (agents.every(a => ['completed', 'failed'].includes(a.status))) {
      return 'aggregating';
    }

    return 'analyzing';
  }

  private getCurrentOperation(): string {
    const phase = this.getCurrentPhase();
    const agents = Array.from(this.agents.values());
    const runningAgents = agents.filter(a => a.status === 'running');

    switch (phase) {
      case 'initializing':
        return 'Initializing analysis agents';
      case 'discovering':
        return 'Discovering project files and structure';
      case 'analyzing':
        if (runningAgents.length > 0) {
          const agentNames = runningAgents.map(a => a.name).join(', ');
          return `Running analysis: ${agentNames}`;
        }
        return 'Analyzing codebase';
      case 'aggregating':
        return 'Aggregating analysis results';
      case 'complete':
        return 'Analysis complete';
      default:
        return 'Processing';
    }
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new CodebaseMapper instance
 */
export function createCodebaseMapper(config: CodebaseMapperConfig): CodebaseMapper {
  return new CodebaseMapper(config);
}

// Types are already exported above, no need to re-export from self