# GitHub 代码审查 Agent

基于 Mastra 框架开发的智能代码审查 Agent，能够自动分析 GitHub 仓库的提交并生成详细的代码审查报告。

## 功能特性

- 📊 **仓库信息解析**: 自动解析 GitHub 仓库 URL，提取所有者和仓库名称
- 🔍 **提交分析**: 获取最新的提交记录和详细的文件变更信息
- 🛡️ **安全审查**: 检测潜在的安全漏洞和注入攻击
- ⚡ **性能分析**: 识别性能瓶颈和算法效率问题
- 📝 **代码质量**: 评估代码可读性、可维护性和最佳实践
- 🎯 **智能建议**: 提供具体的改进建议和行动项

## 文件结构

```
src/mastra/
├── agents/
│   └── code-review-agent.ts          # 主要的代码审查 Agent
├── tools/
│   └── github-tool.ts                # GitHub API 工具集
├── workflows/
│   └── code-review-workflow.ts       # 代码审查工作流
├── examples/
│   └── code-review-example.ts        # 使用示例
└── test-review.ts                    # 简单测试文件
```

## 核心组件

### 1. GitHub API 工具 (`github-tool.ts`)

提供三个核心工具：
- `parseRepoUrlTool`: 解析 GitHub 仓库 URL
- `getCommitsTool`: 获取仓库的最新提交
- `getCommitDetailTool`: 获取特定提交的详细信息

### 2. 代码审查 Agent (`code-review-agent.ts`)

配置了专业的代码审查指令，能够：
- 进行全面的代码质量分析
- 识别安全风险和性能问题
- 提供结构化的审查报告
- 给出具体的改进建议

### 3. 审查工作流 (`code-review-workflow.ts`)

自动化的代码审查流程：
1. 解析仓库 URL
2. 获取最新提交
3. 分析提交详情
4. 生成审查报告

## 使用方法

### 1. 直接使用 Agent

```typescript
import { codeReviewAgent } from './agents/code-review-agent';

const response = await codeReviewAgent.stream([
  {
    role: 'user',
    content: '请分析这个GitHub仓库的最新提交: https://github.com/microsoft/vscode',
  },
]);

for await (const chunk of response.textStream) {
  process.stdout.write(chunk);
}
```

### 2. 使用工作流

```typescript
import { Mastra } from '@mastra/core';
import { codeReviewAgent } from './agents/code-review-agent';
import { codeReviewWorkflow } from './workflows/code-review-workflow';

const mastra = new Mastra({
  agents: { codeReviewAgent },
  workflows: { codeReviewWorkflow },
});

const workflow = mastra.getWorkflow('codeReviewWorkflow');
const result = await workflow.execute({
  repoUrl: 'https://github.com/facebook/react',
});
```

### 3. 快速测试

```bash
# 运行测试文件
npx ts-node src/mastra/test-review.ts
```

## 审查报告格式

Agent 会生成结构化的审查报告，包含以下部分：

### 📊 概览
- 提交信息（hash、作者、日期）
- 文件变更统计
- 整体评估

### 🔍 详细分析
- **✅ 积极方面**: 好的实践和改进
- **⚠️ 问题和关注点**:
  - 🔴 关键问题（安全漏洞、破坏性变更）
  - 🟡 中等问题（性能、代码质量）
  - 🔵 次要问题（样式、小改进）

### 📝 文件级审查
针对每个修改的文件：
- 状态（新增/修改/删除）
- 变更描述
- 具体问题
- 改进建议

### 🎯 建议
- 优先级建议
- 具体行动项

### 📈 评分
- 整体评分 (1-10)
- 分类评分：代码质量、安全性、性能、可维护性

## 配置选项

### Agent 配置
- **模型**: 使用 OpenAI GPT-4o-mini
- **工具**: GitHub API 集成
- **内存**: LibSQL 持久化存储

### API 配置
- **GitHub API**: 使用公共 API，建议配置 token 以避免限流
- **超时设置**: 默认 2 分钟超时
- **重试机制**: 内置错误处理

## 注意事项

1. **API 限制**: GitHub API 有速率限制，建议配置个人访问令牌
2. **网络依赖**: 需要网络访问 GitHub API
3. **大型仓库**: 对于大型仓库可能需要更长的处理时间
4. **私有仓库**: 需要适当的访问权限

## 扩展建议

1. **集成 CI/CD**: 可以集成到持续集成流程中
2. **自定义规则**: 添加项目特定的代码审查规则
3. **多语言支持**: 针对不同编程语言优化审查逻辑
4. **团队配置**: 支持团队级别的审查标准
5. **报告导出**: 支持导出为 PDF 或其他格式

## 技术栈

- **框架**: Mastra Core
- **LLM**: OpenAI GPT-4o-mini
- **API**: GitHub REST API v3
- **存储**: LibSQL
- **语言**: TypeScript
- **运行时**: Node.js

## 贡献

欢迎提交 Issue 和 Pull Request 来改进这个代码审查 Agent！