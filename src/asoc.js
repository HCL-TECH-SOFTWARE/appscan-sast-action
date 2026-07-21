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

function getScanResults(scanId, scanType = 'SAST') {
    return new Promise((resolve, reject) => {
        if(!scanId) {
            return resolve([]);
        }
        
        login()
        .then(() => {
            return resolve(getNonCompliantIssues(scanId, scanType));
        })
        .catch((error) => {
            reject(error);
        })
    });
}

async function getSastScanDetails(scanId) {
    const url = settings.getServiceUrl()+ "/api/v4/Scans/Sast/"+ scanId;
    try {
        const res = await got.get(url, {
                headers: getRequestHeaders(),
				retry: {
					limit: 3,
					methods: ["GET", "POST"]
				},
				https: {
					rejectUnauthorized: enableSSL
				}
        });
        const responseJSON = JSON.parse(res.body);
		return { AppName : responseJSON.AppName, ExecutionId : responseJSON.LatestExecution?.Id };
    } catch (e) {
		console.log("Failed to fetch SAST scan details:", e.message);
        return null;
    }
}

async function getScaScanDetails(scanId) {
    const url = settings.getServiceUrl()+ "/api/v4/Scans/Sca/"+ scanId;
    try {
        const res = await got.get(url, {
                headers: getRequestHeaders(),
				retry: {
					limit: 3,
					methods: ["GET", "POST"]
				},
				https: {
					rejectUnauthorized: enableSSL
				}
        });
        const responseJSON = JSON.parse(res.body);
		return { AppName : responseJSON.AppName, ExecutionId : responseJSON.LatestExecution?.Id };
    } catch (e) {
		console.log("Failed to fetch SCA scan details:", e.message);
        return null;
    }
}

async function getNonCompliantIssues(scanId, scanType = 'SAST') {
    return new Promise((resolve, reject) => {
        const queryString = "?applyPolicies=All" + "&%24filter=Status%20eq%20%27Open%27%20or%20Status%20eq%20%27InProgress%27%20or%20Status%20eq%20%27Reopened%27%20or%20Status%20eq%20%27New%27" +    "&%24apply=groupby((Status,Severity),aggregate(%24count%20as%20N))";
        const url = settings.getServiceUrl() + constants.API_ISSUES + scanId + queryString;
		got.get(url, { headers: getRequestHeaders(), retry: { limit: 3, methods: ['GET'] }, https: { rejectUnauthorized: enableSSL } })
		.then(async response => {
			const responseJson = JSON.parse(response.body);
            const counts = {Critical: 0, High: 0, Medium: 0, Low: 0, Informational: 0};
			const groupedItems = responseJson.Items || [];
            groupedItems.forEach(item => {
                if (counts[item.Severity] !== undefined) {
                    counts[item.Severity] += Number(item.N || 0);
                }
            });
            const total = Object.values(counts).reduce((a,b)=>a+b, 0);
			const serviceUrl = settings.getServiceUrl();
            const baseUrl = serviceUrl.replace("/api/v4","");		
            const scanUrl =`${baseUrl}/main/myapps/${process.env.INPUT_APPLICATION_ID}/scans/${scanId}`;		
			const applicationId = process.env.INPUT_APPLICATION_ID;
		    let appName = applicationId;
			try {
				let scanDetails = null;
				if(scanType === 'SAST') {
					scanDetails = await getSastScanDetails(scanId);	
				} else if(scanType === 'SCA') {
					scanDetails = await getScaScanDetails(scanId);
				}
				if(scanDetails) {
						appName = scanDetails.AppName || appName;
				}
			} catch (e) {
					console.log("Failed to fetch AppName from scan details");
			}
			const appUrl =`${baseUrl}/main/myapps/${applicationId}`;
			const scanTime = new Date().toISOString().replace("T"," ").substring(0,19);				
			const githubContext = getGitHubContext();
			resolve({total, counts, issues: [], scanId, scanUrl, appName, appUrl, scanTime, scanType, ...githubContext});
		})
        .catch((error) => {
            reject(error);
        })
    });
}

