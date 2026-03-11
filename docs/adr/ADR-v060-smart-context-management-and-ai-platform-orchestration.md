# ADR: v0.6.0 Smart Context Management and AI Platform Agnostic Orchestration

**Status**: Verified
**Date**: 2025-03-10
**Decision Makers**: Architecture Review
**Context**: Architecture audit of v0.6.0 features

## Summary

This ADR documents the architectural design and implementation audit of the v0.6.0 Smart Context Management and AI Platform Agnostic Orchestration features in APEX.

## Context

APEX v0.6.0 introduces two major architectural features:

1. **Smart Context Management**: Intelligent context assembly with token budget management
2. **AI Platform Agnostic Orchestration**: Multi-provider driver architecture with unified interfaces
3. **OAuth/Credential Support**: Secure credential storage and authentication

## Architecture Overview

### 1. Smart Context Management

#### 1.1 SmartContextManager

**Location**: `packages/orchestrator/src/smart-context-manager.ts`

**Purpose**: Orchestrates all context sources into a unified context package within token budgets.

**Token Budget Allocation** (percentage of `maxTokensPerTask * contextBudgetPercent`):
- Project Context: 20%
- Codebase Intelligence: 40%
- Memory: 20%
- Task History: 12%
- Living Memory: 8%

**Key Interfaces**:
```typescript
interface ContextBudget {
  projectContext: number;
  codebaseIntelligence: number;
  memory: number;
  taskHistory: number;
  livingMemory: number;
}

interface UnifiedContext {
  projectContext?: string;
  enrichedContext?: string;
  memoryContext?: string;
  taskHistoryContext?: string;
  livingMemory?: string;
  budget: ContextBudget;
  visualization: ContextVisualization;
}
```

**Design Decisions**:
- Token estimation uses 4 characters per token approximation
- Automatic truncation with `...truncated` suffix when exceeding budgets
- Progress bar visualization for debugging context allocation

#### 1.2 Context Enrichment Bridge

**Location**: `packages/orchestrator/src/context-enrichment.ts`

**Purpose**: Connects CodebaseIntelligenceService to the prompt system.

**Key Functions**:
- `enrichTaskContext()`: Searches codebase for task-relevant files and symbols
- `formatEnrichedContext()`: Formats enriched data into markdown sections

**Output Sections**:
1. Relevant Files (with relevance scores)
2. Relevant Symbols (with signatures and locations)
3. Repository Structure (file listings with exported symbols)
4. Import Dependencies (graph edges)
5. Type Relationships (inheritance/implementation chains)

#### 1.3 Codebase Intelligence Service

**Location**: `packages/orchestrator/src/codebase-intelligence/codebase-intelligence-service.ts`

**Components**:
- **Indexer**: Directory scanning and RepositoryMap generation
- **SymbolResolver**: Cross-file symbol resolution
- **ImportGraphBuilder**: Dependency analysis
- **SemanticSearch**: Natural language code search (TF-IDF + fuzzy matching)
- **ReferenceExtractor**: Reference tracking
- **TypeRelationshipMap**: Type hierarchy analysis

**Multi-Language Support**: TypeScript, JavaScript, Python, Go, Java, Rust, C++

**Caching Strategy**:
- LRU cache with 1000 entry limit
- Cache invalidation by pattern for dependent analyses

#### 1.4 Memory Manager

**Location**: `packages/orchestrator/src/memory-manager.ts`

**Memory Types**: `fact`, `pattern`, `preference`, `convention`, `insight`

**Features**:
- Confidence scoring and expiration
- Tag-based organization
- Relevance-based recall with usage tracking
- Living memory for session context

### 2. AI Platform Agnostic Orchestration

#### 2.1 Driver Interface

**Location**: `packages/orchestrator/src/drivers/types.ts`

**Core Interface**:
```typescript
interface AiDriver {
  readonly providerId: string;
  initialize(): Promise<void>;
  authenticate(): Promise<void>;
  stream(request: DriverRequest): AsyncIterable<DriverEvent>;
  resolveModel(modelAlias: string): string;
  dispose(): Promise<void>;
}
```

**Unified Message Format**:
```typescript
interface DriverRequest {
  prompt: string;
  systemPrompt?: string;
  model: string;
  maxTurns?: number;
  tools?: ToolDefinition[];
  context?: any;
  cwd?: string;
  mcpServers?: Record<string, any>;
  abortController?: AbortController;
}

type DriverEvent =
  | { type: 'text'; content: string }
  | { type: 'thinking'; content: string }
  | { type: 'tool_call'; id: string; name: string; input: any }
  | { type: 'tool_result'; id: string; content: any; isError: boolean }
  | { type: 'usage'; inputTokens: number; outputTokens: number }
  | { type: 'error'; message: string; code?: string }
  | { type: 'status'; message: string }
  | { type: 'complete'; summary: string };
```

#### 2.2 Driver Implementations

