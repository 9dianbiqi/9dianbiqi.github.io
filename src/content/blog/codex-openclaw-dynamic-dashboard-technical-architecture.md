---
title: "codex-openclaw 动态轻量 Dashboard 技术方案"
description: "基于 FastAPI、HTMX、Alpine.js、Chart.js、SQLite 和 Kubernetes CronJob 的轻量云账单 Dashboard 架构选型。"
pubDate: 2026-07-08
tags: ["Cloud", "Dashboard", "FastAPI", "Kubernetes", "SQLite"]
draft: false
readingTime: "约 9 分钟"
---

# codex-openclaw 动态轻量 Dashboard 技术方案

当前项目适合从“定时采集 + SQLite + Markdown 周报”升级为“定时采集 + SQLite + 动态只读 Dashboard”。推荐技术栈如下:

```text
Kubernetes CronJob
  -> Python collector
  -> SQLite PVC
  -> FastAPI Dashboard
  -> HTMX / Alpine.js / Chart.js
  -> 内网 Service / VPN
```

核心选型:

| 层级 | 技术 | 选择理由 |
|---|---|---|
| 调度 | Kubernetes CronJob | 与当前上云部署方向一致，适合固定时间账单采集 |
| 后端 Web | FastAPI + Uvicorn | 轻量、结构清晰、API 维护成本低，适合内部工具 |
| 前端交互 | HTMX + Alpine.js | 无需构建链路，比纯 HTML 更适合筛选和局部刷新 |
| 图表 | Chart.js | 足够支撑趋势图、Top 图，不引入重型 BI |
| 存储 | SQLite + PVC | 当前数据规模和写入频率低，单库只读 Dashboard 足够 |
| 权限 | 内网/VPN，不做应用登录 | 符合当前多人访问边界，避免过早引入账号体系 |

不建议当前阶段引入 React/Vue、独立数据库服务、消息队列、WebSocket 或完整 BI 平台。它们会明显增加复杂度，但对“运营同事查看成本、筛选账单、看趋势和 Top 资源”的收益有限。

## 架构目标

目标不是把项目改造成大型云管平台，而是在现有轻量采集链路旁边增加一个稳定、可访问、可筛选的内部 Dashboard。

目标能力:

- 运营同事可以通过内网或 VPN 浏览器访问。
- 不需要登录，不做用户体系。
- 支持按时间、服务、账号、资源筛选。
- 支持成本总览、趋势图、Top 服务、Top 资源、明细表。
- Dashboard 只读访问 SQLite。
- Dashboard 不读取云凭证，不调用云 API。
- 采集任务继续走运行前审查门禁。
- K8s 中采集 CronJob 和 Dashboard Deployment 共享 PVC。

## 当前系统边界

当前项目已经具备:

```text
scripts/run_after_review.py
  -> review_gate
  -> volcengine_billing provider
  -> usage_samples
  -> weekly_summary
  -> Markdown report
```

现有数据表 `usage_samples` 已经能表达 Dashboard 第一版所需数据:

| 字段 | Dashboard 用途 |
|---|---|
| `provider` | 数据源筛选 |
| `account_id` | 账号筛选 |
| `service_name` | 产品/服务筛选与 Top 服务 |
| `resource_id` | 资源搜索与明细 |
| `resource_name` | 资源展示与搜索 |
| `metric_name` | 当前主要使用 `cost` |
| `metric_value` | 成本计算 |
| `unit` | 币种或单位 |
| `sampled_at` | 时间范围和趋势 |
| `tags_json` | 账单补充字段 |

因此第一版 Dashboard 不需要新建复杂业务表，直接在 `usage_samples` 上做只读聚合即可。

## 推荐目标架构

```text
                  ┌──────────────────────────┐
                  │ Kubernetes CronJob        │
                  │ 10:00 / 18:00 collect     │
                  └─────────────┬────────────┘
                                │
                                v
                  ┌──────────────────────────┐
                  │ run_after_review.py       │
                  │ review gate + collect     │
                  └─────────────┬────────────┘
                                │
                                v
                  ┌──────────────────────────┐
                  │ SQLite on PVC             │
                  │ /app/work/usage.db        │
                  └─────────────┬────────────┘
                                │ read-only
                                v
┌───────────────┐  HTTP   ┌──────────────────────────┐
│ Browser       ├────────>│ FastAPI Dashboard         │
│ 内网/VPN 用户 │<────────┤ HTMX fragments + JSON API │
└───────────────┘         └──────────────────────────┘
```

组件关系:

- CronJob 是唯一的周期性写入入口。
- Dashboard 是常驻只读服务。
- SQLite 作为轻量状态存储。
- Markdown 周报继续保留，Dashboard 可以提供查看或下载入口。
- 内网/VPN 是访问控制边界。

