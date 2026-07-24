---
title: "初学者指南：用 Git 分支和 Worktree 并行开发前后端功能"
description: "以两个前后端需求为例，讲清如何用 Git 分支和 Worktree 隔离并行开发、约定接口、处理冲突、安全合并与清理工作目录。"
pubDate: 2026-07-24
articleLayout: guide
tags:
  - Git
  - Worktree
  - 前端
  - 后端
  - 并行开发
  - 工程实践
readingTime: "约 12 分钟"
draft: false
---

# 初学者指南：用 Git 分支和 Worktree 并行开发前后端功能

当一个项目同时需要修改多个功能时，最容易遇到的问题不是代码不会写，而是不同任务互相覆盖、改乱，最后不知道哪些修改属于哪个功能。

本文用 Lumi 用量监控项目中的两个需求作为例子，说明如何使用 Git 分支和 Worktree，让两个功能并行开发，最后安全合并。

## 一、这次要开发什么

假设当前要同时实现两个功能：

### 功能 1：用户具体服务消耗历史检索

后端和前端需要一起调整：

- 使用只读 SQLite 连接。
- 使用参数化 SQL，避免把用户输入直接拼接到 SQL 字符串中。
- 按“用户 + 服务 + 场景 + 子场景 + 资源”聚合后再分页。
- 不能先查询并截取前 50 条，再在内存中分页。
- 使用北京时间自然日作为时间筛选口径。
- 支持用户筛选、服务筛选和关键词筛选。
- 支持点击查询，也可以使用防抖查询。
- 显示真实查询区间、总结果数和当前分页。
- 当数据覆盖不完整时显示明确警告，不能把部分数据伪装成完整账单。
- 固定的 7 日分析和比较指标继续保留。
- “用户具体服务消耗”改成独立的历史检索区域，默认查询最近 7 日，但允许修改时间范围。

### 功能 2：Lumi 业务图表驾驶舱

这个功能单独负责：

- 展示最近 30 天数据。
- 增加业务趋势图表。
- 增加适合管理和分析的指标卡、排行榜或对比图表。
- 使用稳定的数据接口，不直接依赖页面内部的临时状态。

## 二、分支和 Worktree 分别解决什么问题

可以把它们理解成两层隔离：

| 概念 | 解决的问题 | 初学者理解 |
| --- | --- | --- |
| 分支 branch | 代码版本如何保存和合并 | 一条独立的修改历史 |
| Worktree | 本地同时打开多个工作目录 | 同一个项目的多个文件夹 |

如果只创建两个分支，你仍然可以并行开发，但通常需要频繁切换目录：

```plaintext
修改功能 1 → git switch 功能 2 → 修改功能 2 → git switch 功能 1
```

如果使用两个 Worktree，就可以同时打开两个目录：

```plaintext
项目根目录/
├── .worktrees/usage-history/       # 功能 1
└── .worktrees/business-dashboard/  # 功能 2
```

每个目录对应一个分支，因此最适合并行开发。

## 三、推荐的分支结构

建议先准备一个集成分支 `develop`，两个功能从同一个起点创建：

```plaintext
main
└── develop
    ├── feature/usage-history-query
    └── feature/business-dashboard-30d
```

含义如下：

- `main`：已经验证，可以发布的版本。
- `develop`：用于合并和集成多个功能。
- `feature/usage-history-query`：功能 1 的开发分支。
- `feature/business-dashboard-30d`：功能 2 的开发分支。

如果项目目前没有 `develop` 分支，可以先使用 `main` 作为基础分支。初学者不必一开始就建立复杂的分支体系。

## 四、开始前先检查当前状态

在项目根目录打开 PowerShell，运行：

```powershell
git status
git branch --show-current
git worktree list
```

确认三件事：

1. 当前没有未保存的重要修改。
2. 你知道当前所在分支。
3. 没有已经存在的同名 Worktree。

如果 `git status` 显示有你正在进行的修改，不要直接创建分支覆盖它。可以先提交，或者先使用临时保存：

