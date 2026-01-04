import { SecretFinding, SecretSeverity } from '@apexcli/core';

/**
 * Configuration for secret scanning patterns
 */
export interface SecretPattern {
  /** Name of the pattern for identification */
  name: string;
  /** Regular expression to match secrets */
  regex: RegExp;
  /** Type of secret this pattern detects */
  secretType: string;
  /** Confidence level of this pattern (0-1) */
  confidence: number;
  /** Severity level of this pattern */
  severity: SecretSeverity;
  /** Description of what this pattern detects */
  description: string;
}

/**
 * Configuration options for the SecretScanner
 */
export interface SecretScannerConfig {
  /** Custom patterns to scan for in addition to built-in patterns */
  customPatterns?: SecretPattern[];
  /** Whether to include built-in patterns (default: true) */
  includeBuiltInPatterns?: boolean;
  /** Maximum line length to scan (default: 10000) */
  maxLineLength?: number;
  /** Whether to mask sensitive content in findings (default: true) */
  maskSecrets?: boolean;
  /** Number of characters to show before/after match for context (default: 20) */
  contextLength?: number;
}

/**
 * SecretScanner class with pattern matching engine for detecting secrets in content
 */
export class SecretScanner {
  private patterns: SecretPattern[];
  private config: Required<SecretScannerConfig>;

  constructor(config: SecretScannerConfig = {}) {
    // Set default configuration
    this.config = {
      customPatterns: config.customPatterns || [],
      includeBuiltInPatterns: config.includeBuiltInPatterns !== false,
      maxLineLength: config.maxLineLength || 10000,
      maskSecrets: config.maskSecrets !== false,
      contextLength: config.contextLength || 20,
    };

    // Initialize patterns
    this.patterns = [];

    if (this.config.includeBuiltInPatterns) {
      this.patterns.push(...this.getBuiltInPatterns());
    }

    if (this.config.customPatterns.length > 0) {
      this.patterns.push(...this.config.customPatterns);
    }
  }

  /**
   * Scan content for secrets and return findings
   * @param content - The content to scan
   * @param filePath - Optional file path for context
   * @returns Array of SecretFinding objects
   */
  public scan(content: string, filePath = 'unknown'): SecretFinding[] {
    const findings: SecretFinding[] = [];
    const lines = content.split('\n');

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];

      // Skip lines that are too long to prevent performance issues
      if (line.length > this.config.maxLineLength) {
        continue;
      }

