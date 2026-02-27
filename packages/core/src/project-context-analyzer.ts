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
  ParsedConfigurationInfo,
  ParsedConfigurationInfoSchema,
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
  ParsedConfigurationInfoSchema,
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

  // Cache for expensive operations
  private readonly cache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  private static readonly DEFAULT_CACHE_TTL = 300000; // 5 minutes in milliseconds

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
   * Get cached data if available and not expired
   * @param key - Cache key
   * @returns Cached data or undefined if not found or expired
   */
  private getCachedData<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
      return undefined;
    }

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.data as T;
  }

  /**
   * Set data in cache with TTL
   * @param key - Cache key
   * @param data - Data to cache
   * @param ttl - Time to live in milliseconds (default: 5 minutes)
   */
  private setCachedData<T>(key: string, data: T, ttl: number = ProjectContextAnalyzer.DEFAULT_CACHE_TTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  /**
   * Clear all cached data
   */
  public clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
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
    const cacheKey = `git-status-${this.projectPath}`;
    const cached = this.getCachedData<GitStatus>(cacheKey);
    if (cached) {
      return cached;
    }
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
      }).filter((commit): commit is NonNullable<typeof commit> => commit !== null) as GitCommit[];
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

    const result = GitStatusSchema.parse(gitStatus);
    this.setCachedData(cacheKey, result, 30000); // Cache git status for 30 seconds (shorter TTL as it changes frequently)
    return result;
  }

  /**
   * Get project structure analysis
   * @returns Promise resolving to project structure information
   */
  async getProjectStructure(): Promise<ProjectStructure> {
    const cacheKey = `project-structure-${this.projectPath}`;
    const cached = this.getCachedData<ProjectStructure>(cacheKey);
    if (cached) {
      return cached;
    }
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

    const result = ProjectStructureSchema.parse(structure);
    this.setCachedData(cacheKey, result); // Cache project structure for 5 minutes
    return result;
  }

  /**
   * Analyze project structure with enhanced directory layout analysis
   *
   * This method provides detailed analysis including:
   * - Directory layout analysis with top-level directories
   * - File count by extension for understanding project composition
   * - Detection of src/test/docs folders following common naming patterns
   * - Monorepo structure identification and workspace discovery
   *
   * @returns Promise resolving to enhanced project structure information
   */
  async analyzeProjectStructure(): Promise<ProjectStructure> {
    // Start with the basic structure from existing method
    const basicStructure = await this.getProjectStructure();

    // Enhance with additional analysis
    const [
      filesByExtension,
      topLevelDirectories,
      detectedFolders,
      { isMonorepo, workspaces }
    ] = await Promise.all([
      this.analyzeFilesByExtension(),
      this.getTopLevelDirectories(),
      this.detectImportantFolders(),
      this.analyzeMonorepoStructure()
    ]);

    return ProjectStructureSchema.parse({
      ...basicStructure,
      filesByExtension,
      topLevelDirectories,
      detectedFolders,
      isMonorepo,
      workspaces
    });
  }

  /**
   * Detect frameworks and languages used in the project
   * @returns Promise resolving to framework detection results
   */
  async detectFrameworks(): Promise<FrameworkDetection> {
    const cacheKey = `frameworks-${this.projectPath}`;
    const cached = this.getCachedData<FrameworkDetection>(cacheKey);
    if (cached) {
      return cached;
    }
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

      // Run all manifest analyses in parallel for better performance
      const packageJsonPath = path.join(this.projectPath, 'package.json');
      const [nodeFrameworks, pythonFrameworks, rubyFrameworks, javaFrameworks] =
        await Promise.all([
          this.analyzePackageJson(packageJsonPath),
          this.analyzePythonDependencies(),
          this.analyzeGemfile(),
          this.analyzeJavaDependencies(),
        ]);

      // Combine all framework detections
      detection.frameworks.push(...nodeFrameworks, ...pythonFrameworks, ...rubyFrameworks, ...javaFrameworks);

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

      // Detect frameworks based on file patterns and project structure
      const patternFrameworks = await this.detectPatternBasedFrameworks();
      detection.frameworks.push(...patternFrameworks);

      // Remove duplicates and sort by confidence
      detection.frameworks = this.deduplicateFrameworks(detection.frameworks);

      // Set primary framework (highest confidence)
      if (detection.frameworks.length > 0) {
        detection.primary = detection.frameworks[0];
      }

    } catch (error) {
      detection.error = `Framework detection failed: ${error instanceof Error ? error.message : String(error)}`;
    }

    const result = FrameworkDetectionSchema.parse(detection);
    this.setCachedData(cacheKey, result); // Cache framework detection for 5 minutes
    return result;
  }

  /**
   * Get configuration file information
   * @returns Promise resolving to list of configuration information
   */
  async getConfigurationInfoList(): Promise<ConfigurationInfo[]> {
    const cacheKey = `configurations-${this.projectPath}`;
    const cached = this.getCachedData<ConfigurationInfo[]>(cacheKey);
    if (cached) {
      return cached;
    }
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

    const result = configurations.map(config => ConfigurationInfoSchema.parse(config));
    this.setCachedData(cacheKey, result); // Cache configurations for 5 minutes
    return result;
  }

  /**
   * Parse configuration files and extract detailed settings
   * @param configurations - Array of configuration information to parse
   * @returns Promise resolving to array of parsed configuration information
   */
  async parseConfigurations(configurations?: ConfigurationInfo[]): Promise<ParsedConfigurationInfo[]> {
    // If no configurations provided, get them first
    const configsToProcess = configurations || await this.getConfigurationInfoList();
    const parsedConfigurations: ParsedConfigurationInfo[] = [];

    for (const config of configsToProcess) {
      try {
        const parsed = await this.parseIndividualConfiguration(config);
        parsedConfigurations.push(parsed);
      } catch (error) {
        // Create a parsed configuration with error information
        const errorConfig: ParsedConfigurationInfo = {
          ...config,
          isValid: false,
          parseError: `Failed to parse ${config.name}: ${error instanceof Error ? error.message : String(error)}`,
        };
        parsedConfigurations.push(errorConfig);
      }
    }

    return parsedConfigurations;
  }

  /**
   * Parse an individual configuration file
   * @private
   */
  private async parseIndividualConfiguration(config: ConfigurationInfo): Promise<ParsedConfigurationInfo> {
    const filePath = path.join(this.projectPath, config.path);

    // Check if file exists
    if (!await this.fileExists(filePath)) {
      return {
        ...config,
        isValid: false,
        parseError: `File not found: ${config.path}`,
      };
    }

    // Read file content
    let content: string;
    try {
      content = await fs.promises.readFile(filePath, 'utf-8');
    } catch (error) {
      return {
        ...config,
        isValid: false,
        parseError: `Failed to read file: ${error instanceof Error ? error.message : String(error)}`,
      };
    }

    // Parse based on format
    let parsed: Record<string, unknown>;
    try {
      parsed = await this.parseConfigurationContent(content, config.format, config.name);
    } catch (error) {
      return {
        ...config,
        isValid: false,
        parseError: error instanceof Error ? error.message : String(error),
      };
    }

    // Extract purpose-specific settings
    const result: ParsedConfigurationInfo = {
      ...config,
      parsed,
      isValid: true,
    };

    // Extract specific configuration sections based on purpose
    this.extractPurposeSpecificSettings(result, parsed, config.purpose);

    return result;
  }

  /**
   * Parse configuration content based on format
   * @private
   */
  private async parseConfigurationContent(
    content: string,
    format: 'json' | 'yaml' | 'toml' | 'javascript' | 'typescript' | 'ini' | 'env' | 'xml' | 'other',
    fileName: string
  ): Promise<Record<string, unknown>> {
    switch (format) {
      case 'json':
        return JSON.parse(content);

      case 'yaml':
        // For now, handle yaml as simple key-value pairs since we don't have yaml parser
        return this.parseSimpleYaml(content);

      case 'javascript':
      case 'typescript':
        // For JavaScript/TypeScript config files, extract CommonJS/ESM exports
        return this.parseJavaScriptConfig(content, fileName);

      case 'env':
        return this.parseEnvFile(content);

      case 'ini':
        return this.parseIniFile(content);

      case 'toml':
        // Basic TOML parsing - just extract key-value pairs
        return this.parseSimpleToml(content);

      case 'other':
      case 'xml':
        // For other formats, return basic structure
        return { content, format };

      default:
        return { content, format };
    }
  }

  /**
   * Extract purpose-specific settings from parsed configuration
   * @private
   */
  private extractPurposeSpecificSettings(
    result: ParsedConfigurationInfo,
    parsed: Record<string, unknown>,
    purpose: string
  ): void {
    switch (purpose) {
      case 'typescript':
        if (parsed.compilerOptions) {
          result.compilerOptions = parsed.compilerOptions as Record<string, unknown>;
        }
        if (parsed.extends) {
          result.extends = parsed.extends as string | string[];
        }
        break;

      case 'package-manager':
        if (parsed.scripts) {
          result.scripts = parsed.scripts as Record<string, string>;
        }
        if (parsed.dependencies || parsed.devDependencies || parsed.peerDependencies || parsed.optionalDependencies) {
          result.dependencies = {
            runtime: parsed.dependencies as Record<string, string> || {},
            development: parsed.devDependencies as Record<string, string> || {},
            peer: parsed.peerDependencies as Record<string, string> || {},
            optional: parsed.optionalDependencies as Record<string, string> || {},
          };
        }
        break;

      case 'build':
        // Extract build configuration
        result.buildConfig = this.extractBuildConfig(parsed);
        break;

      case 'testing':
        // Extract test configuration
        result.testConfig = this.extractTestConfig(parsed);
        break;

      case 'linting':
        // Extract linting configuration
        result.lintConfig = this.extractLintConfig(parsed);
        break;

      case 'environment':
        // Environment variables
        result.environment = parsed;
        break;
    }

    // Always extract safe settings using existing method
    result.keySettings = this.extractSafeSettings(parsed, purpose);
  }

  /**
   * Extract build configuration settings
   * @private
   */
  private extractBuildConfig(parsed: Record<string, unknown>): Record<string, unknown> {
    const buildConfig: Record<string, unknown> = {};

    // Common build settings
    const buildKeys = ['entry', 'output', 'mode', 'target', 'plugins', 'module', 'resolve', 'optimization', 'devServer'];

    for (const key of buildKeys) {
      if (parsed[key]) {
        buildConfig[key] = parsed[key];
      }
    }

    return buildConfig;
  }

  /**
   * Extract test configuration settings
   * @private
   */
  private extractTestConfig(parsed: Record<string, unknown>): Record<string, unknown> {
    const testConfig: Record<string, unknown> = {};

    // Common test settings
    const testKeys = ['testMatch', 'testIgnore', 'collectCoverage', 'coverageDirectory', 'setupFiles', 'testEnvironment'];

    for (const key of testKeys) {
      if (parsed[key]) {
        testConfig[key] = parsed[key];
      }
    }

    return testConfig;
  }

  /**
   * Extract linting configuration settings
   * @private
   */
  private extractLintConfig(parsed: Record<string, unknown>): Record<string, unknown> {
    const lintConfig: Record<string, unknown> = {};

    // Common lint settings
    const lintKeys = ['extends', 'rules', 'plugins', 'env', 'parser', 'parserOptions', 'overrides'];

    for (const key of lintKeys) {
      if (parsed[key]) {
        lintConfig[key] = parsed[key];
      }
    }

    return lintConfig;
  }

  /**
   * Parse simple YAML content (basic key-value pairs)
   * @private
   */
  private parseSimpleYaml(content: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes(':')) {
        const [key, ...valueParts] = trimmed.split(':');
        const value = valueParts.join(':').trim();
        if (key && value) {
          result[key.trim()] = this.parseYamlValue(value);
        }
      }
    }

    return result;
  }

  /**
   * Parse YAML value to appropriate type
   * @private
   */
  private parseYamlValue(value: string): unknown {
    const trimmed = value.trim();

    // Boolean values
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;

    // Numeric values
    if (/^\d+$/.test(trimmed)) return parseInt(trimmed, 10);
    if (/^\d+\.\d+$/.test(trimmed)) return parseFloat(trimmed);

    // Remove quotes
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
      return trimmed.slice(1, -1);
    }

    return trimmed;
  }

  /**
   * Parse JavaScript configuration files
   * @private
   */
  private parseJavaScriptConfig(content: string, fileName: string): Record<string, unknown> {
    // WARNING: This is a simplified parser for JavaScript config files
    // It only supports basic object literals with simple key-value pairs
    // Complex expressions, functions, or nested objects may not be parsed correctly
    // For production use, consider using a proper JS parser like @babel/parser
    const result: Record<string, unknown> = {};

    // Try to extract module.exports or export default patterns
    const moduleExportsMatch = content.match(/module\.exports\s*=\s*({[\s\S]*?});?\s*$/m);
    const exportDefaultMatch = content.match(/export\s+default\s+({[\s\S]*?});?\s*$/m);

    if (moduleExportsMatch || exportDefaultMatch) {
      const configObject = moduleExportsMatch?.[1] || exportDefaultMatch?.[1];
      if (configObject) {
        try {
          // Safer approach: only handle simple object literals
          // Warning: This is a simplified parser that only supports basic object structures
          let sanitized = configObject;

          // Remove trailing commas (safer approach)
          sanitized = sanitized.replace(/,(\s*[}\]])/g, '$1');

          // Only quote unquoted keys if they don't appear to already be quoted
          // This is still limited but safer than the previous approach
          sanitized = sanitized.replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":');

          // Simple single quote replacement only outside of strings (very basic)
          // This is still not perfect but better than global replacement
          sanitized = sanitized.replace(/([:\s,\[{]\s*)'([^']*)'(\s*[,\]\}:\s])/g, '$1"$2"$3');

          return JSON.parse(sanitized);
        } catch {
          // If parsing fails, return basic info
          result.configType = 'javascript';
          result.fileName = fileName;
          result.hasModuleExports = !!moduleExportsMatch;
          result.hasExportDefault = !!exportDefaultMatch;
        }
      }
    }

    return result;
  }

  /**
   * Parse environment file content
   * @private
   */
  private parseEnvFile(content: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [key, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=');
        if (key) {
          // Don't include sensitive environment variables
          const lowerKey = key.toLowerCase();
          if (!lowerKey.includes('password') && !lowerKey.includes('secret') &&
              !lowerKey.includes('key') && !lowerKey.includes('token')) {
            result[key.trim()] = value.trim();
          }
        }
      }
    }

    return result;
  }

  /**
   * Parse INI file content
   * @private
   */
  private parseIniFile(content: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const lines = content.split('\n');
    let currentSection = '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith(';')) {
        continue;
      }

      // Section header
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        currentSection = trimmed.slice(1, -1);
        result[currentSection] = {};
        continue;
      }

      // Key-value pair
      if (trimmed.includes('=')) {
        const [key, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=').trim();
        if (key) {
          const section = currentSection ? result[currentSection] as Record<string, unknown> : result;
          section[key.trim()] = value;
        }
      }
    }

    return result;
  }

  /**
   * Parse simple TOML content
   * @private
   */
  private parseSimpleToml(content: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const lines = content.split('\n');
    let currentSection = '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      // Section header
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        currentSection = trimmed.slice(1, -1);
        result[currentSection] = {};
        continue;
      }

      // Key-value pair
      if (trimmed.includes('=')) {
        const [key, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=').trim();
        if (key) {
          const section = currentSection ? result[currentSection] as Record<string, unknown> : result;
          section[key.trim()] = this.parseTomlValue(value);
        }
      }
    }

    return result;
  }

  /**
   * Parse TOML value to appropriate type
   * @private
   */
  private parseTomlValue(value: string): unknown {
    const trimmed = value.trim();

    // Boolean values
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;

    // Numeric values
    if (/^\d+$/.test(trimmed)) return parseInt(trimmed, 10);
    if (/^\d+\.\d+$/.test(trimmed)) return parseFloat(trimmed);

    // String values (remove quotes)
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
      return trimmed.slice(1, -1);
    }
    if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
      return trimmed.slice(1, -1);
    }

    return trimmed;
  }

  /**
   * Check if file exists
   * @private
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get test framework information
   * @returns Promise resolving to list of test framework information
   */
  async getTestFrameworkInfoList(): Promise<TestFrameworkInfo[]> {
    const cacheKey = `test-frameworks-${this.projectPath}`;
    const cached = this.getCachedData<TestFrameworkInfo[]>(cacheKey);
    if (cached) {
      return cached;
    }
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

    const result = testFrameworks.map(framework => TestFrameworkInfoSchema.parse(framework));
    this.setCachedData(cacheKey, result); // Cache test frameworks for 5 minutes
    return result;
  }

  /**
   * Detect test frameworks in the project
   * Returns framework name, config file path, and test run command for detected test frameworks
   * @returns Promise resolving to array of detected test framework information
   */
  async detectTestFrameworks(): Promise<Array<{
    name: string;
    configFile?: string;
    runCommand: string;
  }>> {
    const detectedFrameworks: Array<{
      name: string;
      configFile?: string;
      runCommand: string;
    }> = [];

    // Enhanced test framework detection rules with broader support
    const testFrameworkRules = [
      {
        name: 'Jest',
        packageNames: ['jest'],
        configFiles: ['jest.config.js', 'jest.config.ts', 'jest.config.json', 'jest.config.mjs'],
        runCommand: 'npm test',
      },
      {
        name: 'Vitest',
        packageNames: ['vitest'],
        configFiles: ['vitest.config.js', 'vitest.config.ts', 'vitest.config.mjs', 'vite.config.js', 'vite.config.ts'],
        runCommand: 'vitest',
      },
      {
        name: 'Mocha',
        packageNames: ['mocha'],
        configFiles: ['.mocharc.js', '.mocharc.json', '.mocharc.yml', '.mocharc.yaml', 'mocha.opts'],
        runCommand: 'mocha',
      },
      {
        name: 'Pytest',
        packageNames: ['pytest'],
        configFiles: ['pytest.ini', 'pyproject.toml', 'tox.ini', 'setup.cfg'],
        testIndicators: ['test_*.py', '*_test.py', 'tests/'],
        runCommand: 'pytest',
      },
      {
        name: 'Playwright',
        packageNames: ['@playwright/test', 'playwright'],
        configFiles: ['playwright.config.js', 'playwright.config.ts'],
        runCommand: 'playwright test',
      },
      {
        name: 'Cypress',
        packageNames: ['cypress'],
        configFiles: ['cypress.config.js', 'cypress.config.ts', 'cypress.json'],
        runCommand: 'cypress run',
      },
      {
        name: 'Karma',
        packageNames: ['karma'],
        configFiles: ['karma.conf.js'],
        runCommand: 'karma start',
      },
      {
        name: 'Jasmine',
        packageNames: ['jasmine'],
        configFiles: ['spec/support/jasmine.json'],
        runCommand: 'jasmine',
      },
      {
        name: 'AVA',
        packageNames: ['ava'],
        configFiles: ['ava.config.js', 'ava.config.mjs'],
        runCommand: 'ava',
      },
      {
        name: 'Tape',
        packageNames: ['tape'],
        configFiles: [],
        runCommand: 'tape',
      },
      {
        name: 'QUnit',
        packageNames: ['qunit'],
        configFiles: [],
        runCommand: 'qunit',
      },
      {
        name: 'Unittest',
        packageNames: [],
        configFiles: [],
        testIndicators: ['test_*.py', '*_test.py', 'tests/'],
        runCommand: 'python -m unittest',
      },
      {
        name: 'Cargo Test',
        packageNames: [],  // Rust uses Cargo.toml, not package.json
        configFiles: ['Cargo.toml'],
        testIndicators: ['tests/', 'src/lib.rs', 'src/main.rs'],
        runCommand: 'cargo test',
      },
      {
        name: 'RSpec',
        packageNames: [],  // Ruby uses Gemfile, not package.json
        configFiles: ['.rspec', 'spec/spec_helper.rb', 'spec/rails_helper.rb'],
        testIndicators: ['spec/', 'Gemfile'],
        runCommand: 'bundle exec rspec',
      },
      {
        name: 'JUnit',
        packageNames: [],  // Java uses Maven/Gradle, not package.json
        configFiles: ['pom.xml', 'build.gradle', 'build.gradle.kts'],
        testIndicators: ['src/test/java/', 'src/test/'],
        runCommand: 'mvn test',
      },
    ];

    // Load package.json to check for dependencies
    const packageJson = await this.loadPackageJson();

    for (const rule of testFrameworkRules) {
      let detected = false;
      let configFile: string | undefined;

      // Check if framework is in dependencies
      if (packageJson && rule.packageNames.length > 0) {
        const allDeps = {
          ...packageJson.dependencies,
          ...packageJson.devDependencies,
          ...packageJson.peerDependencies,
        };

        for (const packageName of rule.packageNames) {
          if (allDeps[packageName]) {
            detected = true;
            break;
          }
        }
      }

      // Check for configuration files
      for (const configFileName of rule.configFiles) {
        try {
          await fs.promises.access(path.join(this.projectPath, configFileName));
          configFile = configFileName;
          detected = true;
          break; // Use the first found config file
        } catch {
          // File doesn't exist
        }
      }

      // For frameworks without npm packages (like Python unittest), check for test indicators
      if (!detected && rule.testIndicators) {
        for (const indicator of rule.testIndicators) {
          if (indicator.endsWith('/')) {
            // Check for directory
            try {
              const stats = await fs.promises.stat(path.join(this.projectPath, indicator));
              if (stats.isDirectory()) {
                detected = true;
                break;
              }
            } catch {
              // Directory doesn't exist
            }
          } else {
            // Check for file patterns
            try {
              const matchedFiles = await this.findConfigFiles(indicator);
              if (matchedFiles.length > 0) {
                detected = true;
                break;
              }
            } catch {
              // Pattern matching failed
            }
          }
        }
      }

      if (detected) {
        detectedFrameworks.push({
          name: rule.name,
          configFile,
          runCommand: rule.runCommand,
        });
      }
    }

    return detectedFrameworks;
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
  // Private Helper Methods for analyzeProjectStructure()
  // ============================================================================

  /**
   * Analyze files by extension to understand project composition
   */
  private async analyzeFilesByExtension(): Promise<Record<string, number>> {
    const extensionCounts: Record<string, number> = {};

    const analyzeDirectory = async (dirPath: string, depth: number = 0): Promise<void> => {
      if (depth >= this.options.maxDepth) {
        return;
      }

      try {
        const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
          const entryPath = path.join(dirPath, entry.name);

          // Skip hidden files/directories if not configured to include them
          if (!this.options.includeHidden && entry.name.startsWith('.')) {
            continue;
          }

          // Skip excluded directories
          if (entry.isDirectory() && this.options.excludeDirectories.includes(entry.name)) {
            continue;
          }

          if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            const extension = ext || '[no extension]';
            extensionCounts[extension] = (extensionCounts[extension] || 0) + 1;
          } else if (entry.isDirectory()) {
            await analyzeDirectory(entryPath, depth + 1);
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    };

    await analyzeDirectory(this.projectPath);
    return extensionCounts;
  }

  /**
   * Get list of top-level directories in the project root
   */
  private async getTopLevelDirectories(): Promise<string[]> {
    try {
      const entries = await fs.promises.readdir(this.projectPath, { withFileTypes: true });
      return entries
        .filter(entry => entry.isDirectory())
        .filter(entry => {
          // Skip hidden directories if not configured to include them
          if (!this.options.includeHidden && entry.name.startsWith('.')) {
            return false;
          }
          // Skip excluded directories
          return !this.options.excludeDirectories.includes(entry.name);
        })
        .map(entry => entry.name)
        .sort();
    } catch (error) {
      return [];
    }
  }

  /**
   * Detect important folders following common naming patterns
   */
  private async detectImportantFolders(): Promise<{ src?: string; test?: string; docs?: string } | undefined> {
    const detectedFolders: { src?: string; test?: string; docs?: string } = {};

    try {
      const entries = await fs.promises.readdir(this.projectPath, { withFileTypes: true });
      const directories = entries
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name);

      // Define patterns for each folder type
      const patterns = {
        src: [
          'src', 'source', 'lib', 'libs', 'packages', 'apps', 'app',
          'components', 'modules', 'services'
        ],
        test: [
          'test', 'tests', '__tests__', 'spec', '__spec__', 'e2e',
          'testing', 'test-utils', 'cypress', 'playwright'
        ],
        docs: [
          'docs', 'documentation', 'doc', 'guide', 'guides',
          'examples', 'demo', 'demos', 'sample', 'samples'
        ]
      };

      // Find best match for each folder type
      for (const [folderType, possibleNames] of Object.entries(patterns)) {
        for (const possibleName of possibleNames) {
          const exactMatch = directories.find(dir => dir.toLowerCase() === possibleName.toLowerCase());
          if (exactMatch) {
            (detectedFolders as any)[folderType] = exactMatch;
            break;
          }
        }

        // If no exact match, look for directories containing the pattern
        if (!(detectedFolders as any)[folderType]) {
          for (const possibleName of possibleNames.slice(0, 3)) { // Only check primary names
            const partialMatch = directories.find(dir =>
              dir.toLowerCase().includes(possibleName.toLowerCase())
            );
            if (partialMatch) {
              (detectedFolders as any)[folderType] = partialMatch;
              break;
            }
          }
        }
      }
    } catch (error) {
      // Return undefined if we can't read the directory
      return undefined;
    }

    // Return undefined if no folders were detected
    if (Object.keys(detectedFolders).length === 0) {
      return undefined;
    }

    return detectedFolders;
  }

  /**
   * Analyze monorepo structure and discover workspaces
   */
  private async analyzeMonorepoStructure(): Promise<{ isMonorepo: boolean; workspaces?: string[] }> {
    let isMonorepo = false;
    let workspaces: string[] | undefined;

    try {
      // Check package.json for workspace configuration
      const packageJsonPath = path.join(this.projectPath, 'package.json');
      try {
        const packageJsonContent = await fs.promises.readFile(packageJsonPath, 'utf-8');
        const packageJson = JSON.parse(packageJsonContent);

        // Check for npm/yarn workspaces
        if (packageJson.workspaces) {
          isMonorepo = true;
          if (Array.isArray(packageJson.workspaces)) {
            workspaces = packageJson.workspaces;
          } else if (packageJson.workspaces.packages && Array.isArray(packageJson.workspaces.packages)) {
            workspaces = packageJson.workspaces.packages;
          }
        }
      } catch (error) {
        // package.json doesn't exist or is invalid, continue with other checks
      }

      // Check for pnpm workspace
      if (!isMonorepo) {
        try {
          const pnpmWorkspacePath = path.join(this.projectPath, 'pnpm-workspace.yaml');
          await fs.promises.access(pnpmWorkspacePath);
          isMonorepo = true;

          try {
            const pnpmWorkspaceContent = await fs.promises.readFile(pnpmWorkspacePath, 'utf-8');
            // Simple YAML parsing for packages array
            const packagesMatch = pnpmWorkspaceContent.match(/packages:\s*\n((?:\s*-\s*[^\n]+\n)*)/);
            if (packagesMatch) {
              workspaces = packagesMatch[1]
                .split('\n')
                .map(line => line.trim())
                .filter(line => line.startsWith('-'))
                .map(line => line.substring(1).trim().replace(/^['"]|['"]$/g, ''))
                .filter(Boolean);
            }
          } catch (error) {
            // Could not parse pnpm-workspace.yaml, but it exists so it's still a monorepo
          }
        } catch (error) {
          // pnpm-workspace.yaml doesn't exist
        }
      }

      // Check for rush.json (Microsoft Rush monorepo)
      if (!isMonorepo) {
        try {
          const rushJsonPath = path.join(this.projectPath, 'rush.json');
          await fs.promises.access(rushJsonPath);
          isMonorepo = true;

          try {
            const rushJsonContent = await fs.promises.readFile(rushJsonPath, 'utf-8');
            const rushJson = JSON.parse(rushJsonContent);
            if (rushJson.projects && Array.isArray(rushJson.projects)) {
              workspaces = rushJson.projects.map((project: any) => project.projectFolder).filter(Boolean);
            }
          } catch (error) {
            // Could not parse rush.json
          }
        } catch (error) {
          // rush.json doesn't exist
        }
      }

      // Check for lerna.json (Lerna monorepo)
      if (!isMonorepo) {
        try {
          const lernaJsonPath = path.join(this.projectPath, 'lerna.json');
          await fs.promises.access(lernaJsonPath);
          isMonorepo = true;

          try {
            const lernaJsonContent = await fs.promises.readFile(lernaJsonPath, 'utf-8');
            const lernaJson = JSON.parse(lernaJsonContent);
            if (lernaJson.packages && Array.isArray(lernaJson.packages)) {
              workspaces = lernaJson.packages;
            }
          } catch (error) {
            // Could not parse lerna.json
          }
        } catch (error) {
          // lerna.json doesn't exist
        }
      }

      // Heuristic: Check for common monorepo structure patterns
      if (!isMonorepo) {
        const topLevelDirs = await this.getTopLevelDirectories();
        const monorepoIndicators = [
          'packages', 'apps', 'libs', 'modules', 'services',
          'projects', 'workspaces', 'components'
        ];

        // If we have multiple top-level directories that look like packages
        const indicatorCount = topLevelDirs.filter(dir =>
          monorepoIndicators.includes(dir.toLowerCase())
        ).length;

        if (indicatorCount >= 1) {
          // Check if these directories contain package.json files
          let packageCount = 0;
          for (const dir of topLevelDirs) {
            if (monorepoIndicators.includes(dir.toLowerCase())) {
              try {
                const subDirs = await fs.promises.readdir(path.join(this.projectPath, dir), { withFileTypes: true });
                for (const subDir of subDirs) {
                  if (subDir.isDirectory()) {
                    try {
                      await fs.promises.access(path.join(this.projectPath, dir, subDir.name, 'package.json'));
                      packageCount++;
                    } catch (error) {
                      // No package.json in this subdirectory
                    }
                  }
                }
              } catch (error) {
                // Can't read this directory
              }
            }
          }

          // If we found multiple packages, it's likely a monorepo
          if (packageCount >= 2) {
            isMonorepo = true;
            workspaces = topLevelDirs.filter(dir =>
              monorepoIndicators.includes(dir.toLowerCase())
            ).map(dir => `${dir}/*`);
          }
        }
      }

    } catch (error) {
      // Default to not a monorepo if analysis fails
    }

    return { isMonorepo, workspaces };
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

        // Additional Backend Frameworks
        { name: 'Django', packages: ['django'], category: 'backend' as const },
        { name: 'FastAPI', packages: ['fastapi'], category: 'backend' as const },
        { name: 'Flask', packages: ['flask'], category: 'backend' as const },
        { name: 'Spring Boot', packages: ['spring-boot-starter'], category: 'backend' as const },

        // Additional Frontend/CSS Frameworks
        { name: 'Tailwind CSS', packages: ['tailwindcss'], category: 'frontend' as const },
        { name: 'Bootstrap', packages: ['bootstrap'], category: 'frontend' as const },
        { name: 'Material-UI', packages: ['@mui/material', '@material-ui/core'], category: 'frontend' as const },
        { name: 'Ant Design', packages: ['antd'], category: 'frontend' as const },
        { name: 'Chakra UI', packages: ['@chakra-ui/react'], category: 'frontend' as const },

        // State Management
        { name: 'Redux', packages: ['redux', '@reduxjs/toolkit'], category: 'frontend' as const },
        { name: 'MobX', packages: ['mobx'], category: 'frontend' as const },
        { name: 'Zustand', packages: ['zustand'], category: 'frontend' as const },

        // Additional Testing Frameworks
        { name: 'Testing Library', packages: ['@testing-library/react', '@testing-library/dom'], category: 'testing' as const },
        { name: 'Jasmine', packages: ['jasmine'], category: 'testing' as const },
        { name: 'Puppeteer', packages: ['puppeteer'], category: 'testing' as const },

        // Database ORMs
        { name: 'Prisma', packages: ['prisma', '@prisma/client'], category: 'backend' as const },
        { name: 'TypeORM', packages: ['typeorm'], category: 'backend' as const },
        { name: 'Mongoose', packages: ['mongoose'], category: 'backend' as const },
        { name: 'Sequelize', packages: ['sequelize'], category: 'backend' as const },
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
            detectionReasons: [`package.json dependency: ${matchingPackage}`],
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
          detectionReasons: ['package.json dependency: typescript'],
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
   * Analyze Python dependencies for framework detection
   */
  private async analyzePythonDependencies(): Promise<FrameworkInfo[]> {
    const frameworks: FrameworkInfo[] = [];

    // Python framework detection rules
    const pythonFrameworkRules = [
      { name: 'Django', packages: ['django', 'Django'], category: 'backend' as const },
      { name: 'Flask', packages: ['flask', 'Flask'], category: 'backend' as const },
      { name: 'FastAPI', packages: ['fastapi', 'FastAPI'], category: 'backend' as const },
      { name: 'Tornado', packages: ['tornado'], category: 'backend' as const },
      { name: 'Pyramid', packages: ['pyramid'], category: 'backend' as const },
      { name: 'Starlette', packages: ['starlette'], category: 'backend' as const },
    ];

    try {
      // Check requirements.txt
      await this.analyzePythonManifest('requirements.txt', pythonFrameworkRules, frameworks);

      // Check Pipfile (Pipenv)
      await this.analyzePipfile(pythonFrameworkRules, frameworks);

      // Check pyproject.toml (Poetry/PEP-517)
      await this.analyzePyprojectToml(pythonFrameworkRules, frameworks);

    } catch (error) {
      // Python dependencies don't exist or are invalid
    }

    return frameworks;
  }

  /**
   * Analyze a Python requirements file
   */
  private async analyzePythonManifest(
    filename: string,
    rules: Array<{name: string, packages: string[], category: 'backend'}>,
    frameworks: FrameworkInfo[]
  ): Promise<void> {
    try {
      const filePath = path.join(this.projectPath, filename);
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const lines = content.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('#'));

      for (const rule of rules) {
        const matchingPackage = rule.packages.find(pkg =>
          lines.some(line => {
            const packageName = line.split(/[>=<!\s]/)[0].toLowerCase();
            return packageName === pkg.toLowerCase();
          })
        );

        if (matchingPackage) {
          // Extract version if available
          const versionLine = lines.find(line => {
            const packageName = line.split(/[>=<!\s]/)[0].toLowerCase();
            return packageName === matchingPackage.toLowerCase();
          });

          const versionMatch = versionLine?.match(/[>=<]+([\d.]+)/);
          const version = versionMatch ? versionMatch[1] : undefined;

          frameworks.push({
            name: rule.name,
            version,
            category: rule.category,
            confidence: 'high',
            detectedVia: `${filename} dependency: ${matchingPackage}`,
            detectionReasons: [`${filename} dependency: ${matchingPackage}`],
            language: 'python',
            isDevDependency: false,
          });
        }
      }
    } catch (error) {
      // File doesn't exist or is invalid
    }
  }

  /**
   * Analyze Pipfile for Python dependencies
   */
  private async analyzePipfile(
    rules: Array<{name: string, packages: string[], category: 'backend'}>,
    frameworks: FrameworkInfo[]
  ): Promise<void> {
    try {
      const pipfilePath = path.join(this.projectPath, 'Pipfile');
      const content = await fs.promises.readFile(pipfilePath, 'utf-8');

      // Parse TOML-like content for dependencies
      const dependencies: Record<string, string> = {};
      const devDependencies: Record<string, string> = {};

      let currentSection = '';
      const lines = content.split('\n');

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('[packages]')) {
          currentSection = 'packages';
        } else if (trimmed.startsWith('[dev-packages]')) {
          currentSection = 'dev-packages';
        } else if (trimmed.startsWith('[')) {
          currentSection = '';
        } else if (currentSection && trimmed.includes('=')) {
          const [packageName, versionSpec] = trimmed.split('=').map(s => s.trim().replace(/"/g, ''));
          if (currentSection === 'packages') {
            dependencies[packageName] = versionSpec;
          } else if (currentSection === 'dev-packages') {
            devDependencies[packageName] = versionSpec;
          }
        }
      }

      const allDeps = { ...dependencies, ...devDependencies };

      for (const rule of rules) {
        const matchingPackage = rule.packages.find(pkg => allDeps[pkg]);
        if (matchingPackage) {
          const isDevDependency = devDependencies[matchingPackage] !== undefined;
          frameworks.push({
            name: rule.name,
            version: allDeps[matchingPackage] !== '*' ? allDeps[matchingPackage] : undefined,
            category: rule.category,
            confidence: 'high',
            detectedVia: `Pipfile dependency: ${matchingPackage}`,
            detectionReasons: [`Pipfile dependency: ${matchingPackage}`],
            language: 'python',
            isDevDependency,
          });
        }
      }
    } catch (error) {
      // Pipfile doesn't exist or is invalid
    }
  }

  /**
   * Analyze pyproject.toml for Python dependencies
   */
  private async analyzePyprojectToml(
    rules: Array<{name: string, packages: string[], category: 'backend'}>,
    frameworks: FrameworkInfo[]
  ): Promise<void> {
    try {
      const pyprojectPath = path.join(this.projectPath, 'pyproject.toml');
      const content = await fs.promises.readFile(pyprojectPath, 'utf-8');

      // Simple TOML parsing for dependencies
      const dependencies: Record<string, string> = {};
      const devDependencies: Record<string, string> = {};

      // Look for [tool.poetry.dependencies] or [project.dependencies]
      const dependencyMatches = content.match(/\[(?:tool\.poetry\.dependencies|project\.dependencies)\]([\s\S]*?)(?=\[|$)/);
      if (dependencyMatches) {
        const depSection = dependencyMatches[1];
        const depLines = depSection.split('\n').filter(line => line.trim() && !line.trim().startsWith('#'));

        for (const line of depLines) {
          const trimmed = line.trim();
          if (trimmed.includes('=')) {
            const [packageName, versionSpec] = trimmed.split('=').map(s => s.trim().replace(/"/g, ''));
            dependencies[packageName] = versionSpec;
          }
        }
      }

      // Look for dev dependencies
      const devDependencyMatches = content.match(/\[tool\.poetry\.group\.dev\.dependencies\]([\s\S]*?)(?=\[|$)/);
      if (devDependencyMatches) {
        const devDepSection = devDependencyMatches[1];
        const devDepLines = devDepSection.split('\n').filter(line => line.trim() && !line.trim().startsWith('#'));

        for (const line of devDepLines) {
          const trimmed = line.trim();
          if (trimmed.includes('=')) {
            const [packageName, versionSpec] = trimmed.split('=').map(s => s.trim().replace(/"/g, ''));
            devDependencies[packageName] = versionSpec;
          }
        }
      }

      const allDeps = { ...dependencies, ...devDependencies };

      for (const rule of rules) {
        const matchingPackage = rule.packages.find(pkg => allDeps[pkg]);
        if (matchingPackage) {
          const isDevDependency = devDependencies[matchingPackage] !== undefined;
          frameworks.push({
            name: rule.name,
            version: allDeps[matchingPackage]?.replace(/^[\^~]/, ''),
            category: rule.category,
            confidence: 'high',
            detectedVia: `pyproject.toml dependency: ${matchingPackage}`,
            detectionReasons: [`pyproject.toml dependency: ${matchingPackage}`],
            language: 'python',
            isDevDependency,
          });
        }
      }
    } catch (error) {
      // pyproject.toml doesn't exist or is invalid
    }
  }

  /**
   * Analyze Gemfile for Ruby dependencies
   */
  private async analyzeGemfile(): Promise<FrameworkInfo[]> {
    const frameworks: FrameworkInfo[] = [];

    // Ruby framework detection rules
    const rubyFrameworkRules = [
      { name: 'Ruby on Rails', packages: ['rails'], category: 'backend' as const },
      { name: 'Sinatra', packages: ['sinatra'], category: 'backend' as const },
      { name: 'Hanami', packages: ['hanami'], category: 'backend' as const },
      { name: 'Padrino', packages: ['padrino'], category: 'backend' as const },
    ];

    try {
      const gemfilePath = path.join(this.projectPath, 'Gemfile');
      const content = await fs.promises.readFile(gemfilePath, 'utf-8');

      // Parse Gemfile for gem declarations
      const lines = content.split('\n').map(line => line.trim()).filter(line => line);
      const gems: Record<string, string> = {};
      const devGems: Record<string, string> = {};

      let inDevGroup = false;

      for (const line of lines) {
        // Skip comments
        if (line.startsWith('#')) continue;

        // Check for group blocks
        if (line.match(/group\s+:development/)) {
          inDevGroup = true;
          continue;
        } else if (line.match(/group\s+:test/)) {
          inDevGroup = true;
          continue;
        } else if (line.match(/group\s+:production/)) {
          inDevGroup = false;
          continue;
        } else if (line === 'end') {
          inDevGroup = false;
          continue;
        }

        // Parse gem declarations
        const gemMatch = line.match(/gem\s+['"]([^'"]+)['"](?:,\s*['"]([^'"]+)['"])?/);
        if (gemMatch) {
          const gemName = gemMatch[1];
          const version = gemMatch[2];

          if (inDevGroup) {
            devGems[gemName] = version || '*';
          } else {
            gems[gemName] = version || '*';
          }
        }
      }

      const allGems = { ...gems, ...devGems };

      for (const rule of rubyFrameworkRules) {
        const matchingPackage = rule.packages.find(pkg => allGems[pkg]);
        if (matchingPackage) {
          const isDevDependency = devGems[matchingPackage] !== undefined;
          frameworks.push({
            name: rule.name,
            version: allGems[matchingPackage] !== '*' ? allGems[matchingPackage] : undefined,
            category: rule.category,
            confidence: 'high',
            detectedVia: `Gemfile dependency: ${matchingPackage}`,
            detectionReasons: [`Gemfile dependency: ${matchingPackage}`],
            language: 'ruby',
            isDevDependency,
          });
        }
      }
    } catch (error) {
      // Gemfile doesn't exist or is invalid
    }

    return frameworks;
  }

  /**
   * Analyze Java dependencies (Maven/Gradle) for framework detection
   */
  private async analyzeJavaDependencies(): Promise<FrameworkInfo[]> {
    const frameworks: FrameworkInfo[] = [];

    // Java framework detection rules
    const javaFrameworkRules = [
      {
        name: 'Spring Boot',
        packages: ['spring-boot-starter', 'org.springframework.boot'],
        configFiles: ['application.properties', 'application.yml', 'application.yaml'],
        category: 'backend' as const
      },
      {
        name: 'Spring',
        packages: ['org.springframework'],
        configFiles: ['applicationContext.xml'],
        category: 'backend' as const
      },
      {
        name: 'Micronaut',
        packages: ['io.micronaut'],
        configFiles: ['application.yml'],
        category: 'backend' as const
      },
      {
        name: 'Quarkus',
        packages: ['io.quarkus'],
        configFiles: ['application.properties'],
        category: 'backend' as const
      },
    ];

    try {
      // Check Maven (pom.xml)
      await this.analyzeMavenDependencies(javaFrameworkRules, frameworks);

      // Check Gradle (build.gradle, build.gradle.kts)
      await this.analyzeGradleDependencies(javaFrameworkRules, frameworks);

    } catch (error) {
      // Java dependencies don't exist or are invalid
    }

    return frameworks;
  }

  /**
   * Analyze Maven pom.xml for dependencies
   */
  private async analyzeMavenDependencies(
    rules: Array<{name: string, packages: string[], configFiles?: string[], category: 'backend'}>,
    frameworks: FrameworkInfo[]
  ): Promise<void> {
    try {
      const pomPath = path.join(this.projectPath, 'pom.xml');
      const content = await fs.promises.readFile(pomPath, 'utf-8');

      for (const rule of rules) {
        for (const packagePattern of rule.packages) {
          // Look for dependency declarations containing the package pattern
          const dependencyRegex = new RegExp(`<dependency>[\\s\\S]*?<(?:groupId|artifactId)>[^<]*${packagePattern}[^<]*</(?:groupId|artifactId)>[\\s\\S]*?</dependency>`, 'g');
          const matches = content.match(dependencyRegex);

          if (matches && matches.length > 0) {
            // Extract version if available
            let version: string | undefined;
            const versionMatch = matches[0].match(/<version>([^<]+)<\/version>/);
            if (versionMatch) {
              version = versionMatch[1];
            }

            frameworks.push({
              name: rule.name,
              version,
              category: rule.category,
              confidence: 'high',
              detectedVia: `pom.xml dependency: ${packagePattern}`,
              detectionReasons: [`pom.xml dependency: ${packagePattern}`],
              language: 'java',
              isDevDependency: false,
            });
            break; // Found one match for this rule, move to next
          }
        }
      }
    } catch (error) {
      // pom.xml doesn't exist or is invalid
    }
  }

  /**
   * Analyze Gradle build files for dependencies
   */
  private async analyzeGradleDependencies(
    rules: Array<{name: string, packages: string[], configFiles?: string[], category: 'backend'}>,
    frameworks: FrameworkInfo[]
  ): Promise<void> {
    try {
      const buildFiles = ['build.gradle', 'build.gradle.kts'];

      for (const buildFile of buildFiles) {
        try {
          const buildPath = path.join(this.projectPath, buildFile);
          const content = await fs.promises.readFile(buildPath, 'utf-8');

          for (const rule of rules) {
            for (const packagePattern of rule.packages) {
              // Look for dependency declarations
              const dependencyRegex = new RegExp(`(?:implementation|api|compile|runtime)\\s*[("']([^"']*${packagePattern}[^"']*)[)"']`, 'g');
              const matches = content.match(dependencyRegex);

              if (matches && matches.length > 0) {
                // Extract version if available from the dependency string
                const fullDep = matches[0];
                const versionMatch = fullDep.match(/[:@](\d+(?:\.\d+)*(?:-[A-Za-z0-9-]+)?)/);
                const version = versionMatch ? versionMatch[1] : undefined;

                frameworks.push({
                  name: rule.name,
                  version,
                  category: rule.category,
                  confidence: 'high',
                  detectedVia: `${buildFile} dependency: ${packagePattern}`,
                  detectionReasons: [`${buildFile} dependency: ${packagePattern}`],
                  language: 'java',
                  isDevDependency: false,
                });
                break; // Found one match for this rule, move to next
              }
            }
          }
        } catch (error) {
          // This specific build file doesn't exist, continue to next
          continue;
        }
      }
    } catch (error) {
      // No Gradle build files exist
    }
  }

  /**
   * Detect runtime environment based on detected frameworks
   */
  private detectRuntime(frameworks: FrameworkInfo[]): string | undefined {
    const frameworkNames = frameworks.map(f => f.name.toLowerCase());

    // Node.js runtime frameworks
    if (frameworkNames.some(name => ['next.js', 'express', 'fastify', 'nestjs'].includes(name))) {
      return 'node';
    }

    // Browser runtime frameworks
    if (frameworkNames.some(name => ['react', 'vue', 'angular'].includes(name))) {
      return 'browser';
    }

    // Python runtime frameworks
    if (frameworkNames.some(name => ['django', 'flask', 'fastapi'].includes(name))) {
      return 'python';
    }

    // Ruby runtime frameworks
    if (frameworkNames.some(name => ['ruby on rails', 'sinatra'].includes(name))) {
      return 'ruby';
    }

    // JVM runtime frameworks
    if (frameworkNames.some(name => ['spring boot', 'spring', 'micronaut', 'quarkus'].includes(name))) {
      return 'jvm';
    }

    // Mobile runtime
    if (frameworkNames.includes('react native')) {
      return 'mobile';
    }

    // Desktop runtime
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

      // Additional config files
      { files: ['remix.config.js'], framework: 'Remix', category: 'fullstack' as const },
      { files: ['gatsby-config.js', 'gatsby-config.ts'], framework: 'Gatsby', category: 'fullstack' as const },
      { files: ['astro.config.js', 'astro.config.mjs', 'astro.config.ts'], framework: 'Astro', category: 'fullstack' as const },
      { files: ['eslint.config.js', '.eslintrc.js', '.eslintrc.json'], framework: 'ESLint', category: 'other' as const },
      { files: ['prettier.config.js', '.prettierrc'], framework: 'Prettier', category: 'other' as const },
      { files: ['babel.config.js', '.babelrc'], framework: 'Babel', category: 'build' as const },
      { files: ['postcss.config.js'], framework: 'PostCSS', category: 'build' as const },
      { files: ['storybook/main.js', '.storybook/main.js'], framework: 'Storybook', category: 'other' as const },
      { files: ['prisma/schema.prisma'], framework: 'Prisma', category: 'backend' as const },
      { files: ['docker-compose.yml', 'docker-compose.yaml'], framework: 'Docker Compose', category: 'other' as const },
      { files: ['Dockerfile'], framework: 'Docker', category: 'other' as const },
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
            detectionReasons: [`Configuration file: ${configFile}`],
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
   * Detect frameworks based on file patterns and project structure
   */
  private async detectPatternBasedFrameworks(): Promise<FrameworkInfo[]> {
    const frameworks: FrameworkInfo[] = [];

    try {
      // Check for common framework file patterns
      const patternRules = [
        {
          name: 'React',
          patterns: ['**/*.jsx', '**/components/**/*.js', '**/components/**/*.ts'],
          category: 'frontend' as const,
          confidence: 'low' as const,
          detectionReason: 'JSX files or React component patterns found'
        },
        {
          name: 'Vue',
          patterns: ['**/*.vue', '**/src/**/*.vue'],
          category: 'frontend' as const,
          confidence: 'medium' as const,
          detectionReason: '.vue files found'
        },
        {
          name: 'Angular',
          patterns: ['**/*.component.ts', '**/*.service.ts', '**/*.module.ts'],
          category: 'frontend' as const,
          confidence: 'medium' as const,
          detectionReason: 'Angular TypeScript patterns found'
        },
        {
          name: 'Svelte',
          patterns: ['**/*.svelte'],
          category: 'frontend' as const,
          confidence: 'high' as const,
          detectionReason: '.svelte files found'
        },
        {
          name: 'Next.js',
          patterns: ['pages/**/*.js', 'pages/**/*.tsx', 'app/**/*.js', 'app/**/*.tsx'],
          category: 'fullstack' as const,
          confidence: 'medium' as const,
          detectionReason: 'Next.js pages or app directory structure found'
        },
        {
          name: 'Python',
          patterns: ['**/*.py', '**/requirements.txt', '**/setup.py'],
          category: 'other' as const,
          confidence: 'medium' as const,
          detectionReason: 'Python files found'
        },
        {
          name: 'Django',
          patterns: ['**/manage.py', '**/settings.py', '**/models.py'],
          category: 'backend' as const,
          confidence: 'high' as const,
          detectionReason: 'Django project structure found'
        },
        {
          name: 'Flutter',
          patterns: ['**/pubspec.yaml', '**/lib/**/*.dart'],
          category: 'mobile' as const,
          confidence: 'high' as const,
          detectionReason: 'Flutter project structure found'
        },
        {
          name: 'Laravel',
          patterns: ['**/artisan', '**/config/app.php', '**/app/Http/Controllers/**/*.php'],
          category: 'backend' as const,
          confidence: 'high' as const,
          detectionReason: 'Laravel project structure found'
        },
        {
          name: 'Ruby on Rails',
          patterns: ['**/Gemfile', '**/config/routes.rb', '**/app/controllers/**/*.rb'],
          category: 'backend' as const,
          confidence: 'high' as const,
          detectionReason: 'Rails project structure found'
        }
      ];

      for (const rule of patternRules) {
        let hasMatch = false;
        for (const pattern of rule.patterns) {
          try {
            const matches = await this.findFilesByPattern(pattern);
            if (matches.length > 0) {
              hasMatch = true;
              break;
            }
          } catch {
            // Continue if pattern matching fails
          }
        }

        if (hasMatch) {
          frameworks.push({
            name: rule.name,
            category: rule.category,
            confidence: rule.confidence,
            detectedVia: rule.detectionReason,
            detectionReasons: [rule.detectionReason],
          });
        }
      }
    } catch (error) {
      // Pattern-based detection failed, continue with other methods
    }

    return frameworks;
  }

  /**
   * Find files matching a glob pattern
   */
  private async findFilesByPattern(pattern: string): Promise<string[]> {
    const fg = await import('fast-glob');
    return fg.default(pattern, {
      cwd: this.projectPath,
      onlyFiles: true,
      ignore: this.options.excludeDirectories.map(dir => `**/${dir}/**`)
    });
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
            detectionReasons: [...(existing.detectionReasons || []), ...(framework.detectionReasons || [])],
          });
        } else {
          // Keep existing but merge config files and detection reasons
          frameworkMap.set(key, {
            ...existing,
            configFiles: [...(existing.configFiles || []), ...(framework.configFiles || [])],
            detectionReasons: [...(existing.detectionReasons || []), ...(framework.detectionReasons || [])],
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
