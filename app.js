
/* =====================================
   INJAZ - نظام إدارة المهام
   تطبيق عربي لإدارة المهام اليومية
===================================== */

const $ = id => document.getElementById(id);

const KEYS = {
  users: "injaz_users_v1",
  session: "injaz_session_v1",
  tasks: "injaz_tasks_v1"
};

let currentUser = null;
let tasks = [];
let currentFilter = "all";
let editingTaskId = null;
let authMode = "login";

/* قراءة البيانات */
function readJSON(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

/* حفظ المهام */
function saveTasks() {
  localStorage.setItem(KEYS.tasks, JSON.stringify(tasks));
}

/* حماية النصوص المعروضة */
function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

/* الانتقال إلى تسجيل الدخول */
function showAuth() {
  $("authScreen").classList.remove("hidden");
  $("appScreen").classList.add("hidden");
}

/* تشغيل التطبيق */
function showApp() {
  $("authScreen").classList.add("hidden");
  $("appScreen").classList.remove("hidden");

  $("userName").textContent = currentUser.name;
  $("userAvatar").textContent = currentUser.name.charAt(0);
  $("welcomeTitle").textContent = `أهلاً ${currentUser.name} 👋`;

  $("todayLabel").textContent =
    new Intl.DateTimeFormat("ar", {
      dateStyle: "full"
    }).format(new Date());

  $("year").textContent = new Date().getFullYear();

  tasks = readJSON(KEYS.tasks, [])
    .filter(task => task.owner === currentUser.email);

  render();
}

/* تبديل التسجيل والدخول */
function setAuthMode(mode) {
  authMode = mode;

  const register = mode === "register";

  $("loginTab").classList.toggle("active", !register);
  $("registerTab").classList.toggle("active", register);

  $("authName").classList.toggle("hidden", !register);
  $("nameLabel").classList.toggle("hidden", !register);

  $("authName").required = register;

  $("authSubmit").textContent = register
    ? "إنشاء حساب جديد"
    : "دخول إلى حسابي";

  $("authMessage").textContent = "";
}

$("loginTab").addEventListener("click", () => {
  setAuthMode("login");
});

$("registerTab").addEventListener("click", () => {
  setAuthMode("register");
});

/* تسجيل الدخول وإنشاء الحساب */
$("authForm").addEventListener("submit", event => {
  event.preventDefault();

  const email = $("authEmail").value.trim().toLowerCase();
  const password = $("authPassword").value;

  const users = readJSON(KEYS.users, []);

  if (authMode === "register") {

    const name = $("authName").value.trim();

    if (name.length < 2) {
      $("authMessage").textContent = "أدخل اسماً صحيحاً";
      return;
    }

    if (password.length < 4) {
      $("authMessage").textContent =
        "كلمة المرور يجب أن تكون 4 أحرف على الأقل";
      return;
    }

    if (users.some(user => user.email === email)) {
      $("authMessage").textContent =
        "هذا البريد مسجل مسبقاً";
      return;
    }

    users.push({
      name,
      email,
      password
    });

    localStorage.setItem(
      KEYS.users,
      JSON.stringify(users)
    );

    currentUser = { name, email };

  } else {

    const user = users.find(item =>
      item.email === email &&
      item.password === password
    );

    if (!user) {
      $("authMessage").textContent =
        "البريد الإلكتروني أو كلمة المرور غير صحيحة";
      return;
    }

    currentUser = {
      name: user.name,
      email: user.email
    };
  }

  localStorage.setItem(
    KEYS.session,
    JSON.stringify(currentUser)
  );

  showApp();
});

/* تسجيل الخروج */
$("logoutBtn").addEventListener("click", () => {

  localStorage.removeItem(KEYS.session);

  currentUser = null;
  tasks = [];

  $("authForm").reset();

  setAuthMode("login");
  showAuth();
});

/* التاريخ المحلي */
function localDate() {
  const now = new Date();

  return new Date(
    now.getTime() -
    now.getTimezoneOffset() * 60000
  ).toISOString().slice(0, 10);
}

/* إحصائيات المهام */
function updateStats() {

  const total = tasks.length;

  const done = tasks.filter(
    task => task.completed
  ).length;

  const active = total - done;

  $("statTotal").textContent = total;
  $("statActive").textContent = active;
  $("statDone").textContent = done;

  $("statRate").textContent = total
    ? `${Math.round(done / total * 100)}%`
    : "0%";

  $("allCount").textContent = total;
}

/* تصفية المهام */
function visibleTasks() {

  const query = $("searchInput").value
    .trim()
    .toLowerCase();

  const priority = $("priorityFilter").value;

  return tasks.filter(task => {

    const matchesFilter =
      currentFilter === "all" ||
      (
        currentFilter === "today" &&
        task.date === localDate()
      ) ||
      (
        currentFilter === "active" &&
        !task.completed
      ) ||
      (
        currentFilter === "completed" &&
        task.completed
      );

    const matchesSearch =
      `${task.title} ${task.description}`
      .toLowerCase()
      .includes(query);

    const matchesPriority =
      priority === "all" ||
      task.priority === priority;

    return (
      matchesFilter &&
      matchesSearch &&
      matchesPriority
    );

  }).sort((a, b) =>
    Number(a.completed) - Number(b.completed) ||
    (a.date || "9999").localeCompare(
      b.date || "9999"
    )
  );
}

/* أسماء الأولويات */
const priorityNames = {
  high: "مرتفعة",
  medium: "متوسطة",
  low: "منخفضة"
};

/* عرض المهام */
function render() {

  updateStats();

  const filtered = visibleTasks();

  $("taskList").innerHTML = filtered.map(task => `

    <article class="task-item ${
      task.completed ? "is-complete" : ""
    }">

      <input
        class="task-check"
        type="checkbox"
        aria-label="تحديد المهمة كمكتملة"
        data-action="toggle"
        data-id="${escapeHTML(task.id)}"
        ${task.completed ? "checked" : ""}
      >

      <div class="task-content">

        <h3>${escapeHTML(task.title)}</h3>

        ${
          task.description
            ? `<p>${escapeHTML(task.description)}</p>`
            : ""
        }

        <div class="task-meta">

          <span class="priority ${task.priority}">
            أولوية ${priorityNames[task.priority]}
          </span>

          ${
            task.date
              ? `<span class="task-date">◷ ${
                  escapeHTML(task.date)
                }</span>`
              : ""
          }

        </div>

      </div>

      <div class="task-actions">

        <button
          class="icon-btn"
          type="button"
          title="تعديل"
          aria-label="تعديل المهمة"
          data-action="edit"
          data-id="${escapeHTML(task.id)}"
        >✎</button>

        <button
          class="icon-btn"
          type="button"
          title="حذف"
          aria-label="حذف المهمة"
          data-action="delete"
          data-id="${escapeHTML(task.id)}"
        >⌫</button>

      </div>

    </article>

  `).join("");

  $("emptyState").classList.toggle(
    "hidden",
    filtered.length !== 0
  );
}

/* التنقل بين الأقسام */
const filterTitles = {
  all: "كل المهام",
  today: "مهام اليوم",
  active: "قيد التنفيذ",
  completed: "المهام المكتملة"
};

document.querySelectorAll(".nav-item").forEach(button => {

  button.addEventListener("click", () => {

    currentFilter = button.dataset.filter;

    document.querySelectorAll(".nav-item")
      .forEach(item => {
        item.classList.toggle(
          "active",
          item === button
        );
      });

    $("listTitle").textContent =
      filterTitles[currentFilter];

    render();
  });

});

/* البحث */
$("searchInput").addEventListener("input", render);

/* تصفية الأولوية */
$("priorityFilter").addEventListener(
  "change",
  render
);

/* فتح نافذة المهمة */
function openTaskDialog(task = null) {

  editingTaskId = task?.id ?? null;

  $("taskForm").reset();

  $("taskMessage").textContent = "";

  $("dialogTitle").textContent = task
    ? "تعديل المهمة"
    : "إضافة مهمة جديدة";

  $("taskTitle").value = task?.title ?? "";

  $("taskDescription").value =
    task?.description ?? "";

  $("taskDate").value = task?.date ?? "";

  $("taskPriority").value =
    task?.priority ?? "medium";

  $("taskDialog").showModal();

  $("taskTitle").focus();
}

/* إغلاق النافذة */
function closeTaskDialog() {
  $("taskDialog").close();
  editingTaskId = null;
}

/* أزرار النافذة */
$("openTaskModal").addEventListener(
  "click",
  () => openTaskDialog()
);

$("closeTaskModal").addEventListener(
  "click",
  closeTaskDialog
);

$("cancelTask").addEventListener(
  "click",
  closeTaskDialog
);

$("taskDialog").addEventListener(
  "click",
  event => {
    if (event.target === $("taskDialog")) {
      closeTaskDialog();
    }
  }
);

/* حفظ وإضافة وتعديل المهام */
$("taskForm").addEventListener(
  "submit",
  event => {

    event.preventDefault();

    const title = $("taskTitle").value.trim();

    if (!title) {
      $("taskMessage").textContent =
        "عنوان المهمة مطلوب";
      return;
    }

    const values = {
      title,
      description: $("taskDescription").value.trim(),
      date: $("taskDate").value,
      priority: $("taskPriority").value
    };

    if (editingTaskId) {

      tasks = tasks.map(task =>
        task.id === editingTaskId
          ? { ...task, ...values }
          : task
      );

    } else {

      tasks.unshift({

        id: crypto.randomUUID
          ? crypto.randomUUID()
          : String(Date.now()),

        ...values,

        completed: false,

        owner: currentUser.email,

        createdAt: new Date().toISOString()

      });

    }

    saveTasks();

    closeTaskDialog();

    render();

  }
);

/* تعديل وحذف المهام */
$("taskList").addEventListener(
  "click",
  event => {

    const control = event.target.closest(
      "[data-action]"
    );

    if (!control) return;

    const task = tasks.find(
      item => item.id === control.dataset.id
    );

    if (!task) return;

    if (control.dataset.action === "edit") {
      openTaskDialog(task);
    }

    if (control.dataset.action === "delete") {

      if (!confirm("هل أنت متأكد من حذف هذه المهمة؟")) {
        return;
      }

      tasks = tasks.filter(
        item => item.id !== task.id
      );

      saveTasks();

      render();
    }

  }
);

/* إكمال المهمة */
$("taskList").addEventListener(
  "change",
  event => {

    const control = event.target.closest(
      '[data-action="toggle"]'
    );

    if (!control) return;

    const task = tasks.find(
      item => item.id === control.dataset.id
    );

    if (!task) return;

    task.completed = control.checked;

    saveTasks();

    render();

  }
);

/* استعادة الجلسة */
const savedSession = readJSON(
  KEYS.session,
  null
);

if (savedSession) {

  currentUser = savedSession;

  showApp();

} else {

  showAuth();

}
