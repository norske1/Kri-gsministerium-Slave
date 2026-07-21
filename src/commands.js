import { SlashCommandBuilder } from 'discord.js';

// Slash command definitions. Grant/revoke commands are restricted to the
// owner at runtime (see index.js); the "ping" command demonstrates a command
// gated behind usage access.
export const commands = [
  new SlashCommandBuilder()
    .setName('allow')
    .setDescription('Grant a user or role access to use this bot (owner only).')
    .addUserOption((opt) =>
      opt.setName('user').setDescription('User to grant access to').setRequired(false),
    )
    .addRoleOption((opt) =>
      opt.setName('role').setDescription('Role to grant access to').setRequired(false),
    ),

  new SlashCommandBuilder()
    .setName('deny')
    .setDescription('Revoke a user or role access to this bot (owner only).')
    .addUserOption((opt) =>
      opt.setName('user').setDescription('User to revoke access from').setRequired(false),
    )
    .addRoleOption((opt) =>
      opt.setName('role').setDescription('Role to revoke access from').setRequired(false),
    ),

  new SlashCommandBuilder()
    .setName('accesslist')
    .setDescription('Show which users and roles currently have access (owner only).'),

  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check the bot is responding (requires usage access).'),

  new SlashCommandBuilder()
    .setName('panel')
    .setDescription('Post the medal request panel (owner only).')
    .addChannelOption((opt) =>
      opt
        .setName('channel')
        .setDescription('Channel to post in (defaults to the configured medal channel).')
        .setRequired(false),
    ),
].map((c) => c.toJSON());
