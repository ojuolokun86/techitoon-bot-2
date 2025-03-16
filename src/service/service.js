// This file handles interactions with external services, such as fetching weather information, translating text, and managing data storage with Supabase.

const fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');
const config = require('../config/config'); // Assuming the configuration is stored in config.js

const supabaseUrl = config.database.url;
const supabaseKey = config.database.key;
const supabaseClient = createClient(supabaseUrl, supabaseKey);

async function fetchWeather(location) {
    try {
        const response = await fetch(`https://api.weatherapi.com/v1/current.json?key=${config.apiKeys.weatherApiKey}&q=${location}`);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching weather:', error);
        throw error;
    }
}

async function translateText(text, targetLanguage) {
    try {
        const response = await fetch(`https://api.translationapi.com/translate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.apiKeys.translationApiKey}`
            },
            body: JSON.stringify({ text, target: targetLanguage })
        });
        const data = await response.json();
        return data.translatedText;
    } catch (error) {
        console.error('Error translating text:', error);
        throw error;
    }
}

async function saveDataToSupabase(table, data) {
    try {
        const { data: result, error } = await supabaseClient
            .from(table)
            .insert(data);
        if (error) throw error;
        return result;
    } catch (error) {
        console.error('Error saving data to Supabase:', error);
        throw error;
    }
}

async function fetchDataFromSupabase(table, query) {
    try {
        const { data, error } = await supabaseClient
            .from(table)
            .select()
            .match(query);
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error fetching data from Supabase:', error);
        throw error;
    }
}

module.exports = {
    fetchWeather,
    translateText,
    saveDataToSupabase,
    fetchDataFromSupabase
};
