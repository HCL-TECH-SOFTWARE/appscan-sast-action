/* © Copyright HCL Technologies Ltd. 2022 */

//Service url and endpoints:
const SERVICE_URL = 'https://cloud.appscan.com';
exports.SERVICE_URL = SERVICE_URL;
const SACLIENT_PATH = '/api/SCX/StaticAnalyzer/SAClientUtil?os=';
exports.SACLIENT_PATH = SACLIENT_PATH;
const API_LOGIN = '/api/V2/Account/ApiKeyLogin';
exports.API_LOGIN = API_LOGIN;
const API_SCAN_COUNT_BY_SEVERITY = '/api/v2/Issues/CountBySeverity/scan/';
exports.API_SCAN_COUNT_BY_SEVERITY = API_SCAN_COUNT_BY_SEVERITY;
const CLIENT_TYPE = 'github-static-analyzer-action';
exports.CLIENT_TYPE = CLIENT_TYPE;

//User messages:
const DOWNLOADING_CLIENT = 'Downloading the SAClientUtil...';
exports.DOWNLOADING_CLIENT = DOWNLOADING_CLIENT;
const GENERATING_IRX = 'Generating irx file...'
exports.GENERATING_IRX = GENERATING_IRX;
const AUTHENTICATE_ASOC = 'Authenticating with the ASoC service...';
exports.AUTHENTICATE_ASOC = AUTHENTICATE_ASOC;
const SUBMITTING_IRX = 'Submitting the irx for analysis...';
exports.SUBMITTING_IRX = SUBMITTING_IRX;
const IRX_SUBMIT_SUCCESS = 'Successfully submitted the irx to the ASoC service.';
exports.IRX_SUBMIT_SUCCESS = IRX_SUBMIT_SUCCESS;
const WAIT_FOR_ANALYSIS = 'Waiting for analysis to complete...';
exports.WAIT_FOR_ANALYSIS = WAIT_FOR_ANALYSIS;
const GETTING_RESULTS = 'Getting results...';
exports.GETTING_RESULTS = GETTING_RESULTS;
const ANALYSIS_SUCCESS = 'Analysis complete.';
exports.ANALYSIS_SUCCESS = ANALYSIS_SUCCESS;
const ANALYSIS_TIMEOUT = 'Timed out waiting for analysis to complete. Review the scan in ASoC to see the results.'
exports.ANALYSIS_TIMEOUT = ANALYSIS_TIMEOUT;
const TOTAL_ISSUES = 'Total issues = ';
exports.TOTAL_ISSUES = TOTAL_ISSUES;

//Error messages:
const ERROR_DOWNLOADING_CLIENT = 'An error occurred downloading the SAClientUtil. Status code ';
exports.ERROR_DOWNLOADING_CLIENT = ERROR_DOWNLOADING_CLIENT;
const ERROR_FILE_DOES_NOT_EXIST = 'An error occurred extracting the SAClientUtil. The file does not exist: '
exports.ERROR_FILE_DOES_NOT_EXIST = ERROR_FILE_DOES_NOT_EXIST;
const ERROR_INVALID_APP_ID = 'Invalid application ID.'
exports.ERROR_INVALID_APP_ID = ERROR_INVALID_APP_ID;
const ERROR_ANALYSIS_FAILED = 'Analysis failed. Review the scan in ASoC for additional details.'
exports.ERROR_ANALYSIS_FAILED = ERROR_ANALYSIS_FAILED;
const ERROR_NONCOMPLIANT_ISSUES = 'Failed. Non-compliant issues were found in the scan.';
exports.ERROR_NONCOMPLIANT_ISSUES = ERROR_NONCOMPLIANT_ISSUES;
