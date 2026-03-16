# ADR-0020: Microsoft Teams Integration Architecture

## Status
Proposed

## Date
2026-03-15

## Context

APEX requires a Microsoft Teams integration for task management via Teams commands, following the same architectural patterns established by the Slack integration. This integration should enable:
- Task creation and management via Teams bot commands
- Real-time task status notifications using Adaptive Cards
- SSO authentication via Microsoft Entra ID
- Messaging extension for quick task actions

### Existing Infrastructure

The codebase has mature integration patterns from the Slack implementation:

1. **`SlackService`** (`packages/api/src/services/slack-service.ts`)
   - Socket Mode for real-time events
   - Command parsing with `parseSlackCommandText()`
   - Block Kit for rich message formatting
   - Task thread management for updates

2. **`SlackIntegrationConfigSchema`** (`packages/core/src/types.ts`)
   - Zod schema for configuration validation
   - Environment variable resolution pattern

3. **API Server Integration** (`packages/api/src/index.ts`)
   - Service initialization pattern
   - Orchestrator event subscription
   - Lifecycle management (start/stop)

4. **Documentation Pattern**
   - `docs/slack-integration.md` - User guide
   - `docs/slack-app-manifest.yaml` - App configuration

### Microsoft Teams SDK Landscape (2025)

Based on current Microsoft guidance:
- **Bot Framework SDK v4** - Stable but entering retirement (December 2025)
- **Microsoft 365 Agents SDK** - Recommended successor for multi-channel bots
- **Teams AI v2** - For Teams-only applications
- **Adaptive Cards v1.5** - Rich card format (Teams mobile supports up to v1.2)

**Decision**: Use **botbuilder v4** packages for initial implementation due to:
1. Production-ready stability
2. Extensive documentation and samples
3. Clear migration path to Agents SDK
4. Consistent with current industry adoption

## Decision

### Component Architecture

Create a **TeamsService** following the established service pattern:

```
packages/
├── api/
│   └── src/
│       └── services/
│           ├── teams-service.ts              # Main Teams integration service
│           └── __tests__/
│               ├── teams-service.test.ts     # Unit tests
│               └── teams-command-parsing.test.ts
├── core/
│   └── src/
│       └── types.ts                          # Add TeamsIntegrationConfigSchema
└── docs/
    ├── teams-integration.md                  # User documentation
    └── teams-app-manifest.json               # Teams app manifest
```

### Type Definitions

```typescript
// packages/core/src/types.ts - Addition

/**
 * Microsoft Teams integration configuration (v0.7.0)
 */
export const TeamsIntegrationConfigSchema = z.object({
  /** Enable Teams integration */
  enabled: z.boolean().optional().default(false),

  /** Microsoft App ID from Azure Bot registration */
  appId: z.string().optional(),

  /** Microsoft App Password (client secret) */
  appPassword: z.string().optional(),

  /** Tenant ID for single-tenant apps (use 'common' for multi-tenant) */
  tenantId: z.string().optional().default('common'),

  /** OAuth connection name configured in Azure Bot Service */
  oauthConnectionName: z.string().optional(),

  /** Default Team ID for notifications (optional) */
  defaultTeamId: z.string().optional(),

  /** Default Channel ID for notifications (optional) */
  defaultChannelId: z.string().optional(),

  /** Use Adaptive Cards for responses (v1.5 schema) */
  useAdaptiveCards: z.boolean().optional().default(true),

  /** Enable thread/reply updates for task progress */
  threadUpdates: z.boolean().optional().default(true),

  /** Service URL override for local development */
  serviceUrl: z.string().optional(),
});
export type TeamsIntegrationConfig = z.infer<typeof TeamsIntegrationConfigSchema>;

// Add to ApexConfigSchema
{
  // ...existing config...
  teams: TeamsIntegrationConfigSchema.optional(),
}
```

### Service Design

#### 1. TeamsService Class

