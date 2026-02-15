import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Quick verification test for v0.5.0 completion status
 */
describe('v0.5.0 Quick Verification', () => {
  it('should confirm v0.5.0 is marked as complete', () => {
    const roadmapPath = path.join(__dirname, '..', 'ROADMAP.md');
    const content = fs.readFileSync(roadmapPath, 'utf-8');

    // Check that v0.5.0 header indicates completion
    expect(content).toMatch(/## v0\.5\.0.*Complete/i);
  });

  it('should verify v0.5.0 features are marked with 🟢', () => {
    const roadmapPath = path.join(__dirname, '..', 'ROADMAP.md');
    const content = fs.readFileSync(roadmapPath, 'utf-8');

    // Extract v0.5.0 section
    const v050Start = content.indexOf('## v0.5.0');
    const v060Start = content.indexOf('## v0.6.0');

    expect(v050Start).toBeGreaterThan(-1);
    expect(v060Start).toBeGreaterThan(-1);

    const v050Section = content.substring(v050Start, v060Start);

    // Count feature lines with status icons
    const featureLines = v050Section.split('\n').filter(line =>
      line.includes('🟢') || line.includes('🟡') || line.includes('⚪')
    );

    // All should be complete (🟢)
    const completeFeatures = featureLines.filter(line => line.includes('🟢'));
    const incompleteFeatures = featureLines.filter(line => line.includes('🟡') || line.includes('⚪'));

    expect(featureLines.length).toBeGreaterThan(50);
    expect(completeFeatures.length).toBe(featureLines.length);
    expect(incompleteFeatures.length).toBe(0);

    console.log(`✅ v0.5.0 Verification: ${completeFeatures.length} features marked as complete`);
  });
});