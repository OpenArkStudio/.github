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
    path: '.github/workflows/ci.yml', head_commit: { message: 'Fix connection retry\n\nDetails' },
    ...overrides.run,
  };
  const jobs = overrides.jobs ?? [{ id: 101, name: 'Linux', conclusion: 'success',
    started_at: '2026-10-22T01:00:00Z', completed_at: '2026-10-22T01:02:05Z' }];
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
  const embed = sent[0].payload.embeds[0];
  assert.match(embed.title, /^✅ Succeeded/);
  assert.equal(embed.color, 0x2da44e);
  assert.equal(field(embed, 'Jobs'), '1 passed');
  assert.equal(field(embed, 'Duration'), '2m 5s');
  assert.match(field(embed, 'Commit'), /\[aaaaaaaaaaaa\]\(https:\/\/github.com\/OpenArkStudio\/arknet\/commit\/a{40}\)\nFix connection retry/);
  assert.match(field(embed, 'Run'), /actions\/runs\/42\/attempts\/2/);
  assert.ok(!embed.fields.some(item => item.name.includes('Failed')));
  assert.deepEqual(outputs, { message_id: '456', channel_id: '789' });
  assert.ok(logs.every(line => !line.includes('test-secret')));
});

test('summarizes matrix failures, timeouts, cancellations and skips', async () => {
  const { args, sent } = setup({ run: { conclusion: 'failure' }, jobs: [
    { id: 100, name: 'Linux', conclusion: 'cancelled' },
    { id: 101, name: 'Windows', conclusion: 'failure', steps: [
      { name: 'Checkout', conclusion: 'success' }, { name: 'Build', conclusion: 'failure' },
    ] },
    { id: 102, name: 'macOS', conclusion: 'timed_out' }, { name: 'Deploy', conclusion: 'skipped' },
  ] });
  await notify(args);
  const embed = sent[0].payload.embeds[0];
  assert.equal(embed.title, '❌ Failed · CI');
  assert.equal(embed.color, 0xcf222e);
  assert.equal(field(embed, 'Jobs'), '2 failed · 1 cancelled · 1 skipped');
  assert.match(embed.fields[0].value, /^\[Windows\]\(https:\/\/github.com\/OpenArkStudio\/arknet\/actions\/runs\/42\/job\/101\) — Failed\n  ↳ Build/);
  assert.match(embed.fields[0].value, /macOS.*Timed out/);
  assert.ok(embed.fields[0].value.indexOf('macOS') < embed.fields[0].value.indexOf('Linux'));
  assert.ok(!embed.fields[0].value.includes('Checkout'));
  assert.match(embed.fields[0].value, /Failed step unavailable/);
});

function field(embed, name) {
  return embed.fields.find(item => item.name === name)?.value;
}

function assertLimits(embed) {
  assert.ok(embed.title.length <= 256);
  assert.ok(embed.description.length <= 4096);
  assert.ok(embed.footer.text.length <= 2048);
  assert.ok(embed.fields.length <= 25);
  for (const item of embed.fields) {
    assert.ok(item.name.length > 0 && item.name.length <= 256);
    assert.ok(item.value.length > 0 && item.value.length <= 1024);
  }
  const size = embed.title.length + embed.description.length + embed.footer.text.length +
    embed.fields.reduce((sum, item) => sum + item.name.length + item.value.length, 0);
  assert.ok(size <= 6000, `Embed total: ${size}`);
}

test('bounds escaped Unicode metadata and large failures without silently losing jobs or steps', async () => {
  const noisy = '[🐧**@everyone](https://example.com)\\'.repeat(200);
  const { args, sent } = setup({ run: {
    name: noisy, display_title: noisy, head_branch: noisy, event: noisy,
    head_commit: { message: noisy }, pull_requests: [{ number: 17 }, { number: 18 }],
  }, jobs: Array.from({ length: 500 }, (_, id) => ({ id: id + 100, name: noisy, conclusion: 'failure',
    steps: Array.from({ length: 5 }, () => ({ name: noisy, conclusion: 'failure' })),
  })) });
  await notify(args);
  const embed = sent[0].payload.embeds[0];
  assertLimits(embed);
  const problemText = embed.fields.filter(item => item.name.includes('jobs') || item.name === 'Problems (continued)').map(item => item.value).join('\n');
  assert.match(problemText, /\(\+3 more failed steps\)/);
  const shown = (problemText.match(/ — Failed/g) || []).length;
  assert.match(problemText, new RegExp(`… ${500 - shown} more jobs; see the run for all results\\.`));
  for (const value of [embed.title, embed.description, embed.footer.text, ...embed.fields.map(item => item.value)]) {
    assert.ok(value.isWellFormed());
  }
});

