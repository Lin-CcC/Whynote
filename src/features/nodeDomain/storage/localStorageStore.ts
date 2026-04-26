import type {
  AppSettings,
  LocalPreferenceStorage,
  RecentWorkspaceState,
  UiPreferences,
} from './storageTypes';

const DEFAULT_STORAGE_PREFIX = 'whynote';
const SETTINGS_KEY = 'settings';
const RECENT_WORKSPACE_KEY = 'recent-workspace';
const UI_PREFERENCES_KEY = 'ui-preferences';

export function createLocalStorageStore(options?: {
  prefix?: string;
  storage?: Storage;
}): LocalPreferenceStorage {
  return new BrowserLocalStorageStore(
    options?.storage ?? window.localStorage,
    options?.prefix ?? DEFAULT_STORAGE_PREFIX,
  );
}

class BrowserLocalStorageStore implements LocalPreferenceStorage {
  private readonly storage: Storage;
  private readonly prefix: string;

  constructor(storage: Storage, prefix: string) {
    this.storage = storage;
    this.prefix = prefix;
  }

  saveSettings(settings: AppSettings) {
    writeItem(this.storage, this.getKey(SETTINGS_KEY), settings);
  }

  loadSettings() {
    return readItem<AppSettings>(this.storage, this.getKey(SETTINGS_KEY));
  }

  saveRecentWorkspaceState(state: RecentWorkspaceState) {
    writeItem(this.storage, this.getKey(RECENT_WORKSPACE_KEY), state);
  }

  loadRecentWorkspaceState() {
    return readItem<RecentWorkspaceState>(
      this.storage,
      this.getKey(RECENT_WORKSPACE_KEY),
    );
  }

  saveUiPreferences(preferences: UiPreferences) {
    writeItem(this.storage, this.getKey(UI_PREFERENCES_KEY), preferences);
  }

  loadUiPreferences() {
    return readItem<UiPreferences>(
      this.storage,
      this.getKey(UI_PREFERENCES_KEY),
    );
  }

  clear() {
    this.storage.removeItem(this.getKey(SETTINGS_KEY));
    this.storage.removeItem(this.getKey(RECENT_WORKSPACE_KEY));
    this.storage.removeItem(this.getKey(UI_PREFERENCES_KEY));
  }

  private getKey(name: string) {
    return `${this.prefix}:${name}`;
  }
}

function writeItem(storage: Storage, key: string, value: unknown) {
  storage.setItem(key, JSON.stringify(value));
}

function readItem<T>(storage: Storage, key: string) {
  const rawValue = storage.getItem(key);

  if (!rawValue) {
    return null;
  }

  return JSON.parse(rawValue) as T;
}
