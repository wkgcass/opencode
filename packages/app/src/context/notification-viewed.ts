export function isSessionViewed(input: {
  active: boolean
  windowFocused?: boolean
  directory: string
  currentDirectory?: string
  sessionID?: string
  currentSession?: string
}) {
  if (!input.active) return false
  if (input.windowFocused === false) return false
  if (!input.currentSession || !input.sessionID) return false
  if (input.currentDirectory && input.directory !== input.currentDirectory) return false
  return input.sessionID === input.currentSession
}

export function isSessionCompletionViewed(input: {
  interactionRequired: boolean
  completionInteraction: number
  currentInteraction: number
  otherwiseViewed: boolean
}) {
  if (!input.interactionRequired) return input.otherwiseViewed
  return input.currentInteraction > input.completionInteraction
}
