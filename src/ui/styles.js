export const styles = `
:host {
  all: initial;
  color-scheme: light;
  font-family: system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
}
*, *::before, *::after { box-sizing: border-box; }
button, select, input { font: inherit; }
.entry {
  position: fixed; right: 18px; bottom: calc(76px + env(safe-area-inset-bottom, 0px));
  z-index: 2147483646; border: 0; border-radius: 999px; padding: 12px 17px;
  background: #2563eb; color: #fff; font-size: 15px; font-weight: 700;
  box-shadow: 0 8px 24px rgb(37 99 235 / 35%); cursor: pointer;
}
.entry:disabled { cursor: wait; opacity: .72; }
.backdrop {
  position: fixed; inset: 0; z-index: 2147483647; display: grid; place-items: center;
  padding: 14px; background: rgb(15 23 42 / 62%);
}
.dialog {
  width: min(880px, 100%); max-height: min(92dvh, 900px); overflow: auto;
  border-radius: 20px; padding: 22px; background: #fff; color: #111827;
  box-shadow: 0 24px 70px rgb(0 0 0 / 30%);
}
.dialog--small { width: min(480px, 100%); }
.title { margin: 0; font-size: 21px; line-height: 1.35; }
.description { margin: 8px 0 18px; color: #64748b; font-size: 14px; line-height: 1.6; }
.field { display: grid; gap: 7px; margin: 14px 0; color: #334155; font-size: 14px; }
.control {
  width: 100%; min-height: 44px; border: 1px solid #cbd5e1; border-radius: 11px;
  padding: 9px 11px; background: #fff; color: #0f172a;
}
.control:focus, button:focus-visible { outline: 3px solid rgb(37 99 235 / 25%); outline-offset: 2px; }
.notice { margin: 12px 0; border-radius: 10px; padding: 10px 12px; background: #eff6ff; color: #1e40af; font-size: 13px; }
.error { background: #fef2f2; color: #b91c1c; }
.actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 18px; }
.button { min-height: 44px; border: 1px solid #cbd5e1; border-radius: 11px; padding: 10px 14px; background: #fff; color: #0f172a; cursor: pointer; }
.button--primary { border-color: #2563eb; background: #2563eb; color: #fff; font-weight: 700; }
.summary { margin: 10px 0 14px; color: #64748b; font-size: 13px; }
.table-wrap { max-height: 55dvh; overflow: auto; border: 1px solid #e2e8f0; border-radius: 12px; }
table { width: 100%; border-collapse: collapse; color: #1e293b; font-size: 13px; }
th { position: sticky; top: 0; background: #f8fafc; text-align: left; }
th, td { padding: 9px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
@media (max-width: 640px) {
  .entry { right: 12px; bottom: calc(64px + env(safe-area-inset-bottom, 0px)); }
  .backdrop { align-items: end; padding: 0; }
  .dialog { width: 100%; max-height: 92dvh; border-radius: 20px 20px 0 0; padding: 18px 16px calc(16px + env(safe-area-inset-bottom, 0px)); }
  th, td { min-width: 88px; }
  th:first-child, td:first-child { min-width: 130px; }
}
`;
