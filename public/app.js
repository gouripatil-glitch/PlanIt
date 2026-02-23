// ─── State ──────────────────────────────────────────────
const API = '/api/todos';
let currentView = 'list';
let currentDate = new Date();
let calendarYear, calendarMonth;
let editingTodoId = null;
let activeCategory = 'all';
let parentIdForNew = null;
let filterImportant = false;
let filterUrgent = false;

// Initialize calendar to current month
const today = new Date();
calendarYear = today.getFullYear();
calendarMonth = today.getMonth() + 1;

// Format helpers
const pad = (n) => String(n).padStart(2, '0');
const toDateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const formatDisplayDate = (d) => {
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
};

const formatTime = (dateTimeStr) => {
    if (!dateTimeStr) return '';
    const d = new Date(dateTimeStr);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
};

// ─── DOM Elements ───────────────────────────────────────
const $listView = document.getElementById('list-view');
const $calendarView = document.getElementById('calendar-view');
const $todoList = document.getElementById('todo-list');
const $emptyState = document.getElementById('empty-state');
const $calendarGrid = document.getElementById('calendar-grid');
const $calendarDayPanel = document.getElementById('calendar-day-panel');
const $dayPanelTitle = document.getElementById('day-panel-title');
const $dayPanelList = document.getElementById('day-panel-list');
const $topbarTitle = document.querySelector('#topbar-title h2');
const $topbarDate = document.getElementById('topbar-date');
const $modalOverlay = document.getElementById('modal-overlay');
const $modalTitle = document.getElementById('modal-title');
const $modalSubmit = document.getElementById('modal-submit');
const $todoForm = document.getElementById('todo-form');
const $todoTitleInput = document.getElementById('todo-title');
const $todoCategoryInput = document.getElementById('todo-category');
const $todoDatetimeInput = document.getElementById('todo-datetime');
const $todoImportantInput = document.getElementById('todo-important');
const $todoUrgentInput = document.getElementById('todo-urgent');

// ─── API Calls ──────────────────────────────────────────
async function fetchTodosByDate(date) {
    const res = await fetch(`${API}?date=${date}`);
    return res.json();
}

async function fetchTodosForMonth(year, month) {
    const res = await fetch(`${API}?year=${year}&month=${month}`);
    return res.json();
}

async function fetchAllTodos() {
    const res = await fetch(API);
    return res.json();
}

async function apiCreateTodo(data) {
    const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    return res.json();
}

