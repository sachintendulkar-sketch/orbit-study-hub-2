(function () {
  "use strict";

  /* ---------- Storage helpers (safe if storage is blocked) ---------- */
  var store = {
    get: function (key, fallback) {
      try {
        var raw = localStorage.getItem("orbit." + key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch (e) { return fallback; }
    },
    set: function (key, value) {
      try { localStorage.setItem("orbit." + key, JSON.stringify(value)); } catch (e) {}
    }
  };
  var $ = function (id) { return document.getElementById(id); };
  var todayKey = function () {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  };

  /* ---------- Theme ---------- */
  var root = document.documentElement;
  function currentTheme() {
    var explicit = root.getAttribute("data-theme");
    if (explicit) return explicit;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  function paintThemeLabel() { $("theme-label").textContent = currentTheme() === "dark" ? "Light mode" : "Dark mode"; }
  $("theme-toggle").addEventListener("click", function () {
    var next = currentTheme() === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    store.set("theme", next);
    try { localStorage.setItem("orbit.theme", next); } catch (e) {}
    paintThemeLabel();
  });
  paintThemeLabel();

  /* ---------- Date label ---------- */
  $("today-label").textContent = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  /* ---------- Stats (stored per day) ---------- */
  var stats = store.get("stats", { days: {} });
  function dayStats() { return stats.days[todayKey()] || { minutes: 0, sessions: 0 }; }
  function streak() {
    var count = 0, d = new Date();
    if (!stats.days[todayKey()]) d.setDate(d.getDate() - 1);
    for (;;) {
      var k = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
      if (stats.days[k] && stats.days[k].sessions > 0) { count++; d.setDate(d.getDate() - 1); } else break;
    }
    return count;
  }
  function renderStats() {
    var s = dayStats();
    $("stat-minutes").textContent = s.minutes;
    $("stat-sessions").textContent = s.sessions;
    var done = tasks.filter(function (t) { return t.done; }).length;
    $("stat-tasks").textContent = done + " / " + tasks.length;
    $("stat-streak").textContent = streak();
  }

  /* ---------- Timer ---------- */
  var CIRC = 2 * Math.PI * 88;
  var MODE_NAMES = { focus: "Focus", short: "Short break", long: "Long break" };
  var mode = "focus", totalSec = 25 * 60, remaining = totalSec, endAt = null, tick = null;
  var bar = $("ring-bar");

  function fmt(sec) {
    var m = Math.floor(sec / 60), s = sec % 60;
    return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  }
  function paintTimer() {
    $("time-display").textContent = fmt(remaining);
    $("mode-label").textContent = MODE_NAMES[mode];
    bar.style.strokeDashoffset = String(CIRC * (1 - remaining / totalSec));
    document.title = (tick ? fmt(remaining) + " · " : "") + "Orbit Study Hub";
  }
  function stopTick() { if (tick) { clearInterval(tick); tick = null; } }
  function finish() {
    stopTick();
    if (mode === "focus") {
      var key = todayKey(), s = stats.days[key] || { minutes: 0, sessions: 0 };
      s.minutes += Math.round(totalSec / 60);
      s.sessions += 1;
      stats.days[key] = s;
      store.set("stats", stats);
      renderStats();
    }
    remaining = totalSec;
    $("timer-start").textContent = "Start";
    paintTimer();
  }
  function run() {
    var left = Math.max(0, Math.round((endAt - Date.now()) / 1000));
    remaining = left;
    paintTimer();
    if (left === 0) finish();
  }
  $("timer-start").addEventListener("click", function () {
    if (tick) {
      stopTick();
      $("timer-start").textContent = "Resume";
      paintTimer();
      return;
    }
    endAt = Date.now() + remaining * 1000;
    tick = setInterval(run, 250);
    $("timer-start").textContent = "Pause";
    run();
  });
  $("timer-reset").addEventListener("click", function () {
    stopTick();
    remaining = totalSec;
    $("timer-start").textContent = "Start";
    paintTimer();
  });
  Array.prototype.forEach.call(document.querySelectorAll(".mode"), function (btn) {
    btn.addEventListener("click", function () {
      Array.prototype.forEach.call(document.querySelectorAll(".mode"), function (b) {
        b.classList.remove("is-active");
        b.setAttribute("aria-selected", "false");
      });
      btn.classList.add("is-active");
      btn.setAttribute("aria-selected", "true");
      mode = btn.getAttribute("data-mode");
      totalSec = parseInt(btn.getAttribute("data-min"), 10) * 60;
      stopTick();
      remaining = totalSec;
      $("timer-start").textContent = "Start";
      paintTimer();
    });
  });

  /* ---------- Schedule ---------- */
  var schedule = store.get("schedule", []);
  function renderSchedule() {
    var list = $("schedule-list");
    list.innerHTML = "";
    schedule.sort(function (a, b) { return a.time.localeCompare(b.time); });
    schedule.forEach(function (item, i) {
      var li = document.createElement("li");
      var time = document.createElement("span"); time.className = "time"; time.textContent = item.time;
      var text = document.createElement("span"); text.className = "text"; text.textContent = item.subject;
      var del = document.createElement("button"); del.type = "button"; del.className = "icon-btn";
      del.textContent = "Remove"; del.setAttribute("aria-label", "Remove " + item.subject);
      del.addEventListener("click", function () { schedule.splice(i, 1); store.set("schedule", schedule); renderSchedule(); });
      li.appendChild(time); li.appendChild(text); li.appendChild(del);
      list.appendChild(li);
    });
    $("schedule-empty").hidden = schedule.length > 0;
  }
  $("schedule-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var time = $("sch-time").value, subject = $("sch-subject").value.trim();
    if (!time || !subject) return;
    schedule.push({ time: time, subject: subject });
    store.set("schedule", schedule);
    $("sch-subject").value = "";
    renderSchedule();
  });

  /* ---------- Tasks ---------- */
  var tasks = store.get("tasks", []);
  function renderTasks() {
    var list = $("task-list");
    list.innerHTML = "";
    tasks.forEach(function (t, i) {
      var li = document.createElement("li");
      if (t.done) li.className = "is-done";
      var box = document.createElement("input"); box.type = "checkbox"; box.checked = !!t.done;
      box.id = "task-" + i; box.setAttribute("aria-label", "Mark done: " + t.text);
      box.addEventListener("change", function () { t.done = box.checked; store.set("tasks", tasks); renderTasks(); renderStats(); });
      var text = document.createElement("span"); text.className = "text"; text.textContent = t.text;
      var del = document.createElement("button"); del.type = "button"; del.className = "icon-btn";
      del.textContent = "Remove"; del.setAttribute("aria-label", "Remove " + t.text);
      del.addEventListener("click", function () { tasks.splice(i, 1); store.set("tasks", tasks); renderTasks(); renderStats(); });
      li.appendChild(box); li.appendChild(text); li.appendChild(del);
      list.appendChild(li);
    });
    $("task-empty").hidden = tasks.length > 0;
  }
  $("task-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var text = $("task-input").value.trim();
    if (!text) return;
    tasks.push({ text: text, done: false });
    store.set("tasks", tasks);
    $("task-input").value = "";
    renderTasks();
    renderStats();
  });

  /* ---------- Notes ---------- */
  var notes = $("notes"), noteTimer = null;
  notes.value = store.get("notes", "");
  notes.addEventListener("input", function () {
    clearTimeout(noteTimer);
    $("notes-status").textContent = "Saving…";
    noteTimer = setTimeout(function () {
      store.set("notes", notes.value);
      $("notes-status").textContent = "Saved in this browser.";
    }, 400);
  });

  /* ---------- Init ---------- */
  paintTimer();
  renderSchedule();
  renderTasks();
  renderStats();
})();
