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

import got from 'got';
import * as constants from './constants.js';
import settings from './settings.js';
import utils from './utils.js';
import fs from 'fs';

let token = null

// helper methods
function isAcceptSSLEnabled() {
    return process.env.INPUT_ACCEPTSSL === 'true';
}

function getGotOptions(options = {}) {
    if (isAcceptSSLEnabled()) {
        return {
            ...options,
            https: {
                rejectUnauthorized: false
            }
        };
    }
    return options;
}

function login(key, secret) {
    return new Promise((resolve, reject) => {
        if(key && secret) {
            let url = settings.getServiceUrl() + constants.API_LOGIN;
            got.post(url, getGotOptions({ json: { 'keyId': key, 'keySecret': secret, 'clientType': utils.getClientType() }, retry: { limit: 3, methods: ['GET', 'POST'] } }))
            .then((response) => {
                if(response.statusCode === 200 || response.statusCode === 201) {
                    let responseJson = JSON.parse(response.body);
                    token = responseJson.Token;
                    resolve();
                }
                else {
                    reject(`Failed to connect to ASoC. Response code ${response.statusCode}`);
                }
            })
            .catch((error) => {
                reject(error);
            })
        }
        else {
            reject('Missing API key/secret.');
        }
    })
}

function getScanResults(scanId) {
    return new Promise((resolve, reject) => {
        let key = utils.sanitizeString(process.env.INPUT_ASOC_KEY);
        let secret = utils.sanitizeString(process.env.INPUT_ASOC_SECRET);
        login(key, secret)
        .then(() => {
            return resolve(getNonCompliantIssues(scanId));
        })
        .catch((error) => {
            reject(error);
        })
    });
}

async function getSastScanDetails(scanId) {
    const url = settings.getServiceUrl()+ "/api/v4/Scans/Sast/"+ scanId;
    try {
        const res = await got.get(url, getGotOptions({
                headers: {
                    Authorization: "Bearer " + token,
                    Accept: "application/json"
                }
        }));
        return JSON.parse(res.body);
    } catch (e) {
        console.log("Failed to fetch SAST scan details:", e.message);
        return null;
    }
}

