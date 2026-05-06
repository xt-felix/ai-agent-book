# 第 14 章：实战案例 — 智能客服 Agent

# 第十四章　实战案例——智能客服 Agent

智能客服是 AI Agent 最经典、也最容易落地的场景之一。它不像“写诗”“闲聊”那样偏展示型，也不像“自动驾驶”“自动交易”那样高风险；它处在一个非常合适的位置：**需求清晰、流程稳定、价值明确、容易量化**。

这一章我们不做“玩具 Demo”，而是从一个可以真正落地的客服系统出发，完整实现一个基于 **LangGraph 状态机 + RAG 检索增强 + 工具调用** 的智能客服 Agent。系统支持：

- 多轮对话
- 意图路由
- 知识库问答
- 工单创建
- 人工转接
- 情绪检测
- 上下文维护
- Docker 化部署
- 监控与灰度发布
- 效果评估指标体系

为了兼顾可读性和实战性，本章采用：

- **TypeScript 作为主实现语言**
- **Python 作为知识库构建辅助脚本**
- 使用 **OpenAI 兼容接口**，方便替换模型供应商
- 后端基于 **Node.js + Express**
- Agent 编排基于 **LangGraph**
- 向量检索默认采用 **PostgreSQL + pgvector**
- 可运行、可扩展、可上线

---

## 14.1 场景需求分析

先不要急着写代码。一个能上线的智能客服系统，最重要的不是“模型多强”，而是 **边界清晰、流程闭环、失败可兜底**。

---

## 14.1.1 业务目标

以一个 SaaS 平台客服系统为例，用户常见诉求包括：

1. **产品使用咨询**
   - “如何重置密码？”
   - “为什么收不到验证码？”
   - “如何开通团队版？”

2. **订单与账单问题**
   - “我的发票怎么下载？”
   - “为什么自动扣费了？”
   - “怎么取消订阅？”

3. **故障申报**
   - “系统一直报 502”
   - “上传文件失败”
   - “接口响应很慢”

4. **服务请求**
   - “帮我创建工单”
   - “我要联系人工客服”

如果完全依赖人工，成本高、响应慢、夜间不可用。如果完全交给大模型，又会遇到几个问题：

- 容易幻觉
- 无法访问企业内部知识
- 无法执行真实业务动作
- 无法稳定处理投诉、升级、转人工

因此我们需要一个 **“可回答 + 可行动 + 可升级”** 的 Agent 系统。

---

## 14.1.2 核心能力拆解

智能客服 Agent 至少要具备五类能力。

### 1. 多轮对话

用户不会总是一句话把问题说清楚。真实场景里常见这样的对话：

> 用户：我账号登不上了  
> Agent：请问是密码错误、验证码失败，还是提示账号不存在？  
> 用户：验证码一直收不到  
> Agent：请问您是用手机号登录还是邮箱登录？  
> 用户：手机号

这要求系统能保留上下文，并根据前文继续追问或回答。

---

### 2. 意图路由

客服不是只有“问答”一种形式。用户可能是在：

- 询问知识库问题
- 查询工单状态
- 创建工单
- 请求人工客服
- 表达不满或投诉

因此需要先识别意图，再决定进入哪个处理分支。

一个典型意图集合可以定义为：

| 意图 | 说明 |
|---|---|
| `faq` | 常见问题咨询 |
| `billing` | 账单/支付相关 |
| `troubleshooting` | 故障排查 |
| `create_ticket` | 创建工单 |
| `handoff_human` | 转人工 |
| `smalltalk` | 闲聊/寒暄 |
| `unknown` | 无法识别 |

---

### 3. 知识库问答

客服回答必须尽量基于企业文档，而不是“凭感觉”。这就要求系统具备：

- 文档清洗
- 分块
- 向量化
- 检索
- 重排
- 引用依据回答

也就是典型的 **RAG（Retrieval-Augmented Generation）**。

---

### 4. 工单创建

