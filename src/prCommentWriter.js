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

import * as github from '@actions/github';
import * as core from '@actions/core';

async function postComment(markdown) {
	if (!markdown || !markdown.trim()) {
		core.warning("No markdown content available. Skipping PR comment creation.");
		return;
	}
	const pullRequest = github.context.payload.pull_request;
	if (!pullRequest) {
		return;
	}		
	const token = process.env.INPUT_GITHUB_TOKEN;
	if (!token) {
		core.warning("GitHub token not available. Skipping PR comment creation.");
		return;
	}
	const octokit = github.getOctokit(token);
	const owner = github.context.repo.owner;
	const repo = github.context.repo.repo;
	const issueNumber = pullRequest.number;
	if (!issueNumber) {
		core.warning("Pull request number not found.");
		return;
	}
	try {
		const { data: comments } = await octokit.rest.issues.listComments({owner, repo, issue_number: issueNumber});
		const existingComments = comments.filter(comment => comment.user?.type === "Bot" && comment.body?.includes("<!-- HCL_APPSCAN_SUMMARY -->"));
		for (const comment of existingComments) {
			await octokit.rest.issues.deleteComment({owner, repo, comment_id: comment.id});
			core.info(`Successfully deleted previous comment on PR number: ${issueNumber}`);
		} 
		await octokit.rest.issues.createComment({owner, repo, issue_number: issueNumber, body: markdown});
		core.info(`Successfully created comment on PR number: ${issueNumber}`);
	} catch (error) {
		core.warning(`Failed to create/delete PR comment: ${error.message}`);
	}	
}

export { postComment }