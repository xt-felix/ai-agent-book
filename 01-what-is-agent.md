# 第 1 章：什么是 AI Agent

# 第一章 什么是 AI Agent

过去几年里，很多产品都开始自称“Agent”。写代码的是 Agent，自动发邮件的是 Agent，能帮你点外卖的也是 Agent。这个词正在迅速流行，但也因此变得模糊：**到底什么是 Agent？它和聊天机器人、Copilot、自动化工作流到底有什么区别？**

如果只从产品宣传来理解 Agent，很容易陷入两个误区：

- 误区一：**只要接了大模型，就是 Agent**
- 误区二：**只要能调用工具，就是 Agent**

这两个说法都不准确。  
Agent 不是一个单点能力，而是一类**能够在目标驱动下，感知环境、进行决策、采取行动，并根据反馈持续调整行为的系统**。大模型让这种系统的构建成本大幅下降，但 Agent 的概念并不是从大模型时代才开始出现的。

这一章我们会从经典定义出发，逐步走到 LLM-based Agent 的新范式，并讨论它与 Chatbot、Copilot、Workflow 的边界。最后，我们结合 Devin、Claude Code、AutoGPT 三个真实案例，看看“Agent”在实际工程中到底长什么样。

---

## 1.1 Agent 的学术定义

在人工智能和分布式系统领域，“Agent”并不是一个新词。早在大模型出现之前，学界就已经对 Agent 有相对稳定的定义。

一个广泛接受的描述是：

> **Agent 是一个位于环境中的自治实体，它能够通过传感器感知环境，并通过执行器作用于环境，以实现自身目标。**

这个定义看起来抽象，但它包含了几个关键点：

- **位于环境中**：Agent 不是孤立的，它一定和外部环境发生交互
- **能够感知环境**：它能获取输入，比如用户指令、文件系统、浏览器页面、数据库状态、API 返回值
- **能够作用于环境**：它不只是“说”，还会“做”，例如写文件、调用工具、发送请求、执行命令
- **具有目标导向性**：Agent 的行为不是完全随机的，而是朝着某个目标推进

如果把它翻译成软件工程的语言，Agent 更像一个“持续运行的决策系统”，而不是一个单轮输入输出函数。

---

## 1.2 Agent 的四个核心特征

在多智能体和软件 Agent 的经典研究里，经常会用四个维度描述 Agent 的核心属性：

1. **自主性（Autonomy）**
2. **反应性（Reactivity）**
3. **主动性/目标导向（Proactiveness）**
4. **社交能力（Social Ability）**

你题目里特别要求“BDI 模型、自主性、反应性、社交能力”，这里我们把它们放到一个统一框架中讲。

### 1.2.1 自主性：不是每一步都等人指挥

自主性指的是：**Agent 可以在没有人类持续干预的情况下，自行决定下一步做什么。**

例如，一个普通的问答机器人通常是：

- 用户问一句
- 模型答一句
- 结束

而一个具有自主性的 Agent 会这样工作：

- 用户给出目标：“帮我分析这个 GitHub 仓库的架构并生成技术文档”
- Agent 自主决定：
  - 先读取 README
  - 再扫描目录结构
  - 再分析 package.json / requirements.txt
  - 再抽取主要模块
  - 最后输出文档
- 如果中途失败，还会尝试改用别的方法

这里的区别在于：**用户提供的是目标，而不是每一个步骤的脚本**。

当然，自主性并不等于完全自由。工程上我们通常会给 Agent 加边界：

- 最大步数
- 可用工具白名单
- 可访问目录限制
- 是否允许执行 shell 命令
- 是否需要人工确认

也就是说，真正可用的 Agent 通常是“**受约束的自主性**”。

---

### 1.2.2 反应性：看到变化就调整行为

反应性指的是：**Agent 能够根据环境变化及时调整自身行为。**

这意味着 Agent 不是照着固定脚本机械执行，而是会根据新观测动态改变策略。

比如一个代码修复 Agent 的流程可能是：

