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
 * Returns data for the LAST user message and subsequent tool usage
 */
export function parseTranscript(transcriptPath: string): SessionData {
  try {
    const content = readFileSync(transcriptPath, 'utf-8');
    const lines = content.trim().split('\n');

    let lastUserPrompt = '';
    let lastUserTimestamp: number | undefined;
    const allEntries: TranscriptEntry[] = [];

    // First pass: parse all entries and find the last user message
    for (const line of lines) {
      if (!line.trim()) continue;
      const entry: TranscriptEntry = JSON.parse(line);
      allEntries.push(entry);

      // Track the most recent user message
      if (entry.type === 'user' && entry.message?.role === 'user') {
        const content = entry.message.content;
        if (typeof content === 'string') {
          lastUserPrompt = content;
          if (entry.timestamp) {
            lastUserTimestamp = new Date(entry.timestamp).getTime();
          }
        }
      }
    }

    // Second pass: collect tools and response AFTER the last user message
    const tools: string[] = [];
    const responseTexts: string[] = [];
    let collectingTools = false;
    let endTime: number | undefined;

    for (const entry of allEntries) {
      // Start collecting after we see the last user message
      if (
        entry.type === 'user' &&
        entry.message?.role === 'user' &&
        entry.timestamp &&
        lastUserTimestamp &&
        new Date(entry.timestamp).getTime() === lastUserTimestamp
      ) {
        collectingTools = true;
        continue;
      }

      // Collect tools and text from assistant messages after the last user message
      if (collectingTools && entry.type === 'assistant' && entry.message?.content && Array.isArray(entry.message.content)) {
        for (const item of entry.message.content) {
          if (item.type === 'tool_use' && item.name) {
            tools.push(item.name);
          }
          if (item.type === 'text' && item.text) {
            responseTexts.push(item.text);
          }
        }
      }

      // Track the last timestamp
      if (collectingTools && entry.timestamp) {
        endTime = new Date(entry.timestamp).getTime();
      }
    }

    // Combine all response texts
    const response = responseTexts.join('\n').trim();

    // Calculate duration from last user message to end
    const duration = lastUserTimestamp && endTime ? endTime - lastUserTimestamp : undefined;

    return {
      prompt: lastUserPrompt || undefined,
      response: response || undefined,
      tools,
      duration,
      error: undefined,
    };
  } catch (err) {
    console.error('Failed to parse transcript:', err);
    return {
      tools: [],
    };
  }
}
