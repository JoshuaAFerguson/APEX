import {
  SecretDetection,
  SecretDetectionSchema,
  SecretScanResult,
  SecretScanResultSchema,
  SecretPattern,
  SecretPatternSchema
} from '@apexcli/core';

export type { SecretPattern };

/**
 * Configuration for secret scanning patterns (internal representation)
 */
export interface SecretScanPattern {
  /** Name of the pattern for identification */
  name: string;
  /** Regular expression to match secrets */
  regex: RegExp;
  /** Type of secret this pattern detects */
  secretType: string;
  /** Severity level of this pattern */
  severity: 'critical' | 'high' | 'medium' | 'low';
  /** Description of what this pattern detects */
  description?: string;
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
  private patterns: SecretScanPattern[];
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
      // Convert SecretPattern to SecretScanPattern
      const convertedPatterns = this.config.customPatterns.map(pattern => this.convertToScanPattern(pattern));
      this.patterns.push(...convertedPatterns);
    }
  }

  /**
   * Scan content for secrets and return findings
   * @param content - The content to scan
   * @param filePath - Optional file path for context
   * @returns Array of SecretDetection objects
   */
  public scan(content: string, filePath = 'unknown'): SecretDetection[] {
    const detections: SecretDetection[] = [];
    const lines = content.split('\n');
    const scanTime = new Date();

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
          const detection: SecretDetection = {
            id: this.generateDetectionId(),
            patternName: pattern.name,
            secretType: pattern.secretType,
            severity: pattern.severity,
            filePath,
            lineNumber: lineIndex + 1, // 1-based line numbers
            columnNumber: match.startIndex + 1, // 1-based column numbers
            maskedMatch: this.config.maskSecrets ? this.maskSecret(match.value) : match.value,
            context: this.extractContext(line, match.startIndex, match.endIndex),
            detectedAt: scanTime,
            acknowledged: false,
          };

          detections.push(detection);
        }
      }
    }

    return detections;
  }

  /**
   * Find all matches for a pattern in a line
   */
  private findMatches(line: string, pattern: SecretScanPattern): Array<{
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
  private getBuiltInPatterns(): SecretScanPattern[] {
    return [
      // API Keys
      {
        name: 'generic-api-key',
        regex: /(?:api[_-]?key|apikey)["\s]*[:=]["\s]*([a-zA-Z0-9_\-]{16,})/gi,
        secretType: 'api-key',
        severity: 'medium',
        description: 'Generic API key pattern',
      },

      // AWS Keys
      {
        name: 'aws-access-key',
        regex: /AKIA[0-9A-Z]{16}/g,
        secretType: 'aws-access-key',
        severity: 'high',
        description: 'AWS Access Key ID',
      },
      {
        name: 'aws-secret-key',
        regex: /(?:aws[_-]?secret[_-]?access[_-]?key|aws[_-]?secret)["\s]*[:=]["\s]*([a-zA-Z0-9/+=]{40})/gi,
        secretType: 'aws-secret-key',
        severity: 'high',
        description: 'AWS Secret Access Key',
      },

      // GitHub Tokens
      {
        name: 'github-token',
        regex: /gh[pousr]_[A-Za-z0-9_]{36}/g,
        secretType: 'github-token',
        severity: 'high',
        description: 'GitHub Personal Access Token',
      },
      {
        name: 'github-classic-token',
        regex: /(?:github[_-]?token|gh[_-]?token)["\s]*[:=]["\s]*([a-f0-9]{40})/gi,
        secretType: 'github-token',
        severity: 'high',
        description: 'GitHub Classic Token',
      },

      // JWT Tokens
      {
        name: 'jwt-token',
        regex: /eyJ[a-zA-Z0-9_=-]+\.eyJ[a-zA-Z0-9_=-]+\.[a-zA-Z0-9_=-]+/g,
        secretType: 'jwt-token',
        severity: 'medium',
        description: 'JSON Web Token (JWT)',
      },

      // Database URLs and Connection Strings
      {
        name: 'database-url',
        regex: /(?:database[_-]?url|db[_-]?url|connection[_-]?string)["\s]*[:=]["\s]*["']?(?:postgres|mysql|mongodb|redis|sqlite):\/\/[^"'\s]+/gi,
        secretType: 'connection-string',
        severity: 'high',
        description: 'Database connection URL or connection string',
      },

      // Private Keys
      {
        name: 'private-key',
        regex: /-----BEGIN[A-Z\s]+PRIVATE KEY-----[\s\S]*?-----END[A-Z\s]+PRIVATE KEY-----/g,
        secretType: 'private-key',
        severity: 'critical',
        description: 'Private key (PEM format)',
      },

      // Passwords in config
      {
        name: 'password-field',
        regex: /(?:password|passwd|pwd)["\s]*[:=]["\s]*["']([^"'\s]{8,})["']/gi,
        secretType: 'password',
        severity: 'high',
        description: 'Password field in configuration',
      },

      // Slack Tokens
      {
        name: 'slack-token',
        regex: /xox[baprs]-[0-9a-zA-Z\-]{10,}/g,
        secretType: 'slack-token',
        severity: 'medium',
        description: 'Slack token',
      },

      // Generic secrets with high entropy
      {
        name: 'high-entropy-string',
        regex: /(?:secret|token|key)["\s]*[:=]["\s]*["']([a-zA-Z0-9_\-+/=]{32,})["']/gi,
        secretType: 'generic-secret',
        severity: 'medium',
        description: 'High entropy string that might be a secret',
      },

      // Base64 encoded secrets
      {
        name: 'base64-secret',
        regex: /(?:secret|token|key)["\s]*[:=]["\s]*["']([A-Za-z0-9+/]{32,}={0,2})["']/gi,
        secretType: 'base64-secret',
        severity: 'medium',
        description: 'Base64 encoded secret',
      },
    ];
  }

  /**
   * Get all configured patterns
   */
  public getPatterns(): SecretScanPattern[] {
    return [...this.patterns];
  }

  /**
   * Add a custom pattern
   */
  public addPattern(pattern: SecretPattern): void {
    this.patterns.push(this.convertToScanPattern(pattern));
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
   * @returns Promise that resolves to array of SecretDetection objects
   */
  public async scanFile(filePath: string): Promise<SecretDetection[]> {
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
   * @returns Promise that resolves to aggregated array of SecretDetection objects from all files
   */
  public async scanFiles(filePaths: string[]): Promise<SecretDetection[]> {
    const allDetections: SecretDetection[] = [];

    // Process files in parallel for better performance
    const scanPromises = filePaths.map(filePath => this.scanFile(filePath));

    try {
      const results = await Promise.allSettled(scanPromises);

      for (const result of results) {
        if (result.status === 'fulfilled') {
          allDetections.push(...result.value);
        } else {
          // Log the error but continue processing other files
          console.warn('Error scanning file:', result.reason);
        }
      }
    } catch (error) {
      console.error('Unexpected error during batch file scanning:', error);
    }

    return allDetections;
  }

  /**
   * Generate a unique ID for a detection
   */
  private generateDetectionId(): string {
    return `secret-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Convert a SecretPattern to a SecretScanPattern
   */
  private convertToScanPattern(pattern: SecretPattern): SecretScanPattern {
    return {
      name: pattern.name,
      regex: new RegExp(pattern.pattern),
      secretType: pattern.name,
      severity: pattern.severity || 'medium',
      description: pattern.description,
    };
  }

  /**
   * Create a comprehensive scan result
   */
  public createScanResult(detections: SecretDetection[], scannedContent?: string): SecretScanResult {
    const scanTime = new Date();

    return {
      hasSecrets: detections.length > 0,
      count: detections.length,
      detections,
      scannedContent,
      scannedAt: scanTime,
    };
  }
}
