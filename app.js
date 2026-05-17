const PEOPLE = {
  katya: { id: "katya", name: "Катя" },
  mykyta: { id: "mykyta", name: "Микита" },
};

const MOOD_CATEGORIES = [
  {
    id: "uplift",
    title: "Піднесення",
    color: "green",
    emotions: [
      ["😊", "Щастя"],
      ["😌", "Радість"],
      ["😄", "Веселість"],
      ["🌤️", "Піднесеність"],
      ["🕊️", "Безтурботність"],
      ["🫶", "Полегшення"],
    ],
  },
  {
    id: "neutral",
    title: "Нейтралітет",
    color: "amber",
    emotions: [
      ["🧘‍♂️", "Спокій"],
      ["🤔", "Задумливість"],
      ["⏳", "Очікування"],
      ["⚖️", "Врівноваженість"],
      ["🙂", "Зібраність"],
      ["🫧", "Тиша всередині"],
    ],
  },
  {
    id: "apathy",
    title: "Апатія",
    color: "gray",
    emotions: [
      ["😢", "Сум"],
      ["😞", "Розчарування"],
      ["😔", "Провина"],
      ["😵‍💫", "Безпорадність"],
      ["😪", "Туга"],
      ["😶", "Пасивність"],
      ["😐", "Байдужість"],
      ["🫥", "Невизначеність"],
    ],
  },
  {
    id: "activity",
    title: "Активність",
    color: "teal",
    emotions: [
      ["⚡", "Енергійність"],
      ["💪", "Впевненість"],
      ["✨", "Натхнення"],
      ["🤩", "Захоплення"],
      ["🚀", "Вмотивованість"],
      ["🎯", "Сконцентрованість"],
    ],
  },
  {
    id: "contact",
    title: "Контакти",
    color: "orange",
    emotions: [
      ["🤗", "Соціальна енергія"],
      ["🌿", "Відкритість"],
      ["💬", "Почуття ізольованості"],
      ["😔", "Самотність"],
      ["😶‍🌫️", "Спустошеність"],
      ["🥱", "Втома від оточення"],
      ["🧊", "Відчуженість"],
    ],
  },
  {
    id: "discomfort",
    title: "Дискомфорт",
    color: "red",
    emotions: [
      ["😣", "Напруження"],
      ["🫨", "Стрес"],
      ["😰", "Паніка"],
      ["😨", "Страх"],
      ["😟", "Невпевненість"],
    ],
  },
  {
    id: "success",
    title: "Успіх",
    color: "blue",
    emotions: [
      ["🏅", "Гордість"],
      ["✅", "Задоволення результатом"],
      ["🏆", "Тріумф"],
      ["🌟", "Відчуття значущості"],
      ["🧩", "Самореалізація"],
    ],
  },
  {
    id: "romance",
    title: "Романтика",
    color: "pink",
    emotions: [
      ["❤️", "Любов"],
      ["🌸", "Ніжність"],
      ["😆", "Грайливість"],
      ["🔥", "Бажання"],
      ["🫶", "Чуттєвість"],
      ["💖", "Теплота"],
      ["🥰", "Задоволення"],
      ["💓", "Приємне хвилювання"],
      ["😏", "Ревнощі"],
    ],
  },
  {
    id: "negative",
    title: "Негатив",
    color: "dark-red",
    emotions: [
      ["😰", "Тривога"],
      ["😠", "Злість"],
      ["🌧️", "Обурення"],
      ["😤", "Роздратування"],
      ["🤢", "Відраза"],
      ["😒", "Образа"],
      ["🙁", "Невдоволення"],
    ],
  },
];

const STORAGE_KEY = "km-mood-history-v3";
const AUTH_KEY = "km-auth-person";
const CHANNEL_NAME = "km-mood-channel";
const LOCAL_PASSWORDS = {
  K: "katya",
  M: "mykyta",
};

let selectedPerson = "";
let selectedCategoryId = null;
let historyCache = [];
let toastTimer = 0;
let dataLoaded = false;
let currentUser = null;
let activeApi = null;
let unsubscribeRealtime = null;