test('keeps worst-case target lengths and metadata within every Discord budget', async () => {
  const noisy = '*'.repeat(5000);
  const { args, sent } = setup({ run: { name: noisy, display_title: noisy, head_branch: noisy,
    head_sha: 'f'.repeat(64), event: noisy, head_commit: { message: noisy },
    run_attempt: 9007199254740991, run_number: 9007199254740991,
    pull_requests: [{ number: 9007199254740991 }, { number: 18 }],
  }, jobs: Array.from({ length: 20 }, () => ({ id: 9007199254740991, name: noisy, conclusion: 'failure',
    steps: Array.from({ length: 3 }, () => ({ name: noisy, conclusion: 'failure' })),
  })) });
  args.context.serverUrl = 'https://' + 'a'.repeat(46);
  args.context.repo = { owner: 'o'.repeat(100), repo: 'r'.repeat(100) };
  args.runId = '9007199254740991';
  await notify(args);
  const embed = sent[0].payload.embeds[0];
  assertLimits(embed);
  assert.match(field(embed, 'Commit'), /commit\/f{64}\)/);
  assert.match(embed.fields[0].value, /job\/9007199254740991\)/);
});

test('shows PR, branch, repository, workflow and exact-attempt links', async () => {
  const { args, sent } = setup({ run: { pull_requests: [{ number: 17 }, { number: 18 }], head_branch: 'fix/retry', event: 'pull_request' } });
  args.context.serverUrl = 'https://github.enterprise.example';
  await notify(args);
  const embed = sent[0].payload.embeds[0];
  assert.match(field(embed, 'Repository'), /https:\/\/github.enterprise.example\/OpenArkStudio\/arknet/);
  assert.match(field(embed, 'Workflow'), /actions\/runs\/42\/attempts\/2/);
  assert.equal(field(embed, 'Pull request / branch'), '[PR #17](https://github.enterprise.example/OpenArkStudio/arknet/pull/17) (+1 more PRs)\nfix/retry');
  assert.match(embed.url, /attempts\/2$/);
  assert.equal(embed.footer.text, 'GitHub Actions · Pull request');
});

test('escapes metadata Markdown, mentions, autolinks and injected URL boundaries', async () => {
  const malicious = 'x](https://evil.example/) @everyone <@123> <#456> **bold** `code`\nnew';
  const { args, sent } = setup({ run: { name: malicious, head_branch: malicious, display_title: malicious,
    html_url: 'javascript:alert(1)', head_commit: { message: malicious },
    pull_requests: [{ number: '17)https://evil.example' }],
  }, jobs: [{ id: '101)https://evil.example', html_url: 'https://evil.example', name: malicious, conclusion: 'failure', steps: [{ name: malicious, conclusion: 'failure' }] }] });
  await notify(args);
  const embed = sent[0].payload.embeds[0];
  const rendered = JSON.stringify(embed);
  assert.ok(!rendered.includes('@everyone'));
  assert.ok(!rendered.includes('<@123>'));
  assert.ok(!rendered.includes('<#456>'));
  assert.ok(!rendered.includes('](https://evil.example'));
  assert.ok(!rendered.includes('**bold**'));
  assert.ok(!rendered.includes('javascript:'));
  assert.equal(field(embed, 'Pull request / branch'), undefined);
  assert.match(embed.title, /@\u200beveryone/);
  assert.match(embed.fields[0].value, /\\\]\\\(/);
  assertLimits(embed);
});

test('rejects unsafe server targets and never clips a generated URL', async () => {
  for (const serverUrl of ['javascript:alert(1)', 'https://user:secret@github.com', 'https://' + 'a'.repeat(260) + '.example', 'https://' + '('.repeat(70) + ')'.repeat(70) + '.example']) {
    const { args, sent } = setup({ run: { head_sha: '[bad](https://evil.example)' } });
    args.context.serverUrl = serverUrl;
    await notify(args);
    const embed = sent[0].payload.embeds[0];
    assert.equal(embed.url, undefined);
    assert.equal(field(embed, 'Commit'), 'Unavailable\nFix connection retry');
    assert.ok(!JSON.stringify(embed).includes('secret'));
    assertLimits(embed);
  }
});

