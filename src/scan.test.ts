import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CalibrationMessage, FingerprintLogMessages } from "./capnp";
import { findCarStateMessages, findDeviceType, findFingerprintLogMessages, findSteeringContextMessages } from "./capnp";
import { decompressLog } from "./decompress";
import { scanRouteForFingerprintDebug, scanRouteForInvalidCalibration, scanRouteForSteeringCenterDiagnostic } from "./scan";

vi.mock("./decompress", () => ({
  decompressLog: vi.fn((bytes: Uint8Array, url: string) => {
    if (url.includes("/1/qlog.zst")) throw new Error("unexpected EOF");
    return bytes;
  }),
}));

vi.mock("./capnp", () => ({
  findDeviceType: vi.fn(() => "mici"),
  findFingerprintLogMessages: vi.fn(() => ({
    initData: null,
    deviceType: null,
    carParams: [],
    onroadEvents: [],
    canMessages: [],
  })),
  findCarStateMessages: vi.fn(() => []),
  findSteeringContextMessages: vi.fn(() => ({
    controlsState: [],
    carControl: [],
    lateralPlan: [],
    liveLocationKalman: [],
    livePose: [],
    modelV2: [],
  })),
  findCalibrationMessages: vi.fn(() => [
    {
      logMonoTime: 1n,
      status: 1,
      statusName: "calibrated",
      calPerc: 100,
      validBlocks: 20,
      rpyCalib: [0, 0, 0],
      rpyCalibSpread: [],
      wideFromDeviceEuler: [],
      height: [],
    } satisfies CalibrationMessage,
  ]),
}));

function emptyFingerprintLogMessages(): FingerprintLogMessages {
  return {
    initData: null,
    deviceType: null,
    carParams: [],
    onroadEvents: [],
    canMessages: [],
  };
}