document.addEventListener("DOMContentLoaded", async () => {
  bindAuth();
  bindNavigation();
  renderCategories();

  activeApi = await createDataApi();
  setAuthModeUi(activeApi.mode);

  const session = await activeApi.getCurrentSession();
  if (session) {
    await enterAuthenticatedSession(session);
  }
});

function bindAuth() {
  document.getElementById("auth-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    clearAuthError();

    const email = document.getElementById("auth-email").value.trim();
    const passwordInput = document.getElementById("auth-password");
    const password = passwordInput.value.trim();

    try {
      const session = await activeApi.signIn({ email, password });
      passwordInput.value = "";
      await enterAuthenticatedSession(session);
    } catch (error) {
      showAuthError(error.message || "Не вдалося увійти");
      passwordInput.select();
    }
  });

  document.querySelectorAll("[data-logout]").forEach((button) => {
    button.addEventListener("click", async () => {
      await activeApi.signOut();
      selectedPerson = "";
      currentUser = null;
      dataLoaded = false;
      historyCache = [];
      unsubscribeRealtime?.();
      unsubscribeRealtime = null;
      showView("auth");
      document.getElementById("auth-password").focus();
    });
  });
}

async function enterAuthenticatedSession(session) {
  selectedPerson = session.person;
  currentUser = session.user || null;
  syncSessionUi();
  try {
    await ensureDataLoaded();
    subscribeToRealtime();
    showView("entry");
    showToast(`Вхід виконано: ${PEOPLE[selectedPerson].name}`);
  } catch (error) {
    await activeApi.signOut();
    selectedPerson = "";
    currentUser = null;
    dataLoaded = false;
    showView("auth");
    showAuthError(error.message || "Не вдалося завантажити дані");
  }
}

async function ensureDataLoaded() {
  if (dataLoaded) {
    return;
  }

  historyCache = await activeApi.fetchHistory();
  renderCurrentMoods(historyCache);
  renderHistory(historyCache);
  dataLoaded = true;
}

function subscribeToRealtime() {
  unsubscribeRealtime?.();
  unsubscribeRealtime = activeApi.subscribeToHistoryUpdates?.(async () => {
    historyCache = await activeApi.fetchHistory();
    renderCurrentMoods(historyCache);
    renderHistory(historyCache);
    showToast("Настрій оновлено в реальному часі");
  });
}

function bindNavigation() {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!selectedPerson) {
        showView("auth");
        return;
      }

      await ensureDataLoaded();
      showView(button.dataset.view);
    });
  });

  document.getElementById("reset-category").addEventListener("click", () => {
    selectedCategoryId = null;
    document.getElementById("emotion-panel").hidden = true;
    document.getElementById("category-grid").hidden = false;
    document.getElementById("mood-title").textContent = `Обери категорію для ${PEOPLE[selectedPerson].name}`;
  });

  document.getElementById("clear-history").addEventListener("click", async () => {
    if (activeApi.mode === "local") {
      historyCache = await activeApi.resetDemo();
      renderCurrentMoods(historyCache);
      renderHistory(historyCache);
      showToast("Демо-історію оновлено");
      return;
    }

    historyCache = await activeApi.fetchHistory();
    renderCurrentMoods(historyCache);
    renderHistory(historyCache);
    showToast("Історію оновлено");
  });
}

function syncSessionUi() {
  const name = selectedPerson ? PEOPLE[selectedPerson].name : "";
  document.getElementById("main-session-name").textContent = name;
  document.getElementById("mood-session-name").textContent = name;
}

function showView(viewName) {
  document.querySelectorAll(".view").forEach((view) => view.classList.remove("is-active"));
  document.getElementById(`${viewName}-view`).classList.add("is-active");

  if (viewName === "history") {
    renderHistory(historyCache);
  }

  if (viewName === "mood") {
    selectedCategoryId = null;
    document.getElementById("emotion-panel").hidden = true;
    document.getElementById("category-grid").hidden = false;
    document.getElementById("mood-title").textContent = `Обери категорію для ${PEOPLE[selectedPerson].name}`;
  }
}

