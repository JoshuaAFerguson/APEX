import { promises as fs } from 'fs';
import { join } from 'path';
import { EventEmitter } from 'eventemitter3';
import {
  Task,
  TaskPriority,
  CreateTaskRequest,
  DaemonConfig,
  ApexConfig,
  ComplexityHotspot,
  CodeSmell,
  DuplicatePattern,
  EnhancedDocumentationAnalysis,
  UndocumentedExport,
  OutdatedDocumentation,
  MissingReadmeSection,
  APICompleteness,
  ReadmeSection
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

/**
 * Type of update required for an outdated dependency
 */
export type UpdateType = 'major' | 'minor' | 'patch';

/**
 * Vulnerability severity level per CVSS scoring
 */
export type VulnerabilitySeverity = 'critical' | 'high' | 'medium' | 'low';

/**
 * Represents an outdated dependency with version comparison metadata.
 */
export interface OutdatedDependency {
  /** Package name (e.g., "lodash") */
  name: string;
  /** Currently installed version (e.g., "4.17.15") */
  currentVersion: string;
  /** Latest available version (e.g., "4.17.21") */
  latestVersion: string;
  /** Type of update required */
  updateType: UpdateType;
}

/**
 * Represents a security vulnerability in a dependency.
 */
export interface SecurityVulnerability {
  /** Package name affected */
  name: string;
  /** CVE identifier (e.g., "CVE-2021-44228") */
  cveId: string;
  /** Severity level per CVSS scoring */
  severity: VulnerabilitySeverity;
  /** Version range affected (e.g., "<4.17.21") */
  affectedVersions: string;
  /** Human-readable description of the vulnerability */
  description: string;
}

/**
 * Represents a deprecated package that should be replaced.
 */
export interface DeprecatedPackage {
  /** Package name that is deprecated */
  name: string;
  /** Current installed version */
  currentVersion: string;
  /** Recommended replacement package (e.g., "@lodash/es") */
  replacement: string | null;
  /** Reason for deprecation */
  reason: string;
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
    /** @deprecated Use outdatedPackages instead - retained for backward compatibility */
    outdated: string[];
    /** @deprecated Use securityIssues instead - retained for backward compatibility */
    security: string[];
    /** Rich outdated dependency information */
    outdatedPackages?: OutdatedDependency[];
    /** Rich security vulnerability information */
    securityIssues?: SecurityVulnerability[];
    /** Deprecated packages that should be replaced */
    deprecatedPackages?: DeprecatedPackage[];
  };
  codeQuality: {
    lintIssues: number;
    duplicatedCode: DuplicatePattern[];
    complexityHotspots: ComplexityHotspot[];
    codeSmells: CodeSmell[];
  };
  documentation: EnhancedDocumentationAnalysis;
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
    const duplicatedCode: DuplicatePattern[] = [];
    const complexityHotspots: ComplexityHotspot[] = [];
    const codeSmells: CodeSmell[] = [];

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
          if (lineCount > 500 && filename) {
            // Create a ComplexityHotspot object
            return {
              file: filename.replace(this.projectPath + '/', ''), // Make relative path
              cyclomaticComplexity: Math.min(Math.floor(lineCount / 50), 30), // Rough estimate
              cognitiveComplexity: Math.min(Math.floor(lineCount / 40), 35), // Rough estimate
              lineCount
            } as ComplexityHotspot;
          }
          return null;
        })
        .filter(Boolean) as ComplexityHotspot[];

      complexityHotspots.push(...largeFiles);

      // Analyze code smells based on file size and naming patterns
      for (const hotspot of complexityHotspots) {
        if (hotspot.lineCount > 1000) {
          codeSmells.push({
            file: hotspot.file,
            type: 'large-class',
            severity: 'high',
            details: `File has ${hotspot.lineCount} lines, consider breaking into smaller modules`
          });
        }

        if (hotspot.cyclomaticComplexity > 20) {
          codeSmells.push({
            file: hotspot.file,
            type: 'long-method',
            severity: 'medium',
            details: `High cyclomatic complexity (${hotspot.cyclomaticComplexity}), consider refactoring`
          });
        }
      }

      // Basic duplicate pattern detection (simplified implementation)
      try {
        const { stdout: grepOutput } = await this.execAsync('grep -r -n "TODO\\|FIXME\\|HACK" --include="*.ts" --include="*.js" . | head -10 || echo ""');
        if (grepOutput.trim()) {
          const todoLines = grepOutput.split('\n').filter(line => line.trim());
          if (todoLines.length > 3) {
            duplicatedCode.push({
              pattern: 'TODO/FIXME comments',
              locations: todoLines.slice(0, 5).map(line => line.split(':').slice(0, 2).join(':')),
              similarity: 1.0
            });
          }
        }
      } catch {
        // Ignore grep errors
      }
    } catch {
      // Ignore errors in code quality analysis
    }

    return {
      lintIssues,
      duplicatedCode,
      complexityHotspots,
      codeSmells,
    };
  }

  private async analyzeDocumentation(): Promise<EnhancedDocumentationAnalysis> {
    try {
      // Basic coverage calculation (keep existing logic for backward compatibility)
      const basicCoverage = await this.calculateBasicDocumentationCoverage();

      // Enhanced analysis components
      const undocumentedExports = await this.findUndocumentedExports();
      const outdatedDocs = await this.findOutdatedDocumentation();
      const missingReadmeSections = await this.findMissingReadmeSections();
      const apiCompleteness = await this.analyzeAPICompleteness();

      return {
        coverage: basicCoverage.coverage,
        missingDocs: basicCoverage.missingDocs,
        undocumentedExports,
        outdatedDocs,
        missingReadmeSections,
        apiCompleteness
      };
    } catch {
      // Return default enhanced structure on error
      return {
        coverage: 0,
        missingDocs: [],
        undocumentedExports: [],
        outdatedDocs: [],
        missingReadmeSections: [],
        apiCompleteness: {
          percentage: 0,
          details: {
            totalEndpoints: 0,
            documentedEndpoints: 0,
            undocumentedItems: [],
            wellDocumentedExamples: [],
            commonIssues: []
          }
        }
      };
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

  // ============================================================================
  // Enhanced Documentation Analysis Utility Methods
  // ============================================================================

  /**
   * Calculate basic documentation coverage (backward compatibility)
   */
  private async calculateBasicDocumentationCoverage(): Promise<{ coverage: number; missingDocs: string[] }> {
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

      return { coverage, missingDocs };
    } catch {
      return { coverage: 0, missingDocs: [] };
    }
  }

  /**
   * Find exports that are missing JSDoc documentation
   */
  private async findUndocumentedExports(): Promise<UndocumentedExport[]> {
    const undocumentedExports: UndocumentedExport[] = [];

    try {
      // Find TypeScript/JavaScript files that likely contain exports
      const { stdout: sourceFiles } = await this.execAsync('find . -name "*.ts" -o -name "*.js" | grep -v test | grep -v node_modules | head -50');
      const files = sourceFiles.split('\n').filter(line => line.trim());

      for (const file of files.slice(0, 20)) { // Limit to avoid performance issues
        try {
          const content = await fs.readFile(join(this.projectPath, file), 'utf-8');
          const lines = content.split('\n');

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const prevLine = i > 0 ? lines[i - 1] : '';

            // Look for export patterns
            const exportMatch = line.match(/^export\s+(function|class|interface|type|const|let|var|enum|namespace)\s+(\w+)/);
            if (exportMatch) {
              const type = exportMatch[1] as UndocumentedExport['type'];
              const name = exportMatch[2];

              // Check if there's JSDoc comment above
              const hasJSDoc = prevLine.includes('*/') || (i > 1 && lines[i - 2].includes('/**'));

              if (!hasJSDoc) {
                undocumentedExports.push({
                  file: file.replace(/^\.\//, ''),
                  name,
                  type,
                  line: i + 1,
                  isPublic: !file.includes('internal') && !name.startsWith('_')
                });
              }
            }
          }
        } catch {
          // Skip files that can't be read
        }
      }
    } catch {
      // Ignore errors in finding undocumented exports
    }

    return undocumentedExports.slice(0, 50); // Limit results
  }

  /**
   * Find outdated documentation
   */
  private async findOutdatedDocumentation(): Promise<OutdatedDocumentation[]> {
    const outdatedDocs: OutdatedDocumentation[] = [];

    try {
      // Find documentation files
      const { stdout: docFiles } = await this.execAsync('find . -name "*.md" -o -name "*.rst" | grep -v node_modules | head -20');
      const files = docFiles.split('\n').filter(line => line.trim());

      for (const file of files) {
        try {
          const content = await fs.readFile(join(this.projectPath, file), 'utf-8');
          const lines = content.split('\n');

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Look for deprecated API references
            if (line.includes('@deprecated') || line.includes('DEPRECATED')) {
              outdatedDocs.push({
                file: file.replace(/^\.\//, ''),
                type: 'deprecated-api',
                description: 'Contains references to deprecated APIs',
                line: i + 1,
                severity: 'medium'
              });
            }

            // Look for broken links (simple heuristic)
            if (line.includes('http') && (line.includes('404') || line.includes('broken'))) {
              outdatedDocs.push({
                file: file.replace(/^\.\//, ''),
                type: 'broken-link',
                description: 'Potentially broken external link',
                line: i + 1,
                severity: 'low'
              });
            }

            // Look for version mismatches (very basic)
            const versionMatch = line.match(/v?(\d+\.\d+\.\d+)/);
            if (versionMatch && line.includes('version')) {
              // This is a simplified check - in a real implementation,
              // you'd compare against package.json version
              const version = versionMatch[1];
              if (version.startsWith('0.') || version.startsWith('1.')) {
                outdatedDocs.push({
                  file: file.replace(/^\.\//, ''),
                  type: 'version-mismatch',
                  description: `References old version ${version}`,
                  line: i + 1,
                  suggestion: 'Update to current version',
                  severity: 'low'
                });
              }
            }
          }
        } catch {
          // Skip files that can't be read
        }
      }
    } catch {
      // Ignore errors in finding outdated docs
    }

    return outdatedDocs.slice(0, 30); // Limit results
  }

  /**
   * Find missing README sections
   */
  private async findMissingReadmeSections(): Promise<MissingReadmeSection[]> {
    const missingReadmeSections: MissingReadmeSection[] = [];

    try {
      // Find README files
      const { stdout: readmeFiles } = await this.execAsync('find . -name "README*" -o -name "readme*" | head -5');
      const files = readmeFiles.split('\n').filter(line => line.trim());

      if (files.length === 0) {
        // No README files found - return all required sections as missing
        const requiredSections: Array<{ section: ReadmeSection; priority: 'required' | 'recommended' | 'optional'; description: string }> = [
          { section: 'title', priority: 'required', description: 'Project title and brief description' },
          { section: 'description', priority: 'required', description: 'Detailed project description' },
          { section: 'installation', priority: 'required', description: 'Installation instructions' },
          { section: 'usage', priority: 'required', description: 'Usage examples and instructions' }
        ];

        return requiredSections.map(item => ({
          section: item.section,
          priority: item.priority,
          description: item.description
        }));
      }

      // Analyze existing README files
      for (const file of files) {
        try {
          const content = await fs.readFile(join(this.projectPath, file), 'utf-8');
          const lowerContent = content.toLowerCase();

          // Define standard sections with their indicators
          const sectionChecks: Array<{ section: ReadmeSection; indicators: string[]; priority: 'required' | 'recommended' | 'optional'; description: string }> = [
            { section: 'installation', indicators: ['install', 'setup', 'getting started'], priority: 'required', description: 'Installation and setup instructions' },
            { section: 'usage', indicators: ['usage', 'how to use', 'example', 'getting started'], priority: 'required', description: 'Usage examples and basic instructions' },
            { section: 'api', indicators: ['api', 'reference', 'methods', 'functions'], priority: 'recommended', description: 'API documentation and reference' },
            { section: 'contributing', indicators: ['contribut', 'develop'], priority: 'recommended', description: 'Contributing guidelines' },
            { section: 'license', indicators: ['license', 'copyright'], priority: 'recommended', description: 'License information' },
            { section: 'testing', indicators: ['test', 'testing'], priority: 'optional', description: 'Testing instructions and guidelines' }
          ];

          for (const check of sectionChecks) {
            const hasSection = check.indicators.some(indicator => lowerContent.includes(indicator));
            if (!hasSection) {
              missingReadmeSections.push({
                section: check.section,
                priority: check.priority,
                description: check.description
              });
            }
          }
        } catch {
          // Skip files that can't be read
        }
      }
    } catch {
      // Ignore errors in finding missing README sections
    }

    return missingReadmeSections;
  }

  /**
   * Analyze API documentation completeness
   */
  private async analyzeAPICompleteness(): Promise<APICompleteness> {
    try {
      const undocumentedItems: Array<{ name: string; file: string; type: 'endpoint' | 'method' | 'function' | 'class'; line?: number }> = [];
      const wellDocumentedExamples: string[] = [];
      const commonIssues: string[] = [];

      // Find source files
      const { stdout: sourceFiles } = await this.execAsync('find . -name "*.ts" -o -name "*.js" | grep -v test | grep -v node_modules | head -30');
      const files = sourceFiles.split('\n').filter(line => line.trim());

      let totalEndpoints = 0;
      let documentedEndpoints = 0;

      for (const file of files.slice(0, 15)) { // Limit for performance
        try {
          const content = await fs.readFile(join(this.projectPath, file), 'utf-8');
          const lines = content.split('\n');

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const prevLine = i > 0 ? lines[i - 1] : '';
            const prevPrevLine = i > 1 ? lines[i - 2] : '';

            // Look for function/method definitions
            const functionMatch = line.match(/(export\s+)?(async\s+)?function\s+(\w+)|(\w+)\s*\([^)]*\)\s*[:{]|(class\s+\w+)/);
            if (functionMatch) {
              totalEndpoints++;

              const hasJSDoc = prevLine.includes('*/') || prevPrevLine.includes('/**');
              const hasComment = prevLine.includes('//') || line.includes('//');

              if (hasJSDoc) {
                documentedEndpoints++;
                // Check for well-documented example
                if (prevPrevLine.includes('@example') || prevLine.includes('@param')) {
                  wellDocumentedExamples.push(`${file}:${i + 1}`);
                }
              } else {
                const name = functionMatch[3] || functionMatch[4] || 'class';
                undocumentedItems.push({
                  name,
                  file: file.replace(/^\.\//, ''),
                  type: functionMatch[5] ? 'class' : 'function',
                  line: i + 1
                });

                if (!hasComment) {
                  commonIssues.push('Missing JSDoc comments');
                }
              }
            }
          }
        } catch {
          // Skip files that can't be read
        }
      }

      // Remove duplicate common issues
      const uniqueCommonIssues = [...new Set(commonIssues)];

      const percentage = totalEndpoints > 0 ? Math.round((documentedEndpoints / totalEndpoints) * 100) : 0;

      return {
        percentage,
        details: {
          totalEndpoints,
          documentedEndpoints,
          undocumentedItems: undocumentedItems.slice(0, 20), // Limit results
          wellDocumentedExamples: wellDocumentedExamples.slice(0, 10),
          commonIssues: uniqueCommonIssues.slice(0, 5)
        }
      };
    } catch {
      return {
        percentage: 0,
        details: {
          totalEndpoints: 0,
          documentedEndpoints: 0,
          undocumentedItems: [],
          wellDocumentedExamples: [],
          commonIssues: []
        }
      };
    }
  }

  private async execAsync(command: string): Promise<{ stdout: string; stderr: string }> {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execPromise = promisify(exec);

    return execPromise(command, { cwd: this.projectPath });
  }
}

// Export the new dependency types for use by other modules
export type {
  OutdatedDependency,
  SecurityVulnerability,
  DeprecatedPackage,
  UpdateType,
  VulnerabilitySeverity,
};