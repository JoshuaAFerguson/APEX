const { parseAgentMarkdown } = require('./packages/core/src/config.ts');

const markdown = `  ---
  name: whitespace-agent
  description:  A test agent with extra whitespace
  model:  sonnet
  tools:  Read,  Write
  ---
You are an agent with whitespace.`;

console.log('Testing markdown:');
console.log(JSON.stringify(markdown));
console.log('\nParsed result:');
const result = parseAgentMarkdown(markdown);
console.log(result);

// Test with simple case
const simpleMarkdown = `---
name: test
description: test
---
Test`;

console.log('\nTesting simple markdown:');
console.log(JSON.stringify(simpleMarkdown));
console.log('\nParsed result:');
const simpleResult = parseAgentMarkdown(simpleMarkdown);
console.log(simpleResult);