```powershell
git add .
git commit -m "保存当前工作进度"
```

## 五、创建两个 Worktree

先确认项目有 `develop` 分支。如果没有，可以创建：

```powershell
git switch -c develop
```

然后在项目根目录运行：

```powershell
git worktree add .worktrees/usage-history -b feature/usage-history-query develop
git worktree add .worktrees/business-dashboard -b feature/business-dashboard-30d develop
```

命令完成后可以检查：

```powershell
git worktree list
```

预期会看到类似结果：

```plaintext
项目根目录                       develop
项目根目录\.worktrees\usage-history       feature/usage-history-query
项目根目录\.worktrees\business-dashboard  feature/business-dashboard-30d
```

如果项目的 `.gitignore` 还没有忽略 `.worktrees`，请加入：

```plaintext
.worktrees/
```

Worktree 是本地工作目录，不应该被当成项目源码再次提交。

## 六、在两个目录中分别开发

### 6.1 功能 1：历史检索

进入功能 1 的目录：

```powershell
cd .worktrees/usage-history
```

建议按以下顺序实现：

#### 第一步：先定义接口返回结构

不要先写页面，再临时决定后端返回什么。可以先确定类似下面的结构：

```json
{
  "queryStart": "2026-07-01",
  "queryEnd": "2026-07-07",
  "timezone": "Asia/Shanghai",
  "total": 128,
  "page": 1,
  "pageSize": 20,
  "coverage": {
    "complete": true,
    "availableStart": "2026-06-01",
    "availableEnd": "2026-07-24",
    "message": null
  },
  "items": []
}
```

这里的 `coverage.complete` 很重要。查询区间没有完整数据时，前端必须显示警告，而不是只显示一个看起来很准确的金额。

#### 第二步：实现安全查询

查询条件使用参数化 SQL。示例：

```python
sql = """
SELECT user_name, service_name, scene, sub_scene, resource,
       SUM(amount) AS total_amount
FROM usage_daily
WHERE usage_date >= ?
  AND usage_date < ?
  AND (? IS NULL OR user_name = ?)
GROUP BY user_name, service_name, scene, sub_scene, resource
ORDER BY total_amount DESC
LIMIT ? OFFSET ?
"""

params = [start_date, end_date_exclusive,
          user_name, user_name,
          page_size, offset]
```

不要这样写：

```python
# 不推荐：把输入直接拼接进 SQL
sql = f"SELECT * FROM usage_daily WHERE user_name = '{user_name}'"
```

`LIMIT`、`OFFSET` 和筛选条件都应该经过类型校验。分页必须发生在聚合之后：

```plaintext
原始记录 → 条件筛选 → GROUP BY 聚合 → COUNT 总数 → LIMIT/OFFSET 分页
```

不能使用下面这种不完整方式：

```plaintext
原始记录 → 先取前 50 条 → 内存聚合 → 分页
```

因为这样会漏掉第 51 条之后的数据，结果不能代表真实账单。

#### 第三步：处理北京时间自然日

第一版只选择日期即可，例如：

```plaintext
开始日期：2026-07-01
结束日期：2026-07-07
```

后端应把它转换为半开区间：

```plaintext
[2026-07-01 00:00:00, 2026-07-08 00:00:00)
```

也就是包含 7 月 1 日，不包含 7 月 8 日。这样可以完整包含 7 月 7 日全天，并避免 `23:59:59` 带来的边界问题。

#### 第四步：实现前端查询区

前端至少应包含：

- 开始日期和结束日期。
- 用户筛选。
- 服务或关键词筛选。
- 查询按钮。
- 总结果数。
- 当前页码和总页数。
- 实际查询区间。
- 数据覆盖警告。

默认时间范围为最近 7 个北京时间自然日，但用户可以修改范围。

### 6.2 功能 2：30 天驾驶舱

进入功能 2 的目录：

```powershell
cd .worktrees/business-dashboard
```

