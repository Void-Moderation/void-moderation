const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
const { GuildSettings, Mute } = require('../schemas.js');
const { logModAction } = require('../utils/logger.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unmute')
        .setDescription('Unmutes a user')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for unmute')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        try {
            const target = interaction.options.getUser('user');
            const reason = interaction.options.getString('reason') || 'Keine Begründung angegeben';
            
            // Überprüfe Bot-Berechtigungen
            if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ModerateMembers)) {
                return interaction.reply({
                    content: '❌ I need the "Moderate Members" permission!',
                    flags: MessageFlags.Ephemeral
                });
            }

            const member = await interaction.guild.members.fetch(target.id);
            const settings = await GuildSettings.findOne({ guildId: interaction.guild.id });

            // Prüfe ob der Benutzer gemuted ist
            const activeMute = await Mute.findOne({
                guildId: interaction.guild.id,
                userId: target.id,
                active: true
            });

            if (!activeMute && !member.isCommunicationDisabled()) {
                return interaction.reply({
                    content: '❌ This user is not muted!',
                    flags: MessageFlags.Ephemeral
                });
            }

            // Führe Unmute aus
            if (settings?.muteSystem?.useTimeout) {
                await member.timeout(null, `Unmute: ${reason} (durch ${interaction.user.tag})`);
            } else if (settings?.muteSystem?.timeoutRoleId) {
                const muteRole = await interaction.guild.roles.fetch(settings.muteSystem.timeoutRoleId);
                if (muteRole) {
                    await member.roles.remove(muteRole, `Unmute: ${reason} (durch ${interaction.user.tag})`);
                }
            }

            // Update Mute-Status in der Datenbank
            if (activeMute) {
                activeMute.active = false;
                await activeMute.save();
            }

            // Erstelle Bestätigungs-Embed
            const embed = new EmbedBuilder()
                .setTitle('🔊 Unmuted')
                .setDescription(`${target.tag} has been unmuted.`)
                .addFields(
                    { name: 'Reason', value: reason }
                )
                .setColor('#00ff00')
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

            // Logging
            await logModAction(interaction.guild, {
                action: 'Unmute',
                moderator: interaction.user,
                target: target,
                reason: reason,
                color: '#00ff00'
            });

            // Benachrichtige den Benutzer
            try {
                const dmEmbed = new EmbedBuilder()
                    .setTitle('🔊 Unmuted')
                    .setDescription(`Your mute on ${interaction.guild.name} has been lifted.`)
                    .addFields(
                        { name: 'Reason', value: reason }
                    )
                    .setColor('#00ff00')
                    .setTimestamp();

                await target.send({ embeds: [dmEmbed] });
            } catch (error) {
                console.log('Konnte DM nicht senden:', error);
            }

        } catch (error) {
            console.error('Unmute Fehler:', error);
            await interaction.reply({
                content: '❌ Error while unmuting!',
                flags: MessageFlags.Ephemeral
            });
        }
    },
}; 