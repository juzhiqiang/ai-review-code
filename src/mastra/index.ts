
import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { weatherWorkflow } from './workflows/weather-workflow';
import { weatherAgent } from './agents/weather-agent';
import { codeReviewAgent } from './agents/code-review-agent';
import { codeReviewWorkflow } from './workflows/code-review-workflow';
import { CloudflareDeployer } from "@mastra/deployer-cloudflare";

export const mastra = new Mastra({
  workflows: { weatherWorkflow, codeReviewWorkflow },
  agents: { weatherAgent, codeReviewAgent },
  // storage: new LibSQLStore({
  //   // stores telemetry, evals, ... into memory storage, if it needs to persist, change to file:../mastra.db
  //   url: ":memory:",
  // }),
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
  deployer: new CloudflareDeployer({
    projectName: "review-code",
    env: {
      CLOUDFLARE_ACCOUNT_ID: "6af174ce99a1e60d7c84c893850d7adb",
      CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN || "",
      CLOUDFLARE_API_EMAIL: "Jzq1020814597@gmail.com",
    },
  }),
});
