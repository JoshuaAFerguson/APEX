/**
 * Simple smoke test to verify Python extractor functionality
 * This can be run manually to validate the implementation
 */

import { PythonExtractor } from './python-extractor.js';
import { SymbolKind } from './types.js';
import { SupportedLanguage } from '../parsers/types.js';

async function runSmokeTest() {
  console.log('🔍 Starting Python Extractor Smoke Test...');

  const extractor = PythonExtractor.getInstance();

  // Test 1: Simple function
  const simpleCode = `
def hello_world():
    """A simple greeting function."""
    print("Hello, World!")
    return "Hello"
`;

  try {
    console.log('\n📝 Test 1: Simple function extraction');
    const result1 = await extractor.extract(simpleCode, SupportedLanguage.Python);

    console.log(`   ✅ Extracted ${result1.symbols.length} symbol(s)`);
    console.log(`   ✅ First symbol: ${result1.symbols[0]?.name} (${result1.symbols[0]?.kind})`);
    console.log(`   ✅ Has documentation: ${!!result1.symbols[0]?.documentation}`);
    console.log(`   ✅ Extraction time: ${result1.extractionTimeMs}ms`);

    if (result1.symbols[0]?.name === 'hello_world' && result1.symbols[0]?.kind === SymbolKind.Function) {
      console.log('   ✅ Function extraction: PASS');
    } else {
      console.log('   ❌ Function extraction: FAIL');
    }
  } catch (error) {
    console.error('   ❌ Test 1 failed:', error);
  }

  // Test 2: Class with methods
  const classCode = `
class Calculator:
    """A simple calculator class."""

    def __init__(self, initial_value: float = 0.0):
        self.value = initial_value

    def add(self, x: float) -> float:
        """Add a number to the current value."""
        self.value += x
        return self.value

    @property
    def current_value(self) -> float:
        """Get the current value."""
        return self.value
`;

  try {
    console.log('\n📝 Test 2: Class with methods extraction');
    const result2 = await extractor.extract(classCode, SupportedLanguage.Python);

    console.log(`   ✅ Extracted ${result2.symbols.length} symbol(s)`);

    const classSymbol = result2.symbols.find(s => s.kind === SymbolKind.Class);
    if (classSymbol) {
      console.log(`   ✅ Class found: ${classSymbol.name}`);
      console.log(`   ✅ Methods found: ${classSymbol.children?.length || 0}`);

      const hasInit = classSymbol.children?.some(c => c.name === '__init__');
      const hasAdd = classSymbol.children?.some(c => c.name === 'add');
      const hasProperty = classSymbol.children?.some(c => c.modifiers.includes('property'));

      console.log(`   ✅ Has __init__: ${hasInit}`);
      console.log(`   ✅ Has add method: ${hasAdd}`);
      console.log(`   ✅ Has property: ${hasProperty}`);

      if (hasInit && hasAdd && hasProperty) {
        console.log('   ✅ Class extraction: PASS');
      } else {
        console.log('   ❌ Class extraction: FAIL');
      }
    } else {
      console.log('   ❌ No class found');
    }
  } catch (error) {
    console.error('   ❌ Test 2 failed:', error);
  }

  // Test 3: Error handling
  console.log('\n📝 Test 3: Error handling');
  try {
    await extractor.extract('def invalid_syntax(', SupportedLanguage.Python);
    console.log('   ✅ Invalid syntax handled gracefully');
  } catch (error) {
    console.error('   ❌ Test 3 failed:', error);
  }

  // Test 4: Language validation
  console.log('\n📝 Test 4: Language validation');
  try {
    await extractor.extract('function test() {}', 'javascript' as SupportedLanguage);
    console.log('   ❌ Should have rejected non-Python language');
  } catch (error) {
    if (error instanceof Error && error.message.includes('PythonExtractor only supports Python')) {
      console.log('   ✅ Language validation: PASS');
    } else {
      console.error('   ❌ Unexpected error:', error);
    }
  }

  console.log('\n🎉 Smoke test complete!');
}

// Run if this file is executed directly
if (require.main === module) {
  runSmokeTest().catch(console.error);
}

export { runSmokeTest };