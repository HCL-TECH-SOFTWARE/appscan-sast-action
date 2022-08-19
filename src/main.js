/* © Copyright HCL Technologies Ltd. 2022 */

const core = require('@actions/core');
const saclientutil = require('./saclientutil');

core.info('Downloading the SAClientUtil...');
saclientutil.downloadClient()
.then(() => {
    core.info('Generating irx file...');
    return saclientutil.generateIrx();
})
.then((message) => {
    core.info(message);
    core.info('Authenticating with the ASoC service...');
    return saclientutil.login();
})
.then((message) => {
    core.info(message);
    core.info('Submitting the irx for analysis...');
    return saclientutil.runAnalysis();
})
.then((message) => {
    core.info('Scan successfully submitted to the ASoC service.');
    core.info(message);
})
.catch((error) => {
    core.setFailed(error);
})
