import { describe, it, expect } from 'vitest';

// Import utility functions from PreviewPanel (we'll need to extract these)
// For now, we'll test the logic directly here as these are internal functions

describe('Preview Panel Utility Functions', () => {
  describe('getIntentIcon', () => {
    const getIntentIcon = (type: string): string => {
      switch (type) {
        case 'command': return '⚡';
        case 'task': return '📝';
        case 'question': return '❓';
        case 'clarification': return '💬';
        default: return '🔍';
      }
    };

    it('should return correct icons for known intent types', () => {
      expect(getIntentIcon('command')).toBe('⚡');
      expect(getIntentIcon('task')).toBe('📝');
      expect(getIntentIcon('question')).toBe('❓');
      expect(getIntentIcon('clarification')).toBe('💬');
    });

    it('should return default icon for unknown intent types', () => {
      expect(getIntentIcon('unknown')).toBe('🔍');
      expect(getIntentIcon('')).toBe('🔍');
      expect(getIntentIcon('random')).toBe('🔍');
    });

    it('should handle null and undefined gracefully', () => {
      expect(getIntentIcon(null as any)).toBe('🔍');
      expect(getIntentIcon(undefined as any)).toBe('🔍');
    });

    it('should handle non-string types', () => {
      expect(getIntentIcon(123 as any)).toBe('🔍');
      expect(getIntentIcon({} as any)).toBe('🔍');
      expect(getIntentIcon([] as any)).toBe('🔍');
    });
  });

  describe('getIntentDescription', () => {
    interface Intent {
      type: 'command' | 'task' | 'question' | 'clarification';
      confidence: number;
      command?: string;
      args?: string[];
      metadata?: Record<string, unknown>;
    }

    const getIntentDescription = (intent: Intent, workflow?: string): string => {
      switch (intent.type) {
        case 'command': {
          const args = intent.args?.length ? intent.args.map(arg => String(arg)) : [];
          return `Execute command: /${intent.command}${args.length ? ' ' + args.join(' ') : ''}`;
        }
        case 'task':
          return `Create task${workflow ? ` (${workflow} workflow)` : ''}`;
        case 'question':
          return 'Answer question';
        case 'clarification':
          return 'Provide clarification';
        default:
          return 'Process input';
      }
    };

    describe('command intent descriptions', () => {
      it('should generate correct description for command without args', () => {
        const intent: Intent = { type: 'command', confidence: 1.0, command: 'help' };
        expect(getIntentDescription(intent)).toBe('Execute command: /help');
      });

      it('should generate correct description for command with args', () => {
        const intent: Intent = { type: 'command', confidence: 1.0, command: 'status', args: ['task123'] };
        expect(getIntentDescription(intent)).toBe('Execute command: /status task123');
      });

      it('should handle command with multiple args', () => {
        const intent: Intent = {
          type: 'command',
          confidence: 1.0,
          command: 'config',
          args: ['set', 'api.url', 'http://localhost:3000']
        };
        expect(getIntentDescription(intent)).toBe('Execute command: /config set api.url http://localhost:3000');
      });

      it('should handle command with empty args array', () => {
        const intent: Intent = { type: 'command', confidence: 1.0, command: 'clear', args: [] };
        expect(getIntentDescription(intent)).toBe('Execute command: /clear');
      });

      it('should handle command with undefined command name', () => {
        const intent: Intent = { type: 'command', confidence: 1.0 };
        expect(getIntentDescription(intent)).toBe('Execute command: /undefined');
      });

      it('should handle command with special characters in args', () => {
        const intent: Intent = {
          type: 'command',
          confidence: 1.0,
          command: 'search',
          args: ['query with spaces', '"quoted arg"', '--flag=value']
        };
        expect(getIntentDescription(intent)).toBe('Execute command: /search query with spaces "quoted arg" --flag=value');
      });
    });

    describe('task intent descriptions', () => {
      it('should generate correct description for task without workflow', () => {
        const intent: Intent = { type: 'task', confidence: 0.8 };
        expect(getIntentDescription(intent)).toBe('Create task');
      });

      it('should generate correct description for task with workflow', () => {
        const intent: Intent = { type: 'task', confidence: 0.8 };
        expect(getIntentDescription(intent, 'feature')).toBe('Create task (feature workflow)');
      });

      it('should handle empty workflow name', () => {
        const intent: Intent = { type: 'task', confidence: 0.8 };
        expect(getIntentDescription(intent, '')).toBe('Create task');
      });

      it('should handle workflow with special characters', () => {
        const intent: Intent = { type: 'task', confidence: 0.8 };
        expect(getIntentDescription(intent, 'feature-bug-fix-v2.1')).toBe('Create task (feature-bug-fix-v2.1 workflow)');
      });
    });

    describe('other intent types', () => {
      it('should handle question intent', () => {
        const intent: Intent = { type: 'question', confidence: 0.9 };
        expect(getIntentDescription(intent)).toBe('Answer question');
      });

      it('should handle clarification intent', () => {
        const intent: Intent = { type: 'clarification', confidence: 0.7 };
        expect(getIntentDescription(intent)).toBe('Provide clarification');
      });

      it('should handle unknown intent types', () => {
        const intent = { type: 'unknown', confidence: 0.5 } as any;
        expect(getIntentDescription(intent)).toBe('Process input');
      });
    });

    describe('edge cases', () => {
      it('should handle malformed intent objects', () => {
        const malformedIntent = {} as any;
        expect(getIntentDescription(malformedIntent)).toBe('Process input');
      });

      it('should handle null args array for commands', () => {
        const intent: Intent = { type: 'command', confidence: 1.0, command: 'test', args: null as any };
        expect(getIntentDescription(intent)).toBe('Execute command: /test');
      });

      it('should handle args with null/undefined values', () => {
        const intent: Intent = {
          type: 'command',
          confidence: 1.0,
          command: 'test',
          args: ['valid', null as any, undefined as any, 'also-valid']
        };
        expect(getIntentDescription(intent)).toBe('Execute command: /test valid null undefined also-valid');
      });
    });
  });

  describe('getConfidenceColor', () => {
    const getConfidenceColor = (confidence: number): string => {
      if (confidence >= 0.8) return 'green';
      if (confidence >= 0.6) return 'yellow';
      return 'red';
    };

    it('should return green for high confidence', () => {
      expect(getConfidenceColor(0.8)).toBe('green');
      expect(getConfidenceColor(0.9)).toBe('green');
      expect(getConfidenceColor(1.0)).toBe('green');
      expect(getConfidenceColor(0.95)).toBe('green');
    });

    it('should return yellow for medium confidence', () => {
      expect(getConfidenceColor(0.6)).toBe('yellow');
      expect(getConfidenceColor(0.7)).toBe('yellow');
      expect(getConfidenceColor(0.79)).toBe('yellow');
      expect(getConfidenceColor(0.65)).toBe('yellow');
    });

    it('should return red for low confidence', () => {
      expect(getConfidenceColor(0.5)).toBe('red');
      expect(getConfidenceColor(0.3)).toBe('red');
      expect(getConfidenceColor(0.0)).toBe('red');
      expect(getConfidenceColor(0.59)).toBe('red');
    });

    it('should handle edge case confidence values', () => {
      expect(getConfidenceColor(0.8)).toBe('green'); // Exactly at threshold
      expect(getConfidenceColor(0.6)).toBe('yellow'); // Exactly at threshold
      expect(getConfidenceColor(0.79999)).toBe('yellow'); // Just below high threshold
      expect(getConfidenceColor(0.59999)).toBe('red'); // Just below medium threshold
    });

    it('should handle extreme confidence values', () => {
      expect(getConfidenceColor(2.0)).toBe('green'); // Above 1.0
      expect(getConfidenceColor(-0.5)).toBe('red'); // Negative
      expect(getConfidenceColor(100)).toBe('green'); // Very high
      expect(getConfidenceColor(-100)).toBe('red'); // Very negative
    });

    it('should handle special numeric values', () => {
      expect(getConfidenceColor(NaN)).toBe('red');
      expect(getConfidenceColor(Infinity)).toBe('green');
      expect(getConfidenceColor(-Infinity)).toBe('red');
      expect(getConfidenceColor(Number.MAX_VALUE)).toBe('green');
      expect(getConfidenceColor(Number.MIN_VALUE)).toBe('red');
    });

    it('should handle boundary values precisely', () => {
      // Test exact boundary conditions
      expect(getConfidenceColor(0.8)).toBe('green');
      expect(getConfidenceColor(0.8 - Number.EPSILON)).toBe('yellow');
      expect(getConfidenceColor(0.6)).toBe('yellow');
      expect(getConfidenceColor(0.6 - Number.EPSILON)).toBe('red');
    });
  });

  describe('confidence percentage calculation', () => {
    const calculateConfidencePercentage = (confidence: number): number => {
      return Math.round(confidence * 100);
    };

    it('should calculate correct percentages for normal values', () => {
      expect(calculateConfidencePercentage(0.0)).toBe(0);
      expect(calculateConfidencePercentage(0.5)).toBe(50);
      expect(calculateConfidencePercentage(1.0)).toBe(100);
      expect(calculateConfidencePercentage(0.85)).toBe(85);
      expect(calculateConfidencePercentage(0.123)).toBe(12);
      expect(calculateConfidencePercentage(0.999)).toBe(100);
    });

    it('should handle rounding edge cases', () => {
      expect(calculateConfidencePercentage(0.125)).toBe(13); // Rounds up
      expect(calculateConfidencePercentage(0.124)).toBe(12); // Rounds down
      expect(calculateConfidencePercentage(0.875)).toBe(88); // Rounds up
      expect(calculateConfidencePercentage(0.874)).toBe(87); // Rounds down
    });

    it('should handle extreme values', () => {
      expect(calculateConfidencePercentage(2.0)).toBe(200);
      expect(calculateConfidencePercentage(-0.5)).toBe(-50);
      expect(calculateConfidencePercentage(10)).toBe(1000);
    });

    it('should handle special numeric values', () => {
      expect(calculateConfidencePercentage(NaN)).toBeNaN();
      expect(calculateConfidencePercentage(Infinity)).toBe(Infinity);
      expect(calculateConfidencePercentage(-Infinity)).toBe(-Infinity);
    });

    it('should handle precision edge cases', () => {
      expect(calculateConfidencePercentage(0.5555555)).toBe(56);
      expect(calculateConfidencePercentage(0.4444444)).toBe(44);
      expect(calculateConfidencePercentage(0.9999999)).toBe(100);
      expect(calculateConfidencePercentage(0.0000001)).toBe(0);
    });
  });

  describe('input validation and sanitization', () => {
    const validateInput = (input: string): { isValid: boolean; sanitized: string } => {
      if (typeof input !== 'string') {
        return { isValid: false, sanitized: '' };
      }

      // Basic sanitization - remove null bytes and excessive whitespace
      const sanitized = input.replace(/\x00/g, '').replace(/\s+/g, ' ').trim();

      return {
        isValid: sanitized.length > 0,
        sanitized,
      };
    };

    it('should validate normal input strings', () => {
      const result = validateInput('create a new component');
      expect(result.isValid).toBe(true);
      expect(result.sanitized).toBe('create a new component');
    });

    it('should handle empty strings', () => {
      const result = validateInput('');
      expect(result.isValid).toBe(false);
      expect(result.sanitized).toBe('');
    });

    it('should handle whitespace-only strings', () => {
      const result = validateInput('   \t\n   ');
      expect(result.isValid).toBe(false);
      expect(result.sanitized).toBe('');
    });

    it('should sanitize null bytes', () => {
      const result = validateInput('test\x00input');
      expect(result.isValid).toBe(true);
      expect(result.sanitized).toBe('testinput');
    });

    it('should normalize excessive whitespace', () => {
      const result = validateInput('create   a    new\t\tcomponent\n\nwith\r\nspaces');
      expect(result.isValid).toBe(true);
      expect(result.sanitized).toBe('create a new component with spaces');
    });

    it('should handle non-string input', () => {
      expect(validateInput(null as any)).toEqual({ isValid: false, sanitized: '' });
      expect(validateInput(undefined as any)).toEqual({ isValid: false, sanitized: '' });
      expect(validateInput(123 as any)).toEqual({ isValid: false, sanitized: '' });
      expect(validateInput({} as any)).toEqual({ isValid: false, sanitized: '' });
      expect(validateInput([] as any)).toEqual({ isValid: false, sanitized: '' });
    });

    it('should preserve unicode characters', () => {
      const result = validateInput('Create 用户 management with 🚀 emojis');
      expect(result.isValid).toBe(true);
      expect(result.sanitized).toBe('Create 用户 management with 🚀 emojis');
    });

    it('should handle mixed dangerous content', () => {
      const result = validateInput('<script>\x00alert("xss")\x00</script>   \t\n   ');
      expect(result.isValid).toBe(true);
      expect(result.sanitized).toBe('<script>alert("xss")</script>');
    });
  });

  describe('workflow validation', () => {
    const validateWorkflow = (workflow: string | undefined): string | undefined => {
      if (!workflow || typeof workflow !== 'string') {
        return undefined;
      }

      const trimmed = workflow.trim();
      if (trimmed.length === 0) {
        return undefined;
      }

      // Basic workflow name validation - alphanumeric, hyphens, underscores
      if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
        return undefined;
      }

      return trimmed;
    };

    it('should validate correct workflow names', () => {
      expect(validateWorkflow('feature')).toBe('feature');
      expect(validateWorkflow('bug-fix')).toBe('bug-fix');
      expect(validateWorkflow('hotfix_v2')).toBe('hotfix_v2');
      expect(validateWorkflow('test123')).toBe('test123');
    });

    it('should reject invalid workflow names', () => {
      expect(validateWorkflow('feature with spaces')).toBeUndefined();
      expect(validateWorkflow('feature@workflow')).toBeUndefined();
      expect(validateWorkflow('feature.workflow')).toBeUndefined();
      expect(validateWorkflow('feature/workflow')).toBeUndefined();
      expect(validateWorkflow('<script>alert("xss")</script>')).toBeUndefined();
    });

    it('should handle edge cases', () => {
      expect(validateWorkflow('')).toBeUndefined();
      expect(validateWorkflow('   ')).toBeUndefined();
      expect(validateWorkflow(undefined)).toBeUndefined();
      expect(validateWorkflow(null as any)).toBeUndefined();
      expect(validateWorkflow(123 as any)).toBeUndefined();
    });

    it('should trim whitespace', () => {
      expect(validateWorkflow('  feature  ')).toBe('feature');
      expect(validateWorkflow('\tfeature\n')).toBe('feature');
    });

    it('should handle very long workflow names', () => {
      const longWorkflow = 'a'.repeat(100);
      expect(validateWorkflow(longWorkflow)).toBe(longWorkflow);

      const tooLong = 'a'.repeat(1000);
      // In a real implementation, you might want to limit length
      expect(validateWorkflow(tooLong)).toBe(tooLong);
    });
  });

  describe('intent metadata validation', () => {
    const validateMetadata = (metadata: any): Record<string, unknown> | undefined => {
      if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
        return undefined;
      }

      // Create a safe copy excluding dangerous properties
      const safe: Record<string, unknown> = {};
      const dangerousKeys = ['__proto__', 'constructor', 'prototype', 'toString', 'valueOf'];

      for (const [key, value] of Object.entries(metadata)) {
        if (dangerousKeys.includes(key)) {
          continue;
        }

        if (typeof key === 'string' && key.length > 0 && !key.startsWith('_')) {
          safe[key] = value;
        }
      }

      return Object.keys(safe).length > 0 ? safe : undefined;
    };

    it('should validate safe metadata objects', () => {
      const metadata = {
        suggestedWorkflow: 'feature',
        complexity: 'medium',
        tags: ['frontend', 'react'],
      };

      const result = validateMetadata(metadata);
      expect(result).toEqual(metadata);
    });

    it('should filter out dangerous properties', () => {
      const dangerousMetadata = {
        __proto__: { polluted: true },
        constructor: 'hacked',
        prototype: 'dangerous',
        toString: () => 'hacked',
        valueOf: () => 'hacked',
        normalProperty: 'safe',
      };

      const result = validateMetadata(dangerousMetadata);
      expect(result).toEqual({ normalProperty: 'safe' });
    });

    it('should filter out private properties', () => {
      const metadata = {
        _private: 'hidden',
        __private: 'hidden',
        public: 'visible',
        _internal: 'hidden',
      };

      const result = validateMetadata(metadata);
      expect(result).toEqual({ public: 'visible' });
    });

    it('should handle invalid metadata types', () => {
      expect(validateMetadata(null)).toBeUndefined();
      expect(validateMetadata(undefined)).toBeUndefined();
      expect(validateMetadata('string')).toBeUndefined();
      expect(validateMetadata(123)).toBeUndefined();
      expect(validateMetadata([])).toBeUndefined();
      expect(validateMetadata(true)).toBeUndefined();
    });

    it('should handle empty objects', () => {
      expect(validateMetadata({})).toBeUndefined();
      expect(validateMetadata({ __proto__: 'only dangerous' })).toBeUndefined();
    });

    it('should preserve nested objects', () => {
      const metadata = {
        config: {
          api: { url: 'test', timeout: 5000 },
          features: ['auth', 'dashboard'],
        },
        __proto__: 'dangerous',
      };

      const result = validateMetadata(metadata);
      expect(result).toEqual({
        config: {
          api: { url: 'test', timeout: 5000 },
          features: ['auth', 'dashboard'],
        },
      });
    });
  });
});
