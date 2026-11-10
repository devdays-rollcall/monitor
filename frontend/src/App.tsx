import { type FormEvent, useRef, useState } from 'react';
import { ArrowRight, Compass, LogOut, Map as MapIcon, RefreshCw } from 'lucide-react';
import { getEvents, type EventOutput } from './generated';
import MapView, { formatTime, type MemberRoute } from './MapView';
import { Brand, EmptyMap, Header, InlineError, LoginAction, LoginCard, MapArea, Member, MemberList, Secondary, SectionLabel, Shell, Sidebar, SideActions, Subtle, Swatch, TokenInput, Welcome, Workspace } from './styles';

const palette = ['#d05e39', '#247caa', '#8b54a5', '#2c8b67', '#c08a19', '#ba4976', '#4d69ab', '#a75639', '#668a24', '#008b8f', '#9a5c8d', '#827034'];
const plurals = new Intl.PluralRules('ru-RU');

function countLabel(count: number, one: string, few: string, many: string): string {
  const form = plurals.select(count);
  return `${count} ${form === 'one' ? one : form === 'few' ? few : many}`;
}

function colorFor(id: string, assigned: Map<string, string>): string {
  const existing = assigned.get(id);

  if (existing) return existing;

  let hash = 0;

  for (const character of id) hash = (Math.imul(hash, 31) + character.charCodeAt(0)) >>> 0;

  const taken = new Set(assigned.values());
  let color = palette[hash % palette.length];

  for (let offset = 0; offset < palette.length && taken.has(color); offset += 1) {
    color = palette[(hash + offset + 1) % palette.length];
  }

  if (taken.has(color)) color = `hsl(${hash % 360} 70% 36%)`;

  assigned.set(id, color);
  return color;
}

function routesFor(events: EventOutput[], assigned: Map<string, string>): MemberRoute[] {
  const members = new Map<string, EventOutput[]>();

  for (const event of events) {
    if (event.type !== 'location') continue;

    const points = members.get(event.member_id) ?? [];
    points.push(event);
    members.set(event.member_id, points);
  }

  return [...members.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([id, points]) => ({
      id,
      color: colorFor(id, assigned),
      events: points.sort((left, right) => Date.parse(left.recorded_at) - Date.parse(right.recorded_at)),
    }));
}

function errorMessage(status: number): string {
  if (status === 401) return 'Проверьте токен группы и попробуйте снова.';
  if (status === 404) return 'Данных группы пока нет. Отправьте события с телефона и попробуйте снова.';
  return 'Не удалось загрузить данные. Проверьте подключение и попробуйте снова.';
}

export default function App() {
  const [input, setInput] = useState('');
  const [token, setToken] = useState('');
  const [events, setEvents] = useState<EventOutput[]>([]);
  const [routes, setRoutes] = useState<MemberRoute[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const colors = useRef(new Map<string, string>());
  const activeRequest = useRef<AbortController | null>(null);

  async function load(groupToken: string, newGroup = false) {
    const normalized = groupToken.trim();

    if (!/^[A-Za-z0-9_-]{43}$/.test(normalized)) {
      setError('Токен должен содержать 43 символа base64url.');
      return;
    }

    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setLoading(true);
    setError('');

    try {
      const allEvents: EventOutput[] = [];
      const seenCursors = new Set<string>();
      let cursor: string | undefined;

      do {
        const result = await getEvents({ auth: normalized, query: { limit: 1000, cursor }, signal: controller.signal });

        if (!result.response?.ok || !result.data) throw new Error(errorMessage(result.response?.status ?? 0));

        allEvents.push(...result.data.events);
        cursor = result.data.next_cursor ?? undefined;

        if (cursor && seenCursors.has(cursor)) throw new Error('Не удалось загрузить все страницы событий. Попробуйте обновить данные.');
        if (cursor) seenCursors.add(cursor);
      } while (cursor);

      if (newGroup) colors.current.clear();

      setEvents(allEvents);
      setRoutes(routesFor(allEvents, colors.current));
      setToken(normalized);
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof Error && reason.message !== 'Failed to fetch' ? reason.message : errorMessage(0));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  function openGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void load(input, true);
  }

  function closeGroup() {
    activeRequest.current?.abort();
    colors.current.clear();
    setInput('');
    setToken('');
    setEvents([]);
    setRoutes([]);
    setError('');
    setLoading(false);
  }

  return (
    <Shell>
      <Header>
        <Brand><Compass size={24} strokeWidth={1.8} /> Маршруты группы</Brand>
      </Header>
      {!token ? (
        <Welcome>
          <LoginCard onSubmit={openGroup}>
            <h1>Открыть карту</h1>
            <p>Введите токен, который передал вам лидер группы.</p>
            <label htmlFor="group-token">Токен группы</label>
            <TokenInput id="group-token" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Вставьте токен" autoComplete="off" spellCheck={false} />
            {error && <InlineError role="alert">{error}</InlineError>}
            <LoginAction type="submit" disabled={loading}>{loading ? 'Загружаем…' : 'Открыть карту'} <ArrowRight size={17} /></LoginAction>
          </LoginCard>
        </Welcome>
      ) : (
        <Workspace>
          <Sidebar>
            <h1>Ваша группа</h1>
            <Subtle>{countLabel(routes.length, 'участник', 'участника', 'участников')} · {countLabel(events.length, 'точка', 'точки', 'точек')}</Subtle>
            <SideActions>
              <Secondary onClick={() => void load(token)} disabled={loading}><RefreshCw size={15} /> {loading ? 'Загрузка…' : 'Обновить'}</Secondary>
              <Secondary onClick={closeGroup}><LogOut size={15} /> Другая группа</Secondary>
            </SideActions>
            {error && <InlineError role="alert">{error}</InlineError>}
            <SectionLabel><span>Участники</span><span>{routes.length}</span></SectionLabel>
            <MemberList>
              {routes.map((route) => (
                <Member key={route.id}>
                  <Swatch $color={route.color} />
                  <div><strong>{route.id.slice(0, 8)}</strong><small>Последняя точка<br />{formatTime(route.events[route.events.length - 1].recorded_at)}</small></div>
                  <small>{countLabel(route.events.length, 'точка', 'точки', 'точек')}</small>
                </Member>
              ))}
            </MemberList>
            {routes.length === 0 && <Subtle>GPS-точек пока нет.</Subtle>}
          </Sidebar>
          <MapArea aria-label="Карта маршрутов">
            {routes.length > 0 ? <MapView routes={routes} /> : <EmptyMap><MapIcon size={32} /><strong>{events.length ? 'Нет GPS-точек' : 'Пока нет событий'}</strong><p>Отправьте данные с телефона и обновите карту.</p></EmptyMap>}
          </MapArea>
        </Workspace>
      )}
    </Shell>
  );
}