describe("full route scan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/files")) {
          return Response.json({
            qlogs: ["https://example.test/route/0/qlog.zst", "https://example.test/route/1/qlog.zst"],
            qcameras: ["https://example.test/route/0/qcamera.ts", "https://example.test/route/1/qcamera.ts"],
          });
        }
        if (url.endsWith("/v1/route/test%7Croute/")) {
          return Response.json({ fullname: "test|route" });
        }
        return new Response(new Uint8Array([1]));
      }),
    );
  });

  it("reports unreadable segments as an incomplete scan instead of throwing", async () => {
    const result = await scanRouteForInvalidCalibration("test|route", () => {});

    expect(result.resultType).toBe("incomplete");
    expect(result.reason).toBe("scan-incomplete");
    expect(result.scannedSegments).toBe(1);
    expect(result.totalSegments).toBe(2);
    expect(result.readFailures).toMatchObject([
      {
        segment: 1,
        message: "unexpected EOF while decompressing; this log segment looks truncated",
      },
    ]);
    expect(result.routeInfo?.deviceType).toBe("mici");
    expect(result.qcameraPreview).toMatchObject({
      logUrl: "https://example.test/route/1/qcamera.ts",
      reason: "unreadable-segment",
      segment: 1,
    });
    expect(findDeviceType).toHaveBeenCalledTimes(1);
    expect(decompressLog).toHaveBeenCalledTimes(2);
  });

  it("builds recognized fingerprint reports with public firmware and redacted VIN", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/files")) {
          return Response.json({
            qlogs: ["https://example.test/route/0/qlog.zst"],
          });
        }
        if (url.endsWith("/v1/route/test%7Croute/")) {
          return Response.json({ fullname: "test|route", git_branch: "release-c3" });
        }
        return new Response(new Uint8Array([0]));
      }),
    );
    vi.mocked(findFingerprintLogMessages).mockReturnValue({
      initData: {
        logMonoTime: 1n,
        deviceType: "mici",
        version: "0.9.9",
        gitCommit: "abcdef123456",
        gitBranch: "release-c3",
        gitRemote: "https://github.com/commaai/openpilot",
        gitSrcCommit: "",
      },
      deviceType: "mici",
      carParams: [
        {
          logMonoTime: 2n,
          brand: "hyundai",
          carFingerprint: "KIA OPTIMA 2020",
          fuzzyFingerprint: false,
          notCar: false,
          carVin: "KNAGT4LEXLA000001",
          dashcamOnly: false,
          passive: false,
          openpilotLongitudinalControl: true,
          fingerprintSource: 1,
          fingerprintSourceName: "fw",
          carFw: [
            {
              ecu: 3,
              ecuName: "fwdCamera",
              fwVersionBytes: [72, 68, 65, 50],
              fwVersionPython: "b'HDA2'",
              fwVersionText: "HDA2",
              address: 0x7c4,
              subAddress: 0,
              responseAddress: 0x7cc,
              request: [],
              brand: "hyundai",
              bus: 1,
            },
          ],
        },
      ],
      onroadEvents: [{ logMonoTime: 3n, name: 60, nameText: "startup" }],
      canMessages: [{ logMonoTime: 4n, address: 0x5a0, src: 1, dataLength: 8 }],
    });

    const result = await scanRouteForFingerprintDebug("test|route", () => {});

    expect(result.resultType).toBe("recognized");
    expect(result.carParams?.carFingerprint).toBe("KIA OPTIMA 2020");
    expect(result.carParams?.carVin).toMatchObject({
      value: "KNAGT4LEXLA000001",
      redacted: "KNA***********001",
    });
    expect(result.carParams?.carFw[0].pythonSnippet).toBe("(Ecu.fwdCamera, 0x7c4, None): [\n  b'HDA2',\n],");
    expect(result.canEvidence).toMatchObject([{ src: 1, address: 0x5a0, dataLength: 8, count: 1 }]);
    expect(result.recommendations.map((recommendation) => recommendation.kind)).toEqual(["stock-openpilot", "sunnypilot"]);
  });

  it("suggests stock, SunnyPilot, and fork context paths for unrecognized routes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/files")) {
          return Response.json({ qlogs: ["https://example.test/route/0/qlog.zst"] });
        }
        if (url.endsWith("/v1/route/test%7Croute/")) {
          return Response.json({ fullname: "test|route" });
        }
        return new Response(new Uint8Array([0]));
      }),
    );
    vi.mocked(findFingerprintLogMessages).mockReturnValue({
      ...emptyFingerprintLogMessages(),
      initData: {
        logMonoTime: 1n,
        deviceType: "mici",
        version: "sunny-dev",
        gitCommit: "",
        gitBranch: "sunnypilot-dev",
        gitRemote: "https://github.com/sunnypilot/sunnypilot",
        gitSrcCommit: "",
      },
      onroadEvents: [{ logMonoTime: 2n, name: 54, nameText: "carUnrecognized" }],
      canMessages: [{ logMonoTime: 3n, address: 0x123, src: 0, dataLength: 8 }],
    });

    const result = await scanRouteForFingerprintDebug("test|route", () => {});

    expect(result.resultType).toBe("unrecognized");
    expect(result.recommendations.map((recommendation) => recommendation.kind)).toEqual(["stock-openpilot", "sunnypilot", "fork-context"]);
    expect(result.recommendations[1].body).toContain("SunnyLink");
    expect(result.recommendations[2].body).toContain("does not choose or recommend");
  });

  it("samples only the first log segment for fingerprint debugging", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/files")) {
        return Response.json({
          qlogs: [
            "https://example.test/route/0/qlog.zst",
            "https://example.test/route/1/qlog.zst",
            "https://example.test/route/2/qlog.zst",
          ],
        });
      }
      if (url.endsWith("/v1/route/test%7Croute/")) {
        return Response.json({ fullname: "test|route" });
      }
      return new Response(new Uint8Array([0]));
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.mocked(findFingerprintLogMessages).mockReturnValue({
      ...emptyFingerprintLogMessages(),
      carParams: [
        {
          logMonoTime: 1n,
          brand: "hyundai",
          carFingerprint: "KIA NIRO EV 2023",
          fuzzyFingerprint: false,
          notCar: false,
          carVin: "",
          dashcamOnly: false,
          passive: false,
          openpilotLongitudinalControl: false,
          fingerprintSource: 0,
          fingerprintSourceName: "can",
          carFw: [],
        },
      ],
    });

    const result = await scanRouteForFingerprintDebug("test|route", () => {});

    expect(result.scannedSegments).toBe(1);
    expect(result.totalSegments).toBe(3);
    expect(fetchMock).not.toHaveBeenCalledWith("https://example.test/route/1/qlog.zst");
    expect(fetchMock).not.toHaveBeenCalledWith("https://example.test/route/2/qlog.zst");
  });

  it("estimates steering center from stable straight-driving carState windows", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/files")) {
          return Response.json({
            logs: ["https://example.test/route/0/rlog.zst", "https://example.test/route/1/rlog.zst"],
          });
        }
        if (url.endsWith("/v1/route/test%7Croute/")) {
          return Response.json({ fullname: "test|route" });
        }
        return new Response(new Uint8Array([0]));
      }),
    );
    vi.mocked(findFingerprintLogMessages).mockReturnValue({
      ...emptyFingerprintLogMessages(),
      initData: {
        logMonoTime: 1n,
        deviceType: "mici",
        version: "0.9.9",
        gitCommit: "",
        gitBranch: "release",
        gitRemote: "https://github.com/commaai/openpilot",
        gitSrcCommit: "",
      },
      deviceType: "mici",
    });
    vi.mocked(findSteeringContextMessages).mockReturnValue({
      controlsState: [],
      carControl: [],
      lateralPlan: [],
      liveLocationKalman: [],
      livePose: [],
      modelV2: [],
    });
    vi.mocked(findCarStateMessages).mockImplementation(() =>
      Array.from({ length: 80 }, (_, index) => ({
        logMonoTime: BigInt(index) * 100_000_000n,
        vEgo: 22,
        aEgo: 0,
        yawRate: 0,
        steeringAngleDeg: index % 2 === 0 ? 1.4 : 1.6,
        steeringRateDeg: 0.2,
        steeringTorque: 3,
        steeringPressed: false,
        standstill: false,
        leftBlinker: false,
        rightBlinker: false,
      })),
    );

    const result = await scanRouteForSteeringCenterDiagnostic("test|route", () => {});

    expect(result.resultType).toBe("estimated");
    expect(result.confidence).not.toBe("none");
    expect(result.medianSteeringAngleDeg).toBeCloseTo(1.5);
    expect(result.estimateStats.sampleMedianSteeringAngleDeg).toBeCloseTo(1.5);
    expect(result.estimateStats.weightedMedianSteeringAngleDeg).toBeCloseTo(1.5);
    expect(result.sensitivity.speedBuckets.length).toBeGreaterThan(0);
    expect(result.classification.label.length).toBeGreaterThan(0);
    expect(result.stableWindows.length).toBeGreaterThan(0);
    expect(result.filters.minSpeedMps).toBe(8);
    expect(result.signalAvailability.samplesWithAnyContext).toBe(0);
    expect(result.caveats.join(" ")).toContain("not a mechanical alignment diagnosis");
  });

  it("fast-fails steering diagnostics when only qlogs are uploaded", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/files")) {
          return Response.json({ qlogs: ["https://example.test/route/0/qlog.zst"] });
        }
        if (url.endsWith("/v1/route/test%7Croute/")) {
          return Response.json({ fullname: "test|route" });
        }
        return new Response(new Uint8Array([0]));
      }),
    );

    await expect(scanRouteForSteeringCenterDiagnostic("test|route", () => {})).rejects.toThrow(
      "This diagnostic requires uploaded rlogs",
    );
  });
});
