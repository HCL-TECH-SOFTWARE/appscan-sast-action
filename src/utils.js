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

import * as constants from './constants.js';

let os = null;

function getOS() {
    if(!os) {
        let platform = process.platform;
        if (platform === 'darwin') {
            os = 'mac';
        } else if (platform === 'win32') {
            os = 'win';
        } else {
            os = 'linux';
        }
    }

    return os;
}

function sanitizeString(input) {
    if(input) {
        input = input.replace('[^a-zA-Z0-9\\-\\._:\\/]', '');
    }
    return input;
}

function getClientType() {
    return constants.CLIENT_TYPE + '-' + getOS() + '-' + getVersion();
}

function getVersion() {
    return constants.CURRENT_VERSION;
}

export default { getOS, sanitizeString, getClientType, getVersion }