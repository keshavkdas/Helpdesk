import React, { useState, useEffect, useMemo, useCallback } from "react";
import axios from "axios";

// ─── SERVER CONFIGURATION ────────────────────────────────────────────────────
const SERVER_IP = "10.0.2.111";
const BASE_URL = `http://${SERVER_IP}:5000/api`;

// ─── API ENDPOINTS ────────────────────────────────────────────────────────────
const AUTH_API = `${BASE_URL}/auth/login`;
const USERS_API = `${BASE_URL}/users`;
const ORGS_API = `${BASE_URL}/orgs`;
const LOCATIONS_API = `${BASE_URL}/locations`;
const TICKETS_API = `${BASE_URL}/tickets`;
const DEVICES_API = `${BASE_URL}/devices`;
const LAPTOPS_API = `${BASE_URL}/devices/laptops`;
const DESKTOPS_API = `${BASE_URL}/devices/desktops`;
const PRINTERS_API = `${BASE_URL}/devices/printers`;
const NETWORK_API = `${BASE_URL}/devices/network`;
const SERVERS_API = `${BASE_URL}/devices/servers`;
const PHONES_API = `${BASE_URL}/devices/phones`;

// ─── SESSION (shared with helpdesk) ──────────────────────────────────────────
const SESSION_KEY = "deskflow_session";
const SESSION_TTL = 12 * 60 * 60 * 1000;