当问题无法当场解决时，Agent 需要主动引导用户补充信息并创建工单，比如：

- 问题描述
- 联系方式
- 优先级
- 产品模块
- 截图/日志

这就不是单纯生成文字，而是调用业务系统 API 执行动作。

---

### 5. 人工转接

当出现以下情况时，应果断转人工：

- 多次无法命中答案
- 用户情绪激烈
- 涉及退款、投诉、法律风险
- 账号安全问题
- 高价值客户升级服务

转人工不是一句“请联系客服”就结束，而要把上下文、意图、摘要、历史对话一起交给人工坐席，避免用户重复描述。

---

## 14.1.3 非功能性要求

除了功能，还要考虑工程上的约束：

- **可观测性**：能看到每轮意图、检索结果、工具调用、耗时
- **可灰度**：支持新版本对一部分流量上线
- **可回放**：方便分析失败案例
- **可扩展**：未来增加退款、订单查询、售后流程
- **可控**：有置信度阈值和转人工兜底

---

## 14.2 系统架构设计

这一节我们从整体架构入手，解释为什么选择 **LangGraph 状态机 + RAG + 工具集** 的方案。

---

## 14.2.1 总体架构

整体流程如下：

```text
用户消息
   ↓
API 接入层
   ↓
会话管理 / 历史上下文
   ↓
LangGraph Agent 状态机
   ├── 意图识别
   ├── 情绪检测
   ├── 知识库检索（RAG）
   ├── 故障排查引导
   ├── 工单创建工具
   ├── 人工转接工具
   └── 最终回复生成
   ↓
响应用户 + 记录日志 + 指标上报
```

---

## 14.2.2 为什么用 LangGraph

纯函数调用链或者简单 Agent Loop 也能做客服，但客服场景存在明显的**状态转换**：

- 一个会话可能先 FAQ，再变成故障排查，再升级为工单
- 某些节点需要条件跳转
- 某些路径可重复执行，比如重新检索
- 转人工是一个明确的终止状态

这类问题非常适合用 **状态机 / 图编排** 来建模。

LangGraph 的优势在于：

1. **显式状态定义**
2. **节点职责清晰**
3. **条件路由可控**
4. **便于调试和可视化**
5. **适合复杂多轮流程**

---

## 14.2.3 状态定义

客服会话可以用下面这份状态来表达：

```ts
type CustomerServiceState = {
  sessionId: string;
  userId?: string;
  userMessage: string;
  history: ChatMessage[];
  intent?: string;
  sentiment?: "positive" | "neutral" | "negative";
  retrievedDocs?: RetrievedDoc[];
  answer?: string;
  needsTicket?: boolean;
  needsHuman?: boolean;
  ticketDraft?: TicketDraft;
  ticketId?: string;
  handoffId?: string;
  confidence?: number;
};
```

其中关键字段：

- `history`：维护多轮上下文
- `intent`：控制流程路由
- `retrievedDocs`：RAG 依据
- `ticketDraft`：创建工单时的槽位信息
- `needsHuman`：随时可触发人工转接

---

## 14.2.4 状态流转设计

我们设计如下状态图：

```text
START
  ↓
load_context
  ↓
analyze_intent
  ↓
detect_sentiment
  ↓
route_by_intent
   ├── faq / billing / troubleshooting → retrieve_kb → generate_answer
   │                                      └── low_confidence → ask_clarify / handoff
   ├── create_ticket → collect_ticket_info → create_ticket
   ├── handoff_human → handoff_human
   ├── smalltalk → smalltalk_answer
   └── unknown → ask_clarify / handoff
  ↓
save_history
  ↓
END
```

这个设计的特点是：

- **先分析、再路由**
- **检索和业务动作分离**
- **失败路径明确**
- **低置信度自动兜底**

---

## 14.2.5 RAG 在客服中的位置

知识库问答不是整个系统，而是其中一个子能力。

在客服场景中，RAG 主要用于回答：

