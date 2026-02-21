/**
 * Project Context Analyzer Module
 *
 * Provides comprehensive project context analysis including git status,
 * project structure, framework detection, configuration discovery, and
 * test framework identification.
 *
 * @module core/project-context-analyzer
 */

import { z } from 'zod';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { getPlatformShell } from './shell-utils';
import {
  GitStatus,
  GitStatusSchema,
  GitChangedFile,
  GitCommit,
  ProjectStructure,
  ProjectStructureSchema,
  ProjectEntry,
  ConfigurationInfo,
  ConfigurationInfoSchema,
  TestFrameworkInfo,
  TestFrameworkInfoSchema,
  FrameworkInfo,
  FrameworkInfoSchema,
  FrameworkDetection,
  FrameworkDetectionSchema,
  ConfigFileInfo,
  ConfigFileInfoSchema,
  ProjectContext
} from './types';

// Re-export schemas for convenience and test compatibility
export {
  GitStatusSchema,
  ProjectStructureSchema,
  ConfigurationInfoSchema,
  TestFrameworkInfoSchema,
  FrameworkInfoSchema,
  FrameworkDetectionSchema,
  ConfigFileInfoSchema,
} from './types';

const execAsync = promisify(exec);

// ============================================================================
// Helper Types
// ============================================================================


// ============================================================================
// ProjectContextAnalyzer Class
// ============================================================================

/**
 * Configuration options for ProjectContextAnalyzer
 */
export interface ProjectContextAnalyzerOptions {
  /** Maximum directory depth to scan (default: 10) */
  maxDepth?: number;
  /** Whether to include hidden files/directories (default: false) */
  includeHidden?: boolean;
  /** Directories to exclude from scanning */
  excludeDirectories?: string[];
  /** Whether to analyze git status (default: true) */
  analyzeGit?: boolean;
  /** Whether to detect frameworks (default: true) */
  detectFrameworks?: boolean;
  /** Whether to analyze configuration (default: true) */
  analyzeConfiguration?: boolean;
  /** Whether to detect test frameworks (default: true) */
  detectTests?: boolean;
}

/**
 * Default configuration for ProjectContextAnalyzer
 */
const DEFAULT_OPTIONS: Required<ProjectContextAnalyzerOptions> = {
  maxDepth: 10,
  includeHidden: false,
  excludeDirectories: ['node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.nuxt'],
  analyzeGit: true,
  detectFrameworks: true,
  analyzeConfiguration: true,
  detectTests: true,
};

/**
 * ProjectContextAnalyzer provides comprehensive project analysis capabilities.
 *
 * Analyzes project directories to gather context including:
 * - Git repository status and history
 * - Project structure and file organization
 * - Framework and language detection
 * - Configuration file discovery
 * - Test framework identification
 *
 * @example
 * ```typescript
 * const analyzer = new ProjectContextAnalyzer('/path/to/project');
 *
 * // Get complete project context
 * const context = await analyzer.analyze();
 * console.log(context.git.branch);
 * console.log(context.frameworks.primary?.name);
 *
 * // Get specific analysis
 * const gitStatus = await analyzer.getGitStatus();
 * const structure = await analyzer.getProjectStructure();
 * ```
 */
export class ProjectContextAnalyzer {
  private readonly projectPath: string;
  private readonly options: Required<ProjectContextAnalyzerOptions>;

