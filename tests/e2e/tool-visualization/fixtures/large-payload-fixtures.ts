/**
 * Test fixtures for large payload truncation testing
 * Provides various large data patterns to test truncation behavior
 */

export interface LargePayloadFixture {
  name: string;
  description: string;
  data: any;
  expectedSize: string;
  expectedTruncation: boolean;
  maxAllowedSize: number; // bytes
}

/**
 * Collection of large payload test fixtures
 */
export const largePayloadFixtures = {
  /**
   * Generate large array with specified size
   */
  largeArray: (size: number = 10000): LargePayloadFixture => {
    const array = Array.from({ length: size }, (_, i) => ({
      index: i,
      value: `item-${i}`,
      timestamp: new Date().toISOString(),
      metadata: {
        created: Date.now(),
        tags: [`tag-${i % 10}`, `category-${i % 5}`],
        active: i % 2 === 0
      }
    }));

    return {
      name: `Large Array (${size} items)`,
      description: `Array with ${size} structured objects`,
      data: array,
      expectedSize: `~${Math.round(JSON.stringify(array).length / 1024)}KB`,
      expectedTruncation: size > 1000,
      maxAllowedSize: 100 * 1024, // 100KB
    };
  },

  /**
   * Generate large string with specified size in KB
   */
  largeString: (sizeKB: number = 100): LargePayloadFixture => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,!?;:';
    const targetLength = sizeKB * 1024;
    let result = '';

    while (result.length < targetLength) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }

    return {
      name: `Large String (${sizeKB}KB)`,
      description: `Random string of ${sizeKB}KB`,
      data: result,
      expectedSize: `${sizeKB}KB`,
      expectedTruncation: sizeKB > 50,
      maxAllowedSize: 50 * 1024, // 50KB
    };
  },

  /**
   * Generate deeply nested object structure
   */
  deeplyNested: (depth: number = 50): LargePayloadFixture => {
    let obj: any = {
      value: 'leaf',
      depth,
      data: Array.from({ length: 10 }, (_, i) => `leaf-data-${i}`)
    };

    for (let i = depth; i > 0; i--) {
      obj = {
        level: i,
        child: obj,
        metadata: {
          timestamp: Date.now(),
          level: i,
          path: `level-${i}`,
          data: `data-for-level-${i}`
        }
      };
    }

    return {
      name: `Deeply Nested (${depth} levels)`,
      description: `Object nested ${depth} levels deep`,
      data: obj,
      expectedSize: `~${Math.round(JSON.stringify(obj).length / 1024)}KB`,
      expectedTruncation: depth > 20,
      maxAllowedSize: 100 * 1024, // 100KB
    };
  },

  /**
   * Mixed large payload combining different large data types
   */
  mixedLargePayload: (config: {
    arraySize?: number;
    stringSize?: number;
    nestingDepth?: number;
  } = {}): LargePayloadFixture => {
    const { arraySize = 5000, stringSize = 100, nestingDepth = 20 } = config;

    const mixedData = {
      largeArray: largePayloadFixtures.largeArray(arraySize).data,
      largeString: largePayloadFixtures.largeString(stringSize).data,
      nested: largePayloadFixtures.deeplyNested(nestingDepth).data,
      metadata: {
        timestamp: new Date().toISOString(),
        source: 'test-fixture',
        config: { arraySize, stringSize, nestingDepth },
        statistics: {
          totalArrayItems: arraySize,
          stringLength: stringSize * 1024,
          nestingLevels: nestingDepth
        }
      },
      additionalData: Array.from({ length: 100 }, (_, i) => ({
        id: `additional-${i}`,
        content: `This is additional content item ${i} with some data`,
        values: Array.from({ length: 10 }, (_, j) => `value-${i}-${j}`)
      }))
    };

    return {
      name: `Mixed Large Payload`,
      description: `Combined large array (${arraySize}), string (${stringSize}KB), and nested (${nestingDepth} levels)`,
      data: mixedData,
      expectedSize: `~${Math.round(JSON.stringify(mixedData).length / 1024)}KB`,
      expectedTruncation: true,
      maxAllowedSize: 100 * 1024, // 100KB
    };
  },

  /**
   * Generate binary-like data (base64 encoded)
   */
  binaryData: (sizeMB: number = 1): LargePayloadFixture => {
    const binarySize = sizeMB * 1024 * 1024;
    const buffer = Buffer.alloc(binarySize);

    // Fill with pseudo-random data
    for (let i = 0; i < binarySize; i++) {
      buffer[i] = Math.floor(Math.random() * 256);
    }

    const base64Data = buffer.toString('base64');
    const data = {
      type: 'binary',
      encoding: 'base64',
      size: binarySize,
      data: base64Data,
      metadata: {
        originalSize: binarySize,
        encodedSize: base64Data.length,
        timestamp: Date.now()
      }
    };

    return {
      name: `Binary Data (${sizeMB}MB)`,
      description: `Base64 encoded binary data of ${sizeMB}MB`,
      data,
      expectedSize: `${sizeMB}MB`,
      expectedTruncation: true,
      maxAllowedSize: 100 * 1024, // 100KB
    };
  },

  /**
   * Large object with many properties
   */
  wideObject: (propertyCount: number = 10000): LargePayloadFixture => {
    const obj: any = {
      type: 'wide-object',
      propertyCount,
      timestamp: Date.now()
    };

    for (let i = 0; i < propertyCount; i++) {
      obj[`property_${i}`] = {
        value: `value-${i}`,
        index: i,
        metadata: {
          created: Date.now() + i,
          category: `category-${i % 10}`,
          active: i % 2 === 0
        }
      };
    }

    return {
      name: `Wide Object (${propertyCount} properties)`,
      description: `Object with ${propertyCount} properties`,
      data: obj,
      expectedSize: `~${Math.round(JSON.stringify(obj).length / 1024)}KB`,
      expectedTruncation: propertyCount > 1000,
      maxAllowedSize: 100 * 1024, // 100KB
    };
  },

  /**
   * Repetitive data structure (high redundancy)
   */
  repetitiveData: (repetitions: number = 1000): LargePayloadFixture => {
    const template = {
      id: 'template-id',
      name: 'Repetitive Data Template',
      description: 'This is a template that will be repeated many times',
      metadata: {
        version: '1.0.0',
        author: 'test-fixture',
        created: '2024-01-01T00:00:00Z'
      },
      config: {
        enabled: true,
        options: ['option1', 'option2', 'option3'],
        settings: {
          timeout: 5000,
          retries: 3,
          verbose: false
        }
      }
    };

    const data = {
      type: 'repetitive',
      repetitions,
      items: Array.from({ length: repetitions }, (_, i) => ({
        ...template,
        id: `template-id-${i}`,
        index: i
      }))
    };

    return {
      name: `Repetitive Data (${repetitions} items)`,
      description: `${repetitions} repetitions of the same data structure`,
      data,
      expectedSize: `~${Math.round(JSON.stringify(data).length / 1024)}KB`,
      expectedTruncation: repetitions > 100,
      maxAllowedSize: 100 * 1024, // 100KB
    };
  },

  /**
   * Performance test payload with complex nested structures
   */
  performanceTestPayload: (): LargePayloadFixture => {
    const data = {
      metadata: {
        test: 'performance',
        timestamp: Date.now(),
        version: '1.0.0'
      },
      datasets: {
        userProfiles: Array.from({ length: 1000 }, (_, i) => ({
          id: `user-${i}`,
          name: `User ${i}`,
          email: `user${i}@example.com`,
          profile: {
            age: 20 + (i % 50),
            preferences: Array.from({ length: 10 }, (_, j) => `pref-${j}`),
            history: Array.from({ length: 20 }, (_, k) => ({
              action: `action-${k}`,
              timestamp: Date.now() - (k * 1000),
              data: `action-data-${i}-${k}`
            }))
          }
        })),
        transactions: Array.from({ length: 5000 }, (_, i) => ({
          id: `tx-${i}`,
          userId: `user-${i % 1000}`,
          amount: Math.random() * 1000,
          currency: 'USD',
          description: `Transaction ${i} description with some details`,
          metadata: {
            ip: `192.168.1.${i % 255}`,
            userAgent: 'Test User Agent',
            timestamp: Date.now() - (i * 60000)
          }
        })),
        logs: Array.from({ length: 2000 }, (_, i) => ({
          level: ['INFO', 'WARN', 'ERROR'][i % 3],
          message: `Log message ${i} with detailed information about what happened`,
          timestamp: new Date(Date.now() - (i * 1000)).toISOString(),
          context: {
            userId: `user-${i % 1000}`,
            session: `session-${i % 100}`,
            module: `module-${i % 10}`
          }
        }))
      }
    };

    return {
      name: 'Performance Test Payload',
      description: 'Complex nested structure for performance testing',
      data,
      expectedSize: `~${Math.round(JSON.stringify(data).length / 1024)}KB`,
      expectedTruncation: true,
      maxAllowedSize: 100 * 1024, // 100KB
    };
  },

  /**
   * Get all fixtures for comprehensive testing
   */
  getAllFixtures: (): LargePayloadFixture[] => {
    return [
      largePayloadFixtures.largeArray(1000),
      largePayloadFixtures.largeArray(10000),
      largePayloadFixtures.largeString(50),
      largePayloadFixtures.largeString(200),
      largePayloadFixtures.deeplyNested(10),
      largePayloadFixtures.deeplyNested(50),
      largePayloadFixtures.mixedLargePayload(),
      largePayloadFixtures.binaryData(0.5),
      largePayloadFixtures.wideObject(1000),
      largePayloadFixtures.wideObject(10000),
      largePayloadFixtures.repetitiveData(500),
      largePayloadFixtures.performanceTestPayload(),
    ];
  },

  /**
   * Get truncation boundary test fixtures
   */
  getTruncationBoundaryFixtures: (): LargePayloadFixture[] => {
    return [
      largePayloadFixtures.largeArray(999), // Just below threshold
      largePayloadFixtures.largeArray(1000), // At threshold
      largePayloadFixtures.largeArray(1001), // Just above threshold
      largePayloadFixtures.largeString(49), // Just below threshold
      largePayloadFixtures.largeString(50), // At threshold
      largePayloadFixtures.largeString(51), // Just above threshold
    ];
  },

  /**
   * Get performance test fixtures (very large data)
   */
  getPerformanceFixtures: (): LargePayloadFixture[] => {
    return [
      largePayloadFixtures.largeArray(50000),
      largePayloadFixtures.largeString(1000), // 1MB
      largePayloadFixtures.deeplyNested(100),
      largePayloadFixtures.binaryData(5), // 5MB
      largePayloadFixtures.wideObject(50000),
      largePayloadFixtures.repetitiveData(10000),
    ];
  }
};

