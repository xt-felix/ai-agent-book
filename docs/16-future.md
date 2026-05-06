# 第 16 章：Agent 的未来方向

# 第十六章 Agent 的未来方向

过去两年，Agent 从“带工具调用的 LLM”快速演化为“能够感知环境、规划任务、执行动作、持续反馈”的系统形态。很多团队已经不再满足于让模型回答问题，而是希望它能真正完成任务：打开网页、读取文档、填写表单、调用服务、运行代码、监控结果、在失败后重试，并且把整个过程控制在成本、延迟和风险可接受的范围内。

这意味着，Agent 的未来竞争，不再只是模型能力的竞争，而是**系统能力**的竞争：感知、规划、执行、记忆、协作、治理、计费、安全、审计。这一章不讨论“Agent 会不会取代人类”这类泛化命题，而是从工程和产业角度，讨论 2026 年前后更可能发生什么，以及开发者应该把时间投入到哪里。

---

## 16.1 2026 年 Agent 技术趋势预测

如果把 2024 年看作 Agent 的“概念验证年”，2025 年看作“工程化落地年”，那么 2026 年很可能进入“平台化与分层竞争年”。所谓分层竞争，是指 Agent 不再被理解为单一产品，而是被拆解成多个技术层：

- **模型层**：推理、代码、视觉、语音、多模态理解与生成
- **工具层**：浏览器、终端、办公软件、数据库、RPA、内部 API
- **运行时层**：任务编排、状态管理、记忆管理、上下文压缩、恢复与重试
- **治理层**：权限、审计、观测、预算、合规、责任归属
- **应用层**：客服、销售、运营、开发、财务、法务、个人助理等场景

2026 年最值得关注的趋势，不是“更大的模型”，而是下面几个方向。

### 16.1.1 Agent 将从“问答接口”演化为“任务接口”

今天很多所谓 Agent，本质上仍然是问答系统加上工具调用。用户输入一段自然语言，系统调用一两个 API，拼出结果。这种模式适合短任务，但不适合持续任务和复杂流程。

到 2026 年，主流交互方式会逐步从：

- “请回答这个问题”
- “帮我生成一份内容”

转向：

- “在今天下班前帮我完成这件事”
- “持续监控这个指标，有异常就通知并给出处置建议”
- “每周自动整理客户会议纪要并同步 CRM”

也就是说，Agent 的输入不再只是 prompt，而是：

- 目标
- 约束
- 可用资源
- 完成标准
- 时间窗口
- 风险级别

这会推动 Agent 系统从 stateless request-response 模式走向 **long-running workflow** 模式。

### 16.1.2 “单 Agent 全能化”会退潮，“多 Agent + 专用子系统”会成为主流

早期产品喜欢宣传一个 Agent 可以包打天下：写代码、做研究、做 PPT、开会、发邮件、管项目。但工程实践会发现，通用 Agent 的上下文过重、错误成本过高、可控性太差。

更现实的架构是：

- 一个**协调 Agent**负责任务拆解和路由
- 多个**专用 Agent**负责特定领域
  - Browser Agent
  - Code Agent
  - Data Agent
  - Voice Agent
  - Enterprise Workflow Agent
- 外围配套系统负责：
  - 记忆
  - 权限
  - 计划恢复
  - 审计
  - 成本控制

这类似微服务替代单体架构：不是因为微服务更“先进”，而是因为系统复杂性上升后，必须做职责分离。

### 16.1.3 成功指标将从“回答质量”转向“任务成功率”

企业采购 Agent，不会只看模型 benchmark，而会看更接近业务的指标：

| 指标 | 含义 |
|---|---|
| Task Success Rate | 任务最终完成率 |
| Intervention Rate | 人工介入比例 |
| Recovery Rate | 失败后自动恢复比例 |
| Cost per Task | 单任务总成本 |
| Time to Complete | 任务完成时间 |
| Safety Incident Rate | 风险事件发生率 |
| Auditability | 是否可追踪、可复盘 |

这会直接影响技术选型。比如一个模型推理分数略低，但调用成本更低、延迟更稳定、函数调用更可靠，在真实业务中反而更有竞争力。

### 16.1.4 Agent 的“运行时”会成为新的基础设施

2025 年很多团队还在手工拼接：

- Prompt 模板
- Tool calling
- 重试逻辑
- 上下文裁剪
- 状态存储
- 任务队列

