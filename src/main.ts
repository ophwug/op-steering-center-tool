import "./styles.css";
import { completeAuthCallback, isSignedIn, setAccessToken, signOut } from "./auth";
import {
  COMMA_JWT_PORTAL_URL,
  GITHUB_REPO_URL,
  OPENPILOT_MASTER_SOURCES,
} from "./constants";
import { formatLogMonoTime } from "./format";
import {
  scanRouteForSteeringCenterDiagnostic,
  type SteeringCenterDiagnosticResult,
  type SteeringSampleSummary,
  type SteeringWindowFilters,
} from "./scan";
import { buildRouteShareUrl, parseRouteInput, routeInputFromUrl } from "./routeInput";

const DEMO_ROUTES = [
  {
    label: "mici / Ford Bronco Sport",
    url: "https://connect.comma.ai/5beb9b58bd12b691/0000010a--a51155e496",
  },
  {
    label: "submitted steering issue",
    url: "https://connect.comma.ai/5204c516142a0bd2/00000017--6da71e4c31/340/367",
  },
  {
    label: "tizi / Toyota Corolla TSS2",
    url: "https://connect.comma.ai/fde53c3c109fb4c0/000002ae--7da67a8960",
  },
] as const;

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("Missing app element");

app.innerHTML = `
  <section class="tool-shell">
    <header class="masthead">
      <div>
        <p class="eyebrow">openpilot route utility</p>
        <h1>Steering centering diagnostic</h1>
      </div>
    </header>

    <form class="reader-form" id="reader-form">
      <label for="route-input">comma Connect URL or public route</label>
      <div class="input-row">
        <input id="route-input" name="route" autocomplete="off" spellcheck="false"
          placeholder="Paste Connect URL here, e.g. https://connect.comma.ai/<dongle>/<route>" />
        <button class="scan-button" type="submit">Scan route</button>
        <button class="secondary share-button" id="share-button" type="button" disabled>Share</button>
      </div>
      <p class="form-hint">Requires uploaded rlogs, ranks candidates with qlogs when available, then estimates median steeringAngleDeg from speed-aware straight-driving windows.</p>
      <div class="demo-row">
        <select id="demo-route-select" aria-label="Demo route">
          ${DEMO_ROUTES.map((route) => `<option value="${escapeHtml(route.url)}">${escapeHtml(route.label)}</option>`).join("")}
        </select>
        <button class="ghost-button" id="demo-button" type="button">Use demo route</button>
      </div>
    </form>

    <section class="status-panel" id="status-panel" aria-live="polite">
      <div class="progress-track"><div id="progress-bar"></div></div>
      <p id="status-text">Paste a public route to estimate logged steering wheel center.</p>
    </section>

    <section id="result-panel" class="result-panel" hidden></section>

    <section class="info-grid">
      <article>
        <h2>How to get an input route</h2>
        <ol>
          <li>Open <a href="https://connect.comma.ai/" target="_blank" rel="noreferrer">comma Connect</a> and select the drive.</li>
          <li>Open <strong>More info</strong> and turn on <strong>Public access</strong>.</li>
          <li>Copy either the browser URL or the route name. Clip start/end seconds after the route are ignored.</li>
          <li>You can turn Public access off again after reading the route.</li>
        </ol>
        <div class="jwt-option" id="auth-panel"></div>
      </article>
      <article>
        <h2>Debug paths</h2>
        <p>Use this as a route evidence report when a car appears to need steering wheel centering or steering sensor offset review. It scores straightness with carState, yaw, pose, location, controls, and planner curvature signals where the rlog provides them.</p>
      </article>
    </section>

    <footer>
      Route file discovery follows comma Connect's public <a href="${OPENPILOT_MASTER_SOURCES.commaApi}" target="_blank" rel="noreferrer">route files API</a>.
      Full-rate log fields come from <a href="${OPENPILOT_MASTER_SOURCES.logSchema}" target="_blank" rel="noreferrer">openpilot log.capnp</a>
      and <a href="${OPENPILOT_MASTER_SOURCES.carSchema}" target="_blank" rel="noreferrer">opendbc car.capnp</a>.
      Source: <a href="${GITHUB_REPO_URL}" target="_blank" rel="noreferrer">GitHub</a>.
    </footer>
  </section>
`;

