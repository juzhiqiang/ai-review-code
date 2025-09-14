import { codeReviewAgent } from './agents/code-review-agent';

async function testCodeReviewAgent() {
  console.log('🚀 测试 Code Review Agent\n');

  try {
    // 测试agent对话功能
    console.log('=== 测试Agent对话功能 ===');
    const response = await codeReviewAgent.stream([
      {
        role: 'user',
        content: '请帮我分析这个GitHub仓库的最新提交: https://github.com/microsoft/vscode',
      },
    ]);

    console.log('Agent 回复:');
    for await (const chunk of response.textStream) {
      process.stdout.write(chunk);
    }
    console.log('\n\n');

  } catch (error) {
    console.error('测试失败:', error);
  }
}

// 如果直接运行这个文件，则执行测试
if (require.main === module) {
  testCodeReviewAgent();
}

export { testCodeReviewAgent };