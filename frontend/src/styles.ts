import { Button } from '@base-ui/react/button';
import styled, { createGlobalStyle } from 'styled-components';

export const GlobalStyle = createGlobalStyle`
  :root {
    font-family: 'Avenir Next', Avenir, 'Segoe UI', sans-serif;
    color: #193b45;
    background: #fff;
    font-synthesis: none;
    --ink: #193b45;
    --muted: #536f74;
    --line: #d5e4e2;
    --accent: #12677a;
  }
  * { box-sizing: border-box; }
  body { margin: 0; min-width: 320px; }
  button, input { font: inherit; }
  button:focus-visible, input:focus-visible, a:focus-visible, .leaflet-interactive:focus-visible { outline: 3px solid #d37444; outline-offset: 3px; }
  .leaflet-container { width: 100%; height: 100%; background: #dce9e4; font: inherit; }
  .leaflet-popup-content-wrapper { border-radius: 12px; box-shadow: 0 8px 28px #193b4533; }
  .leaflet-popup-content { min-width: 190px; line-height: 1.55; }
  .leaflet-popup-content strong { overflow-wrap: anywhere; }
  .leaflet-popup-content p { margin: 4px 0; }
  .leaflet-control-attribution { font-size: 10px; }
  @media (prefers-reduced-motion: reduce) { *, *::before, *::after { scroll-behavior: auto !important; animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }
`;

export const Shell = styled.div`
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
`;

export const Header = styled.header`
  height: 72px;
  flex-shrink: 0;
  background: #fff;
  color: var(--ink);
  border-bottom: 1px solid var(--line);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 0 40px;
  position: relative;
  z-index: 10;
  @media (max-width: 600px) { padding: 0 20px; height: 64px; }
`;

export const Brand = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 750;
  letter-spacing: -.035em;
  font-size: 17px;
  svg { color: var(--accent); }
`;

export const Welcome = styled.main`
  flex: 1;
  display: grid;
  place-items: center;
  padding: 40px 20px;
`;

export const LoginCard = styled.form`
  width: min(400px, 100%);
  h1 { margin: 0 0 10px; font-size: 24px; letter-spacing: -.04em; }
  p { color: var(--muted); font-size: 14px; line-height: 1.6; margin: 0 0 30px; }
  label { display: block; font-size: 13px; font-weight: 700; margin-bottom: 9px; }
`;

export const TokenInput = styled.input`
  width: 100%;
  min-height: 48px;
  border: 1px solid #b8cfcd;
  border-radius: 8px;
  padding: 13px 14px;
  color: var(--ink);
  background: #fbfdfd;
  font-family: ui-monospace, 'SFMono-Regular', monospace;
  font-size: 14px;
  &::placeholder { color: #718b8d; }
  &:hover { border-color: #6f9d9e; }
`;

export const Action = styled(Button)`
  border: 0;
  border-radius: 8px;
  background: #12677a;
  color: white;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 48px;
  padding: 13px 18px;
  font-weight: 700;
  cursor: pointer;
  transition: background .15s ease;
  &:hover:not(:disabled) { background: #0b5161; }
  &:disabled { opacity: .6; cursor: wait; }
`;

export const LoginAction = styled(Action)`width: 100%; margin-top: 18px;`;

export const InlineError = styled.p`
  color: #9b352c !important;
  background: #fff1ed;
  border-radius: 7px;
  padding: 11px 12px;
  margin: 14px 0 !important;
  font-size: 13px !important;
`;

export const Workspace = styled.main`
  flex: 1;
  min-height: calc(100dvh - 72px);
  display: grid;
  grid-template-columns: 340px minmax(0, 1fr);
  @media (max-width: 760px) { grid-template-columns: 1fr; min-height: auto; }
`;

export const Sidebar = styled.aside`
  background: #fff;
  border-right: 1px solid var(--line);
  padding: 36px 28px;
  display: flex;
  flex-direction: column;
  min-width: 0;
  z-index: 2;
  h1 { font-size: 24px; line-height: 1.2; letter-spacing: -.03em; margin: 0 0 8px; }
  @media (max-width: 760px) { border-right: 0; padding: 26px 20px; }
`;

export const Subtle = styled.p`color: var(--muted); font-size: 13px; line-height: 1.5; margin: 0;`;
export const SideActions = styled.div`display: flex; flex-wrap: wrap; gap: 8px; margin: 24px 0 32px;`;
export const Secondary = styled(Button)`
  display: inline-flex; align-items: center; justify-content: center; gap: 7px;
  min-height: 44px; border: 1px solid #c4d9d8; border-radius: 8px; background: white; color: #245965;
  font-size: 13px; font-weight: 700; cursor: pointer; padding: 10px 12px;
  &:hover:not(:disabled) { background: #edf6f5; border-color: #8ab6b7; }
  &:disabled { opacity: .6; cursor: wait; }
`;

export const SectionLabel = styled.div`
  display: flex; justify-content: space-between; align-items: center;
  padding-bottom: 12px; border-bottom: 1px solid var(--line);
  color: #537477; font-size: 11px; font-weight: 750; letter-spacing: .11em; text-transform: uppercase;
`;
export const MemberList = styled.ul`list-style: none; margin: 0; padding: 0;`;
export const Member = styled.li`
  display: grid; grid-template-columns: 12px minmax(0, 1fr) auto; gap: 12px; align-items: start;
  padding: 18px 0; border-bottom: 1px solid #e6efed;
  strong { display: block; font: 600 13px ui-monospace, monospace; color: var(--ink); }
  small { display: block; color: #5e787a; font-size: 12px; line-height: 1.5; margin-top: 4px; }
`;
export const Swatch = styled.span<{ $color: string }>`
  width: 10px; height: 10px; border-radius: 50%; background: ${({ $color }) => $color}; margin-top: 4px;
`;
export const MapArea = styled.section`
  position: relative;
  height: calc(100dvh - 72px);
  min-height: 420px;
  @media (max-width: 760px) { height: 58dvh; min-height: 390px; }
`;
export const EmptyMap = styled.div`
  width: 100%; height: 100%; display: grid; place-content: center; text-align: center;
  padding: 30px; color: #536f74; background: #e5f0ed;
  svg { margin: 0 auto 14px; color: #438b8d; }
  strong { color: #285862; font-size: 17px; }
  p { margin: 8px 0 0; font-size: 14px; }
`;
