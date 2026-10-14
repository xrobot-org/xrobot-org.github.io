// onboarding.js - profile-aware skill tree onboarding

const CONFIG_URL = "config.json";
// Same key as the Docusaurus colour mode on the main site, so both pages keep one theme.
const THEME_STORAGE_KEY = "theme";
// Key used by earlier versions of this page; read once as a fallback.
const LEGACY_THEME_STORAGE_KEY = "xrobot_onboarding_theme";
const DARK_MODE_MEDIA_QUERY = "(prefers-color-scheme: dark)";

let treeConfig = null;
let state = null;
let themeMediaQuery = null;

const mdTextCache = {};

function md(text) {
  if (!text) return "";
  if (window.marked) {
    return window.marked.parse(text);
  }
  return String(text);
}

const ALLOWED_HTML_TAGS = new Set([
  "A",
  "B",
  "BLOCKQUOTE",
  "BR",
  "CODE",
  "DEL",
  "EM",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "HR",
  "I",
  "LI",
  "OL",
  "P",
  "PRE",
  "STRONG",
  "UL"
]);

const ALLOWED_HTML_ATTRS = {
  A: new Set(["href", "title"])
};

function isSafeUrl(url) {
  if (!url) return false;

  const normalized = String(url).trim();
  if (!normalized) return false;

  if (normalized.startsWith("#") || normalized.startsWith("/")) {
    return true;
  }

  try {
    const parsed = new URL(normalized, window.location.href);
    return ["http:", "https:", "mailto:"].includes(parsed.protocol);
  } catch (e) {
    return false;
  }
}

function isExternalHttpUrl(url) {
  try {
    const parsed = new URL(url, window.location.href);
    return ["http:", "https:"].includes(parsed.protocol) && parsed.origin !== window.location.origin;
  } catch (e) {
    return false;
  }
}

function sanitizeHtml(html) {
  const parsedHtml = new DOMParser().parseFromString(String(html || ""), "text/html");

  const sanitizeNode = node => {
    if (node.nodeType === Node.TEXT_NODE) {
      return document.createTextNode(node.textContent || "");
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return document.createDocumentFragment();
    }

    const tagName = node.tagName.toUpperCase();
    if (!ALLOWED_HTML_TAGS.has(tagName)) {
      const fragment = document.createDocumentFragment();
      Array.from(node.childNodes).forEach(child => {
        fragment.appendChild(sanitizeNode(child));
      });
      return fragment;
    }

    const clean = document.createElement(tagName.toLowerCase());
    const allowedAttrs = ALLOWED_HTML_ATTRS[tagName] || new Set();

    Array.from(node.attributes).forEach(attr => {
      const attrName = attr.name.toLowerCase();
      if (!allowedAttrs.has(attrName)) {
        return;
      }

      if (attrName === "href" && !isSafeUrl(attr.value)) {
        return;
      }

      clean.setAttribute(attr.name, attr.value);
    });

    if (tagName === "A" && clean.hasAttribute("href")) {
      const href = clean.getAttribute("href");
      if (isExternalHttpUrl(href)) {
        clean.setAttribute("rel", "noopener noreferrer");
        clean.setAttribute("target", "_blank");
      }
    }

    Array.from(node.childNodes).forEach(child => {
      clean.appendChild(sanitizeNode(child));
    });

    return clean;
  };

  const fragment = document.createDocumentFragment();
  Array.from(parsedHtml.body.childNodes).forEach(child => {
    fragment.appendChild(sanitizeNode(child));
  });
  return fragment;
}

function setSanitizedMarkdown(el, markdownText) {
  if (!el) return;
  el.replaceChildren(sanitizeHtml(md(markdownText || "")));
}

function getStoredThemePreference() {
  try {
    for (const key of [THEME_STORAGE_KEY, LEGACY_THEME_STORAGE_KEY]) {
      const savedTheme = localStorage.getItem(key);
      if (savedTheme === "light" || savedTheme === "dark") {
        return savedTheme;
      }
    }
  } catch (e) {
    console.warn("读取主题偏好失败", e);
  }

  return null;
}

function getSystemTheme() {
  if (window.matchMedia && window.matchMedia(DARK_MODE_MEDIA_QUERY).matches) {
    return "dark";
  }

  return "light";
}

