import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { commands } from './commands.js';
import { TOKEN, CLIENT_ID, GUILD_ID } from './config.js';

if (!TOKEN || !CLIENT_ID) {
  console.error('DISCORD_TOKEN and CLIENT_ID must be set in the environment.');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(TOKEN);

try {
  if (GUILD_ID) {
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
      body: commands,
    });
    console.log(`Registered ${commands.length} guild commands to ${GUILD_ID}.`);
  } else {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log(`Registered ${commands.length} global commands.`);
  }
} catch (err) {
  console.error('Failed to register commands:', err);
  process.exit(1);
}
