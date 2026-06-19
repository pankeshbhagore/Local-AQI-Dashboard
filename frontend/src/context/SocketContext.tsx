import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface ReportEvent { _id: string; wardName: string; pollutionType: string; severity: string; [k: string]: any; }
interface AlertEvent  { _id?: string; message: string; severity: string; wardName?: string; [k: string]: any; }

interface SocketCtx {
  socket:          Socket | null;
  connected:       boolean;
  cityAQI:         Record<number, number>;
  liveAlerts:      AlertEvent[];
  assignedReports: ReportEvent[];
  newReports:      ReportEvent[];
  lastUpdate:      Date | null;
  lastReportUpdate:Date | null;
  clearAlerts:     () => void;
}

const Ctx = createContext<SocketCtx>({
  socket: null, connected: false, cityAQI: {}, liveAlerts: [],
  assignedReports: [], newReports: [], lastUpdate: null, lastReportUpdate: null, clearAlerts: () => {},
});
export const useSocket = () => useContext(Ctx);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  // FIX: Store socket in state instead of ref so context consumers re-render on socket change
  const [socket,          setSocket]          = useState<Socket | null>(null);
  const [connected,       setConnected]       = useState(false);
  const [cityAQI,         setCityAQI]         = useState<Record<number, number>>({});
  const [liveAlerts,      setLiveAlerts]      = useState<AlertEvent[]>([]);
  const [assignedReports, setAssignedReports] = useState<ReportEvent[]>([]);
  const [newReports,      setNewReports]      = useState<ReportEvent[]>([]);
  const [lastUpdate,      setLastUpdate]      = useState<Date | null>(null);
  const [lastReportUpdate,setLastReportUpdate]= useState<Date | null>(null);

  const clearAlerts = useCallback(() => setLiveAlerts([]), []);

  useEffect(() => {
    const WS = process.env.REACT_APP_WS_URL || 'http://localhost:5000';
    const s = io(WS, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      // FIX: Added reconnectionDelayMax to prevent runaway reconnect storms
      reconnectionDelayMax: 10000,
    });

    setSocket(s);

    s.on('connect', () => {
      setConnected(true);
      try {
        const user = JSON.parse(localStorage.getItem('aqi_user') || 'null');
        if (user) s.emit('auth', { role: user.role, userId: user.id });
      } catch {}
    });
    s.on('disconnect', () => setConnected(false));
    s.on('connect_error', () => setConnected(false));

    s.on('city:update', (d: any) => {
      if (d?.wardId && d?.aqi != null) {
        setCityAQI(p => ({ ...p, [d.wardId]: d.aqi }));
        setLastUpdate(new Date());
      }
    });
    s.on('aqi:update', (d: any) => {
      if (d?.wardId && d?.aqi != null) {
        setCityAQI(p => ({ ...p, [d.wardId]: d.aqi }));
        setLastUpdate(new Date());
      }
    });

    s.on('alert:new',       (a: AlertEvent)  => setLiveAlerts(p    => [a, ...p].slice(0, 30)));
    s.on('report:new',      (r: ReportEvent) => { setNewReports(p => [r, ...p].slice(0, 20)); setLastReportUpdate(new Date()); });
    s.on('report:assigned', (r: ReportEvent) => { setAssignedReports(p => [r, ...p].slice(0, 20)); setLastReportUpdate(new Date()); });
    s.on('report:updated',  () => setLastReportUpdate(new Date()));
    s.on('report:status',   () => setLastReportUpdate(new Date()));

    return () => { s.disconnect(); };
  }, []);

  return (
    <Ctx.Provider value={{ socket, connected, cityAQI, liveAlerts, assignedReports, newReports, lastUpdate, lastReportUpdate, clearAlerts }}>
      {children}
    </Ctx.Provider>
  );
}
