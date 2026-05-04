require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const express = require('express');

// ==========================================
// 🌐 ส่วนที่ 1: ระบบจำลองเว็บไซต์ (กันบอทหลับ)
// ==========================================
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('บอทกำลังทำงานอยู่จ้า! (ระบบกันหลับทำงานปกติ)');
});

app.listen(port, () => {
    console.log(`🌍 เว็บจำลองสำหรับกันหลับ รันที่พอร์ต ${port}`);
});

// ==========================================
// 🤖 ส่วนที่ 2: ตั้งค่าตัวแปรหลักของบอท
// ==========================================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// 📌 1. ใส่ ID ห้องแชทที่จะให้แจ้งเตือน
const LOG_CHANNEL_ID = '1499430462664478814'; 

// 📌 2. สัญลักษณ์หน้าคำสั่ง
const prefix = '.'; 

// 📌 3. ระบบ VIP (ตั้งคำพูดเฉพาะ ID)
// สามารถใช้ {user} แทนการแท็กชื่อ, {newChannel} แทนห้องที่เข้า/ย้ายไป, {oldChannel} แทนห้องที่เพิ่งออก
const vipMessages = {
    '523591013193875577': { // 👈 เปลี่ยนตัวเลขเป็น ID ของคุณหรือเพื่อน
        join: 'เข้ามาโดนเย็ดตูดมา <@{user}> ในห้อง **{newChannel}** ✨',
        leave: 'อ้าว... <@{user}> ไม่อยากโดนเย็ดตูดแล้วหรอ **{oldChannel}** ไปซะแล้ว 😭',
        move: ' <@{user}> ย้ายจากห้อง **{oldChannel}** ไปโดยเย็ดตูดในห้อง **{newChannel}** แล้วจ้า 🚗💨'
    },
    '516392413942775828': { // 👈 ไอดีเพื่อนอีกคน
        join: 'สวัดดีครับพรี่ <@{user}> ที่เข้ามาใน **{newChannel}** ช่างเป็นเกียรติจริงๆ',
        leave: 'ท่าน<@{user}> ออกจาก **{oldChannel}** ไปแล้ว ช่างน่าเสียใจ',
        move: 'ท่าน<@{user}> เดินเล่นจาก **{oldChannel}** ไป **{newChannel}** '
    },
'1276910034701258864': { // 👈 ไอดีเพื่อนอีกคน
        join: 'สวัสดีครับน้อง <@{user}> ที่เข้ามาใน **{newChannel}** ช่างเป็นเกียรติจริงๆ',
        leave: 'ท่าน<@{user}> ออกจาก **{oldChannel}** ไปแล้ว ช่างน่าเสียใจ',
        move: 'ท่าน<@{user}> เดินเล่นจาก **{oldChannel}** ไป **{newChannel}**', // 👈 ต้องมีลูกน้ำ , ปิดท้ายตรงนี้ด้วยครับ!
        color: '#ff69b4'
    }
};

const joinTimes = new Map();
const dataFile = './voiceData.json';

// โหลดฐานข้อมูลเวลา
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
    console.log(`✅ บอทพร้อมใช้งานแล้วในชื่อ ${client.user.tag}`);
});

