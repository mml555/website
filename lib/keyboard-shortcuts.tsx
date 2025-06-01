import React from 'react'
import { useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

type ShortcutHandler = (e: KeyboardEvent) => void

interface Shortcut {
  key: string
  ctrlKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
  description: string
  handler: ShortcutHandler
}

export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  const router = useRouter()

  const handleKeyPress = useCallback(
    (e: KeyboardEvent) => {
      const matchingShortcut = shortcuts.find(
        (shortcut) =>
          shortcut.key.toLowerCase() === e.key.toLowerCase() &&
          !!shortcut.ctrlKey === e.ctrlKey &&
          !!shortcut.shiftKey === e.shiftKey &&
          !!shortcut.altKey === e.altKey
      )

      if (matchingShortcut) {
        e.preventDefault()
        matchingShortcut.handler(e)
      }
    },
    [shortcuts]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [handleKeyPress])
}

// Common admin shortcuts
export const createAdminShortcuts = (router: ReturnType<typeof useRouter>) => [
  {
    key: 'n',
    ctrlKey: true,
    shiftKey: false,
    altKey: false,
    description: 'New Product',
    handler: () => router.push('/dashboard/products/new'),
  },
  {
    key: 's',
    ctrlKey: true,
    shiftKey: false,
    altKey: false,
    description: 'Save',
    handler: (e: KeyboardEvent) => {
      const form = (e.target as HTMLElement).closest('form')
      if (form) form.requestSubmit()
    },
  },
  {
    key: 'Escape',
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    description: 'Close Modal',
    handler: () => {
      const modal = document.querySelector('[role="dialog"]')
      if (modal) {
        const closeButton = modal.querySelector('button[aria-label="Close"]')
        if (closeButton) (closeButton as HTMLButtonElement).click()
      }
    },
  },
  {
    key: '/',
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    description: 'Search',
    handler: () => {
      const searchInput = document.querySelector('input[type="search"]')
      if (searchInput) (searchInput as HTMLInputElement).focus()
    },
  },
]

// Shortcut help component
export function ShortcutHelp() {
  const router = useRouter()
  const adminShortcuts = createAdminShortcuts(router)
  
  return (
    <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-lg p-4 max-w-sm">
      <h3 className="text-lg font-semibold mb-2">Keyboard Shortcuts</h3>
      <ul className="space-y-2">
        {adminShortcuts.map((shortcut) => (
          <li key={shortcut.description} className="flex items-center gap-2">
            <kbd className="px-2 py-1 bg-gray-100 rounded text-sm">
              {[
                shortcut.ctrlKey && 'Ctrl',
                shortcut.shiftKey && 'Shift',
                shortcut.altKey && 'Alt',
                shortcut.key,
              ]
                .filter(Boolean)
                .join(' + ')}
            </kbd>
            <span className="text-sm text-gray-600">{shortcut.description}</span>
          </li>
        ))}
      </ul>
    </div>
  )
} 