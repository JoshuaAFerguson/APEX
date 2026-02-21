// Diagnostic script to identify permission issues
const fs = require('fs');
const path = require('path');

console.log('🔍 Diagnosing detectFrameworks() implementation...');

// Check if the detectFrameworks method exists in the compiled code
try {
  const projectAnalyzerPath = './packages/core/dist/project-context-analyzer.js';
  if (fs.existsSync(projectAnalyzerPath)) {
    console.log('✅ project-context-analyzer.js exists');

    const content = fs.readFileSync(projectAnalyzerPath, 'utf8');

    // Check for key method signatures
    if (content.includes('detectFrameworks')) {
      console.log('✅ detectFrameworks method found in compiled code');
    } else {
      console.log('❌ detectFrameworks method NOT found in compiled code');
    }

    // Check for exports
    if (content.includes('exports.ProjectContextAnalyzer')) {
      console.log('✅ ProjectContextAnalyzer properly exported');
    } else {
      console.log('❌ ProjectContextAnalyzer export issue');
    }

    // Check for fast-glob dependency import
    if (content.includes('fast-glob')) {
      console.log('✅ fast-glob dependency found');
    } else {
      console.log('⚠️  fast-glob dependency not found in compiled code');
    }
  } else {
    console.log('❌ project-context-analyzer.js does not exist');
  }
} catch (error) {
  console.error('❌ Error reading compiled file:', error.message);
}

// Check test files
const testFiles = [
  './packages/core/src/__tests__/detect-frameworks-comprehensive.test.ts',
  './packages/core/src/__tests__/detect-frameworks-edge-cases.test.ts'
];

console.log('\n📋 Checking test files...');
testFiles.forEach(testFile => {
  if (fs.existsSync(testFile)) {
    console.log(`✅ ${path.basename(testFile)} exists`);
  } else {
    console.log(`❌ ${path.basename(testFile)} missing`);
  }
});

// Check source file
const sourceFile = './packages/core/src/project-context-analyzer.ts';
if (fs.existsSync(sourceFile)) {
  console.log('\n✅ Source file exists');

  const sourceContent = fs.readFileSync(sourceFile, 'utf8');

  // Check if detectFrameworks method is implemented
  if (sourceContent.includes('detectFrameworks(): Promise<FrameworkDetection>')) {
    console.log('✅ detectFrameworks method signature found');
  } else {
    console.log('❌ detectFrameworks method signature missing');
  }

  // Check for implementation body
  if (sourceContent.includes('async detectFrameworks()') || sourceContent.includes('detectFrameworks(): Promise')) {
    console.log('✅ detectFrameworks implementation found');
  } else {
    console.log('❌ detectFrameworks implementation missing');
  }
} else {
  console.log('❌ Source file missing');
}

// Check for node_modules and dependencies
console.log('\n📦 Checking dependencies...');
if (fs.existsSync('./node_modules/fast-glob')) {
  console.log('✅ fast-glob installed in root');
}
if (fs.existsSync('./packages/core/node_modules/fast-glob')) {
  console.log('✅ fast-glob installed in core package');
}

if (!fs.existsSync('./node_modules/fast-glob') && !fs.existsSync('./packages/core/node_modules/fast-glob')) {
  console.log('❌ fast-glob dependency missing');
}

// Check file permissions
console.log('\n🔐 Checking file permissions...');
try {
  const stats = fs.statSync('./packages/core/src/project-context-analyzer.ts');
  const mode = (stats.mode & parseInt('777', 8)).toString(8);
  console.log(`✅ Source file permissions: ${mode}`);

  if (fs.existsSync('./packages/core/dist/project-context-analyzer.js')) {
    const distStats = fs.statSync('./packages/core/dist/project-context-analyzer.js');
    const distMode = (distStats.mode & parseInt('777', 8)).toString(8);
    console.log(`✅ Compiled file permissions: ${distMode}`);
  }
} catch (error) {
  console.log('❌ Could not check file permissions:', error.message);
}

console.log('\n🏁 Diagnosis complete');