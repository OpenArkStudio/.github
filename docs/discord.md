# Discord Actions notifications

[English](discord.md) | [中文](discord_CN.md)

Only ARK and arknet have `.github/workflows/notify-discord.yml`, which calls the shared
`discord-summary.yml` workflow in this repository. It reads only the completed
workflow's metadata and job results. It does not execute the triggering commit or
download its artifacts. A matrix produces one summary per workflow attempt.

## Summary cards

Each attempt produces one compact Discord Embed:

- The author row identifies the repository and shows its owner's avatar.
- One linked title names the workflow and its result: ✅ passed, ❌ failed, or
  ⏹ cancelled. Timeouts and startup failures keep their specific result labels.
- The description shows the change title, nonzero job counts, and **View run**.
- Failed jobs and their bold failed steps appear before the context row.
  Cancelled jobs follow failures. Up to two failed steps are shown per job.
- Three inline fields show the PR or branch, short linked SHA, and **Duration**.
  A different commit subject appears under the SHA; a repeated subject is omitted.
- The footer contains the friendly event name, run number, and retry attempt
  when greater than one. For example: `Merge queue · Run #129 · Attempt 2`.

If multiple PRs are attached, the first is linked and the remaining count is
shown. A missing branch is marked detached. Missing job or commit metadata is
not invented. Unavailable failed steps are labelled `Step details unavailable`.
Large problem lists occupy at most two fields, with an explicit count of omitted
jobs; the run link leads to all results. Cancelled cards use the same compact
layout and do not guess why the run was cancelled.

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
The author name also counts toward the aggregate limit.

## Layout choices and references

The layout uses only the standard
[Embed author, title, description, inline fields, footer and color](https://docs.discord.com/developers/resources/message#embed-object).
Discord controls font sizes, spacing, column widths and mobile wrapping; inline
fields are layout hints. There are no CSS panels, custom badges or buttons in
the message payload. A local HTML preview only approximates this structure and
is not evidence of rendering or delivery in Discord.

The compact title, result color and linked context were informed by the mature
[sarisia/actions-status-discord formatter](https://github.com/sarisia/actions-status-discord/blob/main/src/main.ts)
and its [minimal examples](https://github.com/sarisia/actions-status-discord#minimum).
The [Ilshidur/action-discord implementation](https://github.com/Ilshidur/action-discord/blob/master/entrypoint.js)
was also reviewed as an example of plain incoming Webhook delivery. No code,
third-party branding or delivery behavior was copied from these references.

[Components V2](https://docs.discord.com/developers/components/overview) offers
more layout primitives but requires `IS_COMPONENTS_V2` and replaces traditional
content and embeds. The existing Embed covers this notification's needs without
changing its payload model, so this change does not adopt Components V2.

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
