import { safeSerialize } from './packages/core/src/utils.js';

// Reproduce the failing test scenario
const parent = { type: 'parent', children: [] };
const child1 = { type: 'child1', parent: parent };
const child2 = { type: 'child2', parent: parent };

parent.children.push(child1, child2);
child1.sibling = child2;
child2.sibling = child1;

console.log('Original objects:');
console.log('parent:', { type: parent.type, children: parent.children.map(c => ({ type: c.type })) });
console.log('child1:', { type: child1.type, parent: child1.parent.type, sibling: child1.sibling.type });
console.log('child2:', { type: child2.type, parent: child2.parent.type, sibling: child2.sibling.type });

const result = safeSerialize(parent);
console.log('\nSerialized result:', result);

const parsed = JSON.parse(result);
console.log('\nParsed result:');
console.log('parsed.type:', parsed.type);
console.log('parsed.children[0]:', parsed.children[0]);
console.log('parsed.children[1]:', parsed.children[1]);