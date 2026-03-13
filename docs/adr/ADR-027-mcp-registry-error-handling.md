# ADR-027: MCP Registry Robust Error Handling and Fallback Mechanisms

## Status

**Proposed** - Architecture Design Stage

## Context

The `MCPRegistry` class in `packages/core/src/mcp/mcp-registry.ts` is responsible for loading and managing the MCP (Model Context Protocol) server catalog. The current implementation has several areas that need improvement:

### Current State

1. **Basic error handling exists** - `MCPCatalogLoadError` and `MCPCatalogValidationError` are implemented
2. **Synchronous loading only** - Uses `readFileSync` without fallbacks
3. **Limited validation** - Validates version, servers array, categories, and basic server fields
4. **No recovery mechanisms** - When catalog loading fails, the system cannot proceed
5. **Generic error messages** - Error messages could be more actionable

### Problems to Address

1. **Missing catalog.json** - No fallback when bundled catalog is missing
2. **Corrupted catalog data** - No partial recovery or safe defaults
3. **Validation errors lack actionability** - Users can't easily identify how to fix issues
4. **No graceful degradation** - All-or-nothing catalog loading
5. **Limited error context** - Errors don't provide enough debugging information

## Decision

Implement a robust error handling system with the following components:

### 1. Enhanced Error Classes

```typescript
/**
 * Error codes for MCP catalog operations
 */
export const MCPCatalogErrorCode = {
  FILE_NOT_FOUND: 'MCP_CATALOG_FILE_NOT_FOUND',
  PERMISSION_DENIED: 'MCP_CATALOG_PERMISSION_DENIED',
  PARSE_ERROR: 'MCP_CATALOG_PARSE_ERROR',
  SCHEMA_INVALID: 'MCP_CATALOG_SCHEMA_INVALID',
  SERVER_INVALID: 'MCP_CATALOG_SERVER_INVALID',
  EMPTY_CATALOG: 'MCP_CATALOG_EMPTY',
} as const;

/**
 * Error thrown when MCP catalog loading fails
 */
export class MCPCatalogLoadError extends Error {
  readonly catalogPath: string;
  readonly errorCode: keyof typeof MCPCatalogErrorCode;
  readonly cause?: Error;
  readonly suggestion?: string;
  readonly recoveryAction?: 'use-fallback' | 'retry' | 'manual-fix';
}

/**
 * Error thrown when MCP catalog validation fails
 */
export class MCPCatalogValidationError extends Error {
  readonly details: MCPValidationDetail[];
  readonly invalidServerIndices: number[];
  readonly recoverable: boolean;
}

/**
 * Detailed validation issue
 */
export interface MCPValidationDetail {
  field: string;
  path: string;
  message: string;
  actualValue?: unknown;
  expectedType?: string;
  severity: 'error' | 'warning';
}
```

### 2. Fallback Catalog Mechanism

```typescript
/**
 * Minimal fallback catalog when primary catalog is unavailable
 */
const FALLBACK_CATALOG: MCPCatalog = {
  version: '0.0.0-fallback',
  updated: new Date().toISOString(),
  description: 'Fallback MCP catalog - primary catalog unavailable',
  categories: {},
  servers: [],
};

/**
 * Options for MCPRegistry with fallback configuration
 */
export interface MCPRegistryOptions {
  catalogPath?: string;
  validateOnLoad?: boolean;
  fallbackBehavior?: 'error' | 'empty' | 'minimal';
  strictValidation?: boolean;
  onWarning?: (warning: MCPValidationDetail) => void;
}
```

### 3. Enhanced Validation with Warnings vs Errors

```typescript
interface ValidationResult {
  isValid: boolean;
  errors: MCPValidationDetail[];
  warnings: MCPValidationDetail[];
  validServers: MCPMarketplaceEntry[];
  invalidServerIndices: number[];
}

/**
 * Validates catalog with configurable strictness
 */
private validateCatalog(options: { strict: boolean }): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    validServers: [],
    invalidServerIndices: [],
  };

  // Core validation (always errors)
  // - version field required
  // - servers must be array
  // - categories must be object

  // Server validation (errors in strict mode, warnings otherwise)
  // - name required
  // - description required
  // - serverConfig required
  // - serverConfig.command required

  // Extended validation (always warnings)
  // - version format validation
  // - category references valid
  // - capability format validation

  return result;
}
```

### 4. Safe Loading with Partial Recovery

```typescript
/**
 * Load catalog with fallback support
 */
private loadCatalogSafe(): LoadResult {
  try {
    return this.loadCatalog();
  } catch (error) {
    if (this.options.fallbackBehavior === 'error') {
      throw error;
    }

    this.emitWarning({
      field: 'catalog',
      path: this.options.catalogPath,
      message: `Failed to load catalog: ${error.message}. Using fallback.`,
      severity: 'warning',
    });

    return {
      catalog: this.options.fallbackBehavior === 'minimal'
        ? MINIMAL_FALLBACK_CATALOG
        : EMPTY_FALLBACK_CATALOG,
      usedFallback: true,
      loadError: error,
    };
  }
}
```

### 5. Error Message Enhancement

