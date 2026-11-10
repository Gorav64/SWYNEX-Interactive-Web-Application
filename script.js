(() => {
  "use strict";

  const STORAGE_KEY = "taskflow_tasks_v1";
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];

  const elements = {
    taskList: $("#taskList"),
    modal: $("#taskModal"),
    form: $("#taskForm"),
    title: $("#taskTitle"),
    description: $("#taskDescription"),
    priority: $("#taskPriority"),
    dueDate: $("#taskDue"),
    titleError: $("#titleError"),
    modalTitle: $("#modalTitle"),
    saveTaskBtn: $("#saveTaskBtn"),
    toast: $("#toast"),
    search: $("#searchInput"),
    priorityFilter: $("#priorityFilter"),
    sort: $("#sortSelect")
  };

  let tasks = loadTasks();
  let currentView = "all";
  let quickFilter = "all";
  let editingId = null;
  let layout = "list";
  let toastTimer = null;

  function loadTasks() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(saved) ? saved.filter(task => task && task.id && typeof task.title === "string") : [];
    } catch {
      return [];
    }
  }

  function saveTasks() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch {
      showToast("Could not save data in this browser.");
    }
  }

  function makeId() {
    return `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  }

  function dateOnly(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function prettyDate(value) {
    if (!value) return "";
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  }

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    }[char]));
  }

  function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => elements.toast.classList.remove("show"), 2300);
  }

  function openModal(task = null) {
    editingId = task ? task.id : null;
    elements.form.reset();
    elements.titleError.textContent = "";
    elements.modalTitle.textContent = task ? "Edit task" : "Create a new task";
    elements.saveTaskBtn.textContent = task ? "Save changes" : "Create task";
    if (task) {
      elements.title.value = task.title;
      elements.description.value = task.description || "";
      elements.priority.value = task.priority || "medium";
      elements.dueDate.value = task.dueDate || "";
    }
    elements.modal.classList.add("open");
    elements.modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    setTimeout(() => elements.title.focus(), 60);
  }

  function closeModal() {
    elements.modal.classList.remove("open");
    elements.modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    editingId = null;
  }

  function getVisibleTasks() {
    const query = elements.search.value.trim().toLowerCase();
    const priority = elements.priorityFilter.value;
    let result = [...tasks];

    if (currentView === "today") result = result.filter(task => task.dueDate === dateOnly() && !task.completed);
    if (currentView === "upcoming") result = result.filter(task => task.dueDate && task.dueDate > dateOnly() && !task.completed);
    if (currentView === "completed") result = result.filter(task => task.completed);

    if (quickFilter === "active") result = result.filter(task => !task.completed);
    if (quickFilter === "completed") result = result.filter(task => task.completed);
    if (priority !== "all") result = result.filter(task => task.priority === priority);
    if (query) result = result.filter(task =>
      task.title.toLowerCase().includes(query) ||
      (task.description || "").toLowerCase().includes(query)
    );

    const priorityOrder = { high: 0, medium: 1, low: 2 };
    switch (elements.sort.value) {
      case "oldest": result.sort((a, b) => a.createdAt - b.createdAt); break;
      case "due": result.sort((a, b) => (a.dueDate || "9999-12-31").localeCompare(b.dueDate || "9999-12-31")); break;
      case "priority": result.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]); break;
      default: result.sort((a, b) => b.createdAt - a.createdAt);
    }
    return result;
  }

  function renderStats() {
    const total = tasks.length;
    const completed = tasks.filter(task => task.completed).length;
    const active = total - completed;
    const today = tasks.filter(task => task.dueDate === dateOnly() && !task.completed).length;
    const rate = total ? Math.round((completed / total) * 100) : 0;

    $("#totalStat").textContent = total;
    $("#progressStat").textContent = active;
    $("#completedStat").textContent = completed;
    $("#rateStat").textContent = `${rate}%`;
    $("#rateBar").style.width = `${rate}%`;
    $("#allCount").textContent = total;
    $("#todayCount").textContent = today;
    $("#completedCount").textContent = completed;
    $("#chipAll").textContent = total;
    $("#chipActive").textContent = active;
    $("#chipCompleted").textContent = completed;
  }

  function taskMarkup(task) {
    const due = task.dueDate ? prettyDate(task.dueDate) : "";
    const overdue = task.dueDate && task.dueDate < dateOnly() && !task.completed;
    const description = task.description ? `<p class="task-description">${escapeHTML(task.description)}</p>` : "";
    const dueMarkup = due ? `<span class="due-label ${overdue ? "overdue" : ""}">◷ ${overdue ? "Overdue · " : "Due · "}${escapeHTML(due)}</span>` : "";
    return `
      <article class="task-card ${task.completed ? "is-complete" : ""}" data-id="${escapeHTML(task.id)}">
        <button class="task-check ${task.completed ? "checked" : ""}" data-action="toggle" aria-label="${task.completed ? "Mark as active" : "Mark as completed"}">${task.completed ? "✓" : ""}</button>
        <div class="task-main">
          <h3 class="task-title">${escapeHTML(task.title)}</h3>
          ${description}
          <div class="task-meta">
            <span class="priority-pill priority-${escapeHTML(task.priority)}">${escapeHTML(task.priority)} priority</span>
            ${dueMarkup}
          </div>
        </div>
        <div class="task-actions">
          <button class="task-action" data-action="edit" aria-label="Edit task" title="Edit">✎</button>
          <button class="task-action" data-action="delete" aria-label="Delete task" title="Delete">⌫</button>
        </div>
      </article>`;
  }

  function renderTasks() {
    const visible = getVisibleTasks();
    elements.taskList.classList.toggle("grid-mode", layout === "grid");
    if (!visible.length) {
      const hasAny = tasks.length > 0;
      const title = hasAny ? "No matching tasks" : "Your space is ready";
      const message = hasAny ? "Try changing your search or filters." : "Add your first task and start building momentum.";
      elements.taskList.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">${hasAny ? "⌕" : "✦"}</div>
          <h3>${title}</h3><p>${message}</p>
          ${hasAny ? "" : '<button class="primary-btn" data-action="empty-add">＋ Add your first task</button>'}
        </div>`;
      return;
    }
    elements.taskList.innerHTML = visible.map(taskMarkup).join("");
  }

  function renderViewLabels() {
    const labels = {
      all: ["All tasks", "Your tasks", "Keep your priorities clear and your momentum going."],
      today: ["Today", "Today's tasks", "Focus on what needs your attention today."],
      upcoming: ["Upcoming", "Coming up", "A quick look at what's ahead."],
      completed: ["Completed", "Completed tasks", "Look at everything you've already accomplished."]
    };
    const [breadcrumb, heading, description] = labels[currentView];
    $("#breadcrumbView").textContent = breadcrumb;
    $("#listHeading").textContent = heading;
    $("#listDescription").textContent = description;
    $("#pageTitle").innerHTML = currentView === "today"
      ? 'Today is yours. <span>Make it count.</span>'
      : currentView === "completed"
      ? 'Look at you. <span>Progress made.</span>'
      : currentView === "upcoming"
      ? 'Plan ahead. <span>Stay in control.</span>'
      : 'Good day. <span>Let\'s get things done.</span>';
    $$(".nav-item").forEach(button => button.classList.toggle("active", button.dataset.view === currentView));
  }

  function render() {
    renderStats();
    renderViewLabels();
    renderTasks();
  }

  function addOrUpdateTask(event) {
    event.preventDefault();
    const title = elements.title.value.trim();
    if (!title) {
      elements.titleError.textContent = "Please enter a task title.";
      elements.title.focus();
      return;
    }
    elements.titleError.textContent = "";
    const payload = {
      title,
      description: elements.description.value.trim(),
      priority: elements.priority.value,
      dueDate: elements.dueDate.value
    };

    if (editingId) {
      tasks = tasks.map(task => task.id === editingId ? { ...task, ...payload, updatedAt: Date.now() } : task);
      showToast("Task updated successfully.");
    } else {
      tasks.unshift({ id: makeId(), ...payload, completed: false, createdAt: Date.now() });
      showToast("New task added.");
    }
    saveTasks();
    closeModal();
    render();
  }

  function handleTaskAction(event) {
    const actionButton = event.target.closest("[data-action]");
    if (!actionButton) return;
    const action = actionButton.dataset.action;
    if (action === "empty-add") {
      openModal();
      return;
    }
    const card = actionButton.closest(".task-card");
    if (!card) return;
    const task = tasks.find(item => item.id === card.dataset.id);
    if (!task) return;

    if (action === "toggle") {
      task.completed = !task.completed;
      task.completedAt = task.completed ? Date.now() : null;
      showToast(task.completed ? "Task marked as complete." : "Task moved back to active.");
    } else if (action === "edit") {
      openModal(task);
      return;
    } else if (action === "delete") {
      if (!window.confirm(`Delete "${task.title}"? This action cannot be undone.`)) return;
      tasks = tasks.filter(item => item.id !== task.id);
      showToast("Task deleted.");
    }
    saveTasks();
    render();
  }

  $("#openAddBtn").addEventListener("click", () => openModal());
  $("#closeModalBtn").addEventListener("click", closeModal);
  $("#cancelModalBtn").addEventListener("click", closeModal);
  elements.modal.addEventListener("click", event => {
    if (event.target === elements.modal) closeModal();
  });
  elements.form.addEventListener("submit", addOrUpdateTask);
  elements.title.addEventListener("input", () => { if (elements.title.value.trim()) elements.titleError.textContent = ""; });
  elements.taskList.addEventListener("click", handleTaskAction);
  elements.search.addEventListener("input", renderTasks);
  elements.priorityFilter.addEventListener("change", renderTasks);
  elements.sort.addEventListener("change", renderTasks);

  $$(".nav-item").forEach(button => button.addEventListener("click", () => {
    currentView = button.dataset.view;
    quickFilter = "all";
    $$(".filter-chip").forEach(chip => chip.classList.toggle("selected", chip.dataset.filter === "all"));
    render();
    $("#sidebar").classList.remove("open");
  }));

  $$(".filter-chip").forEach(button => button.addEventListener("click", () => {
    quickFilter = button.dataset.filter;
    $$(".filter-chip").forEach(chip => chip.classList.toggle("selected", chip === button));
    renderTasks();
  }));

  $("#listViewBtn").addEventListener("click", () => {
    layout = "list";
    $("#listViewBtn").classList.add("active");
    $("#gridViewBtn").classList.remove("active");
    renderTasks();
  });
  $("#gridViewBtn").addEventListener("click", () => {
    layout = "grid";
    $("#gridViewBtn").classList.add("active");
    $("#listViewBtn").classList.remove("active");
    renderTasks();
  });

  $("#mobileMenu").addEventListener("click", () => $("#sidebar").classList.toggle("open"));
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeModal();
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      elements.search.focus();
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "n") {
      event.preventDefault();
      openModal();
    }
  });

  $("#todayLabel").textContent = new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  render();
})();