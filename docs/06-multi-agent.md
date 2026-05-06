# 第 6 章：多 Agent 协作

# 第六章：多 Agent 协作

当我们第一次构建 Agent 系统时，通常会从“一个大而全的智能体”开始：给它一个系统提示词，接上工具，让它同时负责理解需求、拆分任务、调用 API、写代码、运行测试、整理报告。这个阶段很适合验证产品方向，因为单体 Agent 开发成本低、链路简单、调试方便。

但只要任务复杂度一上来，单体 Agent 的问题就会非常明显：上下文越来越长、职责越来越混乱、工具调用越来越不可控，最终变成一个“什么都想做，但什么都做不好”的系统。

这就是多 Agent 协作出现的根本原因。

---

## 6.1 为什么需要多 Agent

### 6.1.1 单体 Agent 的典型瓶颈

单体 Agent 并不是不能做复杂任务，而是**一旦任务同时具备多角色、多阶段、多约束、多轮反馈**这些特征，它的工程成本会迅速上升。

我们先看几个常见问题。

#### 1）职责耦合过重

一个 Agent 同时承担：

- 需求理解
- 任务拆解
- 技术设计
- 编码实现
- 测试验证
- 结果汇报

这会导致提示词不断膨胀。你会在 system prompt 里写大量规则：

- 什么时候该规划
- 什么时候该编码
- 什么时候该调用工具
- 什么时候该等待用户确认
- 什么时候该进行自检

最终，这个 Agent 的行为边界会变得非常模糊。

#### 2）上下文窗口压力大

单体 Agent 要把所有信息都保存在自己的上下文里：

- 用户原始需求
- 中间设计稿
- 历史代码片段
- 测试结果
- 错误日志
- 工具调用记录

任务一长，token 成本就爆炸。更糟的是，模型可能会因为上下文噪声过多而忽略关键约束。

#### 3）计划与执行互相干扰

一个好的规划者，未必是一个好的执行者；一个擅长写代码的 Agent，也未必擅长从业务目标中提炼验收标准。

单体 Agent 常见问题是：

- 前面规划很理性
- 后面执行时开始“即兴发挥”
- 执行失败后又推翻原计划
- 不断重复前面的思考

这类系统在日志里看起来像“很努力”，但实际效率低。

#### 4）错误难以定位

如果一个大 Agent 失败了，你很难判断问题出在哪里：

- 是需求理解错了？
- 是任务拆分错了？
- 是某个工具调用失败？
- 是代码写错了？
- 还是测试标准本身有问题？

多 Agent 最大的工程价值之一，就是**让错误边界清晰化**。

---

### 6.1.2 多 Agent 的核心价值

把复杂任务拆给多个 Agent，本质上是在做三件事：

1. **职责隔离**：每个 Agent 只做少数几件事
2. **上下文隔离**：每个 Agent 只接触自己必要的信息
3. **决策分层**：规划、执行、验证不再混在一起

比如一个软件交付任务可以拆成：

- 产品经理 Agent：理解需求、补全验收标准、协调优先级
- 开发 Agent：设计实现方案并编写代码
- 测试 Agent：根据需求和代码生成测试、验证结果并反馈缺陷

这样的好处很直接：

| 问题 | 单体 Agent | 多 Agent |
|---|---|---|
| 提示词复杂度 | 高 | 每个 Agent 更简单 |
| 上下文长度 | 持续增长 | 可按角色切分 |
| 可观测性 | 模糊 | 较清晰 |
| 错误定位 | 困难 | 能定位到具体角色 |
| 并行能力 | 弱 | 更强 |
| 复用性 | 低 | 高，可替换单个 Agent |

---

## 6.2 协作模式：主从 / 对等 / 层级 / 辩论

多 Agent 不只是“多个 Agent 放在一起”，核心在于**如何组织它们之间的关系**。不同协作模式决定了：

- 任务如何分发
- 决策权在谁手里
- 状态如何流动
- 冲突如何解决

---

### 6.2.1 主从模式（Manager-Worker）

主从模式是最容易落地的一种方式：一个主控 Agent 负责任务拆分和调度，多个执行 Agent 接收任务并返回结果。

#### 架构图