// ==========================================
// 📢 ส่วนที่ 3: ระบบแจ้งเตือนเข้า-ออก และ VIP
// ==========================================
client.on('voiceStateUpdate', (oldState, newState) => {
    const logChannel = oldState.guild.channels.cache.get(LOG_CHANNEL_ID);
    const member = newState.member || oldState.member;
    const userId = member.id;
    const now = Date.now();
    const avatarUrl = member.user.displayAvatarURL({ dynamic: true, size: 512 });

    // 🟢 เข้าห้อง
    if (!oldState.channelId && newState.channelId) {
        joinTimes.set(userId, now);
        
        let text = `เข้า **${newState.channel.name}** มาทะไม <@${userId}> ชิชิงอล 😡`;
        let embedColor = '#2ecc71'; // สีเขียวปกติ
        
        if (vipMessages[userId]) {
            if (vipMessages[userId].join) {
                text = vipMessages[userId].join.replace(/{user}/g, userId).replace(/{newChannel}/g, newState.channel.name);
            }
            if (vipMessages[userId].color) embedColor = vipMessages[userId].color; // ดึงสีพิเศษมาใช้ถ้ามี
        }

        if (logChannel) {
            const embedJoin = new EmbedBuilder()
                .setColor(embedColor)
                .setAuthor({ name: `${member.user.tag} ได้เข้าห้องเสียง`, iconURL: avatarUrl })
                .setThumbnail(avatarUrl)
                .setDescription(text)
                .addFields({ name: '⏰ เวลาที่เข้า', value: `<t:${Math.floor(now / 1000)}:T>`, inline: true })
                .setTimestamp();
            logChannel.send({ embeds: [embedJoin] });
        }
    }
    // 🔴 ออกจากห้อง
    else if (oldState.channelId && !newState.channelId) {
        const joinedAt = joinTimes.get(userId);
        if (joinedAt) {
            const duration = now - joinedAt;
            saveVoiceTime(userId, duration);
            
            let text = `ออกจากห้อง **${oldState.channel.name}** ทำไม <@${userId}> 😡`;
            let embedColor = '#e74c3c'; // สีแดงปกติ

            if (vipMessages[userId]) {
                if (vipMessages[userId].leave) {
                    text = vipMessages[userId].leave.replace(/{user}/g, userId).replace(/{oldChannel}/g, oldState.channel.name);
                }
                if (vipMessages[userId].color) embedColor = vipMessages[userId].color; // ดึงสีพิเศษมาใช้ถ้ามี
            }

            if (logChannel) {
                const embedLeave = new EmbedBuilder()
                    .setColor(embedColor)
                    .setAuthor({ name: `${member.user.tag} ได้ออกจากห้องเสียง`, iconURL: avatarUrl })
                    .setThumbnail(avatarUrl)
                    .setDescription(text)
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
    // 🟡 ย้ายห้อง
    else if (oldState.channelId !== newState.channelId) {
        const joinedAt = joinTimes.get(userId);
        if (joinedAt) {
            const duration = now - joinedAt;
            saveVoiceTime(userId, duration);
            
            let text = `ย้ายจาก **${oldState.channel.name}** ไป **${newState.channel.name}** ทำไม <@${userId}> 😡`;
            let embedColor = '#f1c40f'; // สีเหลืองปกติ

            if (vipMessages[userId]) {
                if (vipMessages[userId].move) {
                    text = vipMessages[userId].move.replace(/{user}/g, userId).replace(/{oldChannel}/g, oldState.channel.name).replace(/{newChannel}/g, newState.channel.name);
                }
                if (vipMessages[userId].color) embedColor = vipMessages[userId].color; // ดึงสีพิเศษมาใช้ถ้ามี
            }

            if (logChannel) {
                const embedMove = new EmbedBuilder()
                    .setColor(embedColor)
                    .setAuthor({ name: `${member.user.tag} ได้ย้ายห้องเสียง`, iconURL: avatarUrl })
                    .setThumbnail(avatarUrl)
                    .setDescription(text)
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

// ==========================================
// 💬 ส่วนที่ 4: ระบบรับคำสั่งแชท (ดูเวลา/ดูอันดับ)
// ==========================================
client.on('messageCreate', (message) => {
    if (message.author.bot || !message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // 🏆 คำสั่ง: .top หรือ .อันดับ
    if (command === 'top' || command === 'อันดับ') {
        const sortedUsers = Object.entries(voiceTimeData)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);

        if (sortedUsers.length === 0) return message.reply('ยังไม่มีข้อมูลคนเข้าห้องเสียงเลยงับ 🥲');

        const embed = new EmbedBuilder()
            .setTitle('🏆 จัดอันดับคนสิงห้องดิสนานที่สุด')
            .setColor('#9b59b6')
            .setTimestamp();

        let description = '';
        sortedUsers.forEach((user, index) => {
            let medal = '🏅';
            if (index === 0) medal = '🥇';
            else if (index === 1) medal = '🥈';
            else if (index === 2) medal = '🥉';
            description += `${medal} **อันดับ ${index + 1}**: <@${user[0]}>\n⏱️ เวลาสะสม: \`${formatDuration(user[1])}\`\n\n`;
        });
        embed.setDescription(description);
        message.channel.send({ embeds: [embed] });
    }

    // ⏱️ คำสั่ง: .เวลา หรือ .เวลา @ชื่อเพื่อน
    if (command === 'เวลา') {
        const targetUser = message.mentions.users.first() || message.author;
        const targetId = targetUser.id;
        const totalTimeMs = voiceTimeData[targetId] || 0;

        if (totalTimeMs === 0) {
            return message.reply(`อ๊ะ! **${targetUser.username}** ยังไม่มีประวัติการสิงห้องเสียงเลยครับ 👻`);
        }

        const embed = new EmbedBuilder()
            .setColor('#3498db')
            .setAuthor({ name: targetUser.username, iconURL: targetUser.displayAvatarURL() })
            .setDescription(`⏱️ เวลาที่สะสมในห้องเสียงทั้งหมดคือ:\n**\`${formatDuration(totalTimeMs)}\`**`);
            
        message.channel.send({ embeds: [embed] });
    }
});

client.login(process.env.TOKEN);