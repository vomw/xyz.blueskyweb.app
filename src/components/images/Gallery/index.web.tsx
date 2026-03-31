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
const PEEK_WIDTH = 40
const ITEM_GAP = 6

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
  const [currentPage, setCurrentPage] = useState(0)
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

  const hideBadges =
    viewContext === PostEmbedViewContext.FeedEmbedRecordWithMedia

  const itemWidth = containerWidth > 0 ? containerWidth - PEEK_WIDTH : 0
  const snapInterval = itemWidth + ITEM_GAP

  const goToPage = (index: number) => {
    scrollRef.current?.scrollTo({
      x: index * snapInterval,
      animated: true,
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft' && currentPage > 0) {
      e.preventDefault()
      goToPage(currentPage - 1)
    } else if (e.key === 'ArrowRight' && currentPage < images.length - 1) {
      e.preventDefault()
      goToPage(currentPage + 1)
    }
  }

  return (
    <View
      style={[a.rounded_md, a.overflow_hidden]}
      onLayout={e => setContainerWidth(e.nativeEvent.layout.width)}
      // @ts-expect-error web-only prop
      onKeyDown={handleKeyDown}
      tabIndex={0}
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
            {aspectRatio: CONTAINER_ASPECT_RATIO},
            web({
              scrollSnapType: 'x mandatory',
              WebkitOverflowScrolling: 'touch',
            }),
          ]}
          contentContainerStyle={{gap: ITEM_GAP}}
          onScroll={e => {
            const offsetX = e.nativeEvent.contentOffset.x
            if (snapInterval > 0) {
              const page = Math.round(offsetX / snapInterval)
              if (page !== currentPageRef.current) {
                ax.metric('post:gallery:swipe', {
                  fromIndex: currentPageRef.current,
                  toIndex: page,
                  totalImages: images.length,
                })
                currentPageRef.current = page
                setCurrentPage(page)
              }
            }
          }}>
          {images.map((image, index) => (
            <View
              key={index}
              ref={containerRefs[index]}
              collapsable={false}
              style={[
                {
                  width: itemWidth,
                  aspectRatio: CONTAINER_ASPECT_RATIO,
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
                  web({cursor: 'pointer'}),
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
      {images.length > 1 && (
        <>
          <View
            accessible={false}
            style={[
              a.absolute,
              a.rounded_full,
              t.atoms.bg_contrast_975,
              {
                bottom: a.p_xs.padding,
                left: a.p_xs.padding,
                paddingHorizontal: 8,
                paddingVertical: 4,
                opacity: 0.75,
              },
            ]}>
            <Text
              style={[
                a.font_bold,
                {fontSize: 11, color: t.atoms.text_inverted.color},
              ]}>
              {currentPage + 1}/{images.length}
            </Text>
          </View>
          {currentPage > 0 && (
            <Pressable
              onPress={() => goToPage(currentPage - 1)}
              accessibilityRole="button"
              accessibilityLabel={_(msg`Previous image`)}
              accessibilityHint=""
              style={[
                a.absolute,
                a.align_center,
                a.justify_center,
                a.rounded_full,
                t.atoms.bg_contrast_975,
                {
                  left: a.p_xs.padding,
                  top: '50%',
                  marginTop: -16,
                  width: 32,
                  height: 32,
                  opacity: 0.75,
                },
                web({cursor: 'pointer'}),
              ]}>
              <Text
                style={[
                  a.font_bold,
                  a.text_md,
                  {color: t.atoms.text_inverted.color},
                ]}>
                {'<'}
              </Text>
            </Pressable>
          )}
          {currentPage < images.length - 1 && (
            <Pressable
              onPress={() => goToPage(currentPage + 1)}
              accessibilityRole="button"
              accessibilityLabel={_(msg`Next image`)}
              accessibilityHint=""
              style={[
                a.absolute,
                a.align_center,
                a.justify_center,
                a.rounded_full,
                t.atoms.bg_contrast_975,
                {
                  right: a.p_xs.padding,
                  top: '50%',
                  marginTop: -16,
                  width: 32,
                  height: 32,
                  opacity: 0.75,
                },
                web({cursor: 'pointer'}),
              ]}>
              <Text
                style={[
                  a.font_bold,
                  a.text_md,
                  {color: t.atoms.text_inverted.color},
                ]}>
                {'>'}
              </Text>
            </Pressable>
          )}
        </>
      )}
    </View>
  )
}
