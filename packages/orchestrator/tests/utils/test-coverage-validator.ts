/**
 * Test coverage validator for EventCapture implementation
 * Validates that all functionality is properly tested
 */

import { EventEmitter } from 'eventemitter3';
import { EventCapture, createEventCapture, createConfirmationEventCapture } from './event-capture';

interface TestCoverageReport {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  coverage: {
    basicFunctionality: boolean;
    eventFiltering: boolean;
    eventRetrieval: boolean;
    assertions: boolean;
    asyncOperations: boolean;
    confirmationEvents: boolean;
    errorHandling: boolean;
    memoryManagement: boolean;
    helperFunctions: boolean;
  };
  details: string[];
  summary: string;
}

/**
 * Comprehensive test coverage validation for EventCapture
 */
export class TestCoverageValidator {
  private report: TestCoverageReport;
  private emitter: EventEmitter;

  constructor() {
    this.emitter = new EventEmitter();
    this.report = {
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      coverage: {
        basicFunctionality: false,
        eventFiltering: false,
        eventRetrieval: false,
        assertions: false,
        asyncOperations: false,
        confirmationEvents: false,
        errorHandling: false,
        memoryManagement: false,
        helperFunctions: false
      },
      details: [],
      summary: ''
    };
  }

  /**
   * Run all coverage tests and generate report
   */
  async validateCoverage(): Promise<TestCoverageReport> {
    console.log('🔍 Starting EventCapture test coverage validation...\n');

    // Test each major area
    await this.testBasicFunctionality();
    await this.testEventFiltering();
    await this.testEventRetrieval();
    await this.testAssertions();
    await this.testAsyncOperations();
    await this.testConfirmationEvents();
    await this.testErrorHandling();
    await this.testMemoryManagement();
    await this.testHelperFunctions();

    this.generateSummary();
    return this.report;
  }

  private async testBasicFunctionality(): Promise<void> {
    console.log('📋 Testing basic functionality...');

    try {
      const capture = createEventCapture(this.emitter);

      // Test event capture
      this.emitter.emit('test:basic', { id: 'test-1' });
      this.runTest('Basic event capture', () => {
        const events = capture.getAllEvents();
        return events.length === 1 && events[0].data.id === 'test-1';
      });

      // Test timestamps and indexes
      this.runTest('Event timestamps and indexes', () => {
        const events = capture.getAllEvents();
        return events[0].timestamp instanceof Date && events[0].index === 0;
      });

      // Test start/stop
      capture.stop();
      this.emitter.emit('test:ignored', {});
      capture.start();
      this.emitter.emit('test:after-restart', {});

      this.runTest('Start/stop functionality', () => {
        const events = capture.getAllEvents();
        return events.length === 2 && events[1].type === 'test:after-restart';
      });

      // Test clear
      capture.clear();
      this.runTest('Clear functionality', () => {
        return capture.getAllEvents().length === 0;
      });

      capture.dispose();
      this.report.coverage.basicFunctionality = true;
    } catch (error) {
      this.addDetail(`❌ Basic functionality test failed: ${error}`);
    }
  }

  private async testEventFiltering(): Promise<void> {
    console.log('🔽 Testing event filtering...');

    try {
      const capture = new EventCapture(this.emitter, {
        autoStart: true,
        filterTypes: ['filtered:event', 'another:filtered']
      });

      this.emitter.emit('filtered:event', { id: 1 });
      this.emitter.emit('ignored:event', { id: 2 });
      this.emitter.emit('another:filtered', { id: 3 });

      this.runTest('Event type filtering', () => {
        const events = capture.getAllEvents();
        return events.length === 2 &&
               events.every(e => ['filtered:event', 'another:filtered'].includes(e.type));
      });

      capture.dispose();
      this.report.coverage.eventFiltering = true;
    } catch (error) {
      this.addDetail(`❌ Event filtering test failed: ${error}`);
    }
  }

