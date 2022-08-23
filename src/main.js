/* © Copyright HCL Technologies Ltd. 2022 */

const core = require('@actions/core');
const client = require('./client');
const saclientutil = require('./saclientutil');
const asoc = require('./asoc');
const settings = require('./settings');

core.info('Downloading the SAClientUtil...');
saclientutil.downloadClient()
.then(() => {
    core.info('Generating irx file...');
    return client.generateIrx();
})
.then(() => {
    core.info('Authenticating with the ASoC service...');
    return client.login();
})
.then(() => {
    core.info('Submitting the irx for analysis...');
    return client.runAnalysis();
})
.then((scanId) => {
    return new Promise((resolve, reject) => {
        core.info('Scan successfully submitted to the ASoC service. ');
        core.info(`Scan ID: ${scanId}`)
        core.info(`${settings.getScanUrl(scanId)}`);

        if(!process.env.INPUT_WAIT_FOR_ANALYSIS) {
            return resolve();
        }

        client.waitForAnalysis(scanId)
        .then((timedOut) => {
            if(timedOut) {
                return resolve(constants.ANALYSIS_TIMEOUT);
            }
            return asoc.getScanResults(scanId);
        })
        .catch((error) => {
            return reject(error);
        })
    });
})
.catch((error) => {
    core.setFailed(error);
})
