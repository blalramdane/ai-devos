import type { Evidence, Project } from "./domain.js";
import { EvidenceStore } from "./evidence-store.js";

export interface BrowserVerificationOptions {
  selector?: string;
  contains?: string;
  timeoutMs?: number;
  headless?: boolean;
  allowExternal?: boolean;
  screenshotPath?: string;
}

function assertAllowedUrl(rawUrl: string, allowExternal: boolean) {
  const url = new URL(rawUrl);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Browser verification only supports http:// and https:// URLs.");
  }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1";
  if (!local && !allowExternal) {
    throw new Error("External browser verification is blocked by default. Use explicit allowExternal approval.");
  }
  return url;
}

export class BrowserVerifier {
  constructor(private readonly evidence: EvidenceStore) {}

  async verify(project: Project, workflowId: string, rawUrl: string, options: BrowserVerificationOptions = {}): Promise<Evidence> {
    const url = assertAllowedUrl(rawUrl, options.allowExternal ?? false);

    try {
      const { chromium } = await import("playwright");
      const browser = await chromium.launch({ headless: options.headless ?? true });
      try {
        const page = await browser.newPage();
        const response = await page.goto(url.toString(), {
          waitUntil: "domcontentloaded",
          timeout: options.timeoutMs ?? 15_000,
        });

        const bodyText = await page.locator("body").innerText().catch(() => "");
        const selectorPassed = options.selector === undefined || await page.locator(options.selector).count() > 0;
        const containsPassed = options.contains === undefined || bodyText.includes(options.contains);
        const status = response?.status() ?? 0;
        const passed = status >= 200 && status < 400 && selectorPassed && containsPassed;

        if (options.screenshotPath) {
          await page.screenshot({ path: options.screenshotPath, fullPage: true });
        }

        const item: Evidence = {
          id: "evidence-" + Date.now().toString(36) + "-browser",
          kind: "browser",
          title: "Browser verification: " + url.toString(),
          passed,
          summary: [
            `status=${status}`,
            `selector=${options.selector === undefined ? "not-checked" : selectorPassed}`,
            `contains=${options.contains === undefined ? "not-checked" : containsPassed}`,
            bodyText.slice(0, 3000),
          ].join("\n"),
          metadata: {
            url: url.toString(),
            status,
            selector: options.selector,
            contains: options.contains,
            screenshotPath: options.screenshotPath,
          },
        };
        await this.evidence.add(project.id, workflowId, item);
        return item;
      } finally {
        await browser.close();
      }
    } catch (error) {
      const item: Evidence = {
        id: "evidence-" + Date.now().toString(36) + "-browser",
        kind: "browser",
        title: "Browser verification: " + url.toString(),
        passed: false,
        summary: error instanceof Error ? error.message : String(error),
        metadata: { url: url.toString() },
      };
      await this.evidence.add(project.id, workflowId, item);
      return item;
    }
  }
}
