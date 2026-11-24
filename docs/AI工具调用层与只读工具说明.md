# 核心 AI 能力第二周：工具调用层与四个只读工具

## 已实现的使用方式

登录后打开任意全局页面的 Forma AI 聊天窗口，点击“业务工具”，选择“数据查询”或“统计分析”，选择工具并设置筛选、分页、排序。执行后会在当前会话中保存一条查询消息及一条结构化结果消息，刷新仍能加载。查询只读，不修改用户或公司数据。

工具由明确的结构化条件发起。注册中心支持按 QUERY_DATA / STATISTICS_ANALYSIS 匹配候选工具；本期不将自由自然语言自动推断为业务动作，不新增写操作或任务编排，也不把模型文本直接作为 SQL 或服务地址执行。

界面沿用 Material UI。用户表展示姓名、邮箱、职位、状态；公司表展示名称、等级、国家、人均营收，可展开城市、成立年份、年营收与员工数。盈利效率直接使用 CompanyService 原有 annual_revenue / employees 计算，本页最大值作为着色参照；员工数0或未知时不计算比值。分页操作会带回原筛选、排序条件，再保存一条新的结果消息，不改写历史消息。

指标消息复用原 Dashboard Metric 组件、环图和累计折线图组件。大数字沿用现有精确小数/BigInt 格式化及万、亿、万亿等单位，保留完整值 Tooltip，不改金额原始单位、不假设币种。环图及表格显示数量和百分比，悬停/聚焦联动；条形图 Tooltip 同时显示公司数量与占比，并配套数据表。空结果与工具失败均有统一提示。

## 工具清单

| 工具名 | 意图 | 注入的业务服务 | 返回类型 |
| --- | --- | --- | --- |
| users.query | QUERY_DATA | UserService | table / users |
| companies.query | QUERY_DATA | CompanyService | table / companies |
| dashboard.metrics | STATISTICS_ANALYSIS | DashboardService | report / dashboard |
| companies.analysis | STATISTICS_ANALYSIS | CompanyAnalysisService | chart / bar |

UserService 的新查询入口委托原 ManagementService，复用原姓名搜索、职位选项、分页逻辑，并统一加入状态、排序与可信可见用户ID范围。现有管理API默认行为保持不变。CompanyAnalysisService 是原 DashboardService 聚合逻辑的业务层入口，未复制聚合SQL。DashboardService 的筛选统计复用同一个筛选谓词构造器，卡片、等级分布与年份累计来自同一查询快照。

具体工具实现仅在 `apps/api/src/ai-agent/tools/read-tools.ts`，不引入 Pool、Repository 或 TypeORM，不手写SQL。业务层必要的查询扩展仍在相应原 Service 内。业务表结构未修改。

## 接口与统一结果

新增四条接口，均挂载现有 JWT Cookie 鉴权：

- GET `/ai-agent/tools`：自动注册的工具及当前用户 allowed / enabled 状态。
- POST `/ai-agent/tools/match`：`{"intent":"QUERY_DATA"}`，返回同意图候选工具。
- POST `/ai-agent/tools/execute`：工具名与参数，可附本人 sessionId 和 UUID requestId，将执行结果保存为聊天消息。
- PATCH `/ai-agent/tools/:name/config`：`{"enabled":false}`；仅服务端明确授予 `ai:tools:configure` 的账号可修改本租户配置。

成功或工具业务失败统一返回：

```json
{
  "code": "OK",
  "data": { "kind": "users", "title": "用户查询结果", "rows": [], "roles": [], "pagination": {"page":0,"limit":10,"total":0} },
  "message": "找到 0 位可见用户，本页 0 位。",
  "resultType": "table",
  "tool": "users.query",
  "requestId": "服务端生成或客户端传入的UUID",
  "durationMs": 12,
  "parameters": {"page":0,"limit":10}
}
```

`resultType` 为 text/table/chart/report，`data.kind` 再区分具体组件。`code=OK` 才表示工具成功；失败 data 为 null、resultType 为 text，message 可直接用于前端。鉴权、HTTP请求格式等错误保留401/400等HTTP状态，也封装同样的结果字段。未知底层异常不会回显SQL、数据库信息或堆栈。

带 sessionId 执行时，接口返回 ChatSnapshot；工具结果存于 type=tool 消息的 `content.result`，source=tool。消息请求记录与 pending 结果先提交PG，再执行工具；生成中禁止重复发起并发消息。相同 requestId 和内容重发不重复执行，不增加第二份审计或消息；改变内容使用同一ID返回409。失败结果也可恢复显示；网络不明时客户端先检查已持久化的消息。

聊天工具不是模型回答的推断结果，界面明确标为“只读查询”。工具历史数据是执行时的快照，不会被后续业务更新偷偷改写。现有文本聊天、附件上传、人工确认演示、缓存与任务检查点继续可用。

## 参数示例

用户查询（page从0开始，limit为1–100）：

```json
{"name":"users.query","parameters":{"search":"张","roles":["Engineer","Analyst"],"status":"active","page":0,"limit":10,"sortBy":"name","sortDirection":"asc"}}
```

公司查询：

