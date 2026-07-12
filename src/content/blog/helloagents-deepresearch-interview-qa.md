---
title: "HelloAgents DeepResearch 严格技术面试 QA"
description: "围绕 helloagents-deepresearch 项目的技术选型、核心架构、Agent 编排、SSE 流式通信、Harness 治理层和生产化风险整理的一份深挖式面试问答。"
pubDate: 2026-07-12
heroImage: "/media/home/hero-poster.jpg"
heroAlt: "HelloAgents DeepResearch 技术面试问答"
tags: ["Agent", "FastAPI", "Vue", "SSE", "架构设计", "技术面试"]
readingTime: "约 10 分钟"
draft: false
---

这篇文章基于 `helloagents-deepresearch` 项目整理，面试风格偏严格，会追问到真实代码里的设计取舍，而不是只停留在框架名词层面。

项目大体是一个本地深度研究助手：用户输入 topic，后端生成计划、执行搜索、总结资料并输出 Markdown 报告。技术栈是 FastAPI + Vue 3 + Vite，Agent 编排基于 `hello-agents==0.2.9`。

## 一、技术选型

### Q1：为什么后端选择 FastAPI，而不是 Flask 或 Django？

**A：** 这个项目的后端核心是 API + 长耗时研究任务 + SSE 流式输出。FastAPI 原生支持 Pydantic 请求模型和 `StreamingResponse`，适合定义 `/research/stream` 这种结构化流式接口。

Django 对当前本地工具型应用偏重，Flask 又需要额外补类型校验、OpenAPI 和流式能力。

**追问点：** FastAPI 只是 HTTP 层选择，并不会自动解决任务取消、超时、队列和资源隔离。当前这些仍主要由 `HarnessRunner`、线程和 generator 手动处理。

### Q2：为什么使用 `hello-agents==0.2.9`？

**A：** 项目把 `hello-agents` 当作能力库，而不是完整应用框架。它提供：

- `HelloAgentsLLM`：统一 LLM provider。
- `ToolAwareSimpleAgent`：封装 Planner、Summarizer、Reporter。
- `SearchTool`：屏蔽 DuckDuckGo、Tavily、Perplexity、SearXNG 等搜索后端差异。

业务编排仍由自己的 `DeepResearchAgent` 控制。

### Q3：为什么前端选 Vue 3 + Vite？

**A：** 前端是单页面研究工作台，主要复杂度是响应式状态和 SSE 事件驱动 UI。Vue 3 Composition API 适合组织这些状态，Vite 启动快、配置轻，适合本地工具。

**追问点：** 当前 `App.vue` 过大，真正的问题不是 Vue，而是组件边界没有拆开。

### Q4：为什么用文件系统存 notes、cache、harness run，而不是数据库？

**A：** 本项目偏本地 deep research assistant，文件系统零依赖、可读、易调试，也方便和 Obsidian 一类笔记库联动。

但生产化会遇到并发写入、查询索引、权限隔离、历史清理和多用户问题，应迁移 run、event、cache metadata 到 SQLite 或 Postgres。

## 二、核心架构

### Q5：一次研究请求的主链路是什么？

**A：** 前端提交 topic 到 `/research/stream`，FastAPI 将请求转换成 `HarnessRunRequest`，`HarnessRunner` 做 policy、event、evaluation、persistence 包装，`DeepResearchAgent` 执行 plan -> search -> summarize -> report，后端通过 SSE 推送进度事件，前端增量更新 UI。

### Q6：`HarnessRunner` 和 `DeepResearchAgent` 的边界是什么？

**A：** `DeepResearchAgent` 是研究执行层，负责规划、搜索、摘要、报告和笔记。`HarnessRunner` 是治理层，负责权限策略、事件记录、上下文压缩、质量评估、持久化和多轮追问上下文加载。

**追问点：** streaming 路径里的 `_ingest_stream_event()` 需要理解 agent 事件类型，说明两层之间存在隐式事件协议耦合。

### Q7：为什么 Harness 是治理层，不是第二套业务流程？

**A：** Harness 不重新实现研究逻辑，只是在研究执行前后插入控制逻辑：

```text
request -> policy -> DeepResearchAgent -> compression -> evaluation -> persistence
```

它更像外观层或装饰层，让研究过程可审计、可回放、可评估。

### Q8：同步 `/research` 和流式 `/research/stream` 有什么风险？

