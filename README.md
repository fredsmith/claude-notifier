# Claude Notifier

Discord notifications for Claude Code hook events with usage statistics.

## Features

- 🔔 Discord notifications for Claude Code events
- 📊 Real-time API usage statistics
- ⏱️ Token usage and reset time tracking
- 🎯 Hook-specific notifications (input requested, task completed)
- 🔧 Easy CLI-based setup

## Installation

1. Clone and install dependencies:
```bash
npm install
```

2. Configure Discord webhook:
```bash
cp .env.example .env
# Edit .env and add your Discord webhook URL
```

3. Register hooks with Claude Code:
```bash
npm run register-hooks
```

## Usage

Once registered, the notifier runs automatically when Claude Code:
- Requests user input (`user-prompt-submit` hook)
- Completes a task (`agent-response-end` hook)

### Manual Testing

Test the hooks manually:

```bash
# Test input-requested hook
npm run test:input

# Test task-completed hook
npm run test:task
```

### Unregister Hooks

To remove the hooks from Claude Code:

```bash
npm run unregister-hooks
```

## Configuration

### Environment Variables

Create a `.env` file with:

```
DISCORD_WEBHOOK=https://discord.com/api/webhooks/YOUR_WEBHOOK_HERE
```

### Getting a Discord Webhook

1. Open Discord Server Settings
2. Go to Integrations → Webhooks
3. Create a new webhook
4. Copy the webhook URL
5. Paste into `.env` file

## Notification Format

### Input Requested
```
🟡 Input Requested
────────────────
📝 Prompt: "First 100 chars..."
⏰ Time: 2:45 PM

📊 Usage Stats:
├─ Tokens: 45% used
└─ Reset: 2h30m remaining until reset
```

### Task Completed
```
🟢 Task Completed
────────────────
📝 Prompt: "First 100 chars..."
🔧 Tools: Read (3), Edit (2)
⚡ Duration: 4.2s
✅ Status: Success

📊 Usage Stats:
├─ Tokens: 47% used
└─ Reset: 2h28m remaining until reset
```

## Architecture

```
src/
├── hooks/
│   ├── input-requested.ts    # user-prompt-submit hook
│   └── task-completed.ts     # agent-response-end hook
├── lib/
│   ├── discord-notifier.ts   # Discord webhook client
│   ├── usage-checker.ts      # ccusage integration
│   └── types.ts              # TypeScript types
└── cli/
    └── register-hooks.ts     # Hook registration tool
```

## Troubleshooting

**Notifications not appearing?**
- Check that `.env` contains valid Discord webhook URL
- Verify hooks are registered: `cat ~/.claude/settings.json`
- Test hooks manually with `npm run test:input` and `npm run test:task`

**Usage stats not showing?**
- Ensure `ccusage` is installed: `npx ccusage@latest blocks --json`
- Check that command completes within 5 seconds

## License

MIT
