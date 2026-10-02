import { useState } from "react";
import {
  Activity,
  Bot,
  CheckCircle2,
  ChevronRight,
  Circle,
  Code2,
  FolderGit2,
  GitBranch,
  LayoutDashboard,
  Play,
  ShieldCheck,
  Terminal,
  TestTube2,
  Zap,
} from "lucide-react";
import "./styles.css";

type Status = "done" | "active" | "pending";
type Evidence = { kind: string; title: string; summary: string; passed: boolean };

const steps: { label: string; icon: typeof Bot; status: Status }[] = [
  { label: "Understand", icon: Bot, status: "done" },
  { label: "Plan", icon: LayoutDashboard, status: "done" },
  { label: "Execute", icon: Code2, status: "done" },
  { label: "Test", icon: TestTube2, status: "active" },
  { label: "Browser", icon: Zap, status: "pending" },
  { label: "Verify", icon: ShieldCheck, status: "pending" },
];

const evidence: Evidence[] = [
  { kind: "TEST", title: "Backend test suite", summary: "148 passed · 0 failed", passed: true },
  { kind: "BUILD", title: "Frontend build", summary: "Build completed successfully", passed: true },
  { kind: "BROWSER", title: "Login flow", summary: "Waiting for browser verification", passed: false },
];

function App() {
  const [running, setRunning] = useState(false);
  const [selected, setSelected] = useState("Authentication System");

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">N</div><div><b>AI DevOS</b><span>Control Center</span></div></div>
        <nav>
          <button className="nav active"><LayoutDashboard size={17}/> Overview</button>
          <button className="nav"><Zap size={17}/> Missions <em>3</em></button>
          <button className="nav"><FolderGit2 size={17}/> Projects</button>
          <button className="nav"><Activity size={17}/> Activity</button>
        </nav>
        <div className="project-card">
          <div className="eyebrow">ACTIVE PROJECT</div>
          <div className="project-name">Nexora Platform</div>
          <div className="branch"><GitBranch size={13}/> feat/runtime-core</div>
        </div>
      </aside>

      <main>
        <header className="topbar">
          <div><span className="eyebrow">MISSION CONTROL</span><h1>Software Engineering OS</h1></div>
          <div className="top-actions"><span className="online"><i/> Runtime online</span><button className="avatar">BR</button></div>
        </header>

        <section className="content">
          <div className="mission-head">
            <div>
              <div className="mission-id">MISSION #184 <span>•</span> 2m 41s</div>
              <h2>{selected}</h2>
              <p>Implement authentication, run the test suite, verify the user flow, and return evidence.</p>
            </div>
            <button className={"run-btn " + (running ? "running" : "")} onClick={() => setRunning(!running)}>
              {running ? <><Activity size={16}/> Running</> : <><Play size={16}/> Run mission</>}
            </button>
          </div>

          <div className="stepper">
            {steps.map((step, i) => {
              const Icon = step.icon;
              return <div className="step-wrap" key={step.label}>
                <div className={"step " + step.status}><div className="step-icon">{step.status === "done" ? <CheckCircle2 size={18}/> : <Icon size={17}/>}</div><span>{step.label}</span></div>
                {i < steps.length - 1 && <ChevronRight className="connector" size={15}/>}
              </div>;
            })}
          </div>

          <div className="grid">
            <section className="panel evidence-panel">
              <div className="panel-head"><div><span className="eyebrow">PROOF</span><h3>Verification evidence</h3></div><span className="state-pill">2 / 3 passed</span></div>
              <div className="evidence-list">
                {evidence.map((item) => <div className="evidence" key={item.title}>
                  <div className={"evidence-icon " + (item.passed ? "pass" : "wait")}>{item.passed ? <CheckCircle2 size={17}/> : <Circle size={17}/>}</div>
                  <div className="evidence-copy"><div><span className="kind">{item.kind}</span><strong>{item.title}</strong></div><p>{item.summary}</p></div>
                  <span className={item.passed ? "passed" : "pending"}>{item.passed ? "PASSED" : "PENDING"}</span>
                </div>)}
              </div>
              <div className="verification-banner"><ShieldCheck size={19}/><div><strong>Not verified yet</strong><span>AI DevOS requires browser evidence before declaring this mission complete.</span></div></div>
            </section>

            <section className="panel activity-panel">
              <div className="panel-head"><div><span className="eyebrow">LIVE</span><h3>Agent activity</h3></div><span className="live-dot"><i/> live</span></div>
              <div className="activity">
                <div className="event"><span className="time">06:17:42</span><Terminal size={15}/><span>Ran <code>npm test</code></span></div>
                <div className="event"><span className="time">06:17:18</span><Code2 size={15}/><span>Updated <code>AuthController.ts</code></span></div>
                <div className="event"><span className="time">06:16:54</span><Bot size={15}/><span>Inspected authentication flow</span></div>
                <div className="event muted"><span className="time">06:16:21</span><Circle size={15}/><span>Mission accepted by runtime</span></div>
              </div>
            </section>
          </div>

          <section className="terminal panel">
            <div className="terminal-head"><span><Terminal size={15}/> execution.log</span><span>workspace: nexora-platform</span></div>
            <pre><span>$</span> npm test{"\n"}<b>✓</b> 148 tests passed{"\n"}<span>$</span> npm run build{"\n"}<b>✓</b> build completed{"\n"}<span>$</span> browser.verify --flow=login{"\n"}<i>… waiting for Playwright evidence</i></pre>
          </section>
        </section>
      </main>
    </div>
  );
}

export default App;
