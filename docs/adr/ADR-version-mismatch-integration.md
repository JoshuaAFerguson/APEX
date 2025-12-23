# ADR: Integrate VersionMismatchDetector into IdleProcessor.findOutdatedDocumentation()

## Status
**Proposed**

## Context

The `VersionMismatchDetector` class (in `packages/orchestrator/src/analyzers/version-mismatch-detector.ts`) is a specialized analyzer that detects version mismatches between `package.json` version and version references in documentation files (markdown files and JSDoc comments).

Currently, the `IdleProcessor.findOutdatedDocumentation()` method (in `packages/orchestrator/src/idle-processor.ts`) performs basic outdated documentation detection but does not leverage the specialized `VersionMismatchDetector` for accurate version mismatch detection.

### Current State

1. **VersionMismatchDetector**:
   - Has `detectMismatches(): Promise<VersionMismatch[]>` method
   - Returns `VersionMismatch[]` with properties: `file`, `line`, `foundVersion`, `expectedVersion`, `lineContent`
   - Requires `projectPath` to be set via constructor or `setProjectPath()`
   - Already exported from `packages/orchestrator/src/analyzers/index.ts`

2. **IdleProcessor.findOutdatedDocumentation()**:
   - Returns `Promise<OutdatedDocumentation[]>`
   - `OutdatedDocumentation` has properties: `file`, `type`, `description`, `line?`, `suggestion?`, `severity`
   - `type` can be: `'version-mismatch' | 'deprecated-api' | 'broken-link' | 'outdated-example' | 'stale-reference'`
   - Currently has basic version mismatch detection that is less sophisticated

3. **Integration Pattern (Reference)**:
   - `StaleCommentDetector` is already integrated in `findStaleComments()` method
   - Uses dynamic import: `const { StaleCommentDetector } = await import('./stale-comment-detector');`
   - Results are merged into `outdatedDocs` array in `analyzeDocumentation()`

## Decision

### 1. Integration Approach

We will integrate `VersionMismatchDetector` into `IdleProcessor.findOutdatedDocumentation()` following the same pattern used for `StaleCommentDetector`:

```typescript
// In IdleProcessor class
private async findOutdatedDocumentation(): Promise<OutdatedDocumentation[]> {
  const outdatedDocs: OutdatedDocumentation[] = [];

  // ... existing detection logic ...

  // Add version mismatch detection using VersionMismatchDetector
  const versionMismatches = await this.findVersionMismatches();
  outdatedDocs.push(...versionMismatches);

  return outdatedDocs.slice(0, 30); // Limit results
}

private async findVersionMismatches(): Promise<OutdatedDocumentation[]> {
  try {
    const { VersionMismatchDetector } = await import('./analyzers/version-mismatch-detector.js');
    const detector = new VersionMismatchDetector(this.projectPath);
    const mismatches = await detector.detectMismatches();

    return this.convertVersionMismatchesToOutdatedDocs(mismatches);
  } catch (error) {
    // Graceful fallback
    return [];
  }
}
```

### 2. Data Conversion

Convert `VersionMismatch[]` to `OutdatedDocumentation[]`:

```typescript
private convertVersionMismatchesToOutdatedDocs(
  mismatches: VersionMismatch[]
): OutdatedDocumentation[] {
  return mismatches.map(mismatch => ({
    file: mismatch.file,
    type: 'version-mismatch' as const,
    description: `Found version ${mismatch.foundVersion}, expected ${mismatch.expectedVersion}`,
    line: mismatch.line,
    suggestion: `Update version reference from ${mismatch.foundVersion} to ${mismatch.expectedVersion}`,
    severity: this.calculateMismatchSeverity(mismatch)
  }));
}

private calculateMismatchSeverity(mismatch: VersionMismatch): 'low' | 'medium' | 'high' {
  // Major version difference = high severity
  const foundMajor = parseInt(mismatch.foundVersion.split('.')[0]);
  const expectedMajor = parseInt(mismatch.expectedVersion.split('.')[0]);

  if (foundMajor !== expectedMajor) return 'high';

  // Minor version difference = medium severity
  const foundMinor = parseInt(mismatch.foundVersion.split('.')[1]);
  const expectedMinor = parseInt(mismatch.expectedVersion.split('.')[1]);

  if (foundMinor !== expectedMinor) return 'medium';

  return 'low';
}
```