到了 2026 年，这些能力会逐渐沉淀为 Agent Runtime / Agent Platform，类似今天的应用服务器、容器平台或工作流引擎。开发者不再从零写一个 Agent，而是在一个有状态、有权限、有资源配额、有审计能力的运行时里部署 Agent。

下面给一个极简的 TypeScript 任务运行时示例，感受这种思路。

```ts
// agent-runtime.ts
type AgentTaskStatus =
  | "pending"
  | "running"
  | "waiting_human"
  | "completed"
  | "failed"
  | "cancelled";

interface AgentTask {
  id: string;
  goal: string;
  status: AgentTaskStatus;
  attempts: number;
  maxAttempts: number;
  budgetCents: number;
  spentCents: number;
  createdAt: number;
  updatedAt: number;
  result?: string;
  error?: string;
}

class InMemoryTaskStore {
  private tasks = new Map<string, AgentTask>();

  create(goal: string, budgetCents: number): AgentTask {
    const now = Date.now();
    const task: AgentTask = {
      id: crypto.randomUUID(),
      goal,
      status: "pending",
      attempts: 0,
      maxAttempts: 3,
      budgetCents,
      spentCents: 0,
      createdAt: now,
      updatedAt: now,
    };
    this.tasks.set(task.id, task);
    return task;
  }

  get(id: string) {
    return this.tasks.get(id);
  }

  update(id: string, patch: Partial<AgentTask>) {
    const task = this.tasks.get(id);
    if (!task) throw new Error(`Task ${id} not found`);
    const next = { ...task, ...patch, updatedAt: Date.now() };
    this.tasks.set(id, next);
    return next;
  }

  list() {
    return [...this.tasks.values()];
  }
}

class AgentRuntime {
  constructor(private store: InMemoryTaskStore) {}

  async runTask(taskId: string) {
    let task = this.store.get(taskId);
    if (!task) throw new Error("Task not found");

    if (task.spentCents >= task.budgetCents) {
      this.store.update(task.id, {
        status: "failed",
        error: "Budget exceeded before start",
      });
      return;
    }

    task = this.store.update(task.id, { status: "running" });

    while (task.attempts < task.maxAttempts) {
      try {
        task = this.store.update(task.id, {
          attempts: task.attempts + 1,
          spentCents: task.spentCents + 15, // 模拟一次推理开销
        });

        if (task.spentCents > task.budgetCents) {
          throw new Error("Budget exceeded");
        }

        // 模拟 Agent 执行
        const result = await this.executeGoal(task.goal);

        this.store.update(task.id, {
          status: "completed",
          result,
        });
        return;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        task = this.store.update(task.id, { error: message });

        if (task.attempts >= task.maxAttempts) {
          this.store.update(task.id, { status: "failed" });
          return;
        }
      }
    }
  }

  private async executeGoal(goal: string): Promise<string> {
    await new Promise((r) => setTimeout(r, 500));

    if (goal.includes("高风险")) {
      throw new Error("Need human approval for high-risk action");
    }

    return `Task done: ${goal}`;
  }
}

// demo
const store = new InMemoryTaskStore();
const runtime = new AgentRuntime(store);

const task = store.create("整理今天的销售日报并发送摘要", 100);
runtime.runTask(task.id).then(() => {
  console.log(store.get(task.id));
});
```

这个示例非常简化，但已经体现出未来 Agent 系统的几个关键属性：

- 任务有生命周期
- 有预算和资源约束
- 有重试和失败处理
- 不再是一次性的 prompt 执行
- 运行时是核心，而非模型本身

---

## 16.2 长期自主 Agent：Computer Use、Browser Use、OS Agent

长期自主 Agent 是未来最具想象力，也最容易被高估的方向。这里的“长期自主”，不是指让 Agent 无限制地自己做任何事，而是指它可以在较长时间内围绕目标持续行动，处理中断、等待、权限审批、环境变化和失败恢复。

### 16.2.1 Browser Use：最先成熟的自主执行形态

在企业和互联网场景中，很多工作天然发生在浏览器里：

- 搜索信息
- 登录系统
- 查询后台
- 填表
- 下载报表
- 提交工单
- 对比页面内容
- 操作 SaaS 产品

