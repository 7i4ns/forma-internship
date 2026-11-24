# Dashboard 条形图与组合筛选

完成日期：2026-11-06。本次只扩展 Dashboard 下方的「公司分布分析」，原有卡片、环形图与累计折线图保持全量统计。

## 页面交互

- Chart.js 竖向条形图：横轴可切换 level、country、city，纵轴为匹配的公司数量（家）。
- Material UI 多选下拉框：公司等级、国家、城市，支持键入搜索、勾选和删除已选项。
- 范围：founded_year 起止年份、annual_revenue 最低/最高收入、employees 最少/最多员工。
- 选择或输入有效条件后约400毫秒自动查询；提供清空筛选、手动刷新、每30秒自动刷新、窗口重新聚焦刷新。
- 悬停显示完整分组名称、公司数量和占当前筛选结果的百分比；可展开数据表，并通过表格悬停/键盘聚焦联动图表。
- 按数量降序展示所有分组，超过20组时图表和表格同步分页；窄屏横向滚动图表，避免标签拥挤。没有静默截断为 Top N。
- 加载、空结果、请求失败可重试、范围错误提示均已处理。响应与筛选条件绑定，取消旧请求，防止快速切换时旧结果覆盖新结果。

## 统计口径

同一多选字段内采用 OR，不同字段之间采用 AND。省略 filter、空数组、空范围表示不限；数值范围包含两个端点，支持仅下限/仅上限。0 是有效边界。

启用某数值范围后，该字段为 NULL 的记录不满足范围。未开启范围时仍计入。维度去除前后空格；NULL/空白维度在结果中以 value:null 返回，页面标注「未填写」。国家和城市按清理后的原文匹配，区分大小写，不做语言、别名或地域合并；同名城市直接合为一组，若需要国家区分可同时使用国家筛选。

founded_year 按老师指定字段使用，表示成立年份，不推断实际加入供应链日期。收入沿用原数据单位，不做币种换算。百分比的分母为过滤后的公司总数，四舍五入保留两位。

筛选选项从全量公司生成，即便组合无结果也保留可选项和已选项，用户可以继续调整条件。

## 后端 API

`POST /dashboard/getCompaniesByFilter`，需要有效登录会话，响应 `Cache-Control: no-store`。通过 Next.js 代理访问时为 `/api/dashboard/getCompaniesByFilter`。

```json
{
  "dimension": "country",
  "filter": {
    "level": [2, 3],
    "country": ["China", "Japan"],
    "city": [],
    "founded_year": { "start": 1950, "end": 2000 },
    "annual_revenue": { "min": "1000.00", "max": "500000.00" },
    "employees": { "min": 100, "max": 1000 }
  }
}
```

返回 `dimension`、`total`、`groups: [{value,count,percentage}]`、`options: {level,country,city}`、`generatedAt`。`groups` 包含全部分组，分页只在前端呈现。

- level 接受数字或字符串并统一转字符串；country/city 必须为字符串。多选最多100项，去重，拒绝空白和控制字符。
- 年份为1000至悉尼当前年份的整数。员工为0至2,147,483,647的整数。
- 收入接受非负十进制字符串（推荐）或安全数值，最多18位整数、2位小数，与数据库 numeric(20,2) 一致。金额边界使用字符串传入数据库，比较顺序使用 BigInt 分值，保留大金额和分位精度。
- 拒绝不支持的维度、额外字段、错误类型、反向范围、非整数年份/员工和无效金额，返回400及字段错误。
- SQL 参数化绑定筛选值，维度通过固定白名单选择列；一条 SQL 同一快照完成过滤、聚合、总数和全量选项计算，不依赖公司列表的分页结果。
- API 为只读查询，不新增或修改公司。Swagger `/docs` 已增加请求、响应与过滤说明。

## 文件与验证

前端：`apps/web/components/dashboard/company-bars.tsx`、`apps/web/lib/company-bars.ts`；入口集成于现有 `dashboard.tsx`。
后端：`apps/api/src/dashboard/company-filter.ts`、`company-filter.dto.ts`、`dashboard.controller.ts`、`dashboard.service.ts`。
测试：`tests/company-bars.integration.mjs`，运行 `npm run test:company-bars`。
Postman：`postman/company-bars.postman_collection.json`。

已通过新增72项断言：空数据、三维度、多选OR/组合AND、六种条件同时生效、含端点/单边/零值范围、缺失值、相邻分值及大金额精度、超过20组、SQL注入作为普通参数、非法请求、登录校验、原始2000家公司独立计算对照，以及增删改后的动态结果。边界数据使用连接内临时表，不覆盖现有公司；接口测试仅创建并清理自身记录。

原有 Dashboard 53项断言回归通过。网页实际检查了维度切换、多选国家与范围组合、数据表、反向范围提示和清空筛选。代码保存在本地，未提交或发布。
