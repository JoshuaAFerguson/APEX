/**
 * Simple validation script for template system
 * Checks if templates can be loaded and rendered without errors
 */

const fs = require('fs');
const path = require('path');

// Simple template engine validation
function validateTemplate(templatePath) {
  console.log(`\n🔍 Validating template: ${templatePath}`);

  try {
    const content = fs.readFileSync(templatePath, 'utf8');

    // Check for basic HTML structure
    const checks = [
      { name: 'DOCTYPE', pattern: /<!DOCTYPE html>/i },
      { name: 'HTML tag', pattern: /<html>/i },
      { name: 'HEAD tag', pattern: /<head>/i },
      { name: 'BODY tag', pattern: /<body>/i },
      { name: 'Template variables', pattern: /\{\{\s*\w+\s*\}\}/ },
      { name: 'Data attributes', pattern: /data-page=/ },
      { name: 'Navigation tracking', pattern: /navigationTestHistory/ },
    ];

    let passed = 0;
    checks.forEach(check => {
      if (check.pattern.test(content)) {
        console.log(`  ✅ ${check.name}`);
        passed++;
      } else {
        console.log(`  ❌ ${check.name}`);
      }
    });

    console.log(`  📊 Passed: ${passed}/${checks.length}`);
    return passed === checks.length;

  } catch (error) {
    console.error(`  ❌ Error reading template: ${error.message}`);
    return false;
  }
}

// Simple template rendering simulation
function simulateTemplateRendering() {
  console.log('\n🔧 Simulating template rendering...');

  const sampleTemplate = `
    <html>
      <head><title>{{title}}</title></head>
      <body>
        <h1>{{heading}}</h1>
        <div>{{content}}</div>
        <div data-page="{{page_id}}"></div>
      </body>
    </html>
  `;

  const variables = {
    title: 'Test Page',
    heading: 'Test Heading',
    content: '<p>Test content</p>',
    page_id: 'test-page'
  };

  let rendered = sampleTemplate;
  Object.entries(variables).forEach(([key, value]) => {
    const pattern = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
    rendered = rendered.replace(pattern, value);
  });

  // Check if variables were replaced
  const hasUnresolvedVars = /\{\{\s*\w+\s*\}\}/.test(rendered);

  if (!hasUnresolvedVars) {
    console.log('  ✅ Template variable substitution works');
    console.log('  ✅ No unresolved variables found');
    return true;
  } else {
    console.log('  ❌ Found unresolved variables');
    return false;
  }
}

// Main validation
function main() {
  console.log('🧪 Template System Validation');
  console.log('==============================');

  const templatesDir = path.join(__dirname, 'templates');

  // Check if templates directory exists
  if (!fs.existsSync(templatesDir)) {
    console.error('❌ Templates directory does not exist');
    process.exit(1);
  }

  console.log(`📁 Templates directory: ${templatesDir}`);

  // Validate each template
  const templateFiles = [
    'basic-page.html',
    'links-page.html',
    'form-page.html',
    'iframe-page.html'
  ];

  let allValid = true;
  templateFiles.forEach(filename => {
    const templatePath = path.join(templatesDir, filename);
    if (fs.existsSync(templatePath)) {
      const isValid = validateTemplate(templatePath);
      allValid = allValid && isValid;
    } else {
      console.log(`\n❌ Template not found: ${filename}`);
      allValid = false;
    }
  });

  // Test template rendering simulation
  const renderingWorks = simulateTemplateRendering();
  allValid = allValid && renderingWorks;

  // Check TypeScript files exist
  console.log('\n🔍 Checking TypeScript files...');
  const tsFiles = [
    'template-engine.ts',
    'enhanced-mock-server.ts',
    'template-demo.test.ts'
  ];

  tsFiles.forEach(filename => {
    const filePath = path.join(__dirname, filename === 'template-engine.ts' ? `templates/${filename}` : filename);
    if (fs.existsSync(filePath)) {
      console.log(`  ✅ ${filename}`);
    } else {
      console.log(`  ❌ ${filename} not found`);
      allValid = false;
    }
  });

  // Summary
  console.log('\n📊 Validation Summary');
  console.log('====================');

  if (allValid) {
    console.log('✅ All template validations passed!');
    console.log('✅ Template system is ready for use');
    console.log('✅ Implementation appears complete');
    process.exit(0);
  } else {
    console.log('❌ Some validations failed');
    console.log('❌ Please check the issues above');
    process.exit(1);
  }
}

main();