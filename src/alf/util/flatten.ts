import {StyleSheet} from 'react-native'

export const flatten = StyleSheet.flatten

type PaddingStyle = {
  padding?: number
  paddingHorizontal?: number
  paddingVertical?: number
  paddingTop?: number
  paddingBottom?: number
  paddingLeft?: number
  paddingRight?: number
}

export function extractPadding(style: PaddingStyle | PaddingStyle[]) {
  const s = flatten(style)
  const base = s.padding ?? 0
  return {
    paddingTop: s.paddingTop ?? s.paddingVertical ?? base,
    paddingBottom: s.paddingBottom ?? s.paddingVertical ?? base,
    paddingLeft: s.paddingLeft ?? s.paddingHorizontal ?? base,
    paddingRight: s.paddingRight ?? s.paddingHorizontal ?? base,
  }
}