```json
{"name":"companies.query","parameters":{"search":"","levels":["2","3"],"country":["China"],"city":[],"page":0,"limit":10,"sortBy":"efficiency","sortDirection":"desc"}}
```

综合指标：

```json
{"name":"dashboard.metrics","parameters":{"filter":{"level":[2,3],"country":["China"],"founded_year":{"start":2000,"end":2010}}}}
```

条形图（可按level/country/city聚合，组分页不改变占比的全量分母）：

```json
{"name":"companies.analysis","parameters":{"dimension":"city","filter":{"level":[2,3],"country":["China"],"city":[],"founded_year":{"start":2000,"end":2010},"annual_revenue":{"min":"0","max":"5000000"},"employees":{"min":0,"max":1000}},"page":0,"limit":100,"sortBy":"count","sortDirection":"desc"}}
```

统计工具保留原年份、金额及员工范围边界与校验；同项多选OR、不同条件AND。金额范围支持十进制字符串，筛选条件和精确汇总不经不必要的浮点转换。表格中的金额字段沿用原Company接口数字类型。

未知字段、用户/租户注入、空白选项、控制字符、非法状态、反向范围、无效分页或排序字段均拒绝。排序只接受字段白名单，不能传入SQL表达式。工具参数最大16KB，单页最多100项。

## 权限与租户

用户ID只取现有JWT验证后的 request.userId；tenantId由服务端 AiScopeService 解析；IP取真实连接对应的 request.ip，不直接相信用户提交的转发头或工具参数。请求DTO不提供 context、userId、tenantId、permissions 字段。

公司和统计工具继续要求 tenantId 等于 `AI_BUSINESS_TENANT_ID`，不得通过额外授权跨越这一数据集边界。当前本地公司数据集仍绑定原演示账号的个人租户。

用户查询默认只看本人。跨用户只读需要服务端配置 `users:read:tenant`，且可见ID仅来自同租户的可信成员映射；角色选项也按同一可见范围提取。用户表 role/title 是职位，不授予工具管理权限；auditAdmin 也不自动授予工具配置权。

`AI_TOOL_PERMISSIONS` 示例（UUID须替换成实际值）：

```json
{
  "用户UUID": ["users:read:tenant"],
  "工具配置管理员UUID": ["ai:tools:configure"],
  "需要禁止公司查询的用户UUID": ["!companies:read"]
}
```

默认已有 users:read（本人），公司数据集租户已有 companies:read 与 dashboard:read；前缀 ! 为明确拒绝，优先于默认允许。用户可见角色范围复用业务服务查询，工具不能传visibleUserIds来扩大权限。

动态启停保存在独立AI表 `ai_tool_settings`，主键为 tenant_id + tool_name，每次执行前检查，无需重启。配置账号删除时只清空 updated_by 引用，已停用配置继续保留，避免意外重新启用。`AI_DISABLED_TOOLS` 是更高优先级的服务端逗号分隔禁用名单。

本期新增006、007迁移仅涉及AI消息类型、来源约束及工具设置；不改变 users/companies/relationships 的结构。旧 `/ai-agent/tools/query` 保留兼容返回，但同样经过注册中心的鉴权、停用检查及自动审计，不能绕开新工具控制。旧入口的结果缓存仍在统一 AiCacheService 内，只有鉴权通过后才检查数据指纹或缓存。

## 装饰器审计与脱敏

`@AuditedToolExecution()` 包装注册中心的执行入口，成功、业务拒绝、参数失败、未知工具、服务异常、缓存命中均自动记录到 ai_operation_audit。记录用户ID、工具名、read操作、参数、标准化结果、连接IP、时间、requestId和耗时。

脱敏在持久化前进行：金额/收入/营收/盈利效率、邮箱、电话、联系方式、密码、密钥及令牌类字段全部遮蔽；嵌套对象、数组和自由文本中的邮箱、号码、带金额单位的数额同样处理；非法控制字符与无效Unicode清理，避免非法输入导致审计入库失败。结果只保存有界预览（数组最多30项、总量过大时保留结果状态摘要），不无限复制大表。系统审计仍受上周追加写保护。

业务查询获准返回的金额和邮箱仍按任务需要给授权用户展示，脱敏仅针对审计副本，不错误地把业务字段抹掉。审计存储失败时不向前端返回业务数据，而返回 TOOL_AUDIT_UNAVAILABLE，避免无日志的工具操作。

## 验证与本地保留

- `npm run test:ai-tools`：本周工具专项；隔离3032测试服务与临时账号，结束清理本轮用户、公司和设置。
- `npm run test:ai-core`、`npm run test:ai-agent`：上周隔离/缓存/检查点及原对话回归，默认报告写tmp，不覆盖旧交付。
- 原 Dashboard、条形图和用户公司管理回归继续运行。
- `npm run check`、`npm run build`：两端类型检查与构建。
- 当前 Swagger 共57条API，在线 `/docs`，JSON在本周交付目录。

本周资料在 `deliveries/ai-tools-2026-11-18`，包含专项结果、上周回归、前端截图和业务表迁移前基线。代码只在本地保存，未提交远端；没有调用厂商云端模型，也不需要新的个人信息或账号注册。
