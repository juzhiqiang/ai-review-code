import { Mastra } from '@mastra/core';
import { codeReviewAgent } from '../agents/code-review-agent';
import { codeReviewWorkflow } from '../workflows/code-review-workflow';

// 创建 Mastra 实例并注册 agent 和 workflow
const mastra = new Mastra({
  agents: {
    codeReviewAgent,
  },
  workflows: {
    codeReviewWorkflow,
  },
});

// 使用示例 1: 直接使用 agent 进行代码审查
async function directAgentExample() {
  console.log('=== 直接使用 Code Review Agent ===\n');

  try {
    // 通过对话请求agent分析仓库
    const response = await codeReviewAgent.stream([
      {
        role: 'user',
        content: '请分析这个GitHub仓库的基本信息: https://github.com/microsoft/TypeScript。先解析仓库URL，然后获取最近3个提交的信息。',
      },
    ]);

    console.log('Agent 回复:');
    for await (const chunk of response.textStream) {
      process.stdout.write(chunk);
    }
    console.log('\n');

  } catch (error) {
    console.error('错误:', error);
  }
}

// 使用示例 2: 使用 workflow 进行完整的代码审查流程
async function workflowExample() {
  console.log('\n=== 使用 Code Review Workflow ===\n');

  try {
    const workflow = mastra.getWorkflow('codeReviewWorkflow');
    const result = await workflow.execute({
      repoUrl: 'https://github.com/vercel/next.js',
    });

    console.log('代码审查完成!');
    console.log('审查报告已生成并显示在上方');
    console.log('结果:', result);

  } catch (error) {
    console.error('Workflow 执行错误:', error);
  }
}

// 使用示例 3: 与 agent 进行交互式对话
async function interactiveExample() {
  console.log('\n=== 与 Code Review Agent 交互 ===\n');

  try {
    const response = await codeReviewAgent.stream([
      {
        role: 'user',
        content: '请帮我分析这个GitHub仓库的最新提交: https://github.com/facebook/react',
      },
    ]);

    console.log('Agent 回复:');
    for await (const chunk of response.textStream) {
      process.stdout.write(chunk);
    }
    console.log('\n');

  } catch (error) {
    console.error('交互错误:', error);
  }
}

// 运行示例
async function runExamples() {
  console.log('🚀 Code Review Agent 使用示例\n');

  // 注意: 这些示例需要网络访问GitHub API
  // 在生产环境中，建议设置GitHub API token以避免速率限制

  try {
    await directAgentExample();
    await workflowExample();
    await interactiveExample();
  } catch (error) {
    console.error('示例运行错误:', error);
  }
}

// 如果直接运行这个文件，则执行示例
if (require.main === module) {
  runExamples();
}

export {
  directAgentExample,
  workflowExample,
  interactiveExample,
  runExamples,
  mastra,
};