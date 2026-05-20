const ratingOrder = { A: 1, B: 2, C: 3, D: 4, E: 5, U: 6 };
const storageKey = "laifc-fencing-live-state-v2";
const learnedNamesKey = "laifc-learned-fencer-names-v1";

const demoFencers = [
  ["F1001", "Chen, Olivia", "LAIFC", "A"],
  ["F1002", "Park, Daniel", "LAIFC", "B"],
  ["F1003", "Garcia, Mia", "SDFC", "C"],
  ["F1004", "Wang, Ethan", "LAIFC", "D"],
  ["F1005", "Kim, Noah", "OCFC", "U"],
  ["F1006", "Li, Sophia", "LAIFC", "B"],
  ["F1007", "Johnson, Ava", "Fortune", "E"],
  ["F1008", "Nguyen, Leo", "SDFC", "C"],
  ["F1009", "Zhang, Emma", "LAIFC", "A"],
  ["F1010", "Brown, Lucas", "OCFC", "D"],
  ["F1011", "Hernandez, Zoe", "Fortune", "U"],
  ["F1012", "Xu, Mason", "LAIFC", "B"],
].map(([id, name, club, rating], index) => ({
  id,
  name,
  club,
  rating,
  checkedIn: index < 10,
}));

let state = loadState();
let currentView = "checkin";
let draggedFencerId = null;
let nameCache = [];

const els = {
  eventName: document.querySelector("#eventName"),
  targetPoolSize: document.querySelector("#targetPoolSize"),
  viewTitle: document.querySelector("#viewTitle"),
  statChecked: document.querySelector("#statChecked"),
  statPools: document.querySelector("#statPools"),
  statComplete: document.querySelector("#statComplete"),
  rosterList: document.querySelector("#rosterList"),
  fencerSearch: document.querySelector("#fencerSearch"),
  newName: document.querySelector("#newName"),
  nameSuggestions: document.querySelector("#nameSuggestions"),
  checkedFencerBank: document.querySelector("#checkedFencerBank"),
  poolBoard: document.querySelector("#poolBoard"),
  poolResults: document.querySelector("#poolResults"),
  seedList: document.querySelector("#seedList"),
  bracket: document.querySelector("#bracket"),
  postModeNote: document.querySelector("#postModeNote"),
  tableauEventName: document.querySelector("#tableauEventName"),
  tableauFencerCount: document.querySelector("#tableauFencerCount"),
  tableauFormatLabel: document.querySelector("#tableauFormatLabel"),
};

function defaultState() {
  return {
    eventName: "LAIFC Youth Foil",
    targetPoolSize: 6,
    fencers: [],
    pools: [],
    scores: {},
    postseasonMode: "double-de",
    seeds: [],
    bracket: [],
    doubleDE: null,
    secondPools: [],
    secondScores: {},
  };
}

function demoState() {
  return {
    ...defaultState(),
    fencers: structuredClone(demoFencers),
  };
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    return saved || defaultState();
  } catch {
    return defaultState();
  }
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function fencerById(id) {
  return state.fencers.find((fencer) => fencer.id === id);
}

function checkedFencers() {
  return state.fencers.filter((fencer) => fencer.checkedIn);
}

function sortedByRating(fencers) {
  return [...fencers].sort((a, b) => {
    const rating = ratingOrder[a.rating] - ratingOrder[b.rating];
    return rating || a.name.localeCompare(b.name);
  });
}

function render() {
  state.postseasonMode ||= "double-de";
  state.secondPools ||= [];
  state.secondScores ||= {};
  els.eventName.value = state.eventName;
  els.targetPoolSize.value = state.targetPoolSize;
  document.querySelectorAll(".mode-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === state.postseasonMode);
  });
  renderStats();
  renderRoster();
  renderPools();
  renderResults();
  renderDE();
  saveState();
}

async function loadNameCache() {
  try {
    const response = await fetch("./fencer-name-cache.json");
    nameCache = mergeNameCaches(await response.json(), loadLearnedNames());
  } catch {
    nameCache = loadLearnedNames();
  }
}

function loadLearnedNames() {
  try {
    return JSON.parse(localStorage.getItem(learnedNamesKey)) || [];
  } catch {
    return [];
  }
}

function saveLearnedNames(names) {
  localStorage.setItem(learnedNamesKey, JSON.stringify(names));
}

