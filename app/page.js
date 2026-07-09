"use client";

import { useEffect, useMemo, useState } from "react";

const today = new Date();
const palette = ["#b7fff0", "#84a8ff", "#f6d27d", "#ff8fcb", "#78e2ff", "#d7f99a"];
const storageKey = "cap-table-display-v2";

const defaultEntries = [
  {
    id: "founder",
    name: "Eu",
    type: "founder",
    equity: 87,
    vesting: false,
    start: "2026-01-01",
    years: 4,
  },
  {
    id: "person-x",
    name: "X pessoa",
    type: "person",
    equity: 5,
    vesting: false,
    start: "2026-01-01",
    years: 4,
  },
  {
    id: "pool",
    name: "Pool",
    type: "pool",
    equity: 1,
    vesting: false,
    start: "2026-01-01",
    years: 4,
  },
  {
    id: "advisor",
    name: "Advisor",
    type: "person",
    equity: 4,
    vesting: true,
    start: "2025-07-09",
    years: 4,
  },
];

function createId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `entry-${Date.now()}-${Math.round(Math.random() * 10000)}`;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function vestedAmount(entry, date = today) {
  const equity = Number(entry.equity) || 0;
  if (!entry.vesting || entry.type === "pool") return equity;

  const start = new Date(`${entry.start}T00:00:00`);
  const end = new Date(start);
  end.setFullYear(start.getFullYear() + Math.max(Number(entry.years) || 0.01, 0.01));

  return equity * clamp((date.getTime() - start.getTime()) / (end.getTime() - start.getTime()), 0, 1);
}

function formatPercent(value) {
  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}%`;
}

function polarToCartesian(cx, cy, radius, angle) {
  const radians = ((angle - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(radians),
    y: cy + radius * Math.sin(radians),
  };
}

function sectorPath(cx, cy, outerRadius, innerRadius, startAngle, endAngle) {
  const outerStart = polarToCartesian(cx, cy, outerRadius, endAngle);
  const outerEnd = polarToCartesian(cx, cy, outerRadius, startAngle);
  const innerStart = polarToCartesian(cx, cy, innerRadius, startAngle);
  const innerEnd = polarToCartesian(cx, cy, innerRadius, endAngle);
  const largeArc = endAngle - startAngle <= 180 ? 0 : 1;

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 0 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerStart.x} ${innerStart.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 1 ${innerEnd.x} ${innerEnd.y}`,
    "Z",
  ].join(" ");
}

function vestingDetail(entry) {
  if (entry.type === "pool") return "reserved";
  if (!entry.vesting) return "available now";
  return `${formatPercent(vestedAmount(entry))} vested`;
}

