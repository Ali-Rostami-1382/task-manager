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

  updateAnalytics();
  renderCalendar();
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

const SETTINGS_KEY = "daymark-settings";
const PROFILE_KEY = "daymark-profile";
const CHECKIN_KEY = "daymark-checkin";
function readObject(key, fallback) { try { return Object.assign({}, fallback, JSON.parse(localStorage.getItem(key) || "{}")); } catch { return Object.assign({}, fallback); } }
function writeObject(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
let settings = readObject(SETTINGS_KEY, {theme:"light",compact:false,motion:true,reminder:false});
let profile = readObject(PROFILE_KEY, {name:"Alex Morgan",role:"Team member",bio:""});
let checkin = readObject(CHECKIN_KEY, {date:"",mood:"",intention:""});
let calendarDate = new Date(), selectedCalendarDate = new Date();
function updateAnalytics() {
 const done=tasks.filter(t=>t.completed).length, active=tasks.length-done, rate=tasks.length?Math.round(done/tasks.length*100):0;
 [["metric-total",tasks.length],["metric-completed",done],["metric-rate",rate+"%"],["metric-active",active],["analytics-completed-count",done],["analytics-active-count",active]].forEach(([id,v])=>{const n=document.getElementById(id);if(n)n.textContent=v;});
 document.querySelector("#analytics-completed-bar").style.width=rate+"%";
 document.querySelector("#analytics-active-bar").style.width=(tasks.length?Math.round(active/tasks.length*100):0)+"%";
}
function dateKey(d){return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");}
function renderCalendar(){
 const grid=document.querySelector("#calendar-grid"); if(!grid)return; grid.innerHTML="";
 document.querySelector("#calendar-month").textContent=new Intl.DateTimeFormat(undefined,{month:"long",year:"numeric"}).format(calendarDate);
 ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].forEach(day=>{const n=document.createElement("div");n.className="calendar-weekday";n.textContent=day;grid.append(n);});
 const first=new Date(calendarDate.getFullYear(),calendarDate.getMonth(),1), offset=(first.getDay()+6)%7, start=new Date(first);start.setDate(first.getDate()-offset);
 for(let i=0;i<42;i++){const d=new Date(start);d.setDate(start.getDate()+i);const key=dateKey(d), dayTasks=tasks.filter(t=>t.dueDate===key), b=document.createElement("button");b.type="button";b.className="calendar-day"+(d.getMonth()!==calendarDate.getMonth()?" muted-day":"")+(key===dateKey(new Date())?" today":"")+(key===dateKey(selectedCalendarDate)?" selected-day":"");b.textContent=d.getDate();b.setAttribute("aria-label",new Intl.DateTimeFormat(undefined,{dateStyle:"full"}).format(d));if(dayTasks.length){const dot=document.createElement("i");dot.className="event-dot";b.append(dot);}b.addEventListener("click",()=>{selectedCalendarDate=d;renderCalendar();});grid.append(b);}
 const key=dateKey(selectedCalendarDate);document.querySelector("#agenda-title").textContent="Tasks for "+new Intl.DateTimeFormat(undefined,{month:"short",day:"numeric"}).format(selectedCalendarDate);
 const agenda=document.querySelector("#calendar-agenda-list");agenda.innerHTML="";const dayTasks=tasks.filter(t=>t.dueDate===key);
 if(!dayTasks.length){const n=document.createElement("p");n.className="agenda-empty";n.textContent="No tasks due on this day. A little breathing room!";agenda.append(n);}
 dayTasks.forEach(t=>{const n=document.createElement("div");n.className="agenda-item";n.textContent=(t.completed?"✓ ":"○ ")+t.title+" · "+t.priority;agenda.append(n);});
}
function renderProfile(){
 const name=profile.name||"Alex Morgan",role=profile.role||"Team member",initial=name.trim().charAt(0).toUpperCase()||"A";
 ["sidebar-name","profile-display-name"].forEach(id=>document.getElementById(id).textContent=name);
 ["sidebar-role","profile-display-role"].forEach(id=>document.getElementById(id).textContent=role);
 ["sidebar-avatar","profile-large"].forEach(id=>document.getElementById(id).textContent=initial);
 document.querySelector(".profile-dot").textContent=initial;
 document.querySelector("#profile-name").value=name;document.querySelector("#profile-role").value=role;document.querySelector("#profile-bio").value=profile.bio||"";
}
function applySettings(){
 document.body.classList.toggle("dark-mode",settings.theme==="dark");document.body.classList.toggle("compact-mode",!!settings.compact);document.body.classList.toggle("reduce-motion",!settings.motion);
 document.querySelector("#theme-toggle").innerHTML=settings.theme==="dark"?"☀ <span>Light mode</span>":"☾ <span>Dark mode</span>";
 document.querySelector("#setting-theme").value=settings.theme;document.querySelector("#setting-compact").checked=!!settings.compact;document.querySelector("#setting-motion").checked=!!settings.motion;document.querySelector("#setting-reminder").checked=!!settings.reminder;
}
function showView(view){
 document.querySelectorAll("[data-section]").forEach(s=>s.classList.toggle("active-view",s.dataset.section===view));
 document.querySelectorAll(".section-link").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
 const names={dashboard:"Tasks",analytics:"Analytics",leaderboard:"Leaderboard",checkin:"Daily check-in",calendar:"Calendar",profile:"My profile",settings:"Settings",contact:"Contact us"};
 document.querySelector(".breadcrumb strong").textContent=names[view]||"Tasks";if(view==="calendar")renderCalendar();
}
document.querySelectorAll("[data-view]").forEach(b=>b.addEventListener("click",()=>showView(b.dataset.view)));
document.querySelector("#theme-toggle").addEventListener("click",()=>{settings.theme=settings.theme==="dark"?"light":"dark";writeObject(SETTINGS_KEY,settings);applySettings();});
document.querySelector("#setting-theme").addEventListener("change",e=>{settings.theme=e.target.value;applySettings();});
document.querySelector("#settings-form").addEventListener("submit",e=>{e.preventDefault();settings={theme:document.querySelector("#setting-theme").value,compact:document.querySelector("#setting-compact").checked,motion:document.querySelector("#setting-motion").checked,reminder:document.querySelector("#setting-reminder").checked};writeObject(SETTINGS_KEY,settings);applySettings();document.querySelector("#settings-feedback").textContent="Settings saved on this device.";});
document.querySelector("#profile-form").addEventListener("submit",e=>{e.preventDefault();profile={name:document.querySelector("#profile-name").value.trim()||"Alex Morgan",role:document.querySelector("#profile-role").value,bio:document.querySelector("#profile-bio").value.trim()};writeObject(PROFILE_KEY,profile);renderProfile();document.querySelector("#profile-feedback").textContent="Profile saved on this device.";});
document.querySelectorAll("[data-mood]").forEach(b=>b.addEventListener("click",()=>{checkin.mood=b.dataset.mood;document.querySelectorAll("[data-mood]").forEach(x=>x.classList.toggle("selected",x===b));}));
document.querySelector("#daily-intention").value=checkin.date===dateKey(new Date())?checkin.intention||"":"";
if(checkin.date===dateKey(new Date())&&checkin.mood)document.querySelector('[data-mood="'+checkin.mood+'"]')?.classList.add("selected");
document.querySelector("#save-checkin").addEventListener("click",()=>{checkin={date:dateKey(new Date()),mood:checkin.mood,intention:document.querySelector("#daily-intention").value.trim()};writeObject(CHECKIN_KEY,checkin);document.querySelector("#checkin-feedback").textContent="Check-in saved on this device. Nice job showing up for yourself!";});
document.querySelector("#calendar-prev").addEventListener("click",()=>{calendarDate=new Date(calendarDate.getFullYear(),calendarDate.getMonth()-1,1);renderCalendar();});
document.querySelector("#calendar-next").addEventListener("click",()=>{calendarDate=new Date(calendarDate.getFullYear(),calendarDate.getMonth()+1,1);renderCalendar();});
document.querySelector("#contact-form").addEventListener("submit",e=>{e.preventDefault();const subject=encodeURIComponent("Daymark: "+document.querySelector("#contact-topic").value),body=encodeURIComponent("From: "+document.querySelector("#contact-name").value+" ("+document.querySelector("#contact-email").value+")\n\n"+document.querySelector("#contact-message").value);document.querySelector("#contact-feedback").textContent="Opening your email app to prepare the message…";window.location.href="mailto:ali.rostami1382.8550@gmail.com?subject="+subject+"&body="+body;});
const demoEmployees=[{name:"Maya Chen",role:"Design",count:42},{name:"Noah Williams",role:"Engineering",count:37},{name:"Sofia Patel",role:"Operations",count:31},{name:"Leo Martin",role:"Marketing",count:26},{name:"Amir Hassan",role:"Research",count:19}];
document.querySelector("#leaderboard-list").innerHTML=demoEmployees.map((p,i)=>'<div class="leader-row"><span class="leader-rank">'+(i+1)+'</span><div class="leader-person"><strong>'+p.name+'</strong><small>'+p.role+'</small></div><span class="leader-score">'+p.count+' tasks</span></div>').join("");
renderProfile();applySettings();

renderTasks();
