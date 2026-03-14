import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000/api'
});

export const USERS_API = {
  getAll: () => api.get('/users').then(res => res.data),
  create: (user) => api.post('/users', user).then(res => res.data),
  update: (id, user) => api.put(`/users/${id}`, user).then(res => res.data),
  delete: (id) => api.delete(`/users/${id}`).then(res => res.data),
};

export const AUTH_API = {
  login: async (email, password) => {
    const users = await USERS_API.getAll();
    const user = users.find(u => u.email === email && u.password === password);
    if (!user) throw new Error("Invalid credentials");
    if (!user.confirmed) throw new Error("Please confirm your email before logging in.");
    return user;
  },
  signup: async (userData) => {
    const users = await USERS_API.getAll();
    const existing = users.find(u => u.email === userData.email);

    // If the user already exists AND has a password, they are already registered.
    if (existing && existing.password) {
      throw new Error("User with this email already exists");
    }

    // If the user exists and does NOT have a password, they are likely
    // an Agent pre-registered by an Admin. The frontend logic handles
    // this update with a PUT request.

    return userData;
  }
};

export const ORGS_API = {
  getAll: () => api.get('/orgs').then(res => res.data),
  create: (org) => api.post('/orgs', org).then(res => res.data),
  update: (id, org) => api.put(`/orgs/${id}`, org).then(res => res.data),
  delete: (id) => api.delete(`/orgs/${id}`).then(res => res.data),
};

export const CATEGORIES_API = {
  getAll: () => api.get('/categories').then(res => res.data),
  create: (cat) => api.post('/categories', cat).then(res => res.data),
  update: (id, cat) => api.put(`/categories/${id}`, cat).then(res => res.data),
  delete: (id) => api.delete(`/categories/${id}`).then(res => res.data),
};

export const CUSTOM_ATTRS_API = {
  getAll: () => api.get('/customAttrs').then(res => res.data),
  create: (attr) => api.post('/customAttrs', attr).then(res => res.data),
  update: (id, attr) => api.put(`/customAttrs/${id}`, attr).then(res => res.data),
  delete: (id) => api.delete(`/customAttrs/${id}`).then(res => res.data),
};

export const TICKETS_API = {
  getAll: () => api.get('/tickets').then(res => res.data),
  create: (ticket) => api.post('/tickets', ticket).then(res => res.data),
  update: (id, ticket) => api.put(`/tickets/${id}`, ticket).then(res => res.data),
  delete: (id) => api.delete(`/tickets/${id}`).then(res => res.data),
};

// Generic DB operations for import/export
export const DB_API = {
  getRawData: () => api.get('/db').then(res => res.data), // json-server by default serves whole db at /db sometimes, or we fetch all endpoints
  getAllData: async () => {
    const [users, orgs, categories, customAttrs, tickets] = await Promise.all([
      USERS_API.getAll(),
      ORGS_API.getAll(),
      CATEGORIES_API.getAll(),
      CUSTOM_ATTRS_API.getAll(),
      TICKETS_API.getAll()
    ]);
    return { users, orgs, categories, customAttrs, tickets };
  },
  replaceData: async (data) => {
    // A simple json-server workaround to replace all data:
    // json-server doesn't natively support full DB overwrite via REST cleanly without extra middleware.
    // However, if we write to db.json on the server side or delete all and insert, we could do it.
    // As a simple REST approach for now:
    // Delete all existing and post new.
    const current = await DB_API.getAllData();

    // Clear old data
    for (const u of current.users) await USERS_API.delete(u.id);
    for (const o of current.orgs) await ORGS_API.delete(o.id);
    for (const c of current.categories) await CATEGORIES_API.delete(c.id);
    for (const a of current.customAttrs) await CUSTOM_ATTRS_API.delete(a.id);
    for (const t of current.tickets) await TICKETS_API.delete(t.id);

    // Insert new data
    for (const u of data.users || []) await USERS_API.create(u);
    for (const o of data.orgs || []) await ORGS_API.create(o);
    for (const c of data.categories || []) await CATEGORIES_API.create(c);
    for (const a of data.customAttrs || []) await CUSTOM_ATTRS_API.create(a);
    for (const t of data.tickets || []) await TICKETS_API.create(t);
  }
};
