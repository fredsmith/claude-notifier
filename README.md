# Claude Notifier

Discord notifications for Claude Code hook events with accurate usage statistics.

## Features

- 🔔 Discord notifications for Claude Code events
- 📊 Real-time session usage statistics via tmux scraping
- ⏱️ Accurate token usage percentage and reset time
- 🎯 Hook-specific notifications (input requested, task completed)
- 🔧 Easy CLI-based setup
- 📝 Automatic transcript parsing for prompt, tools, and duration

## Prerequisites

- Node.js (for running the hooks)
- `tmux` (for scraping usage statistics from Claude Code's `/usage` dialog)
- Discord webhook URL

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

3. Build the TypeScript files:
```bash
npm run build
```

4. Register hooks with Claude Code:
```bash
npm run register-hooks
```

## Usage

Once registered, the notifier runs automatically when Claude Code:
- Requests user input (`UserPromptSubmit` hook)
- Stops/completes a task (`Stop` hook)

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
├─ 45% used
└─ Resets 3pm (America/New_York)
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
├─ 47% used
└─ Resets 3pm (America/New_York)
```

## How It Works

### Usage Statistics Collection

The notifier uses a tmux-based approach to gather accurate usage statistics:

1. **Detached tmux session**: Creates a background tmux session running `claude`
2. **Automated `/usage` command**: Sends `/usage` command to trigger the dialog
3. **Screen scraping**: Captures the dialog output showing percentage and reset time
4. **Parsing**: Extracts "X% used" and "Resets Xpm (Timezone)" from the dialog
5. **Cleanup**: Automatically terminates the tmux session after capturing data

This approach provides accurate real-time usage data directly from Claude Code's official `/usage` command.

### Transcript Parsing

The `Stop` hook receives a transcript path instead of direct prompt/tool data:

1. **JSONL transcript**: Reads the session transcript file
2. **Last message extraction**: Finds the most recent user message
3. **Tool collection**: Gathers all tools used in response to that message
4. **Duration calculation**: Computes time from user message to completion

## Architecture

```
src/
├── hooks/
│   ├── input-requested.ts       # UserPromptSubmit hook handler
│   └── task-completed.ts        # Stop hook handler
├── lib/
│   ├── discord-notifier.ts      # Discord webhook client
│   ├── tmux-usage-scraper.ts    # tmux-based usage collector
│   ├── transcript-parser.ts     # JSONL transcript parser
│   ├── usage-checker.ts         # Re-exports tmux scraper
│   └── types.ts                 # TypeScript interfaces
└── cli/
    └── register-hooks.ts        # Hook registration CLI
```

## Troubleshooting

**Notifications not appearing?**
- Check that `.env` contains valid Discord webhook URL
- Verify hooks are registered: `cat ~/.claude/settings.json`
- Test hooks manually with `npm run test:input` and `npm run test:task`
- Ensure TypeScript is compiled: `npm run build`

**Usage stats showing 0% or not appearing?**
- Ensure `tmux` is installed: `which tmux`
- Test tmux manually: `tmux new-session -d -s test claude`
- Check tmux session creation: `tmux list-sessions`
- The scraper takes ~10-15 seconds to run (creates session, waits for dialog, captures output)

**Prompt/tools showing as "Unknown" or "None"?**
- Verify the transcript file exists at the path in the hook data
- Check file permissions on `~/.claude/projects/` directory
- Ensure the Stop hook is receiving valid `transcript_path`

## License

MIT
