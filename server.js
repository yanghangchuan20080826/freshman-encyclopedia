import { createServer } from "node:http";
import {
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { mkdirSync, readFileSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";
import { DatabaseSync } from "node:sqlite";
import vm from "node:vm";

const ROOT = resolve(import.meta.dirname);
const ASSETS_DIR = join(ROOT, "assets");
const DATA_DIR = join(ROOT, "data");
const DB_PATH = process.env.DB_PATH || join(DATA_DIR, "community.sqlite");
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const SESSION_SECRET =
  process.env.SESSION_SECRET || randomBytes(32).toString("base64url");
const SESSION_COOKIE = "freshman_admin";
const SESSION_TTL_SECONDS = 8 * 60 * 60;
const TRUST_PROXY = process.env.TRUST_PROXY === "true";

mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA busy_timeout = 5000;

  CREATE TABLE IF NOT EXISTS answers (
    id TEXT PRIMARY KEY,
    question_id TEXT NOT NULL,
    author_name TEXT NOT NULL,
    content TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'approved',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_answers_question_created
  ON answers(question_id, created_at);
`);

const answerColumns = db.prepare("PRAGMA table_info(answers)").all();
if (!answerColumns.some((column) => column.name === "status")) {
  db.exec(
    "ALTER TABLE answers ADD COLUMN status TEXT NOT NULL DEFAULT 'approved'",
  );
}

const listAnswers = db.prepare(`
  SELECT id, question_id, author_name, content, status, created_at, updated_at
  FROM answers
  WHERE question_id = ?
  ORDER BY created_at ASC
`);
const listApprovedAnswers = db.prepare(`
  SELECT id, question_id, author_name, content, status, created_at, updated_at
  FROM answers
  WHERE question_id = ? AND status = 'approved'
  ORDER BY created_at ASC
`);
const insertAnswer = db.prepare(`
  INSERT INTO answers (
    id, question_id, author_name, content, status, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?)
`);
const getAnswer = db.prepare(`
  SELECT id, question_id, author_name, content, status, created_at, updated_at
  FROM answers
  WHERE id = ?
`);
const updateAnswer = db.prepare(`
  UPDATE answers
  SET content = ?, updated_at = ?
  WHERE id = ?
`);
const updateAnswerStatus = db.prepare(`
  UPDATE answers
  SET status = ?
  WHERE id = ?
`);
const deleteAnswer = db.prepare("DELETE FROM answers WHERE id = ?");

function loadQuestionIds() {
  const source = readFileSync(join(ROOT, "data.js"), "utf8");
  const sandbox = { window: {} };
  vm.runInNewContext(source, sandbox, {
    filename: "data.js",
    timeout: 1000,
  });
  const ids = new Set();
  for (const section of sandbox.window.FAQ_DATA?.sections ?? []) {
    for (const question of section.questions ?? []) {
      ids.add(question.id);
    }
  }
  return ids;
}

const questionIds = loadQuestionIds();

const loginAttempts = new Map();
const postAttempts = new Map();

function clientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (TRUST_PROXY && typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  return req.socket.remoteAddress || "unknown";
}

function checkRateLimit(store, key, limit, windowMs) {
  const now = Date.now();
  const current = store.get(key);
  if (!current || now - current.startedAt >= windowMs) {
    store.set(key, { count: 1, startedAt: now });
    return true;
  }
  if (current.count >= limit) {
    return false;
  }
  current.count += 1;
  return true;
}

function constantTimeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function signSession(payload) {
  const signature = createHmac("sha256", SESSION_SECRET)
    .update(payload)
    .digest("base64url");
  return `${payload}.${signature}`;
}

function createSessionToken() {
  const payload = Buffer.from(
    JSON.stringify({
      role: "admin",
      exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
      nonce: randomBytes(8).toString("base64url"),
    }),
  ).toString("base64url");
  return signSession(payload);
}

function verifySessionToken(token) {
  if (!token) return false;
  const separator = token.lastIndexOf(".");
  if (separator < 1) return false;

  const payload = token.slice(0, separator);
  const suppliedSignature = token.slice(separator + 1);
  const expectedSignature = createHmac("sha256", SESSION_SECRET)
    .update(payload)
    .digest("base64url");
  if (!constantTimeEqual(suppliedSignature, expectedSignature)) return false;

  try {
    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    );
    return parsed.role === "admin" && parsed.exp > Date.now() / 1000;
  } catch {
    return false;
  }
}

function parseCookies(req) {
  const cookies = {};
  for (const chunk of String(req.headers.cookie || "").split(";")) {
    const separator = chunk.indexOf("=");
    if (separator < 0) continue;
    const key = chunk.slice(0, separator).trim();
    const value = chunk.slice(separator + 1).trim();
    if (key) cookies[key] = decodeURIComponent(value);
  }
  return cookies;
}

function isAdminRequest(req) {
  return verifySessionToken(parseCookies(req)[SESSION_COOKIE]);
}

function requestHost(req) {
  if (TRUST_PROXY) {
    const forwardedHost = req.headers["x-forwarded-host"];
    if (typeof forwardedHost === "string" && forwardedHost.trim()) {
      return forwardedHost.split(",")[0].trim();
    }
  }
  return req.headers.host;
}

function isSameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host === requestHost(req);
  } catch {
    return false;
  }
}

function sessionCookie(req) {
  const secure =
    process.env.NODE_ENV === "production" ||
    req.headers["x-forwarded-proto"] === "https";
  return [
    `${SESSION_COOKIE}=${encodeURIComponent(createSessionToken())}`,
    "HttpOnly",
    "SameSite=Strict",
    "Path=/",
    `Max-Age=${SESSION_TTL_SECONDS}`,
    secure ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

function clearSessionCookie() {
  return [
    `${SESSION_COOKIE}=`,
    "HttpOnly",
    "SameSite=Strict",
    "Path=/",
    "Max-Age=0",
  ].join("; ");
}

function securityHeaders(contentType) {
  return {
    "Content-Type": contentType,
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "same-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Content-Security-Policy":
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  };
}

function sendJson(res, status, payload, extraHeaders = {}) {
  res.writeHead(status, {
    ...securityHeaders("application/json; charset=utf-8"),
    "Cache-Control": "no-store",
    ...extraHeaders,
  });
  res.end(JSON.stringify(payload));
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 64 * 1024) {
      throw new Error("REQUEST_TOO_LARGE");
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Error("INVALID_JSON");
  }
}

function cleanText(value, maxLength) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\r\n/g, "\n")
    .trim()
    .slice(0, maxLength);
}

function serializeAnswer(row, admin) {
  return {
    id: row.id,
    questionId: row.question_id,
    authorName: row.author_name,
    content: row.content,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    edited: row.updated_at !== row.created_at,
    canManage: admin,
  };
}

async function handleApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/health") {
    sendJson(res, 200, { status: "ok" });
    return;
  }

  if (!isSameOrigin(req)) {
    sendJson(res, 403, { error: "请求来源无效。" });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/answers") {
    const questionId = cleanText(url.searchParams.get("questionId"), 80);
    if (!questionIds.has(questionId)) {
      sendJson(res, 404, { error: "没有找到对应的问题。" });
      return;
    }
    const admin = isAdminRequest(req);
    const answerRows = admin
      ? listAnswers.all(questionId)
      : listApprovedAnswers.all(questionId);
    const answers = answerRows.map((row) => {
      const serialized = serializeAnswer(row, admin);
      if (!admin) {
        delete serialized.canManage;
      }
      return serialized;
    });
    sendJson(res, 200, { answers, authenticated: admin });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/answers") {
    if (
      !checkRateLimit(
        postAttempts,
        clientIp(req),
        8,
        10 * 60 * 1000,
      )
    ) {
      sendJson(res, 429, { error: "提交太频繁，请稍后再试。" });
      return;
    }

    let body;
    try {
      body = await readJson(req);
    } catch (error) {
      sendJson(res, 400, {
        error:
          error.message === "REQUEST_TOO_LARGE"
            ? "提交内容过长。"
            : "提交格式无效。",
      });
      return;
    }

    const questionId = cleanText(body.questionId, 80);
    const authorName = cleanText(body.authorName, 24) || "匿名同学";
    const content = cleanText(body.content, 1000);

    if (!questionIds.has(questionId)) {
      sendJson(res, 404, { error: "没有找到对应的问题。" });
      return;
    }
    if (content.length < 2) {
      sendJson(res, 400, { error: "回答至少需要 2 个字。" });
      return;
    }

    const now = new Date().toISOString();
    const row = {
      id: randomUUID(),
      question_id: questionId,
      author_name: authorName,
      content,
      status: "pending",
      created_at: now,
      updated_at: now,
    };
    insertAnswer.run(
      row.id,
      row.question_id,
      row.author_name,
      row.content,
      row.status,
      row.created_at,
      row.updated_at,
    );
    sendJson(res, 201, {
      answer: serializeAnswer(row, isAdminRequest(req)),
    });
    return;
  }

  const answerMatch = url.pathname.match(/^\/api\/answers\/([0-9a-f-]+)$/i);
  if (answerMatch) {
    const admin = isAdminRequest(req);
    if (!admin) {
      sendJson(res, 401, { error: "请先登录创建者管理模式。" });
      return;
    }

    const answer = getAnswer.get(answerMatch[1]);
    if (!answer) {
      sendJson(res, 404, { error: "这条回答不存在或已被删除。" });
      return;
    }

    if (req.method === "PUT") {
      let body;
      try {
        body = await readJson(req);
      } catch {
        sendJson(res, 400, { error: "提交格式无效。" });
        return;
      }
      const content = cleanText(body.content, 1000);
      if (content.length < 2) {
        sendJson(res, 400, { error: "回答至少需要 2 个字。" });
        return;
      }
      const updatedAt = new Date().toISOString();
      updateAnswer.run(content, updatedAt, answer.id);
      const updated = getAnswer.get(answer.id);
      sendJson(res, 200, {
        answer: serializeAnswer(updated, true),
      });
      return;
    }

    if (req.method === "PATCH") {
      let body;
      try {
        body = await readJson(req);
      } catch {
        sendJson(res, 400, { error: "提交格式无效。" });
        return;
      }
      const status = cleanText(body.status, 20);
      if (!["approved", "pending"].includes(status)) {
        sendJson(res, 400, { error: "回答状态无效。" });
        return;
      }
      updateAnswerStatus.run(status, answer.id);
      const updated = getAnswer.get(answer.id);
      sendJson(res, 200, {
        answer: serializeAnswer(updated, true),
      });
      return;
    }

    if (req.method === "DELETE") {
      deleteAnswer.run(answer.id);
      sendJson(res, 200, { deleted: true });
      return;
    }
  }

  if (req.method === "POST" && url.pathname === "/api/admin/login") {
    if (!ADMIN_PASSWORD) {
      sendJson(res, 503, {
        error: "管理员密码尚未配置，请设置 ADMIN_PASSWORD 环境变量。",
      });
      return;
    }
    if (
      !checkRateLimit(
        loginAttempts,
        clientIp(req),
        5,
        15 * 60 * 1000,
      )
    ) {
      sendJson(res, 429, { error: "尝试次数过多，请稍后再试。" });
      return;
    }

    let body;
    try {
      body = await readJson(req);
    } catch {
      sendJson(res, 400, { error: "提交格式无效。" });
      return;
    }

    if (!constantTimeEqual(body.password, ADMIN_PASSWORD)) {
      sendJson(res, 401, { error: "管理密码不正确。" });
      return;
    }

    sendJson(
      res,
      200,
      { authenticated: true },
      { "Set-Cookie": sessionCookie(req) },
    );
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/admin/logout") {
    sendJson(
      res,
      200,
      { authenticated: false },
      { "Set-Cookie": clearSessionCookie() },
    );
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/admin/session") {
    sendJson(res, 200, { authenticated: isAdminRequest(req) });
    return;
  }

  sendJson(res, 404, { error: "接口不存在。" });
}

async function serveStatic(req, res, url) {
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    res.writeHead(400);
    res.end("Bad request");
    return;
  }

  if (pathname === "/") pathname = "/index.html";
  const allowedTopLevel = new Set([
    "/index.html",
    "/styles.css",
    "/app.js",
    "/data.js",
  ]);
  let filePath;
  if (allowedTopLevel.has(pathname)) {
    filePath = join(ROOT, pathname);
  } else if (pathname.startsWith("/assets/")) {
    filePath = resolve(ROOT, `.${normalize(pathname)}`);
    if (!filePath.startsWith(`${ASSETS_DIR}${sep}`)) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
  } else {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  try {
    const stats = statSync(filePath);
    if (!stats.isFile()) throw new Error("Not a file");
    const content = await readFile(filePath);
    const extension = extname(filePath).toLowerCase();
    const types = {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".webp": "image/webp",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".svg": "image/svg+xml",
    };
    if (!types[extension]) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, {
      ...securityHeaders(types[extension]),
      "Cache-Control":
        extension === ".html" ? "no-cache" : "public, max-age=3600",
      "Content-Length": content.length,
    });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405);
      res.end("Method not allowed");
      return;
    }
    await serveStatic(req, res, url);
  } catch (error) {
    console.error(error);
    if (!res.headersSent) {
      sendJson(res, 500, { error: "服务器暂时无法处理请求。" });
    } else {
      res.end();
    }
  }
});

server.listen(PORT, HOST, () => {
  console.log(`新生百科网站已启动：http://localhost:${PORT}`);
  if (!ADMIN_PASSWORD) {
    console.warn("尚未设置 ADMIN_PASSWORD，创建者管理登录当前不可用。");
  }
  if (!process.env.SESSION_SECRET) {
    console.warn(
      "尚未设置 SESSION_SECRET，当前会话密钥仅在本次服务运行期间有效。",
    );
  }
});

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