1. 读取 bug 描述
2. 修改代码
3. 运行测试
4. 发现测试失败
5. 读取报错日志
6. 再次修改代码
7. 重新运行测试

第 4 步的“测试失败”就是环境反馈。  
如果系统能够根据这个反馈决定后续动作，它就具有反应性。

再看一个更生活化的例子：

- 用户要求：“帮我订明天下午从北京到上海的机票，尽量便宜”
- Agent 查询后发现低价票已售罄
- 它可能会主动切换策略：
  - 改查临近时间段
  - 改查高铁
  - 或者询问用户是否接受中转

这种基于环境变化进行调整的能力，是 Agent 与静态工作流的重要分界线之一。

---

### 1.2.3 社交能力：不仅能和人交互，也能和系统交互

社交能力（Social Ability）在学术上通常指：**Agent 能够通过某种通信语言与其他 Agent 或人类进行交互与协作。**

在今天的大模型系统里，这个定义可以扩展为：

- 与用户对话
- 与其他 Agent 协作
- 与外部工具/API 协作
- 与软件系统交换结构化消息

例如，一个研究型 Agent 可能把工作拆给多个子 Agent：

- 检索 Agent：负责搜集资料
- 总结 Agent：负责提炼关键信息
- 验证 Agent：负责事实核查
- 写作 Agent：负责成文输出

它们之间通过消息、共享状态、任务队列进行协作。  
这就是社交能力在现代工程系统中的体现。

从实现角度说，社交能力往往表现为几类接口：

- 自然语言接口
- 工具调用协议（Tool Calling / Function Calling）
- 任务编排协议
- 状态共享机制
- 多 Agent 消息总线

很多人会忽略一点：**一个会调用工具的 Agent，本质上已经具备了某种“社交能力”**，因为工具可以被看作环境中的其他能力体。

---

## 1.3 BDI 模型：经典 Agent 理论框架

如果只说“能感知、能行动”，还是有点空。经典 Agent 理论里，一个非常有代表性的认知模型是 **BDI（Belief-Desire-Intention）**。

BDI 的核心思想是：用接近人类意图推理的方式，描述 Agent 如何决策。

- **Belief（信念）**：Agent 对世界状态的认识
- **Desire（愿望）**：Agent 想达成的目标集合
- **Intention（意图）**：Agent 当前承诺要执行的计划或行动

这个模型非常适合解释为什么 Agent 不是简单的“输入 → 输出”。

---

### 1.3.1 Belief：Agent 眼中的世界

Belief 不是世界的真实状态，而是 **Agent 当前认为世界是什么样子**。

比如一个代码 Agent 的 Belief 可能包括：

- 当前仓库使用 TypeScript
- 项目使用 pnpm 管理依赖
- `npm test` 会失败
- `src/auth.ts` 可能是 bug 根因位置
- 用户要求“不修改公共 API”

这些信息可能来自：

- 用户输入
- 文件读取
- 工具调用结果
- 历史记忆
- 运行反馈

Belief 之所以重要，是因为 Agent 的决策都是基于它来做的。  
如果 Belief 错了，比如误判项目是 npm 而不是 pnpm，后续行动很可能全错。

这也是为什么现代 Agent 系统很重视：

- 观察结果结构化
- 上下文管理
- 长短期记忆
- 工具结果校验

因为这些机制本质上都在维护 Belief。

---

### 1.3.2 Desire：想做什么

Desire 表示 Agent 的目标或偏好。  
它通常不是唯一的，而是一个候选目标集合。

比如用户说：

> 帮我把这个仓库修到测试通过，并尽量少改代码。

那么 Agent 的 Desire 可能包括：

- 修复 bug
- 让测试通过
- 控制改动范围
- 避免引入新依赖
- 保持代码风格一致

这些目标之间有时会冲突。例如：

- “尽快修好” 与 “尽量少改代码”
- “提高性能” 与 “保持实现简单”
- “自动完成任务” 与 “谨慎避免风险操作”

