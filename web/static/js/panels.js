import { apiGet, apiPost, apiPut, toast } from "./api.js";
import { tr } from "./i18n.js";
import {
  showConfirm, showKeyboard, showTree, showHtml, showMultiOption,
  createSpToggle, createProgressRow, createDualButton,
} from "./components.js";

function t(s) {
  return tr(s);
}

function resolveWidgetType(w) {
  const known = new Set([
    "section", "html", "action", "subpanel", "custom", "dual_button", "option",
    "readonly", "bool", "choice", "int",
  ]);
  if (known.has(w.type)) return w.type;
  const pt = String(w.param_type || w.type || "").toUpperCase();
  if (w.options?.length) return "choice";
  if (pt.includes("BOOL")) return "bool";
  if (pt.includes("INT")) return "int";
  if (pt.includes("STRING")) return w.options?.length ? "choice" : "readonly";
  return w.type;
}

let globalState = { started: false, engaged: false, is_offroad: true };
let onNavigateSubpanel = null;
let deviceExtrasCache = null;

const paramHandlers = {
  toast,
  putParam: (key, value, needsCycle) => apiPut(`/api/opui/params/${encodeURIComponent(key)}`, {
    value, needs_cycle: !!needsCycle,
  }),
};

export function setGlobalState(st) {
  globalState = st || globalState;
}

export function setSubpanelNavigator(fn) {
  onNavigateSubpanel = fn;
}

export async function loadPanelList() {
  const data = await apiGet("/api/opui/panels");
  if (!data.ok) return [];
  const p = data.panels;
  if (Array.isArray(p)) return p;
  console.warn("panels API returned non-array; restart webui server after panel_icons fix");
  return [];
}

export async function renderPanel(panelId, container, titleEl, options = {}) {
  const data = await apiGet(`/api/opui/panels/${encodeURIComponent(panelId)}`);
  if (!data.ok) {
    container.innerHTML = `<p class="opui-muted" style="padding:48px">加载失败: ${data.error}</p>`;
    return;
  }
  if (titleEl) {
    if (data.parent && options.showBack !== false) {
      titleEl.innerHTML = `<button type="button" class="opui-back" data-parent="${escapeAttr(data.parent)}">‹</button> ${escapeHtml(t(data.title))}`;
      titleEl.querySelector(".opui-back")?.addEventListener("click", () => {
        if (onNavigateSubpanel) onNavigateSubpanel(data.parent);
      });
    } else {
      titleEl.textContent = t(data.title);
    }
  }

  if (data.custom === "device") {
    await renderDevicePanel(container, data, titleEl, options);
    return;
  }
  if (data.custom === "network") {
    await renderNetworkPanel(container, data);
    return;
  }
  if (data.custom === "software") {
    await renderSoftwarePanel(container, data);
    return;
  }
  if (data.custom === "trips") {
    await renderTripsPanel(container, data);
    return;
  }
  if (data.custom === "models") {
    await renderModelsPanel(container, data);
    return;
  }
  if (data.custom === "firehose") {
    await renderFirehosePanel(container);
    return;
  }
  if (data.custom === "sunnylink") {
    await renderSunnylinkPanel(container, data);
    return;
  }
  if (data.custom === "osm") {
    await renderOsmPanel(container, data);
    return;
  }
  if (data.custom === "vehicle") {
    await renderVehiclePanel(container, data);
    return;
  }

  renderGenericPanel(container, data);
}

async function renderDevicePanel(container, data, titleEl, options = {}) {
  const ex = await apiGet("/api/opui/device/extras");
  deviceExtrasCache = ex.ok ? ex : null;
  renderGenericPanel(container, data);
}

function renderAlwaysOffroadRow(active) {
  const row = document.createElement("div");
  row.className = "opui-dual-row opui-dual-row--single";
  const label = active ? t("Exit Always Offroad") : t("Enable Always Offroad");
  row.innerHTML = `<button type="button" class="opui-dual-btn ${active ? "primary" : "danger"}">${escapeHtml(label)}</button>`;
  row.querySelector("button")?.addEventListener("click", async () => {
    if (globalState.engaged) {
      toast(t("Disengage to Enter Always Offroad Mode"));
      return;
    }
    const msg = active
      ? t("Are you sure you want to exit Always Offroad mode?")
      : t("Are you sure you want to enter Always Offroad mode?");
    if (!(await showConfirm({ message: msg, confirmText: t("Confirm") }))) return;
    const res = await apiPut("/api/opui/params/OffroadMode", { value: active ? "0" : "1" });
    if (res.ok) toast(label);
    else toast(res.error || "Failed");
  });
  return row;
}

