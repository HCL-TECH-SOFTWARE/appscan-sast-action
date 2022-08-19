/* © Copyright HCL Technologies Ltd. 2022 */

const core = require('@actions/core');
const saclientutil = require('./saclientutil');

core.info('Downloading the SAClientUtil...');
saclientutil.downloadClient()
.then(() => {
    core.info('Generating irx file...');
    return saclientutil.generateIrx();
})
.then(() => {
    core.info('Authenticating with the ASoC service...');
    return saclientutil.login();
})
.then(() => {
    core.info('Submitting the irx for analysis...');
    return saclientutil.runAnalysis();
})
.then(() => {
    core.info('Scan successfully submitted to the ASoC service.');
})
.catch((error) => {
    core.setFailed(error);
})
