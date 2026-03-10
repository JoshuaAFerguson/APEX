/**
 * Performance Tests for v0.2.0 Documentation Audit
 *
 * Tests performance characteristics, memory usage, and scalability
 * of the documentation audit system under various load conditions.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFile, writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { performance } from 'perf_hooks';
import { V020DocumentationAuditor, auditV020Documentation } from '../packages/core/src/audits/v020-documentation-auditor';

describe('v0.2.0 Documentation Audit Performance', () => {
  const testDir = join(tmpdir(), 'apex-v020-perf-test');
  const testDocsDir = join(testDir, 'docs');

  beforeEach(async () => {
    await mkdir(testDocsDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  // Helper function to measure memory usage
  function measureMemory() {
    const usage = process.memoryUsage();
    return {
      heapUsed: usage.heapUsed / 1024 / 1024, // MB
      heapTotal: usage.heapTotal / 1024 / 1024, // MB
      external: usage.external / 1024 / 1024, // MB
      rss: usage.rss / 1024 / 1024 // MB
    };
  }

  // Helper function to generate large documentation content
  function generateLargeApiSpec(size: 'small' | 'medium' | 'large' | 'huge'): string {
    const sizeMultiplier = {
      small: 1,
      medium: 10,
      large: 100,
      huge: 1000
    }[size];

    let baseSpec = `
openapi: 3.0.3
info:
  title: Performance Test API
  version: 1.0.0
  description: |
    This is a performance test API specification used to test
    the documentation audit system with large OpenAPI files.
    This description is intentionally verbose to increase file size.

servers:
  - url: https://api.example.com/v1
    description: Production server
  - url: https://staging-api.example.com/v1
    description: Staging server

paths:`;

    // Generate many paths
    for (let i = 0; i < 50 * sizeMultiplier; i++) {
      baseSpec += `
  /api/resource${i}:
    get:
      summary: Get resource ${i}
      description: Retrieve information about resource ${i} with detailed documentation
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: integer
            format: int64
        - name: limit
          in: query
          schema:
            type: integer
            minimum: 1
            maximum: 100
            default: 20
      responses:
        '200':
          description: Successful response
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Resource${i}'
        '404':
          description: Resource not found
        '500':
          description: Internal server error
    post:
      summary: Create resource ${i}
      description: Create a new instance of resource ${i}
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateResource${i}'
      responses:
        '201':
          description: Resource created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Resource${i}'
        '400':
          description: Invalid input
        '500':
          description: Internal server error`;
    }

    baseSpec += `

components:
  schemas:`;

    // Generate many schemas
    for (let i = 0; i < 50 * sizeMultiplier; i++) {
      baseSpec += `
    Resource${i}:
      type: object
      required:
        - id
        - name
        - type
      properties:
        id:
          type: integer
          format: int64
          description: Unique identifier for resource ${i}
        name:
          type: string
          minLength: 1
          maxLength: 100
          description: Name of resource ${i}
        type:
          type: string
          enum: [type1, type2, type3, type4, type5]
          description: Type classification for resource ${i}
        description:
          type: string
          maxLength: 1000
          description: Detailed description of resource ${i}
        metadata:
          type: object
          additionalProperties:
            type: string
          description: Additional metadata for resource ${i}
        created_at:
          type: string
          format: date-time
          description: Creation timestamp
        updated_at:
          type: string
          format: date-time
          description: Last update timestamp

    CreateResource${i}:
      type: object
      required:
        - name
        - type
      properties:
        name:
          type: string
          minLength: 1
          maxLength: 100
        type:
          type: string
          enum: [type1, type2, type3, type4, type5]
        description:
          type: string
          maxLength: 1000
        metadata:
          type: object
          additionalProperties:
            type: string`;
    }

    return baseSpec;
  }

  function generateLargeMarkdownDoc(title: string, sections: number): string {
    let content = `# ${title}\n\n`;

    for (let i = 0; i < sections; i++) {
      content += `
## Section ${i}: Detailed Information

This section provides comprehensive information about topic ${i}.
It includes detailed explanations, examples, and best practices.

### Subsection ${i}.1: Basic Concepts

Understanding the fundamental concepts is crucial for effective implementation.
These concepts form the foundation of all advanced topics.

- Concept 1: Lorem ipsum dolor sit amet, consectetur adipiscing elit
- Concept 2: Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua
- Concept 3: Ut enim ad minim veniam, quis nostrud exercitation ullamco

### Subsection ${i}.2: Advanced Features

Advanced features provide powerful capabilities for expert users.

\`\`\`yaml
# Example configuration ${i}
name: "example-${i}"
description: "Advanced example configuration"
settings:
  option1: value1
  option2: value2
  option3: value3
\`\`\`

### Subsection ${i}.3: Best Practices

Following best practices ensures optimal performance and maintainability.

1. Always validate input parameters
2. Use appropriate error handling
3. Document configuration thoroughly
4. Test all edge cases
5. Monitor performance metrics

### Subsection ${i}.4: Troubleshooting

Common issues and their solutions:

#### Issue ${i}.1: Configuration Problems

**Problem**: Configuration validation fails
**Cause**: Invalid parameter values
**Solution**: Review parameter documentation and validate syntax

#### Issue ${i}.2: Performance Issues

**Problem**: Slow execution times
**Cause**: Inefficient configuration or resource constraints
**Solution**: Optimize configuration and increase resources

### Subsection ${i}.5: Examples

Practical examples demonstrating proper usage:

\`\`\`javascript
// Example ${i}: Basic implementation
function example${i}() {
  const config = {
    name: 'example-${i}',
    enabled: true,
    settings: {
      timeout: 30000,
      retries: 3,
      debug: false
    }
  };

  return processConfiguration(config);
}
\`\`\`

`;
    }

    return content;
  }

  describe('Single File Performance', () => {
    it('should handle small OpenAPI files quickly (< 100ms)', async () => {
      const smallApiContent = generateLargeApiSpec('small');
      await writeFile(join(testDocsDir, 'openapi.yaml'), smallApiContent);
      await writeFile(join(testDocsDir, 'agents.md'), generateLargeMarkdownDoc('Agents', 5));
      await writeFile(join(testDocsDir, 'workflows.md'), generateLargeMarkdownDoc('Workflows', 5));
      await writeFile(join(testDocsDir, 'best-practices.md'), generateLargeMarkdownDoc('Best Practices', 5));
      await writeFile(join(testDocsDir, 'troubleshooting.md'), generateLargeMarkdownDoc('Troubleshooting', 5));

      const auditor = new V020DocumentationAuditor({
        docsDirectory: testDocsDir
      });

      const startTime = performance.now();
      const result = await auditor.performAudit();
      const endTime = performance.now();

      const executionTime = endTime - startTime;

      expect(result.overallStatus).toBe('passing');
      expect(executionTime).toBeLessThan(100); // Less than 100ms
      expect(result.apiReference.lineCount).toBeGreaterThan(100);
    });

    it('should handle medium OpenAPI files efficiently (< 500ms)', async () => {
      const mediumApiContent = generateLargeApiSpec('medium');
      await writeFile(join(testDocsDir, 'openapi.yaml'), mediumApiContent);
      await writeFile(join(testDocsDir, 'agents.md'), generateLargeMarkdownDoc('Agents', 20));
      await writeFile(join(testDocsDir, 'workflows.md'), generateLargeMarkdownDoc('Workflows', 20));
      await writeFile(join(testDocsDir, 'best-practices.md'), generateLargeMarkdownDoc('Best Practices', 20));
      await writeFile(join(testDocsDir, 'troubleshooting.md'), generateLargeMarkdownDoc('Troubleshooting', 20));

      const auditor = new V020DocumentationAuditor({
        docsDirectory: testDocsDir
      });

      const startTime = performance.now();
      const result = await auditor.performAudit();
      const endTime = performance.now();

      const executionTime = endTime - startTime;

      expect(result.overallStatus).toBe('passing');
      expect(executionTime).toBeLessThan(500); // Less than 500ms
      expect(result.apiReference.lineCount).toBeGreaterThan(1000);
    });

    it('should handle large OpenAPI files within reasonable time (< 2s)', async () => {
      const largeApiContent = generateLargeApiSpec('large');
      await writeFile(join(testDocsDir, 'openapi.yaml'), largeApiContent);
      await writeFile(join(testDocsDir, 'agents.md'), generateLargeMarkdownDoc('Agents', 50));
      await writeFile(join(testDocsDir, 'workflows.md'), generateLargeMarkdownDoc('Workflows', 50));
      await writeFile(join(testDocsDir, 'best-practices.md'), generateLargeMarkdownDoc('Best Practices', 50));
      await writeFile(join(testDocsDir, 'troubleshooting.md'), generateLargeMarkdownDoc('Troubleshooting', 50));

      const auditor = new V020DocumentationAuditor({
        docsDirectory: testDocsDir
      });

      const startTime = performance.now();
      const result = await auditor.performAudit();
      const endTime = performance.now();

      const executionTime = endTime - startTime;

      expect(result.overallStatus).toBe('passing');
      expect(executionTime).toBeLessThan(2000); // Less than 2 seconds
      expect(result.apiReference.lineCount).toBeGreaterThan(10000);
    });
  });

  describe('Memory Usage Performance', () => {
    it('should maintain reasonable memory usage with large files', async () => {
      const largeApiContent = generateLargeApiSpec('large');
      await writeFile(join(testDocsDir, 'openapi.yaml'), largeApiContent);
      await writeFile(join(testDocsDir, 'agents.md'), generateLargeMarkdownDoc('Agents', 100));
      await writeFile(join(testDocsDir, 'workflows.md'), generateLargeMarkdownDoc('Workflows', 100));
      await writeFile(join(testDocsDir, 'best-practices.md'), generateLargeMarkdownDoc('Best Practices', 100));
      await writeFile(join(testDocsDir, 'troubleshooting.md'), generateLargeMarkdownDoc('Troubleshooting', 100));

      const auditor = new V020DocumentationAuditor({
        docsDirectory: testDocsDir
      });

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const memoryBefore = measureMemory();
      const result = await auditor.performAudit();
      const memoryAfter = measureMemory();

      const memoryIncrease = memoryAfter.heapUsed - memoryBefore.heapUsed;

      expect(result.overallStatus).toBe('passing');
      expect(memoryIncrease).toBeLessThan(50); // Less than 50MB increase
    });

    it('should not leak memory across multiple audits', async () => {
      const mediumApiContent = generateLargeApiSpec('medium');
      await writeFile(join(testDocsDir, 'openapi.yaml'), mediumApiContent);
      await writeFile(join(testDocsDir, 'agents.md'), generateLargeMarkdownDoc('Agents', 20));
      await writeFile(join(testDocsDir, 'workflows.md'), generateLargeMarkdownDoc('Workflows', 20));
      await writeFile(join(testDocsDir, 'best-practices.md'), generateLargeMarkdownDoc('Best Practices', 20));
      await writeFile(join(testDocsDir, 'troubleshooting.md'), generateLargeMarkdownDoc('Troubleshooting', 20));

      const auditor = new V020DocumentationAuditor({
        docsDirectory: testDocsDir
      });

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const memoryBefore = measureMemory();

      // Run multiple audits
      for (let i = 0; i < 5; i++) {
        const result = await auditor.performAudit();
        expect(result.overallStatus).toBe('passing');
      }

      // Force garbage collection again
      if (global.gc) {
        global.gc();
      }

      const memoryAfter = measureMemory();
      const memoryIncrease = memoryAfter.heapUsed - memoryBefore.heapUsed;

      // Memory should not increase significantly after multiple runs
      expect(memoryIncrease).toBeLessThan(20); // Less than 20MB increase
    });
  });

  describe('Concurrent Performance', () => {
    it('should handle multiple concurrent audits efficiently', async () => {
      const mediumApiContent = generateLargeApiSpec('medium');
      await writeFile(join(testDocsDir, 'openapi.yaml'), mediumApiContent);
      await writeFile(join(testDocsDir, 'agents.md'), generateLargeMarkdownDoc('Agents', 30));
      await writeFile(join(testDocsDir, 'workflows.md'), generateLargeMarkdownDoc('Workflows', 30));
      await writeFile(join(testDocsDir, 'best-practices.md'), generateLargeMarkdownDoc('Best Practices', 30));
      await writeFile(join(testDocsDir, 'troubleshooting.md'), generateLargeMarkdownDoc('Troubleshooting', 30));

      const concurrentAudits = 10;
      const auditors = Array(concurrentAudits).fill(0).map(() =>
        new V020DocumentationAuditor({
          docsDirectory: testDocsDir
        })
      );

      const startTime = performance.now();

      // Run all audits concurrently
      const promises = auditors.map(auditor => auditor.performAudit());
      const results = await Promise.all(promises);

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const averageTime = totalTime / concurrentAudits;

      // All audits should succeed
      results.forEach(result => {
        expect(result.overallStatus).toBe('passing');
      });

      // Concurrent execution should be more efficient than sequential
      // (allowing overhead but should be significantly faster)
      expect(totalTime).toBeLessThan(concurrentAudits * 1000); // Less than 1s per audit
      expect(averageTime).toBeLessThan(500); // Less than 500ms average
    });

    it('should handle mixed workload efficiently', async () => {
      // Create different sized documentation sets
      const smallApiContent = generateLargeApiSpec('small');
      const mediumApiContent = generateLargeApiSpec('medium');

      await writeFile(join(testDocsDir, 'openapi.yaml'), mediumApiContent);
      await writeFile(join(testDocsDir, 'agents.md'), generateLargeMarkdownDoc('Agents', 25));
      await writeFile(join(testDocsDir, 'workflows.md'), generateLargeMarkdownDoc('Workflows', 25));
      await writeFile(join(testDocsDir, 'best-practices.md'), generateLargeMarkdownDoc('Best Practices', 25));
      await writeFile(join(testDocsDir, 'troubleshooting.md'), generateLargeMarkdownDoc('Troubleshooting', 25));

      const configs = [
        { docsDirectory: testDocsDir },
        { docsDirectory: testDocsDir, detailedAnalysis: false },
        { docsDirectory: testDocsDir, minimumLineThreshold: 10 },
        { docsDirectory: testDocsDir, minimumLineThreshold: 100 },
        { docsDirectory: testDocsDir, detailedAnalysis: true }
      ];

      const startTime = performance.now();

      const promises = configs.map(config => auditV020Documentation(config));
      const results = await Promise.all(promises);

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // All audits should complete successfully
      results.forEach(result => {
        expect(result.overallStatus).toBe('passing');
      });

      // Should handle mixed workload efficiently
      expect(totalTime).toBeLessThan(3000); // Less than 3 seconds total
    });
  });

  describe('Scalability Testing', () => {
    it('should scale linearly with file size', async () => {
      const testSizes = ['small', 'medium'] as const;
      const times: number[] = [];

      for (const size of testSizes) {
        // Create fresh directory for each test
        const sizeTestDir = join(testDir, `size-test-${size}`);
        await mkdir(sizeTestDir, { recursive: true });

        const apiContent = generateLargeApiSpec(size);
        const sectionCount = size === 'small' ? 10 : 30;

        await writeFile(join(sizeTestDir, 'openapi.yaml'), apiContent);
        await writeFile(join(sizeTestDir, 'agents.md'), generateLargeMarkdownDoc('Agents', sectionCount));
        await writeFile(join(sizeTestDir, 'workflows.md'), generateLargeMarkdownDoc('Workflows', sectionCount));
        await writeFile(join(sizeTestDir, 'best-practices.md'), generateLargeMarkdownDoc('Best Practices', sectionCount));
        await writeFile(join(sizeTestDir, 'troubleshooting.md'), generateLargeMarkdownDoc('Troubleshooting', sectionCount));

        const auditor = new V020DocumentationAuditor({
          docsDirectory: sizeTestDir
        });

        const startTime = performance.now();
        const result = await auditor.performAudit();
        const endTime = performance.now();

        times.push(endTime - startTime);

        expect(result.overallStatus).toBe('passing');

        // Cleanup
        await rm(sizeTestDir, { recursive: true, force: true });
      }

      // Medium should not take more than 5x longer than small
      const scalingFactor = times[1] / times[0];
      expect(scalingFactor).toBeLessThan(5);
    });
  });

  describe('Configuration Impact on Performance', () => {
    it('should be faster with detailed analysis disabled', async () => {
      const mediumApiContent = generateLargeApiSpec('medium');
      await writeFile(join(testDocsDir, 'openapi.yaml'), mediumApiContent);
      await writeFile(join(testDocsDir, 'agents.md'), generateLargeMarkdownDoc('Agents', 20));
      await writeFile(join(testDocsDir, 'workflows.md'), generateLargeMarkdownDoc('Workflows', 20));
      await writeFile(join(testDocsDir, 'best-practices.md'), generateLargeMarkdownDoc('Best Practices', 20));
      await writeFile(join(testDocsDir, 'troubleshooting.md'), generateLargeMarkdownDoc('Troubleshooting', 20));

      // Test with detailed analysis
      const detailedAuditor = new V020DocumentationAuditor({
        docsDirectory: testDocsDir,
        detailedAnalysis: true
      });

      const startDetailedTime = performance.now();
      const detailedResult = await detailedAuditor.performAudit();
      const endDetailedTime = performance.now();

      // Test without detailed analysis
      const simpleAuditor = new V020DocumentationAuditor({
        docsDirectory: testDocsDir,
        detailedAnalysis: false
      });

      const startSimpleTime = performance.now();
      const simpleResult = await simpleAuditor.performAudit();
      const endSimpleTime = performance.now();

      const detailedTime = endDetailedTime - startDetailedTime;
      const simpleTime = endSimpleTime - startSimpleTime;

      expect(detailedResult.overallStatus).toBe('passing');
      expect(simpleResult.overallStatus).toBe('passing');

      // Simple should be faster than detailed
      expect(simpleTime).toBeLessThan(detailedTime);
      expect(simpleTime).toBeLessThan(detailedTime * 0.8); // At least 20% faster
    });

    it('should show minimal performance impact from line threshold', async () => {
      const mediumApiContent = generateLargeApiSpec('medium');
      await writeFile(join(testDocsDir, 'openapi.yaml'), mediumApiContent);
      await writeFile(join(testDocsDir, 'agents.md'), generateLargeMarkdownDoc('Agents', 20));
      await writeFile(join(testDocsDir, 'workflows.md'), generateLargeMarkdownDoc('Workflows', 20));
      await writeFile(join(testDocsDir, 'best-practices.md'), generateLargeMarkdownDoc('Best Practices', 20));
      await writeFile(join(testDocsDir, 'troubleshooting.md'), generateLargeMarkdownDoc('Troubleshooting', 20));

      const thresholds = [10, 50, 100, 500];
      const times: number[] = [];

      for (const threshold of thresholds) {
        const auditor = new V020DocumentationAuditor({
          docsDirectory: testDocsDir,
          minimumLineThreshold: threshold,
          detailedAnalysis: false // Focus on threshold impact
        });

        const startTime = performance.now();
        const result = await auditor.performAudit();
        const endTime = performance.now();

        times.push(endTime - startTime);
        expect(result.overallStatus).toBe('passing');
      }

      // Performance should be consistent regardless of threshold
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);
      const variance = (maxTime - minTime) / minTime;

      expect(variance).toBeLessThan(0.5); // Less than 50% variance
    });
  });

  describe('Stress Testing', () => {
    it('should handle stress test with many files and concurrent access', async () => {
      const largeApiContent = generateLargeApiSpec('large');
      await writeFile(join(testDocsDir, 'openapi.yaml'), largeApiContent);
      await writeFile(join(testDocsDir, 'agents.md'), generateLargeMarkdownDoc('Agents', 75));
      await writeFile(join(testDocsDir, 'workflows.md'), generateLargeMarkdownDoc('Workflows', 75));
      await writeFile(join(testDocsDir, 'best-practices.md'), generateLargeMarkdownDoc('Best Practices', 75));
      await writeFile(join(testDocsDir, 'troubleshooting.md'), generateLargeMarkdownDoc('Troubleshooting', 75));

      const memoryBefore = measureMemory();
      const startTime = performance.now();

      // Run stress test: 20 concurrent audits of large files
      const stressPromises = Array(20).fill(0).map(() =>
        auditV020Documentation({
          docsDirectory: testDocsDir
        })
      );

      const results = await Promise.all(stressPromises);

      const endTime = performance.now();
      const memoryAfter = measureMemory();

      const totalTime = endTime - startTime;
      const memoryIncrease = memoryAfter.heapUsed - memoryBefore.heapUsed;

      // All audits should succeed
      results.forEach(result => {
        expect(result.overallStatus).toBe('passing');
      });

      // Should complete stress test within reasonable time
      expect(totalTime).toBeLessThan(10000); // Less than 10 seconds

      // Should not use excessive memory
      expect(memoryIncrease).toBeLessThan(100); // Less than 100MB increase

      console.log(`Stress test completed: ${results.length} audits in ${totalTime.toFixed(2)}ms`);
      console.log(`Memory usage: +${memoryIncrease.toFixed(2)}MB`);
    });
  });
});