function getPreferredTheme() {
  return getStoredThemePreference() || getSystemTheme();
}

function updateThemeToggleLabel(theme) {
  const nextTheme = theme === "dark" ? "light" : "dark";
  const nextLabel = nextTheme === "dark" ? "切换到深色模式" : "切换到浅色模式";
  const toggleButton = document.getElementById("theme-toggle-button");
  const toggleText = document.getElementById("theme-toggle-text");

  if (toggleButton) {
    toggleButton.setAttribute("aria-label", nextLabel);
    toggleButton.setAttribute("title", nextLabel);
  }

  if (toggleText) {
    toggleText.textContent = nextLabel;
  }
}

function applyTheme(theme, options = {}) {
  const nextTheme = theme === "dark" ? "dark" : "light";
  const { persist = true } = options;
  document.documentElement.setAttribute("data-theme", nextTheme);
  updateThemeToggleLabel(nextTheme);

  if (persist) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch (e) {
      console.warn("保存主题偏好失败", e);
    }
  }
}

function handleSystemThemeChange(event) {
  if (getStoredThemePreference()) {
    return;
  }

  applyTheme(event.matches ? "dark" : "light", { persist: false });
}

function initThemeToggle() {
  const toggleButton = document.getElementById("theme-toggle-button");
  const storedTheme = getStoredThemePreference();
  applyTheme(storedTheme || getSystemTheme(), { persist: !!storedTheme });

  if (toggleButton) {
    toggleButton.addEventListener("click", () => {
      const currentTheme = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
      const nextTheme = currentTheme === "dark" ? "light" : "dark";
      applyTheme(nextTheme, { persist: true });
    });
  }

  if (window.matchMedia) {
    themeMediaQuery = window.matchMedia(DARK_MODE_MEDIA_QUERY);
    if (typeof themeMediaQuery.addEventListener === "function") {
      themeMediaQuery.addEventListener("change", handleSystemThemeChange);
    } else if (typeof themeMediaQuery.addListener === "function") {
      themeMediaQuery.addListener(handleSystemThemeChange);
    }
  }
}

function loadMdIntoElement(path, el) {
  if (!path || !el) return;

  // 有缓存就直接用
  if (mdTextCache[path]) {
    setSanitizedMarkdown(el, mdTextCache[path]);
    return;
  }

  // 初始先给个占位提示
  el.textContent = "加载内容中…";

  fetch(path)
    .then(res => {
      if (!res.ok) {
        throw new Error("加载 markdown 失败: " + path);
      }
      return res.text();
    })
    .then(text => {
      mdTextCache[path] = text;
      setSanitizedMarkdown(el, text);
    })
    .catch(err => {
      console.error(err);
      el.textContent = "（加载任务说明失败，请检查 " + path + " 是否存在且可访问）";
    });
}


async function loadConfig() {
  // 1. 加载主配置
  const res = await fetch(CONFIG_URL);
  if (!res.ok) {
    throw new Error("加载主配置失败: " + CONFIG_URL);
  }
  const baseCfg = await res.json();

  // 2. 读取 includes 数组（如果没有就当空）
  const includes = Array.isArray(baseCfg.includes) ? baseCfg.includes : [];

  // 3. 依次拉取子配置
  const childConfigs = [];
  for (const url of includes) {
    const r = await fetch(url);
    if (!r.ok) {
      throw new Error("加载子配置失败: " + url);
    }
    childConfigs.push(await r.json());
  }

  // 4. 合并所有 nodes
  const allNodes = Object.assign({}, baseCfg.nodes || {});
  for (const cfg of childConfigs) {
    if (cfg && cfg.nodes) {
      // 后面的覆盖前面的
      Object.assign(allNodes, cfg.nodes);
    }
  }

  // 5. 生成最终 config
  return {
    title: baseCfg.title || "Onboarding Guide",
    subtitle: baseCfg.subtitle || "",
    storageKey: baseCfg.storageKey || "skill_tree_onboarding_v1",
    root: baseCfg.root || baseCfg.start || Object.keys(allNodes)[0],
    nodes: allNodes
  };
}

function getStorageKey() {
  return (treeConfig && treeConfig.storageKey) || "skill_tree_onboarding_v1";
}