**A：** 同步接口走 `agent.run()`，流式接口走 `agent.run_stream()`。两者都有 plan/search/summarize/report，但实现路径分开，未来容易出现行为漂移。

更稳的方式是抽象统一执行核心，让同步路径只是消费事件后聚合结果。

## 三、Agent 编排

### Q9：系统有哪些 Agent 或类 Agent 组件？

**A：** Planner 生成 TODO；Summarizer 生成单任务摘要；Reporter 汇总最终报告；NoteSubAgent 封装 NoteTool；DeepResearchAgent 是编排器。

### Q10：为什么 Summarizer 使用 factory 每次创建新 agent？

**A：** `run_stream()` 会为多个任务启动线程并行执行。如果共享一个 summarizer agent，容易出现上下文历史污染和线程安全问题。factory 能保证每个任务拿到独立 agent 实例。

### Q11：为什么关闭 `enable_tool_calling`？

**A：** 当前项目选择由代码固定触发搜索和笔记写入，让 LLM 只输出 JSON 或 Markdown。

好处是输出更确定、前端更好解析、token 成本更低；代价是模型无法自主决定补充搜索或调用工具。

### Q12：Planner 输出 JSON 不规范怎么办？

**A：** `PlanningService` 会从文本中截取 JSON object 或 array 并解析。如果失败，则返回空任务，由 `DeepResearchAgent` 创建 fallback task。

这个做法能兜底，但较脆弱。生产上应加 schema 校验、结构化输出约束和 planner 重试。

## 四、搜索、缓存与可靠性

### Q13：搜索层如何支持多后端？

**A：** `SearchAPI` 枚举支持 DuckDuckGo、Tavily、Perplexity、SearXNG、Advanced。`dispatch_search()` 调用 `SearchTool(backend="hybrid")`，传入具体 backend、结构化模式、全文抓取开关和结果限制。

### Q14：搜索失败时如何降级？

**A：** 单 backend 有重试和退避；如果主 backend 不是 DuckDuckGo，会 fallback 到 DuckDuckGo；全部失败则返回空结果和 notice，而不是让整个 run 直接崩溃。

**追问点：** 这保证尽量产出，但也可能生成低置信度报告。最终报告应显式说明搜索失败、来源不足和置信度。

### Q15：缓存策略有什么问题？

**A：** 缓存 key 包含 query、search_api、fetch_full_page，但没有包含 `max_results`、`max_tokens_per_source`、cache version，也没有区分新闻类与稳定知识类查询。

对时间敏感问题来说，这可能返回过期结果。

### Q16：质量门禁可靠吗？

**A：** 当前质量门禁只检查摘要是否为空、是否太短、是否有 Markdown 结构。它能拦明显坏结果，但不能判断事实准确性、来源可信度或幻觉。

更强的方案应包含 citation coverage、source quality scoring 和 LLM-as-judge。

## 五、并发、状态与取消

### Q17：任务并行怎么实现？

**A：** `run_stream()` 为每个 TodoItem 创建 daemon thread。worker 执行 `_execute_task()`，把事件写入 `Queue`，主 generator 消费 queue 并 yield SSE。

### Q18：线程安全如何保证？

**A：** 用 `Lock` 保护 `research_loop_count` 和共享列表追加。每个任务对象基本由自己的线程修改，所以冲突较少。

潜在风险包括 `_GLOBAL_SEARCH_TOOL` 是否线程安全未知、`_last_search_notices` 是共享字段、NoteTool 文件写入也可能有并发问题。

### Q19：为什么不用 asyncio？

**A：** 当前 hello-agents、SearchTool、LLM 调用偏同步，用线程集成成本低。但线程不利于取消、限流和高并发。

### Q20：前端取消后，后端任务真的停了吗？

**A：** 不完全。前端 `AbortController` 断开 fetch，但后端已启动的线程和 LLM/search 请求未必停止。当前缺少贯穿全链路的取消令牌。

## 六、SSE 与前端工程

### Q21：为什么用 SSE，不用 WebSocket？

**A：** 当前主要是服务端单向推送研究进度，SSE 简单、HTTP 友好、浏览器可直接消费。WebSocket 更适合双向控制，如暂停、恢复、人工审批 tool call。

### Q22：前端如何消费 SSE？

