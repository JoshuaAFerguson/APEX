# ADR-018: Dangerous Operation Detector

## Status
Proposed

## Date
2025-01-07

## Context

APEX needs a centralized mechanism to identify dangerous tool operations before execution. Currently:
- Tools have a `dangerous: boolean` flag in `ToolDefinition` (types.ts:398-399)
- Command blocklist provides pattern-based blocking for shell commands (blocklist.ts)
- Permission system provides access control but doesn't detect danger levels
- No unified system to classify operations by severity or determine confirmation requirements

The system needs a `DangerousOperationDetector` class that:
1. Identifies dangerous tool operations using multiple detection mechanisms
2. Returns severity levels for risk assessment
3. Determines confirmation requirements based on severity and configuration
4. Integrates with existing blocklist patterns and permission system

## Decision

### 1. Core Architecture

Create `DangerousOperationDetector` in `packages/core/src/security/dangerous-operation-detector.ts`:

```
packages/core/src/security/
├── dangerous-operation-detector.ts  # Main detector class
├── operation-patterns.ts            # Pattern definitions by tool category
├── index.ts                         # Module exports
└── __tests__/
    └── dangerous-operation-detector.test.ts
```

### 2. Type Definitions

Add new types to `packages/core/src/types.ts`:

```typescript
/**
 * Severity levels for dangerous operations
 * Aligned with existing CodeSmell severity for consistency
 */
export const DangerousSeveritySchema = z.enum([
  'low',      // Minor risk, informational warning
  'medium',   // Moderate risk, recommend confirmation
  'high',     // High risk, require confirmation
  'critical'  // Critical risk, may require additional authorization
]);
export type DangerousSeverity = z.infer<typeof DangerousSeveritySchema>;

/**
 * Confirmation requirements for dangerous operations
 */
export const ConfirmationRequirementSchema = z.enum([
  'none',           // No confirmation needed
  'optional',       // Confirmation recommended but not required
  'required',       // Must confirm before proceeding
  'elevated'        // Requires elevated/admin authorization
]);
export type ConfirmationRequirement = z.infer<typeof ConfirmationRequirementSchema>;

/**
 * Result of dangerous operation detection
 */
export const DangerousOperationResultSchema = z.object({
  /** Whether the operation is considered dangerous */
  isDangerous: z.boolean(),

  /** Severity level if dangerous */
  severity: DangerousSeveritySchema.optional(),

  /** Confirmation requirement level */
  confirmationRequired: ConfirmationRequirementSchema,

  /** Categories of danger detected */
  categories: z.array(z.string()).default([]),

  /** Human-readable reasons for the danger classification */
  reasons: z.array(z.string()).default([]),

  /** Specific patterns that matched (for debugging) */
  matchedPatterns: z.array(z.string()).default([]),

  /** Suggested mitigations or safer alternatives */
  suggestions: z.array(z.string()).optional(),

  /** Metadata for auditing */
  metadata: z.record(z.string(), z.unknown()).optional()
});
export type DangerousOperationResult = z.infer<typeof DangerousOperationResultSchema>;

/**
 * Context for operation detection
 */
export const OperationContextSchema = z.object({
  /** The tool being invoked */
  toolName: z.string(),

  /** Tool definition (provides dangerous flag) */
  toolDefinition: ToolDefinitionSchema.optional(),

  /** The operation parameters */
  parameters: z.record(z.string(), z.unknown()),

  /** Working directory context */
  workingDirectory: z.string().optional(),

  /** Agent/session context for permission checks */
  agentName: z.string().optional(),

  /** Current permission preset */
  permissionPreset: PermissionPresetSchema.optional()
});
export type OperationContext = z.infer<typeof OperationContextSchema>;
```

### 3. Pattern Definitions (operation-patterns.ts)

Define patterns organized by tool category, extending the existing blocklist pattern:

