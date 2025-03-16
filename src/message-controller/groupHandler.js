const { formatResponseWithHeaderFooter, welcomeMessage } = require('../utils/utils');
const supabase = require('../supabaseClient');
const { removedMessages, leftMessages } = require('../utils/goodbyeMessages');

const handleGroupParticipantsUpdate = async (sock, update) => {
    try {
        console.log('👥 Group participants update:', update);
        const chat = await sock.groupMetadata(update.id);
        const contact = update.participants[0];
        const user = contact.split('@')[0];
        const { data: groupSettings, error } = await supabase
            .from('group_settings')
            .select('welcome_messages_enabled, goodbye_messages_enabled')
            .eq('group_id', update.id)
            .single();

        if (error) {
            console.error('Error fetching group settings:', error);
            return;
        }

        if (update.action === 'add' && groupSettings && groupSettings.welcome_messages_enabled) {
            await sock.sendMessage(chat.id, { text: formatResponseWithHeaderFooter(welcomeMessage(chat.subject, user)) });
            console.log(`👋 Sent welcome message to ${user}`);
        }

        if ((update.action === 'remove' || update.action === 'leave') && groupSettings && groupSettings.goodbye_messages_enabled) {
            let goodbyeMessage;
            if (update.action === 'remove') {
                // Select a random removed message
                const randomIndex = Math.floor(Math.random() * removedMessages.length);
                goodbyeMessage = removedMessages[randomIndex].replace('${participant}', user);
            } else if (update.action === 'leave') {
                // Select a random left message
                const randomIndex = Math.floor(Math.random() * leftMessages.length);
                goodbyeMessage = leftMessages[randomIndex].replace('${participant}', user);
            }

            // Send the goodbye message
            await sock.sendMessage(chat.id, {
                text: goodbyeMessage,
                mentions: [contact]
            });
            console.log(`👋 Sent goodbye message to ${contact}`);
        }
    } catch (error) {
        console.error('Error handling group participants update:', error);
    }
};

module.exports = { handleGroupParticipantsUpdate };