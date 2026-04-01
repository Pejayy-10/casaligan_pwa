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
  'please enter',
  'please select',
  'please fill',
  'please add',
  'denied',
  'not completed',
  'not found',
  'missing'
];

function normalizeNoticeMessage(message: string): string {
  const normalized = message.toLowerCase();
  if (
    normalized.includes('please add category') ||
    normalized.includes('please add a category')
  ) {
    return 'Please enter a category name';
  }

  return message;
}

function getNoticeTone(message: string): 'success' | 'error' {
  const normalized = message.toLowerCase();
  if (normalized.startsWith('please ')) {
    return 'error';
  }
  return ERROR_KEYWORDS.some((keyword) => normalized.includes(keyword)) ? 'error' : 'success';
}

export default function GlobalAlertNotice() {
  const [notices, setNotices] = useState<AlertNotice[]>([]);

  useEffect(() => {
    const originalAlert = window.alert.bind(window);

    const pushNotice = (rawMessage: unknown) => {
      const message = normalizeNoticeMessage(String(rawMessage ?? 'Action completed.'));
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
              ? 'border border-[#EA526F]/45 bg-gradient-to-br from-[#EA526F]/15 via-white to-[#EA526F]/5 dark:border-[#EA526F]/55 dark:from-[#EA526F]/25 dark:via-slate-900 dark:to-[#4B244A]/45'
              : 'border border-[#4B244A]/30 bg-gradient-to-br from-[#4B244A]/10 via-white to-[#EA526F]/10 dark:border-[#4B244A]/55 dark:from-[#4B244A]/35 dark:via-slate-900 dark:to-[#EA526F]/25'
          }`}
          role="status"
        >
          <div className={`absolute inset-x-0 bottom-0 h-1 ${notice.tone === 'error' ? 'bg-gradient-to-r from-[#EA526F] via-[#e24667] to-[#c63a56]' : 'bg-gradient-to-r from-[#4B244A] via-[#6B3468] to-[#EA526F]'}`} />
          <div className="flex items-start gap-3">
            <div
              className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white shadow-md ${
                notice.tone === 'error' ? 'bg-[#EA526F] shadow-[#EA526F]/40' : 'bg-[#4B244A] shadow-[#4B244A]/35'
              }`}
            >
              {notice.tone === 'error' ? <AlertCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
            </div>
            <div className="min-w-0 flex-1">
              <p
                className={`text-xs font-semibold uppercase tracking-[0.18em] ${
                  notice.tone === 'error' ? 'text-[#b73a53] dark:text-[#ff9bb0]' : 'text-[#4B244A] dark:text-[#f2c6f0]'
                }`}
              >
                {notice.tone === 'error' ? 'Unsuccessful' : 'Success'}
              </p>
              <p
                className={`mt-0.5 text-sm font-semibold ${
                  notice.tone === 'error' ? 'text-[#7d1f35] dark:text-[#ffd7e1]' : 'text-[#351934] dark:text-[#ffe7ff]'
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
                  ? 'text-[#a3364c]/80 hover:bg-[#EA526F]/15 hover:text-[#7d1f35] dark:text-[#ff9bb0]/85 dark:hover:bg-[#EA526F]/20 dark:hover:text-[#ffd7e1]'
                  : 'text-[#4B244A]/75 hover:bg-[#4B244A]/10 hover:text-[#351934] dark:text-[#f2c6f0]/85 dark:hover:bg-[#4B244A]/25 dark:hover:text-[#ffe7ff]'
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