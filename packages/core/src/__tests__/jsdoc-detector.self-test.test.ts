import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  analyzeFile,
  analyzeFiles,
  type DetectionConfig,
} from '../jsdoc-detector.js';

describe('JSDoc Detector - Self-Analysis Tests', () => {
  describe('Analyzing APEX Codebase Files', () => {
    it('analyzes its own implementation file', () => {
      // Read the actual jsdoc-detector.ts file
      let jsDocDetectorSource: string;

      try {
        jsDocDetectorSource = readFileSync(
          join(__dirname, '..', 'jsdoc-detector.ts'),
          'utf-8'
        );
      } catch (error) {
        // Fallback for testing environments where file system access might be restricted
        jsDocDetectorSource = `
          /**
           * JSDoc/TSDoc Detection Module
           * Analyzes TypeScript/JavaScript files to identify exports that are missing JSDoc/TSDoc documentation
           */
          export type ExportKind = 'function' | 'class' | 'interface' | 'type';

          /**
           * Information about a detected export
           */
          export interface ExportInfo {
            name: string;
            kind: ExportKind;
            line: number;
            column: number;
          }

          /**
           * Parse a JSDoc comment block into structured information
           * @param comment - The raw JSDoc comment including /** and */
           * @param startLine - Line number where the comment starts
           * @returns Parsed JSDoc information or null if invalid
           */
          export function parseJSDocComment(comment: string, startLine: number): any {
            return null;
          }

          /**
           * Find all exports in source code
           * @param source - The source code to analyze
           * @returns Array of export information
           */
          export function findExportsInSource(source: string): ExportInfo[] {
            return [];
          }

          // Missing documentation for this helper function
          function mapStringToExportKind(kind: string): ExportKind {
            return 'function';
          }
        `;
      }

      const result = analyzeFile('packages/core/src/jsdoc-detector.ts', jsDocDetectorSource);

      // The implementation file should have good documentation coverage
      expect(result.exports.length).toBeGreaterThan(5);
      expect(result.stats.coveragePercent).toBeGreaterThan(70);

      // Should identify any undocumented internal functions
      const undocumented = result.documentation.filter(d => !d.isDocumented);
      if (undocumented.length > 0) {
        undocumented.forEach(doc => {
          expect(doc.suggestions.length).toBeGreaterThan(0);
        });
      }
    });

    it('analyzes APEX type definitions', () => {
      // Mock a typical types file from the APEX codebase
      const typesSource = `
        import { z } from 'zod';

        /**
         * Core task definition for APEX
         */
        export const TaskSchema = z.object({
          id: z.string(),
          title: z.string(),
          description: z.string().optional(),
          status: z.enum(['pending', 'running', 'completed', 'failed']),
          createdAt: z.date(),
          updatedAt: z.date(),
        });

        /**
         * Task type derived from schema
         */
        export type Task = z.infer<typeof TaskSchema>;

        /**
         * Agent configuration schema
         */
        export const AgentConfigSchema = z.object({
          name: z.string(),
          role: z.string(),
          model: z.enum(['sonnet', 'haiku', 'opus']).optional(),
          systemPrompt: z.string().optional(),
        });

        export type AgentConfig = z.infer<typeof AgentConfigSchema>;

        /**
         * Workflow step configuration
         */
        export interface WorkflowStep {
          /** Step identifier */
          id: string;
          /** Agent responsible for this step */
          agent: string;
          /** Dependencies on other steps */
          dependencies?: string[];
          /** Step-specific configuration */
          config?: Record<string, any>;
        }

        /**
         * Complete workflow definition
         */
        export interface Workflow {
          /** Workflow name */
          name: string;
          /** Workflow description */
          description?: string;
          /** Ordered list of workflow steps */
          steps: WorkflowStep[];
        }

        // Missing documentation for utility types
        export type TaskStatus = Task['status'];
        export type PartialTask = Partial<Task>;
        export type RequiredTask = Required<Task>;

        /**
         * Event types for task lifecycle
         */
        export enum TaskEvent {
          CREATED = 'task.created',
          STARTED = 'task.started',
          PROGRESS = 'task.progress',
          COMPLETED = 'task.completed',
          FAILED = 'task.failed',
        }

        // Configuration constants
        export const DEFAULT_TIMEOUT = 30000;
        export const MAX_RETRIES = 3;
      `;

      const config: DetectionConfig = {
        minSummaryLength: 10,
        includePrivate: false,
      };

      const result = analyzeFile('packages/core/src/types.ts', typesSource, config);

      expect(result.exports.length).toBeGreaterThan(8);

      // Should identify well-documented schemas
      const taskSchemaDoc = result.documentation.find(
        d => d.export.name === 'TaskSchema'
      );
      expect(taskSchemaDoc).toBeDefined();
      expect(taskSchemaDoc!.isDocumented).toBe(true);

      // Should identify missing documentation for utility types
      const taskStatusDoc = result.documentation.find(
        d => d.export.name === 'TaskStatus'
      );
      expect(taskStatusDoc).toBeDefined();
      expect(taskStatusDoc!.isDocumented).toBe(false);

      // Constants should be flagged as undocumented
      const timeoutDoc = result.documentation.find(
        d => d.export.name === 'DEFAULT_TIMEOUT'
      );
      expect(timeoutDoc).toBeDefined();
      expect(timeoutDoc!.isDocumented).toBe(false);
    });

    it('analyzes APEX CLI command structure', () => {
      const cliSource = `
        import { Command } from 'commander';
        import { ApexOrchestrator } from '@apex/orchestrator';

        /**
         * CLI command for initializing new APEX projects
         * Creates necessary configuration files and directory structure
         *
         * @param projectPath - Path where the project should be initialized
         * @param options - Initialization options
         * @returns Promise resolving to initialization result
         */
        export async function initCommand(
          projectPath: string,
          options: { force?: boolean; template?: string }
        ): Promise<void> {
          // Implementation
        }

        /**
         * CLI command for running APEX workflows
         * Executes the specified workflow using the orchestrator
         *
         * @param workflowName - Name of workflow to execute
         * @param options - Execution options
         * @returns Promise resolving to execution result
         */
        export async function runCommand(
          workflowName: string,
          options: { config?: string; verbose?: boolean }
        ): Promise<void> {
          // Implementation
        }

        /**
         * Display current task status
         * Shows information about running and completed tasks
         *
         * @param options - Display options
         * @returns Promise resolving when status is displayed
         */
        export async function statusCommand(
          options: { json?: boolean; watch?: boolean }
        ): Promise<void> {
          // Implementation
        }

        /**
         * Start APEX API server
         * Launches the REST API and WebSocket server for web interface
         *
         * @param options - Server options
         * @returns Promise resolving when server is started
         */
        export async function serveCommand(
          options: { port?: number; host?: string }
        ): Promise<void> {
          // Implementation
        }

        // Missing documentation
        export function createProgram(): Command {
          return new Command();
        }

        // Missing documentation
        export const CLI_VERSION = '0.3.0';

        /**
         * Default CLI configuration
         */
        export const DEFAULT_CLI_CONFIG = {
          configPath: '.apex/config.yaml',
          verbose: false,
          timeout: 300000,
        };

        // Helper functions without documentation
        export function parseConfigPath(path?: string): string {
          return path || DEFAULT_CLI_CONFIG.configPath;
        }

        export function validateWorkflowName(name: string): boolean {
          return /^[a-zA-Z][a-zA-Z0-9-_]*$/.test(name);
        }
      `;

      const strictConfig: DetectionConfig = {
        requiredTags: ['param', 'returns'],
        minSummaryLength: 20,
      };

      const result = analyzeFile('packages/cli/src/commands.ts', cliSource, strictConfig);

      expect(result.exports.length).toBe(8);

      // Main CLI commands should be well documented
      const mainCommands = ['initCommand', 'runCommand', 'statusCommand', 'serveCommand'];
      const commandDocs = result.documentation.filter(d =>
        mainCommands.includes(d.export.name)
      );

      commandDocs.forEach(doc => {
        expect(doc.isDocumented).toBe(true);
        expect(doc.jsdoc!.summary.length).toBeGreaterThan(20);
      });

      // Helper functions should be flagged as undocumented
      const helperDocs = result.documentation.filter(d =>
        ['createProgram', 'parseConfigPath', 'validateWorkflowName'].includes(d.export.name)
      );

      helperDocs.forEach(doc => {
        expect(doc.isDocumented).toBe(false);
        expect(doc.suggestions).toContain(
          expect.stringContaining('Add JSDoc comment above')
        );
      });
    });

    it('analyzes orchestrator service patterns', () => {
      const orchestratorSource = `
        import { EventEmitter } from 'events';
        import { Task, Agent, Workflow } from '@apex/core';

        /**
         * Core orchestration engine for APEX
         * Manages task execution, agent coordination, and workflow processing
         *
         * @fires ApexOrchestrator#task:created - When a new task is created
         * @fires ApexOrchestrator#task:started - When task execution begins
         * @fires ApexOrchestrator#task:completed - When task execution completes
         * @fires ApexOrchestrator#agent:assigned - When an agent is assigned to a task
         */
        export class ApexOrchestrator extends EventEmitter {
          private tasks = new Map<string, Task>();
          private agents = new Map<string, Agent>();

          /**
           * Creates a new orchestrator instance
           * @param config - Orchestrator configuration
           */
          constructor(private config: OrchestratorConfig) {
            super();
          }

          /**
           * Executes a workflow with the given input
           * @param workflow - Workflow definition to execute
           * @param input - Input data for the workflow
           * @returns Promise resolving to execution result
           * @throws {WorkflowError} When workflow execution fails
           */
          async executeWorkflow(workflow: Workflow, input: any): Promise<any> {
            return {};
          }

          /**
           * Registers a new agent with the orchestrator
           * @param agent - Agent configuration to register
           * @throws {DuplicateAgentError} When agent name already exists
           */
          registerAgent(agent: Agent): void {
            this.agents.set(agent.name, agent);
          }

          /**
           * Retrieves task by ID
           * @param taskId - Unique task identifier
           * @returns Task object or null if not found
           */
          getTask(taskId: string): Task | null {
            return this.tasks.get(taskId) || null;
          }

          /**
           * Lists all tasks with optional filtering
           * @param filter - Optional filter criteria
           * @returns Array of matching tasks
           */
          listTasks(filter?: TaskFilter): Task[] {
            const allTasks = Array.from(this.tasks.values());
            return filter ? allTasks.filter(task => this.matchesFilter(task, filter)) : allTasks;
          }

          // Private helper without documentation
          private matchesFilter(task: Task, filter: TaskFilter): boolean {
            return true;
          }

          // Missing documentation for this public method
          getStatistics() {
            return {
              totalTasks: this.tasks.size,
              totalAgents: this.agents.size,
              activeTasks: Array.from(this.tasks.values()).filter(t => t.status === 'running').length,
            };
          }
        }

        /**
         * Configuration options for orchestrator
         */
        export interface OrchestratorConfig {
          /** Maximum number of concurrent tasks */
          maxConcurrentTasks?: number;
          /** Task execution timeout in milliseconds */
          taskTimeout?: number;
          /** Enable detailed logging */
          verbose?: boolean;
        }

        /**
         * Filter criteria for task queries
         */
        export interface TaskFilter {
          /** Filter by task status */
          status?: Task['status'];
          /** Filter by agent name */
          agent?: string;
          /** Filter by creation date range */
          createdAfter?: Date;
          createdBefore?: Date;
        }

        /**
         * Factory function for creating orchestrator instances
         * @param config - Configuration options
         * @returns Configured orchestrator instance
         */
        export function createOrchestrator(config: OrchestratorConfig): ApexOrchestrator {
          return new ApexOrchestrator(config);
        }

        // Missing documentation for error classes
        export class WorkflowError extends Error {
          constructor(message: string, public workflowName: string) {
            super(message);
          }
        }

        export class DuplicateAgentError extends Error {
          constructor(agentName: string) {
            super(\`Agent '\${agentName}' is already registered\`);
          }
        }

        // Constants without documentation
        export const DEFAULT_ORCHESTRATOR_CONFIG: OrchestratorConfig = {
          maxConcurrentTasks: 5,
          taskTimeout: 300000,
          verbose: false,
        };
      `;

      const result = analyzeFile('packages/orchestrator/src/index.ts', orchestratorSource);

      expect(result.exports.length).toBeGreaterThan(6);

      // Main orchestrator class should be well documented
      const orchestratorDoc = result.documentation.find(
        d => d.export.name === 'ApexOrchestrator'
      );
      expect(orchestratorDoc).toBeDefined();
      expect(orchestratorDoc!.isDocumented).toBe(true);
      expect(orchestratorDoc!.jsdoc!.summary).toContain('orchestration engine');

      // Should identify missing documentation for error classes
      const errorClassDocs = result.documentation.filter(d =>
        ['WorkflowError', 'DuplicateAgentError'].includes(d.export.name)
      );

      errorClassDocs.forEach(doc => {
        expect(doc.isDocumented).toBe(false);
      });

      // Public methods without documentation should be flagged
      const getStatisticsDoc = result.documentation.find(
        d => d.export.name === 'getStatistics'
      );
      if (getStatisticsDoc) {
        expect(getStatisticsDoc.isDocumented).toBe(false);
      }
    });
  });

  describe('Project-wide Analysis', () => {
    it('analyzes multiple APEX modules together', () => {
      const moduleFiles = [
        {
          path: 'packages/core/src/types.ts',
          content: `
            /** Core task type */
            export interface Task { id: string; status: string; }

            export type TaskStatus = 'pending' | 'running' | 'completed';

            // Missing docs
            export const TASK_DEFAULTS = { timeout: 30000 };
          `,
        },
        {
          path: 'packages/orchestrator/src/orchestrator.ts',
          content: `
            import { Task } from '@apex/core';

            /**
             * Main orchestrator class
             * @param config Configuration options
             */
            export class Orchestrator {
              constructor(private config: any) {}

              executeTask(task: Task) {
                return Promise.resolve();
              }
            }
          `,
        },
        {
          path: 'packages/cli/src/commands.ts',
          content: `
            /**
             * CLI initialization command
             * @param path Project path
             * @returns Promise resolving when complete
             */
            export async function init(path: string): Promise<void> {}

            export function run() {}
          `,
        },
      ];

      const projectConfig: DetectionConfig = {
        minSummaryLength: 15,
        requiredTags: ['param', 'returns'],
        includePrivate: false,
      };

      const results = analyzeFiles(moduleFiles, projectConfig);

      expect(results).toHaveLength(3);

      // Calculate project-wide coverage
      const totalStats = results.reduce(
        (acc, result) => ({
          totalExports: acc.totalExports + result.stats.totalExports,
          documentedExports: acc.documentedExports + result.stats.documentedExports,
          undocumentedExports: acc.undocumentedExports + result.stats.undocumentedExports,
        }),
        { totalExports: 0, documentedExports: 0, undocumentedExports: 0 }
      );

      const overallCoverage = (totalStats.documentedExports / totalStats.totalExports) * 100;

      expect(totalStats.totalExports).toBeGreaterThan(5);
      expect(overallCoverage).toBeGreaterThan(0);
      expect(overallCoverage).toBeLessThan(100); // Should have some undocumented items

      // Verify each module has the expected structure
      results.forEach(result => {
        expect(result.exports.length).toBeGreaterThan(0);
        expect(result.documentation.length).toBe(result.exports.length);
      });
    });

    it('generates comprehensive documentation coverage report', () => {
      const sampleProject = [
        {
          path: 'well-documented.ts',
          content: `
            /**
             * Excellent function with comprehensive documentation
             * @param input Input parameter with detailed description
             * @param options Configuration options object
             * @returns Promise resolving to processed result
             * @example const result = await excellentFunction('test', {});
             */
            export async function excellentFunction(
              input: string,
              options: object
            ): Promise<any> {
              return {};
            }

            /**
             * Well documented interface
             */
            export interface WellDocumentedInterface {
              prop: string;
            }
          `,
        },
        {
          path: 'poorly-documented.ts',
          content: `
            export function poorFunction(a: any, b: any): any {
              return a + b;
            }

            /** Bad */
            export const BAD_CONSTANT = true;

            export class UndocumentedClass {
              method() {}
            }
          `,
        },
        {
          path: 'mixed-quality.ts',
          content: `
            /**
             * Decent function documentation
             * @param value Input value
             */
            export function decentFunction(value: string): void {}

            export function missingDocs(): boolean {
              return true;
            }

            /**
             * Good interface documentation
             */
            export interface GoodInterface {
              id: string;
            }
          `,
        },
      ];

      const strictStandards: DetectionConfig = {
        minSummaryLength: 30,
        requiredTags: ['param', 'returns'],
      };

      const results = analyzeFiles(sampleProject, strictStandards);

      // Generate a comprehensive report structure
      const report = {
        summary: {
          totalFiles: results.length,
          totalExports: results.reduce((sum, r) => sum + r.stats.totalExports, 0),
          documentedExports: results.reduce((sum, r) => sum + r.stats.documentedExports, 0),
          undocumentedExports: results.reduce((sum, r) => sum + r.stats.undocumentedExports, 0),
          overallCoverage: 0,
        },
        fileBreakdown: results.map(result => ({
          file: result.filePath,
          coverage: result.stats.coveragePercent,
          exports: result.stats.totalExports,
          documented: result.stats.documentedExports,
          issues: result.documentation
            .filter(d => !d.isDocumented)
            .map(d => ({
              export: d.export.name,
              line: d.export.line,
              suggestions: d.suggestions,
            })),
        })),
        recommendations: [] as string[],
      };

      report.summary.overallCoverage = Math.round(
        (report.summary.documentedExports / report.summary.totalExports) * 100
      );

      // Verify report structure and content
      expect(report.summary.totalFiles).toBe(3);
      expect(report.summary.totalExports).toBeGreaterThan(6);
      expect(report.summary.overallCoverage).toBeGreaterThan(0);
      expect(report.summary.overallCoverage).toBeLessThan(100);

      expect(report.fileBreakdown).toHaveLength(3);

      // Well-documented file should have higher coverage
      const wellDocFile = report.fileBreakdown.find(f => f.file === 'well-documented.ts');
      const poorDocFile = report.fileBreakdown.find(f => f.file === 'poorly-documented.ts');

      expect(wellDocFile!.coverage).toBeGreaterThan(poorDocFile!.coverage);

      // Poorly documented file should have many issues
      expect(poorDocFile!.issues.length).toBeGreaterThan(0);
      poorDocFile!.issues.forEach(issue => {
        expect(issue.suggestions.length).toBeGreaterThan(0);
      });
    });
  });
});