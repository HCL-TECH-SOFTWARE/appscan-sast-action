/* © Copyright HCL Technologies Ltd. 2022 */

const eol = require('eol');
const shell = require('shelljs');
const constants = require('./constants');
const saclientutil = require('./saclientutil');
const utils = require('./utils');

shell.cd(process.env.GITHUB_WORKSPACE);

let script = saclientutil.getScript();

function generateIrx() {
    let args = '-sco '; //Default to running source code only scans.

    if(isArgumentEnabled(process.env.INPUT_STATIC_ANALYSIS_ONLY)) {
        args += '-sao ';
    }
    if(isArgumentEnabled(process.env.INPUT_OPEN_SOURCE_ONLY)) {
        args += '-oso ';
    }
    if(isArgumentEnabled(process.env.INPUT_RUN_BUILD)) {
        args.replace('-sco ', '');
    }

    return executeCommand(`${script} prepare ${args}`);
}

function login() {
    let key = utils.sanitizeString(process.env.INPUT_ASOC_KEY);
    let secret = utils.sanitizeString(process.env.INPUT_ASOC_SECRET);
    return executeCommand(`${script} api_login -u ${key} -P ${secret} `);
}

function runAnalysis() {
    return new Promise((resolve, reject) => {
        let scanNameOption = utils.sanitizeString(process.env.INPUT_SCAN_NAME);
        if(scanNameOption) {
            scanNameOption = '-n ' + scanNameOption;
        }
        else {
            scanNameOption = '';
        }

        let appId = utils.sanitizeString(process.env.INPUT_APPLICATION_ID);
        if(!appId) {
            reject(constants.ERROR_INVALID_APP_ID);
            return;
        }

        executeCommand(`${script} queue_analysis -a ${appId} ${scanNameOption}`)
        .then((stdout) => {
            //Get the scan id from stdout and return it.
            let lines = eol.split(stdout);
            resolve(line[lines.length - 1]);
        })
        .catch((error) => {
            reject(error);
        })
    });
}

function executeCommand(command) {
    return new Promise((resolve, reject) => {
        let result = shell.exec(command);
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

module.exports = { generateIrx, login, runAnalysis }
