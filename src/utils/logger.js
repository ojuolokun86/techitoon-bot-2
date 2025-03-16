const { formatMessage } = require('./utils');

const logInfo = (message) => {
    console.log(`ℹ️ INFO: ${formatMessage(message)}`);
};

const logWarning = (message) => {
    console.warn(`⚠️ WARNING: ${formatMessage(message)}`);
};

const logError = (message) => {
    console.error(`❌ ERROR: ${formatMessage(message)}`);
};

const logDebug = (message) => {
    console.debug(`🐞 DEBUG: ${formatMessage(message)}`);
};

const logSuccess = (message) => {
    console.log(`✅ SUCCESS: ${formatMessage(message)}`);
};

module.exports = {
    logInfo,
    logWarning,
    logError,
    logDebug,
    logSuccess,
};
