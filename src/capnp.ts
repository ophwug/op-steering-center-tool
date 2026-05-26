import {
  CALIBRATION_STATUS_NAMES,
  CAN_UNION_TAG,
  CAR_PARAMS_UNION_TAG,
  CAR_STATE_UNION_TAG,
  CONTROLS_STATE_UNION_TAG,
  FINGERPRINT_EVENT_NAMES,
  FINGERPRINT_SOURCE_NAMES,
  INIT_DATA_UNION_TAG,
  LATERAL_PLAN_DEPRECATED_UNION_TAG,
  LIVE_CALIBRATION_UNION_TAG,
  LIVE_LOCATION_KALMAN_DEPRECATED_UNION_TAG,
  LIVE_POSE_UNION_TAG,
  ONROAD_EVENTS_UNION_TAG,
} from "./constants";

export interface SegmentData {
  bytes: Uint8Array;
  offset: number;
  lengthWords: number;
}

export interface CalibrationMessage {
  logMonoTime: bigint;
  status: number;
  statusName: string;
  calPerc: number;
  validBlocks: number;
  rpyCalib: number[];
  rpyCalibSpread: number[];
  wideFromDeviceEuler: number[];
  height: number[];
}

export type DeviceType = "unknown" | "neo" | "chffrAndroid" | "chffrIos" | "tici" | "pc" | "tizi" | "mici";

export interface InitDataMessage {
  logMonoTime: bigint;
  deviceType: DeviceType | null;
  version: string;
  gitCommit: string;
  gitBranch: string;
  gitRemote: string;
  gitSrcCommit: string;
}

export interface CarFirmwareMessage {
  ecu: number;
  ecuName: string;
  fwVersionBytes: number[];
  fwVersionPython: string;
  fwVersionText: string;
  address: number;
  subAddress: number;
  responseAddress: number;
  request: string[];
  brand: string;
  bus: number;
}

export interface CarParamsMessage {
  logMonoTime: bigint;
  brand: string;
  carFingerprint: string;
  fuzzyFingerprint: boolean;
  notCar: boolean;
  carVin: string;
  dashcamOnly: boolean;
  passive: boolean;
  openpilotLongitudinalControl: boolean;
  fingerprintSource: number;
  fingerprintSourceName: string;
  carFw: CarFirmwareMessage[];
}

export interface OnroadEventMessage {
  logMonoTime: bigint;
  name: number;
  nameText: string;
}

export interface CanMessage {
  logMonoTime: bigint;
  address: number;
  src: number;
  dataLength: number;
}

export interface CarStateMessage {
  logMonoTime: bigint;
  vEgo: number;
  aEgo: number;
  yawRate: number;
  steeringAngleDeg: number;
  steeringRateDeg: number;
  steeringTorque: number;
  steeringPressed: boolean;
  standstill: boolean;
  leftBlinker: boolean;
  rightBlinker: boolean;
}

export interface ControlsStateMessage {
  logMonoTime: bigint;
  curvature: number;
  desiredCurvature: number;
  lateralPlanMonoTime: bigint;
}

export interface LateralPlanMessage {
  logMonoTime: bigint;
  curvatures: number[];
  firstCurvature: number | null;
}

export interface LiveLocationKalmanMessage {
  logMonoTime: bigint;
  speedCalibrated: number | null;
  yawRateCalibrated: number | null;
}

export interface LivePoseMessage {
  logMonoTime: bigint;
  speedDevice: number | null;
  yawRateDevice: number | null;
}

export interface SteeringContextMessages {
  controlsState: ControlsStateMessage[];
  lateralPlan: LateralPlanMessage[];
  liveLocationKalman: LiveLocationKalmanMessage[];
  livePose: LivePoseMessage[];
}

export interface FingerprintLogMessages {
  initData: InitDataMessage | null;
  deviceType: DeviceType | null;
  carParams: CarParamsMessage[];
  onroadEvents: OnroadEventMessage[];
  canMessages: CanMessage[];
}

interface StructRef {
  segment: SegmentData;
  dataOffset: number;
  pointerOffset: number;
  dataWords: number;
  pointerCount: number;
}

interface ListRef {
  segment: SegmentData;
  offset: number;
  elementSize: number;
  elementCount: number;
}

interface StructListRef {
  items: Array<StructRef & { segmentIndex: number }>;
  dataWords: number;
  pointerCount: number;
}

const WORD_SIZE = 8;
const EVENT_UNION_TAG_BYTE_OFFSET = 8;
const EVENT_POINTER_FIELD_0 = 0;
const DEVICE_STATE_UNION_TAG = 5;
const INIT_DATA_DEVICE_TYPE_BYTE_OFFSET = 0;
const DEVICE_STATE_DEVICE_TYPE_BYTE_OFFSET = 82;
const LIVE_CALIBRATION_STATUS_BYTE_OFFSET = 2;
const LIVE_CALIBRATION_CAL_PERC_BYTE_OFFSET = 1;
const LIVE_CALIBRATION_VALID_BLOCKS_BYTE_OFFSET = 8;

