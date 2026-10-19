// OneTab WebDAV backup dialog (options page + OneTab page).
// The dialog talks to the background worker through the core RPC channel; all
// network and database work happens in onetab-dav-backup-core.js.

(() => {
  if (globalThis.OneTabDavBackup) return;

  const NUTSTORE_URL = "https://dav.jianguoyun.com/dav/";
  const NUTSTORE_PASSWORD_PAGE = "https://www.jianguoyun.com/dashboard#/settings/security";

  const ICONS = {
    cloud:
      '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    alert:
      '<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
    server:
      '<rect width="16" height="6" x="4" y="4" rx="1"/><rect width="16" height="6" x="4" y="14" rx="1"/><path d="M7 7h.01"/><path d="M7 17h.01"/>',
    folder:
      '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
    key:
      '<path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4"/><path d="m21 2-9.6 9.6"/><circle cx="7.5" cy="15.5" r="5.5"/>',
    eye:
      '<path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0"/><circle cx="12" cy="12" r="3"/>',
    eyeOff:
      '<path d="m15 18-.72-3.28"/><path d="M2 2l20 20"/><path d="M6.71 6.71A10.75 10.75 0 0 0 2.06 11.65a1 1 0 0 0 0 .7 10.75 10.75 0 0 0 15.23 5.94"/><path d="M10.73 5.08A10.75 10.75 0 0 1 21.94 11.65a1 1 0 0 1 0 .7 10.75 10.75 0 0 1-1.67 3.2"/><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/>',
    upload:
      '<path d="M12 13v8"/><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="m8 17 4-4 4 4"/>',
    download:
      '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
    refresh:
      '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
    trash:
      '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M10 11v6"/><path d="M14 11v6"/>',
    archive:
      '<rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/>',
    shield:
      '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
    external:
      '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  };

  function icon(name, size = 16, extraClass = "") {
    return (
      `<svg class="ot-dav-ico ${extraClass}" width="${size}" height="${size}" viewBox="0 0 24 24" ` +
      'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" ' +
      `stroke-linejoin="round" aria-hidden="true">${ICONS[name] ?? ""}</svg>`
    );
  }

  const FALLBACK_MESSAGES = {
    davBackupTitle: "备份与同步",
    davBackupSubtitle: "WebDAV 云端备份 · 内置坚果云",
    davBackupProviderNutstore: "坚果云",
    davBackupProviderCustom: "自定义 WebDAV",
    davBackupServer: "服务器地址",
    davBackupAccount: "账号",
    davBackupAppPassword: "应用密码",
    davBackupRemoteDir: "远程目录",
    davBackupNutstoreHint: "坚果云需使用应用密码",
    davBackupGetAppPassword: "获取应用密码",
    davBackupAuto: "自动备份",
    davBackupAutoOff: "关闭时仅手动备份",
    davBackupAutoOn: "每 {INTERVAL}自动上传",
    davBackupEvery: "每",
    davBackupKeep: "保留",
    davBackupKeepUnit: "份",
    davBackupInterval30: "30 分钟",
    davBackupInterval60: "小时",
    davBackupInterval360: "6 小时",
    davBackupInterval1440: "天",
    davBackupTest: "测试连接",
    davBackupSave: "保存",
    davBackupSaving: "正在保存…",
    davBackupBackupNow: "立即备份",
    davBackupCloudFiles: "云端备份",
    davBackupEmpty: "暂无云端备份",
    davBackupRestore: "恢复",
    davBackupDelete: "删除",
    davBackupRefresh: "刷新",
    davBackupCancel: "取消",
    davBackupClose: "关闭",
    davBackupConfirmRestoreTitle: "确认恢复",
    davBackupConfirmRestoreText: "云端备份将合并到当前数据，不删除本地内容。确认恢复「{NAME}」？",
    davBackupConfirmDeleteText: "确认删除云端备份「{NAME}」？",
    davBackupConfirmRestoreAction: "确认恢复",
    davBackupConfirmDeleteAction: "删除",
    davBackupPasswordHint: "密码仅保存在本机",
    davBackupSaved: "已保存",
    davBackupConnected: "连接正常 · 云端 {COUNT} 份备份",
    davBackupTesting: "正在连接…",
    davBackupBackingUp: "正在备份…",
    davBackupBackupDone: "已备份 {COUNT} 个条目 · {SIZE}",
    davBackupRestoring: "正在恢复…",
    davBackupRestoreDone: "恢复完成 · {COUNT} 个条目，即将刷新",
    davBackupDeleted: "已删除",
    davBackupLastBackup: "上次备份 {WHEN} · {COUNT} 个条目",
    davBackupNeverBackedUp: "尚未备份",
    davBackupLoading: "正在读取…",
    davBackupEmptyListError: "无法读取云端文件列表",
    davBackupOptionsEntryTitle: "备份与同步",
    davBackupOptionsEntryText: "WebDAV · 坚果云",
    davBackupOptionsEntryButton: "打开设置",
    davBackupItemCount: "{COUNT} 个条目",
    davBackupInvalidUrl: "服务器地址无效",
    davBackupMissingCredentials: "请填写账号与应用密码",
    davBackupPermissionDenied: "未获得访问该服务器的权限",
    davBackupNoResponse: "后台服务无响应，请重试",
  };

  function message(key, replacements) {
    const fallback = FALLBACK_MESSAGES[key] ?? key;
    let text = fallback;
    try {
      text = chrome.i18n.getMessage(key) || fallback;
    } catch {
      text = fallback;
    }
    for (const [name, value] of Object.entries(replacements ?? {})) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
    return text;
  }

  async function rpc(type, ...args) {
    let response;
    try {
      response = await chrome.runtime.sendMessage({ type, args, Hp: true });
    } catch (error) {
      throw new Error(`${message("davBackupNoResponse")}（${error?.message ?? error}）`);
    }
    if (response == null) throw new Error(message("davBackupNoResponse"));
    if (response.zp) throw new Error(String(response.zp));
    return response.result;
  }

  // ---------------------------------------------------------------------------
  // Formatting helpers
  // ---------------------------------------------------------------------------

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function parseBackupName(name) {
    const match = /^onetab-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})/.exec(name);
    if (!match) return null;
    return new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      Number(match[4]),
      Number(match[5]),
      Number(match[6]),
    );
  }

  function formatDateTime(timestamp) {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return "";
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes < 0) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function formatFileLabel(file) {
    const fallback = file.modifiedAt ? formatDateTime(file.modifiedAt) : file.name;
    const name = file.name ?? "";
    const fromName = parseBackupName(name);
    const when = fromName ? formatDateTime(fromName.getTime()) : fallback;
    const size = formatBytes(file.bytes);
    return { when, size };
  }

  function intervalLabel(minutes) {
    switch (minutes) {
      case 30:
        return message("davBackupInterval30");
      case 360:
        return message("davBackupInterval360");
      case 1440:
        return message("davBackupInterval1440");
      default:
        return `${minutes / 60} ${message("davBackupInterval60")}`;
    }
  }

  // ---------------------------------------------------------------------------
  // Styles
  // ---------------------------------------------------------------------------

  const CSS = `
  #ot-dav-overlay {
    position: fixed;
    inset: 0;
    z-index: 2147483000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: color-mix(in srgb, #0b1020 46%, transparent);
    backdrop-filter: blur(7px) saturate(1.05);
    -webkit-backdrop-filter: blur(7px) saturate(1.05);
    font-family: 'Open Sans', 'Helvetica Neue', Arial, sans-serif;
    color: var(--text-color, #444);
    box-sizing: border-box;
  }
  #ot-dav-overlay *, #ot-dav-overlay *::before, #ot-dav-overlay *::after { box-sizing: border-box; }
  .ot-dav-panel {
    width: min(640px, 100%);
    max-height: min(86vh, 820px);
    display: flex;
    flex-direction: column;
    background: var(--col-bg-color, var(--bg-color, #fff));
    border: 1px solid var(--border-color, #eee);
    border-radius: 18px;
    box-shadow: 0 32px 90px rgba(6, 12, 30, .38), 0 2px 8px rgba(6, 12, 30, .16);
    overflow: hidden;
    animation: ot-dav-in 280ms cubic-bezier(.2, .8, .2, 1);
  }
  @keyframes ot-dav-in {
    from { opacity: 0; transform: translateY(14px) scale(.985); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
  .ot-dav-head {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 22px 24px 18px;
    border-bottom: 1px solid var(--border-color, #eee);
  }
  .ot-dav-mark {
    flex: 0 0 auto;
    width: 42px;
    height: 42px;
    display: grid;
    place-items: center;
    border-radius: 13px;
    color: var(--link-color, #234da7);
    background:
      radial-gradient(circle at 30% 25%, color-mix(in srgb, var(--link-color, #234da7) 24%, transparent), transparent 68%),
      color-mix(in srgb, var(--link-color, #234da7) 10%, transparent);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--link-color, #234da7) 22%, transparent);
  }
  .ot-dav-heading { flex: 1 1 auto; min-width: 0; }
  .ot-dav-heading h2 {
    margin: 0;
    font-size: 19px;
    font-weight: 600;
    letter-spacing: -.015em;
    color: var(--text-color-em, #333);
  }
  .ot-dav-heading p {
    margin: 3px 0 0;
    font-size: 12px;
    color: var(--text-color-weak, #666);
  }
  .ot-dav-scroll {
    overflow: auto;
    padding: 4px 24px 18px;
    scrollbar-width: thin;
  }
  .ot-dav-section {
    padding: 16px 0;
    border-bottom: 1px solid var(--border-color, #eee);
  }
  .ot-dav-section:last-child { border-bottom: 0; }
  .ot-dav-seg {
    display: flex;
    gap: 4px;
    padding: 4px;
    margin-bottom: 16px;
    border-radius: 11px;
    background: color-mix(in srgb, var(--border-color, #eee) 60%, transparent);
  }
  .ot-dav-seg button {
    flex: 1 1 0;
    height: 32px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--text-color-weak, #666);
    font: inherit;
    font-size: 12.5px;
    font-weight: 600;
    cursor: pointer;
    transition: background 160ms ease, color 160ms ease, box-shadow 160ms ease;
  }
  .ot-dav-seg button[aria-selected="true"] {
    background: var(--bg-color, #fff);
    color: var(--link-color, #234da7);
    box-shadow: 0 1px 3px rgba(10, 20, 50, .12), inset 0 0 0 1px color-mix(in srgb, var(--link-color, #234da7) 22%, transparent);
  }
  .ot-dav-field { display: block; margin-bottom: 12px; }
  .ot-dav-field:last-child { margin-bottom: 0; }
  .ot-dav-field > span.ot-dav-label { display: block; }
  .ot-dav-label, .ot-dav-field > span:first-child {
    display: block;
    margin-bottom: 6px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: .04em;
    text-transform: uppercase;
    color: var(--text-color-weak, #666);
  }
  .ot-dav-field input {
    width: 100%;
    height: 38px;
    padding: 0 11px;
    border-radius: 9px;
    border: 1px solid var(--stronger-border-color, #dbdbdb);
    background: var(--bg-color, #fff);
    color: var(--text-color, #444);
    font: inherit;
    font-size: 13px;
    outline: none;
    transition: border-color 150ms ease, box-shadow 150ms ease;
  }
  .ot-dav-field input:focus-visible {
    border-color: var(--link-color, #234da7);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--link-color, #234da7) 18%, transparent);
  }
  .ot-dav-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .ot-dav-secret { position: relative; display: block; }
  .ot-dav-secret input { padding-inline-end: 38px; }
  .ot-dav-secret button {
    position: absolute;
    inset-inline-end: 5px;
    top: 50%;
    transform: translateY(-50%);
    width: 28px;
    height: 28px;
    display: grid;
    place-items: center;
    border: 0;
    border-radius: 7px;
    background: transparent;
    color: var(--text-color-weak, #666);
    cursor: pointer;
  }
  .ot-dav-secret button:hover { background: var(--link-color-background, #f1f4f9); }
  .ot-dav-hint {
    display: flex;
    align-items: center;
    gap: 7px;
    margin-top: 10px;
    font-size: 11.5px;
    line-height: 1.5;
    color: var(--text-color-weak, #666);
  }
  .ot-dav-hint a {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    color: var(--link-color, #234da7);
    text-decoration: none;
    font-weight: 600;
  }
  .ot-dav-hint a:hover { text-decoration: underline; }
  .ot-dav-switch-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
  }
  .ot-dav-switch-copy { min-width: 0; }
  .ot-dav-switch-copy strong { display: block; font-size: 13px; font-weight: 600; color: var(--text-color-em, #333); }
  .ot-dav-switch-copy small { display: block; margin-top: 2px; font-size: 11.5px; color: var(--text-color-weak, #666); }
  .ot-dav-switch {
    flex: 0 0 auto;
    width: 42px;
    height: 24px;
    padding: 0;
    border: 0;
    border-radius: 999px;
    background: color-mix(in srgb, var(--text-color-weak, #666) 32%, transparent);
    cursor: pointer;
    position: relative;
    transition: background 180ms ease;
  }
  .ot-dav-switch span {
    position: absolute;
    top: 3px;
    inset-inline-start: 3px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 1px 3px rgba(0, 0, 0, .3);
    transition: transform 200ms cubic-bezier(.2, .8, .2, 1);
  }
  .ot-dav-switch[aria-checked="true"] { background: var(--link-color, #234da7); }
  .ot-dav-switch[aria-checked="true"] span { transform: translateX(18px); }
  html[dir="rtl"] .ot-dav-switch[aria-checked="true"] span { transform: translateX(-18px); }
  .ot-dav-auto-options {
    display: flex;
    flex-wrap: wrap;
    gap: 14px;
    margin-top: 14px;
    padding-top: 14px;
    border-top: 1px dashed var(--dash-color, #ddd);
    font-size: 12px;
    color: var(--text-color-weak, #666);
  }
  .ot-dav-auto-options[hidden] { display: none; }
  .ot-dav-auto-options label { display: inline-flex; align-items: center; gap: 7px; }
  .ot-dav-select {
    height: 30px;
    padding: 0 26px 0 9px;
    border-radius: 8px;
    border: 1px solid var(--stronger-border-color, #dbdbdb);
    background: var(--bg-color, #fff);
    color: var(--text-color, #444);
    font: inherit;
    font-size: 12px;
    appearance: none;
    background-image: linear-gradient(45deg, transparent 50%, currentColor 50%), linear-gradient(135deg, currentColor 50%, transparent 50%);
    background-position: calc(100% - 13px) 13px, calc(100% - 9px) 13px;
    background-size: 4px 4px, 4px 4px;
    background-repeat: no-repeat;
  }
  .ot-dav-status {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    min-height: 20px;
    margin-top: 4px;
    padding: 10px 12px;
    border-radius: 9px;
    font-size: 12px;
    line-height: 1.5;
    color: var(--text-color-weak, #666);
    background: transparent;
    transition: background 150ms ease, color 150ms ease;
  }
  .ot-dav-status:empty { display: none; }
  .ot-dav-status[data-kind="ok"] { color: #1a7f4b; background: color-mix(in srgb, #1a7f4b 9%, transparent); }
  .ot-dav-status[data-kind="error"] { color: var(--warning-text-color, #d93025); background: color-mix(in srgb, #d93025 8%, transparent); }
  .ot-dav-status[data-kind="busy"] { color: var(--link-color, #234da7); background: color-mix(in srgb, var(--link-color, #234da7) 8%, transparent); }
  .ot-dav-status .ot-dav-ico { flex: 0 0 auto; margin-top: 1px; }
  .ot-dav-files-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }
  .ot-dav-files-head strong {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: .04em;
    text-transform: uppercase;
    color: var(--text-color-weak, #666);
  }
  .ot-dav-file-list { display: flex; flex-direction: column; gap: 2px; }
  .ot-dav-file {
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 9px 8px;
    border-radius: 9px;
    transition: background 140ms ease;
  }
  .ot-dav-file:hover { background: var(--link-color-background, #f1f4f9); }
  .ot-dav-file-icon { flex: 0 0 auto; color: var(--text-color-weak, #666); opacity: .75; }
  .ot-dav-file-main { flex: 1 1 auto; min-width: 0; }
  .ot-dav-file-name { font-size: 12.5px; font-weight: 600; color: var(--text-color-em, #333); }
  .ot-dav-file-meta { margin-top: 1px; font-size: 11px; color: var(--text-color-weak, #666); }
  .ot-dav-iconbtn {
    flex: 0 0 auto;
    width: 30px;
    height: 30px;
    display: grid;
    place-items: center;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--text-color-weak, #666);
    cursor: pointer;
    transition: background 140ms ease, color 140ms ease;
  }
  .ot-dav-iconbtn:hover { background: color-mix(in srgb, var(--link-color, #234da7) 12%, transparent); color: var(--link-color, #234da7); }
  .ot-dav-iconbtn.ot-dav-danger:hover { background: color-mix(in srgb, var(--warning-text-color, #d93025) 12%, transparent); color: var(--warning-text-color, #d93025); }
  .ot-dav-empty {
    padding: 18px 8px;
    font-size: 12px;
    color: var(--text-color-weak, #666);
    text-align: center;
  }
  .ot-dav-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 14px 24px 18px;
    border-top: 1px solid var(--border-color, #eee);
    background: color-mix(in srgb, var(--bg-color, #fff) 88%, var(--border-color, #eee));
  }
  .ot-dav-spacer { flex: 1 1 auto; }
  .ot-dav-btn {
    height: 36px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    padding: 0 15px;
    border-radius: 9px;
    border: 1px solid transparent;
    font: inherit;
    font-size: 12.5px;
    font-weight: 600;
    cursor: pointer;
    transition: transform 120ms ease, background 150ms ease, border-color 150ms ease, opacity 150ms ease;
  }
  .ot-dav-btn:active { transform: translateY(1px); }
  .ot-dav-btn:disabled { opacity: .55; cursor: default; transform: none; }
  .ot-dav-btn.ghost {
    border-color: var(--stronger-border-color, #dbdbdb);
    background: transparent;
    color: var(--text-color, #444);
  }
  .ot-dav-btn.ghost:hover:not(:disabled) { border-color: var(--even-stronger-border-color, #989898); }
  .ot-dav-btn.primary {
    background: var(--link-color, #234da7);
    color: var(--bg-color, #fff);
    box-shadow: 0 6px 18px color-mix(in srgb, var(--link-color, #234da7) 26%, transparent);
  }
  .ot-dav-btn.primary:hover:not(:disabled) { filter: brightness(1.08); }
  .ot-dav-spinner {
    width: 13px;
    height: 13px;
    border-radius: 50%;
    border: 2px solid currentColor;
    border-top-color: transparent;
    animation: ot-dav-spin .7s linear infinite;
  }
  @keyframes ot-dav-spin { to { transform: rotate(360deg); } }
  .ot-dav-confirm {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: color-mix(in srgb, #0b1020 34%, transparent);
    backdrop-filter: blur(3px);
  }
  .ot-dav-confirm[hidden] { display: none; }
  .ot-dav-confirm-card {
    width: min(400px, 100%);
    padding: 22px;
    border-radius: 14px;
    background: var(--col-bg-color, var(--bg-color, #fff));
    border: 1px solid var(--border-color, #eee);
    box-shadow: 0 24px 64px rgba(6, 12, 30, .35);
    animation: ot-dav-in 200ms cubic-bezier(.2, .8, .2, 1);
  }
  .ot-dav-confirm-card h3 { margin: 0 0 8px; font-size: 15px; font-weight: 600; color: var(--text-color-em, #333); }
  .ot-dav-confirm-card p { margin: 0 0 18px; font-size: 12.5px; line-height: 1.6; color: var(--text-color-weak, #666); }
  .ot-dav-confirm-actions { display: flex; justify-content: flex-end; gap: 8px; }
  .ot-dav-cap { position: relative; }
  @media (max-width: 560px) {
    .ot-dav-row { grid-template-columns: 1fr; }
    .ot-dav-panel { max-height: 92vh; }
  }
  @media (prefers-reduced-motion: reduce) {
    .ot-dav-panel, .ot-dav-confirm-card { animation: none; }
    .ot-dav-btn, .ot-dav-switch span, .ot-dav-switch { transition: none; }
  }
  .ot-dav-entry {
    margin-top: 28px;
    padding: 18px 20px;
    display: flex;
    align-items: center;
    gap: 14px;
    border: 1px solid var(--border-color, #eee);
    border-radius: 12px;
    background: var(--col-bg-color, var(--bg-color, #fff));
    font-family: 'Open Sans', 'Helvetica Neue', Arial, sans-serif;
  }
  .ot-dav-entry-icon {
    flex: 0 0 auto;
    width: 36px;
    height: 36px;
    display: grid;
    place-items: center;
    border-radius: 10px;
    color: var(--link-color, #234da7);
    background: color-mix(in srgb, var(--link-color, #234da7) 10%, transparent);
  }
  .ot-dav-entry-copy { flex: 1 1 auto; min-width: 0; }
  .ot-dav-entry-copy strong { display: block; font-size: 13px; font-weight: 600; color: var(--text-color-em, #333); }
  .ot-dav-entry-copy small { display: block; margin-top: 2px; font-size: 11.5px; color: var(--text-color-weak, #666); }
  .ot-dav-entry .ot-dav-btn { flex: 0 0 auto; }
  `;

  function ensureStyles() {
    if (document.getElementById("ot-dav-backup-styles")) return;
    const style = document.createElement("style");
    style.id = "ot-dav-backup-styles";
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  // ---------------------------------------------------------------------------
  // Dialog
  // ---------------------------------------------------------------------------

  const state = {
    settings: null,
    files: [],
    busy: false,
    auto: false,
    provider: "nutstore",
    confirm: null,
  };

  let overlay = null;
  let panel = null;
  let lastFocused = null;

  function field(name) {
    return panel?.querySelector(`[data-field="${name}"]`);
  }

  function query(selector) {
    return panel?.querySelector(selector);
  }

  function setStatus(kind, text) {
    const node = query("[data-status]");
    if (!node) return;
    node.dataset.kind = kind;
    node.innerHTML = "";
    if (!text) return;
    const iconName = kind === "ok" ? "check" : kind === "error" ? "alert" : "cloud";
    const iconNode = document.createElement("span");
    iconNode.innerHTML = icon(iconName, 14);
    const textNode = document.createElement("span");
    textNode.textContent = text;
    node.append(iconNode.firstChild, textNode);
  }

  function setBusy(busy, label) {
    state.busy = busy;
    if (!panel) return;
    panel.setAttribute("aria-busy", String(busy));
    for (const button of panel.querySelectorAll("button")) {
      if (button.dataset.confirmCancel !== undefined) continue;
      button.disabled = busy;
    }
    const status = query("[data-status]");
    if (busy && label) setStatus("busy", label);
    else if (!busy && status?.dataset.kind === "busy") setStatus("idle", "");
  }

  function setProvider(provider, { fillUrl = false } = {}) {
    state.provider = provider;
    const segmented = queryAll("[data-provider]");
    for (const button of segmented) {
      button.setAttribute("aria-selected", String(button.dataset.provider === provider));
    }
    const hint = query("[data-nutstore-hint]");
    if (hint) hint.hidden = provider !== "nutstore";
    const url = field("url");
    if (url && fillUrl) {
      if (provider === "nutstore") url.value = NUTSTORE_URL;
      else if (url.value.trim() === NUTSTORE_URL) url.value = "";
    }
  }

  function queryAll(selector) {
    return panel ? [...panel.querySelectorAll(selector)] : [];
  }

  function fillForm(settings) {
    if (!settings) return;
    state.settings = settings;
    state.auto = Boolean(settings.autoBackup);
    field("url").value = settings.url ?? "";
    field("username").value = settings.username ?? "";
    field("password").value = settings.password ?? "";
    field("remoteDir").value = settings.remoteDir ?? "";
    field("intervalMinutes").value = String(settings.intervalMinutes ?? 60);
    field("keepCount").value = String(settings.keepCount ?? 8);
    setProvider(settings.provider === "custom" ? "custom" : "nutstore");
    setAuto(settings.autoBackup);
    renderLastBackup(settings);
  }

  function setAuto(enabled) {
    state.auto = Boolean(enabled);
    const toggle = query("[data-toggle-auto]");
    if (toggle) toggle.setAttribute("aria-checked", String(state.auto));
    const options = query("[data-auto-options]");
    if (options) options.hidden = !state.auto;
    const sub = query("[data-auto-sub]");
    if (sub) {
      sub.textContent = state.auto
        ? message("davBackupAutoOn", { INTERVAL: intervalLabel(Number(field("intervalMinutes")?.value ?? 60)) })
        : message("davBackupAutoOff");
    }
  }

  function renderLastBackup(settings) {
    if (!settings || state.busy) return;
    if (settings.lastError) {
      setStatus("error", settings.lastError);
      return;
    }
    if (settings.lastBackupAt) {
      setStatus(
        "ok",
        message("davBackupLastBackup", {
          WHEN: formatDateTime(settings.lastBackupAt),
          COUNT: (settings.lastBackupItems ?? 0).toLocaleString(),
        }),
      );
    } else {
      setStatus("idle", message("davBackupNeverBackedUp"));
    }
  }

  function collectForm() {
    const url = field("url").value.trim();
    const username = field("username").value.trim();
    const password = field("password").value;
    const remoteDir = field("remoteDir").value.trim();
    const intervalMinutes = Number(field("intervalMinutes").value);
    const keepCount = Number(field("keepCount").value);
    if (!url) throw new Error(message("davBackupInvalidUrl"));
    try {
      new URL(url);
    } catch {
      throw new Error(message("davBackupInvalidUrl"));
    }
    if (!username || !password) throw new Error(message("davBackupMissingCredentials"));
    return {
      provider: state.provider,
      url,
      username,
      password,
      remoteDir,
      autoBackup: state.auto,
      intervalMinutes,
      keepCount,
    };
  }

  async function ensurePermission(url) {
    let origin;
    try {
      origin = `${new URL(url).origin}/*`;
    } catch {
      throw new Error(message("davBackupInvalidUrl"));
    }
    // Nutstore is covered by the manifest host permissions.
    if (origin === "https://dav.jianguoyun.com/*") return;
    // Must be called directly from the click handler so the browser keeps the
    // user gesture; request() resolves true when the origin is already granted.
    const granted = await chrome.permissions.request({ origins: [origin] });
    if (!granted) throw new Error(message("davBackupPermissionDenied"));
  }

  async function saveForm() {
    const form = collectForm();
    await ensurePermission(form.url);
    const settings = await rpc("davSaveSettings", form);
    state.settings = settings;
    return settings;
  }

  function hasStoredConfig(settings) {
    return Boolean(settings?.url && settings?.username && settings?.password);
  }

  async function refreshFiles() {
    const list = query("[data-file-list]");
    if (!list) return;
    if (!hasStoredConfig(state.settings)) {
      list.innerHTML = `<div class="ot-dav-empty">${message("davBackupNeverBackedUp")}</div>`;
      return;
    }
    list.innerHTML = `<div class="ot-dav-empty">${message("davBackupLoading")}</div>`;
    try {
      const { files } = await rpc("davListBackups");
      state.files = files ?? [];
      renderFiles();
    } catch (error) {
      state.files = [];
      list.innerHTML = "";
      const empty = document.createElement("div");
      empty.className = "ot-dav-empty";
      empty.textContent = `${message("davBackupEmptyListError")}：${error?.message ?? error}`;
      list.appendChild(empty);
    }
  }

  function renderFiles() {
    const list = query("[data-file-list]");
    if (!list) return;
    list.innerHTML = "";
    if (!state.files.length) {
      const empty = document.createElement("div");
      empty.className = "ot-dav-empty";
      empty.textContent = message("davBackupEmpty");
      list.appendChild(empty);
      return;
    }
    for (const file of state.files) {
      const { when, size } = formatFileLabel(file);
      const row = document.createElement("div");
      row.className = "ot-dav-file";
      row.innerHTML =
        `<span class="ot-dav-file-icon">${icon("archive", 17)}</span>` +
        '<div class="ot-dav-file-main">' +
        `<div class="ot-dav-file-name" dir="auto"></div>` +
        `<div class="ot-dav-file-meta"></div>` +
        "</div>" +
        `<button class="ot-dav-iconbtn" data-restore title="${message("davBackupRestore")}" aria-label="${message("davBackupRestore")}">${icon("download", 16)}</button>` +
        `<button class="ot-dav-iconbtn ot-dav-danger" data-delete title="${message("davBackupDelete")}" aria-label="${message("davBackupDelete")}">${icon("trash", 16)}</button>`;
      row.querySelector(".ot-dav-file-name").textContent = when || file.name;
      row.querySelector(".ot-dav-file-meta").textContent = [size, file.name].filter(Boolean).join(" · ");
      row.querySelector("[data-restore]").addEventListener("click", () => askConfirm("restore", file.name));
      row.querySelector("[data-delete]").addEventListener("click", () => askConfirm("delete", file.name));
      list.appendChild(row);
    }
  }

  function askConfirm(type, name) {
    if (state.busy) return;
    state.confirm = { type, name };
    const confirm = query("[data-confirm]");
    query("[data-confirm-title]").textContent =
      type === "restore" ? message("davBackupConfirmRestoreTitle") : message("davBackupDelete");
    query("[data-confirm-text]").textContent =
      type === "restore"
        ? message("davBackupConfirmRestoreText", { NAME: name })
        : message("davBackupConfirmDeleteText", { NAME: name });
    query("[data-confirm-ok]").textContent =
      type === "restore" ? message("davBackupConfirmRestoreAction") : message("davBackupConfirmDeleteAction");
    confirm.hidden = false;
    query("[data-confirm-ok]").focus();
  }

  function hideConfirm() {
    state.confirm = null;
    const confirm = query("[data-confirm]");
    if (confirm) confirm.hidden = true;
  }

  function closeDialog() {
    if (state.busy) return;
    if (state.confirm) {
      hideConfirm();
      return;
    }
    if (overlay) {
      overlay.remove();
      overlay = null;
      panel = null;
    }
    document.removeEventListener("keydown", onKeyDown, true);
    document.body.style.overflow = document.body.dataset.otDavPrevOverflow ?? "";
    lastFocused?.focus?.();
    lastFocused = null;
  }

  function onKeyDown(event) {
    if (!overlay) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeDialog();
      return;
    }
    if (event.key !== "Tab" || !panel) return;
    const focusable = [...panel.querySelectorAll('button, input, select, a[href], [tabindex]:not([tabindex="-1"])')]
      .filter((node) => !node.disabled && node.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function buildDialog() {
    ensureStyles();
    lastFocused = document.activeElement;
    document.body.dataset.otDavPrevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    overlay = document.createElement("div");
    overlay.id = "ot-dav-overlay";
    overlay.innerHTML = `
      <div class="ot-dav-panel" role="dialog" aria-modal="true" aria-labelledby="ot-dav-title">
        <div class="ot-dav-head">
          <div class="ot-dav-mark">${icon("cloud", 22)}</div>
          <div class="ot-dav-heading">
            <h2 id="ot-dav-title">${message("davBackupTitle")}</h2>
            <p>${message("davBackupSubtitle")}</p>
          </div>
          <button class="ot-dav-iconbtn" data-close aria-label="${message("davBackupClose")}" title="${message("davBackupClose")}">${icon("x", 17)}</button>
        </div>
        <div class="ot-dav-scroll">
          <section class="ot-dav-section">
            <div class="ot-dav-seg" role="tablist">
              <button type="button" role="tab" data-provider="nutstore" aria-selected="false">${message("davBackupProviderNutstore")}</button>
              <button type="button" role="tab" data-provider="custom" aria-selected="false">${message("davBackupProviderCustom")}</button>
            </div>
            <label class="ot-dav-field">
              <span>${message("davBackupServer")}</span>
              <input data-field="url" type="url" spellcheck="false" autocomplete="off" dir="ltr">
            </label>
            <div class="ot-dav-row">
              <label class="ot-dav-field">
                <span>${message("davBackupAccount")}</span>
                <input data-field="username" spellcheck="false" autocomplete="username" dir="ltr">
              </label>
              <label class="ot-dav-field">
                <span>${message("davBackupAppPassword")}</span>
                <span class="ot-dav-secret">
                  <input data-field="password" type="password" autocomplete="current-password" dir="ltr">
                  <button type="button" data-toggle-password aria-label="${message("davBackupAppPassword")}">${icon("eye", 16)}</button>
                </span>
              </label>
            </div>
            <label class="ot-dav-field">
              <span>${message("davBackupRemoteDir")}</span>
              <input data-field="remoteDir" spellcheck="false" dir="ltr">
            </label>
            <div class="ot-dav-hint" data-nutstore-hint>
              ${icon("key", 14)}
              <span>${message("davBackupNutstoreHint")}</span>
              <a href="${NUTSTORE_PASSWORD_PAGE}" target="_blank" rel="noreferrer">${message("davBackupGetAppPassword")}${icon("external", 12)}</a>
            </div>
            <div class="ot-dav-hint">${icon("shield", 14)}<span>${message("davBackupPasswordHint")}</span></div>
          </section>
          <section class="ot-dav-section">
            <div class="ot-dav-switch-row">
              <div class="ot-dav-switch-copy">
                <strong>${message("davBackupAuto")}</strong>
                <small data-auto-sub>${message("davBackupAutoOff")}</small>
              </div>
              <button type="button" class="ot-dav-switch" data-toggle-auto role="switch" aria-checked="false" aria-label="${message("davBackupAuto")}"><span></span></button>
            </div>
            <div class="ot-dav-auto-options" data-auto-options hidden>
              <label>${message("davBackupEvery")}
                <select class="ot-dav-select" data-field="intervalMinutes">
                  <option value="30">${message("davBackupInterval30")}</option>
                  <option value="60" selected>1 ${message("davBackupInterval60")}</option>
                  <option value="360">6 ${message("davBackupInterval60")}</option>
                  <option value="1440">1 ${message("davBackupInterval1440")}</option>
                </select>
              </label>
              <label>${message("davBackupKeep")}
                <select class="ot-dav-select" data-field="keepCount">
                  <option value="3">3</option>
                  <option value="8" selected>8</option>
                  <option value="15">15</option>
                  <option value="30">30</option>
                </select>
                ${message("davBackupKeepUnit")}
              </label>
            </div>
          </section>
          <div class="ot-dav-status" data-status></div>
          <section class="ot-dav-section">
            <div class="ot-dav-files-head">
              <strong>${message("davBackupCloudFiles")}</strong>
              <button type="button" class="ot-dav-iconbtn" data-refresh title="${message("davBackupRefresh")}" aria-label="${message("davBackupRefresh")}">${icon("refresh", 15)}</button>
            </div>
            <div class="ot-dav-file-list" data-file-list></div>
          </section>
        </div>
        <div class="ot-dav-actions">
          <button type="button" class="ot-dav-btn ghost" data-action="test">${icon("server", 14)}<span>${message("davBackupTest")}</span></button>
          <span class="ot-dav-spacer"></span>
          <button type="button" class="ot-dav-btn ghost" data-action="save">${message("davBackupSave")}</button>
          <button type="button" class="ot-dav-btn primary" data-action="backup">${icon("upload", 15)}<span>${message("davBackupBackupNow")}</span></button>
        </div>
        <div class="ot-dav-confirm" data-confirm hidden>
          <div class="ot-dav-confirm-card" role="alertdialog" aria-modal="true">
            <h3 data-confirm-title></h3>
            <p data-confirm-text></p>
            <div class="ot-dav-confirm-actions">
              <button type="button" class="ot-dav-btn ghost" data-confirm-cancel>${message("davBackupCancel")}</button>
              <button type="button" class="ot-dav-btn primary" data-confirm-ok>${message("davBackupConfirmRestoreAction")}</button>
            </div>
          </div>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    panel = overlay.querySelector(".ot-dav-panel");

    overlay.addEventListener("mousedown", (event) => {
      if (event.target === overlay) closeDialog();
    });
    query("[data-close]").addEventListener("click", closeDialog);
    for (const button of queryAll("[data-provider]")) {
      button.addEventListener("click", () => setProvider(button.dataset.provider, { fillUrl: true }));
    }
    query("[data-toggle-password]").addEventListener("click", () => {
      const input = field("password");
      const visible = input.type === "text";
      input.type = visible ? "password" : "text";
      query("[data-toggle-password]").innerHTML = icon(visible ? "eye" : "eyeOff", 16);
    });
    query("[data-toggle-auto]").addEventListener("click", () => setAuto(!state.auto));
    field("intervalMinutes").addEventListener("change", () => setAuto(state.auto));
    query("[data-refresh]").addEventListener("click", () => {
      refreshFiles();
    });
    query('[data-action="save"]').addEventListener("click", () => runAction("save"));
    query('[data-action="test"]').addEventListener("click", () => runAction("test"));
    query('[data-action="backup"]').addEventListener("click", () => runAction("backup"));
    query("[data-confirm-cancel]").addEventListener("click", hideConfirm);
    query("[data-confirm-ok]").addEventListener("click", () => {
      const current = state.confirm;
      hideConfirm();
      if (!current) return;
      if (current.type === "restore") restoreBackup(current.name);
      else deleteBackup(current.name);
    });
    document.addEventListener("keydown", onKeyDown, true);
    field("url").focus();
  }

  async function runAction(action) {
    if (state.busy) return;
    try {
      if (action === "save") {
        setBusy(true, message("davBackupSaving"));
        const settings = await saveForm();
        setBusy(false);
        renderLastBackup(settings);
        setStatus("ok", message("davBackupSaved"));
        await refreshFiles();
        return;
      }
      if (action === "test") {
        setBusy(true, message("davBackupTesting"));
        const form = collectForm();
        await ensurePermission(form.url);
        const result = await rpc("davTestConnection", form);
        setBusy(false);
        setStatus("ok", message("davBackupConnected", { COUNT: result.fileCount ?? 0 }));
        return;
      }
      if (action === "backup") {
        setBusy(true, message("davBackupBackingUp"));
        await saveForm();
        const result = await rpc("davBackupRun", { trigger: "manual" });
        setBusy(false);
        state.settings = result.settings ?? state.settings;
        setStatus(
          "ok",
          message("davBackupBackupDone", {
            COUNT: Number(result.items ?? 0).toLocaleString(),
            SIZE: formatBytes(result.bytes),
          }),
        );
        await refreshFiles();
        return;
      }
    } catch (error) {
      setBusy(false);
      setStatus("error", error?.message ?? String(error));
    }
  }

  async function restoreBackup(name) {
    if (state.busy) return;
    setBusy(true, message("davBackupRestoring"));
    try {
      const result = await rpc("davRestoreBackup", { name });
      setBusy(false);
      setStatus(
        "ok",
        message("davBackupRestoreDone", { COUNT: Number(result.itemCount ?? 0).toLocaleString() }),
      );
    } catch (error) {
      setBusy(false);
      setStatus("error", error?.message ?? String(error));
    }
  }

  async function deleteBackup(name) {
    if (state.busy) return;
    setBusy(true);
    try {
      await rpc("davDeleteBackup", { name });
      setBusy(false);
      setStatus("ok", message("davBackupDeleted"));
      await refreshFiles();
    } catch (error) {
      setBusy(false);
      setStatus("error", error?.message ?? String(error));
    }
  }

  async function open() {
    if (overlay) {
      field("url")?.focus();
      return;
    }
    state.provider = "nutstore";
    state.files = [];
    state.confirm = null;
    buildDialog();
    setStatus("busy", message("davBackupLoading"));
    try {
      const settings = await rpc("davGetSettings");
      fillForm(settings);
      renderLastBackup(settings);
      if (settings.configured) await refreshFiles();
      else {
        setStatus("idle", message("davBackupNeverBackedUp"));
        renderFiles();
      }
    } catch (error) {
      setStatus("error", error?.message ?? String(error));
    }
  }

  // ---------------------------------------------------------------------------
  // Options page entry
  // ---------------------------------------------------------------------------

  function mountOptionsEntry() {
    if (!/options\.html$/i.test(location.pathname)) return;
    ensureStyles();
    const host = document.getElementById("contentAreaDiv");
    if (!host) return;

    const mount = () => {
      if (!document.getElementById("ot-dav-options-entry") && host.isConnected) {
        const entry = document.createElement("div");
        entry.id = "ot-dav-options-entry";
        entry.className = "ot-dav-entry";
        entry.innerHTML =
          `<div class="ot-dav-entry-icon">${icon("cloud", 19)}</div>` +
          '<div class="ot-dav-entry-copy">' +
          `<strong>${message("davBackupOptionsEntryTitle")}</strong>` +
          `<small>${message("davBackupOptionsEntryText")}</small>` +
          "</div>" +
          `<button type="button" class="ot-dav-btn primary">${message("davBackupOptionsEntryButton")}</button>`;
        entry.querySelector("button").addEventListener("click", () => open());
        host.appendChild(entry);
      }
    };
    mount();
    const observer = new MutationObserver(() => mount());
    observer.observe(host, { childList: true });
  }

  globalThis.OneTabDavBackup = { open };

  const start = () => {
    ensureStyles();
    mountOptionsEntry();
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
