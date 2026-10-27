/** Minimal reader for (uncompressed) ustar/pax archives, enough for GitHub source tarballs. */
export interface TarEntry {
  path: string;
  data: Buffer;
}

export function* readTar(buf: Buffer, want: (path: string) => boolean = () => true): Generator<TarEntry> {
  let offset = 0;
  let paxPath: string | null = null;
  while (offset + 512 <= buf.length) {
    const header = buf.subarray(offset, offset + 512);
    if (header.every((b) => b === 0)) break;
    const name = cstr(header.subarray(0, 100));
    const size = parseInt(cstr(header.subarray(124, 136)).trim() || "0", 8);
    const type = String.fromCharCode(header[156] || 48);
    const prefix = header.subarray(257, 263).toString("latin1").startsWith("ustar")
      ? cstr(header.subarray(345, 500))
      : "";
    const dataStart = offset + 512;
    const data = buf.subarray(dataStart, dataStart + size);
    offset = dataStart + Math.ceil(size / 512) * 512;
    if (type === "x") {
      paxPath = /(?:^|\n)\d+ path=([^\n]*)\n/.exec(data.toString("utf8"))?.[1] ?? null;
      continue;
    }
    if (type === "g") continue;
    const path = paxPath ?? (prefix ? `${prefix}/${name}` : name);
    paxPath = null;
    if ((type === "0" || type === "\0") && want(path)) yield { path, data: Buffer.from(data) };
  }
}

function cstr(b: Buffer): string {
  const end = b.indexOf(0);
  return b.subarray(0, end === -1 ? b.length : end).toString("utf8");
}
