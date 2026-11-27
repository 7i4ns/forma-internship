# Forma Internship Workspace

供应链数据管理与受控 AI 工具项目。使用 Next.js、Material UI、NestJS、PostgreSQL、Redis 和 Chart.js。

## 当前功能

- 邮箱注册登录、JWT Cookie 会话与输入校验。
- 用户与公司管理、筛选、分页、公司折叠详情及人均营收着色。
- 动态 Dashboard：四项指标、等级占比环图、成立年份累计折线、多维度筛选条形图。
- 全局聊天、Markdown、附件、会话历史与结构化结果消息，支持明确 `/tool` 指令。
- 四个只读工具：用户查询、公司查询、综合指标、公司分布统计。
- 工具自动注册、意图匹配、权限校验、租户级启停与脱敏审计。
- 7个物理隔离的用户/公司写入工具：DTO、权限、业务预校验、标准预览、人工审批、执行前快照、确认执行与超时作废。
- Agent Tasks真实展示审批状态、操作类型、时间筛选、预览、审批记录与执行日志，并可跳转关联会话。
- AI 会话/记忆/任务/审计数据服务、Redis缓存及临时LangGraph检查点。
- Swagger接口文档与集成测试。

聊天中的业务查询可通过“业务工具”选择条件，或输入白名单指令，例如 `/tool companies.query {"search":"China"}`。受控写入使用明确的 `/write` 指令，例如 `/write companies.create {"name":"Example","level":"1","country":"China"}`；系统只创建预览和审批任务，必须由本人点击 Execute 后才会调用原业务 Service。尚未实现自由自然语言自动选工具、自动审批或复杂任务编排。

## 目录

```text
apps/web          Next.js 前端
apps/api/src      NestJS 后端与独立 ai-agent 模块
apps/api/migrations  数据库迁移
packages/ai-contracts  共享 TypeScript 消息与工具类型
postman           API测试集合与无凭证的环境模板
tests             集成测试
scripts           本地服务与API验收脚本
docs              实现说明与工具开发规范
```

## 本地运行

需要 Node.js 22、PostgreSQL 17及pgvector扩展、Redis；本地模型可选 Ollama + qwen3:8b。模型与数据库服务需自行安装、启动，不随源码提供。

```sh
npm ci
cp apps/api/.env.example apps/api/.env
```

编辑 `apps/api/.env`，配置自己的数据库、Redis与模型连接。将 `JWT_SECRET` 替换为至少32个字符的随机密钥，例如用 `openssl rand -hex 32` 生成。不要使用示例占位值，不要提交真实 `.env`。

创建所配置的数据库后，在项目根目录执行：

```sh
npm run db:migrate -w apps/api
npm run dev:api
```

另开终端：

```sh
npm run dev:web
```

- 前端：http://127.0.0.1:3000
- Swagger：http://127.0.0.1:3001/docs
- 依赖检查：http://127.0.0.1:3001/health

首次运行请自行注册本地测试账号；源码不提供可用于真实系统的账号、密钥或业务数据。数据库为空时看板与列表会显示空状态；有权使用CSV数据时可执行 `npm run db:import -w apps/api -- companies.csv relationships.csv`，导入器支持事务预检，详见实现说明。

## AI工具权限

用户查询默认只看本人。公司及统计工具要求当前租户匹配服务端 `AI_BUSINESS_TENANT_ID`；未配置时默认拒绝读取公司数据集。需要跨用户查询、管理工具启停或使用写入预览时，通过可信服务端 `AI_TENANT_MEMBERSHIPS` 与 `AI_TOOL_PERMISSIONS` 配置；写入预览分别需要 `users:write` 或 `companies:write`。

职位role不代表安全权限，审计管理员也不自动拥有工具配置权。审批参数使用 AES-256-GCM 加密保存，密钥由 `AI_APPROVAL_ENCRYPTION_KEY`（建议单独配置）或服务端会话密钥派生；默认24小时过期，可由 `AI_APPROVAL_TIMEOUT_HOURS` 调整。现有传统业务API仍用于本地实习验收，尚未整体改造为生产级多租户业务系统；请勿将本地服务直接暴露到公网。

## 验证

```sh
npm run check
npm run build
npm run test:management
npm run test:dashboard
npm run test:company-bars
npm run test:ai-tools
npm run test:ai-core
npm run test:ai-week3
npm run test:ai-write-approval
npm run test:ai-agent
```

集成测试需要独立的本地测试数据库及依赖服务。部分测试需要在3001端口运行API；工具专项使用3032、AI核心专项使用3031、第三周联调使用3033端口并自行启动隔离API。聊天及AI核心回归会真实调用已配置的本地模型。请串行运行会写入临时数据的集成测试。

测试产生的报告、环境文件与临时数据不纳入Git。2026-11-27本地验收通过：写入审批76项、第三周回归82项、只读工具200项、AI核心223项、用户/公司回归45项；该结果不等同生产并发负载测试。

## 实现说明

- [工具调用与只读工具](docs/AI工具调用层与只读工具说明.md)
- [AI工具开发规范](docs/AI工具开发规范.md)
- [AI核心数据与缓存](docs/AI核心能力第一周.md)
- [AI核心能力第三周](docs/AI核心能力第三周.md)
- [核心写入工具开发2](docs/核心写入工具开发2.md)
- [基础对话框架](docs/AI-Agent基础交互框架说明.md)
- [Dashboard与条形图](docs/Dashboard条形图与组合筛选说明.md)

## 仓库范围

本仓库拟用于实习代码审阅。仅包含源码、迁移、测试及通用文档；本地环境、老师提供的数据、会议记录、录屏、截图、数据库备份与历史交付包均保留在本机，未列入待上传内容。

本项目暂未附开放源代码许可；公开可见不代表授予再分发或商业使用权限。实习结束后的代码回收与仓库可见性按所属单位要求处理。
