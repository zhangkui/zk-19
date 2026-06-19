import { cn } from '../utils'
import { MapContainer, TileLayer, ZoomControl, LayersControl } from 'react-leaflet'
import type { ReactNode } from 'react'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

// Fix default icon
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

interface MapComponentProps {
  center?: [number, number]
  zoom?: number
  children?: ReactNode
  className?: string
  style?: React.CSSProperties
}

export default function MapComponent({
  center = [39.908, 116.397],
  zoom = 12,
  children,
  className,
  style,
}: MapComponentProps) {
  return (
    <div className={cn('relative w-full h-full rounded-lg overflow-hidden', className)} style={style}>
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: '100%', width: '100%', background: '#0B0F14' }}
        zoomControl={false}
        attributionControl={false}
      >
        <ZoomControl position="bottomright" />
        <TileLayer
          attribution=''
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          maxZoom={19}
        />
        {children}
      </MapContainer>
    </div>
  )
}
