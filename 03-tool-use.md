# 第 3 章：工具调用 — 让 Agent 有手有脚

# 第三章 工具调用 —— 让 Agent 有手有脚

大模型如果只会“说”，那它本质上还是一个强大的文本补全器。  
一旦它能“调用工具”，就开始具备行动能力：搜索网页、读取文件、执行代码、访问数据库、发送邮件、操作业务系统。

这一章我们聚焦 Agent 最核心的能力之一：**Tool Use / Function Calling**。你会看到：

- 不同模型厂商在工具调用协议上的设计差异
- 如何定义“模型容易用、人类也容易维护”的工具
- 如何实现一个真正可运行的 Agent：
  - Web 搜索
  - 代码执行
  - 文件读写
- 如何处理多工具编排、依赖链、重试
- 如何建立安全边界，避免 Agent “能力失控”

本章以 **TypeScript** 为主，使用 **OpenAI SDK** 完成完整代码示例。

---

## 3.1 为什么工具调用是 Agent 的分水岭

如果没有工具，模型只能依赖训练语料和上下文窗口回答问题。这会带来三个天然限制：

1. **知识不是实时的**
   - 训练截止后的信息无法知道
   - 外部系统状态也无法感知

2. **无法执行动作**
   - 不能查数据库
   - 不能发起 HTTP 请求
   - 不能运行脚本
   - 不能读写本地文件

3. **无法形成闭环**
   - 只能建议“你去做什么”
   - 不能真的“帮你完成”

Agent 之所以称为 Agent，不在于它会“思考”，而在于它能：

- 感知环境
- 选择动作
- 执行动作
- 观察结果
- 继续决策

而工具调用正是这条闭环中的“动作接口”。

可以把它理解为：

| 组件 | 类比 |
|---|---|
| LLM | 大脑 |
| Memory | 记忆 |
| Planner | 计划器 |
| Tools | 手和脚 |
| Runtime | 神经系统 |
| Guardrails | 安全约束 |

没有工具，Agent 只是一个很聪明的顾问；  
有了工具，Agent 才开始像一个真正的执行体。

---

## 3.2 Function Calling / Tool Use 的协议设计

工具调用不是“让模型随便输出一个函数名”那么简单。  
它背后需要一套协议，确保以下事情可控：

- 模型如何知道有哪些工具可用
- 如何描述工具用途与参数
- 模型如何表达“我要调用工具”
- 应用层如何执行工具
- 工具结果如何回传给模型
- 模型如何基于结果继续回答

不同厂商在协议层的设计并不完全相同。最有代表性的两类是：

- **OpenAI 风格**
- **Anthropic 风格**

下面分别看。

---

## 3.3 OpenAI 的工具调用协议

OpenAI 的典型思路是：

1. 在请求中传入 `tools`
2. 每个工具包含：
   - `name`
   - `description`
   - `parameters`（JSON Schema）
3. 模型决定是否调用工具
4. 如果要调用，返回 `tool_calls`
5. 应用层执行工具
6. 将工具结果作为消息追加回对话
7. 再次请求模型，生成最终答案或继续调用更多工具

这种设计的优势是：

- 结构明确
- 易于解析
- 适配前后端应用场景
- JSON Schema 约束比较成熟

### OpenAI 风格的核心结构

工具定义大致像这样：

```json
{
  "type": "function",
  "function": {
    "name": "web_search",
    "description": "Search the web for recent information",
    "parameters": {
      "type": "object",
      "properties": {
        "query": {
          "type": "string",
          "description": "Search keywords"
        }
      },
      "required": ["query"],
      "additionalProperties": false
    }
  }
}
```

模型如果要调用，会返回类似：

```json
{
  "tool_calls": [
    {
      "id": "call_123",
      "type": "function",
      "function": {
        "name": "web_search",
        "arguments": "{\"query\":\"OpenAI latest SDK changes\"}"
      }
    }
  ]
}
```

然后应用层执行 `web_search`，再把结果送回模型。

### OpenAI 协议特点

#### 1. JSON Schema 友好
工具参数一般用 JSON Schema 表达，非常适合工程落地。

