const supabase = require('../supabaseClient');
const config = require('../config/config'); // Import the config module

async function getCommunityName(sock, chatId) {
    try {
        const groupMetadata = await sock.groupMetadata(chatId);
        return groupMetadata.subject;
    } catch (error) {
        console.error('Error fetching community name:', error);
        return 'Unknown Community';
    }
}

async function isAdmin(sock, chatId, userId) {
    try {
        const groupMetadata = await sock.groupMetadata(chatId);
        const participant = groupMetadata.participants.find(p => p.id === userId);
        return participant && (participant.admin === 'admin' || participant.admin === 'superadmin');
    } catch (error) {
        console.error('Error checking admin status:', error);
        return false;
    }
}

async function addWinner(sock, chatId, sender, league, team, username) {
    try {
        const communityName = await getCommunityName(sock, chatId);

        // Check if the user is the bot owner or an admin
        const isUserAdmin = await isAdmin(sock, chatId, sender);
        if (sender !== config.botOwnerId && !isUserAdmin) {
            await sock.sendMessage(chatId, { text: '❌ Only the bot owner or admins can add a winner.' });
            return;
        }

        // Check if the winner already exists
        const { data: existingWinner, error: fetchError } = await supabase
            .from('hall_of_fame')
            .select('*')
            .eq('username', username)
            .eq('league', league)
            .eq('community_name', communityName)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
            throw fetchError;
        }

        if (existingWinner) {
            // Update the existing winner's trophies count
            const { data, error } = await supabase
                .from('hall_of_fame')
                .update({ trophies: existingWinner.trophies + 1 })
                .eq('username', username)
                .eq('league', league)
                .eq('community_name', communityName);

            if (error) throw error;
        } else {
            // Insert a new winner
            const { data, error } = await supabase
                .from('hall_of_fame')
                .insert([{ username, team, league, community_name: communityName, trophies: 1 }]);

            if (error) throw error;
        }

        await sock.sendMessage(chatId, { text: `🏆 Winner added: ${username} (${team}, ${league}) in ${communityName}` });
    } catch (error) {
        console.error('Error adding winner:', error);
        await sock.sendMessage(chatId, { text: '❌ Error adding winner. Please try again.' });
    }
}

async function showHallOfFame(sock, chatId) {
    try {
        const communityName = await getCommunityName(sock, chatId);

        const { data: winners, error } = await supabase
            .from('hall_of_fame')
            .select('*')
            .eq('community_name', communityName)
            .order('trophies', { ascending: false });

        if (error) throw error;

        if (!winners || winners.length === 0) {
            await sock.sendMessage(chatId, { text: `📜 No winners found in the Hall of Fame for ${communityName}.` });
            return;
        }

        let message = `🏆 *HALL OF FAME - ${communityName} 🏆🏆🏆* 🏆\n`;
        message += `━━━━━━━━━━━━━━━━━━━━━\n`;
        winners.forEach((winner, index) => {
            message += `🥇 *${winner.username}* → ${winner.league} (${winner.team}) 🏆${'🏆'.repeat(winner.trophies - 1)}\n`;
        });
        message += `━━━━━━━━━━━━━━━━━━━━━\n`;
        message += `🔥 *Legendary Players* keep making history!\n`;
        message += `📌 Powered by Techitoon Bot`;

        await sock.sendMessage(chatId, { text: message });
    } catch (error) {
        console.error('Error showing Hall of Fame:', error);
        await sock.sendMessage(chatId, { text: '❌ Error showing Hall of Fame. Please try again.' });
    }
}

module.exports = { addWinner, showHallOfFame };