/* © Copyright HCL Technologies Ltd. 2022 */

//Service url and endpoints
const SERVICE_URL = 'https://cloud.appscan.com';
exports.SERVICE_URL = SERVICE_URL;
const SACLIENT_PATH = '/api/SCX/StaticAnalyzer/SAClientUtil?os=';
exports.SACLIENT_PATH = SACLIENT_PATH;

//Error messages:
const ERROR_DOWNLOADING_CLIENT = 'An error occurred downloading the SAClientUtil. Status code ';
exports.ERROR_DOWNLOADING_CLIENT = ERROR_DOWNLOADING_CLIENT;
const ERROR_FILE_DOES_NOT_EXIST = 'An error occurred extracting the SAClientUtil. The file does not exist: '
exports.ERROR_FILE_DOES_NOT_EXIST = ERROR_FILE_DOES_NOT_EXIST;
const ERROR_INVALID_APP_ID = 'Invalid application ID.'
exports.ERROR_INVALID_APP_ID = ERROR_INVALID_APP_ID;
