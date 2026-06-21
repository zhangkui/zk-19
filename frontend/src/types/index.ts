export interface User {
  id: number
  username: string
  name: string
  role: 'superadmin' | 'admin' | 'pilot' | 'reviewer' | 'crew'
  role_display: string
  email: string
  phone: string
  is_active: boolean
  date_joined: string
}

export interface Line {
  id: number
  name: string
  voltage: string
  voltage_display: string
  tower_count: number
  description: string
  coordinates: [number, number][]
  created_at: string
  updated_at?: string
  towers?: Tower[]
}

export interface Section {
  id: number
  line: number | null
  line_name: string
  name: string
  start_km: number
  end_km: number
  description: string
  tower_count: number
  created_at: string
  coordinates?: [number, number][]
  start_coordinates?: { lon: number; lat: number } | null
  end_coordinates?: { lon: number; lat: number } | null
}

export interface Tower {
  id: number
  line: number | null
  section: number | null
  section_name?: string
  code: string
  height: number
  tower_type: string
  tower_type_display: string
  sequence: number
  coordinates: { lon: number; lat: number } | null
  defect_count?: number
  created_at: string
  updated_at?: string
}

export interface ChangeHistory {
  id: number
  content_type: 'line' | 'tower' | 'section'
  content_type_display: string
  object_id: number | null
  object_name: string
  action: 'create' | 'update' | 'delete' | 'import'
  action_display: string
  user: number | null
  user_name: string
  changes: any
  note: string
  created_at: string
}

export interface Drone {
  id: number
  name: string
  model: string
  serial_number: string
  firmware_version: string
  status: 'idle' | 'busy' | 'maintenance' | 'offline'
  status_display: string
  is_online: boolean
  battery: number
  signal_strength: number
  latitude: number | null
  longitude: number | null
  altitude: number
  speed: number
  heading: number
  last_heartbeat: string | null
  last_report_time: string | null
  last_report_type: string | null
  last_report_type_display: string | null
  current_task_id: number | null
  current_route_id: number | null
  current_line_id: number | null
  max_flight_time: number
  payload: string
  created_at: string
}

export interface Waypoint {
  lon: number
  lat: number
  altitude?: number
  speed?: number
  index?: number
}

export interface EditableWaypoint {
  lon: number
  lat: number
  index: number
}

export interface ValidationResult {
  valid: boolean
  message: string
}

export interface RouteVersion {
  id: number
  route: number
  version: number
  name: string
  line: number
  line_name: string
  coordinates: [number, number][]
  waypoints_data: any[]
  waypoint_count: number
  altitude: number
  speed: number
  distance: number
  estimated_duration: number
  status: string
  status_display: string
  description: string
  created_by: number | null
  created_by_name: string
  created_at: string
}

export interface RouteNearbyTower {
  id: number
  code: string
  coordinates: { lon: number; lat: number } | null
  section: number | null
  section_name: string
  height: number
  tower_type: string
  sequence: number
}

export interface RouteAffectedSection {
  id: number
  name: string
  start_km: number
  end_km: number
}

export interface FlightRoute {
  id: number
  name: string
  line: number
  line_name: string
  waypoints_data: any[]
  altitude: number
  speed: number
  distance: number
  estimated_duration: number
  status: 'draft' | 'pending_review' | 'approved' | 'rejected' | 'archived'
  status_display: string
  waypoint_count: number
  description: string
  coordinates: [number, number][]
  version: number
  review_note: string
  reviewed_by: number | null
  reviewed_by_name: string
  reviewed_at: string | null
  created_by: number | null
  created_by_name: string
  created_at: string
  updated_at: string
  altitude_validation?: ValidationResult
  speed_validation?: ValidationResult
  nearby_towers?: RouteNearbyTower[]
  affected_sections?: RouteAffectedSection[]
  versions?: RouteVersion[]
}

export interface RouteValidation {
  altitude: ValidationResult
  speed: ValidationResult
  distance: number
  duration: number
  tower_count: number
  section_count: number
  is_valid: boolean
}

export interface InspectionTask {
  id: number
  code: string
  name: string
  route: number
  route_name: string
  drone: number
  drone_name: string
  pilot: number
  pilot_name: string
  status: 'pending' | 'running' | 'paused' | 'completed' | 'cancelled'
  status_display: string
  planned_date: string
  started_at: string | null
  ended_at: string | null
  media_count: number
  defect_count: number
  notes: string
  created_at: string
}

export interface InspectionMedia {
  id: number
  task: number
  tower: number | null
  tower_code: string
  file_url: string
  thumbnail_url: string
  media_type: 'image' | 'video'
  media_type_display: string
  coordinates: { lon: number; lat: number } | null
  captured_at: string | null
  altitude: number
  has_defect: boolean
  defect_count: number
  uploaded_at: string
}

