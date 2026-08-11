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
};

function zhValue(raw) {
  if (!raw) return "--";
  const key = String(raw).toUpperCase().replace(/\s+/g, "");
  return VALUE_ZH[key] || raw;
}

export function updateSidebarMetrics(st) {
  if (!st?.ok) return;

  const metrics = document.getElementById("metrics");
  if (!metrics) return;

  const d = st.device || {};
  const thermal = d.thermal === "green" || d.thermal === "ok";
  const tempVal = thermal ? "良好" : d.cpu_temp != null ? `${d.cpu_temp}°C` : "偏高";

  const items = [
    {
      label: METRIC_LABELS.TEMP,
      value: tempVal,
      warn: d.thermal === "yellow",
      danger: d.thermal === "red",
    },
    {
      label: METRIC_LABELS.VEHICLE,
      value: d.panda_online ? "在线" : "离线",
      danger: !d.panda_online,
    },
    {
      label: METRIC_LABELS.CONNECT,
      value: zhValue(d.athena_status) || (String(d.athena_status || "").includes("CONNECTED") ? "在线" : "离线"),
      warn: !String(d.athena_status || "").includes("CONNECTED"),
    },
  ];

  if (d.sunnylink_status || d.sunnylink_ping) {
    const sl = d.sunnylink_status || (d.sunnylink_ping ? "ONLINE" : "OFFLINE");
    items.push({
      label: METRIC_LABELS.SUNNYLINK,
      value: zhValue(sl),
      warn: sl === "OFFLINE" || sl === "FAULT",
      danger: sl === "ERROR",
    });
  }

  metrics.innerHTML = items.map((m) => `
    <div class="opui-metric${m.danger ? " opui-metric--danger" : m.warn ? " opui-metric--warn" : ""}">
      <div class="opui-metric-bar"></div>
      <div class="opui-metric-text">
        <span class="opui-metric-line">${m.label}</span>
        <span class="opui-metric-line">${m.value}</span>
      </div>
    </div>`).join("");

  updateNetworkIndicator(d);
}

function updateNetworkIndicator(d) {
  const wrap = document.getElementById("sidebar-network");
  if (!wrap) return;

  const strength = Math.max(0, Math.min(5, Number(d.network_strength) || 5));
  const typeEl = wrap.querySelector(".opui-net-type");
  const dotsEl = wrap.querySelector(".opui-net-dots");
  if (typeEl) typeEl.textContent = d.network_type || "Wi-Fi";
  if (dotsEl) {
    dotsEl.innerHTML = Array.from({ length: 5 }, (_, i) =>
      `<span class="opui-net-dot${i < strength ? " opui-net-dot--on" : ""}"></span>`).join("");
  }
}

export function updateSidebarMode(started) {
  const bottomBtn = document.getElementById("btn-sidebar-bottom");
  if (!bottomBtn) return;
  bottomBtn.classList.toggle("opui-sidebar-btn--flag", !!started);
  bottomBtn.classList.toggle("opui-sidebar-btn--home", !started);
  bottomBtn.disabled = !started;
}
