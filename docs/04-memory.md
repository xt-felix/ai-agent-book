# 第 4 章：记忆系统 — 让 Agent 有长期记忆

# 第四章 记忆系统 — 让 Agent 有长期记忆

大语言模型本身并不会“天然记住”过去发生的事。  
它每次调用，本质上都是一次**基于当前输入上下文的条件生成**。如果不主动为 Agent 设计记忆系统，那么它就会表现得像“每次都失忆”。

一个能在真实业务中落地的 Agent，通常至少需要三类记忆：

- **短期记忆（Short-term Memory）**：当前对话窗口中的上下文
- **长期记忆（Long-term Memory）**：跨会话保存、可检索的外部知识与历史经验
- **工作记忆（Working Memory）**：当前任务执行过程中的中间状态、计划、工具结果

这三类记忆并不是学术上的严格分类，而是工程上非常实用的设计方式。你可以把它们理解成：

- 短期记忆：Agent “眼前看到的内容”
- 长期记忆：Agent “过去积累的经验”
- 工作记忆：Agent “脑海里正在思考的草稿纸”

---

## 4.1 为什么 Agent 必须有记忆系统

先看一个没有记忆的客服 Agent：

> 用户：我叫王磊。  
> Agent：你好，很高兴为你服务。  
> 用户：帮我查一下上周提到的退款进度。  
> Agent：请问你叫什么名字？请提供订单号。  

它的问题不是模型能力不够，而是**系统没有保存、组织和使用信息**。

在真实项目里，记忆系统主要解决以下问题：

| 问题 | 现象 | 对应记忆机制 |
|---|---|---|
| 上下文窗口有限 | 聊几轮后模型“忘了前面说过什么” | 短期记忆 |
| 跨会话无法继承信息 | 今天聊过，明天又要重说一遍 | 长期记忆 |
| 多步骤任务容易混乱 | 工具调用结果、计划步骤丢失 | 工作记忆 |
| 召回内容不稳定 | 想找历史信息却找不到 | 检索策略优化 |

从工程角度看，记忆系统就是在回答三个问题：

1. **存什么**：什么信息值得保留？
2. **怎么存**：以原文、摘要、向量、结构化状态还是日志的方式保存？
3. **怎么取**：在何时、以什么策略检索并注入到 Prompt 中？

---

## 4.2 记忆系统整体架构

下面是一个典型的 Agent 记忆架构。

```text
┌─────────────────────────────────────────────────────────────┐
│                         User Input                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Memory Orchestrator                     │
│  1. Token 预算检查                                          │
│  2. 短期记忆裁剪/摘要                                        │
│  3. 长期记忆检索（向量搜索）                                  │
│  4. 工作记忆状态注入                                          │
└─────────────────────────────────────────────────────────────┘
          │                      │                     │
          ▼                      ▼                     ▼
┌──────────────────┐   ┌────────────────────┐  ┌──────────────────┐
│ Short-term       │   │ Long-term          │  │ Working Memory   │
│ Recent Messages  │   │ Vector DB (Qdrant) │  │ Scratchpad/State │
└──────────────────┘   └────────────────────┘  └──────────────────┘
          │                      │                     │
          └──────────────┬───────┴──────────────┬──────┘
                         ▼                      ▼
                 ┌────────────────────────────────────┐
                 │     Prompt Assembly / Context      │
                 └────────────────────────────────────┘
                                   │
                                   ▼
                       ┌────────────────────────┐
                       │         LLM            │
                       └────────────────────────┘
                                   │
                                   ▼
                 ┌────────────────────────────────────┐
                 │  Response + Memory Write-back      │
                 │  - 对话入库                         │
                 │  - 摘要更新                         │
                 │  - 语义向量写入                     │
                 │  - 状态刷新                         │
                 └────────────────────────────────────┘
```

这个架构里最核心的思想是：

- **读之前先做编排**
- **答完之后再做回写**

也就是说，记忆系统不是简单的“存聊天记录”，而是一个完整的信息流控制系统。

---

# 4.3 短期记忆：对话上下文管理

短期记忆最直接的载体就是消息列表：

```ts
type Role = "system" | "user" | "assistant" | "tool";

interface ChatMessage {
  role: Role;
  content: string;
  createdAt: number;
}
```

