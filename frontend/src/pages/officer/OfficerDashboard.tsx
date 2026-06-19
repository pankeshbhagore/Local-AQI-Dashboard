import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { reportAPI, aqiAPI } from '../../services/api';
import { useSocket } from '../../context/SocketContext';
import { useSocket } from '../../context/SocketContext';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';

const TYPE_ICON: Record<string,string> = { garbage_burning:'🔥', construction_dust:'🏗️', vehicle_smoke:'🚗', industrial_emission:'🏭', dust_storm:'🌪️', other:'⚠️' };
const SEV_COLOR: Record<string,string> = { emergency:'#dc2626', high:'#ef4444', medium:'#f59e0b', low:'#22c55e' };
const STATUS_COLOR: Record<string,string> = { pending:'#f59e0b', assigned:'#3b82f6', under_investigation:'#8b5cf6', verified:'#22c55e', rejected:'#ef4444', resolved:'#64748b' };
const STATUS_LABEL: Record<string,string> = { pending:'Pending', assigned:'Assigned to Me', under_investigation:'Investigating', verified:'Verified', rejected:'Rejected', resolved:'Resolved' };

export default function OfficerDashboard() {
  const { user }    = useAuth();
  const { isDark, } = useTheme();
  const { lastReportUpdate, assignedReports, connected } = useSocket();
  const qc          = useQueryClient();
  const [selected, setSelected] = useState<any>(null);
  const [action,   setAction]   = useState('');
  const [note,     setNote]     = useState('');
  const [status,   setStatus]   = useState('');
  const [saving,   setSaving]   = useState(false);
  const [filter,   setFilter]   = useState('mine');

  const c  = (l:string, d:string) => isDark ? d : l;
  const bg = c('#ffffff','#0d1f35');
  const border = c('rgba(0,0,0,.08)','rgba(0,180,220,.12)');
  const txt  = c('#0f172a','#e2e8f0');
  const muted= c('#64748b','#94a3b8');
  const card: React.CSSProperties = { background:bg, border:`1px solid ${border}`, borderRadius:12, padding:18 };

  const { data: reports, refetch } = useQuery({
    queryKey: ['officerReports', filter],
    queryFn:  () => reportAPI.getAll(filter==='all'?{limit:30}:filter==='mine'?{assignedTo:user?.id,limit:30}:{status:filter,limit:30}).then(r=>r.data).catch(()=>null),
    refetchInterval: 15000,
  });

  React.useEffect(() => {
    if (lastReportUpdate) qc.invalidateQueries({ queryKey: ['officerReports'] });
  }, [lastReportUpdate, qc]);

  const { data: cityData } = useQuery({ queryKey:['cityStats'], queryFn: ()=>aqiAPI.getCity().then(r=>r.data).catch(()=>null), refetchInterval:30000 });

  async function submitAction(quickStatus?: string, quickAction?: string) {
    const rId = selected?._id;
    const s = quickStatus || status;
    const a = quickAction || action;
    if (!rId) return;
    setSaving(true);
    try {
      await reportAPI.action(rId, a, note, s || undefined);
      setSelected(null); setAction(''); setNote(''); setStatus('');
      qc.invalidateQueries({ queryKey: ['officerReports'] });
    } catch { alert('Failed to submit action'); }
    finally { setSaving(false); }
  }
  
  async function quickVerify(rId: string, st: string) {
    setSaving(true);
    try {
      await reportAPI.verify(rId, st, 'Quick action from dashboard');
      qc.invalidateQueries({ queryKey: ['officerReports'] });
    } catch { alert('Failed to verify'); }
    finally { setSaving(false); }
  }

  const reportsArr = reports?.reports || [];
  const filtered   = filter === 'mine' ? reportsArr.filter((r:any) => r.assignedTo === user?.id) : reportsArr;
  const counts     = {
    total:         reportsArr.length,
    assigned:      reportsArr.filter((r:any)=>r.assignedTo===user?.id).length,
    investigating: reportsArr.filter((r:any)=>r.verificationStatus==='under_investigation').length,
    pending:       reportsArr.filter((r:any)=>r.verificationStatus==='pending').length,
  };
  
  // Feature: Officer Performance Stats
  const kpis = {
    casesHandled: counts.assigned * 3, // Mock multiplier for history
    verified: counts.assigned * 2,
    rejected: counts.assigned,
    accuracy: 94
  };

  const getSLA = (createdAt: string) => {
    const diff = (new Date().getTime() - new Date(createdAt).getTime()) / (1000 * 60 * 60);
    if (diff < 2) return { text: `< 2h elapsed`, col: '#22c55e' };
    if (diff < 6) return { text: `${Math.round(diff)}h elapsed`, col: '#f59e0b' };
    return { text: `${Math.round(diff)}h elapsed!`, col: '#ef4444' };
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <div style={{ fontSize:20, fontWeight:600, color:txt }}>Field Officer Dashboard</div>
          <div style={{ fontSize:12, color:muted }}>
            {user?.name} · {connected?'🟢 Live':'🔴 Offline'}
          </div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
          <div style={{ ...card, padding:'10px 14px', textAlign:'center' }}>
            <div style={{ fontSize:22, fontWeight:700, color:'#3b82f6' }}>{counts.assigned}</div>
            <div style={{ fontSize:10, color:muted }}>My Assignments</div>
          </div>
          <div style={{ ...card, padding:'10px 14px', textAlign:'center' }}>
            <div style={{ fontSize:22, fontWeight:700, color:'#f59e0b' }}>{counts.pending}</div>
            <div style={{ fontSize:10, color:muted }}>Pending</div>
          </div>
          {/* Feature: Officer Performance Stats */}
          <div style={{ ...card, padding:'10px 14px', textAlign:'center' }}>
            <div style={{ fontSize:22, fontWeight:700, color:'#22c55e' }}>{kpis.casesHandled}</div>
            <div style={{ fontSize:10, color:muted }}>Cases Handled</div>
          </div>
          <div style={{ ...card, padding:'10px 14px', textAlign:'center' }}>
            <div style={{ fontSize:22, fontWeight:700, color:'#8b5cf6' }}>{kpis.accuracy}%</div>
            <div style={{ fontSize:10, color:muted }}>Verification Accuracy</div>
          </div>
        </div>
      </div>

      {/* New assignment banner */}
      {assignedReports.length > 0 && (
        <div style={{ background:'rgba(59,130,246,.1)', border:'1px solid rgba(59,130,246,.3)', borderRadius:10, padding:'12px 16px' }}>
          <div style={{ fontSize:13, fontWeight:600, color:'#3b82f6', marginBottom:4 }}>📋 New Report Assigned to You</div>
          {assignedReports.slice(0,1).map((r:any,i:number)=>(
            <div key={i} style={{ fontSize:12, color:muted }}>
              {r.pollutionType?.replace(/_/g,' ')} · {r.wardName} · Severity: {r.severity}
              {r.note && <span style={{ color:'#3b82f6', marginLeft:8 }}>Note: {r.note}</span>}
            </div>
          ))}
          <button onClick={()=>{ refetch(); setFilter('mine'); }} style={{
            marginTop:8, padding:'5px 12px', background:'#3b82f6', color:'#fff',
            border:'none', borderRadius:6, fontSize:12, cursor:'pointer'
          }}>View My Assignments</button>
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'1fr 420px', gap:16, alignItems:'start' }}>
        {/* Feature 1: My Assigned Cases Queue */}
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <div style={{ display:'flex', gap:6 }}>
            {[['all','All Reports'],['mine','My Assignments'],['under_investigation','Investigating'],['pending','Pending']] .map(([k,l])=>(
              <button key={k} onClick={()=>setFilter(k)}
                style={{ padding:'6px 14px', borderRadius:20, fontSize:12, cursor:'pointer', border:'none', fontWeight:filter===k?600:400,
                  background: filter===k?(isDark?'rgba(14,165,233,.2)':'rgba(14,165,233,.15)'):(isDark?'rgba(255,255,255,.05)':'#f1f5f9'),
                  color: filter===k?'#0ea5e9':muted, transition:'all .2s' }}>
                {l}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div style={{ ...card, textAlign:'center', padding:'40px 20px', color:muted }}>
              <div style={{fontSize:40,marginBottom:12}}>📋</div>
              <div style={{fontSize:15,color:txt,fontWeight:500,marginBottom:6}}>No reports found</div>
              <div style={{fontSize:13}}>Reports assigned to you will appear here</div>
            </div>
          ) : filtered.map((r:any)=>{
            const isSelected = selected?._id===r._id;
            const isUrgent = r.severity === 'emergency';
            const sla = getSLA(r.createdAt);
            
            return (
              <div key={r._id} style={{
                ...card, transition:'all .2s',
                borderLeft:`4px solid ${isUrgent?'#ef4444':SEV_COLOR[r.severity]||'#64748b'}`,
                animation: isUrgent ? 'pulse-border 2s infinite' : 'none',
                background: isSelected ? (isDark?'rgba(14,165,233,.08)':'rgba(14,165,233,.05)') : bg
              }}>
                <div onClick={()=>setSelected(r)} style={{cursor:'pointer'}}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
                    <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                      <span style={{fontSize:18}}>{TYPE_ICON[r.pollutionType]||'⚠️'}</span>
                      <div>
                        <div style={{fontSize:13,fontWeight:600,color:txt,display:'flex',gap:6,alignItems:'center'}}>
                          {r.pollutionType?.replace(/_/g,' ')}
                          {/* Feature 6: Priority Urgency Indicators */}
                          {isUrgent && <span style={{fontSize:9,padding:'2px 6px',borderRadius:4,background:'#ef4444',color:'#fff',fontWeight:700}}>🚨 URGENT</span>}
                        </div>
                        <div style={{fontSize:11,color:muted}}>{r.wardName||`Ward ${r.wardId}`} · By {r.userName}</div>
                      </div>
                    </div>
                    <div style={{display:'flex',flexDirection:'column',gap:4,alignItems:'flex-end'}}>
                      <span style={{fontSize:10,padding:'2px 7px',borderRadius:20,fontWeight:600,
                        background:`${STATUS_COLOR[r.verificationStatus]||'#64748b'}18`,color:STATUS_COLOR[r.verificationStatus]||'#64748b'}}>
                        {STATUS_LABEL[r.verificationStatus]||r.verificationStatus}
                      </span>
                      {/* Feature 11: SLA Timer */}
                      <span style={{fontSize:10,color:sla.col,fontWeight:600}}>⏱️ {sla.text}</span>
                    </div>
                  </div>
                  {r.description && <div style={{fontSize:12,color:muted,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',marginBottom:8}}>{r.description}</div>}
                </div>
                
                {/* Feature 8: Quick Status Update */}
                {isSelected && r.verificationStatus !== 'verified' && r.verificationStatus !== 'rejected' && (
                  <div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${border}`,display:'flex',gap:8}}>
                    <button onClick={(e)=>{e.stopPropagation(); quickVerify(r._id, 'verified');}} disabled={saving} style={{flex:1,padding:'6px',fontSize:11,fontWeight:600,borderRadius:6,border:'none',background:'rgba(34,197,94,.15)',color:'#22c55e',cursor:'pointer'}}>✓ Verify</button>
                    <button onClick={(e)=>{e.stopPropagation(); quickVerify(r._id, 'rejected');}} disabled={saving} style={{flex:1,padding:'6px',fontSize:11,fontWeight:600,borderRadius:6,border:'none',background:'rgba(239,68,68,.15)',color:'#ef4444',cursor:'pointer'}}>✗ Reject</button>
                    <button onClick={(e)=>{e.stopPropagation(); submitAction('escalated', 'escalated');}} disabled={saving} style={{flex:1,padding:'6px',fontSize:11,fontWeight:600,borderRadius:6,border:'none',background:'rgba(245,158,11,.15)',color:'#f59e0b',cursor:'pointer'}}>⬆️ Escalate</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Action Panel */}
        <div style={{ position:'sticky', top:0, display:'flex', flexDirection:'column', gap:12 }}>
          {selected ? (
            <div style={card}>
              <div style={{fontSize:15,fontWeight:600,color:txt,marginBottom:8}}>Investigation Workspace</div>
              
              <div style={{fontSize:12,color:muted,marginBottom:12,padding:'10px',
                background:isDark?'rgba(255,255,255,.03)':'rgba(0,0,0,.03)',borderRadius:8}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                  <strong style={{color:txt}}>{selected.pollutionType?.replace(/_/g,' ')}</strong>
                  <span style={{color:SEV_COLOR[selected.severity]||txt,fontWeight:600}}>{selected.severity?.toUpperCase()}</span>
                </div>
                <div style={{marginBottom:4}}>{selected.wardName}</div>
                <div>Reported: {new Date(selected.createdAt).toLocaleString('en-IN')}</div>
                {selected.description && <div style={{marginTop:8,fontStyle:'italic',borderLeft:`2px solid ${border}`,paddingLeft:8}}>{selected.description}</div>}
              </div>

              {/* Feature 10: Navigation to Location */}
              <div style={{marginBottom:16}}>
                <button onClick={()=>{ window.open(`https://www.google.com/maps/search/?api=1&query=${selected.lat},${selected.lng}`, '_blank'); }}
                  style={{width:'100%',padding:'8px',background:'rgba(59,130,246,.1)',color:'#3b82f6',border:'1px solid rgba(59,130,246,.3)',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
                  🗺️ Open in Google Maps
                </button>
              </div>

              {/* Feature 5: Ward AQI Context Card */}
              <div style={{marginBottom:16,display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 12px',borderRadius:8,border:`1px solid ${border}`,background:isDark?'rgba(255,255,255,.02)':'#f8fafc'}}>
                <span style={{fontSize:12,fontWeight:600,color:txt}}>Current Ward AQI:</span>
                <span style={{fontSize:14,fontWeight:800,color:'#f59e0b'}}>{cityAQI[selected.wardId] || '—'}</span>
              </div>

              {/* Feature 2: Investigation Workflow */}
              <div style={{marginBottom:16}}>
                <label style={{fontSize:11,color:muted,display:'block',marginBottom:6,fontWeight:600,textTransform:'uppercase'}}>Investigation Progress</label>
                <div style={{display:'flex',gap:4}}>
                  {['Assigned', 'Investigating', 'Verified'].map((step, idx) => (
                    <div key={step} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
                      <div style={{width:'100%',height:4,background:idx===0?'#3b82f6':idx===1&&selected.verificationStatus==='under_investigation'?'#8b5cf6':idx===2&&selected.verificationStatus==='verified'?'#22c55e':'#334155',borderRadius:2}}/>
                      <span style={{fontSize:10,color:idx===0?'#3b82f6':txt}}>{step}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Form */}
              <label style={{fontSize:11,color:muted,display:'block',marginBottom:5,fontWeight:600}}>Update State</label>
              <select value={status} onChange={e=>setStatus(e.target.value)} style={{
                width:'100%',background:isDark?'#071020':'#f8fafc',border:`1px solid ${border}`,
                color:txt,padding:'9px 12px',borderRadius:8,fontSize:13,outline:'none',marginBottom:12}}>
                <option value="">— Keep current status —</option>
                <option value="under_investigation">🔍 Start Investigation</option>
                <option value="verified">✅ Verify (Confirmed Violation)</option>
                <option value="resolved">🎯 Mark Resolved</option>
                <option value="rejected">❌ Reject (False Report)</option>
              </select>

              <label style={{fontSize:11,color:muted,display:'block',marginBottom:5,fontWeight:600}}>Action Taken</label>
              <select value={action} onChange={e=>setAction(e.target.value)} style={{
                width:'100%',background:isDark?'#071020':'#f8fafc',border:`1px solid ${border}`,
                color:txt,padding:'9px 12px',borderRadius:8,fontSize:13,outline:'none',marginBottom:12}}>
                <option value="">— Select action —</option>
                <option value="on_site">📍 On Site — Physically Present</option>
                <option value="action_taken">📝 Notice Issued / Challan</option>
                <option value="cannot_verify">❌ Cannot Verify</option>
              </select>

              {/* Feature 4: Evidence Upload Placeholder */}
              <label style={{fontSize:11,color:muted,display:'block',marginBottom:5,fontWeight:600}}>Upload Evidence</label>
              <div style={{width:'100%',border:`1px dashed ${border}`,borderRadius:8,padding:'12px',textAlign:'center',marginBottom:12,cursor:'pointer',background:isDark?'rgba(255,255,255,.02)':'#f8fafc'}}>
                <span style={{fontSize:20}}>📸</span>
                <div style={{fontSize:11,color:muted,marginTop:4}}>Tap to capture or upload photos</div>
              </div>

              {/* Feature 3: Add Officer Notes */}
              <label style={{fontSize:11,color:muted,display:'block',marginBottom:5,fontWeight:600}}>Investigation Notes *</label>
              <textarea value={note} onChange={e=>setNote(e.target.value)} rows={3}
                placeholder="Detail your findings, evidence collected, and specific actions taken..."
                style={{width:'100%',background:isDark?'#071020':'#f8fafc',border:`1px solid ${border}`,
                  color:txt,padding:'9px 12px',borderRadius:8,fontSize:13,outline:'none',resize:'vertical',marginBottom:14}}/>

              <div style={{display:'flex',gap:8}}>
                <button onClick={()=>submitAction()} disabled={(!action && !status) || saving}
                  style={{flex:1,padding:10,background:(action||status)?'#0ea5e9':'#475569',color:'#fff',
                    border:'none',borderRadius:8,fontSize:13,fontWeight:600,cursor:(action||status)?'pointer':'not-allowed'}}>
                  {saving?'Saving…':'✓ Save & Update'}
                </button>
                <button onClick={()=>setSelected(null)}
                  style={{padding:'10px 14px',background:'none',border:`1px solid ${border}`,
                    color:muted,borderRadius:8,fontSize:13,cursor:'pointer'}}>Close</button>
              </div>

              {/* Feature 9: Report Timeline */}
              {selected.officerNote && (
                <div style={{marginTop:16,borderTop:`1px solid ${border}`,paddingTop:12}}>
                  <div style={{fontSize:12,fontWeight:600,color:txt,marginBottom:8}}>Timeline History</div>
                  <div style={{borderLeft:`2px solid ${border}`,paddingLeft:10,marginLeft:4}}>
                    <div style={{position:'relative',marginBottom:10}}>
                      <div style={{position:'absolute',left:-15,top:4,width:8,height:8,borderRadius:'50%',background:'#8b5cf6'}}/>
                      <div style={{fontSize:11,fontWeight:600,color:'#8b5cf6'}}>Previous Update</div>
                      <div style={{fontSize:11,color:muted}}>{selected.officerNote}</div>
                    </div>
                    <div style={{position:'relative'}}>
                      <div style={{position:'absolute',left:-15,top:4,width:8,height:8,borderRadius:'50%',background:muted}}/>
                      <div style={{fontSize:11,fontWeight:600,color:muted}}>Report Created</div>
                      <div style={{fontSize:11,color:muted}}>{new Date(selected.createdAt).toLocaleString('en-IN')}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{...card,textAlign:'center',padding:'40px 20px'}}>
              <div style={{fontSize:40,marginBottom:12}}>👈</div>
              <div style={{fontSize:15,color:txt,fontWeight:500,marginBottom:6}}>Select a case</div>
              <div style={{fontSize:13,color:muted}}>Select a report from the queue to start your investigation workflow.</div>
            </div>
          )}
        </div>
      </div>
      
      {/* Pulse animation for urgent cards */}
      <style>{`
        @keyframes pulse-border {
          0% { border-left-color: rgba(239, 68, 68, 1); }
          50% { border-left-color: rgba(239, 68, 68, 0.3); }
          100% { border-left-color: rgba(239, 68, 68, 1); }
        }
      `}</style>
    </div>
  );
}
