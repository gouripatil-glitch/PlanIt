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

    let toggleBtn = '';
    if (!isSubtask) {
        toggleBtn = `
        <button class="icon-btn subtask-toggle-btn" id="toggle-${ctx}-${todo.id}" onclick="event.stopPropagation(); toggleSubtasks(${todo.id}, '${ctx}')" style="visibility: hidden">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </button>`;
    }

    return `
    <div class="todo-item ${todo.completed ? 'completed' : ''} ${subtaskClass}" data-id="${todo.id}" data-category="${cat}">
      ${toggleBtn}
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
            await loadSubtasksIntoContainer(parent.id, subtasksByParent[parent.id] || [], 'list');
        }
    }
}

async function loadSubtasksIntoContainer(parentId, inlineSubs, ctx = 'list') {
    const container = document.getElementById(`subtasks-${ctx}-${parentId}`);
    if (!container) return;
    // Fetch only if strict undefined is passed (meaning we don't know the subtasks)
    let subs = inlineSubs;
    if (subs === undefined) {
        subs = await fetchSubtasks(parentId);
    }
    const toggleBtn = document.getElementById(`toggle-${ctx}-${parentId}`);
    if (subs.length > 0) {
        container.innerHTML = subs.map(s => createTodoItemHTML(s, true, ctx)).join('');
        container.style.display = 'none'; // collapsed by default
        if (toggleBtn) {
            toggleBtn.style.visibility = 'visible';
            toggleBtn.classList.remove('expanded');
        }
    } else {
        container.innerHTML = '';
        if (toggleBtn) toggleBtn.style.visibility = 'hidden';
    }
}

function toggleSubtasks(parentId, ctx) {
    const container = document.getElementById(`subtasks-${ctx}-${parentId}`);
    const btn = document.getElementById(`toggle-${ctx}-${parentId}`);
    if (!container || !btn) return;

    if (container.style.display === 'none') {
        container.style.display = 'flex';
        btn.classList.add('expanded');
    } else {
        container.style.display = 'none';
        btn.classList.remove('expanded');
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
            await loadSubtasksIntoContainer(parent.id, subtasksByParent[parent.id] || [], 'cal');
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

async function openSubtaskModal(parentId) {
    editingTodoId = null;
    parentIdForNew = parentId;
    $modalTitle.textContent = 'Add Subtasks';
    $modalSubmit.textContent = 'Add Subtasks';
    $todoForm.reset();

    // Fetch parent and inherit its properties
    const res = await fetch(`${API}/${parentId}`);
    const parent = await res.json();

    $todoCategoryInput.value = parent.category || 'Other';
    $todoImportantInput.checked = !!parent.is_important;
    $todoUrgentInput.checked = !!parent.is_urgent;
    $todoDatetimeInput.value = parent.date_time || '';

    // Show multi-line subtask inputs
    $todoTitleInput.style.display = 'none';
    $todoTitleInput.removeAttribute('required');
    let subtaskInputs = document.getElementById('subtask-inputs');
    if (!subtaskInputs) {
        subtaskInputs = document.createElement('div');
        subtaskInputs.id = 'subtask-inputs';
        subtaskInputs.className = 'subtask-inputs';
        $todoTitleInput.parentNode.appendChild(subtaskInputs);
    }
    subtaskInputs.innerHTML = '';
    function subtaskKeyHandler(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            const input = e.target;
            const next = input.nextElementSibling;
            if (next) {
                next.focus();
            } else {
                const extra = document.createElement('input');
                extra.type = 'text';
                extra.className = 'subtask-line';
                extra.placeholder = `Subtask ${subtaskInputs.children.length + 1}`;
                extra.autocomplete = 'off';
                extra.addEventListener('keydown', subtaskKeyHandler);
                subtaskInputs.appendChild(extra);
                extra.focus();
            }
        }
    }
    for (let i = 0; i < 4; i++) {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'subtask-line';
        input.placeholder = `Subtask ${i + 1}`;
        input.autocomplete = 'off';
        input.addEventListener('keydown', subtaskKeyHandler);
        subtaskInputs.appendChild(input);
    }
    subtaskInputs.style.display = 'flex';

    $modalOverlay.classList.add('open');
    setTimeout(() => subtaskInputs.firstChild.focus(), 100);
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
    // Restore single title input
    $todoTitleInput.style.display = '';
    $todoTitleInput.setAttribute('required', '');
    const subtaskInputs = document.getElementById('subtask-inputs');
    if (subtaskInputs) subtaskInputs.style.display = 'none';
}

async function handleFormSubmit(e) {
    e.preventDefault();

    if (editingTodoId) {
        // Editing existing task
        const data = {
            title: $todoTitleInput.value.trim(),
            category: $todoCategoryInput.value,
            is_important: $todoImportantInput.checked,
            is_urgent: $todoUrgentInput.checked,
            date_time: $todoDatetimeInput.value || null
        };
        if (!data.title) return;
        await apiUpdateTodo(editingTodoId, data);
    } else if (parentIdForNew) {
        // Creating subtasks — batch from multi-line inputs
        const subtaskInputs = document.getElementById('subtask-inputs');
        const lines = subtaskInputs ? subtaskInputs.querySelectorAll('.subtask-line') : [];
        const titles = Array.from(lines).map(l => l.value.trim()).filter(t => t);
        if (titles.length === 0) return;

        for (const title of titles) {
            await apiCreateTodo({
                title,
                category: $todoCategoryInput.value,
                is_important: $todoImportantInput.checked,
                is_urgent: $todoUrgentInput.checked,
                date_time: $todoDatetimeInput.value || null,
                parent_id: parentIdForNew
            });
        }
    } else {
        // Creating new top-level task
        const data = {
            title: $todoTitleInput.value.trim(),
            category: $todoCategoryInput.value,
            is_important: $todoImportantInput.checked,
            is_urgent: $todoUrgentInput.checked,
            date_time: $todoDatetimeInput.value || null
        };
        if (!data.title) return;
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

// Escape key closes modals
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeModal();
        closeSettings();
    }
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

// ─── Settings / Category Management ─────────────────────
const $settingsOverlay = document.getElementById('settings-overlay');
const $settingsCatList = document.getElementById('settings-cat-list');

let categories = []; // loaded from API

async function fetchCategories() {
    const res = await fetch('/api/categories?t=' + Date.now(), { cache: 'no-store' });
    categories = await res.json();
    return categories;
}

function renderSidebarCategories() {
    const $filter = document.getElementById('category-filter');
    let html = '<button class="category-chip active" data-category="all">All</button>';
    categories.forEach(cat => {
        html += `<button class="category-chip" data-category="${escapeHtml(cat.name)}">
            <span class="cat-dot" style="background:${cat.color}"></span>${escapeHtml(cat.name)}
        </button>`;
    });
    $filter.innerHTML = html;
    // Re-apply active state
    $filter.querySelectorAll('.category-chip').forEach(c => {
        c.classList.toggle('active', c.dataset.category === activeCategory);
    });
}

function renderFormCategoryDropdown() {
    let html = '';
    categories.forEach(cat => {
        html += `<option value="${escapeHtml(cat.name)}">${escapeHtml(cat.name)}</option>`;
    });
    $todoCategoryInput.innerHTML = html;
}

function updateCategoryCSSVars() {
    let style = document.getElementById('dynamic-cat-colors');
    if (!style) {
        style = document.createElement('style');
        style.id = 'dynamic-cat-colors';
        document.head.appendChild(style);
    }
    let css = '';
    categories.forEach(cat => {
        const name = cat.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        css += `:root { --cat-${name}: ${cat.color}; }\n`;
        css += `.cat-${cat.name} { background: ${cat.color}20; color: ${cat.color}; }\n`;
        css += `.todo-item[data-category="${cat.name}"]::before { background: ${cat.color}; }\n`;
    });
    style.textContent = css;
}

function openSettings() {
    renderSettingsCatList();
    $settingsOverlay.classList.add('open');
}

function closeSettings() {
    $settingsOverlay.classList.remove('open');
}

function renderSettingsCatList() {
    let html = '';
    categories.forEach(cat => {
        html += `<div class="settings-cat-row" data-id="${cat.id}">
            <input type="color" value="${cat.color}" class="settings-cat-color"
                onchange="updateCatColor(${cat.id}, this.value)" title="Change color">
            <input type="text" value="${escapeHtml(cat.name)}" class="settings-cat-name"
                onchange="renameCat(${cat.id}, this.value)">
            <button class="icon-btn delete-btn" onclick="removeCat(${cat.id})" title="Delete">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
            </button>
        </div>`;
    });
    $settingsCatList.innerHTML = html;
}

async function addNewCategory() {
    const nameInput = document.getElementById('new-cat-name');
    const colorInput = document.getElementById('new-cat-color');
    const name = nameInput.value.trim();
    if (!name) return;

    const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, color: colorInput.value })
    });
    if (res.ok) {
        nameInput.value = '';
        await refreshCategories();
        renderSettingsCatList();
    } else {
        const err = await res.json();
        alert(err.error || 'Error adding category');
    }
}

async function renameCat(id, newName) {
    newName = newName.trim();
    if (!newName) return;
    await fetch(`/api/categories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName })
    });
    await refreshCategories();
}

async function updateCatColor(id, color) {
    await fetch(`/api/categories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ color })
    });
    await refreshCategories();
}

async function removeCat(id) {
    if (!confirm('Delete this category? Tasks using it will keep their label.')) return;
    await fetch(`/api/categories/${id}`, { method: 'DELETE' });
    await refreshCategories();
    renderSettingsCatList();
}

async function refreshCategories() {
    await fetchCategories();
    renderSidebarCategories();
    renderFormCategoryDropdown();
    updateCategoryCSSVars();
}

// Settings event listeners
document.getElementById('settings-btn').addEventListener('click', openSettings);
document.getElementById('settings-close').addEventListener('click', closeSettings);
$settingsOverlay.addEventListener('click', (e) => {
    if (e.target === $settingsOverlay) closeSettings();
});
document.getElementById('add-cat-btn').addEventListener('click', addNewCategory);
document.getElementById('new-cat-name').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addNewCategory(); }
});

// ─── Initialize ─────────────────────────────────────────
(async () => {
    await refreshCategories();
    switchView('list');
})();
