import { defineConfig } from "vitepress";

export default defineConfig({
  title: "AI Agent 开发实战",
  description: "从原理到生产的 AI Agent 开发指南",
  lang: "zh-CN",
  themeConfig: {
    nav: [
      { text: "首页", link: "/" },
      { text: "开始阅读", link: "/00-preface" },
    ],
    sidebar: [
      {
        text: "入门篇",
        items: [
          { text: "前言：为什么是 Agent 之年", link: "/00-preface" },
          { text: "第 1 章：什么是 AI Agent", link: "/01-what-is-agent" },
          { text: "第 2 章：大模型基础", link: "/02-llm-foundation" },
        ],
      },
      {
        text: "核心能力篇",
        items: [
          { text: "第 3 章：工具调用", link: "/03-tool-use" },
          { text: "第 4 章：记忆系统", link: "/04-memory" },
          { text: "第 5 章：规划与推理", link: "/05-planning" },
          { text: "第 6 章：多 Agent 协作", link: "/06-multi-agent" },
        ],
      },
      {
        text: "框架与进阶篇",
        items: [
          { text: "第 7 章：LangGraph 深入", link: "/07-langgraph" },
          { text: "第 8 章：高级 RAG", link: "/08-rag-advanced" },
          { text: "第 9 章：代码 Agent", link: "/09-code-agent" },
          { text: "第 10 章：评估与测试", link: "/10-evaluation" },
        ],
      },
      {
        text: "生产篇",
        items: [
          { text: "第 11 章：生产化部署", link: "/11-production" },
          { text: "第 12 章：MCP 协议", link: "/12-mcp" },
          { text: "第 13 章：人机协作", link: "/13-human-in-loop" },
        ],
      },
      {
        text: "实战案例篇",
        items: [
          { text: "第 14 章：智能客服 Agent", link: "/14-case-customer-service" },
          { text: "第 15 章：数据分析 Agent", link: "/15-case-data-analyst" },
          { text: "第 16 章：Agent 的未来", link: "/16-future" },
        ],
      },
    ],
    socialLinks: [
      { icon: "github", link: "https://github.com/anthropics/claude-code" },
    ],
    outline: { level: [2, 3], label: "本章目录" },
    search: { provider: "local" },
    footer: {
      message: "AI Agent 开发实战：从原理到生产",
      copyright: "Powered by GPT-5.4 + VitePress",
    },
  },
});
