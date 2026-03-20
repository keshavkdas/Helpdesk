import { useState, useMemo, useEffect, useRef } from "react";
import axios from "axios";

// --- SERVER CONFIGURATION ---
const SERVER_IP = "10.0.2.111";
const BASE_URL = `http://${SERVER_IP}:5000/api`;

// --- API ENDPOINTS ---
const TICKETS_API = `${BASE_URL}/tickets`;
const ORGS_API = `${BASE_URL}/orgs`;
const CATEGORIES_API = `${BASE_URL}/categories`;
const CUSTOM_ATTRS_API = `${BASE_URL}/customAttrs`;
const USERS_API = `${BASE_URL}/users`;
const LOCATIONS_API = `${BASE_URL}/locations`;
const VENDORS_API = `${BASE_URL}/vendors`;
const DB_API = `${BASE_URL}/all-data`;
const AUTH_API = `${BASE_URL}/auth/login`;
const IMPORT_API = `${BASE_URL}/import`;
const PROJECTS_API = `${BASE_URL}/projects`;
const VALIDATE_SESSIONS_API = `${BASE_URL}/validate-sessions`;

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const PRIORITIES = ["Low", "Medium", "High", "Critical"];
const STATUSES = ["Open", "In Progress", "Resolved", "Closed"];
const ROLES = ["Super Admin", "Admin", "Manager", "Agent", "Viewer"];
const SATSANG_TYPES = ["G Satsang", "Weekly Satsang", "Special Satsang", "Youth Satsang", "Children Satsang"];
const PROJECT_STATUSES = ["Open", "In Progress", "Resolved", "Closed"];
const PROJECT_PRIORITIES = ["Low", "Medium", "High", "Critical"];


const PRIORITY_COLOR = { Low: "#22c55e", Medium: "#f59e0b", High: "#f97316", Critical: "#ef4444" };
const STATUS_COLOR = {
  Open: { bg: "#dbeafe", text: "#1d4ed8" },
  "In Progress": { bg: "#fef9c3", text: "#854d0e" },
  Pending: { bg: "#ede9fe", text: "#6d28d9" },
  Resolved: { bg: "#dcfce7", text: "#15803d" },
  Closed: { bg: "#f1f5f9", text: "#64748b" },
};

// ✅ NEW: Color palette for departments and locations (random allocation)
const ITEM_COLORS = [
  "#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#06b6d4",
  "#f97316", "#6366f1", "#d946ef", "#ea580c", "#14b8a6", "#0891b2"
];

// ✅ Function to get consistent color for an item based on its ID or name
const getItemColor = (item) => {
  if (!item) return ITEM_COLORS[0];
  const id = String(item.id || item.name || "");
  const hash = id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return ITEM_COLORS[hash % ITEM_COLORS.length];
};

const TICKET_VIEWS = [
  { id: "open", label: "Open Tickets", icon: "📬", desc: "All open tickets", filter: t => t.status === "Open" },
  { id: "inprogress", label: "In Progress", icon: "⚙️", desc: "Tickets being worked on", filter: t => t.status === "In Progress" },
  { id: "closed", label: "Closed Tickets", icon: "✅", desc: "Closed & resolved tickets", filter: t => t.status === "Closed" || t.status === "Resolved" },
  { id: "unassigned", label: "Unassigned", icon: "🔸", desc: "Tickets with no assignees", filter: t => !t.assignees || t.assignees.length === 0 },
  { id: "mine", label: "My Tickets", icon: "🙋", desc: "Open/in progress assigned to me", filter: (t, me) => (t.status === "Open" || t.status === "In Progress") && t.assignees?.some(a => a.id === me?.id) },
  { id: "all", label: "All Tickets", icon: "◈", desc: "Every ticket in the system", filter: () => true },
  { id: "alerts", label: "Active Alerts", icon: "🔔", desc: "Critical tickets with active alerts", filter: t => t.priority === "Critical" && t.status !== "Closed" && t.status !== "Resolved" },
  { id: "pastdue", label: "Past Due", icon: "🔴", desc: "Open tickets older than 5 days", filter: t => t.status === "Open" && (Date.now() - new Date(t.created).getTime()) > 5 * 86400000 },
];

const PROJECT_VIEWS = [
  { id: "open", label: "Open Projects", icon: "📂", desc: "All open projects", filter: p => p.status === "Open" },
  { id: "inprogress", label: "In Progress", icon: "⚙️", desc: "Projects being worked on", filter: p => p.status === "In Progress" },
  { id: "closed", label: "Closed Projects", icon: "✅", desc: "Closed & resolved projects", filter: p => p.status === "Closed" || p.status === "Resolved" },
  { id: "unassigned", label: "Unassigned", icon: "👤", desc: "Projects with no assignee", filter: p => (!p.assignees || p.assignees.length === 0) },
  { id: "mine", label: "My Projects", icon: "🙋", desc: "Projects assigned to me", filter: (p, me) => p.assignees?.some(a => a.id === me?.id) },
  { id: "all", label: "All Projects", icon: "◈", desc: "Every project in the system", filter: () => true },
  { id: "critical", label: "Critical", icon: "🔔", desc: "Critical priority projects", filter: p => p.priority === "Critical" && p.status !== "Closed" && p.status !== "Resolved" },
];

// ─── EXPORT HELPERS ────────────────────────────────────────────────────────────
function exportCSV(items, type = "tickets") {
  if (!items || items.length === 0) {
    alert(`No ${type} to export`);
    return;
  }

  let headers = [];
  let rows = [];

  // Determine headers and format based on type
  if (type === "users") {
    headers = ["ID", "Name", "Email", "Phone", "Role", "Active", "Status"];
    rows = items.map(u => [
      u.id,
      `"${u.name || ""}"`,
      u.email || "",
      u.phone || "",
      u.role || "Viewer",
      u.active ? "Yes" : "No",
      u.status || "Logged-Out"
    ]);
  } else if (type === "orgs" || type === "organizations") {
    headers = ["ID", "Name", "Domain", "Phone"];
    rows = items.map(o => [
      o.id,
      `"${o.name || ""}"`,
      o.domain || "",
      o.phone || ""
    ]);
  } else if (type === "categories") {
    headers = ["ID", "Name", "Color"];
    rows = items.map(c => [
      c.id,
      `"${c.name || ""}"`,
      c.color || ""
    ]);
  } else if (type === "projects") {
    headers = ["ID", "Title", "Organisation", "Department", "Reported By", "Assignees", "Priority", "Category", "Status", "Progress", "Due Date", "Created"];
    rows = items.map(t => [
      t.id,
      `"${t.title || ""}"`,
      t.org || "",
      t.department || "",
      t.reportedBy || "",
      `"${(t.assignees || []).map(a => a.name).join("; ")}"`,
      t.priority || "Medium",
      t.category || "",
      t.status || "Open",
      `${t.progress || 0}%`,
      t.dueDate?.toLocaleDateString() || "",
      new Date(t.created).toLocaleString()
    ]);
  } else {
    // Default: tickets
    headers = ["ID", "Summary", "Organisation", "Department", "Contact", "Reported By", "Assignees", "Priority", "Category", "Status", "Created", "Updated"];
    rows = items.map(t => [
      t.id,
      `"${t.summary || ""}"`,
      t.org || "",
      t.department || "",
      t.contact || "",
      t.reportedBy || "",
      `"${(t.assignees || []).map(a => a.name).join("; ")}"`,
      t.priority || "Medium",
      t.category || "",
      t.status || "Open",
      new Date(t.created).toLocaleString(),
      new Date(t.updated).toLocaleString()
    ]);
  }

  const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = `${type}_export_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
}

function exportJSON(items) {
  if (!items || items.length === 0) {
    alert("No data to export");
    return;
  }
  const data = items.map(t => ({ ...t, assignees: (t.assignees || []).map(a => ({ id: a.id, name: a.name, role: a.role })) }));
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  a.download = `export_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
}

function exportPrint(items, type = "tickets") {
  if (!items || items.length === 0) {
    alert(`No ${type} to print`);
    return;
  }

  const isProject = type === "projects";
  const rows = items.map(t => isProject
    ? `<tr><td>${t.id}</td><td>${t.title}</td><td>${t.org}</td><td>${t.priority}</td><td>${t.status}</td><td>${t.progress}%</td><td>${new Date(t.created).toLocaleDateString()}</td></tr>`
    : `<tr><td>${t.id}</td><td>${t.summary}</td><td>${t.org}</td><td>${t.priority}</td><td>${t.status}</td><td>${new Date(t.created).toLocaleDateString()}</td></tr>`
  ).join("");
  const w = window.open("", "_blank");
  w.document.write(`<html><head><title>${type} Export</title><style>body{font-family:sans-serif;font-size:12px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}th{background:#f1f5f9}</style></head><body><h2>${type} Export — ${new Date().toLocaleDateString()}</h2><p>${items.length} ${type}</p><table><thead><tr>${isProject ? "<th>ID</th><th>Title</th><th>Org</th><th>Priority</th><th>Status</th><th>Progress</th><th>Created</th>" : "<th>ID</th><th>Summary</th><th>Org</th><th>Priority</th><th>Status</th><th>Created</th>"}</tr></thead><tbody>${rows}</tbody></table></body></html>`);
  w.document.close();
  w.print();
}

// ─── UI PRIMITIVES ─────────────────────────────────────────────────────────────
const Avatar = ({ name, size = 28 }) => {
  const cols = ["#6366f1", "#ec4899", "#14b8a6", "#f59e0b", "#3b82f6", "#8b5cf6", "#ef4444", "#22c55e"];
  return <div style={{ width: size, height: size, borderRadius: "50%", background: cols[(name?.charCodeAt(0) || 0) % cols.length], display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: size * 0.35, fontWeight: 700, flexShrink: 0 }}>{name?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "?"}</div>;
};
const Badge = ({ label, style = {} }) => <span style={{ padding: "2px 8px", borderRadius: 99, fontSize: 11, fontWeight: 600, ...style }}>{label}</span>;
const iS = { width: "100%", padding: "9px 12px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 14, color: "#1e293b", background: "#fafafa", outline: "none", boxSizing: "border-box", fontFamily: "'DM Sans',sans-serif" };
const sS = { ...iS, cursor: "pointer" };
const bP = { padding: "9px 18px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#3b82f6,#6366f1)", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans',sans-serif" };
const bG = { padding: "9px 14px", borderRadius: 8, border: "1.5px solid #e2e8f0", background: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans',sans-serif", color: "#374151" };

const Modal = ({ open, onClose, title, width = 640, children }) => {
  if (!open) return null;
  return <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16, backdropFilter: "blur(2px)" }} onClick={e => e.target === e.currentTarget && onClose()}>
    <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: width, maxHeight: "90vh", overflow: "auto", boxShadow: "0 25px 60px rgba(0,0,0,0.2)" }}>
      <div style={{ padding: "16px 24px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "#fff", zIndex: 1 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0f172a" }}>{title}</h2>
        <button onClick={onClose} style={{ border: "none", background: "#f1f5f9", borderRadius: 8, width: 32, height: 32, cursor: "pointer", fontSize: 18, color: "#64748b", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
      </div>
      <div style={{ padding: 22 }}>{children}</div>
    </div>
  </div>;
};

// ✅ NEW: Custom Alert Component with beautiful CSS
const CustomAlert = ({ show, message, type, onDismiss }) => {
  if (!show) return null;

  const bgColor = type === "success" ? "#dcfce7" : "#fee2e2";
  const borderColor = type === "success" ? "#86efac" : "#fca5a5";
  const textColor = type === "success" ? "#166534" : "#b91c1c";
  const icon = type === "success" ? "✓" : "✕";

  return (
    <>
      <style>{`
        @keyframes slideInFade {
          0% {
            opacity: 0;
            transform: translateX(30px);
          }
          5% {
            opacity: 1;
            transform: translateX(0);
          }
          95% {
            opacity: 1;
            transform: translateX(0);
          }
          100% {
            opacity: 0;
            transform: translateX(30px);
          }
        }
        .custom-alert {
          animation: slideInFade 3.5s ease-in-out forwards;
        }
      `}</style>
      <div
        className="custom-alert"
        onAnimationEnd={onDismiss}
        style={{
          position: "fixed",
          top: 20,
          right: 20,
          background: bgColor,
          border: `2px solid ${borderColor}`,
          color: textColor,
          padding: "14px 18px",
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          gap: 10,
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          zIndex: 10002,
          maxWidth: "400px",
          wordBreak: "break-word"
        }}>
        <span style={{ fontSize: 16, fontWeight: 700 }}>{icon}</span>
        <span>{message}</span>
      </div>
    </>
  );
};

// ✅ NEW: Full-Screen Confirmation Modal
const ConfirmationModal = ({ show, title, message, onConfirm, onCancel }) => {
  if (!show) return null;

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0, 0, 0, 0.7)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 11000,
      backdropFilter: "blur(4px)"
    }}>
      <div style={{
        background: "#fff",
        borderRadius: 16,
        padding: 32,
        maxWidth: 500,
        width: "90%",
        boxShadow: "0 25px 80px rgba(0,0,0,0.3)",
        animation: "slideDown 0.3s ease-out"
      }}>
        {/* Title */}
        <h2 style={{
          margin: "0 0 12px 0",
          fontSize: 20,
          fontWeight: 700,
          color: "#0f172a"
        }}>
          {title}
        </h2>

        {/* Message */}
        <p style={{
          margin: "0 0 28px 0",
          fontSize: 14,
          color: "#475569",
          lineHeight: 1.6
        }}>
          {message}
        </p>

        {/* Buttons */}
        <div style={{
          display: "flex",
          gap: 12,
          justifyContent: "flex-end"
        }}>
          <button onClick={onCancel} style={{
            padding: "10px 24px",
            borderRadius: 8,
            border: "1.5px solid #e2e8f0",
            background: "#fff",
            color: "#475569",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 600,
            transition: "all 0.2s",
            fontFamily: "'DM Sans', sans-serif"
          }} onMouseOver={e => {
            e.target.style.background = "#f1f5f9";
            e.target.style.borderColor = "#cbd5e1";
          }} onMouseOut={e => {
            e.target.style.background = "#fff";
            e.target.style.borderColor = "#e2e8f0";
          }}>
            Cancel
          </button>

          <button onClick={onConfirm} style={{
            padding: "10px 24px",
            borderRadius: 8,
            border: "none",
            background: "linear-gradient(135deg, #3b82f6, #6366f1)",
            color: "#fff",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 600,
            transition: "all 0.2s",
            fontFamily: "'DM Sans', sans-serif",
            boxShadow: "0 4px 12px rgba(59, 130, 246, 0.3)"
          }} onMouseOver={e => {
            e.target.style.boxShadow = "0 6px 16px rgba(59, 130, 246, 0.4)";
            e.target.style.transform = "translateY(-2px)";
          }} onMouseOut={e => {
            e.target.style.boxShadow = "0 4px 12px rgba(59, 130, 246, 0.3)";
            e.target.style.transform = "translateY(0)";
          }}>
            Confirm
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

const FF = ({ label, required, children }) => <div style={{ marginBottom: 14 }}>
  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#475569", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}{required && <span style={{ color: "#ef4444", marginLeft: 2 }}>*</span>}</label>
  {children}
</div>;

// ─── CHARTS ────────────────────────────────────────────────────────────────────
const BarChart = ({ data, color = "#3b82f6" }) => {
  const [hov, setHov] = useState(null);
  const max = Math.max(...data.map(d => d.value), 1);
  return <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 90, padding: "0 2px", position: "relative" }}>
    {hov !== null && <div style={{ position: "absolute", top: -34, left: "50%", transform: "translateX(-50%)", background: "#0f172a", color: "#fff", borderRadius: 7, padding: "5px 10px", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", zIndex: 10, pointerEvents: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.2)" }}>
      {data[hov]?.label}: <span style={{ color: "#93c5fd" }}>{data[hov]?.value}</span>
    </div>}
    {data.map((d, i) => {
      const h = Math.max((d.value / max) * 72, 2);
      const isHov = hov === i;
      return <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, cursor: "pointer" }}
        onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)}>
        <div style={{ width: "100%", position: "relative", display: "flex", flexDirection: "column", justifyContent: "flex-end", height: 72 }}>
          <div style={{ width: "100%", height: h, background: isHov ? `${color}cc` : color, borderRadius: "4px 4px 0 0", transition: "all 0.15s ease", boxShadow: isHov ? `0 -4px 12px ${color}66` : "none" }} />
        </div>
        <span style={{ fontSize: 9, color: isHov ? "#374151" : "#94a3b8", fontWeight: isHov ? 700 : 400, whiteSpace: "nowrap" }}>{d.label}</span>
      </div>;
    })}
  </div>;
};

const DonutChart = ({ data }) => {
  const [hov, setHov] = useState(null);
  const total = data.reduce((s, d) => s + d.value, 0); let offset = 0;
  const r = 36, circ = 2 * Math.PI * r;
  const segs = data.map(d => { const p = total ? d.value / total : 0; const dash = p * circ; const s = { ...d, dash, gap: circ - dash, offset: offset * circ, pct: Math.round(p * 100) }; offset += p; return s; });
  const hovSeg = hov !== null ? segs[hov] : null;
  return <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
    <div style={{ position: "relative", flexShrink: 0 }}>
      <svg width={90} height={90} viewBox="0 0 90 90">
        <circle cx={45} cy={45} r={r} fill="none" stroke="#f1f5f9" strokeWidth={12} />
        {segs.map((s, i) => (
          <circle key={i} cx={45} cy={45} r={r} fill="none" stroke={s.color} strokeWidth={hov === i ? 16 : 12}
            strokeDasharray={`${s.dash} ${s.gap}`} strokeDashoffset={-s.offset + circ / 4}
            style={{ cursor: "pointer", transition: "stroke-width 0.15s", filter: hov === i ? `drop-shadow(0 0 5px ${s.color}99)` : "none" }}
            onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)} />
        ))}
        <text x={45} y={41} textAnchor="middle" fontSize={hovSeg ? 13 : 12} fontWeight={700} fill={hovSeg ? hovSeg.color : "#1e293b"} fontFamily="DM Sans,sans-serif">{hovSeg ? `${hovSeg.pct}%` : total}</text>
        <text x={45} y={54} textAnchor="middle" fontSize={9} fill="#94a3b8" fontFamily="DM Sans,sans-serif">{hovSeg ? hovSeg.label : "total"}</text>
      </svg>
    </div>
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      {segs.map((s, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer", padding: "3px 6px", borderRadius: 5, background: hov === i ? `${s.color}15` : "transparent", transition: "background 0.15s" }}
          onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)}>
          <div style={{ width: 9, height: 9, borderRadius: 2, background: s.color, flexShrink: 0, transform: hov === i ? "scale(1.4)" : "scale(1)", transition: "transform 0.15s" }} />
          <span style={{ fontSize: 11, color: "#374151", flex: 1, fontWeight: hov === i ? 700 : 400 }}>{s.label}</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: hov === i ? s.color : "#64748b" }}>{s.value}</span>
        </div>
      ))}
    </div>
  </div>;
};

const ProgressBar = ({ value, color = "#3b82f6" }) => (
  <div style={{ width: "100%", height: 6, background: "#f1f5f9", borderRadius: 3, overflow: "hidden" }}>
    <div style={{ width: `${value}%`, height: "100%", background: color, borderRadius: 3, transition: "width 0.3s" }} />
  </div>
);

// ─── SMART CHART ───────────────────────────────────────────────────────────────
const CHART_TYPES = [
  { id: "bar", icon: "▐▌", label: "Bar" }, { id: "line", icon: "╱", label: "Line" }, { id: "pie", icon: "◔", label: "Pie" },
  { id: "area", icon: "◺", label: "Area" },
  { id: "histogram", icon: "▮", label: "Histogram" }, { id: "scatter", icon: "⠿", label: "Scatter" },
  { id: "treemap", icon: "▦", label: "Treemap" }, { id: "bubble", icon: "⬤", label: "Bubble" },
];

