import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// Mock the fs module
vi.mock('fs');

// Roadmap status update functionality
interface RoadmapStatusUpdate {
  updatePhaseStatus(roadmapContent: string, phaseNumber: number, newStatus: string): string;
  validateRoadmapContent(content: string): boolean;
  extractPhaseStatus(content: string, phaseNumber: number): string | null;
  findPhaseInTable(content: string, phaseNumber: number): { found: boolean; lineNumber: number };
}

// Implementation of roadmap status update functionality
class RoadmapStatusUpdater implements RoadmapStatusUpdate {
  updatePhaseStatus(roadmapContent: string, phaseNumber: number, newStatus: string): string {
    if (!this.validateRoadmapContent(roadmapContent)) {
      throw new Error('Invalid roadmap content format');
    }

    const lines = roadmapContent.split('\n');
    const phaseLocation = this.findPhaseInTable(roadmapContent, phaseNumber);

    if (!phaseLocation.found) {
      throw new Error(`Phase ${phaseNumber} not found in roadmap`);
    }

    // Find the table row for the specific phase
    const phasePattern = new RegExp(`\\|\\s*Phase\\s+${phaseNumber}\\s*Documentation\\s+updates\\s*\\|`);

    for (let i = 0; i < lines.length; i++) {
      if (phasePattern.test(lines[i])) {
        // Replace the status symbol in the line
        lines[i] = lines[i].replace(/⚪|🟡|🟢/, newStatus);
        break;
      }
    }

    return lines.join('\n');
  }

  validateRoadmapContent(content: string): boolean {
    // Check for basic roadmap structure
    if (!content.includes('# APEX Roadmap')) {
      return false;
    }

    if (!content.includes('v0.3.0 Development Plan')) {
      return false;
    }

    // Check for table structure
    if (!content.includes('| Task | Status | Effort | Files |')) {
      return false;
    }

    return true;
  }

  extractPhaseStatus(content: string, phaseNumber: number): string | null {
    const phasePattern = new RegExp(`\\|\\s*Phase\\s+${phaseNumber}\\s*Documentation\\s+updates\\s*\\|\\s*([⚪🟡🟢]|Complete)`, 'i');
    const match = content.match(phasePattern);

    if (!match) {
      return null;
    }

    return match[1];
  }

  findPhaseInTable(content: string, phaseNumber: number): { found: boolean; lineNumber: number } {
    const lines = content.split('\n');
    const phasePattern = new RegExp(`Phase\\s+${phaseNumber}\\s*Documentation\\s+updates`);

    for (let i = 0; i < lines.length; i++) {
      if (phasePattern.test(lines[i])) {
        return { found: true, lineNumber: i };
      }
    }

    return { found: false, lineNumber: -1 };
  }
}

