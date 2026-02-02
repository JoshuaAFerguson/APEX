# ADR-131: Browser Permission Test Utilities Documentation Architecture

## Status
Accepted

## Date
2025-01-31

## Context

The task requires comprehensive documentation for browser permission test utilities covering: **installation/setup, API reference for each utility category, usage examples, common testing patterns, and troubleshooting guide**.

### Current State Analysis

The existing `docs/browser-permission-test-utilities.md` (684 lines) covers:
- ✅ Permission assertion helpers (custom Vitest matchers + function-based)
- ✅ Mock data factories (`createMockToolPermissionResult`, `createMockPermissionContext`, `createMockPermissionHistory`)
- ✅ Platform detection utilities (`isWindows`, `skipOnWindows`, `testOnAllPlatforms`)
- ✅ Integration examples (browser permission test suite, cross-platform, error handling)
- ✅ Installation and setup (Vitest config, imports)

However, significant utility categories in the codebase are **undocumented**:

| Undocumented Category | Package | Location |
|---|---|---|
| **Browser Test Utilities** (mock pages, DOM builders, URL generators, browser assertions, test pages, validators, performance, mock scenarios) | `@apex/browser` | `packages/browser/src/test-utils/` |
| **Permission Mocking** (`mockPermissions()`, `withMockedPermissions()`, `MockPermissionHandle`) | `@apex/browser` | `packages/browser/src/permission-mocking/` |
| **Browser Permission Error Handling** (`BrowserPermissionDeniedError`, `BrowserResourceState`, `BrowserLifecycleState`) | `@apex/core` | `packages/core/src/tools/browser/` |
| **Troubleshooting Guide** | — | Missing entirely |
| **Common Testing Patterns** (browser-specific: lifecycle, cleanup, error scenarios, permission revocation mid-stream) | — | Partially covered |

### Related Documentation
- `test-utils/README.md` — General test utility quick start (does not cover browser-specific utilities)
- `tests/test-utils/README.md` — Async/assertion/context/cleanup utilities (no browser coverage)
- `tests/integration/browser-permissions-test-summary.md` — Integration test coverage summary
- ADR-052 — `BrowserPermissionDeniedError` architecture
- ADR-130 — Shared test configuration architecture

## Decision

### Architecture: Expand the Existing Document into a Comprehensive Reference

Rather than creating multiple fragmented documentation files, the architecture consolidates all browser permission test utility documentation into a **single, expanded document** with clear section hierarchy. This follows the existing pattern where `docs/browser-permission-test-utilities.md` is the canonical location.

### Document Structure

The expanded `docs/browser-permission-test-utilities.md` will have the following top-level sections:

```
# Browser Permission Test Utilities

## 1. Overview
   - Utility categories summary
   - Architecture diagram (text-based)
   - Package dependency map

## 2. Installation and Setup
   - Prerequisites
   - Vitest configuration
   - Import paths by package
   - Setup files and auto-registration

## 3. API Reference: Permission Assertion Helpers        [EXISTING - keep]
   - Custom Vitest matchers (toBePermissionGranted, etc.)
   - Function-based assertions (expectPermissionGranted, etc.)

## 4. API Reference: Mock Data Factories                 [EXISTING - keep]
   - createMockToolPermissionResult()
   - createMockPermissionContext()
   - createMockPermissionHistory()

## 5. API Reference: Platform Detection                  [EXISTING - keep]
   - Platform checks and conditional skipping

## 6. API Reference: Browser Test Utilities              [NEW]
   - Mock Page Objects (createMockPage, createMockElement, etc.)
   - DOM Builders (buildFormHtml, buildTableHtml, etc.)
   - URL Generators (generateTestUrl, testUrls, urlScenarios)
   - Browser State Assertions (assertNavigationState, assertBrowserState, etc.)
   - Test Pages (TestPages, TestDataGenerators)
   - Validators (ScreenshotValidators)
   - Performance Monitor (PerformanceMonitor)
   - Mock Scenarios (MockScenarios)

## 7. API Reference: Permission Mocking                  [NEW]
   - mockPermissions() factory
   - MockPermissionHandle interface
   - withMockedPermissions() convenience wrapper
   - isPermissionsMocked() / getCurrentMockHandle()
   - MockPermissionConfig options

## 8. API Reference: Browser Permission Error Handling   [NEW]
   - BrowserPermissionDeniedError class
   - BrowserResourceState interface
   - BrowserLifecycleState types
   - Factory methods (fromBrowserPermissionError, forDomainRestriction, etc.)
   - Type guard functions (isBrowserPermissionDeniedError, etc.)

## 9. Usage Examples                                     [EXPANDED]
   - Complete browser permission test suite
   - Cross-platform browser testing
   - Permission mocking with state changes
   - Browser error handling test patterns
   - Mock page + assertion composition
   - Performance regression testing

## 10. Common Testing Patterns                           [NEW]
   - Permission lifecycle testing (grant → use → revoke)
   - Browser resource cleanup patterns
   - Mid-stream permission revocation handling
   - Dual-signal error handling (throw vs return)
   - Domain allowlist/blocklist testing
   - Permission escalation workflow testing
   - Event-driven permission assertion patterns
   - Concurrent permission request testing

## 11. Troubleshooting Guide                             [NEW]
   - Common error messages and solutions
   - Permission mock not activating
   - Custom matchers not registered
   - Browser resource leaks in tests
   - Cross-platform test failures
   - Async permission test timeouts
   - TypeScript type errors with matchers
   - Debug logging configuration
```

