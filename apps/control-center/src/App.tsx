import { useEffect, useMemo, useState } from "react";
import { Activity, Bot, CheckCircle2, Circle, Code2, FolderGit2, GitBranch, LayoutDashboard, Play, ShieldCheck, Terminal, TestTube2, Zap, ChevronRight } from "lucide-react";
import "./styles.css";

type Task = { id: string; projectId: string; prompt: string; status: string; updatedAt: string };
type Project = { id: string; name: string; rootPath: string };
type Evidence = { kind: string; title: string; summary: string; passed: boolean };
type EventItem = { at: string; text: string; icon: "bot" | "code" | "terminal" };

const API = import.meta.env.VITE_AIDEVOS_API ?? "http://localhost:8787";

function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [missions, setMissions] = useState<Task[]>([]);
  const [selected, setSelected] = useState<Task | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  const refresh = async () => {
    const [p, m] = await Promise.all([
      fetch(`${API}/api/projects`).then(r => r.json()),
      fetch(`${API}/api/missions`).then(r => r.json()),
    ]);
    setProjects(p); setMissions(m);
    if (!selected && m[0]) setSelected(m[0]);
  };

  useEffect(() => {
    refresh().catch(e => setError(String(e)));
    const source = new EventSource(`${API}/api/events`);
    const handle = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (event.type === "mission.completed" || event.type === "mission.failed") setRunning(false);
        if (data?.task) setSelected(data.task);
        setEvents(prev => [{ at: new Date().toLocaleTimeString(), text: event.type.replace("mission.", ""), icon: event.type.includes("agent") ? "bot" : event.type.includes("tool") ? "code" : "terminal" }, ...prev].slice(0, 8));
        refresh().catch(() => undefined);
      } catch { /* ignore malformed event */ }
    };
    ["mission.started", "mission.agent.started", "mission.agent.completed", "mission.tool.started", "mission.tool.completed", "mission.completed", "mission.failed"].forEach(name => source.addEventListener(name, handle));
    return () => source.close();
  }, []);

  const project = useMemo(() => projects.find(p => p.id === selected?.projectId) ?? projects[0], [projects, selected]);

  const runMission = async () => {
    if (!project) return;
    setRunning(true); setError("");
    const response = await fetch(`${API}/api/missions`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: project.id,
        prompt: selected?.prompt ?? "Inspect the project and report its current engineering state.",
        verificationCommands: ["npm test"],
      }),
    });
    if (!response.ok) { setRunning(false); setError(await response.text()); return; }
    const created = await response.json();
    setSelected({ id: created.taskId, projectId: project.id, prompt: selected?.prompt ?? "", status: "queued", updatedAt: new Date().toISOString() });
  };

  const status = selected?.status ?? "idle";
  const statusLabel = status === "completed" ? "VERIFIED" : status === "failed" ? "FAILED" : status.toUpperCase();
  const stepState = (step: string) => {
    if (status === "completed") return "done";
    if (step === "Execute" && ["executing","testing","verifying"].includes(status)) return "active";
    if (step === "Test" && ["testing","verifying"].includes(status)) return "active";
    if (step === "Verify" && status === "verifying") return "active";
    return "pending";
  };
  const steps = [
    ["Understand", Bot], ["Plan", LayoutDashboard], ["Execute", Code2], ["Test", TestTube2], ["Browser", Zap], ["Verify", ShieldCheck],
  ] as const;

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">N</div><div><b>AI DevOS</b><span>Control Center</span></div></div>
      <nav><button className="nav active"><LayoutDashboard size={17}/> Overview</button><button className="nav"><Zap size={17}/> Missions <em>{missions.length}</em></button><button className="nav"><FolderGit2 size={17}/> Projects</button><button className="nav"><Activity size={17}/> Activity</button></nav>
      <div className="project-card"><div className="eyebrow">ACTIVE PROJECT</div><div className="project-name">{project?.name ?? "No project registered"}</div><div className="branch"><GitBranch size={13}/> {project?.rootPath ?? "Register a project first"}</div></div>
    </aside>

    <main>
      <header className="topbar"><div><span className="eyebrow">MISSION CONTROL</span><h1>Software Engineering OS</h1></div><div className="top-actions"><span className="online"><i/> Control plane online</span><button className="avatar">BR</button></div></header>
      <section className="content">
        <div className="mission-head"><div><div className="mission-id">MISSION {selected ? "#" + selected.id.slice(0, 8) : "—"} <span>•</span> {statusLabel}</div><h2>{selected?.prompt || "No active mission"}</h2><p>{project ? `Project: ${project.name} · ${project.rootPath}` : "Add a project through POST /api/projects."}</p></div><button className={"run-btn " + (running ? "running" : "")} onClick={runMission} disabled={!project || running}>{running ? <><Activity size={16}/> Running</> : <><Play size={16}/> Run mission</>}</button></div>

        <div className="stepper">{steps.map(([label, Icon], i) => { const state = stepState(label); return <div className="step-wrap" key={label}><div className={"step " + state}><div className="step-icon">{state === "done" ? <CheckCircle2 size={18}/> : <Icon size={17}/>}</div><span>{label}</span></div>{i < steps.length - 1 && <ChevronRight className="connector" size={15}/>}</div>; })}</div>

        <div className="grid">
          <section className="panel evidence-panel"><div className="panel-head"><div><span className="eyebrow">PROOF</span><h3>Verification evidence</h3></div><span className="state-pill">{status === "completed" ? "VERIFIED" : "AWAITING PROOF"}</span></div>
            <div className="evidence-list">
              <div className="evidence"><div className={"evidence-icon " + (status === "completed" ? "pass" : "wait")}>{status === "completed" ? <CheckCircle2 size={17}/> : <Circle size={17}/>}</div><div className="evidence-copy"><div><span className="kind">MISSION</span><strong>Runtime status</strong></div><p>{selected ? status : "No mission selected"}</p></div><span className={status === "completed" ? "passed" : "pending"}>{status === "completed" ? "PASSED" : "PENDING"}</span></div>
              <div className="evidence"><div className="evidence-icon wait"><Circle size={17}/></div><div className="evidence-copy"><div><span className="kind">TEST</span><strong>Verification command</strong></div><p>npm test · evidence is produced by MissionRunner</p></div><span className="pending">RUNTIME</span></div>
              <div className="evidence"><div className="evidence-icon wait"><Circle size={17}/></div><div className="evidence-copy"><div><span className="kind">BROWSER</span><strong>Browser verification</strong></div><p>Playwright evidence is required before verified state</p></div><span className="pending">PENDING</span></div>
            </div>
            <div className="verification-banner"><ShieldCheck size={19}/><div><strong>{status === "completed" ? "Mission verified" : "Not verified yet"}</strong><span>AI DevOS only completes a mission when verification evidence passes.</span></div></div>
          </section>

          <section className="panel activity-panel"><div className="panel-head"><div><span className="eyebrow">LIVE</span><h3>Agent activity</h3></div><span className="live-dot"><i/> SSE</span></div><div className="activity">{events.length ? events.map((e, i) => <div className="event" key={i}><span className="time">{e.at}</span>{e.icon === "bot" ? <Bot size={15}/> : e.icon === "code" ? <Code2 size={15}/> : <Terminal size={15}/>}<span>{e.text}</span></div>) : <div className="event muted"><span className="time">—</span><Circle size={15}/><span>Waiting for mission events</span></div>}</div></section>
        </div>

        <section className="terminal panel"><div className="terminal-head"><span><Terminal size={15}/> control-plane</span><span>{error ? "error" : "live"}</span></div><pre><span>$</span> GET /api/projects{"
"}<b>✓</b> {projects.length} project(s) loaded{"
"}<span>$</span> GET /api/missions{"
"}<b>✓</b> {missions.length} mission(s) loaded{"
"}<span>$</span> SSE /api/events{"
"}<i>{error || "… listening for runtime events"}</i></pre></section>
      </section>
    </main>
  </div>;
}
export default App;
