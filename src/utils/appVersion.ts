import Constants from 'expo-constants';

/** Semantic app version, e.g. "1.0.0". */
export const APP_VERSION = Constants.expoConfig?.version ?? '0.0.0';

/** Monotonic build number from EAS (Android versionCode / iOS buildNumber). */
export const APP_BUILD =
  Constants.expoConfig?.android?.versionCode ?? Constants.expoConfig?.ios?.buildNumber;

const BUILD_TIME_ISO = Constants.expoConfig?.extra?.buildTime as string | undefined;

function formatBuildTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/** Human-readable generation date/time of this release, e.g. "23 Jun 2026, 15:32". */
export const APP_BUILD_TIME_LABEL = formatBuildTime(BUILD_TIME_ISO);

/** Combined version + build label, e.g. "v1.0.0 (build 12)". */
export const APP_VERSION_LABEL = `v${APP_VERSION}${APP_BUILD != null ? ` (build ${APP_BUILD})` : ''}`;
