require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const weatherApiKey = process.env.WEATHER_API_KEY;
const translationApiKey = process.env.TRANSLATION_API_KEY;
const botOwnerId = process.env.BOT_OWNER_ID;
const botNumber = process.env.BOT_NUMBER;
const backupNumber = process.env.BACKUP_NUMBER; // Added backup number

module.exports = { supabaseUrl, supabaseKey, weatherApiKey, translationApiKey, botOwnerId, botNumber, backupNumber };