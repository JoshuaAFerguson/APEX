# ADR 0007: File Content Scanning for Pre-Commit Checks

## Status

Proposed

## Context

The APEX orchestrator currently has a `SecretScanner` class that scans content for secrets (API keys, tokens, passwords, etc.). However, the current implementation only scans **tool outputs** - it does not scan file contents that are about to be committed or written.

### Current State

- `SecretScanner` class exists at `packages/orchestrator/src/scanner.ts`
- It has a `scan(content: string, filePath?: string): SecretFinding[]` method
- Currently integrated into orchestrator at tool output scanning (post-execution)
- Emits `secret:detected` events when secrets are found
- Configuration is optional via `config.scanner` in `ApexConfig`

### Requirements from Acceptance Criteria

1. `SecretScanner.scanFile(filePath: string)` - reads and scans a single file
2. `SecretScanner.scanFiles(filePaths: string[])` - batch scanning multiple files
3. Integration hook for pre-commit scanning exposed via orchestrator
4. Returns aggregated findings with file paths

## Decision

We will extend the `SecretScanner` class with file reading capabilities and expose a pre-commit scanning integration hook through the orchestrator.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                       ApexOrchestrator                          │
│                                                                 │
│  ┌─────────────────────┐    ┌─────────────────────────────────┐│
│  │    SecretScanner    │    │      Pre-Commit Hook API        ││
│  │                     │    │                                  ││
│  │ - scan()            │◄───┤ - scanStagedFiles()              ││
│  │ + scanFile()        │    │ - getSecretScanner()             ││
│  │ + scanFiles()       │    │                                  ││
│  └─────────────────────┘    └─────────────────────────────────┘│
│                                        ▲                        │
│                                        │                        │
│                              ┌─────────┴────────────┐           │
│                              │   Event Emission     │           │
│                              │ 'precommit:scanned'  │           │
│                              │ 'secret:detected'    │           │
│                              └──────────────────────┘           │
└─────────────────────────────────────────────────────────────────┘
                                        ▲
                                        │
┌───────────────────────────────────────┴─────────────────────────┐
│                       External Consumers                         │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │  CLI hooks   │  │  Git hooks   │  │   API/WebSocket        │ │
│  │  (pre-push)  │  │  (pre-commit)│  │   (real-time alerts)   │ │
│  └──────────────┘  └──────────────┘  └────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

### 1. SecretScanner Extensions

```typescript
// New methods in SecretScanner class

/**
 * Scan a single file for secrets
 * @param filePath - Absolute path to the file
 * @returns SecretFinding[] with file path populated
 */
public async scanFile(filePath: string): Promise<SecretFinding[]>;

/**
 * Scan multiple files for secrets (batch operation)
 * @param filePaths - Array of absolute file paths
 * @returns Aggregated SecretFinding[] from all files
 */
public async scanFiles(filePaths: string[]): Promise<SecretFinding[]>;
```

#### Design Decisions for File Scanning

1. **Async API**: File I/O operations are inherently async, so new methods are `async`
2. **Graceful error handling**: Files that don't exist or can't be read return empty findings with logging
3. **Preserve existing behavior**: `scan()` remains synchronous and unchanged
4. **Batch efficiency**: `scanFiles()` processes files in parallel with configurable concurrency
5. **Binary file detection**: Skip binary files to avoid false positives and performance issues

### 2. Pre-Commit Integration Hook

```typescript
// New interface for pre-commit scan results
export interface PreCommitScanResult {
  files: string[];              // Files that were scanned
  findings: SecretFinding[];    // Aggregated findings
  scannedAt: Date;             // Timestamp of scan
  duration: number;            // Scan duration in ms
  blockedFiles: string[];      // Files with blocking findings
  behavior: SecretDetectionBehavior; // Configured behavior
}

// New event type
export interface OrchestratorEvents {
  // ... existing events ...
  'precommit:scanned': (event: PreCommitScanEvent) => void;
}

// New orchestrator methods
public async scanStagedFiles(filePaths: string[]): Promise<PreCommitScanResult>;
public getSecretScanner(): SecretScanner | undefined;
```

### 3. Integration Points

#### 3.1 CLI Pre-Push Hook (packages/cli)