function loadState() {
  const key = getStorageKey();
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return {
        currentNodeId: treeConfig.root,
        completedTasks: {},
        history: [],
        profile: {}
      };
    }
    const parsed = JSON.parse(raw);
    return {
      currentNodeId: parsed.currentNodeId || treeConfig.root,
      completedTasks: parsed.completedTasks || {},
      history: parsed.history || [],
      profile: parsed.profile || {}
    };
  } catch (e) {
    return {
      currentNodeId: treeConfig.root,
      completedTasks: {},
      history: [],
      profile: {}
    };
  }
}

function saveState() {
  const key = getStorageKey();
  try {
    localStorage.setItem(
      key,
      JSON.stringify({
        currentNodeId: state.currentNodeId,
        completedTasks: state.completedTasks,
        history: state.history,
        profile: state.profile
      })
    );
  } catch (e) {
    console.warn("保存进度失败", e);
  }
}

function applyOverrides(node, profile) {
  if (!node || !node.overrides || !Array.isArray(node.overrides)) return node;

  let chosenOverride = null;

  for (const ov of node.overrides) {
    const cond = ov.when || {};
    let matched = true;
    for (const key of Object.keys(cond)) {
      if (profile[key] !== cond[key]) {
        matched = false;
        break;
      }
    }
    if (matched) {
      chosenOverride = ov;
      break;
    }
  }

  if (!chosenOverride) return node;
  const { when, ...rest } = chosenOverride;
  return Object.assign({}, node, rest);
}

function goToNode(nextNodeId, pushHistory = true) {
  if (!treeConfig || !treeConfig.nodes[nextNodeId]) {
    console.warn("目标节点不存在:", nextNodeId);

    const errEl = document.getElementById("app-error");
    if (errEl) {
      errEl.textContent = `目标节点不存在：${nextNodeId}，请检查 config.json / includes / 子配置文件中的 nodes 定义。`;
    }
    return;
  }
  if (pushHistory && state.currentNodeId) {
    state.history.push(state.currentNodeId);
  }
  state.currentNodeId = nextNodeId;
  saveState();
  render();

  window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
}


function resetToRoot() {
  state.history = [];
  state.currentNodeId = treeConfig.root;
  state.profile = {};
  saveState();
  render();
}

function clearAllData() {
  const key = getStorageKey();
  try {
    localStorage.removeItem(key);
  } catch (e) {
    console.warn("清除本地数据失败", e);
  }

  // 重置内存中的状态
  state = {
    currentNodeId: treeConfig.root,
    completedTasks: {},
    history: [],
    profile: {}
  };

  render();
}

function goBack() {
  if (state.history.length === 0) {
    return;
  }
  const prev = state.history.pop();
  state.currentNodeId = prev;
  saveState();
  render();
}

function toggleTask(taskId, checked) {
  if (!taskId) return;
  if (checked) {
    state.completedTasks[taskId] = true;
  } else {
    delete state.completedTasks[taskId];
  }
  saveState();
  render();
}

function computeTaskStats(node, completedTasks) {
  const tasks = node.tasks || [];
  const total = tasks.length;
  let done = 0;
  let totalMinutes = 0;
  let doneMinutes = 0;

  tasks.forEach(t => {
    const est = Number(t.estimateMinutes) || 0;
    totalMinutes += est;
    if (completedTasks[t.id]) {
      done += 1;
      doneMinutes += est;
    }
  });

  const ratio = total === 0 ? 0 : done / total;

  return {
    total,
    done,
    ratio,
    totalMinutes,
    doneMinutes
  };
}

function formatMinutes(mins) {
  if (!mins || mins <= 0) return "0 分钟";
  if (mins < 60) return mins + " 分钟";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (m === 0) return h + " 小时";
  return h + " 小时 " + m + " 分钟";
}