  /**
   * Create a new ProjectContextAnalyzer instance
   * @param projectPath - Path to the project root directory
   * @param options - Configuration options for the analyzer
   */
  constructor(projectPath: string, options: ProjectContextAnalyzerOptions = {}) {
    this.projectPath = projectPath;
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Perform complete project context analysis
   * @returns Promise resolving to complete project context
   */
  async analyze(): Promise<ProjectContext> {
    const [gitStatus, structure, frameworkDetection, configurations, testFrameworks] = await Promise.all([
      this.options.analyzeGit ? this.getGitStatus() : undefined,
      this.getProjectStructure(),
      this.options.detectFrameworks ? this.detectFrameworks() : this.getEmptyFrameworkDetection(),
      this.options.analyzeConfiguration ? this.getConfigurationInfoList() : [],
      this.options.detectTests ? this.getTestFrameworkInfoList() : [],
    ]);

    return {
      gitStatus,
      structure,
      frameworks: frameworkDetection.frameworks,
      configurations,
      testFrameworks,
      detectedAt: new Date(),
      errors: [],
    };
  }

  /**
   * Get git repository status
   * @returns Promise resolving to git status information
   */
  async getGitStatus(): Promise<GitStatus> {
    try {
      // First check if this is a git repository
      await execAsync('git rev-parse --git-dir', {
        cwd: this.projectPath,
        shell: getPlatformShell().shell,
      });
    } catch {
      // Not a git repository
      return this.getEmptyGitStatus();
    }

    const gitStatus: Partial<GitStatus> = {
      isRepository: true,
      branch: null,
      remoteBranch: null,
      ahead: 0,
      behind: 0,
      staged: [],
      unstaged: [],
      untracked: [],
      hasConflicts: false,
      isDirty: false,
      stashCount: 0,
      remotes: [],
      recentCommits: [],
    };

    try {
      // Get current branch name
      const branchResult = await execAsync('git rev-parse --abbrev-ref HEAD', {
        cwd: this.projectPath,
        shell: getPlatformShell().shell,
      });
      gitStatus.branch = branchResult.stdout.trim() === 'HEAD' ? null : branchResult.stdout.trim();
    } catch {
      // Branch detection failed, keep as null
    }

    try {
      // Get remote tracking branch
      if (gitStatus.branch) {
        const remoteResult = await execAsync(`git rev-parse --abbrev-ref "${gitStatus.branch}@{upstream}"`, {
          cwd: this.projectPath,
          shell: getPlatformShell().shell,
        });
        gitStatus.remoteBranch = remoteResult.stdout.trim();
      }
    } catch {
      // No remote tracking branch
    }

    try {
      // Get ahead/behind counts if we have a remote branch
      if (gitStatus.remoteBranch) {
        const aheadBehindResult = await execAsync(`git rev-list --count --left-right HEAD...${gitStatus.remoteBranch}`, {
          cwd: this.projectPath,
          shell: getPlatformShell().shell,
        });
        const [ahead, behind] = aheadBehindResult.stdout.trim().split('\t').map(n => parseInt(n, 10));
        gitStatus.ahead = ahead || 0;
        gitStatus.behind = behind || 0;
      }
    } catch {
      // Keep default values
    }

    try {
      // Get file status
      const statusResult = await execAsync('git status --porcelain=v1', {
        cwd: this.projectPath,
        shell: getPlatformShell().shell,
      });

      const lines = statusResult.stdout.trim().split('\n').filter(line => line.length > 0);
      const staged: GitChangedFile[] = [];
      const unstaged: GitChangedFile[] = [];
      const untracked: string[] = [];

      for (const line of lines) {
        const statusCode = line.substring(0, 2);
        const filePath = line.substring(3);

        // Check for untracked files
        if (statusCode === '??') {
          untracked.push(filePath);
          continue;
        }

        // Check for conflicts
        if (statusCode.includes('U') || statusCode === 'AA' || statusCode === 'DD') {
          gitStatus.hasConflicts = true;
        }

        // Parse staged changes (first character)
        const stagedStatus = statusCode[0];
        if (stagedStatus !== ' ' && stagedStatus !== '?') {
          // Map git status codes to our enum values
          let mappedStatus: GitChangedFile['status'];
          switch (stagedStatus) {
            case 'M':
              mappedStatus = 'M'; // Modified
              break;
            case 'A':
              mappedStatus = 'A'; // Added
              break;
            case 'D':
              mappedStatus = 'D'; // Deleted
              break;
            case 'R':
              mappedStatus = 'R'; // Renamed
              break;
            case 'C':
              mappedStatus = 'C'; // Copied
              break;
            case 'U':
              mappedStatus = 'U'; // Unmerged (conflict)
              break;
            default:
              mappedStatus = 'M'; // Default to modified
          }

          staged.push({
            path: filePath,
            status: mappedStatus,
          });
        }

        // Parse unstaged changes (second character)
        const unstagedStatus = statusCode[1];
        if (unstagedStatus !== ' ' && unstagedStatus !== '?') {
          let mappedStatus: GitChangedFile['status'];
          switch (unstagedStatus) {
            case 'M':
              mappedStatus = 'M'; // Modified
              break;
            case 'A':
              mappedStatus = 'A'; // Added
              break;
            case 'D':
              mappedStatus = 'D'; // Deleted
              break;
            case 'R':
              mappedStatus = 'R'; // Renamed
              break;
            case 'C':
              mappedStatus = 'C'; // Copied
              break;
            case 'U':
              mappedStatus = 'U'; // Unmerged (conflict)
              break;
            default:
              mappedStatus = 'M'; // Default to modified
          }

          unstaged.push({
            path: filePath,
            status: mappedStatus,
          });
        }
      }

      gitStatus.staged = staged;
      gitStatus.unstaged = unstaged;
      gitStatus.untracked = untracked;
      gitStatus.isDirty = staged.length > 0 || unstaged.length > 0 || untracked.length > 0;
    } catch {
      // Keep default empty arrays
    }

    try {
      // Get last commit information
      const lastCommitResult = await execAsync('git log -1 --format="%H|%s|%ct"', {
        cwd: this.projectPath,
        shell: getPlatformShell().shell,
      });
      const [hash, message, timestamp] = lastCommitResult.stdout.trim().split('|');
      gitStatus.lastCommitHash = hash.substring(0, 7); // Short hash
      gitStatus.lastCommitMessage = message;
      gitStatus.lastCommitTimestamp = new Date(parseInt(timestamp, 10) * 1000);
    } catch {
      // Keep undefined
    }

    try {
      // Get recent commits (last 5)
      const recentCommitsResult = await execAsync('git log -5 --format="%H|%s|%ct|%an|%ae"', {
        cwd: this.projectPath,
        shell: getPlatformShell().shell,
      });

      const commitLines = recentCommitsResult.stdout.trim().split('\n').filter(line => line.length > 0);
      gitStatus.recentCommits = commitLines.map(line => {
        const parts = line.split('|');
        if (parts.length >= 3) {
          const [hash, message, timestamp, author, authorEmail] = parts;
          const parsedTimestamp = parseInt(timestamp, 10);

          return {
            hash: hash ? hash.substring(0, 7) : '', // Short hash
            message: message || '',
            timestamp: isNaN(parsedTimestamp) ? new Date() : new Date(parsedTimestamp * 1000),
            author: author || undefined,
            authorEmail: authorEmail || undefined,
          };
        }
        return null;
      }).filter((commit): commit is GitCommit => commit !== null);
    } catch {
      // Keep default empty array
    }

    try {
      // Get stash count
      const stashResult = await execAsync('git stash list', {
        cwd: this.projectPath,
        shell: getPlatformShell().shell,
      });
      gitStatus.stashCount = stashResult.stdout.trim().split('\n').filter(line => line.length > 0).length;
    } catch {
      // Keep default 0
    }

    try {
      // Get remote list
      const remotesResult = await execAsync('git remote -v', {
        cwd: this.projectPath,
        shell: getPlatformShell().shell,
      });
      const remoteLines = remotesResult.stdout.trim().split('\n').filter(line => line.length > 0);
      const remotes = new Map<string, string>();

      for (const line of remoteLines) {
        const [name, url, type] = line.split(/\s+/);
        // Only include fetch URLs to avoid duplicates
        if (type === '(fetch)') {
          remotes.set(name, url);
        }
      }

      gitStatus.remotes = Array.from(remotes.entries()).map(([name, url]) => ({ name, url }));
    } catch {
      // Keep default empty array
    }

    return GitStatusSchema.parse(gitStatus);
  }

  /**
   * Get project structure analysis
   * @returns Promise resolving to project structure information
   */
  async getProjectStructure(): Promise<ProjectStructure> {
    const structure: Partial<ProjectStructure> = {
      root: this.projectPath,
      totalFiles: 0,
      totalDirectories: 0,
      entries: [],
      rootFiles: [],
      commonDirectories: [],
      hasPackageJson: false,
      hasGitIgnore: false,
      hasReadme: false,
      hasLicense: false,
      excludedDirectories: this.options.excludeDirectories,
      scannedAt: new Date(),
    };

    try {
      // Scan directory structure
      const scanResult = await this.scanDirectory(this.projectPath, '', 0);
      structure.entries = scanResult.entries;
      structure.totalFiles = scanResult.totalFiles;
      structure.totalDirectories = scanResult.totalDirectories;
      structure.maxDepthScanned = scanResult.maxDepth;

      // Get root files
      const rootEntries = await fs.promises.readdir(this.projectPath, { withFileTypes: true });
      structure.rootFiles = rootEntries
        .filter(entry => entry.isFile())
        .map(entry => entry.name);

      // Check for key files
      structure.hasPackageJson = structure.rootFiles.includes('package.json');
      structure.hasGitIgnore = structure.rootFiles.includes('.gitignore');
      structure.hasReadme = structure.rootFiles.some(file => /^readme/i.test(file));
      structure.hasLicense = structure.rootFiles.some(file => /^license/i.test(file));

      // Identify common directories
      const rootDirs = structure.entries
        .filter(entry => entry.type === 'directory' && !entry.path.includes('/'))
        .map(entry => entry.name);

      const commonDirNames = [
        'src', 'lib', 'libs', 'packages', 'apps', 'components', 'utils', 'helpers',
        'test', 'tests', '__tests__', 'spec', '__spec__', 'e2e',
        'build', 'dist', 'out', 'public', 'static', 'assets',
        'config', 'configs', 'scripts', 'tools', 'bin',
        'docs', 'documentation', 'examples', 'demo', 'sample',
        'types', 'typings', '@types'
      ];

      structure.commonDirectories = rootDirs.filter(dir =>
        commonDirNames.includes(dir.toLowerCase())
      );

    } catch (error) {
      // Keep default empty structure if scanning fails
      console.error('Error scanning project structure:', error);
    }

    return ProjectStructureSchema.parse(structure);
  }

  /**
   * Detect frameworks and languages used in the project
   * @returns Promise resolving to framework detection results
   */
  async detectFrameworks(): Promise<FrameworkDetection> {
    const detection: Partial<FrameworkDetection> = {
      frameworks: [],
      languages: [],
    };

    try {
      // Detect package manager
      const packageManager = await this.detectPackageManager();
      if (packageManager) {
        detection.packageManager = packageManager;
      }

      // Analyze package.json for dependencies
      const packageJsonPath = path.join(this.projectPath, 'package.json');
      const packageJsonFrameworks = await this.analyzePackageJson(packageJsonPath);
      detection.frameworks.push(...packageJsonFrameworks);

      // Detect runtime environment
      const runtime = this.detectRuntime(detection.frameworks);
      if (runtime) {
        detection.runtime = runtime;
      }

      // Analyze file patterns for language detection
      const languages = await this.detectLanguages();
      detection.languages = languages;
      if (languages.length > 0) {
        detection.primaryLanguage = languages[0].name.toLowerCase();
      }

      // Detect configuration-based frameworks
      const configFrameworks = await this.detectConfigBasedFrameworks();
      detection.frameworks.push(...configFrameworks);

      // Remove duplicates and sort by confidence
      detection.frameworks = this.deduplicateFrameworks(detection.frameworks);

      // Set primary framework (highest confidence)
      if (detection.frameworks.length > 0) {
        detection.primary = detection.frameworks[0];
      }

    } catch (error) {
      detection.error = `Framework detection failed: ${error instanceof Error ? error.message : String(error)}`;
    }

    return FrameworkDetectionSchema.parse(detection);
  }

  /**
   * Get configuration file information
   * @returns Promise resolving to list of configuration information
   */
  async getConfigurationInfoList(): Promise<ConfigurationInfo[]> {
    const configurations: ConfigurationInfo[] = [];

    // Configuration file patterns to look for
    const configPatterns = [
      // Package managers
      { pattern: 'package.json', format: 'json' as const, purpose: 'package-manager' as const, description: 'Node.js package manifest' },
      { pattern: 'Cargo.toml', format: 'toml' as const, purpose: 'package-manager' as const, description: 'Rust package manifest' },
      { pattern: 'requirements.txt', format: 'other' as const, purpose: 'package-manager' as const, description: 'Python dependencies' },
      { pattern: 'Pipfile', format: 'other' as const, purpose: 'package-manager' as const, description: 'Python Pipenv configuration' },
      { pattern: 'pyproject.toml', format: 'toml' as const, purpose: 'package-manager' as const, description: 'Python project configuration' },

      // TypeScript
      { pattern: 'tsconfig.json', format: 'json' as const, purpose: 'typescript' as const, description: 'TypeScript compiler configuration' },
      { pattern: 'tsconfig.*.json', format: 'json' as const, purpose: 'typescript' as const, description: 'TypeScript project configuration' },

      // Linting and formatting
      { pattern: '.eslintrc*', format: 'json' as const, purpose: 'linting' as const, description: 'ESLint configuration' },
      { pattern: 'eslint.config.*', format: 'javascript' as const, purpose: 'linting' as const, description: 'ESLint flat config' },
      { pattern: '.prettierrc*', format: 'json' as const, purpose: 'linting' as const, description: 'Prettier configuration' },
      { pattern: 'prettier.config.*', format: 'javascript' as const, purpose: 'linting' as const, description: 'Prettier configuration' },

      // Build tools
      { pattern: 'webpack.config.*', format: 'javascript' as const, purpose: 'build' as const, description: 'Webpack build configuration' },
      { pattern: 'vite.config.*', format: 'javascript' as const, purpose: 'build' as const, description: 'Vite build configuration' },
      { pattern: 'rollup.config.*', format: 'javascript' as const, purpose: 'build' as const, description: 'Rollup build configuration' },
      { pattern: 'next.config.*', format: 'javascript' as const, purpose: 'build' as const, description: 'Next.js configuration' },
      { pattern: 'nuxt.config.*', format: 'javascript' as const, purpose: 'build' as const, description: 'Nuxt.js configuration' },

      // Testing
      { pattern: 'jest.config.*', format: 'javascript' as const, purpose: 'testing' as const, description: 'Jest test configuration' },
      { pattern: 'vitest.config.*', format: 'javascript' as const, purpose: 'testing' as const, description: 'Vitest test configuration' },
      { pattern: 'playwright.config.*', format: 'javascript' as const, purpose: 'testing' as const, description: 'Playwright test configuration' },
      { pattern: 'cypress.config.*', format: 'javascript' as const, purpose: 'testing' as const, description: 'Cypress test configuration' },

      // CI/CD
      { pattern: '.github/workflows/*.yml', format: 'yaml' as const, purpose: 'ci-cd' as const, description: 'GitHub Actions workflow' },
      { pattern: '.gitlab-ci.yml', format: 'yaml' as const, purpose: 'ci-cd' as const, description: 'GitLab CI configuration' },
      { pattern: 'azure-pipelines.yml', format: 'yaml' as const, purpose: 'ci-cd' as const, description: 'Azure Pipelines configuration' },

      // Containerization
      { pattern: 'Dockerfile*', format: 'other' as const, purpose: 'containerization' as const, description: 'Docker container definition' },
      { pattern: 'docker-compose*.yml', format: 'yaml' as const, purpose: 'containerization' as const, description: 'Docker Compose configuration' },

      // Environment
      { pattern: '.env*', format: 'env' as const, purpose: 'environment' as const, description: 'Environment variables' },

      // Git
      { pattern: '.gitignore', format: 'other' as const, purpose: 'git' as const, description: 'Git ignore patterns' },
      { pattern: '.gitattributes', format: 'other' as const, purpose: 'git' as const, description: 'Git file attributes' },

      // Editor
      { pattern: '.editorconfig', format: 'ini' as const, purpose: 'editor' as const, description: 'Editor configuration' },
      { pattern: '.vscode/*.json', format: 'json' as const, purpose: 'editor' as const, description: 'VS Code settings' },

      // Documentation
      { pattern: 'README*', format: 'other' as const, purpose: 'documentation' as const, description: 'Project documentation' },
      { pattern: 'CHANGELOG*', format: 'other' as const, purpose: 'documentation' as const, description: 'Change log' },
      { pattern: 'LICENSE*', format: 'other' as const, purpose: 'documentation' as const, description: 'License file' },

      // Security/Node
      { pattern: '.nvmrc', format: 'other' as const, purpose: 'security' as const, description: 'Node Version Manager configuration' },
      { pattern: '.npmrc', format: 'ini' as const, purpose: 'security' as const, description: 'npm configuration' },
    ];

    for (const config of configPatterns) {
      const matchedFiles = await this.findConfigFiles(config.pattern);

      for (const filePath of matchedFiles) {
        try {
          const absolutePath = path.join(this.projectPath, filePath);
          const stats = await fs.promises.stat(absolutePath);

          const configInfo: ConfigurationInfo = {
            name: path.basename(filePath),
            path: filePath,
            format: config.format,
            purpose: config.purpose,
            isValid: true,
            size: stats.size,
            modifiedAt: stats.mtime,
          };

          // Try to parse and extract key settings (for safe formats)
          if (config.format === 'json' && stats.size < 100000) { // Limit size for safety
            try {
              const content = await fs.promises.readFile(absolutePath, 'utf-8');
              const parsed = JSON.parse(content);
              configInfo.keySettings = this.extractSafeSettings(parsed, config.purpose);
            } catch (parseError) {
              configInfo.isValid = false;
              configInfo.validationError = `JSON parse error: ${parseError instanceof Error ? parseError.message : String(parseError)}`;
            }
          }

          configurations.push(configInfo);
        } catch (error) {
          // File might have been deleted between finding and stat-ing
          continue;
        }
      }
    }

    // Sort by purpose and name
    configurations.sort((a, b) => {
      if (a.purpose !== b.purpose) {
        return a.purpose.localeCompare(b.purpose);
      }
      return a.name.localeCompare(b.name);
    });

    return configurations.map(config => ConfigurationInfoSchema.parse(config));
  }

  /**
   * Get test framework information
   * @returns Promise resolving to list of test framework information
   */
  async getTestFrameworkInfoList(): Promise<TestFrameworkInfo[]> {
    const testFrameworks: TestFrameworkInfo[] = [];

    // Test framework detection rules
    const testFrameworkRules = [
      {
        name: 'Jest',
        type: 'unit' as const,
        packageNames: ['jest'],
        configFiles: ['jest.config.js', 'jest.config.ts', 'jest.config.json'],
        testPatterns: ['**/*.test.js', '**/*.test.ts', '**/*.spec.js', '**/*.spec.ts'],
        runCommand: 'npm test',
      },
      {
        name: 'Vitest',
        type: 'unit' as const,
        packageNames: ['vitest'],
        configFiles: ['vitest.config.js', 'vitest.config.ts'],
        testPatterns: ['**/*.test.js', '**/*.test.ts', '**/*.spec.js', '**/*.spec.ts'],
        runCommand: 'npm test',
      },
      {
        name: 'Mocha',
        type: 'unit' as const,
        packageNames: ['mocha'],
        configFiles: ['.mocharc.js', '.mocharc.json', '.mocharc.yml'],
        testPatterns: ['test/**/*.js', 'test/**/*.ts'],
        runCommand: 'npx mocha',
      },
      {
        name: 'Playwright',
        type: 'e2e' as const,
        packageNames: ['@playwright/test', 'playwright'],
        configFiles: ['playwright.config.js', 'playwright.config.ts'],
        testPatterns: ['tests/**/*.spec.js', 'tests/**/*.spec.ts', 'e2e/**/*.spec.js'],
        runCommand: 'npx playwright test',
      },
      {
        name: 'Cypress',
        type: 'e2e' as const,
        packageNames: ['cypress'],
        configFiles: ['cypress.config.js', 'cypress.config.ts'],
        testPatterns: ['cypress/e2e/**/*.cy.js', 'cypress/e2e/**/*.cy.ts'],
        runCommand: 'npx cypress run',
      },
      {
        name: 'Testing Library',
        type: 'component' as const,
        packageNames: ['@testing-library/react', '@testing-library/vue', '@testing-library/angular'],
        configFiles: [],
        testPatterns: ['**/*.test.js', '**/*.test.ts'],
        runCommand: 'npm test',
      },
      {
        name: 'Karma',
        type: 'unit' as const,
        packageNames: ['karma'],
        configFiles: ['karma.conf.js'],
        testPatterns: ['**/*.spec.js', '**/*.spec.ts'],
        runCommand: 'npx karma start',
      },
      {
        name: 'Jasmine',
        type: 'unit' as const,
        packageNames: ['jasmine'],
        configFiles: ['spec/support/jasmine.json'],
        testPatterns: ['spec/**/*.js'],
        runCommand: 'npx jasmine',
      },
    ];

    // Load package.json to check for dependencies
    const packageJson = await this.loadPackageJson();

    for (const rule of testFrameworkRules) {
      let detected = false;
      let version: string | undefined;
      let isDevDependency = false;
      const configFiles: string[] = [];

      // Check if framework is in dependencies
      if (packageJson) {
        const allDeps = {
          ...packageJson.dependencies,
          ...packageJson.devDependencies,
          ...packageJson.peerDependencies,
        };

        for (const packageName of rule.packageNames) {
          if (allDeps[packageName]) {
            detected = true;
            version = allDeps[packageName];
            isDevDependency = packageJson.devDependencies?.[packageName] !== undefined;
            break;
          }
        }
      }

      // Check for configuration files
      for (const configFile of rule.configFiles) {
        try {
          await fs.promises.access(path.join(this.projectPath, configFile));
          configFiles.push(configFile);
          detected = true;
        } catch {
          // File doesn't exist
        }
      }

      if (detected) {
        // Count test files
        const testFileCount = await this.countTestFiles(rule.testPatterns);

        // Detect additional features
        const features = await this.detectTestFrameworkFeatures(rule.name, packageJson);

        const testFramework: TestFrameworkInfo = {
          name: rule.name,
          version,
          type: rule.type,
          configFile: configFiles[0], // Primary config file
          testPatterns: rule.testPatterns,
          runCommand: rule.runCommand,
          testFileCount,
          ...features,
        };

        testFrameworks.push(testFramework);
      }
    }

    // Detect additional test-related tools
    if (packageJson) {
      const additionalTools = await this.detectAdditionalTestTools(packageJson);
      testFrameworks.push(...additionalTools);
    }

    return testFrameworks.map(framework => TestFrameworkInfoSchema.parse(framework));
  }

  /**
   * Get the project path being analyzed
   * @returns Project root path
   */
  getProjectPath(): string {
    return this.projectPath;
  }

  /**
   * Get the analyzer options
   * @returns Current analyzer options
   */
  getOptions(): Readonly<Required<ProjectContextAnalyzerOptions>> {
    return this.options;
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Recursively scan directory structure
   */
  private async scanDirectory(
    absolutePath: string,
    relativePath: string,
    depth: number
  ): Promise<{
    entries: ProjectEntry[];
    totalFiles: number;
    totalDirectories: number;
    maxDepth: number;
  }> {
    const entries: ProjectEntry[] = [];
    let totalFiles = 0;
    let totalDirectories = 0;
    let maxDepth = depth;

    // Stop if we've reached maximum depth
    if (depth >= this.options.maxDepth) {
      return { entries, totalFiles, totalDirectories, maxDepth };
    }

    try {
      const dirEntries = await fs.promises.readdir(absolutePath, { withFileTypes: true });

      for (const entry of dirEntries) {
        const entryName = entry.name;
        const entryRelativePath = relativePath ? `${relativePath}/${entryName}` : entryName;
        const entryAbsolutePath = path.join(absolutePath, entryName);

        // Skip hidden files/directories if not configured to include them
        if (!this.options.includeHidden && entryName.startsWith('.')) {
          continue;
        }

        // Skip excluded directories
        if (entry.isDirectory() && this.options.excludeDirectories.includes(entryName)) {
          continue;
        }

        let entryStats: fs.Stats;
        try {
          entryStats = await fs.promises.stat(entryAbsolutePath);
        } catch {
          // Skip entries we can't stat
          continue;
        }

        const projectEntry: ProjectEntry = {
          name: entryName,
          path: entryRelativePath,
          type: entry.isDirectory() ? 'directory' : 'file',
          modifiedAt: entryStats.mtime,
        };

        if (entry.isFile()) {
          projectEntry.size = entryStats.size;
          totalFiles++;
        } else if (entry.isDirectory()) {
          totalDirectories++;

          // Recursively scan subdirectories
          const subResult = await this.scanDirectory(entryAbsolutePath, entryRelativePath, depth + 1);
          projectEntry.children = subResult.entries;
          totalFiles += subResult.totalFiles;
          totalDirectories += subResult.totalDirectories;
          maxDepth = Math.max(maxDepth, subResult.maxDepth);
        }

        entries.push(projectEntry);
      }
    } catch (error) {
      // Skip directories we can't read
      console.error(`Error reading directory ${absolutePath}:`, error);
    }

    return { entries, totalFiles, totalDirectories, maxDepth };
  }

  /**
   * Detect package manager used in the project
   */
  private async detectPackageManager(): Promise<string | undefined> {
    const lockFiles = [
      { file: 'package-lock.json', manager: 'npm' },
      { file: 'yarn.lock', manager: 'yarn' },
      { file: 'pnpm-lock.yaml', manager: 'pnpm' },
      { file: 'bun.lockb', manager: 'bun' },
    ];

    for (const { file, manager } of lockFiles) {
      try {
        await fs.promises.access(path.join(this.projectPath, file));
        return manager;
      } catch {
        // File doesn't exist, continue checking
      }
    }

    // Default to npm if package.json exists
    try {
      await fs.promises.access(path.join(this.projectPath, 'package.json'));
      return 'npm';
    } catch {
      return undefined;
    }
  }

  /**
   * Analyze package.json for framework dependencies
   */
  private async analyzePackageJson(packageJsonPath: string): Promise<FrameworkInfo[]> {
    const frameworks: FrameworkInfo[] = [];

    try {
      const packageJsonContent = await fs.promises.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageJsonContent);

      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
        ...packageJson.peerDependencies,
        ...packageJson.optionalDependencies,
      };

      // Framework detection rules
      const frameworkRules = [
        // Frontend Frameworks
        { name: 'React', packages: ['react'], category: 'frontend' as const },
        { name: 'Vue', packages: ['vue'], category: 'frontend' as const },
        { name: 'Angular', packages: ['@angular/core'], category: 'frontend' as const },
        { name: 'Svelte', packages: ['svelte'], category: 'frontend' as const },
        { name: 'Solid', packages: ['solid-js'], category: 'frontend' as const },
        { name: 'Preact', packages: ['preact'], category: 'frontend' as const },

        // Full-stack Frameworks
        { name: 'Next.js', packages: ['next'], category: 'fullstack' as const },
        { name: 'Nuxt', packages: ['nuxt'], category: 'fullstack' as const },
        { name: 'SvelteKit', packages: ['@sveltejs/kit'], category: 'fullstack' as const },
        { name: 'Remix', packages: ['@remix-run/node', '@remix-run/react'], category: 'fullstack' as const },
        { name: 'Gatsby', packages: ['gatsby'], category: 'fullstack' as const },

        // Backend Frameworks
        { name: 'Express', packages: ['express'], category: 'backend' as const },
        { name: 'Fastify', packages: ['fastify'], category: 'backend' as const },
        { name: 'NestJS', packages: ['@nestjs/core'], category: 'backend' as const },
        { name: 'Koa', packages: ['koa'], category: 'backend' as const },
        { name: 'Hapi', packages: ['@hapi/hapi'], category: 'backend' as const },

        // Build Tools
        { name: 'Vite', packages: ['vite'], category: 'build' as const },
        { name: 'Webpack', packages: ['webpack'], category: 'build' as const },
        { name: 'Rollup', packages: ['rollup'], category: 'build' as const },
        { name: 'Parcel', packages: ['parcel'], category: 'build' as const },
        { name: 'esbuild', packages: ['esbuild'], category: 'build' as const },

        // Testing Frameworks
        { name: 'Jest', packages: ['jest'], category: 'testing' as const },
        { name: 'Vitest', packages: ['vitest'], category: 'testing' as const },
        { name: 'Mocha', packages: ['mocha'], category: 'testing' as const },
        { name: 'Playwright', packages: ['@playwright/test', 'playwright'], category: 'testing' as const },
        { name: 'Cypress', packages: ['cypress'], category: 'testing' as const },

        // Mobile Frameworks
        { name: 'React Native', packages: ['react-native'], category: 'mobile' as const },
        { name: 'Expo', packages: ['expo'], category: 'mobile' as const },

        // Desktop Frameworks
        { name: 'Electron', packages: ['electron'], category: 'desktop' as const },
        { name: 'Tauri', packages: ['@tauri-apps/api'], category: 'desktop' as const },
      ];

      for (const rule of frameworkRules) {
        const matchingPackage = rule.packages.find(pkg => allDeps[pkg]);
        if (matchingPackage) {
          const isDevDependency = packageJson.devDependencies?.[matchingPackage] !== undefined;
          frameworks.push({
            name: rule.name,
            version: allDeps[matchingPackage],
            category: rule.category,
            confidence: 'high',
            detectedVia: `package.json dependency: ${matchingPackage}`,
            language: 'javascript',
            isDevDependency,
          });
        }
      }

      // Detect TypeScript
      if (allDeps['typescript']) {
        frameworks.push({
          name: 'TypeScript',
          version: allDeps['typescript'],
          category: 'other',
          confidence: 'high',
          detectedVia: 'package.json dependency: typescript',
          language: 'typescript',
          isDevDependency: packageJson.devDependencies?.['typescript'] !== undefined,
        });
      }

    } catch (error) {
      // Package.json doesn't exist or is invalid
    }

    return frameworks;
  }

