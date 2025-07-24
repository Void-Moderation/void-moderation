const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { logModAction } = require('../utils/logger.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Bans a user from the server')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to ban')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the ban')
                .setRequired(true))
        .addNumberOption(option =>
            option.setName('days')
                .setDescription('Number of days of messages to delete (0-7)')
                .setMinValue(0)
                .setMaxValue(7))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    async execute(interaction) {
        const target = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason');
        const days = interaction.options.getNumber('days') ?? 0;

        try {
            const member = await interaction.guild.members.fetch(target.id);

            // Überprüfe Rollen-Hierarchie
            if (member.roles.highest.position >= interaction.member.roles.highest.position) {
                return interaction.reply({
                    content: '❌ You cannot ban members with higher/equal roles!',
                    ephemeral: true
                });
            }

            // DM vor dem Bann
            await member.send({
                content: `📢 You have been banned from **${interaction.guild.name}**!\n`
                    + `Reason: ${reason}`
            }).catch(() => null);

            await member.ban({ 
                deleteMessageDays: days,
                reason: reason
            });

            // Logging hinzufügen
            await logModAction(interaction.guild, {
                action: 'Bann',
                moderator: interaction.user,
                target: target,
                reason: reason,
                color: '#ff0000'
            });

            await interaction.reply({
                content: `✅ ${target.tag} has been banned!\n`
                    + `Reason: ${reason}\n`
                    + `Deleted Messages: ${days} days`,
                ephemeral: false
            });

        } catch (error) {
            console.error('Ban Fehler:', error);
            await interaction.reply({
                content: '❌ Error banning the user!',
                ephemeral: true
            });
        }
    },
}; 