```text
┌──────────────┐
│   用户输入    │
└──────┬───────┘
       │
       v
┌──────────────┐
│ 主控 Agent    │
│ 规划/调度/汇总 │
└───┬────┬─────┘
    │    │
    v    v
┌──────┐ ┌──────┐
│开发Agent│ │测试Agent│
└───┬──┘ └───┬──┘
    │        │
    └───┬────┘
        v
   ┌────────┐
   │最终结果 │
   └────────┘
```

#### 特点

- 优点：
  - 控制力强
  - 容易审计
  - 适合流程化任务
- 缺点：
  - 主控 Agent 成为瓶颈
  - 主控出错会影响全局

#### 适用场景

- 软件研发流水线
- 工单处理系统
- 自动化报告生成

---

### 6.2.2 对等模式（Peer-to-Peer）

对等模式下，没有绝对中心，多个 Agent 可以直接协商、交换信息、共同完成目标。

#### 架构图

```text
┌──────────┐<------>┌──────────┐
│ Agent A  │        │ Agent B  │
└────┬─────┘<------>└────┬─────┘
     │                   │
     └--------<--------->┘
              ┌──────────┐
              │ Agent C  │
              └──────────┘
```

#### 特点

- 优点：
  - 灵活
  - 容错性强
  - 适合开放式问题求解
- 缺点：
  - 容易产生重复沟通
  - 难以保证收敛
  - 调试复杂

#### 适用场景

- 创意生成
- 研究讨论
- 多专家问答

---

### 6.2.3 层级模式（Hierarchical）

层级模式是在主从模式基础上的扩展：上层负责目标和策略，中层负责任务编排，下层负责具体执行。

#### 架构图

```text
                ┌────────────────┐
                │   战略 Agent     │
                └───────┬────────┘
                        │
               ┌────────v────────┐
               │   项目经理 Agent  │
               └───┬────────┬────┘
                   │        │
          ┌────────v───┐ ┌──v────────┐
          │ 开发 Lead   │ │ QA Lead   │
          └──────┬──────┘ └────┬─────┘
                 │             │
          ┌──────v──────┐ ┌────v──────┐
          │ 开发 Worker  │ │ 测试 Worker│
          └─────────────┘ └───────────┘
```

#### 特点

- 优点：
  - 适合大规模复杂流程
  - 能实现组织化协作
- 缺点：
  - 系统实现复杂
  - 状态管理要求高

#### 适用场景

- 企业级自动化平台
- 大规模代码迁移
- 跨团队工作流

---

### 6.2.4 辩论模式（Debate / Judge）

辩论模式会让多个 Agent 对同一问题提出方案，再由评审 Agent 或投票机制选择结果。

#### 架构图

```text
             ┌─────────────┐
             │   用户问题    │
             └──────┬──────┘
                    │
      ┌─────────────┼─────────────┐
      v             v             v
┌──────────┐ ┌──────────┐ ┌──────────┐
│ Agent A  │ │ Agent B  │ │ Agent C  │
│ 方案一     │ │ 方案二     │ │ 方案三     │
└─────┬────┘ └─────┬────┘ └─────┬────┘
      └──────┬──────┴──────┬─────┘
             v             v
          ┌──────────────────┐
          │ Judge / 评审 Agent │
          └──────────────────┘
```

#### 特点

- 优点：
  - 提升答案鲁棒性
  - 适合不确定性高的问题
- 缺点：
  - token 成本高
  - 延迟高
  - 需要设计评审标准

#### 适用场景

- 高风险决策
- 复杂方案设计
- 推理题与代码优化

---

## 6.3 通信协议设计：消息格式、状态同步、冲突解决

多 Agent 真正困难的地方，不是创建多个 LLM 实例，而是**定义它们如何说话、如何共享状态、如何在意见不一致时收敛**。

### 6.3.1 为什么需要协议

如果没有协议，Agent 间通信很容易演变成自然语言“闲聊”：

- 描述不稳定
- 字段不固定
- 容易丢信息
- 无法程序化解析
- 不利于日志审计

所以在工程实践里，应尽量把 Agent 间消息设计为**结构化对象**，自然语言只放在必要字段中。

---

### 6.3.2 消息格式设计

一个通用的 Agent 消息通常至少包含这些字段：

| 字段 | 类型 | 含义 |
|---|---|---|
| id | string | 消息唯一标识 |
| from | string | 发送方 Agent |
| to | string | 接收方 Agent |
| type | string | 消息类型 |
| taskId | string | 所属任务 ID |
| timestamp | string | 时间戳 |
| payload | object | 业务内容 |
| version | number | 状态版本 |
| requiresAck | boolean | 是否需要确认 |

