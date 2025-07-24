const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags, ChannelType } = require('discord.js');
const { logModAction } = require('../utils/logger.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lockdown')
        .setDescription('Locks/Unlocks channels for normal users')
        .addSubcommand(subcommand =>
            subcommand
                .setName('enable')
                .setDescription('Enables lockdown')
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Reason for lockdown')
                        .setRequired(true))
                .addBooleanOption(option =>
                    option.setName('all_channels')
                        .setDescription('Lock all channels? (Default: text channels only)')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('exceptions')
                        .setDescription('Channel IDs to exclude (comma separated)')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('disable')
                .setDescription('Disables lockdown')
                .addStringOption(option =>
                    option.setName('exceptions')
                        .setDescription('Channel IDs to exclude (comma separated)')
                        .setRequired(false)))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    async execute(interaction) {
        try {
            const subcommand = interaction.options.getSubcommand();
            
            // Überprüfe Bot-Berechtigungen
            if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) {
                return interaction.reply({
                    content: '❌ I need the "Manage Channels" permission!',
                    flags: MessageFlags.Ephemeral
                });
            }

            await interaction.deferReply();

            const results = {
                success: [],
                failed: [],
                skipped: []
            };

            // Hole @everyone Rolle
            const everyoneRole = interaction.guild.roles.everyone;

            // Verarbeite Ausnahmen
            const exceptionsString = interaction.options.getString('exceptions');
            const exceptions = exceptionsString ? exceptionsString.split(',').map(id => id.trim()) : [];

            // Bestimme zu bearbeitende Kanäle
            const allChannels = interaction.guild.channels.cache.filter(channel => {
                // Überspringe ausgenommene Kanäle
                if (exceptions.includes(channel.id)) {
                    results.skipped.push(channel.name);
                    return false;
                }

                if (subcommand === 'enable' && !interaction.options.getBoolean('all_channels')) {
                    return channel.type === ChannelType.GuildText;
                }
                return channel.type === ChannelType.GuildText || 
                       channel.type === ChannelType.GuildVoice ||
                       channel.type === ChannelType.GuildForum ||
                       channel.type === ChannelType.GuildAnnouncement;
            });

            for (const channel of allChannels.values()) {
                try {
                    if (subcommand === 'enable') {
                        await channel.permissionOverwrites.edit(everyoneRole, {
                            SendMessages: false,
                            AddReactions: false,
                            CreatePublicThreads: false,
                            CreatePrivateThreads: false,
                            SendMessagesInThreads: false,
                            Connect: false
                        });
                        results.success.push(channel.name);
                    } else {
                        // Entferne die Überschreibungen für @everyone
                        const overwrites = channel.permissionOverwrites.cache.get(everyoneRole.id);
                        if (overwrites) {
                            await overwrites.delete();
                        }
                        results.success.push(channel.name);
                    }
                } catch (error) {
                    console.error(`Lockdown Fehler in Kanal ${channel.name}:`, error);
                    results.failed.push(channel.name);
                }
            }

            // Erstelle Bestätigungs-Embed
            const embed = new EmbedBuilder()
                .setTitle(subcommand === 'enable' ? '🔒 Lockdown Enabled' : '🔓 Lockdown Disabled')
                .setColor(subcommand === 'enable' ? '#ff0000' : '#00ff00')
                .setTimestamp();

            if (results.success.length) {
                embed.addFields({
                    name: '✅ Successfully processed',
                    value: results.success.join(', ').slice(0, 1024)
                });
            }

            if (results.skipped.length) {
                embed.addFields({
                    name: '⏭️ Skipped (Exceptions)',
                    value: results.skipped.join(', ').slice(0, 1024)
                });
            }

            if (results.failed.length) {
                embed.addFields({
                    name: '❌ Failed',
                    value: results.failed.join(', ').slice(0, 1024)
                });
            }

            if (subcommand === 'enable') {
                const reason = interaction.options.getString('reason');
                embed.setDescription(`Reason: ${reason}`);

                // Sende Ankündigung in System-Kanal falls vorhanden
                const systemChannel = interaction.guild.systemChannel;
                if (systemChannel) {
                    const announcement = new EmbedBuilder()
                        .setTitle('🚨 Server Lockdown')
                        .setDescription(`The server is now in lockdown.\nReason: ${reason}`)
                        .setColor('#ff0000')
                        .setTimestamp();

                    await systemChannel.send({ embeds: [announcement] });
                }

                // Logging
                await logModAction(interaction.guild, {
                    action: 'Lockdown aktiviert',
                    moderator: interaction.user,
                    reason: reason,
                    color: '#ff0000'
                });
            } else {
                // Logging für Deaktivierung
                await logModAction(interaction.guild, {
                    action: 'Lockdown deaktiviert',
                    moderator: interaction.user,
                    reason: 'Lockdown aufgehoben',
                    color: '#00ff00'
                });
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Lockdown Fehler:', error);
            const reply = interaction.deferred 
                ? interaction.editReply.bind(interaction)
                : interaction.reply.bind(interaction);
                
            await reply({
                content: '❌ Error executing lockdown!',
                flags: MessageFlags.Ephemeral
            });
        }
    },
}; 