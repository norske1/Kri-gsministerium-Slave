import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
} from 'discord.js';
import { CATALOGS, REVIEWER_IDS, PANEL_CHANNEL_ID, resolveEntry, getCatalog } from './medals.js';
import {
  getCooldownRemaining,
  setDenyCooldown,
  createRequest,
  getRequest,
  addReviewerMessage,
  decideRequest,
} from './applications.js';
import { logApproved, sheetsEnabled } from './sheets.js';

const APPLY_BUTTON = 'medal_apply_open';
const APPLY_MODAL = 'medal_application_modal';
const ACCEPT_PREFIX = 'medal_accept:';
const DENY_PREFIX = 'medal_deny:';
const DENY_MODAL_PREFIX = 'medal_deny_modal:';

function ephemeral(content) {
  return { content, flags: MessageFlags.Ephemeral };
}

function formatDuration(ms) {
  const mins = Math.ceil(ms / 60000);
  return `${mins} minute${mins === 1 ? '' : 's'}`;
}

// ---- Panel ----------------------------------------------------------------

export async function postPanel(client, channelId = PANEL_CHANNEL_ID) {
  const channel = await client.channels.fetch(channelId);
  const optionLines = Object.values(CATALOGS)
    .map((c) => {
      const names = Object.keys(c.map)
        .map((n) => `\`${n}\``)
        .join(', ');
      return `**${c.label}s:** ${names}`;
    })
    .join('\n');
  const embed = new EmbedBuilder()
    .setTitle('Medal / Veneration Request')
    .setDescription(
      'Click the button below to submit a request. All fields are required.\n' +
        'In the "Medal Requesting" field, enter one of:\n' +
        optionLines,
    )
    .setColor(0xc8a24b);
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(APPLY_BUTTON)
      .setLabel('Submit Request')
      .setStyle(ButtonStyle.Primary),
  );
  return channel.send({ embeds: [embed], components: [row] });
}

// ---- Modal ----------------------------------------------------------------

function buildApplicationModal() {
  const modal = new ModalBuilder().setCustomId(APPLY_MODAL).setTitle('Medal / Veneration Request');
  const fields = [
    ['username', 'Username', TextInputStyle.Short],
    ['profile_link', 'Profile Link', TextInputStyle.Short],
    ['medal', 'Medal Requesting', TextInputStyle.Short],
    ['klass', 'Class of Medal', TextInputStyle.Short],
    ['proof', 'Proof', TextInputStyle.Paragraph],
  ];
  for (const [id, label, style] of fields) {
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(style).setRequired(true),
      ),
    );
  }
  return modal;
}

// ---- Review embed / messages ---------------------------------------------

function buildReviewEmbed(req, decision) {
  const catalog = getCatalog(req.type);
  const itemLabel = catalog ? catalog.label : 'Item';
  const embed = new EmbedBuilder()
    .setTitle(`${itemLabel} Request`)
    .setColor(decision === 'accepted' ? 0x2ecc71 : decision === 'denied' ? 0xe74c3c : 0xf1c40f)
    .addFields(
      { name: 'Applicant', value: `<@${req.userId}> (${req.userId})` },
      { name: 'Username', value: req.username },
      { name: 'Profile Link', value: req.profileLink },
      { name: itemLabel, value: req.medal, inline: true },
      { name: 'Class', value: req.klass, inline: true },
      { name: 'Proof', value: req.proof },
    )
    .setTimestamp(new Date(req.createdAt));

  if (decision === 'accepted') {
    embed.setFooter({ text: `Accepted by ${req.decidedBy}` });
  } else if (decision === 'denied') {
    embed.addFields({ name: 'Deny Reason', value: req.reason || 'No reason provided' });
    embed.setFooter({ text: `Denied by ${req.decidedBy}` });
  }
  return embed;
}

