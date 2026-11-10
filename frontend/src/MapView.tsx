import { Fragment, useEffect, useRef } from 'react';
import { type CircleMarker as LeafletCircleMarker, latLngBounds } from 'leaflet';
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
import type { EventOutput } from './generated';

export type MemberRoute = {
  id: string;
  color: string;
  events: EventOutput[];
};

export function formatTime(value: string): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function FitRoutes({ routes }: { routes: MemberRoute[] }) {
  const map = useMap();

  useEffect(() => {
    const points = routes.flatMap((route) => route.events.map((event) => [event.data.latitude, event.data.longitude] as [number, number]));

    if (points.length === 1) {
      map.setView(points[0], 14);
    } else if (points.length > 1) {
      map.fitBounds(latLngBounds(points), { padding: [36, 36], maxZoom: 15 });
    }
  }, [map, routes]);

  return null;
}

function routeSegments(events: EventOutput[]): [number, number][][] {
  const segments: [number, number][][] = [];
  let previous: EventOutput | undefined;

  for (const event of events) {
    const point: [number, number] = [event.data.latitude, event.data.longitude];

    if (!previous || Date.parse(event.recorded_at) - Date.parse(previous.recorded_at) > 30 * 60 * 1000) {
      segments.push([point]);
    } else {
      segments[segments.length - 1].push(point);
    }

    previous = event;
  }

  return segments;
}

function PointMarker({ point, memberId, color, latest }: { point: EventOutput; memberId: string; color: string; latest: boolean }) {
  const marker = useRef<LeafletCircleMarker>(null);
  const { latitude, longitude, accuracy_m, altitude_m, speed_mps, bearing_deg, battery_percent } = point.data;

  useEffect(() => {
    const layer = marker.current;
    const element = layer?.getElement();

    if (!layer || !element) return;

    element.setAttribute('tabindex', '0');
    element.setAttribute('role', 'button');
    element.setAttribute('aria-label', `Участник ${memberId}, ${formatTime(point.recorded_at)}`);

    const open = (event: Event) => {
      if (event instanceof KeyboardEvent && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        layer.openPopup();
      }
    };

    element.addEventListener('keydown', open);
    return () => element.removeEventListener('keydown', open);
  }, [memberId, point.recorded_at]);

  return (
    <CircleMarker
      ref={marker}
      center={[latitude, longitude]}
      radius={latest ? 8 : 4}
      pathOptions={{ color: latest ? '#fff' : color, weight: latest ? 3 : 1, fillColor: color, fillOpacity: 1 }}
    >
      <Popup>
        <strong>{memberId}</strong>
        <p>{formatTime(point.recorded_at)}</p>
        <p>{latitude.toFixed(5)}, {longitude.toFixed(5)}</p>
        {accuracy_m != null && <p>Точность: {accuracy_m} м</p>}
        {altitude_m != null && <p>Высота: {altitude_m} м</p>}
        {speed_mps != null && <p>Скорость: {speed_mps} м/с</p>}
        {bearing_deg != null && <p>Направление: {bearing_deg}°</p>}
        {battery_percent != null && <p>Батарея: {battery_percent}%</p>}
      </Popup>
    </CircleMarker>
  );
}

export default function MapView({ routes }: { routes: MemberRoute[] }) {
  const first = routes[0].events[0].data;

  return (
    <MapContainer center={[first.latitude, first.longitude]} zoom={12} scrollWheelZoom>
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
      />
      <FitRoutes routes={routes} />
      {routes.map((route) => (
        <Fragment key={route.id}>
          {routeSegments(route.events).map((segment, index) =>
            segment.length > 1 ? <Polyline key={index} positions={segment} pathOptions={{ color: route.color, weight: 3, opacity: 0.85 }} /> : null,
          )}
          {route.events.map((point, index) => (
            <PointMarker key={point.id} point={point} memberId={route.id} color={route.color} latest={index === route.events.length - 1} />
          ))}
        </Fragment>
      ))}
    </MapContainer>
  );
}
