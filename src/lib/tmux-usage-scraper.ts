import { exec } from 'child_process';
import { promisify } from 'util';
import type { UsageStats } from './types.js';

const execAsync = promisify(exec);

const SESSION_NAME = 'claude-usage-checker';
const WINDOW_NAME = 'usage';

interface TmuxUsageData {
  percentUsed: number;
  resetMinutes: number;
}

/**
 * Ensures a tmux session exists with claude running
 */
async function ensureSession(): Promise<void> {
  try {
    // Check if session exists
    await execAsync(`tmux has-session -t ${SESSION_NAME} 2>/dev/null`);
    // Session exists, we're good
  } catch {
    // Session doesn't exist, create it
    console.log('Creating new tmux session for usage checking...');

    // Create detached session running claude
    await execAsync(
      `tmux new-session -d -s ${SESSION_NAME} -n ${WINDOW_NAME} claude`
    );

    // Wait for claude to start up
    await sleep(3000);

    // Send /usage command (this will trigger autocomplete)
    await execAsync(`tmux send-keys -t ${SESSION_NAME}:${WINDOW_NAME} /usage`);
    await sleep(500);

    // Dismiss autocomplete with Escape, then execute with Enter
    await execAsync(`tmux send-keys -t ${SESSION_NAME}:${WINDOW_NAME} Escape`);
    await sleep(300);
    await execAsync(`tmux send-keys -t ${SESSION_NAME}:${WINDOW_NAME} Enter`);

    // Wait for usage display to render (needs time to fetch from API)
    await sleep(4000);
  }
}

/**
 * Refreshes the usage display and captures the output
 */
async function refreshAndCapture(): Promise<TmuxUsageData | null> {
  try {
    await ensureSession();

    // Send Escape to clear any dialogs, then clear input
    await execAsync(`tmux send-keys -t ${SESSION_NAME}:${WINDOW_NAME} Escape Escape C-u`);
    await sleep(500);

    // Type /usage (will trigger autocomplete)
    await execAsync(`tmux send-keys -t ${SESSION_NAME}:${WINDOW_NAME} /usage`);
    await sleep(500);

    // Dismiss autocomplete with Escape, then execute with Enter
    await execAsync(`tmux send-keys -t ${SESSION_NAME}:${WINDOW_NAME} Escape`);
    await sleep(300);
    await execAsync(`tmux send-keys -t ${SESSION_NAME}:${WINDOW_NAME} Enter`);

    // Wait for API fetch and dialog to render
    await sleep(5000);

    // Capture pane content
    const { stdout } = await execAsync(
      `tmux capture-pane -t ${SESSION_NAME}:${WINDOW_NAME} -p`
    );

    // Parse the output
    return parseUsageOutput(stdout);
  } catch (error) {
    console.error('Failed to capture tmux usage:', error);
    return null;
  }
}

/**
 * Parses the /usage command output from Claude Code dialog
 * Looking for patterns like:
 * - "23% used" - usage percentage under "Current session"
 * - "Resets 2:59pm (America/New_York)" - reset time
 */
function parseUsageOutput(output: string): TmuxUsageData | null {
  try {
    const lines = output.split('\n');

    let percentUsed = 0;
    let resetMinutes = 0;
    let inCurrentSession = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Look for "Current session" section
      if (line.includes('Current session')) {
        inCurrentSession = true;
        continue;
      }

      // If we're in the current session section, look for percentage
      if (inCurrentSession) {
        // Look for percentage in format: "23% used"
        const percentMatch = line.match(/(\d+)%\s+used/);
        if (percentMatch) {
          percentUsed = parseInt(percentMatch[1], 10);
        }

        // Look for reset time in format: "Resets 2:59pm (America/New_York)"
        const resetMatch = line.match(/Resets\s+(\d+):(\d+)(am|pm)/i);
        if (resetMatch) {
          const hours = parseInt(resetMatch[1], 10);
          const minutes = parseInt(resetMatch[2], 10);
          const isPM = resetMatch[3].toLowerCase() === 'pm';

          // Calculate minutes until reset
          const now = new Date();
          const resetTime = new Date();
          let resetHour = hours;
          if (isPM && hours !== 12) {
            resetHour += 12;
          } else if (!isPM && hours === 12) {
            resetHour = 0;
          }
          resetTime.setHours(resetHour, minutes, 0, 0);

          // If reset time is in the past, it's tomorrow
          if (resetTime < now) {
            resetTime.setDate(resetTime.getDate() + 1);
          }

          const diffMs = resetTime.getTime() - now.getTime();
          resetMinutes = Math.max(0, Math.floor(diffMs / 1000 / 60));

          // We found both values in current session, we can stop
          break;
        }
      }

      // Stop looking after current session section
      if (inCurrentSession && line.includes('Current week')) {
        break;
      }
    }

    // Return data if we found either value
    if (percentUsed > 0 || resetMinutes > 0) {
      return { percentUsed, resetMinutes };
    }

    return null;
  } catch (error) {
    console.error('Failed to parse usage output:', error);
    return null;
  }
}

/**
 * Cleans up the tmux session
 */
async function cleanupSession(): Promise<void> {
  try {
    await execAsync(`tmux kill-session -t ${SESSION_NAME} 2>/dev/null`);
  } catch {
    // Session might not exist, that's fine
  }
}

/**
 * Gets usage stats by scraping tmux output of claude /usage
 */
export async function getUsageStats(): Promise<UsageStats | null> {
  try {
    const data = await refreshAndCapture();

    if (!data) {
      return null;
    }

    return {
      remainingMinutes: data.resetMinutes,
      formattedTime: formatTime(data.resetMinutes),
      tokenPercentageUsed: data.percentUsed,
    };
  } catch (error) {
    console.error('Failed to get usage stats from tmux:', error);
    return null;
  }
}

function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours === 0) {
    return `${mins}m remaining until reset`;
  }

  return `${hours}h${mins}m remaining until reset`;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Cleanup on process exit
process.on('exit', () => {
  cleanupSession().catch(() => {});
});

process.on('SIGINT', () => {
  cleanupSession().catch(() => {});
  process.exit(0);
});
