/**
 * Test fixtures for circular reference handling scenarios
 * Provides various circular reference patterns for comprehensive testing
 */

export interface CircularReferenceFixture {
  name: string;
  description: string;
  data: any;
  expectedBehavior: string;
}

/**
 * Collection of circular reference test fixtures
 */
export const circularReferenceFixtures = {
  /**
   * Simple self-referential object
   */
  selfReference: (): CircularReferenceFixture => {
    const obj: any = { name: 'test', value: 42 };
    obj.self = obj;
    return {
      name: 'Self Reference',
      description: 'Object with direct self-reference',
      data: obj,
      expectedBehavior: 'Should serialize as { name: "test", value: 42, self: [Circular] }',
    };
  },

  /**
   * Nested circular reference between parent and child
   */
  nestedCircular: (): CircularReferenceFixture => {
    const parent: any = { type: 'parent', id: 'parent-1' };
    const child: any = { type: 'child', id: 'child-1' };
    parent.child = child;
    child.parent = parent;
    return {
      name: 'Nested Circular',
      description: 'Parent-child circular reference',
      data: parent,
      expectedBehavior: 'Should detect circular reference between parent.child and child.parent',
    };
  },

  /**
   * Array containing circular reference to itself
   */
  arrayCircular: (): CircularReferenceFixture => {
    const arr: any[] = [1, 2, 3, { id: 'nested' }];
    arr.push(arr);
    return {
      name: 'Array Circular',
      description: 'Array containing reference to itself',
      data: arr,
      expectedBehavior: 'Should serialize array with [Circular] marker at end',
    };
  },

  /**
   * Deep circular reference at various nesting levels
   */
  deepCircular: (depth: number = 10): CircularReferenceFixture => {
    let obj: any = { level: 0, timestamp: Date.now() };
    const root = obj;
    for (let i = 1; i < depth; i++) {
      obj.child = { level: i, parent: obj, data: `level-${i}-data` };
      obj = obj.child;
    }
    obj.root = root; // Create circular reference back to root
    return {
      name: `Deep Circular (${depth} levels)`,
      description: `Circular reference at depth ${depth}`,
      data: root,
      expectedBehavior: `Should handle ${depth} levels of nesting before circular reference`,
    };
  },

  /**
   * Multiple circular paths in the same object graph
   */
  multipleCircularPaths: (): CircularReferenceFixture => {
    const a: any = { id: 'a', name: 'Node A' };
    const b: any = { id: 'b', name: 'Node B' };
    const c: any = { id: 'c', name: 'Node C' };

    // Create multiple circular paths
    a.toB = b;
    a.toC = c;
    b.toA = a;
    b.toC = c;
    c.toA = a;
    c.toB = b;

    return {
      name: 'Multiple Circular Paths',
      description: 'Object graph with multiple circular references',
      data: a,
      expectedBehavior: 'Should detect and mark all circular references appropriately',
    };
  },

  /**
   * Circular reference involving arrays and objects
   */
  mixedCircular: (): CircularReferenceFixture => {
    const root: any = {
      type: 'root',
      children: [],
      metadata: { created: Date.now() }
    };

    const child1: any = {
      type: 'child',
      parent: root,
      siblings: [],
      data: 'child1-data'
    };

    const child2: any = {
      type: 'child',
      parent: root,
      siblings: [child1],
      data: 'child2-data'
    };

    root.children = [child1, child2];
    child1.siblings = [child2];
    child2.siblings = [child1];

    return {
      name: 'Mixed Circular (Objects + Arrays)',
      description: 'Circular references involving both objects and arrays',
      data: root,
      expectedBehavior: 'Should handle circular references in mixed data structures',
    };
  },

  /**
   * WeakSet performance test with many objects
   */
  largeCircularGraph: (nodeCount: number = 100): CircularReferenceFixture => {
    const nodes: any[] = [];

    // Create nodes
    for (let i = 0; i < nodeCount; i++) {
      nodes.push({
        id: `node-${i}`,
        index: i,
        connections: [],
        metadata: { created: Date.now(), data: `data-${i}` }
      });
    }

    // Create circular connections
    for (let i = 0; i < nodeCount; i++) {
      const node = nodes[i];
      // Connect to next node (circular at end)
      const nextIndex = (i + 1) % nodeCount;
      node.connections.push(nodes[nextIndex]);

      // Also connect to every 10th node for more complex graph
      if (i % 10 === 0) {
        const skipIndex = (i + 10) % nodeCount;
        node.connections.push(nodes[skipIndex]);
      }
    }

    return {
      name: `Large Circular Graph (${nodeCount} nodes)`,
      description: `Performance test with ${nodeCount} interconnected nodes`,
      data: nodes[0], // Start from first node
      expectedBehavior: 'Should efficiently handle large circular object graphs without memory issues',
    };
  },

  /**
   * Empty circular reference (object with only circular properties)
   */
  emptyCircular: (): CircularReferenceFixture => {
    const obj: any = {};
    obj.self = obj;
    return {
      name: 'Empty Circular',
      description: 'Empty object with only circular self-reference',
      data: obj,
      expectedBehavior: 'Should serialize as { self: [Circular] }',
    };
  },

  /**
   * Circular reference with complex nested structures
   */
  complexCircular: (): CircularReferenceFixture => {
    const config: any = {
      name: 'complex-config',
      version: '1.0.0',
      dependencies: [],
      features: {
        authentication: {
          enabled: true,
          providers: []
        },
        database: {
          type: 'postgres',
          migrations: []
        }
      }
    };

    // Create circular dependencies
    const authModule: any = {
      name: 'auth',
      config: config,
      dependencies: []
    };

    const dbModule: any = {
      name: 'database',
      config: config,
      dependencies: [authModule]
    };

    config.dependencies = [authModule, dbModule];
    config.features.authentication.providers = [authModule];
    config.features.database.migrations = [
      { name: 'initial', module: dbModule },
      { name: 'auth-tables', module: authModule }
    ];

    authModule.dependencies = [dbModule];

    return {
      name: 'Complex Circular',
      description: 'Complex configuration object with multiple circular dependencies',
      data: config,
      expectedBehavior: 'Should handle complex real-world circular reference patterns',
    };
  },

  /**
   * Circular reference involving functions and closures
   */
  functionCircular: (): CircularReferenceFixture => {
    const module: any = {
      name: 'test-module',
      exports: {},
      require: null as any
    };

    // Create a require function that references the module
    module.require = function(name: string) {
      if (name === 'test-module') {
        return module.exports;
      }
      return null;
    };

    // Export function that references the module
    module.exports = {
      getModule: () => module,
      requireSelf: () => module.require('test-module')
    };

    return {
      name: 'Function Circular',
      description: 'Circular references involving functions and closures',
      data: module,
      expectedBehavior: 'Should handle circular references in function closures',
    };
  },

  /**
   * Get all fixtures as array for testing
   */
  getAllFixtures: (): CircularReferenceFixture[] => {
    return [
      circularReferenceFixtures.selfReference(),
      circularReferenceFixtures.nestedCircular(),
      circularReferenceFixtures.arrayCircular(),
      circularReferenceFixtures.deepCircular(5),
      circularReferenceFixtures.deepCircular(20),
      circularReferenceFixtures.multipleCircularPaths(),
      circularReferenceFixtures.mixedCircular(),
      circularReferenceFixtures.largeCircularGraph(10),
      circularReferenceFixtures.largeCircularGraph(100),
      circularReferenceFixtures.emptyCircular(),
      circularReferenceFixtures.complexCircular(),
      circularReferenceFixtures.functionCircular(),
    ];
  },

  /**
   * Get performance test fixtures (larger datasets)
   */
  getPerformanceFixtures: (): CircularReferenceFixture[] => {
    return [
      circularReferenceFixtures.largeCircularGraph(500),
      circularReferenceFixtures.largeCircularGraph(1000),
      circularReferenceFixtures.deepCircular(50),
      circularReferenceFixtures.deepCircular(100),
    ];
  },

  /**
   * Get edge case fixtures (unusual patterns)
   */
  getEdgeCaseFixtures: (): CircularReferenceFixture[] => {
    return [
      circularReferenceFixtures.emptyCircular(),
      circularReferenceFixtures.functionCircular(),
    ];
  }
};

/**
 * Helper function to verify circular reference detection
 */
export function hasCircularReference(obj: any): boolean {
  const seen = new WeakSet();

  function detect(current: any): boolean {
    if (current === null || typeof current !== 'object') {
      return false;
    }

    if (seen.has(current)) {
      return true;
    }

    seen.add(current);

    if (Array.isArray(current)) {
      return current.some(item => detect(item));
    }

    return Object.values(current).some(value => detect(value));
  }

  return detect(obj);
}

/**
 * Helper function to count circular references in an object
 */
export function countCircularReferences(obj: any): number {
  const seen = new WeakSet();
  let count = 0;

  function traverse(current: any): void {
    if (current === null || typeof current !== 'object') {
      return;
    }

    if (seen.has(current)) {
      count++;
      return;
    }

    seen.add(current);

    if (Array.isArray(current)) {
      current.forEach(item => traverse(item));
    } else {
      Object.values(current).forEach(value => traverse(value));
    }
  }

  traverse(obj);
  return count;
}

export default circularReferenceFixtures;