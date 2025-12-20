# Architecture Decision Record: Session Search/Filter/Listing Integration Tests

**Status**: Proposed
**Date**: 2024
**Context**: Add session search/filter/listing integration tests for complete acceptance criteria coverage

## 1. Context

The task requires adding integration tests to `packages/cli/src/__tests__/session-management.integration.test.ts` that fully cover the session search, filter, and listing functionality according to acceptance criteria.

### Acceptance Criteria
1. Search by name
2. Search by ID substring
3. Filter by tags (single and multiple)
4. Pagination with limit
5. Sorting by updatedAt
6. Active vs archived filtering with `all=true` flag

## 2. Current State Analysis

### Existing Implementation (SessionStore.listSessions)
```typescript
async listSessions(options?: {
  all?: boolean;
  search?: string;
  tags?: string[];
  limit?: number;
}): Promise<SessionSummary[]>
```

**Current behavior (from SessionStore.ts lines 168-202):**
- `all?: boolean` - When false/undefined, filters to non-archived sessions
- `search?: string` - Matches against `name` (case-insensitive) OR `id` (case-insensitive)
- `tags?: string[]` - Matches sessions with ANY of the provided tags (OR logic via `some()`)
- `limit?: number` - Truncates result set after sorting
- **Default sorting**: By `updatedAt` descending

### Existing Test Coverage
The current integration test file has one combined test at line 628-697 that partially covers some criteria but lacks:
- Isolated test cases per criterion
- Search by ID substring tests
- Multiple tag filtering tests
- Edge cases (empty results, case sensitivity, boundary conditions)

## 3. Technical Design

### 3.1 Test Suite Architecture

```
describe('Session Search, Filter, and Listing')
├── describe('Search Functionality')
│   ├── it('should search sessions by name (case-insensitive)')
│   ├── it('should search sessions by ID substring')
│   ├── it('should return empty array when no sessions match search')
│   └── it('should search across both name and ID fields')
│
├── describe('Tag Filtering')
│   ├── it('should filter sessions by single tag')
│   ├── it('should filter sessions by multiple tags (OR logic)')
│   ├── it('should return empty array when no sessions have matching tags')
│   └── it('should handle sessions with no tags')
│
├── describe('Pagination with Limit')
│   ├── it('should limit results to specified count')
│   ├── it('should return all sessions when limit exceeds total')
│   └── it('should return empty array when limit is zero')
│
├── describe('Sorting by updatedAt')
│   ├── it('should sort sessions by updatedAt in descending order')
│   └── it('should maintain sort order after filtering')
│
└── describe('Active vs Archived Filtering')
    ├── it('should exclude archived sessions by default')
    ├── it('should include archived sessions when all=true')
    └── it('should apply other filters in combination with all=true')
```

### 3.2 Test Data Design

Create a comprehensive mock index with sessions that enable thorough testing:

```typescript
const createSearchFilterTestIndex = (): SessionIndex => ({
  version: 1,
  sessions: [
    // Active sessions with varied names and tags
    {
      id: 'sess_1704067200_abc123',
      name: 'Feature Development',
      messageCount: 10,
      totalCost: 0.5,
      createdAt: new Date('2024-01-01T10:00:00Z'),
      updatedAt: new Date('2024-01-05T10:00:00Z'),  // 5th
      tags: ['feature', 'frontend'],
      isArchived: false
    },
    {
      id: 'sess_1704153600_def456',
      name: 'Bug Fix Session',
      messageCount: 5,
      totalCost: 0.2,
      createdAt: new Date('2024-01-02T10:00:00Z'),
      updatedAt: new Date('2024-01-06T10:00:00Z'),  // 4th
      tags: ['bugfix', 'backend'],
      isArchived: false
    },
    {
      id: 'sess_1704240000_ghi789',
      name: 'API Integration',
      messageCount: 15,
      totalCost: 0.8,
      createdAt: new Date('2024-01-03T10:00:00Z'),
      updatedAt: new Date('2024-01-07T10:00:00Z'),  // 3rd (most recent active)
      tags: ['feature', 'backend', 'api'],
      isArchived: false
    },
    // Session with no tags
    {
      id: 'sess_1704326400_jkl012',
      name: 'Quick Test',
      messageCount: 2,
      totalCost: 0.05,
      createdAt: new Date('2024-01-04T10:00:00Z'),
      updatedAt: new Date('2024-01-04T10:00:00Z'),  // 7th (oldest)
      tags: [],
      isArchived: false
    },
    // Archived sessions
    {
      id: 'sess_1703980800_mno345',
      name: 'Old Feature Work',
      messageCount: 25,
      totalCost: 1.2,
      createdAt: new Date('2023-12-31T10:00:00Z'),
      updatedAt: new Date('2024-01-08T10:00:00Z'),  // 2nd (archived)
      tags: ['feature', 'archived'],
      isArchived: true
    },
    {
      id: 'sess_1703894400_pqr678',
      name: 'Archived Bugfix',
      messageCount: 8,
      totalCost: 0.3,
      createdAt: new Date('2023-12-30T10:00:00Z'),
      updatedAt: new Date('2024-01-09T10:00:00Z'),  // 1st (most recent overall, archived)
      tags: ['bugfix', 'archived'],
      isArchived: true
    }
  ],
  lastUpdated: new Date('2024-01-09T10:00:00Z')
});
```