- 产品说明
- 操作步骤
- 规则政策
- 故障排查建议
- 账单说明
- 常见问题

但以下情况不应该完全靠 RAG：

- 工单创建
- 退款审批
- 账户敏感操作
- 投诉升级
- SLA 承诺

这些需要工具调用或人工处理。

---

## 14.3 项目初始化

下面开始搭建完整项目。

---

## 14.3.1 目录结构

项目结构如下：

```bash
smart-cs-agent/
├── package.json
├── tsconfig.json
├── .env.example
├── Dockerfile
├── docker-compose.yml
├── src/
│   ├── app.ts
│   ├── config.ts
│   ├── types.ts
│   ├── graph/
│   │   └── customerServiceGraph.ts
│   ├── llm/
│   │   └── model.ts
│   ├── memory/
│   │   └── sessionStore.ts
│   ├── retriever/
│   │   ├── pgVectorStore.ts
│   │   └── search.ts
│   ├── tools/
│   │   ├── createTicket.ts
│   │   └── handoffHuman.ts
│   ├── services/
│   │   ├── intent.ts
│   │   ├── sentiment.ts
│   │   ├── answer.ts
│   │   └── ticket.ts
│   ├── routes/
│   │   └── chat.ts
│   └── utils/
│       ├── logger.ts
│       └── metrics.ts
├── scripts/
│   └── init.sql
└── kb_builder/
    ├── requirements.txt
    └── build_kb.py
```

---

## 14.3.2 安装依赖

### package.json

```json
{
  "name": "smart-cs-agent",
  "version": "1.0.0",
  "description": "Intelligent customer service agent with LangGraph + RAG",
  "main": "dist/app.js",
  "scripts": {
    "dev": "tsx watch src/app.ts",
    "build": "tsc",
    "start": "node dist/app.js"
  },
  "dependencies": {
    "@langchain/core": "^0.3.17",
    "@langchain/langgraph": "^0.2.39",
    "@langchain/openai": "^0.3.14",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "pg": "^8.12.0",
    "pino": "^9.3.2",
    "prom-client": "^15.1.3",
    "uuid": "^10.0.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "@types/node": "^22.5.4",
    "tsx": "^4.19.1",
    "typescript": "^5.6.2"
  }
}
```

安装：

```bash
npm install
```

---

## 14.3.3 TypeScript 配置

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true
  },
  "include": ["src/**/*.ts"]
}
```

---

## 14.3.4 环境变量

### .env.example

```env
PORT=3000
OPENAI_API_KEY=your_api_key
OPENAI_BASE_URL=https://api.openai.com/v1
MODEL_NAME=gpt-4o-mini
EMBEDDING_MODEL=text-embedding-3-small

PG_HOST=localhost
PG_PORT=5432
PG_USER=postgres
PG_PASSWORD=postgres
PG_DATABASE=smart_cs

HUMAN_HANDOFF_QUEUE_URL=http://human-service:8080/handoff
TICKET_SERVICE_URL=http://ticket-service:8081/tickets
```

复制并修改：

```bash
cp .env.example .env
```

---

## 14.4 核心代码实现

下面进入完整实现。

---

## 14.4.1 配置与类型定义

### src/config.ts

```ts
import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: Number(process.env.PORT || 3000),
  openAIApiKey: process.env.OPENAI_API_KEY || "",
  openAIBaseURL: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
  modelName: process.env.MODEL_NAME || "gpt-4o-mini",
  embeddingModel: process.env.EMBEDDING_MODEL || "text-embedding-3-small",
  pg: {
    host: process.env.PG_HOST || "localhost",
    port: Number(process.env.PG_PORT || 5432),
    user: process.env.PG_USER || "postgres",
    password: process.env.PG_PASSWORD || "postgres",
    database: process.env.PG_DATABASE || "smart_cs"
  },
  humanHandoffQueueUrl: process.env.HUMAN_HANDOFF_QUEUE_URL || "http://localhost:8080/handoff",
  ticketServiceUrl: process.env.TICKET_SERVICE_URL || "http://localhost:8081/tickets"
};
```

### src/types.ts

```ts
export type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
  ts: number;
};

