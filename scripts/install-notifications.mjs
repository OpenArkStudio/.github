import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const organization = 'OpenArkStudio';
const path = '.github/workflows/notify-discord.yml';
const content = readFileSync(new URL('../.github/workflows/notify-discord.yml', import.meta.url), 'utf8');

function api(endpoint, body) {
  const args = ['api', endpoint];
  if (body) args.push('--method', 'PUT', '--input', '-');
  const result = spawnSync('gh', args, {
    encoding: 'utf8', input: body ? JSON.stringify(body) : undefined,
  });
  if (result.status !== 0) {
    if (!body && result.stderr.includes('(HTTP 404)')) return null;
    throw new Error(`GitHub request failed for ${endpoint}`);
  }
  return JSON.parse(result.stdout);
}

let failures = 0;
for (let page = 1; ; page++) {
  const repos = api(`orgs/${organization}/repos?per_page=100&page=${page}`);
  if (!Array.isArray(repos)) throw new Error('Could not read organization repositories');
  for (const repo of repos) {
    if (repo.archived) {
      console.log(`${repo.full_name}: archived, skipped`);
      continue;
    }
    try {
      const endpoint = `repos/${repo.full_name}/contents/${path}`;
      const existing = api(`${endpoint}?ref=${encodeURIComponent(repo.default_branch)}`);
      if (existing && Buffer.from(existing.content, 'base64').toString('utf8') === content) {
        console.log(`${repo.full_name}: already configured`);
        continue;
      }
      const result = api(endpoint, {
        message: 'ci: notify Discord when workflows complete',
        branch: repo.default_branch,
        content: Buffer.from(content).toString('base64'),
        ...(existing ? { sha: existing.sha } : {}),
      });
      const installed = api(`${endpoint}?ref=${encodeURIComponent(repo.default_branch)}`);
      if (Buffer.from(installed.content, 'base64').toString('utf8') !== content) {
        throw new Error(`Notification file verification failed for ${repo.full_name}`);
      }
      console.log(`${repo.full_name}: configured, commit ${result.commit.sha}`);
    } catch (error) {
      failures++;
      console.error(error.message);
    }
  }
  if (repos.length < 100) break;
}
if (failures) process.exitCode = 1;