function buildReviewButtons(reqId, disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${ACCEPT_PREFIX}${reqId}`)
      .setLabel('Accept')
      .setStyle(ButtonStyle.Success)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId(`${DENY_PREFIX}${reqId}`)
      .setLabel('Deny')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disabled),
  );
}

async function sendReviewDMs(client, reqId) {
  const req = getRequest(reqId);
  const embed = buildReviewEmbed(req);
  const components = [buildReviewButtons(reqId)];
  for (const reviewerId of REVIEWER_IDS) {
    try {
      const user = await client.users.fetch(reviewerId);
      const msg = await user.send({ embeds: [embed], components });
      await addReviewerMessage(reqId, { channelId: msg.channelId, messageId: msg.id });
    } catch (err) {
      console.error(`Failed to DM reviewer ${reviewerId}:`, err.message);
    }
  }
}

async function updateAllReviewerMessages(client, req) {
  const embed = buildReviewEmbed(req, req.status);
  const components = [buildReviewButtons(req.id, true)];
  for (const ref of req.reviewerMessages) {
    try {
      const channel = await client.channels.fetch(ref.channelId);
      const msg = await channel.messages.fetch(ref.messageId);
      await msg.edit({ embeds: [embed], components });
    } catch (err) {
      console.error(`Failed to update reviewer message ${ref.messageId}:`, err.message);
    }
  }
}

async function dmUser(client, userId, content) {
  try {
    const user = await client.users.fetch(userId);
    await user.send(content);
  } catch (err) {
    console.error(`Failed to DM user ${userId}:`, err.message);
  }
}

// ---- Interaction routing --------------------------------------------------

export async function handleMedalInteraction(interaction, client) {
  // Open the application form.
  if (interaction.isButton() && interaction.customId === APPLY_BUTTON) {
    const remaining = getCooldownRemaining(interaction.user.id);
    if (remaining > 0) {
      await interaction.reply(
        ephemeral(
          `Your last request was denied. Please wait ${formatDuration(remaining)} before submitting another.`,
        ),
      );
      return true;
    }
    await interaction.showModal(buildApplicationModal());
    return true;
  }

  // Application form submitted.
  if (interaction.isModalSubmit() && interaction.customId === APPLY_MODAL) {
    const remaining = getCooldownRemaining(interaction.user.id);
    if (remaining > 0) {
      await interaction.reply(
        ephemeral(`Please wait ${formatDuration(remaining)} before submitting another request.`),
      );
      return true;
    }

    const username = interaction.fields.getTextInputValue('username').trim();
    const profileLink = interaction.fields.getTextInputValue('profile_link').trim();
    const medal = interaction.fields.getTextInputValue('medal').trim();
    const klass = interaction.fields.getTextInputValue('klass').trim();
    const proof = interaction.fields.getTextInputValue('proof').trim();

    const check = resolveEntry(medal, klass);
    if (!check.ok) {
      await interaction.reply(ephemeral(`Your request could not be submitted.\n${check.reason}`));
      return true;
    }

    const reqId = await createRequest({
      userId: interaction.user.id,
      username,
      profileLink,
      medal,
      klass,
      proof,
      type: check.type,
      sheetTab: check.sheetTab,
      status: check.status,
    });
    await sendReviewDMs(client, reqId);
    await interaction.reply(
      ephemeral('Your request has been submitted for review. You will be notified of the decision.'),
    );
    return true;
  }

  // Accept.
  if (interaction.isButton() && interaction.customId.startsWith(ACCEPT_PREFIX)) {
    const reqId = interaction.customId.slice(ACCEPT_PREFIX.length);
    const existing = getRequest(reqId);
    if (!existing) {
      await interaction.reply(ephemeral('This request has expired or no longer exists.'));
      return true;
    }
    if (existing.status !== 'pending') {
      await interaction.reply(ephemeral('An action has already been decided'));
      return true;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const result = await decideRequest(reqId, 'accepted', interaction.user.id);
    if (!result.won) {
      await interaction.editReply({ content: 'An action has already been decided' });
      return true;
    }

    const req = result.req;
    let sheetNote = '';
    if (sheetsEnabled()) {
      try {
        const { row, sheet } = await logApproved({
          username: req.username,
          profileLink: req.profileLink,
          item: req.medal,
          klass: req.klass,
          sheetTab: req.sheetTab,
          status: req.status,
        });
        sheetNote = ` Logged to ${sheet} row ${row}.`;
      } catch (err) {
        console.error('Failed to log to sheet:', err.message);
        sheetNote = ' (Warning: failed to write to the Google Sheet — check logs.)';
      }
    } else {
      sheetNote = ' (Google Sheet logging is not configured.)';
    }

    await dmUser(client, req.userId, `Your request (${req.medal} — ${req.klass}) was **approved**.`);
    await updateAllReviewerMessages(client, req);
    await interaction.editReply({ content: `Request accepted.${sheetNote}` });
    return true;
  }

  // Deny -> open reason modal.
  if (interaction.isButton() && interaction.customId.startsWith(DENY_PREFIX)) {
    const reqId = interaction.customId.slice(DENY_PREFIX.length);
    const existing = getRequest(reqId);
    if (!existing) {
      await interaction.reply(ephemeral('This request has expired or no longer exists.'));
      return true;
    }
    if (existing.status !== 'pending') {
      await interaction.reply(ephemeral('An action has already been decided'));
      return true;
    }
    const modal = new ModalBuilder()
      .setCustomId(`${DENY_MODAL_PREFIX}${reqId}`)
      .setTitle('Deny Reason')
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('reason')
            .setLabel('Reason for denial')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true),
        ),
      );
    await interaction.showModal(modal);
    return true;
  }

  // Deny reason submitted.
  if (interaction.isModalSubmit() && interaction.customId.startsWith(DENY_MODAL_PREFIX)) {
    const reqId = interaction.customId.slice(DENY_MODAL_PREFIX.length);
    const reason = interaction.fields.getTextInputValue('reason').trim();

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const result = await decideRequest(reqId, 'denied', interaction.user.id, reason);
    if (!result.won) {
      await interaction.editReply({
        content: result.missing
          ? 'This request has expired or no longer exists.'
          : 'An action has already been decided',
      });
      return true;
    }

    const req = result.req;
    await setDenyCooldown(req.userId);
    await dmUser(
      client,
      req.userId,
      `Your request (${req.medal} — ${req.klass}) was **denied**.\nReason: ${reason}\nYou may submit a new request in 30 minutes.`,
    );
    await updateAllReviewerMessages(client, req);
    await interaction.editReply({ content: 'Request denied and the applicant has been notified.' });
    return true;
  }

  return false;
}