// Render a choice node (route selection)
function renderChoiceNode(node) {
  const container = document.createElement("div");
  container.className = "card";

  const title = document.createElement("h2");
  title.className = "node-title";
  title.textContent = node.title || "请选择你的路线";
  container.appendChild(title);

  if (node.subtitle) {
    const sub = document.createElement("div");
    sub.className = "node-subtitle";
    sub.textContent = node.subtitle;
    container.appendChild(sub);
  }

  if (node.question) {
    const q = document.createElement("div");
    q.textContent = node.question;
    container.appendChild(q);
  }

  const list = document.createElement("div");
  list.className = "choice-list";

  (node.options || []).forEach(opt => {
    const btn = document.createElement("button");
    btn.className = "choice-btn";

    const main = document.createElement("div");
    main.className = "choice-main";

    const l = document.createElement("div");
    l.className = "choice-title";
    l.textContent = opt.label || opt.id || "选项";
    main.appendChild(l);

    if (opt.desc) {
      const d = document.createElement("div");
      d.className = "choice-desc";
      setSanitizedMarkdown(d, opt.desc);
      main.appendChild(d);
    }


    btn.appendChild(main);

    btn.onclick = () => {
      // update profile if provided
      if (opt.profile) {
        state.profile = Object.assign({}, state.profile, opt.profile);
      }
      goToNode(opt.next || treeConfig.root);
    };

    list.appendChild(btn);
  });

  container.appendChild(list);

  const nav = document.createElement("div");
  nav.className = "nav-row";

  const left = document.createElement("button");
  left.className = "nav-btn";
  left.textContent = "重置选择";
  left.onclick = () => {
    state.history = [];
    state.currentNodeId = treeConfig.root;
    state.profile = {};
    saveState();
    render();
  };

  const right = document.createElement("span");
  nav.appendChild(left);
  nav.appendChild(right);
  container.appendChild(nav);

  return container;
}

// Render a task node (actual tasks list)
function renderTaskNode(nodeRaw) {
  const node = applyOverrides(nodeRaw, state.profile);

  const container = document.createElement("div");
  container.className = "card";

  const header = document.createElement("div");

  const title = document.createElement("h2");
  title.className = "node-title";
  title.textContent = node.title || "任务";
  header.appendChild(title);

  if (node.tags && node.tags.length) {
    const tagsEl = document.createElement("div");
    tagsEl.className = "tags";
    node.tags.forEach(t => {
      const span = document.createElement("span");
      span.className = "tag";
      span.textContent = t;
      tagsEl.appendChild(span);
    });
    header.appendChild(tagsEl);
  }

  container.appendChild(header);

  if (node.subtitle) {
    const sub = document.createElement("div");
    sub.className = "node-subtitle";
    sub.textContent = node.subtitle;
    container.appendChild(sub);
  }

  const stats = computeTaskStats(node, state.completedTasks);

  const progressWrap = document.createElement("div");
  progressWrap.className = "progress-wrap";

  const barBg = document.createElement("div");
  barBg.className = "progress-bar-bg";

  const barFg = document.createElement("div");
  barFg.className = "progress-bar-fg";
  const percent = Math.round(stats.ratio * 100);
  barFg.style.width = percent + "%";
  barBg.appendChild(barFg);

  progressWrap.appendChild(barBg);

  const progressText = document.createElement("div");
  progressText.className = "progress-text";

  let text = `完成 ${stats.done} / ${stats.total} · ${percent}%`;
  if (stats.totalMinutes > 0) {
    text +=
      " · 预计总耗时：" +
      formatMinutes(stats.totalMinutes) +
      " · 已完成：" +
      formatMinutes(stats.doneMinutes);
  }
  progressText.textContent = text;

  progressWrap.appendChild(progressText);

  container.appendChild(progressWrap);

  const list = document.createElement("div");
  list.className = "task-list";

  (node.tasks || []).forEach(t => {
    const item = document.createElement("div");
    item.className = "task-item";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = !!state.completedTasks[t.id];
    checkbox.onchange = () => toggleTask(t.id, checkbox.checked);

    const main = document.createElement("div");
    main.className = "task-main";

    const line1 = document.createElement("div");
    line1.className = "task-title-line";

    const tTitle = document.createElement("span");
    tTitle.className = "task-title";
    tTitle.textContent = t.title || "任务";
    line1.appendChild(tTitle);

    if (t.estimateMinutes) {
      const est = document.createElement("span");
      est.className = "task-estimate";
      est.textContent = "≈ " + formatMinutes(Number(t.estimateMinutes));
      line1.appendChild(est);
    }

    main.appendChild(line1);

    if (t.descMd) {
      const desc = document.createElement("div");
      desc.className = "task-desc";
      main.appendChild(desc);
      loadMdIntoElement(t.descMd, desc);
    } else if (t.desc) {
      const desc = document.createElement("div");
      desc.className = "task-desc";
      setSanitizedMarkdown(desc, t.desc);
      main.appendChild(desc);
    }


    if (t.link) {
      const link = document.createElement("div");
      link.className = "task-link";
      const a = document.createElement("a");
      a.href = t.link;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = t.linkLabel || "查看文档 / 仓库";
      link.appendChild(a);
      main.appendChild(link);
    }

    item.appendChild(checkbox);
    item.appendChild(main);
    list.appendChild(item);
  });

  container.appendChild(list);

  const nav = document.createElement("div");
  nav.className = "nav-row";

  const backBtn = document.createElement("button");
  backBtn.className = "nav-btn";
  backBtn.textContent = "⬅ 返回上一步";
  backBtn.onclick = () => goBack();

  const rightBox = document.createElement("div");

  if (node.nextChoices && node.nextChoices.length > 0) {
    node.nextChoices.forEach(opt => {
      const b = document.createElement("button");
      b.className = "nav-btn";
      b.textContent = "· " + opt.label;
      b.onclick = () => {
        if (opt.profile) {
          state.profile = Object.assign({}, state.profile, opt.profile);
        }
        goToNode(opt.next, true);
      };
      rightBox.appendChild(b);
    });
  } else if (node.next) {
    const nextBtn = document.createElement("button");
    nextBtn.className = "nav-btn";
    nextBtn.textContent = "继续下一节点";
    nextBtn.onclick = () => goToNode(node.next, true);
    rightBox.appendChild(nextBtn);
  } else {
    const doneText = document.createElement("span");
    doneText.textContent = "此路线暂时到达终点";
    rightBox.appendChild(doneText);
  }

  nav.appendChild(backBtn);
  nav.appendChild(rightBox);
  container.appendChild(nav);

  return container;
}

