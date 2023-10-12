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

let serviceUrl = null;

function getProxyUrl() {
    return process.env.INPUT_PROXY_URL;
}

function getProxyPort() {
    return process.env.INPUT_PROXY_PORT;
}

function getProxyUser() {
    return process.env.INPUT_PROXY_USER;
}

function getProxyPwd() {
    return process.env.INPUT_PROXY_PWD;
}

function getServiceUrl() {
    if(!serviceUrl) {
        if(process.env.INPUT_SERVICE_URL) {
            serviceUrl = process.env.INPUT_SERVICE_URL;
        }
        else {
            serviceUrl = constants.SERVICE_URL;
            asoc_key = process.env.INPUT_ASOC_KEY;
            if(asoc_key && asoc_key.startsWith('eu-central')) {
                serviceUrl += '/eu';
            }
        }
    }
    return serviceUrl;
}

function getScanUrl(scanId) {
    return `${getServiceUrl()}/main/myapps/${process.env.INPUT_APPLICATION_ID}/scans/${scanId}/scanOverview`;
}

export default { getProxyUrl, getProxyPort, getProxyUser, getProxyPwd, getServiceUrl, getScanUrl }
