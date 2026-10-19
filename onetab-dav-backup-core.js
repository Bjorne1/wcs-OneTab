// OneTab WebDAV backup core.
// Runs inside the background service worker (loaded via importScripts from the
// concatenated background bundle, which exposes the internal core helpers on
// globalThis.__otDavCore).

(() => {
  const core = globalThis.__otDavCore;
  if (!core) {
    console.error("dav backup: core helpers are not available");
    return;
  }

  const { A, l, Jl, _l, zl, We, kr, Cr, Aa, Da, ae, Kl, Ka, qt } = core;

  const SETTINGS_KEY = "davBackupSettings";
  const ALARM_NAME = "davBackupAuto";
  const REMOTE_FILE_PATTERN = /^onetab-\d{8}-\d{6}(?:-[0-9a-f]{4})?\.json(?:\.gz)?$/;

  const NUTSTORE_URL = "https://dav.jianguoyun.com/dav/";

  const DEFAULT_SETTINGS = {
    provider: "nutstore",
    url: NUTSTORE_URL,
    username: "",
    password: "",
    remoteDir: "OneTab",
    autoBackup: false,
    intervalMinutes: 60,
    keepCount: 8,
    lastBackupAt: null,
    lastBackupFile: null,
    lastBackupItems: null,
    lastBackupBytes: null,
    lastError: null,
  };

  // ---------------------------------------------------------------------------
  // Settings
  // ---------------------------------------------------------------------------

  function clampInteger(value, fallback, min, max) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
  }

  function normalizeRemoteDir(value) {
    const segments = String(value ?? "")
      .split("/")
      .map((segment) => segment.trim())
      .filter(Boolean);
    if (segments.some((segment) => segment === "." || segment === "..")) {
      throw new Error("远程目录不能包含 . 或 ..");
    }
    return segments.join("/");
  }

  function normalizeSettings(input) {
    const settings = { ...DEFAULT_SETTINGS, ...(input ?? {}) };
    settings.provider = settings.provider === "custom" ? "custom" : "nutstore";
    settings.url = String(settings.url ?? "").trim();
    settings.username = String(settings.username ?? "").trim();
    settings.password = String(settings.password ?? "");
    settings.remoteDir = normalizeRemoteDir(settings.remoteDir);
    settings.autoBackup = settings.autoBackup === true || settings.autoBackup === "true";
    settings.intervalMinutes = clampInteger(settings.intervalMinutes, 60, 15, 10080);
    settings.keepCount = clampInteger(settings.keepCount, 8, 1, 60);

    if (!settings.url) throw new Error("请填写 WebDAV 服务器地址");
    let parsedUrl;
    try {
      parsedUrl = new URL(settings.url);
    } catch {
      throw new Error("WebDAV 服务器地址无效");
    }
    if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
      throw new Error("WebDAV 服务器地址必须以 https:// 或 http:// 开头");
    }
    if (!settings.username) throw new Error("请填写账号");
    if (!settings.password) throw new Error("请填写应用密码");

    // Keep the query/fragment out of stored config; the base must be a directory.
    settings.url = `${parsedUrl.origin}${parsedUrl.pathname}`;
    if (!settings.url.endsWith("/")) settings.url += "/";
    return settings;
  }

  async function loadSettings() {
    const stored = await chrome.storage.local.get(SETTINGS_KEY);
    return { ...DEFAULT_SETTINGS, ...(stored[SETTINGS_KEY] ?? {}) };
  }

  async function storeSettings(settings) {
    await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
  }

  function isConfigured(settings) {
    return Boolean(settings.url && settings.username && settings.password);
  }

  // ---------------------------------------------------------------------------
  // Small helpers
  // ---------------------------------------------------------------------------

  function encodeBasicAuth(username, password) {
    const bytes = new TextEncoder().encode(`${username}:${password}`);
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return `Basic ${btoa(binary)}`;
  }

  function encodePath(path) {
    return path
      .split("/")
      .filter(Boolean)
      .map((segment) => encodeURIComponent(segment))
      .join("/");
  }

  function directoryUrl(settings) {
    const base = settings.url.endsWith("/") ? settings.url : `${settings.url}/`;
    const dir = encodePath(settings.remoteDir);
    return dir ? `${base}${dir}/` : base;
  }

  function formatStamp(date = new Date()) {
    const pad = (value) => String(value).padStart(2, "0");
    return (
      `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
      `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
    );
  }

  function describeHttpFailure(status, action) {
    switch (status) {
      case 401:
        return "认证失败（401）：账号或应用密码不正确";
      case 403:
        return "没有权限（403）：请检查账号权限或目录访问权限";
      case 404:
        return "路径不存在（404）：请检查服务器地址";
      case 405:
        return "服务器不支持该操作（405）";
      case 409:
        return "父目录不存在（409）";
      case 423:
        return "文件被锁定（423），请稍后重试";
      case 507:
        return "服务器存储空间不足（507）";
      default:
        return `${action}失败（HTTP ${status}）`;
    }
  }

  async function davFetch(settings, method, url, { headers = {}, body, depth } = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);
    const requestHeaders = {
      Authorization: encodeBasicAuth(settings.username, settings.password),
      ...headers,
    };
    if (depth !== undefined) requestHeaders.Depth = String(depth);
    try {
      return await fetch(url, {
        method,
        headers: requestHeaders,
        body,
        redirect: "follow",
        signal: controller.signal,
      });
    } catch (error) {
      if (error?.name === "AbortError") throw new Error("连接超时，请检查网络或服务器地址");
      throw new Error(`无法连接 WebDAV 服务器：${error?.message ?? error}`);
    } finally {
      clearTimeout(timeout);
    }
  }

  async function ensureRemoteDirectory(settings) {
    if (!settings.remoteDir) return;
    const base = settings.url.endsWith("/") ? settings.url : `${settings.url}/`;
    const segments = settings.remoteDir.split("/").filter(Boolean);
    let current = base;
    for (const segment of segments) {
      current += `${encodeURIComponent(segment)}/`;
      const response = await davFetch(settings, "MKCOL", current);
      if (response.status === 201 || response.status === 200) continue;
      if (response.status === 405 || response.status === 301 || response.status === 302) continue;
      throw new Error(describeHttpFailure(response.status, "创建远程目录"));
    }
  }

  // ---------------------------------------------------------------------------
  // WebDAV operations
  // ---------------------------------------------------------------------------

  const PROPFIND_BODY = `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:">
  <d:prop>
    <d:displayname/>
    <d:getcontentlength/>
    <d:getlastmodified/>
    <d:resourcetype/>
  </d:prop>
</d:propfind>`;

  function decodeXmlEntities(value) {
    return value
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, "&");
  }

  function extractTag(block, tag) {
    const match = block.match(new RegExp(`<[^>]*:?${tag}\\b[^>]*>([\\s\\S]*?)</[^>]*:?${tag}>`, "i"));
    return match ? decodeXmlEntities(match[1].trim()) : null;
  }

  function parseMultistatus(xml) {
    const entries = [];
    const responseBlocks = xml.split(/<[^>]*:?response\b[^>]*>/i).slice(1);
    for (const block of responseBlocks) {
      const href = extractTag(block, "href");
      if (!href) continue;
      let pathname;
      try {
        pathname = new URL(href, "https://placeholder.invalid/").pathname;
      } catch {
        pathname = href;
      }
      const rawName = pathname.split("/").filter(Boolean).pop() ?? "";
      let name = rawName;
      try {
        name = decodeURIComponent(rawName);
      } catch {
        console.log("dav backup: cannot decode href segment", rawName);
      }
      const isCollection = /<[^>]*:?resourcetype\b[^>]*>[\s\S]*?<[^>]*:?collection\b/i.test(block);
      const size = Number.parseInt(extractTag(block, "getcontentlength") ?? "", 10);
      const lastModified = extractTag(block, "getlastmodified");
      entries.push({
        name,
        isCollection,
        bytes: Number.isFinite(size) ? size : null,
        modifiedAt: lastModified ? Date.parse(lastModified) || null : null,
      });
    }
    return entries;
  }

  async function listRemoteBackups(settings) {
    const response = await davFetch(settings, "PROPFIND", directoryUrl(settings), {
      headers: { "Content-Type": "application/xml; charset=utf-8" },
      body: PROPFIND_BODY,
      depth: 1,
    });
    if (response.status === 404) return [];
    if (response.status !== 207) throw new Error(describeHttpFailure(response.status, "读取云端文件列表"));
    const xml = await response.text();
    return parseMultistatus(xml)
      .filter((entry) => !entry.isCollection && REMOTE_FILE_PATTERN.test(entry.name))
      .sort((a, b) => (b.modifiedAt ?? 0) - (a.modifiedAt ?? 0) || b.name.localeCompare(a.name));
  }

  async function putRemoteFile(settings, name, bytes) {
    const response = await davFetch(settings, "PUT", `${directoryUrl(settings)}${encodeURIComponent(name)}`, {
      headers: { "Content-Type": "application/gzip" },
      body: bytes,
    });
    if (![200, 201, 204].includes(response.status)) {
      throw new Error(describeHttpFailure(response.status, "上传备份"));
    }
  }

  async function deleteRemoteFile(settings, name) {
    const response = await davFetch(settings, "DELETE", `${directoryUrl(settings)}${encodeURIComponent(name)}`);
    if (![200, 202, 204, 404].includes(response.status)) {
      throw new Error(describeHttpFailure(response.status, "删除备份"));
    }
  }

  async function downloadRemoteFile(settings, name) {
    const response = await davFetch(settings, "GET", `${directoryUrl(settings)}${encodeURIComponent(name)}`);
    if (response.status !== 200) throw new Error(describeHttpFailure(response.status, "下载备份"));
    const buffer = new Uint8Array(await response.arrayBuffer());
    if (buffer.length === 0) throw new Error("备份文件为空");
    if (buffer[0] === 0x1f && buffer[1] === 0x8b) return new Uint8Array(await qt(buffer));
    return buffer;
  }

  async function pruneRemoteBackups(settings) {
    const files = await listRemoteBackups(settings);
    if (files.length <= settings.keepCount) return;
    for (const file of files.slice(settings.keepCount)) {
      await deleteRemoteFile(settings, file.name);
    }
  }

  function assertSafeRemoteName(name) {
    if (typeof name !== "string" || !REMOTE_FILE_PATTERN.test(name)) {
      throw new Error("备份文件名无效");
    }
  }

  // ---------------------------------------------------------------------------
  // Snapshot export / restore (same document format as OneTab's local backup)
  // ---------------------------------------------------------------------------

  async function exportSnapshot() {
    return await ae(() =>
      Da(async () => {
        const info = await Aa();
        let dbId = info.TI;
        if (!dbId) dbId = crypto.randomUUID();
        const attrs = await kr(Cr());
        const items = await l.query({ Qe: "item" }, (store) => store.getAll());
        return {
          v: 1,
          date: Date.now(),
          dbId,
          installId: info.uy ?? null,
          installDate: info.Ny ?? null,
          attrs,
          items,
        };
      }),
    );
  }

  function validateSnapshot(doc) {
    if (!doc || typeof doc !== "object") throw new Error("备份内容无法解析");
    if (doc.v !== 1) throw new Error(`不支持的备份版本：${String(doc.v)}`);
    if (!Array.isArray(doc.items)) throw new Error("备份缺少条目数据");
    if (doc.items.length > 200000) throw new Error("备份条目数量异常");
    for (const item of doc.items) {
      if (!item || typeof item !== "object" || Array.isArray(item) || typeof item.id !== "string") {
        throw new Error("备份中存在损坏的条目");
      }
    }
    if (doc.attrs !== undefined && (typeof doc.attrs !== "object" || doc.attrs === null || Array.isArray(doc.attrs))) {
      throw new Error("备份属性格式无效");
    }
  }

  async function restoreSnapshot(doc) {
    validateSnapshot(doc);
    const startedAt = Date.now();
    const attrs = { ...(doc.attrs ?? {}) };
    // Keep this device's identity and install dates; only content crosses devices.
    delete attrs.installId;
    delete attrs.installDate;
    const meta = {
      ...doc,
      dbId: typeof doc.dbId === "string" && doc.dbId ? doc.dbId : crypto.randomUUID(),
      installId: null,
      installDate: null,
    };
    return await Da(() =>
      ae(async () => {
        await Jl(doc.items);
        await _l(attrs);
        await We(false, "davBackupRestore");
        await zl(meta, attrs);
        // Refresh open OneTab pages after the RPC response has been delivered.
        setTimeout(() => {
          Promise.resolve(Kl()).catch((error) => console.log("dav backup: reload failed", error));
        }, 1500);
        return {
          restored: true,
          itemCount: doc.items.length,
          backupDate: doc.date ?? null,
          durationMs: Date.now() - startedAt,
        };
      }),
    );
  }

  // ---------------------------------------------------------------------------
  // Backup run / scheduling
  // ---------------------------------------------------------------------------

  async function scheduleAutoBackup() {
    const settings = await loadSettings();
    const existing = await chrome.alarms.get(ALARM_NAME);
    if (!settings.autoBackup || !isConfigured(settings)) {
      if (existing) await chrome.alarms.clear(ALARM_NAME);
      return;
    }
    // The service worker restarts often; never reset an alarm that is already
    // running with the same interval, or automatic backups would drift.
    if (existing && existing.periodInMinutes === settings.intervalMinutes) return;
    if (existing) await chrome.alarms.clear(ALARM_NAME);
    chrome.alarms.create(ALARM_NAME, {
      periodInMinutes: settings.intervalMinutes,
      delayInMinutes: Math.min(settings.intervalMinutes, 5),
    });
  }

  async function runBackup(trigger) {
    const settings = await loadSettings();
    if (!isConfigured(settings)) throw new Error("请先配置 WebDAV 账号");
    const doc = await exportSnapshot();
    const json = JSON.stringify(doc);
    const gzipped = await Ka(new TextEncoder().encode(json));
    const suffix = Math.random().toString(16).slice(2, 6).padEnd(4, "0");
    const name = `onetab-${formatStamp()}-${suffix}.json.gz`;

    await ensureRemoteDirectory(settings);
    await putRemoteFile(settings, name, gzipped);

    let pruneError = null;
    try {
      await pruneRemoteBackups(settings);
    } catch (error) {
      pruneError = String(error?.message ?? error);
      console.log("dav backup: pruning failed", error);
    }

    const updated = {
      ...settings,
      lastBackupAt: Date.now(),
      lastBackupFile: name,
      lastBackupItems: doc.items.length,
      lastBackupBytes: gzipped.length,
      lastError: null,
    };
    await storeSettings(updated);
    return {
      name,
      items: doc.items.length,
      bytes: gzipped.length,
      trigger,
      pruneError,
    };
  }

  async function runBackupSafely(trigger) {
    try {
      return await runBackup(trigger);
    } catch (error) {
      const settings = await loadSettings();
      await storeSettings({ ...settings, lastError: String(error?.message ?? error) });
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // RPC methods used by the backup dialog
  // ---------------------------------------------------------------------------

  A.davGetSettings = async () => {
    const settings = await loadSettings();
    return { ...settings, configured: isConfigured(settings) };
  };

  A.davSaveSettings = async (input) => {
    const settings = normalizeSettings(input);
    const previous = await loadSettings();
    const merged = {
      ...settings,
      lastBackupAt: previous.lastBackupAt ?? null,
      lastBackupFile: previous.lastBackupFile ?? null,
      lastBackupItems: previous.lastBackupItems ?? null,
      lastBackupBytes: previous.lastBackupBytes ?? null,
      lastError: previous.lastError ?? null,
    };
    await storeSettings(merged);
    await scheduleAutoBackup();
    return { ...merged, configured: isConfigured(merged) };
  };

  A.davTestConnection = async (input) => {
    const settings = normalizeSettings(input ?? (await loadSettings()));
    await ensureRemoteDirectory(settings);
    const files = await listRemoteBackups(settings);
    return { ok: true, fileCount: files.length };
  };

  A.davBackupRun = async ({ trigger = "manual" } = {}) => {
    const result = await runBackupSafely(trigger);
    const settings = await loadSettings();
    return { ...result, settings: { ...settings, configured: isConfigured(settings) } };
  };

  A.davListBackups = async () => {
    const settings = normalizeSettings(await loadSettings());
    const files = await listRemoteBackups(settings);
    return { files };
  };

  A.davRestoreBackup = async ({ name } = {}) => {
    assertSafeRemoteName(name);
    const settings = normalizeSettings(await loadSettings());
    const raw = await downloadRemoteFile(settings, name);
    let doc;
    try {
      doc = JSON.parse(new TextDecoder().decode(raw));
    } catch {
      throw new Error("备份文件不是有效的 JSON");
    }
    const result = await restoreSnapshot(doc);
    return { ...result, name };
  };

  A.davDeleteBackup = async ({ name } = {}) => {
    assertSafeRemoteName(name);
    const settings = normalizeSettings(await loadSettings());
    await deleteRemoteFile(settings, name);
    return { deleted: name };
  };

  // ---------------------------------------------------------------------------
  // Automatic backups
  // ---------------------------------------------------------------------------

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== ALARM_NAME) return;
    runBackupSafely("alarm").catch((error) => console.log("dav backup: automatic backup failed", error));
  });

  chrome.runtime.onStartup.addListener(() => {
    scheduleAutoBackup().catch((error) => console.log("dav backup: scheduling failed", error));
  });

  chrome.runtime.onInstalled.addListener(() => {
    scheduleAutoBackup().catch((error) => console.log("dav backup: scheduling failed", error));
  });

  scheduleAutoBackup().catch((error) => console.log("dav backup: scheduling failed", error));

  console.log("dav backup: core ready");
})();