const LIVE_CALIBRATION_POINTER_FIELDS = {
  rpyCalib: 4,
  rpyCalibSpread: 5,
  wideFromDeviceEuler: 6,
  height: 7,
} as const;

const DEVICE_TYPES: Record<number, DeviceType> = {
  0: "unknown",
  1: "neo",
  2: "chffrAndroid",
  3: "chffrIos",
  4: "tici",
  5: "pc",
  6: "tizi",
  7: "mici",
};

const CAR_PARAMS_POINTER_FIELDS = {
  brand: 0,
  carFingerprint: 1,
  carVin: 10,
  carFw: 11,
} as const;

const CAR_PARAMS_DATA_FIELDS = {
  openpilotLongitudinalControlBool: 9,
  dashcamOnlyBool: 11,
  fingerprintSource: 35,
  fuzzyFingerprintBool: 13,
  notCarBool: 992,
  passiveBool: 996,
} as const;

const CAR_FW_POINTER_FIELDS = {
  fwVersion: 0,
  request: 1,
  brand: 2,
} as const;

const CAR_FW_DATA_FIELDS = {
  ecu: 0,
  address: 1,
  subAddress: 2,
  responseAddress: 2,
  bus: 3,
} as const;

const INIT_DATA_POINTER_FIELDS = {
  version: 3,
  gitCommit: 8,
  gitBranch: 9,
  gitRemote: 10,
  gitSrcCommit: 19,
} as const;

const CAN_DATA_POINTER_FIELDS = {
  dat: 0,
} as const;

const CAN_DATA_FIELDS = {
  address: 0,
  src: 6,
} as const;

const CAR_STATE_DATA_FIELDS = {
  vEgo: 0,
  steeringAngleDeg: 4,
  steeringTorque: 5,
  steeringPressedBool: 66,
  steeringRateDeg: 6,
  aEgo: 7,
  standstillBool: 67,
  leftBlinkerBool: 69,
  rightBlinkerBool: 70,
  yawRate: 9,
} as const;

const CONTROLS_STATE_DATA_FIELDS = {
  curvature: 34,
  desiredCurvature: 44,
  lateralPlanMonoTime: 20,
} as const;

const LATERAL_PLAN_POINTER_FIELDS = {
  curvatures: 6,
} as const;

const LIVE_LOCATION_KALMAN_POINTER_FIELDS = {
  velocityCalibrated: 10,
  angularVelocityCalibrated: 12,
} as const;

const LIVE_LOCATION_MEASUREMENT_POINTER_FIELDS = {
  value: 0,
} as const;

const LIVE_LOCATION_MEASUREMENT_DATA_FIELDS = {
  validBool: 0,
} as const;

const LIVE_POSE_POINTER_FIELDS = {
  velocityDevice: 1,
  angularVelocityDevice: 3,
} as const;

const LIVE_POSE_XYZ_FIELDS = {
  x: 0,
  y: 1,
  z: 2,
  validBool: 192,
} as const;

const ECU_NAMES: Record<number, string> = {
  0: "eps",
  1: "abs",
  2: "fwdRadar",
  3: "fwdCamera",
  4: "engine",
  5: "unknown",
  6: "dsu",
  7: "parkingAdas",
  8: "transmission",
  9: "srs",
  10: "gateway",
  11: "hud",
  12: "combinationMeter",
  13: "vsa",
  14: "programmedFuelInjection",
  15: "electricBrakeBooster",
  16: "shiftByWire",
  17: "debug",
  18: "hybrid",
  19: "adas",
  20: "hvac",
  21: "cornerRadar",
  22: "epb",
  23: "telematics",
  24: "body",
};

export function* readMessages(bytes: Uint8Array): Generator<SegmentData[]> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let cursor = 0;

  while (cursor < bytes.byteLength) {
    if (cursor + 4 > bytes.byteLength) return;
    const segmentCount = view.getUint32(cursor, true) + 1;
    cursor += 4;

    const segmentSizes: number[] = [];
    for (let i = 0; i < segmentCount; i += 1) {
      if (cursor + 4 > bytes.byteLength) return;
      segmentSizes.push(view.getUint32(cursor, true));
      cursor += 4;
    }

    if (segmentCount % 2 === 0) {
      cursor += 4;
    }

    const segments: SegmentData[] = [];
    for (const lengthWords of segmentSizes) {
      const byteLength = lengthWords * WORD_SIZE;
      if (cursor + byteLength > bytes.byteLength) return;
      segments.push({ bytes, offset: cursor, lengthWords });
      cursor += byteLength;
    }

    yield segments;
  }
}

export function findFirstCalibrationMessage(
  bytes: Uint8Array,
  predicate: (message: CalibrationMessage) => boolean = (message) => message.status === 1 && message.rpyCalib.length === 3,
): CalibrationMessage | null {
  return findCalibrationMessages(bytes, predicate)[0] ?? null;
}