export default function Page() {
  const [entries, setEntries] = useState(defaultEntries);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) setEntries(JSON.parse(stored));
    } catch {
      setEntries(defaultEntries);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(entries));
  }, [entries]);

  const metrics = useMemo(() => {
    const allocated = entries.reduce((sum, entry) => sum + (Number(entry.equity) || 0), 0);
    const vested = entries.reduce((sum, entry) => sum + vestedAmount(entry), 0);
    const pool = entries.filter((entry) => entry.type === "pool").reduce((sum, entry) => sum + (Number(entry.equity) || 0), 0);

    return {
      allocated,
      vested,
      unvested: Math.max(allocated - vested, 0),
      pool,
      free: Math.max(100 - allocated, 0),
      over: Math.max(allocated - 100, 0),
    };
  }, [entries]);

  const slices = useMemo(() => {
    let cursor = -90;
    const total = Math.max(metrics.allocated + metrics.free, 1);
    const base = entries
      .filter((entry) => Number(entry.equity) > 0)
      .map((entry, index) => {
        const value = Number(entry.equity) || 0;
        const angle = (value / total) * 360;
        const gap = Math.min(2.8, angle * 0.18);
        const start = cursor + gap;
        const end = cursor + angle - gap;
        cursor += angle;

        return {
          entry,
          value,
          start,
          end,
          color: palette[index % palette.length],
        };
      });

    if (metrics.free > 0) {
      const angle = (metrics.free / total) * 360;
      base.push({
        entry: { id: "free", name: "Livre", type: "free", equity: metrics.free },
        value: metrics.free,
        start: cursor + 2.2,
        end: cursor + angle - 2.2,
        color: "rgba(255,255,255,0.18)",
      });
    }

    return base;
  }, [entries, metrics.allocated, metrics.free]);

  function updateEntry(id, field, value) {
    setEntries((current) =>
      current.map((entry) => {
        if (entry.id !== id) return entry;
        const next = {
          ...entry,
          [field]: field === "vesting" ? value : field === "equity" || field === "years" ? Number(value) : value,
        };
        if (field === "type" && value === "pool") next.vesting = false;
        return next;
      }),
    );
  }

  function addEntry() {
    setEntries((current) => [
      ...current,
      {
        id: createId(),
        name: "Nova pessoa",
        type: "person",
        equity: 2,
        vesting: true,
        start: today.toISOString().slice(0, 10),
        years: 4,
      },
    ]);
  }

  return (
    <main className="cap-screen">
      <div className="ambient-grid" />
      <button className="edit-trigger" type="button" onClick={() => setEditing(true)}>
        Editar
      </button>

      <section className="hero-panel" aria-label="Cap table distribution">
        <p className="status-line">Live cap table distribution</p>
        <h1>Equity map</h1>
        <p className="subtitle">Fully diluted view with vested status visible at a glance.</p>
      </section>

      <section className="chart-stage" aria-label="Pie chart de equity">
        <svg className="equity-chart" viewBox="0 0 720 720" role="img" aria-label="Distribuicao de equity">
          <defs>
            <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="8" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <circle className="chart-orbit chart-orbit-one" cx="360" cy="360" r="286" />
          <circle className="chart-orbit chart-orbit-two" cx="360" cy="360" r="218" />

          {slices.map((slice) => {
            const mid = (slice.start + slice.end) / 2;
            const isSmall = slice.value < 8;
            const compactIndex = slices
              .filter((candidate) => candidate.value < 8)
              .findIndex((candidate) => candidate.entry.id === slice.entry.id);
            const labelPoint = isSmall
              ? { x: 194, y: 250 + compactIndex * 64 }
              : polarToCartesian(360, 360, 230, mid);
            const anchorPoint = polarToCartesian(360, 360, 292, mid);
            const isPool = slice.entry.type === "pool";
            const path = sectorPath(360, 360, 285, 128, slice.start, slice.end);
            const vested = vestedAmount(slice.entry);

            return (
              <g className={`slice ${isPool ? "slice-pool" : ""}`} key={slice.entry.id}>
                <path d={path} fill={slice.color} filter="url(#glow)" />
                {isSmall ? (
                  <line
                    className="slice-callout-line"
                    x1={anchorPoint.x}
                    y1={anchorPoint.y}
                    x2={labelPoint.x + 18}
                    y2={labelPoint.y + 6}
                  />
                ) : null}
                <text
                  className={`slice-label ${isSmall ? "slice-label-callout" : ""}`}
                  x={labelPoint.x}
                  y={labelPoint.y - 7}
                  textAnchor={isSmall ? "end" : "middle"}
                >
                  {slice.entry.name}
                </text>
                <text
                  className={`slice-value ${isSmall ? "slice-label-callout" : ""}`}
                  x={labelPoint.x}
                  y={labelPoint.y + 24}
                  textAnchor={isSmall ? "end" : "middle"}
                >
                  {formatPercent(slice.value)}
                </text>
                {slice.entry.vesting && slice.entry.type !== "pool" ? (
                  <text className="slice-vesting" x={labelPoint.x} y={labelPoint.y + 49} textAnchor={isSmall ? "end" : "middle"}>
                    {formatPercent(vested)} vested
                  </text>
                ) : null}
              </g>
            );
          })}

          <circle className="chart-core" cx="360" cy="360" r="112" />
          <text className="core-number" x="360" y="344" textAnchor="middle">
            {formatPercent(metrics.allocated)}
          </text>
          <text className="core-label" x="360" y="382" textAnchor="middle">
            allocated
          </text>
        </svg>
      </section>

      <section className="metric-strip" aria-label="Resumo da cap table">
        <div>
          <span>{formatPercent(metrics.vested)}</span>
          <small>vested now</small>
        </div>
        <div>
          <span>{formatPercent(metrics.unvested)}</span>
          <small>future vesting</small>
        </div>
        <div>
          <span>{formatPercent(metrics.pool)}</span>
          <small>pool reserved</small>
        </div>
        <div>
          <span>{formatPercent(metrics.free)}</span>
          <small>unallocated</small>
        </div>
      </section>

      <section className="legend-dock" aria-label="Stakeholders">
        {entries.map((entry, index) => (
          <div className="dock-pill" key={entry.id}>
            <span style={{ background: palette[index % palette.length] }} />
            <strong>{entry.name}</strong>
            <small>{formatPercent(entry.equity)} - {vestingDetail(entry)}</small>
          </div>
        ))}
      </section>

      {editing ? (
        <div className="editor-backdrop" role="presentation">
          <section className="editor-drawer" aria-label="Editar cap table">
            <div className="editor-head">
              <div>
                <p className="status-line">Editor</p>
                <h2>Stakeholders</h2>
              </div>
              <button type="button" onClick={() => setEditing(false)}>
                Fechar
              </button>
            </div>

            <div className="editor-list">
              {entries.map((entry) => (
                <div className="editor-row" key={entry.id}>
                  <input value={entry.name} onChange={(event) => updateEntry(entry.id, "name", event.target.value)} />
                  <select value={entry.type} onChange={(event) => updateEntry(entry.id, "type", event.target.value)}>
                    <option value="founder">Founder</option>
                    <option value="person">Pessoa</option>
                    <option value="investor">Investidor</option>
                    <option value="pool">Pool</option>
                  </select>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={entry.equity}
                    onChange={(event) => updateEntry(entry.id, "equity", event.target.value)}
                  />
                  <label className="checkline">
                    <input
                      type="checkbox"
                      checked={entry.vesting}
                      disabled={entry.type === "pool"}
                      onChange={(event) => updateEntry(entry.id, "vesting", event.target.checked)}
                    />
                    Vesting
                  </label>
                  <input
                    type="date"
                    value={entry.start}
                    disabled={!entry.vesting || entry.type === "pool"}
                    onChange={(event) => updateEntry(entry.id, "start", event.target.value)}
                  />
                  <input
                    type="number"
                    min="0.1"
                    max="20"
                    step="0.5"
                    value={entry.years}
                    disabled={!entry.vesting || entry.type === "pool"}
                    onChange={(event) => updateEntry(entry.id, "years", event.target.value)}
                  />
                  <button type="button" onClick={() => setEntries((current) => current.filter((item) => item.id !== entry.id))}>
                    Remover
                  </button>
                </div>
              ))}
            </div>

            <button className="add-button" type="button" onClick={addEntry}>
              + Adicionar stakeholder
            </button>
          </section>
        </div>
      ) : null}
    </main>
  );
}