function renderGenericPanel(container, data) {
  container.innerHTML = "";
  for (const w of data.widgets || []) {
    const el = renderWidget(w, data);
    if (el) container.appendChild(el);
  }
}

function renderWidget(w, panelData) {
  const kind = resolveWidgetType(w);
  const offroad = globalState.is_offroad;
  if (w.offroad_only && !offroad) return null;

  if (w.visible_if) {
    const dep = panelData.values?.[w.visible_if.param];
    if (String(dep) !== String(w.visible_if.eq)) return null;
  }

  if (kind === "section") {
    const row = document.createElement("div");
    row.className = "opui-row opui-row--section";
    row.textContent = t(w.label);
    return row;
  }

  if (kind === "html") {
    const block = document.createElement("div");
    block.className = "opui-html-block";
    block.innerHTML = w.html || "";
    return block;
  }

  if (kind === "dual_button") {
    return renderDualButtonRow(w);
  }

  if (kind === "option") {
    return renderOptionRow(w);
  }

  if (kind === "action") {
    return renderActionRow(w);
  }

  if (kind === "subpanel") {
    return renderSubpanelRow(w);
  }

  if (kind === "custom") {
    if (w.custom === "ssh_keys") return renderSshKeysBlock();
    if (w.custom === "device_language") return renderLanguageRow();
    if (w.custom === "driver_camera") return renderDriverCameraRow();
    if (w.custom === "always_offroad") {
      const active = !!deviceExtrasCache?.offroad_mode;
      if (!globalState.is_offroad && !active) return null;
      return renderAlwaysOffroadRow(active);
    }
    if (w.custom === "device_calibration") return null;
    return null;
  }

  if (!w.available && w.missing) return null;

  if (kind === "readonly") {
    return renderReadonlyRow(w);
  }

  if (kind === "bool") {
    return renderBoolRow(w);
  }

  if (kind === "choice") {
    return renderChoiceRow(w);
  }

  if (kind === "int") {
    return renderIntRow(w);
  }

  return null;
}

function renderReadonlyRow(w) {
  const row = document.createElement("div");
  row.className = "opui-sp-row";
  const val = formatValue(w.value) || t("N/A");
  row.innerHTML = `
    <div class="opui-sp-row-text">
      <div class="opui-sp-row-title">${escapeHtml(t(w.label))}</div>
    </div>
    <div class="opui-row-value">${escapeHtml(val)}</div>`;
  return row;
}

function renderBoolRow(w) {
  return createSpToggle({ ...w, label: t(w.label), desc: w.desc ? t(w.desc) : "" }, {}, globalState, paramHandlers);
}

function renderChoiceRow(w) {
  const row = document.createElement("div");
  row.className = "opui-sp-row opui-sp-row--stacked";
  const opts = (w.options || []).map((o) => t(o));
  let idx = parseInt(w.value, 10);
  if (Number.isNaN(idx)) idx = 0;

  const text = document.createElement("div");
  text.className = "opui-sp-row-text";
  text.innerHTML = `
    <div class="opui-sp-row-title">${escapeHtml(t(w.label))}</div>
    ${w.desc ? `<div class="opui-sp-row-desc">${escapeHtml(t(w.desc)).replace(/\n/g, "<br>")}</div>` : ""}`;
  row.appendChild(text);

  const group = document.createElement("div");
  group.className = "opui-choice-group";
  opts.forEach((opt, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = opt;
    btn.classList.toggle("selected", i === idx);
    btn.addEventListener("click", async () => {
      group.querySelectorAll("button").forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
      const res = await apiPut(`/api/opui/params/${encodeURIComponent(w.param)}`, { value: String(i) });
      if (!res.ok) toast(res.error || t("Save failed"));
    });
    group.appendChild(btn);
  });
  row.appendChild(group);
  return row;
}

function renderIntRow(w) {
  const row = document.createElement("div");
  row.className = "opui-sp-row";
  let val = parseInt(w.value, 10);
  if (Number.isNaN(val)) val = w.min || 0;
  const min = w.min ?? 0;
  const max = w.max ?? 100;
  const step = w.step ?? 1;

  row.innerHTML = `
    <div class="opui-sp-row-text">
      <div class="opui-sp-row-title">${escapeHtml(t(w.label))}</div>
    </div>`;
  const ctrl = document.createElement("div");
  ctrl.className = "opui-int-control";
  const minus = document.createElement("button");
  minus.type = "button";
  minus.textContent = "−";
  const span = document.createElement("span");
  span.textContent = String(val);
  const plus = document.createElement("button");
  plus.type = "button";
  plus.textContent = "+";

  const save = async (v) => {
    v = Math.max(min, Math.min(max, v));
    span.textContent = String(v);
    const res = await apiPut(`/api/opui/params/${encodeURIComponent(w.param)}`, { value: String(v) });
    if (!res.ok) toast(res.error || "保存失败");
  };

  minus.addEventListener("click", () => { val = Math.max(min, val - step); save(val); });
  plus.addEventListener("click", () => { val = Math.min(max, val + step); save(val); });

  ctrl.append(minus, span, plus);
  row.appendChild(ctrl);
  return row;
}

