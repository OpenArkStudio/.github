# Discord Actions notifications

[English](discord.md) | [中文](discord_CN.md)

Each repository has `.github/workflows/notify-discord.yml`, which calls the shared
`discord-summary.yml` workflow in this repository. It reads only the completed
workflow's metadata and job results. It does not execute the triggering commit or
download its artifacts. A matrix produces one summary per workflow attempt.

Messages show the repository, workflow, branch, commit, outcome, job counts,
failed or cancelled job names, and a link to the run. Mentions are disabled.
Discord must return a message receipt for the notification job to pass. Explicit
rate limits are retried twice; other delivery errors fail the notification job.

## Webhook configuration

The organization Actions secret `DISCORD_WEBHOOK_URL` has visibility set to all
repositories. GitHub Free does not provide organization secrets to private
repositories, so TARDIS also has a repository secret with the same name. To move
notifications to another Discord channel, replace the organization secret and
private repository copies. Repository or environment secrets with the same name
override the organization secret. Store the incoming Webhook URL without a
`/github` suffix. Never commit it.

## Workflow selection

The completion trigger names the source workflows explicitly. The installed
selection covers all existing OpenArkStudio workflows and common names for
repositories that do not yet have Actions. Add new workflow names to the
`workflow_run.workflows` list when creating or renaming them. Keep
`Discord Notifications` out of that list to prevent notification recursion.
Adding this file does not enable existing disabled workflows or add build tests.

For new repositories, copy the notification file from an existing repository.
The organization secret is available to public repositories. Private repositories
on GitHub Free need a repository secret containing the same Webhook URL.

An organization administrator can also install or synchronize the notification
file across active repositories from this checkout:

```sh
node scripts/install-notifications.mjs
```

This requires Node.js and an authenticated GitHub CLI with repository and
`workflow` permissions. It updates only the notification file on each default
branch, skips archived repositories and verifies each uploaded file.

## Resend a completed result

Use **Actions → Discord Notifications → Run workflow** and enter a completed
workflow run ID from that repository. This sends the recorded result without
running the build again. Rerunning a source workflow sends its new attempt's
result; explicitly resending a result can produce another message.