下面给出 TypeScript 类型定义。

```ts
export type AgentRole = "pm" | "dev" | "qa" | "manager";

export type MessageType =
  | "TASK_ASSIGNMENT"
  | "TASK_RESULT"
  | "QUESTION"
  | "ANSWER"
  | "BUG_REPORT"
  | "APPROVAL"
  | "REWORK_REQUEST"
  | "FINAL_REPORT";

export interface AgentMessage<T = unknown> {
  id: string;
  from: AgentRole;
  to: AgentRole;
  type: MessageType;
  taskId: string;
  timestamp: string;
  version: number;
  requiresAck: boolean;
  payload: T;
}
```

示例消息：

```json
{
  "id": "msg_001",
  "from": "pm",
  "to": "dev",
  "type": "TASK_ASSIGNMENT",
  "taskId": "task_login_api",
  "timestamp": "2026-05-06T10:00:00.000Z",
  "version": 1,
  "requiresAck": true,
  "payload": {
    "title": "实现登录接口",
    "acceptanceCriteria": [
      "输入用户名和密码可登录",
      "密码错误返回 401",
      "返回 token"
    ],
    "constraints": [
      "使用 Express",
      "返回 JSON"
    ]
  }
}
```

---

### 6.3.3 状态同步

在多 Agent 系统里，最重要的不是“单条消息”，而是“共享任务状态”。

比如在“产品经理 + 开发 + 测试”团队中，任务状态可能包括：

- 当前需求说明
- 验收标准
- 开发实现结果
- 测试结果
- 缺陷列表
- 当前轮次
- 是否完成

可以定义统一状态：

```ts
export interface TeamState {
  taskId: string;
  userRequest: string;
  requirements?: string;
  acceptanceCriteria: string[];
  implementation?: string;
  testCases?: string[];
  testReport?: string;
  bugList: string[];
  currentOwner: "pm" | "dev" | "qa" | "manager" | "done";
  iteration: number;
  maxIterations: number;
  approved: boolean;
  messageLog: AgentMessage[];
}
```

状态同步的关键原则：

#### 原则 1：单一事实源（Single Source of Truth）

不要让每个 Agent 都维护一份自己的任务副本。应由编排器或共享状态仓库存放“权威状态”。

#### 原则 2：增量更新而不是整体覆盖

尽量让每个 Agent 只修改自己负责的字段。例如：

- PM 更新 `requirements`、`acceptanceCriteria`
- Dev 更新 `implementation`
- QA 更新 `testCases`、`testReport`、`bugList`

#### 原则 3：版本控制

每次写状态时带上 `version` 或 `revision`，避免覆盖新状态。

---

### 6.3.4 冲突解决

冲突主要有三类：

#### 1）数据冲突

两个 Agent 同时更新同一字段。

解决方式：

- 乐观锁：检查版本号，不一致则拒绝写入
- 字段级 ownership：明确每个字段由谁负责
- 合并策略：数组追加、对象深合并、文本以最新版本为准

#### 2）决策冲突

例如：

- PM 说需求完成
- QA 说测试未通过

这不是数据冲突，而是**业务冲突**。

解决方式：

- 引入裁决者 Agent
- 预定义优先级规则，例如：
  - 测试失败 > 开发完成
  - PM 的需求解释权高于 Dev
  - 最终上线决策由 Manager 决定

#### 3）流程冲突

例如 Dev 等 PM 澄清，PM 又在等 QA 反馈，形成等待环。

解决方式：

- 每个消息设置 TTL 或超时
- 编排器维护等待图
- 超时后自动升级到 manager 或 fallback handler

---

## 6.4 实战框架对比：LangGraph / CrewAI / AutoGen / Claude Agent SDK

多 Agent 框架的价值，不在于“帮你调一次模型”，而在于提供：

- 状态机/图编排
- 多 Agent 消息路由
- 工具调用封装
- 记忆与检查点
- 可观测性

下面对四类常见方案做对比。

---

### 6.4.1 LangGraph

LangGraph 是 LangChain 生态中非常适合构建**有状态、有分支、可循环**工作流的框架。它本质上是一个状态图引擎，非常适合多 Agent。

#### 优势

