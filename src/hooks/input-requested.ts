#!/usr/bin/env node
import { stdin } from 'process';
import { getUsageStats } from '../lib/usage-checker.js';
import { send } from '../lib/discord-notifier.js';
import type { UserPromptHookData, DiscordMessage } from '../lib/types.js';

async function main() {
  try {
    // Read hook data from stdin
    const data = await readStdin();
    const hookData: UserPromptHookData = data ? JSON.parse(data) : {};

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
        value: `├─ ${usageStats.tokenPercentageUsed}% used\n└─ ${usageStats.resetTime}`,
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