function renderCategories() {
  const categoryGrid = document.getElementById("category-grid");
  categoryGrid.innerHTML = "";

  MOOD_CATEGORIES.forEach((category) => {
    const button = document.createElement("button");
    button.className = "category-button";
    button.type = "button";
    button.dataset.color = category.color;
    button.textContent = category.title;
    button.addEventListener("click", () => openCategory(category.id));
    categoryGrid.append(button);
  });
}

function openCategory(categoryId) {
  selectedCategoryId = categoryId;
  const category = MOOD_CATEGORIES.find((item) => item.id === categoryId);
  const emotionGrid = document.getElementById("emotion-grid");

  document.getElementById("category-grid").hidden = true;
  document.getElementById("emotion-panel").hidden = false;
  document.getElementById("emotion-title").textContent = category.title;
  document.getElementById("mood-title").textContent = `Обери настрій для ${PEOPLE[selectedPerson].name}`;

  emotionGrid.innerHTML = "";
  category.emotions.forEach(([emoji, mood]) => {
    const button = document.createElement("button");
    button.className = "emotion-button";
    button.type = "button";
    button.innerHTML = `<span class="emotion-icon" aria-hidden="true">${emoji}</span><span>${mood}</span>`;
    button.addEventListener("click", () => saveMood({ emoji, mood, category }));
    emotionGrid.append(button);
  });
}

async function saveMood({ emoji, mood, category }) {
  const entry = {
    id: crypto.randomUUID(),
    userId: currentUser?.id || null,
    person: selectedPerson,
    personName: PEOPLE[selectedPerson].name,
    categoryId: category.id,
    categoryTitle: category.title,
    mood,
    emoji,
    createdAt: new Date().toISOString(),
  };

  try {
    historyCache = await activeApi.addMood(entry);
    renderCurrentMoods(historyCache);
    renderHistory(historyCache);
    showToast(`${entry.personName}: ${emoji} ${mood}`);
    showView("main");
  } catch (error) {
    showToast(error.message || "Не вдалося зберегти настрій");
  }
}

function renderCurrentMoods(history) {
  Object.values(PEOPLE).forEach((person) => {
    const latest = history.find((entry) => entry.person === person.id);
    if (!latest) {
      return;
    }

    document.getElementById(`${person.id}-emoji`).textContent = latest.emoji;
    document.getElementById(`${person.id}-mood`).textContent = latest.mood;
    document.getElementById(`${person.id}-date`).textContent = formatDate(latest.createdAt);
    document.getElementById(`${person.id}-time`).textContent = formatTime(latest.createdAt);
  });
}

function renderHistory(history) {
  const layout = document.getElementById("history-layout");
  layout.innerHTML = "";

  Object.values(PEOPLE).forEach((person) => {
    const column = document.createElement("section");
    column.className = "history-column";
    column.innerHTML = `<h3>${person.name}</h3>`;

    const entries = history.filter((entry) => entry.person === person.id);
    if (!entries.length) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "Тут поки немає настроїв.";
      column.append(empty);
      layout.append(column);
      return;
    }

    groupByDate(entries).forEach(({ date, items }) => {
      const day = document.createElement("div");
      day.className = "history-day";
      day.innerHTML = `<div class="history-date">${date}</div>`;

      const itemList = document.createElement("div");
      itemList.className = "history-items";

      items.forEach((entry) => {
        const row = document.createElement("div");
        row.className = "history-item";
        row.innerHTML = `
          <span class="history-time">${formatTime(entry.createdAt)}</span>
          <span class="history-emotion"><span aria-hidden="true">${entry.emoji}</span><span>${entry.mood}</span></span>
        `;
        itemList.append(row);
      });

      day.append(itemList);
      column.append(day);
    });

    layout.append(column);
  });
}

async function createDataApi() {
  const config = await loadSupabaseConfig();
  if (!config) {
    return createLocalApi();
  }

  try {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);
    return createSupabaseApi(supabase);
  } catch (error) {
    console.warn("Supabase client was unavailable, using local demo data.", error);
    return createLocalApi();
  }
}