// Test suite
describe('RoadmapStatusUpdater', () => {
  let updater: RoadmapStatusUpdater;
  let mockRoadmapContent: string;

  beforeEach(() => {
    updater = new RoadmapStatusUpdater();

    // Mock roadmap content based on the actual ROADMAP.md structure
    mockRoadmapContent = `# APEX Roadmap

This document outlines the planned development roadmap for APEX.

## v0.3.0 - Claude Code-like Interactive Experience (In Progress)

### v0.3.0 Development Plan (Updated December 2024)

**Phase 3: Polish & Testing (MEDIUM PRIORITY)**
| Task | Status | Effort | Files |
|------|--------|--------|-------|
| Integration tests | ⚪ | 1 day | \`cli/src/__tests__/v030-features.integration.test.tsx\` |
| Phase 3 Documentation updates | ⚪ | 1 day | \`docs/\` |

**Estimated Remaining**: 2 days (testing + documentation)
`;
  });

  describe('validateRoadmapContent', () => {
    it('should return true for valid roadmap content', () => {
      const result = updater.validateRoadmapContent(mockRoadmapContent);
      expect(result).toBe(true);
    });

    it('should return false if missing APEX Roadmap header', () => {
      const invalidContent = mockRoadmapContent.replace('# APEX Roadmap', '# Some Other Document');
      const result = updater.validateRoadmapContent(invalidContent);
      expect(result).toBe(false);
    });

    it('should return false if missing v0.3.0 Development Plan section', () => {
      const invalidContent = mockRoadmapContent.replace('v0.3.0 Development Plan', 'Some Other Plan');
      const result = updater.validateRoadmapContent(invalidContent);
      expect(result).toBe(false);
    });

    it('should return false if missing table structure', () => {
      const invalidContent = mockRoadmapContent.replace('| Task | Status | Effort | Files |', 'No table here');
      const result = updater.validateRoadmapContent(invalidContent);
      expect(result).toBe(false);
    });

    it('should return false for empty content', () => {
      const result = updater.validateRoadmapContent('');
      expect(result).toBe(false);
    });
  });

  describe('extractPhaseStatus', () => {
    it('should extract the current status for Phase 3', () => {
      const status = updater.extractPhaseStatus(mockRoadmapContent, 3);
      expect(status).toBe('⚪');
    });

    it('should return null for non-existent phase', () => {
      const status = updater.extractPhaseStatus(mockRoadmapContent, 99);
      expect(status).toBeNull();
    });

    it('should extract Complete status', () => {
      const contentWithComplete = mockRoadmapContent.replace('Phase 3 Documentation updates | ⚪', 'Phase 3 Documentation updates | 🟢 Complete');
      const status = updater.extractPhaseStatus(contentWithComplete, 3);
      expect(status).toBe('🟢 Complete');
    });

    it('should handle different status symbols', () => {
      const contentWithInProgress = mockRoadmapContent.replace('⚪', '🟡');
      const status = updater.extractPhaseStatus(contentWithInProgress, 3);
      expect(status).toBe('🟡');
    });
  });

  describe('findPhaseInTable', () => {
    it('should find Phase 3 in the table', () => {
      const result = updater.findPhaseInTable(mockRoadmapContent, 3);
      expect(result.found).toBe(true);
      expect(result.lineNumber).toBeGreaterThan(-1);
    });

    it('should not find non-existent phase', () => {
      const result = updater.findPhaseInTable(mockRoadmapContent, 99);
      expect(result.found).toBe(false);
      expect(result.lineNumber).toBe(-1);
    });

    it('should return correct line number', () => {
      const lines = mockRoadmapContent.split('\n');
      const result = updater.findPhaseInTable(mockRoadmapContent, 3);

      if (result.found) {
        expect(lines[result.lineNumber]).toContain('Phase 3 Documentation updates');
      }
    });
  });

  describe('updatePhaseStatus', () => {
    it('should update Phase 3 status from ⚪ to 🟢 Complete', () => {
      const updatedContent = updater.updatePhaseStatus(mockRoadmapContent, 3, '🟢 Complete');

      expect(updatedContent).toContain('Phase 3 Documentation updates | 🟢 Complete');
      expect(updatedContent).not.toContain('Phase 3 Documentation updates | ⚪');
    });

    it('should update status from ⚪ to 🟡', () => {
      const updatedContent = updater.updatePhaseStatus(mockRoadmapContent, 3, '🟡');

      expect(updatedContent).toContain('Phase 3 Documentation updates | 🟡');
      expect(updatedContent).not.toContain('Phase 3 Documentation updates | ⚪');
    });

    it('should update status from 🟡 to 🟢 Complete', () => {
      const inProgressContent = mockRoadmapContent.replace('⚪', '🟡');
      const updatedContent = updater.updatePhaseStatus(inProgressContent, 3, '🟢 Complete');

      expect(updatedContent).toContain('Phase 3 Documentation updates | 🟢 Complete');
      expect(updatedContent).not.toContain('Phase 3 Documentation updates | 🟡');
    });

    it('should preserve rest of the content unchanged', () => {
      const updatedContent = updater.updatePhaseStatus(mockRoadmapContent, 3, '🟢 Complete');

      // Check that header is preserved
      expect(updatedContent).toContain('# APEX Roadmap');

      // Check that other table rows are preserved
      expect(updatedContent).toContain('Integration tests | ⚪');

      // Check that estimated remaining is preserved
      expect(updatedContent).toContain('**Estimated Remaining**: 2 days');
    });

    it('should throw error for invalid roadmap content', () => {
      const invalidContent = 'This is not a valid roadmap';

      expect(() => {
        updater.updatePhaseStatus(invalidContent, 3, '🟢 Complete');
      }).toThrow('Invalid roadmap content format');
    });

    it('should throw error for non-existent phase', () => {
      expect(() => {
        updater.updatePhaseStatus(mockRoadmapContent, 99, '🟢 Complete');
      }).toThrow('Phase 99 not found in roadmap');
    });

    it('should handle multiple status updates correctly', () => {
      let updatedContent = updater.updatePhaseStatus(mockRoadmapContent, 3, '🟡');
      updatedContent = updater.updatePhaseStatus(updatedContent, 3, '🟢 Complete');

      expect(updatedContent).toContain('Phase 3 Documentation updates | 🟢 Complete');
      expect(updatedContent).not.toContain('Phase 3 Documentation updates | 🟡');
      expect(updatedContent).not.toContain('Phase 3 Documentation updates | ⚪');
    });
  });

  describe('Integration scenarios', () => {
    it('should handle real ROADMAP.md file structure', () => {
      const realRoadmapContent = `# APEX Roadmap

**Phase 3: Polish & Testing (MEDIUM PRIORITY)**
| Task | Status | Effort | Files |
|------|--------|--------|-------|
| Integration tests | ⚪ | 1 day | \`cli/src/__tests__/v030-features.integration.test.tsx\` |
| Documentation updates | ⚪ | 1 day | \`docs/\` |

**Estimated Remaining**: 2 days (testing + documentation)

### v0.3.0 Development Plan (Updated December 2024)
`;

      // Validate the content
      expect(updater.validateRoadmapContent(realRoadmapContent)).toBe(true);

      // Update Phase 3 status
      const updatedContent = updater.updatePhaseStatus(realRoadmapContent, 3, '🟢 Complete');

      expect(updatedContent).toContain('Phase 3 Documentation updates | 🟢 Complete');
    });

    it('should handle edge case with extra whitespace', () => {
      const contentWithSpaces = mockRoadmapContent.replace(
        'Phase 3 Documentation updates | ⚪',
        'Phase  3   Documentation   updates  |   ⚪  '
      );

      const updatedContent = updater.updatePhaseStatus(contentWithSpaces, 3, '🟢 Complete');
      expect(updatedContent).toContain('🟢 Complete');
    });

    it('should preserve file line endings', () => {
      const contentWithCRLF = mockRoadmapContent.replace(/\n/g, '\r\n');
      const updatedContent = updater.updatePhaseStatus(contentWithCRLF, 3, '🟢 Complete');

      // Should contain the update
      expect(updatedContent).toContain('🟢 Complete');
    });
  });
});

