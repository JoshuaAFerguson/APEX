# ADR-017: BashTool Dangerous Command Blocking and Sandboxing

## Status

Accepted

## Date

2025-01-03

## Context

The APEX platform's `BashTool` provides shell command execution capabilities for AI agents. Currently, the tool has basic security measures:

1. A `DANGEROUS_COMMANDS` set that generates warnings (not blocks) for commands like `rm`, `sudo`, `chmod`, etc.
2. Suspicious pattern detection that warns about shell injection patterns like `; rm`, `| rm`, etc.
3. Commands are still executed even when warnings are present.

This is insufficient for a production system where AI agents may execute commands autonomously. The acceptance criteria require:

- **Hard blocks** on dangerous command patterns (not just warnings)
- Path traversal attack prevention
- Working directory constraint validation
- Clear error messages for blocked commands

## Decision

### 1. Architecture Overview

We will implement a layered security model with the following components:

```
┌─────────────────────────────────────────────────────────────────┐
│                          BashTool                                │
├─────────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                   CommandSandbox                          │  │
│  │  ┌─────────────────┐  ┌─────────────────────────────────┐│  │
│  │  │  BlocklistGuard │  │    PathValidator                ││  │
│  │  │  - Patterns     │  │    - Traversal detection        ││  │
│  │  │  - Keywords     │  │    - Allowed paths              ││  │
│  │  │  - Regexes      │  │    - Sandbox root               ││  │
│  │  └─────────────────┘  └─────────────────────────────────┘│  │
│  │  ┌─────────────────────────────────────────────────────┐ │  │
│  │  │              WorkingDirectoryConstraint              │ │  │
│  │  │              - Base directory                        │ │  │
│  │  │              - Allowed subdirectories                │ │  │
│  │  └─────────────────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  execute() → sandbox.validate() → spawn()                       │
└─────────────────────────────────────────────────────────────────┘
```

### 2. New Types and Interfaces

```typescript
/**
 * Result of command security validation
 */
export interface CommandValidationResult {
  /** Whether the command is allowed to execute */
  allowed: boolean;
  /** Reason the command was blocked (if not allowed) */
  blockedReason?: string;
  /** Category of security violation */
  violationType?: 'blocklist' | 'path_traversal' | 'directory_escape' | 'forbidden_pattern';
  /** The specific pattern or rule that was violated */
  violatedRule?: string;
  /** Warnings that don't block but should be noted */
  warnings?: string[];
}

/**
 * Configuration for command sandboxing
 */
export interface SandboxConfig {
  /** Enable/disable sandboxing (default: true) */
  enabled: boolean;
  /** Base directory for command execution (working directory must be within) */
  baseDirectory?: string;
  /** Additional allowed directories outside base (absolute paths) */
  allowedPaths?: string[];
  /** Custom blocklist patterns (in addition to defaults) */
  customBlocklist?: string[];
  /** Patterns to explicitly allow (overrides blocklist) */
  allowlist?: string[];
  /** Whether to allow sudo commands (default: false) */
  allowSudo?: boolean;
  /** Whether to allow network commands like curl, wget (default: true) */
  allowNetwork?: boolean;
  /** Maximum command length (default: 10000) */
  maxCommandLength?: number;
}
```

### 3. Blocklist Categories

The blocklist will be organized into categories for maintainability:

```typescript
/**
 * Categorized dangerous patterns for clear error messages
 */
export const COMMAND_BLOCKLIST = {
  // Category 1: Destructive file operations
  destructive: {
    patterns: [
      /^rm\s+(-[a-zA-Z]*r[a-zA-Z]*f|--recursive|--force).*\/\s*$/,  // rm -rf /
      /^rm\s+(-[a-zA-Z]*r[a-zA-Z]*f|--recursive|--force)/,          // rm -rf anywhere
      />\s*\/dev\/sd[a-z]/,                                         // overwrite disk
      /^dd\s+.*of=\/dev\//,                                         // dd to device
      /^mkfs\./,                                                    // format filesystem
      /^shred\s/,                                                   // secure delete
      /^wipe\s/,                                                    // disk wipe
    ],
    message: 'Destructive file operation blocked',
  },

  // Category 2: Privilege escalation
  privilegeEscalation: {
    patterns: [
      /^sudo\s/,                                                    // sudo commands
      /^su\s/,                                                      // switch user
      /^doas\s/,                                                    // doas (OpenBSD sudo)
      /\|\s*sudo\s/,                                               // pipe to sudo
      /;\s*sudo\s/,                                                // chain with sudo
      /&&\s*sudo\s/,                                               // and with sudo
    ],
    message: 'Privilege escalation blocked',
  },

  // Category 3: Dangerous permission changes
  permissionAbuse: {
    patterns: [
      /chmod\s+777\s/,                                              // chmod 777
      /chmod\s+-R\s+777\s/,                                         // recursive chmod 777
      /chmod\s+[0-7]*[0-7][0-7][0-7]\s+\//,                        // chmod on root
      /chown\s+-R\s+.*\s+\//,                                       // recursive chown on /
    ],
    message: 'Dangerous permission change blocked',
  },

  // Category 4: System commands
  systemCommands: {
    patterns: [
      /^shutdown\s/,
      /^reboot\s*$/,
      /^halt\s*$/,
      /^poweroff\s*$/,
      /^init\s+[0-6]/,
      /^systemctl\s+(halt|reboot|poweroff)/,
    ],
    message: 'System command blocked',
  },

  // Category 5: Dangerous command substitution/injection
  commandInjection: {
    patterns: [
      /`[^`]*rm\s+/,                                               // backtick with rm
      /\$\([^)]*rm\s+/,                                            // $() with rm
      /;\s*rm\s+-[rf]/,                                            // ; rm -rf
      /\|\|\s*rm\s+-[rf]/,                                         // || rm -rf
      /&&\s*rm\s+-[rf]/,                                           // && rm -rf
    ],
    message: 'Potentially malicious command pattern blocked',
  },

  // Category 6: Fork bombs and resource exhaustion
  resourceExhaustion: {
    patterns: [
      /:\(\)\s*\{\s*:\|\s*:&\s*\}\s*;?\s*:/,                       // fork bomb
      /:\s*\(\s*\)\s*\{.*\|.*&.*\}/,                               // fork bomb variant
      /while\s*:\s*;\s*do/,                                        // infinite loop
      /for\s*\(\s*;\s*;\s*\)/,                                     // infinite for
    ],
    message: 'Resource exhaustion attack blocked',
  },
} as const;
```

### 4. Path Traversal Detection

```typescript
/**
 * Detects path traversal attempts in commands
 */
export function detectPathTraversal(
  command: string,
  baseDirectory?: string
): { detected: boolean; paths: string[] } {
  const traversalPatterns = [
    /\.\.\//g,                                    // ../
    /\.\.$/,                                      // ends with ..
    /\.\.['"]/,                                   // ..followed by quote
    /\/\.\.\//g,                                  // /../
    /^\.\.$/,                                     // just ..
  ];

  const suspiciousAbsolutePaths = [
    /\/etc\/(passwd|shadow|sudoers)/,
    /\/root\//,
    /~\/\.\w+/,                                   // ~/.bashrc, ~/.ssh, etc.
    /\/proc\//,
    /\/sys\//,
  ];

  // Extract all path-like strings from the command
  const pathMatches = command.match(/['"\/~][^'";\s|&]*/g) || [];

  // Check for traversal patterns
  // Check if resolved paths escape base directory
  // Return detected status and problematic paths
}
```

### 5. Working Directory Constraint

```typescript
/**
 * Validates that a command operates within allowed directories
 */
export function validateWorkingDirectory(
  workingDirectory: string | undefined,
  baseDirectory: string | undefined,
  allowedPaths: string[] = []
): CommandValidationResult {
  if (!baseDirectory) {
    return { allowed: true };
  }

  const cwd = workingDirectory || process.cwd();
  const resolvedCwd = path.resolve(cwd);
  const resolvedBase = path.resolve(baseDirectory);

  // Check if cwd is within base or allowed paths
  const isWithinBase = resolvedCwd.startsWith(resolvedBase);
  const isInAllowedPath = allowedPaths.some(p =>
    resolvedCwd.startsWith(path.resolve(p))
  );

  if (!isWithinBase && !isInAllowedPath) {
    return {
      allowed: false,
      blockedReason: `Working directory '${cwd}' is outside the allowed sandbox`,
      violationType: 'directory_escape',
      violatedRule: `baseDirectory: ${baseDirectory}`,
    };
  }

  return { allowed: true };
}
```

### 6. CommandSandbox Class

```typescript
/**
 * Sandbox for validating and constraining shell commands
 */
export class CommandSandbox {
  private config: Required<SandboxConfig>;

  constructor(config: Partial<SandboxConfig> = {}) {
    this.config = {
      enabled: true,
      baseDirectory: undefined,
      allowedPaths: [],
      customBlocklist: [],
      allowlist: [],
      allowSudo: false,
      allowNetwork: true,
      maxCommandLength: 10000,
      ...config,
    };
  }

  /**
   * Validates a command against all security rules
   */
  validate(
    command: string,
    workingDirectory?: string
  ): CommandValidationResult {
    if (!this.config.enabled) {
      return { allowed: true };
    }

    // 1. Check command length
    if (command.length > this.config.maxCommandLength) {
      return {
        allowed: false,
        blockedReason: `Command exceeds maximum length of ${this.config.maxCommandLength} characters`,
        violationType: 'forbidden_pattern',
      };
    }

    // 2. Check allowlist first (explicit allows)
    for (const pattern of this.config.allowlist) {
      if (command.match(new RegExp(pattern))) {
        return { allowed: true };
      }
    }

    // 3. Check blocklist patterns
    const blocklistResult = this.checkBlocklist(command);
    if (!blocklistResult.allowed) {
      return blocklistResult;
    }

    // 4. Check for path traversal
    const traversalResult = this.checkPathTraversal(command);
    if (!traversalResult.allowed) {
      return traversalResult;
    }

    // 5. Validate working directory
    const wdResult = validateWorkingDirectory(
      workingDirectory,
      this.config.baseDirectory,
      this.config.allowedPaths
    );
    if (!wdResult.allowed) {
      return wdResult;
    }

    return { allowed: true };
  }

  private checkBlocklist(command: string): CommandValidationResult {
    // Check each category in COMMAND_BLOCKLIST
    // Return appropriate error message with category context
  }

  private checkPathTraversal(command: string): CommandValidationResult {
    // Use detectPathTraversal function
    // Check if traversal escapes allowed directories
  }
}
```

### 7. Integration with BashTool

The `BashTool` class will be updated:

```typescript
export class BashTool extends BaseTool<BashToolInput, BashToolOutput> {
  private sandbox: CommandSandbox;

  constructor(sandboxConfig?: Partial<SandboxConfig>) {
    super({...});
    this.sandbox = new CommandSandbox(sandboxConfig);
  }

  validate(params: BashToolInput, context?: ToolExecutionContext): ValidationResult {
    // 1. Base validation (existing)
    const baseResult = super.validate(params, context);
    if (!baseResult.valid) {
      return baseResult;
    }

    // 2. Sandbox validation (new - blocks dangerous commands)
    const sandboxResult = this.sandbox.validate(
      params.command,
      context?.workingDirectory
    );

    if (!sandboxResult.allowed) {
      return {
        valid: false,
        errors: [sandboxResult.blockedReason!],
      };
    }

    // 3. Existing warning checks (for non-blocking concerns)
    // ... existing code for warnings ...
  }
}
```

### 8. Error Messages

Clear, actionable error messages:

```typescript
const ERROR_MESSAGES = {
  destructive: 'Command blocked: This command could destroy files or data. ' +
               'Specific patterns like "rm -rf /" are not allowed.',
  privilegeEscalation: 'Command blocked: Privilege escalation is not permitted. ' +
                       'Commands like "sudo" and "su" are blocked.',
  permissionAbuse: 'Command blocked: Dangerous permission changes detected. ' +
                   'Setting permissions to 777 or changing ownership recursively on system paths is not allowed.',
  systemCommands: 'Command blocked: System control commands are not permitted. ' +
                  'Commands like "shutdown", "reboot", and "halt" are blocked.',
  commandInjection: 'Command blocked: Potentially malicious pattern detected. ' +
                    'The command contains patterns commonly used for injection attacks.',
  resourceExhaustion: 'Command blocked: Resource exhaustion pattern detected. ' +
                      'Commands that could consume unlimited resources are not allowed.',
  pathTraversal: 'Command blocked: Path traversal detected. ' +
                 'Commands cannot access paths outside the allowed directories.',
  directoryEscape: 'Command blocked: Working directory is outside sandbox. ' +
                   'Commands must execute within the configured base directory.',
};
```

### 9. File Structure

```
packages/core/src/tools/shell/
├── bash-tool.ts              # Updated with sandbox integration
├── command-sandbox.ts        # NEW: CommandSandbox class
├── blocklist.ts              # NEW: Blocklist patterns and categories
├── path-validator.ts         # NEW: Path traversal detection
├── index.ts                  # Updated exports
└── __tests__/
    ├── bash-tool.test.ts
    ├── bash-tool.security.test.ts   # Updated with blocking tests
    ├── command-sandbox.test.ts      # NEW: Sandbox unit tests
    └── path-validator.test.ts       # NEW: Path validation tests
```

## Consequences

### Positive

1. **Defense in Depth**: Multiple layers of security checking
2. **Clear Error Messages**: Users understand why commands are blocked
3. **Configurable**: Sandbox can be customized per use case
4. **Maintainable**: Patterns organized by category for easy updates
5. **Testable**: Each component can be tested independently
6. **Backward Compatible**: Existing BashTool API unchanged; sandbox is opt-in for strictness

### Negative

1. **False Positives**: Some legitimate commands may be blocked
2. **Complexity**: Additional code and maintenance burden
3. **Performance**: Regex matching adds latency (minimal, ~1-5ms)

### Mitigations

1. **Allowlist**: Explicit patterns can bypass blocklist
2. **Documentation**: Clear docs on what's blocked and why
3. **Caching**: Compile regexes once, reuse for each validation

## Implementation Notes

### Phase 1: Core Sandbox (This PR)
- Implement `CommandSandbox` class
- Implement blocklist patterns
- Implement path traversal detection
- Integrate with `BashTool.validate()`
- Add comprehensive tests

### Phase 2: Enhanced Features (Future)
- Command history logging for audit
- Rate limiting
- Per-agent custom sandbox configs
- Integration with workflow-level security policies

## Testing Strategy

1. **Unit Tests**: Each blocklist category tested individually
2. **Integration Tests**: Full command validation flow
3. **Edge Cases**: Unicode, escaping, encoding attacks
4. **Performance Tests**: Validation latency benchmarks
5. **False Positive Tests**: Ensure legitimate commands pass

## References

- [OWASP Command Injection Prevention](https://cheatsheetseries.owasp.org/cheatsheets/OS_Command_Injection_Defense_Cheat_Sheet.html)
- [CWE-78: Improper Neutralization of Special Elements](https://cwe.mitre.org/data/definitions/78.html)
- Existing APEX ADRs: ADR-014 (BaseTool Architecture)