但真实问题在于：**上下文窗口有限**。  
模型并不能无限接收消息。即便上下文支持 128k，也不意味着你应该无节制地塞入历史。因为：

- 成本会迅速上升
- 延迟会增加
- 噪声会变多
- 模型可能被无关内容干扰

因此，短期记忆管理通常要同时用到三种方法：

1. **滑动窗口**
2. **摘要压缩**
3. **Token 计数**

---

## 4.3.1 滑动窗口

滑动窗口是最简单也最常用的方法：只保留最近 N 轮消息。

例如：

- 保留最近 8 条消息
- 或保留最近 4 轮 user-assistant 对话

优点：

- 实现简单
- 延迟低
- 对短对话效果好

缺点：

- 早期关键信息容易被裁掉
- 无法跨长会话保留稳定背景

### TypeScript 实现：最近消息窗口

```ts
export interface Message {
  role: "system" | "user" | "assistant";
  content: string;
  createdAt: number;
}

export function getSlidingWindow(
  messages: Message[],
  maxMessages: number
): Message[] {
  if (messages.length <= maxMessages) return messages;
  return messages.slice(-maxMessages);
}
```

如果你只做 Demo，这已经够用。  
但在生产环境里，单独使用滑动窗口几乎一定不够。

---

## 4.3.2 摘要压缩

摘要压缩的目标是：**把很长的历史会话压成一小段稳定背景**。

例如，把前 30 轮对话压成这样：

- 用户姓名：王磊
- 职业：产品经理
- 正在处理的事项：退款跟进，订单号 A123
- 用户偏好：希望回复简洁、直接给结论

这样后续只需要保留：

- 系统提示词
- 会话摘要
- 最近几轮原始消息

这是非常经典的短期记忆方案。

### 摘要更新策略

常见做法有两种：

#### 1. 批量重摘要
每当消息数超过阈值，就把较早的一批消息重新摘要。

#### 2. 增量摘要
维护一个已有摘要，每次新来几条消息后，基于“旧摘要 + 新消息”生成新摘要。

增量摘要更适合长会话，因为成本更低。

### 摘要 Prompt 示例

```text
请根据已有摘要与新增对话，更新会话摘要。
要求：
1. 保留稳定事实（姓名、公司、项目、偏好、目标）
2. 删除寒暄和重复信息
3. 输出项目符号列表
4. 不要编造内容

已有摘要：
{old_summary}

新增对话：
{new_messages}
```

---

## 4.3.3 Token 计数

上下文管理不能凭感觉，一定要有 **Token 预算**。

例如你使用某个模型时，预算可以这样分配：

| 模块 | Token 预算 |
|---|---:|
| System Prompt | 1000 |
| 工作记忆 | 1500 |
| 长期记忆检索结果 | 2500 |
| 近期对话 | 3000 |
| 给模型留出的回答空间 | 2000 |

如果总窗口是 10k，那么你必须严格裁剪。

### 一个简化版 Token 估算器

准确 Token 计数应使用模型对应 tokenizer。  
但在工程实践中，很多场景先用估算也可以。

```ts
export function estimateTokens(text: string): number {
  // 对中英文混合内容的粗略估算
  // 实际生产建议使用官方 tokenizer
  return Math.ceil(text.length / 2);
}

export function countMessageTokens(messages: { content: string }[]): number {
  return messages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
}
```

### 基于 Token 的裁剪

```ts
import { Message } from "./types";

export function trimMessagesByToken(
  messages: Message[],
  maxTokens: number
): Message[] {
  const result: Message[] = [];
  let total = 0;

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    const tokens = Math.ceil(msg.content.length / 2);

    if (total + tokens > maxTokens) break;
    result.unshift(msg);
    total += tokens;
  }

  return result;
}
```

这段代码的思路是从后往前回收消息，优先保留最新内容。

---

# 4.4 长期记忆：向量数据库 RAG

短期记忆解决“当前会话不要丢”，长期记忆解决“跨时间检索过往经验”。

长期记忆的核心做法通常是：

1. 把文本转成向量（Embedding）
2. 存入向量数据库
3. 查询时把当前问题也转成向量
4. 做相似度搜索，找到最相关的历史记忆
5. 把召回结果拼进 Prompt

