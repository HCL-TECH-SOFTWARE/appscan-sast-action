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

function getProxyHost() {
    return process.env.INPUT_PROXY_HOST;
}

function getProxyPort() {
    return process.env.INPUT_PROXY_PORT;
}

function getProxyUser() {
    return process.env.INPUT_PROXY_USER;
}

function getProxyPwd() {
    return process.env.INPUT_PROXY_PWD;
}

function isHttpsProxy() {
    return process.env.INPUT_PROXY_HTTPS === 'true';
}

function getProxySettings() {
    let proxySettings = getProxySettingsFromInputs();
    if (!proxySettings) {
        proxySettings = getProxySettingsFromEnvironment();
    }
    return proxySettings;
}

function getProxySettingsFromInputs() {
    let proxyHost = getProxyHost();
    let proxyPort = getProxyPort();
    let proxyUser = getProxyUser();
    let proxyPwd  = getProxyPwd();
    let proxy = null;
    
    if (proxyHost && proxyPort) {  //Connection through proxy

        if (proxyUser && proxyPwd) {
            let auth = 'Basic ' + Buffer.from(proxyUser + ':' + proxyPwd).toString('base64');
            proxy = {
                host: proxyHost, 
                port: proxyPort,
                username: proxyUser,
                password: proxyPwd,
                headers: {
                    'Proxy-Authorization': auth
                }
            }
        } else {
            proxy = {
                host: proxyHost, 
                port: proxyPort
            }
        }
        
        if (isHttpsProxy()) {
            proxy.protocol = 'https:';
        }
    }
    return proxy;
}

function getProxySettingsFromEnvironment() {
    let proxyUrl = process.env.https_proxy 
        || process.env.HTTPS_PROXY 
        || process.env.http_proxy  
        || process.env.HTTP_PROXY;

    if (proxyUrl) {
        let { hostname: proxyHost, port: proxyPort } = new URL(proxyUrl);
        let proxy = {
            host: proxyHost,
            port: proxyPort
        };
        if (isHttpsProxy()) {
            proxy.protocol = 'https:';
        }
        return proxy;
    }

    return null;
}

export default { getProxySettings }