```typescript
/**
 * Generate actionable error message based on error type
 */
function createActionableErrorMessage(
  errorCode: MCPCatalogErrorCode,
  catalogPath: string,
  cause?: Error
): { message: string; suggestion: string } {
  switch (errorCode) {
    case 'FILE_NOT_FOUND':
      return {
        message: `MCP catalog not found at '${catalogPath}'`,
        suggestion: 'Ensure the catalog.json file exists in the expected location. If using a custom path, verify the path is correct.',
      };
    case 'PERMISSION_DENIED':
      return {
        message: `Permission denied reading catalog at '${catalogPath}'`,
        suggestion: 'Check file permissions. The process needs read access to the catalog file.',
      };
    case 'PARSE_ERROR':
      const parseError = extractJsonParseError(cause);
      return {
        message: `Invalid JSON in catalog at '${catalogPath}': ${parseError.message}`,
        suggestion: `Check JSON syntax at line ${parseError.line}, position ${parseError.position}. Common issues: missing commas, unclosed brackets, trailing commas.`,
      };
    // ... more cases
  }
}
```

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        MCPRegistry                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌───────────────┐    ┌──────────────────┐ │
│  │   Loading    │───▶│  Validation   │───▶│   Registration   │ │
│  │   Layer      │    │   Layer       │    │   Layer          │ │
│  └──────┬───────┘    └───────┬───────┘    └──────────────────┘ │
│         │                    │                                   │
│         ▼                    ▼                                   │
│  ┌──────────────┐    ┌───────────────┐                          │
│  │   Fallback   │    │   Error       │                          │
│  │   Handler    │    │   Collector   │                          │
│  └──────────────┘    └───────────────┘                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

Error Flow:
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ Load Error  │───▶│ Categorize  │───▶│ Enrich with │───▶ User-facing
│             │    │ Error       │    │ Suggestions │    Error
└─────────────┘    └─────────────┘    └─────────────┘

Fallback Flow:
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ Load Fails  │───▶│ Check       │───▶│ Use         │───▶ Continue
│             │    │ Options     │    │ Fallback    │    with warning
└─────────────┘    └─────────────┘    └─────────────┘
```

## File Changes Required

### 1. `packages/core/src/mcp/mcp-registry.ts`

- Add `MCPCatalogErrorCode` enum
- Enhance `MCPCatalogLoadError` with error codes, suggestions, recovery actions
- Enhance `MCPCatalogValidationError` with structured validation details
- Add `MCPValidationDetail` interface
- Update `MCPRegistryOptions` with fallback configuration
- Add `FALLBACK_CATALOG` constant
- Implement `validateCatalog` returning `ValidationResult`
- Implement `loadCatalogSafe` with fallback handling
- Add `getCatalogLoadStatus` method for debugging
- Add `isUsingFallback` getter

### 2. `packages/core/src/mcp/index.ts`

- Export new types: `MCPCatalogErrorCode`, `MCPValidationDetail`

### 3. Test Files to Update/Create

- `packages/core/src/__tests__/mcp-registry.error-handling.test.ts` (new)
- Update existing test files for new error shapes

## Implementation Phases

### Phase 1: Error Class Enhancement
- Add error codes enum
- Enhance MCPCatalogLoadError with suggestions
- Enhance MCPCatalogValidationError with structured details
- Backward compatible - existing tests should pass

### Phase 2: Validation Improvements
- Implement ValidationResult structure
- Add severity levels (error vs warning)
- Implement partial recovery for non-critical validation failures
- Add strict validation mode option

### Phase 3: Fallback Mechanism
- Implement FALLBACK_CATALOG
- Add fallbackBehavior option
- Implement loadCatalogSafe
- Add isUsingFallback getter and getCatalogLoadStatus method

### Phase 4: Documentation and Tests
- Update JSDoc documentation
- Add comprehensive error scenario tests
- Add integration tests for fallback behavior

## Consequences

### Positive

1. **Better User Experience** - Clear, actionable error messages help users resolve issues
2. **Graceful Degradation** - System can continue with limited functionality when catalog unavailable
3. **Debugging Support** - Structured error details make troubleshooting easier
4. **Backward Compatible** - Existing code continues to work with default options
5. **Extensible** - New error codes and validation rules can be added easily

### Negative

1. **Increased Complexity** - More code to maintain
2. **Performance Overhead** - Additional validation processing (negligible)
3. **Migration Effort** - Tests need updating to handle new error shapes

### Neutral

1. **API Surface** - Error classes gain new properties, existing ones remain
2. **Dependencies** - No new dependencies required

## Test Strategy

### Unit Tests

1. **Error Class Tests**
   - Error message formatting
   - Error code assignment
   - Suggestion generation
   - Cause chain preservation

2. **Validation Tests**
   - All validation rules (error vs warning)
   - Partial recovery scenarios
   - Strict vs lenient mode

3. **Fallback Tests**
   - File not found → fallback
   - Permission denied → fallback
   - Parse error → fallback
   - Empty catalog handling

### Integration Tests

1. **End-to-end loading scenarios**
2. **Registry operation with fallback catalog**
3. **Warning callback invocation**

## Related ADRs

- **ADR-024**: MCPRegistry Architecture (original decision)
- **ADR-025**: MCP Protocol Message Types

## References

- [APEX Error Handling Patterns](../packages/core/src/apex-error.ts)
- [Tool Registry Error Handling](../packages/core/src/tools/tool-registry.ts)
- [Existing MCP Registry Tests](../packages/core/src/__tests__/mcp-registry.test.ts)
