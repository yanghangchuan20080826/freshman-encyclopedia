(() => {
  "use strict";

  const countdownGate = document.getElementById("countdownGate");
  const siteStage = document.getElementById("siteStage");
  const enterButton = document.getElementById("enterSite");
  const countdownDays = document.getElementById("countdownDays");
  const countdownHours = document.getElementById("countdownHours");
  const countdownMinutes = document.getElementById("countdownMinutes");
  const countdownSeconds = document.getElementById("countdownSeconds");
  const countdownDate = document.getElementById("countdownDate");
  const gateTimer = document.querySelector(".countdown");
  const countdownTarget = new Date("2027-09-01T00:00:00+08:00");

  function updateCountdown() {
    const remaining = Math.max(0, countdownTarget.getTime() - Date.now());
    const totalSeconds = Math.floor(remaining / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    countdownDays.textContent = String(days).padStart(3, "0");
    countdownHours.textContent = String(hours).padStart(2, "0");
    countdownMinutes.textContent = String(minutes).padStart(2, "0");
    countdownSeconds.textContent = String(seconds).padStart(2, "0");
    countdownDate.textContent =
      remaining > 0
        ? "2027年9月1日 00:00"
        : "开学时间已到，欢迎开启大学生活";
    gateTimer.setAttribute(
      "aria-label",
      remaining > 0
        ? `距离2027年9月1日还有${days}天${hours}小时${minutes}分钟`
        : "2027年9月1日开学时间已到",
    );
  }

  updateCountdown();
  window.setInterval(updateCountdown, 1000);

  function enterWebsite(immediate = false) {
    const revealStage = () => {
      siteStage.classList.add("is-entered");
      siteStage.removeAttribute("aria-hidden");
      siteStage.removeAttribute("inert");
    };

    const finish = () => {
      countdownGate.hidden = true;
      document.body.classList.remove("gate-locked");

      const target = window.location.hash
        ? document.getElementById(window.location.hash.slice(1))
        : null;
      if (target) {
        window.requestAnimationFrame(() => {
          target.scrollIntoView({ behavior: "auto", block: "start" });
        });
      } else {
        window.scrollTo({ top: 0, behavior: "auto" });
      }
    };

    if (
      immediate ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      revealStage();
      finish();
      return;
    }

    revealStage();
    countdownGate.classList.add("is-leaving");
    window.setTimeout(finish, 520);
  }

  enterButton.addEventListener("click", () => enterWebsite(false));

  const data = window.FAQ_DATA;
  if (!data || !Array.isArray(data.sections)) {
    document.getElementById("sectionsRoot").textContent = "问答内容载入失败。";
    return;
  }

  const directoryList = document.getElementById("directoryList");
  const sectionsRoot = document.getElementById("sectionsRoot");
  const searchDialog = document.getElementById("searchDialog");
  const searchInput = document.getElementById("searchInput");
  const searchResults = document.getElementById("searchResults");
  const searchStatus = document.getElementById("searchStatus");
  const toTop = document.getElementById("toTop");
  const siteHeader = document.querySelector(".site-header");
  const adminOpen = document.getElementById("adminOpen");
  const adminDialog = document.getElementById("adminDialog");
  const adminClose = document.getElementById("adminClose");
  const adminLoginPanel = document.getElementById("adminLoginPanel");
  const adminSessionPanel = document.getElementById("adminSessionPanel");
  const adminLoginForm = document.getElementById("adminLoginForm");
  const adminPassword = document.getElementById("adminPassword");
  const adminStatus = document.getElementById("adminStatus");
  const adminLogout = document.getElementById("adminLogout");
  const adminTriggerLabel = document.getElementById("adminTriggerLabel");
  const editAnswerDialog = document.getElementById("editAnswerDialog");
  const editAnswerForm = document.getElementById("editAnswerForm");
  const editAnswerContent = document.getElementById("editAnswerContent");
  const editAnswerStatus = document.getElementById("editAnswerStatus");
  const editAnswerClose = document.getElementById("editAnswerClose");
  const editAnswerCancel = document.getElementById("editAnswerCancel");
  const knownAnswers = new Map();
  let adminAuthenticated = false;
  let editingAnswerId = null;

  const symbols = {
    orientation: "入",
    dorm: "舍",
    study: "学",
    campus: "校",
    independence: "独",
    plan: "30",
  };

  const escapeHtml = (value = "") =>
    String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  const allQuestions = data.sections.flatMap((section) =>
    section.questions.map((question) => ({
      ...question,
      sectionTitle: section.title,
      sectionSlug: section.slug,
    })),
  );

  document.getElementById("topicCount").textContent = String(
    data.sections.length + 2,
  ).padStart(2, "0");
  document.getElementById("questionCount").textContent = String(
    allQuestions.length,
  ).padStart(2, "0");

  function countLabel(section) {
    if (section.questions.length > 0) {
      return `${section.questions.length} 个问答`;
    }
    const tableRows = section.tables[0]?.length ?? 0;
    return tableRows > 1 ? `${tableRows - 1} 周行动表` : "专题内容";
  }

  directoryList.innerHTML = data.sections
    .map(
      (section, index) => `
        <a class="directory-link" href="#${escapeHtml(section.slug)}">
          <span class="directory-index">${String(index + 1).padStart(2, "0")}</span>
          <span class="directory-text">
            <strong>${escapeHtml(section.title)}</strong>
            <small>${escapeHtml(countLabel(section))}</small>
          </span>
          <span class="directory-arrow" aria-hidden="true">↘</span>
        </a>
      `,
    )
    .join("");
  directoryList.insertAdjacentHTML(
    "beforeend",
    `
      <a class="directory-link" href="#cycle">
        <span class="directory-index">07</span>
        <span class="directory-text">
          <strong>年度知识共建机制</strong>
          <small>征集 · 解答 · 补充 · 审核 · 迭代</small>
        </span>
        <span class="directory-arrow" aria-hidden="true">↘</span>
      </a>
      <a class="directory-link" href="#campus-map">
        <span class="directory-index">08</span>
        <span class="directory-text">
          <strong>仙林校区平面地图</strong>
          <small>官方地图 · 交通入口</small>
        </span>
        <span class="directory-arrow" aria-hidden="true">↘</span>
      </a>
    `,
  );

  function renderAnswer(answer) {
    if (!answer.trim()) {
      return '<p class="answer-pending">这条内容暂未补充。</p>';
    }
    return answer
      .split(/\n+/)
      .filter(Boolean)
      .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
      .join("");
  }

  function renderQuestions(section) {
    if (!section.questions.length) {
      return "";
    }

    return `
      <div class="faq-list">
        ${section.questions
          .map(
            (question) => `
              <details class="faq-item" id="${escapeHtml(question.id)}" data-question-id="${escapeHtml(question.id)}">
                <summary>
                  <span class="faq-number">${escapeHtml(question.ordinal)}</span>
                  <span class="question-title" role="heading" aria-level="3">${escapeHtml(question.title)}</span>
                  <span class="faq-toggle-icon" aria-hidden="true"></span>
                </summary>
                <div class="answer">
                  <div class="source-answer">${renderAnswer(question.answer)}</div>
                  <section class="community-thread" data-thread-id="${escapeHtml(question.id)}">
                    <div class="community-head">
                      <h4>学长学姐补充回答</h4>
                      <span class="community-count" data-answer-count>展开后加载</span>
                    </div>
                    <p class="community-note">
                      补充内容默认进入待审核区，创建者筛选后公开。具体安排仍以学校官方通知为准。
                    </p>
                    <div class="community-list" data-answer-list>
                      <div class="community-empty">展开这个问题后查看已公开的学长学姐补充。</div>
                    </div>
                    <form class="reply-form" data-answer-form data-question-id="${escapeHtml(question.id)}">
                      <div class="reply-form-top">
                        <label class="field-label">
                          称呼 / 年级专业
                          <input
                            class="text-input"
                            name="authorName"
                            maxlength="24"
                            autocomplete="nickname"
                            placeholder="例：2025级学长"
                          />
                        </label>
                        <span class="field-label">审核通过后公开展示，请勿填写手机号、微信等个人信息。</span>
                      </div>
                      <label class="field-label reply-label">
                        写下你的经验补充
                        <textarea
                          class="text-area"
                          name="content"
                          rows="3"
                          maxlength="1000"
                          placeholder="请补充可核实的经验、适用条件与注意事项，最多 1000 字"
                          required
                        ></textarea>
                      </label>
                      <div class="reply-footer">
                        <p class="reply-status" role="status"></p>
                        <button class="button button-primary reply-submit" type="submit">提交补充</button>
                      </div>
                    </form>
                  </section>
                </div>
              </details>
            `,
          )
          .join("")}
      </div>
    `;
  }

  function renderTable(rows, sectionTitle) {
    if (!rows.length || rows.length < 2) {
      return "";
    }
    const [headers, ...body] = rows;
    return `
      <div class="plan-table-wrap">
        <table class="plan-table">
          <caption>${escapeHtml(sectionTitle)}</caption>
          <thead>
            <tr>${headers.map((header) => `<th scope="col">${escapeHtml(header)}</th>`).join("")}</tr>
          </thead>
          <tbody>
            ${body
              .map(
                (row) =>
                  `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderSection(section, index) {
    const questionTools = section.questions.length
      ? `
        <div class="section-tools">
          <button class="text-button" type="button" data-toggle-section="${escapeHtml(section.slug)}">
            展开全部
          </button>
          <a class="section-back" href="#directory">返回目录</a>
        </div>
      `
      : '<div class="section-tools"><a class="section-back" href="#directory">返回目录</a></div>';

    const tables = section.tables
      .map((rows) => renderTable(rows, section.title))
      .join("");

    const notes = (section.notes ?? []).length
      ? `
        <div class="closing-note">
          <h3>${escapeHtml(section.notes[0])}</h3>
          ${section.notes
            .slice(1)
            .map((note) => `<p>${escapeHtml(note)}</p>`)
            .join("")}
        </div>
      `
      : "";

    return `
      <article class="topic-section" id="${escapeHtml(section.slug)}" data-section="${escapeHtml(section.slug)}">
        <header class="section-heading">
          <div>
            <div class="section-label-row">
              <span class="section-badge" aria-hidden="true">${escapeHtml(symbols[section.slug] ?? String(index + 1).padStart(2, "0"))}</span>
              <span>目录 ${String(index + 1).padStart(2, "0")} · ${escapeHtml(countLabel(section))}</span>
            </div>
            <h2>${escapeHtml(section.title)}</h2>
            <p>${escapeHtml(section.description)}</p>
          </div>
          ${questionTools}
        </header>
        ${renderQuestions(section)}
        ${tables ? `<div class="section-plan">${tables}</div>` : ""}
        ${notes}
      </article>
    `;
  }

  sectionsRoot.innerHTML = data.sections
    .map((section, index) => renderSection(section, index))
    .join("");

  async function apiRequest(path, options = {}) {
    const response = await fetch(path, {
      credentials: "same-origin",
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {}),
      },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || "请求未能完成，请稍后再试。");
    }
    return payload;
  }

  function formatDateTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  function findThread(questionId) {
    return [...document.querySelectorAll(".community-thread")].find(
      (thread) => thread.dataset.threadId === questionId,
    );
  }

  function renderCommunityAnswers(thread, answers) {
    const list = thread.querySelector("[data-answer-list]");
    const count = thread.querySelector("[data-answer-count]");
    thread.dataset.loaded = "true";
    const approvedCount = answers.filter(
      (answer) => answer.status === "approved",
    ).length;
    const pendingCount = answers.length - approvedCount;
    count.textContent = adminAuthenticated
      ? `已公开 ${approvedCount} · 待审核 ${pendingCount}`
      : `${approvedCount} 条已公开补充`;

    if (!answers.length) {
      list.innerHTML = adminAuthenticated
        ? '<div class="community-empty">暂无补充内容，新的提交会先进入待审核区。</div>'
        : '<div class="community-empty">暂无已公开的学长学姐补充，欢迎提交第一条经验。</div>';
      return;
    }

    for (const answer of answers) {
      knownAnswers.set(answer.id, answer);
    }

    list.innerHTML = answers
      .map(
        (answer) => `
          <article class="community-answer" data-answer-id="${escapeHtml(answer.id)}">
            <div class="community-answer-head">
              <div class="community-author">
                <span>${escapeHtml(answer.authorName)}</span>
                ${answer.edited ? '<span class="community-edited">已编辑</span>' : ""}
                ${
                  adminAuthenticated
                    ? `<span class="community-status is-${escapeHtml(answer.status)}">${
                        answer.status === "approved" ? "已公开" : "待审核"
                      }</span>`
                    : ""
                }
              </div>
              <time class="community-time" datetime="${escapeHtml(answer.createdAt)}">
                ${escapeHtml(formatDateTime(answer.createdAt))}
              </time>
            </div>
            <p>${escapeHtml(answer.content)}</p>
            ${
              adminAuthenticated
                ? `
                  <div class="manage-actions">
                    ${
                      answer.status === "approved"
                        ? `<button class="manage-action" type="button" data-set-answer-status="${escapeHtml(answer.id)}" data-next-status="pending">撤回公开</button>`
                        : `<button class="manage-action is-approve" type="button" data-set-answer-status="${escapeHtml(answer.id)}" data-next-status="approved">通过并公开</button>`
                    }
                    <button class="manage-action" type="button" data-edit-answer="${escapeHtml(answer.id)}">编辑内容</button>
                    <button class="manage-action is-danger" type="button" data-delete-answer="${escapeHtml(answer.id)}">删除</button>
                  </div>
                `
                : ""
            }
          </article>
        `,
      )
      .join("");
  }

  async function loadAnswers(questionId, force = false) {
    const thread = findThread(questionId);
    if (!thread) return;
    if (!force && thread.dataset.loaded === "true") return;

    const list = thread.querySelector("[data-answer-list]");
    const count = thread.querySelector("[data-answer-count]");
    count.textContent = "读取中…";
    list.innerHTML =
      '<div class="community-empty">正在读取补充回答，请稍候。</div>';

    try {
      const payload = await apiRequest(
        `/api/answers?questionId=${encodeURIComponent(questionId)}`,
      );
      adminAuthenticated = Boolean(payload.authenticated);
      updateAdminUi();
      renderCommunityAnswers(thread, payload.answers || []);
    } catch (error) {
      thread.dataset.loaded = "false";
      count.textContent = "暂不可用";
      list.innerHTML = `<div class="community-empty">${escapeHtml(
        error.message.includes("fetch")
          ? "回答功能需要启动 Node 服务，当前静态预览无法保存数据。"
          : error.message,
      )}</div>`;
    }
  }

  async function refreshLoadedThreads() {
    const questionIdsToRefresh = [
      ...document.querySelectorAll('.community-thread[data-loaded="true"]'),
    ].map((thread) => thread.dataset.threadId);
    await Promise.all(
      questionIdsToRefresh.map((questionId) => loadAnswers(questionId, true)),
    );
  }

  function updateAdminUi() {
    adminOpen.classList.toggle("is-active", adminAuthenticated);
    adminTriggerLabel.textContent = adminAuthenticated
      ? "管理已登录"
      : "创建者管理";
    adminLoginPanel.hidden = adminAuthenticated;
    adminSessionPanel.hidden = !adminAuthenticated;
  }

  async function checkAdminSession() {
    try {
      const payload = await apiRequest("/api/admin/session");
      adminAuthenticated = Boolean(payload.authenticated);
    } catch {
      adminAuthenticated = false;
    }
    updateAdminUi();
  }

  function updateToggleLabel(sectionElement) {
    const button = sectionElement.querySelector("[data-toggle-section]");
    if (!button) return;
    const items = [...sectionElement.querySelectorAll(".faq-item")];
    const allOpen = items.length > 0 && items.every((item) => item.open);
    button.textContent = allOpen ? "收起全部" : "展开全部";
  }

  sectionsRoot.addEventListener("click", (event) => {
    const button = event.target.closest("[data-toggle-section]");
    if (!button) return;

    const section = button.closest(".topic-section");
    const items = [...section.querySelectorAll(".faq-item")];
    const shouldOpen = !items.every((item) => item.open);
    items.forEach((item) => {
      item.open = shouldOpen;
    });
    updateToggleLabel(section);
  });

  sectionsRoot.addEventListener("toggle", (event) => {
    if (!event.target.matches(".faq-item")) return;
    updateToggleLabel(event.target.closest(".topic-section"));
    if (event.target.open) {
      loadAnswers(event.target.dataset.questionId);
    }
  }, true);

  sectionsRoot.addEventListener("submit", async (event) => {
    const form = event.target.closest("[data-answer-form]");
    if (!form) return;
    event.preventDefault();

    const questionId = form.dataset.questionId;
    const authorName = form.elements.authorName.value.trim();
    const content = form.elements.content.value.trim();
    const status = form.querySelector(".reply-status");
    const submit = form.querySelector('button[type="submit"]');

    if (content.length < 2) {
      status.textContent = "补充内容至少需要 2 个字。";
      status.classList.add("is-error");
      return;
    }

    submit.disabled = true;
    status.classList.remove("is-error");
    status.textContent = "正在提交…";

    try {
      await apiRequest("/api/answers", {
        method: "POST",
        body: JSON.stringify({ questionId, authorName, content }),
      });
      form.reset();
      status.textContent = "补充已提交，创建者审核通过后公开。";
      await loadAnswers(questionId, true);
    } catch (error) {
      status.textContent = error.message;
      status.classList.add("is-error");
    } finally {
      submit.disabled = false;
    }
  });

  sectionsRoot.addEventListener("click", async (event) => {
    const moderationButton = event.target.closest(
      "[data-set-answer-status]",
    );
    if (moderationButton && adminAuthenticated) {
      const answerId = moderationButton.dataset.setAnswerStatus;
      const nextStatus = moderationButton.dataset.nextStatus;
      const thread = moderationButton.closest(".community-thread");
      moderationButton.disabled = true;
      try {
        await apiRequest(`/api/answers/${answerId}`, {
          method: "PATCH",
          body: JSON.stringify({ status: nextStatus }),
        });
        await loadAnswers(thread.dataset.threadId, true);
      } catch (error) {
        window.alert(error.message);
        moderationButton.disabled = false;
      }
      return;
    }

    const editButton = event.target.closest("[data-edit-answer]");
    if (editButton) {
      if (!adminAuthenticated) return;
      const answer = knownAnswers.get(editButton.dataset.editAnswer);
      if (!answer) return;
      editingAnswerId = answer.id;
      editAnswerContent.value = answer.content;
      editAnswerStatus.textContent = "";
      openModal(editAnswerDialog);
      window.setTimeout(() => editAnswerContent.focus(), 30);
      return;
    }

    const deleteButton = event.target.closest("[data-delete-answer]");
    if (!deleteButton || !adminAuthenticated) return;
    const answerId = deleteButton.dataset.deleteAnswer;
    if (!window.confirm("确定删除这条回答吗？删除后无法恢复。")) return;

    deleteButton.disabled = true;
    try {
      const thread = deleteButton.closest(".community-thread");
      await apiRequest(`/api/answers/${answerId}`, { method: "DELETE" });
      knownAnswers.delete(answerId);
      await loadAnswers(thread.dataset.threadId, true);
    } catch (error) {
      window.alert(error.message);
      deleteButton.disabled = false;
    }
  });

  function openModal(dialog) {
    if (typeof dialog.showModal === "function") {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
  }

  function closeModal(dialog) {
    if (typeof dialog.close === "function") {
      dialog.close();
    } else {
      dialog.removeAttribute("open");
    }
  }

  adminOpen.addEventListener("click", () => {
    adminPassword.value = "";
    adminStatus.textContent = "";
    updateAdminUi();
    openModal(adminDialog);
  });
  adminClose.addEventListener("click", () => closeModal(adminDialog));

  adminLoginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = adminLoginForm.querySelector('button[type="submit"]');
    submit.disabled = true;
    adminStatus.textContent = "正在验证…";

    try {
      await apiRequest("/api/admin/login", {
        method: "POST",
        body: JSON.stringify({ password: adminPassword.value }),
      });
      adminAuthenticated = true;
      adminPassword.value = "";
      adminStatus.textContent = "";
      updateAdminUi();
      await refreshLoadedThreads();
    } catch (error) {
      adminStatus.textContent = error.message;
    } finally {
      submit.disabled = false;
    }
  });

  adminLogout.addEventListener("click", async () => {
    adminLogout.disabled = true;
    try {
      await apiRequest("/api/admin/logout", { method: "POST" });
      adminAuthenticated = false;
      updateAdminUi();
      await refreshLoadedThreads();
      closeModal(adminDialog);
    } catch (error) {
      adminStatus.textContent = error.message;
    } finally {
      adminLogout.disabled = false;
    }
  });

  editAnswerClose.addEventListener("click", () => closeModal(editAnswerDialog));
  editAnswerCancel.addEventListener("click", () => closeModal(editAnswerDialog));
  editAnswerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!editingAnswerId || !adminAuthenticated) return;
    const submit = editAnswerForm.querySelector('button[type="submit"]');
    const content = editAnswerContent.value.trim();
    editAnswerStatus.textContent = "";

    if (content.length < 2) {
      editAnswerStatus.textContent = "回答至少需要 2 个字。";
      return;
    }

    submit.disabled = true;
    try {
      await apiRequest(`/api/answers/${editingAnswerId}`, {
        method: "PUT",
        body: JSON.stringify({ content }),
      });
      closeModal(editAnswerDialog);
      await refreshLoadedThreads();
    } catch (error) {
      editAnswerStatus.textContent = error.message;
    } finally {
      submit.disabled = false;
    }
  });

  for (const dialog of [adminDialog, editAnswerDialog]) {
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) closeModal(dialog);
    });
  }

  function scrollToTarget(target) {
    target.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "start",
    });
    target.classList.remove("target-flash");
    window.requestAnimationFrame(() => {
      target.classList.add("target-flash");
      window.setTimeout(() => target.classList.remove("target-flash"), 1200);
    });
  }

  function openQuestion(id) {
    const item = document.getElementById(id);
    if (!item) return;
    item.open = true;
    scrollToTarget(item);
    item.querySelector("summary")?.focus({ preventScroll: true });
    history.replaceState(null, "", `#${id}`);
  }

  function markMatch(text, query) {
    const safeText = escapeHtml(text);
    if (!query) return safeText;
    const escapedQuery = escapeHtml(query);
    const index = safeText.toLocaleLowerCase("zh-CN").indexOf(
      escapedQuery.toLocaleLowerCase("zh-CN"),
    );
    if (index < 0) return safeText;
    return (
      safeText.slice(0, index) +
      "<mark>" +
      safeText.slice(index, index + escapedQuery.length) +
      "</mark>" +
      safeText.slice(index + escapedQuery.length)
    );
  }

  function snippetFor(question, query) {
    const normalizedQuery = query.toLocaleLowerCase("zh-CN");
    const index = question.answer.toLocaleLowerCase("zh-CN").indexOf(normalizedQuery);
    if (index < 0) {
      return question.answer.slice(0, 62);
    }
    const start = Math.max(0, index - 20);
    return `${start > 0 ? "…" : ""}${question.answer.slice(start, start + 78)}${
      start + 78 < question.answer.length ? "…" : ""
    }`;
  }

  function renderSuggestions() {
    const suggestions = ["报到", "宿舍", "选课", "校园网", "生活费"];
    searchResults.innerHTML = `
      <div class="search-suggestions">
        ${suggestions
          .map(
            (suggestion) =>
              `<button class="suggestion" type="button" data-search-suggestion="${suggestion}">${suggestion}</button>`,
          )
          .join("")}
      </div>
    `;
  }

  function renderSearch(query) {
    const normalized = query.trim();
    if (!normalized) {
      searchStatus.textContent = "输入关键词，检索全部问答。";
      renderSuggestions();
      return;
    }

    const lowerQuery = normalized.toLocaleLowerCase("zh-CN");
    const matches = allQuestions.filter((question) =>
      `${question.title} ${question.answer}`
        .toLocaleLowerCase("zh-CN")
        .includes(lowerQuery),
    );

    searchStatus.textContent =
      matches.length > 0
        ? `找到 ${matches.length} 条相关内容。`
        : "没有找到相关内容，换一个关键词试试。";

    if (!matches.length) {
      searchResults.innerHTML =
        '<div class="search-empty">暂未找到相关问答。</div>';
      return;
    }

    searchResults.innerHTML = matches
      .map(
        (question) => `
          <button class="search-result" type="button" data-open-question="${escapeHtml(question.id)}">
            <span class="search-result-number">${escapeHtml(question.ordinal)}</span>
            <span>
              <strong>${markMatch(question.title, normalized)}</strong>
              <small>${markMatch(snippetFor(question, normalized), normalized)}</small>
            </span>
          </button>
        `,
      )
      .join("");
  }

  function openSearch() {
    if (typeof searchDialog.showModal === "function") {
      if (!searchDialog.open) searchDialog.showModal();
    } else {
      searchDialog.setAttribute("open", "");
    }
    searchInput.value = "";
    renderSearch("");
    window.setTimeout(() => searchInput.focus(), 20);
  }

  function closeSearch() {
    if (typeof searchDialog.close === "function") {
      searchDialog.close();
    } else {
      searchDialog.removeAttribute("open");
    }
  }

  document.getElementById("searchOpen").addEventListener("click", openSearch);
  document.getElementById("heroSearch").addEventListener("click", openSearch);
  document.getElementById("searchClose").addEventListener("click", closeSearch);
  searchInput.addEventListener("input", () => renderSearch(searchInput.value));

  searchDialog.addEventListener("click", (event) => {
    if (event.target === searchDialog) closeSearch();
  });

  searchResults.addEventListener("click", (event) => {
    const suggestion = event.target.closest("[data-search-suggestion]");
    if (suggestion) {
      searchInput.value = suggestion.dataset.searchSuggestion;
      renderSearch(searchInput.value);
      searchInput.focus();
      return;
    }

    const result = event.target.closest("[data-open-question]");
    if (!result) return;
    const id = result.dataset.openQuestion;
    closeSearch();
    window.setTimeout(() => openQuestion(id), 40);
  });

  document.addEventListener("keydown", (event) => {
    const searchShortcut =
      (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
    const slashShortcut =
      event.key === "/" &&
      !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName);

    if (searchShortcut || slashShortcut) {
      event.preventDefault();
      openSearch();
    }
  });

  function syncHeaderAndTopButton() {
    siteHeader.classList.toggle("is-scrolled", window.scrollY > 8);
    toTop.classList.toggle("is-visible", window.scrollY > 720);
  }

  window.addEventListener("scroll", syncHeaderAndTopButton, { passive: true });
  toTop.addEventListener("click", () => {
    window.scrollTo({
      top: 0,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  });

  window.addEventListener("hashchange", () => {
    const id = window.location.hash.slice(1);
    const item = document.getElementById(id);
    if (item?.matches(".faq-item")) {
      item.open = true;
    }
  });

  const initialHash = window.location.hash.slice(1);
  if (initialHash) {
    const target = document.getElementById(initialHash);
    if (target?.matches(".faq-item")) {
      target.open = true;
    }
    if (target) {
      window.requestAnimationFrame(() => {
        target.scrollIntoView({ behavior: "auto", block: "start" });
      });
    }
  }

  checkAdminSession();
  syncHeaderAndTopButton();
})();
