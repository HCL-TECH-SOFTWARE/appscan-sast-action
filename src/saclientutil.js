/* © Copyright HCL Technologies Ltd. 2022 */

const shell = require('shelljs');
const fs =  require('fs');
const HttpsProxyAgent = require('https-proxy-agent');
const url = require('url');
const path = require('path');
const extract = require('extract-zip');
const https = require('https');
const os = require('os');
const settings = require('./settings');
const utils = require('./utils');
const constants = require('./constants');

let parentDir = os.homedir();
let script = utils.getOS() === 'win' ? 'appscan.bat' : 'appscan.sh';

shell.cd(process.env.GITHUB_WORKSPACE);

function downloadClient() {
    return new Promise((resolve, reject) => {
        let zipFile = path.join(parentDir, 'SAClientUtil.zip');
        if(fs.existsSync(zipFile)) {
            fs.unlinkSync(zipFile);
        }

        let zip = fs.createWriteStream(zipFile);
        zip.on('finish', () => {
            zip.close();
        });
        zip.on('error', (e) => {
            reject(e);
        });
        zip.on('close', () => {
            extractClient(zipFile)
                .then(() => {
                    script = path.join(getClientDir(), 'bin', script);
                    if(fs.existsSync(script)) {
                        resolve(script);
                    }
                    else {
                        reject(constants.ERROR_FILE_DOES_NOT_EXIST + script);
                    }
                })
                .catch((error) => {
                    reject(error);
                });
        });
        
    
        getRequestOptions()
        .then((options) => {
            let req = https.get(options, (response) => {
                if(response.statusCode >= 200 && response.statusCode < 300) {
                    response.pipe(zip);
                } 
                else {
                    reject(constants.ERROR_DOWNLOADING_CLIENT + response.statusCode);
                }
            });
    
            req.on('error', (e) =>  {
                if(fs.e(zipFile)) {
                    fs.unlinkSync(zipFile);
                }
                reject(e);
            });
        })
    });
}

function extractClient(zipFile) {
    return new Promise((resolve, reject) => {
        if(!fs.existsSync(zipFile)) {
            reject(constants.ERROR_FILE_DOES_NOT_EXIST + zipFile);
            return;
        }

        extract(zipFile, {dir: path.dirname(zipFile)}, (err) => {
            if(err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

function getRequestOptions() {
    return new Promise((resolve) => {
        let endpoint = settings.getServiceUrl() + constants.SACLIENT_PATH + utils.getOS();
        let options = null;
        let proxyHost = settings.getProxyUrl();
        let proxyPort = settings.getProxyPort();
        let proxyUser = settings.getProxyUser();
        let proxyPwd  = settings.getProxyPwd();

        if (proxyHost && proxyPort) {  //Connection through proxy
            let proxy = null;

            if (proxyUser && proxyPwd) {
                let auth = 'Basic ' + Buffer.from(proxyUser + ':' + proxyPwd).toString('base64');
                proxy = {
                    protocol: 'https:',
                    host: proxyHost, 
                    port: proxyPort,
                    username: proxyUser,
                    password: proxyPwd,
                    headers: {
                        'Proxy-Authorization': auth
                    }
                }
            } else {
                proxy = {
                    protocol: 'https:',
                    host: proxyHost, 
                    port: proxyPort
                }
            }			
            options = url.parse(endpoint);
            options.agent = new HttpsProxyAgent(proxy);
        } else { // Normal connection without proxy
            options = url.parse(endpoint);
        }

        resolve(options);
    });
}

function getClientDir() {
    let files = fs.readdirSync(parentDir);
    let clientDirs = new Array();

    files.forEach((file) => {
        try {
            if(fs.lstatSync(parentDir + path.sep + file).isDirectory() && file.startsWith("SAClientUtil"))
                clientDirs.push(parentDir + path.sep + file);
        } catch(e) {
            //ignore and continue
        }
    });

    if(clientDirs.length > 1) {
        let clientDir = clientDirs[0];
        for(let iter = 1; iter < clientDirs.length; iter++) {
            if(compareVersions(clientDir, clientDirs[iter])) {
                clientDir = clientDirs[iter];
            }	
        }

        return clientDir;
    }
    else {
        return clientDirs.length === 0 ? undefined : clientDirs[0];
    }
}

function compareVersions(oldVersion, newVersion) {
    if(oldVersion === undefined || newVersion === undefined)
        return true;
    
    //Trim down to just SAClientUtil.x.x.x
    oldVersion = oldVersion.substring(oldVersion.indexOf("SAClientUtil"), oldVersion.length);
    newVersion = newVersion.substring(newVersion.indexOf("SAClientUtil"), newVersion.length);
    let old = oldVersion.split('.');
    let next = newVersion.split('.');

    //Format of version is SAClientUtil.A.B.C
    for(let iter = 1; iter < old.length && iter < next.length; iter++) {
        if(iter === 1 && old[iter] < next[iter] ||
            iter === 2 && old[iter] < next[iter] ||
            iter === 3 && old[iter] < next[iter]) {
                return true;
            }
    }

    return false;
}


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

    return executeCommand(`${script} queue_analysis -a ${appId} ${scanNameOption}`);
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

module.exports = { downloadClient, generateIrx, login, runAnalysis }