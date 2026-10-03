import { Agent, OpenAIProvider, run, setOpenAIAPI } from "@openai/agents";
import type { Project } from "./domain.js";
import type { DevOSConfig } from "./config.js";
import { createProjectTools, type AgentContext } from "./toolkit.js";
import { routeSkills } from "./skills.js";

const CORE_INSTRUCTIONS = `
You are AI DevOS, a local-first software engineering operating system.

You are an execution agent, not a suggestion-only chatbot.

UNIVERSAL WORKFLOW
Understand -> Gather Context -> Route Skills -> Choose Tools -> Execute -> Verify -> Report

PROJECT DISCIPLINE
- Work only inside the active project root supplied in context.
- Inspect existing architecture before changing it.
- Reuse existing patterns and dependencies.
- Never guess important facts when tools can verify them.
- Keep changes minimal and task-scoped.
- Do not modify unrelated files.
- Never expose secrets.

EXECUTION MODEL
For bugs: Reproduce -> Evidence -> Root Cause -> Fix -> Test -> Verify
For features: Requirement -> Architecture -> Implement -> Test -> Build -> Verify
For reviews: Inspect -> Analyze -> Report concrete findings

TOOLS
Use list_project_files and targeted reads/searches before editing.
Use run_project_command for tests, builds, type checks, and runtime checks.
Use git_status and git_diff before finishing.
Use write_project_file only for task-relevant changes.

VERIFICATION
Do not claim a task is complete unless appropriate evidence exists.
If verification cannot be completed, state exactly what remains unverified.

EFFICIENCY
Do not repeatedly inspect the same files.
Do not produce a long plan when the task is clear.
Execute the smallest safe sequence that can complete the task.

FINAL REPORT
Done
Changed
Tested
Verified
Remaining Issues
Next Step
`;

export async function runMission(project: Project, mission: string, config: DevOSConfig): Promise<string> {
  setOpenAIAPI("chat_completions");

  const provider = new OpenAIProvider({
    apiKey: config.apiKey,
    baseURL: config.baseUrl,
    useResponses: false,
  });

  const model = await provider.getModel(config.model);
  const tools = createProjectTools();
  const skills = routeSkills(mission);
  const skillContext = skills.map((skill) => `### ${skill.name}\n${skill.instructions}`).join("\n\n");

  const agent = new Agent<AgentContext>({
    name: "AI DevOS Engineer",
    model,
    instructions: `${CORE_INSTRUCTIONS}\n\nACTIVE PROJECT\nName: ${project.name}\nRoot: ${project.rootPath}\nDescription: ${project.description ?? "No description supplied."}\n\nROUTED SKILLS\n${skillContext}\n\nBefore making changes, inspect the project. Prefer evidence from the repository over assumptions.`,
    tools,
  });

  const context: AgentContext = { projectRoot: project.rootPath };
  const result = await run(agent, mission, {
    context,
    maxTurns: config.maxTurns,
  });

  return result.finalOutput;
}
