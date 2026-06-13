import { useState, useEffect, useCallback } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Toast {
  id: string
  message: string
  type: 'success' | 'error'
}

let toastCallback: ((toast: Toast) => void) | null = null

export function showToast(message: string, type: 'success' | 'error' = 'success') {
  if (toastCallback) {
    toastCallback({ id: Date.now().toString(), message, type })
  }
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((toast: Toast) => {
    setToasts((prev) => [...prev, toast])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== toast.id))
    }, 4000)
  }, [])

  useEffect(() => {
    toastCallback = addToast
    return () => { toastCallback = null }
  }, [addToast])

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            'flex items-center gap-3 rounded-lg px-4 py-3 shadow-lg text-white text-sm min-w-[280px]',
            toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
          )}
        >
          <span className="flex-1">{toast.message}</span>
          <button
            onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
            className="hover:opacity-75"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
