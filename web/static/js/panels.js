import { apiGet, apiPost, apiPut, confirmDialog, toast } from "./api.js";

let globalState = { started: false, engaged: false, is_offroad: true };

export function setGlobalState(st) {
  globalState = st || globalState;
}

export async function loadPanelList() {
  const data = await apiGet("/api/opui/panels");
  return data.ok ? data.panels : [];
}

export async function renderPanel(panelId, container, titleEl) {
  const data = await apiGet(`/api/opui/panels/${encodeURIComponent(panelId)}`);
  if (!data.ok) {
    container.innerHTML = `<p class="opui-muted" style="padding:48px">加载失败: ${data.error}</p>`;
    return;
  }
  if (titleEl) titleEl.textContent = data.title;

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
    renderGenericPanel(container, data);
    return;
  }

  renderGenericPanel(container, data);
}

function renderGenericPanel(container, data) {
  container.innerHTML = "";
  for (const w of data.widgets || []) {
    const el = renderWidget(w, data);
    if (el) container.appendChild(el);
  }
}

function renderWidget(w, panelData) {
  const offroad = globalState.is_offroad;
  if (w.offroad_only && !offroad) return null;

  if (w.visible_if) {
    const dep = panelData.values?.[w.visible_if.param];
    if (dep !== w.visible_if.eq) return null;
  }

  if (w.type === "section") {
    const row = document.createElement("div");
    row.className = "opui-row opui-row--section";
    row.textContent = w.label;
    return row;
  }

  if (w.type === "html") {
    const block = document.createElement("div");
    block.className = "opui-html-block";
    block.innerHTML = w.html || "";
    return block;
  }

  if (w.type === "action") {
    return renderActionRow(w);
  }

  if (!w.available && w.missing) return null;

  if (w.type === "readonly") {
    return renderReadonlyRow(w);
  }

  if (w.type === "bool") {
    return renderBoolRow(w);
  }

  if (w.type === "choice") {
    return renderChoiceRow(w);
  }

  if (w.type === "int") {
    return renderIntRow(w);
  }

  return null;
}

function renderReadonlyRow(w) {
  const row = document.createElement("div");
  row.className = "opui-row";
  const val = formatValue(w.value);
  row.innerHTML = `
    <div class="opui-row-label">${escapeHtml(w.label)}</div>
    <div class="opui-row-value">${escapeHtml(val)}</div>`;
  return row;
}

function renderBoolRow(w) {
  const row = document.createElement("div");
  row.className = "opui-row";
  const checked = w.value === "1" || w.value === "true";
  const disabled = w.locked || (w.needs_cycle && globalState.engaged);
  row.innerHTML = `
    <div class="opui-row-label">${escapeHtml(w.label)}</div>
    <input type="checkbox" class="opui-toggle" ${checked ? "checked" : ""} ${disabled ? "disabled" : ""} />`;
  const input = row.querySelector("input");
  input.addEventListener("change", async () => {
    if (w.confirm_experimental && input.checked) {
      const ok = await confirmDialog("启用 Experimental Mode？此功能为 alpha 质量。");
      if (!ok) {
        input.checked = false;
        return;
      }
      await apiPut("/api/opui/params/ExperimentalModeConfirmed", { value: "1" });
    }
    const res = await apiPut(`/api/opui/params/${encodeURIComponent(w.param)}`, {
      value: input.checked ? "1" : "0",
      needs_cycle: !!w.needs_cycle,
    });
    if (!res.ok) {
      toast(res.error || "保存失败");
      input.checked = !input.checked;
    }
  });
  return row;
}

function renderChoiceRow(w) {
  const row = document.createElement("div");
  row.className = "opui-row";
  const opts = w.options || [];
  let idx = parseInt(w.value, 10);
  if (Number.isNaN(idx)) idx = 0;

  const label = document.createElement("div");
  label.className = "opui-row-label";
  label.textContent = w.label;
  row.appendChild(label);

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
      if (!res.ok) toast(res.error || "保存失败");
    });
    group.appendChild(btn);
  });
  row.appendChild(group);
  return row;
}

