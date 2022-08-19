/* © Copyright HCL Technologies Ltd. 2022 */

const core = require('@actions/core');
import { downloadClient } from './saclientutil';

core.info('Downloading the SAClientUtil...');
downloadClient()
.then(() => {
    core.info('Generating irx file...');
    return generateIrx();
})
.then((message) => {
    core.info(message);
    core.info('Authenticating with the ASoC service...');
    return login();
})
.then((message) => {
    core.info(message);
    core.info('Submitting the irx for analysis...');
    return runAnalysis();
})
.then((message) => {
    core.info('Scan successfully submitted to the ASoC service.');
    core.info(message);
})
.catch((error) => {
    core.setFailed(error);
})