export type RetrievedDoc = {
  id: string;
  title: string;
  content: string;
  source: string;
  score: number;
};

export type TicketDraft = {
  title?: string;
  description?: string;
  contact?: string;
  priority?: "low" | "medium" | "high";
  category?: string;
};

export type CustomerServiceState = {
  sessionId: string;
  userId?: string;
  userMessage: string;
  history: ChatMessage[];
  intent?: "faq" | "billing" | "troubleshooting" | "create_ticket" | "handoff_human" | "smalltalk" | "unknown";
  sentiment?: "positive" | "neutral" | "negative";
  retrievedDocs?: RetrievedDoc[];
  answer?: string;
  needsTicket?: boolean;
  needsHuman?: boolean;
  ticketDraft?: TicketDraft;
  ticketId?: string;
  handoffId?: string;
  confidence?: number;
};
```

---

## 14.4.2 大模型封装

### src/llm/model.ts

```ts
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { config } from "../config.js";

export const chatModel = new ChatOpenAI({
  model: config.modelName,
  apiKey: config.openAIApiKey,
  configuration: {
    baseURL: config.openAIBaseURL
  },
  temperature: 0.2
});

export const embeddingModel = new OpenAIEmbeddings({
  model: config.embeddingModel,
  apiKey: config.openAIApiKey,
  configuration: {
    baseURL: config.openAIBaseURL
  }
});
```

---

## 14.4.3 日志与指标

### src/utils/logger.ts

```ts
import pino from "pino";

export const logger = pino({
  level: "info",
  transport: process.env.NODE_ENV !== "production"
    ? {
        target: "pino-pretty",
        options: { colorize: true }
      } as any
    : undefined
});
```

> 如果你想使用 `pino-pretty`，请额外安装：
>
> ```bash
> npm install pino-pretty
> ```

### src/utils/metrics.ts

```ts
import client from "prom-client";

export const register = new client.Registry();
client.collectDefaultMetrics({ register });

export const chatRequestCounter = new client.Counter({
  name: "chat_requests_total",
  help: "Total chat requests",
  registers: [register]
});

export const handoffCounter = new client.Counter({
  name: "chat_handoff_total",
  help: "Total handoff to human",
  registers: [register]
});

export const ticketCounter = new client.Counter({
  name: "chat_ticket_total",
  help: "Total tickets created",
  registers: [register]
});

export const responseLatency = new client.Histogram({
  name: "chat_response_latency_ms",
  help: "Response latency in ms",
  buckets: [50, 100, 300, 500, 1000, 2000, 5000],
  registers: [register]
});
```

---

## 14.4.4 会话存储

为了便于演示，我们先用内存实现 Session Store。生产环境可替换成 Redis。

### src/memory/sessionStore.ts

```ts
import { ChatMessage } from "../types.js";

class SessionStore {
  private sessions = new Map<string, ChatMessage[]>();

  getHistory(sessionId: string): ChatMessage[] {
    return this.sessions.get(sessionId) || [];
  }

  append(sessionId: string, message: ChatMessage) {
    const current = this.sessions.get(sessionId) || [];
    current.push(message);
    this.sessions.set(sessionId, current.slice(-20));
  }

  setHistory(sessionId: string, history: ChatMessage[]) {
    this.sessions.set(sessionId, history.slice(-20));
  }
}

export const sessionStore = new SessionStore();
```

---

## 14.4.5 PostgreSQL + pgvector 检索层

先创建数据库表。

### scripts/init.sql

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS kb_documents (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  source TEXT NOT NULL,
  embedding vector(1536) NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS kb_documents_embedding_idx
ON kb_documents
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

### src/retriever/pgVectorStore.ts

```ts
import pg from "pg";
import { config } from "../config.js";

