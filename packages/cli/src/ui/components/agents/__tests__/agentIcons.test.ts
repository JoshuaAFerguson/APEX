/**
 * Tests for agent icons utility module
 * Tests icon mappings, animation configurations, and environment detection
 */

import {
  getAgentIcon,
  getIconAnimationConfig,
  shouldUseAsciiIcons,
  detectEmojiSupport,
  AGENT_ICONS,
  AGENT_ICONS_ASCII,
} from '../agentIcons.js';

describe('agentIcons', () => {
  describe('AGENT_ICONS', () => {
    it('should have icons for all standard agent types', () => {
      const standardAgents = ['planner', 'architect', 'developer', 'tester', 'reviewer', 'devops'];

      standardAgents.forEach(agent => {
        expect(AGENT_ICONS[agent]).toBeDefined();
        expect(typeof AGENT_ICONS[agent]).toBe('string');
        expect(AGENT_ICONS[agent].length).toBeGreaterThan(0);
      });
    });

    it('should have a default icon', () => {
      expect(AGENT_ICONS.default).toBeDefined();
      expect(AGENT_ICONS.default).toBe('🤖');
    });

    it('should use appropriate emoji for each agent type', () => {
      expect(AGENT_ICONS.planner).toBe('📋');
      expect(AGENT_ICONS.architect).toBe('🏗️');
      expect(AGENT_ICONS.developer).toBe('💻');
      expect(AGENT_ICONS.tester).toBe('🧪');
      expect(AGENT_ICONS.reviewer).toBe('👁️');
      expect(AGENT_ICONS.devops).toBe('⚙️');
    });
  });

  describe('AGENT_ICONS_ASCII', () => {
    it('should have ASCII equivalents for all emoji icons', () => {
      const emojiKeys = Object.keys(AGENT_ICONS);
      const asciiKeys = Object.keys(AGENT_ICONS_ASCII);

      expect(asciiKeys.sort()).toEqual(emojiKeys.sort());
    });

    it('should use bracketed format for ASCII icons', () => {
      Object.values(AGENT_ICONS_ASCII).forEach(icon => {
        expect(icon).toMatch(/^\[.*\]$/);
      });
    });

    it('should have correct ASCII mappings', () => {
      expect(AGENT_ICONS_ASCII.planner).toBe('[P]');
      expect(AGENT_ICONS_ASCII.architect).toBe('[A]');
      expect(AGENT_ICONS_ASCII.developer).toBe('[D]');
      expect(AGENT_ICONS_ASCII.tester).toBe('[T]');
      expect(AGENT_ICONS_ASCII.reviewer).toBe('[R]');
      expect(AGENT_ICONS_ASCII.devops).toBe('[O]');
      expect(AGENT_ICONS_ASCII.default).toBe('[?]');
    });
  });

  describe('getAgentIcon', () => {
    it('should return emoji icon for known agents by default', () => {
      expect(getAgentIcon('planner')).toBe('📋');
      expect(getAgentIcon('developer')).toBe('💻');
      expect(getAgentIcon('tester')).toBe('🧪');
    });

    it('should return ASCII icon when useAscii is true', () => {
      expect(getAgentIcon('planner', true)).toBe('[P]');
      expect(getAgentIcon('developer', true)).toBe('[D]');
      expect(getAgentIcon('tester', true)).toBe('[T]');
    });

    it('should return default icon for unknown agents', () => {
      expect(getAgentIcon('unknown-agent')).toBe('🤖');
      expect(getAgentIcon('unknown-agent', true)).toBe('[?]');
    });

    it('should use custom icons when provided', () => {
      const customIcons = {
        planner: '🗓️',
        developer: '⚡',
        'custom-agent': '🚀',
      };

      expect(getAgentIcon('planner', false, customIcons)).toBe('🗓️');
      expect(getAgentIcon('developer', false, customIcons)).toBe('⚡');
      expect(getAgentIcon('custom-agent', false, customIcons)).toBe('🚀');
    });

    it('should prioritize custom icons over standard icons', () => {
      const customIcons = {
        planner: '🎯',
      };

      expect(getAgentIcon('planner', false, customIcons)).toBe('🎯');
      expect(getAgentIcon('planner')).toBe('📋'); // Without custom icons
    });

    it('should fall back to standard icons when custom icon not found', () => {
      const customIcons = {
        developer: '⚡',
      };

      expect(getAgentIcon('planner', false, customIcons)).toBe('📋');
      expect(getAgentIcon('unknown', false, customIcons)).toBe('🤖');
    });
  });

  describe('getIconAnimationConfig', () => {
    it('should return correct config for entering phase', () => {
      const config = getIconAnimationConfig(0.2); // 20% progress

      expect(config.showSourceIcon).toBe(true);
      expect(config.showTargetIcon).toBe(true);
      expect(config.sourceOpacity).toBe('full');
      expect(config.targetOpacity).toBe('dim');
      expect(config.iconFrame).toBe(0);
    });

    it('should return correct config for active phase', () => {
      const config = getIconAnimationConfig(0.5); // 50% progress

      expect(config.showSourceIcon).toBe(true);
      expect(config.showTargetIcon).toBe(true);
      expect(config.sourceOpacity).toBe('full');
      expect(config.targetOpacity).toBe('full');
      expect(config.iconFrame).toBeGreaterThan(0);
      expect(config.iconFrame).toBeLessThan(7);
    });

    it('should return correct config for exiting phase', () => {
      const config = getIconAnimationConfig(0.8); // 80% progress

      expect(config.showSourceIcon).toBe(true);
      expect(config.showTargetIcon).toBe(true);
      expect(config.sourceOpacity).toBe('dim');
      expect(config.targetOpacity).toBe('full');
      expect(config.iconFrame).toBe(7);
    });

    it('should handle edge cases', () => {
      // Progress 0
      const config0 = getIconAnimationConfig(0);
      expect(config0.sourceOpacity).toBe('full');
      expect(config0.targetOpacity).toBe('dim');
      expect(config0.iconFrame).toBe(0);

      // Progress 1
      const config1 = getIconAnimationConfig(1);
      expect(config1.sourceOpacity).toBe('dim');
      expect(config1.targetOpacity).toBe('full');
      expect(config1.iconFrame).toBe(7);

      // Progress > 1 (edge case)
      const configOver = getIconAnimationConfig(1.5);
      expect(configOver.sourceOpacity).toBe('dim');
      expect(configOver.targetOpacity).toBe('full');
      expect(configOver.iconFrame).toBe(7);
    });

    it('should calculate iconFrame correctly during active phase', () => {
      // Test different points in active phase (25% to 75%)
      const testPoints = [
        { progress: 0.25, expectedMinFrame: 0 },
        { progress: 0.4, expectedMinFrame: 1 },
        { progress: 0.6, expectedMinFrame: 2 },
        { progress: 0.74, expectedMinFrame: 3 },
      ];

      testPoints.forEach(({ progress, expectedMinFrame }) => {
        const config = getIconAnimationConfig(progress);
        expect(config.iconFrame).toBeGreaterThanOrEqual(expectedMinFrame);
        expect(config.iconFrame).toBeLessThanOrEqual(7);
      });
    });
  });

  describe('detectEmojiSupport', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      // Reset env vars before each test
      delete process.env.TERM;
      delete process.env.COLORTERM;
      delete process.env.TERM_PROGRAM;
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    it('should detect support from TERM environment variable', () => {
      process.env.TERM = 'xterm-256color';
      expect(detectEmojiSupport()).toBe(true);

      process.env.TERM = 'screen-256color';
      expect(detectEmojiSupport()).toBe(true);

      process.env.TERM = 'tmux-256color';
      expect(detectEmojiSupport()).toBe(true);
    });

    it('should detect support from COLORTERM environment variable', () => {
      process.env.COLORTERM = 'truecolor';
      expect(detectEmojiSupport()).toBe(true);

      process.env.COLORTERM = '24bit';
      expect(detectEmojiSupport()).toBe(true);
    });

    it('should detect support from TERM_PROGRAM environment variable', () => {
      process.env.TERM_PROGRAM = 'iTerm.app';
      expect(detectEmojiSupport()).toBe(true);

      process.env.TERM_PROGRAM = 'Apple_Terminal';
      expect(detectEmojiSupport()).toBe(true);

      process.env.TERM_PROGRAM = 'vscode';
      expect(detectEmojiSupport()).toBe(true);

      process.env.TERM_PROGRAM = 'hyper';
      expect(detectEmojiSupport()).toBe(true);
    });

    it('should default to true for unknown environments', () => {
      // No environment variables set
      expect(detectEmojiSupport()).toBe(true);
    });

    it('should handle unsupported terminal types', () => {
      process.env.TERM = 'dumb';
      process.env.COLORTERM = '';
      process.env.TERM_PROGRAM = '';

      // Since we default to true, even unsupported should return true
      // This is intentional as emoji support is widespread now
      expect(detectEmojiSupport()).toBe(true);
    });
  });

  describe('shouldUseAsciiIcons', () => {
    it('should respect forceAscii parameter when provided', () => {
      expect(shouldUseAsciiIcons(true)).toBe(true);
      expect(shouldUseAsciiIcons(false)).toBe(false);
    });

    it('should auto-detect when forceAscii is undefined', () => {
      // Mock detectEmojiSupport for predictable testing
      const originalDetect = detectEmojiSupport;

      // Test when emoji support is detected
      (global as any).detectEmojiSupport = jest.fn(() => true);
      expect(shouldUseAsciiIcons()).toBe(false);

      // Test when emoji support is not detected
      (global as any).detectEmojiSupport = jest.fn(() => false);
      expect(shouldUseAsciiIcons()).toBe(true);

      // Restore original function
      (global as any).detectEmojiSupport = originalDetect;
    });
  });

  describe('icon mappings consistency', () => {
    it('should have same agents in both emoji and ASCII sets', () => {
      const emojiAgents = Object.keys(AGENT_ICONS).sort();
      const asciiAgents = Object.keys(AGENT_ICONS_ASCII).sort();

      expect(emojiAgents).toEqual(asciiAgents);
    });

    it('should have meaningful ASCII equivalents', () => {
      const mappings = [
        { agent: 'planner', ascii: '[P]', reason: 'P for Planner' },
        { agent: 'architect', ascii: '[A]', reason: 'A for Architect' },
        { agent: 'developer', ascii: '[D]', reason: 'D for Developer' },
        { agent: 'tester', ascii: '[T]', reason: 'T for Tester' },
        { agent: 'reviewer', ascii: '[R]', reason: 'R for Reviewer' },
        { agent: 'devops', ascii: '[O]', reason: 'O for Operations' },
        { agent: 'default', ascii: '[?]', reason: '? for unknown' },
      ];

      mappings.forEach(({ agent, ascii, reason }) => {
        expect(AGENT_ICONS_ASCII[agent]).toBe(ascii);
      });
    });
  });

  describe('error handling', () => {
    it('should handle null/undefined agent names', () => {
      expect(getAgentIcon(null as any)).toBe('🤖');
      expect(getAgentIcon(undefined as any)).toBe('🤖');
      expect(getAgentIcon('')).toBe('🤖');
    });

    it('should handle empty custom icon maps', () => {
      expect(getAgentIcon('planner', false, {})).toBe('📋');
      expect(getAgentIcon('planner', false, null as any)).toBe('📋');
      expect(getAgentIcon('planner', false, undefined)).toBe('📋');
    });

    it('should handle negative progress values', () => {
      const config = getIconAnimationConfig(-0.5);
      expect(config.iconFrame).toBeGreaterThanOrEqual(0);
      expect(config.showSourceIcon).toBe(true);
      expect(config.showTargetIcon).toBe(true);
    });
  });
});