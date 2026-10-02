import { createControlPlane } from "./control-plane.js";

const controlPlane = createControlPlane({
  dataDir: process.env.AIDEVOS_DATA_DIR ?? "./.aidevos",
  workspacesDir: process.env.AIDEVOS_WORKSPACES_DIR ?? "./.aidevos/workspaces",
  port: Number(process.env.AIDEVOS_CONTROL_PORT ?? 8787),
});

await controlPlane.listen();
console.log(`AI DevOS control plane listening on http://localhost:${process.env.AIDEVOS_CONTROL_PORT ?? 8787}`);
