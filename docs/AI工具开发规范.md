# AI 工具开发规范

## 唯一执行路径

外部请求 → JWT SessionGuard → ToolPolicyService 构造可信身份 → ToolRegistryService → 启停与权限检查 → 参数DTO校验 → BaseTool.run → 统一结果 → @AuditedToolExecution 脱敏审计 → 可选聊天持久化。

禁止从控制器或其他业务流程直接调用具体工具的 run 来绕开注册中心。按名称 find 供注册中心内部查找；按意图 match 返回候选元数据，不把未知自然语言当成已批准动作。

## 新增工具

1. 定义参数DTO，使用 class-validator 明确类型、范围、长度、枚举、未知字段策略。复合业务范围必须复用已有业务解析器。
2. 继承 BaseTool，指定 parameterType，使用 @Injectable 和 @RegisteredTool 标注 name、label、intent、permission、operation:'read'、resultType。
3. 仅注入业务 Service；本期允许的实例为 UserService、CompanyService、DashboardService、CompanyAnalysisService。禁止注入业务 Repository、EntityManager、Pool、数据库客户端，禁止在工具中手写SQL或执行模型生成的SQL。
4. run 必须接收由注册中心提供的 ToolContext。不能从参数、请求头或模型输出覆盖 userId、tenantId、visibleUserIds、IP或权限。
5. 在AI模块providers中加入类；DiscoveryService自动发现并注册，重名导致启动失败，不静默覆盖。
6. 业务Service负责原有数据权限、查询、计算和分页；工具只做适配与结果装配。必要的业务查询增强应在原Service内完成，不复制到工具层。
7. 返回 ToolOutput 的 data/message/resultType；注册中心补充 code/tool/requestId/耗时/规范化参数。错误优先使用带安全业务code和中文message的HttpException；未知异常统一隐藏内部细节。
8. 新结果结构必须扩展共享 TypeScript 联合类型、Swagger和前端 resultType 调度，提供空结果、失败提示、可访问的表格/图表替代文本。
9. 新增专项测试：正确输入、非法/未知字段、无权限、跨用户/租户、分页排序、敏感日志脱敏、动态停用、错误归一化和实际Service查询。不能用模拟API返回冒充真实查询验证。

## 身份与授权

职位role不是安全角色。跨用户可见范围、工具配置权限只来自可信服务端配置；auditAdmin不自动获得其他能力。公司数据集只属于明确配置的一个租户。权限判断必须在Service读数据、缓存读取或数据指纹计算之前。

仅只读工具可在本期注册；不可通过可变URL、SQL字符串、Repository或自定义回调将写操作伪装成查询。后续写操作必须另行设计确认、事务和审计规则。

## 审计与前端

所有生产调用通过装饰器审计，不在具体工具里零散写日志，不打印原始参数和结果。敏感信息必须先经过统一redact再持久化；未经脱敏的金额、邮箱或电话不能出现在审计详情中。审计故障时拒绝返回数据。

前端只认标准resultType及data.kind；code非OK统一ToolFailure显示，不能用模型文字推测执行成功。工具结果是可持久化的历史快照，翻页带回原参数，以新消息呈现。
