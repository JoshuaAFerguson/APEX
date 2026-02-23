// Simple script to verify codebase intelligence exports
const path = require('path');

console.log('Testing codebase intelligence exports...');

try {
  // Try to require the main index from the source (since built might be stale)
  const sourcePath = path.join(__dirname, 'packages/orchestrator/src/index.js');
  console.log('Source path:', sourcePath);

  // Check if the source exists
  const fs = require('fs');
  if (fs.existsSync(sourcePath)) {
    console.log('Source index.js exists');
  } else {
    console.log('Source index.js does not exist, checking dist...');

    const distPath = path.join(__dirname, 'packages/orchestrator/dist/index.js');
    if (fs.existsSync(distPath)) {
      console.log('Dist index.js exists');

      // Try to load it
      const exports = require(distPath);

      // Check key exports
      console.log('CodebaseIntelligenceService:', !!exports.CodebaseIntelligenceService);
      console.log('createCodebaseIntelligenceService:', !!exports.createCodebaseIntelligenceService);
      console.log('getCodebaseIntelligenceService:', !!exports.getCodebaseIntelligenceService);
      console.log('CodebaseIndexer:', !!exports.CodebaseIndexer);
      console.log('SemanticSearch:', !!exports.SemanticSearch);
      console.log('TreeSitterWrapper:', !!exports.TreeSitterWrapper);

      console.log('Export verification completed successfully!');
    } else {
      console.log('Neither source nor dist index.js found');
    }
  }
} catch (error) {
  console.error('Error verifying exports:', error.message);
}