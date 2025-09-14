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

    // 解析GitHub URL
    const patterns = [
      /github\.com\/([^\/]+)\/([^\/\?#]+)/,
      /github\.com\/([^\/]+)\/([^\/\?#]+)\.git/,
    ];

    let owner = '';
    let repo = '';

    for (const pattern of patterns) {
      const match = inputData.repoUrl.match(pattern);
      if (match) {
        owner = match[1];
        repo = match[2];

        // Remove .git suffix if present
        if (repo.endsWith('.git')) {
          repo = repo.slice(0, -4);
        }
        break;
      }
    }

    if (!owner || !repo) {
      throw new Error(`Invalid GitHub URL format: ${inputData.repoUrl}`);
    }

    return {
      owner,
      repo,
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

    // 获取提交信息
    const url = `https://api.github.com/repos/${inputData.owner}/${inputData.repo}/commits?per_page=5`;

    try {
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Code-Review-Agent/1.0',
        },
      });

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }

      const commits = await response.json() as any[];

      return {
        commits: commits.map(commit => ({
          sha: commit.sha,
          message: commit.commit.message,
          author: commit.author?.login || commit.commit.author.name,
          date: commit.commit.author.date,
          url: `https://github.com/${inputData.owner}/${inputData.repo}/commit/${commit.sha}`,
        })),
      };
    } catch (error) {
      throw new Error(`Failed to fetch commits: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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

    // Get the latest commit (first in the list)
    const latestCommit = inputData.commits[0];

    // Extract owner and repo from the commit URL
    const urlParts = latestCommit.url.split('/');
    const owner = urlParts[3];
    const repo = urlParts[4];

    // 获取提交详情
    const url = `https://api.github.com/repos/${owner}/${repo}/commits/${latestCommit.sha}`;

    try {
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Code-Review-Agent/1.0',
        },
      });

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }

      const commitDetail = await response.json() as any;

      return {
        sha: commitDetail.sha,
        message: commitDetail.commit.message,
        author: commitDetail.author?.login || commitDetail.commit.author.name,
        date: commitDetail.commit.author.date,
        url: `https://github.com/${owner}/${repo}/commit/${commitDetail.sha}`,
        stats: commitDetail.stats,
        files: commitDetail.files.map((file: any) => ({
          filename: file.filename,
          additions: file.additions,
          deletions: file.deletions,
          changes: file.changes,
          status: file.status,
          patch: file.patch,
        })),
      };
    } catch (error) {
      throw new Error(`Failed to fetch commit detail: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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