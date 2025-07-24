const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, ChannelType } = require('discord.js');
const { GuildSettings } = require('../schemas.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket-setup')
        .setDescription('Sets up the ticket system')
        .addChannelOption(option =>
            option.setName('category')
                .setDescription('Category for ticket channels')
                .addChannelTypes(ChannelType.GuildCategory)
                .setRequired(true))
        .addRoleOption(option =>
            option.setName('support')
                .setDescription('Support team role')
                .setRequired(true))
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Channel for the ticket button')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('description')
                .setDescription('Text above the ticket button')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('maxtickets')
                .setDescription('Maximum number of open tickets per user')
                .setMinValue(1)
                .setMaxValue(5))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        try {
            const category = interaction.options.getChannel('category');
            const supportRole = interaction.options.getRole('support');
            const channel = interaction.options.getChannel('channel');
            const description = interaction.options.getString('description');
            const maxTickets = interaction.options.getInteger('maxtickets') || 1;

            // Überprüfe Berechtigungen
            if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) {
                return interaction.reply({
                    content: '❌ I need the "Manage Channels" permission!',
                    flags: MessageFlags.Ephemeral
                });
            }

            // Erstelle Button-Nachricht
            const buttonEmbed = new EmbedBuilder()
                .setTitle('🎫 Support Ticket')
                .setDescription(description)
                .setColor('#00ff00')
                .setTimestamp();

            const button = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('create_ticket')
                        .setLabel('Create Ticket')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('🎫')
                );

            const msg = await channel.send({
                embeds: [buttonEmbed],
                components: [button]
            });

            // Speichere Einstellungen
            await GuildSettings.findOneAndUpdate(
                { guildId: interaction.guild.id },
                {
                    $set: {
                        'tickets.enabled': true,
                        'tickets.categoryId': category.id,
                        'tickets.supportRoleId': supportRole.id,
                        'tickets.maxTickets': maxTickets,
                        'tickets.buttonMessage': msg.id
                    }
                },
                { upsert: true }
            );

            const setupEmbed = new EmbedBuilder()
                .setTitle('✅ Ticket System Setup')
                .addFields(
                    { name: 'Category', value: category.toString(), inline: true },
                    { name: 'Support Role', value: supportRole.toString(), inline: true },
                    { name: 'Max. Tickets', value: maxTickets.toString(), inline: true }
                )
                .setColor('#00ff00')
                .setTimestamp();

            await interaction.reply({
                embeds: [setupEmbed],
                flags: MessageFlags.Ephemeral
            });

        } catch (error) {
            console.error('Ticket Setup Fehler:', error);
            await interaction.reply({
                content: '❌ Error setting up the ticket system!',
                flags: MessageFlags.Ephemeral
            });
        }
    },
}; 