const STORAGE_KEY = "daymark-tasks";
const taskForm = document.querySelector("#task-form");
const titleInput = document.querySelector("#task-title");
const priorityInput = document.querySelector("#task-priority");
const dateInput = document.querySelector("#task-date");
const taskList = document.querySelector("#task-list");
const emptyState = document.querySelector("#empty-state");
const searchInput = document.querySelector("#search-input");
const sortSelect = document.querySelector("#sort-select");

let tasks = loadTasks();
let currentFilter = "all";
let editingTaskId = null;

function loadTasks() {
  try {
    const savedTasks = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(savedTasks) ? savedTasks : [];
  } catch {
    return [];
  }
}

function saveTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function makeId() {
  return window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function openForm(task = null) {
  editingTaskId = task ? task.id : null;
  taskForm.classList.remove("hidden");
  document.querySelector("#form-heading").textContent = task ? "Edit task" : "Add a task";
  document.querySelector("#save-task-button").textContent = task ? "Save changes" : "Save task";
  titleInput.value = task ? task.title : "";
  priorityInput.value = task ? task.priority : "normal";
  dateInput.value = task ? task.dueDate : "";
  titleInput.focus();
}

function closeForm() {
  taskForm.classList.add("hidden");
  taskForm.reset();
  editingTaskId = null;
}

function formatDate(dateString) {
  if (!dateString) return "";
  const date = new Date(`${dateString}T12:00:00`);
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

function isOverdue(task) {
  if (!task.dueDate || task.completed) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(`${task.dueDate}T00:00:00`) < today;
}

function getVisibleTasks() {
  const searchTerm = searchInput.value.trim().toLowerCase();
  let visibleTasks = tasks.filter((task) => {
    const matchesFilter =
      currentFilter === "all" ||
      (currentFilter === "active" && !task.completed) ||
      (currentFilter === "completed" && task.completed);
    return matchesFilter && task.title.toLowerCase().includes(searchTerm);
  });

  const sortMode = sortSelect.value;
  visibleTasks.sort((a, b) => {
    if (sortMode === "due") {
      return (a.dueDate || "9999-12-31").localeCompare(b.dueDate || "9999-12-31");
    }
    if (sortMode === "priority") {
      const rank = { high: 0, normal: 1, low: 2 };
      return rank[a.priority] - rank[b.priority];
    }
    return b.createdAt - a.createdAt;
  });

  return visibleTasks;
}

function renderTasks() {
  const visibleTasks = getVisibleTasks();
  taskList.innerHTML = "";

  visibleTasks.forEach((task) => {
    const item = document.createElement("article");
    item.className = `task-item${task.completed ? " is-complete" : ""}`;

    const checkbox = document.createElement("button");
    checkbox.className = "check-task";
    checkbox.type = "button";
    checkbox.setAttribute("aria-label", task.completed ? "Mark task incomplete" : "Mark task complete");
    checkbox.textContent = task.completed ? "✓" : "";
    checkbox.addEventListener("click", () => toggleTask(task.id));

    const copy = document.createElement("div");
    copy.className = "task-copy";

    const name = document.createElement("p");
    name.className = "task-name";
    name.textContent = task.title;

    const meta = document.createElement("div");
    meta.className = "task-meta";

    const priority = document.createElement("span");
    priority.className = `priority ${task.priority}`;
    priority.textContent = task.priority;
    meta.append(priority);

    if (task.dueDate) {
      const dueDate = document.createElement("span");
      dueDate.className = `due-date${isOverdue(task) ? " overdue" : ""}`;
      dueDate.textContent = `${isOverdue(task) ? "Overdue · " : "Due "}${formatDate(task.dueDate)}`;
      meta.append(dueDate);
    }

    copy.append(name, meta);

    const actions = document.createElement("div");
    actions.className = "task-actions";

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.textContent = "Edit";
    editButton.addEventListener("click", () => openForm(task));

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "delete-button";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", () => deleteTask(task.id));

    actions.append(editButton, deleteButton);
    item.append(checkbox, copy, actions);
    taskList.append(item);
  });

  emptyState.classList.toggle("visible", visibleTasks.length === 0);
  taskList.style.display = visibleTasks.length ? "grid" : "none";

  const completedCount = tasks.filter((task) => task.completed).length;
  const activeCount = tasks.length - completedCount;
  document.querySelector("#all-count").textContent = tasks.length;
  document.querySelector("#active-count").textContent = activeCount;
  document.querySelector("#completed-count").textContent = completedCount;
  document.querySelector("#heading-count").textContent = visibleTasks.length;
  document.querySelector("#footer-count").textContent = `${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}`;

  const progress = tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0;
  document.querySelector("#progress-label").textContent = `${progress}%`;
  document.querySelector("#progress-bar").style.width = `${progress}%`;

  let progressCopy = "You're just getting started.";
  if (tasks.length && progress === 100) progressCopy = "Everything on your list is done. Nice work!";
  else if (progress >= 60) progressCopy = "You're making great progress.";
  else if (progress > 0) progressCopy = "Keep going — you're getting there.";
  document.querySelector("#progress-copy").textContent = progressCopy;

  const titles = { all: "All tasks", active: "In progress", completed: "Completed" };
  document.querySelector("#list-title").childNodes[0].textContent = `${titles[currentFilter]} `;
}

function addOrUpdateTask(event) {
  event.preventDefault();
  const title = titleInput.value.trim();
  if (!title) {
    titleInput.focus();
    return;
  }

  if (editingTaskId) {
    tasks = tasks.map((task) => task.id === editingTaskId
      ? { ...task, title, priority: priorityInput.value, dueDate: dateInput.value }
      : task);
  } else {
    tasks.unshift({
      id: makeId(),
      title,
      priority: priorityInput.value,
      dueDate: dateInput.value,
      completed: false,
      createdAt: Date.now()
    });
  }

  saveTasks();
  closeForm();
  renderTasks();
}

function toggleTask(id) {
  tasks = tasks.map((task) => task.id === id ? { ...task, completed: !task.completed } : task);
  saveTasks();
  renderTasks();
}

function deleteTask(id) {
  tasks = tasks.filter((task) => task.id !== id);
  saveTasks();
  renderTasks();
}

document.querySelectorAll(".filter-button").forEach((button) => {
  button.addEventListener("click", () => {
    currentFilter = button.dataset.filter;
    document.querySelectorAll(".filter-button").forEach((item) => item.classList.toggle("active", item === button));
    renderTasks();
  });
});

document.querySelector("#open-form-button").addEventListener("click", () => openForm());
document.querySelector("#empty-add-button").addEventListener("click", () => openForm());
document.querySelector("#close-form-button").addEventListener("click", closeForm);
document.querySelector("#cancel-form-button").addEventListener("click", closeForm);
taskForm.addEventListener("submit", addOrUpdateTask);
searchInput.addEventListener("input", renderTasks);
sortSelect.addEventListener("change", renderTasks);

document.querySelector("#today-label").textContent = new Intl.DateTimeFormat(undefined, {
  weekday: "short", month: "short", day: "numeric"
}).format(new Date());

renderTasks();
