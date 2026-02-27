import { describe, it, expect, vi } from 'vitest';
import { DriverFactory } from '../index.js';
import { AnthropicDriver } from '../anthropic-driver.js';
import { OpenAiCodexDriver } from '../openai-driver.js';

describe('DriverFactory', () => {
  it('should return an AnthropicDriver for "anthropic"', () => {
    const driver = DriverFactory.getDriver('anthropic');
    expect(driver).toBeInstanceOf(AnthropicDriver);
    expect(driver.providerId).toBe('anthropic');
  });

  it('should return an OpenAiCodexDriver for "openai"', () => {
    const driver = DriverFactory.getDriver('openai');
    expect(driver).toBeInstanceOf(OpenAiCodexDriver);
    expect(driver.providerId).toBe('openai-codex');
  });

  it('should throw for unknown providers', () => {
    expect(() => DriverFactory.getDriver('unknown')).toThrow('Unsupported AI provider: unknown');
  });

  it('should return the same instance for the same provider', () => {
    const driver1 = DriverFactory.getDriver('anthropic');
    const driver2 = DriverFactory.getDriver('anthropic');
    expect(driver1).toBe(driver2);
  });
});
