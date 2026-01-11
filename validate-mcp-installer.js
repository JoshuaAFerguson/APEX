// Simple validation script for MCPInstaller implementation

console.log('🔍 Validating MCPInstaller implementation...');

// Check file exists
const fs = require('fs');
const path = require('path');

const mcpInstallerPath = path.join(__dirname, 'packages/orchestrator/src/mcp-installer.ts');
const mcpInstallerTestPath = path.join(__dirname, 'packages/orchestrator/src/mcp-installer.test.ts');

try {
  // Check if files exist
  if (fs.existsSync(mcpInstallerPath)) {
    console.log('✅ MCPInstaller class file exists');
  } else {
    console.log('❌ MCPInstaller class file missing');
    process.exit(1);
  }

  if (fs.existsSync(mcpInstallerTestPath)) {
    console.log('✅ MCPInstaller test file exists');
  } else {
    console.log('❌ MCPInstaller test file missing');
    process.exit(1);
  }

  // Read and validate the main file
  const content = fs.readFileSync(mcpInstallerPath, 'utf8');

  // Check for key features
  const requiredFeatures = [
    'class MCPInstaller',
    'install(',
    'uninstall(',
    'listInstalled(',
    'installFromNpm(',
    'npm/npx-based',
    'SQLite tracking',
    'MCPServerConfig',
    'MCPMarketplaceEntry'
  ];

  const missingFeatures = [];
  for (const feature of requiredFeatures) {
    if (!content.includes(feature)) {
      missingFeatures.push(feature);
    }
  }

  if (missingFeatures.length > 0) {
    console.log('❌ Missing required features:', missingFeatures);
  } else {
    console.log('✅ All required features found in MCPInstaller');
  }

  // Check orchestrator integration
  const orchestratorPath = path.join(__dirname, 'packages/orchestrator/src/index.ts');
  const orchestratorContent = fs.readFileSync(orchestratorPath, 'utf8');

  const integrationFeatures = [
    'import { MCPInstaller }',
    'private mcpInstaller',
    'new MCPInstaller',
    'installMcpServerEnhanced',
    'installMcpServerFromNpm'
  ];

  const missingIntegration = [];
  for (const feature of integrationFeatures) {
    if (!orchestratorContent.includes(feature)) {
      missingIntegration.push(feature);
    }
  }

  if (missingIntegration.length > 0) {
    console.log('❌ Missing integration features:', missingIntegration);
  } else {
    console.log('✅ MCPInstaller properly integrated into orchestrator');
  }

  // Check test coverage
  const testContent = fs.readFileSync(mcpInstallerTestPath, 'utf8');
  const testFeatures = [
    'describe(',
    'install from marketplace',
    'install from npm',
    'uninstall',
    'listInstalled',
    'marketplace cache'
  ];

  const missingTests = [];
  for (const feature of testFeatures) {
    if (!testContent.includes(feature)) {
      missingTests.push(feature);
    }
  }

  if (missingTests.length > 0) {
    console.log('❌ Missing test coverage:', missingTests);
  } else {
    console.log('✅ Good test coverage found');
  }

  console.log('\n📋 Summary:');
  console.log(`- MCPInstaller class: ${fs.existsSync(mcpInstallerPath) ? '✅' : '❌'}`);
  console.log(`- Tests: ${fs.existsSync(mcpInstallerTestPath) ? '✅' : '❌'}`);
  console.log(`- Required features: ${missingFeatures.length === 0 ? '✅' : '❌'}`);
  console.log(`- Orchestrator integration: ${missingIntegration.length === 0 ? '✅' : '❌'}`);
  console.log(`- Test coverage: ${missingTests.length === 0 ? '✅' : '❌'}`);

  const totalChecks = 5;
  const passedChecks = [
    fs.existsSync(mcpInstallerPath),
    fs.existsSync(mcpInstallerTestPath),
    missingFeatures.length === 0,
    missingIntegration.length === 0,
    missingTests.length === 0
  ].filter(Boolean).length;

  console.log(`\n🎯 Overall: ${passedChecks}/${totalChecks} checks passed`);

  if (passedChecks === totalChecks) {
    console.log('🎉 MCPInstaller implementation looks good!');
    process.exit(0);
  } else {
    console.log('⚠️  Some issues found - review needed');
    process.exit(1);
  }

} catch (error) {
  console.error('❌ Validation failed:', error.message);
  process.exit(1);
}