/**
 * Helper function to estimate object size in bytes
 */
export function estimateObjectSize(obj: any): number {
  try {
    return new TextEncoder().encode(JSON.stringify(obj)).length;
  } catch (error) {
    // If JSON.stringify fails (circular refs, etc), return approximate size
    return JSON.stringify(obj).length * 2; // Rough estimate for UTF-8
  }
}

/**
 * Helper function to check if object should be truncated
 */
export function shouldTruncate(obj: any, maxSize: number = 100 * 1024): boolean {
  return estimateObjectSize(obj) > maxSize;
}

/**
 * Helper function to simulate truncation metadata
 */
export interface TruncationMetadata {
  original_size: number;
  truncated_size: number;
  truncation_type: 'array' | 'string' | 'object' | 'mixed';
  truncated_at: string;
  items_removed?: number;
  characters_removed?: number;
  properties_removed?: number;
}

export function createTruncationMetadata(
  originalSize: number,
  truncatedSize: number,
  type: 'array' | 'string' | 'object' | 'mixed',
  itemsRemoved?: number
): TruncationMetadata {
  const metadata: TruncationMetadata = {
    original_size: originalSize,
    truncated_size: truncatedSize,
    truncation_type: type,
    truncated_at: new Date().toISOString(),
  };

  if (type === 'array' && itemsRemoved !== undefined) {
    metadata.items_removed = itemsRemoved;
  } else if (type === 'string' && itemsRemoved !== undefined) {
    metadata.characters_removed = itemsRemoved;
  } else if (type === 'object' && itemsRemoved !== undefined) {
    metadata.properties_removed = itemsRemoved;
  }

  return metadata;
}

export default largePayloadFixtures;