- 强状态管理
- 节点 + 边模型清晰
- 支持循环、条件分支、检查点
- 适合复杂工作流

#### 不足

- 需要开发者自己设计状态和路由
- 多 Agent 角色逻辑要自己组织
- 上手门槛高于简单封装框架

#### 适用场景

- 可控的生产级工作流
- 需要调试和追踪的 Agent 系统
- 软件工程、多步骤审批流程

---

### 6.4.2 CrewAI

CrewAI 以“角色 + 任务 + 团队协作”为核心，概念上更贴近业务团队模型。

#### 优势

- 角色建模直观
- 快速搭建多 Agent 协作
- 对任务编排较友好

#### 不足

- 底层状态可控性不如 LangGraph
- 对复杂循环和细粒度编排支持相对有限
- 自定义协议时可能需要额外工作

#### 适用场景

- 业务自动化原型
- 内容生产团队
- 中小型协作流程

---

### 6.4.3 AutoGen

AutoGen 由 Microsoft 推出，强调多 Agent 对话、工具使用和自动协商，适合探索性强的多 Agent 任务。

#### 优势

- 对 Agent 间对话支持强
- 适合构建“多个 Agent 互相讨论”的系统
- 社区案例多

#### 不足

- 容易失控：对话轮次、token 消耗难控
- 如果没有额外约束，系统可能陷入冗长交互
- 生产级治理需要补很多机制

#### 适用场景

- 研究实验
- 对话式协商系统
- 开放式任务求解

---

### 6.4.4 Claude Agent SDK

Claude Agent SDK 更偏向构建与 Claude 模型深度协同的 Agent 应用，强调工具使用、工作流组织与开发体验。

#### 优势

- 与 Claude 模型能力集成自然
- 在代码理解、长上下文处理方面表现好
- 对工程场景友好

#### 不足

- 生态广度不如 LangChain/LangGraph
- 某些复杂图编排能力可能需要自己补

#### 适用场景

- 代码 Agent
- 文档分析
- 需要长上下文推理的团队协作

---

### 6.4.5 框架对比表

| 维度 | LangGraph | CrewAI | AutoGen | Claude Agent SDK |
|---|---|---|---|---|
| 核心模型 | 状态图 | 团队任务 | 多 Agent 对话 | 模型驱动 Agent |
| 状态管理 | 强 | 中 | 中 | 中 |
| 可控性 | 很强 | 中 | 较弱 | 中高 |
| 上手难度 | 中高 | 低中 | 中 | 中 |
| 适合生产 | 很适合 | 适合中小型 | 需较多治理 | 适合特定场景 |
| 循环/分支 | 强 | 一般 | 依赖对话逻辑 | 中 |
| 可观测性 | 强 | 中 | 中 | 视实现而定 |

如果你的目标是“真正可上线的多 Agent 工作流”，**LangGraph 往往是更稳健的选择**。后面我们就用 LangGraph 实现完整案例。

---

## 6.5 案例：实现一个“产品经理 + 开发 + 测试”三人协作团队

这个案例模拟一个小型软件团队：

- **PM Agent**：把用户需求整理为开发可执行的任务，输出验收标准
- **Dev Agent**：根据需求生成实现代码
- **QA Agent**：为代码生成测试并执行校验，失败则发回缺陷
- **Manager/Router**：负责流程编排和结束判定

为了让示例在本地可运行，我们做两个设计：

1. 使用 LangGraph 组织流程
2. 测试执行使用本地 Node.js 运行器，不依赖外部服务

---

## 6.6 系统架构设计

### 6.6.1 流程图

```text
               ┌────────────────────┐
               │      用户需求        │
               └─────────┬──────────┘
                         │
                         v
                 ┌──────────────┐
                 │   PM Agent    │
                 │需求澄清/验收标准│
                 └──────┬───────┘
                        │
                        v
                 ┌──────────────┐
                 │   Dev Agent   │
                 │ 生成实现代码    │
                 └──────┬───────┘
                        │
                        v
                 ┌──────────────┐
                 │   QA Agent    │
                 │生成测试并验证   │
                 └──────┬───────┘
                        │
              ┌─────────┴─────────┐
              │                   │
              v                   v
      ┌──────────────┐    ┌──────────────┐
      │ 测试失败/提 Bug │    │   测试通过     │
      └──────┬───────┘    └──────┬───────┘
             │                   │
             v                   v
       ┌──────────────┐   ┌──────────────┐
       │ 回到 Dev Agent │   │  输出最终结果  │
       └──────────────┘   └──────────────┘
```

