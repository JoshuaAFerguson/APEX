#!/usr/bin/env node
/**
 * Quick validation script to test security vulnerability detection features
 * Verifies the build works and core functionality is operational
 */

const path = require('path');

// Import from built dist
const { SecurityVulnerabilityParser } = require('./packages/orchestrator/dist/utils/security-vulnerability-parser.js');

console.log('🔍 Validating Security Vulnerability Detection Features...\n');

let passed = 0;
let failed = 0;

function test(name, testFn) {
  try {
    testFn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (error) {
    console.log(`❌ ${name}: ${error.message}`);
    failed++;
  }
}

// Test 1: CVE extraction
test('CVE Pattern Matching', () => {
  const result = SecurityVulnerabilityParser.extractCVEs('Found CVE-2021-44228 and CVE-2023-12345');
  if (result.length !== 2 || !result.includes('CVE-2021-44228') || !result.includes('CVE-2023-12345')) {
    throw new Error(`Expected 2 CVEs, got ${result.length}: ${result.join(', ')}`);
  }
});

// Test 2: CVSS score parsing and severity
test('CVSS Score Parsing', () => {
  const score = SecurityVulnerabilityParser.parseCVSSScore(9.8);
  if (score !== 9.8) {
    throw new Error(`Expected 9.8, got ${score}`);
  }
});

test('Severity Categorization', () => {
  const critical = SecurityVulnerabilityParser.severityFromCVSS(9.8);
  const high = SecurityVulnerabilityParser.severityFromCVSS(8.0);
  const medium = SecurityVulnerabilityParser.severityFromCVSS(5.0);
  const low = SecurityVulnerabilityParser.severityFromCVSS(2.0);

  if (critical !== 'critical' || high !== 'high' || medium !== 'medium' || low !== 'low') {
    throw new Error(`Severity categorization failed: ${critical}, ${high}, ${medium}, ${low}`);
  }
});

// Test 3: CVE validation
test('CVE Validation', () => {
  const valid = SecurityVulnerabilityParser.isValidCVE('CVE-2021-44228');
  const invalid = SecurityVulnerabilityParser.isValidCVE('CVE-21-1234');

  if (!valid || invalid) {
    throw new Error(`CVE validation failed: valid=${valid}, invalid=${invalid}`);
  }
});

// Test 4: Vulnerability object creation
test('Vulnerability Object Creation', () => {
  const vuln = SecurityVulnerabilityParser.createVulnerability({
    name: 'test-package',
    cveId: 'CVE-2024-12345',
    severity: 'high'
  });

  if (!vuln.name || !vuln.cveId || !vuln.severity || !vuln.description || !vuln.affectedVersions) {
    throw new Error(`Incomplete vulnerability object: ${JSON.stringify(vuln)}`);
  }
});

// Test 5: npm audit parsing
test('npm Audit Output Parsing', () => {
  const mockAudit = {
    vulnerabilities: {
      'lodash': {
        name: 'lodash',
        severity: 'high',
        via: [{
          title: 'Command Injection',
          cvss: { score: 7.2 },
          severity: 'high',
          range: '<4.17.21'
        }]
      }
    }
  };

  const result = SecurityVulnerabilityParser.parseNpmAuditOutput(mockAudit);
  if (result.length !== 1 || result[0].name !== 'lodash' || result[0].severity !== 'high') {
    throw new Error(`npm audit parsing failed: ${JSON.stringify(result)}`);
  }
});

// Test 6: Edge cases
test('Edge Case Handling', () => {
  // Empty input
  const empty = SecurityVulnerabilityParser.extractCVEs('');
  if (empty.length !== 0) {
    throw new Error(`Expected empty array for empty input, got ${empty.length}`);
  }

  // Invalid CVSS
  const invalidScore = SecurityVulnerabilityParser.parseCVSSScore('invalid');
  if (invalidScore !== null) {
    throw new Error(`Expected null for invalid CVSS, got ${invalidScore}`);
  }

  // Malformed audit
  const malformed = SecurityVulnerabilityParser.parseNpmAuditOutput({});
  if (!Array.isArray(malformed) || malformed.length !== 0) {
    throw new Error(`Expected empty array for malformed audit, got ${malformed}`);
  }
});

console.log('\n' + '='.repeat(50));
console.log(`Test Results: ${passed} passed, ${failed} failed`);

if (failed === 0) {
  console.log('\n🎉 All security vulnerability detection features are working correctly!');
  console.log('\n📋 Validated Features:');
  console.log('✅ CVE pattern matching (CVE-YYYY-NNNNN format)');
  console.log('✅ CVSS score parsing from various input formats');
  console.log('✅ Severity categorization (critical/high/medium/low)');
  console.log('✅ CVE identifier validation');
  console.log('✅ Vulnerability object creation with defaults');
  console.log('✅ npm audit output parsing');
  console.log('✅ Edge case and error handling');

  console.log('\n✨ Security vulnerability detection feature is fully functional!');
  process.exit(0);
} else {
  console.log('\n❌ Some tests failed. Please check the implementation.');
  process.exit(1);
}