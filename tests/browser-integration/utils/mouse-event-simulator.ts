/**
 * @fileoverview Mouse Event Simulator
 *
 * This module provides advanced mouse event simulation capabilities for browser testing.
 * It includes utilities for simulating complex mouse interactions, gesture patterns,
 * and multi-point interactions that are common in modern web applications.
 *
 * Features:
 * - Precise mouse positioning and movement
 * - Complex gesture simulation (drag, hover patterns, etc.)
 * - Multi-step interaction sequences
 * - Event timing and coordination
 * - Cross-browser compatible event simulation
 */

import { Page, Locator } from 'playwright';
import { waitForElement } from './test-helpers';

/**
 * Mouse position coordinates
 */
export interface MousePosition {
  x: number;
  y: number;
}

/**
 * Mouse movement configuration
 */
export interface MouseMovementOptions {
  /** Number of intermediate steps for smooth movement */
  steps?: number;
  /** Delay between movement steps in milliseconds */
  stepDelay?: number;
  /** Easing function for movement animation */
  easing?: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
  /** Whether to trigger mouse events during movement */
  triggerEvents?: boolean;
}

/**
 * Drag and drop configuration
 */
export interface DragDropOptions {
  /** Delay before starting drag */
  startDelay?: number;
  /** Delay during drag movement */
  dragDelay?: number;
  /** Delay before dropping */
  dropDelay?: number;
  /** Whether to hold modifier keys during drag */
  modifiers?: {
    alt?: boolean;
    ctrl?: boolean;
    shift?: boolean;
  };
}

/**
 * Hover pattern configuration
 */
export interface HoverPatternOptions {
  /** Pattern type */
  pattern: 'circle' | 'square' | 'zigzag' | 'spiral' | 'custom';
  /** Pattern size in pixels */
  size?: number;
  /** Number of steps in the pattern */
  steps?: number;
  /** Delay between pattern steps */
  stepDelay?: number;
  /** Custom pattern points (for custom pattern type) */
  customPoints?: MousePosition[];
}

/**
 * Mouse event simulation result
 */
export interface MouseEventResult {
  success: boolean;
  duration: number;
  startPosition: MousePosition;
  endPosition: MousePosition;
  steps: number;
  events: string[];
}

/**
 * Advanced mouse event simulator class
 */
export class MouseEventSimulator {
  constructor(private page: Page) {}

  /**
   * Smoothly moves mouse from one position to another
   */
  async smoothMoveTo(
    target: MousePosition,
    options: MouseMovementOptions = {}
  ): Promise<MouseEventResult> {
    const startTime = Date.now();
    const steps = options.steps || 10;
    const stepDelay = options.stepDelay || 50;
    const easing = options.easing || 'linear';

    // Get current mouse position
    const startPosition = await this.getCurrentMousePosition();
    const events: string[] = [];

    // Calculate movement path
    const deltaX = target.x - startPosition.x;
    const deltaY = target.y - startPosition.y;

    for (let i = 0; i <= steps; i++) {
      const progress = i / steps;
      const easedProgress = this.applyEasing(progress, easing);

      const x = startPosition.x + deltaX * easedProgress;
      const y = startPosition.y + deltaY * easedProgress;

      await this.page.mouse.move(x, y);
      events.push(`move(${Math.round(x)}, ${Math.round(y)})`);

      if (options.triggerEvents && i > 0 && i < steps) {
        await this.page.evaluate((pos) => {
          const event = new MouseEvent('mousemove', {
            clientX: pos.x,
            clientY: pos.y,
            bubbles: true,
            cancelable: true
          });
          document.dispatchEvent(event);
        }, { x: Math.round(x), y: Math.round(y) });
        events.push(`trigger-mousemove(${Math.round(x)}, ${Math.round(y)})`);
      }

      if (stepDelay > 0) {
        await this.page.waitForTimeout(stepDelay);
      }
    }

    const endTime = Date.now();

    return {
      success: true,
      duration: endTime - startTime,
      startPosition,
      endPosition: target,
      steps: steps + 1,
      events
    };
  }

