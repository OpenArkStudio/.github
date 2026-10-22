<p align="right">简体中文 · <a href="https://github.com/OpenArkStudio/.github/blob/main/profile/README.md">English</a></p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/OpenArkStudio/.github/main/assets/openarkstudio-logo-dark.svg">
    <img src="https://raw.githubusercontent.com/OpenArkStudio/.github/main/assets/openarkstudio-logo-light.svg" alt="OpenArkStudio" width="428">
  </picture>
</p>

<h3 align="center">面向联网应用的 C++ 基础组件。</h3>

<p align="center">组合业务服务，连接应用系统，开放协作开发。</p>

<p align="center">
  <a href="https://github.com/OpenArkStudio/ark/blob/main/CMakeLists.txt"><img src="https://img.shields.io/badge/C%2B%2B-20-5267df" alt="C++20"></a>
  <a href="https://github.com/OpenArkStudio/ark/blob/main/LICENSE"><img src="https://img.shields.io/badge/ark-Apache--2.0-5267df" alt="ark: Apache-2.0"></a>
  <a href="https://github.com/OpenArkStudio/arknet/blob/main/LICENSE"><img src="https://img.shields.io/badge/arknet-BSL--1.0-5267df" alt="arknet: BSL-1.0"></a>
</p>

<p align="center"><a href="#选择起点"><strong>浏览项目 →</strong></a> &nbsp; · &nbsp; <a href="https://openarkstudio.github.io/ark/zh/">框架文档</a> &nbsp; · &nbsp; <a href="https://openarkstudio.github.io/arknet/zh/">网络库文档</a> &nbsp; · &nbsp; <a href="https://discord.gg/GmyBbcv">Discord</a></p>

---

OpenArkStudio 为 C++ 服务端应用开发开源库与框架，应用场景包括游戏服务端。核心项目围绕模块化服务、异步网络与跨平台开发，支持 Linux、macOS 和 Windows。

## 选择起点

| 项目 | 提供什么 | 从这里开始 |
| :--- | :--- | :--- |
| **[ark](https://github.com/OpenArkStudio/ark)** | C++20 应用框架，提供插件、模块生命周期、实体数据与进程通信。 | [快速开始](https://openarkstudio.github.io/ark/zh/get-started/quick-start/) · [示例](https://github.com/OpenArkStudio/ark/tree/main/examples) |
| **[arknet](https://github.com/OpenArkStudio/arknet)** | C++20 header-only 库，提供 TCP、UDP、HTTP、WebSocket、可靠 UDP、原生 MySQL/Redis 客户端及可选的安全传输。 | [安装与配置](https://openarkstudio.github.io/arknet/zh/get-started/installation/) · [示例](https://github.com/OpenArkStudio/arknet/tree/main/examples) |

需要应用框架来组织服务和数据时，从 **ark** 开始。需要在自己的应用中使用网络或数据库客户端时，从 **arknet** 开始。ark 使用 arknet 提供网络能力，arknet 也可独立使用。

## 了解与参与

- **阅读文档**：从 [ark 指南](https://openarkstudio.github.io/ark/zh/)或 [arknet 协议指南](https://openarkstudio.github.io/arknet/zh/)开始。两个文档站均提供中英文版本。
- **反馈问题**：在 [ark](https://github.com/OpenArkStudio/ark/issues) 或 [arknet](https://github.com/OpenArkStudio/arknet/issues) 提交 Issue，附上平台、提交版本和可复现示例。
- **参与贡献**：改进示例、文档、测试或实现。提交 PR 前，请阅读目标仓库的贡献说明。
- **交流讨论**：加入 [Discord](https://discord.gg/GmyBbcv)，或在相关仓库提交 Issue。

## 项目许可证

[ark](https://github.com/OpenArkStudio/ark/blob/main/LICENSE) 采用 Apache-2.0。
[arknet](https://github.com/OpenArkStudio/arknet/blob/main/LICENSE) 采用 BSL-1.0（Boost Software License 1.0）。其他仓库的许可证及第三方声明以各仓库内容为准。
