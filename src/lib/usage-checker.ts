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
