import { chromium, type Browser, type Page } from "playwright";
import type { Evidence } from "./domain.js";

export interface BrowserCheck {
  id: string;
  url: string;
  title?: string;
  containsText?: string;
  expectedUrl?: string;
  timeoutMs?: number;
  screenshotPath?: string;
}

export interface BrowserVerificationResult {
  evidence: Evidence;
  screenshotPath?: string;
}

export interface BrowserVerifier {
  verify(check: BrowserCheck): Promise<BrowserVerificationResult>;
}

export interface BrowserPageAdapter {
  goto(url: string, timeoutMs: number): Promise<void>;
  title(): Promise<string>;
  url(): string;
  containsText(text: string, timeoutMs: number): Promise<boolean>;
  screenshot(path: string): Promise<void>;
  close(): Promise<void>;
}

export class PlaywrightPageAdapter implements BrowserPageAdapter {
  constructor(private readonly page: Page, private readonly browser: Browser) {}

  async goto(url: string, timeoutMs: number): Promise<void> {
    await this.page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
  }

  async title(): Promise<string> {
    return this.page.title();
  }

  url(): string {
    return this.page.url();
  }

  async containsText(text: string, timeoutMs: number): Promise<boolean> {
    try {
      await this.page.getByText(text, { exact: false }).first().waitFor({
        state: "visible",
        timeout: timeoutMs,
      });
      return true;
    } catch {
      return false;
    }
  }

  async screenshot(path: string): Promise<void> {
    await this.page.screenshot({ path, fullPage: true });
  }

  async close(): Promise<void> {
    await this.browser.close();
  }
}

export class PlaywrightBrowserVerifier implements BrowserVerifier {
  constructor(
    private readonly createPage: () => Promise<BrowserPageAdapter> = async () => {
      const browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();
      return new PlaywrightPageAdapter(page, browser);
    },
  ) {}

  async verify(check: BrowserCheck): Promise<BrowserVerificationResult> {
    const startedAt = Date.now();
    const timeoutMs = check.timeoutMs ?? 10_000;
    const page = await this.createPage();

    try {
      await page.goto(check.url, timeoutMs);

      const actualTitle = await page.title();
      const actualUrl = page.url();

      const titlePassed = check.title === undefined || actualTitle.includes(check.title);
      const textPassed =
        check.containsText === undefined ||
        (await page.containsText(check.containsText, timeoutMs));
      const urlPassed = check.expectedUrl === undefined || actualUrl === check.expectedUrl;
      const passed = titlePassed && textPassed && urlPassed;

      let screenshotPath: string | undefined;
      if (check.screenshotPath) {
        await page.screenshot(check.screenshotPath);
        screenshotPath = check.screenshotPath;
      }

      const failures = [
        !titlePassed && `title did not contain "${check.title}"`,
        !textPassed && `page did not contain "${check.containsText}"`,
        !urlPassed && `URL was "${actualUrl}" instead of "${check.expectedUrl}"`,
      ].filter(Boolean);

      return {
        screenshotPath,
        evidence: {
          id: check.id,
          kind: "browser",
          title: `Browser: ${check.url}`,
          passed,
          summary: passed
            ? `Browser check passed in ${Date.now() - startedAt}ms (title="${actualTitle}", url="${actualUrl}").`
            : `Browser check failed: ${failures.join("; ")}`,
          metadata: {
            url: check.url,
            actualUrl,
            actualTitle,
            durationMs: Date.now() - startedAt,
            screenshotPath,
          },
        },
      };
    } catch (error) {
      return {
        evidence: {
          id: check.id,
          kind: "browser",
          title: `Browser: ${check.url}`,
          passed: false,
          summary: `Browser verification could not complete: ${error instanceof Error ? error.message : String(error)}`,
          metadata: {
            url: check.url,
            durationMs: Date.now() - startedAt,
          },
        },
      };
    } finally {
      await page.close();
    }
  }
}