这是一个典型的**循环工作流**：QA 如果发现问题，流程会回到 Dev；如果通过，则结束。

---

## 6.7 完整 LangGraph 多 Agent 代码示例

下面给出一个完整可运行的 TypeScript 示例。这个示例包含：

- LangGraph 状态图
- PM / Dev / QA 三个 Agent
- 结构化状态
- 本地代码写入与测试执行
- 最大迭代次数控制
- 循环保护

> 说明：为了保证示例可运行，下面使用 OpenAI 兼容接口的 LangChain Chat 模型。你可以替换成自己可用的模型提供商。  
> 如果你使用的是 Anthropic、OpenAI 或其他兼容模型，只需修改模型初始化部分。

---

### 6.7.1 项目结构

```text
multi-agent-team/
├─ package.json
├─ tsconfig.json
├─ src/
│  ├─ index.ts
│  ├─ types.ts
│  ├─ agents.ts
│  ├─ graph.ts
│  └─ sandbox.ts
└─ workspace/
   ├─ app.js
   └─ app.test.js
```

---

### 6.7.2 安装依赖

```bash
mkdir multi-agent-team
cd multi-agent-team
npm init -y
npm install @langchain/langgraph @langchain/core @langchain/openai zod dotenv
npm install -D typescript ts-node @types/node
npx tsc --init
```

---

### 6.7.3 `package.json`

```json
{
  "name": "multi-agent-team",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "ts-node src/index.ts"
  },
  "dependencies": {
    "@langchain/core": "^0.3.55",
    "@langchain/langgraph": "^0.2.39",
    "@langchain/openai": "^0.4.5",
    "dotenv": "^16.4.5",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/node": "^22.5.5",
    "ts-node": "^10.9.2",
    "typescript": "^5.6.2"
  }
}
```

---

### 6.7.4 `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "ts-node": {
    "esm": true
  }
}
```

---

### 6.7.5 `src/types.ts`

```ts
export type AgentRole = "pm" | "dev" | "qa" | "manager" | "done";

export interface AgentMessage<T = unknown> {
  id: string;
  from: AgentRole;
  to: AgentRole;
  type:
    | "TASK_ASSIGNMENT"
    | "TASK_RESULT"
    | "BUG_REPORT"
    | "APPROVAL"
    | "REWORK_REQUEST"
    | "FINAL_REPORT";
  taskId: string;
  timestamp: string;
  version: number;
  requiresAck: boolean;
  payload: T;
}

