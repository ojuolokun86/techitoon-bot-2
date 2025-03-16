// filepath: /c:/Users/ADMIN/Desktop/Techitoon-Bot-1/src/services/ocrService.js
const tesseract = require('tesseract.js');
const fs = require('fs');
const path = require('path');

// Recognize text from image using OCR (Tesseract.js)
async function recognizeTextFromImage(imagePath) {
    try {
        const { data: { text } } = await tesseract.recognize(imagePath, 'eng', {
            logger: (m) => console.log(m),
        });
        console.log('Recognized Text:', text);
        return text;
    } catch (err) {
        console.error('OCR failed:', err);
        return null;
    }
}

// Analyze the text to detect match results, fixtures, or complaints
function analyzeRecognizedText(text) {
    // Check if the text contains match results or fixtures
    if (text.includes("vs")) {
        // Assume the text contains match results or fixture info
        const fixtureMatch = parseMatchFixture(text);
        if (fixtureMatch) {
            console.log('Fixture/Match Found:', fixtureMatch);
            return { type: 'fixture', data: fixtureMatch };
        }
    } else if (text.toLowerCase().includes("complaint")) {
        // Handle complaints
        console.log('Complaint Found:', text);
        return { type: 'complaint', data: text };
    } else {
        console.log('Unable to recognize valid fixture/result/complaint in text');
        return { type: 'unknown', data: text };
    }
}

// Parse the match fixture from recognized text (this will be a simple example)
function parseMatchFixture(text) {
    const regex = /([A-Za-z0-9 ]+) vs ([A-Za-z0-9 ]+)/;
    const match = text.match(regex);
    
    if (match) {
        const team1 = match[1].trim();
        const team2 = match[2].trim();
        return {
            match: `${team1} vs ${team2}`,
            time: new Date().toLocaleString() // Example, you could parse time if available
        };
    }
    return null;
}

module.exports = { recognizeTextFromImage, analyzeRecognizedText };