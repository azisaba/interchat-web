export const COLOR_REGEX = /[&§]([0-9a-flmnox]|#[0-9a-f])/gi

export function stripColor(color: string) {
  return color.replace(COLOR_REGEX, '')
}
