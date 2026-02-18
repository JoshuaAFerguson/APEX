# ADR: Approval API Endpoints

## Status
Proposed

## Context

APEX v0.5.0 introduced an approval workflow system (`ApprovalState`) stored in the `approval_states` table. The system tracks approval requests for gates that require human approval before task execution can proceed.

### Existing Infrastructure

1. **Database Layer** (`packages/orchestrator/src/store.ts`):
   - `approval_states` table with full schema (id, task_id, gate_name, status, approver, timestamps, etc.)
   - `saveApprovalState(state: ApprovalState)` - Create/update approval records
   - `getApprovalState(taskId, approvalId?)` - Get approval by task or ID
   - `getPendingApprovals()` - List all pending approvals

2. **Orchestrator Layer** (`packages/orchestrator/src/index.ts`):
   - `grantApproval(approvalId, approver, comment?)` - Approve and resume task
   - `denyApproval(approvalId, approver, reason)` - Deny and fail task
   - Events: `approval-required`, `approval-granted`, `approval-denied`

3. **Type Definitions** (`packages/core/src/types.ts`):
   - `ApprovalState` - Full approval state with all fields
   - `ApprovalStatus` - 'pending' | 'approved' | 'denied'
   - `ApprovalDecisionRequest` / `ApprovalDecisionResponse` - API request/response types

### Current Gap

While the backend infrastructure exists, there are **no REST API endpoints** for:
- Listing pending approvals (`GET /api/approvals`)
- Approving a pending request (`POST /api/approvals/:id/approve`)
- Denying a pending request (`POST /api/approvals/:id/deny`)

### Task Requirements

The acceptance criteria are:
1. `GET /api/approvals` returns list of pending approvals
2. `POST /api/approvals/:id/approve` endpoint exists and updates approval state
3. `POST /api/approvals/:id/deny` endpoint exists and updates approval state

## Decision

### API Design

Create three new endpoints in `packages/api/src/index.ts` under a new "Approvals API" section:

#### 1. GET /api/approvals

List all pending approvals across all tasks.

```typescript
// Response
interface ListApprovalsResponse {
  approvals: ApprovalState[];
  count: number;
}

// Example response
{
  "approvals": [
    {
      "id": "approval-task123-pre-deploy-1704207600000",
      "taskId": "task123",
      "gateName": "pre-deploy",
      "status": "pending",
      "requestedAt": "2024-01-02T12:00:00.000Z",
      "stage": "deploy",
      "agent": "devops",
      "approvalsReceived": 0,
      "approvalsRequired": 1,
      "context": { "environment": "production" }
    }
  ],
  "count": 1
}
```

#### 2. POST /api/approvals/:id/approve

Approve a pending approval request.

```typescript
// Request body
interface ApproveRequest {
  approver?: string;   // Who is approving (defaults to 'anonymous')
  comment?: string;    // Optional approval comment
}

// Response
interface ApproveResponse {
  ok: boolean;
  approvalId: string;
  taskId: string;
  message: string;
}

// Example
POST /api/approvals/approval-task123-pre-deploy-1704207600000/approve
Body: { "approver": "admin@example.com", "comment": "Approved for release" }

Response:
{
  "ok": true,
  "approvalId": "approval-task123-pre-deploy-1704207600000",
  "taskId": "task123",
  "message": "Approval granted, task will resume"
}
```

#### 3. POST /api/approvals/:id/deny

Deny a pending approval request.

```typescript
// Request body
interface DenyRequest {
  approver?: string;   // Who is denying (defaults to 'anonymous')
  reason: string;      // Required: reason for denial
}

// Response
interface DenyResponse {
  ok: boolean;
  approvalId: string;
  taskId: string;
  message: string;
}

// Example
POST /api/approvals/approval-task123-pre-deploy-1704207600000/deny
Body: { "approver": "admin@example.com", "reason": "Not ready for production" }

Response:
{
  "ok": true,
  "approvalId": "approval-task123-pre-deploy-1704207600000",
  "taskId": "task123",
  "message": "Approval denied, task marked as failed"
}
```

### Error Handling

| Status | Condition | Response |
|--------|-----------|----------|
| 400 | Missing required reason on deny | `{ "error": "Reason is required when denying an approval" }` |
| 404 | Approval ID not found | `{ "error": "Approval not found" }` |
| 409 | Approval already responded | `{ "error": "Approval has already been responded to" }` |
| 500 | Internal error | `{ "error": "<error message>" }` |

