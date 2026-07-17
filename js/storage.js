/**
 * WF Tasks – Storage Module
 * Centraliza todas as operações de LocalStorage
 */
const WFStorage = {
  KEYS: {
    USERS:    'wf_users',
    SESSION:  'wf_session',
    TASKS:    'wf_tasks',
    SETTINGS: 'wf_settings',
    THEME:    'wf_theme',
    SIDEBAR:  'wf_sidebar_collapsed'
  },

  // ---------- primitivas ----------

  get(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.error('[WFStorage] get:', e);
      return null;
    }
  },

  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error('[WFStorage] set:', e);
      return false;
    }
  },

  remove(key) {
    localStorage.removeItem(key);
  },

  // ---------- usuários ----------

  getUsers() { return this.get(this.KEYS.USERS) || []; },
  saveUsers(users) { return this.set(this.KEYS.USERS, users); },

  addUser(user) {
    const users = this.getUsers();
    users.push(user);
    return this.saveUsers(users);
  },

  getUserByEmail(email) {
    return this.getUsers().find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
  },

  updateUser(email, updates) {
    const users = this.getUsers();
    const idx = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());
    if (idx === -1) return null;
    users[idx] = { ...users[idx], ...updates };
    this.saveUsers(users);
    return users[idx];
  },

  deleteUser(email) {
    const users = this.getUsers().filter(u => u.email.toLowerCase() !== email.toLowerCase());
    return this.saveUsers(users);
  },

  // ---------- sessão ----------

  getSession()  { return this.get(this.KEYS.SESSION); },
  clearSession(){ this.remove(this.KEYS.SESSION); },
  isLoggedIn()  { return this.getSession() !== null; },

  saveSession(user) {
    const { password, ...safe } = user;
    return this.set(this.KEYS.SESSION, safe);
  },

  // ---------- tarefas ----------

  getTasks() { return this.get(this.KEYS.TASKS) || []; },
  saveTasks(tasks) { return this.set(this.KEYS.TASKS, tasks); },

  addTask(task) {
    const tasks = this.getTasks();
    tasks.push(task);
    return this.saveTasks(tasks);
  },

  getTaskById(id) {
    return this.getTasks().find(t => t.id === id) || null;
  },

  updateTask(id, updates) {
    const tasks = this.getTasks();
    const idx = tasks.findIndex(t => t.id === id);
    if (idx === -1) return null;
    tasks[idx] = { ...tasks[idx], ...updates, updatedAt: new Date().toISOString() };
    this.saveTasks(tasks);
    return tasks[idx];
  },

  deleteTask(id) {
    const tasks = this.getTasks().filter(t => t.id !== id);
    this.saveTasks(tasks);
    return tasks;
  },

  // ---------- configurações ----------

  getSettings()         { return this.get(this.KEYS.SETTINGS) || {}; },
  saveSettings(patch)   { return this.set(this.KEYS.SETTINGS, { ...this.getSettings(), ...patch }); },

  // ---------- tema ----------

  getTheme()      { return localStorage.getItem(this.KEYS.THEME) || 'light'; },
  saveTheme(t)    { localStorage.setItem(this.KEYS.THEME, t); },

  // ---------- sidebar recolhida ----------

  getSidebarCollapsed()   { return localStorage.getItem(this.KEYS.SIDEBAR) === '1'; },
  saveSidebarCollapsed(v) { localStorage.setItem(this.KEYS.SIDEBAR, v ? '1' : '0'); },

  // ---------- e-mail pendente (verificação de conta) ----------

  getPendingEmail()       { return localStorage.getItem('wf_pending_email') || null; },
  savePendingEmail(email) { localStorage.setItem('wf_pending_email', email); },
  clearPendingEmail()     { localStorage.removeItem('wf_pending_email'); }
};
