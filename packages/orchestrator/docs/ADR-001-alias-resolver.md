# ADR-001: AliasResolver Class Architecture

## Status
Proposed

## Context
APEX needs a way to expand tool aliases (shorthand tool invocations) into full tool invocations with resolved parameters. The system already has:

1. Type definitions in `@apexcli/core` for `ToolAlias`, `AliasParameter`, `ExpandedToolAlias`, and `AliasParameterValidationResult`
2. Configuration loading that merges aliases from `config.yaml` and `.apex/tools/` directory
3. Parameter template syntax using `{{param}}` placeholders

The missing piece is a class that takes alias definitions and resolves them at runtime when an alias is invoked with parameters.

## Decision

### Class Design: `AliasResolver`

**Location**: `packages/orchestrator/src/alias-resolver.ts`

```typescript
/**
 * AliasResolver - Resolves tool aliases to full tool invocations
 *
 * This class takes alias definitions from config and expands them
 * to full tool invocations with resolved parameters.
 */
export class AliasResolver {
  private aliases: Map<string, ToolAlias>;

  constructor(aliasDefinitions: ToolAlias[]);

  /**
   * Resolve an alias to a full tool invocation
   * @param aliasName - The name of the alias to resolve
   * @param params - Parameters to substitute into the alias templates
   * @returns The expanded tool alias with resolved parameters
   * @throws AliasNotFoundError if alias doesn't exist
   * @throws AliasParameterError if required params missing or validation fails
   */
  resolve(aliasName: string, params?: Record<string, unknown>): ExpandedToolAlias;

  /**
   * Check if an alias exists
   */
  hasAlias(aliasName: string): boolean;

  /**
   * Get all registered aliases
   */
  getAliases(): ToolAlias[];

  /**
   * Get a specific alias definition
   */
  getAlias(aliasName: string): ToolAlias | undefined;

  /**
   * Validate parameters against alias definition
   */
  validateParameters(
    aliasName: string,
    params: Record<string, unknown>
  ): AliasParameterValidationResult;
}
```

### Error Types

```typescript
export class AliasError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'AliasError';
  }
}

export class AliasNotFoundError extends AliasError {
  constructor(aliasName: string) {
    super(`Unknown alias: ${aliasName}`, 'ALIAS_NOT_FOUND');
    this.name = 'AliasNotFoundError';
  }
}

export class AliasParameterError extends AliasError {
  constructor(
    message: string,
    public readonly aliasName: string,
    public readonly parameterErrors: string[]
  ) {
    super(message, 'ALIAS_PARAMETER_ERROR');
    this.name = 'AliasParameterError';
  }
}

export class AliasDisabledError extends AliasError {
  constructor(aliasName: string) {
    super(`Alias is disabled: ${aliasName}`, 'ALIAS_DISABLED');
    this.name = 'AliasDisabledError';
  }
}
```

### Resolution Algorithm

1. **Lookup alias** by name from the aliases Map
2. **Check if enabled** - throw `AliasDisabledError` if disabled
3. **Validate parameters**:
   - Check all required parameters are provided
   - Validate parameter types match definitions
   - Validate enum values against allowed `values` array
   - Apply default values for optional parameters not provided
4. **Substitute templates**:
   - Start with `defaults` as base parameters
   - Process `parameterTemplates` - replace `{{paramName}}` with actual values
   - Merge substituted templates into parameters
5. **Return `ExpandedToolAlias`** with:
   - Original alias name
   - Target tool name
   - Resolved parameters
   - Reference to original alias definition

### Parameter Substitution Syntax

The `{{param}}` syntax supports:
- Simple substitution: `{{searchTerm}}` -> value of searchTerm
- Missing optional params with defaults: `{{format}}` -> default value
- Missing required params: throws `AliasParameterError`

### Integration Points

1. **Configuration**: Aliases come from `ApexConfig.aliases` (already loaded by core)
2. **Usage in Orchestrator**: The orchestrator can create an AliasResolver and use it when processing tool calls
3. **Events**: Could emit `alias:resolved` events for observability

## Consequences

### Positive
- Clean separation of concerns - alias resolution is isolated
- Type-safe with full TypeScript support
- Reusable across different parts of the system
- Descriptive error messages help debugging

### Negative
- Adds another class to maintain
- Slight overhead for alias lookups (mitigated by Map for O(1) lookup)

### Risks
- Template syntax collisions with actual parameter values containing `{{` (mitigated by only processing `parameterTemplates`, not `defaults`)

## Implementation Notes

1. File should be `packages/orchestrator/src/alias-resolver.ts`
2. Export from `packages/orchestrator/src/index.ts`
3. Use existing types from `@apexcli/core`
4. Follow project conventions (strict TypeScript, class-based)
5. Include comprehensive unit tests in `packages/orchestrator/src/alias-resolver.test.ts`

## Example Usage

```typescript
import { AliasResolver } from '@apexcli/orchestrator';
import { loadConfig } from '@apexcli/core';

// Load config with aliases
const config = await loadConfig(projectPath);

// Create resolver
const resolver = new AliasResolver(config.aliases);

// Resolve an alias
const expanded = resolver.resolve('search-tests', {
  searchTerm: 'describe',
  path: './src'
});

// Result:
// {
//   aliasName: 'search-tests',
//   tool: 'Grep',
//   parameters: {
//     pattern: 'describe',
//     path: './src',
//     output_mode: 'content',
//     glob: '*.test.ts'
//   },
//   alias: { ... original alias definition }
// }
```
