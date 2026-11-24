# Dashboard 动态公司看板

完成日期：2026-11-03。沿用现有 Next.js + MUI v6 / NestJS / PostgreSQL 项目。可视化使用 Chart.js 与 react-chartjs-2。

页面：http://127.0.0.1:3000/dashboard
接口：GET http://127.0.0.1:3001/dashboard
文档：http://127.0.0.1:3001/docs

## 已实现

- 数据卡：公司数量、总收入（annual_revenue 合计）、覆盖国家去重数、员工总数。
- 大数字自动换算万、亿、万亿、京；悬停或键盘聚焦卡片数值显示完整精确值。金额与员工总量从数据库以十进制字符串返回，通过 BigInt 换算和四舍五入，避免 JS Number 丢失大数字精度。
- 交互环形图：按公司 level 分组，悬停图形展示数量和占全部公司的百分比；下方数据表始终列出每组数量与百分比，悬停、聚焦或点击等级可联动高亮。
- 交互折线图：以 founded_year 为年份，统计当年新增与逐年累计；悬停显示当年新增和累计数。可展开年度数据表进行核对。
- 每 30 秒从服务器刷新一次（页面可见时），返回页面或点击“刷新数据”也可更新。
- 初次加载骨架屏、空数据提示、错误重试；刷新失败时明确提示保留上一次结果，不把旧数据当作新数据。
- 手机/窄屏自动改为纵向布局，桌面为四卡片和左右两张图表。

## 统计口径

1. 全量 companies 表聚合，不受 Company 页面搜索、筛选或分页影响。不以 relationships 行数作为公司数，不重复统计有多个供应关系的公司。
2. 公司数为 count(*)。国家去除首尾空白并忽略大小写后去重，空白不计数；没有猜测“中国”“China”“CN”等别名映射，后续需明确映射表后再统一。
3. 收入为 annual_revenue 已知值之和，员工数为 employees 已知值之和；0 是有效值，null 不进入求和。卡片同时显示已提供字段的公司数量，区分“全量为零”和“数据缺失”。
4. 金额使用原始数据金额单位；当前模型没有币种字段，不擅自写美元等符号，也没有汇率换算。正式 CSV 到位后如存在多币种，应先确认统一单位再解释跨公司合计。
5. 环图分母始终是全部公司数，不提供隐藏扇区改变分母的图例；空等级归入“未分类”。百分比保留两位小数，舍入后的总和可能不恰好等于 100%。
6. 折线图按用户明确要求使用 founded_year（成立年份），不把 supplying_since 或记录 created_at 当作年份。该图是按成立年份代理统计的网络增长，并不声称代表真实供应关系建立日期。
7. 同年多家公司先合并计数；从最早有效年份到当前年份补齐每一年，没有新增时沿用上一年累计。年份按 Australia/Sydney 的当前年份确定。
8. 缺失年份、早于 1000 或晚于当前年的数据不进入折线，仍计入公司总数及等级分布；API coverage 返回排除数量，页面有提示。无有效年份时显示空图提示，不编造时间点。

## API 返回结构

需要有效且状态正常的登录账号，沿用 HttpOnly Cookie。未登录返回 401。响应 Cache-Control: no-store。

```json
{
  "summary": {
    "companyCount": 4,
    "totalRevenue": "48800000.00",
    "countryCount": 4,
    "totalEmployees": "228",
    "revenueReported": 4,
    "employeesReported": 4
  },
  "levels": [
    { "level": "Tier 2", "count": 2, "percentage": 50 },
    { "level": "Tier 1", "count": 1, "percentage": 25 },
    { "level": "Tier 3", "count": 1, "percentage": 25 }
  ],
  "growth": [
    { "year": 1998, "added": 1, "cumulative": 1 },
    { "year": 1999, "added": 0, "cumulative": 1 }
  ],
  "coverage": { "yearKnown": 4, "yearExcluded": 0, "yearMissing": 0, "yearInvalid": 0 },
  "asOfYear": 2026,
  "generatedAt": "2026-11-03T03:54:01.000Z"
}
```

以上是本机演示数据的结构示例，growth 仅节选前两年，实际接口会完整返回至当年。时间戳每次请求由服务器生成；不是硬编码数据。

## 计算与组件位置

- apps/api/src/dashboard：独立 DashboardModule、Controller 与 Service。使用单条 PostgreSQL CTE 查询，从同一快照一次返回卡片、等级分组和年份累计，避免图表之间统计时点不一致。
- apps/web/lib/dashboard.ts：响应类型、精确大数字换算、等级配色。
- apps/web/components/dashboard/dashboard.tsx：数据请求、定时刷新、数据卡与页面布局。
- apps/web/components/dashboard/charts.tsx：Chart.js 图形、hover tooltip、联动数据表、年度数据表与空状态。

已有公司新增、编辑、删除或 CSV 导入无需额外维护统计表；下一次请求重新计算即可反映变化。

## 验收

```sh
npm run check
npm run build
npm run test:dashboard
```

53 项断言及其他附加校验已通过：

- 空表、缺失字段、0 值、国家去重、等级分母、未分类。
- 2000 年新增 1 家、2001 年新增 3 家，累计分别为 1 和 4。
- 无新增年份补齐、缺失/未来年份排除、延伸至当前年份。
- 万/亿/万亿/京边界、舍入跨单位边界、超过 JS 安全整数的金额与员工数。
- 真实 API 登录检查、no-store、公司新增/编辑/删除后的卡片及两类图表同步更新，Swagger 中包含 Dashboard 接口。

计算边界用连接内临时表测试，不清空或修改现有公司。实际接口测试使用独立临时账号和公司，结束后只清理这些记录。
浏览器已验证实际图表绘制、环图高亮与数量/百分比提示、折线年度新增/累计提示、年度表格与手动刷新。

## 数据现状

2026-11-03 已收到并导入用户提供的公司 dummy data：2,000 家公司、1,999 条父子关系，覆盖 8 个国家，年营收合计 182,779,175，员工合计 699,119。页面现读取这批测试数据，原先 4 家录屏公司已备份后清理；仍不将 dummy data 称为生产数据。详见《公司测试数据导入记录》。前面的 4 家公司 API 示例是开发初期结构示例，当前数值以实时接口为准。