export const pool = new pg.Pool({
  host: config.pg.host,
  port: config.pg.port,
  user: config.pg.user,
  password: config.pg.password,
  database: config.pg.database
});

export async function healthCheckDb() {
  const client = await pool.connect();
  try {
    await client.query("SELECT 1");
    return true;
  } finally {
    client.release();
  }
}
```

### src/retriever/search.ts

```ts
import { embeddingModel } from "../llm/model.js";
import { pool } from "./pgVectorStore.js";
import { RetrievedDoc } from "../types.js";

function toSqlVector(vec: number[]) {
  return `[${vec.join(",")}]`;
}

export async function searchKnowledgeBase(query: string, limit = 4): Promise<RetrievedDoc[]> {
  const vector = await embeddingModel.embedQuery(query);
  const sqlVector = toSqlVector(vector);

  const sql = `
    SELECT id, title, content, source,
           1 - (embedding <=> $1::vector) AS score
    FROM kb_documents
    ORDER BY embedding <=> $1::vector
    LIMIT $2
  `;

  const result = await pool.query(sql, [sqlVector, limit]);

  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    content: row.content,
    source: row.source,
    score: Number(row.score)
  }));
}
```

---

## 14.4.6 意图识别服务

### src/services/intent.ts

```ts
import { chatModel } from "../llm/model.js";

export async function detectIntent(message: string) {
  const prompt = `
你是客服意图分类器。
请根据用户消息识别意图，只返回 JSON：
{
  "intent": "faq|billing|troubleshooting|create_ticket|handoff_human|smalltalk|unknown",
  "confidence": 0~1
}

用户消息：
${message}
  `;

  const res = await chatModel.invoke(prompt);
  const text = typeof res.content === "string" ? res.content : JSON.stringify(res.content);

  try {
    const json = JSON.parse(text);
    return {
      intent: json.intent || "unknown",
      confidence: Number(json.confidence || 0)
    };
  } catch {
    return {
      intent: "unknown",
      confidence: 0.3
    };
  }
}
```

---

## 14.4.7 情绪检测服务

### src/services/sentiment.ts

```ts
import { chatModel } from "../llm/model.js";

export async function detectSentiment(message: string): Promise<"positive" | "neutral" | "negative"> {
  const prompt = `
请判断下面用户消息的情绪，只返回一个单词：
positive / neutral / negative

消息：
${message}
  `;

  const res = await chatModel.invoke(prompt);
  const text = String(res.content).trim().toLowerCase();

  if (text.includes("negative")) return "negative";
  if (text.includes("positive")) return "positive";
  return "neutral";
}
```

---

## 14.4.8 工单工具

为了确保项目可运行，我们实现一个本地模拟工单服务工具，而不是依赖外部 API。

### src/tools/createTicket.ts

```ts
import { randomUUID } from "uuid";
import { TicketDraft } from "../types.js";

const ticketDb: Record<string, any> = {};

export async function createTicketTool(draft: TicketDraft) {
  const id = randomUUID();
  ticketDb[id] = {
    id,
    ...draft,
    status: "open",
    createdAt: new Date().toISOString()
  };

  return ticketDb[id];
}
```

### src/tools/handoffHuman.ts

```ts
import { randomUUID } from "uuid";

const handoffDb: Record<string, any> = {};

export async function handoffHumanTool(payload: {
  sessionId: string;
  summary: string;
  history: { role: string; content: string; ts: number }[];
}) {
  const id = randomUUID();
  handoffDb[id] = {
    id,
    ...payload,
    status: "queued",
    createdAt: new Date().toISOString()
  };

  return handoffDb[id];
}
```

---

## 14.4.9 工单信息抽取

创建工单时，用户常常不会一次性把信息说完整，因此我们要先抽取已有槽位。

### src/services/ticket.ts

```ts
import { chatModel } from "../llm/model.js";
import { TicketDraft } from "../types.js";

