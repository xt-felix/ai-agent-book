# 第 15 章：实战案例 — 数据分析 Agent

# 第十五章：实战案例 — 数据分析 Agent

数据分析是企业中最常见、也最容易体现 Agent 价值的场景之一。

传统 BI 工具虽然强大，但往往存在几个问题：

- 业务人员不会写 SQL
- 数据分析流程割裂：提问、查数、导出、画图、解读都要切换工具
- 临时问题响应慢，依赖数据团队
- 即使拿到结果，也不一定能快速得出结论

这一章我们实现一个**完整可运行的数据分析 Agent**：

- 用户输入自然语言问题
- Agent 自动理解意图并生成 SQL
- 在安全沙箱中执行查询
- 自动生成图表
- 基于结果做总结
- 支持自动探索数据、异常检测和趋势预测

整个项目采用 **TypeScript + Python 混合架构**：

- **TypeScript**：负责编排 Agent、调用 LLM、构建服务接口
- **Python**：负责 SQL 执行、安全控制、数据处理、图表生成、异常检测、趋势预测

你可以把它看成一个精简版、可扩展的“智能数据分析 Copilot”。

---

# 15.1 场景目标与需求定义

我们先明确本章要解决的问题。

假设我们有一个电商业务数据库，包含以下几类数据：

- `users`：用户信息
- `products`：商品信息
- `orders`：订单主表
- `order_items`：订单明细

业务人员可能会这样提问：

- “最近 30 天销售额趋势怎么样？”
- “销量最高的 10 个商品是什么？”
- “华东地区近三个月每周订单数变化如何？”
- “退款率最近是否异常？”
- “预测下个月的销售额”

我们的 Agent 需要完成以下能力链路：

| 步骤 | 能力 | 说明 |
|---|---|---|
| 1 | 自然语言理解 | 识别用户问题中的指标、时间范围、维度、排序、聚合方式 |
| 2 | NL2SQL | 基于数据库 schema 生成可执行 SQL |
| 3 | 安全执行 | 在只读、限时、受控环境中执行 SQL |
| 4 | 结果可视化 | 自动根据结果类型生成折线图、柱状图、饼图等 |
| 5 | 自然语言总结 | 总结主要结论、趋势、异常、业务建议 |
| 6 | 高级分析 | 自动探索、异常检测、趋势预测 |

这里有一个非常重要的设计思想：

> 数据分析 Agent 不是“让 LLM 直接回答数据问题”，而是让 LLM 参与“分析流程编排”，真正的数据结果必须来自受控的数据查询与计算。

也就是说：

- **结论要以数据库结果为准**
- **模型负责理解问题和组织分析过程**
- **执行和计算交给确定性程序**

---

# 15.2 系统架构设计

先看整体架构。

```text
┌──────────────────────────────┐
│           用户问题            │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│      TypeScript Agent        │
│  - 问题理解                   │
│  - Schema 注入                │
│  - SQL 生成                   │
│  - 分析计划                   │
│  - 结果总结                   │
└───────┬─────────┬────────────┘
        │         │
        │         ▼
        │   ┌──────────────────┐
        │   │ Python 分析服务   │
        │   │ - SQL 校验        │
        │   │ - SQLite 执行     │
        │   │ - pandas 处理     │
        │   │ - matplotlib 画图 │
        │   │ - 异常检测        │
        │   │ - 趋势预测        │
        │   └──────────────────┘
        │
        ▼
┌──────────────────────────────┐
│         结果输出层            │
│  SQL + 表格 + 图表 + 结论     │
└──────────────────────────────┘
```

## 15.2.1 模块拆分

我们将项目拆成几个模块。

### TypeScript 侧

- `SchemaRegistry`：维护数据库结构说明
- `SQLGenerator`：把自然语言变成 SQL
- `AnalysisPlanner`：决定是否需要图表、异常检测、趋势预测
- `PythonExecutorClient`：调用 Python 服务执行 SQL 与分析
- `SummaryGenerator`：把结果整理成自然语言结论
- `DataAnalysisAgent`：统一编排整个流程

