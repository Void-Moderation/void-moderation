const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
const backupManager = require('../utils/backupManager.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('backup')
        .setDescription('Manages server backups')
        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('Creates a new backup')
                .addStringOption(option =>
                    option.setName('grund')
                        .setDescription('Reason for the backup')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('Shows available backups'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('restore')
                .setDescription('Restores a backup')
                .addStringOption(option =>
                    option.setName('datei')
                        .setDescription('Name of the backup file')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('delete')
                .setDescription('Deletes a backup')
                .addStringOption(option =>
                    option.setName('datei')
                        .setDescription('Name of the backup file')
                        .setRequired(true)))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        try {
            const subcommand = interaction.options.getSubcommand();

            switch (subcommand) {
                case 'create': {
                    const reason = interaction.options.getString('grund');
                    await interaction.deferReply();

                    const fileName = await backupManager.createBackup(interaction.guild, reason);
                    
                    const embed = new EmbedBuilder()
                        .setTitle('💾 Backup created')
                        .setDescription(`Backup created successfully.\nFile: \`${fileName}\``)
                        .addFields({ name: 'Reason', value: reason })
                        .setColor('#00ff00')
                        .setTimestamp();

                    await interaction.editReply({ embeds: [embed] });
                    break;
                }

                case 'list': {
                    const backups = await backupManager.listBackups(interaction.guild.id);
                    
                    const embed = new EmbedBuilder()
                        .setTitle('📋 Available Backups')
                        .setColor('#00ff00')
                        .setTimestamp();

                    if (backups.length > 0) {
                        embed.setDescription(
                            backups.map(backup => 
                                `\`${backup.fileName}\` - Created: ${backup.timestamp}`
                            ).join('\n')
                        );
                    } else {
                        embed.setDescription('No backups available');
                    }

                    await interaction.reply({ embeds: [embed] });
                    break;
                }

                case 'restore': {
                    const fileName = interaction.options.getString('datei');
                    await interaction.deferReply();

                    await backupManager.restoreBackup(interaction.guild, fileName);
                    
                    const embed = new EmbedBuilder()
                        .setTitle('♻️ Backup restored')
                        .setDescription(`Backup \`${fileName}\` restored successfully.`)
                        .setColor('#00ff00')
                        .setTimestamp();

                    await interaction.editReply({ embeds: [embed] });
                    break;
                }

                case 'delete': {
                    const fileName = interaction.options.getString('datei');
                    
                    await backupManager.deleteBackup(fileName);
                    
                    const embed = new EmbedBuilder()
                        .setTitle('🗑️ Backup deleted')
                        .setDescription(`Backup \`${fileName}\` deleted successfully.`)
                        .setColor('#ff0000')
                        .setTimestamp();

                    await interaction.reply({ embeds: [embed] });
                    break;
                }
            }

        } catch (error) {
            console.error('Backup Command Error:', error);
            const reply = interaction.deferred 
                ? interaction.editReply.bind(interaction)
                : interaction.reply.bind(interaction);
                
            await reply({
                content: '❌ Error managing backups!',
                flags: MessageFlags.Ephemeral
            });
        }
    },
}; 