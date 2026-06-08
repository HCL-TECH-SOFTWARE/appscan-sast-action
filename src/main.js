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

import * as core from '@actions/core';
import * as constants from './constants.js';
import client from './client.js';
import saclientutil from './saclientutil.js';
import asoc from './asoc.js';
import settings from './settings.js';

/*
 detect PR context
*/
const isPR = process.env.INPUT_IS_PR_SCAN === "true" || process.env.GITHUB_EVENT_NAME === "pull_request";
/*
 PR metadata from workflow inputs*/
const prNumber = process.env.INPUT_PR_NUMBER || "";
const branchName = process.env.INPUT_BRANCH_NAME || process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || "";
const repoName = process.env.INPUT_REPO_NAME || process.env.GITHUB_REPOSITORY || "";
const commitSha = process.env.GITHUB_SHA || "";
core.info(`GitHub Event: ${process.env.GITHUB_EVENT_NAME}`);
if (isPR) {
    core.info("Running SAST scan for Pull Request");
    core.info(`Repository: ${repoName}`);
    core.info(`PR Number: ${prNumber}`);
    core.info(`Branch: ${branchName}`);
    core.info(`Commit: ${commitSha}`);
}
else {
    core.info("Running SAST scan for Push/Manual trigger");
}
/*
 begin scan workflow
*/
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
         /*
         PR metadata logging
        */
        if (isPR) {
            core.info(`PR scan detected`);
            core.info(`PR branch: ${process.env.GITHUB_HEAD_REF}`);
        }
        if (process.env.INPUT_WAIT_FOR_ANALYSIS !== 'true') {
            return resolve();
        }
        core.info(constants.WAIT_FOR_ANALYSIS);
        client.waitForAnalysis(scanId)
        .then((timedOut) => {
            if (timedOut) {
                core.warning(constants.ANALYSIS_TIMEOUT);
                return resolve();
            }
            core.info(constants.GETTING_RESULTS);
            /*
             generate build summary + SARIF
             works for BOTH the push and PR
            */
            return asoc.getScanResults(scanId, {isPR, prNumber, branchName, repoName, commitSha});
        })
        .then((results) => {
            if (results) {
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
