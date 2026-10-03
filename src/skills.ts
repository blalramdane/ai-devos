export interface SkillDefinition {
  name: string;
  triggers: string[];
  instructions: string;
}

export const SKILLS: SkillDefinition[] = [
  {
    name: "engineering",
    triggers: ["code","bug","fix","api","architecture","test","build","debug","refactor","deploy","repository","frontend","backend"],
    instructions: "Use for code, repositories, APIs, architecture, debugging, tests, builds, deployment, and technical reviews. Bug workflow: Reproduce -> Evidence -> Root Cause -> Fix -> Test -> Verify. Feature workflow: Requirement -> Architecture -> Implementation -> Test -> Build -> Verify. Inspect existing implementation first; preserve contracts and prefer minimal reliable changes.",
  },
  {
    name: "product",
    triggers: ["feature","mvp","roadmap","requirement","prd","spec","scope","user story"],
    instructions: "Use for product requirements, MVP scope, specifications, roadmaps, and prioritization. Clarify the outcome, constraints, acceptance criteria, and implementation implications.",
  },
  {
    name: "research",
    triggers: ["research","latest","current","compare","verify","documentation","investigate"],
    instructions: "Use for research and verification. Prefer primary/official sources, cross-check important claims, separate facts from interpretation, and produce actionable evidence.",
  },
  {
    name: "design",
    triggers: ["ui","ux","design","brand","creative","accessibility","layout","interface"],
    instructions: "Use for UI/UX, visual systems, accessibility, and creative implementation. Inspect existing design language and preserve consistency.",
  },
  {
    name: "data",
    triggers: ["csv","dataset","metrics","analytics","dashboard","sql","analysis","query"],
    instructions: "Use for data analysis, metrics, dashboards, SQL, and structured datasets. Validate inputs, definitions, and calculations before conclusions.",
  },
  {
    name: "operations",
    triggers: ["sop","process","staffing","vendor","workflow","runbook","capacity","operations"],
    instructions: "Use for operational processes, SOPs, staffing, vendors, runbooks, and capacity planning. Make responsibilities, inputs, outputs, and verification explicit.",
  },
  {
    name: "marketing",
    triggers: ["campaign","ads","content","growth","marketing","seo","social"],
    instructions: "Use for marketing strategy, campaigns, content, growth, and measurement. Ground recommendations in the stated audience, offer, channel, and evidence.",
  },
  {
    name: "sales",
    triggers: ["lead","crm","outreach","pipeline","prospect","sales"],
    instructions: "Use for leads, CRM, outreach, pipeline, and sales workflows. Keep customer/project data scoped to the active project.",
  },
  {
    name: "finance",
    triggers: ["budget","cash","invoice","profit","expense","financial"],
    instructions: "Use for financial analysis, budgets, invoices, cash snapshots, and expense/profit workflows. Treat financial actions as high-sensitivity and require explicit authorization for external side effects.",
  },
  {
    name: "hr",
    triggers: ["hiring","interview","employee","onboarding","job post","hr"],
    instructions: "Use for hiring, interview preparation, onboarding, and HR workflows. Keep personnel information project-scoped and private.",
  },
  {
    name: "legal",
    triggers: ["contract","policy","compliance","legal","terms","privacy"],
    instructions: "Use for contract, policy, and compliance workflows. Identify uncertainty and avoid presenting legal conclusions as professional legal advice.",
  },
  {
    name: "productivity",
    triggers: ["task","priority","prioritize","status","continue","plan","todo","organize"],
    instructions: "Use for task planning, status, priorities, and continuation of active work. Prefer execution over unnecessary planning when the task is clear.",
  },
];

export function routeSkills(mission: string): SkillDefinition[] {
  const text = mission.toLowerCase();
  const scored = SKILLS.map((skill) => ({
    skill,
    score: skill.triggers.reduce((score, trigger) => score + (text.includes(trigger) ? 1 : 0), 0),
  }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.length ? scored.slice(0, 3).map((item) => item.skill) : [SKILLS[0]];
}