#### 2. “模型出意图，应用执行”
模型不会直接运行代码，而是给出结构化调用请求，执行权在业务程序手里。

#### 3. 多轮闭环自然
模型调用工具后，可以继续调用其他工具，直到得到足够信息。

#### 4. 易于做审计和权限控制
因为每次调用都以结构化数据出现，便于记录、过滤、审批。

---

## 3.4 Anthropic 的工具调用协议

Anthropic 的工具使用思路和 OpenAI 很像，但在消息结构和响应块设计上更“内容块化”。

它通常强调：

- 输入消息由多个 block 构成
- 模型输出也由多个 block 构成
- 工具调用常以 `tool_use` block 形式出现
- 工具结果通过 `tool_result` block 回传

### Anthropic 风格示意

工具定义：

```json
{
  "name": "web_search",
  "description": "Search the web for recent information",
  "input_schema": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string"
      }
    },
    "required": ["query"]
  }
}
```

模型响应可能包含：

```json
[
  {
    "type": "text",
    "text": "I’ll search for that."
  },
  {
    "type": "tool_use",
    "id": "toolu_01",
    "name": "web_search",
    "input": {
      "query": "OpenAI latest SDK changes"
    }
  }
]
```

应用层执行后再传：

```json
[
  {
    "type": "tool_result",
    "tool_use_id": "toolu_01",
    "content": "..."
  }
]
```

### Anthropic 协议特点

#### 1. 消息块更加统一
文本、工具调用、工具结果都作为 block 存在，协议语义更一致。

#### 2. 更强调“生成内容的一部分”
工具调用像是模型输出流中的一个结构化节点，而不是完全独立于文本回答。

#### 3. 对复杂多模态扩展比较自然
当内容块中既有文本、图像、工具调用时，这种设计很方便扩展。

---

## 3.5 OpenAI vs Anthropic：协议对比

下面做一个工程视角的对比。

| 维度 | OpenAI | Anthropic |
|---|---|---|
| 工具定义 | `tools[].function.parameters` | `tools[].input_schema` |
| 调用返回 | `tool_calls` | `tool_use` block |
| 工具结果回传 | 作为工具消息加入上下文 | `tool_result` block |
| 结构风格 | 偏 API 调用式 | 偏内容块流式 |
| JSON Schema 支持 | 强 | 强 |
| 集成难度 | 低 | 中 |
| 适合场景 | 通用业务系统、后端 Agent | 多块内容交互、复杂消息流 |

### 怎么选？

如果你在做：

- 企业内部 Agent
- 工作流型助手
- CRM / ERP / 客服 / 运维系统集成
- 后端服务编排

那么 OpenAI 风格非常直接，工程上也更稳定。

如果你在做：

- 更复杂的多模态交互
- 消息 block 层面的细粒度控制
- 需要把工具调用嵌入复杂内容流

那么 Anthropic 风格可能更顺手。

不过从本章的代码实现角度，**我们采用 OpenAI SDK**，因为它对 TypeScript 开发者更容易上手，也最适合讲清楚工具调用的基本闭环。

---

## 3.6 工具定义的最佳实践

很多项目的工具调用效果不好，不是模型不行，而是**工具定义太差**。  
一个糟糕的工具定义，会导致：

- 模型选错工具
- 参数填错
- 无法稳定命中
- 工具之间边界模糊
- 维护成本极高

工具定义本质上是在做一件事：**把自然语言任务压缩成机器可执行接口**。  
这个接口设计得越清晰，Agent 越稳定。

---

## 3.7 JSON Schema 设计原则

### 1. 参数要最小化

坏例子：

```json
{
  "type": "object",
  "properties": {
    "query": { "type": "string" },
    "language": { "type": "string" },
    "region": { "type": "string" },
    "sortBy": { "type": "string" },
    "useAdvancedRanking": { "type": "boolean" },
    "includeRawHtml": { "type": "boolean" },
    "maxTokenBudget": { "type": "number" }
  }
}
```

如果这些参数大部分用户都不关心，模型反而更容易乱填。

更好的做法是：

