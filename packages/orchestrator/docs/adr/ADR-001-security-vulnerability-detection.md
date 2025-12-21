# ADR-001: Security Vulnerability Detection with CVE Pattern Matching

## Status
Proposed

## Date
2024-12-20

## Context

The `MaintenanceAnalyzer` currently has basic security vulnerability detection that only counts vulnerabilities without providing detailed analysis. The acceptance criteria require:

1. **CVE Pattern Detection**: Parse CVE identifiers in the standard format `CVE-YYYY-NNNNN` (e.g., CVE-2021-44228)
2. **Severity Categorization**: Classify vulnerabilities as critical, high, medium, or low
3. **CVSS Score Parsing**: Extract and parse CVSS scores when available
4. **Enhanced Vulnerability Information**: Populate the existing `SecurityVulnerability` interface

### Current State Analysis

The codebase already has the necessary type infrastructure:

```typescript
// From packages/orchestrator/src/idle-processor.ts
export type VulnerabilitySeverity = 'critical' | 'high' | 'medium' | 'low';

export interface SecurityVulnerability {
  name: string;           // Package name affected
  cveId: string;          // CVE identifier (e.g., "CVE-2021-44228")
  severity: VulnerabilitySeverity;
  affectedVersions: string;
  description: string;
}

export interface ProjectAnalysis {
  dependencies: {
    security: string[];  // @deprecated - legacy format
    securityIssues?: SecurityVulnerability[];  // Rich format (underutilized)
    // ...
  };
}
```

The `MaintenanceAnalyzer` currently only uses the deprecated `security: string[]` field.

## Decision

### 1. Architecture Overview

Create a dedicated `SecurityVulnerabilityParser` utility class that:
- Parses CVE patterns from various input sources
- Extracts and validates CVSS scores
- Maps CVSS scores to severity levels
- Returns structured `SecurityVulnerability` objects

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          MaintenanceAnalyzer                            │
│                                                                         │
│  ┌──────────────────────┐    ┌───────────────────────────────────────┐ │
│  │  analyze() method    │───>│  SecurityVulnerabilityParser          │ │
│  │                      │    │                                       │ │
│  │  - Calls npm audit   │    │  - parseCVE(input: string)           │ │
│  │  - Processes output  │    │  - parseCVSSScore(input: string)     │ │
│  │  - Generates tasks   │    │  - severityFromCVSS(score: number)   │ │
│  └──────────────────────┘    │  - parseVulnerability(data: object)  │ │
│                              │  - parseNpmAuditOutput(json: object) │ │
│                              └───────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2. CVE Pattern Matching

The CVE identifier format follows the standard: `CVE-YYYY-NNNNN[N...]`

```typescript
// Regular expression for CVE pattern matching
const CVE_PATTERN = /CVE-(\d{4})-(\d{4,})/gi;

// Examples matched:
// - CVE-2021-44228 (Log4Shell)
// - CVE-2023-12345
// - CVE-2024-000001 (extended format)
```

### 3. CVSS Score Parsing and Severity Mapping

CVSS (Common Vulnerability Scoring System) scores range from 0.0 to 10.0:

| CVSS Score | Severity  | Priority in Tasks |
|------------|-----------|-------------------|
| 9.0 - 10.0 | Critical  | urgent            |
| 7.0 - 8.9  | High      | high              |
| 4.0 - 6.9  | Medium    | normal            |
| 0.1 - 3.9  | Low       | low               |

```typescript
function severityFromCVSS(score: number): VulnerabilitySeverity {
  if (score >= 9.0) return 'critical';
  if (score >= 7.0) return 'high';
  if (score >= 4.0) return 'medium';
  return 'low';
}
```

### 4. Integration with npm audit

The `IdleProcessor.analyzeDependencies()` method will be enhanced to:

1. Run `npm audit --json` to get structured vulnerability data
2. Parse the JSON output using `SecurityVulnerabilityParser`
3. Populate both legacy `security: string[]` and new `securityIssues: SecurityVulnerability[]` fields

```typescript
interface NpmAuditVulnerability {
  name: string;
  severity: string;
  via: Array<{
    source?: number;
    name?: string;
    dependency?: string;
    title?: string;
    url?: string;
    severity?: string;
    cwe?: string[];
    cvss?: { score: number; vectorString?: string };
    range?: string;
  }>;
  effects: string[];
  range: string;
  nodes: string[];
  fixAvailable: boolean | { name: string; version: string; isSemVerMajor: boolean };
}
```

### 5. File Structure

```
packages/orchestrator/src/
├── analyzers/
│   ├── maintenance-analyzer.ts        # Enhanced to use SecurityVulnerabilityParser
│   └── ...
├── utils/
│   └── security-vulnerability-parser.ts  # NEW: CVE parsing utilities
└── idle-processor.ts                   # Enhanced analyzeDependencies()

packages/orchestrator/src/__tests__/   (or co-located)
├── utils/
│   └── security-vulnerability-parser.test.ts  # NEW: Unit tests
└── analyzers/
    └── maintenance-analyzer-security.test.ts  # NEW: Integration tests
```