function getGitHubContext() {
    const isPR = process.env.GITHUB_EVENT_NAME === 'pull_request';
    const repoName = process.env.GITHUB_REPOSITORY || "";
    const branchName = process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || "";
    const commitSha = process.env.GITHUB_SHA ? process.env.GITHUB_SHA.substring(0, 7) : "";
    let prNumber = "";
    try {
        if (process.env.GITHUB_EVENT_PATH && fs.existsSync(process.env.GITHUB_EVENT_PATH)) {
            const eventPayload = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
            prNumber = eventPayload.pull_request?.number || "";
        }
    } catch (e) {
        console.log("Failed to read PR information:", e.message);
    }
    return {isPR, repoName, branchName, commitSha, prNumber};
}

function writeSummaryMarkdown(summaryData, reportDownloadLink) {
	const {total, counts, scanId, scanUrl, appName, appUrl, scanTime, scanType, isPR, repoName, branchName, commitSha, prNumber} = summaryData;
	const scanLabel = isPR ? `${scanType} PR Scan Summary` : `${scanType} Scan Summary`;
	const prUrl = `https://github.com/${repoName}/pull/${prNumber}`;
	const branchUrl = `https://github.com/${repoName}/tree/${branchName}`;
	const commitUrl = `https://github.com/${repoName}/commit/${process.env.GITHUB_SHA}`;
	const prSection = isPR ? `
## Pull Request Information

| Field | Value |
|------|------|
| PR Number | [#${prNumber}](${prUrl}) |
| Branch | [${branchName}](${branchUrl}) |
| Commit | [${commitSha}](${commitUrl}) |

---`
: "";
    const enableHyperlinks = process.env.INPUT_SUMMARY_HYPERLINKS !== "false";
	const scanIdValue = enableHyperlinks ? `[${scanId}](${scanUrl})` : scanId;
	const appNameValue = enableHyperlinks ? `[${appName}](${appUrl})` : appName;
	const reportLabel = `Download ${scanType} HTML Report`;
	const reportValue = enableHyperlinks ? `[${reportLabel}](${reportDownloadLink})` : "";
	const md = `
# HCL AppScan ${scanLabel}

${prSection}

### Scan Information

| Field | Value |
|------|-------|
| Scan Type | ${scanType} |
| Scan ID | ${scanIdValue} |
| Application Name | ${appNameValue} |
| Repository | ${repoName} |
| Scan Time | ${scanTime} |

---

## Total Vulnerabilities: ${total}

| Critical | High | Medium | Low | Info |
|----------|------|--------|-----|------|
| ${counts.Critical} | ${counts.High} | ${counts.Medium} | ${counts.Low} | ${counts.Informational} |

---

${reportValue}

`;
     const mdFileName = isPR ? `appscan-${scanType.toLowerCase()}-pr-report.md` : `appscan-${scanType.toLowerCase()}-build-summary-report.md`;
	 fs.writeFileSync(mdFileName, md);
	 if (process.env.GITHUB_STEP_SUMMARY) {
		 fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
	}
}

async function generateMinimumSummary(scanId, scanType) {
    const serviceUrl = settings.getServiceUrl();
    const baseUrl = serviceUrl.replace("/api/v4", "");
    const applicationId = process.env.INPUT_APPLICATION_ID;
    const scanUrl = `${baseUrl}/main/myapps/${applicationId}/scans/${scanId}`;
    const appUrl = `${baseUrl}/main/myapps/${applicationId}`;
    let appName = applicationId;
    try {
        let scanDetails = null;
        if (scanType === "SAST") {
            scanDetails = await getSastScanDetails(scanId);
        } else if (scanType === "SCA") {
            scanDetails = await getScaScanDetails(scanId);
        }
        if (scanDetails) {
            appName = scanDetails.AppName || appName;
        }
    }
    catch (e) {
        console.log("Failed to fetch AppName from scan details:", e.message);
    }
    const scanTime = new Date().toISOString().replace("T", " ").substring(0, 19);
	const githubContext = getGitHubContext();
	const {isPR, repoName, branchName, commitSha, prNumber} = githubContext;
    const enableHyperlinks = process.env.INPUT_SUMMARY_HYPERLINKS !== "false";
    const scanIdValue = enableHyperlinks ? `[${scanId}](${scanUrl})` : scanId;
    const appNameValue = enableHyperlinks ? `[${appName}](${appUrl})` : appName;
	const prUrl = `https://github.com/${repoName}/pull/${prNumber}`;
	const branchUrl = `https://github.com/${repoName}/tree/${branchName}`;
	const commitUrl = `https://github.com/${repoName}/commit/${process.env.GITHUB_SHA}`;
	const prSection = isPR ? `
## Pull Request Information

| Field | Value |
|------|------|
| PR Number | [#${prNumber}](${prUrl}) |
| Branch | [${branchName}](${branchUrl}) |
| Commit | [${commitSha}](${commitUrl}) |

---`
: "";	
    const md = `
# HCL AppScan ${scanType} ${isPR ? "PR " : ""}Scan Summary

${prSection}

### Scan Information

| Field | Value |
|--------|-------|
| Scan Type | ${scanType} |
| Scan ID | ${scanIdValue} |
| Application Name | ${appNameValue} |
| Repository | ${repoName} |
| Scan Time | ${scanTime} |

---

`;

    const mdFileName = `appscan-${scanType.toLowerCase()}-minimum-summary.md`;
    fs.writeFileSync(mdFileName, md);
    if (process.env.GITHUB_STEP_SUMMARY) {
        fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
    }
}