### Implementation Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        API Layer                                 │
│                   packages/api/src/index.ts                      │
├─────────────────────────────────────────────────────────────────┤
│  GET /api/approvals                                              │
│    └── orchestrator.getPendingApprovals()                        │
│                                                                  │
│  POST /api/approvals/:id/approve                                 │
│    └── orchestrator.grantApproval(id, approver, comment)         │
│    └── broadcast('approval:granted', event)                      │
│                                                                  │
│  POST /api/approvals/:id/deny                                    │
│    └── orchestrator.denyApproval(id, approver, reason)           │
│    └── broadcast('approval:denied', event)                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Orchestrator Layer                            │
│               packages/orchestrator/src/index.ts                 │
├─────────────────────────────────────────────────────────────────┤
│  getPendingApprovals(): Promise<ApprovalState[]>                 │
│    └── NEW: Expose store.getPendingApprovals()                   │
│                                                                  │
│  grantApproval(id, approver, comment)                            │
│    └── Already exists ✓                                          │
│                                                                  │
│  denyApproval(id, approver, reason)                              │
│    └── Already exists ✓                                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Store Layer                                │
│               packages/orchestrator/src/store.ts                 │
├─────────────────────────────────────────────────────────────────┤
│  getPendingApprovals(): Promise<ApprovalState[]>                 │
│    └── Already exists ✓                                          │
│                                                                  │
│  saveApprovalState(state): Promise<void>                         │
│    └── Already exists ✓                                          │
│                                                                  │
│  getApprovalState(taskId, approvalId?): Promise<ApprovalState>   │
│    └── Already exists ✓                                          │
└─────────────────────────────────────────────────────────────────┘
```

### Changes Required

#### 1. Orchestrator (`packages/orchestrator/src/index.ts`)

Add a new public method to expose pending approvals:

```typescript
/**
 * Get all pending approval requests
 * @returns List of pending approval states
 */
async getPendingApprovals(): Promise<ApprovalState[]> {
  await this.ensureInitialized();
  return this.store.getPendingApprovals();
}

/**
 * Get an approval by ID
 * @param approvalId The approval ID to look up
 * @returns The approval state or null if not found
 */
async getApprovalById(approvalId: string): Promise<ApprovalState | null> {
  await this.ensureInitialized();

  // Parse taskId from approvalId format: approval-{taskId}-{gateName}-{timestamp}
  const parts = approvalId.split('-');
  if (parts.length < 3 || parts[0] !== 'approval') {
    return null;
  }

  const taskId = parts[1];
  return this.store.getApprovalState(taskId, approvalId);
}
```

#### 2. API Server (`packages/api/src/index.ts`)

Add the Approvals API section with three endpoints:

```typescript
// ============================================================================
// Approvals API
// ============================================================================

// List all pending approvals
app.get('/api/approvals', async (request, reply) => {
  try {
    const approvals = await orchestrator.getPendingApprovals();
    return { approvals, count: approvals.length };
  } catch (error) {
    return reply.status(500).send({
      error: error instanceof Error ? error.message : 'Failed to list approvals'
    });
  }
});

// Approve a pending approval
app.post<{ Params: { id: string }; Body: { approver?: string; comment?: string } }>(
  '/api/approvals/:id/approve',
  async (request, reply) => {
    const { id } = request.params;
    const { approver = 'anonymous', comment } = request.body;

    try {
      // Validate approval exists and is pending
      const approval = await orchestrator.getApprovalById(id);
      if (!approval) {
        return reply.status(404).send({ error: 'Approval not found' });
      }
      if (approval.status !== 'pending') {
        return reply.status(409).send({ error: 'Approval has already been responded to' });
      }

      await orchestrator.grantApproval(id, approver, comment);

      // Broadcast approval event
      broadcast(approval.taskId, {
        type: 'approval:granted',
        taskId: approval.taskId,
        timestamp: new Date(),
        data: { approvalId: id, approver, comment },
      });

      return {
        ok: true,
        approvalId: id,
        taskId: approval.taskId,
        message: 'Approval granted, task will resume'
      };
    } catch (error) {
      return reply.status(500).send({
        error: error instanceof Error ? error.message : 'Failed to approve'
      });
    }
  }
);

