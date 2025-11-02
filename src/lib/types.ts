// Usage statistics from tmux scraper
export interface UsageStats {
  tokenPercentageUsed: number;
  resetTime: string; // Raw string from dialog like "Resets 3pm (America/New_York)"
}

// Discord embed message structure
export interface DiscordMessage {
  title: string;
  color: number;
  fields: Array<{ name: string; value: string; inline?: boolean }>;
  timestamp: string;
}

// Hook data from Claude Code Stop hook
export interface StopHookData {
  session_id?: string;
  transcript_path?: string;
  cwd?: string;
  permission_mode?: string;
  hook_event_name?: string;
  stop_hook_active?: boolean;
}

// Hook data from UserPromptSubmit hook
export interface UserPromptHookData {
  prompt?: string;
  hook_event_name?: string;
}

// Extracted session data from transcript
export interface SessionData {
  prompt?: string;
  response?: string; // Last assistant response text
  tools: string[];
  duration?: number;
  error?: string;
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