### Python 侧

- `query_guard.py`：SQL 安全检查
- `executor.py`：只读执行 SQL
- `visualizer.py`：自动生成图表
- `analytics.py`：异常检测、趋势预测、自动探索
- `server.py`：FastAPI 暴露 HTTP 接口给 TypeScript 调用

---

# 15.3 项目目录结构

完整项目目录如下：

```text
data-analysis-agent/
├─ ts/
│  ├─ src/
│  │  ├─ agent.ts
│  │  ├─ llm.ts
│  │  ├─ schema.ts
│  │  ├─ sql-generator.ts
│  │  ├─ summary-generator.ts
│  │  ├─ planner.ts
│  │  ├─ python-client.ts
│  │  ├─ types.ts
│  │  └─ index.ts
│  ├─ package.json
│  ├─ tsconfig.json
│  └─ .env
├─ py/
│  ├─ server.py
│  ├─ executor.py
│  ├─ query_guard.py
│  ├─ visualizer.py
│  ├─ analytics.py
│  ├─ seed_db.py
│  ├─ requirements.txt
│  └─ data/
│     └─ ecommerce.db
└─ README.md
```

---

# 15.4 数据库准备

为了让项目可运行，我们先用 Python 创建一个 SQLite 示例数据库。

## 15.4.1 安装 Python 依赖

`py/requirements.txt`

```txt
fastapi==0.115.0
uvicorn==0.30.6
pandas==2.2.2
matplotlib==3.9.2
numpy==2.1.1
python-multipart==0.0.9
scikit-learn==1.5.1
```

## 15.4.2 构建示例数据库

`py/seed_db.py`

```python
import os
import sqlite3
import random
from datetime import datetime, timedelta

DB_PATH = os.path.join(os.path.dirname(__file__), "data", "ecommerce.db")
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()

cur.executescript("""
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    region TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE products (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    price REAL NOT NULL
);

CREATE TABLE orders (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    total_amount REAL NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE order_items (
    id INTEGER PRIMARY KEY,
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price REAL NOT NULL,
    FOREIGN KEY(order_id) REFERENCES orders(id),
    FOREIGN KEY(product_id) REFERENCES products(id)
);
""")

regions = ["华东", "华北", "华南", "西南", "华中"]
categories = ["手机", "电脑", "家电", "配件", "图书"]

for i in range(1, 101):
    created_at = (datetime.now() - timedelta(days=random.randint(30, 400))).strftime("%Y-%m-%d")
    cur.execute(
        "INSERT INTO users (id, name, region, created_at) VALUES (?, ?, ?, ?)",
        (i, f"用户{i}", random.choice(regions), created_at)
    )

for i in range(1, 51):
    category = random.choice(categories)
    price = round(random.uniform(30, 8000), 2)
    cur.execute(
        "INSERT INTO products (id, name, category, price) VALUES (?, ?, ?, ?)",
        (i, f"{category}-{i}", category, price)
    )

start_date = datetime.now() - timedelta(days=180)
order_id = 1
item_id = 1

for day in range(180):
    current = start_date + timedelta(days=day)
    daily_orders = random.randint(5, 25)

    # 模拟某些异常峰值
    if day in [40, 90, 150]:
        daily_orders *= 3

    for _ in range(daily_orders):
        user_id = random.randint(1, 100)
        status = random.choices(
            ["paid", "shipped", "completed", "cancelled"],
            weights=[20, 25, 45, 10]
        )[0]
        item_count = random.randint(1, 4)

        total_amount = 0.0
        items = []

        for _ in range(item_count):
            product_id = random.randint(1, 50)
            quantity = random.randint(1, 3)
            cur.execute("SELECT price FROM products WHERE id = ?", (product_id,))
            unit_price = cur.fetchone()[0]
            total_amount += unit_price * quantity
            items.append((product_id, quantity, unit_price))

        cur.execute(
            "INSERT INTO orders (id, user_id, total_amount, status, created_at) VALUES (?, ?, ?, ?, ?)",
            (order_id, user_id, round(total_amount, 2), status, current.strftime("%Y-%m-%d"))
        )

        for product_id, quantity, unit_price in items:
            cur.execute(
                "INSERT INTO order_items (id, order_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?, ?)",
                (item_id, order_id, product_id, quantity, unit_price)
            )
            item_id += 1

        order_id += 1

conn.commit()
conn.close()

print(f"Database created at: {DB_PATH}")
```