export function findCalibrationMessages(
  bytes: Uint8Array,
  predicate: (message: CalibrationMessage) => boolean = (message) => message.status === 1 && message.rpyCalib.length === 3,
): CalibrationMessage[] {
  const messages: CalibrationMessage[] = [];
  for (const segments of readMessages(bytes)) {
    const msg = readLiveCalibrationMessage(segments);
    if (msg && predicate(msg)) {
      messages.push(msg);
    }
  }
  return messages;
}

export function findDeviceType(bytes: Uint8Array): DeviceType | null {
  for (const segments of readMessages(bytes)) {
    const deviceType = readDeviceTypeMessage(segments);
    if (deviceType && deviceType !== "unknown") return deviceType;
  }
  return null;
}

export function findFingerprintLogMessages(bytes: Uint8Array): FingerprintLogMessages {
  const result: FingerprintLogMessages = {
    initData: null,
    deviceType: null,
    carParams: [],
    onroadEvents: [],
    canMessages: [],
  };

  for (const segments of readMessages(bytes)) {
    if (segments.length === 0) continue;
    const root = readEventRoot(segments);
    if (!root) continue;

    const unionTag = getUint16(root, EVENT_UNION_TAG_BYTE_OFFSET);
    if (unionTag === INIT_DATA_UNION_TAG) {
      const initData = readInitDataMessageFromRoot(root, segments);
      if (initData) {
        result.initData ??= initData;
        result.deviceType ??= initData.deviceType;
      }
      continue;
    }

    if (unionTag === DEVICE_STATE_UNION_TAG) {
      const deviceType = readDeviceTypeMessage(segments);
      if (deviceType && deviceType !== "unknown") result.deviceType ??= deviceType;
      continue;
    }

    if (unionTag === CAR_PARAMS_UNION_TAG) {
      const carParams = readCarParamsMessageFromRoot(root, segments);
      if (carParams) result.carParams.push(carParams);
      continue;
    }

    if (unionTag === ONROAD_EVENTS_UNION_TAG) {
      result.onroadEvents.push(...readOnroadEventMessagesFromRoot(root, segments));
      continue;
    }

    if (unionTag === CAN_UNION_TAG) {
      result.canMessages.push(...readCanMessagesFromRoot(root, segments));
    }
  }

  return result;
}

export function findCarStateMessages(bytes: Uint8Array): CarStateMessage[] {
  const messages: CarStateMessage[] = [];
  for (const segments of readMessages(bytes)) {
    if (segments.length === 0) continue;
    const root = readEventRoot(segments);
    if (!root) continue;

    const unionTag = getUint16(root, EVENT_UNION_TAG_BYTE_OFFSET);
    if (unionTag !== CAR_STATE_UNION_TAG) continue;

    const carState = readCarStateMessageFromRoot(root, segments);
    if (carState) messages.push(carState);
  }
  return messages;
}

export function findSteeringContextMessages(bytes: Uint8Array): SteeringContextMessages {
  const messages: SteeringContextMessages = {
    controlsState: [],
    lateralPlan: [],
    liveLocationKalman: [],
    livePose: [],
  };

  for (const segments of readMessages(bytes)) {
    if (segments.length === 0) continue;
    const root = readEventRoot(segments);
    if (!root) continue;

    const unionTag = getUint16(root, EVENT_UNION_TAG_BYTE_OFFSET);
    if (unionTag === CONTROLS_STATE_UNION_TAG) {
      const message = readControlsStateMessageFromRoot(root, segments);
      if (message) messages.controlsState.push(message);
      continue;
    }
    if (unionTag === LATERAL_PLAN_DEPRECATED_UNION_TAG) {
      const message = readLateralPlanMessageFromRoot(root, segments);
      if (message) messages.lateralPlan.push(message);
      continue;
    }
    if (unionTag === LIVE_LOCATION_KALMAN_DEPRECATED_UNION_TAG) {
      const message = readLiveLocationKalmanMessageFromRoot(root, segments);
      if (message) messages.liveLocationKalman.push(message);
      continue;
    }
    if (unionTag === LIVE_POSE_UNION_TAG) {
      const message = readLivePoseMessageFromRoot(root, segments);
      if (message) messages.livePose.push(message);
    }
  }

  return messages;
}

export function readLiveCalibrationMessage(segments: SegmentData[]): CalibrationMessage | null {
  const root = readEventRoot(segments);
  if (!root) return null;

  const unionTag = getUint16(root, EVENT_UNION_TAG_BYTE_OFFSET);
  if (unionTag !== LIVE_CALIBRATION_UNION_TAG) return null;

  const liveCalibration = readStructPointer(segments, root.segmentIndex, pointerFieldOffset(root, EVENT_POINTER_FIELD_0));
  if (!liveCalibration) return null;

  const status = getUint16(liveCalibration, LIVE_CALIBRATION_STATUS_BYTE_OFFSET);
  return {
    logMonoTime: getBigUint64(root, 0),
    status,
    statusName: CALIBRATION_STATUS_NAMES[status] ?? `unknown (${status})`,
    calPerc: getInt8(liveCalibration, LIVE_CALIBRATION_CAL_PERC_BYTE_OFFSET),
    validBlocks: getInt32(liveCalibration, LIVE_CALIBRATION_VALID_BLOCKS_BYTE_OFFSET),
    rpyCalib: readFloat32List(liveCalibration, LIVE_CALIBRATION_POINTER_FIELDS.rpyCalib),
    rpyCalibSpread: readFloat32List(liveCalibration, LIVE_CALIBRATION_POINTER_FIELDS.rpyCalibSpread),
    wideFromDeviceEuler: readFloat32List(liveCalibration, LIVE_CALIBRATION_POINTER_FIELDS.wideFromDeviceEuler),
    height: readFloat32List(liveCalibration, LIVE_CALIBRATION_POINTER_FIELDS.height),
  };
}

