/*Copyright 2022 HCL Technologies Ltd.

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

const eol = require('eol');
const shell = require('shelljs');
const constants = require('./constants');
const saclientutil = require('./saclientutil');
const utils = require('./utils');

let start = null;
const timeout_minutes = process.env.INPUT_ANALYSIS_TIMEOUT_MINUTES ? process.env.INPUT_ANALYSIS_TIMEOUT_MINUTES : 30;

shell.cd(process.env.GITHUB_WORKSPACE);
process.env.APPSCAN_IRGEN_CLIENT = constants.CLIENT_TYPE;
process.env.IRGEN_CLIENT_PLUGIN_VERSION = utils.getVersion();

function generateIrx() {
    let args = '-sco '; //Default to running source code only scans.

    if(isArgumentEnabled(process.env.INPUT_STATIC_ANALYSIS_ONLY)) {
        args += '-sao ';
    }
    if(isArgumentEnabled(process.env.INPUT_OPEN_SOURCE_ONLY)) {
        args += '-oso ';
    }
    if(isArgumentEnabled(process.env.INPUT_SCAN_BUILD_OUTPUTS)) {
        args.replace('-sco ', '');
    }

    return executeCommand(`prepare ${args}`);
}

function login() {
    let key = utils.sanitizeString(process.env.INPUT_ASOC_KEY);
    let secret = utils.sanitizeString(process.env.INPUT_ASOC_SECRET);
    return executeCommand(`api_login -u ${key} -P ${secret} `);
}

function runAnalysis() {
    return new Promise((resolve, reject) => {
        let args = '';

        let scanNameOption = utils.sanitizeString(process.env.INPUT_SCAN_NAME);
        if(scanNameOption) {
            args += '-n ' + scanNameOption;
        }

        if(isArgumentEnabled(process.env.INPUT_PERSONAL_SCAN)) {
            args += ' -ps';
        }

        let appId = utils.sanitizeString(process.env.INPUT_APPLICATION_ID);
        if(!appId) {
            reject(constants.ERROR_INVALID_APP_ID);
            return;
        }

        executeCommand(`queue_analysis -a ${appId} ${args}`)
        .then((stdout) => {
            //Get the scan id from stdout and return it.
            let lines = eol.split(stdout);
            resolve(lines[lines.length - 2]);
        })
        .catch((error) => {
            reject(error);
        })
    });
}

function checkStatus(scanId) {
    return executeCommand(`status -i ${scanId}`);
}

function waitForAnalysis(scanId) {
    return new Promise((resolve, reject) => {
        if(!start) {
            start = Date.now();
        }

        checkStatus(scanId)
        .then((stdout) => {
            if(stdout.trim() === 'Ready') {
                return resolve(false);
            }
            else if(stdout.trim() === 'Failed') {
                return reject(constants.ERROR_ANALYSIS_FAILED);
            }
            else if(analysisTimedOut()) {
                return resolve(true);
            }
            else {
                setTimeout(() => {
                    return resolve(waitForAnalysis(scanId));
                }, 30000)
            }
        })
        .catch((error) => {
            reject(error);
        })
    });
}

function executeCommand(args) {
    return new Promise((resolve, reject) => {
        let script = saclientutil.getScript();
        let result = shell.exec(`${script} ${args}`);
        if(result.code === 0) {
            resolve(result.stdout);
         }
         else {
            reject(result.stderr);
         }
    });
}

function isArgumentEnabled(arg) {
    return arg && arg === 'true';
}

function analysisTimedOut() {
    let seconds = (Date.now() - start) / 1000;
    let minutes = seconds / 60;
    return minutes > timeout_minutes;
}

module.exports = { generateIrx, login, runAnalysis, waitForAnalysis }