### Design Decisions

#### D1: Single Document vs. Multiple Files

**Decision**: Single expanded document.

**Rationale**:
- The existing `docs/browser-permission-test-utilities.md` is already the established canonical location
- All utility categories are tightly related (used together in browser permission tests)
- A single document enables Ctrl+F discovery without navigating between files
- The document is organized with clear heading hierarchy for deep-linking
- Other APEX docs follow this pattern (e.g., `docs/permission-system.md` is a single comprehensive reference)

#### D2: Import Path Canonicalization

The documentation will establish **canonical import paths** for each utility category:

| Category | Canonical Import | Package |
|---|---|---|
| Permission assertions | `@apex/core/test-utils` | `@apex/core` |
| Mock data factories | `@apex/core/test-utils` | `@apex/core` |
| Platform detection | `@apex/core/test-utils` | `@apex/core` |
| Browser test utilities | `@apex/browser/test-utils` | `@apex/browser` |
| Permission mocking | `@apex/browser/permission-mocking` | `@apex/browser` |
| Browser error classes | `@apex/core` (main export) | `@apex/core` |

This establishes a clear mental model: `@apex/core/test-utils` for permission logic testing, `@apex/browser/*` for browser-specific testing.

#### D3: Troubleshooting as Structured FAQ

**Decision**: Structure troubleshooting as problem → symptom → cause → solution.

**Rationale**:
- Developers search for error messages, not concepts
- Each troubleshooting entry starts with the visible symptom (error message or behavior)
- Solutions include both the fix and a code example
- Aligns with how developers actually debug test failures

#### D4: Testing Patterns as Recipes

**Decision**: Document common testing patterns as self-contained "recipes" with complete, copy-pasteable code.

**Rationale**:
- Permission testing often requires combining multiple utilities (mocking + assertions + cleanup)
- Recipes reduce the cognitive load of assembling these combinations
- Each recipe follows a consistent format: **When to use → Setup → Test → Cleanup → Notes**

### Content Sources

The documentation content will be synthesized from:

1. **Existing source code** — JSDoc comments and type signatures from:
   - `packages/browser/src/test-utils/*.ts` (8 modules)
   - `packages/browser/src/permission-mocking/*.ts` (2 modules)
   - `packages/core/src/tools/browser/browser-permission-denied-error.ts`
   - `packages/core/src/test-utils.ts`

2. **Existing test files** — Real usage patterns from:
   - `packages/core/src/__tests__/permission-assertion-helpers*.test.ts`
   - `packages/core/src/tools/browser/__tests__/browser-permission-denied-error*.test.ts`
   - `tests/integration/browser-*-permissions*.test.ts`

3. **Existing ADRs** — Architectural context from:
   - ADR-052 (BrowserPermissionDeniedError design)
   - ADR-130 (Shared test configuration)

4. **Existing documentation** — Base content from:
   - Current `docs/browser-permission-test-utilities.md` (retained and expanded)
   - `tests/integration/browser-permissions-test-summary.md`

### Estimated Document Size

The expanded document is estimated at **1200-1500 lines**, broken down:
- Sections 1-2 (Overview, Setup): ~100 lines
- Sections 3-5 (Existing API reference): ~350 lines (retained from current doc)
- Section 6 (Browser Test Utilities): ~250 lines
- Section 7 (Permission Mocking): ~150 lines
- Section 8 (Error Handling): ~100 lines
- Section 9 (Usage Examples): ~200 lines
- Section 10 (Common Patterns): ~200 lines
- Section 11 (Troubleshooting): ~150 lines

## Implementation Plan

### Phase 1: Document Expansion (Implementation Stage)
1. Retain all existing content from `docs/browser-permission-test-utilities.md`
2. Add Section 6: Browser Test Utilities API reference
3. Add Section 7: Permission Mocking API reference
4. Add Section 8: Browser Permission Error Handling API reference
5. Expand Section 9: Additional usage examples
6. Add Section 10: Common Testing Patterns
7. Add Section 11: Troubleshooting Guide
8. Restructure overview section with utility category map

### Phase 2: Cross-Reference Updates
1. Add a link from `test-utils/README.md` to the browser-specific doc
2. Add a link from `tests/test-utils/README.md` to the browser-specific doc
3. Ensure `tests/integration/browser-permissions-test-summary.md` references the new doc

### Verification
- `npm run build` must pass (documentation changes only, no code changes)
- `npm run test` must pass (no test modifications)

## Consequences

### Positive
- **Single source of truth** for all browser permission test utility documentation
- **Complete API coverage** — all 8 utility sub-modules in `@apex/browser/test-utils` documented
- **Canonical import paths** — clear guidance on which package to import from
- **Actionable troubleshooting** — developers can self-serve common issues
- **Copy-paste recipes** — reduces time to write new browser permission tests

### Negative
- **Large document** (~1500 lines) — mitigated by clear heading hierarchy and table of contents
- **Maintenance burden** — API changes must be reflected in docs (mitigated by keeping docs close to source)

### Neutral
- No code changes required — this is purely a documentation task
- Existing document URL/path unchanged — no broken links

## Notes for Implementation Stage

1. **Preserve existing content**: Sections 3-5 should be kept verbatim from the current document
2. **Use real type signatures**: Copy exact TypeScript signatures from source files, not approximations
3. **Include both import styles**: Show both `@apex/core/test-utils` and relative path imports
4. **Test all code examples**: Every code block should be valid TypeScript that would compile
5. **Cross-reference ADRs**: Link to ADR-052 and ADR-130 where relevant
