---
title: "DeepSeek Harness 技术架构：从插件树到 Agent Loop"
description: "系统拆解 DeepSeek 官方 DeepSeek Harness：Cordis 插件运行时、Profile 与 Bundle、Agent Turn/Step、Session 事件溯源、工具管线和 DeepSeek LLM 适配器。"
pubDate: 2026-08-14
articleLayout: guide
tags:
  - DeepSeek
  - Agent
  - Harness
  - Architecture
  - TypeScript
  - Cordis
readingTime: "约 20 分钟"
draft: false
---

# DeepSeek Harness 技术架构：从插件树到 Agent Loop

我最近下载并阅读了 DeepSeek 官方开源的 DeepSeek Harness（简称 dsh）。它最值得学习的地方，不是“如何把一个模型 API 接成聊天窗口”，而是如何把一个可执行 Agent 拆成插件、事件、能力接口和持久化事实。

如果只把 Agent 理解成下面这段循环，很容易低估真正的工程复杂度：

~~~python
while True:
    response = model(messages, tools)
    if response.has_tool_calls:
        execute_tools(response.tool_calls)
        messages.append(tool_results)
        continue
    return response.text
~~~

真实产品还需要处理权限、沙箱、取消、重试、上下文压缩、子 Agent、后台任务、会话恢复、UI 投影、配置热更新和多种模型 Provider。DeepSeek Harness 的架构目标，就是让这些能力能够组合、替换和回放。

官方仓库：[deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness)。

> 本文基于 2026-08-13 的仓库代码整理。项目仍处于 Developer Preview 阶段，官方明确提示会出现兼容性破坏变更。本文适合架构学习和源码阅读，不应当被视为长期稳定 API 文档。

## 一、先建立正确的心智模型

DeepSeek Harness 不是一个只包含 Agent 类的 SDK，而是一套可以运行多种 Agent 表面的 Harness Runtime：

- Web UI：适合交互式编码和会话管理。
- Headless：接收一次任务，执行后输出结果。
- ACP：面向编辑器或自动化客户端的协议服务。
- Python/TypeScript SDK：供其他程序组合 Agent 能力。
- Plugin：通过 Cordis 配置把新能力挂载到运行时。

它的核心思想可以概括为：

> Agent Loop 负责推进控制流，插件负责提供能力，Session Log 负责记录事实，Profile 负责决定哪些插件进入运行时。

~~~mermaid
flowchart TD
    U["用户输入"] --> S["Web / Headless / ACP / SDK"]
    S --> B["Profile + Bundle + Patch"]
    B --> C["Cordis Context"]

    C --> CORE["核心骨架"]
    CORE --> A["Agent + Agent Loop"]
    CORE --> L["Session Event Log"]
    CORE --> P["System Prompt"]
    CORE --> T["Tool Registry"]
    CORE --> M["LLM Runtime"]

    C --> CAP["可替换能力"]
    CAP --> D["DeepSeek LLM Adapter"]
    CAP --> F["Filesystem / Shell / Sandbox"]
    CAP --> G["Subagent / Jobs / Workflow"]
    CAP --> K["Skills / Compaction / Context"]

    A --> L
    P --> A
    T --> A
    M --> A
~~~

这张图表达的是装配关系，不是一次模型请求的全部时序。运行中的 dsh 是一棵插件树：Loader 读取配置，插件在满足依赖后被挂载；插件向共享 Context 注册 Service、Event Listener、Tool、Prompt Section 或其他可撤销资源。

## 二、Cordis：插件运行时的基础

### 1. Context 和 Service

Cordis 的 Context 可以理解成一个带生命周期的 Service 容器。插件不应该直接依赖某个具体实现，而是依赖一个稳定的 ctx Service：

| Service | 作用 |
| --- | --- |
| ctx.sessions | Session 事件日志和内存 Session Store |
| ctx.systemPrompt | 系统提示词、工具 Schema 和变量的组装 |
| ctx.tools | 工具注册、权限和执行管线 |
| ctx.agents | Agent 接口、活动 Agent 注册表和 agent 事件 |
| ctx.agentLoop | 默认的具体 Agent Loop 驱动器 |
| ctx.llm | LLM Adapter 注册表与流式调用入口 |
| ctx.fs | 文件系统能力 |
| ctx.shell | Shell 执行能力 |
| ctx.sandbox | 进程和文件效果限制能力 |

