/**
 * Comprehensive tests for general assertion helpers
 * Tests all the enhanced assertion utilities beyond basic expect()
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  expectToThrow,
  expectObjectShape,
  expectArrayToContain,
  expectArrayToBeSorted,
  expectToHaveBeenCalledWithShape,
  expectToBeWithinRange,
  expectDatesToBeClose,
  expectStringToMatchPattern,
  expectEventsToHaveBeenEmitted,
  expectPathToExist,
  expectToResolveWithin,
  expectToBeOneOf,
  expectToHaveExactShape
} from '../assertions.js';
import { promises as fs } from 'fs';

describe('General Assertion Helpers', () => {

  describe('expectToThrow', () => {
    it('should pass when function throws', async () => {
      const throwingFunction = () => {
        throw new Error('Expected error');
      };

      const error = await expectToThrow(throwingFunction);
      expect(error.message).toBe('Expected error');
    });

    it('should pass when async function throws', async () => {
      const throwingAsyncFunction = async () => {
        throw new Error('Async error');
      };

      const error = await expectToThrow(throwingAsyncFunction);
      expect(error.message).toBe('Async error');
    });

    it('should validate error message with string', async () => {
      const throwingFunction = () => {
        throw new Error('Specific error message');
      };

      await expect(expectToThrow(throwingFunction, 'Specific')).resolves.toBeTruthy();
      await expect(expectToThrow(throwingFunction, 'Different')).rejects.toThrow();
    });

    it('should validate error message with regex', async () => {
      const throwingFunction = () => {
        throw new Error('Error: validation failed');
      };

      await expect(expectToThrow(throwingFunction, /validation/)).resolves.toBeTruthy();
      await expect(expectToThrow(throwingFunction, /success/)).rejects.toThrow();
    });

    it('should fail when function does not throw', async () => {
      const nonThrowingFunction = () => {
        return 'success';
      };

      await expect(expectToThrow(nonThrowingFunction)).rejects.toThrow(
        'Expected function to throw, but it did not'
      );
    });

    it('should fail when async function does not throw', async () => {
      const nonThrowingAsyncFunction = async () => {
        return Promise.resolve('success');
      };

      await expect(expectToThrow(nonThrowingAsyncFunction)).rejects.toThrow(
        'Expected function to throw, but it did not'
      );
    });

    it('should handle non-Error objects being thrown', async () => {
      const throwingFunction = () => {
        throw 'string error';
      };

      const error = await expectToThrow(throwingFunction);
      expect(error.message).toBe('string error');
    });
  });

  describe('expectObjectShape', () => {
    it('should pass when object has expected properties', () => {
      const obj = {
        name: 'test',
        age: 25,
        active: true,
        extra: 'ignored'
      };

      expect(() => expectObjectShape(obj, {
        name: 'test',
        age: 25,
        active: true
      })).not.toThrow();
    });

    it('should pass when checking subset of properties', () => {
      const obj = { a: 1, b: 2, c: 3 };

      expect(() => expectObjectShape(obj, {
        a: 1,
        c: 3
      })).not.toThrow();
    });

    it('should pass when expected value is undefined (just checks property exists)', () => {
      const obj = { prop: 'any value' };

      expect(() => expectObjectShape(obj, {
        prop: undefined
      })).not.toThrow();
    });

    it('should fail when property is missing', () => {
      const obj = { name: 'test' };

      expect(() => expectObjectShape(obj, {
        name: 'test',
        missing: 'value'
      })).toThrow();
    });

    it('should fail when property value is wrong', () => {
      const obj = { name: 'test', age: 25 };

      expect(() => expectObjectShape(obj, {
        name: 'test',
        age: 30
      })).toThrow();
    });

    it('should fail when input is not an object', () => {
      expect(() => expectObjectShape('not an object', { prop: 'value' })).toThrow();
      expect(() => expectObjectShape(null, { prop: 'value' })).toThrow();
      expect(() => expectObjectShape(undefined, { prop: 'value' })).toThrow();
    });

    it('should handle nested objects', () => {
      const obj = {
        user: {
          profile: {
            name: 'John'
          }
        }
      };

      expect(() => expectObjectShape(obj, {
        user: {
          profile: {
            name: 'John'
          }
        }
      })).not.toThrow();
    });
  });

  describe('expectArrayToContain', () => {
    it('should pass when array contains matching elements', () => {
      const array = [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
        { id: 3, name: 'Charlie' }
      ];

      expect(() => expectArrayToContain(array, (item: any) => item.name === 'Bob')).not.toThrow();
    });

    it('should pass when exact count matches', () => {
      const array = [1, 2, 3, 2, 4, 2];

      expect(() => expectArrayToContain(array, (item: number) => item === 2, 3)).not.toThrow();
    });

    it('should fail when no elements match', () => {
      const array = [1, 2, 3];

      expect(() => expectArrayToContain(array, (item: number) => item === 5)).toThrow();
    });

    it('should fail when count does not match', () => {
      const array = [1, 2, 3, 2];

      expect(() => expectArrayToContain(array, (item: number) => item === 2, 3)).toThrow();
    });

    it('should fail when input is not an array', () => {
      expect(() => expectArrayToContain('not an array' as any, () => true)).toThrow();
    });

    it('should handle empty arrays', () => {
      expect(() => expectArrayToContain([], (item: any) => true)).toThrow();
    });

    it('should work with complex matcher functions', () => {
      const array = [
        { type: 'user', status: 'active', score: 95 },
        { type: 'admin', status: 'active', score: 88 },
        { type: 'user', status: 'inactive', score: 76 }
      ];

      expect(() => expectArrayToContain(array, (item: any) =>
        item.type === 'user' && item.status === 'active' && item.score > 90
      )).not.toThrow();
    });
  });

  describe('expectArrayToBeSorted', () => {
    it('should pass when array is sorted in ascending order', () => {
      const array = [
        { name: 'Alice', age: 20 },
        { name: 'Bob', age: 25 },
        { name: 'Charlie', age: 30 }
      ];

      expect(() => expectArrayToBeSorted(array, (item) => item.age)).not.toThrow();
    });

    it('should pass when array is sorted in descending order', () => {
      const array = [
        { name: 'Charlie', score: 95 },
        { name: 'Bob', score: 88 },
        { name: 'Alice', score: 76 }
      ];

      expect(() => expectArrayToBeSorted(array, (item) => item.score, 'desc')).not.toThrow();
    });

    it('should pass for single element arrays', () => {
      const array = [{ value: 42 }];

      expect(() => expectArrayToBeSorted(array, (item) => item.value)).not.toThrow();
    });

    it('should pass for empty arrays', () => {
      const array: any[] = [];

      expect(() => expectArrayToBeSorted(array, (item) => item.value)).not.toThrow();
    });

    it('should fail when array is not sorted ascending', () => {
      const array = [
        { name: 'Bob', age: 25 },
        { name: 'Alice', age: 20 },
        { name: 'Charlie', age: 30 }
      ];

      expect(() => expectArrayToBeSorted(array, (item) => item.age)).toThrow();
    });

    it('should fail when array is not sorted descending', () => {
      const array = [
        { name: 'Alice', score: 76 },
        { name: 'Bob', score: 88 },
        { name: 'Charlie', score: 95 }
      ];

      expect(() => expectArrayToBeSorted(array, (item) => item.score, 'desc')).toThrow();
    });

    it('should work with string sorting', () => {
      const array = ['apple', 'banana', 'cherry'];

      expect(() => expectArrayToBeSorted(array, (item) => item)).not.toThrow();
    });

    it('should work with date sorting', () => {
      const array = [
        { event: 'start', date: new Date('2023-01-01') },
        { event: 'middle', date: new Date('2023-06-15') },
        { event: 'end', date: new Date('2023-12-31') }
      ];

      expect(() => expectArrayToBeSorted(array, (item) => item.date)).not.toThrow();
    });

    it('should handle equal values correctly', () => {
      const array = [
        { name: 'A', value: 10 },
        { name: 'B', value: 10 },
        { name: 'C', value: 20 }
      ];

      expect(() => expectArrayToBeSorted(array, (item) => item.value)).not.toThrow();
    });
  });

  describe('expectToHaveBeenCalledWithShape', () => {
    it('should pass when spy was called with matching arguments', () => {
      const spy = vi.fn();
      spy({ name: 'test', id: 123 }, 'second arg');

      expect(() => expectToHaveBeenCalledWithShape(spy, [
        { name: 'test', id: 123 },
        'second arg'
      ])).not.toThrow();
    });

    it('should pass when checking specific call index', () => {
      const spy = vi.fn();
      spy('first call');
      spy({ target: 'call', index: 1 });
      spy('third call');

      expect(() => expectToHaveBeenCalledWithShape(spy, [
        { target: 'call', index: 1 }
      ], 1)).not.toThrow();
    });

    it('should fail when spy was not called', () => {
      const spy = vi.fn();

      expect(() => expectToHaveBeenCalledWithShape(spy, ['arg'])).toThrow();
    });

    it('should fail when call index is out of bounds', () => {
      const spy = vi.fn();
      spy('only call');

      expect(() => expectToHaveBeenCalledWithShape(spy, ['arg'], 5)).toThrow();
    });

    it('should fail when argument count does not match', () => {
      const spy = vi.fn();
      spy('only one arg');

      expect(() => expectToHaveBeenCalledWithShape(spy, ['arg1', 'arg2'])).toThrow();
    });

    it('should fail when object shape does not match', () => {
      const spy = vi.fn();
      spy({ name: 'test', id: 123 });

      expect(() => expectToHaveBeenCalledWithShape(spy, [
        { name: 'different', id: 123 }
      ])).toThrow();
    });

    it('should work with partial object matching', () => {
      const spy = vi.fn();
      spy({
        user: {
          name: 'John',
          email: 'john@example.com',
          profile: { age: 30, city: 'NYC' }
        },
        extra: 'data'
      });

      expect(() => expectToHaveBeenCalledWithShape(spy, [
        {
          user: {
            name: 'John',
            profile: { age: 30 }
          }
        }
      ])).not.toThrow();
    });
  });

  describe('expectToBeWithinRange', () => {
    it('should pass when value is within inclusive range', () => {
      expect(() => expectToBeWithinRange(5, 1, 10)).not.toThrow();
      expect(() => expectToBeWithinRange(1, 1, 10)).not.toThrow();
      expect(() => expectToBeWithinRange(10, 1, 10)).not.toThrow();
    });

    it('should pass when value is within exclusive range', () => {
      expect(() => expectToBeWithinRange(5, 1, 10, false)).not.toThrow();
    });

    it('should fail when value is outside inclusive range', () => {
      expect(() => expectToBeWithinRange(0, 1, 10)).toThrow();
      expect(() => expectToBeWithinRange(11, 1, 10)).toThrow();
    });

    it('should fail when value equals boundary in exclusive range', () => {
      expect(() => expectToBeWithinRange(1, 1, 10, false)).toThrow();
      expect(() => expectToBeWithinRange(10, 1, 10, false)).toThrow();
    });

    it('should fail when value is not a number', () => {
      expect(() => expectToBeWithinRange('5' as any, 1, 10)).toThrow();
    });

    it('should fail when value is NaN', () => {
      expect(() => expectToBeWithinRange(NaN, 1, 10)).toThrow();
    });

    it('should work with floating point numbers', () => {
      expect(() => expectToBeWithinRange(3.14, 3.0, 4.0)).not.toThrow();
      expect(() => expectToBeWithinRange(2.99, 3.0, 4.0)).toThrow();
    });

    it('should work with negative numbers', () => {
      expect(() => expectToBeWithinRange(-5, -10, 0)).not.toThrow();
      expect(() => expectToBeWithinRange(-15, -10, 0)).toThrow();
    });
  });

  describe('expectDatesToBeClose', () => {
    it('should pass when dates are exactly equal', () => {
      const date = new Date('2023-01-01T12:00:00Z');

      expect(() => expectDatesToBeClose(date, date)).not.toThrow();
    });

    it('should pass when dates are within default tolerance', () => {
      const date1 = new Date('2023-01-01T12:00:00Z');
      const date2 = new Date('2023-01-01T12:00:00.500Z'); // 500ms difference

      expect(() => expectDatesToBeClose(date1, date2)).not.toThrow();
    });

    it('should pass when dates are within custom tolerance', () => {
      const date1 = new Date('2023-01-01T12:00:00Z');
      const date2 = new Date('2023-01-01T12:00:02Z'); // 2 seconds difference

      expect(() => expectDatesToBeClose(date1, date2, 3000)).not.toThrow();
    });

    it('should fail when dates are outside tolerance', () => {
      const date1 = new Date('2023-01-01T12:00:00Z');
      const date2 = new Date('2023-01-01T12:00:02Z'); // 2 seconds difference

      expect(() => expectDatesToBeClose(date1, date2, 1000)).toThrow();
    });

    it('should fail when one date is invalid', () => {
      const validDate = new Date('2023-01-01T12:00:00Z');
      const invalidDate = new Date('invalid');

      expect(() => expectDatesToBeClose(validDate, invalidDate)).toThrow();
    });

    it('should fail when input is not a Date object', () => {
      const date = new Date('2023-01-01T12:00:00Z');

      expect(() => expectDatesToBeClose('2023-01-01' as any, date)).toThrow();
    });

    it('should handle dates in different timezones', () => {
      const date1 = new Date('2023-01-01T12:00:00Z');
      const date2 = new Date('2023-01-01T07:00:00-05:00'); // Same instant, different timezone

      expect(() => expectDatesToBeClose(date1, date2)).not.toThrow();
    });
  });

  describe('expectStringToMatchPattern', () => {
    it('should pass when string matches pattern exactly', () => {
      expect(() => expectStringToMatchPattern('Hello World', 'Hello World')).not.toThrow();
    });

    it('should pass when string matches pattern with variables', () => {
      expect(() => expectStringToMatchPattern(
        'Hello John, you are 30 years old',
        'Hello {name}, you are {age} years old',
        { name: 'John', age: 30 }
      )).not.toThrow();
    });

    it('should pass when using regex special characters in pattern', () => {
      expect(() => expectStringToMatchPattern(
        'User ID: 123',
        'User ID: \\d+',
        {}
      )).not.toThrow();
    });

    it('should fail when string does not match pattern', () => {
      expect(() => expectStringToMatchPattern('Hello World', 'Goodbye World')).toThrow();
    });

    it('should fail when variables do not match', () => {
      expect(() => expectStringToMatchPattern(
        'Hello Alice, you are 25 years old',
        'Hello {name}, you are {age} years old',
        { name: 'Bob', age: 30 }
      )).toThrow();
    });

    it('should fail when input is not a string', () => {
      expect(() => expectStringToMatchPattern(123 as any, 'pattern')).toThrow();
    });

    it('should handle multiple occurrences of same variable', () => {
      expect(() => expectStringToMatchPattern(
        'test test test',
        '{word} {word} {word}',
        { word: 'test' }
      )).not.toThrow();
    });

    it('should handle empty variables', () => {
      expect(() => expectStringToMatchPattern(
        'prefix  suffix',
        'prefix {empty} suffix',
        { empty: '' }
      )).not.toThrow();
    });

    it('should handle variables with special regex characters', () => {
      expect(() => expectStringToMatchPattern(
        'Find: (.*)',
        'Find: {pattern}',
        { pattern: '(.*)' }
      )).not.toThrow();
    });
  });

  describe('expectEventsToHaveBeenEmitted', () => {
    it('should pass when all expected events were emitted', () => {
      const tracker = {
        events: [
          { type: 'start', data: { timestamp: Date.now() } },
          { type: 'progress', data: { percent: 50 } },
          { type: 'complete' }
        ]
      };

      expect(() => expectEventsToHaveBeenEmitted(tracker, [
        'start',
        'progress',
        'complete'
      ])).not.toThrow();
    });

    it('should pass when checking events with specific data', () => {
      const tracker = {
        events: [
          { type: 'user_action', data: { action: 'click', element: 'button' } },
          { type: 'state_change', data: { from: 'idle', to: 'active' } }
        ]
      };

      expect(() => expectEventsToHaveBeenEmitted(tracker, [
        { type: 'user_action', data: { action: 'click', element: 'button' } },
        { type: 'state_change', data: { from: 'idle', to: 'active' } }
      ])).not.toThrow();
    });

    it('should fail when expected event was not emitted', () => {
      const tracker = {
        events: [
          { type: 'start' },
          { type: 'progress' }
        ]
      };

      expect(() => expectEventsToHaveBeenEmitted(tracker, [
        'start',
        'complete'
      ])).toThrow();
    });

    it('should fail when event data does not match', () => {
      const tracker = {
        events: [
          { type: 'data', data: { value: 'wrong' } }
        ]
      };

      expect(() => expectEventsToHaveBeenEmitted(tracker, [
        { type: 'data', data: { value: 'expected' } }
      ])).toThrow();
    });

    it('should handle events without data', () => {
      const tracker = {
        events: [
          { type: 'simple_event' }
        ]
      };

      expect(() => expectEventsToHaveBeenEmitted(tracker, [
        { type: 'simple_event' }
      ])).not.toThrow();
    });

    it('should handle mixed string and object expectations', () => {
      const tracker = {
        events: [
          { type: 'init' },
          { type: 'config', data: { theme: 'dark' } },
          { type: 'ready' }
        ]
      };

      expect(() => expectEventsToHaveBeenEmitted(tracker, [
        'init',
        { type: 'config', data: { theme: 'dark' } },
        'ready'
      ])).not.toThrow();
    });

    it('should handle empty events list', () => {
      const tracker = { events: [] };

      expect(() => expectEventsToHaveBeenEmitted(tracker, ['any_event'])).toThrow();
    });
  });

  describe('expectToResolveWithin', () => {
    it('should pass when promise resolves within timeout', async () => {
      const promise = new Promise(resolve => {
        setTimeout(() => resolve('success'), 100);
      });

      await expect(expectToResolveWithin(promise, 'success', 200)).resolves.not.toThrow();
    });

    it('should pass when promise resolves immediately', async () => {
      const promise = Promise.resolve('immediate');

      await expect(expectToResolveWithin(promise, 'immediate', 1000)).resolves.not.toThrow();
    });

    it('should fail when promise takes too long', async () => {
      const promise = new Promise(resolve => {
        setTimeout(() => resolve('late'), 200);
      });

      await expect(expectToResolveWithin(promise, 'late', 100)).rejects.toThrow(
        'Promise did not resolve within 100ms'
      );
    });

    it('should fail when promise resolves with wrong value', async () => {
      const promise = Promise.resolve('wrong');

      await expect(expectToResolveWithin(promise, 'expected', 1000)).rejects.toThrow();
    });

    it('should use default timeout', async () => {
      const promise = Promise.resolve('quick');

      await expect(expectToResolveWithin(promise, 'quick')).resolves.not.toThrow();
    });

    it('should handle promise rejection', async () => {
      const promise = Promise.reject(new Error('rejected'));

      // The promise rejection should be handled and cause timeout
      await expect(expectToResolveWithin(promise, 'any', 100)).rejects.toThrow();
    });

    it('should work with complex objects', async () => {
      const expectedResult = { id: 123, data: { nested: 'value' } };
      const promise = Promise.resolve(expectedResult);

      await expect(expectToResolveWithin(promise, expectedResult, 1000)).resolves.not.toThrow();
    });
  });

  describe('expectToBeOneOf', () => {
    it('should pass when value is in the possible values list', () => {
      expect(() => expectToBeOneOf('apple', ['apple', 'banana', 'orange'])).not.toThrow();
      expect(() => expectToBeOneOf(42, [10, 20, 42, 50])).not.toThrow();
      expect(() => expectToBeOneOf(true, [true, false])).not.toThrow();
    });

    it('should fail when value is not in the possible values list', () => {
      expect(() => expectToBeOneOf('grape', ['apple', 'banana', 'orange'])).toThrow();
      expect(() => expectToBeOneOf(99, [10, 20, 30])).toThrow();
    });

    it('should handle empty possible values list', () => {
      expect(() => expectToBeOneOf('anything', [])).toThrow();
    });

    it('should work with objects', () => {
      const obj1 = { id: 1 };
      const obj2 = { id: 2 };
      const obj3 = { id: 3 };

      expect(() => expectToBeOneOf(obj2, [obj1, obj2, obj3])).not.toThrow();
      expect(() => expectToBeOneOf({ id: 2 }, [obj1, obj2, obj3])).toThrow(); // Different reference
    });

    it('should handle null and undefined', () => {
      expect(() => expectToBeOneOf(null, [null, undefined, 'value'])).not.toThrow();
      expect(() => expectToBeOneOf(undefined, [null, undefined, 'value'])).not.toThrow();
      expect(() => expectToBeOneOf(null, [undefined, 'value'])).toThrow();
    });
  });

  describe('expectToHaveExactShape', () => {
    it('should pass when object has exactly required keys', () => {
      const obj = { name: 'test', age: 25, active: true };

      expect(() => expectToHaveExactShape(obj, ['name', 'age', 'active'])).not.toThrow();
    });

    it('should pass when object has required and allowed keys', () => {
      const obj = { name: 'test', age: 25, description: 'optional' };

      expect(() => expectToHaveExactShape(
        obj,
        ['name', 'age'],
        ['name', 'age', 'description']
      )).not.toThrow();
    });

    it('should fail when required key is missing', () => {
      const obj = { name: 'test' };

      expect(() => expectToHaveExactShape(obj, ['name', 'age'])).toThrow();
    });

    it('should fail when object has extra keys', () => {
      const obj = { name: 'test', age: 25, extra: 'not allowed' };

      expect(() => expectToHaveExactShape(obj, ['name', 'age'])).toThrow();
    });

    it('should fail when input is not an object', () => {
      expect(() => expectToHaveExactShape('string', ['prop'])).toThrow();
      expect(() => expectToHaveExactShape(null, ['prop'])).toThrow();
    });

    it('should handle empty objects and empty requirements', () => {
      const obj = {};

      expect(() => expectToHaveExactShape(obj, [])).not.toThrow();
      expect(() => expectToHaveExactShape(obj, ['required'])).toThrow();
    });

    it('should work with symbol keys', () => {
      const symbol = Symbol('test');
      const obj = { [symbol]: 'value', normal: 'key' };

      // Note: Object.keys() doesn't include symbols, so this tests the limitation
      expect(() => expectToHaveExactShape(obj, ['normal'])).not.toThrow();
    });

    it('should handle numeric keys', () => {
      const obj = { '0': 'first', '1': 'second', name: 'test' };

      expect(() => expectToHaveExactShape(obj, ['0', '1', 'name'])).not.toThrow();
    });
  });

  describe('edge cases and integration', () => {
    it('should handle very large numbers in ranges', () => {
      const largeNumber = Number.MAX_SAFE_INTEGER;
      expect(() => expectToBeWithinRange(largeNumber, 0, Number.MAX_SAFE_INTEGER)).not.toThrow();
    });

    it('should handle very old and future dates', () => {
      const veryOld = new Date('1900-01-01');
      const veryFuture = new Date('3000-01-01');

      expect(() => expectDatesToBeClose(veryOld, veryOld)).not.toThrow();
      expect(() => expectDatesToBeClose(veryFuture, veryFuture)).not.toThrow();
    });

    it('should handle unicode strings in pattern matching', () => {
      expect(() => expectStringToMatchPattern(
        'Hello 世界 🌍',
        'Hello {world} {emoji}',
        { world: '世界', emoji: '🌍' }
      )).not.toThrow();
    });

    it('should handle deeply nested objects', () => {
      const deepObject = {
        level1: {
          level2: {
            level3: {
              level4: {
                value: 'deep'
              }
            }
          }
        }
      };

      expect(() => expectObjectShape(deepObject, {
        level1: {
          level2: {
            level3: {
              level4: {
                value: 'deep'
              }
            }
          }
        }
      })).not.toThrow();
    });

    it('should work with complex integration scenario', () => {
      // Simulate a complex testing scenario involving multiple assertions
      const testData = {
        users: [
          { id: 1, name: 'Alice', joinDate: new Date('2023-01-15'), score: 95.5 },
          { id: 2, name: 'Bob', joinDate: new Date('2023-02-20'), score: 87.2 },
          { id: 3, name: 'Charlie', joinDate: new Date('2023-03-10'), score: 92.1 }
        ],
        metadata: {
          totalUsers: 3,
          averageScore: 91.6,
          lastUpdate: new Date()
        }
      };

      // Test object shape
      expect(() => expectObjectShape(testData, {
        users: undefined, // Just check it exists
        metadata: {
          totalUsers: 3,
          averageScore: 91.6
        }
      })).not.toThrow();

      // Test array contents
      expect(() => expectArrayToContain(
        testData.users,
        (user: any) => user.score > 90,
        2
      )).not.toThrow();

      // Test array sorting
      expect(() => expectArrayToBeSorted(
        testData.users,
        (user: any) => user.joinDate
      )).not.toThrow();

      // Test range
      expect(() => expectToBeWithinRange(testData.metadata.averageScore, 85, 95)).not.toThrow();

      // Test date proximity
      expect(() => expectDatesToBeClose(
        testData.metadata.lastUpdate,
        new Date(),
        5000
      )).not.toThrow();

      // Test value options
      expect(() => expectToBeOneOf(testData.metadata.totalUsers, [1, 2, 3, 4, 5])).not.toThrow();
    });
  });
});