function renderSubpanelRow(w) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "opui-simple-btn";
  btn.textContent = t(w.label);
  btn.addEventListener("click", () => {
    if (onNavigateSubpanel && w.target) onNavigateSubpanel(w.target);
  });
  return btn;
}

function formatMaxTimeLabel(index, valueMap) {
  const minutes = valueMap?.[String(index)];
  if (minutes === 0) return t("Always On");
  if (minutes == null) return String(index);
  if (minutes < 60) return `${minutes}${t("m")}`;
  const hours = Math.floor(minutes / 60);
  const label = `${hours}${t("h")}`;
  return minutes === 1800 ? `${label}${t(" (Default)")}` : label;
}

function renderOptionRow(w) {
  const row = document.createElement("div");
  row.className = "opui-sp-row opui-sp-row--stacked";
  const valueMap = w.value_map || {};
  let idx = parseInt(w.value, 10);
  if (Number.isNaN(idx)) idx = w.min || 0;
  const min = w.min ?? 0;
  const max = w.max ?? 11;
  const step = w.step ?? 1;

  const text = document.createElement("div");
  text.className = "opui-sp-row-text";
  text.innerHTML = `
    <div class="opui-sp-row-title">${escapeHtml(t(w.label))}</div>
    ${w.desc ? `<div class="opui-sp-row-desc">${escapeHtml(t(w.desc)).replace(/\n/g, "<br>")}</div>` : ""}`;
  row.appendChild(text);

  const ctrl = document.createElement("div");
  ctrl.className = "opui-int-control";
  const minus = document.createElement("button");
  minus.type = "button";
  minus.textContent = "−";
  const span = document.createElement("span");
  span.textContent = formatMaxTimeLabel(idx, valueMap);
  const plus = document.createElement("button");
  plus.type = "button";
  plus.textContent = "+";

  const save = async (v) => {
    idx = Math.max(min, Math.min(max, v));
    span.textContent = formatMaxTimeLabel(idx, valueMap);
    const res = await apiPut(`/api/opui/params/${encodeURIComponent(w.param)}`, { value: String(idx) });
    if (!res.ok) toast(res.error || t("Save failed"));
  };
  minus.addEventListener("click", () => save(idx - step));
  plus.addEventListener("click", () => save(idx + step));
  ctrl.append(minus, span, plus);
  row.appendChild(ctrl);
  return row;
}

async function runDualSideAction(side) {
  if (side.custom === "driver_camera") {
    const dlg = document.getElementById("driver-camera-dialog");
    dlg?.showModal();
    document.getElementById("driver-cam-close")?.addEventListener("click", () => dlg?.close(), { once: true });
    return;
  }
  if (side.action === "open_regulatory") {
    const reg = await apiGet("/api/opui/device/regulatory");
    await showHtml({
      title: t("Regulatory"),
      html: reg.ok ? reg.html : `<p>${t("Regulatory information unavailable")}</p>`,
    });
    return;
  }
  if (side.action === "open_training") {
    await showHtml({
      title: t("Training Guide"),
      html: `<p>${t("Review the rules, features, and limitations of sunnypilot")}</p>
        <ul><li>${t("Keep hands on wheel")}</li><li>${t("Monitor the road")}</li><li>${t("Be ready to take over at any time")}</li></ul>`,
    });
    return;
  }
  if (side.action === "reset_all_params") {
    if (!(await showConfirm({
      message: t("Are you sure you want to reset all sunnypilot settings to default? Once the settings are reset, there is no going back."),
      confirmText: t("Reset"),
    }))) return;
    if (!(await showConfirm({
      message: t("The reset cannot be undone. You have been warned."),
      confirmText: t("Confirm"),
    }))) return;
    const res = await apiPost("/api/opui/action/reset_all_params");
    if (res.ok) toast(t("Reset Settings"));
    else toast(res.error || "Failed");
    return;
  }
  if (side.action) {
    if (side.confirm && !(await showConfirm({ message: t(side.confirm), confirmText: t("Yes") }))) return;
    const res = await apiPost(`/api/opui/action/${encodeURIComponent(side.action)}`);
    if (res.ok) toast(t(side.label));
    else toast(res.error || "Failed");
  }
}

