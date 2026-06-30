#!/usr/bin/env node
/**
 * Format Playwright JSON report as a PR comment body.
 * Usage: node format-pr-comment.mjs <results.json> <run-url>
 */
import { readFileSync } from "node:fs";

const MARKER = "<!-- e2e-failure -->";

function collectFailures(suite, failures = []) {
  for (const spec of suite.specs ?? []) {
    for (const test of spec.tests ?? []) {
      for (const result of test.results ?? []) {
        if (result.status === "failed" || result.status === "timedOut") {
          failures.push({
            title: `${suite.title} › ${spec.title}`,
            error: result.error?.message?.split("\n")[0] ?? result.status,
          });
        }
      }
    }
  }
  for (const child of suite.suites ?? []) {
    collectFailures(child, failures);
  }
  return failures;
}

const resultsPath = process.argv[2];
const runUrl = process.argv[3] ?? "";

if (!resultsPath) {
  console.error("Usage: node format-pr-comment.mjs <results.json> [run-url]");
  process.exit(1);
}

let report;
try {
  report = JSON.parse(readFileSync(resultsPath, "utf8"));
} catch {
  report = { suites: [] };
}

const failures = collectFailures(report);
const failureLines =
  failures.length > 0
    ? failures.map((f) => `- **${f.title}**: ${f.error}`).join("\n")
    : "- (詳細は workflow ログを参照)";

const body = `${MARKER}
## E2E テスト失敗

以下の Playwright テストが失敗しました。

${failureLines}

${runUrl ? `**Workflow run:** ${runUrl}\n` : ""}
**Artifacts:** Actions タブの \`playwright-report\` から HTML レポートとスクリーンショットを確認できます。

**ローカル再現:**
\`\`\`bash
pnpm install --frozen-lockfile
pnpm exec playwright install --with-deps chromium
pnpm test:e2e
\`\`\`
`;

process.stdout.write(body);
