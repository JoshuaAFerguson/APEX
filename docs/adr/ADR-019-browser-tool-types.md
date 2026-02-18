# ADR-019: Browser Tool Types for APEX Platform

## Status
Accepted

## Context
APEX agents need browser automation capabilities to interact with web applications during testing,
verification, and automation workflows. The MCP (Model Context Protocol) already provides a browser
tool (`mcp__browser-tools__Browser`) that supports operations like navigate, click, type, screenshot,
and more. We need to define proper Zod schemas and TypeScript types within @apex/core to enable
type-safe integration with this browser automation capability.

## Decision

### 1. Add 'browser' to ToolCategory
Extend the `ToolCategorySchema` in types.ts to include 'browser' as a valid tool category.

### 2. Browser Operation Types
Define a comprehensive set of browser operations matching the MCP browser tool capabilities:

```typescript
export const BrowserOperationSchema = z.enum([
  'navigate',           // Navigate to a URL
  'click',              // Click on an element
  'type',               // Type text into an element
  'screenshot',         // Take a screenshot
  'compareScreenshot',  // Compare screenshots for visual regression
  'evaluate',           // Execute JavaScript in browser context
  'submit',             // Submit a form
  'waitForSelector',    // Wait for an element to appear
  'getAttribute',       // Get element attribute value
  'getText',            // Get element text content
  'getHtml',            // Get element HTML content
  'scroll',             // Scroll the page or element
  'hover',              // Hover over an element
]);
```

### 3. Browser Tool Input Schema
Define input parameters for each browser operation:

- **navigate**: `{ url: string }`
- **click**: `{ selector: string, options?: { button?, clickCount?, delay? } }`
- **type**: `{ selector: string, text: string, options?: { delay?, clear? } }`
- **screenshot**: `{ selector?: string, path?: string, fullPage?: boolean }`
- **compareScreenshot**: `{ baseline: string, current?: string, threshold?: number }`
- **evaluate**: `{ script: string, args?: unknown[] }`
- **submit**: `{ selector: string }`
- **waitForSelector**: `{ selector: string, options?: { timeout?, state? } }`
- **getAttribute**: `{ selector: string, attribute: string }`
- **getText**: `{ selector: string }`
- **getHtml**: `{ selector: string }`
- **scroll**: `{ selector?: string, x?: number, y?: number }`
- **hover**: `{ selector: string }`

### 4. Browser Tool Output Schema
Define output structures for browser operations:

```typescript
export const BrowserToolOutputSchema = z.object({
  success: z.boolean(),
  operation: BrowserOperationSchema,
  data: z.unknown().optional(),
  screenshot: z.string().optional(),    // Base64 or path
  html: z.string().optional(),
  text: z.string().optional(),
  attributeValue: z.string().optional(),
  evaluationResult: z.unknown().optional(),
  url: z.string().optional(),
  title: z.string().optional(),
  duration: z.number().optional(),
  error: z.string().optional(),
});
```

### 5. Integration with Existing Infrastructure

The browser tool will:
- Use category: 'browser' (new category to add)
- Require permissions: ['network']
- Integrate with existing BrowserToolConfig for permission control
- Follow the BaseTool pattern established by other tools

### 6. File Structure

```
packages/core/src/tools/browser/
├── index.ts                    # Module exports
├── browser-tool.ts             # BrowserTool class implementation
├── browser-types.ts            # Zod schemas and TypeScript types
├── register.ts                 # Registration utilities
└── __tests__/
    └── browser-tool.test.ts    # Unit tests
```

## Consequences

### Positive
- Type-safe browser automation for APEX agents
- Consistent with existing tool patterns (WebSearchTool, BashTool, etc.)
- Reuses existing BrowserToolConfig for permission management
- Enables visual regression testing capabilities
- Supports MCP browser tool integration

### Negative
- Adds new tool category to maintain
- Browser automation adds complexity to agent workflows
- Screenshot operations may be resource-intensive

### Neutral
- Follows established patterns, minimal learning curve
- Leverages existing Zod validation infrastructure

## Implementation Notes

1. The BrowserTool class will primarily act as a type-safe wrapper for MCP browser tool invocations
2. Input validation will use Zod schemas to ensure type safety
3. The tool will respect BrowserToolConfig settings (allowedDomains, blockedDomains, etc.)
4. Screenshot comparison will integrate with the existing ScreenshotComparator module