  private async testEventRetrieval(): Promise<void> {
    console.log('🔍 Testing event retrieval...');

    try {
      const capture = createEventCapture(this.emitter);

      // Setup test events
      this.emitter.emit('type:a', { id: 1 });
      this.emitter.emit('type:b', { id: 2 });
      this.emitter.emit('type:a', { id: 3 });
      this.emitter.emit('type:c', { id: 4 });

      this.runTest('Get events by type', () => {
        const typeAEvents = capture.getEventsByType('type:a');
        return typeAEvents.length === 2 && typeAEvents[0].data.id === 1;
      });

      this.runTest('Get events by multiple types', () => {
        const events = capture.getEventsByTypes(['type:a', 'type:b']);
        return events.length === 3;
      });

      this.runTest('Get last event', () => {
        const lastEvent = capture.getLastEvent();
        return lastEvent?.type === 'type:c' && lastEvent.data.id === 4;
      });

      this.runTest('Get last event of type', () => {
        const lastTypeA = capture.getLastEventOfType('type:a');
        return lastTypeA?.data.id === 3;
      });

      this.runTest('Get events with predicate', () => {
        const evenIdEvents = capture.getEventsWhere(e => e.data.id % 2 === 0);
        return evenIdEvents.length === 2;
      });

      capture.dispose();
      this.report.coverage.eventRetrieval = true;
    } catch (error) {
      this.addDetail(`❌ Event retrieval test failed: ${error}`);
    }
  }

  private async testAssertions(): Promise<void> {
    console.log('✅ Testing assertions...');

    try {
      const capture = createEventCapture(this.emitter);

      this.emitter.emit('assert:test', { value: 'test-data' });
      this.emitter.emit('assert:another', { count: 5 });

      // Test positive assertions
      this.runTest('expectEventEmitted (positive)', () => {
        capture.expectEventEmitted('assert:test');
        return true;
      });

      this.runTest('expectEventNotEmitted (positive)', () => {
        capture.expectEventNotEmitted('nonexistent:event');
        return true;
      });

      this.runTest('expectEventData', () => {
        capture.expectEventData('assert:test', { value: 'test-data' });
        return true;
      });

      this.runTest('expectEventCount', () => {
        capture.expectEventCount('assert:test', 1);
        return true;
      });

      this.runTest('expectEventSequence', () => {
        capture.expectEventSequence(['assert:test', 'assert:another']);
        return true;
      });

      // Test negative assertions (should throw)
      this.runTest('expectEventEmitted (negative)', () => {
        try {
          capture.expectEventEmitted('missing:event');
          return false; // Should have thrown
        } catch {
          return true; // Expected to throw
        }
      });

      capture.dispose();
      this.report.coverage.assertions = true;
    } catch (error) {
      this.addDetail(`❌ Assertions test failed: ${error}`);
    }
  }

  private async testAsyncOperations(): Promise<void> {
    console.log('⏱️ Testing async operations...');

    try {
      const capture = createEventCapture(this.emitter);

      // Test waitForEvent
      const eventPromise = capture.waitForEvent('async:test', 1000);
      setTimeout(() => {
        this.emitter.emit('async:test', { id: 'async-1' });
      }, 50);

      const event = await eventPromise;
      this.runTest('waitForEvent', () => {
        return event.type === 'async:test' && event.data.id === 'async-1';
      });

      // Test waitForEventSequence
      const sequencePromise = capture.waitForEventSequence(['seq:1', 'seq:2'], 1000);
      setTimeout(() => {
        this.emitter.emit('seq:1', {});
        setTimeout(() => {
          this.emitter.emit('seq:2', {});
        }, 20);
      }, 30);

      const sequenceEvents = await sequencePromise;
      this.runTest('waitForEventSequence', () => {
        return sequenceEvents.length === 2 &&
               sequenceEvents[0].type === 'seq:1' &&
               sequenceEvents[1].type === 'seq:2';
      });

      // Test timeout behavior
      try {
        await capture.waitForEvent('never:emitted', 100);
        this.runTest('Timeout handling', () => false); // Should have thrown
      } catch (error) {
        this.runTest('Timeout handling', () => {
          return error instanceof Error && error.message.includes('Timeout');
        });
      }

      capture.dispose();
      this.report.coverage.asyncOperations = true;
    } catch (error) {
      this.addDetail(`❌ Async operations test failed: ${error}`);
    }
  }

