/* © Copyright HCL Technologies Ltd. 2022 */

import { shell } from 'shelljs';
import { existsSync, createWriteStream, unlinkSync } from 'fs';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { parse } from 'url';
import { join } from 'path';
import { getProxyUrl, getProxyPort, getProxyUser, getProxyPwd } from './settings';
import { getOS, sanitizeString } from './utils';
import { SACLIENT_PATH, ERROR_DOWNLOADING_CLIENT, ERROR_FILE_DOES_NOT_EXIST, ERROR_INVALID_APP_ID } from './constants';

let script = getOS() === 'win' ? 'appscan.bat' : 'appscan.sh';
script = join('/SAClientUtil', 'bin', script);

shell.cd(process.env.GITHUB_WORKSPACE);

function downloadClient() {
    return new Promise((resolve, reject) => {
        let zipFile = join('/', 'SAClientUtil.zip');

        let zip = createWriteStream(zipFile);
        zip.on('finish', () => {
            zip.close();
        });
        zip.on('error', (e) => {
            unlinkSync(zipFile);
            reject(e);
        });
        zip.on('close', () => {
            extractClient(zipFile)
                .then(() => {
                    if(existsSync(script)) {
                        resolve(script);
                    }
                    else {
                        reject(ERROR_FILE_DOES_NOT_EXIST + script);
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
                    reject(ERROR_DOWNLOADING_CLIENT + response.statusCode);
                }
            });
    
            req.on('error', (e) =>  {
                    unlinkSync(zipFile);
                    reject(e);
            });
        })
    });
}

function extractClient(zipFile) {
    return new Promise((resolve, reject) => {
        if(!existsSync(zipFile)) {
            reject(ERROR_FILE_DOES_NOT_EXIST + zipFile);
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
        let endpoint = settings.getServiceUrl() + SACLIENT_PATH + getOS();
        let options = null;
        let proxyHost = getProxyUrl();
        let proxyPort = getProxyPort();
        let proxyUser = getProxyUser();
        let proxyPwd  = getProxyPwd();

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
            options = parse(endpoint);
            options.agent = new HttpsProxyAgent(proxy);
        } else { // Normal connection without proxy
            options = parse(endpoint);
        }

        resolve(options);
    });
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
    let key = sanitizeString(process.env.INPUT_ASOC_KEY);
    let secret = sanitizeString(process.env.INPUT_ASOC_SECRET);
    return executeCommand(`${script} api_login -u ${key} -P ${secret} `);
}

function runAnalysis() {
    let scanNameOption = sanitizeString(process.env.INPUT_SCAN_NAME);
    if(scanNameOption) {
        scanNameOption = '-n ' + scanNameOption;
    }
    else {
        scanNameOption = '';
    }

    let appId = sanitizeString(process.env.INPUT_APPLICATION_ID);
    if(!appId) {
        reject(ERROR_INVALID_APP_ID);
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

export default { downloadClient, generateIrx, login, runAnalysis }