      // Check each pattern against the line
      for (const pattern of this.patterns) {
        const matches = this.findMatches(line, pattern);

        for (const match of matches) {
          const finding: SecretFinding = {
            file: filePath,
            line: lineIndex + 1, // 1-based line numbers
            column: match.startIndex + 1, // 1-based column numbers
            endColumn: match.endIndex + 1,
            secretType: pattern.secretType,
            match: this.config.maskSecrets ? this.maskSecret(match.value) : match.value,
            confidence: pattern.confidence,
            patternName: pattern.name,
            severity: pattern.severity,
            context: this.extractContext(line, match.startIndex, match.endIndex),
          };

          findings.push(finding);
        }
      }
    }

    return findings;
  }

  /**
   * Find all matches for a pattern in a line
   */
  private findMatches(line: string, pattern: SecretPattern): Array<{
    value: string;
    startIndex: number;
    endIndex: number;
  }> {
    const matches: Array<{
      value: string;
      startIndex: number;
      endIndex: number;
    }> = [];

    let match;
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags.includes('g') ? pattern.regex.flags : pattern.regex.flags + 'g');

    while ((match = regex.exec(line)) !== null) {
      matches.push({
        value: match[0],
        startIndex: match.index,
        endIndex: match.index + match[0].length,
      });

      // Prevent infinite loop on zero-length matches
      if (match.index === regex.lastIndex) {
        regex.lastIndex++;
      }
    }

    return matches;
  }

  /**
   * Extract context around a match
   */
  private extractContext(line: string, startIndex: number, endIndex: number): string {
    const contextStart = Math.max(0, startIndex - this.config.contextLength);
    const contextEnd = Math.min(line.length, endIndex + this.config.contextLength);

    let context = line.substring(contextStart, contextEnd);

    // Add ellipsis if we truncated
    if (contextStart > 0) {
      context = '...' + context;
    }
    if (contextEnd < line.length) {
      context = context + '...';
    }

    return context;
  }

  /**
   * Mask a secret value for security
   */
  private maskSecret(secret: string): string {
    if (secret.length <= 4) {
      return '*'.repeat(secret.length);
    }

    // Show first 2 and last 2 characters, mask the middle
    const start = secret.substring(0, 2);
    const end = secret.substring(secret.length - 2);
    const middle = '*'.repeat(Math.max(0, secret.length - 4));

    return start + middle + end;
  }

  /**
   * Get built-in patterns for common secrets
   */
  private getBuiltInPatterns(): SecretPattern[] {
    return [
      // API Keys
      {
        name: 'generic-api-key',
        regex: /(?:api[_-]?key|apikey)["\s]*[:=]["\s]*([a-zA-Z0-9_\-]{16,})/gi,
        secretType: 'api-key',
        confidence: 0.8,
        severity: 'medium',
        description: 'Generic API key pattern',
      },

      // AWS Keys
      {
        name: 'aws-access-key',
        regex: /AKIA[0-9A-Z]{16}/g,
        secretType: 'aws-access-key',
        confidence: 0.95,
        severity: 'high',
        description: 'AWS Access Key ID',
      },
      {
        name: 'aws-secret-key',
        regex: /(?:aws[_-]?secret[_-]?access[_-]?key|aws[_-]?secret)["\s]*[:=]["\s]*([a-zA-Z0-9/+=]{40})/gi,
        secretType: 'aws-secret-key',
        confidence: 0.85,
        severity: 'high',
        description: 'AWS Secret Access Key',
      },

      // GitHub Tokens
      {
        name: 'github-token',
        regex: /gh[pousr]_[A-Za-z0-9_]{36}/g,
        secretType: 'github-token',
        confidence: 0.95,
        severity: 'high',
        description: 'GitHub Personal Access Token',
      },
      {
        name: 'github-classic-token',
        regex: /(?:github[_-]?token|gh[_-]?token)["\s]*[:=]["\s]*([a-f0-9]{40})/gi,
        secretType: 'github-token',
        confidence: 0.8,
        severity: 'high',
        description: 'GitHub Classic Token',
      },

      // JWT Tokens
      {
        name: 'jwt-token',
        regex: /eyJ[a-zA-Z0-9_=-]+\.eyJ[a-zA-Z0-9_=-]+\.[a-zA-Z0-9_=-]+/g,
        secretType: 'jwt-token',
        confidence: 0.9,
        severity: 'medium',
        description: 'JSON Web Token (JWT)',
      },

      // Database URLs and Connection Strings
      {
        name: 'database-url',
        regex: /(?:database[_-]?url|db[_-]?url|connection[_-]?string)["\s]*[:=]["\s]*["']?(?:postgres|mysql|mongodb|redis|sqlite):\/\/[^"'\s]+/gi,
        secretType: 'connection-string',
        confidence: 0.85,
        severity: 'high',
        description: 'Database connection URL or connection string',
      },

      // Private Keys
      {
        name: 'private-key',
        regex: /-----BEGIN[A-Z\s]+PRIVATE KEY-----[\s\S]*?-----END[A-Z\s]+PRIVATE KEY-----/g,
        secretType: 'private-key',
        confidence: 0.95,
        severity: 'critical',
        description: 'Private key (PEM format)',
      },

      // Passwords in config
      {
        name: 'password-field',
        regex: /(?:password|passwd|pwd)["\s]*[:=]["\s]*["']([^"'\s]{8,})["']/gi,
        secretType: 'password',
        confidence: 0.7,
        severity: 'high',
        description: 'Password field in configuration',
      },

      // Slack Tokens
      {
        name: 'slack-token',
        regex: /xox[baprs]-[0-9a-zA-Z\-]{10,}/g,
        secretType: 'slack-token',
        confidence: 0.9,
        severity: 'medium',
        description: 'Slack token',
      },

      // Generic secrets with high entropy
      {
        name: 'high-entropy-string',
        regex: /(?:secret|token|key)["\s]*[:=]["\s]*["']([a-zA-Z0-9_\-+/=]{32,})["']/gi,
        secretType: 'generic-secret',
        confidence: 0.6,
        severity: 'medium',
        description: 'High entropy string that might be a secret',
      },

      // Base64 encoded secrets
      {
        name: 'base64-secret',
        regex: /(?:secret|token|key)["\s]*[:=]["\s]*["']([A-Za-z0-9+/]{32,}={0,2})["']/gi,
        secretType: 'base64-secret',
        confidence: 0.7,
        severity: 'medium',
        description: 'Base64 encoded secret',
      },
    ];
  }

  /**
   * Get all configured patterns
   */
  public getPatterns(): SecretPattern[] {
    return [...this.patterns];
  }

  /**
   * Add a custom pattern
   */
  public addPattern(pattern: SecretPattern): void {
    this.patterns.push(pattern);
  }

  /**
   * Remove patterns by name
   */
  public removePattern(name: string): void {
    this.patterns = this.patterns.filter(p => p.name !== name);
  }

  /**
   * Scan a single file for secrets by reading its content
   * @param filePath - Path to the file to scan
   * @returns Promise that resolves to array of SecretFinding objects
   */
  public async scanFile(filePath: string): Promise<SecretFinding[]> {
    const fs = await import('fs/promises');
    const path = await import('path');

    try {
      // Check if file exists and is readable
      await fs.access(filePath, fs.constants.R_OK);

      // Read file content
      const content = await fs.readFile(filePath, 'utf-8');

      // Use the existing scan method with normalized path
      return this.scan(content, path.resolve(filePath));
    } catch (error) {
      // If file cannot be read, return empty findings array
      // This allows the scanner to gracefully handle missing or unreadable files
      if (error instanceof Error) {
        console.warn(`Unable to read file ${filePath}: ${error.message}`);
      }
      return [];
    }
  }

  /**
   * Scan multiple files for secrets in batch
   * @param filePaths - Array of file paths to scan
   * @returns Promise that resolves to aggregated array of SecretFinding objects from all files
   */
  public async scanFiles(filePaths: string[]): Promise<SecretFinding[]> {
    const allFindings: SecretFinding[] = [];

    // Process files in parallel for better performance
    const scanPromises = filePaths.map(filePath => this.scanFile(filePath));

    try {
      const results = await Promise.allSettled(scanPromises);

      for (const result of results) {
        if (result.status === 'fulfilled') {
          allFindings.push(...result.value);
        } else {
          // Log the error but continue processing other files
          console.warn('Error scanning file:', result.reason);
        }
      }
    } catch (error) {
      console.error('Unexpected error during batch file scanning:', error);
    }

    return allFindings;
  }
}