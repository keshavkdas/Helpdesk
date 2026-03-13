import { useState, useMemo, useEffect, useRef } from "react";
import { USERS_API, ORGS_API, CATEGORIES_API, CUSTOM_ATTRS_API, TICKETS_API, DB_API, AUTH_API } from "./src/api";

const DEPARTMENTS = ["IT", "HR", "Finance", "Operations", "Sales", "Marketing", "Legal", "Support"];
const PRIORITIES = ["Low", "Medium", "High", "Critical"];
const STATUSES = ["Open", "In Progress", "Pending", "Resolved", "Closed"];
const ROLES = ["Admin", "Manager", "Agent", "Viewer"];

const PRIORITY_COLOR = { Low: "#22c55e", Medium: "#f59e0b", High: "#f97316", Critical: "#ef4444" };
const STATUS_COLOR = {
  Open: { bg: "#dbeafe", text: "#1d4ed8" },
  "In Progress": { bg: "#fef9c3", text: "#854d0e" },
  Pending: { bg: "#ede9fe", text: "#6d28d9" },
  Resolved: { bg: "#dcfce7", text: "#15803d" },
  Closed: { bg: "#f1f5f9", text: "#64748b" },
};

const TICKET_VIEWS = [
  { id: "open", label: "Open Tickets", icon: "📬", desc: "All open tickets", filter: t => t.status === "Open" },
  { id: "waiting", label: "Waiting Tickets", icon: "⏳", desc: "Tickets in Pending state", filter: t => t.status === "Pending" },
  { id: "closed", label: "Closed Tickets", icon: "✅", desc: "Closed & resolved tickets", filter: t => t.status === "Closed" || t.status === "Resolved" },
  { id: "unassigned", label: "Unassigned", icon: "👤", desc: "Open/waiting with no assignee", filter: t => (t.status === "Open" || t.status === "Pending") && (!t.assignees || t.assignees.length === 0) },
  { id: "mine", label: "My Tickets", icon: "🙋", desc: "Open/waiting assigned to me", filter: (t, me) => (t.status === "Open" || t.status === "Pending") && t.assignees?.some(a => a.id === me?.id) },
  { id: "all", label: "All Tickets", icon: "◈", desc: "Every ticket in the system", filter: () => true },
  { id: "alerts", label: "Active Alerts", icon: "🔔", desc: "Critical tickets with active alerts", filter: t => t.priority === "Critical" && t.status !== "Closed" && t.status !== "Resolved" },
  { id: "pastdue", label: "Past Due", icon: "🔴", desc: "Open tickets older than 5 days", filter: t => t.status === "Open" && (Date.now() - new Date(t.created).getTime()) > 5 * 86400000 },
];

function exportCSV(tickets) {
  const h = ["ID", "Summary", "Organisation", "Department", "Contact", "Reported By", "Assignees", "Priority", "Category", "Status", "Created", "Updated"];
  const rows = tickets.map(t => [t.id, `"${t.summary}"`, t.org, t.department || "", t.contact || "", t.reportedBy || "", `"${(t.assignees || []).map(a => a.name).join("; ")}"`, t.priority, t.category, t.status, new Date(t.created).toLocaleString(), new Date(t.updated).toLocaleString()]);
  const csv = [h, ...rows].map(r => r.join(",")).join("\n");
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = "tickets.csv"; a.click();
}
function exportJSON(tickets) {
  const data = tickets.map(t => ({ ...t, assignees: (t.assignees || []).map(a => ({ id: a.id, name: a.name, role: a.role })) }));
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })); a.download = "tickets.json"; a.click();
}
function exportPrint(tickets) {
  const rows = tickets.map(t => `<tr><td>${t.id}</td><td>${t.summary}</td><td>${t.org}</td><td>${t.priority}</td><td>${t.status}</td><td>${new Date(t.created).toLocaleDateString()}</td></tr>`).join("");
  const w = window.open("", "_blank");
  w.document.write(`<html><head><title>Tickets</title><style>body{font-family:sans-serif;font-size:12px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}th{background:#f1f5f9}</style></head><body><h2>Tickets Export — ${new Date().toLocaleDateString()}</h2><p>${tickets.length} tickets</p><table><thead><tr><th>ID</th><th>Summary</th><th>Org</th><th>Priority</th><th>Status</th><th>Created</th></tr></thead><tbody>${rows}</tbody></table></body></html>`);
  w.document.close(); w.print();
}

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
const FF = ({ label, required, children }) => <div style={{ marginBottom: 14 }}>
  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#475569", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}{required && <span style={{ color: "#ef4444", marginLeft: 2 }}>*</span>}</label>
  {children}
</div>;
const BarChart = ({ data, color = "#3b82f6" }) => {
  const max = Math.max(...data.map(d => d.value), 1);
  return <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 78, padding: "0 2px" }}>
    {data.map((d, i) => <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
      <div style={{ width: "100%", height: Math.max((d.value / max) * 68, 2), background: color, borderRadius: "3px 3px 0 0" }} />
      <span style={{ fontSize: 9, color: "#94a3b8", whiteSpace: "nowrap" }}>{d.label}</span>
    </div>)}
  </div>;
};
const DonutChart = ({ data }) => {
  const total = data.reduce((s, d) => s + d.value, 0); let offset = 0;
  const r = 36, circ = 2 * Math.PI * r;
  const segs = data.map(d => { const p = total ? d.value / total : 0; const dash = p * circ; const s = { ...d, dash, gap: circ - dash, offset: offset * circ }; offset += p; return s; });
  return <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
    <svg width={90} height={90} viewBox="0 0 90 90">
      <circle cx={45} cy={45} r={r} fill="none" stroke="#f1f5f9" strokeWidth={14} />
      {segs.map((s, i) => <circle key={i} cx={45} cy={45} r={r} fill="none" stroke={s.color} strokeWidth={14} strokeDasharray={`${s.dash} ${s.gap}`} strokeDashoffset={-s.offset + circ / 4} />)}
      <text x={45} y={49} textAnchor="middle" fill="#1e293b" fontSize={14} fontWeight="700">{total}</text>
    </svg>
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      {data.map((d, i) => <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: 2, background: d.color }} /><span style={{ fontSize: 11, color: "#64748b" }}>{d.label}</span><span style={{ fontSize: 11, fontWeight: 700, color: "#1e293b", marginLeft: 4 }}>{d.value}</span>
      </div>)}
    </div>
  </div>;
};

