import test from "node:test";
import assert from "node:assert/strict";
import { PlaywrightBrowserVerifier, type BrowserPageAdapter } from "../src/browser.js";

class FakePage implements BrowserPageAdapter {
  constructor(
    private readonly pageTitle: string,
    private readonly pageUrl: string,
    private readonly visibleText: string,
  ) {}

  async goto(): Promise<void> {}
  async title(): Promise<string> { return this.pageTitle; }
  url(): string { return this.pageUrl; }
  async containsText(text: string): Promise<boolean> {
    return this.visibleText.includes(text);
  }
  async screenshot(): Promise<void> {}
  async close(): Promise<void> {}
}

test("browser verifier produces passing evidence", async () => {
  const verifier = new PlaywrightBrowserVerifier(async () =>
    new FakePage("Nexora Dashboard", "http://localhost:3000/dashboard", "Welcome admin"),
  );

  const result = await verifier.verify({
    id: "browser-1",
    url: "http://localhost:3000/dashboard",
    title: "Dashboard",
    containsText: "Welcome",
    expectedUrl: "http://localhost:3000/dashboard",
  });

  assert.equal(result.evidence.kind, "browser");
  assert.equal(result.evidence.passed, true);
});

test("browser verifier produces failed evidence when an assertion fails", async () => {
  const verifier = new PlaywrightBrowserVerifier(async () =>
    new FakePage("Login", "http://localhost:3000/login", "Sign in"),
  );

  const result = await verifier.verify({
    id: "browser-2",
    url: "http://localhost:3000/login",
    title: "Dashboard",
    containsText: "Welcome",
  });

  assert.equal(result.evidence.kind, "browser");
  assert.equal(result.evidence.passed, false);
  assert.match(result.evidence.summary, /failed/i);
});
