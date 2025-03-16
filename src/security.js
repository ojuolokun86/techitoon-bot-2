const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const config = require('./config/config');
const supabase = require('./supabaseClient');

let securityRules = {}; // Stores dynamic security rules based on past threats

async function saveSuperadmin(groupId, userId) {
    await supabase.from('superadmins').upsert([{ group_id: groupId, user_id: userId }]);
}

async function fetchGroupMetadataWithRetry(sock, groupId, retries = 3, delay = 2000) {
    for (let i = 0; i < retries; i++) {
        try {
            return await sock.groupMetadata(groupId);
        } catch (err) {
            if (i === retries - 1) throw err;
            console.log(`Retrying fetchGroupMetadata (${i + 1}/${retries})...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

async function restoreAdminRights(sock, groupId, botNumber) {
    try {
        await sock.groupParticipantsUpdate(groupId, [botNumber], 'promote');
        console.log(`✅ Restored admin rights in ${groupId}`);
        await saveGroupInviteLink(sock, groupId); // Save group invite link after restoring admin rights
    } catch (err) {
        console.log(`⚠️ Failed to restore admin in ${groupId}:`, err);
    }
}

async function saveGroupInviteLink(sock, groupId) {
    try {
        const inviteCode = await sock.groupInviteCode(groupId);
        await supabase.from('group_invites').upsert([{ group_id: groupId, invite_code: inviteCode }]);
        console.log(`✅ Saved invite link for group ${groupId}`);
    } catch (err) {
        console.log(`⚠️ Failed to save invite link for group ${groupId}:`, err);
    }
}

async function rejoinGroup(sock, groupId) {
    try {
        const { data, error } = await supabase.from('group_invites').select('invite_code').eq('group_id', groupId).single();
        if (error || !data) return console.log(`⚠️ No invite link found for group ${groupId}`);
        
        await sock.groupAcceptInvite(data.invite_code);
        console.log(`✅ Rejoined group ${groupId} using invite link`);
    } catch (err) {
        console.log(`⚠️ Failed to rejoin group ${groupId}:`, err);
    }
}

async function saveSecurityRule(groupId, rule) {
    await supabase.from('security_rules').upsert([
        {
            group_id: groupId,
            violation_count: rule.violationCount || 0,  // 🔥 Tracks all violations
            blacklisted_users: rule.blacklistedUsers || [],
        }
    ]);
}

async function loadSecurityRules() {
    const { data, error } = await supabase.from('security_rules').select('*');
    if (error) {
        console.log('⚠️ Failed to load security rules:', error);
        return {};
    }

    const rules = {};
    data.forEach(row => {
        rules[row.group_id] = {
            violationCount: row.violation_count || 0, // 🔥 Updated to track all violations
            blacklistedUsers: row.blacklisted_users || [],
        };
    });

    return rules;
}

// 🔥 NEW FEATURE: Auto-Kick Blacklisted Users
async function handleNewParticipant(sock, update) {
    const { id, participants } = update;
    let rules = securityRules[id] || { blacklistedUsers: [] };

    for (const participant of participants) {
        if (rules.blacklistedUsers.includes(participant)) {
            console.log(`🚨 Blacklisted user ${participant} rejoined. Removing...`);
            await sock.groupParticipantsUpdate(id, [participant], 'remove');
        }
    }
}

// 🔥 NEW FEATURE: Improved Violation Tracking & Bot Protection
async function handleParticipantUpdate(sock, update) {
    const { id, participants, action, by } = update;
    const botNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';
    const ownerNumber = '2348026977793@s.whatsapp.net'; // Replace with your number

    try {
        let rules = securityRules[id] || { violationCount: 0, blacklistedUsers: [] };

        if (action === 'promote') {
            for (const participant of participants) {
                if (by !== ownerNumber && participant !== ownerNumber) {
                    console.log(`🚨 Unauthorized admin promotion by ${by}, reversing...`);
                    await sock.groupParticipantsUpdate(id, [participant], 'demote');

                    rules.violationCount++;  // 🔥 Count violations
                    if (rules.violationCount >= 5) {  // 🔥 Updated threshold
                        console.log(`❌ Blacklisting ${by} for repeated violations`);
                        rules.blacklistedUsers.push(by);
                        await sock.groupParticipantsUpdate(id, [by], 'remove');
                    }

                    securityRules[id] = rules;
                    await saveSecurityRule(id, rules);
                } else {
                    await saveSuperadmin(id, participant);
                }
            }
        }

        if (action === 'remove' && participants.includes(botNumber)) {
            console.log('🚨 Bot removed! Attempting recovery...');
            if (!rules.blacklistedUsers.includes(by)) {
                rules.violationCount++;
                if (rules.violationCount >= 5) {
                    console.log(`❌ Blacklisting ${by} for multiple violations.`);
                    rules.blacklistedUsers.push(by);
                }
                await saveSecurityRule(id, rules);
            }

            await attemptBotRecovery(sock, id);
        }

        if (action === 'demote' && participants.includes(ownerNumber)) {
            console.log(`🚨 Owner was demoted in ${id}! Attempting restore...`);

            const metadata = await sock.groupMetadata(id);
            const admins = metadata.participants.filter(p => p.admin);
            const demoter = admins.find(admin => admin.id !== ownerNumber && admin.id !== botNumber);

            if (admins.some(a => a.id === botNumber)) {
                // 🛠 Restore your admin rights
                await sock.groupParticipantsUpdate(id, [ownerNumber], 'promote');
                console.log(`✅ Owner restored as admin!`);

                if (demoter) {
                    // ❌ Demote the person who tried to remove you
                    await sock.groupParticipantsUpdate(id, [demoter.id], 'demote');
                    console.log(`⚠️ Punished ${demoter.id} for demoting the owner.`);
                    
                    // Optionally, kick the demoter
                    // await sock.groupParticipantsUpdate(id, [demoter.id], 'remove');
                    // console.log(`🚨 Kicked ${demoter.id} for trying to remove the owner.`);
                }
            } else {
                console.log("❌ Bot is not an admin, can't restore.");
            }
        }

        if (action === 'demote' && participants.includes(botNumber)) {
            console.log('🚨 Bot demoted! Attempting recovery...');
            if (!rules.blacklistedUsers.includes(by)) {
                rules.violationCount++;
                if (rules.violationCount >= 5) {
                    console.log(`❌ Blacklisting ${by} for multiple violations.`);
                    rules.blacklistedUsers.push(by);
                }
                await saveSecurityRule(id, rules);
            }

            await restoreAdminRights(sock, id, botNumber);
        }
    } catch (err) {
        console.log(`❌ Error in participant update:`, err);
    }
}

// 🔥 NEW FEATURE: Retry Bot Rejoining Every 5 Minutes
async function attemptBotRecovery(sock, groupId, retries = 5, delay = 300000) {
    for (let i = 0; i < retries; i++) {
        try {
            const { data, error } = await supabase.from('group_invites').select('invite_code').eq('group_id', groupId).single();
            if (error || !data) {
                console.log(`⚠️ No invite link found for ${groupId}, retrying in ${delay / 60000} minutes...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }

            await sock.groupAcceptInvite(data.invite_code);
            console.log(`✅ Rejoined group ${groupId} using invite link`);

            setTimeout(() => restoreAdminRights(sock, groupId, sock.user.id), 5000);
            return;
        } catch (err) {
            console.log(`⚠️ Failed to rejoin ${groupId}, retrying...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    console.log(`❌ Final rejoin attempt failed for ${groupId}. Manual action needed.`);
}

// 🔄 Periodic Security Check
async function checkAndRestoreGroups(sock, botNumber) {
    console.log('🔍 Checking groups for admin status...');
    const groups = await sock.groupFetchAllParticipating();

    await Promise.all(Object.keys(groups).map(async (groupId) => {
        const metadata = await fetchGroupMetadataWithRetry(sock, groupId);
        if (!metadata.participants.some(p => p.id === botNumber && p.admin)) {
            await restoreAdminRights(sock, groupId, botNumber);
        }

        // 🔒 Remove Unauthorized Admins
        for (const participant of metadata.participants) {
            if (participant.id !== botNumber && participant.id !== config.botOwnerId && participant.admin) {
                try {
                    await sock.groupParticipantsUpdate(groupId, [participant.id], 'demote');
                    console.log(`❌ Removed admin rights from: ${participant.id}`);
                } catch (err) {
                    console.log(`⚠️ Failed to demote ${participant.id}:`, err);
                }
            }
        }

        // Save group invite link
        await saveGroupInviteLink(sock, groupId);
    }));
}

// 🚀 Start Security System
async function startSecurityBot(sock) {
    sock.ev.on('group-participants.update', (update) => {
        handleNewParticipant(sock, update);
        handleParticipantUpdate(sock, update);
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message) return;
        const sender = msg.key.participant || msg.key.remoteJid;
        const chatId = msg.key.remoteJid;
        const messageText = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

        if (messageText === '.restoreme' && sender === config.botOwnerId) {
            console.log('🛠 Manual superadmin restore triggered...');
            await restoreAdminRights(sock, chatId, config.botOwnerId);
        }

        if (messageText === '.hijack' && sender === config.botOwnerId) {
            console.log('🛠 Hijack superadmin rights triggered...');
            const groupId = chatId;
            setTimeout(async () => {
                await restoreAdminRights(sock, groupId, sock.user.id);
                console.log(`✅ Hijacked superadmin rights in ${groupId}`);
            }, Math.random() * 60000); // Random delay up to 1 minute
        }

        if (messageText === '.clearblacklist' && sender === config.botOwnerId) {
            console.log('🛠 Clearing all blacklisted users...');
            const { data, error } = await supabase.from('security_rules').update({ blacklisted_users: [] }).neq('blacklisted_users', []);
            if (error) {
                console.log('⚠️ Failed to clear blacklist:', error);
            } else {
                console.log('✅ Cleared all blacklisted users.');
                securityRules = await loadSecurityRules();
            }
        }

        if (messageText.startsWith('.clearblack') && sender === config.botOwnerId) {
            const userId = messageText.split(' ')[1];
            if (userId) {
                console.log(`🛠 Removing ${userId} from blacklist...`);
                const { data, error } = await supabase.from('security_rules').select('*');
                if (error) {
                    console.log('⚠️ Failed to fetch security rules:', error);
                } else {
                    for (const rule of data) {
                        const index = rule.blacklisted_users.indexOf(userId);
                        if (index > -1) {
                            rule.blacklisted_users.splice(index, 1);
                            await saveSecurityRule(rule.group_id, rule);
                        }
                    }
                    console.log(`✅ Removed ${userId} from blacklist.`);
                    securityRules = await loadSecurityRules();
                }
            }
        }
    });
}

// 🔄 Run Periodic Check
async function startBot() {
    console.log('🔍 Loading security rules from database...');
    securityRules = await loadSecurityRules();

    const { state, saveCreds } = await useMultiFileAuthState('./auth_info_baileys');
    const sock = makeWASocket({ auth: state, printQRInTerminal: true });

    sock.ev.on('creds.update', saveCreds);
    const botNumber = config.botNumber;

    sock.ev.on('connection.update', async ({ connection }) => {
        if (connection === 'open') await checkAndRestoreGroups(sock, botNumber);
    });

    setInterval(async () => {
        await checkAndRestoreGroups(sock, botNumber);
    }, 3600000); // Every hour

    startSecurityBot(sock);
}

module.exports = { startSecurityBot, startBot };