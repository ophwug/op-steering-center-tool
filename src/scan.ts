import {
  findCarStateMessages,
  findCalibrationMessages,
  findDeviceType,
  findFingerprintLogMessages,
  type CalibrationMessage,
  type CarParamsMessage,
  type CarStateMessage,
  type DeviceType,
  type FingerprintLogMessages,
  type InitDataMessage,
  type OnroadEventMessage,
} from "./capnp";
import {
  HARDCODED_FP_BRANCH_INDEX_URL,
  HARDCODED_FP_REPO_URL,
  OPENPILOT_FINGERPRINTING_URL,
  OPENPILOT_NIGHTLY_DEV_INSTALLER_URL,
  SUNNYLINK_URL,
  SUNNYPILOT_RELEASE_MICI_INSTALLER_URL,
  SUNNYPILOT_URL,
  SUNNYPILOT_VEHICLE_SETTINGS_URL,
} from "./constants";
import { decompressLog } from "./decompress";
import { isInvalidCalibration } from "./format";
import {
  fetchRouteFiles,
  fetchRouteInfo,
  logSourceLabel,
  orderedLogUrls,
  orderedQcameraUrls,
  orderedQlogUrls,
  orderedRlogUrls,
  parseRouteInput,
  segmentFromUrl,
  type RouteInfo,
} from "./routes";

export interface ScanProgress {
  phase: "metadata" | "download" | "decode" | "done";
  message: string;
  current?: number;
  total?: number;
}

export interface CalibrationScanResult {
  routeName: string;
  routeInfo: RouteInfo | null;
  logUrl: string | null;
  logSource: "qlogs" | "rlogs";
  segment: number | null;
  message: CalibrationMessage | null;
  previousValid: CalibrationScanMessage | null;
  qcameraPreview: QcameraPreviewSource | null;
  readFailures: LogReadFailure[];
  scannedSegments: number;
  totalSegments: number;
  scanMode: "quick" | "full";
  resultType: "invalid" | "valid" | "incomplete";
  reason: "status-invalid" | "outside-current-limits" | "no-invalid-found" | "first-valid" | "scan-incomplete";
}

export interface QcameraPreviewSource {
  logUrl: string;
  segment: number;
  reason: "early-route" | "invalid-segment" | "unreadable-segment";
}

export interface CalibrationScanMessage {
  logUrl: string;
  segment: number;
  message: CalibrationMessage;
}

export interface LogReadFailure {
  logUrl: string;
  segment: number;
  message: string;
}

export interface SensitiveField<T> {
  value: T;
  redacted: string;
}

export interface CarFirmwareSummary {
  ecu: number;
  ecuName: string;
  fwVersionPython: string;
  pythonSnippet: string;
  fwVersionText: string;
  address: number;
  subAddress: number;
  responseAddress: number;
  request: string[];
  brand: string;
  bus: number;
}

export interface CarParamsSummary {
  logUrl: string;
  segment: number;
  logMonoTime: bigint;
  brand: string;
  carFingerprint: string;
  fuzzyFingerprint: boolean;
  notCar: boolean;
  carVin: SensitiveField<string> | null;
  dashcamOnly: boolean;
  passive: boolean;
  openpilotLongitudinalControl: boolean;
  fingerprintSource: number;
  fingerprintSourceName: string;
  carFw: CarFirmwareSummary[];
}

export interface OnroadEventSummary {
  logUrl: string;
  segment: number;
  logMonoTime: bigint;
  name: number;
  nameText: string;
}

export interface CanEvidenceSummary {
  src: number;
  address: number;
  dataLength: number;
  count: number;
  firstSegment: number;
  lastSegment: number;
}

export interface Recommendation {
  kind: "stock-openpilot" | "sunnypilot" | "fork-context";
  title: string;
  body: string;
  links: Array<{ label: string; url: string }>;
}

export interface FingerprintScanResult {
  routeName: string;
  routeInfo: RouteInfo | null;
  initData: InitDataMessage | null;
  logSource: "qlogs" | "rlogs";
  carParams: CarParamsSummary | null;
  onroadEvents: OnroadEventSummary[];
  canEvidence: CanEvidenceSummary[];
  recommendations: Recommendation[];
  readFailures: LogReadFailure[];
  scannedSegments: number;
  totalSegments: number;
  resultType: "recognized" | "unrecognized" | "incomplete";
}

interface RouteLogContext {
  routeName: string;
  routeInfo: RouteInfo | null;
  logUrls: string[];
  qlogUrls: string[];
  qcameraUrls: string[];
  source: "qlogs" | "rlogs";
}

interface LogSegmentScan {
  calibrationMessages: CalibrationMessage[];
  deviceType: DeviceType | null;
}

interface FingerprintSegmentScan {
  messages: FingerprintLogMessages;
}

interface SteeringSegmentScan {
  initData: InitDataMessage | null;
  deviceType: DeviceType | null;
  carStates: CarStateMessage[];
}

interface SteeringSegmentWork {
  logUrl: string;
  segment: number;
  index: number;
}

type SteeringSegmentWorkResult =
  | { ok: true; work: SteeringSegmentWork; scan: SteeringSegmentScan }
  | { ok: false; work: SteeringSegmentWork; error: unknown };

export type SteeringConfidence = "high" | "medium" | "low" | "none";

export interface SteeringWindowFilters {
  maxSegmentsToScan: number;
  minSegmentsBeforeEarlyStop: number;
  parallelRlogDownloads: number;
  maxQlogSegmentsToScan: number;
  candidateSegmentsToScan: number;
  minSpeedMps: number;
  maxAbsSteeringAngleDeg: number;
  maxAbsSteeringRateDeg: number;
  maxSampleGapSec: number;
  minWindowDurationSec: number;
  maxWindowDurationSec: number;
  minWindowSamples: number;
  maxWindowAngleRangeDeg: number;
  minHighConfidenceWindows: number;
  minHighConfidenceDurationSec: number;
  minHighConfidenceSamples: number;
  minMediumConfidenceWindows: number;
  minMediumConfidenceDurationSec: number;
  minMediumConfidenceSamples: number;
}

