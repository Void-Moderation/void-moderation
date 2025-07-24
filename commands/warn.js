const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
const { logModAction } = require('../utils/logger.js');
const warnManager = require('../utils/warnManager.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Warns a user')
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Warns a user')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user to warn')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Reason for the warning')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('Shows warnings of a user')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user')
                        .setRequired(true)))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const target = interaction.options.getUser('user');
        const moderator = interaction.user;
        
        // Überprüfe Berechtigungen
        if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
            return interaction.reply({
                content: '❌ You do not have permission to issue warnings!',
                flags: MessageFlags.Ephemeral
            });
        }

        // Überprüfe, ob der Bot über dem zu verwarnenden Benutzer steht
        const targetMember = await interaction.guild.members.fetch(target.id);
        if (targetMember.roles.highest.position >= interaction.guild.members.me.roles.highest.position) {
            return interaction.reply({
                content: '❌ I cannot warn users with a higher or equal role than me!',
                ephemeral: true
            });
        }

        // Überprüfe, ob der Moderator über dem zu verwarnenden Benutzer steht
        if (targetMember.roles.highest.position >= interaction.member.roles.highest.position) {
            return interaction.reply({
                content: '❌ You cannot warn users with a higher or equal role than you!',
                ephemeral: true
            });
        }

        try {
            switch (subcommand) {
                case 'add': {
                    const grund = interaction.options.getString('reason');
                    const result = await warnManager.processWarning(interaction, target, grund);
                    
                    if (!result) {
                        return interaction.reply({
                            content: '❌ Warning system is not activated!',
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    // Bestätigung im Channel
                    const confirmEmbed = new EmbedBuilder()
                        .setTitle('⚠️ Warning Issued')
                        .setDescription(`${target.tag} has been warned.`)
                        .addFields(
                            { name: 'Reason', value: grund },
                            { name: 'Warnings', value: result.warnCount.toString() }
                        )
                        .setColor('#ffa500')
                        .setTimestamp();

                    if (result.action) {
                        confirmEmbed.addFields({
                            name: 'Automatic Action',
                            value: `${result.action}${result.duration ? ` for ${result.duration}` : ''}`
                        });
                    }

                    await interaction.reply({ embeds: [confirmEmbed] });

                    // Logging
                    await logModAction(interaction.guild, {
                        action: 'Warning',
                        moderator: moderator,
                        target: target,
                        reason: grund,
                        color: '#ffa500'
                    });
                    break;
                }

                case 'list': {
                    const embed = await warnManager.getWarnList(interaction.guild.id, target.id);
                    if (!embed) {
                        return interaction.reply({
                            content: '❌ Error retrieving warnings!',
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    await interaction.reply({ embeds: [embed] });
                    break;
                }
            }

        } catch (error) {
            console.error('Warn Fehler:', error);
            await interaction.reply({
                content: '❌ Error while warning!',
                flags: MessageFlags.Ephemeral
            });
        }
    },
}; 