const form = document.querySelector<HTMLFormElement>("#reader-form")!;
const input = document.querySelector<HTMLInputElement>("#route-input")!;
const scanButton = document.querySelector<HTMLButtonElement>(".scan-button")!;
const shareButton = document.querySelector<HTMLButtonElement>("#share-button")!;
const demoSelect = document.querySelector<HTMLSelectElement>("#demo-route-select")!;
const demoButton = document.querySelector<HTMLButtonElement>("#demo-button")!;
const statusText = document.querySelector<HTMLParagraphElement>("#status-text")!;
const progressBar = document.querySelector<HTMLDivElement>("#progress-bar")!;
const resultPanel = document.querySelector<HTMLElement>("#result-panel")!;
const authPanel = document.querySelector<HTMLElement>("#auth-panel")!;

renderAuthPanel();
void initializeFromUrl();

demoButton.addEventListener("click", () => {
  input.value = demoSelect.value;
  input.focus();
});

shareButton.addEventListener("click", () => {
  if (!routeInputFromUrl(window.location.href)) return;
  void copyText(window.location.href).then((copied) => showCopyFeedback(shareButton, copied));
});

authPanel.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  if (target.closest("#sign-out-button")) {
    signOut();
    renderAuthPanel();
    statusText.textContent = "Signed out. Public route scanning still works.";
    return;
  }

  if (target.closest("#save-token-button")) {
    const tokenInput = document.querySelector<HTMLInputElement>("#token-input");
    setAccessToken(tokenInput?.value ?? null);
    renderAuthPanel();
    statusText.textContent = isSignedIn() ? "Saved JWT in this browser." : "No JWT was saved.";
  }
});

resultPanel.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const button = target.closest<HTMLButtonElement>("[data-copy]");
  if (!button) return;

  const value = button.dataset.copy ?? "";
  void copyText(value).then((copied) => {
    showCopyFeedback(button, copied);
  });
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  await submitRoute(input.value, { updateHistory: true });
});

window.addEventListener("popstate", () => {
  const routeName = routeInputFromUrl(window.location.href);
  setShareButtonState();
  if (!routeName) {
    input.value = "";
    clearResult();
    progressBar.classList.remove("error");
    progressBar.style.width = "0";
    statusText.textContent = "Paste a public route to estimate logged steering wheel center.";
    return;
  }
  input.value = routeName;
  void submitRoute(routeName, { updateHistory: false });
});

async function submitRoute(routeInput: string, options: { updateHistory: boolean }): Promise<void> {
  clearResult();

  let routeName: string;
  try {
    routeName = parseRouteInput(routeInput).routeName;
  } catch (error) {
    if (options.updateHistory) {
      window.history.pushState({}, "", new URL(import.meta.env.BASE_URL, window.location.origin));
      setShareButtonState();
    }
    statusText.textContent = error instanceof Error ? error.message : String(error);
    progressBar.style.width = "100%";
    progressBar.classList.add("error");
    return;
  }

  input.value = routeName;
  if (options.updateHistory) {
    window.history.pushState({}, "", buildRouteShareUrl(window.location.origin, import.meta.env.BASE_URL, routeName));
    setShareButtonState();
  }

  setBusy(true);
  try {
    const result = await scanRouteForSteeringCenterDiagnostic(routeName, (progress) => {
      statusText.textContent = progress.message;
      if (progress.total && progress.current) {
        progressBar.style.width = `${Math.max(5, (progress.current / progress.total) * 100)}%`;
      } else {
        progressBar.style.width = progress.phase === "done" ? "100%" : "8%";
      }
    });
    renderResult(result);
  } catch (error) {
    statusText.textContent = error instanceof Error ? error.message : String(error);
    progressBar.style.width = "100%";
    progressBar.classList.add("error");
  } finally {
    setBusy(false);
  }
}

function setBusy(busy: boolean): void {
  scanButton.disabled = busy;
  demoSelect.disabled = busy;
  demoButton.disabled = busy;
  input.disabled = busy;
  progressBar.classList.toggle("error", false);
  if (busy) progressBar.style.width = "4%";
}

function setShareButtonState(): void {
  shareButton.disabled = !routeInputFromUrl(window.location.href);
}

function clearResult(): void {
  resultPanel.hidden = true;
  resultPanel.innerHTML = "";
}

