// pages/admin/roster.js — Feature 6: Jadwal Shift Dinamis (Roster)
import AdminLayout from '../../components/AdminLayout'
import { useState, useEffect, useCallback } from 'react'

const DAYS_ID = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']

function getWeekDates(anchor) {
  // anchor = Date, returns Mon–Sun of that week
  const d = new Date(anchor)
  const day = d.getDay() // 0=Sun
  const mon = new Date(d)
  mon.setDate(d.getDate() - ((day === 0 ? 7 : day) - 1))
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(mon)
    dd.setDate(mon.getDate() + i)
    return dd
  })
}

function isoDate(d) {
  return d.toISOString().split('T')[0]
}

function fmtDay(d) {
  return d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })
}

const SHIFT_COLORS = [
  'bg-blue-100 text-blue-700 border-blue-200',
  'bg-emerald-100 text-emerald-700 border-emerald-200',
  'bg-violet-100 text-violet-700 border-violet-200',
  'bg-amber-100 text-amber-700 border-amber-200',
  'bg-pink-100 text-pink-700 border-pink-200',
  'bg-cyan-100 text-cyan-700 border-cyan-200',
]

const ATTENDANCE_DOT = {
  present:  'bg-emerald-500',
  late:     'bg-amber-500',
  absent:   'bg-red-500',
  leave:    'bg-blue-500',
  half_day: 'bg-orange-500',
}