// Deny a pending approval
app.post<{ Params: { id: string }; Body: { approver?: string; reason: string } }>(
  '/api/approvals/:id/deny',
  async (request, reply) => {
    const { id } = request.params;
    const { approver = 'anonymous', reason } = request.body;

    if (!reason || reason.trim().length === 0) {
      return reply.status(400).send({ error: 'Reason is required when denying an approval' });
    }

    try {
      // Validate approval exists and is pending
      const approval = await orchestrator.getApprovalById(id);
      if (!approval) {
        return reply.status(404).send({ error: 'Approval not found' });
      }
      if (approval.status !== 'pending') {
        return reply.status(409).send({ error: 'Approval has already been responded to' });
      }

      await orchestrator.denyApproval(id, approver, reason);

      // Broadcast denial event
      broadcast(approval.taskId, {
        type: 'approval:denied',
        taskId: approval.taskId,
        timestamp: new Date(),
        data: { approvalId: id, approver, reason },
      });

      return {
        ok: true,
        approvalId: id,
        taskId: approval.taskId,
        message: 'Approval denied, task marked as failed'
      };
    } catch (error) {
      return reply.status(500).send({
        error: error instanceof Error ? error.message : 'Failed to deny approval'
      });
    }
  }
);
```

#### 3. Mock Orchestrator for Tests (`packages/api/src/index.test.ts`)

Add mock approval methods:

```typescript
// Approval management methods
private approvals: Map<string, ApprovalState> = new Map();

async getPendingApprovals() {
  return Array.from(this.approvals.values()).filter(a => a.status === 'pending');
}

async getApprovalById(approvalId: string) {
  return this.approvals.get(approvalId) || null;
}

async grantApproval(approvalId: string, approver: string, comment?: string) {
  const approval = this.approvals.get(approvalId);
  if (!approval) throw new Error('Approval not found');
  approval.status = 'approved';
  approval.approver = approver;
  approval.comment = comment;
  approval.respondedAt = new Date();
}

async denyApproval(approvalId: string, approver: string, reason: string) {
  const approval = this.approvals.get(approvalId);
  if (!approval) throw new Error('Approval not found');
  approval.status = 'denied';
  approval.approver = approver;
  approval.comment = reason;
  approval.respondedAt = new Date();
}
```

### WebSocket Events

The existing event system already supports:
- `approval-required` - Emitted when approval is needed
- `approval-granted` - Emitted when approved (enhanced with broadcast)
- `approval-denied` - Emitted when denied (enhanced with broadcast)

The API will broadcast these events to WebSocket clients for real-time updates.

### OpenAPI Specification Updates

Update `docs/openapi.yaml` with the new endpoints:

```yaml
paths:
  /api/approvals:
    get:
      summary: List pending approvals
      tags: [Approvals]
      responses:
        200:
          description: List of pending approvals
          content:
            application/json:
              schema:
                type: object
                properties:
                  approvals:
                    type: array
                    items:
                      $ref: '#/components/schemas/ApprovalState'
                  count:
                    type: integer

  /api/approvals/{id}/approve:
    post:
      summary: Approve a pending approval
      tags: [Approvals]
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                approver:
                  type: string
                comment:
                  type: string
      responses:
        200:
          description: Approval granted
        404:
          description: Approval not found
        409:
          description: Already responded

  /api/approvals/{id}/deny:
    post:
      summary: Deny a pending approval
      tags: [Approvals]
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [reason]
              properties:
                approver:
                  type: string
                reason:
                  type: string
      responses:
        200:
          description: Approval denied
        400:
          description: Reason required
        404:
          description: Approval not found
        409:
          description: Already responded
```

## Consequences

### Positive

1. **Complete Approval Workflow** - Users can now interact with approvals via REST API
2. **Consistent API Design** - Follows existing patterns (gates, tasks, templates)
3. **Minimal Changes** - Leverages existing store and orchestrator methods
4. **Real-time Updates** - WebSocket broadcasting keeps clients synchronized

### Negative

1. **Approval ID Parsing** - The `approvalId` format coupling between orchestrator and API
2. **No Pagination** - `GET /api/approvals` returns all pending (acceptable for typical use cases)

### Neutral

1. **Testing Required** - New unit and integration tests needed
2. **Documentation Updates** - OpenAPI spec and CLI help need updates

## Implementation Order

1. Add `getPendingApprovals()` and `getApprovalById()` to orchestrator
2. Add three API endpoints to `packages/api/src/index.ts`
3. Update mock orchestrator in tests
4. Add unit tests for new endpoints
5. Run `npm run build` and `npm run test` to verify
6. Update OpenAPI specification

## Related

- `packages/orchestrator/src/store.ts` - ApprovalState storage
- `packages/core/src/types.ts` - ApprovalState type definitions
- `packages/api/src/index.ts` - Existing API patterns (gates, tasks)
- ADR-v050-approval-workflow (if exists) - Original approval design
