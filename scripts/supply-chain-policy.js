import fs from 'fs';
import path from 'path';

const MINIMUM_AGE_DAYS = parseInt(process.env.MINIMUM_DEPENDENCY_AGE_DAYS ?? '7', 10);
const ALLOW_YOUNG_DEPENDENCIES = process.env.SUPPLY_CHAIN_ALLOW_YOUNG === 'true';
const EXCEPTION_JUSTIFICATION = process.env.SUPPLY_CHAIN_EXCEPTION_JUSTIFICATION?.trim();
const EXCEPTION_PSIRT_TICKET = process.env.SUPPLY_CHAIN_EXCEPTION_PSIRT_TICKET?.trim();
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_ROOT = process.cwd();

function getWorkflowFiles() {
    const workflowsDir = path.join(REPO_ROOT, '.github', 'workflows');
    if (!fs.existsSync(workflowsDir)) {
        return [];
    }

    return fs.readdirSync(workflowsDir)
        .filter((file) => file.endsWith('.yml') || file.endsWith('.yaml'))
        .map((file) => path.join(workflowsDir, file));
}

function parseNpmrc() {
    const npmrcPath = path.join(REPO_ROOT, '.npmrc');
    if (!fs.existsSync(npmrcPath)) {
        return {};
    }

    const content = fs.readFileSync(npmrcPath, 'utf8');
    const values = {};
    for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) {
            continue;
        }
        const separatorIndex = line.indexOf('=');
        if (separatorIndex <= 0) {
            continue;
        }
        const key = line.slice(0, separatorIndex).trim();
        const value = line.slice(separatorIndex + 1).trim();
        values[key] = value;
    }
    return values;
}