| Driver | File | Provider | Key Features |
|--------|------|----------|--------------|
| AnthropicDriver | `anthropic-driver.ts` | Claude | Claude Agent SDK, thinking blocks, MCP support, AbortController for subprocess management |
| OpenAiCodexDriver | `openai-driver.ts` | GPT | Dynamic import (optional dependency), streaming completions |
| GeminiDriver | `gemini-driver.ts` | Gemini | Dynamic import, system instruction support |
| GenericAgnosticDriver | `agnostic-driver.ts` | Multi-provider | Vercel AI SDK, JSON Schema to Zod conversion, provider selection via env |

**Model Alias Resolution**:

| Alias | Anthropic | OpenAI | Gemini |
|-------|-----------|--------|--------|
| opus | claude-opus-4-5-20251101 | gpt-4o | gemini-2.0-flash |
| sonnet | claude-sonnet-4-20250514 | gpt-4o | gemini-2.0-flash |
| haiku | claude-haiku-4-5-20251001 | gpt-4o-mini | gemini-2.0-flash-lite |

#### 2.3 Driver Factory

**Location**: `packages/orchestrator/src/drivers/index.ts`

**Pattern**: Singleton factory with lazy initialization and instance caching.

```typescript
class DriverFactory {
  private static drivers: Map<string, AiDriver> = new Map();
  static getDriver(providerId: string): AiDriver;
}
```

### 3. OAuth & Credential Management

#### 3.1 CredentialManager

**Location**: `packages/orchestrator/src/auth/credential-manager.ts`

**Storage**: File-based at `~/.apex/credentials.json` with secure permissions (mode 0o600)

**Credential Format**:
```typescript
interface Credentials {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  provider: string;
}
```

**Methods**:
- `saveCredentials(provider, creds)`: Store provider credentials
- `getCredentials(provider)`: Retrieve provider credentials
- `deleteCredentials(provider)`: Remove provider credentials

#### 3.2 Authentication Flow

1. CLI command: `apex auth login <provider>`
2. CredentialManager stores credentials securely
3. Driver `initialize()` reads from CredentialManager
4. Sets environment variables (e.g., `ANTHROPIC_API_KEY`)
5. Falls back to existing environment variables if no stored credentials

## Data Flow

### Context Flow
```
ProjectContextAnalyzer → ProjectContext
                           ↓
CodebaseIntelligenceService → EnrichedContext
                           ↓
MemoryManager → MemoryContext
                           ↓
LearningExtractor → TaskHistoryContext
                           ↓
SmartContextManager → UnifiedContext → Prompt
```

### Driver Flow
```
Configuration (providers.primary)
         ↓
DriverFactory.getDriver()
         ↓
AiDriver Implementation (Anthropic/OpenAI/Gemini/Agnostic)
         ↓
stream() → DriverEvents
         ↓
ApexOrchestrator processes events
```

## Design Principles

1. **SOLID Compliance**:
   - Single Responsibility: Each driver handles one provider
   - Open/Closed: New providers can be added without modifying existing code
   - Interface Segregation: Clean `AiDriver` interface
   - Dependency Inversion: Factory pattern decouples orchestrator from concrete drivers

2. **Lazy Loading**: Optional dependencies (openai, @google/generative-ai) are dynamically imported

3. **Token Budget Management**: Prevents context overflow with proportional allocation

4. **Graceful Degradation**: Tree-sitter failures don't block startup; reference extraction is optional

5. **Security**: Credentials stored with restrictive file permissions

## Test Coverage

- **SmartContextManager**: 25 tests covering budget calculation, truncation, integration scenarios
- **DriverFactory**: 4 tests covering provider resolution, instance caching, error handling

## Verification Status

| Component | Build | Tests | Status |
|-----------|-------|-------|--------|
| SmartContextManager | ✅ Pass | ✅ 25/25 | Verified |
| Driver Architecture | ✅ Pass | ✅ 4/4 | Verified |
| CredentialManager | ✅ Pass | N/A | Verified (Implementation) |
| Context Enrichment | ✅ Pass | N/A | Verified (Implementation) |
| CodebaseIntelligenceService | ✅ Pass | Partial* | Verified (Implementation) |

*Note: Semantic search tests have fixture data issues (using `filePath` instead of `path`), not implementation bugs.

## Known Issues

1. **Semantic Search Test Fixtures**: Test fixtures use incorrect field names (`filePath` vs `path`). This is a test setup issue, not an implementation bug.

2. **Test Utils Build Errors**: The `@apex/test-utils` package has build errors unrelated to the v0.6.0 features being audited.

## Recommendations

1. Fix semantic search test fixtures to use correct `CodeFile.path` field name
2. Consider adding credential expiration checking in driver initialization
3. Add integration tests for credential flow end-to-end

## References

- SmartContextManager: `packages/orchestrator/src/smart-context-manager.ts`
- Driver Types: `packages/orchestrator/src/drivers/types.ts`
- CredentialManager: `packages/orchestrator/src/auth/credential-manager.ts`
- Context Enrichment: `packages/orchestrator/src/context-enrichment.ts`
- Codebase Intelligence: `packages/orchestrator/src/codebase-intelligence/`