这就是 RAG（Retrieval-Augmented Generation，检索增强生成）的基础范式。

需要注意的是，**RAG 不等于知识库问答**。  
在 Agent 场景里，它还可以用来存储：

- 用户档案
- 历史偏好
- 任务记录
- 执行经验
- 工具使用结果
- 项目背景信息

也就是说，长期记忆可以是“外部知识”，也可以是“Agent 自己的经历”。

---

## 4.4.1 向量数据库对比：Qdrant / Pinecone / Chroma

### 对比表

| 维度 | Qdrant | Pinecone | Chroma |
|---|---|---|---|
| 部署方式 | 本地/云均可 | 托管云为主 | 本地嵌入式友好 |
| 易用性 | 高 | 很高 | 很高 |
| 生产能力 | 强 | 强 | 中等 |
| 过滤能力 | 强 | 强 | 一般 |
| 成本控制 | 较好 | 云成本相对高 | 本地低成本 |
| 适用场景 | 自建生产、私有化部署 | 快速上云、托管服务 | 原型、单机实验 |
| 查询能力 | 相似度 + payload filter | 相似度 + metadata | 基础相似度检索 |
| 生态成熟度 | 很好 | 很好 | 开发体验优秀 |

### 选择建议

#### Qdrant
适合：
- 需要私有化部署
- 希望控制数据
- 需要较强过滤和可扩展能力
- 想在生产环境长期使用

#### Pinecone
适合：
- 想把基础设施运维交给云服务
- 快速上线
- 接受托管成本

#### Chroma
适合：
- 本地原型开发
- 小规模实验
- 教学 Demo

本章实战选择 **Qdrant**，原因很简单：

- 本地和云都能跑
- API 清晰
- 支持 payload 过滤
- 工程上足够稳定
- 适合作为“长期记忆库”

---

# 4.5 工作记忆：Scratchpad 模式、结构化状态

如果说长期记忆是“数据库”，短期记忆是“聊天记录”，那么工作记忆就是 Agent 在完成当前任务时的“草稿纸”。

它通常用于保存：

- 当前任务目标
- 已完成步骤
- 待执行计划
- 工具调用结果
- 决策依据
- 暂存变量

这类信息不一定适合长期保存，但在任务执行过程中极其重要。

---

## 4.5.1 Scratchpad 模式

Scratchpad 可以理解为“显式思考记录”。  
但要非常注意：在生产系统中，不建议直接暴露完整链式思维。更合适的做法是保存**受控的中间状态**。

例如：

```ts
export interface Scratchpad {
  objective: string;
  facts: string[];
  completedSteps: string[];
  pendingSteps: string[];
  toolResults: Array<{
    tool: string;
    output: string;
    at: number;
  }>;
}
```

这种形式的好处是：

- 可调试
- 可审计
- 可持久化
- 容易注入 Prompt
- 避免无限制自然语言“思维泄漏”

---

## 4.5.2 结构化状态

相比自由文本 Scratchpad，结构化状态更适合复杂 Agent。

例如一个任务 Agent 的状态：

```ts
export interface AgentState {
  userId: string;
  conversationId: string;
  goal: string;
  preferences: string[];
  currentTask?: {
    name: string;
    status: "idle" | "running" | "blocked" | "done";
  };
  entities: Record<string, string>;
  notes: string[];
  updatedAt: number;
}
```

这类状态通常可以存数据库，也可以和对话消息一起维护。

### 工作记忆注入 Prompt 的原则

不要把完整 JSON 原样塞给模型，而是做成清晰文本：

```text
当前任务状态：
- 目标：帮助用户跟进退款
- 当前任务：查询订单状态（running）
- 已知实体：
  - 用户姓名：王磊
  - 订单号：A123
- 用户偏好：简洁回复
- 备注：
  - 用户对延迟较敏感
```

这样模型更容易稳定使用。

---

# 4.6 记忆检索策略：相似度 vs 时间衰减 vs 重要性评分

很多初学者会把长期记忆检索简单理解成“向量相似度最高的前 K 条”。  
这在 Demo 里可以工作，但在真实系统里远远不够。

因为记忆不仅要“像”，还要“新”“重要”。

所以常见记忆打分公式会综合三类因素：

- **相似度（Similarity）**
- **时间衰减（Recency / Time Decay）**
- **重要性（Importance）**