export async function extractTicketDraft(message: string, existing: TicketDraft = {}): Promise<TicketDraft> {
  const prompt = `
你是工单信息抽取器。请从用户消息中提取工单字段，返回 JSON，不要额外解释：
{
  "title": "",
  "description": "",
  "contact": "",
  "priority": "low|medium|high",
  "category": ""
}

已有草稿：
${JSON.stringify(existing, null, 2)}

用户消息：
${message}
  `;

  const res = await chatModel.invoke(prompt);
  const text = typeof res.content === "string" ? res.content : JSON.stringify(res.content);

  try {
    const json = JSON.parse(text);
    return {
      title: json.title || existing.title,
      description: json.description || existing.description,
      contact: json.contact || existing.contact,
      priority: json.priority || existing.priority,
      category: json.category || existing.category
    };
  } catch {
    return existing;
  }
}

export function missingTicketFields(draft: TicketDraft): string[] {
  const fields: string[] = [];
  if (!draft.title) fields.push("title");
  if (!draft.description) fields.push("description");
  if (!draft.contact) fields.push("contact");
  if (!draft.priority) fields.push("priority");
  if (!draft.category) fields.push("category");
  return fields;
}
```

---

## 14.4.10 基于 RAG 的回答生成

### src/services/answer.ts

```ts
import { ChatMessage, RetrievedDoc } from "../types.js";
import { chatModel } from "../llm/model.js";

export async function generateAnswer(params: {
  userMessage: string;
  history: ChatMessage[];
  docs: RetrievedDoc[];
  sentiment?: string;
}) {
  const { userMessage, history, docs, sentiment } = params;

  const historyText = history
    .slice(-6)
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");

  const docsText = docs
    .map((d, i) => `文档${i + 1}（来源: ${d.source}, 分数: ${d.score.toFixed(3)}）\n标题: ${d.title}\n内容: ${d.content}`)
    .join("\n\n");

  const prompt = `
你是企业智能客服，请严格遵守以下规则：
1. 优先依据检索文档回答，不要编造制度、价格、功能或承诺。
2. 如果资料不足，请明确说明，并建议创建工单或转人工。
3. 回答简洁、礼貌、可执行。
4. 如果用户情绪为 negative，请先表达理解，再给出解决方案。
5. 若答案包含步骤，请使用编号列表。
6. 如果文档无法支持结论，不要强行回答。

用户情绪：${sentiment || "neutral"}

历史对话：
${historyText}

检索文档：
${docsText}

当前用户问题：
${userMessage}

请生成客服回复。
  `;

  const res = await chatModel.invoke(prompt);
  return String(res.content);
}
```

---

## 14.4.11 LangGraph 客服状态机

这是本章最核心的部分。

### src/graph/customerServiceGraph.ts

```ts
import { StateGraph, Annotation, START, END } from "@langchain/langgraph";
import { CustomerServiceState } from "../types.js";
import { sessionStore } from "../memory/sessionStore.js";
import { detectIntent } from "../services/intent.js";
import { detectSentiment } from "../services/sentiment.js";
import { searchKnowledgeBase } from "../retriever/search.js";
import { generateAnswer } from "../services/answer.js";
import { extractTicketDraft, missingTicketFields } from "../services/ticket.js";
import { createTicketTool } from "../tools/createTicket.js";
import { handoffHumanTool } from "../tools/handoffHuman.js";

const CustomerServiceAnnotation = Annotation.Root({
  sessionId: Annotation<string>(),
  userId: Annotation<string | undefined>(),
  userMessage: Annotation<string>(),
  history: Annotation<any[]>({
    reducer: (_, next) => next,
    default: () => []
  }),
  intent: Annotation<any>(),
  sentiment: Annotation<any>(),
  retrievedDocs: Annotation<any[]>({
    reducer: (_, next) => next,
    default: () => []
  }),
  answer: Annotation<string | undefined>(),
  needsTicket: Annotation<boolean | undefined>(),
  needsHuman: Annotation<boolean | undefined>(),
  ticketDraft: Annotation<any>({
    reducer: (_, next) => next,
    default: () => ({})
  }),
  ticketId: Annotation<string | undefined>(),
  handoffId: Annotation<string | undefined>(),
  confidence: Annotation<number | undefined>()
});

