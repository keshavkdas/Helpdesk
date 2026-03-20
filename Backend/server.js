// ─────────────────────────────────────────────────────────────────────────────
// server.js  —  DeskFlow Backend (Node + Express + MySQL/Sequelize)
// ─────────────────────────────────────────────────────────────────────────────
require("dotenv").config();
const express = require("express");
const { Sequelize, DataTypes, Op } = require("sequelize");
const bcrypt = require("bcryptjs");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// ─── 1. DATABASE CONNECTION ──────────────────────────────────────────────────
const sequelize = new Sequelize(
    process.env.DB_NAME || "deskflow",
    process.env.DB_USER || "root",
    process.env.DB_PASS || "",
    {
        host: process.env.DB_HOST || "127.0.0.1",
        dialect: "mysql",
        logging: false,
        dialectOptions: {
            ssl: false,
            authPlugins: {
                mysql_native_password: 'mysql_native_password'
            }
        }
    }
);

// ─── 2. SCHEMAS (MODELS) ─────────────────────────────────────────────────────

const User = sequelize.define("User", {
    name: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: false, unique: true, validate: { isEmail: true } },
    password: { type: DataTypes.STRING, allowNull: false },
    phone: { type: DataTypes.STRING, defaultValue: "" },
    role: { type: DataTypes.ENUM("Admin", "Manager", "Agent", "Viewer"), defaultValue: "Agent" },
    active: { type: DataTypes.BOOLEAN, defaultValue: true },
    status: { type: DataTypes.STRING, defaultValue: "Logged-Out" },
    confirmed: { type: DataTypes.BOOLEAN, defaultValue: true },
}, { timestamps: true });

const Org = sequelize.define("Org", {
    name: { type: DataTypes.STRING, allowNull: false },
    domain: { type: DataTypes.STRING, defaultValue: "" },
    phone: { type: DataTypes.STRING, defaultValue: "" },
}, { timestamps: true });

const Category = sequelize.define("Category", {
    name: { type: DataTypes.STRING, allowNull: false },
    color: { type: DataTypes.STRING, defaultValue: "#3b82f6" },
}, { timestamps: true });

const CustomAttr = sequelize.define("CustomAttr", {
    name: { type: DataTypes.STRING, allowNull: false },
    type: { type: DataTypes.ENUM("text", "number", "select", "date", "checkbox"), defaultValue: "text" },
    options: { type: DataTypes.JSON, defaultValue: [] },
    required: { type: DataTypes.BOOLEAN, defaultValue: false },
}, { timestamps: true });

const Satsang = sequelize.define("Satsang", {
    name: { type: DataTypes.STRING, allowNull: false },
    date: { type: DataTypes.DATEONLY, allowNull: false },
    location: { type: DataTypes.STRING, defaultValue: "" },
    type: { type: DataTypes.STRING, defaultValue: "" },
    attendees: { type: DataTypes.INTEGER, defaultValue: 0 },
    status: { type: DataTypes.ENUM("Live", "Completed"), defaultValue: "Completed" },
}, { timestamps: true });

const Ticket = sequelize.define("Ticket", {
    // We explicitly mark this as the Primary Key so Sequelize is happy
    id: {
        type: DataTypes.STRING,
        primaryKey: true,
        unique: true
    },
    summary: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT },
    org: { type: DataTypes.STRING, defaultValue: "" },
    department: { type: DataTypes.STRING, defaultValue: "" },
    contact: { type: DataTypes.STRING, defaultValue: "" },
    reportedBy: { type: DataTypes.STRING, defaultValue: "" },
    assignees: { type: DataTypes.JSON, defaultValue: [] },
    cc: { type: DataTypes.JSON, defaultValue: [] },
    priority: { type: DataTypes.STRING, defaultValue: "Medium" },
    category: { type: DataTypes.STRING, defaultValue: "" },
    status: { type: DataTypes.STRING, defaultValue: "Open" },
    customAttrs: { type: DataTypes.JSON, defaultValue: {} },
    isWebcast: { type: DataTypes.BOOLEAN, defaultValue: false },
    satsangType: { type: DataTypes.STRING, defaultValue: "" },
    location: { type: DataTypes.STRING, defaultValue: "" },
    timeline: { type: DataTypes.JSON, defaultValue: [] },
    comments: { type: DataTypes.JSON, defaultValue: [] },
    vendor: { type: DataTypes.JSON, defaultValue: null },
    dueDate: { type: DataTypes.DATE, defaultValue: null },
    satsangId: { type: DataTypes.INTEGER, defaultValue: null },
}, { timestamps: true });