因此 Browser Agent 往往是最先落地的。相比 OS 级代理，浏览器环境更容易沙箱化、可记录、可回放，也更适合做权限控制和安全审计。

一个可落地的 Browser Agent 通常包含：

- DOM 结构感知
- 截图与视觉理解
- 动作能力：点击、输入、滚动、等待、下载
- 页面状态检测
- 失败恢复：元素失效、页面重定向、验证码、登录过期
- 人工接管

下面给一个使用 Playwright 的最小 Browser Agent 执行器示例。这里不依赖真实 LLM，只定义一个动作序列执行框架，体现 Browser Use 的工程骨架。

```ts
// browser-agent.ts
import { chromium, Page } from "playwright";

type BrowserAction =
  | { type: "goto"; url: string }
  | { type: "click"; selector: string }
  | { type: "type"; selector: string; text: string }
  | { type: "wait"; ms: number }
  | { type: "extractText"; selector: string };

class BrowserAgentExecutor {
  async run(actions: BrowserAction[]) {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    const outputs: string[] = [];
    try {
      for (const action of actions) {
        const out = await this.execute(page, action);
        if (out) outputs.push(out);
      }
      return outputs;
    } finally {
      await browser.close();
    }
  }

  private async execute(page: Page, action: BrowserAction): Promise<string | null> {
    switch (action.type) {
      case "goto":
        await page.goto(action.url, { waitUntil: "domcontentloaded" });
        return `navigated:${action.url}`;
      case "click":
        await page.click(action.selector);
        return `clicked:${action.selector}`;
      case "type":
        await page.fill(action.selector, action.text);
        return `typed:${action.selector}`;
      case "wait":
        await page.waitForTimeout(action.ms);
        return `waited:${action.ms}`;
      case "extractText":
        const text = await page.textContent(action.selector);
        return text?.trim() ?? "";
    }
  }
}

// demo
(async () => {
  const executor = new BrowserAgentExecutor();
  const logs = await executor.run([
    { type: "goto", url: "https://example.com" },
    { type: "extractText", selector: "h1" },
  ]);

  console.log(logs);
})();
```

在真实系统中，LLM 负责根据页面观察结果输出动作，执行器负责真正执行动作并回传状态。工程重点不在“模型会不会点击按钮”，而在于：

- 选择器如何稳定
- 页面变化如何处理
- 异常如何重试
- 登录态如何托管
- 敏感操作如何二次确认
- 执行过程如何录像和审计

### 16.2.2 Computer Use：从浏览器扩展到桌面应用

Computer Use 指 Agent 可以直接操作计算机界面，包括：

- 桌面应用
- 文件管理器
- 表格软件
- 设计软件
- 终端
- 企业客户端

这比 Browser Use 难得多，主要因为桌面环境更加异构：

- UI 控件不标准
- 分辨率和布局变化大
- Accessibility 信息不总是可用
- 弹窗、焦点、快捷键、权限框都可能打断流程

因此 2026 年前后，Computer Use 更可能在以下环境中成熟：

1. **虚拟化标准环境**
   - 统一镜像
   - 固定分辨率
   - 固定软件版本
2. **高重复性流程**
   - 表单录入
   - 报表导出
   - 工单处理
3. **低风险或可回滚任务**
   - 读取和整理信息
   - 草稿生成
   - 数据核对

如果没有环境标准化，Computer Use 的成功率会急剧下降。

### 16.2.3 OS Agent：真正的“操作系统级助理”还需要时间

OS Agent 的想象空间最大：用户只说目标，Agent 自己决定该调哪些程序、分配哪些资源、什么时候通知你、什么时候请求授权，像“数字操作员”一样工作。

但 OS Agent 落地的关键瓶颈不在模型，而在操作系统本身缺少面向 Agent 的原生抽象：

- 没有统一的任务执行协议
- 没有标准的权限能力模型
- 没有统一的 UI 可操作语义
- 没有 Agent 的生命周期管理接口
- 没有可审计的动作日志标准

因此，未来几年更现实的演进路线是：

- 先做 Browser Agent
- 再做受控环境下的 Computer Agent
- 最后才可能出现真正可靠的 OS Agent

---

## 16.3 多模态 Agent：视觉 + 语音 + 代码

多模态不是简单地“模型能看图、能听音频、能写代码”，而是让 Agent 在任务流中融合多种感知和执行能力。

