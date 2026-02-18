# ADR-007: JSDoc Documentation Standards for @apex/cli Package

## Status
Proposed

## Context

The `@apex/cli` package contains 41+ TypeScript files with critical service classes, handlers, UI hooks, and utilities that form the foundation of the APEX CLI. Currently, JSDoc documentation coverage is inconsistent:

- **Well-documented files**: `daemon-handlers.ts`, `session-handlers.ts` (partial), `SessionAutoSaver.ts`, `useOrchestratorEvents.ts` (interfaces only)
- **Undocumented files**: `SessionStore.ts`, `ShortcutManager.ts`, `CompletionEngine.ts`, `ConversationManager.ts`, and most utility files

This ADR establishes documentation standards to improve maintainability, IDE support, and developer onboarding.

## Decision

### 1. Documentation Scope & Priority

#### Phase 1: High-Priority Service Classes (Core APIs)
| File | Lines | Public Methods | Interfaces |
|------|-------|---------------|------------|
| `SessionStore.ts` | 548 | 11 | 6 |
| `ShortcutManager.ts` | 339 | 12 | 6 |
| `CompletionEngine.ts` | 369 | 3 | 4 |
| `ConversationManager.ts` | 416 | 15 | 3 |
| `SessionAutoSaver.ts` | 170 | 12 | 1 |
| `TaskInspector.ts` | ~150 | 2 | 1 |

#### Phase 2: Handler Functions
| File | Functions |
|------|-----------|
| `session-handlers.ts` | 8 exported |
| `workspace-handlers.ts` | 4 exported |
| `service-handlers.ts` | 3 exported |
| `usage-handlers.ts` | 1 exported |

#### Phase 3: UI Hooks & Utilities
| File | Exports |
|------|---------|
| `useOrchestratorEvents.ts` | 1 hook, 2 interfaces |
| `useAgentHandoff.ts` | 1 hook, 2 types |
| `useToolEventLogger.ts` | 1 hook, 2 interfaces |
| `useElapsedTime.ts` | 1 hook |
| `useStdoutDimensions.ts` | 1 hook, 3 types |
| `ErrorFormatter.ts` | 1 class, 2 enums, 3 interfaces |
| `confirmation.ts` | 1 function, 1 interface |
| `approval-prompt.ts` | 2 functions |
| `diff-renderer.ts` | 1 function |

### 2. JSDoc Standards

#### 2.1 Interface Documentation Pattern
```typescript
/**
 * Brief one-line description
 *
 * @remarks
 * Additional context about usage, relationships, or constraints.
 *
 * @example
 * ```typescript
 * const config: InterfaceName = {
 *   property: 'value'
 * };
 * ```
 */
export interface InterfaceName {
  /** Description of what this property represents */
  property: string;

  /**
   * Description for complex properties
   * @default defaultValue
   */
  optionalProperty?: number;
}
```

#### 2.2 Class Documentation Pattern
```typescript
/**
 * Brief one-line description of the class purpose
 *
 * @remarks
 * Extended description including:
 * - Primary responsibilities
 * - Key architectural decisions
 * - Thread safety / concurrency notes
 * - State management approach
 *
 * @example
 * ```typescript
 * const instance = new ClassName(config);
 * await instance.initialize();
 * const result = await instance.method();
 * ```
 *
 * @see RelatedClass - For related functionality
 */
export class ClassName {
  /**
   * Creates a new instance
   *
   * @param config - Configuration options
   * @throws {Error} When configuration is invalid
   */
  constructor(config: Config) {}

  /**
   * Brief method description
   *
   * @param param - Parameter description
   * @returns Description of return value
   * @throws {ErrorType} When this error occurs
   *
   * @example
   * ```typescript
   * const result = await instance.method('input');
   * ```
   */
  async method(param: string): Promise<Result> {}
}
```

#### 2.3 Function Documentation Pattern
```typescript
/**
 * Brief description of what the function does
 *
 * @param param1 - Description of first parameter
 * @param param2 - Description of second parameter
 * @returns Description of return value
 * @throws {ErrorType} When this error occurs
 *
 * @example
 * ```typescript
 * const result = await functionName('input', options);
 * ```
 */
export async function functionName(
  param1: string,
  param2: Options
): Promise<Result> {}
```

#### 2.4 React Hook Documentation Pattern
```typescript
/**
 * Brief description of hook purpose
 *
 * @remarks
 * - When to use this hook
 * - Dependencies and side effects
 * - Performance considerations
 *
 * @param options - Hook configuration options
 * @returns State and callbacks provided by the hook
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { state, action } = useCustomHook({ option: 'value' });
 *   return <div>{state}</div>;
 * }
 * ```
 */
export function useCustomHook(options: Options): HookReturn {}
```

#### 2.5 Type/Enum Documentation Pattern
```typescript
/**
 * Description of what this type represents
 */
export type TypeName = 'option1' | 'option2' | 'option3';

/**
 * Description of the enum's purpose
 */
