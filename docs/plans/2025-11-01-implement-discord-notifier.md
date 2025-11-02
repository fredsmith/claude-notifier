# Discord Notifier Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a TypeScript utility that sends Discord notifications for Claude Code hook events with usage statistics.

**Architecture:** Hook-specific entry points (input-requested.ts, task-completed.ts) share common libraries (discord-notifier.ts, usage-checker.ts). CLI tool registers hooks in ~/.claude/settings.json. Fire-and-forget pattern ensures notifications never block Claude Code.

**Tech Stack:** TypeScript, Node.js (fetch, child_process), tsx runtime, dotenv

---

## Task 1: Project Setup

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.env.example`

**Step 1: Create package.json**

Create file at project root:

```json
{
  "name": "claude-notifier",
  "version": "1.0.0",
  "description": "Discord notifications for Claude Code hooks",
  "type": "module",
  "scripts": {
    "register-hooks": "tsx src/cli/register-hooks.ts",
    "unregister-hooks": "tsx src/cli/register-hooks.ts --unregister",
    "test:input": "echo '{\"prompt\":\"test prompt\"}' | tsx src/hooks/input-requested.ts",
    "test:task": "echo '{\"prompt\":\"test\",\"tools\":[\"Read\",\"Edit\"],\"duration\":1234,\"status\":\"success\"}' | tsx src/hooks/task-completed.ts"
  },
  "dependencies": {
    "dotenv": "^16.4.5",
    "tsx": "^4.7.0"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "typescript": "^5.3.3"
  }
}
```

**Step 2: Create tsconfig.json**

Create file at project root:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 3: Create .env.example**

Create file at project root:

```
DISCORD_WEBHOOK=https://discord.com/api/webhooks/YOUR_WEBHOOK_HERE
```

**Step 4: Install dependencies**

Run: `npm install`
Expected: Dependencies installed successfully

**Step 5: Commit**

```bash
git add package.json tsconfig.json .env.example
git commit -m "feat: add project setup and dependencies"
```

---

## Task 2: TypeScript Types

**Files:**
- Create: `src/lib/types.ts`

**Step 1: Create types file**

Create `src/lib/types.ts`:

```typescript
// Usage statistics from ccusage
export interface UsageStats {
  remainingMinutes: number;
  formattedTime: string;
  tokenPercentageUsed: number;
}

// Discord embed message structure
export interface DiscordMessage {
  title: string;
  color: number;
  fields: Array<{ name: string; value: string; inline?: boolean }>;
  timestamp: string;
}

// Hook data from Claude Code (minimal structure)
export interface HookData {
  prompt?: string;
  tools?: string[];
  duration?: number;
  status?: string;
  error?: string;
  timestamp?: string;
}

// ccusage JSON output structure
export interface CcusageOutput {
  blocks?: {
    remaining?: number;
    total?: number;
  };
  reset?: {
    at?: string;
  };
}
```

**Step 2: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add TypeScript type definitions"
```

---

## Task 3: Usage Checker Module

**Files:**
- Create: `src/lib/usage-checker.ts`

**Step 1: Create usage checker**

Create `src/lib/usage-checker.ts`:

```typescript
import { exec } from 'child_process';
import { promisify } from 'util';
import type { UsageStats, CcusageOutput } from './types.js';

const execAsync = promisify(exec);

export async function getUsageStats(): Promise<UsageStats | null> {
  try {
    const { stdout } = await execAsync('npx ccusage@latest blocks --json', {
      timeout: 5000,
    });

    const data: CcusageOutput = JSON.parse(stdout);

    // Calculate remaining minutes until reset
    const remainingMinutes = calculateRemainingMinutes(data.reset?.at);

    // Calculate token percentage
    const tokenPercentageUsed = calculateTokenPercentage(
      data.blocks?.remaining,
      data.blocks?.total
    );

    return {
      remainingMinutes,
      formattedTime: formatTime(remainingMinutes),
      tokenPercentageUsed,
    };
  } catch (error) {
    console.error('Failed to get usage stats:', error);
    return null;
  }
}

function calculateRemainingMinutes(resetAt?: string): number {
  if (!resetAt) return 0;

  const resetTime = new Date(resetAt).getTime();
  const now = Date.now();
  const diffMs = resetTime - now;

  return Math.max(0, Math.floor(diffMs / 1000 / 60));
}

function calculateTokenPercentage(remaining?: number, total?: number): number {
  if (!remaining || !total) return 0;

  const used = total - remaining;
  return Math.round((used / total) * 100);
}

function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours === 0) {
    return `${mins}m remaining until reset`;
  }

  return `${hours}h${mins}m remaining until reset`;
}
```