所以 Agent 需要在多个 Desire 中做取舍。

---

### 1.3.3 Intention：当前决定执行什么

Intention 是 Agent 从众多 Desire 中筛选出来、决定投入资源去执行的那部分计划。

继续上面的例子，Agent 最终可能形成这样的 Intention：

1. 先运行测试定位失败点
2. 阅读相关模块源码
3. 修改最小范围代码
4. 再次运行测试验证
5. 输出补丁说明

这就是一个“已承诺的计划”。

BDI 的关键价值在于：它解释了 Agent 不只是响应刺激，而是在内部维护一个**世界模型 + 目标系统 + 执行承诺**。

---

### 1.3.4 用代码理解 BDI

下面用一个简化的 TypeScript 示例模拟 BDI 决策结构。它不是完整 Agent 框架，但足够帮助你建立工程直觉。

```ts
type Belief = {
  repoType?: "node" | "python";
  testCommand?: string;
  testsPassing?: boolean;
  suspectedFile?: string;
};

type Desire =
  | "fix_bug"
  | "pass_tests"
  | "minimize_changes"
  | "avoid_new_dependencies";

type Intention = {
  plan: string[];
  currentStep: number;
};

class SimpleBDIAgent {
  private beliefs: Belief = {};
  private desires: Desire[] = [
    "fix_bug",
    "pass_tests",
    "minimize_changes",
    "avoid_new_dependencies",
  ];
  private intention: Intention | null = null;

  updateBeliefs(observation: Partial<Belief>) {
    this.beliefs = { ...this.beliefs, ...observation };
  }

  deliberate() {
    // 根据 belief + desire 形成 intention
    const plan: string[] = [];

    if (!this.beliefs.testCommand) {
      plan.push("detect_test_command");
    }

    plan.push("run_tests");

    if (this.beliefs.suspectedFile) {
      plan.push(`inspect_${this.beliefs.suspectedFile}`);
    } else {
      plan.push("inspect_failure_related_files");
    }

    plan.push("apply_minimal_patch");
    plan.push("run_tests_again");
    plan.push("summarize_changes");

    this.intention = {
      plan,
      currentStep: 0,
    };
  }

  nextAction(): string | null {
    if (!this.intention) return null;
    const action = this.intention.plan[this.intention.currentStep];
    if (!action) return null;
    this.intention.currentStep += 1;
    return action;
  }
}

const agent = new SimpleBDIAgent();

agent.updateBeliefs({
  repoType: "node",
  testCommand: "pnpm test",
  suspectedFile: "src/auth.ts",
});

agent.deliberate();

let action: string | null;
while ((action = agent.nextAction())) {
  console.log("执行动作:", action);
}
```

输出可能类似：

```txt
执行动作: run_tests
执行动作: inspect_src/auth.ts
执行动作: apply_minimal_patch
执行动作: run_tests_again
执行动作: summarize_changes
```

这个例子揭示了一个重要事实：  
**Agent 的本质不在于“会不会聊天”，而在于“是否维护内部状态，并基于状态进行连续决策”。**

---

## 1.4 从经典 Agent 到 LLM-based Agent

传统 Agent 研究已经存在很多年，但为什么直到大模型出现后，Agent 才突然爆发？

原因在于：大模型补齐了过去 Agent 最难的一块——**通用推理与开放任务分解能力**。

传统 Agent 往往依赖：

- 专家规则
- 明确状态机
- 预定义计划库
- 手工编排动作

这种方式在封闭环境里很好用，但一旦面对开放世界任务，比如“帮我调研一下某个技术趋势并整理成 PPT”，就会非常吃力。

而大模型带来了三项关键变化：

1. **自然语言成为统一接口**
2. **模型具备一定的任务分解与推理能力**
3. **工具调用让语言模型从“会说”变成“能做”**

于是，一种新的系统范式出现了：**LLM-based Agent**。

---

## 1.5 LLM-based Agent 的新范式：感知 → 推理 → 行动 → 反思

