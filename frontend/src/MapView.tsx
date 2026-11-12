import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as maplibregl from 'maplibre-gl';
import { type GeoJSONSource, LngLatBounds, setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import type { EventOutput } from './generated';
import { readMapView, updateUrl } from './urlState';
import { routeData } from './routeData';

setWorkerUrl(workerUrl);

export type MemberRoute = {
  id: string;
  color: string;
  username?: string | null;
  events: EventOutput[];
};

export function formatTime(value: string): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export function memberLabel(id: string, username?: string | null): string {
  return username ? `${username} (${id})` : id;
}

function PointDetails({ point, username }: { point: EventOutput; username?: string | null }) {
  const { latitude, longitude, accuracy_m, altitude_m, speed_mps, bearing_deg, battery_percent, ...extra } = point.data;
  const hasReadings = speed_mps != null || bearing_deg != null || battery_percent != null || Object.keys(extra).length > 0;

  return <div className="point-details">
    <header className="point-heading">
      <h2>Точка маршрута</h2>
      <time dateTime={point.recorded_at}>{formatTime(point.recorded_at)}</time>
    </header>
    <div className="point-scroll" onKeyDown={(event) => {
      if (event.target instanceof HTMLElement && event.target.matches('.point-detail-long dd') && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) event.stopPropagation();
    }}>
    <section aria-label="Местоположение">
      <h3>Местоположение</h3>
      <dl>
        <div><dt>Широта</dt><dd>{latitude}</dd></div>
        <div><dt>Долгота</dt><dd>{longitude}</dd></div>
        {accuracy_m != null && <div><dt>Точность</dt><dd>{accuracy_m} м</dd></div>}
        {altitude_m != null && <div><dt>Высота</dt><dd>{altitude_m} м</dd></div>}
      </dl>
    </section>
    <section aria-label="Показания">
      <h3>Показания</h3>
      <dl>
        {speed_mps != null && <div><dt>Скорость</dt><dd>{speed_mps} м/с</dd></div>}
        {bearing_deg != null && <div><dt>Направление</dt><dd>{bearing_deg}°</dd></div>}
        {battery_percent != null && <div><dt>Батарея</dt><dd className="point-battery" style={{ color: `hsl(${battery_percent * 1.2} 65% 30%)` }}>{battery_percent}%</dd></div>}
        {Object.entries(extra).map(([name, value]) => <div className="point-detail-long" key={name}><dt>{name}</dt><dd tabIndex={0} aria-label={name}>{JSON.stringify(value)}</dd></div>)}
      </dl>
      {!hasReadings && <p className="point-empty">Нет данных</p>}
    </section>
    <section aria-label="Сведения о событии">
      <h3>Событие</h3>
      <dl>
        <div><dt>Тип</dt><dd>Координаты</dd></div>
        <div className="point-detail-long"><dt>Участник</dt><dd tabIndex={0} aria-label="Участник">{memberLabel(point.member_id, username ?? point.username)}</dd></div>
        <div className="point-detail-long"><dt>Событие</dt><dd tabIndex={0} aria-label="Событие">{point.id}</dd></div>
        <div className="point-detail-long"><dt>Записано</dt><dd tabIndex={0} aria-label="Записано"><time dateTime={point.recorded_at}>{point.recorded_at}</time></dd></div>
        <div className="point-detail-long"><dt>Получено</dt><dd tabIndex={0} aria-label="Получено"><time dateTime={point.received_at}>{point.received_at}</time></dd></div>
      </dl>
    </section>
    </div>
  </div>;
}

export default function MapView({ routes, selectedMember }: { routes: MemberRoute[]; selectedMember: string | null }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const currentRoutes = useRef(routes);
  const currentSelection = useRef(selectedMember);
  const [point, setPoint] = useState<EventOutput | null>(null);
  const [popupContent] = useState(() => document.createElement('div'));
  const previousSelection = useRef(selectedMember);
  const keyboardIndex = useRef(new Map<string, number>());
  currentRoutes.current = routes;
  currentSelection.current = selectedMember;

  useEffect(() => {
    if (!container.current) return;

    const initialView = readMapView();
    const first = currentRoutes.current[0].events[0].data;
    const instance = new maplibregl.Map({
      container: container.current,
      style: 'https://styles.maptoolkit.org/hiking.json',
      center: initialView ? [initialView.center[1], initialView.center[0]] : [first.longitude, first.latitude],
      zoom: initialView?.zoom ?? 12,
      maxZoom: 19,
      attributionControl: false,
      dragRotate: false,
      touchPitch: false,
    });
    map.current = instance;
    instance.touchZoomRotate.disableRotation();
    instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    if (!initialView) {
      const points = currentRoutes.current.flatMap((route) => route.events);
      if (points.length === 1) {
        instance.jumpTo({ center: [first.longitude, first.latitude], zoom: 14 });
      } else {
        const bounds = new LngLatBounds();
        points.forEach(({ data }) => bounds.extend([data.longitude, data.latitude]));
        instance.fitBounds(bounds, { padding: { top: 72, left: window.matchMedia('(min-width: 761px)').matches ? 328 : 36, right: 36, bottom: 36 }, maxZoom: 15, duration: 0 });
      }
    }

    instance.on('moveend', () => {
      const center = instance.getCenter().wrap();
      updateUrl({ lat: center.lat.toFixed(5), lon: center.lng.toFixed(5), zoom: instance.getZoom().toFixed(2) });
    });

    instance.on('load', () => {
      const canvas = document.createElement('canvas');
      canvas.width = 16;
      canvas.height = 16;
      const context = canvas.getContext('2d');
      if (context) {
        context.fillStyle = '#fff';
        context.beginPath();
        context.moveTo(8, 2);
        context.lineTo(12, 13);
        context.lineTo(8, 10.5);
        context.lineTo(4, 13);
        context.closePath();
        context.fill();
        instance.addImage('route-direction', context.getImageData(0, 0, 16, 16));
      }

      instance.addSource('routes', { type: 'geojson', data: routeData(currentRoutes.current, currentSelection.current) });
      instance.addLayer({ id: 'route-lines', type: 'line', source: 'routes', filter: ['==', ['geometry-type'], 'LineString'], paint: { 'line-color': ['get', 'color'], 'line-width': 3, 'line-opacity': ['case', ['get', 'muted'], 0.18, 0.9] } });
      instance.addLayer({ id: 'route-points', type: 'circle', source: 'routes', filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-color': ['get', 'color'], 'circle-radius': ['step', ['zoom'], ['case', ['get', 'latest'], 8, 2], 13, ['case', ['get', 'latest'], 8, ['get', 'hasBearing'], 6, 4]], 'circle-opacity': ['case', ['get', 'muted'], 0.15, 0.85], 'circle-stroke-width': ['case', ['get', 'latest'], 3, 0], 'circle-stroke-color': '#ffffff', 'circle-stroke-opacity': ['case', ['get', 'muted'], 0.2, 1] } });
      if (context) {
        const layout = { 'icon-image': 'route-direction', 'icon-size': 0.75, 'icon-rotate': ['get', 'bearing'] as maplibregl.ExpressionSpecification, 'icon-rotation-alignment': 'map' as const, 'icon-allow-overlap': true, 'icon-ignore-placement': true };
        const paint = { 'icon-opacity': ['case', ['get', 'muted'], 0.2, 1] as maplibregl.ExpressionSpecification };
        instance.addLayer({ id: 'route-directions-latest', type: 'symbol', source: 'routes', filter: ['all', ['==', ['geometry-type'], 'Point'], ['get', 'hasBearing'], ['get', 'latest']], layout, paint });
        instance.addLayer({ id: 'route-directions-history', type: 'symbol', source: 'routes', minzoom: 13, filter: ['all', ['==', ['geometry-type'], 'Point'], ['get', 'hasBearing'], ['!', ['get', 'latest']]], layout, paint });
      }
      instance.on('click', 'route-points', (event) => {
        const id = event.features?.[0]?.properties?.id;
        const clicked = currentRoutes.current.flatMap((route) => route.events).find((item) => item.id === id);
        if (clicked) setPoint(clicked);
      });
      instance.on('mouseenter', 'route-points', () => { instance.getCanvas().style.cursor = 'pointer'; });
      instance.on('mouseleave', 'route-points', () => { instance.getCanvas().style.cursor = ''; });
    });

    return () => {
      map.current = null;
      instance.remove();
    };
  }, []);

  useEffect(() => {
    const instance = map.current;
    const source = instance?.getSource('routes') as GeoJSONSource | undefined;
    source?.setData(routeData(routes, selectedMember));

    if (instance && selectedMember && previousSelection.current !== selectedMember) {
      const route = routes.find((item) => item.id === selectedMember);
      const data = route?.events[route.events.length - 1].data;
      if (data && !instance.getBounds().contains([data.longitude, data.latitude])) instance.panTo([data.longitude, data.latitude]);
    }

    previousSelection.current = selectedMember;
  }, [routes, selectedMember]);

  useEffect(() => {
    const instance = map.current;
    if (!instance || !point) return;

    if (window.matchMedia('(max-width: 760px)').matches) {
      instance.easeTo({ center: [point.data.longitude, point.data.latitude], offset: [0, instance.getContainer().clientHeight * .25], duration: 0 });
    }

    const popup = new maplibregl.Popup({ maxWidth: '300px', closeButton: true })
      .setLngLat([point.data.longitude, point.data.latitude]).setDOMContent(popupContent).addTo(instance);
    const close = () => setPoint(null);
    popup.on('close', close);
    return () => { popup.off('close', close); popup.remove(); };
  }, [point, popupContent]);

  return <>
    <div ref={container} className="route-map" />
    <div className="map-keyboard-points" aria-label="Точки участников">
      {routes.map((route) => <button key={route.id} type="button" onClick={() => {
        const index = keyboardIndex.current.get(route.id) ?? route.events.length - 1;
        setPoint(route.events[index]);
      }} onKeyDown={(event) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        const index = keyboardIndex.current.get(route.id) ?? route.events.length - 1;
        const next = Math.max(0, Math.min(route.events.length - 1, index + (event.key === 'ArrowRight' ? 1 : -1)));
        keyboardIndex.current.set(route.id, next);
        setPoint(route.events[next]);
      }}>Участник {memberLabel(route.id, route.username)}: открыть точку. Для перехода между точками используйте стрелки.</button>)}
    </div>
    {point && createPortal(<PointDetails point={point} username={routes.find((route) => route.id === point.member_id)?.username} />, popupContent)}
  </>;
}
