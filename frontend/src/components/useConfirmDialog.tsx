import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';

type ConfirmTone = 'default' | 'danger';

type ConfirmConfig = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
};

type ConfirmState = Required<ConfirmConfig>;

const DEFAULT_CONFIG: Omit<ConfirmState, 'message'> = {
  title: 'Please Confirm',
  confirmLabel: 'Confirm',
  cancelLabel: 'Cancel',
  tone: 'default'
};

export function useConfirmDialog() {
  const [dialog, setDialog] = useState<ConfirmState | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const closeDialog = useCallback((value: boolean) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setDialog(null);
  }, []);

  const confirm = useCallback((config: string | ConfirmConfig) => {
    const nextConfig: ConfirmState = {
      ...DEFAULT_CONFIG,
      ...(typeof config === 'string' ? { message: config } : config)
    } as ConfirmState;

    if (resolverRef.current) {
      resolverRef.current(false);
      resolverRef.current = null;
    }

    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setDialog(nextConfig);
    });
  }, []);

  useEffect(() => {
    return () => {
      if (resolverRef.current) {
        resolverRef.current(false);
        resolverRef.current = null;
      }
    };
  }, []);

  const confirmDialog = useMemo(() => {
    if (!dialog || typeof document === 'undefined') return null;

    return createPortal(
      <div className="fixed inset-0 z-[140] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/10 shadow-2xl overflow-hidden">
          <div className={`h-1.5 ${dialog.tone === 'danger' ? 'bg-gradient-to-r from-red-500 via-rose-500 to-red-700' : 'bg-gradient-to-r from-[#EA526F] via-[#E7467B] to-[#4B244A]'}`} />

          <div className="p-5">
            <h3 className="text-lg font-bold text-[#4B244A] dark:text-white flex items-center gap-2">
              <AlertTriangle className={`w-5 h-5 ${dialog.tone === 'danger' ? 'text-red-500' : 'text-[#EA526F]'}`} />
              {dialog.title}
            </h3>
            <p className="mt-2 text-sm text-[#4B244A]/75 dark:text-white/75">{dialog.message}</p>
          </div>

          <div className="px-5 pb-5 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => closeDialog(false)}
              className="py-2.5 rounded-lg bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-white font-semibold hover:bg-gray-200 dark:hover:bg-white/20 transition-colors"
            >
              {dialog.cancelLabel}
            </button>
            <button
              type="button"
              onClick={() => closeDialog(true)}
              className={`py-2.5 rounded-lg text-white font-semibold transition-colors ${
                dialog.tone === 'danger' ? 'bg-red-500 hover:bg-red-600' : 'bg-[#EA526F] hover:bg-[#d4486a]'
              }`}
            >
              {dialog.confirmLabel}
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  }, [closeDialog, dialog]);

  return {
    confirm,
    confirmDialog
  };
}
