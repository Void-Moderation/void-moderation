const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
const { GuildSettings } = require('../schemas.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('autorole')
        .setDescription('Manages automatic roles')
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Adds an automatic role')
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('The role to assign automatically')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Removes an automatic role')
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('The role to remove')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('Shows all automatic roles'))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

    async execute(interaction) {
        try {
            const subcommand = interaction.options.getSubcommand();
            let settings = await GuildSettings.findOne({ guildId: interaction.guild.id });
            
            if (!settings) {
                settings = new GuildSettings({ guildId: interaction.guild.id });
            }

            switch (subcommand) {
                case 'add': {
                    const role = interaction.options.getRole('role');

                    // Überprüfe Bot-Berechtigungen
                    if (role.position >= interaction.guild.members.me.roles.highest.position) {
                        return interaction.reply({
                            content: '❌ This role is too high in the hierarchy!',
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    // Überprüfe ob Rolle bereits in der Liste ist
                    if (settings.autoRoles.includes(role.id)) {
                        return interaction.reply({
                            content: '❌ This role is already an auto-role!',
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    settings.autoRoles.push(role.id);
                    await settings.save();

                    await interaction.reply({
                        content: `✅ ${role} has been added as auto-role!`,
                        flags: MessageFlags.Ephemeral
                    });
                    break;
                }

                case 'remove': {
                    const role = interaction.options.getRole('role');
                    
                    if (!settings.autoRoles.includes(role.id)) {
                        return interaction.reply({
                            content: '❌ This role is not an auto-role!',
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    settings.autoRoles = settings.autoRoles.filter(id => id !== role.id);
                    await settings.save();

                    await interaction.reply({
                        content: `✅ ${role} has been removed as auto-role!`,
                        flags: MessageFlags.Ephemeral
                    });
                    break;
                }

                case 'list': {
                    if (!settings.autoRoles.length) {
                        return interaction.reply({
                            content: '❌ No auto-roles configured!',
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    const roles = settings.autoRoles
                        .map(id => interaction.guild.roles.cache.get(id))
                        .filter(role => role) // Filtere gelöschte Rollen
                        .map(role => `• ${role.name}`);

                    const embed = new EmbedBuilder()
                        .setTitle('🔄 Automatic Roles')
                        .setDescription(roles.join('\n'))
                        .setColor('#00ff00')
                        .setTimestamp();

                    await interaction.reply({
                        embeds: [embed],
                        flags: MessageFlags.Ephemeral
                    });
                    break;
                }
            }

        } catch (error) {
            console.error('Autorole Fehler:', error);
            await interaction.reply({
                content: '❌ Error in role management!',
                flags: MessageFlags.Ephemeral
            });
        }
    },
}; 