插件用 inject 声明依赖：

~~~ts
import type { Context } from '@deepseek-ai/cordis'

export const name = 'my-tool-plugin'
export const inject = ['tools']

export function apply(ctx: Context) {
  // apply 执行时，ctx.tools 已经可用。
}
~~~

Loader 会等待依赖 Service 出现后再调用 apply。因此插件的装载顺序主要由 Service 依赖决定，而不是由 YAML 中的视觉顺序决定。

### 2. Event 是扩展点

dsh 里的很多扩展行为不是通过修改 Agent Loop 实现，而是通过监听类型化 Event：

| 分发模式 | 是否等待 | 是否有返回值 | 典型用途 |
| --- | ---: | ---: | --- |
| emit | 否 | 否 | 普通观察通知 |
| waterfall | 是流程结果 | 是 | 中间件、改写请求、拦截决策 |
| parallel | 是 | 否 | 并行观察者 |
| serial | 是 | 是 | 有顺序的决策流程 |

Waterfall 是最值得掌握的模式。监听器拿到 next()，调用它才会把控制权交给后续监听器；不调用就会短路：

~~~ts
ctx.on('some/event', (value, next) => {
  // 修改 value 或记录观察信息
  return next()
})
~~~

权限策略、模型请求改写、工具结果处理和 LLM 流包装都可以使用这个机制。

### 3. Effect 保证卸载清理

通过 Context 注册的监听器、工具和定时器会绑定到插件生命周期。显式资源则使用 ctx.effect() 返回 disposer：

~~~ts
export function apply(ctx: Context) {
  ctx.effect(() => {
    const timer = setInterval(() => {
      console.log('heartbeat')
    }, 5000)

    return () => clearInterval(timer)
  })
}
~~~

插件卸载时，Cordis 会撤销这些注册。这个机制对 HMR、Profile 重载、动态插件挂载和 Agent 作用域销毁非常重要。

### 4. 类型声明不等于运行时注册

Cordis 使用 TypeScript Declaration Merging 扩展 Context 和 Event Map：

~~~ts
declare module '@deepseek-ai/cordis' {
  interface Context {
    greeter: GreeterService
  }
}
~~~

这只增加类型层面的可见性，不会自动创建运行时 Service。插件仍然必须显式提供 Service、注册 Event 或挂载实现。

## 三、Profile、Bundle 与 Patch

### 1. 三个概念

- **Profile**：命名的应用组合，例如 web、headless。它列出要叠加的 Bundle，并保存用户层配置。
- **Bundle**：可分发的 Cordis 配置层，通常由 cordis.patch.yml 和它要挂载的运行时代码组成。
- **Patch**：按照行 ID 修改插件树，可以插入新行，也可以替换某行的完整配置。

配置覆盖顺序大致是：

~~~text
空的插件入口
  → Profile 中列出的 Bundle
  → Profile 自己的 cordis.patch.yml
  → Harness Home 层配置
  → 命令行 --patch 覆盖层
~~~

Patch 命中同一个 id 时，会替换这一行的整个 config，不是深度合并。因此修改某一行时，必须重新写出要保留的字段。

可以使用下面的命令观察机器真正会启动的插件树：

~~~bash
dsh --profile web --dump-config
~~~

### 2. Base、Web 和 Headless

dsh-base 是所有 Profile 的基础层，提供：

- LLM、Session、系统提示词、工具和 Agent 核心。
- DeepSeek 适配器、Settings、Credentials 和 Session 持久化。
- Shell、Filesystem、Subprocess、Sandbox 和 Approval。
- Skills、Compaction、Subagent、Jobs、Workflow、Todo 和 Plan。
- 默认权限策略和遥测入口。

dsh-web-app 在 Base 上增加 Web Server、API Gateway、Workspace、Storage、浏览器插件清单和 Web UI。