运行：

```bash
cd py
python seed_db.py
```

---

# 15.5 Python 执行层：安全沙箱与数据分析服务

这一层是整个系统可信度的基础。

原则很简单：

- SQL 不能让模型直接“随便执行”
- 只能执行安全的 `SELECT`
- 禁止多语句
- 禁止 DDL / DML
- 设置执行超时
- 返回结果行数限制
- 连接数据库时只读

---

## 15.5.1 SQL 安全检查器

`py/query_guard.py`

```python
import re

FORBIDDEN_PATTERNS = [
    r"\bINSERT\b",
    r"\bUPDATE\b",
    r"\bDELETE\b",
    r"\bDROP\b",
    r"\bALTER\b",
    r"\bTRUNCATE\b",
    r"\bCREATE\b",
    r"\bREPLACE\b",
    r"\bATTACH\b",
    r"\bDETACH\b",
    r"\bPRAGMA\b",
    r"\bVACUUM\b",
]

def normalize_sql(sql: str) -> str:
    sql = sql.strip()
    sql = re.sub(r"\s+", " ", sql)
    return sql

def validate_sql(sql: str):
    normalized = normalize_sql(sql)

    if ";" in normalized[:-1]:
        raise ValueError("禁止多语句 SQL")

    if not re.match(r"^\s*SELECT\b", normalized, re.IGNORECASE):
        raise ValueError("只允许 SELECT 查询")

    for pattern in FORBIDDEN_PATTERNS:
        if re.search(pattern, normalized, re.IGNORECASE):
            raise ValueError(f"检测到危险 SQL 关键字: {pattern}")

    if "--" in normalized or "/*" in normalized or "*/" in normalized:
        raise ValueError("禁止 SQL 注释")

    return normalized
```

这个实现不复杂，但在生产中非常必要。

### 为什么仅靠正则还不够？

因为真正的 SQL 安全最好配合：

- AST 级解析
- 数据库只读用户
- 限制可访问表
- 查询成本控制
- 行数限制与超时控制

本章为了让项目简洁、可运行，采用“**多层防御**”策略，而不是单点依赖。

---

## 15.5.2 查询执行器

`py/executor.py`

```python
import os
import sqlite3
import time
import pandas as pd
from query_guard import validate_sql

DB_PATH = os.path.join(os.path.dirname(__file__), "data", "ecommerce.db")
MAX_ROWS = 5000
TIMEOUT_SECONDS = 5

class SQLExecutor:
    def __init__(self, db_path: str = DB_PATH):
        self.db_path = db_path

    def _connect(self):
        uri = f"file:{self.db_path}?mode=ro"
        conn = sqlite3.connect(uri, uri=True, check_same_thread=False)
        conn.execute("PRAGMA query_only = ON;")
        return conn

    def execute(self, sql: str):
        sql = validate_sql(sql)

        start = time.time()
        conn = self._connect()
        try:
            cursor = conn.cursor()
            cursor.execute(sql)
            columns = [desc[0] for desc in cursor.description] if cursor.description else []
            rows = cursor.fetchmany(MAX_ROWS)
            elapsed = time.time() - start

            if elapsed > TIMEOUT_SECONDS:
                raise TimeoutError("SQL 执行超时")

            df = pd.DataFrame(rows, columns=columns)
            return {
                "columns": columns,
                "rows": df.to_dict(orient="records"),
                "row_count": len(df),
                "elapsed_ms": int(elapsed * 1000),
            }
        finally:
            conn.close()
```

