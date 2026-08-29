const STORAGE_KEYS = {
  investment: 'portfolio-saving-tracker.investmentData',
  saving: 'portfolio-saving-tracker.savingData',
}

export const loadPersistedData = (key, fallback) => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS[key])
    if (!stored) return fallback

    const parsed = JSON.parse(stored)
    return Array.isArray(parsed) ? parsed : fallback
  } catch (error) {
    console.error(`Failed to load ${key} from local storage:`, error)
    return fallback
  }
}

export const savePersistedData = (key, data) => {
  try {
    localStorage.setItem(STORAGE_KEYS[key], JSON.stringify(data))
  } catch (error) {
    console.error(`Failed to save ${key} to local storage:`, error)
  }
}

export const clearPersistedData = (key) => {
  try {
    localStorage.removeItem(STORAGE_KEYS[key])
  } catch (error) {
    console.error(`Failed to clear ${key} from local storage:`, error)
  }
}
