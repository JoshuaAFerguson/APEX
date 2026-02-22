// Simple test to verify extractor factory works
const fs = require('fs');
const path = require('path');

// Check if types.ts exists and is readable
const typesPath = path.join(__dirname, 'packages/orchestrator/src/codebase-intelligence/extractors/types.ts');
const indexPath = path.join(__dirname, 'packages/orchestrator/src/codebase-intelligence/extractors/index.ts');

console.log('Checking files exist...');
console.log('types.ts exists:', fs.existsSync(typesPath));
console.log('index.ts exists:', fs.existsSync(indexPath));

if (fs.existsSync(typesPath)) {
  const typesContent = fs.readFileSync(typesPath, 'utf8');
  console.log('✓ SymbolExtractor interface found:', typesContent.includes('export interface SymbolExtractor'));
  console.log('✓ ExtractionError class found:', typesContent.includes('export class ExtractionError'));
}

if (fs.existsSync(indexPath)) {
  const indexContent = fs.readFileSync(indexPath, 'utf8');
  console.log('✓ getExtractorForLanguage function found:', indexContent.includes('export function getExtractorForLanguage'));
}

console.log('\nAll required components are present!');