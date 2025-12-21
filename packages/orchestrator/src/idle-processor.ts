import { promises as fs } from 'fs';
import { join } from 'path';
import { EventEmitter } from 'eventemitter3';
import {
  Task,
  TaskPriority,
  CreateTaskRequest,
  DaemonConfig,
  ApexConfig
} from '@apexcli/core';
import { TaskStore } from './store';
import { IdleTaskGenerator } from './idle-task-generator';

export interface IdleTask {
  id: string;
  type: 'improvement' | 'maintenance' | 'optimization' | 'documentation';
  title: string;
  description: string;
  priority: TaskPriority;
  estimatedEffort: 'low' | 'medium' | 'high';
  suggestedWorkflow: string;
  rationale: string;
  createdAt: Date;
  implemented: boolean;
}

export interface ProjectAnalysis {
  codebaseSize: {
    files: number;
    lines: number;
    languages: Record<string, number>;
  };
  testCoverage?: {
    percentage: number;
    uncoveredFiles: string[];
  };
  dependencies: {
    outdated: string[];
    security: string[];
  };
  codeQuality: {
    lintIssues: number;
    duplicatedCode: string[];
    complexityHotspots: string[];
  };
  documentation: {
    coverage: number;
    missingDocs: string[];
  };
  performance: {
    bundleSize?: number;
    slowTests: string[];
    bottlenecks: string[];
  };
}

export interface IdleProcessorEvents {
  'analysis:started': () => void;
  'analysis:completed': (analysis: ProjectAnalysis) => void;
  'tasks:generated': (tasks: IdleTask[]) => void;
  'task:suggested': (task: IdleTask) => void;
}

/**
 * Analyzes the project during idle time and generates improvement tasks
 */
export class IdleProcessor extends EventEmitter<IdleProcessorEvents> {
  private projectPath: string;
  private config: DaemonConfig;
  private store: TaskStore;
  private isProcessing = false;
  private lastAnalysis?: ProjectAnalysis;
  private generatedTasks: Map<string, IdleTask> = new Map();
  private taskGenerator: IdleTaskGenerator;

  constructor(projectPath: string, config: DaemonConfig, store: TaskStore) {
    super();
    this.projectPath = projectPath;
    this.config = config;
    this.store = store;

    // Initialize the IdleTaskGenerator with strategy weights from config
    this.taskGenerator = new IdleTaskGenerator(
      config.idleProcessing?.strategyWeights
    );
  }

  /**
   * Start idle processing if enabled
   */
  async start(): Promise<void> {
    if (!this.config.idleProcessing?.enabled) {
      return;
    }

    const idleThreshold = this.config.idleProcessing.idleThreshold || 300000; // 5 minutes
    const taskGenerationInterval = this.config.idleProcessing.taskGenerationInterval || 3600000; // 1 hour

    // Check for idle periods
    setInterval(async () => {
      const lastActivity = await this.getLastActivityTime();
      const idleTime = Date.now() - lastActivity.getTime();

      if (idleTime > idleThreshold && !this.isProcessing) {
        await this.processIdleTime();
      }
    }, 60000); // Check every minute

    // Generate tasks periodically
    setInterval(async () => {
      if (!this.isProcessing) {
        await this.generateImprovementTasks();
      }
    }, taskGenerationInterval);
  }