### 6. Enhanced MaintenanceAnalyzer Output

The analyzer will generate more actionable tasks:

```typescript
// For critical vulnerabilities
candidates.push(this.createCandidate(
  'security-critical-CVE-2021-44228',
  'Fix Critical Security Vulnerability: CVE-2021-44228',
  `Critical vulnerability (CVSS 10.0) in log4j@2.14.1: Remote code execution...`,
  {
    priority: 'urgent',
    effort: 'high',
    workflow: 'maintenance',
    rationale: 'CVSS 10.0 - Remote code execution vulnerability requires immediate patching',
    score: 1.0,
  }
));
```

## Technical Design

### SecurityVulnerabilityParser Class

```typescript
/**
 * Security Vulnerability Parser
 *
 * Parses CVE identifiers, CVSS scores, and vulnerability data
 * from various input sources (npm audit, manual entries, etc.)
 */
export class SecurityVulnerabilityParser {
  // CVE pattern: CVE-YYYY-NNNNN (4+ digits after year)
  private static readonly CVE_PATTERN = /CVE-(\d{4})-(\d{4,})/gi;

  // CVSS score pattern: matches "CVSS: 9.8" or "cvss": {"score": 9.8}
  private static readonly CVSS_PATTERN = /(?:cvss[:\s]*)?(\d+(?:\.\d+)?)/i;

  /**
   * Extract all CVE identifiers from a string
   */
  static extractCVEs(input: string): string[] { ... }

  /**
   * Validate a CVE identifier format
   */
  static isValidCVE(cveId: string): boolean { ... }

  /**
   * Parse CVSS score from various formats
   */
  static parseCVSSScore(input: string | number | object): number | null { ... }

  /**
   * Map CVSS score to severity level
   */
  static severityFromCVSS(score: number): VulnerabilitySeverity { ... }

  /**
   * Infer severity from string labels (fallback when CVSS unavailable)
   */
  static parseSeverityLabel(label: string): VulnerabilitySeverity { ... }

  /**
   * Parse npm audit JSON output into SecurityVulnerability[]
   */
  static parseNpmAuditOutput(auditJson: object): SecurityVulnerability[] { ... }

  /**
   * Create a SecurityVulnerability from partial data
   */
  static createVulnerability(data: Partial<SecurityVulnerability> & { name: string }): SecurityVulnerability { ... }
}
```

### Enhanced IdleProcessor.analyzeDependencies()

```typescript
private async analyzeDependencies(): Promise<ProjectAnalysis['dependencies']> {
  const outdated: string[] = [];
  const security: string[] = [];
  const securityIssues: SecurityVulnerability[] = [];

  try {
    // Existing package.json analysis...

    // Enhanced: Run npm audit for security vulnerabilities
    try {
      const { stdout } = await this.execAsync('npm audit --json 2>/dev/null || echo "{}"');
      const auditData = JSON.parse(stdout);

      // Parse using the new utility
      const vulnerabilities = SecurityVulnerabilityParser.parseNpmAuditOutput(auditData);
      securityIssues.push(...vulnerabilities);

      // Populate legacy field for backward compatibility
      for (const vuln of vulnerabilities) {
        security.push(`${vuln.name}@${vuln.affectedVersions} (${vuln.cveId || vuln.severity})`);
      }
    } catch {
      // npm audit not available or failed
    }
  } catch {
    // No package.json or can't read it
  }

  return { outdated, security, securityIssues };
}
```

### Enhanced MaintenanceAnalyzer.analyze()

```typescript
analyze(analysis: ProjectAnalysis): TaskCandidate[] {
  const candidates: TaskCandidate[] = [];

  // Use rich securityIssues data if available, fall back to legacy
  const vulnerabilities = analysis.dependencies.securityIssues ?? [];

  if (vulnerabilities.length > 0) {
    // Group by severity for prioritized task generation
    const bySeverity = this.groupBySeverity(vulnerabilities);

    // Critical vulnerabilities get individual urgent tasks
    for (const critical of bySeverity.critical) {
      candidates.push(this.createSecurityTask(critical, 'urgent', 1.0));
    }

    // High vulnerabilities grouped if many, individual if few
    if (bySeverity.high.length > 0) {
      candidates.push(this.createSecurityGroupTask(bySeverity.high, 'high', 0.9));
    }

    // Medium/Low as aggregate tasks
    // ...
  } else if (analysis.dependencies.security.length > 0) {
    // Fallback to legacy handling
    // ...
  }

  return candidates;
}
```

## Test Strategy

### Unit Tests for SecurityVulnerabilityParser