async function apiUpdateTodo(id, data) {
    const res = await fetch(`${API}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    return res.json();
}

async function apiDeleteTodo(id) {
    await fetch(`${API}/${id}`, { method: 'DELETE' });
}

async function fetchSubtasks(parentId) {
    const res = await fetch(`${API}/${parentId}/subtasks`);
    return res.json();
}

// ─── Rendering: Todo Item ───────────────────────────────
function createTodoItemHTML(todo, isSubtask = false, ctx = 'list') {
    const cat = todo.category || 'Other';
    const timeStr = formatTime(todo.date_time);

    let badges = '';
    if (todo.is_important) badges += '<span class="badge badge-important">★ Important</span>';
    if (todo.is_urgent) badges += '<span class="badge badge-urgent">⚡ Urgent</span>';

    const subtaskClass = isSubtask ? 'subtask-item' : '';

    return `
    <div class="todo-item ${todo.completed ? 'completed' : ''} ${subtaskClass}" data-id="${todo.id}" data-category="${cat}">
      <label class="todo-checkbox">
        <input type="checkbox" ${todo.completed ? 'checked' : ''} onchange="toggleTodo(${todo.id}, this.checked)">
        <span class="checkmark"></span>
      </label>
      <div class="todo-content" onclick="openEditModal(${todo.id})" style="cursor:pointer">
        <div class="todo-text">${escapeHtml(todo.title)}</div>
        <div class="todo-meta">
          <span class="todo-category-badge cat-${cat}">${cat}</span>
          ${badges}
          ${timeStr ? `<span class="todo-time">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            ${timeStr}</span>` : ''}
        </div>
      </div>
      <div class="todo-actions">
        ${!isSubtask ? `<button class="icon-btn" onclick="event.stopPropagation(); openSubtaskModal(${todo.id})" title="Add Subtask">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>` : ''}
        <button class="icon-btn" onclick="openEditModal(${todo.id})" title="Edit">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="icon-btn delete-btn" onclick="deleteTodoItem(${todo.id})" title="Delete">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>
    </div>
    ${!isSubtask ? `<div class="subtasks-container" id="subtasks-${ctx}-${todo.id}"></div>` : ''}
  `;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ─── List View ──────────────────────────────────────────
async function renderListView() {
    const dateStr = toDateStr(currentDate);
    let todos = await fetchTodosByDate(dateStr);

    // Filter by category
    if (activeCategory !== 'all') {
        todos = todos.filter(t => t.category === activeCategory);
    }
    if (filterImportant) {
        todos = todos.filter(t => t.is_important);
    }
    if (filterUrgent) {
        todos = todos.filter(t => t.is_urgent);
    }

    // Separate parents and subtasks
    const parents = todos.filter(t => !t.parent_id);
    const subtasksByParent = {};
    todos.filter(t => t.parent_id).forEach(t => {
        if (!subtasksByParent[t.parent_id]) subtasksByParent[t.parent_id] = [];
        subtasksByParent[t.parent_id].push(t);
    });

    // Update title
    const todayStr = toDateStr(today);
    if (dateStr === todayStr) {
        $topbarTitle.textContent = "Today's Tasks";
    } else {
        $topbarTitle.textContent = 'Tasks';
    }
    $topbarDate.textContent = formatDisplayDate(currentDate);

    if (parents.length === 0 && todos.length === 0) {
        $todoList.innerHTML = '';
        $emptyState.style.display = 'flex';
    } else {
        $emptyState.style.display = 'none';
        let html = '';
        for (const parent of parents) {
            html += createTodoItemHTML(parent, false, 'list');
        }
        $todoList.innerHTML = html;

        // Now load subtasks for each parent
        for (const parent of parents) {
            await loadSubtasksIntoContainer(parent.id, subtasksByParent[parent.id], 'list');
        }
    }
}

async function loadSubtasksIntoContainer(parentId, inlineSubs, ctx = 'list') {
    const container = document.getElementById(`subtasks-${ctx}-${parentId}`);
    if (!container) return;
    // Use inline subs if provided, otherwise fetch
    let subs = inlineSubs;
    if (!subs || subs.length === 0) {
        subs = await fetchSubtasks(parentId);
    }
    if (subs.length > 0) {
        container.innerHTML = subs.map(s => createTodoItemHTML(s, true, ctx)).join('');
    } else {
        container.innerHTML = '';
    }
}

// ─── Calendar View ──────────────────────────────────────
async function renderCalendarView() {
    $topbarTitle.textContent = `${MONTHS[calendarMonth - 1]} ${calendarYear}`;
    $topbarDate.textContent = '';

    const todos = await fetchTodosForMonth(calendarYear, calendarMonth);

    // Group todos by date
    const todosByDate = {};
    todos.forEach(t => {
        if (!t.date_time) return;
        const d = t.date_time.split('T')[0];
        if (!todosByDate[d]) todosByDate[d] = [];
        todosByDate[d].push(t);
    });

    // Build calendar
    const firstDay = new Date(calendarYear, calendarMonth - 1, 1);
    const lastDay = new Date(calendarYear, calendarMonth, 0);
    const startDow = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    // Previous month padding
    const prevMonth = new Date(calendarYear, calendarMonth - 1, 0);
    const prevDaysInMonth = prevMonth.getDate();

    let html = '<div class="cal-header">';
    DAYS.forEach(d => { html += `<div class="cal-header-cell">${d}</div>`; });
    html += '</div><div class="cal-body">';

    const todayStr = toDateStr(today);
    let dayCount = 1;
    let nextDayCount = 1;
    const totalCells = Math.ceil((startDow + daysInMonth) / 7) * 7;

    for (let i = 0; i < totalCells; i++) {
        if (i < startDow) {
            const d = prevDaysInMonth - startDow + i + 1;
            html += `<div class="cal-cell other-month"><span class="cal-day-num">${d}</span></div>`;
        } else if (dayCount <= daysInMonth) {
            const dateStr = `${calendarYear}-${pad(calendarMonth)}-${pad(dayCount)}`;
            const isToday = dateStr === todayStr;
            const dayTodos = todosByDate[dateStr] || [];

            let tasksHtml = '';
            if (dayTodos.length > 0) {
                const maxVisible = 3;
                const shown = dayTodos.slice(0, maxVisible);
                tasksHtml = '<div class="cal-tasks">';
                shown.forEach(t => {
                    const cat = t.category || 'Other';
                    const completedClass = t.completed ? 'cal-task-done' : '';
                    tasksHtml += `<div class="cal-task-chip ${completedClass}" style="border-left-color:var(--cat-${cat.toLowerCase()})">${escapeHtml(t.title)}</div>`;
                });
                if (dayTodos.length > maxVisible) {
                    tasksHtml += `<span class="cal-task-count">+${dayTodos.length - maxVisible} more</span>`;
                }
                tasksHtml += '</div>';
            }

            html += `<div class="cal-cell ${isToday ? 'today' : ''}" data-date="${dateStr}" onclick="selectCalendarDay('${dateStr}')">
        <span class="cal-day-num">${dayCount}</span>
        ${tasksHtml}
      </div>`;
            dayCount++;
        } else {
            html += `<div class="cal-cell other-month"><span class="cal-day-num">${nextDayCount}</span></div>`;
            nextDayCount++;
        }
    }

    html += '</div>';
    $calendarGrid.innerHTML = html;

    // Always show day panel — default to today if in current month, else first of month
    const defaultDate = (calendarYear === today.getFullYear() && calendarMonth === today.getMonth() + 1)
        ? todayStr
        : `${calendarYear}-${pad(calendarMonth)}-01`;
    selectCalendarDay(defaultDate);
}

async function selectCalendarDay(dateStr) {
    // Highlight selected cell
    document.querySelectorAll('.cal-cell.selected').forEach(c => c.classList.remove('selected'));
    const cell = document.querySelector(`.cal-cell[data-date="${dateStr}"]`);
    if (cell) cell.classList.add('selected');

    // Show day panel
    let todos = await fetchTodosByDate(dateStr);
    if (activeCategory !== 'all') {
        todos = todos.filter(t => t.category === activeCategory);
    }
    if (filterImportant) {
        todos = todos.filter(t => t.is_important);
    }
    if (filterUrgent) {
        todos = todos.filter(t => t.is_urgent);
    }

    const d = new Date(dateStr + 'T12:00:00');
    $dayPanelTitle.textContent = d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

    // Separate parents and subtasks
    const parents = todos.filter(t => !t.parent_id);
    const subtasksByParent = {};
    todos.filter(t => t.parent_id).forEach(t => {
        if (!subtasksByParent[t.parent_id]) subtasksByParent[t.parent_id] = [];
        subtasksByParent[t.parent_id].push(t);
    });

    if (parents.length === 0 && todos.length === 0) {
        $dayPanelList.innerHTML = '<div class="empty-state" style="padding:20px"><div class="empty-icon">📋</div><p>No tasks this day</p></div>';
    } else {
        let html = '';
        for (const parent of parents) {
            html += createTodoItemHTML(parent, false, 'cal');
        }
        $dayPanelList.innerHTML = html;

        // Load subtasks into containers
        for (const parent of parents) {
            await loadSubtasksIntoContainer(parent.id, subtasksByParent[parent.id], 'cal');
        }
    }
    $calendarDayPanel.style.display = 'block';
}

// ─── View Switching ─────────────────────────────────────
function switchView(view) {
    currentView = view;
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));

    if (view === 'list') {
        $listView.classList.add('active');
        $calendarView.classList.remove('active');
        renderListView();
    } else {
        $calendarView.classList.add('active');
        $listView.classList.remove('active');
        renderCalendarView();
    }
}

// ─── Date Navigation ────────────────────────────────────
function navigateDate(delta) {
    if (currentView === 'list') {
        currentDate.setDate(currentDate.getDate() + delta);
        renderListView();
    } else {
        calendarMonth += delta;
        if (calendarMonth > 12) { calendarMonth = 1; calendarYear++; }
        if (calendarMonth < 1) { calendarMonth = 12; calendarYear--; }
        renderCalendarView();
    }
}

function goToToday() {
    currentDate = new Date();
    calendarYear = today.getFullYear();
    calendarMonth = today.getMonth() + 1;
    if (currentView === 'list') renderListView();
    else renderCalendarView();
}

// ─── CRUD Actions ───────────────────────────────────────
async function toggleTodo(id, completed) {
    await apiUpdateTodo(id, { completed });
    refreshCurrentView();
}

async function deleteTodoItem(id) {
    await apiDeleteTodo(id);
    refreshCurrentView();
}

function refreshCurrentView() {
    if (currentView === 'list') renderListView();
    else renderCalendarView();
}

// ─── Modal ──────────────────────────────────────────────
function openAddModal() {
    editingTodoId = null;
    parentIdForNew = null;
    $modalTitle.textContent = 'Add New Task';
    $modalSubmit.textContent = 'Add Task';
    $todoForm.reset();

    // Default datetime to current date/time
    const now = new Date();
    if (currentView === 'list') {
        // Set to the currently viewed date
        const dateStr = toDateStr(currentDate);
        $todoDatetimeInput.value = `${dateStr}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
    } else {
        $todoDatetimeInput.value = '';
    }

    $modalOverlay.classList.add('open');
    setTimeout(() => $todoTitleInput.focus(), 100);
}

