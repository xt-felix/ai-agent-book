# 第 12 章：MCP 协议 — Agent 的通用接口

# 第十二章：MCP 协议 —— Agent 的通用接口

当我们把一个大模型从“会聊天”推进到“能做事”，问题就变成了：**模型如何安全、标准、可扩展地访问外部能力**。

最早期的做法通常是给模型塞一组函数定义，也就是大家熟悉的 **Function Calling**。这种方式非常实用，但一旦系统变复杂，你很快会遇到几个问题：

- 每个 Agent 框架都定义一套自己的工具协议
- 工具不仅仅是“函数”，还可能是文件、数据库、知识库、提示模板
- 一个工具集往往需要被多个模型客户端复用
- 工具调用过程需要权限控制、版本管理、能力发现
- Agent 需要连接的不只是一个工具，而是一整组“外部服务”

这时就需要一个更通用的标准层。**MCP（Model Context Protocol）**，正是为这个问题而生。

---

## 12.1 MCP 是什么

**MCP（Model Context Protocol）** 是 Anthropic 提出的一个开放协议，用于在 **模型客户端（Client）** 与 **外部能力提供方（Server）** 之间建立标准化通信。

你可以把它理解成：

- 对于 Web 应用，HTTP 是通用接口
- 对于数据库，SQL 是通用接口
- 对于 Agent 接入外部能力，**MCP 就是在尝试成为通用接口**

MCP 的目标不是替代所有 Agent 框架，而是提供一个**跨模型、跨框架、跨工具实现的标准协议**，让不同的客户端都能发现、读取、调用外部能力。

它解决的不是“模型怎么推理”，而是“模型怎么接世界”。

### 12.1.1 MCP 要解决的核心问题

在 Agent 系统中，模型通常需要以下几类外部上下文：

1. **工具（Tool）**  
   能被调用执行的能力，例如：
   - 查询数据库
   - 调用搜索接口
   - 发消息
   - 创建工单
   - 执行代码

2. **资源（Resource）**  
   能被读取的静态或半静态内容，例如：
   - 文件
   - 文档
   - 配置
   - 数据表 schema
   - API 说明

3. **提示模板（Prompt）**  
   供客户端或模型复用的结构化 Prompt，例如：
   - SQL 分析助手提示词
   - 客服工单处理模板
   - 代码审查模板

MCP 的意义在于：这些能力不再由每个应用自己定义一套 JSON 结构，而是通过统一协议暴露出来。

### 12.1.2 MCP 的定位

MCP 不是大模型本身的一部分，它更像是 **Agent Runtime 和外部世界之间的适配层**。

一个典型链路如下：

```text
LLM / Agent
   ↓
MCP Client
   ↓
MCP Server A（数据库）
MCP Server B（文件系统）
MCP Server C（内部知识库）
MCP Server D（工单系统）
```

模型不需要知道数据库 SDK、HTTP 细节、鉴权方式。它只需要知道：

- 有哪些能力
- 每个能力接收什么参数
- 调用后返回什么结果

这是一个非常重要的抽象层。

---

## 12.2 核心概念：Server / Client / Tool / Resource / Prompt

理解 MCP，先理解它的几个核心对象。

---

### 12.2.1 Server

**MCP Server** 是能力提供方。它负责把外部系统能力暴露给 MCP Client。

一个 Server 可以封装：

- 数据库
- 本地文件系统
- Git 仓库
- 搜索引擎
- SaaS API
- 企业内部系统

Server 的职责通常包括：

- 声明自己提供哪些工具、资源、提示模板
- 接收客户端请求
- 执行真实逻辑
- 返回结构化结果
- 做权限控制、参数校验、错误处理

你可以把它看成一个“为 Agent 设计的能力网关”。

---

### 12.2.2 Client

**MCP Client** 是能力消费方。它一般嵌在 Agent Runtime、桌面应用、IDE 插件或聊天产品中。

Client 的职责包括：

- 连接一个或多个 MCP Server
- 拉取能力清单
- 将工具描述提供给模型
- 接收模型的调用意图
- 发起真实的 MCP 请求
- 把结果再喂给模型

如果说 Server 负责“暴露能力”，那么 Client 负责“组织能力给模型使用”。

---

### 12.2.3 Tool