- 只暴露必须参数
- 给常用参数合理默认值
- 把复杂策略放到工具实现内部

比如：

```json
{
  "type": "object",
  "properties": {
    "query": {
      "type": "string",
      "description": "The search query"
    },
    "top_k": {
      "type": "integer",
      "description": "Maximum number of results, default 5",
      "minimum": 1,
      "maximum": 10
    }
  },
  "required": ["query"],
  "additionalProperties": false
}
```

### 2. 使用 `additionalProperties: false`

这是一个非常关键但经常被忽略的点。

如果不加，模型可能会凭空生成：

- `date_range`
- `source`
- `country_code`
- `confidence`
- 甚至拼错字段名

这些字段如果没有被严格校验，就会把你的执行逻辑搞乱。

建议所有工具参数 schema 都加上：

```json
"additionalProperties": false
```

### 3. 为字段写“可执行描述”

差的描述：

- `query: search query`
- `path: file path`

好的描述：

- `query`: “Search keywords for recent factual information from the web”
- `path`: “Relative file path under the sandbox workspace, such as notes/todo.md. Absolute paths are not allowed.”

字段描述不是写给人看的文档，而是写给模型看的“隐式提示词”。

### 4. 明确枚举值

如果参数只有有限选项，不要让模型自由发挥。

例如：

```json
{
  "type": "string",
  "enum": ["read", "write", "append"]
}
```

而不是：

```json
{
  "type": "string",
  "description": "operation type"
}
```

### 5. 对数值做边界约束

比如：

```json
{
  "type": "integer",
  "minimum": 1,
  "maximum": 20
}
```

这能减少模型给出极端值导致资源浪费。

---

## 3.8 工具描述怎么写才有效

工具的 `description` 决定模型**何时选择它**。  
好的描述应该包含三类信息：

1. **这个工具是干什么的**
2. **什么时候应该调用**
3. **什么时候不应该调用**

### 示例：Web 搜索

差的写法：

> Search the web.

好的写法：

> Search the public web for recent or external factual information. Use this tool when the user asks about news, current events, external documentation, or anything that may be outside the model's training data. Do not use it for pure reasoning or text rewriting tasks.

这段描述实际上给了模型一套“决策边界”。

### 示例：代码执行

差的写法：

> Execute code.

好的写法：

> Execute short Python code in a sandbox to perform calculations, data transformation, or quick analysis. Use this tool when exact computation is needed. Do not use it for accessing the network, long-running jobs, or system administration.

### 示例：文件读写

差的写法：

> Read and write files.

更好的做法是拆开：

- `read_file`
- `write_file`

因为“读”和“写”是不同风险等级的动作，合并后会让模型的选择边界模糊，也增加权限控制难度。

---

## 3.9 参数设计的实践建议

### 1. 一工具一职责

不要定义一个“万能工具”：

- `system_operation`
- `execute_action`
- `do_task`

这种工具看似灵活，实则让模型决策变得模糊，也让权限控制失效。

更好的拆分：

- `web_search`
- `read_file`
- `write_file`
- `run_python`

### 2. 输出格式尽量稳定

工具返回值也应该结构化，不要返回随意字符串。  
比如搜索工具可以返回：

```json
{
  "query": "OpenAI SDK",
  "results": [
    {
      "title": "...",
      "url": "...",
      "snippet": "..."
    }
  ]
}
```

这样模型更容易引用、总结和继续决策。

### 3. 给路径、URL、命令设置边界

尤其是这些高风险字段：

- 文件路径
- Shell 命令
- SQL 语句
- URL

不要让模型直接控制宿主机敏感资源。

### 4. 高风险工具要能审批

例如：

- 删除文件
- 发送邮件
- 调用支付接口
- 修改数据库

这些操作最好支持：

- dry-run
- 审批确认
- 审计日志
- 权限分级

---

## 3.10 实战目标：一个带 Web 搜索 + 代码执行 + 文件读写的 Agent

下面我们实现一个完整的 TypeScript 项目，包含：

- **web_search**：通过 DuckDuckGo HTML 页面做简单搜索抓取
- **run_python**：在受限目录中执行 Python 代码
- **read_file**：读取工作区文件
- **write_file**：写入工作区文件

