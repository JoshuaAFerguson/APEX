import React from 'react';
import { render } from 'ink-testing-library';
import { describe, it, expect } from 'vitest';
import { ServicesPanel } from '../ServicesPanel';

describe('ServicesPanel', () => {
  describe('Rendering Behavior', () => {
    it('should not render when no services are provided', () => {
      const { lastFrame } = render(<ServicesPanel />);
      expect(lastFrame()).toBe('');
    });

    it('should not render when both services are undefined', () => {
      const { lastFrame } = render(<ServicesPanel apiUrl={undefined} webUrl={undefined} />);
      expect(lastFrame()).toBe('');
    });

    it('should not render when both services are empty strings', () => {
      const { lastFrame } = render(<ServicesPanel apiUrl="" webUrl="" />);
      expect(lastFrame()).toBe('');
    });

    it('should render when only API URL is provided', () => {
      const { lastFrame } = render(<ServicesPanel apiUrl="http://localhost:3000" />);
      const output = lastFrame();

      expect(output).toContain('Services Running');
      expect(output).toContain('API: http://localhost:3000');
      expect(output).not.toContain('Web:');
    });

    it('should render when only Web URL is provided', () => {
      const { lastFrame } = render(<ServicesPanel webUrl="http://localhost:8080" />);
      const output = lastFrame();

      expect(output).toContain('Services Running');
      expect(output).toContain('Web: http://localhost:8080');
      expect(output).not.toContain('API:');
    });

    it('should render both services when both URLs are provided', () => {
      const { lastFrame } = render(
        <ServicesPanel
          apiUrl="http://localhost:3000"
          webUrl="http://localhost:8080"
        />
      );
      const output = lastFrame();

      expect(output).toContain('Services Running');
      expect(output).toContain('API: http://localhost:3000');
      expect(output).toContain('Web: http://localhost:8080');
    });
  });

  describe('URL Formatting', () => {
    it('should handle localhost URLs correctly', () => {
      const { lastFrame } = render(
        <ServicesPanel
          apiUrl="http://localhost:3000/api"
          webUrl="http://localhost:8080/app"
        />
      );
      const output = lastFrame();

      expect(output).toContain('API: http://localhost:3000/api');
      expect(output).toContain('Web: http://localhost:8080/app');
    });

    it('should handle different protocols correctly', () => {
      const { lastFrame } = render(
        <ServicesPanel
          apiUrl="https://api.example.com"
          webUrl="https://app.example.com"
        />
      );
      const output = lastFrame();

      expect(output).toContain('API: https://api.example.com');
      expect(output).toContain('Web: https://app.example.com');
    });

    it('should handle URLs with ports', () => {
      const { lastFrame } = render(
        <ServicesPanel
          apiUrl="http://192.168.1.100:3000"
          webUrl="http://192.168.1.100:8080"
        />
      );
      const output = lastFrame();

      expect(output).toContain('API: http://192.168.1.100:3000');
      expect(output).toContain('Web: http://192.168.1.100:8080');
    });

    it('should handle URLs with query parameters', () => {
      const { lastFrame } = render(
        <ServicesPanel
          apiUrl="http://localhost:3000?debug=true"
          webUrl="http://localhost:8080?theme=dark"
        />
      );
      const output = lastFrame();

      expect(output).toContain('API: http://localhost:3000?debug=true');
      expect(output).toContain('Web: http://localhost:8080?theme=dark');
    });

    it('should handle very long URLs', () => {
      const longUrl = 'http://very-long-domain-name.example.com:8080/api/v1/very/long/path/with/many/segments?param1=value1&param2=value2&param3=value3';
      const { lastFrame } = render(<ServicesPanel apiUrl={longUrl} />);
      const output = lastFrame();

      expect(output).toContain(`API: ${longUrl}`);
    });
  });

  describe('Edge Cases', () => {
    it('should handle special characters in URLs', () => {
      const { lastFrame } = render(
        <ServicesPanel
          apiUrl="http://localhost:3000/api?query=test%20value"
          webUrl="http://localhost:8080/app#section"
        />
      );
      const output = lastFrame();

      expect(output).toContain('API: http://localhost:3000/api?query=test%20value');
      expect(output).toContain('Web: http://localhost:8080/app#section');
    });

    it('should handle invalid URLs gracefully', () => {
      const { lastFrame } = render(
        <ServicesPanel
          apiUrl="not-a-valid-url"
          webUrl="also-invalid"
        />
      );
      const output = lastFrame();

      expect(output).toContain('API: not-a-valid-url');
      expect(output).toContain('Web: also-invalid');
    });

    it('should handle empty URLs differently from undefined', () => {
      // Empty strings should not render the service
      const { lastFrame: frame1 } = render(
        <ServicesPanel apiUrl="" webUrl="http://localhost:8080" />
      );
      const output1 = frame1();
      expect(output1).toContain('Web: http://localhost:8080');
      expect(output1).not.toContain('API:');

      // But space-only URLs should render
      const { lastFrame: frame2 } = render(
        <ServicesPanel apiUrl=" " webUrl="http://localhost:8080" />
      );
      const output2 = frame2();
      expect(output2).toContain('API:  ');
    });

    it('should handle switching from no services to services', () => {
      const { lastFrame, rerender } = render(<ServicesPanel />);
      expect(lastFrame()).toBe('');

      rerender(<ServicesPanel apiUrl="http://localhost:3000" />);
      expect(lastFrame()).toContain('Services Running');
      expect(lastFrame()).toContain('API: http://localhost:3000');
    });

    it('should handle switching from services to no services', () => {
      const { lastFrame, rerender } = render(
        <ServicesPanel apiUrl="http://localhost:3000" />
      );
      expect(lastFrame()).toContain('Services Running');

      rerender(<ServicesPanel />);
      expect(lastFrame()).toBe('');
    });

    it('should handle updating service URLs', () => {
      const { lastFrame, rerender } = render(
        <ServicesPanel apiUrl="http://localhost:3000" />
      );
      expect(lastFrame()).toContain('API: http://localhost:3000');

      rerender(<ServicesPanel apiUrl="http://localhost:3001" />);
      expect(lastFrame()).toContain('API: http://localhost:3001');
      expect(lastFrame()).not.toContain('3000');
    });
  });

  describe('Layout and Styling', () => {
    it('should render with proper box styling', () => {
      const { lastFrame } = render(
        <ServicesPanel apiUrl="http://localhost:3000" />
      );
      const output = lastFrame();

      // Should contain border characters (testing for rounded border)
      expect(output).toMatch(/[╭╮╯╰]/);
    });

    it('should have consistent structure with both services', () => {
      const { lastFrame } = render(
        <ServicesPanel
          apiUrl="http://localhost:3000"
          webUrl="http://localhost:8080"
        />
      );
      const output = lastFrame();

      // Services Running should come before the URLs
      const servicesIndex = output.indexOf('Services Running');
      const apiIndex = output.indexOf('API:');
      const webIndex = output.indexOf('Web:');

      expect(servicesIndex).toBeGreaterThan(-1);
      expect(apiIndex).toBeGreaterThan(servicesIndex);
      expect(webIndex).toBeGreaterThan(apiIndex);
    });

    it('should maintain consistent spacing and alignment', () => {
      const { lastFrame } = render(
        <ServicesPanel
          apiUrl="http://localhost:3000"
          webUrl="http://localhost:8080/very/long/path"
        />
      );
      const output = lastFrame();

      // Both API and Web lines should be present
      const lines = output.split('\n').filter(line => line.includes('API:') || line.includes('Web:'));
      expect(lines).toHaveLength(2);
    });
  });

  describe('Accessibility and Usability', () => {
    it('should use descriptive labels for screen readers', () => {
      const { lastFrame } = render(
        <ServicesPanel
          apiUrl="http://localhost:3000"
          webUrl="http://localhost:8080"
        />
      );
      const output = lastFrame();

      // Labels should be clear and descriptive
      expect(output).toContain('API:');
      expect(output).toContain('Web:');
      expect(output).toContain('Services Running');
    });

    it('should provide visual distinction between service types', () => {
      const { lastFrame } = render(
        <ServicesPanel
          apiUrl="http://localhost:3000"
          webUrl="http://localhost:8080"
        />
      );
      const output = lastFrame();

      // Both service types should be clearly labeled
      expect(output).toContain('API:');
      expect(output).toContain('Web:');
    });

    it('should handle rapid re-renders without breaking', () => {
      const { lastFrame, rerender } = render(<ServicesPanel />);

      // Rapid updates
      for (let i = 0; i < 10; i++) {
        rerender(<ServicesPanel apiUrl={`http://localhost:${3000 + i}`} />);
      }

      const output = lastFrame();
      expect(output).toContain('Services Running');
      expect(output).toContain('http://localhost:3009');
    });
  });
});