#!/usr/bin/env node

/**
 * Verification script for React Flow installation
 */

console.log('🔍 Verifying React Flow installation...\n')

try {
  // Check package.json
  const fs = await import('fs')
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'))

  console.log('✅ Package.json check:')
  console.log(`   - @xyflow/react: ${packageJson.dependencies['@xyflow/react']}`)

  // Check if node_modules exists (try local first, then root)
  const localPath = 'node_modules/@xyflow/react'
  const rootPath = '../../node_modules/@xyflow/react'

  if (fs.existsSync(localPath) || fs.existsSync(rootPath)) {
    const location = fs.existsSync(localPath) ? 'local' : 'root'
    console.log(`✅ Node modules check: @xyflow/react is installed (${location})`)
  } else {
    console.log('❌ Node modules check: @xyflow/react not found')
    process.exit(1)
  }

  // Check if main files exist
  const mainFilesToCheck = [
    'src/components/graphs/DependencyGraph.tsx',
    'src/components/graphs/index.ts',
    'src/types/dependency-graph.ts',
    'src/components/graphs/__tests__/DependencyGraph.test.ts',
    'src/app/test-react-flow/page.tsx'
  ]

  console.log('✅ Source files check:')
  for (const file of mainFilesToCheck) {
    if (fs.existsSync(file)) {
      console.log(`   - ${file}: ✓`)
    } else {
      console.log(`   - ${file}: ❌`)
      process.exit(1)
    }
  }

  console.log('\n🎉 React Flow installation verification successful!')
  console.log('\nNext steps:')
  console.log('1. Start the development server: npm run dev')
  console.log('2. Visit http://localhost:3001/test-react-flow to see the test graph')
  console.log('3. Import and use DependencyGraph component in your pages')

} catch (error) {
  console.error('❌ Verification failed:', error.message)
  process.exit(1)
}