## FastAPI 选型理由

FastAPI 比标准库 HTTP Server 更适合给运营同事长期使用，原因在于:

1. 路由结构清晰  
   Dashboard 会自然拆成 `/api/summary`、`/api/trend/daily`、`/api/top/resources`、`/api/samples` 等接口。FastAPI 能让这些 API 保持清楚边界。

2. 参数校验更自然  
   时间范围、分页、服务名、资源搜索都需要参数校验。FastAPI 的请求参数模型比手写解析更稳。

3. 错误处理更友好  
   空数据、参数错误、数据库不可读、报告不存在等情况可以统一返回清晰状态。

4. K8s 部署更标准  
   FastAPI + Uvicorn 可以提供 `/healthz`，方便 readinessProbe 和 livenessProbe。

5. 仍然足够轻  
   只新增 `fastapi` 和 `uvicorn`，不需要引入大型后端框架。

FastAPI 在这里不是为了追求“高级”，而是为了让内部 Dashboard 更容易维护。

## HTMX / Alpine.js 选型理由

Dashboard 的交互需求主要是筛选、局部刷新、分页和图表更新，不需要复杂前端状态管理。

HTMX 适合:

- 筛选条件变化后刷新指标区。
- 刷新 Top 表。
- 刷新明细表。
- 分页时只替换表格区域。

Alpine.js 适合:

- 控制加载状态。
- 控制筛选面板展开/收起。
- 保存当前筛选条件。
- 处理少量前端状态。

这种组合的优势是:

- 没有 npm 前端构建链路。
- 页面源码容易读。
- 运维成本低。
- 比纯 HTML 表单体验好。
- 比 React/Vue 更符合当前轻量目标。

## Chart.js 选型理由

运营同事需要看的图表主要是:

- 每日成本趋势
- 产品成本占比
- Top 服务柱状图
- Top 资源柱状图

Chart.js 足够覆盖这些需求。相比 ECharts，它更轻；相比手写 SVG，它维护成本更低。

建议将 Chart.js 本地 vendored 到仓库，避免内网环境依赖 CDN。

## 后端模块设计

建议新增模块:

```text
cloud_usage_monitor/dashboard_queries.py
cloud_usage_monitor/dashboard_server.py
scripts/serve_dashboard.py
```

### dashboard_queries.py

职责:

- 管理只读 SQLite 连接。
- 封装 Dashboard 所有 SQL。
- 接收统一筛选参数。
- 返回结构化 dict/list。

核心查询:

```text
summary(filters)
daily_trend(filters)
top_services(filters)
top_resources(filters)
sample_rows(filters)
filter_options()
latest_sample_time()
```

筛选参数:

```text
start_date
end_date
account_id
service_name
resource_query
limit
offset
```

### dashboard_server.py

职责:

- 创建 FastAPI app。
- 挂载静态资源。
- 返回主页面。
- 暴露 Dashboard API。
- 暴露健康检查。

推荐路由:

```text
GET /healthz
GET /
GET /api/summary
GET /api/trend/daily
GET /api/top/services
GET /api/top/resources
GET /api/samples
GET /api/filter-options
GET /reports/latest
```

### serve_dashboard.py

职责:

- 读取项目配置。
- 从配置得到 SQLite 路径和报告目录。
- 启动 Uvicorn。

示例命令:

```powershell
python scripts\serve_dashboard.py --config config\config.yaml --host 0.0.0.0 --port 8780
```

## API 设计

### GET /api/summary

返回总览指标:

```json
{
  "total_cost": 12345.67,
  "current_week_cost": 2345.67,
  "previous_week_cost": 2100.0,
  "wow_change_percent": 11.7,
  "sample_count": 320,
  "latest_sampled_at": "2026-07-08T10:00:00Z"
}
```

### GET /api/trend/daily

返回按天聚合的成本:

```json
{
  "items": [
    {"date": "2026-07-01", "cost": 123.45},
    {"date": "2026-07-02", "cost": 156.78}
  ]
}
```

### GET /api/top/services

返回服务成本排行:

```json
{
  "items": [
    {"service_name": "云服务器", "cost": 888.88, "share_percent": 18.5}
  ]
}
```

### GET /api/top/resources

返回资源成本排行:

```json
{
  "items": [
    {
      "service_name": "云服务器",
      "resource_id": "resource-id",
      "resource_name": "prod-api",
      "cost": 888.88,
      "share_percent": 18.5
    }
  ]
}
```

### GET /api/samples

返回明细表:

```json
{
  "items": [],
  "limit": 50,
  "offset": 0,
  "has_more": false
}
```

## 前端页面结构

页面建议保持内部工具风格，信息密度适中，不做营销式布局。