  /**
   * Detect runtime environment based on detected frameworks
   */
  private detectRuntime(frameworks: FrameworkInfo[]): string | undefined {
    const frameworkNames = frameworks.map(f => f.name.toLowerCase());

    if (frameworkNames.some(name => ['next.js', 'express', 'fastify', 'nestjs'].includes(name))) {
      return 'node';
    }

    if (frameworkNames.some(name => ['react', 'vue', 'angular'].includes(name))) {
      return 'browser';
    }

    if (frameworkNames.includes('react native')) {
      return 'mobile';
    }

    if (frameworkNames.includes('electron')) {
      return 'desktop';
    }

    return undefined;
  }

  /**
   * Detect programming languages by analyzing file extensions
   */
  private async detectLanguages(): Promise<Array<{
    name: string;
    extensions: string[];
    percentage: number;
  }>> {
    const languageMap = new Map<string, { extensions: Set<string>; count: number }>();
    let totalFiles = 0;

    // Language detection rules
    const languageRules = [
      { name: 'TypeScript', extensions: ['.ts', '.tsx'], priority: 1 },
      { name: 'JavaScript', extensions: ['.js', '.jsx', '.mjs', '.cjs'], priority: 2 },
      { name: 'Python', extensions: ['.py', '.pyx', '.pyi'], priority: 3 },
      { name: 'Java', extensions: ['.java'], priority: 4 },
      { name: 'C#', extensions: ['.cs'], priority: 5 },
      { name: 'Go', extensions: ['.go'], priority: 6 },
      { name: 'Rust', extensions: ['.rs'], priority: 7 },
      { name: 'C++', extensions: ['.cpp', '.cc', '.cxx'], priority: 8 },
      { name: 'C', extensions: ['.c'], priority: 9 },
      { name: 'PHP', extensions: ['.php'], priority: 10 },
      { name: 'Ruby', extensions: ['.rb'], priority: 11 },
      { name: 'Swift', extensions: ['.swift'], priority: 12 },
      { name: 'Kotlin', extensions: ['.kt'], priority: 13 },
      { name: 'Dart', extensions: ['.dart'], priority: 14 },
      { name: 'HTML', extensions: ['.html', '.htm'], priority: 15 },
      { name: 'CSS', extensions: ['.css', '.scss', '.sass', '.less'], priority: 16 },
    ];

    const scanLanguagesInDirectory = async (dir: string) => {
      try {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const entryPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            // Skip excluded directories
            if (this.options.excludeDirectories.includes(entry.name)) {
              continue;
            }
            // Skip hidden directories if not configured to include them
            if (!this.options.includeHidden && entry.name.startsWith('.')) {
              continue;
            }
            await scanLanguagesInDirectory(entryPath);
          } else if (entry.isFile()) {
            totalFiles++;
            const ext = path.extname(entry.name).toLowerCase();

            for (const rule of languageRules) {
              if (rule.extensions.includes(ext)) {
                if (!languageMap.has(rule.name)) {
                  languageMap.set(rule.name, { extensions: new Set(rule.extensions), count: 0 });
                }
                languageMap.get(rule.name)!.count++;
                break; // Only count once per file
              }
            }
          }
        }
      } catch {
        // Skip directories we can't read
      }
    };

    await scanLanguagesInDirectory(this.projectPath);

    // Convert to result format and calculate percentages
    const languages = Array.from(languageMap.entries())
      .map(([name, { extensions, count }]) => ({
        name,
        extensions: Array.from(extensions),
        percentage: totalFiles > 0 ? Math.round((count / totalFiles) * 100) : 0,
      }))
      .filter(lang => lang.percentage > 0)
      .sort((a, b) => b.percentage - a.percentage);

    return languages;
  }

  /**
   * Detect frameworks based on configuration files
   */
  private async detectConfigBasedFrameworks(): Promise<FrameworkInfo[]> {
    const frameworks: FrameworkInfo[] = [];

    const configRules = [
      { files: ['next.config.js', 'next.config.mjs', 'next.config.ts'], framework: 'Next.js', category: 'fullstack' as const },
      { files: ['nuxt.config.js', 'nuxt.config.ts'], framework: 'Nuxt', category: 'fullstack' as const },
      { files: ['vite.config.js', 'vite.config.ts'], framework: 'Vite', category: 'build' as const },
      { files: ['webpack.config.js', 'webpack.config.ts'], framework: 'Webpack', category: 'build' as const },
      { files: ['rollup.config.js', 'rollup.config.ts'], framework: 'Rollup', category: 'build' as const },
      { files: ['jest.config.js', 'jest.config.ts'], framework: 'Jest', category: 'testing' as const },
      { files: ['vitest.config.js', 'vitest.config.ts'], framework: 'Vitest', category: 'testing' as const },
      { files: ['playwright.config.js', 'playwright.config.ts'], framework: 'Playwright', category: 'testing' as const },
      { files: ['cypress.config.js', 'cypress.config.ts'], framework: 'Cypress', category: 'testing' as const },
      { files: ['tailwind.config.js', 'tailwind.config.ts'], framework: 'Tailwind CSS', category: 'frontend' as const },
      { files: ['svelte.config.js'], framework: 'Svelte', category: 'frontend' as const },
      { files: ['angular.json'], framework: 'Angular', category: 'frontend' as const },
      { files: ['vue.config.js'], framework: 'Vue', category: 'frontend' as const },
    ];

    for (const rule of configRules) {
      for (const configFile of rule.files) {
        try {
          await fs.promises.access(path.join(this.projectPath, configFile));
          frameworks.push({
            name: rule.framework,
            category: rule.category,
            confidence: 'medium',
            detectedVia: `Configuration file: ${configFile}`,
            configFiles: [configFile],
          });
          break; // Only add once per framework
        } catch {
          // File doesn't exist, continue
        }
      }
    }

    return frameworks;
  }

  /**
   * Remove duplicate frameworks and sort by confidence
   */
  private deduplicateFrameworks(frameworks: FrameworkInfo[]): FrameworkInfo[] {
    const frameworkMap = new Map<string, FrameworkInfo>();

    for (const framework of frameworks) {
      const key = framework.name.toLowerCase();
      const existing = frameworkMap.get(key);

      if (!existing) {
        frameworkMap.set(key, framework);
      } else {
        // Merge information, preferring higher confidence
        const confidenceOrder = { 'high': 3, 'medium': 2, 'low': 1 };
        const currentConfidence = confidenceOrder[existing.confidence || 'medium'];
        const newConfidence = confidenceOrder[framework.confidence || 'medium'];

        if (newConfidence > currentConfidence) {
          frameworkMap.set(key, {
            ...framework,
            configFiles: [...(existing.configFiles || []), ...(framework.configFiles || [])],
          });
        } else {
          // Keep existing but merge config files
          frameworkMap.set(key, {
            ...existing,
            configFiles: [...(existing.configFiles || []), ...(framework.configFiles || [])],
          });
        }
      }
    }

    return Array.from(frameworkMap.values()).sort((a, b) => {
      const confidenceOrder = { 'high': 3, 'medium': 2, 'low': 1 };
      return confidenceOrder[b.confidence || 'medium'] - confidenceOrder[a.confidence || 'medium'];
    });
  }

  /**
   * Find configuration files matching a pattern
   */
  private async findConfigFiles(pattern: string): Promise<string[]> {
    const matchedFiles: string[] = [];

    if (pattern.includes('*')) {
      // Handle glob patterns
      await this.searchPatternInDirectory(this.projectPath, '', pattern, matchedFiles, 0);
    } else {
      // Handle exact file names
      try {
        await fs.promises.access(path.join(this.projectPath, pattern));
        matchedFiles.push(pattern);
      } catch {
        // File doesn't exist
      }
    }

    return matchedFiles;
  }

  /**
   * Recursively search for files matching a pattern
   */
  private async searchPatternInDirectory(
    absolutePath: string,
    relativePath: string,
    pattern: string,
    results: string[],
    depth: number
  ): Promise<void> {
    if (depth >= this.options.maxDepth) {
      return;
    }

    try {
      const entries = await fs.promises.readdir(absolutePath, { withFileTypes: true });

      for (const entry of entries) {
        const entryName = entry.name;
        const entryRelativePath = relativePath ? `${relativePath}/${entryName}` : entryName;
        const entryAbsolutePath = path.join(absolutePath, entryName);

        // Skip hidden files/directories if not configured to include them
        if (!this.options.includeHidden && entryName.startsWith('.') && !pattern.startsWith('.')) {
          continue;
        }

        // Skip excluded directories for recursive search
        if (entry.isDirectory() && this.options.excludeDirectories.includes(entryName)) {
          continue;
        }

        if (entry.isFile()) {
          if (this.matchesPattern(entryRelativePath, pattern)) {
            results.push(entryRelativePath);
          }
        } else if (entry.isDirectory()) {
          await this.searchPatternInDirectory(entryAbsolutePath, entryRelativePath, pattern, results, depth + 1);
        }
      }
    } catch {
      // Skip directories we can't read
    }
  }

  /**
   * Check if a file path matches a glob-like pattern
   */
  private matchesPattern(filePath: string, pattern: string): boolean {
    // Simple pattern matching - convert * to regex
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*');

    const regex = new RegExp(`^${regexPattern}$`, 'i');
    return regex.test(filePath);
  }

  /**
   * Extract safe settings from configuration objects (no secrets)
   */
  private extractSafeSettings(config: any, purpose: string): Record<string, unknown> {
    const safeSettings: Record<string, unknown> = {};

    // Keys that might contain sensitive information - exclude these
    const sensitiveKeys = [
      'password', 'secret', 'key', 'token', 'auth', 'credential',
      'private', 'secure', 'api_key', 'apikey', 'client_secret'
    ];

    const isSafeKey = (key: string): boolean => {
      const lowerKey = key.toLowerCase();
      return !sensitiveKeys.some(sensitive => lowerKey.includes(sensitive));
    };

    const extractSafe = (obj: any, maxDepth = 2, currentDepth = 0): any => {
      if (currentDepth >= maxDepth || obj === null || obj === undefined) {
        return obj;
      }

      if (typeof obj !== 'object') {
        return obj;
      }

      if (Array.isArray(obj)) {
        return obj.slice(0, 5).map(item => extractSafe(item, maxDepth, currentDepth + 1));
      }

      const result: any = {};
      let keyCount = 0;
      for (const [key, value] of Object.entries(obj)) {
        if (keyCount >= 20) break; // Limit number of keys

        if (isSafeKey(key)) {
          result[key] = extractSafe(value, maxDepth, currentDepth + 1);
        }
        keyCount++;
      }

      return result;
    };

    // Extract different settings based on purpose
    switch (purpose) {
      case 'package-manager':
        if (config.name) safeSettings.name = config.name;
        if (config.version) safeSettings.version = config.version;
        if (config.description) safeSettings.description = config.description;
        if (config.scripts && typeof config.scripts === 'object') {
          safeSettings.scripts = Object.keys(config.scripts);
        }
        if (config.dependencies && typeof config.dependencies === 'object') {
          safeSettings.dependencyCount = Object.keys(config.dependencies).length;
        }
        break;

      case 'typescript':
        if (config.compilerOptions) {
          safeSettings.compilerOptions = extractSafe(config.compilerOptions, 2);
        }
        if (config.extends) safeSettings.extends = config.extends;
        break;

      case 'testing':
        if (config.testMatch) safeSettings.testMatch = config.testMatch;
        if (config.collectCoverage !== undefined) safeSettings.collectCoverage = config.collectCoverage;
        if (config.testEnvironment) safeSettings.testEnvironment = config.testEnvironment;
        break;

      default:
        // For other purposes, extract general safe settings
        const extracted = extractSafe(config, 1);
        Object.assign(safeSettings, extracted);
        break;
    }

    return safeSettings;
  }

  /**
   * Load package.json if it exists
   */
  private async loadPackageJson(): Promise<any | null> {
    try {
      const packageJsonPath = path.join(this.projectPath, 'package.json');
      const content = await fs.promises.readFile(packageJsonPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  /**
   * Count test files matching patterns
   */
  private async countTestFiles(patterns: string[]): Promise<number> {
    let count = 0;

    for (const pattern of patterns) {
      const matchedFiles = await this.findConfigFiles(pattern);
      count += matchedFiles.length;
    }

    return count;
  }

  /**
   * Detect additional features for test frameworks
   */
  private async detectTestFrameworkFeatures(
    frameworkName: string,
    packageJson: any
  ): Promise<Partial<TestFrameworkInfo>> {
    const features: Partial<TestFrameworkInfo> = {};

    if (!packageJson) {
      return features;
    }

    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    // Coverage detection
    const coverageTools = ['c8', 'istanbul', 'nyc', '@vitest/coverage', 'jest'];
    const coverageTool = coverageTools.find(tool => allDeps[tool]);
    if (coverageTool) {
      features.coverageEnabled = true;
      features.coverageTool = coverageTool;
    }

    // Watch mode detection (most modern test runners support it)
    const watchSupportedFrameworks = ['jest', 'vitest', 'mocha'];
    if (watchSupportedFrameworks.some(name => frameworkName.toLowerCase().includes(name.toLowerCase()))) {
      features.watchModeAvailable = true;
    }

    // Assertion libraries
    const assertionLibraries = ['chai', 'expect', 'should', '@testing-library/jest-dom'];
    const assertionLib = assertionLibraries.find(lib => allDeps[lib]);
    if (assertionLib) {
      features.assertionLibrary = assertionLib;
    }

    // Mocking libraries
    const mockingLibraries = ['sinon', 'jest', 'vitest', '@testing-library/user-event'];
    const mockingLib = mockingLibraries.find(lib => allDeps[lib]);
    if (mockingLib) {
      features.mockingLibrary = mockingLib;
    }

    // Plugins (framework-specific)
    const plugins: string[] = [];
    switch (frameworkName.toLowerCase()) {
      case 'jest':
        const jestPlugins = ['babel-jest', 'ts-jest', 'jest-environment-jsdom'];
        plugins.push(...jestPlugins.filter(plugin => allDeps[plugin]));
        break;
      case 'vitest':
        const vitestPlugins = ['@vitest/ui', '@vitest/coverage'];
        plugins.push(...vitestPlugins.filter(plugin => allDeps[plugin]));
        break;
      case 'cypress':
        const cypressPlugins = ['@cypress/webpack-preprocessor', '@cypress/code-coverage'];
        plugins.push(...cypressPlugins.filter(plugin => allDeps[plugin]));
        break;
    }

    if (plugins.length > 0) {
      features.plugins = plugins;
    }

    // Test directories
    const commonTestDirs = ['test', 'tests', '__tests__', 'spec', '__spec__', 'e2e', 'cypress'];
    for (const dir of commonTestDirs) {
      try {
        const dirPath = path.join(this.projectPath, dir);
        const stat = await fs.promises.stat(dirPath);
        if (stat.isDirectory()) {
          features.testDirectory = dir;
          break;
        }
      } catch {
        // Directory doesn't exist
      }
    }

    return features;
  }

  /**
   * Detect additional test-related tools
   */
  private async detectAdditionalTestTools(packageJson: any): Promise<TestFrameworkInfo[]> {
    const tools: TestFrameworkInfo[] = [];

    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    // Storybook (component testing/documentation)
    if (allDeps['@storybook/react'] || allDeps['@storybook/vue'] || allDeps['@storybook/angular']) {
      tools.push({
        name: 'Storybook',
        type: 'component',
        version: allDeps['@storybook/react'] || allDeps['@storybook/vue'] || allDeps['@storybook/angular'],
        testPatterns: ['**/*.stories.js', '**/*.stories.ts'],
        runCommand: 'npm run storybook',
        watchModeAvailable: true,
      });
    }

    // ESLint with testing plugins
    if (allDeps['eslint']) {
      const testingPlugins = [
        'eslint-plugin-jest',
        'eslint-plugin-testing-library',
        'eslint-plugin-cypress'
      ].filter(plugin => allDeps[plugin]);

      if (testingPlugins.length > 0) {
        tools.push({
          name: 'ESLint (Testing)',
          type: 'other',
          version: allDeps['eslint'],
          plugins: testingPlugins,
          runCommand: 'npm run lint',
        });
      }
    }

    return tools;
  }

  /**
   * Get empty git status for when git analysis is disabled
   */
  private getEmptyGitStatus(): GitStatus {
    return {
      isRepository: false,
      branch: null,
      remoteBranch: null,
      ahead: 0,
      behind: 0,
      staged: [],
      unstaged: [],
      untracked: [],
      hasConflicts: false,
      isDirty: false,
      stashCount: 0,
      remotes: [],
      recentCommits: [],
    };
  }

  /**
   * Get empty framework detection for when detection is disabled
   */
  private getEmptyFrameworkDetection(): FrameworkDetection {
    return {
      frameworks: [],
      languages: [],
    };
  }

}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Singleton instance for global use
 */
let defaultAnalyzer: ProjectContextAnalyzer | null = null;

/**
 * Get or create a project context analyzer for the given path
 * @param projectPath - Path to the project root directory
 * @param options - Configuration options for the analyzer
 * @returns ProjectContextAnalyzer instance
 */
export function getProjectContextAnalyzer(
  projectPath: string,
  options?: ProjectContextAnalyzerOptions
): ProjectContextAnalyzer {
  if (!defaultAnalyzer || defaultAnalyzer.getProjectPath() !== projectPath) {
    defaultAnalyzer = new ProjectContextAnalyzer(projectPath, options);
  }
  return defaultAnalyzer;
}

/**
 * Convenience function to analyze a project
 * @param projectPath - Path to the project root directory
 * @param options - Configuration options for the analyzer
 * @returns Promise resolving to complete project context
 */
export async function analyzeProject(
  projectPath: string,
  options?: ProjectContextAnalyzerOptions
): Promise<ProjectContext> {
  const analyzer = new ProjectContextAnalyzer(projectPath, options);
  return analyzer.analyze();
}
