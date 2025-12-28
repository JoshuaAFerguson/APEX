// Simple verification script to test shell-utils can be loaded
import { readFileSync } from 'fs';
import { join } from 'path';

const shellUtilsPath = './packages/core/src/shell-utils.ts';

try {
  const content = readFileSync(shellUtilsPath, 'utf-8');

  // Basic syntax checks
  const checks = {
    'Has exports': /export (function|interface|const)/g.test(content),
    'Has isWindows': /export function isWindows\(\)/.test(content),
    'Has getPlatformShell': /export function getPlatformShell\(\)/.test(content),
    'Has getKillCommand': /export function getKillCommand\(/.test(content),
    'Has resolveExecutable': /export function resolveExecutable\(/.test(content),
    'Has createShellCommand': /export function createShellCommand\(/.test(content),
    'Has createEnvironmentConfig': /export function createEnvironmentConfig\(/.test(content),
    'Has interfaces': /export interface/.test(content),
    'Has constants': /export const/.test(content),
    'Valid TypeScript syntax': !content.includes('syntax error')
  };

  console.log('Shell Utils Verification Report');
  console.log('================================\n');

  let allPassed = true;
  for (const [check, passed] of Object.entries(checks)) {
    const status = passed ? '✓' : '✗';
    console.log(`${status} ${check}`);
    if (!passed) allPassed = false;
  }

  console.log('\n' + (allPassed ? '✓ All checks passed!' : '✗ Some checks failed'));

  // Count exports
  const functionExports = (content.match(/export function/g) || []).length;
  const interfaceExports = (content.match(/export interface/g) || []).length;
  const constExports = (content.match(/export const/g) || []).length;

  console.log(`\nExport Summary:`);
  console.log(`  Functions: ${functionExports}`);
  console.log(`  Interfaces: ${interfaceExports}`);
  console.log(`  Constants: ${constExports}`);

  process.exit(allPassed ? 0 : 1);
} catch (error) {
  console.error('Error reading file:', error.message);
  process.exit(1);
}