export interface SteeringSampleSummary {
  logUrl: string;
  segment: number;
  logMonoTime: bigint;
  steeringAngleDeg: number;
  steeringRateDeg: number;
  steeringTorque: number;
  vEgo: number;
  yawRate: number;
}

export interface SteeringWindowSummary {
  segmentStart: number;
  segmentEnd: number;
  startLogMonoTime: bigint;
  endLogMonoTime: bigint;
  durationSec: number;
  sampleCount: number;
  medianSteeringAngleDeg: number;
  p10SteeringAngleDeg: number;
  p90SteeringAngleDeg: number;
  medianAbsoluteDeviationDeg: number;
  medianSpeedMps: number;
  maxAngleRangeDeg: number;
  supportingSamples: SteeringSampleSummary[];
}

export interface SteeringCandidateSegmentSummary {
  segment: number;
  sampleCount: number;
  qualifyingSampleCount: number;
  medianSpeedMps: number | null;
  p90AbsSteeringRateDeg: number | null;
  p90AbsSteeringAngleDeg: number | null;
}

export interface SteeringCenterDiagnosticResult {
  routeName: string;
  routeInfo: RouteInfo | null;
  initData: InitDataMessage | null;
  logSource: "qlogs" | "rlogs";
  readFailures: LogReadFailure[];
  scannedSegments: number;
  totalSegments: number;
  totalCarStateMessages: number;
  qualifyingSampleCount: number;
  stableDurationSec: number;
  confidence: SteeringConfidence;
  resultType: "estimated" | "no-stable-window" | "incomplete";
  medianSteeringAngleDeg: number | null;
  medianAbsoluteDeviationDeg: number | null;
  filters: SteeringWindowFilters;
  candidateSegments: SteeringCandidateSegmentSummary[];
  stableWindows: SteeringWindowSummary[];
  caveats: string[];
}

interface SteeringSample extends SteeringSampleSummary {
  steeringPressed: boolean;
  standstill: boolean;
  leftBlinker: boolean;
  rightBlinker: boolean;
}

const DEFAULT_STEERING_FILTERS: SteeringWindowFilters = {
  maxSegmentsToScan: 20,
  minSegmentsBeforeEarlyStop: 8,
  parallelRlogDownloads: 4,
  maxQlogSegmentsToScan: 120,
  candidateSegmentsToScan: 16,
  minSpeedMps: 8,
  maxAbsSteeringAngleDeg: 15,
  maxAbsSteeringRateDeg: 2,
  maxSampleGapSec: 1,
  minWindowDurationSec: 6,
  maxWindowDurationSec: 20,
  minWindowSamples: 20,
  maxWindowAngleRangeDeg: 3,
  minHighConfidenceWindows: 3,
  minHighConfidenceDurationSec: 30,
  minHighConfidenceSamples: 100,
  minMediumConfidenceWindows: 2,
  minMediumConfidenceDurationSec: 15,
  minMediumConfidenceSamples: 50,
};

export async function scanRouteForFirstValidCalibration(
  input: string,
  onProgress: (progress: ScanProgress) => void,
): Promise<CalibrationScanResult> {
  const context = await loadRouteLogContext(input, onProgress);

  for (let index = 0; index < context.logUrls.length; index += 1) {
    const logUrl = context.logUrls[index];
    const segment = segmentFromUrl(logUrl);
    const { calibrationMessages, deviceType } = await downloadLogSegmentScan(logUrl, segment, index, context.logUrls.length, context.source, onProgress);
    context.routeInfo = routeInfoWithDeviceType(context.routeInfo, context.routeName, deviceType);
    const message = calibrationMessages.find((calibration) => calibration.status === 1 && calibration.rpyCalib.length === 3);
    if (message) {
      onProgress({ phase: "done", message: `Found valid calibration in segment ${segment}` });
      return {
        routeName: context.routeName,
        routeInfo: context.routeInfo,
        logUrl,
        logSource: context.source,
        segment,
        message,
        previousValid: null,
        qcameraPreview: previewForSegment(context.qcameraUrls, 1, "early-route"),
        readFailures: [],
        scannedSegments: index + 1,
        totalSegments: context.logUrls.length,
        scanMode: "quick",
        resultType: "valid",
        reason: "first-valid",
      };
    }
  }

  throw new Error(`Scanned ${context.logUrls.length} uploaded ${logFileKind(context.source)} segment(s), but found no valid liveCalibration messages.`);
}