### 这里只实现了基础超时，有什么局限？

`sqlite3` 本身不像某些数据库那样容易做真正的服务端超时中断，所以这里采用了“执行后判断”的简化方式。在生产中推荐：

- PostgreSQL：设置 statement timeout
- MySQL：数据库侧超时配置
- 子进程隔离执行
- 任务队列 + 超时取消
- 查询审计日志

为了兼顾教学和可运行性，本章保留这种实现，并在后面介绍如何进一步强化。

---

## 15.5.3 图表生成器

`py/visualizer.py`

```python
import os
import uuid
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd

CHART_DIR = os.path.join(os.path.dirname(__file__), "data", "charts")
os.makedirs(CHART_DIR, exist_ok=True)

def detect_chart_type(df: pd.DataFrame) -> str:
    if len(df.columns) < 2:
        return "table"

    first_col = df.columns[0].lower()
    if "date" in first_col or "day" in first_col or "week" in first_col or "month" in first_col:
        return "line"

    if len(df) <= 10:
        return "bar"

    return "bar"

def generate_chart(data: list[dict]):
    df = pd.DataFrame(data)
    if df.empty or len(df.columns) < 2:
        return None

    chart_type = detect_chart_type(df)
    x_col = df.columns[0]
    y_col = df.columns[1]

    plt.figure(figsize=(10, 5))

    if chart_type == "line":
        plt.plot(df[x_col], df[y_col], marker="o")
    elif chart_type == "bar":
        plt.bar(df[x_col].astype(str), df[y_col])
    else:
        return None

    plt.title(f"{y_col} by {x_col}")
    plt.xlabel(x_col)
    plt.ylabel(y_col)
    plt.xticks(rotation=45, ha="right")
    plt.tight_layout()

    file_name = f"{uuid.uuid4().hex}.png"
    file_path = os.path.join(CHART_DIR, file_name)
    plt.savefig(file_path)
    plt.close()

    return {
        "chart_type": chart_type,
        "file_path": file_path,
        "file_name": file_name
    }
```

---

## 15.5.4 高级分析模块

`py/analytics.py`

```python
import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression

def auto_explore(data: list[dict]):
    df = pd.DataFrame(data)
    if df.empty:
        return {"summary": "没有可分析的数据"}

    numeric_cols = df.select_dtypes(include=["number"]).columns.tolist()
    categorical_cols = df.select_dtypes(exclude=["number"]).columns.tolist()

    result = {
        "row_count": int(len(df)),
        "columns": df.columns.tolist(),
        "numeric_summary": {},
        "top_categories": {}
    }

    for col in numeric_cols:
        result["numeric_summary"][col] = {
            "mean": float(df[col].mean()),
            "min": float(df[col].min()),
            "max": float(df[col].max()),
            "std": float(df[col].std()) if len(df[col]) > 1 else 0.0,
        }

    for col in categorical_cols[:3]:
        result["top_categories"][col] = df[col].astype(str).value_counts().head(5).to_dict()

    return result

def detect_anomalies(data: list[dict]):
    df = pd.DataFrame(data)
    if df.empty or len(df.columns) < 2:
        return {"anomalies": []}

    value_col = df.columns[1]
    if not pd.api.types.is_numeric_dtype(df[value_col]):
        return {"anomalies": []}

    mean = df[value_col].mean()
    std = df[value_col].std()
    if std == 0 or pd.isna(std):
        return {"anomalies": []}

    z_scores = (df[value_col] - mean) / std
    anomalies = df[np.abs(z_scores) > 2]

    return {
        "value_column": value_col,
        "anomalies": anomalies.to_dict(orient="records")
    }

def forecast_trend(data: list[dict], periods: int = 7):
    df = pd.DataFrame(data)
    if df.empty or len(df.columns) < 2:
        return {"forecast": []}

    x_col = df.columns[0]
    y_col = df.columns[1]

    if not pd.api.types.is_numeric_dtype(df[y_col]):
        return {"forecast": []}

    df = df.reset_index(drop=True)
    X = np.arange(len(df)).reshape(-1, 1)
    y = df[y_col].values

    model = LinearRegression()
    model.fit(X, y)

    future_X = np.arange(len(df), len(df) + periods).reshape(-1, 1)
    pred = model.predict(future_X)

    forecast = []
    for i, value in enumerate(pred):
        forecast.append({
            "step": i + 1,
            "predicted_value": float(round(value, 2))
        })

    return {
        "value_column": y_col,
        "forecast": forecast
    }
```