### 16.3.1 视觉会成为 Agent 的默认输入能力

很多系统过去只能处理结构化数据和文本，但现实世界的工作大量存在于非结构化界面中：

- 屏幕截图
- PDF
- 图表
- 仪表盘
- 拍照上传的票据
- 白板照片
- 原型图
- 视频帧

未来 Agent 如果不能“看”，就无法真正接入大量业务流程。

视觉能力在 Agent 中的价值包括：

- 理解页面布局，而不是只依赖 DOM
- 识别图表异常
- 读取票据和表单
- 理解 UI 截图并生成操作步骤
- 检查生成内容的视觉质量

### 16.3.2 语音将让 Agent 从“工具”变成“伴随式系统”

文本交互适合明确任务，但很多场景需要更自然的输入和更低摩擦的反馈：

- 开车时口述待办
- 开会时实时记录与追问
- 客服与外呼
- 现场运维
- 医疗、教育、培训场景

语音 Agent 的核心不只是 ASR/TTS，而是：

- 流式理解
- 打断处理
- 说话人分离
- 情绪与语气判断
- 语音与任务系统联动

例如一个会议助理 Agent，不只是把语音转文本，而是要：

- 区分谁在说话
- 抽取决策与行动项
- 关联历史项目
- 自动创建任务
- 在会后输出摘要并提醒负责人

### 16.3.3 代码能力会成为 Agent 的“内部执行语言”

很多人把代码 Agent 理解为“帮开发者写代码”。这当然是重要场景，但从系统角度看，更大的意义在于：**代码是 Agent 控制复杂系统的一种中间语言**。

一个成熟 Agent 可以通过代码能力完成：

- 数据清洗和转换
- 自动生成 API 调用逻辑
- 写脚本验证假设
- 生成测试用例
- 处理表格和报表
- 自动修复简单错误
- 构建临时工具

下面给一个 Python 辅助示例：让 Agent 通过执行 Python 代码完成结构化数据分析。真实生产中通常放在沙箱里执行，而不是直接在主机执行。

```python
# sandbox_runner.py
import json
import subprocess
import tempfile
from pathlib import Path

def run_python(code: str):
    with tempfile.TemporaryDirectory() as tmpdir:
        script = Path(tmpdir) / "task.py"
        script.write_text(code, encoding="utf-8")

        result = subprocess.run(
            ["python", str(script)],
            capture_output=True,
            text=True,
            timeout=5
        )

        return {
            "returncode": result.returncode,
            "stdout": result.stdout,
            "stderr": result.stderr
        }

if __name__ == "__main__":
    code = """
import json

orders = [
    {"amount": 120},
    {"amount": 300},
    {"amount": 80}
]

total = sum(x["amount"] for x in orders)
print(json.dumps({"total": total}, ensure_ascii=False))
"""
    print(json.dumps(run_python(code), ensure_ascii=False, indent=2))
```

在多模态 Agent 里，视觉、语音、代码不是并列外挂，而是统一任务回路中的不同能力：

- 视觉负责观察
- 语音负责人机交互
- 代码负责精确执行
- 语言模型负责规划与解释

---

## 16.4 Agent 操作系统：调度、资源管理、权限、生命周期

“Agent 操作系统”并不一定指一个真正替代 Linux/Windows/macOS 的 OS，而更像是一个为 Agent 提供运行环境的系统层。它可能是云平台、企业中台，也可能是本地设备上的 runtime。

这个方向很重要，因为当 Agent 从单次调用变成持续运行的任务体后，系统就必须回答下面的问题：

- 谁先执行？
- 可以调用哪些资源？
- 预算花完怎么办？
- 出错后怎么恢复？
- 需要人工确认时如何挂起？
- 任务完成后如何释放上下文和会话？
- 谁能审计它做过什么？

### 16.4.1 调度：从 Prompt 调用走向任务编排

调度的核心不是“调哪个模型”，而是“如何在资源、优先级、时效性和风险之间做平衡”。

一个企业级 Agent 调度器至少要考虑：

- 优先级队列
- 并发限制
- 租户隔离
- 截止时间
- 重试退避
- 人工审批等待
- 定时触发
- 事件驱动恢复

下面给一个简单的 TypeScript 调度器示例。