export interface TeamState {
  taskId: string;
  userRequest: string;
  requirements: string;
  acceptanceCriteria: string[];
  implementation: string;
  testCode: string;
  testReport: string;
  bugList: string[];
  currentOwner: AgentRole;
  iteration: number;
  maxIterations: number;
  approved: boolean;
  messageLog: AgentMessage[];
}
```

---

### 6.7.6 `src/sandbox.ts`

这里负责把代码写到 `workspace` 目录，并执行测试。

```ts
import { mkdirSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

const workspaceDir = path.resolve("workspace");

export function ensureWorkspace() {
  mkdirSync(workspaceDir, { recursive: true });
}

export function writeImplementation(code: string) {
  ensureWorkspace();
  writeFileSync(path.join(workspaceDir, "app.js"), code, "utf-8");
}

export function writeTest(testCode: string) {
  ensureWorkspace();
  writeFileSync(path.join(workspaceDir, "app.test.js"), testCode, "utf-8");
}

export function runTests(): { success: boolean; output: string } {
  try {
    const output = execSync(`node workspace/app.test.js`, {
      encoding: "utf-8"
    });
    return { success: true, output };
  } catch (error: any) {
    return {
      success: false,
      output: error?.stdout || error?.message || "Unknown test error"
    };
  }
}
```

---

### 6.7.7 `src/agents.ts`

这里定义 PM、Dev、QA 三个 Agent 的行为。

```ts
import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";
import { TeamState, AgentMessage } from "./types.js";
import { writeImplementation, writeTest, runTests } from "./sandbox.js";

const model = new ChatOpenAI({
  model: process.env.MODEL_NAME || "gpt-4o-mini",
  temperature: 0,
  apiKey: process.env.OPENAI_API_KEY,
  configuration: process.env.OPENAI_BASE_URL
    ? {
        baseURL: process.env.OPENAI_BASE_URL
      }
    : undefined
});

function msg(
  from: AgentMessage["from"],
  to: AgentMessage["to"],
  type: AgentMessage["type"],
  taskId: string,
  version: number,
  payload: unknown
): AgentMessage {
  return {
    id: `${taskId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    from,
    to,
    type,
    taskId,
    timestamp: new Date().toISOString(),
    version,
    requiresAck: false,
    payload
  };
}

export async function pmAgent(state: TeamState): Promise<Partial<TeamState>> {
  const prompt = `
你是一名资深产品经理。
请根据用户需求，输出：
1. 明确、简洁的需求说明
2. 3-5 条可测试的验收标准

用户需求：
${state.userRequest}

请严格按如下 JSON 输出：
{
  "requirements": "string",
  "acceptanceCriteria": ["string"]
}
  `.trim();

  const res = await model.invoke(prompt);
  const text = typeof res.content === "string" ? res.content : JSON.stringify(res.content);

  let parsed: { requirements: string; acceptanceCriteria: string[] };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`PM agent 输出不是合法 JSON: ${text}`);
  }

  return {
    requirements: parsed.requirements,
    acceptanceCriteria: parsed.acceptanceCriteria,
    currentOwner: "dev",
    messageLog: [
      ...state.messageLog,
      msg("pm", "dev", "TASK_ASSIGNMENT", state.taskId, state.iteration, parsed)
    ]
  };
}

export async function devAgent(state: TeamState): Promise<Partial<TeamState>> {
  const bugHints =
    state.bugList.length > 0
      ? `\n上轮测试发现问题：\n- ${state.bugList.join("\n- ")}\n请修复这些问题。\n`
      : "";

  const prompt = `
你是一名 Node.js 开发工程师。
请根据需求生成完整可运行的 JavaScript 代码，写入 app.js。
要求：
1. 使用 CommonJS 导出
2. 不要输出 Markdown 代码块
3. 只输出代码
4. 代码必须能被测试文件 require("./app")

需求说明：
${state.requirements}

验收标准：
${state.acceptanceCriteria.map((x, i) => `${i + 1}. ${x}`).join("\n")}
${bugHints}

默认实现一个函数：
module.exports = { login };

如果需求中有用户名密码校验，请使用：
用户名：admin
密码：123456
成功时返回：{ token: "mock-token" }
失败时抛出错误对象，包含 status 和 message
  `.trim();

  const res = await model.invoke(prompt);
  const code = typeof res.content === "string" ? res.content : JSON.stringify(res.content);

  writeImplementation(code);

  return {
    implementation: code,
    currentOwner: "qa",
    messageLog: [
      ...state.messageLog,
      msg("dev", "qa", "TASK_RESULT", state.taskId, state.iteration, {
        implementationGenerated: true
      })
    ]
  };
}

export async function qaAgent(state: TeamState): Promise<Partial<TeamState>> {
  const testPrompt = `
你是一名测试工程师。
请为 app.js 生成完整可运行的测试代码，保存为 app.test.js。

要求：
1. 使用 Node.js 原生 assert
2. 不要使用 jest/mocha/vitest
3. 不要输出 Markdown 代码块
4. 只输出代码
5. 测试文件需要在成功时打印 "ALL_TESTS_PASSED"
6. 测试失败时抛出异常退出

需求说明：
${state.requirements}

验收标准：
${state.acceptanceCriteria.map((x, i) => `${i + 1}. ${x}`).join("\n")}

当前实现代码：
${state.implementation}
  `.trim();

  const res = await model.invoke(testPrompt);
  const testCode = typeof res.content === "string" ? res.content : JSON.stringify(res.content);

  writeTest(testCode);

  const result = runTests();

  if (result.success && result.output.includes("ALL_TESTS_PASSED")) {
    return {
      testCode,
      testReport: result.output,
      bugList: [],
      approved: true,
      currentOwner: "done",
      messageLog: [
        ...state.messageLog,
        msg("qa", "manager", "APPROVAL", state.taskId, state.iteration, {
          report: result.output
        })
      ]
    };
  }

  return {
    testCode,
    testReport: result.output,
    bugList: [result.output.slice(0, 1000)],
    approved: false,
    currentOwner: "dev",
    iteration: state.iteration + 1,
    messageLog: [
      ...state.messageLog,
      msg("qa", "dev", "BUG_REPORT", state.taskId, state.iteration, {
        report: result.output
      })
    ]
  };
}
```

---

### 6.7.8 `src/graph.ts`

```ts
import { END, START, StateGraph } from "@langchain/langgraph";
import { TeamState } from "./types.js";
import { pmAgent, devAgent, qaAgent } from "./agents.js";

export function buildGraph() {
  const graph = new StateGraph<TeamState>({
    channels: {
      taskId: { value: (x, y) => y ?? x, default: () => "" },
      userRequest: { value: (x, y) => y ?? x, default: () => "" },
      requirements: { value: (x, y) => y ?? x, default: () => "" },
      acceptanceCriteria: { value: (x, y) => y ?? x, default: () => [] },
      implementation: { value: (x, y) => y ?? x, default: () => "" },
      testCode: { value: (x, y) => y ?? x, default: () => "" },
      testReport: { value: (x, y) => y ?? x, default: () => "" },
      bugList: { value: (x, y) => y ?? x, default: () => [] },
      currentOwner: { value: (x, y) => y ?? x, default: () => "pm" },
      iteration: { value: (x, y) => y ?? x, default: () => 0 },
      maxIterations: { value: (x, y) => y ?? x, default: () => 3 },
      approved: { value: (x, y) => y ?? x, default: () => false },
      messageLog: { value: (x, y) => y ?? x, default: () => [] }
    }
  });

  graph.addNode("pm", pmAgent);
  graph.addNode("dev", devAgent);
  graph.addNode("qa", qaAgent);

  graph.addEdge(START, "pm");
  graph.addEdge("pm", "dev");
  graph.addEdge("dev", "qa");

  graph.addConditionalEdges("qa", (state) => {
    if (state.approved) return END;
    if (state.iteration >= state.maxIterations) return END;
    return "dev";
  });

  return graph.compile();
}
```

---

### 6.7.9 `src/index.ts`

```ts
import "dotenv/config";
import { buildGraph } from "./graph.js";
import { TeamState } from "./types.js";

async function main() {
  const app = buildGraph();

  const initialState: TeamState = {
    taskId: `task_${Date.now()}`,
    userRequest:
      "请实现一个登录函数 login(username, password)，用户名 admin、密码 123456 时返回 token；密码错误时返回 401 错误。代码要简单清晰。",
    requirements: "",
    acceptanceCriteria: [],
    implementation: "",
    testCode: "",
    testReport: "",
    bugList: [],
    currentOwner: "pm",
    iteration: 0,
    maxIterations: 3,
    approved: false,
    messageLog: []
  };

  const finalState = await app.invoke(initialState);

  console.log("===== FINAL STATE =====");
  console.log(JSON.stringify(finalState, null, 2));

  console.log("\n===== MESSAGE LOG =====");
  for (const m of finalState.messageLog) {
    console.log(
      `[${m.timestamp}] ${m.from} -> ${m.to} [${m.type}]`,
      JSON.stringify(m.payload)
    );
  }

  console.log("\n===== TEST REPORT =====");
  console.log(finalState.testReport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

---

### 6.7.10 `.env` 示例

```bash
OPENAI_API_KEY=your_api_key
MODEL_NAME=gpt-4o-mini
# 如果使用兼容 OpenAI 的第三方网关，可设置：
# OPENAI_BASE_URL=https://your-openai-compatible-endpoint/v1
```

---

### 6.7.11 运行方式

```bash
npm run dev
```

如果一切正常，你会看到：

- PM 生成需求说明和验收标准
- Dev 生成 `workspace/app.js`
- QA 生成 `workspace/app.test.js`
- 测试执行通过后输出最终状态

---

## 6.8 这个案例背后的工程要点

这个案例看起来简单，但已经覆盖了多 Agent 系统的几个核心工程原则。

### 6.8.1 每个 Agent 只负责一个明确职责

- PM 不写代码
- Dev 不定义业务验收标准
- QA 不修改需求，只基于标准验证

这样能大幅减少提示词歧义。

### 6.8.2 共享状态统一收口

所有 Agent 都读写 `TeamState`，而不是互相维护私有上下文。