function openSubtaskModal(parentId) {
    editingTodoId = null;
    parentIdForNew = parentId;
    $modalTitle.textContent = 'Add Subtask';
    $modalSubmit.textContent = 'Add Subtask';
    $todoForm.reset();

    const now = new Date();
    if (currentView === 'list') {
        const dateStr = toDateStr(currentDate);
        $todoDatetimeInput.value = `${dateStr}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
    } else {
        $todoDatetimeInput.value = '';
    }

    $modalOverlay.classList.add('open');
    setTimeout(() => $todoTitleInput.focus(), 100);
}

async function openEditModal(id) {
    const res = await fetch(`${API}/${id}`);
    const todo = await res.json();

    editingTodoId = id;
    $modalTitle.textContent = 'Edit Task';
    $modalSubmit.textContent = 'Save Changes';
    $todoTitleInput.value = todo.title;
    $todoCategoryInput.value = todo.category || 'Other';
    $todoDatetimeInput.value = todo.date_time || '';
    $todoImportantInput.checked = !!todo.is_important;
    $todoUrgentInput.checked = !!todo.is_urgent;

    $modalOverlay.classList.add('open');
    setTimeout(() => $todoTitleInput.focus(), 100);
}

function closeModal() {
    $modalOverlay.classList.remove('open');
    editingTodoId = null;
    parentIdForNew = null;
}

async function handleFormSubmit(e) {
    e.preventDefault();

    const data = {
        title: $todoTitleInput.value.trim(),
        category: $todoCategoryInput.value,
        is_important: $todoImportantInput.checked,
        is_urgent: $todoUrgentInput.checked,
        date_time: $todoDatetimeInput.value || null
    };

    if (!data.title) return;

    if (editingTodoId) {
        await apiUpdateTodo(editingTodoId, data);
    } else {
        if (parentIdForNew) {
            data.parent_id = parentIdForNew;
        }
        await apiCreateTodo(data);
    }

    closeModal();
    refreshCurrentView();
}

// ─── Category Filter ────────────────────────────────────
function setActiveCategory(cat) {
    activeCategory = cat;
    document.querySelectorAll('.category-chip').forEach(c => {
        c.classList.toggle('active', c.dataset.category === cat);
    });
    refreshCurrentView();
}

// ─── Priority Filter ──────────────────────────────────
function togglePriorityFilter(type) {
    if (type === 'important') {
        filterImportant = !filterImportant;
        document.getElementById('filter-important').classList.toggle('active', filterImportant);
    } else if (type === 'urgent') {
        filterUrgent = !filterUrgent;
        document.getElementById('filter-urgent').classList.toggle('active', filterUrgent);
    }
    refreshCurrentView();
}

// ─── Event Listeners ────────────────────────────────────
document.getElementById('nav-list').addEventListener('click', () => switchView('list'));
document.getElementById('nav-calendar').addEventListener('click', () => switchView('calendar'));
document.getElementById('add-todo-btn').addEventListener('click', openAddModal);
document.getElementById('prev-date').addEventListener('click', () => navigateDate(-1));
document.getElementById('next-date').addEventListener('click', () => navigateDate(1));
document.getElementById('today-btn').addEventListener('click', goToToday);
document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-cancel').addEventListener('click', closeModal);
$todoForm.addEventListener('submit', handleFormSubmit);
document.getElementById('close-day-panel').addEventListener('click', () => {
    $calendarDayPanel.style.display = 'none';
    document.querySelectorAll('.cal-cell.selected').forEach(c => c.classList.remove('selected'));
});

// Close modal on overlay click
$modalOverlay.addEventListener('click', (e) => {
    if (e.target === $modalOverlay) closeModal();
});

// Escape key closes modal
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
});

// Category filter
document.getElementById('category-filter').addEventListener('click', (e) => {
    const chip = e.target.closest('.category-chip');
    if (chip) setActiveCategory(chip.dataset.category);
});

// Sidebar toggle (mobile)
document.getElementById('menu-toggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
});

// ─── Initialize ─────────────────────────────────────────
switchView('list');