现代 LLM-based Agent 通常可以抽象成一个循环：

```txt
感知（Perceive）→ 推理（Reason）→ 行动（Act）→ 反思（Reflect）
                   ↑                              ↓
                   └────────── 环境反馈 ──────────┘
```

这是理解现代 Agent 的核心。

---

### 1.5.1 感知：从环境读取上下文

感知阶段的任务是：**获取当前决策所需的上下文信息**。

输入可能包括：

- 用户目标
- 聊天历史
- 文件内容
- 数据库查询结果
- API 返回值
- 浏览器页面 DOM
- shell 执行日志
- 测试结果
- 监控指标

在工程里，感知常对应以下动作：

- `read_file`
- `search_code`
- `fetch_url`
- `query_db`
- `get_page_text`
- `list_directory`

感知阶段的质量直接决定了后续推理质量。  
很多 Agent 失败并不是“模型不够聪明”，而是因为它看到的信息不完整、过时或噪声太大。

---

### 1.5.2 推理：决定下一步做什么

推理阶段是 Agent 的“脑内工作区”。  
它会根据当前上下文，决定：

- 现在最重要的问题是什么
- 是否需要进一步搜集信息
- 应该调用哪个工具
- 是否需要先规划再执行
- 是否已经足以给出最终答案

在大模型系统中，这部分通常由 Prompt + 模型推断来完成。  
典型形式包括：

- ReAct 风格的思考与行动交替
- 显式规划（Plan）
- 子任务分解（Task Decomposition）
- 自我检查（Self-critique）

注意，工程上不一定要把“推理过程”完整暴露给用户。很多生产系统会做两件事：

- 将内部推理压缩成结构化决策
- 只输出必要的中间理由，而不泄露冗长链路

---

### 1.5.3 行动：调用工具改变环境

行动阶段表示 Agent 不再只是“生成文本”，而是通过某种执行器对环境产生影响。

例如：

- 调用搜索 API
- 修改代码文件
- 运行测试
- 创建 Jira 工单
- 发送 Slack 消息
- 在浏览器中点击按钮
- 调用内部服务

这一步让 Agent 具备了真正的业务价值。

在今天的 LLM 产品中，行动通常通过以下方式实现：

- Function Calling
- Tool Calling
- MCP（Model Context Protocol）类型接口
- Shell / Browser / FileSystem 沙箱
- HTTP API 适配器

---

### 1.5.4 反思：利用反馈迭代修正

反思是现代 Agent 比简单“工具调用机器人”更高级的地方。  
它会根据行动结果重新评估：

- 结果是否成功
- 是否达到了目标
- 是否出现了错误
- 是否应该更换策略
- 是否需要回滚或求助

例如：

- 测试没通过 → 重新定位问题
- 页面元素找不到 → 改变浏览策略
- API 返回权限错误 → 请求用户授权
- 搜索结果互相矛盾 → 增加验证步骤

从工程角度看，反思不一定非要是“深度自我思考”，它可以很务实：

- 成功/失败检查器
- 输出校验器
- 结构化断言
- 自动重试策略
- 审阅模型（critic model）

---

## 1.6 一个最小可运行的 Agent 循环

下面用 TypeScript 写一个非常简化但可以运行的 Agent Loop。  
这个示例不会接真实大模型，而是用规则函数模拟推理过程，重点帮助你理解系统结构。

