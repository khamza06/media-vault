import type { CatalogSearchCandidate } from './catalog-types'

export const OPEN_ADD_MODAL_EVENT = 'media-vault:open-add-modal'

export type OpenAddModalDetail = {
  candidate?: CatalogSearchCandidate
}

export function dispatchOpenAddModal(detail?: OpenAddModalDetail) {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(new CustomEvent<OpenAddModalDetail>(OPEN_ADD_MODAL_EVENT, { detail }))
}
