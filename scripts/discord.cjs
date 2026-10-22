const { setTimeout: delay } = require('node:timers/promises');

const failed = new Set(['failure', 'timed_out', 'action_required', 'startup_failure']);
const labels = {
  success: 'Succeeded', failure: 'Failed', cancelled: 'Cancelled',
  timed_out: 'Timed out', action_required: 'Action required',
  neutral: 'Neutral', skipped: 'Skipped', stale: 'Stale',
  startup_failure: 'Startup failure',
};
const outcomes = {
  success: 'passed', failure: 'failed', cancelled: 'cancelled', timed_out: 'timed out',
  action_required: 'needs attention', startup_failure: 'could not start',
  neutral: 'finished', skipped: 'skipped', stale: 'expired',
};
const events = {
  pull_request: 'Pull request', push: 'Push', merge_group: 'Merge queue',
  workflow_dispatch: 'Manual run', schedule: 'Scheduled run', workflow_run: 'Workflow completion',
};

// Escape before truncating, keeping escapes and surrogate pairs intact. Source metadata
// must remain text: it cannot add Markdown links, mentions or URL previews.
function text(value, limit, markdown = true) {
  const tokens = Array.from(String(value ?? '').replace(/[\s\u0000-\u001f\u007f]+/g, ' ').trim(), char => {
    if (char === '@') return '@\u200b';
    if (char === '<') return '‹';
    if (char === '>') return '›';
    if (char === ':' || char === '.') return char + '\u200b';
    return markdown && /[\\`*_{}[\]()#+!|~\-]/.test(char) ? '\\' + char : char;
  });
  const result = tokens.join('');
  if (result.length <= limit) return result;
  let shortened = '';
  for (const token of tokens) {
    if (shortened.length + token.length > limit - 1) break;
    shortened += token;
  }
  return shortened + '…';
}

function positiveId(value) {
  return /^\d{1,16}$/.test(String(value)) && Number.isSafeInteger(Number(value)) && Number(value) > 0;
}

function repositoryUrl(context) {
  try {
    const server = new URL(context.serverUrl || 'https://github.com');
    const { owner, repo } = context.repo;
    if (server.protocol !== 'https:' || server.username || server.password ||
        ![owner, repo].every(part => /^[a-zA-Z0-9_.-]{1,100}$/.test(part))) return '';
    const url = `${server.origin}/${owner}/${repo}`.replace(/[()]/g, char => char === '(' ? '%28' : '%29');
    // Bound encoded targets too; never truncate a Markdown link inside its URL.
    return url.length <= 256 ? url : '';
  } catch {
    return '';
  }
}

function link(label, url) {
  return url ? `[${label}](${url})` : label;
}

function duration(jobs) {
  // Current-attempt job timestamps avoid original-run creation times on reruns,
  // summed matrix durations, and updated_at (which is not a completion time).
  const executed = jobs.filter(job => job.conclusion !== 'skipped');
  if (!executed.length) return 'Unavailable';
  let first = Infinity, last = -Infinity;
  for (const job of executed) {
    const start = Date.parse(job.started_at), end = Date.parse(job.completed_at);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 'Unavailable';
    first = Math.min(first, start);
    last = Math.max(last, end);
  }
  const seconds = Math.floor((last - first) / 1000);
  const hours = Math.floor(seconds / 3600), minutes = Math.floor(seconds % 3600 / 60);
  return `${hours ? `${hours}h ` : ''}${hours || minutes ? `${minutes}m ` : ''}${seconds % 60}s`;
}

function problemFields(jobs, runUrl) {
  const problems = [
    ...jobs.filter(job => failed.has(job.conclusion)),
    ...jobs.filter(job => job.conclusion === 'cancelled'),
  ];
  const fields = [];
  let index = 0;
  while (index < problems.length && fields.length < 2) {
    const rows = [];
    // Reserve space for a visible omission count in the final field.
    const budget = fields.length === 1 ? 940 : 1024;
    while (index < problems.length) {
      const job = problems[index];
      const jobUrl = positiveId(job.id) && runUrl ? `${runUrl}/job/${job.id}` : '';
      const steps = (job.steps || []).filter(step => failed.has(step.conclusion));
      const details = steps.slice(0, 2).map(step => `**${text(step.name || '(unnamed step)', 80)}**`).join('; ');
      const stepSummary = steps.length
        ? `\n  ↳ ${details}${steps.length > 2 ? ` (+${steps.length - 2} more failed steps)` : ''}`
        : failed.has(job.conclusion) ? '\n  ↳ Step details unavailable' : '';
      const row = `${link(text(job.name || '(unnamed job)', 100), jobUrl)} — ${labels[job.conclusion]}${stepSummary}`;
      if (rows.join('\n').length + (rows.length ? 1 : 0) + row.length > budget) break;
      rows.push(row);
      index++;
    }
    fields.push({ name: fields.length ? 'More jobs' : jobs.some(job => failed.has(job.conclusion)) ? 'Needs attention' : 'Cancelled jobs', value: rows.join('\n') });
  }
  if (index < problems.length) {
    fields[fields.length - 1].value += `\n… ${problems.length - index} more jobs; see the run for all results.`;
  }
  return fields;
}

function buildPayload(context, run, jobs, runId) {
  const repoUrl = repositoryUrl(context);
  const runUrl = repoUrl ? `${repoUrl}/actions/runs/${runId}` : '';
  const attemptUrl = runUrl && positiveId(run.run_attempt) ? `${runUrl}/attempts/${run.run_attempt}` : runUrl;
  const outcome = outcomes[run.conclusion] || 'completed';
  const icon = run.conclusion === 'success' ? '✅' : failed.has(run.conclusion) ? '❌' : run.conclusion === 'cancelled' ? '⏹' : 'ℹ️';
  const counts = { passed: 0, failed: 0, cancelled: 0, skipped: 0, other: 0 };
  for (const job of jobs) {
    if (job.conclusion === 'success') counts.passed++;
    else if (failed.has(job.conclusion)) counts.failed++;
    else if (job.conclusion === 'cancelled') counts.cancelled++;
    else if (job.conclusion === 'skipped') counts.skipped++;
    else counts.other++;
  }
  const summary = ['failed', 'cancelled', 'passed', 'skipped', 'other'].filter(label => counts[label]).map(label => {
    const value = `${counts[label]} ${label}`;
    return label === 'failed' ? `**${value}**` : value;
  }).join(' · ') || 'No jobs reported';
  const pulls = (run.pull_requests || []).filter(pr => positiveId(pr.number));
  const pull = pulls[0];
  const ref = text(run.head_branch || '(detached)', 100);
  const pullSummary = pull ? `${link(`PR #${pull.number}`, repoUrl ? `${repoUrl}/pull/${pull.number}` : '')}${pulls.length > 1 ? ` (+${pulls.length - 1} more)` : ''}\n` : '';
  const sha = typeof run.head_sha === 'string' && /^[a-fA-F0-9]{7,64}$/.test(run.head_sha) ? run.head_sha : '';
  const displayTitle = run.display_title || run.name || 'Workflow completed';
  const subject = (run.head_commit?.message || '').split(/\r?\n/)[0];
  const commitTitle = subject === displayTitle ? '' : text(subject, 160);
  const fields = [
    ...problemFields(jobs, runUrl),
    { name: pull ? 'Pull request' : 'Branch', value: pullSummary + ref, inline: true },
    { name: 'Commit', value: `${link(sha ? sha.slice(0, 12) : 'Unavailable', sha && repoUrl ? `${repoUrl}/commit/${sha}` : '')}${commitTitle ? `\n${commitTitle}` : ''}`, inline: true },
    { name: 'Duration', value: duration(jobs), inline: true },
  ];
  const runLink = link('View run', attemptUrl);
  const ownerUrl = repoUrl ? repoUrl.slice(0, repoUrl.lastIndexOf('/')) : '';
  // Fixed field budgets keep this single embed below Discord's 6,000-character
  // aggregate limit, including worst-case escaped text and two problem fields.
  return {
    allowed_mentions: { parse: [] },
    embeds: [{
      author: {
        name: text(`${context.repo.owner} / ${context.repo.repo}`, 128, false),
        ...(repoUrl ? { url: repoUrl, icon_url: `${ownerUrl}.png?size=64` } : {}),
      },
      title: `${icon} ${text(run.name || '(unnamed workflow)', 180)} ${outcome}`,
      description: `${text(displayTitle, 240)}\n${summary} · ${runLink}`,
      ...(attemptUrl ? { url: attemptUrl } : {}),
      color: run.conclusion === 'success' ? 0x2da44e : failed.has(run.conclusion) ? 0xcf222e : run.conclusion === 'cancelled' ? 0xbf8700 : 0x6e7781,
      fields,
      footer: { text: `${text(events[run.event] || run.event || 'Unknown event', 60, false)} · Run #${positiveId(run.run_number) ? run.run_number : '?'}${positiveId(run.run_attempt) && Number(run.run_attempt) > 1 ? ` · Attempt ${run.run_attempt}` : ''}` },
    }],
  };
}