export async function scanRouteForInvalidCalibration(
  input: string,
  onProgress: (progress: ScanProgress) => void,
): Promise<CalibrationScanResult> {
  const context = await loadRouteLogContext(input, onProgress);
  let firstValid: CalibrationScanMessage | null = null;
  let lastValid: CalibrationScanMessage | null = null;
  let decodedSegments = 0;
  const readFailures: LogReadFailure[] = [];

  for (let index = 0; index < context.logUrls.length; index += 1) {
    const logUrl = context.logUrls[index];
    const segment = segmentFromUrl(logUrl);
    let calibrationMessages: CalibrationMessage[];
    try {
      const segmentScan = await downloadLogSegmentScan(logUrl, segment, index, context.logUrls.length, context.source, onProgress);
      calibrationMessages = segmentScan.calibrationMessages;
      context.routeInfo = routeInfoWithDeviceType(context.routeInfo, context.routeName, segmentScan.deviceType);
      decodedSegments += 1;
    } catch (error) {
      const failure = { logUrl, segment, message: readableLogError(error) };
      readFailures.push(failure);
      onProgress({
        phase: "decode",
        message: `Could not read ${logFileKind(context.source)} segment ${segment}: ${failure.message}`,
        current: index + 1,
        total: context.logUrls.length,
      });
      continue;
    }
    const message = calibrationMessages.find((calibration) => isInvalidCalibration(calibration, context.routeInfo));
    if (message) {
      const reason = message.status === 2 ? "status-invalid" : "outside-current-limits";
      const sameSegmentPreviousValid = calibrationMessages
        .filter((calibration) => calibration.status === 1 && calibration.logMonoTime < message.logMonoTime)
        .at(-1);
      onProgress({ phase: "done", message: `Found invalid calibration in segment ${segment}` });
      return {
        routeName: context.routeName,
        routeInfo: context.routeInfo,
        logUrl,
        logSource: context.source,
        segment,
        message,
        previousValid: sameSegmentPreviousValid ? { logUrl, segment, message: sameSegmentPreviousValid } : lastValid,
        qcameraPreview: previewForSegment(context.qcameraUrls, segment, "invalid-segment"),
        readFailures,
        scannedSegments: index + 1,
        totalSegments: context.logUrls.length,
        scanMode: "full",
        resultType: "invalid",
        reason,
      };
    }
    const validMessages = calibrationMessages.filter((calibration) => calibration.status === 1);
    if (validMessages.length > 0) {
      const validScans = validMessages.map((validMessage) => ({ logUrl, segment, message: validMessage }));
      firstValid ??= validScans[0];
      lastValid = validScans.at(-1) ?? lastValid;
    }
  }

  if (firstValid) {
    if (readFailures.length > 0) {
      onProgress({
        phase: "done",
        message: `No invalid calibration found in ${decodedSegments} decoded ${logFileKind(context.source)} segment(s), but ${readFailures.length} segment(s) could not be read.`,
      });
    } else {
      onProgress({ phase: "done", message: `No invalid calibration found in ${context.logUrls.length} ${logFileKind(context.source)} segment(s).` });
    }
    return {
      routeName: context.routeName,
      routeInfo: context.routeInfo,
      logUrl: firstValid.logUrl,
      logSource: context.source,
      segment: firstValid.segment,
      message: firstValid.message,
      previousValid: null,
      qcameraPreview:
        readFailures.length > 0
          ? previewForSegment(context.qcameraUrls, readFailures[0].segment, "unreadable-segment")
          : previewForSegment(context.qcameraUrls, 1, "early-route"),
      readFailures,
      scannedSegments: decodedSegments,
      totalSegments: context.logUrls.length,
      scanMode: "full",
      resultType: readFailures.length > 0 ? "incomplete" : "valid",
      reason: readFailures.length > 0 ? "scan-incomplete" : "no-invalid-found",
    };
  }

  if (readFailures.length > 0) {
    throw new Error(
      `Decoded ${decodedSegments} uploaded ${logFileKind(context.source)} segment(s) and skipped ${readFailures.length} unreadable segment(s), but found no invalid or valid liveCalibration messages.`,
    );
  }
  throw new Error(`Scanned ${decodedSegments} uploaded ${logFileKind(context.source)} segment(s), but found no invalid or valid liveCalibration messages.`);
}

export async function scanRouteForFingerprintDebug(
  input: string,
  onProgress: (progress: ScanProgress) => void,
): Promise<FingerprintScanResult> {
  const context = await loadRouteLogContext(input, onProgress);
  const readFailures: LogReadFailure[] = [];
  const carParams: CarParamsSummary[] = [];
  const onroadEvents: OnroadEventSummary[] = [];
  const canEvidence = new Map<string, CanEvidenceSummary>();
  let initData: InitDataMessage | null = null;
  let decodedSegments = 0;
  const sampledLogUrls = context.logUrls.slice(0, 1);

  for (let index = 0; index < sampledLogUrls.length; index += 1) {
    const logUrl = sampledLogUrls[index];
    const segment = segmentFromUrl(logUrl);
    try {
      const segmentScan = await downloadFingerprintSegmentScan(logUrl, segment, index, sampledLogUrls.length, context.source, onProgress);
      decodedSegments += 1;
      initData ??= segmentScan.messages.initData;
      context.routeInfo = routeInfoWithDeviceType(context.routeInfo, context.routeName, segmentScan.messages.deviceType);
      carParams.push(...segmentScan.messages.carParams.map((message) => summarizeCarParams(message, logUrl, segment)));
      onroadEvents.push(...segmentScan.messages.onroadEvents.map((message) => summarizeOnroadEvent(message, logUrl, segment)));
      mergeCanEvidence(canEvidence, segmentScan.messages, segment);
    } catch (error) {
      const failure = { logUrl, segment, message: readableLogError(error) };
      readFailures.push(failure);
      onProgress({
        phase: "decode",
        message: `Could not read ${logFileKind(context.source)} segment ${segment}: ${failure.message}`,
        current: index + 1,
        total: context.logUrls.length,
      });
    }
  }

  const selectedCarParams = carParams.at(-1) ?? null;
  const recognized = Boolean(selectedCarParams?.carFingerprint);
  const resultType = readFailures.length > 0 ? "incomplete" : recognized ? "recognized" : "unrecognized";
  onProgress({
    phase: "done",
    message: recognized
      ? `Found ${selectedCarParams?.carFingerprint} after scanning ${decodedSegments} ${logFileKind(context.source)} segment(s).`
      : `Built fingerprint evidence from ${decodedSegments} sampled ${logFileKind(context.source)} segment(s).`,
  });

  return {
    routeName: context.routeName,
    routeInfo: context.routeInfo,
    initData,
    logSource: context.source,
    carParams: selectedCarParams,
    onroadEvents: dedupeEvents(onroadEvents),
    canEvidence: [...canEvidence.values()].sort((a, b) => a.src - b.src || a.address - b.address || a.dataLength - b.dataLength),
    recommendations: buildRecommendations(selectedCarParams, onroadEvents, initData, readFailures),
    readFailures,
    scannedSegments: decodedSegments,
    totalSegments: context.logUrls.length,
    resultType,
  };
}

