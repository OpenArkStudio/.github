const { setTimeout: delay } = require('node:timers/promises');

const failed = new Set(['failure', 'timed_out', 'action_required', 'startup_failure']);
const labels = {
  success: 'Succeeded', failure: 'Failed', cancelled: 'Cancelled',
  timed_out: 'Timed out', action_required: 'Action required',
  neutral: 'Neutral', skipped: 'Skipped', stale: 'Stale',
  startup_failure: 'Startup failure',
};

function clip(value, limit) {
  const text = String(value ?? '');
  return text.length <= limit ? text : text.slice(0, limit - 3) + '...';
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
  if (!/^\d+$/.test(runId) || !Number.isSafeInteger(Number(runId)) || Number(runId) < 1) {
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

  const counts = { passed: 0, failed: 0, cancelled: 0, skipped: 0, other: 0 };
  for (const job of jobs) {
    if (job.conclusion === 'success') counts.passed++;
    else if (failed.has(job.conclusion)) counts.failed++;
    else if (job.conclusion === 'cancelled') counts.cancelled++;
    else if (job.conclusion === 'skipped') counts.skipped++;
    else counts.other++;
  }
  const summary = Object.entries(counts).map(([label, count]) => `${count} ${label}`).join(', ');
  const problemJobs = jobs.filter(job => failed.has(job.conclusion) || job.conclusion === 'cancelled');
  const fields = [
    { name: 'Repository', value: clip(`${repo.owner}/${repo.repo}`, 256), inline: true },
    { name: 'Branch', value: clip(run.head_branch || '(detached)', 256), inline: true },
    { name: 'Commit', value: clip(run.head_sha, 12), inline: true },
    { name: 'Jobs', value: summary },
  ];
  if (problemJobs.length) {
    fields.push({ name: 'Failed or cancelled jobs', value: clip(problemJobs.map(job => `${job.name}: ${job.conclusion}`).join('\n'), 1024) });
  }
  const payload = {
    allowed_mentions: { parse: [] },
    embeds: [{
      title: clip(`${run.name}: ${labels[run.conclusion] ?? run.conclusion}`, 256),
      description: clip(run.display_title || run.name, 512),
      url: run.html_url,
      color: run.conclusion === 'success' ? 0x2da44e : failed.has(run.conclusion) ? 0xcf222e : 0x6e7781,
      fields,
      footer: { text: clip(`Run #${run.run_number}, attempt ${run.run_attempt} | ${run.event}`, 256) },
    }],
  };

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
