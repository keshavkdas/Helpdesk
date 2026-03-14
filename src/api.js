import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000/api'
});

// ─── ERROR INTERCEPTOR ────────────────────────────────────────────────────────
// Without this, axios wraps server errors as:
//   err.message = "Request failed with status code 401"
// instead of your actual server message like "Incorrect password".
//
// This interceptor extracts the real message from err.response.data.error
// so every catch block in the app gets the human-readable server error.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const serverMessage =
      error?.response?.data?.error ||   // your server sends { error: "..." }
      error?.response?.data?.message ||  // fallback if server uses "message"
      error?.message ||                  // fallback to axios generic message
      "Something went wrong";
    // Replace the error message so catch(err) => err.message works everywhere
    error.message = serverMessage;
    return Promise.reject(error);
  }
);

// ─── HELPER ───────────────────────────────────────────────────────────────────
const handleResponse = (promise) => promise.then((res) => res.data);

// ─── AUTH ─────────────────────────────────────────────────────────────────────
export const AUTH_API = {
  // Called by handleLogin in the JSX with (email, password) as separate args
  login: (email, password) =>
    handleResponse(api.post('/auth/login', { email, password })),

  // Available if you ever call AUTH_API.signup directly
  signup: (userData) =>
    handleResponse(api.post('/auth/signup', userData)),
};

// ─── USERS ────────────────────────────────────────────────────────────────────
export const USERS_API = {
  getAll: () => handleResponse(api.get('/users')),
  create: (user) => handleResponse(api.post('/users', user)),
  update: (id, user) => handleResponse(api.put(`/users/${id}`, user)),
  delete: (id) => handleResponse(api.delete(`/users/${id}`)),
};

// ─── ORGANISATIONS ────────────────────────────────────────────────────────────
export const ORGS_API = {
  getAll: () => handleResponse(api.get('/orgs')),
  create: (org) => handleResponse(api.post('/orgs', org)),
  update: (id, org) => handleResponse(api.put(`/orgs/${id}`, org)),
  delete: (id) => handleResponse(api.delete(`/orgs/${id}`)),
};

// ─── CATEGORIES ───────────────────────────────────────────────────────────────
export const CATEGORIES_API = {
  getAll: () => handleResponse(api.get('/categories')),
  create: (cat) => handleResponse(api.post('/categories', cat)),
  update: (id, cat) => handleResponse(api.put(`/categories/${id}`, cat)),
  delete: (id) => handleResponse(api.delete(`/categories/${id}`)),
};

// ─── CUSTOM ATTRIBUTES ────────────────────────────────────────────────────────
export const CUSTOM_ATTRS_API = {
  getAll: () => handleResponse(api.get('/customAttrs')),
  create: (attr) => handleResponse(api.post('/customAttrs', attr)),
  update: (id, attr) => handleResponse(api.put(`/customAttrs/${id}`, attr)),
  delete: (id) => handleResponse(api.delete(`/customAttrs/${id}`)),
};

// ─── TICKETS ──────────────────────────────────────────────────────────────────
export const TICKETS_API = {
  getAll: () => handleResponse(api.get('/tickets')),
  create: (ticket) => handleResponse(api.post('/tickets', ticket)),
  update: (id, ticket) => handleResponse(api.put(`/tickets/${id}`, ticket)),
  delete: (id) => handleResponse(api.delete(`/tickets/${id}`)),
};

// ─── DATABASE ─────────────────────────────────────────────────────────────────
export const DB_API = {
  // Loads all collections in one request — used on app mount by loadData()
  getAllData: () => handleResponse(api.get('/all-data')),

  // Bulk overwrite — used by the "Import Data File" button in Settings
  replaceData: (data) => handleResponse(api.post('/all-data/import', data)),
};