这里我们用的是最简单的方式：

- **异常检测**：Z-Score
- **趋势预测**：线性回归

这不一定是最准确的，但它有两个优点：

- 足够轻量
- 非常适合作为 Agent 的分析增强能力

如果接入生产环境，你可以逐步替换成：

- Prophet
- ARIMA / SARIMA
- Isolation Forest
- STL 分解
- 业务规则阈值告警

---

## 15.5.5 Python HTTP 服务

`py/server.py`

```python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from executor import SQLExecutor
from visualizer import generate_chart
from analytics import auto_explore, detect_anomalies, forecast_trend

app = FastAPI(title="Data Analysis Python Service")
executor = SQLExecutor()

class QueryRequest(BaseModel):
    sql: str
    generate_chart: bool = True
    auto_explore_enabled: bool = False
    anomaly_detection_enabled: bool = False
    forecast_enabled: bool = False
    forecast_periods: int = 7

@app.post("/query")
def query(req: QueryRequest):
    try:
        result = executor.execute(req.sql)
        rows = result["rows"]

        chart = generate_chart(rows) if req.generate_chart else None
        exploration = auto_explore(rows) if req.auto_explore_enabled else None
        anomalies = detect_anomalies(rows) if req.anomaly_detection_enabled else None
        forecast = forecast_trend(rows, req.forecast_periods) if req.forecast_enabled else None

        return {
            "sql": req.sql,
            "result": result,
            "chart": chart,
            "exploration": exploration,
            "anomalies": anomalies,
            "forecast": forecast
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
```

启动服务：

```bash
cd py
uvicorn server:app --reload --port 8001
```

---

# 15.6 TypeScript 侧：Agent 编排层

现在进入 Agent 核心。

## 15.6.1 安装依赖

`ts/package.json`

```json
{
  "name": "data-analysis-agent-ts",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx src/index.ts"
  },
  "dependencies": {
    "dotenv": "^16.4.5",
    "openai": "^4.56.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/node": "^22.5.4",
    "tsx": "^4.19.1",
    "typescript": "^5.6.2"
  }
}
```

`ts/tsconfig.json`

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
  "include": ["src"]
}
```

---

## 15.6.2 类型定义

`ts/src/types.ts`

```ts
export interface SQLPlan {
  question: string;
  sql: string;
  chartNeeded: boolean;
  autoExplore: boolean;
  anomalyDetection: boolean;
  forecast: boolean;
  forecastPeriods: number;
  reasoning?: string;
}

export interface PythonQueryResponse {
  sql: string;
  result: {
    columns: string[];
    rows: Record<string, any>[];
    row_count: number;
    elapsed_ms: number;
  };
  chart?: {
    chart_type: string;
    file_path: string;
    file_name: string;
  } | null;
  exploration?: any;
  anomalies?: any;
  forecast?: any;
}

