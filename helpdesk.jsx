import React, { useState, useMemo, useEffect, useRef } from "react";
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
const NOTIFICATIONS_API = `${BASE_URL}/notifications`;
const DEVICES_API = `${BASE_URL}/devices`;

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const PRIORITIES = ["Critical", "High", "Low", "Medium"];
const STATUSES = ["Closed", "In Progress", "Open"];
const ROLES = ["Admin", "Agent", "Manager", "Viewer"];
const SATSANG_TYPES = ["Children Satsang", "G Satsang", "Special Satsang", "Weekly Satsang", "Youth Satsang"];
const PROJECT_STATUSES = ["Closed", "In Progress", "Open"];
const PROJECT_PRIORITIES = ["Critical", "High", "Low", "Medium"];


const PRIORITY_COLOR = { Low: "#22c55e", Medium: "#f59e0b", High: "#f97316", Critical: "#ef4444" };
const STATUS_COLOR = {
  Open: { bg: "#dbeafe", text: "#1d4ed8" },
  "In Progress": { bg: "#fef9c3", text: "#854d0e" },
  Pending: { bg: "#ede9fe", text: "#6d28d9" },
  Closed: { bg: "#dcfce7", text: "#15803d" }
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
  { id: "closed", label: "Closed Tickets", icon: "✅", desc: "All closed tickets", filter: t => t.status === "Closed" },
  { id: "unassigned", label: "Unassigned", icon: "🔸", desc: "Tickets with no assignees", filter: t => (!t.assignees || t.assignees.length === 0) && t.status !== "Closed" },
  { id: "mine", label: "My Tickets", icon: "🙋", desc: "Open/in progress assigned to me", filter: (t, me) => (t.status === "Open" || t.status === "In Progress") && t.assignees?.some(a => a.id === me?.id) },
  { id: "all", label: "All Tickets", icon: "◈", desc: "Every ticket in the system", filter: () => true },
  { id: "alerts", label: "Active Alerts", icon: "🔔", desc: "Critical tickets with active alerts", filter: t => t.priority === "Critical" && t.status !== "Closed" },
  { id: "pastdue", label: "Past Due", icon: "🔴", desc: "Open tickets with past due date", filter: t => t.status === "Open" && t.dueDate && new Date(String(t.dueDate)) < new Date() },
  { id: "vendor", label: "By Vendor", icon: "🏭", desc: "Tickets sent to vendors for repair", filter: t => t.status === "Pending" && t.timeline?.some(ev => ev.action?.includes("Sent for Repair")) },
];

