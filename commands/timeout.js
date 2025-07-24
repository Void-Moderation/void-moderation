const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { logModAction } = require('../utils/logger.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('timeout')
        .setDescription('Timeouts a user')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to timeout')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('duration')
                .setDescription('Timeout duration (1m, 1h, 1d)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for timeout')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        const target = interaction.options.getUser('user');
        const duration = interaction.options.getString('duration');
        const reason = interaction.options.getString('reason');
        
        // Konvertiere Zeitstring in Millisekunden
        const timeInMs = duration
            .replace('d', '*24*60*60*1000')
            .replace('h', '*60*60*1000')
            .replace('m', '*60*1000')
            .split('*')
            .reduce((a, b) => a * b);

        if (isNaN(timeInMs) || timeInMs > 2419200000) { // Max 28 Tage
            return interaction.reply({
                content: '❌ Invalid duration! Use format: 1m, 1h, 1d (max 28d)',
                ephemeral: true
            });
        }

        try {
            const member = await interaction.guild.members.fetch(target.id);
            
            // Überprüfe Rollen-Hierarchie
            if (member.roles.highest.position >= interaction.member.roles.highest.position) {
                return interaction.reply({
                    content: '❌ You cannot timeout members with higher/equal roles!',
                    ephemeral: true
                });
            }

            await member.timeout(timeInMs, reason);
            
            // DM an den Benutzer
            await member.send({
                content: `📢 You have been timed out on **${interaction.guild.name}** for ${duration}!\n`
                    + `Reason: ${reason}`
            }).catch(() => null);

            // Logging hinzufügen
            await logModAction(interaction.guild, {
                action: 'Timeout',
                moderator: interaction.user,
                target: target,
                reason: reason,
                duration: duration,
                color: '#ffff00'
            });

            await interaction.reply({
                content: `✅ ${target.tag} has been timed out for ${duration}!\n`
                    + `Reason: ${reason}`,
                ephemeral: false
            });

        } catch (error) {
            console.error('Timeout Fehler:', error);
            await interaction.reply({
                content: '❌ Error during timeout!',
                ephemeral: true
            });
        }
    },
}; 