同时具备：

- 工具循环调用
- 并行执行独立工具
- 依赖链处理
- 错误重试
- 沙箱目录限制
- 写操作审批钩子

> 说明：  
> - Web 搜索这里采用公开 HTML 抓取方式，便于示例可运行。生产环境建议接入正规的搜索 API。  
> - Python 代码执行依赖本机安装 `python3`。  
> - 文件读写限定在 `workspace/` 目录下。  

---

## 3.11 项目结构

```text
agent-tool-use/
├─ package.json
├─ tsconfig.json
├─ .env
├─ src/
│  └─ index.ts
└─ workspace/
   └─ notes.txt
```

---

## 3.12 安装依赖

`package.json`

```json
{
  "name": "agent-tool-use",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx src/index.ts",
    "start": "node --env-file=.env dist/index.js",
    "build": "tsc"
  },
  "dependencies": {
    "dotenv": "^16.4.5",
    "openai": "^4.76.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/node": "^22.10.1",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2"
  }
}
```

`tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "outDir": "dist",
    "rootDir": "src",
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts"]
}
```

`.env`

```bash
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4.1-mini
```

---

## 3.13 完整 TypeScript 代码

下面是完整可运行代码：`src/index.ts`

```ts
import "dotenv/config";
import OpenAI from "openai";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import { z } from "zod";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const WORKSPACE_DIR = path.resolve(process.cwd(), "workspace");
const MAX_TOOL_ITERATIONS = 8;
const MAX_RETRIES = 2;

// ---------- Utility ----------
async function ensureWorkspace() {
  await fs.mkdir(WORKSPACE_DIR, { recursive: true });
}

function resolveSafePath(relativePath: string): string {
  if (path.isAbsolute(relativePath)) {
    throw new Error("Absolute paths are not allowed.");
  }
  const normalized = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, "");
  const fullPath = path.resolve(WORKSPACE_DIR, normalized);
  if (!fullPath.startsWith(WORKSPACE_DIR)) {
    throw new Error("Path escapes workspace.");
  }
  return fullPath;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(fn: () => Promise<T>, retries = MAX_RETRIES): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < retries) {
        await sleep(500 * (i + 1));
      }
    }
  }
  throw lastErr;
}

function extractTextFromResponse(resp: any): string {
  if (resp.output_text) return resp.output_text;
  if (Array.isArray(resp.output)) {
    const parts: string[] = [];
    for (const item of resp.output) {
      if (item.type === "message" && Array.isArray(item.content)) {
        for (const c of item.content) {
          if (c.type === "output_text" || c.type === "text") {
            parts.push(c.text);
          }
        }
      }
    }
    return parts.join("\n");
  }
  return "";
}

// ---------- Tool Implementations ----------
const webSearchInput = z.object({
  query: z.string().min(1),
  top_k: z.number().int().min(1).max(10).default(5),
});

async function webSearch(args: unknown) {
  const { query, top_k } = webSearchInput.parse(args);

  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; AgentToolUseDemo/1.0)",
    },
  });

  if (!response.ok) {
    throw new Error(`Web search failed with status ${response.status}`);
  }

  const html = await response.text();

  const results: Array<{ title: string; url: string; snippet: string }> = [];
  const regex =
    /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>(.*?)<\/a>/g;

  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null && results.length < top_k) {
    const [, rawUrl, rawTitle, rawSnippet] = match;
    const clean = (s: string) =>
      s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

    results.push({
      title: clean(rawTitle),
      url: rawUrl,
      snippet: clean(rawSnippet),
    });
  }

  return {
    query,
    results,
    count: results.length,
  };
}

const readFileInput = z.object({
  path: z.string().min(1),
});

async function readFileTool(args: unknown) {
  const { path: relPath } = readFileInput.parse(args);
  const fullPath = resolveSafePath(relPath);
  const content = await fs.readFile(fullPath, "utf-8");
  return {
    path: relPath,
    content,
  };
}

const writeFileInput = z.object({
  path: z.string().min(1),
  content: z.string(),
  mode: z.enum(["overwrite", "append"]).default("overwrite"),
});

async function approvalCheck(toolName: string, args: unknown): Promise<void> {
  if (toolName === "write_file") {
    console.log("\n[APPROVAL REQUIRED]");
    console.log(`Tool: ${toolName}`);
    console.log(`Args: ${JSON.stringify(args, null, 2)}`);
    console.log("Auto-approving in demo mode...\n");
  }
}

async function writeFileTool(args: unknown) {
  const { path: relPath, content, mode } = writeFileInput.parse(args);
  const fullPath = resolveSafePath(relPath);

  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  if (mode === "append") {
    await fs.appendFile(fullPath, content, "utf-8");
  } else {
    await fs.writeFile(fullPath, content, "utf-8");
  }

  return {
    path: relPath,
    mode,
    bytes_written: Buffer.byteLength(content, "utf-8"),
  };
}

const runPythonInput = z.object({
  code: z.string().min(1),
  timeout_ms: z.number().int().min(100).max(10000).default(5000),
});

async function runPythonTool(args: unknown) {
  const { code, timeout_ms } = runPythonInput.parse(args);

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "agent-python-"));
  const scriptPath = path.join(tempDir, "script.py");

  const wrappedCode = `
