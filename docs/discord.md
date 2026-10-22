# Discord Actions notifications

[English](discord.md) | [中文](discord_CN.md)

Only ARK and arknet have `.github/workflows/notify-discord.yml`, which calls the shared
`discord-summary.yml` workflow in this repository. It reads only the completed
workflow's metadata and job results. It does not execute the triggering commit or
download its artifacts. A matrix produces one summary per workflow attempt.

## Summary cards

Each attempt produces one Discord Embed. Its title and color identify the outcome:
✅ green for success, ❌ red for failure (including timeouts, action-required and
startup failures), and ⏹ amber for cancellation. Other conclusions use a neutral
color and their result label.

The card shows the repository and workflow, PR number when GitHub supplies one,
branch, linked short SHA and commit subject when available, job counts, and links
to the exact run attempt. If multiple PRs are attached, the first is linked and
the remaining count is shown. Successful runs omit zero counts and problem fields.
A missing branch is marked detached; missing job data or commit metadata is not
invented.

Failed jobs appear first, before cancelled jobs and general metadata. Each job
links to its own GitHub job page and shows up to two failed step names. If GitHub
provides no failed step, the card says so. Extra failed steps have a remaining
count. Large problem lists occupy at most two fields and explicitly report how
many jobs were omitted; the run link leads to all results.

**Duration** runs from the earliest executed job start to the latest job
completion in the notified attempt. It includes gaps between those jobs, excludes
the initial queue, and does not add parallel matrix durations. It does not use
run creation or update timestamps, which can mislead on reruns and manual
resends. If any executed job has missing or invalid timestamps, or all jobs are
skipped, it displays `Unavailable`.

Source titles, branch names, job names and step names are treated as text:
Markdown is escaped and mentions and automatic URL formatting are neutralized.
Only links built from the repository, validated IDs and SHA are emitted. Mentions
are also disabled with `allowed_mentions`. Text truncation preserves complete
escapes and Unicode characters; whole links are kept intact. Field budgets stay
within Discord's title, field, field-count and 6,000-character aggregate
[Embed limits](https://docs.discord.com/developers/resources/message#embed-limits).
These are standard Webhook Embeds with Markdown links; they do not require buttons.

Discord must return a message receipt for the notification job to pass. Explicit
rate limits are retried twice; other delivery errors fail the notification job.
The card formatting does not change the shared workflow, Secrets, permissions,
resend behavior, or delivery/receipt rules.

## Webhook configuration

The organization Actions secret `DISCORD_WEBHOOK_URL` has visibility set to all
repositories. A Secret alone does not enable notifications; the caller workflow
must also exist. To move notifications to another Discord channel, replace the
organization secret. Repository or environment secrets with the same name
override the organization secret. Store the incoming Webhook URL without a
`/github` suffix. Never commit it.

## Workflow selection

The completion trigger names the source workflows explicitly. Add new workflow names to the
`workflow_run.workflows` list when creating or renaming them. Keep
`Discord Notifications` out of that list to prevent notification recursion.
Adding this file does not enable existing disabled workflows or add build tests.

Other OpenArkStudio repositories do not install a caller. Enabling notifications
for another repository requires an explicit decision and a pull request adding
the caller. Keep changes to ARK and arknet's callers in their own pull requests.

## Resend a completed result

Use **Actions → Discord Notifications → Run workflow** and enter a completed
workflow run ID from that repository. This sends the recorded result without
running the build again. Rerunning a source workflow sends its new attempt's
result; explicitly resending a result can produce another message.
