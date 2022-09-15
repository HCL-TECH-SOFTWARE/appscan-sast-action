/* © Copyright HCL Technologies Ltd. 2022 */

const constants = require('./constants');

let os = null;

function getOS() {
    if(!os) {
        let platform = process.platform;
        if (platform === 'darwin') {
            os = 'mac';
        } else if (platform === 'win32') {
            os = 'win';
        } else {
            os = 'linux';
        }
    }

    return os;
}

function sanitizeString(input) {
    if(input) {
        input = input.replace('[^a-zA-Z0-9\\-\\._]', '');
    }
    return input;
}

function getClientType() {
    return constants.CLIENT_TYPE + '-' + getOS() + '-' + getVersion();
}

function getVersion() {
    return constants.CURRENT_VERSION;
}

module.exports = { getOS, sanitizeString, getClientType, getVersion }