async function loadContext(state: CustomerServiceState) {
  return {
    history: sessionStore.getHistory(state.sessionId)
  };
}

async function analyzeIntent(state: CustomerServiceState) {
  const result = await detectIntent(state.userMessage);
  return {
    intent: result.intent,
    confidence: result.confidence
  };
}

async function detectEmotion(state: CustomerServiceState) {
  const sentiment = await detectSentiment(state.userMessage);
  return {
    sentiment,
    needsHuman: sentiment === "negative" && (state.confidence || 0) < 0.6
  };
}

async function retrieveKb(state: CustomerServiceState) {
  const docs = await searchKnowledgeBase(state.userMessage, 4);
  return {
    retrievedDocs: docs,
    needsHuman: docs.length === 0 ? true : state.needsHuman
  };
}

async function generateFaqAnswer(state: CustomerServiceState) {
  const docs = state.retrievedDocs || [];
  const topScore = docs[0]?.score || 0;
  const answer = await generateAnswer({
    userMessage: state.userMessage,
    history: state.history,
    docs,
    sentiment: state.sentiment
  });

  return {
    answer,
    needsHuman: state.needsHuman || topScore < 0.55
  };
}

async function collectTicketInfo(state: CustomerServiceState) {
  const draft = await extractTicketDraft(state.userMessage, state.ticketDraft || {});
  const missing = missingTicketFields(draft);

  if (missing.length > 0) {
    const cnMap: Record<string, string> = {
      title: "问题标题",
      description: "问题描述",
      contact: "联系方式",
      priority: "优先级",
      category: "问题分类"
    };

    return {
      ticketDraft: draft,
      answer: `为了帮您创建工单，还需要补充以下信息：${missing.map((f) => cnMap[f]).join("、")}。请直接回复这些信息。`,
      needsTicket: true
    };
  }

  return {
    ticketDraft: draft,
    needsTicket: false
  };
}

async function createTicketNode(state: CustomerServiceState) {
  const ticket = await createTicketTool(state.ticketDraft || {});
  return {
    ticketId: ticket.id,
    answer: `已为您创建工单，工单号：${ticket.id}。我们的工程师会尽快处理，您也可以继续补充问题细节。`
  };
}

async function handoffHumanNode(state: CustomerServiceState) {
  const summary = `用户意图: ${state.intent}；情绪: ${state.sentiment}；最近问题: ${state.userMessage}`;
  const handoff = await handoffHumanTool({
    sessionId: state.sessionId,
    summary,
    history: state.history
  });

  return {
    handoffId: handoff.id,
    answer: `已为您转接人工客服，排队编号：${handoff.id}。人工客服接入前，我也可以继续帮您整理问题。`
  };
}

async function smalltalkNode() {
  return {
    answer: "您好，我可以协助您处理产品使用、账单问题、故障排查、创建工单以及转接人工客服。请告诉我您遇到的问题。"
  };
}

async function saveHistory(state: CustomerServiceState) {
  const nextHistory = [
    ...state.history,
    { role: "user", content: state.userMessage, ts: Date.now() },
    { role: "assistant", content: state.answer || "", ts: Date.now() }
  ];
  sessionStore.setHistory(state.sessionId, nextHistory);
  return {
    history: nextHistory
  };
}

function routeIntent(state: CustomerServiceState) {
  if (state.intent === "create_ticket") return "collect_ticket_info";
  if (state.intent === "handoff_human") return "handoff_human";
  if (state.intent === "smalltalk") return "smalltalk";
  if (state.intent === "faq" || state.intent === "billing" || state.intent === "troubleshooting") return "retrieve_kb";
  return "handoff_or_clarify";
}

