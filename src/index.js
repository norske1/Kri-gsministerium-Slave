import 'dotenv/config';
import { Client, GatewayIntentBits, Routes, REST, MessageFlags, Partials } from 'discord.js';
import { commands } from './commands.js';
import { TOKEN, CLIENT_ID, GUILD_ID, OWNER_ID } from './config.js';
import {
  loadAccess,
  allowUser,
  denyUser,
  allowRole,
  denyRole,
  getAccess,
  hasAccess,
} from './access.js';
import { loadApplications } from './applications.js';
import { handleMedalInteraction, postPanel } from './medalFlow.js';
import { PANEL_CHANNEL_ID } from './medals.js';

if (!TOKEN) {
  console.error('DISCORD_TOKEN is not set. Add it to the environment or .env file.');
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages],
  partials: [Partials.Channel, Partials.Message],
});

async function registerCommands(readyClient) {
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  const clientId = CLIENT_ID || readyClient.user.id;
  if (GUILD_ID) {
    await rest.put(Routes.applicationGuildCommands(clientId, GUILD_ID), { body: commands });
    console.log(`Registered ${commands.length} guild commands to ${GUILD_ID}.`);
  } else {
    await rest.put(Routes.applicationCommands(clientId), { body: commands });
    console.log(`Registered ${commands.length} global commands (may take up to 1h).`);
  }
}

client.once('clientReady', async (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}. Owner: ${OWNER_ID}`);
  try {
    await registerCommands(readyClient);
  } catch (err) {
    console.error('Command registration failed:', err);
  }
});

function isOwner(interaction) {
  return interaction.user.id === OWNER_ID;
}

client.on('interactionCreate', async (interaction) => {
  // Buttons and modals (application panel, review DMs, deny reasons) are
  // handled by the medal flow, including in DM channels.
  if (interaction.isButton() || interaction.isModalSubmit()) {
    try {
      await handleMedalInteraction(interaction, client);
    } catch (err) {
      console.error('Error handling component interaction:', err);
      const payload = { content: 'Something went wrong.', flags: MessageFlags.Ephemeral };
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp(payload).catch(() => {});
      } else {
        await interaction.reply(payload).catch(() => {});
      }
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  if (!interaction.inGuild()) {
    await interaction.reply({ content: 'This bot only works inside a server.', flags: MessageFlags.Ephemeral });
    return;
  }

  const { commandName, guildId } = interaction;

  try {
    if (commandName === 'panel') {
      if (!isOwner(interaction)) {
        await interaction.reply({
          content: 'Only the bot owner can post the panel.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const channel = interaction.options.getChannel('channel');
      const channelId = channel ? channel.id : PANEL_CHANNEL_ID;
      await postPanel(client, channelId);
      await interaction.reply({
        content: `Panel posted in <#${channelId}>.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (commandName === 'allow' || commandName === 'deny' || commandName === 'accesslist') {
      if (!isOwner(interaction)) {
        await interaction.reply({
          content: 'Only the bot owner can manage access.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
    }

    if (commandName === 'allow' || commandName === 'deny') {
      const user = interaction.options.getUser('user');
      const role = interaction.options.getRole('role');

      if (!user && !role) {
        await interaction.reply({
          content: 'Specify a `user` and/or a `role` to modify.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const lines = [];
      const granting = commandName === 'allow';

      if (user) {
        const changed = granting
          ? await allowUser(guildId, user.id)
          : await denyUser(guildId, user.id);
        lines.push(
          granting
            ? changed
              ? `Granted access to ${user}.`
              : `${user} already has access.`
            : changed
              ? `Revoked access from ${user}.`
              : `${user} did not have direct access.`,
        );
      }

      if (role) {
        const changed = granting
          ? await allowRole(guildId, role.id)
          : await denyRole(guildId, role.id);
        lines.push(
          granting
            ? changed
              ? `Granted access to role ${role}.`
              : `Role ${role} already has access.`
            : changed
              ? `Revoked access from role ${role}.`
              : `Role ${role} did not have access.`,
        );
      }

      await interaction.reply({ content: lines.join('\n'), flags: MessageFlags.Ephemeral });
      return;
    }

    if (commandName === 'accesslist') {
      const { users, roles } = getAccess(guildId);
      const userList = users.length ? users.map((id) => `<@${id}>`).join(', ') : '_none_';
      const roleList = roles.length ? roles.map((id) => `<@&${id}>`).join(', ') : '_none_';
      await interaction.reply({
        content: `**Owner:** <@${OWNER_ID}>\n**Allowed users:** ${userList}\n**Allowed roles:** ${roleList}`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (commandName === 'ping') {
      if (!hasAccess(guildId, interaction.member)) {
        await interaction.reply({
          content: 'You do not have access to use this bot. Ask the owner to grant you access.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await interaction.reply({ content: `Pong! Latency: ${client.ws.ping}ms`, flags: MessageFlags.Ephemeral });
      return;
    }
  } catch (err) {
    console.error(`Error handling /${commandName}:`, err);
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ content: 'Something went wrong.', flags: MessageFlags.Ephemeral }).catch(() => {});
    } else {
      await interaction.reply({ content: 'Something went wrong.', flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  }
});

await loadAccess();
await loadApplications();
await client.login(TOKEN);
