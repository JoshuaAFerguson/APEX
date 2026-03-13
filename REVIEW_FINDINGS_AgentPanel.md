# Code Review: AgentPanel Multi-Agent Visualization Component

## Review Date
2026-03-10

## Component Reviewed
- **Path**: `packages/cli/src/ui/components/agents/AgentPanel.tsx`
- **Type**: React/Ink UI Component
- **Size**: 637 lines of TypeScript/JSX
- **Test Coverage**: 70 tests with 21 passing, 70 failing

---

## Critical Issues Found

### 1. ⛔ CRITICAL: React Hook Rules Violation - CompactAgentPanel
**Location**: `AgentPanel.tsx:314-337`
**Severity**: HIGH
**Category**: React Rules

```typescript
{agents.map((agent, index) => {
  const shouldShowElapsed = config.showElapsedTime &&
    agent.status === 'active' && agent.startedAt;
  const elapsedTime = useElapsedTime(shouldShowElapsed ? agent.startedAt : null); // ❌ VIOLATION
```

**Issue**: `useElapsedTime()` hook is called conditionally inside a `.map()` loop, violating React's Rules of Hooks. Hooks must:
- Always be called in the same order
- Not be called conditionally or in loops
- Only be called at the top level of components

**Impact**:
- React will throw error: "React has detected a change in the order of Hooks called"
- Incorrect elapsed time values on re-renders
- Potential crash when agents array changes

**Fix**: Extract agent rendering to a separate component (`<CompactAgentRow>`) where the hook can be called unconditionally at the top level.

---

### 2. ⛔ CRITICAL: React Hook Rules Violation - ResponsiveParallelSection
**Location**: `AgentPanel.tsx:559-564`
**Severity**: HIGH
**Category**: React Rules

```typescript
{agents.slice(0, config.maxParallelAgentsVisible).map(agent => {
  const shouldShowElapsed = config.showElapsedTime &&
    agent.status === 'parallel' && agent.startedAt;
  const elapsedTime = useElapsedTime(shouldShowElapsed ? agent.startedAt : null); // ❌ VIOLATION
```

**Issue**: Same hook violation as issue #1, but in parallel agents section.

**Impact**: Same as above

**Fix**: Extract to separate component (`<ParallelAgentRow>`).

---

### 3. ⚠️ CRITICAL: Division by Zero
**Location**: `AgentPanel.tsx:198`
**Severity**: HIGH
**Category**: Logic Error

```typescript
if (base.useCompactLayout) {
  const availablePerAgent = Math.floor(width / agentCount) - 8; // ❌ agentCount could be 0
  const adjustedNameLength = Math.max(4, Math.min(base.agentNameMaxLength, availablePerAgent));
  return { ...base, agentNameMaxLength: adjustedNameLength };
}
```

**Issue**: If `agentCount` is 0, division results in `Infinity`, causing invalid layout calculations.

**Impact**:
- When no agents are provided, responsive config breaks
- Name length becomes undefined/invalid

**Fix**:
```typescript
if (base.useCompactLayout && agentCount > 0) {
  const availablePerAgent = Math.floor(width / agentCount) - 8;
  const adjustedNameLength = Math.max(4, Math.min(base.agentNameMaxLength, availablePerAgent));
  return { ...base, agentNameMaxLength: adjustedNameLength };
}
```

---

### 4. ⚠️ CRITICAL: Missing Space in Compact Mode - Text Rendering Issue
**Location**: `AgentPanel.tsx:326-328`
**Severity**: HIGH
**Category**: Rendering/Layout

```typescript
<Text color={color}>
  {statusIcons[agent.status]}
  {displayName}
  {/* No space between icon and name */}
```

**Issue**: Status icon and agent name are rendered in same `<Text>` without spacing, causing them to appear concatenated. This breaks test assertions that try to find the agent name text.

**Impact**:
- Text renders as "⚡developer" instead of "⚡ developer"
- Tests fail to find "developer" text
- Visually confusing in terminal output