**Tool** 是可执行能力，最接近我们熟悉的 function calling。

例如：

- `query_orders`
- `search_docs`
- `send_email`
- `create_ticket`

一个 Tool 通常包含：

- 名称
- 描述
- 输入参数 schema
- 输出结果内容

和普通函数调用不同的是，MCP Tool 是协议级对象，可被不同客户端发现、理解、调用。

示例概念：

```json
{
  "name": "query_users",
  "description": "查询用户信息",
  "inputSchema": {
    "type": "object",
    "properties": {
      "keyword": { "type": "string" },
      "limit": { "type": "number" }
    },
    "required": ["keyword"]
  }
}
```

---

### 12.2.4 Resource

**Resource** 是可读取的上下文资源。

例如：

- `file://docs/api.md`
- `db://schema/users`
- `kb://product/faq`
- `config://app/settings`

Resource 的典型用途是：

- 给模型读取知识而不是调用函数
- 提供稳定文档上下文
- 暴露机器可读取的元信息

比如，数据库 MCP Server 可以提供一个资源：

- `schema://tables/orders`

客户端读取这个资源后，模型就知道 `orders` 表有哪些字段，而不需要在 prompt 里手写 schema。

---

### 12.2.5 Prompt

**Prompt** 是结构化提示模板。

这是 MCP 和很多“工具调用协议”不一样的地方。它认为除了工具与资源，提示词本身也应该可复用、可发现。

例如一个 Prompt 可以定义为：

- “SQL 分析助手”
- “把用户需求转成数据库查询”
- “按照公司规范生成客服回复”

Prompt 的价值在于：

- 将经验模板从应用逻辑中剥离
- 由 Server 统一维护
- 多个客户端可共享使用

---

## 12.3 为什么需要 MCP：对比自定义 Function Calling

很多团队会问：  
“我们已经有 Function Calling 了，为什么还要 MCP？”

答案是：**Function Calling 解决了模型调用函数的问题，但没有完整解决 Agent 接入外部世界的问题。**

---

### 12.3.1 自定义 Function Calling 的优点

先说优点。自定义函数调用并不是错，很多中小项目完全够用：

- 实现快
- 直接集成在应用内
- 对单一模型或单一框架足够实用
- 学习成本低

例如你在一个 Node.js 服务里定义几个工具：

```ts
const tools = [
  {
    name: "queryOrders",
    description: "查询订单",
    parameters: {
      type: "object",
      properties: {
        userId: { type: "string" }
      },
      required: ["userId"]
    }
  }
];
```

然后把这个定义直接传给模型即可。

如果系统很小，这种方式没有问题。

---

### 12.3.2 自定义 Function Calling 的局限

问题出现在规模增长之后。

#### 1. 协议碎片化

每个框架都有自己的工具定义格式：

- OpenAI function/tool schema
- LangChain tool abstraction
- LlamaIndex tool interface
- 各种自研 JSON 协议

结果就是：

- 工具定义无法复用
- 服务端实现和客户端实现强绑定
- 一套工具要写多份适配层

#### 2. 工具之外的能力没有统一表达

Function Calling 关注的是“调用函数”，但 Agent 需要的不止函数：

- 文档资源怎么暴露？
- prompt 模板怎么管理？
- 能力发现怎么做？
- 版本协商怎么做？

这类问题通常会变成一堆零散的私有约定。

#### 3. 多客户端接入困难

如果你希望：

- Claude Desktop 能接
- 自己的 Web Agent 能接
- IDE 插件能接
- 另一个内部 Agent 平台也能接

那么自定义 function calling 基本意味着每个客户端都要单独适配。

#### 4. 工具服务无法独立演进

自定义调用往往嵌在应用内部，导致：

- 工具难以独立部署
- 能力发现弱
- 不适合团队协作
- 版本管理困难

---

### 12.3.3 MCP 的优势

MCP 提供的是一种更完整的标准化能力层：

| 维度 | 自定义 Function Calling | MCP |
|---|---|---|
| 工具调用 | 支持 | 支持 |
| 资源读取 | 通常无统一规范 | 原生支持 |
| Prompt 模板 | 一般自行实现 | 原生支持 |
| 能力发现 | 弱 | 强 |
| 多客户端复用 | 差 | 好 |
| 协议标准化 | 弱 | 强 |
| 工具服务独立部署 | 一般 | 适合 |
| 生态互通 | 差 | 正在形成 |

