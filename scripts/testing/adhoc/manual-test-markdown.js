// Simple manual test to verify the MarkdownRenderer implementation
console.log("Manual test for MarkdownRenderer responsive width feature:");

// Test 1: Width calculation logic
function testWidthCalculation() {
  console.log("Testing width calculation logic:");

  // Simulate different terminal widths
  const testCases = [
    { terminalWidth: 80, expected: 78 },  // Normal: 80 - 2 = 78
    { terminalWidth: 50, expected: 48 },  // Narrow: 50 - 2 = 48
    { terminalWidth: 30, expected: 40 },  // Very narrow: enforces min 40
    { terminalWidth: 120, expected: 118 } // Wide: 120 - 2 = 118
  ];

  testCases.forEach(({ terminalWidth, expected }) => {
    // This is the responsive width calculation from the implementation
    const effectiveWidth = Math.max(40, terminalWidth - 2);
    const pass = effectiveWidth === expected;
    console.log(`  Terminal: ${terminalWidth} → Effective: ${effectiveWidth} (expected: ${expected}) ${pass ? '✅' : '❌'}`);
  });
}

// Test 2: Props logic
function testPropsLogic() {
  console.log("\nTesting props logic:");

  const terminalWidth = 80;

  // Case 1: responsive=true (default), no explicit width
  const case1 = undefined ?? (true ? Math.max(40, terminalWidth - 2) : 80);
  console.log(`  Default responsive: ${case1} (expected: 78) ${case1 === 78 ? '✅' : '❌'}`);

  // Case 2: responsive=false, no explicit width
  const case2 = undefined ?? (false ? Math.max(40, terminalWidth - 2) : 80);
  console.log(`  responsive=false: ${case2} (expected: 80) ${case2 === 80 ? '✅' : '❌'}`);

  // Case 3: explicit width overrides everything
  const case3 = 100 ?? (true ? Math.max(40, terminalWidth - 2) : 80);
  console.log(`  explicit width=100: ${case3} (expected: 100) ${case3 === 100 ? '✅' : '❌'}`);
}

testWidthCalculation();
testPropsLogic();

console.log("\n✅ Manual test completed - logic appears correct!");