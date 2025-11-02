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
