export const shouldKeepAutoScrollPaused = (userScrolled: boolean, distanceFromBottom: number) =>
  userScrolled && distanceFromBottom > 1
