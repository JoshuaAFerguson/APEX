# Slack Integration

APEX supports a Socket Mode Slack app for task management via `/apex` commands.
This setup targets a single workspace for now; multi-workspace can be added later.

## Quick start

1. Create a Slack app at https://api.slack.com/apps.
2. Use the manifest in `docs/slack-app-manifest.yaml` (recommended).
3. Enable **Socket Mode** and generate an App-Level Token with the `connections:write` scope.
4. Install the app to your workspace and copy the Bot Token.
5. Add the configuration below and set environment variables.

## Configuration

```yaml
# .apex/config.yaml
slack:
  enabled: true
  mode: socket
  defaultChannel: "#apex"
  notificationChannels:
    - "#apex"
  threadUpdates: true
  useBlocks: true
```

Environment variables (recommended for secrets):

```bash
export SLACK_APP_TOKEN="xapp-..."
export SLACK_BOT_TOKEN="xoxb-..."
export SLACK_DEFAULT_CHANNEL="#apex"
export SLACK_NOTIFICATION_CHANNELS="#apex,#ops"
export SLACK_THREAD_UPDATES="true"
export SLACK_USE_BLOCKS="true"
```

## Commands

- `/apex run "task description"`
- `/apex think "idea"`
- `/apex status`
- `/apex report <taskId>`
- `/apex cancel <taskId>`

You can override the response channel:

```
/apex status --channel #apex
/apex report 123 --channel=C012ABCDEF
```

## Notes

- The bot must be invited to target channels unless you grant `chat:write.public`.
- The slash command URL is unused in Socket Mode; keep the placeholder unless you need interactive HTTP workflows.
- Socket Mode avoids public request URLs and is best for local or remote development.
