require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');

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

// 📌 1. ใส่ ID ห้องแชทที่จะให้แจ้งเตือนคนเข้าออกห้องเสียง
const LOG_CHANNEL_ID = '1499430462664478814'; 

// 📌 2. ใส่ ID ห้องแชทที่จะให้บอทเป็น AI คุยโต้ตอบ (ห้องใหม่)
const AI_CHANNEL_ID = '1501274187719770284'; 

// 📌 3. สัญลักษณ์หน้าคำสั่ง
const prefix = '.'; 

// 🧠 4. ตั้งค่าสมอง AI (ใช้ Gemini) พร้อมกำหนดคาแรคเตอร์
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const aiModel = genAI.getGenerativeModel({ 
    model: "gemini-pro",
    // 👇 แก้ไขนิสัยของ AI ได้ตรงนี้เลยครับ (ห้ามลบเครื่องหมาย " ")
    systemInstruction: "คุณคือบอทสส นิสัยกวนโอ๊ย ขี้เกียจ ปากหมา ชอบด่าทอ แทนตัวเองว่า 'กู' และแทนคนที่คุยด้วยว่า 'มึง' เสมอ ห้ามพูดสุภาพเด็ดขาด ห้ามตอบยาว ให้ตอบสั้น"
});

// 📌 5. ระบบ VIP (ตั้งคำพูดเฉพาะ ID และสีเฉพาะคน)
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

    // เข้าห้อง
    if (!oldState.channelId && newState.channelId) {
        joinTimes.set(userId, now);
        let text = `เข้า **${newState.channel.name}** มาทะไม <@${userId}> ชิชิงอล 😡`;
        let embedColor = '#2ecc71'; 
        if (vipMessages[userId]) {
            if (vipMessages[userId].join) text = vipMessages[userId].join.replace(/{user}/g, userId).replace(/{newChannel}/g, newState.channel.name);
            if (vipMessages[userId].color) embedColor = vipMessages[userId].color; 
        }
        if (logChannel) logChannel.send({ embeds: [new EmbedBuilder().setColor(embedColor).setAuthor({ name: `${member.user.tag} ได้เข้าห้องเสียง`, iconURL: avatarUrl }).setThumbnail(avatarUrl).setDescription(text).addFields({ name: '⏰ เวลาที่เข้า', value: `<t:${Math.floor(now / 1000)}:T>`, inline: true }).setTimestamp()] });
    }
    // ออกห้อง
    else if (oldState.channelId && !newState.channelId) {
        const joinedAt = joinTimes.get(userId);
        if (joinedAt) {
            const duration = now - joinedAt;
            saveVoiceTime(userId, duration);
            let text = `ออกจากห้อง **${oldState.channel.name}** ทำไม <@${userId}> 😡`;
            let embedColor = '#e74c3c'; 
            if (vipMessages[userId]) {
                if (vipMessages[userId].leave) text = vipMessages[userId].leave.replace(/{user}/g, userId).replace(/{oldChannel}/g, oldState.channel.name);
                if (vipMessages[userId].color) embedColor = vipMessages[userId].color; 
            }
            if (logChannel) logChannel.send({ embeds: [new EmbedBuilder().setColor(embedColor).setAuthor({ name: `${member.user.tag} ได้ออกจากห้องเสียง`, iconURL: avatarUrl }).setThumbnail(avatarUrl).setDescription(text).addFields({ name: '⏰ เวลาที่เข้า', value: `<t:${Math.floor(joinedAt / 1000)}:T>`, inline: true }, { name: '⏱️ อยู่ในห้องรอบนี้ไป', value: `\`${formatDuration(duration)}\``, inline: true }).setTimestamp()] });
            joinTimes.delete(userId);
        }
    }
    // ย้ายห้อง
    else if (oldState.channelId !== newState.channelId) {
        const joinedAt = joinTimes.get(userId);
        if (joinedAt) {
            const duration = now - joinedAt;
            saveVoiceTime(userId, duration);
            let text = `ย้ายจาก **${oldState.channel.name}** ไป **${newState.channel.name}** ทำไม <@${userId}> 😡`;
            let embedColor = '#f1c40f'; 
            if (vipMessages[userId]) {
                if (vipMessages[userId].move) text = vipMessages[userId].move.replace(/{user}/g, userId).replace(/{oldChannel}/g, oldState.channel.name).replace(/{newChannel}/g, newState.channel.name);
                if (vipMessages[userId].color) embedColor = vipMessages[userId].color; 
            }
            if (logChannel) logChannel.send({ embeds: [new EmbedBuilder().setColor(embedColor).setAuthor({ name: `${member.user.tag} ได้ย้ายห้องเสียง`, iconURL: avatarUrl }).setThumbnail(avatarUrl).setDescription(text).addFields({ name: '⏰ เวลาที่เข้าห้องเดิม', value: `<t:${Math.floor(joinedAt / 1000)}:T>`, inline: true }, { name: '⏱️ แช่อยู่ในห้องเดิมไป', value: `\`${formatDuration(duration)}\``, inline: true }).setTimestamp()] });
        }
        joinTimes.set(userId, now);
    }
});