module.exports = async function notify({
  github, context, core, runId, webhook,
  fetch = globalThis.fetch, sleep = delay,
}) {
  if (!webhook) throw new Error('DISCORD_WEBHOOK_URL is not configured.');
  let endpoint;
  try {
    endpoint = new URL(webhook);
    if (endpoint.protocol !== 'https:' ||
        !['discord.com', 'discordapp.com'].includes(endpoint.hostname) ||
        !/^\/api\/(?:v\d+\/)?webhooks\/\d+\/[^/]+\/?$/.test(endpoint.pathname) ||
        endpoint.username || endpoint.password || endpoint.port) {
      throw new Error();
    }
    endpoint.searchParams.set('wait', 'true');
  } catch {
    throw new Error('DISCORD_WEBHOOK_URL is not a valid Discord incoming Webhook.');
  }
  if (!positiveId(runId)) {
    throw new Error('A valid workflow run ID is required.');
  }

  const repo = context.repo;
  let run, jobs;
  try {
    ({ data: run } = await github.rest.actions.getWorkflowRun({ ...repo, run_id: Number(runId) }));
    if (run.status !== 'completed') throw new Error('Workflow is not complete');
    if (run.path === '.github/workflows/notify-discord.yml') throw new Error('Cannot notify about the notifier');
    jobs = await github.paginate(github.rest.actions.listJobsForWorkflowRunAttempt, {
      ...repo, run_id: run.id, attempt_number: run.run_attempt, per_page: 100,
    });
  } catch {
    throw new Error('Could not read a completed source workflow and its jobs.');
  }

  const payload = buildPayload(context, run, jobs, runId);

  // Retry only explicit rate limits; ambiguous delivery errors could duplicate a message.
  for (let attempt = 0; attempt < 3; attempt++) {
    let response;
    try {
      response = await fetch(endpoint, {
        method: 'POST', redirect: 'error',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload), signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new Error('Discord delivery failed or timed out.');
    }
    if (response.status === 429 && attempt < 2) {
      let retry;
      try { retry = await response.json(); } catch { retry = {}; }
      const seconds = Number(retry.retry_after);
      if (!Number.isFinite(seconds) || seconds < 0 || seconds > 30) {
        throw new Error('Discord rate limit requires a later retry.');
      }
      await sleep(Math.max(100, Math.ceil(seconds * 1000)));
      continue;
    }
    if (!response.ok) throw new Error(`Discord returned HTTP ${response.status}.`);
    let message;
    try { message = await response.json(); } catch { throw new Error('Discord returned no message receipt.'); }
    if (!message.id || !message.channel_id) throw new Error('Discord returned no message receipt.');
    core.info(`Discord summary delivered for ${repo.owner}/${repo.repo} run ${run.id}, attempt ${run.run_attempt} (message ${message.id}).`);
    core.setOutput('message_id', message.id);
    core.setOutput('channel_id', message.channel_id);
    return;
  }
};