function saveSession(user) {
    try { localStorage.setItem(SESSION_KEY, JSON.stringify({ user, expiresAt: Date.now() + SESSION_TTL })); } catch (_) { }
}
function loadSession() {
    try {
        const raw = localStorage.getItem(SESSION_KEY);
        if (!raw) return null;
        const { user, expiresAt } = JSON.parse(raw);
        if (Date.now() > expiresAt) { localStorage.removeItem(SESSION_KEY); return null; }
        return user;
    } catch (_) { return null; }
}
function clearSession() {
    try { localStorage.removeItem(SESSION_KEY); } catch (_) { }
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const DEVICE_TYPES = [
    { id: "laptops", label: "Laptops", icon: "💻", color: "#3b82f6", apiKey: "laptops" },
    { id: "desktops", label: "Desktops", icon: "🖥️", color: "#8b5cf6", apiKey: "desktops" },
    { id: "printers", label: "Printers", icon: "🖨️", color: "#f97316", apiKey: "printers" },
    { id: "network", label: "Network Devices", icon: "📡", color: "#06b6d4", apiKey: "network" },
    { id: "servers", label: "Servers", icon: "🗄️", color: "#22c55e", apiKey: "servers" },
    { id: "phones", label: "Phones/Tablets", icon: "📱", color: "#ec4899", apiKey: "phones" },
];

const STATUS_OPTS = ["Active", "In Repair", "Retired", "In Storage", "Missing"];
const STATUS_COLOR = {
    "Active": { bg: "#dcfce7", text: "#15803d" },
    "In Repair": { bg: "#fef9c3", text: "#854d0e" },
    "Retired": { bg: "#f1f5f9", text: "#475569" },
    "In Storage": { bg: "#dbeafe", text: "#1d4ed8" },
    "Missing": { bg: "#fee2e2", text: "#991b1b" },
};
const PRIORITY_COLOR = { Low: "#22c55e", Medium: "#f59e0b", High: "#f97316", Critical: "#ef4444" };

// ─── DEVICE TYPE SPECIFIC FIELDS ──────────────────────────────────────────────
const DEVICE_FIELDS = {
    laptops: ["brand", "model", "serialNo", "processor", "ram", "storage", "os", "batteryHealth"],
    desktops: ["brand", "model", "serialNo", "processor", "ram", "storage", "os", "hasMonitor"],
    printers: ["brand", "model", "serialNo", "printerType", "ipAddress", "tonerLevel", "isNetworked"],
    network: ["brand", "model", "serialNo", "ipAddress", "macAddress", "switchPort", "vlan"],
    servers: ["brand", "model", "serialNo", "processor", "ram", "storage", "os", "ipAddress", "rackUnit"],
    phones: ["brand", "model", "serialNo", "os", "imei", "carrier", "isTablet"],
};

const FIELD_LABELS = {
    brand: "Brand", model: "Model", serialNo: "Serial No.", processor: "Processor",
    ram: "RAM", storage: "Storage", os: "OS", batteryHealth: "Battery Health",
    hasMonitor: "Has Monitor", printerType: "Printer Type", ipAddress: "IP Address",
    tonerLevel: "Toner Level", isNetworked: "Networked", macAddress: "MAC Address",
    switchPort: "Switch Port", vlan: "VLAN", rackUnit: "Rack Unit",
    imei: "IMEI", carrier: "Carrier", isTablet: "Is Tablet",
};

// ─── UI PRIMITIVES ────────────────────────────────────────────────────────────
const Avatar = ({ name, size = 28 }) => {
    const cols = ["#6366f1", "#ec4899", "#14b8a6", "#f59e0b", "#3b82f6", "#8b5cf6", "#ef4444", "#22c55e"];
    return (
        <div style={{ width: size, height: size, borderRadius: "50%", background: cols[(name?.charCodeAt(0) || 0) % cols.length], display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: size * 0.35, fontWeight: 700, flexShrink: 0 }}>
            {name?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "?"}
        </div>
    );
};

const Badge = ({ label, color, bg }) => (
    <span style={{ padding: "2px 10px", borderRadius: 99, fontSize: 11, fontWeight: 600, background: bg || "#f1f5f9", color: color || "#475569", whiteSpace: "nowrap", display: "inline-block" }}>
        {label}
    </span>
);

const Modal = ({ open, onClose, title, width = 680, children }) => {
    if (!open) return null;
    return (
        <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16, backdropFilter: "blur(3px)" }}>
            <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: width, maxHeight: "90vh", overflow: "auto", boxShadow: "0 25px 60px rgba(0,0,0,0.25)" }}>
                <div style={{ padding: "16px 24px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "#fff", zIndex: 1 }}>
                    <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0f172a" }}>{title}</h2>
                    <button onClick={onClose} style={{ border: "none", background: "#f1f5f9", borderRadius: 8, width: 32, height: 32, cursor: "pointer", fontSize: 18, color: "#64748b", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
                </div>
                <div style={{ padding: "22px 24px" }}>{children}</div>
            </div>
        </div>
    );
};

// Shared input styles
const iS = { width: "100%", padding: "9px 12px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 13, color: "#1e293b", background: "#fafafa", outline: "none", boxSizing: "border-box", fontFamily: "'DM Sans',sans-serif", transition: "border-color 0.15s" };
const sS = { ...iS, cursor: "pointer" };
const bP = { padding: "9px 18px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#3b82f6,#6366f1)", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans',sans-serif" };
const bG = { padding: "9px 14px", borderRadius: 8, border: "1.5px solid #e2e8f0", background: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans',sans-serif", color: "#374151" };
const bD = { ...bG, background: "#fee2e2", border: "1.5px solid #fca5a5", color: "#dc2626" };

const FF = ({ label, required, children }) => (
    <div style={{ marginBottom: 14 }}>
        <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#374151", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {label}{required && <span style={{ color: "#ef4444", marginLeft: 2 }}>*</span>}
        </label>
        {children}
    </div>
);

// ─── WARRANTY BADGE ───────────────────────────────────────────────────────────
function WarrantyBadge({ date }) {
    if (!date) return <Badge label="No Warranty" />;
    const days = Math.ceil((new Date(date) - new Date()) / (1000 * 60 * 60 * 24));
    if (days < 0) return <Badge label="Expired" bg="#fee2e2" color="#dc2626" />;
    if (days < 90) return <Badge label={`${days}d left`} bg="#fef9c3" color="#854d0e" />;
    return <Badge label={date} bg="#dcfce7" color="#15803d" />;
}

// ─── TOAST ────────────────────────────────────────────────────────────────────
function useToasts() {
    const [toasts, setToasts] = useState([]);
    const showToast = (message, type = "success") => {
        const id = Date.now();
        setToasts(p => [...p, { id, message, type }]);
        setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3200);
    };
    return { toasts, showToast };
}

const ToastStack = ({ toasts }) => (
    <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", zIndex: 9999, display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
        {toasts.map(t => (
            <div key={t.id} style={{ padding: "12px 18px", borderRadius: 10, fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans',sans-serif", boxShadow: "0 8px 24px rgba(0,0,0,0.15)", display: "flex", alignItems: "center", gap: 10, minWidth: 280, animation: "slideIn 0.3s ease-out", background: t.type === "success" ? "#dcfce7" : "#fee2e2", color: t.type === "success" ? "#15803d" : "#991b1b", border: `1.5px solid ${t.type === "success" ? "#86efac" : "#fca5a5"}` }}>
                <span style={{ fontSize: 16 }}>{t.type === "success" ? "✓" : "✕"}</span>
                {t.message}
            </div>
        ))}
    </div>
);

// ─── DEVICE FORM (shared for all types) ──────────────────────────────────────
function DeviceForm({ deviceType, form, setForm, users, orgs, locations, tickets, onSave, onCancel, isEdit }) {
    const typeFields = DEVICE_FIELDS[deviceType] || [];
    const deviceConfig = DEVICE_TYPES.find(d => d.id === deviceType);

    return (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {/* Base fields */}
            <FF label="Asset Tag" required>
                <input style={iS} value={form.assetTag || ""} onChange={e => setForm(p => ({ ...p, assetTag: e.target.value }))} placeholder="e.g. AST-0042" />
            </FF>
            <FF label="Device Name" required>
                <input style={iS} value={form.name || ""} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. John's Laptop" />
            </FF>
            <FF label="Status">
                <select style={sS} value={form.status || "Active"} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                    {STATUS_OPTS.map(s => <option key={s}>{s}</option>)}
                </select>
            </FF>
            <FF label="Organisation">
                <select style={sS} value={form.org || ""} onChange={e => setForm(p => ({ ...p, org: e.target.value }))}>
                    <option value="">— None —</option>
                    {orgs.map(o => <option key={o.id} value={o.name}>{o.name}</option>)}
                </select>
            </FF>
            <FF label="Location">
                <select style={sS} value={form.location || ""} onChange={e => setForm(p => ({ ...p, location: e.target.value }))}>
                    <option value="">— None —</option>
                    {locations.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
                </select>
            </FF>
            <FF label="Assigned To">
                <select style={sS} value={form.assignedUserId || ""} onChange={e => setForm(p => ({ ...p, assignedUserId: e.target.value }))}>
                    <option value="">— Unassigned —</option>
                    {users.filter(u => u.active).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
            </FF>
            <FF label="Purchase Date">
                <input type="date" style={iS} value={form.purchaseDate || ""} onChange={e => setForm(p => ({ ...p, purchaseDate: e.target.value }))} />
            </FF>
            <FF label="Warranty End">
                <input type="date" style={iS} value={form.warrantyEnd || ""} onChange={e => setForm(p => ({ ...p, warrantyEnd: e.target.value }))} />
            </FF>
            <FF label="Purchase Price (₹)">
                <input type="number" style={iS} value={form.price || ""} onChange={e => setForm(p => ({ ...p, price: e.target.value }))} placeholder="e.g. 75000" />
            </FF>
            <FF label="Vendor">
                <input style={iS} value={form.vendor || ""} onChange={e => setForm(p => ({ ...p, vendor: e.target.value }))} placeholder="e.g. Dell India" />
            </FF>

            {/* Type-specific fields */}
            {typeFields.map(field => (
                <FF key={field} label={FIELD_LABELS[field] || field}>
                    {field === "hasMonitor" || field === "isNetworked" || field === "isTablet" ? (
                        <select style={sS} value={form.specs?.[field] || "No"} onChange={e => setForm(p => ({ ...p, specs: { ...(p.specs || {}), [field]: e.target.value } }))}>
                            <option>Yes</option><option>No</option>
                        </select>
                    ) : (
                        <input style={iS} value={form.specs?.[field] || ""} onChange={e => setForm(p => ({ ...p, specs: { ...(p.specs || {}), [field]: e.target.value } }))} placeholder={`Enter ${FIELD_LABELS[field] || field}`} />
                    )}
                </FF>
            ))}

            {/* Notes - full width */}
            <div style={{ gridColumn: "1/-1" }}>
                <FF label="Notes">
                    <textarea style={{ ...iS, minHeight: 72, resize: "vertical" }} value={form.notes || ""} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Additional notes…" />
                </FF>
            </div>

            {/* Buttons */}
            <div style={{ gridColumn: "1/-1", display: "flex", justifyContent: "flex-end", gap: 10, paddingTop: 6 }}>
                <button style={bG} onClick={onCancel}>Cancel</button>
                <button style={bP} onClick={onSave}>{isEdit ? "💾 Save Changes" : `➕ Add ${deviceConfig?.label?.slice(0, -1) || "Device"}`}</button>
            </div>
        </div>
    );
}

// ─── DEVICE TABLE ─────────────────────────────────────────────────────────────
function DeviceTable({ devices, deviceType, users, tickets, onView, onEdit, onDelete, onLinkTicket }) {
    const [search, setSearch] = useState("");
    const [statusF, setStatusF] = useState("All");
    const typeFields = DEVICE_FIELDS[deviceType] || [];

    const filtered = useMemo(() => {
        let d = devices;
        if (statusF !== "All") d = d.filter(x => x.status === statusF);
        if (search) {
            const q = search.toLowerCase();
            d = d.filter(x =>
                x.name?.toLowerCase().includes(q) ||
                x.assetTag?.toLowerCase().includes(q) ||
                x.org?.toLowerCase().includes(q) ||
                x.specs?.brand?.toLowerCase().includes(q) ||
                x.specs?.model?.toLowerCase().includes(q) ||
                x.specs?.serialNo?.toLowerCase().includes(q)
            );
        }
        return d;
    }, [devices, search, statusF]);

    const getUserName = (id) => users.find(u => String(u.id) === String(id))?.name || "—";
    const getLinkedTickets = (deviceId) => tickets.filter(t => t.deviceId === deviceId);

    return (
        <div>
            {/* Table toolbar */}
            <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
                <input
                    style={{ ...iS, width: 260 }}
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="🔍  Search by name, tag, serial…"
                />
                <select style={{ ...sS, width: 150 }} value={statusF} onChange={e => setStatusF(e.target.value)}>
                    <option value="All">All Statuses</option>
                    {STATUS_OPTS.map(s => <option key={s}>{s}</option>)}
                </select>
                <span style={{ marginLeft: "auto", fontSize: 12, color: "#94a3b8", alignSelf: "center" }}>
                    {filtered.length} device{filtered.length !== 1 ? "s" : ""}
                </span>
            </div>

            {/* Table */}
            <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                        <tr style={{ background: "#f8fafc" }}>
                            <th style={TH}>Asset Tag</th>
                            <th style={TH}>Name</th>
                            {typeFields.slice(0, 2).map(f => <th key={f} style={TH}>{FIELD_LABELS[f]}</th>)}
                            <th style={TH}>Status</th>
                            <th style={TH}>Assigned To</th>
                            <th style={TH}>Location</th>
                            <th style={TH}>Warranty</th>
                            <th style={TH}>Tickets</th>
                            <th style={TH}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 && (
                            <tr><td colSpan={9 + typeFields.slice(0, 2).length} style={{ textAlign: "center", padding: "32px 16px", color: "#94a3b8", fontSize: 13 }}>No devices found. Add your first one!</td></tr>
                        )}
                        {filtered.map(device => {
                            const linked = getLinkedTickets(device.id);
                            const sc = STATUS_COLOR[device.status] || {};
                            return (
                                <tr key={device.id} style={{ borderBottom: "1px solid #f1f5f9" }}
                                    onMouseEnter={e => e.currentTarget.style.background = "#fafbff"}
                                    onMouseLeave={e => e.currentTarget.style.background = ""}
                                >
                                    <td style={TD}>
                                        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: "#3b82f6", fontWeight: 600 }}>{device.assetTag || "—"}</span>
                                    </td>
                                    <td style={TD}>
                                        <div style={{ fontWeight: 600, fontSize: 13, color: "#0f172a" }}>{device.name}</div>
                                        {device.org && <div style={{ fontSize: 11, color: "#94a3b8" }}>{device.org}</div>}
                                    </td>
                                    {typeFields.slice(0, 2).map(f => (
                                        <td key={f} style={TD}><span style={{ fontSize: 12, color: "#475569" }}>{device.specs?.[f] || "—"}</span></td>
                                    ))}
                                    <td style={TD}>
                                        <span style={{ padding: "3px 10px", borderRadius: 99, fontSize: 11, fontWeight: 600, background: sc.bg, color: sc.text }}>
                                            {device.status || "Active"}
                                        </span>
                                    </td>
                                    <td style={TD}>{device.assignedUserId ? getUserName(device.assignedUserId) : <span style={{ color: "#94a3b8" }}>Unassigned</span>}</td>
                                    <td style={TD}><span style={{ fontSize: 12, color: "#475569" }}>{device.location || "—"}</span></td>
                                    <td style={TD}><WarrantyBadge date={device.warrantyEnd} /></td>
                                    <td style={TD}>
                                        {linked.length > 0 ? (
                                            <button onClick={() => onView(device)} style={{ background: "#eff6ff", color: "#1d4ed8", border: "none", borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                                                🎫 {linked.length} ticket{linked.length !== 1 ? "s" : ""}
                                            </button>
                                        ) : (
                                            <button onClick={() => onLinkTicket(device)} style={{ background: "#f1f5f9", color: "#64748b", border: "none", borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                                                + Link
                                            </button>
                                        )}
                                    </td>
                                    <td style={TD}>
                                        <div style={{ display: "flex", gap: 6 }}>
                                            <button onClick={() => onView(device)} style={{ background: "none", border: "1px solid #e2e8f0", borderRadius: 6, padding: "4px 9px", fontSize: 11, cursor: "pointer", color: "#475569" }}>View</button>
                                            <button onClick={() => onEdit(device)} style={{ background: "none", border: "1px solid #e2e8f0", borderRadius: 6, padding: "4px 9px", fontSize: 11, cursor: "pointer", color: "#475569" }}>Edit</button>
                                            <button onClick={() => onDelete(device)} style={{ background: "none", border: "1px solid #fca5a5", borderRadius: 6, padding: "4px 9px", fontSize: 11, cursor: "pointer", color: "#dc2626" }}>Del</button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

const TH = { padding: "10px 14px", textAlign: "left", fontSize: 10.5, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap", borderBottom: "1px solid #e2e8f0" };
const TD = { padding: "11px 14px", fontSize: 13, borderBottom: "1px solid #f8fafc", color: "#1e293b", verticalAlign: "middle" };

// ─── DEVICE DETAIL MODAL ──────────────────────────────────────────────────────
function DeviceDetailModal({ device, deviceType, users, tickets, onClose, onLinkTicket, onUnlinkTicket }) {
    const [tab, setTab] = useState("details");
    if (!device) return null;

    const typeFields = DEVICE_FIELDS[deviceType] || [];
    const getUserName = (id) => users.find(u => String(u.id) === String(id))?.name || "Unassigned";
    const linked = tickets.filter(t => t.deviceId === device.id);
    const sc = STATUS_COLOR[device.status] || {};

    return (
        <Modal open title={`📦 ${device.name}`} onClose={onClose} width={760}>
            {/* Device header */}
            <div style={{ background: "linear-gradient(135deg,#f8fafc,#eff6ff)", borderRadius: 12, padding: "16px 20px", marginBottom: 20, border: "1px solid #e2e8f0", display: "flex", gap: 20, alignItems: "center" }}>
                <div style={{ width: 56, height: 56, borderRadius: 14, background: "#fff", border: "2px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                    {DEVICE_TYPES.find(d => d.id === deviceType)?.icon}
                </div>
                <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 17, color: "#0f172a" }}>{device.name}</div>
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                        <span style={{ fontFamily: "'DM Mono',monospace", color: "#3b82f6", fontWeight: 600 }}>{device.assetTag || "No Tag"}</span>
                        {device.org && <span style={{ marginLeft: 10 }}>· {device.org}</span>}
                        {device.location && <span style={{ marginLeft: 10 }}>· 📍 {device.location}</span>}
                    </div>
                    <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                        <span style={{ padding: "3px 10px", borderRadius: 99, fontSize: 11, fontWeight: 600, background: sc.bg, color: sc.text }}>{device.status || "Active"}</span>
                        {device.warrantyEnd && <WarrantyBadge date={device.warrantyEnd} />}
                    </div>
                </div>
                <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 2 }}>Assigned To</div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{getUserName(device.assignedUserId)}</div>
                    {device.price && <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>₹{Number(device.price).toLocaleString()}</div>}
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 2, borderBottom: "1px solid #e2e8f0", marginBottom: 20 }}>
                {["details", "specs", "tickets", "timeline"].map(t => (
                    <button key={t} onClick={() => setTab(t)} style={{ padding: "8px 16px", background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, color: tab === t ? "#3b82f6" : "#64748b", borderBottom: `2px solid ${tab === t ? "#3b82f6" : "transparent"}`, textTransform: "capitalize" }}>
                        {t === "tickets" ? `🎫 Tickets (${linked.length})` : t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                ))}
            </div>

            {/* Tab content */}
            {tab === "details" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {[
                        ["Asset Tag", device.assetTag || "—"],
                        ["Organisation", device.org || "—"],
                        ["Location", device.location || "—"],
                        ["Vendor", device.vendor || "—"],
                        ["Purchase Date", device.purchaseDate || "—"],
                        ["Warranty End", device.warrantyEnd || "—"],
                        ["Purchase Price", device.price ? `₹${Number(device.price).toLocaleString()}` : "—"],
                        ["Assigned To", getUserName(device.assignedUserId)],
                    ].map(([k, v]) => (
                        <div key={k} style={{ padding: "10px 12px", background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                            <div style={{ fontSize: 10.5, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", marginBottom: 3 }}>{k}</div>
                            <div style={{ fontSize: 13, fontWeight: 500, color: "#1e293b" }}>{v}</div>
                        </div>
                    ))}
                    {device.notes && (
                        <div style={{ gridColumn: "1/-1", padding: "10px 12px", background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                            <div style={{ fontSize: 10.5, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", marginBottom: 3 }}>Notes</div>
                            <div style={{ fontSize: 13, color: "#475569" }}>{device.notes}</div>
                        </div>
                    )}
                </div>
            )}

            {tab === "specs" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {typeFields.length === 0 && <div style={{ gridColumn: "1/-1", color: "#94a3b8", textAlign: "center", padding: 24 }}>No specs for this device type.</div>}
                    {typeFields.map(f => (
                        <div key={f} style={{ padding: "10px 12px", background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                            <div style={{ fontSize: 10.5, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", marginBottom: 3 }}>{FIELD_LABELS[f]}</div>
                            <div style={{ fontSize: 13, fontWeight: 500, color: "#1e293b" }}>{device.specs?.[f] || "—"}</div>
                        </div>
                    ))}
                </div>
            )}

            {tab === "tickets" && (
                <div>
                    {linked.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "32px 16px" }}>
                            <div style={{ fontSize: 32, marginBottom: 8 }}>🎫</div>
                            <div style={{ color: "#64748b", fontSize: 13 }}>No tickets linked to this device yet.</div>
                            <button onClick={() => onLinkTicket(device)} style={{ ...bP, marginTop: 14 }}>+ Link a Ticket</button>
                        </div>
                    ) : (
                        <>
                            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                <thead>
                                    <tr style={{ background: "#f8fafc" }}>
                                        {["Ticket ID", "Summary", "Priority", "Status", "Created"].map(h => (
                                            <th key={h} style={TH}>{h}</th>
                                        ))}
                                        <th style={TH}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {linked.map(t => {
                                        const pc = PRIORITY_COLOR[t.priority] || "#94a3b8";
                                        return (
                                            <tr key={t.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                                                <td style={TD}><span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: "#3b82f6", fontWeight: 600 }}>{t.id}</span></td>
                                                <td style={TD}><span style={{ fontSize: 12 }}>{t.summary}</span></td>
                                                <td style={TD}><span style={{ fontSize: 11, fontWeight: 700, color: pc }}>● {t.priority}</span></td>
                                                <td style={TD}><span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 99, background: "#f1f5f9" }}>{t.status}</span></td>
                                                <td style={TD}><span style={{ fontSize: 11, color: "#94a3b8" }}>{new Date(t.createdAt || t.created).toLocaleDateString()}</span></td>
                                                <td style={TD}>
                                                    <button onClick={() => onUnlinkTicket(device, t)} style={{ background: "none", border: "1px solid #fca5a5", borderRadius: 6, padding: "3px 8px", fontSize: 11, cursor: "pointer", color: "#dc2626" }}>Unlink</button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            <button onClick={() => onLinkTicket(device)} style={{ ...bG, marginTop: 12, fontSize: 12 }}>+ Link Another Ticket</button>
                        </>
                    )}
                </div>
            )}

            {tab === "timeline" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {device.timeline && device.timeline.length > 0 ? device.timeline.map((ev, i) => (
                        <div key={i} style={{ display: "flex", gap: 12 }}>
                            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#eff6ff", border: "2px solid #3b82f6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>
                                {ev.icon || "📌"}
                            </div>
                            <div style={{ background: "#f8fafc", borderRadius: 10, padding: "10px 14px", flex: 1, border: "1px solid #e2e8f0" }}>
                                <div style={{ fontWeight: 600, fontSize: 13 }}>{ev.action}</div>
                                <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{ev.by} · {ev.when || new Date(ev.timestamp).toLocaleDateString()}</div>
                                {ev.note && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{ev.note}</div>}
                            </div>
                        </div>
                    )) : (
                        <div style={{ textAlign: "center", color: "#94a3b8", padding: 32 }}>No timeline events yet.</div>
                    )}
                </div>
            )}
        </Modal>
    );
}

// ─── LINK TICKET MODAL ────────────────────────────────────────────────────────
function LinkTicketModal({ device, tickets, onLink, onClose }) {
    const [search, setSearch] = useState("");
    const [selected, setSelected] = useState(null);

    const available = useMemo(() =>
        tickets.filter(t => !t.deviceId && (
            !search ||
            t.id?.toLowerCase().includes(search.toLowerCase()) ||
            t.summary?.toLowerCase().includes(search.toLowerCase())
        )).slice(0, 20),
        [tickets, search]
    );

    return (
        <Modal open title={`🔗 Link Ticket to ${device?.name}`} onClose={onClose} width={560}>
            <FF label="Search Tickets">
                <input style={iS} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by ticket ID or summary…" autoFocus />
            </FF>
            <div style={{ maxHeight: 280, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 10, marginBottom: 16 }}>
                {available.length === 0 ? (
                    <div style={{ padding: "20px 16px", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>No unlinked tickets found</div>
                ) : available.map(t => {
                    const pc = PRIORITY_COLOR[t.priority] || "#94a3b8";
                    return (
                        <div key={t.id} onClick={() => setSelected(t)} style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid #f8fafc", background: selected?.id === t.id ? "#eff6ff" : "transparent", display: "flex", gap: 12, alignItems: "center" }}>
                            <div style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${selected?.id === t.id ? "#3b82f6" : "#e2e8f0"}`, background: selected?.id === t.id ? "#3b82f6" : "transparent", flexShrink: 0 }} />
                            <div>
                                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: "#3b82f6", fontWeight: 600 }}>{t.id}</div>
                                <div style={{ fontSize: 12, color: "#475569" }}>{t.summary}</div>
                            </div>
                            <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: pc }}>● {t.priority}</span>
                        </div>
                    );
                })}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button style={bG} onClick={onClose}>Cancel</button>
                <button style={{ ...bP, opacity: selected ? 1 : 0.5, cursor: selected ? "pointer" : "not-allowed" }} onClick={() => selected && onLink(device, selected)}>
                    🔗 Link Ticket
                </button>
            </div>
        </Modal>
    );
}

// ─── DASHBOARD OVERVIEW ───────────────────────────────────────────────────────
function Dashboard({ allDevices, tickets }) {
    const stats = useMemo(() => {
        const total = Object.values(allDevices).reduce((s, arr) => s + arr.length, 0);
        const active = Object.values(allDevices).flat().filter(d => d.status === "Active").length;
        const inRepair = Object.values(allDevices).flat().filter(d => d.status === "In Repair").length;
        const linkedTickets = tickets.filter(t => t.deviceId).length;
        const expiredWarranty = Object.values(allDevices).flat().filter(d => d.warrantyEnd && new Date(d.warrantyEnd) < new Date()).length;
        return { total, active, inRepair, linkedTickets, expiredWarranty };
    }, [allDevices, tickets]);

    const byType = DEVICE_TYPES.map(dt => ({ ...dt, count: (allDevices[dt.id] || []).length }));

    return (
        <div>
            {/* Stat cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14, marginBottom: 24 }}>
                {[
                    { label: "Total Devices", value: stats.total, icon: "📦", color: "#3b82f6", bg: "#eff6ff" },
                    { label: "Active", value: stats.active, icon: "✅", color: "#16a34a", bg: "#dcfce7" },
                    { label: "In Repair", value: stats.inRepair, icon: "🔧", color: "#854d0e", bg: "#fef9c3" },
                    { label: "Linked Tickets", value: stats.linkedTickets, icon: "🎫", color: "#7c3aed", bg: "#ede9fe" },
                    { label: "Warranty Expired", value: stats.expiredWarranty, icon: "⚠️", color: "#dc2626", bg: "#fee2e2" },
                ].map(s => (
                    <div key={s.label} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "18px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, marginBottom: 10 }}>{s.icon}</div>
                        <div style={{ fontSize: 28, fontWeight: 800, color: "#0f172a", lineHeight: 1 }}>{s.value}</div>
                        <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>{s.label}</div>
                    </div>
                ))}
            </div>

            {/* By device type */}
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "20px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 16 }}>📊 Inventory by Type</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                    {byType.map(dt => (
                        <div key={dt.id} style={{ padding: "14px 16px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: 12 }}>
                            <div style={{ width: 38, height: 38, borderRadius: 10, background: dt.color + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{dt.icon}</div>
                            <div>
                                <div style={{ fontWeight: 700, fontSize: 20, color: "#0f172a" }}>{dt.count}</div>
                                <div style={{ fontSize: 12, color: "#94a3b8" }}>{dt.label}</div>
                            </div>
                            {dt.count > 0 && (
                                <div style={{ marginLeft: "auto", display: "flex", flexDirection: "column", gap: 3 }}>
                                    {["Active", "In Repair", "Retired"].map(s => {
                                        const cnt = (allDevices[dt.id] || []).filter(d => d.status === s).length;
                                        const sc = STATUS_COLOR[s] || {};
                                        if (cnt === 0) return null;
                                        return <span key={s} style={{ fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 99, background: sc.bg, color: sc.text }}>{s}: {cnt}</span>;
                                    })}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Recent tickets linked to devices */}
            {tickets.filter(t => t.deviceId).length > 0 && (
                <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "20px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.05)", marginTop: 14 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 14 }}>🎫 Recently Linked Tickets</div>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                            <tr style={{ background: "#f8fafc" }}>
                                {["Ticket ID", "Summary", "Priority", "Status", "Device"].map(h => <th key={h} style={TH}>{h}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {tickets.filter(t => t.deviceId).slice(0, 8).map(t => {
                                const device = Object.values(allDevices).flat().find(d => d.id === t.deviceId);
                                const pc = PRIORITY_COLOR[t.priority] || "#94a3b8";
                                return (
                                    <tr key={t.id} style={{ borderBottom: "1px solid #f8fafc" }}>
                                        <td style={TD}><span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: "#3b82f6", fontWeight: 600 }}>{t.id}</span></td>
                                        <td style={TD}><span style={{ fontSize: 12 }}>{t.summary}</span></td>
                                        <td style={TD}><span style={{ fontSize: 11, fontWeight: 700, color: pc }}>● {t.priority}</span></td>
                                        <td style={TD}><span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 99, background: "#f1f5f9" }}>{t.status}</span></td>
                                        <td style={TD}><span style={{ fontSize: 12, color: "#475569" }}>{device?.name || "—"}</span></td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

// ─── LOGIN PAGE ───────────────────────────────────────────────────────────────
function LoginPage({ onLogin }) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [slideIndex, setSlideIndex] = useState(0);

    const slides = [
        { icon: "📦", title: "Inventory Management", desc: "Track every device across your organisation — laptops, printers, servers, and more." },
        { icon: "🔗", title: "Linked to Helpdesk", desc: "Connect inventory items directly to support tickets for full visibility." },
        { icon: "📊", title: "Warranty & Lifecycle", desc: "Monitor warranty status, book value, and device lifecycle from one place." },
    ];

    useEffect(() => {
        const t = setInterval(() => setSlideIndex(p => (p + 1) % 3), 5000);
        return () => clearInterval(t);
    }, []);

    const handleLogin = async () => {
        if (!email || !password) return setError("Please enter email and password");
        setLoading(true); setError("");
        try {
            const res = await axios.post(AUTH_API, { email: email.trim().toLowerCase(), password });
            saveSession(res.data);
            onLogin(res.data);
        } catch (e) {
            setError(e.response?.data?.error || "Login failed. Check credentials.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ minHeight: "100vh", display: "flex", fontFamily: "'DM Sans',sans-serif", background: "#f0f2f5" }}>
            {/* Left panel */}
            <div style={{ width: 420, background: "linear-gradient(160deg,#0f172a 0%,#1e3a5f 100%)", display: "flex", flexDirection: "column", justifyContent: "center", padding: "60px 48px", flexShrink: 0 }}>
                <div style={{ marginBottom: 48 }}>
                    <div style={{ width: 48, height: 48, background: "linear-gradient(135deg,#3b82f6,#6366f1)", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, marginBottom: 20 }}>📦</div>
                    <div style={{ fontSize: 26, fontWeight: 800, color: "#fff", lineHeight: 1.2 }}>DeskFlow<br /><span style={{ color: "#60a5fa" }}>Inventory</span></div>
                    <div style={{ fontSize: 13, color: "#64748b", marginTop: 8 }}>Asset & Device Management</div>
                </div>

                {/* Slideshow */}
                <div style={{ position: "relative", height: 150 }}>
                    {slides.map((s, i) => (
                        <div key={i} style={{ position: "absolute", inset: 0, opacity: slideIndex === i ? 1 : 0, transition: "opacity 0.6s ease", pointerEvents: "none" }}>
                            <div style={{ fontSize: 40, marginBottom: 16 }}>{s.icon}</div>
                            <div style={{ fontSize: 18, fontWeight: 700, color: "#f1f5f9", marginBottom: 8 }}>{s.title}</div>
                            <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>{s.desc}</div>
                        </div>
                    ))}
                </div>

                {/* Dots */}
                <div style={{ display: "flex", gap: 8, marginTop: 24 }}>
                    {[0, 1, 2].map(i => (
                        <div key={i} onClick={() => setSlideIndex(i)} style={{ width: slideIndex === i ? 24 : 8, height: 8, borderRadius: 99, background: slideIndex === i ? "#3b82f6" : "#334155", transition: "all 0.3s", cursor: "pointer" }} />
                    ))}
                </div>

                {/* Back to helpdesk */}
                <div style={{ marginTop: "auto", paddingTop: 40 }}>
                    <a href="/" style={{ fontSize: 12, color: "#475569", textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}>
                        ← Back to Helpdesk
                    </a>
                </div>
            </div>

            {/* Right panel */}
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
                <div style={{ width: "100%", maxWidth: 420 }}>
                    <h2 style={{ fontSize: 26, fontWeight: 800, color: "#0f172a", marginBottom: 4 }}>Sign in</h2>
                    <p style={{ color: "#64748b", fontSize: 14, marginBottom: 32 }}>Use your DeskFlow account — same credentials as the helpdesk.</p>

                    {error && (
                        <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", color: "#991b1b", padding: "10px 14px", borderRadius: 8, marginBottom: 18, fontSize: 13 }}>
                            ✕ {error}
                        </div>
                    )}

                    <div style={{ marginBottom: 14 }}>
                        <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" }}>Email</label>
                        <input style={iS} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" onKeyDown={e => e.key === "Enter" && handleLogin()} />
                    </div>
                    <div style={{ marginBottom: 24 }}>
                        <label style={{ fontSize: 11, fontWeight: 700, color: "#374151", display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" }}>Password</label>
                        <input style={iS} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" onKeyDown={e => e.key === "Enter" && handleLogin()} />
                    </div>

                    <button onClick={handleLogin} disabled={loading} style={{ ...bP, width: "100%", padding: "12px 18px", fontSize: 14, opacity: loading ? 0.7 : 1 }}>
                        {loading ? "Signing in…" : "Sign In"}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── MAIN INVENTORY APP ───────────────────────────────────────────────────────
export default function Inventory({ onClose }) {
    const [currentUser, setCurrentUser] = useState(() => loadSession());
    const [view, setView] = useState("dashboard");
    const [activeType, setActiveType] = useState("laptops");
    const { toasts, showToast } = useToasts();

    // Data state
    const [allDevices, setAllDevices] = useState({ laptops: [], desktops: [], printers: [], network: [], servers: [], phones: [] });
    const [tickets, setTickets] = useState([]);
    const [users, setUsers] = useState([]);
    const [orgs, setOrgs] = useState([]);
    const [locations, setLocations] = useState([]);
    const [loading, setLoading] = useState(false);

    // Modal state
    const [showAdd, setShowAdd] = useState(false);
    const [showEdit, setShowEdit] = useState(false);
    const [showDetail, setShowDetail] = useState(false);
    const [showLinkTicket, setShowLinkTicket] = useState(false);
    const [selectedDevice, setSelectedDevice] = useState(null);
    const [deviceForm, setDeviceForm] = useState({});
    const [deleteConfirm, setDeleteConfirm] = useState(null);

    // Profile dropdown
    const [profileOpen, setProfileOpen] = useState(false);

    // ─── DATA LOADING ─────────────────────────────────────────────────────────
    const loadAll = useCallback(async () => {
        setLoading(true);
        try {
            const [usersRes, orgsRes, locsRes, ticketsRes] = await Promise.allSettled([
                axios.get(USERS_API),
                axios.get(ORGS_API),
                axios.get(LOCATIONS_API),
                axios.get(TICKETS_API),
            ]);
            if (usersRes.status === "fulfilled") setUsers(usersRes.value.data || []);
            if (orgsRes.status === "fulfilled") setOrgs(orgsRes.value.data || []);
            if (locsRes.status === "fulfilled") setLocations(locsRes.value.data || []);
            if (ticketsRes.status === "fulfilled") setTickets(ticketsRes.value.data || []);

            // Load each device type
            const results = await Promise.allSettled(
                DEVICE_TYPES.map(dt => axios.get(`${DEVICES_API}/${dt.apiKey}`))
            );
            const updated = { ...allDevices };
            results.forEach((r, i) => {
                if (r.status === "fulfilled") updated[DEVICE_TYPES[i].id] = r.value.data || [];
            });
            setAllDevices(updated);
        } catch (e) {
            console.error("Load failed:", e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { if (currentUser) loadAll(); }, [currentUser]);

    // ─── DEVICE CRUD ──────────────────────────────────────────────────────────
    const emptyForm = () => ({ assetTag: "", name: "", status: "Active", org: "", location: "", assignedUserId: "", purchaseDate: "", warrantyEnd: "", price: "", vendor: "", notes: "", specs: {} });

    const handleAdd = async () => {
        const typeConfig = DEVICE_TYPES.find(d => d.id === activeType);
        if (!deviceForm.name) return showToast("Device name is required", "error");
        try {
            await axios.post(`${DEVICES_API}/${typeConfig.apiKey}`, { ...deviceForm, deviceType: activeType });
            showToast(`✅ ${typeConfig.label.slice(0, -1)} added successfully`);
            setShowAdd(false);
            setDeviceForm({});
            loadAll();
        } catch (e) {
            showToast(e.response?.data?.error || "Failed to add device", "error");
        }
    };

    const handleEdit = async () => {
        const typeConfig = DEVICE_TYPES.find(d => d.id === activeType);
        try {
            await axios.put(`${DEVICES_API}/${typeConfig.apiKey}/${selectedDevice.id}`, deviceForm);
            showToast("✅ Device updated");
            setShowEdit(false);
            setSelectedDevice(null);
            setDeviceForm({});
            loadAll();
        } catch (e) {
            showToast(e.response?.data?.error || "Failed to update", "error");
        }
    };

    const handleDelete = async (device) => {
        const typeConfig = DEVICE_TYPES.find(d => d.id === activeType);
        try {
            await axios.delete(`${DEVICES_API}/${typeConfig.apiKey}/${device.id}`);
            showToast("🗑️ Device deleted");
            setDeleteConfirm(null);
            loadAll();
        } catch (e) {
            showToast("Failed to delete device", "error");
        }
    };

    const handleLinkTicket = async (device, ticket) => {
        try {
            await axios.patch(`${TICKETS_API}/${ticket.id}/device`, { deviceId: device.id });
            showToast(`🔗 Ticket ${ticket.id} linked to ${device.name}`);
            setShowLinkTicket(false);
            loadAll();
        } catch (e) {
            showToast("Failed to link ticket", "error");
        }
    };

    const handleUnlinkTicket = async (device, ticket) => {
        try {
            await axios.patch(`${TICKETS_API}/${ticket.id}/device`, { deviceId: null });
            showToast(`✅ Ticket ${ticket.id} unlinked`);
            loadAll();
        } catch (e) {
            showToast("Failed to unlink ticket", "error");
        }
    };

    const handleLogout = () => {
        clearSession();
        setCurrentUser(null);
        setProfileOpen(false);
    };

    // ─── NOT LOGGED IN ────────────────────────────────────────────────────────
    if (!currentUser) {
        return <LoginPage onLogin={user => { setCurrentUser(user); }} />;
    }

    // ─── COMPUTED ─────────────────────────────────────────────────────────────
    const currentDevices = allDevices[activeType] || [];
    const currentTypeConfig = DEVICE_TYPES.find(d => d.id === activeType);
    const totalDevices = Object.values(allDevices).reduce((s, arr) => s + arr.length, 0);
    const isAdmin = ["Admin", "Manager"].includes(currentUser?.role);

    // ─── RENDER ───────────────────────────────────────────────────────────────
    return (
        <div style={{ position: "fixed", inset: 0, display: "flex", height: "100vh", fontFamily: "'DM Sans',sans-serif", background: "#f0f2f5", zIndex: 999 }}>

            {/* ── SIDEBAR ── */}
            <div style={{ width: 224, background: "#0f172a", display: "flex", flexDirection: "column", flexShrink: 0, overflowY: "auto" }}>
                {/* Logo */}
                <div style={{ padding: "18px 16px 14px", borderBottom: "1px solid #1e293b", display: "flex", alignItems: "center", gap: 10, justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 34, height: 34, background: "linear-gradient(135deg,#3b82f6,#6366f1)", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>📦</div>
                        <div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>DeskFlow</div>
                            <div style={{ fontSize: 10, color: "#475569" }}>Inventory</div>
                        </div>
                    </div>
                    {onClose && (
                        <button
                            onClick={onClose}
                            style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#64748b", padding: 0, width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center" }}
                            onMouseEnter={e => e.currentTarget.style.color = "#e2e8f0"}
                            onMouseLeave={e => e.currentTarget.style.color = "#64748b"}
                        >
                            ×
                        </button>
                    )}
                </div>

                {/* Nav */}
                <div style={{ padding: "12px 8px 4px" }}>
                    <div style={{ fontSize: 9.5, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: ".08em", padding: "0 8px", marginBottom: 5 }}>Overview</div>
                    <NavItem icon="📊" label="Dashboard" active={view === "dashboard"} onClick={() => setView("dashboard")} />
                </div>

                <div style={{ padding: "12px 8px 4px" }}>
                    <div style={{ fontSize: 9.5, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: ".08em", padding: "0 8px", marginBottom: 5 }}>Device Types</div>
                    {DEVICE_TYPES.map(dt => (
                        <NavItem
                            key={dt.id}
                            icon={dt.icon}
                            label={dt.label}
                            count={(allDevices[dt.id] || []).length}
                            active={view === "devices" && activeType === dt.id}
                            color={dt.color}
                            onClick={() => { setView("devices"); setActiveType(dt.id); }}
                        />
                    ))}
                </div>

                {/* Divider + go to helpdesk */}
                <div style={{ padding: "12px 8px 4px", marginTop: "auto", borderTop: "1px solid #1e293b" }}>
                    <a href="/" style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", borderRadius: 7, color: "#64748b", fontSize: 13, fontWeight: 500, textDecoration: "none", transition: "all .15s" }}
                        onMouseEnter={e => { e.currentTarget.style.background = "#1e293b"; e.currentTarget.style.color = "#e2e8f0"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = ""; e.currentTarget.style.color = "#64748b"; }}>
                        <span style={{ fontSize: 15, width: 20, textAlign: "center" }}>🎫</span>
                        Go to Helpdesk
                    </a>
                </div>

                {/* User */}
                <div style={{ padding: "8px 8px 14px" }}>
                    <div onClick={() => setProfileOpen(p => !p)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, cursor: "pointer", position: "relative" }}
                        onMouseEnter={e => e.currentTarget.style.background = "#1e293b"}
                        onMouseLeave={e => e.currentTarget.style.background = ""}>
                        <Avatar name={currentUser.name} size={30} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{currentUser.name}</div>
                            <div style={{ fontSize: 10, color: "#475569" }}>{currentUser.role}</div>
                        </div>

                        {/* Profile dropdown */}
                        {profileOpen && (
                            <div style={{ position: "absolute", bottom: "calc(100% + 8px)", left: 8, right: 8, background: "#1e293b", borderRadius: 10, border: "1px solid #334155", boxShadow: "0 8px 24px rgba(0,0,0,0.4)", zIndex: 100 }}>
                                <div style={{ padding: "10px 12px", borderBottom: "1px solid #334155" }}>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0" }}>{currentUser.name}</div>
                                    <div style={{ fontSize: 10, color: "#64748b" }}>{currentUser.email}</div>
                                </div>
                                <div onClick={handleLogout} style={{ padding: "10px 12px", cursor: "pointer", fontSize: 12, color: "#f87171", fontWeight: 600 }}
                                    onMouseEnter={e => e.currentTarget.style.background = "#2d3748"}
                                    onMouseLeave={e => e.currentTarget.style.background = ""}>
                                    🚪 Sign Out
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── MAIN ── */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
                {/* Topbar */}
                <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "0 24px", height: 56, display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                    <div style={{ flex: 1 }}>
                        <span style={{ fontSize: 17, fontWeight: 700, color: "#0f172a" }}>
                            {view === "dashboard" ? "📊 Inventory Dashboard" : `${currentTypeConfig?.icon} ${currentTypeConfig?.label}`}
                        </span>
                        {view === "devices" && (
                            <span style={{ fontSize: 12, color: "#94a3b8", marginLeft: 10 }}>{currentDevices.length} device{currentDevices.length !== 1 ? "s" : ""}</span>
                        )}
                    </div>

                    {/* Actions */}
                    {view === "devices" && isAdmin && (
                        <button onClick={() => { setDeviceForm(emptyForm()); setShowAdd(true); }} style={bP}>
                            ➕ Add {currentTypeConfig?.label?.slice(0, -1) || "Device"}
                        </button>
                    )}
                    <button onClick={loadAll} style={bG} title="Refresh">🔄</button>
                </div>

                {/* Content */}
                <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", background: "#f0f2f5" }}>
                    {loading ? (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", flexDirection: "column", gap: 14 }}>
                            <div style={{ width: 40, height: 40, border: "3px solid #e2e8f0", borderTopColor: "#3b82f6", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                            <div style={{ color: "#94a3b8", fontSize: 13 }}>Loading inventory…</div>
                        </div>
                    ) : view === "dashboard" ? (
                        <Dashboard allDevices={allDevices} tickets={tickets} />
                    ) : (
                        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "20px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
                            <DeviceTable
                                devices={currentDevices}
                                deviceType={activeType}
                                users={users}
                                tickets={tickets}
                                onView={d => { setSelectedDevice(d); setShowDetail(true); }}
                                onEdit={d => { setSelectedDevice(d); setDeviceForm({ ...d, specs: d.specs || {} }); setShowEdit(true); }}
                                onDelete={d => setDeleteConfirm(d)}
                                onLinkTicket={d => { setSelectedDevice(d); setShowLinkTicket(true); }}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* ── MODALS ── */}

            {/* Add Device */}
            <Modal open={showAdd} onClose={() => { setShowAdd(false); setDeviceForm({}); }} title={`➕ Add ${currentTypeConfig?.label?.slice(0, -1) || "Device"}`} width={780}>
                <DeviceForm
                    deviceType={activeType}
                    form={deviceForm}
                    setForm={setDeviceForm}
                    users={users}
                    orgs={orgs}
                    locations={locations}
                    tickets={tickets}
                    onSave={handleAdd}
                    onCancel={() => { setShowAdd(false); setDeviceForm({}); }}
                    isEdit={false}
                />
            </Modal>

            {/* Edit Device */}
            <Modal open={showEdit} onClose={() => { setShowEdit(false); setDeviceForm({}); setSelectedDevice(null); }} title={`✏️ Edit ${selectedDevice?.name || "Device"}`} width={780}>
                <DeviceForm
                    deviceType={activeType}
                    form={deviceForm}
                    setForm={setDeviceForm}
                    users={users}
                    orgs={orgs}
                    locations={locations}
                    tickets={tickets}
                    onSave={handleEdit}
                    onCancel={() => { setShowEdit(false); setDeviceForm({}); setSelectedDevice(null); }}
                    isEdit={true}
                />
            </Modal>

            {/* Device Detail */}
            {showDetail && selectedDevice && (
                <DeviceDetailModal
                    device={selectedDevice}
                    deviceType={activeType}
                    users={users}
                    tickets={tickets}
                    onClose={() => { setShowDetail(false); setSelectedDevice(null); }}
                    onLinkTicket={d => { setSelectedDevice(d); setShowDetail(false); setShowLinkTicket(true); }}
                    onUnlinkTicket={handleUnlinkTicket}
                />
            )}

            {/* Link Ticket */}
            {showLinkTicket && selectedDevice && (
                <LinkTicketModal
                    device={selectedDevice}
                    tickets={tickets}
                    onLink={handleLinkTicket}
                    onClose={() => { setShowLinkTicket(false); setSelectedDevice(null); }}
                />
            )}

            {/* Delete Confirm */}
            {deleteConfirm && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, backdropFilter: "blur(3px)" }}>
                    <div style={{ background: "#fff", borderRadius: 16, padding: 32, maxWidth: 420, width: "90%", boxShadow: "0 25px 80px rgba(0,0,0,0.3)" }}>
                        <div style={{ fontSize: 32, marginBottom: 12 }}>🗑️</div>
                        <h3 style={{ margin: "0 0 10px 0", fontSize: 18, fontWeight: 700 }}>Delete Device?</h3>
                        <p style={{ color: "#64748b", fontSize: 14, marginBottom: 24 }}>
                            Are you sure you want to delete <strong>{deleteConfirm.name}</strong>? This action cannot be undone.
                        </p>
                        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                            <button style={bG} onClick={() => setDeleteConfirm(null)}>Cancel</button>
                            <button style={bD} onClick={() => handleDelete(deleteConfirm)}>Delete Device</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toasts */}
            <ToastStack toasts={toasts} />

            <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideIn { from { opacity: 0; transform: translateY(-16px); } to { opacity: 1; transform: translateY(0); } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 99px; }
      `}</style>
        </div>
    );
}

// ─── SIDEBAR NAV ITEM ─────────────────────────────────────────────────────────
function NavItem({ icon, label, active, onClick, count, color }) {
    return (
        <div onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 10px", borderRadius: 7, cursor: "pointer", color: active ? (color || "#60a5fa") : "#64748b", fontSize: 13, fontWeight: 500, marginBottom: 1, background: active ? "#1e293b" : "transparent", transition: "all .15s" }}
            onMouseEnter={e => { if (!active) { e.currentTarget.style.background = "#1e293b"; e.currentTarget.style.color = "#e2e8f0"; } }}
            onMouseLeave={e => { if (!active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#64748b"; } }}>
            <span style={{ fontSize: 15, width: 20, textAlign: "center", flexShrink: 0 }}>{icon}</span>
            <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
            {count != null && count > 0 && (
                <span style={{ marginLeft: "auto", background: active ? (color || "#3b82f6") + "33" : "#1e293b", color: active ? (color || "#60a5fa") : "#475569", fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 99, minWidth: 18, textAlign: "center" }}>
                    {count}
                </span>
            )}
        </div>
    );
}