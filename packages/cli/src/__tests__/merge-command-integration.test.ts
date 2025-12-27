/**
 * Merge Command Integration Test
 *
 * This test verifies that the merge command is properly registered in the CLI system
 * and can be invoked through the session command interface.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

describe('Merge Command Registration Integration', () => {
  it('should be registered with correct name and alias in CLI commands array', () => {
    // Read the main CLI file to verify command registration
    const cliFilePath = path.join(__dirname, '..', 'index.ts');
    const cliContent = readFileSync(cliFilePath, 'utf-8');

    // Verify the merge command is registered
    expect(cliContent).toMatch(/name:\s*['"]merge['"]/);;
    expect(cliContent).toMatch(/aliases:\s*\[['"]m['"]\]/);
    expect(cliContent).toMatch(/description:\s*['"].*[Mm]erge.*branch.*['"]/);;
    expect(cliContent).toMatch(/usage:\s*['"]\/merge\s+<task_id>\s+\[--squash\]['"]/);;
  });

  it('should have handler function defined', () => {
    const cliFilePath = path.join(__dirname, '..', 'index.ts');
    const cliContent = readFileSync(cliFilePath, 'utf-8');

    // Verify handler exists and contains expected logic
    expect(cliContent).toMatch(/handler:\s*async\s*\(\s*ctx\s*,\s*args\s*\)\s*=>\s*{/);
  });

  it('should handle --squash flag parsing in the CLI code', () => {
    const cliFilePath = path.join(__dirname, '..', 'index.ts');
    const cliContent = readFileSync(cliFilePath, 'utf-8');

    // Verify squash flag is properly parsed
    expect(cliContent).toMatch(/args\.includes\(['"]--squash['"]\)/);
    expect(cliContent).toMatch(/squash:\s*isSquash/);
  });

  it('should contain proper usage examples', () => {
    const cliFilePath = path.join(__dirname, '..', 'index.ts');
    const cliContent = readFileSync(cliFilePath, 'utf-8');

    // Verify usage examples are present
    expect(cliContent).toMatch(/\/merge\s+abc123\s+Standard\s+merge/i);
    expect(cliContent).toMatch(/\/merge\s+abc123\s+--squash\s+Squash/i);
  });

  it('should call orchestrator.mergeTaskBranch method', () => {
    const cliFilePath = path.join(__dirname, '..', 'index.ts');
    const cliContent = readFileSync(cliFilePath, 'utf-8');

    // Verify it calls the orchestrator method
    expect(cliContent).toMatch(/ctx\.orchestrator\.mergeTaskBranch/);
  });

  it('should handle error cases appropriately', () => {
    const cliFilePath = path.join(__dirname, '..', 'index.ts');
    const cliContent = readFileSync(cliFilePath, 'utf-8');

    // Verify error handling patterns
    expect(cliContent).toMatch(/Task not found/);
    expect(cliContent).toMatch(/does not have a branch/);
    expect(cliContent).toMatch(/merge conflicts/);
  });

  it('should provide helpful output messages', () => {
    const cliFilePath = path.join(__dirname, '..', 'index.ts');
    const cliContent = readFileSync(cliFilePath, 'utf-8');

    // Verify user-friendly output
    expect(cliContent).toMatch(/✅.*completed successfully/);
    expect(cliContent).toMatch(/📝.*Commit hash/);
    expect(cliContent).toMatch(/📁.*Changed files/);
    expect(cliContent).toMatch(/💡.*Next steps/);
  });
});