#!/usr/bin/env node

/**
 * Test runner for cli-guide verification tests
 * Runs the tests and generates a coverage report
 */

import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

console.log('🧪 Running CLI Guide Verification Tests...\n')

// Test files to run
const testFiles = [
  'packages/cli/src/__tests__/cli-guide-verification.test.ts',
  'packages/cli/src/__tests__/documentation-coverage.test.ts',
  'packages/cli/src/__tests__/verification-accuracy.test.ts'
]

// Run vitest with specific test files
const args = ['run', '--reporter=verbose', ...testFiles]

const vitest = spawn('npx', ['vitest', ...args], {
  cwd: __dirname,
  stdio: 'inherit'
})

vitest.on('close', (code) => {
  if (code === 0) {
    console.log('\n✅ All verification tests passed!')
    console.log('\n📊 Generating test coverage report...')

    // Generate coverage report
    const coverage = spawn('npx', ['vitest', 'run', '--coverage', ...testFiles], {
      cwd: __dirname,
      stdio: 'inherit'
    })

    coverage.on('close', (coverageCode) => {
      if (coverageCode === 0) {
        console.log('\n📈 Coverage report generated successfully!')
      } else {
        console.log('\n⚠️ Coverage report generation failed')
      }
    })
  } else {
    console.log('\n❌ Some tests failed')
    process.exit(code)
  }
})

vitest.on('error', (err) => {
  console.error('Failed to start test process:', err)
  process.exit(1)
})