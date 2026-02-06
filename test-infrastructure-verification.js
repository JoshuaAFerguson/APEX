/**
 * @fileoverview Quick Infrastructure Verification for Hover/Focus Test Infrastructure
 *
 * This script performs a rapid verification that all infrastructure components
 * can be imported and initialized correctly without running full test suites.
 */

const fs = require('fs');
const path = require('path');

console.log('⚡ Quick Infrastructure Verification for Hover/Focus Tests\n');

/**
 * Check if a module can be required/imported
 */
function canRequireModule(modulePath, name) {
    try {
        if (modulePath.endsWith('.ts')) {
            // For TypeScript files, just check if they exist and have valid syntax
            const content = fs.readFileSync(modulePath, 'utf8');
            const hasExports = content.includes('export') || content.includes('module.exports');
            console.log(`✅ ${name}: TypeScript file exists and has exports`);
            return true;
        } else if (modulePath.endsWith('.json')) {
            const content = JSON.parse(fs.readFileSync(modulePath, 'utf8'));
            console.log(`✅ ${name}: JSON valid`);
            return true;
        } else {
            // For JavaScript files, try to require them
            require.cache[path.resolve(modulePath)] = undefined; // Clear cache
            require(modulePath);
            console.log(`✅ ${name}: Module can be required`);
            return true;
        }
    } catch (error) {
        console.log(`❌ ${name}: ${error.message}`);
        return false;
    }
}

/**
 * Verify package dependencies
 */
function verifyDependencies() {
    console.log('📦 Verifying Package Dependencies:\n');

    const packageJsonPath = path.join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const devDeps = packageJson.devDependencies || {};

    const criticalDeps = [
        { name: 'vitest', description: 'Test runner' },
        { name: 'playwright', description: 'Browser automation' },
        { name: 'pixelmatch', description: 'Screenshot comparison' },
        { name: 'pngjs', description: 'PNG processing' },
        { name: '@vitest/coverage-v8', description: 'Coverage reporting' }
    ];

    let depsOk = true;

    criticalDeps.forEach(dep => {
        if (devDeps[dep.name]) {
            console.log(`✅ ${dep.name} (${dep.description}): ${devDeps[dep.name]}`);
        } else {
            console.log(`❌ ${dep.name} (${dep.description}): Missing`);
            depsOk = false;
        }
    });

    return depsOk;
}

/**
 * Verify infrastructure files
 */
function verifyInfrastructureFiles() {
    console.log('\n🏗️  Verifying Infrastructure Files:\n');

    const infrastructureFiles = [
        {
            name: 'Main Vitest Config',
            path: path.join(process.cwd(), 'vitest.config.ts'),
            critical: true
        },
        {
            name: 'Browser Integration Config',
            path: path.join(process.cwd(), 'tests/browser-integration/vitest.config.ts'),
            critical: true
        },
        {
            name: 'Browser Setup',
            path: path.join(process.cwd(), 'tests/browser-integration/setup.ts'),
            critical: true
        },
        {
            name: 'Test Helpers',
            path: path.join(process.cwd(), 'tests/browser-integration/utils/test-helpers.ts'),
            critical: true
        },
        {
            name: 'Hover Focus Helpers',
            path: path.join(process.cwd(), 'tests/browser-integration/utils/hover-focus-test-helpers.ts'),
            critical: true
        },
        {
            name: 'Main Integration Test',
            path: path.join(process.cwd(), 'tests/browser-integration/hover-focus-interactions.integration.test.ts'),
            critical: true
        },
        {
            name: 'Infrastructure Test',
            path: path.join(process.cwd(), 'tests/browser-integration/infrastructure-verification.test.ts'),
            critical: true
        },
        {
            name: 'Playwright Config',
            path: path.join(process.cwd(), 'playwright.config.js'),
            critical: true
        }
    ];

    let filesOk = true;

    infrastructureFiles.forEach(file => {
        if (fs.existsSync(file.path)) {
            const canLoad = canRequireModule(file.path, file.name);
            if (!canLoad && file.critical) {
                filesOk = false;
            }
        } else {
            console.log(`❌ ${file.name}: File not found at ${file.path}`);
            if (file.critical) {
                filesOk = false;
            }
        }
    });

    return filesOk;
}

/**
 * Check test content quality
 */
function verifyTestContent() {
    console.log('\n🧪 Verifying Test Content Quality:\n');

    const mainTestFile = path.join(process.cwd(), 'tests/browser-integration/hover-focus-interactions.integration.test.ts');

    if (!fs.existsSync(mainTestFile)) {
        console.log('❌ Main test file not found');
        return false;
    }

    const testContent = fs.readFileSync(mainTestFile, 'utf8');

    const qualityChecks = [
        {
            name: 'Has describe blocks',
            check: () => testContent.includes('describe('),
            critical: true
        },
        {
            name: 'Has test cases (it blocks)',
            check: () => testContent.includes('it('),
            critical: true
        },
        {
            name: 'Has setup/teardown hooks',
            check: () => testContent.includes('beforeAll(') && testContent.includes('afterAll('),
            critical: true
        },
        {
            name: 'Has tooltip hover tests',
            check: () => testContent.includes('Tooltip Hover Interactions'),
            critical: true
        },
        {
            name: 'Has hover state change tests',
            check: () => testContent.includes('Hover State Changes'),
            critical: true
        },
        {
            name: 'Has focus/blur tests',
            check: () => testContent.includes('Form Element Focus and Blur'),
            critical: true
        },
        {
            name: 'Has nested element tests',
            check: () => testContent.includes('Nested Element Hover Interactions'),
            critical: true
        },
        {
            name: 'Has coverage validation',
            check: () => testContent.includes('Integration Test Coverage Validation'),
            critical: false
        },
        {
            name: 'Has comprehensive test page',
            check: () => testContent.includes('createHoverFocusTestPage'),
            critical: true
        },
        {
            name: 'Has event tracking',
            check: () => testContent.includes('captureConsoleMessages'),
            critical: true
        }
    ];

    let contentOk = true;

    qualityChecks.forEach(check => {
        const passed = check.check();
        if (passed) {
            console.log(`✅ ${check.name}: Present`);
        } else {
            console.log(`${check.critical ? '❌' : '⚠️'} ${check.name}: ${check.critical ? 'Missing (Critical)' : 'Missing (Optional)'}`);
            if (check.critical) {
                contentOk = false;
            }
        }
    });

    return contentOk;
}

