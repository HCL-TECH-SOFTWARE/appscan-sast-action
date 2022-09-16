# HCL AppScan Static Analyzer Github Action
Your code is better and more secure with HCL AppScan Static Analyzer.

The HCL AppScan Static Analyzer Github Action enables you to run static analysis security testing (SAST) against the files in your repository. Run as a GitHub Action, the SAST scan identifies security vulnerabilities in your code.

# Usage
## Register
If you don't have an account, register on [HCL AppScan on Cloud (ASoC)](https://www.hcltechsw.com/appscan/codesweep-for-github) to generate your API key/secret.

## Setup
1. After logging into ASoC, go to [the API page](https://cloud.appscan.com/main/settings) to generate your API key/secret pair. These must be used in the asoc_key and asoc_secret parameters for the action. It's recommended to store them as secrets in your repository.
   ![adingkeys_animation](img/keyAndSecret.gif)
2. To scan code changes when a pull request is opened, add the following file to your repository under .github/workflows/codesweep.yml or update an existing workflow file:
```yaml
name: "HCL AppScan Static Analyzer"
on:
  pull_request:
    types: [opened,synchronize]
jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v1
      - name: Run AppScan CodeSweep
        uses: HCL-TECH-SOFTWARE/appscan-codesweep-action@v2
        with:
          asoc_key: ${{secrets.ASOC_KEY}}
          asoc_secret: ${{secrets.ASOC_SECRET}}
    env: 
      GITHUB_TOKEN: ${{secrets.GITHUB_TOKEN}}
```
**Note** If you use **checkout@v2** or later you must set fetch-depth to 0. For example:
```yaml
uses: actions/checkout@v2
with:
  fetch-depth: 0
```
# Optional Parameters For Scanning
- status - The status of the checks if any security issues are found. Must be one of 'action_required', 'failure', or 'neutral'. The default is neutral. For example:
```yaml
with:
  status: failure
```
# Optional Parameters For Publishing Issues to AppScan on Cloud
- issue_status - The status of issues that are published to ASoC. Must be one of 'open', 'inprogress', 'noise', 'fixed', or 'passed'. The default is 'open'.
- scan_base_name - The base name of the scan for issues published to ASoC. A timestamp is appended to the given base name. The default is 'GitHub_CodeSweep'.
- personal_scan - When issues are published to ASoC, the scan representing those issues can be made a [personal scan](https://help.hcltechsw.com/appscan/ASoC/appseccloud_scans_personal.html). The default is false.
```yaml
with:
  publish_on_merge: true
  application_id: 6c058381-17ca-e711-8de5-002590ac753d
  issue_status: "inprogress"
  scan_base_name: "CodeSweep"
  personal_scan: true
```
