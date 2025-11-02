#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'fs';
import { homedir } from 'os';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const isUnregister = process.argv.includes('--unregister');

async function main() {
  try {
    // Get paths
    const settingsPath = join(homedir(), '.claude', 'settings.json');
    const projectRoot = resolve(__dirname, '../..');
    const envPath = join(projectRoot, '.env');

    console.log('📍 Project root:', projectRoot);
    console.log('⚙️  Settings file:', settingsPath);

    // Verify .env exists (unless unregistering)
    if (!isUnregister && !existsSync(envPath)) {
      console.error('\n❌ Error: .env file not found!');
      console.error('   Create .env file with DISCORD_WEBHOOK before registering hooks.');
      console.error('   See .env.example for reference.');
      process.exit(1);
    }

    // Verify settings.json exists
    if (!existsSync(settingsPath)) {
      console.error('\n❌ Error: ~/.claude/settings.json not found!');
      console.error('   Make sure Claude Code is installed.');
      process.exit(1);
    }

    // Read and parse settings
    const settingsContent = readFileSync(settingsPath, 'utf-8');
    const settings = JSON.parse(settingsContent);

    // Backup settings
    const backupPath = settingsPath + '.backup';
    copyFileSync(settingsPath, backupPath);
    console.log('💾 Backed up settings to:', backupPath);

    if (isUnregister) {
      // Remove hooks
      if (settings.hooks) {
        delete settings.hooks['user-prompt-submit'];
        delete settings.hooks['agent-response-end'];

        // Remove hooks object if empty
        if (Object.keys(settings.hooks).length === 0) {
          delete settings.hooks;
        }
      }

      writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
      console.log('\n✅ Hooks unregistered successfully!');
    } else {
      // Register hooks
      if (!settings.hooks) {
        settings.hooks = {};
      }

      const inputHook = `npx tsx ${join(projectRoot, 'src/hooks/input-requested.ts')}`;
      const taskHook = `npx tsx ${join(projectRoot, 'src/hooks/task-completed.ts')}`;

      // Check if hooks already exist
      const inputExists = settings.hooks['user-prompt-submit'];
      const taskExists = settings.hooks['agent-response-end'];

      if (inputExists || taskExists) {
        console.log('\n⚠️  Warning: Hooks already registered:');
        if (inputExists) console.log('   - user-prompt-submit:', inputExists);
        if (taskExists) console.log('   - agent-response-end:', taskExists);
        console.log('\n   Overwriting with new paths...');
      }

      settings.hooks['user-prompt-submit'] = inputHook;
      settings.hooks['agent-response-end'] = taskHook;

      writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
      console.log('\n✅ Hooks registered successfully!');
      console.log('\n📌 Registered hooks:');
      console.log('   - user-prompt-submit:', inputHook);
      console.log('   - agent-response-end:', taskHook);
    }
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

main();