function routeAfterRetrieve(state: CustomerServiceState) {
  if ((state.retrievedDocs || []).length === 0) return "handoff_human";
  return "generate_answer";
}

function routeAfterAnswer(state: CustomerServiceState) {
  if (state.needsHuman) return "handoff_human";
  return "save_history";
}

function routeAfterCollectTicket(state: CustomerServiceState) {
  if (state.needsTicket) return "save_history";
  return "create_ticket";
}

function handoffOrClarify(state: CustomerServiceState) {
  if ((state.confidence || 0) < 0.5 || state.sentiment === "negative") return "handoff_human";
  return "smalltalk";
}

export function buildCustomerServiceGraph() {
  const graph = new StateGraph(CustomerServiceAnnotation)
    .addNode("load_context", loadContext)
    .addNode("analyze_intent", analyzeIntent)
    .addNode("detect_sentiment", detectEmotion)
    .addNode("retrieve_kb", retrieveKb)
    .addNode("generate_answer", generateFaqAnswer)
    .addNode("collect_ticket_info", collectTicketInfo)
    .addNode("create_ticket", createTicketNode)
    .addNode("handoff_human", handoffHumanNode)
    .addNode("smalltalk", smalltalkNode)
    .addNode("save_history", saveHistory)
    .addEdge(START, "load_context")
    .addEdge("load_context", "analyze_intent")
    .addEdge("analyze_intent", "detect_sentiment")
    .addConditionalEdges("detect_sentiment", routeIntent, {
      retrieve_kb: "retrieve_kb",
      collect_ticket_info: "collect_ticket_info",
      handoff_human: "handoff_human",
      smalltalk: "smalltalk",
      handoff_or_clarify: "smalltalk"
    })
    .addConditionalEdges("retrieve_kb", routeAfterRetrieve, {
      generate_answer: "generate_answer",
      handoff_human: "handoff_human"
    })
    .addConditionalEdges("generate_answer", routeAfterAnswer, {
      handoff_human: "handoff_human",
      save_history: "save_history"
    })
    .addConditionalEdges("collect_ticket_info", routeAfterCollectTicket, {
      create_ticket: "create_ticket",
      save_history: "save_history"
    })
    .addEdge("create_ticket", "save_history")
    .addEdge("handoff_human", "save_history")
    .addEdge("smalltalk", "save_history")
    .addEdge("save_history", END);

  return graph.compile();
}
```

> 注意：为保持代码直观，这里把“unknown → clarify”简化成 `smalltalk` 节点提示。生产中你可以单独增加 `clarify` 节点。

---

## 14.4.12 HTTP API

### src/routes/chat.ts

```ts
import { Router } from "express";
import { buildCustomerServiceGraph } from "../graph/customerServiceGraph.js";
import { chatRequestCounter, handoffCounter, responseLatency, ticketCounter } from "../utils/metrics.js";

const router = Router();
const appGraph = buildCustomerServiceGraph();

router.post("/", async (req, res) => {
  const end = responseLatency.startTimer();
  chatRequestCounter.inc();

  try {
    const { sessionId, userId, message } = req.body as {
      sessionId: string;
      userId?: string;
      message: string;
    };

    if (!sessionId || !message) {
      return res.status(400).json({ error: "sessionId and message are required" });
    }

    const result = await appGraph.invoke({
      sessionId,
      userId,
      userMessage: message,
      history: []
    });

    if (result.handoffId) handoffCounter.inc();
    if (result.ticketId) ticketCounter.inc();

    res.json({
      sessionId,
      intent: result.intent,
      sentiment: result.sentiment,
      answer: result.answer,
      ticketId: result.ticketId,
      handoffId: result.handoffId,
      confidence: result.confidence,
      docs: (result.retrievedDocs || []).map((d: any) => ({
        title: d.title,
        source: d.source,
        score: d.score
      }))
    });
  } catch (error: any)
