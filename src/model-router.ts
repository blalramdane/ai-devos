import type { DevOSConfig, ModelRoute } from "./config.js";
import { loadExperientialCatalog, type ModelCatalogEntry } from "./model-catalog.js";

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
  constructor(
    private readonly routes: ModelRoute[],
    private readonly catalog: ModelCatalogEntry[] = [],
  ) {
    if (routes.length === 0) throw new Error("AI DevOS ModelRouter requires at least one model route.");
  }

  resolve(mission: string): ModelRoute[] {
    return [...this.routes]
      .filter((route) => {
        if (route.provider !== "experiential" || this.catalog.length === 0) return true;
        const model = this.catalog.find((entry) => entry.id === route.model);
        return !model || model.supportsTools !== false;
      })
      .map((route, index) => ({
        route,
        score: scoreRoute(route, mission),
        index,
      }))
      .sort((a, b) => b.score - a.score || a.route.priority - b.route.priority || a.index - b.index)
      .map((item) => item.route);
  }

  primary(mission: string): ModelRoute {
    const route = this.resolve(mission)[0];
    if (!route) throw new Error("No configured model route supports the current mission.");
    return route;
  }

  list(): ModelRoute[] {
    return [...this.routes].sort((a, b) => a.priority - b.priority);
  }

  catalog(): ModelCatalogEntry[] {
    return [...this.catalog];
  }
}

export async function createModelRouter(config: DevOSConfig): Promise<ModelRouter> {
  const routes = [config.primaryRoute, ...config.fallbackRoutes];
  const catalog = routes.some((route) => route.provider === "experiential")
    ? await loadExperientialCatalog(routes)
    : [];
  return new ModelRouter(routes, catalog);
}
