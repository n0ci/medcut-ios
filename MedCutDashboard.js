function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
}

function renderDashboardHTML(appName, payloadJson) {
  return `<!doctype html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<style>
  :root {
    color-scheme: dark;
    --bg-1: #060d1a;
    --bg-2: #101b31;
    --panel: rgba(255,255,255,0.06);
    --panel-border: rgba(255,255,255,0.10);
    --text: #e5eefc;
    --muted: #9fb1cc;
    --good: #86efac;
    --rough: #fde68a;
    --low: #fca5a5;
  }
  body {
    margin: 0;
    padding: 18px;
    background: radial-gradient(circle at 15% 0%, #16325f 0%, transparent 38%), linear-gradient(180deg, var(--bg-1), var(--bg-2));
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
  }
  h1 {
    margin: 0;
    font-size: 24px;
    letter-spacing: 0.2px;
  }
  .muted {
    margin-top: 6px;
    color: var(--muted);
    font-size: 13px;
  }
  .cards {
    display: grid;
    grid-template-columns: repeat(2,minmax(0,1fr));
    gap: 10px;
    margin: 14px 0 18px;
  }
  .card {
    background: var(--panel);
    border: 1px solid var(--panel-border);
    border-radius: 16px;
    padding: 12px;
    backdrop-filter: blur(6px);
  }
  .name {
    font-weight: 700;
    font-size: 14px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .dot {
    width: 10px;
    height: 10px;
    border-radius: 999px;
    display: inline-block;
    box-shadow: 0 0 8px rgba(255,255,255,0.35);
  }
  .big {
    font-size: 22px;
    font-weight: 800;
    margin-top: 8px;
  }
  .small {
    margin-top: 4px;
    font-size: 12px;
    color: var(--muted);
  }
  .badge {
    margin-top: 7px;
    display: inline-block;
    font-size: 11px;
    border-radius: 999px;
    padding: 4px 8px;
    border: 1px solid rgba(255,255,255,0.16);
  }
  .badge.good { color: var(--good); }
  .badge.rough { color: var(--rough); }
  .badge.low { color: var(--low); }
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 10px 0 12px;
  }
  .pill, select {
    background: rgba(255,255,255,0.08);
    color: #fff;
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 999px;
    padding: 8px 12px;
    font-size: 13px;
  }
  .toggles {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin: 10px 0 12px;
    color: var(--muted);
    font-size: 12px;
  }
  .toggles label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 10px;
    border: 1px solid rgba(255,255,255,0.14);
    border-radius: 999px;
    background: rgba(255,255,255,0.04);
  }
  .chart-wrap {
    background: var(--panel);
    border: 1px solid var(--panel-border);
    border-radius: 18px;
    padding: 12px;
  }
  .empty {
    margin-top: 18px;
    background: var(--panel);
    border: 1px solid var(--panel-border);
    border-radius: 14px;
    padding: 16px;
    color: var(--muted);
  }
  canvas {
    width: 100%;
    height: 320px;
    display: block;
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 10px;
  }
  .legend label {
    background: rgba(255,255,255,0.06);
    border-radius: 999px;
    padding: 7px 10px;
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
    border: 1px solid rgba(255,255,255,0.08);
  }
  .footer {
    margin-top: 12px;
    color: #89a0c2;
    font-size: 12px;
  }
  @media (max-width: 700px) {
    .cards { grid-template-columns: 1fr; }
  }
</style>
</head>
<body>
  <h1>${escapeHtml(appName)}</h1>
  <div class="muted">Schema v<span id="schema"></span> • history from logged injections • forecast from enabled schedule entries.</div>
  <div id="empty" class="empty" style="display:none">No logs yet. Use the Log Injection shortcut to create your first entry.</div>
  <div class="cards" id="cards"></div>

  <div class="toolbar">
    <button class="pill" onclick="setWindow(30)">30d</button>
    <button class="pill" onclick="setWindow(90)">90d</button>
    <button class="pill" onclick="setWindow(180)">180d</button>
    <button class="pill" onclick="setMode('amount')">Amount</button>
    <button class="pill" onclick="setMode('concentration')">Concentration</button>
    <select id="routeFilter" onchange="setRouteFilter(this.value)">
      <option value="all">All routes</option>
    </select>
    <select id="qualityFilter" onchange="setQualityFilter(this.value)">
      <option value="all">All confidence</option>
      <option value="good">Higher confidence</option>
      <option value="rough">Exploratory</option>
      <option value="low">Low confidence</option>
    </select>
    <select id="categoryFilter" onchange="setCategoryFilter(this.value)">
      <option value="all">All categories</option>
    </select>
  </div>

  <div class="toggles">
    <label><input type="checkbox" checked onchange="toggleMarkers(this.checked)">Event markers</label>
    <label><input type="checkbox" onchange="toggleTotal(this.checked)">Total overlay</label>
    <label><input type="checkbox" onchange="toggleTrend(this.checked)">Trend overlay</label>
  </div>

  <div class="chart-wrap">
    <canvas id="chart" width="1200" height="640"></canvas>
    <div class="legend" id="legend"></div>
  </div>

  <div class="footer">Convenience visualization only. Values are model estimates and can be low-confidence for some compounds.</div>

<script>
  const payload = ${payloadJson};
  document.getElementById('schema').textContent = payload.schema_version;

  let state = {
    days: 30,
    mode: 'amount',
    routeFilter: 'all',
    qualityFilter: 'all',
    categoryFilter: 'all',
    showMarkers: true,
    showTotal: false,
    showTrend: false,
    enabled: payload.datasets.amount_30.compounds.map(c => c.name)
  };

  const routeSet = new Set(payload.compounds.map(c => c.route || 'unknown'));
  const routeSelect = document.getElementById('routeFilter');
  Array.from(routeSet).sort().forEach(route => {
    const opt = document.createElement('option');
    opt.value = route;
    opt.textContent = route;
    routeSelect.appendChild(opt);
  });

  const categorySet = new Set(payload.compounds.map(c => c.category || 'general'));
  const categorySelect = document.getElementById('categoryFilter');
  Array.from(categorySet).sort().forEach(category => {
    const opt = document.createElement('option');
    opt.value = category;
    opt.textContent = category;
    categorySelect.appendChild(opt);
  });

  function hasRows() {
    return Array.isArray(payload.rows) && payload.rows.length > 0;
  }

  function renderCards() {
    const empty = document.getElementById('empty');
    const root = document.getElementById('cards');
    if (!hasRows()) {
      empty.style.display = 'block';
      root.innerHTML = '';
      return;
    }
    empty.style.display = 'none';

    const filteredRows = payload.rows.filter(r => {
      const routeOk = state.routeFilter === 'all' || r.route === state.routeFilter;
      const qualityOk = state.qualityFilter === 'all' || r.quality === state.qualityFilter;
      const categoryOk = state.categoryFilter === 'all' || r.category === state.categoryFilter;
      return routeOk && qualityOk && categoryOk;
    });

    root.innerHTML = filteredRows.map(r => {
      const nextText = r.next ? new Date(r.next).toLocaleString() : 'No schedule';
      const lastText = r.last ? (new Date(r.last.time).toLocaleString() + ' (' + Number(r.last.dose_mg).toFixed(2) + ' mg)') : 'No logged dose';
      const amount = Number(r.amount || 0).toFixed(2);
      const conc = Number(r.concentration || 0).toFixed(3);
      return '<div class="card">'
        + '<div class="name"><span class="dot" style="background:' + r.color + '"></span>' + r.display_name + '</div>'
        + '<div class="big">' + amount + ' mg</div>'
        + '<div class="small">' + conc + ' mg/L • route: ' + r.route + '</div>'
        + '<div class="small">Category: ' + r.category + '</div>'
        + '<div class="small">Last: ' + lastText + '</div>'
        + '<div class="small">Next: ' + nextText + '</div>'
        + '<div class="badge ' + r.quality + '">' + r.quality_label + '</div>'
        + '</div>';
    }).join('');
  }

  function getSeries() {
    return payload.datasets[state.mode + '_' + state.days];
  }

  function setWindow(days) { state.days = days; draw(); }
  function setMode(mode) { state.mode = mode; draw(); }
  function setRouteFilter(route) { state.routeFilter = route; draw(); }
  function setQualityFilter(quality) { state.qualityFilter = quality; draw(); }
  function setCategoryFilter(category) { state.categoryFilter = category; draw(); }
  function toggleMarkers(checked) { state.showMarkers = checked; draw(); }
  function toggleTotal(checked) { state.showTotal = checked; draw(); }
  function toggleTrend(checked) { state.showTrend = checked; draw(); }

  function toggleCompound(name) {
    if (state.enabled.includes(name)) {
      state.enabled = state.enabled.filter(x => x !== name);
    } else {
      state.enabled.push(name);
    }
    draw();
  }

  function buildLegend() {
    const root = document.getElementById('legend');
    const filtered = payload.compounds.filter(c => {
      const routeOk = state.routeFilter === 'all' || c.route === state.routeFilter;
      const qualityOk = state.qualityFilter === 'all' || c.quality === state.qualityFilter;
      const categoryOk = state.categoryFilter === 'all' || c.category === state.categoryFilter;
      return routeOk && qualityOk && categoryOk;
    });
    root.innerHTML = filtered.map(c => {
      const checked = state.enabled.includes(c.name) ? 'checked' : '';
      return '<label><input type="checkbox" ' + checked + ' onchange="toggleCompound(\'' + c.name + '\')">'
        + '<span class="dot" style="background:' + c.color + '"></span>'
        + c.display_name + '</label>';
    }).join('');
  }

  function draw() {
    renderCards();
    buildLegend();

    const canvas = document.getElementById('chart');
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0b1220');
    bg.addColorStop(1, '#0a162b');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const padding = { left: 68, right: 20, top: 24, bottom: 46 };
    const plotW = W - padding.left - padding.right;
    const plotH = H - padding.top - padding.bottom;

    const source = getSeries();
    const now = new Date(source.now).getTime();
    const minT = new Date(source.start).getTime();
    const maxT = new Date(source.end).getTime();

    const enabled = source.compounds
      .filter(c => state.enabled.includes(c.name))
      .filter(c => state.routeFilter === 'all' || c.route === state.routeFilter)
      .filter(c => state.qualityFilter === 'all' || c.model_quality === state.qualityFilter)
      .filter(c => state.categoryFilter === 'all' || c.category === state.categoryFilter)
      .map(c => ({
        ...c,
        points: c.points.map(p => [new Date(p[0]).getTime(), p[1]])
      }))
      .filter(c => c.points.length > 1);

    if (!enabled.length) {
      ctx.fillStyle = '#9fb1cc';
      ctx.font = '28px -apple-system';
      ctx.fillText('No series for current filters', 80, 110);
      return;
    }

    let yMax = 1;
    for (const s of enabled) {
      for (const p of s.points) yMax = Math.max(yMax, p[1]);
    }
    yMax *= 1.10;

    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (plotH * i / 4);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(W - padding.right, y);
      ctx.stroke();

      const val = (yMax * (1 - i / 4)).toFixed(state.mode === 'concentration' ? 2 : 1);
      ctx.fillStyle = '#9fb1cc';
      ctx.font = '22px -apple-system';
      ctx.fillText(val, 10, y + 7);
    }

    const xNow = padding.left + ((now - minT) / (maxT - minT)) * plotW;
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(xNow, padding.top);
    ctx.lineTo(xNow, padding.top + plotH);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#9fb1cc';
    ctx.font = '22px -apple-system';
    ctx.fillText(state.mode === 'concentration' ? 'mg/L' : 'mg', 10, 24);
    ctx.fillText('Now', xNow + 8, padding.top + 20);

    for (let i = 0; i <= 4; i++) {
      const x = padding.left + (plotW * i / 4);
      const t = new Date(minT + (maxT - minT) * i / 4);
      const label = t.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      ctx.fillStyle = '#9fb1cc';
      ctx.font = '20px -apple-system';
      ctx.fillText(label, x - 30, H - 10);
    }

    if (state.showMarkers) {
      for (const s of enabled) {
        for (const marker of s.markers) {
          const mt = new Date(marker[0]).getTime();
          if (mt < minT || mt > maxT) continue;
          const x = padding.left + ((mt - minT) / (maxT - minT)) * plotW;
          ctx.strokeStyle = s.color + '40';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x, padding.top);
          ctx.lineTo(x, padding.top + plotH);
          ctx.stroke();
        }
      }
    }

    function movingAverage(points, windowSize) {
      const out = [];
      for (let i = 0; i < points.length; i++) {
        const start = Math.max(0, i - windowSize + 1);
        let sum = 0;
        for (let j = start; j <= i; j++) sum += points[j][1];
        out.push([points[i][0], sum / (i - start + 1)]);
      }
      return out;
    }

    for (const s of enabled) {
      const area = ctx.createLinearGradient(0, padding.top, 0, padding.top + plotH);
      area.addColorStop(0, s.color + '55');
      area.addColorStop(1, s.color + '05');

      ctx.beginPath();
      s.points.forEach((p, index) => {
        const x = padding.left + ((p[0] - minT) / (maxT - minT)) * plotW;
        const y = padding.top + plotH - ((p[1] / yMax) * plotH);
        if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });

      const lastX = padding.left + ((s.points[s.points.length - 1][0] - minT) / (maxT - minT)) * plotW;
      const firstX = padding.left + ((s.points[0][0] - minT) / (maxT - minT)) * plotW;
      ctx.lineTo(lastX, padding.top + plotH);
      ctx.lineTo(firstX, padding.top + plotH);
      ctx.closePath();
      ctx.fillStyle = area;
      ctx.fill();

      ctx.beginPath();
      s.points.forEach((p, index) => {
        const x = padding.left + ((p[0] - minT) / (maxT - minT)) * plotW;
        const y = padding.top + plotH - ((p[1] / yMax) * plotH);
        if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 3;
      ctx.stroke();

      if (state.showTrend) {
        const trend = movingAverage(s.points, 5);
        ctx.beginPath();
        trend.forEach((p, index) => {
          const x = padding.left + ((p[0] - minT) / (maxT - minT)) * plotW;
          const y = padding.top + plotH - ((p[1] / yMax) * plotH);
          if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.strokeStyle = '#ffffff66';
        ctx.lineWidth = 2;
        ctx.setLineDash([7, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    if (state.showTotal && enabled.length > 1) {
      const total = enabled[0].points.map((p, i) => {
        let v = 0;
        for (const s of enabled) v += s.points[i][1];
        return [p[0], v];
      });

      ctx.beginPath();
      total.forEach((p, index) => {
        const x = padding.left + ((p[0] - minT) / (maxT - minT)) * plotW;
        const y = padding.top + plotH - ((p[1] / yMax) * plotH);
        if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  draw();
</script>
</body>
</html>`
}

module.exports = {
  renderDashboardHTML
}