function renderDualButtonRow(w) {
  const left = w.left || {};
  const right = w.right || {};
  const offroad = globalState.is_offroad;

  const row = document.createElement("div");
  row.className = "opui-dual-row";
  const lBtn = document.createElement("button");
  lBtn.type = "button";
  lBtn.className = "opui-dual-btn";
  lBtn.textContent = t(left.label);
  const rBtn = document.createElement("button");
  rBtn.type = "button";
  rBtn.className = "opui-dual-btn";
  rBtn.textContent = t(right.label);

  if (left.toggle) {
    const on = left.value === "1" || left.value === "true";
    lBtn.classList.toggle("primary", on);
  }
  if (right.toggle) {
    const on = right.value === "1" || right.value === "true";
    rBtn.classList.toggle("primary", on);
  }
  if (left.offroad_only && !offroad) lBtn.disabled = true;
  if (right.offroad_only && !offroad) rBtn.disabled = true;

  lBtn.addEventListener("click", async () => {
    if (left.toggle && left.param) {
      const on = !(left.value === "1" || left.value === "true");
      const res = await apiPut(`/api/opui/params/${encodeURIComponent(left.param)}`, { value: on ? "1" : "0" });
      if (res.ok) {
        lBtn.classList.toggle("primary", on);
        left.value = on ? "1" : "0";
      } else toast(res.error || "Failed");
      return;
    }
    await runDualSideAction(left);
  });
  rBtn.addEventListener("click", async () => {
    if (right.toggle && right.param) {
      const on = !(right.value === "1" || right.value === "true");
      const res = await apiPut(`/api/opui/params/${encodeURIComponent(right.param)}`, { value: on ? "1" : "0" });
      if (res.ok) {
        rBtn.classList.toggle("primary", on);
        right.value = on ? "1" : "0";
      } else toast(res.error || "Failed");
      return;
    }
    await runDualSideAction(right);
  });

  row.append(lBtn, rBtn);
  return row;
}

function renderSshKeysBlock() {
  const block = document.createElement("div");
  block.className = "opui-ssh-block";
  block.innerHTML = `
    <div class="opui-row opui-row--section">GitHub SSH Keys</div>
    <div class="opui-row">
      <input type="text" class="opui-input" id="ssh-username" placeholder="GitHub username" />
      <button type="button" class="opui-btn" id="ssh-fetch">FETCH</button>
      <button type="button" class="opui-btn" id="ssh-remove">REMOVE</button>
    </div>
    <pre class="opui-ssh-keys" id="ssh-keys-preview">加载中…</pre>`;

  const refresh = async () => {
    const st = await apiGet("/api/opui/ssh/status");
    const pre = block.querySelector("#ssh-keys-preview");
    const input = block.querySelector("#ssh-username");
    if (!st.ok) {
      if (pre) pre.textContent = st.error || "SSH 不可用";
      return;
    }
    if (input && st.username) input.value = st.username;
    if (pre) pre.textContent = st.keys || "(no keys)";
  };

  block.querySelector("#ssh-fetch")?.addEventListener("click", async () => {
    const username = block.querySelector("#ssh-username")?.value || "";
    const res = await apiPost("/api/opui/ssh/fetch", { username });
    if (res.ok) toast("SSH keys 已更新");
    else toast(res.error || "获取失败");
    refresh();
  });
  block.querySelector("#ssh-remove")?.addEventListener("click", async () => {
    const res = await apiPost("/api/opui/ssh/remove");
    if (res.ok) toast("SSH keys 已删除");
    refresh();
  });
  refresh();
  return block;
}