```typescript
export interface DangerousPattern {
  /** Regex pattern to match against operation parameters */
  pattern: RegExp;
  /** Severity of matching this pattern */
  severity: DangerousSeverity;
  /** Category of danger */
  category: string;
  /** Human-readable description of why this is dangerous */
  description: string;
  /** Suggestion for safer alternative */
  suggestion?: string;
}

export interface PatternCategory {
  /** Tool names this category applies to */
  tools: string[];
  /** Parameter to check (e.g., 'command', 'file_path', 'content') */
  parameterKey: string;
  /** Patterns to match */
  patterns: DangerousPattern[];
}

// Example categories:
export const DANGEROUS_PATTERNS: Record<string, PatternCategory> = {
  shellDestructive: {
    tools: ['Bash'],
    parameterKey: 'command',
    patterns: [
      // Re-use and extend existing blocklist patterns
    ]
  },
  fileSystemDestruction: {
    tools: ['Write', 'Edit', 'MultiEdit'],
    parameterKey: 'file_path',
    patterns: [
      {
        pattern: /^\/etc\//,
        severity: 'critical',
        category: 'system-config',
        description: 'Modifying system configuration files',
        suggestion: 'Consider using a configuration management tool'
      },
      // ... more patterns
    ]
  },
  sensitiveDataWrite: {
    tools: ['Write', 'Edit'],
    parameterKey: 'content',
    patterns: [
      {
        pattern: /(?:password|secret|api[_-]?key|token)\s*[:=]\s*['"][^'"]+['"]/i,
        severity: 'high',
        category: 'credential-exposure',
        description: 'Writing potential credentials to file',
        suggestion: 'Use environment variables or secret management'
      }
    ]
  },
  networkExfiltration: {
    tools: ['WebFetch', 'Bash'],
    parameterKey: 'url', // or 'command'
    patterns: [
      // Patterns for detecting data exfiltration
    ]
  }
};
```

### 4. DangerousOperationDetector Class

```typescript
/**
 * Detects dangerous operations across all tool invocations
 *
 * Integration points:
 * - Uses ToolDefinition.dangerous flag as primary indicator
 * - Applies pattern matching from operation-patterns.ts
 * - Integrates with blocklist.ts for shell command checking
 * - Respects per-tool configuration (requireConfirmation, blockedCommands)
 *
 * @example
 * ```typescript
 * const detector = new DangerousOperationDetector({
 *   includeBlocklist: true,
 *   customPatterns: [],
 *   severityThreshold: 'medium'
 * });
 *
 * const result = detector.detect({
 *   toolName: 'Bash',
 *   parameters: { command: 'rm -rf /tmp/test' }
 * });
 *
 * if (result.isDangerous && result.confirmationRequired === 'required') {
 *   // Request user confirmation
 * }
 * ```
 */
export class DangerousOperationDetector {
  private options: DetectorOptions;
  private patternCache: Map<string, PatternCategory[]>;

  constructor(options?: Partial<DetectorOptions>);

  /**
   * Detect if an operation is dangerous
   * @param context Operation context with tool and parameters
   * @returns Detection result with severity and confirmation requirements
   */
  detect(context: OperationContext): DangerousOperationResult;

  /**
   * Check only the tool's dangerous flag (fast path)
   * @param toolDefinition Tool definition to check
   * @returns true if tool is marked as dangerous
   */
  isToolDangerous(toolDefinition: ToolDefinition): boolean;

  /**
   * Determine confirmation requirement based on severity and config
   * @param severity Detected severity level
   * @param toolConfig Optional per-tool configuration
   * @returns Confirmation requirement level
   */
  getConfirmationRequirement(
    severity: DangerousSeverity | undefined,
    toolConfig?: ToolPermissionConfig
  ): ConfirmationRequirement;

  /**
   * Add custom patterns at runtime
   * @param category Category name
   * @param patterns Patterns to add
   */
  addPatterns(category: string, patterns: DangerousPattern[]): void;

  /**
   * Remove patterns by category
   * @param category Category to remove
   */
  removePatterns(category: string): void;
}

export interface DetectorOptions {
  /** Include existing command blocklist patterns (default: true) */
  includeBlocklist: boolean;

  /** Additional custom patterns */
  customPatterns: PatternCategory[];

  /** Minimum severity to report (default: 'low') */
  severityThreshold: DangerousSeverity;

  /** Whether to include matched patterns in result (default: false, for security) */
  includeMatchedPatterns: boolean;

  /** Cache compiled patterns for performance (default: true) */
  cachePatterns: boolean;
}
```

