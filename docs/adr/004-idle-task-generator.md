# ADR-004: IdleTaskGenerator with Weighted Strategy Selection

## Status
Proposed

## Date
2024-12-20

## Context

APEX v0.4.0 introduces idle processing capabilities through the `IdleProcessor` class, which analyzes projects and generates improvement tasks. However, the current implementation lacks a dedicated component for:

1. **Weighted random selection** of task types based on configurable `strategyWeights`
2. **Modular analyzers** for each strategy type (maintenance, refactoring, docs, tests)
3. **Separation of concerns** between task generation logic and project analysis

The existing `StrategyWeightsSchema` in `@apexcli/core` already defines the configuration structure:
```typescript
StrategyWeightsSchema = z.object({
  maintenance: z.number().min(0).max(1).optional().default(0.25),
  refactoring: z.number().min(0).max(1).optional().default(0.25),
  docs: z.number().min(0).max(1).optional().default(0.25),
  tests: z.number().min(0).max(1).optional().default(0.25),
});
```

## Decision

### 1. Create `IdleTaskGenerator` Class

Create a new `IdleTaskGenerator` class in `packages/orchestrator/src/idle-task-generator.ts` with the following architecture:

```
IdleTaskGenerator
├── constructor(config: StrategyWeights)
├── selectTaskType(): IdleTaskType              # Weighted random selection
├── generateTask(analysis: ProjectAnalysis): IdleTask | null
└── analyzers: Map<IdleTaskType, StrategyAnalyzer>
    ├── MaintenanceAnalyzer
    ├── RefactoringAnalyzer
    ├── DocsAnalyzer
    └── TestsAnalyzer
```

### 2. Strategy Analyzer Interface

Define a common interface for all strategy analyzers:

```typescript
interface StrategyAnalyzer {
  type: IdleTaskType;
  analyze(analysis: ProjectAnalysis): TaskCandidate[];
  prioritize(candidates: TaskCandidate[]): TaskCandidate | null;
}

interface TaskCandidate {
  title: string;
  description: string;
  priority: TaskPriority;
  estimatedEffort: 'low' | 'medium' | 'high';
  suggestedWorkflow: string;
  rationale: string;
  score: number;  // For prioritization within analyzer
}
```

### 3. Weighted Random Selection Algorithm

Use cumulative probability distribution for O(n) weighted selection:

```typescript
selectTaskType(): IdleTaskType {
  const types: IdleTaskType[] = ['maintenance', 'refactoring', 'docs', 'tests'];
  const total = types.reduce((sum, type) => sum + this.weights[type], 0);

  if (total === 0) {
    // All weights are zero, fall back to uniform distribution
    return types[Math.floor(Math.random() * types.length)];
  }

  const random = Math.random() * total;
  let cumulative = 0;

  for (const type of types) {
    cumulative += this.weights[type];
    if (random < cumulative) {
      return type;
    }
  }

  return types[types.length - 1]; // Fallback for floating point edge cases
}
```

### 4. Analyzer Implementations

Each analyzer focuses on its domain:

| Analyzer | ProjectAnalysis Fields | Task Generation Logic |
|----------|----------------------|----------------------|
| `MaintenanceAnalyzer` | `dependencies.outdated`, `dependencies.security` | Prioritize security updates, then outdated deps |
| `RefactoringAnalyzer` | `codeQuality.lintIssues`, `codeQuality.complexityHotspots`, `codeQuality.duplicatedCode` | Address high-complexity files, reduce duplication |
| `DocsAnalyzer` | `documentation.coverage`, `documentation.missingDocs` | Target undocumented core modules first |
| `TestsAnalyzer` | `testCoverage.percentage`, `testCoverage.uncoveredFiles` | Focus on critical paths without test coverage |

### 5. Integration with IdleProcessor

The `IdleProcessor` will use `IdleTaskGenerator` for task generation:

```typescript
class IdleProcessor {
  private taskGenerator: IdleTaskGenerator;

  constructor(projectPath: string, config: DaemonConfig, store: TaskStore) {
    const weights = config.idleProcessing?.strategyWeights ?? {
      maintenance: 0.25,
      refactoring: 0.25,
      docs: 0.25,
      tests: 0.25,
    };
    this.taskGenerator = new IdleTaskGenerator(weights);
  }

  private async generateTasksFromAnalysis(analysis: ProjectAnalysis): Promise<IdleTask[]> {
    const tasks: IdleTask[] = [];
    const maxTasks = this.config.idleProcessing?.maxIdleTasks || 3;

    for (let i = 0; i < maxTasks; i++) {
      const task = this.taskGenerator.generateTask(analysis);
      if (task) {
        tasks.push(task);
      }
    }

    return tasks;
  }
}
```

## File Structure