function renderActionRow(w) {
  const row = document.createElement("div");
  row.className = "opui-sp-row";
  const disabled = (w.offroad_only && !globalState.is_offroad) || (globalState.engaged && w.action === "reset_calibration");
  let desc = w.desc ? t(w.desc) : "";
  if (w.dynamic_desc === "calibration" && deviceExtrasCache?.calibration?.desc_html) {
    desc = deviceExtrasCache.calibration.desc_html.replace(/<[^>]+>/g, " ").trim();
  }
  row.innerHTML = `
    <div class="opui-sp-row-text">
      <div class="opui-sp-row-title">${escapeHtml(t(w.label))}</div>
      ${desc ? `<div class="opui-sp-row-desc">${escapeHtml(desc)}</div>` : ""}
    </div>
    <div class="opui-row-actions">
      <button type="button" class="opui-btn" ${disabled ? "disabled" : ""}>${escapeHtml(t(w.button || "GO"))}</button>
    </div>`;
  const btn = row.querySelector("button");
  if (disabled) {
    btn.disabled = true;
    return row;
  }
  btn.addEventListener("click", async () => {
    if (w.action === "reset_calibration" && globalState.engaged) {
      toast(t("Disengage to Reset Calibration"));
      return;
    }
    if (w.confirm && !(await showConfirm({ message: t(w.confirm), confirmText: t("Yes") }))) return;
    if (w.action === "pair_device") {
      window.open("https://connect.comma.ai/", "_blank");
      return;
    }
    const res = await apiPost(`/api/opui/action/${encodeURIComponent(w.action)}`);
    if (res.ok) toast(t(w.label));
    else toast(res.error || "Failed");
  });
  return row;
}

async function renderNetworkPanel(container, data) {
  renderGenericPanel(container, data);
  const toolbar = document.createElement("div");
  toolbar.className = "opui-row";
  toolbar.innerHTML = `<button type="button" class="opui-btn" id="wifi-scan">SCAN</button>`;
  container.appendChild(toolbar);

  const list = document.createElement("div");
  list.className = "opui-wifi-list";
  container.appendChild(list);

  const paint = async () => {
    list.innerHTML = `<p class="opui-muted" style="padding:24px">Scanning…</p>`;
    const scan = await apiGet("/api/opui/wifi/scan");
    list.innerHTML = "";
    if (!scan.ok) {
      list.innerHTML = `<p class="opui-muted" style="padding:24px">Wi-Fi unavailable: ${scan.error}</p>`;
      return;
    }
    for (const n of scan.networks || []) {
      const item = document.createElement("div");
      item.className = "opui-wifi-item" + (n.connected ? " connected" : "");
      item.innerHTML = `
        <span>${escapeHtml(n.ssid)}</span>
        <span>${n.strength}%</span>
        <button type="button" class="opui-btn opui-btn--small">${n.connected ? "FORGET" : "CONNECT"}</button>`;
      const btn = item.querySelector("button");
      btn?.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (n.connected) {
          if (!(await showConfirm({ message: `Forget ${n.ssid}?`, confirmText: "Forget" }))) return;
          const res = await apiPost("/api/opui/wifi/forget", { ssid: n.ssid });
          if (res.ok) toast(`Forgot ${n.ssid}`);
          paint();
          return;
        }
        let password = "";
        if (n.security > 0) {
          password = await showKeyboard({
            title: `Password (${n.ssid})`,
            password: true,
            minLen: 8,
            maxLen: 64,
          }) || "";
          if (!password) return;
        }
        const res = await apiPost("/api/opui/wifi/connect", { ssid: n.ssid, password });
        if (res.ok) toast(`Connecting ${n.ssid}`);
        else toast(res.error || "Connect failed");
      });
      list.appendChild(item);
    }
  };
  toolbar.querySelector("#wifi-scan")?.addEventListener("click", paint);
  paint();
}

async function renderTripsPanel(container, data) {
  container.innerHTML = "";
  const trips = await apiGet("/api/opui/trips");
  if (!trips.ok) {
    container.innerHTML = `<p class="opui-muted" style="padding:48px">${escapeHtml(trips.error || "")}</p>`;
    return;
  }
  const s = trips.stats || {};
  const metric = globalState.is_metric;
  for (const [title, key] of [["All Time", "all"], ["This Week", "week"]]) {
    const block = s[key] || {};
    const card = document.createElement("div");
    card.className = "opui-trips-card";
    const dist = block.distance ?? 0;
    const distStr = metric ? Math.round(dist * 1.60934) : Math.round(dist);
    const unit = metric ? "KM" : "Miles";
    card.innerHTML = `
      <div class="opui-trips-title">${title}</div>
      <div class="opui-trips-cols">
        <div class="opui-trips-col"><div class="opui-trips-num">${block.routes || 0}</div><div class="opui-trips-unit">Drives</div></div>
        <div class="opui-trips-col"><div class="opui-trips-num">${distStr}</div><div class="opui-trips-unit">${unit}</div></div>
        <div class="opui-trips-col"><div class="opui-trips-num">${Math.round((block.minutes || 0) / 60)}</div><div class="opui-trips-unit">Hours</div></div>
      </div>`;
    container.appendChild(card);
  }
}

function formatStat(v) {
  if (v == null) return "—";
  if (typeof v === "number") return v.toFixed?.(1) ?? v;
  return String(v);
}