**Test Failure**: Line 18 - `expect(screen.getByText('developer')).toBeInTheDocument()` fails because the text is split across elements with icon.

**Fix**:
```typescript
<Text color={color}>
  {statusIcons[agent.status]}{' '}
  {displayName}
```

---

### 5. ⚠️ CRITICAL: Separator Character Mismatch with Tests
**Location**: `AgentPanel.tsx:334` and `AgentPanel.test.tsx:85`
**Severity**: MEDIUM
**Category**: Test/Implementation Mismatch

**Code**:
```typescript
{index < agents.length - 1 && <Text color="gray"> | </Text>}  // Uses " | "
```

**Test**:
```typescript
expect(screen.getAllByText('│')).toHaveLength(mockAgents.length - 1);  // Expects "│"
```

**Issue**: Code renders ` | ` (pipe with spaces), but test expects `│` (box drawing character). This test will always fail.

**Impact**: Test suite fails even when separator logic is working correctly

**Fix**: Either:
- Change code to use `│`: `{index < agents.length - 1 && <Text color="gray">│</Text>}`
- OR change test to expect ` | `

---

### 6. ⚠️ CRITICAL: Unsafe Color Lookup
**Location**: `AgentPanel.tsx:320-322`
**Severity**: MEDIUM
**Category**: Logic Error

```typescript
const color = agent.name === currentAgent
  ? (agent.status === 'parallel' ? 'cyan' : agentColors[agent.name])
  : 'gray';
```

**Issue**: If `currentAgent` matches but `agentColors[agent.name]` returns `undefined`, color becomes `undefined` instead of falling back to a safe default.

**Impact**:
- Ink component receives invalid color value
- May cause rendering errors or use browser default colors

**Fix**:
```typescript
const color = agent.name === currentAgent
  ? (agent.status === 'parallel' ? 'cyan' : (agentColors[agent.name] || 'white'))
  : 'gray';
```

---

## High Priority Issues

### 7. ⚠️ HIGH: Missing Input Validation
**Location**: `AgentPanel.tsx:224-243`
**Severity**: MEDIUM
**Category**: Robustness

**Issues**:
- No validation that `agents` array contains valid `AgentInfo` objects
- No validation that `width` is a positive number
- No validation that `progress` values are 0-100 (defined in interface but not enforced)
- No null checks before accessing `agent.debugInfo`, `agent.startedAt`, etc.

**Impact**:
- Invalid props can cause runtime errors
- Undefined behavior with malformed data

**Fix**: Add validation:
```typescript
if (!Array.isArray(agents) || agents.length < 0) {
  console.error('Invalid agents prop');
  return <Box />;
}
if (width && width <= 0) {
  console.error('Invalid width prop');
  return <Box />;
}
```

---

### 8. ⚠️ HIGH: Inconsistent Parallel Agent Display Logic
**Location**: `AgentPanel.tsx:340` and `AgentPanel.tsx:443`
**Severity**: MEDIUM
**Category**: Logic

```typescript
// Both locations
{showParallel && config.showParallelSection && parallelAgents.length > 1 && (
```

**Issue**: Requires `> 1` parallel agent to display. A single parallel agent that should be visualized differently from sequential agents won't be shown.

**Impact**:
- Single parallel agent is silently hidden
- Not configurable per breakpoint

**Note**: This may be intentional design, but should be documented or made configurable.

---

### 9. ⚠️ MEDIUM: Performance Issue - Excessive Memoization
**Location**: `AgentPanel.tsx:240-243`
**Severity**: LOW
**Category**: Performance

```typescript
const config = useMemo(
  () => getResponsiveConfig(breakpoint, agents.length, width),
  [breakpoint, agents.length, width]
);
```

**Issue**: Configuration recalculates whenever `agents` array changes, even if `agents.length` stays the same. Using the entire `agents` array instead of just `agents.length` would be more efficient.

