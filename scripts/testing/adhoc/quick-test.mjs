import { execSync } from 'child_process';

const cwd = process.cwd();

try {
  process.chdir('packages/cli');
  console.log('Testing session management integration...');

  // First, try to compile TypeScript
  console.log('Checking TypeScript compilation...');
  execSync('npx tsc --noEmit --project .', { stdio: 'inherit' });
  console.log('✓ TypeScript compilation passed');

} catch (error) {
  console.error('✗ Test setup failed:', error.message);
  if (error.stdout) console.error(error.stdout);
  if (error.stderr) console.error(error.stderr);
  process.exit(1);
} finally {
  process.chdir(cwd);
}