async function renderModelsPanel(container, data) {
  renderGenericPanel(container, data);
  const m = await apiGet("/api/opui/models");
  if (!m.ok) return;

  const pickRow = document.createElement("div");
  pickRow.className = "opui-sp-row";
  pickRow.innerHTML = `
    <div class="opui-sp-row-text">
      <div class="opui-sp-row-title">Current Model</div>
      <div class="opui-sp-row-desc">${escapeHtml(m.active_name || m.active_ref || "—")}</div>
    </div>
    <button type="button" class="opui-btn">SELECT</button>`;
  pickRow.querySelector("button")?.addEventListener("click", async () => {
    const ref = await showTree({
      title: "Select Model",
      folders: m.tree || [],
      selectedRef: m.active_ref,
      searchable: true,
    });
    if (!ref) return;
    const bundle = (m.tree || []).flatMap((f) => f.bundles || []).find((b) => b.ref === ref);
    const res = await apiPost("/api/opui/models/select", { ref, index: bundle?.index });
    if (res.ok) {
      toast("Model selected");
      await renderModelsPanel(container, data);
    } else toast(res.error || "Failed");
  });
  container.appendChild(pickRow);

  if (m.download?.name) {
    for (const part of m.download.models || [{ type: "all", progress: 0 }]) {
      container.appendChild(createProgressRow(
        `${m.download.name} — ${part.type}`,
        part.progress || 0,
      ));
    }
  }
}

async function renderOsmPanel(container, data) {
  renderGenericPanel(container, data);
  const [regions, size, prog] = await Promise.all([
    apiGet("/api/opui/osm/regions"),
    apiGet("/api/opui/osm/size"),
    apiGet("/api/opui/osm/progress"),
  ]);

  const block = document.createElement("div");
  block.className = "opui-osm-tree";
  if (size.ok) {
    const sz = document.createElement("div");
    sz.className = "opui-sp-row";
    sz.innerHTML = `<div class="opui-sp-row-text"><div class="opui-sp-row-title">Downloaded Maps</div>
      <div class="opui-sp-row-desc">${size.size_mb} MB</div></div>
      <button type="button" class="opui-btn danger">DELETE</button>`;
    sz.querySelector("button")?.addEventListener("click", async () => {
      if (!(await showConfirm({ message: "Delete ALL downloaded maps?", confirmText: "Delete" }))) return;
      toast("Delete requested");
    });
    block.appendChild(sz);
  }
  if (prog.ok && prog.active) {
    block.appendChild(createProgressRow("Downloading Map", prog.progress || 0));
  }

  const countryBtn = document.createElement("button");
  countryBtn.type = "button";
  countryBtn.className = "opui-simple-btn";
  countryBtn.textContent = "SELECT Country";
  countryBtn.addEventListener("click", async () => {
    const folders = (regions.countries || []).map((c) => ({
      name: c.title,
      bundles: [{ ref: c.name, name: c.title }],
    }));
    const ref = await showTree({ title: "Country", folders, searchable: true });
    if (!ref) return;
    const c = regions.countries.find((x) => x.name === ref);
    if (c) {
      await apiPost("/api/opui/osm/select", { country: c.name, country_title: c.title });
      toast(`Country: ${c.title}`);
    }
  });
  block.appendChild(countryBtn);
  container.appendChild(block);
}

async function renderVehiclePanel(container, data) {
  renderGenericPanel(container, data);
  const vp = await apiGet("/api/opui/vehicle/platforms");
  if (!vp.ok) return;

  const pickRow = document.createElement("div");
  pickRow.className = "opui-sp-row";
  pickRow.innerHTML = `
    <div class="opui-sp-row-text">
      <div class="opui-sp-row-title">Vehicle Platform</div>
      <div class="opui-sp-row-desc">${escapeHtml(vp.active || "Not selected")}</div>
    </div>
    <button type="button" class="opui-btn">${vp.active ? "REMOVE" : "SELECT"}</button>`;
  pickRow.querySelector("button")?.addEventListener("click", async () => {
    if (vp.active) {
      if (!(await showConfirm({ message: "Remove manual platform fingerprint?", confirmText: "Remove" }))) return;
      await apiPost("/api/opui/vehicle/select", { bundle: "" });
      toast("Platform removed");
      await renderVehiclePanel(container, data);
      return;
    }
    const folders = (vp.tree || []).map((b) => ({
      name: b.name,
      bundles: (b.platforms || []).map((p) => ({ ref: p.bundle, name: p.label })),
    }));
    const ref = await showTree({ title: "Select Vehicle", folders, searchable: true });
    if (!ref) return;
    if (!(await showConfirm({ message: "Force this vehicle fingerprint?", confirmText: "Select" }))) return;
    const res = await apiPost("/api/opui/vehicle/select", { bundle: ref });
    if (res.ok) {
      toast("Platform selected");
      await renderVehiclePanel(container, data);
    }
  });
  container.appendChild(pickRow);

  const legend = document.createElement("div");
  legend.className = "opui-vehicle-legend";
  legend.innerHTML = `
    <p><span class="dot green"></span> Fingerprinted automatically</p>
    <p><span class="dot blue"></span> Manually selected</p>
    <p><span class="dot yellow"></span> Not fingerprinted</p>`;
  container.appendChild(legend);
}

