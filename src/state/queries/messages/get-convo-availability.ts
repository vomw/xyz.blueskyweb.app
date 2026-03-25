import {useMemo} from 'react'
import {useQueries, useQuery} from '@tanstack/react-query'

import {DM_SERVICE_HEADERS} from '#/lib/constants'
import {useAgent} from '#/state/session'
import {canBeMessaged} from '#/components/dms/util'
import type * as bsky from '#/types/bsky'
import {STALE} from '..'

const RQKEY_ROOT = 'convo-availability'
export const RQKEY = (did: string) => [RQKEY_ROOT, did]

export function useGetConvoAvailabilityQuery(did: string) {
  const agent = useAgent()

  return useQuery({
    queryKey: RQKEY(did),
    queryFn: async () => {
      const {data} = await agent.chat.bsky.convo.getConvoAvailability(
        {members: [did]},
        {headers: DM_SERVICE_HEADERS},
      )

      return {
        did,
        ...data,
      }
    },
    staleTime: STALE.INFINITY,
  })
}

export enum ConvoAvailability {
  CanChat = 'can-chat',
  CannotChat = 'cannot-chat',
  Pending = 'pending',
}

export function useGetConvoAvailabilityForList(
  profiles: bsky.profile.AnyProfileView[],
) {
  const agent = useAgent()

  const unknownProfiles = useMemo(() => {
    return profiles.filter(p => !canBeMessaged(p))
  }, [profiles])

  return useQueries({
    queries: unknownProfiles.map(p => ({
      queryKey: RQKEY(p.did),
      queryFn: async () => {
        const {data} = await agent.chat.bsky.convo.getConvoAvailability(
          {members: [p.did]},
          {headers: DM_SERVICE_HEADERS},
        )

        return {
          did: p.did,
          ...data,
        }
      },
      staleTime: STALE.INFINITY,
    })),
    combine: results => {
      return new Map(
        profiles.map(p => {
          const index = unknownProfiles.indexOf(p)
          // if not in unknownProfiles it passed the canBeMessaged check
          // and thus skipped the query completely.
          if (index === -1) return [p.did, ConvoAvailability.CanChat]
          const result = results[index]
          // shouldn't happen
          if (!result) return [p.did, ConvoAvailability.CannotChat]

          if (!result.data) return [p.did, ConvoAvailability.Pending]
          return result.data.canChat
            ? [p.did, ConvoAvailability.CanChat]
            : [p.did, ConvoAvailability.CannotChat]
        }),
      )
    },
  })
}
