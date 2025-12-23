# ADR-061: CLI `--check-docs` Flag and Reporting Architecture

## Status
Proposed

## Context

The APEX platform has comprehensive documentation analysis capabilities implemented in the `IdleProcessor` class, including:
- Undocumented exports detection
- Outdated documentation detection (version mismatches, deprecated APIs, stale references)
- Missing README sections detection
- API completeness analysis
- Stale comments detection (TODO/FIXME/HACK)

However, these capabilities are only accessible through the idle processing pipeline or programmatically. Users need a direct CLI command to check documentation quality on demand.

### Task Requirements
1. Add `--check-docs` flag to `apex status` command
2. Display outdated documentation findings in CLI output with severity coloring
3. Update README/docs with configuration options
4. Add examples of each detection type in documentation
5. Verify output formatting in terminal

## Decision

### 1. CLI Flag Design

#### Flag Specification
```
/status [--check-docs] [task_id]
apex status [--check-docs] [task_id]
```

The `--check-docs` flag can be combined with or used independently of `task_id`:
- `/status --check-docs` - Run documentation check without task ID
- `/status abc123 --check-docs` - Show task status AND run documentation check
- `/status --check-docs` - Focus on documentation analysis only

#### Alias Support
- `--check-docs` (primary)
- `-d` (short form)

### 2. Implementation Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLI Layer                                       │
│  packages/cli/src/index.ts                                                   │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  status command handler                                                  ││
│  │  └── parseCheckDocsFlag(args)                                           ││
│  │      └── if flag present: callDocumentationAnalysis()                   ││
│  │          └── displayDocCheckResults(analysis)                           ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Orchestrator Layer                                   │
│  packages/orchestrator/src/index.ts                                          │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  ApexOrchestrator                                                        ││
│  │  └── checkDocumentation(): Promise<EnhancedDocumentationAnalysis>       ││
│  │      └── Uses IdleProcessor.analyzeDocumentation() internally           ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Core Types Layer                                      │
│  packages/core/src/types.ts                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  EnhancedDocumentationAnalysis (existing)                               ││
│  │  - coverage: number                                                      ││
│  │  - undocumentedExports: UndocumentedExport[]                            ││
│  │  - outdatedDocs: OutdatedDocumentation[]                                ││
│  │  - missingReadmeSections: MissingReadmeSection[]                        ││
│  │  - apiCompleteness: APICompleteness                                     ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3. Output Display Design

#### Severity Color Mapping

| Severity | Color | Chalk Function | Example Use |
|----------|-------|----------------|-------------|
| `high` | Red | `chalk.red()` | Critical version mismatches, broken API references |
| `medium` | Yellow | `chalk.yellow()` | Deprecated API docs, stale TODO comments |
| `low` | Gray | `chalk.gray()` | Minor style issues, optional sections |
| Success | Green | `chalk.green()` | Check passed, good coverage |
| Header | Cyan | `chalk.cyan()` | Section headers |
| Info | Blue | `chalk.blue()` | Metadata, counts |

#### CLI Output Format

```
Documentation Check Results
═══════════════════════════════════════════════════════════════════════════════

📊 Coverage: 68% (34/50 exports documented)

🔴 High Severity Issues (3)
────────────────────────────────────────────────────────────────────────────────
  • packages/core/src/types.ts:245
    Version mismatch: Found v1.0.0, expected v2.0.0
    Suggestion: Update version reference from v1.0.0 to v2.0.0

  • packages/orchestrator/src/index.ts:89
    Deprecated API: @deprecated tag missing migration path
    Suggestion: Add replacement API reference to @deprecated tag

  • README.md:45
    Broken link: Reference to `UserService.authenticate` not found in codebase
    Suggestion: Update reference or remove broken link

🟡 Medium Severity Issues (5)
────────────────────────────────────────────────────────────────────────────────
  • packages/cli/src/handlers/auth.ts:23
    Stale comment: TODO added 45 days ago - "implement password reset"
    Author: developer@example.com

  • docs/api.md:156
    Outdated example: Code example uses deprecated API method
    Suggestion: Update example to use new API

  [... truncated, showing first 5 of 5 ...]

⚪ Low Severity Issues (2)
────────────────────────────────────────────────────────────────────────────────
  • packages/api/src/routes.ts:12
    Undocumented export: function `validateRequest` missing JSDoc
    Type: function | Line: 12

📋 Missing README Sections
────────────────────────────────────────────────────────────────────────────────
  ⚠️  Required: installation - Installation and setup instructions
  ⚠️  Recommended: contributing - Contributing guidelines
  ℹ️  Optional: testing - Testing instructions and guidelines

📈 API Documentation Completeness: 72%
────────────────────────────────────────────────────────────────────────────────
  Documented: 36/50 endpoints
  Top undocumented:
    • UserController.createUser (class)
    • AuthService.validateToken (function)
    • PaymentProcessor.processRefund (function)

═══════════════════════════════════════════════════════════════════════════════
Summary: 3 high, 5 medium, 2 low severity issues found
```

### 4. Compact Mode Output

When in compact display mode (`/compact`), show condensed output:

```
📊 Docs: 68% coverage | 🔴 3 high | 🟡 5 medium | ⚪ 2 low | 📋 3 missing sections
```

### 5. Detection Type Examples for Documentation

Each detection type should be documented with examples:

#### Version Mismatch Detection
```yaml
# Configuration
documentation:
  outdatedDocs:
    versionCheckPatterns:
      - 'v\\d+\\.\\d+\\.\\d+'         # Matches v1.0.0
      - 'version\\s+\\d+\\.\\d+'       # Matches "version 1.0"
      - 'npm\\s+install.*@\\d+\\.\\d+' # Matches npm install pkg@1.0
```

**Example Finding:**
```
Location: docs/getting-started.md:45
Issue: Version mismatch - Found v1.2.0 but package.json shows v2.0.0
Severity: high
Suggestion: Update documentation to reference v2.0.0
```

#### Deprecated API Detection
```yaml
# Configuration
documentation:
  outdatedDocs:
    deprecationRequiresMigration: true  # Enforce migration path
```

**Example Finding:**
```
Location: packages/core/src/utils.ts:89
Issue: @deprecated tag without migration path
Severity: medium
Suggestion: Add @see or replacement reference to @deprecated JSDoc tag

// Bad:
/** @deprecated */
function oldMethod() {}

// Good:
/** @deprecated Use newMethod() instead. @see newMethod */
function oldMethod() {}
```

#### Stale Comment Detection
```yaml
# Configuration
documentation:
  outdatedDocs:
    todoAgeThresholdDays: 30  # Days before TODO is stale
```

**Example Finding:**
```
Location: packages/cli/src/handlers.ts:234
Issue: Stale TODO comment (45 days old)
Type: TODO
Text: "implement password validation"
Author: dev@example.com (from git blame)
Severity: medium
Suggestion: Complete, update, or remove stale TODO comment
```

#### Broken Link/Cross-Reference Detection
```yaml
# Configuration
documentation:
  outdatedDocs:
    crossReferenceEnabled: true  # Enable cross-ref validation
```

**Example Finding:**
```
Location: docs/api-reference.md:123
Issue: Broken link - @see UserService.authenticate not found in codebase
Severity: high
Suggestion: Symbol was renamed or removed. Update reference.
```

#### Undocumented Export Detection
```yaml
# Configuration
documentation:
  jsdocAnalysis:
    enabled: true
    requirePublicExports: true  # Require JSDoc for public exports
```

**Example Finding:**
```
Location: packages/api/src/controllers.ts:45
Issue: Undocumented export 'UserController'
Type: class
Public: true
Severity: low (or medium if critical API)
Suggestion: Add JSDoc documentation
```

#### Missing README Section Detection

**Example Finding:**
```
Location: README.md
Issue: Missing 'installation' section
Priority: required
Description: Installation and setup instructions
Suggestion: Add ## Installation section with setup steps
```

### 6. Configuration Schema Updates

Add documentation check configuration options to `ApexConfig`:

```typescript
// In packages/core/src/types.ts
export const DocumentationAnalysisConfigSchema = z.object({
  enabled: z.boolean().optional().default(true),
  outdatedDocs: z.object({
    todoAgeThresholdDays: z.number().min(1).optional().default(30),
    versionCheckPatterns: z.array(z.string()).optional(),
    deprecationRequiresMigration: z.boolean().optional().default(true),
    crossReferenceEnabled: z.boolean().optional().default(true),
  }).optional(),
  jsdocAnalysis: z.object({
    enabled: z.boolean().optional().default(true),
    requirePublicExports: z.boolean().optional().default(true),
    checkReturnTypes: z.boolean().optional().default(true),
    checkParameterTypes: z.boolean().optional().default(true),
  }).optional(),
});
```

### 7. Orchestrator API Extension

Add method to `ApexOrchestrator` for on-demand documentation checking:

```typescript
// In packages/orchestrator/src/index.ts
export class ApexOrchestrator {
  /**
   * Run documentation analysis on-demand
   * @returns Enhanced documentation analysis results
   */
  async checkDocumentation(): Promise<EnhancedDocumentationAnalysis> {
    // Use IdleProcessor's analyzeDocumentation method
    // This reuses existing detection logic
  }
}
```

## Files to Modify

| File | Changes |
|------|---------|
| `packages/cli/src/index.ts` | Add `--check-docs` flag parsing and handler |
| `packages/orchestrator/src/index.ts` | Add `checkDocumentation()` method |
| `docs/cli-guide.md` | Document `--check-docs` flag usage |
| `docs/configuration.md` | Document documentation analysis config options |
| `README.md` (project root) | Add quick reference for `--check-docs` |

## New Files to Create

| File | Purpose |
|------|---------|
| `packages/cli/src/formatters/doc-check-formatter.ts` | Format documentation check results for CLI output |

## Test Strategy

### Unit Tests
1. Flag parsing tests for `--check-docs` and `-d`
2. Output formatting tests for each severity level
3. Compact mode output tests

### Integration Tests
1. End-to-end `apex status --check-docs` execution
2. Combined `apex status <task_id> --check-docs` execution
3. Verify color output in TTY mode

## Consequences

### Positive
- Users can check documentation quality on-demand
- Consistent severity coloring improves issue visibility
- Configuration options provide customization
- Reuses existing detection infrastructure

### Negative
- Additional command flag complexity
- Documentation analysis may be slow on large codebases

### Mitigation
- Add `--quick` flag option for fast/shallow analysis in future
- Show progress indicator during analysis

## References

- Existing types: `packages/core/src/types.ts` lines 897-910
- IdleProcessor analysis: `packages/orchestrator/src/idle-processor.ts` lines 773-903
- CLI command patterns: `packages/cli/src/index.ts` lines 158-210
- Chalk color patterns: Used throughout CLI for status display
