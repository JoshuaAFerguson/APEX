# ADR-008: Toolchain Detection Utilities for APEX Doctor

## Status
Proposed

## Context

The `apex doctor` command needs comprehensive toolchain detection utilities to verify the development environment is properly configured for APEX operations. The acceptance criteria require:

1. Functions to detect Node.js version, npm/yarn/pnpm version, TypeScript version, Git availability, and Claude API key presence
2. Each check returns structured result with status (pass/warn/fail), message, and suggestions
3. Integration tests verify detection accuracy

### Current Implementation Analysis

After analyzing the existing codebase, the following infrastructure already exists:

**In `@apexcli/core` (`packages/core/src/doctor-utils.ts`):**
- `satisfiesVersion(current, required)` - Version comparison utility
- `parseVersionOutput(output)` - Parse version from command output
- `compareVersionStrings(a, b)` - Compare two version strings
- `createDoctorCheckResult(partial)` - Factory for DoctorCheckResult
- `createHealthReport(checks, options)` - Factory for HealthReport
- `queryNpmRegistry(packageName, options)` - Query npm for package info
- `getLatestPackageVersion(packageName, options)` - Get latest version

**In `@apexcli/core` (`packages/core/src/types.ts`):**
- `DoctorCheckResult` - Structured check result type
- `HealthReport` - Aggregated health report type
- `CheckStatus` - Status enum: 'pass' | 'fail' | 'skip' | 'unknown'
- `CheckSeverity` - Severity enum: 'error' | 'warning' | 'info'
- `ToolchainCheck` - Toolchain information type

**In `@apexcli/cli` (`packages/cli/src/handlers/doctor-handlers.ts`):**
- `checkNodeVersion()` - Already implemented
- `checkNpmVersion()` - Already implemented
- `checkGitVersion()` - Already implemented
- `checkApexConfig(ctx)` - Already implemented
- `checkApexDependencies(ctx)` - Already implemented
- `checkApexPermissions(ctx)` - Already implemented

### Missing Components

The following need to be implemented:

1. **yarn version detection** - Not implemented
2. **pnpm version detection** - Not implemented
3. **TypeScript version detection** - Not implemented
4. **Claude API key presence check** - Not implemented
5. **Integration tests for all detectors** - Partial coverage

## Decision

### Architecture Overview

We will implement toolchain detection as a **modular utility system** in the core package with CLI handlers in the cli package. This follows the existing separation of concerns pattern.

```
packages/
├── core/src/
│   └── toolchain/                    # NEW: Toolchain detection module
│       ├── index.ts                  # Module exports
│       ├── types.ts                  # Toolchain-specific types
│       ├── node-detector.ts          # Node.js version detection
│       ├── npm-detector.ts           # npm version detection
│       ├── yarn-detector.ts          # yarn version detection
│       ├── pnpm-detector.ts          # pnpm version detection
│       ├── typescript-detector.ts    # TypeScript version detection
│       ├── git-detector.ts           # Git availability detection
│       ├── api-key-detector.ts       # Claude API key detection
│       └── __tests__/                # Integration tests
│
└── cli/src/handlers/
    └── doctor-handlers.ts            # MODIFY: Use new toolchain module
```

### Interface Design

Each detector follows a consistent interface pattern:

```typescript
interface ToolchainDetectorOptions {
  cwd?: string;
  timeout?: number;
  preferLocal?: boolean;
}

interface ToolchainDetector {
  readonly id: string;
  readonly name: string;
  readonly required: boolean;
  readonly minVersion?: string;
  detect(options?: ToolchainDetectorOptions): Promise<DoctorCheckResult>;
  isAvailable(options?: ToolchainDetectorOptions): Promise<boolean>;
}
```

### Detailed Component Design

#### 1. Node.js Detector
**Already implemented** - Refactor to match new interface. Uses `process.version`.

#### 2. npm Detector
**Already implemented** - Refactor to match new interface. Runs `npm --version`.

#### 3. Yarn Detector (NEW)
- Runs `yarn --version`
- Detects Yarn Classic (1.x) vs Yarn Berry (2+/3+/4+)
- Returns `skip` status if not installed (optional tool)
- Minimum version: 1.22.0

#### 4. pnpm Detector (NEW)
- Runs `pnpm --version`
- Returns `skip` status if not installed (optional tool)
- Minimum version: 7.0.0

#### 5. TypeScript Detector (NEW)
- Checks local `node_modules/.bin/tsc` first (project-specific)
- Falls back to global `tsc --version`
- Returns `skip` status if not installed (optional for non-TS projects)
- Minimum version: 4.7.0

#### 6. Git Detector
**Already implemented** - Refactor to match new interface.

#### 7. Claude API Key Detector (NEW)
- Checks environment variables: `ANTHROPIC_API_KEY`, `CLAUDE_API_KEY`
- Validates key format (starts with expected prefix, minimum length)
- Masks key in output for security (shows first 7 and last 4 chars)
- Returns `fail` status if not found (required for APEX)

### Aggregate Detection Function

```typescript
export async function detectToolchain(options?: ToolchainDetectorOptions): Promise<{
  results: DoctorCheckResult[];
  summary: { total: number; passed: number; failed: number; skipped: number; warnings: number };
  packageManager: 'npm' | 'yarn' | 'pnpm' | null;
}>;
```

### Integration Test Strategy

Tests should verify:
1. **Detection accuracy** - Each detector correctly identifies installed tools
2. **Version parsing** - Various version output formats are handled
3. **Error handling** - Missing tools return appropriate skip/fail status
4. **Timeout handling** - Long-running commands timeout gracefully
5. **Cross-platform** - Works on Windows, macOS, Linux

## Consequences

### Positive
1. **Modular design** - Each detector is independently testable
2. **Consistent interface** - All detectors follow the same pattern
3. **Reusable** - Detectors can be used outside of `apex doctor`
4. **Parallel execution** - All detectors run concurrently
5. **Type-safe** - Full TypeScript support with Zod validation

### Negative
1. **Additional module** - Creates new directory structure
2. **Refactoring** - Existing handlers need updates

## Implementation Notes

### Minimum Version Requirements

| Tool | Min Version | Required | Notes |
|------|-------------|----------|-------|
| Node.js | 18.0.0 | Yes | LTS support, native fetch |
| npm | 8.0.0 | Yes | Workspaces support |
| Yarn | 1.22.0 | No | Modern features |
| pnpm | 7.0.0 | No | Modern features |
| TypeScript | 4.7.0 | No | NodeNext module support |
| Git | 2.0.0 | No | Basic compatibility |

### Cross-Platform Considerations
1. Use `child_process.exec` with proper shell quoting
2. Use `path.join()` for local tool paths
3. Handle `.cmd`/`.ps1` extensions on Windows
4. Provide generous timeouts for slow systems

## References
- Existing doctor utilities: `packages/core/src/doctor-utils.ts`
- Doctor handlers: `packages/cli/src/handlers/doctor-handlers.ts`
- Type definitions: `packages/core/src/types.ts` (lines 2983-3139)
- Semver utilities: `packages/core/src/utils.ts`