function renderLanguageRow() {
  const row = document.createElement("div");
  row.className = "opui-sp-row";
  const current = deviceExtrasCache?.languages?.find((l) => l.id === deviceExtrasCache?.current_language);
  row.innerHTML = `
    <div class="opui-sp-row-text">
      <div class="opui-sp-row-title">${escapeHtml(t("Change Language"))}</div>
      ${current ? `<div class="opui-sp-row-desc">${escapeHtml(current.label)}</div>` : ""}
    </div>
    <button type="button" class="opui-btn">${escapeHtml(t("CHANGE"))}</button>`;
  row.querySelector("button")?.addEventListener("click", async () => {
    const ex = deviceExtrasCache || await apiGet("/api/opui/device/extras");
    if (!ex.ok) return;
    const langs = ex.languages || [];
    const idx = langs.findIndex((l) => l.id === ex.current_language);
    const pick = await showMultiOption({
      title: t("Select a language"),
      options: langs.map((l) => l.label),
      selected: Math.max(0, idx),
    });
    if (pick == null) return;
    const lang = langs[pick];
    if (!lang) return;
    const res = await apiPost("/api/opui/device/language", { language: lang.id });
    if (res.ok) {
      toast(`${t("Language")}: ${lang.label}`);
      deviceExtrasCache = { ...ex, current_language: lang.id };
    }
  });
  return row;
}

function renderDriverCameraRow() {
  const row = document.createElement("div");
  row.className = "opui-sp-row";
  const disabled = !globalState.is_offroad;
  row.innerHTML = `
    <div class="opui-sp-row-text">
      <div class="opui-sp-row-title">${escapeHtml(t("Driver Camera"))}</div>
      <div class="opui-sp-row-desc">${escapeHtml(t("Preview the driver facing camera to ensure that driver monitoring has good visibility. (vehicle must be off)"))}</div>
    </div>
    <button type="button" class="opui-btn" ${disabled ? "disabled" : ""}>${escapeHtml(t("PREVIEW"))}</button>`;
  if (!disabled) {
    row.querySelector("button")?.addEventListener("click", async () => {
      const dlg = document.getElementById("driver-camera-dialog");
      dlg?.showModal();
      document.getElementById("driver-cam-close")?.addEventListener("click", () => dlg?.close(), { once: true });
    });
  }
  return row;
}

async function renderSunnylinkPanel(container, data) {
  renderGenericPanel(container, data);
  const sl = await apiGet("/api/opui/sunnylink/status");
  if (!sl.ok) return;
  const hdr = document.createElement("div");
  hdr.className = "opui-sunnylink-header";
  hdr.innerHTML = `<h2>sunnylink</h2><p style="color:${sl.tier_color}">${escapeHtml(sl.description || "")}</p>`;
  container.prepend(hdr);

  if (sl.backup?.status && sl.backup.status !== "idle") {
    container.appendChild(createProgressRow(`Backup ${sl.backup.status}`, sl.backup.progress || 0));
  }

  const pair = document.createElement("div");
  pair.className = "opui-sp-row";
  pair.innerHTML = `<div class="opui-sp-row-text"><div class="opui-sp-row-title">Pair GitHub</div></div>
    <button type="button" class="opui-btn">PAIR</button>`;
  pair.querySelector("button")?.addEventListener("click", async () => {
    const r = await apiGet("/api/opui/sunnylink/pair");
    if (r.ok && r.url) window.open(r.url, "_blank");
  });
  container.appendChild(pair);
}

