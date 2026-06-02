const allowedReturnPathnames = new Set(["/", "/admin", "/regions", "/saved-places", "/recent-places", "/visits"]);

export function safePlaceReturnHref(value: string | string[] | undefined) {
  const candidate = textParam(value);
  if (!candidate || candidate.startsWith("//") || !candidate.startsWith("/")) return "/";

  try {
    const url = new URL(candidate, "https://aigo.local");
    if (url.origin !== "https://aigo.local" || !allowedReturnPathnames.has(url.pathname)) return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}

function textParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
