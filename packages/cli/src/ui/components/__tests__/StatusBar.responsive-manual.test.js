// Manual test to verify the responsive StatusBar implementation
// This is a simple validation script to check basic functionality

const testStatusBarLogic = () => {
  console.log('Testing responsive StatusBar logic...');

  // Simulate segment priorities
  const PRIORITY_BY_TIER = {
    narrow: ['critical', 'high'],
    normal: ['critical', 'high', 'medium'],
    wide: ['critical', 'high', 'medium', 'low'],
  };

  // Test priority filtering
  const testSegments = [
    { id: 'connection', priority: 'critical', side: 'left' },
    { id: 'gitBranch', priority: 'high', side: 'left' },
    { id: 'agent', priority: 'high', side: 'left' },
    { id: 'workflowStage', priority: 'medium', side: 'left' },
    { id: 'sessionName', priority: 'low', side: 'left' },
    { id: 'timer', priority: 'critical', side: 'right' },
    { id: 'cost', priority: 'high', side: 'right' },
    { id: 'tokens', priority: 'medium', side: 'right' },
    { id: 'apiUrl', priority: 'low', side: 'right' },
  ];

  // Test narrow tier filtering
  const narrowFiltered = testSegments.filter(s =>
    PRIORITY_BY_TIER.narrow.includes(s.priority)
  );
  console.log('Narrow tier segments:', narrowFiltered.map(s => s.id));

  // Should show: connection, gitBranch, agent, timer, cost
  const expectedNarrow = ['connection', 'gitBranch', 'agent', 'timer', 'cost'];
  const actualNarrow = narrowFiltered.map(s => s.id);
  const narrowTest = expectedNarrow.every(id => actualNarrow.includes(id)) &&
                    actualNarrow.length === expectedNarrow.length;
  console.log('Narrow tier test:', narrowTest ? 'PASS' : 'FAIL');

  // Test normal tier filtering
  const normalFiltered = testSegments.filter(s =>
    PRIORITY_BY_TIER.normal.includes(s.priority)
  );
  console.log('Normal tier segments:', normalFiltered.map(s => s.id));

  // Should show: all narrow + workflowStage, tokens
  const expectedNormal = [...expectedNarrow, 'workflowStage', 'tokens'];
  const actualNormal = normalFiltered.map(s => s.id);
  const normalTest = expectedNormal.every(id => actualNormal.includes(id)) &&
                     actualNormal.length === expectedNormal.length;
  console.log('Normal tier test:', normalTest ? 'PASS' : 'FAIL');

  // Test wide tier filtering
  const wideFiltered = testSegments.filter(s =>
    PRIORITY_BY_TIER.wide.includes(s.priority)
  );
  console.log('Wide tier segments:', wideFiltered.map(s => s.id));

  // Should show all segments
  const expectedWide = testSegments.map(s => s.id);
  const actualWide = wideFiltered.map(s => s.id);
  const wideTest = expectedWide.every(id => actualWide.includes(id)) &&
                   actualWide.length === expectedWide.length;
  console.log('Wide tier test:', wideTest ? 'PASS' : 'FAIL');

  // Test abbreviations
  const LABEL_ABBREVIATIONS = {
    'tokens:': 'tk:',
    'cost:': '', // Cost shows just value
    'model:': 'm:',
    'api:': '→',
    'web:': '↗',
  };

  const testAbbrev = (label, expected) => {
    const result = LABEL_ABBREVIATIONS[label];
    const test = result === expected;
    console.log(`Abbreviation test for "${label}":`, test ? 'PASS' : 'FAIL');
    return test;
  };

  testAbbrev('tokens:', 'tk:');
  testAbbrev('cost:', '');
  testAbbrev('model:', 'm:');
  testAbbrev('api:', '→');
  testAbbrev('web:', '↗');

  console.log('Manual tests completed!');
};

// Only run if this file is executed directly (not imported)
if (typeof module !== 'undefined' && require.main === module) {
  testStatusBarLogic();
}

module.exports = { testStatusBarLogic };