### 3. Remove Redundant Detection

The existing basic version mismatch detection in `findOutdatedDocumentation()` (lines 953-969) should be removed or refactored to avoid duplication:

```typescript
// REMOVE: This redundant basic version detection
// Look for version mismatches (very basic)
const versionMatch = line.match(/v?(\d+\.\d+\.\d+)/);
if (versionMatch && line.includes('version')) {
  // ... basic detection ...
}
```

### 4. Architecture Considerations

#### Dependency Direction
- `IdleProcessor` imports from `./analyzers/version-mismatch-detector.js`
- This follows existing patterns (e.g., `StaleCommentDetector` import)
- Maintains clean separation of concerns

#### Error Handling
- Graceful degradation if detector fails
- Returns empty array on error, allowing other detection to continue
- Logs warning for debugging

#### Performance
- Lazy import using dynamic `import()` to avoid loading until needed
- Detector reuses existing file scanning infrastructure
- Results are sliced to prevent memory issues with large codebases

## Alternatives Considered

### 1. Direct Integration in `analyzeDocumentation()`
- **Rejected**: Would bypass the specialized `findOutdatedDocumentation()` method
- Breaks separation of concerns

### 2. Separate Parallel Call
- **Rejected**: Would require more changes to merge results properly
- Existing pattern in `analyzeDocumentation()` already merges `outdatedDocs` with `staleComments`

### 3. Extend BaseAnalyzer Pattern
- **Rejected**: `VersionMismatchDetector` already extends `BaseAnalyzer`
- The `analyze()` method returns empty candidates by design
- `detectMismatches()` is the primary entry point

## Implementation Plan

### Phase 1: Core Integration
1. Add `findVersionMismatches()` private method to `IdleProcessor`
2. Add `convertVersionMismatchesToOutdatedDocs()` helper method
3. Add `calculateMismatchSeverity()` helper method
4. Call `findVersionMismatches()` from `findOutdatedDocumentation()`
5. Remove redundant basic version detection code

### Phase 2: Unit Tests
1. Create test file: `idle-processor-version-mismatch.test.ts`
2. Test cases:
   - Detector instantiation with projectPath
   - Successful mismatch detection and conversion
   - Severity calculation for major/minor/patch differences
   - Graceful error handling
   - Empty results when no mismatches

### Phase 3: Verification
1. Run `npm run build` - must pass
2. Run `npm run test` - all tests must pass
3. Run specific test file to verify integration

## Files to Modify

1. **`packages/orchestrator/src/idle-processor.ts`**
   - Add `findVersionMismatches()` method
   - Add `convertVersionMismatchesToOutdatedDocs()` method
   - Add `calculateMismatchSeverity()` method
   - Modify `findOutdatedDocumentation()` to call new method
   - Remove redundant basic version detection (lines 953-969)

2. **`packages/orchestrator/src/idle-processor-version-mismatch.test.ts`** (new file)
   - Unit tests for the integration

## Type Contracts

### Input: VersionMismatch (from VersionMismatchDetector)
```typescript
interface VersionMismatch {
  file: string;           // Relative file path
  line: number;           // 1-indexed line number
  foundVersion: string;   // e.g., "1.0.0"
  expectedVersion: string; // e.g., "2.0.0"
  lineContent: string;    // The actual line content
}
```

### Output: OutdatedDocumentation (to IdleProcessor)
```typescript
interface OutdatedDocumentation {
  file: string;           // File path
  type: 'version-mismatch';
  description: string;    // Human-readable description
  line?: number;          // Line number (optional)
  suggestion?: string;    // Suggested fix
  severity: 'low' | 'medium' | 'high';
}
```

## Consequences

### Positive
- More accurate version mismatch detection using specialized patterns
- Consistent with existing integration patterns (StaleCommentDetector)
- Leverages tested, existing functionality
- Clean separation of concerns maintained

### Negative
- Additional dynamic import overhead (minimal)
- Slightly increased complexity in `findOutdatedDocumentation()`

### Neutral
- No breaking changes to public API
- Test coverage requirements increase

## Notes for Implementation Stage

1. The import path should use `.js` extension for ESM compatibility
2. Use `this.projectPath` which is already available in `IdleProcessor`
3. Follow the error handling pattern from `findStaleComments()`
4. Consider using VersionMismatchDetector's `createVersionMismatchTask()` for task generation in a future enhancement
