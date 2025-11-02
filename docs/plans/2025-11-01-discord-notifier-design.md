# Discord Notifier for Claude Code - Design Document

**Date:** 2025-11-01
**Status:** Approved

## Overview

A TypeScript utility that sends Discord notifications for Claude Code hook events, displaying task status and API usage statistics.

## Requirements

### Functional Requirements
- Send Discord notifications when Claude Code requests user input
- Send Discord notifications when Claude Code tasks complete
- Display usage statistics with every notification:
  - Remaining minutes until reset (formatted as "Xh:Ym remaining until reset")
  - Token usage percentage
- Parse hook data to extract:
  - Prompt summary (first 100 characters)
  - Tool names and call counts
  - Execution status (success/failure)
  - Execution time
  - Error messages (if any)
- CLI tool to register/unregister hooks in `~/.claude/settings.json`

### Non-Functional Requirements
- Minimal dependencies (use Node.js built-ins where possible)
- Fire-and-forget pattern (never block Claude Code)
- Fast execution (< 1 second typical)
- Configuration via .env file
- TypeScript for type safety

## Architecture

### Approach: Hook-Specific Entry Points

```
claude-notifier/
├── src/
│   ├── hooks/
│   │   ├── input-requested.ts    # Entry point for user-prompt-submit hook
│   │   └── task-completed.ts     # Entry point for agent-response-end hook
│   ├── lib/
│   │   ├── discord-notifier.ts   # Shared Discord webhook posting
│   │   ├── usage-checker.ts      # Executes ccusage and formats data
│   │   └── types.ts              # TypeScript types/interfaces
│   ├── cli/
│   │   └── register-hooks.ts     # CLI for updating settings.json
├── .env                          # Discord webhook config
├── package.json
└── tsconfig.json
```

### Dependencies
- `tsx` - TypeScript execution runtime
- `dotenv` - Environment variable loading
- Node.js built-ins: `fetch`, `child_process`, `fs`, `path`

## Component Details

### Hook Entry Points

#### input-requested.ts
Triggered by Claude Code `user-prompt-submit` hook.

**Responsibilities:**
1. Read hook data from stdin (JSON)
2. Extract user prompt text and timestamp
3. Get usage statistics via `usageChecker.getUsageStats()`
4. Format "Input Requested" notification
5. Send to Discord via `discordNotifier.send()`

#### task-completed.ts
Triggered by Claude Code `agent-response-end` hook.

**Responsibilities:**
1. Read hook data from stdin (JSON)
2. Extract prompt summary, tool calls, execution time, status, errors
3. Get usage statistics via `usageChecker.getUsageStats()`
4. Format "Task Completed/Failed" notification
5. Send to Discord via `discordNotifier.send()`

### Shared Libraries

#### usage-checker.ts

```typescript
interface UsageStats {
  remainingMinutes: number;      // Raw minutes from ccusage
  formattedTime: string;          // "2h30m remaining until reset"
  tokenPercentageUsed: number;   // 0-100
}

async function getUsageStats(): Promise<UsageStats>
```

**Implementation:**
- Executes: `npx ccusage@latest blocks --json`
- 5 second timeout
- Parses JSON output
- Formats minutes: `Math.floor(minutes/60)}h${minutes%60}m`
- Calculates token percentage from usage data
- Returns null on error (graceful degradation)

#### discord-notifier.ts

```typescript
interface DiscordMessage {
  title: string;
  color: number;           // Hex color code
  fields: Array<{name: string, value: string}>;
  timestamp: string;
}

async function send(message: DiscordMessage): Promise<void>
```

**Implementation:**
- Loads `DISCORD_WEBHOOK` from .env via dotenv
- Creates Discord embed format
- Posts via Node.js `fetch()` API
- 3 second timeout
- Fire-and-forget: logs errors but doesn't throw
- No retries (keep it simple)

#### types.ts

Shared TypeScript interfaces:
- Hook data structure (from Claude Code stdin)
- Usage statistics types
- Discord message types
- Tool call metadata

### CLI Registration Tool

#### register-hooks.ts

**Command:** `npm run register-hooks`