export async function scanRouteForSteeringCenterDiagnostic(
  input: string,
  onProgress: (progress: ScanProgress) => void,
): Promise<SteeringCenterDiagnosticResult> {
  const context = await loadRouteLogContext(input, onProgress, "rlogs-only");
  const filters = DEFAULT_STEERING_FILTERS;
  const readFailures: LogReadFailure[] = [];
  const samples: SteeringSample[] = [];
  let initData: InitDataMessage | null = null;
  let decodedSegments = 0;
  let totalCarStateMessages = 0;
  const candidateSegments = await scanQlogSteeringCandidates(context, filters, onProgress);
  const scannedLogUrls = selectSteeringRlogUrls(context.logUrls, candidateSegments, filters);
  const rlogWork = scannedLogUrls.map((logUrl, index) => ({
    logUrl,
    index,
    segment: segmentFromUrl(logUrl),
  }));

  for (let start = 0; start < rlogWork.length; start += filters.parallelRlogDownloads) {
    const batch = rlogWork.slice(start, start + filters.parallelRlogDownloads);
    const batchResults = await Promise.all(
      batch.map(async (work): Promise<SteeringSegmentWorkResult> => {
        try {
          const scan = await downloadSteeringSegmentScan(work.logUrl, work.segment, work.index, rlogWork.length, context.source, onProgress);
          return { ok: true, work, scan };
        } catch (error) {
          return { ok: false, work, error };
        }
      }),
    );

    for (const result of batchResults.sort((a, b) => a.work.index - b.work.index)) {
      if (!result.ok) {
        const failure = { logUrl: result.work.logUrl, segment: result.work.segment, message: readableLogError(result.error) };
        readFailures.push(failure);
        onProgress({
          phase: "decode",
          message: `Could not read ${logFileKind(context.source)} segment ${result.work.segment}: ${failure.message}`,
          current: result.work.index + 1,
          total: rlogWork.length,
        });
        continue;
      }

      const segmentScan = result.scan;
      decodedSegments += 1;
      totalCarStateMessages += segmentScan.carStates.length;
      initData ??= segmentScan.initData;
      context.routeInfo = routeInfoWithDeviceType(context.routeInfo, context.routeName, segmentScan.deviceType);
      samples.push(...segmentScan.carStates.map((message) => summarizeSteeringSample(message, result.work.logUrl, result.work.segment)));
    }

    const interimWindows = findStableSteeringWindows(samples, filters);
    const interimStableSamples = samplesInsideWindows(samples, interimWindows);
    const interimDuration = sumWindowDuration(interimWindows);
    if (
      decodedSegments >= filters.minSegmentsBeforeEarlyStop &&
      interimWindows.length >= filters.minHighConfidenceWindows &&
      interimStableSamples.length >= filters.minHighConfidenceSamples &&
      interimDuration >= filters.minHighConfidenceDurationSec
    ) {
      onProgress({
        phase: "done",
        message: `Found ${interimWindows.length} stable straight-driving windows after ${decodedSegments} ${logFileKind(context.source)} segment(s).`,
      });
      return buildSteeringCenterResult(context, initData, readFailures, decodedSegments, totalCarStateMessages, samples, filters, candidateSegments);
    }
  }

  const result = buildSteeringCenterResult(context, initData, readFailures, decodedSegments, totalCarStateMessages, samples, filters, candidateSegments);
  onProgress({
    phase: "done",
    message:
      result.confidence === "none"
        ? `Scanned ${decodedSegments} ${logFileKind(context.source)} segment(s), but found no stable straight-driving window.`
        : `Estimated steering center from ${result.stableWindows.length} stable window(s) across ${decodedSegments} ${logFileKind(context.source)} segment(s).`,
  });
  return result;
}

async function loadRouteLogContext(
  input: string,
  onProgress: (progress: ScanProgress) => void,
  mode: "default" | "rlogs-only" = "default",
): Promise<RouteLogContext> {
  const parsed = parseRouteInput(input);
  onProgress({ phase: "metadata", message: `Reading file list for ${parsed.routeName}` });

  const [routeInfo, files] = await Promise.all([fetchRouteInfo(parsed.routeName), fetchRouteFiles(parsed.routeName)]);
  const logUrls = mode === "rlogs-only" ? orderedRlogUrls(files) : orderedLogUrls(files);
  const qlogUrls = orderedQlogUrls(files);
  const qcameraUrls = orderedQcameraUrls(files);
  if (logUrls.length === 0) {
    if (mode === "rlogs-only" && (files.qlogs ?? []).length > 0) {
      throw new Error("This diagnostic requires uploaded rlogs. qlogs are too sparse for steering center estimation.");
    }
    throw new Error("No qlogs or rlogs are uploaded for this route.");
  }
  const source = mode === "rlogs-only" ? "rlogs" : logSourceLabel(files);
  if (source === "none") {
    throw new Error("No qlogs or rlogs are uploaded for this route.");
  }
  if (source === "rlogs" && mode === "default") {
    onProgress({ phase: "metadata", message: "No qlogs found; falling back to rlogs." });
  }

  return { routeName: parsed.routeName, routeInfo, logUrls, qlogUrls, qcameraUrls, source };
}

async function downloadLogSegmentScan(
  logUrl: string,
  segment: number,
  index: number,
  total: number,
  source: "qlogs" | "rlogs",
  onProgress: (progress: ScanProgress) => void,
): Promise<LogSegmentScan> {
  onProgress({
    phase: "download",
    message: `Downloading ${logFileKind(source)} segment ${segment} (${index + 1}/${total})`,
    current: index + 1,
    total,
  });

  const compressed = new Uint8Array(await (await fetchLog(logUrl)).arrayBuffer());
  onProgress({
    phase: "decode",
    message: `Decoding segment ${segment}`,
    current: index + 1,
    total,
  });

  const decompressed = decompressLog(compressed, logUrl);
  return {
    calibrationMessages: findCalibrationMessages(decompressed, (calibration) => calibration.rpyCalib.length === 3),
    deviceType: findDeviceType(decompressed),
  };
}

async function downloadFingerprintSegmentScan(
  logUrl: string,
  segment: number,
  index: number,
  total: number,
  source: "qlogs" | "rlogs",
  onProgress: (progress: ScanProgress) => void,
): Promise<FingerprintSegmentScan> {
  onProgress({
    phase: "download",
    message: `Downloading ${logFileKind(source)} segment ${segment} (${index + 1}/${total})`,
    current: index + 1,
    total,
  });

  const compressed = new Uint8Array(await (await fetchLog(logUrl)).arrayBuffer());
  onProgress({
    phase: "decode",
    message: `Decoding fingerprint evidence in segment ${segment}`,
    current: index + 1,
    total,
  });

  const decompressed = decompressLog(compressed, logUrl);
  return { messages: findFingerprintLogMessages(decompressed) };
}