import os
os.chdir(${JSON.stringify(WORKSPACE_DIR)})
${code}
`;

  await fs.writeFile(scriptPath, wrappedCode, "utf-8");

  return await new Promise((resolve, reject) => {
    const child = spawn("python3", [scriptPath], {
      cwd: WORKSPACE_DIR,
      env: {
        PYTHONUNBUFFERED: "1",
      },
    });

    let stdout = "";
    let stderr = "";
    let killed = false;

    const timer = setTimeout(() => {
      killed = true;
      child.kill("SIGKILL");
    }, timeout_ms);

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (killed) {
        reject(new Error(`Python execution timed out after ${timeout_ms}ms`));
        return;
      }
      resolve({
        exit_code: code,
        stdout,
        stderr,
      });
    });
  });
}

// ---------- Tool Registry ----------
type ToolHandler = (args: unknown) => Promise<any>;

const toolRegistry: Record<string, ToolHandler> = {
  web_search: (args) => withRetry(() => webSearch(args)),
  read_file: (args) => withRetry(() => readFileTool(args)),
  write_file: async (args) => {
    await approvalCheck("write_file", args);
    return withRetry(() => writeFileTool(args));
  },
  run_python: (args) => withRetry(() => runPythonTool(args)),
};

const tools: OpenAI.Responses.Tool[] = [
  {
    type: "function",
    name: "web_search",
    description:
      "Search the public web for recent or external factual information. Use when the question needs current information, online docs, or external sources. Do not use for pure reasoning tasks.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search keywords for web search.",
        },
        top_k: {
          type: "integer",
          description: "Maximum number of search results to return. Default is 5.",
          minimum: 1,
          maximum: 10,
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "read_file",
    description:
      "Read a UTF-8 text file from the sandbox workspace. Use only for files inside the workspace. Absolute paths are not allowed.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Relative file path under the workspace, such as notes.txt or reports/today.md.",
        },
      },
      required: ["path"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "write_file",
    description:
      "Write or append UTF-8 text content to a file in the sandbox workspace. Use only when the user explicitly asks to create, update, or save a file.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Relative file path under the workspace.",
        },
        content: {
          type: "string",
          description: "The text content to write.",
        },
        mode: {
          type: "string",
          enum: ["overwrite", "append"],
          description: "Whether to overwrite the file or append to the end. Default is overwrite.",
        },
      },
      required: ["path", "content"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "run_python",
    description:
      "Execute short Python code in a sandbox for exact calculation, data processing, or quick analysis. No network access. Keep code short and deterministic.",
    parameters: {
      type: "object",
      properties: {
        code: {
          type: "string",
          description: "Python code to execute. Print important outputs to stdout.",
        },
        timeout_ms: {
          type: "integer",
          description: "Execution timeout in milliseconds, default 5000.",
          minimum: 100,
          maximum: 10000,
        },
      },
      required: ["code"],
      additionalProperties: false,
    },
  },
];

// ---------- Agent Runtime ----------
type ConversationItem =
  | { role: "user"; content: string }
  | { type: "function_call_output"; call_id: string; output: string };

async function executeToolCall(toolCall: any) {
  const name = toolCall.name;
  const callId = toolCall.call_id;
  const args = toolCall.arguments ? JSON.parse(toolCall.arguments) : {};

  const handler = toolRegistry[name];
  if (!handler) {
    return {
      type: "function_call_output" as const,
      call_id: callId,
      output: JSON.stringify({
        error: `Unknown tool: ${name}`,
      }),
    };
  }

  try {
    const result = await handler(args);
    return {
      type: "function_call_output" as const,
      call_id: callId,
      output: JSON.stringify(result),
    };
  } catch (error: any) {
    return {
      type: "function_call_output" as const,
      call_id: callId,
      output: JSON.stringify({
        error: error?.message || String(error),
      }),
    };
  }
}

async function runAgent(userInput: string) {
  const input: ConversationItem[] = [
    {
      role: "user",
      content: userInput,
    },
  ];

  let response = await client.responses.create({
    model: MODEL,
    input,
    tools,
    instructions: `
