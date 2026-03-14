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
    status: { type: DataTypes.STRING, defaultValue: "Active" },
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
        const { password, ...rest } = req.body;
        if (password && !password.startsWith("$2")) rest.password = await bcrypt.hash(password, 10);
        await User.update(rest, { where: { id: req.params.id } });
        const updated = await User.findByPk(req.params.id);
        res.json(fmt(updated));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete("/api/users/:id", async (req, res) => {
    try { await User.destroy({ where: { id: req.params.id } }); res.json({ success: true }); }
    catch (err) { res.status(500).json({ error: err.message }); }
});

// Orgs
app.get("/api/orgs", async (req, res) => {
    try { res.json((await Org.findAll()).map(fmt)); } catch (err) { res.status(500).json({ error: err.message }); }
});
app.post("/api/orgs", async (req, res) => {
    try { res.status(201).json(fmt(await Org.create(req.body))); } catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete("/api/orgs/:id", async (req, res) => {
    try { await Org.destroy({ where: { id: req.params.id } }); res.json({ success: true }); }
    catch (err) { res.status(500).json({ error: err.message }); }
});

// Categories
app.get("/api/categories", async (req, res) => {
    try { res.json((await Category.findAll()).map(fmt)); } catch (err) { res.status(500).json({ error: err.message }); }
});
app.post("/api/categories", async (req, res) => {
    try { res.status(201).json(fmt(await Category.create(req.body))); } catch (err) { res.status(500).json({ error: err.message }); }
});

// Custom Attributes
app.get("/api/customAttrs", async (req, res) => {
    try { res.json((await CustomAttr.findAll()).map(fmt)); } catch (err) { res.status(500).json({ error: err.message }); }
});
app.post("/api/customAttrs", async (req, res) => {
    try { res.status(201).json(fmt(await CustomAttr.create(req.body))); } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── 5. TICKETS (FULL LOGIC) ─────────────────────────────────────────────────

app.get("/api/tickets", async (req, res) => {
    try { res.json((await Ticket.findAll({ order: [['createdAt', 'DESC']] })).map(fmt)); }
    catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/tickets", async (req, res) => {
    try {
        if (!req.body.id) {
            const count = await Ticket.count();
            req.body.id = `TKT-${String(1001 + count).padStart(4, "0")}`;
        }
        const ticket = await Ticket.create(req.body);
        res.status(201).json(fmt(ticket));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put("/api/tickets/:id", async (req, res) => {
    try {
        // Support both TKT-XXXX and Primary Key ID
        await Ticket.update(req.body, {
            where: {
                [Op.or]: [{ id: req.params.id }]
            }
        });
        const ticket = await Ticket.findOne({ where: { id: req.params.id } });
        res.json(fmt(ticket));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete("/api/tickets/:id", async (req, res) => {
    try {
        await Ticket.destroy({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── 6. ALL-DATA & IMPORT (THE DASHBOARD RELOAD) ─────────────────────────────

// Universal Export: Get all data for all tables (for full backups)
app.get("/api/all-data", async (req, res) => {
    try {
        const [users, orgs, categories, customAttrs, tickets] = await Promise.all([
            User.findAll(), Org.findAll(), Category.findAll(), CustomAttr.findAll(), Ticket.findAll()
        ]);
        res.json({
            users: users.map(fmt),
            orgs: orgs.map(fmt),
            categories: categories.map(fmt),
            customAttrs: customAttrs.map(fmt),
            tickets: tickets.map(fmt),
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
            orgs: Org,
            categories: Category,
            customAttrs: CustomAttr,
            users: User
        };

        const Model = models[table];
        if (!Model) return res.status(400).json({ error: "Invalid table specified" });

        // Determine unique identifier for merging
        const matchField = table === 'tickets' ? 'id' : (table === 'users' ? 'email' : 'name');

        for (let item of rawData) {
            // 1. Clean up timestamps and empty fields from CSV/JSON
            const { createdAt, updatedAt, ...cleanItem } = item;

            // 2. Special handling for User passwords
            if (table === 'users' && cleanItem.password && !cleanItem.password.startsWith("$2")) {
                cleanItem.password = await bcrypt.hash(cleanItem.password, 10);
            }

            // 3. Convert JSON strings back to Objects (required for CSV imports of JSON fields)
            const jsonFields = ['options', 'assignees', 'cc', 'customAttrs', 'timeline', 'comments', 'vendor'];
            jsonFields.forEach(field => {
                if (typeof cleanItem[field] === 'string') {
                    try { cleanItem[field] = JSON.parse(cleanItem[field]); }
                    catch (e) { /* leave as is if not valid JSON */ }
                }
            });

            // 4. Merge Logic: Find by unique field, then update or create
            const [record, created] = await Model.findOrCreate({
                where: { [matchField]: cleanItem[matchField] },
                defaults: cleanItem
            });

            if (!created) {
                await record.update(cleanItem);
            }
        }

        res.json({ success: true, message: `Successfully merged data into ${table}` });
    } catch (err) {
        res.status(500).json({ error: "Import failed: " + err.message });
    }
});

// Original "Full Bundle" Import (kept for backward compatibility with full backups)
app.post("/api/all-data/import", async (req, res) => {
    try {
        const { users = [], orgs = [], categories = [], customAttrs = [], tickets = [] } = req.body;

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

        res.json({ success: true, message: "Full database merge complete" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── START ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
sequelize.sync({ alter: true }).then(() => {
    console.log("✅ MySQL Synced & Connected");
    app.listen(PORT, () => console.log(`🚀 DeskFlow API → http://localhost:${PORT}`));
}).catch(err => {
    console.error("❌ Sync Error. Check if MySQL service is running.");
    console.error(err.message);
});