function readInitDataMessageFromRoot(root: StructRef & { segmentIndex: number }, segments: SegmentData[]): InitDataMessage | null {
  const initData = readStructPointer(segments, root.segmentIndex, pointerFieldOffset(root, EVENT_POINTER_FIELD_0));
  if (!initData) return null;
  const rawDeviceType = getUint16(initData, INIT_DATA_DEVICE_TYPE_BYTE_OFFSET);
  const deviceType = DEVICE_TYPES[rawDeviceType] ?? "unknown";
  return {
    logMonoTime: getBigUint64(root, 0),
    deviceType,
    version: readTextField(initData, INIT_DATA_POINTER_FIELDS.version),
    gitCommit: readTextField(initData, INIT_DATA_POINTER_FIELDS.gitCommit),
    gitBranch: readTextField(initData, INIT_DATA_POINTER_FIELDS.gitBranch),
    gitRemote: readTextField(initData, INIT_DATA_POINTER_FIELDS.gitRemote),
    gitSrcCommit: readTextField(initData, INIT_DATA_POINTER_FIELDS.gitSrcCommit),
  };
}

function readCarParamsMessageFromRoot(root: StructRef & { segmentIndex: number }, segments: SegmentData[]): CarParamsMessage | null {
  const carParams = readStructPointer(segments, root.segmentIndex, pointerFieldOffset(root, EVENT_POINTER_FIELD_0));
  if (!carParams) return null;
  const fingerprintSource = getUint16ByIndex(carParams, CAR_PARAMS_DATA_FIELDS.fingerprintSource);
  return {
    logMonoTime: getBigUint64(root, 0),
    brand: readTextField(carParams, CAR_PARAMS_POINTER_FIELDS.brand),
    carFingerprint: readTextField(carParams, CAR_PARAMS_POINTER_FIELDS.carFingerprint),
    fuzzyFingerprint: getBoolByIndex(carParams, CAR_PARAMS_DATA_FIELDS.fuzzyFingerprintBool),
    notCar: getBoolByIndex(carParams, CAR_PARAMS_DATA_FIELDS.notCarBool),
    carVin: readTextField(carParams, CAR_PARAMS_POINTER_FIELDS.carVin),
    dashcamOnly: getBoolByIndex(carParams, CAR_PARAMS_DATA_FIELDS.dashcamOnlyBool),
    passive: getBoolByIndex(carParams, CAR_PARAMS_DATA_FIELDS.passiveBool),
    openpilotLongitudinalControl: getBoolByIndex(carParams, CAR_PARAMS_DATA_FIELDS.openpilotLongitudinalControlBool),
    fingerprintSource,
    fingerprintSourceName: FINGERPRINT_SOURCE_NAMES[fingerprintSource] ?? `unknown (${fingerprintSource})`,
    carFw: readCarFirmwareList(carParams),
  };
}

function readCarFirmwareList(carParams: StructRef & { segmentIndex: number }): CarFirmwareMessage[] {
  const list = readStructListPointer(carParams.segment, pointerFieldOffset(carParams, CAR_PARAMS_POINTER_FIELDS.carFw));
  if (!list) return [];
  return list.items.map((carFw) => {
    const fwVersionBytes = readDataField(carFw, CAR_FW_POINTER_FIELDS.fwVersion);
    return {
      ecu: getUint16ByIndex(carFw, CAR_FW_DATA_FIELDS.ecu),
      ecuName: ecuName(getUint16ByIndex(carFw, CAR_FW_DATA_FIELDS.ecu)),
      fwVersionBytes: [...fwVersionBytes],
      fwVersionPython: formatPythonBytes(fwVersionBytes),
      fwVersionText: formatPrintableBytes(fwVersionBytes),
      address: getUint32ByIndex(carFw, CAR_FW_DATA_FIELDS.address),
      subAddress: getUint8ByIndex(carFw, CAR_FW_DATA_FIELDS.subAddress),
      responseAddress: getUint32ByIndex(carFw, CAR_FW_DATA_FIELDS.responseAddress),
      request: readDataListField(carFw, CAR_FW_POINTER_FIELDS.request).map(formatHexBytes),
      brand: readTextField(carFw, CAR_FW_POINTER_FIELDS.brand),
      bus: getUint8ByIndex(carFw, CAR_FW_DATA_FIELDS.bus),
    };
  });
}