You are a practical AI agent.
You may use tools to gather information, read/write files, and run Python code.
Prefer tools when needed for factual accuracy, exact computation, or file operations.
If writing files, do it only when the user explicitly asks.
When using tools, be concise and efficient.
`,
  });

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    const functionCalls = (response.output || []).filter((item: any) => item.type === "function_call");

    if (functionCalls.length === 0) {
      return extractTextFromResponse(response);
    }

    // 并行执行当前轮所有独立工具调用
    const toolOutputs = await Promise.all(functionCalls.map((call: any) => executeToolCall(call)));

    response = await client.responses.create({
      model: MODEL,
      previous_response_id: response.id,
      input: toolOutputs,
      tools,
    });
  }

  return "Agent stopped because it reached the maximum number of tool iterations.";
}

// ---------- CLI ----------
async function main() {
  await ensureWorkspace();

  const userInput = process.argv.slice(2).join(" ").trim();
  if (!userInput) {
    console.log(`Usage:
  npm run dev -- "搜索 OpenAI SDK 最新变化，并把总结写入 summary.md"
  npm run dev -- "读取 notes.txt，然后统计里面一共有多少个单词"
`);
    process.exit(0);
  }

  try {
    const result = await runAgent(userInput);
    console.log("\n=== FINAL ANSWER ===\n");
    console.log(result);
  } catch (error) {
    console.error("Agent failed:", error);
    process.exit(1);
  }
}

main();
```

---

## 3.14 初始化测试文件

创建 `workspace/notes.txt`

```txt
AI Agent systems usually combine reasoning, memory, and tool use.
Tool use lets the model search for information, execute code, and interact with external systems.
```

---

## 3.15 运行方式

安装依赖：

```bash
npm install
```

运行示例 1：

```bash
npm run dev -- "读取 notes.txt，然后统计里面一共有多少个单词"
```

运行示例 2：

```bash
npm run dev -- "搜索 OpenAI SDK 最新变化，并把总结写入 summary.md"
```

运行示例 3：

```bash
npm run dev -- "用 Python 计算 1 到 1000 的平方和"
```

---

## 3.16 代码设计拆解

上面的代码不只是“能跑”，它还体现了一个最小可用 Agent Runtime 的几个关键原则。

### 1. 工具注册表

```ts
const toolRegistry: Record<string, ToolHandler> = { ... }
```

这层非常重要。它的作用是：

- 把模型输出的工具名映射到本地实现
- 统一接入权限、日志、重试、超时
- 让工具实现与模型协议解耦

这意味着以后你可以：

- 换模型，不换工具实现
- 换 SDK，不换业务逻辑
- 给某个工具单独加审计

### 2. 参数校验

我们在每个工具里都用 `zod` 做解析：

```ts
const { query, top_k } = webSearchInput.parse(args);
```

