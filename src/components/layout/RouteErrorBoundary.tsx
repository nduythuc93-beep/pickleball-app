import { Component, type ReactNode } from 'react'
import { RefreshCw, AlertTriangle } from 'lucide-react'

type Props = { children: ReactNode }
type State = { error: Error | null }

/**
 * Catches render errors from lazy-loaded route chunks (e.g. failed
 * dynamic import on flaky network) and shows a recovery UI instead of
 * leaving the user with a blank screen.
 *
 * Most common trigger: Vercel deploys a new build, old cached HTML still
 * references stale chunk filenames → import() throws "Failed to fetch
 * dynamically imported module". The reload here pulls the fresh HTML.
 */
export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error) {
    // Log so we can see this in production via Vercel logs / Sentry later
    console.error('[RouteErrorBoundary]', error)
  }

  handleReload = () => {
    // Clear PWA cache for the page so the new build's HTML is fetched
    if ('caches' in window) {
      caches.keys().then((keys) => {
        keys.forEach((key) => caches.delete(key))
      })
    }
    window.location.reload()
  }

  handleGoHome = () => {
    this.setState({ error: null })
    window.location.href = '/home'
  }

  render() {
    if (this.state.error) {
      const isChunkError =
        /Loading chunk|Failed to fetch dynamically imported module/i.test(
          this.state.error.message
        )

      return (
        <div className="min-h-[60vh] flex items-center justify-center p-6">
          <div className="max-w-sm w-full bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-amber-100 flex items-center justify-center mb-3">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            </div>
            <h2 className="text-base font-bold text-gray-900 mb-1">
              {isChunkError ? 'Không tải được trang' : 'Đã có lỗi'}
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              {isChunkError
                ? 'Có thể app vừa cập nhật bản mới. Tải lại để dùng phiên bản mới nhất.'
                : 'Trang này gặp sự cố. Thử tải lại hoặc về trang chính.'}
            </p>
            <div className="flex gap-2">
              <button
                onClick={this.handleGoHome}
                className="flex-1 py-2 text-sm font-semibold bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Về trang chính
              </button>
              <button
                onClick={this.handleReload}
                className="flex-1 py-2 text-sm font-semibold bg-primary text-white rounded-lg hover:bg-primary/90 flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Tải lại
              </button>
            </div>
            {!isChunkError && (
              <details className="mt-4 text-left">
                <summary className="text-[10px] text-gray-400 cursor-pointer">
                  Chi tiết kỹ thuật
                </summary>
                <pre className="text-[10px] text-gray-500 mt-2 whitespace-pre-wrap break-all">
                  {this.state.error.message}
                </pre>
              </details>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
