# .github

[简体中文](README_CN.md)

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/openarkstudio-logo-dark.svg">
    <img src="assets/openarkstudio-logo-light.svg" alt="OpenArkStudio" width="428">
  </picture>
</p>

Organization profile, shared visual assets and repository configuration for
[OpenArkStudio](https://github.com/OpenArkStudio).

## Organization profile

- [English profile](profile/README.md): displayed on the public organization page.
- [中文介绍](profile/README_CN.md): Chinese version of the organization profile.

## Visual identity

OpenArkStudio, ark and arknet share a cradle hull and Inter 600 lettering in electric blue and cyan. The organization carries one dot, ark carries three modules, and arknet carries linked nodes. The selected horizontal lockup gives the symbol slightly more emphasis; all lettering uses vector outlines.

All brand SVG masters are archived in this repository's [`assets/`](assets/) directory. Project READMEs reference these files; documentation sites retain matching local copies.

| Asset | Use |
| :--- | :--- |
| [Organization icon](assets/openarkstudio-icon.svg) | Organization avatar and compact placements |
| [Organization lockup](assets/openarkstudio-logo-light.svg) | Light backgrounds |
| [ark lockup](assets/ark-logo-light.svg) | Framework README and documentation |
| [arknet lockup](assets/arknet-logo-light.svg) | Networking README and documentation |
| [Dark overview](assets/identity-overview-dark.png) | Dark backgrounds |
| [Brand guide](assets/README.md) | File names, colors and usage |

Preserve the original proportions and choose the `light`, `dark` or `mono` version for the background. See [Inter-OFL.txt](assets/Inter-OFL.txt) for the font license.

## Shared configuration

- ARK and arknet summarize GitHub Actions results in Discord after each workflow completes.
- The Webhook is stored in the organization Actions secret `DISCORD_WEBHOOK_URL`.
- [Notification setup](docs/discord.md) | [中文说明](docs/discord_CN.md)
