const assert = require('node:assert/strict');
const { test } = require('node:test');
const notify = require('../scripts/discord.cjs');

const webhook = 'https://discord.com/api/webhooks/123/test-secret';
function setup(overrides = {}) {
  const sent = [], outputs = {}, logs = [], requests = [];
  const run = {
    id: 42, run_number: 9, run_attempt: 2, status: 'completed', conclusion: 'success',
    name: 'CI', display_title: 'Fix @everyone', head_branch: 'main', head_sha: 'a'.repeat(40),
    html_url: 'https://github.com/OpenArkStudio/arknet/actions/runs/42', event: 'push',
    path: '.github/workflows/ci.yml',
    ...overrides.run,
  };
  const jobs = overrides.jobs ?? [{ name: 'Linux', conclusion: 'success' }];
  const args = {
    webhook, runId: '42', context: { repo: { owner: 'OpenArkStudio', repo: 'arknet' } },
    core: { info: message => logs.push(message), setOutput: (key, value) => { outputs[key] = value; } },
    github: {
      rest: { actions: { getWorkflowRun: async options => { requests.push(options); return { data: run }; }, listJobsForWorkflowRunAttempt: Symbol() } },
      paginate: async (_method, options) => { requests.push(options); return jobs; },
    },
    fetch: async (url, options) => {
      sent.push({ url, options, payload: JSON.parse(options.body) });
      return { ok: true, status: 200, json: async () => ({ id: '456', channel_id: '789' }) };
    },
  };
  return { args, sent, outputs, logs, requests };
}

test('reports the completed attempt, suppresses mentions and records delivery', async () => {
  const { args, sent, outputs, logs, requests } = setup();
  await notify(args);
  assert.equal(requests[1].attempt_number, 2);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].url.searchParams.get('wait'), 'true');
  assert.equal(sent[0].options.redirect, 'error');
  assert.deepEqual(sent[0].payload.allowed_mentions, { parse: [] });
  assert.match(sent[0].payload.embeds[0].fields[3].value, /1 passed, 0 failed/);
  assert.deepEqual(outputs, { message_id: '456', channel_id: '789' });
  assert.ok(logs.every(line => !line.includes('test-secret')));
});

test('summarizes matrix failures, timeouts, cancellations and skips', async () => {
  const { args, sent } = setup({ run: { conclusion: 'failure' }, jobs: [
    { name: 'Windows', conclusion: 'failure' }, { name: 'macOS', conclusion: 'timed_out' },
    { name: 'Linux', conclusion: 'cancelled' }, { name: 'Deploy', conclusion: 'skipped' },
  ] });
  await notify(args);
  const embed = sent[0].payload.embeds[0];
  assert.equal(embed.title, 'CI: Failed');
  assert.match(embed.fields[3].value, /2 failed, 1 cancelled, 1 skipped/);
  assert.match(embed.fields[4].value, /Windows: failure/);
  assert.match(embed.fields[4].value, /macOS: timed_out/);
});

test('bounds large workflow titles and job lists to Discord limits', async () => {
  const { args, sent } = setup({ run: { name: 'n'.repeat(1000), display_title: 'd'.repeat(2000) },
    jobs: Array.from({ length: 500 }, () => ({ name: 'j'.repeat(200), conclusion: 'failure' })) });
  await notify(args);
  const embed = sent[0].payload.embeds[0];
  assert.ok(embed.title.length <= 256);
  assert.ok(embed.description.length <= 512);
  assert.ok(embed.fields.every(field => field.value.length <= 1024));
});

test('rejects unfinished runs and notification recursion', async () => {
  for (const run of [{ status: 'in_progress' }, { path: '.github/workflows/notify-discord.yml' }]) {
    const { args, sent } = setup({ run });
    await assert.rejects(notify(args), /completed source workflow/);
    assert.equal(sent.length, 0);
  }
});

test('rejects missing secrets, non-Discord URLs and invalid run IDs without exposing credentials', async () => {
  for (const input of [
    { webhook: '' }, { webhook: 'https://example.com/test-secret' },
    { webhook: 'https://discord.com/api/webhooks/123/test-secret/github' },
    { runId: '1; command' }, { runId: '9007199254740992' },
  ]) {
    const { args, sent } = setup();
    await assert.rejects(notify({ ...args, ...input }), error => !error.message.includes('test-secret'));
    assert.equal(sent.length, 0);
  }
});

test('redacts network errors and avoids ambiguous delivery retries', async () => {
  const { args } = setup();
  let attempts = 0;
  args.fetch = async () => { attempts++; throw new Error(webhook); };
  await assert.rejects(notify(args), /^Error: Discord delivery failed or timed out\.$/);
  assert.equal(attempts, 1);
});

test('retries an explicit bounded rate limit', async () => {
  const { args, outputs } = setup();
  let attempts = 0;
  const waits = [];
  args.sleep = async duration => { waits.push(duration); };
  args.fetch = async () => ++attempts === 1
    ? { status: 429, ok: false, json: async () => ({ retry_after: 0.25 }) }
    : { status: 200, ok: true, json: async () => ({ id: '456', channel_id: '789' }) };
  await notify(args);
  assert.equal(attempts, 2);
  assert.deepEqual(waits, [250]);
  assert.equal(outputs.message_id, '456');
});

test('does not claim delivery without a message receipt or after HTTP rejection', async () => {
  for (const response of [
    { status: 204, ok: true, json: async () => { throw new Error('empty'); } },
    { status: 200, ok: true, json: async () => ({}) },
    { status: 401, ok: false },
    { status: 429, ok: false, json: async () => ({ retry_after: 120 }) },
  ]) {
    const { args, outputs } = setup();
    args.fetch = async () => response;
    await assert.rejects(notify(args), /Discord/);
    assert.deepEqual(outputs, {});
  }
});