function readOnroadEventMessagesFromRoot(root: StructRef & { segmentIndex: number }, segments: SegmentData[]): OnroadEventMessage[] {
  const list = readStructListPointer(segments[root.segmentIndex], pointerFieldOffset(root, EVENT_POINTER_FIELD_0));
  if (!list) return [];
  const logMonoTime = getBigUint64(root, 0);
  return list.items.map((event) => {
    const name = getUint16ByIndex(event, 0);
    return {
      logMonoTime,
      name,
      nameText: FINGERPRINT_EVENT_NAMES[name] ?? `event ${name}`,
    };
  });
}

function readCanMessagesFromRoot(root: StructRef & { segmentIndex: number }, segments: SegmentData[]): CanMessage[] {
  const list = readStructListPointer(segments[root.segmentIndex], pointerFieldOffset(root, EVENT_POINTER_FIELD_0));
  if (!list) return [];
  const logMonoTime = getBigUint64(root, 0);
  return list.items.map((can) => ({
    logMonoTime,
    address: getUint32ByIndex(can, CAN_DATA_FIELDS.address),
    src: getUint8ByIndex(can, CAN_DATA_FIELDS.src),
    dataLength: readDataField(can, CAN_DATA_POINTER_FIELDS.dat).length,
  }));
}

function readCarStateMessageFromRoot(root: StructRef & { segmentIndex: number }, segments: SegmentData[]): CarStateMessage | null {
  const carState = readStructPointer(segments, root.segmentIndex, pointerFieldOffset(root, EVENT_POINTER_FIELD_0));
  if (!carState) return null;
  return {
    logMonoTime: getBigUint64(root, 0),
    vEgo: getFloat32ByIndex(carState, CAR_STATE_DATA_FIELDS.vEgo),
    aEgo: getFloat32ByIndex(carState, CAR_STATE_DATA_FIELDS.aEgo),
    yawRate: getFloat32ByIndex(carState, CAR_STATE_DATA_FIELDS.yawRate),
    steeringAngleDeg: getFloat32ByIndex(carState, CAR_STATE_DATA_FIELDS.steeringAngleDeg),
    steeringRateDeg: getFloat32ByIndex(carState, CAR_STATE_DATA_FIELDS.steeringRateDeg),
    steeringTorque: getFloat32ByIndex(carState, CAR_STATE_DATA_FIELDS.steeringTorque),
    steeringPressed: getBoolByIndex(carState, CAR_STATE_DATA_FIELDS.steeringPressedBool),
    standstill: getBoolByIndex(carState, CAR_STATE_DATA_FIELDS.standstillBool),
    leftBlinker: getBoolByIndex(carState, CAR_STATE_DATA_FIELDS.leftBlinkerBool),
    rightBlinker: getBoolByIndex(carState, CAR_STATE_DATA_FIELDS.rightBlinkerBool),
  };
}

function readControlsStateMessageFromRoot(root: StructRef & { segmentIndex: number }, segments: SegmentData[]): ControlsStateMessage | null {
  const controlsState = readStructPointer(segments, root.segmentIndex, pointerFieldOffset(root, EVENT_POINTER_FIELD_0));
  if (!controlsState) return null;
  return {
    logMonoTime: getBigUint64(root, 0),
    curvature: getFloat32ByIndex(controlsState, CONTROLS_STATE_DATA_FIELDS.curvature),
    desiredCurvature: getFloat32ByIndex(controlsState, CONTROLS_STATE_DATA_FIELDS.desiredCurvature),
    lateralPlanMonoTime: getBigUint64ByIndex(controlsState, CONTROLS_STATE_DATA_FIELDS.lateralPlanMonoTime),
  };
}

function readLateralPlanMessageFromRoot(root: StructRef & { segmentIndex: number }, segments: SegmentData[]): LateralPlanMessage | null {
  const lateralPlan = readStructPointer(segments, root.segmentIndex, pointerFieldOffset(root, EVENT_POINTER_FIELD_0));
  if (!lateralPlan) return null;
  const curvatures = readFloat32List(lateralPlan, LATERAL_PLAN_POINTER_FIELDS.curvatures);
  return {
    logMonoTime: getBigUint64(root, 0),
    curvatures,
    firstCurvature: curvatures[0] ?? null,
  };
}

function readLiveLocationKalmanMessageFromRoot(root: StructRef & { segmentIndex: number }, segments: SegmentData[]): LiveLocationKalmanMessage | null {
  const liveLocation = readStructPointer(segments, root.segmentIndex, pointerFieldOffset(root, EVENT_POINTER_FIELD_0));
  if (!liveLocation) return null;
  const velocity = readLiveLocationMeasurement(liveLocation, LIVE_LOCATION_KALMAN_POINTER_FIELDS.velocityCalibrated);
  const angularVelocity = readLiveLocationMeasurement(liveLocation, LIVE_LOCATION_KALMAN_POINTER_FIELDS.angularVelocityCalibrated);
  return {
    logMonoTime: getBigUint64(root, 0),
    speedCalibrated: vectorMagnitude(velocity),
    yawRateCalibrated: measurementAxis(angularVelocity, 2),
  };
}