export interface Defect {
  id: number
  media: number
  media_detail?: InspectionMedia
  tower: number
  tower_code: string
  tower_line: string
  task: number | null
  defect_type: 'insulator' | 'tower' | 'hardware' | 'conductor' | 'other'
  defect_type_display: string
  subtype: string
  severity: 'critical' | 'major' | 'minor'
  severity_display: string
  status: 'pending' | 'confirmed' | 'rejected'
  status_display: string
  bbox: { x: number; y: number; width: number; height: number }
  confidence: number
  description: string
  review_note: string
  reviewed_by: number | null
  reviewed_by_name: string
  reviewed_at: string | null
  media_thumbnail?: string
  created_at: string
}

export interface Alert {
  id: number
  defect: number | null
  defect_detail?: Defect
  tower: number | null
  tower_code: string
  category: 'defect' | 'device' | 'weather' | 'other'
  category_display: string
  level: 'critical' | 'major' | 'minor'
  level_display: string
  title: string
  content: string
  status: 'open' | 'processing' | 'handled' | 'closed'
  status_display: string
  handled_by: number | null
  handled_by_name: string
  handled_at: string | null
  handle_note: string
  created_at: string
}

export interface WorkOrderLog {
  id: number
  action: string
  action_display: string
  operator: number | null
  operator_name: string
  note: string
  from_status: string
  to_status: string
  created_at: string
}

export interface WorkOrder {
  id: number
  code: string
  title: string
  description: string
  defect: number | null
  defect_info?: any
  tower: number
  tower_code: string
  tower_line: string
  severity: 'critical' | 'major' | 'minor'
  severity_display: string
  priority: 'urgent' | 'high' | 'normal' | 'low'
  priority_display: string
  status: 'created' | 'assigned' | 'processing' | 'review' | 'closed' | 'cancelled'
  status_display: string
  assignee: number | null
  assignee_name: string | null
  created_by: number | null
  created_by_name: string | null
  reviewer: number | null
  reviewer_name: string | null
  planned_start: string | null
  planned_end: string | null
  actual_start: string | null
  actual_end: string | null
  closed_at: string | null
  logs?: WorkOrderLog[]
  created_at: string
  updated_at: string
}

export interface OverviewStats {
  lines: number
  towers: number
  defects: number
  alerts: number
  today_defects: number
  pending_workorders: number
  close_rate: number
  by_severity: {
    critical: number
    major: number
    minor: number
  }
}

export interface LineStat {
  id: number
  name: string
  voltage: string
  total_defects: number
  critical: number
  major: number
  minor: number
  tower_count: number
  defect_rate: number
  coordinates: [number, number][] | null
}

export interface SectionStat {
  id: number
  name: string
  line_id: number
  line_name: string
  total_defects: number
  critical: number
  major: number
  minor: number
}

export interface TowerRank {
  id: number
  code: string
  line_name: string
  defect_count: number
  coordinates: { lon: number; lat: number } | null
}

export interface HeatmapPoint {
  id: number
  code: string
  line_id: number
  line_name: string
  lon: number
  lat: number
  defect_count: number
  intensity: number
}

export interface TrendData {
  daily: { date: string; count: number }[]
  by_type: Record<string, { total: number; [key: string]: number }>
}

export interface SystemLog {
  id: number
  log_type: 'push' | 'report'
  log_type_display: string
  log_category: string
  log_category_display: string
  log_level: 'info' | 'warning' | 'error' | 'critical'
  log_level_display: string
  drone: number | null
  drone_name: string | null
  drone_serial: string | null
  task: number | null
  task_code: string | null
  task_name: string | null
  title: string
  content: string
  raw_data: any
  latitude: number | null
  longitude: number | null
  altitude: number | null
  speed: number | null
  battery: number | null
  signal_strength: number | null
  coordinates: { lon: number; lat: number } | null
  report_time: string
  created_at: string
}

export interface DroneTelemetry {
  id: number
  drone: number
  drone_name: string
  report_time: string
  latitude: number
  longitude: number
  altitude: number
  speed: number
  heading: number
  battery: number
  signal_strength: number
  satellites: number
  temperature: number | null
  wind_speed: number | null
  coordinates: { lon: number; lat: number }
  extra_data: any
}

export interface DroneTaskSummary {
  id: number
  drone: number
  task: number
  route: number | null
  report_time: string
  task_status: string
  task_status_display: string
  flight_phase: string
  current_waypoint_index: number
  total_waypoints: number
  progress: number
  flight_distance: number
  remaining_distance: number
  elapsed_time: number
  remaining_time: number
  photos_taken: number
  videos_recorded: number
  battery_used: number
  latitude: number | null
  longitude: number | null
  altitude: number
  speed: number
  heading: number
  extra_data: any
  created_at: string
}

export interface InspectionTaskDetail extends InspectionTask {
  route_data: {
    id: number
    name: string
    coordinates: [number, number][]
    waypoints_data: any[]
    altitude: number
    speed: number
    distance: number
    estimated_duration: number
  } | null
  line_data: {
    id: number
    name: string
    voltage: string
    voltage_display: string
    coordinates: [number, number][]
    description: string
  } | null
  towers_data: Tower[]
  sections_data: Section[]
}
