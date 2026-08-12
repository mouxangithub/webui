/**
 * sunnypilot BIG UI widget kit — dialogs + list rows matching raylib interactions.
 */

import { tr } from "./i18n.js";

const stack = [];

function paramIsOn(val) {
  const v = String(val ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "on";
}

function experimentalE2eHtml() {
  return (
    `<h1>${tr("Experimental Mode")}</h1><br>`
    + `<p>${tr(
      "sunnypilot defaults to driving in chill mode. Experimental mode enables alpha-level features that aren't ready for chill mode. "
      + "Experimental features are listed below:",
    )}</p>`
    + `<h4>${tr("End-to-End Longitudinal Control")}</h4><br>`
    + `<p>${tr(
      "Let the driving model control the gas and brakes. sunnypilot will drive as it thinks a human would, including stopping for red lights and stop signs. "
      + "Since the driving model decides the speed to drive, the set speed will only act as an upper bound. This is an alpha quality feature; mistakes should be expected.",
    )}</p>`
    + `<h4>${tr("New Driving Visualization")}</h4><br>`
    + `<p>${tr(
      "The driving visualization will transition to the road-facing wide-angle camera at low speeds to better show some turns. "
      + "The Experimental mode logo will also be shown in the top right corner.",
    )}</p>`
  );
}

function pushModal(el) {
  if (!el) return;
  stack.push(el);
  el.removeAttribute("hidden");
  el.setAttribute("aria-hidden", "false");
  document.body.classList.add("opui-modal-open");
}

function popModal(el) {
  if (!el) return;
  const i = stack.indexOf(el);
  if (i >= 0) stack.pop();
  el.setAttribute("hidden", "");
  el.setAttribute("aria-hidden", "true");
  if (!stack.length) document.body.classList.remove("opui-modal-open");
}

export function showConfirm(opts) {
  const {
    message = "",
    rich = false,
    confirmText = "Confirm",
    cancelText = "Cancel",
    single = false,
  } = typeof opts === "string" ? { message: opts } : opts;

  return new Promise((resolve) => {
    const root = document.getElementById("modal-confirm");
    const msg = document.getElementById("modal-confirm-msg");
    const ok = document.getElementById("modal-confirm-ok");
    const cancel = document.getElementById("modal-confirm-cancel");
    if (!root || !msg) {
      resolve(window.confirm(message));
      return;
    }
    if (rich) {
      msg.innerHTML = message;
      msg.classList.add("opui-rich");
    } else {
      msg.textContent = message;
      msg.classList.remove("opui-rich");
    }
    ok.textContent = confirmText;
    cancel.textContent = cancelText;
    cancel.hidden = single;
    pushModal(root);
    const done = (v) => {
      popModal(root);
      ok.removeEventListener("click", onOk);
      cancel.removeEventListener("click", onCancel);
      root.removeEventListener("cancel", onCancel);
      resolve(v);
    };
    const onOk = () => done(true);
    const onCancel = () => done(false);
    ok.addEventListener("click", onOk);
    cancel.addEventListener("click", onCancel);
    root.addEventListener("cancel", onCancel);
  });
}

export function showKeyboard(opts = {}) {
  const {
    title = "Enter text",
    value = "",
    password = false,
    minLen = 0,
    maxLen = 64,
  } = opts;

  return new Promise((resolve) => {
    const root = document.getElementById("modal-keyboard");
    const titleEl = document.getElementById("keyboard-title");
    const display = document.getElementById("keyboard-display");
    const grid = document.getElementById("keyboard-grid");
    if (!root || !grid || !display) {
      resolve(window.prompt(title, value));
      return;
    }
    titleEl.textContent = title;
    let buf = value;
    const render = () => {
      display.textContent = password ? "•".repeat(buf.length) : buf;
    };
    render();

    const layouts = {
      alpha: [
        "123", "q", "w", "e", "r", "t", "y", "u", "i", "o", "p",
        "ABC", "a", "s", "d", "f", "g", "h", "j", "k", "l", "⌫",
        "#+=", "z", "x", "c", "v", "b", "n", "m", "Enter",
      ],
      num: [
        "ABC", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0",
        "", "-", "_", ".", "@", "", "", "", "", "⌫", "Enter",
      ],
    };
    let mode = "alpha";

    const paint = () => {
      grid.innerHTML = "";
      for (const key of layouts[mode]) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "opui-kb-key" + (key === "Enter" ? " opui-kb-key--wide" : "");
        btn.textContent = key || "";
        if (!key) btn.disabled = true;
        btn.addEventListener("click", () => {
          if (key === "⌫") buf = buf.slice(0, -1);
          else if (key === "Enter") {
            if (buf.length >= minLen) finish(buf);
          } else if (key === "123") mode = "num";
          else if (key === "ABC") mode = "alpha";
          else if (key === "#+=") mode = "num";
          else if (buf.length < maxLen) buf += key;
          render();
          if (key === "123" || key === "ABC" || key === "#+=") paint();
        });
        grid.appendChild(btn);
      }
    };
    paint();

    const finish = (v) => {
      popModal(root);
      resolve(v);
    };
    document.getElementById("keyboard-cancel")?.addEventListener("click", () => finish(null), { once: true });
    pushModal(root);
  });
}