```typescript
describe('SecurityVulnerabilityParser', () => {
  describe('extractCVEs', () => {
    it('should extract single CVE from text', () => {
      expect(extractCVEs('Found CVE-2021-44228 in log4j'))
        .toEqual(['CVE-2021-44228']);
    });

    it('should extract multiple CVEs', () => {
      expect(extractCVEs('CVE-2021-44228 and CVE-2023-12345'))
        .toEqual(['CVE-2021-44228', 'CVE-2023-12345']);
    });

    it('should handle extended CVE format (5+ digits)', () => {
      expect(extractCVEs('CVE-2024-000001'))
        .toEqual(['CVE-2024-000001']);
    });

    it('should return empty array for no CVEs', () => {
      expect(extractCVEs('No vulnerabilities found')).toEqual([]);
    });

    it('should be case insensitive', () => {
      expect(extractCVEs('cve-2021-44228'))
        .toEqual(['CVE-2021-44228']); // Normalized to uppercase
    });
  });

  describe('severityFromCVSS', () => {
    it('should return critical for 9.0-10.0', () => {
      expect(severityFromCVSS(9.0)).toBe('critical');
      expect(severityFromCVSS(10.0)).toBe('critical');
    });

    it('should return high for 7.0-8.9', () => {
      expect(severityFromCVSS(7.0)).toBe('high');
      expect(severityFromCVSS(8.9)).toBe('high');
    });

    it('should return medium for 4.0-6.9', () => {
      expect(severityFromCVSS(4.0)).toBe('medium');
      expect(severityFromCVSS(6.9)).toBe('medium');
    });

    it('should return low for 0.1-3.9', () => {
      expect(severityFromCVSS(0.1)).toBe('low');
      expect(severityFromCVSS(3.9)).toBe('low');
    });

    it('should handle edge cases', () => {
      expect(severityFromCVSS(0)).toBe('low');
      expect(severityFromCVSS(-1)).toBe('low'); // Defensive
      expect(severityFromCVSS(11)).toBe('critical'); // Above max
    });
  });

  describe('parseNpmAuditOutput', () => {
    it('should parse npm audit v2 format', () => { ... });
    it('should handle missing CVSS data gracefully', () => { ... });
    it('should extract CVE from via.url field', () => { ... });
  });
});
```

### Integration Tests for MaintenanceAnalyzer

```typescript
describe('MaintenanceAnalyzer - Security Vulnerabilities', () => {
  it('should generate urgent task for critical vulnerability', () => {
    const analysis = createAnalysisWithVulnerability({
      name: 'log4j',
      cveId: 'CVE-2021-44228',
      severity: 'critical',
      affectedVersions: '<2.15.0',
      description: 'Remote code execution vulnerability',
    });

    const candidates = analyzer.analyze(analysis);
    const criticalTask = candidates.find(c => c.candidateId.includes('CVE-2021-44228'));

    expect(criticalTask).toBeDefined();
    expect(criticalTask?.priority).toBe('urgent');
    expect(criticalTask?.score).toBe(1.0);
    expect(criticalTask?.title).toContain('Critical');
    expect(criticalTask?.description).toContain('CVE-2021-44228');
  });

  it('should group multiple high severity vulnerabilities', () => { ... });
  it('should fall back to legacy format when securityIssues empty', () => { ... });
  it('should handle mixed severity levels correctly', () => { ... });
});
```

## Consequences

### Positive
1. **Better Prioritization**: Critical CVEs get immediate attention with urgent priority
2. **Actionable Information**: Tasks include CVE IDs for easy reference and remediation
3. **CVSS-based Scoring**: Objective severity assessment based on industry standard
4. **Backward Compatibility**: Legacy `security: string[]` field still populated
5. **Testability**: Parser isolated in utility class for comprehensive unit testing

### Negative
1. **npm Dependency**: Full functionality requires npm and `npm audit` command
2. **Network Dependency**: `npm audit` requires network access to vulnerability database
3. **Additional Complexity**: New utility class and enhanced parsing logic

### Risks and Mitigations
| Risk | Mitigation |
|------|------------|
| npm audit not available | Graceful fallback to legacy string parsing |
| Malformed CVE patterns | Strict regex validation with clear error messages |
| Missing CVSS scores | Fallback to severity label parsing |
| Performance impact | Lazy loading of security analysis |

## Alternatives Considered

### 1. Direct npm audit Integration in MaintenanceAnalyzer
- **Rejected**: Would bloat the analyzer with parsing logic
- **Chosen Instead**: Separate utility class for better testability and reuse

### 2. External Vulnerability Database API
- **Rejected**: Would add external dependency and network requirements
- **Chosen Instead**: Parse npm audit output which uses npm's built-in database

### 3. CVSS Vector String Parsing
- **Deferred**: Could be added later for advanced use cases
- **Current**: Focus on score-based severity mapping

## Implementation Plan

1. **Phase 1**: Create `SecurityVulnerabilityParser` utility with CVE pattern matching
2. **Phase 2**: Enhance `IdleProcessor.analyzeDependencies()` to run npm audit
3. **Phase 3**: Update `MaintenanceAnalyzer` to use rich vulnerability data
4. **Phase 4**: Comprehensive unit and integration tests
5. **Phase 5**: Documentation updates

## References

- [CVE Numbering Authority (CNA) Rules](https://cve.mitre.org/cve/cna/rules.html)
- [CVSS v3.1 Specification](https://www.first.org/cvss/v3.1/specification-document)
- [npm audit documentation](https://docs.npmjs.com/cli/v10/commands/npm-audit)
