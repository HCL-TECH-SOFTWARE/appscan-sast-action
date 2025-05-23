/*
Copyright 2022, 2025 HCL America, Inc.

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

import eol from 'eol';
import shell from 'shelljs';
import * as constants  from './constants.js';
import saclientutil from './saclientutil.js';
import utils from './utils.js';

let start = null;
const timeout_minutes = process.env.INPUT_ANALYSIS_TIMEOUT_MINUTES ? process.env.INPUT_ANALYSIS_TIMEOUT_MINUTES : 30;

shell.cd(process.env.GITHUB_WORKSPACE);
process.env.APPSCAN_IRGEN_CLIENT = 'GitHubSast';
process.env.IRGEN_CLIENT_PLUGIN_VERSION = utils.getVersion();

function generateIrx() {
    let args = '-sco '; //Default to running source code only scans.

    if(isArgumentEnabled(process.env.INPUT_STATIC_ANALYSIS_ONLY)) {
        args += '-sao ';
    }
    if(isArgumentEnabled(process.env.INPUT_OPEN_SOURCE_ONLY)) {
        args += '-oso ';
    }
    if(isArgumentEnabled(process.env.INPUT_SECRETS_ONLY)) {
        args += '-so ';
        args += '-sao ';
    }
	
    if(isArgumentEnabled(process.env.INPUT_SCAN_BUILD_OUTPUTS)) {
        args = args.replace('-sco ', '');
    }

    return executeCommand(`prepare ${args}`);
}

function login() {
    let key = utils.sanitizeString(process.env.INPUT_ASOC_KEY);
    let secret = utils.sanitizeString(process.env.INPUT_ASOC_SECRET);
    let options = "api_login -u " + key + " -P " + secret;
    if (process.env.INPUT_SERVICE_URL) {
	    let service_url = utils.sanitizeString(process.env.INPUT_SERVICE_URL);
	    options += " -service_url " + service_url;
    }
    
    return executeCommand(`${options}`);
}

function runAnalysis() {
    return new Promise((resolve, reject) => {
        let args = '';

        let scanNameOption = utils.sanitizeString(process.env.INPUT_SCAN_NAME);
        if(scanNameOption) {
            args += '-n \"' + scanNameOption + '\"';
        }

        if(isArgumentEnabled(process.env.INPUT_PERSONAL_SCAN)) {
            args += ' -ps';
        }
		
        let commentOption = utils.sanitizeString(process.env.INPUT_COMMENT);
        if (commentOption) {
            args += ' -c \"' + commentOption + '\"';
        }

        let appId = utils.sanitizeString(process.env.INPUT_APPLICATION_ID);
        if(!appId) {
            reject(constants.ERROR_INVALID_APP_ID);
            return;
        }
		
        executeCommand(`queue_analysis -a ${appId} ${args}`)
        .then((stdout) => {
            //Get the scan id from stdout and return it.
            return getScanId(stdout);
        })
        .then((scanId) => {
            resolve(scanId);
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
        if (process.env.INPUT_ACCEPTSSL) {
            args += " -acceptssl";
        }

        saclientutil.getScript()
        .then((script) => {
            let result = shell.exec(`${script} ${args}`);
            if(result.code === 0) {
                resolve(result.stdout);
            }
            else {
                reject(result.stderr);
            }
        })
        .catch((error) => {
            reject(error);
        })
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

function getScanId(output) {
    return new Promise((resolve) => {
        let lines = eol.split(output.trim());
        let scanId = lines[lines.length - 1];
        //Make sure we have a valid scan id.
        let regex = /[0-9a-fA-f]{8}-[0-9a-fA-f]{4}-[0-9a-fA-f]{4}-[0-9a-fA-f]{4}-[0-9a-fA-f]{12}/;
        let matches = scanId.match(regex);
        
        if(!matches) {
            //If we didn't get a match, check the previous line
            scanId = lines[lines.length - 2];
            matches = scanId.match(regex);
            if(!matches) {
                //If still no match, log it.
                return resolve(constants.NO_SCAN_ID);
            }
        }

        resolve(matches[0]);
    })
}

export default { generateIrx, login, runAnalysis, waitForAnalysis }