export interface AgentResponse {
  question: string;
  sql: string;
  rowCount: number;
  elapsedMs: number;
  preview: Record<string, any>[];
  chart?: string | null;
  exploration?: any;
  anomalies?: any;
  forecast?: any;
  summary: string;
}
```

---

## 15.6.3 Schema 描述模块

LLM 做 NL2SQL 时，最大的问题不是“不会写 SQL”，而是“不了解你的数据库”。

所以必须显式提供 schema。

`ts/src/schema.ts`

```ts
export const schemaDescription = `
数据库类型: SQLite

表结构如下:

1. users
- id: INTEGER, 用户ID
- name: TEXT, 用户名
- region: TEXT, 区域，如 华东/华北/华南/西南/华中
- created_at: TEXT, 用户创建日期，格式 YYYY-MM-DD

2. products
- id: INTEGER, 商品ID
- name: TEXT, 商品名称
- category: TEXT, 商品分类，如 手机/电脑/家电/配件/图书
- price: REAL, 商品价格

3. orders
- id: INTEGER, 订单ID
- user_id: INTEGER, 用户ID
- total_amount: REAL, 订单总金额
- status: TEXT, 订单状态，可选 paid/shipped/completed/cancelled
- created_at: TEXT, 订单创建日期，格式 YYYY-MM-DD

4. order_items
- id: INTEGER, 明细ID
- order_id: INTEGER, 订单ID
- product_id: INTEGER, 商品ID
- quantity: INTEGER, 数量
- unit_price: REAL, 成交单价

关联关系:
- orders.user_id = users.id
- order_items.order_id = orders.id
- order_items.product_id = products.id

SQL 约束:
- 只能生成 SELECT 查询
- 不允许 INSERT/UPDATE/DELETE/DROP/ALTER 等语句
- 不要生成多条 SQL
- 默认加 LIMIT，除非明确是聚合统计结果
- 时间字段使用 SQLite 兼容写法
`;
```

---

## 15.6.4 LLM 调用封装

`ts/src/llm.ts`

```ts
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL
});

export async function chatCompletion(system: string, user: string): Promise<string> {
  const resp = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    temperature: 0.2,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user }
    ]
  });

  return resp.choices[0]?.message?.content || "";
}
```

`.env` 示例：

```env
OPENAI_API_KEY=your_key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
PYTHON_SERVICE_URL=http://127.0.0.1:8001
```

---

## 15.6.5 SQL 生成器

这里要求模型输出结构化 JSON，而不是自由文本。这样更容易解析，也更安全。

`ts/src/sql-generator.ts`

```ts
import { z } from "zod";
import { chatCompletion } from "./llm.js";
import { schemaDescription } from "./schema.js";
import { SQLPlan } from "./types.js";

const SQLPlanSchema = z.object({
  question: z.string(),
  sql: z.string(),
  chartNeeded: z.boolean(),
  autoExplore: z.boolean(),
  anomalyDetection: z.boolean(),
  forecast: z.boolean(),
  forecastPeriods: z.number(),
  reasoning: z.string().optional()
});

export async function generateSQLPlan(question: string): Promise<SQLPlan> {
  const system = `
你是一个资深数据分析助手，负责把用户问题转换成安全、可执行的 SQLite 查询计划。
你必须只输出 JSON，不要输出 Markdown，不要输出解释。

输出字段:
- question: 原问题
- sql: 生成的 SQL，仅允许 SELECT
- chartNeeded: 是否建议生成图表
- autoExplore: 是否建议做自动探索
- anomalyDetection: 是否建议做异常检测
- forecast: 是否建议做趋势预测
- forecastPeriods: 预测未来几个周期，默认 7
- reasoning: 简短说明

规则:
- 只能使用给定 schema
- 只能输出一条 SELECT SQL
- 不得输出注释
- 如果问题涉及趋势、变化、走势，优先按日期聚合
- 如果问题涉及 Top N，使用 ORDER BY + LIMIT
- 如果问题涉及销售额，优先使用 orders.total_amount 聚合
- 如果问题涉及销量，优先使用 order_items.quantity 聚合
- cancelled 订单默认不计入有效销售，除非用户明确要求
- 默认返回适度数据量
`;

  const user = `
Schema:
${schemaDescription}

用户问题:
${question}
`;

  const content = await chatCompletion(system, user);
  const parsed = JSON.parse(content);
  return SQLPlanSchema.parse(parsed);
}
```

---

## 15.6.6 Python 服务客户端

Node 18+ 自带 `fetch`，这里直接使用。

`ts/src/python-client.ts`

```ts
import dotenv from "dotenv";
import { PythonQueryResponse, SQLPlan } from "./types.js";

