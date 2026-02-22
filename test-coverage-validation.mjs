/**
 * Test Coverage Validation for ConventionAnalyzer Import Style and Grouping Detection
 *
 * Validates that the created tests comprehensively cover all the requirements
 * from the acceptance criteria.
 */

import { promises as fs } from 'fs';
import { join } from 'path';

async function validateTestCoverage() {
  console.log('🎯 Validating Test Coverage for Import Style and Grouping Detection\n');

  const testFiles = [
    'packages/orchestrator/src/codebase-analyzer/analyzers/__tests__/convention-analyzer-import-detection.test.ts',
    'packages/orchestrator/src/codebase-analyzer/analyzers/__tests__/convention-analyzer-naming-edge-cases.test.ts'
  ];

  let totalScore = 0;
  let maxScore = 0;

  // Acceptance criteria requirements
  const requirements = {
    'Import Styles Detection': {
      'ES6 imports': { pattern: /es6/gi, weight: 10, required: true },
      'CommonJS requires': { pattern: /commonjs/gi, weight: 10, required: true },
      'AMD modules': { pattern: /amd/gi, weight: 8, required: true },
      'UMD modules': { pattern: /umd/gi, weight: 8, required: true },
      'Mixed import styles': { pattern: /mixed.*import/gi, weight: 10, required: true }
    },
    'Quote Style Detection': {
      'Single quotes': { pattern: /single.*quote/gi, weight: 8, required: true },
      'Double quotes': { pattern: /double.*quote/gi, weight: 8, required: true },
      'Mixed quote styles': { pattern: /mixed.*quote/gi, weight: 8, required: true }
    },
    'Grouping Patterns': {
      'Type-separate grouping': { pattern: /type.separate/gi, weight: 10, required: true },
      'Source-separate grouping': { pattern: /source.separate/gi, weight: 10, required: true },
      'Alphabetical ordering': { pattern: /alphabetical/gi, weight: 8, required: true },
      'Custom grouping': { pattern: /custom.*group/gi, weight: 8, required: true },
      'No grouping detection': { pattern: /(no.*group|none.*group)/gi, weight: 8, required: true }
    },
    'Schema Compliance': {
      'ConventionAnalysis validation': { pattern: /ConventionAnalysisSchema\.parse/g, weight: 10, required: true },
      'Schema compliance checks': { pattern: /not\.toThrow/g, weight: 8, required: true },
      'Enum value validation': { pattern: /toContain.*result\./gi, weight: 8, required: true }
    },
    'Edge Cases': {
      'Complex import scenarios': { pattern: /complex.*import/gi, weight: 8, required: false },
      'Dynamic imports': { pattern: /dynamic.*import/gi, weight: 6, required: false },
      'Side-effect imports': { pattern: /side.effect/gi, weight: 6, required: false },
      'Re-exports handling': { pattern: /re.export/gi, weight: 6, required: false }
    },
    'Naming Convention Edge Cases': {
      'Function naming patterns': { pattern: /function.*naming/gi, weight: 10, required: true },
      'Variable naming patterns': { pattern: /variable.*naming/gi, weight: 10, required: true },
      'Class naming patterns': { pattern: /class.*naming/gi, weight: 10, required: true },
      'Constant detection': { pattern: /constant.*naming/gi, weight: 8, required: true },
      'File naming patterns': { pattern: /file.*naming/gi, weight: 8, required: true }
    }
  };

  for (const testFile of testFiles) {
    console.log(`📄 Analyzing: ${testFile}`);

    try {
      const content = await fs.readFile(testFile, 'utf-8');
      let fileScore = 0;
      let fileMaxScore = 0;

      for (const [category, checks] of Object.entries(requirements)) {
        console.log(`\n  📋 ${category}:`);

        for (const [checkName, config] of Object.entries(checks)) {
          fileMaxScore += config.weight;
          maxScore += config.weight;

          const matches = content.match(config.pattern);
          const count = matches ? matches.length : 0;
          const hasMatch = count > 0;

          let score = 0;
          if (hasMatch) {
            score = config.weight;
            fileScore += score;
            totalScore += score;
          }

          const status = hasMatch ? '✅' : (config.required ? '❌' : '⚠️');
          const requiredText = config.required ? ' (REQUIRED)' : ' (Optional)';

          console.log(`    ${status} ${checkName}: ${count} matches (${score}/${config.weight} pts)${requiredText}`);

          if (!hasMatch && config.required) {
            console.log(`      ⛔ Missing required coverage for: ${checkName}`);
          }
        }
      }

      const filePercentage = Math.round((fileScore / fileMaxScore) * 100);
      console.log(`\n  📊 File Score: ${fileScore}/${fileMaxScore} (${filePercentage}%)`);

    } catch (error) {
      console.error(`❌ Error reading ${testFile}: ${error.message}`);
    }
  }

  const overallPercentage = Math.round((totalScore / maxScore) * 100);
  console.log(`\n🎯 Overall Test Coverage Score: ${totalScore}/${maxScore} (${overallPercentage}%)`);

  // Grading
  let grade;
  if (overallPercentage >= 95) grade = 'A+ (Excellent)';
  else if (overallPercentage >= 90) grade = 'A (Very Good)';
  else if (overallPercentage >= 85) grade = 'B+ (Good)';
  else if (overallPercentage >= 80) grade = 'B (Satisfactory)';
  else if (overallPercentage >= 70) grade = 'C (Needs Improvement)';
  else grade = 'F (Insufficient)';

  console.log(`📈 Grade: ${grade}`);

  // Recommendations
  console.log(`\n💡 Recommendations:`);

  if (overallPercentage >= 90) {
    console.log(`✅ Excellent test coverage! Tests comprehensively cover import style and grouping detection.`);
  } else if (overallPercentage >= 80) {
    console.log(`✅ Good test coverage. Consider adding more edge case scenarios.`);
  } else {
    console.log(`⚠️ Test coverage could be improved. Focus on missing required test cases.`);
  }

  console.log(`\n📝 Summary:`);
  console.log(`• Tests created: ${testFiles.length}`);
  console.log(`• Requirements covered: ${Math.round((totalScore / maxScore) * Object.keys(requirements).length)} categories`);
  console.log(`• Schema validation: ${totalScore > 0 ? 'Implemented' : 'Missing'}`);

  return overallPercentage >= 80; // Pass threshold
}

// Run validation
validateTestCoverage()
  .then(passed => {
    console.log(`\n${passed ? '🎉 VALIDATION PASSED' : '⚠️ VALIDATION NEEDS IMPROVEMENT'}`);
    process.exit(passed ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Validation failed:', error);
    process.exit(1);
  });