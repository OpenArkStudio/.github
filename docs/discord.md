# Discord Actions notifications

[English](discord.md) | [中文](discord_CN.md)

Only ARK and arknet have `.github/workflows/notify-discord.yml`, which calls the shared
`discord-summary.yml` workflow in this repository. It reads only the completed
workflow's metadata and job results. It does not execute the triggering commit or
download its artifacts. A matrix produces one summary per workflow attempt.

Messages show the repository, workflow, branch, commit, outcome, job counts,
failed or cancelled job names, and a link to the run. Mentions are disabled.
Discord must return a message receipt for the notification job to pass. Explicit
rate limits are retried twice; other delivery errors fail the notification job.

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
