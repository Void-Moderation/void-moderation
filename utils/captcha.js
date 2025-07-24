const { EmbedBuilder } = require('discord.js');

class CaptchaGenerator {
    generateCode() {
        const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        
        const embed = new EmbedBuilder()
            .setTitle('🔐 Verifizierungs-Code')
            .setDescription('```\n' + code + '\n```')
            .addFields({
                name: 'Anleitung',
                value: 'Gib diesen Code im nächsten Fenster ein, um dich zu verifizieren.'
            })
            .setColor('#00ff00')
            .setFooter({ text: 'Dieser Code ist nur für diese Verifizierung gültig.' })
            .setTimestamp();

        return { code, embed };
    }
}

module.exports = new CaptchaGenerator(); 