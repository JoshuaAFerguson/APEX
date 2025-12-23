/**
 * Version Mismatch Detector
 *
 * Detects mismatches between package.json version and version references in documentation.
 * Scans markdown files and JSDoc comments for version references that don't match
 * the current package.json version.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { BaseAnalyzer, TaskCandidate } from './index';
import type { ProjectAnalysis } from '../idle-processor';

export interface VersionMismatch {
  /** File path where mismatch was found */
  file: string;
  /** Line number where mismatch was found */
  line: number;
  /** The version reference found in the file */
  foundVersion: string;
  /** The expected version from package.json */
  expectedVersion: string;
  /** The content of the line containing the mismatch */
  lineContent: string;
}

export class VersionMismatchDetector extends BaseAnalyzer {
  readonly type = 'docs' as const;

  private projectPath: string = '';

  constructor(projectPath?: string) {
    super();
    if (projectPath) {
      this.projectPath = projectPath;
    }
  }

  /**
   * Set the project path for analysis
   */
  setProjectPath(projectPath: string): void {
    this.projectPath = projectPath;
  }

  analyze(analysis: ProjectAnalysis): TaskCandidate[] {
    const candidates: TaskCandidate[] = [];

    // Note: This is a simplified integration with the existing analyzer framework.
    // The actual version mismatch detection would be triggered separately.
    // For now, we return empty candidates as this detector is meant to be used
    // as a standalone utility rather than part of the idle task generation.

    return candidates;
  }

  /**
   * Detect version mismatches between package.json and documentation
   */
  async detectMismatches(): Promise<VersionMismatch[]> {
    if (!this.projectPath) {
      throw new Error('Project path not set. Call setProjectPath() first.');
    }

    const packageVersion = await this.getPackageVersion();
    if (!packageVersion) {
      return [];
    }

    const mismatches: VersionMismatch[] = [];
    const docFiles = await this.findDocumentationFiles();

    for (const file of docFiles) {
      const fileMismatches = await this.scanFileForVersionMismatches(
        file,
        packageVersion
      );
      mismatches.push(...fileMismatches);
    }

    return mismatches;
  }

  /**
   * Parse package.json and extract version
   */
  private async getPackageVersion(): Promise<string | null> {
    try {
      const packagePath = path.join(this.projectPath, 'package.json');
      const packageContent = await fs.readFile(packagePath, 'utf-8');
      const packageJson = JSON.parse(packageContent);
      return packageJson.version || null;
    } catch (error) {
      console.warn('Could not read package.json:', error);
      return null;
    }
  }

  /**
   * Find all documentation files in the project
   */
  private async findDocumentationFiles(): Promise<string[]> {
    const files: string[] = [];

    try {
      await this.findFilesRecursively(this.projectPath, files, (filename) => {
        const ext = path.extname(filename).toLowerCase();
        return ext === '.md' || ext === '.ts' || ext === '.js';
      });
    } catch (error) {
      console.warn('Error finding documentation files:', error);
    }

    return files;
  }

  /**
   * Recursively find files matching the filter
   */
  private async findFilesRecursively(
    dir: string,
    files: string[],
    filter: (filename: string) => boolean
  ): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        // Skip node_modules and other common directories
        if (entry.isDirectory()) {
          if (!['node_modules', '.git', 'dist', 'build', '.next'].includes(entry.name)) {
            await this.findFilesRecursively(fullPath, files, filter);
          }
        } else if (filter(entry.name)) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Ignore directories we can't read
    }
  }

  /**
   * Scan a file for version mismatches
   */
  private async scanFileForVersionMismatches(
    filePath: string,
    expectedVersion: string
  ): Promise<VersionMismatch[]> {
    const mismatches: VersionMismatch[] = [];

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const versionMatches = this.findVersionReferences(line);

        for (const foundVersion of versionMatches) {
          if (foundVersion !== expectedVersion) {
            mismatches.push({
              file: path.relative(this.projectPath, filePath),
              line: i + 1,
              foundVersion,
              expectedVersion,
              lineContent: line.trim(),
            });
          }
        }
      }
    } catch (error) {
      console.warn(`Could not read file ${filePath}:`, error);
    }

    return mismatches;
  }

  /**
   * Find version references in a line of text
   * Matches patterns like:
   * - v1.2.3
   * - version 1.2.3
   * - @version 1.2.3 (JSDoc)
   * - "version": "1.2.3" (but exclude package.json)
   */
  private findVersionReferences(line: string): string[] {
    const versions: string[] = [];

    // Skip package.json version declarations
    if (line.includes('"version"') && line.includes(':')) {
      return versions;
    }

    // Common version patterns
    const patterns = [
      // v1.2.3 format
      /\bv(\d+\.\d+\.\d+(?:-[\w.-]+)?)\b/gi,
      // version 1.2.3 format
      /\bversion\s+(\d+\.\d+\.\d+(?:-[\w.-]+)?)\b/gi,
      // @version 1.2.3 (JSDoc)
      /@version\s+(\d+\.\d+\.\d+(?:-[\w.-]+)?)\b/gi,
      // Version: 1.2.3
      /\bversion:\s*(\d+\.\d+\.\d+(?:-[\w.-]+)?)\b/gi,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(line)) !== null) {
        versions.push(match[1]);
      }
    }

    return versions;
  }

  /**
   * Generate a task candidate for version mismatches
   */
  createVersionMismatchTask(mismatches: VersionMismatch[]): TaskCandidate | null {
    if (mismatches.length === 0) {
      return null;
    }

    const fileCount = new Set(mismatches.map(m => m.file)).size;
    const priority = mismatches.length > 10 ? 'high' : mismatches.length > 3 ? 'normal' : 'low';
    const effort = mismatches.length > 10 ? 'high' : mismatches.length > 3 ? 'medium' : 'low';

    return this.createCandidate(
      'version-mismatch',
      'Fix Version Reference Mismatches',
      `Update ${mismatches.length} outdated version ${mismatches.length === 1 ? 'reference' : 'references'} in ${fileCount} ${fileCount === 1 ? 'file' : 'files'} to match package.json version`,
      {
        priority,
        effort,
        workflow: 'maintenance',
        rationale: 'Outdated version references in documentation can confuse users and developers',
        score: mismatches.length * 0.1,
      }
    );
  }
}