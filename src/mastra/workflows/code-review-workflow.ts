import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

const repoInfoSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  url: z.string(),
});

const commitsSchema = z.object({
  commits: z.array(z.object({
    sha: z.string(),
    message: z.string(),
    author: z.string(),
    date: z.string(),
    url: z.string(),
  })),
});

const commitDetailSchema = z.object({
  sha: z.string(),
  message: z.string(),
  author: z.string(),
  date: z.string(),
  url: z.string(),
  stats: z.object({
    additions: z.number(),
    deletions: z.number(),
    total: z.number(),
  }),
  files: z.array(z.object({
    filename: z.string(),
    additions: z.number(),
    deletions: z.number(),
    changes: z.number(),
    status: z.string(),
    patch: z.string().optional(),
  })),
});

const parseRepoUrl = createStep({
  id: 'parse-repo-url',
  description: 'Parse GitHub repository URL to extract owner and repo information',
  inputSchema: z.object({
    repoUrl: z.string().describe('GitHub repository URL'),
  }),
  outputSchema: repoInfoSchema,
  execute: async ({ inputData, mastra }) => {
    if (!inputData) {
      throw new Error('Repository URL not provided');
    }

    const agent = mastra?.getAgent('codeReviewAgent');
    if (!agent) {
      throw new Error('Code Review agent not found');
    }

    // 使用工具直接执行，而不是通过agent.invoke
    const { parseRepoUrlTool } = agent.tools;
    const result = await parseRepoUrlTool.execute!({
      context: { url: inputData.repoUrl },
      mastra,
      runtimeContext: {},
    }, {});

    return {
      owner: result.owner,
      repo: result.repo,
      url: inputData.repoUrl,
    };
  },
});

const fetchRecentCommits = createStep({
  id: 'fetch-recent-commits',
  description: 'Fetch recent commits from the repository',
  inputSchema: repoInfoSchema,
  outputSchema: commitsSchema,
  execute: async ({ inputData, mastra }) => {
    if (!inputData) {
      throw new Error('Repository information not found');
    }

    const agent = mastra?.getAgent('codeReviewAgent');
    if (!agent) {
      throw new Error('Code Review agent not found');
    }

    const { getCommitsTool } = agent.tools;
    const result = await getCommitsTool.execute!({
      context: {
        owner: inputData.owner,
        repo: inputData.repo,
        per_page: 5, // Get last 5 commits
      },
      mastra,
      runtimeContext: {},
    }, {});

    return result;
  },
});

const analyzeLatestCommit = createStep({
  id: 'analyze-latest-commit',
  description: 'Get detailed information about the latest commit',
  inputSchema: commitsSchema,
  outputSchema: commitDetailSchema,
  execute: async ({ inputData, mastra }) => {
    if (!inputData?.commits || inputData.commits.length === 0) {
      throw new Error('No commits found');
    }

    const agent = mastra?.getAgent('codeReviewAgent');
    if (!agent) {
      throw new Error('Code Review agent not found');
    }

    // Get the latest commit (first in the list)
    const latestCommit = inputData.commits[0];

    // Extract owner and repo from the commit URL
    const urlParts = latestCommit.url.split('/');
    const owner = urlParts[3];
    const repo = urlParts[4];

    const { getCommitDetailTool } = agent.tools;
    const result = await getCommitDetailTool.execute!({
      context: {
        owner,
        repo,
        sha: latestCommit.sha,
      },
      mastra,
      runtimeContext: {},
    }, {});

    return result;
  },
});

const generateCodeReview = createStep({
  id: 'generate-code-review',
  description: 'Generate comprehensive code review based on commit details',
  inputSchema: commitDetailSchema,
  outputSchema: z.object({
    review: z.string(),
  }),
  execute: async ({ inputData, mastra }) => {
    if (!inputData) {
      throw new Error('Commit detail not found');
    }

    const agent = mastra?.getAgent('codeReviewAgent');
    if (!agent) {
      throw new Error('Code Review agent not found');
    }

    const prompt = `Please provide a comprehensive code review for the following commit:

**Commit Information:**
- SHA: ${inputData.sha}
- Message: ${inputData.message}
- Author: ${inputData.author}
- Date: ${inputData.date}
- URL: ${inputData.url}

**Statistics:**
- Files changed: ${inputData.files.length}
- Lines added: ${inputData.stats.additions}
- Lines deleted: ${inputData.stats.deletions}
- Total changes: ${inputData.stats.total}

**File Changes:**
${inputData.files.map(file => `
### ${file.filename}
- Status: ${file.status}
- Changes: +${file.additions} -${file.deletions} (${file.changes} total)
${file.patch ? `
**Code Changes:**
\`\`\`diff
${file.patch}
\`\`\`
` : ''}
`).join('\n')}

Please analyze this commit according to your code review guidelines and provide a detailed review report with:
1. Overview and summary
2. Detailed analysis of positive points and issues
3. Specific file-by-file review
4. Recommendations for improvement
5. Overall rating and action items

Focus on security, performance, code quality, best practices, architecture, and maintainability.`;

    const response = await agent.stream([
      {
        role: 'user',
        content: prompt,
      },
    ]);

    let reviewText = '';

    for await (const chunk of response.textStream) {
      process.stdout.write(chunk);
      reviewText += chunk;
    }

    return {
      review: reviewText,
    };
  },
});

const codeReviewWorkflow = createWorkflow({
  id: 'code-review-workflow',
  inputSchema: z.object({
    repoUrl: z.string().describe('GitHub repository URL to review'),
  }),
  outputSchema: z.object({
    review: z.string(),
  }),
})
  .then(parseRepoUrl)
  .then(fetchRecentCommits)
  .then(analyzeLatestCommit)
  .then(generateCodeReview);

codeReviewWorkflow.commit();

export { codeReviewWorkflow };