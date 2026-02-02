# ADR-122: Documentation Cross-Reference Architecture

## Status
Accepted

## Context

APEX v0.5.0 introduced several new documentation files for browser automation, permission test utilities, and system API references. These documents cover overlapping concepts (browser state fixtures, mock helpers, permission contexts, permission histories) but lack cross-references between them. Additionally, the existing `test-utilities.md` does not reference the new API documentation pages.

The documentation conventions established in the codebase use:
- **"Related Documentation"** sections at the end of reference/configuration docs (e.g., `container-configuration.md`, `container-isolation.md`)
- **"Related Features"** sections at the end of user-guide docs (e.g., `output-feedback.md`, `input-preview.md`)
- Markdown bullet-list format: `- [Title](./relative-path.md) - Brief description`
- Emoji section headers for API reference docs (e.g., `## 🔧 Tools System APIs`)
- TypeScript fenced code blocks for all code examples
- Parameter tables using `| Field | Type | Required | Description |` format
- Horizontal rule (`---`) separators between API entries

## Decision

### 1. Cross-Reference Strategy

We will add **"Related Documentation"** sections to all affected documentation files, following the established pattern used by `container-configuration.md` and `container-isolation.md`.

### 2. Files to Modify

| File | Changes |
|------|---------|
| `docs/browser-permission-test-utilities.md` | Add "Related Documentation" section linking to `browser-automation.md`, `system-apis-reference.md`, `test-utilities.md` |
| `docs/browser-automation.md` | Add "Related Documentation" section linking to `browser-permission-test-utilities.md`, `system-apis-reference.md`, `api-reference.md` |
| `docs/test-utilities.md` | Add "Related Documentation" section linking to `browser-permission-test-utilities.md`, `system-apis-reference.md`, `api-reference.md` |
| `docs/system-apis-reference.md` | Add "Related Documentation" section linking to `browser-automation.md`, `browser-permission-test-utilities.md`, `test-utilities.md` |

### 3. Cross-Reference Map

```
browser-permission-test-utilities.md
  ├── → browser-automation.md (browser state fixtures use browser automation types)
  ├── → system-apis-reference.md (ToolPermissionResult, PermissionManager interfaces)
  └── → test-utilities.md (shared platform detection, cross-platform test utilities)

browser-automation.md
  ├── → browser-permission-test-utilities.md (testing utilities for browser permissions)
  ├── → system-apis-reference.md (BrowserTool, BrowserManager API contracts)
  └── → api-reference.md (REST API for browser operations)

test-utilities.md
  ├── → browser-permission-test-utilities.md (browser-specific test utilities)
  ├── → system-apis-reference.md (system API type definitions)
  └── → api-reference.md (REST/WebSocket API reference)

system-apis-reference.md
  ├── → browser-automation.md (usage guide for Browser APIs)
  ├── → browser-permission-test-utilities.md (test utilities for permission APIs)
  └── → test-utilities.md (cross-platform test utilities)
```

### 4. Internal Cross-References in browser-permission-test-utilities.md

The `browser-permission-test-utilities.md` document covers three major areas that should cross-reference each other internally:
- **Permission Assertion Helpers** (matchers) ↔ references to Mock Data Factories for creating test data
- **Mock Data Factories** ↔ references to Permission Assertion Helpers that consume the mocks
- **Browser Test Integration** section in the integration examples ↔ references back to both

We will add brief inline cross-reference notes within the document sections.

### 5. Formatting Standards

All new sections must follow these conventions:
- Section header: `## Related Documentation` (no emoji — matches `container-configuration.md`, `container-isolation.md`)
- Bullet list with bold link text: `- [Document Title](./path.md) - Description`
- Placed at the end of the document, before any closing comments
- Horizontal rule (`---`) separator before the section

## Consequences

### Positive
- Users can discover related documentation from any entry point
- Browser state fixtures docs link directly to the mock helpers that create them
- `test-utilities.md` becomes a hub linking to all testing-related docs
- Consistent formatting maintains professional documentation quality

### Negative
- Links need to be maintained when files are renamed or moved
- Adds a small maintenance burden for future documentation changes

## References

- `docs/container-configuration.md` - Established "Related Documentation" pattern
- `docs/container-isolation.md` - Established "Related Documentation" pattern
- `docs/user-guide/output-feedback.md` - Established "Related Features" pattern