```ts
// scheduler.ts
type JobStatus = "queued" | "running" | "done" | "failed";

interface Job {
  id: string;
  name: string;
  priority: number;
  status: JobStatus;
  run: () => Promise<void>;
}

class SimpleScheduler {
  private queue: Job[] = [];
  private running = 0;

  constructor(private concurrency: number) {}

  add(job: Job) {
    this.queue.push(job);
    this.queue.sort((a, b) => b.priority - a.priority);
  }

  async start() {
    while (this.queue.length > 0 || this.running > 0) {
      while (this.running < this.concurrency && this.queue.length > 0) {
        const job = this.queue.shift()!;
        this.running++;
        job.status = "running";

        job.run()
          .then(() => {
            job.status = "done";
          })
          .catch(() => {
            job.status = "failed";
          })
          .finally(() => {
            this.running--;
          });
      }

      await new Promise((r) => setTimeout(r, 100));
    }
  }
}

// demo
const scheduler = new SimpleScheduler(2);

for (let i = 0; i < 5; i++) {
  scheduler.add({
    id: `${i}`,
    name: `job-${i}`,
    priority: i % 2 === 0 ? 10 : 1,
    status: "queued",
    run: async () => {
      console.log("running", i);
      await new Promise((r) => setTimeout(r, 500));
    },
  });
}

scheduler.start().then(() => console.log("all done"));
```

现实中这类系统通常会接入 Redis、消息队列、数据库和可观测平台，而不是只用内存结构。

### 16.4.2 资源管理：Token、工具、GPU、网络、浏览器实例都属于资源

Agent 的资源远不止 CPU 和内存，还包括：

- 模型 token 配额
- 每日预算
- 工具调用次数
- 浏览器 session
- 沙箱容器
- 网络访问权限
- 外部 API quota
- 人工审核带宽

未来的 Agent Platform 很可能像 Kubernetes 管理容器一样管理 Agent 资源：

- 资源申请
- 配额控制
- 限速
- 熔断
- 自动回收
- 成本归集

### 16.4.3 权限：没有权限系统，就没有真正可用的 Agent

很多 Agent demo 最大的问题不是能力不够，而是权限模型过于粗糙。要么权限过大，风险极高；要么权限太小，什么也做不了。

一个成熟的 Agent 权限系统应至少支持：

- 按用户继承权限
- 按任务临时授权
- 按动作类型限制
- 按资源粒度限制
- 高风险动作二次确认
- 审计日志与签名

例如：

| 动作 | 默认策略 |
|---|---|
| 读取公开网页 | 允许 |
| 读取内部文档 | 需用户身份映射 |
| 发送邮件 | 需要明确授权 |
| 转账/支付 | 必须人工确认 |
| 删除数据 | 双重确认 + 审计 |
| 运行代码 | 沙箱内允许 |

### 16.4.4 生命周期：创建、运行、挂起、恢复、终止

Agent 不再是一个函数，而更像一个“实体”。它有自己的状态和生命周期：

- Created
- Scheduled
- Running
- Waiting
- Suspended
- Resumed
- Completed
- Terminated
- Archived

这对系统设计影响很大。比如一个请假审批 Agent：

1. 接收申请
2. 收集上下文
3. 等待主管审批
4. 审批通过后写入系统
5. 通知员工
6. 归档日志

这里 Agent 会经历多次状态切换。没有生命周期管理，系统就无法可靠地处理中断和恢复。

---

## 16.5 经济模型：Agent 的定价、计费、市场

Agent 真正大规模落地，不只取决于技术可行性，还取决于经济可行性。很多 demo 看起来很厉害，但成本高、收益低、无法规模化，因此难以成为稳定产品。

### 16.5.1 定价单位会从“token”扩展到“任务”

今天很多 AI 产品按 token、调用次数或订阅收费，但 Agent 的价值更接近“完成任务”。因此未来常见的定价模式可能包括：

- 按 token 计费
- 按步骤计费
- 按工具调用计费
- 按浏览器会话计费
- 按完成任务计费
- 按节省人工时长分成
- 按业务结果分成

例如：

| 模式 | 适合场景 |
|---|---|
| Token 计费 | 平台 API |
| Seat 订阅 | 企业办公助手 |
| Task 计费 | 自动报销、工单处理 |
| Outcome 计费 | 销售线索跟进、广告优化 |
| 混合计费 | 平台 + 行业解决方案 |

