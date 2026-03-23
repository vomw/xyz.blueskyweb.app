import {useMutation, useQueryClient} from '@tanstack/react-query'

import {type AppNux, type Nux} from '#/state/queries/nuxs/definitions'
import {parseAppNux, serializeAppNux} from '#/state/queries/nuxs/util'
import {preferencesQueryKey, usePreferences} from '#/state/queries/preferences'
import {useAgent} from '#/state/session'

export {Nux} from '#/state/queries/nuxs/definitions'

export function useNuxs(): {
  nuxs: AppNux[]
} {
  const preferences = usePreferences()

  const nuxs = preferences?.bskyAppState?.nuxs
    ?.map(parseAppNux)
    ?.filter(Boolean) as AppNux[]

  if (nuxs) {
    return {
      nuxs,
    }
  } else {
    return {
      nuxs: [],
    }
  }
  // if (__DEV__) {
  //   const queryClient = useQueryClient()
  //   const agent = useAgent()

  //   // @ts-ignore
  //   window.clearNux = async (ids: string[]) => {
  //     await agent.bskyAppRemoveNuxs(ids)
  //     // triggers a refetch
  //     await queryClient.invalidateQueries({
  //       queryKey: preferencesQueryKey,
  //     })
  //   }
  // }
}

export function useNux<T extends Nux>(
  id: T,
): {
  nux: Extract<AppNux, {id: T}> | undefined
} {
  const {nuxs} = useNuxs()

  const nux = nuxs.find(nux => nux.id === id)

  if (nux) {
    return {
      nux: nux as Extract<AppNux, {id: T}>,
    }
  } else {
    return {
      nux: undefined,
    }
  }
}

export function useSaveNux() {
  const queryClient = useQueryClient()
  const agent = useAgent()

  return useMutation({
    retry: 3,
    mutationFn: async (nux: AppNux) => {
      await agent.bskyAppUpsertNux(serializeAppNux(nux))
      // triggers a refetch
      await queryClient.invalidateQueries({
        queryKey: preferencesQueryKey,
      })
    },
  })
}

export function useResetNuxs() {
  const queryClient = useQueryClient()
  const agent = useAgent()

  return useMutation({
    retry: 3,
    mutationFn: async (ids: string[]) => {
      await agent.bskyAppRemoveNuxs(ids)
      // triggers a refetch
      await queryClient.invalidateQueries({
        queryKey: preferencesQueryKey,
      })
    },
  })
}