const Webcast = sequelize.define("Webcast", {
    id: { type: DataTypes.STRING, primaryKey: true, unique: true },
    summary: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT },
    org: { type: DataTypes.STRING, defaultValue: "" },
    department: { type: DataTypes.STRING, defaultValue: "" },
    contact: { type: DataTypes.STRING, defaultValue: "" },
    reportedBy: { type: DataTypes.STRING, defaultValue: "" },
    assignees: { type: DataTypes.JSON, defaultValue: [] },
    cc: { type: DataTypes.JSON, defaultValue: [] },
    priority: { type: DataTypes.STRING, defaultValue: "Medium" },
    category: { type: DataTypes.STRING, defaultValue: "Webcast" },
    status: { type: DataTypes.STRING, defaultValue: "Open" },
    customAttrs: { type: DataTypes.JSON, defaultValue: {} },
    isWebcast: { type: DataTypes.BOOLEAN, defaultValue: true },
    satsangType: { type: DataTypes.STRING, defaultValue: "" },
    location: { type: DataTypes.STRING, defaultValue: "" },
    timeline: { type: DataTypes.JSON, defaultValue: [] },
    comments: { type: DataTypes.JSON, defaultValue: [] },
    vendor: { type: DataTypes.JSON, defaultValue: null },
    dueDate: { type: DataTypes.DATE, defaultValue: null },
    satsangId: { type: DataTypes.INTEGER, defaultValue: null },
}, { timestamps: true });

const Project = sequelize.define("Project", {
    id: { type: DataTypes.STRING, primaryKey: true, unique: true },
    title: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT, defaultValue: "" },
    status: { type: DataTypes.STRING, defaultValue: "Open" },
    progress: { type: DataTypes.INTEGER, defaultValue: 0 }, // 0 to 100
    owner: { type: DataTypes.STRING, defaultValue: "" },
    team: { type: DataTypes.JSON, defaultValue: [] },
    startDate: { type: DataTypes.DATEONLY, defaultValue: null },
    dueDate: { type: DataTypes.DATEONLY, defaultValue: null },
    comments: { type: DataTypes.JSON, defaultValue: [] },
    tasks: { type: DataTypes.JSON, defaultValue: [] }
}, { timestamps: true });

// ✅ NEW: Department Model
const Department = sequelize.define("Department", {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
    },
}, { timestamps: true });

// ✅ NEW: Location Model
const Location = sequelize.define("Location", {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
    },
}, { timestamps: true });

// ─── SERIALIZER (Matches your original fmt) ──────────────────────────────────
const fmt = (doc) => {
    if (!doc) return null;
    const obj = doc.get ? doc.get({ plain: true }) : { ...doc };
    if (obj.password) delete obj.password;
    return obj;
};

// ─── 3. AUTH ROUTES ──────────────────────────────────────────────────────────

