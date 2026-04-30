const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('บอทกำลังทำงานอยู่จ้า!');
});

app.listen(port, () => {
    console.log(`🌍 เว็บเซิร์ฟเวอร์จำลองรันที่พอร์ต ${port}`);
});
require('dotenv').config();

const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages
    ]
});

const LOG_CHANNEL_ID = '1499430462664478814'; 

const joinTimes = new Map();

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
    console.log(`✅ บอทขี้งอนแบบพรีเมียมออนไลน์แล้วในชื่อ ${client.user.tag}`);
});

client.on('voiceStateUpdate', (oldState, newState) => {
    const logChannel = oldState.guild.channels.cache.get(LOG_CHANNEL_ID);
    if (!logChannel) return; 

    const member = newState.member || oldState.member;
    const userId = member.id;
    const now = Date.now();
    
    // ดึงรูปโปรไฟล์ของ User แบบความละเอียดสูง
    const avatarUrl = member.user.displayAvatarURL({ dynamic: true, size: 512 });

    // 1. กรณีเพิ่งเข้าห้อง (สีเขียว)
    if (!oldState.channelId && newState.channelId) {
        joinTimes.set(userId, now);
        
        const embedJoin = new EmbedBuilder()
            .setColor('#2ecc71') // สีเขียว
            .setAuthor({ name: `${member.user.tag} ได้เข้าห้องเสียง`, iconURL: avatarUrl })
            .setThumbnail(avatarUrl) // โชว์รูปโปรไฟล์มุมขวาบน
            .setDescription(`เข้า **${newState.channel.name}** มาทะไม <@${userId}> ชิชิงอล 😡`)
            .addFields(
                { name: '⏰ เวลาที่เข้า', value: `<t:${Math.floor(now / 1000)}:T>`, inline: true }
            )
            .setTimestamp();

        logChannel.send({ embeds: [embedJoin] });
    }
    // 2. กรณีออกจากห้อง (สีแดง)
    else if (oldState.channelId && !newState.channelId) {
        const joinedAt = joinTimes.get(userId);
        
        const embedLeave = new EmbedBuilder()
            .setColor('#e74c3c') // สีแดง
            .setAuthor({ name: `${member.user.tag} ได้ออกจากห้องเสียง`, iconURL: avatarUrl })
            .setThumbnail(avatarUrl)
            .setDescription(`ออกจากห้อง **${oldState.channel.name}** ทำไม <@${userId}> 😡`);

        if (joinedAt) {
            const duration = now - joinedAt;
            embedLeave.addFields(
                { name: '⏰ เวลาที่เข้า', value: `<t:${Math.floor(joinedAt / 1000)}:T>`, inline: true },
                { name: '⏱️ อยู่ในห้องไป', value: `\`${formatDuration(duration)}\``, inline: true }
            );
            joinTimes.delete(userId);
        }
        
        embedLeave.setTimestamp();
        logChannel.send({ embeds: [embedLeave] });
    }
    // 3. กรณีย้ายห้อง (สีเหลือง)
    else if (oldState.channelId !== newState.channelId) {
        const joinedAt = joinTimes.get(userId);
        
        const embedMove = new EmbedBuilder()
            .setColor('#f1c40f') // สีเหลือง
            .setAuthor({ name: `${member.user.tag} ได้ย้ายห้องเสียง`, iconURL: avatarUrl })
            .setThumbnail(avatarUrl)
            .setDescription(`ย้ายจาก **${oldState.channel.name}** ย้ายไป **${newState.channel.name}** ทำไม <@${userId}> 😡`);

        if (joinedAt) {
            const duration = now - joinedAt;
            embedMove.addFields(
                { name: '⏰ เวลาที่เข้าห้องเดิม', value: `<t:${Math.floor(joinedAt / 1000)}:T>`, inline: true },
                { name: '⏱️ แช่อยู่ในห้องเดิมไป', value: `\`${formatDuration(duration)}\``, inline: true }
            );
        }
        
        joinTimes.set(userId, now);
        embedMove.setTimestamp();
        logChannel.send({ embeds: [embedMove] });
    }
});

client.login(process.env.TOKEN);