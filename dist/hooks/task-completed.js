#!/usr/bin/env node
import { stdin } from 'process';
import { getUsageStats } from '../lib/usage-checker.js';
import { send } from '../lib/discord-notifier.js';
async function main() {
    try {
        // Read hook data from stdin
        const data = await readStdin();
        // Debug: log what we received
        console.error('Raw stdin data:', data);
        const hookData = data ? JSON.parse(data) : {};
        // Debug: log parsed hook data
        console.error('Parsed hook data:', JSON.stringify(hookData, null, 2));
        // Get usage statistics
        const usageStats = await getUsageStats();
        // Determine status
        const isSuccess = hookData.status === 'success' || !hookData.error;
        const title = isSuccess ? '🟢 Task Completed' : '🔴 Task Failed';
        const color = isSuccess ? 0x00FF00 : 0xFF0000; // Green or Red
        // Format prompt preview
        const promptPreview = hookData.prompt
            ? hookData.prompt.substring(0, 100) + (hookData.prompt.length > 100 ? '...' : '')
            : 'No prompt provided';
        // Format tools
        const toolsUsed = formatTools(hookData.tools || []);
        // Format duration
        const duration = hookData.duration
            ? `${(hookData.duration / 1000).toFixed(1)}s`
            : 'Unknown';
        // Build Discord message fields
        const fields = [
            { name: '📝 Prompt', value: promptPreview },
            { name: '🔧 Tools', value: toolsUsed || 'None' },
            { name: '⚡ Duration', value: duration },
        ];
        // Add status or error
        if (isSuccess) {
            fields.push({ name: '✅ Status', value: 'Success' });
        }
        else {
            fields.push({ name: '❌ Error', value: hookData.error || 'Unknown error' });
        }
        // Add usage stats if available
        if (usageStats) {
            fields.push({
                name: '📊 Usage Stats',
                value: `├─ ${usageStats.tokenPercentageUsed}% used\n└─ ${usageStats.resetTime}`,
            });
        }
        const message = {
            title,
            color,
            fields,
            timestamp: new Date().toISOString(),
        };
        // Send notification
        await send(message);
    }
    catch (error) {
        console.error('Error in task-completed hook:', error);
    }
    // Always exit 0 (fire-and-forget)
    process.exit(0);
}
function readStdin() {
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
function formatTools(tools) {
    if (tools.length === 0)
        return 'None';
    // Count occurrences
    const counts = tools.reduce((acc, tool) => {
        acc[tool] = (acc[tool] || 0) + 1;
        return acc;
    }, {});
    // Format as "Read (3), Edit (2)"
    return Object.entries(counts)
        .map(([tool, count]) => `${tool} (${count})`)
        .join(', ');
}
main();