**Step 2: Commit**

```bash
git add src/lib/usage-checker.ts
git commit -m "feat: add usage stats checker with ccusage integration"
```

---

## Task 4: Discord Notifier Module

**Files:**
- Create: `src/lib/discord-notifier.ts`

**Step 1: Create discord notifier**

Create `src/lib/discord-notifier.ts`:

```typescript
import dotenv from 'dotenv';
import type { DiscordMessage } from './types.js';

dotenv.config();

const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK;

export async function send(message: DiscordMessage): Promise<void> {
  if (!DISCORD_WEBHOOK) {
    console.error('DISCORD_WEBHOOK not configured in .env');
    return;
  }

  try {
    const embed = {
      embeds: [{
        title: message.title,
        color: message.color,
        fields: message.fields,
        timestamp: message.timestamp,
      }],
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(DISCORD_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(embed),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.error(`Discord API error: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.error('Failed to send Discord notification:', error);
  }
}
```

**Step 2: Commit**

```bash
git add src/lib/discord-notifier.ts
git commit -m "feat: add Discord webhook notifier with timeout"
```

---

## Task 5: Input Requested Hook

**Files:**
- Create: `src/hooks/input-requested.ts`

**Step 1: Create input-requested hook**

Create `src/hooks/input-requested.ts`:

```typescript
#!/usr/bin/env node
import { stdin } from 'process';
import { getUsageStats } from '../lib/usage-checker.js';
import { send } from '../lib/discord-notifier.js';
import type { HookData, DiscordMessage } from '../lib/types.js';

async function main() {
  try {
    // Read hook data from stdin
    const data = await readStdin();
    const hookData: HookData = data ? JSON.parse(data) : {};

    // Get usage statistics
    const usageStats = await getUsageStats();

    // Format prompt preview (first 100 chars)
    const promptPreview = hookData.prompt
      ? hookData.prompt.substring(0, 100) + (hookData.prompt.length > 100 ? '...' : '')
      : 'No prompt provided';

    // Get current time
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    // Build Discord message
    const message: DiscordMessage = {
      title: '🟡 Input Requested',
      color: 0xFFD700, // Yellow
      fields: [
        { name: '📝 Prompt', value: promptPreview },
        { name: '⏰ Time', value: timeString },
      ],
      timestamp: now.toISOString(),
    };

    // Add usage stats if available
    if (usageStats) {
      message.fields.push({
        name: '📊 Usage Stats',
        value: `├─ Tokens: ${usageStats.tokenPercentageUsed}% used\n└─ Reset: ${usageStats.formattedTime}`,
      });
    }

    // Send notification
    await send(message);
  } catch (error) {
    console.error('Error in input-requested hook:', error);
  }

  // Always exit 0 (fire-and-forget)
  process.exit(0);
}

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    stdin.on('data', (chunk) => {
      data += chunk;
    });
    stdin.on('end', () => {
      resolve(data);
    });
    // Timeout after 1 second if no data
    setTimeout(() => {
      resolve(data);
    }, 1000);
  });
}

main();
```

**Step 2: Make executable**

Run: `chmod +x src/hooks/input-requested.ts`

**Step 3: Test manually**

Run: `npm run test:input`
Expected: Script runs without errors, Discord notification sent (if webhook configured)

**Step 4: Commit**

```bash
git add src/hooks/input-requested.ts
git commit -m "feat: add input-requested hook handler"
```

---

## Task 6: Task Completed Hook

**Files:**
- Create: `src/hooks/task-completed.ts`

**Step 1: Create task-completed hook**

Create `src/hooks/task-completed.ts`:

```typescript
#!/usr/bin/env node
import { stdin } from 'process';
import { getUsageStats } from '../lib/usage-checker.js';
import { send } from '../lib/discord-notifier.js';
import type { HookData, DiscordMessage } from '../lib/types.js';