const PROJECT_VIEWS = [
  { id: "open", label: "Open Projects", icon: "📂", desc: "All open projects", filter: p => p.status === "Open" },
  { id: "inprogress", label: "In Progress", icon: "⚙️", desc: "Projects being worked on", filter: p => p.status === "In Progress" },
  { id: "closed", label: "Closed Projects", icon: "✅", desc: "All closed projects", filter: p => p.status === "Closed" },
  { id: "unassigned", label: "Unassigned", icon: "👤", desc: "Projects with no assignee", filter: p => (!p.assignees || p.assignees.length === 0) && p.status !== "Closed" },
  { id: "mine", label: "My Projects", icon: "🙋", desc: "Projects assigned to me", filter: (p, me) => p.assignees?.some(a => a.id === me?.id) && p.status !== "Closed" },
  { id: "all", label: "All Projects", icon: "◈", desc: "Every project in the system", filter: () => true },
  { id: "critical", label: "Critical", icon: "🔔", desc: "Critical priority projects", filter: p => p.priority === "Critical" && p.status !== "Closed" },
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
            transform: translateY(-20px);
          }
          5% {
            opacity: 1;
            transform: translateY(0);
          }
          95% {
            opacity: 1;
            transform: translateY(0);
          }
          100% {
            opacity: 0;
            transform: translateY(-20px);
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
          left: "50%",
          transform: "translateX(-50%)",
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
const ConfirmationModal = ({ show, title, message, onConfirm, onCancel, fields, showLunchButton, onLunch, confirmLabel, confirmDanger }) => {
  const [fieldValues, setFieldValues] = React.useState({});

  React.useEffect(() => {
    if (fields) {
      const initial = {};
      fields.forEach(f => {
        initial[f.name] = f.value || "";
      });
      setFieldValues(initial);
    }
  }, [fields]);

  if (!show) return null;

  const handleConfirm = () => {
    onConfirm(fieldValues);
  };

  const handleLunch = () => {
    if (onLunch) onLunch();
  };

  // ✅ Filter fields to show location only when logoutReason is "Going for ticket"
  const visibleFields = fields ? fields.filter(f => {
    if (f.name === "location") {
      return fieldValues.logoutReason === "Going for ticket";
    }
    return true;
  }) : [];

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
        animation: "slideDown 0.3s ease-out",
        maxHeight: "80vh",
        overflow: "auto"
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
          margin: "0 0 24px 0",
          fontSize: 14,
          color: "#475569",
          lineHeight: 1.6
        }}>
          {message}
        </p>

        {/* Fields */}
        {visibleFields && visibleFields.length > 0 && (
          <div style={{ marginBottom: 20, display: "flex", flexDirection: "column", gap: 14 }}>
            {visibleFields.map(field => (
              <div key={field.name}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
                  {field.label}
                </label>
                {field.type === "select" ? (
                  <select
                    value={fieldValues[field.name] || ""}
                    onChange={e => setFieldValues({ ...fieldValues, [field.name]: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: 8,
                      border: "1.5px solid #e2e8f0",
                      fontSize: 13,
                      fontFamily: "'DM Sans', sans-serif",
                      background: "#fff",
                      color: "#1e293b",
                      cursor: "pointer"
                    }}
                  >
                    <option value="">Select {field.label}</option>
                    {field.options && field.options.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={field.type || "text"}
                    placeholder={field.placeholder}
                    value={fieldValues[field.name] || ""}
                    onChange={e => setFieldValues({ ...fieldValues, [field.name]: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: 8,
                      border: "1.5px solid #e2e8f0",
                      fontSize: 13,
                      fontFamily: "'DM Sans', sans-serif",
                      background: "#fff",
                      color: "#1e293b",
                      boxSizing: "border-box"
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Buttons */}
        <div style={{
          display: "flex",
          gap: 10,
          justifyContent: "flex-end",
          flexWrap: "wrap"
        }}>
          {showLunchButton && (
            <button onClick={handleLunch} style={{
              padding: "10px 20px",
              borderRadius: 8,
              border: "1.5px solid #f59e0b",
              background: "#fef3c7",
              color: "#92400e",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
              transition: "all 0.2s",
              fontFamily: "'DM Sans', sans-serif"
            }} onMouseOver={e => {
              e.target.style.background = "#fcd34d";
              e.target.style.borderColor = "#f59e0b";
            }} onMouseOut={e => {
              e.target.style.background = "#fef3c7";
              e.target.style.borderColor = "#f59e0b";
            }}>
              🍽️ Going for Lunch
            </button>
          )}

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
            fontFamily: "'DM Sans', sans-serif",
            flex: showLunchButton ? "0" : "1"
          }} onMouseOver={e => {
            e.target.style.background = "#f1f5f9";
            e.target.style.borderColor = "#cbd5e1";
          }} onMouseOut={e => {
            e.target.style.background = "#fff";
            e.target.style.borderColor = "#e2e8f0";
          }}>
            Cancel
          </button>

          <button onClick={handleConfirm} style={{
            padding: "10px 24px",
            borderRadius: 8,
            border: "none",
            background: confirmDanger ? "linear-gradient(135deg, #ef4444, #dc2626)" : "linear-gradient(135deg, #3b82f6, #6366f1)",
            color: "#fff",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 600,
            transition: "all 0.2s",
            fontFamily: "'DM Sans', sans-serif",
            boxShadow: confirmDanger ? "0 4px 12px rgba(239,68,68,0.3)" : "0 4px 12px rgba(59, 130, 246, 0.3)",
            flex: showLunchButton ? "0" : "1"
          }} onMouseOver={e => {
            e.target.style.boxShadow = confirmDanger ? "0 6px 16px rgba(239,68,68,0.4)" : "0 6px 16px rgba(59, 130, 246, 0.4)";
            e.target.style.transform = "translateY(-2px)";
          }} onMouseOut={e => {
            e.target.style.boxShadow = confirmDanger ? "0 4px 12px rgba(239,68,68,0.3)" : "0 4px 12px rgba(59, 130, 246, 0.3)";
            e.target.style.transform = "translateY(0)";
          }}>
            {confirmLabel || "Confirm"}
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

// ─── FILTERABLE HEADER ───────────────────────────────────────────────────────
// Click header → searchable dropdown of unique values for that column.
// Active filter shown with blue highlight + ✕ to clear.
const FilterableHeader = ({ label, field, data, filters, onFilter, style = {}, getVal }) => {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const active = filters[field] != null && filters[field] !== "";

  // Collect unique display values for this column
  const unique = React.useMemo(() => {
    const seen = new Set();
    const vals = [];
    (data || []).forEach(row => {
      let v = getVal ? getVal(row, field) : row[field];
      if (v == null || v === "") v = "—";
      if (Array.isArray(v)) v = v.length > 0 ? v.map(a => a.name || a).join(", ") : "None";
      if (v instanceof Date) v = v.toLocaleDateString();
      const s = String(v);
      if (!seen.has(s)) { seen.add(s); vals.push(s); }
    });
    return vals.sort((a, b) => a === "—" ? 1 : b === "—" ? -1 : a.localeCompare(b));
  }, [data, field]);

  const filtered = unique.filter(v => v.toLowerCase().includes(search.toLowerCase()));

  return (
    <th style={{ ...style, position: "relative", userSelect: "none", whiteSpace: "nowrap" }}>
      <div
        onClick={() => { setOpen(o => !o); setSearch(""); }}
        style={{
          display: "inline-flex", alignItems: "center", gap: 5, cursor: "pointer", padding: "2px 4px", borderRadius: 5,
          background: active ? "#eff6ff" : "transparent", color: active ? "#3b82f6" : "inherit"
        }}
      >
        <span style={{ fontSize: "inherit", fontWeight: "inherit" }}>{label}</span>
        {active
          ? <span
            onClick={e => { e.stopPropagation(); onFilter({ ...filters, [field]: "" }); }}
            style={{ fontSize: 10, background: "#3b82f6", color: "#fff", borderRadius: 99, padding: "1px 5px", fontWeight: 700, cursor: "pointer" }}
          >✕</span>
          : <span style={{ fontSize: 10, color: "#94a3b8" }}>▾</span>
        }
      </div>
      {open && <>
        <div style={{ position: "fixed", inset: 0, zIndex: 499 }} onClick={() => setOpen(false)} />
        <div style={{
          position: "absolute", top: "calc(100% + 2px)", left: 0, minWidth: 180, maxWidth: 260,
          background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 10,
          boxShadow: "0 8px 28px rgba(0,0,0,0.13)", zIndex: 500, overflow: "hidden"
        }}>
          <div style={{ padding: "8px 10px", borderBottom: "1px solid #f1f5f9" }}>
            <input
              autoFocus
              type="text"
              placeholder={`Search ${label}…`}
              value={search}
              onChange={e => setSearch(e.target.value)}
              onClick={e => e.stopPropagation()}
              style={{
                width: "100%", padding: "6px 9px", border: "1.5px solid #e2e8f0", borderRadius: 7,
                fontSize: 12, outline: "none", boxSizing: "border-box", fontFamily: "'DM Sans',sans-serif"
              }}
            />
          </div>
          <div style={{ maxHeight: 220, overflowY: "auto" }}>
            <div
              onClick={() => { onFilter({ ...filters, [field]: "" }); setOpen(false); setSearch(""); }}
              style={{
                padding: "7px 12px", fontSize: 12, cursor: "pointer", color: "#64748b",
                background: !active ? "#f0f9ff" : "#fff", fontWeight: !active ? 600 : 400,
                borderBottom: "1px solid #f8fafc"
              }}
            >All</div>
            {filtered.length === 0 && <div style={{ padding: "10px 12px", fontSize: 12, color: "#94a3b8" }}>No results</div>}
            {filtered.map(v => (
              <div key={v}
                onClick={() => { onFilter({ ...filters, [field]: v }); setOpen(false); setSearch(""); }}
                style={{
                  padding: "7px 12px", fontSize: 12, cursor: "pointer",
                  background: filters[field] === v ? "#eff6ff" : "#fff",
                  color: filters[field] === v ? "#3b82f6" : "#1e293b",
                  fontWeight: filters[field] === v ? 600 : 400,
                  borderBottom: "1px solid #f8fafc"
                }}
              >
                {v}
              </div>
            ))}
          </div>
        </div>
      </>}
    </th>
  );
};

// Apply column filters to a dataset
const applySort = (arr, filters) => {
  if (!filters || Object.keys(filters).every(k => !filters[k])) return arr;
  return arr.filter(row => {
    return Object.entries(filters).every(([field, val]) => {
      if (!val) return true;
      let v = row[field];
      if (v == null || v === "") v = "—";
      if (Array.isArray(v)) v = v.length > 0 ? v.map(a => a.name || a).join(", ") : "None";
      if (v instanceof Date) v = v.toLocaleDateString();
      return String(v).toLowerCase().includes(val.toLowerCase());
    });
  });
};

const FF = ({ label, required, children }) => <div style={{ marginBottom: 14 }}>
  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#000", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "'Arial Hebrew', sans-serif" }}>{label}{required && <span style={{ color: "#ef4444", marginLeft: 2 }}>*</span>}</label>
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

// ─── SHARED PIE PALETTE — 12 visually distinct colours ───────────────────────
const PIE_COLORS = [
  "#3b82f6", "#f97316", "#22c55e", "#ef4444", "#a855f7",
  "#14b8a6", "#eab308", "#ec4899", "#6366f1", "#84cc16",
  "#0ea5e9", "#f43f5e"
];
const pieCo = (i, override) => override || PIE_COLORS[i % PIE_COLORS.length];

// ─── UNIFIED PIE / DONUT COMPONENT ───────────────────────────────────────────
// Rules:
//  • r = 60, viewBox 140×140, cx = cy = 70
//  • Container split 50/50: left = circle centred, right = legends centred
//  • Equal padding on all sides so the circle never touches any edge
//  • On hover → black pill with the count appears on the slice itself (not centre)
//  • 12-colour distinct palette; data.color overrides if provided
const PieChart = ({ data, donut = false }) => {
  const [hov, setHov] = useState(null);
  const VB = 140, cx = 70, cy = 70, r = 60;
  const total = data.reduce((s, d) => s + d.value, 0);

  /* full-pie slices */
  let off = 0;
  const segs = data.map((d, i) => {
    const p = total ? d.value / total : 0;
    const a = p * Math.PI * 2;
    const seg = { ...d, color: d.color || pieCo(i), start: off, end: off + a, pct: Math.round(p * 100) };
    off += a;
    return seg;
  });
  const arcPath = (s) => {
    const large = s.end - s.start > Math.PI ? 1 : 0;
    const x1 = cx + r * Math.sin(s.start), y1 = cy - r * Math.cos(s.start);
    const x2 = cx + r * Math.sin(s.end), y2 = cy - r * Math.cos(s.end);
    return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
  };
  const sliceLabelPos = (s) => {
    const mid = s.start + (s.end - s.start) / 2;
    return { lx: cx + r * 0.58 * Math.sin(mid), ly: cy - r * 0.58 * Math.cos(mid) };
  };

  /* donut ring */
  const circ = 2 * Math.PI * r;
  let dOff = 0;
  const dSegs = donut ? data.map((d, i) => {
    const p = total ? d.value / total : 0;
    const dash = p * circ;
    const sA = dOff * Math.PI * 2, eA = (dOff + p) * Math.PI * 2;
    const seg = { ...d, color: d.color || pieCo(i), dash, gap: circ - dash, offset: dOff * circ, pct: Math.round(p * 100), startAngle: sA, endAngle: eA };
    dOff += p;
    return seg;
  }) : [];
  const ringLabelPos = (s) => {
    const mid = s.startAngle + (s.endAngle - s.startAngle) / 2;
    return { lx: cx + r * 0.58 * Math.sin(mid), ly: cy - r * 0.58 * Math.cos(mid) };
  };

  const displaySegs = donut ? dSegs : segs;

  return (
    <div style={{ display: "flex", alignItems: "center", width: "100%", minHeight: VB + 16 }}>
      {/* LEFT 50%: circle with equal padding */}
      <div style={{ flex: "0 0 50%", display: "flex", alignItems: "center", justifyContent: "center", padding: 8 }}>
        <svg width={VB} height={VB} viewBox={`0 0 ${VB} ${VB}`} style={{ display: "block", overflow: "visible", pointerEvents: "none" }}>
          {donut ? (
            <>
              <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth={18} />
              {dSegs.map((s, i) => {
                const isH = hov === i;
                const { lx, ly } = ringLabelPos(s);
                return (
                  <g key={i}>
                    <circle cx={cx} cy={cy} r={r} fill="none" stroke={s.color}
                      strokeWidth={isH ? 22 : 18}
                      strokeDasharray={`${s.dash} ${s.gap}`}
                      strokeDashoffset={-s.offset + circ / 4}
                      style={{ cursor: "pointer", transition: "stroke-width 0.15s", filter: isH ? `drop-shadow(0 0 8px ${s.color}bb)` : "none" }}
                      onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)} />
                    {isH && s.dash > 12 && (
                      <g>
                        <rect x={lx - 18} y={ly - 11} width={36} height={18} rx={4} fill="#0f172a" opacity={0.92} />
                        <text x={lx} y={ly + 5} textAnchor="middle" fontSize={11} fontWeight={700} fill="#fff" fontFamily="DM Sans,sans-serif">{s.value}</text>
                      </g>
                    )}
                  </g>
                );
              })}
              <text x={cx} y={cy - 8} textAnchor="middle" fontSize={20} fontWeight={700} fill="#1e293b" fontFamily="DM Sans,sans-serif">{total}</text>
              <text x={cx} y={cy + 13} textAnchor="middle" fontSize={10} fill="#94a3b8" fontFamily="DM Sans,sans-serif">total</text>
            </>
          ) : (
            <>
              {segs.map((s, i) => {
                const isH = hov === i;
                const { lx, ly } = sliceLabelPos(s);
                return (
                  <g key={i} style={{ cursor: "pointer" }} onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)}>
                    <path d={arcPath(s)} fill={s.color} stroke="#fff" strokeWidth={isH ? 3 : 1.5}
                      style={{ filter: isH ? `drop-shadow(0 3px 10px ${s.color}99)` : "none", opacity: isH ? 1 : 0.88, transition: "all 0.15s" }} />
                    {isH && (s.end - s.start) > 0.18 && (
                      <g>
                        <rect x={lx - 18} y={ly - 11} width={36} height={18} rx={4} fill="#0f172a" opacity={0.92} />
                        <text x={lx} y={ly + 5} textAnchor="middle" fontSize={11} fontWeight={700} fill="#fff" fontFamily="DM Sans,sans-serif">{s.value}</text>
                      </g>
                    )}
                  </g>
                );
              })}
              <text x={cx} y={cy - 8} textAnchor="middle" fontSize={16} fontWeight={700} fill="#1e293b" fontFamily="DM Sans,sans-serif">{total}</text>
              <text x={cx} y={cy + 12} textAnchor="middle" fontSize={10} fill="#94a3b8" fontFamily="DM Sans,sans-serif">total</text>
            </>
          )}
        </svg>
      </div>
      {/* RIGHT 50%: legends centred vertically */}
      <div style={{ flex: "0 0 50%", display: "flex", flexDirection: "column", justifyContent: "center", gap: 7, padding: "8px 12px 8px 4px" }}>
        {displaySegs.map((s, i) => (
          <div key={i}
            style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "4px 8px", borderRadius: 6, background: hov === i ? `${s.color}18` : "transparent", transition: "background 0.15s" }}
            onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)}>
            <div style={{ width: 11, height: 11, borderRadius: 3, background: s.color, flexShrink: 0, transform: hov === i ? "scale(1.35)" : "scale(1)", transition: "transform 0.15s" }} />
            <span style={{ fontSize: 11.5, color: "#374151", flex: 1, fontWeight: hov === i ? 700 : 400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.label}</span>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: hov === i ? s.color : "#64748b", minWidth: 24, textAlign: "right", flexShrink: 0 }}>{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const DonutChart = ({ data }) => <PieChart data={data} donut={true} />;

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

const SmartChart = ({ title, data, defaultType = "bar", defaultColor = "#3b82f6", size = "normal" }) => {
  const [type, setType] = useState(defaultType);
  const [showPicker, setShowPicker] = useState(false);
  const [hov, setHov] = useState(null);
  const baseW = 280, baseH = 130;
  const W = size === "small" ? 240 : baseW;
  const H = size === "small" ? 100 : baseH;
  const PL = 28, PR = 8, PT = 10, PB = 22;
  const IW = W - PL - PR, IH = H - PT - PB;
  const max = Math.max(...data.map(d => d.value), 1);
  const total = data.reduce((s, d) => s + d.value, 0);
  const COLORS = PIE_COLORS;
  const col = (i, base) => (data[i]?.color) || (base && base !== "#3b82f6" ? base : COLORS[i % COLORS.length]);
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

  if (type === "pie") {
    const pieData = data.map((d, i) => ({ ...d, color: d.color || pieCo(i, defaultColor === "#3b82f6" ? null : defaultColor) }));
    return (
      <div style={{ background: "#fff", borderRadius: 12, padding: "14px 16px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>{title}</span>
          <div style={{ position: "relative", zIndex: 10 }}>
            <button onClick={() => setShowPicker(!showPicker)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 8px", borderRadius: 6, border: "1px solid #e2e8f0", background: "#f8fafc", cursor: "pointer", fontSize: 11, color: "#374151", fontFamily: "'DM Sans',sans-serif", fontWeight: 500 }}>
              <span>{CHART_TYPES.find(t => t.id === type)?.icon}</span>
              <span>{CHART_TYPES.find(t => t.id === type)?.label}</span>
              <span style={{ fontSize: 9, color: "#94a3b8" }}>▾</span>
            </button>
            {showPicker && (
              <div style={{ position: "absolute", right: 0, top: "calc(100% + 4px)", background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 10, zIndex: 11, boxShadow: "0 8px 24px rgba(0,0,0,0.14)", minWidth: 140, overflow: "hidden", padding: 4 }}>
                {CHART_TYPES.map(ct => (
                  <button key={ct.id} onClick={() => { setType(ct.id); setShowPicker(false); setHov(null); }}
                    style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 10px", border: "none", background: type === ct.id ? "#eff6ff" : "#fff", cursor: "pointer", fontSize: 12, textAlign: "left", fontFamily: "'DM Sans',sans-serif", borderRadius: 6, color: type === ct.id ? "#3b82f6" : "#374151", fontWeight: type === ct.id ? 600 : 400, marginBottom: 1 }}>
                    <span style={{ fontSize: 13, width: 18, textAlign: "center" }}>{ct.icon}</span>{ct.label}
                    {type === ct.id && <span style={{ marginLeft: "auto", color: "#3b82f6", fontWeight: 700 }}>✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div style={{ position: "relative", paddingTop: 8 }}>
          <PieChart data={pieData} donut={false} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "#fff", borderRadius: 12, padding: "14px 16px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", position: "relative", zIndex: 1 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>{title}</span>
        <div style={{ position: "relative", zIndex: 10 }}>
          <button onClick={() => setShowPicker(!showPicker)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 8px", borderRadius: 6, border: "1px solid #e2e8f0", background: "#f8fafc", cursor: "pointer", fontSize: 11, color: "#374151", fontFamily: "'DM Sans',sans-serif", fontWeight: 500 }}>
            <span>{CHART_TYPES.find(t => t.id === type)?.icon}</span>
            <span>{CHART_TYPES.find(t => t.id === type)?.label}</span>
            <span style={{ fontSize: 9, color: "#94a3b8" }}>▾</span>
          </button>
          {showPicker && (
            <div style={{ position: "absolute", right: 0, top: "calc(100% + 4px)", background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 10, zIndex: 11, boxShadow: "0 8px 24px rgba(0,0,0,0.14)", minWidth: 140, overflow: "hidden", padding: 4 }}>
              {CHART_TYPES.map(ct => (
                <button key={ct.id} onClick={() => { setType(ct.id); setShowPicker(false); setHov(null); }}
                  style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 10px", border: "none", background: type === ct.id ? "#eff6ff" : "#fff", cursor: "pointer", fontSize: 12, textAlign: "left", fontFamily: "'DM Sans',sans-serif", borderRadius: 6, color: type === ct.id ? "#3b82f6" : "#374151", fontWeight: type === ct.id ? 600 : 400, marginBottom: 1 }}>
                  <span style={{ fontSize: 13, width: 18, textAlign: "center" }}>{ct.icon}</span>{ct.label}
                  {type === ct.id && <span style={{ marginLeft: "auto", color: "#3b82f6", fontWeight: 700 }}>✓</span>}
                </button>
              ))}
            </div>
          )}
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

  // ✅ NEW: User management edit modal state
  const [userEditModal, setUserEditModal] = useState({ show: false, user: null, newRole: null });

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
  const [customDateFrom, setCustomDateFrom] = useState("");
  const [customDateTo, setCustomDateTo] = useState("");
  const [dashboardOrg, setDashboardOrg] = useState("all");
  const [dashboardOrgSearch, setDashboardOrgSearch] = useState("");
  const [showDashboardOrgDD, setShowDashboardOrgDD] = useState(false);
  // ✅ NEW: Dashboard time period filter
  const [dashboardTimePeriod, setDashboardTimePeriod] = useState("1m");  // 1d, 7d, 1m, 3m, 6m, 1y, all

  // ✅ NEW: Departments and filters
  const [departments, setDepartments] = useState([]);
  const [pendingDepartments, setPendingDepartments] = useState([]);
  const [deptFilter, setDeptFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [orgFilter, setOrgFilter] = useState("all");
  const [vendorFilter, setVendorFilter] = useState("all");
  const [orgFilterSearch, setOrgFilterSearch] = useState("");
  const [showOrgFilterDD, setShowOrgFilterDD] = useState(false);
  const [orgClassifyType, setOrgClassifyType] = useState("all");
  const [newDept, setNewDept] = useState({ name: "", orgName: "" });

  // ✅ NEW: Locations (from database)
  const [locations, setLocations] = useState([]);
  const [newLocation, setNewLocation] = useState({ name: "" });

  // ✅ NEW: Vendor Management
  const [vendors, setVendors] = useState([]);
  const [newVendor, setNewVendor] = useState({ name: "", email: "", phone: "", address: "" });
  const [showAddVendorModal, setShowAddVendorModal] = useState(false);

  // ✅ NEW: User Add Modal
  const [showAddUserModal, setShowAddUserModal] = useState(false);

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
  const [pendingTicketStatus, setPendingTicketStatus] = useState(null);
  const [selProject, setSelProject] = useState(null);
  const [selAgent, setSelAgent] = useState(null);
  const [agentStatusFilter, setAgentStatusFilter] = useState("all");
  const [agentTicketFilter, setAgentTicketFilter] = useState(null);

  // ── Satsangs ──
  const [satsangs, setSatsangs] = useState([]);
  const [satsangTypes, setSatsangTypes] = useState([]);
  const [satsangTypeSearch, setSatsangTypeSearch] = useState("");
  const [showSatsangTypeDD, setShowSatsangTypeDD] = useState(false);
  const [newSatsangType, setNewSatsangType] = useState("");
  const [projSatsangTypeSearch, setProjSatsangTypeSearch] = useState("");
  const [showProjSatsangTypeDD, setShowProjSatsangTypeDD] = useState(false);

  // ── Comments ──
  const [newComment, setNewComment] = useState("");
  const [commentImage, setCommentImage] = useState(null);
  const [commentImagePreview, setCommentImagePreview] = useState(null);
  const [ticketImage, setTicketImage] = useState(null);
  const [ticketImagePreview, setTicketImagePreview] = useState(null);
  const [newProjComment, setNewProjComment] = useState("");

  // ── Ticket form ──
  const getDefaultDueDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split("T")[0];
  };
  const emptyForm = () => ({ org: "", department: "", contact: "", reportedBy: "", summary: "", description: "", assignees: [], priority: "Medium", category: "", customAttrs: {}, dueDate: getDefaultDueDate(), satsangType: "", location: "", webcastId: null });
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

  // ✅ NEW: Separate location dropdown states for webcast fields
  const [webcastLocationSearch, setWebcastLocationSearch] = useState("");
  const [showWebcastLocationDD, setShowWebcastLocationDD] = useState(false);
  const [projWebcastLocationSearch, setProjWebcastLocationSearch] = useState("");
  const [showProjWebcastLocationDD, setShowProjWebcastLocationDD] = useState(false);

  // ── Project form ──
  const emptyProjectForm = { org: "", department: "", reportedBy: "", title: "", description: "", assignees: [], priority: "Medium", category: "", status: "Open", location: "", dueDate: "", satsangType: "", progress: 0, customAttrs: {}, webcastId: null };
  const [projForm, setProjForm] = useState(emptyProjectForm);
  const [projCcInput, setProjCcInput] = useState("");

  // ── Settings forms ──
  const [newOrg, setNewOrg] = useState({ name: "", domain: "", phone: "" });
  const [newCat, setNewCat] = useState({ name: "", color: "#3b82f6" });
  const [newUser, setNewUser] = useState({ name: "", email: "", password: "", role: "Viewer" });
  const [newAttr, setNewAttr] = useState({ name: "", type: "text", options: "", required: false, section: "grid", sortOrder: 0 });
  const [attrDragIdx, setAttrDragIdx] = useState(null);
  const [showAttrLayoutModal, setShowAttrLayoutModal] = useState(false);
  const [layoutDraft, setLayoutDraft] = useState([]);
  const [layoutDragIdx, setLayoutDragIdx] = useState(null);
  const [layoutDragOver, setLayoutDragOver] = useState(null);

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
  const [slideIndex, setSlideIndex] = useState(0);
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

  // ── Slideshow (Login Page) ──
  useEffect(() => {
    if (!currentUser) {
      const timer = setInterval(() => {
        setSlideIndex((prev) => (prev + 1) % 3);
      }, 5000);
      return () => clearInterval(timer);
    }
  }, [currentUser]);

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
  const [timelineTab, setTimelineTab] = useState("external");       // "internal" | "external"
  const [commentVisibility, setCommentVisibility] = useState("external"); // "internal" | "external"

  // ── Notification Center ──
  // Bell: populated purely from DB — no localStorage caching
  const [dailyNotifs, setDailyNotifs] = useState([]);
  const [showBellPanel, setShowBellPanel] = useState(false);
  const [bellUnread, setBellUnread] = useState(0);

  // Mail: inbox items from DB (per user), persisted
  const [inboxItems, setInboxItems] = useState([]);
  const [showInboxPanel, setShowInboxPanel] = useState(false);
  const [inboxUnread, setInboxUnread] = useState(0);

  // Floating forward-request alerts (30 sec, with Accept/Reject)
  const [floatingAlerts, setFloatingAlerts] = useState([]);

  // ── Core notification broadcaster ──────────────────────────────────────────
  // ONE row in DB per event (userId = 0 = global).
  // Admins/Managers poll userId=0 and see everything.
  // For ticket events, also push one personal row to each assigned agent/viewer.
  const addDailyNotif = (notif) => {
    if (!currentUser) return;
    const nowISO = new Date().toISOString();
    const ticketEventTypes = [
      "ticket_created", "ticket_closed", "ticket_status", "ticket_edited",
      "ticket_forwarded", "forward_approved", "forward_rejected"
    ];
    const globalEventTypes = [
      ...ticketEventTypes,
      "project_created", "org_added", "category_added", "dept_added",
      "location_added", "vendor_added", "user_added"
    ];
    if (!globalEventTypes.includes(notif.type)) return;

    const payload = {
      type: "activity",
      title: notif.text,
      message: notif.text,
      ticketId: notif.ticketId || null,
      from: currentUser.name,
      broadcastIcon: notif.icon,
      broadcastType: notif.type,
      read: false,
      alerted: false,
      createdAt: nowISO
    };

    // 2. ONE global row — userId = 0 — visible to all admins/managers
    axios.post(NOTIFICATIONS_API, { ...payload, userId: 0 }).catch(err => console.error("Notif POST failed:", err?.response?.data || err.message));

    // 3. For ticket events only: also send a personal row to each assigned agent/viewer
    //    so they see their own tickets in their bell too
    if (ticketEventTypes.includes(notif.type) && notif.ticketId) {
      const ticket = tickets.find(t => t.id === notif.ticketId);
      if (ticket) {
        const assigneeIds = (ticket.assignees || [])
          .filter(a => a.id !== currentUser.id &&
            !["Admin", "Manager"].includes(Array.isArray(users) ? users.find(u => u.id === a.id)?.role : undefined))
          .map(a => a.id);
        if (assigneeIds.length > 0) {
          axios.post(NOTIFICATIONS_API, { ...payload, recipientIds: assigneeIds }).catch(err => console.error("Notif assignee POST failed:", err?.response?.data || err.message));
        }
      }
    }
  };

  const pushFloatingAlert = (item) => {
    const alertId = `fa-${Date.now()}-${Math.random()}`;
    setFloatingAlerts(prev => [...prev, { ...item, alertId }]);
    setTimeout(() => {
      setFloatingAlerts(prev => prev.filter(a => a.alertId !== alertId));
    }, 30000);
  };

  // ── Profile ──
  const [profileOpen, setProfileOpen] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({ phone: "", name: "" });
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ oldPassword: "", newPassword: "", confirmPassword: "" });
  const [customAlert, setCustomAlert] = useState({ show: false, message: "", type: "success" });

  // ✅ NEW: Activity Logging & Session Tracking
  const [activityLogs, setActivityLogs] = useState([]);
  const [sessionHistory, setSessionHistory] = useState([]);
  const [showSessionHistory, setShowSessionHistory] = useState(false);
  const [showActivityLog, setShowActivityLog] = useState(false);

  // ✅ NEW: Location & Ticket Tracking
  const [currentTicketId, setCurrentTicketId] = useState("");
  const [currentLocation, setCurrentLocation] = useState("");
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showTicketDropdown, setShowTicketDropdown] = useState(false);
  const [showRemarkModal, setShowRemarkModal] = useState(false);
  const [closingTicketId, setClosingTicketId] = useState(null);
  const [ticketRemark, setTicketRemark] = useState("");

  // ✅ NEW: Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState({ show: false, title: "", message: "", onConfirm: null, onCancel: null });
  const [selectedTickets, setSelectedTickets] = useState(new Set());
  const [ticketsPerPage, setTicketsPerPage] = useState(10);
  const [sortOrder, setSortOrder] = useState("desc"); // "desc" = newest first, "asc" = oldest first

  // ── Per-table sort state ──
  const [ticketSort, setTicketSort] = useState({});
  const [projSort, setProjSort] = useState({});
  const [userSort, setUserSort] = useState({});
  const [orgSort, setOrgSort] = useState({});
  const [catSort, setCatSort] = useState({});
  const [deptSort, setDeptSort] = useState({});
  const [locSort, setLocSort] = useState({});
  const [vendorSort, setVendorSort] = useState({});
  const [webcastSort, setWebcastSort] = useState({});
  const [webcastFilter, setWebcastFilter] = useState(null);
  const [agentSort, setAgentSort] = useState({});

  // ✅ NEW: Admin edit user modal
  const [editUserOpen, setEditUserOpen] = useState(null); // Holds the user being edited
  const [editUserForm, setEditUserForm] = useState({ name: "", email: "", password: "" });

  const statusOpts = [
    { l: "On Duty", c: "#22c55e", bg: "#dcfce7" },      // 🟢 Green - In office
    { l: "On Ticket", c: "#06b6d4", bg: "#cffafe" },    // 🔵 Cyan - On ticket/location
    { l: "Idle", c: "#a855f7", bg: "#f3e8ff" },         // 🟣 Purple - Idle (on duty but no ticket)
    { l: "On Lunch", c: "#f97316", bg: "#ffedd5" },     // 🟠 Orange - On lunch break
    { l: "Off Duty", c: "#f59e0b", bg: "#fef3c7" }      // 🟡 Yellow - Off duty
  ];

  // ── Password strength ──
  const calcPwdStr = (pwd) => { if (!pwd) return 0; let s = 0; if (pwd.length >= 8) s += 25; if (/[A-Z]/.test(pwd)) s += 25; if (/[a-z]/.test(pwd)) s += 25; if (/[^A-Za-z0-9]/.test(pwd)) s += 25; return s; };

  // ✅ NEW: Password requirement checks
  const getPwdRequirements = (pwd) => {
    if (!pwd) return [];
    return [
      { id: "length", label: "At least 8 characters", met: pwd.length >= 8 },
      { id: "uppercase", label: "Uppercase letter (A-Z)", met: /[A-Z]/.test(pwd) },
      { id: "lowercase", label: "Lowercase letter (a-z)", met: /[a-z]/.test(pwd) },
      { id: "special", label: "Special character (!@#$%^&*)", met: /[^A-Za-z0-9]/.test(pwd) }
    ];
  };

  const pwdReqs = getPwdRequirements(authForm.password);
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

      // ✅ NEW: Load satsang types from database
      try {
        const satTypeResponse = await axios.get(`${BASE_URL}/satsang-types`);
        setSatsangTypes((satTypeResponse.data || []).map(st => st.name));
      } catch (e) {
        console.log("Satsang types loading from API:", e.message);
        setSatsangTypes([]);
      }

      const allRaw = [...(data.tickets || []), ...(data.webcasts || [])];
      const seenIds = new Set();
      const parsedTickets = allRaw
        .filter(t => { if (seenIds.has(t.id)) return false; seenIds.add(t.id); return true; })
        .map(t => ({
          ...t,
          created: new Date(t.createdAt || t.created),
          updated: new Date(t.updatedAt || t.updated),

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
        webcastId: p.webcastId || null,
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

  // Silent background refresh on page navigation — no loading spinner
  const silentRefresh = async () => {
    try {
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

      try { const r = await axios.get(`${BASE_URL}/departments`); setDepartments(r.data || []); } catch (_) { }
      try { const r = await axios.get(LOCATIONS_API); setLocations(r.data || []); } catch (_) { }
      try { const r = await axios.get(VENDORS_API); setVendors(r.data || []); } catch (_) { }

      const allRaw = [...(data.tickets || []), ...(data.webcasts || [])];
      const seenIds = new Set();
      const parsedTickets = allRaw
        .filter(t => { if (seenIds.has(t.id)) return false; seenIds.add(t.id); return true; })
        .map(t => ({
          ...t,
          created: new Date(t.createdAt || t.created),
          updated: new Date(t.updatedAt || t.updated),

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
        webcastId: p.webcastId || null,
        satsangType: p.satsangType || "",
      })).sort((a, b) => b.created - a.created);

      setProjects(parsedProjects);
    } catch (e) {
      console.error("Silent refresh failed:", e);
    }
  };

  // Refresh data silently every time the user navigates to a different page
  useEffect(() => {
    if (currentUser) silentRefresh();
  }, [view]);

  // ✅ NEW: Check if current user was deleted or deactivated
  useEffect(() => {
    if (!currentUser) return;
    const checkUserStatus = async () => {
      try {
        const response = await axios.get(DB_API);
        const users = response.data.users || [];
        const user = users.find(u => u.id === currentUser.id);

        if (!user) {
          clearSession();
          setCurrentUser(null);
          setCustomAlert({ show: true, message: "❌ Your account has been deleted by an administrator", type: "error" });
          return;
        }

        if (!user.active) {
          clearSession();
          setCurrentUser(null);
          setCustomAlert({ show: true, message: "❌ Your account has been deactivated by an administrator", type: "error" });
          return;
        }

        if (user.role !== currentUser.role) {
          clearSession();
          setCurrentUser(null);
          setCustomAlert({ show: true, message: "⚠️ Your role has been changed. Please log in again.", type: "warning" });
          return;
        }
      } catch (e) {
        console.error("Failed to check user status:", e);
      }
    };

    const interval = setInterval(checkUserStatus, 5000);
    return () => clearInterval(interval);
  }, [currentUser]);

  // ✅ NEW: Validate sessions periodically and update user statuses
  const validateSessions = async () => {
    try {
      // Send the current user email to mark as active
      const activeUserEmails = currentUser ? [currentUser.email] : [];
      const response = await axios.post(VALIDATE_SESSIONS_API, { emails: activeUserEmails });
      // ✅ FIX: Handle the response structure { active: [...], inactive: [...] }
      const activeUsers = response.data?.active || response.data || [];
      setUsers(Array.isArray(activeUsers) ? activeUsers : []);
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

  // ── Inbox polling: fetch notifications from DB every 10s ──
  // Use a ref to track which DB activity IDs we've already seen
  // Persist to localStorage so it survives page reloads
  const seenActivityIds = useRef(new Set());

  // Load seen IDs from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("seenActivityIds");
      if (saved) {
        seenActivityIds.current = new Set(JSON.parse(saved));
      }
    } catch (e) {
      console.error("Failed to load seenActivityIds:", e);
    }
  }, []);

  const fetchInbox = async () => {
    if (!currentUser) return;
    const isAdminOrManager = ["Admin", "Manager"].includes(currentUser.role);
    try {
      // Personal notifications (forward requests, responses, ticket assignments for agents)
      const personalRes = await axios.get(`${NOTIFICATIONS_API}?userId=${currentUser.id}`);
      const personalItems = personalRes.data || [];

      // Global activity log (userId=0) — only admins/managers pull this
      let globalItems = [];
      if (isAdminOrManager) {
        const globalRes = await axios.get(`${NOTIFICATIONS_API}?userId=0`);
        globalItems = globalRes.data || [];
      }

      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);

      // ── Activity items for bell: global rows (admins) + personal activity rows (agents) ──
      const allActivityItems = [
        ...globalItems.filter(i => i.type === "activity"),
        ...personalItems.filter(i => i.type === "activity")
      ];

      // Build bell items from today's activity — DB is the single source of truth
      const bellItems = allActivityItems
        .filter(a => new Date(a.createdAt) >= todayStart)
        .map(a => ({
          id: `db-${a.id}`,
          dbId: a.id,
          type: a.broadcastType || "activity",
          icon: a.broadcastIcon || "📢",
          text: a.title,
          ticketId: a.ticketId,
          by: a.from,
          time: a.createdAt,
          fromDB: true,
          fromBroadcast: a.userId === 0
        }))
        .sort((a, b) => new Date(b.time) - new Date(a.time));

      setDailyNotifs(bellItems);

      // Unread = items not yet seen (not in ref). Ref is populated when bell is opened.
      const unseenCount = bellItems.filter(b => !seenActivityIds.current.has(b.dbId)).length;
      setBellUnread(unseenCount);

      // ── Inbox panel: personal non-activity items (forward requests, responses, assignments) ──
      const inboxOnlyItems = personalItems.filter(i => i.type !== "activity");
      setInboxItems(inboxOnlyItems);
      setInboxUnread(inboxOnlyItems.filter(i => !i.read).length);

      inboxOnlyItems
        .filter(i => !i.read && (i.type === "forward_request" || i.type === "forward_response") && (i.type !== "forward_request" || !i.resolved))
        .forEach(item => {
          if (!item.alerted) {
            pushFloatingAlert(item);
            axios.put(`${NOTIFICATIONS_API}/${item.id}`, { ...item, alerted: true }).catch(() => { });
          }
        });

      // ✅ NEW: Popup when current user gets a ticket assigned
      inboxOnlyItems
        .filter(i => !i.read && i.type === "ticket_assignment")
        .forEach(item => {
          if (!item.alerted) {
            setCustomAlert({
              show: true,
              message: `🎫 ${item.title || 'New ticket assigned to you!'}`,
              type: "success",
              duration: 5000
            });
            axios.put(`${NOTIFICATIONS_API}/${item.id}`, { ...item, alerted: true }).catch(() => { });
          }
        });
    } catch (e) {
      // Silently fail — notifications are non-critical
    }
  };

  useEffect(() => {
    if (!currentUser) return;
    // ✅ REMOVED: seenActivityIds.current = new Set(); // Don't reset - keep persistent across reloads
    fetchInbox();
    const interval = setInterval(fetchInbox, 10000);
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
    return Array.isArray(users) ? users.filter(u => u.role === "Admin" || u.role === "Manager") : [];
  }, [users]);

  // ─── COMPUTED DATA ─────────────────────────────────────────────────────────
  const now = Date.now(), dayMs = 86400000;
  const rangeMs = (() => {
    if (range === "all") return Infinity;
    if (range === "custom") return Infinity; // handled separately in fbr
    if (range === "last_month") {
      // last 6 calendar months back from today
      const d = new Date(); d.setHours(0, 0, 0, 0);
      const start6mo = new Date(d); start6mo.setMonth(start6mo.getMonth() - 6);
      return d.getTime() - start6mo.getTime();
    }
    return parseInt(range) * dayMs;
  })();
  const fbr = useMemo(() => {
    let inRange;
    if (range === "all") {
      inRange = tickets;
    } else if (range === "custom") {
      const from = customDateFrom ? new Date(customDateFrom) : null;
      const to = customDateTo ? new Date(customDateTo) : null;
      if (to) to.setHours(23, 59, 59, 999); // include full end day
      inRange = tickets.filter(t => {
        const tc = t.created instanceof Date ? t.created : new Date(t.created);
        if (from && tc < from) return false;
        if (to && tc > to) return false;
        return true;
      });
    } else if (range === "last_month") {
      const d = new Date(); d.setHours(0, 0, 0, 0);
      const start6mo = new Date(d); start6mo.setMonth(start6mo.getMonth() - 6);
      inRange = tickets.filter(t => t.created.getTime() >= start6mo.getTime());
    } else {
      inRange = tickets.filter(t => now - t.created.getTime() <= rangeMs);
    }
    if (currentUser?.role === "Admin" || currentUser?.role === "Manager") return inRange;
    return inRange.filter(t => t.reportedBy === currentUser?.name || t.assignees?.some(a => a.id === currentUser?.id));
  }, [tickets, range, rangeMs, now, currentUser, customDateFrom, customDateTo]);

  // ✅ NEW: Dashboard data filtered by organization AND time period
  const dashboardData = useMemo(() => {
    let data = fbr;
    if (dashboardOrg !== "all") {
      data = data.filter(t => t.org === dashboardOrg);
    }

    // ✅ NEW: Filter by time period
    const now = new Date();
    const cutoffDate = new Date();

    switch (dashboardTimePeriod) {
      case "1d":
        cutoffDate.setHours(0, 0, 0, 0);
        break;
      case "7d":
        cutoffDate.setDate(cutoffDate.getDate() - 7);
        break;
      case "1m":
        cutoffDate.setMonth(cutoffDate.getMonth() - 1);
        break;
      case "3m":
        cutoffDate.setMonth(cutoffDate.getMonth() - 3);
        break;
      case "6m":
        cutoffDate.setMonth(cutoffDate.getMonth() - 6);
        break;
      case "1y":
        cutoffDate.setFullYear(cutoffDate.getFullYear() - 1);
        break;
      case "all":
      default:
        return data;  // No time filtering
    }

    return data.filter(t => {
      const td = t.created instanceof Date ? t.created : new Date(t.created);
      return td >= cutoffDate;
    });
  }, [fbr, dashboardOrg, dashboardTimePeriod]);

  // ✅ NEW: Classified reports data based on filters
  const classifiedReportsData = useMemo(() => {
    let data = fbr;

    if (exportFilterType === "assignee" && exportFilterValue) {
      data = data.filter(t => t.assignees?.some(a => a.id === exportFilterValue));
    } else if (exportFilterType === "category" && exportFilterValue) {
      data = data.filter(t => t.category === exportFilterValue);
    } else if (exportFilterType === "type" && exportFilterValue) {
      if (exportFilterValue === "webcast") {
        data = data.filter(t => t.category === "Webcast");
      } else if (exportFilterValue === "ticket") {
        data = data.filter(t => t.category !== "Webcast");
      }
    } else if (exportFilterType === "status" && exportFilterValue) {
      data = data.filter(t => t.status === exportFilterValue);
    } else if (exportFilterType === "priority" && exportFilterValue) {
      data = data.filter(t => t.priority === exportFilterValue);
    }

    return data;
  }, [fbr, exportFilterType, exportFilterValue]);

  // Report filtered data uses the same top-bar range filter as the dashboard
  const reportFilteredData = fbr;

  const prbr = useMemo(() => range === "all" ? projects : projects.filter(p => now - p.created.getTime() <= rangeMs), [projects, rangeMs, range, now]);

  const isPrivilegedRole = currentUser?.role === "Admin" || currentUser?.role === "Manager";
  const effectiveTvFilter = (tvFilter === "unassigned" && !isPrivilegedRole) ? "all" : tvFilter;
  const cvd = TICKET_VIEWS.find(v => v.id === effectiveTvFilter) || TICKET_VIEWS[5];
  const cpv = PROJECT_VIEWS.find(v => v.id === pvFilter) || PROJECT_VIEWS[5];

  // ✅ A ticket is a TRUE webcast only if isWebcast=true OR ID starts with WEB- or WC-
  // TKT- tickets with category "Webcast" are regular tickets that got migrated — NOT webcasts
  const isTrueWebcast = (t) =>
    t.isWebcast === true ||
    String(t.id).startsWith("WEB-") ||
    String(t.id).startsWith("WC-");

  const filtered = useMemo(() => tickets.filter(t => {
    // ✅ Exclude true webcast tickets from regular tickets view
    if (isTrueWebcast(t)) return false;

    if (!currentUser || !cvd.filter(t, currentUser)) return false;
    // Non-admins/managers only see tickets assigned to them or reported by them
    if (currentUser.role !== "Admin" && currentUser.role !== "Manager" && t.reportedBy !== currentUser.name && !t.assignees?.some(a => a.id === currentUser.id)) return false;
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
    // ✅ Only show true webcasts (WEB-/WC- IDs or isWebcast=true), never TKT- tickets
    if (!isTrueWebcast(t)) return false;

    if (!currentUser || !cvd.filter(t, currentUser)) return false;
    // Non-admins/managers only see tickets assigned to them or reported by them
    if (currentUser.role !== "Admin" && currentUser.role !== "Manager" && t.reportedBy !== currentUser.name && !t.assignees?.some(a => a.id === currentUser.id)) return false;
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

  // Filter tickets by column filters
  const allSortedTickets = applySort(filtered, ticketSort);

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

  const stats = useMemo(() => ({ total: fbr.length, open: fbr.filter(x => x.status === "Open" || x.status === "In Progress").length, inProgress: fbr.filter(x => x.status === "In Progress").length, closed: fbr.filter(x => x.status === "Closed").length, critical: fbr.filter(x => x.priority === "Critical").length }), [fbr]);

  // ✅ NEW: Dashboard stats (filtered by organization)
  const dashboardStats = useMemo(() => ({
    total: dashboardData.length,
    open: dashboardData.filter(x => x.status === "Open" || x.status === "In Progress").length,
    inProgress: dashboardData.filter(x => x.status === "In Progress").length,
    closed: dashboardData.filter(x => x.status === "Closed").length,
    critical: dashboardData.filter(x => x.priority === "Critical" && x.status !== "Closed").length
  }), [dashboardData]);

  // For dashboard: Agents and Viewers only see stats for projects assigned to them
  const dashboardProjects = useMemo(() => {
    if (currentUser?.role === "Agent" || currentUser?.role === "Viewer") {
      return prbr.filter(p => p.assignees?.some(a => a.id === currentUser?.id));
    }
    return prbr;
  }, [prbr, currentUser]);

  const projStats = useMemo(() => ({ total: dashboardProjects.length, open: dashboardProjects.filter(x => x.status === "Open").length, inProgress: dashboardProjects.filter(x => x.status === "In Progress").length, closed: dashboardProjects.filter(x => x.status === "Closed").length, critical: dashboardProjects.filter(x => x.priority === "Critical" && x.status !== "Closed").length }), [dashboardProjects]);
  const agentStats = useMemo(() => (Array.isArray(users) ? users : []).map(u => ({ ...u, assigned: fbr.filter(t => t.assignees?.some(a => a.id === u.id)).length, closed: fbr.filter(t => t.assignees?.some(a => a.id === u.id) && t.status === "Closed").length, projAssigned: prbr.filter(p => p.assignees?.some(a => a.id === u.id)).length })), [fbr, prbr, users]);
  const dailyData = useMemo(() => { const days = parseInt(range) <= 7 ? parseInt(range) : 7; return Array.from({ length: days }, (_, i) => { const d = new Date(now - (days - 1 - i) * dayMs); return { label: d.toLocaleDateString("en", { weekday: "short" }), value: fbr.filter(t => t.created.getDate() === d.getDate() && t.created.getMonth() === d.getMonth()).length }; }); }, [fbr, range, now, dayMs]);
  const priorityDist = useMemo(() => PRIORITIES.map(p => ({ label: p, value: dashboardData.filter(t => t.priority === p).length, color: PRIORITY_COLOR[p] })), [dashboardData]);
  const categoryDist = useMemo(() => categories.slice(0, 6).map(c => ({ label: c.name, value: dashboardData.filter(t => t.category === c.name).length, color: c.color })), [dashboardData, categories]);

  // ✅ NEW: Dashboard-specific chart data (with org filter)
  const dashboardDailyData = useMemo(() => {
    if (range === "1") {
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const slots = [
        { label: "12am", start: 0, end: 4 }, { label: "4am", start: 4, end: 8 },
        { label: "8am", start: 8, end: 12 }, { label: "12pm", start: 12, end: 16 },
        { label: "4pm", start: 16, end: 20 }, { label: "8pm", start: 20, end: 24 },
      ];
      return slots.map(slot => ({
        label: slot.label,
        value: dashboardData.filter(t => {
          const d = t.created instanceof Date ? t.created : new Date(t.created);
          return d >= todayStart && d.getHours() >= slot.start && d.getHours() < slot.end;
        }).length
      }));
    }
    const days = 7;
    return Array.from({ length: days }, (_, i) => {
      const d = new Date(now - (days - 1 - i) * dayMs);
      return {
        label: d.toLocaleDateString("en", { weekday: "short" }),
        value: dashboardData.filter(t => {
          const td = t.created instanceof Date ? t.created : new Date(t.created);
          return td.getDate() === d.getDate() && td.getMonth() === d.getMonth() && td.getFullYear() === d.getFullYear();
        }).length
      };
    });
  }, [dashboardData, range, now, dayMs]);

  const dashboardStatusDist = useMemo(() => {
    const statusCounts = {};
    STATUSES.forEach(s => statusCounts[s] = 0);
    statusCounts["Unassigned"] = 0;

    dashboardData.forEach(t => {
      if (!t.assignees || t.assignees.length === 0) {
        statusCounts["Unassigned"]++;
      } else {
        // Treat "Resolved" as "Closed" — no separate classification
        const status = t.status === "Resolved" ? "Closed" : t.status;
        if (STATUSES.includes(status)) {
          statusCounts[status] = (statusCounts[status] || 0) + 1;
        }
      }
    });

    return Object.entries(statusCounts).map(([s, count]) => ({
      label: s,
      color: s === "Unassigned" ? "#94a3b8" : Object.values(STATUS_COLOR)[STATUSES.indexOf(s)]?.text || "#64748b",
      value: count
    }));
  }, [dashboardData]);

  const dashboardClosingUsers = useMemo(() => {
    const closedTickets = dashboardData.filter(t => t.status === "Closed");
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
      .map(([name, count], i) => ({ label: name, value: count, color: PIE_COLORS[i % PIE_COLORS.length] }));
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
                const validRoles = ["Admin", "Manager", "Agent", "Viewer"];
                const cleaned = row.role.charAt(0).toUpperCase() + row.role.slice(1).toLowerCase();
                row.role = validRoles.includes(cleaned) ? cleaned : "Viewer";
              } else {
                row.role = "Viewer";
              }

              // ✅ Set defaults for optional fields
              if (row.active === undefined || row.active === "") row.active = true;
              if (row.status === undefined || row.status === "") row.status = "Off Duty";
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
                const validRoles = ["Admin", "Manager", "Agent", "Viewer"];
                const cleaned = row.role.charAt(0).toUpperCase() + row.role.slice(1).toLowerCase();
                row.role = validRoles.includes(cleaned) ? cleaned : "Viewer";
              } else {
                row.role = "Viewer";
              }
              if (row.active === undefined) row.active = true;
              if (row.status === undefined) row.status = "Off Duty";
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
          projects: PROJECTS_API,
          departments: `${BASE_URL}/departments`
        };

        const apiEndpoint = API_MAP[targetTable];
        if (!apiEndpoint) {
          setCustomAlert({ show: true, message: `Unknown table: ${targetTable}`, type: "error" });
          return;
        }

        // For departments: deduplicate — skip if same name + same orgName already exists
        if (targetTable === "departments") {
          const existingKeys = new Set(departments.map(d => `${(d.orgName || "General").toLowerCase()}::${d.name.trim().toLowerCase()}`));
          payload = payload.filter(row => {
            const key = `${(row.orgName || row.org_name || "General").toLowerCase()}::${(row.name || "").trim().toLowerCase()}`;
            return !existingKeys.has(key);
          });
          // Normalize field names
          payload = payload.map(row => ({
            name: (row.name || "").trim(),
            orgName: (row.orgName || row.org_name || row.org || "General").trim(),
          })).filter(row => row.name);
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
      categories: categories,
      departments: departments
    };

    let dataToExport = DATA_MAP[targetTable] || [];

    // Apply filters based on export filter type
    if (targetTable === "tickets") {
      if (exportFilterType === "assignee" && exportFilterValue) {
        dataToExport = dataToExport.filter(t =>
          t.assignees?.some(a => a.id === exportFilterValue || a.name === exportFilterValue)
        );
      } else if (exportFilterType === "category" && exportFilterValue) {
        dataToExport = dataToExport.filter(t => t.category === exportFilterValue);
      } else if (exportFilterType === "type" && exportFilterValue) {
        if (exportFilterValue === "webcast") {
          dataToExport = dataToExport.filter(t => isTrueWebcast(t));
        } else if (exportFilterValue === "ticket") {
          dataToExport = dataToExport.filter(t => !isTrueWebcast(t));
        }
      }
    } else if (targetTable === "users" && exportFilterType === "role" && exportFilterValue) {
      dataToExport = dataToExport.filter(u => u.role === exportFilterValue);
    } else if (targetTable === "orgs" && exportFilterType === "domain" && exportFilterValue) {
      dataToExport = dataToExport.filter(o => o.domain === exportFilterValue);
    } else if (targetTable === "categories" && exportFilterType === "color" && exportFilterValue) {
      dataToExport = dataToExport.filter(c => c.color === exportFilterValue);
    } else if (targetTable === "departments" && exportFilterType === "org" && exportFilterValue) {
      dataToExport = dataToExport.filter(d => (d.orgName || "General") === exportFilterValue);
    }

    if (dataToExport.length === 0) {
      setCustomAlert({ show: true, message: `No ${targetTable} data found with selected filter`, type: "error" });
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

  // ✅ NEW: Compress image to base64 with minimal size
  const compressImage = (file, callback) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target.result;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        const maxWidth = 640;
        const maxHeight = 480;
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL("image/jpeg", 0.6);
        callback(compressed);
      };
    };
  };

  const handleSubmit = async () => {
    if (!form.summary || !form.org) return setCustomAlert({ show: true, message: "Organisation and Summary are required", type: "error" });

    // ✅ NEW: Validate webcast fields if category is Webcast
    if (form.category === "Webcast") {
      if (!form.satsangType || !form.location) {
        return setCustomAlert({ show: true, message: "Satsang Type and Location are required for Webcast", type: "error" });
      }
    }

    const newT = {
      ...form,
      dueDate: form.dueDate || null,
      status: "Open",
      image: ticketImage || null,
      comments: [],
      timeline: [{ action: "Created", by: currentUser.name, date: new Date().toISOString(), note: "Ticket opened." + (ticketImage ? " [with image]" : "") }]
    };
    // Strip fields that don't exist on the Ticket model
    delete newT.webcastId;

    // ✅ NEW: If webcast, create separate entry and send to /api/webcasts
    if (form.category === "Webcast") {
      try {
        // Let server assign a clean sequential WEB-XXXX ID
        const webcastData = {
          // id intentionally omitted — server will generate WEB-XXXX
          summary: form.summary,
          description: form.description,
          satsangType: form.satsangType,
          location: form.location,
          contact: form.contact,
          reportedBy: form.reportedBy,
          org: form.org,
          department: form.department,
          priority: form.priority,
          assignees: form.assignees,
          category: form.category,
          dueDate: form.dueDate || null,
          status: "Open",
          image: ticketImage || null,
          comments: [],
          timeline: [{ action: "Created", by: currentUser.name, date: new Date().toISOString(), note: "Webcast created." + (ticketImage ? " [with image]" : "") }]
        };

        // Send to webcasts API endpoint
        const webcastRes = await axios.post(`${BASE_URL}/webcasts`, webcastData);
        const createdWebcast = webcastRes.data;
        const webcastWithDates = {
          ...createdWebcast,
          created: new Date(createdWebcast.createdAt || createdWebcast.created || new Date()),
          updated: new Date(createdWebcast.updatedAt || createdWebcast.updated || new Date())
        };

        // Update tickets list with webcast entry
        setTickets(prev => [webcastWithDates, ...prev]);
        setSelTicket(webcastWithDates);
        setShowNewTicket(false);
        setForm(emptyForm());
        setTicketImage(null);
        setTicketImagePreview(null);
        setAssigneeSearch("");
        setShowAssigneeDD(false);
        setCustomAlert({ show: true, message: "✅ Webcast created successfully!", type: "success" });
        addDailyNotif({ type: "webcast_created", icon: "📡", text: `${currentUser.name} created webcast ${createdWebcast.id}`, ticketId: createdWebcast.id, by: currentUser.name });
      } catch (e) {
        setCustomAlert({ show: true, message: "Failed to create webcast: " + (e.response?.data?.error || e.message), type: "error" });
      }
      return;
    }

    // ✅ Regular ticket creation
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
      setForm(emptyForm());
      setTicketImage(null);
      setTicketImagePreview(null);
      setAssigneeSearch("");
      setShowAssigneeDD(false);
      setCustomAlert({ show: true, message: "✅ Ticket created successfully!", type: "success" });
      addDailyNotif({ type: "ticket_created", icon: "🎫", text: `${currentUser.name} created ticket ${ticketWithDates.id}`, ticketId: ticketWithDates.id, by: currentUser.name });
      // ✅ Animation handles fade-out automatically (3.5s)
    } catch (e) {
      setCustomAlert({ show: true, message: "Failed to save ticket: " + (e.response?.data?.error || e.message), type: "error" });
    }
  };

  const deleteTicket = async (id) => {
    setConfirmModal({
      show: true,
      title: "Delete Ticket?",
      confirmLabel: "Delete", confirmDanger: true,
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
    // ✅ NEW: If closing ticket, ask for remark first
    if (status === "Closed") {
      setClosingTicketId(id);
      setTicketRemark("");
      setShowRemarkModal(true);
      return;
    }

    const t = tickets.find(x => x.id === id); if (!t) return;
    try {
      const nowISO = new Date().toISOString();
      const newTimelineEvent = { action: `Status changed to ${status}`, by: currentUser.name, date: nowISO, note: "" };
      const updatedT = { ...t, status, updated: nowISO, timeline: [...(t.timeline || []), newTimelineEvent] };
      const apiUrl = isTrueWebcast(t) ? `${BASE_URL}/webcasts/${id}` : `${TICKETS_API}/${id}`;
      await axios.put(apiUrl, updatedT);
      setTickets(p => p.map(x => x.id === id ? { ...updatedT, updated: new Date(nowISO) } : x));
      if (selTicket?.id === id) setSelTicket({ ...updatedT, updated: new Date(nowISO) });

      // ✅ NEW: Status-specific messages
      let statusMessage = "";
      switch (status) {
        case "In Progress":
          statusMessage = "⚙️ Ticket status changed to In Progress";
          break;
        case "Open":
          statusMessage = "📬 Ticket reopened";
          break;
        default:
          statusMessage = "✅ Ticket status updated";
      }
      setCustomAlert({ show: true, message: statusMessage, type: "success" });

      // ✅ Reset pending status after successful update
      setPendingTicketStatus(null);

      if (status === "Closed") {
        addDailyNotif({ type: "ticket_closed", icon: "✅", text: `${currentUser.name} closed ticket ${id}`, ticketId: id, by: currentUser.name });
        // Notify all other assignees that ticket was closed
        const otherAssignees = (t.assignees || []).filter(a => a.id !== currentUser.id);
        for (const assignee of otherAssignees) {
          await axios.post(NOTIFICATIONS_API, {
            userId: assignee.id,
            type: "ticket_closed",
            title: `Ticket ${id} Closed`,
            message: `${currentUser.name} closed ticket "${t.summary}" which was also assigned to you.`,
            ticketId: id,
            read: false,
            createdAt: nowISO,
          }).catch(() => { });
        }
      } else {
        addDailyNotif({ type: "ticket_status", icon: "🔄", text: `${currentUser.name} changed ${id} to ${status}`, ticketId: id, by: currentUser.name });
      }
    } catch (e) { setCustomAlert({ show: true, message: "❌ Failed to update ticket", type: "error" }); }
  };

  // ✅ NEW: Close ticket with remark
  const closeTicketWithRemark = async () => {
    if (!ticketRemark.trim()) {
      setCustomAlert({ show: true, message: "⚠️ Remark is mandatory before closing the ticket", type: "error" });
      return;
    }

    const t = tickets.find(x => x.id === closingTicketId); if (!t) return;
    try {
      const nowISO = new Date().toISOString();
      const newTimelineEvent = { action: "Status changed to Closed", by: currentUser.name, date: nowISO, note: `Remark: ${ticketRemark}` };
      const updatedT = { ...t, status: "Closed", updated: nowISO, timeline: [...(t.timeline || []), newTimelineEvent] };
      const apiUrl = isTrueWebcast(t) ? `${BASE_URL}/webcasts/${closingTicketId}` : `${TICKETS_API}/${closingTicketId}`;
      await axios.put(apiUrl, updatedT);
      setTickets(p => p.map(x => x.id === closingTicketId ? { ...updatedT, updated: new Date(nowISO) } : x));
      if (selTicket?.id === closingTicketId) setSelTicket({ ...updatedT, updated: new Date(nowISO) });
      addDailyNotif({ type: "ticket_closed", icon: "✅", text: `${currentUser.name} closed ticket ${closingTicketId}`, ticketId: closingTicketId, by: currentUser.name });

      // Notify all other assignees that the ticket was closed
      const otherAssignees = (t.assignees || []).filter(a => a.id !== currentUser.id);
      for (const assignee of otherAssignees) {
        await axios.post(NOTIFICATIONS_API, {
          userId: assignee.id,
          type: "ticket_closed",
          title: `Ticket ${closingTicketId} Closed`,
          message: `${currentUser.name} closed ticket "${t.summary}" which was also assigned to you.`,
          ticketId: closingTicketId,
          read: false,
          createdAt: nowISO,
        }).catch(() => { });
      }

      // Reset and close modals
      setShowRemarkModal(false);
      setClosingTicketId(null);
      setTicketRemark("");
      setCustomAlert({ show: true, message: "✅ Ticket successfully closed", type: "success" });
      // Close the ticket details modal after 1 second to show the success message
      setTimeout(() => setSelTicket(null), 1000);
    } catch (e) {
      setCustomAlert({ show: true, message: "Failed to close ticket", type: "error" });
      console.error(e);
    }
  };

  const toggleSel = id => { const s = new Set(selectedIds); s.has(id) ? s.delete(id) : s.add(id); setSelectedIds(s); };
  // Toggle only the tickets visible on the current page
  const toggleCurrentPage = () => {
    const pageIds = currentTickets.map(t => t.id);
    const allPageSelected = pageIds.every(id => selectedIds.has(id));
    const s = new Set(selectedIds);
    if (allPageSelected) {
      pageIds.forEach(id => s.delete(id));
    } else {
      pageIds.forEach(id => s.add(id));
    }
    setSelectedIds(s);
  };
  // Toggle all tickets in the current filtered/classified view (across all pages)
  const toggleAllFiltered = () => selectedIds.size === allSortedTickets.length && allSortedTickets.length > 0
    ? setSelectedIds(new Set())
    : setSelectedIds(new Set(allSortedTickets.map(t => t.id)));
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
              note: `Role: ${currentUser.role} | Reason: ${fwdReason}`,
              visibility: "internal"
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
        addDailyNotif({ type: "ticket_forwarded", icon: "✉️", text: `${currentUser.name} forwarded ${selTicket.id} to ${agent.name}`, ticketId: selTicket.id, by: currentUser.name });
        // Send inbox notification to the agent being assigned
        try {
          await axios.post(NOTIFICATIONS_API, {
            userId: agent.id, type: "ticket_assigned", read: false, alerted: false,
            title: `Ticket Assigned: ${selTicket.id}`,
            message: `${currentUser.name} forwarded ticket ${selTicket.id} to you. Reason: ${fwdReason}`,
            ticketId: selTicket.id, from: currentUser.name, createdAt: nowISO
          });
        } catch { }
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
      addDailyNotif({ type: "forward_requested", icon: "📬", text: `You requested to forward ${selTicket.id} to ${agent.name}`, ticketId: selTicket.id, by: currentUser.name });
      // Send inbox notification to all admins and managers
      const adminsAndManagers = (Array.isArray(users) ? users : []).filter(u => u.active && (u.role === "Admin" || u.role === "Manager"));
      for (const admin of adminsAndManagers) {
        try {
          await axios.post(NOTIFICATIONS_API, {
            userId: admin.id, type: "forward_request", read: false, alerted: false,
            requestId: forwardRequest.id,
            title: `Forward Request: ${selTicket.id}`,
            message: `${currentUser.name} (${currentUser.role}) wants to forward ${selTicket.id} to ${agent.name}. Reason: ${fwdReason}`,
            ticketId: selTicket.id, ticketSummary: selTicket.summary,
            fromUser: currentUser.name, fromUserId: currentUser.id,
            toAgent: agent, createdAt: nowISO, reason: fwdReason
          });
        } catch { }
      }
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
            note: `Request from ${request.fromRole} ${request.fromUser}. Reason: ${request.reason}`,
            visibility: "internal"
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
      addDailyNotif({ type: "forward_approved", icon: "✅", text: `${currentUser.name} approved forward of ${request.ticketId} to ${request.toAgent.name}`, ticketId: request.ticketId, by: currentUser.name });
      // Send inbox response back to requester
      try {
        const requesterId = users.find(u => u.name === request.fromUser)?.id;
        if (requesterId) {
          await axios.post(NOTIFICATIONS_API, {
            userId: requesterId, type: "forward_response", read: false, alerted: false,
            title: `Forward Request Approved: ${request.ticketId}`,
            message: `${currentUser.name} approved your request to forward ${request.ticketId} to ${request.toAgent.name}.`,
            ticketId: request.ticketId, from: currentUser.name, status: "Approved", createdAt: nowISO
          });
        }
        // Also notify assigned agent
        await axios.post(NOTIFICATIONS_API, {
          userId: request.toAgent.id, type: "ticket_assigned", read: false, alerted: false,
          title: `Ticket Assigned: ${request.ticketId}`,
          message: `${request.fromUser}'s forward request was approved. Ticket ${request.ticketId} is now assigned to you.`,
          ticketId: request.ticketId, from: currentUser.name, createdAt: nowISO
        });
      } catch { }
    } catch (e) {
      setCustomAlert({ show: true, message: "Failed to approve forward", type: "error" });
    }
  };

  // ✅ Admin rejects forward request
  const rejectForwardRequest = async (request) => {
    const nowISO = new Date().toISOString();
    setForwardRequests(prev => prev.map(r =>
      r.id === request.id
        ? { ...r, status: "Rejected", approvedBy: currentUser.name, approvedAt: nowISO }
        : r
    ));
    setCustomAlert({ show: true, message: "Forward request rejected", type: "success" });
    addDailyNotif({ type: "forward_rejected", icon: "❌", text: `${currentUser.name} rejected forward of ${request.ticketId}`, ticketId: request.ticketId, by: currentUser.name });
    // Send inbox response back to requester
    try {
      const requesterId = users.find(u => u.name === request.fromUser)?.id;
      if (requesterId) {
        await axios.post(NOTIFICATIONS_API, {
          userId: requesterId, type: "forward_response", read: false, alerted: false,
          title: `Forward Request Rejected: ${request.ticketId}`,
          message: `${currentUser.name} rejected your request to forward ${request.ticketId} to ${request.toAgent.name}.`,
          ticketId: request.ticketId, from: currentUser.name, status: "Rejected", createdAt: nowISO
        });
      }
    } catch { }
  };

  const handleSendForRepair = async (vendorName, contactInfo) => {
    if (!vendorName) { setCustomAlert({ show: true, message: "⚠️ Vendor name is required", type: "error" }); return; }
    if (!fwdReason.trim()) { setCustomAlert({ show: true, message: "⚠️ Reason is required", type: "error" }); return; }
    const t = selTicket;
    try {
      const nowISO = new Date().toISOString();
      const update = { ...t, status: "Pending", updated: nowISO, timeline: [...(t.timeline || []), { action: `Sent for Repair: ${vendorName}`, by: currentUser.name, date: nowISO, note: `Contact: ${contactInfo}\nReason: ${fwdReason}`, visibility: "internal" }] };
      await axios.put(`${TICKETS_API}/${t.id}`, update);
      setTickets(p => p.map(x => x.id === t.id ? { ...update, updated: new Date(nowISO) } : x));
      setSelTicket({ ...update, updated: new Date(nowISO) });
    } catch (e) { setCustomAlert({ show: true, message: "Repair update failed", type: "error" }); }
  };

  const handleForward = () => {
    if (fwdType === "Agent") handleForwardToAgent(fwdTargetAgent);
    else handleSendForRepair(fwdVendorName, fwdVendorEmail);
  };

  // ─── SETTINGS HANDLERS (v1 API) ────────────────────────────────────────────
  const addOrg = async () => {
    if (!newOrg.name) return;
    if (orgs.some(o => o.name.trim().toLowerCase() === newOrg.name.trim().toLowerCase())) {
      setCustomAlert({ show: true, message: `⚠️ Organisation "${newOrg.name.trim()}" already exists`, type: "error" });
      return;
    }
    try {
      const res = await axios.post(ORGS_API, newOrg);
      const created = res.data; // ✅ Extract the actual data
      setOrgs([...orgs, created]);
      setNewOrg({ name: "", domain: "", phone: "" });
      addDailyNotif({ type: "org_added", icon: "🏢", text: `${currentUser.name} added organisation "${created.name}"`, by: currentUser.name });
    } catch (err) { setCustomAlert({ show: true, message: "Failed to add organisation", type: "error" }); }
  };

  const addCat = async () => {
    if (!newCat.name) return;
    if (categories.some(c => c.name.trim().toLowerCase() === newCat.name.trim().toLowerCase())) {
      setCustomAlert({ show: true, message: `⚠️ Category "${newCat.name.trim()}" already exists`, type: "error" });
      return;
    }
    try {
      const res = await axios.post(CATEGORIES_API, newCat);
      const created = res.data; // ✅ Extract the actual data
      setCategories([...categories, created]);
      setNewCat({ name: "", color: "#3b82f6" });
      addDailyNotif({ type: "category_added", icon: "🏷", text: `${currentUser.name} added category "${created.name}"`, by: currentUser.name });
    } catch (err) { setCustomAlert({ show: true, message: "Failed to add category", type: "error" }); }
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
    if (users.some(u => u.email.trim().toLowerCase() === newUser.email.trim().toLowerCase())) {
      setCustomAlert({ show: true, message: `⚠️ A user with email "${newUser.email.trim()}" already exists`, type: "error" });
      return;
    }
    try {
      // Admin is setting the password for the user
      const response = await axios.post(USERS_API, {
        ...newUser,
        active: true,
        status: "Off Duty"
      });

      const created = response.data;
      setUsers([...users, created]);

      // ✅ Custom success alert instead of system alert
      setCustomAlert({ show: true, message: `User "${created.name}" created successfully with temporary password`, type: "success" });
      addDailyNotif({ type: "user_added", icon: "👤", text: `${currentUser.name} added user "${created.name}" (${created.role})`, by: currentUser.name });

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
      confirmLabel: "Change Password",
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
      confirmLabel: "Delete", confirmDanger: true,
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
      confirmLabel: "Delete", confirmDanger: true,
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
    if (!["Admin", "Manager"].includes(currentUser?.role)) {
      setCustomAlert({ show: true, message: "You don't have permission to delete users.", type: "error" });
      return;
    }
    setConfirmModal({
      show: true,
      title: `Delete ${user?.name}?`,
      confirmLabel: "Delete", confirmDanger: true,
      message: `Delete ${user?.name}? Tickets unassigned. All personal data removed. Cannot undo.`,
      onConfirm: async () => {
        try {
          // ✅ 1. Unassign all tickets
          const ticketsToUpdate = tickets.filter(t => t.assignees?.some(a => a.id === id));
          for (const ticket of ticketsToUpdate) {
            const updatedAssignees = (ticket.assignees || []).filter(a => a.id !== id);
            await axios.put(`${TICKETS_API}/${ticket.id}`, { ...ticket, assignees: updatedAssignees });
          }

          // ✅ 2. Delete personal notifications
          try {
            const personalNotifs = await axios.get(`${NOTIFICATIONS_API}?userId=${id}`);
            for (const notif of personalNotifs.data || []) {
              await axios.delete(`${NOTIFICATIONS_API}/${notif.id}`).catch(() => { });
            }
          } catch (e) { }

          // ✅ 3. Delete user
          await axios.delete(`${USERS_API}/${id}`);

          // Update local state
          setUsers(prev => prev.filter(u => u.id !== id));
          setTickets(tickets.map(t =>
            ticketsToUpdate.some(tu => tu.id === t.id)
              ? { ...t, assignees: (t.assignees || []).filter(a => a.id !== id) }
              : t
          ));

          setCustomAlert({ show: true, message: `✅ ${user?.name} deleted. ${ticketsToUpdate.length} ticket(s) unassigned.`, type: "success" });
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
      setCustomAlert({ show: true, message: "⚠️ Name is required", type: "error" });
      return;
    }
    if (editUserForm.password && editUserForm.password.length < 6) {
      setCustomAlert({ show: true, message: "⚠️ Password must be at least 6 characters", type: "error" });
      return;
    }
    // Guard: only Admin/Manager can edit users
    if (!["Admin", "Manager"].includes(currentUser?.role)) {
      setCustomAlert({ show: true, message: "You don't have permission to edit users.", type: "error" });
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

      setCustomAlert({ show: true, message: `✅ ${editUserForm.name}'s profile has been updated`, type: "success" });
      setEditUserOpen(null);
      setEditUserForm({ name: "", email: "", password: "" });
    } catch (err) {
      console.error("Error editing user:", err);
      setCustomAlert({ show: true, message: "Failed to update user", type: "error" });
    }
  };

  const addAttr = async () => {
    if (!newAttr.name) return;
    try {
      const payload = {
        ...newAttr,
        options: typeof newAttr.options === "string"
          ? newAttr.options.split(",").map(s => s.trim()).filter(Boolean)
          : [],
        section: newAttr.section || "grid",
        sortOrder: customAttrs.length
      };
      const response = await axios.post(CUSTOM_ATTRS_API, payload);
      const created = response.data;
      const updated = [...customAttrs, created];
      setCustomAttrs(updated);
      setNewAttr({ name: "", type: "text", options: "", required: false, section: "grid", sortOrder: 0 });
      // Open layout modal with a draft copy
      setLayoutDraft(updated.map((a, i) => ({ ...a, sortOrder: a.sortOrder ?? i })));
      setShowAttrLayoutModal(true);
    } catch (err) {
      console.error("Error adding attribute:", err);
      setCustomAlert({ show: true, message: "Failed to add attribute", type: "error" });
    }
  };

  const saveLayoutDraft = async () => {
    // Assign sortOrders based on current draft order and persist
    const withOrders = layoutDraft.map((a, i) => ({ ...a, sortOrder: i }));
    try {
      await Promise.all(withOrders.map(a => axios.put(`${CUSTOM_ATTRS_API}/${a.id}`, a)));
      setCustomAttrs(withOrders);
      setShowAttrLayoutModal(false);
      setCustomAlert({ show: true, message: "✅ Field layout saved!", type: "success" });
    } catch (err) {
      console.error("Error saving layout:", err);
      setCustomAlert({ show: true, message: "Failed to save layout", type: "error" });
    }
  };

  // Update a custom attr's section/sortOrder (layout designer)
  const updateAttrLayout = async (id, changes) => {
    try {
      const attr = customAttrs.find(a => a.id === id);
      if (!attr) return;
      const updated = { ...attr, ...changes };
      await axios.put(`${CUSTOM_ATTRS_API}/${id}`, updated);
      setCustomAttrs(customAttrs.map(a => a.id === id ? updated : a));
    } catch (err) {
      console.error("Error updating attribute layout:", err);
      setCustomAlert({ show: true, message: "Failed to update field layout", type: "error" });
    }
  };

  // Reorder attrs by dragging (persists all sortOrders)
  const reorderAttrs = async (fromIdx, toIdx) => {
    const arr = [...customAttrs].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const moved = arr.splice(fromIdx, 1)[0];
    arr.splice(toIdx, 0, moved);
    const updated = arr.map((a, i) => ({ ...a, sortOrder: i }));
    setCustomAttrs(updated);
    try {
      await Promise.all(updated.map(a => axios.put(`${CUSTOM_ATTRS_API}/${a.id}`, a)));
    } catch (err) {
      console.error("Error reordering attributes:", err);
    }
  };

  // ✅ NEW: Delete Custom Attribute
  const deleteAttr = async (id) => {
    setConfirmModal({
      show: true, title: "Delete Attribute",
      confirmLabel: "Delete", confirmDanger: true, message: "Are you sure you want to delete this custom attribute? This cannot be undone.",
      onConfirm: async () => {
        try {
          await axios.delete(`${CUSTOM_ATTRS_API}/${id}`);
          setCustomAttrs(customAttrs.filter(a => a.id !== id));
          setCustomAlert({ show: true, message: "✅ Attribute deleted!", type: "success" });
        } catch (err) {
          console.error("Error deleting attribute:", err);
          setCustomAlert({ show: true, message: "Failed to delete attribute", type: "error" });
        }
        setConfirmModal({ show: false, title: "", message: "", onConfirm: null, onCancel: null });
      },
      onCancel: () => setConfirmModal({ show: false, title: "", message: "", onConfirm: null, onCancel: null })
    });
  };

  // ─── PROJECT HANDLERS (v1 API) ────────────────────────────────────────────
  const handleProjectSubmit = async () => {
    if (!projForm.title || !projForm.org) return setCustomAlert({ show: true, message: "Organisation and Title are required", type: "error" });

    // ✅ NEW: Validate webcast fields if category is Webcast
    if (projForm.category === "Webcast") {
      if (!projForm.satsangType || !projForm.location) {
        return setCustomAlert({ show: true, message: "Satsang Type and Location are required for Webcast", type: "error" });
      }
    }

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

    // ✅ NEW: If webcast, create separate entry and send to /api/webcasts
    if (projForm.category === "Webcast") {
      try {
        // Generate unique webcast ID
        const webcastData = {
          // id intentionally omitted — server will generate WEB-XXXX
          title: projForm.title,
          description: projForm.description,
          satsangType: projForm.satsangType,
          location: projForm.location,
          reportedBy: projForm.reportedBy,
          org: projForm.org,
          department: projForm.department,
          priority: projForm.priority,
          assignees: projForm.assignees,
          category: projForm.category,
          dueDate: projForm.dueDate || null,
          status: projForm.status || "Open",
          progress: projForm.progress || 0,
          comments: [],
          timeline: [{ action: "Created", by: currentUser.name, date: new Date().toISOString(), note: "Webcast created." }]
        };

        const webcastRes = await axios.post(`${BASE_URL}/webcasts`, webcastData);
        const createdWebcast = webcastRes.data;
        const webcastWithDates = { ...createdWebcast, created: new Date(createdWebcast.createdAt || createdWebcast.created), updated: new Date(createdWebcast.updatedAt || createdWebcast.updated) };

        setProjects(prev => [webcastWithDates, ...prev]);
        setSelProject(webcastWithDates);
        setShowNewProject(false);
        setProjForm(emptyProjectForm);
        setCustomAlert({ show: true, message: "✅ Webcast project created successfully!", type: "success" });
        addDailyNotif({ type: "webcast_created", icon: "📡", text: `${currentUser.name} created webcast project ${createdWebcast.id}`, ticketId: createdWebcast.id, by: currentUser.name });
        return;
      } catch (e) {
        setCustomAlert({ show: true, message: "Failed to create webcast: " + (e.response?.data?.error || e.message), type: "error" });
      }
      return;
    }

    // ✅ Regular project creation
    try {
      const res = await axios.post(PROJECTS_API, newP);
      const created = res.data;
      const projectWithDates = { ...created, created: new Date(created.createdAt || created.created), updated: new Date(created.updatedAt || created.updated), dueDate: created.dueDate ? new Date(created.dueDate) : null };
      setProjects(prev => [projectWithDates, ...prev]);
      setSelProject(projectWithDates);  // ✅ Auto-open project details
      setShowNewProject(false);
      setProjForm(emptyProjectForm);
      setCustomAlert({ show: true, message: "✅ Project created successfully!", type: "success" });
      addDailyNotif({ type: "project_created", icon: "📁", text: `${currentUser.name} created project "${projectWithDates.title || projectWithDates.id}"`, by: currentUser.name });
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
    } catch (e) { setCustomAlert({ show: true, message: "Failed to update project status", type: "error" }); }
  };

  const deleteProject = async (id) => {
    setConfirmModal({
      show: true, title: "Delete Project",
      confirmLabel: "Delete", confirmDanger: true, message: "Are you sure you want to delete this project? This cannot be undone.",
      onConfirm: async () => {
        try {
          await axios.delete(`${PROJECTS_API}/${id}`);
          setProjects(prev => prev.filter(p => p.id !== id));
          setSelProject(null);
          setCustomAlert({ show: true, message: "✅ Project deleted!", type: "success" });
        } catch (e) {
          setCustomAlert({ show: true, message: "Failed to delete project: " + (e.response?.data?.error || e.message), type: "error" });
        }
        setConfirmModal({ show: false, title: "", message: "", onConfirm: null, onCancel: null });
      },
      onCancel: () => setConfirmModal({ show: false, title: "", message: "", onConfirm: null, onCancel: null })
    });
  };

  // ✅ NEW: Department management functions
  const addDept = async () => {
    if (!newDept?.name?.trim()) {
      setCustomAlert({ show: true, message: "Department name required", type: "error" });
      return;
    }
    if (!newDept?.orgName?.trim()) {
      setCustomAlert({ show: true, message: "Please select an organisation for this department", type: "error" });
      return;
    }
    if (departments.some(d => d.name.trim().toLowerCase() === newDept.name.trim().toLowerCase() && d.orgName === newDept.orgName.trim())) {
      setCustomAlert({ show: true, message: `⚠️ Department "${newDept.name.trim()}" already exists under ${newDept.orgName.trim()}`, type: "error" });
      return;
    }
    try {
      const dept = await axios.post(`${BASE_URL}/departments`, { name: newDept.name.trim(), orgName: newDept.orgName.trim() });
      setDepartments([...departments, dept.data]);
      setNewDept({ name: "", orgName: "" });
      setCustomAlert({ show: true, message: "✅ Department added!", type: "success" });
      addDailyNotif({ type: "dept_added", icon: "🏛", text: `${currentUser.name} added department "${dept.data.name}" under ${dept.data.orgName}`, by: currentUser.name });
    } catch (e) {
      setCustomAlert({ show: true, message: "Failed to add department", type: "error" });
    }
  };

  const deleteDept = async (id) => {
    setConfirmModal({
      show: true, title: "Delete Department",
      confirmLabel: "Delete", confirmDanger: true, message: "Are you sure you want to delete this department?",
      onConfirm: async () => {
        try {
          await axios.delete(`${BASE_URL}/departments/${id}`);
          setDepartments(departments.filter(d => d.id !== id));
          setCustomAlert({ show: true, message: "✅ Department deleted!", type: "success" });
        } catch (e) {
          setCustomAlert({ show: true, message: "Failed to delete department", type: "error" });
        }
        setConfirmModal({ show: false, title: "", message: "", onConfirm: null, onCancel: null });
      },
      onCancel: () => setConfirmModal({ show: false, title: "", message: "", onConfirm: null, onCancel: null })
    });
  };

  // ── LOCATION MANAGEMENT ──
  const addLocation = async () => {
    if (!newLocation?.name?.trim()) {
      setCustomAlert({ show: true, message: "Location name required", type: "error" });
      return;
    }
    if (locations.some(l => l.name.trim().toLowerCase() === newLocation.name.trim().toLowerCase())) {
      setCustomAlert({ show: true, message: `⚠️ Location "${newLocation.name.trim()}" already exists`, type: "error" });
      return;
    }
    try {
      const loc = await axios.post(LOCATIONS_API, newLocation);
      setLocations([...locations, loc.data]);
      setNewLocation({ name: "" });
      setCustomAlert({ show: true, message: "✅ Location added!", type: "success" });
      addDailyNotif({ type: "location_added", icon: "📍", text: `${currentUser.name} added location "${loc.data.name}"`, by: currentUser.name });
    } catch (e) {
      setCustomAlert({ show: true, message: "Failed to add location", type: "error" });
    }
  };

  const deleteLocation = async (id) => {
    setConfirmModal({
      show: true, title: "Delete Location",
      confirmLabel: "Delete", confirmDanger: true, message: "Are you sure you want to delete this location?",
      onConfirm: async () => {
        try {
          await axios.delete(`${LOCATIONS_API}/${id}`);
          setLocations(locations.filter(l => l.id !== id));
          setCustomAlert({ show: true, message: "✅ Location deleted!", type: "success" });
        } catch (e) {
          setCustomAlert({ show: true, message: "Failed to delete location", type: "error" });
        }
        setConfirmModal({ show: false, title: "", message: "", onConfirm: null, onCancel: null });
      },
      onCancel: () => setConfirmModal({ show: false, title: "", message: "", onConfirm: null, onCancel: null })
    });
  };

  // ✅ NEW: Satsang Type Management Functions
  const addSatsangType = async () => {
    if (!newSatsangType?.trim()) {
      setCustomAlert({ show: true, message: "Satsang type name required", type: "error" });
      return;
    }
    if (satsangTypes.some(t => t.toLowerCase() === newSatsangType.trim().toLowerCase())) {
      setCustomAlert({ show: true, message: `⚠️ Satsang type "${newSatsangType.trim()}" already exists`, type: "error" });
      return;
    }
    try {
      const res = await axios.post(`${BASE_URL}/satsang-types`, { name: newSatsangType.trim() });
      setSatsangTypes([...satsangTypes, res.data.name]);
      setNewSatsangType("");
      setCustomAlert({ show: true, message: "✅ Satsang type added!", type: "success" });
      addDailyNotif({ type: "satsang_type_added", icon: "📡", text: `${currentUser.name} added satsang type "${res.data.name}"`, by: currentUser.name });
    } catch (e) {
      setCustomAlert({ show: true, message: "Failed to add satsang type", type: "error" });
    }
  };

  const deleteSatsangType = async (typeName) => {
    setConfirmModal({
      show: true, title: "Delete Satsang Type",
      confirmLabel: "Delete", confirmDanger: true, message: `Are you sure you want to delete "${typeName}"?`,
      onConfirm: async () => {
        try {
          const typeToDelete = satsangTypes.find(t => t === typeName);
          if (!typeToDelete) {
            setCustomAlert({ show: true, message: "Satsang type not found", type: "error" });
            setConfirmModal({ show: false, title: "", message: "", onConfirm: null, onCancel: null });
            return;
          }
          // Delete by finding the database entry and deleting it
          const allTypes = await axios.get(`${BASE_URL}/satsang-types`);
          const typeRecord = allTypes.data.find(t => t.name === typeName);
          if (typeRecord) {
            await axios.delete(`${BASE_URL}/satsang-types/${typeRecord.id}`);
          }
          setSatsangTypes(satsangTypes.filter(t => t !== typeName));
          setCustomAlert({ show: true, message: "✅ Satsang type deleted!", type: "success" });
        } catch (e) {
          setCustomAlert({ show: true, message: "Failed to delete satsang type", type: "error" });
        }
        setConfirmModal({ show: false, title: "", message: "", onConfirm: null, onCancel: null });
      },
      onCancel: () => setConfirmModal({ show: false, title: "", message: "", onConfirm: null, onCancel: null })
    });
  };

  // ✅ NEW: Vendor Management Functions
  const addVendor = async () => {
    if (!newVendor?.name?.trim()) {
      setCustomAlert({ show: true, message: "Vendor name required", type: "error" });
      return;
    }
    if (vendors.some(v => v.name.trim().toLowerCase() === newVendor.name.trim().toLowerCase())) {
      setCustomAlert({ show: true, message: `⚠️ Vendor "${newVendor.name.trim()}" already exists`, type: "error" });
      return;
    }
    try {
      const vend = await axios.post(VENDORS_API, newVendor);
      setVendors([...vendors, vend.data]);
      setNewVendor({ name: "", email: "", phone: "", address: "" });
      setCustomAlert({ show: true, message: "✅ Vendor added!", type: "success" });
      addDailyNotif({ type: "vendor_added", icon: "🏭", text: `${currentUser.name} added vendor "${vend.data.name}"`, by: currentUser.name });
    } catch (e) {
      setCustomAlert({ show: true, message: "Failed to add vendor", type: "error" });
    }
  };

  const deleteVendor = async (id) => {
    setConfirmModal({
      show: true, title: "Delete Vendor",
      confirmLabel: "Delete", confirmDanger: true, message: "Are you sure you want to delete this vendor?",
      onConfirm: async () => {
        try {
          await axios.delete(`${VENDORS_API}/${id}`);
          setVendors(vendors.filter(v => v.id !== id));
          setCustomAlert({ show: true, message: "✅ Vendor deleted!", type: "success" });
        } catch (e) {
          setCustomAlert({ show: true, message: "Failed to delete vendor", type: "error" });
        }
        setConfirmModal({ show: false, title: "", message: "", onConfirm: null, onCancel: null });
      },
      onCancel: () => setConfirmModal({ show: false, title: "", message: "", onConfirm: null, onCancel: null })
    });
  };

  const toggleProjSel = id => { const s = new Set(selectedProjIds); s.has(id) ? s.delete(id) : s.add(id); setSelectedProjIds(s); };
  const toggleAllProj = () => selectedProjIds.size === filteredProjects.length && filteredProjects.length > 0 ? setSelectedProjIds(new Set()) : setSelectedProjIds(new Set(filteredProjects.map(p => p.id)));
  const selProjects = filteredProjects.filter(p => selectedProjIds.has(p.id));
  const addTicketCat = async () => {
    if (!newTicketCat.name) return;
    if (ticketCategories.some(c => c.name.trim().toLowerCase() === newTicketCat.name.trim().toLowerCase())) {
      setCustomAlert({ show: true, message: `⚠️ Category "${newTicketCat.name.trim()}" already exists`, type: "error" });
      return;
    }
    try {
      const res = await axios.post(CATEGORIES_API, newTicketCat);
      const created = res.data;
      setTicketCategories(prev => [...prev, created]);
      setCategories(prev => [...prev, created]);
      setNewTicketCat({ name: "", color: "#3b82f6" });
    } catch (e) { setCustomAlert({ show: true, message: "Failed to add category", type: "error" }); }
  };
  const addProjCat = async () => {
    if (!newProjCat.name) return;
    if (projectCategories.some(c => c.name.trim().toLowerCase() === newProjCat.name.trim().toLowerCase())) {
      setCustomAlert({ show: true, message: `⚠️ Category "${newProjCat.name.trim()}" already exists`, type: "error" });
      return;
    }
    try {
      const res = await axios.post(CATEGORIES_API, newProjCat);
      const created = res.data;
      setProjectCategories(prev => [...prev, created]);
      setCategories(prev => [...prev, created]);
      setNewProjCat({ name: "", color: "#8b5cf6" });
    } catch (e) { setCustomAlert({ show: true, message: "Failed to add project category", type: "error" }); }
  };
  const addTicketAttr = async () => {
    if (!newTicketAttr.name) return;
    if (ticketCustomAttrs.some(a => a.name.trim().toLowerCase() === newTicketAttr.name.trim().toLowerCase())) {
      setCustomAlert({ show: true, message: `⚠️ Attribute "${newTicketAttr.name.trim()}" already exists`, type: "error" });
      return;
    }
    try {
      const payload = { ...newTicketAttr, options: typeof newTicketAttr.options === "string" ? newTicketAttr.options.split(",").map(s => s.trim()).filter(Boolean) : [] };
      const res = await axios.post(CUSTOM_ATTRS_API, payload);
      const created = res.data;
      setTicketCustomAttrs(prev => [...prev, created]);
      setCustomAttrs(prev => [...prev, created]);
      setNewTicketAttr({ name: "", type: "text", options: "", required: false });
    } catch (e) { setCustomAlert({ show: true, message: "Failed to add attribute", type: "error" }); }
  };
  const addProjAttr = async () => {
    if (!newProjAttr.name) return;
    if (projectCustomAttrs.some(a => a.name.trim().toLowerCase() === newProjAttr.name.trim().toLowerCase())) {
      setCustomAlert({ show: true, message: `⚠️ Attribute "${newProjAttr.name.trim()}" already exists`, type: "error" });
      return;
    }
    try {
      const payload = { ...newProjAttr, options: typeof newProjAttr.options === "string" ? newProjAttr.options.split(",").map(s => s.trim()).filter(Boolean) : [] };
      const res = await axios.post(CUSTOM_ATTRS_API, payload);
      const created = res.data;
      setProjectCustomAttrs(prev => [...prev, created]);
      setCustomAttrs(prev => [...prev, created]);
      setNewProjAttr({ name: "", type: "text", options: "", required: false });
    } catch (e) { setCustomAlert({ show: true, message: "Failed to add project attribute", type: "error" }); }
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

      // 3. Set status to On Duty immediately on login
      const onDutyUser = {
        ...u,
        status: "On Duty",
        currentTicketId: null,
        currentLocation: null,
        lunchStatus: false,
      };
      try {
        await axios.put(`${USERS_API}/${u.id}`, onDutyUser);
      } catch (e) { console.error("Failed to set On Duty on login"); }

      // 4. Cache in session and local state
      saveSession(onDutyUser);
      setCurrentUser(onDutyUser);

      // 5. Show welcome popup with On Duty status
      setCustomAlert({
        show: true,
        message: `✅ Welcome ${u.name}! You are now On Duty`,
        type: "success"
      });

      // 6. Reload all data
      await loadData();

    } catch (err) {
      console.error("Login error:", err);
      setAuthError(err.response?.data?.error || err.message);
    }
  };

  const handleLogout = async () => {
    try {
      // Check logout requirements via server
      const checkRes = await axios.post(`${BASE_URL}/check-logout-requirements`, {
        userId: currentUser.id
      });

      const { canLogout, requiresReason, currentStatus } = checkRes.data;

      // ✅ ENHANCED: Off Duty status goes straight to logout
      // User is already Off Duty, no need for dialog
      if (currentStatus === "Off Duty") {
        clearSession();
        setCurrentUser(null);
        setProfileOpen(false);
        return;
      }

      // ✅ ENHANCED: Show comprehensive logout form with conditional fields
      // - Always show: Location
      // - On Lunch: Show "On Lunch" status confirmation (no reason needed)
      // - On Ticket/On Duty: Show reason dropdown + ticket dropdown
      // - Idle: Show reason dropdown + location field

      const fields = [];

      // ✅ If On Lunch Break: Show simple confirmation, no reason needed
      if (currentStatus === "On Lunch") {
        // User on lunch just needs to mark Off Duty when logging out
        fields.push({
          name: "lunchConfirm",
          label: "📝 Note",
          type: "readonly",
          value: "You're currently on lunch. Logging out will mark you as Off Duty.",
          required: false
        });
      } else {
        // ✅ Always add reason for logout when not on lunch
        fields.push({
          name: "logoutReason",
          label: "📝 Reason for logout",
          type: "select",
          options: [
            { value: "End of shift", label: "End of shift" },
            { value: "Going for ticket", label: "Going for ticket" },
            { value: "Going for lunch", label: "Going for lunch" }
          ],
          value: "",
          required: true
        });

        // ✅ Add location field (will be conditionally shown only when reason is "Going for ticket")
        fields.push({
          name: "location",
          label: "📍 Location",
          type: "select",
          options: locations.map(loc => ({ value: loc.name, label: loc.name })),
          value: currentUser?.currentLocation || "",
          required: false
        });
      }

      setConfirmModal({
        show: true,
        title: currentStatus === "On Lunch" ? "Logout from Lunch Break" : "Set Status to Off Duty",
        confirmLabel: "Mark Off Duty & Logout",
        message: `Current status: ${currentStatus}. Mark yourself as Off Duty and logout.`,
        fields: fields,
        onConfirm: async (data) => {
          try {
            // ✅ Validation: Reason required only when NOT on lunch
            if (currentStatus !== "On Lunch" && (!data.logoutReason || data.logoutReason.trim() === "")) {
              setCustomAlert({ show: true, message: "Please provide a reason for logout", type: "error" });
              return;
            }

            // ✅ Validation: Location only required when reason is "Going for ticket"
            if (data.logoutReason === "Going for ticket" && (!data.location || data.location.trim() === "")) {
              setCustomAlert({ show: true, message: "Please select your location for ticket", type: "error" });
              return;
            }

            // Build update object
            const up = {
              ...currentUser,
              status: "Off Duty",
              currentLocation: data.location ? data.location : currentUser.currentLocation,
              currentTicketId: null,
              lunchStatus: false
            };

            // ✅ Only add logoutReason if not on lunch
            if (currentStatus !== "On Lunch") {
              up.logoutReason = data.logoutReason;
            }

            // Send to server
            const res = await axios.put(`${USERS_API}/${currentUser.id}`, up);

            if (res.status === 200 || res.status === 201) {
              // ✅ Successfully updated to Off Duty - now logout
              clearSession();
              setCurrentUser(null);
              setProfileOpen(false);
              setConfirmModal({ show: false });
              setCustomAlert({ show: true, message: "Logged out successfully", type: "success" });
            }
          } catch (err) {
            if (err.response?.status === 400) {
              setCustomAlert({
                show: true,
                message: err.response.data.reason || "Cannot change status: " + err.response.data.error,
                type: "error"
              });
            } else {
              setCustomAlert({ show: true, message: "Failed to update status", type: "error" });
            }
          }
        },
        onCancel: () => setConfirmModal({ show: false })
      });

    } catch (err) {
      console.error("Logout check failed:", err);
      setCustomAlert({ show: true, message: "Logout error: " + (err.response?.data?.error || err.message), type: "error" });
    }
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
        role: isFirstUser ? "Admin" : "Viewer",
        active: true,
        status: "Off Duty",
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
    } catch (err) { setCustomAlert({ show: true, message: "Failed to save profile", type: "error" }); }
  };
  const updateStatusDirect = async (st) => {
    try {
      const up = { ...currentUser, status: st };
      await axios.put(`${USERS_API}/${currentUser.id}`, up);
      saveSession(up); setCurrentUser(up); setUsers(users.map(u => u.id === currentUser.id ? up : u));
    } catch (err) { setCustomAlert({ show: true, message: "Failed to update status", type: "error" }); }
  };

  // ✅ NEW: Handle lunch break toggle
  const handleLunchBreak = async () => {
    try {
      const isCurrentlyOnLunch = currentUser.status === "On Lunch";
      const newStatus = isCurrentlyOnLunch ? "On Duty" : "On Lunch";

      const up = {
        ...currentUser,
        status: newStatus,
        // ✅ If going to lunch, clear ticket and location tracking
        // If returning from lunch, restore to On Duty
        currentTicketId: isCurrentlyOnLunch ? currentUser.currentTicketId : null,
        currentLocation: isCurrentlyOnLunch ? currentUser.currentLocation : null
      };

      await axios.put(`${USERS_API}/${currentUser.id}`, up);
      saveSession(up);
      setCurrentUser(up);
      setUsers(users.map(u => u.id === currentUser.id ? up : u));

      const msg = newStatus === "On Lunch"
        ? "🍽️ You're now on lunch break"
        : "👤 You're back to on duty";
      setCustomAlert({ show: true, message: msg, type: "success" });
    } catch (err) {
      setCustomAlert({ show: true, message: "Failed to update status", type: "error" });
    }
  };

  // ✅ NEW: Log activity to session history
  const logActivity = async (action, details = {}) => {
    try {
      const activityLog = {
        userId: currentUser?.id,
        action: action, // "logout", "lunch_start", "lunch_end", "ticket_assigned", "location_updated"
        timestamp: new Date().toISOString(),
        details: {
          status: currentUser?.status,
          location: currentUser?.currentLocation,
          ticket: currentUser?.currentTicketId,
          ...details
        }
      };

      // Send to server for logging
      await axios.post(`${BASE_URL}/activity-logs`, activityLog);
      return activityLog;
    } catch (err) {
      console.error("Failed to log activity:", err);
      // Don't fail the entire operation if logging fails
    }
  };

  // ✅ NEW: Check idle status and flag user
  const checkAndMarkIdle = async () => {
    try {
      if (!currentUser) return;

      // User is idle if:
      // 1. Has assigned ticket
      // 2. Is logged in (On Duty / On Ticket)
      // 3. Location field is empty or not set

      const hasTicket = tickets.some(t =>
        t.assignees?.some(a => a.id === currentUser.id) &&
        (t.status === "Open" || t.status === "In Progress")
      );

      const isLoggedIn = currentUser.status === "On Duty" || currentUser.status === "On Ticket";
      const locationEmpty = !currentUser.currentLocation || currentUser.currentLocation.trim() === "";

      if (hasTicket && isLoggedIn && locationEmpty) {
        // Mark as Idle
        const up = {
          ...currentUser,
          status: "Idle",
          lastIdleCheck: new Date().toISOString()
        };

        await axios.put(`${USERS_API}/${currentUser.id}`, up);
        saveSession(up);
        setCurrentUser(up);
        setUsers(users.map(u => u.id === currentUser.id ? up : u));

        // Log the idle detection
        await logActivity("idle_detected", {
          reason: "Assigned ticket without location",
          ticketCount: tickets.filter(t => t.assignees?.some(a => a.id === currentUser.id)).length
        });
      }
    } catch (err) {
      console.error("Idle check error:", err);
    }
  };

  // ✅ NEW: Track session time
  const calculateSessionDuration = () => {
    if (!currentUser?.loginTime) return null;
    const loginTime = new Date(currentUser.loginTime);
    const now = new Date();
    const durationMs = now - loginTime;
    const durationMinutes = Math.floor(durationMs / 60000);
    const durationHours = Math.floor(durationMinutes / 60);

    if (durationHours > 0) {
      return `${durationHours}h ${durationMinutes % 60}m`;
    }
    return `${durationMinutes}m`;
  };

  // ✅ NEW: Update location and ticket tracking
  const updateTracking = async () => {
    try {
      const up = {
        ...currentUser,
        currentTicketId: currentTicketId || null,
        currentLocation: currentLocation || null
      };
      await axios.put(`${USERS_API}/${currentUser.id}`, up);
      saveSession(up);
      setCurrentUser(up);
      setUsers(users.map(u => u.id === currentUser.id ? up : u));
      setCustomAlert({ show: true, message: "✅ Location and ticket updated", type: "success" });
    } catch (err) {
      setCustomAlert({ show: true, message: "Failed to update tracking", type: "error" });
    }
  };

  // ✅ NEW: Check and update idle status automatically
  const checkAndUpdateIdleStatus = async () => {
    // ✅ DISABLED: Idle is now only set manually when user has no ticket assigned
    // No auto-detection - user must explicitly set their status
  };

  // ✅ REMOVED: Idle detection useEffect - no longer auto-detecting
  // Idle status is now only set when user manually updates status

  // ─── NAVIGATION HELPERS ────────────────────────────────────────────────────

  const markBellRead = () => {
    // DO NOT auto-mark as read when bell is opened
    // Only mark as read when user actually CLICKS on the notification
  };

  // ✅ NEW: Mark a specific notification as read AND navigate to the source
  const handleNotificationClick = async (notification) => {
    // Mark this specific notification as read
    seenActivityIds.current.add(notification.dbId);
    try {
      localStorage.setItem("seenActivityIds", JSON.stringify(Array.from(seenActivityIds.current)));
    } catch (e) {
      console.error("Failed to save seenActivityIds:", e);
    }

    // Update bell unread count
    const unseenCount = dailyNotifs.filter(b => !seenActivityIds.current.has(b.dbId)).length;
    setBellUnread(unseenCount);

    // Close bell panel
    setShowBellPanel(false);

    // Navigate based on notification type (broadcastType)
    const notificationType = notification.type;

    try {
      switch (notificationType) {
        // ── TICKET EVENTS ──
        case "ticket_created":
          // For new ticket created - go to All Tickets view
          setView("tickets");
          setTvFilter("all");
          setStatusF("All");
          setPriorityF("All");
          break;

        case "ticket_closed":
        case "ticket_status":
        case "ticket_edited":
        case "ticket_forwarded":
        case "forward_approved":
        case "forward_rejected":
          if (notification.ticketId) {
            // First try to find in dashboardData, then in all tickets
            let ticket = dashboardData.find(t => t.id === notification.ticketId);
            if (!ticket) {
              ticket = tickets.find(t => t.id === notification.ticketId);
            }
            if (ticket) {
              setSelTicket(ticket);
              setView("tickets");
            } else {
              setCustomAlert({ show: true, message: "Ticket not found", type: "error" });
            }
          }
          break;

        // ── PROJECT EVENTS ──
        case "project_created":
          setView("projects");
          break;

        // ── SETTINGS EVENTS (Department, Category, Organization, Location, Vendor, User) ──
        case "dept_added":
          setView("settings");
          setSettingsTab("departments");
          break;

        case "category_added":
          setView("settings");
          setSettingsTab("categories");
          break;

        case "org_added":
          setView("settings");
          setSettingsTab("organizations");
          break;

        case "location_added":
          setView("settings");
          setSettingsTab("locations");
          break;

        case "vendor_added":
          setView("settings");
          setSettingsTab("vendors");
          break;

        case "user_added":
          setView("settings");
          setSettingsTab("users");
          break;

        default:
          // Generic fallback - no popup, just silent
          break;
      }
    } catch (error) {
      console.error("Error navigating from notification:", error);
    }
  };

  const markInboxRead = async () => {
    setInboxUnread(0);
    const unread = inboxItems.filter(i => !i.read);
    setInboxItems(prev => prev.map(i => ({ ...i, read: true })));
    for (const item of unread) {
      try { await axios.put(`${NOTIFICATIONS_API}/${item.id}`, { ...item, read: true }); } catch { }
    }
  };

  // Accept a forward request from inbox (Admin/Manager action)
  const acceptInboxForwardRequest = async (item) => {
    try {
      const ticket = tickets.find(t => t.id === item.ticketId);
      if (!ticket) return;
      const agent = item.toAgent;
      const nowISO = new Date().toISOString();
      const update = {
        ...ticket, assignees: [agent], updated: nowISO,
        timeline: [...(ticket.timeline || []), {
          action: `✉️ Forwarded to Agent: ${agent.name}`,
          by: currentUser.name, date: nowISO,
          note: `Inbox approval. From: ${item.fromUser}. Reason: ${item.reason}`,
          visibility: "internal"
        }]
      };
      await axios.put(`${TICKETS_API}/${ticket.id}`, update);
      setTickets(p => p.map(x => x.id === ticket.id ? { ...update, updated: new Date(nowISO) } : x));
      await axios.put(`${NOTIFICATIONS_API}/${item.id}`, { ...item, read: true, alerted: true, resolved: "Approved" });
      setInboxItems(prev => prev.map(i => i.id === item.id ? { ...i, read: true, resolved: "Approved" } : i));
      addDailyNotif({ type: "forward_approved", icon: "✅", text: `${currentUser.name} approved forward of ${item.ticketId} to ${agent.name}`, ticketId: item.ticketId, by: currentUser.name });
      // Notify requester
      const requesterId = users.find(u => u.name === item.fromUser)?.id;
      if (requesterId) {
        await axios.post(NOTIFICATIONS_API, {
          userId: requesterId, type: "forward_response", read: false, alerted: false,
          title: `Forward Request Approved: ${item.ticketId}`,
          message: `${currentUser.name} approved your request to forward ${item.ticketId} to ${agent.name}.`,
          ticketId: item.ticketId, from: currentUser.name, status: "Approved", createdAt: nowISO
        });
      }
      // Notify assigned agent
      await axios.post(NOTIFICATIONS_API, {
        userId: agent.id, type: "ticket_assigned", read: false, alerted: false,
        title: `Ticket Assigned: ${item.ticketId}`,
        message: `${item.fromUser}'s forward request was approved. Ticket ${item.ticketId} is now assigned to you.`,
        ticketId: item.ticketId, from: currentUser.name, createdAt: nowISO
      });
      setCustomAlert({ show: true, message: "✅ Forward approved and ticket reassigned!", type: "success" });
    } catch (e) {
      setCustomAlert({ show: true, message: "Failed to approve forward", type: "error" });
    }
  };

  const rejectInboxForwardRequest = async (item) => {
    try {
      const nowISO = new Date().toISOString();
      await axios.put(`${NOTIFICATIONS_API}/${item.id}`, { ...item, read: true, alerted: true, resolved: "Rejected" });
      setInboxItems(prev => prev.map(i => i.id === item.id ? { ...i, read: true, resolved: "Rejected" } : i));
      addDailyNotif({ type: "forward_rejected", icon: "❌", text: `${currentUser.name} rejected forward of ${item.ticketId}`, ticketId: item.ticketId, by: currentUser.name });
      const requesterId = users.find(u => u.name === item.fromUser)?.id;
      if (requesterId) {
        await axios.post(NOTIFICATIONS_API, {
          userId: requesterId, type: "forward_response", read: false, alerted: false,
          title: `Forward Request Rejected: ${item.ticketId}`,
          message: `${currentUser.name} rejected your request to forward ${item.ticketId} to ${item.toAgent?.name}.`,
          ticketId: item.ticketId, from: currentUser.name, status: "Rejected", createdAt: nowISO
        });
      }
      setCustomAlert({ show: true, message: "Forward request rejected.", type: "success" });
    } catch {
      setCustomAlert({ show: true, message: "Failed to reject forward", type: "error" });
    }
  };

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
    { id: "satsangtypes", label: "Satsang Types", icon: "📡" },
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
    { id: "satsangtypes", label: "Satsang Types", icon: "📡" },
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
  const WebcastFields = ({ f, setF, isProject = false }) => {
    const satsangSearch = isProject ? projSatsangTypeSearch : satsangTypeSearch;
    const setSatsangSearch = isProject ? setProjSatsangTypeSearch : setSatsangTypeSearch;
    const showDD = isProject ? showProjSatsangTypeDD : showSatsangTypeDD;
    const setShowDD = isProject ? setShowProjSatsangTypeDD : setShowSatsangTypeDD;

    const locSearch = isProject ? projWebcastLocationSearch : webcastLocationSearch;
    const setLocSearch = isProject ? setProjWebcastLocationSearch : setWebcastLocationSearch;
    const showLocDD = isProject ? showProjWebcastLocationDD : showWebcastLocationDD;
    const setShowLocDD = isProject ? setShowProjWebcastLocationDD : setShowWebcastLocationDD;

    return (
      <div style={{ background: "#fff7ed", borderRadius: 9, border: "1px solid #fed7aa", padding: "12px 14px", marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#9a3412", marginBottom: 12 }}>📡 Webcast Details (Required)</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 14px" }}>
          <FF label="Satsang Type" required>
            <div style={{ position: "relative" }}>
              <input
                type="text"
                placeholder="Search satsang type..."
                value={satsangSearch || f.satsangType}
                onChange={e => setSatsangSearch(e.target.value)}
                onFocus={() => setShowDD(true)}
                onBlur={() => setTimeout(() => setShowDD(false), 200)}
                style={{ ...iS, width: "100%", fontSize: 12 }}
              />
              {showDD && (
                <div style={{ position: "absolute", top: "calc(100% + 3px)", left: 0, right: 0, background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 8, zIndex: 300, boxShadow: "0 4px 12px rgba(0,0,0,0.15)", maxHeight: 280, overflowY: "scroll", overflow: "visible" }}>
                  <div style={{ padding: 8, borderBottom: "1px solid #f1f5f9", position: "sticky", top: 0, background: "#fff", zIndex: 301 }}>
                    <input type="text" placeholder="Search types..." value={satsangSearch} onChange={e => setSatsangSearch(e.target.value)} onClick={e => e.stopPropagation()} style={{ ...iS, width: "100%", fontSize: 12 }} />
                  </div>
                  <div style={{ maxHeight: 220, overflowY: "auto" }}>
                    {satsangTypes.filter(t => satsangSearch === "" || t.toLowerCase().includes(satsangSearch.toLowerCase())).map(t => (
                      <div key={t} onClick={() => { setF({ ...f, satsangType: t }); setShowDD(false); setSatsangSearch(""); }} onMouseDown={e => e.preventDefault()} style={{ padding: "10px 12px", cursor: "pointer", borderBottom: "1px solid #f1f5f9", backgroundColor: f.satsangType === t ? "#eff6ff" : "transparent", transition: "background 0.15s" }}>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>{t}</div>
                      </div>
                    ))}
                    {satsangTypes.filter(t => satsangSearch === "" || t.toLowerCase().includes(satsangSearch.toLowerCase())).length === 0 && <div style={{ padding: "12px", textAlign: "center", fontSize: 12, color: "#94a3b8" }}>No satsang type found</div>}
                  </div>
                </div>
              )}
            </div>
          </FF>
          <FF label="Location / Venue" required>
            <div style={{ position: "relative" }}>
              <input
                type="text"
                placeholder="Search location..."
                value={locSearch || (f.location ? locations.find(l => l.name === f.location)?.name || "" : "")}
                onChange={e => setLocSearch(e.target.value)}
                onFocus={() => { setLocSearch(""); setShowLocDD(true); }}
                onBlur={() => setTimeout(() => setShowLocDD(false), 200)}
                style={{ ...iS, width: "100%", fontSize: 12 }}
              />
              {showLocDD && (
                <div style={{ position: "absolute", top: "calc(100% + 3px)", left: 0, right: 0, background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 8, zIndex: 300, boxShadow: "0 4px 12px rgba(0,0,0,0.15)", maxHeight: 280, overflowY: "scroll" }}>
                  <div style={{ padding: 8, borderBottom: "1px solid #f1f5f9", position: "sticky", top: 0, background: "#fff", zIndex: 301 }}>
                    <input type="text" placeholder="Search locations..." value={locSearch} onChange={e => setLocSearch(e.target.value)} onClick={e => e.stopPropagation()} style={{ ...iS, width: "100%", fontSize: 12 }} />
                  </div>
                  <div style={{ maxHeight: 220, overflowY: "auto" }}>
                    {locations.filter(l => locSearch === "" || l.name.toLowerCase().includes(locSearch.toLowerCase())).map(l => (
                      <div key={l.id} onClick={() => { setF({ ...f, location: l.name }); setShowLocDD(false); setLocSearch(""); }} onMouseDown={e => e.preventDefault()} style={{ padding: "10px 12px", cursor: "pointer", borderBottom: "1px solid #f1f5f9", backgroundColor: f.location === l.name ? "#eff6ff" : "transparent", transition: "background 0.15s" }}>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>{l.name}</div>
                      </div>
                    ))}
                    {locations.filter(l => locSearch === "" || l.name.toLowerCase().includes(locSearch.toLowerCase())).length === 0 && <div style={{ padding: "12px", textAlign: "center", fontSize: 12, color: "#94a3b8" }}>No locations found</div>}
                  </div>
                </div>
              )}
            </div>
          </FF>
        </div>
      </div>
    );
  };

  // ─── LOADING SCREEN ─────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans',sans-serif", background: "#f8fafc", color: "#64748b", fontSize: 18, fontWeight: 600 }}>
      Loading DeskFlow Data...
    </div>
  );

  // ─── AUTH SCREENS ──────────────────────────────────────────────────────────
  if (!currentUser) {
    const videoUrl = "https://www.artofliving.org/in-en/app/uploads/2023/06/Sunrise.webm"; // USER: Set your video URL here

    return (
      <div style={{ display: "flex", height: "100vh", fontFamily: "'Arial Hebrew', 'DM Sans', sans-serif", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
        {/* FULL SCREEN VIDEO BACKGROUND */}
        <video
          autoPlay
          muted
          loop
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            zIndex: 0
          }}
        >
          <source src={videoUrl} type="video/mp4" />
        </video>

        {/* DARK OVERLAY (Optional - for better text visibility) */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "rgba(0, 0, 0, 0.3)",
            zIndex: 1
          }}
        />

        {/* LOGIN/SIGNUP FORM ON TOP */}
        <div style={{ width: "100%", maxWidth: 420, position: "relative", transition: "transform 0.6s cubic-bezier(0.4,0,0.2,1)", transformStyle: "preserve-3d", transform: isLogin ? "rotateY(0deg)" : "rotateY(-180deg)", zIndex: 2 }}>

          {/* FRONT: LOGIN */}
          <div style={{ background: "rgba(255, 255, 255, 0.25)", backdropFilter: "blur(10px)", padding: 40, borderRadius: 20, boxShadow: "0 8px 32px rgba(0, 0, 0, 0.15)", backfaceVisibility: "hidden", position: isLogin ? "relative" : "absolute", top: 0, left: 0, width: "100%", border: "1px solid rgba(255, 255, 255, 0.4)", fontFamily: "'Arial Hebrew', sans-serif", color: "#000" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 30 }}>
              <div style={{ width: 44, height: 44, background: "linear-gradient(135deg,#3b82f6,#8b5cf6)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: "#fff" }}>⚡</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#000" }}>DeskFlow</div>
            </div>
            <div style={{ display: "flex", background: "rgba(255, 255, 255, 0.15)", borderRadius: 10, padding: 4, marginBottom: 24, border: "1px solid rgba(255, 255, 255, 0.2)" }}>
              <button onClick={() => { setIsLogin(true); setAuthError(""); setAuthMessage(""); }} style={{ flex: 1, padding: "8px", border: "none", borderRadius: 8, background: "#3b82f6", boxShadow: "0 2px 4px rgba(0,0,0,0.1)", cursor: "pointer", fontWeight: 600, color: "#fff", fontFamily: "'Arial Hebrew', sans-serif" }}>Login</button>
              <button onClick={() => { setIsLogin(false); setAuthError(""); setAuthMessage(""); }} style={{ flex: 1, padding: "8px", border: "none", borderRadius: 8, background: "transparent", cursor: "pointer", fontWeight: 600, color: "#000", fontFamily: "'Arial Hebrew', sans-serif" }}>Signup</button>
            </div>
            {authError && <div style={{ padding: "10px 14px", background: "rgba(239, 68, 68, 0.2)", color: "#000", borderRadius: 8, fontSize: 13, marginBottom: 16, fontWeight: 500, border: "1px solid rgba(239, 68, 68, 0.3)", fontFamily: "'Arial Hebrew', sans-serif" }}>{authError}</div>}
            {authMessage && <div style={{ padding: "10px 14px", background: "rgba(34, 197, 94, 0.2)", color: "#000", borderRadius: 8, fontSize: 13, marginBottom: 16, fontWeight: 500, border: "1px solid rgba(34, 197, 94, 0.3)", fontFamily: "'Arial Hebrew', sans-serif" }}>{authMessage}</div>}
            <form onSubmit={handleLogin}>
              <FF label="Email"><input type="email" required style={{ ...iS, background: "rgba(255, 255, 255, 0.1)", color: "#000", border: "1px solid rgba(255, 255, 255, 0.2)", fontFamily: "'Arial Hebrew', sans-serif" }} value={authForm.email} onChange={e => setAuthForm({ ...authForm, email: e.target.value })} placeholder="your@email.com" /></FF>
              <FF label="Password"><input type="password" required style={{ ...iS, background: "rgba(255, 255, 255, 0.1)", color: "#000", border: "1px solid rgba(255, 255, 255, 0.2)", fontFamily: "'Arial Hebrew', sans-serif" }} value={authForm.password} onChange={e => setAuthForm({ ...authForm, password: e.target.value })} placeholder="••••••••" /></FF>
              <button type="submit" style={{ ...bP, width: "100%", marginTop: 10, padding: 12, background: "linear-gradient(135deg,#3b82f6,#8b5cf6)", color: "#fff", border: "none", fontFamily: "'Arial Hebrew', sans-serif", fontWeight: 600 }}>Log In</button>
              <div style={{ marginTop: 16, textAlign: "center" }}><button type="button" onClick={() => { setIsLogin(false); setAuthError(""); setAuthMessage(""); }} style={{ ...bG, border: "none", color: "#000", padding: 0, fontSize: 12, background: "transparent", fontFamily: "'Arial Hebrew', sans-serif" }}>Need an account? Sign up</button></div>
            </form>
          </div>

          {/* BACK: SIGNUP */}
          <div style={{ background: "rgba(255, 255, 255, 0.25)", backdropFilter: "blur(10px)", padding: 40, borderRadius: 20, boxShadow: "0 8px 32px rgba(0, 0, 0, 0.15)", backfaceVisibility: "hidden", transform: "rotateY(180deg)", position: !isLogin ? "relative" : "absolute", top: 0, left: 0, width: "100%", border: "1px solid rgba(255, 255, 255, 0.4)", fontFamily: "'Arial Hebrew', sans-serif", color: "#000" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 30 }}>
              <div style={{ width: 44, height: 44, background: "linear-gradient(135deg,#3b82f6,#8b5cf6)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: "#fff" }}>⚡</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#000" }}>DeskFlow</div>
            </div>
            <div style={{ display: "flex", background: "rgba(255, 255, 255, 0.15)", borderRadius: 10, padding: 4, marginBottom: 24, border: "1px solid rgba(255, 255, 255, 0.2)" }}>
              <button onClick={() => { setIsLogin(true); setAuthError(""); setAuthMessage(""); }} style={{ flex: 1, padding: "8px", border: "none", borderRadius: 8, background: "transparent", cursor: "pointer", fontWeight: 600, color: "#000", fontFamily: "'Arial Hebrew', sans-serif" }}>Login</button>
              <button onClick={() => { setIsLogin(false); setAuthError(""); setAuthMessage(""); }} style={{ flex: 1, padding: "8px", border: "none", borderRadius: 8, background: "#3b82f6", boxShadow: "0 2px 4px rgba(0,0,0,0.1)", cursor: "pointer", fontWeight: 600, color: "#fff", fontFamily: "'Arial Hebrew', sans-serif" }}>Signup</button>
            </div>
            {authError && <div style={{ padding: "10px 14px", background: "rgba(239, 68, 68, 0.2)", color: "#000", borderRadius: 8, fontSize: 13, marginBottom: 16, fontWeight: 500, border: "1px solid rgba(239, 68, 68, 0.3)", fontFamily: "'Arial Hebrew', sans-serif" }}>{authError}</div>}
            {authMessage && <div style={{ padding: "10px 14px", background: "rgba(34, 197, 94, 0.2)", color: "#000", borderRadius: 8, fontSize: 13, marginBottom: 16, fontWeight: 500, border: "1px solid rgba(34, 197, 94, 0.3)", fontFamily: "'Arial Hebrew', sans-serif" }}>{authMessage}</div>}
            <form onSubmit={handleSignup}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 10px" }}>
                <FF label="First Name" required><input required style={{ ...iS, background: "rgba(255, 255, 255, 0.1)", color: "#000", border: "1px solid rgba(255, 255, 255, 0.2)", fontFamily: "'Arial Hebrew', sans-serif" }} value={authForm.firstName} onChange={e => setAuthForm({ ...authForm, firstName: e.target.value })} placeholder="First" /></FF>
                <FF label="Last Name" required><input required style={{ ...iS, background: "rgba(255, 255, 255, 0.1)", color: "#000", border: "1px solid rgba(255, 255, 255, 0.2)", fontFamily: "'Arial Hebrew', sans-serif" }} value={authForm.lastName} onChange={e => setAuthForm({ ...authForm, lastName: e.target.value })} placeholder="Last" /></FF>
              </div>
              <FF label="Middle Name (Optional)"><input style={{ ...iS, background: "rgba(255, 255, 255, 0.1)", color: "#000", border: "1px solid rgba(255, 255, 255, 0.2)", fontFamily: "'Arial Hebrew', sans-serif" }} value={authForm.middleName} onChange={e => setAuthForm({ ...authForm, middleName: e.target.value })} placeholder="Middle" /></FF>
              <FF label="Phone"><div style={{ display: "flex", gap: 6 }}>
                <select style={{ ...sS, width: 70, padding: "9px 6px", background: "rgba(255, 255, 255, 0.1)", color: "#000", border: "1px solid rgba(255, 255, 255, 0.2)", fontFamily: "'Arial Hebrew', sans-serif" }} value={authForm.countryCode} onChange={e => setAuthForm({ ...authForm, countryCode: e.target.value })}>
                  <option value="+1">+1</option><option value="+44">+44</option><option value="+91">+91</option><option value="+61">+61</option><option value="+81">+81</option>
                </select>
                <input style={{ ...iS, flex: 1, background: "rgba(255, 255, 255, 0.1)", color: "#000", border: "1px solid rgba(255, 255, 255, 0.2)", fontFamily: "'Arial Hebrew', sans-serif" }} value={authForm.phone} onChange={e => setAuthForm({ ...authForm, phone: e.target.value })} placeholder="Phone" />
              </div></FF>
              <FF label="Email"><input type="email" required style={{ ...iS, background: "rgba(255, 255, 255, 0.1)", color: "#000", border: "1px solid rgba(255, 255, 255, 0.2)", fontFamily: "'Arial Hebrew', sans-serif" }} value={authForm.email} onChange={e => setAuthForm({ ...authForm, email: e.target.value })} placeholder="your@email.com" /></FF>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 10px" }}>
                <FF label="Password" required>
                  <input type="password" required style={{ ...iS, background: "rgba(255, 255, 255, 0.1)", color: "#000", border: authForm.password && authForm.password !== authForm.confirm ? "1px solid #ef4444" : "1px solid rgba(255, 255, 255, 0.2)", fontFamily: "'Arial Hebrew', sans-serif" }} value={authForm.password} onChange={e => setAuthForm({ ...authForm, password: e.target.value })} placeholder="••••••••" />
                  <div style={{ marginTop: 4, height: 4, background: "rgba(255, 255, 255, 0.2)", borderRadius: 2, overflow: "hidden" }}><div style={{ height: "100%", width: `${pwdStr}%`, background: pwdColor, transition: "all 0.3s" }} /></div>

                  {/* ✅ NEW: Password Requirements */}
                  {authForm.password && (
                    <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 5 }}>
                      {pwdReqs.map(req => (
                        <div
                          key={req.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            fontSize: 11,
                            fontWeight: 500,
                            color: req.met ? "#22c55e" : "#000",
                            opacity: req.met ? 0.6 : 1,
                            textDecoration: req.met ? "line-through" : "none",
                            animation: req.met ? "strikeThrough 0.5s ease-out" : "none",
                            transition: "all 0.3s ease"
                          }}
                        >
                          <span style={{ fontSize: 10 }}>{req.met ? "✓" : "•"}</span>
                          <span>{req.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </FF>
                <FF label="Confirm" required><input type="password" required style={{ ...iS, background: "rgba(255, 255, 255, 0.1)", color: "#000", border: authForm.confirm && authForm.password !== authForm.confirm ? "1px solid #ef4444" : "1px solid rgba(255, 255, 255, 0.2)", fontFamily: "'Arial Hebrew', sans-serif" }} value={authForm.confirm} onChange={e => setAuthForm({ ...authForm, confirm: e.target.value })} placeholder="••••••••" /></FF>
              </div>
              {authForm.confirm && authForm.password !== authForm.confirm && <div style={{ color: "#000", fontSize: 11, marginTop: -6, marginBottom: 10, fontFamily: "'Arial Hebrew', sans-serif" }}>Passwords do not match</div>}
              <button type="submit" disabled={authForm.password !== authForm.confirm} style={{ ...bP, width: "100%", marginTop: 4, padding: 12, background: "linear-gradient(135deg,#3b82f6,#8b5cf6)", color: "#fff", border: "none", fontFamily: "'Arial Hebrew', sans-serif", fontWeight: 600, opacity: authForm.password !== authForm.confirm ? 0.5 : 1 }}>Sign Up</button>
              <div style={{ marginTop: 12, textAlign: "center" }}><button type="button" onClick={() => { setIsLogin(true); setAuthError(""); setAuthMessage(""); }} style={{ ...bG, border: "none", color: "#000", padding: 0, fontSize: 12, background: "transparent", fontFamily: "'Arial Hebrew', sans-serif" }}>Already have an account? Log in</button></div>
            </form>
          </div>
        </div>
      </div>
    );
  }

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
        fields={confirmModal.fields}
        showLunchButton={confirmModal.showLunchButton}
        confirmLabel={confirmModal.confirmLabel}
        confirmDanger={confirmModal.confirmDanger}
        onConfirm={confirmModal.onConfirm}
        onLunch={confirmModal.onLunch}
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
            {TICKET_VIEWS.filter(v => {
              if (v.id === "unassigned") return currentUser?.role === "Admin" || currentUser?.role === "Manager";
              return true;
            }).map(v => (
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

        {/* ── Inventory Link ── */}
        <div style={{ padding: "4px 8px 6px", borderTop: "1px solid #1e293b" }}>
          <button
            onClick={() => window.location.href = "/inventory"}
            style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "8px 11px", borderRadius: 7, border: "none", cursor: "pointer", background: "transparent", color: "#64748b", fontSize: 13, fontWeight: 400, textAlign: "left", fontFamily: "'DM Sans',sans-serif" }}
            onMouseEnter={e => { e.currentTarget.style.background = "#1e293b"; e.currentTarget.style.color = "#e2e8f0"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#64748b"; }}
          >
            <span style={{ fontSize: 15 }}>📦</span>
            <span>Inventory</span>
          </button>
        </div>

        {/* New Ticket / Project buttons */}
        <div style={{ padding: "8px 8px 10px", display: "flex", flexDirection: "column", gap: 5 }}>
          <button onClick={() => { setForm(emptyForm()); setShowNewTicket(true); }} style={{ width: "100%", padding: "8px", borderRadius: 9, border: "none", background: "linear-gradient(135deg,#3b82f6,#6366f1)", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>+ New Ticket</button>
          <button onClick={() => setShowNewProject(true)} style={{ width: "100%", padding: "8px", borderRadius: 9, border: "1.5px solid #1e40af", background: "transparent", color: "#60a5fa", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", display: (currentUser?.role === "Admin" || currentUser?.role === "Manager") ? "block" : "none" }}>+ New Project</button>
        </div>

        {/* Profile section (v1 full profile panel) */}
        <div style={{ padding: "8px 12px 14px", borderTop: "1px solid #1e293b" }}>
          <div onClick={() => setProfileOpen(!profileOpen)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px", borderRadius: 8, cursor: "pointer", background: profileOpen ? "#1e293b" : "transparent", transition: "background 0.2s" }}>
            <Avatar name={currentUser.name} size={30} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{currentUser.name}</div>
              <div style={{ fontSize: 10, color: "#94a3b8", display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: (statusOpts.find(s => s.l === currentUser.status)?.c || "#94a3b8") }} />
                {currentUser.role}
              </div>
            </div>
            <span style={{ color: "#475569", fontSize: 12 }}>{profileOpen ? "▴" : "▾"}</span>
          </div>
          {profileOpen && (
            <div style={{ marginTop: 8, background: "#1e293b", borderRadius: 8, padding: "8px" }}>
              <button onClick={() => { setProfileForm({ name: currentUser.name, phone: currentUser.phone || "" }); setEditProfileOpen(true); }} style={{ width: "100%", padding: "6px 10px", background: "#334155", border: "none", borderRadius: 6, color: "#f8fafc", fontSize: 12, fontWeight: 600, cursor: "pointer", marginBottom: 8, textAlign: "left" }}>👤 View Profile</button>
              <div style={{ fontSize: 10, fontWeight: 600, color: "#94a3b8", marginBottom: 6, textTransform: "uppercase", padding: "0 4px" }}>Status</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {/* ✅ UPDATED: Show only current status as read-only */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 8px", borderRadius: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: (statusOpts.find(s => s.l === currentUser.status)?.c || "#94a3b8") }} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: (statusOpts.find(s => s.l === currentUser.status)?.c || "#cbd5e1") }}>
                    {currentUser.status === "On Lunch" ? "🍽️ On Lunch" : currentUser.status === "On Duty" ? "On Duty" : "Off Duty"}
                  </span>
                </div>
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

        {/* ✅ NEW: Session Information Section */}
        <div style={{ marginBottom: 18, padding: "10px 14px", background: "#f0f9ff", borderRadius: 8, border: "1px solid #bfdbfe" }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: "#0c4a6e", textTransform: "uppercase", marginBottom: 8 }}>📊 Session Info</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
              <span style={{ color: "#475569" }}>Current Status:</span>
              <span style={{ fontWeight: 600, color: currentUser.status === "On Duty" ? "#22c55e" : currentUser.status === "On Lunch" ? "#f97316" : "#f59e0b" }}>
                {currentUser.status || "Off Duty"}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
              <span style={{ color: "#475569" }}>Location:</span>
              <span style={{ fontWeight: 500, color: "#0f172a" }}>{currentUser.currentLocation || "Not Set"}</span>
            </div>
            {currentUser.currentTicketId && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <span style={{ color: "#475569" }}>Current Ticket:</span>
                <span style={{ fontWeight: 500, color: "#0f172a" }}>{currentUser.currentTicketId}</span>
              </div>
            )}
            {currentUser.loginTime && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <span style={{ color: "#475569" }}>Session Time:</span>
                <span style={{ fontWeight: 500, color: "#0f172a" }}>{calculateSessionDuration() || "Computing..."}</span>
              </div>
            )}
          </div>
        </div>

        <div style={{ marginBottom: 18, padding: "10px 14px", background: "#f8fafc", borderRadius: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", marginBottom: 2 }}>Email Address (Unchangeable)</div>
          <div style={{ fontSize: 13, color: "#334155", fontWeight: 500 }}>{currentUser.email}</div>
        </div>
        <FF label="Full Name"><input style={iS} value={profileForm.name} onChange={e => setProfileForm({ ...profileForm, name: e.target.value })} /></FF>
        <FF label="Phone Number"><input style={iS} value={profileForm.phone} onChange={e => setProfileForm({ ...profileForm, phone: e.target.value })} /></FF>

        {/* ✅ NEW: Activity & Session History Buttons */}
        <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
          <button
            onClick={() => { setShowActivityLog(true); }}
            style={{ flex: 1, padding: "8px 12px", background: "#dbeafe", border: "1px solid #bfdbfe", borderRadius: 6, color: "#0c4a6e", fontWeight: 600, cursor: "pointer", fontSize: 12 }}>
            📋 Activity Log
          </button>
          <button
            onClick={() => { setShowSessionHistory(true); }}
            style={{ flex: 1, padding: "8px 12px", background: "#f3e8ff", border: "1px solid #e9d5ff", borderRadius: 6, color: "#6b21a8", fontWeight: 600, cursor: "pointer", fontSize: 12 }}>
            ⏱️ Session History
          </button>
        </div>

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

      {/* ✅ NEW: User Management Edit Modal (Role Change, Deactivate, Delete) */}
      <Modal open={userEditModal.show} onClose={() => { setUserEditModal({ show: false, user: null, newRole: null }); }} title={userEditModal.user ? `Manage User: ${userEditModal.user.name}` : "Manage User"} width={520}>
        {userEditModal.user && (
          <div>
            <div style={{ marginBottom: 20, padding: "14px 16px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <Avatar name={userEditModal.user.name} size={48} />
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}>{userEditModal.user.name}</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>{userEditModal.user.email}</div>
                  <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                    <Badge label={userEditModal.user.role} style={{ background: "#ede9fe", color: "#6d28d9" }} />
                    <Badge label={userEditModal.user.active ? "Active" : "Inactive"} style={{ background: userEditModal.user.active ? "#dcfce7" : "#fee2e2", color: userEditModal.user.active ? "#15803d" : "#991b1b" }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Role Change Section */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#1e293b", marginBottom: 8 }}>🔑 Change Role</label>
              <select
                value={userEditModal.newRole}
                onChange={(e) => setUserEditModal({ ...userEditModal, newRole: e.target.value })}
                style={{ ...sS, fontSize: 12, padding: "8px 10px", width: "100%" }}
              >
                {ROLES.map(r => <option key={r}>{r}</option>)}
              </select>
              {userEditModal.newRole !== userEditModal.user.role && (
                <div style={{ fontSize: 11, color: "#f59e0b", marginTop: 6, padding: "8px 10px", background: "#fffaeb", borderRadius: 6, borderLeft: "3px solid #f59e0b" }}>
                  ⚠️ Changing role will log out the user. They must log in again with their new permissions.
                </div>
              )}
            </div>

            {/* Deactivate Section */}
            <div style={{ marginBottom: 20, padding: "14px 16px", background: userEditModal.user.active ? "#fef3c7" : "#dcfce7", borderRadius: 10, border: `1px solid ${userEditModal.user.active ? "#f59e0b" : "#22c55e"}` }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", marginBottom: 3 }}>{userEditModal.user.active ? "🔴 Deactivate User" : "🟢 Activate User"}</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>
                    {userEditModal.user.active
                      ? "This user will be logged out and unable to access the system"
                      : "This user will be able to log in and access the system"}
                  </div>
                </div>
                <button
                  onClick={async () => {
                    try {
                      const updated = { ...userEditModal.user, active: !userEditModal.user.active, status: !userEditModal.user.active ? userEditModal.user.status : "Logged-Out" };
                      await axios.put(`${USERS_API}/${userEditModal.user.id}`, updated);
                      setUsers(users.map(x => x.id === userEditModal.user.id ? updated : x));
                      if (userEditModal.user.id === currentUser.id && !userEditModal.user.active) {
                        clearSession();
                        setCurrentUser(null);
                        setCustomAlert({ show: true, message: "❌ You've been deactivated. Logged out.", type: "error" });
                        setTimeout(() => window.location.reload(), 2000);
                      } else if (!userEditModal.user.active) {
                        setCustomAlert({ show: true, message: `✅ ${userEditModal.user.name} deactivated.`, type: "success" });
                      } else {
                        setCustomAlert({ show: true, message: `✅ ${userEditModal.user.name} activated.`, type: "success" });
                      }
                      setUserEditModal({ show: false, user: null, newRole: null });
                    } catch (err) {
                      setCustomAlert({ show: true, message: "Failed to update user status", type: "error" });
                    }
                  }}
                  style={{ padding: "6px 12px", background: userEditModal.user.active ? "#fef3c7" : "#dcfce7", border: `1px solid ${userEditModal.user.active ? "#f59e0b" : "#22c55e"}`, borderRadius: 6, color: userEditModal.user.active ? "#854d0e" : "#15803d", fontWeight: 600, cursor: "pointer", fontSize: 12, whiteSpace: "nowrap" }}
                >
                  {userEditModal.user.active ? "Deactivate" : "Activate"}
                </button>
              </div>
            </div>

            {/* Delete Section - Only if not current user */}
            {userEditModal.user.id !== currentUser?.id && (
              <div style={{ marginBottom: 20, padding: "14px 16px", background: "#fee2e2", borderRadius: 10, border: "1px solid #fca5a5" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#991b1b", marginBottom: 3 }}>🗑️ Delete User</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>Permanently remove this user from the system. This action cannot be undone.</div>
                  </div>
                  <button
                    onClick={() => {
                      setConfirmModal({
                        show: true,
                        title: "Delete User",
                        message: `Are you sure you want to permanently delete ${userEditModal.user.name}? This action cannot be undone.`,
                        onConfirm: async () => {
                          try {
                            await axios.delete(`${USERS_API}/${userEditModal.user.id}`);
                            setUsers(prev => prev.filter(u => u.id !== userEditModal.user.id));
                            setCustomAlert({ show: true, message: `✅ ${userEditModal.user.name} deleted.`, type: "success" });
                            setConfirmModal({ show: false, title: "", message: "", onConfirm: null, onCancel: null });
                            setUserEditModal({ show: false, user: null, newRole: null });
                          } catch (err) {
                            setCustomAlert({ show: true, message: "Failed to delete user", type: "error" });
                            setConfirmModal({ show: false, title: "", message: "", onConfirm: null, onCancel: null });
                          }
                        },
                        onCancel: () => {
                          setConfirmModal({ show: false, title: "", message: "", onConfirm: null, onCancel: null });
                        }
                      });
                    }}
                    style={{ padding: "6px 12px", background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 6, color: "#ef4444", fontWeight: 600, cursor: "pointer", fontSize: 12, whiteSpace: "nowrap" }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", paddingTop: 16, borderTop: "1px solid #e2e8f0" }}>
              <button
                onClick={() => { setUserEditModal({ show: false, user: null, newRole: null }); }}
                style={{ ...bG, padding: "8px 16px", fontSize: 12 }}
              >
                Cancel
              </button>
              {userEditModal.newRole !== userEditModal.user.role && (
                <button
                  onClick={async () => {
                    try {
                      setConfirmModal({
                        show: true,
                        title: "Confirm Role Change",
                        message: `Change ${userEditModal.user.name}'s role to ${userEditModal.newRole}? They will be logged out and must log in again.`,
                        onConfirm: async () => {
                          try {
                            const updated = { ...userEditModal.user, role: userEditModal.newRole };
                            await axios.put(`${USERS_API}/${userEditModal.user.id}`, updated);
                            setUsers(users.map(u => u.id === userEditModal.user.id ? updated : u));
                            if (userEditModal.user.id === currentUser.id) {
                              clearSession();
                              setCurrentUser(null);
                              setCustomAlert({ show: true, message: `⚠️ Your role changed to ${userEditModal.newRole}. Log in again.`, type: "warning" });
                              setTimeout(() => window.location.reload(), 2000);
                            } else {
                              setCustomAlert({ show: true, message: `✅ ${userEditModal.user.name} role → ${userEditModal.newRole}. User logged out.`, type: "success" });
                            }
                            setConfirmModal({ show: false, title: "", message: "", onConfirm: null, onCancel: null });
                            setUserEditModal({ show: false, user: null, newRole: null });
                          } catch (err) {
                            setCustomAlert({ show: true, message: "Failed to update role", type: "error" });
                            setConfirmModal({ show: false, title: "", message: "", onConfirm: null, onCancel: null });
                          }
                        },
                        onCancel: () => {
                          setConfirmModal({ show: false, title: "", message: "", onConfirm: null, onCancel: null });
                        }
                      });
                    } catch (err) {
                      setCustomAlert({ show: true, message: "Failed to update role", type: "error" });
                    }
                  }}
                  style={{ ...bP, padding: "8px 16px", fontSize: 12 }}
                >
                  Change Role
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Add Vendor Modal */}
      <Modal open={showAddVendorModal} onClose={() => { setShowAddVendorModal(false); setNewVendor({ name: "", email: "", phone: "", address: "" }); }} title="Add New Vendor" width={450}>
        <div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 6 }}>Vendor Name *</label>
            <input style={iS} placeholder="Enter vendor name" value={newVendor.name || ""} onChange={e => setNewVendor({ ...newVendor, name: e.target.value })} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 6 }}>Email Address</label>
            <input style={iS} type="email" placeholder="Enter email" value={newVendor.email || ""} onChange={e => setNewVendor({ ...newVendor, email: e.target.value })} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 6 }}>Phone Number</label>
            <input style={iS} placeholder="Enter phone number" value={newVendor.phone || ""} onChange={e => setNewVendor({ ...newVendor, phone: e.target.value })} />
          </div>
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 6 }}>Address</label>
            <input style={iS} placeholder="Enter address" value={newVendor.address || ""} onChange={e => setNewVendor({ ...newVendor, address: e.target.value })} />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button onClick={() => { setShowAddVendorModal(false); setNewVendor({ name: "", email: "", phone: "", address: "" }); }} style={bG}>Cancel</button>
            <button onClick={() => { addVendor(); setShowAddVendorModal(false); }} style={bP}>Add Vendor</button>
          </div>
        </div>
      </Modal>

      {/* Add User Modal */}
      <Modal open={showAddUserModal} onClose={() => { setShowAddUserModal(false); setNewUser({ name: "", email: "", password: "", role: "Viewer" }); }} title="Add New User" width={450}>
        <div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 6 }}>Full Name *</label>
            <input style={iS} placeholder="Enter full name" value={newUser.name || ""} onChange={e => setNewUser({ ...newUser, name: e.target.value })} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 6 }}>Email Address *</label>
            <input style={iS} type="email" placeholder="Enter email" value={newUser.email || ""} onChange={e => setNewUser({ ...newUser, email: e.target.value })} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 6 }}>Password *</label>
            <input style={iS} type="password" placeholder="Enter password (min 6 characters)" value={newUser.password || ""} onChange={e => setNewUser({ ...newUser, password: e.target.value })} />
          </div>
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#334155", marginBottom: 6 }}>Role</label>
            <select style={{ ...sS, width: "100%" }} value={newUser.role || "Viewer"} onChange={e => setNewUser({ ...newUser, role: e.target.value })}>{ROLES.map(r => <option key={r}>{r}</option>)}</select>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button onClick={() => { setShowAddUserModal(false); setNewUser({ name: "", email: "", password: "", role: "Viewer" }); }} style={bG}>Cancel</button>
            <button onClick={() => { addUser(); setShowAddUserModal(false); }} style={bP}>Add User</button>
          </div>
        </div>
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
            {view === "reports" && (
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <select value={range} onChange={e => { setRange(e.target.value); if (e.target.value !== "custom") { setCustomDateFrom(""); setCustomDateTo(""); } }} style={{ ...sS, width: 150, fontSize: 13, padding: "7px 10px" }}>
                  <option value="all">All Time</option>
                  <option value="1">Today</option>
                  <option value="7">Last 7 Days</option>
                  <option value="30">Last 30 Days</option>
                  <option value="last_month">Last 6 Months</option>
                  <option value="custom">📅 Custom Range</option>
                </select>
                {range === "custom" && (
                  <>
                    <input
                      type="date"
                      value={customDateFrom}
                      onChange={e => setCustomDateFrom(e.target.value)}
                      style={{ ...sS, fontSize: 12, padding: "7px 9px", width: 135 }}
                    />
                    <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 500 }}>to</span>
                    <input
                      type="date"
                      value={customDateTo}
                      onChange={e => setCustomDateTo(e.target.value)}
                      max={new Date().toISOString().split("T")[0]}
                      style={{ ...sS, fontSize: 12, padding: "7px 9px", width: 135 }}
                    />
                  </>
                )}
              </div>
            )}
            {view === "dashboard" && (
              <>
                <div style={{ position: "relative", width: 180 }}>
                  <input type="text" placeholder="Select organization..." value={dashboardOrgSearch ? dashboardOrgSearch : (dashboardOrg !== "all" ? dashboardOrg : "")} onChange={e => setDashboardOrgSearch(e.target.value)} onFocus={() => { setDashboardOrgSearch(""); setShowDashboardOrgDD(true); }} style={{ ...sS, width: "100%", fontSize: 13, padding: "7px 10px" }} />
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

                {/* Time Period Dropdown */}
                <select value={dashboardTimePeriod} onChange={e => setDashboardTimePeriod(e.target.value)} style={{ ...sS, width: 160, fontSize: 13, padding: "7px 10px" }}>
                  <option value="1d">📅 Today</option>
                  <option value="7d">📅 Last 7 Days</option>
                  <option value="1m">📊 Last Month</option>
                  <option value="3m">📊 Last 3 Months</option>
                  <option value="6m">📊 Last 6 Months</option>
                  <option value="1y">📊 Last Year</option>
                  <option value="all">📊 All Time</option>
                </select>
              </>
            )}
            {/* Bell + Inbox Icons */}
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              {/* 🔔 Bell — daily activity log */}
              <div style={{ position: "relative" }}>
                <button onClick={() => { setShowBellPanel(p => !p); setShowInboxPanel(false); }}
                  style={{ width: 36, height: 36, borderRadius: 9, border: "1.5px solid #e2e8f0", background: showBellPanel ? "#eff6ff" : "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, position: "relative" }}>
                  🔔
                  {bellUnread > 0 && <span style={{ position: "absolute", top: -4, right: -4, background: "#ef4444", color: "#fff", borderRadius: 99, fontSize: 9, fontWeight: 700, minWidth: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px" }}>{bellUnread > 99 ? "99+" : bellUnread}</span>}
                </button>
                {showBellPanel && <>
                  <div style={{ position: "fixed", inset: 0, zIndex: 299 }} onClick={() => setShowBellPanel(false)} />
                  <div style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", width: 340, background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 14, boxShadow: "0 12px 40px rgba(0,0,0,0.14)", zIndex: 300, overflow: "hidden" }}>
                    <div style={{ padding: "13px 16px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>🔔 Today's Activity</span>
                      <span style={{ fontSize: 11, color: "#94a3b8" }}>{new Date().toLocaleDateString()}</span>
                    </div>
                    <div style={{ maxHeight: 420, overflowY: "auto" }}>
                      {dailyNotifs.length === 0 && <div style={{ padding: 28, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>No activity yet today</div>}
                      {/* ✅ Show ALL notifications, but only count NEW ones on badge */}
                      {dailyNotifs.map(n => (
                        <div key={n.id} onClick={() => handleNotificationClick(n)} style={{ padding: "10px 16px", borderBottom: "1px solid #f8fafc", display: "flex", alignItems: "flex-start", gap: 10, background: seenActivityIds.current.has(n.dbId) ? "#fff" : (n.fromBroadcast ? "#fff7ed" : "#f0f9ff"), opacity: seenActivityIds.current.has(n.dbId) ? 0.7 : 1, cursor: "pointer", transition: "all 0.2s ease", borderLeft: seenActivityIds.current.has(n.dbId) ? "3px solid #e2e8f0" : "3px solid #3b82f6" }}
                          onMouseEnter={e => { if (!seenActivityIds.current.has(n.dbId)) { e.currentTarget.style.background = n.fromBroadcast ? "#fef0e7" : "#eff6ff"; e.currentTarget.style.boxShadow = "inset 0 1px 3px rgba(0,0,0,0.05)"; } }}
                          onMouseLeave={e => { e.currentTarget.style.background = seenActivityIds.current.has(n.dbId) ? "#fff" : (n.fromBroadcast ? "#fff7ed" : "#f0f9ff"); e.currentTarget.style.boxShadow = "none"; }}>
                          <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{n.icon}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            {n.fromBroadcast && n.by && n.by !== currentUser?.name && (
                              <div style={{ fontSize: 9, fontWeight: 700, color: "#f97316", textTransform: "uppercase", marginBottom: 2, letterSpacing: "0.05em" }}>📢 {n.by}</div>
                            )}
                            <div style={{ fontSize: 12, fontWeight: 500, color: "#1e293b", lineHeight: 1.4 }}>{n.text}</div>
                            {n.ticketId && <div style={{ fontSize: 10, color: "#3b82f6", marginTop: 2, fontFamily: "monospace", fontWeight: 600 }}>🎫 {n.ticketId}</div>}
                            <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>
                              {new Date(n.time).toLocaleTimeString()}
                              {seenActivityIds.current.has(n.dbId) && <span style={{ marginLeft: 8, color: "#22c55e", fontWeight: 600 }}>✓ Read</span>}
                              {!seenActivityIds.current.has(n.dbId) && <span style={{ marginLeft: 8, color: "#f97316", fontWeight: 600 }}>● Unread</span>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>}
              </div>

              {/* ✉️ Inbox — DB-backed per user */}
              <div style={{ position: "relative" }}>
                <button onClick={() => { setShowInboxPanel(p => !p); setShowBellPanel(false); if (!showInboxPanel) markInboxRead(); }}
                  style={{ width: 36, height: 36, borderRadius: 9, border: "1.5px solid #e2e8f0", background: showInboxPanel ? "#eff6ff" : "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, position: "relative" }}>
                  ✉️
                  {inboxUnread > 0 && <span style={{ position: "absolute", top: -4, right: -4, background: "#3b82f6", color: "#fff", borderRadius: 99, fontSize: 9, fontWeight: 700, minWidth: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px" }}>{inboxUnread > 99 ? "99+" : inboxUnread}</span>}
                </button>
                {showInboxPanel && <>
                  <div style={{ position: "fixed", inset: 0, zIndex: 299 }} onClick={() => setShowInboxPanel(false)} />
                  <div style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", width: 380, background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 14, boxShadow: "0 12px 40px rgba(0,0,0,0.14)", zIndex: 300, overflow: "hidden" }}>
                    <div style={{ padding: "13px 16px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>✉️ Inbox</span>
                      <span style={{ fontSize: 11, color: "#94a3b8" }}>{inboxItems.length} messages</span>
                    </div>
                    <div style={{ maxHeight: 460, overflowY: "auto" }}>
                      {inboxItems.length === 0 && <div style={{ padding: 28, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>No messages</div>}
                      {inboxItems.map(item => (
                        <div key={item.id} style={{ padding: "12px 16px", borderBottom: "1px solid #f8fafc", background: item.read ? "#fff" : "#f0f9ff", borderLeft: item.read ? "none" : "3px solid #3b82f6" }}>
                          <div style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
                            <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>
                              {item.type === "forward_request" ? "📬" : item.type === "forward_response" ? (item.status === "Approved" ? "✅" : "❌") : item.type === "ticket_assigned" ? "🎫" : "📩"}
                            </span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a", marginBottom: 3 }}>{item.title}</div>
                              <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.5, marginBottom: 6 }}>{item.message}</div>
                              {item.ticketId && <div style={{ fontSize: 10, color: "#3b82f6", fontFamily: "monospace", marginBottom: 6 }}>{item.ticketId}</div>}
                              {/* Accept/Reject for pending forward requests */}
                              {item.type === "forward_request" && !item.resolved && (currentUser?.role === "Admin" || currentUser?.role === "Manager") && (
                                <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                                  <button onClick={() => acceptInboxForwardRequest(item)} style={{ flex: 1, padding: "5px 10px", fontSize: 11, fontWeight: 600, background: "#10b981", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>✓ Approve</button>
                                  <button onClick={() => rejectInboxForwardRequest(item)} style={{ flex: 1, padding: "5px 10px", fontSize: 11, fontWeight: 600, background: "#ef4444", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>✕ Reject</button>
                                </div>
                              )}
                              {item.resolved && <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 99, background: item.resolved === "Approved" ? "#dcfce7" : "#fee2e2", color: item.resolved === "Approved" ? "#15803d" : "#991b1b" }}>{item.resolved}</span>}
                              <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 4 }}>{item.createdAt ? new Date(item.createdAt).toLocaleString() : ""}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>}
              </div>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, padding: 20, overflow: "auto", position: "relative" }}>
          {/* ── DASHBOARD (v2 layout + SmartCharts) ── */}
          {view === "dashboard" && <>
            {/* Background Image with Clear Display for Dashboard */}
            <div style={{
              position: "absolute",
              inset: 0,
              backgroundImage: 'url("/res/login_page_bg.jpeg")', // USER: Static asset from public/res folder
              backgroundSize: "auto",
              backgroundPosition: "0 0",
              backgroundRepeat: "repeat",
              opacity: 1,
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
                  ...((currentUser?.role === "Admin" || currentUser?.role === "Manager") ? [{ label: "Unassigned", value: dashboardData.filter(t => (!t.assignees || t.assignees.length === 0) && t.status !== "Closed" && !isTrueWebcast(t)).length, bg: "#f3e8ff", accent: "#a855f7", icon: "🔸", action: () => { setView("tickets"); setTvFilter("unassigned"); } }] : []),
                  { label: "In Progress", value: dashboardStats.inProgress, bg: "#ede9fe", accent: "#6366f1", icon: "⚙️", action: () => { setView("tickets"); setTvFilter("all"); setStatusF("In Progress"); setPriorityF("All"); } },
                  { label: "Critical", value: dashboardStats.critical, bg: "#fee2e2", accent: "#ef4444", icon: "🔥", action: () => { setView("tickets"); setTvFilter("alerts"); setStatusF("All"); setPriorityF("Critical"); } },
                  { label: "Closed", value: dashboardStats.closed, bg: "#dcfce7", accent: "#22c55e", icon: "✅", action: () => { setView("tickets"); setTvFilter("closed"); setStatusF("All"); setPriorityF("All"); } },
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
                    <div style={{ background: "#fff", borderRadius: 12, padding: 18, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", minHeight: 220 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: "#374151" }}>Ticket Priority</div>
                      <SmartChart data={priorityDist} defaultType="pie" />
                    </div>
                    <SmartChart title="By Category" data={categoryDist} defaultColor="#8b5cf6" />
                  </div>

                  {/* Admin/Manager: 2nd row (2 graphs) */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                    <div style={{ background: "#fff", borderRadius: 12, padding: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", minHeight: 220 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, color: "#374151" }}>Ticket Status (w/ Unassigned)</div>
                      <SmartChart data={dashboardStatusDist} defaultType="pie" />
                    </div>
                    <SmartChart title="People Closing Tickets" data={dashboardClosingUsers} defaultColor="#10b981" />
                  </div>

                  {/* Recent Tickets for Admin/Manager */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
                    <div style={{ background: "#fff", borderRadius: 12, padding: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10, color: "#374151" }}>Recent Tickets</div>
                      {(currentUser?.role === "Admin" || currentUser?.role === "Manager" ? tickets : tickets.filter(t => t.reportedBy === currentUser?.name || t.assignees?.some(a => a.id === currentUser?.id))).slice(0, 5).map(t => (
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
                  {/* Viewer/Agent: 2-column grid - NO Recent Tickets */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                    <div style={{ background: "#fff", borderRadius: 12, padding: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", minHeight: 200 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, color: "#374151" }}>Tickets Over Time (Weekly)</div>
                      <SmartChart data={dashboardDailyData} defaultColor="#3b82f6" size="small" />
                    </div>
                    <div style={{ background: "#fff", borderRadius: 12, padding: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", minHeight: 220 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, color: "#374151" }}>Ticket Priority</div>
                      <SmartChart data={priorityDist} defaultType="bubble" size="small" />
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                    <div style={{ background: "#fff", borderRadius: 12, padding: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", minHeight: 200 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, color: "#374151" }}>By Category</div>
                      <SmartChart data={categoryDist} defaultColor="#8b5cf6" size="small" />
                    </div>
                    <div style={{ background: "#fff", borderRadius: 12, padding: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", minHeight: 220 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, color: "#374151" }}>Ticket Status (w/ Unassigned)</div>
                      <SmartChart data={dashboardStatusDist} defaultType="pie" size="small" />
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
              <span style={{ fontSize: 12, color: "#64748b" }}>{allSortedTickets.length} tickets</span>
              <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
                <button onClick={() => { setForm(emptyForm()); setShowNewTicket(true); }} style={{ ...bP, padding: "7px 13px", fontSize: 12 }}>+ New Ticket</button>
                {selectedIds.size > 0 && <span style={{ fontSize: 12, color: "#3b82f6", fontWeight: 600, background: "#eff6ff", padding: "4px 10px", borderRadius: 99 }}>{selectedIds.size} selected</span>}

                {/* ── Bulk Close - ADMIN ONLY ── */}
                {selectedIds.size > 0 && currentUser?.role === "Admin" && (
                  <button onClick={() => {
                    setConfirmModal({
                      show: true,
                      title: `Close ${selectedIds.size} Ticket(s)?`,
                      message: `Enter one closing reason — it will be applied to all ${selectedIds.size} selected ticket(s).`,
                      fields: [
                        { name: "remark", label: "📝 Closing Reason", type: "textarea", placeholder: "Describe what was done or why these tickets are being closed…", value: "" }
                      ],
                      confirmLabel: `Close ${selectedIds.size} Ticket(s)`,
                      confirmDanger: false,
                      onConfirm: async (data) => {
                        const remark = (data.remark || "").trim();
                        if (!remark) {
                          setCustomAlert({ show: true, message: "⚠️ Please enter a closing reason before proceeding", type: "error" });
                          return;
                        }
                        const nowISO = new Date().toISOString();
                        const count = selectedIds.size;
                        try {
                          for (const id of selectedIds) {
                            const t = tickets.find(x => x.id === id);
                            if (t) {
                              const newTimelineEvent = { action: "Status changed to Closed", by: currentUser.name, date: nowISO, note: `Remark: ${remark}` };
                              const update = { ...t, status: "Closed", updated: nowISO, timeline: [...(t.timeline || []), newTimelineEvent] };
                              const apiUrl = isTrueWebcast(t) ? `${BASE_URL}/webcasts/${id}` : `${TICKETS_API}/${id}`;
                              await axios.put(apiUrl, update);
                            }
                          }
                          setTickets(p => p.map(x => selectedIds.has(x.id) ? { ...x, status: "Closed", updated: new Date(nowISO) } : x));
                          setSelectedIds(new Set());
                          setConfirmModal({ show: false });
                          setCustomAlert({ show: true, message: `✅ ${count} ticket(s) closed successfully`, type: "success" });
                        } catch (e) {
                          setCustomAlert({ show: true, message: "Failed to close tickets. Please try again.", type: "error" });
                        }
                      },
                      onCancel: () => setConfirmModal({ show: false })
                    });
                  }} style={{ ...bP, padding: "7px 13px", fontSize: 12, background: "#22c55e", color: "#fff" }}>✓ Close {selectedIds.size} Ticket(s)</button>
                )}

              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              {/* Select-all-filtered banner — shown when current page is fully selected but more exist */}
              {currentUser?.role === "Admin" && (() => {
                const pageIds = currentTickets.map(t => t.id);
                const allPageSelected = pageIds.length > 0 && pageIds.every(id => selectedIds.has(id));
                const allFilteredSelected = allSortedTickets.length > 0 && allSortedTickets.every(t => selectedIds.has(t.id));
                const hasMorePages = allSortedTickets.length > currentTickets.length;
                if (!allPageSelected || !hasMorePages) return null;
                return (
                  <div style={{ background: "#eff6ff", borderBottom: "1px solid #bfdbfe", padding: "9px 16px", display: "flex", alignItems: "center", gap: 12, fontSize: 13 }}>
                    {allFilteredSelected ? (
                      <>
                        <span style={{ color: "#1d4ed8", fontWeight: 600 }}>✓ All {allSortedTickets.length} tickets in this view are selected.</span>
                        <button onClick={() => setSelectedIds(new Set())} style={{ fontSize: 12, color: "#ef4444", fontWeight: 600, background: "none", border: "none", cursor: "pointer", padding: 0 }}>Clear selection</button>
                      </>
                    ) : (
                      <>
                        <span style={{ color: "#1d4ed8" }}>All <strong>{pageIds.length}</strong> tickets on this page are selected.</span>
                        <button onClick={toggleAllFiltered} style={{ fontSize: 12, color: "#1d4ed8", fontWeight: 700, background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}>
                          Select all {allSortedTickets.length} tickets in this view
                        </button>
                      </>
                    )}
                  </div>
                );
              })()}
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr style={{ background: "#f8fafc" }}>
                  {/* Checkbox column — Admin only: checks/unchecks current page */}
                  {currentUser?.role === "Admin" && (() => {
                    const pageIds = currentTickets.map(t => t.id);
                    const allPageSelected = pageIds.length > 0 && pageIds.every(id => selectedIds.has(id));
                    const somePageSelected = pageIds.some(id => selectedIds.has(id));
                    return (
                      <th style={{ ...thStyle, width: 40 }} title="Select / deselect this page">
                        <input
                          type="checkbox"
                          checked={allPageSelected}
                          ref={el => { if (el) el.indeterminate = !allPageSelected && somePageSelected; }}
                          onChange={toggleCurrentPage}
                          style={{ cursor: "pointer" }}
                        />
                      </th>
                    );
                  })()}
                  <FilterableHeader label="ID" field="id" data={filtered} filters={ticketSort} onFilter={setTicketSort} style={thStyle} />
                  <FilterableHeader label="Summary" field="summary" data={filtered} filters={ticketSort} onFilter={setTicketSort} style={thStyle} />
                  <FilterableHeader label="Org" field="org" data={filtered} filters={ticketSort} onFilter={setTicketSort} style={thStyle} />
                  <FilterableHeader label="Dept" field="department" data={filtered} filters={ticketSort} onFilter={setTicketSort} style={thStyle} />
                  <FilterableHeader label="Vendor" field="vendor" data={filtered} filters={ticketSort} onFilter={setTicketSort} style={thStyle} />
                  <FilterableHeader label="Reported By" field="reportedBy" data={filtered} filters={ticketSort} onFilter={setTicketSort} style={thStyle} />
                  <FilterableHeader label="Assignees" field="assignees" data={filtered} filters={ticketSort} onFilter={setTicketSort} style={thStyle} />
                  <FilterableHeader label="Priority" field="priority" data={filtered} filters={ticketSort} onFilter={setTicketSort} style={thStyle} />
                  <FilterableHeader label="Category" field="category" data={filtered} filters={ticketSort} onFilter={setTicketSort} style={thStyle} />
                  <FilterableHeader label="Status" field="status" data={filtered} filters={ticketSort} onFilter={setTicketSort} style={thStyle} />
                  <FilterableHeader label="Created" field="created" data={filtered} filters={ticketSort} onFilter={setTicketSort} style={thStyle} />
                  <th style={thStyle}>Action</th>
                </tr></thead>
                <tbody>{currentTickets.map(t => (
                  <tr key={t.id} className="rh" style={{ cursor: "pointer", background: selectedIds.has(t.id) ? "#eff6ff" : "#fff" }}>
                    {/* ✅ Checkboxes only for Admin */}
                    {currentUser?.role === "Admin" && (
                      <td style={tdStyle} onClick={e => e.stopPropagation()}><input type="checkbox" checked={selectedIds.has(t.id)} onChange={() => toggleSel(t.id)} style={{ cursor: "pointer" }} /></td>
                    )}
                    <td style={tdStyle} onClick={() => setSelTicket(t)}><span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11.5, color: "#3b82f6", fontWeight: 500 }}>{t.id}</span>{t.category === "Webcast" && <span style={{ marginLeft: 5, fontSize: 10, background: "#fff7ed", color: "#f97316", padding: "1px 5px", borderRadius: 4, fontWeight: 600 }}>📡</span>}</td>
                    <td style={{ ...tdStyle, maxWidth: 180 }} onClick={() => setSelTicket(t)}><div style={{ fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.summary}</div></td>
                    <td style={tdStyle} onClick={() => setSelTicket(t)}><div style={{ fontSize: 12, fontWeight: 500 }}>{t.org}</div></td>
                    <td style={tdStyle} onClick={() => setSelTicket(t)}><div style={{ fontSize: 12, color: "#64748b" }}>{t.department || "—"}</div></td>
                    <td style={tdStyle} onClick={() => setSelTicket(t)}><div style={{ fontSize: 12, color: "#64748b" }}>{t.vendor || "—"}</div></td>
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
                  { label: "Unassigned", value: dashboardProjects.filter(p => (!p.assignees || p.assignees.length === 0) && p.status !== "Closed").length, bg: "#f3e8ff", accent: "#a855f7", icon: "👤", action: () => { setPvFilter("unassigned"); } },
                  { label: "In Progress", value: projStats.inProgress, bg: "#ede9fe", accent: "#6366f1", icon: "⚙️", action: () => { setPvFilter("inprogress"); setProjStatusF("All"); setProjPriorityF("All"); } },
                  { label: "Critical", value: projStats.critical, bg: "#fee2e2", accent: "#ef4444", icon: "🔥", action: () => { setPvFilter("critical"); setProjStatusF("All"); setProjPriorityF("All"); } },
                  { label: "Closed", value: projStats.closed, bg: "#dcfce7", accent: "#22c55e", icon: "✅", action: () => { setPvFilter("closed"); setProjStatusF("All"); setProjPriorityF("All"); } },
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

            {/* Project action bar */}
            <div style={{ padding: "11px 14px", borderBottom: "1px solid #f1f5f9", display: "flex", gap: 9, alignItems: "center", flexWrap: "wrap" }}>
              <input placeholder="Search projects…" value={projSearch} onChange={e => setProjSearch(e.target.value)} style={{ ...iS, width: 200, fontSize: 13, padding: "7px 10px" }} />
              <span style={{ fontSize: 12, color: "#64748b" }}>{applySort(filteredProjects, projSort).length} projects</span>
              <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
                {selectedProjIds.size > 0 && <span style={{ fontSize: 12, color: "#3b82f6", fontWeight: 600, background: "#eff6ff", padding: "4px 10px", borderRadius: 99 }}>{selectedProjIds.size} selected</span>}
                {(currentUser?.role === "Admin" || currentUser?.role === "Manager") && <button onClick={() => setShowNewProject(true)} style={{ ...bP, padding: "7px 13px", fontSize: 13, background: "linear-gradient(135deg,#8b5cf6,#6366f1)" }}>+ New Project</button>}
              </div>
            </div>


            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr style={{ background: "#f8fafc" }}>
                  <th style={{ ...thStyle, width: 40 }}><input type="checkbox" checked={selectedProjIds.size === filteredProjects.length && filteredProjects.length > 0} onChange={toggleAllProj} style={{ cursor: "pointer" }} /></th>
                  <FilterableHeader label="ID" field="id" data={filteredProjects} filters={projSort} onFilter={setProjSort} style={thStyle} />
                  <FilterableHeader label="Title" field="title" data={filteredProjects} filters={projSort} onFilter={setProjSort} style={thStyle} />
                  <FilterableHeader label="Org" field="org" data={filteredProjects} filters={projSort} onFilter={setProjSort} style={thStyle} />
                  <FilterableHeader label="Dept" field="department" data={filteredProjects} filters={projSort} onFilter={setProjSort} style={thStyle} />
                  <FilterableHeader label="Assignees" field="assignees" data={filteredProjects} filters={projSort} onFilter={setProjSort} style={thStyle} />
                  <FilterableHeader label="Priority" field="priority" data={filteredProjects} filters={projSort} onFilter={setProjSort} style={thStyle} />
                  <FilterableHeader label="Category" field="category" data={filteredProjects} filters={projSort} onFilter={setProjSort} style={thStyle} />
                  <FilterableHeader label="Status" field="status" data={filteredProjects} filters={projSort} onFilter={setProjSort} style={thStyle} />
                  <FilterableHeader label="Progress" field="progress" data={filteredProjects} filters={projSort} onFilter={setProjSort} style={thStyle} />
                  <FilterableHeader label="Due Date" field="dueDate" data={filteredProjects} filters={projSort} onFilter={setProjSort} style={thStyle} />
                  <th style={thStyle}>Action</th>
                </tr></thead>
                <tbody>{applySort(filteredProjects, projSort).map(p => (
                  <tr key={p.id} className="rh" style={{ cursor: "pointer", background: selectedProjIds.has(p.id) ? "#f5f3ff" : "#fff" }}>
                    <td style={tdStyle} onClick={e => e.stopPropagation()}><input type="checkbox" checked={selectedProjIds.has(p.id)} onChange={() => toggleProjSel(p.id)} style={{ cursor: "pointer" }} /></td>
                    <td style={tdStyle} onClick={() => setSelProject(p)}><span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11.5, color: "#8b5cf6", fontWeight: 500 }}>{p.id}</span></td>
                    <td style={{ ...tdStyle, maxWidth: 180 }} onClick={() => setSelProject(p)}><div style={{ fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.title}</div></td>
                    <td style={tdStyle} onClick={() => setSelProject(p)}><div style={{ fontSize: 12, fontWeight: 500 }}>{p.org}</div></td>
                    <td style={tdStyle} onClick={() => setSelProject(p)}><div style={{ fontSize: 12, color: "#64748b" }}>{p.department || "—"}</div></td>
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
            {(() => {
              const isAdminOrManager = currentUser?.role === "Admin" || currentUser?.role === "Manager";
              const allWebcasts = tickets.filter(t => isTrueWebcast(t));
              const myWebcasts = allWebcasts.filter(t => t.assignees?.some(a => a.id === currentUser?.id));
              const webcastBase = isAdminOrManager ? allWebcasts : myWebcasts;
              return (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 9, marginBottom: 16 }}>
                  {[
                    { label: isAdminOrManager ? "Total Webcasts" : "My Webcasts", value: webcastBase.length, color: "#f97316", icon: "📡", filter: null },
                    { label: "Open", value: webcastBase.filter(t => t.status === "Open").length, color: "#3b82f6", icon: "📂", filter: "open" },
                    { label: "In Progress", value: webcastBase.filter(t => t.status === "In Progress").length, color: "#eab308", icon: "⚙️", filter: "inprogress" },
                    { label: "Closed", value: webcastBase.filter(t => t.status === "Closed").length, color: "#64748b", icon: "✅", filter: "closed" },
                    { label: "Critical", value: webcastBase.filter(t => t.priority === "Critical" && t.status !== "Closed").length, color: "#ef4444", icon: "🔥", filter: "critical" },
                    { label: "Unassigned", value: allWebcasts.filter(t => (!t.assignees || t.assignees.length === 0) && t.status !== "Closed").length, color: "#a855f7", icon: "🔸", filter: "unassigned" },
                  ].map(s => (
                    <div key={s.label} onClick={() => setWebcastFilter(webcastFilter === s.filter ? null : s.filter)} style={{ background: "#fff", borderRadius: 12, padding: "14px 16px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", borderTop: `3px solid ${s.color}`, cursor: "pointer", transition: "all 0.2s", transform: webcastFilter === s.filter ? "scale(1.05)" : "scale(1)", opacity: webcastFilter === s.filter ? 1 : 0.8 }}>
                      <div style={{ fontSize: 20, marginBottom: 5 }}>{s.icon}</div>
                      <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
                      <div style={{ fontSize: 11, color: "#64748b" }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Webcast Table - Only show tickets assigned to current user (or all for Admin) */}
            <div style={{ background: "#fff", borderRadius: 12, padding: 22, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 700 }}>{webcastFilter === "unassigned" ? "⚠️ Unassigned Webcast Tickets" : (currentUser?.role === "Admin" || currentUser?.role === "Manager") ? "All Webcast Tickets" : "My Webcast Tickets"}</h3>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr style={{ background: "#f8fafc" }}>
                    <FilterableHeader label="ID" field="id" data={tickets.filter(t => isTrueWebcast(t) && (t.assignees?.some(a => a.id === currentUser?.id) || currentUser?.role === "Admin" || currentUser?.role === "Manager"))} filters={webcastSort} onFilter={setWebcastSort} style={thStyle} />
                    <FilterableHeader label="Summary" field="summary" data={tickets.filter(t => isTrueWebcast(t) && (t.assignees?.some(a => a.id === currentUser?.id) || currentUser?.role === "Admin" || currentUser?.role === "Manager"))} filters={webcastSort} onFilter={setWebcastSort} style={thStyle} />
                    <FilterableHeader label="Location" field="location" data={tickets.filter(t => isTrueWebcast(t) && (t.assignees?.some(a => a.id === currentUser?.id) || currentUser?.role === "Admin" || currentUser?.role === "Manager"))} filters={webcastSort} onFilter={setWebcastSort} style={thStyle} />
                    <FilterableHeader label="Satsang Type" field="satsangType" data={tickets.filter(t => isTrueWebcast(t) && (t.assignees?.some(a => a.id === currentUser?.id) || currentUser?.role === "Admin" || currentUser?.role === "Manager"))} filters={webcastSort} onFilter={setWebcastSort} style={thStyle} />
                    <FilterableHeader label="Priority" field="priority" data={tickets.filter(t => isTrueWebcast(t) && (t.assignees?.some(a => a.id === currentUser?.id) || currentUser?.role === "Admin" || currentUser?.role === "Manager"))} filters={webcastSort} onFilter={setWebcastSort} style={thStyle} />
                    <FilterableHeader label="Status" field="status" data={tickets.filter(t => isTrueWebcast(t) && (t.assignees?.some(a => a.id === currentUser?.id) || currentUser?.role === "Admin" || currentUser?.role === "Manager"))} filters={webcastSort} onFilter={setWebcastSort} style={thStyle} />
                  </tr></thead>
                  <tbody>{applySort(tickets.filter(t => {
                    if (!isTrueWebcast(t)) return false;
                    if (webcastFilter === "unassigned") return (!t.assignees || t.assignees.length === 0) && t.status !== "Closed";
                    if (!t.assignees?.some(a => a.id === currentUser?.id) && currentUser?.role !== "Admin" && currentUser?.role !== "Manager") return false;
                    if (webcastFilter === null) return true;
                    if (webcastFilter === "open") return t.status === "Open";
                    if (webcastFilter === "inprogress") return t.status === "In Progress";
                    if (webcastFilter === "closed") return t.status === "Closed";
                    if (webcastFilter === "critical") return t.priority === "Critical" && t.status !== "Closed";
                    return true;
                  }), webcastSort).slice(0, 10).map((t, i) => (
                    <tr key={t.id + i} className="rh" onClick={() => setSelTicket(t)} style={{ cursor: "pointer" }}>
                      <td style={tdStyle}><span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11.5, color: "#3b82f6" }}>{t.id}</span></td>
                      <td style={{ ...tdStyle, maxWidth: 200 }}><div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.summary}</div></td>
                      <td style={tdStyle}><span style={{ fontSize: 12, color: "#64748b" }}>{t.location || "—"}</span></td>
                      <td style={tdStyle}><span style={{ fontSize: 12, color: "#64748b" }}>{t.satsangType || "—"}</span></td>
                      <td style={tdStyle}><div style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: PRIORITY_COLOR[t.priority], display: "inline-block" }} />{t.priority}</div></td>
                      <td style={tdStyle}><Badge label={t.status} style={{ ...STATUS_COLOR[t.status] }} /></td>
                    </tr>
                  ))}
                    {tickets.filter(t => isTrueWebcast(t) && (t.assignees?.some(a => a.id === currentUser?.id) || currentUser?.role === "Admin" || currentUser?.role === "Manager")).length === 0 && <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>No webcast tickets assigned to you yet.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </>}

          {/* ── REPORTS (v1 charts) ── */}
          {view === "reports" && <>
            {/* Advanced Export Button */}
            <div style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
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
                <BarChart data={(() => {
                  if (range === "1") {
                    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
                    return [
                      { label: "12am", start: 0, end: 4 }, { label: "4am", start: 4, end: 8 },
                      { label: "8am", start: 8, end: 12 }, { label: "12pm", start: 12, end: 16 },
                      { label: "4pm", start: 16, end: 20 }, { label: "8pm", start: 20, end: 24 },
                    ].map(slot => ({ label: slot.label, value: reportFilteredData.filter(t => { const d = t.created instanceof Date ? t.created : new Date(t.created); return d >= todayStart && d.getHours() >= slot.start && d.getHours() < slot.end; }).length }));
                  } else if (range === "7") {
                    return Array.from({ length: 7 }, (_, i) => { const d = new Date(now - (6 - i) * dayMs); return { label: d.toLocaleDateString("en", { weekday: "short" }), value: reportFilteredData.filter(t => { const td = t.created instanceof Date ? t.created : new Date(t.created); return td.getDate() === d.getDate() && td.getMonth() === d.getMonth() && td.getFullYear() === d.getFullYear(); }).length }; });
                  } else if (range === "30") {
                    return Array.from({ length: 4 }, (_, i) => { const wStart = new Date(now - (3 - i + 1) * 7 * dayMs); const wEnd = new Date(now - (3 - i) * 7 * dayMs); return { label: `W${i + 1}`, value: reportFilteredData.filter(t => { const td = t.created instanceof Date ? t.created : new Date(t.created); return td >= wStart && td < wEnd; }).length }; });
                  } else {
                    return Array.from({ length: 12 }, (_, i) => { const d = new Date(now); d.setMonth(d.getMonth() - (11 - i)); const yr = d.getFullYear(), mo = d.getMonth(); return { label: d.toLocaleDateString("en", { month: "short" }), value: reportFilteredData.filter(t => { const td = t.created instanceof Date ? t.created : new Date(t.created); return td.getFullYear() === yr && td.getMonth() === mo; }).length }; });
                  }
                })()} />
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
                  { label: "Regular Tickets", value: reportFilteredData.filter(t => !isTrueWebcast(t)).length, color: "#3b82f6" },
                  { label: "Webcasts", value: reportFilteredData.filter(t => isTrueWebcast(t)).length, color: "#f97316" }
                ]} />
              </div>
            </div>

            {/* Tickets Closed by Person + Agent Performance - Side by Side */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              {/* Tickets Closed by Person Table - Left */}
              <div style={{ background: "#fff", borderRadius: 12, padding: 18, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", display: "flex", flexDirection: "column" }}>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>Tickets Closed by Person</div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>Per agent during selected time period</div>
                </div>
                <div style={{ flex: 1, overflowY: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", position: "sticky", top: 0 }}>
                        <th style={{ padding: "10px 8px", textAlign: "left", fontWeight: 600, color: "#374151" }}>Agent</th>
                        <th style={{ padding: "10px 8px", textAlign: "right", fontWeight: 600, color: "#374151" }}>Closed</th>
                        <th style={{ padding: "10px 8px", textAlign: "right", fontWeight: 600, color: "#374151" }}>%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const agentMap = {};
                        reportFilteredData.forEach(t => {
                          if (t.status === "Closed") {
                            if (t.assignees && t.assignees.length > 0) {
                              t.assignees.forEach(a => {
                                if (!agentMap[a.id]) {
                                  agentMap[a.id] = { name: a.name, closed: 0 };
                                }
                                agentMap[a.id].closed += 1;
                              });
                            }
                          }
                        });
                        const agentData = Object.values(agentMap).sort((a, b) => b.closed - a.closed);
                        const total = agentData.reduce((sum, a) => sum + a.closed, 0);

                        if (agentData.length === 0) {
                          return <tr><td colSpan="3" style={{ padding: "16px", textAlign: "center", color: "#94a3b8" }}>No closed tickets</td></tr>;
                        }

                        return agentData.map((agent, i) => (
                          <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                            <td style={{ padding: "10px 8px", color: "#374151", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "200px" }} title={agent.name}>{agent.name}</td>
                            <td style={{ padding: "10px 8px", textAlign: "right", fontWeight: 600, color: "#22c55e" }}>{agent.closed}</td>
                            <td style={{ padding: "10px 8px", textAlign: "right", color: "#94a3b8" }}>{total > 0 ? ((agent.closed / total) * 100).toFixed(1) : 0}%</td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Agent Performance Chart - Right */}
              <div style={{ background: "#fff", borderRadius: 12, padding: 18, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>Agent Performance Overview</div>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>Assigned vs closed per agent</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}><div style={{ width: 10, height: 10, borderRadius: 2, background: "#3b82f6" }} /><span style={{ fontSize: 10, color: "#64748b" }}>Assigned</span></div>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}><div style={{ width: 10, height: 10, borderRadius: 2, background: "#22c55e" }} /><span style={{ fontSize: 10, color: "#64748b" }}>Closed</span></div>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}><div style={{ width: 10, height: 10, borderRadius: 2, background: "#f59e0b" }} /><span style={{ fontSize: 10, color: "#64748b" }}>Open</span></div>
                  </div>
                </div>
                {(() => {
                  const chartData = agentStats.filter(a => a.assigned > 0 || a.closed > 0);
                  if (chartData.length === 0) return <div style={{ textAlign: "center", color: "#94a3b8", padding: 32, fontSize: 13 }}>No agent data</div>;
                  const maxVal = Math.max(...chartData.map(a => a.assigned), 1);
                  const barH = 240;
                  // Adjust group width based on number of agents for readable names
                  const groupW = Math.max(80, Math.min(140, Math.floor(600 / chartData.length)));
                  const barW = Math.floor(groupW * 0.25);
                  const gap = Math.floor(groupW * 0.06);
                  const totalW = chartData.length * groupW + 60;
                  // Dynamic font size based on number of agents
                  const nameFontSize = chartData.length > 8 ? 7 : chartData.length > 5 ? 8 : 9;
                  return (
                    <div style={{ overflowX: "auto", display: "flex", justifyContent: "center" }}>
                      <svg width={Math.min(totalW, 700)} height={barH + 50} style={{ display: "block" }}>
                        {[0, 0.25, 0.5, 0.75, 1].map(p => {
                          const y = 10 + barH * (1 - p);
                          const val = Math.round(maxVal * p);
                          return (
                            <g key={p}>
                              <line x1={44} y1={y} x2={totalW - 10} y2={y} stroke="#f1f5f9" strokeWidth={1} />
                              <text x={38} y={y + 4} textAnchor="end" fontSize={8} fill="#94a3b8" fontFamily="DM Sans">{val}</text>
                            </g>
                          );
                        })}
                        {chartData.map((a, i) => {
                          const x = 50 + i * groupW;
                          const assignedH = Math.max(2, (a.assigned / maxVal) * barH);
                          const closedH = Math.max(a.closed > 0 ? 2 : 0, (a.closed / maxVal) * barH);
                          const openVal = Math.max(0, a.assigned - a.closed);
                          const openH = Math.max(openVal > 0 ? 2 : 0, (openVal / maxVal) * barH);
                          return (
                            <g key={a.id}>
                              <rect x={x} y={10 + barH - assignedH} width={barW} height={assignedH} fill="#3b82f6" rx={2} opacity={0.85} />
                              {a.assigned > 0 && <text x={x + barW / 2} y={10 + barH - assignedH - 2} textAnchor="middle" fontSize={8} fill="#3b82f6" fontWeight={600} fontFamily="DM Sans">{a.assigned}</text>}
                              <rect x={x + barW + gap} y={10 + barH - closedH} width={barW} height={closedH} fill="#22c55e" rx={2} opacity={0.85} />
                              {a.closed > 0 && <text x={x + barW + gap + barW / 2} y={10 + barH - closedH - 2} textAnchor="middle" fontSize={8} fill="#22c55e" fontWeight={600} fontFamily="DM Sans">{a.closed}</text>}
                              <rect x={x + (barW + gap) * 2} y={10 + barH - openH} width={barW} height={openH} fill="#f59e0b" rx={2} opacity={0.85} />
                              {openVal > 0 && <text x={x + (barW + gap) * 2 + barW / 2} y={10 + barH - openH - 2} textAnchor="middle" fontSize={8} fill="#f59e0b" fontWeight={600} fontFamily="DM Sans">{openVal}</text>}
                              <text x={x + barW + gap + barW / 2} y={10 + barH + 15} textAnchor="middle" fontSize={nameFontSize} fill="#374151" fontWeight={500} fontFamily="DM Sans">{a.name}</text>
                            </g>
                          );
                        })}
                        <line x1={44} y1={10 + barH} x2={totalW - 10} y2={10 + barH} stroke="#e2e8f0" strokeWidth={1.5} />
                      </svg>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Agent Performance Table */}
            <div style={{ background: "#fff", borderRadius: 12, padding: 18, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr>
                  <FilterableHeader label="Agent" field="name" data={agentStats} filters={agentSort} onFilter={setAgentSort} style={thStyle} />
                  <FilterableHeader label="Role" field="role" data={agentStats} filters={agentSort} onFilter={setAgentSort} style={thStyle} />
                  <th style={thStyle}>Assigned</th>
                  <th style={thStyle}>Closed</th>
                  <th style={thStyle}>Open</th>
                  <th style={{ ...thStyle, minWidth: 160 }}>Progress</th>
                </tr></thead>
                <tbody>{applySort(agentStats.map(a => ({ ...a, open: a.assigned - a.closed, rate: a.assigned ? Math.round(a.closed / a.assigned * 100) : 0 })), agentSort).map(a => {
                  const rate = a.rate ?? (a.assigned ? Math.round(a.closed / a.assigned * 100) : 0); return (
                    <tr key={a.id} className="rh">
                      <td style={tdStyle}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><Avatar name={a.name} size={26} /><div><div style={{ fontSize: 12, fontWeight: 600 }}>{a.name}</div><div style={{ fontSize: 11, color: "#94a3b8" }}>{a.email}</div></div></div></td>
                      <td style={tdStyle}><Badge label={a.role} style={{ background: "#ede9fe", color: "#6d28d9" }} /></td>
                      <td style={{ ...tdStyle, fontWeight: 700 }}>{a.assigned}</td>
                      <td style={{ ...tdStyle, color: "#22c55e", fontWeight: 700 }}>{a.closed}</td>
                      <td style={{ ...tdStyle, color: "#f59e0b", fontWeight: 700 }}>{a.assigned - a.closed}</td>
                      <td style={{ ...tdStyle, minWidth: 160 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ flex: 1, height: 10, background: "#f1f5f9", borderRadius: 99, overflow: "hidden", minWidth: 100 }}>
                            <div style={{ width: `${rate}%`, height: "100%", background: rate > 70 ? "#22c55e" : rate > 40 ? "#f59e0b" : "#ef4444", borderRadius: 99, transition: "width 0.4s ease" }} />
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 700, minWidth: 36, color: rate > 70 ? "#22c55e" : rate > 40 ? "#f59e0b" : "#ef4444" }}>{rate}%</span>
                        </div>
                      </td>
                    </tr>);
                })}</tbody>
              </table>
            </div>
          </>}

          {/* ── AGENTS ── */}
          {view === "users" && !selAgent ? (
            <>
              {/* ✅ NEW: User Statistics Boxes */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 20 }}>
                {[
                  { key: "all", icon: "👥", color: "#3b82f6", label: "Total Users", count: Array.isArray(users) ? users.length : 0 },
                  { key: "On Duty", icon: "🟢", color: "#22c55e", label: "On Duty", count: Array.isArray(users) ? users.filter(u => u.status === "On Duty").length : 0 },
                  { key: "On Ticket", icon: "🎫", color: "#6366f1", label: "On Ticket", count: Array.isArray(users) ? users.filter(u => u.status === "On Ticket").length : 0 },
                  { key: "Idle", icon: "🟣", color: "#a855f7", label: "Idle", count: Array.isArray(users) ? users.filter(u => u.status === "Idle").length : 0 },
                  { key: "On Lunch", icon: "🍽️", color: "#f97316", label: "On Lunch", count: Array.isArray(users) ? users.filter(u => u.status === "On Lunch").length : 0 },
                  { key: "off", icon: "⚪", color: "#f59e0b", label: "Off Duty", count: Array.isArray(users) ? users.filter(u => u.status !== "On Duty" && u.status !== "On Ticket" && u.status !== "Idle" && u.status !== "On Lunch").length : 0 },
                ].map(s => {
                  const isActive = agentStatusFilter === s.key;
                  return (
                    <div key={s.key}
                      onClick={() => setAgentStatusFilter(isActive ? "all" : s.key)}
                      style={{ background: isActive ? `${s.color}18` : "#fff", borderRadius: 12, padding: "16px 16px", boxShadow: isActive ? `0 0 0 2px ${s.color}` : "0 2px 6px rgba(0,0,0,0.1)", borderLeft: `5px solid ${s.color}`, transition: "all 0.2s ease", cursor: "pointer" }}
                      onMouseEnter={e => { e.currentTarget.style.boxShadow = isActive ? `0 0 0 2px ${s.color}` : "0 6px 20px rgba(0,0,0,0.15)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                      onMouseLeave={e => { e.currentTarget.style.boxShadow = isActive ? `0 0 0 2px ${s.color}` : "0 2px 6px rgba(0,0,0,0.1)"; e.currentTarget.style.transform = "translateY(0)"; }}>
                      <div style={{ fontSize: 20, marginBottom: 6 }}>{s.icon}</div>
                      <div style={{ fontSize: 32, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.count}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#1e293b", marginTop: 4 }}>
                        {s.label}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 12 }}>
                {agentStats.filter(a => {
                  if (agentStatusFilter === "all") return true;
                  const userStatus = users.find(u => u.id === a.id)?.status || "Off Duty";
                  if (agentStatusFilter === "off") return userStatus !== "On Duty" && userStatus !== "On Ticket" && userStatus !== "Idle" && userStatus !== "On Lunch";
                  return userStatus === agentStatusFilter;
                }).map(a => {
                  const userInfo = users.find(u => u.id === a.id);
                  return (
                    <div key={a.id} style={{ background: "#fff", borderRadius: 12, padding: 18, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", transition: "all 0.2s", border: "1.5px solid transparent" }}
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
                              const statusValue = rawStatus || "Off Duty";
                              const statusStyle = statusOpts.find(s => s.l === statusValue);
                              if (statusStyle) {
                                return <Badge label={statusStyle.l} style={{ background: statusStyle.bg, color: statusStyle.c }} />;
                              }
                              return <Badge label="Off Duty" style={{ background: "#fef3c7", color: "#f59e0b" }} />;
                            })()}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 7, marginBottom: 12 }}>
                        {[{ l: "Assigned", v: a.assigned, c: "#3b82f6" }, { l: "Closed", v: a.closed, c: "#22c55e" }, { l: "Open", v: a.assigned - a.closed, c: "#f59e0b" }].map(s => (
                          <div key={s.l} style={{ textAlign: "center", padding: "8px 4px", background: "#f8fafc", borderRadius: 8 }}><div style={{ fontSize: 17, fontWeight: 700, color: s.c }}>{s.v}</div><div style={{ fontSize: 10, color: "#94a3b8" }}>{s.l}</div></div>
                        ))}
                      </div>

                      {/* Closure rate progress bar */}
                      {(() => {
                        const rate = a.assigned ? Math.round(a.closed / a.assigned * 100) : 0;
                        const barColor = rate > 70 ? "#22c55e" : rate > 40 ? "#f59e0b" : "#ef4444";
                        return (
                          <div style={{ marginBottom: 12 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                              <span style={{ fontSize: 10, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>Closure Rate</span>
                              <span style={{ fontSize: 12, fontWeight: 700, color: barColor }}>{rate}%</span>
                            </div>
                            <div style={{ height: 7, background: "#f1f5f9", borderRadius: 99, overflow: "hidden" }}>
                              <div style={{ width: `${rate}%`, height: "100%", background: barColor, borderRadius: 99, transition: "width 0.4s ease" }} />
                            </div>
                          </div>
                        );
                      })()}

                      {/* ✅ NEW: View and Manage buttons only */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <button
                          onClick={() => setSelAgent(a)}
                          style={{ padding: "6px 10px", background: "#dbeafe", color: "#1e40af", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
                          👁️ View
                        </button>
                        <button
                          onClick={() => { setUserEditModal({ show: true, user: userInfo, newRole: userInfo?.role }); }}
                          style={{ padding: "6px 10px", background: "#f0fdf4", color: "#15803d", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
                          ⚙️ Manage
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : view === "users" && selAgent ? <div>
            <button onClick={() => setSelAgent(null)} style={{ ...bG, padding: "7px 14px", marginBottom: 14, fontSize: 12 }}>← Back to Agents</button>
            <div style={{ background: "#fff", borderRadius: 12, padding: 18, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 16, justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <Avatar name={selAgent.name} size={56} />
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>{selAgent.name}</div>
                    <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>{selAgent.email}</div>
                    <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                      <Badge label={selAgent.role} style={{ background: "#ede9fe", color: "#6d28d9" }} />
                      {(() => {
                        const u = users.find(x => x.id === selAgent.id);
                        if (!u?.status) return null;
                        const statusValue = u.status || "Off Duty";
                        const sStyle = statusOpts.find(s => s.l === statusValue);
                        return sStyle ? <Badge label={sStyle.l} style={{ background: sStyle.bg, color: sStyle.c }} /> : null;
                      })()}
                    </div>

                    {/* ✅ Show ticket and location tracking - AGENTS ONLY */}
                    {selAgent.role === "Agent" && (
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #e2e8f0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", marginBottom: 4 }}>🎫 Current Ticket</div>
                          {users.find(x => x.id === selAgent.id)?.currentTicketId ? (
                            <Badge label={users.find(x => x.id === selAgent.id)?.currentTicketId} style={{ background: "#ede9fe", color: "#6d28d9" }} />
                          ) : (
                            <span style={{ fontSize: 12, color: "#cbd5e1" }}>No ticket assigned</span>
                          )}
                        </div>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", marginBottom: 4 }}>📍 Current Location</div>
                          {users.find(x => x.id === selAgent.id)?.currentLocation ? (
                            <Badge label={users.find(x => x.id === selAgent.id)?.currentLocation} style={{ background: "#dcfce7", color: "#15803d" }} />
                          ) : (
                            <span style={{ fontSize: 12, color: "#cbd5e1" }}>No location set</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* ✅ Update button for agents only */}
                {selAgent.role === "Agent" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <button onClick={() => {
                      setCurrentTicketId(users.find(x => x.id === selAgent.id)?.currentTicketId || "");
                      setCurrentLocation(users.find(x => x.id === selAgent.id)?.currentLocation || "");
                      setShowLocationModal(true);
                    }} style={{ padding: "8px 16px", background: "#3b82f6", border: "none", borderRadius: 6, color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 12, whiteSpace: "nowrap" }}>✏️ Update Activity</button>
                    {/* ✅ NEW: Assign as Idle button for Admin/Manager */}
                    {(currentUser?.role === "Admin" || currentUser?.role === "Manager") && (
                      <button
                        onClick={async () => {
                          try {
                            const updatedUser = { ...selAgent, status: "Idle" };
                            await axios.put(`${USERS_API}/${selAgent.id}`, updatedUser);
                            setUsers(users.map(u => u.id === selAgent.id ? updatedUser : u));
                            setSelAgent(updatedUser);
                            setCustomAlert({ show: true, message: "✅ Agent assigned as Idle", type: "success" });
                          } catch (e) {
                            setCustomAlert({ show: true, message: "Failed to update agent status", type: "error" });
                          }
                        }}
                        style={{ padding: "8px 16px", background: "#22c55e", border: "none", borderRadius: 6, color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 12, whiteSpace: "nowrap", transition: "background 0.2s" }}
                        onMouseOver={e => e.target.style.background = "#16a34a"}
                        onMouseOut={e => e.target.style.background = "#22c55e"}
                      >⏸️ Assign as Idle</button>
                    )}
                  </div>
                )}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
                {[
                  { l: "All", v: selAgent.assigned, c: "#94a3b8", filter: null, bg: "#f1f5f9" },
                  { l: "Assigned", v: selAgent.assigned, c: "#3b82f6", filter: "assigned", bg: "#dbeafe" },
                  { l: "Closed", v: selAgent.closed, c: "#22c55e", filter: "closed", bg: "#dcfce7" },
                  { l: "Open", v: selAgent.assigned - selAgent.closed, c: "#f59e0b", filter: "open", bg: "#fef3c7" }
                ].map(s => (
                  <div
                    key={s.l}
                    onClick={() => setAgentTicketFilter(s.filter)}
                    style={{
                      textAlign: "center",
                      padding: "12px 8px",
                      background: agentTicketFilter === s.filter ? s.bg : "#f8fafc",
                      borderRadius: 10,
                      border: agentTicketFilter === s.filter ? `2px solid ${s.c}` : "2px solid transparent",
                      cursor: "pointer",
                      transition: "all 0.2s"
                    }}
                    onMouseEnter={e => { if (agentTicketFilter !== s.filter) { e.currentTarget.style.background = "#f0f0f0"; } }}
                    onMouseLeave={e => { if (agentTicketFilter !== s.filter) { e.currentTarget.style.background = "#f8fafc"; } }}
                  >
                    <div style={{ fontSize: 22, fontWeight: 700, color: s.c }}>{s.v}</div>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{s.l}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: "#fff", borderRadius: 12, padding: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14, color: "#374151" }}>Assigned Tickets</div>
              {tickets.filter(t => t.assignees?.some(a => a.id === selAgent.id)).length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {tickets.filter(t => {
                    if (!t.assignees?.some(a => a.id === selAgent.id)) return false;
                    if (agentTicketFilter === null) return true;
                    if (agentTicketFilter === "assigned") return t.status === "Open" || t.status === "In Progress";
                    if (agentTicketFilter === "closed") return t.status === "Closed";
                    if (agentTicketFilter === "open") return t.status === "Open" || t.status === "In Progress";
                    return true;
                  }).map(t => {
                    return (
                      <div key={t.id} onClick={() => { setSelTicket(t); setSelAgent(null); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px", borderRadius: 9, border: "1px solid #f1f5f9", cursor: "pointer", transition: "all 0.2s", background: "#fff" }}
                        onMouseEnter={e => { e.currentTarget.style.background = "#f8fafc"; e.currentTarget.style.borderColor = "#3b82f6"; e.currentTarget.style.transform = "translateX(4px)"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.borderColor = "#f1f5f9"; e.currentTarget.style.transform = "translateX(0)"; }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{t.summary}</div>
                          <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{t.id} · {t.org}</div>
                        </div>
                        <Badge label={t.status} style={{ ...STATUS_COLOR[t.status], fontSize: 11 }} />
                      </div>
                    );
                  })}
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
                {TICKET_VIEWS.filter(v => v.id !== "unassigned" || currentUser?.role === "Admin" || currentUser?.role === "Manager").map(v => (
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
                  <thead><tr>
                    <FilterableHeader label="Name" field="name" data={orgs} filters={orgSort} onFilter={setOrgSort} style={thStyle} />
                    <FilterableHeader label="Domain" field="domain" data={orgs} filters={orgSort} onFilter={setOrgSort} style={thStyle} />
                    <FilterableHeader label="Phone" field="phone" data={orgs} filters={orgSort} onFilter={setOrgSort} style={thStyle} />
                    {currentUser?.role === "Admin" && <th style={thStyle}></th>}
                  </tr></thead>
                  <tbody>{applySort(orgs, orgSort).map(o => <tr key={o.id} className="rh">
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{o.name}</td>
                    <td style={{ ...tdStyle, color: "#64748b" }}>{o.domain || "—"}</td>
                    <td style={{ ...tdStyle, color: "#64748b" }}>{o.phone || "—"}</td>
                    {currentUser?.role === "Admin" && <td style={tdStyle}><button onClick={() => {
                      setConfirmModal({
                        show: true, title: "Delete Organisation",
                        confirmLabel: "Delete", confirmDanger: true, message: `Are you sure you want to delete "${o.name}"?`, onConfirm: async () => { try { await axios.delete(`${ORGS_API}/${o.id}`); setOrgs(orgs.filter(x => x.id !== o.id)); setCustomAlert({ show: true, message: "✅ Organisation deleted!", type: "success" }); } catch (err) { setCustomAlert({ show: true, message: "Failed to delete organisation", type: "error" }); } setConfirmModal({ show: false, title: "", message: "", onConfirm: null, onCancel: null }); }, onCancel: () => setConfirmModal({ show: false, title: "", message: "", onConfirm: null, onCancel: null })
                      });
                    }} style={{ border: "none", background: "#fee2e2", color: "#ef4444", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Delete</button></td>}
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
                <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 8, justifyItems: "stretch" }}>
                  {[...categories].sort((a, b) => (a.name || "").localeCompare(b.name || "")).map(c => {
                    const lightColor = c.color + "20";
                    return (
                      <div key={c.id} style={{ padding: 8, borderRadius: 6, background: lightColor, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, cursor: currentUser?.role === "Admin" ? "pointer" : "default", transition: "all 0.2s ease", textAlign: "center", transform: "scale(1)" }} onMouseEnter={e => { if (currentUser?.role === "Admin") { e.currentTarget.style.transform = "scale(1.08)"; e.currentTarget.style.boxShadow = "0 6px 16px rgba(0,0,0,0.12)"; } }} onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "none"; }}>
                        <div style={{ width: 10, height: 10, borderRadius: 2, background: c.color, flexShrink: 0 }} />
                        <div style={{ fontSize: 11, fontWeight: 600, wordBreak: "break-word", flex: 1, color: "#1f2937" }}>{c.name}</div>
                        <div style={{ fontSize: 9, color: "#6b7280" }}>{tickets.filter(t => t.category === c.name).length}</div>
                        {currentUser?.role === "Admin" && <button onClick={e => { e.stopPropagation(); deleteCat(c.id); }} style={{ border: "none", background: "rgba(0,0,0,0.08)", color: "#374151", borderRadius: 3, padding: "2px 6px", cursor: "pointer", fontSize: 9, fontWeight: 600 }}>Delete</button>}
                      </div>
                    );
                  })}
                </div>
              </div>}
              {/* ✅ Departments Management — org-grouped */}
              {settingsTab === "departments" && <div style={{ background: "#fff", borderRadius: 12, padding: 22, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700 }}>Departments ({departments.length})</h3>
                <p style={{ margin: "0 0 18px", fontSize: 12, color: "#64748b" }}>Departments are organised per organisation. Same name is allowed under different orgs. Drag a department to reorder within an org, or drop it onto a different org header to move it.</p>
                {currentUser?.role === "Admin" ? (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 9, marginBottom: 18, padding: 14, background: "#f8fafc", borderRadius: 9 }}>
                    <input
                      style={iS}
                      placeholder="Department name *"
                      value={newDept?.name || ""}
                      onChange={e => setNewDept({ ...newDept, name: e.target.value })}
                    />
                    <select
                      style={{ ...sS }}
                      value={newDept?.orgName || ""}
                      onChange={e => setNewDept({ ...newDept, orgName: e.target.value })}
                    >
                      <option value="">Select organisation *</option>
                      {[...orgs].sort((a, b) => a.name.localeCompare(b.name)).map(o => (
                        <option key={o.id} value={o.name}>{o.name}</option>
                      ))}
                    </select>
                    <button onClick={addDept} style={bP}>Add</button>
                  </div>
                ) : <div style={{ marginBottom: 18, padding: "10px 14px", background: "#fef3c7", color: "#92400e", borderRadius: 8, fontSize: 13, fontWeight: 500 }}>Read Only: Department management is restricted to Admins.</div>}

                {/* Group departments by org */}
                {(() => {
                  const grouped = {};
                  const deptSource = pendingDepartments.length > 0 ? pendingDepartments : departments;
                  [...deptSource].forEach(d => {
                    const org = d.orgName || "General";
                    if (!grouped[org]) grouped[org] = [];
                    grouped[org].push(d);
                  });
                  Object.keys(grouped).forEach(org => grouped[org].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)));
                  // Also show orgs that have no departments yet (so you can drag into them)
                  orgs.forEach(o => { if (!grouped[o.name]) grouped[o.name] = []; });
                  const orgNames = Object.keys(grouped).sort();

                  return (
                    <>
                      {/* Save Changes Button - Top */}
                      {pendingDepartments.length > 0 && (
                        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                          <button onClick={async () => {
                            try {
                              const orders = [];
                              const grouped = {};
                              pendingDepartments.forEach(d => {
                                const org = d.orgName || "General";
                                if (!grouped[org]) grouped[org] = [];
                                grouped[org].push(d);
                              });
                              Object.keys(grouped).forEach(org => {
                                grouped[org].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
                                grouped[org].forEach((d, i) => {
                                  orders.push({ id: d.id, orgName: d.orgName, sortOrder: i + 1 });
                                });
                              });
                              await axios.put(`${BASE_URL}/departments/reorder`, { orders });
                              setDepartments(pendingDepartments);
                              setPendingDepartments([]);
                              setCustomAlert({ show: true, message: "✅ Departments updated successfully", type: "success" });
                            } catch {
                              setCustomAlert({ show: true, message: "Failed to save changes", type: "error" });
                            }
                          }} style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: "#22c55e", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "'DM Sans',sans-serif" }}>💾 Save Changes</button>
                          <button onClick={() => setPendingDepartments([])} style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #e2e8f0", background: "#fff", color: "#64748b", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "'DM Sans',sans-serif" }}>Cancel</button>
                        </div>
                      )}
                      {orgNames.map(orgName => (
                        <div key={orgName} style={{ marginBottom: 20 }}
                          onDragOver={e => e.preventDefault()}
                          onDrop={e => {
                            e.preventDefault();
                            const raw = e.dataTransfer.getData("text/plain");
                            if (!raw) return;
                            const src = JSON.parse(raw);
                            if (src.orgName === orgName) return; // same org, skip
                            // Move department to this org (in pending state)
                            const updated = (pendingDepartments.length > 0 ? pendingDepartments : departments).map(d => d.id === src.id ? { ...d, orgName } : d);
                            setPendingDepartments(updated);
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, padding: "6px 10px", background: "#f8fafc", borderRadius: 8, border: "1.5px dashed #e2e8f0" }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>🏢 {orgName}</span>
                            <span style={{ fontSize: 11, color: "#94a3b8", background: "#f1f5f9", borderRadius: 99, padding: "2px 8px" }}>{grouped[orgName].length}</span>
                            {currentUser?.role === "Admin" && <span style={{ fontSize: 10, color: "#94a3b8", marginLeft: "auto" }}>Drop here to move</span>}
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, minHeight: 36, padding: "4px 6px", borderRadius: 8, border: grouped[orgName].length === 0 ? "1.5px dashed #e2e8f0" : "none", background: grouped[orgName].length === 0 ? "#fafafa" : "transparent" }}>
                            {grouped[orgName].length === 0 && <span style={{ fontSize: 11, color: "#cbd5e1", alignSelf: "center" }}>No departments — drag one here</span>}
                            {grouped[orgName].map((d, idx) => {
                              const color = getItemColor(d);
                              return (
                                <div
                                  key={d.id}
                                  draggable={currentUser?.role === "Admin"}
                                  onDragStart={e => { e.stopPropagation(); e.dataTransfer.setData("text/plain", JSON.stringify({ id: d.id, orgName, idx })); }}
                                  onDragOver={e => e.preventDefault()}
                                  onDrop={e => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const raw = e.dataTransfer.getData("text/plain");
                                    if (!raw) return;
                                    const src = JSON.parse(raw);
                                    if (src.orgName !== orgName || src.id === d.id) return;
                                    // Reorder within same org (in pending state)
                                    const grp = [...grouped[orgName]];
                                    const fromIdx = grp.findIndex(x => x.id === src.id);
                                    const toIdx = idx;
                                    if (fromIdx === toIdx) return;
                                    const moved = grp.splice(fromIdx, 1)[0];
                                    grp.splice(toIdx, 0, moved);
                                    const orders = grp.map((x, i) => ({ id: x.id, sortOrder: i + 1 }));
                                    const deptSource = pendingDepartments.length > 0 ? pendingDepartments : departments;
                                    const updated = deptSource.map(dep => {
                                      const o = orders.find(x => x.id === dep.id);
                                      return o && dep.orgName === orgName ? { ...dep, sortOrder: o.sortOrder } : dep;
                                    });
                                    setPendingDepartments(updated);
                                  }}
                                  style={{ padding: "6px 10px", borderRadius: 8, background: color + "20", border: `1.5px solid ${color}40`, display: "flex", alignItems: "center", gap: 6, cursor: currentUser?.role === "Admin" ? "grab" : "default", transition: "all 0.15s", userSelect: "none" }}
                                  onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 3px 10px ${color}40`; }}
                                  onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; }}
                                >
                                  <div style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
                                  <span style={{ fontSize: 12, fontWeight: 600, color: "#1f2937" }}>{d.name}</span>
                                  {currentUser?.role === "Admin" && (
                                    <button onClick={e => { e.stopPropagation(); deleteDept(d.id); }} style={{ border: "none", background: "transparent", color: "#94a3b8", cursor: "pointer", fontSize: 13, fontWeight: 700, lineHeight: 1, padding: "0 2px" }}>×</button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </>
                  );
                })()}
                {departments.length === 0 && orgs.length === 0 && <div style={{ textAlign: "center", color: "#94a3b8", padding: 28 }}>No organisations yet. Add an organisation first, then add departments.</div>}
              </div>}
              {/* ✅ NEW: Locations Management */}
              {settingsTab === "locations" && <div style={{ background: "#fff", borderRadius: 12, padding: 22, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700 }}>Locations ({locations.length})</h3>
                <p style={{ margin: "0 0 18px", fontSize: 12, color: "#64748b" }}>Manage ticket and project locations/venues.</p>
                {currentUser?.role === "Admin" ? (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 9, marginBottom: 18, padding: 14, background: "#f8fafc", borderRadius: 9 }}>
                    <input
                      style={iS}
                      placeholder="Location name *"
                      value={newLocation?.name || ""}
                      onChange={e => setNewLocation({ name: e.target.value })}
                    />
                    <button onClick={addLocation} style={bP}>Add</button>
                  </div>
                ) : <div style={{ marginBottom: 18, padding: "10px 14px", background: "#fef3c7", color: "#92400e", borderRadius: 8, fontSize: 13, fontWeight: 500 }}>Read Only: Adding or removing locations is restricted to Admins.</div>}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 8, justifyItems: "stretch" }}>
                  {[...locations].sort((a, b) => (a.name || "").localeCompare(b.name || "")).map(l => {
                    const color = getItemColor(l);
                    const lightColor = color + "20";
                    return (
                      <div key={l.id} style={{ padding: 8, borderRadius: 6, background: lightColor, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, cursor: currentUser?.role === "Admin" ? "pointer" : "default", transition: "all 0.2s ease", textAlign: "center", transform: "scale(1)" }} onMouseEnter={e => { if (currentUser?.role === "Admin") { e.currentTarget.style.transform = "scale(1.08)"; e.currentTarget.style.boxShadow = "0 6px 16px rgba(0,0,0,0.12)"; } }} onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "none"; }}>
                        <div style={{ fontSize: 14 }}>📍</div>
                        <div style={{ fontSize: 11, fontWeight: 600, wordBreak: "break-word", flex: 1, color: "#1f2937" }}>{l.name}</div>
                        {currentUser?.role === "Admin" && <button onClick={e => { e.stopPropagation(); deleteLocation(l.id); }} style={{ border: "none", background: "rgba(0,0,0,0.08)", color: "#374151", borderRadius: 3, padding: "2px 6px", cursor: "pointer", fontSize: 9, fontWeight: 600 }}>Delete</button>}
                      </div>
                    );
                  })}
                </div>
                {locations.length === 0 && <div style={{ textAlign: "center", color: "#94a3b8", padding: 28 }}>No locations yet. Add one to get started.</div>}
              </div>}

              {/* ✅ NEW: Satsang Types Management */}
              {settingsTab === "satsangtypes" && <div style={{ background: "#fff", borderRadius: 12, padding: 22, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700 }}>📡 Satsang Types ({satsangTypes.length})</h3>
                <p style={{ margin: "0 0 18px", fontSize: 12, color: "#64748b" }}>Manage webcast satsang types for ticket creation.</p>
                {currentUser?.role === "Admin" ? (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 9, marginBottom: 18, padding: 14, background: "#f8fafc", borderRadius: 9 }}>
                    <input
                      style={iS}
                      placeholder="New satsang type name *"
                      value={newSatsangType}
                      onChange={e => setNewSatsangType(e.target.value)}
                      onKeyPress={e => e.key === "Enter" && newSatsangType.trim() && addSatsangType()}
                    />
                    <button onClick={addSatsangType} style={bP}>Add</button>
                  </div>
                ) : <div style={{ marginBottom: 18, padding: "10px 14px", background: "#fef3c7", color: "#92400e", borderRadius: 8, fontSize: 13, fontWeight: 500 }}>Read Only: Adding or removing satsang types is restricted to Admins.</div>}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8, justifyItems: "stretch" }}>
                  {satsangTypes.sort().map(t => (
                    <div key={t} style={{ padding: 12, borderRadius: 6, background: "#f0f7ff", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, cursor: currentUser?.role === "Admin" ? "pointer" : "default", transition: "all 0.2s ease", textAlign: "center", transform: "scale(1)", border: "1px solid #bfdbfe" }} onMouseEnter={e => { if (currentUser?.role === "Admin") { e.currentTarget.style.transform = "scale(1.08)"; e.currentTarget.style.boxShadow = "0 6px 16px rgba(0,0,0,0.12)"; } }} onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "none"; }}>
                      <div style={{ fontSize: 16 }}>📡</div>
                      <div style={{ fontSize: 12, fontWeight: 600, wordBreak: "break-word", flex: 1, color: "#1f2937" }}>{t}</div>
                      {currentUser?.role === "Admin" && <button onClick={e => { e.stopPropagation(); deleteSatsangType(t); }} style={{ border: "none", background: "#fee2e2", color: "#dc2626", borderRadius: 3, padding: "3px 8px", cursor: "pointer", fontSize: 10, fontWeight: 600 }}>Remove</button>}
                    </div>
                  ))}
                </div>
                {satsangTypes.length === 0 && <div style={{ textAlign: "center", color: "#94a3b8", padding: 28 }}>No satsang types yet. Add one to get started.</div>}
              </div>}
              {settingsTab === "vendors" && <div style={{ background: "#fff", borderRadius: 12, padding: 22, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700 }}>🏭 Vendors ({vendors.length})</h3>
                <p style={{ margin: "0 0 18px", fontSize: 12, color: "#64748b" }}>Manage vendors with contact information for sending tickets.</p>
                {currentUser?.role === "Admin" ? (
                  <div style={{ marginBottom: 18, display: "flex", justifyContent: "flex-end" }}>
                    <button onClick={() => { setShowAddVendorModal(true); setNewVendor({ name: "", email: "", phone: "", address: "" }); }} style={{ ...bP, padding: "10px 20px", fontSize: 13, background: "linear-gradient(135deg,#3b82f6,#1e40af)", color: "#fff" }}>+ Add New Vendor</button>
                  </div>
                ) : <div style={{ marginBottom: 18, padding: "10px 14px", background: "#fef3c7", color: "#92400e", borderRadius: 8, fontSize: 13, fontWeight: 500 }}>Read Only: Adding or removing vendors is restricted to Admins.</div>}

                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr>
                    <FilterableHeader label="Name" field="name" data={vendors} filters={vendorSort} onFilter={setVendorSort} style={thStyle} />
                    <FilterableHeader label="Email" field="email" data={vendors} filters={vendorSort} onFilter={setVendorSort} style={thStyle} />
                    <FilterableHeader label="Phone" field="phone" data={vendors} filters={vendorSort} onFilter={setVendorSort} style={thStyle} />
                    <FilterableHeader label="Address" field="address" data={vendors} filters={vendorSort} onFilter={setVendorSort} style={thStyle} />
                    {currentUser?.role === "Admin" && <th style={thStyle}></th>}
                  </tr></thead>
                  <tbody>{applySort(vendors, vendorSort).map(v => (
                    <tr key={v.id} className="rh">
                      <td style={tdStyle}><span style={{ fontSize: 13, fontWeight: 700, color: "#ea580c" }}>🏭 {v.name}</span></td>
                      <td style={{ ...tdStyle, color: "#64748b", fontSize: 12 }}>{v.email || "—"}</td>
                      <td style={{ ...tdStyle, color: "#64748b", fontSize: 12 }}>{v.phone || "—"}</td>
                      <td style={{ ...tdStyle, color: "#64748b", fontSize: 12, maxWidth: 200 }}><div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v.address || "—"}</div></td>
                      {currentUser?.role === "Admin" && <td style={tdStyle}><button onClick={() => deleteVendor(v.id)} style={{ border: "none", background: "#fee2e2", color: "#ef4444", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Delete</button></td>}
                    </tr>
                  ))}</tbody>
                </table>
                {vendors.length === 0 && <div style={{ textAlign: "center", color: "#94a3b8", padding: 28 }}>No vendors yet. Add one to get started.</div>}
              </div>}

              {settingsTab === "usermgmt" && <div style={{ background: "#fff", borderRadius: 12, padding: 22, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 700 }}>User Management ({users.length} users)</h3>
                {(currentUser?.role === "Admin") ? (
                  <div style={{ marginBottom: 18, display: "flex", justifyContent: "flex-end" }}>
                    <button onClick={() => { setShowAddUserModal(true); setNewUser({ name: "", email: "", password: "", role: "Viewer" }); }} style={{ ...bP, padding: "10px 20px", fontSize: 13, background: "linear-gradient(135deg,#3b82f6,#1e40af)", color: "#fff" }}>+ Add New User</button>
                  </div>
                ) : currentUser?.role === "Manager" ? (
                  <div style={{ marginBottom: 18, padding: "10px 14px", background: "#fef3c7", color: "#92400e", borderRadius: 8, fontSize: 13, fontWeight: 500 }}>View Only: Managers can view users but cannot add, delete, or change roles.</div>
                ) : (
                  <div style={{ marginBottom: 18, padding: "10px 14px", background: "#fef3c7", color: "#92400e", borderRadius: 8, fontSize: 13, fontWeight: 500 }}>Read Only: User management is restricted to Admins.</div>
                )}
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr>
                    <FilterableHeader label="User" field="name" data={users} filters={userSort} onFilter={setUserSort} style={thStyle} />
                    <FilterableHeader label="Email" field="email" data={users} filters={userSort} onFilter={setUserSort} style={thStyle} />
                    <FilterableHeader label="Role" field="role" data={users} filters={userSort} onFilter={setUserSort} style={thStyle} />
                    <FilterableHeader label="Status" field="status" data={users} filters={userSort} onFilter={setUserSort} style={thStyle} />
                    <FilterableHeader label="Account Status" field="active" data={users} filters={userSort} onFilter={setUserSort} style={thStyle} getVal={(row, f) => row.active ? "Activated" : "Deactivated"} />
                    {(currentUser?.role === "Admin") && <th style={thStyle}>Actions</th>}
                  </tr></thead>
                  <tbody>{applySort(users, userSort).map(u => (
                    <tr key={u.id} className="rh">
                      <td style={tdStyle}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><Avatar name={u.name} size={28} /><span style={{ fontSize: 13, fontWeight: 600 }}>{u.name}</span></div></td>
                      <td style={{ ...tdStyle, color: "#64748b", fontSize: 12 }}>{u.email}</td>
                      <td style={tdStyle}><Badge label={u.role} style={{ background: "#ede9fe", color: "#6d28d9" }} /></td>
                      <td style={tdStyle}>{(() => {
                        // Check DB status field which is updated on login/logout
                        const statusValue = u.status || "Off Duty";
                        const sStyle = statusOpts.find(s => s.l === statusValue);
                        // ✅ Always show a badge - default to Off Duty if not found
                        if (sStyle) {
                          return <Badge label={sStyle.l} style={{ background: sStyle.bg, color: sStyle.c }} />;
                        }
                        // If no matching status, show Off Duty as fallback
                        return <Badge label="Off Duty" style={{ background: "#fef3c7", color: "#f59e0b" }} />;
                      })()}</td>
                      <td style={tdStyle}><Badge label={u.active ? "Activated" : "Deactivated"} style={{ background: u.active ? "#dcfce7" : "#fee2e2", color: u.active ? "#15803d" : "#ef4444" }} /></td>
                      {(currentUser?.role === "Admin") && (() => {
                        // Admins can edit users via the Manage modal
                        return (
                          <td style={tdStyle}><div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            <button onClick={() => { setUserEditModal({ show: true, user: u, newRole: u.role }); }} style={{ border: "none", background: "#dbeafe", color: "#1e40af", borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>⚙️ Manage</button>
                          </div></td>
                        );
                      })()}
                    </tr>
                  ))}</tbody>
                </table>
              </div>}
              {settingsTab === "customattrs" && <div style={{ background: "#fff", borderRadius: 12, padding: 22, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700 }}>Custom Attributes</h3>
                <p style={{ margin: "0 0 14px", fontSize: 12, color: "#64748b" }}>Add custom fields to the New Ticket form. After adding, configure placement in the layout designer.</p>

                {currentUser?.role === "Admin" ? (
                  <div style={{ marginBottom: 18, padding: 14, background: "#f8fafc", borderRadius: 10, border: "1.5px solid #e2e8f0" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#374151", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.04em" }}>Add New Field</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 1fr auto auto", gap: 8, alignItems: "end" }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 4 }}>Field Name *</div>
                        <input style={iS} placeholder="e.g. Serial Number" value={newAttr.name} onChange={e => setNewAttr({ ...newAttr, name: e.target.value })} onKeyDown={e => e.key === "Enter" && addAttr()} />
                      </div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 4 }}>Type</div>
                        <select style={sS} value={newAttr.type} onChange={e => setNewAttr({ ...newAttr, type: e.target.value })}>
                          {["text", "number", "select", "date", "checkbox"].map(t => <option key={t}>{t}</option>)}
                        </select>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 4 }}>{newAttr.type === "select" ? "Options (comma-separated)" : <>&nbsp;</>}</div>
                        {newAttr.type === "select"
                          ? <input style={iS} placeholder="Option A, Option B" value={newAttr.options} onChange={e => setNewAttr({ ...newAttr, options: e.target.value })} />
                          : <div style={{ height: 38 }} />}
                      </div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 4 }}>&nbsp;</div>
                        <label style={{ display: "flex", alignItems: "center", gap: 6, height: 38, fontSize: 13, color: "#374151", cursor: "pointer", whiteSpace: "nowrap" }}>
                          <input type="checkbox" checked={newAttr.required} onChange={e => setNewAttr({ ...newAttr, required: e.target.checked })} style={{ width: 15, height: 15 }} />
                          Required
                        </label>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 4 }}>&nbsp;</div>
                        <button onClick={addAttr} style={bP}>+ Add Field</button>
                      </div>
                    </div>
                  </div>
                ) : <div style={{ marginBottom: 18, padding: "10px 14px", background: "#fef3c7", color: "#92400e", borderRadius: 8, fontSize: 13, fontWeight: 500 }}>Read Only: Attribute management is restricted to Admins.</div>}

                {/* Field list */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>Fields ({customAttrs.length})</div>
                  {customAttrs.length > 0 && currentUser?.role === "Admin" && (
                    <button onClick={() => { setLayoutDraft([...customAttrs].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))); setShowAttrLayoutModal(true); }} style={{ ...bP, padding: "6px 14px", fontSize: 12, background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>📐 Edit Layout</button>
                  )}
                </div>

                {customAttrs.length === 0 && (
                  <div style={{ textAlign: "center", color: "#94a3b8", padding: 32, background: "#f8fafc", borderRadius: 10, border: "1.5px dashed #e2e8f0" }}>No custom attributes yet. Add one above.</div>
                )}
                {[...customAttrs].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)).map(a => {
                  const sectionLabel = a.section === "below-assignees" ? "Below Assignees" : a.section === "bottom" ? "After Description" : "Grid (top)";
                  const sectionColor = a.section === "below-assignees" ? { bg: "#fffbeb", text: "#92400e", border: "#fde68a" } : a.section === "bottom" ? { bg: "#f0fdf4", text: "#166534", border: "#bbf7d0" } : { bg: "#eff6ff", text: "#1d4ed8", border: "#bfdbfe" };
                  return (
                    <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 9, border: "1.5px solid #f1f5f9", marginBottom: 7, background: "#fafafa" }}>
                      <div style={{ width: 32, height: 32, background: "#eff6ff", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0, fontWeight: 700, color: "#6366f1" }}>
                        {a.type === "text" ? "Aa" : a.type === "number" ? "#" : a.type === "select" ? "≡" : a.type === "date" ? "📅" : "☑"}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{a.name}{a.required && <span style={{ color: "#ef4444", marginLeft: 3 }}>*</span>}</div>
                        <div style={{ fontSize: 11, color: "#94a3b8" }}>Type: {a.type}{a.options?.length ? ` · ${a.options.join(", ")}` : ""}</div>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 99, background: sectionColor.bg, color: sectionColor.text, border: `1px solid ${sectionColor.border}`, whiteSpace: "nowrap" }}>{sectionLabel}</span>
                      {currentUser?.role === "Admin" && (
                        <button onClick={() => deleteAttr(a.id)} style={{ border: "none", background: "#fee2e2", color: "#ef4444", borderRadius: 6, padding: "5px 10px", cursor: "pointer", fontSize: 12, fontWeight: 600, flexShrink: 0 }}>Delete</button>
                      )}
                    </div>
                  );
                })}
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
                    <option value="departments">Departments</option>
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
                      {targetTable === "departments" && <option value="org">By Organisation</option>}
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
                        {exportFilterType === "org" && [...orgs].sort((a, b) => a.name.localeCompare(b.name)).map(o => (
                          <option key={o.id} value={o.name}>{o.name}</option>
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
          <FF label="Organisation" required><select style={sS} value={form.org} onChange={e => setForm({ ...form, org: e.target.value, department: "" })}><option value="">Select…</option>{orgs.map(o => <option key={o.id}>{o.name}</option>)}</select></FF>
          <FF label="Department">
            <div style={{ position: "relative" }}>
              <input type="text" placeholder={form.org ? "Search department..." : "Select org first..."} value={departmentSearch ? departmentSearch : (form.department || "")} onChange={e => setDepartmentSearch(e.target.value)} onFocus={() => { setDepartmentSearch(""); setShowDepartmentDD(true); }} style={{ ...iS, width: "100%", fontSize: 12 }} />
              {showDepartmentDD && <>
                <div style={{ position: "fixed", inset: 0, zIndex: 199 }} onClick={() => { setShowDepartmentDD(false); setDepartmentSearch(""); }} />
                <div style={{ position: "absolute", top: "calc(100% + 3px)", left: 0, right: 0, background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 8, zIndex: 200, boxShadow: "0 4px 12px rgba(0,0,0,0.1)", maxHeight: 240, overflowY: "auto" }}>
                  <div style={{ padding: 8, borderBottom: "1px solid #f1f5f9", position: "sticky", top: 0, background: "#fff" }}>
                    <input type="text" placeholder="Search departments..." value={departmentSearch} onChange={e => setDepartmentSearch(e.target.value)} onClick={e => e.stopPropagation()} autoFocus style={{ ...iS, width: "100%", fontSize: 12 }} />
                  </div>
                  {(() => {
                    const filtered = departments.filter(d =>
                      (!form.org || d.orgName === form.org) &&
                      (departmentSearch === "" || d.name.toLowerCase().includes(departmentSearch.toLowerCase()))
                    ).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
                    if (filtered.length === 0) return <div style={{ padding: "12px", textAlign: "center", fontSize: 12, color: "#94a3b8" }}>{form.org ? "No departments for this org" : "Select an org to filter departments"}</div>;
                    return filtered.map(d => (
                      <div key={d.id} onClick={() => { setForm({ ...form, department: d.name }); setShowDepartmentDD(false); setDepartmentSearch(""); }} style={{ padding: "8px 12px", cursor: "pointer", borderBottom: "1px solid #f1f5f9" }}>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>{d.name}</div>
                        {!form.org && <div style={{ fontSize: 10, color: "#94a3b8" }}>{d.orgName}</div>}
                      </div>
                    ));
                  })()}
                </div>
              </>}
            </div>
          </FF>
          <FF label="POC(Point of Contact)"><input style={iS} placeholder="Ticket Requestor" value={form.contact} onChange={e => setForm({ ...form, contact: e.target.value })} /></FF>
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
          {/* ── Custom Fields: Grid section (top area, inside 2-col grid) ── */}
          {customAttrs.filter(a => (a.section || "grid") === "grid").sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)).map(a => (
            <FF key={a.id} label={a.name} required={a.required}>
              {a.type === "select"
                ? <select style={sS} value={form.customAttrs[a.name] || ""} onChange={e => setForm({ ...form, customAttrs: { ...form.customAttrs, [a.name]: e.target.value } })}><option value="">Select…</option>{a.options?.map(o => <option key={o}>{o}</option>)}</select>
                : a.type === "checkbox"
                  ? <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13 }}><input type="checkbox" checked={!!form.customAttrs[a.name]} onChange={e => setForm({ ...form, customAttrs: { ...form.customAttrs, [a.name]: e.target.checked } })} />{a.name}</label>
                  : <input type={a.type === "date" ? "date" : "text"} style={iS} value={form.customAttrs[a.name] || ""} onChange={e => setForm({ ...form, customAttrs: { ...form.customAttrs, [a.name]: e.target.value } })} />}
            </FF>
          ))}
        </div>
        <FF label="Assignees">
          {(currentUser?.role === "Admin" || currentUser?.role === "Manager") ? (
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
        {/* ── Custom Fields: Below Assignees section ── */}
        {customAttrs.filter(a => (a.section || "grid") === "below-assignees").sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)).length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 18px" }}>
            {customAttrs.filter(a => (a.section || "grid") === "below-assignees").sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)).map(a => (
              <FF key={a.id} label={a.name} required={a.required}>
                {a.type === "select"
                  ? <select style={sS} value={form.customAttrs[a.name] || ""} onChange={e => setForm({ ...form, customAttrs: { ...form.customAttrs, [a.name]: e.target.value } })}><option value="">Select…</option>{a.options?.map(o => <option key={o}>{o}</option>)}</select>
                  : a.type === "checkbox"
                    ? <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13 }}><input type="checkbox" checked={!!form.customAttrs[a.name]} onChange={e => setForm({ ...form, customAttrs: { ...form.customAttrs, [a.name]: e.target.checked } })} />{a.name}</label>
                    : <input type={a.type === "date" ? "date" : "text"} style={iS} value={form.customAttrs[a.name] || ""} onChange={e => setForm({ ...form, customAttrs: { ...form.customAttrs, [a.name]: e.target.value } })} />}
              </FF>
            ))}
          </div>
        )}
        {form.category === "Webcast" && <WebcastFields f={form} setF={setForm} isProject={false} />}
        <FF label="Summary" required><input style={iS} placeholder="Brief description of the issue" value={form.summary} onChange={e => setForm({ ...form, summary: e.target.value })} /></FF>
        <FF label="Description"><textarea style={{ ...iS, height: 88, resize: "vertical" }} placeholder="Detailed description…" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></FF>
        {/* Attachment: Image */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ cursor: "pointer", padding: "8px 16px", borderRadius: 8, border: "1.5px dashed #3b82f6", background: "#eff6ff", color: "#1d4ed8", fontSize: 13, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6, transition: "all 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = "#dbeafe"} onMouseLeave={e => e.currentTarget.style.background = "#eff6ff"}>
              📷 Add Image
              <input
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) {
                    compressImage(file, (compressed) => {
                      setTicketImage(compressed);
                      setTicketImagePreview(compressed);
                    });
                  }
                }}
              />
            </label>
            {ticketImagePreview && (
              <div style={{ position: "relative", display: "inline-block" }}>
                <img src={ticketImagePreview} style={{ height: 42, width: 42, objectFit: "cover", borderRadius: 8, border: "1.5px solid #e2e8f0" }} alt="preview" />
                <button onClick={() => { setTicketImage(null); setTicketImagePreview(null); }} style={{ position: "absolute", top: -6, right: -6, background: "#ef4444", color: "#fff", border: "none", borderRadius: "50%", width: 18, height: 18, fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>×</button>
              </div>
            )}
            <div style={{ fontSize: 11, color: "#94a3b8" }}>Attach an image to the ticket description (Max 1)</div>
          </div>
        </div>
        {customAttrs.filter(a => (a.section || "grid") === "bottom").sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)).length > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 9, marginTop: 4 }}>Custom Fields</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 18px" }}>
              {customAttrs.filter(a => (a.section || "grid") === "bottom").sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)).map(a => (
                <FF key={a.id} label={a.name} required={a.required}>
                  {a.type === "select"
                    ? <select style={sS} value={form.customAttrs[a.name] || ""} onChange={e => setForm({ ...form, customAttrs: { ...form.customAttrs, [a.name]: e.target.value } })}><option value="">Select…</option>{a.options?.map(o => <option key={o}>{o}</option>)}</select>
                    : a.type === "checkbox"
                      ? <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13 }}><input type="checkbox" checked={!!form.customAttrs[a.name]} onChange={e => setForm({ ...form, customAttrs: { ...form.customAttrs, [a.name]: e.target.checked } })} />{a.name}</label>
                      : <input type={a.type === "date" ? "date" : "text"} style={iS} value={form.customAttrs[a.name] || ""} onChange={e => setForm({ ...form, customAttrs: { ...form.customAttrs, [a.name]: e.target.value } })} />}
                </FF>
              ))}
            </div>
          </>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 9, marginTop: 6 }}>
          <button onClick={() => { setShowNewTicket(false); setShowAssigneeDD(false); }} style={bG}>Cancel</button>
          <button onClick={handleSubmit} style={bP}>Create Ticket</button>
        </div>
      </Modal>

      {/* ── NEW PROJECT MODAL ── */}
      <Modal open={showNewProject} onClose={() => setShowNewProject(false)} title="Create New Project" width={700}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 18px" }}>
          <FF label="Organisation" required><select style={sS} value={projForm.org} onChange={e => setProjForm({ ...projForm, org: e.target.value, department: "" })}><option value="">Select…</option>{orgs.map(o => <option key={o.id}>{o.name}</option>)}</select></FF>
          <FF label="Department">
            <div style={{ position: "relative" }}>
              <input type="text" placeholder={projForm.org ? "Search department..." : "Select org first..."} value={departmentSearch ? departmentSearch : (projForm.department || "")} onChange={e => setDepartmentSearch(e.target.value)} onFocus={() => { setDepartmentSearch(""); setShowDepartmentDD(true); }} style={{ ...iS, width: "100%", fontSize: 12 }} />
              {showDepartmentDD && <>
                <div style={{ position: "fixed", inset: 0, zIndex: 199 }} onClick={() => { setShowDepartmentDD(false); setDepartmentSearch(""); }} />
                <div style={{ position: "absolute", top: "calc(100% + 3px)", left: 0, right: 0, background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 8, zIndex: 200, boxShadow: "0 4px 12px rgba(0,0,0,0.1)", maxHeight: 240, overflowY: "auto" }}>
                  <div style={{ padding: 8, borderBottom: "1px solid #f1f5f9", position: "sticky", top: 0, background: "#fff" }}>
                    <input type="text" placeholder="Search departments..." value={departmentSearch} onChange={e => setDepartmentSearch(e.target.value)} onClick={e => e.stopPropagation()} autoFocus style={{ ...iS, width: "100%", fontSize: 12 }} />
                  </div>
                  {(() => {
                    const filtered = departments.filter(d =>
                      (!projForm.org || d.orgName === projForm.org) &&
                      (departmentSearch === "" || d.name.toLowerCase().includes(departmentSearch.toLowerCase()))
                    ).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
                    if (filtered.length === 0) return <div style={{ padding: "12px", textAlign: "center", fontSize: 12, color: "#94a3b8" }}>{projForm.org ? "No departments for this org" : "Select an org to filter departments"}</div>;
                    return filtered.map(d => (
                      <div key={d.id} onClick={() => { setProjForm({ ...projForm, department: d.name }); setShowDepartmentDD(false); setDepartmentSearch(""); }} style={{ padding: "8px 12px", cursor: "pointer", borderBottom: "1px solid #f1f5f9" }}>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>{d.name}</div>
                        {!projForm.org && <div style={{ fontSize: 10, color: "#94a3b8" }}>{d.orgName}</div>}
                      </div>
                    ));
                  })()}
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
        {projForm.category === "Webcast" && <WebcastFields f={projForm} setF={setProjForm} isProject={true} />}
        <FF label="Project Title" required><input style={iS} placeholder="Brief project name" value={projForm.title} onChange={e => setProjForm({ ...projForm, title: e.target.value })} /></FF>
        <FF label="Description"><textarea style={{ ...iS, height: 88, resize: "vertical" }} placeholder="Detailed description…" value={projForm.description} onChange={e => setProjForm({ ...projForm, description: e.target.value })} /></FF>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 9, marginTop: 6 }}>
          <button onClick={() => setShowNewProject(false)} style={bG}>Cancel</button>
          <button onClick={handleProjectSubmit} style={{ ...bP, background: "linear-gradient(135deg,#8b5cf6,#6366f1)" }}>Create Project</button>
        </div>
      </Modal>

      {/* ── TICKET DETAIL MODAL (v1 full - timeline, forward, custom attrs, vendor) ── */}
      <Modal open={!!selTicket} onClose={() => { setSelTicket(null); setPendingTicketStatus(null); setShowForward(false); setFwdReason(""); setEditMode(false); setEditTicket(null); setCommentVisibility("external"); }} title={selTicket?.id || ""} width={720}>
        {selTicket && <div>
          {/* Edit/View Toggle Button - Admin/Manager Only */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 14 }}>
            {(currentUser?.role === "Admin" || currentUser?.role === "Manager") && !editMode && (
              <button onClick={() => { setEditMode(true); setEditTicket({ ...selTicket }); }} style={{ padding: "6px 14px", fontSize: 12, fontWeight: 600, borderRadius: 7, border: "none", cursor: "pointer", background: "#3b82f6", color: "#fff" }}>✏️ Edit Ticket</button>
            )}
            {editMode && (
              <>
                <button onClick={() => { setEditMode(false); setEditTicket(null); }} style={{ padding: "6px 14px", fontSize: 12, fontWeight: 600, borderRadius: 7, border: "1.5px solid #e2e8f0", cursor: "pointer", background: "#fff", color: "#64748b" }}>Cancel</button>
                <button onClick={async () => { try { await axios.put(`${TICKETS_API}/${selTicket.id}`, { ...editTicket, updated: new Date().toISOString() }); setTickets(t => t.map(x => x.id === selTicket.id ? { ...editTicket, updated: new Date() } : x)); setSelTicket(editTicket); setEditMode(false); setEditTicket(null); showToast("Ticket updated successfully ✓", "success"); addDailyNotif({ type: "ticket_edited", icon: "✏️", text: `${currentUser.name} edited ticket ${selTicket.id}`, ticketId: selTicket.id, by: currentUser.name }); } catch (e) { showToast("Failed to save ticket", "error"); } }} style={{ padding: "6px 14px", fontSize: 12, fontWeight: 600, borderRadius: 7, border: "none", cursor: "pointer", background: "#22c55e", color: "#fff" }}>💾 Save Changes</button>
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
                {selTicket.category === "Webcast" && <Badge label="📡 Webcast" style={{ background: "#fff7ed", color: "#f97316" }} />}
                <span style={{ fontSize: 12, color: "#94a3b8" }}>Created {new Date(selTicket.created).toLocaleString()}</span>
              </div>
              <h2 style={{ margin: "0 0 9px", fontSize: 17, fontWeight: 700, color: "#1e293b" }}>
                {selTicket.summary}
              </h2>
              <p style={{ margin: "0 0 16px", color: "#64748b", fontSize: 14, lineHeight: 1.6 }}>
                {selTicket.description}
              </p>
              {selTicket.image && (
                <div style={{ marginBottom: 16, borderRadius: 12, overflow: "hidden", border: "1.5px solid #e2e8f0" }}>
                  <img src={selTicket.image} style={{ width: "100%", maxHeight: 300, objectFit: "contain", background: "#f8fafc", display: "block" }} alt="ticket attachment" />
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, marginBottom: 14 }}>
                {[
                  { l: "Organisation", v: selTicket.org },
                  { l: "Department", v: selTicket.department || "—" },
                  { l: "POC (Point of Contact)", v: selTicket.contact || "—" },
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

          {selTicket?.deviceId && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 13px", background: "#eff6ff", borderRadius: 9, border: "1px solid #bfdbfe", marginBottom: 14 }}>
              <span style={{ fontSize: 16 }}>🔗</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#1d4ed8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>Linked Inventory Device</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#1e40af" }}>
                  Device ID: {selTicket.deviceId}
                  <span onClick={() => window.location.href = "/inventory"} style={{ marginLeft: 10, color: "#3b82f6", cursor: "pointer", textDecoration: "underline", fontSize: 12, fontWeight: 500 }}>View in Inventory →</span>
                </div>
              </div>
            </div>
          )}

          {selTicket.customAttrs && Object.keys(selTicket.customAttrs).length > 0 && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, marginBottom: 14 }}>
            {Object.entries(selTicket.customAttrs).map(([k, v]) => <div key={k} style={{ background: "#fffbeb", padding: "9px 13px", borderRadius: 9, border: "1px solid #fde68a" }}><div style={{ fontSize: 10, fontWeight: 600, color: "#92400e", textTransform: "uppercase", marginBottom: 3 }}>{k}</div><div style={{ fontSize: 13, fontWeight: 500 }}>{String(v) || "-"}</div></div>)}
          </div>}
          <div style={{ marginBottom: 14, padding: "11px 13px", background: "#f8fafc", borderRadius: 9 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", marginBottom: 7 }}>Assignees</div>
            {(currentUser?.role === "Admin" || currentUser?.role === "Manager") ? (
              <div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 10 }}>
                  {(selTicket.assignees || []).map(a => <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 7, background: "#dbeafe", padding: "5px 9px", borderRadius: 7, border: "1px solid #bfdbfe" }}><Avatar name={a.name} size={24} /><div><div style={{ fontSize: 12, fontWeight: 600 }}>{a.name}</div><div style={{ fontSize: 10, color: "#64748b" }}>{a.role}</div></div><span onClick={async () => { const updated = { ...selTicket, assignees: selTicket.assignees.filter(x => x.id !== a.id), updated: new Date().toISOString() }; try { await axios.put(`${TICKETS_API}/${selTicket.id}`, updated); setTickets(t => t.map(x => x.id === selTicket.id ? { ...updated, updated: new Date(updated.updated) } : x)); setSelTicket(updated); } catch (e) { setCustomAlert({ show: true, message: "Failed to remove assignee", type: "error" }); } }} style={{ cursor: "pointer", fontWeight: 700, marginLeft: 4, color: "#ef4444" }}>×</span></div>)}
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
                        <div key={u.id} onClick={async () => { const updated = { ...selTicket, assignees: [...(selTicket.assignees || []), u], updated: new Date().toISOString() }; try { await axios.put(`${TICKETS_API}/${selTicket.id}`, updated); setTickets(t => t.map(x => x.id === selTicket.id ? { ...updated, updated: new Date(updated.updated) } : x)); setSelTicket(updated); setAssigneeSearch(""); setShowTicketAssigneeDD(false); setCustomAlert({ show: true, message: `✅ Ticket ${selTicket.id} assigned to ${u.name}`, type: "success" }); } catch (e) { setCustomAlert({ show: true, message: "Failed to add assignee", type: "error" }); } }} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 12px", cursor: "pointer", borderBottom: "1px solid #f1f5f9" }}>
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
          <button onClick={() => { setShowTimelineView(true); setTimelineTab("external"); }} style={{ ...bG, padding: "6px 14px", marginBottom: 14, marginLeft: 8, fontSize: 12, background: "#f3e8ff", color: "#7c3aed" }}>📜 View Timeline</button>

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
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 10 }}>
              {STATUSES.map(s => <button key={s} onClick={() => s === "Closed" ? updateStatus(selTicket.id, s) : setPendingTicketStatus(s)} style={{ padding: "5px 13px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "'DM Sans',sans-serif", background: (pendingTicketStatus === s || selTicket.status === s) ? STATUS_COLOR[s].text : "#f1f5f9", color: (pendingTicketStatus === s || selTicket.status === s) ? "#fff" : "#64748b", opacity: pendingTicketStatus === s && selTicket.status !== s ? 0.7 : 1 }}>{s}</button>)}
              {/* ✅ NEW: Reopen Button for Closed Tickets */}
              {selTicket.status === "Closed" && (
                <button
                  onClick={() => setPendingTicketStatus("Open")}
                  style={{
                    padding: "5px 13px",
                    borderRadius: 7,
                    border: "1.5px solid #3b82f6",
                    background: pendingTicketStatus === "Open" ? "#3b82f6" : "#eff6ff",
                    color: pendingTicketStatus === "Open" ? "#fff" : "#1d4ed8",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 600,
                    fontFamily: "'DM Sans',sans-serif"
                  }}
                >
                  🔄 Reopen Ticket
                </button>
              )}
            </div>
            {/* Save button for pending status changes */}
            {pendingTicketStatus && pendingTicketStatus !== selTicket.status && (
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => updateStatus(selTicket.id, pendingTicketStatus)} style={{ padding: "6px 12px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "'DM Sans',sans-serif", background: "#22c55e", color: "#fff" }}>✓ Save Status</button>
                <button onClick={() => setPendingTicketStatus(null)} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #e2e8f0", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "'DM Sans',sans-serif", background: "#fff", color: "#64748b" }}>Cancel</button>
              </div>
            )}
          </div>

          {/* Comments Display */}
          {(() => {
            const isPrivileged = currentUser?.role !== "Viewer";
            const visibleComments = (selTicket.comments || []).filter(c => {
              if (!c.visibility || c.visibility === "external") return true;
              // internal comments: only admin, manager, or assigned agents see them
              return isPrivileged;
            });
            return visibleComments.length > 0 && (
              <div style={{ marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid #f1f5f9" }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#374151", marginBottom: 10 }}>COMMENTS ({visibleComments.length})</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {visibleComments.map((comment, idx) => (
                    <div key={idx} style={{
                      padding: 12,
                      background: comment.visibility === "internal" ? "#faf5ff" : "#f8fafc",
                      borderRadius: 8,
                      border: `1px solid ${comment.visibility === "internal" ? "#e9d5ff" : "#e2e8f0"}`
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          <div style={{ fontWeight: 600, fontSize: 12, color: "#1f2937" }}>{comment.by}</div>
                          {comment.visibility === "internal" && (
                            <span style={{ fontSize: 10, background: "#ede9fe", color: "#7c3aed", fontWeight: 700, padding: "1px 7px", borderRadius: 99 }}>🔒 Internal</span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: "#94a3b8" }}>{new Date(comment.date).toLocaleString()}</div>
                      </div>
                      {comment.text && (
                        <div style={{ fontSize: 13, color: "#475569", marginBottom: comment.image ? 8 : 0, lineHeight: 1.5 }}>
                          {comment.text}
                        </div>
                      )}
                      {comment.image && (
                        <div style={{ marginTop: 8 }}>
                          <img src={comment.image} style={{ maxWidth: "100%", maxHeight: 200, borderRadius: 6, border: "1px solid #e2e8f0", cursor: "pointer" }} alt="comment" onClick={() => { window.open(comment.image, "_blank"); }} title="Click to view full image" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Comment */}
          <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 13 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#374151", marginBottom: 7 }}>ADD COMMENT</div>
            {/* Internal / External toggle — only for privileged users */}
            {(currentUser?.role !== "Viewer") && (
              <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                <button
                  onClick={() => setCommentVisibility("external")}
                  style={{
                    padding: "5px 14px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600,
                    background: commentVisibility === "external" ? "#dbeafe" : "#f1f5f9",
                    color: commentVisibility === "external" ? "#1d4ed8" : "#64748b",
                    transition: "all 0.15s"
                  }}
                >🌐 External</button>
                <button
                  onClick={() => setCommentVisibility("internal")}
                  style={{
                    padding: "5px 14px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600,
                    background: commentVisibility === "internal" ? "#ede9fe" : "#f1f5f9",
                    color: commentVisibility === "internal" ? "#7c3aed" : "#64748b",
                    transition: "all 0.15s"
                  }}
                >🔒 Internal</button>
              </div>
            )}
            {commentVisibility === "internal" && (currentUser?.role !== "Viewer") && (
              <div style={{ fontSize: 11, color: "#7c3aed", marginBottom: 8, background: "#faf5ff", padding: "6px 10px", borderRadius: 6, border: "1px solid #e9d5ff" }}>
                🔒 This note is internal — only visible to Admins, Managers, and assigned Agents.
              </div>
            )}
            <textarea style={{ ...iS, height: 68, resize: "none", borderColor: commentVisibility === "internal" ? "#c4b5fd" : undefined }} placeholder={commentVisibility === "internal" ? "Add an internal note (not visible to ticket creator)…" : "Add a note or reply…"} value={newComment} onChange={e => setNewComment(e.target.value)} />
            {/* Image attachment */}
            <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
              <label style={{ cursor: "pointer", padding: "6px 12px", borderRadius: 6, border: "1.5px dashed #3b82f6", background: "#eff6ff", color: "#1d4ed8", fontSize: 12, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>
                📷 Add Image
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) {
                      compressImage(file, (compressed) => {
                        setCommentImage(compressed);
                        setCommentImagePreview(compressed);
                      });
                    }
                  }}
                />
              </label>
              {commentImagePreview && (
                <button onClick={() => { setCommentImage(null); setCommentImagePreview(null); }} style={{ padding: "4px 8px", borderRadius: 4, border: "1px solid #e2e8f0", background: "#fff", color: "#ef4444", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>✕ Remove</button>
              )}
            </div>
            {/* Image preview */}
            {commentImagePreview && (
              <div style={{ marginTop: 8, maxWidth: 200 }}>
                <img src={commentImagePreview} style={{ maxWidth: "100%", maxHeight: 150, borderRadius: 6, border: "1px solid #e2e8f0" }} alt="preview" />
              </div>
            )}
            <button onClick={async () => {
              if (!newComment.trim() && !commentImage) return;
              const nowISO = new Date().toISOString();
              const comment = {
                by: currentUser.name,
                date: nowISO,
                text: newComment.trim(),
                image: commentImage || null,
                visibility: commentVisibility
              };
              const timelineNote = newComment.trim() + (commentImage ? " [with image]" : "");
              const timelineEvent = { action: "Comment added", by: currentUser.name, date: nowISO, note: timelineNote, visibility: commentVisibility };
              const updatedT = { ...selTicket, updated: nowISO, comments: [...(selTicket.comments || []), comment], timeline: [...(selTicket.timeline || []), timelineEvent] };
              try {
                await axios.put(`${TICKETS_API}/${selTicket.id}`, updatedT);
                setTickets(p => p.map(x => x.id === selTicket.id ? { ...updatedT, updated: new Date(nowISO) } : x));
                setSelTicket({ ...updatedT, updated: new Date(nowISO) });
                setNewComment("");
                setCommentImage(null);
                setCommentImagePreview(null);
              } catch (e) { setCustomAlert({ show: true, message: "Failed to post comment", type: "error" }); }
            }} style={{ ...bP, marginTop: 7, padding: "7px 15px", fontSize: 13, background: commentVisibility === "internal" ? "linear-gradient(135deg,#7c3aed,#6d28d9)" : "linear-gradient(135deg,#3b82f6,#6366f1)" }}>
              {commentVisibility === "internal" ? "🔒 Post Internal Note" : "🌐 Post Comment"}
            </button>
          </div>
        </div>}
      </Modal>

      {/* ✅ UPDATED: TIMELINE VIEW MODAL — Internal / External tabs */}
      <Modal open={showTimelineView} onClose={() => setShowTimelineView(false)} title={`📜 Ticket Timeline - ${selTicket?.id || ""}`} width={640}>
        {selTicket && (() => {
          const isPrivileged = currentUser?.role !== "Viewer";

          // External events: only public events (no internal-tagged ones) — what ticket creator sees
          const externalEvents = (selTicket.timeline || []).filter(e => e.visibility !== "internal");

          // Internal timeline = ALL events (public + internal), so agents see the complete picture
          const allEvents = selTicket.timeline || [];
          const internalOnlyCount = allEvents.filter(e => e.visibility === "internal").length;

          const renderEntry = (entry, idx, arr) => (
            <div key={idx} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: idx < arr.length - 1 ? "1px solid #f1f5f9" : "none" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                {/* dot */}
                <div style={{
                  width: 32, height: 32, minWidth: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
                  background: entry.visibility === "internal" ? "#ede9fe" : "#dbeafe"
                }}>
                  {entry.action.includes("Created") && "✨"}
                  {entry.action.includes("Forwarded") && "➦"}
                  {entry.action.includes("Sent") && "🏭"}
                  {entry.action.includes("Reopened") && "🔄"}
                  {entry.action.includes("Closed") && "✓"}
                  {entry.action.includes("Updated") && "✏️"}
                  {entry.action.includes("Comment") && (entry.visibility === "internal" ? "🔒" : "💬")}
                  {!entry.action.includes("Created") && !entry.action.includes("Forwarded") && !entry.action.includes("Sent") && !entry.action.includes("Reopened") && !entry.action.includes("Closed") && !entry.action.includes("Updated") && !entry.action.includes("Comment") && "📝"}
                </div>
                {/* content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 2 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#1f2937" }}>{entry.action}</div>
                    {entry.visibility === "internal" && <span style={{ fontSize: 10, background: "#ede9fe", color: "#7c3aed", fontWeight: 700, padding: "1px 7px", borderRadius: 99 }}>🔒 Internal</span>}
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>
                    By <strong>{entry.by}</strong> • {new Date(entry.date).toLocaleString()}
                  </div>
                  {entry.note && (
                    <div style={{ fontSize: 12, color: "#475569", background: entry.visibility === "internal" ? "#faf5ff" : "#f8fafc", padding: "8px 10px", borderRadius: 6, borderLeft: `3px solid ${entry.visibility === "internal" ? "#7c3aed" : "#3b82f6"}`, marginTop: 6 }}>
                      {entry.note}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );

          return (
            <div>
              {/* Tab bar — internal tab only for privileged users */}
              <div style={{ display: "flex", gap: 6, marginBottom: 18, borderBottom: "2px solid #f1f5f9", paddingBottom: 0 }}>
                <button
                  onClick={() => setTimelineTab("external")}
                  style={{
                    padding: "8px 18px", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, background: "none",
                    color: timelineTab === "external" ? "#1d4ed8" : "#94a3b8",
                    borderBottom: timelineTab === "external" ? "2px solid #3b82f6" : "2px solid transparent",
                    marginBottom: -2, transition: "all 0.15s"
                  }}
                >🌐 External Timeline</button>
                {isPrivileged && (
                  <button
                    onClick={() => setTimelineTab("internal")}
                    style={{
                      padding: "8px 18px", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, background: "none",
                      color: timelineTab === "internal" ? "#7c3aed" : "#94a3b8",
                      borderBottom: timelineTab === "internal" ? "2px solid #7c3aed" : "2px solid transparent",
                      marginBottom: -2, transition: "all 0.15s"
                    }}
                  >🔒 Internal Timeline {internalOnlyCount > 0 && <span style={{ background: "#ede9fe", color: "#7c3aed", borderRadius: 99, padding: "0 6px", fontSize: 11 }}>+{internalOnlyCount} internal</span>}</button>
                )}
              </div>

              {/* External timeline */}
              {timelineTab === "external" && (
                <div style={{ maxHeight: 520, overflowY: "auto" }}>
                  {externalEvents.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "30px", color: "#94a3b8" }}>
                      <div style={{ fontSize: 14, marginBottom: 8 }}>📭 No external events yet</div>
                      <div style={{ fontSize: 12 }}>Ticket creation, status changes and public comments appear here</div>
                    </div>
                  ) : (
                    <div>{[...externalEvents].reverse().map((e, i, arr) => renderEntry(e, i, arr))}</div>
                  )}
                </div>
              )}

              {/* Internal timeline — privileged only, shows ALL events with internal ones highlighted */}
              {timelineTab === "internal" && isPrivileged && (
                <div style={{ maxHeight: 520, overflowY: "auto" }}>
                  <div style={{ fontSize: 11, color: "#7c3aed", marginBottom: 14, background: "#faf5ff", padding: "8px 12px", borderRadius: 7, border: "1px solid #e9d5ff" }}>
                    🔒 Full internal view — includes all public events plus internal notes, forwards, and agent actions not visible to the ticket creator.
                  </div>
                  {allEvents.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "30px", color: "#94a3b8" }}>
                      <div style={{ fontSize: 14, marginBottom: 8 }}>📭 No events yet</div>
                      <div style={{ fontSize: 12 }}>All ticket activity will appear here</div>
                    </div>
                  ) : (
                    <div>{[...allEvents].reverse().map((e, i, arr) => renderEntry(e, i, arr))}</div>
                  )}
                </div>
              )}
            </div>
          );
        })()}
      </Modal>

      {/* Forward requests now handled via Inbox (✉️) and floating alerts */}

      {/* ── PROJECT DETAIL MODAL ── */}
      <Modal open={!!selProject} onClose={() => setSelProject(null)} title={selProject?.id || ""} width={720}>
        {selProject && <div>
          <div style={{ display: "flex", gap: 9, marginBottom: 16, flexWrap: "wrap" }}>
            <Badge label={selProject.status} style={{ ...STATUS_COLOR[selProject.status], padding: "4px 12px", fontSize: 12 }} />
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 9, height: 9, borderRadius: "50%", background: PRIORITY_COLOR[selProject.priority] }} /><span style={{ fontSize: 13, fontWeight: 600 }}>{selProject.priority} Priority</span></div>
            {selProject.category === "Webcast" && <Badge label="📡 Webcast" style={{ background: "#fff7ed", color: "#f97316" }} />}
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
            {[{ l: "Organisation", v: selProject.org }, { l: "Department", v: selProject.department }, { l: "Reported By", v: selProject.reportedBy }, { l: "Category", v: selProject.category }, { l: "Location", v: selProject.location }, { l: "Due Date", v: selProject.dueDate?.toLocaleDateString() || "-" }].map(f => (
              <div key={f.l} style={{ background: "#f8fafc", padding: "9px 13px", borderRadius: 9 }}><div style={{ fontSize: 10, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", marginBottom: 3 }}>{f.l}</div><div style={{ fontSize: 13, fontWeight: 500 }}>{f.v || "-"}</div></div>
            ))}
          </div>
          <div style={{ marginBottom: 14, padding: "11px 13px", background: "#f8fafc", borderRadius: 9 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", marginBottom: 7 }}>Assignees</div>
            {(currentUser?.role === "Admin" || currentUser?.role === "Manager") ? (
              <div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 10 }}>
                  {(selProject.assignees || []).map(a => <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 7, background: "#dbeafe", padding: "5px 9px", borderRadius: 7, border: "1px solid #bfdbfe" }}><Avatar name={a.name} size={24} /><div><div style={{ fontSize: 12, fontWeight: 600 }}>{a.name}</div><div style={{ fontSize: 10, color: "#64748b" }}>{a.role}</div></div><span onClick={async () => { const updated = { ...selProject, assignees: selProject.assignees.filter(x => x.id !== a.id), updated: new Date().toISOString() }; try { await axios.put(`${PROJECTS_API}/${selProject.id}`, updated); setProjects(p => p.map(x => x.id === selProject.id ? { ...updated, updated: new Date(updated.updated) } : x)); setSelProject(updated); } catch (e) { setCustomAlert({ show: true, message: "Failed to remove assignee", type: "error" }); } }} style={{ cursor: "pointer", fontWeight: 700, marginLeft: 4, color: "#ef4444" }}>×</span></div>)}
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
                        <div key={u.id} onClick={async () => { const updated = { ...selProject, assignees: [...(selProject.assignees || []), u], updated: new Date().toISOString() }; try { await axios.put(`${PROJECTS_API}/${selProject.id}`, updated); setProjects(p => p.map(x => x.id === selProject.id ? { ...updated, updated: new Date(updated.updated) } : x)); setSelProject(updated); setAssigneeSearch(""); setShowProjAssigneeDD(false); } catch (e) { setCustomAlert({ show: true, message: "Failed to add assignee", type: "error" }); } }} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 12px", cursor: "pointer", borderBottom: "1px solid #f1f5f9" }}>
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
              } catch (e) { setCustomAlert({ show: true, message: "Failed to post comment", type: "error" }); }
            }} style={{ ...bP, marginTop: 7, padding: "7px 15px", fontSize: 13, background: "linear-gradient(135deg,#8b5cf6,#6366f1)" }}>Post Comment</button>
          </div>
        </div>}
      </Modal>

      {/* ── Floating 30-sec Action Alerts (forward requests / responses) ── */}
      <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", zIndex: 10005, display: "flex", flexDirection: "column", gap: 10, alignItems: "center", pointerEvents: "none", width: "100%", maxWidth: 480, padding: "0 16px" }}>
        {floatingAlerts.map(alert => (
          <div key={alert.alertId} style={{ width: "100%", background: "#fff", borderRadius: 14, boxShadow: "0 8px 32px rgba(0,0,0,0.18)", border: alert.type === "forward_request" ? "2px solid #f59e0b" : alert.status === "Approved" ? "2px solid #22c55e" : alert.status === "Rejected" ? "2px solid #ef4444" : "2px solid #3b82f6", overflow: "hidden", pointerEvents: "auto", animation: "floatIn 0.35s ease-out" }}>
            {/* Progress bar countdown */}
            <div style={{ height: 3, background: alert.type === "forward_request" ? "#fef3c7" : "#f0fdf4", position: "relative" }}>
              <div style={{ position: "absolute", left: 0, top: 0, height: "100%", background: alert.type === "forward_request" ? "#f59e0b" : alert.status === "Approved" ? "#22c55e" : "#ef4444", animation: "shrink30 30s linear forwards" }} />
            </div>
            <div style={{ padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 11 }}>
                <span style={{ fontSize: 22, flexShrink: 0 }}>
                  {alert.type === "forward_request" ? "📬" : alert.type === "forward_response" ? (alert.status === "Approved" ? "✅" : "❌") : alert.type === "ticket_assigned" ? "🎫" : "📩"}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>{alert.title}</div>
                  <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.5 }}>{alert.message}</div>
                  {alert.ticketId && <div style={{ fontSize: 11, color: "#3b82f6", fontFamily: "monospace", marginTop: 4 }}>{alert.ticketId}</div>}
                  {/* Accept / Reject buttons only for forward_request type and admins/managers and not yet resolved */}
                  {alert.type === "forward_request" && !alert.resolved && (currentUser?.role === "Admin" || currentUser?.role === "Manager") && (
                    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                      <button onClick={() => { acceptInboxForwardRequest(alert); setFloatingAlerts(prev => prev.filter(a => a.alertId !== alert.alertId)); }}
                        style={{ flex: 1, padding: "7px 12px", fontSize: 12, fontWeight: 700, background: "linear-gradient(135deg,#10b981,#059669)", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>✓ Approve</button>
                      <button onClick={() => { rejectInboxForwardRequest(alert); setFloatingAlerts(prev => prev.filter(a => a.alertId !== alert.alertId)); }}
                        style={{ flex: 1, padding: "7px 12px", fontSize: 12, fontWeight: 700, background: "linear-gradient(135deg,#ef4444,#dc2626)", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>✕ Reject</button>
                    </div>
                  )}
                  {alert.type === "forward_request" && alert.resolved && (
                    <div style={{ marginTop: 10, padding: "6px 10px", borderRadius: 6, background: alert.resolved === "Approved" ? "#dcfce7" : "#fee2e2", color: alert.resolved === "Approved" ? "#15803d" : "#991b1b", fontSize: 12, fontWeight: 600, textAlign: "center" }}>
                      ✓ Already {alert.resolved}
                    </div>
                  )}
                </div>
                <button onClick={() => setFloatingAlerts(prev => prev.filter(a => a.alertId !== alert.alertId))}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 16, flexShrink: 0, padding: 0 }}>×</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ✅ NEW: Update Agent Activity Modal */}
      <Modal open={showLocationModal} onClose={() => { setShowLocationModal(false); setShowTicketDropdown(false); }} title="Update Agent Activity" width={500}>
        {selAgent && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 8, display: "block" }}>🎫 Select Ticket</label>
              <div style={{ position: "relative" }}>
                <input
                  type="text"
                  placeholder="Click to select ticket..."
                  value={currentTicketId}
                  onFocus={() => setShowTicketDropdown(true)}
                  onChange={e => setCurrentTicketId(e.target.value)}
                  style={{ width: "100%", padding: "10px 12px", fontSize: 12, borderRadius: 6, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#1e293b" }}
                />
                {/* Show dropdown only when focused */}
                {showTicketDropdown && (
                  <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #e2e8f0", borderTop: "none", borderRadius: "0 0 6px 6px", maxHeight: 250, overflowY: "auto", zIndex: 100, marginTop: 2 }}>
                    {tickets.filter(t =>
                      t.assignees?.some(a => a.id === selAgent.id) &&
                      (currentTicketId === "" || t.id.includes(currentTicketId.toUpperCase()) || t.summary.toLowerCase().includes(currentTicketId.toLowerCase()))
                    ).map(t => (
                      <div
                        key={t.id}
                        onClick={() => {
                          setCurrentTicketId(t.id);
                          setShowTicketDropdown(false);
                        }}
                        style={{ padding: "12px 12px", borderBottom: "1px solid #f1f5f9", cursor: "pointer", fontSize: 12, color: "#1e293b", transition: "background 0.2s", background: currentTicketId === t.id ? "#e0e7ff" : "#fff" }}
                        onMouseEnter={e => e.currentTarget.style.background = "#f1f5f9"}
                        onMouseLeave={e => e.currentTarget.style.background = currentTicketId === t.id ? "#e0e7ff" : "#fff"}
                      >
                        <div style={{ fontWeight: 600 }}>{t.id}</div>
                        <div style={{ fontSize: 11, color: "#64748b" }}>{t.summary}</div>
                      </div>
                    ))}
                    {tickets.filter(t =>
                      t.assignees?.some(a => a.id === selAgent.id) &&
                      (currentTicketId === "" || t.id.includes(currentTicketId.toUpperCase()) || t.summary.toLowerCase().includes(currentTicketId.toLowerCase()))
                    ).length === 0 && (
                        <div style={{ padding: "12px 12px", fontSize: 12, color: "#94a3b8" }}>No assigned tickets</div>
                      )}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 8, display: "block" }}>📍 Location</label>
              <select
                value={currentLocation}
                onChange={e => setCurrentLocation(e.target.value)}
                style={{ width: "100%", padding: "10px 12px", fontSize: 12, borderRadius: 6, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#1e293b" }}
              >
                <option value="">Select Location</option>
                {locations.map(loc => <option key={loc.id} value={loc.name}>{loc.name}</option>)}
              </select>
            </div>

            <div style={{ display: "flex", gap: 8, flexDirection: "column" }}>
              {/* ✅ NEW: Back to Office button - clears location and sets On Duty */}
              {currentLocation && (
                <button onClick={async () => {
                  try {
                    const u = users.find(x => x.id === selAgent.id);
                    const updated = {
                      ...u,
                      currentTicketId: null,
                      currentLocation: null,
                      status: "On Duty"  // ✅ Auto set to On Duty
                    };
                    await axios.put(`${USERS_API}/${selAgent.id}`, updated);
                    setUsers(users.map(x => x.id === selAgent.id ? updated : x));
                    setSelAgent(updated);
                    setCustomAlert({ show: true, message: "✅ Welcome back to office! On Duty", type: "success" });
                    setCurrentTicketId("");
                    setCurrentLocation("");
                    setShowLocationModal(false);
                  } catch (e) {
                    setCustomAlert({ show: true, message: "Failed to update", type: "error" });
                  }
                }} style={{ padding: "10px 12px", background: "#3b82f6", border: "none", borderRadius: 6, color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 12 }}>🏢 Back to Office - On Duty</button>
              )}

              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={async () => {
                  try {
                    const u = users.find(x => x.id === selAgent.id);
                    // ✅ NEW: Auto set to "On Ticket" if location is assigned
                    const newStatus = currentLocation ? "On Ticket" : u.status;
                    const updated = {
                      ...u,
                      currentTicketId: currentTicketId || null,
                      currentLocation: currentLocation || null,
                      status: newStatus  // ✅ Auto-update status based on location
                    };
                    await axios.put(`${USERS_API}/${selAgent.id}`, updated);
                    setUsers(users.map(x => x.id === selAgent.id ? updated : x));
                    setSelAgent(updated);
                    const statusMsg = currentLocation ? " - Now On Ticket" : "";
                    setCustomAlert({ show: true, message: `✅ Agent activity updated${statusMsg}`, type: "success" });
                    setCurrentTicketId("");
                    setCurrentLocation("");
                    setShowLocationModal(false);
                  } catch (e) {
                    setCustomAlert({ show: true, message: "Failed to update", type: "error" });
                  }
                }} style={{ flex: 1, padding: "10px 12px", background: "#10b981", border: "none", borderRadius: 6, color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 12 }}>💾 Save Activity</button>
                <button onClick={() => {
                  setShowLocationModal(false);
                  setCurrentTicketId("");
                  setCurrentLocation("");
                }} style={{ flex: 1, padding: "10px 12px", background: "#f3f4f6", border: "none", borderRadius: 6, color: "#374151", fontWeight: 600, cursor: "pointer", fontSize: 12 }}>Cancel</button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ✅ NEW: Close Ticket with Remark Modal */}
      <Modal open={showRemarkModal} onClose={() => { setShowRemarkModal(false); setTicketRemark(""); }} title="Close Ticket - Add Remark" width={500}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 8, display: "block" }}>📝 What have you done? (Mandatory)</label>
            <textarea
              value={ticketRemark}
              onChange={e => setTicketRemark(e.target.value)}
              placeholder="Describe what you did to resolve this ticket..."
              style={{
                width: "100%",
                minHeight: 120,
                padding: "12px",
                fontSize: 12,
                borderRadius: 6,
                border: "1px solid #e2e8f0",
                background: "#f8fafc",
                color: "#1e293b",
                fontFamily: "'DM Sans', sans-serif",
                resize: "vertical"
              }}
            />
            {!ticketRemark.trim() && (
              <div style={{ marginTop: 8, fontSize: 11, color: "#ef4444" }}>⚠️ Remark is mandatory before closing</div>
            )}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={closeTicketWithRemark}
              disabled={!ticketRemark.trim()}
              style={{
                flex: 1,
                padding: "10px 12px",
                background: ticketRemark.trim() ? "#22c55e" : "#cbd5e1",
                border: "none",
                borderRadius: 6,
                color: "#fff",
                fontWeight: 600,
                cursor: ticketRemark.trim() ? "pointer" : "not-allowed",
                fontSize: 12
              }}
            >
              ✅ Close & Save Remark
            </button>
            <button
              onClick={() => {
                setShowRemarkModal(false);
                setTicketRemark("");
              }}
              style={{
                flex: 1,
                padding: "10px 12px",
                background: "#f3f4f6",
                border: "none",
                borderRadius: 6,
                color: "#374151",
                fontWeight: 600,
                cursor: "pointer",
                fontSize: 12
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Custom Attributes Layout Designer Modal ── */}
      {showAttrLayoutModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100, padding: 16, backdropFilter: "blur(3px)" }}>
          <div style={{ background: "#fff", borderRadius: 18, width: "100%", maxWidth: 780, maxHeight: "92vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 30px 70px rgba(0,0,0,0.25)" }}>
            {/* Header */}
            <div style={{ padding: "18px 24px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0f172a" }}>📐 Form Layout Designer</h2>
                <p style={{ margin: "3px 0 0", fontSize: 12, color: "#64748b" }}>Drag fields between sections to set where they appear in the New Ticket form. Changes save on click.</p>
              </div>
              <button onClick={() => setShowAttrLayoutModal(false)} style={{ border: "none", background: "#f1f5f9", borderRadius: 8, width: 32, height: 32, cursor: "pointer", fontSize: 18, color: "#64748b", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

              {/* LEFT — New Ticket Preview */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Live Preview — New Ticket Form</div>
                <div style={{ border: "2px solid #e2e8f0", borderRadius: 12, overflow: "hidden", background: "#f8fafc" }}>
                  {/* Mock window bar */}
                  <div style={{ padding: "8px 12px", background: "#fff", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#ef4444" }} />
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#f59e0b" }} />
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e" }} />
                    <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: 6, fontWeight: 600 }}>Create New Ticket</span>
                  </div>
                  <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 4 }}>
                    {/* Fixed grid fields */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                      {["Organisation *", "Department", "POC", "Reported By", "Priority", "Category", "Location", "Due Date"].map(f => (
                        <div key={f} style={{ padding: "5px 8px", background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 5, fontSize: 10, color: "#94a3b8", fontWeight: 500 }}>{f}</div>
                      ))}
                      {/* Grid section custom fields */}
                      {layoutDraft.filter(a => (a.section || "grid") === "grid").map(a => (
                        <div key={a.id} style={{ padding: "5px 8px", background: "#eff6ff", border: "1.5px solid #bfdbfe", borderRadius: 5, fontSize: 10, color: "#1d4ed8", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                          <span style={{ fontSize: 9, color: "#6366f1" }}>⠿</span>{a.name}{a.required && <span style={{ color: "#ef4444" }}>*</span>}
                        </div>
                      ))}
                    </div>
                    {/* Assignees */}
                    <div style={{ padding: "5px 8px", background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 5, fontSize: 10, color: "#94a3b8", fontWeight: 500, marginTop: 4 }}>Assignees</div>
                    {/* Below-assignees custom fields */}
                    {layoutDraft.filter(a => (a.section || "grid") === "below-assignees").length > 0 && (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                        {layoutDraft.filter(a => (a.section || "grid") === "below-assignees").map(a => (
                          <div key={a.id} style={{ padding: "5px 8px", background: "#fffbeb", border: "1.5px solid #fde68a", borderRadius: 5, fontSize: 10, color: "#92400e", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                            <span style={{ fontSize: 9 }}>⠿</span>{a.name}{a.required && <span style={{ color: "#ef4444" }}>*</span>}
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Summary + Description */}
                    <div style={{ padding: "5px 8px", background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 5, fontSize: 10, color: "#94a3b8", fontWeight: 500, marginTop: 4 }}>Summary *</div>
                    <div style={{ padding: "5px 8px", background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 5, fontSize: 10, color: "#94a3b8", fontWeight: 500, height: 28 }}>Description</div>
                    {/* Bottom custom fields */}
                    {layoutDraft.filter(a => (a.section || "grid") === "bottom").length > 0 && (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                        {layoutDraft.filter(a => (a.section || "grid") === "bottom").map(a => (
                          <div key={a.id} style={{ padding: "5px 8px", background: "#f0fdf4", border: "1.5px solid #bbf7d0", borderRadius: 5, fontSize: 10, color: "#166534", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                            <span style={{ fontSize: 9 }}>⠿</span>{a.name}{a.required && <span style={{ color: "#ef4444" }}>*</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* RIGHT — Drag zones */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>Drag Fields Into Sections</div>

                {[
                  { key: "grid", label: "📋 Grid (top area)", subtitle: "Appears in the 2-column grid alongside Org, Priority, etc.", bg: "#eff6ff", border: "#bfdbfe", pillBg: "#dbeafe", pillText: "#1d4ed8" },
                  { key: "below-assignees", label: "👥 Below Assignees", subtitle: "Appears right after the Assignees field.", bg: "#fffbeb", border: "#fde68a", pillBg: "#fef3c7", pillText: "#92400e" },
                  { key: "bottom", label: "⬇️ After Description", subtitle: "Appears after the Description textarea.", bg: "#f0fdf4", border: "#bbf7d0", pillBg: "#dcfce7", pillText: "#166534" },
                ].map(zone => (
                  <div
                    key={zone.key}
                    onDragOver={e => { e.preventDefault(); setLayoutDragOver(zone.key); }}
                    onDragLeave={() => setLayoutDragOver(null)}
                    onDrop={e => {
                      e.preventDefault();
                      setLayoutDragOver(null);
                      if (layoutDragIdx === null) return;
                      const updated = layoutDraft.map((a, i) =>
                        i === layoutDragIdx ? { ...a, section: zone.key } : a
                      );
                      setLayoutDraft(updated);
                      setLayoutDragIdx(null);
                    }}
                    style={{ borderRadius: 10, border: `2px dashed ${layoutDragOver === zone.key ? "#3b82f6" : zone.border}`, background: layoutDragOver === zone.key ? "#eff6ff" : zone.bg, padding: 10, minHeight: 70, transition: "all 0.15s" }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 2 }}>{zone.label}</div>
                    <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 8 }}>{zone.subtitle}</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, minHeight: 28 }}>
                      {layoutDraft.filter(a => (a.section || "grid") === zone.key).length === 0 && (
                        <span style={{ fontSize: 11, color: "#cbd5e1", alignSelf: "center" }}>Drop fields here</span>
                      )}
                      {layoutDraft
                        .map((a, idx) => ({ ...a, _idx: idx }))
                        .filter(a => (a.section || "grid") === zone.key)
                        .map(a => (
                          <div
                            key={a.id}
                            draggable
                            onDragStart={e => { e.stopPropagation(); setLayoutDragIdx(a._idx); }}
                            style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", background: zone.pillBg, color: zone.pillText, borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: "grab", userSelect: "none", border: `1px solid ${zone.border}` }}
                          >
                            <span style={{ fontSize: 11, color: "#94a3b8" }}>⠿</span>
                            {a.name}{a.required && <span style={{ color: "#ef4444", marginLeft: 2 }}>*</span>}
                            <span style={{ fontSize: 9, background: "rgba(0,0,0,0.08)", padding: "1px 4px", borderRadius: 3, marginLeft: 2 }}>{a.type}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}

                {/* Reorder within section note */}
                <div style={{ padding: "8px 12px", background: "#f8fafc", borderRadius: 8, fontSize: 11, color: "#64748b" }}>
                  💡 Drag a field from one section to another to move it. Order within a section follows the list below.
                </div>

                {/* Order list */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#374151", marginBottom: 7, textTransform: "uppercase", letterSpacing: "0.04em" }}>Field Order (drag to reorder)</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    {layoutDraft.map((a, idx) => (
                      <div
                        key={a.id}
                        draggable
                        onDragStart={() => setLayoutDragIdx(idx)}
                        onDragOver={e => { e.preventDefault(); setLayoutDragOver(`order-${idx}`); }}
                        onDragLeave={() => setLayoutDragOver(null)}
                        onDrop={e => {
                          e.preventDefault();
                          setLayoutDragOver(null);
                          if (layoutDragIdx === null || layoutDragIdx === idx) return;
                          const arr = [...layoutDraft];
                          const moved = arr.splice(layoutDragIdx, 1)[0];
                          arr.splice(idx, 0, moved);
                          setLayoutDraft(arr);
                          setLayoutDragIdx(null);
                        }}
                        style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", background: layoutDragOver === `order-${idx}` ? "#eff6ff" : "#fafafa", border: `1.5px solid ${layoutDragOver === `order-${idx}` ? "#3b82f6" : "#f1f5f9"}`, borderRadius: 7, cursor: "grab", userSelect: "none", transition: "all 0.1s" }}
                      >
                        <span style={{ color: "#cbd5e1", fontSize: 14 }}>⠿</span>
                        <span style={{ fontSize: 12, fontWeight: 600, flex: 1 }}>{a.name}{a.required && <span style={{ color: "#ef4444", marginLeft: 2 }}>*</span>}</span>
                        <span style={{ fontSize: 10, color: "#94a3b8" }}>{a.type}</span>
                        {(() => {
                          const sc = a.section || "grid";
                          const c = sc === "grid" ? "#6366f1" : sc === "below-assignees" ? "#f59e0b" : "#10b981";
                          const lbl = sc === "grid" ? "Grid" : sc === "below-assignees" ? "Below Assignees" : "After Description";
                          return <span style={{ fontSize: 10, fontWeight: 700, color: c, background: c + "18", padding: "2px 7px", borderRadius: 99 }}>{lbl}</span>;
                        })()}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: "14px 24px", borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "flex-end", gap: 9, flexShrink: 0, background: "#fff" }}>
              <button onClick={() => setShowAttrLayoutModal(false)} style={bG}>Cancel</button>
              <button onClick={saveLayoutDraft} style={bP}>💾 Save Layout</button>
            </div>
          </div>
        </div>
      )}

      {/* ✅ NEW: Activity Log Modal */}
      {showActivityLog && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000 }}>
          <div style={{ background: "#fff", borderRadius: 12, width: "90%", maxWidth: 600, maxHeight: "80vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            {/* Header */}
            <div style={{ padding: "20px 24px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#0f172a" }}>📋 Activity Log</h2>
              <button onClick={() => setShowActivityLog(false)} style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", color: "#94a3b8" }}>×</button>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
              {activityLogs && activityLogs.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {activityLogs.slice().reverse().map((log, idx) => (
                    <div key={idx} style={{ padding: 12, background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                        <span style={{ fontWeight: 600, color: "#0f172a" }}>{log.action}</span>
                        <span style={{ fontSize: 12, color: "#94a3b8" }}>
                          {new Date(log.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: "#475569" }}>
                        {log.details && Object.entries(log.details).map(([key, val]) => (
                          val && <div key={key}><strong>{key}:</strong> {String(val)}</div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: "center", color: "#94a3b8", padding: 40 }}>
                  No activity logged yet
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: "14px 24px", borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "flex-end" }}>
              <button onClick={() => setShowActivityLog(false)} style={{ padding: "8px 16px", background: "#e2e8f0", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600, color: "#334155" }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ✅ NEW: Session History Modal */}
      {showSessionHistory && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000 }}>
          <div style={{ background: "#fff", borderRadius: 12, width: "90%", maxWidth: 600, maxHeight: "80vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            {/* Header */}
            <div style={{ padding: "20px 24px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#0f172a" }}>⏱️ Session History</h2>
              <button onClick={() => setShowSessionHistory(false)} style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", color: "#94a3b8" }}>×</button>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
              {sessionHistory && sessionHistory.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {sessionHistory.slice().reverse().map((session, idx) => (
                    <div key={idx} style={{ padding: 12, background: "#f3e8ff", borderRadius: 8, border: "1px solid #e9d5ff" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                        <span style={{ fontWeight: 600, color: "#6b21a8" }}>Session {idx + 1}</span>
                        <span style={{ fontSize: 12, color: "#94a3b8" }}>
                          Login: {new Date(session.loginTime).toLocaleString()}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: "#475569", display: "flex", flexDirection: "column", gap: 4 }}>
                        <div><strong>Duration:</strong> {session.duration || "Active"}</div>
                        <div><strong>Status at Logout:</strong> {session.logoutStatus || "N/A"}</div>
                        <div><strong>Location:</strong> {session.lastLocation || "Not Set"}</div>
                        {session.logoutReason && <div><strong>Logout Reason:</strong> {session.logoutReason}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: "center", color: "#94a3b8", padding: 40 }}>
                  No session history available
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: "14px 24px", borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "flex-end" }}>
              <button onClick={() => setShowSessionHistory(false)} style={{ padding: "8px 16px", background: "#e2e8f0", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600, color: "#334155" }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast Notifications ── */}
      <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", zIndex: 9999, display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
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
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes floatIn {
          from { opacity: 0; transform: translateY(-18px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes shrink30 {
          from { width: 100%; }
          to { width: 0%; }
        }
        @keyframes strikeThrough {
          0% {
            textDecoration: none;
            transform: scaleX(0);
            opacity: 1;
          }
          50% {
            textDecoration: line-through;
            transform: scaleX(1);
            opacity: 1;
          }
          100% {
            textDecoration: line-through;
            transform: scaleX(1);
            opacity: 0.6;
          }
        }
      `}</style>
    </div>
  );
}