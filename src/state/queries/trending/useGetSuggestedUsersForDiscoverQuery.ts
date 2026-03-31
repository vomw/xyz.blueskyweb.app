import {
  type AppBskyActorDefs,
  type AppBskyUnspeccedGetSuggestedUsers,
} from '@atproto/api'
import {type QueryClient, useQuery} from '@tanstack/react-query'

import {
  aggregateUserInterests,
  createBskyTopicsHeader,
} from '#/lib/api/feed/utils'
import {getContentLanguages} from '#/state/preferences/languages'
import {STALE} from '#/state/queries'
import {usePreferencesQuery} from '#/state/queries/preferences'
import {useAgent} from '#/state/session'

export type QueryProps = {
  limit?: number
  enabled?: boolean
}

export const getSuggestedUsersForDiscoverQueryKeyRoot =
  'unspecced-suggested-users-for-explore'
export const createGetSuggestedUsersForDiscoverQueryKey = (
  props: QueryProps,
) => [getSuggestedUsersForDiscoverQueryKeyRoot, props.limit]

export function useGetSuggestedUsersForDiscoverQuery(props: QueryProps) {
  const agent = useAgent()
  const {data: preferences} = usePreferencesQuery()

  return useQuery({
    enabled: !!preferences && props.enabled !== false,
    staleTime: STALE.MINUTES.THREE,
    queryKey: createGetSuggestedUsersForDiscoverQueryKey(props),
    queryFn: async () => {
      const contentLangs = getContentLanguages().join(',')
      const userInterests = aggregateUserInterests(preferences)

      const {data} =
        await agent.app.bsky.unspecced.getSuggestedUsersForDiscover(
          {
            limit: props.limit || 10,
          },
          {
            headers: {
              ...createBskyTopicsHeader(userInterests),
              'Accept-Language': contentLangs,
            },
          },
        )
      return {...data, recId: data.recIdStr}
    },
  })
}

export function* findAllProfilesInQueryData(
  queryClient: QueryClient,
  did: string,
): Generator<AppBskyActorDefs.ProfileView, void> {
  const responses =
    queryClient.getQueriesData<AppBskyUnspeccedGetSuggestedUsers.OutputSchema>({
      queryKey: [getSuggestedUsersForDiscoverQueryKeyRoot],
    })
  for (const [_key, response] of responses) {
    if (!response) {
      continue
    }

    for (const actor of response.actors) {
      if (actor.did === did) {
        yield actor
      }
    }
  }
}
