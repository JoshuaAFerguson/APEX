// Simple test to verify basic functionality
console.log('Starting simple Python extractor test...');

try {
  // Test a very simple case
  const testCode = `
def hello():
    return "world"
`;

  console.log('✅ Simple test setup complete');
  console.log('Test code to parse:', testCode);

  // The actual parsing would be done by the extractor
  // This is just to verify the setup is correct

} catch (error) {
  console.error('❌ Simple test failed:', error.message);
  process.exit(1);
}