export enum EnumName {
  /** Description of FIRST */
  FIRST = 'first',
  /** Description of SECOND */
  SECOND = 'second',
}
```

### 3. Documentation Requirements by Category

#### 3.1 Service Classes (SessionStore, ShortcutManager, etc.)

**Required documentation:**
- Class-level: Purpose, usage pattern, state management, thread safety
- Constructor: Parameters, initialization requirements, default values
- Public methods: Purpose, params, returns, throws, side effects
- All exported interfaces: Property descriptions, default values

**Optional but recommended:**
- Private methods with complex logic
- Usage examples for common patterns
- Links to related classes/interfaces

#### 3.2 Handler Functions

**Required documentation:**
- Function-level: Purpose, CLI command it handles
- Parameters: Context interface, args array structure
- Return behavior: Console output, side effects, exit codes
- Error handling: What errors are caught and how they're displayed

#### 3.3 React Hooks

**Required documentation:**
- Hook-level: Purpose, when to use, component requirements
- Parameters: Options interface with defaults
- Return value: State shape and callback descriptions
- Side effects: Event subscriptions, timers, cleanup behavior

#### 3.4 Utility Functions

**Required documentation:**
- Function-level: Purpose, input/output transformation
- Parameters: All parameters with types and constraints
- Return value: Type and possible values
- Edge cases: Empty inputs, error conditions

### 4. Implementation Guidelines

#### 4.1 Consistency Rules
1. Use imperative mood for descriptions ("Creates", not "This creates")
2. Start descriptions with capital letter, no trailing period for single-line
3. Use `@remarks` for extended descriptions, not continuation of main description
4. Use `@example` with actual runnable code, wrapped in typescript code blocks
5. Use `@throws` for all thrown errors, including those from dependencies
6. Use `@see` to link related functions/classes/interfaces
7. Use `@default` for optional parameters with default values
8. Use `@internal` for public-but-internal APIs (not part of public contract)

#### 4.2 Property Comments
- Single-line properties: Use `/** Description */` on same line or preceding line
- Multi-line properties: Use full JSDoc block with `@default`, `@remarks` as needed
- Boolean properties: Describe what `true` means, not just the property name

#### 4.3 Method Ordering in Documentation
1. Constructor
2. Lifecycle methods (initialize, destroy, start, stop)
3. Core business methods (alphabetically or by usage flow)
4. Getters/setters
5. Event handlers
6. Private methods (if documented)

### 5. Files Requiring Documentation Updates

#### Priority 1 - Service Classes (Implement First)
```
packages/cli/src/services/
├── SessionStore.ts        ← Full class, 6 interfaces, 11 public methods
├── ShortcutManager.ts     ← Full class, 6 types/interfaces, 12 public methods
├── CompletionEngine.ts    ← Full class, 4 interfaces, 3 public methods
├── ConversationManager.ts ← Full class, 3 interfaces, 15 public methods
├── SessionAutoSaver.ts    ← Add method docs (interfaces already done)
└── task-inspector.ts      ← Full class, 1 interface, 2 public methods
```

#### Priority 2 - Handler Functions
```
packages/cli/src/handlers/
├── session-handlers.ts    ← 8 exported functions (partial docs exist)
├── workspace-handlers.ts  ← 4 exported functions
├── service-handlers.ts    ← 3 exported functions
└── usage-handlers.ts      ← 1 exported function
```

#### Priority 3 - UI Hooks & Utilities
```
packages/cli/src/ui/hooks/
├── useOrchestratorEvents.ts ← Enhance hook function docs
├── useAgentHandoff.ts       ← Hook + 2 types
├── useToolEventLogger.ts    ← Hook + 2 interfaces
├── useElapsedTime.ts        ← Hook function
└── useStdoutDimensions.ts   ← Hook + 3 types

packages/cli/src/utils/
├── ErrorFormatter.ts        ← Class + enums + interfaces
├── confirmation.ts          ← 1 function + 1 interface
└── approval-prompt.ts       ← 2 functions
```

### 6. Validation Criteria

Documentation is complete when:

1. **All exported symbols have JSDoc** - No exported function, class, interface, type, or enum without documentation
2. **All public methods documented** - Every public method in service classes has JSDoc
3. **All parameters described** - Every `@param` tag for all parameters
4. **Return values documented** - Every function/method with non-void return has `@returns`
5. **TypeScript compilation passes** - No JSDoc errors in build
6. **Examples are valid** - Code examples compile (verified manually or via doc tests)

### 7. Estimated Effort

| Category | Files | Est. Lines of JSDoc | Priority |
|----------|-------|---------------------|----------|
| Service Classes | 6 | ~400 | 1 |
| Handler Functions | 4 | ~150 | 2 |
| UI Hooks | 5 | ~100 | 3 |
| Utilities | 3 | ~75 | 3 |
| **Total** | **18** | **~725** | - |

## Consequences

### Positive
- Improved IDE IntelliSense and hover documentation
- Better onboarding for new contributors
- Self-documenting API contracts
- Easier code reviews with clear intent
- Foundation for auto-generated API documentation

### Negative
- Initial time investment (~4-6 hours for complete coverage)
- Documentation maintenance overhead
- Larger file sizes (minimal impact on bundle, docs stripped in production)

### Neutral
- Establishes precedent for documentation standards in other packages

## Related ADRs

- None currently

## References

- [TypeScript JSDoc Reference](https://www.typescriptlang.org/docs/handbook/jsdoc-supported-types.html)
- [TSDoc Standard](https://tsdoc.org/)
- [Google TypeScript Style Guide - Comments](https://google.github.io/styleguide/tsguide.html#comments-documentation)
