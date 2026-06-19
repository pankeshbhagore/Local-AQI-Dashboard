import axios from 'axios';

const api = axios.create({
  baseURL: `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/v1`,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(cfg => {
  const t = localStorage.getItem('aqi_token');
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401 && !window.location.pathname.includes('/login')) {
      localStorage.removeItem('aqi_token');
      localStorage.removeItem('aqi_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const aqiAPI = {
  getMap:   ()                   => api.get('/aqi/map'),
  getWard:  (id: number, h = 24) => api.get(`/aqi/ward/${id}?hours=${h}`),
  getCity:  ()                   => api.get('/aqi/city'),
  getTrend: ()                   => api.get('/aqi/trend'),
};

export const predictionAPI = {
  getWardForecast: (wardId: number)  => api.get(`/predictions/ward/${wardId}`),
  getHotspots:     (threshold = 150) => api.get(`/predictions/hotspots?threshold=${threshold}`),
  getSource:       (wardId: number)  => api.get(`/predictions/source/${wardId}`),
};

export const reportAPI = {
  submit:    (data: FormData) => api.post('/reports', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getAll:    (params?: any)   => api.get('/reports', { params }),
  getStats:  ()               => api.get('/reports/stats'),
  getMine:   ()               => api.get('/reports/citizen/mine'),
  getById:   (id: string)     => api.get(`/reports/${id}`),
  assign:    (id: string, officerId: string, officerName: string, note: string) =>
    api.patch(`/reports/${id}/assign`, { officerId, officerName, note }),
  action:    (id: string, action: string, note: string, status: string) =>
    api.patch(`/reports/${id}/action`, { action, note, status }),
  verify:    (id: string, status: string, notes: string) =>
    api.patch(`/reports/${id}/verify`, { status, notes }),
  feedback:  (id: string, rating: number, feedback: string) =>
    api.patch(`/reports/${id}/feedback`, { rating, feedback }),
};

export const alertAPI = {
  getAll:   (params?: any) => api.get('/alerts', { params }),
  getCount: ()             => api.get('/alerts/count'),
  resolve:  (id: string)   => api.patch(`/alerts/${id}/resolve`),
  manual:   (data: any)    => api.post('/alerts/manual', data),
};

export const copilotAPI = {
  ask:      (query: string) => api.post('/copilot/ask', { query }),
  advisory: (data: any)     => api.post('/copilot/advisory', data),
};

export const hotspotAPI = {
  getAll:             (status = 'active') => api.get(`/hotspots?status=${status}`),
  getRecommendations: (id: string)        => api.get(`/hotspots/${id}/recommendations`),
  resolve:            (id: string)        => api.patch(`/hotspots/${id}/resolve`),
};

export const userAPI = {
  getAll:    ()                           => api.get('/auth/users'),
  getMe:     ()                           => api.get('/auth/me'),
  update:    (id: string, data: any)      => api.patch(`/auth/users/${id}`, data),
  getOfficers: ()                         => api.get('/auth/users').then(r => ({
    ...r, data: { ...r.data, users: r.data.users?.filter((u: any) => u.role === 'officer') }
  })),
};

export default api;