function renderAuthPanel(): void {
  if (isSignedIn()) {
    authPanel.innerHTML = `<p class="jwt-saved">JWT saved. <button class="link-button" id="sign-out-button" type="button">Remove</button></p>`;
    return;
  }

  authPanel.innerHTML = `
    <details class="token-details">
      <summary>Private route? Use a JWT</summary>
      <ol class="jwt-steps">
        <li>Open <a href="${COMMA_JWT_PORTAL_URL}" target="_blank" rel="noreferrer">jwt.comma.ai</a>.</li>
        <li>Copy the JWT.</li>
        <li>Paste it here.</li>
      </ol>
      <div class="token-row">
        <input id="token-input" type="password" autocomplete="off" spellcheck="false" placeholder="Paste JWT here" />
        <button class="secondary" id="save-token-button" type="button">Use JWT</button>
      </div>
    </details>
  `;
}

async function completePendingAuth(): Promise<void> {
  const authParams = new URLSearchParams(window.location.search);
  if (!authParams.has("code") || !authParams.has("provider")) return;
  statusText.textContent = "Completing comma sign-in...";
  progressBar.style.width = "8%";
  const result = await completeAuthCallback();
  progressBar.style.width = "100%";
  renderAuthPanel();
  if (!result.handled) return;
  if (result.error) {
    progressBar.classList.add("error");
    statusText.textContent = result.error;
  } else {
    progressBar.classList.remove("error");
    statusText.textContent = "Signed in with comma. Paste a route and scan when ready.";
  }
}

async function initializeFromUrl(): Promise<void> {
  await completePendingAuth();
  const routeName = routeInputFromUrl(window.location.href);
  setShareButtonState();
  if (!routeName) return;
  input.value = routeName;
  await submitRoute(routeName, { updateHistory: false });
}

function renderResult(result: SteeringCenterDiagnosticResult): void {
  const hasEstimate = result.medianSteeringAngleDeg !== null;
  const estimateText = hasEstimate ? `${formatDeg(result.medianSteeringAngleDeg ?? 0)} steeringAngleDeg` : "No stable straight window found";
  const badgeClass = result.confidence === "high" || result.confidence === "medium" ? "ok" : "warn";
  const badgeText = result.confidence === "none" ? "no estimate" : `${result.confidence} confidence`;

  resultPanel.hidden = false;
  resultPanel.innerHTML = `
    <div class="result-header">
      <div>
        <p class="eyebrow">steering center estimate</p>
        <h2>${estimateText}</h2>
      </div>
      <span class="badge ${badgeClass}">${badgeText}</span>
    </div>
    <dl class="result-list">
      <div><dt>Route</dt><dd><code>${escapeHtml(result.routeName)}</code></dd></div>
      <div><dt>Vehicle</dt><dd>${renderVehicleSummary(result)}</dd></div>
      <div><dt>Segments</dt><dd>${result.scannedSegments} of ${result.totalSegments} ${logFileKind(result.logSource)} segment(s) decoded</dd></div>
      <div><dt>Device</dt><dd>${escapeHtml(result.routeInfo?.deviceType ?? result.initData?.deviceType ?? "unknown")}</dd></div>
      <div><dt>openpilot</dt><dd>${renderRouteVersion(result)}</dd></div>
      <div><dt>Classification</dt><dd>${renderClassification(result)}</dd></div>
      <div><dt>carState messages</dt><dd>${result.totalCarStateMessages.toLocaleString()} decoded; ${result.qualifyingSampleCount.toLocaleString()} passed point filters</dd></div>
      <div><dt>Context signals</dt><dd>${renderSignalAvailability(result)}</dd></div>
      <div><dt>Stable windows</dt><dd>${result.stableWindows.length} window(s), ${formatDuration(result.stableDurationSec)} total</dd></div>
      <div><dt>Spread</dt><dd>${result.medianAbsoluteDeviationDeg === null ? "n/a" : `${formatDeg(result.medianAbsoluteDeviationDeg)} median absolute deviation`}</dd></div>
      <div><dt>95% interval</dt><dd>${renderEstimateInterval(result)}</dd></div>
    </dl>
    ${result.readFailures.length > 0 ? renderReadFailures(result) : ""}
    ${renderVehicleMetadata(result)}
    ${renderCaveats(result)}
    ${renderSensitivity(result)}
    ${renderStableWindows(result)}
    ${renderCandidateSegments(result)}
    ${renderFilters(result.filters)}
  `;
}

