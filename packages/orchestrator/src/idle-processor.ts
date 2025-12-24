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
  ReadmeSection,
  validateDeprecatedTags,
  DetectorType,
  DetectorFinding,
  VersionMismatchFinding,
  StaleCommentFinding,
  TestingAntiPattern
} from '@apexcli/core';
import { TaskStore } from './store';
import { IdleTaskGenerator } from './idle-task-generator';
import { CrossReferenceValidator } from './analyzers/cross-reference-validator';

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
  /** Comprehensive test analysis including coverage, untested exports, and anti-patterns */
  testAnalysis: {
    branchCoverage: {
      /** Coverage percentage (0-100) */
      percentage: number;
      /** List of uncovered code branches */
      uncoveredBranches: Array<{
        /** File path relative to project root */
        file: string;
        /** Line number where the branch starts */
        line: number;
        /** Type of branch (if/else, switch case, try/catch, etc.) */
        type: 'if' | 'else' | 'switch' | 'catch' | 'ternary' | 'logical';
        /** Brief description of the uncovered branch */
        description: string;
      }>;
    };
    /** Exports that lack test coverage */
    untestedExports: Array<{
      /** File path relative to project root */
      file: string;
      /** Name of the exported symbol */
      exportName: string;
      /** Type of export (function, class, interface, etc.) */
      exportType: 'function' | 'class' | 'interface' | 'type' | 'variable' | 'const' | 'enum' | 'namespace';
      /** Line number where the export is defined */
      line?: number;
      /** Whether this is a public API export */
      isPublic: boolean;
    }>;
    /** Missing integration tests for critical paths */
    missingIntegrationTests: Array<{
      /** Description of the critical path or user journey */
      criticalPath: string;
      /** Detailed description of what should be tested */
      description: string;
      /** Priority level based on business impact */
      priority: 'low' | 'medium' | 'high' | 'critical';
      /** Related files or components involved in this path */
      relatedFiles?: string[];
    }>;
    /** Testing anti-patterns found in the codebase */
    antiPatterns: Array<{
      /** File path where the anti-pattern was found */
      file: string;
      /** Line number where the anti-pattern occurs */
      line: number;
      /** Type of anti-pattern detected */
      type: 'brittle-test' | 'test-pollution' | 'mystery-guest' | 'eager-test' | 'assertion-roulette' | 'slow-test' | 'flaky-test' | 'test-code-duplication' | 'no-assertion' | 'commented-out' | 'console-only' | 'empty-test' | 'hardcoded-timeout';
      /** Detailed description of the anti-pattern */
      description: string;
      /** Severity of the anti-pattern */
      severity: 'low' | 'medium' | 'high';
      /** Suggested fix or improvement */
      suggestion?: string;
    }>;
  };
}

export interface IdleProcessorEvents {
  // Existing events
  'analysis:started': () => void;
  'analysis:completed': (analysis: ProjectAnalysis) => void;
  'tasks:generated': (tasks: IdleTask[]) => void;
  'task:suggested': (task: IdleTask) => void;

  // New detector finding events
  'detector:finding': (finding: DetectorFinding) => void;
  'detector:outdated-docs:found': (findings: OutdatedDocumentation[]) => void;
  'detector:version-mismatch:found': (findings: VersionMismatchFinding[]) => void;
  'detector:stale-comment:found': (findings: StaleCommentFinding[]) => void;
  'detector:code-smell:found': (findings: CodeSmell[]) => void;
  'detector:complexity-hotspot:found': (findings: ComplexityHotspot[]) => void;
  'detector:duplicate-code:found': (findings: DuplicatePattern[]) => void;
  'detector:undocumented-export:found': (findings: UndocumentedExport[]) => void;
  'detector:missing-readme-section:found': (findings: MissingReadmeSection[]) => void;
  'detector:security-vulnerability:found': (findings: SecurityVulnerability[]) => void;
  'detector:deprecated-dependency:found': (findings: DeprecatedPackage[]) => void;
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

    // Initialize the IdleTaskGenerator with enhanced capabilities and strategy weights from config
    this.taskGenerator = IdleTaskGenerator.createEnhanced(
      projectPath,
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
      testAnalysis: await this.analyzeTestAnalysis(),
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
    const securityIssues: SecurityVulnerability[] = [];

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

      // Enhanced: Run npm audit for security vulnerabilities
      try {
        const { SecurityVulnerabilityParser } = await import('./utils/security-vulnerability-parser.js');

        // Run npm audit and capture JSON output
        const { stdout } = await this.execAsync('npm audit --json 2>/dev/null || echo "{}"');
        const auditData = JSON.parse(stdout);

        // Parse using the new utility
        const vulnerabilities = SecurityVulnerabilityParser.parseNpmAuditOutput(auditData);
        securityIssues.push(...vulnerabilities);

        // Populate legacy field for backward compatibility
        for (const vuln of vulnerabilities) {
          const legacyEntry = `${vuln.name}@${vuln.affectedVersions} (${vuln.cveId})`;
          security.push(legacyEntry);
        }
      } catch (auditError) {
        // npm audit not available or failed - try fallback approach
        try {
          // Simple pattern matching for known vulnerability indicators in package.json
          for (const [name, version] of Object.entries(dependencies)) {
            if (typeof version === 'string') {
              // Check for packages that commonly have security issues in old versions
              const vulnerablePatterns = [
                { name: 'lodash', versions: ['<4.17.21'], cve: 'CVE-2021-23337' },
                { name: 'axios', versions: ['<0.21.2'], cve: 'CVE-2021-3749' },
                { name: 'node-forge', versions: ['<1.0.0'], cve: 'CVE-2022-24771' },
                { name: 'minimist', versions: ['<1.2.6'], cve: 'CVE-2021-44906' },
              ];

              for (const pattern of vulnerablePatterns) {
                if (name === pattern.name) {
                  // Simple version check (this is a basic fallback)
                  const cleanVersion = version.replace(/[^\d.]/g, '');
                  security.push(`${name}@${version} (${pattern.cve})`);

                  const { SecurityVulnerabilityParser } = await import('./utils/security-vulnerability-parser.js');
                  const fallbackVuln = SecurityVulnerabilityParser.createVulnerability({
                    name,
                    cveId: pattern.cve,
                    severity: 'medium', // Conservative default
                    affectedVersions: version,
                    description: `Potential security vulnerability in ${name}`,
                  });
                  securityIssues.push(fallbackVuln);
                  break;
                }
              }
            }
          }
        } catch {
          // Fallback failed as well, continue without security analysis
        }
      }
    } catch {
      // No package.json or can't read it
    }

    // Emit detector events for dependency findings
    if (securityIssues.length > 0) {
      this.emit('detector:security-vulnerability:found', securityIssues);
      // Also emit individual findings
      securityIssues.forEach(finding => {
        this.emit('detector:finding', {
          detectorType: 'security-vulnerability',
          severity: finding.severity === 'critical' ? 'critical' : finding.severity === 'high' ? 'high' : finding.severity === 'low' ? 'low' : 'medium',
          file: 'package.json',
          description: `Security vulnerability in ${finding.name}: ${finding.description}`,
          metadata: {
            cveId: finding.cveId,
            affectedVersions: finding.affectedVersions,
            packageName: finding.name
          }
        });
      });
    }

    return { outdated, security, securityIssues };
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
        // Updated threshold: large class detection (>500 lines or >20 methods)
        if (hotspot.lineCount > 500) {
          const methodCount = await this.estimateMethodCount(hotspot.file);
          if (hotspot.lineCount > 500 || methodCount > 20) {
            codeSmells.push({
              file: hotspot.file,
              type: 'large-class',
              severity: 'high',
              details: `File has ${hotspot.lineCount} lines${methodCount > 20 ? ` and ${methodCount} methods` : ''}, consider breaking into smaller modules`
            });
          }
        }