  private async testConfirmationEvents(): Promise<void> {
    console.log('🔐 Testing confirmation event helpers...');

    try {
      const capture = createEventCapture(this.emitter);

      // Emit various confirmation events
      this.emitter.emit('approval:required', { taskId: 'test-task' });
      this.emitter.emit('approval:granted', { approver: 'test-user' });
      this.emitter.emit('gate:approved', { gateName: 'test-gate' });
      this.emitter.emit('permission:request', { requestId: 'req-1' });
      this.emitter.emit('dangerous:detected', { operationId: 'op-1' });

      this.runTest('getApprovalRequiredEvents', () => {
        const events = capture.getApprovalRequiredEvents();
        return events.length === 1 && events[0].data.taskId === 'test-task';
      });

      this.runTest('getApprovalGrantedEvents', () => {
        const events = capture.getApprovalGrantedEvents();
        return events.length === 1 && events[0].data.approver === 'test-user';
      });

      this.runTest('getGateEvents', () => {
        const events = capture.getGateEvents();
        return events.length === 1 && events[0].type === 'gate:approved';
      });

      this.runTest('getConfirmationEvents', () => {
        const events = capture.getConfirmationEvents();
        return events.length >= 4; // Should include all confirmation-related events
      });

      capture.dispose();
      this.report.coverage.confirmationEvents = true;
    } catch (error) {
      this.addDetail(`❌ Confirmation events test failed: ${error}`);
    }
  }

  private async testErrorHandling(): Promise<void> {
    console.log('🚨 Testing error handling...');

    try {
      const capture = createEventCapture(this.emitter);

      // Test with null/undefined data
      this.emitter.emit('null:data', null);
      this.emitter.emit('undefined:data', undefined);

      this.runTest('Null/undefined data handling', () => {
        const events = capture.getAllEvents();
        return events.length === 2 &&
               events[0].data === null &&
               events[1].data === undefined;
      });

      // Test with circular references
      const circular = { value: 'test' } as any;
      circular.self = circular;
      this.emitter.emit('circular:test', circular);

      this.runTest('Circular reference handling', () => {
        const events = capture.getEventsByType('circular:test');
        return events.length === 1 && events[0].data.value === 'test';
      });

      // Test invalid assertions
      this.runTest('Invalid assertion handling', () => {
        try {
          capture.expectEventData('nonexistent:event', { test: 'value' });
          return false; // Should throw
        } catch (error) {
          return error instanceof Error;
        }
      });

      capture.dispose();
      this.report.coverage.errorHandling = true;
    } catch (error) {
      this.addDetail(`❌ Error handling test failed: ${error}`);
    }
  }

  private async testMemoryManagement(): Promise<void> {
    console.log('💾 Testing memory management...');

    try {
      const capture = new EventCapture(this.emitter, {
        autoStart: true,
        maxEvents: 3
      });

      // Emit more events than limit
      for (let i = 0; i < 10; i++) {
        this.emitter.emit('memory:test', { index: i });
      }

      this.runTest('Max events limit enforcement', () => {
        const events = capture.getAllEvents();
        return events.length === 3 &&
               events[0].data.index === 7 &&
               events[2].data.index === 9;
      });

      // Test listener cleanup
      const initialListenerCount = this.emitter.listenerCount('memory:test');
      capture.dispose();

      this.runTest('Listener cleanup', () => {
        return this.emitter.listenerCount('memory:test') === initialListenerCount;
      });

      this.report.coverage.memoryManagement = true;
    } catch (error) {
      this.addDetail(`❌ Memory management test failed: ${error}`);
    }
  }

  private async testHelperFunctions(): Promise<void> {
    console.log('🛠️ Testing helper functions...');

    try {
      // Test createEventCapture
      const capture1 = createEventCapture(this.emitter);
      this.emitter.emit('helper:test1', {});

      this.runTest('createEventCapture functionality', () => {
        return capture1.getAllEvents().length === 1;
      });

      // Test createConfirmationEventCapture
      const capture2 = createConfirmationEventCapture(this.emitter);
      this.emitter.emit('approval:required', { test: true });
      this.emitter.emit('task:started', { test: true }); // Should be filtered out

      this.runTest('createConfirmationEventCapture filtering', () => {
        const events = capture2.getAllEvents();
        return events.length === 1 && events[0].type === 'approval:required';
      });

      capture1.dispose();
      capture2.dispose();
      this.report.coverage.helperFunctions = true;
    } catch (error) {
      this.addDetail(`❌ Helper functions test failed: ${error}`);
    }
  }