---

## 4.6.1 相似度

这是最基本的检索信号。  
当前问题与某条记忆语义越接近，分数越高。

例如用户说：

> 我上次提到的退款单处理得怎么样了？

与“用户在 5 月 1 日提到退款订单 A123”这条记忆的相似度就会很高。

---

## 4.6.2 时间衰减

不是所有历史记忆都应该永久同权。  
例如：

- “用户今天心情不好”这种状态信息很快就会过期
- “用户姓名是王磊”则非常稳定

时间衰减的一个简单公式：

```ts
export function recencyScore(createdAt: number, now = Date.now()): number {
  const days = (now - createdAt) / (1000 * 60 * 60 * 24);
  return Math.exp(-days / 7); // 7天半衰期的近似效果
}
```

时间越久，分数越低。

---

## 4.6.3 重要性评分

有些内容虽然不新，但非常重要。  
例如：

- 用户的姓名、职位、联系方式
- 长期偏好
- 关键项目背景
- 高价值决策记录

重要性可以在写入记忆时由模型或规则给出一个 1~10 分。

例如规则打分：

- 包含“我叫”“我的公司”“我的偏好” → 高重要性
- 一般寒暄 → 低重要性
- 关键任务结论 → 高重要性

### 综合打分

```ts
export function finalMemoryScore(params: {
  similarity: number;
  recency: number;
  importance: number; // 0~1
}): number {
  const { similarity, recency, importance } = params;
  return similarity * 0.6 + recency * 0.2 + importance * 0.2;
}
```

实际项目中你可以把权重做成可配置项。

---

# 4.7 Embedding 模型选型和分块策略

长期记忆依赖 Embedding，因此模型选型直接影响检索质量。

---

## 4.7.1 Embedding 模型选型

本章实战使用 `text-embedding-3-large`。

常见选择思路：

| 模型 | 特点 | 适用场景 |
|---|---|---|
| text-embedding-3-large | 效果好，语义表达强 | 生产检索、高质量召回 |
| text-embedding-3-small | 成本更低，速度更快 | 大规模低成本场景 |
| 本地开源 embedding | 可私有化 | 数据敏感、离线部署 |

### 选型维度

选择 Embedding 模型时，重点看：

- 语义检索效果
- 成本
- 延迟
- 向量维度
- 多语言能力
- 是否支持私有化

如果你的场景是中文对话型 Agent，建议优先做一个小规模离线评测，不要只看排行榜。

---

## 4.7.2 分块策略

Embedding 不是把所有文本一股脑塞进去。  
需要合理分块（chunking）。

### 为什么要分块

如果块太大：

- 主题混杂
- 检索不精确
- 嵌入成本高

如果块太小：

- 上下文不足
- 语义不完整
- 容易召回碎片化信息

### 常见分块方式

#### 1. 固定长度分块
例如每 500 字一块，重叠 100 字。

优点：实现简单  
缺点：可能切断语义边界

#### 2. 按段落/标题分块
适合文档类知识库。

#### 3. 语义分块
根据文本主题变化动态切分，效果更好但实现更复杂。

### 对话记忆的分块建议

对于聊天记录，不建议按超长全文存。可以按以下单位写入：

- 单轮 user 消息
- user + assistant 组成一组
- 事件型摘要块

一个很实用的策略是：

- 短对话：按一轮问答写入
- 长对话：定期生成“事件摘要块”写入长期记忆

这样既保留原始语义，也减少噪声。

---

# 4.8 实战：用 Qdrant + text-embedding-3-large 实现语义记忆

下面我们实现一个真正可运行的对话 Agent，它具备：

- 短期记忆：最近消息 + Token 裁剪
- 长期记忆：Qdrant 向量存储
- Embedding：`text-embedding-3-large`
- 记忆检索：相似度 + 时间衰减 + 重要性
- 持久化：消息和向量都可保留

---

## 4.8.1 项目结构

```text
memory-agent/
├─ package.json
├─ tsconfig.json
├─ .env
├─ docker-compose.yml
└─ src/
   ├─ index.ts
   ├─ config.ts
   ├─ types.ts
   ├─ token.ts
   ├─ shortMemory.ts
   ├─ scoring.ts
   ├─ store.ts
   ├─ embedding.ts
   ├─ qdrant.ts
   ├─ memoryService.ts
   └─ agent.ts
```

