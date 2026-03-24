const fs = require('fs');
let code = fs.readFileSync('helpdesk.jsx', 'utf8');

const oldModalStart = '<Modal open={showNewTicket} onClose={() => { setShowNewTicket(false); setShowAssigneeDD(false); }} title="Create New Ticket" width={700}>';
const newTicketModalCode = `
      <Modal open={showNewTicket} onClose={() => { setShowNewTicket(false); setShowAssigneeDD(false); }} title="Create New Ticket" width={700}>
        {(() => {
          const defaultLayout = ["org", "department", "contact", "reportedBy", "priority", "category", "location", "dueDate", "assignees", "summary", "description", "webcast", ...customAttrs.map(a => \\\`custom_\\${a.id}\\\`)];
          const currentLayout = formLayout.length > 0 ? formLayout : defaultLayout;
          const activeCustomIds = customAttrs.map(a => \\\`custom_\\${a.id}\\\`);
          const missingCustomFields = activeCustomIds.filter(id => !currentLayout.includes(id));
          const finalLayout = [...currentLayout, ...missingCustomFields].filter(id => id.startsWith("custom_") ? customAttrs.some(a => \\\`custom_\\${a.id}\\\` === id) : true);

          return (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 18px", alignItems: "start" }}>
                {finalLayout.map(fieldId => {
                  const isFullWidth = ["assignees", "summary", "description", "webcast"].includes(fieldId);
                  const wrapperStyle = { gridColumn: isFullWidth ? "1 / -1" : "auto" };
                  
                  if (fieldId === "org") return (
                    <div key={fieldId} style={wrapperStyle}>
                      <FF label="Organisation" required><select style={sS} value={form.org} onChange={e => setForm({ ...form, org: e.target.value, department: "" })}><option value="">Select…</option>{orgs.map(o => <option key={o.id}>{o.name}</option>)}</select></FF>
                    </div>
                  );
                  if (fieldId === "department") return (
                    <div key={fieldId} style={wrapperStyle}>
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
                                const filtered = departments.filter(d => (!form.org || d.orgName === form.org) && (departmentSearch === "" || d.name.toLowerCase().includes(departmentSearch.toLowerCase()))).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
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
                    </div>
                  );
                  if (fieldId === "contact") return <div key={fieldId} style={wrapperStyle}><FF label="POC(Point of Contact)"><input style={iS} placeholder="Ticket Requestor" value={form.contact} onChange={e => setForm({ ...form, contact: e.target.value })} /></FF></div>;
                  if (fieldId === "reportedBy") return <div key={fieldId} style={wrapperStyle}><FF label="Reported By"><input style={iS} placeholder="Who is raising this ticket?" value={form.reportedBy} onChange={e => setForm({ ...form, reportedBy: e.target.value })} /></FF></div>;
                  if (fieldId === "priority") return <div key={fieldId} style={wrapperStyle}><FF label="Priority"><select style={sS} value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>{PRIORITIES.map(p => <option key={p}>{p}</option>)}</select></FF></div>;
                  if (fieldId === "category") return (
                    <div key={fieldId} style={wrapperStyle}>
                      <FF label="Category">
                        <div style={{ position: "relative" }}>
                          <input type="text" placeholder="Search category..." value={categorySearch ? categorySearch : (form.category ? categories.find(c => c.name === form.category)?.name || "")} onChange={e => setCategorySearch(e.target.value)} onFocus={() => { setCategorySearch(""); setShowCategoryDD(true); }} style={{ ...iS, width: "100%", fontSize: 12 }} />
                          {showCategoryDD && <>
                            <div style={{ position: "fixed", inset: 0, zIndex: 199 }} onClick={() => { setShowCategoryDD(false); setCategorySearch(""); }} />
                            <div style={{ position: "absolute", top: "calc(100% + 3px)", left: 0, right: 0, background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 8, zIndex: 200, boxShadow: "0 4px 12px rgba(0,0,0,0.1)", maxHeight: 200, overflowY: "auto" }}>
                              <div style={{ padding: 8, borderBottom: "1px solid #f1f5f9", position: "sticky", top: 0, background: "#fff" }}>
                                <input type="text" placeholder="Search categories..." value={categorySearch} onChange={e => setCategorySearch(e.target.value)} onClick={e => e.stopPropagation()} autoFocus style={{ ...iS, width: "100%", fontSize: 12 }} />
                              </div>
                              {categories.filter(c => categorySearch === "" || c.name.toLowerCase().includes(categorySearch.toLowerCase())).map(c => (
                                <div key={c.id} onClick={() => { setForm({ ...form, category: c.name }); setShowCategoryDD(false); setCategorySearch(""); }} style={{ padding: "8px 12px", cursor: "pointer", borderBottom: "1px solid #f1f5f9" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ width: 12, height: 12, borderRadius: 3, background: c.color }} /><div style={{ fontSize: 12, fontWeight: 600 }}>{c.name}</div></div>
                                </div>
                              ))}
                              {categories.filter(c => categorySearch === "" || c.name.toLowerCase().includes(categorySearch.toLowerCase())).length === 0 && <div style={{ padding: "12px", textAlign: "center", fontSize: 12, color: "#94a3b8" }}>No categories found</div>}
                            </div>
                          </>}
                        </div>
                      </FF>
                    </div>
                  );
                  if (fieldId === "location") return (
                    <div key={fieldId} style={wrapperStyle}>
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
                                <div key={l.id} onClick={() => { setForm({ ...form, location: l.name }); setShowLocationDD(false); setLocationSearch(""); }} style={{ padding: "8px 12px", cursor: "pointer", borderBottom: "1px solid #f1f5f9" }}><div style={{ fontSize: 12, fontWeight: 600 }}>{l.name}</div></div>
                              ))}
                              {locations.filter(l => locationSearch === "" || l.name.toLowerCase().includes(locationSearch.toLowerCase())).length === 0 && <div style={{ padding: "12px", textAlign: "center", fontSize: 12, color: "#94a3b8" }}>No locations found</div>}
                            </div>
                          </>}
                        </div>
                      </FF>
                    </div>
                  );
                  if (fieldId === "dueDate") return <div key={fieldId} style={wrapperStyle}><FF label="Due Date"><input type="date" style={iS} value={form.dueDate || ""} onChange={e => setForm({ ...form, dueDate: e.target.value })} /></FF></div>;
                  
                  if (fieldId === "assignees") return (
                    <div key={fieldId} style={wrapperStyle}>
                      <FF label="Assignees">
                        {(currentUser?.role === "Admin" || currentUser?.role === "Manager") ? (
                          <div style={{ position: "relative" }}>
                            <div onClick={() => setShowAssigneeDD(!showAssigneeDD)} style={{ ...iS, cursor: "pointer", minHeight: 40, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 5, padding: form.assignees.length ? "6px 10px" : "9px 12px" }}>
                              {!form.assignees.length && <span style={{ color: "#94a3b8" }}>Click to assign agents…</span>}
                              {form.assignees.map(a => <span key={a.id} style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 6px 2px 3px", background: "#dbeafe", color: "#1d4ed8", borderRadius: 99, fontSize: 12, fontWeight: 600 }}><Avatar name={a.name} size={17} />{a.name.split(" ")[0]}<span onClick={e => { e.stopPropagation(); toggleAssignee(a); }} style={{ cursor: "pointer", fontWeight: 700, marginLeft: 2 }}>×</span></span>)}
                              <span style={{ marginLeft: "auto", color: "#94a3b8", fontSize: 11 }}>▾</span>
                            </div>
                            {showAssigneeDD && <div style={{ position: "absolute", top: "calc(100% + 3px)", left: 0, right: 0, background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 10, zIndex: 200, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", overflow: "hidden" }}>
                              <div style={{ padding: 7, borderBottom: "1px solid #f1f5f9" }}><input style={{ ...iS, fontSize: 13 }} placeholder="Search agents…" value={assigneeSearch} onChange={e => setAssigneeSearch(e.target.value)} onClick={e => e.stopPropagation()} autoFocus /></div>
                              {users.filter(u => u.active && u.name.toLowerCase().includes(assigneeSearch.toLowerCase())).map(u => {
                                const sel = form.assignees.find(a => a.id === u.id); return (
                                  <div key={u.id} onClick={() => { toggleAssignee(u); setShowAssigneeDD(false); }} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 13px", cursor: "pointer", background: sel ? "#eff6ff" : "#fff" }}><Avatar name={u.name} size={26} /><div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 600 }}>{u.name}</div><div style={{ fontSize: 11, color: "#94a3b8" }}>{u.role}</div></div>{sel && <span style={{ color: "#3b82f6", fontWeight: 700 }}>✓</span>}</div>);
                              })}
                            </div>}
                          </div>
                        ) : (<div style={{ padding: "10px 12px", background: "#eff6ff", border: "1.5px solid #bfdbfe", borderRadius: 8, color: "#1d4ed8", fontSize: 13 }}>Only Admins and Managers can assign users. Please create the ticket first, then assign users in ticket details.</div>)}
                      </FF>
                    </div>
                  );
                  
                  if (fieldId === "summary") return <div key={fieldId} style={wrapperStyle}><FF label="Summary" required><input style={iS} placeholder="Brief description of the issue" value={form.summary} onChange={e => setForm({ ...form, summary: e.target.value })} /></FF></div>;
                  if (fieldId === "description") return <div key={fieldId} style={wrapperStyle}><FF label="Description"><textarea style={{ ...iS, height: 88, resize: "vertical" }} placeholder="Detailed description…" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></FF></div>;
                  if (fieldId === "webcast") return <div key={fieldId} style={wrapperStyle}>{form.category === "Webcast" && <WebcastFields f={form} setF={setForm} isProject={false} />}</div>;
                  
                  if (fieldId.startsWith("custom_")) {
                    const a = customAttrs.find(ca => \\\`custom_\\${ca.id}\\\` === fieldId);
                    if (!a) return null;
                    return (
                      <div key={fieldId} style={wrapperStyle}>
                        <FF label={a.name} required={a.required}>
                          {a.type === "select" ? <select style={sS} value={form.customAttrs[a.name] || ""} onChange={e => setForm({ ...form, customAttrs: { ...form.customAttrs, [a.name]: e.target.value } })}><option value="">Select…</option>{a.options?.map(o => <option key={o}>{o}</option>)}</select>
                            : a.type === "checkbox" ? <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13 }}><input type="checkbox" checked={!!form.customAttrs[a.name]} onChange={e => setForm({ ...form, customAttrs: { ...form.customAttrs, [a.name]: e.target.checked } })} />{a.name}</label>
                              : <input type={a.type === "date" ? "date" : "text"} style={iS} value={form.customAttrs[a.name] || ""} onChange={e => setForm({ ...form, customAttrs: { ...form.customAttrs, [a.name]: e.target.value } })} />}
                        </FF>
                      </div>
                    );
                  }
                  return null;
                })}
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 9, marginTop: 16 }}>
                <button onClick={() => { setShowNewTicket(false); setShowAssigneeDD(false); }} style={bG}>Cancel</button>
                <button onClick={handleSubmit} style={bP}>Create Ticket</button>
              </div>
            </>
          );
        })()}
      </Modal>
`;

const projectModalStart = '      {/* ── NEW PROJECT MODAL ── */}';
const startIdx = code.indexOf(oldModalStart);
const endIdx = code.indexOf(projectModalStart);
if(startIdx !== -1 && endIdx !== -1) {
  const codeBefore = code.substring(0, startIdx);
  const codeAfter = code.substring(endIdx);
  code = codeBefore + newTicketModalCode + '\n' + codeAfter;
  fs.writeFileSync('helpdesk.jsx', code);
  console.log('Modified NEW TICKET MODAL');
} else {
  console.log('Could not find boundaries');
}
