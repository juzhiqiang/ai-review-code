import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

interface GitHubCommit {
  sha: string;
  commit: {
    message: string;
    author: {
      name: string;
      email: string;
      date: string;
    };
  };
  author: {
    login: string;
    avatar_url: string;
  };
  files?: {
    filename: string;
    additions: number;
    deletions: number;
    changes: number;
    status: string;
    patch?: string;
  }[];
}

interface GitHubCommitDetail {
  sha: string;
  commit: {
    message: string;
    author: {
      name: string;
      email: string;
      date: string;
    };
  };
  author: {
    login: string;
    avatar_url: string;
  };
  files: {
    filename: string;
    additions: number;
    deletions: number;
    changes: number;
    status: string;
    patch?: string;
  }[];
  stats: {
    additions: number;
    deletions: number;
    total: number;
  };
}

export const getCommitsTool = createTool({
  id: 'get-commits',
  description: 'Get recent commits from a GitHub repository',
  inputSchema: z.object({
    owner: z.string().describe('Repository owner (username or organization)'),
    repo: z.string().describe('Repository name'),
    per_page: z.number().optional().default(10).describe('Number of commits to fetch (max 100)'),
  }),
  outputSchema: z.object({
    commits: z.array(z.object({
      sha: z.string(),
      message: z.string(),
      author: z.string(),
      date: z.string(),
      url: z.string(),
    })),
  }),
  execute: async ({ context }) => {
    const { owner, repo, per_page = 10 } = context;
    const url = `https://api.github.com/repos/${owner}/${repo}/commits?per_page=${per_page}`;

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

      const commits = await response.json() as GitHubCommit[];

      return {
        commits: commits.map(commit => ({
          sha: commit.sha,
          message: commit.commit.message,
          author: commit.author?.login || commit.commit.author.name,
          date: commit.commit.author.date,
          url: `https://github.com/${owner}/${repo}/commit/${commit.sha}`,
        })),
      };
    } catch (error) {
      throw new Error(`Failed to fetch commits: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
});

export const getCommitDetailTool = createTool({
  id: 'get-commit-detail',
  description: 'Get detailed information about a specific commit including file changes',
  inputSchema: z.object({
    owner: z.string().describe('Repository owner (username or organization)'),
    repo: z.string().describe('Repository name'),
    sha: z.string().describe('Commit SHA hash'),
  }),
  outputSchema: z.object({
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
  }),
  execute: async ({ context }) => {
    const { owner, repo, sha } = context;
    const url = `https://api.github.com/repos/${owner}/${repo}/commits/${sha}`;

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

      const commitDetail = await response.json() as GitHubCommitDetail;

      return {
        sha: commitDetail.sha,
        message: commitDetail.commit.message,
        author: commitDetail.author?.login || commitDetail.commit.author.name,
        date: commitDetail.commit.author.date,
        url: `https://github.com/${owner}/${repo}/commit/${commitDetail.sha}`,
        stats: commitDetail.stats,
        files: commitDetail.files.map(file => ({
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

export const parseRepoUrlTool = createTool({
  id: 'parse-repo-url',
  description: 'Parse GitHub repository URL to extract owner and repo name',
  inputSchema: z.object({
    url: z.string().describe('GitHub repository URL'),
  }),
  outputSchema: z.object({
    owner: z.string(),
    repo: z.string(),
  }),
  execute: async ({ context }) => {
    const { url } = context;

    // Support different GitHub URL formats
    const patterns = [
      /github\.com\/([^\/]+)\/([^\/\?#]+)/,
      /github\.com\/([^\/]+)\/([^\/\?#]+)\.git/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        const owner = match[1];
        let repo = match[2];

        // Remove .git suffix if present
        if (repo.endsWith('.git')) {
          repo = repo.slice(0, -4);
        }

        return { owner, repo };
      }
    }

    throw new Error(`Invalid GitHub URL format: ${url}`);
  },
});