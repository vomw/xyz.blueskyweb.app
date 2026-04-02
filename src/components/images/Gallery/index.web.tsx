import {useEffect, useRef, useState} from 'react'
import {Pressable, ScrollView, View} from 'react-native'
import {type AnimatedRef, useAnimatedRef} from 'react-native-reanimated'
import {Image} from 'expo-image'
import {type AppBskyEmbedImages} from '@atproto/api'
import {msg} from '@lingui/core/macro'
import {useLingui} from '@lingui/react'
import {Trans} from '@lingui/react/macro'

import {type Dimensions} from '#/lib/media/types'
import {useLargeAltBadgeEnabled} from '#/state/preferences/large-alt-badge'
import {atoms as a, useTheme, web} from '#/alf'
import {MediaInsetBorder} from '#/components/MediaInsetBorder'
import {PostEmbedViewContext} from '#/components/Post/Embed/types'
import {Text} from '#/components/Typography'
import {useAnalytics} from '#/analytics'

const CONTAINER_ASPECT_RATIO = 3 / 2
const ITEM_GAP = 8 // tokens.space.sm

interface GalleryProps {
  images: AppBskyEmbedImages.ViewImage[]
  onPress?: (
    index: number,
    containerRefs: AnimatedRef<any>[],
    fetchedDims: (Dimensions | null)[],
  ) => void
  onPressIn?: (index: number) => void
  viewContext?: PostEmbedViewContext
}

