/**
 * Test Validation Script
 *
 * This script validates that the ADR test files can properly locate
 * and read the ADR documents for testing purposes.
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

interface AdrFile {
  path: string;
  filename: string;
  content: string;
  statusLine?: string;
  hasV030Reference?: boolean;
}

function findAdrDirectories(): string[] {
  const searchPaths = [
    join(process.cwd(), 'docs/adr'),
    join(process.cwd(), 'packages/cli/docs/adr'),
    join(__dirname, '../../../docs/adr'),
    join(__dirname, '../../../../docs/adr')
  ];

  return searchPaths.filter(path => existsSync(path));
}

function getAllAdrFiles(): AdrFile[] {
  const adrDirs = findAdrDirectories();
  const adrFiles: AdrFile[] = [];

  for (const dir of adrDirs) {
    try {
      const files = readdirSync(dir)
        .filter(f => f.toLowerCase().endsWith('.md') &&
                    (f.toLowerCase().includes('adr') || f.match(/^\d{3}-/)))
        .map(f => {
          const path = join(dir, f);
          const content = readFileSync(path, 'utf-8');
          const statusMatch = content.match(/##\s*Status\s*\n([^\n]*)|Status:\s*([^\n]*)|\*\*Status\*\*:\s*([^\n]*)/i);
          const statusLine = statusMatch ? (statusMatch[1] || statusMatch[2] || statusMatch[3])?.trim() : undefined;

          return {
            path,
            filename: f,
            content,
            statusLine,
            hasV030Reference: content.toLowerCase().includes('v0.3.0')
          };
        });

      adrFiles.push(...files);
    } catch (error) {
      console.warn(`Could not read ADR directory: ${dir}`);
    }
  }

  return adrFiles;
}

function validateTestTarget(): void {
  console.log('=== ADR Test Validation ===\n');

  // Find directories
  const adrDirs = findAdrDirectories();
  console.log(`Found ${adrDirs.length} ADR directories:`);
  adrDirs.forEach(dir => console.log(`  - ${dir}`));
  console.log();

  // Find ADR files
  const allAdrs = getAllAdrFiles();
  console.log(`Found ${allAdrs.length} ADR documents:`);
  allAdrs.forEach(adr => {
    console.log(`  - ${adr.filename}`);
    if (adr.statusLine) {
      console.log(`    Status: ${adr.statusLine}`);
    }
    if (adr.hasV030Reference) {
      console.log(`    ✓ Contains v0.3.0 references`);
    }
  });
  console.log();

  // Key ADRs for v0.3.0
  const keyAdrs = allAdrs.filter(adr =>
    adr.filename.includes('008') ||
    adr.filename.includes('009') ||
    adr.filename.includes('010') ||
    adr.content.toLowerCase().includes('agentpanel') ||
    adr.content.toLowerCase().includes('file path completion') ||
    adr.content.toLowerCase().includes('feature development technical design')
  );

  console.log(`Key v0.3.0 ADRs found: ${keyAdrs.length}`);
  keyAdrs.forEach(adr => {
    console.log(`\n--- ${adr.filename} ---`);
    console.log(`Path: ${adr.path}`);
    if (adr.statusLine) {
      console.log(`Status: ${adr.statusLine}`);
    }

    // Check for implementation indicators
    const content = adr.content.toLowerCase();
    const hasImplemented = content.includes('implemented');
    const hasAccepted = content.includes('accepted');
    const hasDecember = content.includes('december 2024');
    const hasV030Complete = content.includes('v0.3.0 complete');

    console.log(`Completion indicators:`);
    console.log(`  - Implemented: ${hasImplemented ? '✓' : '✗'}`);
    console.log(`  - Accepted: ${hasAccepted ? '✓' : '✗'}`);
    console.log(`  - December 2024: ${hasDecember ? '✓' : '✗'}`);
    console.log(`  - v0.3.0 Complete: ${hasV030Complete ? '✓' : '✗'}`);
  });

  console.log('\n=== Validation Complete ===');

  if (keyAdrs.length >= 3) {
    console.log('✅ All key ADRs found and accessible for testing');
  } else {
    console.log('⚠️  Some key ADRs may be missing or not accessible');
  }
}

// Run validation if this file is executed directly
if (require.main === module) {
  validateTestTarget();
}

export { findAdrDirectories, getAllAdrFiles, validateTestTarget };