async function downloadSteeringSegmentScan(
  logUrl: string,
  segment: number,
  index: number,
  total: number,
  source: "qlogs" | "rlogs",
  onProgress: (progress: ScanProgress) => void,
): Promise<SteeringSegmentScan> {
  onProgress({
    phase: "download",
    message: `Downloading ${logFileKind(source)} segment ${segment} (${index + 1}/${total})`,
    current: index + 1,
    total,
  });

  const compressed = new Uint8Array(await (await fetchLog(logUrl)).arrayBuffer());
  onProgress({
    phase: "decode",
    message: `Decoding steering data in segment ${segment}`,
    current: index + 1,
    total,
  });

  const decompressed = decompressLog(compressed, logUrl);
  const fingerprintMessages = findFingerprintLogMessages(decompressed);
  return {
    initData: fingerprintMessages.initData,
    deviceType: fingerprintMessages.deviceType ?? findDeviceType(decompressed),
    carStates: findCarStateMessages(decompressed),
  };
}

async function scanQlogSteeringCandidates(
  context: RouteLogContext,
  filters: SteeringWindowFilters,
  onProgress: (progress: ScanProgress) => void,
): Promise<SteeringCandidateSegmentSummary[]> {
  const candidateQlogs = context.qlogUrls.slice(0, filters.maxQlogSegmentsToScan);
  if (candidateQlogs.length === 0) return [];

  const summaries: SteeringCandidateSegmentSummary[] = [];
  for (let index = 0; index < candidateQlogs.length; index += 1) {
    const logUrl = candidateQlogs[index];
    const segment = segmentFromUrl(logUrl);
    try {
      const segmentScan = await downloadSteeringSegmentScan(logUrl, segment, index, candidateQlogs.length, "qlogs", onProgress);
      const samples = segmentScan.carStates.map((message) => summarizeSteeringSample(message, logUrl, segment));
      const summary = summarizeCandidateSegment(segment, samples, filters);
      if (summary.sampleCount > 0) summaries.push(summary);
      context.routeInfo = routeInfoWithDeviceType(context.routeInfo, context.routeName, segmentScan.deviceType);
    } catch {
      // qlogs only guide rlog selection; unreadable qlog candidates should not block the diagnostic.
    }
  }

  return summaries
    .sort(
      (a, b) =>
        b.qualifyingSampleCount - a.qualifyingSampleCount ||
        (b.medianSpeedMps ?? 0) - (a.medianSpeedMps ?? 0) ||
        (a.p90AbsSteeringRateDeg ?? Infinity) - (b.p90AbsSteeringRateDeg ?? Infinity),
    )
    .slice(0, filters.candidateSegmentsToScan);
}

function summarizeCandidateSegment(segment: number, samples: SteeringSample[], filters: SteeringWindowFilters): SteeringCandidateSegmentSummary {
  const movingSamples = samples.filter((sample) => Number.isFinite(sample.vEgo) && sample.vEgo >= filters.minSpeedMps && !sample.standstill);
  const qualifyingSamples = samples.filter((sample) => isQualifyingSteeringSample(sample, filters));
  return {
    segment,
    sampleCount: samples.length,
    qualifyingSampleCount: qualifyingSamples.length,
    medianSpeedMps: median(movingSamples.map((sample) => sample.vEgo)),
    p90AbsSteeringRateDeg: percentile(movingSamples.map((sample) => Math.abs(sample.steeringRateDeg)), 0.9),
    p90AbsSteeringAngleDeg: percentile(movingSamples.map((sample) => Math.abs(sample.steeringAngleDeg)), 0.9),
  };
}

function selectSteeringRlogUrls(
  rlogUrls: string[],
  candidateSegments: SteeringCandidateSegmentSummary[],
  filters: SteeringWindowFilters,
): string[] {
  if (candidateSegments.length === 0 || candidateSegments.every((candidate) => candidate.qualifyingSampleCount === 0)) {
    return rlogUrls.slice(0, filters.maxSegmentsToScan);
  }

  const urlsBySegment = new Map(rlogUrls.map((url) => [segmentFromUrl(url), url]));
  const selected = new Set<string>();
  const selectedUrls: string[] = [];
  for (const candidate of candidateSegments) {
    for (const segment of [candidate.segment - 1, candidate.segment, candidate.segment + 1]) {
      const url = urlsBySegment.get(segment);
      if (url && !selected.has(url)) {
        selected.add(url);
        selectedUrls.push(url);
      }
      if (selected.size >= filters.maxSegmentsToScan) break;
    }
    if (selected.size >= filters.maxSegmentsToScan) break;
  }
  return selectedUrls;
}

async function fetchLog(logUrl: string): Promise<Response> {
  const response = await fetch(logUrl);
  if (!response.ok) {
    throw new Error(`Could not download ${logUrl.split("?", 1)[0]} (${response.status}).`);
  }
  return response;
}

function logFileKind(source: "qlogs" | "rlogs"): "qlog" | "rlog" {
  return source === "qlogs" ? "qlog" : "rlog";
}

function readableLogError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.toLowerCase().includes("unexpected eof")) {
    return "unexpected EOF while decompressing; this log segment looks truncated";
  }
  return message;
}

function routeInfoWithDeviceType(routeInfo: RouteInfo | null, routeName: string, deviceType: DeviceType | null): RouteInfo | null {
  if (!deviceType || deviceType === "unknown" || routeInfo?.deviceType === deviceType) return routeInfo;
  return {
    fullname: routeInfo?.fullname ?? routeName,
    ...routeInfo,
    deviceType,
    devicetype: deviceType === "mici" ? 7 : routeInfo?.devicetype,
  };
}

function previewForSegment(
  qcameraUrls: string[],
  preferredSegment: number,
  reason: QcameraPreviewSource["reason"],
): QcameraPreviewSource | null {
  if (qcameraUrls.length === 0) return null;
  const exact = qcameraUrls.find((url) => segmentFromUrl(url) === preferredSegment);
  if (exact) return { logUrl: exact, segment: preferredSegment, reason };

  const nearest =
    qcameraUrls
      .map((url) => ({ url, segment: segmentFromUrl(url) }))
      .filter(({ segment }) => Number.isFinite(segment))
      .sort((a, b) => Math.abs(a.segment - preferredSegment) - Math.abs(b.segment - preferredSegment))[0] ?? null;
  return nearest ? { logUrl: nearest.url, segment: nearest.segment, reason } : null;
}

