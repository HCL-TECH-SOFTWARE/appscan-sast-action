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

import * as fs from 'fs';
import * as HttpsProxyAgent from 'https-proxy-agent';
import * as url from 'url';
import * as path from 'path';
import * as extract from 'extract-zip';
import * as https from 'https';
import * as os from 'os';
import settings from './settings.js';
import utils from './utils.js';
import constants from './constants.js';

let parentDir = os.homedir();
let script = utils.getOS() === 'win' ? 'appscan.bat' : 'appscan.sh';

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
                if(fs.existsSync(zipFile)) {
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

        if (process.env.INPUT_ACCEPTSSL) {
            options.rejectUnauthorized = false;
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

function getScript() {
    if(!fs.existsSync(script)) {
        downloadClient()
        .then(() => {
            return script;
        })
    }
    else {
        return script;
    }
}

export default { downloadClient, getScript }
