require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const fs = require('fs');

// ==========================================
// 🌐 ส่วนที่ 1: ระบบจำลองเว็บไซต์ (กันบอทหลับ)
// ==========================================
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('บอทกำลังทำงานอยู่จ้า! (ระบบกันหลับทำงานปกติ)');
});

app.listen(port, () => {
    console.log(`🌍 เว็บจำลองสำหรับกันหลับ รันที่พอร์ต ${port}`);
});

// ==========================================
// 🤖 ส่วนที่ 2: ระบบบอท Discord หลัก
// ==========================================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// 📌 ใส่ ID ห้องแชทที่จะให้แจ้งเตือนเข้า-ออก
const LOG_CHANNEL_ID = '1499430462664478814'; 

const joinTimes = new Map();
const dataFile = './voiceData.json';

let voiceTimeData = {};
if (fs.existsSync(dataFile)) {
    voiceTimeData = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
}

function saveVoiceTime(userId, duration) {
    if (!voiceTimeData[userId]) voiceTimeData[userId] = 0;
    voiceTimeData[userId] += duration;
    fs.writeFileSync(dataFile, JSON.stringify(voiceTimeData, null, 2));
}

function formatDuration(ms) {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);

    let str = '';
    if (hours > 0) str += `${hours} ชั่วโมง `;
    if (minutes > 0) str += `${minutes} นาที `;
    str += `${seconds} วินาที`;
    return str || 'ไม่ถึง 1 วินาที';
}

client.once('ready', () => {
    console.log(`✅ บอทจัดอันดับเวลาออนไลน์แล้วในชื่อ ${client.user.tag}`);
});

client.on('voiceStateUpdate', (oldState, newState) => {
    const logChannel = oldState.guild.channels.cache.get(LOG_CHANNEL_ID);
    const member = newState.member || oldState.member;
    const userId = member.id;
    const now = Date.now();
    const avatarUrl = member.user.displayAvatarURL({ dynamic: true, size: 512 });

    if (!oldState.channelId && newState.channelId) {
        joinTimes.set(userId, now);
        if (logChannel) {
            const embedJoin = new EmbedBuilder()
                .setColor('#2ecc71')
                .setAuthor({ name: `${member.user.tag} ได้เข้าห้องเสียง`, iconURL: avatarUrl })
                .setThumbnail(avatarUrl)
                .setDescription(`เข้า **${newState.channel.name}** มาทะไม <@${userId}> ชิชิงอล 😡`)
                .addFields({ name: '⏰ เวลาที่เข้า', value: `<t:${Math.floor(now / 1000)}:T>`, inline: true })
                .setTimestamp();
            logChannel.send({ embeds: [embedJoin] });
        }
    }
    else if (oldState.channelId && !newState.channelId) {
        const joinedAt = joinTimes.get(userId);
        if (joinedAt) {
            const duration = now - joinedAt;
            saveVoiceTime(userId, duration);
            if (logChannel) {
                const embedLeave = new EmbedBuilder()
                    .setColor('#e74c3c')
                    .setAuthor({ name: `${member.user.tag} ได้ออกจากห้องเสียง`, iconURL: avatarUrl })
                    .setThumbnail(avatarUrl)
                    .setDescription(`ออกจากห้อง **${oldState.channel.name}** ทำไม <@${userId}> 😡`)
                    .addFields(
                        { name: '⏰ เวลาที่เข้า', value: `<t:${Math.floor(joinedAt / 1000)}:T>`, inline: true },
                        { name: '⏱️ อยู่ในห้องรอบนี้ไป', value: `\`${formatDuration(duration)}\``, inline: true }
                    )
                    .setTimestamp();
                logChannel.send({ embeds: [embedLeave] });
            }
            joinTimes.delete(userId);
        }
    }
    else if (oldState.channelId !== newState.channelId) {
        const joinedAt = joinTimes.get(userId);
        if (joinedAt) {
            const duration = now - joinedAt;
            saveVoiceTime(userId, duration);
            if (logChannel) {
                const embedMove = new EmbedBuilder()
                    .setColor('#f1c40f')
                    .setAuthor({ name: `${member.user.tag} ได้ย้ายห้องเสียง`, iconURL: avatarUrl })
                    .setThumbnail(avatarUrl)
                    .setDescription(`ย้ายจาก **${oldState.channel.name}** ย้ายไป **${newState.channel.name}** ทำไม <@${userId}> 😡`)
                    .addFields(
                        { name: '⏰ เวลาที่เข้าห้องเดิม', value: `<t:${Math.floor(joinedAt / 1000)}:T>`, inline: true },
                        { name: '⏱️ แช่อยู่ในห้องเดิมไป', value: `\`${formatDuration(duration)}\``, inline: true }
                    )
                    .setTimestamp();
                logChannel.send({ embeds: [embedMove] });
            }
        }
        joinTimes.set(userId, now);
    }
});

client.on('messageCreate', (message) => {
    if (message.author.bot) return;

    if (message.content === '!top' || message.content === '!อันดับ') {
        const sortedUsers = Object.entries(voiceTimeData)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);

        if (sortedUsers.length === 0) {
            return message.reply('ยังไม่มีข้อมูลคนเข้าห้องเสียงเลยงับ 🥲');
        }

        const embed = new EmbedBuilder()
            .setTitle('🏆 จัดอันดับคนสิงห้องดิสนานที่สุด (เวลาสะสมรวม)')
            .setColor('#9b59b6')
            .setTimestamp();

        let description = '';
        sortedUsers.forEach((user, index) => {
            const userId = user[0];
            const totalTime = user[1];
            
            let medal = '🏅';
            if (index === 0) medal = '🥇';
            else if (index === 1) medal = '🥈';
            else if (index === 2) medal = '🥉';

            description += `${medal} **อันดับ ${index + 1}**: <@${userId}>\n⏱️ เวลาสะสม: \`${formatDuration(totalTime)}\`\n\n`;
        });

        embed.setDescription(description);
        message.channel.send({ embeds: [embed] });
    }
});

client.login(process.env.TOKEN);