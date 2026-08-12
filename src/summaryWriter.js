/*
Copyright 2026 HCL America, Inc.

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

import * as fs from 'fs';
import * as core from '@actions/core';
import settings from './settings.js';

function getGitHubContext() {
    const isPR = process.env.GITHUB_EVENT_NAME === 'pull_request';
    const repoName = process.env.GITHUB_REPOSITORY || "";
    const branchName = process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || "";
    const commitSha = process.env.GITHUB_SHA ? process.env.GITHUB_SHA.substring(0, 7) : "";
	const serverUrl = process.env.GITHUB_SERVER_URL || "https://github.com";
    let prNumber = "";
    try {
        if (process.env.GITHUB_EVENT_PATH && fs.existsSync(process.env.GITHUB_EVENT_PATH)) {
            const eventPayload = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
            prNumber = eventPayload.pull_request?.number || "";
        }
    } catch (e) {
        console.log("Failed to read PR information:", e.message);
    }
    return {isPR, repoName, branchName, commitSha, prNumber, serverUrl};
}

function generateSummaryMarkdown(summaryData, reportDownloadLink, reportName) {
	const {total, counts, scanId, scanUrl, appName, appUrl, scanTime, scanType, isPR, repoName, branchName, commitSha, prNumber, serverUrl} = summaryData;
	const scanLabel = isPR ? `${scanType} PR Scan Summary` : `${scanType} Scan Summary`;
	const prUrl = `${serverUrl}/${repoName}/pull/${prNumber}`;
	const branchUrl = `${serverUrl}/${repoName}/tree/${branchName}`;
	const commitUrl = `${serverUrl}/${repoName}/commit/${process.env.GITHUB_SHA}`;
	const prSection = isPR ? `
## Pull Request Information

| | |
|------|------|
| PR Number | [#${prNumber}](${prUrl}) |
| Branch | [${branchName}](${branchUrl}) |
| Commit | [${commitSha}](${commitUrl}) |

---`
: "";
    const enableHyperlinks = process.env.INPUT_SCAN_INFO_HYPERLINKS !== "false";
	const scanIdValue = enableHyperlinks ? `[${scanId}](${scanUrl})` : scanId;
	const appNameValue = enableHyperlinks ? `[${appName}](${appUrl})` : appName;
	const reportLabel = `📥 ${reportName} ${scanType}`;
	const reportValue = enableHyperlinks ? `[${reportLabel}](${reportDownloadLink})` : "";
	const md = `<!-- HCL_APPSCAN_SUMMARY -->
# 🛡️ HCL AppScan ${scanLabel}

${prSection}

## 🔍 Scan Information

| | |
|------|-------|
| Scan Type | ${scanType} |
| Scan ID | ${scanIdValue} |
| Application Name | ${appNameValue} |
| Repository | ${repoName} |
| Scan Time | ${scanTime} |
| Report | ${reportValue} |


## 🚨 Vulnerability Summary

| Severity | Count |
|----------|------:|
| 🔴 Critical | **${counts.Critical}** |
| 🟠 High | **${counts.High}** |
| 🟠 Medium | **${counts.Medium}** |
| 🟡 Low | **${counts.Low}** |
| ⚪ Informational | **${counts.Informational}** |

### 📊 **Total Vulnerabilities: ${total}**

---

`;
    return md;
}

function writeSummaryMarkdown(summaryData, reportDownloadLink, reportName) {
	const md = generateSummaryMarkdown(summaryData, reportDownloadLink, reportName);
	const {scanType, isPR} = summaryData;
	const mdFileName = isPR ? `appscan-${scanType.toLowerCase()}-pr-report.md` : `appscan-${scanType.toLowerCase()}-build-summary-report.md`;
	fs.writeFileSync(mdFileName, md);
	if (process.env.GITHUB_STEP_SUMMARY) {
		fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
	}
	return md;
}

async function generateMinimumSummary(getScanDetails, scanId, scanType) {
    const summaryContext = await getSummaryContext(getScanDetails, scanId, scanType);
	const {scanUrl, appUrl, appName, scanTime, isPR, repoName, branchName, commitSha, prNumber, serverUrl} = summaryContext;
    const enableHyperlinks = process.env.INPUT_SCAN_INFO_HYPERLINKS !== "false";
    const scanIdValue = enableHyperlinks ? `[${scanId}](${scanUrl})` : scanId;
    const appNameValue = enableHyperlinks ? `[${appName}](${appUrl})` : appName;
	const prUrl = `${serverUrl}/${repoName}/pull/${prNumber}`;
	const branchUrl = `${serverUrl}/${repoName}/tree/${branchName}`;
	const commitUrl = `${serverUrl}/${repoName}/commit/${process.env.GITHUB_SHA}`;
	const prSection = isPR ? `
## Pull Request Information

| | |
|------|------|
| PR Number | [#${prNumber}](${prUrl}) |
| Branch | [${branchName}](${branchUrl}) |
| Commit | [${commitSha}](${commitUrl}) |

---`
: "";	
    const md = `<!-- HCL_APPSCAN_SUMMARY -->
# HCL AppScan ${scanType} ${isPR ? "PR " : ""}Scan Summary

${prSection}

## 🔍 Scan Information

| | |
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
	return md;
}

async function buildIssueSummary(getScanDetails, groupedItems, scanId, scanType) {
	const counts = {Critical: 0, High: 0, Medium: 0, Low: 0, Informational: 0};
	groupedItems.forEach(item => {
		if (counts[item.Severity] !== undefined) {
			counts[item.Severity] += Number(item.N || 0);
		}
    });
	const total = Object.values(counts).reduce((a,b)=>a+b, 0);
	const summaryContext = await getSummaryContext(getScanDetails, scanId, scanType);
	return({total, counts, ...summaryContext});
}

async function getSummaryContext(getScanDetails, scanId, scanType) {
    const serviceUrl = settings.getServiceUrl();
    const baseUrl = serviceUrl.replace("/api/v4", "");
    const applicationId = process.env.INPUT_APPLICATION_ID;
    const scanUrl = `${baseUrl}/main/myapps/${applicationId}/scans/${scanId}`;
    const appUrl = `${baseUrl}/main/myapps/${applicationId}`;
    let appName = applicationId;
    try {
        let scanDetails = null;
        if (scanType === "SAST") {
            scanDetails = await getScanDetails(scanId, "Sast");
        } else if (scanType === "SCA") {
            scanDetails = await getScanDetails(scanId, "Sca");
        }
        if (scanDetails) {
            appName = scanDetails.AppName || appName;
        }
    }
    catch (e) {
        console.log("Failed to fetch AppName from scan details:", e.message);
    }
    const scanTime = new Date().toISOString().replace("T", " ").substring(0, 19);
    return {scanId, scanUrl, appName, appUrl, scanTime, scanType, ...getGitHubContext()};
}

function combineMarkdown(sastMarkdown, scaMarkdown) {
    const markdowns = [];

    if (sastMarkdown) {
        markdowns.push(
            removePullRequestSection(
				sastMarkdown
				.replace("<!-- HCL_APPSCAN_SUMMARY -->", "")
				.replace("# 🛡️ HCL AppScan SAST PR Scan Summary", "## 🛡️ SAST Scan Summary")
				.replace("# 🛡️ HCL AppScan SAST Scan Summary", "## 🛡️ SAST Scan Summary")
			)
        );
    }
    if (scaMarkdown) {
        markdowns.push(
            removePullRequestSection(
				scaMarkdown
				.replace("<!-- HCL_APPSCAN_SUMMARY -->", "")
				.replace("# 🛡️ HCL AppScan SCA PR Scan Summary", "## 🛡️ SCA Scan Summary")
				.replace("# 🛡️ HCL AppScan SCA Scan Summary", "## 🛡️ SCA Scan Summary")
			)
        );
    }
    const summaryContext = getGitHubContext();
    const prUrl = `${summaryContext.serverUrl}/${summaryContext.repoName}/pull/${summaryContext.prNumber}`;
    const branchUrl = `${summaryContext.serverUrl}/${summaryContext.repoName}/tree/${summaryContext.branchName}`;
    const commitUrl = `${summaryContext.serverUrl}/${summaryContext.repoName}/commit/${process.env.GITHUB_SHA}`;
    const prSection = summaryContext.isPR ? `
## Pull Request Information

| Field | Value |
|------|------|
| PR Number | [#${summaryContext.prNumber}](${prUrl}) |
| Branch | [${summaryContext.branchName}](${branchUrl}) |
| Commit | [${summaryContext.commitSha}](${commitUrl}) |

---
` : "";

    return `<!-- HCL_APPSCAN_SUMMARY -->
# HCL AppScan ${summaryContext.isPR ? "PR " : ""}Scan Summary
${prSection}

${markdowns.join("\n\n---\n\n")}
`;
}

function removePullRequestSection(markdown) {
    const start = markdown.indexOf("## 🔀 Pull Request Information");
    if (start === -1) {
        return markdown;
    }
    const end = markdown.indexOf("## 🔍 Scan Information");
    if (end === -1) {
        return markdown;
    }
    return markdown.substring(0, start) + markdown.substring(end);
}


export default { generateMinimumSummary, generateSummaryMarkdown, writeSummaryMarkdown, getGitHubContext, buildIssueSummary, combineMarkdown }
