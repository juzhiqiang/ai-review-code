// 测试脚本：验证代码差异输入功能
const { mastra } = require('./src/mastra/index.js');

async function testDiffInput() {
  console.log('测试代码差异输入功能...');

  const sampleDiff = `diff --git a/src/example.js b/src/example.js
index 1234567..abcdefg 100644
--- a/src/example.js
+++ b/src/example.js
@@ -1,5 +1,8 @@
 function calculateSum(a, b) {
-  return a + b;
+  // 添加输入验证
+  if (typeof a !== 'number' || typeof b !== 'number') {
+    throw new Error('参数必须是数字');
+  }
+  return a + b;
 }

 module.exports = { calculateSum };`;

  try {
    const result = await mastra.workflow('codeReviewWorkflow').execute({
      diffContent: sampleDiff,
      commitMessage: '添加输入验证功能',
      author: 'test-user',
      commitSha: 'abc123'
    });

    console.log('✅ 代码差异输入测试成功！');
    console.log('审查结果片段:', result.review.substring(0, 200) + '...');
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}

async function testGitHubInput() {
  console.log('测试 GitHub URL 输入功能...');

  try {
    const result = await mastra.workflow('codeReviewWorkflow').execute({
      repoUrl: 'https://github.com/torvalds/linux'
    });

    console.log('✅ GitHub URL 输入测试成功！');
    console.log('审查结果片段:', result.review.substring(0, 200) + '...');
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}

// 运行测试
async function runTests() {
  await testDiffInput();
  console.log('\n---\n');
  await testGitHubInput();
}

runTests().catch(console.error);