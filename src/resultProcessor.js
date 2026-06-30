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

const Informational = 0;
const Low = 1;
const Medium = 2;
const High = 3;
const Critical = 4;

const failForNonCompliance = process.env.INPUT_FAIL_FOR_NONCOMPLIANCE === 'true';
const failureThreshold = getSeverityValue(process.env.INPUT_FAILURE_THRESHOLD);
let shouldFail = false;
let summary = '';

function processScanResults(sastScanId, scaScanId) {
    return new Promise((resolve, reject) => {
        let sastScanResults = [];
        let scaScanResults = [];

        (sastScanId ? asoc.getScanResults(sastScanId, 'SAST') : Promise.resolve({Items: []}))
        .then((sastResults) => {
            sastScanResults = sastResults.Items;
            return processResults(sastScanResults, 'SAST');
        })
        .then(() => {
            return scaScanId ? asoc.getScanResults(scaScanId, 'SCA') : Promise.resolve({Items: []});
        })
        .then((scaResults) => {
            scaScanResults = scaResults.Items;
            return processResults(scaScanResults, 'SCA');
        })
        .then(() => {
			if(sastScanId && scaScanId) {
				return aggregateResults(sastScanResults, scaScanResults);
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

function processResults(json, label) {
    return new Promise((resolve, reject) => {
        if(!json || json.length === 0) {
            return resolve();
        }

        let totalFindings = 0;
        let count = 0;
        let output = '';

        for(var i = 0; i < json.length; i++) {
            let element = json[i];
            totalFindings += element.Count;
            output = '\t' + element.Severity + constants.ISSUES_COLON + element.Count + '\n' + output;
            setShouldFail(element.Severity, element.Count);
            if(++count === json.length) {
                output = '\t' + constants.TOTAL_ISSUES + totalFindings + '\n' + output;
                summary += label + ' Security Issues\n' + output + '\n';
                return resolve();
            }
        }
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
            return resolve([]);
        }

        // Create a map to store severity counts
        const severityMap = {};
        
        // Process first object's items
        if (result1 && Array.isArray(result1)) {
            result1.forEach(item => {
            severityMap[item.Severity] = (severityMap[item.Severity] || 0) + item.Count;
            });
        }

        // Process second object's items
        if (result2 && Array.isArray(result2)) {
            result2.forEach(item => {
            severityMap[item.Severity] = (severityMap[item.Severity] || 0) + item.Count;
            });
        }

        // Convert map back to array
        const combinedItems = Object.keys(severityMap).map(severity => ({
            Severity: severity,
            Count: severityMap[severity]
        }));

        resolve(combinedItems);
    });
}

export default { processScanResults }
