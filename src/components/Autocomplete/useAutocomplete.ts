import {useCallback} from 'react'
import {moderateProfile, type ModerationOpts} from '@atproto/api'
import {type Emoji} from '@emoji-mart/data'
import {keepPreviousData, useQuery} from '@tanstack/react-query'
import Fuse from 'fuse.js'

import {isJustAMute, moduiContainsHideableOffense} from '#/lib/moderation'
import {useGetEmojis} from '#/lib/useGetEmojis'
import {useModerationOpts} from '#/state/preferences/moderation-opts'
import {STALE} from '#/state/queries'
import {DEFAULT_LOGGED_OUT_PREFERENCES} from '#/state/queries/preferences'
import {useAgent} from '#/state/session'
import {
  type AutocompleteItem,
  type AutocompleteItemType,
  type AutocompleteProfile,
} from '#/components/Autocomplete/types'

const DEFAULT_MOD_OPTS = {
  userDid: undefined,
  prefs: DEFAULT_LOGGED_OUT_PREFERENCES.moderationPrefs,
}

/*
 * Lazily loaded Fuse instance for emoji search. Built once on first search,
 * then reused for all subsequent searches.
 */
let emojiFuseInstance: Fuse<Emoji> | null = null
function useEmojiSearch() {
  const getEmojis = useGetEmojis()

  return useCallback(
    async (query: string, limit: number = 8) => {
      if (!emojiFuseInstance) {
        const data = await getEmojis()
        emojiFuseInstance = new Fuse(Object.values(data.emojis), {
          keys: ['search'],
          threshold: 0.3,
        })
      }

      return emojiFuseInstance.search(query, {limit})
    },
    [getEmojis],
  )
}

export function useAutocomplete({
  type,
  query,
  limit,
}: {
  type: AutocompleteItemType
  query: string
  limit?: number
}) {
  const agent = useAgent()
  const moderationOpts = useModerationOpts()
  const emojiSearch = useEmojiSearch()

  return useQuery({
    staleTime: STALE.MINUTES.ONE,
    queryKey: [
      'autocomplete',
      {
        type,
        query,
      },
    ],
    async queryFn() {
      if (type === 'profile') {
        // TODO return recents
        if (!query) return []

        // Going from "foo" to "foo." should not clear matches.
        query = query.toLowerCase().trim().replace(/\.$/, '')

        const res = await agent.searchActorsTypeahead({
          q: query,
          limit: limit || 8,
        })

        return (res?.data.actors || []).map(profile => ({
          key: profile.did,
          type: 'profile' as const,
          value: '@' + profile.handle,
          profile,
        }))
      } else if (type === 'emoji') {
        const results = await emojiSearch(query, limit || 8)
        return results.map(result => ({
          key: result.item.id,
          type: 'emoji' as const,
          value: result.item.skins[0].native,
          emoji: result.item,
        }))
      }

      return []
    },
    select: useCallback(
      (items: AutocompleteItem[]) => {
        const seen = new Set<string>()
        let results: AutocompleteItem[] = []

        for (const item of items) {
          if (seen.has(item.key)) continue
          seen.add(item.key)

          if (item.type === 'profile') {
            const moderated = moderateProfileItem({
              query,
              item,
              moderationOpts: moderationOpts || DEFAULT_MOD_OPTS,
            })
            if (moderated) results.push(moderated)
          } else {
            results.push(item)
          }
        }

        return results
      },
      [query, moderationOpts],
    ),
    placeholderData: keepPreviousData,
  })
}

function moderateProfileItem({
  query,
  item,
  moderationOpts,
}: {
  query: string
  item: AutocompleteProfile
  moderationOpts: ModerationOpts
}) {
  const modui = moderateProfile(item.profile, moderationOpts).ui('profileList')
  const isExactMatch = query && item.profile.handle.toLowerCase() === query

  if (
    (isExactMatch && !moduiContainsHideableOffense(modui)) ||
    !modui.filter ||
    isJustAMute(modui)
  ) {
    return item
  }

  return null
}
