import type { HookInput } from '@anthropic-ai/claude-agent-sdk';

/**
 * Risk severity levels for dangerous operations
 */
export type RiskSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Details about a detected dangerous operation
 */
export interface DangerousOperationDetails {
  /** The tool that will perform the operation */
  tool: string;
  /** Brief description of the operation */
  operation: string;
  /** Risk severity level */
  severity: RiskSeverity;
  /** Detailed explanation of the risk */
  reason: string;
  /** Whether user confirmation is required before proceeding */
  requiresConfirmation: boolean;
  /** Additional metadata about the operation */
  metadata?: Record<string, unknown>;
}

/**
 * Result of dangerous operation detection
 */
export interface DetectionResult {
  /** Whether a dangerous operation was detected */
  isDangerous: boolean;
  /** Details about the dangerous operation (if any) */
  details?: DangerousOperationDetails;
}

/**
 * Configuration for dangerous operation patterns
 */
interface DangerousPattern {
  /** Pattern to match against (string or regex) */
  pattern: string | RegExp;
  /** Risk severity if pattern matches */
  severity: RiskSeverity;
  /** Description of why this is dangerous */
  reason: string;
  /** Whether to require confirmation */
  requiresConfirmation: boolean;
}

/**
 * Detects dangerous operations based on tool usage patterns
 */
export class DangerousOperationDetector {
  private readonly bashPatterns: DangerousPattern[];
  private readonly filePatterns: DangerousPattern[];
  private readonly webPatterns: DangerousPattern[];

  constructor() {
    this.bashPatterns = this.initializeBashPatterns();
    this.filePatterns = this.initializeFilePatterns();
    this.webPatterns = this.initializeWebPatterns();
  }

  /**
   * Analyze a tool operation for dangerous patterns
   */
  public async detectDangerousOperation(input: HookInput): Promise<DetectionResult> {
    const toolInput = this.getToolInput(input);
    const toolName = this.getToolName(input);

    switch (toolName) {
      case 'Bash':
        return this.analyzeCommand(toolInput);
      case 'Write':
      case 'Edit':
      case 'MultiEdit':
        return this.analyzeFileOperation(toolInput, toolName);
      case 'WebFetch':
        return this.analyzeWebRequest(toolInput);
      default:
        return { isDangerous: false };
    }
  }

  /**
   * Analyze bash command for dangerous patterns
   */
  private analyzeCommand(toolInput: Record<string, unknown>): DetectionResult {
    const command = (toolInput.command as string) || '';
    const lowerCommand = command.toLowerCase();

    // Check against dangerous patterns
    for (const pattern of this.bashPatterns) {
      const matches = typeof pattern.pattern === 'string'
        ? lowerCommand.includes(pattern.pattern.toLowerCase())
        : pattern.pattern.test(command);

      if (matches) {
        return {
          isDangerous: true,
          details: {
            tool: 'Bash',
            operation: `Execute command: ${command.substring(0, 100)}${command.length > 100 ? '...' : ''}`,
            severity: pattern.severity,
            reason: pattern.reason,
            requiresConfirmation: pattern.requiresConfirmation,
            metadata: {
              command,
              pattern: pattern.pattern.toString(),
            },
          },
        };
      }
    }

    return { isDangerous: false };
  }

  /**
   * Analyze file operation for dangerous patterns
   */
  private analyzeFileOperation(toolInput: Record<string, unknown>, toolName: string): DetectionResult {
    const filePath = (toolInput.file_path as string) || (toolInput.path as string) || '';
    const content = (toolInput.content as string) || (toolInput.new_string as string) || '';

    // Check file path patterns
    for (const pattern of this.filePatterns) {
      const matches = typeof pattern.pattern === 'string'
        ? filePath.includes(pattern.pattern)
        : pattern.pattern.test(filePath);

      if (matches) {
        return {
          isDangerous: true,
          details: {
            tool: toolName,
            operation: `${toolName === 'Write' ? 'Write to' : 'Edit'} file: ${filePath}`,
            severity: pattern.severity,
            reason: pattern.reason,
            requiresConfirmation: pattern.requiresConfirmation,
            metadata: {
              filePath,
              hasContent: !!content,
              pattern: pattern.pattern.toString(),
            },
          },
        };
      }
    }

    // Check content for sensitive information
    if (content && this.containsSensitiveContent(content)) {
      return {
        isDangerous: true,
        details: {
          tool: toolName,
          operation: `${toolName} file with potentially sensitive content`,
          severity: 'medium',
          reason: 'File content may contain sensitive information (secrets, credentials, etc.)',
          requiresConfirmation: true,
          metadata: {
            filePath,
            contentLength: content.length,
          },
        },
      };
    }

    return { isDangerous: false };
  }

