export function updateUrl(values: Record<string, string | null>, clearHash = false) {
  const url = new URL(window.location.href);

  for (const [name, value] of Object.entries(values)) {
    if (value === null) url.searchParams.delete(name);
    else url.searchParams.set(name, value);
  }

  if (clearHash) url.hash = '';
  window.history.replaceState(window.history.state, '', url);
}

export function readMapView(): { center: [number, number]; zoom: number } | null {
  const params = new URLSearchParams(window.location.search);
  const values = ['lat', 'lon', 'zoom'].map((name) => params.get(name));
  if (values.some((value) => value === null || value.trim() === '')) return null;

  const [lat, lon, zoom] = values.map(Number);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(zoom)
      || lat < -90 || lat > 90 || lon < -180 || lon > 180 || zoom < 0 || zoom > 19) return null;

  return { center: [lat, lon], zoom };
}
