const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
const { logModAction } = require('../utils/logger.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('softban')
        .setDescription('Kicks a user and deletes their messages')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to softban')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the softban')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('days')
                .setDescription('Delete messages from last X days (1-7)')
                .setMinValue(1)
                .setMaxValue(7)
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    async execute(interaction) {
        try {
            const target = interaction.options.getUser('user');
            const reason = interaction.options.getString('reason');
            const days = interaction.options.getInteger('days') || 1;
            
            // Überprüfe Bot-Berechtigungen
            if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.BanMembers)) {
                return interaction.reply({
                    content: '❌ I need the "Ban Members" permission!',
                    flags: MessageFlags.Ephemeral
                });
            }

            const member = await interaction.guild.members.fetch(target.id);

            // Überprüfe Rollen-Hierarchie
            if (member.roles.highest.position >= interaction.member.roles.highest.position) {
                return interaction.reply({
                    content: '❌ You cannot softban users with higher/equal roles!',
                    flags: MessageFlags.Ephemeral
                });
            }

            if (member.roles.highest.position >= interaction.guild.members.me.roles.highest.position) {
                return interaction.reply({
                    content: '❌ I cannot softban users with higher/equal roles!',
                    flags: MessageFlags.Ephemeral
                });
            }

            // Führe Softban aus (Ban + Unban)
            await member.ban({
                deleteMessageSeconds: days * 24 * 60 * 60,
                reason: `Softban: ${reason} (durch ${interaction.user.tag})`
            });

            await interaction.guild.bans.remove(target.id, `Softban: Automatischer Unban`);

            // Erstelle Bestätigungs-Embed
            const embed = new EmbedBuilder()
                .setTitle('🔄 Softban Executed')
                .setDescription(`${target.tag} has been softbanned.`)
                .addFields(
                    { name: 'Reason', value: reason },
                    { name: 'Messages Deleted', value: `${days} days` }
                )
                .setColor('#ffa500')
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

            // Logging
            await logModAction(interaction.guild, {
                action: 'Softban',
                moderator: interaction.user,
                target: target,
                reason: reason,
                color: '#ffa500'
            });

        } catch (error) {
            console.error('Softban Fehler:', error);
            await interaction.reply({
                content: '❌ Error executing softban!',
                flags: MessageFlags.Ephemeral
            });
        }
    },
}; 