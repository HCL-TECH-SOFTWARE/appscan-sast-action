/*
Copyright 2022, 2026 HCL America, Inc.

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

import * as core from '@actions/core';
import * as fs from 'fs';
import got from 'got';
import * as constants from './constants.js';
import settings from './settings.js';
import utils from './utils.js';
import FormData from 'form-data';

let token = null
const key = utils.sanitizeString(process.env.INPUT_ASOC_KEY);
const secret = utils.sanitizeString(process.env.INPUT_ASOC_SECRET);
const enableSSL = !settings.shouldDisableSSL;

//These should already be masked, but just in case the user hardcoded values.
core.setSecret(key);
core.setSecret(secret);

function login() {
    return new Promise((resolve, reject) => {
        if(key && secret) {
            let url = settings.getServiceUrl() + constants.API_LOGIN;
            got.post(url, { json: { 'keyId': key, 'keySecret': secret, 'clientType': utils.getClientType() }, retry: { limit: 3, methods: ['GET', 'POST'] }, https: { rejectUnauthorized: enableSSL } })
            .then((response) => {
                if(response.statusCode === 200 || response.statusCode === 201) {
                    let responseJson = JSON.parse(response.body);
                    token = responseJson.Token;
                    core.setSecret(token);
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
        if(!scanId) {
            return resolve([]);
        }
        
        login()
        .then(() => {
            return resolve(getNonCompliantIssues(scanId));
        })
        .catch((error) => {
            reject(error);
        })
    });
}

function getNonCompliantIssues(scanId) {
	console.log("<<<<<<<<<<<<<< calling getNonCompliantIssues >>>>>>>>>>>>>>>");
    return new Promise((resolve, reject) => {
        let queryString = '?applyPolicies=All&%24top=100&%24apply=filter%28Status%20eq%20%27Open%27%20or%20Status%20eq%20%27InProgress%27%20or%20Status%20eq%20%27Reopened%27%20or%20Status%20eq%20%27New%27%29%2Fgroupby%28%28Severity%29%2Caggregate%28%24count%20as%20Count%29%29';
        let url = settings.getServiceUrl() + constants.API_ISSUES + scanId + queryString;
        got.get(url, { headers: getRequestHeaders(), retry: { limit: 3, methods: ['GET', 'POST'] }, https: { rejectUnauthorized: enableSSL } })
        .then((response) => {
            let responseJson = JSON.parse(response.body);
			console.log("<<<<<<<<<<<<<< responseJson getNonCompliantIssues >>>>>>>>>>>>>>>", responseJson.toString());
            resolve(responseJson);
        })
        .catch((error) => {
            reject(error);
        })
    });
}

function getRequestHeaders() {
    return {
        Authorization: "Bearer " + token,
        Accept: "application/json",
        ClientType: utils.getClientType()
    }
}

function runAnalysis(file) {
    return new Promise((resolve, reject) => {
        login()
        .then(() => {
            return uploadFile(file);
        })
        .then((fileId) => {
            return submitScans(fileId);
        })
        .then((scanIds) => {
            resolve(scanIds);
        })
        .catch((error) => {
            reject(error);
        });
    });
}

function uploadFile(file) {
    return new Promise((resolve, reject) => {
        const form = new FormData();
        form.append('uploadedFile', fs.createReadStream(file))
        let url = settings.getServiceUrl() + constants.API_FILE_UPLOAD;
        
        got.post(url, { body: form, headers: getRequestHeaders(), retry: { limit: 3, methods: ["GET", "POST"] }, https: { rejectUnauthorized: enableSSL } })
        .then((response) => {
            let responseJson = JSON.parse(response.body);
            resolve(responseJson.FileId);
        })
        .catch((error) => {
            reject(error);
        })
    });
}

function submitScans(fileId) {
    let sastScanId;
    return new Promise((resolve, reject) => {
        submitSastScan(fileId)
        .then((sastScan) => {
            sastScanId = sastScan;
            return submitScaScan(fileId);
        })
        .then((scaScanId) => {
            resolve({ sastScanId, scaScanId });
        })
        .catch((error) => {
            reject(error);
        })
    });
}

function submitScan(url, fileId) {
    return new Promise((resolve, reject) => {
        let appId = utils.sanitizeString(process.env.INPUT_APPLICATION_ID);
        let scanName = utils.sanitizeString(process.env.INPUT_SCAN_NAME);

        let body = {
            "ApplicationFileId": fileId,
            "AppId": appId,
            "ScanName": scanName,
            "Personal": process.env.INPUT_PERSONAL_SCAN === 'true',
            "FullyAutomatic": true,
            "EnableMailNotification": false
        };

        got.post(url, { json: body, headers: getRequestHeaders(), retry: { limit: 3, methods: ["GET", "POST"] }, https: { rejectUnauthorized: enableSSL } })
        .then((response) => {
            let responseJson = JSON.parse(response.body);
            resolve(responseJson.Id);
        })
        .catch((error) => {
            reject(error);
        })
    })
}

function submitRescan(scanId, fileId) {
    return new Promise((resolve, reject) => {
        let url = settings.getServiceUrl();
        url += constants.API_SCAN_EXECUTIONS.replace('{s}', scanId);
        let body = { FileId: fileId };

        got.post(url, { json: body, headers: getRequestHeaders(), retry: { limit: 3, methods: ["GET", "POST"] }, https: { rejectUnauthorized: enableSSL } })
        .then((response) => {
            let responseJson = JSON.parse(response.body);
            resolve(responseJson.ScanId);
        })
        .catch((error) => {
            reject(error);
        })
    })
}

function submitScaScan(fileId) {
    return new Promise((resolve, reject) => {
        if(process.env.INPUT_STATIC_ANALYSIS_ONLY === 'true'
            || process.env.INPUT_SECRETS_ONLY === 'true')
        {
            return resolve();
        }

        Promise.resolve()
        .then(() => {
            if(process.env.INPUT_SCA_SCAN_ID) {
                let rescanId = utils.sanitizeString(process.env.INPUT_SCA_SCAN_ID);
                return submitRescan(rescanId, fileId)
            }
            else {
                let url = settings.getServiceUrl() + constants.API_SCA_SCAN;
                return submitScan(url, fileId)
            }
        })
        .then((scanId) => {
            resolve(scanId);
        })
        .catch((error) => {
            reject(error);
        });
    })
}

function submitSastScan(fileId) {
    return new Promise((resolve, reject) => {
        if(process.env.INPUT_OPEN_SOURCE_ONLY === 'true') {
            return resolve();
        }

        Promise.resolve()
        .then(() => {
            if(process.env.INPUT_SAST_SCAN_ID) {
                let rescanId = utils.sanitizeString(process.env.INPUT_SAST_SCAN_ID);
                return submitRescan(rescanId, fileId);
            }
            else {
                let url = settings.getServiceUrl() +constants.API_SAST_SCAN;
                return submitScan(url, fileId)
            }
        })
        .then((scanId) => {
            resolve(scanId);
        })
        .catch((error) => {
            reject(error);
        })
    })
}

async function getScaScanStatus(scanId) {
    let url = settings.getServiceUrl() + constants.API_SCA_SCAN + '/' + scanId;
    let status = await getScanStatus(url, scanId);
    return status;
}

async function getSastScanStatus(scanId) {
    let url = settings.getServiceUrl() + constants.API_SAST_SCAN + '/' + scanId;
    let status = await getScanStatus(url, scanId);
    return status;
}

async function getScanStatus(url, scanId) {
    let response = await got.get(url, { headers: getRequestHeaders(), retry: { limit: 3, methods: ["GET"] }, https: { rejectUnauthorized: enableSSL } })
    let responseJson = JSON.parse(response.body);
    return responseJson.LatestExecution.Status;
}

export default { getScanResults, runAnalysis, getSastScanStatus, getScaScanStatus }
