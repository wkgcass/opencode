import { net } from "electron"

import { getStore, removeStoreFileIfEmpty } from "./store"
import { BARK_DEVICE_KEY, SETTINGS_STORE } from "./store-keys"
import { sendBarkSessionComplete } from "./bark-request"

export function getBarkDeviceKey() {
  const value = getStore().get(BARK_DEVICE_KEY)
  return typeof value === "string" ? value : ""
}

export function setBarkDeviceKey(value: string) {
  const deviceKey = value.trim()
  if (deviceKey) {
    getStore().set(BARK_DEVICE_KEY, deviceKey)
    return
  }
  getStore().delete(BARK_DEVICE_KEY)
  void removeStoreFileIfEmpty(SETTINGS_STORE)
}

export async function pushBarkSessionComplete(title: string) {
  const deviceKey = getBarkDeviceKey()
  if (!deviceKey) return
  await sendBarkSessionComplete(deviceKey, title, (input, init) => net.fetch(input, init))
}
