import {useMemo, useRef, useState} from 'react'
import {
  TextInput,
  type TextInputContentSizeChangeEvent,
  type TextInputProps,
} from 'react-native'

import {mergeRefs} from '#/lib/merge-refs'
import {atoms as a, extractPadding, flatten, useAlf, web} from '#/alf'
import {normalizeTextStyles} from '#/alf/typography'
import {IS_ANDROID, IS_IOS, IS_WEB} from '#/env'

export function AutosizedTextarea({
  ref,
  label,
  minRows = 1,
  maxRows,
  onUpdateHeight,

  onChangeText: onChangeTextOuter,
  onContentSizeChange: onContentSizeChangeOuter,
  style,
  ...rest
}: Omit<TextInputProps, 'multiline'> & {
  ref?: React.Ref<TextInput>
  label: string
  minRows?: number
  maxRows?: number
  onUpdateHeight?: (height: number) => void
}) {
  const textInputRef = useRef<TextInput>(null)
  const {theme: t, fonts} = useAlf()
  const {processedStyle, minHeight, maxHeight} = useMemo(() => {
    const fs = flatten(style)
    const ts = normalizeTextStyles(
      [a.text_md, a.leading_snug, t.atoms.text, fs],
      {
        fontScale: fonts.scaleMultiplier,
        fontFamily: fonts.family,
        flags: {},
      },
    )
    const lineHeight = ts.lineHeight || 20
    const padding = extractPadding(fs ?? {})
    const verticalSpace = padding.paddingTop + padding.paddingBottom
    const mh = lineHeight * minRows + verticalSpace
    const xh = maxRows ? lineHeight * maxRows + verticalSpace : Infinity
    /*
     * iOS: minHeight/maxHeight works fine natively.
     * Web + Android: we set an explicit initial height and resize dynamically
     * (web via DOM measurement, Android via onContentSizeChange state).
     *
     * iOS also seems to need 1px headroom to actually expand to the correct
     * maxHeight
     */
    const tas = IS_IOS ? {minHeight: mh, maxHeight: xh + 1} : {height: mh}

    return {
      processedStyle: {
        ...ts,
        ...tas,
      },
      minHeight: mh,
      maxHeight: xh,
    }
  }, [t, fonts, style, minRows, maxRows])

  /*
   * On Android, multiline TextInput oscillates between slightly different
   * contentSize values on consecutive layout passes (sub-pixel rounding).
   * This causes visible jumpiness when using minHeight/maxHeight. Instead,
   * we drive the height explicitly and ceil the value to stabilize it.
   */
  const [androidInputHeight, setAndroidInputHeight] = useState(minHeight)

  const prevHeight = useRef(0)
  const resizeWeb = () => {
    const el = textInputRef.current as unknown as HTMLTextAreaElement
    if (!el) return
    el.style.height = '0px'
    const scrollHeight = el.scrollHeight
    const nextHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight)
    el.style.height = `${nextHeight}px`
    el.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden'
    if (nextHeight !== prevHeight.current) {
      prevHeight.current = nextHeight
      onUpdateHeight?.(nextHeight)
    }
  }

  const onChangeText = (text: string) => {
    if (IS_WEB) resizeWeb()
    onChangeTextOuter?.(text)
  }

  /*
   * Native height tracking: on Android we ceil to stabilize sub-pixel
   * oscillation and drive height via state; on iOS we just notify.
   */
  const onContentSizeChange = (e: TextInputContentSizeChangeEvent) => {
    const h = Math.ceil(e.nativeEvent.contentSize.height)
    const nextHeight = Math.min(Math.max(h, minHeight), maxHeight)

    if (nextHeight !== prevHeight.current) {
      prevHeight.current = nextHeight
      if (IS_ANDROID) setAndroidInputHeight(nextHeight)
      onUpdateHeight?.(nextHeight)
    }

    onContentSizeChangeOuter?.(e)
  }

  return (
    <TextInput
      multiline
      placeholderTextColor={t.palette.contrast_500}
      accessibilityLabel={label}
      accessibilityHint={label}
      placeholder={label}
      keyboardAppearance={t.scheme}
      submitBehavior="newline"
      style={[
        a.relative,
        a.border_0,
        IS_ANDROID ? {height: androidInputHeight} : {},
        {
          textAlignVertical: 'top',
          includeFontPadding: false,
        },
        web({
          resize: 'none',
          outline: 'none',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }),
        processedStyle,
      ]}
      {...rest}
      ref={mergeRefs([
        (node: TextInput | null) => {
          textInputRef.current = node
          // bop resize on first render
          if (IS_WEB && node) resizeWeb()
        },
        ref,
      ])}
      onChangeText={onChangeText}
      onContentSizeChange={onContentSizeChange}
    />
  )
}