async function main() {
  try {
    // Read hook data from stdin
    const data = await readStdin();
    const hookData: HookData = data ? JSON.parse(data) : {};

    // Get usage statistics
    const usageStats = await getUsageStats();

    // Determine status
    const isSuccess = hookData.status === 'success' || !hookData.error;
    const title = isSuccess ? '🟢 Task Completed' : '🔴 Task Failed';
    const color = isSuccess ? 0x00FF00 : 0xFF0000; // Green or Red

    // Format prompt preview
    const promptPreview = hookData.prompt
      ? hookData.prompt.substring(0, 100) + (hookData.prompt.length > 100 ? '...' : '')
      : 'No prompt provided';

    // Format tools
    const toolsUsed = formatTools(hookData.tools || []);

    // Format duration
    const duration = hookData.duration
      ? `${(hookData.duration / 1000).toFixed(1)}s`
      : 'Unknown';

    // Build Discord message fields
    const fields = [
      { name: '📝 Prompt', value: promptPreview },
      { name: '🔧 Tools', value: toolsUsed || 'None' },
      { name: '⚡ Duration', value: duration },
    ];

    // Add status or error
    if (isSuccess) {
      fields.push({ name: '✅ Status', value: 'Success' });
    } else {
      fields.push({ name: '❌ Error', value: hookData.error || 'Unknown error' });
    }

    // Add usage stats if available
    if (usageStats) {
      fields.push({
        name: '📊 Usage Stats',
        value: `├─ Tokens: ${usageStats.tokenPercentageUsed}% used\n└─ Reset: ${usageStats.formattedTime}`,
      });
    }

    const message: DiscordMessage = {
      title,
      color,
      fields,
      timestamp: new Date().toISOString(),
    };

    // Send notification
    await send(message);
  } catch (error) {
    console.error('Error in task-completed hook:', error);
  }

  // Always exit 0 (fire-and-forget)
  process.exit(0);
}

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    stdin.on('data', (chunk) => {
      data += chunk;
    });
    stdin.on('end', () => {
      resolve(data);
    });
    // Timeout after 1 second if no data
    setTimeout(() => {
      resolve(data);
    }, 1000);
  });
}

