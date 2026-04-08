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

## 数据文件

应用会在用户目录下自动创建并写入：

- `settings.json`：主题设置
- `todos.json`：Todo 列表
