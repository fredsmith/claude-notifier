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
