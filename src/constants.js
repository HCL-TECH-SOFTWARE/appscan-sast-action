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

const CURRENT_VERSION = '1.0.3';
const _CURRENT_VERSION = CURRENT_VERSION;
export { _CURRENT_VERSION as CURRENT_VERSION };

//Service url and endpoints:
const SERVICE_URL = 'https://cloud.appscan.com';
const _SERVICE_URL = SERVICE_URL;
export { _SERVICE_URL as SERVICE_URL };
const SACLIENT_PATH = '/api/SCX/StaticAnalyzer/SAClientUtil?os=';
const _SACLIENT_PATH = SACLIENT_PATH;
export { _SACLIENT_PATH as SACLIENT_PATH };
const API_LOGIN = '/api/V2/Account/ApiKeyLogin';
const _API_LOGIN = API_LOGIN;
export { _API_LOGIN as API_LOGIN };
const API_SCAN_COUNT_BY_SEVERITY = '/api/v2/Issues/CountBySeverity/scan/';
const _API_SCAN_COUNT_BY_SEVERITY = API_SCAN_COUNT_BY_SEVERITY;
export { _API_SCAN_COUNT_BY_SEVERITY as API_SCAN_COUNT_BY_SEVERITY };
const CLIENT_TYPE = 'github-sast';
const _CLIENT_TYPE = CLIENT_TYPE;
export { _CLIENT_TYPE as CLIENT_TYPE };

//User messages:
const DOWNLOADING_CLIENT = 'Downloading the SAClientUtil...';
const _DOWNLOADING_CLIENT = DOWNLOADING_CLIENT;
export { _DOWNLOADING_CLIENT as DOWNLOADING_CLIENT };
const GENERATING_IRX = 'Generating irx file...'
const _GENERATING_IRX = GENERATING_IRX;
export { _GENERATING_IRX as GENERATING_IRX };
const AUTHENTICATE_ASOC = 'Authenticating with the ASoC service...';
const _AUTHENTICATE_ASOC = AUTHENTICATE_ASOC;
export { _AUTHENTICATE_ASOC as AUTHENTICATE_ASOC };
const SUBMITTING_IRX = 'Submitting the irx for analysis...';
const _SUBMITTING_IRX = SUBMITTING_IRX;
export { _SUBMITTING_IRX as SUBMITTING_IRX };
const IRX_SUBMIT_SUCCESS = 'Successfully submitted the irx to the ASoC service.';
const _IRX_SUBMIT_SUCCESS = IRX_SUBMIT_SUCCESS;
export { _IRX_SUBMIT_SUCCESS as IRX_SUBMIT_SUCCESS };
const WAIT_FOR_ANALYSIS = 'Waiting for analysis to complete...';
const _WAIT_FOR_ANALYSIS = WAIT_FOR_ANALYSIS;
export { _WAIT_FOR_ANALYSIS as WAIT_FOR_ANALYSIS };
const GETTING_RESULTS = 'Getting results...';
const _GETTING_RESULTS = GETTING_RESULTS;
export { _GETTING_RESULTS as GETTING_RESULTS };
const ANALYSIS_SUCCESS = 'Analysis complete.';
const _ANALYSIS_SUCCESS = ANALYSIS_SUCCESS;
export { _ANALYSIS_SUCCESS as ANALYSIS_SUCCESS };
const ANALYSIS_TIMEOUT = 'Timed out waiting for analysis to complete. Review the scan in ASoC to see the results.'
const _ANALYSIS_TIMEOUT = ANALYSIS_TIMEOUT;
export { _ANALYSIS_TIMEOUT as ANALYSIS_TIMEOUT };
const TOTAL_ISSUES = 'Total issues: ';
const _TOTAL_ISSUES = TOTAL_ISSUES;
export { _TOTAL_ISSUES as TOTAL_ISSUES };
const ISSUES_COLON = ' issues: ';
const _ISSUES_COLON = ISSUES_COLON;
export { _ISSUES_COLON as ISSUES_COLON };

//Error messages:
const ERROR_DOWNLOADING_CLIENT = 'An error occurred downloading the SAClientUtil. Status code ';
const _ERROR_DOWNLOADING_CLIENT = ERROR_DOWNLOADING_CLIENT;
export { _ERROR_DOWNLOADING_CLIENT as ERROR_DOWNLOADING_CLIENT };
const ERROR_FILE_DOES_NOT_EXIST = 'An error occurred extracting the SAClientUtil. The file does not exist: '
const _ERROR_FILE_DOES_NOT_EXIST = ERROR_FILE_DOES_NOT_EXIST;
export { _ERROR_FILE_DOES_NOT_EXIST as ERROR_FILE_DOES_NOT_EXIST };
const ERROR_INVALID_APP_ID = 'Invalid application ID.'
const _ERROR_INVALID_APP_ID = ERROR_INVALID_APP_ID;
export { _ERROR_INVALID_APP_ID as ERROR_INVALID_APP_ID };
const ERROR_ANALYSIS_FAILED = 'Analysis failed. Review the scan in ASoC for additional details.'
const _ERROR_ANALYSIS_FAILED = ERROR_ANALYSIS_FAILED;
export { _ERROR_ANALYSIS_FAILED as ERROR_ANALYSIS_FAILED };
const ERROR_NONCOMPLIANT_ISSUES = 'Failed. Non-compliant issues were found in the scan.';
const _ERROR_NONCOMPLIANT_ISSUES = ERROR_NONCOMPLIANT_ISSUES;
export { _ERROR_NONCOMPLIANT_ISSUES as ERROR_NONCOMPLIANT_ISSUES };
const ERROR_BAD_SCAN_ID = 'An error occurred submitting the irx for analysis.';
const _ERROR_BAD_SCAN_ID = ERROR_BAD_SCAN_ID;
export { _ERROR_BAD_SCAN_ID as ERROR_BAD_SCAN_ID };