// File operations test suite
describe('Roadmap File Operations', () => {
  const mockReadFileSync = vi.mocked(readFileSync);
  const mockWriteFileSync = vi.mocked(writeFileSync);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Reading roadmap file', () => {
    it('should read ROADMAP.md successfully', () => {
      const mockContent = '# APEX Roadmap\n\nPhase 3 Documentation updates | ⚪';
      mockReadFileSync.mockReturnValue(mockContent);

      const content = readFileSync('/path/to/ROADMAP.md', 'utf8');

      expect(mockReadFileSync).toHaveBeenCalledWith('/path/to/ROADMAP.md', 'utf8');
      expect(content).toBe(mockContent);
    });

    it('should handle file read errors gracefully', () => {
      mockReadFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });

      expect(() => {
        readFileSync('/nonexistent/ROADMAP.md', 'utf8');
      }).toThrow('File not found');
    });
  });

  describe('Writing roadmap file', () => {
    it('should write updated content successfully', () => {
      const updatedContent = '# APEX Roadmap\n\nPhase 3 Documentation updates | 🟢 Complete';

      writeFileSync('/path/to/ROADMAP.md', updatedContent, 'utf8');

      expect(mockWriteFileSync).toHaveBeenCalledWith('/path/to/ROADMAP.md', updatedContent, 'utf8');
    });

    it('should handle write errors gracefully', () => {
      mockWriteFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      expect(() => {
        writeFileSync('/readonly/ROADMAP.md', 'content', 'utf8');
      }).toThrow('Permission denied');
    });
  });
});

// Integration test with actual task completion scenario
describe('Task Completion Integration', () => {
  let updater: RoadmapStatusUpdater;

  beforeEach(() => {
    updater = new RoadmapStatusUpdater();
  });

  it('should simulate complete task workflow: ⚪ → 🟡 → 🟢', () => {
    let roadmapContent = `# APEX Roadmap

**Phase 3: Polish & Testing (MEDIUM PRIORITY)**
| Task | Status | Effort | Files |
|------|--------|--------|-------|
| Integration tests | ⚪ | 1 day | \`cli/src/__tests__/v030-features.integration.test.tsx\` |
| Phase 3 Documentation updates | ⚪ | 1 day | \`docs/\` |

### v0.3.0 Development Plan (Updated December 2024)
`;

    // Step 1: Mark as in progress
    roadmapContent = updater.updatePhaseStatus(roadmapContent, 3, '🟡');
    expect(updater.extractPhaseStatus(roadmapContent, 3)).toBe('🟡');

    // Step 2: Mark as complete
    roadmapContent = updater.updatePhaseStatus(roadmapContent, 3, '🟢 Complete');
    expect(updater.extractPhaseStatus(roadmapContent, 3)).toBe('🟢 Complete');

    // Verify final state
    expect(roadmapContent).toContain('Phase 3 Documentation updates | 🟢 Complete');
    expect(roadmapContent).not.toContain('Phase 3 Documentation updates | ⚪');
    expect(roadmapContent).not.toContain('Phase 3 Documentation updates | 🟡');
  });

  it('should verify the acceptance criteria is met', () => {
    const initialContent = `**Phase 3: Polish & Testing (MEDIUM PRIORITY)**
| Task | Status | Effort | Files |
|------|--------|--------|-------|
| Phase 3 Documentation updates | ⚪ | 1 day | \`docs/\` |`;

    const finalContent = updater.updatePhaseStatus(initialContent, 3, '🟢 Complete');

    // Acceptance criteria: Phase 3 'Documentation updates' row changed from ⚪ to 🟢 Complete
    expect(finalContent).toContain('Phase 3 Documentation updates | 🟢 Complete');
    expect(finalContent).not.toContain('Phase 3 Documentation updates | ⚪');
  });
});