// Converted getNonCompliantIssues() into an async flow because the method now performs
// additional asynchronous operations such as fetching scan metadata, generating HTML/Markdown
// reports, and writing SARIF output files. Keeping all report generation inside the same
// async promise chain ensures the GitHub Action completes only after all reports and artifacts
// are fully generated and written to disk.
async function getNonCompliantIssues(scanId) {
    return new Promise((resolve, reject) => {
        let queryString ='?applyPolicies=All&%24top=100&%24apply=filter%28Status%20eq%20%27Open%27%20or%20Status%20eq%20%27InProgress%27%20or%20Status%20eq%20%27Reopened%27%20or%20Status%20eq%20%27New%27%29';
        let url = settings.getServiceUrl() + constants.API_ISSUES + scanId + queryString;
        got.get(url, getGotOptions({ headers: getRequestHeaders(), retry: { limit: 3, methods: ['GET', 'POST'] } }))
        .then((response) => {
            let responseJson = JSON.parse(response.body);
			// Use raw issue items for PR/build summary, HTML report, and SARIF generation.
			// resultProcessor.processResults() returns aggregated data which is not iterable.
            return responseJson.Items || [];
        })
		// Keep the async report/SARIF generation inside the same promise chain
		// so the workflow completes only after all reports are fully written.
        .then(async issues => {
            issues = issues || [];			
			//const enableGithubSecurity = process.env.INPUT_ENABLE_GITHUB_SECURITY !== 'false';
            const counts = {Critical: 0, High: 0, Medium: 0, Low: 0, Informational: 0};
            issues.forEach(i => {
                if (
                    counts[i.Severity] !== undefined
                ) {
                    counts[i.Severity]++;
                }
            });
            const total = Object.values(counts).reduce((a,b)=>a+b, 0);
            const baseUrl = settings.getServiceUrl().replace("/api/v4","");		
            const scanUrl =`${baseUrl}/main/myapps/${process.env.INPUT_APPLICATION_ID}/scans/${scanId}`;			
			const applicationId = process.env.INPUT_APPLICATION_ID;
		    let appName = applicationId;
			let executionId = "";
			try {
				const scanDetails = await getSastScanDetails(scanId);				
				if(scanDetails) {
					appName = scanDetails.AppName || appName;
					executionId = scanDetails.ExecutionId || "";
				}
			} catch (e) {
					console.log("Failed to fetch AppName from scan details");
			}
				const appUrl =`${baseUrl}/main/myapps/${applicationId}`;
				const scanTime = new Date().toISOString().replace("T"," ").substring(0,19);				
				const isPR = process.env.GITHUB_EVENT_NAME === 'pull_request';
				const repoName = process.env.GITHUB_REPOSITORY || "";
				const branchName = process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || "";
				const commitSha = process.env.GITHUB_SHA ? process.env.GITHUB_SHA.substring(0,7): "";
				let prNumber = "";
			try {
				if (process.env.GITHUB_EVENT_PATH && fs.existsSync(process.env.GITHUB_EVENT_PATH)) {
					const eventPayload = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
					prNumber = eventPayload.pull_request?.number || "";
				}
			} catch (e) {
					console.log("Failed to read PR information:", e.message);
			}
				const scanLabel = isPR ? "SAST PR Scan Summary" : "SAST Scan Summary";
				const prUrl =`https://github.com/${repoName}/pull/${prNumber}`;
				const branchUrl =`https://github.com/${repoName}/tree/${branchName}`;
				const commitUrl =`https://github.com/${repoName}/commit/${process.env.GITHUB_SHA}`;
				const issueBaseUrl =`${baseUrl}/main/myapps/${applicationId}/scans/${scanId}/scanIssues?executionId=${executionId}`;				
				const prSection =
    isPR
    ? `

## Pull Request Information

| Field | Value |
|------|------|
| PR Number | [#${prNumber}](${prUrl}) |
| Branch | [${branchName}](${branchUrl}) |
| Commit | [${commitSha}](${commitUrl}) |

---`
    : "";
				const isAppScan360 = !!process.env.INPUT_SERVICE_URL;
				const scanIdValue = isAppScan360 ? scanId : `[${scanId}](${scanUrl})`;
				const appNameValue = isAppScan360 ? appName : `[${appName}](${appUrl})`;
				const viewScanValue = isAppScan360 ? "View scan details in downloadable HTML report" : `[View scan details in AppScan](${scanUrl})`;
	            const md = `

#  HCL AppScan ${scanLabel}

${prSection}

### Scan Information

| Field | Value |
|------|-------|
| Scan Type | SAST |
| Scan ID | ${scanIdValue} |
| Application Name | ${appNameValue} |
| Repository | ${process.env.GITHUB_REPOSITORY} |
| Scan Time | ${scanTime} |

---

## Total Vulnerabilities: ${total}

| Critical | High | Medium | Low | Info |
|----------|------|--------|-----|------|
| ${counts.Critical} | ${counts.High} | ${counts.Medium} | ${counts.Low} | ${counts.Informational} |

---

${viewScanValue}

`;

				const mdFileName = isPR ? "appscan-pr-report.md": "appscan-build-summary-report.md";
				fs.writeFileSync(mdFileName, md);
				/*
				 ADD HTML REPORT GENERATION HERE
				*/			
				const htmlReport = generateHtmlReport(issues, counts, scanUrl, appName, issueBaseUrl, scanId, appUrl, scanTime);			
				const fileName = isPR ? "appscan-pr-report.html": "appscan-build-summary-report.html";
				fs.writeFileSync(fileName, htmlReport);
				if (process.env.GITHUB_STEP_SUMMARY) {
					fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
				}
				resolve({total, counts});
		})
		.catch(reject);
    });
}

/**
 * Maps AppScan severity values to SARIF result levels.
 * Used during SARIF report generation for GitHub Security integration.
 */
function mapLevel(sev) {
    if (sev === "Critical" || sev === "High") {
		return "error";
	} if (sev === "Medium") {
		return "warning";
	}
    return "note";
}

/**
 * Parses an AppScan issue location string into a file path and line number.
 * Used by report generation to create source code links and
 * was originally introduced for SARIF result locations.
 */
function parseLocation(location) {
    if (!location) {
        return {
            filePath: "source",
            lineNumber: 1
        };
    }
    const lastColon = location.lastIndexOf(":");
    if (lastColon === -1) {
        return {
            filePath: location,
            lineNumber: 1
        };
    }
    return {
        filePath: location.substring(0, lastColon),
        lineNumber: parseInt(location.substring(lastColon + 1)) || 1
    };
}

