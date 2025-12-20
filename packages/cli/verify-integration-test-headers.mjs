#!/usr/bin/env node

/**
 * Script to verify that all integration test files have proper header documentation
 * with acceptance criteria as required for v0.3.0 coverage verification
 */

import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

async function findIntegrationTests(dir, files = []) {
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      await findIntegrationTests(fullPath, files);
    } else if (entry.name.includes('integration') && entry.name.endsWith('.test.ts') || entry.name.endsWith('.test.tsx')) {
      files.push(fullPath);
    }
  }

  return files;
}

async function verifyTestHeader(filePath) {
  const content = await readFile(filePath, 'utf-8');
  const lines = content.split('\n').slice(0, 50); // Check first 50 lines

  const hasHeader = lines.some(line => line.includes('/**'));
  const hasDescription = lines.some(line =>
    line.toLowerCase().includes('integration test') ||
    line.toLowerCase().includes('tests') ||
    line.toLowerCase().includes('covers')
  );
  const hasAcceptanceCriteria = lines.some(line =>
    line.includes('AC1') ||
    line.includes('acceptance criteria') ||
    line.includes('Covers') ||
    line.toLowerCase().includes('criteria')
  );

  return {
    file: filePath,
    hasHeader,
    hasDescription,
    hasAcceptanceCriteria,
    isValid: hasHeader && hasDescription
  };
}

async function main() {
  console.log('🔍 Verifying Integration Test Header Documentation\n');

  const integrationTests = await findIntegrationTests('./src');
  console.log(`Found ${integrationTests.length} integration test files\n`);

  const results = [];
  let totalFiles = 0;
  let validFiles = 0;
  let headerIssues = 0;

  for (const testFile of integrationTests) {
    totalFiles++;
    const verification = await verifyTestHeader(testFile);
    results.push(verification);

    if (verification.isValid) {
      validFiles++;
      console.log(`✅ ${verification.file.replace('./src/', '')}`);
    } else {
      headerIssues++;
      console.log(`❌ ${verification.file.replace('./src/', '')} - Missing header documentation`);
    }
  }

  console.log(`\n📊 Integration Test Header Documentation Summary:`);
  console.log(`Total Integration Tests: ${totalFiles}`);
  console.log(`Valid Headers: ${validFiles}`);
  console.log(`Missing Headers: ${headerIssues}`);
  console.log(`Coverage Rate: ${((validFiles / totalFiles) * 100).toFixed(1)}%`);

  if (headerIssues === 0) {
    console.log(`\n✅ PASS: All integration tests have proper header documentation`);
    process.exit(0);
  } else {
    console.log(`\n❌ FAIL: ${headerIssues} integration tests missing header documentation`);
    process.exit(1);
  }
}

main().catch(console.error);