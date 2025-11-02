import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);
const SESSION_NAME = 'claude-usage-checker';
const WINDOW_NAME = 'usage';
/**
 * Ensures a tmux session exists with claude running
 */
async function ensureSession() {
    try {
        // Check if session exists
        await execAsync(`tmux has-session -t ${SESSION_NAME} 2>/dev/null`);
        // Session exists, we're good
    }
    catch {
        // Session doesn't exist, create it
        console.log('Creating new tmux session for usage checking...');
        // Create detached session running claude
        await execAsync(`tmux new-session -d -s ${SESSION_NAME} -n ${WINDOW_NAME} claude`);
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
async function refreshAndCapture() {
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
        const { stdout } = await execAsync(`tmux capture-pane -t ${SESSION_NAME}:${WINDOW_NAME} -p`);
        // Parse the output
        return parseUsageOutput(stdout);
    }
    catch (error) {
        console.error('Failed to capture tmux usage:', error);
        return null;
    }
}
/**
 * Parses the /usage command output from Claude Code dialog
 * Looking for patterns like:
 * - "23% used" - usage percentage under "Current session"
 * - "Resets 2:59pm (America/New_York)" - reset time (returned as-is)
 */
function parseUsageOutput(output) {
    try {
        const lines = output.split('\n');
        let percentUsed = 0;
        let resetTime = '';
        let inCurrentSession = false;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            // Look for "Current session" section
            if (line.includes('Current session')) {
                inCurrentSession = true;
                continue;
            }
            // If we're in the current session section, look for percentage and reset time
            if (inCurrentSession) {
                // Look for percentage in format: "23% used"
                const percentMatch = line.match(/(\d+)%\s+used/);
                if (percentMatch) {
                    percentUsed = parseInt(percentMatch[1], 10);
                }
                // Look for reset time line and capture the whole thing
                // Format: " Resets 2:59pm (America/New_York)"
                const resetMatch = line.match(/\s*(Resets\s+.+)/);
                if (resetMatch) {
                    resetTime = resetMatch[1].trim();
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
        if (percentUsed > 0 || resetTime) {
            return { percentUsed, resetTime };
        }
        return null;
    }
    catch (error) {
        console.error('Failed to parse usage output:', error);
        return null;
    }
}
/**
 * Cleans up the tmux session
 */
async function cleanupSession() {
    try {
        await execAsync(`tmux kill-session -t ${SESSION_NAME} 2>/dev/null`);
    }
    catch {
        // Session might not exist, that's fine
    }
}
/**
 * Gets usage stats by scraping tmux output of claude /usage
 */
export async function getUsageStats() {
    try {
        const data = await refreshAndCapture();
        if (!data) {
            return null;
        }
        return {
            tokenPercentageUsed: data.percentUsed,
            resetTime: data.resetTime,
        };
    }
    catch (error) {
        console.error('Failed to get usage stats from tmux:', error);
        return null;
    }
}
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
// Cleanup on process exit
process.on('exit', () => {
    cleanupSession().catch(() => { });
});
process.on('SIGINT', () => {
    cleanupSession().catch(() => { });
    process.exit(0);
});