dsh-headless 在 Base 上增加一次性任务参数解析和 Headless Runner，但不加载 HTTP Server 或浏览器插件。

Bundle 的价值在于：它只描述“哪些插件以什么配置进入树”，真正的行为仍由插件自己提供。上层可以替换模型、工具、沙箱或 UI，而不需要复制整个启动流程。

## 四、Agent Loop：Turn、Step 和模型请求

### 1. 两级循环

- **Step**：一次模型请求，以及模型这次请求产生的工具调用。
- **Turn**：从输入被接纳开始，到没有待处理工作或被终止为止的一组 Step。

一个 Turn 可能只有一个 Step，也可能因为工具结果或 Steering 继续进入多个 Step。

### 2. 一次 Turn 的主流程

~~~mermaid
sequenceDiagram
    participant Input as 用户或 Agent API
    participant Loop as Agent Loop
    participant Prompt as systemPrompt
    participant LLM as ctx.llm
    participant Tools as ctx.tools
    participant Session as ctx.sessions

    Input->>Loop: followup / steer / inject
    Loop->>Session: turn/start
    Loop->>Loop: claim inbox
    Loop->>Loop: agent/pre-step

    alt 被拒绝或消息为空
        Loop->>Session: turn/end（无 step）
    else 进入 Step
        Loop->>Session: step/start + user/message
        Loop->>Prompt: assemble prompt + tool schemas
        Loop->>LLM: agent/request → llm/stream
        LLM-->>Loop: StreamChunk*
        Loop->>Session: assistant/chunk* + assistant/message
        Loop->>Session: tool/call*
        Loop->>Tools: pre → execute → post
        Tools-->>Loop: tool/result*
        Loop->>Session: step/end
        Loop->>Loop: 有待处理消息则进入下一个 Step
    end

    Loop->>Loop: agent/turn-stopping
    Loop->>Session: turn/end
~~~

从控制流角度，可以把它简化为：

~~~text
while turn is open:
    claim input
    proposed = agent/pre-step(claimed)
    if rejected:
        close turn
        break

    append step/start and entered user messages
    prompt = assemble system sections and tool schemas
    request = agent/request(prompt, history)
    stream = llm/stream(request)
    append assistant chunks and final assistant message
    execute model tool calls
    append tool results
    append step/end

    if no next-step input and no owed tool work:
        agent/turn-stopping
        close turn
~~~

实际实现还包括取消、重试、并行安全分类、请求默认值、恢复、Scope 生命周期和持久化检查点。

### 3. Agent 的输入通道

Agent 使用一个 Inbox 接收不同来源的消息：

- followup()：放入下一 Turn 队列，并唤醒 Agent。
- steer()：放入下一 Step 队列，并唤醒 Agent。
- inject()：放入下一 Step 队列，但不主动唤醒，适合等待下一次已存在的输入。

agent/pre-step 是决定模型最终看到哪些输入的权威扩展点。监听器可以改写消息或直接拒绝这一步。即使第一次输入被拒绝，持久化日志仍然可以记录一个没有 Step 的 Turn，UI、审计和恢复不会丢失用户动作。

## 五、Session Event Log：模型可见就必须可记录

### 1. Session 是事件溯源数据结构

Session 不是简单的 messages 数组，而是追加型 SessionEvent 流。典型事件包括：

- turn/start、turn/end
- step/start、step/end
- user/message
- assistant/chunk、assistant/message
- tool/call、tool/result
- 配置、目标、计划、子 Agent 和其他领域事件

deriveMessages() 从日志投影出模型历史；原始 assistant/chunk 事件则保留流式 UI 和回放所需的细节。

### 2. Durable Event 与 Live Event

| 类型 | 代表 | 作用 |
| --- | --- | --- |
| Durable Session Event | turn、step、assistant、tool | 可以持久化、回放、恢复和审计 |
| Live Agent Event | agent/status、agent/pre-step、agent/request | 观察或拦截当前运行 |
| Capability Event | tools、fs、llm/stream | 在能力边界挂载策略和适配器 |

关键不变量是：

> 任何进入模型请求的内容，都必须能从 Session Log 重建。