function formatTools(tools: string[]): string {
  if (tools.length === 0) return 'None';

  // Count occurrences
  const counts = tools.reduce((acc, tool) => {
    acc[tool] = (acc[tool] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Format as "Read (3), Edit (2)"
  return Object.entries(counts)
    .map(([tool, count]) => `${tool} (${count})`)
    .join(', ');
}

main();
```

**Step 2: Make executable**

Run: `chmod +x src/hooks/task-completed.ts`

**Step 3: Test manually**

Run: `npm run test:task`
Expected: Script runs without errors, Discord notification sent

**Step 4: Commit**

```bash
git add src/hooks/task-completed.ts
git commit -m "feat: add task-completed hook handler"
```

---

## Task 7: CLI Registration Tool

**Files:**
- Create: `src/cli/register-hooks.ts`

**Step 1: Create register-hooks CLI**

Create `src/cli/register-hooks.ts`:

```typescript
#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'fs';
import { homedir } from 'os';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const isUnregister = process.argv.includes('--unregister');

async function main() {
  try {
    // Get paths
    const settingsPath = join(homedir(), '.claude', 'settings.json');
    const projectRoot = resolve(__dirname, '../..');
    const envPath = join(projectRoot, '.env');

    console.log('📍 Project root:', projectRoot);
    console.log('⚙️  Settings file:', settingsPath);

    // Verify .env exists (unless unregistering)
    if (!isUnregister && !existsSync(envPath)) {
      console.error('\n❌ Error: .env file not found!');
      console.error('   Create .env file with DISCORD_WEBHOOK before registering hooks.');
      console.error('   See .env.example for reference.');
      process.exit(1);
    }

    // Verify settings.json exists
    if (!existsSync(settingsPath)) {
      console.error('\n❌ Error: ~/.claude/settings.json not found!');
      console.error('   Make sure Claude Code is installed.');
      process.exit(1);
    }

    // Read and parse settings
    const settingsContent = readFileSync(settingsPath, 'utf-8');
    const settings = JSON.parse(settingsContent);

    // Backup settings
    const backupPath = settingsPath + '.backup';
    copyFileSync(settingsPath, backupPath);
    console.log('💾 Backed up settings to:', backupPath);

    if (isUnregister) {
      // Remove hooks
      if (settings.hooks) {
        delete settings.hooks['user-prompt-submit'];
        delete settings.hooks['agent-response-end'];

        // Remove hooks object if empty
        if (Object.keys(settings.hooks).length === 0) {
          delete settings.hooks;
        }
      }

      writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
      console.log('\n✅ Hooks unregistered successfully!');
    } else {
      // Register hooks
      if (!settings.hooks) {
        settings.hooks = {};
      }

      const inputHook = `npx tsx ${join(projectRoot, 'src/hooks/input-requested.ts')}`;
      const taskHook = `npx tsx ${join(projectRoot, 'src/hooks/task-completed.ts')}`;

      // Check if hooks already exist
      const inputExists = settings.hooks['user-prompt-submit'];
      const taskExists = settings.hooks['agent-response-end'];

      if (inputExists || taskExists) {
        console.log('\n⚠️  Warning: Hooks already registered:');
        if (inputExists) console.log('   - user-prompt-submit:', inputExists);
        if (taskExists) console.log('   - agent-response-end:', taskExists);
        console.log('\n   Overwriting with new paths...');
      }

      settings.hooks['user-prompt-submit'] = inputHook;
      settings.hooks['agent-response-end'] = taskHook;

      writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
      console.log('\n✅ Hooks registered successfully!');
      console.log('\n📌 Registered hooks:');
      console.log('   - user-prompt-submit:', inputHook);
      console.log('   - agent-response-end:', taskHook);
    }
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

main();
```

**Step 2: Make executable**

Run: `chmod +x src/cli/register-hooks.ts`

**Step 3: Test dry run (inspect settings.json before registering)**

Run: `cat ~/.claude/settings.json`
Expected: View current settings

**Step 4: Commit**

```bash
git add src/cli/register-hooks.ts
git commit -m "feat: add CLI tool for hook registration"
```

---

## Task 8: Documentation

**Files:**
- Create: `README.md`

**Step 1: Create README**

Create `README.md`:

```markdown
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
```

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add comprehensive README"
```

---

## Task 9: Final Testing & Verification

**Step 1: Verify all files exist**

Run: `ls -R src/`
Expected: See all source files in correct structure

**Step 2: Test TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No TypeScript errors

**Step 3: Test input-requested hook**

Run: `echo '{"prompt":"Test prompt for input"}' | npx tsx src/hooks/input-requested.ts`
Expected: Script completes, check Discord for notification

**Step 4: Test task-completed hook**

Run: `echo '{"prompt":"Test task","tools":["Read","Edit","Read"],"duration":2500,"status":"success"}' | npx tsx src/hooks/task-completed.ts`
Expected: Script completes, check Discord for notification

**Step 5: Test hook registration (dry-run inspection)**

Run: `cat ~/.claude/settings.json`
Expected: View current settings before registration

**Step 6: Final commit**

```bash
git add -A
git commit -m "feat: complete discord-notifier implementation

All components implemented:
- Hook handlers for input-requested and task-completed
- Usage checker with ccusage integration
- Discord webhook notifier
- CLI registration tool
- Complete documentation
"
```

---

## Completion Checklist

- [ ] All TypeScript files compile without errors
- [ ] Manual tests pass for both hooks
- [ ] Discord notifications appear with correct formatting
- [ ] Usage stats display correctly (tokens %, time remaining)
- [ ] README is complete and accurate
- [ ] All commits follow conventional commit format
- [ ] Ready to register hooks with `npm run register-hooks`

## Next Steps

After implementation:
1. Run `npm run register-hooks` to activate hooks
2. Test with actual Claude Code usage
3. Monitor Discord channel for notifications
4. Adjust formatting/fields as needed
