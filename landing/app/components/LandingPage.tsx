"use client";

/* eslint-disable @next/next/no-img-element -- Existing lightweight brand SVGs are served directly. */

import {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { SunIcon } from "@phosphor-icons/react";
import {
  ArrowLeft,
  ArrowUpRight,
  Briefcase,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  CalendarDays,
  ChartNoAxesColumn,
  Check,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  CircleDot,
  FileText,
  Gift,
  Info,
  LayoutDashboard,
  Link2,
  MoreHorizontal,
  Pause,
  Play,
  Quote,
  Search,
  Send,
  Settings,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";

type DemoStep = "import" | "decide" | "track";
type ImportState = "idle" | "reading" | "ready";

const demoSteps: Array<{
  id: DemoStep;
  number: string;
  label: string;
  description: string;
}> = [
  {
    id: "import",
    number: "01",
    label: "Import",
    description: "Turn a link into a clean role",
  },
  {
    id: "decide",
    number: "02",
    label: "Decide",
    description: "See the fit and the evidence",
  },
  {
    id: "track",
    number: "03",
    label: "Track",
    description: "Keep the next move in sight",
  },
];

const evidence = [
  {
    id: "systems",
    tone: "match",
    label: "Match",
    title: "Design systems",
    summary: "Strong evidence across two recent roles",
    vacancy:
      "“Own and evolve our multi-product design system with engineering.”",
    profile:
      "Led a shared design system across three B2B products at Morrow; partnered with 12 frontend engineers.",
  },
  {
    id: "saas",
    tone: "match",
    label: "Match",
    title: "B2B SaaS experience",
    summary: "5 years of directly relevant work",
    vacancy:
      "“5+ years designing complex workflows for B2B software.”",
    profile:
      "5.8 years across workflow and analytics products, including two 0→1 launches.",
  },
  {
    id: "research",
    tone: "partial",
    label: "Partial",
    title: "Research operations",
    summary: "Evidence is present, but not at scale",
    vacancy:
      "“Build a repeatable research practice across product teams.”",
    profile:
      "Planned and facilitated monthly customer interviews; no evidence of an org-wide research program.",
  },
] as const;

const visualEvidenceItems: Array<{
  icon: LucideIcon;
  title: string;
  detail: string;
}> = [
  { icon: Check, title: "Design systems", detail: "Met · CV evidence" },
  { icon: Check, title: "B2B SaaS", detail: "Met · 5.8 years" },
  { icon: CircleDot, title: "Research operations", detail: "Partial · review" },
  { icon: Info, title: "Team size", detail: "Unknown · ask recruiter" },
];

function MarkIcon({ children }: { children: ReactNode }) {
  return (
    <span className="mark-icon" aria-hidden="true">
      {children}
    </span>
  );
}

function ArrowIcon() {
  return <ArrowUpRight aria-hidden="true" />;
}

function ImportPanel({
  state,
  onImport,
}: {
  state: ImportState;
  onImport: () => void;
}) {
  const isReading = state === "reading";
  const isReady = state === "ready";
  const stats: Array<{
    icon: LucideIcon;
    label: string;
    value: string;
    detail: string;
    tone: string;
  }> = [
    {
      icon: BriefcaseBusiness,
      label: "Active applications",
      value: isReady ? "4" : "3",
      detail: isReady ? "1 added now" : "1 added this week",
      tone: "blue",
    },
    {
      icon: CalendarDays,
      label: "Interviews",
      value: "1",
      detail: "1 this week",
      tone: "green",
    },
    {
      icon: CheckSquare,
      label: "Tasks due",
      value: "2",
      detail: "1 due today",
      tone: "yellow",
    },
    {
      icon: Gift,
      label: "Offers",
      value: "0",
      detail: "0 new this week",
      tone: "blue",
    },
  ];

  return (
    <div
      className="product-panel import-panel dashboard-panel"
      id="demo-panel-import"
      role="tabpanel"
      aria-labelledby="demo-tab-import"
    >
      <section className="real-import-card">
        <div className="real-import-thread real-import-thread-left" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <div className="real-import-thread real-import-thread-right" aria-hidden="true">
          <i />
          <span />
        </div>
        <div className="real-import-layout">
          <div className="real-import-icon" aria-hidden="true">
            <Link2 />
          </div>
          <div className="real-import-main">
            <h3>Add a vacancy in seconds</h3>
            <p>Paste a job link and Niti will capture the details for you.</p>
            <div className="real-import-form">
              <label className="real-url-field">
                <span aria-hidden="true"><Link2 /></span>
                <span className="sr-only">Vacancy URL</span>
                <input
                  type="url"
                  defaultValue="https://thehub.io/jobs/northstar-product-designer"
                  aria-label="Vacancy URL"
                />
              </label>
              <button
                className="small-primary-button real-import-button"
                type="button"
                onClick={onImport}
                disabled={isReading}
              >
                {isReading ? (
                  <>
                    <span className="spinner" aria-hidden="true" />
                    Importing…
                  </>
                ) : isReady ? (
                  "Imported"
                ) : (
                  "Import vacancy"
                )}
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className="dashboard-stats" aria-label="Career search summary">
        {stats.map(({ icon: Icon, label, value, detail, tone }) => (
          <article className="dashboard-stat-card" key={label}>
            <span className={`stat-icon stat-${tone}`} aria-hidden="true">
              <Icon />
            </span>
            <div>
              <small>{label}</small>
              <strong>{value}</strong>
              <span>{detail}</span>
            </div>
          </article>
        ))}
      </div>

      <div
        className="dashboard-detail-grid"
        aria-live="polite"
        aria-busy={isReading}
      >
        <article className="real-dashboard-card attention-card">
          <header>
            <h4>Needs attention</h4>
            <span>{isReady ? "2 open" : "1 open"}</span>
          </header>
          <div className="attention-row">
            <span className="attention-check" aria-hidden="true"><CheckSquare /></span>
            <div>
              <strong>
                {isReady ? "Review imported vacancy details" : "Follow up with Northstar"}
              </strong>
              <small>{isReady ? "Senior Product Designer · just now" : "Due today"}</small>
            </div>
            <button type="button">Open</button>
          </div>
        </article>

        <article className="real-dashboard-card recent-card">
          <header>
            <h4>Recent applications</h4>
            <span>View all applications</span>
          </header>
          <div className="recent-table-head" aria-hidden="true">
            <span>Role</span>
            <span>Company</span>
            <span>Status</span>
          </div>
          {isReady ? (
            <div className="recent-application new-row">
              <span className="application-icon" aria-hidden="true">
                <BriefcaseBusiness />
              </span>
              <div>
                <strong>Senior Product Designer</strong>
                <small>Northstar</small>
              </div>
              <span className="saved-badge">Saved</span>
            </div>
          ) : null}
          <div className="recent-application">
            <span className="application-icon" aria-hidden="true">
              <BriefcaseBusiness />
            </span>
            <div>
              <strong>Senior Backend Developer</strong>
              <small>FoodOp</small>
            </div>
            <span className="applied-badge">Applied</span>
          </div>
        </article>

        <article className="real-dashboard-card pipeline-summary">
          <header>
            <h4>Application pipeline</h4>
          </header>
          <ol>
            {[
              ["Saved", isReady ? "1" : "0", "neutral"],
              ["Applied", "3", "active"],
              ["Interview", "1", "info"],
              ["Offer", "0", "success"],
            ].map(([label, count, tone]) => (
              <li key={label}>
                <i className={`pipeline-dot ${tone}`} />
                <div>
                  <span>{label}</span>
                  <strong>{count}</strong>
                </div>
              </li>
            ))}
          </ol>
        </article>
      </div>
    </div>
  );
}

function EvidenceRow({
  item,
  open,
  onToggle,
}: {
  item: (typeof evidence)[number];
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <article className={`evidence-row ${open ? "is-open" : ""}`}>
      <button
        type="button"
        className="evidence-toggle"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`evidence-${item.id}`}
      >
        <span className={`evidence-tone ${item.tone}`}>{item.label}</span>
        <span className="evidence-copy">
          <strong>{item.title}</strong>
          <small>{item.summary}</small>
        </span>
        <span className="evidence-chevron" aria-hidden="true">
          <ChevronDown />
        </span>
      </button>
      <div className="evidence-detail" id={`evidence-${item.id}`} hidden={!open}>
        <div>
          <span><Quote aria-hidden="true" /> From the vacancy</span>
          <p>{item.vacancy}</p>
        </div>
        <div>
          <span>From your CV &amp; profile</span>
          <p>{item.profile}</p>
        </div>
      </div>
    </article>
  );
}

function DecidePanel({
  openEvidence,
  onToggleEvidence,
  reanalyzed,
  onAnalyzeAgain,
}: {
  openEvidence: string | null;
  onToggleEvidence: (id: string) => void;
  reanalyzed: boolean;
  onAnalyzeAgain: () => void;
}) {
  return (
    <div
      className="product-panel decide-panel vacancy-detail-panel"
      id="demo-panel-decide"
      role="tabpanel"
      aria-labelledby="demo-tab-decide"
    >
      <div className="real-page-heading">
        <button className="back-link" type="button">
          <ArrowLeft aria-hidden="true" /> Vacancies
        </button>
        <div className="real-page-title-row">
          <div className="company-avatar compact" aria-hidden="true">
            N
          </div>
          <div>
            <span>Northstar · Copenhagen · Hybrid</span>
            <h3>Senior Product Designer</h3>
          </div>
        </div>
        <div className="vacancy-meta">
          <span>Full-time</span>
          <span>Hybrid</span>
          <span>DKK 620–720k</span>
          <span>The Hub</span>
        </div>
      </div>

      <article className="real-job-match-card">
        <header className="real-job-match-header">
          <div className="job-match-title">
            <span className="sparkle-icon" aria-hidden="true"><Sparkles /></span>
            <div>
              <h4>Job match</h4>
              <p>Compared with your career profile and Product Designer CV</p>
            </div>
          </div>
          <div className="job-match-actions">
            <span className="real-verdict-pill">
              <i /> Apply · 84
            </span>
            <button type="button" onClick={onAnalyzeAgain}>
              {reanalyzed ? "Analysis updated" : "Analyze again"}
            </button>
          </div>
        </header>

        <div className="job-match-summary">
          <strong>A strong fit for your product design background.</strong>
          <p>
            Your systems and B2B SaaS experience cover the core requirements.
            Research operations are the only partial match.
          </p>
        </div>

        <div className="real-score-breakdown" aria-label="Job match score breakdown">
          <dl className="score-breakdown">
            <div>
              <dt>Skills</dt>
              <dd>
                <span style={{ width: "92%" }} />
              </dd>
              <b>37/40</b>
            </div>
            <div>
              <dt>Experience</dt>
              <dd>
                <span style={{ width: "85%" }} />
              </dd>
              <b>17/20</b>
            </div>
            <div>
              <dt>Preferences</dt>
              <dd>
                <span style={{ width: "75%" }} />
              </dd>
              <b>15/20</b>
            </div>
          </dl>
        </div>

        <div className="real-match-grid">
          <section className="evidence-card">
            <div className="evidence-header">
              <div>
                <span className="panel-kicker">Matches · 3</span>
                <h4>Requirements and evidence</h4>
              </div>
              <span className="confidence-pill">High confidence</span>
            </div>
            <div className="evidence-list">
              {evidence.map((item) => (
                <EvidenceRow
                  key={item.id}
                  item={item}
                  open={openEvidence === item.id}
                  onToggle={() => onToggleEvidence(item.id)}
                />
              ))}
            </div>
          </section>

          <aside className="match-side-notes">
            <section>
              <h5>Gaps <span>1</span></h5>
              <p>
                <i className="amber-dot" /> Research practice at company scale
              </p>
            </section>
            <section>
              <h5>Not stated in the vacancy <span>2</span></h5>
              <p>Team size</p>
              <p>Learning budget</p>
            </section>
            <div className="job-match-next-action">
              <span>Recommended next step</span>
              <strong>Create an application</strong>
            </div>
          </aside>
        </div>

        <footer className="job-match-footer">
          <button className="small-primary-button" type="button">
            Create application
          </button>
          <button type="button">Archive vacancy</button>
        </footer>
      </article>
    </div>
  );
}

function PipelineCard({
  title,
  company,
  meta,
  featured = false,
}: {
  title: string;
  company: string;
  meta: string;
  featured?: boolean;
}) {
  return (
    <article className={`pipeline-card real-board-card ${featured ? "featured" : ""}`}>
      <div className="real-board-card-title">
        <strong>{title}</strong>
        <button type="button" aria-label={`Actions for ${title}`}>
          <MoreHorizontal aria-hidden="true" />
        </button>
      </div>
      <span>{company}</span>
      <div className="real-board-card-meta">
        <span className={`board-status ${meta.toLowerCase().replaceAll(" ", "-")}`}>
          {meta}
        </span>
        <small>{featured ? "Updated today" : "3d in stage"}</small>
      </div>
    </article>
  );
}

function TrackPanel({
  moved,
  onMove,
}: {
  moved: boolean;
  onMove: () => void;
}) {
  return (
    <div
      className="product-panel track-panel applications-panel"
      id="demo-panel-track"
      role="tabpanel"
      aria-labelledby="demo-tab-track"
    >
      <div className="applications-toolbar">
        <div>
          <div className="view-toggle" aria-label="Applications view">
            <button type="button">Table</button>
            <button className="active" type="button">Board</button>
          </div>
          <span className="applications-count">5 applications</span>
        </div>
        <div className="applications-actions">
          <button className="outline-action" type="button">Filter</button>
          <button
            className="small-primary-button"
            type="button"
            onClick={onMove}
            disabled={moved}
          >
            {moved ? "Moved to Interviewing" : "Move Northstar to Interviewing"}
          </button>
        </div>
      </div>

      <div className="pipeline-board real-applications-board">
        <section className="pipeline-column" aria-label="Saved applications">
          <header>
            <span>Saved</span>
            <b>1</b>
          </header>
          <PipelineCard
            title="Product Designer"
            company="Lumen"
            meta="Saved"
          />
        </section>

        <section className="pipeline-column" aria-label="Applied applications">
          <header>
            <span>Applied</span>
            <b>{moved ? 1 : 2}</b>
          </header>
          {!moved ? (
            <div className="moving-card">
              <PipelineCard
                title="Senior Product Designer"
                company="Northstar"
                meta="Applied"
                featured
              />
            </div>
          ) : null}
          <PipelineCard
            title="Lead Product Designer"
            company="Orbit"
            meta="Applied"
          />
        </section>

        <section className="pipeline-column" aria-label="Screening applications">
          <header>
            <span>Screening</span>
            <b>1</b>
          </header>
          <PipelineCard
            title="Senior UX Designer"
            company="Arc"
            meta="In review"
          />
        </section>

        <section
          className={`pipeline-column interview-column ${moved ? "has-moved-card" : ""}`}
          aria-label="Interviewing applications"
        >
          <header>
            <span>Interviewing</span>
            <b>{moved ? 2 : 1}</b>
          </header>
          {moved ? (
            <div className="moving-card arrived">
              <PipelineCard
                title="Senior Product Designer"
                company="Northstar"
                meta="Tech interview"
                featured
              />
            </div>
          ) : (
            <div className="drop-hint">
              Drop a card here
            </div>
          )}
          <PipelineCard
            title="Staff Designer"
            company="Harbor"
            meta="Recruiter screen"
          />
        </section>
      </div>

      <p className="sr-only" aria-live="polite">
        {moved
          ? "Northstar Senior Product Designer moved from Applied to Interviewing."
          : ""}
      </p>
    </div>
  );
}

function DemoSidebar({ active }: { active: DemoStep }) {
  const activeItem =
    active === "import" ? "Dashboard" : active === "decide" ? "Vacancies" : "Applications";
  const navItems: Array<[LucideIcon, string]> = [
    [LayoutDashboard, "Dashboard"],
    [Briefcase, "Vacancies"],
    [Send, "Applications"],
    [CalendarClock, "Interviews"],
    [CheckSquare, "Tasks"],
    [Building2, "Companies"],
    [Users, "Contacts"],
    [FileText, "Documents"],
    [ChartNoAxesColumn, "Analytics"],
  ];

  return (
    <aside className="demo-sidebar" aria-hidden="true">
      <div className="sidebar-brand">
        <img src="/brand/niti-mark.svg" alt="" />
        <img src="/brand/niti-wordmark.svg" alt="" />
      </div>
      <nav>
        {navItems.map(([Icon, label]) => (
          <span className={activeItem === label ? "active" : ""} key={label}>
            <MarkIcon><Icon /></MarkIcon> {label}
          </span>
        ))}
      </nav>
      <div className="sidebar-footer">
        <span className="settings-row"><MarkIcon><Settings /></MarkIcon> Settings</span>
        <div className="sidebar-account">
          <span>A</span>
          <div>
            <b>Aleksandr L.</b>
            <small>aleksandr@niti.xyz</small>
          </div>
        </div>
      </div>
    </aside>
  );
}

function ProductDemo() {
  const [step, setStep] = useState<DemoStep>("import");
  const [importState, setImportState] = useState<ImportState>("idle");
  const [openEvidence, setOpenEvidence] = useState<string | null>("systems");
  const [moved, setMoved] = useState(false);
  const [reanalyzed, setReanalyzed] = useState(false);
  const [playing, setPlaying] = useState(true);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const frame = window.requestAnimationFrame(() => {
      if (media.matches) setPlaying(false);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setStep((current) => {
        const index = demoSteps.findIndex((item) => item.id === current);
        return demoSteps[(index + 1) % demoSteps.length].id;
      });
    }, 6500);
    return () => window.clearInterval(timer);
  }, [playing]);

  useEffect(() => {
    if (importState !== "reading") return;
    const timer = window.setTimeout(() => setImportState("ready"), 1250);
    return () => window.clearTimeout(timer);
  }, [importState]);

  function chooseStep(next: DemoStep) {
    setStep(next);
    setPlaying(false);
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();

    let nextIndex = index;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % demoSteps.length;
    if (event.key === "ArrowLeft")
      nextIndex = (index - 1 + demoSteps.length) % demoSteps.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = demoSteps.length - 1;

    const next = demoSteps[nextIndex];
    chooseStep(next.id);
    tabRefs.current[nextIndex]?.focus();
  }

  const workspaceHeading =
    step === "import"
      ? {
          title: "Good morning, Aleksandr",
          description: "Here’s what needs your attention today.",
        }
      : step === "decide"
        ? {
            title: "Senior Product Designer",
            description: "Northstar · Copenhagen · Hybrid",
          }
        : {
            title: "Applications",
            description: "Every application you have sent.",
          };

  return (
    <section className="demo-section" id="demo" aria-labelledby="demo-heading">
      <div className="demo-intro">
        <div>
          <span className="section-eyebrow">See Niti in action</span>
          <h2 id="demo-heading">One link. One clear decision. One thread.</h2>
        </div>
        <p>
          This is a live product story, not a video. Choose a step and try it.
        </p>
      </div>

      <div className="demo-stage">
        <div
          className="scenario-tabs"
          role="tablist"
          aria-label="Niti product demo steps"
        >
          {demoSteps.map((item, index) => (
            <button
              key={item.id}
              ref={(node) => {
                tabRefs.current[index] = node;
              }}
              type="button"
              role="tab"
              id={`demo-tab-${item.id}`}
              aria-selected={step === item.id}
              aria-controls={`demo-panel-${item.id}`}
              tabIndex={step === item.id ? 0 : -1}
              className={step === item.id ? "active" : ""}
              onClick={() => chooseStep(item.id)}
              onFocus={() => setPlaying(false)}
              onPointerDown={() => setPlaying(false)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
            >
              <span>{item.number}</span>
              <b>{item.label}</b>
              <small>{item.description}</small>
            </button>
          ))}
          <button
            className="demo-play-button"
            type="button"
            onClick={() => setPlaying((current) => !current)}
            aria-label={playing ? "Pause demo autoplay" : "Play demo autoplay"}
          >
            <span aria-hidden="true">{playing ? <Pause /> : <Play />}</span>
            {playing ? "Pause" : "Play"}
          </button>
        </div>

        <div className="app-window">
          <div className="app-shell">
            <DemoSidebar active={step} />
            <div className="demo-workspace">
              <div className="app-topbar">
                <img
                  className="topbar-mobile-mark"
                  src="/brand/niti-app-icon.svg"
                  alt=""
                  aria-hidden="true"
                />
                <div className="workspace-heading">
                  <strong>{workspaceHeading.title}</strong>
                  <span>{workspaceHeading.description}</span>
                </div>
                <div className="workspace-search">
                  <span aria-hidden="true"><Search /></span>
                  <span>Search applications, companies, contacts…</span>
                </div>
                <div className="topbar-actions">
                  <span className="mode-action" aria-hidden="true"><SunIcon /></span>
                  <b>A</b>
                </div>
              </div>
              <div
                className="demo-content"
                onPointerDown={() => setPlaying(false)}
                onFocusCapture={() => setPlaying(false)}
              >
                <div key={step} className="panel-transition">
                  {step === "import" ? (
                    <ImportPanel
                      state={importState}
                      onImport={() => {
                        setImportState("reading");
                        setPlaying(false);
                      }}
                    />
                  ) : null}
                  {step === "decide" ? (
                    <DecidePanel
                      openEvidence={openEvidence}
                      onToggleEvidence={(id) => {
                        setOpenEvidence((current) => (current === id ? null : id));
                        setPlaying(false);
                      }}
                      reanalyzed={reanalyzed}
                      onAnalyzeAgain={() => {
                        setReanalyzed(true);
                        setPlaying(false);
                      }}
                    />
                  ) : null}
                  {step === "track" ? (
                    <TrackPanel
                      moved={moved}
                      onMove={() => {
                        setMoved(true);
                        setPlaying(false);
                      }}
                    />
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={`floating-proof proof-${step}`} aria-hidden="true">
          <span className="proof-icon">
            {step === "import" ? <Link2 /> : step === "decide" ? "84" : <CheckCircle2 />}
          </span>
          <div>
            <small>Your thread</small>
            <strong>
              {step === "import"
                ? importState === "ready"
                  ? "Role ready to review"
                  : importState === "reading"
                    ? "Reading public job post"
                    : "Public link ready"
                : step === "decide"
                  ? "Evidence, not guesswork"
                  : moved
                    ? "Interview added"
                    : "Next move in sight"}
            </strong>
          </div>
        </div>
      </div>
    </section>
  );
}

function ThreadMap() {
  return (
    <div className="thread-map" aria-label="Niti workflow">
      {[
        ["01", "A job link", "Captured cleanly"],
        ["02", "A clear decision", "Backed by evidence"],
        ["03", "A next move", "Kept in motion"],
        ["04", "An offer", "With the full story"],
      ].map(([number, title, detail], index) => (
        <div className="thread-node" key={number}>
          <span>{number}</span>
          <div>
            <strong>{title}</strong>
            <small>{detail}</small>
          </div>
          {index < 3 ? <i aria-hidden="true" /> : null}
        </div>
      ))}
    </div>
  );
}

export function LandingPage() {
  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <a className="brand-link" href="#top" aria-label="Niti home">
            <img className="brand-mark-image" src="/brand/niti-mark.svg" alt="" />
            <img className="brand-wordmark-image" src="/brand/niti-wordmark.svg" alt="Niti" />
          </a>
          <nav className="main-nav" aria-label="Main navigation">
            <a href="#how-it-works">How it works</a>
            <a href="#job-match">Job Match</a>
            <a href="#control">Your control</a>
          </nav>
          <div className="header-actions">
            <a className="sign-in-link" href="https://app.useniti.xyz/login">
              Sign in
            </a>
            <a className="header-cta" href="https://app.useniti.xyz/register">
              Start your thread <ArrowIcon />
            </a>
          </div>
        </div>
      </header>

      <main id="top">
        <section className="hero-section">
          <div className="hero-glow" aria-hidden="true" />
          <div className="hero-thread" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
          <div className="hero-grid">
            <div className="hero-copy">
              <span className="hero-eyebrow">
                <i aria-hidden="true" />
                A career workspace that keeps every move connected
              </span>
              <h1>
                Don’t lose
                <span>the thread.</span>
              </h1>
            </div>
            <div className="hero-support">
              <p>
                Paste a job link. Niti captures the details, checks the fit
                against your profile and CV, and keeps every next step connected
                — from saved to offer.
              </p>
              <div className="hero-actions">
                <a className="primary-cta" href="https://app.useniti.xyz/register">
                  Start your thread <ArrowIcon />
                </a>
                <a className="secondary-cta" href="#demo">
                  See Niti in action <ChevronDown aria-hidden="true" />
                </a>
              </div>
              <div className="trust-line" aria-label="Niti principles">
                <span>Evidence-backed matches</span>
                <span>Deterministic scoring</span>
                <span>You stay in control</span>
              </div>
            </div>
          </div>
        </section>

        <ProductDemo />

        <section className="thread-section" id="how-it-works">
          <div className="section-heading centered">
            <span className="section-eyebrow">From saved to offer</span>
            <h2>One thread. Every move.</h2>
            <p>
              Niti gives your search a shape: less tab chaos, fewer lost
              follow-ups, and a clear reason for every decision.
            </p>
          </div>
          <ThreadMap />
          <div className="feature-story-grid">
            <article className="feature-story">
              <span className="story-number">01</span>
              <div className="story-icon import-story-icon" aria-hidden="true">
                <span>https://</span>
                <i />
              </div>
              <h3>From job link to clear next step</h3>
              <p>
                Paste a public posting and Niti captures the role, company,
                location, pay and requirements. Review everything before it
                enters your workspace.
              </p>
              <a href="#demo">
                Try the import <ChevronRight aria-hidden="true" />
              </a>
            </article>
            <article className="feature-story">
              <span className="story-number">02</span>
              <div className="story-icon match-story-icon" aria-hidden="true">
                <strong>84</strong>
                <span>APPLY</span>
              </div>
              <h3>Know if it’s worth your time</h3>
              <p>
                Get an Apply, Maybe or Skip verdict based on your actual
                experience, preferences and deal breakers — not generic keyword
                matching.
              </p>
              <a href="#job-match">
                See how scoring works <ChevronRight aria-hidden="true" />
              </a>
            </article>
            <article className="feature-story">
              <span className="story-number">03</span>
              <div className="story-icon track-story-icon" aria-hidden="true">
                <i />
                <i />
                <i />
              </div>
              <h3>Keep the whole search moving</h3>
              <p>
                Track applications from Saved to Offer, prepare for interviews,
                manage follow-ups and see what needs your attention next.
              </p>
              <a href="#control">
                Follow the thread <ChevronRight aria-hidden="true" />
              </a>
            </article>
          </div>
        </section>

        <section className="evidence-section" id="job-match">
          <div className="evidence-section-copy">
            <span className="section-eyebrow">Job Match</span>
            <h2>An answer you can inspect.</h2>
            <p>
              Niti compares the vacancy with your confirmed career profile and
              selected CV. Every scored requirement shows its source, while gaps,
              blockers and unknowns stay visible.
            </p>
            <ul>
              <li>
                <span>01</span>
                <div>
                  <strong>Evidence first</strong>
                  <p>See the vacancy quote and the proof from your own profile.</p>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <strong>Rules you can understand</strong>
                  <p>The backend calculates the score; the AI does not improvise it.</p>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <strong>Uncertainty stays visible</strong>
                  <p>Missing information lowers confidence instead of becoming a guess.</p>
                </div>
              </li>
            </ul>
          </div>
          <div className="evidence-visual" aria-label="Example evidence-backed job match">
            <div className="visual-window-bar">
              <span>
                <i />
                <i />
                <i />
              </span>
              Job Match · Senior Product Designer
            </div>
            <div className="visual-score-row">
              <div className="mini-score-ring">
                <strong>84</strong>
                <small>Apply</small>
              </div>
              <div>
                <span>High confidence</span>
                <strong>Your core experience aligns.</strong>
                <p>One partial match is worth a closer look.</p>
              </div>
            </div>
            <div className="visual-evidence-list">
              {visualEvidenceItems.map(({ icon: Icon, title, detail }) => (
                <div key={title}>
                  <span><Icon aria-hidden="true" /></span>
                  <strong>{title}</strong>
                  <small>{detail}</small>
                  <b aria-hidden="true"><ChevronDown /></b>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="control-section" id="control">
          <div className="control-thread" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
          <div className="control-copy">
            <span className="section-eyebrow inverse">Your control</span>
            <h2>Your experience stays yours.</h2>
            <p>
              AI suggestions require your confirmation. Niti does not invent
              experience, change your CV or apply on your behalf.
            </p>
          </div>
          <div className="control-cards">
            <article>
              <span aria-hidden="true"><CheckCircle2 /></span>
              <div>
                <strong>You confirm the facts</strong>
                <p>Profile suggestions stay drafts until you review them.</p>
              </div>
            </article>
            <article>
              <span aria-hidden="true"><Quote /></span>
              <div>
                <strong>You see the evidence</strong>
                <p>Every fit conclusion points back to a real source.</p>
              </div>
            </article>
            <article>
              <span aria-hidden="true"><ArrowUpRight /></span>
              <div>
                <strong>You make the move</strong>
                <p>Niti helps you decide. The final action is always yours.</p>
              </div>
            </article>
          </div>
        </section>

        <section className="final-cta-section">
          <div className="final-thread" aria-hidden="true">
            <span />
            <i />
          </div>
          <span className="section-eyebrow">Your next move</span>
          <h2>Your next move deserves more than another spreadsheet.</h2>
          <p>Start your thread with Niti.</p>
          <a className="primary-cta large" href="https://app.useniti.xyz/register">
            Start your thread <ArrowIcon />
          </a>
        </section>
      </main>

      <footer className="site-footer">
        <div className="footer-top">
          <a className="brand-link footer-brand" href="#top" aria-label="Niti home">
            <img className="brand-mark-image" src="/brand/niti-mark.svg" alt="" />
            <img className="brand-wordmark-image" src="/brand/niti-wordmark.svg" alt="Niti" />
          </a>
          <p>Don’t lose the thread.</p>
          <nav aria-label="Footer navigation">
            <a href="#how-it-works">How it works</a>
            <a href="#job-match">Job Match</a>
            <a href="https://app.useniti.xyz/login">Sign in</a>
          </nav>
        </div>
        <div className="footer-bottom">
          <span>© 2026 Niti</span>
          <span>Career decisions, connected.</span>
        </div>
      </footer>
    </>
  );
}