function summarizeSteeringSample(message: CarStateMessage, logUrl: string, segment: number): SteeringSample {
  return {
    logUrl,
    segment,
    logMonoTime: message.logMonoTime,
    steeringAngleDeg: message.steeringAngleDeg,
    steeringRateDeg: message.steeringRateDeg,
    steeringTorque: message.steeringTorque,
    vEgo: message.vEgo,
    yawRate: message.yawRate,
    steeringPressed: message.steeringPressed,
    standstill: message.standstill,
    leftBlinker: message.leftBlinker,
    rightBlinker: message.rightBlinker,
  };
}

function buildSteeringCenterResult(
  context: RouteLogContext,
  initData: InitDataMessage | null,
  readFailures: LogReadFailure[],
  decodedSegments: number,
  totalCarStateMessages: number,
  samples: SteeringSample[],
  filters: SteeringWindowFilters,
  candidateSegments: SteeringCandidateSegmentSummary[],
): SteeringCenterDiagnosticResult {
  const stableWindows = findStableSteeringWindows(samples, filters);
  const stableSamples = samplesInsideWindows(samples, stableWindows);
  const angles = stableSamples.map((sample) => sample.steeringAngleDeg);
  const medianSteeringAngleDeg = median(angles);
  const medianAbsoluteDeviationDeg =
    medianSteeringAngleDeg === null ? null : median(angles.map((angle) => Math.abs(angle - medianSteeringAngleDeg)));
  const stableDurationSec = sumWindowDuration(stableWindows);
  const qualifyingSampleCount = samples.filter((sample) => isQualifyingSteeringSample(sample, filters)).length;
  const confidence = steeringConfidence(stableWindows, stableSamples.length, stableDurationSec, medianAbsoluteDeviationDeg, filters);
  const caveats = steeringCaveats({
    confidence,
    decodedSegments,
    readFailures,
    scannedSegmentLimit: Math.min(context.logUrls.length, filters.maxSegmentsToScan),
    totalSegments: context.logUrls.length,
    totalCarStateMessages,
    qualifyingSampleCount,
  });

  return {
    routeName: context.routeName,
    routeInfo: context.routeInfo,
    initData,
    logSource: context.source,
    readFailures,
    scannedSegments: decodedSegments,
    totalSegments: context.logUrls.length,
    totalCarStateMessages,
    qualifyingSampleCount,
    stableDurationSec,
    confidence,
    resultType: confidence === "none" ? (readFailures.length > 0 ? "incomplete" : "no-stable-window") : "estimated",
    medianSteeringAngleDeg,
    medianAbsoluteDeviationDeg,
    filters,
    candidateSegments,
    stableWindows,
    caveats,
  };
}

function findStableSteeringWindows(samples: SteeringSample[], filters: SteeringWindowFilters): SteeringWindowSummary[] {
  const sortedSamples = [...samples].sort((a, b) => Number(a.logMonoTime - b.logMonoTime));
  const qualifyingSamples = sortedSamples.filter((sample) => isQualifyingSteeringSample(sample, filters));
  const runs: SteeringSample[][] = [];
  let currentRun: SteeringSample[] = [];

  for (const sample of qualifyingSamples) {
    const previous = currentRun.at(-1);
    if (!previous || secondsBetween(previous.logMonoTime, sample.logMonoTime) <= filters.maxSampleGapSec) {
      currentRun.push(sample);
    } else {
      if (currentRun.length > 0) runs.push(currentRun);
      currentRun = [sample];
    }
  }
  if (currentRun.length > 0) runs.push(currentRun);

  const candidates = runs.flatMap((run) => stableWindowCandidates(run, filters));
  const selected: SteeringWindowSummary[] = [];
  for (const candidate of candidates.sort((a, b) => b.durationSec - a.durationSec || a.segmentStart - b.segmentStart)) {
    const overlaps = selected.some(
      (window) => candidate.startLogMonoTime <= window.endLogMonoTime && candidate.endLogMonoTime >= window.startLogMonoTime,
    );
    if (!overlaps) selected.push(candidate);
  }
  return selected.sort((a, b) => Number(a.startLogMonoTime - b.startLogMonoTime));
}

function stableWindowCandidates(run: SteeringSample[], filters: SteeringWindowFilters): SteeringWindowSummary[] {
  const windows: SteeringWindowSummary[] = [];
  let start = 0;
  while (start < run.length) {
    let end = start;
    while (end + 1 < run.length && secondsBetween(run[start].logMonoTime, run[end + 1].logMonoTime) <= filters.maxWindowDurationSec) {
      const nextRange = angleRange(run.slice(start, end + 2));
      if (nextRange > filters.maxWindowAngleRangeDeg) break;
      end += 1;
    }

    const slice = run.slice(start, end + 1);
    const durationSec = secondsBetween(slice[0].logMonoTime, slice.at(-1)?.logMonoTime ?? slice[0].logMonoTime);
    if (durationSec >= filters.minWindowDurationSec && slice.length >= filters.minWindowSamples) {
      windows.push(summarizeSteeringWindow(slice));
      start = firstIndexAfter(run, start, filters.minWindowDurationSec / 2);
    } else {
      start += 1;
    }
  }
  return windows;
}