```ts
type Observation = {
  userGoal: string;
  files: Record<string, string>;
  lastResult?: string;
};

type Action =
  | { type: "read_file"; path: string }
  | { type: "write_file"; path: string; content: string }
  | { type: "finish"; message: string };

class MiniAgent {
  constructor(private state: Observation) {}

  perceive(): Observation {
    return this.state;
  }

  reason(obs: Observation): Action {
    if (!obs.files["README.md"]) {
      return {
        type: "write_file",
        path: "README.md",
        content: `# 项目说明\n\n目标：${obs.userGoal}\n`,
      };
    }

    return {
      type: "finish",
      message: "README.md 已存在，任务完成。",
    };
  }

  act(action: Action) {
    switch (action.type) {
      case "read_file":
        this.state.lastResult = this.state.files[action.path] ?? "文件不存在";
        break;
      case "write_file":
        this.state.files[action.path] = action.content;
        this.state.lastResult = `已写入 ${action.path}`;
        break;
      case "finish":
        this.state.lastResult = action.message;
        break;
    }
  }

  reflect(action: Action): boolean {
    if (action.type === "finish") return true;
    return false;
  }

  run(maxSteps = 5) {
    for (let i = 0; i < maxSteps; i++) {
      const obs = this.perceive();
      const action = this.reason(obs);

      console.log(`Step ${i + 1} action:`, action);

      this.act(action);

      if (this.reflect(action)) {
        console.log("Final:", this.state.lastResult);
        return;
      }
    }

    console.log("达到最大步数，停止执行。");
  }
}

const agent = new MiniAgent({
  userGoal: "为项目初始化说明文档",
  files: {},
});

agent.run();
```

运行结果：

```txt
Step 1 action: { type: 'write_file', path: 'README.md', content: '# 项目说明\n\n目标：为项目初始化说明文档\n' }
Step 2 action: { type: 'finish', message: 'README.md 已存在，任务完成。' }
Final: README.md 已存在，任务完成。
```

这个例子很小，但已经具备了 Agent 的基本特征：

- 有状态
- 有循环
- 能感知环境
- 能做决策
- 能采取行动
- 能根据结果决定是否结束

把“规则推理”换成 LLM，把“内存文件系统”换成真实工具环境，它就会逐步演化成一个真正的 LLM Agent。

---

## 1.7 Agent、Chatbot、Copilot、Workflow 有什么区别

这几个概念经常被混用，尤其在产品宣传里。但如果你要做系统设计，必须把边界分清楚。

下面先给出一个直观理解：

- **Chatbot**：以对话为中心，主要输出文本
- **Copilot**：以辅助为中心，人机协同，人在回路中
- **Workflow**：以预定义流程为中心，步骤固定
- **Agent**：以目标达成为中心，能够动态决策和执行

---

## 1.8 四类系统对比表

| 维度 | Chatbot | Copilot | Workflow | Agent |
|---|---|---|---|---|
| 核心目标 | 回答问题、提供信息 | 辅助人完成任务 | 自动执行固定流程 | 自主达成目标 |
| 交互方式 | 多轮对话 | 人机协作 | 事件驱动/流程触发 | 目标驱动 + 持续交互 |
| 是否能调用工具 | 可选 | 通常可以 | 可以 | 通常必须 |
| 是否动态决策 | 弱 | 中 | 低 | 高 |
| 是否维护长期状态 | 一般较弱 | 中 | 通常由流程系统维护 | 强 |
| 是否能自主规划 | 很少 | 有限 | 基本没有 | 核心能力之一 |
| 人是否持续参与 | 通常发起问题即可 | 通常需要持续确认 | 往往不需要 | 视风险和设计而定 |
| 适用任务 | FAQ、咨询、闲聊 | 写代码、写文档、分析数据 | 审批流、ETL、通知链路 | 调研、编码、运维、跨系统执行 |
| 失败模式 | 答错、幻觉 | 建议不靠谱 | 流程僵化、覆盖不足 | 误规划、误操作、循环失控 |
| 典型例子 | 客服机器人 | GitHub Copilot、Office Copilot | Zapier、Airflow DAG | Devin、AutoGPT、Claude Code |

这个表里最重要的一列是：**是否动态决策**。

一个系统即使调用了很多工具，如果所有步骤都是预先写死的，它本质上还是 Workflow，不是 Agent。  
相反，一个系统即使工具不多，但它能根据环境反馈动态决定下一步，它就更接近 Agent。

---

## 1.9 用例子区分四者

### Chatbot 示例
用户问：

> Kubernetes 中 Deployment 和 StatefulSet 有什么区别？

系统回答概念解释。  
它主要输出文本，不采取外部行动。

### Copilot 示例
用户在 IDE 里写代码时，系统建议：

- 自动补全函数
- 解释报错
- 生成单元测试
- 提议重构方案

它帮助你，但通常不会在未经确认的情况下连续执行很多步。

### Workflow 示例
当用户在表单里提交请假申请时：

1. 创建审批单
2. 通知直属领导
3. 审批通过后同步到 HR 系统
4. 发邮件确认

整个链路是预定义的，几乎没有动态推理。

### Agent 示例
用户说：

> 帮我定位线上报错的原因，如果能安全修复就提交 PR，并附上分析报告。

系统可能会：

1. 查询监控告警
2. 拉取日志
3. 分析最近变更
4. 定位可疑模块
5. 编写修复代码
6. 跑测试
7. 生成 PR
8. 写总结说明
9. 如遇高风险则暂停并请求人工确认

这已经不是“问答”或“固定流程”，而是目标驱动下的连续决策执行。

---

## 1.10 经典 Agent 架构图解

理解 Agent，最好的方式之一就是看架构模式。  
这一节我们重点讲三种你在工程实践中最常见的架构：

1. **ReAct**
2. **Plan-and-Execute**
3. **LangGraph State Machine**

---

## 1.11 ReAct：推理与行动交替

ReAct 的名字来自 **Reason + Act**。  
它的核心思想很简单：**让模型在推理和行动之间交替进行**。

### ReAct 流程图

```txt
用户目标
   ↓
