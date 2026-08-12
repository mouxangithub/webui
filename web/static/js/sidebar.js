/** 300px metrics sidebar — layout matches openpilot/selfdrive/ui/layouts/sidebar.py */

const METRIC_LABELS = {
  TEMP: "温度",
  VEHICLE: "车辆",
  CONNECT: "连接",
  SUNNYLINK: "阳光联",
};

const VALUE_ZH = {
  GOOD: "良好",
  HIGH: "偏高",
  ONLINE: "在线",
  OFFLINE: "离线",
  ERROR: "错误",
  CONNECTED: "在线",
  DISABLED: "已关闭",
  "REGIST...": "注册中…",
  FAULT: "故障",
  NO: "否",
  PANDA: "PANDA",
};

const METRIC_KEYS = ["temp", "vehicle", "connect", "sunnylink"];

function zhValue(raw) {
  if (!raw) return "--";
  const key = String(raw).toUpperCase().replace(/\s+/g, "");
  return VALUE_ZH[key] || raw;
}

function toneFlags(tone) {
  return {
    warn: tone === "warn",
    danger: tone === "danger",
    disabled: tone === "disabled",
    progress: tone === "progress",
  };
}

function ensureMetricsDom() {
  const metrics = document.getElementById("metrics");
  if (!metrics) return null;
  if (metrics.dataset.ready === "1") return metrics;
  metrics.innerHTML = METRIC_KEYS.map((key) => `
    <div class="opui-metric" data-metric="${key}">
      <div class="opui-metric-bar"></div>
      <div class="opui-metric-text">
        <span class="opui-metric-line opui-metric-label"></span>
        <span class="opui-metric-line opui-metric-value"></span>
      </div>
    </div>`).join("");
  metrics.dataset.ready = "1";
  return metrics;
}

function setMetric(key, { label, value, warn, danger, disabled, progress, visible }) {
  const metrics = ensureMetricsDom();
  if (!metrics) return;
  const row = metrics.querySelector(`[data-metric="${key}"]`);
  if (!row) return;
  row.hidden = visible === false;
  row.classList.toggle("opui-metric--danger", !!danger);
  row.classList.toggle("opui-metric--warn", !!warn && !danger && !disabled && !progress);
  row.classList.toggle("opui-metric--disabled", !!disabled);
  row.classList.toggle("opui-metric--progress", !!progress);
  const labelEl = row.querySelector(".opui-metric-label");
  const valueEl = row.querySelector(".opui-metric-value");
  if (labelEl) labelEl.textContent = label;
  if (valueEl) valueEl.textContent = value;
}

let lastNetType = "";
let lastNetStrength = -1;

export function updateSidebarMetrics(st) {
  if (!st?.ok) return;

  const d = st.device || {};
  const thermalOk = d.thermal === "ok";

  setMetric("temp", {
    label: METRIC_LABELS.TEMP,
    value: thermalOk ? zhValue("GOOD") : zhValue("HIGH"),
    danger: !thermalOk,
    visible: true,
  });

  if (d.panda_unknown) {
    setMetric("vehicle", {
      label: zhValue("NO"),
      value: zhValue("PANDA"),
      danger: true,
      visible: true,
    });
  } else {
    setMetric("vehicle", {
      label: METRIC_LABELS.VEHICLE,
      value: zhValue("ONLINE"),
      visible: true,
    });
  }

  const athena = String(d.athena_status || "").toUpperCase();
  setMetric("connect", {
    label: METRIC_LABELS.CONNECT,
    value: zhValue(d.athena_status) || (athena === "ONLINE" ? "在线" : "离线"),
    ...toneFlags(
      athena === "ONLINE" ? "good"
        : athena === "ERROR" ? "danger"
          : "warn",
    ),
    visible: true,
  });

  const sl = d.sunnylink || {};
  setMetric("sunnylink", {
    label: METRIC_LABELS.SUNNYLINK,
    value: zhValue(sl.status || "OFFLINE"),
    ...toneFlags(sl.tone || "warn"),
    visible: true,
  });

  updateNetworkIndicator(d);
}

function updateNetworkIndicator(d) {
  const wrap = document.getElementById("sidebar-network");
  if (!wrap) return;

  const strength = Math.max(0, Math.min(5, Number(d.network_strength) || 0));
  const netType = d.network_type && d.network_type !== "--" ? d.network_type : "Wi-Fi";
  const typeEl = wrap.querySelector(".opui-net-type");
  const dotsEl = wrap.querySelector(".opui-net-dots");

  if (typeEl && netType !== lastNetType) {
    typeEl.textContent = netType;
    lastNetType = netType;
  }

  if (!dotsEl) return;
  if (strength === lastNetStrength && dotsEl.childElementCount === 5) return;
  lastNetStrength = strength;

  if (dotsEl.childElementCount !== 5) {
    dotsEl.innerHTML = Array.from({ length: 5 }, (_, i) =>
      `<span class="opui-net-dot" data-dot="${i}"></span>`).join("");
  }
  dotsEl.querySelectorAll(".opui-net-dot").forEach((dot, i) => {
    dot.classList.toggle("opui-net-dot--on", i < strength);
  });
}

export function updateSidebarMode(started) {
  const bottomBtn = document.getElementById("btn-sidebar-bottom");
  if (!bottomBtn) return;
  bottomBtn.classList.toggle("opui-sidebar-btn--flag", !!started);
  bottomBtn.classList.toggle("opui-sidebar-btn--home", !started);
  bottomBtn.disabled = !started;
}