function renderRouteVersion(result: SteeringCenterDiagnosticResult): string {
  const routeInfo = result.routeInfo;
  const init = result.initData;
  const version = routeInfo?.version || init?.version || "unknown";
  const branch = routeInfo?.git_branch || routeInfo?.gitBranch || init?.gitBranch || "";
  const commit = routeInfo?.git_commit || routeInfo?.gitCommit || init?.gitCommit || init?.gitSrcCommit || "";
  return [version, branch, commit ? commit.slice(0, 12) : ""].filter(Boolean).map(escapeHtml).join(" / ") || "unknown";
}

function renderVehicleSummary(result: SteeringCenterDiagnosticResult): string {
  const carParams = result.carParams;
  if (carParams?.carFingerprint) {
    return escapeHtml([carParams.brand, carParams.carFingerprint].filter(Boolean).join(" / "));
  }
  return escapeHtml(result.routeInfo?.platform ?? result.routeInfo?.deviceType ?? result.initData?.deviceType ?? "unknown");
}

function renderVehicleMetadata(result: SteeringCenterDiagnosticResult): string {
  const carParams = result.carParams;
  const [dongleId, routeId] = result.routeName.split("|");
  const routeInfo = result.routeInfo;
  const rows = [
    ["Car fingerprint", carParams?.carFingerprint || routeInfo?.platform || "unknown"],
    ["Brand", carParams?.brand || "unknown"],
    ["VIN", carParams?.carVin?.redacted ?? "not decoded"],
    ["Fingerprint source", carParams ? `${carParams.fingerprintSourceName} (${carParams.fingerprintSource})` : "not decoded"],
    ["Dongle", routeInfo?.dongle_id || routeInfo?.dongleId || dongleId || "unknown"],
    ["Route", routeInfo?.fullname || routeId || result.routeName],
    ["Device", routeInfo?.deviceType ?? result.initData?.deviceType ?? "unknown"],
    ["Platform", routeInfo?.platform ?? "unknown"],
    ["openpilot", renderRouteVersion(result)],
    ["Git remote", result.initData?.gitRemote || "unknown"],
    ["Longitudinal control", carParams ? formatYesNo(carParams.openpilotLongitudinalControl) : "unknown"],
    ["Dashcam / passive", carParams ? `${formatYesNo(carParams.dashcamOnly)} / ${formatYesNo(carParams.passive)}` : "unknown"],
    ["Firmware entries", carParams ? `${carParams.carFw.length.toLocaleString()} decoded` : "not decoded"],
    ["Log segments used", `${result.scannedSegments} of ${result.totalSegments} rlog segment(s); ${result.candidateSegments.length} qlog candidate(s)`],
  ];
  const firmwareRows = carParams?.carFw.slice(0, 8) ?? [];
  return `
    <section class="report-section">
      <h3>Vehicle metadata</h3>
      <dl class="result-list compact">
        ${rows.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}
      </dl>
      ${
        firmwareRows.length > 0
          ? `
            <div class="table-wrap">
              <table class="candidate-table">
                <thead>
                  <tr>
                    <th>ECU</th>
                    <th>Address</th>
                    <th>Sub</th>
                    <th>FW</th>
                    <th>Brand</th>
                  </tr>
                </thead>
                <tbody>
                  ${firmwareRows
                    .map(
                      (fw) => `
                        <tr>
                          <td>${escapeHtml(fw.ecuName)}</td>
                          <td>${escapeHtml(`0x${fw.address.toString(16)}`)}</td>
                          <td>${fw.subAddress === 0 ? "none" : escapeHtml(String(fw.subAddress))}</td>
                          <td>${escapeHtml(fw.fwVersionText || fw.fwVersionPython)}</td>
                          <td>${escapeHtml(fw.brand || "unknown")}</td>
                        </tr>
                      `,
                    )
                    .join("")}
                </tbody>
              </table>
            </div>
          `
          : `<p class="muted section-note">No firmware list was decoded from carParams in the scanned rlogs.</p>`
      }
    </section>
  `;
}

function renderClassification(result: SteeringCenterDiagnosticResult): string {
  const classification = result.classification;
  const spread = classification.windowMedianSpreadDeg === null ? "spread n/a" : `${formatDeg(classification.windowMedianSpreadDeg)} window spread`;
  return `${escapeHtml(classification.label)} (${formatPercent(classification.signConsistencyPct)} sign consistency, ${spread})`;
}

