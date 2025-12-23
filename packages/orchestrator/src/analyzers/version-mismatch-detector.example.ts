/**
 * Example usage of VersionMismatchDetector
 *
 * This example shows how to use the VersionMismatchDetector to find
 * version mismatches between package.json and documentation files.
 */

import { VersionMismatchDetector } from './version-mismatch-detector';

async function exampleUsage() {
  // Create detector instance
  const detector = new VersionMismatchDetector('/path/to/project');

  try {
    // Detect version mismatches
    const mismatches = await detector.detectMismatches();

    if (mismatches.length > 0) {
      console.log(`Found ${mismatches.length} version mismatches:`);

      mismatches.forEach((mismatch, index) => {
        console.log(`${index + 1}. ${mismatch.file}:${mismatch.line}`);
        console.log(`   Found: ${mismatch.foundVersion}`);
        console.log(`   Expected: ${mismatch.expectedVersion}`);
        console.log(`   Line: ${mismatch.lineContent}`);
        console.log('');
      });

      // Generate a task candidate for the mismatches
      const taskCandidate = detector.createVersionMismatchTask(mismatches);
      if (taskCandidate) {
        console.log('Generated task candidate:');
        console.log(`Title: ${taskCandidate.title}`);
        console.log(`Description: ${taskCandidate.description}`);
        console.log(`Priority: ${taskCandidate.priority}`);
        console.log(`Effort: ${taskCandidate.estimatedEffort}`);
      }
    } else {
      console.log('No version mismatches found!');
    }
  } catch (error) {
    console.error('Error detecting version mismatches:', error);
  }
}

// Alternative: Use with existing project analysis framework
import type { ProjectAnalysis } from '../idle-processor';

function exampleWithAnalysisFramework() {
  const detector = new VersionMismatchDetector();

  // The detector integrates with the analyzer framework but currently
  // returns empty candidates as it's designed to be used as a standalone utility
  const mockAnalysis = {} as ProjectAnalysis;
  const candidates = detector.analyze(mockAnalysis);

  console.log('Integration with analyzer framework:', candidates);
}

export { exampleUsage, exampleWithAnalysisFramework };