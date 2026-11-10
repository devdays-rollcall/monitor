import { Button } from '@base-ui/react/button';
import styled, { createGlobalStyle } from 'styled-components';

export const GlobalStyle = createGlobalStyle`
  :root {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    color: #1d1d1f;
    background: #eaf0f2;
    font-synthesis: none;
    --ink: #1d1d1f;
    --muted: #62666d;
    --line: rgba(60, 60, 67, .13);
    --accent: #0066cc;
    --glass: linear-gradient(145deg, rgba(255, 255, 255, .62), rgba(220, 238, 244, .38));
    --glass-edge: rgba(70, 98, 112, .18);
    --glass-shadow: 0 4px 16px rgba(28, 54, 68, .08);
    --glass-blur: blur(32px) saturate(1.8);
  }
  * { box-sizing: border-box; }
  body { margin: 0; min-width: 320px; }
  button, input { font: inherit; }
  .lucide { stroke-width: 1.8; }
  button:focus-visible, input:focus-visible, a:focus-visible { outline: 3px solid #007aff; outline-offset: 3px; }
  .route-map { width: 100%; height: 100%; background: #e6ece7; font: inherit; }
  .maplibregl-ctrl-group { border: 1px solid var(--glass-edge); border-radius: 12px; overflow: hidden; background: var(--glass); -webkit-backdrop-filter: var(--glass-blur); backdrop-filter: var(--glass-blur); }
  .maplibregl-ctrl-group:not(:empty) { box-shadow: var(--glass-shadow); }
  .maplibregl-ctrl-group button { width: 36px; height: 36px; }
  .maplibregl-ctrl-group button .maplibregl-ctrl-icon { background-size: 18px 18px; }
  .maplibregl-ctrl-group button.maplibregl-ctrl-zoom-in .maplibregl-ctrl-icon { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%231d1d1f' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 5v14M5 12h14'/%3E%3C/svg%3E"); }
  .maplibregl-ctrl-group button.maplibregl-ctrl-zoom-out .maplibregl-ctrl-icon { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%231d1d1f' stroke-width='1.8' stroke-linecap='round'%3E%3Cpath d='M5 12h14'/%3E%3C/svg%3E"); }
  @media (hover: hover) { .maplibregl-ctrl-group button:not(:disabled):hover { background-color: rgba(170, 205, 227, .2); } }
  .maplibregl-ctrl-group button:not(:disabled):active { background-color: rgba(143, 188, 216, .32); }
  @media (pointer: coarse) { .maplibregl-ctrl-group button { width: 44px; height: 44px; } }
  .maplibregl-popup-content { border: 1px solid var(--glass-edge); background: var(--glass); -webkit-backdrop-filter: var(--glass-blur); backdrop-filter: var(--glass-blur); border-radius: 18px; box-shadow: var(--glass-shadow); padding: 18px; }
  .maplibregl-popup-content > div { width: min(254px, calc(100vw - 88px)); font-size: 13px; line-height: 1.4; overflow-wrap: anywhere; }
  .point-scroll { max-height: min(320px, 45vh); overflow-y: auto; scrollbar-width: thin; scrollbar-color: rgba(65, 90, 105, .45) transparent; scrollbar-gutter: stable; padding-right: 10px; margin-right: -10px; }
  @media (max-width: 760px) { .point-scroll { max-height: min(190px, 22vh); } }
  .point-heading { padding-right: 32px; padding-bottom: 14px; border-bottom: 1px solid rgba(60, 60, 67, .12); }
  .point-heading h2 { margin: 0 0 4px; font-size: 16px; font-weight: 650; line-height: 1.25; letter-spacing: -.02em; }
  .point-heading time { color: #414b51; font-size: 12px; }
  .point-details section { margin-top: 14px; }
  .point-details h3 { margin: 0 0 5px; color: #39484f; font-size: 12px; font-weight: 650; }
  .point-details dl { margin: 0; }
  .point-details dl > div { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr); gap: 8px; padding: 4px 0; }
  .point-details dt { color: #47545b; }
  .point-details dd { margin: 0; text-align: right; color: var(--ink); font-variant-numeric: tabular-nums; }
  .point-details dd.point-battery { font-weight: 600; }
  .point-detail-long dd { min-width: 0; overflow-x: auto; overscroll-behavior-x: contain; white-space: nowrap; text-align: left; font-size: 12px; scrollbar-width: thin; scrollbar-color: rgba(65, 90, 105, .45) transparent; }
  .point-detail-long dd:focus-visible { outline: 2px solid #687d89; outline-offset: 1px; border-radius: 3px; }
  .maplibregl-popup-content .point-empty { margin: 4px 0 0; color: #47545b; }
  .maplibregl-popup-close-button { top: 8px; right: 8px; width: 28px; height: 28px; border-radius: 8px; font-size: 0; background: center / 18px 18px no-repeat url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2352616a' stroke-width='1.8' stroke-linecap='round'%3E%3Cpath d='M18 6 6 18M6 6l12 12'/%3E%3C/svg%3E"); }
  .map-keyboard-points { position: absolute; top: 70px; right: 16px; z-index: 3; }
  .map-keyboard-points button { position: absolute; width: 1px; height: 1px; padding: 0; overflow: hidden; clip-path: inset(50%); }
  .map-keyboard-points button:focus-visible { right: 0; width: max-content; max-width: min(280px, calc(100vw - 32px)); height: auto; clip-path: none; padding: 8px; background: white; }
  @keyframes glass-enter { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  @media (prefers-reduced-transparency: reduce) {
    .maplibregl-ctrl-group, .maplibregl-popup-content { background: #fff; -webkit-backdrop-filter: none; backdrop-filter: none; }
  }
  @media (prefers-reduced-motion: reduce) { *, *::before, *::after { scroll-behavior: auto !important; animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }
`;

