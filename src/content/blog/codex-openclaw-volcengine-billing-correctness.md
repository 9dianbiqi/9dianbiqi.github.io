---
title: "让云账单数据可信：Codex OpenClaw 的火山引擎账单重构"
description: "从重复累计和分页截断，到按费用日期同步、余额快照与可审计采集状态的完整改造。"
pubDate: 2026-07-10
articleLayout: guide
tags:
  - cloud-cost
  - volcengine
  - sqlite
  - python
draft: false
---

# 让云账单数据可信：Codex OpenClaw 的火山引擎账单重构

## 原有架构与问题

项目原本是一套轻量云用量监控链路：Kubernetes CronJob 在每天 10:00 和 18:00 触发 Python 采集器，采集器先经过运行前审查门禁，再调用火山引擎 `ListBillDetail`，把返回结果归一化为通用 `usage_samples` 记录并写入 SQLite。FastAPI Dashboard 只读 SQLite，HTMX、Alpine.js 和 Chart.js 负责筛选与图表；每周任务从同一张表生成 Markdown 周报。

```text
CronJob
  -> run_after_review.py
  -> ListBillDetail
  -> usage_samples
  -> Dashboard / weekly report
```

这套架构轻量、部署简单，前端不接触 AK/SK，Dashboard 也不直接访问云 API。但 `usage_samples` 是“观测采样”模型，不是“账单事实”模型。每次采集得到的是整个账期快照，如果不断追加后再求和，同一笔账单会被重复累计；`sampled_at` 表示采集时间，也不能代表费用真正发生的日期。

同时，`ListBillDetail` 不返回账户可用余额。此前 Dashboard 的“可用余额 / 未采集”是前端主动展示的说明，不是 API 报错。余额必须独立调用 `QueryBalanceAcct`。

## 方案一：领域表、余额快照与采集运行账本

本次采用“领域表 + 采集运行账本”的方案，保留 SQLite、CronJob 和只读 Dashboard，不引入消息队列或外部数据库。

```text
CronJob
  -> review gate
  -> billing collection orchestrator
       |-> ListBillDetail     -> billing_daily_costs
       |-> QueryBalanceAcct   -> account_balance_snapshots
       `-> collection_runs
  -> read-only Dashboard / weekly report
```

新增三类权威数据：

| 表 | 作用 |
| --- | --- |
| `billing_daily_costs` | 按账期和费用日期保存账单事实，账期同步采用原子替换 |
| `account_balance_snapshots` | 保存每次成功获取的余额快照，与账单事实解耦 |
| `collection_runs` | 记录请求账期、成功账期、账单状态、余额状态、错误摘要和切换状态 |

旧 `usage_samples` 不删除、不迁移覆盖，便于审计和回滚；但火山引擎 Dashboard 与周报在完成校验回填后只读取新表，避免把历史重复快照重新带回正式统计。

## 账单同步的正确性约束

### 完整分页与稳定读取

采集器调用 `ListBillDetail` 时显式发送 `NeedRecordNum=1`，并校验 `Total`、`Offset`、页内记录数和最终总记录数。配置中的单页 `limit` 被限制在 `1..300`。

每个账期会完整读取两次，并对规范化后的记录集合计算与顺序无关的摘要。只有两次摘要一致，才允许替换本地账期数据。这样可以避免分页过程中云端账单变化造成前后页来自不同快照。

### 原子账期替换

一个账期的旧数据删除、新数据插入、记录数核对以及按币种的应付/已付/未付合计核对，都在同一个 SQLite 事务中完成。任何一步失败都会回滚，旧的完整账期仍然保留。

账单金额以整数微单位保存：

```text
1 CNY = 1,000,000 micros
```

解析过程使用十进制元组和整数运算，不依赖进程中的 Decimal 精度上下文；超过六位小数、NaN 和 Infinity 会被拒绝。格式化为“元”只发生在 API 响应、HTML 或 Markdown 展示边界。

### 费用日期而非采集时间

每日趋势、周报统计窗口和账期明细均使用火山账单的 `ExpenseDate`。`collected_at` 只用于回答“这份数据什么时候同步”，不会再参与费用发生时间的计算。

## 余额采集与部分失败

余额通过独立的 `QueryBalanceAcct` 获取，保存可用余额、现金余额、信用额度、欠费余额和冻结金额。

账单和余额是两个独立提交单元。如果账单成功而余额失败，完整账单仍然提交；Dashboard 继续显示上一次成功余额，并标记为过期，同时展示最近任务为 `partial`。反过来，账单失败但余额成功时，余额快照也会保留。只要任一组件失败，任务就以非零状态退出，便于 CronJob 和告警系统发现问题。

错误只在运行账本中保存经过截断和脱敏的类型与摘要。凭据、授权头、私有文件路径、长账号 ID 等敏感内容不会写入错误字段。

## 回填、日常同步与安全切换

首次启用时执行当前月和前两个月的回填：

```powershell
python scripts/run_after_review.py backfill --months 3 --config config/config.yaml
```

只有三个账期与余额都成功，运行账本才会写入 `cutover_ready=1`。在此之前 Dashboard 返回明确的 `preparing`，不会悄悄回退到旧 `usage_samples`。

日常采集默认同步当前账期。每月前七个自然日按 `Asia/Shanghai` 时区额外同步上一个账期，以吸收月末迟到、退款和调整：

```powershell
python scripts/run_after_review.py collect --config config/config.yaml
```

回填月数限制为 `1..24`，月初宽限天数限制为 `0..28`，时区必须是有效 IANA 时区。

## Dashboard 与周报

Dashboard 继续使用 FastAPI + HTMX + Alpine.js + Chart.js，并只读打开 SQLite。完成切换后，它展示最新可用余额、掩码账号、余额新鲜度、最近任务状态、近三月应付/已付/未付金额、按费用日期的趋势、Top 产品和账单明细。

当前版本按需求保持无登录访问，但 Kubernetes Service 仍是 `ClusterIP`，适用于内网或 VPN。Dashboard 容器不挂载凭据，对 SQLite 和报告卷均为只读挂载，也不会调用火山 API。

周报保留“本周摘要、关键指标、成本 Top 资源、变化解读、风险与建议、数据说明”六段结构。火山引擎数据只在切换成功后读取 `billing_daily_costs`；mock 演示仍可使用旧采样路径。账号在报告中统一显示为前四位加后四位。

## 运行前门禁与验证

所有正式命令仍必须通过 `run_after_review.py`。门禁会检查配置和私有凭据来源、忽略规则、文档与部署文件中的敏感信息、Python 编译、完整单元测试，以及云 API 动作精确白名单。它还会使用假客户端完成三账期、余额、SQLite 和切换状态的 v2 冒烟测试，不访问真实云 API。

上线前完成了真实只读三账期回填。运行状态、账单状态和余额状态均成功，三个账期分别通过记录数与金额合计核对，余额账号仅以掩码形式验收，Dashboard 切换标志已生效。整个过程没有修改任何云资源。

## 结果

这次重构没有把轻量工具变成复杂平台，而是把最关键的数据语义补正确：账单是可替换、可核对的事实，余额是独立快照，采集过程有运行账本，展示层只消费验证后的本地数据。

最终边界仍然简单：一个只读采集任务、一个 SQLite 文件、一个无登录内网 Dashboard 和一份可审计周报；但重复累计、分页截断、费用日期混淆以及余额缺失这四类问题都有了明确的工程约束。