function createSecurityReport(executionId) {
    return new Promise((resolve, reject) => {
        const url = settings.getServiceUrl() + constants.API_SECURITY_REPORT + executionId;
        const today = new Date().toISOString().split('T')[0];
		const repoName = process.env.GITHUB_REPOSITORY ? process.env.GITHUB_REPOSITORY.split("/")[1] : "UnknownRepo";
		const reportTitle = `Report_${repoName}_${today}`;
        const body = {
            Configuration: {
                Summary: true,
                Details: true,
                Discussion: false,
                Overview: true,
                TableOfContent: true,
                ApplicationCustomFields: false,
                ApplicationDetails: false,
                Articles: false,
                Coverage: false,
                History: false,
                IssueCustomFields: false,
                Locale: "en",
                MinimizeDetails: true,
                Notes: "",
				Title: reportTitle,
                ReportFileType: "HTML"
            },
            OdataFilter: "((Status eq 'New') or (Status eq 'Open') or (Status eq 'InProgress') or (Status eq 'Reopened'))",
			ApplyPolicies: "All",
            SelectPolicyIds: []
        };
        got.post(url, { json: body, headers: getRequestHeaders(), retry: { limit: 3, methods: ["POST"] }, https: { rejectUnauthorized: enableSSL } })
        .then((response) => {
            const responseJson = JSON.parse(response.body);
            resolve(responseJson.Id);
        })
        .catch((error) => {
            reject(error);
        });
    });
}

function getSecurityReport(reportId) {
    return new Promise((resolve, reject) => {
        const url = settings.getServiceUrl() + constants.API_REPORT + "?$filter=Id eq " + reportId;
        got.get(url, { headers: getRequestHeaders(), retry: { limit: 3, methods: ["GET"] }, https: { rejectUnauthorized: enableSSL } })
        .then((response) => {
            const responseJson = JSON.parse(response.body);
            if(responseJson.Items && responseJson.Items.length > 0) {
                resolve(responseJson.Items[0]);
            }else {
                reject("Security report not found.");
            }
        })
        .catch((error) => {
            reject(error);
        });
    });
}

async function downloadSecurityReport(report, reportType = "SAST") {
    if (!report) {
        return null;
    }
	const downloadLink = report.DownloadLink;
	const reportName = `${report.Name}_${reportType}.html`;
    try {
        const response = await got.get(downloadLink, { headers: getRequestHeaders(), retry: { limit: 3, methods: ["GET"] }, https: { rejectUnauthorized: enableSSL } });
		fs.writeFileSync(reportName, response.body);
        return { html: response.body, downloadLink: downloadLink};
    }catch (e) {
        console.log("Failed to download security report:", e.message);
        return null;
    }
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
        .then(async (scanIds) => {
			if (process.env.INPUT_WAIT_FOR_ANALYSIS !== 'true') {
				core.info("Generating minimum summary...");
				if (scanIds.sastScanId) {
					await generateMinimumSummary(scanIds.sastScanId, "SAST");
				}
				if (scanIds.scaScanId) {
					await generateMinimumSummary(scanIds.scaScanId, "SCA");
				}
			}
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

export default { getScanResults, runAnalysis, getSastScanStatus, getScaScanStatus, getNonCompliantIssues, getSastScanDetails, createSecurityReport, getSecurityReport,downloadSecurityReport, getScaScanDetails, generateMinimumSummary, writeSummaryMarkdown }
