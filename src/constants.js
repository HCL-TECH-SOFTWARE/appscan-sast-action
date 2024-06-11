/*
Copyright 2022, 2024 HCL America, Inc.

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

const CURRENT_VERSION = '1.0.4';
const _CURRENT_VERSION = CURRENT_VERSION;
export { _CURRENT_VERSION as CURRENT_VERSION };

//Service url and endpoints:
const _SERVICE_URL = 'https://cloud.appscan.com';
export { _SERVICE_URL as SERVICE_URL };
const _SACLIENT_PATH = '/api/v4/Tools/SAClientUtil?os=';
export { _SACLIENT_PATH as SACLIENT_PATH };
const _API_LOGIN = '/api/v4/Account/ApiKeyLogin';
export { _API_LOGIN as API_LOGIN };
const _API_ISSUES = '/api/v4/Issues/Scan/';
export { _API_ISSUES as API_ISSUES };
const _CLIENT_TYPE = 'github-sast';
export { _CLIENT_TYPE as CLIENT_TYPE };

//User messages:
const _DOWNLOADING_CLIENT = 'Downloading the SAClientUtil...';
export { _DOWNLOADING_CLIENT as DOWNLOADING_CLIENT };
const _GENERATING_IRX = 'Generating irx file...';
export { _GENERATING_IRX as GENERATING_IRX };
const _AUTHENTICATE_ASOC = 'Authenticating with the AppScan service...';
export { _AUTHENTICATE_ASOC as AUTHENTICATE_ASOC };
const _SUBMITTING_IRX = 'Submitting the irx for analysis...';
export { _SUBMITTING_IRX as SUBMITTING_IRX };
const _IRX_SUBMIT_SUCCESS = 'Successfully submitted the irx to the AppScan service.';
export { _IRX_SUBMIT_SUCCESS as IRX_SUBMIT_SUCCESS };
const _WAIT_FOR_ANALYSIS = 'Waiting for analysis to complete...';
export { _WAIT_FOR_ANALYSIS as WAIT_FOR_ANALYSIS };
const _GETTING_RESULTS = 'Getting results...';
export { _GETTING_RESULTS as GETTING_RESULTS };
const _ANALYSIS_SUCCESS = 'Analysis complete.';
export { _ANALYSIS_SUCCESS as ANALYSIS_SUCCESS };
const _ANALYSIS_TIMEOUT = 'Timed out waiting for analysis to complete. Review the scan in AppScan to see the results.'
export { _ANALYSIS_TIMEOUT as ANALYSIS_TIMEOUT };
const _TOTAL_ISSUES = 'Total issues: ';
export { _TOTAL_ISSUES as TOTAL_ISSUES };
const _ISSUES_COLON = ' issues: ';
export { _ISSUES_COLON as ISSUES_COLON };

//Error messages:
const _ERROR_DOWNLOADING_CLIENT = 'An error occurred downloading the SAClientUtil. Status code ';
export { _ERROR_DOWNLOADING_CLIENT as ERROR_DOWNLOADING_CLIENT };
const _ERROR_FILE_DOES_NOT_EXIST = 'An error occurred extracting the SAClientUtil. The file does not exist: '
export { _ERROR_FILE_DOES_NOT_EXIST as ERROR_FILE_DOES_NOT_EXIST };
const _ERROR_INVALID_APP_ID = 'Invalid application ID.'
export { _ERROR_INVALID_APP_ID as ERROR_INVALID_APP_ID };
const _ERROR_ANALYSIS_FAILED = 'Analysis failed. Review the scan in AppScan for additional details.'
export { _ERROR_ANALYSIS_FAILED as ERROR_ANALYSIS_FAILED };
const _ERROR_NONCOMPLIANT_ISSUES = 'Failed. Non-compliant issues were found in the scan.';
export { _ERROR_NONCOMPLIANT_ISSUES as ERROR_NONCOMPLIANT_ISSUES };
const _ERROR_BAD_SCAN_ID = 'An error occurred submitting the irx for analysis.';
export { _ERROR_BAD_SCAN_ID as ERROR_BAD_SCAN_ID };