```typescript
// packages/api/src/services/teams-service.ts

import {
  CloudAdapter,
  ConfigurationBotFrameworkAuthentication,
  TurnContext,
  ActivityTypes,
  TeamsInfo,
  MessageFactory,
  CardFactory,
} from 'botbuilder';
import type { TeamsIntegrationConfig, Task } from '@apexcli/core';
import type { ApexOrchestrator } from '@apexcli/orchestrator';

export interface TeamsCommandContext {
  /** Conversation ID where command was invoked */
  conversationId: string;
  /** User who invoked the command */
  userId: string;
  /** User's display name */
  userName?: string;
  /** Team ID (if in a team) */
  teamId?: string;
  /** Channel ID (if in a channel) */
  channelId?: string;
  /** The command text */
  text: string;
  /** Activity ID for threading */
  activityId?: string;
  /** Service URL for sending responses */
  serviceUrl: string;
}

export interface TeamsCommandParseResult {
  /** The command name (e.g., 'run', 'status') */
  command: string;
  /** Arguments provided with the command */
  args: string;
  /** Mentioned users (for assignment) */
  mentions?: string[];
}

export interface TeamsServiceOptions {
  /** APEX orchestrator instance */
  orchestrator: ApexOrchestrator;
  /** Teams configuration (optional, resolved from env) */
  config?: TeamsIntegrationConfig;
  /** Environment variables */
  env?: NodeJS.ProcessEnv;
  /** Logger interface */
  logger?: {
    info: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
  };
}

export class TeamsService {
  private orchestrator: ApexOrchestrator;
  private config: TeamsIntegrationConfig;
  private env: NodeJS.ProcessEnv;
  private logger;
  private adapter?: CloudAdapter;
  private taskConversations = new Map<string, TeamsConversationReference>();

  constructor(options: TeamsServiceOptions) { /* ... */ }

  isEnabled(): boolean { /* ... */ }
  async start(): Promise<void> { /* ... */ }
  async stop(): Promise<void> { /* ... */ }

  // Bot Framework adapter getter for HTTP endpoint
  getAdapter(): CloudAdapter | undefined { /* ... */ }

  // Process incoming activities
  async processActivity(req: any, res: any): Promise<void> { /* ... */ }
}
```

#### 2. Command Parsing

```typescript
export function parseTeamsCommandText(text: string): TeamsCommandParseResult {
  // Remove @mention of the bot from the beginning
  const cleaned = text.replace(/^<at>.*?<\/at>\s*/i, '').trim();

  if (!cleaned) {
    return { command: 'help', args: '' };
  }

  // Extract mentions for task assignment
  const mentionMatches = cleaned.matchAll(/<at>([^<]+)<\/at>/g);
  const mentions = Array.from(mentionMatches, m => m[1]);

  // Remove remaining mentions and parse command
  const withoutMentions = cleaned.replace(/<at>.*?<\/at>/g, '').trim();
  const [command, ...rest] = withoutMentions.split(/\s+/);

  return {
    command: command.toLowerCase(),
    args: rest.join(' ').trim(),
    mentions: mentions.length > 0 ? mentions : undefined,
  };
}
```

### Adaptive Cards Design

#### 1. Task Created Card

```typescript
private buildTaskCreatedCard(task: Task, requestedBy: string): any {
  return CardFactory.adaptiveCard({
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    type: 'AdaptiveCard',
    version: '1.5',
    body: [
      {
        type: 'TextBlock',
        size: 'Large',
        weight: 'Bolder',
        text: 'Task Created',
        color: 'Good',
      },
      {
        type: 'FactSet',
        facts: [
          { title: 'ID', value: task.id },
          { title: 'Status', value: task.status },
          { title: 'Workflow', value: task.workflow },
          { title: 'Priority', value: task.priority },
        ],
      },
      {
        type: 'TextBlock',
        text: task.description,
        wrap: true,
      },
    ],
    actions: [
      {
        type: 'Action.Submit',
        title: 'View Status',
        data: { action: 'status', taskId: task.id },
      },
      {
        type: 'Action.Submit',
        title: 'Cancel',
        data: { action: 'cancel', taskId: task.id },
        style: 'destructive',
      },
    ],
  });
}
```