function render() {
  if (!treeConfig || !treeConfig.nodes) return;
  const app = document.getElementById("app");
  if (!app) return;

  app.replaceChildren();

  const currentId = state.currentNodeId || treeConfig.root;
  const nodeRaw = treeConfig.nodes[currentId];
  if (!nodeRaw) {
    const err = document.createElement("div");
    err.textContent = "找不到节点：" + currentId;
    app.appendChild(err);
    return;
  }

  if (nodeRaw.type === "choice") {
    app.appendChild(renderChoiceNode(nodeRaw));
  } else if (nodeRaw.type === "task") {
    app.appendChild(renderTaskNode(nodeRaw));
  }

  const footer = document.createElement("div");
  footer.className = "small-text";

  const btnHome = document.createElement("button");
  btnHome.className = "nav-btn";
  btnHome.textContent = "返回起点（重新选择路线）";
  btnHome.onclick = () => resetToRoot();
  footer.appendChild(btnHome);

  const sep = document.createTextNode("  |  ");
  footer.appendChild(sep);

  const btnClear = document.createElement("button");
  btnClear.className = "nav-btn";
  btnClear.textContent = "清除本地学习记录";
  btnClear.onclick = () => {
    if (window.confirm("确定要清除本设备上的所有学习记录吗？此操作不可恢复。")) {
      clearAllData();
    }
  };
  footer.appendChild(btnClear);

  app.appendChild(footer);
}

document.addEventListener("DOMContentLoaded", () => {
  initThemeToggle();

  loadConfig()
    .then(cfg => {
      treeConfig = cfg;

      const titleEl = document.getElementById("page-title");
      if (titleEl && treeConfig.title) {
        titleEl.textContent = treeConfig.title;
      }
      const subEl = document.getElementById("page-subtitle");
      if (subEl) {
        if (treeConfig.subtitle) {
          subEl.textContent = treeConfig.subtitle;
        } else {
          subEl.textContent = "";
        }
      }

      if (!treeConfig.root) {
        treeConfig.root = Object.keys(treeConfig.nodes || {})[0];
      }

      state = loadState();
      render();
    })
    .catch(err => {
      const errorEl = document.getElementById("app-error");
      errorEl.textContent =
        "加载配置失败，请检查 config.json 及子配置文件是否存在且为合法 JSON。";
      console.error(err);
    });
});