function summarizeSteeringWindow(samples: SteeringSample[]): SteeringWindowSummary {
  const angles = samples.map((sample) => sample.steeringAngleDeg);
  const speeds = samples.map((sample) => sample.vEgo);
  const first = samples[0];
  const last = samples.at(-1) ?? first;
  const windowMedianAngle = median(angles) ?? 0;
  const supportingSamples = [first, samples[Math.floor(samples.length / 2)], last]
    .filter((sample, index, array) => array.findIndex((other) => other.logMonoTime === sample.logMonoTime) === index)
    .map(toPublicSteeringSample);

  return {
    segmentStart: first.segment,
    segmentEnd: last.segment,
    startLogMonoTime: first.logMonoTime,
    endLogMonoTime: last.logMonoTime,
    durationSec: secondsBetween(first.logMonoTime, last.logMonoTime),
    sampleCount: samples.length,
    medianSteeringAngleDeg: windowMedianAngle,
    p10SteeringAngleDeg: percentile(angles, 0.1) ?? 0,
    p90SteeringAngleDeg: percentile(angles, 0.9) ?? 0,
    medianAbsoluteDeviationDeg: median(angles.map((angle) => Math.abs(angle - windowMedianAngle))) ?? 0,
    medianSpeedMps: median(speeds) ?? 0,
    maxAngleRangeDeg: angleRange(samples),
    supportingSamples,
  };
}

function toPublicSteeringSample(sample: SteeringSample): SteeringSampleSummary {
  return {
    logUrl: sample.logUrl,
    segment: sample.segment,
    logMonoTime: sample.logMonoTime,
    steeringAngleDeg: sample.steeringAngleDeg,
    steeringRateDeg: sample.steeringRateDeg,
    steeringTorque: sample.steeringTorque,
    vEgo: sample.vEgo,
    yawRate: sample.yawRate,
  };
}

function isQualifyingSteeringSample(sample: SteeringSample, filters: SteeringWindowFilters): boolean {
  return (
    Number.isFinite(sample.steeringAngleDeg) &&
    Number.isFinite(sample.steeringRateDeg) &&
    Number.isFinite(sample.vEgo) &&
    sample.vEgo >= filters.minSpeedMps &&
    Math.abs(sample.steeringAngleDeg) <= filters.maxAbsSteeringAngleDeg &&
    Math.abs(sample.steeringRateDeg) <= filters.maxAbsSteeringRateDeg &&
    !sample.steeringPressed &&
    !sample.standstill &&
    !sample.leftBlinker &&
    !sample.rightBlinker
  );
}

function samplesInsideWindows(samples: SteeringSample[], windows: SteeringWindowSummary[]): SteeringSample[] {
  return samples.filter((sample) =>
    windows.some((window) => sample.logMonoTime >= window.startLogMonoTime && sample.logMonoTime <= window.endLogMonoTime),
  );
}

function steeringConfidence(
  windows: SteeringWindowSummary[],
  stableSampleCount: number,
  stableDurationSec: number,
  medianAbsoluteDeviationDeg: number | null,
  filters: SteeringWindowFilters,
): SteeringConfidence {
  if (windows.length === 0 || stableSampleCount === 0) return "none";
  if (
    windows.length >= filters.minHighConfidenceWindows &&
    stableSampleCount >= filters.minHighConfidenceSamples &&
    stableDurationSec >= filters.minHighConfidenceDurationSec &&
    (medianAbsoluteDeviationDeg ?? Infinity) <= 1.25
  ) {
    return "high";
  }
  if (
    windows.length >= filters.minMediumConfidenceWindows &&
    stableSampleCount >= filters.minMediumConfidenceSamples &&
    stableDurationSec >= filters.minMediumConfidenceDurationSec
  ) {
    return "medium";
  }
  return "low";
}

function steeringCaveats({
  confidence,
  decodedSegments,
  readFailures,
  scannedSegmentLimit,
  totalSegments,
  totalCarStateMessages,
  qualifyingSampleCount,
}: {
  confidence: SteeringConfidence;
  decodedSegments: number;
  readFailures: LogReadFailure[];
  scannedSegmentLimit: number;
  totalSegments: number;
  totalCarStateMessages: number;
  qualifyingSampleCount: number;
}): string[] {
  const caveats = [
    "This estimates logged steering-wheel center from straight, steady driving; it is not a mechanical alignment diagnosis by itself.",
    "Road crown, wind, tire pressure, lane curvature, sensor offset, and driver input can shift the median.",
  ];
  if (confidence === "none") {
    caveats.unshift("No stable straight-driving window met the filters, so no steering center estimate was produced.");
  } else if (confidence !== "high") {
    caveats.unshift("Confidence is limited because the route did not provide many long, consistent straight-driving windows.");
  }
  if (readFailures.length > 0) {
    caveats.push(`${readFailures.length} segment(s) could not be decoded and were skipped.`);
  }
  if (scannedSegmentLimit < totalSegments) {
    caveats.push(`The scan stopped at ${scannedSegmentLimit} of ${totalSegments} uploaded segment(s) once enough route was checked.`);
  }
  if (decodedSegments === 0) {
    caveats.push("No log segments were decoded successfully.");
  }
  if (totalCarStateMessages === 0) {
    caveats.push("No carState messages were decoded from the scanned logs.");
  } else if (qualifyingSampleCount === 0) {
    caveats.push("carState messages were present, but all samples were rejected by speed, steering-rate, blinker, standstill, or driver-steering filters.");
  }
  return caveats;
}

function firstIndexAfter(samples: SteeringSample[], start: number, seconds: number): number {
  const startTime = samples[start].logMonoTime;
  for (let index = start + 1; index < samples.length; index += 1) {
    if (secondsBetween(startTime, samples[index].logMonoTime) >= seconds) return index;
  }
  return start + 1;
}

function sumWindowDuration(windows: SteeringWindowSummary[]): number {
  return windows.reduce((sum, window) => sum + window.durationSec, 0);
}

function angleRange(samples: Array<Pick<SteeringSample, "steeringAngleDeg">>): number {
  const angles = samples.map((sample) => sample.steeringAngleDeg);
  return Math.max(...angles) - Math.min(...angles);
}

function secondsBetween(start: bigint, end: bigint): number {
  return Number(end - start) / 1e9;
}

function median(values: number[]): number | null {
  return percentile(values, 0.5);
}