对开发者来说，越靠近业务结果，毛利空间通常越大，但交付责任也越重。

### 16.5.2 成本结构会逼迫架构优化

Agent 的成本不只有模型费用，还包括：

- 推理 token
- 多模态处理
- 浏览器/容器实例
- 向量数据库
- 存储
- 日志与录像
- 审核与人工介入
- 运维与合规

这会推动工程架构做两件事：

1. **模型分层**
   - 小模型做路由、分类、抽取
   - 大模型做规划、复杂推理
2. **动作前置校验**
   - 用规则和状态机过滤不必要调用
   - 用缓存减少重复执行

未来优秀 Agent 产品的竞争力，很多来自“单位任务成本控制”，而不是“模型最强”。

### 16.5.3 Agent 市场会出现，但不会像 App Store 那样简单

“Agent Marketplace”是一个很容易被提起的概念：用户像安装 App 一样安装 Agent。这个方向会发生，但不会那么顺滑，因为 Agent 比 App 更依赖上下文和权限。

Agent 市场要成立，需要解决几个问题：

- Agent 如何描述自己的能力边界
- Agent 需要哪些权限
- 如何验证其安全性
- 如何评估任务成功率
- 如何接入企业内部系统
- 如何进行责任划分和售后支持

因此更可能先出现的是：

- **企业内部 Agent 市场**
- **特定行业 Agent 市场**
- **开发者工具 Agent 插件生态**

而不是完全开放、任意安装、任意执行的全网市场。

---

## 16.6 伦理与安全：对齐、可控性、责任归属

Agent 越接近执行层，伦理与安全问题就越不能被当作“附加项”。

### 16.6.1 对齐问题会从“说错话”升级为“做错事”

传统聊天模型最大的风险是输出不当内容，而 Agent 的风险是直接行动：

- 发错邮件
- 改错数据
- 泄露信息
- 错误下单
- 违规访问
- 执行破坏性命令

因此 Agent 的对齐不只是价值观问题，更是**执行约束问题**。要让 Agent 可控，不能只靠 prompt 说“请谨慎操作”，还需要系统级约束：

- 权限最小化
- 高风险动作审批
- 可回滚设计
- 沙箱执行
- 白名单工具
- 策略引擎拦截

### 16.6.2 可控性比“完全自主”更重要

技术圈常把“自主性”当作能力上限，但企业真正需要的是**可控自主**：

- 低风险任务自动执行
- 中风险任务自动起草 + 人工确认
- 高风险任务只提供建议

这其实是一种分级自治模型：

| 风险等级 | Agent 权限 |
|---|---|
| L1 | 可自动读写低风险系统 |
| L2 | 可执行但需抽样审计 |
| L3 | 必须审批后执行 |
| L4 | 仅建议，不自动执行 |

未来能落地的 Agent，多半不是“什么都能自己做”，而是“知道什么时候该停下来问人”。

### 16.6.3 责任归属将成为商业落地关键

当 Agent 犯错时，责任到底在谁？

- 模型提供方
- Agent 平台方
- 应用开发方
- 企业采购方
- 最终审批人

这个问题没有简单答案，但从工程角度，可以通过以下方式降低模糊性：

- 明确动作来源：谁发起、谁授权、谁执行
- 全链路日志：输入、输出、工具调用、环境状态
- 审批记录：谁在什么时候批准了什么
- 版本可追踪：使用的模型、Prompt、工具版本
- 可解释结果：为什么采取这个动作

责任归属的清晰度，会直接影响企业是否愿意让 Agent 进入关键流程。

---

## 16.7 开发者机会：哪些方向值得投入

前瞻最怕空泛。对 1-3 年经验的开发者来说，更重要的问题是：未来两三年，哪些方向值得学、值得做、值得下注？

### 16.7.1 最值得投入的不是“又一个聊天壳”，而是 Agent 基础设施

如果你希望做长期有复利的事情，优先考虑这些方向：

#### 1. Agent Runtime / Workflow Engine
包括：

- 任务状态机
- 重试与恢复
- 人工审批
- 长期记忆
- 事件驱动
- 调度器

这是所有 Agent 应用的共性基础设施，复用价值高。

#### 2. Tooling 与集成层
包括：

- 浏览器自动化
- 企业 SaaS 集成
- MCP / Tool 协议适配
- 内部 API 封装
- 权限代理层