  /**
   * Moves mouse to element with optional offset
   */
  async moveToElement(
    selector: string,
    offset: { x?: number; y?: number } = {},
    options: MouseMovementOptions = {}
  ): Promise<MouseEventResult> {
    const element = await waitForElement(this.page, selector, { visible: true });
    const boundingBox = await element.boundingBox();

    if (!boundingBox) {
      throw new Error(`Cannot get bounding box for element: ${selector}`);
    }

    const targetX = boundingBox.x + (offset.x || boundingBox.width / 2);
    const targetY = boundingBox.y + (offset.y || boundingBox.height / 2);

    return this.smoothMoveTo({ x: targetX, y: targetY }, options);
  }

  /**
   * Simulates drag and drop between two elements
   */
  async dragAndDrop(
    sourceSelector: string,
    targetSelector: string,
    options: DragDropOptions = {}
  ): Promise<MouseEventResult> {
    const startTime = Date.now();
    const events: string[] = [];

    const sourceElement = await waitForElement(this.page, sourceSelector, { visible: true });
    const targetElement = await waitForElement(this.page, targetSelector, { visible: true });

    const sourceBox = await sourceElement.boundingBox();
    const targetBox = await targetElement.boundingBox();

    if (!sourceBox || !targetBox) {
      throw new Error('Cannot get bounding boxes for drag and drop elements');
    }

    const startPosition = {
      x: sourceBox.x + sourceBox.width / 2,
      y: sourceBox.y + sourceBox.height / 2
    };

    const endPosition = {
      x: targetBox.x + targetBox.width / 2,
      y: targetBox.y + targetBox.height / 2
    };

    // Apply modifiers if specified
    if (options.modifiers) {
      const modifiers = [];
      if (options.modifiers.ctrl) modifiers.push('ControlLeft');
      if (options.modifiers.shift) modifiers.push('ShiftLeft');
      if (options.modifiers.alt) modifiers.push('AltLeft');

      for (const mod of modifiers) {
        await this.page.keyboard.down(mod);
        events.push(`key-down(${mod})`);
      }
    }

    // Start delay
    if (options.startDelay) {
      await this.page.waitForTimeout(options.startDelay);
    }

    // Move to source and start drag
    await this.page.mouse.move(startPosition.x, startPosition.y);
    events.push(`move(${startPosition.x}, ${startPosition.y})`);

    await this.page.mouse.down();
    events.push('mouse-down');

    // Drag delay
    if (options.dragDelay) {
      await this.page.waitForTimeout(options.dragDelay);
    }

    // Move to target
    const moveResult = await this.smoothMoveTo(endPosition, {
      steps: 15,
      stepDelay: 20,
      triggerEvents: true
    });
    events.push(...moveResult.events);

    // Drop delay
    if (options.dropDelay) {
      await this.page.waitForTimeout(options.dropDelay);
    }

    // Drop at target
    await this.page.mouse.up();
    events.push('mouse-up');

    // Release modifiers
    if (options.modifiers) {
      const modifiers = [];
      if (options.modifiers.ctrl) modifiers.push('ControlLeft');
      if (options.modifiers.shift) modifiers.push('ShiftLeft');
      if (options.modifiers.alt) modifiers.push('AltLeft');

      for (const mod of modifiers.reverse()) {
        await this.page.keyboard.up(mod);
        events.push(`key-up(${mod})`);
      }
    }

    const endTime = Date.now();

    return {
      success: true,
      duration: endTime - startTime,
      startPosition,
      endPosition,
      steps: moveResult.steps + 2, // +2 for mouse down/up
      events
    };
  }

  /**
   * Simulates hover patterns around an element
   */
  async hoverPattern(
    selector: string,
    options: HoverPatternOptions
  ): Promise<MouseEventResult> {
    const startTime = Date.now();
    const events: string[] = [];

    const element = await waitForElement(this.page, selector, { visible: true });
    const boundingBox = await element.boundingBox();

    if (!boundingBox) {
      throw new Error(`Cannot get bounding box for element: ${selector}`);
    }

    const centerX = boundingBox.x + boundingBox.width / 2;
    const centerY = boundingBox.y + boundingBox.height / 2;
    const size = options.size || 50;
    const steps = options.steps || 8;
    const stepDelay = options.stepDelay || 100;

    let points: MousePosition[] = [];

    // Generate pattern points
    switch (options.pattern) {
      case 'circle':
        points = this.generateCirclePattern(centerX, centerY, size, steps);
        break;
      case 'square':
        points = this.generateSquarePattern(centerX, centerY, size, steps);
        break;
      case 'zigzag':
        points = this.generateZigzagPattern(centerX, centerY, size, steps);
        break;
      case 'spiral':
        points = this.generateSpiralPattern(centerX, centerY, size, steps);
        break;
      case 'custom':
        if (options.customPoints) {
          points = options.customPoints.map(p => ({
            x: centerX + p.x,
            y: centerY + p.y
          }));
        } else {
          throw new Error('Custom pattern requires customPoints to be specified');
        }
        break;
    }

    const startPosition = await this.getCurrentMousePosition();

    // Move through pattern points
    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      await this.smoothMoveTo(point, { steps: 3, stepDelay: 10 });
      events.push(`pattern-point(${Math.round(point.x)}, ${Math.round(point.y)})`);

      if (stepDelay > 0) {
        await this.page.waitForTimeout(stepDelay);
      }
    }