这意味着，如果新功能想给模型增加可见上下文，不能只把字符串塞进内存变量；必须增加对应的 Session Event，并在消息或 Prompt 投影中从日志渲染。这样 Resume、Fork、导出、测试回放和 UI 才能看到同一事实。

### 3. 日志、投影和运行状态

Session Log 可以被 JSONL 或 SQLite 等后端持久化。投影、标题、搜索、遥测和 UI 都是事件流的消费者，而不是另建一套互相漂移的主状态。

阅读源码时要区分：

- **日志**：回答“发生过什么”。
- **Projection**：回答“当前界面需要显示什么”。
- **Agent 状态**：回答“现在是否运行、在等什么、能否取消”。

## 六、工具执行管线：工具不是裸函数调用

一个工具调用的核心路径是：

~~~text
assistant message 中的 tool-call
  → 记录 tool/call
  → tools/pre-execute（策略与权限）
  → monotonic guards（不可放宽的所有者策略）
  → tools/execute（超时、重试、指标等 around middleware）
  → 工具 execute() 主体
  → tools/post-execute（接受、拒绝、改写、添加上下文）
  → ToolDefinition.finalizeContent
  → tools/result（观察最终结果）
  → 记录 tool/result
~~~

这样拆分后，权限、Sandbox、Approval、Timeout、Metrics、结果裁剪和 UI 表现不需要全部写进每个工具的实现。

工具管线有三个重要性质：

1. tool/call 在执行前记录，工具即使被拒绝也有可回放的调用事实。
2. 工具结果经过规范化后，才成为唯一的模型可见 tool/result。
3. 工具执行模式会影响调度：互不影响的工具可以进入有界滚动并行池；需要比较资源或依赖兄弟调用的工具必须保持独占屏障。

dsh-tools 还支持 Code Mode：模型直接看到 run_code，通过 TypeScript 或 Python SDK 在一个程序中组织多个工具调用。内部子调用仍然经过工具权限和结果管线，而不是绕过安全边界。

## 七、Capability Seam：新增能力的标准方法

DeepSeek Harness 把一个可替换能力称为 Capability Seam。完整 Seam 至少有三个角色：

1. **Service Definition**：声明 ctx Service 和该能力的类型化语言。
2. **Service Provider**：实现具体后端。
3. **Consumer**：使用该 Service，常见形式是模型可调用工具、UI 或另一个核心插件。

| Seam | Definition | Provider 示例 | Consumer 示例 |
| --- | --- | --- | --- |
| LLM | ctx.llm | DeepSeek 官方 SSE、pi-ai、Replay | Agent Loop、标题和 Compaction |
| 文件系统 | ctx.fs | local、sandbox、E2B | tool-fs |
| Shell | ctx.shell | bash-local、bash-sandbox、PowerShell | tool-bash、tool-pwsh、Hook |
| Subprocess | ctx.subprocess | local process tree、E2B | Shell、PTY、LSP、外部 Subagent |
| Sandbox | ctx.sandbox | local、Windows ACL 等 | Bash、Terminal、Filesystem |
| Subagent | ctx.subagents | in-process、ACP、Codex、Claude Code、SDK | tool-subagent、Workflow |
| Web | ctx.web | DeepSeek Search、Exa、Perplexity、HTTP Fetch | tool-web |
| Compaction | ctx.compaction | basic provider | agent/pre-step 和错误恢复 |

新增能力时，不要从某个具体 Provider 复制一份 Loop 或工具。应先定义 Seam，再分别提供后端和 Consumer；Consumer 依赖 Service Definition，而不是依赖某个 Provider 的实现文件。

## 八、DeepSeek LLM 适配器：从 ctx.llm 到 HTTP SSE

核心 LLM 包是 @deepseek-ai/dsh-llm，官方 DeepSeek 适配器是 @deepseek-ai/dsh-llm-deepseek。

适配器通过 ctx.llm.registerAdapter() 注册一个名为 deepseek-official 的 Provider Route。Agent Loop 不直接 import DeepSeek HTTP 客户端，而是把 provider、model、maxTokens、reasoningEffort 等交给 ctx.llm。