function generateHtmlReport(issues, counts, scanUrl, appName, issueBaseUrl,	scanId, appUrl, scanTime) {
	const isPR = process.env.GITHUB_EVENT_NAME === 'pull_request';
	const repoName = process.env.GITHUB_REPOSITORY || "";
	const branchName = process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || "";
	const commitSha = process.env.GITHUB_SHA ? process.env.GITHUB_SHA.substring(0,7) : "";
	let prNumber = "";
	try {
		if (process.env.GITHUB_EVENT_PATH && fs.existsSync(process.env.GITHUB_EVENT_PATH)) {
			const eventPayload = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
			prNumber = eventPayload.pull_request?.number || "";
		}
	} catch (e) {
		console.log("Failed to read PR information:", e.message);
	}
	const prUrl = `https://github.com/${repoName}/pull/${prNumber}`;
	const branchUrl = `https://github.com/${repoName}/tree/${branchName}`;
	const commitUrl = `https://github.com/${repoName}/commit/${process.env.GITHUB_SHA}`;
	return `

<html>

<head>

<style>

body {
 font-family: Arial;
 margin: 40px;
}

table {
 border-collapse: collapse;
 width: 100%;
 margin-bottom: 30px;
}

th, td {
 border: 1px solid #ddd;
 padding: 8px;
}

th {
 background: #f5f5f5;
}

.sev-critical { color: black; }
.sev-high { color: black; }
.sev-medium { color: black; }
.sev-low { color: black; }

</style>

</head>

<body>

<h1>HCL AppScan SAST ${isPR ? "PR Scan Summary" : "Scan Summary"}</h1>

${isPR ? `

<h3>Pull Request Information</h3>

<table>

<tr>
<th>Field</th>
<th>Value</th>
</tr>

<tr>
<td>PR Number</td>
<td>
<a href="${prUrl}" target="_blank">
#${prNumber}
</a>
</td>
</tr>

<tr>
<td>Branch</td>
<td>
<a href="${branchUrl}" target="_blank">
${branchName}
</a>
</td>
</tr>

<tr>
<td>Commit</td>
<td>
<a href="${commitUrl}" target="_blank">
${commitSha}
</a>
</td>
</tr>

</table>

<br/>

` : ""}

<h3>Scan Information</h3>

<table>

<tr>
<th>Field</th>
<th>Value</th>
</tr>

<tr>
<td>Scan Type</td>
<td>SAST</td>
</tr>

<tr>
<td>Scan ID</td>
<td>
<a href="${scanUrl}" target="_blank">
${scanId}
</a>
</td>
</tr>

<tr>
<td>Application Name</td>
<td>
<a href="${appUrl}" target="_blank">
${appName}
</a>
</td>
</tr>

<tr>
<td>Repository</td>
<td>${process.env.GITHUB_REPOSITORY}</td>
</tr>

<tr>
<td>Scan Time</td>
<td>${scanTime}</td>
</tr>

</table>

<h2>Application: ${appName}</h2>

<h3>Summary</h3>

<table>

<tr>

<th>Critical</th>
<th>High</th>
<th>Medium</th>
<th>Low</th>
<th>Info</th>

</tr>

<tr>

<td>${counts.Critical}</td>
<td>${counts.High}</td>
<td>${counts.Medium}</td>
<td>${counts.Low}</td>
<td>${counts.Informational}</td>

</tr>

</table>

<h3>Issues</h3>

<table>

<tr>

<th>Severity</th>
<th>Issue type</th>
<th>Location</th>
<th>Line</th>
<th>How to fix</th>

</tr>

${issues.map(i => `

<tr>

<td class="sev-${i.Severity.toLowerCase()}">

${i.Severity}

</td>

<td>

${i.IssueType}

</td>

<td>

${(() => {
	const location = i.Location || "";
	const parsed = parseLocation(location);
	const filePath = parsed.filePath;
	const lineNumber = parsed.lineNumber;
	const githubFileUrl =`https://github.com/${repoName}/blob/${process.env.GITHUB_SHA}/${filePath}#L${lineNumber}`;

    return `

        <a href="${githubFileUrl}" target="_blank">

            ${location}

        </a>

    `;

})()}

</td>

<td>

${(i.Location || "").split(":").pop()}

</td>

<td>

${(() => {

    const issueDetailsUrl =`${settings.getServiceUrl().replace('/api/v4','')}` + `/main/myapps/${process.env.INPUT_APPLICATION_ID}` +`/issues/${i.Id}`;

    return `

        <a href="${issueDetailsUrl}" target="_blank">

            View Issue Details

        </a>

    `;

})()}

</td>

</tr>

`).join("")}

</table>

<p>

Full scan:

<a href="${scanUrl}">

View in AppScan

</a>

</p>

</body>

</html>

`;
}

function getRequestHeaders() {
    return {
        Authorization: "Bearer " + token,
        Accept: "application/json"
    }
}

export default { getScanResults }