function getDependabotViolations(minimumAgeDays) {
    const violations = [];
    const dependabotPath = path.join(REPO_ROOT, '.github', 'dependabot.yml');
    if (!fs.existsSync(dependabotPath)) {
        violations.push('.github/dependabot.yml is required for github-actions cooldown enforcement');
        return violations;
    }

    const content = fs.readFileSync(dependabotPath, 'utf8');
    const githubActionsBlockMatch = content.match(/-\s*package-ecosystem:\s*["']github-actions["'][\s\S]*?(?=\n\s*-\s*package-ecosystem:|\s*$)/);
    if (!githubActionsBlockMatch) {
        violations.push('.github/dependabot.yml must define a github-actions update block');
        return violations;
    }

    const block = githubActionsBlockMatch[0];
    const cooldownMatch = block.match(/cooldown:\s*\n\s*default-days:\s*(\d+)/);
    if (!cooldownMatch) {
        violations.push('.github/dependabot.yml github-actions block must define cooldown.default-days');
        return violations;
    }

    const cooldownDays = parseInt(cooldownMatch[1], 10);
    if (!Number.isInteger(cooldownDays) || cooldownDays < minimumAgeDays) {
        violations.push(`.github/dependabot.yml github-actions cooldown.default-days must be >= ${minimumAgeDays}`);
    }

    return violations;
}

function parseWorkflowControls(workflowPath) {
    const content = fs.readFileSync(workflowPath, 'utf8');
    const lines = content.split(/\r?\n/);
    const controls = {
        uses: [],
        npmInstallsWithoutIgnoreScripts: []
    };

    for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        const usesMatch = line.match(/^\s*uses:\s*([^#\s]+)\s*(?:#.*)?$/);
        if (usesMatch) {
            controls.uses.push({ workflowPath, line: i + 1, value: usesMatch[1].trim().replace(/^['"]|['"]$/g, '') });
            continue;
        }

        const runMatch = line.match(/^(\s*)run:\s*(.*)$/);
        if (!runMatch) {
            continue;
        }

        const runIndent = runMatch[1].length;
        const runValue = runMatch[2].trim();
        const commands = [];
        if (runValue === '|' || runValue === '>') {
            for (let j = i + 1; j < lines.length; j += 1) {
                const candidate = lines[j];
                const candidateIndent = candidate.match(/^\s*/)?.[0].length ?? 0;
                if (candidate.trim().length === 0) {
                    commands.push('');
                    continue;
                }
                if (candidateIndent <= runIndent) {
                    i = j - 1;
                    break;
                }
                commands.push(candidate.trim());
                if (j === lines.length - 1) {
                    i = j;
                }
            }
        } else {
            commands.push(runValue.replace(/^['"]|['"]$/g, ''));
        }

        const commandText = commands.join('\n');
        if (/\bnpm\s+(?:ci|install)\b/.test(commandText) && !/--ignore-scripts\b/.test(commandText)) {
            controls.npmInstallsWithoutIgnoreScripts.push({ workflowPath, line: i + 1, commandText });
        }
    }

    return controls;
}

function parseActionReference(ref) {
    if (ref.startsWith('./')) {
        return null;
    }

    const atIndex = ref.lastIndexOf('@');
    if (atIndex <= 0) {
        return null;
    }

    const actionPath = ref.slice(0, atIndex);
    const refValue = ref.slice(atIndex + 1);
    const actionParts = actionPath.split('/');
    if (actionParts.length < 2) {
        return null;
    }

    return {
        owner: actionParts[0],
        repo: actionParts[1],
        ref: refValue
    };
}

function isImmutableReference(ref) {
    return /^[0-9a-f]{40}$/i.test(ref);
}

function getPackageNameFromPath(packagePath) {
    if (!packagePath.includes('node_modules/')) {
        return null;
    }

    const lastNodeModulesIdx = packagePath.lastIndexOf('node_modules/');
    return packagePath.slice(lastNodeModulesIdx + 'node_modules/'.length);
}

function getLockedDependencies() {
    const lockPath = path.join(REPO_ROOT, 'package-lock.json');
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    const packages = lock.packages ?? {};
    const pairs = new Map();

    for (const [packagePath, metadata] of Object.entries(packages)) {
        const packageName = getPackageNameFromPath(packagePath);
        if (!packageName || !metadata || typeof metadata.version !== 'string') {
            continue;
        }
        pairs.set(`${packageName}@${metadata.version}`, {
            name: packageName,
            version: metadata.version
        });
    }

    return [...pairs.values()];
}

function getAgeInDays(isoDate) {
    const published = new Date(isoDate);
    const ageMs = Date.now() - published.getTime();
    return ageMs / (1000 * 60 * 60 * 24);
}

async function fetchNpmMetadata(packageName) {
    const url = `https://registry.npmjs.org/${encodeURIComponent(packageName)}`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch npm metadata for ${packageName}: HTTP ${response.status}`);
    }
    return response.json();
}

async function fetchActionCommitDate(owner, repo, sha) {
    const headers = {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'appscan-sast-action-supply-chain-policy'
    };

    if (GITHUB_TOKEN) {
        headers.Authorization = `Bearer ${GITHUB_TOKEN}`;
    }

    const url = `https://api.github.com/repos/${owner}/${repo}/commits/${sha}`;
    const response = await fetch(url, { headers });
    if (!response.ok) {
        throw new Error(`Failed to fetch commit date for ${owner}/${repo}@${sha}: HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.commit?.committer?.date ?? data.commit?.author?.date;
}

function printViolations(title, violations) {
    if (violations.length === 0) {
        return;
    }
    console.error(`\n${title}`);
    for (const violation of violations) {
        console.error(`- ${violation}`);
    }
}

async function main() {
    if (!Number.isInteger(MINIMUM_AGE_DAYS) || MINIMUM_AGE_DAYS < 0) {
        throw new Error('MINIMUM_DEPENDENCY_AGE_DAYS must be a non-negative integer.');
    }

    const workflowFiles = getWorkflowFiles();
    const npmrcValues = parseNpmrc();
    const dependabotViolations = getDependabotViolations(MINIMUM_AGE_DAYS);
    const workflowUses = [];
    const npmInstallViolations = [];
    const npmrcViolations = [];
    const exceptionViolations = [];

    if (npmrcValues['ignore-scripts'] !== 'true') {
        npmrcViolations.push('.npmrc must set ignore-scripts=true');
    }
    if (npmrcValues['min-release-age'] !== String(MINIMUM_AGE_DAYS)) {
        npmrcViolations.push(`.npmrc must set min-release-age=${MINIMUM_AGE_DAYS}`);
    }

    for (const workflowPath of workflowFiles) {
        const controls = parseWorkflowControls(workflowPath);
        workflowUses.push(...controls.uses);
        for (const violation of controls.npmInstallsWithoutIgnoreScripts) {
            npmInstallViolations.push(
                `${path.relative(REPO_ROOT, violation.workflowPath)}:${violation.line} run command uses npm install/ci without --ignore-scripts`
            );
        }
    }

    const mutableActionRefs = [];
    const immutableActionRefs = [];

    for (const usage of workflowUses) {
        const parsed = parseActionReference(usage.value);
        if (!parsed) {
            continue;
        }

        if (!isImmutableReference(parsed.ref)) {
            mutableActionRefs.push(
                `${path.relative(REPO_ROOT, usage.workflowPath)}:${usage.line} uses mutable ref "${usage.value}"`
            );
        } else {
            immutableActionRefs.push({
                owner: parsed.owner,
                repo: parsed.repo,
                sha: parsed.ref,
                source: `${path.relative(REPO_ROOT, usage.workflowPath)}:${usage.line}`
            });
        }
    }

    const youngPackageViolations = [];
    const npmMetadataCache = new Map();
    for (const dependency of getLockedDependencies()) {
        if (!npmMetadataCache.has(dependency.name)) {
            npmMetadataCache.set(dependency.name, await fetchNpmMetadata(dependency.name));
        }
        const metadata = npmMetadataCache.get(dependency.name);
        const publishedAt = metadata.time?.[dependency.version];
        if (!publishedAt) {
            throw new Error(`No published timestamp found for ${dependency.name}@${dependency.version}.`);
        }
        const ageDays = getAgeInDays(publishedAt);
        if (ageDays < MINIMUM_AGE_DAYS) {
            youngPackageViolations.push(`${dependency.name}@${dependency.version} is ${ageDays.toFixed(2)} days old`);
        }
    }

    const youngActionViolations = [];
    for (const actionRef of immutableActionRefs) {
        const commitDate = await fetchActionCommitDate(actionRef.owner, actionRef.repo, actionRef.sha);
        if (!commitDate) {
            throw new Error(`No commit timestamp found for ${actionRef.owner}/${actionRef.repo}@${actionRef.sha}.`);
        }
        const ageDays = getAgeInDays(commitDate);
        if (ageDays < MINIMUM_AGE_DAYS) {
            youngActionViolations.push(
                `${actionRef.source} ${actionRef.owner}/${actionRef.repo}@${actionRef.sha} is ${ageDays.toFixed(2)} days old`
            );
        }
    }

    const enforceAge = !ALLOW_YOUNG_DEPENDENCIES;
    if (ALLOW_YOUNG_DEPENDENCIES) {
        if (!EXCEPTION_JUSTIFICATION) {
            exceptionViolations.push('SUPPLY_CHAIN_ALLOW_YOUNG=true requires SUPPLY_CHAIN_EXCEPTION_JUSTIFICATION');
        }
        if (!EXCEPTION_PSIRT_TICKET) {
            exceptionViolations.push('SUPPLY_CHAIN_ALLOW_YOUNG=true requires SUPPLY_CHAIN_EXCEPTION_PSIRT_TICKET');
        }
    }

    const failures = [
        ...npmrcViolations,
        ...dependabotViolations,
        ...npmInstallViolations,
        ...mutableActionRefs,
        ...exceptionViolations,
        ...(enforceAge ? youngPackageViolations : []),
        ...(enforceAge ? youngActionViolations : [])
    ];

    printViolations('NPM baseline policy violations', npmrcViolations);
    printViolations('GitHub Actions cooldown policy violations', dependabotViolations);
    printViolations('SCVS-4.18 violations', npmInstallViolations);
    printViolations('SCAL-PKGDEP-2 violations', mutableActionRefs);
    printViolations('SCAL-PKGDEP-3 exception handling violations', exceptionViolations);
    if (enforceAge) {
        printViolations(`SCAL-PKGDEP-3 violations (< ${MINIMUM_AGE_DAYS} days)`, [
            ...youngPackageViolations,
            ...youngActionViolations
        ]);
    } else {
        console.log(`Age-policy override enabled (SUPPLY_CHAIN_ALLOW_YOUNG=true). Minimum age check skipped.`);
    }

    if (failures.length > 0) {
        throw new Error(`Supply-chain policy check failed with ${failures.length} violation(s).`);
    }

    console.log('Supply-chain policy check passed.');
}

main().catch((error) => {
    console.error(error.message);
    process.exit(1);
});
