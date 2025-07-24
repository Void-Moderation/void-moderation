const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
const { GuildSettings, Mute } = require('../schemas.js');
const { logModAction } = require('../utils/logger.js');
const ms = require('ms');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mute')
        .setDescription('Temporarily mutes a user')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to mute')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('duration')
                .setDescription('Duration of the mute (e.g. 30m, 1h, 1d)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the mute')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        try {
            const target = interaction.options.getUser('user');
            const durationStr = interaction.options.getString('duration');
            const reason = interaction.options.getString('reason');
            
            // Überprüfe Bot-Berechtigungen
            if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ModerateMembers)) {
                return interaction.reply({
                    content: '❌ I need the "Moderate Members" permission!',
                    flags: MessageFlags.Ephemeral
                });
            }

            // Parse Dauer
            const duration = ms(durationStr);
            if (!duration || duration < 60000 || duration > 2419200000) { // Zwischen 1 Minute und 28 Tagen
                return interaction.reply({
                    content: '❌ Invalid duration! Use e.g. 30m, 12h, 7d (max. 28 days)',
                    flags: MessageFlags.Ephemeral
                });
            }

            const member = await interaction.guild.members.fetch(target.id);

            // Überprüfe Rollen-Hierarchie
            if (member.roles.highest.position >= interaction.member.roles.highest.position) {
                return interaction.reply({
                    content: '❌ You cannot mute users with a higher or equal role!',
                    flags: MessageFlags.Ephemeral
                });
            }

            const settings = await GuildSettings.findOne({ guildId: interaction.guild.id });

            // Führe Timeout/Mute aus
            if (settings?.muteSystem?.useTimeout) {
                await member.timeout(duration, `${reason} (durch ${interaction.user.tag})`);
            } else if (settings?.muteSystem?.timeoutRoleId) {
                const muteRole = await interaction.guild.roles.fetch(settings.muteSystem.timeoutRoleId);
                if (muteRole) {
                    await member.roles.add(muteRole, `${reason} (durch ${interaction.user.tag})`);
                } else {
                    return interaction.reply({
                        content: '❌ Die Mute-Rolle wurde nicht gefunden!',
                        flags: MessageFlags.Ephemeral
                    });
                }
            } else {
                return interaction.reply({
                    content: '❌ The mute system is not configured!',
                    flags: MessageFlags.Ephemeral
                });
            }

            // Speichere Mute in der Datenbank
            const mute = new Mute({
                guildId: interaction.guild.id,
                userId: target.id,
                moderatorId: interaction.user.id,
                reason: reason,
                duration: duration,
                endTime: new Date(Date.now() + duration)
            });
            await mute.save();

            // Erstelle Bestätigungs-Embed
            const embed = new EmbedBuilder()
                .setTitle('🔇 User Muted')
                .setDescription(`${target.tag} has been muted.`)
                .addFields(
                    { name: 'Reason', value: reason },
                    { name: 'Duration', value: durationStr },
                    { name: 'Ends', value: `<t:${Math.floor((Date.now() + duration) / 1000)}:R>` }
                )
                .setColor('#ffa500')
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

            // Logging
            await logModAction(interaction.guild, {
                action: 'Temporäre Stummschaltung',
                moderator: interaction.user,
                target: target,
                reason: `${reason} (${durationStr})`,
                color: '#ffa500'
            });

            // Benachrichtige den Benutzer
            try {
                const dmEmbed = new EmbedBuilder()
                    .setTitle('🔇 You Have Been Muted')
                    .setDescription(`You have been muted on ${interaction.guild.name}.`)
                    .addFields(
                        { name: 'Reason', value: reason },
                        { name: 'Duration', value: durationStr },
                        { name: 'Ends', value: `<t:${Math.floor((Date.now() + duration) / 1000)}:R>` }
                    )
                    .setColor('#ffa500')
                    .setTimestamp();

                await target.send({ embeds: [dmEmbed] });
            } catch (error) {
                console.log('Konnte DM nicht senden:', error);
            }

        } catch (error) {
            console.error('Mute Fehler:', error);
            await interaction.reply({
                content: '❌ Error while muting!',
                flags: MessageFlags.Ephemeral
            });
        }
    },
}; 