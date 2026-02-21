# ADR-0001: SecretScanner Architecture

## Status
Proposed

## Context

APEX needs a SecretScanner utility in `@apex/core` to detect sensitive information (API keys, tokens, passwords, private keys) in content. This capability is part of the guardrails system designed to prevent accidental exposure of secrets.

### Existing Infrastructure

The codebase already has:
1. **Type definitions** in `packages/core/src/types.ts`:
   - `SecretPatternSchema` / `SecretPattern` - Pattern definition with name, regex, severity, description
   - `SecretScannerConfigSchema` / `SecretScannerConfig` - Configuration for the scanner
   - `SecretDetectionSchema` / `SecretDetection` - Individual detection result
   - `SecretScanResultSchema` / `SecretScanResult` - Aggregated scan results
   - `SecretDetectionBehaviorSchema` - Behavior options (log, warn, mask, block)

2. **Established patterns** from similar utilities:
   - `DangerousOperationDetector` - Pattern-based detection with configurable rules
   - `DirectoryAccessValidator` - Configurable validation with allowlist/blocklist
   - `DependencyDetector` - Class with detection caching

3. **Configuration tests** in `config-secret-scanner.test.ts` and `config-secret-scanner-coverage.test.ts`

## Decision

### Architecture Overview

The SecretScanner will be a class-based utility following the established patterns in the codebase (similar to DangerousOperationDetector and DirectoryAccessValidator).

```
SecretScanner Class
├── Configuration (SecretScannerConfig)
├── Built-in Patterns (pre-defined regex patterns)
├── Pattern Matcher (compiled regex engine)
└── Public API
    ├── scan(content) -> SecretDetection[]
    ├── scanWithResult(content) -> SecretScanResult
    ├── Pattern management methods
    └── Utility methods (masking)
```

### Class Design

```typescript
// packages/core/src/secret-scanner.ts

export class SecretScanner {
  private readonly config: SecretScannerConfig;
  private readonly patterns: CompiledPattern[];

  constructor(config?: Partial<SecretScannerConfig>);

  // Primary API - meets acceptance criteria
  scan(content: string, options?: ScanOptions): SecretDetection[];

  // Extended API for common use cases
  scanWithResult(content: string, options?: ScanOptions): SecretScanResult;

  // Configuration management
  getPatterns(): SecretPattern[];
  addPattern(pattern: SecretPattern): void;
  removePattern(patternName: string): boolean;

  // Utility methods
  maskSecret(content: string, detection: SecretDetection): string;
  static maskValue(value: string, visibleChars?: number): string;
}
```

### Built-in Secret Patterns

The scanner will include built-in patterns for common secrets, organized by category:

#### Categories and Severities
| Category | Severity | Examples |
|----------|----------|----------|
| API Keys | high | AWS Access Keys, GitHub Tokens, Google API Keys, Slack Tokens |
| Tokens | high | Bearer Tokens, JWT, OAuth Tokens |
| Passwords | critical | Password assignments, Connection strings with credentials |
| Private Keys | critical | RSA, EC, OpenSSH, PEM private keys |
| Cloud Secrets | high | Azure Client Secrets, GCP Service Account Keys |

Pattern regex definitions will be stored in a separate `patterns.ts` file to maintain clean separation.

### Configuration Options

Uses existing `SecretScannerConfig` from types.ts:
- `customPatterns`: User-defined patterns (default: [])
- `includeBuiltInPatterns`: Include default patterns (default: true)
- `maxLineLength`: Truncate long lines for performance (default: 10000)
- `contextLength`: Characters before/after match (default: 20)
- `maskSecrets`: Mask detected values in output (default: true)
- `onSecretDetected`: Behavior on detection (default: 'warn')

### Scan Options

```typescript
interface ScanOptions {
  filePath?: string;              // Associate detections with file
  excludePatterns?: string[];     // Pattern names to skip
  includeSeverities?: Severity[]; // Only report certain severities
  maxDetections?: number;         // Stop after N detections
}
```

### Detection Result Structure

Uses existing `SecretDetection` schema from types.ts:
- `id`: Unique detection ID (generated)
- `patternName`: Name of matched pattern
- `secretType`: Category (api_key, token, password, private_key)
- `severity`: critical | high | medium | low
- `filePath`: Optional file path
- `lineNumber`: 1-based line number
- `columnNumber`: 1-based column
- `maskedMatch`: Secret with middle portion masked
- `context`: Surrounding text (masked)
- `detectedAt`: Detection timestamp
- `acknowledged`: For tracking false positives

### Internal Design

1. **Pattern Compilation**: Patterns are pre-compiled to RegExp on construction for performance
2. **Line-by-Line Scanning**: Content is split into lines for accurate line/column reporting
3. **Efficient Matching**: Use RegExp.exec() in a loop to find all matches
4. **Context Extraction**: Extract surrounding characters with masking
5. **ID Generation**: Deterministic IDs based on content hash + position for deduplication

### File Structure

```
packages/core/src/
├── secret-scanner.ts           # Main class implementation
├── secret-scanner/
│   ├── index.ts               # Re-exports
│   ├── patterns.ts            # Built-in patterns
│   └── types.ts               # Internal types (CompiledPattern, etc.)
└── __tests__/
    ├── secret-scanner.test.ts                    # Unit tests
    ├── secret-scanner.integration.test.ts        # Integration tests
    ├── secret-scanner.patterns.test.ts           # Pattern-specific tests
    └── secret-scanner.performance.test.ts        # Performance tests
```

## Consequences

### Positive
- Consistent with existing codebase patterns (similar to DangerousOperationDetector)
- Uses already-defined Zod schemas for type safety
- Configurable and extensible pattern system
- Clear separation between built-in and custom patterns
- Supports multiple output formats (detections array, full result object)

### Negative
- Regex-based detection may have false positives
- Performance impact on large content (mitigated by maxLineLength)
- Built-in patterns may not cover all secret formats

### Risks and Mitigations
| Risk | Mitigation |
|------|------------|
| False positives | Configurable patterns, acknowledgment support |
| Performance issues | Line length limits, optional pattern filtering |
| Pattern maintenance | Community-driven pattern updates, custom patterns |

## Implementation Plan

### Stage 1: Core Implementation
1. Create `secret-scanner.ts` with SecretScanner class
2. Implement `scan()` method returning `SecretDetection[]`
3. Add built-in patterns in `secret-scanner/patterns.ts`

### Stage 2: Extended Features
1. Add `scanWithResult()` for full `SecretScanResult`
2. Implement pattern management methods
3. Add masking utilities

### Stage 3: Testing
1. Unit tests for all public methods
2. Pattern-specific tests for each built-in pattern
3. Integration tests with config system
4. Performance tests for large content

### Stage 4: Integration
1. Export from `@apex/core` index
2. Update config loading to use SecretScanner
3. Integration with guardrails system

## Related Documents
- Types: `packages/core/src/types.ts` (lines 1383-1482, 5011-5057)
- Config Tests: `packages/core/src/__tests__/config-secret-scanner.test.ts`
- Similar Utility: `packages/core/src/dangerous-operation-detector.ts`
