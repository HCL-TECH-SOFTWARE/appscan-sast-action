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

import * as fs from 'fs';
import HttpsProxyAgent from 'https-proxy-agent';
import { URL } from 'url';
import * as path from 'path';
import extract from 'extract-zip';
import * as https from 'https';
import * as os from 'os';
import * as constants from './constants.js';
import settings from './settings.js';
import utils from './utils.js';

let parentDir = path.join(os.homedir(), '.appscan');
if(!fs.existsSync(parentDir)) {
    fs.mkdirSync(parentDir);
}

let scriptName = utils.getOS() === 'win' ? 'appscan.bat' : 'appscan.sh';
let clientDir = getClientDir();
let script = clientDir ? path.join(clientDir, 'bin', scriptName) : undefined;

function downloadClient() {
    return new Promise((resolve, reject) => {
        let zipFile = path.join(parentDir, 'SAClientUtil.zip');
        if(fs.existsSync(zipFile)) {
            fs.unlinkSync(zipFile);
        }

        let zip = fs.createWriteStream(zipFile);
        zip.on('finish', () => {
			console.log("Debug D1 finish event");
            zip.close();
        });
        zip.on('error', (e) => {
			console.log("Debug D2 zip error");
			console.log(e);
            reject(e);
        });
        zip.on('close', () => {
			console.log("Debug D3 close event");
            extractClient(zipFile)
                .then(() => {
                    script = path.join(getClientDir(), 'bin', scriptName);
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
                if(fs.existsSync(zipFile)) {
                    fs.unlinkSync(zipFile);
                }
                reject(e);
            });
        })
        .catch((error) => {
            reject(error);
        })
    });
}

function extractClient(zipFile) {
    return new Promise((resolve, reject) => {
        if(!fs.existsSync(zipFile)) {
            reject(constants.ERROR_FILE_DOES_NOT_EXIST + zipFile);
            return;
        }

        extract(zipFile, {dir: path.dirname(zipFile)})
        .then(() => {
			console.log("Debug X1: parentdir: ", parentDir);
			console.log("Debug X2: files: ", fs.readdirSync(parentDir));
			console.log("Debug X3: getClientDir: ", getClientDir());
            resolve();
        })
        .catch((error) => {
            reject(error);
        })
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
            options = new URL(endpoint);
            options.agent = new HttpsProxyAgent(proxy);
        } else { // Normal connection without proxy
            options = new URL(endpoint);
        }

        if (settings.shouldDisableSSL()) {
            options.rejectUnauthorized = false;
        }

        resolve(options);
    });
}

function getClientDir() {
	console.log("Debug gd1 parentdir: ", parentDir);
    let files = fs.readdirSync(parentDir);
	console.log("Debug gd2 files: ", files);
    let clientDirs = new Array();

    files.forEach((file) => {
        try {
            if(fs.lstatSync(parentDir + path.sep + file).isDirectory() && file.startsWith("SAClientUtil"))
                clientDirs.push(parentDir + path.sep + file);
        } catch(e) {
			console.log("Debug gd3 error processing: ", file);
			console.log(e);
            //ignore and continue
        }
    });
	console.log("Debug gd4 clientdirs: ", clientDirs);
	
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

function getScript() {
	console.log("Debug GS1 script: ", script);
	console.log("Debug GS2 clientDir: ", clientDir);
    return new Promise((resolve, reject) => {
		console.log("Debug GS3 existsSync arg: ", script);
        if(!fs.existsSync(script)) {
            downloadClient()
            .then(() => {
                resolve(script);
            })
            .catch((error) => {
                reject(error);
            })
        }
        else {
            resolve(script);
        }
    })
}

export default { downloadClient, getScript }
