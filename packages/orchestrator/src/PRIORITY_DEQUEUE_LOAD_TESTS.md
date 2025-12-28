# Priority-Based Dequeuing Under Load Integration Tests

## Overview
This document describes the comprehensive integration tests for priority-based dequeuing under high load conditions, implemented in `priority-based-dequeuing-load.integration.test.ts`.

## Test Acceptance Criteria
The tests verify the following acceptance criteria:

1. ✅ **Queue tasks with mixed priorities under high load**
2. ✅ **Verify urgent/high priority tasks are dequeued before normal/low**
3. ✅ **Verify effort-based tie-breaking works correctly under load**
4. ✅ **Test concurrent dequeuing respects priority**

## Test Structure

### Mixed Priority Task Queueing Under High Load
- `should maintain priority ordering when queueing 100+ mixed priority tasks under high load`
  - Creates 150 mixed priority tasks with realistic distribution (10% urgent, 25% high, 45% normal, 20% low)
  - Tests under high concurrency (8 concurrent tasks) with fast polling (25ms intervals)
  - Verifies average execution positions follow priority order: urgent < high < normal < low
  - Ensures at least 80% of urgent tasks complete in first 40% of executions

- `should handle rapid task insertion while maintaining priority order`
  - Adds 120 tasks in 6 waves of 20 tasks each (every 200ms) to simulate real-world load
  - Tests priority ordering even when tasks are added during processing
  - Verifies urgent/high priority tasks dominate first half of completions

### Urgent/High Priority Dequeuing Verification
- `should consistently dequeue urgent tasks before normal/low priority tasks under load`
  - Tests with 20 urgent (medium effort), 30 normal (small effort), 25 low (xs effort) tasks
  - Uses high concurrency (10 tasks) to create load pressure
  - Verifies urgent tasks complete before normal/low despite having larger effort
  - Ensures less than 15 task overlap between last urgent and first normal completion

- `should dequeue high priority tasks before normal/low priority under sustained load`
  - Continuously adds mixed priority tasks every 150ms to maintain sustained load
  - Tests with 8 concurrent workers processing 100 total tasks
  - Analyzes priority distribution across time windows
  - Verifies high priority tasks maintain better average position than normal/low

### Effort-Based Tie-Breaking Under Load
- `should correctly apply effort-based tie-breaking for same priority tasks under load`
  - Creates controlled scenario with 5 high-priority tasks of different efforts (xs, small, medium, large, xl)
  - Plus mixed urgent, normal, and low priority tasks for context
  - Uses moderate concurrency (5 tasks) to observe tie-breaking clearly
  - Verifies effort ordering within priority groups: xs < small < medium < large < xl

- `should maintain effort-based ordering under heavy concurrent load`
  - Creates 40 tasks (8 of each effort level) all with same priority (normal)
  - Tests under high concurrency (8 concurrent tasks) with fast polling
  - Verifies average positions follow effort order across all effort levels
  - Ensures smaller effort tasks dominate early execution positions

### Concurrent Dequeuing Priority Respect
- `should maintain priority ordering when multiple workers dequeue concurrently`
  - Tests realistic mixed workload: 15 urgent, 25 high, 35 normal, 25 low priority tasks
  - Uses very high concurrency (12 concurrent tasks) with fast polling (20ms)
  - Analyzes dequeue timeline to verify priority ordering
  - Allows <5% priority violation rate due to concurrent execution
  - Verifies early dequeues dominated by high-priority tasks

- `should handle priority changes during concurrent dequeuing`
  - Starts with 35 normal/low priority tasks
  - Adds 10 urgent tasks after 500ms and 5 more after 1500ms
  - Tests that urgent tasks added later still get prioritized
  - Verifies late urgent tasks execute in first 70% despite late insertion

## Test Configuration
- **Environment**: Node.js (via vitest config)
- **Concurrency**: 5-12 concurrent tasks depending on test scenario
- **Load Generation**: 100-150 tasks per test with realistic priority distributions
- **Timing**: Fast polling intervals (20-50ms) to create load pressure
- **Validation**: Statistical analysis of execution order, average positions, and timing
- **Tolerances**: Allows variance for concurrent execution while maintaining overall priority order

## Mock Strategy
- **TaskStore**: Mocked with priority-based sorting (priority → effort → creation time)
- **ApexOrchestrator**: Mocked with realistic execution times based on effort levels
- **Core Config**: Mocked with high-concurrency daemon settings
- **Timing Tracking**: Comprehensive tracking of dequeue times, execution start/end times

## Performance Expectations
- **Throughput**: 10-15+ tasks per second under load
- **Priority Respect**: <5% violations due to concurrent execution
- **Effort Ordering**: Clear statistical trends within priority groups
- **Load Handling**: Stable performance with rapid task insertion

## Coverage Verification
These tests provide comprehensive coverage for:
- High-volume priority-based task queuing
- Concurrent dequeuing under load
- Priority precedence verification
- Effort-based tie-breaking under pressure
- Real-world load simulation and edge cases
- Performance under sustained and burst loads