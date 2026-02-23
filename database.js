const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'todos.db');
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
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

// Helper functions
const getAllTodos = () => {
  return db.prepare('SELECT * FROM todos ORDER BY date_time ASC, created_at DESC').all();
};

const getTodosByDate = (date) => {
  return db.prepare(
    "SELECT * FROM todos WHERE date(date_time) = date(?) ORDER BY date_time ASC, created_at DESC"
  ).all(date);
};

const getTodoById = (id) => {
  return db.prepare('SELECT * FROM todos WHERE id = ?').get(id);
};

const createTodo = ({ title, category, is_important, is_urgent, date_time }) => {
  const stmt = db.prepare(`
    INSERT INTO todos (title, category, is_important, is_urgent, date_time)
    VALUES (?, ?, ?, ?, ?)
  `);
  const result = stmt.run(title, category || 'Other', is_important ? 1 : 0, is_urgent ? 1 : 0, date_time || null);
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
  return db.prepare('DELETE FROM todos WHERE id = ?').run(id);
};

const getTodosForMonth = (year, month) => {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endMonth = month === 12 ? 1 : month + 1;
  const endYear = month === 12 ? year + 1 : year;
  const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;
  return db.prepare(
    "SELECT * FROM todos WHERE date(date_time) >= date(?) AND date(date_time) < date(?) ORDER BY date_time ASC"
  ).all(startDate, endDate);
};

module.exports = { getAllTodos, getTodosByDate, getTodoById, createTodo, updateTodo, deleteTodo, getTodosForMonth };
