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
  StaleCommentFinding
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
  /**
   * Find stale TODO/FIXME/HACK comments using git blame
   */
  private async findStaleComments(): Promise<OutdatedDocumentation[]> {
    try {
      const { StaleCommentDetector } = await import('./stale-comment-detector');

      // Use configuration if available
      const config = this.config.documentation?.outdatedDocs || {};
      const detector = new StaleCommentDetector(this.projectPath, config);

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

