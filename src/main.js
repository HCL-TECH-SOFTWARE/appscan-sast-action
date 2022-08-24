/* © Copyright HCL Technologies Ltd. 2022 */

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

        if(!process.env.INPUT_WAIT_FOR_ANALYSIS) {
            return resolve();
        }

        core.info(constants.WAIT_FOR_ANALYSIS);
        client.waitForAnalysis(scanId)
        .then((timedOut) => {
            if(timedOut) {
                return resolve(constants.ANALYSIS_TIMEOUT);
            }
            core.info(constants.GETTING_RESULTS);
            asoc.getScanResults(scanId)
            .then((results) => {
                core.info(constants.ANALYSIS_SUCCESS);
                core.info(results);
                resolve();
            });
        })
        .catch((error) => {
            return reject(error);
        })
    });
})
.catch((error) => {
    core.setFailed(error);
})