DeepSeek 适配器的主要职责：

- 通过 fetch 发起 Chat Completions 请求。
- 解析 SSE 流。
- 把 DeepSeek wire format 翻译成 dsh 的 StreamChunk。
- 把文本、推理、工具调用和 usage 转成统一的块协议。
- 统一处理 HTTP 错误、传输错误、流关闭、超时和取消。
- 按配置解析模型目录、上下文窗口、输出上限和 reasoning effort。

Loop 只消费统一的流式协议，因此替换 Provider 不会改变 Turn/Step 控制流。

一个简化配置如下：

~~~yaml
- id: llm-deepseek
  name: '@deepseek-ai/dsh-llm-deepseek'
  config:
    apiKeyEnv: DEEPSEEK_API_KEY
    baseURL: https://api.deepseek.com
    thinking: enabled
    reasoningEffort: high
    maxTokens: 256000
    streamIdleTimeoutMs: 300000
~~~

这些字段可以分成三类：

- **连接事实**：baseURL、凭据来源、请求超时。
- **模型能力**：模型目录、上下文容量、reasoning effort。
- **请求默认值**：maxTokens、当前请求的 reasoning effort。

Settings 和 Credentials 允许下一次请求读取新的配置，而不会把正在进行的流悄悄切换到另一组连接事实。适配器不会把 API Key 写进模型可见消息或持久化请求正文。

适配器使用稳定错误码表达失败原因，例如 AUTH、RATE_LIMIT、QUOTA、CONTEXT_WINDOW_EXCEEDED、TRANSPORT、TIMEOUT、ABORTED、STREAM_CLOSED 和 MALFORMED_RESPONSE。错误码供重试、Compaction、UI 和测试使用；人类可读的错误文本不应该被当作控制流协议。

## 九、如何开始源码学习

官方仓库的学习顺序很清晰：

1. Cordis Primer：先掌握 Context、Service、Event 和 Effect。
2. Cordis Tutorial：不需要 API Key，逐章写插件。
3. architecture.md：建立 Profile、Bundle、Session 和 Capability Seam 的全局地图。
4. agent-loop：阅读 Turn/Step、Inbox、取消和工具调度。
5. session：阅读事件类型、消息投影和持久化边界。
6. tools：阅读工具 Schema、权限和结果管线。
7. llm：阅读统一的消息与流协议。
8. llm-deepseek：阅读 SSE 解析和 DeepSeek wire format 翻译。
9. bundle 配置：观察能力如何在 Web 与 Headless Profile 中组合。

推荐源码入口：

- packages/core/agent-loop/src/agent.ts
- packages/core/session/src/index.ts
- packages/core/tools/src/index.ts
- packages/llm/llm/src/index.ts
- packages/llm/llm-deepseek/src/adapter.ts
- packages/bundle/base/cordis.patch.yml
- packages/bundle/web-app/cordis.patch.yml
- packages/bundle/headless/cordis.patch.yml

读每个模块时，优先回答四个问题：

1. 谁拥有状态？
2. 谁负责生命周期？
3. 哪些事件需要持久化？
4. Provider 是否可以被替换？

## 十、与 learn-claude-code 的对应关系

下面的对应关系用于迁移已有知识，不代表两个项目实现完全相同：

| learn-claude-code 主题 | dsh 中可对照的机制 |
| --- | --- |
| s01 Agent Loop | dsh-agent + dsh-agent-loop 的 Turn/Step 驱动 |
| s02 Tool Use | dsh-tools 的注册、Schema、执行与结果管线 |
| s03 TodoWrite | dsh-todo 的模型可见 Todo 工具与 Session 事件 |
| s04 Subagents | ctx.subagents 与多种 Subagent Provider |
| s05 Skills | ctx.skills、Skill Provider、目录和加载工具 |
| s06 Context Compact | ctx.compaction、agent/pre-step 压力检查和错误恢复 |
| s07 Task System | Session 持久化、查询、Goals、Workflow 和 Jobs |
| s08 Background Tasks | ctx.jobs、后台 Shell、PTY 和子 Agent 任务 |
| s09 Agent Teams | Subagent Provider、Scope 和任务编排 |
| s10 Team Protocols | Agent 生命周期、取消、Approval、Event 和恢复协议 |
| s11 Autonomous Agents | Goals、Workflow、Ralph 等持续推进机制 |
| s12 Worktree Isolation | Workspace、Filesystem、Sandbox、Subprocess 执行边界 |