dotenv.config();

const BASE_URL = process.env.PYTHON_SERVICE_URL || "http://127.0.0.1:8001";

export async function executeAnalysis(plan: SQLPlan): Promise<PythonQueryResponse> {
  const resp = await fetch(`${BASE_URL}/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      sql: plan.sql,
      generate_chart: plan.chartNeeded,
      auto_explore_enabled: plan.autoExplore,
      anomaly_detection_enabled: plan.anomalyDetection,
      forecast_enabled: plan.forecast,
      forecast_periods: plan.forecastPeriods
    })
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Python service error: ${text}`);
  }

  return resp.json();
}
```

---

## 15.6.7 结果总结器

Agent 的总结一定要基于真实数据结果，而不是只基于用户问题。

`ts/src/summary-generator.ts`

```ts
import { chatCompletion } from "./llm.js";
import { PythonQueryResponse } from "./types.js";

export async function generateSummary(
  question: string,
  execution: PythonQueryResponse
): Promise<string> {
  const system = `
你是数据分析顾问。请根据给定 SQL 结果生成简洁、可信的中文分析结论。
要求:
- 必须基于真实结果，不要编造
- 指出主要发现
- 如果有异常检测结果，说明异常点
- 如果有趋势预测结果，说明预测方向
- 如果数据不足，明确说明
- 输出 3-6 条要点，使用中文
`;

  const preview = execution.result.rows.slice(0, 20);

  const user = JSON.stringify({
    question,
    sql: execution.sql,
    rowCount: execution.result.row_count,
    columns: execution.result.columns,
    preview,
    anomalies: execution.anomalies,
    forecast: execution.forecast,
    exploration: execution.exploration
  });

  return chatCompletion(system, user);
}
```

---

## 15.6.8 分析策略模块

不是所有问题都要做高级分析。比如“销量前十商品”做预测就没意义。

我们增加一个轻量策略层。

`ts/src/planner.ts`

```ts
import { SQLPlan } from "./types.js";

export function refinePlan(plan: SQLPlan): SQLPlan {
  const q = plan.question;

  const hasTrendIntent = /趋势|走势|变化|每天|每周|每月|最近|预测/.test(q);
  const hasAnomalyIntent = /异常|波动|异常点|突然/.test(q);
  const hasTopIntent = /top|前\d+|最高|最多/i.test(q);

  if (hasTrendIntent) {
    plan.chartNeeded = true;
  }

  if (hasAnomalyIntent) {
    plan.anomalyDetection = true;
  }

  if (/预测|forecast/i.test(q)) {
    plan.forecast = true;
    if (!plan.forecastPeriods || plan.forecastPeriods < 1) {
      plan.forecastPeriods = 7;
    }
  }

  if (hasTopIntent) {
    plan.forecast = false;
    plan.anomalyDetection = false;
  }

  return plan;
}
```

---

## 15.6.9 Agent 主编排器

`ts/src/agent.ts`

```ts
import { generateSQLPlan } from "./sql-generator.js";
import { refinePlan } from "./planner.js";
import { executeAnalysis } from "./python-client.js";
import { generateSummary } from "./summary-generator.js";
import { AgentResponse } from "./types.js";

