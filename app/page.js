"use client";

import { useEffect, useMemo, useState } from "react";

const colors = [
  "#2f6f67",
  "#c06c42",
  "#6f5ba8",
  "#d2a33f",
  "#4876b8",
  "#9a4f68",
  "#3f8e4d",
  "#7c6b57",
];

const defaultEntries = [
  { id: "founder-1", name: "Eu", type: "founder", equity: 62, vesting: false, start: "2026-01-01", years: 4 },
  { id: "person-1", name: "Co-founder", type: "person", equity: 10, vesting: true, start: "2026-01-01", years: 5 },
  { id: "pool-1", name: "Option Pool", type: "pool", equity: 15, vesting: false, start: "2026-01-01", years: 4 },
];

function vestedAmount(entry, today = new Date()) {
  const equity = Number(entry.equity) || 0;
  if (!entry.vesting || entry.type === "pool") return equity;
  const start = new Date(`${entry.start}T00:00:00`);
  const years = Math.max(Number(entry.years) || 0, 0.01);
  const end = new Date(start);
  end.setFullYear(start.getFullYear() + years);
  const ratio = Math.min(Math.max((today.getTime() - start.getTime()) / (end.getTime() - start.getTime()), 0), 1);
  return equity * ratio;
}

function formatPercent(value) {
  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}%`;
}

function hexToRgba(hex, alpha = 1) {
  const number = parseInt(hex.replace("#", ""), 16);
  return `rgba(${(number >> 16) & 255}, ${(number >> 8) & 255}, ${number & 255}, ${alpha})`;
}

function visibleOpacity(entry, mode) {
  if (entry.type === "pool") return mode === "future" ? 0.38 : 0.24;
  if (entry.vesting && mode === "future") return 0.72;
  return 1;
}

function createId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `entry-${Date.now()}-${Math.round(Math.random() * 10000)}`;
}

function buildChartBackground(slices, mode) {
  const used = slices.reduce((sum, slice) => sum + slice.value, 0);
  const unallocated = Math.max(100 - used, 0);
  let cursor = 0;
  const gradientParts = slices
    .filter((slice) => slice.value > 0)
    .map((slice) => {
      const start = cursor;
      const end = cursor + (slice.value / Math.max(used + unallocated, 1)) * 360;
      cursor = end;
      return `${hexToRgba(slice.color, visibleOpacity(slice.entry, mode))} ${start}deg ${end}deg`;
    });
  if (unallocated > 0) gradientParts.push(`#d9d4c9 ${cursor}deg 360deg`);
  return `conic-gradient(${gradientParts.join(", ")})`;
}