        // Updated threshold: long method detection (>50 lines)
        const longMethods = await this.detectLongMethods(hotspot.file);
        for (const method of longMethods) {
          codeSmells.push({
            file: hotspot.file,
            type: 'long-method',
            severity: 'medium',
            details: `Method '${method.name}' has ${method.lines} lines (line ${method.startLine}), consider refactoring`
          });
        }
      }

      // Deep nesting detection
      const deepNestingSmells = await this.detectDeepNesting();
      codeSmells.push(...deepNestingSmells);

      // Duplicate code pattern detection
      const duplicatePatterns = await this.detectDuplicateCodePatterns();
      duplicatedCode.push(...duplicatePatterns);
    } catch {
      // Ignore errors in code quality analysis
    }

    // Emit detector events for code quality findings
    if (codeSmells.length > 0) {
      this.emit('detector:code-smell:found', codeSmells);
      // Also emit individual findings
      codeSmells.forEach(finding => {
        this.emit('detector:finding', {
          detectorType: 'code-smell',
          severity: finding.severity === 'high' ? 'high' : finding.severity === 'low' ? 'low' : 'medium',
          file: finding.file,
          description: `${finding.type}: ${finding.details}`,
          metadata: { type: finding.type, details: finding.details }
        });
      });
    }

    if (complexityHotspots.length > 0) {
      this.emit('detector:complexity-hotspot:found', complexityHotspots);
      // Also emit individual findings
      complexityHotspots.forEach(finding => {
        this.emit('detector:finding', {
          detectorType: 'complexity-hotspot',
          severity: finding.cyclomaticComplexity > 20 || finding.cognitiveComplexity > 25 ? 'high' : 'medium',
          file: finding.file,
          description: `Complex file: ${finding.lineCount} lines, cyclomatic complexity: ${finding.cyclomaticComplexity}, cognitive complexity: ${finding.cognitiveComplexity}`,
          metadata: {
            cyclomaticComplexity: finding.cyclomaticComplexity,
            cognitiveComplexity: finding.cognitiveComplexity,
            lineCount: finding.lineCount
          }
        });
      });
    }

    if (duplicatedCode.length > 0) {
      this.emit('detector:duplicate-code:found', duplicatedCode);
      // Also emit individual findings
      duplicatedCode.forEach(finding => {
        this.emit('detector:finding', {
          detectorType: 'duplicate-code',
          severity: finding.similarity > 0.9 ? 'high' : finding.similarity > 0.7 ? 'medium' : 'low',
          file: finding.locations[0] || 'unknown',
          description: `Duplicate pattern found in ${finding.locations.length} locations: ${finding.pattern.substring(0, 100)}`,
          metadata: { pattern: finding.pattern, locations: finding.locations, similarity: finding.similarity }
        });
      });
    }

    return {
      lintIssues,
      duplicatedCode,
      complexityHotspots,
      codeSmells,
    };
  }

  /**
   * Estimates the number of methods in a file by counting function/method declarations
   */
  private async estimateMethodCount(filePath: string): Promise<number> {
    try {
      const fullPath = join(this.projectPath, filePath);
      const content = await fs.readFile(fullPath, 'utf-8');
      // Count method patterns: function declarations, arrow functions, class methods
      const methodPatterns = [
        /^\s*(?:public|private|protected|static)?\s*\w+\s*\(/gm, // class methods
        /^\s*function\s+\w+\s*\(/gm, // function declarations
        /^\s*(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/gm, // arrow functions
        /^\s*\w+:\s*(?:async\s+)?function\s*\(/gm // object method shorthand
      ];

      let totalMethods = 0;
      for (const pattern of methodPatterns) {
        const matches = content.match(pattern);
        totalMethods += matches ? matches.length : 0;
      }

      return totalMethods;
    } catch {
      return 0; // If file cannot be read, assume 0 methods
    }
  }

  /**
   * Detects long methods (>50 lines) in a file
   */
  private async detectLongMethods(filePath: string): Promise<Array<{ name: string; lines: number; startLine: number }>> {
    try {
      const fullPath = join(this.projectPath, filePath);
      const content = await fs.readFile(fullPath, 'utf-8');
      const lines = content.split('\n');
      const longMethods: Array<{ name: string; lines: number; startLine: number }> = [];

      let currentMethod: { name: string; startLine: number; braceLevel: number } | null = null;
      let braceLevel = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();

        // Count braces to track method boundaries
        braceLevel += (line.match(/\{/g) || []).length;
        braceLevel -= (line.match(/\}/g) || []).length;

        // Detect method start patterns
        const methodMatch = trimmedLine.match(/(?:function\s+(\w+)|(\w+)\s*\(|(\w+):\s*(?:async\s+)?function)/);
        if (methodMatch && trimmedLine.includes('{')) {
          const methodName = methodMatch[1] || methodMatch[2] || methodMatch[3] || 'anonymous';
          currentMethod = { name: methodName, startLine: i + 1, braceLevel };
        }

        // Check if method ended and calculate length
        if (currentMethod && braceLevel < currentMethod.braceLevel) {
          const methodLength = i - currentMethod.startLine + 1;
          if (methodLength > 50) {
            longMethods.push({
              name: currentMethod.name,
              lines: methodLength,
              startLine: currentMethod.startLine
            });
          }
          currentMethod = null;
        }
      }

      return longMethods;
    } catch {
      return []; // If file cannot be analyzed, return empty array
    }
  }

  /**
   * Detects deep nesting (>4 levels) in TypeScript/JavaScript files
   */
  private async detectDeepNesting(): Promise<CodeSmell[]> {
    try {
      const { stdout } = await this.execAsync('find . -name "*.ts" -o -name "*.js" | grep -v node_modules | head -20');
      const files = stdout.split('\n').filter(line => line.trim());
      const deepNestingSmells: CodeSmell[] = [];

      for (const filePath of files) {
        const relativePath = filePath.replace('./', '');
        const nestingIssues = await this.analyzeFileNesting(filePath);

        for (const issue of nestingIssues) {
          deepNestingSmells.push({
            file: relativePath,
            type: 'deep-nesting',
            severity: issue.level > 6 ? 'high' : 'medium',
            details: `Deep nesting detected: ${issue.level} levels at line ${issue.line} (${issue.context})`
          });
        }
      }

      return deepNestingSmells;
    } catch {
      return []; // If analysis fails, return empty array
    }
  }

  /**
   * Analyzes nesting levels in a specific file
   */
  private async analyzeFileNesting(filePath: string): Promise<Array<{ level: number; line: number; context: string }>> {
    try {
      const fullPath = filePath.startsWith('./') ? join(this.projectPath, filePath.slice(2)) : filePath;
      const content = await fs.readFile(fullPath, 'utf-8');
      const lines = content.split('\n');
      const nestingIssues: Array<{ level: number; line: number; context: string }> = [];

      let nestingLevel = 0;
      const nestingStack: string[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();

        // Skip comments and empty lines
        if (trimmedLine.startsWith('//') || trimmedLine.startsWith('/*') || !trimmedLine) {
          continue;
        }

        // Track nesting structures
        const openBraces = (line.match(/\{/g) || []).length;
        const closeBraces = (line.match(/\}/g) || []).length;

        // Identify nesting context (if/for/while/function/class/try/catch)
        if (trimmedLine.match(/(?:if|for|while|function|class|try|catch|switch)\s*\(|(?:if|for|while|function|class|try|catch|switch)\s*\{|=>\s*\{/)) {
          const context = this.extractNestingContext(trimmedLine);
          nestingStack.push(context);
        }

        // Update nesting level
        nestingLevel += openBraces;

        // Check for deep nesting (>4 levels)
        if (nestingLevel > 4) {
          nestingIssues.push({
            level: nestingLevel,
            line: i + 1,
            context: nestingStack.slice(-3).join(' > ') || 'unknown context'
          });
        }

        // Decrease nesting level for closing braces
        nestingLevel -= closeBraces;

        // Pop from stack for each closing brace
        for (let j = 0; j < closeBraces; j++) {
          nestingStack.pop();
        }

        // Ensure nesting level doesn't go negative
        nestingLevel = Math.max(0, nestingLevel);
      }

      return nestingIssues;
    } catch {
      return []; // If file cannot be analyzed, return empty array
    }
  }

  /**
   * Extracts the nesting context from a line of code
   */
  private extractNestingContext(line: string): string {
    if (line.includes('if')) return 'if';
    if (line.includes('for')) return 'for';
    if (line.includes('while')) return 'while';
    if (line.includes('function')) return 'function';
    if (line.includes('class')) return 'class';
    if (line.includes('try')) return 'try';
    if (line.includes('catch')) return 'catch';
    if (line.includes('switch')) return 'switch';
    if (line.includes('=>')) return 'arrow-function';
    return 'block';
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

      // Add stale comment detection
      const staleComments = await this.findStaleComments();

      // Add version mismatch detection
      const versionMismatches = await this.findVersionMismatches();

      // Emit detector events for findings
      if (undocumentedExports.length > 0) {
        this.emit('detector:undocumented-export:found', undocumentedExports);
        // Also emit individual findings
        undocumentedExports.forEach(finding => {
          this.emit('detector:finding', {
            detectorType: 'undocumented-export',
            severity: 'medium',
            file: finding.file,
            line: finding.line,
            description: `Undocumented ${finding.type} '${finding.name}'`,
            metadata: { exportType: finding.type, name: finding.name, isPublic: finding.isPublic }
          });
        });
      }

      if (outdatedDocs.length > 0) {
        this.emit('detector:outdated-docs:found', outdatedDocs);
        // Also emit individual findings
        outdatedDocs.forEach(finding => {
          this.emit('detector:finding', {
            detectorType: 'outdated-docs',
            severity: finding.severity === 'high' ? 'high' : finding.severity === 'low' ? 'low' : 'medium',
            file: finding.file,
            line: finding.line,
            description: finding.description,
            metadata: { type: finding.type, suggestion: finding.suggestion }
          });
        });
      }

      if (missingReadmeSections.length > 0) {
        this.emit('detector:missing-readme-section:found', missingReadmeSections);
        // Also emit individual findings
        missingReadmeSections.forEach(finding => {
          this.emit('detector:finding', {
            detectorType: 'missing-readme-section',
            severity: finding.priority === 'required' ? 'high' : finding.priority === 'recommended' ? 'medium' : 'low',
            file: 'README.md',
            description: `Missing ${finding.section} section: ${finding.description}`,
            metadata: { section: finding.section, priority: finding.priority }
          });
        });
      }

      if (staleComments.length > 0) {
        // Convert to StaleCommentFinding format for the specific event
        const staleCommentFindings: StaleCommentFinding[] = staleComments
          .filter(doc => doc.type === 'stale-reference')
          .map(doc => ({
            file: doc.file,
            line: doc.line || 0,
            text: doc.description,
            type: 'TODO' as const, // Default type
            daysSinceAdded: 30 // Default age
          }));

        if (staleCommentFindings.length > 0) {
          this.emit('detector:stale-comment:found', staleCommentFindings);
        }
      }

      if (versionMismatches.length > 0) {
        // Convert to VersionMismatchFinding format for the specific event
        const versionMismatchFindings: VersionMismatchFinding[] = versionMismatches
          .filter(doc => doc.type === 'version-mismatch')
          .map(doc => {
            // Parse version information from description or use defaults
            const foundVersion = doc.description.match(/Found version ([^\s]+)/)?.[1] || 'unknown';
            const expectedVersion = doc.description.match(/expected ([^\s]+)/)?.[1] || 'unknown';

            return {
              file: doc.file,
              line: doc.line || 0,
              foundVersion,
              expectedVersion,
              lineContent: doc.suggestion || doc.description
            };
          });

        if (versionMismatchFindings.length > 0) {
          this.emit('detector:version-mismatch:found', versionMismatchFindings);
        }
      }

      return {
        coverage: basicCoverage.coverage,
        missingDocs: basicCoverage.missingDocs,
        undocumentedExports,
        outdatedDocs: [...outdatedDocs, ...staleComments, ...versionMismatches],
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

  private async analyzeTestAnalysis(): Promise<ProjectAnalysis['testAnalysis']> {
    try {
      // Analyze branch coverage with enhanced analysis
      const branchCoverage = await this.analyzeTestBranchCoverage();

      // Find untested exports with enhanced analysis
      const untestedExports = await this.analyzeUntestedExports();

      // Identify missing integration tests using comprehensive analysis
      const missingIntegrationTests = await this.analyzeMissingIntegrationTests();

      // Detect testing anti-patterns
      const existingAntiPatterns = await this.detectTestingAntiPatterns();
      const additionalAntiPatterns = await this.analyzeTestAntiPatterns();

      // Merge results from both anti-pattern detection methods
      const antiPatterns = [...existingAntiPatterns, ...additionalAntiPatterns];

      return {
        branchCoverage,
        untestedExports,
        missingIntegrationTests,
        antiPatterns,
      };
    } catch {
      // Return default values on error
      return {
        branchCoverage: {
          percentage: 0,
          uncoveredBranches: [],
        },
        untestedExports: [],
        missingIntegrationTests: [],
        antiPatterns: [],
      };
    }
  }

  /**
   * Advanced branch coverage analysis that identifies files with tests but uncovered branches,
   * detects edge cases not covered (null/undefined checks, error handlers, boundary conditions)
   */
  private async analyzeTestBranchCoverage(): Promise<ProjectAnalysis['testAnalysis']['branchCoverage']> {
    try {
      const uncoveredBranches: Array<{
        file: string;
        line: number;
        type: 'if' | 'else' | 'switch' | 'catch' | 'ternary' | 'logical';
        description: string;
      }> = [];

      // Get source files that have corresponding test files
      const sourceFiles = await this.getFilesWithTests();

      let totalBranches = 0;
      let uncoveredBranchCount = 0;

      for (const sourceFile of sourceFiles) {
        try {
          const content = await this.readFileContent(sourceFile);
          const lines = content.split('\n');

          // Analyze each line for branch conditions
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmedLine = line.trim();

            if (!trimmedLine || trimmedLine.startsWith('//') || trimmedLine.startsWith('/*')) {
              continue; // Skip empty lines and comments
            }

            const branchAnalysis = this.analyzeBranchesInLine(trimmedLine, sourceFile, i + 1);
            totalBranches += branchAnalysis.totalBranches;

            // Check if these branches have corresponding test coverage
            const hasTestCoverage = await this.checkBranchTestCoverage(sourceFile, branchAnalysis.branches);

            for (const branch of branchAnalysis.branches) {
              if (!hasTestCoverage.some(covered => covered.line === branch.line && covered.type === branch.type)) {
                uncoveredBranches.push({
                  file: sourceFile,
                  line: branch.line,
                  type: branch.type,
                  description: branch.description
                });
                uncoveredBranchCount++;
              }
            }
          }

          // Add specific edge case detection
          const edgeCases = await this.detectUncoveredEdgeCases(sourceFile, content);
          uncoveredBranches.push(...edgeCases);
          uncoveredBranchCount += edgeCases.length;
          totalBranches += edgeCases.length;

        } catch {
          // Skip files that can't be analyzed
          continue;
        }
      }

      // Calculate coverage percentage
      const coveredBranches = totalBranches - uncoveredBranchCount;
      const percentage = totalBranches > 0 ? Math.round((coveredBranches / totalBranches) * 100) : 100;

      return {
        percentage: Math.max(0, Math.min(100, percentage)),
        uncoveredBranches: uncoveredBranches.slice(0, 50) // Limit results for performance
      };

    } catch (error) {
      // Fallback to simple analysis if advanced analysis fails
      return await this.analyzeBranchCoverage();
    }
  }

  /**
   * Get source files that have corresponding test files
   */
  private async getFilesWithTests(): Promise<string[]> {
    try {
      // Find all source files
      const { stdout } = await this.execAsync('find . -name "*.ts" -o -name "*.js" | grep -v test | grep -v spec | grep -v node_modules | head -30');
      const sourceFiles = stdout.split('\n').filter(line => line.trim()).map(f => f.replace(/^\.\//, ''));

      const filesWithTests: string[] = [];

      for (const sourceFile of sourceFiles) {
        // Check if corresponding test file exists
        const hasTest = await this.checkIfExportHasTest(sourceFile, ''); // Using existing method
        if (hasTest || await this.hasCorrespondingTestFile(sourceFile)) {
          filesWithTests.push(sourceFile);
        }
      }

      return filesWithTests.slice(0, 20); // Limit for performance
    } catch {
      return [];
    }
  }

  /**
   * Check if a source file has a corresponding test file
   */
  private async hasCorrespondingTestFile(sourceFile: string): Promise<boolean> {
    try {
      const testPatterns = [
        sourceFile.replace(/\.(ts|js)$/, '.test.$1'),
        sourceFile.replace(/\.(ts|js)$/, '.spec.$1'),
        sourceFile.replace(/src\//, 'test/').replace(/\.(ts|js)$/, '.test.$1'),
        sourceFile.replace(/src\//, '__tests__/').replace(/\.(ts|js)$/, '.test.$1')
      ];

      for (const testPattern of testPatterns) {
        try {
          const testContent = await this.readFileContent(testPattern);
          if (testContent.length > 10) { // Basic check that test file exists and has content
            return true;
          }
        } catch {
          continue;
        }
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Analyze branches in a single line of code
   */
  private analyzeBranchesInLine(line: string, file: string, lineNumber: number): {
    totalBranches: number;
    branches: Array<{
      line: number;
      type: 'if' | 'else' | 'switch' | 'catch' | 'ternary' | 'logical';
      description: string;
    }>;
  } {
    const branches: Array<{
      line: number;
      type: 'if' | 'else' | 'switch' | 'catch' | 'ternary' | 'logical';
      description: string;
    }> = [];

    // Check for if statements
    if (/\bif\s*\(/.test(line)) {
      branches.push({
        line: lineNumber,
        type: 'if',
        description: `If condition: ${line.trim().substring(0, 60)}`
      });
    }

    // Check for else statements
    if (/\belse\b/.test(line) && !line.includes('else if')) {
      branches.push({
        line: lineNumber,
        type: 'else',
        description: `Else branch: ${line.trim().substring(0, 60)}`
      });
    }

    // Check for switch statements
    if (/\bswitch\s*\(/.test(line)) {
      branches.push({
        line: lineNumber,
        type: 'switch',
        description: `Switch statement: ${line.trim().substring(0, 60)}`
      });
    }

    // Check for catch blocks
    if (/\bcatch\s*\(/.test(line)) {
      branches.push({
        line: lineNumber,
        type: 'catch',
        description: `Error handler: ${line.trim().substring(0, 60)}`
      });
    }

    // Check for ternary operators
    if (/\?.*:/.test(line) && !line.includes('//')) {
      branches.push({
        line: lineNumber,
        type: 'ternary',
        description: `Ternary operator: ${line.trim().substring(0, 60)}`
      });
    }

    // Check for logical operators (&&, ||)
    if (/&&|\|\|/.test(line) && !line.includes('//')) {
      branches.push({
        line: lineNumber,
        type: 'logical',
        description: `Logical operator: ${line.trim().substring(0, 60)}`
      });
    }

    return {
      totalBranches: branches.length,
      branches
    };
  }

  /**
   * Check if branches have test coverage by analyzing test files
   */
  private async checkBranchTestCoverage(sourceFile: string, branches: Array<{
    line: number;
    type: 'if' | 'else' | 'switch' | 'catch' | 'ternary' | 'logical';
    description: string;
  }>): Promise<Array<{ line: number; type: string; covered: boolean }>> {
    try {
      const testFiles = await this.getTestFilesForSource(sourceFile);
      const coverage: Array<{ line: number; type: string; covered: boolean }> = [];

      for (const branch of branches) {
        let isCovered = false;

        // Simple heuristic: if test files contain references to the conditions or expected behaviors
        for (const testFile of testFiles) {
          const testContent = await this.readFileContent(testFile);

          // Look for test patterns that might cover these branches
          const hasConditionalTests = this.hasConditionalTestPatterns(testContent, branch);
          if (hasConditionalTests) {
            isCovered = true;
            break;
          }
        }

        coverage.push({
          line: branch.line,
          type: branch.type,
          covered: isCovered
        });
      }

      return coverage;
    } catch {
      // If we can't determine coverage, assume it's covered to avoid false positives
      return branches.map(branch => ({
        line: branch.line,
        type: branch.type,
        covered: true
      }));
    }
  }

  /**
   * Get test files that might test the given source file
   */
  private async getTestFilesForSource(sourceFile: string): Promise<string[]> {
    try {
      const testPatterns = [
        sourceFile.replace(/\.(ts|js)$/, '.test.$1'),
        sourceFile.replace(/\.(ts|js)$/, '.spec.$1'),
        sourceFile.replace(/src\//, 'test/').replace(/\.(ts|js)$/, '.test.$1'),
        sourceFile.replace(/src\//, '__tests__/').replace(/\.(ts|js)$/, '.test.$1')
      ];

      const existingTestFiles: string[] = [];

      for (const testPattern of testPatterns) {
        try {
          const content = await this.readFileContent(testPattern);
          if (content.length > 10) {
            existingTestFiles.push(testPattern);
          }
        } catch {
          continue;
        }
      }

      return existingTestFiles;
    } catch {
      return [];
    }
  }

  /**
   * Check if test content has patterns that suggest branch coverage
   */
  private hasConditionalTestPatterns(testContent: string, branch: {
    line: number;
    type: 'if' | 'else' | 'switch' | 'catch' | 'ternary' | 'logical';
    description: string
  }): boolean {
    const testLower = testContent.toLowerCase();

    // Look for test patterns that suggest branch testing
    switch (branch.type) {
      case 'if':
      case 'else':
        return testLower.includes('when') || testLower.includes('should') ||
               testLower.includes('true') || testLower.includes('false') ||
               testLower.includes('condition') || testLower.includes('valid') ||
               testLower.includes('invalid');

      case 'switch':
        return testLower.includes('case') || testLower.includes('switch') ||
               testLower.includes('option') || testLower.includes('type');

      case 'catch':
        return testLower.includes('error') || testLower.includes('throw') ||
               testLower.includes('exception') || testLower.includes('fail') ||
               testLower.includes('reject');

      case 'ternary':
        return testLower.includes('true') || testLower.includes('false') ||
               testLower.includes('condition');

      case 'logical':
        return testLower.includes('and') || testLower.includes('or') ||
               testLower.includes('both') || testLower.includes('either');

      default:
        return false;
    }
  }

  /**
   * Detect specific edge cases that are commonly not covered by tests
   */
  private async detectUncoveredEdgeCases(sourceFile: string, content: string): Promise<Array<{
    file: string;
    line: number;
    type: 'if' | 'else' | 'switch' | 'catch' | 'ternary' | 'logical';
    description: string;
  }>> {
    const edgeCases: Array<{
      file: string;
      line: number;
      type: 'if' | 'else' | 'switch' | 'catch' | 'ternary' | 'logical';
      description: string;
    }> = [];

    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      if (!trimmedLine || trimmedLine.startsWith('//')) continue;

      // Null/undefined checks
      if (/!\w+|== null|!== null|== undefined|!== undefined|typeof \w+ === ['"]undefined['"]/.test(trimmedLine)) {
        edgeCases.push({
          file: sourceFile,
          line: i + 1,
          type: 'if',
          description: `Null/undefined check: ${trimmedLine.substring(0, 60)}`
        });
      }

      // Error boundary conditions
      if (/length === 0|\.length < |\.length >|isEmpty|empty/.test(trimmedLine)) {
        edgeCases.push({
          file: sourceFile,
          line: i + 1,
          type: 'if',
          description: `Boundary condition: ${trimmedLine.substring(0, 60)}`
        });
      }

      // Try-catch without proper error handling
      if (/try\s*\{/.test(trimmedLine)) {
        const nextLines = lines.slice(i, Math.min(i + 10, lines.length));
        const hasCatch = nextLines.some(l => l.includes('catch'));
        if (!hasCatch) {
          edgeCases.push({
            file: sourceFile,
            line: i + 1,
            type: 'catch',
            description: `Try block without catch: ${trimmedLine.substring(0, 60)}`
          });
        }
      }

      // Async operations without error handling
      if (/(await |\.then\(|\.catch\()/.test(trimmedLine) &&
          !trimmedLine.includes('catch') &&
          !lines.slice(Math.max(0, i-2), i+3).some(l => l.includes('catch'))) {
        edgeCases.push({
          file: sourceFile,
          line: i + 1,
          type: 'catch',
          description: `Async operation without error handling: ${trimmedLine.substring(0, 60)}`
        });
      }

      // Type checking without all cases covered
      if (/typeof \w+ === ['"]/.test(trimmedLine)) {
        edgeCases.push({
          file: sourceFile,
          line: i + 1,
          type: 'if',
          description: `Type check: ${trimmedLine.substring(0, 60)}`
        });
      }
    }

    return edgeCases.slice(0, 10); // Limit results
  }

  private async analyzeBranchCoverage(): Promise<ProjectAnalysis['testAnalysis']['branchCoverage']> {
    try {
      // Simple heuristic: look for if/else statements and estimate coverage
      const { stdout } = await this.execAsync('find . -name "*.ts" -o -name "*.js" | grep -v test | grep -v node_modules | xargs grep -n "if\\s*(" | head -20');
      const conditionalLines = stdout.split('\n').filter(line => line.trim());

      // Estimate uncovered branches (simplified approach)
      const uncoveredBranches = conditionalLines.slice(0, 10).map((line, index) => {
        const parts = line.split(':');
        const file = parts[0]?.replace(/^\.\//, '') || 'unknown';
        const lineNumber = parseInt(parts[1]) || 0;
        const content = parts.slice(2).join(':') || '';

        let branchType: 'if' | 'else' | 'switch' | 'catch' | 'ternary' | 'logical' = 'if';
        if (content.includes('?') && content.includes(':')) {
          branchType = 'ternary';
        } else if (content.includes('&&') || content.includes('||')) {
          branchType = 'logical';
        } else if (content.includes('switch')) {
          branchType = 'switch';
        } else if (content.includes('catch')) {
          branchType = 'catch';
        }

        return {
          file,
          line: lineNumber,
          type: branchType,
          description: `Potentially uncovered ${branchType} branch: ${content.trim().substring(0, 50)}`,
        };
      });

      // Estimate coverage percentage (simplified)
      const testFileCount = await this.getTestFileCount();
      const sourceFileCount = await this.getSourceFileCount();
      const estimatedCoverage = sourceFileCount > 0 ? Math.min((testFileCount / sourceFileCount) * 100, 100) : 0;

      return {
        percentage: Math.round(estimatedCoverage),
        uncoveredBranches,
      };
    } catch {
      return {
        percentage: 0,
        uncoveredBranches: [],
      };
    }
  }

  /**
   * Analyzes untested public exports with enhanced detection and improved test matching
   */
  private async analyzeUntestedExports(): Promise<ProjectAnalysis['testAnalysis']['untestedExports']> {
    try {
      const untestedExports: ProjectAnalysis['testAnalysis']['untestedExports'] = [];

      // Find source files with exports (enhanced pattern)
      const { stdout: sourceFiles } = await this.execAsync('find . -name "*.ts" -o -name "*.js" | grep -v test | grep -v spec | grep -v node_modules | grep -v dist | head -50');
      const files = sourceFiles.split('\n').filter(line => line.trim());

      for (const file of files.slice(0, 25)) {
        try {
          const content = await this.readFileContent(file);
          const exports = this.extractPublicExports(content, file);

          for (const exportInfo of exports) {
            const testExists = await this.checkIfExportHasAdvancedTest(file, exportInfo.name);
            if (!testExists) {
              untestedExports.push({
                file: file.replace(/^\.\//, ''),
                exportName: exportInfo.name,
                exportType: exportInfo.type,
                line: exportInfo.line,
                isPublic: exportInfo.isPublic,
              });
            }
          }
        } catch {
          // Skip files that can't be read
        }
      }

      return untestedExports.slice(0, 30); // Slightly increased limit for better coverage
    } catch {
      return [];
    }
  }

  /**
   * Enhanced export extraction that handles various TypeScript/JavaScript patterns
   */
  private extractPublicExports(content: string, filePath: string): Array<{
    name: string;
    type: 'function' | 'class' | 'interface' | 'type' | 'variable' | 'const' | 'enum' | 'namespace';
    line: number;
    isPublic: boolean;
  }> {
    const exports: Array<{
      name: string;
      type: 'function' | 'class' | 'interface' | 'type' | 'variable' | 'const' | 'enum' | 'namespace';
      line: number;
      isPublic: boolean;
    }> = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Skip comments and empty lines
      if (!line || line.startsWith('//') || line.startsWith('*') || line.startsWith('/*')) {
        continue;
      }

      // Enhanced patterns for various export styles
      const patterns = [
        // Standard exports: export function/class/etc
        /^export\s+(function|class|interface|type|const|let|var|enum|namespace)\s+([a-zA-Z_$][\w$]*)/,
        // Export declarations with async: export async function
        /^export\s+async\s+function\s+([a-zA-Z_$][\w$]*)/,
        // Export declarations with abstract: export abstract class
        /^export\s+abstract\s+class\s+([a-zA-Z_$][\w$]*)/,
        // Arrow function exports: export const name = () =>
        /^export\s+const\s+([a-zA-Z_$][\w$]*)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/,
        // Simple arrow function exports: export const name = async () =>
        /^export\s+const\s+([a-zA-Z_$][\w$]*)\s*=\s*async\s*\([^)]*\)\s*=>/,
        // Function assignment: export const name = function
        /^export\s+const\s+([a-zA-Z_$][\w$]*)\s*=\s*(?:async\s+)?function/,
      ];

      for (const pattern of patterns) {
        const match = line.match(pattern);
        if (match) {
          let exportType: 'function' | 'class' | 'interface' | 'type' | 'variable' | 'const' | 'enum' | 'namespace' = 'function';
          let exportName: string;

          if (match[1] && match[2]) {
            // Standard pattern with type and name
            exportType = this.normalizeExportType(match[1]);
            exportName = match[2];
          } else if (match[1]) {
            // Special patterns (async function, arrow functions, etc.)
            exportName = match[1];
            if (line.includes('=>') || line.includes('function')) {
              exportType = 'function';
            } else if (line.includes('const')) {
              exportType = 'const';
            }
          } else {
            continue;
          }

          // Determine if export is public
          const isPublic = this.isExportPublic(exportName, filePath);

          exports.push({
            name: exportName,
            type: exportType,
            line: i + 1,
            isPublic,
          });
          break; // Break after first match to avoid duplicates
        }
      }

      // Handle class method exports (methods inside exported classes)
      if (line.startsWith('export class')) {
        const className = line.match(/export\s+class\s+([a-zA-Z_$][\w$]*)/)?.[1];
        if (className) {
          // Look for public methods in the class
          for (let j = i + 1; j < Math.min(i + 50, lines.length); j++) {
            const methodLine = lines[j].trim();
            if (methodLine === '}' || methodLine.startsWith('export')) break;

            const methodMatch = methodLine.match(/^(?:public\s+)?(?:async\s+)?(?:static\s+)?([a-zA-Z_$][\w$]*)\s*\(/);
            if (methodMatch && !methodMatch[1].startsWith('constructor')) {
              const methodName = methodMatch[1];
              const isPublic = this.isExportPublic(`${className}.${methodName}`, filePath);

              exports.push({
                name: `${className}.${methodName}`,
                type: 'function',
                line: j + 1,
                isPublic,
              });
            }
          }
        }
      }
    }

    return exports;
  }

  /**
   * Normalize export types to match the expected interface
   */
  private normalizeExportType(type: string): 'function' | 'class' | 'interface' | 'type' | 'variable' | 'const' | 'enum' | 'namespace' {
    switch (type.toLowerCase()) {
      case 'let':
      case 'var':
        return 'variable';
      case 'const':
        return 'const';
      case 'function':
        return 'function';
      case 'class':
        return 'class';
      case 'interface':
        return 'interface';
      case 'type':
        return 'type';
      case 'enum':
        return 'enum';
      case 'namespace':
        return 'namespace';
      default:
        return 'function'; // Default fallback
    }
  }

  /**
   * Determine if an export should be considered public
   */
  private isExportPublic(exportName: string, filePath: string): boolean {
    // Check file path patterns that indicate internal/private modules
    if (filePath.includes('internal') ||
        filePath.includes('private') ||
        filePath.includes('__tests__') ||
        filePath.includes('.d.ts')) {
      return false;
    }

    // Check export name patterns that indicate private exports
    if (exportName.startsWith('_') ||
        exportName.startsWith('__') ||
        exportName.toLowerCase().includes('internal') ||
        exportName.toLowerCase().includes('private')) {
      return false;
    }

    return true;
  }

  /**
   * Enhanced test detection with multiple strategies for better accuracy
   */
  private async checkIfExportHasAdvancedTest(sourceFile: string, exportName: string): Promise<boolean> {
    try {
      // Multiple test file naming patterns
      const testPatterns = [
        sourceFile.replace(/\.(ts|js)$/, '.test.$1'),
        sourceFile.replace(/\.(ts|js)$/, '.spec.$1'),
        sourceFile.replace(/src\//, 'test/').replace(/\.(ts|js)$/, '.test.$1'),
        sourceFile.replace(/src\//, '__tests__/').replace(/\.(ts|js)$/, '.test.$1'),
        `test/${sourceFile.replace(/^.*\//, '').replace(/\.(ts|js)$/, '')}.test.ts`,
        `__tests__/${sourceFile.replace(/^.*\//, '').replace(/\.(ts|js)$/, '')}.test.ts`,
      ];

      // Remove method part if checking a class method (e.g., "ClassName.methodName" -> "ClassName")
      const baseExportName = exportName.includes('.') ? exportName.split('.')[0] : exportName;
      const methodName = exportName.includes('.') ? exportName.split('.')[1] : null;

      for (const testFile of testPatterns) {
        try {
          const testContent = await this.readFileContent(testFile);
          if (testContent) {
            // Enhanced test detection patterns
            const hasTestPatterns = [
              // Direct name mentions in various contexts
              new RegExp(`\\b${this.escapeRegex(baseExportName)}\\b`, 'i'),
              new RegExp(`\\b${this.escapeRegex(exportName)}\\b`, 'i'),
              // Import/require patterns
              new RegExp(`import.*\\b${this.escapeRegex(baseExportName)}\\b`, 'i'),
              new RegExp(`require.*\\b${this.escapeRegex(baseExportName)}\\b`, 'i'),
              // Test describe/it blocks
              new RegExp(`describe\\s*\\(\\s*['"\`].*${this.escapeRegex(baseExportName)}.*['"\`]`, 'i'),
              new RegExp(`it\\s*\\(\\s*['"\`].*${this.escapeRegex(baseExportName)}.*['"\`]`, 'i'),
              new RegExp(`test\\s*\\(\\s*['"\`].*${this.escapeRegex(baseExportName)}.*['"\`]`, 'i'),
            ];

            // If checking a method, also look for method-specific patterns
            if (methodName) {
              hasTestPatterns.push(
                new RegExp(`\\b${this.escapeRegex(methodName)}\\b`, 'i'),
                new RegExp(`${this.escapeRegex(baseExportName)}\\.${this.escapeRegex(methodName)}`, 'i'),
              );
            }

            // Check if any pattern matches
            for (const pattern of hasTestPatterns) {
              if (pattern.test(testContent)) {
                return true;
              }
            }
          }
        } catch {
          // Test file doesn't exist or can't be read, continue with next pattern
        }
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Utility to escape regex special characters
   */
  private escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private async findUntestedExports(): Promise<ProjectAnalysis['testAnalysis']['untestedExports']> {
    try {
      const untestedExports: ProjectAnalysis['testAnalysis']['untestedExports'] = [];

      // Find source files with exports
      const { stdout: sourceFiles } = await this.execAsync('find . -name "*.ts" -o -name "*.js" | grep -v test | grep -v node_modules | head -30');
      const files = sourceFiles.split('\n').filter(line => line.trim());

      for (const file of files.slice(0, 15)) {
        try {
          const content = await this.readFileContent(file);
          const lines = content.split('\n');

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            // Look for export patterns
            const exportMatch = line.match(/^export\s+(function|class|interface|type|const|let|var|enum|namespace)\s+(\w+)/);
            if (exportMatch) {
              const exportType = exportMatch[1] as 'function' | 'class' | 'interface' | 'type' | 'const' | 'let' | 'var' | 'enum' | 'namespace';
              const exportName = exportMatch[2];

              // Simple heuristic: assume it's untested if we can't find a test file
              const testExists = await this.checkIfExportHasTest(file, exportName);
              if (!testExists) {
                untestedExports.push({
                  file: file.replace(/^\.\//, ''),
                  exportName,
                  exportType: exportType === 'let' || exportType === 'var' ? 'variable' : exportType,
                  line: i + 1,
                  isPublic: !file.includes('internal') && !exportName.startsWith('_'),
                });
              }
            }
          }
        } catch {
          // Skip files that can't be read
        }
      }

      return untestedExports.slice(0, 20); // Limit results
    } catch {
      return [];
    }
  }

  private async findMissingIntegrationTests(): Promise<ProjectAnalysis['testAnalysis']['missingIntegrationTests']> {
    try {
      const missingTests: ProjectAnalysis['testAnalysis']['missingIntegrationTests'] = [];

      // Look for API routes or main application entry points
      const { stdout } = await this.execAsync('find . -name "*.ts" -o -name "*.js" | xargs grep -l "router\\|app\\|server\\|main" | grep -v test | head -10');
      const entryFiles = stdout.split('\n').filter(line => line.trim());

      for (const file of entryFiles.slice(0, 5)) {
        try {
          const content = await this.readFileContent(file);

          // Look for route definitions or main functions
          if (content.includes('app.') || content.includes('router.') || content.includes('express')) {
            missingTests.push({
              criticalPath: `End-to-end API flow in ${file.replace(/^\.\//, '')}`,
              description: 'Missing integration tests for API endpoints and request/response flow',
              priority: 'high',
              relatedFiles: [file.replace(/^\.\//, '')],
            });
          }

          if (content.includes('main') || content.includes('index') || file.includes('index.')) {
            missingTests.push({
              criticalPath: `Application startup and initialization`,
              description: 'Missing tests for application bootstrap and configuration loading',
              priority: 'medium',
              relatedFiles: [file.replace(/^\.\//, '')],
            });
          }
        } catch {
          // Skip files that can't be read
        }
      }

      // Look for database operations
      const { stdout: dbFiles } = await this.execAsync('find . -name "*.ts" -o -name "*.js" | xargs grep -l "database\\|db\\|sql\\|query" | grep -v test | head -5');
      const dbRelatedFiles = dbFiles.split('\n').filter(line => line.trim());

      if (dbRelatedFiles.length > 0) {
        missingTests.push({
          criticalPath: 'Database operations and data persistence',
          description: 'Missing integration tests for database transactions and data consistency',
          priority: 'high',
          relatedFiles: dbRelatedFiles.slice(0, 3).map(f => f.replace(/^\.\//, '')),
        });
      }

      return missingTests.slice(0, 8); // Limit results
    } catch {
      return [];
    }
  }

  /**
   * Comprehensive analysis of missing integration tests for critical paths
   * Identifies API endpoints, database operations, external service calls,
   * and complex component interactions that lack proper integration testing
   */
  public async analyzeMissingIntegrationTests(): Promise<ProjectAnalysis['testAnalysis']['missingIntegrationTests']> {
    try {
      const missingTests: ProjectAnalysis['testAnalysis']['missingIntegrationTests'] = [];

      // 1. Identify critical paths (API endpoints, database operations, external service calls)
      const criticalPaths = await this.identifyCriticalPaths();

      // 2. Check for corresponding integration test files
      const testCoverageMap = await this.checkIntegrationTestCoverage(criticalPaths);

      // 3. Detect complex component interactions without integration coverage
      const uncoveredInteractions = await this.detectUncoveredComponentInteractions();

      // 4. Populate testAnalysis.missingIntegrationTests with results
      missingTests.push(...this.buildMissingTestReports(criticalPaths, testCoverageMap));
      missingTests.push(...uncoveredInteractions);

      return missingTests.slice(0, 15); // Limit results for performance
    } catch (error) {
      console.error('Error analyzing missing integration tests:', error);
      return [];
    }
  }

  /**
   * Analyzes test files to detect anti-patterns such as tests without assertions,
   * commented-out tests, tests with only console.log, empty test blocks, and
   * tests with hardcoded timeouts.
   *
   * @returns Promise<TestingAntiPattern[]> Array of detected anti-patterns
   */
  public async analyzeTestAntiPatterns(): Promise<TestingAntiPattern[]> {
    try {
      const antiPatterns: TestingAntiPattern[] = [];

      // Find test files
      const { stdout: testFiles } = await this.execAsync('find . -name "*.test.*" -o -name "*.spec.*" | head -50');
      const files = testFiles.split('\n').filter(line => line.trim());

      for (const file of files.slice(0, 20)) {
        try {
          const content = await this.readFileContent(file);
          const lines = content.split('\n');

          // Track test blocks for context
          let inTestBlock = false;
          let testBlockStart = -1;
          let testBlockName = '';

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmedLine = line.trim();

            // Detect test block start
            const testMatch = trimmedLine.match(/(?:it|test|describe)\s*\(\s*['"`]([^'"`]+)['"`]/);
            if (testMatch) {
              inTestBlock = true;
              testBlockStart = i;
              testBlockName = testMatch[1];
            }

            // Detect test block end
            if (inTestBlock && trimmedLine === '});') {
              // Analyze the test block for anti-patterns
              const testBlockLines = lines.slice(testBlockStart, i + 1);
              const testBlockContent = testBlockLines.join('\n');

              // 1. Tests without assertions
              if (!this.hasAssertions(testBlockContent)) {
                antiPatterns.push({
                  file: file.replace(/^\.\//, ''),
                  line: testBlockStart + 1,
                  type: 'no-assertion',
                  description: `Test "${testBlockName}" has no assertions - it doesn't verify any expected behavior`,
                  severity: 'high',
                  suggestion: 'Add expect(), assert(), or should assertions to verify the expected behavior'
                });
              }

              // 3. Tests with only console.log
              if (this.hasOnlyConsoleLog(testBlockContent)) {
                antiPatterns.push({
                  file: file.replace(/^\.\//, ''),
                  line: testBlockStart + 1,
                  type: 'console-only',
                  description: `Test "${testBlockName}" only contains console.log statements without proper assertions`,
                  severity: 'medium',
                  suggestion: 'Replace console.log with proper assertions to verify expected behavior'
                });
              }

              // 4. Empty test blocks
              if (this.isEmptyTest(testBlockContent)) {
                antiPatterns.push({
                  file: file.replace(/^\.\//, ''),
                  line: testBlockStart + 1,
                  type: 'empty-test',
                  description: `Test "${testBlockName}" is empty or contains only comments`,
                  severity: 'medium',
                  suggestion: 'Implement the test or remove it if no longer needed'
                });
              }

              // 5. Tests with hardcoded timeouts
              if (this.hasHardcodedTimeouts(testBlockContent)) {
                antiPatterns.push({
                  file: file.replace(/^\.\//, ''),
                  line: testBlockStart + 1,
                  type: 'hardcoded-timeout',
                  description: `Test "${testBlockName}" contains hardcoded timeouts that may cause flaky tests`,
                  severity: 'high',
                  suggestion: 'Use proper test utilities like waitFor, fake timers, or eliminate time dependencies'
                });
              }

              inTestBlock = false;
            }

            // 2. Commented-out tests (check individual lines)
            if (this.isCommentedOutTest(trimmedLine)) {
              antiPatterns.push({
                file: file.replace(/^\.\//, ''),
                line: i + 1,
                type: 'commented-out',
                description: 'Commented-out test found - may indicate incomplete or disabled functionality',
                severity: 'low',
                suggestion: 'Either implement the test properly or remove the commented code'
              });
            }
          }
        } catch (error) {
          // Skip files that can't be read
          console.warn(`Could not read test file ${file}:`, error);
        }
      }

      return antiPatterns.slice(0, 50); // Limit results for performance
    } catch (error) {
      console.error('Error analyzing test anti-patterns:', error);
      return [];
    }
  }

  /**
   * Checks if test content has any assertions
   */
  private hasAssertions(testContent: string): boolean {
    const assertionPatterns = [
      /expect\s*\(/,
      /assert\s*\(/,
      /should\./,
      /\.to\./,
      /\.toBe\(/,
      /\.toEqual\(/,
      /\.toHaveProperty\(/,
      /\.toContain\(/,
      /\.toMatch\(/,
      /\.toThrow\(/,
      /\.toBeTruthy\(/,
      /\.toBeFalsy\(/
    ];

    return assertionPatterns.some(pattern => pattern.test(testContent));
  }

  /**
   * Checks if test only contains console.log statements (no real assertions)
   */
  private hasOnlyConsoleLog(testContent: string): boolean {
    // Remove test definition and closing brace
    const contentWithoutWrapper = testContent
      .replace(/(?:it|test|describe)\s*\(\s*['"`][^'"`]+['"`]\s*,\s*(?:async\s+)?\(\)\s*=>\s*\{/, '')
      .replace(/\}\s*\)\s*;?\s*$/, '');

    // Check if meaningful content only contains console.log
    const meaningfulLines = contentWithoutWrapper
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('//') && !line.startsWith('/*') && !line.startsWith('*'));

    const hasConsoleLog = meaningfulLines.some(line => /console\.log\s*\(/.test(line));
    const hasOtherContent = meaningfulLines.some(line =>
      !line.includes('console.log') &&
      line !== '{' &&
      line !== '}' &&
      !/^\s*$/.test(line)
    );

    return hasConsoleLog && !hasOtherContent && !this.hasAssertions(testContent);
  }

  /**
   * Checks if test block is effectively empty
   */
  private isEmptyTest(testContent: string): boolean {
    // Remove test definition and closing brace
    const contentWithoutWrapper = testContent
      .replace(/(?:it|test|describe)\s*\(\s*['"`][^'"`]+['"`]\s*,\s*(?:async\s+)?\(\)\s*=>\s*\{/, '')
      .replace(/\}\s*\)\s*;?\s*$/, '');

    // Check if there's any meaningful content
    const meaningfulLines = contentWithoutWrapper
      .split('\n')
      .map(line => line.trim())
      .filter(line =>
        line &&
        !line.startsWith('//') &&
        !line.startsWith('/*') &&
        !line.startsWith('*') &&
        line !== '{' &&
        line !== '}'
      );

    return meaningfulLines.length === 0;
  }

  /**
   * Checks if test contains hardcoded timeouts
   */
  private hasHardcodedTimeouts(testContent: string): boolean {
    const timeoutPatterns = [
      /setTimeout\s*\(/,
      /setInterval\s*\(/,
      /sleep\s*\(/,
      /delay\s*\(/,
      /wait\s*\(\s*\d+/,
      /\.timeout\s*\(\s*\d+/,
      /new\s+Promise.*setTimeout/
    ];

    return timeoutPatterns.some(pattern => pattern.test(testContent));
  }

  /**
   * Checks if a line contains a commented-out test
   */
  private isCommentedOutTest(line: string): boolean {
    // Look for commented lines that contain test patterns
    if (line.startsWith('//')) {
      const uncommented = line.replace(/^\/\/\s*/, '');
      return /(?:it|test|describe)\s*\(\s*['"`]/.test(uncommented);
    }
    return false;
  }

  /**
   * Identifies critical paths in the codebase including API endpoints,
   * database operations, and external service calls
   */
  private async identifyCriticalPaths(): Promise<Array<{
    type: 'api_endpoint' | 'database_operation' | 'external_service' | 'component_interaction' | 'authentication' | 'payment' | 'data_processing';
    file: string;
    description: string;
    keywords: string[];
    criticality: 'critical' | 'high' | 'medium' | 'low';
  }>> {
    const criticalPaths: Array<{
      type: 'api_endpoint' | 'database_operation' | 'external_service' | 'component_interaction' | 'authentication' | 'payment' | 'data_processing';
      file: string;
      description: string;
      keywords: string[];
      criticality: 'critical' | 'high' | 'medium' | 'low';
    }> = [];

    try {
      // Find authentication-related files (highest priority)
      const { stdout: authFiles } = await this.execAsync(
        'find . -name "*.ts" -o -name "*.js" | grep -v test | grep -v node_modules | xargs grep -l "\\(auth\\|login\\|password\\|jwt\\|token\\|session\\|authenticate\\|authorize\\)" | head -10'
      );
      const authFileList = authFiles.split('\n').filter(line => line.trim());

      for (const file of authFileList) {
        try {
          const content = await this.readFileContent(file);
          if (content.match(/(login|authenticate|authorize|jwt|token|session|password|auth)/i)) {
            criticalPaths.push({
              type: 'authentication',
              file: file.replace(/^\.\//, ''),
              description: 'Authentication and authorization logic',
              keywords: ['auth', 'login', 'password', 'jwt', 'token', 'session'],
              criticality: 'critical'
            });
          }
        } catch {
          // Skip files that can't be read
        }
      }

      // Find payment-related files (critical priority)
      const { stdout: paymentFiles } = await this.execAsync(
        'find . -name "*.ts" -o -name "*.js" | grep -v test | grep -v node_modules | xargs grep -l "\\(payment\\|billing\\|stripe\\|paypal\\|transaction\\|charge\\|invoice\\|refund\\)" | head -10'
      );
      const paymentFileList = paymentFiles.split('\n').filter(line => line.trim());

      for (const file of paymentFileList) {
        try {
          const content = await this.readFileContent(file);
          if (content.match(/(payment|billing|stripe|paypal|transaction|charge|invoice|refund)/i)) {
            criticalPaths.push({
              type: 'payment',
              file: file.replace(/^\.\//, ''),
              description: 'Payment processing and billing logic',
              keywords: ['payment', 'billing', 'stripe', 'paypal', 'transaction'],
              criticality: 'critical'
            });
          }
        } catch {
          // Skip files that can't be read
        }
      }

      // Find data processing files (high priority)
      const { stdout: dataFiles } = await this.execAsync(
        'find . -name "*.ts" -o -name "*.js" | grep -v test | grep -v node_modules | xargs grep -l "\\(process.*data\\|import.*csv\\|export.*pdf\\|transform\\|aggregate\\|compute\\)" | head -10'
      );
      const dataFileList = dataFiles.split('\n').filter(line => line.trim());

      for (const file of dataFileList) {
        try {
          const content = await this.readFileContent(file);
          if (content.match(/(processData|importCsv|exportPdf|transform|aggregate|compute)/i)) {
            criticalPaths.push({
              type: 'data_processing',
              file: file.replace(/^\.\//, ''),
              description: 'Data processing and transformation logic',
              keywords: ['data', 'process', 'transform', 'import', 'export'],
              criticality: 'high'
            });
          }
        } catch {
          // Skip files that can't be read
        }
      }

      // Find API endpoints (high priority)
      const { stdout: apiFiles } = await this.execAsync(
        'find . -name "*.ts" -o -name "*.js" | grep -v test | grep -v node_modules | xargs grep -l "app\\." || echo ""'
      );
      const apiFileList = apiFiles.split('\n').filter(line => line.trim());

      for (const file of apiFileList.slice(0, 10)) {
        try {
          const content = await this.readFileContent(file);
          const fileName = file.toLowerCase();

          // Determine criticality based on file content and name
          let criticality: 'critical' | 'high' | 'medium' | 'low' = 'high';
          if (fileName.includes('auth') || content.match(/(auth|login|password|jwt|token)/i)) {
            criticality = 'critical';
          } else if (fileName.includes('payment') || content.match(/(payment|billing|charge)/i)) {
            criticality = 'critical';
          } else if (fileName.includes('user') || fileName.includes('admin') || content.match(/(user|admin|profile)/i)) {
            criticality = 'high';
          }

          // Check for Express routes
          if (content.match(/app\.(get|post|put|patch|delete|use)\(/)) {
            criticalPaths.push({
              type: 'api_endpoint',
              file: file.replace(/^\.\//, ''),
              description: 'REST API endpoint definitions',
              keywords: ['express', 'router', 'endpoint', 'route'],
              criticality
            });
          }

          // Check for GraphQL resolvers
          if (content.includes('resolvers') || content.includes('GraphQL') || content.match(/\w+Resolver/)) {
            criticalPaths.push({
              type: 'api_endpoint',
              file: file.replace(/^\.\//, ''),
              description: 'GraphQL resolver functions',
              keywords: ['graphql', 'resolver', 'mutation', 'query'],
              criticality
            });
          }
        } catch {
          // Skip files that can't be read
        }
      }

      // Find database operations
      const { stdout: dbFiles } = await this.execAsync(
        'find . -name "*.ts" -o -name "*.js" | grep -v test | grep -v node_modules | xargs grep -l "\\(query\\|execute\\|findOne\\|save\\|update\\|delete\\|insert\\|select\\)" | head -15'
      );
      const dbFileList = dbFiles.split('\n').filter(line => line.trim());

      for (const file of dbFileList) {
        try {
          const content = await this.readFileContent(file);
          const fileName = file.toLowerCase();

          // Determine criticality for database operations
          let criticality: 'critical' | 'high' | 'medium' | 'low' = 'high';
          if (fileName.includes('user') || content.match(/(user|account|profile)/i)) {
            criticality = 'critical';
          } else if (fileName.includes('payment') || content.match(/(payment|transaction|billing)/i)) {
            criticality = 'critical';
          } else if (fileName.includes('auth') || content.match(/(auth|login|session)/i)) {
            criticality = 'critical';
          } else if (content.match(/(migration|schema|seed)/i)) {
            criticality = 'high';
          }

          // Check for ORM operations
          if (content.match(/(findOne|findMany|create|update|delete|save|query|execute)/)) {
            criticalPaths.push({
              type: 'database_operation',
              file: file.replace(/^\.\//, ''),
              description: 'Database query and transaction operations',
              keywords: ['database', 'query', 'transaction', 'orm'],
              criticality
            });
          }

          // Check for raw SQL
          if (content.match(/(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER)/i)) {
            criticalPaths.push({
              type: 'database_operation',
              file: file.replace(/^\.\//, ''),
              description: 'Raw SQL operations',
              keywords: ['sql', 'database', 'raw query'],
              criticality
            });
          }
        } catch {
          // Skip files that can't be read
        }
      }

      // Find external service calls
      const { stdout: serviceFiles } = await this.execAsync(
        'find . -name "*.ts" -o -name "*.js" | grep -v test | grep -v node_modules | xargs grep -l "\\(fetch\\|axios\\|http\\|request\\|api\\)" | head -10'
      );
      const serviceFileList = serviceFiles.split('\n').filter(line => line.trim());

      for (const file of serviceFileList) {
        try {
          const content = await this.readFileContent(file);
          const fileName = file.toLowerCase();

          // Determine criticality for external services
          let criticality: 'critical' | 'high' | 'medium' | 'low' = 'high';
          if (fileName.includes('payment') || content.match(/(stripe|paypal|payment|billing)/i)) {
            criticality = 'critical';
          } else if (fileName.includes('auth') || content.match(/(oauth|auth|login)/i)) {
            criticality = 'critical';
          } else if (content.match(/(email|sms|notification)/i)) {
            criticality = 'high';
          } else if (content.match(/(analytics|logging|monitoring)/i)) {
            criticality = 'medium';
          }

          // Check for HTTP client calls
          if (content.match(/(fetch\(|axios\.|http\.|request\()/)) {
            criticalPaths.push({
              type: 'external_service',
              file: file.replace(/^\.\//, ''),
              description: 'External API and service calls',
              keywords: ['http', 'api', 'external', 'service'],
              criticality
            });
          }
        } catch {
          // Skip files that can't be read
        }
      }

    } catch (error) {
      console.error('Error identifying critical paths:', error);
    }

    return criticalPaths;
  }

  /**
   * Checks for corresponding integration test files for critical paths
   */
  private async checkIntegrationTestCoverage(criticalPaths: Array<{
    type: 'api_endpoint' | 'database_operation' | 'external_service' | 'component_interaction' | 'authentication' | 'payment' | 'data_processing';
    file: string;
    description: string;
    keywords: string[];
    criticality: 'critical' | 'high' | 'medium' | 'low';
  }>): Promise<Map<string, boolean>> {
    const coverageMap = new Map<string, boolean>();

    try {
      // Find integration test files
      const { stdout: integrationTests } = await this.execAsync(
        'find . -name "*.test.*" -o -name "*.spec.*" | xargs grep -l "\\(integration\\|e2e\\|end.to.end\\|api\\|request\\|supertest\\)" || echo ""'
      );
      const integrationTestFiles = integrationTests.split('\n').filter(line => line.trim());

      for (const path of criticalPaths) {
        const fileName = path.file.split('/').pop()?.replace(/\.(ts|js)$/, '') || '';
        let hasIntegrationTest = false;

        // Check if there's a corresponding integration test file
        for (const testFile of integrationTestFiles) {
          if (testFile.includes(fileName) ||
              testFile.includes(path.type) ||
              path.keywords.some(keyword => testFile.includes(keyword))) {
            hasIntegrationTest = true;
            break;
          }
        }

        // Also check for test content that covers this critical path
        if (!hasIntegrationTest) {
          for (const testFile of integrationTestFiles) {
            try {
              const testContent = await this.readFileContent(testFile);
              if (path.keywords.some(keyword => testContent.toLowerCase().includes(keyword.toLowerCase())) ||
                  testContent.includes(fileName)) {
                hasIntegrationTest = true;
                break;
              }
            } catch {
              // Skip files that can't be read
            }
          }
        }

        coverageMap.set(path.file, hasIntegrationTest);
      }

    } catch (error) {
      console.error('Error checking integration test coverage:', error);
    }

    return coverageMap;
  }

  /**
   * Detects complex component interactions without integration coverage
   */
  private async detectUncoveredComponentInteractions(): Promise<ProjectAnalysis['testAnalysis']['missingIntegrationTests']> {
    const uncoveredInteractions: ProjectAnalysis['testAnalysis']['missingIntegrationTests'] = [];

    try {
      // Find files with complex imports and dependencies
      const { stdout: componentFiles } = await this.execAsync(
        'find . -name "*.ts" -o -name "*.js" | grep -v test | grep -v node_modules | head -20'
      );
      const files = componentFiles.split('\n').filter(line => line.trim());

      for (const file of files) {
        try {
          const content = await this.readFileContent(file);
          const lines = content.split('\n');

          // Count imports and dependencies
          const imports = lines.filter(line => line.trim().startsWith('import')).length;
          const classDefinitions = (content.match(/class\s+\w+/g) || []).length;
          const functionDefinitions = (content.match(/(function\s+\w+|const\s+\w+\s*=.*=>)/g) || []).length;

          // If file has complex interactions (many imports, classes, functions)
          if (imports > 5 || (classDefinitions > 2 && functionDefinitions > 5)) {
            // Check if this complex interaction is covered by integration tests
            const { stdout: testCoverage } = await this.execAsync(
              `find . -name "*.test.*" -o -name "*.spec.*" | xargs grep -l "${file.split('/').pop()?.replace(/\.(ts|js)$/, '') || ''}" || echo ""`
            );

            if (!testCoverage.trim()) {
              uncoveredInteractions.push({
                criticalPath: `Complex component interaction in ${file.replace(/^\.\//, '')}`,
                description: `File with ${imports} imports and ${classDefinitions + functionDefinitions} definitions lacks integration test coverage`,
                priority: imports > 10 ? 'high' : 'medium',
                relatedFiles: [file.replace(/^\.\//, '')]
              });
            }
          }

        } catch {
          // Skip files that can't be read
        }
      }

    } catch (error) {
      console.error('Error detecting uncovered component interactions:', error);
    }

    return uncoveredInteractions.slice(0, 5); // Limit results
  }

  /**
   * Builds missing test reports from critical paths and coverage analysis
   */
  private buildMissingTestReports(
    criticalPaths: Array<{
      type: 'api_endpoint' | 'database_operation' | 'external_service' | 'component_interaction' | 'authentication' | 'payment' | 'data_processing';
      file: string;
      description: string;
      keywords: string[];
      criticality: 'critical' | 'high' | 'medium' | 'low';
    }>,
    coverageMap: Map<string, boolean>
  ): ProjectAnalysis['testAnalysis']['missingIntegrationTests'] {
    const missingTests: ProjectAnalysis['testAnalysis']['missingIntegrationTests'] = [];

    for (const path of criticalPaths) {
      const hasCoverage = coverageMap.get(path.file) || false;

      if (!hasCoverage) {
        // Use the criticality level from the path analysis, with type-specific adjustments
        let priority: 'low' | 'medium' | 'high' | 'critical' = path.criticality;
        let description = '';

        switch (path.type) {
          case 'authentication':
            priority = 'critical'; // Always critical for auth
            description = `Missing integration tests for authentication logic in ${path.file}. Should test login flows, token validation, session management, and security boundaries.`;
            break;
          case 'payment':
            priority = 'critical'; // Always critical for payments
            description = `Missing integration tests for payment processing in ${path.file}. Should test transaction flows, payment validation, error handling, and refund scenarios.`;
            break;
          case 'data_processing':
            // Use detected criticality level
            description = `Missing integration tests for data processing in ${path.file}. Should test data transformation, validation, import/export flows, and error handling.`;
            break;
          case 'api_endpoint':
            // Use detected criticality level (critical for auth/payment, high for others)
            description = `Missing integration tests for API endpoints in ${path.file}. Should test request/response flow, status codes, authentication, and error handling.`;
            break;
          case 'database_operation':
            // Use detected criticality level (critical for user/payment/auth data)
            description = `Missing integration tests for database operations in ${path.file}. Should test data persistence, transaction integrity, rollback scenarios, and constraint validation.`;
            break;
          case 'external_service':
            // Use detected criticality level (critical for payment/auth services)
            description = `Missing integration tests for external service calls in ${path.file}. Should test service integration, error handling, fallback mechanisms, and timeout scenarios.`;
            break;
          case 'component_interaction':
            priority = priority || 'medium'; // Default to medium if not set
            description = `Missing integration tests for component interactions in ${path.file}. Should test inter-component communication, data flow, and service dependencies.`;
            break;
        }

        missingTests.push({
          criticalPath: `${path.type.replace(/_/g, ' ')} integration in ${path.file}`,
          description,
          priority,
          relatedFiles: [path.file]
        });
      }
    }

    // Sort by priority: critical > high > medium > low
    const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    missingTests.sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority]);

    return missingTests;
  }

  private async detectTestingAntiPatterns(): Promise<ProjectAnalysis['testAnalysis']['antiPatterns']> {
    try {
      const antiPatterns: ProjectAnalysis['testAnalysis']['antiPatterns'] = [];

      // Find test files
      const { stdout: testFiles } = await this.execAsync('find . -name "*.test.*" -o -name "*.spec.*" | head -20');
      const files = testFiles.split('\n').filter(line => line.trim());

      for (const file of files.slice(0, 10)) {
        try {
          const content = await this.readFileContent(file);
          const lines = content.split('\n');

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmedLine = line.trim();

            // Detect potential anti-patterns

            // 1. Test pollution (global state modification)
            if (trimmedLine.includes('global.') || trimmedLine.includes('process.env') || trimmedLine.includes('window.')) {
              antiPatterns.push({
                file: file.replace(/^\.\//, ''),
                line: i + 1,
                type: 'test-pollution',
                description: 'Test may be modifying global state which can affect other tests',
                severity: 'medium',
                suggestion: 'Use proper setup/teardown or mocking to isolate test state',
              });
            }

            // 2. Mystery guest (external dependencies)
            if (trimmedLine.includes('require(') && (trimmedLine.includes('fs') || trimmedLine.includes('http'))) {
              antiPatterns.push({
                file: file.replace(/^\.\//, ''),
                line: i + 1,
                type: 'mystery-guest',
                description: 'Test has hidden dependencies on external resources',
                severity: 'medium',
                suggestion: 'Mock external dependencies or make them explicit test fixtures',
              });
            }

            // 3. Assertion roulette (multiple assertions without context)
            const assertionCount = (line.match(/expect\(|assert\(|should\./g) || []).length;
            if (assertionCount > 3) {
              antiPatterns.push({
                file: file.replace(/^\.\//, ''),
                line: i + 1,
                type: 'assertion-roulette',
                description: `Too many assertions (${assertionCount}) in a single test line`,
                severity: 'low',
                suggestion: 'Split into multiple focused test cases or add descriptive comments',
              });
            }

            // 4. Slow test (timeouts or sleeps)
            if (trimmedLine.includes('setTimeout') || trimmedLine.includes('sleep') || trimmedLine.includes('delay')) {
              antiPatterns.push({
                file: file.replace(/^\.\//, ''),
                line: i + 1,
                type: 'slow-test',
                description: 'Test contains timing delays which can make tests slow and flaky',
                severity: 'high',
                suggestion: 'Use mocked timers or eliminate timing dependencies',
              });
            }
          }
        } catch {
          // Skip files that can't be read
        }
      }

      return antiPatterns.slice(0, 15); // Limit results
    } catch {
      return [];
    }
  }

  private async getTestFileCount(): Promise<number> {
    try {
      const { stdout } = await this.execAsync('find . -name "*.test.*" -o -name "*.spec.*" | wc -l');
      return parseInt(stdout.trim()) || 0;
    } catch {
      return 0;
    }
  }

  private async getSourceFileCount(): Promise<number> {
    try {
      const { stdout } = await this.execAsync('find . -name "*.ts" -o -name "*.js" | grep -v test | grep -v node_modules | wc -l');
      return parseInt(stdout.trim()) || 0;
    } catch {
      return 0;
    }
  }

  private async readFileContent(filePath: string): Promise<string> {
    try {
      return await fs.readFile(join(this.projectPath, filePath), 'utf-8');
    } catch {
      return '';
    }
  }

  private async checkIfExportHasTest(sourceFile: string, exportName: string): Promise<boolean> {
    try {
      // Simple heuristic: check if there's a test file that mentions this export
      const testFileName = sourceFile.replace(/\.(ts|js)$/, '.test.$1');
      const specFileName = sourceFile.replace(/\.(ts|js)$/, '.spec.$1');

      // Check if test file exists and contains the export name
      for (const testFile of [testFileName, specFileName]) {
        try {
          const testContent = await this.readFileContent(testFile);
          if (testContent.includes(exportName)) {
            return true;
          }
        } catch {
          // Test file doesn't exist, continue
        }
      }

      return false;
    } catch {
      return false;
    }
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

      // Build symbol index for cross-reference validation
      let crossRefValidator: CrossReferenceValidator | null = null;
      let symbolIndex = null;

      try {
        crossRefValidator = new CrossReferenceValidator();
        symbolIndex = await crossRefValidator.buildIndex(this.projectPath, {
          extensions: ['.ts', '.tsx', '.js', '.jsx'],
          exclude: ['node_modules/**', 'dist/**', 'build/**', '**/*.test.*', '**/*.spec.*'],
          includePrivate: false,
          includeMembers: true
        });
      } catch {
        // If cross-reference validation fails, continue without it
        crossRefValidator = null;
        symbolIndex = null;
      }

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

          }

          // Validate cross-references in this documentation file (if validator is available)
          if (crossRefValidator && symbolIndex) {
            try {
              const documentationReferences = crossRefValidator.extractDocumentationReferences(
                file.replace(/^\.\//, ''),
                content
              );

              const brokenReferences = crossRefValidator.validateDocumentationReferences(
                symbolIndex,
                documentationReferences
              );

              // Add broken references as outdated documentation
              outdatedDocs.push(...brokenReferences);
            } catch {
              // Skip cross-reference validation for this file if it fails
            }
          }

        } catch {
          // Skip files that can't be read
        }
      }

      // Validate @deprecated tags in source files
      try {
        const { stdout: sourceFiles } = await this.execAsync('find . -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" | grep -v node_modules | grep -v test | head -30');
        const files = sourceFiles.split('\n').filter(line => line.trim());

        for (const file of files) {
          try {
            const content = await fs.readFile(join(this.projectPath, file), 'utf-8');
            const relativePath = file.replace(/^\.\//, '');

            // Call JSDocDetector to validate deprecated tags
            const jsDocIssues = validateDeprecatedTags(content, relativePath);
            outdatedDocs.push(...jsDocIssues);
          } catch {
            // Skip files that can't be read
          }
        }
      } catch {
        // Ignore errors in JSDoc validation
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

      // Use default sections (documentation config is on ApexConfig, not DaemonConfig)
      const requiredSections: string[] = ['title', 'description', 'installation', 'usage'];
      const recommendedSections: string[] = ['api', 'contributing', 'license'];
      const optionalSections: string[] = ['testing', 'troubleshooting', 'faq', 'changelog'];
      const customSections: Record<string, { priority: 'required' | 'recommended' | 'optional'; indicators: string[]; description: string }> = {};

      // Build section definitions with priorities and default indicators
      const sectionDefinitions = new Map<string, {
        priority: 'required' | 'recommended' | 'optional';
        indicators: string[];
        description: string;
      }>();

      // Add required sections
      requiredSections.forEach((section: string) => {
        if (!sectionDefinitions.has(section)) {
          sectionDefinitions.set(section, {
            priority: 'required',
            indicators: this.getDefaultIndicators(section),
            description: this.getDefaultDescription(section)
          });
        }
      });

      // Add recommended sections
      recommendedSections.forEach((section: string) => {
        if (!sectionDefinitions.has(section)) {
          sectionDefinitions.set(section, {
            priority: 'recommended',
            indicators: this.getDefaultIndicators(section),
            description: this.getDefaultDescription(section)
          });
        }
      });

      // Add optional sections
      optionalSections.forEach((section: string) => {
        if (!sectionDefinitions.has(section)) {
          sectionDefinitions.set(section, {
            priority: 'optional',
            indicators: this.getDefaultIndicators(section),
            description: this.getDefaultDescription(section)
          });
        }
      });

      // Add custom sections (override any existing ones)
      if (customSections) {
        Object.entries(customSections).forEach(([section, sectionConfig]) => {
          sectionDefinitions.set(section, {
            priority: sectionConfig.priority,
            indicators: sectionConfig.indicators,
            description: sectionConfig.description
          });
        });
      }

      if (files.length === 0) {
        // No README files found - return all sections as missing
        return Array.from(sectionDefinitions.entries()).map(([section, def]) => ({
          section: section as ReadmeSection,
          priority: def.priority,
          description: def.description
        }));
      }

      // Analyze existing README files
      for (const file of files) {
        try {
          const content = await fs.readFile(join(this.projectPath, file), 'utf-8');
          const lowerContent = content.toLowerCase();

          // Check each configured section
          for (const [section, definition] of sectionDefinitions) {
            const hasSection = definition.indicators.some(indicator =>
              lowerContent.includes(indicator.toLowerCase())
            );

            if (!hasSection) {
              // Avoid duplicates by checking if this section is already marked as missing
              const alreadyAdded = missingReadmeSections.some(missing => missing.section === section);
              if (!alreadyAdded) {
                missingReadmeSections.push({
                  section: section as ReadmeSection,
                  priority: definition.priority,
                  description: definition.description
                });
              }
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
   * Get default indicators for a standard section
   */
  private getDefaultIndicators(section: string): string[] {
    const defaultIndicators: Record<string, string[]> = {
      'title': ['#', 'title'],
      'description': ['description', 'about', 'overview'],
      'installation': ['install', 'setup', 'getting started'],
      'usage': ['usage', 'how to use', 'example', 'getting started'],
      'api': ['api', 'reference', 'methods', 'functions', 'documentation'],
      'contributing': ['contribut', 'develop', 'contribution'],
      'license': ['license', 'copyright', 'legal'],
      'testing': ['test', 'testing', 'spec'],
      'troubleshooting': ['troubleshoot', 'problem', 'issue', 'debug'],
      'faq': ['faq', 'question', 'frequently asked'],
      'changelog': ['changelog', 'changes', 'history', 'release'],
      'dependencies': ['depend', 'requirement'],
      'examples': ['example', 'demo', 'sample'],
      'deployment': ['deploy', 'build', 'production']
    };

    return defaultIndicators[section] || [section];
  }

  /**
   * Get default description for a standard section
   */
  private getDefaultDescription(section: string): string {
    const defaultDescriptions: Record<string, string> = {
      'title': 'Project title and brief description',
      'description': 'Detailed project description and overview',
      'installation': 'Installation and setup instructions',
      'usage': 'Usage examples and basic instructions',
      'api': 'API documentation and reference',
      'contributing': 'Contributing guidelines for developers',
      'license': 'License information and copyright',
      'testing': 'Testing instructions and guidelines',
      'troubleshooting': 'Common issues and solutions',
      'faq': 'Frequently asked questions',
      'changelog': 'Version history and changes',
      'dependencies': 'Project dependencies and requirements',
      'examples': 'Usage examples and code samples',
      'deployment': 'Deployment and build instructions'
    };

    return defaultDescriptions[section] || `${section.charAt(0).toUpperCase() + section.slice(1)} section`;
  }

  /**
   * Analyze API documentation completeness
   */
  /**
   * Find stale TODO/FIXME/HACK comments using git blame
   */
  private async findStaleComments(): Promise<OutdatedDocumentation[]> {
    try {
      const { StaleCommentDetector } = await import('./stale-comment-detector.js');

      // Use default configuration (documentation config is on ApexConfig, not DaemonConfig)
      const detector = new StaleCommentDetector(this.projectPath, {});

      return await detector.findStaleComments();
    } catch (error) {
      // Graceful fallback when git is not available or detector fails
      return [];
    }
  }

  /**
   * Find version mismatches using VersionMismatchDetector
   */
  private async findVersionMismatches(): Promise<OutdatedDocumentation[]> {
    try {
      const { VersionMismatchDetector } = await import('./analyzers/version-mismatch-detector.js');
      const detector = new VersionMismatchDetector(this.projectPath);

      const mismatches = await detector.detectMismatches();
      return this.convertVersionMismatchesToOutdatedDocs(mismatches);
    } catch (error) {
      // Graceful fallback when detector fails
      return [];
    }
  }

  /**
   * Convert VersionMismatch[] to OutdatedDocumentation[]
   */
  private convertVersionMismatchesToOutdatedDocs(
    mismatches: Array<{
      file: string;
      line: number;
      foundVersion: string;
      expectedVersion: string;
      lineContent: string;
    }>
  ): OutdatedDocumentation[] {
    return mismatches.map(mismatch => ({
      file: mismatch.file,
      type: 'version-mismatch' as const,
      description: `Found version ${mismatch.foundVersion} but expected ${mismatch.expectedVersion}`,
      line: mismatch.line,
      suggestion: `Update version reference from ${mismatch.foundVersion} to ${mismatch.expectedVersion}`,
      severity: this.calculateMismatchSeverity(mismatch.foundVersion, mismatch.expectedVersion)
    }));
  }

  /**
   * Calculate severity based on version difference
   */
  private calculateMismatchSeverity(foundVersion: string, expectedVersion: string): 'low' | 'medium' | 'high' {
    try {
      // Parse semver versions for comparison
      const parseVersion = (version: string) => {
        const match = version.match(/(\d+)\.(\d+)\.(\d+)/);
        return match ? { major: parseInt(match[1]), minor: parseInt(match[2]), patch: parseInt(match[3]) } : null;
      };

      const found = parseVersion(foundVersion);
      const expected = parseVersion(expectedVersion);

      if (!found || !expected) {
        return 'medium'; // Can't parse, assume medium severity
      }

      // Major version difference = high severity
      if (found.major !== expected.major) {
        return 'high';
      }

      // Minor version difference = medium severity
      if (found.minor !== expected.minor) {
        return 'medium';
      }

      // Only patch difference = low severity
      return 'low';
    } catch {
      return 'medium'; // Default to medium on any parsing error
    }
  }

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

  /**
   * Detects duplicate code patterns in TypeScript/JavaScript files
   */
  private async detectDuplicateCodePatterns(): Promise<DuplicatePattern[]> {
    try {
      const { stdout } = await this.execAsync('find . -name "*.ts" -o -name "*.js" | grep -v node_modules | head -30');
      const files = stdout.split('\n').filter(line => line.trim());
      const duplicatePatterns: DuplicatePattern[] = [];

      // Strategy 1: Detect duplicate function signatures and similar method names
      const functionPatterns = await this.detectDuplicateFunctions(files);
      duplicatePatterns.push(...functionPatterns);

      // Strategy 2: Detect duplicate import patterns
      const importPatterns = await this.detectDuplicateImports(files);
      duplicatePatterns.push(...importPatterns);

      // Strategy 3: Detect duplicate utility/validation logic
      const utilityPatterns = await this.detectDuplicateUtilities(files);
      duplicatePatterns.push(...utilityPatterns);

      // Strategy 4: Detect TODOs/FIXMEs as a pattern (keeping original logic)
      const todoPatterns = await this.detectDuplicateTodos();
      duplicatePatterns.push(...todoPatterns);

      return duplicatePatterns;
    } catch {
      return []; // If analysis fails, return empty array
    }
  }

  /**
   * Detects duplicate function patterns across files
   */
  private async detectDuplicateFunctions(files: string[]): Promise<DuplicatePattern[]> {
    try {
      const functionSignatures = new Map<string, string[]>();

      for (const filePath of files.slice(0, 15)) { // Limit to avoid performance issues
        try {
          const relativePath = filePath.replace('./', '');
          const fullPath = join(this.projectPath, relativePath);
          const content = await fs.readFile(fullPath, 'utf-8');

          // Extract function signatures using regex
          const functionRegex = /(function\s+\w+|const\s+\w+\s*=\s*\([^)]*\)\s*=>|async\s+function\s+\w+|\w+\s*\([^)]*\)\s*\{)/g;
          const functions = content.match(functionRegex) || [];

          for (const func of functions) {
            // Normalize function signature (remove whitespace, simplify)
            const normalized = func.replace(/\s+/g, ' ').trim().toLowerCase();

            // Skip very simple patterns
            if (normalized.length < 15) continue;

            if (!functionSignatures.has(normalized)) {
              functionSignatures.set(normalized, []);
            }
            functionSignatures.get(normalized)!.push(relativePath);
          }
        } catch {
          // Skip files that can't be read
          continue;
        }
      }

      const duplicates: DuplicatePattern[] = [];
      for (const [signature, locations] of functionSignatures) {
        if (locations.length > 1) {
          // Calculate similarity based on exact match (function signatures)
          duplicates.push({
            pattern: `Similar function: ${signature.substring(0, 50)}${signature.length > 50 ? '...' : ''}`,
            locations: [...new Set(locations)], // Remove duplicates
            similarity: 0.95 // High similarity for function signature matches
          });
        }
      }

      return duplicates.slice(0, 3); // Limit to top 3 patterns
    } catch {
      return [];
    }
  }

  /**
   * Detects duplicate import patterns that might indicate shared dependencies
   */
  private async detectDuplicateImports(files: string[]): Promise<DuplicatePattern[]> {
    try {
      const importPatterns = new Map<string, string[]>();

      for (const filePath of files.slice(0, 20)) {
        try {
          const relativePath = filePath.replace('./', '');
          const fullPath = join(this.projectPath, relativePath);
          const content = await fs.readFile(fullPath, 'utf-8');

          // Extract import statements
          const importRegex = /import\s+.*?\s+from\s+['"][^'"]+['"]/g;
          const imports = content.match(importRegex) || [];

          for (const imp of imports) {
            // Normalize import (remove quotes, spaces)
            const normalized = imp.replace(/['"]/g, '').replace(/\s+/g, ' ').trim();

            // Focus on specific utility imports that might be duplicated
            if (normalized.includes('lodash') || normalized.includes('moment') ||
                normalized.includes('uuid') || normalized.includes('crypto') ||
                normalized.includes('fs') || normalized.includes('path')) {

              if (!importPatterns.has(normalized)) {
                importPatterns.set(normalized, []);
              }
              importPatterns.get(normalized)!.push(relativePath);
            }
          }
        } catch {
          continue;
        }
      }

      const duplicates: DuplicatePattern[] = [];
      for (const [pattern, locations] of importPatterns) {
        if (locations.length > 3) { // Only if imported in multiple files
          duplicates.push({
            pattern: `Common import: ${pattern}`,
            locations: [...new Set(locations)].slice(0, 5), // Limit locations
            similarity: 0.85 // Good similarity for shared imports
          });
        }
      }

      return duplicates.slice(0, 2); // Limit to top 2 patterns
    } catch {
      return [];
    }
  }

  /**
   * Detects duplicate utility/validation logic patterns
   */
  private async detectDuplicateUtilities(files: string[]): Promise<DuplicatePattern[]> {
    try {
      const utilityPatterns = new Map<string, string[]>();

      for (const filePath of files.slice(0, 15)) {
        try {
          const relativePath = filePath.replace('./', '');
          const fullPath = join(this.projectPath, relativePath);
          const content = await fs.readFile(fullPath, 'utf-8');

          // Look for common validation/utility patterns
          const patterns = [
            { regex: /email.*validation|validate.*email/gi, name: 'Email validation logic' },
            { regex: /password.*validation|validate.*password/gi, name: 'Password validation logic' },
            { regex: /format.*date|date.*format/gi, name: 'Date formatting logic' },
            { regex: /sanitize.*input|input.*sanitize/gi, name: 'Input sanitization logic' },
            { regex: /error.*handling|handle.*error/gi, name: 'Error handling logic' },
            { regex: /logger?\.|console\.log|console\.error/gi, name: 'Logging patterns' }
          ];

          for (const { regex, name } of patterns) {
            const matches = content.match(regex);
            if (matches && matches.length > 2) { // Multiple instances in same file
              if (!utilityPatterns.has(name)) {
                utilityPatterns.set(name, []);
              }
              utilityPatterns.get(name)!.push(relativePath);
            }
          }
        } catch {
          continue;
        }
      }

      const duplicates: DuplicatePattern[] = [];
      for (const [pattern, locations] of utilityPatterns) {
        if (locations.length > 1) {
          duplicates.push({
            pattern: `Duplicate ${pattern.toLowerCase()}`,
            locations: [...new Set(locations)],
            similarity: 0.80 // Moderate similarity for utility patterns
          });
        }
      }

      return duplicates.slice(0, 2); // Limit to top 2 patterns
    } catch {
      return [];
    }
  }

  /**
   * Detects duplicate TODO/FIXME comments (original logic)
   */
  private async detectDuplicateTodos(): Promise<DuplicatePattern[]> {
    try {
      const { stdout: grepOutput } = await this.execAsync('grep -r -n "TODO\\|FIXME\\|HACK" --include="*.ts" --include="*.js" . | head -10 || echo ""');
      if (grepOutput.trim()) {
        const todoLines = grepOutput.split('\n').filter(line => line.trim());
        if (todoLines.length > 3) {
          return [{
            pattern: 'TODO/FIXME comments',
            locations: todoLines.slice(0, 5).map(line => line.split(':').slice(0, 2).join(':')),
            similarity: 1.0
          }];
        }
      }
      return [];
    } catch {
      return [];
    }
  }
}