### 3.3 Key Test Scenarios

#### Search by Name
```typescript
it('should search sessions by name (case-insensitive)', async () => {
  // Search for "feature" should match "Feature Development" and "Old Feature Work" (if all=true)
  // Default (active only) should return only "Feature Development"
  const results = await sessionStore.listSessions({ search: 'feature' });
  expect(results).toHaveLength(1);
  expect(results[0].name).toBe('Feature Development');
});
```

#### Search by ID Substring
```typescript
it('should search sessions by ID substring', async () => {
  // Search for partial ID "abc123" should match sess_1704067200_abc123
  const results = await sessionStore.listSessions({ search: 'abc123' });
  expect(results).toHaveLength(1);
  expect(results[0].id).toContain('abc123');
});
```

#### Multiple Tag Filtering (OR Logic)
```typescript
it('should filter sessions by multiple tags (OR logic)', async () => {
  // Tags ['frontend', 'api'] should return sessions with EITHER tag
  const results = await sessionStore.listSessions({ tags: ['frontend', 'api'] });
  expect(results).toHaveLength(2); // "Feature Development" (frontend) + "API Integration" (api)
});
```

#### Combined Filtering with all=true
```typescript
it('should apply other filters in combination with all=true', async () => {
  // Search for "bugfix" with all=true should return both active and archived
  const results = await sessionStore.listSessions({ all: true, search: 'bugfix' });
  expect(results).toHaveLength(2); // "Bug Fix Session" + "Archived Bugfix"
  expect(results.some(s => s.isArchived)).toBe(true);
});
```

### 3.4 Interface Contract Validation

The tests should validate that `SessionStore.listSessions()` adheres to these contracts:

| Option | Default | Behavior |
|--------|---------|----------|
| `all` | `false` | Filter to `isArchived === false` |
| `search` | `undefined` | No search filter applied |
| `tags` | `undefined` | No tag filter applied |
| `limit` | `undefined` | Return all matching results |

Sorting is always by `updatedAt` DESC (most recent first).

## 4. Implementation Notes

### 4.1 File Location
All new tests should be added to:
`packages/cli/src/__tests__/session-management.integration.test.ts`

### 4.2 Test Isolation
Each test case should:
1. Set up its own mock data via `mockFs.readFile.mockImplementation()`
2. Be independent and not rely on state from other tests
3. Reset mocks in `beforeEach` (already configured in existing test file)

### 4.3 Mock Configuration Pattern
```typescript
beforeEach(() => {
  const testIndex = createSearchFilterTestIndex();
  mockFs.readFile.mockImplementation((path) => {
    if (path.includes('index.json')) {
      return Promise.resolve(JSON.stringify(testIndex));
    }
    return Promise.reject(new Error('File not found'));
  });
});
```

## 5. Acceptance Criteria Mapping

| Acceptance Criterion | Test Case(s) |
|---------------------|--------------|
| Search by name | `should search sessions by name (case-insensitive)` |
| Search by ID substring | `should search sessions by ID substring` |
| Filter by tags (single) | `should filter sessions by single tag` |
| Filter by tags (multiple) | `should filter sessions by multiple tags (OR logic)` |
| Pagination with limit | `should limit results to specified count`, `should return all sessions when limit exceeds total` |
| Sorting by updatedAt | `should sort sessions by updatedAt in descending order`, `should maintain sort order after filtering` |
| Active vs archived filtering with all=true | `should exclude archived sessions by default`, `should include archived sessions when all=true`, `should apply other filters in combination with all=true` |

## 6. Dependencies

- Vitest testing framework (already configured)
- fs/promises mock (already configured)
- SessionStore class (packages/cli/src/services/SessionStore.ts)
- SessionAutoSaver class (for integration tests if needed)

## 7. Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Test flakiness from date comparisons | Use fixed dates in ISO format, avoid `Date.now()` |
| Mock state leakage between tests | Ensure `vi.clearAllMocks()` in `beforeEach` |
| False positives from overly permissive assertions | Use specific matchers (`toEqual`, `toHaveLength`, `toContain`) |

## 8. Notes for Implementation Stage

1. **Placement**: Add the new `describe('Session Search, Filter, and Listing')` block after the existing "Advanced Session Operations" block (~line 698)
2. **Test Data Factory**: Create `createSearchFilterTestIndex()` helper function at the top of the file with other factories
3. **Coverage Verification**: After implementation, run `npm test --workspace=@apex/cli` to verify all tests pass
4. **No Production Code Changes**: This task is test-only; SessionStore implementation already supports all required functionality
