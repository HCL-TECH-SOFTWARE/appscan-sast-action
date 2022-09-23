/*
Copyright 2022 HCL America, Inc.
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

const core = require('@actions/core');
const constants = require('./constants');
const client = require('./client');
const saclientutil = require('./saclientutil');
const asoc = require('./asoc');
const settings = require('./settings');

core.info(constants.DOWNLOADING_CLIENT);
saclientutil.downloadClient()
.then(() => {
    core.info(constants.GENERATING_IRX);
    return client.generateIrx();
})
.then(() => {
    core.info(constants.AUTHENTICATE_ASOC);
    return client.login();
})
.then(() => {
    core.info(constants.SUBMITTING_IRX);
    return client.runAnalysis();
})
.then((scanId) => {
    return new Promise((resolve, reject) => {
        core.info(constants.IRX_SUBMIT_SUCCESS);
        core.info(`Scan ID: ${scanId}`)
        core.info(`${settings.getScanUrl(scanId)}`);

        if(process.env.INPUT_WAIT_FOR_ANALYSIS === 'true') {
            core.info(constants.WAIT_FOR_ANALYSIS);
            client.waitForAnalysis(scanId)
            .then((timedOut) => {
                if(timedOut) {
                    return resolve(constants.ANALYSIS_TIMEOUT);
                }
                core.info(constants.GETTING_RESULTS);
                return asoc.getScanResults(scanId);
            })
            .then((results) => {
                core.info(results);
                core.info(constants.ANALYSIS_SUCCESS);
                return resolve();
            })
            .catch((error) => {
                return reject(error);
            })
        }
    });
})
.catch((error) => {
    core.setFailed(error);
})
