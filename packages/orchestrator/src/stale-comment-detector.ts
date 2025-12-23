/**
 * StaleCommentDetector
 *
 * Detects TODO/FIXME/HACK comments that have exceeded a configurable age threshold.
 * Uses git blame to determine when comments were added and reports old comments
 * as 'stale-reference' type OutdatedDocumentation.
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import type { OutdatedDocumentation, OutdatedDocsConfig } from '@apexcli/core';

export interface CommentMetadata {
  file: string;
  line: number;
  text: string;
  type: 'TODO' | 'FIXME' | 'HACK';
  author?: string;
  date?: Date;
  commitHash?: string;
}

export class StaleCommentDetector {
  private readonly projectPath: string;
  private readonly config: OutdatedDocsConfig;

  constructor(projectPath: string, config: OutdatedDocsConfig = {}) {
    this.projectPath = projectPath;
    this.config = {
      todoAgeThresholdDays: 30,
      versionCheckPatterns: [],
      deprecationRequiresMigration: true,
      crossReferenceEnabled: true,
      ...config
    };
  }

  /**
   * Find all stale TODO/FIXME/HACK comments in the codebase
   */
  async findStaleComments(): Promise<OutdatedDocumentation[]> {
    try {
      const comments = await this.findAllComments();
      const commentsWithBlame = await this.enrichWithGitBlame(comments);
      return this.filterStaleComments(commentsWithBlame);
    } catch (error) {
      // Graceful fallback when git is not available
      console.warn('Failed to analyze comment age, git may not be available:', error);
      return [];
    }
  }

  /**
   * Find all TODO/FIXME/HACK comments in source files
   */
  private async findAllComments(): Promise<CommentMetadata[]> {
    const comments: CommentMetadata[] = [];

    try {
      // Find source files, excluding test files and node_modules
      const { stdout } = await this.execAsync(
        'find . -name "*.ts" -o -name "*.js" -o -name "*.tsx" -o -name "*.jsx" -o -name "*.py" -o -name "*.java" -o -name "*.go" -o -name "*.rs" -o -name "*.php" -o -name "*.rb" | grep -v test | grep -v node_modules | head -200'
      );

      const files = stdout.split('\n').filter(line => line.trim());

      for (const file of files.slice(0, 100)) { // Limit to avoid performance issues
        try {
          const filePath = join(this.projectPath, file.replace(/^\.\//, ''));
          const content = await fs.readFile(filePath, 'utf-8');
          const fileComments = this.parseCommentsInFile(file, content);
          comments.push(...fileComments);
        } catch {
          // Skip files that can't be read
        }
      }
    } catch {
      // Graceful handling if find command fails
    }

    return comments;
  }

  /**
   * Parse TODO/FIXME/HACK comments from a file's content
   */
  private parseCommentsInFile(file: string, content: string): CommentMetadata[] {
    const comments: CommentMetadata[] = [];
    const lines = content.split('\n');

    // Patterns for different comment styles
    const commentPatterns = [
      // Single-line comments: //, #, --
      /^\s*(?:\/\/|#|--)\s*(TODO|FIXME|HACK)(?:\s*[\(\[]\w+[\)\]])?\s*:?\s*(.*)$/i,
      // Multi-line comments: /* */, <!-- -->
      /^\s*(?:\/\*\*?|\*|<!--)\s*(TODO|FIXME|HACK)(?:\s*[\(\[]\w+[\)\]])?\s*:?\s*(.*)(?:\*\/|-->)?$/i,
      // JSDoc comments
      /^\s*\*\s*(TODO|FIXME|HACK)(?:\s*[\(\[]\w+[\)\]])?\s*:?\s*(.*)$/i
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      for (const pattern of commentPatterns) {
        const match = line.match(pattern);
        if (match) {
          const type = match[1].toUpperCase() as 'TODO' | 'FIXME' | 'HACK';
          const text = match[2]?.trim() || '';

          // Skip empty comments or very short ones
          if (text.length > 3) {
            comments.push({
              file: file.replace(/^\.\//, ''),
              line: i + 1,
              text: `${type}: ${text}`,
              type
            });
          }
          break; // Only match one pattern per line
        }
      }
    }

    return comments;
  }

  /**
   * Enrich comments with git blame information
   */
  private async enrichWithGitBlame(comments: CommentMetadata[]): Promise<CommentMetadata[]> {
    const enrichedComments: CommentMetadata[] = [];

    for (const comment of comments) {
      try {
        const blameInfo = await this.getGitBlame(comment.file, comment.line);
        enrichedComments.push({
          ...comment,
          ...blameInfo
        });
      } catch {
        // If git blame fails for a specific line, include comment without blame info
        enrichedComments.push(comment);
      }
    }

    return enrichedComments;
  }

  /**
   * Get git blame information for a specific file and line
   */
  private async getGitBlame(file: string, line: number): Promise<Partial<CommentMetadata>> {
    try {
      const { stdout } = await this.execAsync(
        `git blame -L ${line},${line} --porcelain "${file}"`
      );

      const lines = stdout.split('\n');
      let commitHash = '';
      let author = '';
      let authorTime = '';

      for (const blameLine of lines) {
        if (blameLine.match(/^[0-9a-f]{40}/)) {
          commitHash = blameLine.split(' ')[0];
        } else if (blameLine.startsWith('author ')) {
          author = blameLine.replace('author ', '');
        } else if (blameLine.startsWith('author-time ')) {
          authorTime = blameLine.replace('author-time ', '');
        }
      }

      let date: Date | undefined;
      if (authorTime) {
        // author-time is Unix timestamp
        date = new Date(parseInt(authorTime) * 1000);
      }

      return {
        author: author || undefined,
        date,
        commitHash: commitHash || undefined
      };
    } catch (error) {
      throw new Error(`Git blame failed: ${error}`);
    }
  }

  /**
   * Filter comments that exceed the age threshold
   */
  private filterStaleComments(comments: CommentMetadata[]): OutdatedDocumentation[] {
    const staleComments: OutdatedDocumentation[] = [];
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - this.config.todoAgeThresholdDays!);

    for (const comment of comments) {
      // Only process comments that have date information
      if (comment.date && comment.date < threshold) {
        const daysSinceAdded = Math.floor(
          (Date.now() - comment.date.getTime()) / (1000 * 60 * 60 * 24)
        );

        // Determine severity based on age
        let severity: 'low' | 'medium' | 'high' = 'low';
        if (daysSinceAdded > this.config.todoAgeThresholdDays! * 3) {
          severity = 'high';
        } else if (daysSinceAdded > this.config.todoAgeThresholdDays! * 2) {
          severity = 'medium';
        }

        staleComments.push({
          file: comment.file,
          type: 'stale-reference',
          description: `${comment.type} comment added ${daysSinceAdded} days ago by ${comment.author || 'unknown'}`,
          line: comment.line,
          suggestion: `Review and resolve this ${comment.type.toLowerCase()} comment: "${comment.text.slice(0, 100)}${comment.text.length > 100 ? '...' : ''}"`,
          severity
        });
      }
    }

    return staleComments;
  }

  /**
   * Check if git is available in the project
   */
  async isGitAvailable(): Promise<boolean> {
    try {
      await this.execAsync('git status');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Execute a shell command asynchronously
   */
  private async execAsync(command: string): Promise<{ stdout: string; stderr: string }> {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execPromise = promisify(exec);

    return execPromise(command, { cwd: this.projectPath });
  }
}