# AI 核心能力第一周：数据、隔离、缓存与 Service 接入

## 本期范围与运行

本期在既有 Nest.js AI 模块内新增四张核心表的 TypeORM 实体和 CRUD、服务端用户/租户隔离、统一 Redis 缓存服务、显式白名单业务查询入口、可被真实 LangGraph 使用的临时检查点适配器。保留现有 Next.js 聊天界面、消息和附件。尚不进行自然语言自动选工具、自动任务编排或真实任务执行；模型调用缓存按要求仅预留前缀。

启动前在项目根目录执行：

```sh
npm install
npm run db:migrate -w apps/api
npm run dev:api
npm run dev:web
```

后端默认 `http://127.0.0.1:3001`，Swagger 为 `/docs`，完整规范为 `/docs-json`。所有 AI 接口沿用 HttpOnly Cookie 内的 JWT，每次请求都检查签名、过期、发行方、受众、数据库账号及 active 状态。AI 接口不接受客户端传入的租户、归属用户、管理员标记。业务用户表的 role 是职位，不是授权依据。

`npm run test:ai-core` 启动独立 3031 端口测试服务，创建临时用户、短期公司测试记录，结束后清理本轮数据。`npm run test:ai-agent` 回归原聊天功能；默认将结果写入 `tmp/ai-agent-current`，不覆盖之前交付。构建与类型检查分别为 `npm run build`、`npm run check`。

## 四张核心表

所有实体只在 `apps/api/src/ai-agent/domain`，由 AI 独立 DataSource 加载；`synchronize:false`、`migrationsRun:false`，不扫描业务实体，不自动修改表结构。迁移文件 `005_ai_core.sql` 显式维护约束、复合外键和索引。

| 表 | 专属字段 | 约束及索引 |
| --- | --- | --- |
| ai_chat_session | title、provider、model、state、active_message_id、generation_started_at、is_demo、closed_at、deleted_at | UUID 主键；provider 白名单；state 为 idle/thinking；title 最多80字；作用域分页索引；(id,tenant_id,user_id) 唯一键；软删除 |
| ai_user_memory | session_id 可空、memory_key、content JSONB | 同租户同用户 memory_key 唯一；非空记忆键；content 必须对象；关联会话须同时匹配会话ID、租户、用户；作用域时间索引 |
| ai_task_record | session_id 可空、task_type、status、progress、input/output JSONB | queued/running/completed/failed/cancelled；进度0–100；完成时100；禁止状态倒退；关联会话同作用域；作用域分页及状态索引 |
| ai_operation_audit | action、result、source、target_type/target_id 可空、details JSONB | success/failure；manual/system；系统日志不可修改或删除，数据库触发器也保护；用户分页、租户审计分页索引 |

共同字段：id UUID、tenant_id UUID、user_id UUID、created_at/updated_at TIMESTAMPTZ。user_id 外键关联现有 users(id)，沿用账号删除时级联清理 AI 数据的行为。审计不是脱离用户的永久合规存档；删除账号会级联清除其 AI 记录。

原有 `ai_chat_sessions` 原地更名为要求的单数表名 `ai_chat_session`，四段已有会话及消息、附件不复制、不丢失。旧名称保留一个可更新兼容视图，供原验收脚本继续使用。旧 `ai_chat_messages`、`ai_chat_files` 是上周已存在的支持表，不是本周新增核心表。迁移前的会话 tenant_id 回填为其 user_id。

users、companies、relationships 没有新增列、改列、改索引或改约束。CompanyService 只增加成功写入后的缓存失效通知；DashboardService 只增加只读数据指纹方法，CSV 导入成功后也通知同一缓存服务。

## 权限与租户

服务端 `AI_TENANT_MEMBERSHIPS` 是可信身份映射，格式：

```json
{
  "用户UUID": { "tenantId": "租户UUID", "auditAdmin": false },
  "审计管理员用户UUID": { "tenantId": "同一租户UUID", "auditAdmin": true }
}
```

以上是格式示意，UUID须替换成实际值。缺省 `{}` 时每个用户得到个人租户 tenantId=userId、auditAdmin=false。非法配置拒绝请求，不降级为管理员。正式接入组织身份系统时应替换这个解析器；当前不新增组织表，也不改用户表。迁移后重新指定已有用户的租户不会自动迁移其旧记录，需要另行执行受控的 AI 数据迁移。

普通用户在四类资源上都只能读写本人记录。审计管理员只能读取本租户全部审计或按 user_id 过滤，不能读取其他人的会话/记忆/任务，不能编辑或删除别人的手工审计，也不能改写系统日志。跨租户资源统一表现为404，不暴露其是否存在。管理员“全量”指本租户全量，符合跨租户完全隔离的要求。

原有业务 API 沿用上期开发权限，尚未整体升级为多租户业务系统。为避免把全量公司数据当作任意租户数据，新增 AI 业务工具只允许 `AI_BUSINESS_TENANT_ID` 指定的**一个**租户访问现有公司数据集；留空则拒绝所有 AI 业务工具调用。本机已绑定现有演示账号的个人租户，无新增用户或真实个人资料需求。其他用户默认不能经 AI 工具读取该数据集。

## CRUD 与工具接口

四类基础路径：

- `/ai-agent/core/sessions`
- `/ai-agent/core/memories`
- `/ai-agent/core/tasks`
- `/ai-agent/core/audits`

每类均有 GET 列表、POST 创建、GET `/:id`、PATCH `/:id`、DELETE `/:id`。列表 page 从0开始、limit默认10、最多100，支持 user_id 筛选。普通用户传其他用户ID得到403；管理员只在审计列表中允许同租户跨用户筛选。未知字段、空更新、非法UUID、非法格式或显式null均按 DTO 拒绝。JSON记录最大64KB。