function percentile(values: number[], p: number): number | null {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const position = (sorted.length - 1) * p;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  const weight = position - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function summarizeCarParams(message: CarParamsMessage, logUrl: string, segment: number): CarParamsSummary {
  return {
    logUrl,
    segment,
    logMonoTime: message.logMonoTime,
    brand: message.brand,
    carFingerprint: message.carFingerprint,
    fuzzyFingerprint: message.fuzzyFingerprint,
    notCar: message.notCar,
    carVin: message.carVin ? { value: message.carVin, redacted: redactVin(message.carVin) } : null,
    dashcamOnly: message.dashcamOnly,
    passive: message.passive,
    openpilotLongitudinalControl: message.openpilotLongitudinalControl,
    fingerprintSource: message.fingerprintSource,
    fingerprintSourceName: message.fingerprintSourceName,
    carFw: message.carFw.map((fw) => ({
      ecu: fw.ecu,
      ecuName: fw.ecuName,
      fwVersionPython: fw.fwVersionPython,
      pythonSnippet: pythonFirmwareSnippet(fw.ecuName, fw.address, fw.subAddress, fw.fwVersionPython),
      fwVersionText: fw.fwVersionText,
      address: fw.address,
      subAddress: fw.subAddress,
      responseAddress: fw.responseAddress,
      request: fw.request,
      brand: fw.brand,
      bus: fw.bus,
    })),
  };
}

function summarizeOnroadEvent(message: OnroadEventMessage, logUrl: string, segment: number): OnroadEventSummary {
  return {
    logUrl,
    segment,
    logMonoTime: message.logMonoTime,
    name: message.name,
    nameText: message.nameText,
  };
}

function mergeCanEvidence(target: Map<string, CanEvidenceSummary>, messages: FingerprintLogMessages, segment: number): void {
  for (const can of messages.canMessages) {
    const key = `${can.src}:${can.address}:${can.dataLength}`;
    const existing = target.get(key);
    if (existing) {
      existing.count += 1;
      existing.lastSegment = Math.max(existing.lastSegment, segment);
      existing.firstSegment = Math.min(existing.firstSegment, segment);
    } else {
      target.set(key, {
        src: can.src,
        address: can.address,
        dataLength: can.dataLength,
        count: 1,
        firstSegment: segment,
        lastSegment: segment,
      });
    }
  }
}

function dedupeEvents(events: OnroadEventSummary[]): OnroadEventSummary[] {
  const seen = new Set<string>();
  const deduped: OnroadEventSummary[] = [];
  for (const event of events) {
    const key = `${event.segment}:${event.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(event);
  }
  return deduped;
}

function buildRecommendations(
  carParams: CarParamsSummary | null,
  events: OnroadEventSummary[],
  initData: InitDataMessage | null,
  readFailures: LogReadFailure[],
): Recommendation[] {
  const recommendations: Recommendation[] = [];
  const recognized = Boolean(carParams?.carFingerprint);
  const unrecognizedEvent = events.some((event) => event.nameText === "carUnrecognized" || event.nameText === "startupNoCar" || event.nameText === "dashcamMode");
  const sunnyish = isSunnyPilotMetadata(initData);

  recommendations.push({
    kind: "stock-openpilot",
    title: recognized ? "Stock openpilot evidence" : "Stock openpilot next step",
    body: recognized
      ? `Route logged ${carParams?.carFingerprint}; use the firmware and CAN evidence below if you are comparing against upstream fingerprints.`
      : "If this was stock openpilot, try current nightly-dev first and share this report with the brand channel or an upstream fingerprinting issue.",
    links: [
      { label: "openpilot fingerprinting guide", url: OPENPILOT_FINGERPRINTING_URL },
      { label: "nightly-dev installer", url: OPENPILOT_NIGHTLY_DEV_INSTALLER_URL },
    ],
  });

  recommendations.push({
    kind: "sunnypilot",
    title: sunnyish || unrecognizedEvent ? "SunnyPilot car selector" : "SunnyPilot option",
    body: "On SunnyPilot, use SunnyLink or the vehicle settings car selector to manually select the vehicle when automatic recognition is not enough. comma four users may need SunnyLink for selection.",
    links: [
      { label: "SunnyLink", url: SUNNYLINK_URL },
      { label: "SunnyPilot vehicle settings", url: SUNNYPILOT_VEHICLE_SETTINGS_URL },
      { label: "SunnyPilot", url: SUNNYPILOT_URL },
      { label: "release-mici installer", url: SUNNYPILOT_RELEASE_MICI_INSTALLER_URL },
    ],
  });

  if (!recognized) {
    recommendations.push({
      kind: "fork-context",
      title: "Fork context",
      body: "hardcoded-fp can be useful context when someone is deliberately testing fixed fingerprints, but this report does not choose or recommend a hardcoded branch. Use the evidence here with human review.",
      links: [
        { label: "hardcoded-fp branch index", url: HARDCODED_FP_BRANCH_INDEX_URL },
        { label: "hardcoded-fp repo", url: HARDCODED_FP_REPO_URL },
      ],
    });
  }

  if (readFailures.length > 0) {
    recommendations.unshift({
      kind: "stock-openpilot",
      title: "Scan incomplete",
      body: `${readFailures.length} segment(s) could not be decoded. Re-run with uploaded qlogs/rlogs available before treating missing evidence as meaningful.`,
      links: [],
    });
  }

  return recommendations;
}

function redactVin(vin: string): string {
  if (vin.length <= 6) return "redacted";
  return `${vin.slice(0, 3)}${"*".repeat(Math.max(4, vin.length - 6))}${vin.slice(-3)}`;
}

function isSunnyPilotMetadata(initData: InitDataMessage | null): boolean {
  const haystack = [initData?.gitRemote, initData?.gitBranch, initData?.version, initData?.gitSrcCommit].join(" ").toLowerCase();
  return haystack.includes("sunnypilot") || haystack.includes("sunny");
}

function pythonFirmwareSnippet(ecuName: string, address: number, subAddress: number, fwVersionPython: string): string {
  const ecu = ecuName.startsWith("ecu ") ? `Ecu.unknown  # raw ecu ${ecuName.slice(4)}` : `Ecu.${ecuName}`;
  const subAddressText = subAddress === 0 ? "None" : `0x${subAddress.toString(16)}`;
  return `(${ecu}, 0x${address.toString(16)}, ${subAddressText}): [\n  ${fwVersionPython},\n],`;
}