一句话概括：

> Function Calling 更像“在一个应用里给模型加几个函数”；  
> MCP 更像“为 Agent 建立通用外设总线”。

---

## 12.4 实战：用 TypeScript 实现一个 MCP Server（数据库查询工具）

下面我们做一个完整的实战：实现一个 **MCP Server**，它提供：

- 一个 Tool：查询订单数据
- 一个 Resource：读取数据库 schema
- 一个 Prompt：SQL 助手模板

为了保证示例可运行，我们用 **SQLite** 作为数据库。

---

## 12.4.1 项目目标

我们要实现的 MCP Server 具备以下能力：

1. Tool: `query_orders`
   - 根据用户 ID 查询订单
   - 支持状态过滤和数量限制

2. Tool: `get_order_by_id`
   - 根据订单 ID 查询单条订单

3. Resource: `schema://orders`
   - 返回 `orders` 表结构说明

4. Prompt: `sql_assistant`
   - 返回一个帮助模型理解数据库查询边界的提示模板

---

## 12.4.2 初始化项目

目录结构如下：

```text
mcp-db-server/
├─ package.json
├─ tsconfig.json
├─ src/
│  ├─ server.ts
│  ├─ db.ts
│  └─ init-db.ts
└─ data/
   └─ app.db
```

### package.json

```json
{
  "name": "mcp-db-server",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "dev": "tsx src/server.ts",
    "init-db": "tsx src/init-db.ts"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.12.0",
    "better-sqlite3": "^9.6.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.11",
    "tsx": "^4.19.2",
    "typescript": "^5.6.2"
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

安装依赖：

```bash
npm install
```

---

## 12.4.3 初始化 SQLite 数据库

### src/init-db.ts

```ts
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const dataDir = path.resolve("data");
const dbPath = path.join(dataDir, "app.db");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);

db.exec(`
DROP TABLE IF EXISTS orders;

CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  amount REAL NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`);

const insert = db.prepare(`
  INSERT INTO orders (id, user_id, product_name, amount, status, created_at)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const rows = [
  ["ord_001", "u_1001", "MacBook Pro", 12999, "paid", "2025-01-02T10:00:00Z"],
  ["ord_002", "u_1001", "Magic Mouse", 699, "shipped", "2025-01-03T08:30:00Z"],
  ["ord_003", "u_1002", "iPhone 15", 5999, "pending", "2025-01-04T11:20:00Z"],
  ["ord_004", "u_1003", "AirPods Pro", 1899, "paid", "2025-01-05T15:45:00Z"],
  ["ord_005", "u_1001", "USB-C Cable", 99, "cancelled", "2025-01-06T09:10:00Z"]
];

const tx = db.transaction((items: any[]) => {
  for (const item of items) insert.run(...item);
});

tx(rows);

console.log(`Database initialized at ${dbPath}`);
db.close();
```

执行初始化：

```bash
npm run init-db
```

---

## 12.4.4 数据库访问层

### src/db.ts

```ts
import path from "node:path";
import Database from "better-sqlite3";

export type OrderStatus = "pending" | "paid" | "shipped" | "cancelled";

export interface Order {
  id: string;
  user_id: string;
  product_name: string;
  amount: number;
  status: OrderStatus;
  created_at: string;
}

const dbPath = path.resolve("data/app.db");
const db = new Database(dbPath, { readonly: true });

export function queryOrders(params: {
  userId: string;
  status?: OrderStatus;
  limit?: number;
}): Order[] {
  const { userId, status, limit = 10 } = params;

  const safeLimit = Math.min(Math.max(limit, 1), 50);

  if (status) {
    const stmt = db.prepare(`
      SELECT id, user_id, product_name, amount, status, created_at
      FROM orders
      WHERE user_id = ? AND status = ?
      ORDER BY created_at DESC
      LIMIT ?
    `);

    return stmt.all(userId, status, safeLimit) as Order[];
  }

  const stmt = db.prepare(`
    SELECT id, user_id, product_name, amount, status, created_at
    FROM orders
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `);

  return stmt.all(userId, safeLimit) as Order[];
}

export function getOrderById(orderId: string): Order | null {
  const stmt = db.prepare(`
    SELECT id, user_id, product_name, amount, status, created_at
    FROM orders
    WHERE id = ?
  `);

  const row = stmt.get(orderId) as Order | undefined;
  return row ?? null;
}

export function getOrdersSchema(): string {
  return `
Table: orders
Columns:
- id TEXT PRIMARY KEY
- user_id TEXT NOT NULL
- product_name TEXT NOT NULL
- amount REAL NOT NULL
- status TEXT NOT NULL
- created_at TEXT NOT NULL

Status enum:
- pending
- paid
- shipped
- cancelled
`.trim();
}
```

---

## 12.4.5 实现 MCP Server

下面是完整的 MCP Server 实现。

### src/server.ts

```ts
import { z } from "zod";
import {
  McpServer
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getOrderById, getOrdersSchema, queryOrders } from "./db.js";

const server = new McpServer({
  name: "db-query-server",
  version: "1.0.0"
});

// Tool 1: query_orders
server.tool(
  "query_orders",
  "根据用户 ID 查询订单列表，可选按状态过滤",
  {
    userId: z.string().min(1).describe("用户 ID，例如 u_1001"),
    status: z
      .enum(["pending", "paid", "shipped", "cancelled"])
      .optional()
      .describe("订单状态过滤"),
    limit: z.number().int().min(1).max(50).optional().describe("返回数量限制，最大 50")
  },
  async ({ userId, status, limit }) => {
    try {
      const orders = queryOrders({ userId, status, limit });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                total: orders.length,
                items: orders
              },
              null,
              2
            )
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `查询订单失败：${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      };
    }
  }
);

