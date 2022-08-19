/* © Copyright HCL Technologies Ltd. 2022 */

//Service url and endpoints
const SERVICE_URL = 'https://cloud.appscan.com';
const SACLIENT_PATH = '/api/SCX/StaticAnalyzer/SAClientUtil?os=';


//Error messages:
ERROR_DOWNLOADING_CLIENT = 'An error occurred downloading the SAClientUtil. Status code ';
ERROR_FILE_DOES_NOT_EXIST = 'An error occurred extracting the SAClientUtil. The file does not exist: '
ERROR_INVALID_APP_ID = 'Invalid application ID.'