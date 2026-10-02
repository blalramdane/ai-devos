import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { ProjectRegistry, TaskStore } from "./store.js";
import type { Project } from "./domain.js";
import { FileMemoryStore } from "./memory.js";
import { DockerSandboxExecutor } from "./sandbox/docker.js";
import { MissionRunner } from "./mission.js";
import { createDevOSAgent } from "./agent.js";
import { PlaywrightBrowserVerifier } from "./browser.js";

export interface ControlPlaneOptions { dataDir: string; port?: number; workspacesDir?: string; }
type Event = { type: string; taskId?: string; data: unknown };
export class EventBus {
  private clients = new Set<ServerResponse>();
  subscribe(response: ServerResponse): () => void { this.clients.add(response); return () => this.clients.delete(response); }
  publish(event: Event): void { const payload = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`; for (const client of this.clients) client.write(payload); }
}
function json(response: ServerResponse, status: number, body: unknown): void { response.writeHead(status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }); response.end(JSON.stringify(body)); }
async function body(request: IncomingMessage): Promise<any> { let raw = ""; for await (const chunk of request) raw += chunk; return raw ? JSON.parse(raw) : {}; }

export function createControlPlane(options: ControlPlaneOptions) {
  const registry = new ProjectRegistry(options.dataDir); const tasks = new TaskStore(options.dataDir); const events = new EventBus();
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    if (request.method === "OPTIONS") { response.writeHead(204, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "GET,POST,OPTIONS" }); return response.end(); }
    if (request.method === "GET" && url.pathname === "/api/events") {
      response.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive", "Access-Control-Allow-Origin": "*" });
      response.write("event: ready\ndata: {}\n\n"); const unsubscribe = events.subscribe(response); request.on("close", unsubscribe); return;
    }
    try {
      if (request.method === "GET" && url.pathname === "/api/projects") return json(response, 200, await registry.list());
      if (request.method === "POST" && url.pathname === "/api/projects") {
        const input = await body(request); const project: Project = { id: input.id, name: input.name, rootPath: input.rootPath, description: input.description };
        await registry.upsert(project); events.publish({ type: "project.created", data: project }); return json(response, 201, project);
      }
      if (request.method === "GET" && url.pathname === "/api/missions") return json(response, 200, await tasks.list());
      const missionMatch = url.pathname.match(/^\/api\/missions\/([^/]+)$/);
      if (request.method === "GET" && missionMatch) { const task = await tasks.get(missionMatch[1]); return task ? json(response, 200, task) : json(response, 404, { error: "Mission not found" }); }
      if (request.method === "POST" && url.pathname === "/api/missions") {
        const input = await body(request); const project = await registry.get(input.projectId);
        if (!project) return json(response, 404, { error: "Project not found" });
        const taskId = input.taskId ?? randomUUID(); const executor = new DockerSandboxExecutor();
        const agent = createDevOSAgent({ workspace: project.rootPath, executor });
        const runner = new MissionRunner({
          runAgent: async (prompt) => {
            events.publish({ type: "mission.agent.started", taskId, data: { prompt } });
            try { const result = await agent.runMission(prompt); events.publish({ type: "mission.agent.completed", taskId, data: { output: result.finalOutput } }); return result; }
            finally { await agent.close(); }
          },
          executor, memory: new FileMemoryStore(options.workspacesDir ?? options.dataDir), tasks, browserVerifier: new PlaywrightBrowserVerifier(),
          onEvent: (event) => events.publish({ type: `mission.${event.type}`, taskId, data: event }),
        });
        events.publish({ type: "mission.started", taskId, data: { taskId, projectId: project.id } });
        void runner.execute({ taskId, project, prompt: input.prompt, verificationCommands: input.verificationCommands, browserChecks: input.browserChecks, maxRecoveryAttempts: input.maxRecoveryAttempts })
          .then(result => events.publish({ type: "mission.completed", taskId, data: { task: result.task, report: result.report, recoveryAttempts: result.recoveryAttempts } }))
          .catch(error => events.publish({ type: "mission.failed", taskId, data: { error: error instanceof Error ? error.message : String(error) } }));
        return json(response, 202, { taskId, status: "queued" });
      }
      return json(response, 404, { error: "Not found" });
    } catch (error) { return json(response, 500, { error: error instanceof Error ? error.message : String(error) }); }
  });
  return { server, events, listen(port = options.port ?? 8787) { return new Promise<void>(resolve => server.listen(port, resolve)); } };
}
