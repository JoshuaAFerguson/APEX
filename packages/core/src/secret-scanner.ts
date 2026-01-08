import * as crypto from 'crypto';
import { SecretDetection, SecretPattern } from './types';

/**
 * Configuration options for SecretScanner
 */
export interface SecretScannerOptions {
  /** Whether to include built-in patterns for common secrets */
  includeBuiltInPatterns?: boolean;
  /** Custom secret patterns to detect */
  customPatterns?: SecretPattern[];
  /** Maximum line length to scan (to avoid performance issues) */
  maxLineLength?: number;
  /** Number of characters to include as context around matches */
  contextLength?: number;
}

/**
 * Secret pattern with compiled regex for performance
 */
interface CompiledSecretPattern extends SecretPattern {
  regex: RegExp;
}

/**
 * SecretScanner utility for detecting sensitive information in content
 *
 * Scans text content for various types of secrets including API keys, tokens,
 * passwords, private keys, and other sensitive data patterns.
 */
export class SecretScanner {
  private patterns: CompiledSecretPattern[];
  private options: Required<SecretScannerOptions>;

  /**
   * Built-in patterns for common secret types
   */
  private static readonly BUILT_IN_PATTERNS: SecretPattern[] = [
    {
      name: 'AWS Access Key ID',
      pattern: 'AKIA[0-9A-Z]{16}',
      severity: 'critical',
      description: 'AWS Access Key identifier'
    },
    {
      name: 'AWS Secret Access Key',
      pattern: '[A-Za-z0-9/+=]{40}',
      severity: 'critical',
      description: 'AWS Secret Access Key (40 chars of base64)'
    },
    {
      name: 'GitHub Token',
      pattern: 'ghp_[A-Za-z0-9]{36}',
      severity: 'high',
      description: 'GitHub Personal Access Token'
    },
    {
      name: 'GitHub App Token',
      pattern: 'ghs_[A-Za-z0-9]{36}',
      severity: 'high',
      description: 'GitHub App Installation Token'
    },
    {
      name: 'GitHub OAuth Token',
      pattern: 'gho_[A-Za-z0-9]{36}',
      severity: 'high',
      description: 'GitHub OAuth Token'
    },
    {
      name: 'Generic API Key',
      pattern: '(?:api[_-]?key|apikey)\\s*[=:]\\s*[\'"]?([A-Za-z0-9_\\-]{16,})(?:[\'"]|\\s|$)',
      severity: 'high',
      description: 'Generic API key pattern'
    },
    {
      name: 'JWT Token',
      pattern: 'eyJ[A-Za-z0-9-_=]+\\.[A-Za-z0-9-_=]+\\.?[A-Za-z0-9-_.+/=]*',
      severity: 'medium',
      description: 'JSON Web Token'
    },
    {
      name: 'Private Key Header',
      pattern: '-----BEGIN (RSA |OPENSSH |DSA |EC |PGP )?PRIVATE KEY-----',
      severity: 'critical',
      description: 'Private key header (PEM format)'
    },
    {
      name: 'Basic Auth Header',
      pattern: 'Authorization\\s*:\\s*Basic\\s+[A-Za-z0-9+/=]+',
      severity: 'high',
      description: 'HTTP Basic Authentication header'
    },
    {
      name: 'Bearer Token',
      pattern: 'Authorization\\s*:\\s*Bearer\\s+[A-Za-z0-9\\-._~+/=]+',
      severity: 'high',
      description: 'HTTP Bearer token'
    },
    {
      name: 'Password in URL',
      pattern: '://[^\\s:]+:([^\\s@]+)@',
      severity: 'high',
      description: 'Password in URL format'
    },
    {
      name: 'Connection String Password',
      pattern: '(?:password|pwd)\\s*[=:]\\s*[\'"]?([^\\s\'";&|]+)',
      severity: 'medium',
      description: 'Password in connection string'
    },
    {
      name: 'Slack Token',
      pattern: 'xox[bpoa]-[0-9]{12}-[0-9]{12}-[a-zA-Z0-9]{24}',
      severity: 'high',
      description: 'Slack API token'
    },
    {
      name: 'Discord Token',
      pattern: '[MN][A-Za-z\\d]{23}\\.[\\w-]{6}\\.[\\w-]{27}',
      severity: 'high',
      description: 'Discord bot token'
    },
    {
      name: 'Google API Key',
      pattern: 'AIza[0-9A-Za-z\\-_]{35}',
      severity: 'high',
      description: 'Google API key'
    },
    {
      name: 'Stripe API Key',
      pattern: 'sk_live_[0-9a-zA-Z]{24}',
      severity: 'critical',
      description: 'Stripe live secret key'
    },
    {
      name: 'Stripe Test API Key',
      pattern: 'sk_test_[0-9a-zA-Z]{24}',
      severity: 'medium',
      description: 'Stripe test secret key'
    },
    {
      name: 'PayPal OAuth Token',
      pattern: 'access_token\\$production\\$[0-9a-z]{16}\\$[0-9a-f]{32}',
      severity: 'critical',
      description: 'PayPal production OAuth token'
    },
    {
      name: 'Generic Secret Pattern',
      pattern: '(?:secret|token|key|password|passwd)\\s*[=:]\\s*[\'"]?([A-Za-z0-9_\\-+/=]{12,})(?:[\'"]|\\s|$)',
      severity: 'medium',
      description: 'Generic secret/token/key assignment'
    }
  ];

