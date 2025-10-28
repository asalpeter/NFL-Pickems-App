export function parseCSV(text: string): any[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length === 0) return [];
  const headers = lines[0].split(",").map(h => h.trim());
  return lines.slice(1).map(line => {
    const cols = line.split(",").map(c => c.trim());
    const row: any = {};
    headers.forEach((h, i) => row[h] = cols[i]);
    return row;
  });
}
