import { isAbsolute, join, relative, sep } from "node:path";

export function resolveBundlePath(root: string, url: string): string | null {
  try {
    const request = new URL(url);
    if (request.protocol !== "app:" || request.host !== "bundle") return null;
    const pathname = decodeURIComponent(request.pathname);
    if (pathname.includes("\0")) return null;
    const file = join(root, pathname);
    const inside = relative(root, file);
    return !inside || inside === ".." || inside.startsWith(`..${sep}`) || isAbsolute(inside) ? null : file;
  } catch {
    return null;
  }
}
