require('dotenv').config();
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { logInfo, logError } = require('./utils/logger');
const { handleIncomingMessages, handleGroupParticipantsUpdate } = require('./message-controller/messageHandler');
const { startSecurityBot } = require('./security');
const { startScheduledMessageChecker } = require('./message-controller/scheduleMessage'); // Import the function
const config = require('./config/config');
const supabase = require('./supabaseClient');
const { delay } = require('@whiskeysockets/baileys/lib/Utils/generics');

async function saveSuperadmin(groupId, userId) {
    await supabase
        .from('superadmins')
        .upsert([{ group_id: groupId, user_id: userId }]);
}

async function fetchGroupMetadataWithRetry(sock, groupId, retries = 3, delay = 2000) {
    for (let i = 0; i < retries; i++) {
        try {
            return await sock.groupMetadata(groupId);
        } catch (err) {
            if (i === retries - 1) {
                throw err;
            }
            console.log(`Retrying fetchGroupMetadata (${i + 1}/${retries})...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

async function startMainBot(sock) {
    sock.ev.on('messages.upsert', async (m) => {
        console.log('📩 New message upsert:', m);
        await handleIncomingMessages(sock, m);
    });

    sock.ev.on('group-participants.update', async (update) => {
        await handleGroupParticipantsUpdate(sock, update);
    });

    console.log('✅ Main bot is ready and listening for messages.');
}

async function connectToWhatsApp(retryCount = 5) {
    for (let attempt = 1; attempt <= retryCount; attempt++) {
        try {
            console.log(`Attempt ${attempt}: Connecting to WhatsApp...`);
            const { state, saveCreds } = await useMultiFileAuthState('auth_info');
            const sock = makeWASocket({
                auth: state,
                printQRInTerminal: true,
            });

            sock.ev.on('connection.update', (update) => {
                const { connection, lastDisconnect } = update;
                console.log('Connection update:', update);
                if (connection === 'close') {
                    const shouldReconnect = (lastDisconnect.error)?.output?.statusCode === 408 || lastDisconnect?.error?.isBoom;
                    logError(`Connection closed due to ${lastDisconnect.error}, reconnecting ${shouldReconnect}`);
                    if (shouldReconnect && attempt < retryCount) {
                        console.log(`Connection lost. Retrying in 5 seconds... (Attempt ${attempt}/${retryCount})`);
                        setTimeout(() => connectToWhatsApp(retryCount - attempt), 5000);
                    } else {
                        console.log('Failed to reconnect. Check your internet and restart.');
                    }
                } else if (connection === 'open') {
                    logInfo('Techitoon Bot is ready!');
                    startMainBot(sock);
                    startSecurityBot(sock);
                    startScheduledMessageChecker(sock); // Start the scheduled message checker
                } else if (connection === 'connecting') {
                    console.log('Connecting to WhatsApp...');
                } else if (connection === 'qr') {
                    console.log('QR code received, please scan it with your WhatsApp app.');
                }
            });

            sock.ev.on('creds.update', saveCreds);

            return sock;
        } catch (error) {
            console.log(`Error occurred: ${error.message}`);
            if (attempt < retryCount) {
                console.log(`Retrying in 5 seconds... (${attempt}/${retryCount})`);
                await delay(5000);
            } else {
                console.log('Max retry attempts reached. Exiting.');
            }
        }
    }
}

connectToWhatsApp().catch(error => {
    logError(`❌ Error starting bot: ${error}`);
});