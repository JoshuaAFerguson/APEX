# Tool Output Truncation Utility

This utility provides intelligent truncation of tool outputs while preserving readability and JSON structure.

## Basic Usage

```typescript
import { truncateToolOutput } from '@apex/core';

// Basic truncation
const longOutput = 'A'.repeat(15000);
const result = truncateToolOutput(longOutput);
// result.truncated === true
// result.output.length <= 10000
// result.output.endsWith('... [truncated]')

// Custom configuration
const customResult = truncateToolOutput(longOutput, {
  maxLength: 5000,
  suffix: '... [TRUNCATED]',
  wordBoundary: true,
  preserveJson: true
});
```

## JSON Structure Preservation

```typescript
// Large JSON array
const jsonArray = JSON.stringify([...Array(1000).keys()]);
const result = truncateToolOutput(jsonArray, { maxLength: 2000 });
// Preserves array structure: [...items, "... 500 more items"]

// Large JSON object
const jsonObject = JSON.stringify({
  prop1: 'value1'.repeat(100),
  prop2: 'value2'.repeat(100),
  // ... many more properties
});
const result = truncateToolOutput(jsonObject, { maxLength: 1000 });
// Preserves object structure: {...props, "... 10 more properties": "..."}
```

## Configuration Options

- `maxLength`: Maximum character limit (default: 10000)
- `suffix`: Truncation indicator text (default: '... [truncated]')
- `preserveJson`: Enable JSON-aware truncation (default: true)
- `wordBoundary`: Try to break at word boundaries (default: true)

## Return Value

```typescript
interface TruncateResult {
  output: string;          // The truncated content
  truncated: boolean;      // Whether truncation occurred
  originalLength: number;  // Original content length
  truncatedLength: number; // Final content length
}
```

## Use Cases

1. **Tool Output Logging**: Prevent log files from becoming too large
2. **API Response Truncation**: Limit response sizes while preserving structure
3. **Debug Output**: Keep debug information readable and manageable
4. **Chat/Message Systems**: Truncate long messages while preserving formatting