export default function Page() {
  const [mode, setMode] = useState("vested");
  const [entries, setEntries] = useState(defaultEntries);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("cap-table-distribution");
      if (stored) setEntries(JSON.parse(stored));
    } catch {
      setEntries(defaultEntries);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("cap-table-distribution", JSON.stringify(entries));
  }, [entries]);

  const totals = useMemo(() => {
    const future = entries.reduce((sum, entry) => sum + (Number(entry.equity) || 0), 0);
    const vested = entries.reduce((sum, entry) => sum + vestedAmount(entry), 0);
    const pool = entries.filter((entry) => entry.type === "pool").reduce((sum, entry) => sum + (Number(entry.equity) || 0), 0);
    return {
      future,
      vested,
      pool,
      unvested: Math.max(future - vested, 0),
      unallocated: Math.max(100 - future, 0),
      overAllocated: Math.max(future - 100, 0),
    };
  }, [entries]);

  const slices = entries.map((entry, index) => ({
    entry,
    value: mode === "future" ? Number(entry.equity) || 0 : vestedAmount(entry),
    color: colors[index % colors.length],
  }));

  function addRow() {
    setEntries((current) => [
      ...current,
      { id: createId(), name: "Novo stakeholder", type: "person", equity: 5, vesting: true, start: new Date().toISOString().slice(0, 10), years: 4 },
    ]);
  }

  function updateEntry(id, field, value) {
    setEntries((current) =>
      current.map((entry) => {
        if (entry.id !== id) return entry;
        const next = { ...entry, [field]: field === "vesting" ? value : field === "equity" || field === "years" ? Number(value) : value };
        if (field === "type" && value === "pool") next.vesting = false;
        return next;
      }),
    );
  }

  return (
    <main className="app">
      <section className="visual-panel" aria-label="Distribuicao da cap table">
        <header className="topbar">
          <div>
            <p className="eyebrow">Cap table</p>
            <h1>Equity Distribution</h1>
          </div>
          <div className="mode-toggle" role="group" aria-label="Modo do grafico">
            <button className={`mode-button ${mode === "vested" ? "active" : ""}`} onClick={() => setMode("vested")} type="button">Vested agora</button>
            <button className={`mode-button ${mode === "future" ? "active" : ""}`} onClick={() => setMode("future")} type="button">Futuro total</button>
          </div>
        </header>

        <div className="chart-grid">
          <div className="donut-wrap">
            <div className="donut" style={{ background: buildChartBackground(slices, mode) }} aria-hidden="true" />
            <div className="donut-center">
              <span>{formatPercent(mode === "future" ? totals.future : totals.vested)}</span>
              <small>{mode === "future" ? "futuro" : "vested"}</small>
            </div>
          </div>
          <div className="summary">
            <div><span>{formatPercent(totals.future)}</span><small>alocado no futuro</small></div>
            <div><span>{formatPercent(totals.vested)}</span><small>vested hoje</small></div>
            <div><span>{formatPercent(totals.pool)}</span><small>pools</small></div>
          </div>
        </div>

        <div className="legend">
          {slices.map((slice) => {
            const vested = vestedAmount(slice.entry);
            const detail = slice.entry.vesting && slice.entry.type !== "pool" ? `${formatPercent(vested)} vested / ${formatPercent(slice.entry.equity)} total` : slice.entry.type === "pool" ? "pool transparente" : "sem vesting";
            return (
              <div className="legend-item" key={slice.entry.id}>
                <span className="swatch" style={{ background: hexToRgba(slice.color, visibleOpacity(slice.entry, mode)) }} />
                <div><strong>{slice.entry.name}</strong><small>{detail}</small></div>
                <strong>{formatPercent(slice.value)}</strong>
              </div>
            );
          })}
        </div>
      </section>

      <section className="editor-panel" aria-label="Editor da cap table">
        <div className="editor-head">
          <div>
            <p className="eyebrow">Editor</p>
            <h2>Pessoas, pools e vesting</h2>
          </div>
          <button className="icon-button" onClick={addRow} type="button" title="Adicionar linha">+</button>
        </div>

        <div className="table-shell">
          <table>
            <thead>
              <tr><th>Nome</th><th>Tipo</th><th>Equity</th><th>Vesting</th><th>Inicio</th><th>Anos</th><th /></tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr className={entry.type === "pool" ? "muted-row" : ""} key={entry.id}>
                  <td><input value={entry.name} onChange={(event) => updateEntry(entry.id, "name", event.target.value)} /></td>
                  <td>
                    <select value={entry.type} onChange={(event) => updateEntry(entry.id, "type", event.target.value)}>
                      <option value="founder">Founder</option><option value="person">Pessoa</option><option value="investor">Investidor</option><option value="pool">Pool</option>
                    </select>
                  </td>
                  <td><input className="number-input" type="number" min="0" max="100" step="0.1" value={entry.equity} onChange={(event) => updateEntry(entry.id, "equity", event.target.value)} /></td>
                  <td><input type="checkbox" checked={entry.vesting} disabled={entry.type === "pool"} onChange={(event) => updateEntry(entry.id, "vesting", event.target.checked)} /></td>
                  <td><input type="date" value={entry.start} disabled={!entry.vesting || entry.type === "pool"} onChange={(event) => updateEntry(entry.id, "start", event.target.value)} /></td>
                  <td><input className="number-input" type="number" min="0.1" max="20" step="0.5" value={entry.years} disabled={!entry.vesting || entry.type === "pool"} onChange={(event) => updateEntry(entry.id, "years", event.target.value)} /></td>
                  <td><button className="delete-button" onClick={() => setEntries((current) => current.filter((item) => item.id !== entry.id))} type="button" title="Remover">x</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="insights">
          <div className="insight"><strong>{formatPercent(totals.unallocated)}</strong><small>por alocar</small></div>
          <div className="insight"><strong>{formatPercent(totals.unvested)}</strong><small>ainda por fazer vest</small></div>
          <div className="insight"><strong>{formatPercent(totals.overAllocated)}</strong><small>acima de 100%</small></div>
        </div>
      </section>
    </main>
  );
}
