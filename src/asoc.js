/* © Copyright HCL Technologies Ltd. 2022 */

const got = require('got');
const constants = require('./constants');
const settings = require('./settings');
const utils = require('./utils');

let token = null

function login(key, secret) {
    return new Promise((resolve, reject) => {
        if(key && secret) {
            let url = settings.getServiceUrl() + constants.API_LOGIN;
            got.post(url, { json: { 'keyId': key, 'keySecret': secret, 'clientType': constants.CLIENT_TYPE }, retry: { limit: 3, methods: ['GET', 'POST'] } })
            .then((response) => {
                if(response.statusCode === 200 || response.statusCode === 201) {
                    let responseJson = JSON.parse(response.body);
                    token = responseJson.Token;
                    resolve();
                }
                else {
                    reject(`Failed to connect to ASoC. Response code ${response.statusCode}`);
                }
            })
            .catch((error) => {
                reject(error);
            })
        }
        else {
            reject('Missing API key/secret.');
        }
    })
}

function getScanResults(scanId) {
    return new Promise((resolve, reject) => {
        let key = utils.sanitizeString(process.env.INPUT_ASOC_KEY);
        let secret = utils.sanitizeString(process.env.INPUT_ASOC_SECRET);
        login(key, secret)
        .then(() => {
            return getNonCompliantIssues(scanId);
        })
        .catch((error) => {
            reject(error);
        })
    });
}

function getNonCompliantIssues(scanId) {
    return new Promise((resole, reject) => {
        let url = settings.getServiceUrl() + constants.API_SCAN_COUNT_BY_SEVERITY + scanId + '?applyPolicies=All';
        got.post(url, { json: { headers: getRequestHeaders() }, retry: { limit: 3, methods: ['GET', 'POST'] } })
        .then((response) => {
            let responseJson = JSON.parse(response.body);
            return resolve(processResults(responseJson));
        })
        .catch((error) => {
            reject(error);
        })
    });
}

function getRequestHeaders() {
    return {
        Authorization: "Bearer " + token,
        Accept: "application/json"
    }
}

function processResults(json) {
    return new Promise((resolve) => {
        let totalFindings = 0;
        let count = 0;
        let output = "";

        for(var i = 0; i < json.length; i++) {
            let element = json[i];
            totalFindings += element.Count;
            output += '\t' + element.Severity + ' = ' + element.Count + '\n';
            if(++count === json.length) {
                output = 'Total issues = ' + totalFindings + '\n' + output;
                resolve(output);
            }
        }
    });
}

module.exports = { getScanResults }
