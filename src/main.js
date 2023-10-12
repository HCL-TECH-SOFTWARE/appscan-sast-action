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

import * as core from '@actions/core';
import * as constants from './constants';
import * as client from './client';
import * as saclientutil from './saclientutil';
import * as asoc from './asoc';
import * as settings from './settings';

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

        if(process.env.INPUT_WAIT_FOR_ANALYSIS !== 'true') {
            return resolve();
        }

        core.info(constants.WAIT_FOR_ANALYSIS);
        client.waitForAnalysis(scanId)
        .then((timedOut) => {
            if(timedOut) {
                core.warning(constants.ANALYSIS_TIMEOUT);
                return resolve();
            }
            core.info(constants.GETTING_RESULTS);
            return asoc.getScanResults(scanId);
        })
        .then((results) => {
            if(results) {
                core.info(results);
                core.info(constants.ANALYSIS_SUCCESS);
            }
            resolve();
        })
        .catch((error) => {
            return reject(error);
        })
    });
})
.catch((error) => {
    core.setFailed(error);
})