**A：** 前端用 `fetch` 读取 `ReadableStream`，用 `TextDecoder` 增量解码，按 `\n\n` 切分 frame，再解析 `data:` 后面的 JSON，根据事件类型更新 Vue 状态。

### Q23：前端最大工程问题是什么？

**A：** `App.vue` 是巨型组件，建议拆成：

- `useResearchStream()`。
- `useResearchReducer()`。
- `TaskList.vue`。
- `TaskDetail.vue`。
- `SourcePanel.vue`。
- `ReportPanel.vue`。
- `EventTimeline.vue`。

### Q24：Markdown 渲染有什么安全风险？

**A：** LLM 输出是不可信输入，`marked` 渲染 Markdown 时必须严格 sanitize，限制 `<script>`、`on*` 属性、`javascript:` 链接、iframe/object/embed 等。

## 七、Harness 治理层

### Q25：`HarnessPolicy` 是什么模型？

**A：** 它是 capability-based policy。一次 run 可能需要 `research:run`、`search:web`、`report:export`、`search:premium`、`github:read`、`notes:read`、`notes:write`。返回结果是 `allow`、`deny`、`ask`。

### Q26：多轮追问如何实现？

**A：** `/research/continue/stream` 传入 `parent_run_id`，Harness 从上一轮 run record 取 `compressed_context.reasoning_memory`，注入 Planner prompt，避免重复研究并聚焦 open questions。

### Q27：`ContextCompressor` 有什么局限？

**A：** 当前压缩主要是截断摘要、来源和报告片段，不是真正语义压缩。它不保证保留最关键事实，也不保证来源引用完整。

### Q28：`RuleBasedEvaluator` 能代表研究质量吗？

**A：** 不能。它只检查流程完整性。真正质量还要评估事实准确性、来源可信度、引用覆盖率、时效性和用户目标匹配度。

## 八、GitHub Research 特殊路径

### Q29：系统如何识别 GitHub 仓库研究？

**A：** `parse_github_repository()` 支持 GitHub URL 和 `owner/repo` shorthand。识别成功后，会启用 GitHub API context collection。

### Q30：GitHub research 收集哪些信息？

**A：** 包括 repository metadata、README excerpt、repository tree、languages、contributors、commits、issues、pull requests、releases，并注入后续 summarizer/reporter 上下文。

### Q31：GitHub API 失败怎么办？

**A：** 失败会记录 notice，并构造带 notices 的 `GitHubRepositoryContext`，不会直接中断研究流程。但最终报告应显式说明 GitHub API 是否受限、是否缺失 README/tree/releases 等信息。

## 九、测试与生产化

### Q32：当前测试覆盖了哪些方面？

**A：** 已覆盖 policy、harness API、GitHub research、evaluator、agent GitHub stream 等。但还缺前端组件测试、SSE 断流测试、搜索 fallback 测试、LLM 输出异常测试、并发和取消测试。

### Q33：生产化第一批改造是什么？

**A：** 用户鉴权、CORS 白名单、数据库持久化、任务队列、取消暂停恢复、稳定 SSE schema、LLM/search 成本统计、Markdown XSS 防护、citation coverage 和质量评估。

### Q34：当前架构最大亮点是什么？

**A：** 研究执行层和治理层分离清晰。`DeepResearchAgent` 负责业务编排，`HarnessRunner` 负责 policy、event、evaluation、compression、persistence。

### Q35：当前架构最大风险是什么？

**A：** LLM 输出解析脆弱、线程取消不可控、文件系统持久化难支撑多用户、SSE schema 没有集中定义、质量评估只能判断流程完整性、前端单文件组件过大。

## 十、面试官加压追问清单

- 如果一个 task 卡死，整个 run 如何超时退出？
- 如果 Reporter 失败，是否应该返回 task summaries？
- 如何避免 Planner 生成重复任务？
- 如何处理多个来源互相冲突？
- Perplexity answer 和网页 sources 冲突时信谁？
- `_GLOBAL_SEARCH_TOOL` 是否线程安全？
- 用户取消后后台还在跑，如何修？
- Markdown chunk 增量渲染是否有性能风险？
- `ask` policy 未来如何接人工审批？
- compressed context 如何避免污染下一轮研究？
- run record 是否包含敏感信息，如何脱敏？

## 总结

这个项目的核心不是“调用大模型做总结”，而是把一个不稳定的研究过程工程化为可计划、可观测、可追问、可记录、可评估的运行系统。
