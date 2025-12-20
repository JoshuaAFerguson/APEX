import React from 'react';
import { describe, it, expect } from 'vitest';
import { CollapsibleSection } from '../CollapsibleSection.js';
import { Text } from 'ink';

describe('CollapsibleSection Basic Tests', () => {
  it('should export CollapsibleSection component', () => {
    expect(CollapsibleSection).toBeDefined();
    expect(typeof CollapsibleSection).toBe('function');
  });

  it('should create component instance', () => {
    const element = React.createElement(CollapsibleSection, {
      title: 'Test',
      children: React.createElement(Text, {}, 'Content')
    });

    expect(element).toBeDefined();
    expect(element.type).toBe(CollapsibleSection);
  });
});