```typescript
// Example CLI integration
async function preCommitCheck(files: string[]): Promise<boolean> {
  const orchestrator = getOrchestrator();
  const result = await orchestrator.scanStagedFiles(files);

  if (result.blockedFiles.length > 0) {
    console.error('Secrets detected in staged files!');
    result.findings.forEach(f => {
      console.error(`  ${f.file}:${f.line} - ${f.secretType}`);
    });
    return false; // Block commit
  }
  return true; // Allow commit
}
```

#### 3.2 Git Hook Script (generated by APEX)

```bash
#!/bin/bash
# .git/hooks/pre-commit (generated by `apex init`)
staged_files=$(git diff --cached --name-only)
apex scan-secrets $staged_files
exit_code=$?
if [ $exit_code -ne 0 ]; then
  echo "Commit blocked: secrets detected"
  exit 1
fi
```

### 4. Configuration

Extend existing `SecretScannerConfig`:

```typescript
export interface SecretScannerConfig {
  // ... existing fields ...

  /** Maximum file size to scan in bytes (default: 1MB) */
  maxFileSizeBytes?: number;

  /** File patterns to exclude from scanning */
  excludePatterns?: string[];

  /** Maximum concurrent file reads for batch scanning */
  concurrency?: number;
}
```

### 5. Implementation Phases

#### Phase 1: Core Scanner Extensions
- Add `scanFile()` method to SecretScanner
- Add `scanFiles()` method with parallel execution
- Add binary file detection
- Add file size limits
- Add comprehensive unit tests

#### Phase 2: Orchestrator Integration
- Add `getSecretScanner()` public accessor
- Add `scanStagedFiles()` method
- Add `precommit:scanned` event
- Wire up behavior handling (log/warn/mask/block)

#### Phase 3: CLI Integration (Future)
- Add `apex scan-secrets` command
- Generate git hook scripts on `apex init`
- Add pre-push integration

## Consequences

### Positive

1. **Prevention over Detection**: Catches secrets before they enter version control
2. **Consistent API**: Follows established patterns (similar to getLinterService)
3. **Event-Driven**: Enables real-time monitoring and alerting
4. **Configurable**: Respects existing behavior configuration
5. **Extensible**: Easy to add more scanning integration points

### Negative

1. **I/O Overhead**: File reading adds latency to commit workflow
2. **False Positives**: May block legitimate commits with secret-like patterns
3. **Binary Files**: Need special handling to avoid scanning

### Mitigations

1. **Parallel Processing**: Use concurrent file reading for batch operations
2. **Confidence Thresholds**: Only block on high-confidence findings (configurable)
3. **Binary Detection**: Use file magic bytes or extension checking
4. **Caching**: Consider content hashing to avoid re-scanning unchanged files

## File Changes Required

| File | Change Type | Description |
|------|-------------|-------------|
| `packages/orchestrator/src/scanner.ts` | Modify | Add `scanFile()`, `scanFiles()` methods |
| `packages/orchestrator/src/index.ts` | Modify | Add `getSecretScanner()`, `scanStagedFiles()`, events |
| `packages/core/src/types.ts` | Modify | Add `PreCommitScanResult`, config extensions |
| `packages/orchestrator/src/__tests__/secret-scanner-file-scanning.test.ts` | New | Unit tests for file scanning |
| `packages/orchestrator/src/__tests__/precommit-integration.test.ts` | New | Integration tests |

## Alternatives Considered

### 1. Hook-Based Scanning (Via Existing Hook System)

**Rejected**: The hook system is designed for tool-use interception, not standalone file scanning. Pre-commit scanning needs to work independently of Claude Agent SDK execution.

### 2. Separate PreCommitScanner Class

**Rejected**: Would duplicate pattern matching logic. Better to extend SecretScanner with file I/O capabilities.

### 3. Shell Command Wrapper

**Rejected**: Less flexible, harder to integrate with event system, and adds process overhead.

## References

- Existing SecretScanner: `packages/orchestrator/src/scanner.ts`
- Orchestrator integration: `packages/orchestrator/src/index.ts` (lines 707-713, 2365-2423)
- Similar service pattern: `getLinterService()` in orchestrator
- Core types: `packages/core/src/types.ts` (SecretFinding, SecretScannerConfig)
