(function () {
  "use strict";

  const CUTOFF_DATE = "2026-01-01";
  const CUTOFF_SECONDS = new Date(`${CUTOFF_DATE}T00:00:00Z`).getTime() / 1000;
  const STORAGE = {
    sources: "internship-atlas-sources-v1",
    logs: "internship-atlas-log-v1",
    settings: "internship-atlas-settings-v1",
    snapshotPrefix: "internship-atlas-snapshot-v1-"
  };
  const DEFAULT_SOURCE = {
    id: "simplify-summer-2026",
    name: "SimplifyJobs / Summer 2026 Internships",
    url: "https://raw.githubusercontent.com/SimplifyJobs/Summer2026-Internships/dev/.github/scripts/listings.json",
    repositoryUrl: "https://github.com/SimplifyJobs/Summer2026-Internships/blob/dev/.github/scripts/listings.json",
    metaUrl: "https://api.github.com/repos/SimplifyJobs/Summer2026-Internships/commits?path=.github%2Fscripts%2Flistings.json&sha=dev&per_page=1",
    permanent: true
  };
  const MATCH_GROUPS = [
    {
      label: "Software",
      cues: ["software", "developer", "frontend", "front end", "backend", "back end", "full stack", "javascript", "typescript", "react", "node", "java", "python", "cloud", "api"],
      categories: ["software", "software engineering"],
      roleCues: ["software", "developer", "frontend", "backend", "platform", "cloud", "web", "mobile"]
    },
    {
      label: "Data / AI / ML",
      cues: ["machine learning", "artificial intelligence", "data science", "data analyst", "analytics", "pytorch", "tensorflow", "nlp", "computer vision", "sql"],
      categories: ["ai/ml/data", "data science, ai & machine learning"],
      roleCues: ["data", "machine learning", "ml", "ai", "analytics", "research"]
    },
    {
      label: "Hardware",
      cues: ["hardware", "embedded", "firmware", "fpga", "verilog", "electrical", "semiconductor", "robotics"],
      categories: ["hardware", "hardware engineering"],
      roleCues: ["hardware", "embedded", "firmware", "electrical", "silicon", "robotics"]
    },
    {
      label: "Product",
      cues: ["product management", "product manager", "roadmap", "user research", "market research", "product strategy"],
      categories: ["product", "product management"],
      roleCues: ["product", "program manager", "strategy"]
    },
    {
      label: "Quant",
      cues: ["quantitative", "quant", "trading", "derivatives", "financial modeling", "statistics", "probability"],
      categories: ["quant", "quantitative finance"],
      roleCues: ["quant", "trading", "research", "risk"]
    }
  ];
  const SPECIFIC_CUES = [
    "python", "java", "javascript", "typescript", "react", "cloud", "security",
    "embedded", "firmware", "robotics", "machine learning", "data", "ai",
    "research", "product", "quant", "trading", "hardware", "software", "design"
  ];

  const elements = {
    refreshButton: byId("refreshButton"),
    toggleSourcesButton: byId("toggleSourcesButton"),
    closeSourcesButton: byId("closeSourcesButton"),
    sourcesPanel: byId("sourcesPanel"),
    sourceForm: byId("sourceForm"),
    sourceList: byId("sourceList"),
    syncState: byId("syncState"),
    lastChecked: byId("lastChecked"),
    upstreamUpdated: byId("upstreamUpdated"),
    autoRefresh: byId("autoRefresh"),
    statLoaded: byId("statLoaded"),
    statRelevant: byId("statRelevant"),
    statShowing: byId("statShowing"),
    statNew: byId("statNew"),
    searchInput: byId("searchInput"),
    categoryFilter: byId("categoryFilter"),
    sponsorshipFilter: byId("sponsorshipFilter"),
    locationFilter: byId("locationFilter"),
    degreeFilter: byId("degreeFilter"),
    minDateFilter: byId("minDateFilter"),
    maxDateFilter: byId("maxDateFilter"),
    sourceFilter: byId("sourceFilter"),
    sortFilter: byId("sortFilter"),
    activeOnlyFilter: byId("activeOnlyFilter"),
    visibleOnlyFilter: byId("visibleOnlyFilter"),
    matchedOnlyFilter: byId("matchedOnlyFilter"),
    termFilters: byId("termFilters"),
    resetFiltersButton: byId("resetFiltersButton"),
    resumeFile: byId("resumeFile"),
    resumeText: byId("resumeText"),
    analyzeResumeButton: byId("analyzeResumeButton"),
    clearResumeButton: byId("clearResumeButton"),
    resumeStatus: byId("resumeStatus"),
    resumeSkills: byId("resumeSkills"),
    resultHeading: byId("resultHeading"),
    pageSize: byId("pageSize"),
    listingsBody: byId("listingsBody"),
    paginationSummary: byId("paginationSummary"),
    previousPageButton: byId("previousPageButton"),
    nextPageButton: byId("nextPageButton"),
    clearLogButton: byId("clearLogButton"),
    changeLog: byId("changeLog")
  };

  const state = {
    jobs: [],
    filteredJobs: [],
    sources: loadSources(),
    logs: readStorage(STORAGE.logs, []),
    page: 1,
    fetching: false,
    lastAdded: 0,
    matchProfile: null,
    statuses: {},
    autoRefreshTimer: null
  };

  initialize();

  function initialize() {
    const settings = readStorage(STORAGE.settings, {});
    elements.autoRefresh.value = settings.autoRefresh || "0";
    bindEvents();
    renderSources();
    renderLog();
    configureAutoRefresh();
    fetchListings(false);
  }

  function bindEvents() {
    elements.refreshButton.addEventListener("click", function () { fetchListings(true); });
    elements.toggleSourcesButton.addEventListener("click", toggleSourcesPanel);
    elements.closeSourcesButton.addEventListener("click", toggleSourcesPanel);
    elements.sourceForm.addEventListener("submit", addSource);
    elements.sourceList.addEventListener("click", removeSource);
    elements.autoRefresh.addEventListener("change", function () {
      writeStorage(STORAGE.settings, { autoRefresh: elements.autoRefresh.value });
      configureAutoRefresh();
    });
    [
      elements.searchInput, elements.categoryFilter, elements.sponsorshipFilter,
      elements.locationFilter, elements.degreeFilter, elements.minDateFilter,
      elements.maxDateFilter, elements.sourceFilter, elements.sortFilter,
      elements.activeOnlyFilter, elements.visibleOnlyFilter, elements.matchedOnlyFilter
    ].forEach(function (control) {
      control.addEventListener("input", applyFilters);
      control.addEventListener("change", applyFilters);
    });
    elements.termFilters.addEventListener("change", applyFilters);
    elements.resetFiltersButton.addEventListener("click", resetFilters);
    elements.pageSize.addEventListener("change", function () {
      state.page = 1;
      renderTable();
    });
    elements.previousPageButton.addEventListener("click", function () {
      state.page = Math.max(1, state.page - 1);
      renderTable();
    });
    elements.nextPageButton.addEventListener("click", function () {
      state.page += 1;
      renderTable();
    });
    elements.analyzeResumeButton.addEventListener("click", analyzeResume);
    elements.clearResumeButton.addEventListener("click", clearResume);
    elements.resumeFile.addEventListener("change", handleResumeFile);
    elements.clearLogButton.addEventListener("click", clearLog);
  }

  async function fetchListings(manual) {
    if (state.fetching) {
      return;
    }
    state.fetching = true;
    state.lastAdded = 0;
    elements.refreshButton.disabled = true;
    elements.syncState.textContent = manual ? "Checking for updates..." : "Loading live postings...";
    const checkedAt = new Date();

    const results = await Promise.all(state.sources.map(function (source) {
      return fetchSource(source, checkedAt);
    }));
    const loaded = results.filter(function (result) { return result.ok; });
    state.jobs = loaded.flatMap(function (result) { return result.jobs; });
    state.statuses = Object.fromEntries(results.map(function (result) {
      return [result.source.id, result];
    }));
    state.lastAdded = loaded.reduce(function (sum, result) { return sum + result.added; }, 0);
    elements.lastChecked.textContent = formatTimestamp(checkedAt);
    const updates = loaded.map(function (result) { return result.upstreamDate; }).filter(Boolean).sort().reverse();
    elements.upstreamUpdated.textContent = updates.length ? formatTimestamp(new Date(updates[0])) : "Not available";
    elements.syncState.textContent = loaded.length
      ? `${loaded.length} of ${state.sources.length} feed${state.sources.length === 1 ? "" : "s"} loaded`
      : "Unable to load feeds";
    populateFilterOptions();
    renderSources();
    renderLog();
    applyFilters();
    state.fetching = false;
    elements.refreshButton.disabled = false;
  }

  async function fetchSource(source, checkedAt) {
    try {
      const response = await fetch(withCacheBuster(source.url), { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Request failed (${response.status})`);
      }
      const payload = await response.json();
      if (!Array.isArray(payload)) {
        throw new Error("Expected a JSON array of listings");
      }
      const jobs = payload.map(function (listing, index) {
        return normalizeJob(listing, source, index);
      }).filter(Boolean);
      let upstreamDate = null;
      if (source.metaUrl) {
        try {
          const metadataResponse = await fetch(withCacheBuster(source.metaUrl), { cache: "no-store" });
          const commits = await metadataResponse.json();
          upstreamDate = commits[0] && commits[0].commit && commits[0].commit.committer
            ? commits[0].commit.committer.date
            : null;
        } catch (error) {
          upstreamDate = null;
        }
      }
      const added = recordSnapshot(source, jobs, checkedAt, upstreamDate);
      return { ok: true, source: source, jobs: jobs, upstreamDate: upstreamDate, added: added };
    } catch (error) {
      addLog({
        at: checkedAt.toISOString(),
        source: source.name,
        type: "error",
        summary: "Refresh failed",
        detail: error.message
      });
      return { ok: false, source: source, jobs: [], error: error.message, added: 0 };
    }
  }

  function normalizeJob(listing, source, index) {
    if (!listing || typeof listing !== "object") {
      return null;
    }
    const rawId = listing.id || listing.url || `${listing.company_name || "job"}-${listing.title || index}`;
    return {
      key: `${source.id}:${rawId}`,
      sourceId: source.id,
      sourceName: source.name,
      id: String(rawId),
      company: stringValue(listing.company_name, "Unknown company"),
      title: stringValue(listing.title, "Untitled role"),
      category: stringValue(listing.category, "Other"),
      active: listing.active === true,
      visible: listing.is_visible !== false,
      terms: arrayValue(listing.terms, "Unspecified"),
      posted: numericValue(listing.date_posted),
      updated: numericValue(listing.date_updated),
      url: stringValue(listing.url, ""),
      locations: arrayValue(listing.locations, "Not specified"),
      sponsorship: stringValue(listing.sponsorship, "Not specified"),
      degrees: arrayValue(listing.degrees, "Not specified"),
      match: { score: 0, reason: "" }
    };
  }

  function recordSnapshot(source, jobs, checkedAt, upstreamDate) {
    const relevant = jobs.filter(function (job) { return job.posted >= CUTOFF_SECONDS; });
    const snapshotKey = STORAGE.snapshotPrefix + source.id;
    const previous = readStorage(snapshotKey, null);
    const current = {};
    relevant.forEach(function (job) {
      current[job.id] = [job.updated, job.active ? 1 : 0];
    });
    let added = [];
    let changed = 0;
    let removed = 0;
    if (previous) {
      added = relevant.filter(function (job) { return !previous[job.id]; });
      Object.keys(current).forEach(function (id) {
        if (previous[id] && String(previous[id]) !== String(current[id])) {
          changed += 1;
        }
      });
      removed = Object.keys(previous).filter(function (id) { return !current[id]; }).length;
      const names = added.slice(0, 3).map(function (job) { return `${job.company}: ${job.title}`; });
      const extra = added.length > 3 ? ` and ${added.length - 3} more` : "";
      const detail = [
        `${added.length} added`,
        `${changed} updated/status changed`,
        `${removed} removed`
      ].join(", ") + (names.length ? `. New: ${names.join("; ")}${extra}.` : ".");
      addLog({
        at: checkedAt.toISOString(),
        source: source.name,
        type: "refresh",
        summary: `Refresh complete: ${relevant.length.toLocaleString()} relevant postings`,
        detail: detail,
        upstreamDate: upstreamDate
      });
    } else {
      addLog({
        at: checkedAt.toISOString(),
        source: source.name,
        type: "baseline",
        summary: `First snapshot: ${relevant.length.toLocaleString()} relevant postings`,
        detail: `Tracking changes for postings dated ${CUTOFF_DATE} or later from this point forward.`,
        upstreamDate: upstreamDate
      });
    }
    writeStorage(snapshotKey, current);
    return added.length;
  }

  function populateFilterOptions() {
    updateSelect(elements.categoryFilter, uniqueValues("category"), "All categories");
    updateSelect(elements.sponsorshipFilter, uniqueValues("sponsorship"), "Any sponsorship status");
    updateSelect(elements.degreeFilter, uniqueArrayValues("degrees"), "Any degree");
    updateSelect(
      elements.sourceFilter,
      state.sources.map(function (source) { return { value: source.id, label: source.name }; }),
      "All feeds",
      true
    );
    const selectedTerms = selectedTermValues();
    const counts = {};
    state.jobs.forEach(function (job) {
      job.terms.forEach(function (term) { counts[term] = (counts[term] || 0) + 1; });
    });
    const terms = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; }).slice(0, 14);
    elements.termFilters.querySelectorAll(".chip").forEach(function (chip) { chip.remove(); });
    terms.forEach(function (term) {
      const label = document.createElement("label");
      label.className = "chip";
      label.innerHTML = `<input type="checkbox" value="${escapeHtml(term)}"${selectedTerms.includes(term) ? " checked" : ""}><span>${escapeHtml(term)} (${counts[term].toLocaleString()})</span>`;
      elements.termFilters.appendChild(label);
    });
  }

  function updateSelect(select, values, defaultText, suppliedObjects) {
    const selected = select.value;
    const options = suppliedObjects ? values : values.map(function (value) { return { value: value, label: value }; });
    select.innerHTML = `<option value="">${escapeHtml(defaultText)}</option>` + options.map(function (option) {
      return `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`;
    }).join("");
    if (options.some(function (option) { return option.value === selected; })) {
      select.value = selected;
    }
  }

  function applyFilters() {
    const query = elements.searchInput.value.trim().toLowerCase();
    const location = elements.locationFilter.value.trim().toLowerCase();
    const selectedTerms = selectedTermValues();
    const minPosted = inputDateToSeconds(elements.minDateFilter.value, false);
    const maxPosted = inputDateToSeconds(elements.maxDateFilter.value, true);
    state.filteredJobs = state.jobs.filter(function (job) {
      const text = `${job.company} ${job.title} ${job.category} ${job.terms.join(" ")}`.toLowerCase();
      return (!query || text.includes(query))
        && (!location || job.locations.join(" ").toLowerCase().includes(location))
        && (!elements.categoryFilter.value || job.category === elements.categoryFilter.value)
        && (!elements.sponsorshipFilter.value || job.sponsorship === elements.sponsorshipFilter.value)
        && (!elements.degreeFilter.value || job.degrees.includes(elements.degreeFilter.value))
        && (!elements.sourceFilter.value || job.sourceId === elements.sourceFilter.value)
        && (!selectedTerms.length || job.terms.some(function (term) { return selectedTerms.includes(term); }))
        && (!minPosted || job.posted >= minPosted)
        && (!maxPosted || job.posted <= maxPosted)
        && (!elements.activeOnlyFilter.checked || job.active)
        && (!elements.visibleOnlyFilter.checked || job.visible)
        && (!elements.matchedOnlyFilter.checked || job.match.score > 0);
    });
    sortJobs(state.filteredJobs);
    state.page = 1;
    renderStats();
    renderTable();
  }

  function sortJobs(jobs) {
    const mode = elements.sortFilter.value;
    jobs.sort(function (a, b) {
      if (mode === "posted-desc") {
        return b.posted - a.posted;
      }
      if (mode === "company-asc") {
        return a.company.localeCompare(b.company) || a.title.localeCompare(b.title);
      }
      if (mode === "match-desc") {
        return b.match.score - a.match.score || b.updated - a.updated;
      }
      return b.updated - a.updated || b.posted - a.posted;
    });
  }

  function renderStats() {
    const relevantActive = state.jobs.filter(function (job) {
      return job.posted >= CUTOFF_SECONDS && job.active;
    }).length;
    elements.statLoaded.textContent = state.jobs.length.toLocaleString();
    elements.statRelevant.textContent = relevantActive.toLocaleString();
    elements.statShowing.textContent = state.filteredJobs.length.toLocaleString();
    elements.statNew.textContent = state.lastAdded.toLocaleString();
    elements.resultHeading.textContent = `${state.filteredJobs.length.toLocaleString()} matching roles`;
  }

  function renderTable() {
    const pageSize = Number(elements.pageSize.value);
    const totalPages = Math.max(1, Math.ceil(state.filteredJobs.length / pageSize));
    state.page = Math.min(Math.max(state.page, 1), totalPages);
    const first = (state.page - 1) * pageSize;
    const visibleJobs = state.filteredJobs.slice(first, first + pageSize);
    if (!visibleJobs.length) {
      elements.listingsBody.innerHTML = '<tr><td class="empty-row" colspan="8">No listings match these filters. Try widening the date range or term selection.</td></tr>';
    } else {
      elements.listingsBody.innerHTML = visibleJobs.map(renderRow).join("");
    }
    const end = Math.min(first + pageSize, state.filteredJobs.length);
    elements.paginationSummary.textContent = state.filteredJobs.length
      ? `Showing ${first + 1}-${end} of ${state.filteredJobs.length.toLocaleString()}`
      : "Showing 0 listings";
    elements.previousPageButton.disabled = state.page === 1;
    elements.nextPageButton.disabled = state.page === totalPages || state.filteredJobs.length === 0;
  }

  function renderRow(job) {
    const match = state.matchProfile
      ? `<span class="match-score">${job.match.score ? `${job.match.score}%` : "--"}</span><span class="match-detail">${escapeHtml(job.match.reason || "No metadata match")}</span>`
      : '<span class="secondary">--</span>';
    const url = safeHttpUrl(job.url);
    const apply = url
      ? `<a class="apply-link" href="${escapeHtml(url)}" target="_blank" rel="noreferrer">Apply</a>`
      : '<span class="secondary">No link</span>';
    return `<tr>
      <td class="match-column">${match}</td>
      <td class="role"><strong>${escapeHtml(job.title)}</strong><span>${escapeHtml(job.company)} | ${escapeHtml(job.category)}</span></td>
      <td>${escapeHtml(job.terms.join(", "))}</td>
      <td class="location">${escapeHtml(job.locations.join(", "))}</td>
      <td class="date">${formatDate(job.posted)}</td>
      <td class="date">${formatDate(job.updated)}</td>
      <td><span class="badge${job.active ? "" : " closed"}">${job.active ? "Active" : "Inactive"}</span></td>
      <td>${apply}</td>
    </tr>`;
  }

  async function handleResumeFile(event) {
    const file = event.target.files[0];
    if (!file) {
      return;
    }
    elements.resumeStatus.textContent = `Reading ${file.name}...`;
    try {
      const text = await extractResumeText(file);
      elements.resumeText.value = text;
      elements.resumeStatus.textContent = `${file.name} loaded locally. Select Analyze fit to score listings.`;
    } catch (error) {
      elements.resumeStatus.textContent = `Could not read this resume: ${error.message}`;
    }
  }

  async function extractResumeText(file) {
    const extension = file.name.toLowerCase().split(".").pop();
    if (extension === "txt" || extension === "md") {
      return file.text();
    }
    if (extension === "pdf") {
      if (!window.pdfjsLib) {
        throw new Error("PDF reader library did not load");
      }
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      const pdf = await window.pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
      const pages = [];
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        pages.push(content.items.map(function (item) { return item.str; }).join(" "));
      }
      return pages.join("\n");
    }
    if (extension === "docx") {
      if (!window.mammoth) {
        throw new Error("DOCX reader library did not load");
      }
      const converted = await window.mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
      return converted.value;
    }
    throw new Error("Supported file types are PDF, DOCX, TXT, and MD");
  }

  function analyzeResume() {
    const resume = elements.resumeText.value.trim().toLowerCase();
    if (resume.length < 20) {
      elements.resumeStatus.textContent = "Paste or upload more resume text before analyzing.";
      return;
    }
    const groups = MATCH_GROUPS.filter(function (group) {
      return group.cues.some(function (cue) { return includesPhrase(resume, cue); });
    });
    const cues = SPECIFIC_CUES.filter(function (cue) { return includesPhrase(resume, cue); });
    state.matchProfile = { groups: groups, cues: cues };
    state.jobs.forEach(function (job) {
      job.match = scoreMatch(job, state.matchProfile);
    });
    elements.resumeSkills.innerHTML = groups.map(function (group) {
      return `<span>${escapeHtml(group.label)}</span>`;
    }).concat(cues.slice(0, 8).map(function (cue) {
      return `<span>${escapeHtml(titleCase(cue))}</span>`;
    })).join("");
    const detected = groups.length ? groups.map(function (group) { return group.label; }).join(", ") : "limited role-family signals";
    elements.resumeStatus.textContent = `Detected ${detected}. Scores indicate metadata overlap, so review each application requirements page.`;
    elements.matchedOnlyFilter.disabled = false;
    elements.sortFilter.value = "match-desc";
    applyFilters();
  }

  function scoreMatch(job, profile) {
    const roleText = `${job.title} ${job.category}`.toLowerCase();
    const matchedGroups = profile.groups.filter(function (group) {
      return group.categories.includes(job.category.toLowerCase())
        || group.roleCues.some(function (cue) { return includesPhrase(roleText, cue); });
    });
    const cueMatches = profile.cues.filter(function (cue) { return includesPhrase(roleText, cue); });
    let score = (matchedGroups.length ? 58 : 0) + Math.min(30, cueMatches.length * 12);
    if (matchedGroups.length && job.active) {
      score += 5;
    }
    score = Math.min(98, score);
    const reasons = matchedGroups.map(function (group) { return group.label; }).concat(cueMatches.slice(0, 2));
    return { score: score, reason: reasons.slice(0, 3).join(", ") };
  }

  function clearResume() {
    state.matchProfile = null;
    state.jobs.forEach(function (job) { job.match = { score: 0, reason: "" }; });
    elements.resumeText.value = "";
    elements.resumeFile.value = "";
    elements.resumeSkills.innerHTML = "";
    elements.resumeStatus.textContent = "No resume analyzed.";
    elements.matchedOnlyFilter.checked = false;
    elements.matchedOnlyFilter.disabled = true;
    if (elements.sortFilter.value === "match-desc") {
      elements.sortFilter.value = "updated-desc";
    }
    applyFilters();
  }

  function addSource(event) {
    event.preventDefault();
    const form = new FormData(event.target);
    const prepared = prepareSource(form.get("name"), form.get("url"));
    if (!safeHttpUrl(prepared.url)) {
      elements.syncState.textContent = "Feed URL must be a public http or https JSON URL";
      return;
    }
    if (state.sources.some(function (source) { return source.url === prepared.url; })) {
      elements.syncState.textContent = "That feed is already attached";
      return;
    }
    state.sources.push(prepared);
    storeSources();
    event.target.reset();
    renderSources();
    fetchListings(true);
  }

  function prepareSource(name, enteredUrl) {
    let url = String(enteredUrl).trim();
    let metaUrl = "";
    let repositoryUrl = url;
    const blob = url.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/);
    const raw = url.match(/^https:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)$/);
    const match = blob || raw;
    if (match) {
      const owner = match[1];
      const repo = match[2];
      const branch = match[3];
      const path = match[4];
      url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
      repositoryUrl = `https://github.com/${owner}/${repo}/blob/${branch}/${path}`;
      metaUrl = `https://api.github.com/repos/${owner}/${repo}/commits?path=${encodeURIComponent(path)}&sha=${encodeURIComponent(branch)}&per_page=1`;
    }
    return {
      id: `feed-${Date.now()}`,
      name: String(name).trim(),
      url: url,
      repositoryUrl: repositoryUrl,
      metaUrl: metaUrl,
      permanent: false
    };
  }

  function removeSource(event) {
    const button = event.target.closest("[data-remove-source]");
    if (!button) {
      return;
    }
    state.sources = state.sources.filter(function (source) { return source.id !== button.dataset.removeSource; });
    storeSources();
    renderSources();
    fetchListings(true);
  }

  function renderSources() {
    elements.sourceList.innerHTML = state.sources.map(function (source) {
      const status = state.statuses[source.id];
      const message = status
        ? (status.ok ? `${status.jobs.length.toLocaleString()} postings loaded` : `Error: ${status.error}`)
        : "Waiting to load";
      const action = source.permanent
        ? ""
        : `<button type="button" class="button subtle compact" data-remove-source="${escapeHtml(source.id)}">Remove</button>`;
      return `<div class="source-row">
        <div><strong>${escapeHtml(source.name)}</strong><small>${escapeHtml(message)} | ${escapeHtml(source.url)}</small></div>
        ${action}
      </div>`;
    }).join("");
  }

  function toggleSourcesPanel() {
    elements.sourcesPanel.classList.toggle("hidden");
  }

  function renderLog() {
    if (!state.logs.length) {
      elements.changeLog.innerHTML = '<p class="empty-copy">A first snapshot will be recorded after data loads.</p>';
      return;
    }
    elements.changeLog.innerHTML = state.logs.slice(0, 16).map(function (entry) {
      const upstream = entry.upstreamDate ? ` Source file updated ${formatTimestamp(new Date(entry.upstreamDate))}.` : "";
      return `<article class="log-entry">
        <time>${escapeHtml(formatTimestamp(new Date(entry.at)))}</time>
        <div><strong>${escapeHtml(entry.source)}: ${escapeHtml(entry.summary)}</strong><p>${escapeHtml(entry.detail + upstream)}</p></div>
      </article>`;
    }).join("");
  }

  function addLog(entry) {
    state.logs.unshift(entry);
    state.logs = state.logs.slice(0, 40);
    writeStorage(STORAGE.logs, state.logs);
  }

  function clearLog() {
    state.logs = [];
    writeStorage(STORAGE.logs, state.logs);
    renderLog();
  }

  function resetFilters() {
    elements.searchInput.value = "";
    elements.categoryFilter.value = "";
    elements.sponsorshipFilter.value = "";
    elements.locationFilter.value = "";
    elements.degreeFilter.value = "";
    elements.minDateFilter.value = CUTOFF_DATE;
    elements.maxDateFilter.value = "";
    elements.sourceFilter.value = "";
    elements.activeOnlyFilter.checked = true;
    elements.visibleOnlyFilter.checked = false;
    elements.matchedOnlyFilter.checked = false;
    elements.termFilters.querySelectorAll("input").forEach(function (input) { input.checked = false; });
    elements.sortFilter.value = state.matchProfile ? "match-desc" : "updated-desc";
    applyFilters();
  }

  function configureAutoRefresh() {
    clearInterval(state.autoRefreshTimer);
    const minutes = Number(elements.autoRefresh.value);
    if (minutes > 0) {
      state.autoRefreshTimer = setInterval(function () { fetchListings(false); }, minutes * 60 * 1000);
    }
  }

  function loadSources() {
    const saved = readStorage(STORAGE.sources, []);
    return [DEFAULT_SOURCE].concat(saved.filter(function (source) { return source.id !== DEFAULT_SOURCE.id; }));
  }

  function storeSources() {
    writeStorage(STORAGE.sources, state.sources.filter(function (source) { return !source.permanent; }));
  }

  function uniqueValues(property) {
    return Array.from(new Set(state.jobs.map(function (job) { return job[property]; }).filter(Boolean))).sort();
  }

  function uniqueArrayValues(property) {
    return Array.from(new Set(state.jobs.flatMap(function (job) { return job[property]; }).filter(Boolean))).sort();
  }

  function selectedTermValues() {
    return Array.from(elements.termFilters.querySelectorAll(".chip input:checked")).map(function (input) {
      return input.value;
    });
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function arrayValue(value, fallback) {
    if (Array.isArray(value) && value.length) {
      return value.map(String);
    }
    return [fallback];
  }

  function stringValue(value, fallback) {
    return value == null || value === "" ? fallback : String(value);
  }

  function numericValue(value) {
    return Number.isFinite(Number(value)) ? Number(value) : 0;
  }

  function formatDate(timestamp) {
    if (!timestamp) {
      return "--";
    }
    return new Date(timestamp * 1000).toLocaleDateString(undefined, {
      year: "numeric", month: "short", day: "numeric"
    });
  }

  function formatTimestamp(date) {
    return date.toLocaleString(undefined, {
      year: "numeric", month: "short", day: "numeric",
      hour: "numeric", minute: "2-digit"
    });
  }

  function inputDateToSeconds(value, endOfDay) {
    if (!value) {
      return 0;
    }
    return new Date(`${value}T${endOfDay ? "23:59:59" : "00:00:00"}Z`).getTime() / 1000;
  }

  function safeHttpUrl(value) {
    try {
      const parsed = new URL(value);
      return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : "";
    } catch (error) {
      return "";
    }
  }

  function withCacheBuster(url) {
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}atlas_refresh=${Date.now()}`;
  }

  function titleCase(value) {
    return value.replace(/\b\w/g, function (letter) { return letter.toUpperCase(); });
  }

  function includesPhrase(text, phrase) {
    return text.includes(phrase.toLowerCase());
  }

  function readStorage(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function writeStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      elements.syncState.textContent = "Storage is full; change history could not be saved";
    }
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (character) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character];
    });
  }
}());
