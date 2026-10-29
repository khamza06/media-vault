import { render as baseRender, type RenderOptions } from '@testing-library/react'
import type { ReactNode } from 'react'
import { LocaleProvider } from '../components/LocaleProvider'

/** Existing English regression scenarios now render inside the same locale boundary as the app. */
export function render(node: ReactNode, options?: RenderOptions) {
  return baseRender(node, { wrapper: ({ children }) => <LocaleProvider locale="en">{children}</LocaleProvider>, ...options })
}