建议按以下顺序实现：

1. 明确 30 天的开始日期和结束日期。
2. 确认图表所需的接口字段。
3. 先完成总量、趋势、服务分布等基础指标。
4. 再增加排行榜和同比或环比指标。
5. 对空数据、数据覆盖不全和接口失败做单独展示。

驾驶舱的 30 天统计不要复用“用户具体服务消耗”的分页接口。分页接口适合明细检索，驾驶舱更适合返回按日期、服务或用户聚合后的图表数据。

## 七、如何提交每个功能

功能 1 完成后：

```powershell
cd .worktrees/usage-history
git status
git add .
git commit -m "增加可筛选的用户服务历史检索"
```

功能 2 完成后：

```powershell
cd .worktrees/business-dashboard
git status
git add .
git commit -m "增加 Lumi 30 天业务图表驾驶舱"
```

建议一个提交只表达一个完整的逻辑修改，不要把两个功能混在同一个提交里。

## 八、如何合并两个功能

先回到项目根目录：

```powershell
cd ../..
```

切换到集成分支：

```powershell
git switch develop
```

先合并功能 1：

```powershell
git merge --no-ff feature/usage-history-query
```

再合并功能 2：

```powershell
git merge --no-ff feature/business-dashboard-30d
```

合并后运行完整测试，并手动检查：

- 历史检索是否真的支持任意日期范围。
- 查询是否使用北京时间自然日。
- 总数是否来自完整聚合结果。
- 分页是否发生在聚合之后。
- 覆盖不完整时是否显示警告。
- 驾驶舱是否显示最近 30 天数据。
- 两个功能是否能同时打开和使用。

## 九、遇到合并冲突怎么办

先查看冲突状态：

```powershell
git status
```

Git 会在冲突文件中标记：

```plaintext
 <<<<<<< HEAD
develop 分支的内容
 =======
功能分支的内容
 >>>>>>> feature/business-dashboard-30d
```

手动保留正确内容，删除这些标记，然后运行：

```powershell
git add 冲突文件路径
git commit
```

如果发现合并结果不对，可以在提交前取消这次合并：

```powershell
git merge --abort
```

初学者最常见的冲突文件是路由、公共组件、全局样式、接口类型和 `package.json`。两个功能开始前，最好先约定谁负责修改这些共享文件。

## 十、什么时候应该拆得更细

当前方案是两个功能各一个分支，已经适合大多数初学者。如果功能 1 的前端和后端也要交给两个人并行开发，可以进一步拆成：

```plaintext
develop
├── feature/usage-history-api
├── feature/usage-history-ui
└── feature/business-dashboard-30d
```

不过这时必须先写好 API 契约。否则前端和后端会同时修改同一个接口，合并时反而更复杂。

推荐顺序是：

1. 先定义接口字段和时间口径。
2. 后端实现接口并提供示例响应。
3. 前端使用示例响应开发页面。
4. 后端和前端分别测试。
5. 最后在集成分支联调。

## 十一、开发完成后删除 Worktree

确认分支已经合并，并且不再需要本地目录后，可以删除 Worktree：

```powershell
git worktree remove .worktrees/usage-history
git worktree remove .worktrees/business-dashboard
```

删除 Worktree 不会删除已经提交的分支。查看剩余分支：

```powershell
git branch
```

如果以后确认分支也不再需要，再删除分支：

```powershell
git branch -d feature/usage-history-query
git branch -d feature/business-dashboard-30d
```

## 十二、最终推荐方案

对于本次需求，最适合初学者的方案是：

```plaintext
功能 1：feature/usage-history-query + .worktrees/usage-history
功能 2：feature/business-dashboard-30d + .worktrees/business-dashboard
合并目标：develop
发布目标：main
时间口径：北京时间自然日
```

记住三条原则：

1. 一个功能一个分支。
2. 需要真正并行时，一个分支一个 Worktree。
3. 合并前先测试，合并后再做一次完整联调。