export function showMultiOption(opts) {
  const { title = "Select", options = [], selected = 0 } = opts;
  return new Promise((resolve) => {
    const root = document.getElementById("modal-multi");
    const titleEl = document.getElementById("multi-title");
    const list = document.getElementById("multi-list");
    if (!root || !list) {
      resolve(selected);
      return;
    }
    titleEl.textContent = title;
    list.innerHTML = "";
    options.forEach((opt, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "opui-multi-opt" + (i === selected ? " selected" : "");
      btn.textContent = typeof opt === "string" ? opt : opt.label;
      btn.addEventListener("click", () => {
        popModal(root);
        resolve(i);
      });
      list.appendChild(btn);
    });
    document.getElementById("multi-cancel")?.addEventListener("click", () => {
      popModal(root);
      resolve(null);
    }, { once: true });
    pushModal(root);
  });
}

export function showTree(opts) {
  const {
    title = "Select",
    folders = [],
    selectedRef = "",
    searchable = true,
    onFavorite,
  } = opts;

  return new Promise((resolve) => {
    const root = document.getElementById("modal-tree");
    const titleEl = document.getElementById("tree-title");
    const body = document.getElementById("tree-body");
    const searchWrap = document.getElementById("tree-search-wrap");
    const search = document.getElementById("tree-search");
    const selectBtn = document.getElementById("tree-select");
    if (!root || !body) {
      resolve(null);
      return;
    }
    titleEl.textContent = title;
    searchWrap.hidden = !searchable;
    let pick = selectedRef;
    let query = "";

    const render = () => {
      body.innerHTML = "";
      const q = query.toLowerCase();
      for (const folder of folders) {
        const bundles = (folder.bundles || []).filter((b) => {
          const label = (b.name || b.ref || "").toLowerCase();
          return !q || label.includes(q) || (folder.name || "").toLowerCase().includes(q);
        });
        if (!bundles.length) continue;
        const hdr = document.createElement("div");
        hdr.className = "opui-tree-folder";
        hdr.textContent = folder.name || "Models";
        body.appendChild(hdr);
        for (const b of bundles) {
          const row = document.createElement("button");
          row.type = "button";
          row.className = "opui-tree-item" + (b.ref === pick ? " selected" : "");
          row.innerHTML = `<span>${escapeHtml(b.name || b.ref)}</span>`;
          if (onFavorite) {
            const star = document.createElement("span");
            star.className = "opui-tree-star";
            star.textContent = b.fav ? "★" : "☆";
            star.addEventListener("click", (e) => {
              e.stopPropagation();
              onFavorite(b.ref);
              b.fav = !b.fav;
              render();
            });
            row.appendChild(star);
          }
          row.addEventListener("click", () => {
            pick = b.ref;
            selectBtn.disabled = pick === selectedRef;
            render();
          });
          body.appendChild(row);
        }
      }
    };

    search.oninput = () => { query = search.value; render(); };
    selectBtn.disabled = true;
    selectBtn.onclick = () => {
      popModal(root);
      resolve(pick);
    };
    document.getElementById("tree-cancel")?.addEventListener("click", () => {
      popModal(root);
      resolve(null);
    }, { once: true });
    render();
    pushModal(root);
  });
}