Thought（思考）
   ↓
Action（调用工具）
   ↓
Observation（观察结果）
   ↓
Thought（重新思考）
   ↓
Action
   ↓
Observation
   ↓
...
   ↓
Final Answer
```

ReAct 之所以有效，是因为很多复杂任务不可能一开始就知道答案。  
你必须先试探、再观察、再修正。

例如做技术调研时：

- Thought：先搜索官方文档
- Action：调用搜索工具
- Observation：发现版本差异较大
- Thought：需要限定版本范围
- Action：再次检索
- Observation：拿到更精确结果
- Final Answer：输出结论

### ReAct 的优点

- 实现简单
- 对开放问题适应性强
- 非常适合工具调用场景
- 能利用环境反馈逐步逼近目标

### ReAct 的缺点

- 步数可能很多，成本较高
- 容易陷入局部试探
- 缺乏全局规划时，可能走弯路
- 审计和可控性相对弱

---

### ReAct 伪代码示例（TypeScript）

```ts
type ToolResult = string;

interface Tool {
  name: string;
  call(input: string): Promise<ToolResult>;
}

async function reactAgent(
  userGoal: string,
  tools: Tool[],
  maxSteps = 5
): Promise<string> {
  let scratchpad = `用户目标: ${userGoal}\n`;

  for (let step = 0; step < maxSteps; step++) {
    // 实际场景中这里会调用 LLM
    const thought = `我需要根据已有信息决定下一步行动，第 ${step + 1} 步。`;
    scratchpad += `Thought: ${thought}\n`;

    // 这里用简单规则模拟选择工具
    const tool = tools[0];
    const toolInput = userGoal;

    scratchpad += `Action: ${tool.name}(${toolInput})\n`;

    const observation = await tool.call(toolInput);
    scratchpad += `Observation: ${observation}\n`;

    if (observation.includes("完成")) {
      return `Final Answer:\n${observation}`;
    }
  }

  return `Final Answer:\n未能在最大步数内完成任务。\n\n${scratchpad}`;
}
```

---

## 1.12 Plan-and-Execute：先规划，再执行

ReAct 的问题在于它常常“边走边看”，缺乏全局视角。  
于是出现了另一种经典模式：**Plan-and-Execute**。

它把任务拆成两个阶段：

1. **Planner**：先生成高层计划
2. **Executor**：按计划逐步执行，必要时局部调整

### 架构图

```txt
用户目标
   ↓
