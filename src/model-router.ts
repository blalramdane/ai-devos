import type { DevOSConfig, ModelRoute } from "./config.js";

const ROUTING_HINTS: Record<string, string[]> = {
  engineering: ["code", "bug", "fix", "api", "architecture", "test", "build", "debug", "refactor", "deploy"],
  research: ["research", "latest", "current", "compare", "verify", "documentation", "investigate"],
  local: ["local", "offline", "private", "on-device", "no cloud"],
  product: ["prd", "roadmap", "requirement", "spec", "feature"],
};

function scoreRoute(route: ModelRoute, mission: string): number {
  const text = mission.toLowerCase();
  const explicit = route.tags.reduce((score, tag) => score + (text.includes(tag.toLowerCase()) ? 3 : 0), 0);

  const hintScore = Object.entries(ROUTING_HINTS).reduce((score, [hint, triggers]) => {
    if (!route.tags.includes(hint)) return score;
    return score + triggers.reduce((sum, trigger) => sum + (text.includes(trigger) ? 1 : 0), 0);
  }, 0);

  return explicit + hintScore;
}

export class ModelRouter {
  constructor(private readonly routes: ModelRoute[]) {
    if (routes.length === 0) {
      throw new Error("AI DevOS ModelRouter requires at least one model route.");
    }
  }

  resolve(mission: string): ModelRoute[] {
    return [...this.routes]
      .map((route, index) => ({
        route,
        score: scoreRoute(route, mission),
        index,
      }))
      .sort((a, b) => b.score - a.score || a.route.priority - b.route.priority || a.index - b.index)
      .map((item) => item.route);
  }

  primary(mission: string): ModelRoute {
    return this.resolve(mission)[0];
  }

  list(): ModelRoute[] {
    return [...this.routes].sort((a, b) => a.priority - b.priority);
  }
}

export function createModelRouter(config: DevOSConfig): ModelRouter {
  return new ModelRouter([config.primaryRoute, ...config.fallbackRoutes]);
}
