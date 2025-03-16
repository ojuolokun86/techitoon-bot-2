const { writeFile, mkdir } = require('fs/promises');
const axios = require('axios');
const { exec } = require('child_process');
const { createCanvas } = require('canvas');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const path = require('path');

const ensureDirectoryExists = async (dir) => {
    try {
        await mkdir(dir, { recursive: true });
    } catch (error) {
        if (error.code !== 'EEXIST') {
            throw error;
        }
    }
};

const handleStickerCommands = async (sock, msg) => {
    const chatId = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid; // Get the sender's ID
    const messageText = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

    console.log(`Handling sticker command: ${messageText} from ${sender}`);

    const mediaDir = path.resolve(__dirname, '../../media');
    await ensureDirectoryExists(mediaDir);

    if (messageText.startsWith('.sticker')) {
        if (!msg.message.videoMessage && !msg.message.imageMessage) return;
        const buffer = await downloadMediaMessage(msg, 'buffer');
        const filePath = path.join(mediaDir, `input.${msg.message.videoMessage ? 'mp4' : 'jpg'}`);
        await writeFile(filePath, buffer);
        
        const stickerPath = path.join(mediaDir, 'output.webp');
        exec(`ffmpeg -i ${filePath} -vf "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2" -y ${stickerPath}`, async () => {
            await sock.sendMessage(chatId, { sticker: { url: stickerPath } });
        });
    }
    
    if (messageText.startsWith('.stext')) {
        const args = messageText.split(' ');
        const color = args[1] || 'white';
        const fontSize = parseInt(args[2]) || 40;
        const msg = args.slice(3).join(' ') || 'Hello';
        
        const canvas = createCanvas(512, 512);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, 512, 512);
        ctx.fillStyle = color;
        ctx.font = `${fontSize}px Arial`;
        ctx.fillText(msg, 50, 250);
        
        const stickerPath = path.join(mediaDir, 'text.webp');
        const buffer = canvas.toBuffer('image/png');
        await writeFile(stickerPath, buffer);
        
        await sock.sendMessage(chatId, { sticker: { url: stickerPath } });
    }
    
    if (messageText.startsWith('.emoji')) {
        const emoji = messageText.split(' ')[1] || '🔥';
        const emojiURL = `https://twemoji.maxcdn.com/v/latest/72x72/${emoji.codePointAt(0).toString(16)}.png`;
        const stickerPath = path.join(mediaDir, 'emoji.webp');
        
        const fetchEmoji = async (url, retries = 3) => {
            try {
                const response = await axios.get(url, { responseType: 'arraybuffer' });
                await writeFile(stickerPath, Buffer.from(response.data));
                await sock.sendMessage(chatId, { sticker: { url: stickerPath } });
            } catch (error) {
                if (retries > 0) {
                    console.log(`Retrying to fetch emoji... (${3 - retries + 1})`);
                    await fetchEmoji(url, retries - 1);
                } else {
                    console.error(`Error fetching emoji:`, error);
                    await sock.sendMessage(chatId, { text: '⚠️ Could not fetch the emoji. Please try again later.' });
                }
            }
        };

        await fetchEmoji(emojiURL);
    }
    
    const gifCommands = ['.kick', '.slap', '.punch', '.hug', '.kiss', '.pat', '.dance', '.cry', '.laugh', '.angry', '.sad', '.happy', '.blush', '.shy', '.sleep', '.bored'];
    if (gifCommands.includes(messageText)) {
        const giphyAPIKey = 'UenNvxVfxwJqjALZzFr10Ckmk7D11jC4'; // Replace with your Giphy API key
        const action = messageText.replace('.', '');
        const giphyURL = `https://api.giphy.com/v1/gifs/random?api_key=${giphyAPIKey}&tag=${action}&rating=g`;
        
        try {
            const { data } = await axios.get(giphyURL);
            const gifURL = data.data.images.original.url;
            
            const gifPath = path.join(mediaDir, `${action}.gif`);
            const stickerPath = path.join(mediaDir, `${action}.webp`);
            await writeFile(gifPath, (await axios.get(gifURL, { responseType: 'arraybuffer' })).data);
            
            exec(`ffmpeg -i ${gifPath} -vf "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2" -y ${stickerPath}`, async () => {
                await sock.sendMessage(chatId, { sticker: { url: stickerPath } });
            });
        } catch (error) {
            console.error(`Error fetching GIF from Giphy:`, error);
            await sock.sendMessage(chatId, { text: '⚠️ Could not fetch the GIF. Please try again later.' });
        }
    }
};

module.exports = { handleStickerCommands };