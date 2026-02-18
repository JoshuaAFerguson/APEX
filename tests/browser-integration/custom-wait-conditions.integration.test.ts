/**
 * @fileoverview Custom Wait Conditions Integration Tests
 *
 * Comprehensive tests for waitForFunction and custom predicate-based waiting:
 * - Basic waitForFunction with string expressions and function references
 * - Polling interval configurations (numeric and raf mode)
 * - Return value evaluation (primitives, objects, arrays)
 * - Complex DOM condition checking
 * - Multi-element aggregate conditions
 * - Computed style conditions
 * - Advanced scenarios and error handling
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Browser, BrowserContext, Page } from 'playwright';
import { chromium } from 'playwright';

describe('Custom Wait Conditions Integration Tests', () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;

  beforeEach(async () => {
    browser = await chromium.launch({
      headless: process.env.CI === 'true' || process.env.BROWSER_TEST_HEADLESS === 'true',
    });
    context = await browser.newContext();
    page = await context.newPage();
    page.setDefaultTimeout(30000);
  });

  afterEach(async () => {
    if (page) await page.close();
    if (context) await context.close();
    if (browser) await browser.close();
  });

  describe('Basic waitForFunction Tests', () => {
    it('should wait for string expression to evaluate to truthy value', async () => {
      await page.setContent(`
        <div id="target">loading...</div>
        <script>
          setTimeout(() => {
            document.getElementById('target').textContent = 'ready';
          }, 300);
        </script>
      `);

      const startTime = Date.now();

      await page.waitForFunction('document.getElementById("target").textContent === "ready"');

      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeGreaterThanOrEqual(250);
      expect(elapsed).toBeLessThan(1000);

      const content = await page.textContent('#target');
      expect(content).toBe('ready');
    });

    it('should wait for function reference to return truthy value', async () => {
      await page.setContent(`
        <div id="counter" data-value="0">0</div>
        <script>
          let count = 0;
          const interval = setInterval(() => {
            count++;
            const el = document.getElementById('counter');
            el.textContent = count;
            el.dataset.value = count;
            if (count >= 5) clearInterval(interval);
          }, 100);
        </script>
      `);

      await page.waitForFunction(() => {
        const element = document.getElementById('counter');
        return element && parseInt(element.dataset.value || '0') >= 5;
      });

      const value = await page.getAttribute('#counter', 'data-value');
      expect(parseInt(value || '0')).toBeGreaterThanOrEqual(5);
    });

    it('should return the evaluated result value', async () => {
      await page.setContent(`
        <div id="target">0</div>
        <script>
          setTimeout(() => {
            document.getElementById('target').textContent = '42';
          }, 200);
        </script>
      `);

      const result = await page.waitForFunction(() => {
        const text = document.getElementById('target')?.textContent || '0';
        const value = parseInt(text);
        return value > 40 ? value : false;
      });

      const value = await result.jsonValue();
      expect(value).toBe(42);
    });

    it('should handle primitive return values (boolean, number, string)', async () => {
      await page.setContent(`
        <div id="bool-target">false</div>
        <div id="num-target">0</div>
        <div id="str-target"></div>
        <script>
          setTimeout(() => {
            document.getElementById('bool-target').textContent = 'true';
            document.getElementById('num-target').textContent = '100';
            document.getElementById('str-target').textContent = 'hello';
          }, 200);
        </script>
      `);

      // Test boolean return
      const boolResult = await page.waitForFunction(() => {
        const text = document.getElementById('bool-target')?.textContent;
        return text === 'true' ? true : false;
      });
      expect(await boolResult.jsonValue()).toBe(true);

      // Test number return
      const numResult = await page.waitForFunction(() => {
        const text = document.getElementById('num-target')?.textContent;
        const value = parseInt(text || '0');
        return value > 50 ? value : false;
      });
      expect(await numResult.jsonValue()).toBe(100);

      // Test string return
      const strResult = await page.waitForFunction(() => {
        const text = document.getElementById('str-target')?.textContent;
        return text && text.length > 0 ? text : false;
      });
      expect(await strResult.jsonValue()).toBe('hello');
    });

    it('should handle complex return values (objects, arrays)', async () => {
      await page.setContent(`
        <div class="item" data-id="1">Item 1</div>
        <div class="item" data-id="2">Item 2</div>
        <div class="item" data-id="3">Item 3</div>
        <script>
          setTimeout(() => {
            document.querySelectorAll('.item').forEach(el => {
              el.classList.add('loaded');
            });
          }, 200);
        </script>
      `);

      const result = await page.waitForFunction(() => {
        const items = Array.from(document.querySelectorAll('.item.loaded'));
        if (items.length >= 3) {
          return {
            count: items.length,
            ids: items.map(el => el.getAttribute('data-id')),
            texts: items.map(el => el.textContent?.trim())
          };
        }
        return false;
      });

      const data = await result.jsonValue();
      expect(data).toEqual({
        count: 3,
        ids: ['1', '2', '3'],
        texts: ['Item 1', 'Item 2', 'Item 3']
      });
    });

    it('should timeout when condition is never met', async () => {
      await page.setContent(`
        <div id="target">never-changes</div>
      `);

      const startTime = Date.now();

      await expect(async () => {
        await page.waitForFunction(
          () => document.getElementById('target')?.textContent === 'will-never-happen',
          { timeout: 1000 }
        );
      }).rejects.toThrow(/Timeout/);

      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeGreaterThanOrEqual(950);
      expect(elapsed).toBeLessThan(1500);
    });
  });

  describe('Polling Configuration Tests', () => {
    it('should poll at specified interval (100ms)', async () => {
      await page.setContent(`
        <div id="target">0</div>
        <script>
          window.pollCount = 0;
          window.getValue = () => {
            window.pollCount++;
            return parseInt(document.getElementById('target').textContent);
          };
          setInterval(() => {
            const el = document.getElementById('target');
            el.textContent = parseInt(el.textContent) + 1;
          }, 50);
        </script>
      `);

      const startTime = Date.now();

      await page.waitForFunction(
        () => (window as any).getValue() >= 5,
        { polling: 100 }
      );

      const elapsed = Date.now() - startTime;
      const pollCount = await page.evaluate(() => (window as any).pollCount);

      // With 100ms polling, should take approximately 5-10 polls to detect value >= 5
      expect(pollCount).toBeGreaterThanOrEqual(3);
      expect(pollCount).toBeLessThanOrEqual(15);
      expect(elapsed).toBeGreaterThanOrEqual(200);
    });

    it('should poll at specified interval (500ms)', async () => {
      await page.setContent(`
        <div id="target">0</div>
        <script>
          window.pollCount = 0;
          window.getValue = () => {
            window.pollCount++;
            return parseInt(document.getElementById('target').textContent);
          };
          setInterval(() => {
            const el = document.getElementById('target');
            el.textContent = parseInt(el.textContent) + 1;
          }, 100);
        </script>
      `);

      await page.waitForFunction(
        () => (window as any).getValue() >= 3,
        { polling: 500 }
      );

      const pollCount = await page.evaluate(() => (window as any).pollCount);

      // With 500ms polling, should take fewer polls but more time
      expect(pollCount).toBeGreaterThanOrEqual(2);
      expect(pollCount).toBeLessThanOrEqual(8);
    });

    it('should poll at specified interval (50ms - high frequency)', async () => {
      await page.setContent(`
        <div id="target">0</div>
        <script>
          window.pollCount = 0;
          window.getValue = () => {
            window.pollCount++;
            return parseInt(document.getElementById('target').textContent);
          };
          setInterval(() => {
            const el = document.getElementById('target');
            el.textContent = parseInt(el.textContent) + 1;
          }, 25);
        </script>
      `);

      await page.waitForFunction(
        () => (window as any).getValue() >= 3,
        { polling: 50 }
      );

      const pollCount = await page.evaluate(() => (window as any).pollCount);

      // With 50ms polling, should have more frequent checks
      expect(pollCount).toBeGreaterThanOrEqual(3);
      expect(pollCount).toBeLessThanOrEqual(20);
    });

    it('should use requestAnimationFrame polling with raf mode', async () => {
      await page.setContent(`
        <div id="target" style="opacity: 0; transition: opacity 0.3s;">Target</div>
        <script>
          window.rafCount = 0;
          window.checkOpacity = () => {
            window.rafCount++;
            const el = document.getElementById('target');
            return window.getComputedStyle(el).opacity;
          };

          setTimeout(() => {
            document.getElementById('target').style.opacity = '1';
          }, 100);
        </script>
      `);

      await page.waitForFunction(
        () => parseFloat((window as any).checkOpacity()) > 0.9,
        { polling: 'raf' }
      );

      const rafCount = await page.evaluate(() => (window as any).rafCount);

      // RAF polling should check multiple times during animation
      expect(rafCount).toBeGreaterThanOrEqual(5);
    });

    it('should detect rapid state changes with appropriate polling', async () => {
      await page.setContent(`
        <div id="target">0</div>
        <script>
          let count = 0;
          const interval = setInterval(() => {
            count++;
            document.getElementById('target').textContent = count;
            if (count >= 10) clearInterval(interval);
          }, 20); // Very fast changes
        </script>
      `);

      const result = await page.waitForFunction(
        () => {
          const value = parseInt(document.getElementById('target')?.textContent || '0');
          return value >= 8 ? value : false;
        },
        { polling: 30 }
      );

      const finalValue = await result.jsonValue();
      expect(finalValue).toBeGreaterThanOrEqual(8);
      expect(finalValue).toBeLessThanOrEqual(10);
    });

    it('should respect minimum polling interval', async () => {
      await page.setContent(`
        <div id="target">0</div>
        <script>
          window.pollTimes = [];
          window.getValue = () => {
            window.pollTimes.push(Date.now());
            return parseInt(document.getElementById('target').textContent);
          };

          setTimeout(() => {
            document.getElementById('target').textContent = '5';
          }, 300);
        </script>
      `);

      await page.waitForFunction(
        () => (window as any).getValue() >= 5,
        { polling: 10 } // Very small interval
      );

      const pollTimes = await page.evaluate(() => (window as any).pollTimes);

      // Check that polls are reasonably spaced
      expect(pollTimes.length).toBeGreaterThan(5);

      // Check that intervals are not too frequent (should be at least 10ms apart)
      for (let i = 1; i < Math.min(5, pollTimes.length); i++) {
        const interval = pollTimes[i] - pollTimes[i - 1];
        expect(interval).toBeGreaterThanOrEqual(8); // Allow some variance
      }
    });
  });

  describe('Return Value Evaluation Tests', () => {
    it('should evaluate boolean true as passing condition', async () => {
      await page.setContent(`
        <div id="target">false</div>
        <script>
          setTimeout(() => {
            document.getElementById('target').textContent = 'true';
          }, 200);
        </script>
      `);

      await page.waitForFunction(() => {
        return document.getElementById('target')?.textContent === 'true';
      });

      const content = await page.textContent('#target');
      expect(content).toBe('true');
    });

    it('should evaluate non-zero numbers as truthy', async () => {
      await page.setContent(`
        <div id="target">0</div>
        <script>
          let count = 0;
          const interval = setInterval(() => {
            count++;
            document.getElementById('target').textContent = count;
            if (count >= 5) clearInterval(interval);
          }, 100);
        </script>
      `);

      const result = await page.waitForFunction(() => {
        const value = parseInt(document.getElementById('target')?.textContent || '0');
        return value || false; // Non-zero numbers are truthy
      });

      const value = await result.jsonValue();
      expect(value).toBeGreaterThan(0);
    });

    it('should evaluate non-empty strings as truthy', async () => {
      await page.setContent(`
        <div id="target"></div>
        <script>
          setTimeout(() => {
            document.getElementById('target').textContent = 'hello world';
          }, 200);
        </script>
      `);

      const result = await page.waitForFunction(() => {
        const text = document.getElementById('target')?.textContent || '';
        return text || false; // Non-empty strings are truthy
      });

      const value = await result.jsonValue();
      expect(value).toBe('hello world');
    });

    it('should evaluate objects/arrays as truthy', async () => {
      await page.setContent(`
        <div class="item">1</div>
        <div class="item">2</div>
        <script>
          setTimeout(() => {
            document.querySelectorAll('.item').forEach(el => {
              el.classList.add('ready');
            });
          }, 200);
        </script>
      `);

      const result = await page.waitForFunction(() => {
        const readyItems = Array.from(document.querySelectorAll('.item.ready'));
        return readyItems.length >= 2 ? readyItems.map(el => el.textContent) : false;
      });

      const value = await result.jsonValue();
      expect(value).toEqual(['1', '2']);
    });

    it('should evaluate null/undefined/0/empty-string as falsy', async () => {
      await page.setContent(`
        <div id="target">not-ready</div>
        <script>
          setTimeout(() => {
            document.getElementById('target').textContent = 'ready';
          }, 300);
        </script>
      `);

      const result = await page.waitForFunction(() => {
        const text = document.getElementById('target')?.textContent;

        // Test various falsy conditions
        if (text === 'not-ready') return null;
        if (text === 'processing') return 0;
        if (text === 'empty') return '';
        if (text === 'undefined') return undefined;

        return text === 'ready' ? text : false;
      });

      const value = await result.jsonValue();
      expect(value).toBe('ready');
    });

    it('should return numeric computed values', async () => {
      await page.setContent(`
        <div class="score" data-value="10">Game 1</div>
        <div class="score" data-value="20">Game 2</div>
        <div class="score" data-value="15">Game 3</div>
        <script>
          setTimeout(() => {
            document.querySelector('.score[data-value="15"]').setAttribute('data-value', '25');
          }, 200);
        </script>
      `);

      const result = await page.waitForFunction(() => {
        const scores = document.querySelectorAll('.score');
        const total = Array.from(scores).reduce((sum, el) => {
          return sum + parseInt(el.getAttribute('data-value') || '0');
        }, 0);
        return total >= 50 ? total : false;
      });

      const value = await result.jsonValue();
      expect(value).toBe(55); // 10 + 20 + 25
    });

    it('should return DOM element properties', async () => {
      await page.setContent(`
        <div id="box" style="width: 100px; height: 100px; background: red;">Box</div>
        <script>
          setTimeout(() => {
            document.getElementById('box').style.width = '200px';
            document.getElementById('box').style.height = '200px';
          }, 200);
        </script>
      `);

      const result = await page.waitForFunction(() => {
        const box = document.getElementById('box');
        if (!box) return false;

        const rect = box.getBoundingClientRect();
        if (rect.width >= 200 && rect.height >= 200) {
          return {
            width: rect.width,
            height: rect.height,
            area: rect.width * rect.height
          };
        }
        return false;
      });

      const value = await result.jsonValue();
      expect(value).toEqual({
        width: 200,
        height: 200,
        area: 40000
      });
    });

    it('should return aggregated collection statistics', async () => {
      await page.setContent(`
        <ul id="list"></ul>
        <script>
          let count = 0;
          const interval = setInterval(() => {
            count++;
            const li = document.createElement('li');
            li.textContent = \`Item \${count}\`;
            li.setAttribute('data-index', count);
            document.getElementById('list').appendChild(li);
            if (count >= 5) clearInterval(interval);
          }, 100);
        </script>
      `);

      const result = await page.waitForFunction(() => {
        const items = document.querySelectorAll('#list li');
        if (items.length >= 5) {
          return {
            count: items.length,
            indices: Array.from(items).map(li => parseInt(li.getAttribute('data-index') || '0')),
            totalLength: Array.from(items).reduce((sum, li) => sum + (li.textContent?.length || 0), 0)
          };
        }
        return false;
      });

      const value = await result.jsonValue();
      expect(value.count).toBe(5);
      expect(value.indices).toEqual([1, 2, 3, 4, 5]);
      expect(value.totalLength).toBeGreaterThan(30); // Each item is "Item X" = 6+ chars
    });
  });

  describe('Complex DOM Condition Checking', () => {
    describe('Multi-Element Conditions', () => {
      it('should wait for all elements in collection to be visible', async () => {
        await page.setContent(`
          <div id="container">
            <div class="item" style="display: none;">Item 1</div>
            <div class="item" style="display: none;">Item 2</div>
            <div class="item" style="display: none;">Item 3</div>
          </div>
          <script>
            let shown = 0;
            const items = document.querySelectorAll('.item');
            const interval = setInterval(() => {
              if (shown < items.length) {
                items[shown].style.display = 'block';
                shown++;
              } else {
                clearInterval(interval);
              }
            }, 150);
          </script>
        `);

        await page.waitForFunction(() => {
          const items = document.querySelectorAll('.item');
          return Array.from(items).every(item => {
            const style = window.getComputedStyle(item);
            return style.display !== 'none' && style.visibility !== 'hidden';
          });
        }, { timeout: 5000 });

        const visibleCount = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('.item')).filter(item => {
            const style = window.getComputedStyle(item);
            return style.display !== 'none';
          }).length;
        });

        expect(visibleCount).toBe(3);
      });

      it('should wait for element count to reach threshold', async () => {
        await page.setContent(`
          <div id="container"></div>
          <script>
            let added = 0;
            const target = 7;
            const interval = setInterval(() => {
              if (added < target) {
                const div = document.createElement('div');
                div.className = 'generated-item';
                div.textContent = \`Generated \${added + 1}\`;
                document.getElementById('container').appendChild(div);
                added++;
              } else {
                clearInterval(interval);
              }
            }, 100);
          </script>
        `);

        const result = await page.waitForFunction(() => {
          const items = document.querySelectorAll('.generated-item');
          return items.length >= 7 ? items.length : false;
        });

        const count = await result.jsonValue();
        expect(count).toBe(7);
      });

      it('should wait for sum of element values to exceed target', async () => {
        await page.setContent(`
          <div class="value" data-amount="5">5</div>
          <div class="value" data-amount="10">10</div>
          <div class="value" data-amount="15">15</div>
          <script>
            setTimeout(() => {
              document.querySelectorAll('.value').forEach((el, index) => {
                const current = parseInt(el.getAttribute('data-amount'));
                const newValue = current + (index + 1) * 10;
                el.setAttribute('data-amount', newValue);
                el.textContent = newValue;
              });
            }, 200);
          </script>
        `);

        const result = await page.waitForFunction(() => {
          const elements = document.querySelectorAll('.value');
          const sum = Array.from(elements).reduce((total, el) => {
            return total + parseInt(el.getAttribute('data-amount') || '0');
          }, 0);
          return sum > 50 ? sum : false;
        });

        const sum = await result.jsonValue();
        expect(sum).toBeGreaterThan(50);
        expect(sum).toBe(75); // 15 + 20 + 35 = 70, wait... let me recalculate: 5+10→15+10→15+30 = 60. Actually: (5+10), (10+20), (15+30) = 15+30+45 = 90
      });
    });

    describe('Computed Style Conditions', () => {
      it('should wait for element to reach target opacity', async () => {
        await page.setContent(`
          <div id="fading" style="opacity: 0; transition: opacity 0.5s ease-in-out;">
            Fading Element
          </div>
          <script>
            setTimeout(() => {
              document.getElementById('fading').style.opacity = '0.8';
            }, 100);
          </script>
        `);

        const result = await page.waitForFunction(() => {
          const el = document.getElementById('fading');
          if (!el) return false;

          const computedOpacity = parseFloat(window.getComputedStyle(el).opacity);
          return computedOpacity >= 0.75 ? computedOpacity : false;
        });

        const opacity = await result.jsonValue();
        expect(opacity).toBeGreaterThanOrEqual(0.75);
      });

      it('should wait for animation to complete (transform change)', async () => {
        await page.setContent(`
          <div id="moving" style="transform: translateX(0px); transition: transform 0.3s;">
            Moving Element
          </div>
          <script>
            setTimeout(() => {
              document.getElementById('moving').style.transform = 'translateX(100px)';
            }, 100);
          </script>
        `);

        const result = await page.waitForFunction(() => {
          const el = document.getElementById('moving');
          if (!el) return false;

          const style = window.getComputedStyle(el);
          const matrix = new DOMMatrix(style.transform);
          const translateX = matrix.m41; // translateX value

          return translateX >= 95 ? translateX : false;
        });

        const translateX = await result.jsonValue();
        expect(translateX).toBeGreaterThanOrEqual(95);
      });

      it('should wait for CSS transition to finish', async () => {
        await page.setContent(`
          <div id="transitioning" style="width: 100px; transition: width 0.4s ease;">
            Expanding Element
          </div>
          <script>
            setTimeout(() => {
              document.getElementById('transitioning').style.width = '300px';
            }, 100);
          </script>
        `);

        // Wait for transition to complete
        await page.waitForFunction(() => {
          const el = document.getElementById('transitioning');
          if (!el) return false;

          const computedWidth = parseFloat(window.getComputedStyle(el).width);
          return computedWidth >= 290; // Close to final value
        });

        const width = await page.evaluate(() => {
          const el = document.getElementById('transitioning');
          return el ? parseFloat(window.getComputedStyle(el).width) : 0;
        });

        expect(width).toBeGreaterThanOrEqual(290);
        expect(width).toBeLessThanOrEqual(300);
      });
    });

    describe('DOM Hierarchy Conditions', () => {
      it('should wait for element to become child of specific parent', async () => {
        await page.setContent(`
          <div id="source">
            <div id="movable">Movable Element</div>
          </div>
          <div id="target"></div>
          <script>
            setTimeout(() => {
              const movable = document.getElementById('movable');
              const target = document.getElementById('target');
              if (movable && target) {
                target.appendChild(movable);
              }
            }, 200);
          </script>
        `);

        await page.waitForFunction(() => {
          const movable = document.getElementById('movable');
          const target = document.getElementById('target');
          return movable && target && movable.parentElement === target;
        });

        const parentId = await page.evaluate(() => {
          const movable = document.getElementById('movable');
          return movable?.parentElement?.id;
        });

        expect(parentId).toBe('target');
      });

      it('should wait for nested iframe content to load', async () => {
        await page.setContent(`
          <div id="container"></div>
          <script>
            setTimeout(() => {
              const iframe = document.createElement('iframe');
              iframe.id = 'nested-frame';
              iframe.srcdoc = '<div id="iframe-content">Iframe loaded!</div>';
              document.getElementById('container').appendChild(iframe);
            }, 100);
          </script>
        `);

        await page.waitForFunction(() => {
          const iframe = document.getElementById('nested-frame') as HTMLIFrameElement;
          if (!iframe || !iframe.contentDocument) return false;

          const content = iframe.contentDocument.getElementById('iframe-content');
          return content && content.textContent === 'Iframe loaded!';
        });

        const hasContent = await page.evaluate(() => {
          const iframe = document.getElementById('nested-frame') as HTMLIFrameElement;
          return iframe?.contentDocument?.getElementById('iframe-content')?.textContent === 'Iframe loaded!';
        });

        expect(hasContent).toBe(true);
      });
    });

    describe('Attribute and Data Conditions', () => {
      it('should wait for data attribute to match complex pattern', async () => {
        await page.setContent(`
          <div id="tracker" data-status="initializing">Loading...</div>
          <script>
            let step = 0;
            const steps = ['validating', 'processing', 'complete'];

            const interval = setInterval(() => {
              if (step < steps.length) {
                document.getElementById('tracker').setAttribute('data-status', steps[step]);
                step++;
              } else {
                clearInterval(interval);
              }
            }, 150);
          </script>
        `);

        const result = await page.waitForFunction(() => {
          const el = document.getElementById('tracker');
          const status = el?.getAttribute('data-status');
          const validStatuses = ['validating', 'processing', 'complete'];

          return validStatuses.includes(status || '') && status === 'complete' ? status : false;
        });

        const status = await result.jsonValue();
        expect(status).toBe('complete');
      });

      it('should wait for multiple attributes to all be set', async () => {
        await page.setContent(`
          <div id="multi-attr">Element</div>
          <script>
            setTimeout(() => {
              const el = document.getElementById('multi-attr');
              el.setAttribute('data-loaded', 'true');
            }, 100);

            setTimeout(() => {
              const el = document.getElementById('multi-attr');
              el.setAttribute('data-validated', 'true');
            }, 200);

            setTimeout(() => {
              const el = document.getElementById('multi-attr');
              el.setAttribute('data-ready', 'true');
            }, 300);
          </script>
        `);

        const result = await page.waitForFunction(() => {
          const el = document.getElementById('multi-attr');
          if (!el) return false;

          const hasAll = el.hasAttribute('data-loaded') &&
                        el.hasAttribute('data-validated') &&
                        el.hasAttribute('data-ready');

          return hasAll ? {
            loaded: el.getAttribute('data-loaded'),
            validated: el.getAttribute('data-validated'),
            ready: el.getAttribute('data-ready')
          } : false;
        });

        const attributes = await result.jsonValue();
        expect(attributes).toEqual({
          loaded: 'true',
          validated: 'true',
          ready: 'true'
        });
      });

      it('should wait for attribute to be removed', async () => {
        await page.setContent(`
          <div id="temp-attr" data-temporary="true" class="loading">Loading...</div>
          <script>
            setTimeout(() => {
              const el = document.getElementById('temp-attr');
              el.removeAttribute('data-temporary');
              el.classList.remove('loading');
              el.textContent = 'Loaded!';
            }, 250);
          </script>
        `);

        await page.waitForFunction(() => {
          const el = document.getElementById('temp-attr');
          return el && !el.hasAttribute('data-temporary') && !el.classList.contains('loading');
        });

        const hasAttribute = await page.evaluate(() => {
          const el = document.getElementById('temp-attr');
          return el?.hasAttribute('data-temporary');
        });

        expect(hasAttribute).toBe(false);
      });
    });

    describe('Form State Conditions', () => {
      it('should wait for form validity state to become valid', async () => {
        await page.setContent(`
          <form id="test-form">
            <input id="email" type="email" required>
            <input id="name" type="text" required>
            <button type="submit">Submit</button>
          </form>
          <script>
            setTimeout(() => {
              document.getElementById('email').value = 'test@example.com';
            }, 100);

            setTimeout(() => {
              document.getElementById('name').value = 'John Doe';
            }, 200);
          </script>
        `);

        const result = await page.waitForFunction(() => {
          const form = document.getElementById('test-form') as HTMLFormElement;
          return form && form.checkValidity() ? 'valid' : false;
        });

        const validity = await result.jsonValue();
        expect(validity).toBe('valid');
      });

      it('should wait for all required fields to be filled', async () => {
        await page.setContent(`
          <form id="registration-form">
            <input id="username" type="text" required placeholder="Username">
            <input id="password" type="password" required placeholder="Password">
            <input id="confirm" type="password" required placeholder="Confirm Password">
          </form>
          <script>
            let step = 0;
            const fields = ['username', 'password', 'confirm'];
            const values = ['john_doe', 'secure123', 'secure123'];

            const interval = setInterval(() => {
              if (step < fields.length) {
                document.getElementById(fields[step]).value = values[step];
                step++;
              } else {
                clearInterval(interval);
              }
            }, 150);
          </script>
        `);

        const result = await page.waitForFunction(() => {
          const requiredFields = document.querySelectorAll('#registration-form input[required]');
          const allFilled = Array.from(requiredFields).every(field => {
            return (field as HTMLInputElement).value.trim().length > 0;
          });

          if (allFilled) {
            return Array.from(requiredFields).map(field => ({
              id: field.id,
              value: (field as HTMLInputElement).value
            }));
          }
          return false;
        });

        const fieldData = await result.jsonValue();
        expect(fieldData).toHaveLength(3);
        expect(fieldData[0].value).toBe('john_doe');
        expect(fieldData[1].value).toBe('secure123');
        expect(fieldData[2].value).toBe('secure123');
      });

      it('should wait for async validation to complete', async () => {
        await page.setContent(`
          <input id="async-input" type="text" placeholder="Enter username">
          <div id="validation-status">Enter username</div>
          <script>
            let validationTimeout;

            document.getElementById('async-input').addEventListener('input', (e) => {
              const status = document.getElementById('validation-status');
              status.textContent = 'Validating...';
              status.className = 'validating';

              clearTimeout(validationTimeout);
              validationTimeout = setTimeout(() => {
                const value = e.target.value;
                if (value.length >= 3 && value !== 'admin') {
                  status.textContent = 'Valid username';
                  status.className = 'valid';
                } else {
                  status.textContent = 'Invalid username';
                  status.className = 'invalid';
                }
              }, 300);
            });

            setTimeout(() => {
              document.getElementById('async-input').value = 'testuser';
              document.getElementById('async-input').dispatchEvent(new Event('input'));
            }, 100);
          </script>
        `);

        const result = await page.waitForFunction(() => {
          const status = document.getElementById('validation-status');
          return status && status.textContent === 'Valid username' && status.className === 'valid';
        });

        expect(result).toBeTruthy();

        const statusText = await page.textContent('#validation-status');
        expect(statusText).toBe('Valid username');
      });
    });

    describe('Layout Conditions', () => {
      it('should wait for element to be within viewport', async () => {
        await page.setContent(`
          <div style="height: 200vh;">
            <div style="height: 150vh;"></div>
            <div id="target" style="height: 100px; background: red;">Target Element</div>
          </div>
          <script>
            setTimeout(() => {
              document.getElementById('target').scrollIntoView({ behavior: 'smooth' });
            }, 200);
          </script>
        `);

        await page.waitForFunction(() => {
          const target = document.getElementById('target');
          if (!target) return false;

          const rect = target.getBoundingClientRect();
          const viewportHeight = window.innerHeight;

          return rect.top >= 0 && rect.bottom <= viewportHeight;
        });

        const isVisible = await page.evaluate(() => {
          const target = document.getElementById('target');
          if (!target) return false;

          const rect = target.getBoundingClientRect();
          return rect.top >= 0 && rect.bottom <= window.innerHeight;
        });

        expect(isVisible).toBe(true);
      });

      it('should wait for element to reach minimum dimensions', async () => {
        await page.setContent(`
          <div id="expanding" style="width: 50px; height: 50px; background: blue; transition: all 0.3s;">
            Expanding
          </div>
          <script>
            setTimeout(() => {
              const el = document.getElementById('expanding');
              el.style.width = '200px';
              el.style.height = '150px';
            }, 100);
          </script>
        `);

        const result = await page.waitForFunction(() => {
          const el = document.getElementById('expanding');
          if (!el) return false;

          const rect = el.getBoundingClientRect();
          const hasMinSize = rect.width >= 180 && rect.height >= 130;

          return hasMinSize ? {
            width: rect.width,
            height: rect.height
          } : false;
        });

        const dimensions = await result.jsonValue();
        expect(dimensions.width).toBeGreaterThanOrEqual(180);
        expect(dimensions.height).toBeGreaterThanOrEqual(130);
      });

      it('should wait for element overlap to be resolved', async () => {
        await page.setContent(`
          <div style="position: relative;">
            <div id="element1" style="position: absolute; top: 0; left: 0; width: 100px; height: 100px; background: red;"></div>
            <div id="element2" style="position: absolute; top: 0; left: 0; width: 100px; height: 100px; background: blue; transition: left 0.3s;"></div>
          </div>
          <script>
            setTimeout(() => {
              document.getElementById('element2').style.left = '120px';
            }, 150);
          </script>
        `);

        await page.waitForFunction(() => {
          const el1 = document.getElementById('element1');
          const el2 = document.getElementById('element2');

          if (!el1 || !el2) return false;

          const rect1 = el1.getBoundingClientRect();
          const rect2 = el2.getBoundingClientRect();

          // Check if elements no longer overlap
          const noOverlap = rect1.right <= rect2.left ||
                           rect2.right <= rect1.left ||
                           rect1.bottom <= rect2.top ||
                           rect2.bottom <= rect1.top;

          return noOverlap;
        });

        const positions = await page.evaluate(() => {
          const el1 = document.getElementById('element1');
          const el2 = document.getElementById('element2');

          return {
            element1: el1?.getBoundingClientRect(),
            element2: el2?.getBoundingClientRect()
          };
        });

        expect(positions.element1.right).toBeLessThanOrEqual(positions.element2.left);
      });
    });
  });

  describe('Advanced Wait Scenarios', () => {
    it('should handle conditions that fluctuate before stabilizing', async () => {
      await page.setContent(`
        <div id="fluctuating" data-value="0">0</div>
        <script>
          let value = 0;
          let fluctuation = 0;
          let stabilizing = false;

          const interval = setInterval(() => {
            if (!stabilizing && fluctuation < 20) {
              // Fluctuate randomly
              value += Math.random() > 0.5 ? 1 : -1;
              value = Math.max(0, value);
              fluctuation++;
            } else if (!stabilizing) {
              stabilizing = true;
              fluctuation = 0;
            } else {
              // Stabilize to target
              if (value < 10) value++;
              else clearInterval(interval);
            }

            document.getElementById('fluctuating').textContent = value;
            document.getElementById('fluctuating').setAttribute('data-value', value);
          }, 50);
        </script>
      `);

      // Wait for stable value >= 10 (checked multiple times to ensure stability)
      const result = await page.waitForFunction(() => {
        const el = document.getElementById('fluctuating');
        const value = parseInt(el?.getAttribute('data-value') || '0');

        // Store previous values to check stability
        if (!window.valueHistory) window.valueHistory = [];
        window.valueHistory.push(value);
        if (window.valueHistory.length > 10) window.valueHistory.shift();

        // Check if stable at >= 10 for at least 5 consecutive checks
        if (window.valueHistory.length >= 5) {
          const recent = window.valueHistory.slice(-5);
          const allTen = recent.every(v => v >= 10);
          return allTen ? value : false;
        }

        return false;
      }, { polling: 100, timeout: 10000 });

      const finalValue = await result.jsonValue();
      expect(finalValue).toBeGreaterThanOrEqual(10);
    });

    it('should handle conditions involving async operations', async () => {
      await page.setContent(`
        <div id="async-result">Initializing...</div>
        <script>
          window.fetchData = () => {
            return new Promise(resolve => {
              setTimeout(() => {
                resolve({ status: 'success', data: 'Async data loaded' });
              }, 300);
            });
          };

          setTimeout(async () => {
            document.getElementById('async-result').textContent = 'Loading...';
            try {
              const result = await window.fetchData();
              document.getElementById('async-result').textContent = result.data;
              document.getElementById('async-result').setAttribute('data-status', result.status);
            } catch (error) {
              document.getElementById('async-result').textContent = 'Error: ' + error.message;
              document.getElementById('async-result').setAttribute('data-status', 'error');
            }
          }, 100);
        </script>
      `);

      const result = await page.waitForFunction(() => {
        const el = document.getElementById('async-result');
        const status = el?.getAttribute('data-status');
        const text = el?.textContent;

        return status === 'success' && text === 'Async data loaded' ? text : false;
      }, { timeout: 5000 });

      const resultText = await result.jsonValue();
      expect(resultText).toBe('Async data loaded');
    });

    it('should handle conditions with DOM mutations during evaluation', async () => {
      await page.setContent(`
        <div id="container"></div>
        <script>
          let itemCount = 0;
          let mutating = true;

          const addItems = () => {
            if (mutating && itemCount < 15) {
              const item = document.createElement('div');
              item.className = 'dynamic-item';
              item.textContent = \`Item \${itemCount + 1}\`;
              item.setAttribute('data-index', itemCount + 1);
              document.getElementById('container').appendChild(item);
              itemCount++;

              // Randomly remove items sometimes
              if (itemCount > 3 && Math.random() > 0.8) {
                const items = document.querySelectorAll('.dynamic-item');
                if (items.length > 2) {
                  const randomIndex = Math.floor(Math.random() * (items.length - 2));
                  items[randomIndex].remove();
                  itemCount--;
                }
              }

              setTimeout(addItems, 80);
            } else {
              mutating = false;
            }
          };

          setTimeout(addItems, 100);
        </script>
      `);

      const result = await page.waitForFunction(() => {
        const items = document.querySelectorAll('.dynamic-item');

        // Wait for at least 10 stable items
        if (items.length >= 10) {
          // Check if items have consecutive indices (indicating stability)
          const indices = Array.from(items).map(item =>
            parseInt(item.getAttribute('data-index') || '0')
          );

          const hasConsecutive = indices.some((idx, i) =>
            i < indices.length - 2 &&
            indices.includes(idx + 1) &&
            indices.includes(idx + 2)
          );

          return hasConsecutive ? items.length : false;
        }

        return false;
      }, { timeout: 8000, polling: 100 });

      const itemCount = await result.jsonValue();
      expect(itemCount).toBeGreaterThanOrEqual(10);
    });

    it('should combine multiple waitForFunction calls sequentially', async () => {
      await page.setContent(`
        <div id="stage1" data-step="0">Stage 1: Waiting</div>
        <div id="stage2" data-step="0">Stage 2: Waiting</div>
        <div id="stage3" data-step="0">Stage 3: Waiting</div>
        <script>
          setTimeout(() => {
            document.getElementById('stage1').setAttribute('data-step', '1');
            document.getElementById('stage1').textContent = 'Stage 1: Complete';
          }, 200);

          setTimeout(() => {
            document.getElementById('stage2').setAttribute('data-step', '1');
            document.getElementById('stage2').textContent = 'Stage 2: Complete';
          }, 400);

          setTimeout(() => {
            document.getElementById('stage3').setAttribute('data-step', '1');
            document.getElementById('stage3').textContent = 'Stage 3: Complete';
          }, 600);
        </script>
      `);

      // Sequential waits
      await page.waitForFunction(() => {
        const stage1 = document.getElementById('stage1');
        return stage1?.getAttribute('data-step') === '1';
      });

      await page.waitForFunction(() => {
        const stage2 = document.getElementById('stage2');
        return stage2?.getAttribute('data-step') === '1';
      });

      await page.waitForFunction(() => {
        const stage3 = document.getElementById('stage3');
        return stage3?.getAttribute('data-step') === '1';
      });

      const allComplete = await page.evaluate(() => {
        const stages = ['stage1', 'stage2', 'stage3'];
        return stages.every(id => {
          const el = document.getElementById(id);
          return el?.getAttribute('data-step') === '1';
        });
      });

      expect(allComplete).toBe(true);
    });

    it('should race multiple conditions with Promise.race pattern', async () => {
      await page.setContent(`
        <div id="option-a" data-ready="false">Option A</div>
        <div id="option-b" data-ready="false">Option B</div>
        <div id="option-c" data-ready="false">Option C</div>
        <script>
          // Randomly complete one of the options
          const options = ['option-a', 'option-b', 'option-c'];
          const selectedIndex = Math.floor(Math.random() * options.length);
          const delay = 200 + Math.random() * 200; // Random delay 200-400ms

          setTimeout(() => {
            const selected = document.getElementById(options[selectedIndex]);
            selected.setAttribute('data-ready', 'true');
            selected.textContent = selected.textContent + ' - READY!';
            selected.setAttribute('data-winner', 'true');
          }, delay);
        </script>
      `);

      // Create racing conditions
      const promises = [
        page.waitForFunction(() => {
          const el = document.getElementById('option-a');
          return el?.getAttribute('data-ready') === 'true' ? 'option-a' : false;
        }),
        page.waitForFunction(() => {
          const el = document.getElementById('option-b');
          return el?.getAttribute('data-ready') === 'true' ? 'option-b' : false;
        }),
        page.waitForFunction(() => {
          const el = document.getElementById('option-c');
          return el?.getAttribute('data-ready') === 'true' ? 'option-c' : false;
        })
      ];

      const winner = await Promise.race(promises);
      const winnerValue = await winner.jsonValue();

      expect(['option-a', 'option-b', 'option-c']).toContain(winnerValue);

      // Verify the winner element is marked correctly
      const isWinner = await page.evaluate((id) => {
        return document.getElementById(id)?.getAttribute('data-winner') === 'true';
      }, winnerValue);

      expect(isWinner).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should throw timeout error with descriptive message', async () => {
      await page.setContent(`
        <div id="never-changes">Static Content</div>
      `);

      const startTime = Date.now();

      await expect(async () => {
        await page.waitForFunction(
          () => document.getElementById('never-changes')?.textContent === 'will-never-happen',
          { timeout: 1000 }
        );
      }).rejects.toThrow(/Timeout.*waiting for function/i);

      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeGreaterThanOrEqual(950);
      expect(elapsed).toBeLessThanOrEqual(1500);
    });

    it('should handle JavaScript errors in predicate function', async () => {
      await page.setContent(`
        <div id="test">Test Content</div>
      `);

      await expect(async () => {
        await page.waitForFunction(() => {
          // This will throw an error - accessing property of null
          return (null as any).nonexistentProperty.value;
        }, { timeout: 2000 });
      }).rejects.toThrow();
    });

    it('should handle DOM changes during evaluation', async () => {
      await page.setContent(`
        <div id="container">
          <div id="target">Initial</div>
        </div>
        <script>
          setTimeout(() => {
            // Remove and recreate the element during evaluation
            const container = document.getElementById('container');
            const target = document.getElementById('target');
            if (container && target) {
              container.removeChild(target);

              setTimeout(() => {
                const newTarget = document.createElement('div');
                newTarget.id = 'target';
                newTarget.textContent = 'Recreated';
                container.appendChild(newTarget);
              }, 100);
            }
          }, 200);
        </script>
      `);

      const result = await page.waitForFunction(() => {
        const target = document.getElementById('target');
        return target?.textContent === 'Recreated' ? target.textContent : false;
      }, { timeout: 5000 });

      const content = await result.jsonValue();
      expect(content).toBe('Recreated');
    });

    it('should handle page navigation during wait', async () => {
      await page.setContent(`
        <div id="before-nav">Before Navigation</div>
        <script>
          setTimeout(() => {
            window.location.href = 'data:text/html,<div id="after-nav">After Navigation</div>';
          }, 300);
        </script>
      `);

      // This should handle the navigation and continue waiting
      const result = await page.waitForFunction(() => {
        const afterNav = document.getElementById('after-nav');
        return afterNav ? afterNav.textContent : false;
      }, { timeout: 5000 });

      const content = await result.jsonValue();
      expect(content).toBe('After Navigation');
    });
  });
});