export function Gallery({
  images,
  onPress,
  onPressIn,
  viewContext,
}: GalleryProps) {
  const t = useTheme()
  const {_} = useLingui()
  const ax = useAnalytics()
  const largeAltBadge = useLargeAltBadgeEnabled()
  const currentPageRef = useRef(0)
  const scrollRef = useRef<ScrollView>(null)
  const containerRef = useRef<View>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  const [insetLeft, setInsetLeft] = useState(0)
  const [insetRight, setInsetRight] = useState(0)

  const containerRefs = useRef<AnimatedRef<any>[]>([]).current
  const thumbDimsRef = useRef<(Dimensions | null)[]>([])

  const ref0 = useAnimatedRef()
  const ref1 = useAnimatedRef()
  const ref2 = useAnimatedRef()
  const ref3 = useAnimatedRef()
  const refs = [ref0, ref1, ref2, ref3]
  for (let i = 0; i < images.length; i++) {
    containerRefs[i] = refs[i]
  }

  const isWithinQuote =
    viewContext === PostEmbedViewContext.FeedEmbedRecordWithMedia
  const hideBadges = isWithinQuote

  const QUOTE_PADDING = 12
  const containerHeight =
    containerWidth > 0 ? containerWidth / CONTAINER_ASPECT_RATIO : 0
  const scrollWidth = isWithinQuote
    ? containerWidth + QUOTE_PADDING * 2
    : insetLeft + insetRight > 0
      ? containerWidth + insetLeft + insetRight
      : containerWidth

  const getItemWidth = (image: AppBskyEmbedImages.ViewImage) => {
    const ar = image.aspectRatio
    if (ar && ar.width > 0 && ar.height > 0) {
      const ratio = ar.width / ar.height
      // Clamp aspect ratio between 2:3 (portrait) and 3:2 (landscape)
      const clamped = Math.max(2 / 3, Math.min(ratio, 3 / 2))
      return containerHeight * clamped
    }
    return containerHeight // default to square-ish
  }

  // Click-and-drag scrolling via DOM listeners
  const hasDragged = useRef(false)

  useEffect(() => {
    const el = scrollRef.current as unknown as HTMLElement
    if (!el) return

    let isDragging = false
    let startX = 0
    let scrollStart = 0
    let prevX = 0
    let prevTime = 0
    let velocity = 0
    let momentumId = 0

    el.style.cursor = 'grab'

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return
      cancelAnimationFrame(momentumId)
      isDragging = true
      hasDragged.current = false
      startX = e.pageX - el.offsetLeft
      scrollStart = el.scrollLeft
      prevX = e.pageX
      prevTime = Date.now()
      velocity = 0
      el.style.cursor = 'grabbing'
      e.preventDefault() // prevents native image drag
    }

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return
      const x = e.pageX - el.offsetLeft
      if (Math.abs(x - startX) > 3) {
        hasDragged.current = true
      }
      // Track velocity from recent movement
      const now = Date.now()
      const dt = now - prevTime
      if (dt > 0) {
        velocity = (e.pageX - prevX) / dt
      }
      prevX = e.pageX
      prevTime = now
      el.scrollLeft = scrollStart - (x - startX)
    }

    const onMouseUp = () => {
      if (!isDragging) return
      if (hasDragged.current) {
        el.addEventListener('click', e => e.stopPropagation(), {once: true})
      }
      isDragging = false
      el.style.cursor = 'grab'

      // Apply momentum with friction
      const friction = 0.95
      let v = -velocity * 15 // scale velocity to px/frame
      const coast = () => {
        if (Math.abs(v) < 0.5) return
        el.scrollLeft += v
        v *= friction
        momentumId = requestAnimationFrame(coast)
      }
      coast()
    }

    el.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)

    return () => {
      el.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [containerWidth]) // re-attach when scroll view mounts

  return (
    <View
      style={
        containerWidth > 0
          ? {height: containerHeight, overflow: 'visible'}
          : {aspectRatio: CONTAINER_ASPECT_RATIO}
      }
      ref={containerRef}
      onLayout={e => {
        const w = e.nativeEvent.layout.width
        if (w > 0) {
          setContainerWidth(w)
        }
        // Measure distance to post edges for bleed
        if (!isWithinQuote) {
          requestAnimationFrame(() => {
            const el = containerRef.current as unknown as HTMLElement
            if (!el) return
            const galleryRect = el.getBoundingClientRect()
            // Walk up to find the post outer container (has paddingLeft/paddingRight)
            let parent: HTMLElement | null = el.parentElement
            while (parent) {
              const ps = window.getComputedStyle(parent)
              const pl = parseFloat(ps.paddingLeft)
              const pr = parseFloat(ps.paddingRight)
              if (pl >= 8 && pr >= 8 && ps.cursor === 'pointer') {
                const parentRect = parent.getBoundingClientRect()
                setInsetLeft(galleryRect.left - parentRect.left)
                setInsetRight(parentRect.right - galleryRect.right)
                break
              }
              parent = parent.parentElement
            }
          })
        }
      }}
      role="group"
      aria-roledescription="carousel"
      aria-label={_(msg`Image gallery, ${images.length} images`)}>
      {containerWidth > 0 && (
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          style={[
            {
              height: containerHeight,
              width: scrollWidth,
              marginLeft: isWithinQuote
                ? -QUOTE_PADDING
                : insetLeft > 0
                  ? -insetLeft
                  : 0,
            },
            web({
              WebkitOverflowScrolling: 'touch',
            }),
          ]}
          contentContainerStyle={{
            gap: ITEM_GAP,
            paddingLeft: isWithinQuote
              ? QUOTE_PADDING
              : insetLeft > 0
                ? insetLeft
                : 0,
            paddingRight: isWithinQuote
              ? QUOTE_PADDING
              : insetRight > 0
                ? insetRight
                : 0,
          }}
          onScroll={e => {
            const offsetX = e.nativeEvent.contentOffset.x
            let accumulated = 0
            let page = 0
            for (let i = 0; i < images.length; i++) {
              const w = getItemWidth(images[i]) + ITEM_GAP
              if (offsetX < accumulated + w / 2) {
                page = i
                break
              }
              accumulated += w
              page = i
            }
            if (page !== currentPageRef.current) {
              ax.metric('post:gallery:swipe', {
                fromIndex: currentPageRef.current,
                toIndex: page,
                totalImages: images.length,
              })
              currentPageRef.current = page
            }
          }}>
          {images.map((image, index) => (
            <View
              key={index}
              ref={containerRefs[index]}
              collapsable={false}
              style={[
                {
                  width: getItemWidth(image),
                  height: containerHeight,
                },
              ]}
              aria-roledescription="slide"
              aria-label={
                image.alt || _(msg`Image ${index + 1} of ${images.length}`)
              }>
              <Pressable
                onPress={
                  onPress
                    ? () => {
                        if (hasDragged.current) return
                        ax.metric('post:gallery:openLightbox', {
                          imageIndex: index,
                          totalImages: images.length,
                        })
                        onPress(
                          index,
                          containerRefs.slice(0, images.length),
                          thumbDimsRef.current.slice(),
                        )
                      }
                    : undefined
                }
                onPressIn={onPressIn ? () => onPressIn(index) : undefined}
                accessibilityRole="button"
                accessibilityLabel={
                  image.alt || _(msg`Image ${index + 1} of ${images.length}`)
                }
                accessibilityHint={_(msg`Opens full image`)}
                style={[
                  a.flex_1,
                  a.rounded_md,
                  a.overflow_hidden,
                  t.atoms.bg_contrast_25,
                ]}>
                <Image
                  source={{uri: image.thumb}}
                  style={[a.flex_1]}
                  contentFit="cover"
                  accessible={true}
                  accessibilityLabel={image.alt}
                  accessibilityHint=""
                  accessibilityIgnoresInvertColors
                  onLoad={e => {
                    thumbDimsRef.current[index] = {
                      width: e.source.width,
                      height: e.source.height,
                    }
                  }}
                  loading={index === 0 ? 'eager' : 'lazy'}
                />
                <MediaInsetBorder />
              </Pressable>
              {image.alt && !hideBadges ? (
                <View
                  accessible={false}
                  style={[
                    a.absolute,
                    a.flex_row,
                    a.align_center,
                    a.rounded_xs,
                    t.atoms.bg_contrast_25,
                    {
                      gap: 3,
                      padding: 3,
                      bottom: a.p_xs.padding,
                      right: a.p_xs.padding,
                      opacity: 0.8,
                    },
                    largeAltBadge && {
                      gap: 4,
                      padding: 5,
                    },
                  ]}>
                  <Text
                    style={[
                      a.font_bold,
                      largeAltBadge ? a.text_xs : {fontSize: 8},
                    ]}>
                    <Trans>ALT</Trans>
                  </Text>
                </View>
              ) : null}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  )
}
