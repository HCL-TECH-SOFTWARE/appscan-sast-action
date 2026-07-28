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

import asoc from './asoc.js';
import * as constants from './constants.js';
import statusChecker from './statusChecker.js';
import summaryWriter from './summaryWriter.js';

const failForNonCompliance = process.env.INPUT_FAIL_FOR_NONCOMPLIANCE === 'true';
const failureThreshold = getSeverityValue(process.env.INPUT_FAILURE_THRESHOLD);
let shouldFail = false;
let summary = '';
let sastDownloadLink = "";
let scaDownloadLink = "";

function processScanResults(sastScanId, scaScanId) {
    return new Promise((resolve, reject) => {
        let sastSummary = null;
        let scaSummary = null;

        (sastScanId ? asoc.getScanResults(sastScanId, 'SAST') : Promise.resolve(null))
        .then((sastResults) => {
            sastSummary = sastResults;
            return processResults(sastSummary, 'SAST');
        })
        .then(() => {
            return scaScanId ? asoc.getScanResults(scaScanId, 'SCA') : Promise.resolve(null);
        })
        .then((scaResults) => {
            scaSummary = scaResults;
            return processResults(scaSummary, 'SCA');
        })
        .then(() => {
			if(sastScanId && scaScanId) {
				return aggregateResults(sastSummary, scaSummary);
			}
            return null;
        })
        .then((aggregatedResults) => {
			if(aggregatedResults) {
				return processResults(aggregatedResults, 'Combined');
			}
            return Promise.resolve();
        })
		.then(() => {
			return generateSecurityReport(sastScanId, "Sast", "SAST", sastSummary);
		})
		.then((downloadLink) => {
			sastDownloadLink = downloadLink || "";
		})
		.then(() => {
			return generateSecurityReport(scaScanId, "Sca", "SCA", scaSummary);
		})
		.then((downloadLink) => {
			scaDownloadLink = downloadLink || "";
		})
        .then(() => {
            if(shouldFail) {
                return reject('\n' + summary + '\n' + constants.ERROR_NONCOMPLIANT_ISSUES);
            }
            else {
                return resolve(summary);
            }
        })
        .catch((error) => {
            reject(error);
        })
    })
}

function processResults(result, label) {
    return new Promise((resolve) => {
        if(!result || !result.counts) {
            return resolve();
        }
		const severityOrder =["Critical", "High", "Medium", "Low", "Informational"];
        let output = "";
		severityOrder.forEach((severity) => {
            const count = result.counts[severity] || 0;
            output += `\t${severity}${constants.ISSUES_COLON}${count}\n`;
            setShouldFail(severity, count);
        });
        output += `\t${constants.TOTAL_ISSUES}${result.total}\n`;
        summary += `${label} Security Issues\n${output}\n`;
        resolve();
    });
}

function setShouldFail(severity, numIssues) {
    if(failForNonCompliance && numIssues > 0) {
        shouldFail ||= getSeverityValue(severity) >= failureThreshold;
    }
}

function getSeverityValue(severity) {
    let severityValue = 1;

    switch(severity) {
        case 'Informational':
            severityValue = 0;
            break;
        case 'Low':
        default:
            severityValue = 1;
            break;
        case 'Medium':
            severityValue = 2;
            break;
        case 'High':
            severityValue = 3;
            break;
        case 'Critical':
            severityValue = 4;
            break;
    }

    return severityValue;
}

function aggregateResults(result1, result2) {
    return new Promise((resolve) => {
        if (!result1 || !result2) {
            return resolve(null);
        }
        const counts = {
            Critical: (result1.counts?.Critical || 0) + (result2.counts?.Critical || 0),
            High: (result1.counts?.High || 0) + (result2.counts?.High || 0),
            Medium: (result1.counts?.Medium || 0) + (result2.counts?.Medium || 0),
            Low: (result1.counts?.Low || 0) + (result2.counts?.Low || 0),
            Informational: (result1.counts?.Informational || 0) + (result2.counts?.Informational || 0)
        };
        const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
        resolve({total, counts});
    });
}

function getSastDownloadLink() {
	return sastDownloadLink;
}

function getScaDownloadLink() {
	return scaDownloadLink;
}

function generateSecurityReport(scanId, apiScanType, reportType, summaryData) {
    if (!scanId) {
        return Promise.resolve(null);
    }
    return asoc.getScanDetails(scanId, apiScanType)
        .then((scanDetails) => {
            if (!scanDetails || !scanDetails.ExecutionId) {
                return Promise.resolve();
            }
            return asoc.createSecurityReport(scanDetails.ExecutionId);
        })
        .then((reportId) => {
            if (!reportId) {
                return Promise.resolve();
            }
            return statusChecker.waitForSecurityReport(reportId);
        })
        .then((report) => {
            if (!report || !report.DownloadLink) {
                return Promise.resolve();
            }
            return asoc.downloadSecurityReport(report, reportType);
        })
        .then((reportResult) => {
            if (!reportResult) {
                return null;
            }
            summaryWriter.writeSummaryMarkdown(
                summaryData,
                reportResult.downloadLink
            );
            return reportResult.downloadLink;
        });
}

export default { processScanResults, getSastDownloadLink, getScaDownloadLink }