最值得迁移的架构思想是：如果在一个教学版 Agent 中新增能力，通常会直接在 Loop 里增加一个分支；dsh 更倾向于把能力变成 Event Listener、Service Provider 或 Consumer，通过配置装配到 Loop 外部。

## 十一、推荐的动手实验

### 实验一：写一个不调用模型的插件

创建一个函数插件，完成加载、卸载和定时器清理。然后用命令行 Patch 把它插入 Web Profile。

验收标准：

- 能解释 inject 为什么比手动排序可靠。
- 能解释 disposer 为什么必须归插件生命周期管理。
- 能用 --patch 插入插件，而不修改官方 Bundle。

### 实验二：观察 Agent 事件

编写一个只观察 agent/status 或 session/event 的插件，记录一个 Turn 的状态变化。

验收标准：

- 能区分 Durable Session Event 和 Live Agent Event。
- 能区分观察型监听器和会短路的 Waterfall 监听器。
- 能说明 agent/pre-step 为什么是模型输入的权威入口。

### 实验三：跟踪一次工具调用

从 assistant 的 tool-call 开始，跟踪它如何经过权限、沙箱、执行、结果规范化和 Session 记录。

验收标准：

- 能解释拒绝的工具为什么仍然要记录 tool/call。
- 能解释 tool/result 为什么不能绕过 post-execute。
- 能说明哪些工具可以并行，哪些必须独占。

### 实验四：替换 LLM Provider

先用 Replay 或 Mock Adapter 理解 ctx.llm，再阅读 DeepSeek SSE Adapter。

验收标准：

- 能画出 GenerateOptions → StreamChunk → BlockAssembler → SessionEvent 的数据流。
- 能指出 API Key 解析、模型目录和请求默认值分别属于哪一层。
- 能解释错误码为什么比错误文本适合作为重试条件。

## 十二、运行和安全注意事项

从源码运行 Web UI：

~~~bash
git clone https://github.com/deepseek-ai/deepseek-harness.git
cd deepseek-harness
pnpm install
pnpm run build
pnpm dsh web
~~~

无界面任务：

~~~bash
pnpm dsh --profile headless "总结当前仓库的主要模块"
~~~

配置密钥时使用环境变量或 gitignored .env，不要把 Key 写进 cordis.yml、源码或提交记录。

Windows 和 POSIX 的工具栈不同。Base Bundle 会按平台选择 Bash 或 PowerShell 执行器，不要把某个平台的 Shell Provider 假设为所有环境都存在。

如果只想学习 Cordis，不需要 API Key。官方 Tutorial 在仓库内用 TypeScript 运行器提供了无密钥实验路径。

## 结语

DeepSeek Harness 最值得学习的不是某一个 DeepSeek API 调用细节，而是它把 Agent 拆成了四个相互配合的层次：

- Cordis 负责插件装配和生命周期。
- Agent Loop 负责 Turn/Step 控制流。
- Session Log 负责事实、恢复和重建。
- Capability Seam 负责模型、工具和执行环境的替换。

这使得一个 Agent 不再是一个越来越大的 Runner 类，而是一棵可组合、可替换、可回放的插件树。

如果你正在学习 Agent Harness 工程，可以把它和 learn-claude-code 对照阅读：先用后者理解最小循环，再用 dsh 理解真实产品如何处理持久化、权限、并发、扩展和部署边界。

继续阅读：

- [DeepSeek Harness 官方仓库](https://github.com/deepseek-ai/deepseek-harness)
- [官方架构文档](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/architecture.md)
- [Cordis Primer](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cordis-primer.md)
- [Cordis Tutorial](https://github.com/deepseek-ai/deepseek-harness/tree/master/docs/cordis-tutorial)

