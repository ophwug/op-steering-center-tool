export const API_BASE_URL = "https://api.comma.ai";
export const GITHUB_REPO_URL = "https://github.com/ophwug/op-steering-center-tool";
export const COMMA_JWT_PORTAL_URL = "https://jwt.comma.ai/";
export const OPENPILOT_FINGERPRINTING_URL = "https://github.com/commaai/openpilot/wiki/Fingerprinting";
export const OPENPILOT_NIGHTLY_DEV_INSTALLER_URL = "https://installer.comma.ai/commaai/nightly-dev";
export const SUNNYPILOT_RELEASE_MICI_INSTALLER_URL = "https://install.sunnypilot.ai/release-mici";
export const SUNNYPILOT_VEHICLE_SETTINGS_URL = "https://community.sunnypilot.ai/t/about-the-vehicle-category/3718";
export const SUNNYPILOT_URL = "https://www.sunnypilot.ai/";
export const SUNNYLINK_URL = "https://app.sunnypilot.ai/";
export const HARDCODED_FP_REPO_URL = "https://github.com/hardcoded-fp/openpilot";
export const HARDCODED_FP_BRANCH_INDEX_URL = "https://hardcoded-fp.github.io/openpilot/";

export const OPENPILOT_MASTER_SOURCES = {
  calibrationd:
    "https://github.com/commaai/openpilot/blob/master/selfdrive/locationd/calibrationd.py",
  deviceSettings:
    "https://github.com/commaai/openpilot/blob/master/selfdrive/ui/layouts/settings/device.py",
  logSchema: "https://github.com/commaai/openpilot/blob/master/cereal/log.capnp",
  carSchema: "https://github.com/commaai/opendbc/blob/master/opendbc/car/car.capnp",
  commaApi: "https://api.comma.ai/",
  newConnectFileApi: "https://github.com/commaai/new-connect/blob/master/src/api/file.ts",
};

export const CALIBRATION_LIMITS = {
  default: {
    label: "tici / comma 3 and tizi / comma 3x",
    pitchMinRad: -0.09074112085129739,
    pitchMaxRad: 0.17,
    yawMinRad: -0.06912048084718224,
    yawMaxRad: 0.06912048084718235,
  },
  mici: {
    label: "mici / comma four",
    pitchMinRad: -0.143101,
    pitchMaxRad: 0.22235988,
    yawMinRad: -0.06912048084718224,
    yawMaxRad: 0.06912048084718235,
  },
} as const;

export const CALIBRATION_STATUS_NAMES: Record<number, string> = {
  0: "uncalibrated",
  1: "calibrated",
  2: "invalid",
  3: "recalibrating",
};

export const LIVE_CALIBRATION_UNION_TAG = 18;
export const CAN_UNION_TAG = 4;
export const INIT_DATA_UNION_TAG = 0;
export const CONTROLS_STATE_UNION_TAG = 6;
export const CAR_PARAMS_UNION_TAG = 67;
export const CAR_STATE_UNION_TAG = 21;
export const CAR_CONTROL_UNION_TAG = 22;
export const LATERAL_PLAN_DEPRECATED_UNION_TAG = 63;
export const LIVE_LOCATION_KALMAN_DEPRECATED_UNION_TAG = 70;
export const MODEL_V2_UNION_TAG = 73;
export const LIVE_POSE_UNION_TAG = 127;
export const ONROAD_EVENTS_UNION_TAG = 132;

export const FINGERPRINT_EVENT_NAMES: Record<number, string> = {
  0: "canError",
  43: "commIssue",
  44: "commIssueAvgFreq",
  54: "carUnrecognized",
  60: "startup",
  61: "startupNoCar",
  62: "startupNoControl",
  63: "startupNoSecOcKey",
  64: "startupMaster",
  76: "dashcamMode",
  80: "canBusMissing",
  84: "vehicleSensorsInvalid",
};

export const FINGERPRINT_SOURCE_NAMES: Record<number, string> = {
  0: "can",
  1: "fw",
  2: "fixed",
};
