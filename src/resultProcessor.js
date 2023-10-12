/*
Copyright 2022, 2023 HCL America, Inc.

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

import * as constants from './constants.js';

const Informational = 0;
const Low = 1;
const Medium = 2;
const High = 3;
const Critical = 4;

const failForNonCompliance = process.env.INPUT_FAIL_FOR_NONCOMPLIANCE === 'true';
const failureThreshold = getSeverityValue(process.env.INPUT_FAILURE_THRESHOLD);
let shouldFail = false;

function processResults(json) {
    return new Promise((resolve, reject) => {
        let totalFindings = 0;
        let count = 0;
        let output = '';

        for(var i = 0; i < json.length; i++) {
            let element = json[i];
            totalFindings += element.Count;
            output = element.Severity + constants.ISSUES_COLON + element.Count + '\n' + output;
            setShouldFail(element.Severity, element.Count);
            if(++count === json.length) {
                output = constants.TOTAL_ISSUES + totalFindings + '\n' + output;
                if(shouldFail) {
                    return reject('\n' + output + '\n' + constants.ERROR_NONCOMPLIANT_ISSUES);
                }

                return resolve(output);
            }
        }
    });
}

function setShouldFail(severity, numIssues) {
    if(failForNonCompliance && numIssues > 0) {
        shouldFail = getSeverityValue(severity) >= failureThreshold;
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

export default { processResults }
