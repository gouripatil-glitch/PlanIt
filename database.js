const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '.data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = process.env.DB_PATH || path.join(dataDir, 'todos.db');
const db = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// Create the todos table
db.exec(`
  CREATE TABLE IF NOT EXISTS todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Other',
    is_important INTEGER NOT NULL DEFAULT 0,
    is_urgent INTEGER NOT NULL DEFAULT 0,
    date_time TEXT,
    completed INTEGER NOT NULL DEFAULT 0,
    parent_id INTEGER DEFAULT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (parent_id) REFERENCES todos(id) ON DELETE CASCADE
  )
`);

// Add parent_id column if missing (migration for existing DBs)
try {
  db.exec(`ALTER TABLE todos ADD COLUMN parent_id INTEGER DEFAULT NULL REFERENCES todos(id) ON DELETE CASCADE`);
} catch (e) {
  // Column already exists, ignore
}

// Helper functions
const getAllTodos = () => {
  return db.prepare('SELECT * FROM todos ORDER BY date_time ASC, created_at DESC').all();
};

const getTodosByDate = (date) => {
  return db.prepare(
    "SELECT * FROM todos WHERE date(date_time) = date(?) ORDER BY parent_id ASC NULLS FIRST, date_time ASC, created_at DESC"
  ).all(date);
};

const getTodoById = (id) => {
  return db.prepare('SELECT * FROM todos WHERE id = ?').get(id);
};

const getSubtasks = (parentId) => {
  return db.prepare('SELECT * FROM todos WHERE parent_id = ? ORDER BY created_at ASC').all(parentId);
};

const createTodo = ({ title, category, is_important, is_urgent, date_time, parent_id }) => {
  const stmt = db.prepare(`
    INSERT INTO todos (title, category, is_important, is_urgent, date_time, parent_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(title, category || 'Other', is_important ? 1 : 0, is_urgent ? 1 : 0, date_time || null, parent_id || null);
  return getTodoById(result.lastInsertRowid);
};

const updateTodo = (id, updates) => {
  const fields = [];
  const values = [];

  if (updates.title !== undefined) { fields.push('title = ?'); values.push(updates.title); }
  if (updates.category !== undefined) { fields.push('category = ?'); values.push(updates.category); }
  if (updates.is_important !== undefined) { fields.push('is_important = ?'); values.push(updates.is_important ? 1 : 0); }
  if (updates.is_urgent !== undefined) { fields.push('is_urgent = ?'); values.push(updates.is_urgent ? 1 : 0); }
  if (updates.date_time !== undefined) { fields.push('date_time = ?'); values.push(updates.date_time); }
  if (updates.completed !== undefined) { fields.push('completed = ?'); values.push(updates.completed ? 1 : 0); }

  if (fields.length === 0) return getTodoById(id);

  values.push(id);
  db.prepare(`UPDATE todos SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return getTodoById(id);
};

const deleteTodo = (id) => {
  // Delete subtasks first, then the parent
  db.prepare('DELETE FROM todos WHERE parent_id = ?').run(id);
  return db.prepare('DELETE FROM todos WHERE id = ?').run(id);
};

const getTodosForMonth = (year, month) => {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endMonth = month === 12 ? 1 : month + 1;
  const endYear = month === 12 ? year + 1 : year;
  const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;
  return db.prepare(
    "SELECT * FROM todos WHERE date(date_time) >= date(?) AND date(date_time) < date(?) ORDER BY parent_id ASC NULLS FIRST, date_time ASC"
  ).all(startDate, endDate);
};

// ─── Categories ────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL DEFAULT '#8b7ec8',
    sort_order INTEGER NOT NULL DEFAULT 0
  )
`);

// Seed defaults if empty
const catCount = db.prepare('SELECT COUNT(*) as c FROM categories').get().c;
if (catCount === 0) {
  const defaults = [
    ['Work', '#7c9df0', 1],
    ['Personal', '#c49bd4', 2],
    ['Health', '#7ec8a4', 3],
    ['Shopping', '#e8c547', 4],
    ['Study', '#8b7ec8', 5],
    ['Other', '#d4a76a', 6]
  ];
  const ins = db.prepare('INSERT INTO categories (name, color, sort_order) VALUES (?, ?, ?)');
  for (const [name, color, order] of defaults) {
    ins.run(name, color, order);
  }
}

const getAllCategories = () => {
  return db.prepare('SELECT * FROM categories ORDER BY sort_order ASC, id ASC').all();
};

const createCategory = ({ name, color }) => {
  const maxOrder = db.prepare('SELECT MAX(sort_order) as m FROM categories').get().m || 0;
  const stmt = db.prepare('INSERT INTO categories (name, color, sort_order) VALUES (?, ?, ?)');
  const result = stmt.run(name, color || '#8b7ec8', maxOrder + 1);
  return db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid);
};

const updateCategory = (id, updates) => {
  const fields = [];
  const values = [];
  if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
  if (updates.color !== undefined) { fields.push('color = ?'); values.push(updates.color); }
  if (updates.sort_order !== undefined) { fields.push('sort_order = ?'); values.push(updates.sort_order); }
  if (fields.length === 0) return db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
  values.push(id);
  db.prepare(`UPDATE categories SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
};

const deleteCategory = (id) => {
  return db.prepare('DELETE FROM categories WHERE id = ?').run(id);
};

module.exports = {
  getAllTodos, getTodosByDate, getTodoById, getSubtasks,
  createTodo, updateTodo, deleteTodo, getTodosForMonth,
  getAllCategories, createCategory, updateCategory, deleteCategory
};
