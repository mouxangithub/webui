/** Developer UI overlay — bottom bar + right column (developer_ui/__init__.py). */

export function updateDevUi(st) {
  const bottom = document.getElementById("dev-ui-bottom");
  const right = document.getElementById("dev-ui-right");
  const data = st?.dev_ui;

  if (!data || !st?.started) {
    if (bottom) bottom.hidden = true;
    if (right) right.hidden = true;
    return;
  }

  const mode = Number(data.mode) || 0;
  const showBottom = mode === 1 || mode === 3;
  const showRight = mode === 2 || mode === 3;

  if (bottom) {
    bottom.hidden = !showBottom;
    if (showBottom) renderBar(bottom, data.bottom || []);
  }
  if (right) {
    right.hidden = !showRight;
    if (showRight) renderColumn(right, data.right || []);
  }
}

function renderBar(container, items) {
  container.innerHTML = items.map((el) => `
    <span class="opui-dev-ui-item">
      <span class="opui-dev-ui-label">${escapeHtml(el.label)}</span>
      <span class="opui-dev-ui-value" style="color:${el.color || "#fff"}">${escapeHtml(el.value)}</span>
      ${el.unit ? `<span class="opui-dev-ui-unit">${escapeHtml(el.unit)}</span>` : ""}
    </span>`).join("");
}

function renderColumn(container, items) {
  container.innerHTML = items.map((el) => `
    <div class="opui-dev-ui-col">
      <div class="opui-dev-ui-col-label">${escapeHtml(el.label)}</div>
      <div class="opui-dev-ui-col-value" style="color:${el.color || "#fff"}">${escapeHtml(el.value)}</div>
      ${el.unit ? `<div class="opui-dev-ui-col-unit">${escapeHtml(el.unit)}</div>` : ""}
    </div>`).join("");
}

function escapeHtml(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
