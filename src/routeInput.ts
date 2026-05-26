export const ROUTE_QUERY_PARAM = "route";

export interface ParsedRouteInput {
  routeName: string;
  dongleId: string;
  routeId: string;
  source: "route" | "connect-url";
}

export function parseRouteInput(input: string): ParsedRouteInput {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Paste a public comma Connect URL or route name first.");

  if (trimmed.startsWith("https://connect.comma.ai/")) {
    const url = new URL(trimmed);
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length < 2) {
      throw new Error("Connect URLs need at least /<dongle>/<route> in the path.");
    }
    const [dongleId, routeId] = parts;
    return {
      routeName: `${dongleId}|${routeId}`,
      dongleId,
      routeId,
      source: "connect-url",
    };
  }

  const routeName = trimmed.replace("/", "|");
  const [dongleId, routeId] = routeName.split("|");
  if (!dongleId || !routeId) {
    throw new Error("Route names should look like dongle_id|route_id.");
  }

  return {
    routeName,
    dongleId,
    routeId,
    source: "route",
  };
}

export function routeInputFromUrl(urlLike: string | URL): string | null {
  const url = typeof urlLike === "string" ? new URL(urlLike, "https://example.test") : urlLike;
  const rawRoute = url.searchParams.get(ROUTE_QUERY_PARAM);
  if (!rawRoute?.trim()) return null;
  try {
    return parseRouteInput(rawRoute).routeName;
  } catch {
    return null;
  }
}

export function buildRouteShareUrl(origin: string, basePath: string, routeInput: string): string {
  const routeName = parseRouteInput(routeInput).routeName;
  const url = new URL(basePath || "/", origin);
  url.searchParams.set(ROUTE_QUERY_PARAM, routeName);
  return url.toString();
}

export function buildAuthCallbackCleanUrl(currentHref: string, basePath: string): string {
  const currentUrl = new URL(currentHref);
  const cleanedUrl = new URL(basePath || "/", currentUrl.origin);
  const routeName = routeInputFromUrl(currentUrl);
  if (routeName) cleanedUrl.searchParams.set(ROUTE_QUERY_PARAM, routeName);
  return cleanedUrl.toString();
}
