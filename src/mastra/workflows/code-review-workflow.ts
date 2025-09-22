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
  inputSchema: z.union([
    z.object({
      repoUrl: z.string().describe('GitHub repository URL'),
    }),
    z.object({
      diffContent: z.string().describe('Code diff content to review'),
      commitMessage: z.string().optional().describe('Commit message'),
      author: z.string().optional().describe('Author name'),
      commitSha: z.string().optional().describe('Commit SHA'),
    }),
  ]),
  outputSchema: z.union([
    repoInfoSchema,
    z.object({
      type: z.literal('diff'),
      diffContent: z.string(),
      commitMessage: z.string().optional(),
      author: z.string().optional(),
      commitSha: z.string().optional(),
    }),
  ]),
  execute: async ({ inputData, mastra }) => {
    if (!inputData) {
      throw new Error('Input data not provided');
    }

    // 检查输入类型 - 是 GitHub URL 还是代码差异
    if ('repoUrl' in inputData) {
      // 处理 GitHub URL
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
    } else {
      // 处理代码差异
      return {
        type: 'diff' as const,
        diffContent: inputData.diffContent,
        commitMessage: inputData.commitMessage,
        author: inputData.author,
        commitSha: inputData.commitSha,
      };
    }
  },
});

const routeStep = createStep({
  id: 'route-step',
  description: 'Route to appropriate processing path',
  inputSchema: z.union([
    repoInfoSchema,
    z.object({
      type: z.literal('diff'),
      diffContent: z.string(),
      commitMessage: z.string().optional(),
      author: z.string().optional(),
      commitSha: z.string().optional(),
    }),
  ]),
  outputSchema: commitDetailSchema,
  execute: async ({ inputData, mastra }) => {
    if (!inputData) {
      throw new Error('Input data not provided');
    }

    if ('type' in inputData && inputData.type === 'diff') {
      // 处理代码差异的逻辑
      const files = [];
      const diffLines = inputData.diffContent.split('\n');

      let currentFile = null;
      let additions = 0;
      let deletions = 0;
      let patch = '';

      for (const line of diffLines) {
        if (line.startsWith('diff --git')) {
          if (currentFile) {
            files.push({
              filename: currentFile,
              additions,
              deletions,
              changes: additions + deletions,
              status: 'modified',
              patch,
            });
          }

          const match = line.match(/diff --git a\/(.+) b\/(.+)/);
          currentFile = match ? match[2] : '';
          additions = 0;
          deletions = 0;
          patch = '';
        }

        if (line.startsWith('+') && !line.startsWith('+++')) {
          additions++;
        } else if (line.startsWith('-') && !line.startsWith('---')) {
          deletions++;
        }

        patch += line + '\n';
      }

      if (currentFile) {
        files.push({
          filename: currentFile,
          additions,
          deletions,
          changes: additions + deletions,
          status: 'modified',
          patch,
        });
      }

      const totalAdditions = files.reduce((sum, file) => sum + file.additions, 0);
      const totalDeletions = files.reduce((sum, file) => sum + file.deletions, 0);

      return {
        sha: inputData.commitSha || 'direct-diff',
        message: inputData.commitMessage || 'Direct diff review',
        author: inputData.author || 'Unknown',
        date: new Date().toISOString(),
        url: '',
        stats: {
          additions: totalAdditions,
          deletions: totalDeletions,
          total: totalAdditions + totalDeletions,
        },
        files,
      };
    } else {
      // 处理 GitHub URL 的逻辑
      const commitsUrl = `https://api.github.com/repos/${inputData.owner}/${inputData.repo}/commits?per_page=5`;

      try {
        const response = await fetch(commitsUrl, {
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Code-Review-Agent/1.0',
          },
        });

        if (!response.ok) {
          throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
        }

        const commits = await response.json() as any[];
        const latestCommit = commits[0];

        const detailUrl = `https://api.github.com/repos/${inputData.owner}/${inputData.repo}/commits/${latestCommit.sha}`;

        const detailResponse = await fetch(detailUrl, {
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Code-Review-Agent/1.0',
          },
        });

        if (!detailResponse.ok) {
          throw new Error(`GitHub API error: ${detailResponse.status} ${detailResponse.statusText}`);
        }

        const commitDetail = await detailResponse.json() as any;

        return {
          sha: commitDetail.sha,
          message: commitDetail.commit.message,
          author: commitDetail.author?.login || commitDetail.commit.author.name,
          date: commitDetail.commit.author.date,
          url: `https://github.com/${inputData.owner}/${inputData.repo}/commit/${commitDetail.sha}`,
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
        throw new Error(`Failed to fetch commit details: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
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
  inputSchema: z.union([
    z.object({
      repoUrl: z.string().describe('GitHub repository URL to review'),
    }),
    z.object({
      diffContent: z.string().describe('Code diff content to review'),
      commitMessage: z.string().optional().describe('Commit message'),
      author: z.string().optional().describe('Author name'),
      commitSha: z.string().optional().describe('Commit SHA'),
    }),
  ]),
  outputSchema: z.object({
    review: z.string(),
  }),
})
  .then(parseRepoUrl)
  .then(routeStep)
  .then(generateCodeReview);

codeReviewWorkflow.commit();

export { codeReviewWorkflow };