### 5. Integration Points

#### 5.1 With Existing Blocklist

The detector will wrap and extend `checkCommandBlocklist()`:

```typescript
// In detect() method for Bash tool:
if (context.toolName === 'Bash' && this.options.includeBlocklist) {
  const blocklistResult = checkCommandBlocklist(command);
  if (!blocklistResult.allowed) {
    // Map blocklist violation to DangerousOperationResult
    return {
      isDangerous: true,
      severity: 'critical', // Blocklist matches are always critical
      confirmationRequired: 'required',
      categories: [blocklistResult.violationType ?? 'blocklist'],
      reasons: [blocklistResult.blockedReason ?? 'Command blocked by security policy'],
      matchedPatterns: blocklistResult.violatedRule ? [blocklistResult.violatedRule] : [],
    };
  }
}
```

#### 5.2 With ToolDefinition.dangerous

Primary check using tool's dangerous flag:

```typescript
detect(context: OperationContext): DangerousOperationResult {
  // Fast path: check tool's dangerous flag first
  if (context.toolDefinition?.dangerous) {
    // Tool is inherently dangerous, apply pattern matching for severity
    const severity = this.detectPatternSeverity(context);
    return {
      isDangerous: true,
      severity: severity ?? 'medium', // Default for dangerous tools
      confirmationRequired: this.getConfirmationRequirement(severity ?? 'medium'),
      categories: ['dangerous-tool'],
      reasons: [`Tool '${context.toolName}' is marked as dangerous`],
    };
  }

  // Slow path: pattern matching for non-dangerous tools
  return this.detectByPatterns(context);
}
```

#### 5.3 With Per-Tool Configuration

Respect `requireConfirmation` from ToolPermissionConfig:

```typescript
getConfirmationRequirement(
  severity: DangerousSeverity | undefined,
  toolConfig?: BaseToolPermissionConfig
): ConfirmationRequirement {
  // If tool config explicitly requires confirmation, use it
  if (toolConfig?.requireConfirmation) {
    return 'required';
  }

  // Otherwise, derive from severity
  switch (severity) {
    case 'critical': return 'elevated';
    case 'high': return 'required';
    case 'medium': return 'optional';
    case 'low': return 'none';
    default: return 'none';
  }
}
```

#### 5.4 With PermissionPresetManager

The detector doesn't replace the permission system but complements it:

```typescript
// In orchestrator's tool execution flow:
async executeToolWithSafetyCheck(
  tool: ToolInterface,
  params: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolResult> {
  // Step 1: Check permissions via PermissionPresetManager
  const permissionLevel = await this.presetManager.getEffectivePermissionLevel(tool.name);
  if (permissionLevel === 'deny') {
    return { success: false, error: 'Tool access denied by permission policy' };
  }

  // Step 2: Detect dangerous operations
  const dangerResult = this.dangerDetector.detect({
    toolName: tool.name,
    toolDefinition: tool.getDefinition(),
    parameters: params,
    workingDirectory: context.workingDirectory,
    agentName: context.agentName,
  });

  // Step 3: Handle confirmation requirements
  if (dangerResult.confirmationRequired === 'required' ||
      dangerResult.confirmationRequired === 'elevated') {
    const confirmed = await this.requestConfirmation(dangerResult);
    if (!confirmed) {
      return { success: false, error: 'Operation cancelled by user' };
    }
  }

  // Step 4: Execute the tool
  return tool.execute(params, context);
}
```