function readLivePoseMessageFromRoot(root: StructRef & { segmentIndex: number }, segments: SegmentData[]): LivePoseMessage | null {
  const livePose = readStructPointer(segments, root.segmentIndex, pointerFieldOffset(root, EVENT_POINTER_FIELD_0));
  if (!livePose) return null;
  const velocity = readLivePoseXyzMeasurement(livePose, LIVE_POSE_POINTER_FIELDS.velocityDevice);
  const angularVelocity = readLivePoseXyzMeasurement(livePose, LIVE_POSE_POINTER_FIELDS.angularVelocityDevice);
  return {
    logMonoTime: getBigUint64(root, 0),
    speedDevice: vectorMagnitude(velocity),
    yawRateDevice: angularVelocity?.z ?? null,
  };
}

function readDeviceTypeMessage(segments: SegmentData[]): DeviceType | null {
  const root = readEventRoot(segments);
  if (!root) return null;

  const unionTag = getUint16(root, EVENT_UNION_TAG_BYTE_OFFSET);
  if (unionTag !== INIT_DATA_UNION_TAG && unionTag !== DEVICE_STATE_UNION_TAG) return null;

  const eventPayload = readStructPointer(segments, root.segmentIndex, pointerFieldOffset(root, EVENT_POINTER_FIELD_0));
  if (!eventPayload) return null;

  const rawDeviceType =
    unionTag === INIT_DATA_UNION_TAG
      ? getUint16(eventPayload, INIT_DATA_DEVICE_TYPE_BYTE_OFFSET)
      : getUint16(eventPayload, DEVICE_STATE_DEVICE_TYPE_BYTE_OFFSET);
  return DEVICE_TYPES[rawDeviceType] ?? "unknown";
}

function readEventRoot(segments: SegmentData[]): (StructRef & { segmentIndex: number }) | null {
  if (segments.length === 0) return null;
  return readStructPointer(segments, 0, segments[0].offset);
}

function pointerFieldOffset(ref: StructRef & { segmentIndex: number }, pointerIndex: number): number {
  return ref.pointerOffset + pointerIndex * WORD_SIZE;
}

function readStructPointer(
  segments: SegmentData[],
  segmentIndex: number,
  pointerOffset: number,
): (StructRef & { segmentIndex: number }) | null {
  const segment = segments[segmentIndex];
  const raw = readUint64(segment.bytes, pointerOffset);
  if (raw === 0n) return null;
  if ((raw & 0x3n) !== 0n) {
    throw new Error("Unsupported far or non-struct Cap'n Proto pointer in log message.");
  }

  const offsetWords = signed30(Number((raw >> 2n) & 0x3fffffffn));
  const dataWords = Number((raw >> 32n) & 0xffffn);
  const pointerCount = Number((raw >> 48n) & 0xffffn);
  const dataOffset = pointerOffset + WORD_SIZE + offsetWords * WORD_SIZE;
  const pointerSectionOffset = dataOffset + dataWords * WORD_SIZE;

  return {
    segment,
    segmentIndex,
    dataOffset,
    pointerOffset: pointerSectionOffset,
    dataWords,
    pointerCount,
  };
}

function readFloat32List(ref: StructRef & { segmentIndex: number }, pointerIndex: number): number[] {
  if (pointerIndex >= ref.pointerCount) return [];
  const list = readListPointer(ref.segment, pointerFieldOffset(ref, pointerIndex));
  if (!list) return [];
  if (list.elementSize !== 4) {
    throw new Error(`Expected Float32 list, got Cap'n Proto element size ${list.elementSize}.`);
  }

  const view = new DataView(list.segment.bytes.buffer, list.segment.bytes.byteOffset, list.segment.bytes.byteLength);
  const values: number[] = [];
  for (let i = 0; i < list.elementCount; i += 1) {
    values.push(view.getFloat32(list.offset + i * 4, true));
  }
  return values;
}

function readFloat64List(ref: StructRef & { segmentIndex: number }, pointerIndex: number): number[] {
  if (pointerIndex >= ref.pointerCount) return [];
  const list = readListPointer(ref.segment, pointerFieldOffset(ref, pointerIndex));
  if (!list) return [];
  if (list.elementSize !== 5) {
    throw new Error(`Expected Float64 list, got Cap'n Proto element size ${list.elementSize}.`);
  }

  const view = new DataView(list.segment.bytes.buffer, list.segment.bytes.byteOffset, list.segment.bytes.byteLength);
  const values: number[] = [];
  for (let i = 0; i < list.elementCount; i += 1) {
    values.push(view.getFloat64(list.offset + i * 8, true));
  }
  return values;
}