function renderEstimateInterval(result: SteeringCenterDiagnosticResult): string {
  const stats = result.estimateStats;
  if (stats.confidenceInterval95LowerDeg === null || stats.confidenceInterval95UpperDeg === null) return "n/a";
  const sampleMedian =
    stats.sampleMedianSteeringAngleDeg === null ? "" : `; sample median ${formatDeg(stats.sampleMedianSteeringAngleDeg)}`;
  return `${formatDeg(stats.confidenceInterval95LowerDeg)} to ${formatDeg(stats.confidenceInterval95UpperDeg)} window bootstrap${sampleMedian}`;
}

function renderCaveats(result: SteeringCenterDiagnosticResult): string {
  return `
    <section class="report-section">
      <h3>Caveats</h3>
      <ul class="caveat-list">
        <li>${escapeHtml(result.classification.explanation)}</li>
        ${result.caveats.map((caveat) => `<li>${escapeHtml(caveat)}</li>`).join("")}
      </ul>
    </section>
  `;
}

function renderSensitivity(result: SteeringCenterDiagnosticResult): string {
  const sections = [
    ["Speed sensitivity", result.sensitivity.speedBuckets],
    ["Curvature sensitivity", result.sensitivity.curvatureBuckets],
    ["Segment sensitivity", result.sensitivity.segmentBuckets],
  ] as const;
  const hasRows = sections.some(([, rows]) => rows.length > 0);
  return `
    <section class="report-section">
      <h3>Sensitivity</h3>
      ${
        hasRows
          ? sections
              .filter(([, rows]) => rows.length > 0)
              .map(
                ([title, rows]) => `
                  <h4>${title}</h4>
                  <div class="table-wrap">
                    <table class="candidate-table">
                      <thead>
                        <tr>
                          <th>Bucket</th>
                          <th>Windows</th>
                          <th>Duration</th>
                          <th>Median angle</th>
                          <th>P10 / P90</th>
                          <th>Median speed</th>
                          <th>Curvature</th>
                        </tr>
                      </thead>
                      <tbody>${rows.map(renderSensitivityRow).join("")}</tbody>
                    </table>
                  </div>
                `,
              )
              .join("")
          : `<p class="muted section-note">No sensitivity buckets were available.</p>`
      }
    </section>
  `;
}

function renderSensitivityRow(row: SteeringCenterDiagnosticResult["sensitivity"]["speedBuckets"][number]): string {
  return `
    <tr>
      <td>${escapeHtml(row.label)}</td>
      <td>${row.windowCount.toLocaleString()} / ${row.sampleCount.toLocaleString()} samples</td>
      <td>${formatDuration(row.durationSec)}</td>
      <td>${formatNullableDeg(row.medianSteeringAngleDeg)}</td>
      <td>${formatNullableDeg(row.p10SteeringAngleDeg)} / ${formatNullableDeg(row.p90SteeringAngleDeg)}</td>
      <td>${row.medianSpeedMps === null ? "n/a" : formatSpeed(row.medianSpeedMps)}</td>
      <td>${row.medianContextCurvature === null ? "n/a" : formatCurvature(row.medianContextCurvature)}</td>
    </tr>
  `;
}

function renderStableWindows(result: SteeringCenterDiagnosticResult): string {
  const rows = result.stableWindows.slice(0, 24);
  return `
    <section class="report-section">
      <h3>Supporting stable windows</h3>
      ${
        rows.length
          ? `
            <div class="table-wrap">
              <table class="steering-table">
                <thead>
                  <tr>
                    <th>Segments</th>
                    <th>Duration</th>
                    <th>Samples</th>
                    <th>Median angle</th>
                    <th>P10 / P90</th>
                    <th>MAD</th>
                    <th>Median speed</th>
                    <th>Straight score</th>
                    <th>Yaw / curvature</th>
                    <th>Max range</th>
                    <th>Sample log times</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows.map(renderWindowRow).join("")}
                </tbody>
              </table>
            </div>
          `
          : `<p class="muted section-note">No window met the stable straight-driving filters.</p>`
      }
    </section>
  `;
}

