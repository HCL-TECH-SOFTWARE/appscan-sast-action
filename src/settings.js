/* © Copyright HCL Technologies Ltd. 2022 */

const constants = require('./constants.js');

let serviceUrl = null;

function getProxyUrl() {
    return process.env.INPUT_PROXY_URL;
}

function getProxyPort() {
    return process.env.INPUT_PROXY_PORT;
}

function getProxyUser() {
    return process.env.INPUT_PROXY_USER;
}

function getProxyPwd() {
    return process.env.INPUT_PROXY_PWD;
}

function getServiceUrl() {
    if(!serviceUrl) {
        if(process.env.INPUT_SERVICE_URL) {
            serviceUrl = process.env.INPUT_SERVICE_URL;
        }
        else {
            serviceUrl = constants.SERVICE_URL;
            asoc_key = process.env.INPUT_ASOC_KEY;
            if(asoc_key && asoc_key.startsWith('eu-central')) {
                serviceUrl += '/eu';
            }
        }
    }
    return serviceUrl;
}

function getScanUrl(scanId) {
    return `${getServiceUrl()}/main/myapps/${process.env.APPLICATION_ID}/scans/${scanId}/scanOverview`;
}

module.exports = { getProxyUrl, getProxyPort, getProxyUser, getProxyPwd, getServiceUrl, getScanUrl }