export default function RosterPage() {
  const [weekAnchor, setWeekAnchor]   = useState(new Date())
  const [weekDates, setWeekDates]     = useState([])
  const [employees, setEmployees]     = useState([])
  const [shifts, setShifts]           = useState([])
  const [rosters, setRosters]         = useState([]) // { employee_id, date, shift_id, is_off }
  const [attendances, setAttendances] = useState([])
  const [branches, setBranches]       = useState([])
  const [branchFilter, setBranchFilter] = useState('')
  const [deptFilter, setDeptFilter]   = useState('')
  const [loading, setLoading]         = useState(true)
  const [saving, setSaving]           = useState({}) // { 'empId_date': true }
  const [dragShift, setDragShift]     = useState(null) // shift being dragged
  const [bulkMode, setBulkMode]       = useState(false)
  const [bulkSelected, setBulkSelected] = useState([]) // ['empId_date']
  const [bulkShift, setBulkShift]     = useState(null)
  const [shiftMap, setShiftMap]       = useState({}) // id → color index

  useEffect(() => {
    const dates = getWeekDates(weekAnchor)
    setWeekDates(dates)
    fetchAll(dates)
  }, [weekAnchor])

  useEffect(() => {
    fetch('/api/admin/branches').then(r => r.json()).then(d => setBranches(d.branches || []))
  }, [])

  useEffect(() => {
    const map = {}
    shifts.forEach((s, i) => { map[s.id] = i % SHIFT_COLORS.length })
    setShiftMap(map)
  }, [shifts])

  async function fetchAll(dates) {
    setLoading(true)
    const start = isoDate(dates[0])
    const end   = isoDate(dates[6])
    const qs    = branchFilter ? `&branch_id=${branchFilter}` : ''
    const r     = await fetch(`/api/admin/roster?start_date=${start}&end_date=${end}${qs}`)
    const d     = await r.json()
    setEmployees(d.employees || [])
    setRosters(d.rosters || [])
    setAttendances(d.attendances || [])
    setShifts(d.shifts || [])
    setLoading(false)
  }

  function getRoster(empId, date) {
    return rosters.find(r => r.employee_id === empId && r.date === date) || null
  }

  function getAttendance(empId, date) {
    return attendances.find(a => a.employee_id === empId && a.date === date) || null
  }

  function getDefaultShift(emp) {
    return shifts.find(s => s.id === emp.shift_id) || null
  }

  async function setRosterCell(empId, date, shiftId, isOff = false) {
    const key = `${empId}_${date}`
    setSaving(s => ({ ...s, [key]: true }))
    await fetch('/api/admin/roster', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employee_id: empId, date, shift_id: shiftId, is_off: isOff }),
    })
    setRosters(prev => {
      const filtered = prev.filter(r => !(r.employee_id === empId && r.date === date))
      return [...filtered, { employee_id: empId, date, shift_id: shiftId, is_off: isOff }]
    })
    setSaving(s => { const n = { ...s }; delete n[key]; return n })
  }

  async function applyBulk() {
    if (!bulkShift && !bulkSelected.includes('off')) return
    const entries = bulkSelected.map(key => {
      const [empId, date] = key.split('_DATE_')
      return { employee_id: empId, date, shift_id: bulkShift === 'off' ? null : bulkShift, is_off: bulkShift === 'off' }
    })
    await fetch('/api/admin/roster', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries }),
    })
    setRosters(prev => {
      const map = new Map(prev.map(r => [`${r.employee_id}_${r.date}`, r]))
      entries.forEach(e => map.set(`${e.employee_id}_${e.date}`, e))
      return Array.from(map.values())
    })
    setBulkSelected([])
    setBulkMode(false)
  }

  function toggleBulkCell(empId, date) {
    const key = `${empId}_DATE_${date}`
    setBulkSelected(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  function copyWeek(direction) {
    // Copy this week to next or previous week
    const offset = direction === 'next' ? 7 : -7
    const newEntries = []
    for (const date of weekDates) {
      const targetDate = new Date(date)
      targetDate.setDate(targetDate.getDate() + offset)
      const tStr = isoDate(targetDate)
      for (const emp of filteredEmployees) {
        const r = getRoster(emp.id, isoDate(date))
        if (r) {
          newEntries.push({ employee_id: emp.id, date: tStr, shift_id: r.shift_id, is_off: r.is_off })
        }
      }
    }
    if (!newEntries.length) return
    if (!confirm(`Salin ${newEntries.length} roster ke minggu ${direction === 'next' ? 'depan' : 'lalu'}?`)) return
    fetch('/api/admin/roster', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries: newEntries }),
    }).then(() => {
      const newAnchor = new Date(weekAnchor)
      newAnchor.setDate(newAnchor.getDate() + offset)
      setWeekAnchor(newAnchor)
    })
  }

  const depts = [...new Set(employees.map(e => e.department).filter(Boolean))].sort()
  const filteredEmployees = employees.filter(e => {
    if (deptFilter && e.department !== deptFilter) return false
    return true
  })

  const today = isoDate(new Date())

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-slate-900">Jadwal Roster</h1>
          <p className="text-slate-500 text-sm mt-0.5">Atur jadwal shift karyawan per minggu</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => copyWeek('prev')} className="btn-secondary text-xs py-1.5">← Salin ke Minggu Lalu</button>
          <button onClick={() => copyWeek('next')} className="btn-secondary text-xs py-1.5">Salin ke Minggu Depan →</button>
          <button
            onClick={() => { setBulkMode(b => !b); setBulkSelected([]) }}
            className={`text-xs py-1.5 px-3 rounded-lg font-medium border transition-all ${bulkMode ? 'bg-violet-600 text-white border-violet-600' : 'border-slate-200 text-slate-600 hover:border-violet-300'}`}>
            {bulkMode ? '✕ Batal Bulk' : '⚡ Bulk Edit'}
          </button>
        </div>
      </div>

      {/* Week nav + filters */}
      <div className="card flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => { const d = new Date(weekAnchor); d.setDate(d.getDate() - 7); setWeekAnchor(d) }}
            className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50 text-slate-600">‹</button>
          <span className="text-sm font-semibold text-slate-800 min-w-[180px] text-center">
            {weekDates.length ? `${fmtDay(weekDates[0])} – ${fmtDay(weekDates[6])}` : '...'}
          </span>
          <button onClick={() => { const d = new Date(weekAnchor); d.setDate(d.getDate() + 7); setWeekAnchor(d) }}
            className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50 text-slate-600">›</button>
          <button onClick={() => setWeekAnchor(new Date())}
            className="text-xs text-blue-600 hover:underline ml-1">Hari Ini</button>
        </div>

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <select className="input text-xs py-1.5 w-36" value={branchFilter}
            onChange={e => { setBranchFilter(e.target.value) }}>
            <option value="">Semua Cabang</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <select className="input text-xs py-1.5 w-36" value={deptFilter}
            onChange={e => setDeptFilter(e.target.value)}>
            <option value="">Semua Dept</option>
            {depts.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      {/* Bulk action bar */}
      {bulkMode && bulkSelected.length > 0 && (
        <div className="card border border-violet-200 bg-violet-50 flex items-center gap-3 flex-wrap">
          <span className="text-violet-700 font-semibold text-sm">{bulkSelected.length} sel dipilih</span>
          <select className="input text-sm py-1.5 w-40" value={bulkShift || ''}
            onChange={e => setBulkShift(e.target.value || null)}>
            <option value="">Pilih shift...</option>
            {shifts.map(s => <option key={s.id} value={s.id}>{s.name} ({s.start_time}–{s.end_time})</option>)}
            <option value="off">🚫 Hari Libur</option>
          </select>
          <button onClick={applyBulk} disabled={!bulkShift}
            className="btn-primary text-sm py-1.5">Terapkan</button>
          <button onClick={() => setBulkSelected([])} className="text-xs text-violet-600 hover:underline">Deselect semua</button>
        </div>
      )}

      {/* Shift Legend */}
      <div className="flex items-center gap-2 flex-wrap">
        {shifts.map((s, i) => (
          <span key={s.id}
            className={`text-xs px-2.5 py-1 rounded-full border font-medium ${SHIFT_COLORS[i % SHIFT_COLORS.length]}`}
            draggable
            onDragStart={() => setDragShift(s.id)}
            onDragEnd={() => setDragShift(null)}
            style={{ cursor: 'grab' }}>
            {s.name} · {s.start_time}–{s.end_time}
          </span>
        ))}
        <span className="text-xs px-2.5 py-1 rounded-full border font-medium bg-slate-100 text-slate-500 border-slate-200"
          draggable onDragStart={() => setDragShift('off')} onDragEnd={() => setDragShift(null)}
          style={{ cursor: 'grab' }}>
          🚫 Libur
        </span>
        {dragShift && (
          <span className="text-xs text-blue-600 animate-pulse ml-2">
            ↕ Drag ke sel untuk mengatur jadwal
          </span>
        )}
      </div>

      {/* Roster Grid */}
      {loading ? (
        <div className="flex justify-center py-16"><div className="spinner spinner-blue" /></div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-4 py-3 text-xs text-slate-500 font-semibold sticky left-0 bg-white min-w-[160px]">
                  Karyawan ({filteredEmployees.length})
                </th>
                {weekDates.map(d => {
                  const isToday = isoDate(d) === today
                  const isWknd  = d.getDay() === 0 || d.getDay() === 6
                  return (
                    <th key={isoDate(d)}
                      className={`px-2 py-3 text-center text-xs font-semibold min-w-[100px] ${isToday ? 'text-blue-600' : isWknd ? 'text-slate-400' : 'text-slate-500'}`}>
                      <div>{DAYS_ID[d.getDay()]}</div>
                      <div className={`text-base font-bold mt-0.5 ${isToday ? 'w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto' : ''}`}>
                        {d.getDate()}
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredEmployees.map(emp => (
                <tr key={emp.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-2 sticky left-0 bg-white border-r border-slate-100">
                    <p className="text-sm font-semibold text-slate-800 leading-tight">{emp.name}</p>
                    <p className="text-xs text-slate-400">{emp.department}</p>
                    {emp.shifts && (
                      <p className="text-[10px] text-slate-400 mt-0.5">Default: {emp.shifts.name}</p>
                    )}
                  </td>
                  {weekDates.map(d => {
                    const dateStr = isoDate(d)
                    const roster  = getRoster(emp.id, dateStr)
                    const att     = getAttendance(emp.id, dateStr)
                    const keyStr  = `${emp.id}_DATE_${dateStr}`
                    const savKey  = `${emp.id}_${dateStr}`
                    const isSaving = saving[savKey]
                    const isWknd  = d.getDay() === 0 || d.getDay() === 6
                    const isSelected = bulkSelected.includes(keyStr)

                    // Effective shift: roster override → default shift
                    let effectiveShift = null
                    if (roster?.is_off) {
                      effectiveShift = null // libur
                    } else if (roster?.shift_id) {
                      effectiveShift = shifts.find(s => s.id === roster.shift_id)
                    } else {
                      effectiveShift = getDefaultShift(emp)
                    }

                    const colorIdx  = effectiveShift ? (shiftMap[effectiveShift.id] ?? 0) : -1
                    const shiftCls  = colorIdx >= 0 ? SHIFT_COLORS[colorIdx] : ''
                    const isLibur   = roster?.is_off

                    return (
                      <td key={dateStr} className={`px-1.5 py-1.5 text-center ${isWknd ? 'bg-slate-50/80' : ''} ${isSelected ? 'ring-2 ring-violet-400 ring-inset' : ''}`}
                        onDragOver={e => e.preventDefault()}
                        onDrop={() => {
                          if (!dragShift) return
                          setRosterCell(emp.id, dateStr, dragShift === 'off' ? null : dragShift, dragShift === 'off')
                        }}
                        onClick={() => bulkMode && toggleBulkCell(emp.id, dateStr)}>
                        {isSaving ? (
                          <div className="flex justify-center items-center h-10">
                            <div className="spinner spinner-blue w-4 h-4" />
                          </div>
                        ) : (
                          <div className="relative group">
                            {/* Cell content */}
                            <div className={`rounded-lg px-1.5 py-1 text-[10px] font-medium border cursor-pointer min-h-[36px] flex flex-col items-center justify-center gap-0.5 transition-all
                              ${isLibur ? 'bg-slate-100 text-slate-400 border-slate-200 line-through' : effectiveShift ? `${shiftCls}` : 'bg-white border-slate-100 text-slate-300'}
                              ${!roster && !isLibur ? 'opacity-60' : ''}
                              ${bulkMode ? 'hover:ring-2 hover:ring-violet-300' : 'hover:shadow-sm'}
                            `}>
                              {isLibur ? (
                                <span>🚫 Libur</span>
                              ) : effectiveShift ? (
                                <>
                                  <span className="font-semibold">{effectiveShift.name}</span>
                                  <span className="opacity-70">{effectiveShift.start_time}–{effectiveShift.end_time}</span>
                                </>
                              ) : (
                                <span>—</span>
                              )}
                              {/* Attendance dot */}
                              {att && (
                                <span className={`w-1.5 h-1.5 rounded-full mt-0.5 ${ATTENDANCE_DOT[att.status] || 'bg-slate-300'}`} title={att.status} />
                              )}
                              {/* Override indicator */}
                              {roster && !roster.is_off && (
                                <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-violet-400 rounded-full" title="Override roster" />
                              )}
                            </div>

                            {/* Hover dropdown — only in non-bulk mode */}
                            {!bulkMode && (
                              <div className="absolute top-full left-0 z-20 hidden group-hover:flex flex-col bg-white border border-slate-200 rounded-xl shadow-lg py-1 min-w-[140px] mt-1">
                                {shifts.map((s, i) => (
                                  <button key={s.id} onClick={() => setRosterCell(emp.id, dateStr, s.id, false)}
                                    className={`text-left px-3 py-1.5 text-xs hover:bg-slate-50 flex items-center gap-2`}>
                                    <span className={`w-2 h-2 rounded-full ${SHIFT_COLORS[i % SHIFT_COLORS.length].split(' ')[0]}`} />
                                    {s.name} · {s.start_time}
                                  </button>
                                ))}
                                <button onClick={() => setRosterCell(emp.id, dateStr, null, true)}
                                  className="text-left px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50">
                                  🚫 Set Libur
                                </button>
                                {roster && (
                                  <button onClick={() => {
                                    setRosters(prev => prev.filter(r => !(r.employee_id === emp.id && r.date === dateStr)))
                                    fetch('/api/admin/roster', {
                                      method: 'PUT',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ employee_id: emp.id, date: dateStr, shift_id: null, is_off: false, reset: true }),
                                    })
                                  }} className="text-left px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 border-t border-slate-100">
                                    ↩ Reset ke Default
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          {filteredEmployees.length === 0 && (
            <div className="text-center py-16 text-slate-400">Tidak ada karyawan ditemukan</div>
          )}
        </div>
      )}

      {/* Legend attendance status */}
      <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
        <span className="font-semibold">Status absensi:</span>
        {[['bg-emerald-500','Hadir'],['bg-amber-500','Terlambat'],['bg-red-500','Absen'],['bg-blue-500','Izin']].map(([cls,lbl]) => (
          <span key={lbl} className="flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${cls} inline-block`} />{lbl}
          </span>
        ))}
        <span className="flex items-center gap-1 ml-2">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-400 inline-block" /> Override roster
        </span>
      </div>
    </div>
  )
}

RosterPage.getLayout = (page) => <AdminLayout>{page}</AdminLayout>