**Impact**: Minor - unnecessary recalculations on agent data changes

---

### 10. ⚠️ MEDIUM: Missing PropTypes/Runtime Validation
**Location**: Throughout component
**Severity**: MEDIUM
**Category**: Type Safety

**Issue**: Component has TypeScript types but no runtime validation. Props like `progress` should be constrained to 0-100.

**Impact**:
- No runtime safety if TypeScript is bypassed
- Tests can pass invalid values

**Fix**: Add validation:
```typescript
if (agent.progress !== undefined && (agent.progress < 0 || agent.progress > 100)) {
  console.warn(`Invalid progress ${agent.progress} for agent ${agent.name}`);
}
```

---

### 11. ⚠️ MEDIUM: Accessibility Issues
**Location**: Throughout component
**Severity**: LOW
**Category**: Accessibility

**Issues**:
- No ARIA labels for status icons (⚡, ✓, ○, ·, ⟂)
- No semantic HTML role attributes
- Color-only status indication (fails for colorblind users)

**Impact**: Component not accessible to screen readers or colorblind users

**Fix**:
```typescript
<Text color={color} title={`Status: ${agent.status}`}>
  {statusIcons[agent.status]}
</Text>
```

---

## Medium Priority Issues

### 12. ⚠️ MEDIUM: Negative Width Handling
**Location**: `AgentPanel.tsx:236-237`
**Severity**: MEDIUM
**Category**: Input Validation

```typescript
const { width: terminalWidth, breakpoint } = useStdoutDimensions();
const width = explicitWidth ?? terminalWidth;
```

**Issue**:
- `explicitWidth` can be negative
- `terminalWidth` from hook may be invalid or 0
- No validation before using in calculations

**Impact**: Invalid calculations in `getResponsiveConfig`

---

### 13. 📝 MEDIUM: TypeScript Type Issues
**Location**: `AgentPanel.tsx:299, 376`
**Severity**: MEDIUM
**Category**: Type Safety

```typescript
handoffState: any; // HandoffAnimationState type
```

**Issue**: Using `any` type defeats TypeScript safety. Proper type should be imported.

**Impact**: Type checking gaps, potential runtime errors

**Fix**:
```typescript
import type { HandoffAnimationState } from '../../hooks/useAgentHandoff.js';
handoffState: HandoffAnimationState;
```

---

### 14. 📝 MEDIUM: Insufficient Error Handling
**Location**: Throughout
**Severity**: MEDIUM
**Category**: Error Handling

**Issue**: No try-catch blocks or error boundaries. Component can crash silently.

**Impact**: Hard to debug failures in production

---

## Low Priority Issues

### 15. 📋 LOW: Code Organization
**Location**: `AgentPanel.tsx` (entire file)
**Severity**: LOW
**Category**: Maintainability

**Issue**: 637-line component contains 4 sub-components (CompactAgentPanel, DetailedAgentPanel, ResponsiveAgentRow, ResponsiveParallelSection) in one file.

**Improvement**: Split into separate files:
```
agents/
  ├── AgentPanel.tsx (main orchestrator)
  ├── CompactAgentPanel.tsx
  ├── DetailedAgentPanel.tsx
  ├── ResponsiveAgentRow.tsx
  └── ResponsiveParallelSection.tsx
```

---

### 16. 📋 LOW: Documentation
**Location**: Component JSDoc comments
**Severity**: LOW
**Category**: Documentation

**Issue**: Limited JSDoc comments on complex logic like `getResponsiveConfig` and breakpoint calculation.

**Improvement**: Add detailed comments explaining:
- Responsive breakpoint thresholds
- Why certain conditions exist
- Edge cases handled

---

### 17. 📋 LOW: Magic Numbers
**Location**: `AgentPanel.tsx:198, 199`
**Severity**: LOW
**Category**: Code Quality

