const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { logModAction } = require('../utils/logger.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Kicks a user from the server')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to kick')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the kick')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

    async execute(interaction) {
        const target = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason');

        try {
            const member = await interaction.guild.members.fetch(target.id);

            // Überprüfe Rollen-Hierarchie
            if (member.roles.highest.position >= interaction.member.roles.highest.position) {
                return interaction.reply({
                    content: '❌ You cannot kick members with higher/equal roles!',
                    ephemeral: true
                });
            }

            // DM vor dem Kick
            await member.send({
                content: `📢 You have been kicked from **${interaction.guild.name}**!\n`
                    + `Reason: ${reason}`
            }).catch(() => null);

            await member.kick(reason);

            // Logging hinzufügen
            await logModAction(interaction.guild, {
                action: 'Kick',
                moderator: interaction.user,
                target: target,
                reason: reason,
                color: '#ffa500'
            });

            await interaction.reply({
                content: `✅ ${target.tag} has been kicked!\n`
                    + `Reason: ${reason}`,
                ephemeral: false
            });

        } catch (error) {
            console.error('Kick Fehler:', error);
            await interaction.reply({
                content: '❌ Error kicking the user!',
                ephemeral: true
            });
        }
    },
}; 