app.post("/api/auth/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: "Required fields missing" });
        const user = await User.findOne({ where: { email: email.toLowerCase() } });
        if (!user || !user.active) return res.status(401).json({ error: "Account not found or inactive" });
        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(401).json({ error: "Incorrect password" });
        res.json(fmt(user));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/auth/signup", async (req, res) => {
    try {
        const { email, password, ...rest } = req.body;
        const exists = await User.findOne({ where: { email: email.toLowerCase() } });
        if (exists) return res.status(409).json({ error: "Email exists" });
        const count = await User.count();
        const role = count === 0 ? "Admin" : (rest.role || "Agent");
        const hashed = await bcrypt.hash(password, 10);
        const user = await User.create({ ...rest, email: email.toLowerCase(), password: hashed, role });
        res.status(201).json(fmt(user));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── 4. USERS, ORGS, CATEGORIES, ATTRS (FULL CRUD) ───────────────────────────

app.get("/api/users", async (req, res) => {
    try { res.json((await User.findAll({ order: [['createdAt', 'ASC']] })).map(fmt)); }
    catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/users", async (req, res) => {
    try {
        const { email, password, ...rest } = req.body;
        const hashed = await bcrypt.hash(password, 10);
        const user = await User.create({ ...rest, email: email.toLowerCase(), password: hashed });
        res.status(201).json(fmt(user));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put("/api/users/:id", async (req, res) => {
    try {
        const user = await User.findByPk(req.params.id);
        if (!user) return res.status(404).json({ error: "User not found" });
        if (req.body.password) req.body.password = await bcrypt.hash(req.body.password, 10);
        await user.update(req.body);
        res.json(fmt(user));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete("/api/users/:id", async (req, res) => {
    try {
        const user = await User.findByPk(req.params.id);
        if (!user) return res.status(404).json({ error: "User not found" });
        await user.destroy();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/validate-sessions", async (req, res) => {
    try {
        const { emails } = req.body; // emails is array of current logged in emails
        const users = await User.findAll({
            where: { email: { [Op.in]: emails } }
        });

        const validUsers = new Set(users.map(u => u.email));
        const inactive = emails.filter(e => !validUsers.has(e)); // emails no longer in DB

        res.json({
            active: users.map(u => u.email),
            inactive: inactive,
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/orgs", async (req, res) => {
    try { res.json(await Org.findAll()); }
    catch (err) { res.status(500).json({ error: err.message }); }
});
app.post("/api/orgs", async (req, res) => {
    try { res.status(201).json(await Org.create(req.body)); }
    catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete("/api/orgs/:id", async (req, res) => {
    try {
        const org = await Org.findByPk(req.params.id);
        if (org) await org.destroy();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/categories", async (req, res) => {
    try {
        const cats = await Category.findAll({ order: [['name', 'ASC']] });
        res.json(cats.map(fmt));
    } catch (err) { res.status(500).json({ error: err.message }); }
});
app.post("/api/categories", async (req, res) => {
    try { res.status(201).json(await Category.create(req.body)); }
    catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete("/api/categories/:id", async (req, res) => {
    try {
        const cat = await Category.findByPk(req.params.id);
        if (cat) await cat.destroy();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/satsangs", async (req, res) => {
    try { res.json(await Satsang.findAll({ order: [['date', 'DESC']] })); }
    catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/satsangs", async (req, res) => {
    try { res.status(201).json(await Satsang.create(req.body)); }
    catch (err) { res.status(500).json({ error: err.message }); }
});

app.put("/api/satsangs/:id", async (req, res) => {
    try {
        const s = await Satsang.findByPk(req.params.id);
        if (s) await s.update(req.body);
        res.json(fmt(s));
    } catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete("/api/satsangs/:id", async (req, res) => {
    try {
        const s = await Satsang.findByPk(req.params.id);
        if (s) await s.destroy();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/customAttrs", async (req, res) => {
    try { res.json(await CustomAttr.findAll()); }
    catch (err) { res.status(500).json({ error: err.message }); }
});
app.post("/api/customAttrs", async (req, res) => {
    try { res.status(201).json(await CustomAttr.create(req.body)); }
    catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete("/api/customAttrs/:id", async (req, res) => {
    try {
        const attr = await CustomAttr.findByPk(req.params.id);
        if (attr) await attr.destroy();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ✅ NEW: Departments (Full CRUD)
app.get("/api/departments", async (req, res) => {
    try {
        const departments = await Department.findAll({ order: [['name', 'ASC']] });
        res.json(departments.map(fmt));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post("/api/departments", async (req, res) => {
    try {
        const { name } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ error: "Department name is required" });
        }

        const existing = await Department.findOne({ where: { name: name.trim() } });
        if (existing) {
            return res.status(409).json({ error: "Department already exists" });
        }

        const dept = await Department.create({ name: name.trim() });
        res.status(201).json(fmt(dept));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete("/api/departments/:id", async (req, res) => {
    try {
        const { id } = req.params;

        const dept = await Department.findByPk(id);
        if (!dept) {
            return res.status(404).json({ error: "Department not found" });
        }

        await dept.destroy();
        res.json({ success: true, message: "Department deleted" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ✅ NEW: Locations (Full CRUD)
app.get("/api/locations", async (req, res) => {
    try {
        const locations = await Location.findAll({ order: [['name', 'ASC']] });
        res.json(locations.map(fmt));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post("/api/locations", async (req, res) => {
    try {
        const { name } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ error: "Location name is required" });
        }

        const existing = await Location.findOne({ where: { name: name.trim() } });
        if (existing) {
            return res.status(409).json({ error: "Location already exists" });
        }

        const loc = await Location.create({ name: name.trim() });
        res.status(201).json(fmt(loc));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete("/api/locations/:id", async (req, res) => {
    try {
        const { id } = req.params;

        const loc = await Location.findByPk(id);
        if (!loc) {
            return res.status(404).json({ error: "Location not found" });
        }

        await loc.destroy();
        res.json({ success: true, message: "Location deleted" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── 5. TICKETS (FULL LOGIC) ─────────────────────────────────────────────────

app.get("/api/tickets", async (req, res) => {
    try {
        const tickets = await Ticket.findAll({ order: [['createdAt', 'DESC']] });
        res.json(tickets.map(fmt));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/tickets", async (req, res) => {
    try {
        const ticket = await Ticket.create(req.body);
        res.status(201).json(fmt(ticket));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put("/api/tickets/:id", async (req, res) => {
    try {
        const ticket = await Ticket.findByPk(req.params.id);
        if (!ticket) return res.status(404).json({ error: "Ticket not found" });
        await ticket.update(req.body);
        res.json(fmt(ticket));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete("/api/tickets/:id", async (req, res) => {
    try {
        const ticket = await Ticket.findByPk(req.params.id);
        if (ticket) await ticket.destroy();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── 6. PROJECTS (FULL LOGIC) ────────────────────────────────────────────────

app.get("/api/projects", async (req, res) => {
    try {
        const projects = await Project.findAll({ order: [['createdAt', 'DESC']] });
        res.json(projects.map(fmt));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/projects", async (req, res) => {
    try {
        const project = await Project.create(req.body);
        res.status(201).json(fmt(project));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put("/api/projects/:id", async (req, res) => {
    try {
        const project = await Project.findByPk(req.params.id);
        if (!project) return res.status(404).json({ error: "Project not found" });
        await project.update(req.body);
        res.json(fmt(project));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete("/api/projects/:id", async (req, res) => {
    try {
        const project = await Project.findByPk(req.params.id);
        if (project) await project.destroy();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── 7. ALL-DATA ENDPOINT ────────────────────────────────────────────────────

app.get("/api/all-data", async (req, res) => {
    try {
        const [users, orgs, categories, customAttrs, tickets, webcasts, satsangs, projects, departments, locations] = await Promise.all([
            User.findAll(), Org.findAll(), Category.findAll(), CustomAttr.findAll(), Ticket.findAll(), Webcast.findAll(), Satsang.findAll(), Project.findAll(), Department.findAll(), Location.findAll()
        ]);
        res.json({
            users: users.map(fmt),
            orgs: orgs.map(fmt),
            categories: categories.map(fmt),
            customAttrs: customAttrs.map(fmt),
            tickets: tickets.map(fmt),
            webcasts: webcasts.map(fmt),
            satsangs: satsangs.map(fmt),
            projects: projects.map(fmt),
            departments: departments.map(fmt),
            locations: locations.map(fmt),
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Selective Import: Merges data into a specific table (CSV or JSON)
app.post("/api/import/:table", async (req, res) => {
    try {
        const { table } = req.params;
        // Ensure data is an array even if a single object is sent
        const rawData = Array.isArray(req.body) ? req.body : [req.body];

        const models = {
            tickets: Ticket,
            webcasts: Webcast,
            satsangs: Satsang,
            orgs: Org,
            categories: Category,
            customAttrs: CustomAttr,
            users: User,
            projects: Project,
            departments: Department,
            locations: Location
        };

        const Model = models[table];
        if (!Model) return res.status(400).json({ error: "Invalid table specified" });

        // Get all valid column names for this specific database table
        const validColumns = Object.keys(Model.rawAttributes);

        // ─── TICKETS, WEBCASTS & PROJECTS IMPORT LOGIC ────────────
        if (table === "tickets" || table === "webcasts" || table === "projects") {

            let prefix = "TKT";
            if (table === "webcasts") prefix = "WEB";
            if (table === "projects") prefix = "PRJ";

            const lastRecord = await Model.findOne({
                where: { id: { [Op.like]: `${prefix}-%` } },
                order: [['createdAt', 'DESC']]
            });

            let nextIdNum = 1001;
            if (lastRecord && lastRecord.id) {
                const lastNum = parseInt(lastRecord.id.split("-")[1], 10);
                if (!isNaN(lastNum)) nextIdNum = lastNum + 1;
            } else {
                nextIdNum = 1001 + await Model.count();
            }

            for (let item of rawData) {
                // 🛑 1. Bulletproof Header Skip: Check if any value in the row is "Summary" or "Ticket #"
                const rowValues = Object.values(item);
                if (rowValues.includes("Summary") || rowValues.includes("Ticket #")) {
                    continue; // Skip the header row completely
                }

                // 2. Strict Filter: Keep ONLY valid columns. Strip empty strings and old IDs.
                const cleanItem = {};
                for (const key in item) {
                    if (validColumns.includes(key) && !['id', 'createdAt', 'updatedAt'].includes(key)) {
                        cleanItem[key] = item[key];
                    }
                }

                // Skip completely empty rows
                if (Object.keys(cleanItem).length === 0) continue;

                // 3. Force Organization to VVMVP (overrides whatever the CSV says)
                cleanItem.org = "VVMVP";

                // 4. Clean up JSON fields if they come in as strings from CSV
                const jsonFields = ['assignees', 'cc', 'customAttrs', 'timeline', 'comments', 'vendor'];
                jsonFields.forEach(field => {
                    if (typeof cleanItem[field] === 'string') {
                        try { cleanItem[field] = JSON.parse(cleanItem[field]); }
                        catch (e) { cleanItem[field] = []; }
                    }
                });

                // 5. Generate the next ID in the sequence
                cleanItem.id = `${prefix}-${String(nextIdNum).padStart(4, "0")}`;
                nextIdNum++;

                // 6. Create the record! Missing fields get ignored.
                await Model.create(cleanItem);
            }
        }
        // ─── IMPORT LOGIC FOR USERS, ORGS, CATEGORIES, SATSANGS, DEPARTMENTS, LOCATIONS ────────────
        else {
            const matchField = table === 'users' ? 'email' : 'name';

            for (let item of rawData) {
                // 🛑 Bulletproof Header Skip for other tables
                const rowValues = Object.values(item);
                if (rowValues.includes("Name") || rowValues.includes("Email")) {
                    continue;
                }

                // 1. Strict Filter: Keep ONLY valid columns. Strip empty strings and old IDs.
                const cleanItem = {};
                for (const key in item) {
                    if (validColumns.includes(key) && !['id', 'createdAt', 'updatedAt'].includes(key)) {
                        cleanItem[key] = item[key];
                    }
                }

                // Skip completely empty rows or if the critical matching field is missing
                if (Object.keys(cleanItem).length === 0 || !cleanItem[matchField]) continue;

                // Hash passwords for imported users if needed
                if (table === 'users' && cleanItem.password && !cleanItem.password.startsWith("$2")) {
                    cleanItem.password = await bcrypt.hash(cleanItem.password, 10);
                }

                // Parse JSON options for custom attributes
                if (typeof cleanItem.options === 'string') {
                    try { cleanItem.options = JSON.parse(cleanItem.options); }
                    catch (e) { cleanItem.options = []; }
                }

                // Merge: Find by unique field, then update or create
                const [record, created] = await Model.findOrCreate({
                    where: { [matchField]: cleanItem[matchField] },
                    defaults: cleanItem
                });

                if (!created) {
                    await record.update(cleanItem);
                }
            }
        }

        res.json({ success: true, message: `Successfully imported data into ${table}` });
    } catch (err) {
        console.error("Import Error:", err);
        res.status(500).json({ error: "Import failed: " + err.message });
    }
});

// Original "Full Bundle" Import (kept for backward compatibility with full backups)
app.post("/api/all-data/import", async (req, res) => {
    try {
        const { users = [], orgs = [], categories = [], customAttrs = [], tickets = [], webcasts = [], satsangs = [], projects = [], departments = [], locations = [] } = req.body;

        const merge = async (model, data, field) => {
            for (const item of data) {
                const { createdAt, updatedAt, ...c } = item;
                const [r, created] = await model.findOrCreate({ where: { [field]: c[field] }, defaults: c });
                if (!created) await r.update(c);
            }
        };

        if (orgs.length) await merge(Org, orgs, 'name');
        if (categories.length) await merge(Category, categories, 'name');
        if (customAttrs.length) await merge(CustomAttr, customAttrs, 'name');
        if (tickets.length) await merge(Ticket, tickets, 'id');
        if (webcasts.length) await merge(Webcast, webcasts, 'id');
        if (satsangs.length) await merge(Satsang, satsangs, 'name');
        if (projects.length) await merge(Project, projects, 'id');
        if (departments.length) await merge(Department, departments, 'name');
        if (locations.length) await merge(Location, locations, 'name');

        res.json({ success: true, message: "Full database merge complete" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── HEALTH ───────────────────────────────────────────────────────────────────

app.get("/", (req, res) => res.json({ msg: "🚀 DeskFlow API v1" }));

// ─── START ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
sequelize.sync({ alter: true }).then(async () => {
    console.log("✅ MySQL Synced & Connected");

    // Data Migration: Normalize user statuses
    try {
        await User.update({ status: "Logged-In" }, { where: { status: "Active" } });
        await User.update({ status: "Logged-Out" }, { where: { status: { [Op.or]: ["Not Active", "Logged-out"] } } });
        console.log("📊 User status data migrated successfully");
    } catch (migErr) {
        console.error("⚠️ Status migration warning:", migErr.message);
    }

    // ✅ NO HARDCODED DEPARTMENTS & LOCATIONS - Only add via frontend!
    // Departments and Locations must be created manually through Settings tabs

    app.listen(PORT, () => console.log(`🚀 DeskFlow API → http://localhost:${PORT}`));
}).catch(err => {
    console.error("❌ Sync Error. Check if MySQL service is running.");
    console.error(err.message);
});