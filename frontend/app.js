const API = "http://localhost:9567";
let chartCategory, chartRegion, chartTrend, chartSegment;

function formatUSD(num) {
  if (num >= 1_000_000) return "$" + (num / 1_000_000).toFixed(2) + "M";
  if (num >= 1_000)     return "$" + (num / 1_000).toFixed(1) + "K";
  return "$" + Number(num).toFixed(2);
}

const COLORS = ["#4f8ef7","#4ff7a0","#f7c94f","#f75f4f","#c44ff7","#4ff7f0","#f7944f","#7bf74f"];

const CHART_OPTS = {
  plugins: { legend: { labels: { color:"#6b7394", font:{ family:"Outfit", size:12 } } } },
  scales: {
    x: { ticks:{ color:"#6b7394", font:{family:"Space Mono",size:10} }, grid:{ color:"rgba(42,47,66,0.5)" } },
    y: { ticks:{ color:"#6b7394", font:{family:"Space Mono",size:10}, callback: v => formatUSD(v) }, grid:{ color:"rgba(42,47,66,0.5)" } }
  }
};

async function checkServer() {
  try {
    await fetch(API + "/");
    document.getElementById("serverStatus").innerHTML = `<span class="status-dot"></span> Server aktif`;
  } catch {
    document.getElementById("serverStatus").innerHTML =
      `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#f75f4f;margin-right:6px;"></span> Server offline`;
    document.getElementById("serverStatus").style.color = "#f75f4f";
  }
}

async function loadOptions() {
  try {
    const opts = await fetch(API + "/options").then(r => r.json());
    const adds = (selId, arr, key) => {
      const sel = document.getElementById(selId);
      arr.forEach(v => { sel.innerHTML += `<option value="${v}">${v}</option>`; });
    };
    adds("filterYear",     opts.years,      "year");
    adds("filterRegion",   opts.regions,    "region");
    adds("filterCategory", opts.categories, "category");
    adds("filterSegment",  opts.segments,   "segment");
  } catch(e) { console.error("loadOptions:", e); }
}

function getFilters() {
  return {
    year:     document.getElementById("filterYear").value,
    region:   document.getElementById("filterRegion").value,
    category: document.getElementById("filterCategory").value,
    segment:  document.getElementById("filterSegment").value,
  };
}

function buildQuery(p) {
  return Object.entries(p).filter(([,v])=>v).map(([k,v])=>`${k}=${encodeURIComponent(v)}`).join("&");
}

async function refreshAll() {
  const f = getFilters();
  await Promise.all([loadKpi(f), loadRegion(f), loadTrend(f), loadSegment(f), loadTable(f)]);
}

async function loadKpi(f) {
  try {
    const q = buildQuery({ year: f.year, region: f.region });
    const [summary, raw] = await Promise.all([
      fetch(`${API}/summary${q?"?"+q:""}`).then(r=>r.json()),
      fetch(`${API}/sales-by-year?${buildQuery(f)}`).then(r=>r.json()),
    ]);
    const totalRev = summary.reduce((s,d)=>s+d.total,0);
    const avg = raw.length > 0 ? totalRev/raw.length : 0;
    const best = summary[0];
    document.getElementById("kpiRevenue").textContent = formatUSD(totalRev);
    document.getElementById("kpiRevenueSub").textContent = f.year ? `Tahun ${f.year}` : "Semua tahun";
    document.getElementById("kpiTx").textContent = raw.length.toLocaleString();
    document.getElementById("kpiAvg").textContent = formatUSD(avg);
    document.getElementById("kpiBest").textContent = best ? best.product : "—";
    document.getElementById("kpiBestSub").textContent = best ? formatUSD(best.total) : "";

    if (chartCategory) chartCategory.destroy();
    chartCategory = new Chart(document.getElementById("chartCategory"), {
      type:"bar",
      data:{ labels:summary.map(d=>d.product), datasets:[{ label:"Revenue", data:summary.map(d=>d.total), backgroundColor:COLORS, borderRadius:6, borderSkipped:false }] },
      options:{ ...CHART_OPTS, responsive:true, plugins:{...CHART_OPTS.plugins, legend:{display:false}} }
    });
  } catch(e) { console.error(e); }
}

