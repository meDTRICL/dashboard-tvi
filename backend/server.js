const express = require("express");
const cors = require("cors");
const fs = require("fs");
const csv = require("csv-parser");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;
const CSV_FILE = "data.csv";

function readCSV(filterFn = null) {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(CSV_FILE, { encoding: "utf8" })
      .pipe(csv({
        mapHeaders: ({ header }) => header.replace(/;$/, "").replace(/^\uFEFF/, "").trim(),
        mapValues: ({ value }) => String(value).replace(/;$/, "").trim()
      }))
      .on("data", (row) => {
        if (row["Order Date"] && !row["year"]) {
          const parts = row["Order Date"].split("/");
          if (parts.length === 3) {
            row.year  = parts[2];
            row.month = String(parseInt(parts[1]));
          }
        }
        if (!filterFn || filterFn(row)) results.push(row);
      })
      .on("end", () => resolve(results))
      .on("error", reject);
  });
}

app.get("/", (req, res) => res.send("API Sales Dashboard aktif"));

app.get("/data", async (req, res) => {
  try { res.json(await readCSV()); } catch(e) { res.status(500).json({error: e.message}); }
});

app.get("/sales-by-year", async (req, res) => {
  try {
    const { year, region, category, segment } = req.query;
    res.json(await readCSV(row => {
      if (year     && row.year            !== year)     return false;
      if (region   && row["Region"]       !== region)   return false;
      if (category && row["Category"]     !== category) return false;
      if (segment  && row["Segment"]      !== segment)  return false;
      return true;
    }));
  } catch(e) { res.status(500).json({error: e.message}); }
});

app.get("/summary", async (req, res) => {
  try {
    const { year, region } = req.query;
    const data = await readCSV(row => {
      if (year   && row.year        !== year)   return false;
      if (region && row["Region"]   !== region) return false;
      return true;
    });
    const map = {};
    data.forEach(row => { const k = row["Category"] || "Unknown"; map[k] = (map[k]||0) + parseFloat(row["Sales"]||0); });
    res.json(Object.entries(map).map(([product,total])=>({product,total})).sort((a,b)=>b.total-a.total));
  } catch(e) { res.status(500).json({error: e.message}); }
});

app.get("/summary-subcategory", async (req, res) => {
  try {
    const { year } = req.query;
    const data = await readCSV(row => !year || row.year === year);
    const map = {};
    data.forEach(row => { const k = row["Sub-Category"]||"Unknown"; map[k]=(map[k]||0)+parseFloat(row["Sales"]||0); });
    res.json(Object.entries(map).map(([name,total])=>({name,total})).sort((a,b)=>b.total-a.total).slice(0,10));
  } catch(e) { res.status(500).json({error: e.message}); }
});

app.get("/summary-region", async (req, res) => {
  try {
    const { year } = req.query;
    const data = await readCSV(row => !year || row.year === year);
    const map = {};
    data.forEach(row => { const k = row["Region"]||"Unknown"; map[k]=(map[k]||0)+parseFloat(row["Sales"]||0); });
    res.json(Object.entries(map).map(([region,total])=>({region,total})).sort((a,b)=>b.total-a.total));
  } catch(e) { res.status(500).json({error: e.message}); }
});

app.get("/monthly-trend", async (req, res) => {
  try {
    const { year } = req.query;
    const data = await readCSV(row => !year || row.year === year);
    const map = {};
    data.forEach(row => {
      if (!row.year||!row.month) return;
      const k = `${row.year}-${String(row.month).padStart(2,"0")}`;
      map[k]=(map[k]||0)+parseFloat(row["Sales"]||0);
    });
    res.json(Object.entries(map).map(([month,total])=>({month,total})).sort((a,b)=>a.month.localeCompare(b.month)));
  } catch(e) { res.status(500).json({error: e.message}); }
});

app.get("/summary-segment", async (req, res) => {
  try {
    const { year } = req.query;
    const data = await readCSV(row => !year || row.year === year);
    const map = {};
    data.forEach(row => { const k = row["Segment"]||"Unknown"; map[k]=(map[k]||0)+parseFloat(row["Sales"]||0); });
    res.json(Object.entries(map).map(([segment,total])=>({segment,total})).sort((a,b)=>b.total-a.total));
  } catch(e) { res.status(500).json({error: e.message}); }
});

app.get("/options", async (req, res) => {
  try {
    const data = await readCSV();
    res.json({
      years:      [...new Set(data.map(r=>r.year))].filter(Boolean).sort(),
      regions:    [...new Set(data.map(r=>r["Region"]))].filter(Boolean).sort(),
      categories: [...new Set(data.map(r=>r["Category"]))].filter(Boolean).sort(),
      segments:   [...new Set(data.map(r=>r["Segment"]))].filter(Boolean).sort(),
    });
  } catch(e) { res.status(500).json({error: e.message}); }
});

app.listen(PORT, () => {
  console.log(`✅ Server jalan di http://localhost:${PORT}`);
});