async function loadSupabaseConfig() {
  if (window.KM_SUPABASE_CONFIG?.supabaseUrl && window.KM_SUPABASE_CONFIG?.supabaseAnonKey) {
    return window.KM_SUPABASE_CONFIG;
  }

  try {
    const response = await fetch("/api/config", { cache: "no-store" });
    if (!response.ok) {
      return null;
    }

    const config = await response.json();
    if (!config.supabaseUrl || !config.supabaseAnonKey) {
      return null;
    }

    return config;
  } catch {
    return null;
  }
}

function createSupabaseApi(supabase) {
  return {
    mode: "supabase",

    async getCurrentSession() {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) {
        return null;
      }

      return sessionFromSupabaseUser(data.session.user);
    },

    async signIn({ email, password }) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        throw new Error("Невірна пошта або пароль");
      }

      return sessionFromSupabaseUser(data.user);
    },

    async signOut() {
      await supabase.auth.signOut();
    },

    async fetchHistory() {
      const { data, error } = await supabase
        .from("mood_entries")
        .select("id,user_id,person,category_id,category_title,mood,emoji,created_at")
        .order("created_at", { ascending: false });

      if (error) {
        throw new Error("Не вдалося завантажити історію настрою");
      }

      return data.map(mapDbEntry);
    },

    async addMood(entry) {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        throw new Error("Сесія завершилася. Увійдіть ще раз.");
      }

      const { error } = await supabase.from("mood_entries").insert({
        user_id: userData.user.id,
        person: entry.person,
        category_id: entry.categoryId,
        category_title: entry.categoryTitle,
        mood: entry.mood,
        emoji: entry.emoji,
      });

      if (error) {
        throw new Error("Не вдалося зберегти настрій");
      }

      return this.fetchHistory();
    },

    subscribeToHistoryUpdates(onUpdate) {
      const channel = supabase
        .channel("public:mood_entries")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "mood_entries" },
          () => onUpdate(),
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    },
  };
}

function createLocalApi() {
  const channel = "BroadcastChannel" in window ? new BroadcastChannel(CHANNEL_NAME) : null;

  return {
    mode: "local",

    async getCurrentSession() {
      const storedPerson = sessionStorage.getItem(AUTH_KEY);
      if (!storedPerson || !PEOPLE[storedPerson]) {
        return null;
      }

      return { person: storedPerson, user: { id: `local-${storedPerson}` } };
    },

    async signIn({ password }) {
      const person = LOCAL_PASSWORDS[password.trim().toUpperCase()];
      if (!person) {
        throw new Error("Невірний пароль");
      }

      sessionStorage.setItem(AUTH_KEY, person);
      return { person, user: { id: `local-${person}` } };
    },

    async signOut() {
      sessionStorage.removeItem(AUTH_KEY);
    },

    async fetchHistory() {
      await wait(160);
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }

      const seeded = buildSeedHistory();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
      return seeded;
    },

    async addMood(entry) {
      await wait(90);
      const history = await this.fetchHistory();
      const nextHistory = [entry, ...history];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextHistory));
      channel?.postMessage({ type: "history-updated" });
      return nextHistory;
    },

    async resetDemo() {
      await wait(90);
      const seeded = buildSeedHistory();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
      channel?.postMessage({ type: "history-updated" });
      return seeded;
    },

    subscribeToHistoryUpdates(onUpdate) {
      const onMessage = (event) => {
        if (event.data?.type === "history-updated") {
          onUpdate();
        }
      };
      const onStorage = (event) => {
        if (event.key === STORAGE_KEY) {
          onUpdate();
        }
      };

      channel?.addEventListener("message", onMessage);
      window.addEventListener("storage", onStorage);

      return () => {
        channel?.removeEventListener("message", onMessage);
        window.removeEventListener("storage", onStorage);
      };
    },
  };
}

function sessionFromSupabaseUser(user) {
  const person = user?.app_metadata?.person;
  if (!person || !PEOPLE[person]) {
    throw new Error("Для цього користувача не задано роль Каті або Микити");
  }

  return { person, user };
}

