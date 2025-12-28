import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Basic validation test to ensure ROADMAP.md v0.4.0 features are marked complete
 */
describe('ROADMAP Basic Validation', () => {
  it('should have v0.4.0 section with complete features', () => {
    const roadmapPath = path.resolve(__dirname, '../../../../ROADMAP.md');
    expect(fs.existsSync(roadmapPath)).toBe(true);

    const content = fs.readFileSync(roadmapPath, 'utf-8');

    // Should have v0.4.0 section
    expect(content).toContain('## v0.4.0 - Sleepless Mode & Autonomy');

    // Should have complete features marked with green circles
    expect(content).toContain('🟢 **Windows Compatibility**');
    expect(content).toContain('🟢 **Background service**');
    expect(content).toContain('🟢 **Day/night modes**');
    expect(content).toContain('🟢 **Auto-resume on session limit**');
    expect(content).toContain('🟢 **Idle task generation**');
    expect(content).toContain('🟢 **Quick thought capture**');
    expect(content).toContain('🟢 **Docker/Podman sandbox**');

    console.log('✅ ROADMAP.md validation passed - v0.4.0 features marked complete');
  });
});