export const Shell = styled.div`
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
`;

export const Header = styled.header`
  position: absolute;
  top: 14px;
  left: 16px;
  height: 38px;
  background: var(--glass);
  -webkit-backdrop-filter: var(--glass-blur);
  backdrop-filter: var(--glass-blur);
  color: var(--ink);
  border: 1px solid var(--glass-edge);
  border-radius: 12px;
  box-shadow: var(--glass-shadow);
  display: flex;
  align-items: center;
  padding: 0;
  z-index: 1000;
  @media (prefers-reduced-transparency: reduce) { background: #fff; -webkit-backdrop-filter: none; backdrop-filter: none; }
  @media (max-width: 760px) { top: 12px; left: 12px; }
`;

export const Brand = styled(Button)`
  display: flex;
  align-items: center;
  gap: 7px;
  height: 100%;
  padding: 0 12px;
  border: 0;
  border-radius: inherit;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font-weight: 650;
  letter-spacing: -.025em;
  font-size: 14px;
  svg { color: var(--accent); }
`;

export const Welcome = styled.main`
  flex: 1;
  display: grid;
  place-items: center;
  padding: 40px 20px;
  background: radial-gradient(ellipse at 15% 15%, #b6e2d9 0, transparent 52%), radial-gradient(ellipse at 85% 80%, #bdcff2 0, transparent 53%), #e9f1f2;
`;

export const LoginCard = styled.form`
  width: min(370px, 100%);
  background: var(--glass);
  -webkit-backdrop-filter: var(--glass-blur);
  backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-edge);
  border-radius: 20px;
  padding: 26px;
  box-shadow: var(--glass-shadow);
  animation: glass-enter .35s ease-out both;
  h1 { margin: 0 0 6px; font-size: 23px; line-height: 1.2; letter-spacing: -.035em; }
  p { color: var(--muted); font-size: 14px; line-height: 1.5; margin: 0 0 20px; }
  label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 8px; }
  @media (prefers-reduced-transparency: reduce) { background: #fff; -webkit-backdrop-filter: none; backdrop-filter: none; }
  @media (max-width: 480px) { padding: 24px 20px; }
`;

export const TokenInput = styled.input`
  width: 100%;
  min-height: 44px;
  border: 1px solid #c8cbd0;
  border-radius: 10px;
  padding: 10px 12px;
  color: var(--ink);
  background: rgba(255, 255, 255, .46);
  font-family: ui-monospace, 'SFMono-Regular', monospace;
  font-size: 16px;
  &::placeholder { color: #858a91; }
  &:hover { border-color: #90959d; }
  &:focus { border-color: #687d89; outline: none; }
  &:focus-visible { outline: 2px solid #687d89; outline-offset: 0; }
`;

export const LoginAction = styled(Button)`
  width: 100%;
  margin-top: 12px;
  border: 0;
  border-radius: 10px;
  background: linear-gradient(160deg, rgba(255, 255, 255, .1), rgba(0, 35, 100, .1)) #0875df;
  color: white;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 42px;
  padding: 10px 16px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color .15s ease;
  box-shadow: inset 0 1px rgba(255, 255, 255, .3), 0 3px 10px rgba(0, 93, 190, .2);
  @media (hover: hover) { &:hover:not(:disabled) { background-color: #0064c7; } }
  &:active:not(:disabled) { background-color: #0056ad; }
  &:disabled { opacity: .6; cursor: wait; }
  @media (pointer: coarse) { min-height: 44px; }
`;

export const Spinner = styled.svg`
  animation: spin .8s linear infinite;
  @keyframes spin { to { transform: rotate(360deg); } }
`;

export const InlineError = styled.p`
  color: #a72c22 !important;
  background: #fff1ef;
  border-radius: 10px;
  padding: 11px 12px;
  margin: 14px 0 !important;
  font-size: 13px !important;
`;

export const Workspace = styled.main`
  flex: 1;
  position: relative;
  min-height: 100dvh;
  background: radial-gradient(ellipse at 10% 90%, #c1e4da, transparent 60%), radial-gradient(ellipse at 90% 100%, #ccd9f2, transparent 55%), #eaf1f2;
  @media (max-width: 760px) { min-height: auto; }
`;