### 6. Severity-to-Confirmation Mapping

| Severity | Default Confirmation | With `requireConfirmation: true` |
|----------|---------------------|----------------------------------|
| None     | none                | required                         |
| low      | none                | required                         |
| medium   | optional            | required                         |
| high     | required            | required                         |
| critical | elevated            | elevated                         |

### 7. Pattern Categories (Initial Set)

1. **Shell Commands** (extends blocklist.ts)
   - Destructive operations (rm -rf, dd, mkfs)
   - Privilege escalation (sudo, su, doas)
   - Resource exhaustion (fork bombs, infinite loops)
   - Network security (curl|bash, reverse shells)

2. **Filesystem Operations**
   - System paths (/etc, /usr, /bin, /lib, C:\Windows)
   - Hidden files (.ssh, .gnupg, .aws)
   - Large file operations (size > threshold)
   - Permission changes (chmod 777, chown root)

3. **Content Patterns**
   - Credential exposure (passwords, API keys, tokens)
   - PII data (SSN, credit cards, emails)
   - Code injection patterns

4. **Web Operations**
   - Data exfiltration URLs
   - Known malicious domains
   - Large data uploads

### 8. Module Exports

Update `packages/core/src/index.ts`:

```typescript
// Security utilities
export * from './security/index.js';
```

Create `packages/core/src/security/index.ts`:

```typescript
export { DangerousOperationDetector } from './dangerous-operation-detector.js';
export type { DetectorOptions } from './dangerous-operation-detector.js';
export { DANGEROUS_PATTERNS } from './operation-patterns.js';
export type { DangerousPattern, PatternCategory } from './operation-patterns.js';
```

## Consequences

### Positive

1. **Centralized Security Logic**: Single point for dangerous operation detection
2. **Layered Security**: Complements existing blocklist and permission systems
3. **Configurable Severity**: Allows fine-tuning of confirmation requirements
4. **Extensible Patterns**: Runtime addition of custom patterns
5. **Audit Trail**: Structured results for logging and analysis
6. **Performance**: Pattern caching and fast-path checking

### Negative

1. **Additional Complexity**: New abstraction layer in execution flow
2. **Maintenance Burden**: Pattern definitions need ongoing updates
3. **False Positives**: Overly strict patterns may block legitimate operations
4. **Performance Cost**: Pattern matching adds latency (mitigated by caching)

### Mitigations

- Implement pattern allowlist for known-safe operations
- Provide bypass mechanism for elevated users
- Monitor and tune false positive rates
- Use compiled regex caching for performance

## Implementation Notes

### File Structure

```
packages/core/src/security/
├── dangerous-operation-detector.ts   # ~200 lines
├── operation-patterns.ts             # ~150 lines
├── index.ts                          # ~10 lines
└── __tests__/
    ├── dangerous-operation-detector.test.ts  # ~300 lines
    └── operation-patterns.test.ts            # ~100 lines
```

### Key Implementation Details

1. **Pattern Compilation**: Pre-compile regex patterns on instantiation
2. **Result Caching**: Cache results for identical contexts (optional)
3. **Async Support**: All methods should be sync for performance, but detection result can be used in async flows
4. **Error Handling**: Never throw on invalid patterns; log and skip

### Testing Strategy

1. **Unit Tests**: Each pattern category, severity mapping, confirmation logic
2. **Integration Tests**: With blocklist.ts, with ToolDefinition
3. **Performance Tests**: Pattern matching with large inputs
4. **Security Tests**: Known dangerous commands are detected

## References

- ADR-014: BaseTool Abstract Class
- `packages/core/src/tools/shell/blocklist.ts`
- `packages/core/src/types.ts` (ToolDefinition, severity patterns)
- `packages/orchestrator/src/permission-manager.ts`
- `packages/orchestrator/src/permission-preset-manager.ts`
