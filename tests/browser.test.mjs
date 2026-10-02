import test from "node:test";
import assert from "node:assert/strict";
import { PlaywrightBrowserVerifier } from "../dist/browser.js";

class FakePage {
  constructor(pageTitle, pageUrl, visibleText) {
    this.pageTitle = pageTitle;
    this.pageUrl = pageUrl;
    this.visibleText = visibleText;
  }
  async goto() {}
  async title() { return this.pageTitle; }
  url() { return this.pageUrl; }
  async containsText(text) { return this.visibleText.includes(text); }
  async screenshot() {}
  async close() {}
}

test("browser verifier produces passing evidence", async () => {
  const verifier = new PlaywrightBrowserVerifier(async () =>
    new FakePage("Nexora Dashboard", "http://localhost:3000/dashboard", "Welcome admin"),
  );
  const result = await verifier.verify({
    id: "browser-1", url: "http://localhost:3000/dashboard",
    title: "Dashboard", containsText: "Welcome",
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
    id: "browser-2", url: "http://localhost:3000/login",
    title: "Dashboard", containsText: "Welcome",
  });
  assert.equal(result.evidence.kind, "browser");
  assert.equal(result.evidence.passed, false);
  assert.match(result.evidence.summary, /failed/i);
});