---

## 4.8.2 启动 Qdrant

### docker-compose.yml

```yaml
version: "3.8"

services:
  qdrant:
    image: qdrant/qdrant:latest
    container_name: qdrant-memory-agent
    ports:
      - "6333:6333"
      - "6334:6334"
    volumes:
      - qdrant_data:/qdrant/storage

volumes:
  qdrant_data:
```

启动：

```bash
docker compose up -d
```

---

## 4.8.3 安装依赖

### package.json

```json
{
  "name": "memory-agent",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx src/index.ts"
  },
  "dependencies": {
    "@qdrant/js-client-rest": "^1.9.0",
    "dotenv": "^16.4.5",
    "openai": "^4.57.0",
    "uuid": "^10.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.5.4",
    "tsx": "^4.19.1",
    "typescript": "^5.5.4"
  }
}
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist"
  },
  "include": ["src/**/*.ts"]
}
```

### .env

```env
OPENAI_API_KEY=your_openai_api_key
QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION=agent_memories
```

---

## 4.8.4 定义类型

### src/types.ts

```ts
export type Role = "system" | "user" | "assistant";

export interface Message {
  id: string;
  role: Role;
  content: string;
  createdAt: number;
}

export interface MemoryRecord {
  id: string;
  userId: string;
  conversationId: string;
  content: string;
  createdAt: number;
  importance: number; // 0~1
  source: "dialogue" | "summary" | "profile";
  metadata?: Record<string, unknown>;
}

export interface RetrievedMemory extends MemoryRecord {
  similarity: number;
  recency: number;
  finalScore: number;
}

export interface AgentState {
  userId: string;
  conversationId: string;
  goal: string;
  preferences: string[];
  notes: string[];
  updatedAt: number;
}
```

---

## 4.8.5 配置与 Token 工具

### src/config.ts

```ts
import dotenv from "dotenv";

dotenv.config();

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

export const config = {
  openaiApiKey: required("OPENAI_API_KEY"),
  qdrantUrl: required("QDRANT_URL"),
  qdrantCollection: required("QDRANT_COLLECTION"),
  embeddingModel: "text-embedding-3-large",
  chatModel: "gpt-4o-mini",
  shortMemoryMaxTokens: 2000,
  longMemoryTopK: 8
};
```

### src/token.ts

```ts
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 2);
}

export function trimTextListByToken(
  texts: string[],
  maxTokens: number
): string[] {
  const result: string[] = [];
  let total = 0;

  for (const text of texts) {
    const t = estimateTokens(text);
    if (total + t > maxTokens) break;
    result.push(text);
    total += t;
  }

  return result;
}
```

---

## 4.8.6 短期记忆管理

### src/shortMemory.ts

```ts
import { Message } from "./types.js";
import { estimateTokens } from "./token.js";

export function trimMessagesByToken(
  messages: Message[],
  maxTokens: number
): Message[] {
  const result: Message[] = [];
  let total = 0;

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    const tokens = estimateTokens(msg.content);

    if (total + tokens > maxTokens) {
      break;
    }

    result.unshift(msg);
    total += tokens;
  }

  return result;
}
```

---

## 4.8.7 打分策略

### src/scoring.ts

```ts
export function recencyScore(createdAt: number, now = Date.now()): number {
  const days = (now - createdAt) / (1000 * 60 * 60 * 24);
  return Math.exp(-days / 7);
}

export function finalMemoryScore(params: {
  similarity: number;
  recency: number;
  importance: number;
}): number {
  const { similarity, recency, importance } = params;
  return similarity * 0.6 + recency * 0.2 + importance * 0.2;
}
```

---

## 4.8.8 OpenAI Embedding 与 Chat Client

### src/embedding.ts

```ts
import OpenAI from "openai";
import { config } from "./config.js";

export const openai = new OpenAI({
  apiKey: config.openaiApiKey
});

export async function createEmbedding(text: string): Promise<number[]> {
  const res = await openai.embeddings.create({
    model: config.embeddingModel,
    input: text
  });

  return res.data[0].embedding;
}
```

---

## 4.8.9 Qdrant 封装

### src/qdrant.ts

