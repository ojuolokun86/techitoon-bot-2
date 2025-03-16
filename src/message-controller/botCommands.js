const axios = require('axios');
const translate = require('@vitalets/google-translate-api');
const config = require('../config/config');
const { formatResponseWithHeaderFooter } = require('../utils/utils');
const supabase = require('../supabaseClient');
const cron = require('node-cron');

let scheduledTasks = {};

const handleWeatherCommand = async (sock, message, args) => {
    const city = args.join(' ');
    const apiKey = config.apiKeys.weatherApiKey;
    const url = `http://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=metric`;

    try {
        const response = await axios.get(url);
        const data = response.data;
        const weatherInfo = `Weather in ${data.name}: ${data.weather[0].description}, Temperature: ${data.main.temp}°C`;
        await sock.sendMessage(message.key.remoteJid, { text: formatResponseWithHeaderFooter(weatherInfo) });
    } catch (error) {
        await sock.sendMessage(message.key.remoteJid, { text: formatResponseWithHeaderFooter('Unable to get weather information. Please try again later.') });
    }
};

const handleTranslateCommand = async (sock, message, args) => {
    const text = args.join(' ');
    try {
        const res = await translate(text, { to: 'en' });
        await sock.sendMessage(message.key.remoteJid, { text: formatResponseWithHeaderFooter(res.text) });
    } catch (error) {
        await sock.sendMessage(message.key.remoteJid, { text: formatResponseWithHeaderFooter('Unable to translate text. Please try again later.') });
    }
};

const handleShareLinkCommand = async (sock, chatId, args) => {
    try {
        const title = args.join(' ');

        const { data: links, error } = await supabase
            .from('links')
            .select('link')
            .eq('group_id', chatId)
            .eq('title', title)
            .single();

        if (error || !links) {
            await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('No saved links found for this group.') });
            return;
        }

        const link = links.link;
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter(`🔗 Check out this link: ${link}`) });

        // Schedule task to repost the link every 2 hours
        if (scheduledTasks[chatId]) {
            scheduledTasks[chatId].stop();
        }

        scheduledTasks[chatId] = cron.schedule('0 */2 * * *', async () => {
            await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter(`🔗 Check out this link: ${link}`) });
            console.log(`🔄 Reposted the shared link in ${chatId}.`);
        });

        console.log(`✅ Scheduled reposting of the link in ${chatId} every 2 hours.`);
    } catch (error) {
        console.error('Error sharing link:', error);
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('Unable to share the link. Please try again later.') });
    }
};

const handleStopLinkCommand = async (sock, chatId) => {
    if (scheduledTasks[chatId]) {
        scheduledTasks[chatId].stop();
        delete scheduledTasks[chatId];
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('🔕 Stopped reposting the link.') });
        console.log(`🛑 Stopped reposting the link in ${chatId}.`);
    } else {
        await sock.sendMessage(chatId, { text: formatResponseWithHeaderFooter('No link reposting task found for this group.') });
    }
};

module.exports = {
    handleWeatherCommand,
    handleTranslateCommand,
    handleShareLinkCommand,
    handleStopLinkCommand,
};