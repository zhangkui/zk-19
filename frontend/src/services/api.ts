import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      localStorage.removeItem('user')
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export const authApi = {
  login: (username: string, password: string) =>
    api.post('/auth/login/', { username, password }),
  refresh: (refresh: string) => api.post('/auth/refresh/', { refresh }),
  getMe: () => api.get('/auth/users/me/'),
  getUsers: (params?: any) => api.get('/auth/users/', { params }),
  getUser: (id: number) => api.get(`/auth/users/${id}/`),
  createUser: (data: any) => api.post('/auth/users/', data),
  updateUser: (id: number, data: any) => api.put(`/auth/users/${id}/`, data),
  deleteUser: (id: number) => api.delete(`/auth/users/${id}/`),
  getUserOptions: (params?: any) => api.get('/auth/users/options/', { params }),
}

export const linesApi = {
  list: (params?: any) => api.get('/lines/', { params }),
  get: (id: number) => api.get(`/lines/${id}/`),
  create: (data: any) => api.post('/lines/', data),
  update: (id: number, data: any) => api.put(`/lines/${id}/`, data),
  delete: (id: number) => api.delete(`/lines/${id}/`),
  export: () => api.get('/lines/export/', { responseType: 'blob' }),
  splitSections: (id: number, data: any) => api.post(`/lines/${id}/split_sections/`, data),
}

export const towersApi = {
  list: (params?: any) => api.get('/towers/', { params }),
  get: (id: number) => api.get(`/towers/${id}/`),
  create: (data: any) => api.post('/towers/', data),
  update: (id: number, data: any) => api.put(`/towers/${id}/`, data),
  delete: (id: number) => api.delete(`/towers/${id}/`),
  byLine: (lineId: number) => api.get('/towers/by_line/', { params: { line_id: lineId } }),
  export: (lineId?: number) => api.get('/towers/export/', { params: lineId ? { line_id: lineId } : {}, responseType: 'blob' }),
  importCsv: (formData: FormData) => api.post('/towers/import_csv/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
}

export const sectionsApi = {
  list: (params?: any) => api.get('/sections/', { params }),
  get: (id: number) => api.get(`/sections/${id}/`),
  create: (data: any) => api.post('/sections/', data),
  update: (id: number, data: any) => api.put(`/sections/${id}/`, data),
  delete: (id: number) => api.delete(`/sections/${id}/`),
  export: () => api.get('/sections/export/', { responseType: 'blob' }),
  assignTowers: (id: number, tower_ids: number[]) => api.post(`/sections/${id}/assign_towers/`, { tower_ids }),
}

export const changeHistoryApi = {
  list: (params?: any) => api.get('/change-history/', { params }),
  get: (id: number) => api.get(`/change-history/${id}/`),
}

export const dronesApi = {
  list: (params?: any) => api.get('/drones/', { params }),
  get: (id: number) => api.get(`/drones/${id}/`),
  create: (data: any) => api.post('/drones/', data),
  update: (id: number, data: any) => api.put(`/drones/${id}/`, data),
  delete: (id: number) => api.delete(`/drones/${id}/`),
}

export const routesApi = {
  list: (params?: any) => api.get('/flight-routes/', { params }),
  get: (id: number) => api.get(`/flight-routes/${id}/`),
  create: (data: any) => api.post('/flight-routes/', data),
  update: (id: number, data: any) => api.put(`/flight-routes/${id}/`, data),
  delete: (id: number) => api.delete(`/flight-routes/${id}/`),
}

export const tasksApi = {
  list: (params?: any) => api.get('/tasks/', { params }),
  get: (id: number) => api.get(`/tasks/${id}/`),
  create: (data: any) => api.post('/tasks/', data),
  update: (id: number, data: any) => api.put(`/tasks/${id}/`, data),
  delete: (id: number) => api.delete(`/tasks/${id}/`),
  upload: (id: number, formData: FormData) =>
    api.post(`/tasks/${id}/upload/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  start: (id: number) => api.post(`/tasks/${id}/start/`),
  complete: (id: number) => api.post(`/tasks/${id}/complete/`),
}

export const mediaApi = {
  list: (params?: any) => api.get('/media/', { params }),
  get: (id: number) => api.get(`/media/${id}/`),
}

export const defectsApi = {
  list: (params?: any) => api.get('/defects/', { params }),
  get: (id: number) => api.get(`/defects/${id}/`),
  review: (id: number, action: string, note?: string) =>
    api.post(`/defects/${id}/review/`, { action, note }),
}

export const alertsApi = {
  list: (params?: any) => api.get('/alerts/', { params }),
  get: (id: number) => api.get(`/alerts/${id}/`),
  handle: (id: number, status: string, note?: string) =>
    api.post(`/alerts/${id}/handle/`, { status, note }),
  unhandledCount: () => api.get('/alerts/unhandled_count/'),
}

export const workOrdersApi = {
  list: (params?: any) => api.get('/workorders/', { params }),
  get: (id: number) => api.get(`/workorders/${id}/`),
  create: (data: any) => api.post('/workorders/', data),
  update: (id: number, data: any) => api.put(`/workorders/${id}/`, data),
  transition: (id: number, action: string, note?: string, assignee_id?: number) =>
    api.post(`/workorders/${id}/transition/`, { action, note, assignee_id }),
  addLog: (id: number, note: string) =>
    api.post(`/workorders/${id}/add_log/`, { note }),
  stats: () => api.get('/workorders/stats/'),
}

export const statsApi = {
  overview: () => api.get('/stats/overview/'),
  sections: () => api.get('/stats/sections/'),
  lines: () => api.get('/stats/lines/'),
  towerRank: (limit?: number) => api.get('/stats/tower_rank/', { params: { limit } }),
  trends: (days?: number) => api.get('/stats/trends/', { params: { days } }),
  defectTypes: () => api.get('/stats/defect_types/'),
  heatmap: () => api.get('/stats/heatmap/'),
}

export default api