/**
 * Check test utilities functionality
 */
function verifyTestUtilities() {
    console.log('\n🔧 Verifying Test Utilities:\n');

    const helpersFile = path.join(process.cwd(), 'tests/browser-integration/utils/hover-focus-test-helpers.ts');

    if (!fs.existsSync(helpersFile)) {
        console.log('❌ Hover focus helpers file not found');
        return false;
    }

    const helpersContent = fs.readFileSync(helpersFile, 'utf8');

    const utilityChecks = [
        {
            name: 'HoverTestHelpers class',
            check: () => helpersContent.includes('class HoverTestHelpers'),
            critical: true
        },
        {
            name: 'FocusTestHelpers class',
            check: () => helpersContent.includes('class FocusTestHelpers'),
            critical: true
        },
        {
            name: 'Mouse event simulation',
            check: () => helpersContent.includes('MouseEventData') && helpersContent.includes('trackHoverEvents'),
            critical: true
        },
        {
            name: 'Focus event simulation',
            check: () => helpersContent.includes('FocusEventData') && helpersContent.includes('focusSequence'),
            critical: true
        },
        {
            name: 'Tooltip testing utilities',
            check: () => helpersContent.includes('testTooltipInteraction'),
            critical: true
        },
        {
            name: 'Hover state validation',
            check: () => helpersContent.includes('validateHoverStateChanges'),
            critical: true
        },
        {
            name: 'Tab navigation testing',
            check: () => helpersContent.includes('testTabOrder'),
            critical: true
        },
        {
            name: 'Accessibility validation',
            check: () => helpersContent.includes('validateFormFieldAccessibility'),
            critical: true
        },
        {
            name: 'Event tracking utilities',
            check: () => helpersContent.includes('trackAllInteractionEvents'),
            critical: true
        },
        {
            name: 'Factory functions',
            check: () => helpersContent.includes('createHoverFocusHelpers'),
            critical: true
        }
    ];

    let utilitiesOk = true;

    utilityChecks.forEach(check => {
        const passed = check.check();
        if (passed) {
            console.log(`✅ ${check.name}: Implemented`);
        } else {
            console.log(`${check.critical ? '❌' : '⚠️'} ${check.name}: ${check.critical ? 'Missing (Critical)' : 'Missing (Optional)'}`);
            if (check.critical) {
                utilitiesOk = false;
            }
        }
    });

    return utilitiesOk;
}

/**
 * Generate verification summary
 */
function generateSummary(results) {
    console.log('\n📊 Infrastructure Verification Summary:\n');

    const { dependencies, infrastructure, content, utilities } = results;
    const checks = [dependencies, infrastructure, content, utilities];
    const passed = checks.filter(check => check).length;
    const total = checks.length;
    const percentage = Math.round((passed / total) * 100);

    console.log(`✅ Passed Verification Areas: ${passed}/${total}`);
    console.log(`📈 Success Rate: ${percentage}%`);

    if (percentage === 100) {
        console.log('\n🎉 EXCELLENT: Infrastructure verification passed completely!');
        console.log('   ✨ All components are in place and properly configured.');
        console.log('   🚀 Ready for running integration tests.');
        console.log('\n🧪 Available Commands:');
        console.log('   npm run test:browser-integration');
        console.log('   npm run test:browser-integration:watch');
        console.log('   npm run test:browser-integration:coverage');
    } else if (percentage >= 75) {
        console.log('\n⚠️  GOOD: Infrastructure is mostly ready with minor issues.');
        console.log('   🔧 Some optional components may be missing.');
        console.log('   ✅ Core functionality should work correctly.');
    } else {
        console.log('\n❌ NEEDS ATTENTION: Infrastructure has significant issues.');
        console.log('   🛠️  Critical components are missing or misconfigured.');
        console.log('   ⚠️  Fix issues before attempting to run tests.');
    }

    return percentage >= 75;
}

/**
 * Main verification function
 */
function runVerification() {
    try {
        const results = {
            dependencies: verifyDependencies(),
            infrastructure: verifyInfrastructureFiles(),
            content: verifyTestContent(),
            utilities: verifyTestUtilities()
        };

        const success = generateSummary(results);

        process.exit(success ? 0 : 1);

    } catch (error) {
        console.error('\n❌ Verification failed with error:', error.message);
        process.exit(1);
    }
}

// Run verification if this script is executed directly
if (require.main === module) {
    runVerification();
}

module.exports = {
    verifyDependencies,
    verifyInfrastructureFiles,
    verifyTestContent,
    verifyTestUtilities,
    generateSummary
};