Planner（规划器）
   ↓
生成任务计划
   ↓
Executor（执行器）
   ↓
步骤1 → 反馈
步骤2 → 反馈
步骤3 → 反馈
   ↓
必要时重规划
   ↓
输出结果
```

例如用户说：

> 帮我完成竞品调研并输出汇报提纲

Planner 可能先给出：

1. 确定竞品范围
2. 收集公开资料
3. 比较功能矩阵
4. 分析定价策略
5. 生成汇报提纲

然后 Executor 逐项完成。

### 优点

- 更适合长任务
- 结构清晰，可审计
- 容易加入人工审批点
- 更利于预算控制和任务拆分

### 缺点

- 计划可能一开始就不合理
- 环境变化大时，初始规划容易失效
- 规划和执行之间可能脱节

---

### Plan-and-Execute 示例代码

```ts
type PlanStep = {
  id: number;
  description: string;
  done: boolean;
};

class Planner {
  createPlan(goal: string): PlanStep[] {
    return [
      { id: 1, description: `理解任务目标：${goal}`, done: false },
      { id: 2, description: "收集相关信息", done: false },
      { id: 3, description: "整理并生成结果", done: false },
    ];
  }
}

class Executor {
  async execute(step: PlanStep): Promise<string> {
    step.done = true;
    return `已完成步骤 ${step.id}: ${step.description}`;
  }
}

async function runPlanAndExecute(goal: string) {
  const planner = new Planner();
  const executor = new Executor();

  const plan = planner.createPlan(goal);
  console.log("生成计划:");
  console.table(plan);

  for (const step of plan) {
    const result = await executor.execute(step);
    console.log(result);
  }

  console.log("任务完成");
}

runPlanAndExecute("分析仓库结构并生成技术文档");
```

---

## 1.13 LangGraph State Machine：显式状态驱动

当 Agent 进入生产环境后，仅靠“在 Prompt 里写循环”通常是不够的。  
你需要更强的：

- 状态可见性
- 分支控制
- 错误恢复
- 人工介入
- 可重放和可追踪能力

这时，**状态机（State Machine）** 就非常重要。  
LangGraph 之所以受欢迎，就是因为它把 Agent 看作一个**有向状态图**。

### 核心思想

- 每个节点表示一个处理步骤
- 每条边表示状态转移条件
- 整个系统在共享状态上运行
- 可以循环、分支、暂停、恢复

### 图解

```txt
        ┌─────────────┐
        │   START     │
        └──────┬──────┘
               ↓
        ┌─────────────┐
        │  感知输入    │
        └──────┬──────┘
               ↓
        ┌─────────────┐
        │   任务规划   │
        └───┬─────┬───┘
            ↓     ↓
       简单任务   复杂任务
         ↓         ↓
   ┌─────────┐  ┌─────────┐
   │ 直接执行 │  │ 工具调用 │
   └────┬────┘  └────┬────┘
        ↓            ↓
        └──────┬─────┘
               ↓
        ┌─────────────┐
        │ 结果校验/反思│
        └───┬─────┬───┘
            ↓     ↓
          成功   失败重试
            ↓     ↑
        ┌─────────────┐
        │    END      │
        └─────────────┘
```

### 为什么状态机适合生产

因为生产系统最怕“不可控的自由循环”。  
状态机的优势在于：

- 每一步都可观测
- 每次转移都有条件
- 可以设置超时、预算、重试上限
- 可以插入人工审核节点
- 可以持久化状态，异常后恢复

对企业系统而言，这比“纯 Prompt Agent”可靠得多。

---

### 一个简化版状态机示例（TypeScript）

```ts
type AgentState = {
  goal: string;
  plan?: string[];
  currentStep: number;
  result?: string;
  status: "planning" | "executing" | "reflecting" | "done";
};

function planningNode(state: AgentState): AgentState {
  return {
    ...state,
    plan: ["读取项目文件", "分析模块", "生成文档"],
    status: "executing",
  };
}

