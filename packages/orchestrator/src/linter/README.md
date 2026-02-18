# Linter Plugin System

This module provides a foundation for implementing linter plugins in the APEX orchestration system. It defines standardized interfaces and base classes that allow different linting tools to be integrated consistently.

## Overview

The linter plugin system consists of:

- **`ILinterPlugin`** - Interface that all linter plugins must implement
- **`BaseLinterPlugin`** - Abstract base class providing common functionality
- **Type definitions** - Comprehensive TypeScript types for linting operations

## Core Components

### ILinterPlugin Interface

All linter plugins must implement this interface:

```typescript
interface ILinterPlugin {
  readonly metadata: LinterPluginMetadata;
  execute(options: LinterExecuteOptions): Promise<LintResult>;
  parse(output: string): LintIssue[];
  fix(issues: LintIssue[], options?: Pick<LinterExecuteOptions, 'cwd' | 'timeout'>): Promise<FixResult>;
  isAvailable(): Promise<boolean>;
  getToolVersion(): Promise<string | null>;
}
```

### BaseLinterPlugin Abstract Class

Provides common functionality for all linter implementations:

- Process spawning and management
- Output buffering with size limits
- Event emission for progress tracking
- Utility methods for common operations
- Error handling and timeouts

## Example Implementation

Here's how to create a custom linter plugin:

```typescript
import { BaseLinterPlugin, type LinterPluginMetadata, type LintResult, type LintIssue } from '@apexcli/orchestrator';

class ESLintPlugin extends BaseLinterPlugin {
  get metadata(): LinterPluginMetadata {
    return {
      id: 'eslint',
      name: 'ESLint',
      description: 'JavaScript/TypeScript linter',
      supportedExtensions: ['.js', '.jsx', '.ts', '.tsx'],
      supportsAutoFix: true,
      pluginVersion: '1.0.0',
    };
  }

  async execute(options: LinterExecuteOptions): Promise<LintResult> {
    const args = ['--format', 'json'];

    if (options.fix) {
      args.push('--fix');
    }

    if (options.files) {
      args.push(...options.files);
    }

    const result = await this.spawnProcess('eslint', args, {
      cwd: options.cwd,
      timeout: options.timeout,
    });

    const issues = this.parse(result.stdout);

    return this.createLintResult(
      issues,
      options.files?.length || 0,
      0 // duration would be calculated
    );
  }

  parse(output: string): LintIssue[] {
    try {
      const parsed = JSON.parse(output);
      return parsed.flatMap((file: any) =>
        file.messages.map((msg: any) => this.createIssue({
          filePath: file.filePath,
          line: msg.line,
          column: msg.column,
          severity: this.parseSeverity(msg.severity),
          ruleId: msg.ruleId,
          message: msg.message,
        }))
      );
    } catch {
      return [];
    }
  }

  async fix(issues: LintIssue[]): Promise<FixResult> {
    // Implementation for applying fixes
  }

  async isAvailable(): Promise<boolean> {
    return this.commandExists('eslint');
  }

  async getToolVersion(): Promise<string | null> {
    try {
      const result = await this.spawnProcess('eslint', ['--version']);
      return result.exitCode === 0 ? result.stdout.trim() : null;
    } catch {
      return null;
    }
  }
}
```

## Event System

Linter plugins emit events during execution:

```typescript
plugin.on('lint:started', (event) => {
  console.log(`Started linting with ${event.linterId}`);
});

plugin.on('lint:issue', (event) => {
  console.log(`Found issue: ${event.issue.message}`);
});

plugin.on('lint:completed', (event) => {
  console.log(`Completed linting: ${event.result.issues.length} issues found`);
});
```

## Type Definitions

### Core Types

- **`LintIssue`** - Represents a single linting issue
- **`LintResult`** - Result of running a linter
- **`FixResult`** - Result of applying fixes
- **`LinterExecuteOptions`** - Options for linter execution
- **`LinterPluginMetadata`** - Plugin information

### Severity Levels

- `error` - Critical issues that should block deployment
- `warning` - Important issues that should be addressed
- `info` - Informational messages
- `hint` - Suggestions for improvement

## Testing

The module includes comprehensive tests:

- **`plugin.test.ts`** - Unit tests for interfaces and base class
- **`integration.test.ts`** - Integration tests for plugin workflows

Run tests with:

```bash
npm test -- packages/orchestrator/src/linter
```

## Usage in APEX

Linter plugins integrate with the APEX orchestration system to provide automated code quality checks during development workflows. They can be configured per-project and executed as part of validation pipelines.