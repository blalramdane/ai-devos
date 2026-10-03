import type { Evidence, Project } from "./domain.js";
import { EvidenceStore } from "./evidence-store.js";

export interface HttpVerificationOptions {
  expectedStatus?: number;
  contains?: string;
  timeoutMs?: number;
  allowExternal?: boolean;
}

function assertAllowedUrl(rawUrl: string, allowExternal: boolean) {
  const url = new URL(rawUrl);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("HTTP verification only supports http:// and https:// URLs.");
  }

  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1";
  if (!local && !allowExternal) {
    throw new Error("External URL verification is blocked by default. Use explicit allowExternal approval.");
  }
  return url;
}

export class HttpVerifier {
  constructor(private readonly evidence: EvidenceStore) {}

  async verify(project: Project, workflowId: string, rawUrl: string, options: HttpVerificationOptions = {}): Promise<Evidence> {
    const url = assertAllowedUrl(rawUrl, options.allowExternal ?? false);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 10_000);

    try {
      const response = await fetch(url, { signal: controller.signal, redirect: "manual" });
      const body = await response.text();
      const expectedStatus = options.expectedStatus ?? 200;
      const statusPassed = response.status === expectedStatus;
      const containsPassed = options.contains === undefined || body.includes(options.contains);
      const passed = statusPassed && containsPassed;

      const item: Evidence = {
        id: "evidence-" + Date.now().toString(36) + "-http",
        kind: "http",
        title: "HTTP verification: " + url.toString(),
        passed,
        summary: [
          `status=${response.status} expected=${expectedStatus}`,
          `bodyContains=${options.contains === undefined ? "not-checked" : containsPassed}`,
          body.slice(0, 3000),
        ].join("\n"),
        metadata: {
          url: url.toString(),
          status: response.status,
          headers: Object.fromEntries(response.headers.entries()),
          expectedStatus,
          contains: options.contains,
        },
      };
      await this.evidence.add(project.id, workflowId, item);
      return item;
    } catch (error) {
      const item: Evidence = {
        id: "evidence-" + Date.now().toString(36) + "-http",
        kind: "http",
        title: "HTTP verification: " + url.toString(),
        passed: false,
        summary: error instanceof Error ? error.message : String(error),
        metadata: { url: url.toString() },
      };
      await this.evidence.add(project.id, workflowId, item);
      return item;
    } finally {
      clearTimeout(timeout);
    }
  }
}