#### 2. Status Card

```typescript
private buildStatusCard(
  active: Task[],
  pending: Task[],
  paused: Task[]
): any {
  return CardFactory.adaptiveCard({
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    type: 'AdaptiveCard',
    version: '1.5',
    body: [
      {
        type: 'TextBlock',
        size: 'Large',
        weight: 'Bolder',
        text: 'APEX Task Status',
      },
      // In Progress section
      {
        type: 'TextBlock',
        weight: 'Bolder',
        text: `In Progress (${active.length})`,
        color: 'Good',
      },
      ...this.buildTaskListItems(active),
      // Pending section
      {
        type: 'TextBlock',
        weight: 'Bolder',
        text: `Pending (${pending.length})`,
        color: 'Warning',
      },
      ...this.buildTaskListItems(pending),
      // Paused section
      {
        type: 'TextBlock',
        weight: 'Bolder',
        text: `Paused (${paused.length})`,
        color: 'Attention',
      },
      ...this.buildTaskListItems(paused),
    ],
  });
}
```

### OAuth/SSO Flow

```typescript
// OAuth configuration for Teams SSO

private async handleSignIn(context: TurnContext): Promise<void> {
  // Use OAuthPrompt for Teams SSO
  const tokenResponse = await this.adapter?.getUserToken(
    context,
    this.config.oauthConnectionName!,
    ''
  );

  if (tokenResponse?.token) {
    // User is authenticated
    await context.sendActivity('You are signed in!');
  } else {
    // Initiate sign-in flow
    const signInLink = await this.adapter?.getSignInLink(
      context,
      this.config.oauthConnectionName!
    );

    await context.sendActivity(
      MessageFactory.attachment(
        CardFactory.oauthCard(
          this.config.oauthConnectionName!,
          'Sign in to APEX',
          'Sign in to manage your tasks'
        )
      )
    );
  }
}

// Handle token exchange for SSO
private async handleTokenExchange(context: TurnContext): Promise<void> {
  const tokenExchangeRequest = context.activity.value;

  try {
    await this.adapter?.exchangeToken(
      context,
      this.config.oauthConnectionName!,
      context.activity.from.id,
      { token: tokenExchangeRequest.token }
    );
  } catch (error) {
    // Token exchange failed, fall back to sign-in
    await context.sendActivity('Sign-in required. Please sign in.');
  }
}
```

### Messaging Extension

```typescript
// packages/api/src/services/teams-messaging-extension.ts

export interface MessagingExtensionHandler {
  handleQuery(context: TurnContext, query: any): Promise<any>;
  handleAction(context: TurnContext, action: any): Promise<any>;
  handleCardAction(context: TurnContext, cardData: any): Promise<any>;
}

export class TeamsMessagingExtension implements MessagingExtensionHandler {
  constructor(private orchestrator: ApexOrchestrator) {}

  async handleQuery(context: TurnContext, query: any): Promise<any> {
    const searchText = query.parameters?.[0]?.value || '';
    const tasks = await this.orchestrator.searchTasks(searchText);

    return {
      composeExtension: {
        type: 'result',
        attachmentLayout: 'list',
        attachments: tasks.map(task => this.buildTaskPreviewCard(task)),
      },
    };
  }

  async handleAction(context: TurnContext, action: any): Promise<any> {
    switch (action.commandId) {
      case 'createTask':
        return this.handleCreateTaskAction(context, action.data);
      case 'viewTask':
        return this.handleViewTaskAction(context, action.data);
      default:
        return null;
    }
  }

  async handleCardAction(context: TurnContext, cardData: any): Promise<any> {
    switch (cardData.action) {
      case 'status':
        return this.handleStatusAction(context, cardData.taskId);
      case 'cancel':
        return this.handleCancelAction(context, cardData.taskId);
      default:
        return null;
    }
  }
}
```