export class DataAnalysisAgent {
  async run(question: string): Promise<AgentResponse> {
    const initialPlan = await generateSQLPlan(question);
    const plan = refinePlan(initialPlan);

    const execution = await executeAnalysis(plan);
    const summary = await generateSummary(question, execution);

    return {
      question,
      sql: execution.sql,
      rowCount: execution.result.row_count,
      elapsedMs: execution.result.elapsed_ms,
      preview: execution.result.rows.slice(0, 10),
      chart: execution.chart?.file_path || null,
      exploration: execution.exploration || null,
      anomalies: execution.anomalies || null,
      forecast: execution.forecast || null,
      summary
    };
  }
}
```

---

## 15.6.10 运行入口

`ts/src/index.ts`

```ts
import { DataAnalysisAgent } from "./agent.js";

async function main() {
  const agent = new DataAnalysisAgent();

  const questions = [
    "最近30天销售额趋势怎么样？",
    "销量最高的10个商品是什么？",
    "最近90天每天订单数是否有异常波动？",
    "预测未来7天订单趋势"
  ];

  for (const q of questions) {
    console.log("\n==============================");
    console.log("问题:", q);

    try {
      const result = await agent.run(q);
      console.log("SQL:", result.sql);
      console.log("行数:", result.rowCount);
      console.log("耗时(ms):", result.elapsedMs);
      console.log("结果预览:", result.preview);
      console.log("图表:", result.chart);
      console.log("异常:", result.anomalies);
      console.log("预测:", result.forecast);
      console.log("总结:\n", result.summary);
    } catch (err) {
      console.error("执行失败:", err);
    }
  }
}

main();
```

运行：

```bash
cd ts
npm install
npm run dev
```

---

# 15.7 示例 SQL 与查询效果

为了帮助你理解 Agent 的实际行为，下面给出几类典型问题及可能生成的 SQL。

---

## 15.7.1 最近 30 天销售额趋势

用户问题：

```text
最近30天销售额趋势怎么样？
```

可能生成的 SQL：

```sql
SELECT
  created_at AS day,
  ROUND(SUM(total_amount), 2) AS sales_amount
FROM orders
WHERE status != 'cancelled'
  AND created_at >= date('now', '-30 day')
GROUP BY created_at
ORDER BY created_at;
```

特点：

- 按天聚合
- 排除了取消订单
- 非 Top 类问题，适合折线图
- 可继续做异常检测与趋势总结

---

## 15.7.2 销量最高的 10 个商品

用户问题：

```text
销量最高的10个商品是什么？
```

可能生成的 SQL：

```sql
SELECT
  p.name AS product_name,
  SUM(oi.quantity) AS total_quantity
FROM order_items oi
JOIN products p ON oi.product_id = p.id
JOIN orders o ON oi.order_id = o.id
WHERE o.status != 'cancelled'
GROUP BY p.id, p.name
ORDER BY total_quantity DESC
LIMIT 10;
```

特点：

- 典型排行榜查询
- 适合柱状图
- 一般不需要趋势预测

---

## 15.7.3 最近 90 天订单数是否存在异常波动

用户问题：

```text
最近90天每天订单数是否有异常波动？
```

可能生成的 SQL：

```sql
SELECT
  created_at AS day,
  COUNT(*) AS order_count
FROM orders
WHERE created_at >= date('now', '-90 day')
GROUP BY created_at
ORDER BY created_at;
```

特点：

- 时间序列数据
- 可以做折线图
- 能做 Z-Score 异常检测
- 返回异常日期列表

---

## 15.7.4 预测未来 7 天订单趋势

用户问题：

```text
预测未来7天订单趋势
```

可能生成的 SQL：

```sql
SELECT
  created_at AS day,
  COUNT(*) AS order_count
FROM orders
WHERE created_at >= date('now', '-60 day')
GROUP BY created_at
ORDER BY created_at;
```

特点：

- 先取历史序列
- 再做线性回归预测
- 输出未来 7 个周期的预测值

---

# 15.8 防护措施设计

数据分析 Agent 看起来像“查询助手”，但实质上它是一个**高风险执行系统**。因为一旦放松约束，就可能出现：

- SQL 注入
- 越
