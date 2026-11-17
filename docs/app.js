// Export Collapse Early Warning: renders charts, tables and the explorer from data/*.json
(function () {
  "use strict";
  const NS = "http://www.w3.org/2000/svg";
  const tip = document.getElementById("tip");
  const pct = (x, d = 0) => (x == null ? "–" : (x * 100).toFixed(d) + "%");
  const f3 = (x) => (x == null ? "–" : x.toFixed(3));
  const money = (m) => (m == null ? "–" : m >= 1000 ? "$" + (m / 1000).toFixed(2) + "bn" : "$" + m.toFixed(1) + "M");
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function showTip(evt, html) {
    tip.innerHTML = html;
    tip.style.display = "block";
    const w = tip.offsetWidth, h = tip.offsetHeight;
    let x = evt.clientX + 14, y = evt.clientY + 14;
    if (x + w > window.innerWidth - 8) x = evt.clientX - w - 14;
    if (y + h > window.innerHeight - 8) y = evt.clientY - h - 14;
    tip.style.left = Math.max(8, x) + "px";
    tip.style.top = Math.max(8, y) + "px";
  }
  function hideTip() { tip.style.display = "none"; }

  // ---------- generic chart frame ----------
  function frame(container, { width = 760, height = 280, ymin, ymax, yticks, fmt, left = 44 }) {
    const svg = el("svg", { viewBox: `0 0 ${width} ${height}`, role: "img" });
    container.innerHTML = "";
    container.appendChild(svg);
    const m = { l: left, r: 12, t: 10, b: 28 };
    const W = width - m.l - m.r, H = height - m.t - m.b;
    const y = (v) => m.t + H - ((v - ymin) / (ymax - ymin)) * H;
    const g = el("g", { class: "grid" }, svg);
    const ax = el("g", { class: "axis" }, svg);
    yticks.forEach((t) => {
      el("line", { x1: m.l, x2: m.l + W, y1: y(t), y2: y(t) }, g);
      const tx = el("text", { x: m.l - 8, y: y(t) + 4, "text-anchor": "end" }, ax);
      tx.textContent = fmt(t);
    });
    return { svg, m, W, H, y, ax };
  }

  // ---------- bar chart (one series) ----------
  function barChart(container, items, opts) {
    const F = frame(container, opts);
    const n = items.length, step = F.W / n, bw = Math.max(4, step - 2);
    items.forEach((d, i) => {
      const x = F.m.l + i * step + (step - bw) / 2;
      const y0 = F.y(opts.ymin), y1 = F.y(d.v);
      const h = Math.max(1, y0 - y1);
      const r = Math.min(4, bw / 2, h);
      const path = `M${x},${y0} V${y1 + r} Q${x},${y1} ${x + r},${y1} H${x + bw - r} Q${x + bw},${y1} ${x + bw},${y1 + r} V${y0} Z`;
      el("path", { d: path, fill: d.color || "var(--model)" }, F.svg);
      const hit = el("rect", { x: F.m.l + i * step, y: F.m.t, width: step, height: F.H, fill: "transparent" }, F.svg);
      hit.addEventListener("mousemove", (e) => showTip(e, d.tip));
      hit.addEventListener("mouseleave", hideTip);
      if (opts.valueLabels) {
        const vt = el("text", { x: x + bw / 2, y: y1 - 6, "text-anchor": "middle", class: "lbl" }, F.svg);
        vt.textContent = opts.fmt(d.v);
      }
      if (opts.labelEvery && i % opts.labelEvery === 0) {
        const t = el("text", { x: F.m.l + i * step + step / 2, y: F.m.t + F.H + 18, "text-anchor": "middle" }, F.ax);
        t.textContent = d.label;
      }
    });
  }

  // ---------- grouped bars ----------
  function groupedBars(container, groups, series, opts) {
    const F = frame(container, opts);
    const n = groups.length, step = F.W / n, inner = step * 0.78;
    const bw = (inner - 2 * (series.length - 1)) / series.length;
    groups.forEach((g, i) => {
      const x0 = F.m.l + i * step + (step - inner) / 2;
      series.forEach((s, j) => {
        const v = g[s.key];
        const x = x0 + j * (bw + 2), y0 = F.y(opts.ymin), y1 = F.y(v);
        const h = Math.max(1, y0 - y1), r = Math.min(3, bw / 2, h);
        el("path", { d: `M${x},${y0} V${y1 + r} Q${x},${y1} ${x + r},${y1} H${x + bw - r} Q${x + bw},${y1} ${x + bw},${y1 + r} V${y0} Z`, fill: s.color }, F.svg);
      });
      const hit = el("rect", { x: F.m.l + i * step, y: F.m.t, width: step, height: F.H, fill: "transparent" }, F.svg);
      hit.addEventListener("mousemove", (e) =>
        showTip(e, `<b>${g.label}</b><br>` + series.map((s) => `${s.name}: <b>${opts.fmt(g[s.key])}</b>`).join("<br>")));
      hit.addEventListener("mouseleave", hideTip);
      const t = el("text", { x: F.m.l + i * step + step / 2, y: F.m.t + F.H + 18, "text-anchor": "middle" }, F.ax);
      t.textContent = opts.short ? String(g.label).slice(-2).padStart(3, "'") : g.label;
    });
  }

  // ---------- line chart with crosshair ----------
  function lineChart(container, xs, series, opts) {
    const F = frame(container, opts);
    const n = xs.length, step = F.W / (n - 1);
    const X = (i) => F.m.l + i * step;
    if (opts.shadeFrom != null) {
      const i0 = xs.indexOf(opts.shadeFrom);
      el("rect", { x: X(i0) - step / 2, y: F.m.t, width: F.m.l + F.W - X(i0) + step / 2, height: F.H, fill: "var(--surface-2)" }, F.svg);
      const t = el("text", { x: X(i0) - step / 2 + 6, y: F.m.t + 14, class: "lbl" }, F.svg);
      t.textContent = "frozen model";
    }
    if (opts.refLine != null) {
      el("line", { x1: F.m.l, x2: F.m.l + F.W, y1: F.y(opts.refLine), y2: F.y(opts.refLine), stroke: "var(--base)", "stroke-width": 1.5, "stroke-dasharray": "4 3" }, F.svg);
    }
    xs.forEach((x, i) => {
      const t = el("text", { x: X(i), y: F.m.t + F.H + 18, "text-anchor": "middle" }, F.ax);
      t.textContent = n > 10 && window.innerWidth < 600 ? "'" + String(x).slice(-2) : x;
    });
    series.forEach((s) => {
      const d = s.values.map((v, i) => (i ? "L" : "M") + X(i) + "," + F.y(v)).join(" ");
      el("path", { d, fill: "none", stroke: s.color, "stroke-width": 2, "stroke-linejoin": "round" }, F.svg);
      s.values.forEach((v, i) => el("circle", { cx: X(i), cy: F.y(v), r: 4, fill: s.color, stroke: "var(--surface)", "stroke-width": 2 }, F.svg));
    });
    const cross = el("line", { y1: F.m.t, y2: F.m.t + F.H, stroke: "var(--text-3)", "stroke-width": 1, opacity: 0 }, F.svg);
    const hit = el("rect", { x: F.m.l - step / 2, y: F.m.t, width: F.W + step, height: F.H, fill: "transparent" }, F.svg);
    hit.addEventListener("mousemove", (e) => {
      const r = F.svg.getBoundingClientRect();
      const sx = ((e.clientX - r.left) / r.width) * F.svg.viewBox.baseVal.width;
      const i = Math.max(0, Math.min(n - 1, Math.round((sx - F.m.l) / step)));
      cross.setAttribute("x1", X(i)); cross.setAttribute("x2", X(i)); cross.setAttribute("opacity", 1);
      showTip(e, `<b>Answer year ${xs[i]}</b>${opts.note ? " · " + opts.note(i) : ""}<br>` +
        series.map((s) => `${s.name}: <b>${opts.fmt(s.values[i])}</b>`).join("<br>"));
    });
    hit.addEventListener("mouseleave", () => { cross.setAttribute("opacity", 0); hideTip(); });
  }

  // ---------- walk-forward diagram ----------
  function splitDiagram(container) {
    const years = []; for (let y = 1997; y <= 2020; y++) years.push(y);
    const rows = [2011, 2015, 2020];
    const width = 760, cell = (width - 120) / years.length, height = rows.length * 34 + 40;
    const svg = el("svg", { viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": "Walk-forward split diagram" });
    container.innerHTML = ""; container.appendChild(svg);
    rows.forEach((Y, r) => {
      const t = el("text", { x: 0, y: r * 34 + 22, class: "lbl" }, svg); t.textContent = "answer " + Y;
      years.forEach((yr, i) => {
        const ans = yr + 1; // a row from year yr has its answer in yr+1
        let fill = "var(--surface-2)";
        if (ans < Y) fill = "var(--model)";
        if (ans === Y) fill = "var(--rule)";
        el("rect", { x: 110 + i * cell, y: r * 34 + 8, width: cell - 2, height: 22, rx: 3, fill }, svg);
      });
    });
    [1997, 2005, 2010, 2015, 2019].forEach((yr) => {
      const t = el("text", { x: 110 + (yr - 1997) * cell + cell / 2, y: rows.length * 34 + 26, "text-anchor": "middle", class: "lbl" }, svg);
      t.textContent = yr;
    });
    const lg = document.createElement("div");
    lg.className = "legend";
    lg.innerHTML = '<span><i style="background:var(--model);height:10px"></i>train rows (answer already known)</span><span><i style="background:var(--rule);height:10px"></i>test rows (data year Y−1)</span><span><i style="background:var(--surface-2);height:10px;border:1px solid var(--border)"></i>not used yet (future)</span>';
    container.appendChild(lg);
  }

  function table(target, head, rows, opts = {}) {
    const t = typeof target === "string" ? document.getElementById(target) : target;
    let h = "<tr>" + head.map((c) => `<th class="${c.n ? "n" : ""}">${c.t}</th>`).join("") + "</tr>";
    rows.forEach((r) => {
      h += `<tr class="${r._class || ""}">` + head.map((c) => `<td class="${c.n ? "n" : ""}">${r[c.k] == null ? "–" : r[c.k]}</td>`).join("") + "</tr>";
    });
    if (t.tagName === "TABLE") t.innerHTML = h; else t.innerHTML = "<table>" + h + "</table>";
  }

  // ---------- results ----------
  function renderSummary(S) {
    const byYear = S.by_year;
    const years = byYear.map((d) => d.answer_year);
    const firstFrozen = byYear.find((d) => d.design === "frozen").answer_year;

    // collapse rate by answer year
    const cr = Object.entries(S.collapse_rate_by_year).map(([y, v]) => ({ y: +y + 1, v }));
    barChart(document.getElementById("chart-base"), cr.map((d) => ({ v: d.v, label: d.y, tip: `<b>Answer year ${d.y}</b><br>collapse share: <b>${pct(d.v, 1)}</b>` })),
      { height: 220, ymin: 0, ymax: 0.4, yticks: [0, 0.1, 0.2, 0.3, 0.4], fmt: (t) => pct(t), labelEvery: 4 });

    splitDiagram(document.getElementById("chart-split"));

    lineChart(document.getElementById("chart-auc"), years, [
      { name: "Boosted trees", color: "var(--model)", values: byYear.map((d) => d.auc_model) },
      { name: "Volatility rule", color: "var(--rule)", values: byYear.map((d) => d.auc_rule) },
    ], { ymin: 0.45, ymax: 0.8, yticks: [0.5, 0.6, 0.7, 0.8], fmt: f3, shadeFrom: firstFrozen, refLine: 0.5,
         note: (i) => byYear[i].design + ", " + byYear[i].rows.toLocaleString() + " flows" });

    groupedBars(document.getElementById("chart-top10"), byYear.map((d) => ({ label: d.answer_year, m: d.top10_model, r: d.top10_rule, b: d.base_rate })),
      [{ key: "m", name: "Boosted trees", color: "var(--model)" }, { key: "r", name: "Volatility rule", color: "var(--rule)" }, { key: "b", name: "Random picking", color: "var(--base)" }],
      { ymin: 0, ymax: 0.7, yticks: [0, 0.2, 0.4, 0.6], fmt: (t) => pct(t), short: true });

    // models table
    const nice = { "volatility rule": "Volatility rule (baseline)", logistic: "Logistic regression", trees: "Boosted trees", xgboost: "XGBoost" };
    const order = ["volatility rule", "logistic", "trees", "xgboost"];
    const wf = S.models["walk-forward"], fr = S.models["frozen"];
    const rows = [{ m: "Random picking", a1: "0.500", t1: pct(S.average["walk-forward"].base_rate, 1), a2: "0.500", t2: pct(S.average.frozen.base_rate, 1), b: "–" }];
    const J = S.jump_rule;
    if (J) rows.push({ m: "Jump rule (baseline)", a1: f3(J["walk-forward"].auc), t1: pct(J["walk-forward"].top10, 1), p1: f3(J["walk-forward"].pr_auc),
      a2: f3(J.frozen.auc), t2: pct(J.frozen.top10, 1), b: "– (ranking only)" });
    order.forEach((k) => {
      const a = wf.find((r) => r.method === k), b = fr.find((r) => r.method === k);
      if (!a) return;
      rows.push({ m: nice[k], a1: f3(a.auc), t1: pct(a.top10, 1), p1: f3(a.pr_auc), a2: f3(b.auc), t2: pct(b.top10, 1), b: a.brier == null ? "– (ranking only)" : f3(a.brier), _class: k === "trees" ? "best" : "" });
    });
    table("models-table", [{ t: "Method", k: "m" }, { t: "AUC 2011-20", k: "a1", n: 1 }, { t: "Top-10% hit 2011-20", k: "t1", n: 1 }, { t: "PR-AUC 2011-20", k: "p1", n: 1 },
      { t: "AUC 2021-24 (frozen)", k: "a2", n: 1 }, { t: "Top-10% hit 2021-24", k: "t2", n: 1 }, { t: "Brier 2011-20", k: "b", n: 1 }], rows);

    const B = S.bootstrap;
    document.getElementById("boot-text").innerHTML =
      `Resampling whole countries 500 times, the model's AUC gain over the volatility rule is <b>+${f3(B["walk-forward"].auc_gain)}</b> in the walk-forward years ` +
      `(95% range ${f3(B["walk-forward"].low)} to ${f3(B["walk-forward"].high)}) and <b>+${f3(B.frozen.auc_gain)}</b> in the frozen post-COVID years ` +
      `(95% range ${f3(B.frozen.low)} to ${f3(B.frozen.high)}). Both ranges stay above zero, so the gain is not luck in which countries were tested. ` +
      `The model beats the rule in <b>${S.wins["walk-forward"]} of 10</b> walk-forward years and <b>${S.wins.frozen} of 4</b> frozen years. ` +
      `<span class="muted">This covers which countries are in the test, not entirely new kinds of years.</span>`;

    table("ablation-table", [{ t: "Inputs used", k: "i" }, { t: "Number", k: "n", n: 1 }, { t: "AUC 2011-20", k: "a", n: 1 }],
      S.ablation.map((d) => ({ i: d.inputs, n: d.n_inputs, a: f3(d.auc) })).concat([{ i: "<span class='muted'>volatility rule, for comparison</span>", n: 1, a: f3(S.average["walk-forward"].auc_rule) }]));

    const E = S.errors, F = E.facts;
    const F0 = S.errors.facts;
    document.getElementById("recall-text").innerHTML =
      `Across 2011-2024 there were <b>${F0.all_collapses.toLocaleString()}</b> collapses, and the model's watch list caught <b>${F0.caught_total.toLocaleString()}</b> of them ` +
      `(<b>${pct(F0.share_of_collapses_caught)}</b>; the volatility rule's list caught ${pct(F0.share_of_collapses_caught_rule)}). ` +
      `A list of 10% of flows cannot hold all of the roughly 22% that collapse, so most collapses are not on it. ` +
      `The list is a short list of the clearest risks, not a net that catches everything.`;
    if (J) document.getElementById("jump-text").innerHTML =
      `Many of the highest risks are flows that just jumped, so we also tested a <b>jump rule</b>: rank flows by this year's change, biggest rise first. ` +
      `Its watch list is better than the volatility rule's (${pct(J["walk-forward"].top10)} vs ${pct(S.average["walk-forward"].top10_rule)} in 2011-2020), but its AUC is much lower ` +
      `(${f3(J["walk-forward"].auc)}), because it ranks the rest of the flows badly. The model beats it on AUC in <b>${J["walk-forward"].model_wins_auc} of 10</b> years ` +
      `and <b>${J.frozen.model_wins_auc} of 4</b> frozen years, and on watch-list hit rate in <b>${J["walk-forward"].model_wins_top10} of 10</b> and <b>${J.frozen.model_wins_top10} of 4</b>. ` +
      `So "it jumped, it will fall back" explains part of the model's watch list, but not all of it.`;
    document.getElementById("obvious-text").innerHTML =
      `Partly. Of the collapses the watch list caught, <b>${pct(F.caught_also_on_rule_list)}</b> were also on the volatility rule's list: jumpy flows anyone would flag. ` +
      `The other <b>${pct(1 - F.caught_also_on_rule_list)}</b> the rule missed; the model found them by combining clues such as a shrinking buyer or India's other products to that country falling. ` +
      `And <b>${pct(F.caught_not_already_falling)}</b> of the caught flows had <i>not</i> already fallen that year, so the model is not just saying "it fell, so it will fall again".`;

    // errors
    const st = E.bands.filter((b) => b.by === "steadiness");
    const get = (k) => st.find((b) => b.band === k);
    document.getElementById("fm1-text").innerHTML =
      `The watch list catches <b>${pct(get("jumpy").share_caught)}</b> of collapses among the jumpiest third of flows, but only <b>${pct(get("steady").share_caught, 1)}</b> among the steadiest third, ` +
      `even though steady flows still collapse ${pct(get("steady").collapse_rate)} of the time. ` +
      `<b>${pct(F.missed_share_steady)}</b> of missed collapses were steady flows, against ${pct(F.caught_share_steady, 1)} of caught ones. ` +
      `Missed collapses are also milder (median fall ${pct(-F.missed_median_drop)} vs ${pct(-F.caught_median_drop)} for caught ones), and in <b>${pct(F.missed_share_buyer_shock)}</b> of them ` +
      `the buyer's total imports fell by more than 10% in the answer year, against ${pct(F.all_share_buyer_shock)} for all flows. ` +
      `That shock happens in the year being predicted, so no input could have shown it. <b>Why:</b> the model leans on a flow's own past, and a steady past says "safe". ` +
      `<b>What could help:</b> faster signals about the buyer (monthly trade data, currency or credit stress), or a separate model for steady flows.`;

    const order2 = ["steady", "medium", "jumpy", "new flow"];
    barChart(document.getElementById("chart-steady"), order2.map((k) => {
      const b = get(k); return { v: b.share_caught, label: k, tip: `<b>${k}</b><br>${b.rows.toLocaleString()} flows · collapse rate ${pct(b.collapse_rate)}<br>collapses caught: <b>${pct(b.share_caught, 1)}</b><br>AUC model ${f3(b.auc_model)} · rule ${f3(b.auc_rule)}` };
    }), { height: 220, ymin: 0, ymax: 0.8, yticks: [0, 0.2, 0.4, 0.6, 0.8], fmt: (t) => (t > 0 && t < 0.01 ? pct(t, 1) : pct(t)), labelEvery: 1, valueLabels: true });

    const L = E.lumpy;
    document.getElementById("fm2-text").innerHTML =
      `Fuel, gems and gold, aircraft, ships and arms are sold in a few huge one-off deals, so their values swing wildly. They are <b>${pct(L[0].share_of_rows)}</b> of all flows but ` +
      `<b>${pct(L[0].share_of_watch_list)}</b> of the watch list. Many of these warnings are right (hit rate ${pct(L[0].watch_list_hit_rate)}), but they push other flows off the list, ` +
      `and a warning that "an aircraft sale will not repeat" is rarely useful. On the false alarms, the largest ones are fuel and ore flows (see examples). ` +
      `<b>Fix used on this site:</b> lumpy products are marked, and the explorer can hide them.`;

    table("size-table", [{ t: "Flow size (year t)", k: "b" }, { t: "Flows", k: "r", n: 1 }, { t: "Collapse rate", k: "c", n: 1 }, { t: "AUC model", k: "m", n: 1 }, { t: "AUC rule", k: "u", n: 1 }],
      E.bands.filter((b) => b.by === "size").map((b) => ({ b: b.band, r: b.rows.toLocaleString(), c: pct(b.collapse_rate), m: f3(b.auc_model), u: f3(b.auc_rule) })));

    const exRows = [];
    [["caught", "Caught", "hit"], ["missed", "Missed collapse", "miss"], ["false alarm", "False alarm", ""]].forEach(([k, lbl, cls]) => {
      (E.examples[k] || []).slice(0, 4).forEach((r) => exRows.push({
        k: `<span class="pill ${cls}">${lbl}</span>`, c: esc(r.country), p: esc(r.product), y: r.year + 1, v: money(r.value_musd), r: f3(r.risk),
        ch: r.change_next_year == null ? "stopped" : (r.change_next_year > 0 ? "+" : "") + pct(r.change_next_year) }));
    });
    table("examples-table", [{ t: "Kind", k: "k" }, { t: "Country", k: "c" }, { t: "Product", k: "p" }, { t: "Answer year", k: "y", n: 1 }, { t: "Value (year before)", k: "v", n: 1 }, { t: "Risk", k: "r", n: 1 }, { t: "What happened", k: "ch", n: 1 }], exRows);
  }

  // ---------- explorer: 2025 ----------
  function renderWatch(W) {
    const sc = document.getElementById("sel-country"), sp = document.getElementById("sel-product");
    const countries = [...new Set(W.map((d) => d.country))].sort();
    const products = [...new Set(W.map((d) => d.hs2 + " " + d.product))].sort();
    sc.innerHTML = '<option value="">All countries</option>' + countries.map((c) => `<option>${esc(c)}</option>`).join("");
    sp.innerHTML = '<option value="">All product groups</option>' + products.map((p) => `<option value="${p.slice(0, 2)}">${esc(p)}</option>`).join("");
    sc.value = "";
    const cl = document.getElementById("chk-list"), ck = document.getElementById("chk-lumpy");
    cl.checked = true;
    function draw() {
      const minV = +document.getElementById("sel-size").value;
      let rows = W.filter((d) => d.value_musd >= minV && (!sc.value || d.country === sc.value) && (!sp.value || d.hs2 === sp.value) && (!cl.checked || d.on_list) && (!ck.checked || !d.lumpy));
      rows.sort((a, b) => b.risk - a.risk);
      const total = rows.length, onl = rows.filter((d) => d.on_list).length;
      const val = rows.reduce((s, d) => s + d.value_musd, 0);
      document.getElementById("w-stat").innerHTML = `<b>${total.toLocaleString()}</b> flows worth ${money(val)} in 2024 · <b>${onl}</b> on the 2025 watch list (top 10% overall)`;
      const shown = rows.slice(0, 25);
      table("w-table", [{ t: "Country", k: "c" }, { t: "Product group", k: "p" }, { t: "2024 value", k: "v", n: 1 }, { t: "Change 2024", k: "g", n: 1 }, { t: "Risk of collapse in 2025", k: "r" }, { t: "Main reasons risk is up", k: "why" }],
        shown.map((d) => ({
          c: esc(d.country), p: esc(d.product) + (d.lumpy ? ' <span class="pill">lumpy</span>' : ""), v: money(d.value_musd),
          g: d.chg_0 == null ? "new" : d.chg_0 >= 2 ? "×" + (1 + d.chg_0).toFixed(d.chg_0 >= 9 ? 0 : 1) : (d.chg_0 > 0 ? "+" : "") + pct(d.chg_0),
          r: `<span class="riskbar" style="width:${Math.round(d.risk * 80)}px"></span>${pct(d.risk)} ${d.on_list ? '<span class="pill on">watch list</span>' : ""}`,
          why: d.reasons.length ? "<span class='small muted'>" + d.reasons.map((x) => esc(x.input)).join("; ") + "</span>" : "<span class='muted small'>nothing stands out</span>",
        })));
      if (total > shown.length) document.getElementById("w-table").insertAdjacentHTML("beforeend", `<tr><td colspan="6" class="muted small">Showing the 25 riskiest of ${total}. Pick a country or product to narrow down.</td></tr>`);
    }
    [sc, sp, cl, ck, document.getElementById("sel-size")].forEach((e) => e.addEventListener("change", draw));
    draw();
  }

  // ---------- explorer: past years ----------
  function renderPast(P) {
    const sy = document.getElementById("sel-year"), q = document.getElementById("past-search");
    const years = [...new Set(P.map((d) => d.y))].sort((a, b) => a - b);
    sy.innerHTML = years.map((y) => `<option>${y}</option>`).join("");
    sy.value = years.includes(2020) ? 2020 : years[years.length - 1];
    function draw() {
      const Y = +sy.value, s = q.value.trim().toLowerCase();
      const all = P.filter((d) => d.y === Y);
      const hits = all.filter((d) => d.hit).length;
      const rows = all.filter((d) => !s || d.c.toLowerCase().includes(s) || d.p.toLowerCase().includes(s)).sort((a, b) => b.r - a.r);
      document.getElementById("p-stat").innerHTML = `Answer year ${Y}${Y >= 2021 ? " (frozen model)" : ""}: the watch list had <b>${all.length}</b> flows and <b>${hits}</b> really collapsed, a hit rate of <b>${pct(hits / all.length)}</b>.`;
      const shown = rows.slice(0, 40);
      table("p-table", [{ t: "Country", k: "c" }, { t: "Product group", k: "p" }, { t: "Value year before", k: "v", n: 1 }, { t: "Risk", k: "r", n: 1 }, { t: "What happened", k: "h" }],
        shown.map((d) => ({ c: esc(d.c), p: esc(d.p), v: money(d.v), r: pct(d.r),
          h: d.hit ? `<span class="pill hit">collapsed</span> ${d.chg == null ? "stopped" : pct(d.chg)}` : `<span class="pill miss">false alarm</span> ${d.chg == null ? "" : (d.chg > 0 ? "+" : "") + pct(d.chg)}` })));
      if (rows.length > shown.length) document.getElementById("p-table").insertAdjacentHTML("beforeend", `<tr><td colspan="5" class="muted small">Showing 40 of ${rows.length}. Use search to narrow down.</td></tr>`);
    }
    sy.addEventListener("change", draw); q.addEventListener("input", draw);
    draw();
  }

  // ---------- tabs, nav, repo link ----------
  document.querySelectorAll(".tabs button").forEach((b) => b.addEventListener("click", () => {
    document.querySelectorAll(".tabs button").forEach((x) => { x.setAttribute("aria-selected", x === b); document.getElementById(x.dataset.tab).hidden = x !== b; });
  }));
  const links = [...document.querySelectorAll("nav.top a")];
  const obs = new IntersectionObserver((ents) => ents.forEach((e) => {
    if (e.isIntersecting) links.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === "#" + e.target.id));
  }), { rootMargin: "-40% 0px -55% 0px" });
  document.querySelectorAll("main section").forEach((s) => obs.observe(s));
  const m = location.hostname.match(/^([^.]+)\.github\.io$/);
  const repo = location.pathname.split("/").filter(Boolean)[0];
  if (m && repo) document.getElementById("repo-link").href = `https://github.com/${m[1]}/${repo}#readme`;

  const get = (p) => fetch(p).then((r) => { if (!r.ok) throw new Error(p); return r.json(); });
  get("data/summary.json").then(renderSummary).catch((e) => console.error(e));
  get("data/watchlist_2025.json").then(renderWatch).catch((e) => console.error(e));
  get("data/past_watchlists.json").then(renderPast).catch((e) => console.error(e));
  let rz; window.addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => get("data/summary.json").then(renderSummary), 300); });
})();