export default function HelpDesk() {
  const [users, setUsers] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [customAttrs, setCustomAttrs] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  const [view, setView] = useState("dashboard");
  const [settingsTab, setSettingsTab] = useState("ticketviews");
  const [tvFilter, setTvFilter] = useState("all");
  const [range, setRange] = useState("30");
  const [statusF, setStatusF] = useState("All");
  const [priorityF, setPriorityF] = useState("All");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showExport, setShowExport] = useState(false);
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [selTicket, setSelTicket] = useState(null);

  const [currentUser, setCurrentUser] = useState(null);
  const [newComment, setNewComment] = useState("");
  const [assigneeSearch, setAssigneeSearch] = useState("");
  const [showAssigneeDD, setShowAssigneeDD] = useState(false);
  const emptyForm = { org: "", department: "", contact: "", reportedBy: "", summary: "", description: "", assignees: [], cc: [], priority: "Medium", category: "", customAttrs: {}, dueDate: "" };
  const [form, setForm] = useState(emptyForm);
  const [ccInput, setCcInput] = useState("");
  const [newOrg, setNewOrg] = useState({ name: "", domain: "", phone: "" });
  const [newCat, setNewCat] = useState({ name: "", color: "#3b82f6" });
  const [newUser, setNewUser] = useState({ name: "", email: "", role: "Agent" });
  const [newAttr, setNewAttr] = useState({ name: "", type: "text", options: "", required: false });

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await DB_API.getAllData();
      setUsers(data.users || []);
      setOrgs(data.orgs || []);
      setCategories(data.categories || []);
      setCustomAttrs(data.customAttrs || []);
      const parsedTickets = (data.tickets || []).map(t => ({
        ...t,
        created: new Date(t.created),
        updated: new Date(t.updated)
      })).sort((a, b) => b.created - a.created);
      setTickets(parsedTickets);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const now = Date.now(), dayMs = 86400000, rangeMs = parseInt(range) * dayMs;
  const fbr = useMemo(() => {
    const inRange = tickets.filter(t => now - t.created.getTime() <= rangeMs);
    if (currentUser?.role === "Admin") return inRange;
    // Agent only sees assigned or reported
    return inRange.filter(t => t.reportedBy === currentUser?.name || t.assignees?.some(a => a.id === currentUser?.id));
  }, [tickets, rangeMs, now, currentUser]);

  const cvd = TICKET_VIEWS.find(v => v.id === tvFilter) || TICKET_VIEWS[5];

  const filtered = useMemo(() => tickets.filter(t => {
    if (!currentUser || !cvd.filter(t, currentUser)) return false;
    if (currentUser.role === "Agent" && t.reportedBy !== currentUser.name && !t.assignees?.some(a => a.id === currentUser.id)) return false;
    if (statusF !== "All" && t.status !== statusF) return false;
    if (priorityF !== "All" && t.priority !== priorityF) return false;
    if (search && !t.summary.toLowerCase().includes(search.toLowerCase()) && !t.id.toLowerCase().includes(search.toLowerCase()) && !t.org.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [tickets, cvd, currentUser, statusF, priorityF, search]);

  const stats = useMemo(() => ({ total: fbr.length, open: fbr.filter(x => x.status === "Open").length, inProgress: fbr.filter(x => x.status === "In Progress").length, resolved: fbr.filter(x => x.status === "Resolved" || x.status === "Closed").length, critical: fbr.filter(x => x.priority === "Critical").length }), [fbr]);
  const agentStats = useMemo(() => users.map(u => ({ ...u, assigned: fbr.filter(t => t.assignees?.some(a => a.id === u.id)).length, resolved: fbr.filter(t => t.assignees?.some(a => a.id === u.id) && (t.status === "Resolved" || t.status === "Closed")).length })), [fbr, users]);
  const dailyData = useMemo(() => { const days = parseInt(range) <= 7 ? parseInt(range) : 7; return Array.from({ length: days }, (_, i) => { const d = new Date(now - (days - 1 - i) * dayMs); return { label: d.toLocaleDateString("en", { weekday: "short" }), value: fbr.filter(t => t.created.getDate() === d.getDate() && t.created.getMonth() === d.getMonth()).length }; }); }, [fbr, range, now, dayMs]);
  const priorityDist = useMemo(() => PRIORITIES.map(p => ({ label: p, value: fbr.filter(t => t.priority === p).length, color: PRIORITY_COLOR[p] })), [fbr]);
  const categoryDist = useMemo(() => categories.slice(0, 6).map(c => ({ label: c.name, value: fbr.filter(t => t.category === c.name).length, color: c.color })), [fbr, categories]);

  const handleImportCSV = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const rows = event.target.result.split("\n").slice(1); // Skip header
      for (const row of rows) {
        const cols = row.split(",");
        if (cols[1]) { // If summary exists
          await TICKETS_API.create({
            summary: cols[1].replace(/"/g, ""),
            org: cols[2] || "Imported",
            status: "Open",
            created: new Date().toISOString(),
            updated: new Date().toISOString()
          });
        }
      }
      loadData(); // Refresh the list
      alert("Import complete!");
    };
    reader.readAsText(file);
  };

  const handleSubmit = async () => {
    if (!form.summary || !form.org) return alert("Organisation and Summary are required");
    const newT = {
      id: `TKT-${String(1000 + tickets.length + 1).padStart(4, "0")}`,
      ...form, status: "Open", created: new Date().toISOString(), updated: new Date().toISOString(), comments: [],
      timeline: [{ action: "Created", by: currentUser.name, date: new Date().toISOString(), note: "Ticket opened." }]
    };
    try {
      const created = await TICKETS_API.create(newT);
      setTickets(prev => [{ ...created, created: new Date(created.created), updated: new Date(created.updated) }, ...prev]);
      setShowNewTicket(false); setForm(emptyForm); setAssigneeSearch(""); setShowAssigneeDD(false);
    } catch (e) { alert("Failed to save ticket"); }
  };
  const toggleAssignee = u => { const e = form.assignees.find(a => a.id === u.id); setForm({ ...form, assignees: e ? form.assignees.filter(a => a.id !== u.id) : [...form.assignees, u] }); };
  const addCC = () => { if (ccInput && !form.cc.includes(ccInput)) { setForm({ ...form, cc: [...form.cc, ccInput] }); setCcInput(""); } };
  const updateStatus = async (id, status) => {
    const t = tickets.find(x => x.id === id); if (!t) return;
    try {
      const nowISO = new Date().toISOString();
      const newTimelineEvent = { action: `Status changed to ${status}`, by: currentUser.name, date: nowISO, note: "" };
      const updatedT = { ...t, status, updated: nowISO, timeline: [...(t.timeline || []), newTimelineEvent] };
      await TICKETS_API.update(id, updatedT);
      setTickets(p => p.map(x => x.id === id ? { ...updatedT, updated: new Date(nowISO) } : x));
      if (selTicket?.id === id) setSelTicket(updatedT);
    } catch (e) { alert("Failed to update"); }
  };
  const toggleSel = id => { const s = new Set(selectedIds); s.has(id) ? s.delete(id) : s.add(id); setSelectedIds(s); };
  const toggleAll = () => selectedIds.size === filtered.length && filtered.length > 0 ? setSelectedIds(new Set()) : setSelectedIds(new Set(filtered.map(t => t.id)));
  const selTickets = filtered.filter(t => selectedIds.has(t.id));

  const addOrg = async () => {
    if (!newOrg.name) return;
    const created = await ORGS_API.create(newOrg);
    setOrgs([...orgs, created]); setNewOrg({ name: "", domain: "", phone: "" });
  };
  const addCat = async () => {
    if (!newCat.name) return;
    const created = await CATEGORIES_API.create(newCat);
    setCategories([...categories, created]); setNewCat({ name: "", color: "#3b82f6" });
  };
  const addUser = async () => {
    if (!newUser.name || !newUser.email) return;
    const created = await USERS_API.create({ ...newUser, active: true });
    setUsers([...users, created]); setNewUser({ name: "", email: "", role: "Agent" });
  };
  const addAttr = async () => {
    if (!newAttr.name) return;
    const created = await CUSTOM_ATTRS_API.create({ ...newAttr, options: typeof newAttr.options === "string" ? newAttr.options.split(",").map(s => s.trim()).filter(Boolean) : [] });
    setCustomAttrs([...customAttrs, created]); setNewAttr({ name: "", type: "text", options: "", required: false });
  };

  const [projects, setProjects] = useState([]);

  const sideNav = [{ id: "dashboard", label: "Dashboard", icon: "▦" }, { id: "projects", label: "Projects", icon: "⎙" }, { id: "tickets", label: "All Tickets", icon: "◈" }, { id: "reports", label: "Reports", icon: "◉" }, { id: "users", label: "Agents", icon: "◎" }, { id: "settings", label: "Settings", icon: "⚙" }];
  const stabs = [{ id: "ticketviews", label: "Ticket Views", icon: "👁" }, { id: "organisations", label: "Organisations", icon: "🏢" }, { id: "categories", label: "Categories", icon: "🏷" }, { id: "usermgmt", label: "User Management", icon: "👥" }, { id: "customattrs", label: "Custom Attributes", icon: "✏️" }, { id: "dbmgmt", label: "Database Mgmt", icon: "💾" }];

  // Auth UI State
  const [isLogin, setIsLogin] = useState(true);
  const [authForm, setAuthForm] = useState({ email: "", password: "", firstName: "", middleName: "", lastName: "", countryCode: "+1", phone: "", confirm: "" });
  const [authError, setAuthError] = useState("");
  const [authMessage, setAuthMessage] = useState("");

  // Password Strength Logic
  const calcPwdStr = (pwd) => {
    if (!pwd) return 0;
    let s = 0;
    if (pwd.length >= 8) s += 25;
    if (/[A-Z]/.test(pwd)) s += 25;
    if (/[a-z]/.test(pwd)) s += 25;
    if (/[^A-Za-z0-9]/.test(pwd)) s += 25;
    return s;
  };
  const pwdStr = useMemo(() => calcPwdStr(authForm.password), [authForm.password]);
  const pwdColor = pwdStr <= 25 ? "#ef4444" : pwdStr <= 50 ? "#f59e0b" : pwdStr <= 75 ? "#eab308" : "#22c55e";

  // Forwarding State
  const [showForward, setShowForward] = useState(false);
  const [fwdType, setFwdType] = useState("Agent"); // "Agent" or "Vendor"
  const [fwdReason, setFwdReason] = useState("");
  const [fwdTargetAgent, setFwdTargetAgent] = useState("");
  const [fwdVendorName, setFwdVendorName] = useState("");
  const [fwdVendorEmail, setFwdVendorEmail] = useState("");

  // ADD THESE TWO IN PLACE OF THE OLD handleForward
  const handleForwardToAgent = async (agentId) => {
    if (!fwdReason.trim()) return alert("Reason is required.");
    if (!agentId) return alert("Please select an agent.");

    const t = selTicket;
    try {
      const agent = users.find(u => u.id === agentId);
      const now = new Date().toISOString();

      const update = {
        ...t,
        assignees: [agent],
        updated: now,
        timeline: [...(t.timeline || []), {
          action: `Forwarded to Agent: ${agent.name}`,
          by: currentUser.name,
          date: now,
          note: fwdReason
        }]
      };

      await TICKETS_API.update(t.id, update);
      setTickets(p => p.map(x => x.id === t.id ? { ...update, updated: new Date(now) } : x));
      setSelTicket(update);
      setShowForward(false);
      setFwdReason("");
    } catch (e) { alert("Forwarding failed"); }
  };

  const handleSendForRepair = async (vendorName, contactInfo) => {
    if (!vendorName) return alert("Vendor name is required.");

    const t = selTicket;
    try {
      const now = new Date().toISOString();
      const update = {
        ...t,
        status: "Pending", // Or your preferred status for repair
        updated: now,
        timeline: [...(t.timeline || []), {
          action: `Sent for Repair: ${vendorName}`,
          by: currentUser.name,
          date: now,
          note: `Contact: ${contactInfo}`
        }]
      };

      await TICKETS_API.update(t.id, update);
      setTickets(p => p.map(x => x.id === t.id ? { ...update, updated: new Date(now) } : x));
      setSelTicket(update);
      // Add logic here to close the Repair modal if you have one
    } catch (e) { alert("Repair update failed"); }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError(""); setAuthMessage("");
    try {
      const u = await AUTH_API.login(authForm.email, authForm.password);
      // Automation: Set to Active on Login
      const updatedUser = { ...u, status: "Active" };
      await USERS_API.update(u.id, updatedUser);
      setCurrentUser(updatedUser);
    } catch (err) { setAuthError(err.message); }
  };

  const handleLogout = async () => {
    if (currentUser) {
      try {
        // Automation: Set to Not Active on Logout
        await USERS_API.update(currentUser.id, { ...currentUser, status: "Not Active" });
      } catch (e) { console.error("Logout status update failed"); }
    }
    setCurrentUser(null);
    setProfileOpen(false);
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setAuthError(""); setAuthMessage("");
    if (authForm.password !== authForm.confirm) return setAuthError("Passwords do not match");
    if (!authForm.firstName || !authForm.lastName || !authForm.email || !authForm.password) return setAuthError("Please fill required fields");

    try {
      // Check current users to see if anyone exists
      const allUsers = await USERS_API.getAll();
      const isFirstUser = allUsers.length === 0;

      const payload = {
        id: Math.random().toString(36).substr(2, 9),
        name: `${authForm.firstName} ${authForm.middleName ? authForm.middleName + " " : ""}${authForm.lastName}`.trim(),
        email: authForm.email,
        phone: `${authForm.countryCode} ${authForm.phone}`.trim(),
        password: authForm.password,
        // Change: Automation logic
        role: isFirstUser ? "Admin" : "Agent",
        active: true,
        status: "Active",
        confirmed: true // Automated confirmation for new flow
      };

      await USERS_API.create(payload);
      setAuthMessage(`Account created! You are registered as ${payload.role}.`);
      await loadData();
      // Switch to login automatically after success
      setTimeout(() => setIsLogin(true), 1500);
    } catch (err) {
      setAuthError("Registration failed. Please try again.");
    }
  };

  // Profile Expand State
  const [profileOpen, setProfileOpen] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({ phone: "", name: "" });

  const saveProfile = async () => {
    try {
      const up = { ...currentUser, phone: profileForm.phone, name: profileForm.name };
      await USERS_API.update(currentUser.id, up);
      setCurrentUser(up);
      setUsers(users.map(u => u.id === currentUser.id ? up : u));
      setEditProfileOpen(false);
    } catch (err) { alert("Failed to save profile"); }
  };

  const updateStatusDirect = async (st) => {
    try {
      const up = { ...currentUser, status: st };
      await USERS_API.update(currentUser.id, up);
      setCurrentUser(up);
      setUsers(users.map(u => u.id === currentUser.id ? up : u));
    } catch (err) { alert("Failed to update status"); }
  };

  const statusOpts = [{ l: "Active", c: "#22c55e", bg: "#dcfce7" }, { l: "Not Active", c: "#ef4444", bg: "#fee2e2" }, { l: "Rest", c: "#f59e0b", bg: "#fef3c7" }];

  if (loading) return <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans',sans-serif", background: "#f8fafc", color: "#64748b", fontSize: 18, fontWeight: 600 }}>Loading DeskFlow Data...</div>;

  if (!currentUser) return (
    <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center", background: "#f8fafc", fontFamily: "'DM Sans',sans-serif", perspective: "1000px" }}>
      <div style={{ width: "100%", maxWidth: 400, position: "relative", transition: "transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)", transformStyle: "preserve-3d", transform: isLogin ? "rotateY(0deg)" : "rotateY(-180deg)" }}>

        {/* FRONT: LOGIN */}
        <div style={{ background: "#fff", padding: 40, borderRadius: 20, boxShadow: "0 10px 40px rgba(0,0,0,0.08)", backfaceVisibility: "hidden", position: isLogin ? "relative" : "absolute", top: 0, left: 0, width: "100%" }}>
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
            <div style={{ marginTop: 16, textAlign: 'center' }}>
              <button type="button" onClick={() => { setAuthForm({ email: "", password: "", firstName: "", middleName: "", lastName: "", countryCode: "+1", phone: "", confirm: "", requestRole: "Agent" }); setIsLogin(false); setAuthError(""); setAuthMessage(""); }} style={{ ...bG, border: "none", color: "#64748b", padding: 0, fontSize: 12 }}>Need an account? Sign up</button>
            </div>
          </form>
        </div>

        {/* BACK: SIGNUP */}
        <div style={{ background: "#fff", padding: 40, borderRadius: 20, boxShadow: "0 10px 40px rgba(0,0,0,0.08)", backfaceVisibility: "hidden", transform: "rotateY(180deg)", position: !isLogin ? "relative" : "absolute", top: 0, left: 0, width: "100%" }}>
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
            <FF label="Phone">
              <div style={{ display: "flex", gap: 6 }}>
                <select style={{ ...sS, width: 70, padding: "9px 6px" }} value={authForm.countryCode} onChange={e => setAuthForm({ ...authForm, countryCode: e.target.value })}>
                  <option value="+1">+1</option><option value="+44">+44</option><option value="+91">+91</option><option value="+61">+61</option><option value="+81">+81</option>
                </select>
                <input style={{ ...iS, flex: 1 }} value={authForm.phone} onChange={e => setAuthForm({ ...authForm, phone: e.target.value })} />
              </div>
            </FF>
            <FF label="Email"><input type="email" required style={iS} value={authForm.email} onChange={e => setAuthForm({ ...authForm, email: e.target.value })} /></FF>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 10px" }}>
              <FF label="Password" required>
                <input type="password" required style={{ ...iS, border: authForm.password && authForm.password !== authForm.confirm ? "1px solid #ef4444" : "1px solid #e2e8f0" }} value={authForm.password} onChange={e => setAuthForm({ ...authForm, password: e.target.value })} />
                <div style={{ marginTop: 4, height: 4, background: "#e2e8f0", borderRadius: 2, overflow: "hidden" }}><div style={{ height: "100%", width: `${pwdStr}%`, background: pwdColor, transition: "all 0.3s" }} /></div>
              </FF>
              <FF label="Confirm" required>
                <input type="password" required style={{ ...iS, border: authForm.confirm && authForm.password !== authForm.confirm ? "1px solid #ef4444" : "1px solid #e2e8f0" }} value={authForm.confirm} onChange={e => setAuthForm({ ...authForm, confirm: e.target.value })} />
              </FF>
            </div>
            {authForm.confirm && authForm.password !== authForm.confirm && <div style={{ color: "#ef4444", fontSize: 11, marginTop: -6, marginBottom: 10 }}>Passwords do not match</div>}
            <button type="submit" disabled={authForm.password !== authForm.confirm} style={{ ...bP, width: "100%", marginTop: 4, padding: 12, opacity: authForm.password !== authForm.confirm ? 0.5 : 1 }}>Sign Up</button>
            <div style={{ marginTop: 12, textAlign: 'center' }}>
              <button type="button" onClick={() => { setAuthForm({ email: "", password: "", firstName: "", middleName: "", lastName: "", countryCode: "+1", phone: "", confirm: "", requestRole: "Admin" }); setIsLogin(true); setAuthError(""); setAuthMessage(""); }} style={{ ...bG, border: "none", color: "#64748b", padding: 0, fontSize: 12 }}>Already have an account? Log in</button>
            </div>
          </form>
        </div>

      </div>
    </div>
  );

  const thStyle = { padding: "9px 11px", textAlign: "left", fontSize: 10, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #f1f5f9", whiteSpace: "nowrap" };
  const tdStyle = { padding: "10px 11px", borderBottom: "1px solid #f8fafc", fontSize: 13 };

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "'DM Sans',sans-serif", background: "#f8fafc", color: "#1e293b", overflow: "hidden" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');*{box-sizing:border-box}::-webkit-scrollbar{width:5px;height:5px}::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:3px}input:focus,select:focus,textarea:focus{border-color:#3b82f6!important;outline:none;background:#fff!important}.rh:hover td{background:#f8fafc!important}`}</style>

      {/* SIDEBAR */}
      <div style={{ width: 220, background: "#0f172a", display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "18px 18px 14px", borderBottom: "1px solid #1e293b" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, background: "linear-gradient(135deg,#3b82f6,#8b5cf6)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "#fff" }}>⚡</div>
            <div><div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>DeskFlow</div><div style={{ fontSize: 10, color: "#475569" }}>Help Desk Pro</div></div>
          </div>
        </div>
        <div style={{ padding: "8px 8px 0", flex: 1, overflow: "auto" }}>
          {sideNav.map(n => (
            <button key={n.id} onClick={() => setView(n.id)} style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "8px 11px", borderRadius: 7, border: "none", cursor: "pointer", background: view === n.id ? "#1e293b" : "transparent", color: view === n.id ? "#60a5fa" : "#64748b", fontSize: 13, fontWeight: view === n.id ? 600 : 400, marginBottom: 2, textAlign: "left", fontFamily: "'DM Sans',sans-serif" }}>
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
        </div>
        <div style={{ padding: "8px 8px 10px" }}>
          <button onClick={() => setShowNewTicket(true)} style={{ width: "100%", padding: "9px", borderRadius: 9, border: "none", background: "linear-gradient(135deg,#3b82f6,#6366f1)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>+ New Ticket</button>
        </div>
        <div style={{ padding: "8px 12px 14px", borderTop: "1px solid #1e293b" }}>
          <div onClick={() => setProfileOpen(!profileOpen)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px", borderRadius: 8, cursor: "pointer", background: profileOpen ? "#1e293b" : "transparent", transition: "background 0.2s" }}>
            <Avatar name={currentUser.name} size={30} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{currentUser.name}</div>
              <div style={{ fontSize: 10, color: "#94a3b8", display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: statusOpts.find(s => s.l === currentUser.status)?.c || "#94a3b8" }} />
                {currentUser.role}
              </div>
            </div>
            <span style={{ color: "#475569", fontSize: 12 }}>{profileOpen ? "▴" : "▾"}</span>
          </div>
          {profileOpen && (
            <div style={{ marginTop: 8, background: "#1e293b", borderRadius: 8, padding: "8px", animation: "fadeIn 0.2s" }}>
              <button onClick={() => { setProfileForm({ name: currentUser.name, phone: currentUser.phone || "" }); setEditProfileOpen(true); }} style={{ width: "100%", padding: "6px 10px", background: "#334155", border: "none", borderRadius: 6, color: "#f8fafc", fontSize: 12, fontWeight: 600, cursor: "pointer", marginBottom: 8, textAlign: "left" }}>👤 View Profile</button>
              <div style={{ fontSize: 10, fontWeight: 600, color: "#94a3b8", marginBottom: 6, textTransform: "uppercase", padding: "0 4px" }}>Set Status</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {statusOpts.map(s => (
                  <button key={s.l} onClick={() => updateStatusDirect(s.l)} style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "none", padding: "4px 8px", borderRadius: 4, cursor: "pointer", color: currentUser.status === s.l ? s.c : "#cbd5e1" }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.c, boxShadow: currentUser.status === s.l ? `0 0 0 2px ${s.bg}` : "none" }} />
                    <span style={{ fontSize: 11, fontWeight: currentUser.status === s.l ? 700 : 500 }}>{s.l}</span>
                  </button>
                ))}
              </div>
              <button onClick={() => setCurrentUser(null)} style={{ width: "100%", padding: "6px 10px", background: "transparent", border: "none", color: "#ef4444", fontSize: 12, fontWeight: 600, cursor: "pointer", marginTop: 8, textAlign: "left", borderTop: "1px solid #334155", paddingTop: 8 }}>Log Out</button>
            </div>
          )}
        </div>
      </div>

      {/* Profile Modal */}
      <Modal open={editProfileOpen} onClose={() => setEditProfileOpen(false)} title="My Profile" width={400}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
          <Avatar name={currentUser.name} size={64} />
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#0f172a" }}>{currentUser.name}</div>
            <div style={{ fontSize: 13, color: "#64748b" }}>{currentUser.role}</div>
          </div>
        </div>
        <div style={{ marginBottom: 18, padding: "10px 14px", background: "#f8fafc", borderRadius: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", marginBottom: 2 }}>Email Address (Unchangeable)</div>
          <div style={{ fontSize: 13, color: "#334155", fontWeight: 500 }}>{currentUser.email}</div>
        </div>
        <FF label="Full Name"><input style={iS} value={profileForm.name} onChange={e => setProfileForm({ ...profileForm, name: e.target.value })} /></FF>
        <FF label="Phone Number"><input style={iS} value={profileForm.phone} onChange={e => setProfileForm({ ...profileForm, phone: e.target.value })} /></FF>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
          <button onClick={() => setEditProfileOpen(false)} style={bG}>Cancel</button>
          <button onClick={saveProfile} style={bP}>Save Changes</button>
        </div>
      </Modal>

      {/* MAIN */}
      <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column" }}>
        <div style={{ background: "#fff", borderBottom: "1px solid #f1f5f9", padding: "11px 22px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{view === "dashboard" ? "Dashboard" : view === "tickets" ? cvd.label : view === "reports" ? "Reports" : view === "users" ? "Agents" : "Settings"}</h1>
            {view === "tickets" && <p style={{ margin: 0, fontSize: 11, color: "#94a3b8" }}>{cvd.desc}</p>}
          </div>
          <div style={{ display: "flex", gap: 9, alignItems: "center" }}>
            {(view === "dashboard" || view === "reports") && <select value={range} onChange={e => setRange(e.target.value)} style={{ ...sS, width: 128, fontSize: 13, padding: "7px 10px" }}><option value="1">Today</option><option value="7">Last 7 Days</option><option value="30">Last 30 Days</option></select>}
            <button onClick={() => setShowNewTicket(true)} style={{ ...bP, padding: "8px 14px", fontSize: 13 }}>+ New Ticket</button>
          </div>
        </div>

        <div style={{ flex: 1, padding: 20, overflow: "auto" }}>

          {/* DASHBOARD */}
          {view === "dashboard" && <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12, marginBottom: 16 }}>
              {[{ label: "Total", value: stats.total, color: "#3b82f6", icon: "🎫" }, { label: "Open", value: stats.open, color: "#f59e0b", icon: "📬" }, { label: "In Progress", value: stats.inProgress, color: "#6366f1", icon: "⚙️" }, { label: "Resolved", value: stats.resolved, color: "#22c55e", icon: "✅" }, { label: "Critical", value: stats.critical, color: "#ef4444", icon: "🔥" }].map(s => (
                <div key={s.label} style={{ background: "#fff", borderRadius: 12, padding: "14px 16px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", borderTop: `3px solid ${s.color}` }}>
                  <div style={{ fontSize: 20, marginBottom: 5 }}>{s.icon}</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>{s.label}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div style={{ background: "#fff", borderRadius: 12, padding: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}><div style={{ fontSize: 12, fontWeight: 600, marginBottom: 12, color: "#374151" }}>Tickets Over Time</div><BarChart data={dailyData} /></div>
              <div style={{ background: "#fff", borderRadius: 12, padding: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}><div style={{ fontSize: 12, fontWeight: 600, marginBottom: 12, color: "#374151" }}>By Priority</div><DonutChart data={priorityDist} /></div>
              <div style={{ background: "#fff", borderRadius: 12, padding: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}><div style={{ fontSize: 12, fontWeight: 600, marginBottom: 12, color: "#374151" }}>By Category</div><BarChart data={categoryDist} color="#8b5cf6" /></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ background: "#fff", borderRadius: 12, padding: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}><div style={{ fontSize: 12, fontWeight: 600, marginBottom: 12, color: "#374151" }}>Status Breakdown</div><DonutChart data={STATUSES.map((s, i) => ({ label: s, color: Object.values(STATUS_COLOR)[i].text, value: fbr.filter(t => t.status === s).length }))} /></div>
              <div style={{ background: "#fff", borderRadius: 12, padding: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10, color: "#374151" }}>Recent Tickets</div>
                {tickets.slice(0, 5).map(t => (
                  <div key={t.id} onClick={() => setSelTicket(t)} style={{ display: "flex", alignItems: "center", gap: 9, padding: "6px", borderRadius: 8, cursor: "pointer", border: "1px solid #f1f5f9", marginBottom: 5 }}>
                    <div style={{ display: "flex" }}>{(t.assignees || []).slice(0, 2).map((a, i) => <div key={a.id} style={{ marginLeft: i > 0 ? -6 : 0, border: "2px solid #fff", borderRadius: "50%" }}><Avatar name={a.name} size={24} /></div>)}{!t.assignees?.length && <Avatar name="?" size={24} />}</div>
                    <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.summary}</div><div style={{ fontSize: 10, color: "#94a3b8" }}>{t.id} · {t.org}</div></div>
                    <Badge label={t.status} style={{ ...STATUS_COLOR[t.status], fontSize: 10 }} />
                  </div>
                ))}
              </div>
            </div>
          </>}

          {/* TICKETS */}
          {view === "tickets" && <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
            <div style={{ padding: "11px 14px", borderBottom: "1px solid #f1f5f9", display: "flex", gap: 9, alignItems: "center", flexWrap: "wrap" }}>
              <input placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} style={{ ...iS, width: 200, fontSize: 13, padding: "7px 10px" }} />
              <select value={statusF} onChange={e => setStatusF(e.target.value)} style={{ ...sS, width: 128, fontSize: 13, padding: "7px 10px" }}><option value="All">All Status</option>{STATUSES.map(s => <option key={s}>{s}</option>)}</select>
              <select value={priorityF} onChange={e => setPriorityF(e.target.value)} style={{ ...sS, width: 128, fontSize: 13, padding: "7px 10px" }}><option value="All">All Priority</option>{PRIORITIES.map(p => <option key={p}>{p}</option>)}</select>
              <span style={{ fontSize: 12, color: "#64748b" }}>{filtered.length} tickets</span>
              <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
                {selectedIds.size > 0 && <span style={{ fontSize: 12, color: "#3b82f6", fontWeight: 600, background: "#eff6ff", padding: "4px 10px", borderRadius: 99 }}>{selectedIds.size} selected</span>}
                <div style={{ position: "relative" }}>
                  <button onClick={() => setShowExport(!showExport)} style={{ ...bG, display: "flex", alignItems: "center", gap: 6, padding: "7px 13px", background: selectedIds.size > 0 ? "#eff6ff" : "#fff", borderColor: selectedIds.size > 0 ? "#3b82f6" : "#e2e8f0", color: selectedIds.size > 0 ? "#3b82f6" : "#374151" }}>
                    ⬇ Export {selectedIds.size > 0 ? `(${selectedIds.size})` : ""} <span style={{ fontSize: 10 }}>▾</span>
                  </button>
                  {showExport && <>
                    <div style={{ position: "fixed", inset: 0, zIndex: 149 }} onClick={() => setShowExport(false)} />
                    <div style={{ position: "absolute", right: 0, top: "calc(100% + 4px)", background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 10, zIndex: 150, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", minWidth: 188, overflow: "hidden" }}>
                      {[{ l: "📄 Export CSV", a: () => exportCSV(selectedIds.size > 0 ? selTickets : filtered) }, { l: "📋 Export JSON", a: () => exportJSON(selectedIds.size > 0 ? selTickets : filtered) }, { l: "🖨 Print / PDF", a: () => exportPrint(selectedIds.size > 0 ? selTickets : filtered) }].map(x => (
                        <button key={x.l} onClick={() => { x.a(); setShowExport(false); }} style={{ display: "block", width: "100%", padding: "10px 14px", border: "none", background: "#fff", cursor: "pointer", fontSize: 13, textAlign: "left", fontFamily: "'DM Sans',sans-serif", borderBottom: "1px solid #f8fafc" }}>{x.l}</button>
                      ))}
                      <div style={{ padding: "5px 14px 8px", fontSize: 11, color: "#94a3b8" }}>{selectedIds.size > 0 ? `${selectedIds.size} selected tickets` : `All ${filtered.length} tickets`}</div>
                    </div>
                  </>}
                </div>
              </div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr style={{ background: "#f8fafc" }}>
                  <th style={{ ...thStyle, width: 40 }}><input type="checkbox" checked={selectedIds.size === filtered.length && filtered.length > 0} onChange={toggleAll} style={{ cursor: "pointer" }} /></th>
                  {["ID", "Summary", "Org / Dept", "Reported By", "Assignees", "Priority", "Status", "Created", "Action"].map(h => <th key={h} style={thStyle}>{h}</th>)}
                </tr></thead>
                <tbody>{filtered.map(t => (
                  <tr key={t.id} className="rh" style={{ cursor: "pointer", background: selectedIds.has(t.id) ? "#eff6ff" : "#fff" }}>
                    <td style={tdStyle} onClick={e => e.stopPropagation()}><input type="checkbox" checked={selectedIds.has(t.id)} onChange={() => toggleSel(t.id)} style={{ cursor: "pointer" }} /></td>
                    <td style={tdStyle} onClick={() => setSelTicket(t)}><span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11.5, color: "#3b82f6", fontWeight: 500 }}>{t.id}</span></td>
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
                    <td style={tdStyle} onClick={() => setSelTicket(t)}><Badge label={t.status} style={{ ...STATUS_COLOR[t.status] }} /></td>
                    <td style={tdStyle} onClick={() => setSelTicket(t)}><span style={{ fontSize: 11, color: "#94a3b8" }}>{t.created.toLocaleDateString()}</span></td>
                    <td style={tdStyle} onClick={e => e.stopPropagation()}><select value={t.status} onChange={e => updateStatus(t.id, e.target.value)} style={{ ...sS, width: 108, fontSize: 12, padding: "4px 7px" }}>{STATUSES.map(s => <option key={s}>{s}</option>)}</select></td>
                  </tr>
                ))}</tbody>
              </table>
              {filtered.length === 0 && <div style={{ padding: 36, textAlign: "center", color: "#94a3b8" }}>No tickets found</div>}
            </div>
          </div>}

          {/* REPORTS */}
          {view === "reports" && <>
            <div style={{ display: "flex", gap: 9, marginBottom: 14, alignItems: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Export Report:</span>
              {[{ l: "📄 CSV", a: () => exportCSV(fbr) }, { l: "📋 JSON", a: () => exportJSON(fbr) }, { l: "🖨 Print", a: () => exportPrint(fbr) }].map(b => <button key={b.l} onClick={b.a} style={bG}>{b.l}</button>)}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div style={{ background: "#fff", borderRadius: 12, padding: 18, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}><div style={{ fontSize: 12, fontWeight: 600, marginBottom: 12 }}>Ticket Volume</div><BarChart data={dailyData} /></div>
              <div style={{ background: "#fff", borderRadius: 12, padding: 18, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}><div style={{ fontSize: 12, fontWeight: 600, marginBottom: 12 }}>By Priority</div><DonutChart data={priorityDist} /></div>
              <div style={{ background: "#fff", borderRadius: 12, padding: 18, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}><div style={{ fontSize: 12, fontWeight: 600, marginBottom: 12 }}>Status Distribution</div><DonutChart data={STATUSES.map((s, i) => ({ label: s, color: Object.values(STATUS_COLOR)[i].text, value: fbr.filter(t => t.status === s).length }))} /></div>
              <div style={{ background: "#fff", borderRadius: 12, padding: 18, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}><div style={{ fontSize: 12, fontWeight: 600, marginBottom: 12 }}>By Category</div><BarChart data={categoryDist} color="#8b5cf6" /></div>
            </div>
            <div style={{ background: "#fff", borderRadius: 12, padding: 18, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 12 }}>Agent Performance</div>
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

          {/* AGENTS */}
          {view === "users" && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 12 }}>
            {agentStats.map(a => (
              <div key={a.id} style={{ background: "#fff", borderRadius: 12, padding: 18, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <Avatar name={a.name} size={40} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={a.name}>{a.name}</div>
                    <div style={{ fontSize: 11, color: "#94a3b8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={a.email}>{a.email}</div>
                    <div style={{ display: "flex", gap: 4, marginTop: 3, flexWrap: "wrap" }}>
                      <Badge label={a.role} style={{ background: "#ede9fe", color: "#6d28d9" }} />
                      {a.status && <Badge label={a.status} style={{ background: statusOpts.find(s => s.l === a.status)?.bg || "#f1f5f9", color: statusOpts.find(s => s.l === a.status)?.c || "#64748b" }} />}
                    </div>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 7 }}>
                  {[{ l: "Assigned", v: a.assigned, c: "#3b82f6" }, { l: "Resolved", v: a.resolved, c: "#22c55e" }, { l: "Open", v: a.assigned - a.resolved, c: "#f59e0b" }].map(s => (
                    <div key={s.l} style={{ textAlign: "center", padding: "8px 4px", background: "#f8fafc", borderRadius: 8 }}><div style={{ fontSize: 17, fontWeight: 700, color: s.c }}>{s.v}</div><div style={{ fontSize: 10, color: "#94a3b8" }}>{s.l}</div></div>
                  ))}
                </div>
              </div>
            ))}
          </div>}

          {/* SETTINGS */}
          {view === "settings" && <div style={{ display: "flex", gap: 18, alignItems: "flex-start" }}>
            <div style={{ width: 194, background: "#fff", borderRadius: 12, padding: 9, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flexShrink: 0 }}>
              {stabs.map(t => (
                <button key={t.id} onClick={() => setSettingsTab(t.id)} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "9px 11px", borderRadius: 7, border: "none", cursor: "pointer", background: settingsTab === t.id ? "#eff6ff" : "transparent", color: settingsTab === t.id ? "#3b82f6" : "#374151", fontSize: 12.5, fontWeight: settingsTab === t.id ? 600 : 400, textAlign: "left", fontFamily: "'DM Sans',sans-serif", marginBottom: 2 }}>
                  <span>{t.icon}</span>{t.label}
                </button>
              ))}
            </div>
            <div style={{ flex: 1 }}>

              {/* Ticket Views */}
              {settingsTab === "ticketviews" && <div style={{ background: "#fff", borderRadius: 12, padding: 22, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700 }}>Ticket Views</h3>
                <p style={{ margin: "0 0 18px", fontSize: 12, color: "#64748b" }}>Predefined views for quick ticket filtering. Click "View" to open any filtered view.</p>
                {TICKET_VIEWS.map(v => (
                  <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 10, border: "1.5px solid #f1f5f9", marginBottom: 7, background: "#fafafa" }}>
                    <div style={{ fontSize: 20, width: 32, textAlign: "center" }}>{v.icon}</div>
                    <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 600 }}>{v.label}</div><div style={{ fontSize: 11, color: "#94a3b8" }}>{v.desc}</div></div>
                    <span style={{ fontSize: 11, color: "#64748b", background: "#f1f5f9", padding: "3px 9px", borderRadius: 99, fontWeight: 600 }}>{tickets.filter(t => v.filter(t, currentUser)).length}</span>
                    <button onClick={() => { setView("tickets"); setTvFilter(v.id); }} style={{ ...bP, padding: "5px 12px", fontSize: 12 }}>View</button>
                  </div>
                ))}
              </div>}

              {/* Organisations */}
              {settingsTab === "organisations" && <div style={{ background: "#fff", borderRadius: 12, padding: 22, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 700 }}>Organisations ({orgs.length})</h3>
                {currentUser?.role === "Admin" ? (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 9, marginBottom: 18, padding: 14, background: "#f8fafc", borderRadius: 9 }}>
                    <input style={iS} placeholder="Name *" value={newOrg.name} onChange={e => setNewOrg({ ...newOrg, name: e.target.value })} />
                    <input style={iS} placeholder="Domain" value={newOrg.domain} onChange={e => setNewOrg({ ...newOrg, domain: e.target.value })} />
                    <input style={iS} placeholder="Phone" value={newOrg.phone} onChange={e => setNewOrg({ ...newOrg, phone: e.target.value })} />
                    <button onClick={addOrg} style={bP}>Add</button>
                  </div>
                ) : (
                  <div style={{ marginBottom: 18, padding: "10px 14px", background: "#fef3c7", color: "#92400e", borderRadius: 8, fontSize: 13, fontWeight: 500 }}>Read Only: Organisation management is restricted to Admins.</div>
                )}
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr>{["Name", "Domain", "Phone", currentUser?.role === "Admin" ? "" : null].filter(Boolean).map(h => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
                  <tbody>{orgs.map(o => <tr key={o.id} className="rh">
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{o.name}</td>
                    <td style={{ ...tdStyle, color: "#64748b" }}>{o.domain || "—"}</td>
                    <td style={{ ...tdStyle, color: "#64748b" }}>{o.phone || "—"}</td>
                    {currentUser?.role === "Admin" && <td style={tdStyle}><button onClick={() => setOrgs(orgs.filter(x => x.id !== o.id))} style={{ border: "none", background: "#fee2e2", color: "#ef4444", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Delete</button></td>}
                  </tr>)}</tbody>
                </table>
              </div>}

              {/* Categories */}
              {settingsTab === "categories" && <div style={{ background: "#fff", borderRadius: 12, padding: 22, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 700 }}>Ticket Categories ({categories.length})</h3>
                {currentUser?.role === "Admin" ? (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 9, marginBottom: 18, padding: 14, background: "#f8fafc", borderRadius: 9, alignItems: "center" }}>
                    <input style={iS} placeholder="Category name *" value={newCat.name} onChange={e => setNewCat({ ...newCat, name: e.target.value })} />
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}><label style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Color</label><input type="color" value={newCat.color} onChange={e => setNewCat({ ...newCat, color: e.target.value })} style={{ width: 34, height: 34, border: "none", borderRadius: 7, cursor: "pointer", padding: 2 }} /></div>
                    <button onClick={addCat} style={bP}>Add</button>
                  </div>
                ) : (
                  <div style={{ marginBottom: 18, padding: "10px 14px", background: "#fef3c7", color: "#92400e", borderRadius: 8, fontSize: 13, fontWeight: 500 }}>Read Only: Category management is restricted to Admins.</div>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(190px,1fr))", gap: 9 }}>
                  {categories.map(c => (
                    <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "11px 13px", borderRadius: 9, border: `1.5px solid ${c.color}33`, background: `${c.color}0d` }}>
                      <div style={{ width: 11, height: 11, borderRadius: 3, background: c.color, flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{c.name}</span>
                      <span style={{ fontSize: 11, color: "#94a3b8" }}>{tickets.filter(t => t.category === c.name).length}</span>
                      {currentUser?.role === "Admin" && <button onClick={() => setCategories(categories.filter(x => x.id !== c.id))} style={{ border: "none", background: "transparent", color: "#ef4444", cursor: "pointer", fontSize: 15, fontWeight: 700, padding: "0 2px" }}>×</button>}
                    </div>
                  ))}
                </div>
              </div>}

              {/* User Management */}
              {settingsTab === "usermgmt" && <div style={{ background: "#fff", borderRadius: 12, padding: 22, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 700 }}>User Management ({users.length} users)</h3>
                {currentUser?.role === "Admin" ? (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto auto", gap: 9, marginBottom: 18, padding: 14, background: "#f8fafc", borderRadius: 9 }}>
                    <input style={iS} placeholder="Full name *" value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })} />
                    <input style={iS} placeholder="Email *" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} />
                    <select style={{ ...sS, width: 110 }} value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })}>{ROLES.map(r => <option key={r}>{r}</option>)}</select>
                    <button onClick={addUser} style={bP}>Add</button>
                  </div>
                ) : (
                  <div style={{ marginBottom: 18, padding: "10px 14px", background: "#fef3c7", color: "#92400e", borderRadius: 8, fontSize: 13, fontWeight: 500 }}>Read Only: User management is restricted to Admins.</div>
                )}
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr>{["User", "Email", "Role", "Status", currentUser?.role === "Admin" ? "Actions" : null].filter(Boolean).map(h => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
                  <tbody>{users.map(u => (
                    <tr key={u.id} className="rh">
                      <td style={tdStyle}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><Avatar name={u.name} size={28} /><span style={{ fontSize: 13, fontWeight: 600 }}>{u.name}</span></div></td>
                      <td style={{ ...tdStyle, color: "#64748b", fontSize: 12 }}>{u.email}</td>
                      <td style={tdStyle}><Badge label={u.role} style={{ background: "#ede9fe", color: "#6d28d9" }} /></td>
                      <td style={tdStyle}><div style={{ display: "flex", gap: 4 }}><Badge label={u.active ? "Active (System)" : "Inactive (System)"} style={{ background: u.active ? "#dcfce7" : "#fee2e2", color: u.active ? "#15803d" : "#ef4444" }} />{u.status && <Badge label={u.status} style={{ background: statusOpts.find(s => s.l === u.status)?.bg || "#f1f5f9", color: statusOpts.find(s => s.l === u.status)?.c || "#64748b" }} />}</div></td>
                      {currentUser?.role === "Admin" && <td style={tdStyle}><div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => setUsers(users.map(x => x.id === u.id ? { ...x, active: !x.active } : x))} style={{ border: "none", background: u.active ? "#fef9c3" : "#dcfce7", color: u.active ? "#854d0e" : "#15803d", borderRadius: 6, padding: "4px 9px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>{u.active ? "Deactivate" : "Activate"}</button>
                        {u.id !== currentUser.id && <button onClick={() => setUsers(users.filter(x => x.id !== u.id))} style={{ border: "none", background: "#fee2e2", color: "#ef4444", borderRadius: 6, padding: "4px 9px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Delete</button>}
                      </div></td>}
                    </tr>
                  ))}</tbody>
                </table>
              </div>}

              {/* Custom Attributes */}
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
                ) : (
                  <div style={{ marginBottom: 18, padding: "10px 14px", background: "#fef3c7", color: "#92400e", borderRadius: 8, fontSize: 13, fontWeight: 500 }}>Read Only: Attribute management is restricted to Admins.</div>
                )}
                {customAttrs.map(a => (
                  <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 11, padding: "12px 15px", borderRadius: 9, border: "1.5px solid #f1f5f9", marginBottom: 7, background: "#fafafa" }}>
                    <div style={{ width: 34, height: 34, background: "#eff6ff", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>{a.type === "text" ? "Aa" : a.type === "number" ? "#" : a.type === "select" ? "≡" : a.type === "date" ? "📅" : "☑"}</div>
                    <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 600 }}>{a.name}{a.required && <span style={{ color: "#ef4444", marginLeft: 3 }}>*</span>}</div><div style={{ fontSize: 11, color: "#94a3b8" }}>Type: {a.type}{a.options?.length ? ` · ${a.options.join(", ")}` : ""}</div></div>
                    {currentUser?.role === "Admin" && <button onClick={() => setCustomAttrs(customAttrs.filter(x => x.id !== a.id))} style={{ border: "none", background: "#fee2e2", color: "#ef4444", borderRadius: 6, padding: "5px 11px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Delete</button>}
                  </div>
                ))}
                {customAttrs.length === 0 && <div style={{ textAlign: "center", color: "#94a3b8", padding: 28 }}>No custom attributes yet.</div>}
              </div>}

              {/* Database Mgmt */}
              {settingsTab === "dbmgmt" && <div style={{ background: "#fff", borderRadius: 12, padding: 22, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700 }}>Database Management</h3>
                <p style={{ margin: "0 0 14px", fontSize: 12, color: "#64748b" }}>Import or export the entire helpdesk database (JSON format).</p>
                <div style={{ display: "flex", gap: 14, marginTop: 20 }}>
                  <button onClick={async () => {
                    const data = await DB_API.getAllData();
                    const a = document.createElement("a");
                    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
                    a.download = "helpdesk_backup.json";
                    a.click();
                  }} style={bP}>Export Database</button>
                  <label style={{ ...bG, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    Import Data File
                    <input type="file" accept=".json" style={{ display: "none" }} onChange={e => {
                      const file = e.target.files[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = async (ev) => {
                        try {
                          const json = JSON.parse(ev.target.result);
                          if (confirm("This will overwrite existing database. Are you sure?")) {
                            setLoading(true);
                            await DB_API.replaceData(json);
                            await loadData();
                            alert("Import successful!");
                          }
                        } catch (err) {
                          alert("Invalid JSON file or error during import.");
                          setLoading(false);
                        }
                      };
                      reader.readAsText(file);
                    }} />
                  </label>
                  {/* New CSV Import Button for Item 10 */}
                  <label style={{ ...bG, display: "flex", alignItems: "center", gap: 6, cursor: "pointer", border: "1.5px solid #3b82f6", color: "#3b82f6" }}>
                    Import Tickets (CSV)
                    <input
                      type="file"
                      accept=".csv"
                      style={{ display: "none" }}
                      onChange={handleImportCSV}
                    />
                  </label>
                </div>
              </div>}

            </div>
          </div>}
        </div>
      </div>

      {/* NEW TICKET MODAL */}
      <Modal open={showNewTicket} onClose={() => { setShowNewTicket(false); setShowAssigneeDD(false); }} title="Create New Ticket" width={700}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 18px" }}>
          <FF label="Organisation" required><select style={sS} value={form.org} onChange={e => setForm({ ...form, org: e.target.value })}><option value="">Select…</option>{orgs.map(o => <option key={o.id}>{o.name}</option>)}</select></FF>
          <FF label="Department"><select style={sS} value={form.department} onChange={e => setForm({ ...form, department: e.target.value })}><option value="">Select…</option>{DEPARTMENTS.map(d => <option key={d}>{d}</option>)}</select></FF>
          <FF label="Contact Name"><input style={iS} placeholder="e.g. John Smith" value={form.contact} onChange={e => setForm({ ...form, contact: e.target.value })} /></FF>
          <FF label="Reported By (User Name)"><input style={iS} placeholder="Who is raising this ticket?" value={form.reportedBy} onChange={e => setForm({ ...form, reportedBy: e.target.value })} /></FF>
          <FF label="Priority"><select style={sS} value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>{PRIORITIES.map(p => <option key={p}>{p}</option>)}</select></FF>
          <FF label="Category"><select style={sS} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}><option value="">Select…</option>{categories.map(c => <option key={c.id}>{c.name}</option>)}</select></FF>
        </div>
        <FF label="Assignees">
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
                  <div key={u.id} onClick={() => toggleAssignee(u)} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 13px", cursor: "pointer", background: sel ? "#eff6ff" : "#fff" }}>
                    <Avatar name={u.name} size={26} /><div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 600 }}>{u.name}</div><div style={{ fontSize: 11, color: "#94a3b8" }}>{u.role}</div></div>
                    {sel && <span style={{ color: "#3b82f6", fontWeight: 700 }}>✓</span>}
                  </div>);
              })}
            </div>}
          </div>
        </FF>
        <FF label="Summary" required><input style={iS} placeholder="Brief description of the issue" value={form.summary} onChange={e => setForm({ ...form, summary: e.target.value })} /></FF>
        <FF label="Description"><textarea style={{ ...iS, height: 88, resize: "vertical" }} placeholder="Detailed description…" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></FF>
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
        <FF label="CC Users">
          <div style={{ display: "flex", gap: 8 }}><input style={{ ...iS, flex: 1 }} placeholder="Add email address" value={ccInput} onChange={e => setCcInput(e.target.value)} onKeyDown={e => e.key === "Enter" && addCC()} /><button onClick={addCC} style={bG}>Add</button></div>
          {form.cc.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 7 }}>{form.cc.map(email => <span key={email} style={{ padding: "3px 9px", background: "#dbeafe", color: "#1d4ed8", borderRadius: 99, fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}>{email}<span onClick={() => setForm({ ...form, cc: form.cc.filter(e => e !== email) })} style={{ cursor: "pointer", fontWeight: 700 }}>×</span></span>)}</div>}
        </FF>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 9, marginTop: 6 }}>
          <button onClick={() => { setShowNewTicket(false); setShowAssigneeDD(false); }} style={bG}>Cancel</button>
          <button onClick={handleSubmit} style={bP}>Create Ticket</button>
        </div>
      </Modal>

      {/* TICKET DETAIL MODAL */}
      <Modal open={!!selTicket} onClose={() => setSelTicket(null)} title={selTicket?.id || ""} width={720}>
        {selTicket && <div>
          <div style={{ display: "flex", gap: 9, marginBottom: 16, flexWrap: "wrap" }}>
            <Badge label={selTicket.status} style={{ ...STATUS_COLOR[selTicket.status], padding: "4px 12px", fontSize: 12 }} />
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 9, height: 9, borderRadius: "50%", background: PRIORITY_COLOR[selTicket.priority] }} /><span style={{ fontSize: 13, fontWeight: 600 }}>{selTicket.priority} Priority</span></div>
            <span style={{ fontSize: 12, color: "#94a3b8" }}>Created {selTicket.created.toLocaleString()}</span>
          </div>
          <h2 style={{ margin: "0 0 9px", fontSize: 17, fontWeight: 700 }}>{selTicket.summary}</h2>
          <p style={{ margin: "0 0 16px", color: "#64748b", fontSize: 14, lineHeight: 1.6 }}>{selTicket.description}</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, marginBottom: 14 }}>
            {[{ l: "Organisation", v: selTicket.org }, { l: "Department", v: selTicket.department }, { l: "Contact", v: selTicket.contact }, { l: "Reported By", v: selTicket.reportedBy }, { l: "Category", v: selTicket.category }].map(f => (
              <div key={f.l} style={{ background: "#f8fafc", padding: "9px 13px", borderRadius: 9 }}><div style={{ fontSize: 10, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", marginBottom: 3 }}>{f.l}</div><div style={{ fontSize: 13, fontWeight: 500 }}>{f.v || "—"}</div></div>
            ))}
          </div>
          {selTicket.customAttrs && Object.keys(selTicket.customAttrs).length > 0 && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, marginBottom: 14 }}>
            {Object.entries(selTicket.customAttrs).map(([k, v]) => <div key={k} style={{ background: "#fffbeb", padding: "9px 13px", borderRadius: 9, border: "1px solid #fde68a" }}><div style={{ fontSize: 10, fontWeight: 600, color: "#92400e", textTransform: "uppercase", marginBottom: 3 }}>{k}</div><div style={{ fontSize: 13, fontWeight: 500 }}>{String(v) || "—"}</div></div>)}
          </div>}
          <div style={{ marginBottom: 14, padding: "11px 13px", background: "#f8fafc", borderRadius: 9 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", marginBottom: 7 }}>Assignees</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {(selTicket.assignees || []).map(a => <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 7, background: "#fff", padding: "5px 9px", borderRadius: 7, border: "1px solid #e2e8f0" }}><Avatar name={a.name} size={24} /><div><div style={{ fontSize: 12, fontWeight: 600 }}>{a.name}</div><div style={{ fontSize: 10, color: "#94a3b8" }}>{a.role}</div></div></div>)}
              {!selTicket.assignees?.length && <span style={{ fontSize: 13, color: "#94a3b8" }}>Unassigned</span>}
            </div>
            {selTicket.vendor && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", marginBottom: 4 }}>Vendor</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{selTicket.vendor.name} <span style={{ color: "#64748b", fontWeight: 400 }}>({selTicket.vendor.email})</span></div>
              </div>
            )}
          </div>

          {!showForward ? (
            <button onClick={() => setShowForward(true)} style={{ ...bG, padding: "6px 14px", marginBottom: 14, fontSize: 12 }}>Forward Ticket ➦</button>
          ) : (
            <div style={{ marginBottom: 14, padding: "14px", background: "#eff6ff", borderRadius: 9, border: "1px solid #bfdbfe", animation: "fadeIn 0.2s" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#1e40af", marginBottom: 10 }}>Forward Ticket</div>
              <div style={{ display: "flex", gap: 14, marginBottom: 10 }}>
                <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}><input type="radio" checked={fwdType === "Agent"} onChange={() => setFwdType("Agent")} /> Internal Agent</label>
                <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}><input type="radio" checked={fwdType === "Vendor"} onChange={() => setFwdType("Vendor")} /> External Vendor</label>
              </div>
              {fwdType === "Agent" ? (
                <FF label="Select Agent" required><select style={sS} value={fwdTargetAgent} onChange={e => setFwdTargetAgent(e.target.value)}><option value="">Select...</option>{users.filter(u => u.active).map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}</select></FF>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 10px" }}>
                  <FF label="Vendor Name" required><input style={iS} value={fwdVendorName} onChange={e => setFwdVendorName(e.target.value)} placeholder="e.g. Dell Support" /></FF>
                  <FF label="Vendor Email" required><input type="email" style={iS} value={fwdVendorEmail} onChange={e => setFwdVendorEmail(e.target.value)} placeholder="vendor@example.com" /></FF>
                </div>
              )}
              <FF label="Reason for Forwarding" required><textarea style={{ ...iS, height: 50, resize: "none" }} value={fwdReason} onChange={e => setFwdReason(e.target.value)} placeholder="Why is this ticket being forwarded?" /></FF>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
                <button onClick={() => { setShowForward(false); setFwdReason(""); }} style={bG}>Cancel</button>
                <button onClick={handleForward} style={{ ...bP, background: "#2563eb", boxShadow: "0 2px 6px rgba(37,99,235,0.3)" }}>Confirm Forward</button>
              </div>
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#374151", marginBottom: 7 }}>UPDATE STATUS</div>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>{STATUSES.map(s => <button key={s} onClick={() => updateStatus(selTicket.id, s)} style={{ padding: "5px 13px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "'DM Sans',sans-serif", background: selTicket.status === s ? STATUS_COLOR[s].text : "#f1f5f9", color: selTicket.status === s ? "#fff" : "#64748b" }}>{s}</button>)}</div>
          </div>

          {/* TIMELINE */}
          {selTicket.timeline && selTicket.timeline.length > 0 && (
            <div style={{ marginBottom: 14, borderTop: "1px solid #f1f5f9", paddingTop: 13 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#374151", marginBottom: 10 }}>TICKET TIMELINE</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingLeft: 8, borderLeft: "2px solid #e2e8f0", marginLeft: 6 }}>
                {selTicket.timeline.map((ev, i) => (
                  <div key={i} style={{ position: "relative" }}>
                    <span style={{ position: "absolute", left: -13, top: 4, width: 8, height: 8, borderRadius: "50%", background: "#94a3b8", border: "2px solid #fff" }} />
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{ev.action} <span style={{ fontWeight: 400, color: "#64748b", fontSize: 11 }}>by {ev.by}</span></div>
                    {ev.note && <div style={{ fontSize: 12, color: "#475569", marginTop: 2, background: "#f8fafc", padding: "4px 8px", borderRadius: 4 }}>{ev.note}</div>}
                    <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 3 }}>{new Date(ev.date).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 13 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#374151", marginBottom: 7 }}>ADD COMMENT</div>
            <textarea style={{ ...iS, height: 68, resize: "none" }} placeholder="Add a note or reply…" value={newComment} onChange={e => setNewComment(e.target.value)} />
            <button onClick={() => setNewComment("")} style={{ ...bP, marginTop: 7, padding: "7px 15px", fontSize: 13 }}>Post Comment</button>
          </div>
        </div>}
      </Modal>
    </div>
  );
}