function readLiveLocationMeasurement(ref: StructRef & { segmentIndex: number }, pointerIndex: number): number[] | null {
  if (pointerIndex >= ref.pointerCount) return null;
  const measurement = readStructPointer([ref.segment], 0, pointerFieldOffset(ref, pointerIndex));
  if (!measurement || !getBoolByIndex(measurement, LIVE_LOCATION_MEASUREMENT_DATA_FIELDS.validBool)) return null;
  const value = readFloat64List(measurement, LIVE_LOCATION_MEASUREMENT_POINTER_FIELDS.value);
  return value.length > 0 ? value : null;
}

function readLivePoseXyzMeasurement(
  ref: StructRef & { segmentIndex: number },
  pointerIndex: number,
): { x: number; y: number; z: number } | null {
  if (pointerIndex >= ref.pointerCount) return null;
  const measurement = readStructPointer([ref.segment], 0, pointerFieldOffset(ref, pointerIndex));
  if (!measurement || !getBoolByIndex(measurement, LIVE_POSE_XYZ_FIELDS.validBool)) return null;
  return {
    x: getFloat32ByIndex(measurement, LIVE_POSE_XYZ_FIELDS.x),
    y: getFloat32ByIndex(measurement, LIVE_POSE_XYZ_FIELDS.y),
    z: getFloat32ByIndex(measurement, LIVE_POSE_XYZ_FIELDS.z),
  };
}

function measurementAxis(value: number[] | null, index: number): number | null {
  const axis = value?.[index];
  return typeof axis === "number" && Number.isFinite(axis) ? axis : null;
}

function vectorMagnitude(value: number[] | { x: number; y: number; z: number } | null): number | null {
  if (!value) return null;
  const components = Array.isArray(value) ? value : [value.x, value.y, value.z];
  if (components.length === 0 || components.some((component) => !Number.isFinite(component))) return null;
  return Math.hypot(...components);
}

function readTextField(ref: StructRef & { segmentIndex: number }, pointerIndex: number): string {
  const bytes = readDataField(ref, pointerIndex);
  const textBytes = bytes.at(-1) === 0 ? bytes.slice(0, -1) : bytes;
  return new TextDecoder("utf-8", { fatal: false }).decode(textBytes);
}

function readDataField(ref: StructRef & { segmentIndex: number }, pointerIndex: number): Uint8Array {
  if (pointerIndex >= ref.pointerCount) return new Uint8Array();
  return readDataPointer(ref.segment, pointerFieldOffset(ref, pointerIndex));
}

function readDataPointer(segment: SegmentData, pointerOffset: number): Uint8Array {
  const list = readListPointer(segment, pointerOffset);
  if (!list) return new Uint8Array();
  if (list.elementSize !== 2) {
    throw new Error(`Expected byte list, got Cap'n Proto element size ${list.elementSize}.`);
  }
  return list.segment.bytes.slice(list.offset, list.offset + list.elementCount);
}

function readDataListField(ref: StructRef & { segmentIndex: number }, pointerIndex: number): Uint8Array[] {
  if (pointerIndex >= ref.pointerCount) return [];
  const list = readListPointer(ref.segment, pointerFieldOffset(ref, pointerIndex));
  if (!list) return [];
  if (list.elementSize !== 6) {
    throw new Error(`Expected pointer list, got Cap'n Proto element size ${list.elementSize}.`);
  }

  const values: Uint8Array[] = [];
  for (let i = 0; i < list.elementCount; i += 1) {
    values.push(readDataPointer(list.segment, list.offset + i * WORD_SIZE));
  }
  return values;
}

function readStructListPointer(segment: SegmentData, pointerOffset: number): StructListRef | null {
  const list = readListPointer(segment, pointerOffset);
  if (!list) return null;
  if (list.elementSize !== 7) {
    throw new Error(`Expected composite struct list, got Cap'n Proto element size ${list.elementSize}.`);
  }

  const tag = readUint64(list.segment.bytes, list.offset);
  if ((tag & 0x3n) !== 0n) {
    throw new Error("Unsupported non-struct composite list tag.");
  }
  const elementCount = Number((tag >> 2n) & 0x3fffffffn);
  const dataWords = Number((tag >> 32n) & 0xffffn);
  const pointerCount = Number((tag >> 48n) & 0xffffn);
  const elementWords = dataWords + pointerCount;
  const items: Array<StructRef & { segmentIndex: number }> = [];
  let dataOffset = list.offset + WORD_SIZE;
  for (let i = 0; i < elementCount; i += 1) {
    const pointerSectionOffset = dataOffset + dataWords * WORD_SIZE;
    items.push({
      segment: list.segment,
      segmentIndex: 0,
      dataOffset,
      pointerOffset: pointerSectionOffset,
      dataWords,
      pointerCount,
    });
    dataOffset += elementWords * WORD_SIZE;
  }
  return { items, dataWords, pointerCount };
}

