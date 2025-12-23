#!/usr/bin/env node
/**
 * Security Scoring Validation Script
 *
 * Quick validation to ensure security vulnerability scores are correct:
 * critical=1.0, high=0.9, medium=0.7, low=0.5
 */

import { MaintenanceAnalyzer } from './packages/orchestrator/dist/analyzers/maintenance-analyzer.js';

console.log('🔍 Validating Security Vulnerability Scoring...\n');

// Create minimal project analysis with test vulnerabilities
function createAnalysisWithVulnerabilities(vulnerabilities) {
  return {
    codebaseSize: { files: 100, lines: 10000, languages: { typescript: 8000 } },
    dependencies: { outdated: [], security: [], securityIssues: vulnerabilities },
    codeQuality: { lintIssues: 0, duplicatedCode: [], complexityHotspots: [], codeSmells: [] },
    documentation: {
      coverage: 50, missingDocs: [], outdatedSections: [],
      apiCompleteness: { percentage: 75, details: { totalEndpoints: 20, documentedEndpoints: 15, undocumentedItems: [], wellDocumentedExamples: [], commonIssues: [] } }
    },
    performance: { slowTests: [], bottlenecks: [] }
  };
}

// Test vulnerabilities for each severity level
const testVulnerabilities = [
  { name: 'critical-pkg', cveId: 'CVE-2024-0001', severity: 'critical', affectedVersions: '<1.0.0', description: 'Critical RCE vulnerability' },
  { name: 'high-pkg', cveId: 'CVE-2024-0002', severity: 'high', affectedVersions: '<1.0.0', description: 'High severity XSS' },
  { name: 'medium-pkg1', cveId: 'CVE-2024-0003', severity: 'medium', affectedVersions: '<1.0.0', description: 'Medium vulnerability 1' },
  { name: 'medium-pkg2', cveId: 'CVE-2024-0004', severity: 'medium', affectedVersions: '<1.0.0', description: 'Medium vulnerability 2' },
  { name: 'low-pkg1', cveId: 'CVE-2024-0005', severity: 'low', affectedVersions: '<1.0.0', description: 'Low severity issue 1' },
  { name: 'low-pkg2', cveId: 'CVE-2024-0006', severity: 'low', affectedVersions: '<1.0.0', description: 'Low severity issue 2' }
];

try {
  const analyzer = new MaintenanceAnalyzer();
  const analysis = createAnalysisWithVulnerabilities(testVulnerabilities);
  const candidates = analyzer.analyze(analysis);

  console.log('📊 Generated Tasks:');
  console.log('==================');

  const securityTasks = candidates.filter(c => c.candidateId.includes('security'));
  const sortedTasks = securityTasks.sort((a, b) => b.score - a.score);

  let allCorrect = true;

  sortedTasks.forEach(task => {
    const expected = {
      'urgent': { score: 1.0, severity: 'critical' },
      'high': { score: 0.9, severity: 'high' },
      'normal': { score: 0.7, severity: 'medium' },
      'low': { score: 0.5, severity: 'low' }
    }[task.priority];

    const isCorrect = Math.abs(task.score - expected.score) < 0.001;
    const status = isCorrect ? '✅' : '❌';

    if (!isCorrect) allCorrect = false;

    console.log(`${status} ${task.priority.toUpperCase().padEnd(8)} | Score: ${task.score.toFixed(1)} | Expected: ${expected.score.toFixed(1)} | ${task.title.substring(0, 50)}...`);
  });

  console.log('\n📋 Summary:');
  console.log('===========');

  const scoreMap = {
    1.0: 'Critical',
    0.9: 'High',
    0.7: 'Medium',
    0.5: 'Low'
  };

  const actualScores = [...new Set(sortedTasks.map(t => t.score))].sort((a, b) => b - a);
  const expectedScores = [1.0, 0.9, 0.7, 0.5];

  console.log('Expected scores:', expectedScores.map(s => `${scoreMap[s]}=${s}`).join(', '));
  console.log('Actual scores:  ', actualScores.map(s => `${scoreMap[s]}=${s}`).join(', '));

  const scoresMatch = JSON.stringify(actualScores) === JSON.stringify(expectedScores);
  console.log(`\n${scoresMatch && allCorrect ? '✅ SUCCESS' : '❌ FAILURE'}: Security vulnerability scoring ${scoresMatch && allCorrect ? 'is working correctly' : 'has issues'}\n`);

  if (scoresMatch && allCorrect) {
    console.log('🎉 All security vulnerability scores are correctly assigned:');
    console.log('   • Critical vulnerabilities: 1.0 (urgent priority)');
    console.log('   • High vulnerabilities: 0.9 (high priority)');
    console.log('   • Medium vulnerabilities: 0.7 (normal priority)');
    console.log('   • Low vulnerabilities: 0.5 (low priority)');
  }

  process.exit(scoresMatch && allCorrect ? 0 : 1);

} catch (error) {
  console.error('❌ Error during validation:', error.message);
  console.error('\nThis might indicate:');
  console.error('- Project not built (run: npm run build)');
  console.error('- Import path issues');
  console.error('- Missing dependencies\n');
  process.exit(1);
}