export function showHtml(opts) {
  const { title = "", html = "" } = opts;
  return new Promise((resolve) => {
    const root = document.getElementById("modal-html");
    document.getElementById("html-title").textContent = title;
    document.getElementById("html-body").innerHTML = html;
    document.getElementById("html-ok")?.addEventListener("click", () => {
      popModal(root);
      resolve(true);
    }, { once: true });
    pushModal(root);
  });
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function bindRowExpand(row, w) {
  const text = row.querySelector(".opui-sp-row-text");
  if (!text) return;
  const hasDesc = !!(w.desc || w.confirm_experimental);
  if (!hasDesc) return;

  if (w.desc && !text.querySelector(".opui-sp-row-desc--expandable:not(.opui-sp-row-desc--experimental)")) {
    const descEl = document.createElement("div");
    descEl.className = "opui-sp-row-desc opui-sp-row-desc--expandable";
    descEl.hidden = true;
    descEl.innerHTML = escapeHtml(w.desc).replace(/\n/g, "<br>");
    text.appendChild(descEl);
  }
  if (w.confirm_experimental && !text.querySelector(".opui-sp-row-desc--experimental")) {
    const expDesc = document.createElement("div");
    expDesc.className = "opui-sp-row-desc opui-sp-row-desc--expandable opui-sp-row-desc--experimental";
    expDesc.hidden = true;
    text.appendChild(expDesc);
  }

  text.classList.add("opui-sp-row-text--expandable");
  text.addEventListener("click", (e) => {
    if (e.target.closest("label, button, input, .opui-sp-toggle, .opui-multi-btn-group, .opui-option-bar, .opui-choice-group")) {
      return;
    }
    let open = false;
    text.querySelectorAll(".opui-sp-row-desc--expandable").forEach((el) => {
      el.hidden = !el.hidden;
      if (!el.hidden) open = true;
    });
    row.classList.toggle("opui-sp-row--desc-open", open);
  });
}

export function createSpToggle(w, panelData, globalState, handlers) {
  const row = document.createElement("div");
  row.className = "opui-sp-row" + (w.stacked ? " opui-sp-row--stacked opui-sp-row--toggle-below" : "");
  const checked = paramIsOn(w.value);
  const disabled = w.locked || (w.needs_cycle && globalState.engaged) || (w.offroad_only && !globalState.is_offroad);
  const toggleHtml = `
    <label class="opui-sp-toggle${disabled ? " disabled" : ""}${checked ? " on" : ""}">
      <input type="checkbox" ${checked ? "checked" : ""} ${disabled ? "disabled" : ""} />
      <span class="opui-sp-toggle-track"><span class="opui-sp-toggle-thumb"></span></span>
    </label>`;
  const textHtml = `
    <div class="opui-sp-row-text">
      ${w.label ? `<div class="opui-sp-row-title">${escapeHtml(w.label)}${w.locked ? " 🔒" : ""}</div>` : ""}
      ${w.needs_cycle ? `<div class="opui-sp-row-desc opui-sp-row-desc--hint">${tr("Changing this setting will restart sunnypilot if the car is powered on.")}</div>` : ""}
    </div>`;
  row.innerHTML = w.stacked ? `${textHtml}${toggleHtml}` : `${toggleHtml}${textHtml}`;
  bindRowExpand(row, { ...w, desc: w.desc || "" });
  const input = row.querySelector("input");
  const label = row.querySelector(".opui-sp-toggle");
  input?.addEventListener("change", async () => {
    if (w.confirm_experimental && input.checked) {
      const ok = await showConfirm({
        rich: true,
        message: experimentalE2eHtml(),
        confirmText: tr("Enable"),
        cancelText: tr("Cancel"),
      });
      if (!ok) {
        input.checked = false;
        label?.classList.remove("on");
        return;
      }
      await handlers.putParam("ExperimentalModeConfirmed", "1");
    }
    label?.classList.toggle("on", input.checked);
    const res = await handlers.putParam(w.param, input.checked ? "1" : "0", !!w.needs_cycle);
    if (!res.ok) {
      handlers.toast(res.error || "Save failed");
      input.checked = !input.checked;
      label?.classList.toggle("on", input.checked);
    }
  });
  return row;
}

export function createProgressRow(label, pct) {
  const row = document.createElement("div");
  row.className = "opui-sp-row opui-sp-row--progress";
  row.innerHTML = `
    <div class="opui-sp-row-text"><div class="opui-sp-row-title">${escapeHtml(label)}</div></div>
    <div class="opui-progress"><div class="opui-progress-fill" style="width:${Math.round(pct * 100)}%"></div></div>`;
  return row;
}

export function createDualButton(left, right, onLeft, onRight) {
  const row = document.createElement("div");
  row.className = "opui-dual-row";
  row.innerHTML = `
    <button type="button" class="opui-dual-btn${left.danger ? " danger" : ""}" ${left.disabled ? "disabled" : ""}>${escapeHtml(left.label)}</button>
    <button type="button" class="opui-dual-btn${right.danger ? " danger" : ""}" ${right.disabled ? "disabled" : ""}>${escapeHtml(right.label)}</button>`;
  const [l, r] = row.querySelectorAll("button");
  l?.addEventListener("click", onLeft);
  r?.addEventListener("click", onRight);
  return row;
}
