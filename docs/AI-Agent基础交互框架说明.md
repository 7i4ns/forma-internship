# AI Agent 基础交互框架

完成日期：2026-11-13。本周范围为会话入口、消息渲染、文件上传、简单模型调用和持久化，不包含意图识别、业务工具调用或任务编排。

## 使用方式

1. 登录本地项目，Dashboard、Company、Order、User和新增Agent Tasks页面右下角均可打开「问问 Forma AI…」。
2. 在聊天窗口输入文本，Enter发送，Shift + Enter换行；中文输入法选字时不触发发送。消息区自动滚动到底部，输入发送后清空；请求明确失败时恢复输入。
3. 当前真实对话使用已安装的 `Ollama / qwen3:8b`。窗口内「新对话模型」选择仅作用于新建会话，已有会话固定其provider/model。
4. 点击「会话历史」切换最近100个会话。刷新页面后恢复原会话；消息、附件和模型生成状态由数据库加载，浏览器只保存按用户隔离的会话ID和窗口开关。
5. 「消息类型演示」创建带有明显示例标识的独立会话，包含Markdown、表格、条形图、报表预览、人工确认。确认只保存演示选择，不执行业务操作；刷新后选择仍保留。
6. Agent Tasks为Dummy进度表，提供排队中/进行中/已完成状态、进度、过滤和详情弹窗。未连接真实任务工作流。

## 模块分层

前端 `apps/web/modules/ai-agent/`：

- components：全局入口、聊天窗口、输入与上传、统一消息分派、各消息卡片、任务示例页。
- hooks/use-chat.ts：会话加载、切换、发送、生成状态轮询、请求防重及失联后的重新加载。
- services/chat-api.ts：统一封装聊天HTTP访问。
- `apps/web/components/workspace.tsx`只负责挂载全局组件，页面布局保持现有MUI风格；背景会话校验时保留工作空间挂载，避免选择文件或切回窗口时丢失对话草稿。

后端 `apps/api/src/ai-agent/`：

- ai-agent.module.ts：独立Nest模块。
- domain/ai-chat-session.entity.ts：会话行实体与公开DTO映射。
- application/chat.service.ts：会话归属、持久化、生成占用、幂等、重试、附件和演示选择。
- infrastructure/model-gateway.ts：模型配置、HTTP适配、统一文本响应、超时和错误脱敏。
- http：DTO输入校验、接口与OpenAPI响应模型。

共享类型 `packages/ai-contracts/index.d.ts`：前后端共用ChatSession、ChatSnapshot、FileAttachment、ModelProfile与ChatMessage判别联合。消息的type包括text/table/chart/report/confirmation；模型正常回答始终作为text，不把模型输出任意JSON直接当成可执行确认或业务卡片。

## 数据表与状态

迁移 `apps/api/migrations/004_ai_chat.sql`新增：

- ai_chat_sessions：user_id、标题、provider/model、idle/thinking状态、当前生成消息ID、起始时间及时间戳。
- ai_chat_messages：顺序号、角色、类型、JSONB内容、附件元信息、complete/pending/error状态、request_id与reply_to。
- ai_chat_files：会话归属、名称、大小、MIME、实际二进制数据及可提取文本。

会话访问始终按当前用户过滤，附件通过会话校验归属；其他用户访问统一404。用户消息与pending回答先事务性写入，再调用模型，因此刷新或浏览器断线不丢已保存消息。后台完成后轮询可读取结果。

相同requestId与内容重复提交只返回已有消息，不重复调用模型；相同ID对应不同内容返回409。同一会话同时只允许一轮生成。生成失败仍保存原用户消息与失败状态；重试只更新原回答，不重复用户消息。过期的生成占用在读取时标记为可重试中断状态。

每会话最多100条消息；本期历史列表显示最近100个会话。传给模型的是最近最多20条有效文本、总计最多约6000字符的上下文窗口，完整历史仍在数据库。文件在上下文中以参考数据标记，单文件最多使用前2000字符，仍受总上下文长度限制。

## 文件支持

- 单文件最大5MB，每条消息最多3个；每会话最多20个文件、总量20MB。
- TXT、MD、CSV、JSON：UTF-8校验；JSON另做语法检查。保存完整文件，抽取最多8000字符作可用文本，再按上述上下文窗口截取。
- PDF、PNG、JPG/JPEG：校验基本文件签名并保存，可下载，但本期不提取内容、不做OCR/视觉识别。界面会明确说明，模型上下文也说明不能声称已阅读这些文件。
- 不支持的扩展名、空文件、超大文件或无效文本会拒绝。中文文件名保留。
- 下载必须登录，响应强制attachment和nosniff；不把上传HTML或脚本内联执行。未发送的草稿附件可移除，已发送的附件不能作为草稿删除。
- Markdown使用react-markdown和remark-gfm，禁用原始HTML；图片链接不会自动从外站加载。

