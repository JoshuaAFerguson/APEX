# ADR: detectTestFrameworks() Enhancement for Multi-Language Support

## Status
Proposed

## Date
2026-02-21

## Context

The `detectTestFrameworks()` method in `ProjectContextAnalyzer` needs to be enhanced to support additional test frameworks as specified in the acceptance criteria:

**Acceptance Criteria:**
> detectTestFrameworks() detects Jest, Vitest, Mocha, Pytest, Cargo test, RSpec, JUnit. Returns test command and config path. Unit tests pass with >80% coverage.

**Current Implementation (12 frameworks):**
- Jest, Vitest, Mocha, Pytest ✅
- Playwright, Cypress, Karma, Jasmine ✅
- AVA, Tape, QUnit, Unittest ✅

**Missing (3 frameworks):**
- Cargo test (Rust) ❌
- RSpec (Ruby) ❌
- JUnit (Java) ❌

## Decision

### Approach: Extend Existing Framework Rules Array

We will extend the existing `testFrameworkRules` array in `detectTestFrameworks()` to add support for the three missing frameworks. This follows the established pattern already used for all 12 existing frameworks.

### Technical Design

#### 1. New Framework Detection Rules

```typescript
// Add to testFrameworkRules array (line 1328-1403)

// Cargo test (Rust)
{
  name: 'Cargo Test',
  packageNames: [],  // Rust uses Cargo.toml, not package.json
  configFiles: ['Cargo.toml'],
  testIndicators: ['tests/', 'src/lib.rs', 'src/main.rs'],
  runCommand: 'cargo test',
},

// RSpec (Ruby)
{
  name: 'RSpec',
  packageNames: [],  // Ruby uses Gemfile, not package.json
  configFiles: ['.rspec', 'spec/spec_helper.rb', 'spec/rails_helper.rb'],
  testIndicators: ['spec/', 'Gemfile'],
  runCommand: 'bundle exec rspec',
},

// JUnit (Java)
{
  name: 'JUnit',
  packageNames: [],  // Java uses Maven/Gradle, not package.json
  configFiles: ['pom.xml', 'build.gradle', 'build.gradle.kts'],
  testIndicators: ['src/test/java/', 'src/test/'],
  runCommand: 'mvn test',  // or 'gradle test' for Gradle projects
},
```

#### 2. Enhanced Detection Logic

For non-JavaScript frameworks, we need to enhance the detection to:
1. Check for language-specific manifest files (Cargo.toml, Gemfile, pom.xml)
2. Look for test directories (tests/, spec/, src/test/java/)
3. Detect framework-specific config files

The existing `testIndicators` pattern already supports this via:
- Directory checks: `indicator.endsWith('/')` → `fs.promises.stat()`
- File pattern checks: Uses `findConfigFiles()` method

#### 3. Return Type (Unchanged)

The return type remains the same - simplified structure meeting acceptance criteria:

```typescript
Promise<Array<{
  name: string;
  configFile?: string;
  runCommand: string;
}>>
```

### Interface Contract

```typescript
/**
 * Detect test frameworks in the project.
 * Returns simplified framework info with name, config file path, and run command.
 *
 * Supported frameworks:
 * - JavaScript/TypeScript: Jest, Vitest, Mocha, Playwright, Cypress, Karma, Jasmine, AVA, Tape, QUnit
 * - Python: Pytest, Unittest
 * - Rust: Cargo test
 * - Ruby: RSpec
 * - Java: JUnit
 *
 * Detection strategy (in order):
 * 1. Package manager dependencies (package.json, Gemfile, Cargo.toml, pom.xml)
 * 2. Configuration files (.rspec, pytest.ini, jest.config.js, etc.)
 * 3. Test directory patterns (tests/, spec/, src/test/java/)
 *
 * @returns Array of detected test frameworks with run commands
 */
async detectTestFrameworks(): Promise<Array<{
  name: string;
  configFile?: string;
  runCommand: string;
}>>
```

### File Changes Required

| File | Change Type | Description |
|------|-------------|-------------|
| `packages/core/src/project-context-analyzer.ts` | Modify | Add 3 new framework rules to `testFrameworkRules` array |
| `packages/core/src/__tests__/detect-test-frameworks.test.ts` | Modify | Add test cases for Cargo, RSpec, JUnit |
| `packages/core/src/__tests__/detect-test-frameworks-validation.test.ts` | Modify | Add acceptance criteria tests for new frameworks |

### Detection Logic Flowchart

```
detectTestFrameworks()
        │
        ▼
┌───────────────────┐
│ Load package.json │
│ (may be null)     │
└─────────┬─────────┘
          │
          ▼
┌─────────────────────────────────────┐
│ For each framework rule:            │
│                                     │
│ 1. Check package dependencies       │
│    (package.json, Gemfile, etc.)    │
│                                     │
│ 2. Check config files exist         │
│    (jest.config.js, .rspec, etc.)   │
│                                     │
│ 3. Check test indicators            │
│    (tests/, spec/, src/test/java/)  │
│                                     │
│ If detected → add to results        │
└─────────────────────────────────────┘
          │
          ▼
┌─────────────────────┐
│ Return array of:    │
│ { name, configFile, │
│   runCommand }      │
└─────────────────────┘
```

### Language-Specific Detection Enhancements

For detecting Rust, Ruby, and Java projects, we need to check for their manifest files:

#### Rust (Cargo)
- Manifest: `Cargo.toml`
- Test directory: `tests/`
- Inline tests: `#[cfg(test)]` in `*.rs` files
- Run command: `cargo test`

#### Ruby (RSpec)
- Manifest: `Gemfile` with `gem 'rspec'`
- Config: `.rspec`, `spec/spec_helper.rb`
- Test directory: `spec/`
- Run command: `bundle exec rspec`

#### Java (JUnit)
- Manifest: `pom.xml` or `build.gradle`
- Test directory: `src/test/java/`
- Run command: `mvn test` or `./gradlew test`

### Test Coverage Strategy

To achieve >80% coverage as required:

1. **Individual Framework Tests**: Test each of the 15 frameworks (12 existing + 3 new)
2. **Config File Variants**: Test all config file patterns for each framework
3. **Edge Cases**:
   - Missing manifest files
   - Multiple frameworks in same project
   - Framework without config file (detection via test directory)
4. **Language-Specific**:
   - Rust project with Cargo.toml
   - Ruby project with Gemfile and .rspec
   - Java project with Maven pom.xml
   - Java project with Gradle build.gradle

## Consequences

### Positive
- Meets all acceptance criteria requirements
- Extends support to 3 major programming ecosystems (Rust, Ruby, Java)
- Follows existing patterns - minimal code changes
- Maintains backward compatibility
- Clear, predictable detection behavior

### Negative
- Rust/Ruby/Java dependency detection requires file parsing (not package.json)
- Some frameworks may have multiple run commands (JUnit: mvn vs gradle)

### Risks
- False positives: Cargo.toml without tests might be detected
- Mitigation: Use `testIndicators` to require tests/ directory or test files

## Implementation Notes

1. **Priority**: Add frameworks in order of importance (Cargo → RSpec → JUnit)
2. **Testing**: Create isolated temp directories with language-specific project structures
3. **Build Verification**: Ensure `npm run build` passes after changes
4. **Coverage**: Run coverage report to verify >80% target

## Related Documents

- `packages/core/src/__tests__/REVIEW_FINDINGS.md` - Previous code review
- `packages/core/src/__tests__/detectTestFrameworks-test-summary.md` - Test documentation
