import { Capacitor } from '@capacitor/core';

const DEFAULT_LOCAL_API = 'http://127.0.0.1:8000';
const DEFAULT_PROD_API = 'https://api.casaligan.site';

const configuredApiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');
const isNativePlatform = Capacitor.isNativePlatform();

const pointsToLocalhost = (value: string) =>
	value.includes('127.0.0.1') || value.includes('localhost');

// On mobile APK builds, never use localhost/127.0.0.1 because it points to the phone itself.
const API_BASE_URL = isNativePlatform
	? (configuredApiBaseUrl && !pointsToLocalhost(configuredApiBaseUrl) ? configuredApiBaseUrl : DEFAULT_PROD_API)
	: (configuredApiBaseUrl || DEFAULT_LOCAL_API);

export { API_BASE_URL };