  /**
   * Analyze web request for dangerous patterns
   */
  private analyzeWebRequest(toolInput: Record<string, unknown>): DetectionResult {
    const url = (toolInput.url as string) || '';
    const method = (toolInput.method as string) || 'GET';

    // Check URL patterns
    for (const pattern of this.webPatterns) {
      const matches = typeof pattern.pattern === 'string'
        ? url.includes(pattern.pattern)
        : pattern.pattern.test(url);

      if (matches) {
        return {
          isDangerous: true,
          details: {
            tool: 'WebFetch',
            operation: `${method} request to: ${url}`,
            severity: pattern.severity,
            reason: pattern.reason,
            requiresConfirmation: pattern.requiresConfirmation,
            metadata: {
              url,
              method,
              pattern: pattern.pattern.toString(),
            },
          },
        };
      }
    }

    return { isDangerous: false };
  }

  /**
   * Check if content contains sensitive information
   */
  private containsSensitiveContent(content: string): boolean {
    const sensitivePatterns = [
      /(?:password|pwd|pass)\s*[=:]\s*['"][^'"]{3,}/i,
      /(?:api[_-]?key|apikey)\s*[=:]\s*['"][^'"]{10,}/i,
      /(?:secret|token)\s*[=:]\s*['"][^'"]{10,}/i,
      /(?:credential|auth)\s*[=:]\s*['"][^'"]{8,}/i,
      /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----/i,
      /sk-[a-zA-Z0-9]{20,}/i, // OpenAI API keys
      /ghp_[a-zA-Z0-9]{36}/i, // GitHub personal access tokens
    ];

    return sensitivePatterns.some(pattern => pattern.test(content));
  }

  /**
   * Initialize dangerous bash command patterns
   */
  private initializeBashPatterns(): DangerousPattern[] {
    return [
      // Critical - destructive filesystem operations
      {
        pattern: 'rm -rf /',
        severity: 'critical',
        reason: 'Attempts to delete the entire filesystem root',
        requiresConfirmation: true,
      },
      {
        pattern: 'rm -rf ~',
        severity: 'critical',
        reason: 'Attempts to delete the entire home directory',
        requiresConfirmation: true,
      },
      {
        pattern: 'rm -rf /*',
        severity: 'critical',
        reason: 'Attempts to delete all files in root directory',
        requiresConfirmation: true,
      },
      // Critical - system-level damage
      {
        pattern: /:\(\)\{:\|:&\};:/,
        severity: 'critical',
        reason: 'Fork bomb that can crash the system',
        requiresConfirmation: true,
      },
      {
        pattern: 'mkfs.',
        severity: 'critical',
        reason: 'Formats filesystem, destroying all data on the device',
        requiresConfirmation: true,
      },
      {
        pattern: 'dd if=/dev/zero',
        severity: 'critical',
        reason: 'Writes zeros to device, potentially destroying data',
        requiresConfirmation: true,
      },
      {
        pattern: '--no-preserve-root',
        severity: 'critical',
        reason: 'Bypasses safety checks for destructive operations',
        requiresConfirmation: true,
      },
      // High - dangerous system modifications
      {
        pattern: 'chmod -R 777 /',
        severity: 'high',
        reason: 'Makes entire filesystem world-writable, major security risk',
        requiresConfirmation: true,
      },
      {
        pattern: />\s*\/dev\/sd[a-z]/,
        severity: 'high',
        reason: 'Writes directly to disk device, can corrupt data',
        requiresConfirmation: true,
      },
      {
        pattern: 'mv ~ /dev/null',
        severity: 'high',
        reason: 'Attempts to move home directory to null device',
        requiresConfirmation: true,
      },
      // High - code injection risks
      {
        pattern: /\|\s*sh\s*$/,
        severity: 'high',
        reason: 'Pipes input to shell interpreter, potential code injection',
        requiresConfirmation: true,
      },
      {
        pattern: /\|\s*bash\s*$/,
        severity: 'high',
        reason: 'Pipes input to bash interpreter, potential code injection',
        requiresConfirmation: true,
      },
      // High - database destruction
      {
        pattern: /drop\s+database/i,
        severity: 'high',
        reason: 'Drops entire database, causing permanent data loss',
        requiresConfirmation: true,
      },
      {
        pattern: /drop\s+table/i,
        severity: 'high',
        reason: 'Drops database table, causing permanent data loss',
        requiresConfirmation: true,
      },
      {
        pattern: /truncate\s+table/i,
        severity: 'high',
        reason: 'Deletes all data from database table',
        requiresConfirmation: true,
      },
      // Medium - risky but potentially legitimate operations
      {
        pattern: 'sudo ',
        severity: 'medium',
        reason: 'Executes command with elevated privileges',
        requiresConfirmation: false,
      },
      {
        pattern: 'chmod ',
        severity: 'medium',
        reason: 'Changes file permissions',
        requiresConfirmation: false,
      },
      {
        pattern: 'chown ',
        severity: 'medium',
        reason: 'Changes file ownership',
        requiresConfirmation: false,
      },
      {
        pattern: 'rm -r',
        severity: 'medium',
        reason: 'Recursively deletes directories and files',
        requiresConfirmation: false,
      },
      {
        pattern: 'git push -f',
        severity: 'medium',
        reason: 'Force pushes to git repository, can overwrite history',
        requiresConfirmation: false,
      },
      {
        pattern: 'git reset --hard',
        severity: 'medium',
        reason: 'Hard resets git repository, loses uncommitted changes',
        requiresConfirmation: false,
      },
    ];
  }

  /**
   * Initialize dangerous file operation patterns
   */
  private initializeFilePatterns(): DangerousPattern[] {
    return [
      // Critical - system files
      {
        pattern: '/etc/passwd',
        severity: 'critical',
        reason: 'System user account file, modifying can break authentication',
        requiresConfirmation: true,
      },
      {
        pattern: '/etc/shadow',
        severity: 'critical',
        reason: 'System password file, contains encrypted passwords',
        requiresConfirmation: true,
      },
      {
        pattern: '/etc/hosts',
        severity: 'high',
        reason: 'System DNS configuration, can redirect network traffic',
        requiresConfirmation: true,
      },
      // High - sensitive configuration files
      {
        pattern: '.env',
        severity: 'high',
        reason: 'Environment file, may contain secrets and API keys',
        requiresConfirmation: true,
      },
      {
        pattern: '.env.local',
        severity: 'high',
        reason: 'Local environment file, may contain secrets',
        requiresConfirmation: true,
      },
      {
        pattern: '.env.production',
        severity: 'high',
        reason: 'Production environment file, may contain secrets',
        requiresConfirmation: true,
      },
      // High - SSH and authentication files
      {
        pattern: 'id_rsa',
        severity: 'high',
        reason: 'SSH private key file, provides authentication access',
        requiresConfirmation: true,
      },
      {
        pattern: 'id_ed25519',
        severity: 'high',
        reason: 'SSH private key file, provides authentication access',
        requiresConfirmation: true,
      },
      {
        pattern: '.ssh/config',
        severity: 'high',
        reason: 'SSH configuration file, contains connection settings',
        requiresConfirmation: true,
      },
      // Medium - configuration files that may contain sensitive info
      {
        pattern: '.gitconfig',
        severity: 'medium',
        reason: 'Git configuration file, may contain credentials',
        requiresConfirmation: false,
      },
      {
        pattern: '.npmrc',
        severity: 'medium',
        reason: 'NPM configuration file, may contain registry tokens',
        requiresConfirmation: false,
      },
      {
        pattern: '.pypirc',
        severity: 'medium',
        reason: 'Python package index configuration, may contain credentials',
        requiresConfirmation: false,
      },
    ];
  }

  /**
   * Initialize dangerous web request patterns
   */
  private initializeWebPatterns(): DangerousPattern[] {
    return [
      // Critical - local system access
      {
        pattern: /^file:\/\//i,
        severity: 'critical',
        reason: 'Local file system access via file:// protocol',
        requiresConfirmation: true,
      },
      {
        pattern: /localhost|127\.0\.0\.1/i,
        severity: 'high',
        reason: 'Access to localhost services, potential security risk',
        requiresConfirmation: true,
      },
      // High - private networks
      {
        pattern: /192\.168\./,
        severity: 'high',
        reason: 'Access to private network range (192.168.x.x)',
        requiresConfirmation: true,
      },
      {
        pattern: /10\./,
        severity: 'high',
        reason: 'Access to private network range (10.x.x.x)',
        requiresConfirmation: true,
      },
      {
        pattern: /172\.(1[6-9]|2[0-9]|3[0-1])\./,
        severity: 'high',
        reason: 'Access to private network range (172.16-31.x.x)',
        requiresConfirmation: true,
      },
      // High - potentially sensitive endpoints
      {
        pattern: /password/i,
        severity: 'high',
        reason: 'URL contains "password", may access sensitive endpoint',
        requiresConfirmation: true,
      },
      {
        pattern: /secret/i,
        severity: 'medium',
        reason: 'URL contains "secret", may access sensitive endpoint',
        requiresConfirmation: false,
      },
      {
        pattern: /token/i,
        severity: 'medium',
        reason: 'URL contains "token", may access sensitive endpoint',
        requiresConfirmation: false,
      },
      {
        pattern: /api.?key/i,
        severity: 'medium',
        reason: 'URL contains "apikey", may access sensitive endpoint',
        requiresConfirmation: false,
      },
    ];
  }

  /**
   * Extract tool input from hook input
   */
  private getToolInput(input: HookInput): Record<string, unknown> {
    if ('tool_input' in input && input.tool_input != null) {
      if (typeof input.tool_input === 'object') {
        return input.tool_input as Record<string, unknown>;
      }
    }
    return {};
  }

  /**
   * Extract tool name from hook input
   */
  private getToolName(input: HookInput): string {
    if ('tool_name' in input) {
      return input.tool_name;
    }
    return 'unknown';
  }
}