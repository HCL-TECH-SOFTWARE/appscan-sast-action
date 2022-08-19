/* © Copyright HCL Technologies Ltd. 2022 */

const core = require('@actions/core');
const client = require('./client');
const saclientutil = require('./saclientutil');
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
    core.info('Scan successfully submitted to the ASoC service. ');
    core.info(`Scan ID: ${scanId}`)
    core.info(`Scan results will be available at: ${settings.getScanUrl(scanId)}`);
})
.catch((error) => {
    core.setFailed(error);
})
