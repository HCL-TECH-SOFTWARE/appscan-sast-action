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

import * as core from '@actions/core';
import * as github from '@actions/github';
import * as constants from './constants.js';
import configWriter from './configWriter.js';

function generate() {
    return new Promise((resolve, reject) => {
        getModifiedFiles()
        .then((changedPaths) => {
            return configWriter.write(changedPaths);
        })
        .then(() => {
            resolve();
        })
        .catch((error) => {
            reject(error);
        });
    });
}

function getModifiedFiles() {
    return new Promise((resolve, reject) => {
        const token = core.getInput('github-token', { required: true });
        const octokit = github.getOctokit(token);
        const pullRequest = github.context.payload && github.context.payload.pull_request;

        if (!pullRequest) {
            return reject(constants.ERROR_NOT_PULL_REQUEST);
        }

        return octokit.paginate(
            octokit.rest.pulls.listFiles,
            {
                owner: github.context.repo.owner,
                repo: github.context.repo.repo,
                pull_number: pullRequest.number,
                per_page: 100
            })
            .then((files) => {
                resolve(files
                    .filter((file) => file.status === 'modified' || file.status === 'added')
                    .map((file) => file.filename));
            })
            .catch((error) => {
                reject(error);
            });
        });
}

export default { generate }