```
packages/orchestrator/src/
├── idle-task-generator.ts          # Main IdleTaskGenerator class
├── idle-task-generator.test.ts     # Unit tests
├── analyzers/
│   ├── index.ts                    # Analyzer interface and exports
│   ├── maintenance-analyzer.ts     # Maintenance strategy
│   ├── refactoring-analyzer.ts     # Refactoring strategy
│   ├── docs-analyzer.ts            # Documentation strategy
│   └── tests-analyzer.ts           # Test coverage strategy
└── idle-processor.ts               # Updated to use IdleTaskGenerator
```

## Class Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      IdleTaskGenerator                           │
├─────────────────────────────────────────────────────────────────┤
│ - weights: StrategyWeights                                       │
│ - analyzers: Map<IdleTaskType, StrategyAnalyzer>                │
│ - usedCandidates: Set<string>  // Prevent duplicates            │
├─────────────────────────────────────────────────────────────────┤
│ + constructor(weights: StrategyWeights)                          │
│ + selectTaskType(): IdleTaskType                                 │
│ + generateTask(analysis: ProjectAnalysis): IdleTask | null      │
│ + reset(): void  // Clear usedCandidates for new cycle          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ uses
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    <<interface>> StrategyAnalyzer                │
├─────────────────────────────────────────────────────────────────┤
│ + type: IdleTaskType                                             │
│ + analyze(analysis: ProjectAnalysis): TaskCandidate[]           │
│ + prioritize(candidates: TaskCandidate[]): TaskCandidate | null │
└─────────────────────────────────────────────────────────────────┘
           △                     △                     △
           │                     │                     │
┌──────────┴──────┐  ┌──────────┴──────┐  ┌──────────┴──────┐
│ MaintenanceAnal │  │ RefactoringAnal │  │ DocsAnalyzer    │
└─────────────────┘  └─────────────────┘  └─────────────────┘
                              △
                              │
                    ┌─────────┴─────────┐
                    │ TestsAnalyzer     │
                    └───────────────────┘
```

## Sequence Diagram

```
IdleProcessor          IdleTaskGenerator       StrategyAnalyzer
     │                        │                       │
     │ generateTask(analysis) │                       │
     │───────────────────────>│                       │
     │                        │                       │
     │                        │ selectTaskType()      │
     │                        │──────────┐            │
     │                        │<─────────┘            │
     │                        │ (weighted random)     │
     │                        │                       │
     │                        │ getAnalyzer(type)     │
     │                        │──────────┐            │
     │                        │<─────────┘            │
     │                        │                       │
     │                        │ analyze(analysis)     │
     │                        │──────────────────────>│
     │                        │                       │
     │                        │    TaskCandidate[]    │
     │                        │<──────────────────────│
     │                        │                       │
     │                        │ prioritize(candidates)│
     │                        │──────────────────────>│
     │                        │                       │
     │                        │    TaskCandidate      │
     │                        │<──────────────────────│
     │                        │                       │
     │                        │ toIdleTask(candidate) │
     │                        │──────────┐            │
     │     IdleTask           │<─────────┘            │
     │<───────────────────────│                       │
     │                        │                       │
```

## Consequences

### Positive
- **Modularity**: Each analyzer can be developed, tested, and modified independently
- **Extensibility**: New strategy types can be added by implementing `StrategyAnalyzer`
- **Testability**: Weighted selection and analyzers can be unit tested in isolation
- **Configuration-driven**: Strategy weights from config drive task generation behavior
- **Separation of concerns**: Project analysis (IdleProcessor) is decoupled from task generation (IdleTaskGenerator)

### Negative
- **Increased complexity**: More files and abstractions
- **Potential over-engineering**: For simple use cases, the analyzer interface may be overkill

### Neutral
- **Migration path**: Existing `generateTasksFromAnalysis` logic in `IdleProcessor` will need refactoring

## Test Strategy

### Unit Tests (`idle-task-generator.test.ts`)

1. **Weighted Selection Tests**
   - Equal weights → uniform distribution (statistical test with tolerance)
   - Single non-zero weight → always selects that type
   - Zero weights → fallback to uniform
   - Edge case: weights summing to > 1

2. **Analyzer Tests** (per analyzer file)
   - Returns empty array for healthy analysis
   - Prioritizes correctly based on severity
   - Generates appropriate task descriptions

3. **Integration Tests**
   - `IdleProcessor` uses `IdleTaskGenerator` correctly
   - Generated tasks match strategy weights over many iterations

## Implementation Notes

1. **Dependency Injection**: Consider making analyzers injectable for testing
2. **Caching**: Analyzer results could be cached within a generation cycle
3. **Logging**: Add debug logging for strategy selection decisions
4. **Metrics**: Consider adding telemetry for strategy selection distribution

## Related

- `packages/core/src/types.ts` - `StrategyWeightsSchema`, `IdleTaskTypeSchema`
- `packages/orchestrator/src/idle-processor.ts` - Current idle processing implementation
- `packages/core/src/idle-task-strategy.test.ts` - Existing schema tests
