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

import * as core from '@actions/core';
import * as fs from 'fs';
import got from 'got';
import * as constants from './constants.js';
import settings from './settings.js';
import utils from './utils.js';
import FormData from 'form-data';

let token = null
const key = utils.sanitizeString(process.env.INPUT_ASOC_KEY);
const secret = utils.sanitizeString(process.env.INPUT_ASOC_SECRET);
const enableSSL = !settings.shouldDisableSSL;

//These should already be masked, but just in case the user hardcoded values.
core.setSecret(key);
core.setSecret(secret);

function login() {
    return new Promise((resolve, reject) => {
        if(key && secret) {
            let url = settings.getServiceUrl() + constants.API_LOGIN;
            got.post(url, { json: { 'keyId': key, 'keySecret': secret, 'clientType': utils.getClientType() }, retry: { limit: 3, methods: ['GET', 'POST'] }, https: { rejectUnauthorized: enableSSL } })
            .then((response) => {
                if(response.statusCode === 200 || response.statusCode === 201) {
                    let responseJson = JSON.parse(response.body);
                    token = responseJson.Token;
                    core.setSecret(token);
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
        if(!scanId) {
            return resolve([]);
        }
        
        login()
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

async function getNonCompliantIssues(scanId) {
    return new Promise((resolve, reject) => {
        let queryString = '?applyPolicies=All&%24top=100&%24apply=filter%28Status%20eq%20%27Open%27%20or%20Status%20eq%20%27InProgress%27%20or%20Status%20eq%20%27Reopened%27%20or%20Status%20eq%20%27New%27%29';
        let url = settings.getServiceUrl() + constants.API_ISSUES + scanId + queryString;
        got.get(url, { headers: getRequestHeaders(), retry: { limit: 3, methods: ['GET', 'POST'] }, https: { rejectUnauthorized: enableSSL } })
        .then((response) => {
            let responseJson = JSON.parse(response.body);
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
				const prSection = isPR ? `

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
        .catch((error) => {
            reject(error);
        })
    });
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
        Accept: "application/json",
        ClientType: utils.getClientType()
    }
}

function runAnalysis(file) {
    return new Promise((resolve, reject) => {
        login()
        .then(() => {
            return uploadFile(file);
        })
        .then((fileId) => {
            return submitScans(fileId);
        })
        .then((scanIds) => {
            resolve(scanIds);
        })
        .catch((error) => {
            reject(error);
        });
    });
}

function uploadFile(file) {
    return new Promise((resolve, reject) => {
        const form = new FormData();
        form.append('uploadedFile', fs.createReadStream(file))
        let url = settings.getServiceUrl() + constants.API_FILE_UPLOAD;
        
        got.post(url, { body: form, headers: getRequestHeaders(), retry: { limit: 3, methods: ["GET", "POST"] }, https: { rejectUnauthorized: enableSSL } })
        .then((response) => {
            let responseJson = JSON.parse(response.body);
            resolve(responseJson.FileId);
        })
        .catch((error) => {
            reject(error);
        })
    });
}

function submitScans(fileId) {
    let sastScanId;
    return new Promise((resolve, reject) => {
        submitSastScan(fileId)
        .then((sastScan) => {
            sastScanId = sastScan;
            return submitScaScan(fileId);
        })
        .then((scaScanId) => {
            resolve({ sastScanId, scaScanId });
        })
        .catch((error) => {
            reject(error);
        })
    });
}

function submitScan(url, fileId) {
    return new Promise((resolve, reject) => {
        let appId = utils.sanitizeString(process.env.INPUT_APPLICATION_ID);
        let scanName = utils.sanitizeString(process.env.INPUT_SCAN_NAME);

        let body = {
            "ApplicationFileId": fileId,
            "AppId": appId,
            "ScanName": scanName,
            "Personal": process.env.INPUT_PERSONAL_SCAN === 'true',
            "FullyAutomatic": true,
            "EnableMailNotification": false
        };

        got.post(url, { json: body, headers: getRequestHeaders(), retry: { limit: 3, methods: ["GET", "POST"] }, https: { rejectUnauthorized: enableSSL } })
        .then((response) => {
            let responseJson = JSON.parse(response.body);
            resolve(responseJson.Id);
        })
        .catch((error) => {
            reject(error);
        })
    })
}

function submitRescan(scanId, fileId) {
    return new Promise((resolve, reject) => {
        let url = settings.getServiceUrl();
        url += constants.API_SCAN_EXECUTIONS.replace('{s}', scanId);
        let body = { FileId: fileId };

        got.post(url, { json: body, headers: getRequestHeaders(), retry: { limit: 3, methods: ["GET", "POST"] }, https: { rejectUnauthorized: enableSSL } })
        .then((response) => {
            let responseJson = JSON.parse(response.body);
            resolve(responseJson.ScanId);
        })
        .catch((error) => {
            reject(error);
        })
    })
}

function submitScaScan(fileId) {
    return new Promise((resolve, reject) => {
        if(process.env.INPUT_STATIC_ANALYSIS_ONLY === 'true'
            || process.env.INPUT_SECRETS_ONLY === 'true')
        {
            return resolve();
        }

        Promise.resolve()
        .then(() => {
            if(process.env.INPUT_SCA_SCAN_ID) {
                let rescanId = utils.sanitizeString(process.env.INPUT_SCA_SCAN_ID);
                return submitRescan(rescanId, fileId)
            }
            else {
                let url = settings.getServiceUrl() + constants.API_SCA_SCAN;
                return submitScan(url, fileId)
            }
        })
        .then((scanId) => {
            resolve(scanId);
        })
        .catch((error) => {
            reject(error);
        });
    })
}

function submitSastScan(fileId) {
    return new Promise((resolve, reject) => {
        if(process.env.INPUT_OPEN_SOURCE_ONLY === 'true') {
            return resolve();
        }

        Promise.resolve()
        .then(() => {
            if(process.env.INPUT_SAST_SCAN_ID) {
                let rescanId = utils.sanitizeString(process.env.INPUT_SAST_SCAN_ID);
                return submitRescan(rescanId, fileId);
            }
            else {
                let url = settings.getServiceUrl() +constants.API_SAST_SCAN;
                return submitScan(url, fileId)
            }
        })
        .then((scanId) => {
            resolve(scanId);
        })
        .catch((error) => {
            reject(error);
        })
    })
}

async function getScaScanStatus(scanId) {
    let url = settings.getServiceUrl() + constants.API_SCA_SCAN + '/' + scanId;
    let status = await getScanStatus(url, scanId);
    return status;
}

async function getSastScanStatus(scanId) {
    let url = settings.getServiceUrl() + constants.API_SAST_SCAN + '/' + scanId;
    let status = await getScanStatus(url, scanId);
    return status;
}

async function getScanStatus(url, scanId) {
    let response = await got.get(url, { headers: getRequestHeaders(), retry: { limit: 3, methods: ["GET"] }, https: { rejectUnauthorized: enableSSL } })
    let responseJson = JSON.parse(response.body);
    return responseJson.LatestExecution.Status;
}

export default { getScanResults, runAnalysis, getSastScanStatus, getScaScanStatus, getNonCompliantIssues }
