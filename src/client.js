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

import child_process from 'child_process';
import saclientutil from './saclientutil.js';
import utils from './utils.js';
import settings from './settings.js';
import * as fs from 'fs';

process.env.APPSCAN_IRGEN_CLIENT = 'GitHubSast';
process.env.IRGEN_CLIENT_PLUGIN_VERSION = utils.getVersion();

function generateIrx() {
    let args = ['prepare'];

    if(!isArgumentEnabled(process.env.INPUT_SCAN_BUILD_OUTPUTS)) {
        args.push('-sco');
    }

    if(isArgumentEnabled(process.env.INPUT_STATIC_ANALYSIS_ONLY)) {
        args.push('-sao');
    }
    if(isArgumentEnabled(process.env.INPUT_OPEN_SOURCE_ONLY)) {
        args.push('-oso');
    }
    if(isArgumentEnabled(process.env.INPUT_SECRETS_ONLY)) {
        args.push('-so');
        args.push('-sao');
    }

    return executeCommand(args);
}

function executeCommand(args) {
    return new Promise((resolve, reject) => {
        if (settings.shouldDisableSSL()) {
            args.push('-acceptssl');
        }

        saclientutil.getScript()
        .then((script) => {
            const child = child_process.spawn(script, args, { 
                encoding: 'utf-8',
                cwd: process.env.GITHUB_WORKSPACE
            });

            child.stdout.on('data', (data) => {
                console.log(data.toString());
            });

            child.stderr.on('data', (data) => {
                console.error(data.toString());
            });

            child.on('close', (code) => {
                resolve(getIrxFiles());
            });
        })
        .catch((error) => {
            reject(error);
        })
    });
}

function isArgumentEnabled(arg) {
    return arg && arg === 'true';
}

function getIrxFiles() {
    const files = fs.readdirSync(process.env.GITHUB_WORKSPACE);
    return files.filter(file => path.extname(file).toLowerCase() === '.irx');
}

export default { generateIrx }