### Teams App Manifest

```json
// docs/teams-app-manifest.json
{
  "$schema": "https://developer.microsoft.com/en-us/json-schemas/teams/v1.16/MicrosoftTeams.schema.json",
  "manifestVersion": "1.16",
  "version": "0.7.0",
  "id": "{{MICROSOFT_APP_ID}}",
  "developer": {
    "name": "APEX",
    "websiteUrl": "https://github.com/your-org/apex",
    "privacyUrl": "https://github.com/your-org/apex/blob/main/PRIVACY.md",
    "termsOfUseUrl": "https://github.com/your-org/apex/blob/main/TERMS.md"
  },
  "name": {
    "short": "APEX",
    "full": "APEX Task Orchestration"
  },
  "description": {
    "short": "AI-powered task orchestration for development teams",
    "full": "APEX enables AI-powered task management and automation directly from Microsoft Teams. Create tasks, track progress, and receive real-time notifications."
  },
  "icons": {
    "outline": "outline.png",
    "color": "color.png"
  },
  "accentColor": "#0D0F12",
  "bots": [
    {
      "botId": "{{MICROSOFT_APP_ID}}",
      "scopes": ["personal", "team", "groupChat"],
      "supportsFiles": false,
      "isNotificationOnly": false,
      "commandLists": [
        {
          "scopes": ["personal", "team", "groupChat"],
          "commands": [
            {
              "title": "run",
              "description": "Create and start a new task"
            },
            {
              "title": "think",
              "description": "Capture an idea or thought"
            },
            {
              "title": "status",
              "description": "View current task status"
            },
            {
              "title": "report",
              "description": "Get detailed task report"
            },
            {
              "title": "cancel",
              "description": "Cancel a running task"
            },
            {
              "title": "help",
              "description": "Show available commands"
            }
          ]
        }
      ]
    }
  ],
  "composeExtensions": [
    {
      "botId": "{{MICROSOFT_APP_ID}}",
      "commands": [
        {
          "id": "searchTasks",
          "type": "query",
          "title": "Search Tasks",
          "description": "Search for APEX tasks",
          "initialRun": true,
          "parameters": [
            {
              "name": "searchQuery",
              "title": "Search",
              "description": "Search for tasks by description or ID"
            }
          ]
        },
        {
          "id": "createTask",
          "type": "action",
          "title": "Create Task",
          "description": "Create a new APEX task",
          "fetchTask": true
        }
      ]
    }
  ],
  "permissions": [
    "identity",
    "messageTeamMembers"
  ],
  "validDomains": [
    "token.botframework.com",
    "*.botframework.com"
  ],
  "webApplicationInfo": {
    "id": "{{MICROSOFT_APP_ID}}",
    "resource": "api://{{DOMAIN}}/{{MICROSOFT_APP_ID}}"
  }
}
```

### API Server Integration

```typescript
// packages/api/src/index.ts - Additions

import { TeamsService } from './services/teams-service.js';

// In createServer function:
const teamsService = new TeamsService({ orchestrator, config: config.teams, logger: app.log });
try {
  await teamsService.start();
} catch (error) {
  app.log.error(`Teams integration failed to start: ${error instanceof Error ? error.message : error}`);
}

// Register Teams messaging endpoint (Bot Framework requires POST /api/messages)
app.post('/api/messages', async (request, reply) => {
  if (!teamsService.isEnabled()) {
    return reply.status(503).send({ error: 'Teams integration not configured' });
  }

  await teamsService.processActivity(request.raw, reply.raw);
});
```

### Environment Variables

```bash
# Microsoft Teams Integration
TEAMS_APP_ID="your-microsoft-app-id"
TEAMS_APP_PASSWORD="your-microsoft-app-password"
TEAMS_TENANT_ID="common"  # or specific tenant ID
TEAMS_OAUTH_CONNECTION_NAME="APEX-OAuth"
TEAMS_DEFAULT_TEAM_ID=""
TEAMS_DEFAULT_CHANNEL_ID=""
TEAMS_SERVICE_URL=""  # For local dev with ngrok
```