async function loadRegion(f) {
  try {
    const q = buildQuery({ year: f.year });
    const data = await fetch(`${API}/summary-region${q?"?"+q:""}`).then(r=>r.json());
    if (chartRegion) chartRegion.destroy();
    chartRegion = new Chart(document.getElementById("chartRegion"), {
      type:"doughnut",
      data:{ labels:data.map(d=>d.region), datasets:[{ data:data.map(d=>d.total), backgroundColor:COLORS, borderColor:"#161920", borderWidth:3, hoverOffset:8 }] },
      options:{ responsive:true, plugins:{ legend:{position:"right",labels:{color:"#6b7394",font:{family:"Outfit",size:12},padding:14}}, tooltip:{callbacks:{label:ctx=>` ${ctx.label}: ${formatUSD(ctx.raw)}`}} } }
    });
  } catch(e) { console.error(e); }
}

async function loadTrend(f) {
  try {
    const q = buildQuery({ year: f.year });
    const data = await fetch(`${API}/monthly-trend${q?"?"+q:""}`).then(r=>r.json());
    const mn = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
    const labels = data.map(d=>{ const[y,m]=d.month.split("-"); return `${mn[parseInt(m)-1]} '${y.slice(2)}`; });
    if (chartTrend) chartTrend.destroy();
    chartTrend = new Chart(document.getElementById("chartTrend"), {
      type:"line",
      data:{ labels, datasets:[{ label:"Revenue Bulanan", data:data.map(d=>d.total), borderColor:"#4f8ef7", backgroundColor:"rgba(79,142,247,0.08)", borderWidth:2.5, pointRadius:4, tension:0.35, fill:true }] },
      options:{ ...CHART_OPTS, responsive:true }
    });
  } catch(e) { console.error(e); }
}

async function loadSegment(f) {
  try {
    const q = buildQuery({ year: f.year });
    const data = await fetch(`${API}/summary-segment${q?"?"+q:""}`).then(r=>r.json());
    if (chartSegment) chartSegment.destroy();
    chartSegment = new Chart(document.getElementById("chartSegment"), {
      type:"bar",
      data:{ labels:data.map(d=>d.segment), datasets:[{ label:"Revenue", data:data.map(d=>d.total), backgroundColor:["#4f8ef7","#4ff7a0","#f7c94f"], borderRadius:6 }] },
      options:{ ...CHART_OPTS, responsive:true, indexAxis:"y", plugins:{...CHART_OPTS.plugins,legend:{display:false}} }
    });
  } catch(e) { console.error(e); }
}

async function loadTable(f) {
  const tbody = document.getElementById("tableBody");
  tbody.innerHTML = `<tr><td colspan="7"><div class="loading"><div class="spinner"></div> Memuat data...</div></td></tr>`;
  try {
    const data = await fetch(`${API}/sales-by-year?${buildQuery(f)}`).then(r=>r.json());
    const top10 = [...data].sort((a,b)=>parseFloat(b.Sales||0)-parseFloat(a.Sales||0)).slice(0,10);
    const cc = {"Furniture":"#4f8ef7","Office Supplies":"#4ff7a0","Technology":"#f7c94f"};
    tbody.innerHTML = top10.map((d,i)=>`
      <tr>
        <td><strong>${i+1}</strong></td>
        <td>${d["Order Date"]||""}</td>
        <td title="${d["Product Name"]||""}"><strong>${(d["Product Name"]||"").substring(0,35)}${(d["Product Name"]||"").length>35?"…":""}</strong></td>
        <td><span class="badge" style="background:${cc[d["Category"]]||"#6b7394"}22;color:${cc[d["Category"]]||"#aaa"};">${d["Category"]||""}</span></td>
        <td>${d["Region"]||""}</td>
        <td>${d["Segment"]||""}</td>
        <td><strong>${formatUSD(parseFloat(d["Sales"]||0))}</strong></td>
      </tr>`).join("");
  } catch(e) {
    tbody.innerHTML = `<tr><td colspan="7" style="color:#f75f4f;padding:20px;text-align:center;">⚠️ Gagal memuat. Pastikan server.js jalan di port 9567.</td></tr>`;
  }
}

checkServer();
loadOptions().then(() => refreshAll());