```ts
import { QdrantClient } from "@qdrant/js-client-rest";
import { config } from "./config.js";
import { MemoryRecord } from "./types.js";

export const qdrant = new QdrantClient({
  url: config.qdrantUrl
});

export async function ensureCollection(vectorSize: number) {
  const collections = await qdrant.getCollections();
  const exists = collections.collections.some(
    (c) => c.name === config.qdrantCollection
  );

  if (!exists) {
    await qdrant.createCollection(config.qdrantCollection, {
      vectors: {
        size: vectorSize,
        distance: "Cosine"
      }
    });
  }
}

export async function upsertMemoryVector(
  memory: MemoryRecord,
  vector: number[]
) {
  await qdrant.upsert(config.qdrantCollection, {
    wait: true,
    points: [
      {
        id: memory.id,
        vector,
        payload: memory
      }
    ]
  });
}

export async function searchMemoryVectors(
  vector: number[],
  userId: string,
  limit: number
) {
  const result = await qdrant.search(config.qdrantCollection, {
    vector,
    limit,
    with_payload: true,
    with_vector: false,
    filter: {
      must: [
        {
          key: "userId",
          match: {
            value: userId
          }
        }
      ]
    }
  });

  return result;
}
```

---

## 4.8.10 本地持久化消息存储

这里为了便于演示，我们用内存 + JSON 文件。  
生产环境可替换为 PostgreSQL / Redis / MongoDB。

### src/store.ts

```ts
import fs from "fs";
import path from "path";
import { Message, AgentState } from "./types.js";

const dataDir = path.join(process.cwd(), "data");
const messageFile = path.join(dataDir, "messages.json");
const stateFile = path.join(dataDir, "states.json");

function ensureDir() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function readJson<T>(file: string, fallback: T): T {
  ensureDir();
  if (!fs.existsSync(file)) return fallback;
  const raw = fs.readFileSync(file, "utf-8");
  return JSON.parse(raw) as T;
}

function writeJson<T>(file: string, value: T) {
  ensureDir();
  fs.writeFileSync(file, JSON.stringify(value, null, 2), "utf-8");
}

export function loadMessages(
  conversationId: string
): Message[] {
  const all = readJson<Record<string, Message[]>>(messageFile, {});
  return all[conversationId] ?? [];
}

export function saveMessages(
  conversationId: string,
  messages: Message[]
) {
  const all = readJson<Record<string, Message[]>>(messageFile, {});
  all[conversationId] = messages;
  writeJson(messageFile, all);
}

export function loadState(
  conversationId: string
): AgentState | null {
  const all = readJson<Record<string, AgentState>>(stateFile, {});
  return all[conversationId] ?? null;
}

export function saveState(
  conversationId: string,
  state: AgentState
) {
  const all = readJson<Record<string, AgentState>>(stateFile, {});
  all[conversationId] = state;
  writeJson(stateFile, all);
}
```

---

## 4.8.11 记忆服务

### src/memoryService.ts

```ts
import { v4 as uuidv4 } from "uuid";
import { createEmbedding } from "./embedding.js";
import { upsertMemoryVector, searchMemoryVectors } from "./qdrant.js";
import { finalMemoryScore, recencyScore } from "./scoring.js";
import { MemoryRecord, RetrievedMemory } from "./types.js";

export function inferImportance(content: string): number {
  const text = content.toLowerCase();

  if (
    content.includes("我叫") ||
    content.includes("我的名字") ||
    content.includes("偏好") ||
    content.includes("重要") ||
    content.includes("订单号") ||
    content.includes("联系方式")
  ) {
    return 0.9;
  }

  if (
    text.includes("谢谢") ||
    text.includes("你好") ||
    text.includes("好的")
  ) {
    return 0.2;
  }

  return 0.5;
}

export async function saveMemory(params: {
  userId: string;
  conversationId: string;
  content: string;
  source?: "dialogue" | "summary" | "profile";
  metadata?: Record<string, unknown>;
}) {
  const record: MemoryRecord = {
    id: uuidv4(),
    userId: params.userId,
    conversationId: params.conversationId,
    content: params.content,
    createdAt: Date.now(),
    importance: inferImportance(params.content),
    source: params.source ?? "dialogue",
    metadata: params.metadata
  };

  const vector = await createEmbedding(record.content);
  await upsertMemoryVector(record, vector);
  return record;
}

export async function retrieveMemories(params: {
  userId: string;
  query: string;
  topK: number;
}): Promise<RetrievedMemory[]> {
  const queryVector = await createEmbedding(params.query);
  const candidates = await searchMemoryVectors(
    queryVector,
    params.userId,
    params.topK * 3
  );

  const rescored: RetrievedMemory[] = candidates
    .map((item) => {
      const payload = item.payload as MemoryRecord;
      const similarity = item.score ?? 0;
      const recency = recencyScore(payload.createdAt);
      const finalScore = finalMemoryScore({
        similarity,
        recency,
        importance: payload.importance
      });

      return {
        ...payload,
        similarity,
        recency,
        finalScore
      };
    })
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, params.topK);

  return rescored;
}
```