  private runTest(testName: string, testFn: () => boolean): void {
    this.report.totalTests++;
    try {
      const result = testFn();
      if (result) {
        this.report.passedTests++;
        this.addDetail(`✅ ${testName}: PASSED`);
      } else {
        this.report.failedTests++;
        this.addDetail(`❌ ${testName}: FAILED`);
      }
    } catch (error) {
      this.report.failedTests++;
      this.addDetail(`❌ ${testName}: ERROR - ${error}`);
    }
  }

  private addDetail(detail: string): void {
    this.report.details.push(detail);
    console.log(`   ${detail}`);
  }

  private generateSummary(): void {
    const coverageAreas = Object.values(this.report.coverage);
    const coverageCount = coverageAreas.filter(Boolean).length;
    const totalCoverageAreas = coverageAreas.length;
    const coveragePercentage = (coverageCount / totalCoverageAreas) * 100;
    const passRate = (this.report.passedTests / this.report.totalTests) * 100;

    this.report.summary = `
📊 EventCapture Test Coverage Report
${'='.repeat(40)}

📈 Overall Statistics:
   Total Tests: ${this.report.totalTests}
   Passed: ${this.report.passedTests}
   Failed: ${this.report.failedTests}
   Pass Rate: ${passRate.toFixed(1)}%

🎯 Coverage Areas (${coverageCount}/${totalCoverageAreas}):
   ${this.report.coverage.basicFunctionality ? '✅' : '❌'} Basic Functionality
   ${this.report.coverage.eventFiltering ? '✅' : '❌'} Event Filtering
   ${this.report.coverage.eventRetrieval ? '✅' : '❌'} Event Retrieval
   ${this.report.coverage.assertions ? '✅' : '❌'} Assertions
   ${this.report.coverage.asyncOperations ? '✅' : '❌'} Async Operations
   ${this.report.coverage.confirmationEvents ? '✅' : '❌'} Confirmation Events
   ${this.report.coverage.errorHandling ? '✅' : '❌'} Error Handling
   ${this.report.coverage.memoryManagement ? '✅' : '❌'} Memory Management
   ${this.report.coverage.helperFunctions ? '✅' : '❌'} Helper Functions

📊 Coverage Score: ${coveragePercentage.toFixed(1)}%

${coveragePercentage === 100 && passRate === 100
  ? '🎉 EXCELLENT: Full test coverage achieved!'
  : coveragePercentage >= 90 && passRate >= 95
  ? '✅ GOOD: High test coverage'
  : '⚠️ NEEDS IMPROVEMENT: Incomplete test coverage'}
`;

    console.log(this.report.summary);
  }

  /**
   * Run a quick smoke test to verify basic functionality
   */
  static async smokeTtest(): Promise<boolean> {
    console.log('🚀 Running EventCapture smoke test...\n');

    try {
      const emitter = new EventEmitter();
      const capture = createEventCapture(emitter);

      // Basic functionality test
      emitter.emit('smoke:test', { success: true });
      const events = capture.getAllEvents();

      if (events.length !== 1 || !events[0].data.success) {
        console.log('❌ Smoke test FAILED: Basic event capture not working');
        return false;
      }

      // Assertion test
      capture.expectEventEmitted('smoke:test');
      capture.expectEventData('smoke:test', { success: true });

      // Cleanup test
      capture.dispose();

      console.log('✅ Smoke test PASSED: EventCapture is working correctly\n');
      return true;

    } catch (error) {
      console.log(`❌ Smoke test FAILED: ${error}\n`);
      return false;
    }
  }
}

/**
 * Run test coverage validation
 */
export async function runCoverageValidation(): Promise<TestCoverageReport> {
  const validator = new TestCoverageValidator();
  return await validator.validateCoverage();
}

/**
 * Run smoke test only
 */
export async function runSmokeTest(): Promise<boolean> {
  return await TestCoverageValidator.smokeTtest();
}

// CLI interface
if (require.main === module) {
  (async () => {
    const args = process.argv.slice(2);

    if (args.includes('--smoke')) {
      const passed = await runSmokeTest();
      process.exit(passed ? 0 : 1);
    } else {
      const report = await runCoverageValidation();
      const allCovered = Object.values(report.coverage).every(Boolean);
      const allPassed = report.failedTests === 0;
      process.exit(allCovered && allPassed ? 0 : 1);
    }
  })().catch(error => {
    console.error('Validation failed:', error);
    process.exit(1);
  });
}