async function renderFirehosePanel(container) {
  const fh = await apiGet("/api/opui/firehose");
  if (!fh.ok) {
    container.innerHTML = `<p class="opui-muted" style="padding:48px">${escapeHtml(fh.error || "")}</p>`;
    return;
  }
  container.innerHTML = "";

  const wrap = document.createElement("div");
  wrap.className = "opui-firehose-wrap";

  const title = document.createElement("h2");
  title.className = "opui-firehose-h";
  title.textContent = t("Firehose Mode");
  wrap.appendChild(title);

  const desc = document.createElement("p");
  desc.className = "opui-firehose-desc";
  desc.textContent = t(
    "sunnypilot learns to drive by watching humans, like you, drive.\n\n"
    + "Firehose Mode allows you to maximize your training data uploads to improve "
    + "openpilot's driving models. More data means bigger models, which means better Experimental Mode."
  );
  wrap.appendChild(desc);

  wrap.appendChild(document.createElement("hr"));

  const statusColor = fh.active ? "#2ecc71" : "#e74c3c";
  const status = document.createElement("p");
  status.className = "opui-firehose-status";
  status.style.color = statusColor;
  status.textContent = fh.active ? t("ACTIVE") : t("INACTIVE");
  wrap.appendChild(status);

  if (fh.segments > 0) {
    const seg = document.createElement("p");
    seg.className = "opui-firehose-segments";
    seg.textContent = `${fh.segments} ${t("segments in training dataset")}`;
    wrap.appendChild(seg);
  }

  const net = document.createElement("div");
  net.className = "opui-sp-row";
  net.innerHTML = `
    <div class="opui-sp-row-text">
      <div class="opui-sp-row-title">${escapeHtml(t("Network"))}</div>
      <div class="opui-sp-row-desc">${escapeHtml(fh.network_type || "--")}${fh.metered ? ` (${t("metered")})` : ""}</div>
    </div>`;
  wrap.appendChild(net);

  wrap.appendChild(document.createElement("hr"));

  const instructions = document.createElement("div");
  instructions.className = "opui-firehose-instructions";
  instructions.innerHTML = `
    <p>${escapeHtml(t("For maximum effectiveness, bring your device inside and connect to a good USB-C adapter and Wi-Fi weekly."))}</p>
    <p>${escapeHtml(t("Firehose Mode can also work while you're driving if connected to a hotspot or unlimited SIM card."))}</p>
    <h3>${escapeHtml(t("Frequently Asked Questions"))}</h3>
    <p><strong>${escapeHtml(t("Does it matter how or where I drive?"))}</strong> ${escapeHtml(t("Nope, just drive as you normally would."))}</p>
    <p><strong>${escapeHtml(t("Do all of my segments get pulled in Firehose Mode?"))}</strong> ${escapeHtml(t("No, we selectively pull a subset of your segments."))}</p>
    <p><strong>${escapeHtml(t("What's a good USB-C adapter?"))}</strong> ${escapeHtml(t("Any fast phone or laptop charger should be fine."))}</p>
    <p><strong>${escapeHtml(t("Does it matter which software I run?"))}</strong> ${escapeHtml(t("Yes, only upstream openpilot (and particular forks) are able to be used for training."))}</p>`;
  wrap.appendChild(instructions);

  container.appendChild(wrap);
}

async function renderSoftwarePanel(container, data) {
  renderGenericPanel(container, data);
  const sw = await apiGet("/api/opui/software");
  if (!sw.ok) return;

  const extra = document.createElement("div");
  extra.className = "opui-row";
  extra.innerHTML = `
    <div class="opui-row-label">Updater 状态</div>
    <div class="opui-row-value">${escapeHtml(sw.updater_state)} · ${sw.update_available ? "有更新" : "无更新"}</div>`;
  container.appendChild(extra);

  if (sw.new_description) {
    const notes = document.createElement("div");
    notes.className = "opui-html-block";
    notes.innerHTML = `<h3>Release Notes</h3><pre>${escapeHtml(sw.new_description)}</pre>`;
    container.appendChild(notes);
  }

  if (sw.branches?.length) {
    const branchRow = document.createElement("div");
    branchRow.className = "opui-sp-row";
    branchRow.innerHTML = `<div class="opui-sp-row-text"><div class="opui-sp-row-title">Target Branch</div></div>
      <button type="button" class="opui-btn">SELECT</button>`;
    branchRow.querySelector("button")?.addEventListener("click", async () => {
      const idx = Math.max(0, sw.branches.indexOf(sw.target_branch));
      const pick = await showMultiOption({ title: "Branch", options: sw.branches, selected: idx });
      if (pick == null) return;
      const b = sw.branches[pick];
      const res = await apiPost("/api/opui/action/set_branch", { branch: b });
      if (res.ok) toast(`Branch: ${b}`);
    });
    container.appendChild(branchRow);
  }
}

function formatValue(v) {
  if (v == null || v === "") return "—";
  if (v.length > 200) return v.slice(0, 200) + "…";
  return v;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, "&#39;");
}
