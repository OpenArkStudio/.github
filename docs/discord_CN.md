# Discord Actions 通知

[English](discord.md) | [中文](discord_CN.md)

仅 ARK 与 arknet 的 `.github/workflows/notify-discord.yml` 调用本仓库统一维护的
`discord-summary.yml`。通知只读取已完成工作流的元数据和任务结果，
不执行触发通知的提交，也不下载其产物。矩阵任务按一次工作流执行汇总为一条消息。

消息包含仓库、工作流、分支、提交、结果、任务数量、失败或取消的任务名称，以及运行链接。
消息不会触发成员提醒。只有收到 Discord 消息回执，通知任务才算通过。
遇到明确的限流响应最多重试两次，其他发送错误会使通知任务失败。

## Webhook 配置

组织级 Actions Secret `DISCORD_WEBHOOK_URL` 的可见范围设为所有仓库。
Secret 本身不会启用通知，仓库还需要有通知入口工作流。
切换 Discord 频道时，修改组织 Secret。
仓库或环境中同名的 Secret 会覆盖组织配置。保存原始 Webhook URL，
不添加 `/github` 后缀，不将地址提交到仓库。

## 工作流选择

完成事件显式列出需要通知的工作流名称。新增或重命名工作流时，将名称加入
`workflow_run.workflows`。不要将 `Discord Notifications` 加入列表，避免通知递归。
添加通知文件不会启用已有的停用工作流，也不会增加构建测试。

其他 OpenArkStudio 仓库不安装通知入口。需要为其他仓库开启通知时，先明确范围，
再通过 PR 添加入口文件。ARK 和 arknet 的通知配置也通过各自仓库的 PR 修改。

## 重新发送已完成结果

打开 **Actions → Discord Notifications → Run workflow**，填写本仓库已完成的
工作流运行 ID，即可发送记录中的结果，无需重新构建。
重新运行源工作流会发送新一次执行的结果；手动重新发送可能产生另一条相同结果的消息。
