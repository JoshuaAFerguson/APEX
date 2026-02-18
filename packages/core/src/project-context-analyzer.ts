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
  GitChangedFileSchema,
  ProjectStructure,
  ProjectStructureSchema,
  ProjectEntry,
  ConfigurationInfo,
  ConfigurationInfoSchema,
  TestFrameworkInfo,
  TestFrameworkInfoSchema,
  FrameworkInfo,
  FrameworkInfoSchema,
  ProjectContext,
  ProjectContextSchema
} from './types';

const execAsync = promisify(exec);

// ============================================================================
// Zod Schemas and Types
// ============================================================================



/**
 * Schema for framework detection results
 * Identifies frameworks and libraries used in the project
 */
export const FrameworkDetectionSchema = z.object({
  /** Primary framework (highest confidence) */
  primary: FrameworkInfoSchema.optional(),
  /** All detected frameworks */
  frameworks: z.array(FrameworkInfoSchema),
  /** Primary programming language */
  primaryLanguage: z.string().optional(),
  /** All detected languages */
  languages: z.array(z.object({
    /** Language name */
    name: z.string(),
    /** File extensions associated with this language */
    extensions: z.array(z.string()),
    /** Percentage of files using this language */
    percentage: z.number().min(0).max(100),
  })),
  /** Runtime environment (node, browser, deno, bun, etc.) */
  runtime: z.string().optional(),
  /** Package manager detected */
  packageManager: z.string().optional(),
  /** Error message if detection failed */
  error: z.string().optional(),
});
export type FrameworkDetection = z.infer<typeof FrameworkDetectionSchema>;

/**
 * Schema for individual configuration file info
 */
export const ConfigFileInfoSchema = z.object({
  /** Configuration file name */
  name: z.string(),
  /** File path relative to project root */
  path: z.string(),
  /** Configuration type/purpose */
  type: z.enum([
    'package',
    'typescript',
    'eslint',
    'prettier',
    'babel',
    'webpack',
    'vite',
    'rollup',
    'jest',
    'vitest',
    'docker',
    'ci',
    'git',
    'editor',
    'environment',
    'other',
  ]),
  /** Whether the file exists */
  exists: z.boolean(),
  /** Brief description of what this config controls */
  description: z.string().optional(),
});
export type ConfigFileInfo = z.infer<typeof ConfigFileInfoSchema>;


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
    const [gitStatus, structure, frameworks, configurations, testFrameworks] = await Promise.all([
      this.options.analyzeGit ? this.getGitStatus() : undefined,
      this.getProjectStructure(),
      this.options.detectFrameworks ? this.detectFrameworks() : this.getEmptyFrameworkDetection(),
      this.options.analyzeConfiguration ? this.getConfigurationInfoList() : [],
      this.options.detectTests ? this.getTestFrameworkInfoList() : [],
    ]);

    return {
      gitStatus,
      structure,
      frameworks: frameworks.frameworks,
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
    // TODO: Implement project structure analysis
    return {
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
  }

  /**
   * Detect frameworks and languages used in the project
   * @returns Promise resolving to framework detection results
   */
  async detectFrameworks(): Promise<FrameworkDetection> {
    // TODO: Implement framework detection
    return this.getEmptyFrameworkDetection();
  }

  /**
   * Get configuration file information
   * @returns Promise resolving to list of configuration information
   */
  async getConfigurationInfoList(): Promise<ConfigurationInfo[]> {
    // TODO: Implement configuration discovery
    return [];
  }

  /**
   * Get test framework information
   * @returns Promise resolving to list of test framework information
   */
  async getTestFrameworkInfoList(): Promise<TestFrameworkInfo[]> {
    // TODO: Implement test framework detection
    return [];
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