## 模型切换

无需新建账号即可用现有本地模型开始对话。所有密钥只放后端 `.env`，不进入前端。

```dotenv
AI_MODEL_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen3:8b
AI_MODEL_TIMEOUT_MS=120000
```

DeepSeek、Qwen、GPT、Kimi使用统一OpenAI兼容Chat Completions格式，配置键分别为 `DEEPSEEK_*`、`QWEN_*`、`OPENAI_*`、`KIMI_*`，每组必须填写BASE_URL、MODEL、API_KEY。Qwen地址按账号工作空间和地域复制，不推测地域或密钥；Kimi同样按账号地域选择。完整模板见apps/api/.env.example。

修改配置后重启后端并刷新网页。未配置的模型在下拉框中禁用。`MODEL_PROVIDER=api`的旧配置仍映射至GPT，新模块可用AI_MODEL_PROVIDER单独选择默认值。

本次实调：本地qwen3:8b。四家云端适配通过受控HTTP契约测试验证请求路径、鉴权头和文本回复归一化；由于没有厂商密钥，没有进行真实云端联调，也没有产生厂商API费用。模型故障返回通用错误，不向浏览器暴露上游原始错误或密钥。

## 新接口（11条）

全部受现有HttpOnly Cookie会话保护；Swagger `/docs` 已同步，当前全部项目共30条接口。

- GET /ai-agent/models：配置状态（无密钥或服务地址）。
- GET /ai-agent/sessions：当前用户最近100个会话。
- POST /ai-agent/sessions：创建会话，body为可选provider。
- POST /ai-agent/sessions/demo：五类消息演示会话，不调用模型。
- GET /ai-agent/sessions/:id：会话与消息快照。
- POST /ai-agent/sessions/:id/messages：text、fileIds、requestId，返回持久化快照。
- POST /ai-agent/sessions/:id/messages/:messageId/retry：重试最后一条失败回答。
- POST /ai-agent/sessions/:id/messages/:messageId/decision：保存approved/rejected演示选择。
- POST /ai-agent/sessions/:id/files：multipart/form-data，file字段。
- GET /ai-agent/files/:id：附件下载。
- DELETE /ai-agent/files/:id：删除尚未发送的草稿附件。

消息发送/重试HTTP 200表示快照已处理；模型是否生成成功需检查assistant.status，不把错误文本当成成功模型回答。未知资源/越权404、输入错误400、状态冲突409、超大文件413、模型未配置503。

## 验证与复现

```sh
npm install
npm run db:migrate -w apps/api
npm run dev:api
npm run dev:web
# 另一个终端
npm run test:ai-agent
npm run check
npm run build
```

聊天专项80项断言通过，测试账号及会话/附件自动清理；不修改公司和关系数据。真实模型验证了第一轮记忆、第二轮回忆及读取文本附件。另验证了隔离、输入错误、文件限制、防重、并发、失败重试、中断恢复、中文文件名、上游错误脱敏和四家远端请求格式。

网页人工检查了全局入口、刷新后多轮续聊、文件上传与Markdown回答、Shift+Enter、关闭/跨页面保留草稿、五类消息、报表弹窗、确认结果刷新保留、历史切换、任务过滤和详情。构建/类型检查通过，OpenAPI校验通过。原有19条基础API另完成132请求/728断言回归，失败0，原数据校验一致。记录与截图见deliveries/ai-agent-2026-11-13。

原有2026-11-10 API交付包和报告是当时19条接口的归档，不将其视为新增AI接口的测试结果。原有api:collection / test:api-delivery继续覆盖19条基础API，后续执行结果输出到tmp/api-legacy-current，避免覆盖旧交付归档；新AI接口使用test:ai-agent验证。

## 官方接口参考

- Ollama：https://docs.ollama.com/api/chat
- DeepSeek：https://api-docs.deepseek.com/
- Qwen：https://www.alibabacloud.com/help/en/model-studio/compatibility-of-openai-with-dashscope
- GPT：https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create
- Kimi：https://platform.kimi.ai/docs/api/chat

代码继续本地保留，等待最后统一提交。本阶段可以围绕「会话持久化、多模型适配、结构化消息渲染、文件上传与自动化验证」整理后续技术总结，不能描述为已实现完整Agent任务执行平台。