  /**
   * Manually trigger idle processing
   */
  async processIdleTime(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    try {
      this.emit('analysis:started');

      const analysis = await this.analyzeProject();
      this.lastAnalysis = analysis;

      this.emit('analysis:completed', analysis);

      const tasks = await this.generateTasksFromAnalysis(analysis);
      this.emit('tasks:generated', tasks);

      for (const task of tasks) {
        this.generatedTasks.set(task.id, task);
        this.emit('task:suggested', task);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Get the current project analysis
   */
  getLastAnalysis(): ProjectAnalysis | undefined {
    return this.lastAnalysis;
  }

  /**
   * Get generated improvement tasks
   */
  getGeneratedTasks(): IdleTask[] {
    return Array.from(this.generatedTasks.values());
  }

  /**
   * Convert an idle task to a real task
   */
  async implementIdleTask(idleTaskId: string): Promise<string> {
    const idleTask = this.generatedTasks.get(idleTaskId);
    if (!idleTask) {
      throw new Error(`Idle task ${idleTaskId} not found`);
    }

    if (idleTask.implemented) {
      throw new Error(`Idle task ${idleTaskId} has already been implemented`);
    }

    const taskRequest: CreateTaskRequest = {
      description: idleTask.description,
      acceptanceCriteria: `Implement ${idleTask.title}. ${idleTask.rationale}`,
      workflow: idleTask.suggestedWorkflow,
      priority: idleTask.priority,
      projectPath: this.projectPath,
    };

    const task = await this.store.createTask(taskRequest);

    // Mark idle task as implemented
    idleTask.implemented = true;
    this.generatedTasks.set(idleTaskId, idleTask);

    return task.id;
  }

  /**
   * Dismiss an idle task suggestion
   */
  dismissIdleTask(idleTaskId: string): void {
    this.generatedTasks.delete(idleTaskId);
  }

  // ============================================================================
  // Project Analysis Methods
  // ============================================================================

  private async analyzeProject(): Promise<ProjectAnalysis> {
    const analysis: ProjectAnalysis = {
      codebaseSize: await this.analyzeCodebaseSize(),
      testCoverage: await this.analyzeTestCoverage(),
      dependencies: await this.analyzeDependencies(),
      codeQuality: await this.analyzeCodeQuality(),
      documentation: await this.analyzeDocumentation(),
      performance: await this.analyzePerformance(),
    };

    return analysis;
  }

  private async analyzeCodebaseSize(): Promise<ProjectAnalysis['codebaseSize']> {
    try {
      // Get file count and language distribution
      const { stdout } = await this.execAsync('find . -type f -name "*.ts" -o -name "*.js" -o -name "*.py" -o -name "*.java" -o -name "*.go" -o -name "*.rs" | head -1000');
      const files = stdout.split('\n').filter(line => line.trim());

      const languages: Record<string, number> = {};
      let totalLines = 0;

      for (const file of files) {
        const ext = file.split('.').pop() || 'unknown';
        languages[ext] = (languages[ext] || 0) + 1;

        try {
          const content = await fs.readFile(join(this.projectPath, file), 'utf-8');
          totalLines += content.split('\n').length;
        } catch {
          // Ignore files that can't be read
        }
      }

      return {
        files: files.length,
        lines: totalLines,
        languages,
      };
    } catch {
      return { files: 0, lines: 0, languages: {} };
    }
  }

  private async analyzeTestCoverage(): Promise<ProjectAnalysis['testCoverage']> {
    try {
      // Try to find test files
      const { stdout } = await this.execAsync('find . -name "*.test.*" -o -name "*.spec.*" | wc -l');
      const testFileCount = parseInt(stdout.trim());

      // Simple heuristic: estimate coverage based on test file ratio
      const analysis = await this.analyzeCodebaseSize();
      const coverage = analysis.files > 0 ? Math.min((testFileCount / analysis.files) * 100, 100) : 0;

      // Find files without corresponding tests (simplified)
      const { stdout: sourceFiles } = await this.execAsync('find . -name "*.ts" -o -name "*.js" | grep -v test | grep -v spec | head -50');
      const uncoveredFiles = sourceFiles.split('\n').filter(line => line.trim()).slice(0, 10);

      return {
        percentage: coverage,
        uncoveredFiles,
      };
    } catch {
      return undefined;
    }
  }

  private async analyzeDependencies(): Promise<ProjectAnalysis['dependencies']> {
    const outdated: string[] = [];
    const security: string[] = [];

    try {
      // Check for package.json
      const packageJson = await fs.readFile(join(this.projectPath, 'package.json'), 'utf-8');
      const pkg = JSON.parse(packageJson);

      // Simple check for common outdated patterns
      const dependencies = { ...pkg.dependencies, ...pkg.devDependencies };
      for (const [name, version] of Object.entries(dependencies)) {
        if (typeof version === 'string') {
          // Flag very old version patterns
          if (version.includes('^0.') || version.includes('~0.')) {
            outdated.push(`${name}@${version}`);
          }
        }
      }
    } catch {
      // No package.json or can't read it
    }

    return { outdated, security };
  }

  private async analyzeCodeQuality(): Promise<ProjectAnalysis['codeQuality']> {
    let lintIssues = 0;
    const duplicatedCode: string[] = [];
    const complexityHotspots: string[] = [];

    try {
      // Try to run ESLint if available
      try {
        const { stdout } = await this.execAsync('npx eslint . --format=json 2>/dev/null || echo "[]"');
        const results = JSON.parse(stdout);
        lintIssues = results.reduce((total: number, file: any) => total + file.errorCount + file.warningCount, 0);
      } catch {
        // ESLint not available or failed
      }

      // Look for potential complexity hotspots (large files)
      const { stdout } = await this.execAsync('find . -name "*.ts" -o -name "*.js" | xargs wc -l | sort -nr | head -5');
      const largeFiles = stdout.split('\n')
        .filter(line => line.trim() && !line.includes('total'))
        .map(line => {
          const parts = line.trim().split(/\s+/);
          const lineCount = parseInt(parts[0]);
          const filename = parts[1];
          return lineCount > 500 ? filename : null;
        })
        .filter(Boolean) as string[];

      complexityHotspots.push(...largeFiles);
    } catch {
      // Ignore errors in code quality analysis
    }

    return {
      lintIssues,
      duplicatedCode,
      complexityHotspots,
    };
  }

  private async analyzeDocumentation(): Promise<ProjectAnalysis['documentation']> {
    try {
      // Count documentation files
      const { stdout: docFiles } = await this.execAsync('find . -name "*.md" -o -name "*.rst" -o -name "*.txt" | grep -i -E "(readme|doc)" | wc -l');
      const docCount = parseInt(docFiles.trim());

      // Count source files
      const { stdout: sourceFiles } = await this.execAsync('find . -name "*.ts" -o -name "*.js" | wc -l');
      const sourceCount = parseInt(sourceFiles.trim());

      const coverage = sourceCount > 0 ? Math.min((docCount / sourceCount) * 100, 100) : 0;

      // Find files that might need documentation
      const { stdout: undocumentedFiles } = await this.execAsync('find . -name "*.ts" -o -name "*.js" | grep -v test | head -10');
      const missingDocs = undocumentedFiles.split('\n').filter(line => line.trim()).slice(0, 5);

      return {
        coverage,
        missingDocs,
      };
    } catch {
      return { coverage: 0, missingDocs: [] };
    }
  }

  private async analyzePerformance(): Promise<ProjectAnalysis['performance']> {
    const slowTests: string[] = [];
    const bottlenecks: string[] = [];

    try {
      // Look for slow test patterns
      const { stdout } = await this.execAsync('grep -r "timeout\\|slow\\|performance" . --include="*.test.*" --include="*.spec.*" | head -5');
      const slowTestFiles = stdout.split('\n')
        .filter(line => line.trim())
        .map(line => line.split(':')[0])
        .slice(0, 3);

      slowTests.push(...slowTestFiles);

      // Look for potential bottlenecks (nested loops, heavy operations)
      const { stdout: bottleneckFiles } = await this.execAsync('grep -r "for.*for\\|while.*while" . --include="*.ts" --include="*.js" | head -5');
      const bottleneckCandidates = bottleneckFiles.split('\n')
        .filter(line => line.trim())
        .map(line => line.split(':')[0])
        .slice(0, 3);

      bottlenecks.push(...bottleneckCandidates);
    } catch {
      // Ignore errors in performance analysis
    }

    return {
      slowTests,
      bottlenecks,
    };
  }

  // ============================================================================
  // Task Generation Methods
  // ============================================================================

  private async generateImprovementTasks(): Promise<void> {
    if (!this.lastAnalysis) {
      await this.processIdleTime();
      return;
    }

    const maxTasks = this.config.idleProcessing?.maxIdleTasks || 3;
    const currentTaskCount = this.generatedTasks.size;

    if (currentTaskCount >= maxTasks) {
      return; // Already have enough suggestions
    }

    // Reset the task generator for a new generation cycle
    this.taskGenerator.reset();

    const tasks = await this.generateTasksFromAnalysis(this.lastAnalysis);

    for (const task of tasks.slice(0, maxTasks - currentTaskCount)) {
      this.generatedTasks.set(task.id, task);
      this.emit('task:suggested', task);
    }
  }

  private async generateTasksFromAnalysis(analysis: ProjectAnalysis): Promise<IdleTask[]> {
    const tasks: IdleTask[] = [];
    const maxTasks = this.config.idleProcessing?.maxIdleTasks || 3;

    // Generate tasks using the weighted strategy approach
    for (let i = 0; i < maxTasks; i++) {
      const task = this.taskGenerator.generateTask(analysis);
      if (task) {
        tasks.push(task);
      } else {
        // No more tasks can be generated
        break;
      }
    }

    return tasks;
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private async getLastActivityTime(): Promise<Date> {
    try {
      // Check for recent tasks in the store
      const recentTasks = await this.store.getTasksByStatus('in-progress');

      if (recentTasks.length > 0) {
        return new Date(); // Active tasks = no idle time
      }

      // Check last completed task
      const allTasks = await this.store.getAllTasks();
      const lastTask = allTasks
        .filter(task => task.completedAt)
        .sort((a, b) => (b.completedAt?.getTime() || 0) - (a.completedAt?.getTime() || 0))[0];

      return lastTask?.completedAt || new Date(Date.now() - 86400000); // Default to 24h ago
    } catch {
      return new Date(Date.now() - 86400000); // Default to 24h ago
    }
  }

  private async execAsync(command: string): Promise<{ stdout: string; stderr: string }> {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execPromise = promisify(exec);

    return execPromise(command, { cwd: this.projectPath });
  }
}