const SmartChart = ({ title, data, defaultType = "bar", defaultColor = "#3b82f6" }) => {
  const [type, setType] = useState(defaultType);
  const [showPicker, setShowPicker] = useState(false);
  const [hov, setHov] = useState(null);
  const W = 280, H = 130, PL = 28, PR = 8, PT = 10, PB = 22;
  const IW = W - PL - PR, IH = H - PT - PB;
  const max = Math.max(...data.map(d => d.value), 1);
  const total = data.reduce((s, d) => s + d.value, 0);
  const COLORS = ["#3b82f6", "#f97316", "#22c55e", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f59e0b", "#6366f1"];
  const col = (i, base) => (data[i]?.color) || base || COLORS[i % COLORS.length];
  const toX = i => PL + i * (IW / (data.length - 1 || 1));
  const toXb = i => PL + i * (IW / data.length) + (IW / data.length) * 0.1;
  const bw = IW / data.length * 0.8;
  const toY = v => PT + IH - (v / max) * IH;

  const renderChart = () => {
    if (type === "bar" || type === "histogram") return (
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible" }}>
        {[0, 0.5, 1].map(p => <line key={p} x1={PL} y1={PT + IH * (1 - p)} x2={W - PR} y2={PT + IH * (1 - p)} stroke="#f1f5f9" strokeWidth={1} />)}
        {data.map((d, i) => {
          const bh = Math.max((d.value / max) * IH, 2); const isH = hov === i; return (
            <g key={i} style={{ cursor: "pointer" }} onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)}>
              <rect x={toXb(i)} y={PT + IH - bh} width={bw} height={bh} rx={3} fill={col(i, defaultColor)} opacity={isH ? 1 : 0.85}
                style={{ filter: isH ? `drop-shadow(0 -3px 6px ${col(i, defaultColor)}88)` : "none", transition: "all 0.15s" }} />
              <text x={toXb(i) + bw / 2} y={H - 4} textAnchor="middle" fontSize={7} fill={isH ? "#374151" : "#94a3b8"} fontWeight={isH ? 700 : 400}>{d.label?.slice(0, 6)}</text>
            </g>);
        })}
      </svg>
    );
    if (type === "line" || type === "area") {
      const pts = data.map((d, i) => `${toX(i)},${toY(d.value)}`).join(" ");
      const areaClose = `${toX(data.length - 1)},${PT + IH} ${PL},${PT + IH}`;
      return (<svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible" }}>
        {[0, 0.5, 1].map(p => <line key={p} x1={PL} y1={PT + IH * (1 - p)} x2={W - PR} y2={PT + IH * (1 - p)} stroke="#f1f5f9" strokeWidth={1} />)}
        {type === "area" && <polygon points={`${PL},${PT + IH} ${pts} ${areaClose}`} fill={defaultColor} opacity={0.15} />}
        <polyline points={pts} fill="none" stroke={defaultColor} strokeWidth={2} strokeLinejoin="round" />
        {data.map((d, i) => {
          const isH = hov === i; return (
            <g key={i} style={{ cursor: "pointer" }} onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)}>
              <circle cx={toX(i)} cy={toY(d.value)} r={isH ? 5 : 3} fill={defaultColor} stroke="#fff" strokeWidth={1.5}
                style={{ filter: isH ? `drop-shadow(0 0 4px ${defaultColor})` : "none", transition: "r 0.1s" }} />
              <text x={toX(i)} y={H - 4} textAnchor="middle" fontSize={7} fill={isH ? "#374151" : "#94a3b8"}>{d.label?.slice(0, 5)}</text>
            </g>);
        })}
      </svg>);
    }
    if (type === "pie") {
      let off = 0; const r = 62, cx = 50, cy = 50;
      const segs = data.map(d => { const p = total ? d.value / total : 0; const a = p * Math.PI * 2; const s = { ...d, start: off, end: off + a, pct: Math.round(p * 100) }; off += a; return s; });
      const arc = (s, large) => { const x1 = cx + r * Math.sin(s.start), y1 = cy - r * Math.cos(s.start), x2 = cx + r * Math.sin(s.end), y2 = cy - r * Math.cos(s.end); return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`; };
      return (<div style={{ display: "flex", alignItems: "flex-start", gap: 20, justifyContent: "space-between", width: "100%" }}>
        <svg width={160} height={160} viewBox="0 0 100 100" style={{ flexShrink: 0, overflow: "visible" }}>
          {segs.map((s, i) => {
            const large = s.end - s.start > Math.PI ? 1 : 0; const isH = hov === i; return (
              <g key={i} style={{ cursor: "pointer" }} onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)}>
                <path d={arc(s, large)} fill={col(i, defaultColor)} stroke="#fff" strokeWidth={1.5}
                  style={{ filter: isH ? `drop-shadow(0 2px 6px ${col(i, defaultColor)}88)` : "none", opacity: isH ? 1 : 0.88 }} />
              </g>);
          })}
          <text x={50} y={47} textAnchor="middle" fontSize={12} fontWeight={700} fill={hov !== null ? col(hov, defaultColor) : "#1e293b"}>{hov !== null ? `${segs[hov]?.pct}%` : total}</text>
          <text x={50} y={58} textAnchor="middle" fontSize={7} fill="#94a3b8">{hov !== null ? segs[hov]?.label : "total"}</text>
        </svg>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 140, marginTop: 10 }}>
          {segs.map((s, i) => (<div key={i} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "4px 8px", borderRadius: 4, background: hov === i ? `${col(i, defaultColor)}15` : "transparent", transition: "background 0.12s", whiteSpace: "nowrap" }}
            onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: col(i, defaultColor), flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: "#374151", fontWeight: hov === i ? 700 : 500, flex: 1 }}>{s.label}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: hov === i ? col(i, defaultColor) : "#64748b", minWidth: 30, textAlign: "right" }}>{s.value}</span>
          </div>))}
        </div>
      </div>);
    }
    if (type === "scatter") return (<svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible" }}>
      {[0, 0.5, 1].map(p => <line key={p} x1={PL} y1={PT + IH * (1 - p)} x2={W - PR} y2={PT + IH * (1 - p)} stroke="#f1f5f9" strokeWidth={1} />)}
      {data.map((d, i) => {
        const isH = hov === i; const cx = PL + 10 + (i / (data.length - 1 || 1)) * IW * 0.85; const cy = toY(d.value); return (
          <g key={i} style={{ cursor: "pointer" }} onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)}>
            <circle cx={cx} cy={cy} r={isH ? 6 : 4} fill={col(i, defaultColor)} stroke="#fff" strokeWidth={1.5}
              style={{ filter: isH ? `drop-shadow(0 0 5px ${col(i, defaultColor)})` : "none", transition: "r 0.12s" }} />
            <text x={cx} y={H - 4} textAnchor="middle" fontSize={7} fill={isH ? "#374151" : "#94a3b8"}>{d.label?.slice(0, 5)}</text>
          </g>);
      })}
    </svg>);
    if (type === "bubble") return (<svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible" }}>
      {[0, 0.5, 1].map(p => <line key={p} x1={PL} y1={PT + IH * (1 - p)} x2={W - PR} y2={PT + IH * (1 - p)} stroke="#f1f5f9" strokeWidth={1} />)}
      {data.map((d, i) => {
        const isH = hov === i; const cx = PL + 14 + (i / (data.length - 1 || 1)) * IW * 0.82; const cy = PT + IH * 0.2 + ((i % 3) / 2) * IH * 0.65; const br = Math.max(5, (d.value / max) * 24); return (
          <g key={i} style={{ cursor: "pointer" }} onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)}>
            <circle cx={cx} cy={cy} r={isH ? br * 1.2 : br} fill={col(i, defaultColor)} stroke="#fff" strokeWidth={1.5} opacity={isH ? 0.9 : 0.7}
              style={{ filter: isH ? `drop-shadow(0 0 6px ${col(i, defaultColor)}99)` : "none", transition: "r 0.12s" }} />
            <text x={cx} y={cy + 3} textAnchor="middle" fontSize={Math.max(6, br * 0.5)} fill="#fff" fontWeight={700}>{d.value}</text>
            <text x={cx} y={H - 4} textAnchor="middle" fontSize={7} fill={isH ? "#374151" : "#94a3b8"}>{d.label?.slice(0, 5)}</text>
          </g>);
      })}
    </svg>);
    if (type === "treemap") {
      const sorted = [...data].sort((a, b) => b.value - a.value); let cells = [];
      const layout = (items, x, y, w, h) => { if (!items.length) return; const s = items.reduce((a, b) => a + b.value, 0); let curX = x; items.forEach((d) => { const frac = d.value / s; const cw = Math.max(w * frac, 4); cells.push({ ...d, x, y, w: cw, h, i: cells.length }); x += cw; }); };
      const half = Math.ceil(sorted.length / 2);
      layout(sorted.slice(0, half), PL, PT, IW, IH * 0.55);
      layout(sorted.slice(half), PL, PT + IH * 0.57, IW, IH * 0.43);
      return (<svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible" }}>
        {cells.map((c, i) => {
          const isH = hov === i; return (
            <g key={i} style={{ cursor: "pointer" }} onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)}>
              <rect x={c.x + 1} y={c.y + 1} width={c.w - 2} height={c.h - 2} fill={col(c.i, defaultColor)} rx={3}
                style={{ filter: isH ? `drop-shadow(0 0 5px ${col(c.i, defaultColor)}99)` : "none", opacity: isH ? 1 : 0.8, transition: "opacity 0.12s" }} />
              {c.w > 22 && c.h > 12 && <text x={c.x + c.w / 2} y={c.y + c.h / 2 + 3} textAnchor="middle" fontSize={Math.min(8, c.w / 5)} fill="#fff" fontWeight={600}>{c.label?.slice(0, 6)}</text>}
            </g>);
        })}
      </svg>);
    }
    return null;
  };

  return (
    <div style={{ background: "#fff", borderRadius: 12, padding: "14px 16px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>{title}</span>
        <div style={{ position: "relative" }}>
          <button onClick={() => setShowPicker(!showPicker)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 8px", borderRadius: 6, border: "1px solid #e2e8f0", background: "#f8fafc", cursor: "pointer", fontSize: 11, color: "#374151", fontFamily: "'DM Sans',sans-serif", fontWeight: 500 }}>
            <span>{CHART_TYPES.find(t => t.id === type)?.icon}</span>
            <span>{CHART_TYPES.find(t => t.id === type)?.label}</span>
            <span style={{ fontSize: 9, color: "#94a3b8" }}>▾</span>
          </button>
          {showPicker && <><div style={{ position: "fixed", inset: 0, zIndex: 149 }} onClick={() => setShowPicker(false)} />
            <div style={{ position: "absolute", right: 0, top: "calc(100% + 4px)", background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 10, zIndex: 150, boxShadow: "0 8px 24px rgba(0,0,0,0.14)", minWidth: 140, overflow: "hidden", padding: 4 }}>
              {CHART_TYPES.map(ct => (
                <button key={ct.id} onClick={() => { setType(ct.id); setShowPicker(false); setHov(null); }}
                  style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 10px", border: "none", background: type === ct.id ? "#eff6ff" : "#fff", cursor: "pointer", fontSize: 12, textAlign: "left", fontFamily: "'DM Sans',sans-serif", borderRadius: 6, color: type === ct.id ? "#3b82f6" : "#374151", fontWeight: type === ct.id ? 600 : 400, marginBottom: 1 }}>
                  <span style={{ fontSize: 13, width: 18, textAlign: "center" }}>{ct.icon}</span>{ct.label}
                  {type === ct.id && <span style={{ marginLeft: "auto", color: "#3b82f6", fontWeight: 700 }}>✓</span>}
                </button>
              ))}
            </div>
          </>}
        </div>
      </div>
      <div style={{ position: "relative", paddingTop: 8 }}>
        {hov !== null && type !== "pie" && <div style={{ position: "absolute", top: -2, left: "50%", transform: "translateX(-50%)", background: "#0f172a", color: "#fff", borderRadius: 7, padding: "4px 10px", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", zIndex: 20, pointerEvents: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.25)" }}>
          {data[hov]?.label}: <span style={{ color: "#93c5fd" }}>{data[hov]?.value}</span>
        </div>}
        {renderChart()}
      </div>
    </div>
  );
};

// ─── SESSION HELPERS (12-hour localStorage session) ───────────────────────────
// ✅ IMPORTANT: Role is NOT cached — always fetched from database
const SESSION_KEY = "deskflow_session";
const SESSION_TTL = 12 * 60 * 60 * 1000;

function saveSession(user) {
  try {
    // ✅ KEEP role in cache - role is cached from login
    localStorage.setItem(SESSION_KEY, JSON.stringify({ user, expiresAt: Date.now() + SESSION_TTL }));
  } catch (_) { }
}

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const { user, expiresAt } = JSON.parse(raw);
    if (Date.now() > expiresAt) { localStorage.removeItem(SESSION_KEY); return null; }
    // ✅ Return user WITH role - role is cached from login
    return user;
  } catch (_) { return null; }
}

function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch (_) { }
}

// ─── MAIN APP ──────────────────────────────────────────────────────────────────
export default function HelpDesk() {
  // ── v1 API-driven state ──
  const [users, setUsers] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [customAttrs, setCustomAttrs] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [targetTable, setTargetTable] = useState("tickets");
  const [exportFilterType, setExportFilterType] = useState("all"); // all, assignee, category, type
  const [exportFilterValue, setExportFilterValue] = useState(""); // assignee id, category name, type
  const [exportFormat, setExportFormat] = useState("csv"); // csv, json, pdf

  // ✅ NEW: Advanced Export Modal State
  const [showAdvancedExportModal, setShowAdvancedExportModal] = useState(false);
  const [advancedExportFilters, setAdvancedExportFilters] = useState({
    byAssignee: false,
    byCategory: false,
    byStatus: false,
    byPriority: false,
    byVendor: false,
    byDateRange: false,
    dateFromInput: "",
    dateToInput: "",
    selectedAssignees: [],
    selectedCategories: [],
    selectedStatuses: [],
    selectedPriorities: [],
    selectedVendors: [],
  });
  const [reportTimeRange, setReportTimeRange] = useState("all"); // Time range filter for reports

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  // Restore from localStorage session — survives page reload
  const [currentUser, setCurrentUser] = useState(() => loadSession());

  // ── v2 projects (local state – no API for projects) ──
  const [projects, setProjects] = useState([]);

  // ── Navigation ──
  const [view, setView] = useState(() => {
    try {
      return localStorage.getItem("deskflow_view") || "dashboard";
    } catch {
      return "dashboard";
    }
  });
  const [settingsTab, setSettingsTab] = useState("ticketviews");
  const [tvFilter, setTvFilter] = useState(() => {
    try {
      return localStorage.getItem("deskflow_tvFilter") || "all";
    } catch {
      return "all";
    }
  });
  const [pvFilter, setPvFilter] = useState(() => {
    try {
      return localStorage.getItem("deskflow_pvFilter") || "all";
    } catch {
      return "all";
    }
  });
  const [range, setRange] = useState("all");
  const [dashboardOrg, setDashboardOrg] = useState("all");
  const [dashboardOrgSearch, setDashboardOrgSearch] = useState("");
  const [showDashboardOrgDD, setShowDashboardOrgDD] = useState(false);

  // ✅ NEW: Departments and filters
  const [departments, setDepartments] = useState([]);
  const [deptFilter, setDeptFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [orgFilter, setOrgFilter] = useState("all");
  const [orgFilterSearch, setOrgFilterSearch] = useState("");
  const [showOrgFilterDD, setShowOrgFilterDD] = useState(false);
  const [orgClassifyType, setOrgClassifyType] = useState("all");
  const [newDept, setNewDept] = useState({ name: "" });

  // ✅ NEW: Locations (from database)
  const [locations, setLocations] = useState([]);
  const [newLocation, setNewLocation] = useState({ name: "" });

  // ✅ NEW: Vendor Management
  const [vendors, setVendors] = useState([]);
  const [newVendor, setNewVendor] = useState({ name: "", email: "", phone: "", address: "" });

  // ✅ NEW: Save current view and filters to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("deskflow_view", view);
    } catch (e) {
      console.error("Failed to save view:", e);
    }
  }, [view]);

  useEffect(() => {
    try {
      localStorage.setItem("deskflow_tvFilter", tvFilter);
    } catch (e) {
      console.error("Failed to save tvFilter:", e);
    }
  }, [tvFilter]);

  useEffect(() => {
    try {
      localStorage.setItem("deskflow_pvFilter", pvFilter);
    } catch (e) {
      console.error("Failed to save pvFilter:", e);
    }
  }, [pvFilter]);

  // ── Ticket filters ──
  const [statusF, setStatusF] = useState("All");
  const [priorityF, setPriorityF] = useState("All");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showExport, setShowExport] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const TICKETS_PER_PAGE = 25;
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusF, priorityF, tvFilter, view]);

  // ── Project filters ──
  const [projSearch, setProjSearch] = useState("");
  const [projStatusF, setProjStatusF] = useState("All");
  const [projPriorityF, setProjPriorityF] = useState("All");
  const [selectedProjIds, setSelectedProjIds] = useState(new Set());
  const [showProjExport, setShowProjExport] = useState(false);
  const [showManageTicket, setShowManageTicket] = useState(null);
  const [showManageProject, setShowManageProject] = useState(null);

  // ── Modals ──
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);
  const [selTicket, setSelTicket] = useState(null);
  const [selProject, setSelProject] = useState(null);
  const [selAgent, setSelAgent] = useState(null);

  // ── Satsangs ──
  const [satsangs, setSatsangs] = useState([]);

  // ── Comments ──
  const [newComment, setNewComment] = useState("");
  const [newProjComment, setNewProjComment] = useState("");

  // ── Ticket form ──
  const emptyForm = { org: "", department: "", contact: "", reportedBy: "", summary: "", description: "", assignees: [], priority: "Medium", category: "", customAttrs: {}, dueDate: "", isWebcast: false, satsangType: "", location: "", satsangId: null };
  const [form, setForm] = useState(emptyForm);
  const [ccInput, setCcInput] = useState("");
  const [assigneeSearch, setAssigneeSearch] = useState("");
  const [showTicketAssigneeDD, setShowTicketAssigneeDD] = useState(false);
  const [showProjAssigneeDD, setShowProjAssigneeDD] = useState(false);
  const [showAssigneeDD, setShowAssigneeDD] = useState(false);

  // ✅ NEW: Dropdown search states for department, category, location
  const [departmentSearch, setDepartmentSearch] = useState("");
  const [showDepartmentDD, setShowDepartmentDD] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");
  const [showCategoryDD, setShowCategoryDD] = useState(false);
  const [projCategorySearch, setProjCategorySearch] = useState("");
  const [showProjCategoryDD, setShowProjCategoryDD] = useState(false);
  const [locationSearch, setLocationSearch] = useState("");
  const [showLocationDD, setShowLocationDD] = useState(false);

  // ── Project form ──
  const emptyProjectForm = { org: "", department: "", reportedBy: "", title: "", description: "", assignees: [], priority: "Medium", category: "", status: "Open", location: "", dueDate: "", isWebcast: false, satsangType: "", progress: 0, customAttrs: {}, satsangId: null };
  const [projForm, setProjForm] = useState(emptyProjectForm);
  const [projCcInput, setProjCcInput] = useState("");

  // ── Settings forms ──
  const [newOrg, setNewOrg] = useState({ name: "", domain: "", phone: "" });
  const [newCat, setNewCat] = useState({ name: "", color: "#3b82f6" });
  const [newUser, setNewUser] = useState({ name: "", email: "", password: "", role: "Viewer" });
  const [newAttr, setNewAttr] = useState({ name: "", type: "text", options: "", required: false });

  // ── Inline ticket/project category+attr managers ──
  const [ticketCategories, setTicketCategories] = useState([]);
  const [projectCategories, setProjectCategories] = useState([]);
  const [ticketCustomAttrs, setTicketCustomAttrs] = useState([]);
  const [projectCustomAttrs, setProjectCustomAttrs] = useState([]);
  const [newTicketCat, setNewTicketCat] = useState({ name: "", color: "#3b82f6" });
  const [newProjCat, setNewProjCat] = useState({ name: "", color: "#8b5cf6" });
  const [newTicketAttr, setNewTicketAttr] = useState({ name: "", type: "text", options: "", required: false });
  const [newProjAttr, setNewProjAttr] = useState({ name: "", type: "text", options: "", required: false });

  // ── Auth ──
  const [isLogin, setIsLogin] = useState(true);
  const [authForm, setAuthForm] = useState({ email: "", password: "", firstName: "", middleName: "", lastName: "", countryCode: "+1", phone: "", confirm: "" });
  const [authError, setAuthError] = useState("");
  const [authMessage, setAuthMessage] = useState("");

  // ── Toast Notifications ──
  const [toasts, setToasts] = useState([]);
  const showToast = (message, type = "success", duration = 3000) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  };

  // ── Ticket Edit Mode ──
  const [editMode, setEditMode] = useState(false);
  const [editTicket, setEditTicket] = useState(null);

  // ── Forward ticket ──
  const [showForward, setShowForward] = useState(false);
  const [showVendor, setShowVendor] = useState(false);
  const [fwdType, setFwdType] = useState("Agent");
  const [fwdReason, setFwdReason] = useState("");
  const [fwdTargetAgent, setFwdTargetAgent] = useState("");
  const [forwardAgentSearch, setForwardAgentSearch] = useState("");
  const [showForwardAgentDD, setShowForwardAgentDD] = useState(false);
  const [vendorName, setVendorName] = useState("");
  const [vendorEmail, setVendorEmail] = useState("");
  const [fwdVendorName, setFwdVendorName] = useState("");
  const [fwdVendorEmail, setFwdVendorEmail] = useState("");

  // ✅ NEW: Forward Request Workflow
  const [forwardRequests, setForwardRequests] = useState([]);  // List of forward requests waiting approval
  const [showForwardRequest, setShowForwardRequest] = useState(false);  // Show request form instead of direct forward
  const [showAdminForwardApprovals, setShowAdminForwardApprovals] = useState(false);  // Admin approval modal

  // ✅ NEW: Timeline View
  const [showTimelineView, setShowTimelineView] = useState(false);  // Show full timeline in modal

  // ── Profile ──
  const [profileOpen, setProfileOpen] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({ phone: "", name: "" });
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ oldPassword: "", newPassword: "", confirmPassword: "" });
  const [customAlert, setCustomAlert] = useState({ show: false, message: "", type: "success" });

  // ✅ NEW: Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState({ show: false, title: "", message: "", onConfirm: null, onCancel: null });
  const [selectedTickets, setSelectedTickets] = useState(new Set());
  const [ticketsPerPage, setTicketsPerPage] = useState(10);
  const [showOtherActions, setShowOtherActions] = useState(false);
  const [sortOrder, setSortOrder] = useState("desc"); // "desc" = newest first, "asc" = oldest first

  // ✅ NEW: Admin edit user modal
  const [editUserOpen, setEditUserOpen] = useState(null); // Holds the user being edited
  const [editUserForm, setEditUserForm] = useState({ name: "", email: "", password: "" });

  const statusOpts = [{ l: "Logged-In", c: "#22c55e", bg: "#dcfce7" }, { l: "Logged-Out", c: "#ef4444", bg: "#fee2e2" }, { l: "Rest", c: "#f59e0b", bg: "#fef3c7" }];

  // ── Password strength ──
  const calcPwdStr = (pwd) => { if (!pwd) return 0; let s = 0; if (pwd.length >= 8) s += 25; if (/[A-Z]/.test(pwd)) s += 25; if (/[a-z]/.test(pwd)) s += 25; if (/[^A-Za-z0-9]/.test(pwd)) s += 25; return s; };
  const pwdStr = useMemo(() => calcPwdStr(authForm.password), [authForm.password]);
  const pwdColor = pwdStr <= 25 ? "#ef4444" : pwdStr <= 50 ? "#f59e0b" : pwdStr <= 75 ? "#eab308" : "#22c55e";

  // ─── DATA LOADING ──────────────────────────────────────────────────────────
  const loadData = async () => {
    setLoading(true);
    try {
      // Use axios.get because DB_API is a URL string
      const response = await axios.get(DB_API);
      const data = response.data;

      setUsers(data.users || []);
      setOrgs(data.orgs || []);
      setCategories(data.categories || []);
      setCustomAttrs(data.customAttrs || []);
      setTicketCategories(data.categories || []);
      setProjectCategories(data.categories || []);
      setTicketCustomAttrs(data.customAttrs || []);
      setProjectCustomAttrs(data.customAttrs || []);

      // ✅ NEW: Load departments from database only (NO hardcoded fallback!)
      try {
        const deptResponse = await axios.get(`${BASE_URL}/departments`);
        setDepartments(deptResponse.data || []);
      } catch (e) {
        console.log("Departments loading from API:", e.message);
        // If API fails, set empty array - no hardcoded defaults!
        setDepartments([]);
      }

      // ✅ NEW: Load locations from database
      try {
        const locResponse = await axios.get(LOCATIONS_API);
        setLocations(locResponse.data || []);
      } catch (e) {
        console.log("Locations loading from API:", e.message);
        setLocations([]);
      }

      // ✅ NEW: Load vendors from database
      try {
        const vendResponse = await axios.get(VENDORS_API);
        setVendors(vendResponse.data || []);
      } catch (e) {
        console.log("Vendors loading from API:", e.message);
        setVendors([]);
      }

      const parsedTickets = [
        ...(data.tickets || []),
        ...(data.webcasts || [])
      ].map(t => ({
        ...t,
        created: new Date(t.createdAt || t.created),
        updated: new Date(t.updatedAt || t.updated),
        isWebcast: t.isWebcast || false,
        satsangType: t.satsangType || "",
        location: t.location || ""
      })).sort((a, b) => b.created - a.created);

      setTickets(parsedTickets);
      setSatsangs(data.satsangs || []);

      const parsedProjects = (data.projects || []).map(p => ({
        ...p,
        created: new Date(p.createdAt || p.created),
        updated: new Date(p.updatedAt || p.updated),
        dueDate: p.dueDate ? new Date(p.dueDate) : null,
        isWebcast: p.isWebcast || false,
        progress: p.progress || 0,
        org: p.org || "",
        department: p.department || "",
        reportedBy: p.reportedBy || "",
        category: p.category || "",
        location: p.location || "",
        priority: p.priority || "Medium",
        status: p.status || "Open",
        assignees: Array.isArray(p.assignees) ? p.assignees : [],
        cc: Array.isArray(p.cc) ? p.cc : [],
        customAttrs: p.customAttrs || {},
        satsangId: p.satsangId || null,
        satsangType: p.satsangType || "",
      })).sort((a, b) => b.created - a.created);

      setProjects(parsedProjects);
      setLoading(false); // ✅ MUST set to false on success
    } catch (e) {
      console.error("Error loading data:", e);
      setLoading(false); // ✅ MUST set to false even on error
    }
  };

  // On mount: always load app data; if session existed it was restored above via useState init
  useEffect(() => {
    loadData();
    // Safety timeout - if loading doesn't complete in 5 seconds, stop showing loading screen
    const timeout = setTimeout(() => setLoading(false), 5000);
    return () => clearTimeout(timeout);
  }, []);

  // ✅ NEW: Validate sessions periodically and update user statuses
  const validateSessions = async () => {
    try {
      // Send the current user ID to mark as active
      const activeUserIds = currentUser ? [currentUser.id] : [];
      const response = await axios.post(VALIDATE_SESSIONS_API, { activeUsers: activeUserIds });
      const updatedUsers = response.data || [];
      setUsers(updatedUsers);
    } catch (e) {
      console.error("Error validating sessions:", e);
    }
  };

  // Call validate sessions every 45 seconds
  useEffect(() => {
    if (!currentUser) return;

    // Validate immediately on login
    validateSessions();

    // Then validate periodically
    const interval = setInterval(validateSessions, 45000);
    return () => clearInterval(interval);
  }, [currentUser]);

  // ✅ NEW: Listen for role change broadcasts from other tabs/admins
  useEffect(() => {
    if (!currentUser) return;

    const handleStorageChange = (e) => {
      if (e.key === `role_change_${currentUser.id}`) {
        // Role was changed by admin for current user
        try {
          const data = JSON.parse(e.newValue);
          if (data && data.newRole) {
            setCustomAlert({ show: true, message: `Your role has been changed to ${data.newRole}. Page will refresh automatically.`, type: "success" });
            // Refresh after 2 seconds
            setTimeout(() => window.location.reload(), 2000);
          }
        } catch (error) {
          console.error("Error processing role change notification:", error);
        }
      }

      // ✅ NEW: Listen for logout events from other tabs
      if (e.key === SESSION_KEY && e.newValue === null) {
        // Another tab/window logged out - refresh users list to update status display
        loadData();
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [currentUser]);

  // Calculate project progress based on status
  const getProgressFromStatus = (status) => {
    switch (status) {
      case "Open": return 0;
      case "In Progress": return 25;
      case "Pending": return 50;
      case "Resolved": return 90;
      case "Closed": return 100;
      default: return 0;
    }
  };

  // ✅ NEW: Helper to get display status based on session
  const getDisplayStatus = (user) => {
    // Check if this user is the currently logged-in user
    if (currentUser && currentUser.id === user.id) {
      return "Logged-In";
    }
    // Otherwise, assume logged out
    return "Logged-Out";
  };

  // You can also add this for your dropdowns
  const managersOnly = useMemo(() => {
    return users.filter(u => u.role === "Admin" || u.role === "Manager");
  }, [users]);

  // ─── COMPUTED DATA ─────────────────────────────────────────────────────────
  const now = Date.now(), dayMs = 86400000, rangeMs = range === "all" ? Infinity : parseInt(range) * dayMs;
  const fbr = useMemo(() => {
    const inRange = range === "all" ? tickets : tickets.filter(t => now - t.created.getTime() <= rangeMs);
    if (currentUser?.role === "Admin" || currentUser?.role === "Manager") return inRange;
    return inRange.filter(t => t.reportedBy === currentUser?.name || t.assignees?.some(a => a.id === currentUser?.id));
  }, [tickets, rangeMs, now, currentUser]);

  // ✅ NEW: Dashboard data filtered by organization
  const dashboardData = useMemo(() => {
    let data = fbr;
    if (dashboardOrg !== "all") {
      data = data.filter(t => t.org === dashboardOrg);
    }
    return data;
  }, [fbr, dashboardOrg]);

  // ✅ NEW: Classified reports data based on filters
  const classifiedReportsData = useMemo(() => {
    let data = fbr;

    if (exportFilterType === "assignee" && exportFilterValue) {
      data = data.filter(t => t.assignees?.some(a => a.id === exportFilterValue));
    } else if (exportFilterType === "category" && exportFilterValue) {
      data = data.filter(t => t.category === exportFilterValue);
    } else if (exportFilterType === "type" && exportFilterValue) {
      if (exportFilterValue === "webcast") {
        data = data.filter(t => t.isWebcast === true);
      } else if (exportFilterValue === "ticket") {
        data = data.filter(t => !t.isWebcast);
      }
    } else if (exportFilterType === "status" && exportFilterValue) {
      data = data.filter(t => t.status === exportFilterValue);
    } else if (exportFilterType === "priority" && exportFilterValue) {
      data = data.filter(t => t.priority === exportFilterValue);
    }

    return data;
  }, [fbr, exportFilterType, exportFilterValue]);

  // ✅ NEW: Report time-range filtered data - used for all report graphs
  const reportTimeRangeMs = reportTimeRange === "all" ? Infinity : parseInt(reportTimeRange) * dayMs;
  const reportFilteredData = useMemo(() => {
    return reportTimeRange === "all" ? tickets : tickets.filter(t => now - t.created.getTime() <= reportTimeRangeMs);
  }, [tickets, reportTimeRange, reportTimeRangeMs, now, dayMs]);

  const prbr = useMemo(() => range === "all" ? projects : projects.filter(p => now - p.created.getTime() <= rangeMs), [projects, rangeMs, range, now]);

  const cvd = TICKET_VIEWS.find(v => v.id === tvFilter) || TICKET_VIEWS[5];
  const cpv = PROJECT_VIEWS.find(v => v.id === pvFilter) || PROJECT_VIEWS[5];

  const filtered = useMemo(() => tickets.filter(t => {
    // ✅ Exclude webcast tickets from regular tickets view
    const isWebcastCategory = t.category && (t.category.toLowerCase().includes("webcast") || t.isWebcast);
    if (isWebcastCategory) return false;

    if (!currentUser || !cvd.filter(t, currentUser)) return false;
    // Non-admins only see tickets assigned to them or reported by them
    if (currentUser.role !== "Admin" && t.reportedBy !== currentUser.name && !t.assignees?.some(a => a.id === currentUser.id)) return false;
    if (statusF !== "All" && t.status !== statusF) return false;
    if (priorityF !== "All" && t.priority !== priorityF) return false;
    // ✅ NEW: Apply org and dept filters
    if (orgFilter !== "all" && t.org !== orgFilter) return false;
    if (deptFilter !== "all" && t.department !== deptFilter) return false;
    if (categoryFilter !== "all" && t.category !== categoryFilter) return false;
    if (search) {
      if (search.startsWith("event:")) {
        const id = search.split(":")[1];
        return String(t.satsangId) === id;
      }
      if (!t.summary.toLowerCase().includes(search.toLowerCase()) && !t.id.toLowerCase().includes(search.toLowerCase()) && !t.org.toLowerCase().includes(search.toLowerCase())) return false;
    }
    return true;
  }), [tickets, cvd, currentUser, statusF, priorityF, search, orgFilter, deptFilter, categoryFilter]);

  // ✅ NEW: Filter for webcast tickets only
  const webcastFiltered = useMemo(() => tickets.filter(t => {
    const isWebcastCategory = t.category && (t.category.toLowerCase().includes("webcast") || t.isWebcast);
    if (!isWebcastCategory) return false;

    if (!currentUser || !cvd.filter(t, currentUser)) return false;
    // Non-admins only see tickets assigned to them or reported by them
    if (currentUser.role !== "Admin" && t.reportedBy !== currentUser.name && !t.assignees?.some(a => a.id === currentUser.id)) return false;
    if (statusF !== "All" && t.status !== statusF) return false;
    if (priorityF !== "All" && t.priority !== priorityF) return false;
    if (orgFilter !== "all" && t.org !== orgFilter) return false;
    if (deptFilter !== "all" && t.department !== deptFilter) return false;
    if (search) {
      if (search.startsWith("event:")) {
        const id = search.split(":")[1];
        return String(t.satsangId) === id;
      }
      if (!t.summary.toLowerCase().includes(search.toLowerCase()) && !t.id.toLowerCase().includes(search.toLowerCase()) && !t.org.toLowerCase().includes(search.toLowerCase())) return false;
    }
    return true;
  }), [tickets, cvd, currentUser, statusF, priorityF, search, orgFilter, deptFilter]);

  const totalPages = Math.ceil(filtered.length / TICKETS_PER_PAGE);

  // Sort tickets by created date with configurable order
  const allSortedTickets = [...filtered].sort((a, b) => {
    const dateA = a.created instanceof Date ? a.created.getTime() : new Date(a.created).getTime();
    const dateB = b.created instanceof Date ? b.created.getTime() : new Date(b.created).getTime();
    return sortOrder === "desc" ? dateB - dateA : dateA - dateB;
  });

  // Paginate the sorted list
  const currentTickets = allSortedTickets.slice((currentPage - 1) * TICKETS_PER_PAGE,
    currentPage * TICKETS_PER_PAGE);


  const filteredProjects = useMemo(() => projects.filter(p => {
    if (!cpv.filter(p, currentUser)) return false;
    // Agent/Viewer only see projects assigned to them, Admin/Manager see all
    if ((currentUser?.role === "Agent" || currentUser?.role === "Viewer") && !p.assignees?.some(a => a.id === currentUser?.id)) return false;
    if (projStatusF !== "All" && p.status !== projStatusF) return false;
    if (projPriorityF !== "All" && p.priority !== projPriorityF) return false;
    if (projSearch && !p.title.toLowerCase().includes(projSearch.toLowerCase()) && !p.id.toLowerCase().includes(projSearch.toLowerCase()) && !p.org.toLowerCase().includes(projSearch.toLowerCase())) return false;
    return true;
  }), [projects, cpv, currentUser, projStatusF, projPriorityF, projSearch]);

  const stats = useMemo(() => ({ total: fbr.length, open: fbr.filter(x => x.status === "Open" || x.status === "In Progress").length, inProgress: fbr.filter(x => x.status === "In Progress").length, resolved: fbr.filter(x => x.status === "Resolved" || x.status === "Closed").length, critical: fbr.filter(x => x.priority === "Critical").length }), [fbr]);

  // ✅ NEW: Dashboard stats (filtered by organization)
  const dashboardStats = useMemo(() => ({
    total: dashboardData.length,
    open: dashboardData.filter(x => x.status === "Open" || x.status === "In Progress").length,
    inProgress: dashboardData.filter(x => x.status === "In Progress").length,
    resolved: dashboardData.filter(x => x.status === "Resolved" || x.status === "Closed").length,
    critical: dashboardData.filter(x => x.priority === "Critical").length
  }), [dashboardData]);

  // For dashboard: Agents and Viewers only see stats for projects assigned to them
  const dashboardProjects = useMemo(() => {
    if (currentUser?.role === "Agent" || currentUser?.role === "Viewer") {
      return prbr.filter(p => p.assignees?.some(a => a.id === currentUser?.id));
    }
    return prbr;
  }, [prbr, currentUser]);

  const projStats = useMemo(() => ({ total: dashboardProjects.length, open: dashboardProjects.filter(x => x.status === "Open").length, inProgress: dashboardProjects.filter(x => x.status === "In Progress").length, resolved: dashboardProjects.filter(x => x.status === "Resolved" || x.status === "Closed").length, critical: dashboardProjects.filter(x => x.priority === "Critical").length }), [dashboardProjects]);
  const agentStats = useMemo(() => users.map(u => ({ ...u, assigned: fbr.filter(t => t.assignees?.some(a => a.id === u.id)).length, resolved: fbr.filter(t => t.assignees?.some(a => a.id === u.id) && (t.status === "Resolved" || t.status === "Closed")).length, projAssigned: prbr.filter(p => p.assignees?.some(a => a.id === u.id)).length })), [fbr, prbr, users]);
  const dailyData = useMemo(() => { const days = parseInt(range) <= 7 ? parseInt(range) : 7; return Array.from({ length: days }, (_, i) => { const d = new Date(now - (days - 1 - i) * dayMs); return { label: d.toLocaleDateString("en", { weekday: "short" }), value: fbr.filter(t => t.created.getDate() === d.getDate() && t.created.getMonth() === d.getMonth()).length }; }); }, [fbr, range, now, dayMs]);
  const priorityDist = useMemo(() => PRIORITIES.map(p => ({ label: p, value: fbr.filter(t => t.priority === p).length, color: PRIORITY_COLOR[p] })), [fbr]);
  const categoryDist = useMemo(() => categories.slice(0, 6).map(c => ({ label: c.name, value: fbr.filter(t => t.category === c.name).length, color: c.color })), [fbr, categories]);

  // ✅ NEW: Dashboard-specific chart data (with org filter)
  const dashboardDailyData = useMemo(() => {
    const days = 7;
    return Array.from({ length: days }, (_, i) => {
      const d = new Date(now - (days - 1 - i) * dayMs);
      return {
        label: d.toLocaleDateString("en", { weekday: "short" }),
        value: dashboardData.filter(t => t.created.getDate() === d.getDate() && t.created.getMonth() === d.getMonth()).length
      };
    });
  }, [dashboardData, now, dayMs]);

  const dashboardStatusDist = useMemo(() => {
    const statusCounts = {};
    STATUSES.forEach(s => statusCounts[s] = 0);
    statusCounts["Unassigned"] = 0;

    dashboardData.forEach(t => {
      if (!t.assignees || t.assignees.length === 0) {
        statusCounts["Unassigned"]++;
      } else {
        statusCounts[t.status] = (statusCounts[t.status] || 0) + 1;
      }
    });

    return Object.entries(statusCounts).map(([s, count]) => ({
      label: s,
      color: s === "Unassigned" ? "#94a3b8" : Object.values(STATUS_COLOR)[STATUSES.indexOf(s)]?.text || "#64748b",
      value: count
    }));
  }, [dashboardData]);

  const dashboardClosingUsers = useMemo(() => {
    const closedTickets = dashboardData.filter(t => t.status === "Resolved" || t.status === "Closed");
    const userClosures = {};

    closedTickets.forEach(t => {
      if (t.assignees && t.assignees.length > 0) {
        t.assignees.forEach(a => {
          userClosures[a.name] = (userClosures[a.name] || 0) + 1;
        });
      }
    });

    return Object.entries(userClosures)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, count]) => ({ label: name, value: count }));
  }, [dashboardData]);

  // ✅ NEW: Yearly data for reports (30+ days)
  const yearlyData = useMemo(() => {
    const months = 12;
    const monthlyData = {};

    fbr.forEach(t => {
      const monthKey = t.created.toLocaleDateString("en", { month: "short" });
      monthlyData[monthKey] = (monthlyData[monthKey] || 0) + 1;
    });

    return Array.from({ length: months }, (_, i) => {
      const d = new Date(now - (months - 1 - i) * dayMs * 30);
      const monthKey = d.toLocaleDateString("en", { month: "short" });
      return {
        label: monthKey,
        value: monthlyData[monthKey] || 0
      };
    });
  }, [fbr, now, dayMs]);

  // ─── TICKET HANDLERS (v1 API) ──────────────────────────────────────────────
  const handleSelectiveImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        let payload = [];
        const content = event.target.result;

        if (file.name.endsWith(".csv")) {
          const lines = content.split("\n").filter(l => l.trim() !== "");
          if (lines.length < 2) {
            setCustomAlert({ show: true, message: "CSV file is empty", type: "error" });
            return;
          }

          const headers = lines[0].split(",").map(h => h.trim().toLowerCase());

          payload = lines.slice(1).map(line => {
            const values = line.split(",").map(v => v.trim());
            let row = {};

            // Parse each header and value
            headers.forEach((header, i) => {
              let val = values[i] || "";

              // Remove quotes if present
              if (val.startsWith('"') && val.endsWith('"')) {
                val = val.slice(1, -1);
              }

              // Skip empty values and password
              if (val === "" || header === "password") return;

              // Map field names
              if (header === "organization") {
                row["org"] = val;
              } else if (header === "firstname") {
                row["firstName"] = val;
              } else if (header === "lastname") {
                row["lastName"] = val;
              } else if (header === "middlename") {
                row["middleName"] = val;
              } else if (header === "countrycode") {
                row["countryCode"] = val;
              } else {
                row[header] = val;
              }
            });

            // Apply defaults and validations for users
            if (targetTable === "users") {
              // ✅ FIXED: Generate password automatically if not provided
              if (!row.password) {
                row.password = "TempPass_" + Math.random().toString(36).slice(-10);
              }

              // ✅ Ensure required fields have defaults
              if (!row.name) {
                row.name = `${row.firstName || "User"} ${row.lastName || ""}`.trim() || "Imported User";
              }
              if (!row.email) {
                row.email = `user_${Date.now()}_${Math.random().toString(36).slice(-5)}@imported.local`;
              }

              // ✅ Validate role
              if (row.role) {
                const validRoles = ["Admin", "Manager", "Agent", "Viewer", "Super Admin"];
                const cleaned = row.role.charAt(0).toUpperCase() + row.role.slice(1).toLowerCase();
                row.role = validRoles.includes(cleaned) ? cleaned : "Viewer";
              } else {
                row.role = "Viewer";
              }

              // ✅ Set defaults for optional fields
              if (row.active === undefined || row.active === "") row.active = true;
              if (row.status === undefined || row.status === "") row.status = "Logged-Out";
              if (row.confirmed === undefined || row.confirmed === "") row.confirmed = true;
            }

            return row;
          }).filter(row => row && (row.email || row.name)); // Only include non-empty rows
        } else {
          // JSON import
          payload = JSON.parse(content);
          if (!Array.isArray(payload)) {
            payload = [payload];
          }

          // Apply same defaults for users in JSON
          if (targetTable === "users") {
            payload = payload.map(row => {
              if (!row.password) {
                row.password = "TempPass_" + Math.random().toString(36).slice(-10);
              }
              if (!row.name && row.firstName) {
                row.name = `${row.firstName} ${row.lastName || ""}`.trim();
              }
              if (!row.email) {
                row.email = `user_${Date.now()}_${Math.random().toString(36).slice(-5)}@imported.local`;
              }
              if (row.role) {
                const validRoles = ["Admin", "Manager", "Agent", "Viewer", "Super Admin"];
                const cleaned = row.role.charAt(0).toUpperCase() + row.role.slice(1).toLowerCase();
                row.role = validRoles.includes(cleaned) ? cleaned : "Viewer";
              } else {
                row.role = "Viewer";
              }
              if (row.active === undefined) row.active = true;
              if (row.status === undefined) row.status = "Logged-Out";
              if (row.confirmed === undefined) row.confirmed = true;
              return row;
            });
          }
        }

        // ✅ Map to direct API endpoints
        const API_MAP = {
          tickets: TICKETS_API,
          users: USERS_API,
          orgs: ORGS_API,
          categories: CATEGORIES_API,
          projects: PROJECTS_API
        };

        const apiEndpoint = API_MAP[targetTable];
        if (!apiEndpoint) {
          setCustomAlert({ show: true, message: `Unknown table: ${targetTable}`, type: "error" });
          return;
        }

        // Import each item individually to the database
        let successCount = 0;
        let failedCount = 0;

        for (const item of payload) {
          try {
            await axios.post(apiEndpoint, item);
            successCount++;
          } catch (itemErr) {
            console.error(`Failed to import item:`, item, itemErr);
            failedCount++;
          }
        }

        setCustomAlert({
          show: true,
          message: `✅ ${successCount}/${payload.length} ${targetTable} imported successfully!${failedCount > 0 ? ` (${failedCount} failed)` : ""}`,
          type: successCount > 0 ? "success" : "error"
        });

        if (successCount > 0) {
          loadData();
        }

        e.target.value = null;
      } catch (err) {
        console.error(err);
        setCustomAlert({
          show: true,
          message: "Import failed: " + (err.response?.data?.error || err.message),
          type: "error"
        });
      }
    };
    reader.readAsText(file);
  };

  const handleExport = () => {
    // Map target to the state variables you already have
    const DATA_MAP = {
      tickets: tickets,
      users: users,
      orgs: orgs,
      categories: categories
    };

    let dataToExport = DATA_MAP[targetTable] || [];

    // Apply filters based on export filter type
    if (targetTable === "tickets") {
      if (exportFilterType === "assignee" && exportFilterValue) {
        // Filter by assigned user
        dataToExport = dataToExport.filter(t =>
          t.assignees?.some(a => a.id === exportFilterValue || a.name === exportFilterValue)
        );
      } else if (exportFilterType === "category" && exportFilterValue) {
        // Filter by category
        dataToExport = dataToExport.filter(t => t.category === exportFilterValue);
      } else if (exportFilterType === "type" && exportFilterValue) {
        // Filter by type (ticket, webcast, project)
        if (exportFilterValue === "webcast") {
          dataToExport = dataToExport.filter(t => t.isWebcast === true);
        } else if (exportFilterValue === "ticket") {
          dataToExport = dataToExport.filter(t => !t.isWebcast);
        }
      }
    } else if (targetTable === "users" && exportFilterType === "role" && exportFilterValue) {
      // Filter users by role
      dataToExport = dataToExport.filter(u => u.role === exportFilterValue);
    } else if (targetTable === "orgs" && exportFilterType === "domain" && exportFilterValue) {
      // Filter orgs by domain
      dataToExport = dataToExport.filter(o => o.domain === exportFilterValue);
    } else if (targetTable === "categories" && exportFilterType === "color" && exportFilterValue) {
      // Filter categories by color
      dataToExport = dataToExport.filter(c => c.color === exportFilterValue);
    }

    if (dataToExport.length === 0) {
      alert(`No ${targetTable} data found with selected filter.`);
      return;
    }

    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${targetTable}_export_${exportFilterType !== "all" ? exportFilterValue + "_" : ""}${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleSubmit = async () => {
    if (!form.summary || !form.org) return setCustomAlert({ show: true, message: "Organisation and Summary are required", type: "error" });
    const newT = {
      ...form,
      // ✅ Don't send ID - server will generate TKT-1001, TKT-1002, etc.
      // ✅ Don't send created/updated - Sequelize timestamps handle these
      dueDate: form.dueDate || null,
      status: "Open",
      comments: [],
      timeline: [{ action: "Created", by: currentUser.name, date: new Date().toISOString(), note: "Ticket opened." }]
    };
    try {
      const res = await axios.post(TICKETS_API, newT);
      const created = res.data;
      const ticketWithDates = {
        ...created,
        created: new Date(created.createdAt || created.created || new Date()),
        updated: new Date(created.updatedAt || created.updated || new Date())
      };
      setTickets(prev => [ticketWithDates, ...prev]);
      setSelTicket(ticketWithDates);  // ✅ Auto-open ticket details
      setShowNewTicket(false);
      setForm(emptyForm);
      setAssigneeSearch("");
      setShowAssigneeDD(false);
      setCustomAlert({ show: true, message: "✅ Ticket created successfully!", type: "success" });
      // ✅ Animation handles fade-out automatically (3.5s)
    } catch (e) {
      setCustomAlert({ show: true, message: "Failed to save ticket: " + (e.response?.data?.error || e.message), type: "error" });
    }
  };

  const deleteTicket = async (id) => {
    setConfirmModal({
      show: true,
      title: "Delete Ticket?",
      message: "Are you sure you want to delete this ticket? This action cannot be undone and all associated data will be lost.",
      onConfirm: async () => {
        try {
          await axios.delete(`${TICKETS_API}/${id}`);
          setTickets(prev => prev.filter(t => t.id !== id));
          setSelTicket(null);
          setCustomAlert({ show: true, message: "Ticket deleted successfully", type: "success" });
          setConfirmModal({ show: false, title: "", message: "", onConfirm: null, onCancel: null });
        } catch (e) {
          setCustomAlert({ show: true, message: "Failed to delete ticket: " + (e.response?.data?.error || e.message), type: "error" });
          setConfirmModal({ show: false, title: "", message: "", onConfirm: null, onCancel: null });
        }
      },
      onCancel: () => {
        setConfirmModal({ show: false, title: "", message: "", onConfirm: null, onCancel: null });
      }
    });
  };

  const toggleAssignee = u => { const e = form.assignees.find(a => a.id === u.id); setForm({ ...form, assignees: e ? form.assignees.filter(a => a.id !== u.id) : [...form.assignees, u] }); };
  const addCC = () => { if (ccInput && !form.cc.includes(ccInput)) { setForm({ ...form, cc: [...form.cc, ccInput] }); setCcInput(""); } };

  const updateStatus = async (id, status) => {
    const t = tickets.find(x => x.id === id); if (!t) return;
    try {
      const nowISO = new Date().toISOString();
      const newTimelineEvent = { action: `Status changed to ${status}`, by: currentUser.name, date: nowISO, note: "" };
      const updatedT = { ...t, status, updated: nowISO, timeline: [...(t.timeline || []), newTimelineEvent] };
      await axios.put(`${TICKETS_API}/${id}`, updatedT);
      setTickets(p => p.map(x => x.id === id ? { ...updatedT, updated: new Date(nowISO) } : x));
      if (selTicket?.id === id) setSelTicket({ ...updatedT, updated: new Date(nowISO) });
    } catch (e) { alert("Failed to update"); }
  };

  const toggleSel = id => { const s = new Set(selectedIds); s.has(id) ? s.delete(id) : s.add(id); setSelectedIds(s); };
  const toggleAll = () => selectedIds.size === filtered.length && filtered.length > 0 ? setSelectedIds(new Set()) : setSelectedIds(new Set(filtered.map(t => t.id)));
  const selTickets = filtered.filter(t => selectedIds.has(t.id));

  // ─── FORWARD TICKET (v3 - ROLE-BASED) ───────────────────────────────────────────────────

  // ✅ Main forward handler - checks role
  const handleForwardTicket = async (agentId) => {
    if (!fwdReason.trim()) return setCustomAlert({ show: true, message: "Reason is required", type: "error" });
    if (!agentId) return setCustomAlert({ show: true, message: "Please select an agent", type: "error" });

    const agent = users.find(u => u.id === agentId);
    const nowISO = new Date().toISOString();

    // ✅ If Admin or Manager - forward directly
    if (currentUser?.role === "Admin" || currentUser?.role === "Manager") {
      try {
        const update = {
          ...selTicket,
          assignees: [agent],
          updated: nowISO,
          timeline: [
            ...(selTicket.timeline || []),
            {
              action: `✉️ Forwarded to Agent: ${agent.name}`,
              by: currentUser.name,
              date: nowISO,
              note: `Role: ${currentUser.role} | Reason: ${fwdReason}`
            }
          ]
        };

        await axios.put(`${TICKETS_API}/${selTicket.id}`, update);
        setTickets(p => p.map(x => x.id === selTicket.id ? { ...update, updated: new Date(nowISO) } : x));
        setSelTicket({ ...update, updated: new Date(nowISO) });

        setShowForward(false);
        setFwdReason("");
        setFwdTargetAgent("");
        setCustomAlert({ show: true, message: "✅ Ticket forwarded successfully!", type: "success" });
      } catch (e) {
        setCustomAlert({ show: true, message: "Failed to forward ticket", type: "error" });
      }
    }
    // ✅ If Agent or Viewer - create request
    else {
      const forwardRequest = {
        id: `FWD-${Date.now()}`,
        ticketId: selTicket.id,
        ticketSummary: selTicket.summary,
        fromUser: currentUser.name,
        fromRole: currentUser.role,
        toAgent: agent,
        reason: fwdReason,
        status: "Pending",
        createdAt: new Date().toISOString(),
        approvedBy: null,
        approvedAt: null
      };

      setForwardRequests(prev => [forwardRequest, ...prev]);
      setShowForward(false);
      setFwdReason("");
      setFwdTargetAgent("");
      setCustomAlert({ show: true, message: "✅ Forward request sent to admin for approval", type: "success" });
    }
  };

  // ✅ Admin approves forward request
  const approveForwardRequest = async (request) => {
    const t = selTicket;
    const nowISO = new Date().toISOString();

    try {
      const update = {
        ...t,
        assignees: [request.toAgent],
        updated: nowISO,
        timeline: [
          ...(t.timeline || []),
          {
            action: `✉️ Forwarded to Agent: ${request.toAgent.name}`,
            by: currentUser.name,
            date: nowISO,
            note: `Request from ${request.fromRole} ${request.fromUser}. Reason: ${request.reason}`
          }
        ]
      };

      await axios.put(`${TICKETS_API}/${t.id}`, update);
      setTickets(p => p.map(x => x.id === t.id ? { ...update, updated: new Date(nowISO) } : x));
      setSelTicket({ ...update, updated: new Date(nowISO) });

      setForwardRequests(prev => prev.map(r =>
        r.id === request.id
          ? { ...r, status: "Approved", approvedBy: currentUser.name, approvedAt: nowISO }
          : r
      ));

      setCustomAlert({ show: true, message: "✅ Forward request approved", type: "success" });
    } catch (e) {
      setCustomAlert({ show: true, message: "Failed to approve forward", type: "error" });
    }
  };

  // ✅ Admin rejects forward request
  const rejectForwardRequest = (request) => {
    setForwardRequests(prev => prev.map(r =>
      r.id === request.id
        ? { ...r, status: "Rejected", approvedBy: currentUser.name, approvedAt: new Date().toISOString() }
        : r
    ));
    setCustomAlert({ show: true, message: "✅ Forward request rejected", type: "success" });
  };

  const handleSendForRepair = async (vendorName, contactInfo) => {
    if (!vendorName) return alert("Vendor name is required.");
    if (!fwdReason.trim()) return alert("Reason is required.");
    const t = selTicket;
    try {
      const nowISO = new Date().toISOString();
      const update = { ...t, status: "Pending", updated: nowISO, timeline: [...(t.timeline || []), { action: `Sent for Repair: ${vendorName}`, by: currentUser.name, date: nowISO, note: `Contact: ${contactInfo}\nReason: ${fwdReason}` }] };
      await axios.put(`${TICKETS_API}/${t.id}`, update);
      setTickets(p => p.map(x => x.id === t.id ? { ...update, updated: new Date(nowISO) } : x));
      setSelTicket({ ...update, updated: new Date(nowISO) });
    } catch (e) { alert("Repair update failed"); }
  };

  const handleForward = () => {
    if (fwdType === "Agent") handleForwardToAgent(fwdTargetAgent);
    else handleSendForRepair(fwdVendorName, fwdVendorEmail);
  };

  // ─── SETTINGS HANDLERS (v1 API) ────────────────────────────────────────────
  const addOrg = async () => {
    if (!newOrg.name) return;
    try {
      const res = await axios.post(ORGS_API, newOrg);
      const created = res.data; // ✅ Extract the actual data
      setOrgs([...orgs, created]); // Update state immediately
      setNewOrg({ name: "", domain: "", phone: "" });
    } catch (err) { console.error(err); }
  };

  const addCat = async () => {
    if (!newCat.name) return;
    try {
      const res = await axios.post(CATEGORIES_API, newCat);
      const created = res.data; // ✅ Extract the actual data
      setCategories([...categories, created]);
      setNewCat({ name: "", color: "#3b82f6" });
    } catch (err) { console.error(err); }
  };
  const addUser = async () => {
    if (!newUser.name || !newUser.email || !newUser.password) {
      setCustomAlert({ show: true, message: "Name, email, and password are required", type: "error" });
      return;
    }
    if (newUser.password.length < 6) {
      setCustomAlert({ show: true, message: "Password must be at least 6 characters", type: "error" });
      return;
    }
    try {
      // Admin is setting the password for the user
      const response = await axios.post(USERS_API, {
        ...newUser,
        active: true,
        status: "Logged-Out"
      });

      const created = response.data;
      setUsers([...users, created]);

      // ✅ Custom success alert instead of system alert
      setCustomAlert({ show: true, message: `User "${created.name}" created successfully with temporary password`, type: "success" });

      // Reset form
      setNewUser({ name: "", email: "", password: "", role: "Viewer" });

      // Auto-hide success alert after 3 seconds
    } catch (err) {
      console.error("Error adding user:", err);
      setCustomAlert({ show: true, message: err.message || "Failed to add user", type: "error" });
    }
  };

  // ✅ NEW: Change Password Function
  const changePassword = async () => {
    if (!passwordForm.oldPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setCustomAlert({ show: true, message: "All password fields are required", type: "error" });
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setCustomAlert({ show: true, message: "New passwords do not match", type: "error" });
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setCustomAlert({ show: true, message: "Password must be at least 6 characters", type: "error" });
      return;
    }

    // ✅ Show custom confirmation modal instead of window.confirm
    setConfirmModal({
      show: true,
      title: "Change Password?",
      message: "Are you sure you want to change your password? This action cannot be undone.",
      onConfirm: async () => {
        try {
          await axios.put(`${USERS_API}/${currentUser.id}`, {
            ...currentUser,
            password: passwordForm.newPassword,
            oldPassword: passwordForm.oldPassword
          });

          setCustomAlert({ show: true, message: "Password changed successfully!", type: "success" });
          setShowChangePassword(false);
          setPasswordForm({ oldPassword: "", newPassword: "", confirmPassword: "" });
          setConfirmModal({ show: false, title: "", message: "", onConfirm: null, onCancel: null });

          // Auto-hide success alert after 3 seconds
        } catch (err) {
          console.error("Error changing password:", err);
          setCustomAlert({ show: true, message: err.message || "Failed to change password", type: "error" });
          setConfirmModal({ show: false, title: "", message: "", onConfirm: null, onCancel: null });
        }
      },
      onCancel: () => {
        setConfirmModal({ show: false, title: "", message: "", onConfirm: null, onCancel: null });
      }
    });
  };
  // --- ORGANIZATIONS ---
  const deleteOrg = async (id) => {
    setConfirmModal({
      show: true,
      title: "Delete Organization?",
      message: "Are you sure you want to delete this organization? All associated data will be permanently removed. This action cannot be undone.",
      onConfirm: async () => {
        try {
          await axios.delete(`${ORGS_API}/${id}`);
          setOrgs(prev => prev.filter(o => o.id !== id));
          setCustomAlert({ show: true, message: "Organization deleted successfully", type: "success" });
          setConfirmModal({ show: false, title: "", message: "", onConfirm: null, onCancel: null });
        } catch (err) {
          console.error("Error deleting organization:", err);
          setCustomAlert({ show: true, message: "Failed to delete organization", type: "error" });
          setConfirmModal({ show: false, title: "", message: "", onConfirm: null, onCancel: null });
        }
      },
      onCancel: () => {
        setConfirmModal({ show: false, title: "", message: "", onConfirm: null, onCancel: null });
      }
    });
  };

  // --- CATEGORIES ---
  const deleteCat = async (id) => {
    if (!id || typeof id === 'object') {
      setCustomAlert({ show: true, message: "Cannot delete: This category has no valid ID. It is likely corrupted data.", type: "error" });
      return;
    }

    setConfirmModal({
      show: true,
      title: "Delete Category?",
      message: "Are you sure you want to delete this category? All tickets associated with this category will be affected. This action cannot be undone.",
      onConfirm: async () => {
        try {
          await axios.delete(`${CATEGORIES_API}/${id}`);
          setCategories(prev => prev.filter(c => c.id !== id && c._id !== id));
          setTicketCategories(prev => prev.filter(c => c.id !== id && c._id !== id));
          setCustomAlert({ show: true, message: "Category deleted successfully", type: "success" });
          setConfirmModal({ show: false, title: "", message: "", onConfirm: null, onCancel: null });
        } catch (err) {
          console.error("Error deleting category:", err);
          setCustomAlert({ show: true, message: "Failed to delete category", type: "error" });
          setConfirmModal({ show: false, title: "", message: "", onConfirm: null, onCancel: null });
        }
      },
      onCancel: () => {
        setConfirmModal({ show: false, title: "", message: "", onConfirm: null, onCancel: null });
      }
    });
  };

  // --- USERS ---
  const deleteUser = async (id) => {
    const user = users.find(u => u.id === id);
    setConfirmModal({
      show: true,
      title: `Delete ${user?.name}?`,
      message: `Are you sure you want to delete ${user?.name}? This user account and all associated data will be permanently removed. This action cannot be undone.`,
      onConfirm: async () => {
        try {
          await axios.delete(`${USERS_API}/${id}`);
          setUsers(prev => prev.filter(u => u.id !== id));
          setCustomAlert({ show: true, message: `${user?.name} deleted successfully`, type: "success" });
          setConfirmModal({ show: false, title: "", message: "", onConfirm: null, onCancel: null });
        } catch (err) {
          console.error("Error deleting user:", err);
          setCustomAlert({ show: true, message: "Failed to delete user", type: "error" });
          setConfirmModal({ show: false, title: "", message: "", onConfirm: null, onCancel: null });
        }
      },
      onCancel: () => {
        setConfirmModal({ show: false, title: "", message: "", onConfirm: null, onCancel: null });
      }
    });
  };

  // ✅ NEW: Admin can edit user name and password
  const editUser = async () => {
    if (!editUserForm.name) {
      alert("Name is required");
      return;
    }
    if (editUserForm.password && editUserForm.password.length < 6) {
      alert("Password must be at least 6 characters");
      return;
    }

    try {
      const updates = {
        name: editUserForm.name,
        email: editUserForm.email
      };
      // Only send password if it was changed
      if (editUserForm.password) {
        updates.password = editUserForm.password;
      }

      await axios.put(`${USERS_API}/${editUserOpen.id}`, updates);
      setUsers(users.map(u => u.id === editUserOpen.id ? { ...u, ...updates } : u));

      alert(`${editUserForm.name}'s profile has been updated.`);
      setEditUserOpen(null);
      setEditUserForm({ name: "", email: "", password: "" });
    } catch (err) {
      console.error("Error editing user:", err);
      alert("Failed to update user.");
    }
  };

  const addAttr = async () => {
    if (!newAttr.name) return;
    try {
      const payload = {
        ...newAttr,
        options: typeof newAttr.options === "string"
          ? newAttr.options.split(",").map(s => s.trim()).filter(Boolean)
          : []
      };

      // Send POST request to CUSTOM_ATTRS_API URL
      const response = await axios.post(CUSTOM_ATTRS_API, payload);

      const created = response.data;
      setCustomAttrs([...customAttrs, created]);
      setNewAttr({ name: "", type: "text", options: "", required: false });
    } catch (err) {
      console.error("Error adding attribute:", err);
      alert("Failed to add attribute.");
    }
  };

  // ✅ NEW: Delete Custom Attribute
  const deleteAttr = async (id) => {
    if (!window.confirm("Delete this custom attribute?")) return;
    try {
      await axios.delete(`${CUSTOM_ATTRS_API}/${id}`);
      setCustomAttrs(customAttrs.filter(a => a.id !== id));
      setCustomAlert({ show: true, message: "✅ Attribute deleted!", type: "success" });
    } catch (err) {
      console.error("Error deleting attribute:", err);
      setCustomAlert({ show: true, message: "Failed to delete attribute", type: "error" });
    }
  };

  // ─── PROJECT HANDLERS (v1 API) ────────────────────────────────────────────
  const handleProjectSubmit = async () => {
    if (!projForm.title || !projForm.org) return setCustomAlert({ show: true, message: "Organisation and Title are required", type: "error" });
    const newP = {
      ...projForm,
      // ✅ Don't send ID - server will generate PRJ-1001, PRJ-1002, etc.
      // ✅ Don't send created/updated - Sequelize timestamps handle these
      status: projForm.status || "Open",
      dueDate: projForm.dueDate || null,
      comments: [],
      progress: projForm.progress || 0,
      tasks: projForm.tasks || []
    };
    try {
      const res = await axios.post(PROJECTS_API, newP);
      const created = res.data;
      const projectWithDates = { ...created, created: new Date(created.createdAt || created.created), updated: new Date(created.updatedAt || created.updated), dueDate: created.dueDate ? new Date(created.dueDate) : null };
      setProjects(prev => [projectWithDates, ...prev]);
      setSelProject(projectWithDates);  // ✅ Auto-open project details
      setShowNewProject(false);
      setProjForm(emptyProjectForm);
      setCustomAlert({ show: true, message: "✅ Project created successfully!", type: "success" });
      // ✅ Animation handles fade-out automatically (3.5s)
    } catch (e) {
      setCustomAlert({ show: true, message: "Failed to save project: " + (e.response?.data?.error || e.message), type: "error" });
    }
  };
  const addProjCC = () => { if (projCcInput && !projForm.cc.includes(projCcInput)) { setProjForm({ ...projForm, cc: [...projForm.cc, projCcInput] }); setProjCcInput(""); } };
  const updateProjectStatus = async (id, status) => {
    const p = projects.find(x => x.id === id); if (!p) return;
    try {
      const nowISO = new Date().toISOString();
      const updated = { ...p, status, updated: nowISO };
      await axios.put(`${PROJECTS_API}/${id}`, updated);
      setProjects(prev => prev.map(x => x.id === id ? { ...updated, updated: new Date(nowISO) } : x));
      if (selProject?.id === id) setSelProject(s => ({ ...s, status, updated: new Date(nowISO) }));
    } catch (e) { alert("Failed to update project status"); }
  };

  const deleteProject = async (id) => {
    if (!window.confirm("Delete this project? This cannot be undone.")) return;
    try {
      await axios.delete(`${PROJECTS_API}/${id}`);
      setProjects(prev => prev.filter(p => p.id !== id));
      setSelProject(null);
    } catch (e) {
      alert("Failed to delete project: " + (e.response?.data?.error || e.message));
    }
  };

  // ✅ NEW: Department management functions
  const addDept = async () => {
    if (!newDept?.name?.trim()) {
      setCustomAlert({ show: true, message: "Department name required", type: "error" });
      return;
    }
    try {
      const dept = await axios.post(`${BASE_URL}/departments`, newDept);
      setDepartments([...departments, dept.data]);
      setNewDept({ name: "" });
      setCustomAlert({ show: true, message: "✅ Department added!", type: "success" });
    } catch (e) {
      setCustomAlert({ show: true, message: "Failed to add department", type: "error" });
    }
  };

  const deleteDept = async (id) => {
    if (!window.confirm("Delete this department?")) return;
    try {
      await axios.delete(`${BASE_URL}/departments/${id}`);
      setDepartments(departments.filter(d => d.id !== id));
      setCustomAlert({ show: true, message: "✅ Department deleted!", type: "success" });
    } catch (e) {
      setCustomAlert({ show: true, message: "Failed to delete department", type: "error" });
    }
  };

  // ── LOCATION MANAGEMENT ──
  const addLocation = async () => {
    if (!newLocation?.name?.trim()) {
      setCustomAlert({ show: true, message: "Location name required", type: "error" });
      return;
    }
    try {
      const loc = await axios.post(LOCATIONS_API, newLocation);
      setLocations([...locations, loc.data]);
      setNewLocation({ name: "" });
      setCustomAlert({ show: true, message: "✅ Location added!", type: "success" });
    } catch (e) {
      setCustomAlert({ show: true, message: "Failed to add location", type: "error" });
    }
  };

  const deleteLocation = async (id) => {
    if (!window.confirm("Delete this location?")) return;
    try {
      await axios.delete(`${LOCATIONS_API}/${id}`);
      setLocations(locations.filter(l => l.id !== id));
      setCustomAlert({ show: true, message: "✅ Location deleted!", type: "success" });
    } catch (e) {
      setCustomAlert({ show: true, message: "Failed to delete location", type: "error" });
    }
  };

  // ✅ NEW: Vendor Management Functions
  const addVendor = async () => {
    if (!newVendor?.name?.trim()) {
      setCustomAlert({ show: true, message: "Vendor name required", type: "error" });
      return;
    }
    try {
      const vend = await axios.post(VENDORS_API, newVendor);
      setVendors([...vendors, vend.data]);
      setNewVendor({ name: "", email: "", phone: "", address: "" });
      setCustomAlert({ show: true, message: "✅ Vendor added!", type: "success" });
    } catch (e) {
      setCustomAlert({ show: true, message: "Failed to add vendor", type: "error" });
    }
  };

  const deleteVendor = async (id) => {
    if (!window.confirm("Delete this vendor?")) return;
    try {
      await axios.delete(`${VENDORS_API}/${id}`);
      setVendors(vendors.filter(v => v.id !== id));
      setCustomAlert({ show: true, message: "✅ Vendor deleted!", type: "success" });
    } catch (e) {
      setCustomAlert({ show: true, message: "Failed to delete vendor", type: "error" });
    }
  };

  const toggleProjSel = id => { const s = new Set(selectedProjIds); s.has(id) ? s.delete(id) : s.add(id); setSelectedProjIds(s); };
  const toggleAllProj = () => selectedProjIds.size === filteredProjects.length && filteredProjects.length > 0 ? setSelectedProjIds(new Set()) : setSelectedProjIds(new Set(filteredProjects.map(p => p.id)));
  const selProjects = filteredProjects.filter(p => selectedProjIds.has(p.id));
  const addTicketCat = async () => {
    if (!newTicketCat.name) return;
    try {
      const res = await axios.post(CATEGORIES_API, newTicketCat);
      const created = res.data;
      setTicketCategories(prev => [...prev, created]);
      setCategories(prev => [...prev, created]);
      setNewTicketCat({ name: "", color: "#3b82f6" });
    } catch (e) { alert("Failed to add category"); }
  };
  const addProjCat = async () => {
    if (!newProjCat.name) return;
    try {
      const res = await axios.post(CATEGORIES_API, newProjCat);
      const created = res.data;
      setProjectCategories(prev => [...prev, created]);
      setCategories(prev => [...prev, created]);
      setNewProjCat({ name: "", color: "#8b5cf6" });
    } catch (e) { alert("Failed to add project category"); }
  };
  const addTicketAttr = async () => {
    if (!newTicketAttr.name) return;
    try {
      const payload = { ...newTicketAttr, options: typeof newTicketAttr.options === "string" ? newTicketAttr.options.split(",").map(s => s.trim()).filter(Boolean) : [] };
      const res = await axios.post(CUSTOM_ATTRS_API, payload);
      const created = res.data;
      setTicketCustomAttrs(prev => [...prev, created]);
      setCustomAttrs(prev => [...prev, created]);
      setNewTicketAttr({ name: "", type: "text", options: "", required: false });
    } catch (e) { alert("Failed to add attribute"); }
  };
  const addProjAttr = async () => {
    if (!newProjAttr.name) return;
    try {
      const payload = { ...newProjAttr, options: typeof newProjAttr.options === "string" ? newProjAttr.options.split(",").map(s => s.trim()).filter(Boolean) : [] };
      const res = await axios.post(CUSTOM_ATTRS_API, payload);
      const created = res.data;
      setProjectCustomAttrs(prev => [...prev, created]);
      setCustomAttrs(prev => [...prev, created]);
      setNewProjAttr({ name: "", type: "text", options: "", required: false });
    } catch (e) { alert("Failed to add project attribute"); }
  };

  // ─── AUTH HANDLERS (v1) ────────────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError("");
    setAuthMessage("");

    try {
      // 1. Post to the login endpoint with credentials
      const response = await axios.post(AUTH_API, {
        email: authForm.email,
        password: authForm.password
      });

      const u = response.data;

      // 2. Check if user is deactivated
      if (!u.active) {
        setAuthError("Your account has been deactivated. Please contact an administrator.");
        return;
      }

      // 3. ✅ FIXED: Update status to Logged-In in DB so other users see it
      const updatedUser = { ...u, status: "Logged-In" };
      await axios.put(`${USERS_API}/${u.id}`, updatedUser);

      // 4. Cache in session and local state
      saveSession(updatedUser);
      setCurrentUser(updatedUser);

      // 5. Reload all data
      await loadData();

    } catch (err) {
      console.error("Login error:", err);
      setAuthError(err.response?.data?.error || err.message);
    }
  };

  const handleLogout = async () => {
    if (currentUser) {
      // ✅ FIXED: Update status in DB so other tabs/users see the logout
      try {
        await axios.put(`${USERS_API}/${currentUser.id}`, { ...currentUser, status: "Logged-Out" });
      }
      catch (e) { console.error("Logout status update failed"); }
    }
    clearSession();
    setCurrentUser(null); setProfileOpen(false);
  };

  const handleSignup = async (e) => {
    e.preventDefault(); setAuthError(""); setAuthMessage("");
    if (authForm.password !== authForm.confirm) return setAuthError("Passwords do not match");
    if (!authForm.firstName || !authForm.lastName || !authForm.email || !authForm.password) return setAuthError("Please fill required fields");
    try {
      // Use already-loaded users state — no extra API call needed.
      // Avoids the GET /api/users 404 entirely.
      const isFirstUser = users.length === 0;

      const payload = {
        // Bug fix 2: don't pre-assign an id — let the backend assign it.
        // Some APIs reject records that come with a client-generated id.
        name: `${authForm.firstName} ${authForm.middleName ? authForm.middleName + " " : ""}${authForm.lastName}`.trim(),
        email: authForm.email,
        phone: `${authForm.countryCode} ${authForm.phone}`.trim(),
        password: authForm.password,
        role: isFirstUser ? "Super Admin" : "Viewer",
        active: true,
        status: "Logged-Out",
        confirmed: true,
      };

      await axios.post(USERS_API, payload);
      setAuthMessage(`Account created! You are registered as ${payload.role}. Please log in.`);
      await loadData();

      // Bug fix 3: reset authForm to a clean login state (keep email pre-filled,
      // clear password fields) so the user can log in immediately after the flip.
      setAuthForm(prev => ({
        ...prev,
        password: "",
        confirm: "",
        firstName: "",
        middleName: "",
        lastName: "",
        phone: "",
      }));
      setTimeout(() => setIsLogin(true), 1500);
    } catch (err) {
      // Bug fix 4: always surface the real error so it's debuggable.
      setAuthError(err?.message || "Registration failed. Please try again.");
    }
  };

  // ─── PROFILE HANDLERS (v1) ─────────────────────────────────────────────────
  const saveProfile = async () => {
    try {
      const up = { ...currentUser, phone: profileForm.phone, name: profileForm.name };
      await axios.put(`${USERS_API}/${currentUser.id}`, up);
      saveSession(up); setCurrentUser(up); setUsers(users.map(u => u.id === currentUser.id ? up : u)); setEditProfileOpen(false);
    } catch (err) { alert("Failed to save profile"); }
  };
  const updateStatusDirect = async (st) => {
    try {
      const up = { ...currentUser, status: st };
      await axios.put(`${USERS_API}/${currentUser.id}`, up);
      saveSession(up); setCurrentUser(up); setUsers(users.map(u => u.id === currentUser.id ? up : u));
    } catch (err) { alert("Failed to update status"); }
  };

  // ─── NAVIGATION HELPERS ────────────────────────────────────────────────────
  const sideNav = (currentUser?.role === "Admin" || currentUser?.role === "Manager") ? [
    { id: "dashboard", label: "Dashboard", icon: "▦" },
    { id: "tickets", label: "All Tickets", icon: "◈" },
    { id: "projects", label: "Projects", icon: "📁" },
    { id: "webcast", label: "Webcast", icon: "📡" },
    { id: "reports", label: "Reports", icon: "◉" },
    { id: "users", label: "Agents", icon: "◎" },
    { id: "settings", label: "Settings", icon: "⚙" },
  ] : [
    { id: "dashboard", label: "Dashboard", icon: "▦" },
    { id: "tickets", label: "All Tickets", icon: "◈" },
    { id: "projects", label: "Projects", icon: "📁" },
    { id: "webcast", label: "Webcast", icon: "📡" },
    { id: "settings", label: "Settings", icon: "⚙" },
  ];
  const stabs = currentUser?.role === "Admin" ? [
    { id: "ticketviews", label: "Ticket Views", icon: "👁" },
    { id: "projectviews", label: "Project Views", icon: "📂" },
    { id: "organisations", label: "Organisations", icon: "🏢" },
    { id: "categories", label: "Categories", icon: "🏷" },
    { id: "departments", label: "Departments", icon: "🏛" },
    { id: "locations", label: "Locations", icon: "📍" },
    { id: "vendors", label: "Vendors", icon: "🏭" },
    { id: "usermgmt", label: "User Management", icon: "👥" },
    { id: "customattrs", label: "Custom Attributes", icon: "✏️" },
    { id: "dbmgmt", label: "Database Mgmt", icon: "💾" },
  ] : currentUser?.role === "Manager" ? [
    { id: "ticketviews", label: "Ticket Views", icon: "👁" },
    { id: "projectviews", label: "Project Views", icon: "📂" },
    { id: "organisations", label: "Organisations", icon: "🏢" },
    { id: "categories", label: "Categories", icon: "🏷" },
    { id: "departments", label: "Departments", icon: "🏛" },
    { id: "locations", label: "Locations", icon: "📍" },
    { id: "vendors", label: "Vendors", icon: "🏭" },
    { id: "usermgmt", label: "User Management", icon: "👥" },
    { id: "customattrs", label: "Custom Attributes", icon: "✏️" },
  ] : [
    { id: "ticketviews", label: "Ticket Views", icon: "👁" },
    { id: "projectviews", label: "Project Views", icon: "📂" },
  ];
  const getPageTitle = () => {
    if (view === "dashboard") return "Dashboard";
    if (view === "tickets") return cvd.label;
    if (view === "projects") return cpv.label;
    if (view === "webcast") return "Webcast";
    if (view === "reports") return "Reports";
    if (view === "users") return "Agents";
    return "Settings";
  };

  const thStyle = { padding: "9px 11px", textAlign: "left", fontSize: 10, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #f1f5f9", whiteSpace: "nowrap" };
  const tdStyle = { padding: "10px 11px", borderBottom: "1px solid #f8fafc", fontSize: 13 };

  // Webcast fields shared component
  const WebcastFields = ({ f, setF }) => <>
    <div style={{ padding: "12px 14px", background: "#fff7ed", borderRadius: 9, border: "1px solid #fed7aa", marginBottom: 14 }}>
      <label style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer" }}>
        <input type="checkbox" checked={f.isWebcast} onChange={e => setF({ ...f, isWebcast: e.target.checked })} style={{ width: 15, height: 15, cursor: "pointer" }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: "#9a3412" }}>📡 Webcast / Live Ticket</span>
      </label>
      {f.isWebcast && <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 14px" }}>
        <div style={{ gridColumn: "1 / -1" }}>
          <FF label="Associate Satsang Record">
            <select style={sS} value={f.satsangId || ""} onChange={e => {
              const sid = e.target.value;
              const s = satsangs.find(x => String(x.id) === sid);
              if (s) {
                setF({ ...f, satsangId: s.id, summary: f.summary || s.name, satsangType: s.type, location: s.location });
              } else {
                setF({ ...f, satsangId: null });
              }
            }}>
              <option value="">-- Link to an event (Optional) --</option>
              {satsangs.map(s => <option key={s.id} value={s.id}>{s.date} - {s.name} ({s.location})</option>)}
            </select>
          </FF>
        </div>
        <FF label="Satsang Type"><select style={sS} value={f.satsangType} onChange={e => setF({ ...f, satsangType: e.target.value })}><option value="">Select type…</option>{SATSANG_TYPES.map(t => <option key={t}>{t}</option>)}</select></FF>
        <FF label="Location / Venue"><select style={sS} value={f.location} onChange={e => setF({ ...f, location: e.target.value })}><option value="">Select venue…</option>{locations.map(l => <option key={l.id}>{l.name}</option>)}</select></FF>
      </div>}
    </div>
  </>;

  // ─── LOADING SCREEN ─────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans',sans-serif", background: "#f8fafc", color: "#64748b", fontSize: 18, fontWeight: 600 }}>
      Loading DeskFlow Data...
    </div>
  );

  // ─── AUTH SCREENS ──────────────────────────────────────────────────────────
  if (!currentUser) return (
    <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center", background: "#f8fafc", fontFamily: "'DM Sans',sans-serif", perspective: "1000px", position: "relative", overflow: "hidden" }}>
      {/* Background Image with Opacity */}
      <div style={{
        position: "absolute",
        inset: 0,
        backgroundImage: 'url("/res/login_page_bg.jpeg")',
        backgroundSize: "fill",
        backgroundPosition: "center",
        opacity: 0.6,
        zIndex: 0
      }} />
      <div style={{ width: "100%", maxWidth: 400, position: "relative", transition: "transform 0.6s cubic-bezier(0.4,0,0.2,1)", transformStyle: "preserve-3d", transform: isLogin ? "rotateY(0deg)" : "rotateY(-180deg)", zIndex: 1 }}>

        {/* FRONT: LOGIN */}
        <div style={{ background: "rgba(255, 255, 255, 0.45)", backdropFilter: "blur(20px)", padding: 40, borderRadius: 20, boxShadow: "0 10px 40px rgba(0,0,0,0.12)", backfaceVisibility: "hidden", position: isLogin ? "relative" : "absolute", top: 0, left: 0, width: "100%", border: "1px solid rgba(255, 255, 255, 0.3)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 30 }}>
            <div style={{ width: 44, height: 44, background: "linear-gradient(135deg,#3b82f6,#8b5cf6)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: "#fff" }}>⚡</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#0f172a" }}>DeskFlow</div>
          </div>
          <div style={{ display: "flex", background: "#f1f5f9", borderRadius: 10, padding: 4, marginBottom: 24 }}>
            <button onClick={() => { setIsLogin(true); setAuthError(""); setAuthMessage(""); }} style={{ flex: 1, padding: "8px", border: "none", borderRadius: 8, background: "#fff", boxShadow: "0 2px 4px rgba(0,0,0,0.05)", cursor: "pointer", fontWeight: 600, color: "#0f172a" }}>Login</button>
            <button onClick={() => { setIsLogin(false); setAuthError(""); setAuthMessage(""); }} style={{ flex: 1, padding: "8px", border: "none", borderRadius: 8, background: "transparent", cursor: "pointer", fontWeight: 600, color: "#64748b" }}>Signup</button>
          </div>
          {authError && <div style={{ padding: "10px 14px", background: "#fee2e2", color: "#ef4444", borderRadius: 8, fontSize: 13, marginBottom: 16, fontWeight: 500 }}>{authError}</div>}
          {authMessage && <div style={{ padding: "10px 14px", background: "#dcfce7", color: "#15803d", borderRadius: 8, fontSize: 13, marginBottom: 16, fontWeight: 500 }}>{authMessage}</div>}
          <form onSubmit={handleLogin}>
            <FF label="Email"><input type="email" required style={iS} value={authForm.email} onChange={e => setAuthForm({ ...authForm, email: e.target.value })} /></FF>
            <FF label="Password"><input type="password" required style={iS} value={authForm.password} onChange={e => setAuthForm({ ...authForm, password: e.target.value })} /></FF>
            <button type="submit" style={{ ...bP, width: "100%", marginTop: 10, padding: 12 }}>Log In</button>
            <div style={{ marginTop: 16, textAlign: "center" }}><button type="button" onClick={() => { setIsLogin(false); setAuthError(""); setAuthMessage(""); }} style={{ ...bG, border: "none", color: "#64748b", padding: 0, fontSize: 12 }}>Need an account? Sign up</button></div>
          </form>
        </div>

        {/* BACK: SIGNUP */}
        <div style={{ background: "rgba(255, 255, 255, 0.45)", backdropFilter: "blur(20px)", padding: 40, borderRadius: 20, boxShadow: "0 10px 40px rgba(0,0,0,0.12)", backfaceVisibility: "hidden", transform: "rotateY(180deg)", position: !isLogin ? "relative" : "absolute", top: 0, left: 0, width: "100%", border: "1px solid rgba(255, 255, 255, 0.3)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 30 }}>
            <div style={{ width: 44, height: 44, background: "linear-gradient(135deg,#3b82f6,#8b5cf6)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: "#fff" }}>⚡</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#0f172a" }}>DeskFlow</div>
          </div>
          <div style={{ display: "flex", background: "#f1f5f9", borderRadius: 10, padding: 4, marginBottom: 24 }}>
            <button onClick={() => { setIsLogin(true); setAuthError(""); setAuthMessage(""); }} style={{ flex: 1, padding: "8px", border: "none", borderRadius: 8, background: "transparent", cursor: "pointer", fontWeight: 600, color: "#64748b" }}>Login</button>
            <button onClick={() => { setIsLogin(false); setAuthError(""); setAuthMessage(""); }} style={{ flex: 1, padding: "8px", border: "none", borderRadius: 8, background: "#fff", boxShadow: "0 2px 4px rgba(0,0,0,0.05)", cursor: "pointer", fontWeight: 600, color: "#0f172a" }}>Signup</button>
          </div>
          {authError && <div style={{ padding: "10px 14px", background: "#fee2e2", color: "#ef4444", borderRadius: 8, fontSize: 13, marginBottom: 16, fontWeight: 500 }}>{authError}</div>}
          {authMessage && <div style={{ padding: "10px 14px", background: "#dcfce7", color: "#15803d", borderRadius: 8, fontSize: 13, marginBottom: 16, fontWeight: 500 }}>{authMessage}</div>}
          <form onSubmit={handleSignup}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 10px" }}>
              <FF label="First Name" required><input required style={iS} value={authForm.firstName} onChange={e => setAuthForm({ ...authForm, firstName: e.target.value })} /></FF>
              <FF label="Last Name" required><input required style={iS} value={authForm.lastName} onChange={e => setAuthForm({ ...authForm, lastName: e.target.value })} /></FF>
            </div>
            <FF label="Middle Name (Optional)"><input style={iS} value={authForm.middleName} onChange={e => setAuthForm({ ...authForm, middleName: e.target.value })} /></FF>
            <FF label="Phone"><div style={{ display: "flex", gap: 6 }}>
              <select style={{ ...sS, width: 70, padding: "9px 6px" }} value={authForm.countryCode} onChange={e => setAuthForm({ ...authForm, countryCode: e.target.value })}>
                <option value="+1">+1</option><option value="+44">+44</option><option value="+91">+91</option><option value="+61">+61</option><option value="+81">+81</option>
              </select>
              <input style={{ ...iS, flex: 1 }} value={authForm.phone} onChange={e => setAuthForm({ ...authForm, phone: e.target.value })} />
            </div></FF>
            <FF label="Email"><input type="email" required style={iS} value={authForm.email} onChange={e => setAuthForm({ ...authForm, email: e.target.value })} /></FF>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 10px" }}>
              <FF label="Password" required>
                <input type="password" required style={{ ...iS, border: authForm.password && authForm.password !== authForm.confirm ? "1px solid #ef4444" : "1px solid #e2e8f0" }} value={authForm.password} onChange={e => setAuthForm({ ...authForm, password: e.target.value })} />
                <div style={{ marginTop: 4, height: 4, background: "#e2e8f0", borderRadius: 2, overflow: "hidden" }}><div style={{ height: "100%", width: `${pwdStr}%`, background: pwdColor, transition: "all 0.3s" }} /></div>
              </FF>
              <FF label="Confirm" required><input type="password" required style={{ ...iS, border: authForm.confirm && authForm.password !== authForm.confirm ? "1px solid #ef4444" : "1px solid #e2e8f0" }} value={authForm.confirm} onChange={e => setAuthForm({ ...authForm, confirm: e.target.value })} /></FF>
            </div>
            {authForm.confirm && authForm.password !== authForm.confirm && <div style={{ color: "#ef4444", fontSize: 11, marginTop: -6, marginBottom: 10 }}>Passwords do not match</div>}
            <button type="submit" disabled={authForm.password !== authForm.confirm} style={{ ...bP, width: "100%", marginTop: 4, padding: 12, opacity: authForm.password !== authForm.confirm ? 0.5 : 1 }}>Sign Up</button>
            <div style={{ marginTop: 12, textAlign: "center" }}><button type="button" onClick={() => { setIsLogin(true); setAuthError(""); setAuthMessage(""); }} style={{ ...bG, border: "none", color: "#64748b", padding: 0, fontSize: 12 }}>Already have an account? Log in</button></div>
          </form>
        </div>
      </div>
    </div>
  );

  // ─── MAIN APP ──────────────────────────────────────────────────────────────
  // ✅ NEW: Show loading screen only while actually loading or no user
  if (loading || !currentUser) {
    return (
      <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center", background: "#f8fafc", fontFamily: "'DM Sans',sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 20, animation: "spin 1s linear infinite" }}>⚡</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: "#0f172a", marginBottom: 8 }}>DeskFlow</div>
          <div style={{ fontSize: 14, color: "#64748b", marginBottom: 20 }}>Loading your dashboard...</div>
          <div style={{ width: 40, height: 4, background: "#e2e8f0", borderRadius: 2, margin: "0 auto", overflow: "hidden" }}>
            <div style={{ height: "100%", background: "linear-gradient(90deg, #3b82f6, #6366f1)", animation: "loading 1.5s ease-in-out infinite", width: "30%" }}></div>
          </div>
        </div>
        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes loading {
            0%, 100% { transform: translateX(-100%); }
            50% { transform: translateX(400%); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "'DM Sans',sans-serif", background: "#f8fafc", color: "#1e293b", overflow: "hidden" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');*{box-sizing:border-box}::-webkit-scrollbar{width:5px;height:5px}::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:3px}input:focus,select:focus,textarea:focus{border-color:#3b82f6!important;outline:none;background:#fff!important}.rh:hover td{background:#f8fafc!important}@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>

      {/* ✅ NEW: Custom Alert */}
      <CustomAlert
        show={customAlert.show}
        message={customAlert.message}
        type={customAlert.type}
        onDismiss={() => setCustomAlert({ show: false, message: "", type: "success" })}
      />

      {/* ✅ NEW: Confirmation Modal */}
      <ConfirmationModal
        show={confirmModal.show}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={confirmModal.onCancel}
      />

      {/* ✅ NEW: Advanced Export Modal */}
      {showAdvancedExportModal && <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000 }}>
        <div style={{ background: "#fff", borderRadius: 14, padding: 24, maxWidth: 600, width: "90%", maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6, color: "#1e293b" }}>Advanced Export Options</div>
          <div style={{ fontSize: 13, color: "#64748b", marginBottom: 18 }}>Select the filters you want to apply when exporting</div>

          {/* Export Format */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Export Format</label>
            <div style={{ display: "flex", gap: 8 }}>
              {["csv", "json", "pdf"].map(fmt => (
                <button key={fmt} onClick={() => setExportFormat(fmt)} style={{ padding: "8px 16px", borderRadius: 8, border: fmt === exportFormat ? "2px solid #3b82f6" : "1px solid #e2e8f0", background: fmt === exportFormat ? "#eff6ff" : "#fff", cursor: "pointer", fontWeight: 600, fontSize: 12, color: fmt === exportFormat ? "#3b82f6" : "#64748b" }}>
                  {fmt === "csv" ? "📄 CSV" : fmt === "json" ? "📋 JSON" : "🖨 PDF"}
                </button>
              ))}
            </div>
          </div>

          {/* Filter Checkboxes */}
          <div style={{ marginBottom: 18, borderTop: "1px solid #f1f5f9", paddingTop: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 10 }}>Filter Options:</div>

            <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, cursor: "pointer" }}>
              <input type="checkbox" checked={advancedExportFilters.byAssignee} onChange={e => setAdvancedExportFilters({ ...advancedExportFilters, byAssignee: e.target.checked })} style={{ width: 18, height: 18, cursor: "pointer" }} />
              <span style={{ fontSize: 13, fontWeight: 500 }}>Export by Assignee</span>
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, cursor: "pointer" }}>
              <input type="checkbox" checked={advancedExportFilters.byCategory} onChange={e => setAdvancedExportFilters({ ...advancedExportFilters, byCategory: e.target.checked })} style={{ width: 18, height: 18, cursor: "pointer" }} />
              <span style={{ fontSize: 13, fontWeight: 500 }}>Export by Category</span>
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, cursor: "pointer" }}>
              <input type="checkbox" checked={advancedExportFilters.byStatus} onChange={e => setAdvancedExportFilters({ ...advancedExportFilters, byStatus: e.target.checked })} style={{ width: 18, height: 18, cursor: "pointer" }} />
              <span style={{ fontSize: 13, fontWeight: 500 }}>Export by Status</span>
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, cursor: "pointer" }}>
              <input type="checkbox" checked={advancedExportFilters.byPriority} onChange={e => setAdvancedExportFilters({ ...advancedExportFilters, byPriority: e.target.checked })} style={{ width: 18, height: 18, cursor: "pointer" }} />
              <span style={{ fontSize: 13, fontWeight: 500 }}>Export by Priority</span>
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, cursor: "pointer" }}>
              <input type="checkbox" checked={advancedExportFilters.byVendor} onChange={e => setAdvancedExportFilters({ ...advancedExportFilters, byVendor: e.target.checked })} style={{ width: 18, height: 18, cursor: "pointer" }} />
              <span style={{ fontSize: 13, fontWeight: 500 }}>Export by Vendor</span>
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, cursor: "pointer" }}>
              <input type="checkbox" checked={advancedExportFilters.byDateRange} onChange={e => setAdvancedExportFilters({ ...advancedExportFilters, byDateRange: e.target.checked })} style={{ width: 18, height: 18, cursor: "pointer" }} />
              <span style={{ fontSize: 13, fontWeight: 500 }}>Export by Date Range</span>
            </label>

            {advancedExportFilters.byDateRange && (
              <div style={{ background: "#f8fafc", padding: 12, borderRadius: 8, marginLeft: 28, marginTop: 8 }}>
                <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>From Date</label>
                    <input type="date" value={advancedExportFilters.dateFromInput} onChange={e => setAdvancedExportFilters({ ...advancedExportFilters, dateFromInput: e.target.value })} style={{ ...iS, width: "100%", fontSize: 12 }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>To Date</label>
                    <input type="date" value={advancedExportFilters.dateToInput} onChange={e => setAdvancedExportFilters({ ...advancedExportFilters, dateToInput: e.target.value })} style={{ ...iS, width: "100%", fontSize: 12 }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", borderTop: "1px solid #f1f5f9", paddingTop: 14 }}>
            <button onClick={() => setShowAdvancedExportModal(false)} style={{ ...bG, padding: "8px 16px", fontSize: 13 }}>Cancel</button>
            <button onClick={() => {
              // Filter data based on advanced options
              let dataToExport = reportFilteredData;

              if (advancedExportFilters.byDateRange && advancedExportFilters.dateFromInput && advancedExportFilters.dateToInput) {
                const fromDate = new Date(advancedExportFilters.dateFromInput).getTime();
                const toDate = new Date(advancedExportFilters.dateToInput).getTime();
                dataToExport = dataToExport.filter(t => {
                  const tDate = t.created.getTime();
                  return tDate >= fromDate && tDate <= toDate + 86400000;
                });
              }

              if (exportFormat === "csv") {
                exportCSV(dataToExport, "tickets");
              } else if (exportFormat === "json") {
                exportJSON(dataToExport);
              } else if (exportFormat === "pdf") {
                exportPrint(dataToExport, "tickets");
              }

              setShowAdvancedExportModal(false);
            }} style={{ ...bP, padding: "8px 16px", fontSize: 13, background: "#3b82f6", color: "#fff" }}>⬇️ Export Now</button>
          </div>
        </div>
      </div>}

      {/* ── SIDEBAR ─────────────────────────────────────────────────────── */}
      <div style={{ width: 220, background: "#0f172a", display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "18px 18px 14px", borderBottom: "1px solid #1e293b" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, background: "linear-gradient(135deg,#3b82f6,#8b5cf6)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "#fff" }}>⚡</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>DeskFlow</div>
              <div style={{ fontSize: 10, color: "#475569" }}>Help Desk Pro</div>
            </div>
          </div>
        </div>

        <div style={{ padding: "8px 8px 0", flex: 1, overflow: "auto" }}>
          {sideNav.map(n => (
            <button key={n.id} onClick={() => {
              setView(n.id);
              // ✅ NEW: When clicking "All Tickets", set filter to "all" (all statuses)
              if (n.id === "tickets") setTvFilter("all");
            }} style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "8px 11px", borderRadius: 7, border: "none", cursor: "pointer", background: view === n.id ? "#1e293b" : "transparent", color: view === n.id ? "#60a5fa" : "#64748b", fontSize: 13, fontWeight: view === n.id ? 600 : 400, marginBottom: 2, textAlign: "left", fontFamily: "'DM Sans',sans-serif" }}>
              <span>{n.icon}</span>{n.label}
            </button>
          ))}
          {view === "tickets" && <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid #1e293b" }}>
            {TICKET_VIEWS.map(v => (
              <button key={v.id} onClick={() => setTvFilter(v.id)} style={{ display: "flex", alignItems: "center", gap: 7, width: "100%", padding: "6px 11px", borderRadius: 6, border: "none", cursor: "pointer", background: tvFilter === v.id ? "#0f172a" : "transparent", color: tvFilter === v.id ? "#93c5fd" : "#475569", fontSize: 11.5, textAlign: "left", fontFamily: "'DM Sans',sans-serif", marginBottom: 1 }}>
                <span style={{ fontSize: 12 }}>{v.icon}</span>{v.label}
              </button>
            ))}
          </div>}
          {view === "projects" && <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid #1e293b" }}>
            {PROJECT_VIEWS.map(v => (
              <button key={v.id} onClick={() => setPvFilter(v.id)} style={{ display: "flex", alignItems: "center", gap: 7, width: "100%", padding: "6px 11px", borderRadius: 6, border: "none", cursor: "pointer", background: pvFilter === v.id ? "#0f172a" : "transparent", color: pvFilter === v.id ? "#93c5fd" : "#475569", fontSize: 11.5, textAlign: "left", fontFamily: "'DM Sans',sans-serif", marginBottom: 1 }}>
                <span style={{ fontSize: 12 }}>{v.icon}</span>{v.label}
              </button>
            ))}
          </div>}
        </div>

        {/* New Ticket / Project buttons */}
        <div style={{ padding: "8px 8px 10px", display: "flex", flexDirection: "column", gap: 5 }}>
          <button onClick={() => setShowNewTicket(true)} style={{ width: "100%", padding: "8px", borderRadius: 9, border: "none", background: "linear-gradient(135deg,#3b82f6,#6366f1)", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>+ New Ticket</button>
          <button onClick={() => setShowNewProject(true)} style={{ width: "100%", padding: "8px", borderRadius: 9, border: "1.5px solid #1e40af", background: "transparent", color: "#60a5fa", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", display: (currentUser?.role === "Admin" || currentUser?.role === "Manager") ? "block" : "none" }}>+ New Project</button>
        </div>

        {/* Profile section (v1 full profile panel) */}
        <div style={{ padding: "8px 12px 14px", borderTop: "1px solid #1e293b" }}>
          <div onClick={() => setProfileOpen(!profileOpen)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px", borderRadius: 8, cursor: "pointer", background: profileOpen ? "#1e293b" : "transparent", transition: "background 0.2s" }}>
            <Avatar name={currentUser.name} size={30} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{currentUser.name}</div>
              <div style={{ fontSize: 10, color: "#94a3b8", display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: (statusOpts.find(s => s.l === (currentUser.status === "Active" ? "Logged-In" : (currentUser.status === "Not Active" || currentUser.status?.toLowerCase() === "logged-out") ? "Logged-Out" : currentUser.status))?.c || "#94a3b8") }} />
                {currentUser.role}
              </div>
            </div>
            <span style={{ color: "#475569", fontSize: 12 }}>{profileOpen ? "▴" : "▾"}</span>
          </div>
          {profileOpen && (
            <div style={{ marginTop: 8, background: "#1e293b", borderRadius: 8, padding: "8px" }}>
              <button onClick={() => { setProfileForm({ name: currentUser.name, phone: currentUser.phone || "" }); setEditProfileOpen(true); }} style={{ width: "100%", padding: "6px 10px", background: "#334155", border: "none", borderRadius: 6, color: "#f8fafc", fontSize: 12, fontWeight: 600, cursor: "pointer", marginBottom: 8, textAlign: "left" }}>👤 View Profile</button>
              <div style={{ fontSize: 10, fontWeight: 600, color: "#94a3b8", marginBottom: 6, textTransform: "uppercase", padding: "0 4px" }}>Set Status</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {statusOpts.filter(s => s.l !== "Logged-Out").map(s => (
                  <button key={s.l} onClick={() => updateStatusDirect(s.l)} style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "none", padding: "4px 8px", borderRadius: 4, cursor: "pointer", color: currentUser.status === s.l ? s.c : "#cbd5e1" }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.c, boxShadow: currentUser.status === s.l ? `0 0 0 2px ${s.bg}` : "none" }} />
                    <span style={{ fontSize: 11, fontWeight: currentUser.status === s.l ? 700 : 500 }}>{s.l}</span>
                  </button>
                ))}
              </div>
              <button onClick={handleLogout} style={{ width: "100%", padding: "6px 10px", background: "transparent", border: "none", color: "#ef4444", fontSize: 12, fontWeight: 600, cursor: "pointer", marginTop: 8, textAlign: "left", borderTop: "1px solid #334155", paddingTop: 8 }}>Log Out</button>
            </div>
          )}
        </div>
      </div>

      {/* Profile Edit Modal (v1) */}
      <Modal open={editProfileOpen} onClose={() => setEditProfileOpen(false)} title="My Profile" width={400}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
          <Avatar name={currentUser.name} size={64} />
          <div><div style={{ fontSize: 18, fontWeight: 700, color: "#0f172a" }}>{currentUser.name}</div><div style={{ fontSize: 13, color: "#64748b" }}>{currentUser.role}</div></div>
        </div>
        <div style={{ marginBottom: 18, padding: "10px 14px", background: "#f8fafc", borderRadius: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", marginBottom: 2 }}>Email Address (Unchangeable)</div>
          <div style={{ fontSize: 13, color: "#334155", fontWeight: 500 }}>{currentUser.email}</div>
        </div>
        <FF label="Full Name"><input style={iS} value={profileForm.name} onChange={e => setProfileForm({ ...profileForm, name: e.target.value })} /></FF>
        <FF label="Phone Number"><input style={iS} value={profileForm.phone} onChange={e => setProfileForm({ ...profileForm, phone: e.target.value })} /></FF>

        {/* ✅ NEW: Change Password Section */}
        <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid #e2e8f0" }}>
          <button onClick={() => setShowChangePassword(!showChangePassword)} style={{ width: "100%", padding: "10px 14px", background: "#f0f9ff", border: "1px solid #bfdbfe", borderRadius: 8, color: "#0c4a6e", fontWeight: 600, cursor: "pointer", fontSize: 13, marginBottom: 12 }}>
            {showChangePassword ? "Hide Change Password" : "Change Password"}
          </button>

          {showChangePassword && (
            <div style={{ background: "#fef9c3", padding: 14, borderRadius: 8, marginBottom: 12, border: "1px solid #fcd34d" }}>
              <FF label="Current Password"><input style={iS} type="password" value={passwordForm.oldPassword} onChange={e => setPasswordForm({ ...passwordForm, oldPassword: e.target.value })} placeholder="Enter your current password" /></FF>
              <FF label="New Password"><input style={iS} type="password" value={passwordForm.newPassword} onChange={e => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} placeholder="Enter new password (min 6 characters)" /></FF>
              <FF label="Confirm New Password"><input style={iS} type="password" value={passwordForm.confirmPassword} onChange={e => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })} placeholder="Re-enter new password" /></FF>
              <button onClick={changePassword} style={{ ...bP, width: "100%" }}>Change Password</button>
            </div>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
          <button onClick={() => setEditProfileOpen(false)} style={bG}>Cancel</button>
          <button onClick={saveProfile} style={bP}>Save Changes</button>
        </div>
      </Modal>

      {/* ✅ NEW: Admin Edit User Modal (Name & Password) */}
      <Modal open={!!editUserOpen} onClose={() => { setEditUserOpen(null); setEditUserForm({ name: "", email: "", password: "" }); }} title="Edit User" width={400}>
        {editUserOpen && (
          <div>
            <div style={{ marginBottom: 20, padding: "12px 14px", background: "#f0f9ff", borderRadius: 8, borderLeft: "4px solid #3b82f6" }}>
              <div style={{ fontSize: 12, color: "#0c4a6e", fontWeight: 600 }}>Admin Edit Mode</div>
              <div style={{ fontSize: 12, color: "#0c4a6e", marginTop: 4 }}>You are editing: <strong>{editUserOpen.name}</strong></div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 6 }}>Full Name</label>
              <input
                style={iS}
                value={editUserForm.name}
                onChange={e => setEditUserForm({ ...editUserForm, name: e.target.value })}
                placeholder="Enter full name"
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 6 }}>Email Address</label>
              <input
                style={iS}
                value={editUserForm.email}
                onChange={e => setEditUserForm({ ...editUserForm, email: e.target.value })}
                placeholder="Enter email"
              />
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 6 }}>New Password (Leave blank to keep current)</label>
              <input
                style={iS}
                type="password"
                value={editUserForm.password}
                onChange={e => setEditUserForm({ ...editUserForm, password: e.target.value })}
                placeholder="Enter new password (min 6 characters)"
              />
              {editUserForm.password && editUserForm.password.length < 6 && (
                <div style={{ fontSize: 11, color: "#ef4444", marginTop: 4 }}>Password must be at least 6 characters</div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={() => { setEditUserOpen(null); setEditUserForm({ name: "", email: "", password: "" }); }} style={bG}>Cancel</button>
              <button onClick={editUser} style={bP}>Update User</button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── MAIN CONTENT ────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column" }}>
        <div style={{ background: "#fff", borderBottom: "1px solid #f1f5f9", padding: "11px 22px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{getPageTitle()}</h1>
            {view === "tickets" && <p style={{ margin: 0, fontSize: 11, color: "#94a3b8" }}>{cvd.desc}</p>}
            {view === "projects" && <p style={{ margin: 0, fontSize: 11, color: "#94a3b8" }}>{cpv.desc}</p>}
          </div>
          <div style={{ display: "flex", gap: 9, alignItems: "center" }}>
            {(view === "reports" || view === "dashboard") && (
              <select value={range} onChange={e => setRange(e.target.value)} style={{ ...sS, width: 140, fontSize: 13, padding: "7px 10px" }}>
                {view === "reports" ? (
                  <>
                    <option value="all">All Time</option>
                    <option value="1">Today</option>
                    <option value="7">Last 7 Days</option>
                    <option value="30">Last 30 Days</option>
                  </>
                ) : (
                  <>
                    <option value="1">Today</option>
                    <option value="7">Last 7 Days</option>
                  </>
                )}
              </select>
            )}
            {view === "dashboard" && (
              <div style={{ position: "relative", width: 180 }}>
                <input type="text" placeholder="Select org..." value={dashboardOrgSearch ? dashboardOrgSearch : (dashboardOrg !== "all" ? dashboardOrg : "")} onChange={e => setDashboardOrgSearch(e.target.value)} onFocus={() => { setDashboardOrgSearch(""); setShowDashboardOrgDD(true); }} style={{ ...sS, width: "100%", fontSize: 13, padding: "7px 10px" }} />
                {showDashboardOrgDD && <>
                  <div style={{ position: "fixed", inset: 0, zIndex: 199 }} onClick={() => { setShowDashboardOrgDD(false); setDashboardOrgSearch(""); }} />
                  <div style={{ position: "absolute", top: "calc(100% + 3px)", left: 0, right: 0, background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 8, zIndex: 200, boxShadow: "0 4px 12px rgba(0,0,0,0.1)", maxHeight: 200, overflowY: "auto" }}>
                    <div style={{ padding: 8, borderBottom: "1px solid #f1f5f9", position: "sticky", top: 0, background: "#fff" }}>
                      <input type="text" placeholder="Search orgs..." value={dashboardOrgSearch} onChange={e => setDashboardOrgSearch(e.target.value)} onClick={e => e.stopPropagation()} autoFocus style={{ ...sS, width: "100%", fontSize: 12 }} />
                    </div>
                    <div onClick={() => { setDashboardOrg("all"); setShowDashboardOrgDD(false); setDashboardOrgSearch(""); }} style={{ padding: "8px 12px", cursor: "pointer", borderBottom: "1px solid #f1f5f9", background: dashboardOrg === "all" ? "#f0f9ff" : "#fff", fontWeight: dashboardOrg === "all" ? 600 : 400 }}>
                      <div style={{ fontSize: 12 }}>All Organizations</div>
                    </div>
                    {orgs.filter(o => dashboardOrgSearch === "" || o.name.toLowerCase().includes(dashboardOrgSearch.toLowerCase())).map(o => (
                      <div key={o.id} onClick={() => { setDashboardOrg(o.name); setShowDashboardOrgDD(false); setDashboardOrgSearch(""); }} style={{ padding: "8px 12px", cursor: "pointer", borderBottom: "1px solid #f1f5f9", background: dashboardOrg === o.name ? "#f0f9ff" : "#fff", fontWeight: dashboardOrg === o.name ? 600 : 400 }}>
                        <div style={{ fontSize: 12 }}>{o.name}</div>
                      </div>
                    ))}
                    {orgs.filter(o => dashboardOrgSearch === "" || o.name.toLowerCase().includes(dashboardOrgSearch.toLowerCase())).length === 0 && <div style={{ padding: "12px", textAlign: "center", fontSize: 12, color: "#94a3b8" }}>No orgs found</div>}
                  </div>
                </>}
              </div>
            )}
            {/* {view !== "dashboard" && <>
              <button onClick={() => setShowNewTicket(true)} style={{ ...bP, padding: "8px 14px", fontSize: 13 }}>+ New Ticket</button>
              <button onClick={() => setShowNewProject(true)} style={{ ...bG, padding: "8px 14px", fontSize: 13 }}>+ New Project</button>
            </>} */}
          </div>
        </div>

        <div style={{ flex: 1, padding: 20, overflow: "auto", position: "relative" }}>
          {/* ── DASHBOARD (v2 layout + SmartCharts) ── */}
          {view === "dashboard" && <>
            {/* Background Image with Opacity for Dashboard */}
            <div style={{
              position: "absolute",
              inset: 0,
              backgroundImage: 'url("/res/login_page_bg.jpeg")', // USER: Static asset from public/res folder
              backgroundSize: "fill",
              backgroundPosition: "center",
              opacity: 0.5,
              zIndex: 0,
              pointerEvents: "none"
            }} />
            <div style={{ position: "relative", zIndex: 1 }}>
              {/* ── ROW 1: TICKETS ── */}
              <div style={{ marginBottom: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 900, color: "#1e293b", textTransform: "uppercase", letterSpacing: "0.1em", marginLeft: 2 }}>🎫 TICKETS</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 9, marginBottom: 20 }}>
                {[
                  { label: "Open", value: dashboardStats.open, bg: "#fef3c7", accent: "#f59e0b", icon: "📬", action: () => { setView("tickets"); setTvFilter("open"); setStatusF("All"); setPriorityF("All"); } },
                  { label: "Unassigned", value: dashboardData.filter(t => !t.assignees || t.assignees.length === 0).length, bg: "#f3e8ff", accent: "#a855f7", icon: "🔸", action: () => { setView("tickets"); setTvFilter("unassigned"); } },
                  { label: "In Progress", value: dashboardStats.inProgress, bg: "#ede9fe", accent: "#6366f1", icon: "⚙️", action: () => { setView("tickets"); setTvFilter("all"); setStatusF("In Progress"); setPriorityF("All"); } },
                  { label: "Critical", value: dashboardStats.critical, bg: "#fee2e2", accent: "#ef4444", icon: "🔥", action: () => { setView("tickets"); setTvFilter("alerts"); setStatusF("All"); setPriorityF("Critical"); } },
                  { label: "Resolved", value: dashboardStats.resolved, bg: "#dcfce7", accent: "#22c55e", icon: "✅", action: () => { setView("tickets"); setTvFilter("closed"); setStatusF("All"); setPriorityF("All"); } },
                  { label: "Total", value: dashboardStats.total, bg: "#dbeafe", accent: "#3b82f6", icon: "🎫", action: () => { setView("tickets"); setTvFilter("all"); setStatusF("All"); setPriorityF("All"); } },
                ].map(s => (
                  <div key={s.label} onClick={s.action} style={{ background: s.bg, borderRadius: 12, padding: "16px 16px", boxShadow: "0 2px 6px rgba(0,0,0,0.1)", borderLeft: `5px solid ${s.accent}`, cursor: "pointer", transition: "all 0.2s ease" }}
                    onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,0.15)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                    onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 2px 6px rgba(0,0,0,0.1)"; e.currentTarget.style.transform = "translateY(0)"; }}>
                    <div style={{ fontSize: 20, marginBottom: 6 }}>{s.icon}</div>
                    <div style={{ fontSize: 32, fontWeight: 900, color: s.accent, lineHeight: 1 }}>{s.value}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#1e293b", marginTop: 4 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* ✅ REMOVED: Separate Unassigned Card - Now integrated above */}

              {/* ✅ REMOVED: Projects stats section - Now shown only in Projects view */}

              {/* Dashboard Graphs - Different layouts for different roles */}
              {(currentUser?.role === "Admin" || currentUser?.role === "Manager") ? (
                <>
                  {/* Admin/Manager: 3-column grid with BIGGER pie charts */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
                    <SmartChart title="Tickets Over Time (Weekly)" data={dashboardDailyData} defaultColor="#3b82f6" />
                    <div style={{ background: "#fff", borderRadius: 12, padding: 18, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", minHeight: 380 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 12, color: "#374151" }}>Ticket Priority</div>
                      <SmartChart data={priorityDist} defaultType="pie" />
                    </div>
                    <SmartChart title="By Category" data={categoryDist} defaultColor="#8b5cf6" />
                  </div>

                  {/* Admin/Manager: 2nd row (2 graphs) - with SMALLER pie charts */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                    <div style={{ background: "#fff", borderRadius: 12, padding: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", minHeight: 300 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 10, color: "#374151" }}>Ticket Status (w/ Unassigned)</div>
                      <SmartChart data={dashboardStatusDist} defaultType="pie" />
                    </div>
                    <SmartChart title="People Closing Tickets" data={dashboardClosingUsers} defaultColor="#10b981" />
                  </div>

                  {/* Recent Tickets for Admin/Manager */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
                    <div style={{ background: "#fff", borderRadius: 12, padding: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10, color: "#374151" }}>Recent Tickets</div>
                      {(currentUser?.role === "Admin" ? tickets : tickets.filter(t => t.reportedBy === currentUser?.name || t.assignees?.some(a => a.id === currentUser?.id))).slice(0, 5).map(t => (
                        <div key={t.id} onClick={() => setSelTicket(t)} style={{ display: "flex", alignItems: "center", gap: 9, padding: "6px", borderRadius: 8, cursor: "pointer", border: "1px solid #f1f5f9", marginBottom: 5 }}>
                          <div style={{ display: "flex" }}>{(t.assignees || []).slice(0, 2).map((a, i) => <div key={a.id} style={{ marginLeft: i > 0 ? -6 : 0, border: "2px solid #fff", borderRadius: "50%" }}><Avatar name={a.name} size={24} /></div>)}{!t.assignees?.length && <Avatar name="?" size={24} />}</div>
                          <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.summary}</div><div style={{ fontSize: 10, color: "#94a3b8" }}>{t.id} · {t.org}</div></div>
                          <Badge label={t.status} style={{ ...STATUS_COLOR[t.status], fontSize: 10 }} />
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Viewer/Agent: 2-column grid with EQUAL SMALL graphs - NO Recent Tickets */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                    <div style={{ background: "#fff", borderRadius: 12, padding: 10, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", minHeight: 220 }}>
                      <div style={{ fontSize: 10, fontWeight: 600, marginBottom: 8, color: "#374151" }}>Tickets Over Time (Weekly)</div>
                      <SmartChart data={dashboardDailyData} defaultColor="#3b82f6" />
                    </div>
                    <div style={{ background: "#fff", borderRadius: 12, padding: 10, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", minHeight: 220 }}>
                      <div style={{ fontSize: 10, fontWeight: 600, marginBottom: 8, color: "#374151" }}>Ticket Priority</div>
                      <SmartChart data={priorityDist} defaultType="pie" />
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                    <div style={{ background: "#fff", borderRadius: 12, padding: 10, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", minHeight: 220 }}>
                      <div style={{ fontSize: 10, fontWeight: 600, marginBottom: 8, color: "#374151" }}>By Category</div>
                      <SmartChart data={categoryDist} defaultColor="#8b5cf6" />
                    </div>
                    <div style={{ background: "#fff", borderRadius: 12, padding: 10, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", minHeight: 220 }}>
                      <div style={{ fontSize: 10, fontWeight: 600, marginBottom: 8, color: "#374151" }}>Ticket Status (w/ Unassigned)</div>
                      <SmartChart data={dashboardStatusDist} defaultType="pie" />
                    </div>
                  </div>
                  {/* NO Recent Tickets for Viewer/Agent */}
                </>
              )}
            </div>
          </>}

          {/* ── TICKETS (v2 layout + v1 action column) ── */}
          {view === "tickets" && <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
            <div style={{ padding: "11px 14px", borderBottom: "1px solid #f1f5f9", display: "flex", gap: 9, alignItems: "center", flexWrap: "wrap" }}>
              <input placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} style={{ ...iS, width: 200, fontSize: 13, padding: "7px 10px" }} />
              <select value={statusF} onChange={e => setStatusF(e.target.value)} style={{ ...sS, width: 128, fontSize: 13, padding: "7px 10px" }}><option value="All">All Status</option>{STATUSES.map(s => <option key={s}>{s}</option>)}</select>
              <select value={priorityF} onChange={e => setPriorityF(e.target.value)} style={{ ...sS, width: 128, fontSize: 13, padding: "7px 10px" }}><option value="All">All Priority</option>{PRIORITIES.map(p => <option key={p}>{p}</option>)}</select>

              {/* ✅ NEW: Organization filter */}
              <div style={{ position: "relative", width: 200 }}>
                <input type="text" placeholder="Search org..." value={orgFilterSearch ? orgFilterSearch : (orgFilter !== "all" ? orgFilter : "")} onChange={e => setOrgFilterSearch(e.target.value)} onFocus={() => { setOrgFilterSearch(""); setShowOrgFilterDD(true); }} style={{ ...sS, width: "100%", fontSize: 13, padding: "7px 10px" }} />
                {showOrgFilterDD && <>
                  <div style={{ position: "fixed", inset: 0, zIndex: 199 }} onClick={() => { setShowOrgFilterDD(false); setOrgFilterSearch(""); }} />
                  <div style={{ position: "absolute", top: "calc(100% + 3px)", left: 0, right: 0, background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 8, zIndex: 200, boxShadow: "0 4px 12px rgba(0,0,0,0.1)", maxHeight: 200, overflowY: "auto" }}>
                    <div style={{ padding: 8, borderBottom: "1px solid #f1f5f9", position: "sticky", top: 0, background: "#fff" }}>
                      <input type="text" placeholder="Search organizations..." value={orgFilterSearch} onChange={e => setOrgFilterSearch(e.target.value)} onClick={e => e.stopPropagation()} autoFocus style={{ ...sS, width: "100%", fontSize: 12 }} />
                    </div>
                    <div onClick={() => { setOrgFilter("all"); setShowOrgFilterDD(false); setOrgFilterSearch(""); }} style={{ padding: "8px 12px", cursor: "pointer", borderBottom: "1px solid #f1f5f9", background: orgFilter === "all" ? "#f0f9ff" : "#fff", fontWeight: orgFilter === "all" ? 600 : 400 }}>
                      <div style={{ fontSize: 12 }}>All Organizations</div>
                    </div>
                    {orgs.filter(o => orgFilterSearch === "" || o.name.toLowerCase().includes(orgFilterSearch.toLowerCase())).map(o => (
                      <div key={o.id} onClick={() => { setOrgFilter(o.name); setShowOrgFilterDD(false); setOrgFilterSearch(""); }} style={{ padding: "8px 12px", cursor: "pointer", borderBottom: "1px solid #f1f5f9", background: orgFilter === o.name ? "#f0f9ff" : "#fff", fontWeight: orgFilter === o.name ? 600 : 400 }}>
                        <div style={{ fontSize: 12 }}>{o.name}</div>
                      </div>
                    ))}
                    {orgs.filter(o => orgFilterSearch === "" || o.name.toLowerCase().includes(orgFilterSearch.toLowerCase())).length === 0 && <div style={{ padding: "12px", textAlign: "center", fontSize: 12, color: "#94a3b8" }}>No organizations found</div>}
                  </div>
                </>}
              </div>

              {/* ✅ NEW: Department filter */}
              <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} style={{ ...sS, width: 140, fontSize: 13, padding: "7px 10px" }}>
                <option value="all">All Departments</option>
                {departments.map(d => (
                  <option key={d.id} value={d.name}>{d.name}</option>
                ))}
              </select>

              {/* ✅ NEW: Category filter - only non-webcast categories */}
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={{ ...sS, width: 140, fontSize: 13, padding: "7px 10px" }}>
                <option value="all">All Categories</option>
                {ticketCategories.filter(c => !c.name.toLowerCase().includes("webcast")).map(c => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>

              <span style={{ fontSize: 12, color: "#64748b" }}>{filtered.length} tickets</span>
              <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
                {selectedIds.size > 0 && <span style={{ fontSize: 12, color: "#3b82f6", fontWeight: 600, background: "#eff6ff", padding: "4px 10px", borderRadius: 99 }}>{selectedIds.size} selected</span>}

                {/* Mark All as Closed Button */}
                {selectedIds.size > 0 && (
                  <button onClick={async () => {
                    if (!window.confirm(`Close ${selectedIds.size} ticket(s)?`)) return;
                    const nowISO = new Date().toISOString();
                    try {
                      for (const id of selectedIds) {
                        const t = tickets.find(x => x.id === id);
                        if (t) {
                          const update = { ...t, status: "Closed", updated: nowISO };
                          await axios.put(`${TICKETS_API}/${id}`, update);
                        }
                      }
                      setTickets(p => p.map(x => selectedIds.has(x.id) ? { ...x, status: "Closed", updated: new Date(nowISO) } : x));
                      setSelectedIds(new Set());
                    } catch (e) { alert("Failed to close tickets"); }
                  }} style={{ ...bP, padding: "7px 13px", fontSize: 12, background: "#22c55e", color: "#fff" }}>✓ Mark All Closed</button>
                )}

                {/* Other Actions Dropdown */}
                <div style={{ position: "relative" }}>
                  <button onClick={() => setShowOtherActions(!showOtherActions)} style={{ ...bG, display: "flex", alignItems: "center", gap: 6, padding: "7px 13px", fontSize: 12 }}>⚙ Other Actions <span style={{ fontSize: 10 }}>▾</span></button>
                  {showOtherActions && <><div style={{ position: "fixed", inset: 0, zIndex: 149 }} onClick={() => setShowOtherActions(false)} />
                    <div style={{ position: "absolute", right: 0, top: "calc(100% + 4px)", background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 10, zIndex: 150, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", minWidth: 220, overflow: "hidden" }}>
                      <button onClick={() => {
                        const pageTicketIds = new Set(currentTickets.map(t => t.id));
                        setSelectedIds(pageTicketIds);
                        setShowOtherActions(false);
                      }} style={{ display: "block", width: "100%", padding: "10px 14px", border: "none", background: "#fff", cursor: "pointer", fontSize: 13, textAlign: "left", fontFamily: "'DM Sans',sans-serif", borderBottom: "1px solid #f8fafc" }}>☑ Select All on Page</button>

                      {selectedIds.size > 0 && <>
                        <button onClick={async () => {
                          if (!window.confirm(`Mark ${selectedIds.size} as Open?`)) return;
                          const nowISO = new Date().toISOString();
                          try {
                            for (const id of selectedIds) {
                              const t = tickets.find(x => x.id === id);
                              if (t) {
                                const update = { ...t, status: "Open", updated: nowISO };
                                await axios.put(`${TICKETS_API}/${id}`, update);
                              }
                            }
                            setTickets(p => p.map(x => selectedIds.has(x.id) ? { ...x, status: "Open", updated: new Date(nowISO) } : x));
                            setShowOtherActions(false);
                          } catch (e) { alert("Failed to update tickets"); }
                        }} style={{ display: "block", width: "100%", padding: "10px 14px", border: "none", background: "#fff", cursor: "pointer", fontSize: 13, textAlign: "left", fontFamily: "'DM Sans',sans-serif", borderBottom: "1px solid #f8fafc" }}>📂 Mark as Open</button>

                        <button onClick={async () => {
                          if (!window.confirm(`Mark ${selectedIds.size} as In Progress?`)) return;
                          const nowISO = new Date().toISOString();
                          try {
                            for (const id of selectedIds) {
                              const t = tickets.find(x => x.id === id);
                              if (t) {
                                const update = { ...t, status: "In Progress", updated: nowISO };
                                await axios.put(`${TICKETS_API}/${id}`, update);
                              }
                            }
                            setTickets(p => p.map(x => selectedIds.has(x.id) ? { ...x, status: "In Progress", updated: new Date(nowISO) } : x));
                            setShowOtherActions(false);
                          } catch (e) { alert("Failed to update tickets"); }
                        }} style={{ display: "block", width: "100%", padding: "10px 14px", border: "none", background: "#fff", cursor: "pointer", fontSize: 13, textAlign: "left", fontFamily: "'DM Sans',sans-serif", borderBottom: "1px solid #f8fafc" }}>⚙ Mark as In Progress</button>

                        <button onClick={async () => {
                          if (!window.confirm(`Mark ${selectedIds.size} as Pending?`)) return;
                          const nowISO = new Date().toISOString();
                          try {
                            for (const id of selectedIds) {
                              const t = tickets.find(x => x.id === id);
                              if (t) {
                                const update = { ...t, status: "Pending", updated: nowISO };
                                await axios.put(`${TICKETS_API}/${id}`, update);
                              }
                            }
                            setTickets(p => p.map(x => selectedIds.has(x.id) ? { ...x, status: "Pending", updated: new Date(nowISO) } : x));
                            setShowOtherActions(false);
                          } catch (e) { alert("Failed to update tickets"); }
                        }} style={{ display: "block", width: "100%", padding: "10px 14px", border: "none", background: "#fff", cursor: "pointer", fontSize: 13, textAlign: "left", fontFamily: "'DM Sans',sans-serif", borderBottom: "1px solid #f8fafc" }}>⏳ Mark as Pending</button>

                        <button onClick={async () => {
                          if (!window.confirm(`Mark ${selectedIds.size} as Resolved?`)) return;
                          const nowISO = new Date().toISOString();
                          try {
                            for (const id of selectedIds) {
                              const t = tickets.find(x => x.id === id);
                              if (t) {
                                const update = { ...t, status: "Resolved", updated: nowISO };
                                await axios.put(`${TICKETS_API}/${id}`, update);
                              }
                            }
                            setTickets(p => p.map(x => selectedIds.has(x.id) ? { ...x, status: "Resolved", updated: new Date(nowISO) } : x));
                            setShowOtherActions(false);
                          } catch (e) { alert("Failed to update tickets"); }
                        }} style={{ display: "block", width: "100%", padding: "10px 14px", border: "none", background: "#fff", cursor: "pointer", fontSize: 13, textAlign: "left", fontFamily: "'DM Sans',sans-serif", borderBottom: "1px solid #f8fafc" }}>✅ Mark as Resolved</button>


                      </>}
                    </div>
                  </>}
                </div>
              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr style={{ background: "#f8fafc" }}>
                  <th style={{ ...thStyle, width: 40 }}><input type="checkbox" checked={selectedIds.size === filtered.length && filtered.length > 0} onChange={toggleAll} style={{ cursor: "pointer" }} /></th>
                  {["ID", "Summary", "Org / Dept", "Reported By", "Assignees", "Priority", "Category", "Status", "Created", "Action"].map(h => (
                    <th key={h} style={{ ...thStyle, cursor: h === "Created" ? "pointer" : "default", background: h === "Created" ? "#e0f2fe" : "#f8fafc" }} onClick={h === "Created" ? () => setSortOrder(sortOrder === "desc" ? "asc" : "desc") : undefined}>
                      {h}
                      {h === "Created" && <span style={{ marginLeft: 4, fontSize: 10 }}>{sortOrder === "desc" ? "↓" : "↑"}</span>}
                    </th>
                  ))}
                </tr></thead>
                <tbody>{currentTickets.map(t => (
                  <tr key={t.id} className="rh" style={{ cursor: "pointer", background: selectedIds.has(t.id) ? "#eff6ff" : "#fff" }}>
                    <td style={tdStyle} onClick={e => e.stopPropagation()}><input type="checkbox" checked={selectedIds.has(t.id)} onChange={() => toggleSel(t.id)} style={{ cursor: "pointer" }} /></td>
                    <td style={tdStyle} onClick={() => setSelTicket(t)}><span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11.5, color: "#3b82f6", fontWeight: 500 }}>{t.id}</span>{t.isWebcast && <span style={{ marginLeft: 5, fontSize: 10, background: "#fff7ed", color: "#f97316", padding: "1px 5px", borderRadius: 4, fontWeight: 600 }}>📡</span>}</td>
                    <td style={{ ...tdStyle, maxWidth: 180 }} onClick={() => setSelTicket(t)}><div style={{ fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.summary}</div></td>
                    <td style={tdStyle} onClick={() => setSelTicket(t)}><div style={{ fontSize: 12, fontWeight: 500 }}>{t.org}</div><div style={{ fontSize: 11, color: "#94a3b8" }}>{t.department}</div></td>
                    <td style={tdStyle} onClick={() => setSelTicket(t)}><span style={{ fontSize: 12, color: "#64748b" }}>{t.reportedBy || "—"}</span></td>
                    <td style={tdStyle} onClick={() => setSelTicket(t)}>
                      <div style={{ display: "flex", alignItems: "center" }}>
                        {(t.assignees || []).slice(0, 3).map((a, i) => <div key={a.id} title={a.name} style={{ marginLeft: i > 0 ? -7 : 0, border: "2px solid #fff", borderRadius: "50%" }}><Avatar name={a.name} size={22} /></div>)}
                        {(t.assignees || []).length > 3 && <div style={{ marginLeft: -7, width: 22, height: 22, borderRadius: "50%", background: "#e2e8f0", border: "2px solid #fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#64748b" }}>+{t.assignees.length - 3}</div>}
                        {!t.assignees?.length && <span style={{ fontSize: 11, color: "#94a3b8" }}>None</span>}
                      </div>
                    </td>
                    <td style={tdStyle} onClick={() => setSelTicket(t)}><div style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: PRIORITY_COLOR[t.priority], display: "inline-block" }} /><span style={{ fontSize: 12 }}>{t.priority}</span></div></td>
                    <td style={tdStyle} onClick={() => setSelTicket(t)}><span style={{ fontSize: 12, color: "#64748b" }}>{t.category || "—"}</span></td>
                    <td style={tdStyle} onClick={() => setSelTicket(t)}><Badge label={t.status} style={{ ...STATUS_COLOR[t.status] }} /></td>
                    <td style={tdStyle} onClick={() => setSelTicket(t)}><span style={{ fontSize: 11, color: "#94a3b8" }}>{t.created ? new Date(String(t.created)).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : "—"}</span></td>
                    <td style={tdStyle} onClick={e => e.stopPropagation()}><select value={t.status} onChange={e => updateStatus(t.id, e.target.value)} style={{ ...sS, width: 108, fontSize: 12, padding: "4px 7px" }}>{STATUSES.map(s => <option key={s}>{s}</option>)}</select></td>
                  </tr>
                ))}</tbody>
              </table>



              {allSortedTickets.length === 0 && <div style={{ padding: 36, textAlign: "center", color: "#94a3b8" }}>No tickets found</div>}

              {totalPages > 1 && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "15px 20px", borderTop: "1px solid #e2e8f0", backgroundColor: "#f8fafc" }}>
                  <div style={{ fontSize: 13, color: "#64748b" }}>
                    Showing {((currentPage - 1) * TICKETS_PER_PAGE) + 1} to {Math.min(currentPage * TICKETS_PER_PAGE, allSortedTickets.length)} of {allSortedTickets.length} tickets
                  </div>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} style={{ padding: "6px 12px", border: "1px solid #cbd5e1", borderRadius: 4, backgroundColor: currentPage === 1 ? "#f1f5f9" : "#fff", color: currentPage === 1 ? "#94a3b8" : "#334155", cursor: currentPage === 1 ? "not-allowed" : "pointer", fontSize: 13 }} >Previous</button>
                    <span style={{ fontSize: 13, color: "#334155", padding: "6px 0" }}>Page {currentPage} of {totalPages}</span>
                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} style={{ padding: "6px 12px", border: "1px solid #cbd5e1", borderRadius: 4, backgroundColor: currentPage === totalPages ? "#f1f5f9" : "#fff", color: currentPage === totalPages ? "#94a3b8" : "#334155", cursor: currentPage === totalPages ? "not-allowed" : "pointer", fontSize: 13 }} >Next</button>
                  </div>
                </div>
              )}

            </div>
          </div>}

          {/* ── PROJECTS ── */}
          {view === "projects" && <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>

            {/* ✅ PROJECT STATS - Now in Projects View Only */}
            <div style={{ padding: "18px 18px 0 18px" }}>
              <div style={{ marginBottom: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 900, color: "#1e293b", textTransform: "uppercase", letterSpacing: "0.1em", marginLeft: 2 }}>📁 PROJECTS</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 9, marginBottom: 20 }}>
                {[
                  { label: "Open", value: projStats.open, bg: "#fef3c7", accent: "#f59e0b", icon: "📂", action: () => { setPvFilter("open"); setProjStatusF("All"); setProjPriorityF("All"); } },
                  { label: "Unassigned", value: dashboardProjects.filter(p => !p.assignees || p.assignees.length === 0).length, bg: "#f3e8ff", accent: "#a855f7", icon: "👤", action: () => { setPvFilter("unassigned"); } },
                  { label: "In Progress", value: projStats.inProgress, bg: "#ede9fe", accent: "#6366f1", icon: "⚙️", action: () => { setPvFilter("inprogress"); setProjStatusF("All"); setProjPriorityF("All"); } },
                  { label: "Critical", value: projStats.critical, bg: "#fee2e2", accent: "#ef4444", icon: "🔥", action: () => { setPvFilter("critical"); setProjStatusF("All"); setProjPriorityF("All"); } },
                  { label: "Resolved", value: projStats.resolved, bg: "#dcfce7", accent: "#22c55e", icon: "✅", action: () => { setPvFilter("closed"); setProjStatusF("All"); setProjPriorityF("All"); } },
                  { label: "Total", value: projStats.total, bg: "#ede9fe", accent: "#8b5cf6", icon: "📁", action: () => { setPvFilter("all"); setProjStatusF("All"); setProjPriorityF("All"); } },
                ].map(s => (
                  <div key={s.label} onClick={s.action} style={{ background: s.bg, borderRadius: 12, padding: "16px 16px", boxShadow: "0 2px 6px rgba(0,0,0,0.1)", borderLeft: `5px solid ${s.accent}`, cursor: "pointer", transition: "all 0.2s ease" }}
                    onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,0.15)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                    onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 2px 6px rgba(0,0,0,0.1)"; e.currentTarget.style.transform = "translateY(0)"; }}>
                    <div style={{ fontSize: 20, marginBottom: 6 }}>{s.icon}</div>
                    <div style={{ fontSize: 32, fontWeight: 900, color: s.accent, lineHeight: 1 }}>{s.value}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#1e293b", marginTop: 4 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Project Filters */}
            <div style={{ padding: "11px 14px", borderBottom: "1px solid #f1f5f9", display: "flex", gap: 9, alignItems: "center", flexWrap: "wrap" }}>
              <input placeholder="Search projects…" value={projSearch} onChange={e => setProjSearch(e.target.value)} style={{ ...iS, width: 200, fontSize: 13, padding: "7px 10px" }} />
              <select value={projStatusF} onChange={e => setProjStatusF(e.target.value)} style={{ ...sS, width: 128, fontSize: 13, padding: "7px 10px" }}><option value="All">All Status</option>{PROJECT_STATUSES.map(s => <option key={s}>{s}</option>)}</select>
              <select value={projPriorityF} onChange={e => setProjPriorityF(e.target.value)} style={{ ...sS, width: 128, fontSize: 13, padding: "7px 10px" }}><option value="All">All Priority</option>{PROJECT_PRIORITIES.map(p => <option key={p}>{p}</option>)}</select>
              <span style={{ fontSize: 12, color: "#64748b" }}>{filteredProjects.length} projects</span>
              <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
                {selectedProjIds.size > 0 && <span style={{ fontSize: 12, color: "#3b82f6", fontWeight: 600, background: "#eff6ff", padding: "4px 10px", borderRadius: 99 }}>{selectedProjIds.size} selected</span>}
                <button onClick={() => setShowNewProject(true)} style={{ ...bP, padding: "7px 13px", fontSize: 13, background: "linear-gradient(135deg,#8b5cf6,#6366f1)", display: (currentUser?.role === "Admin" || currentUser?.role === "Manager") ? "block" : "none" }}>+ New Project</button>
              </div>
            </div>


            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr style={{ background: "#f8fafc" }}>
                  <th style={{ ...thStyle, width: 40 }}><input type="checkbox" checked={selectedProjIds.size === filteredProjects.length && filteredProjects.length > 0} onChange={toggleAllProj} style={{ cursor: "pointer" }} /></th>
                  {["ID", "Title", "Org / Dept", "Assignees", "Priority", "Category", "Status", "Progress", "Due Date", "Action"].map(h => <th key={h} style={thStyle}>{h}</th>)}
                </tr></thead>
                <tbody>{filteredProjects.map(p => (
                  <tr key={p.id} className="rh" style={{ cursor: "pointer", background: selectedProjIds.has(p.id) ? "#f5f3ff" : "#fff" }}>
                    <td style={tdStyle} onClick={e => e.stopPropagation()}><input type="checkbox" checked={selectedProjIds.has(p.id)} onChange={() => toggleProjSel(p.id)} style={{ cursor: "pointer" }} /></td>
                    <td style={tdStyle} onClick={() => setSelProject(p)}><span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11.5, color: "#8b5cf6", fontWeight: 500 }}>{p.id}</span></td>
                    <td style={{ ...tdStyle, maxWidth: 180 }} onClick={() => setSelProject(p)}><div style={{ fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.title}</div></td>
                    <td style={tdStyle} onClick={() => setSelProject(p)}><div style={{ fontSize: 12, fontWeight: 500 }}>{p.org}</div><div style={{ fontSize: 11, color: "#94a3b8" }}>{p.department}</div></td>
                    <td style={tdStyle} onClick={() => setSelProject(p)}>
                      <div style={{ display: "flex", alignItems: "center" }}>
                        {(p.assignees || []).slice(0, 3).map((a, i) => <div key={a.id} title={a.name} style={{ marginLeft: i > 0 ? -7 : 0, border: "2px solid #fff", borderRadius: "50%" }}><Avatar name={a.name} size={22} /></div>)}
                        {!p.assignees?.length && <span style={{ fontSize: 11, color: "#94a3b8" }}>None</span>}
                      </div>
                    </td>
                    <td style={tdStyle} onClick={() => setSelProject(p)}><div style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: PRIORITY_COLOR[p.priority], display: "inline-block" }} /><span style={{ fontSize: 12 }}>{p.priority}</span></div></td>
                    <td style={tdStyle} onClick={() => setSelProject(p)}><span style={{ fontSize: 12, color: "#64748b" }}>{p.category || "—"}</span></td>
                    <td style={tdStyle} onClick={() => setSelProject(p)}><Badge label={p.status} style={{ ...STATUS_COLOR[p.status] }} /></td>
                    <td style={tdStyle} onClick={() => setSelProject(p)}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <ProgressBar value={getProgressFromStatus(p.status)} color={getProgressFromStatus(p.status) > 70 ? "#22c55e" : getProgressFromStatus(p.status) > 40 ? "#f59e0b" : "#ef4444"} />
                        <span style={{ fontSize: 11, fontWeight: 600, color: "#374151", minWidth: 28 }}>{getProgressFromStatus(p.status)}%</span>
                      </div>
                    </td>
                    <td style={tdStyle} onClick={() => setSelProject(p)}><span style={{ fontSize: 11, color: "#94a3b8" }}>{p.dueDate?.toLocaleDateString() || "—"}</span></td>
                    <td style={tdStyle} onClick={e => e.stopPropagation()}><select value={p.status} onChange={e => updateProjectStatus(p.id, e.target.value)} style={{ ...sS, width: 108, fontSize: 12, padding: "4px 7px" }}>{PROJECT_STATUSES.map(s => <option key={s}>{s}</option>)}</select></td>
                  </tr>
                ))}</tbody>
              </table>
              {filteredProjects.length === 0 && <div style={{ padding: 36, textAlign: "center", color: "#94a3b8" }}>No projects found</div>}
            </div>
          </div>}

          {/* ── WEBCAST ── */}
          {view === "webcast" && <>
            {/* Webcast Stats Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 9, marginBottom: 16 }}>
              {[
                { label: "Total Webcasts", value: tickets.filter(t => t.isWebcast || (t.category && t.category.toLowerCase().includes("webcast"))).length, color: "#f97316", icon: "📡" },
                { label: "Open", value: tickets.filter(t => (t.isWebcast || (t.category && t.category.toLowerCase().includes("webcast"))) && t.status === "Open").length, color: "#3b82f6", icon: "📂" },
                { label: "In Progress", value: tickets.filter(t => (t.isWebcast || (t.category && t.category.toLowerCase().includes("webcast"))) && t.status === "In Progress").length, color: "#eab308", icon: "⚙️" },
                { label: "Closed", value: tickets.filter(t => (t.isWebcast || (t.category && t.category.toLowerCase().includes("webcast"))) && t.status === "Closed").length, color: "#64748b", icon: "✅" },
                { label: "Critical", value: tickets.filter(t => (t.isWebcast || (t.category && t.category.toLowerCase().includes("webcast"))) && t.priority === "Critical").length, color: "#ef4444", icon: "🔥" },
              ].map(s => (
                <div key={s.label} style={{ background: "#fff", borderRadius: 12, padding: "14px 16px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", borderTop: `3px solid ${s.color}` }}>
                  <div style={{ fontSize: 20, marginBottom: 5 }}>{s.icon}</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Webcast Table - Only show tickets assigned to current user (or all for Admin) */}
            <div style={{ background: "#fff", borderRadius: 12, padding: 22, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 700 }}>My Webcast Tickets</h3>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr style={{ background: "#f8fafc" }}>{["ID", "Summary", "Location", "Satsang Type", "Priority", "Status"].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
                  <tbody>{tickets.filter(t => (t.isWebcast || (t.category && t.category.toLowerCase().includes("webcast"))) && (t.assignees?.some(a => a.id === currentUser?.id) || currentUser?.role === "Admin")).slice(0, 10).map((t, i) => (
                    <tr key={t.id + i} className="rh" onClick={() => setSelTicket(t)} style={{ cursor: "pointer" }}>
                      <td style={tdStyle}><span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11.5, color: "#3b82f6" }}>{t.id}</span></td>
                      <td style={{ ...tdStyle, maxWidth: 200 }}><div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.summary}</div></td>
                      <td style={tdStyle}><span style={{ fontSize: 12, color: "#64748b" }}>{t.location || "—"}</span></td>
                      <td style={tdStyle}><span style={{ fontSize: 12, color: "#64748b" }}>{t.satsangType || "—"}</span></td>
                      <td style={tdStyle}><div style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: PRIORITY_COLOR[t.priority], display: "inline-block" }} />{t.priority}</div></td>
                      <td style={tdStyle}><Badge label={t.status} style={{ ...STATUS_COLOR[t.status] }} /></td>
                    </tr>
                  ))}
                    {tickets.filter(t => (t.isWebcast || (t.category && t.category.toLowerCase().includes("webcast"))) && (t.assignees?.some(a => a.id === currentUser?.id) || currentUser?.role === "Admin")).length === 0 && <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>No webcast tickets assigned to you yet.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </>}

          {/* ── REPORTS (v1 charts) ── */}
          {view === "reports" && <>
            {/* Time Range Filter & Advanced Export Button */}
            <div style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Time Range:</span>
                <select
                  value={reportTimeRange}
                  onChange={e => setReportTimeRange(e.target.value)}
                  style={{ ...sS, width: 140, fontSize: 13, padding: "7px 10px" }}>
                  <option value="all">All Time</option>
                  <option value="1">Today</option>
                  <option value="7">Last 7 Days</option>
                  <option value="30">Last 30 Days</option>
                </select>
              </div>

              <button
                onClick={() => setShowAdvancedExportModal(true)}
                style={{ ...bP, padding: "7px 16px", fontSize: 13, background: "#3b82f6", color: "#fff", marginLeft: "auto" }}>
                ⬇️ Advanced Export
              </button>
            </div>
            {/* All Equal-Sized Report Graphs - 3 per row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 12 }}>
              <div style={{ background: "#fff", borderRadius: 12, padding: 18, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Ticket Status Distribution</div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 12 }}>Open / Closed / In Progress</div>
                <DonutChart data={["Open", "Closed", "In Progress"].map(s => ({ label: s, color: STATUS_COLOR[s]?.text || "#94a3b8", value: reportFilteredData.filter(t => t.status === s).length }))} />
              </div>
              <div style={{ background: "#fff", borderRadius: 12, padding: 18, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Project Status Distribution</div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 12 }}>Open / Closed / In Progress</div>
                <DonutChart data={["Open", "Closed", "In Progress"].map(s => ({ label: s, color: STATUS_COLOR[s]?.text || "#94a3b8", value: prbr.filter(p => p.status === s).length }))} />
              </div>
              <div style={{ background: "#fff", borderRadius: 12, padding: 18, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 12 }}>Ticket Volume</div>
                <BarChart data={Array.from({ length: parseInt(reportTimeRange || "30") <= 7 ? parseInt(reportTimeRange || "30") : 7 }, (_, i) => { const d = new Date(now - (parseInt(reportTimeRange || "30") - 1 - i) * dayMs); return { label: d.toLocaleDateString("en", { weekday: "short" }), value: reportFilteredData.filter(t => t.created.getDate() === d.getDate() && t.created.getMonth() === d.getMonth()).length }; })} />
              </div>
              <div style={{ background: "#fff", borderRadius: 12, padding: 18, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 12 }}>By Category</div>
                <BarChart data={categoryDist.map(c => ({ ...c, value: reportFilteredData.filter(t => t.category === c.label).length }))} color="#8b5cf6" />
              </div>
              <div style={{ background: "#fff", borderRadius: 12, padding: 18, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 12 }}>Priority Distribution</div>
                <DonutChart data={PRIORITIES.map(p => ({ label: p, value: reportFilteredData.filter(t => t.priority === p).length, color: PRIORITY_COLOR[p] }))} />
              </div>
              <div style={{ background: "#fff", borderRadius: 12, padding: 18, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 12 }}>Ticket Type Distribution</div>
                <DonutChart data={[
                  { label: "Regular Tickets", value: reportFilteredData.filter(t => !t.isWebcast && !(t.category && t.category.toLowerCase().includes("webcast"))).length, color: "#3b82f6" },
                  { label: "Webcasts", value: reportFilteredData.filter(t => t.isWebcast || (t.category && t.category.toLowerCase().includes("webcast"))).length, color: "#f97316" }
                ]} />
              </div>
            </div>

            {/* Agent Performance Table */}
            <div style={{ background: "#fff", borderRadius: 12, padding: 18, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr>{["Agent", "Role", "Assigned", "Resolved", "Open", "Rate"].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
                <tbody>{agentStats.map(a => {
                  const rate = a.assigned ? Math.round(a.resolved / a.assigned * 100) : 0; return (
                    <tr key={a.id} className="rh">
                      <td style={tdStyle}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><Avatar name={a.name} size={26} /><div><div style={{ fontSize: 12, fontWeight: 600 }}>{a.name}</div><div style={{ fontSize: 11, color: "#94a3b8" }}>{a.email}</div></div></div></td>
                      <td style={tdStyle}><Badge label={a.role} style={{ background: "#ede9fe", color: "#6d28d9" }} /></td>
                      <td style={{ ...tdStyle, fontWeight: 700 }}>{a.assigned}</td>
                      <td style={{ ...tdStyle, color: "#22c55e", fontWeight: 700 }}>{a.resolved}</td>
                      <td style={{ ...tdStyle, color: "#f59e0b", fontWeight: 700 }}>{a.assigned - a.resolved}</td>
                      <td style={tdStyle}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ flex: 1, height: 5, background: "#f1f5f9", borderRadius: 3, overflow: "hidden" }}><div style={{ width: `${rate}%`, height: "100%", background: rate > 70 ? "#22c55e" : rate > 40 ? "#f59e0b" : "#ef4444", borderRadius: 3 }} /></div><span style={{ fontSize: 12, fontWeight: 600, width: 34 }}>{rate}%</span></div></td>
                    </tr>);
                })}</tbody>
              </table>
            </div>
          </>}

          {/* ── AGENTS ── */}
          {view === "users" && !selAgent ? <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 12 }}>
            {agentStats.map(a => {
              const userInfo = users.find(u => u.id === a.id);
              return (
                <div key={a.id} onClick={() => setSelAgent(a)} style={{ background: "#fff", borderRadius: 12, padding: 18, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", cursor: "pointer", transition: "all 0.2s", border: "1.5px solid transparent" }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)"; e.currentTarget.style.borderColor = "#3b82f6"; }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.06)"; e.currentTarget.style.borderColor = "transparent"; }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <Avatar name={a.name} size={40} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={a.name}>{a.name}</div>
                      <div style={{ fontSize: 11, color: "#94a3b8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={a.email}>{a.email}</div>
                      <div style={{ display: "flex", gap: 4, marginTop: 3, flexWrap: "wrap" }}>
                        <Badge label={a.role} style={{ background: "#ede9fe", color: "#6d28d9" }} />
                        {(() => {
                          const foundUser = users.find(u => u.id === a.id);
                          const rawStatus = foundUser?.status;
                          const statusValue = rawStatus === "Active" ? "Logged-In" : (rawStatus === "Not Active" || rawStatus?.toLowerCase() === "logged-out") ? "Logged-Out" : rawStatus;
                          const statusStyle = statusOpts.find(s => s.l === statusValue);
                          if (statusStyle) {
                            return <Badge label={statusStyle.l} style={{ background: statusStyle.bg, color: statusStyle.c }} />;
                          }
                          return null;
                        })()}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 7 }}>
                    {[{ l: "Assigned", v: a.assigned, c: "#3b82f6" }, { l: "Resolved", v: a.resolved, c: "#22c55e" }, { l: "Open", v: a.assigned - a.resolved, c: "#f59e0b" }].map(s => (
                      <div key={s.l} style={{ textAlign: "center", padding: "8px 4px", background: "#f8fafc", borderRadius: 8 }}><div style={{ fontSize: 17, fontWeight: 700, color: s.c }}>{s.v}</div><div style={{ fontSize: 10, color: "#94a3b8" }}>{s.l}</div></div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div> : view === "users" && selAgent ? <div>
            <button onClick={() => setSelAgent(null)} style={{ ...bG, padding: "7px 14px", marginBottom: 14, fontSize: 12 }}>← Back to Agents</button>
            <div style={{ background: "#fff", borderRadius: 12, padding: 18, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
                <Avatar name={selAgent.name} size={56} />
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{selAgent.name}</div>
                  <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>{selAgent.email}</div>
                  <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                    <Badge label={selAgent.role} style={{ background: "#ede9fe", color: "#6d28d9" }} />
                    {(() => {
                      const u = users.find(x => x.id === selAgent.id);
                      if (!u?.status) return null;
                      const statusValue = u.status === "Active" ? "Logged-In" : (u.status === "Not Active" || u.status?.toLowerCase() === "logged-out") ? "Logged-Out" : u.status;
                      const sStyle = statusOpts.find(s => s.l === statusValue);
                      return sStyle ? <Badge label={sStyle.l} style={{ background: sStyle.bg, color: sStyle.c }} /> : null;
                    })()}
                  </div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                {[{ l: "Assigned", v: selAgent.assigned, c: "#3b82f6" }, { l: "Resolved", v: selAgent.resolved, c: "#22c55e" }, { l: "Open", v: selAgent.assigned - selAgent.resolved, c: "#f59e0b" }].map(s => (
                  <div key={s.l} style={{ textAlign: "center", padding: "12px 8px", background: "#f8fafc", borderRadius: 10 }}><div style={{ fontSize: 22, fontWeight: 700, color: s.c }}>{s.v}</div><div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{s.l}</div></div>
                ))}
              </div>
            </div>
            <div style={{ background: "#fff", borderRadius: 12, padding: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14, color: "#374151" }}>Assigned Tickets</div>
              {tickets.filter(t => t.assignees?.some(a => a.id === selAgent.id)).length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {tickets.filter(t => t.assignees?.some(a => a.id === selAgent.id)).map(t => (
                    <div key={t.id} onClick={() => { setSelTicket(t); setSelAgent(null); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px", borderRadius: 9, border: "1px solid #f1f5f9", cursor: "pointer", transition: "all 0.2s", background: "#fff" }}
                      onMouseEnter={e => { e.currentTarget.style.background = "#f8fafc"; e.currentTarget.style.borderColor = "#3b82f6"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.borderColor = "#f1f5f9"; }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{t.summary}</div>
                        <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{t.id} · {t.org}</div>
                      </div>
                      <Badge label={t.status} style={{ ...STATUS_COLOR[t.status], fontSize: 11 }} />
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: 24, color: "#94a3b8", fontSize: 13 }}>No assigned tickets</div>
              )}
            </div>
          </div> : null}

          {/* ── SETTINGS ── */}
          {view === "settings" && <div style={{ display: "flex", gap: 18, alignItems: "flex-start" }}>
            <div style={{ width: 194, background: "#fff", borderRadius: 12, padding: 9, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flexShrink: 0 }}>
              {stabs.map(t => (
                <button key={t.id} onClick={() => setSettingsTab(t.id)} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "9px 11px", borderRadius: 7, border: "none", cursor: "pointer", background: settingsTab === t.id ? "#eff6ff" : "transparent", color: settingsTab === t.id ? "#3b82f6" : "#374151", fontSize: 12.5, fontWeight: settingsTab === t.id ? 600 : 400, textAlign: "left", fontFamily: "'DM Sans',sans-serif", marginBottom: 2 }}>
                  <span>{t.icon}</span>{t.label}
                </button>
              ))}
            </div>
            <div style={{ flex: 1 }}>
              {settingsTab === "ticketviews" && <div style={{ background: "#fff", borderRadius: 12, padding: 22, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700 }}>Ticket Views</h3>
                <p style={{ margin: "0 0 18px", fontSize: 12, color: "#64748b" }}>Predefined views for quick ticket filtering.</p>
                {TICKET_VIEWS.map(v => (
                  <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 10, border: "1.5px solid #f1f5f9", marginBottom: 7, background: "#fafafa" }}>
                    <div style={{ fontSize: 20, width: 32, textAlign: "center" }}>{v.icon}</div>
                    <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 600 }}>{v.label}</div><div style={{ fontSize: 11, color: "#94a3b8" }}>{v.desc}</div></div>
                    <span style={{ fontSize: 11, color: "#64748b", background: "#f1f5f9", padding: "3px 9px", borderRadius: 99, fontWeight: 600 }}>{tickets.filter(t => v.filter(t, currentUser)).length}</span>
                    <button onClick={() => { setView("tickets"); setTvFilter(v.id); }} style={{ ...bP, padding: "5px 12px", fontSize: 12 }}>View</button>
                  </div>
                ))}
              </div>}
              {settingsTab === "projectviews" && <div style={{ background: "#fff", borderRadius: 12, padding: 22, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700 }}>Project Views</h3>
                <p style={{ margin: "0 0 18px", fontSize: 12, color: "#64748b" }}>Predefined views for quick project filtering.</p>
                {PROJECT_VIEWS.map(v => (
                  <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 10, border: "1.5px solid #f1f5f9", marginBottom: 7, background: "#fafafa" }}>
                    <div style={{ fontSize: 20, width: 32, textAlign: "center" }}>{v.icon}</div>
                    <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 600 }}>{v.label}</div><div style={{ fontSize: 11, color: "#94a3b8" }}>{v.desc}</div></div>
                    <span style={{ fontSize: 11, color: "#64748b", background: "#f1f5f9", padding: "3px 9px", borderRadius: 99, fontWeight: 600 }}>{projects.filter(p => v.filter(p, currentUser)).length}</span>
                    <button onClick={() => { setView("projects"); setPvFilter(v.id); }} style={{ ...bP, padding: "5px 12px", fontSize: 12, background: "linear-gradient(135deg,#8b5cf6,#6366f1)" }}>View</button>
                  </div>
                ))}
              </div>}
              {settingsTab === "organisations" && <div style={{ background: "#fff", borderRadius: 12, padding: 22, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 700 }}>Organisations ({orgs.length})</h3>
                {currentUser?.role === "Admin" ? (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 9, marginBottom: 18, padding: 14, background: "#f8fafc", borderRadius: 9 }}>
                    <input style={iS} placeholder="Name *" value={newOrg.name || ""} onChange={e => setNewOrg({ ...newOrg, name: e.target.value })} />
                    <input style={iS} placeholder="Domain" value={newOrg.domain} onChange={e => setNewOrg({ ...newOrg, domain: e.target.value })} />
                    <input style={iS} placeholder="Phone" value={newOrg.phone} onChange={e => setNewOrg({ ...newOrg, phone: e.target.value })} />
                    <button onClick={addOrg} style={bP}>Add</button>
                  </div>
                ) : <div style={{ marginBottom: 18, padding: "10px 14px", background: "#fef3c7", color: "#92400e", borderRadius: 8, fontSize: 13, fontWeight: 500 }}>Read Only: Organisation management is restricted to Admins.</div>}
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr>{["Name", "Domain", "Phone", currentUser?.role === "Admin" ? "" : null].filter(s => s !== null).map(h => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
                  <tbody>{orgs.map(o => <tr key={o.id} className="rh">
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{o.name}</td>
                    <td style={{ ...tdStyle, color: "#64748b" }}>{o.domain || "—"}</td>
                    <td style={{ ...tdStyle, color: "#64748b" }}>{o.phone || "—"}</td>
                    {currentUser?.role === "Admin" && <td style={tdStyle}><button onClick={async () => { if (window.confirm("Delete this organization?")) { try { await axios.delete(`${ORGS_API}/${o.id}`); setOrgs(orgs.filter(x => x.id !== o.id)); } catch (err) { console.error("Delete failed:", err); } } }} style={{ border: "none", background: "#fee2e2", color: "#ef4444", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Delete</button></td>}
                  </tr>)}</tbody>
                </table>
              </div>}
              {settingsTab === "categories" && <div style={{ background: "#fff", borderRadius: 12, padding: 22, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 700 }}>Ticket Categories ({categories.length})</h3>
                {currentUser?.role === "Admin" ? (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 9, marginBottom: 18, padding: 14, background: "#f8fafc", borderRadius: 9, alignItems: "center" }}>
                    <input style={iS} placeholder="Category name *" value={newCat.name || ""} onChange={e => setNewCat({ ...newCat, name: e.target.value })} />
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}><label style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Color</label><input type="color" value={newCat.color} onChange={e => setNewCat({ ...newCat, color: e.target.value })} style={{ width: 34, height: 34, border: "none", borderRadius: 7, cursor: "pointer", padding: 2 }} /></div>
                    <button onClick={addCat} style={bP}>Add</button>
                  </div>
                ) : <div style={{ marginBottom: 18, padding: "10px 14px", background: "#fef3c7", color: "#92400e", borderRadius: 8, fontSize: 13, fontWeight: 500 }}>Read Only: Category management is restricted to Admins.</div>}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(190px,1fr))", gap: 9 }}>
                  {categories.map(c => (
                    <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "11px 13px", borderRadius: 9, border: `1.5px solid ${c.color}33`, background: `${c.color}0d` }}>
                      <div style={{ width: 11, height: 11, borderRadius: 3, background: c.color, flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{c.name}</span>
                      <span style={{ fontSize: 11, color: "#94a3b8" }}>{tickets.filter(t => t.category === c.name).length}</span>
                      {currentUser?.role === "Admin" && <button onClick={() => deleteCat(c.id)} style={{ border: "none", background: "#fee2e2", color: "#ef4444", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Delete</button>}
                    </div>
                  ))}
                </div>
              </div>}
              {/* ✅ NEW: Departments Management */}
              {settingsTab === "departments" && <div style={{ background: "#fff", borderRadius: 12, padding: 22, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700 }}>Departments ({departments.length})</h3>
                <p style={{ margin: "0 0 18px", fontSize: 12, color: "#64748b" }}>Manage organizational departments for tickets and projects.</p>
                {currentUser?.role === "Admin" ? (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 9, marginBottom: 18, padding: 14, background: "#f8fafc", borderRadius: 9 }}>
                    <input
                      style={iS}
                      placeholder="Department name *"
                      value={newDept?.name || ""}
                      onChange={e => setNewDept({ name: e.target.value })}
                    />
                    <button onClick={addDept} style={bP}>Add</button>
                  </div>
                ) : <div style={{ marginBottom: 18, padding: "10px 14px", background: "#fef3c7", color: "#92400e", borderRadius: 8, fontSize: 13, fontWeight: 500 }}>Read Only: Department management is restricted to Admins.</div>}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 9 }}>
                  {departments.map(d => {
                    const color = getItemColor(d);
                    return (
                      <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "11px 13px", borderRadius: 9, border: `1.5px solid ${color}33`, background: `${color}0d` }}>
                        <div style={{ width: 11, height: 11, borderRadius: 3, background: color, flexShrink: 0 }} />
                        <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{d.name}</span>
                        {currentUser?.role === "Admin" && <button onClick={() => deleteDept(d.id)} style={{ border: "none", background: "#fee2e2", color: "#ef4444", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Delete</button>}
                      </div>
                    );
                  })}
                </div>
                {departments.length === 0 && <div style={{ textAlign: "center", color: "#94a3b8", padding: 28 }}>No departments yet. Add one to get started.</div>}
              </div>}
              {/* ✅ NEW: Locations Management */}
              {settingsTab === "locations" && <div style={{ background: "#fff", borderRadius: 12, padding: 22, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700 }}>Locations ({locations.length})</h3>
                <p style={{ margin: "0 0 18px", fontSize: 12, color: "#64748b" }}>Manage ticket and project locations/venues.</p>
                {currentUser?.role === "Admin" || currentUser?.role === "Manager" ? (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 9, marginBottom: 18, padding: 14, background: "#f8fafc", borderRadius: 9 }}>
                    <input
                      style={iS}
                      placeholder="Location name *"
                      value={newLocation?.name || ""}
                      onChange={e => setNewLocation({ name: e.target.value })}
                    />
                    <button onClick={addLocation} style={bP}>Add</button>
                  </div>
                ) : <div style={{ marginBottom: 18, padding: "10px 14px", background: "#fef3c7", color: "#92400e", borderRadius: 8, fontSize: 13, fontWeight: 500 }}>Read Only: Location management is restricted to Admins and Managers.</div>}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 9 }}>
                  {locations.map(l => {
                    const color = getItemColor(l);
                    return (
                      <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "11px 13px", borderRadius: 9, border: `1.5px solid ${color}33`, background: `${color}0d` }}>
                        <div style={{ width: 11, height: 11, borderRadius: 3, background: color, flexShrink: 0 }} />
                        <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>📍 {l.name}</span>
                        {(currentUser?.role === "Admin" || currentUser?.role === "Manager") && <button onClick={() => deleteLocation(l.id)} style={{ border: "none", background: "#fee2e2", color: "#ef4444", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Delete</button>}
                      </div>
                    );
                  })}
                </div>
                {locations.length === 0 && <div style={{ textAlign: "center", color: "#94a3b8", padding: 28 }}>No locations yet. Add one to get started.</div>}
              </div>}

              {/* ✅ NEW: Vendors Settings Section */}
              {settingsTab === "vendors" && <div style={{ background: "#fff", borderRadius: 12, padding: 22, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700 }}>🏭 Vendors ({vendors.length})</h3>
                <p style={{ margin: "0 0 18px", fontSize: 12, color: "#64748b" }}>Manage vendors with contact information for sending tickets.</p>
                {currentUser?.role === "Admin" || currentUser?.role === "Manager" ? (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto", gap: 9, marginBottom: 18, padding: 14, background: "#f8fafc", borderRadius: 9 }}>
                    <input
                      style={iS}
                      placeholder="Vendor name *"
                      value={newVendor?.name || ""}
                      onChange={e => setNewVendor({ ...newVendor, name: e.target.value })}
                    />
                    <input
                      type="email"
                      style={iS}
                      placeholder="Email"
                      value={newVendor?.email || ""}
                      onChange={e => setNewVendor({ ...newVendor, email: e.target.value })}
                    />
                    <input
                      style={iS}
                      placeholder="Phone"
                      value={newVendor?.phone || ""}
                      onChange={e => setNewVendor({ ...newVendor, phone: e.target.value })}
                    />
                    <input
                      style={iS}
                      placeholder="Address"
                      value={newVendor?.address || ""}
                      onChange={e => setNewVendor({ ...newVendor, address: e.target.value })}
                    />
                    <button onClick={addVendor} style={bP}>Add</button>
                  </div>
                ) : <div style={{ marginBottom: 18, padding: "10px 14px", background: "#fef3c7", color: "#92400e", borderRadius: 8, fontSize: 13, fontWeight: 500 }}>Read Only: Vendor management is restricted to Admins and Managers.</div>}

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 12 }}>
                  {vendors.map(v => (
                    <div key={v.id} style={{ padding: "14px", borderRadius: 10, border: "1.5px solid #fed7aa", background: "#fef3c7", display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#ea580c" }}>🏭 {v.name}</div>
                          {v.email && <div style={{ fontSize: 11, color: "#92400e", marginTop: 3 }}>✉️ {v.email}</div>}
                          {v.phone && <div style={{ fontSize: 11, color: "#92400e" }}>📞 {v.phone}</div>}
                          {v.address && <div style={{ fontSize: 11, color: "#92400e", marginTop: 3, maxHeight: "40px", overflow: "hidden" }}>📍 {v.address}</div>}
                        </div>
                        {(currentUser?.role === "Admin" || currentUser?.role === "Manager") && (
                          <button onClick={() => deleteVendor(v.id)} style={{ border: "none", background: "#fee2e2", color: "#ef4444", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 12, fontWeight: 600, marginLeft: 8 }}>Delete</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {vendors.length === 0 && <div style={{ textAlign: "center", color: "#94a3b8", padding: 28 }}>No vendors yet. Add one to get started.</div>}
              </div>}

              {settingsTab === "usermgmt" && <div style={{ background: "#fff", borderRadius: 12, padding: 22, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 700 }}>User Management ({users.length} users)</h3>
                {currentUser?.role === "Super Admin" || currentUser?.role === "Admin" ? (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto auto", gap: 9, marginBottom: 18, padding: 14, background: "#f8fafc", borderRadius: 9 }}>
                    <input style={iS} placeholder="Full name *" value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })} />
                    <input style={iS} placeholder="Email *" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} />
                    <input style={iS} type="password" placeholder="Password *" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} />
                    <select style={{ ...sS, width: 110 }} value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })}>{ROLES.filter(r => r !== "Super Admin").map(r => <option key={r}>{r}</option>)}</select>
                    <button onClick={addUser} style={bP}>Add</button>
                  </div>
                ) : currentUser?.role === "Manager" ? (
                  <div style={{ marginBottom: 18, padding: "10px 14px", background: "#fef3c7", color: "#92400e", borderRadius: 8, fontSize: 13, fontWeight: 500 }}>View Only: Managers can view users but cannot add, delete, or change roles.</div>
                ) : (
                  <div style={{ marginBottom: 18, padding: "10px 14px", background: "#fef3c7", color: "#92400e", borderRadius: 8, fontSize: 13, fontWeight: 500 }}>Read Only: User management is restricted to Admins.</div>
                )}
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr>{["User", "Email", "Role", "Status", "Account Status", (currentUser?.role === "Super Admin" || currentUser?.role === "Admin") ? "Actions" : null].filter(Boolean).map(h => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
                  <tbody>{users.map(u => (
                    <tr key={u.id} className="rh">
                      <td style={tdStyle}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><Avatar name={u.name} size={28} /><span style={{ fontSize: 13, fontWeight: 600 }}>{u.name}</span></div></td>
                      <td style={{ ...tdStyle, color: "#64748b", fontSize: 12 }}>{u.email}</td>
                      <td style={tdStyle}><Badge label={u.role} style={{ background: u.role === "Super Admin" ? "#fca5a5" : "#ede9fe", color: u.role === "Super Admin" ? "#991b1b" : "#6d28d9" }} /></td>
                      <td style={tdStyle}>{(() => {
                        // Check DB status field which is updated on login/logout
                        const statusValue = u.status === "Logged-In" ? "Logged-In" : "Logged-Out";
                        const sStyle = statusOpts.find(s => s.l === statusValue);
                        return sStyle ? <Badge label={sStyle.l} style={{ background: sStyle.bg, color: sStyle.c }} /> : <Badge label={statusValue} />;
                      })()}</td>
                      <td style={tdStyle}><Badge label={u.active ? "Activated" : "Deactivated"} style={{ background: u.active ? "#dcfce7" : "#fee2e2", color: u.active ? "#15803d" : "#ef4444" }} /></td>
                      {(currentUser?.role === "Super Admin" || currentUser?.role === "Admin") && u.role !== "Super Admin" && <td style={tdStyle}><div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <select value={u.role} onChange={async (e) => {
                          const newRole = e.target.value;

                          // ✅ Show custom confirmation modal for role change
                          setConfirmModal({
                            show: true,
                            title: `Change ${u.name}'s Role?`,
                            message: `Are you sure you want to change ${u.name}'s role to ${newRole}? This will take effect immediately and cannot be undone.`,
                            onConfirm: async () => {
                              try {
                                const updated = { ...u, role: newRole };
                                await axios.put(`${USERS_API}/${u.id}`, updated);
                                setUsers(users.map(x => x.id === u.id ? updated : x));

                                if (u.id === currentUser.id) {
                                  // Current user's role changed
                                  setCurrentUser({ ...currentUser, role: newRole });
                                  setCustomAlert({ show: true, message: `Your role has been changed to ${newRole}. Page will refresh automatically.`, type: "success" });
                                  // Auto-refresh after 2 seconds
                                  setTimeout(() => window.location.reload(), 2000);
                                } else {
                                  // Other user's role changed - notify them via localStorage broadcast
                                  localStorage.setItem(`role_change_${u.id}`, JSON.stringify({ newRole, timestamp: Date.now() }));
                                  setCustomAlert({ show: true, message: `${u.name}'s role has been changed to ${newRole}.`, type: "success" });
                                }
                                setConfirmModal({ show: false, title: "", message: "", onConfirm: null, onCancel: null });
                              } catch (err) {
                                setCustomAlert({ show: true, message: "Failed to update role", type: "error" });
                                setConfirmModal({ show: false, title: "", message: "", onConfirm: null, onCancel: null });
                              }
                            },
                            onCancel: () => {
                              setConfirmModal({ show: false, title: "", message: "", onConfirm: null, onCancel: null });
                              // Reset dropdown to previous value
                              e.target.value = u.role;
                            }
                          });
                        }} style={{ ...sS, fontSize: 11, padding: "4px 8px" }}>{ROLES.filter(r => r !== "Super Admin").map(r => <option key={r}>{r}</option>)}</select>
                        <button onClick={async () => { try { const updated = { ...u, active: !u.active }; await axios.put(`${USERS_API}/${u.id}`, updated); setUsers(users.map(x => x.id === u.id ? updated : x)); } catch (err) { alert("Failed to update user"); } }} style={{ border: "none", background: u.active ? "#fef9c3" : "#dcfce7", color: u.active ? "#854d0e" : "#15803d", borderRadius: 6, padding: "4px 9px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>{u.active ? "Deactivate" : "Activate"}</button>
                        {u.id !== currentUser.id && <button onClick={async () => { if (window.confirm(`Delete ${u.name}?`)) { try { await axios.delete(`${USERS_API}/${u.id}`); setUsers(users.filter(x => x.id !== u.id)); } catch (err) { console.error("Delete failed:", err); } } }} style={{ border: "none", background: "#fee2e2", color: "#ef4444", borderRadius: 6, padding: "4px 9px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Delete</button>}
                        {/* ✅ NEW: Admin can edit name and password */}
                        <button onClick={() => { setEditUserOpen(u); setEditUserForm({ name: u.name, email: u.email, password: "" }); }} style={{ border: "none", background: "#dbeafe", color: "#1e40af", borderRadius: 6, padding: "4px 9px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Edit</button>
                      </div></td>}
                    </tr>
                  ))}</tbody>
                </table>
              </div>}
              {settingsTab === "customattrs" && <div style={{ background: "#fff", borderRadius: 12, padding: 22, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700 }}>Custom Attributes</h3>
                <p style={{ margin: "0 0 14px", fontSize: 12, color: "#64748b" }}>Custom fields will appear on every new ticket form.</p>
                {currentUser?.role === "Admin" ? (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto auto", gap: 9, marginBottom: 18, padding: 14, background: "#f8fafc", borderRadius: 9, alignItems: "end" }}>
                    <input style={iS} placeholder="Field name *" value={newAttr.name} onChange={e => setNewAttr({ ...newAttr, name: e.target.value })} />
                    <select style={{ ...sS, width: 104 }} value={newAttr.type} onChange={e => setNewAttr({ ...newAttr, type: e.target.value })}>{["text", "number", "select", "date", "checkbox"].map(t => <option key={t}>{t}</option>)}</select>
                    {newAttr.type === "select" ? <input style={{ ...iS, width: 160 }} placeholder="Options (comma-sep)" value={newAttr.options} onChange={e => setNewAttr({ ...newAttr, options: e.target.value })} /> : <div />}
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#374151", whiteSpace: "nowrap" }}><input type="checkbox" checked={newAttr.required} onChange={e => setNewAttr({ ...newAttr, required: e.target.checked })} />Required</label>
                    <button onClick={addAttr} style={bP}>Add</button>
                  </div>
                ) : <div style={{ marginBottom: 18, padding: "10px 14px", background: "#fef3c7", color: "#92400e", borderRadius: 8, fontSize: 13, fontWeight: 500 }}>Read Only: Attribute management is restricted to Admins.</div>}
                {customAttrs.map(a => (
                  <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 11, padding: "12px 15px", borderRadius: 9, border: "1.5px solid #f1f5f9", marginBottom: 7, background: "#fafafa" }}>
                    <div style={{ width: 34, height: 34, background: "#eff6ff", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>{a.type === "text" ? "Aa" : a.type === "number" ? "#" : a.type === "select" ? "≡" : a.type === "date" ? "📅" : "☑"}</div>
                    <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 600 }}>{a.name}{a.required && <span style={{ color: "#ef4444", marginLeft: 3 }}>*</span>}</div><div style={{ fontSize: 11, color: "#94a3b8" }}>Type: {a.type}{a.options?.length ? ` · ${a.options.join(", ")}` : ""}</div></div>
                    {currentUser?.role === "Admin" && <button onClick={() => deleteAttr(a.id)} style={{ border: "none", background: "#fee2e2", color: "#ef4444", borderRadius: 6, padding: "5px 11px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Delete</button>}
                  </div>
                ))}
                {customAttrs.length === 0 && <div style={{ textAlign: "center", color: "#94a3b8", padding: 28 }}>No custom attributes yet.</div>}
              </div>}
              {settingsTab === "dbmgmt" && <div style={{ background: "#fff", borderRadius: 12, padding: 22, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700 }}>Database Management</h3>
                <p style={{ margin: "0 0 18px", fontSize: 12, color: "#64748b" }}>Export and import data from the database.</p>

                {/* Data Type Selection */}
                <div style={{ marginBottom: 18, padding: 14, background: "#f8fafc", borderRadius: 9 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 10 }}>Select Data Type</div>
                  <select
                    value={targetTable}
                    onChange={(e) => { setTargetTable(e.target.value); setExportFilterType("all"); setExportFilterValue(""); }}
                    style={{ ...sS, minWidth: 160, fontSize: 13, padding: "7px 10px" }}
                  >
                    <option value="tickets">Tickets</option>
                    <option value="users">Users</option>
                    <option value="orgs">Organizations</option>
                    <option value="categories">Categories</option>
                  </select>
                </div>

                {/* Classification/Filter Selection */}
                <div style={{ marginBottom: 18, padding: 14, background: "#f8fafc", borderRadius: 9 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 10 }}>Classify/Filter for Export</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <select
                      value={exportFilterType}
                      onChange={(e) => { setExportFilterType(e.target.value); setExportFilterValue(""); }}
                      style={{ ...sS, fontSize: 13, padding: "7px 10px" }}
                    >
                      <option value="all">All Data</option>
                      {targetTable === "tickets" && (
                        <>
                          <option value="assignee">By Assignee</option>
                          <option value="category">By Category</option>
                          <option value="type">By Type (Ticket/Webcast)</option>
                        </>
                      )}
                      {targetTable === "users" && <option value="role">By Role</option>}
                      {targetTable === "orgs" && <option value="domain">By Domain</option>}
                      {targetTable === "categories" && <option value="color">By Color</option>}
                    </select>

                    {exportFilterType !== "all" && (
                      <select
                        value={exportFilterValue}
                        onChange={(e) => setExportFilterValue(e.target.value)}
                        style={{ ...sS, fontSize: 13, padding: "7px 10px" }}
                      >
                        <option value="">Select {exportFilterType}</option>
                        {exportFilterType === "assignee" && tickets.flatMap(t => t.assignees || []).map(a => (
                          <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                        {exportFilterType === "category" && categories.map(c => (
                          <option key={c.id} value={c.name}>{c.name}</option>
                        ))}
                        {exportFilterType === "type" && (
                          <>
                            <option value="ticket">Tickets Only</option>
                            <option value="webcast">Webcasts Only</option>
                          </>
                        )}
                        {exportFilterType === "role" && ["Admin", "Manager", "Agent", "Viewer"].map(r => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                        {exportFilterType === "domain" && orgs.map(o => (
                          <option key={o.id} value={o.domain}>{o.domain || "No Domain"}</option>
                        ))}
                        {exportFilterType === "color" && categories.map(c => (
                          <option key={c.id} value={c.color} style={{ background: c.color }}>{c.color}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                {/* Export/Import Buttons */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 14, background: "#f8fafc", borderRadius: 9 }}>
                  {/* Export Button */}
                  <button
                    onClick={handleExport}
                    style={{ ...bP, padding: "8px 16px", fontSize: 13, background: "#22c55e", color: "#fff", fontWeight: 600 }}
                  >
                    📥 Export {targetTable}{exportFilterType !== "all" ? ` (${exportFilterType})` : ""}
                  </button>

                  {/* Import Button */}
                  <label style={{ ...bP, padding: "8px 16px", fontSize: 13, background: "#3b82f6", color: "#fff", cursor: "pointer", display: "inline-flex", alignItems: "center", fontWeight: 600 }}>
                    📤 Import {targetTable}
                    <input type="file" accept=".csv,.json" onChange={handleSelectiveImport} style={{ display: "none" }} />
                  </label>
                </div>
              </div>}
            </div>
          </div>}

        </div>
      </div>

      {/* ── NEW TICKET MODAL (v1 form + webcast fields) ── */}
      <Modal open={showNewTicket} onClose={() => { setShowNewTicket(false); setShowAssigneeDD(false); }} title="Create New Ticket" width={700}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 18px" }}>
          <FF label="Organisation" required><select style={sS} value={form.org} onChange={e => setForm({ ...form, org: e.target.value })}><option value="">Select…</option>{orgs.map(o => <option key={o.id}>{o.name}</option>)}</select></FF>
          <FF label="Department">
            <div style={{ position: "relative" }}>
              <input type="text" placeholder="Search department..." value={departmentSearch ? departmentSearch : (form.department ? departments.find(d => d.name === form.department)?.name || "" : "")} onChange={e => setDepartmentSearch(e.target.value)} onFocus={() => { setDepartmentSearch(""); setShowDepartmentDD(true); }} style={{ ...iS, width: "100%", fontSize: 12 }} />
              {showDepartmentDD && <>
                <div style={{ position: "fixed", inset: 0, zIndex: 199 }} onClick={() => { setShowDepartmentDD(false); setDepartmentSearch(""); }} />
                <div style={{ position: "absolute", top: "calc(100% + 3px)", left: 0, right: 0, background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 8, zIndex: 200, boxShadow: "0 4px 12px rgba(0,0,0,0.1)", maxHeight: 200, overflowY: "auto" }}>
                  <div style={{ padding: 8, borderBottom: "1px solid #f1f5f9", position: "sticky", top: 0, background: "#fff" }}>
                    <input type="text" placeholder="Search departments..." value={departmentSearch} onChange={e => setDepartmentSearch(e.target.value)} onClick={e => e.stopPropagation()} autoFocus style={{ ...iS, width: "100%", fontSize: 12 }} />
                  </div>
                  {departments.filter(d => departmentSearch === "" || d.name.toLowerCase().includes(departmentSearch.toLowerCase())).map(d => (
                    <div key={d.id} onClick={() => { setForm({ ...form, department: d.name }); setShowDepartmentDD(false); setDepartmentSearch(""); }} style={{ padding: "8px 12px", cursor: "pointer", borderBottom: "1px solid #f1f5f9" }}>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{d.name}</div>
                    </div>
                  ))}
                  {departments.filter(d => departmentSearch === "" || d.name.toLowerCase().includes(departmentSearch.toLowerCase())).length === 0 && <div style={{ padding: "12px", textAlign: "center", fontSize: 12, color: "#94a3b8" }}>No departments found</div>}
                </div>
              </>}
            </div>
          </FF>
          <FF label="Contact Name"><input style={iS} placeholder="Ticket Requestor" value={form.contact} onChange={e => setForm({ ...form, contact: e.target.value })} /></FF>
          <FF label="Reported By"><input style={iS} placeholder="Who is raising this ticket?" value={form.reportedBy} onChange={e => setForm({ ...form, reportedBy: e.target.value })} /></FF>
          <FF label="Priority"><select style={sS} value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>{PRIORITIES.map(p => <option key={p}>{p}</option>)}</select></FF>
          <FF label="Category">
            <div style={{ position: "relative" }}>
              <input type="text" placeholder="Search category..." value={categorySearch ? categorySearch : (form.category ? categories.find(c => c.name === form.category)?.name || "" : "")} onChange={e => setCategorySearch(e.target.value)} onFocus={() => { setCategorySearch(""); setShowCategoryDD(true); }} style={{ ...iS, width: "100%", fontSize: 12 }} />
              {showCategoryDD && <>
                <div style={{ position: "fixed", inset: 0, zIndex: 199 }} onClick={() => { setShowCategoryDD(false); setCategorySearch(""); }} />
                <div style={{ position: "absolute", top: "calc(100% + 3px)", left: 0, right: 0, background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 8, zIndex: 200, boxShadow: "0 4px 12px rgba(0,0,0,0.1)", maxHeight: 200, overflowY: "auto" }}>
                  <div style={{ padding: 8, borderBottom: "1px solid #f1f5f9", position: "sticky", top: 0, background: "#fff" }}>
                    <input type="text" placeholder="Search categories..." value={categorySearch} onChange={e => setCategorySearch(e.target.value)} onClick={e => e.stopPropagation()} autoFocus style={{ ...iS, width: "100%", fontSize: 12 }} />
                  </div>
                  {categories.filter(c => categorySearch === "" || c.name.toLowerCase().includes(categorySearch.toLowerCase())).map(c => (
                    <div key={c.id} onClick={() => { setForm({ ...form, category: c.name }); setShowCategoryDD(false); setCategorySearch(""); }} style={{ padding: "8px 12px", cursor: "pointer", borderBottom: "1px solid #f1f5f9" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 12, height: 12, borderRadius: 3, background: c.color }} />
                        <div style={{ fontSize: 12, fontWeight: 600 }}>{c.name}</div>
                      </div>
                    </div>
                  ))}
                  {categories.filter(c => categorySearch === "" || c.name.toLowerCase().includes(categorySearch.toLowerCase())).length === 0 && <div style={{ padding: "12px", textAlign: "center", fontSize: 12, color: "#94a3b8" }}>No categories found</div>}
                </div>
              </>}
            </div>
          </FF>
          <FF label="Location / Venue">
            <div style={{ position: "relative" }}>
              <input type="text" placeholder="Search location..." value={locationSearch ? locationSearch : (form.location ? locations.find(l => l.name === form.location)?.name || "" : "")} onChange={e => setLocationSearch(e.target.value)} onFocus={() => { setLocationSearch(""); setShowLocationDD(true); }} style={{ ...iS, width: "100%", fontSize: 12 }} />
              {showLocationDD && <>
                <div style={{ position: "fixed", inset: 0, zIndex: 199 }} onClick={() => { setShowLocationDD(false); setLocationSearch(""); }} />
                <div style={{ position: "absolute", top: "calc(100% + 3px)", left: 0, right: 0, background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 8, zIndex: 200, boxShadow: "0 4px 12px rgba(0,0,0,0.1)", maxHeight: 200, overflowY: "auto" }}>
                  <div style={{ padding: 8, borderBottom: "1px solid #f1f5f9", position: "sticky", top: 0, background: "#fff" }}>
                    <input type="text" placeholder="Search locations..." value={locationSearch} onChange={e => setLocationSearch(e.target.value)} onClick={e => e.stopPropagation()} autoFocus style={{ ...iS, width: "100%", fontSize: 12 }} />
                  </div>
                  {locations.filter(l => locationSearch === "" || l.name.toLowerCase().includes(locationSearch.toLowerCase())).map(l => (
                    <div key={l.id} onClick={() => { setForm({ ...form, location: l.name }); setShowLocationDD(false); setLocationSearch(""); }} style={{ padding: "8px 12px", cursor: "pointer", borderBottom: "1px solid #f1f5f9" }}>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{l.name}</div>
                    </div>
                  ))}
                  {locations.filter(l => locationSearch === "" || l.name.toLowerCase().includes(locationSearch.toLowerCase())).length === 0 && <div style={{ padding: "12px", textAlign: "center", fontSize: 12, color: "#94a3b8" }}>No locations found</div>}
                </div>
              </>}
            </div>
          </FF>
          <FF label="Due Date"><input type="date" style={iS} value={form.dueDate || ""} onChange={e => setForm({ ...form, dueDate: e.target.value })} /></FF>
        </div>
        <FF label="Assignees">
          {currentUser?.role === "Admin" || currentUser?.role === "Manager" ? (
            <div style={{ position: "relative" }}>
              <div onClick={() => setShowAssigneeDD(!showAssigneeDD)} style={{ ...iS, cursor: "pointer", minHeight: 40, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 5, padding: form.assignees.length ? "6px 10px" : "9px 12px" }}>
                {!form.assignees.length && <span style={{ color: "#94a3b8" }}>Click to assign agents…</span>}
                {form.assignees.map(a => <span key={a.id} style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 6px 2px 3px", background: "#dbeafe", color: "#1d4ed8", borderRadius: 99, fontSize: 12, fontWeight: 600 }}>
                  <Avatar name={a.name} size={17} />{a.name.split(" ")[0]}<span onClick={e => { e.stopPropagation(); toggleAssignee(a); }} style={{ cursor: "pointer", fontWeight: 700, marginLeft: 2 }}>×</span>
                </span>)}
                <span style={{ marginLeft: "auto", color: "#94a3b8", fontSize: 11 }}>▾</span>
              </div>
              {showAssigneeDD && <div style={{ position: "absolute", top: "calc(100% + 3px)", left: 0, right: 0, background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 10, zIndex: 200, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", overflow: "hidden" }}>
                <div style={{ padding: 7, borderBottom: "1px solid #f1f5f9" }}><input style={{ ...iS, fontSize: 13 }} placeholder="Search agents…" value={assigneeSearch} onChange={e => setAssigneeSearch(e.target.value)} onClick={e => e.stopPropagation()} autoFocus /></div>
                {users.filter(u => u.active && u.name.toLowerCase().includes(assigneeSearch.toLowerCase())).map(u => {
                  const sel = form.assignees.find(a => a.id === u.id); return (
                    <div key={u.id} onClick={() => { toggleAssignee(u); setShowAssigneeDD(false); }} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 13px", cursor: "pointer", background: sel ? "#eff6ff" : "#fff" }}>
                      <Avatar name={u.name} size={26} /><div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 600 }}>{u.name}</div><div style={{ fontSize: 11, color: "#94a3b8" }}>{u.role}</div></div>
                      {sel && <span style={{ color: "#3b82f6", fontWeight: 700 }}>✓</span>}
                    </div>);
                })}
              </div>}
            </div>
          ) : (
            <div style={{ padding: "10px 12px", background: "#eff6ff", border: "1.5px solid #bfdbfe", borderRadius: 8, color: "#1d4ed8", fontSize: 13 }}>
              Only Admins and Managers can assign users. Please create the ticket first, then assign users in ticket details.
            </div>
          )}
        </FF>
        <FF label="Summary" required><input style={iS} placeholder="Brief description of the issue" value={form.summary} onChange={e => setForm({ ...form, summary: e.target.value })} /></FF>
        <FF label="Description"><textarea style={{ ...iS, height: 88, resize: "vertical" }} placeholder="Detailed description…" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></FF>
        {form.category === "Webcast" && <WebcastFields f={form} setF={setForm} />}
        {customAttrs.length > 0 && <>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 9, marginTop: 4 }}>Custom Fields</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 18px" }}>
            {customAttrs.map(a => <FF key={a.id} label={a.name} required={a.required}>
              {a.type === "select" ? <select style={sS} value={form.customAttrs[a.name] || ""} onChange={e => setForm({ ...form, customAttrs: { ...form.customAttrs, [a.name]: e.target.value } })}><option value="">Select…</option>{a.options?.map(o => <option key={o}>{o}</option>)}</select>
                : a.type === "checkbox" ? <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13 }}><input type="checkbox" checked={!!form.customAttrs[a.name]} onChange={e => setForm({ ...form, customAttrs: { ...form.customAttrs, [a.name]: e.target.checked } })} />{a.name}</label>
                  : <input type={a.type === "date" ? "date" : "text"} style={iS} value={form.customAttrs[a.name] || ""} onChange={e => setForm({ ...form, customAttrs: { ...form.customAttrs, [a.name]: e.target.value } })} />}
            </FF>)}
          </div>
        </>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 9, marginTop: 6 }}>
          <button onClick={() => { setShowNewTicket(false); setShowAssigneeDD(false); }} style={bG}>Cancel</button>
          <button onClick={handleSubmit} style={bP}>Create Ticket</button>
        </div>
      </Modal>

      {/* ── NEW PROJECT MODAL ── */}
      <Modal open={showNewProject} onClose={() => setShowNewProject(false)} title="Create New Project" width={700}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 18px" }}>
          <FF label="Organisation" required><select style={sS} value={projForm.org} onChange={e => setProjForm({ ...projForm, org: e.target.value })}><option value="">Select…</option>{orgs.map(o => <option key={o.id}>{o.name}</option>)}</select></FF>
          <FF label="Department">
            <div style={{ position: "relative" }}>
              <input type="text" placeholder="Search department..." value={departmentSearch ? departmentSearch : (projForm.department ? departments.find(d => d.name === projForm.department)?.name || "" : "")} onChange={e => setDepartmentSearch(e.target.value)} onFocus={() => { setDepartmentSearch(""); setShowDepartmentDD(true); }} style={{ ...iS, width: "100%", fontSize: 12 }} />
              {showDepartmentDD && <>
                <div style={{ position: "fixed", inset: 0, zIndex: 199 }} onClick={() => { setShowDepartmentDD(false); setDepartmentSearch(""); }} />
                <div style={{ position: "absolute", top: "calc(100% + 3px)", left: 0, right: 0, background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 8, zIndex: 200, boxShadow: "0 4px 12px rgba(0,0,0,0.1)", maxHeight: 200, overflowY: "auto" }}>
                  <div style={{ padding: 8, borderBottom: "1px solid #f1f5f9", position: "sticky", top: 0, background: "#fff" }}>
                    <input type="text" placeholder="Search departments..." value={departmentSearch} onChange={e => setDepartmentSearch(e.target.value)} onClick={e => e.stopPropagation()} autoFocus style={{ ...iS, width: "100%", fontSize: 12 }} />
                  </div>
                  {departments.filter(d => departmentSearch === "" || d.name.toLowerCase().includes(departmentSearch.toLowerCase())).map(d => (
                    <div key={d.id} onClick={() => { setProjForm({ ...projForm, department: d.name }); setShowDepartmentDD(false); setDepartmentSearch(""); }} style={{ padding: "8px 12px", cursor: "pointer", borderBottom: "1px solid #f1f5f9" }}>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{d.name}</div>
                    </div>
                  ))}
                  {departments.filter(d => departmentSearch === "" || d.name.toLowerCase().includes(departmentSearch.toLowerCase())).length === 0 && <div style={{ padding: "12px", textAlign: "center", fontSize: 12, color: "#94a3b8" }}>No departments found</div>}
                </div>
              </>}
            </div>
          </FF>
          <FF label="Reported By"><input style={iS} value={projForm.reportedBy} onChange={e => setProjForm({ ...projForm, reportedBy: e.target.value })} /></FF>
          <FF label="Priority"><select style={sS} value={projForm.priority} onChange={e => setProjForm({ ...projForm, priority: e.target.value })}>{PROJECT_PRIORITIES.map(p => <option key={p}>{p}</option>)}</select></FF>
          <FF label="Category">
            <div style={{ position: "relative" }}>
              <input type="text" placeholder="Search category..." value={projCategorySearch ? projCategorySearch : (projForm.category ? projectCategories.find(c => c.name === projForm.category)?.name || "" : "")} onChange={e => setProjCategorySearch(e.target.value)} onFocus={() => { setProjCategorySearch(""); setShowProjCategoryDD(true); }} style={{ ...iS, width: "100%", fontSize: 12 }} />
              {showProjCategoryDD && <>
                <div style={{ position: "fixed", inset: 0, zIndex: 199 }} onClick={() => { setShowProjCategoryDD(false); setProjCategorySearch(""); }} />
                <div style={{ position: "absolute", top: "calc(100% + 3px)", left: 0, right: 0, background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 8, zIndex: 200, boxShadow: "0 4px 12px rgba(0,0,0,0.1)", maxHeight: 200, overflowY: "auto" }}>
                  <div style={{ padding: 8, borderBottom: "1px solid #f1f5f9", position: "sticky", top: 0, background: "#fff" }}>
                    <input type="text" placeholder="Search categories..." value={projCategorySearch} onChange={e => setProjCategorySearch(e.target.value)} onClick={e => e.stopPropagation()} autoFocus style={{ ...iS, width: "100%", fontSize: 12 }} />
                  </div>
                  {projectCategories.filter(c => projCategorySearch === "" || c.name.toLowerCase().includes(projCategorySearch.toLowerCase())).map(c => (
                    <div key={c.id} onClick={() => { setProjForm({ ...projForm, category: c.name }); setShowProjCategoryDD(false); setProjCategorySearch(""); }} style={{ padding: "8px 12px", cursor: "pointer", borderBottom: "1px solid #f1f5f9" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 12, height: 12, borderRadius: 3, background: c.color }} />
                        <div style={{ fontSize: 12, fontWeight: 600 }}>{c.name}</div>
                      </div>
                    </div>
                  ))}
                  {projectCategories.filter(c => projCategorySearch === "" || c.name.toLowerCase().includes(projCategorySearch.toLowerCase())).length === 0 && <div style={{ padding: "12px", textAlign: "center", fontSize: 12, color: "#94a3b8" }}>No categories found</div>}
                </div>
              </>}
            </div>
          </FF>
          <FF label="Location">
            <div style={{ position: "relative" }}>
              <input type="text" placeholder="Search location..." value={locationSearch ? locationSearch : (projForm.location ? locations.find(l => l.name === projForm.location)?.name || "" : "")} onChange={e => setLocationSearch(e.target.value)} onFocus={() => { setLocationSearch(""); setShowLocationDD(true); }} style={{ ...iS, width: "100%", fontSize: 12 }} />
              {showLocationDD && <>
                <div style={{ position: "fixed", inset: 0, zIndex: 199 }} onClick={() => { setShowLocationDD(false); setLocationSearch(""); }} />
                <div style={{ position: "absolute", top: "calc(100% + 3px)", left: 0, right: 0, background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 8, zIndex: 200, boxShadow: "0 4px 12px rgba(0,0,0,0.1)", maxHeight: 200, overflowY: "auto" }}>
                  <div style={{ padding: 8, borderBottom: "1px solid #f1f5f9", position: "sticky", top: 0, background: "#fff" }}>
                    <input type="text" placeholder="Search locations..." value={locationSearch} onChange={e => setLocationSearch(e.target.value)} onClick={e => e.stopPropagation()} autoFocus style={{ ...iS, width: "100%", fontSize: 12 }} />
                  </div>
                  {locations.filter(l => locationSearch === "" || l.name.toLowerCase().includes(locationSearch.toLowerCase())).map(l => (
                    <div key={l.id} onClick={() => { setProjForm({ ...projForm, location: l.name }); setShowLocationDD(false); setLocationSearch(""); }} style={{ padding: "8px 12px", cursor: "pointer", borderBottom: "1px solid #f1f5f9" }}>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{l.name}</div>
                    </div>
                  ))}
                  {locations.filter(l => locationSearch === "" || l.name.toLowerCase().includes(locationSearch.toLowerCase())).length === 0 && <div style={{ padding: "12px", textAlign: "center", fontSize: 12, color: "#94a3b8" }}>No locations found</div>}
                </div>
              </>}
            </div>
          </FF>
          <FF label="Due Date"><input type="date" style={iS} value={projForm.dueDate} onChange={e => setProjForm({ ...projForm, dueDate: e.target.value })} /></FF>
        </div>
        {projForm.category === "Webcast" && <WebcastFields f={projForm} setF={setProjForm} />}
        <FF label="Assignees">
          <div style={{ position: "relative" }}>
            <div onClick={() => setShowAssigneeDD(!showAssigneeDD)} style={{ ...iS, cursor: "pointer", minHeight: 40, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 5, padding: projForm.assignees.length ? "6px 10px" : "9px 12px" }}>
              {!projForm.assignees.length && <span style={{ color: "#94a3b8" }}>Click to assign users…</span>}
              {projForm.assignees.map(a => <span key={a.id} style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 6px 2px 3px", background: "#f5f3ff", color: "#6d28d9", borderRadius: 99, fontSize: 12, fontWeight: 600 }}>
                <Avatar name={a.name} size={17} />{a.name.split(" ")[0]}<span onClick={e => { e.stopPropagation(); setProjForm({ ...projForm, assignees: projForm.assignees.filter(x => x.id !== a.id) }); }} style={{ cursor: "pointer", fontWeight: 700, marginLeft: 2 }}>×</span>
              </span>)}
              <span style={{ marginLeft: "auto", color: "#94a3b8", fontSize: 11 }}>▾</span>
            </div>
            {showAssigneeDD && <div style={{ position: "absolute", top: "calc(100% + 3px)", left: 0, right: 0, background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 10, zIndex: 200, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", overflow: "hidden", maxHeight: 300, overflowY: "auto" }}>
              <div style={{ padding: 7, borderBottom: "1px solid #f1f5f9", position: "sticky", top: 0, background: "#fff" }}><input style={{ ...iS, fontSize: 13 }} placeholder="Search users…" value={assigneeSearch} onChange={e => setAssigneeSearch(e.target.value)} onClick={e => e.stopPropagation()} autoFocus /></div>
              {users.filter(u => u.active && u.name.toLowerCase().includes(assigneeSearch.toLowerCase())).map(u => {
                const sel = projForm.assignees.find(a => a.id === u.id); return (
                  <div key={u.id} onClick={() => { setProjForm({ ...projForm, assignees: sel ? projForm.assignees.filter(a => a.id !== u.id) : [...projForm.assignees, u] }); setShowAssigneeDD(false); }} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 13px", cursor: "pointer", background: sel ? "#eff6ff" : "#fff", borderBottom: "1px solid #f1f5f9" }}>
                    <Avatar name={u.name} size={26} /><div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 600 }}>{u.name}</div><div style={{ fontSize: 11, color: "#94a3b8" }}>{u.role}</div></div>
                    {sel && <span style={{ color: "#8b5cf6", fontWeight: 700 }}>✓</span>}
                  </div>);
              })}
            </div>}
          </div>
        </FF>
        <FF label="Project Title" required><input style={iS} placeholder="Brief project name" value={projForm.title} onChange={e => setProjForm({ ...projForm, title: e.target.value })} /></FF>
        <FF label="Description"><textarea style={{ ...iS, height: 88, resize: "vertical" }} placeholder="Detailed description…" value={projForm.description} onChange={e => setProjForm({ ...projForm, description: e.target.value })} /></FF>
        {projForm.category === "Webcast" && <WebcastFields f={projForm} setF={setProjForm} />}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 9, marginTop: 6 }}>
          <button onClick={() => setShowNewProject(false)} style={bG}>Cancel</button>
          <button onClick={handleProjectSubmit} style={{ ...bP, background: "linear-gradient(135deg,#8b5cf6,#6366f1)" }}>Create Project</button>
        </div>
      </Modal>

      {/* ── TICKET DETAIL MODAL (v1 full - timeline, forward, custom attrs, vendor) ── */}
      <Modal open={!!selTicket} onClose={() => { setSelTicket(null); setShowForward(false); setFwdReason(""); setEditMode(false); setEditTicket(null); }} title={selTicket?.id || ""} width={720}>
        {selTicket && <div>
          {/* Edit/View Toggle Button */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 14 }}>
            {!editMode ? (
              <button onClick={() => { setEditMode(true); setEditTicket({ ...selTicket }); }} style={{ padding: "6px 14px", fontSize: 12, fontWeight: 600, borderRadius: 7, border: "none", cursor: "pointer", background: "#3b82f6", color: "#fff" }}>✏️ Edit Ticket</button>
            ) : (
              <>
                <button onClick={() => { setEditMode(false); setEditTicket(null); }} style={{ padding: "6px 14px", fontSize: 12, fontWeight: 600, borderRadius: 7, border: "1.5px solid #e2e8f0", cursor: "pointer", background: "#fff", color: "#64748b" }}>Cancel</button>
                <button onClick={async () => { try { await axios.put(`${TICKETS_API}/${selTicket.id}`, { ...editTicket, updated: new Date().toISOString() }); setTickets(t => t.map(x => x.id === selTicket.id ? { ...editTicket, updated: new Date() } : x)); setSelTicket(editTicket); setEditMode(false); setEditTicket(null); showToast("Ticket updated successfully ✓", "success"); } catch (e) { showToast("Failed to save ticket", "error"); } }} style={{ padding: "6px 14px", fontSize: 12, fontWeight: 600, borderRadius: 7, border: "none", cursor: "pointer", background: "#22c55e", color: "#fff" }}>💾 Save Changes</button>
              </>
            )}
          </div>

          {editMode && editTicket ? (
            /* ── EDIT MODE ── */
            <div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", display: "block", marginBottom: 5 }}>Summary *</label>
                <input type="text" value={editTicket.summary} onChange={e => setEditTicket({ ...editTicket, summary: e.target.value })} style={{ ...iS, width: "100%", fontSize: 13 }} />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", display: "block", marginBottom: 5 }}>Description</label>
                <textarea value={editTicket.description || ""} onChange={e => setEditTicket({ ...editTicket, description: e.target.value })} style={{ ...iS, width: "100%", fontSize: 13, height: 100, resize: "vertical" }} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, marginBottom: 14 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", display: "block", marginBottom: 5 }}>Organisation *</label>
                  <select value={editTicket.org} onChange={e => setEditTicket({ ...editTicket, org: e.target.value })} style={{ ...iS, width: "100%", fontSize: 13 }}>
                    <option value="">Select…</option>
                    {orgs.map(o => <option key={o.id}>{o.name}</option>)}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", display: "block", marginBottom: 5 }}>Department</label>
                  <select value={editTicket.department} onChange={e => setEditTicket({ ...editTicket, department: e.target.value })} style={{ ...iS, width: "100%", fontSize: 13 }}>
                    <option value="">Select…</option>
                    {departments.map(d => <option key={d.id}>{d.name}</option>)}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", display: "block", marginBottom: 5 }}>Contact</label>
                  <input type="text" value={editTicket.contact} onChange={e => setEditTicket({ ...editTicket, contact: e.target.value })} style={{ ...iS, width: "100%", fontSize: 13 }} />
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", display: "block", marginBottom: 5 }}>Reported By</label>
                  <input type="text" value={editTicket.reportedBy} onChange={e => setEditTicket({ ...editTicket, reportedBy: e.target.value })} style={{ ...iS, width: "100%", fontSize: 13 }} />
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", display: "block", marginBottom: 5 }}>Category</label>
                  <select value={editTicket.category} onChange={e => setEditTicket({ ...editTicket, category: e.target.value })} style={{ ...iS, width: "100%", fontSize: 13 }}>
                    <option value="">Select…</option>
                    {categories.map(c => <option key={c.id}>{c.name}</option>)}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", display: "block", marginBottom: 5 }}>Location</label>
                  <select value={editTicket.location || ""} onChange={e => setEditTicket({ ...editTicket, location: e.target.value })} style={{ ...iS, width: "100%", fontSize: 13 }}>
                    <option value="">Select…</option>
                    {locations.map(l => <option key={l.id}>{l.name}</option>)}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", display: "block", marginBottom: 5 }}>Priority</label>
                  <select value={editTicket.priority} onChange={e => setEditTicket({ ...editTicket, priority: e.target.value })} style={{ ...iS, width: "100%", fontSize: 13 }}>
                    {PRIORITIES.map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", display: "block", marginBottom: 5 }}>Due Date</label>
                  <input type="date" value={editTicket.dueDate ? new Date(editTicket.dueDate).toISOString().split('T')[0] : ""} onChange={e => setEditTicket({ ...editTicket, dueDate: e.target.value ? new Date(e.target.value).toISOString() : "" })} style={{ ...iS, width: "100%", fontSize: 13 }} />
                </div>
              </div>
            </div>
          ) : (
            /* ── VIEW MODE ── */
            <div>
              <div style={{ display: "flex", gap: 9, marginBottom: 16, flexWrap: "wrap" }}>
                <Badge label={selTicket.status} style={{ ...STATUS_COLOR[selTicket.status], padding: "4px 12px", fontSize: 12 }} />
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 9, height: 9, borderRadius: "50%", background: PRIORITY_COLOR[selTicket.priority] }} /><span style={{ fontSize: 13, fontWeight: 600 }}>{selTicket.priority} Priority</span></div>
                {selTicket.isWebcast && <Badge label="📡 Webcast" style={{ background: "#fff7ed", color: "#f97316" }} />}
                <span style={{ fontSize: 12, color: "#94a3b8" }}>Created {new Date(selTicket.created).toLocaleString()}</span>
              </div>
              <h2 style={{ margin: "0 0 9px", fontSize: 17, fontWeight: 700, color: "#1e293b" }}>
                {selTicket.summary}
              </h2>
              <p style={{ margin: "0 0 16px", color: "#64748b", fontSize: 14, lineHeight: 1.6 }}>
                {selTicket.description}
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, marginBottom: 14 }}>
                {[
                  { l: "Organisation", v: selTicket.org },
                  { l: "Department", v: selTicket.department || "—" },
                  { l: "Contact", v: selTicket.contact || "—" },
                  { l: "Reported By", v: selTicket.reportedBy || "—" },
                  { l: "Category", v: selTicket.category || "—" },
                  { l: "Location", v: selTicket.location || "—" },
                  { l: "Due Date", v: selTicket.dueDate ? new Date(selTicket.dueDate).toLocaleDateString() : "—" },
                  { l: "Priority", v: selTicket.priority }
                ].map(f => (
                  <div key={f.l} style={{ background: "#f8fafc", padding: "9px 13px", borderRadius: 9 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", marginBottom: 3 }}>{f.l}</div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{f.v}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selTicket.customAttrs && Object.keys(selTicket.customAttrs).length > 0 && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, marginBottom: 14 }}>
            {Object.entries(selTicket.customAttrs).map(([k, v]) => <div key={k} style={{ background: "#fffbeb", padding: "9px 13px", borderRadius: 9, border: "1px solid #fde68a" }}><div style={{ fontSize: 10, fontWeight: 600, color: "#92400e", textTransform: "uppercase", marginBottom: 3 }}>{k}</div><div style={{ fontSize: 13, fontWeight: 500 }}>{String(v) || "—"}</div></div>)}
          </div>}
          <div style={{ marginBottom: 14, padding: "11px 13px", background: "#f8fafc", borderRadius: 9 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", marginBottom: 7 }}>Assignees</div>
            {currentUser?.role === "Admin" || currentUser?.role === "Manager" ? (
              <div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 10 }}>
                  {(selTicket.assignees || []).map(a => <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 7, background: "#dbeafe", padding: "5px 9px", borderRadius: 7, border: "1px solid #bfdbfe" }}><Avatar name={a.name} size={24} /><div><div style={{ fontSize: 12, fontWeight: 600 }}>{a.name}</div><div style={{ fontSize: 10, color: "#64748b" }}>{a.role}</div></div><span onClick={async () => { const updated = { ...selTicket, assignees: selTicket.assignees.filter(x => x.id !== a.id), updated: new Date().toISOString() }; try { await axios.put(`${TICKETS_API}/${selTicket.id}`, updated); setTickets(t => t.map(x => x.id === selTicket.id ? { ...updated, updated: new Date(updated.updated) } : x)); setSelTicket(updated); } catch (e) { alert("Failed to remove assignee"); } }} style={{ cursor: "pointer", fontWeight: 700, marginLeft: 4, color: "#ef4444" }}>×</span></div>)}
                  {!selTicket.assignees?.length && <span style={{ fontSize: 13, color: "#94a3b8" }}>Unassigned</span>}
                </div>
                <div style={{ position: "relative" }}>
                  <input type="text" placeholder="Add assignee..." value={assigneeSearch} onChange={e => setAssigneeSearch(e.target.value)} onFocus={() => { setAssigneeSearch(""); setShowTicketAssigneeDD(true); }} style={{ ...iS, width: "100%", fontSize: 12 }} />
                  {showTicketAssigneeDD && <><div style={{ position: "fixed", inset: 0, zIndex: 199 }} onClick={() => { setShowTicketAssigneeDD(false); setAssigneeSearch(""); }} />
                    <div style={{ position: "absolute", top: "calc(100% + 3px)", left: 0, right: 0, background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 8, zIndex: 200, boxShadow: "0 4px 12px rgba(0,0,0,0.1)", maxHeight: 200, overflowY: "auto" }}>
                      <div style={{ padding: 8, borderBottom: "1px solid #f1f5f9", position: "sticky", top: 0, background: "#fff" }}>
                        <input type="text" placeholder="Search assignees..." value={assigneeSearch} onChange={e => setAssigneeSearch(e.target.value)} onClick={e => e.stopPropagation()} autoFocus style={{ ...iS, width: "100%", fontSize: 12 }} />
                      </div>
                      {users.filter(u => u.active && (assigneeSearch === "" || u.name.toLowerCase().includes(assigneeSearch.toLowerCase())) && !selTicket.assignees?.find(a => a.id === u.id)).map(u => (
                        <div key={u.id} onClick={async () => { const updated = { ...selTicket, assignees: [...(selTicket.assignees || []), u], updated: new Date().toISOString() }; try { await axios.put(`${TICKETS_API}/${selTicket.id}`, updated); setTickets(t => t.map(x => x.id === selTicket.id ? { ...updated, updated: new Date(updated.updated) } : x)); setSelTicket(updated); setAssigneeSearch(""); setShowTicketAssigneeDD(false); } catch (e) { alert("Failed to add assignee"); } }} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 12px", cursor: "pointer", borderBottom: "1px solid #f1f5f9" }}>
                          <Avatar name={u.name} size={24} /><div><div style={{ fontSize: 12, fontWeight: 600 }}>{u.name}</div><div style={{ fontSize: 11, color: "#94a3b8" }}>{u.role}</div></div>
                        </div>
                      ))}
                      {users.filter(u => u.active && (assigneeSearch === "" || u.name.toLowerCase().includes(assigneeSearch.toLowerCase())) && !selTicket.assignees?.find(a => a.id === u.id)).length === 0 && <div style={{ padding: "12px", textAlign: "center", fontSize: 12, color: "#94a3b8" }}>No available users</div>}
                    </div>
                  </>}
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {(selTicket.assignees || []).map(a => <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 7, background: "#fff", padding: "5px 9px", borderRadius: 7, border: "1px solid #e2e8f0" }}><Avatar name={a.name} size={24} /><div><div style={{ fontSize: 12, fontWeight: 600 }}>{a.name}</div><div style={{ fontSize: 10, color: "#94a3b8" }}>{a.role}</div></div></div>)}
                {!selTicket.assignees?.length && <span style={{ fontSize: 13, color: "#94a3b8" }}>Unassigned</span>}
              </div>
            )}
            {selTicket.vendor && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", marginBottom: 4 }}>Vendor</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{selTicket.vendor.name} <span style={{ color: "#64748b", fontWeight: 400 }}>({selTicket.vendor.email})</span></div>
              </div>
            )}
          </div>

          {/* Forward Ticket Button */}
          <button onClick={() => setShowForward(true)} style={{ ...bG, padding: "6px 14px", marginBottom: 14, fontSize: 12 }}>Forward Ticket ➦</button>

          {/* Timeline View Button */}
          <button onClick={() => setShowTimelineView(true)} style={{ ...bG, padding: "6px 14px", marginBottom: 14, marginLeft: 8, fontSize: 12, background: "#f3e8ff", color: "#7c3aed" }}>📜 View Timeline</button>

          {/* Send to Vendor Button */}
          <button onClick={() => setShowVendor(true)} style={{ ...bG, padding: "6px 14px", marginBottom: 14, marginLeft: 8, fontSize: 12, background: "#fff7ed", color: "#ea580c" }}>Send to Vendor 🏭</button>

          {/* Forward Ticket Modal - Role-based */}
          {showForward && (
            <div style={{ marginBottom: 14, padding: "14px", background: "#eff6ff", borderRadius: 9, border: "1px solid #bfdbfe" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#1e40af", marginBottom: 10 }}>
                {(currentUser?.role === "Admin" || currentUser?.role === "Manager") ? "➦ Forward Ticket" : "📬 Request Forward"}
              </div>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 10, fontStyle: "italic" }}>
                {(currentUser?.role === "Admin" || currentUser?.role === "Manager")
                  ? "✓ Direct forward (no approval needed)"
                  : "✓ Request will be sent to Admin for approval"}
              </div>

              {/* Filter out: currently assigned users */}
              <FF label="Select Agent (currently assigned excluded)" required>
                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    placeholder="Search agent..."
                    value={fwdTargetAgent ? users.find(u => u.id === fwdTargetAgent)?.name || "" : forwardAgentSearch}
                    onChange={e => setForwardAgentSearch(e.target.value)}
                    onFocus={() => { setForwardAgentSearch(""); setShowForwardAgentDD(true); }}
                    style={{ ...iS, width: "100%", fontSize: 12 }}
                  />
                  {showForwardAgentDD && <>
                    <div style={{ position: "fixed", inset: 0, zIndex: 199 }} onClick={() => { setShowForwardAgentDD(false); setForwardAgentSearch(""); }} />
                    <div style={{ position: "absolute", top: "calc(100% + 3px)", left: 0, right: 0, background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 8, zIndex: 200, boxShadow: "0 4px 12px rgba(0,0,0,0.1)", maxHeight: 200, overflowY: "auto" }}>
                      <div style={{ padding: 8, borderBottom: "1px solid #f1f5f9", position: "sticky", top: 0, background: "#fff" }}>
                        <input type="text" placeholder="Search agents..." value={forwardAgentSearch} onChange={e => setForwardAgentSearch(e.target.value)} onClick={e => e.stopPropagation()} autoFocus style={{ ...iS, width: "100%", fontSize: 12 }} />
                      </div>
                      {users.filter(u =>
                        u.active &&
                        !selTicket.assignees?.find(a => a.id === u.id) &&
                        (forwardAgentSearch === "" || u.name.toLowerCase().includes(forwardAgentSearch.toLowerCase()))
                      ).map(u => (
                        <div key={u.id} onClick={() => { setFwdTargetAgent(u.id); setShowForwardAgentDD(false); setForwardAgentSearch(""); }} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 12px", cursor: "pointer", borderBottom: "1px solid #f1f5f9" }}>
                          <Avatar name={u.name} size={24} /><div><div style={{ fontSize: 12, fontWeight: 600 }}>{u.name}</div><div style={{ fontSize: 11, color: "#94a3b8" }}>{u.role}</div></div>
                        </div>
                      ))}
                      {users.filter(u =>
                        u.active &&
                        !selTicket.assignees?.find(a => a.id === u.id) &&
                        (forwardAgentSearch === "" || u.name.toLowerCase().includes(forwardAgentSearch.toLowerCase()))
                      ).length === 0 && <div style={{ padding: "12px", textAlign: "center", fontSize: 12, color: "#94a3b8" }}>No available agents</div>}
                    </div>
                  </>}
                </div>
              </FF>

              <FF label="Reason for Forwarding" required>
                <textarea
                  style={{ ...iS, height: 50, resize: "none" }}
                  value={fwdReason}
                  onChange={e => setFwdReason(e.target.value)}
                  placeholder="Why is this ticket being forwarded?"
                />
              </FF>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
                <button onClick={() => { setShowForward(false); setFwdReason(""); setFwdTargetAgent(""); }} style={bG}>Cancel</button>
                <button
                  onClick={() => handleForwardTicket(fwdTargetAgent)}
                  style={{
                    ...bP,
                    background: (currentUser?.role === "Admin" || currentUser?.role === "Manager") ? "#2563eb" : "#f59e0b",
                    boxShadow: `0 2px 6px rgba(${(currentUser?.role === "Admin" || currentUser?.role === "Manager") ? "37,99,235" : "245,158,11"},0.3)`
                  }}
                >
                  {(currentUser?.role === "Admin" || currentUser?.role === "Manager") ? "Forward Ticket ➦" : "Send Request to Admin ✉️"}
                </button>
              </div>
            </div>
          )}

          {/* Send to Vendor Modal */}
          {showVendor && (
            <div style={{ marginBottom: 14, padding: "14px", background: "#fff7ed", borderRadius: 9, border: "1px solid #fed7aa" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#ea580c", marginBottom: 10 }}>🏭 Send to Vendor</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 10px" }}>
                {/* Vendor Dropdown - Auto-fill email on select */}
                <FF label="Select Vendor" required>
                  <select
                    style={iS}
                    value={vendorName}
                    onChange={e => {
                      setVendorName(e.target.value);
                      // ✅ Auto-fill email when vendor selected
                      const selectedVendor = vendors.find(v => v.name === e.target.value);
                      if (selectedVendor) {
                        setVendorEmail(selectedVendor.email || "");
                      } else {
                        setVendorEmail("");
                      }
                    }}
                  >
                    <option value="">Select vendor…</option>
                    {vendors.map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                  </select>
                </FF>
                {/* Email auto-filled from vendor */}
                <FF label="Vendor Email (auto-filled)">
                  <input
                    type="email"
                    style={iS}
                    value={vendorEmail}
                    onChange={e => setVendorEmail(e.target.value)}
                    placeholder="Auto-filled from vendor details"
                    readOnly
                  />
                </FF>
              </div>
              <FF label="Reason for Sending to Vendor" required>
                <textarea
                  style={{ ...iS, height: 50, resize: "none" }}
                  value={fwdReason}
                  onChange={e => setFwdReason(e.target.value)}
                  placeholder="Why is this ticket being sent to vendor?"
                />
              </FF>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
                <button onClick={() => { setShowVendor(false); setVendorName(""); setVendorEmail(""); setFwdReason(""); }} style={bG}>Cancel</button>
                <button onClick={() => { handleSendForRepair(vendorName, vendorEmail); setShowVendor(false); setVendorName(""); setVendorEmail(""); setFwdReason(""); }} style={{ ...bP, background: "#ea580c", boxShadow: "0 2px 6px rgba(234,88,12,0.3)" }}>Confirm Send</button>
              </div>
            </div>
          )}

          {/* Status Update */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#374151", marginBottom: 7 }}>UPDATE STATUS</div>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 10 }}>{STATUSES.map(s => <button key={s} onClick={() => updateStatus(selTicket.id, s)} style={{ padding: "5px 13px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "'DM Sans',sans-serif", background: selTicket.status === s ? STATUS_COLOR[s].text : "#f1f5f9", color: selTicket.status === s ? "#fff" : "#64748b" }}>{s}</button>)}</div>
            {/* ✅ NEW: Save Changes Button */}
            <button
              onClick={() => {
                setCustomAlert({ show: true, message: "✅ Ticket changes saved!", type: "success" });
              }}
              style={{ ...bP, background: "#22c55e", color: "#fff", fontWeight: 600, padding: "8px 16px", fontSize: 12 }}
            >
              💾 Save Changes
            </button>
          </div>

          {/* Comment */}
          <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 13 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#374151", marginBottom: 7 }}>ADD COMMENT</div>
            <textarea style={{ ...iS, height: 68, resize: "none" }} placeholder="Add a note or reply…" value={newComment} onChange={e => setNewComment(e.target.value)} />
            <button onClick={async () => {
              if (!newComment.trim()) return;
              const nowISO = new Date().toISOString();
              const comment = { by: currentUser.name, date: nowISO, text: newComment.trim() };
              const updatedT = { ...selTicket, updated: nowISO, comments: [...(selTicket.comments || []), comment], timeline: [...(selTicket.timeline || []), { action: "Comment added", by: currentUser.name, date: nowISO, note: newComment.trim() }] };
              try {
                await axios.put(`${TICKETS_API}/${selTicket.id}`, updatedT);
                setTickets(p => p.map(x => x.id === selTicket.id ? { ...updatedT, updated: new Date(nowISO) } : x));
                setSelTicket({ ...updatedT, updated: new Date(nowISO) });
                setNewComment("");
              } catch (e) { alert("Failed to post comment"); }
            }} style={{ ...bP, marginTop: 7, padding: "7px 15px", fontSize: 13 }}>Post Comment</button>
          </div>
        </div>}
      </Modal>

      {/* ✅ NEW: TIMELINE VIEW MODAL */}
      <Modal open={showTimelineView} onClose={() => setShowTimelineView(false)} title={`📜 Ticket Timeline - ${selTicket?.id || ""}`} width={600}>
        {selTicket && (
          <div style={{ maxHeight: "600px", overflowY: "auto" }}>
            {(!selTicket.timeline || selTicket.timeline.length === 0) ? (
              <div style={{ textAlign: "center", padding: "30px", color: "#94a3b8" }}>
                <div style={{ fontSize: 14, marginBottom: 8 }}>📭 No timeline events yet</div>
                <div style={{ fontSize: 12 }}>This ticket hasn't been updated yet</div>
              </div>
            ) : (
              <div>
                {[...selTicket.timeline].reverse().map((entry, idx) => (
                  <div key={idx} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: idx < selTicket.timeline.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                      {/* Timeline dot */}
                      <div style={{ width: 32, height: 32, minWidth: 32, background: "#dbeafe", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>
                        {entry.action.includes("Created") && "✨"}
                        {entry.action.includes("Forwarded") && "➦"}
                        {entry.action.includes("Sent") && "🏭"}
                        {entry.action.includes("Reopened") && "🔄"}
                        {entry.action.includes("Closed") && "✓"}
                        {entry.action.includes("Updated") && "✏️"}
                        {!entry.action.includes("Created") && !entry.action.includes("Forwarded") && !entry.action.includes("Sent") && !entry.action.includes("Reopened") && !entry.action.includes("Closed") && !entry.action.includes("Updated") && "📝"}
                      </div>

                      {/* Timeline content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#1f2937", marginBottom: 2 }}>{entry.action}</div>
                        <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>
                          By <strong>{entry.by}</strong> • {new Date(entry.date).toLocaleString()}
                        </div>
                        {entry.note && (
                          <div style={{ fontSize: 12, color: "#475569", background: "#f8fafc", padding: "8px 10px", borderRadius: 6, borderLeft: "3px solid #3b82f6", marginTop: 6 }}>
                            {entry.note}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ✅ NEW: ADMIN FORWARD APPROVALS MODAL */}
      {(currentUser?.role === "Admin" || currentUser?.role === "Manager") && forwardRequests.filter(r => r.status === "Pending").length > 0 && (
        <div style={{ position: "fixed", top: 20, right: 20, background: "#fff", border: "2px solid #f59e0b", borderRadius: 10, padding: "16px", maxWidth: "350px", boxShadow: "0 10px 30px rgba(0,0,0,0.15)", zIndex: 10000 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#ea580c", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
            🔔 Forward Requests ({forwardRequests.filter(r => r.status === "Pending").length})
          </div>

          {forwardRequests.filter(r => r.status === "Pending").map(request => (
            <div key={request.id} style={{ background: "#fef3c7", padding: "10px", borderRadius: 7, marginBottom: 10, border: "1px solid #fcd34d" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#78350f", marginBottom: 4 }}>
                Ticket: {request.ticketId}
              </div>
              <div style={{ fontSize: 10, color: "#92400e", marginBottom: 6, lineHeight: 1.4 }}>
                <strong>{request.fromUser}</strong> → <strong>{request.toAgent.name}</strong>
              </div>
              <div style={{ fontSize: 10, color: "#92400e", marginBottom: 8, fontStyle: "italic", background: "#fff9e6", padding: "6px", borderRadius: 4 }}>
                "{request.reason}"
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => approveForwardRequest(request)} style={{ flex: 1, padding: "6px 10px", fontSize: 10, fontWeight: 600, background: "#10b981", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer" }}>✓ Approve</button>
                <button onClick={() => rejectForwardRequest(request)} style={{ flex: 1, padding: "6px 10px", fontSize: 10, fontWeight: 600, background: "#ef4444", color: "#fff", border: "none", borderRadius: 5, cursor: "pointer" }}>✕ Reject</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── PROJECT DETAIL MODAL ── */}
      <Modal open={!!selProject} onClose={() => setSelProject(null)} title={selProject?.id || ""} width={720}>
        {selProject && <div>
          <div style={{ display: "flex", gap: 9, marginBottom: 16, flexWrap: "wrap" }}>
            <Badge label={selProject.status} style={{ ...STATUS_COLOR[selProject.status], padding: "4px 12px", fontSize: 12 }} />
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 9, height: 9, borderRadius: "50%", background: PRIORITY_COLOR[selProject.priority] }} /><span style={{ fontSize: 13, fontWeight: 600 }}>{selProject.priority} Priority</span></div>
            {selProject.isWebcast && <Badge label="📡 Webcast" style={{ background: "#fff7ed", color: "#f97316" }} />}
            <span style={{ fontSize: 12, color: "#94a3b8" }}>Created {selProject.created.toLocaleString()}</span>
          </div>
          <h2 style={{ margin: "0 0 9px", fontSize: 17, fontWeight: 700 }}>{selProject.title}</h2>
          <div style={{ marginBottom: 14, padding: "11px 14px", background: "#f8fafc", borderRadius: 9 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" }}>Progress (Based on Status)</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#8b5cf6" }}>{getProgressFromStatus(selProject.status)}%</span>
            </div>
            <ProgressBar value={getProgressFromStatus(selProject.status)} color={getProgressFromStatus(selProject.status) > 70 ? "#22c55e" : getProgressFromStatus(selProject.status) > 40 ? "#f59e0b" : "#ef4444"} />
          </div>
          <p style={{ margin: "0 0 16px", color: "#64748b", fontSize: 14, lineHeight: 1.6 }}>{selProject.description}</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, marginBottom: 14 }}>
            {[{ l: "Organisation", v: selProject.org }, { l: "Department", v: selProject.department }, { l: "Reported By", v: selProject.reportedBy }, { l: "Category", v: selProject.category }, { l: "Location", v: selProject.location }, { l: "Due Date", v: selProject.dueDate?.toLocaleDateString() || "—" }].map(f => (
              <div key={f.l} style={{ background: "#f8fafc", padding: "9px 13px", borderRadius: 9 }}><div style={{ fontSize: 10, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", marginBottom: 3 }}>{f.l}</div><div style={{ fontSize: 13, fontWeight: 500 }}>{f.v || "—"}</div></div>
            ))}
          </div>
          <div style={{ marginBottom: 14, padding: "11px 13px", background: "#f8fafc", borderRadius: 9 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", marginBottom: 7 }}>Assignees</div>
            {currentUser?.role === "Admin" || currentUser?.role === "Manager" ? (
              <div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 10 }}>
                  {(selProject.assignees || []).map(a => <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 7, background: "#dbeafe", padding: "5px 9px", borderRadius: 7, border: "1px solid #bfdbfe" }}><Avatar name={a.name} size={24} /><div><div style={{ fontSize: 12, fontWeight: 600 }}>{a.name}</div><div style={{ fontSize: 10, color: "#64748b" }}>{a.role}</div></div><span onClick={async () => { const updated = { ...selProject, assignees: selProject.assignees.filter(x => x.id !== a.id), updated: new Date().toISOString() }; try { await axios.put(`${PROJECTS_API}/${selProject.id}`, updated); setProjects(p => p.map(x => x.id === selProject.id ? { ...updated, updated: new Date(updated.updated) } : x)); setSelProject(updated); } catch (e) { alert("Failed to remove assignee"); } }} style={{ cursor: "pointer", fontWeight: 700, marginLeft: 4, color: "#ef4444" }}>×</span></div>)}
                  {!selProject.assignees?.length && <span style={{ fontSize: 13, color: "#94a3b8" }}>Unassigned</span>}
                </div>
                <div style={{ position: "relative" }}>
                  <input type="text" placeholder="Add assignee..." value={assigneeSearch} onChange={e => setAssigneeSearch(e.target.value)} onFocus={() => { setAssigneeSearch(""); setShowProjAssigneeDD(true); }} style={{ ...iS, width: "100%", fontSize: 12 }} />
                  {showProjAssigneeDD && <><div style={{ position: "fixed", inset: 0, zIndex: 199 }} onClick={() => { setShowProjAssigneeDD(false); setAssigneeSearch(""); }} />
                    <div style={{ position: "absolute", top: "calc(100% + 3px)", left: 0, right: 0, background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 8, zIndex: 200, boxShadow: "0 4px 12px rgba(0,0,0,0.1)", maxHeight: 200, overflowY: "auto" }}>
                      <div style={{ padding: 8, borderBottom: "1px solid #f1f5f9", position: "sticky", top: 0, background: "#fff" }}>
                        <input type="text" placeholder="Search assignees..." value={assigneeSearch} onChange={e => setAssigneeSearch(e.target.value)} onClick={e => e.stopPropagation()} autoFocus style={{ ...iS, width: "100%", fontSize: 12 }} />
                      </div>
                      {users.filter(u => u.active && (assigneeSearch === "" || u.name.toLowerCase().includes(assigneeSearch.toLowerCase())) && !selProject.assignees?.find(a => a.id === u.id)).map(u => (
                        <div key={u.id} onClick={async () => { const updated = { ...selProject, assignees: [...(selProject.assignees || []), u], updated: new Date().toISOString() }; try { await axios.put(`${PROJECTS_API}/${selProject.id}`, updated); setProjects(p => p.map(x => x.id === selProject.id ? { ...updated, updated: new Date(updated.updated) } : x)); setSelProject(updated); setAssigneeSearch(""); setShowProjAssigneeDD(false); } catch (e) { alert("Failed to add assignee"); } }} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 12px", cursor: "pointer", borderBottom: "1px solid #f1f5f9" }}>
                          <Avatar name={u.name} size={24} /><div><div style={{ fontSize: 12, fontWeight: 600 }}>{u.name}</div><div style={{ fontSize: 11, color: "#94a3b8" }}>{u.role}</div></div>
                        </div>
                      ))}
                      {users.filter(u => u.active && (assigneeSearch === "" || u.name.toLowerCase().includes(assigneeSearch.toLowerCase())) && !selProject.assignees?.find(a => a.id === u.id)).length === 0 && <div style={{ padding: "12px", textAlign: "center", fontSize: 12, color: "#94a3b8" }}>No available users</div>}
                    </div>
                  </>}
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {(selProject.assignees || []).map(a => <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 7, background: "#fff", padding: "5px 9px", borderRadius: 7, border: "1px solid #e2e8f0" }}><Avatar name={a.name} size={24} /><div><div style={{ fontSize: 12, fontWeight: 600 }}>{a.name}</div><div style={{ fontSize: 10, color: "#94a3b8" }}>{a.role}</div></div></div>)}
                {!selProject.assignees?.length && <span style={{ fontSize: 13, color: "#94a3b8" }}>Unassigned</span>}
              </div>
            )}
          </div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#374151", marginBottom: 7 }}>UPDATE STATUS</div>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>{PROJECT_STATUSES.map(s => <button key={s} onClick={() => updateProjectStatus(selProject.id, s)} style={{ padding: "5px 13px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "'DM Sans',sans-serif", background: selProject.status === s ? STATUS_COLOR[s].text : "#f1f5f9", color: selProject.status === s ? "#fff" : "#64748b" }}>{s}</button>)}</div>
          </div>
          <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 13 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#374151", marginBottom: 7 }}>ADD COMMENT</div>
            <textarea style={{ ...iS, height: 68, resize: "none" }} placeholder="Add a note or reply…" value={newProjComment} onChange={e => setNewProjComment(e.target.value)} />
            <button onClick={async () => {
              if (!newProjComment.trim()) return;
              const nowISO = new Date().toISOString();
              const comment = { by: currentUser.name, date: nowISO, text: newProjComment.trim() };
              const updatedP = { ...selProject, updated: nowISO, comments: [...(selProject.comments || []), comment] };
              try {
                await axios.put(`${PROJECTS_API}/${selProject.id}`, updatedP);
                setProjects(p => p.map(x => x.id === selProject.id ? { ...updatedP, updated: new Date(nowISO) } : x));
                setSelProject({ ...updatedP, updated: new Date(nowISO) });
                setNewProjComment("");
              } catch (e) { alert("Failed to post comment"); }
            }} style={{ ...bP, marginTop: 7, padding: "7px 15px", fontSize: 13, background: "linear-gradient(135deg,#8b5cf6,#6366f1)" }}>Post Comment</button>
          </div>
        </div>}
      </Modal>

      {/* ── Toast Notifications ── */}
      <div style={{ position: "fixed", top: 20, right: 20, zIndex: 9999, display: "flex", flexDirection: "column", gap: 10 }}>
        {toasts.map(toast => (
          <div
            key={toast.id}
            style={{
              padding: "14px 18px",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 600,
              fontFamily: "'DM Sans',sans-serif",
              boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
              display: "flex",
              alignItems: "center",
              gap: 10,
              minWidth: 280,
              animation: "slideIn 0.3s ease-out",
              background: toast.type === "success" ? "#dcfce7" : "#fee2e2",
              color: toast.type === "success" ? "#15803d" : "#991b1b",
              border: `1.5px solid ${toast.type === "success" ? "#86efac" : "#fca5a5"}`
            }}
          >
            <span style={{ fontSize: 16 }}>{toast.type === "success" ? "✓" : "✕"}</span>
            {toast.message}
          </div>
        ))}
      </div>

      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(400px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
}