function renderIntRow(w) {
  const row = document.createElement("div");
  row.className = "opui-row";
  let val = parseInt(w.value, 10);
  if (Number.isNaN(val)) val = w.min || 0;
  const min = w.min ?? 0;
  const max = w.max ?? 100;
  const step = w.step ?? 1;

  row.innerHTML = `<div class="opui-row-label">${escapeHtml(w.label)}</div>`;
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

function renderActionRow(w) {
  const row = document.createElement("div");
  row.className = "opui-row";
  const disabled = w.offroad_only && !globalState.is_offroad;
  row.innerHTML = `
    <div>
      <div class="opui-row-label">${escapeHtml(w.label)}</div>
      ${w.desc ? `<div class="opui-row-desc">${escapeHtml(w.desc)}</div>` : ""}
    </div>
    <div class="opui-row-actions">
      <button type="button" class="opui-btn" ${disabled ? "disabled" : ""}>${escapeHtml(w.button || "GO")}</button>
    </div>`;
  const btn = row.querySelector("button");
  if (disabled) return row;
  btn.addEventListener("click", async () => {
    if (w.confirm && !(await confirmDialog(w.confirm))) return;
    if (w.action === "pair_device") {
      window.open("https://connect.comma.ai/", "_blank");
      return;
    }
    const res = await apiPost(`/api/opui/action/${encodeURIComponent(w.action)}`);
    if (res.ok) toast(`${w.label} 已执行`);
    else toast(res.error || "操作失败");
  });
  return row;
}

async function renderNetworkPanel(container, data) {
  renderGenericPanel(container, data);
  const list = document.createElement("div");
  list.className = "opui-wifi-list";
  list.innerHTML = `<p class="opui-muted" style="padding:24px">扫描 Wi-Fi…</p>`;
  container.appendChild(list);

  const scan = await apiGet("/api/opui/wifi/scan");
  list.innerHTML = "";
  if (!scan.ok) {
    list.innerHTML = `<p class="opui-muted" style="padding:24px">Wi-Fi 不可用: ${scan.error}</p>`;
    return;
  }
  for (const n of scan.networks || []) {
    const item = document.createElement("div");
    item.className = "opui-wifi-item" + (n.connected ? " connected" : "");
    item.innerHTML = `<span>${escapeHtml(n.ssid)}</span><span>${n.strength}%</span>`;
    item.addEventListener("click", async () => {
      let password = "";
      if (n.security > 0) {
        password = window.prompt(`密码 (${n.ssid}):`, "") || "";
      }
      const res = await apiPost("/api/opui/wifi/connect", { ssid: n.ssid, password });
      if (res.ok) toast(`正在连接 ${n.ssid}`);
      else toast(res.error || "连接失败");
    });
    list.appendChild(item);
  }
}

async function renderTripsPanel(container, data) {
  renderGenericPanel(container, data);
  const trips = await apiGet("/api/opui/trips");
  const block = document.createElement("div");
  block.className = "opui-html-block";
  if (!trips.ok) {
    block.innerHTML = `<p>统计不可用: ${escapeHtml(trips.error || "")}</p>`;
  } else {
    const s = trips.stats || {};
    const all = s.all || s;
    block.innerHTML = `
      <h3>驾驶统计</h3>
      <p>总里程: ${formatStat(all.distance)} · 行程: ${all.routes || all.drives || "—"} · 时长: ${formatStat(all.minutes)} 分钟</p>
      <p>本周: ${formatStat((s.week || {}).distance)} · 本月: ${formatStat((s.month || {}).distance)}</p>`;
  }
  container.appendChild(block);
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
  const block = document.createElement("div");
  block.className = "opui-row";
  block.innerHTML = `
    <div class="opui-row-label">模型管理器</div>
    <div class="opui-row-value">${escapeHtml(String(m.active_bundle || m.active || "—").slice(0, 80))}</div>`;
  container.appendChild(block);
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

  if (sw.branches?.length) {
    const branchRow = document.createElement("div");
    branchRow.className = "opui-row";
    branchRow.innerHTML = `<div class="opui-row-label">切换分支</div>`;
    const group = document.createElement("div");
    group.className = "opui-choice-group";
    for (const b of sw.branches.slice(0, 8)) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = b;
      if (b === sw.target_branch) btn.classList.add("selected");
      btn.addEventListener("click", async () => {
        const res = await apiPost("/api/opui/action/set_branch", { branch: b });
        if (res.ok) toast(`目标分支: ${b}`);
      });
      group.appendChild(btn);
    }
    branchRow.appendChild(group);
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