function mapDbEntry(row) {
  return {
    id: row.id,
    userId: row.user_id,
    person: row.person,
    personName: PEOPLE[row.person]?.name || row.person,
    categoryId: row.category_id,
    categoryTitle: row.category_title,
    mood: row.mood,
    emoji: row.emoji,
    createdAt: row.created_at,
  };
}

function setAuthModeUi(mode) {
  const emailField = document.getElementById("auth-email-field");
  const authHint = document.getElementById("auth-hint");
  const clearHistory = document.getElementById("clear-history");

  emailField.hidden = mode !== "supabase";
  document.getElementById("auth-email").required = mode === "supabase";
  authHint.textContent =
    mode === "supabase"
      ? "Увійдіть за поштою та паролем"
      : "Локальний демо-режим: K для Каті, M для Микити";
  clearHistory.textContent = mode === "supabase" ? "Оновити" : "Оновити демо";
}

function showAuthError(message) {
  document.getElementById("auth-error").textContent = message;
}

function clearAuthError() {
  document.getElementById("auth-error").textContent = "";
}

function groupByDate(entries) {
  const groups = new Map();
  entries.forEach((entry) => {
    const date = formatDate(entry.createdAt);
    if (!groups.has(date)) {
      groups.set(date, []);
    }
    groups.get(date).push(entry);
  });

  return Array.from(groups, ([date, items]) => ({ date, items }));
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("is-visible");

  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.classList.remove("is-visible");
  }, 2200);
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function formatDate(value) {
  return new Intl.DateTimeFormat("uk-UA", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(new Date(value));
}

function formatTime(value) {
  return new Intl.DateTimeFormat("uk-UA", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function buildSeedHistory() {
  const now = new Date();

  const seed = [
    makeSeed("mykyta", "neutral", "🤔", "Задумливість", minutesAgo(now, 18)),
    makeSeed("katya", "neutral", "🤔", "Задумливість", minutesAgo(now, 68)),
    makeSeed("mykyta", "activity", "💪", "Впевненість", minutesAgo(now, 146)),
    makeSeed("mykyta", "neutral", "🧘‍♂️", "Спокій", minutesAgo(now, 147)),
    makeSeed("katya", "contact", "🥱", "Втома", minutesAgo(now, 192)),
    makeSeed("mykyta", "activity", "⚡", "Енергійність", minutesAgo(now, 279)),
    makeSeed("katya", "neutral", "⏳", "Очікування", minutesAgo(now, 332)),
    makeSeed("mykyta", "uplift", "🫶", "Полегшення", minutesAgo(now, 382)),
    makeSeed("katya", "apathy", "😶", "Пасивність", minutesAgo(now, 498)),
    makeSeed("katya", "apathy", "😪", "Втома", minutesAgo(now, 499)),
    makeSeed("mykyta", "neutral", "🧘‍♂️", "Спокій", minutesAgo(now, 1515)),
    makeSeed("katya", "activity", "✨", "Натхнення", minutesAgo(now, 1515)),
    makeSeed("mykyta", "romance", "🥰", "Задоволення", minutesAgo(now, 1516)),
    makeSeed("katya", "apathy", "😶", "Пасивність", minutesAgo(now, 1706)),
    makeSeed("katya", "apathy", "😢", "Сум", minutesAgo(now, 1707)),
    makeSeed("mykyta", "uplift", "🫶", "Полегшення", minutesAgo(now, 1885)),
    makeSeed("katya", "uplift", "🫶", "Полегшення", minutesAgo(now, 1905)),
    makeSeed("katya", "neutral", "⏳", "Очікування", minutesAgo(now, 1906)),
  ];

  return seed.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function makeSeed(person, categoryId, emoji, mood, date) {
  const category = MOOD_CATEGORIES.find((item) => item.id === categoryId);
  return {
    id: `${person}-${categoryId}-${date.getTime()}`,
    userId: `local-${person}`,
    person,
    personName: PEOPLE[person].name,
    categoryId,
    categoryTitle: category.title,
    mood,
    emoji,
    createdAt: date.toISOString(),
  };
}

function minutesAgo(date, minutes) {
  return new Date(date.getTime() - minutes * 60 * 1000);
}