---

## 4.8.12 对话 Agent 核心实现

### src/agent.ts

```ts
import { v4 as uuidv4 } from "uuid";
import { openai } from "./embedding.js";
import { config } from "./config.js";
import { trimMessagesByToken } from "./shortMemory.js";
import { loadMessages, saveMessages, loadState, saveState } from "./store.js";
import { retrieveMemories, saveMemory } from "./memoryService.js";
import { AgentState, Message } from "./types.js";

function formatLongMemories(memories: Array<{ content: string; createdAt: number; source: string }>) {
  if (memories.length === 0) return "无";
  return memories
    .map((m, idx) => {
      const date = new Date(m.createdAt).toLocaleString("zh-CN");
      return `${idx + 1}. [${m.source}] (${date}) ${m.content}`;
    })
    .join("\n");
}

function formatState(state: AgentState | null): string {
  if (!state) return "无";
  return [
    `目标：${state.goal}`,
    `偏好：${state.preferences.join("、") || "无"}`,
    `备注：${state.notes.join("；") || "无"}`
  ].join("\n");
}

function systemPrompt() {
  return `
你是一个带记忆能力的对话 Agent。
请遵循以下原则：
1. 优先使用已知用户信息，避免重复询问
2. 如果长期记忆与当前用户输入冲突，以当前输入为准
3. 回复简洁、准确、自然
4. 不要编造不存在的历史
5. 当你发现用户提供了稳定事实（姓名、偏好、项目、订单号等），在回答中自然使用这些信息
`.trim();
}

export async function chat(params: {
  userId: string;
  conversationId: string;
  input: string;
}): Promise<string> {
  const { userId, conversationId, input } = params;

  const history = loadMessages(conversationId);
  const userMessage: Message = {
    id: uuidv4(),
    role: "user",
    content: input,
    createdAt: Date.now()
  };

  const updatedHistory = [...history, userMessage];
  const shortMemory = trimMessagesByToken(
    updatedHistory,
    config.shortMemoryMaxTokens
  );

  const longMemories = await retrieveMemories({
    userId,
    query: input,
    topK: config.longMemoryTopK
  });

  let state = loadState(conversationId);
  if (!state) {
    state = {
      userId,
      conversationId,
      goal: "持续为用户提供准确、有上下文的帮助",
      preferences: [],
      notes: [],
      updatedAt: Date.now()
    };
  }

  if (input.includes("简洁")) {
    state.preferences = Array.from(new Set([...state.preferences, "简洁回复"]));
  }
  if (input.includes("我的名字是") || input.includes("我叫")) {
    state.notes = Array.from(new Set([...state.notes, "用户提供了姓名信息"]));
  }
  state.updatedAt = Date.now();
  saveState(conversationId, state);

  const messages = [
    {
      role: "system" as const,
      content: systemPrompt()
    },
    {
      role: "system" as const,
      content: `当前工作记忆：\n${formatState(state)}`
    },
    {
      role: "system" as const,
      content: `检索到的长期记忆：\n${formatLongMemories(longMemories)}`
    },
    ...shortMemory.map((m) => ({
      role: m.role,
      content: m.content
    }))
  ];

  const response = await openai.chat.completions.create({
    model: config.chatModel,
    messages
  });

  const answer = response.choices[0]?.message?.content ?? "抱歉，我现在无法回答。";

  const assistantMessage: Message = {
    id: uuidv4(),
    role
