import { describe, expect, it } from "vitest";
import { scanRouteForSteeringCenterDiagnostic } from "./scan";

describe("steering center route smoke", () => {
  it(
    "estimates steering center on the Bronco demo route",
    async () => {
      const result = await scanRouteForSteeringCenterDiagnostic("5beb9b58bd12b691|0000010a--a51155e496", () => {});
      console.info("Bronco demo route steering summary", {
        confidence: result.confidence,
        medianSteeringAngleDeg: result.medianSteeringAngleDeg,
        stableWindows: result.stableWindows.length,
        scannedSegments: result.scannedSegments,
        totalCarStateMessages: result.totalCarStateMessages,
        qualifyingSampleCount: result.qualifyingSampleCount,
      });
      expect(result.totalCarStateMessages).toBeGreaterThan(0);
      expect(result.scannedSegments).toBeGreaterThan(0);
      expect(result.stableWindows.length).toBeGreaterThan(0);
      expect(result.medianSteeringAngleDeg).not.toBeNull();
      expect(result.confidence).not.toBe("none");
      expect(result.caveats.length).toBeGreaterThan(0);
    },
    60_000,
  );

  it(
    "runs on the submitted problem route",
    async () => {
      const result = await scanRouteForSteeringCenterDiagnostic(
        "https://connect.comma.ai/5204c516142a0bd2/00000017--6da71e4c31/340/367",
        () => {},
      );
      console.info("Submitted route steering summary", {
        confidence: result.confidence,
        medianSteeringAngleDeg: result.medianSteeringAngleDeg,
        stableWindows: result.stableWindows.length,
        scannedSegments: result.scannedSegments,
        totalCarStateMessages: result.totalCarStateMessages,
        qualifyingSampleCount: result.qualifyingSampleCount,
        stableDurationSec: result.stableDurationSec,
      });
      expect(result.totalCarStateMessages).toBeGreaterThan(0);
      expect(result.scannedSegments).toBeGreaterThan(0);
      expect(result.stableWindows.length).toBeGreaterThan(0);
      expect(result.medianSteeringAngleDeg).not.toBeNull();
      expect(result.confidence).not.toBe("none");
      expect(result.caveats.length).toBeGreaterThan(0);
    },
    60_000,
  );
});