```typescript
const availablePerAgent = Math.floor(width / agentCount) - 8; // What is 8?
const adjustedNameLength = Math.max(4, Math.min(base.agentNameMaxLength, availablePerAgent));
```

**Issue**: Magic number `8` is unexplained. What does it represent?

**Fix**: Extract to constant:
```typescript
const RESERVED_WIDTH_PER_AGENT = 8; // space for icon, status, separators
const availablePerAgent = Math.floor(width / agentCount) - RESERVED_WIDTH_PER_AGENT;
```

---

## Test Status

### Test Results Summary
- **Total Tests**: 91
- **Passing**: 21
- **Failing**: 70
- **Success Rate**: 23%

### Main Test Failures

1. **Text Not Found Errors** (50+ failures)
   - Tests expect full agent names like "developer" but component renders them with status icons
   - Cause: Issue #4 (missing space between icon and name)
   - Affected: Lines 18, 20-26, 76-78, 109, 126-130, etc.

2. **Separator Character Mismatch** (5+ failures)
   - Test expects `│` but code renders ` | `
   - Cause: Issue #5
   - Affected: Line 85

3. **Header Text Not Found** (3+ failures)
   - "Active Agents" header expected in full panel mode but may not render
   - Cause: Responsive config logic or display mode miscalculation
   - Affected: Lines 20, 62

4. **Multiple Element Matches** (5+ failures)
   - Tests using generic patterns like `/✓/` find multiple elements
   - Cause: Multiple agents with same status
   - Fix: Use `queryAllByText` variant or more specific selectors

---

## Summary of Required Fixes

### Priority 1 - Must Fix (Breaking Issues)
- [ ] Fix Hook violation in CompactAgentPanel (extract to component)
- [ ] Fix Hook violation in ResponsiveParallelSection (extract to component)
- [ ] Fix division by zero with empty agent list
- [ ] Add missing space between status icon and agent name
- [ ] Fix color lookup to always have valid fallback

### Priority 2 - Should Fix (Test Failures)
- [ ] Fix separator character mismatch (` | ` vs `│`)
- [ ] Update or fix test assertions for text matching
- [ ] Add input validation for width and agents array

### Priority 3 - Nice to Have (Code Quality)
- [ ] Extract sub-components to separate files
- [ ] Add proper TypeScript types instead of `any`
- [ ] Add comprehensive JSDoc comments
- [ ] Replace magic numbers with named constants
- [ ] Add accessibility labels

---

## Acceptance Criteria Assessment

Based on the component implementation and test results:

| Criterion | Status | Notes |
|-----------|--------|-------|
| Responsive configs work at all breakpoints | ❌ FAIL | Config calculation has edge cases (division by zero) |
| Agent name formatting/truncation correct | ❌ FAIL | Hook violations prevent proper rendering |
| Status icons display properly | ⚠️ PARTIAL | Icons render but spacing issues cause test failures |
| Parallel agent section renders | ❌ FAIL | Hook violations in parallel section rendering |
| Handoff animations integrate correctly | ✅ PASS | HandoffIndicator component appears sound |
| Verbose/compact modes work | ❌ FAIL | 70 of 91 tests failing due to rendering issues |
| Existing tests pass | ❌ FAIL | 70/91 tests failing |

---

## Recommendations

1. **Immediate**: Fix React Hook violations - these can cause crashes
2. **High**: Fix rendering issues that cause 70 test failures
3. **High**: Add input validation for robustness
4. **Medium**: Refactor into smaller components for maintainability
5. **Low**: Add documentation and accessibility features

---

## Conclusion

The AgentPanel component has a solid architecture and comprehensive feature set, but has **critical React Hook violations** that must be fixed immediately. The component also has **rendering issues** that cause 77% of tests to fail. Once these issues are resolved, the component will meet its acceptance criteria.

**Risk Level**: 🔴 HIGH - Current code can crash or render incorrectly
**Remediation Time**: ~4-6 hours for all fixes
**Complexity**: MEDIUM - Issues are clear and fixable
