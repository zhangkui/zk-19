import { useCallback, useEffect } from 'react'
import { cn } from '../utils'
import { MapContainer, TileLayer, ZoomControl, LayersControl, useMap, useMapEvents, CircleMarker, Popup, Polyline } from 'react-leaflet'
import type { ReactNode } from 'react'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

export interface MapPoint {
  lon: number
  lat: number
  label?: string
  color?: string
}

interface MapClickHandlerProps {
  onClick?: (lat: number, lon: number) => void
  pickMode?: boolean
}

function MapClickHandler({ onClick, pickMode }: MapClickHandlerProps) {
  useMapEvents({
    click: (e) => {
      if (pickMode && onClick) {
        onClick(e.latlng.lat, e.latlng.lng)
      }
    },
  })
  return null
}

interface MapComponentProps {
  center?: [number, number]
  zoom?: number
  children?: ReactNode
  className?: string
  style?: React.CSSProperties
  pickMode?: boolean
  pickModeType?: 'single' | 'multi'
  onPickPoint?: (lat: number, lon: number) => void
  tempPoints?: MapPoint[]
  onClearTempPoints?: () => void
  showPickHint?: boolean
}

export default function MapComponent({
  center = [39.908, 116.397],
  zoom = 12,
  children,
  className,
  style,
  pickMode = false,
  pickModeType = 'single',
  onPickPoint,
  tempPoints = [],
  onClearTempPoints,
  showPickHint = true,
}: MapComponentProps) {
  const handleMapClick = useCallback((lat: number, lon: number) => {
    if (onPickPoint) {
      onPickPoint(lat, lon)
    }
  }, [onPickPoint])

  return (
    <div className={cn('relative w-full h-full rounded-lg overflow-hidden', className)} style={style}>
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: '100%', width: '100%', background: '#0B0F14', cursor: pickMode ? 'crosshair' : 'grab' }}
        zoomControl={false}
        attributionControl={false}
      >
        <ZoomControl position="bottomright" />
        <TileLayer
          attribution=''
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          maxZoom={19}
        />
        <MapClickHandler onClick={handleMapClick} pickMode={pickMode} />
        {tempPoints.map((pt, idx) => (
          <CircleMarker
            key={`temp-${idx}`}
            center={[pt.lat, pt.lon]}
            radius={8}
            fillColor={pt.color || '#F5B301'}
            color={pt.color || '#F5B301'}
            weight={3}
            opacity={1}
            fillOpacity={0.5}
            dashArray="5, 5"
          >
            {pt.label && (
              <Popup>
                <div className="text-xs">
                  <p className="font-medium">{pt.label}</p>
                  <p className="text-text-muted">经度: {pt.lon.toFixed(4)}</p>
                  <p className="text-text-muted">纬度: {pt.lat.toFixed(4)}</p>
                </div>
              </Popup>
            )}
          </CircleMarker>
        ))}
        {tempPoints.length > 1 && (
          <Polyline
            positions={tempPoints.map((pt) => [pt.lat, pt.lon])}
            color="#F5B301"
            weight={2}
            opacity={0.6}
            dashArray="8, 8"
          />
        )}
        {children}
      </MapContainer>
      {pickMode && showPickHint && (
        <div className="absolute top-4 left-4 right-4 z-[400]">
          <div className="bg-amber/90 backdrop-blur text-bg-dark rounded-lg px-4 py-2.5 text-sm flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 bg-bg-dark rounded-full animate-pulse"></span>
              {pickModeType === 'multi'
                ? `选点模式：点击地图添加坐标点，已选择 ${tempPoints.length} 个点`
                : '选点模式：点击地图选择坐标点'}
            </span>
            {onClearTempPoints && (tempPoints.length > 0 || pickModeType === 'single') && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onClearTempPoints()
                }}
                className="px-3 py-1 bg-bg-dark/20 hover:bg-bg-dark/30 rounded text-xs font-medium transition-colors"
              >
                {pickModeType === 'single' ? '取消选点' : '清空选点'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