function executingNode(state: AgentState): AgentState {
  const plan = state.plan ?? [];
  if (state.currentStep >= plan.length) {
    return { ...state, status: "reflecting" };
  }

  console.log("执行:", plan[state.currentStep]);
  return {
    ...state,
    currentStep: state.currentStep + 1,
  };
}

function reflectingNode(state: AgentState): AgentState {
  return {
    ...state,
    result: `已完成目标：${state.goal}`,
    status: "done",
  };
}

function runStateMachine(initial: AgentState) {
  let state = initial;

  while (state.status !== "done") {
    switch (state.status) {
      case "planning":
        state = planningNode(state);
        break;
      case "executing":
        state = executingNode(state);
        break;
      case "reflecting":
        state = reflectingNode(state);
        break;
    }
  }

  console.log(state.result);
}

runStateMachine({
  goal: "分析仓库并生成文档",
  currentStep: 0,
  status: "planning",
});
```

---

## 1.14 三种架构怎么选

| 架构 | 适用场景 | 优点 | 风险 |
|---|---|---|---|
| ReAct | 开放式探索、检索、简单工具调用 | 灵活、易实现 | 成本高、易绕路 |
| Plan-and-Execute | 长任务、可拆解任务 | 全局清晰、便于控制 | 初始计划可能失真 |
| State Machine / LangGraph | 生产系统、可审计流程 | 稳定、可恢复、可观测 | 实现复杂度更高 |

实际项目里，你很少只用一种模式。  
更常见的是混合架构：

- 外层用状态机控流程
- 某个节点内部使用 ReAct
- 长任务先 Plan，再由执行节点逐步完成
- 最后加一个 Reflection/Verifier 节点做校验

这也是现代 Agent 工程的主流路线：  
**不是追求“最聪明的单体 Agent”，而是追求“可控、可审计、可恢复的 Agent 系统”。**

---

## 1.15 真实案例一：Devin 架构简析

Devin 被广泛视为“AI 软件工程师”方向的代表案例。虽然外界无法看到其完整内部实现，但从公开演示和产品能力可以推断，它很可能是一个**多工具、多状态、长时运行的代码 Agent 系统**。

### Devin 的典型能力

- 理解自然语言需求
- 浏览代码仓库
- 搜索文档
- 编写和修改代码
- 执行 shell 命令
- 运行测试
- 使用浏览器操作网页
- 根据失败结果迭代修复
- 最终提交结果

### 推测的核心架构

```txt
用户目标
   ↓
任务理解/规划器
   ↓
代码环境沙箱（repo + shell + browser）
   ↓
执行代理循环
  ├─ 读代码
  ├─ 搜文档
  ├─ 改代码
  ├─ 跑测试
  ├─ 看日志
  └─ 重试修复
   ↓
验证器
   ↓
结果输出 / PR / 报告
```

### Devin 的关键工程点

1. **持久执行环境**
   - 不是一次性推理，而是持续运行的任务会话
   - 需要保存文件状态、命令历史、执行日志

2. **多模态工具接入**
   - 文件系统
   - shell
   - 浏览器
   - 代码搜索
   - 测试框架

3. **长链路任务拆解**
   - 真实软件开发任务不可能一跳完成
   - 必须具备计划、执行、验证、重试机制

4. **失败驱动的迭代**
   - 测试失败、编译错误、页面报错，都是环境反馈
   - 系统会围绕这些反馈不断修正

如果用前面讲的术语总结，Devin 是非常典型的：

- 高自主性
- 强反应性
- 强工具行动能力
- 明显采用 plan + act + reflect 的循环系统

---

## 1.16 真实案例二：Claude Code 架构简析

Claude Code 代表的是另一类非常重要的 Agent 形态：**终端/IDE 内的代码执行 Agent**。

它不像传统 Chatbot 那样停留在“告诉你怎么做”，而是直接进入项目环境：

- 读取代码
- 修改文件
- 执行命令
- 分析输出
- 与开发者
