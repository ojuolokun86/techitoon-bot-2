const supabase = require('../supabaseClient');
const { formatResponseWithHeaderFooter } = require('../utils/utils');

async function addCommand(sock, chatId, command, response, accessLevel) {
    try {
        const { data, error } = await supabase
            .from('custom_commands')
            .insert([{ command, response, access_level: accessLevel, group_id: chatId }]);

        if (error) {
            console.error('Error adding command:', error);
            await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('⚠️ Error adding command.') });
        } else {
            await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter(`✅ Command '${command}' added successfully.`) });
        }
    } catch (error) {
        console.error('Error in addCommand:', error);
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('⚠️ Error adding command.') });
    }
}

async function deleteCommand(sock, chatId, command) {
    try {
        const { data, error } = await supabase
            .from('custom_commands')
            .delete()
            .eq('command', command)
            .eq('group_id', chatId);

        if (error) {
            console.error('Error deleting command:', error);
            await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('⚠️ Error deleting command.') });
        } else {
            await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter(`✅ Command '${command}' deleted successfully.`) });
        }
    } catch (error) {
        console.error('Error in deleteCommand:', error);
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('⚠️ Error deleting command.') });
    }
}

async function callCommand(sock, chatId, command) {
    try {
        const { data, error } = await supabase
            .from('custom_commands')
            .select('response')
            .eq('command', command)
            .eq('group_id', chatId)
            .single();

        if (error || !data) {
            console.error('Error calling command:', error);
            await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('⚠️ Command not found.') });
        } else {
            await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter(data.response) });
        }
    } catch (error) {
        console.error('Error in callCommand:', error);
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('⚠️ Error calling command.') });
    }
}

module.exports = { addCommand, deleteCommand, callCommand };