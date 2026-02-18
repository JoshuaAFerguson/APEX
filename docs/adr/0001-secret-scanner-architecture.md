# ADR 0001: SecretScanner Architecture

## Status
**Proposed**

## Context
APEX needs to scan content for secrets (API keys, tokens, passwords, private keys) to prevent accidental exposure in agent outputs, file writes, and logs. This is a security-critical feature that must be:

1. Fast - scanning happens frequently during agent execution
2. Accurate - minimize false positives while catching real secrets
3. Extensible - support custom patterns for project-specific secrets
4. Precise - provide line/column location for findings

## Decision

### 1. Module Location and Structure

Create `packages/orchestrator/src/scanner.ts` containing:
- `SecretScanner` class with pattern matching engine
- Related types (`SecretFinding`, `SecretPattern`, `ScannerConfig`)
- Built-in patterns for common secret types

This location is appropriate because:
- The orchestrator package handles agent execution and tool hooks
- It follows the same pattern as `DangerousOperationDetector` in the same package
- Scanner will integrate with hooks and context management

### 2. Core Types Design

```typescript
/**
 * Severity level for secret findings
 */
export type SecretSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * A pattern for detecting secrets
 */
export interface SecretPattern {
  /** Unique identifier for this pattern */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description of what this pattern detects */
  description: string;
  /** Regex pattern for detection */
  pattern: RegExp;
  /** Severity if pattern matches */
  severity: SecretSeverity;
  /** Optional validator function for reducing false positives */
  validator?: (match: string, context: string) => boolean;
}

/**
 * Location of a finding in content
 */
export interface SecretLocation {
  /** Line number (1-indexed) */
  line: number;
  /** Column number (1-indexed) */
  column: number;
  /** Start offset in content */
  startOffset: number;
  /** End offset in content */
  endOffset: number;
}

/**
 * A detected secret finding
 */
export interface SecretFinding {
  /** Pattern ID that matched */
  patternId: string;
  /** Pattern name for display */
  patternName: string;
  /** Severity of this finding */
  severity: SecretSeverity;
  /** Location in content */
  location: SecretLocation;
  /** The matched string (first 20 chars + redacted) */
  match: string;
  /** Surrounding context (redacted) */
  context: string;
  /** Description of what was found */
  description: string;
}

/**
 * Scanner configuration
 */
export interface ScannerConfig {
  /** Custom patterns to add */
  customPatterns?: SecretPattern[];
  /** Built-in pattern IDs to disable */
  disabledPatterns?: string[];
  /** Minimum severity to report (default: 'low') */
  minSeverity?: SecretSeverity;
  /** Maximum findings to return (default: 100) */
  maxFindings?: number;
  /** Whether to redact matched values (default: true) */
  redactValues?: boolean;
}
```

### 3. Built-in Patterns

The scanner will include built-in patterns for common secret types:

| ID | Name | Severity | Pattern Description |
|---|------|----------|---------------------|
| `api-key-generic` | Generic API Key | high | `['"]\w*api[_-]?key['"]\s*[:=]\s*['"][^'"]{10,}['"]` |
| `aws-access-key` | AWS Access Key ID | critical | `AKIA[0-9A-Z]{16}` |
| `aws-secret-key` | AWS Secret Key | critical | `['"]\w*aws[_-]?secret\w*['"]\s*[:=]\s*['"][A-Za-z0-9/+=]{40}['"]` |
| `github-token` | GitHub Token | critical | `ghp_[a-zA-Z0-9]{36}` |
| `github-oauth` | GitHub OAuth | critical | `gho_[a-zA-Z0-9]{36}` |
| `openai-key` | OpenAI API Key | critical | `sk-[a-zA-Z0-9]{20,}` |
| `anthropic-key` | Anthropic API Key | critical | `sk-ant-[a-zA-Z0-9-]{20,}` |
| `private-key` | Private Key | critical | `-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----` |
| `password-assign` | Password Assignment | high | `(?:password\|pwd\|pass)\s*[=:]\s*['"][^'"]{3,}['"]` |
| `jwt-token` | JWT Token | high | `eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+` |
| `slack-token` | Slack Token | high | `xox[baprs]-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24}` |
| `stripe-key` | Stripe API Key | critical | `sk_live_[a-zA-Z0-9]{24,}` |
| `npm-token` | NPM Token | high | `npm_[a-zA-Z0-9]{36}` |
| `database-url` | Database Connection | high | `(?:postgres\|mysql\|mongodb):\/\/[^:]+:[^@]+@` |
| `bearer-token` | Bearer Token | medium | `Bearer\s+[a-zA-Z0-9._-]{20,}` |

### 4. Class API Design

```typescript
export class SecretScanner {
  /**
   * Create a scanner with optional configuration
   */
  constructor(config?: ScannerConfig);

  /**
   * Scan content for secrets
   * @param content - The content to scan
   * @returns Array of findings, sorted by severity (critical first)
   */
  scan(content: string): SecretFinding[];

  /**
   * Add a custom pattern
   */
  addPattern(pattern: SecretPattern): void;

  /**
   * Remove a pattern by ID
   */
  removePattern(patternId: string): void;

  /**
   * Get all active patterns
   */
  getPatterns(): SecretPattern[];

  /**
   * Check if content contains any secrets (fast check)
   */
  hasSecrets(content: string): boolean;
}
```

### 5. Performance Considerations

1. **Pattern Compilation**: All patterns compiled once in constructor
2. **Early Exit**: `hasSecrets()` method for quick boolean checks
3. **Line Caching**: Build line offset map once per scan
4. **Lazy Context**: Only extract context for actual findings
5. **Configurable Limits**: `maxFindings` prevents runaway scans on large content

### 6. Integration Points

The SecretScanner will integrate with:

1. **Hooks System**: Hook into tool execution to scan file writes and outputs
2. **DangerousOperationDetector**: Can use scanner for content analysis (already has basic patterns)
3. **Context**: Store scan results in context for reporting
4. **Events**: Emit events when secrets are found for monitoring

### 7. Security Considerations

1. **Redaction**: Matched secrets are redacted in findings by default
2. **No Logging**: Matched content never logged in full
3. **Memory Safety**: Large content handled with streaming approach
4. **Pattern Safety**: Custom patterns validated before use

## Alternatives Considered

### Alternative 1: Extend DangerousOperationDetector
- **Pros**: Reuses existing code
- **Cons**: Different purpose, would bloat the class, harder to test independently

### Alternative 2: Use external library (detect-secrets, gitleaks)
- **Pros**: Battle-tested, comprehensive patterns
- **Cons**: External dependency, slower, harder to customize, adds complexity

### Alternative 3: Put in @apex/core package
- **Pros**: Available to all packages
- **Cons**: Core should stay minimal, scanner is orchestration-specific

## Consequences

### Positive
- Clean, focused API for secret detection
- Follows existing codebase patterns
- Easy to extend with custom patterns
- Precise location tracking for findings
- Performance optimized for frequent scanning

### Negative
- Another file in orchestrator package (acceptable given clear purpose)
- Need to maintain pattern database (mitigated by extensibility)

## Implementation Notes

1. Use Zod schemas for configuration validation (consistent with codebase)
2. Export types from orchestrator package's index.ts
3. Include comprehensive test suite with real-world secret samples
4. Consider future streaming API for large files

## File Structure

```
packages/orchestrator/src/
├── scanner.ts           # SecretScanner class and types
├── scanner.test.ts      # Unit tests
└── index.ts             # Export SecretScanner (add to existing exports)
```
