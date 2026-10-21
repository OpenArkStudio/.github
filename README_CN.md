# .github

[English](README.md)

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/openarkstudio-logo-dark.svg">
    <img src="assets/openarkstudio-logo-light.svg" alt="OpenArkStudio" width="428">
  </picture>
</p>

本仓库维护 [OpenArkStudio](https://github.com/OpenArkStudio) 的组织主页、视觉资源和共享仓库配置。

## 组织主页

- [英文介绍](profile/README.md)：显示在 GitHub 组织首页。
- [中文介绍](profile/README_CN.md)：与英文主页保持一致。

## 视觉标识

组织、ark 和 arknet 采用「承托」舟体与 Inter 600 字标，使用电蓝和亮青配色。组织图标带一个圆点，ark 带三个模块，arknet 带连接节点。正式组合采用「图形稍强」比例；文字均已转换为矢量路径。

所有品牌 SVG 统一保存在本仓库的 [`assets/`](assets/) 目录。项目 README 引用这里的资源，文档站保留相同文件的本地副本。

| 资源 | 用途 |
| :--- | :--- |
| [组织图标](assets/openarkstudio-icon.svg) | 组织头像与紧凑布局 |
| [组织组合标](assets/openarkstudio-logo-light.svg) | 浅色背景 |
| [ark 组合标](assets/ark-logo-light.svg) | 框架 README 与文档站 |
| [arknet 组合标](assets/arknet-logo-light.svg) | 网络库 README 与文档站 |
| [深色效果](assets/identity-overview-dark.png) | 深色背景 |
| [品牌说明](assets/README_CN.md) | 文件命名、配色与使用方式 |

使用时保持原始比例，根据背景选择 `light`、`dark` 或 `mono` 版本。Inter 字体许可见 [Inter-OFL.txt](assets/Inter-OFL.txt)。

## 共享配置

- ark 和 arknet 在 GitHub Actions 工作流结束后，将结果摘要发送至 Discord。
- Webhook 保存在组织 Actions secret `DISCORD_WEBHOOK_URL` 中。
- [通知配置](docs/discord_CN.md) · [English](docs/discord.md)
