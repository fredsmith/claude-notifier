import { readFileSync } from 'fs';
import type { SessionData } from './types.js';

interface TranscriptEntry {
  type: string;
  message?: {
    role?: string;
    content?: string | Array<{ type: string; name?: string; text?: string }>;
  };
  timestamp?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

/**
 * Parses a Claude Code transcript JSONL file to extract session information
 */
export function parseTranscript(transcriptPath: string): SessionData {
  try {
    const content = readFileSync(transcriptPath, 'utf-8');
    const lines = content.trim().split('\n');

    let userPrompt = '';
    const tools: string[] = [];
    let startTime: number | undefined;
    let endTime: number | undefined;
    let error: string | undefined;

    for (const line of lines) {
      if (!line.trim()) continue;

      const entry: TranscriptEntry = JSON.parse(line);

      // Capture the first user message as the prompt
      if (entry.type === 'user' && entry.message?.role === 'user' && !userPrompt) {
        const content = entry.message.content;
        if (typeof content === 'string') {
          userPrompt = content;
        }
        if (entry.timestamp) {
          startTime = new Date(entry.timestamp).getTime();
        }
      }

      // Track tool usage from assistant messages
      if (entry.type === 'assistant' && entry.message?.content && Array.isArray(entry.message.content)) {
        for (const item of entry.message.content) {
          if (item.type === 'tool_use' && item.name) {
            tools.push(item.name);
          }
        }
      }

      // Track end time (use the last timestamp)
      if (entry.timestamp) {
        endTime = new Date(entry.timestamp).getTime();
      }
    }

    // Calculate duration if we have start and end times
    const duration = startTime && endTime ? endTime - startTime : undefined;

    return {
      prompt: userPrompt || undefined,
      tools,
      duration,
      error,
    };
  } catch (err) {
    console.error('Failed to parse transcript:', err);
    return {
      tools: [],
    };
  }
}