## Implementation Plan

### Phase 1: Core Types and Configuration (0.5 days)
1. Add `TeamsIntegrationConfigSchema` to `packages/core/src/types.ts`
2. Add `teams` property to `ApexConfigSchema`
3. Update type exports

### Phase 2: Service Implementation (1.5 days)
1. Create `packages/api/src/services/teams-service.ts`
2. Implement command parsing with `parseTeamsCommandText()`
3. Implement Adaptive Card builders
4. Wire up orchestrator event handlers

### Phase 3: Messaging Extension (0.5 days)
1. Create `packages/api/src/services/teams-messaging-extension.ts`
2. Implement search and action handlers
3. Build preview cards for task list

### Phase 4: OAuth/SSO (0.5 days)
1. Implement token exchange handling
2. Add OAuth card for sign-in prompt
3. Test with Azure Bot Service OAuth connection

### Phase 5: API Integration (0.5 days)
1. Register `/api/messages` endpoint in API server
2. Initialize TeamsService in server startup
3. Add lifecycle management (start/stop)

### Phase 6: Documentation & Testing (1 day)
1. Create `docs/teams-integration.md`
2. Create `docs/teams-app-manifest.json`
3. Write unit tests for command parsing
4. Write integration tests for card builders
5. Document Azure Bot Service setup

## Dependencies

New npm packages required in `packages/api/package.json`:

```json
{
  "dependencies": {
    "botbuilder": "^4.24.0",
    "adaptivecards": "^3.0.4"
  }
}
```

## Consequences

### Positive
- Consistent architecture with Slack integration
- Rich UI via Adaptive Cards
- SSO improves user experience
- Messaging extension enables quick actions
- Follows Microsoft's recommended patterns

### Negative
- Bot Framework SDK entering retirement (migration to Agents SDK needed by late 2025)
- More complex OAuth flow than Slack
- Requires Azure Bot Service registration
- Teams mobile has Adaptive Cards v1.2 limit

### Risks
- Bot Framework SDK retirement timeline may accelerate
- Multi-tenant bot registration restrictions (July 2025)
- Service URL complexities for local development

### Migration Path
When Bot Framework SDK is fully retired:
1. Migrate to Microsoft 365 Agents SDK
2. Update CloudAdapter to AgentsAdapter
3. Adjust authentication to new patterns
4. The core service architecture remains unchanged

## Alternatives Considered

### 1. Microsoft 365 Agents SDK (New)
**Rejected for initial implementation** because:
- Still maturing as of March 2025
- Less community documentation
- Migration path from Bot Framework is clear

**Will revisit** when Bot Framework retirement is closer.

### 2. Teams AI v2
**Rejected** because:
- Focused on AI/LLM integrations, not task orchestration
- Overkill for command-based interactions
- Less flexible for custom business logic

### 3. Power Automate / Power Platform
**Rejected** because:
- Requires separate licensing
- Less developer control
- Doesn't integrate with existing codebase patterns

## References

### Microsoft Documentation
- [Bot Framework SDK for Node.js](https://github.com/microsoft/botframework-sdk)
- [Teams Bot Authentication](https://learn.microsoft.com/en-us/microsoftteams/platform/bots/how-to/authentication/add-authentication)
- [Teams SSO for Bots](https://learn.microsoft.com/en-us/microsoftteams/platform/bots/how-to/authentication/bot-sso-overview)
- [Adaptive Cards Schema](https://adaptivecards.io/)
- [Microsoft 365 Agents SDK](https://github.com/microsoft/teams-sdk)

### Existing Codebase
- `packages/api/src/services/slack-service.ts` - Reference implementation
- `packages/core/src/types.ts` - Configuration schema patterns
- `packages/api/src/index.ts` - Service integration patterns
- `docs/slack-integration.md` - Documentation patterns
- `docs/slack-app-manifest.yaml` - Manifest patterns
