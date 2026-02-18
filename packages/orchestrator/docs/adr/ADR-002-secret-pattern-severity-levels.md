# ADR-002: Default Secret Patterns with Severity Levels

## Status
Proposed

## Context

The `SecretScanner` in `packages/orchestrator/src/scanner.ts` currently detects various secret patterns but lacks severity classification. Security findings without severity levels make it difficult for users to prioritize remediation efforts. We need to:

1. Add a `severity` field to the `SecretFinding` interface in `@apexcli/core`
2. Add a `severity` field to the `SecretPattern` interface
3. Update default patterns with appropriate severity levels based on security best practices
4. Ensure all patterns are well-tested with sample inputs

## Decision

### 1. Severity Level Type Definition

We will define a `SecretSeverity` type that aligns with CVSS scoring standards:

```typescript
export type SecretSeverity = 'critical' | 'high' | 'medium' | 'low';
```

Severity levels are assigned based on:
- **Critical**: Immediate, severe security risk (private keys, hardcoded production credentials)
- **High**: Direct credential exposure (cloud provider keys, database connection strings)
- **Medium**: Potential secret exposure requiring context (API keys, JWT tokens)
- **Low**: Possible secret patterns with high false positive rate

### 2. Interface Changes

#### 2.1 Update `SecretPattern` interface (scanner.ts)

```typescript
export interface SecretPattern {
  /** Name of the pattern for identification */
  name: string;
  /** Regular expression to match secrets */
  regex: RegExp;
  /** Type of secret this pattern detects */
  secretType: string;
  /** Confidence level of this pattern (0-1) */
  confidence: number;
  /** Description of what this pattern detects */
  description: string;
  /** Severity level of secrets matching this pattern */
  severity: SecretSeverity;  // NEW FIELD
}
```

#### 2.2 Update `SecretFinding` interface (core/types.ts)

```typescript
export interface SecretFinding {
  // ... existing fields ...
  /** Severity level of the finding */
  severity: SecretSeverity;  // NEW FIELD
}
```

### 3. Default Pattern Severity Assignments

Based on security best practices and the acceptance criteria:

| Pattern Name | Secret Type | Severity | Rationale |
|-------------|-------------|----------|-----------|
| `private-key` | private-key | **critical** | Direct access to cryptographic keys |
| `aws-access-key` | aws-access-key | **high** | Direct cloud infrastructure access |
| `aws-secret-key` | aws-secret-key | **high** | Direct cloud infrastructure access |
| `github-token` | github-token | **high** | Repository access, code modification |
| `github-classic-token` | github-token | **high** | Repository access, code modification |
| `password-field` | password | **high** | Direct authentication bypass |
| `database-url` | database-url | **high** | Database access, data exposure |
| `generic-api-key` | api-key | **medium** | Context-dependent access level |
| `jwt-token` | jwt-token | **medium** | Session/auth tokens, time-limited |
| `slack-token` | slack-token | **medium** | Workspace access, less critical |
| `base64-secret` | base64-secret | **medium** | Encoded secrets, context-dependent |
| `high-entropy-string` | generic-secret | **low** | High false positive rate |

### 4. Implementation Changes

#### 4.1 scanner.ts - Add severity to SecretPattern interface

Add the severity field and export the SecretSeverity type.

#### 4.2 scanner.ts - Update getBuiltInPatterns()

Each pattern in the array must include the `severity` field based on the assignments table above.

#### 4.3 scanner.ts - Propagate severity to findings

Update the `scan()` method to copy severity from the pattern to the finding:

```typescript
const finding: SecretFinding = {
  // ... existing fields ...
  severity: pattern.severity,  // NEW: Propagate severity
};
```

#### 4.4 core/types.ts - Add SecretSeverity type and update SecretFinding

Export the type and add the severity field to the interface.

### 5. Test Strategy

Each pattern must be tested with sample inputs verifying:
1. Pattern correctly matches expected input
2. Severity is properly assigned in findings
3. Severity propagation works correctly

Test categories:
- Critical severity patterns (private keys)
- High severity patterns (AWS keys, GitHub tokens, passwords, connection strings)
- Medium severity patterns (generic API keys, JWT tokens)
- Low severity patterns (high-entropy strings)

### 6. Backward Compatibility

The `severity` field will be required on `SecretPattern`. Existing custom patterns without severity will need to be updated. For transition:

1. Provide a migration guide in release notes
2. Consider adding a default severity of `'medium'` for backward compatibility
3. Log a deprecation warning when patterns without severity are used

For `SecretFinding`, the `severity` field will always be populated from the matching pattern.

## Implementation Order

1. **Phase 1: Type Updates** (core package)
   - Add `SecretSeverity` type to `packages/core/src/types.ts`
   - Add `severity` field to `SecretFinding` interface

2. **Phase 2: Pattern Updates** (orchestrator package)
   - Export `SecretSeverity` type from `scanner.ts`
   - Add `severity` field to `SecretPattern` interface
   - Update all built-in patterns with severity levels
   - Update `scan()` method to propagate severity

3. **Phase 3: Testing**
   - Add comprehensive tests for each pattern with sample inputs
   - Verify severity propagation in findings
   - Add integration tests for severity filtering

## File Changes Summary

| File | Changes |
|------|---------|
| `packages/core/src/types.ts` | Add `SecretSeverity` type, add `severity` to `SecretFinding` |
| `packages/orchestrator/src/scanner.ts` | Export `SecretSeverity`, add `severity` to `SecretPattern`, update patterns, update `scan()` |
| `packages/orchestrator/src/scanner.test.ts` | Add severity level tests |
| `packages/orchestrator/src/scanner.comprehensive.test.ts` | Add comprehensive severity tests |

## Consequences

### Positive
- Users can prioritize remediation based on severity
- Aligns with security industry standards (CVSS-style levels)
- Enables filtering and reporting by severity level
- Improves security posture visibility

### Negative
- Breaking change for custom patterns (must add severity)
- Slight increase in pattern definition complexity
- Requires careful severity assignment decisions

### Neutral
- Existing scan results will include severity information
- No change to scanning performance