**Behavior:**
1. Locate `~/.claude/settings.json`
2. Read and parse existing settings
3. Get absolute path to project directory (`__dirname`)
4. Add/update hooks configuration:
   ```json
   {
     "hooks": {
       "user-prompt-submit": "npx tsx /absolute/path/src/hooks/input-requested.ts",
       "agent-response-end": "npx tsx /absolute/path/src/hooks/task-completed.ts"
     }
   }
   ```
5. Write back to settings.json
6. Print confirmation

**Safety Features:**
- Create backup: `settings.json.backup`
- Validate JSON before writing
- Warn if hooks already exist (prompt to overwrite)
- Validate `.env` exists before registering
- Graceful error messages

**Additional Command:** `npm run unregister-hooks` to remove hooks

## Configuration

### .env File

```bash
DISCORD_WEBHOOK=https://discord.com/api/webhooks/...
```

Future optional variables:
```bash
# NOTIFICATION_ENABLED=true
# MIN_EXECUTION_TIME_MS=100
```

## Error Handling

### Fire-and-Forget Pattern

Notification failures must never block Claude Code:
- All hook scripts exit with code 0 (success) regardless of errors
- Errors logged to stderr for debugging
- No blocking operations

### Specific Error Cases

| Error | Handling |
|-------|----------|
| `ccusage` fails | Log warning, send notification without usage stats |
| Discord webhook fails | Log error to stderr, continue execution |
| `.env` missing | Log error, exit gracefully (code 0) |
| Invalid JSON from stdin | Log error, exit gracefully |
| Timeout exceeded | Kill child process, continue with partial data |

### Timeouts

- `ccusage` execution: 5 seconds
- Discord webhook POST: 3 seconds

## Discord Message Format

### Input Requested Notification

```
🟡 Input Requested
────────────────
📝 Prompt: "First 100 chars of user prompt..."
⏰ Time: 2:45 PM

📊 Usage Stats:
├─ Tokens: 45% used
└─ Reset: 2h30m remaining until reset
```

**Embed Color:** Yellow (#FFD700)

### Task Completed Notification (Success)

```
🟢 Task Completed
────────────────
📝 Prompt: "First 100 chars..."
🔧 Tools: Read (3), Edit (2), Bash (1)
⚡ Duration: 4.2s
✅ Status: Success

📊 Usage Stats:
├─ Tokens: 47% used
└─ Reset: 2h28m remaining until reset
```

**Embed Color:** Green (#00FF00)

### Task Completed Notification (Failed)

```
🔴 Task Failed
────────────────
📝 Prompt: "First 100 chars..."
🔧 Tools: Read (2), Bash (1)
⚡ Duration: 1.8s
❌ Error: Command failed with exit code 1

📊 Usage Stats:
├─ Tokens: 47% used
└─ Reset: 2h28m remaining until reset
```

**Embed Color:** Red (#FF0000)

## Data Flow

```
Claude Code Hook Triggered
           ↓
Hook Script (input-requested.ts or task-completed.ts)
           ↓
Read stdin (hook data JSON)
           ↓
Parse hook data + Get usage stats (parallel)
           ↓
Format Discord message
           ↓
POST to Discord webhook
           ↓
Exit (code 0)
```

## Testing Strategy

### Manual Testing
1. Register hooks with CLI
2. Trigger Claude Code operations
3. Verify Discord notifications appear
4. Test error cases (invalid webhook, ccusage failure)

### Unit Testing (Future)
- Mock `child_process.exec` for ccusage
- Mock `fetch` for Discord API
- Test message formatting
- Test time formatting logic

## Deployment

### Installation
```bash
npm install
npm run register-hooks
```

### Configuration
1. Copy `.env.example` to `.env`
2. Add Discord webhook URL
3. Run registration command

### Verification
```bash
# Manually test hook scripts
echo '{"prompt":"test"}' | npx tsx src/hooks/input-requested.ts
```

## Future Enhancements

- Toggle notifications on/off via .env
- Filter by minimum execution time
- Support multiple Discord webhooks
- Rich formatting for tool call details
- Notification grouping/batching
