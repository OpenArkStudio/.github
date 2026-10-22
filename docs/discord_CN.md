# Discord Actions 通知

[English](discord.md) | [中文](discord_CN.md)

仅 ARK 与 arknet 的 `.github/workflows/notify-discord.yml` 调用本仓库统一维护的
`discord-summary.yml`。通知只读取已完成工作流的元数据和任务结果，
不执行触发通知的提交，也不下载其产物。矩阵任务按一次工作流执行汇总为一条消息。

## 汇总卡片

每次执行生成一张紧凑的 Discord Embed：

- 顶部 author 行显示仓库名称和仓库所有者的头像。
- 单一标题显示工作流名称和结果：✅ passed、❌ failed 或 ⏹ cancelled。
  超时、启动失败等结果保留具体状态。标题链接到对应执行。
- 描述显示变更标题、非零任务数量，以及 **View run** 链接。
- 失败任务和加粗的失败步骤优先显示，其后是取消的任务，再展示常规信息。
  每个任务最多显示两个失败步骤。
- 三个 inline 字段集中显示 PR 或分支、带链接的短 SHA，以及 **Duration**。
  提交标题与变更标题不同时，显示在 SHA 下方；重复时省略。
- 页脚显示易懂的事件名称、运行编号，以及大于 1 的重试次数。
  例如：`Merge queue · Run #129 · Attempt 2`。

关联多个 PR 时，显示第一个 PR 的链接和其余数量。分支缺失时标记为 detached；
任务数据或提交元数据缺失时，不补造内容。未提供失败步骤时，显示 `Step details unavailable`。
异常任务清单最多占用两个字段，超出时明确提示省略的任务数量；完整结果通过运行链接查看。
取消卡片沿用相同布局，不推测取消原因。

**执行耗时（Duration）** 表示本次执行中，从最早一个已执行任务开始到最后一个任务结束的时间。
它包含这些任务之间的间隔，不包含初始排队时间，也不累加并行矩阵任务的耗时。
计算不使用工作流创建时间或更新时间，避免重新执行和手动重发导致结果失真。
任一已执行任务缺少有效时间戳，或所有任务均跳过时，显示 `Unavailable`。

标题、分支名、任务名和步骤名均按文本处理：转义 Markdown，阻止成员提醒和自动 URL 格式化。
仅生成由仓库地址、已校验的 ID 和 SHA 组成的链接，同时通过 `allowed_mentions` 禁用提醒。
截断保留完整转义和 Unicode 字符，不截断链接。字段预算遵守 Discord 的标题长度、字段长度、
字段数量和总计 6,000 字符的
[Embed 限制](https://docs.discord.com/developers/resources/message#embed-limits)。
author 名称也计入总字符数。

## 布局选择与参考

卡片仅使用标准
[Embed author、标题、描述、inline 字段、页脚和颜色](https://docs.discord.com/developers/resources/message#embed-object)。
字号、间距、列宽和移动端换行由 Discord 控制；inline 只是排版提示。
消息载荷不包含 CSS 面板、自定义徽章或按钮。本地 HTML 预览只模拟结构，
不能作为 Discord 实际渲染或投递验收的证据。

紧凑标题、结果颜色和上下文链接参考了成熟开源项目
[sarisia/actions-status-discord 的格式化源码](https://github.com/sarisia/actions-status-discord/blob/main/src/main.ts)
及其[最简示例](https://github.com/sarisia/actions-status-discord#minimum)。
同时查阅了 [Ilshidur/action-discord 的实现](https://github.com/Ilshidur/action-discord/blob/master/entrypoint.js)，
用于核对普通 incoming Webhook 的投递形式。没有复制参考项目的代码、第三方品牌素材或投递行为。

[Components V2](https://docs.discord.com/developers/components/overview) 提供更多布局组件，
但需要启用 `IS_COMPONENTS_V2`，并替代传统 content 和 embeds。
现有 Embed 已能满足通知需求，无需改变载荷模型，本次不引入 Components V2。

只有收到 Discord 消息回执，通知任务才算通过。遇到明确的限流响应最多重试两次，
其他发送错误会使通知任务失败。卡片格式调整不改变共享工作流、Secret、权限、
重新发送行为，以及投递和回执规则。

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
