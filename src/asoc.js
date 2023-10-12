/*
Copyright 2022, 2023 HCL America, Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import * as got from 'got';
import * as constants from './constants.js';
import * as resultProcessor from './resultProcessor.js';
import * as settings from './settings.js';
import * as utils from './utils.js';

let token = null

function login(key, secret) {
    return new Promise((resolve, reject) => {
        if(key && secret) {
            let url = settings.getServiceUrl() + constants.API_LOGIN;
            got.post(url, { json: { 'keyId': key, 'keySecret': secret, 'clientType': utils.getClientType() }, retry: { limit: 3, methods: ['GET', 'POST'] } })
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
            return resolve(getNonCompliantIssues(scanId));
        })
        .catch((error) => {
            reject(error);
        })
    });
}

function getNonCompliantIssues(scanId) {
    return new Promise((resolve, reject) => {
        let url = settings.getServiceUrl() + constants.API_SCAN_COUNT_BY_SEVERITY + scanId + '?applyPolicies=All';
        got.get(url, { headers: getRequestHeaders(), retry: { limit: 3, methods: ['GET', 'POST'] } })
        .then((response) => {
            let responseJson = JSON.parse(response.body);
            return resultProcessor.processResults(responseJson);
        })
        .then((result) => {
            resolve(result);
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

module.exports = { getScanResults }