现实中，Agent 的瓶颈常常不是模型不会思考，而是接不上系统。

#### 3. 安全与治理
包括：

- 策略引擎
- 审计平台
- 权限控制
- 行为回放
- 沙箱执行
- 敏感动作检测

随着 Agent 进入生产环境，这类能力会越来越值钱。

#### 4. 评测与观测
包括：

- 任务成功率评估
- 轨迹分析
- 失败归因
- Prompt 与工具效果对比
- 在线实验平台

Agent 没有观测，就无法迭代；没有评测，就无法采购。

### 16.7.2 行业垂直 Agent 比通用 Agent 更现实

对创业团队和中小团队来说，做“万能 Agent”很难建立壁垒。更好的机会是进入高价值、强流程、数据明确的垂直场景，例如：

- 客服工单流转
- 销售跟进与 CRM 更新
- 财务报销审核
- 招聘筛选与面试记录
- 电商运营
- 合同审阅与法务助手
- IT 运维与知识库支持

这些场景的共同特点是：

- 任务流程清晰
- ROI 容易衡量
- 可逐步引入自动化
- 容易设计审批机制
- 有明确的系统接口

### 16.7.3 多模态执行层会诞生很多新岗位和新产品

未来几年，除了 Agent 应用工程师，还会出现更细分的角色：

- Agent 平台工程师
- Tool/Connector 工程师
- LLMOps / AgentOps 工程师
- AI 安全与治理工程师
- 评测工程师
- 多模态交互设计师

如果你已经有前后端基础，最推荐补齐下面这组能力栈：

- TypeScript / Python
- 异步任务系统
- 浏览器自动化
- API 设计与集成
- Docker / 沙箱环境
- 消息队列
- 数据库与日志系统
- 基本的模型调用与评测方法

### 16.7.4 一个务实的学习路径

如果你准备在未来一年重点投入 Agent，可以按下面顺序推进：

1. **先做单 Agent + Tool Calling**
   - 理解工具调用、结构化输出、重试
2. **再做 Browser / Code Agent**
   - 理解执行环境与外部世界交互
3. **加入状态管理与任务队列**
   - 让系统可以跑长任务
4. **加入权限、预算和审计**
   - 让系统具备生产可用性
5. **最后再做多 Agent 协作**
   - 避免过早复杂化

很多团队失败，不是因为能力太弱，而是过早追求“全自动、多智能体、自我反思、自我进化”，把问题复杂度抬得太高。未来真正能落地的系统，往往是从一个清晰、可测、可控的任务开始，逐步扩大自治边界。

---

## 16.8 一个更现实的判断：Agent 不会一夜改变世界，但会逐层重写软件形态

对 Agent 的未来，最容易出现两种极端判断：

- 一种认为 Agent 很快无所不能，所有软件都会消失；
- 另一种认为 Agent 只是聊天机器人换皮，热度过后不会留下什么。

更现实的判断是：**Agent 不会瞬间替代现有软件，但会逐层重写软件的人机接口、自动化方式和执行结构。**

未来的软件很可能呈现这样的形态：

- 前台仍然有 UI，但 UI 不再是唯一入口
- 后台增加一个 Agent 执行层
- 用户不只是“点按钮”，而是“下达目标”
- 工作流不只是固定配置，而是带有动态决策
- 系统不只记录数据，还会主动行动和协作

这不是“AI 取代软件”，而是“AI 让软件从被动工具变成主动系统”。

对开发者而言，这既是挑战，也是非常大的机会。过去十年，工程师主要在构建页面、接口、数据库和业务流程。接下来几年，工程师会开始构建：

- 会观察的系统
- 会规划的系统
- 会执行的系统
- 会自我恢复的系统
- 但同时也必须是可控、可审计、可治理的系统

Agent 的未来，不属于最会喊口号的人，而属于最能把**智能能力封装进可靠系统**的人。谁能把模型能力变成稳定任务成功率、可解释行为轨迹、可接受单位成本和可审计安全边界，谁就能在下一轮软件形态变化中占据有利位置。

从这个角度看，Agent 的未来不是一个遥远概念，而是一组已经开始发生的工程现实。你现在写下的每一个工具适配器、每一个调度器、每一个权限策略、每一个回放系统，都可能是下一代 Agent 平台的一部分。
