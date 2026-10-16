"use client"

import { ipfsHttpsGatewayUrls } from "@/lib/phase-protocol"
import { useEffect, useMemo, useState, type ReactNode } from "react"

type Props = {
  uri: string
  alt?: string
  className?: string
  loading?: "lazy" | "eager"
  /** Se llama cuando ningún gateway devolvió imagen válida. */
  onExhausted?: () => void
  /**
   * Rendered in place of the image when the URI is empty or every gateway
   * failed. Without it the component renders nothing, which collapses a slot
   * in an ordered hang (phase-142) and shifts every later work.
   */
  fallback?: ReactNode
}

export function IpfsDisplayImg({ uri, alt = "", className, loading = "lazy", onExhausted, fallback }: Props) {
  const candidates = useMemo(() => ipfsHttpsGatewayUrls(uri), [uri])
  const [idx, setIdx] = useState(0)
  const [exhausted, setExhausted] = useState(false)

  useEffect(() => {
    setIdx(0)
    setExhausted(false)
  }, [uri])

  const src = candidates[idx] ?? ""

  if (!uri.trim() || !src || exhausted) return fallback ? <>{fallback}</> : null

  return (
    // eslint-disable-next-line @next/next/no-img-element -- remote IPFS / HTTPS previews
    <img
      key={`${uri}:${idx}`}
      src={src}
      alt={alt}
      className={className}
      loading={loading}
      referrerPolicy="no-referrer"
      onError={() => {
        if (idx + 1 < candidates.length) {
          setIdx((i) => i + 1)
        } else {
          if (fallback) setExhausted(true)
          onExhausted?.()
        }
      }}
    />
  )
}
