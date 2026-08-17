#!/usr/bin/env node
// Minimal local progress UI. Run: npm run ui  (from tools/learning-mcp)
// Serves http://localhost:5858 with workouts, step status, and reflections.
import http from "node:http";
import { progressSummary } from "./lib.js";

const PORT = process.env.PORT || 5858;

const page = () => {
  const { workouts, reflections } = progressSummary();
  const badge = (s) =>
    s === "completed" ? "✅" : s === "in_progress" ? "🔵" : "⚪️";
  const workoutHtml = workouts
    .map(
      (w) => `
    <section>
      <h2>${w.order}. ${w.name} <small>(phases ${w.phases}) — ${w.done}/${w.total} steps</small></h2>
      <ul>
        ${w.steps
          .map(
            (s) =>
              `<li>${badge(s.status)} ${s.title}${
                s.completedAt ? ` <small>· ${new Date(s.completedAt).toLocaleDateString()}</small>` : ""
              }</li>`
          )
          .join("")}
      </ul>
    </section>`
    )
    .join("");
  const reflHtml = reflections.length
    ? `<section><h2>Reflections</h2>${reflections
        .map(
          (r) =>
            `<blockquote><p>${r.text.replace(/</g, "&lt;")}</p><small>${r.workoutId} · ${new Date(
              r.at
            ).toLocaleString()}</small></blockquote>`
        )
        .join("")}</section>`
    : "";
  return `<!doctype html><html><head><meta charset="utf-8"><title>Growth Platform Lab — Learning Progress</title>
<style>
 body{font-family:-apple-system,Segoe UI,Helvetica,sans-serif;max-width:720px;margin:40px auto;padding:0 16px;color:#1a1a2e;line-height:1.5}
 h1{font-size:1.5rem} h2{font-size:1.1rem;margin-bottom:4px} small{color:#777;font-weight:normal}
 ul{list-style:none;padding-left:8px;margin-top:4px} li{padding:2px 0}
 blockquote{border-left:3px solid #90caf9;margin:8px 0;padding:4px 12px;background:#f7fafd}
 footer{margin-top:32px;color:#999;font-size:.85rem}
</style></head><body>
<h1>Growth Platform Lab — Learning Progress</h1>
${workoutHtml}${reflHtml}
<footer>Progress lives in <code>.learning/progress.json</code>. Refresh after completing steps.</footer>
</body></html>`;
};

http
  .createServer((req, res) => {
    if (req.url === "/api/progress") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(progressSummary(), null, 2));
      return;
    }
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(page());
  })
  .listen(PORT, () => console.log(`Learning progress UI: http://localhost:${PORT}`));
