const { GuildSettings } = require('../schemas.js');
const { logModAction } = require('./logger.js');

class AutoMod {
    constructor() {
        this.spamMap = new Map(); // userId_guildId -> [timestamps]
    }

    async processMessage(message) {
        if (message.author.bot || !message.guild) return;

        const settings = await GuildSettings.findOne({ guildId: message.guild.id });
        if (!settings?.automod?.enabled) return;

        const violations = [];

        // Wortfilter
        if (settings.automod.bannedWords?.length > 0) {
            const content = message.content.toLowerCase();
            const foundWords = settings.automod.bannedWords.filter(word => 
                content.includes(word.toLowerCase())
            );
            if (foundWords.length > 0) {
                violations.push(`Verbotene Wörter: ${foundWords.join(', ')}`);
            }
        }

        // Spam-Erkennung
        const spamKey = `${message.author.id}_${message.guild.id}`;
        const now = Date.now();
        const userMessages = this.spamMap.get(spamKey) || [];
        
        // Entferne alte Nachrichten (älter als 5 Sekunden)
        const recentMessages = userMessages.filter(timestamp => 
            now - timestamp < 5000
        );
        recentMessages.push(now);
        this.spamMap.set(spamKey, recentMessages);

        if (recentMessages.length >= settings.automod.spamThreshold) {
            violations.push('Spam erkannt');
            this.spamMap.delete(spamKey);
        }

        // CAPS-Lock Erkennung
        const capsPercentage = (message.content.match(/[A-Z]/g)?.length || 0) / 
            message.content.length * 100;
        if (message.content.length > 10 && capsPercentage > settings.automod.capsThreshold) {
            violations.push('Übermäßige Großbuchstaben');
        }

        // Link-Filter
        if (settings.automod.linkFilter?.enabled) {
            const urlRegex = /(https?:\/\/[^\s]+)/g;
            const links = message.content.match(urlRegex);
            
            if (links) {
                if (settings.automod.linkFilter.mode === 'blacklist') {
                    const blacklistedLinks = links.some(link => 
                        settings.automod.linkFilter.domains.some(domain => 
                            link.includes(domain)
                        )
                    );
                    if (blacklistedLinks) {
                        violations.push('Nicht erlaubte Links');
                    }
                } else { // whitelist mode
                    const allowedLinks = links.every(link => 
                        settings.automod.linkFilter.domains.some(domain => 
                            link.includes(domain)
                        )
                    );
                    if (!allowedLinks) {
                        violations.push('Nicht erlaubte Links');
                    }
                }
            }
        }

        // Mention-Spam Schutz
        const mentions = message.mentions.users.size + message.mentions.roles.size;
        if (mentions > settings.automod.maxMentions) {
            violations.push('Zu viele Erwähnungen');
        }

        // Emoji-Spam Erkennung
        const emojiRegex = /<a?:.+?:\d+>|[\u{1f300}-\u{1f5ff}\u{1f900}-\u{1f9ff}\u{1f600}-\u{1f64f}\u{1f680}-\u{1f6ff}\u{2600}-\u{26ff}\u{2700}-\u{27bf}\u{1f1e6}-\u{1f1ff}\u{1f191}-\u{1f251}\u{1f004}\u{1f0cf}\u{1f170}-\u{1f171}\u{1f17e}-\u{1f17f}\u{1f18e}\u{3030}\u{2b50}\u{2b55}\u{2934}-\u{2935}\u{2b05}-\u{2b07}\u{2b1b}-\u{2b1c}\u{3297}\u{3299}\u{303d}\u{00a9}\u{00ae}\u{2122}\u{23f3}\u{24c2}\u{23e9}-\u{23ef}\u{25b6}\u{23f8}-\u{23fa}]/gu;
        const emojiCount = (message.content.match(emojiRegex) || []).length;
        
        if (emojiCount > settings.automod.maxEmojis) {
            violations.push('Zu viele Emojis');
        }

        if (violations.length > 0) {
            await this.punishUser(message, violations.join(', '), settings.automod);
            await message.delete().catch(() => {});
        }
    }

    async punishUser(message, reason, automodSettings) {
        const { punishmentType, muteDuration } = automodSettings;

        try {
            switch (punishmentType) {
                case 'warn':
                    await logModAction(message.guild, {
                        action: 'AutoMod Warnung',
                        moderator: message.client.user,
                        target: message.author,
                        reason: reason,
                        color: '#ffa500'
                    });
                    break;

                case 'mute':
                    const timeInMs = muteDuration
                        .replace('d', '*24*60*60*1000')
                        .replace('h', '*60*60*1000')
                        .replace('m', '*60*1000')
                        .split('*')
                        .reduce((a, b) => a * b);

                    await message.member.timeout(timeInMs, `AutoMod: ${reason}`);
                    await logModAction(message.guild, {
                        action: 'AutoMod Timeout',
                        moderator: message.client.user,
                        target: message.author,
                        reason: reason,
                        duration: muteDuration,
                        color: '#ff0000'
                    });
                    break;

                case 'kick':
                    await message.member.kick(`AutoMod: ${reason}`);
                    await logModAction(message.guild, {
                        action: 'AutoMod Kick',
                        moderator: message.client.user,
                        target: message.author,
                        reason: reason,
                        color: '#ff0000'
                    });
                    break;
            }
        } catch (error) {
            console.error('AutoMod Bestrafungs-Fehler:', error);
        }
    }
}

module.exports = new AutoMod(); 