// Tool 2: get_order_by_id
server.tool(
  "get_order_by_id",
  "根据订单 ID 查询单个订单详情",
  {
    orderId: z.string().min(1).describe("订单 ID，例如 ord_001")
  },
  async ({ orderId }) => {
    try {
      const order = getOrderById(orderId);

      if (!order) {
        return {
          content: [
            {
              type: "text",
              text: `未找到订单：${orderId}`
            }
          ],
          isError: true
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(order, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `查询订单详情失败：${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      };
    }
  }
);

// Resource: schema://orders
server.resource(
  "orders-schema",
  "schema://orders",
  {
    description: "orders 表结构说明",
    mimeType: "text/plain"
  },
  async () => {
    return {
      contents: [
        {
          uri: "schema://orders",
          mimeType: "text/plain",
          text: getOrdersSchema()
        }
      ]
    };
  }
);

// Prompt: sql_assistant
server.prompt(
  "sql_assistant",
  "用于数据库查询分析的提示模板",
  () => {
    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `
你是一个数据库查询助手。
请遵循以下规则：
1. 只能访问 orders 相关信息
2. 优先使用已有工具，不要虚构数据
3. 若用户问题缺少 userId 或 orderId，先追问
4. 对返回结果做清晰总结，避免直接输出难读的原始 JSON
`.trim()
          }
        }
      ]
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP DB Server started on stdio");
}

main().catch((err) => {
  console.error("Server failed:", err);
  process.exit(1);
});
```

---

## 12.4.6 运行 MCP Server

直接启动：

```bash
npm run dev
```

这个服务使用 **stdio transport**，适合本地桌面端、CLI 或 Agent Runtime 进程托管场景。

在真实 MCP Client 中，客户端会拉取：

- tools 列表
- resources 列表
- prompts 列表

然后在用户提问时决定调用哪些能力。

---

## 12.4.7 设计要点分析

上面的实现虽然不长，但已经体现了 MCP Server 的几个重要特征。

### 1. Tool 定义与实现是同一层暴露

```ts
server.tool(...)
```

这里不仅注册了函数，还注册了：

- 名称
- 描述
- 参数 schema
- 实际处理逻辑

这意味着客户端可以自动发现能力，并把参数要求告诉模型。

### 2. Resource 和 Tool 分工明确

- Tool 用于“执行动作”
- Resource 用于“读取上下文”

例如 `schema://orders` 就非常适合资源化，因为 schema 本身通常不是动作，而是知识。

### 3. Prompt 可以沉淀业务经验

Prompt 不是散落在客户端代码中，而是和工具一同发布。这样多个 Agent 客户端都可以复用同样的业务约束。

---

## 12.5 实战：让 Agent 连接多个 MCP Server

单个 MCP Server 的价值在于模块化；多个 MCP Server 的价值在于**能力组合**。

下面我们实现一个简单的 TypeScript Agent Client，它连接两个 MCP Server：

1. `db-query-server`：数据库查询
2. `fs-context-server`：文件上下文读取（这里我们会给一个最简示例）

---

## 12.5.1 一个简单的文件资源 Server

### src/fs-server.ts

```ts
import fs from "node:fs/promises";
import path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new McpServer({
  name: "fs-context-server",
  version: "1.0.0"
});

server.resource(
  "faq-doc",
  "file://faq/order-policy.txt",
  {
    description: "订单政策 FAQ 文档",
    mimeType: "text/plain"
  },
  async () => {
    const filePath = path.resolve("data/order-policy.txt");
    const text = await fs.readFile(filePath, "utf-8");

    return {
      contents: [
        {
          uri: "file://faq/order-policy.txt",
          mimeType: "text/plain",
          text
        }
      ]
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("FS MCP Server started on stdio");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

准备测试文件：

### data/order-policy.txt

```txt
订单政策：
1. paid 状态订单可申请售后
2. shipped 状态订单可查询物流
3. cancelled 状态订单不可重复支付
4. pending 状态订单超过 30 分钟可能自动关闭
```

---

## 12.5.2 Agent 连接多个 MCP Server 的思路

真实生产中，Agent Runtime 一般会：

1. 启动多个 MCP Server 子进程
2. 分别建立 Client 连接
3. 拉取各自的 tool / resource / prompt
4. 合并成统一能力视图
5. 在推理循环中按需调用

这里重点不是实现一个完整 LLM Agent，而是展示**如何组织多个 MCP Server**。

下面给一个结构化示例。

---

## 12.5.3 多 Server Client 示例

由于不同版本 SDK 的 Client API 可能有细微差异，这里给出一个更稳定的工程实践写法：**把 MCP Server 作为独立进程，通过配置进行统一管理**。Agent 运行时只关心 server 清单。

### mcp-servers.json

```json
{
  "servers": [
    {
      "name": "db",
      "command": "npm",
      "args": ["run", "dev"]
    },
    {
      "name": "fs",
      "command": "node",
      "args": ["dist/fs-server.js"]
    }
  ]
}
```

在实际接入 Claude Desktop 或其他支持 MCP 的客户端时，一般也是用这种“声明多个 server”的方式。

一个更贴近生产的 Agent 能力聚合逻辑如下：

```ts
type ServerConfig = {
  name: string;
  command: string;
  args: string[];
};

type ToolDescriptor = {
  server: string;
  name: string;
  description: string;
};

type ResourceDescriptor = {
  server: string;
  uri: string;
  description?: string;
};

class McpRegistry {
  private tools: ToolDescriptor[] = [];
  private resources: ResourceDescriptor[] = [];

  registerTool(tool: ToolDescriptor) {
    this.tools.push(tool);
  }

  registerResource(resource: ResourceDescriptor) {
    this.resources.push(resource);
  }

  listTools() {
    return this.tools;
  }

  listResources() {
    return this.resources;
  }
}
```

实际运行时：

- DB Server 提供订单查询工具
- FS Server 提供 FAQ 文档资源
- Agent 先读 FAQ，再决定是否查订单
- 这就是多 Server 协作

### 一个典型场景

用户提问：

> 用户 u_1001 最近的订单是什么状态？如果是 pending，顺便告诉我订单政策。

Agent 可以这样规划：

1. 调用 `query_orders(userId=u_1001, limit=1)`
2. 如果返回状态为 `pending`
3. 再读取资源 `file://faq/order-policy.txt`
4. 组合答案返回

这里最大的收益是：

- 订单能力来自 DB Server
- 政策说明来自 FS Server
- 两者独立开发、独立部署、独立维护

这就是 MCP 的组合性。

---

## 12.6 生态：已有的 MCP Server 生态和社区

MCP 真正有吸引力的地方，不只是协议设计，而是它正在形成一个可复用的生态。

目前社区里已经出现了很多现成的 MCP Server，常见方向包括：

### 12.6.1 文件系统类

- 本地文件读写
- 目录遍历
- 项目代码搜索
- 文档读取

适用于：

- IDE Agent
- 文档问答
- 代码助手

### 12.6.2 开发工具类

- Git 仓库操作
- GitHub API
- Shell 命令执行
- 数据库查询
- 日志分析

适用于：

- 工程助手
- 运维 Agent
- 自动化排障

### 12.6.3 知识与检索类

- 向量数据库检索
- 文档库查询
- 企业知识库
- Wiki / Notion / Confluence 接入

适用于：

- 企业问答
- 内部 Copilot
- 客服知识检索

### 12.6.4 SaaS / 办公系统类

- Slack
- Email
- Calendar
- Jira
- CRM
- 工单系统

适用于：

- 办公自动化 Agent
- 销售助手
- 客服助手

### 12.6.5 社区生态的意义

社区生态一旦成熟，MCP Server 就会像“驱动程序”一样存在：

- 你不用为每个系统手写适配
- 只要接入标准协议即可
- Agent 平台的能力扩展速度会显著提升

这和早期 API 网关生态、CI 插件生态、浏览器插件生态的演化路径很像。

---

## 12.7 与 OpenAI Plugin / GPTs 的对比

MCP 常被拿来和 OpenAI Plugin、GPTs 进行比较。它们确实都在解决“让模型使用外部能力”的问题，但设计目标不完全相同。

---

### 12.7.1 与 OpenAI Plugin 的区别

OpenAI Plugin 的思路更偏向：

- 基于 OpenAPI 描述远程 HTTP 能力
- 服务通过网络暴露
- 强依赖特定平台接入模式

而 MCP 的思路更偏向：

- 标准化模型上下文与工具接口
- 不仅支持工具，还支持 resource / prompt
- 支持本地进程、stdio 等更灵活的集成方式
- 更强调“客户端—服务端”的协议交互

对比表如下：

| 维度 | OpenAI Plugin | MCP |
|---|---|---|
| 提出方 | OpenAI | Anthropic |
| 主要能力表达 | HTTP API / OpenAPI | Tool / Resource / Prompt |
| 本地集成 | 较弱 | 强 |
| 资源读取模型 | 较弱 | 强 |
| Prompt 作为协议对象 | 否 | 是 |
| 客户端适配空间 | 相对平台化 | 更通用 |

### 12.7.2 与 GPTs 的区别

GPTs 更像是**产品形态**：

- 给终端用户快速配置一个定制化 GPT
- 通过知识、指令、动作扩展能力
- 平台使用体验强

MCP 更像是**基础协议**：

- 面向开发者
- 面向 Agent 基础设施
- 面向跨客户端复用

简单说：

- GPTs 是“做一个 AI 应用实例”
- MCP 是“做一个 AI 能力接口标准”

### 12.7.3 是否互斥

不互斥。

真实生产里，你完全可以：

- 内部能力通过 MCP 暴露
- 上层产品通过自己的 Agent UI 或 GPT 风格产品消费这些能力

也就是说，MCP 更适合做底座，不一定直接面向最终用户。

---

## 12.8 最佳实践：安全、性能、版本管理

MCP 很强，但也意味着你把更多外部能力交给了 Agent。能力越强，风险越大。

---

### 12.8.1 安全：永远默认不可信

#### 1. 工具最小权限原则

不要把“万能数据库执行器”直接暴露给模型。  
优先暴露**受约束的、高层语义工具**：

- 好：`get_order_by_id`
- 一般：`query_orders`
- 差：`execute_sql(sql: string)`

原因很简单：越通用，越难控。

#### 2. 严格参数校验

本章示例中使用了 `zod`：

```ts
userId: z.string().min(1)
limit: z.number().int().min(1).max(50).optional()
```

这是必须的，而不是可选的。校验应覆盖：

- 类型
- 长度
- 枚举范围
- 数值边界
- 正则格式

#### 3. 对资源做访问隔离

如果是文件系统类资源，不要允许任意路径访问。  
应该：

- 限定工作目录
- 做路径白名单
- 禁止读取密钥文件、系统目录

#### 4. 审计日志

所有工具调用都应该记录：

- 谁发起
- 调用了哪个 server
- 调用了哪个 tool
- 参数是什么
- 结果如何
- 耗时多少

这对排障和安全审计都很重要。

#### 5. 高风险操作必须二次确认

例如：

- 发邮件
- 删除文件
- 执行 shell
- 提交 Git
- 修改数据库

即便模型“认为”应该做，也不应自动执行。要有：

- confirm step
- human-in-the-loop
- 审批流程

---

### 12.8.2 性能：把 Agent 工具层做成可观测系统

#### 1. 控制 Tool 粒度

工具不要过细，也不要过粗。

- 过细：模型要调用很多次，延迟高
- 过粗：能力不透明，难复用

例如订单系统中：

- `get_order_by_id` 是合理粒度
- `get_everything_about_customer` 往往过粗
- `get_order_id_prefix` 往往过细

#### 2. 做缓存

对于 Resource 类能力，适合做缓存，例如：

- schema
- FAQ
- 配置
- 文档目录

缓存可以降低：

- 重复 I/O
- 重复网络请求
- 上下文加载成本

#### 3. 限流与超时

每个 Tool 调用都应设置：

- timeout
- concurrency limit
- retry policy

例如数据库查询：

- 超过 3 秒即失败
- 单会话最多并发 5 次
- 幂等请求允许有限重试

#### 4. 结果裁剪

不要把大段原始数据直接返回给模型。  
要尽量：

- 分页
- limit
- 摘要化
- 字段裁剪

这不仅省 token，也提高模型决策质量。

---

### 12.8.3 版本管理：协议稳定比功能堆叠更重要

#### 1. Server 版本显式声明

示例中我们已经写了：

```ts
const server = new McpServer({
  name: "db-query-server",
  version: "1.0.0"
});
```

这不是装饰信息，它关系到客户端兼容性。

#### 2. Tool schema 要尽量向后兼容

例如你原来的工具是：

```ts
{
  userId: string
}
```

后来新增字段：

```ts
{
  userId: string,
  status?: string
}
```

这是安全的向后兼容。

但如果你把 `userId` 改名为 `uid`，旧客户端和旧 prompt 可能立刻失效。

#### 3. 用新工具替代破坏性修改

如果确实要大改，不要直接替换老工具，而是新增版本化工具：

- `query_orders`
- `query_orders_v2`

这虽然略显啰嗦，但比线上静默破坏要安全得多。

#### 4. Resource URI 设计要稳定

资源 URI 一旦被客户端引用，就相当于公共接口。建议：

- 用可读前缀
- 保持命名稳定
- 区分版本与语义

例如：

- `schema://orders`
- `schema://v2/orders`
- `kb://support/refund-policy`

---

## 12.9 一个可落地的工程建议

如果你准备在公司内部落地 MCP，不要一开始就追求“万物 MCP 化”。更推荐这样的推进路径：

### 第一步：从只读工具开始

优先做：

- 查数据库
- 读文档
- 读知识库
- 查日志

避免一开始就做高风险写操作。

### 第二步：把高价值公共能力抽出来

例如：

- 用户信息查询
- 订单查询
- FAQ 检索
- GitHub Issue 查询

这些能力往往会被多个 Agent 复用，非常适合做成 MCP Server。

### 第三步：建立统一接入规范

定义内部标准：

- Tool 命名规范
- 参数 schema 规范
- 错误码规范
- 鉴权方式
- 日志字段
- 版本策略

否则团队一多，很快会重新陷入“虽然都叫 MCP，但每个人都写得不一样”的新混乱。

---

## 12.10 Python 辅助示例：快速验证数据库内容

虽然本章主实现使用 TypeScript，但很多团队也会用 Python 做数据验证。下面给一个简单脚本，确认 SQLite 中的订单数据。

### verify_db.py

```python
import sqlite3
from pathlib import Path

db_path = Path("data/app.db")
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

rows = cursor.execute("""
SELECT id, user_id, product_name, amount, status, created_at
FROM orders
ORDER BY created_at DESC
""").fetchall()

for row in rows:
    print(row)

conn.close()
```

运行：

```bash
python verify_db.py
```

---

## 12.11 你应该如何理解 MCP

到这里，你会发现 MCP 的真正价值不在于“又多了一个协议名词”，而在于它提供了一种