function renderWindowRow(window: SteeringCenterDiagnosticResult["stableWindows"][number]): string {
  return `
    <tr>
      <td>${window.segmentStart === window.segmentEnd ? window.segmentStart : `${window.segmentStart}-${window.segmentEnd}`}</td>
      <td>${formatDuration(window.durationSec)}</td>
      <td>${window.sampleCount.toLocaleString()}</td>
      <td>${formatDeg(window.medianSteeringAngleDeg)}</td>
      <td>${formatDeg(window.p10SteeringAngleDeg)} / ${formatDeg(window.p90SteeringAngleDeg)}</td>
      <td>${formatDeg(window.medianAbsoluteDeviationDeg)}</td>
      <td>${formatSpeed(window.medianSpeedMps)}</td>
      <td>${formatPercent(window.medianStraightnessScore)} / ${formatPercent(window.contextSignalCoveragePct)} context</td>
      <td>${formatYawCurvature(window.medianContextYawRateRadPerSec, window.medianContextCurvature)}</td>
      <td>${formatDeg(window.maxAngleRangeDeg)}</td>
      <td>${renderSupportingSamples(window.supportingSamples)}</td>
    </tr>
  `;
}

function renderSupportingSamples(samples: SteeringSampleSummary[]): string {
  return samples
    .map(
      (sample) =>
        `<span class="sample-chip" title="${escapeHtml(`${formatDeg(sample.steeringAngleDeg)}, ${formatSpeed(sample.vEgo)}, score ${formatPercent(sample.straightnessScore)}, rate ${formatDeg(sample.steeringRateDeg)}/s`)}">${formatLogMonoTime(sample.logMonoTime)}</span>`,
    )
    .join("");
}

function renderSignalAvailability(result: SteeringCenterDiagnosticResult): string {
  const availability = result.signalAvailability;
  const contextCoverage = result.totalCarStateMessages === 0 ? 0 : availability.samplesWithAnyContext / result.totalCarStateMessages;
  const contextMessages =
    availability.controlsStateMessages +
    availability.carControlMessages +
    availability.lateralPlanMessages +
    availability.liveLocationKalmanMessages +
    availability.livePoseMessages +
    availability.modelV2Messages;
  if (contextMessages === 0) return "carState only";
  return `${formatPercent(contextCoverage)} samples aligned; controls ${availability.controlsStateMessages.toLocaleString()}, carControl ${availability.carControlMessages.toLocaleString()}, planner ${availability.lateralPlanMessages.toLocaleString()}, model ${availability.modelV2Messages.toLocaleString()}, location ${availability.liveLocationKalmanMessages.toLocaleString()}, pose ${availability.livePoseMessages.toLocaleString()}`;
}

function renderCandidateSegments(result: SteeringCenterDiagnosticResult): string {
  const rows = result.candidateSegments.slice(0, 16);
  return `
    <section class="report-section">
      <h3>qlog candidate segments</h3>
      <p class="muted section-note">qlogs are used only to choose promising rlog segments; the estimate still comes from full-rate rlogs.</p>
      ${
        rows.length
          ? `
            <div class="table-wrap">
              <table class="candidate-table">
                <thead>
                  <tr>
                    <th>Segment</th>
                    <th>qlog samples</th>
                    <th>Point-filter pass</th>
                    <th>Median speed</th>
                    <th>P90 abs angle</th>
                    <th>P90 abs rate</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows
                    .map(
                      (row) => `
                        <tr>
                          <td>${row.segment}</td>
                          <td>${row.sampleCount.toLocaleString()}</td>
                          <td>${row.qualifyingSampleCount.toLocaleString()}</td>
                          <td>${row.medianSpeedMps === null ? "n/a" : formatSpeed(row.medianSpeedMps)}</td>
                          <td>${row.p90AbsSteeringAngleDeg === null ? "n/a" : formatDeg(row.p90AbsSteeringAngleDeg)}</td>
                          <td>${row.p90AbsSteeringRateDeg === null ? "n/a" : `${formatDeg(row.p90AbsSteeringRateDeg)}/s`}</td>
                        </tr>
                      `,
                    )
                    .join("")}
                </tbody>
              </table>
            </div>
          `
          : `<p class="muted section-note">No qlog candidate pass was available, so the scan checked rlogs in route order.</p>`
      }
    </section>
  `;
}

