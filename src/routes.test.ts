import { describe, expect, it } from "vitest";
import { parseRouteInput, segmentFromUrl } from "./routes";
import { buildAuthCallbackCleanUrl, buildRouteShareUrl, routeInputFromUrl } from "./routeInput";

describe("route parsing", () => {
  it("accepts route names", () => {
    expect(parseRouteInput("5beb9b58bd12b691|0000010a--a51155e496")).toMatchObject({
      routeName: "5beb9b58bd12b691|0000010a--a51155e496",
      dongleId: "5beb9b58bd12b691",
      routeId: "0000010a--a51155e496",
    });
  });

  it("accepts comma Connect URLs", () => {
    expect(parseRouteInput("https://connect.comma.ai/5beb9b58bd12b691/0000010a--a51155e496")).toMatchObject({
      routeName: "5beb9b58bd12b691|0000010a--a51155e496",
      source: "connect-url",
    });
  });

  it("strips dragged-along clip times from comma Connect URLs", () => {
    expect(parseRouteInput("https://connect.comma.ai/5beb9b58bd12b691/0000010a--a51155e496/90/105")).toMatchObject({
      routeName: "5beb9b58bd12b691|0000010a--a51155e496",
      source: "connect-url",
    });
  });

  it("extracts segment numbers from signed log URLs", () => {
    expect(segmentFromUrl("https://example.test/dongle/route/12/qlog.zst?sig=abc")).toBe(12);
    expect(segmentFromUrl("https://example.test/dongle/route/7/rlog.bz2")).toBe(7);
    expect(segmentFromUrl("https://example.test/dongle/route/1/qcamera.ts?sig=abc")).toBe(1);
  });

  it("builds share URLs from canonical route names", () => {
    expect(
      buildRouteShareUrl("https://example.test", "/op-steering-center-tool/", "5beb9b58bd12b691|0000010a--a51155e496"),
    ).toBe("https://example.test/op-steering-center-tool/?route=5beb9b58bd12b691%7C0000010a--a51155e496");
  });

  it("canonicalizes shared comma Connect URLs", () => {
    expect(
      buildRouteShareUrl(
        "https://example.test",
        "/op-steering-center-tool/",
        "https://connect.comma.ai/5beb9b58bd12b691/0000010a--a51155e496/90/105",
      ),
    ).toBe("https://example.test/op-steering-center-tool/?route=5beb9b58bd12b691%7C0000010a--a51155e496");
  });

  it("reads valid shared route state from URLs", () => {
    expect(routeInputFromUrl("https://example.test/?route=5beb9b58bd12b691%7C0000010a--a51155e496")).toBe(
      "5beb9b58bd12b691|0000010a--a51155e496",
    );
  });

  it("ignores empty or invalid shared route state", () => {
    expect(routeInputFromUrl("https://example.test/?route=")).toBeNull();
    expect(routeInputFromUrl("https://example.test/?route=not-a-route")).toBeNull();
  });

  it("preserves shared route state when cleaning OAuth callback params", () => {
    expect(
      buildAuthCallbackCleanUrl(
        "https://example.test/?code=oauth-code&provider=g&route=5beb9b58bd12b691%7C0000010a--a51155e496",
        "/op-steering-center-tool/",
      ),
    ).toBe("https://example.test/op-steering-center-tool/?route=5beb9b58bd12b691%7C0000010a--a51155e496");
  });
});
