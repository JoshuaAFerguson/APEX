/**
 * Simple test validation to check syntax and imports
 */
import { promises as fs } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function validateTests() {
  console.log('🔍 Validating test files...');

  const testFiles = [
    'src/codebase-analyzer/analyzers/__tests__/convention-analyzer-import-detection.test.ts',
    'src/codebase-analyzer/analyzers/__tests__/convention-analyzer-naming-edge-cases.test.ts'
  ];

  let allValid = true;

  for (const testFile of testFiles) {
    const filePath = join(__dirname, testFile);

    try {
      const content = await fs.readFile(filePath, 'utf-8');

      // Basic syntax checks
      const checks = [
        { name: 'Has imports', pattern: /import .+ from .+;/ },
        { name: 'Has describe blocks', pattern: /describe\(['"]/g },
        { name: 'Has test cases', pattern: /it\(['"]/g },
        { name: 'Uses expect assertions', pattern: /expect\(/g },
        { name: 'Validates schema', pattern: /ConventionAnalysisSchema\.parse/g },
        { name: 'Has async tests', pattern: /async \(\) => \{/ },
        { name: 'Creates test directories', pattern: /await fs\.mkdir/ },
        { name: 'Cleans up resources', pattern: /await fs\.rm/ }
      ];

      console.log(`\n📄 ${testFile}:`);

      for (const check of checks) {
        const matches = content.match(check.pattern);
        const count = matches ? matches.length : 0;
        const status = count > 0 ? '✅' : '❌';
        console.log(`  ${status} ${check.name}: ${count} occurrences`);

        if (count === 0 && check.name !== 'Validates schema') {
          allValid = false;
        }
      }

      // Check for specific import detection test patterns
      if (testFile.includes('import-detection')) {
        const importChecks = [
          { name: 'ES6 tests', pattern: /es6/gi },
          { name: 'CommonJS tests', pattern: /commonjs/gi },
          { name: 'AMD tests', pattern: /amd/gi },
          { name: 'UMD tests', pattern: /umd/gi },
          { name: 'Quote style tests', pattern: /(single|double).quote/gi },
          { name: 'Grouping tests', pattern: /(type-separate|source-separate|alphabetical)/gi }
        ];

        console.log(`  📋 Import-specific checks:`);
        for (const check of importChecks) {
          const matches = content.match(check.pattern);
          const count = matches ? matches.length : 0;
          const status = count > 0 ? '✅' : '❌';
          console.log(`    ${status} ${check.name}: ${count} references`);
        }
      }

      // Check for naming convention test patterns
      if (testFile.includes('naming-edge-cases')) {
        const namingChecks = [
          { name: 'Function naming tests', pattern: /function.+naming/gi },
          { name: 'Variable naming tests', pattern: /variable.+naming/gi },
          { name: 'Class naming tests', pattern: /class.+naming/gi },
          { name: 'Constant naming tests', pattern: /constant.+naming/gi },
          { name: 'File naming tests', pattern: /file.+naming/gi }
        ];

        console.log(`  📋 Naming-specific checks:`);
        for (const check of namingChecks) {
          const matches = content.match(check.pattern);
          const count = matches ? matches.length : 0;
          const status = count > 0 ? '✅' : '❌';
          console.log(`    ${status} ${check.name}: ${count} references`);
        }
      }

      console.log(`  📊 File size: ${content.length} characters`);
      console.log(`  📊 Test count: ${(content.match(/it\(/g) || []).length} tests`);

    } catch (error) {
      console.error(`❌ Error reading ${testFile}: ${error.message}`);
      allValid = false;
    }
  }

  console.log(`\n${allValid ? '✅' : '❌'} Overall validation: ${allValid ? 'PASSED' : 'FAILED'}`);

  return allValid;
}

// Run validation
validateTests().catch(console.error);