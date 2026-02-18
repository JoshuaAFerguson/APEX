# APEX Timeout Configurations and Wait Strategies - Comprehensive Analysis

**Document Version**: 1.0.0
**Created**: 2026-02-13
**Author**: APEX Developer Agent

## Executive Summary

This document provides a complete analysis and documentation of all timeout configurations and wait strategies implemented in the APEX (Autonomous Product Engineering eXecutor) codebase. Through comprehensive exploration and testing, we have identified and documented 25+ distinct timeout configuration options spanning browser automation, tool execution, MCP connections, approval workflows, and dependency management.

## Table of Contents

1. [Overview](#overview)
2. [Timeout Configuration Types](#timeout-configuration-types)
3. [Wait Strategy Implementations](#wait-strategy-implementations)
4. [Implementation Patterns](#implementation-patterns)
5. [Environment-Specific Configurations](#environment-specific-configurations)
6. [Testing Strategy](#testing-strategy)
7. [Key Files and Locations](#key-files-and-locations)
8. [Recommendations](#recommendations)

## Overview

The APEX system implements a sophisticated timeout management system with:

- **6 distinct wait strategy types**: timeout, polling, event-based, race, exponential backoff, and linear backoff
- **4 common timeout implementation patterns**: Promise.race, setTimeout with cleanup, exponential backoff, and polling wait
- **Environment-aware configurations**: Production, development, and test environments with appropriately tuned timeout values
- **Comprehensive monitoring**: Debug utilities for tracking active timeouts and performance analysis
- **Extensive test coverage**: 20+ dedicated test files covering all timeout scenarios

## Timeout Configuration Types

### 1. Browser Automation Timeouts

| Configuration | Default Value | Purpose | Environment Override |
|---|---|---|---|
| `pageLoadTimeout` | 30,000ms | Maximum page load time | Prod: 45s, Dev: 15s, Test: 5s |
| `navigationTimeout` | 30,000ms | Page navigation timeout | Prod: 60s, Dev: 20s, Test: 5s |
| `defaultTimeout` | 30,000ms | General browser operations | Prod: 30s, Dev: 10s, Test: 3s |
| `selectorWaitTimeout` | 30,000ms | Element selection timeout | Prod: 30s, Dev: 10s, Test: 3s |
| `previewTimeout` | 5,000ms | UI preview generation | Prod: 10s, Dev: 3s, Test: 1s |
| `launchTimeout` | 0 (unlimited) | Browser launch timeout | All environments: unlimited |

**Implementation Location**: `packages/core/src/tools/browser/browser-tool.ts`

### 2. Tool Execution Timeouts

| Configuration | Default Value | Purpose | Special Cases |
|---|---|---|---|
| `executionTimeoutMs` | 60,000ms | Custom tool execution | BashTool: 120,000ms default |
| `invocationTimeoutMs` | 30,000ms | Tool invocation | WebSearch: 30,000ms |
| `hookTimeoutMs` | 30,000ms | Hook execution | Up to 600,000ms max |
| `linterTimeoutMs` | 30,000ms | Linter execution | Per-linter timeout |
| `globalLinterTimeoutMs` | 60,000ms | All linters globally | System-wide limit |
| `typeCheckTimeoutMs` | 60,000ms | TypeScript checking | Development builds |

**Special Tool Configurations**:
- **BashTool**: Default 120s, Max 600s (10 minutes), Min 1s
- **WebSearchTool**: Default 30s for web requests

### 3. MCP (Model Context Protocol) Timeouts

| Configuration | Default Value | Purpose | Notes |
|---|---|---|---|
| `connectionTimeoutMs` | 10,000ms | Connection establishment | Initial handshake |
| `requestTimeoutMs` | 30,000ms | Individual request response | Per-request timeout |
| `idleTimeoutMs` | 300,000ms | Connection idle timeout | 0 = no limit |
| `healthCheckTimeoutMs` | 5,000ms | Health check response | Keep-alive checks |

**Retry Strategy**: Exponential backoff with 3 max attempts, 1s base delay, 2x multiplier

### 4. Approval and Gate Timeouts

| Configuration | Urgency Level | Timeout (minutes) | Auto-Approve on Timeout |
|---|---|---|---|
| `APPROVAL_CRITICAL_URGENCY` | Critical | 5 | Environment-dependent |
| `APPROVAL_HIGH_URGENCY` | High | 15 | Environment-dependent |
| `APPROVAL_NORMAL_URGENCY` | Normal | 60 | Environment-dependent |
| `APPROVAL_LOW_URGENCY` | Low | 1440 (24 hours) | Environment-dependent |
| `globalApprovalTimeoutMinutes` | Default | 60 | Prod: 120, Dev: 30, Test: 1 |

**Behavior**:
- **Production**: Auto-reject on timeout (security-first)
- **Development**: Auto-approve on timeout (developer convenience)
- **Test**: Auto-approve on timeout (test automation)

### 5. Dependency Installation Timeouts

| Configuration | Default Value | Purpose |
|---|---|---|
| `installTimeoutMs` | 300,000ms (5 minutes) | Package installation |
| `defaultInstallTimeoutMs` | 300,000ms (5 minutes) | Default install timeout |

**Environment Overrides**:
- **Production**: 600,000ms (10 minutes) - Large dependencies
- **Development**: 180,000ms (3 minutes) - Faster iteration
- **Test**: 60,000ms (1 minute) - Quick test runs

### 6. Policy Evaluation Timeouts

| Configuration | Default Value | Purpose |
|---|---|---|
| `evaluationTimeoutMs` | 5,000ms | Policy evaluation |

**Environment Overrides**:
- **Production**: 10,000ms (10 seconds) - Thorough evaluation
- **Development**: 3,000ms (3 seconds) - Quick feedback
- **Test**: 1,000ms (1 second) - Fast test execution

## Wait Strategy Implementations

### 1. Browser Wait Strategies

```typescript
interface BrowserWaitStrategy {
  type: 'load' | 'domcontentloaded' | 'networkidle' | 'selector' | 'function';
  timeout?: number;
  visible?: boolean;
  evaluateFunction?: string;
}
```

**Available Operations**:
- `waitForSelector(selector, timeout?, visible?)`
- `waitForElement(selector, timeout?, state?)`
- `waitForFunction(fn, timeout?)`
- `waitForLoadState(state, timeout?)`
- `waitForRequest(urlPattern, timeout?)`
- `waitForResponse(urlPattern, timeout?)`
- `waitFor(milliseconds)` - Simple delay

### 2. Wait Strategy Types

| Strategy Type | Use Cases | Implementation |
|---|---|---|
| `TIMEOUT` | Fail after specified time | Promise.race pattern |
| `POLLING` | Repeatedly check condition | Interval-based checking |
| `EVENT_BASED` | Wait for specific events | EventEmitter patterns |
| `RACE` | First operation wins | Promise.race with multiple operations |
| `EXPONENTIAL_BACKOFF` | Increasing delays | Retry with exponential delays |
| `LINEAR_BACKOFF` | Fixed delays | Retry with fixed delays |

## Implementation Patterns

### 1. Promise.race() Pattern

**Usage**: MCP connections, approval gates, tool executions

```typescript
static async withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  errorMessage?: string
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(errorMessage || `Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });
  return Promise.race([operation, timeoutPromise]);
}
```

### 2. setTimeout with Cleanup Pattern

**Usage**: Approval gates, browser resource cleanup, long-running operations

```typescript
class SetTimeoutWithCleanupPattern {
  private timeoutHandle?: NodeJS.Timeout;

  setupTimeout(callback: () => void, timeoutMs: number): void {
    this.clearTimeout();
    this.timeoutHandle = setTimeout(callback, timeoutMs);
  }

  clearTimeout(): void {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = undefined;
    }
  }
}
```

### 3. Exponential Backoff Pattern

**Usage**: MCP connection retries, resource recovery, network operations

```typescript
static async withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxAttempts: number;
    baseDelayMs: number;
    backoffMultiplier: number;
    maxDelayMs?: number;
  }
): Promise<T>
```

**Calculation**: `delay = baseDelayMs × (backoffMultiplier ^ attempt)`

### 4. Polling Wait Pattern

**Usage**: Browser element state checking, async condition monitoring

```typescript
static async waitForCondition(
  condition: () => boolean | Promise<boolean>,
  options: {
    timeoutMs: number;
    intervalMs: number;
    timeoutError?: string;
  }
): Promise<void>
```

## Environment-Specific Configurations

### Production Configuration
- **Philosophy**: Conservative timeouts, security-first approach
- **Browser**: 45s page load, 60s navigation, 30s default operations
- **Tools**: 120s execution, 45s invocation, 60s hooks
- **MCP**: 15s connection, 60s request, 10 minute idle
- **Approval**: 2 hour global timeout, auto-reject on timeout
- **Dependencies**: 10 minute installation timeout

### Development Configuration
- **Philosophy**: Fast iteration, developer convenience
- **Browser**: 15s page load, 20s navigation, 10s default operations
- **Tools**: 30s execution, 15s invocation, 20s hooks
- **MCP**: 5s connection, 20s request, 2 minute idle
- **Approval**: 30 minute global timeout, auto-approve on timeout
- **Dependencies**: 3 minute installation timeout

### Test Configuration
- **Philosophy**: Rapid test execution, quick feedback
- **Browser**: 5s page load, 5s navigation, 3s default operations
- **Tools**: 10s execution, 5s invocation, 5s hooks
- **MCP**: 2s connection, 5s request, 30 second idle
- **Approval**: 1 minute global timeout, auto-approve on timeout
- **Dependencies**: 1 minute installation timeout

## Testing Strategy

### Test Coverage Analysis

The APEX codebase includes comprehensive timeout testing with 20+ dedicated test files:

#### Core Package Tests
- `timeout-configurations.test.ts` - Timeout config validation
- `timeout-configurations-comprehensive.test.ts` - Browser, tool, approval timeouts
- `bash-tool.timeout.test.ts` - BashTool timeout behavior (120s default)
- `bash-tool.timeout-integration.test.ts` - BashTool integration scenarios

#### Orchestrator Tests
- `wait-strategies.integration.test.ts` - Browser, MCP wait strategies
- `timeout-configurations.test.ts` - All timeout types and patterns
- `timeout-edge-cases-and-errors.test.ts` - Boundary conditions, edge cases
- `timeout-integration-comprehensive.test.ts` - Full integration scenarios
- `approval-timeout-basic.test.ts` - Approval gate timeouts
- `approval-timeout-error-scenarios.integration.test.ts` - Error handling

#### Browser Package Tests
- `timeout-configurations-integration.test.ts` - Browser operations with timeouts
- `timeout-edge-cases-comprehensive.test.ts` - Edge case handling
- `timeout-edge-cases-unit.test.ts` - Unit-level edge cases
- `timeout-stress-testing.test.ts` - Load and stress tests
- `timeout-error-messages-validation.test.ts` - Error message quality
- `timeout-performance-validation.test.ts` - Performance under timeout
- `element-visibility-waiting.test.ts` - Element state waiting

#### Test Categories Covered

1. **Configuration Validation** - Ensures timeout values are valid and within expected ranges
2. **Default Behavior** - Tests default timeout application across components
3. **Custom Overrides** - Tests operation-specific timeout customization
4. **Error Handling** - Tests timeout error messages and recovery mechanisms
5. **Edge Cases** - Zero, negative, and very large timeout values
6. **Concurrent Operations** - Multiple operations with different timeouts
7. **Timeout Accuracy** - Validates timeout fires within acceptable tolerance
8. **Resource Cleanup** - Ensures timeouts don't leak resources or handles
9. **Graceful Degradation** - Tests fallback behavior when timeouts occur
10. **Performance Impact** - Validates timeout overhead is minimal

### Implementation Test File

**Location**: `packages/orchestrator/src/__tests__/timeout-documentation-implementation.test.ts`

This comprehensive test file validates:
- All timeout constants and configurations are correct
- Environment-specific configurations have appropriate values
- All timeout implementation patterns work correctly
- Wait strategies function as documented
- Utility functions perform conversions and formatting correctly
- Debug utilities track timeouts accurately
- Integration scenarios handle concurrent timeouts properly

## Key Files and Locations

### Core Implementation Files

| Component | File Path | Purpose |
|---|---|---|
| **Timeout Documentation** | `packages/orchestrator/src/timeout-documentation.ts` | Comprehensive timeout reference |
| **Browser Tool** | `packages/core/src/tools/browser/browser-tool.ts` | Browser automation timeouts |
| **BashTool** | `packages/core/src/tools/shell/bash-tool.ts` | Shell command timeouts |
| **Types & Schemas** | `packages/core/src/types.ts` | Type definitions and validation |
| **Approval Gates** | `packages/orchestrator/src/approval-gate-controller.ts` | Approval workflow timeouts |
| **Hook Manager** | `packages/orchestrator/src/hook-manager.ts` | Hook execution timeouts |

### Documentation Files

| Document | Location | Content |
|---|---|---|
| **Timeout Configuration Guide** | `docs/timeout-configurations.md` | User-facing timeout guide |
| **Timeout Analysis** | `docs/timeout-configuration-analysis.md` | Detailed technical analysis |
| **Implementation Summary** | `docs/timeout-comprehensive-analysis.md` | This document |

### Architecture Decision Records

| ADR | Location | Topic |
|---|---|---|
| **ADR-0024** | `docs/adr/ADR-0024-timeout-integration-tests.md` | Timeout test architecture |
| **ADR-004** | `docs/adr/ADR-004-approval-timeout-edge-case-tests.md` | Approval timeout edge cases |
| **ADR-005** | `docs/adr/ADR-005-approval-timeout-error-integration-tests.md` | Approval error handling |

## Timeout Precedence Hierarchy

Timeouts are resolved in the following order (highest to lowest priority):

1. **Operation-specific timeout** (highest priority)
   - Example: `waitForSelector({ timeout: 5000 })`
   - Explicitly set for individual operations

2. **Component configuration timeout**
   - Example: `BrowserConfig.defaultTimeout`
   - Set at the component/tool level

3. **Global default timeout**
   - Example: `DEFAULT_TIMEOUTS.BROWSER_SELECTOR_WAIT`
   - System-wide defaults for operation types

4. **System fallback timeout** (lowest priority)
   - Example: `30000ms` hardcoded fallback
   - Last resort when no other timeout is specified

## Recommendations

### For Developers

1. **Use Environment-Appropriate Timeouts**: Always use the environment-specific configurations rather than hardcoded values
2. **Follow Timeout Patterns**: Use the established patterns (Promise.race, setTimeout with cleanup, etc.) for consistency
3. **Implement Proper Cleanup**: Always clean up timeouts and resources when operations complete early
4. **Add Timeout Monitoring**: Use `TimeoutDebugUtils` for debugging complex timeout scenarios
5. **Test Timeout Behavior**: Include timeout tests for any new components that use timeouts

### For Configuration

1. **Production**: Use conservative timeouts that account for network variability and system load
2. **Development**: Use faster timeouts for quick feedback, but enable auto-approval for convenience
3. **Testing**: Use minimal timeouts for fast test execution, but ensure they're realistic enough to catch timing issues

### For Monitoring

1. **Track Timeout Frequency**: Monitor how often timeouts occur in production
2. **Analyze Timeout Patterns**: Use `TimeoutDebugUtils` to identify frequently timing out operations
3. **Adjust Based on Metrics**: Tune timeout values based on actual performance data
4. **Alert on Timeout Spikes**: Set up monitoring alerts for unusual timeout patterns

## Conclusion

The APEX timeout system is comprehensive and well-designed, with:

- **Complete Coverage**: All major components have appropriate timeout configurations
- **Environment Awareness**: Different timeout values for different deployment environments
- **Consistent Patterns**: Standard implementation patterns used throughout the codebase
- **Extensive Testing**: Comprehensive test coverage ensuring reliability
- **Debug Support**: Monitoring and debugging utilities for troubleshooting
- **Clear Documentation**: Well-documented interfaces and usage patterns

This analysis provides a complete understanding of how timeouts are configured, applied, and managed across the APEX system, enabling developers to work effectively with timeout-related features and troubleshoot timeout-related issues.

---

**Next Steps**: This documentation should be reviewed by the team and incorporated into the official APEX documentation. Any timeout-related changes should update this analysis to maintain accuracy.