function renderFilters(filters: SteeringWindowFilters): string {
  const filterRows = [
    ["Max segments checked", String(filters.maxSegmentsToScan)],
    ["Min rlog segments before early stop", String(filters.minSegmentsBeforeEarlyStop)],
    ["Parallel rlog downloads", String(filters.parallelRlogDownloads)],
    ["Max qlog candidate segments checked", String(filters.maxQlogSegmentsToScan)],
    ["Top qlog candidates used", String(filters.candidateSegmentsToScan)],
    ["Min speed", formatSpeed(filters.minSpeedMps)],
    ["Max absolute steering angle", formatDeg(filters.maxAbsSteeringAngleDeg)],
    ["Max absolute steering rate", `${formatDeg(filters.maxAbsSteeringRateDeg)}/s`],
    [
      "Speed-aware yaw rate",
      `${formatRadPerSec(filters.maxAbsYawRateRadPerSecAtMinSpeed)} at ${formatSpeed(filters.minSpeedMps)} to ${formatRadPerSec(filters.maxAbsYawRateRadPerSecAtHighSpeed)} at ${formatSpeed(filters.highSpeedMps)}`,
    ],
    [
      "Speed-aware curvature",
      `${formatCurvature(filters.maxAbsCurvatureAtMinSpeed)} at ${formatSpeed(filters.minSpeedMps)} to ${formatCurvature(filters.maxAbsCurvatureAtHighSpeed)} at ${formatSpeed(filters.highSpeedMps)}`,
    ],
    ["Min straightness score", formatPercent(filters.minStraightnessScore)],
    ["Max sample gap", formatDuration(filters.maxSampleGapSec)],
    ["Window duration", `${formatDuration(filters.minWindowDurationSec)}-${formatDuration(filters.maxWindowDurationSec)}`],
    ["Min window samples", String(filters.minWindowSamples)],
    ["Max angle range within window", formatDeg(filters.maxWindowAngleRangeDeg)],
    [
      "High confidence target",
      `${filters.minHighConfidenceWindows} windows, ${formatDuration(filters.minHighConfidenceDurationSec)}, ${filters.minHighConfidenceSamples} samples`,
    ],
  ];
  return `
    <section class="report-section">
      <h3>Filters used</h3>
      <dl class="result-list compact">
        ${filterRows.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}
      </dl>
    </section>
  `;
}

function renderReadFailures(result: SteeringCenterDiagnosticResult): string {
  return `
    <section class="scan-warning">
      <h3>Unreadable ${logFileKind(result.logSource)} segment(s)</h3>
      <p class="muted">These segments could not be checked, so the estimate may be incomplete.</p>
      <ul>
        ${result.readFailures.map((failure) => `<li>Segment ${failure.segment}: ${escapeHtml(failure.message)}</li>`).join("")}
      </ul>
    </section>
  `;
}

function logFileKind(source: SteeringCenterDiagnosticResult["logSource"]): "qlog" | "rlog" {
  return source === "qlogs" ? "qlog" : "rlog";
}

function formatDeg(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}°`;
}

function formatNullableDeg(value: number | null): string {
  return value === null ? "n/a" : formatDeg(value);
}

function formatDuration(seconds: number): string {
  return `${seconds.toFixed(seconds < 10 ? 1 : 0)}s`;
}

function formatSpeed(mps: number): string {
  return `${mps.toFixed(1)} m/s (${(mps * 2.236936).toFixed(1)} mph)`;
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatYesNo(value: boolean): string {
  return value ? "yes" : "no";
}

function formatRadPerSec(value: number): string {
  return `${value.toFixed(3)} rad/s`;
}

function formatCurvature(value: number): string {
  return `${value.toFixed(4)} 1/m`;
}

function formatYawCurvature(yawRate: number | null, curvature: number | null): string {
  const yaw = yawRate === null ? "yaw n/a" : `yaw ${formatRadPerSec(yawRate)}`;
  const curve = curvature === null ? "curve n/a" : `curve ${formatCurvature(curvature)}`;
  return `${yaw}; ${curve}`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return entities[char];
  });
}

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

function showCopyFeedback(button: HTMLButtonElement, copied: boolean): void {
  const original = button.textContent ?? "Copy";
  button.textContent = copied ? "Copied" : "Copy failed";
  button.disabled = true;
  window.setTimeout(() => {
    button.textContent = original;
    button.disabled = false;
    if (button === shareButton) setShareButtonState();
  }, 1200);
}