会话 PATCH `{ "closed":true }` 主动关闭并清理短期缓存，关闭后仍可查看历史，拒绝新消息、重试、上传与确认写入；`closed:false` 重新打开。生成中拒绝编辑、关闭、删除，避免切断在途生成。会话 DELETE 为软删除并隐藏关联聊天/附件入口。

任务创建仅建立记录，不执行任务。临时状态接口：

- GET `/ai-agent/core/tasks/:id/state`：返回临时 state，过期或 Redis 不可用为 null，同时返回数据库中的 status/progress。
- POST 同路径，`{ "state": {"step":"pending"}, "ttl":7200 }`：TTL 1–86400秒；Redis不可用明确拒绝，不伪称保存成功。

审计手工记录支持本人完整CRUD；自动生成的系统操作事件采用追加写入，不能通过CRUD改写。日志只存操作类型、目标ID、变更字段名、缓存命中等摘要，不自动复制完整聊天、记忆内容或密钥。

POST `/ai-agent/tools/query` 是显式工具调度入口，只允许：

```json
{ "tool":"dashboard.summary", "question":"当前公司数量？" }
```

```json
{
  "tool":"companies.filter",
  "question":"按国家统计二三级公司",
  "parameters":{ "dimension":"country", "filter":{ "level":[2,3] } }
}
```

实际调用既有 `DashboardService.get()` 和 `getCompaniesByFilter()`；复用原筛选校验，不直接执行模型拼接SQL，不转发任意URL。返回 `{tool,source:"existing-service",cacheHit,data}`。本期调用路径由结构化请求明确指定，不代表聊天模型已具备自然语言自动查询或写业务数据的能力。

## Redis 设计

AI 代码只通过 `AiCacheService` 操作 Redis。CompanyService 和导入工具调用该服务的失效方法，不各建 AI Redis 客户端。系统 `/health` 的 Redis 连通性检查不是 AI 缓存实现的一部分。

| 前缀 | 键内容及默认TTL | 行为 |
| --- | --- | --- |
| ai:session: | tenantId:userId:sessionId；7200秒 | 保存最近20条已完成文本消息，即最多10轮；新消息后更新；读取前核验数据库消息版本；关闭/删除主动清理；未命中、损坏、版本不符或Redis故障从PG重建；完整历史仍在PG |
| ai:chat_cache: | tenantId:userId:SHA256；600秒 | 问句、业务域、参数、上下文/模型或数据指纹、失效代次共同决定键；不在键名暴露原文；同问句不同上下文不误命中；支持域开关、TTL和主动失效 |
| ai:llm_cache: | 仅常量占位 | 按清单暂不实现模型层缓存；不会写入该前缀 |
| ai:task_state: | tenantId:userId:taskId；7200秒 | 临时任务状态或LangGraph检查点；读写先验证持久任务归属；自动过期；删除任务主动清理 |

`AI_CHAT_CACHE_POLICIES` 示例：

```json
{
  "companies": { "enabled":true, "ttl":600 },
  "conversation": { "enabled":true, "ttl":600 }
}
```

未指定域默认启用600秒；非法策略禁用缓存。conversation 是聊天结果缓存，键额外包含完整送入模型的上下文、模型和附件参考文本，防止多轮问答复用错误答案；它与尚未开发的模型层缓存不同。失败回答不缓存。

业务更新主动切换域版本，正在进行的旧查询不能重新写回当前版本。公司工具还通过现有 Service 读取只读全量数据指纹，防止直接导入、Redis中断期间更新后恢复等情况误用旧数据。当前两千家公司适用；大规模数据应将指纹升级为数据版本服务或事务事件机制，本期为遵守“不改业务表结构”未增加业务触发器或版本列。

Redis普通缓存故障时回退数据库/实际Service，聊天历史仍保存PG。任务状态写入、检查点写入依赖Redis，故障时明确失败。Redis是临时层，不代替PG持久任务记录；过期检查点无法自动恢复之前的图执行。

## LangGraph 检查点适配

`RedisTaskCheckpointer` 继承当前安装的 `BaseCheckpointSaver`，实现 getTuple、list、put、putWrites、deleteThread。通过 `AiBusinessToolsService.checkpointer(scope,taskId)` 创建，绑定调用用户、租户、持久任务；thread_id必须等于已授权任务ID，checkpoint_ns隔离子图，保存父检查点、元数据及中间写入，使用LangGraph serializer处理值。

并发写入通过独立 Redis WATCH/MULTI 连接及冲突重试，保留先于主检查点到达的中间写入，并按官方 pending-write 顺序回放。限制1000个检查点、8MB总状态；默认2小时TTL，避免临时数据无限增长。

集成测试实际编译并调用 StateGraph，换一个图和适配器实例继续读取Redis检查点，验证父链、列表、并发中间写入和权限隔离。这是兼容性基础验证，不启动业务任务编排。

## 验收证据

本次报告位于 `deliveries/ai-core-2026-11-17`。`test-results.json` 为新模块集成测试，`chat-regression/test-results.json` 为旧聊天回归，`openapi.json` 为完整当前接口契约，`before-schema.json` 为迁移前业务列定义和数量基线。测试完成后不保留临时用户、测试公司或测试会话；保留原有四段用户演示会话。

参考官方文档：
- TypeORM DataSource： https://typeorm.io/docs/data-source/data-source-options/
- Redis Node客户端： https://redis.io/docs/latest/develop/clients/nodejs/connect/
- LangGraph JS持久化设计： https://github.com/langchain-ai/langgraphjs/blob/main/docs/docs/concepts/persistence.md

接口和检查点的实际编译契约以本项目锁定依赖及集成测试为准。