```text
顶部栏
  - 标题
  - 数据更新时间
  - 服务健康状态

筛选区
  - 时间范围
  - 服务选择
  - 账号选择
  - 资源搜索

指标区
  - 总成本
  - 本周成本
  - 环比
  - 采样数

图表区
  - 每日成本趋势

排行区
  - Top 服务
  - Top 资源

明细区
  - 账单采样明细
  - 分页

报告区
  - 最新周报查看/下载
```

## SQLite 只读设计

Dashboard 必须使用独立只读连接，不复用当前 `db.connect()`。

推荐连接方式:

```text
file:/app/work/usage.db?mode=ro
```

连接后设置:

```sql
PRAGMA query_only = ON;
```

安全边界:

- 不提供任意 SQL 输入。
- 所有查询由代码内置。
- 所有筛选参数使用参数化 SQL。
- Dashboard 容器挂载 `/app/work` 时建议只读。
- Dashboard 不创建数据库文件。

## Kubernetes 部署拓扑

当前已有:

```text
ConfigMap
PVC
CronJob collect-1000
CronJob collect-1800
CronJob weekly-report
```

新增:

```text
Deployment cloud-usage-dashboard
Service cloud-usage-dashboard
```

推荐拓扑:

```text
cloud-usage-data PVC
  ├─ work/usage.db
  └─ outputs/reports/

CronJob collect
  └─ mount PVC read-write

CronJob weekly-report
  └─ mount PVC read-write

Dashboard Deployment
  └─ mount PVC read-only
```

Service:

```text
type: ClusterIP
port: 8780
```

访问方式:

- VPN 后访问内部 Service。
- 或通过已有内网网关转发。
- 不直接暴露公网。

## 容器设计

当前容器主要服务批处理脚本。升级后同一个镜像可同时支持:

```text
collect task
weekly report task
dashboard server
```

需要新增:

```text
requirements.txt
cloud_usage_monitor/dashboard_assets/
```

依赖:

```text
fastapi
uvicorn
```

静态前端资源建议 vendored:

```text
htmx.min.js
alpine.min.js
chart.umd.js
dashboard.css
dashboard.js
```

这样内网环境不依赖 CDN。

## 安全模型

本方案的安全边界是“网络边界 + 应用只读”。

网络边界:

- 只允许内网/VPN 访问。
- 不做公网暴露。
- 不做应用登录。

应用边界:

- Dashboard 不读凭证文件。
- Dashboard 不调用云 API。
- Dashboard 不写 SQLite。
- Dashboard 不提供 SQL 控制台。
- Dashboard 只展示成本和资源摘要。

调度边界:

- 采集任务继续通过 `run_after_review.py`。
- 真实采集仍受门禁阻断策略保护。
- 没有凭证时，不会误跑火山 API。

## 运维模型

健康检查:

```text
GET /healthz
```

建议检查:

- SQLite 文件可读。
- 最近一次采样时间可查询。
- 报告目录可读。

日志:

- Uvicorn access log
- Dashboard 查询错误日志
- CronJob 采集日志
- review gate 输出

容量:

- SQLite 当前适合轻量账单数据。
- 查询接口限制分页大小。
- Top 和趋势查询优先基于索引字段。

备份:

- 继续备份 PVC 中的 `work/usage.db`。
- 周报文件保留在 `outputs/reports`。

## 扩展边界

如果未来需求增长，可按顺序扩展:

1. 增加 CSV 导出。
2. 增加异常成本规则。
3. 增加报告下载中心。
4. 增加运行历史表。
5. 增加 SSO 或网关认证。
6. 数据量变大后，再从 SQLite 迁移到 PostgreSQL。

不建议一开始直接做:

- 多租户权限
- 在线编辑和备注
- WebSocket 实时推送
- 大型前端 SPA
- BI 平台级报表

## 技术验收标准

架构落地后应满足:

- Dashboard 服务可在 K8s 中常驻运行。
- 多人可通过内网/VPN 浏览器访问。
- 页面支持时间、服务、账号、资源筛选。
- API 只读查询 SQLite。
- Dashboard 不读取凭证文件。
- Dashboard 不调用火山 API。
- Dashboard 不写 SQLite。
- CronJob 采集和周报继续可用。
- 所有现有测试继续通过。
- 新增 Dashboard 查询和 API 测试通过。

## 最终判断

这个项目当前最适合的动态化方向不是重构成完整平台，而是增加一个轻量只读 Dashboard 服务。

最终形态:

```text
采集写入由 CronJob 负责
数据存储继续使用 SQLite
运营访问通过 FastAPI Dashboard
前端交互使用 HTMX / Alpine.js
图表使用 Chart.js
安全依赖内网/VPN 和只读设计
```

这个方案既能满足运营同事多人访问和筛选，又不会破坏当前项目“轻量、可审查、只读、可回滚”的核心优势。

