#!/usr/bin/env node
import { stdin } from 'process';
import { getUsageStats } from '../lib/usage-checker.js';
import { send } from '../lib/discord-notifier.js';
import { parseTranscript } from '../lib/transcript-parser.js';
import type { StopHookData, DiscordMessage, SessionData } from '../lib/types.js';

async function main() {
  try {
    // Read hook data from stdin
    const data = await readStdin();

    const hookData: StopHookData = data ? JSON.parse(data) : {};

    // Parse the transcript to get session data
    let sessionData: SessionData = {
      tools: [],
    };

    if (hookData.transcript_path) {
      sessionData = parseTranscript(hookData.transcript_path);
    }

    // Get usage statistics
    const usageStats = await getUsageStats();

    // Determine status
    const isSuccess = !sessionData.error;
    const title = isSuccess ? '🟢 Task Completed' : '🔴 Task Failed';
    const color = isSuccess ? 0x00FF00 : 0xFF0000; // Green or Red

    // Format prompt preview
    const promptPreview = sessionData.prompt
      ? sessionData.prompt.substring(0, 100) + (sessionData.prompt.length > 100 ? '...' : '')
      : 'No prompt provided';

    // Format response preview (last 200 chars to show the end)
    const responsePreview = sessionData.response
      ? (sessionData.response.length > 200
          ? '...' + sessionData.response.substring(sessionData.response.length - 200)
          : sessionData.response)
      : 'No response';

    // Format tools
    const toolsUsed = formatTools(sessionData.tools);

    // Format duration
    const duration = sessionData.duration
      ? `${(sessionData.duration / 1000).toFixed(1)}s`
      : 'Unknown';

    // Build Discord message fields
    const fields = [
      { name: '📝 Prompt', value: promptPreview },
      { name: '💬 Response', value: responsePreview },
      { name: '🔧 Tools', value: toolsUsed || 'None' },
      { name: '⚡ Duration', value: duration },
    ];

    // Add status or error
    if (isSuccess) {
      fields.push({ name: '✅ Status', value: 'Success' });
    } else {
      fields.push({ name: '❌ Error', value: sessionData.error || 'Unknown error' });
    }

    // Add usage stats if available
    if (usageStats) {
      fields.push({
        name: '📊 Usage Stats',
        value: `├─ ${usageStats.tokenPercentageUsed}% used\n└─ ${usageStats.resetTime}`,
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