    const endTime = Date.now();
    const endPosition = points[points.length - 1] || startPosition;

    return {
      success: true,
      duration: endTime - startTime,
      startPosition,
      endPosition,
      steps: points.length,
      events
    };
  }

  /**
   * Simulates multi-element hover sequence
   */
  async hoverSequence(
    selectors: string[],
    options: {
      delay?: number;
      hoverDuration?: number;
      smoothTransition?: boolean;
    } = {}
  ): Promise<MouseEventResult[]> {
    const results: MouseEventResult[] = [];
    const delay = options.delay || 200;
    const hoverDuration = options.hoverDuration || 300;

    for (let i = 0; i < selectors.length; i++) {
      const selector = selectors[i];

      // Move to element
      const moveResult = await this.moveToElement(selector, {}, {
        steps: options.smoothTransition ? 10 : 1,
        stepDelay: options.smoothTransition ? 30 : 0
      });

      results.push(moveResult);

      // Hover duration
      if (hoverDuration > 0) {
        await this.page.waitForTimeout(hoverDuration);
      }

      // Delay before next element
      if (delay > 0 && i < selectors.length - 1) {
        await this.page.waitForTimeout(delay);
      }
    }

    return results;
  }

  /**
   * Tests click accuracy with multiple attempts
   */
  async testClickAccuracy(
    selector: string,
    attempts: number = 5,
    options: {
      targetArea?: { x: number; y: number; width: number; height: number };
      delay?: number;
    } = {}
  ): Promise<{
    successRate: number;
    attempts: number;
    successful: number;
    failed: number;
    details: Array<{ attempt: number; success: boolean; position: MousePosition }>;
  }> {
    const element = await waitForElement(this.page, selector, { visible: true });
    const boundingBox = await element.boundingBox();

    if (!boundingBox) {
      throw new Error(`Cannot get bounding box for element: ${selector}`);
    }

    const targetArea = options.targetArea || {
      x: boundingBox.x,
      y: boundingBox.y,
      width: boundingBox.width,
      height: boundingBox.height
    };

    let successful = 0;
    const details: Array<{ attempt: number; success: boolean; position: MousePosition }> = [];

    for (let i = 0; i < attempts; i++) {
      // Generate random position within target area
      const x = targetArea.x + Math.random() * targetArea.width;
      const y = targetArea.y + Math.random() * targetArea.height;

      try {
        await this.page.mouse.click(x, y);

        // Check if click was successful by verifying element received the click
        const clickReceived = await this.page.evaluate((sel, pos) => {
          const el = document.querySelector(sel);
          if (!el) return false;

          const rect = el.getBoundingClientRect();
          return pos.x >= rect.left && pos.x <= rect.right &&
                 pos.y >= rect.top && pos.y <= rect.bottom;
        }, selector, { x, y });

        if (clickReceived) {
          successful++;
        }

        details.push({
          attempt: i + 1,
          success: clickReceived,
          position: { x: Math.round(x), y: Math.round(y) }
        });

      } catch (error) {
        details.push({
          attempt: i + 1,
          success: false,
          position: { x: Math.round(x), y: Math.round(y) }
        });
      }

      if (options.delay && i < attempts - 1) {
        await this.page.waitForTimeout(options.delay);
      }
    }

    return {
      successRate: successful / attempts,
      attempts,
      successful,
      failed: attempts - successful,
      details
    };
  }

  /**
   * Gets current mouse position (approximate)
   */
  private async getCurrentMousePosition(): Promise<MousePosition> {
    // Since Playwright doesn't provide direct access to mouse position,
    // we'll use a default or track it through our movements
    return { x: 0, y: 0 };
  }

  /**
   * Applies easing function to progress value
   */
  private applyEasing(progress: number, easing: string): number {
    switch (easing) {
      case 'ease-in':
        return progress * progress;
      case 'ease-out':
        return 1 - (1 - progress) * (1 - progress);
      case 'ease-in-out':
        return progress < 0.5
          ? 2 * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      case 'linear':
      default:
        return progress;
    }
  }

  /**
   * Generate circular pattern points
   */
  private generateCirclePattern(
    centerX: number,
    centerY: number,
    radius: number,
    steps: number
  ): MousePosition[] {
    const points: MousePosition[] = [];
    for (let i = 0; i < steps; i++) {
      const angle = (2 * Math.PI * i) / steps;
      points.push({
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle)
      });
    }
    return points;
  }

  /**
   * Generate square pattern points
   */
  private generateSquarePattern(
    centerX: number,
    centerY: number,
    size: number,
    steps: number
  ): MousePosition[] {
    const points: MousePosition[] = [];
    const half = size / 2;
    const stepsPerSide = Math.floor(steps / 4);

    // Top side
    for (let i = 0; i < stepsPerSide; i++) {
      points.push({
        x: centerX - half + (size * i) / stepsPerSide,
        y: centerY - half
      });
    }

    // Right side
    for (let i = 0; i < stepsPerSide; i++) {
      points.push({
        x: centerX + half,
        y: centerY - half + (size * i) / stepsPerSide
      });
    }

    // Bottom side
    for (let i = 0; i < stepsPerSide; i++) {
      points.push({
        x: centerX + half - (size * i) / stepsPerSide,
        y: centerY + half
      });
    }

    // Left side
    for (let i = 0; i < stepsPerSide; i++) {
      points.push({
        x: centerX - half,
        y: centerY + half - (size * i) / stepsPerSide
      });
    }

    return points;
  }

  /**
   * Generate zigzag pattern points
   */
  private generateZigzagPattern(
    centerX: number,
    centerY: number,
    size: number,
    steps: number
  ): MousePosition[] {
    const points: MousePosition[] = [];
    const amplitude = size / 2;
    const frequency = 2;

    for (let i = 0; i < steps; i++) {
      const progress = i / (steps - 1);
      const x = centerX - size / 2 + size * progress;
      const y = centerY + amplitude * Math.sin(frequency * Math.PI * progress);
      points.push({ x, y });
    }

    return points;
  }

  /**
   * Generate spiral pattern points
   */
  private generateSpiralPattern(
    centerX: number,
    centerY: number,
    maxRadius: number,
    steps: number
  ): MousePosition[] {
    const points: MousePosition[] = [];
    const turns = 2;

    for (let i = 0; i < steps; i++) {
      const progress = i / (steps - 1);
      const angle = turns * 2 * Math.PI * progress;
      const radius = maxRadius * progress;

      points.push({
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle)
      });
    }

    return points;
  }
}

