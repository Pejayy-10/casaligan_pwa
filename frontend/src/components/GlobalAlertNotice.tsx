import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, X } from 'lucide-react';

type AlertNotice = {
  id: number;
  message: string;
  tone: 'success' | 'error';
};

const EVENT_NAME = 'app-alert-notice';

const ERROR_KEYWORDS = [
  'fail',
  'failed',
  'error',
  'unable',
  'cannot',
  "can't",
  'invalid',
  'required',
  'denied',
  'not completed',
  'not found',
  'missing'
];

function getNoticeTone(message: string): 'success' | 'error' {
  const normalized = message.toLowerCase();
  return ERROR_KEYWORDS.some((keyword) => normalized.includes(keyword)) ? 'error' : 'success';
}

export default function GlobalAlertNotice() {
  const [notices, setNotices] = useState<AlertNotice[]>([]);

  useEffect(() => {
    const originalAlert = window.alert.bind(window);

    const pushNotice = (rawMessage: unknown) => {
      const message = String(rawMessage ?? 'Action completed.');
      const id = Date.now() + Math.floor(Math.random() * 1000);
      const tone = getNoticeTone(message);

      setNotices((prev) => {
        const next = prev.length >= 3 ? prev.slice(1) : prev;
        return [...next, { id, message, tone }];
      });

      window.setTimeout(() => {
        setNotices((prev) => prev.filter((notice) => notice.id !== id));
      }, 2800);
    };

    const alertListener = (event: Event) => {
      const customEvent = event as CustomEvent<{ message?: unknown }>;
      pushNotice(customEvent.detail?.message);
    };

    window.alert = (message?: unknown) => {
      window.dispatchEvent(
        new CustomEvent(EVENT_NAME, {
          detail: { message }
        })
      );
    };

    window.addEventListener(EVENT_NAME, alertListener);

    return () => {
      window.alert = originalAlert;
      window.removeEventListener(EVENT_NAME, alertListener);
    };
  }, []);

  if (!notices.length) return null;

  return (
    <div className="pointer-events-none fixed top-6 left-1/2 z-[80] w-[min(92vw,420px)] -translate-x-1/2 px-4" aria-live="polite" aria-atomic="true">
      <div className="space-y-3">
      {notices.map((notice) => (
        <div
          key={notice.id}
          className={`pointer-events-auto relative overflow-hidden rounded-2xl px-4 py-3 shadow-xl backdrop-blur-sm ${
            notice.tone === 'error'
              ? 'border border-red-300/60 bg-gradient-to-br from-red-50 via-white to-rose-50 dark:border-red-400/30 dark:from-red-900/30 dark:via-slate-900 dark:to-rose-950/40'
              : 'border border-emerald-300/60 bg-gradient-to-br from-emerald-50 via-white to-lime-50 dark:border-emerald-400/30 dark:from-emerald-900/30 dark:via-slate-900 dark:to-emerald-950/40'
          }`}
          role="status"
        >
          <div className={`absolute inset-x-0 bottom-0 h-1 ${notice.tone === 'error' ? 'bg-gradient-to-r from-red-400 via-red-500 to-rose-500' : 'bg-gradient-to-r from-emerald-400 via-emerald-500 to-lime-500'}`} />
          <div className="flex items-start gap-3">
            <div
              className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white shadow-md ${
                notice.tone === 'error' ? 'bg-red-500 shadow-red-500/30' : 'bg-emerald-500 shadow-emerald-500/30'
              }`}
            >
              {notice.tone === 'error' ? <AlertCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
            </div>
            <div className="min-w-0 flex-1">
              <p
                className={`text-xs font-semibold uppercase tracking-[0.18em] ${
                  notice.tone === 'error' ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'
                }`}
              >
                {notice.tone === 'error' ? 'Unsuccessful' : 'Success'}
              </p>
              <p
                className={`mt-0.5 text-sm font-semibold ${
                  notice.tone === 'error' ? 'text-red-900 dark:text-red-100' : 'text-emerald-900 dark:text-emerald-100'
                }`}
              >
                {notice.message}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setNotices((prev) => prev.filter((item) => item.id !== notice.id))}
              className={`rounded-lg p-1 transition-colors ${
                notice.tone === 'error'
                  ? 'text-red-700/70 hover:bg-red-100 hover:text-red-900 dark:text-red-300/80 dark:hover:bg-red-500/10 dark:hover:text-red-100'
                  : 'text-emerald-700/70 hover:bg-emerald-100 hover:text-emerald-900 dark:text-emerald-300/80 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-100'
              }`}
              aria-label="Dismiss notice"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
      </div>
    </div>
  );
}