test('encodes parentheses in trusted server origins without breaking Markdown targets', async () => {
  const { args, sent } = setup();
  args.context.serverUrl = 'https://git(hub).example';
  await notify(args);
  const embed = sent[0].payload.embeds[0];
  assert.equal(field(embed, 'Repository'), '[OpenArkStudio/arknet](https://git%28hub%29.example/OpenArkStudio/arknet)');
  assertLimits(embed);
});

test('caps numeric link IDs even when leading zeros would parse as a small number', async () => {
  const oversizedId = '0'.repeat(10000) + '1';
  const { args, sent } = setup({ run: { run_attempt: oversizedId, pull_requests: [{ number: oversizedId }] },
    jobs: [{ id: oversizedId, name: 'Build', conclusion: 'failure' }],
  });
  await notify(args);
  const embed = sent[0].payload.embeds[0];
  assertLimits(embed);
  assert.ok(!JSON.stringify(embed).includes(oversizedId));
  assert.equal(embed.url, 'https://github.com/OpenArkStudio/arknet/actions/runs/42');
});

test('uses current-attempt job wall time rather than stale run metadata or summed matrix time', async () => {
  const { args, sent } = setup({ run: { created_at: '2020-01-01T00:00:00Z', updated_at: '2026-11-01T00:00:00Z' }, jobs: [
    { name: 'Linux', conclusion: 'success', started_at: '2026-10-22T01:00:00Z', completed_at: '2026-10-22T02:02:05Z' },
    { name: 'Windows', conclusion: 'success', started_at: '2026-10-22T01:01:00Z', completed_at: '2026-10-22T02:00:00Z' },
    { name: 'Deploy', conclusion: 'skipped' },
  ] });
  await notify(args);
  assert.equal(field(sent[0].payload.embeds[0], 'Duration'), '1h 2m 5s');
});

test('does not fabricate durations from absent, partial or inverted timestamps', async () => {
  for (const jobs of [[], [{ conclusion: 'skipped' }], [{ conclusion: 'success' }],
    [{ conclusion: 'failure', started_at: '2026-10-22T02:00:00Z', completed_at: '2026-10-22T01:00:00Z' }],
    [{ conclusion: 'success', started_at: '2026-10-22T01:00:00Z', completed_at: '2026-10-22T01:00:30Z' }, { conclusion: 'cancelled' }],
  ]) {
    const { args, sent } = setup({ jobs });
    await notify(args);
    assert.equal(field(sent[0].payload.embeds[0], 'Duration'), 'Unavailable');
  }
});

test('distinguishes cancellation, special failure conclusions and missing job data', async () => {
  for (const conclusion of ['cancelled', 'timed_out', 'action_required', 'startup_failure', 'neutral', 'unknown']) {
    const { args, sent } = setup({ run: { conclusion, head_branch: null, head_commit: null }, jobs: [] });
    await notify(args);
    const embed = sent[0].payload.embeds[0];
    assert.equal(field(embed, 'Jobs'), 'No jobs reported');
    assert.equal(field(embed, 'Branch'), '\\(detached\\)');
    assert.ok(!field(embed, 'Commit').includes('undefined'));
    if (conclusion === 'cancelled') {
      assert.match(embed.title, /^⏹ Cancelled/);
      assert.equal(embed.color, 0xbf8700);
    } else if (['timed_out', 'action_required', 'startup_failure'].includes(conclusion)) {
      assert.match(embed.title, /^❌/);
      assert.equal(embed.color, 0xcf222e);
    } else assert.equal(embed.color, 0x6e7781);
    assertLimits(embed);
  }
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
    { runId: '1; command' }, { runId: '9007199254740992' }, { runId: '0'.repeat(10000) + '1' },
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

test('uses friendly event labels without repeating the commit subject', async () => {
  const subject = 'Improve connection retry handling';
  const { args, sent } = setup({ run: {
    name: 'Build & Test', display_title: subject,
    head_commit: { message: subject + '\n\nDetails' }, event: 'merge_group',
  } });
  await notify(args);
  const embed = sent[0].payload.embeds[0];
  assert.equal(embed.title, '✅ Succeeded · Build & Test');
  assert.equal(embed.description, subject);
  assert.ok(!field(embed, 'Commit').includes(subject));
  assert.equal(embed.footer.text, 'GitHub Actions · Merge queue');
  assert.equal(field(embed, 'Duration'), '2m 5s');
  assertLimits(embed);
});