  constructor(options: SecretScannerOptions = {}) {
    this.options = {
      includeBuiltInPatterns: true,
      customPatterns: [],
      maxLineLength: 10000,
      contextLength: 20,
      ...options
    };

    this.patterns = this.compilePatterns();
  }

  /**
   * Compile all patterns (built-in + custom) into regex objects for efficient matching
   */
  private compilePatterns(): CompiledSecretPattern[] {
    const patterns: SecretPattern[] = [];

    // Add built-in patterns if enabled
    if (this.options.includeBuiltInPatterns) {
      patterns.push(...SecretScanner.BUILT_IN_PATTERNS);
    }

    // Add custom patterns
    patterns.push(...this.options.customPatterns);

    // Compile patterns to regex
    return patterns.map(pattern => ({
      ...pattern,
      regex: new RegExp(pattern.pattern, 'gi')
    }));
  }

  /**
   * Scan content for secrets and return detection results
   * @param content - Text content to scan for secrets
   * @returns Array of secret detections found in the content
   */
  public scan(content: string): SecretDetection[] {
    if (!content || typeof content !== 'string') {
      return [];
    }

    const detections: SecretDetection[] = [];
    const lines = content.split('\n');

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      const lineNumber = lineIndex + 1;

      // Skip lines that are too long to avoid performance issues
      if (line.length > this.options.maxLineLength) {
        continue;
      }

      // Scan the line with each pattern
      for (const pattern of this.patterns) {
        // Reset regex state for new line
        pattern.regex.lastIndex = 0;

        let match: RegExpExecArray | null;
        while ((match = pattern.regex.exec(line)) !== null) {
          const detectedAt = new Date();
          const columnNumber = match.index + 1;

          // Generate unique detection ID
          const id = this.generateDetectionId(pattern.name, lineNumber, columnNumber);

          // Get context around the match
          const context = this.extractContext(line, match.index, match[0].length);

          // Mask the detected secret
          const maskedMatch = this.maskSecret(match[0]);

          // Determine secret type from pattern name
          const secretType = this.getSecretType(pattern.name);

          detections.push({
            id,
            patternName: pattern.name,
            secretType,
            severity: pattern.severity,
            filePath: undefined, // Not available in this context
            lineNumber,
            columnNumber,
            maskedMatch,
            context,
            detectedAt,
            acknowledged: false
          });

          // Prevent infinite loops on zero-width matches
          if (match.index === pattern.regex.lastIndex) {
            pattern.regex.lastIndex++;
          }
        }
      }
    }

    return detections;
  }

  /**
   * Generate a unique detection ID
   */
  private generateDetectionId(patternName: string, lineNumber: number, columnNumber: number): string {
    const timestamp = Date.now().toString(36);
    const hash = crypto
      .createHash('md5')
      .update(`${patternName}:${lineNumber}:${columnNumber}`)
      .digest('hex')
      .substring(0, 8);
    return `detect_${timestamp}_${hash}`;
  }

  /**
   * Extract context around a match
   */
  private extractContext(line: string, matchStart: number, matchLength: number): string {
    const contextLength = this.options.contextLength;
    const start = Math.max(0, matchStart - contextLength);
    const end = Math.min(line.length, matchStart + matchLength + contextLength);

    let context = line.substring(start, end);

    // Add ellipsis if context was truncated
    if (start > 0) {
      context = '...' + context;
    }
    if (end < line.length) {
      context = context + '...';
    }

    return context;
  }

  /**
   * Mask a detected secret by replacing characters with asterisks
   */
  private maskSecret(secret: string): string {
    if (secret.length <= 4) {
      return '*'.repeat(secret.length);
    }

    // Show first 2 and last 2 characters, mask the middle
    const start = secret.substring(0, 2);
    const end = secret.substring(secret.length - 2);
    const middle = '*'.repeat(secret.length - 4);

    return start + middle + end;
  }

  /**
   * Determine secret type from pattern name
   */
  private getSecretType(patternName: string): string {
    const name = patternName.toLowerCase();

    if (name.includes('api key') || name.includes('apikey')) {
      return 'api_key';
    }
    if (name.includes('token')) {
      return 'token';
    }
    if (name.includes('password') || name.includes('passwd')) {
      return 'password';
    }
    if (name.includes('private key')) {
      return 'private_key';
    }
    if (name.includes('auth')) {
      return 'auth_credential';
    }
    if (name.includes('secret')) {
      return 'secret';
    }

    // Default fallback
    return 'credential';
  }

  /**
   * Add a custom pattern to the scanner
   */
  public addPattern(pattern: SecretPattern): void {
    this.options.customPatterns.push(pattern);
    this.patterns = this.compilePatterns();
  }

  /**
   * Remove a pattern by name
   */
  public removePattern(name: string): boolean {
    const index = this.options.customPatterns.findIndex(p => p.name === name);
    if (index >= 0) {
      this.options.customPatterns.splice(index, 1);
      this.patterns = this.compilePatterns();
      return true;
    }
    return false;
  }

  /**
   * Get all active patterns (built-in + custom)
   */
  public getPatterns(): SecretPattern[] {
    const patterns: SecretPattern[] = [];

    if (this.options.includeBuiltInPatterns) {
      patterns.push(...SecretScanner.BUILT_IN_PATTERNS);
    }

    patterns.push(...this.options.customPatterns);
    return patterns;
  }

  /**
   * Update scanner options and recompile patterns
   */
  public updateOptions(options: Partial<SecretScannerOptions>): void {
    this.options = { ...this.options, ...options };
    this.patterns = this.compilePatterns();
  }
}