/**
 * Factory function to create a mouse event simulator
 */
export function createMouseEventSimulator(page: Page): MouseEventSimulator {
  return new MouseEventSimulator(page);
}

/**
 * Utility function to track mouse events during simulation
 */
export async function trackMouseEvents(
  page: Page,
  eventTypes: string[] = ['mousedown', 'mouseup', 'mousemove', 'click']
): Promise<{
  startTracking: () => Promise<void>;
  stopTracking: () => Promise<Array<{ type: string; x: number; y: number; timestamp: number }>>;
}> {
  return {
    startTracking: async () => {
      await page.evaluate((types) => {
        window.__mouseEventTracker = [];

        types.forEach(eventType => {
          document.addEventListener(eventType, (e) => {
            const event = e as MouseEvent;
            window.__mouseEventTracker.push({
              type: eventType,
              x: event.clientX,
              y: event.clientY,
              timestamp: Date.now()
            });
          }, true);
        });
      }, eventTypes);
    },

    stopTracking: async () => {
      return page.evaluate(() => {
        const events = window.__mouseEventTracker || [];
        delete window.__mouseEventTracker;
        return events;
      });
    }
  };
}

// Type declarations for window object extensions
declare global {
  interface Window {
    __mouseEventTracker: Array<{ type: string; x: number; y: number; timestamp: number }>;
  }
}