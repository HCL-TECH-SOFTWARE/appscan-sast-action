import asoc from './asoc.js';

let start = null;
const timed_out = 'timed_out';
const timeout_minutes = process.env.INPUT_ANALYSIS_TIMEOUT ? parseInt(process.env.INPUT_ANALYSIS_TIMEOUT) : 30;
const running_statuses = ['Running', 'InQueue', 'Pending'];

function waitForAnalysis(sastScanId, scaScanId) {
    return new Promise((resolve, reject) => {
        waitForSastAnalysis(sastScanId)
        .then(() => {
            return waitForScaAnalysis(scaScanId);
        })
        .then((status) => {
            resolve(status === timed_out);
        })
        .catch((error) => {
            reject(error);
        })
    });
}

async function waitForScaAnalysis(scanId) {
    if(!scanId) {
        return;
    }

    if(!start) {
        start = Date.now();
    }
    
    let result = await asoc.getScaScanStatus(scanId);
    while(running_statuses.includes(result)) {
        await sleep(30000);
        if(analysisTimedOut()) {
            return timed_out;
        }
        result = await asoc.getScaScanStatus(scanId);
    }
    return result;
}

async function waitForSastAnalysis(scanId) {
    if(!scanId) {
        return;
    }

    if(!start) {
        start = Date.now();
    }

    let result = await asoc.getSastScanStatus(scanId);
    while(running_statuses.includes(result)) {
        await sleep(30000);
        if(analysisTimedOut()) {
            return timed_out;
        }
        result = await asoc.getSastScanStatus(scanId);
    }
    return result;
}

async function sleep(ms) {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    })
}

function analysisTimedOut() {
    let seconds = (Date.now() - start) / 1000;
    let minutes = seconds / 60;
    return minutes > timeout_minutes;
}

export default { waitForAnalysis}