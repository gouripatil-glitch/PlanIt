const express = require('express');
const cors = require('cors');
const path = require('path');
const {
    getAllTodos,
    getTodosByDate,
    getTodoById,
    createTodo,
    updateTodo,
    deleteTodo,
    getTodosForMonth
} = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── REST API Routes ────────────────────────────────────────

// GET /api/todos — Get all todos, or filter by date or month
app.get('/api/todos', (req, res) => {
    try {
        const { date, year, month } = req.query;
        let todos;

        if (date) {
            todos = getTodosByDate(date);
        } else if (year && month) {
            todos = getTodosForMonth(parseInt(year), parseInt(month));
        } else {
            todos = getAllTodos();
        }

        res.json(todos);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/todos/:id — Get a single todo
app.get('/api/todos/:id', (req, res) => {
    try {
        const todo = getTodoById(req.params.id);
        if (!todo) return res.status(404).json({ error: 'Todo not found' });
        res.json(todo);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/todos — Create a new todo
app.post('/api/todos', (req, res) => {
    try {
        const { title, category, is_important, is_urgent, date_time } = req.body;
        if (!title || !title.trim()) {
            return res.status(400).json({ error: 'Title is required' });
        }
        const todo = createTodo({ title: title.trim(), category, is_important, is_urgent, date_time });
        res.status(201).json(todo);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/todos/:id — Update a todo
app.put('/api/todos/:id', (req, res) => {
    try {
        const existing = getTodoById(req.params.id);
        if (!existing) return res.status(404).json({ error: 'Todo not found' });
        const todo = updateTodo(req.params.id, req.body);
        res.json(todo);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/todos/:id — Delete a todo
app.delete('/api/todos/:id', (req, res) => {
    try {
        const existing = getTodoById(req.params.id);
        if (!existing) return res.status(404).json({ error: 'Todo not found' });
        deleteTodo(req.params.id);
        res.json({ message: 'Todo deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Catch-all: serve index.html for SPA
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`✅ Todo List server running at http://localhost:${PORT}`);
});