function readListPointer(segment: SegmentData, pointerOffset: number): ListRef | null {
  const raw = readUint64(segment.bytes, pointerOffset);
  if (raw === 0n) return null;
  if ((raw & 0x3n) !== 1n) {
    throw new Error("Unsupported non-list Cap'n Proto pointer in liveCalibration.");
  }

  const offsetWords = signed30(Number((raw >> 2n) & 0x3fffffffn));
  const elementSize = Number((raw >> 32n) & 0x7n);
  const elementCount = Number((raw >> 35n) & 0x1fffffffn);
  return {
    segment,
    offset: pointerOffset + WORD_SIZE + offsetWords * WORD_SIZE,
    elementSize,
    elementCount,
  };
}

function getBoolByIndex(ref: StructRef, bitIndex: number): boolean {
  const byte = ref.segment.bytes[ref.dataOffset + Math.floor(bitIndex / 8)] ?? 0;
  return (byte & (1 << (bitIndex % 8))) !== 0;
}

function getUint8ByIndex(ref: StructRef, index: number): number {
  const offset = ref.dataOffset + index;
  if (offset + 1 > ref.dataOffset + ref.dataWords * WORD_SIZE) return 0;
  const view = new DataView(ref.segment.bytes.buffer, ref.segment.bytes.byteOffset, ref.segment.bytes.byteLength);
  return view.getUint8(offset);
}

function getUint16ByIndex(ref: StructRef, index: number): number {
  const offset = ref.dataOffset + index * 2;
  if (offset + 2 > ref.dataOffset + ref.dataWords * WORD_SIZE) return 0;
  const view = new DataView(ref.segment.bytes.buffer, ref.segment.bytes.byteOffset, ref.segment.bytes.byteLength);
  return view.getUint16(offset, true);
}

function getUint32ByIndex(ref: StructRef, index: number): number {
  const offset = ref.dataOffset + index * 4;
  if (offset + 4 > ref.dataOffset + ref.dataWords * WORD_SIZE) return 0;
  const view = new DataView(ref.segment.bytes.buffer, ref.segment.bytes.byteOffset, ref.segment.bytes.byteLength);
  return view.getUint32(offset, true);
}

function getFloat32ByIndex(ref: StructRef, index: number): number {
  const offset = ref.dataOffset + index * 4;
  if (offset + 4 > ref.dataOffset + ref.dataWords * WORD_SIZE) return 0;
  const view = new DataView(ref.segment.bytes.buffer, ref.segment.bytes.byteOffset, ref.segment.bytes.byteLength);
  return view.getFloat32(offset, true);
}

function getBigUint64ByIndex(ref: StructRef, index: number): bigint {
  const offset = ref.dataOffset + index * 8;
  if (offset + 8 > ref.dataOffset + ref.dataWords * WORD_SIZE) return 0n;
  const view = new DataView(ref.segment.bytes.buffer, ref.segment.bytes.byteOffset, ref.segment.bytes.byteLength);
  return view.getBigUint64(offset, true);
}

function readUint64(bytes: Uint8Array, byteOffset: number): bigint {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return view.getBigUint64(byteOffset, true);
}

function getBigUint64(ref: StructRef, relativeOffset: number): bigint {
  const view = new DataView(ref.segment.bytes.buffer, ref.segment.bytes.byteOffset, ref.segment.bytes.byteLength);
  return view.getBigUint64(ref.dataOffset + relativeOffset, true);
}

function getUint16(ref: StructRef, relativeOffset: number): number {
  const view = new DataView(ref.segment.bytes.buffer, ref.segment.bytes.byteOffset, ref.segment.bytes.byteLength);
  return view.getUint16(ref.dataOffset + relativeOffset, true);
}

function getInt32(ref: StructRef, relativeOffset: number): number {
  const view = new DataView(ref.segment.bytes.buffer, ref.segment.bytes.byteOffset, ref.segment.bytes.byteLength);
  return view.getInt32(ref.dataOffset + relativeOffset, true);
}

function getInt8(ref: StructRef, relativeOffset: number): number {
  const view = new DataView(ref.segment.bytes.buffer, ref.segment.bytes.byteOffset, ref.segment.bytes.byteLength);
  return view.getInt8(ref.dataOffset + relativeOffset);
}

function signed30(value: number): number {
  return value & 0x20000000 ? value - 0x40000000 : value;
}

function formatHexBytes(bytes: Uint8Array): string {
  if (bytes.length === 0) return "";
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join(" ");
}

function formatPrintableBytes(bytes: Uint8Array): string {
  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  const printable = text.replace(/\0/g, "").replace(/[^\x20-\x7e]/g, ".");
  return printable.trim();
}

function formatPythonBytes(bytes: Uint8Array): string {
  const escaped = [...bytes]
    .map((byte) => {
      if (byte === 0x27) return "\\'";
      if (byte === 0x5c) return "\\\\";
      if (byte >= 0x20 && byte <= 0x7e) return String.fromCharCode(byte);
      return `\\x${byte.toString(16).padStart(2, "0")}`;
    })
    .join("");
  return `b'${escaped}'`;
}

function ecuName(value: number): string {
  return ECU_NAMES[value] ?? `ecu ${value}`;
}