不要直接信任模型传来的 JSON。  
因为即使模型“通常能传对”，也不代表它“永远传对”。

参数校验要解决的是：

- 类型错误
- 缺少字段
- 越界数值
- 非法枚举值
- 注入型输入

### 3. 工具结果结构化返回

比如 `web_search` 返回：

```json
{
  "query": "...",
  "results": [...],
  "count": 5
}
```

这比直接返回大段文本更适合模型二次利用。

### 4. 循环直到无工具调用

Agent Runtime 的核心其实就是这个循环：

1. 请求模型
2. 检查是否有工具调用
3. 执行工具
4. 把结果送回模型
5. 重复，直到模型给出最终回答

这就是最基础的 **ReAct + Tool Use** 闭环。

---

## 3.17 工具编排：并行调用、依赖链、错误重试

真实项目中，工具调用不是单函数执行那么简单。  
你很快会遇到三类编排问题：

- 多个独立工具能不能并行？
- 某个工具结果是另一个工具输入，怎么串起来？
- 某个工具失败了，是直接报错还是重试？

---

## 3.18 并行调用

在我们的运行时里，一轮模型可能返回多个函数调用：

```ts
const functionCalls = (response.output || []).filter((item: any) => item.type === "function_call");
const toolOutputs = await Promise.all(functionCalls.map((call: any) => executeToolCall(call)));
```

这就是最简单的并行策略。

### 适合并行的场景

- 同时读多个文件
- 同时查询多个 API
- 搜索多个独立关键词
- 获取多个指标

例如模型可能一轮里发出：

- `read_file("a.txt")`
- `read_file("b.txt")`
- `read_file("c.txt")`

这些之间没有依赖，自然适合并行。

### 并行的注意事项

#### 1. 控制并发数
真实项目里不要无脑 `Promise.all`。  
如果模型一次调用 50 个外部 API，很容易把你的限流打爆。

通常建议：

- IO 型工具：并发限制 3~10
- 高成本工具：串行或小并发
- 写操作：通常串行

#### 2. 幂等性
并行执行的工具最好是幂等或只读。  
比如 `write_file`、`charge_payment` 这种不适合随便并发。

---

## 3.19 依赖链

依赖链的意思是：  
一个工具的输出，会影响下一个工具的输入。

例如用户说：

> 读取 sales.csv，计算总销售额，然后把结果写入 report.txt

这里就有天然链路：

1. `read_file("sales.csv")`
2. `run_python(code based on file content)`
3. `write_file("report.txt", "...")`

这种链路一般不需要你手写工作流图，模型会在多轮工具调用中自然形成：

- 第一轮：读文件
- 第二轮：运行 Python 计算
- 第三轮：写文件
- 最后一轮：总结回答

这也是“LLM 驱动工具编排”的价值所在：  
你不用把所有业务都写成死板 DAG，模型可以根据中间结果动态决定下一步。

### 什么时候还需要显式工作流？

如果场景满足以下条件，建议还是用显式编排：

- 步骤固定
- 审批节点严格
- 失败补偿复杂
- SLA 要求高
- 不能接受模型自由决定流程

例如：

- 支付
- 退款
- 订单履约
- 数据库迁移
- 批量运维

换句话说：

- **开放任务**：适合 LLM 自由编排
- **关键业务流程**：适合工作流引擎 + LLM 辅助

---

## 3.20 错误重试

本章示例给工具统一包了一层：

```ts
async function withRetry<T>(fn: () => Promise<T>, retries = MAX_RETRIES): Promise<T>
```

这对以下情况很有效：

- 搜索接口偶发失败
- 文件系统瞬时异常
- 子进程执行偶发错误
- 网络抖动

### 重试策略建议

#### 1. 只对“临时性错误”重试
适合重试：

- 超时
- 429
- 503
- 网络断开

不适合重试：

- 参数校验失败
- 权限拒绝
- 文件不存在（除非明确可能稍后生成）

#### 2. 指数退避
本章为了示例只用了简单线性等待。  
生产环境建议用指数退避：

- 500ms
- 1000ms
- 2000ms
- 4000ms

#### 3. 向