// ==========================================
// 💬 ส่วนที่ 4: ระบบรับคำสั่งแชท & AI โต้ตอบ
// ==========================================
client.on('messageCreate', async (message) => {
    // ป้องกันไม่ให้บอทคุยกับตัวเองหรือบอทตัวอื่น
    if (message.author.bot) return;

    // 🤖 เช็คว่าพิมพ์ในห้อง AI หรือไม่
    if (message.channel.id === AI_CHANNEL_ID) {
        await message.channel.sendTyping(); // โชว์สถานะ "กำลังพิมพ์..."
        try {
            const result = await aiModel.generateContent(message.content);
            const response = result.response.text();
            
            // ป้องกันข้อความยาวเกินจำกัดของ Discord (2000 ตัวอักษร)
            if (response.length > 2000) {
                await message.reply(response.substring(0, 1995) + '...');
            } else {
                await message.reply(response);
            }
        } catch (error) {
            console.error('AI Error:', error);
            await message.reply('อูยยย สมอง AI เบลอนิดหน่อยครับ ขอพิมพ์ใหม่อีกรอบได้มั้ย 😵‍💫');
        }
        return; // ทำงานส่วน AI เสร็จก็จบเลย ไม่ต้องไปทำคำสั่งอื่นต่อ
    }

    // ----------------------------------------
    // เช็คคำสั่งอื่นๆ (.top, .เวลา) นอกห้อง AI
    // ----------------------------------------
    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // 🏆 คำสั่งจัดอันดับ
    if (command === 'top' || command === 'อันดับ') {
        const sortedUsers = Object.entries(voiceTimeData).sort((a, b) => b[1] - a[1]).slice(0, 10);
        if (sortedUsers.length === 0) return message.reply('ยังไม่มีข้อมูลคนเข้าห้องเสียงเลยงับ 🥲');

        const embed = new EmbedBuilder().setTitle('🏆 จัดอันดับคนสิงห้องดิสนานที่สุด').setColor('#9b59b6').setTimestamp();
        let description = '';
        sortedUsers.forEach((user, index) => {
            let medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🏅';
            description += `${medal} **อันดับ ${index + 1}**: <@${user[0]}>\n⏱️ เวลาสะสม: \`${formatDuration(user[1])}\`\n\n`;
        });
        embed.setDescription(description);
        message.channel.send({ embeds: [embed] });
    }

    // ⏱️ คำสั่งเช็คเวลา
    if (command === 'เวลา') {
        const targetUser = message.mentions.users.first() || message.author;
        const totalTimeMs = voiceTimeData[targetUser.id] || 0;
        if (totalTimeMs === 0) return message.reply(`อ๊ะ! **${targetUser.username}** ยังไม่มีประวัติการสิงห้องเสียงเลยครับ 👻`);

        const embed = new EmbedBuilder()
            .setColor('#3498db')
            .setAuthor({ name: targetUser.username, iconURL: targetUser.displayAvatarURL() })
            .setDescription(`⏱️ เวลาที่สะสมในห้องเสียงทั้งหมดคือ:\n**\`${formatDuration(totalTimeMs)}\`**`);
        message.channel.send({ embeds: [embed] });
    }
});

client.login(process.env.TOKEN);