function mergeNameCaches(...groups) {
  const byName = new Map();
  groups.flat().forEach((entry) => {
    if (!entry?.name) return;
    const key = entry.name.trim().toLowerCase();
    if (!byName.has(key)) byName.set(key, { id: entry.id || `LOCAL-${byName.size + 1}`, name: entry.name.trim() });
  });
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function rememberName(name) {
  const cleanName = name.trim();
  if (!cleanName || nameCache.some((entry) => entry.name.toLowerCase() === cleanName.toLowerCase())) return;
  const learned = mergeNameCaches(loadLearnedNames(), [{ id: `LOCAL-${Date.now()}`, name: cleanName }]);
  saveLearnedNames(learned);
  nameCache = mergeNameCaches(nameCache, learned);
}

function renderStats() {
  const completed = allPoolMatches();
  const done = completed.filter((match) => isScoreComplete(match.poolId, match.a, match.b)).length;
  els.statChecked.textContent = checkedFencers().length;
  els.statPools.textContent = state.pools.length;
  els.statComplete.textContent = completed.length ? `${Math.round((done / completed.length) * 100)}%` : "0%";
}

function renderRoster() {
  const query = els.fencerSearch.value.trim().toLowerCase();
  const fencers = sortedByRating(state.fencers).filter((fencer) => {
    return [fencer.id, fencer.name, fencer.club, fencer.rating].join(" ").toLowerCase().includes(query);
  });
  els.rosterList.innerHTML = fencers.length
    ? fencers.map(renderFencerRow).join("")
    : `<div class="empty-state">No fencers checked in yet</div>`;
}

function renderFencerRow(fencer) {
  return `
    <div class="fencer-row" draggable="${fencer.checkedIn}" data-fencer-id="${fencer.id}">
      <span class="rating">${fencer.rating}</span>
      <div>
        <strong>${escapeHtml(fencer.name)}</strong>
        <span>${escapeHtml(fencer.club)} · ${fencer.id}</span>
      </div>
      <span class="pill ${fencer.checkedIn ? "ready" : ""}">${fencer.checkedIn ? "Checked In" : "Not Checked In"}</span>
      <button class="${fencer.checkedIn ? "ghost-button" : "secondary-button"}" data-action="toggle-checkin" data-id="${fencer.id}" type="button">
        ${fencer.checkedIn ? "Undo" : "Check In"}
      </button>
      <button class="ghost-button danger-button" data-action="delete-fencer" data-id="${fencer.id}" type="button">Delete</button>
    </div>
  `;
}

function renderNameSuggestions() {
  const query = els.newName.value.trim().toLowerCase();
  if (query.length < 2) {
    els.nameSuggestions.innerHTML = "";
    els.nameSuggestions.classList.remove("active");
    return;
  }
  const matches = nameCache
    .filter((fencer) => fencer.name.toLowerCase().includes(query) || fencer.id.includes(query))
    .slice(0, 10);
  els.nameSuggestions.innerHTML = matches.length
    ? matches.map((fencer) => `
      <button type="button" data-action="pick-name" data-name="${escapeHtml(fencer.name)}">
        <strong>${escapeHtml(fencer.name)}</strong>
        <span>${escapeHtml(fencer.id)}</span>
      </button>
    `).join("")
    : `<div class="suggestion-empty">No history match. Continue typing manually.</div>`;
  els.nameSuggestions.classList.add("active");
}

function renderPools() {
  const assigned = new Set(state.pools.flatMap((pool) => pool.fencerIds));
  const bank = sortedByRating(checkedFencers()).filter((fencer) => !assigned.has(fencer.id));
  els.checkedFencerBank.innerHTML = bank.length
    ? bank.map((fencer) => renderPoolFencer(fencer, "bank")).join("")
    : `<div class="empty-state">No unassigned fencers</div>`;

  els.poolBoard.innerHTML = state.pools.length
    ? state.pools.map(renderPoolCard).join("")
    : `<div class="empty-state">Use a pooling button or Add Pool to create pools</div>`;
}

function renderPoolCard(pool, index) {
  const rows = pool.fencerIds
    .map((id) => fencerById(id))
    .filter(Boolean)
    .map((fencer) => renderPoolFencer(fencer, pool.id))
    .join("");

  return `
    <article class="pool-card" data-pool-id="${pool.id}">
      <header>
        <div>
          <h2>Pool ${index + 1}</h2>
          <span>${pool.rating ? `${pool.rating} Rating · ` : ""}${pool.fencerIds.length} fencers</span>
        </div>
        <button class="ghost-button delete-pool-button" data-action="delete-empty-pool" data-pool-id="${pool.id}" type="button" ${pool.fencerIds.length ? "disabled" : ""}>Delete</button>
      </header>
      <div class="pool-list">${rows || `<div class="empty-state">Drag fencers here</div>`}</div>
    </article>
  `;
}

function renderPoolFencer(fencer, location) {
  const options = [`<option value="">Move to...</option>`, `<option value="bank">Unassigned</option>`]
    .concat(state.pools.map((pool, index) => `<option value="${pool.id}">Pool ${index + 1}</option>`))
    .join("");
  return `
    <div class="fencer-row pool-fencer-row" draggable="true" data-fencer-id="${fencer.id}">
      <span class="rating">${fencer.rating}</span>
      <div>
        <strong>${escapeHtml(fencer.name)}</strong>
        <span>${escapeHtml(fencer.club)} · ${fencer.id}</span>
      </div>
      <select class="move-select" data-action="move-fencer" data-id="${fencer.id}" data-location="${location}">
        ${options}
      </select>
    </div>
  `;
}

function renderResults() {
  els.poolResults.innerHTML = state.pools.length
    ? state.pools.map((pool, index) => renderPoolResult(pool, index)).join("")
    : `<div class="empty-state">Create pools before entering pool results</div>`;
}

function renderPoolResult(pool, index) {
  const matches = pairings(pool.fencerIds);
  const standings = poolStandings(pool.id);
  const placeById = Object.fromEntries(standings.map((row, place) => [row.fencer.id, { ...row, place: place + 1 }]));
  const fencers = pool.fencerIds.map((id) => fencerById(id)).filter(Boolean);
  return `
    <article class="pool-sheet">
      <header class="pool-sheet-header">
        <div>
          <h2>Pool ${index + 1}</h2>
          <span>${matches.filter((m) => isScoreComplete(pool.id, m[0], m[1])).length}/${matches.length} complete</span>
        </div>
        <span>${fencers.length} fencers</span>
      </header>
      <div class="pool-sheet-scroll">
        <table class="pool-sheet-table">
          <thead>
            <tr>
              <th class="pool-name-col">Fencer</th>
              ${fencers.map((fencer, opponentIndex) => `<th class="opponent-col">${opponentIndex + 1}</th>`).join("")}
              <th>V</th>
              <th>TS</th>
              <th>TR</th>
              <th>Ind</th>
              <th>Pl</th>
            </tr>
          </thead>
          <tbody>
            ${fencers.map((fencer, rowIndex) => renderPoolSheetRow(pool.id, fencer, fencers, rowIndex, placeById[fencer.id])).join("")}
          </tbody>
        </table>
      </div>
    </article>
  `;
}

function renderPoolSheetRow(poolId, fencer, fencers, rowIndex, standing) {
  return `
    <tr>
      <th class="pool-name-col">
        <span class="pool-line-number">${rowIndex + 1}</span>
        <div>
          <strong>${escapeHtml(fencer.name)}</strong>
          <span>${escapeHtml(fencer.club)} · ${fencer.rating}</span>
        </div>
      </th>
      ${fencers.map((opponent, colIndex) => renderPoolMatrixCell(poolId, fencer.id, opponent.id, rowIndex, colIndex)).join("")}
      <td class="stat-cell">${standing?.victories ?? 0}</td>
      <td class="stat-cell">${standing?.touchesScored ?? 0}</td>
      <td class="stat-cell">${standing?.touchesReceived ?? 0}</td>
      <td class="stat-cell">${standing?.indicator ?? 0}</td>
      <td class="place-cell">${standing?.place ?? ""}</td>
    </tr>
  `;
}

function renderPoolMatrixCell(poolId, fencerId, opponentId, rowIndex, colIndex) {
  if (fencerId === opponentId) return `<td class="self-cell">X</td>`;
  const score = scoreFor(poolId, fencerId, opponentId);
  const value = score?.a ?? "";
  const complete = isScoreComplete(poolId, fencerId, opponentId);
  const won = complete && Number(score.a) > Number(score.b);
  return `
    <td class="${complete ? won ? "won-cell" : "lost-cell" : ""}">
      <input class="matrix-score-input" inputmode="numeric" data-action="pool-score" data-pool-id="${poolId}" data-a="${fencerId}" data-b="${opponentId}" data-side="a" value="${value}" aria-label="Pool score row ${rowIndex + 1} column ${colIndex + 1}" />
    </td>
  `;
}

function renderLegacyPoolResult(pool, index) {
  const matches = pairings(pool.fencerIds);
  const standings = poolStandings(pool.id);
  return `
    <article class="result-panel">
      <header>
        <h2>Pool ${index + 1}</h2>
        <span>${matches.filter((m) => isScoreComplete(pool.id, m[0], m[1])).length}/${matches.length} complete</span>
      </header>
      <table class="score-table">
        <thead><tr><th>Fencer A</th><th>Score</th><th>Fencer B</th><th>Winner</th></tr></thead>
        <tbody>
          ${matches.map(([a, b]) => renderScoreRow(pool.id, a, b)).join("")}
        </tbody>
      </table>
    </article>
  `;
}

function renderScoreRow(poolId, a, b) {
  const fencerA = fencerById(a);
  const fencerB = fencerById(b);
  const score = scoreFor(poolId, a, b);
  const winner = score && score.a !== "" && score.b !== "" && Number(score.a) !== Number(score.b)
    ? Number(score.a) > Number(score.b) ? fencerA.name : fencerB.name
    : "—";
  return `
    <tr>
      <td>${escapeHtml(fencerA.name)}</td>
      <td>
        <input class="score-input" inputmode="numeric" data-action="pool-score" data-pool-id="${poolId}" data-a="${a}" data-b="${b}" data-side="a" value="${score?.a ?? ""}" />
        :
        <input class="score-input" inputmode="numeric" data-action="pool-score" data-pool-id="${poolId}" data-a="${a}" data-b="${b}" data-side="b" value="${score?.b ?? ""}" />
      </td>
      <td>${escapeHtml(fencerB.name)}</td>
      <td class="${winner === "—" ? "" : "winner"}">${escapeHtml(winner)}</td>
    </tr>
  `;
}

function renderDE() {
  els.tableauEventName.textContent = state.eventName || "Untitled Event";
  els.tableauFencerCount.textContent = `${checkedFencers().length} fencers`;
  els.tableauFormatLabel.textContent = state.postseasonMode === "second-pools" ? "Second 15-Touch Pools" : "Double DE Tableau";
  els.seedList.innerHTML = state.seeds.length
    ? state.seeds.map((seed, index) => {
        const fencer = fencerById(seed.fencerId);
        return `
          <div class="seed-row">
            <span class="seed-number">${index + 1}</span>
            <div><strong>${escapeHtml(fencer.name)}</strong><span>${escapeHtml(fencer.club)} · ${fencer.rating}</span></div>
            <span class="pill">${seed.victories}V / ${seed.indicator}</span>
          </div>
        `;
      }).join("")
    : `<div class="empty-state">Generate post-pool format to show seeding</div>`;

  if (state.postseasonMode === "second-pools") {
    els.postModeNote.textContent = "Second pools are snake-seeded from the first pool results. All bouts are scored to 15.";
    els.bracket.className = "second-pool-grid";
    els.bracket.innerHTML = state.secondPools?.length
      ? state.secondPools.map(renderSecondPool).join("")
      : `<div class="empty-state">Select Second 15-Touch Pools, then generate</div>`;
    return;
  }

  els.postModeNote.textContent = "Double DE: one loss drops a fencer to the loser bracket; a second loss eliminates them. Winners meet in the Grand Final.";
  els.bracket.className = "double-tableau";
  els.bracket.innerHTML = state.doubleDE
    ? renderDoubleTableau()
    : `<div class="empty-state">Select Double DE Tableau, then generate</div>`;
}

function renderSecondPool(pool, index) {
  const matches = pairings(pool.fencerIds);
  const standings = secondPoolStandings(pool.id);
  return `
    <article class="result-panel">
      <header>
        <h2>Second Pool ${index + 1}</h2>
        <span>15 touches · ${matches.filter((m) => isSecondScoreComplete(pool.id, m[0], m[1])).length}/${matches.length} complete</span>
      </header>
      <table class="score-table">
        <thead><tr><th>Fencer A</th><th>15-Touch Score</th><th>Fencer B</th><th>Winner</th></tr></thead>
        <tbody>${matches.map(([a, b]) => renderSecondScoreRow(pool.id, a, b)).join("")}</tbody>
      </table>
      <table class="standings-table">
        <thead><tr><th>Rank</th><th>Fencer</th><th>V</th><th>TS</th><th>TR</th><th>Ind</th></tr></thead>
        <tbody>
          ${standings.map((row, place) => `
            <tr>
              <td>${place + 1}</td>
              <td>${escapeHtml(row.fencer.name)}</td>
              <td>${row.victories}</td>
              <td>${row.touchesScored}</td>
              <td>${row.touchesReceived}</td>
              <td>${row.indicator}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </article>
  `;
}

function renderSecondScoreRow(poolId, a, b) {
  const fencerA = fencerById(a);
  const fencerB = fencerById(b);
  const score = secondScoreFor(poolId, a, b);
  const winner = score && score.a !== "" && score.b !== "" && Number(score.a) !== Number(score.b)
    ? Number(score.a) > Number(score.b) ? fencerA.name : fencerB.name
    : "-";
  return `
    <tr>
      <td>${escapeHtml(fencerA.name)}</td>
      <td>
        <input class="score-input" inputmode="numeric" data-action="second-score" data-pool-id="${poolId}" data-a="${a}" data-b="${b}" data-side="a" value="${score?.a ?? ""}" />
        :
        <input class="score-input" inputmode="numeric" data-action="second-score" data-pool-id="${poolId}" data-a="${a}" data-b="${b}" data-side="b" value="${score?.b ?? ""}" />
      </td>
      <td>${escapeHtml(fencerB.name)}</td>
      <td class="${winner === "-" ? "" : "winner"}">${escapeHtml(winner)}</td>
    </tr>
  `;
}

function renderDoubleTableau() {
  return `
    <section class="ftl-bracket-section">
      <h2>Winner Bracket</h2>
      <div class="bracket">${state.doubleDE.upper.map((round, index) => renderDERound(round, "upper", index)).join("")}</div>
    </section>
    <section class="ftl-bracket-section">
      <h2>Loser Bracket</h2>
      <div class="bracket">${state.doubleDE.lower.map((round, index) => renderDERound(round, "lower", index)).join("")}</div>
    </section>
    <section class="ftl-bracket-section">
      <h2>Grand Final</h2>
      <div class="bracket">${renderDEMatch(state.doubleDE.final, "final", 0, 0)}</div>
    </section>
    <section class="ftl-bracket-section">
      <h2>Eliminated</h2>
      <div class="elimination-list">${renderEliminated()}</div>
    </section>
  `;
}

function renderDERound(round, side, roundIndex) {
  return `
    <div class="round">
      <h2>${round.name}</h2>
      ${round.matches.map((match, matchIndex) => renderDEMatch(match, side, roundIndex, matchIndex)).join("")}
    </div>
  `;
}

function renderDEMatch(match, side, roundIndex, matchIndex) {
  const a = match.a ? fencerById(match.a) : null;
  const b = match.b ? fencerById(match.b) : null;
  const locked = match.winner ? `<span class="match-status">Winner: ${escapeHtml(fencerById(match.winner)?.name || "")}</span>` : "";
  return `
    <div class="match">
      <div class="match-row ${match.winner === match.a ? "match-winner-row" : ""}">
        <span class="match-seed">${match.aSeed || ""}</span>
        <strong class="${a ? "" : "bye"}">${a ? escapeHtml(a.name) : "BYE"}</strong>
        <input class="match-score" inputmode="numeric" data-action="de-score" data-side-name="${side}" data-round="${roundIndex}" data-match="${matchIndex}" data-side="a" value="${match.aScore ?? ""}" ${a ? "" : "disabled"} />
      </div>
      <div class="match-row ${match.winner === match.b ? "match-winner-row" : ""}">
        <span class="match-seed">${match.bSeed || ""}</span>
        <strong class="${b ? "" : "bye"}">${b ? escapeHtml(b.name) : "BYE"}</strong>
        <input class="match-score" inputmode="numeric" data-action="de-score" data-side-name="${side}" data-round="${roundIndex}" data-match="${matchIndex}" data-side="b" value="${match.bScore ?? ""}" ${b ? "" : "disabled"} />
      </div>
      ${locked}
      <div class="match-actions">
        <button class="ghost-button" data-action="advance" data-side-name="${side}" data-round="${roundIndex}" data-match="${matchIndex}" data-winner="${match.a || ""}" ${a ? "" : "disabled"}>${a ? "A Wins" : "BYE"}</button>
        <button class="ghost-button" data-action="advance" data-side-name="${side}" data-round="${roundIndex}" data-match="${matchIndex}" data-winner="${match.b || ""}" ${b ? "" : "disabled"}>${b ? "B Wins" : "BYE"}</button>
      </div>
    </div>
  `;
}

function renderEliminated() {
  const eliminated = state.doubleDE.eliminated || [];
  return eliminated.length
    ? eliminated.map((item) => {
        const fencer = fencerById(item.fencerId);
        return `<span class="pill">${escapeHtml(fencer?.name || item.fencerId)}</span>`;
      }).join("")
    : `<span class="pill ready">No eliminations yet</span>`;
}

function resetPostPoolState() {
  state.scores = {};
  state.seeds = [];
  state.bracket = [];
  state.doubleDE = null;
  state.secondPools = [];
  state.secondScores = {};
}

function addPool() {
  state.pools.push({ id: nextPoolId(), fencerIds: [] });
  resetPostPoolState();
  render();
}

function deleteEmptyPool(poolId) {
  const pool = state.pools.find((item) => item.id === poolId);
  if (!pool || pool.fencerIds.length) return;
  state.pools = state.pools.filter((item) => item.id !== poolId);
  resetPostPoolState();
  render();
}

function nextPoolId() {
  const used = new Set(state.pools.map((pool) => pool.id));
  let index = state.pools.length + 1;
  while (used.has(`pool-${index}`)) index += 1;
  return `pool-${index}`;
}

function snakeSeedPools() {
  const fencers = sortedByRating(checkedFencers());
  const target = Math.max(3, Number(state.targetPoolSize) || 6);
  const poolCount = Math.max(1, Math.ceil(fencers.length / target));
  const pools = Array.from({ length: poolCount }, (_, index) => ({ id: `pool-${index + 1}`, fencerIds: [] }));
  fencers.forEach((fencer, index) => {
    const cycle = Math.floor(index / poolCount);
    const offset = index % poolCount;
    const poolIndex = cycle % 2 === 0 ? offset : poolCount - 1 - offset;
    pools[poolIndex].fencerIds.push(fencer.id);
  });
  state.pools = pools;
  resetPostPoolState();
  render();
}

function ratingClusterPools() {
  const fencers = sortedByRating(checkedFencers());
  const target = Math.max(3, Number(state.targetPoolSize) || 6);
  const pools = [];
  const byRating = Object.keys(ratingOrder).map((rating) => fencers.filter((fencer) => fencer.rating === rating));
  byRating.forEach((group) => {
    group.forEach((fencer) => {
      let pool = pools.find((item) => item.rating === fencer.rating && item.fencerIds.length < target);
      if (!pool) {
        pool = { id: `pool-${pools.length + 1}`, rating: fencer.rating, fencerIds: [] };
        pools.push(pool);
      }
      pool.fencerIds.push(fencer.id);
    });
  });
  state.pools = pools.map((pool, index) => ({ id: `pool-${index + 1}`, rating: pool.rating, fencerIds: pool.fencerIds }));
  resetPostPoolState();
  render();
}

function moveFencer(fencerId, destination) {
  state.pools.forEach((pool) => {
    pool.fencerIds = pool.fencerIds.filter((id) => id !== fencerId);
  });
  if (destination && destination !== "bank") {
    const pool = state.pools.find((item) => item.id === destination);
    if (pool && !pool.fencerIds.includes(fencerId)) pool.fencerIds.push(fencerId);
  }
  resetPostPoolState();
  render();
}

function pairings(ids) {
  const pairs = [];
  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) pairs.push([ids[i], ids[j]]);
  }
  return pairs;
}

function scoreKey(poolId, a, b) {
  return `${poolId}:${[a, b].sort().join("-")}`;
}

function scoreFor(poolId, a, b) {
  const score = state.scores[scoreKey(poolId, a, b)];
  if (!score) return null;
  return score.aId === a ? { a: score.a, b: score.b } : { a: score.b, b: score.a };
}

function setScore(poolId, a, b, side, value) {
  const focus = getInputFocusSnapshot();
  const key = scoreKey(poolId, a, b);
  const existing = state.scores[key] || { aId: a, bId: b, a: "", b: "" };
  if (existing.aId === a) existing[side] = value;
  else existing[side === "a" ? "b" : "a"] = value;
  state.scores[key] = existing;
  render();
  restoreInputFocus(focus);
}

function isScoreComplete(poolId, a, b) {
  const score = scoreFor(poolId, a, b);
  return score && score.a !== "" && score.b !== "" && Number(score.a) !== Number(score.b);
}

function allPoolMatches() {
  return state.pools.flatMap((pool) => pairings(pool.fencerIds).map(([a, b]) => ({ poolId: pool.id, a, b })));
}

function poolStandings(poolId) {
  const pool = state.pools.find((item) => item.id === poolId);
  if (!pool) return [];
  const rows = pool.fencerIds.map((id) => ({
    fencer: fencerById(id),
    victories: 0,
    bouts: 0,
    touchesScored: 0,
    touchesReceived: 0,
    indicator: 0,
  }));
  const byId = Object.fromEntries(rows.map((row) => [row.fencer.id, row]));
  pairings(pool.fencerIds).forEach(([a, b]) => {
    const score = scoreFor(poolId, a, b);
    if (!score || score.a === "" || score.b === "" || Number(score.a) === Number(score.b)) return;
    const aScore = Number(score.a);
    const bScore = Number(score.b);
    byId[a].bouts += 1;
    byId[b].bouts += 1;
    byId[a].touchesScored += aScore;
    byId[a].touchesReceived += bScore;
    byId[b].touchesScored += bScore;
    byId[b].touchesReceived += aScore;
    if (aScore > bScore) byId[a].victories += 1;
    else byId[b].victories += 1;
  });
  rows.forEach((row) => {
    row.indicator = row.touchesScored - row.touchesReceived;
  });
  return rows.sort((a, b) => (
    b.victories - a.victories ||
    b.indicator - a.indicator ||
    b.touchesScored - a.touchesScored ||
    a.fencer.name.localeCompare(b.fencer.name)
  ));
}

function generateDE() {
  state.seeds = buildSeeds();
  if (state.postseasonMode === "second-pools") {
    state.secondPools = buildSecondPools(state.seeds);
    state.secondScores = {};
    state.doubleDE = null;
    state.bracket = [];
  } else {
    state.doubleDE = buildDoubleDE(state.seeds);
    state.secondPools = [];
    state.secondScores = {};
    autoAdvanceDoubleByes();
  }
  render();
}

function buildSeeds() {
  return state.pools
    .flatMap((pool) => poolStandings(pool.id))
    .map((row) => ({
      fencerId: row.fencer.id,
      victories: row.victories,
      bouts: row.bouts,
      touchesScored: row.touchesScored,
      touchesReceived: row.touchesReceived,
      indicator: row.indicator,
      winRate: row.bouts ? row.victories / row.bouts : 0,
    }))
    .sort((a, b) => (
      b.winRate - a.winRate ||
      b.indicator - a.indicator ||
      b.touchesScored - a.touchesScored ||
      fencerById(a.fencerId).name.localeCompare(fencerById(b.fencerId).name)
    ));
}

function buildSecondPools(seeds) {
  const target = Math.max(3, Number(state.targetPoolSize) || 6);
  const poolCount = Math.max(1, Math.ceil(seeds.length / target));
  const pools = Array.from({ length: poolCount }, (_, index) => ({ id: `second-pool-${index + 1}`, fencerIds: [] }));
  seeds.forEach((seed, index) => {
    const cycle = Math.floor(index / poolCount);
    const offset = index % poolCount;
    const poolIndex = cycle % 2 === 0 ? offset : poolCount - 1 - offset;
    pools[poolIndex].fencerIds.push(seed.fencerId);
  });
  return pools;
}

function buildDoubleDE(seeds) {
  if (!seeds.length) return null;
  const size = nextPowerOfTwo(seeds.length);
  const slots = bracketSeedOrder(size).map((seedNumber) => {
    const seed = seeds[seedNumber - 1];
    return seed ? { fencerId: seed.fencerId, seedNumber } : { fencerId: null, seedNumber: null };
  });
  const rounds = [];
  const firstMatches = [];
  for (let i = 0; i < slots.length; i += 2) {
    firstMatches.push(createMatch(`u0m${i / 2}`, slots[i], slots[i + 1]));
  }
  rounds.push({ name: roundName(size), matches: firstMatches });
  let matchesInRound = firstMatches.length / 2;
  let roundIndex = 1;
  while (matchesInRound >= 1) {
    rounds.push({
      name: matchesInRound === 1 ? "Winner Final" : roundName(matchesInRound * 2),
      matches: Array.from({ length: matchesInRound }, (_, index) => createEmptyMatch(`u${roundIndex}m${index}`)),
    });
    matchesInRound /= 2;
    roundIndex += 1;
  }

  const lower = [];
  for (let level = 1; level < Math.log2(size); level += 1) {
    const count = size / 2 ** (level + 1);
    lower.push({
      name: `Loser ${lower.length + 1}`,
      matches: Array.from({ length: count }, (_, index) => createEmptyMatch(`l${lower.length}m${index}`)),
    });
    lower.push({
      name: `Loser ${lower.length + 1}`,
      matches: Array.from({ length: count }, (_, index) => createEmptyMatch(`l${lower.length}m${index}`)),
    });
  }

  return {
    size,
    upper: rounds,
    lower,
    final: createEmptyMatch("grand-final"),
    losses: Object.fromEntries(seeds.map((seed) => [seed.fencerId, 0])),
    eliminated: [],
  };
}

function createMatch(id, aSlot, bSlot) {
  return {
    id,
    a: aSlot.fencerId,
    b: bSlot.fencerId,
    aSeed: aSlot.seedNumber,
    bSeed: bSlot.seedNumber,
    winner: null,
    loser: null,
    aScore: "",
    bScore: "",
  };
}

function createEmptyMatch(id) {
  return createMatch(id, { fencerId: null, seedNumber: null }, { fencerId: null, seedNumber: null });
}

function secondScoreKey(poolId, a, b) {
  return `second:${poolId}:${[a, b].sort().join("-")}`;
}

function secondScoreFor(poolId, a, b) {
  const score = state.secondScores[secondScoreKey(poolId, a, b)];
  if (!score) return null;
  return score.aId === a ? { a: score.a, b: score.b } : { a: score.b, b: score.a };
}

function setSecondScore(poolId, a, b, side, value) {
  const focus = getInputFocusSnapshot();
  const key = secondScoreKey(poolId, a, b);
  const existing = state.secondScores[key] || { aId: a, bId: b, a: "", b: "" };
  if (existing.aId === a) existing[side] = value;
  else existing[side === "a" ? "b" : "a"] = value;
  state.secondScores[key] = existing;
  render();
  restoreInputFocus(focus);
}

function isSecondScoreComplete(poolId, a, b) {
  const score = secondScoreFor(poolId, a, b);
  return score && score.a !== "" && score.b !== "" && Number(score.a) !== Number(score.b);
}

function secondPoolStandings(poolId) {
  const pool = state.secondPools.find((item) => item.id === poolId);
  if (!pool) return [];
  const rows = pool.fencerIds.map((id) => ({
    fencer: fencerById(id),
    victories: 0,
    touchesScored: 0,
    touchesReceived: 0,
    indicator: 0,
  }));
  const byId = Object.fromEntries(rows.map((row) => [row.fencer.id, row]));
  pairings(pool.fencerIds).forEach(([a, b]) => {
    const score = secondScoreFor(poolId, a, b);
    if (!score || score.a === "" || score.b === "" || Number(score.a) === Number(score.b)) return;
    const aScore = Number(score.a);
    const bScore = Number(score.b);
    byId[a].touchesScored += aScore;
    byId[a].touchesReceived += bScore;
    byId[b].touchesScored += bScore;
    byId[b].touchesReceived += aScore;
    if (aScore > bScore) byId[a].victories += 1;
    else byId[b].victories += 1;
  });
  rows.forEach((row) => {
    row.indicator = row.touchesScored - row.touchesReceived;
  });
  return rows.sort((a, b) => (
    b.victories - a.victories ||
    b.indicator - a.indicator ||
    b.touchesScored - a.touchesScored ||
    a.fencer.name.localeCompare(b.fencer.name)
  ));
}

function legacyBuildBracket(seeds) {
  if (!seeds.length) return [];
  const size = nextPowerOfTwo(seeds.length);
  const slots = bracketSeedOrder(size).map((seedNumber) => {
    const seed = seeds[seedNumber - 1];
    return seed ? { fencerId: seed.fencerId, seedNumber } : { fencerId: null, seedNumber: null };
  });
  const rounds = [];
  const firstMatches = [];
  for (let i = 0; i < slots.length; i += 2) {
    firstMatches.push({
      id: `r0m${i / 2}`,
      a: slots[i].fencerId,
      b: slots[i + 1].fencerId,
      aSeed: slots[i].seedNumber,
      bSeed: slots[i + 1].seedNumber,
      winner: null,
      aScore: "",
      bScore: "",
    });
  }
  rounds.push({ name: roundName(size), matches: firstMatches });
  let matchesInRound = firstMatches.length / 2;
  let roundIndex = 1;
  while (matchesInRound >= 1) {
    rounds.push({
      name: matchesInRound === 1 ? "Final" : roundName(matchesInRound * 2),
      matches: Array.from({ length: matchesInRound }, (_, index) => ({
        id: `r${roundIndex}m${index}`,
        a: null,
        b: null,
        aSeed: null,
        bSeed: null,
        winner: null,
        aScore: "",
        bScore: "",
      })),
    });
    matchesInRound /= 2;
    roundIndex += 1;
  }
  return rounds;
}

function bracketSeedOrder(size) {
  let order = [1, 2];
  while (order.length < size) {
    const next = order.length * 2 + 1;
    order = order.flatMap((seed) => [seed, next - seed]);
  }
  return order;
}

function nextPowerOfTwo(value) {
  return 2 ** Math.ceil(Math.log2(Math.max(2, value)));
}

function roundName(size) {
  return size === 2 ? "Final" : `Table of ${size}`;
}

function autoAdvanceDoubleByes() {
  if (!state.doubleDE) return;
  let changed = true;
  while (changed) {
    changed = false;
    ["upper", "lower"].forEach((side) => {
      state.doubleDE[side].forEach((round, roundIndex) => {
        round.matches.forEach((match, matchIndex) => {
          if (match.winner) return;
          if (match.a && !match.b) {
            applyDEWinner(side, roundIndex, matchIndex, match.a);
            changed = true;
          }
          if (!match.a && match.b) {
            applyDEWinner(side, roundIndex, matchIndex, match.b);
            changed = true;
          }
        });
      });
    });
  }
}

function advanceWinner(side, roundIndex, matchIndex, winnerId, shouldRender = true) {
  const match = getDEMatch(side, roundIndex, matchIndex);
  if (!match || !winnerId) return;
  const scroll = getTableauScrollSnapshot();
  const decisions = snapshotDEDecisions();
  decisions[deDecisionKey(side, roundIndex, matchIndex)] = {
    a: match.a,
    b: match.b,
    aScore: match.aScore,
    bScore: match.bScore,
    winner: winnerId,
  };
  rebuildDoubleDEFromDecisions(decisions);
  if (shouldRender) {
    render();
    restoreTableauScroll(scroll);
  }
}

function applyDEWinner(side, roundIndex, matchIndex, winnerId) {
  const match = getDEMatch(side, roundIndex, matchIndex);
  if (!match || !winnerId || (match.a !== winnerId && match.b !== winnerId) || match.winner) return false;
  const loserId = match.a === winnerId ? match.b : match.a;
  match.winner = winnerId;
  match.loser = loserId || null;

  if (side === "upper") {
    routeUpperWinner(roundIndex, matchIndex, winnerId);
    if (loserId) {
      addLoss(loserId);
      routeUpperLoser(roundIndex, matchIndex, loserId);
    }
  } else if (side === "lower") {
    if (loserId) addLoss(loserId);
    routeLowerWinner(roundIndex, matchIndex, winnerId);
  } else {
    state.doubleDE.champion = winnerId;
    if (loserId) addLoss(loserId);
  }
  return true;
}

function deDecisionKey(side, roundIndex, matchIndex) {
  return `${side}:${roundIndex}:${matchIndex}`;
}

function snapshotDEDecisions() {
  const decisions = {};
  forEachDEMatch((match, side, roundIndex, matchIndex) => {
    if (!match.winner && match.aScore === "" && match.bScore === "") return;
    decisions[deDecisionKey(side, roundIndex, matchIndex)] = {
      a: match.a,
      b: match.b,
      aScore: match.aScore,
      bScore: match.bScore,
      winner: match.winner,
    };
  });
  return decisions;
}

function rebuildDoubleDEFromDecisions(decisions) {
  if (!state.seeds.length) return;
  state.doubleDE = buildDoubleDE(state.seeds);
  autoAdvanceDoubleByes();
  forEachDEMatch((match, side, roundIndex, matchIndex) => {
    const decision = decisions[deDecisionKey(side, roundIndex, matchIndex)];
    if (!decision) return;
    if (decision.a === match.a && decision.b === match.b) {
      match.aScore = decision.aScore ?? "";
      match.bScore = decision.bScore ?? "";
    }
    if (decision.winner && (match.a === decision.winner || match.b === decision.winner)) {
      applyDEWinner(side, roundIndex, matchIndex, decision.winner);
      autoAdvanceDoubleByes();
    }
  });
}

function forEachDEMatch(callback) {
  if (!state.doubleDE) return;
  state.doubleDE.upper.forEach((round, roundIndex) => {
    round.matches.forEach((match, matchIndex) => callback(match, "upper", roundIndex, matchIndex));
  });
  state.doubleDE.lower.forEach((round, roundIndex) => {
    round.matches.forEach((match, matchIndex) => callback(match, "lower", roundIndex, matchIndex));
  });
  callback(state.doubleDE.final, "final", 0, 0);
}

function getTableauScrollSnapshot() {
  const scrollArea = document.querySelector(".ftl-tableau-scroll");
  return {
    windowX: window.scrollX,
    windowY: window.scrollY,
    outer: scrollArea ? { left: scrollArea.scrollLeft, top: scrollArea.scrollTop } : null,
    brackets: [...document.querySelectorAll(".ftl-bracket-section .bracket")].map((bracket) => ({
      left: bracket.scrollLeft,
      top: bracket.scrollTop,
    })),
  };
}

function restoreTableauScroll(snapshot) {
  if (!snapshot) return;
  const restore = () => {
    const scrollArea = document.querySelector(".ftl-tableau-scroll");
    if (scrollArea && snapshot.outer) scrollArea.scrollTo(snapshot.outer.left, snapshot.outer.top);
    document.querySelectorAll(".ftl-bracket-section .bracket").forEach((bracket, index) => {
      const saved = snapshot.brackets?.[index];
      if (saved) bracket.scrollTo(saved.left, saved.top);
    });
    window.scrollTo(snapshot.windowX || 0, snapshot.windowY || 0);
  };
  requestAnimationFrame(() => {
    restore();
    requestAnimationFrame(restore);
  });
}

function getInputFocusSnapshot() {
  const input = document.activeElement;
  if (!(input instanceof HTMLInputElement) || !input.dataset.action) return null;
  return {
    dataset: { ...input.dataset },
    start: input.selectionStart,
    end: input.selectionEnd,
  };
}

function restoreInputFocus(snapshot) {
  if (!snapshot) return;
  requestAnimationFrame(() => {
    const input = [...document.querySelectorAll("input[data-action]")].find((candidate) => {
      return Object.entries(snapshot.dataset).every(([key, value]) => candidate.dataset[key] === value);
    });
    if (!input) return;
    input.focus({ preventScroll: true });
    if (Number.isInteger(snapshot.start) && Number.isInteger(snapshot.end)) {
      input.setSelectionRange(snapshot.start, snapshot.end);
    }
  });
}

function getDEMatch(side, roundIndex, matchIndex) {
  if (!state.doubleDE) return null;
  if (side === "final") return state.doubleDE.final;
  return state.doubleDE[side]?.[roundIndex]?.matches?.[matchIndex] || null;
}

function routeUpperWinner(roundIndex, matchIndex, winnerId) {
  const nextRound = state.doubleDE.upper[roundIndex + 1];
  if (!nextRound) {
    placeFencer(state.doubleDE.final, winnerId, "a");
    return;
  }
  const nextMatch = nextRound.matches[Math.floor(matchIndex / 2)];
  placeFencer(nextMatch, winnerId, matchIndex % 2 === 0 ? "a" : "b");
}

function routeUpperLoser(roundIndex, matchIndex, loserId) {
  const lowerRoundIndex = roundIndex === 0 ? 0 : roundIndex * 2 - 1;
  const lowerRound = state.doubleDE.lower[lowerRoundIndex];
  if (!lowerRound) return;
  const targetIndex = roundIndex === 0 ? Math.floor(matchIndex / 2) : Math.min(matchIndex, lowerRound.matches.length - 1);
  const target = lowerRound.matches[targetIndex];
  placeFencer(target, loserId, roundIndex === 0 && matchIndex % 2 === 0 ? "a" : null);
}

function routeLowerWinner(roundIndex, matchIndex, winnerId) {
  const nextRound = state.doubleDE.lower[roundIndex + 1];
  if (!nextRound) {
    placeFencer(state.doubleDE.final, winnerId, "b");
    return;
  }
  const nextIndex = roundIndex % 2 === 0 ? matchIndex : Math.floor(matchIndex / 2);
  const target = nextRound.matches[Math.min(nextIndex, nextRound.matches.length - 1)];
  placeFencer(target, winnerId, roundIndex % 2 === 0 ? "a" : null);
}

function placeFencer(match, fencerId, preferredSide = null) {
  if (!match || !fencerId || match.a === fencerId || match.b === fencerId) return;
  const seed = seedNumberFor(fencerId);
  if (preferredSide === "a" && !match.a) {
    match.a = fencerId;
    match.aSeed = seed;
    return;
  }
  if (preferredSide === "b" && !match.b) {
    match.b = fencerId;
    match.bSeed = seed;
    return;
  }
  if (!match.a) {
    match.a = fencerId;
    match.aSeed = seed;
    return;
  }
  if (!match.b) {
    match.b = fencerId;
    match.bSeed = seed;
  }
}

function seedNumberFor(fencerId) {
  const index = state.seeds.findIndex((seed) => seed.fencerId === fencerId);
  return index >= 0 ? index + 1 : "";
}

function addLoss(fencerId) {
  state.doubleDE.losses[fencerId] = (state.doubleDE.losses[fencerId] || 0) + 1;
  if (state.doubleDE.losses[fencerId] >= 2 && !state.doubleDE.eliminated.some((item) => item.fencerId === fencerId)) {
    state.doubleDE.eliminated.push({ fencerId });
  }
}

function setDEScore(sideName, roundIndex, matchIndex, side, value) {
  const match = getDEMatch(sideName, roundIndex, matchIndex);
  if (!match) return;
  const scroll = getTableauScrollSnapshot();
  const focus = getInputFocusSnapshot();
  match[side === "a" ? "aScore" : "bScore"] = value;
  const a = Number(match.aScore);
  const b = Number(match.bScore);
  const decisions = snapshotDEDecisions();
  const key = deDecisionKey(sideName, roundIndex, matchIndex);
  decisions[key] = {
    a: match.a,
    b: match.b,
    aScore: match.aScore,
    bScore: match.bScore,
    winner: match.winner,
  };
  if (match.a && match.b && match.aScore !== "" && match.bScore !== "" && a !== b) {
    decisions[key].winner = a > b ? match.a : match.b;
  }
  rebuildDoubleDEFromDecisions(decisions);
  render();
  restoreTableauScroll(scroll);
  restoreInputFocus(focus);
}

function addFencer(name, club, rating) {
  const cleanName = name.trim();
  if (!cleanName) return null;
  rememberName(cleanName);
  const existing = state.fencers.find((fencer) => fencer.name.toLowerCase() === cleanName.toLowerCase());
  if (existing) {
    existing.checkedIn = true;
    existing.club = club || existing.club;
    existing.rating = ratingOrder[rating] ? rating : existing.rating;
    return existing;
  }
  const fencer = {
    id: `F${Math.floor(1000 + Math.random() * 9000)}`,
    name: cleanName,
    club: club || "Unattached",
    rating: ratingOrder[rating] ? rating : "U",
    checkedIn: true,
  };
  state.fencers.push({
    ...fencer,
  });
  return fencer;
}

function deleteFencer(fencerId) {
  state.fencers = state.fencers.filter((fencer) => fencer.id !== fencerId);
  state.pools.forEach((pool) => {
    pool.fencerIds = pool.fencerIds.filter((id) => id !== fencerId);
  });
  resetPostPoolState();
  render();
}

function clearAllFencers() {
  state.fencers = [];
  state.pools = [];
  resetPostPoolState();
  render();
}

function fillDemoScores() {
  state.pools.forEach((pool) => {
    pairings(pool.fencerIds).forEach(([a, b], index) => {
      const aScore = index % 2 === 0 ? 5 : Math.max(0, 3 - (index % 3));
      const bScore = index % 2 === 0 ? Math.max(0, 2 + (index % 3)) : 5;
      state.scores[scoreKey(pool.id, a, b)] = { aId: a, bId: b, a: String(aScore), b: String(bScore) };
    });
  });
  state.seeds = [];
  state.bracket = [];
  state.doubleDE = null;
  state.secondPools = [];
  state.secondScores = {};
  render();
}


function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[char]);
}

document.addEventListener("click", (event) => {
  const stepButton = event.target.closest(".step");
  const nameOption = event.target.closest("[data-action='pick-name']");
  const action = event.target.dataset.action;
  if (stepButton) {
    currentView = stepButton.dataset.view;
    document.querySelectorAll(".step").forEach((step) => step.classList.toggle("active", step.dataset.view === currentView));
    document.querySelectorAll(".view").forEach((view) => view.classList.toggle("active", view.id === currentView));
    els.viewTitle.textContent = stepButton.querySelector("strong").textContent;
  }
  if (action === "toggle-checkin") {
    const fencer = fencerById(event.target.dataset.id);
    fencer.checkedIn = !fencer.checkedIn;
    render();
  }
  if (action === "delete-fencer") {
    deleteFencer(event.target.dataset.id);
  }
  if (nameOption) {
    els.newName.value = nameOption.dataset.name;
    els.nameSuggestions.innerHTML = "";
    els.nameSuggestions.classList.remove("active");
    els.newName.focus();
  }
  if (action === "delete-empty-pool") {
    deleteEmptyPool(event.target.dataset.poolId);
  }
  if (action === "advance" && event.target.dataset.winner) {
    advanceWinner(
      event.target.dataset.sideName,
      Number(event.target.dataset.round),
      Number(event.target.dataset.match),
      event.target.dataset.winner,
    );
  }
  if (event.target.matches(".mode-button")) {
    state.postseasonMode = event.target.dataset.mode;
    state.doubleDE = null;
    state.secondPools = [];
    state.secondScores = {};
    state.bracket = [];
    render();
  }
});

document.addEventListener("input", (event) => {
  const action = event.target.dataset.action;
  if (event.target === els.eventName) state.eventName = event.target.value;
  if (event.target === els.targetPoolSize) state.targetPoolSize = Number(event.target.value);
  if (event.target === els.fencerSearch) renderRoster();
  if (event.target === els.newName) renderNameSuggestions();
  if (action === "pool-score") {
    setScore(event.target.dataset.poolId, event.target.dataset.a, event.target.dataset.b, event.target.dataset.side, event.target.value);
  }
  if (action === "de-score") {
    setDEScore(
      event.target.dataset.sideName,
      Number(event.target.dataset.round),
      Number(event.target.dataset.match),
      event.target.dataset.side,
      event.target.value,
    );
  }
  if (action === "second-score") {
    setSecondScore(event.target.dataset.poolId, event.target.dataset.a, event.target.dataset.b, event.target.dataset.side, event.target.value);
  }
  saveState();
});

document.addEventListener("change", (event) => {
  if (event.target.dataset.action === "move-fencer") {
    moveFencer(event.target.dataset.id, event.target.value);
  }
});

document.addEventListener("dragstart", (event) => {
  const row = event.target.closest("[data-fencer-id]");
  if (!row) return;
  draggedFencerId = row.dataset.fencerId;
  event.dataTransfer.setData("text/plain", draggedFencerId);
});

document.addEventListener("dragover", (event) => {
  const pool = event.target.closest(".pool-card");
  if (!pool) return;
  event.preventDefault();
  pool.classList.add("drag-over");
});

document.addEventListener("dragleave", (event) => {
  event.target.closest(".pool-card")?.classList.remove("drag-over");
});

document.addEventListener("drop", (event) => {
  const pool = event.target.closest(".pool-card");
  if (!pool) return;
  event.preventDefault();
  pool.classList.remove("drag-over");
  moveFencer(event.dataTransfer.getData("text/plain") || draggedFencerId, pool.dataset.poolId);
});

document.querySelector("#addFencer").addEventListener("click", () => {
  const added = addFencer(
    document.querySelector("#newName").value,
    document.querySelector("#newClub").value,
    document.querySelector("#newRating").value,
  );
  if (added) {
    document.querySelector("#newName").value = "";
    document.querySelector("#newClub").value = "";
  }
  render();
});

document.querySelector("#snakeSeedPools").addEventListener("click", snakeSeedPools);
document.querySelector("#ratingClusterPools").addEventListener("click", ratingClusterPools);
document.querySelector("#addPool").addEventListener("click", addPool);
document.querySelector("#clearPools").addEventListener("click", () => {
  state.pools = [];
  state.scores = {};
  state.seeds = [];
  state.bracket = [];
  state.doubleDE = null;
  state.secondPools = [];
  state.secondScores = {};
  render();
});
document.querySelector("#fillDemoScores").addEventListener("click", fillDemoScores);
document.querySelector("#clearScores").addEventListener("click", () => {
  state.scores = {};
  state.seeds = [];
  state.bracket = [];
  state.doubleDE = null;
  state.secondPools = [];
  state.secondScores = {};
  render();
});
document.querySelector("#generateDE").addEventListener("click", generateDE);
document.querySelector("#clearDE").addEventListener("click", () => {
  state.seeds = [];
  state.bracket = [];
  state.doubleDE = null;
  state.secondPools = [];
  state.secondScores = {};
  render();
});
document.querySelector("#loadDemo").addEventListener("click", () => {
  state = demoState();
  render();
});
document.querySelector("#clearAllFencers").addEventListener("click", clearAllFencers);
document.querySelector("#clearAllFencersInline").addEventListener("click", clearAllFencers);

loadNameCache().then(render);
