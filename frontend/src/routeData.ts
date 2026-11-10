import type { Feature, FeatureCollection } from 'geojson';
import type { EventOutput } from './generated';
import type { MemberRoute } from './MapView';

export function routeData(routes: MemberRoute[], selectedMember: string | null): FeatureCollection {
  const features: Feature[] = [];
  const ordered = [...routes].sort((a, b) => Number(a.id === selectedMember) - Number(b.id === selectedMember));

  for (const route of ordered) {
    const properties = { color: route.color, muted: selectedMember !== null && route.id !== selectedMember };
    let segment: number[][] = [];
    let previous: EventOutput | undefined;

    for (const [index, point] of route.events.entries()) {
      const coordinates = [point.data.longitude, point.data.latitude];

      if (previous && Date.parse(point.recorded_at) - Date.parse(previous.recorded_at) > 30 * 60 * 1000) {
        if (segment.length > 1) features.push({ type: 'Feature', properties, geometry: { type: 'LineString', coordinates: segment } });
        segment = [];
      }

      segment.push(coordinates);
      features.push({ type: 'Feature', properties: { ...properties, id: point.id, latest: index === route.events.length - 1, hasBearing: point.data.bearing_deg != null, bearing: point.data.bearing_deg ?? 0 }, geometry: { type: 'Point', coordinates } });
      previous = point;
    }

    if (segment.length > 1) features.push({ type: 'Feature', properties, geometry: { type: 'LineString', coordinates: segment } });
  }

  return { type: 'FeatureCollection', features };
}
