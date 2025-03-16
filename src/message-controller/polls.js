const supabase = require('../supabaseClient');
const { formatResponseWithHeaderFooter } = require('../utils/utils');
const config = require('../config/config'); // Assuming the bot owner ID is stored in the config

const createPoll = async (sock, chatId, question, options, sender) => {
    if (!sender) {
        console.error("⚠️ Poll creator information is missing.");
        await sock.sendMessage(chatId, { text: "⚠️ Error: Poll creator information is missing." });
        return;
    }

    console.log('Creating poll with question:', question);
    console.log('Options:', options);
    console.log('Poll Creator:', sender); // Debug sender

    const createdAt = new Date().toISOString();

    const { data, error } = await supabase
        .from('polls')
        .insert({ 
            group_id: chatId, 
            question, 
            options: JSON.stringify(options), 
            votes: JSON.stringify({}), 
            creator: sender,  // Ensure sender is not null
            created_at: createdAt 
        });

    if (error) {
        console.error('❌ Error creating poll:', error);
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('⚠️ Error creating poll.') });
    } else {
        console.log('✅ Poll created successfully:', data);
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter(`✅ Poll created: ${question}\nOptions:\n${options.join('\n')}`) });
    }
};

const vote = async (sock, chatId, args, sender) => {
    const option = args.join(' ');
    console.log('Voting for option:', option); // Log the option

    const { data, error } = await supabase
        .from('polls')
        .select('votes, created_at, question, creator')
        .eq('group_id', chatId)
        .single();

    if (error || !data) {
        console.error('Error fetching poll:', error);
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('⚠️ Poll not found.') });
    } else {
        const createdAt = new Date(data.created_at);
        const now = new Date();
        const diffHours = Math.abs(now - createdAt) / 36e5;

        if (diffHours >= 24) {
            // End the poll automatically
            const pollResultsMessage = generatePollResultAnnouncement(data.question, JSON.parse(data.votes));
            console.log('Poll results:', pollResultsMessage); // Log the poll results

            await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter(pollResultsMessage) });

            const { error: deleteError } = await supabase
                .from('polls')
                .delete()
                .eq('group_id', chatId);

            if (deleteError) {
                console.error('Error ending poll:', deleteError);
            } else {
                console.log('Poll ended successfully'); // Log success message
            }
        } else {
            const votes = JSON.parse(data.votes);
            votes[option] = (votes[option] || 0) + 1;
            console.log('Updated votes:', votes); // Log the updated votes

            const { error: updateError } = await supabase
                .from('polls')
                .update({ votes: JSON.stringify(votes) })
                .eq('group_id', chatId);

            if (updateError) {
                console.error('Error updating poll:', updateError);
                await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('⚠️ Error voting.') });
            } else {
                console.log('Vote recorded successfully'); // Log success message
                await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter(`✅ Voted for: ${option}`) });
            }
        }
    }
};

const endPoll = async (sock, chatId, sender) => {
    console.log('Ending poll for chatId:', chatId); // Log the chatId

    const { data, error } = await supabase
        .from('polls')
        .select('question, votes, creator')
        .eq('group_id', chatId)
        .single();

    if (error || !data) {
        console.error('Error fetching poll:', error);
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('⚠️ Poll not found.') });
    } else {
        console.log('Poll creator:', data.creator); // Log the poll creator
        console.log('Sender:', sender); // Log the sender
        console.log('Bot owner ID:', config.botOwnerId); // Log the bot owner ID

        if (data.creator !== sender && sender !== config.botOwnerId) {
            await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('❌ Only the poll creator or the bot owner can end the poll.') });
        } else {
            const pollResultsMessage = generatePollResultAnnouncement(data.question, JSON.parse(data.votes));
            console.log('Poll results:', pollResultsMessage); // Log the poll results

            await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter(pollResultsMessage) });

            const { error: deleteError } = await supabase
                .from('polls')
                .delete()
                .eq('group_id', chatId);

            if (deleteError) {
                console.error('Error ending poll:', deleteError);
            } else {
                console.log('Poll ended successfully'); // Log success message
            }
        }
    }
};

const generatePollResultAnnouncement = (question, votes) => {
    // Capitalize the first letter of each option
    const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);

    // Format the results
    const results = Object.entries(votes)
        .map(([option, count], index) => `🔹 ${index + 1} - ${capitalize(option)} ${count} vote(s)`)
        .join('\n');

    // Determine the winner
    const winningOption = Object.entries(votes).reduce((max, entry) => entry[1] > max[1] ? entry : max, ['', 0])[0];

    // Format the poll results message
    const pollResultsMessage = `
📊 **Poll Results for: ${question}** 📊

${results}

🏆 **Winner:** ${capitalize(winningOption)} 🎉
    `;

    return pollResultsMessage.trim();
};

module.exports = { createPoll, vote, endPoll };