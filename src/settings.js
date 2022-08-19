/* © Copyright HCL Technologies Ltd. 2022 */

const constants = require('./constants.js');

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
    return process.env.INPUT_SERVICE_URL ? process.env.INPUT_SERVICE_URL : constants.SERVICE_URL;
}

export default { getProxyUrl, getProxyPort, getProxyUser, getProxyPwd, getServiceUrl }
