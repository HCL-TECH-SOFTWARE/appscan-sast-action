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

function write(filePaths) {
    return new Promise((resolve) => {
        const includes = filePaths
            .map(path => `                    <Include>${escapeXml(path)}</Include>`)
            .join('\n');

        const xml = `
        <Configuration>
            <Targets>
                <Target path=".">
                    ${includes}
                </Target>
            </Targets>
        </Configuration>`;

        fs.writeFileSync('appscan-config.xml', xml, 'utf8');
        resolve();
    });
}

function escapeXml(str) {
    return str
        .replace(/\\/g, '/')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

export default { write }