export const Sidebar = styled.aside`
  position: absolute;
  top: 64px;
  left: 16px;
  width: 288px;
  max-height: calc(100% - 112px);
  overflow-y: auto;
  --muted: #30363c;
  background: var(--glass);
  -webkit-backdrop-filter: var(--glass-blur);
  backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-edge);
  border-radius: 18px;
  box-shadow: var(--glass-shadow);
  padding: 18px 16px 12px;
  display: flex;
  flex-direction: column;
  min-width: 0;
  z-index: 500;
  animation: glass-enter .35s ease-out both;
  h1 { font-size: 20px; line-height: 1.2; letter-spacing: -.035em; margin: 0 0 4px; }
  @media (prefers-reduced-transparency: reduce) { background: #fff; -webkit-backdrop-filter: none; backdrop-filter: none; }
  @media (max-width: 760px) {
    position: relative; top: auto; left: auto; width: auto; max-height: none; overflow: visible;
    border: 0; border-radius: 0; box-shadow: none; padding: 18px 16px;
  }
  @media (max-width: 760px) and (prefers-reduced-transparency: reduce) { background: #f1f7f7; -webkit-backdrop-filter: none; backdrop-filter: none; }
`;

export const Subtle = styled.p`color: var(--muted); font-size: 13px; line-height: 1.5; margin: 0;`;
export const ActionsGroup = styled.div`margin: 14px 0 18px;`;
export const SideActions = styled.div`display: flex; flex-wrap: wrap; gap: 6px;`;
export const ShareFeedback = styled.div<{ $error: boolean }>`
  display: flex; align-items: flex-start; gap: 8px; margin-top: 8px; padding: 9px 10px;
  border: 1px solid ${({ $error }) => $error ? 'rgba(170, 64, 51, .18)' : 'rgba(37, 110, 94, .18)'};
  border-radius: 10px; background: ${({ $error }) => $error ? 'rgba(255, 239, 235, .72)' : 'rgba(235, 250, 244, .72)'};
  color: ${({ $error }) => $error ? '#943d31' : '#276b59'}; font-size: 12px; line-height: 1.4;
  svg { flex: none; margin-top: 1px; }
  strong, span { display: block; }
  strong { font-weight: 650; }
  span { color: #30363c; margin-top: 2px; }
`;
export const IconButton = styled(Button)`
  display: inline-flex; align-items: center; justify-content: center;
  width: 36px; min-height: 36px; border: 1px solid var(--glass-edge); border-radius: 10px; background: var(--glass); color: var(--ink);
  box-shadow: var(--glass-shadow);
  cursor: pointer; padding: 0;
  transition: background-color .15s ease;
  @media (hover: hover) { &:hover:not(:disabled) { background-color: rgba(170, 205, 227, .2); } }
  &:active:not(:disabled) { background-color: rgba(143, 188, 216, .32); }
  &:disabled { opacity: .6; cursor: wait; }
  @media (pointer: coarse) { width: 44px; min-height: 44px; }
`;

export const SectionLabel = styled.div`
  display: flex; justify-content: space-between; align-items: center;
  padding: 0 6px 6px;
  color: var(--muted); font-size: 12px; font-weight: 600;
`;
export const MemberList = styled.ul`list-style: none; margin: 0; padding: 0;`;
export const Member = styled.li`& + & { border-top: 1px solid var(--line); }`;
export const MemberButton = styled(Button)`
  width: 100%; display: grid; grid-template-columns: 10px minmax(0, 1fr) auto; gap: 9px; align-items: start;
  border: 0; border-radius: 9px; background: transparent; text-align: left; cursor: pointer; padding: 9px 6px;
  transition: background-color .15s ease;
  @media (hover: hover) { &:hover { background-color: rgba(118, 118, 128, .08); } }
  &:active { background-color: rgba(118, 118, 128, .15); }
  &[aria-pressed='true'] { background: rgba(222, 237, 255, .72); box-shadow: inset 0 0 0 1px rgba(0, 102, 204, .18); }
  @media (hover: hover) { &[aria-pressed='true']:hover { background-color: rgba(202, 226, 253, .85); } }
  &[aria-pressed='true']:active { background-color: rgba(184, 215, 250, .9); }
  strong { display: block; font: 600 13px ui-monospace, monospace; color: var(--ink); }
  small { display: block; color: var(--muted); font-size: 12px; line-height: 1.5; margin-top: 4px; }
`;
export const Swatch = styled.span<{ $color: string }>`
  width: 10px; height: 10px; border-radius: 50%; background: ${({ $color }) => $color}; margin-top: 4px;
`;
export const MapArea = styled.section`
  position: relative;
  height: 100dvh;
  min-height: 420px;
  @media (max-width: 760px) { height: 58dvh; min-height: 320px; }
`;
export const EmptyMap = styled.div`
  width: 100%; height: 100%; display: grid; place-content: center; text-align: center;
  padding: 30px; color: var(--muted); background: #edf1ef;
  svg { margin: 0 auto 14px; color: #788c84; }
  strong { color: var(--ink); font-size: 17px; }
  p { margin: 8px 0 0; font-size: 14px; }
`;
