# Developer Box

面向开发者的跨平台桌面工具箱（macOS / Windows），基于 Electron + React + Ant Design。

## 环境要求

- Node.js 20（推荐配合 nvm，项目内已提供 `.nvmrc`）
- pnpm 10+

## 已实现功能

- 跨平台桌面应用结构（Electron）
- Ant Design UI
- 主题模式：跟随系统 / 浅色 / 深色
- 系统主题变化时自动同步（选择“跟随系统”时）
- TodoList 工具模块
- Agent 工作区
  - 接入本机 CLI Provider（内置 GitHub Copilot CLI、Claude Code、Gemini CLI 预设）
  - 接入自定义 API Provider（OpenAI 兼容 / Anthropic / Gemini）
  - 配置 HTTP 代理并作用于 CLI / API 调度
  - 基于 SQLite 持久化 Provider、代理、任务、日志和额度信息
  - 支持多 Agent 任务编排、并行执行、日志回放、输入输出查看
  - 支持按 Provider 统计消耗并在支持时刷新真实余额
- 数据持久化到用户目录
  - macOS: `~/.developer-box`
  - Windows: `C:/Users/<用户名>/.developer-box`

## 本地开发

```bash
pnpm install
pnpm dev
```

## 构建发布文件

```bash
pnpm build
```

输出目录为 `release/`。

- macOS：输出 zip（内含 `Developer Box.app`，解压后可直接运行）
- Windows：输出单文件 portable exe（可直接双击运行，无安装向导）

## GitHub Release 自动发布

仓库已添加 `Release Build And Publish` 工作流：

- 触发方式：发布 GitHub Release（`published`）
- Tag 格式：`v0.0.1`
- 自动同步：
  - 更新 `src/version.ts`
  - 更新 `package.json` 中的 `version`
  - 构建 Windows `exe` 与 macOS Apple Silicon `zip`
  - 生成 `update.json`
  - 将构建产物回传到对应 GitHub Release 资产
  - 上传到阿里云 OSS

### update.json 格式

```json
{
  "version": "v0.0.1",
  "versionCode": 1,
  "notes": "来自 GitHub Release 内容，可为空",
  "download": {
    "windows": "https://download.example.com/developer-box/releases/Developer%20Box%200.0.1.exe",
    "macArm64": "https://download.example.com/developer-box/releases/Developer%20Box-0.0.1-arm64-mac.zip"
  }
}
```

`versionCode` 按 `major * 10000 + minor * 100 + patch` 计算，例如：

- `v0.0.1` -> `1`
- `v1.2.3` -> `10203`

### GitHub Secrets

在仓库 `Settings -> Secrets and variables -> Actions -> Secrets` 中配置：

- `ALIYUN_ACCESS_KEY_ID`：阿里云 AccessKey ID
- `ALIYUN_ACCESS_KEY_SECRET`：阿里云 AccessKey Secret

### GitHub Variables

在仓库 `Settings -> Secrets and variables -> Actions -> Variables` 中配置：

- `ALIYUN_OSS_BUCKET`：OSS Bucket 名称
- `ALIYUN_OSS_ENDPOINT`：OSS Endpoint，例如 `oss-cn-hangzhou.aliyuncs.com`
- `ALIYUN_OSS_PREFIX`：上传目录前缀，可选，默认 `developer-box/releases`
- `ALIYUN_CDN_URL_PREFIX`：对外下载地址前缀（工作流会自动追加文件名，用于生成 `update.json` 中的下载链接），例如 `https://download.example.com/developer-box/releases`
- `RELEASE_SYNC_BRANCH`：版本文件自动回写分支，可选，默认仓库默认分支

### 使用方式

1. 确保以上 Secrets / Variables 已配置完成。
2. 先准备好符合格式的 tag，例如 `v0.0.2`（可先本地推送 tag，或直接在 GitHub 发布 Release 时创建）。
3. 在 GitHub 上发布该 tag 对应的 Release；工作流会在 Release `published` 时触发。
4. 工作流会自动完成版本同步、构建、回传 GitHub Release 资产与上传。

## 数据文件

应用会在用户目录下自动创建并写入：

- `settings.json`：主题设置
- `todos.json`：Todo 列表
- `workspace.sqlite`：Agent 工作区的 Provider / 代理 / 任务 / 日志数据库
- `workspace.key`：工作区敏感字段加密密钥
