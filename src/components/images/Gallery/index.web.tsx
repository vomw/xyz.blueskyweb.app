import {useRef, useState} from 'react'
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

const CONTAINER_ASPECT_RATIO = 4 / 3
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
  const [containerWidth, setContainerWidth] = useState(0)

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

  const containerHeight =
    containerWidth > 0 ? containerWidth / CONTAINER_ASPECT_RATIO : 0

  const getItemWidth = (image: AppBskyEmbedImages.ViewImage) => {
    const ar = image.aspectRatio
    if (ar && ar.width > 0 && ar.height > 0) {
      const ratio = ar.width / ar.height
      const w = containerHeight * ratio
      return Math.max(containerWidth * 0.4, Math.min(w, containerWidth))
    }
    return containerWidth
  }

  // Click-and-drag scrolling
  const isDragging = useRef(false)
  const dragStartX = useRef(0)
  const dragScrollStart = useRef(0)
  const hasDragged = useRef(false)
  const scrollNodeRef = useRef<HTMLElement | null>(null)

  const onScrollViewRef = (ref: ScrollView | null) => {
    scrollRef.current = ref
    if (!ref) return

    const scrollable = ref as unknown as {
      getScrollableNode?: () => HTMLElement
    }
    const el =
      scrollable.getScrollableNode?.() ?? (ref as unknown as HTMLElement)
    scrollNodeRef.current = el
    if (!el) return

    // Attach click-and-drag listeners directly to the scroll DOM node
    el.style.cursor = 'grab'

    el.addEventListener('mousedown', (e: MouseEvent) => {
      if (e.button !== 0) return
      isDragging.current = true
      hasDragged.current = false
      dragStartX.current = e.clientX
      dragScrollStart.current = el.scrollLeft
      el.style.scrollBehavior = 'auto'
      el.style.scrollSnapType = 'none'
      el.style.cursor = 'grabbing'
      el.style.userSelect = 'none'
      e.preventDefault()
    })

    el.addEventListener('mousemove', (e: MouseEvent) => {
      if (!isDragging.current) return
      const dx = e.clientX - dragStartX.current
      if (Math.abs(dx) > 3) hasDragged.current = true
      el.scrollLeft = dragScrollStart.current - dx
    })

    const onUp = () => {
      if (!isDragging.current) return
      isDragging.current = false
      el.style.scrollBehavior = 'smooth'
      el.style.scrollSnapType = 'x proximity'
      el.style.cursor = 'grab'
      el.style.userSelect = ''
    }

    el.addEventListener('mouseup', onUp)
    el.addEventListener('mouseleave', onUp)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const node = scrollNodeRef.current
    if (!node) return
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      node.scrollLeft -= 200
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      node.scrollLeft += 200
    }
  }

  return (
    <View
      style={
        containerWidth > 0
          ? {height: containerHeight}
          : {aspectRatio: CONTAINER_ASPECT_RATIO}
      }
      onLayout={e => {
        const w = e.nativeEvent.layout.width
        if (w > 0) {
          setContainerWidth(w)
        }
      }}
      // @ts-expect-error web-only prop
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="group"
      aria-roledescription="carousel"
      aria-label={_(msg`Image gallery, ${images.length} images`)}>
      {containerWidth > 0 && (
        <ScrollView
          ref={onScrollViewRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          style={[
            {
              height: containerHeight,
            },
            web({
              scrollSnapType: 'x proximity',
              scrollBehavior: 'smooth',
              WebkitOverflowScrolling: 'touch',
            }),
          ]}
          contentContainerStyle={{
            gap: ITEM_GAP,
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
                web({scrollSnapAlign: 'start'}),
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
                  web({cursor: 'grab'}),
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
