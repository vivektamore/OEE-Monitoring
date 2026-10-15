
import { useEffect, useState } from 'react'
import './App.css'

const cells = [
  { id: 'A', name: 'Press Shop', machines: 10, oee: 78.4 },
  { id: 'B', name: 'Screw Forging', machines: 10, oee: 82.1 },
  { id: 'C', name: 'Grooving', machines: 10, oee: 74.8 },
  { id: 'D', name: 'Deburring', machines: 10, oee: 86.2 },
  { id: 'E', name: 'Laser Marking', machines: 10, oee: 91.3 },
  { id: 'F', name: 'Reserved Cell', machines: 10, oee: null },
  { id: 'G', name: 'Reserved Cell', machines: 10, oee: null },
  { id: 'H', name: 'Reserved Cell', machines: 10, oee: null },
  { id: 'I', name: 'Reserved Cell', machines: 10, oee: null },
  { id: 'J', name: 'Reserved Cell', machines: 10, oee: null },
]

const navGroups = [
  {
    title: 'MONITORING',
    items: [
      ['▦', 'Dashboard'],
      ['▤', 'Cells'],
      ['⚙', 'Machines'],
      ['◉', 'OEE Analysis'],
    ],
  },
  {
    title: 'PRODUCTION',
    items: [
      ['▣', 'Production Plan'],
      ['♙', 'Manpower'],
      ['◷', 'Hourly Data'],
      ['▤', 'Shift Data'],
      ['◔', 'Utilization'],
    ],
  },
  {
    title: 'ANALYTICS',
    items: [
      ['▥', 'Graph Analysis'],
      ['▧', 'Reports'],
      ['◴', 'Downtime'],
    ],
  },
  {
    title: 'MAINTENANCE',
    items: [
      ['⚒', 'Maintenance'],
      ['⌁', 'PLC Status'],
    ],
  },
  {
    title: 'SYSTEM',
    items: [
      ['⚙', 'Settings'],
      ['♙', 'Users'],
    ],
  },
]

// Retained for the existing dashboard design.
// Production Trend uses live data from the backend.
const hours = [
  { hour: '06:45', production: 120 },
  { hour: '07:45', production: 180 },
  { hour: '08:45', production: 210 },
  { hour: '09:45', production: 160 },
  { hour: '10:45', production: 240 },
  { hour: '11:45', production: 195 },
  { hour: '12:45', production: 260 },
  { hour: '13:45', production: 225 },
  { hour: '14:45', production: 285 },
  { hour: '15:45', production: 205 },
  { hour: '16:45', production: 245 },
  { hour: '17:45', production: 175 },
]

const machineRows = [
  { name: 'AA1', cell: 'A', status: 'Running', production: 706, running: 11, oee: null },
  { name: 'AA2', cell: 'A', status: 'Not configured', production: '—', running: '—', oee: null },
  { name: 'AA3', cell: 'A', status: 'Not configured', production: '—', running: '—', oee: null },
  { name: 'AA4', cell: 'A', status: 'Not configured', production: '—', running: '—', oee: null },
  { name: 'AA5', cell: 'A', status: 'Not configured', production: '—', running: '—', oee: null },
]

function KpiCard({ title, value, unit, detail, color, icon }) {
  return (
    <div className="kpi-card">
      <div className="kpi-top">
        <span className="kpi-label">{title}</span>
        <span className={`kpi-icon ${color}`}>{icon}</span>
      </div>
      <div className="kpi-value">
        {value}<span>{unit}</span>
      </div>
      <div className="kpi-bottom">{detail}</div>
      <div className={`kpi-line ${color}`} />
    </div>
  )
}

function SectionTitle({ title, subtitle, right }) {
  return (
    <div className="section-heading">
      <div>
        <h2>{title}</h2>
        {subtitle && <p style={{ color: '#475569', fontSize: 14, lineHeight: 1.5 }}>{subtitle}</p>}
      </div>
      {right && <div className="section-action">{right}</div>}
    </div>
  )
}

function App() {
  const [activePage, setActivePage] = useState('Dashboard')
  const [selectedCell, setSelectedCell] = useState('A')
  const [selectedPeriod, setSelectedPeriod] = useState('Today')
  const [selectedGraph, setSelectedGraph] = useState('Production')
  const [search, setSearch] = useState('')
  const [selectedDate, setSelectedDate] = useState(() => {
     const today = new Date()
     const year = today.getFullYear()
     const month = String(today.getMonth() + 1).padStart(2, '0')
     const day = String(today.getDate()).padStart(2, '0')

     return `${year}-${month}-${day}`
     
})


  // Production trend filters and live API data.
  const [chartPeriod, setChartPeriod] = useState('hourly')
  const [chartScope, setChartScope] = useState('machine')
  const [chartMachine, setChartMachine] = useState('AA1')
  const [chartCell, setChartCell] = useState('A')
  const [chartMonth, setChartMonth] = useState('2026-10')
  const [chartYear, setChartYear] = useState('2026')
  const [trendData, setTrendData] = useState([])
  const [trendLoading, setTrendLoading] = useState(false)
  const [trendError, setTrendError] = useState('')

  // Hourly Data live monitoring (refreshes every second while the page is open).
  const [hourlyLiveMachine, setHourlyLiveMachine] = useState('AA1')
  const [hourlyLiveData, setHourlyLiveData] = useState([])
  const [hourlyLiveLoading, setHourlyLiveLoading] = useState(false)
  const [hourlyLiveError, setHourlyLiveError] = useState('')
  const [hourlyLiveUpdatedAt, setHourlyLiveUpdatedAt] = useState('')

  // Utilization page live data.
  const [utilizationMachine, setUtilizationMachine] = useState('AA1')
  const [utilizationDate, setUtilizationDate] = useState(selectedDate)
  const [utilizationData, setUtilizationData] = useState([])
  const [utilizationLoading, setUtilizationLoading] = useState(false)
  const [utilizationError, setUtilizationError] = useState('')
  const [utilizationUpdatedAt, setUtilizationUpdatedAt] = useState('')


  // Production Plan page state.
  const [planDate, setPlanDate] = useState(() => {
    const today = new Date()
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  })
  const [planShop, setPlanShop] = useState('Press Shop')
  const [planMachine, setPlanMachine] = useState('AA1')
  const [planQuantity, setPlanQuantity] = useState('')
  const [planPin, setPlanPin] = useState('')
  const [planUnlocked, setPlanUnlocked] = useState(false)
  const [planBusy, setPlanBusy] = useState(false)
  const [planMessage, setPlanMessage] = useState('')
  const [planMessageError, setPlanMessageError] = useState(false)
  const [planRows, setPlanRows] = useState([])

  // Plan vs Actual graph filters and live API data.
  const [planActualDate, setPlanActualDate] = useState(() => {
    const today = new Date()
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  })
  const [planActualMachine, setPlanActualMachine] = useState('AA1')
  const [planActualData, setPlanActualData] = useState(null)
  const [planActualHours, setPlanActualHours] = useState([])
  const [planActualLoading, setPlanActualLoading] = useState(false)
  const [planActualError, setPlanActualError] = useState('')
  const [planActualRequested, setPlanActualRequested] = useState(false)

  // Reports page state
  const [reportEmail, setReportEmail] = useState('')
  const [reportSchedule, setReportSchedule] = useState('Daily')
  const [reportTime, setReportTime] = useState('18:00')
  const [reportCell, setReportCell] = useState('A')
  const [reportMachine, setReportMachine] = useState('AA1')
  const [reportType, setReportType] = useState('Hourly')
  const [reportStartDate, setReportStartDate] = useState(selectedDate)
  const [reportEndDate, setReportEndDate] = useState(selectedDate)
  const [reportFormat, setReportFormat] = useState('PDF')
  const [reportMessage, setReportMessage] = useState('')


  // Maintenance: utility meter readings from the backend.
  const [utilityMeters, setUtilityMeters] = useState([])
  const [utilityMeterCode, setUtilityMeterCode] = useState('LT-PANEL-01')
  const [utilityReadings, setUtilityReadings] = useState([])
  const [utilityReadingTime, setUtilityReadingTime] = useState(() => {
    const now = new Date()
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    return local.toISOString().slice(0, 16)
  })
  const [utilityReadingValue, setUtilityReadingValue] = useState('')
  const [utilityReadingRemarks, setUtilityReadingRemarks] = useState('')
  const [utilityLoading, setUtilityLoading] = useState(false)
  const [utilitySaving, setUtilitySaving] = useState(false)
  const [utilityMessage, setUtilityMessage] = useState('')
  const [utilityMessageError, setUtilityMessageError] = useState(false)

  // Calibration planning state.
  const [maintenanceTab, setMaintenanceTab] = useState('Utility Meters')
  const [calibrationPlans, setCalibrationPlans] = useState([])
  const [calibrationLoading, setCalibrationLoading] = useState(false)
  const [calibrationBusy, setCalibrationBusy] = useState(false)
  const [calibrationMessage, setCalibrationMessage] = useState('')
  const [calibrationMessageError, setCalibrationMessageError] = useState(false)
  const [calibrationPin, setCalibrationPin] = useState('')
  const [calibrationUnlocked, setCalibrationUnlocked] = useState(false)
  const [editingCalibrationId, setEditingCalibrationId] = useState(null)
  const [calibrationFilter, setCalibrationFilter] = useState('All')
  const [calibrationForm, setCalibrationForm] = useState({
    instrument_name: '',
    instrument_code: '',
    location: '',
    calibration_frequency_months: '12',
    last_calibration_date: '',
    due_date: '',
    assigned_to: '',
    calibration_agency: '',
    status: 'Planned',
    remarks: '',
  })


  useEffect(() => {
    let cancelled = false

    async function loadProductionTrend() {
      setTrendLoading(true)
      setTrendError('')

      try {
        const params = new URLSearchParams({
          scope: chartScope,
          period: chartPeriod,
        })

        if (chartScope === 'machine') {
          params.set('machine', chartMachine)
        } else {
          params.set(
            'cell',
            String(chartCell.charCodeAt(0) - 64)
          )
        }

        if (chartPeriod === 'hourly') {
          params.set('date', selectedDate)
        } else if (chartPeriod === 'daily') {
          params.set('month', chartMonth)
        } else {
          params.set('year', chartYear)
        }

        const response = await fetch(
          `http://192.168.8.163:3001/api/production-trend?${params.toString()}`
        )

        const result = await response.json()

        if (!response.ok) {
          throw new Error(
            result.message || 'Unable to load production data.'
          )
        }

        if (!cancelled) {
          const apiRows = result.data || []
          let chartRows

          if (chartPeriod === 'hourly') {
            // Map the API records by hour number.
            const hourlyMap = new Map(
              apiRows.map((item) => [
                Number(item.group_key),
                item,
              ])
            )

            // Create all 24 production-hour slots.
            chartRows = Array.from({ length: 24 }, (_, index) => {
              const hourNo = index + 1
              const item = hourlyMap.get(hourNo)

              // Production day begins at 06:45.
              const totalMinutes =
                (6 * 60 + 45 + index * 60) % (24 * 60)

              const hour = String(
                Math.floor(totalMinutes / 60)
              ).padStart(2, '0')

              const minute = String(
                totalMinutes % 60
              ).padStart(2, '0')

              return {
                label: `${hour}:${minute}`,
                production: Number(item?.production) || 0,
                running_minutes: Number(item?.running_minutes) || 0,
                downtime_minutes: Number(item?.downtime_minutes) || 0,
              }
            })
          } else {
            // Daily and monthly data are returned as grouped rows.
            chartRows = apiRows.map((item) => ({
              label: item.label,
              production: Number(item.production) || 0,
              running_minutes: Number(item.running_minutes) || 0,
              downtime_minutes: Number(item.downtime_minutes) || 0,
            }))
          }

          setTrendData(chartRows)
        }
      } catch (error) {
        if (!cancelled) {
          setTrendData([])
          setTrendError(
            error.message || 'Unable to connect to the backend.'
          )
        }
      } finally {
        if (!cancelled) {
          setTrendLoading(false)
        }
      }
    }

    loadProductionTrend()

    return () => {
      cancelled = true
    }
  }, [
    chartPeriod,
    chartScope,
    chartMachine,
    chartCell,
    chartMonth,
    chartYear,
    selectedDate,
  ])

  // Poll the existing hourly-data API every second only while Hourly Data is open.
  useEffect(() => {
    if (activePage !== 'Hourly Data') return

    let cancelled = false
    let inFlight = false

    async function loadHourlyLiveData() {
      if (inFlight) return
      inFlight = true

      try {
        const params = new URLSearchParams({
          date: selectedDate,
          machine: hourlyLiveMachine.trim(),
        })
        const response = await fetch(
          `http://192.168.8.163:3001/api/hourly-data?${params.toString()}`
        )
        const result = await response.json()
        if (!response.ok) {
          throw new Error(result.message || 'Unable to load hourly data.')
        }
        if (!cancelled) {
          setHourlyLiveData(result.hours || [])
          setHourlyLiveError('')
          setHourlyLiveUpdatedAt(new Date().toLocaleTimeString())
        }
      } catch (error) {
        if (!cancelled) {
          setHourlyLiveError(error.message || 'Unable to connect to the backend.')
        }
      } finally {
        inFlight = false
        if (!cancelled) setHourlyLiveLoading(false)
      }
    }

    setHourlyLiveLoading(true)
    loadHourlyLiveData()
    const refreshTimer = setInterval(loadHourlyLiveData, 1000)

    return () => {
      cancelled = true
      clearInterval(refreshTimer)
    }
  }, [activePage, selectedDate, hourlyLiveMachine])

  useEffect(() => {
    if (selectedGraph !== 'Plan vs Actual' || !planActualRequested) return

    let cancelled = false

    async function loadPlanVsActual() {
      setPlanActualLoading(true)
      setPlanActualError('')

      try {
        const params = new URLSearchParams({
          date: planActualDate,
          machine: planActualMachine.trim(),
        })

        // Keep using the existing daily comparison API.
        const response = await fetch(
          `http://192.168.8.163:3001/api/plan-vs-actual?${params.toString()}`
        )
        const result = await response.json()
        if (!response.ok) {
          throw new Error(result.message || 'Unable to load Plan vs Actual data.')
        }

        // Use the existing hourly-data API for runtime and production by hour.
        const hourlyResponse = await fetch(
          `http://192.168.8.163:3001/api/hourly-data?${params.toString()}`
        )
        const hourlyResult = await hourlyResponse.json()
        if (!hourlyResponse.ok) {
          throw new Error(hourlyResult.message || 'Unable to load hourly machine data.')
        }

        if (!cancelled) {
          setPlanActualData(result)
          setPlanActualHours(hourlyResult.hours || [])
        }
      } catch (error) {
        if (!cancelled) {
          setPlanActualData(null)
          setPlanActualHours([])
          setPlanActualError(error.message || 'Unable to connect to the backend.')
        }
      } finally {
        if (!cancelled) setPlanActualLoading(false)
      }
    }

    loadPlanVsActual()
    return () => { cancelled = true }
  }, [selectedGraph, planActualRequested, planActualDate, planActualMachine])

  useEffect(() => {
    if (activePage !== 'Production Plan') return
    let cancelled = false
    async function loadPlans() {
      try {
        const response = await fetch(`http://192.168.8.163:3001/api/production-plans?date=${encodeURIComponent(planDate)}`)
        const result = await response.json()
        if (!response.ok) throw new Error(result.message || 'Unable to load plans.')
        if (!cancelled) setPlanRows(result.data || [])
      } catch (error) {
        if (!cancelled) {
          setPlanRows([])
          setPlanMessage(error.message || 'Unable to load plans.')
          setPlanMessageError(true)
        }
      }
    }
    loadPlans()
    return () => { cancelled = true }
  }, [activePage, planDate])

  async function unlockPlanEditing() {
    setPlanBusy(true)
    setPlanMessage('')
    setPlanMessageError(false)
    try {
      const response = await fetch('http://192.168.8.163:3001/api/production-plan/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: planPin }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'PIN verification failed.')
      setPlanUnlocked(true)
      setPlanMessage('Editing unlocked. You can save the production plan.')
    } catch (error) {
      setPlanUnlocked(false)
      setPlanMessage(error.message || 'PIN verification failed.')
      setPlanMessageError(true)
    } finally {
      setPlanBusy(false)
    }
  }

  async function saveProductionPlan(event) {
    event.preventDefault()
    if (!planUnlocked) {
      setPlanMessage('Click Edit Production Plan and verify the 4-digit PIN first.')
      setPlanMessageError(true)
      return
    }
    setPlanBusy(true)
    setPlanMessage('')
    setPlanMessageError(false)
    try {
      const response = await fetch('http://192.168.8.163:3001/api/production-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pin: planPin,
          plan_date: planDate,
          shop_name: planShop,
          machine_name: planMachine.trim(),
          planned_quantity: planQuantity,
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Unable to save plan.')
      setPlanMessage(result.message || 'Plan saved successfully.')
      const listResponse = await fetch(`http://192.168.8.163:3001/api/production-plans?date=${encodeURIComponent(planDate)}`)
      const listResult = await listResponse.json()
      if (listResponse.ok) setPlanRows(listResult.data || [])
    } catch (error) {
      setPlanMessage(error.message || 'Unable to save plan.')
      setPlanMessageError(true)
    } finally {
      setPlanBusy(false)
    }
  }

  // Load utilization data only while the Utilization page is open.
  useEffect(() => {
    if (activePage !== 'Utilization') return
    let cancelled = false
    let inFlight = false

    async function loadUtilization() {
      if (inFlight) return
      inFlight = true
      setUtilizationLoading(true)
      try {
        const params = new URLSearchParams({
          date: utilizationDate,
          machine: utilizationMachine.trim(),
        })
        const response = await fetch(`http://192.168.8.163:3001/api/hourly-data?${params.toString()}`)
        const result = await response.json()
        if (!response.ok) throw new Error(result.message || 'Unable to load utilization data.')
        if (!cancelled) {
          setUtilizationData(result.hours || [])
          setUtilizationError('')
          setUtilizationUpdatedAt(new Date().toLocaleTimeString())
        }
      } catch (error) {
        if (!cancelled) {
          setUtilizationData([])
          setUtilizationError(error.message || 'Unable to connect to the backend.')
        }
      } finally {
        inFlight = false
        if (!cancelled) setUtilizationLoading(false)
      }
    }

    loadUtilization()
    const timer = setInterval(loadUtilization, 10000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [activePage, utilizationDate, utilizationMachine])

  async function loadUtilityMeters() {
    try {
      const response = await fetch('http://192.168.8.163:3001/api/utility-meters')
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Unable to load utility meters.')
      const meters = result.data || []
      setUtilityMeters(meters)
      if (meters.length && !meters.some((meter) => meter.meter_code === utilityMeterCode)) {
        setUtilityMeterCode(meters[0].meter_code)
      }
    } catch (error) {
      setUtilityMessage(error.message || 'Unable to load utility meters.')
      setUtilityMessageError(true)
    }
  }

  async function loadUtilityReadings(meterCode = utilityMeterCode) {
    setUtilityLoading(true)
    try {
      const params = new URLSearchParams({ meter_code: meterCode, limit: '100' })
      const response = await fetch(`http://192.168.8.163:3001/api/utility-readings?${params.toString()}`)
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Unable to load meter readings.')
      setUtilityReadings(result.data || [])
    } catch (error) {
      setUtilityReadings([])
      setUtilityMessage(error.message || 'Unable to load meter readings.')
      setUtilityMessageError(true)
    } finally {
      setUtilityLoading(false)
    }
  }

  async function saveUtilityReading(event) {
    event.preventDefault()
    setUtilitySaving(true)
    setUtilityMessage('')
    setUtilityMessageError(false)
    try {
      if (utilityReadingValue === '' || !Number.isFinite(Number(utilityReadingValue)) || Number(utilityReadingValue) < 0) {
        throw new Error('Enter a valid non-negative meter reading.')
      }
      if (!utilityReadingTime) throw new Error('Select the reading date and time.')
      const readingTime = utilityReadingTime.replace('T', ' ') + ':00'
      const response = await fetch('http://192.168.8.163:3001/api/utility-readings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meter_code: utilityMeterCode,
          reading_time: readingTime,
          reading_value: Number(utilityReadingValue),
          remarks: utilityReadingRemarks.trim(),
          entered_by: 'Administrator',
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Unable to save meter reading.')
      setUtilityMessage(result.message || 'Meter reading saved successfully.')
      setUtilityMessageError(false)
      setUtilityReadingValue('')
      setUtilityReadingRemarks('')
      await loadUtilityReadings(utilityMeterCode)
    } catch (error) {
      setUtilityMessage(error.message || 'Unable to save meter reading.')
      setUtilityMessageError(true)
    } finally {
      setUtilitySaving(false)
    }
  }

  useEffect(() => {
    if (activePage !== 'Maintenance') return
    loadUtilityMeters()
  }, [activePage])

  useEffect(() => {
    if (activePage !== 'Maintenance' || !utilityMeterCode) return
    loadUtilityReadings(utilityMeterCode)
  }, [activePage, utilityMeterCode])


  async function loadCalibrationPlans() {
    setCalibrationLoading(true)
    try {
      const params = new URLSearchParams()
      if (calibrationFilter !== 'All') params.set('status', calibrationFilter)
      const suffix = params.toString() ? `?${params.toString()}` : ''
      const response = await fetch(`http://192.168.8.163:3001/api/calibration-plans${suffix}`)
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Unable to load calibration plans.')
      setCalibrationPlans(result.data || [])
      setCalibrationMessage('')
      setCalibrationMessageError(false)
    } catch (error) {
      setCalibrationPlans([])
      setCalibrationMessage(error.message || 'Unable to load calibration plans.')
      setCalibrationMessageError(true)
    } finally {
      setCalibrationLoading(false)
    }
  }

  useEffect(() => {
    if (activePage === 'Maintenance' && maintenanceTab === 'Calibration Planning') {
      loadCalibrationPlans()
    }
  }, [activePage, maintenanceTab, calibrationFilter])

  function updateCalibrationField(field, value) {
    setCalibrationForm((previous) => ({ ...previous, [field]: value }))
  }

  async function unlockCalibrationEditing() {
    setCalibrationBusy(true)
    setCalibrationMessage('')
    setCalibrationMessageError(false)
    try {
      const response = await fetch('http://192.168.8.163:3001/api/production-plan/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: calibrationPin }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'PIN verification failed.')
      setCalibrationUnlocked(true)
      setCalibrationMessage('Editing unlocked. Calibration changes require the PIN again on the backend.')
    } catch (error) {
      setCalibrationUnlocked(false)
      setCalibrationMessage(error.message || 'PIN verification failed.')
      setCalibrationMessageError(true)
    } finally {
      setCalibrationBusy(false)
    }
  }

  function resetCalibrationForm() {
    setEditingCalibrationId(null)
    setCalibrationForm({
      instrument_name: '',
      instrument_code: '',
      location: '',
      calibration_frequency_months: '12',
      last_calibration_date: '',
      due_date: '',
      assigned_to: '',
      calibration_agency: '',
      status: 'Planned',
      remarks: '',
    })
  }

  async function saveCalibrationPlan(event) {
    event.preventDefault()
    if (!calibrationUnlocked || calibrationPin.length !== 4) {
      setCalibrationMessage('Verify the 4-digit PIN before saving a calibration plan.')
      setCalibrationMessageError(true)
      return
    }
    if (!calibrationForm.instrument_name.trim() || !calibrationForm.instrument_code.trim() || !calibrationForm.due_date) {
      setCalibrationMessage('Instrument name, code, and due date are required.')
      setCalibrationMessageError(true)
      return
    }
    setCalibrationBusy(true)
    setCalibrationMessage('')
    setCalibrationMessageError(false)
    try {
      const payload = {
        ...calibrationForm,
        instrument_name: calibrationForm.instrument_name.trim(),
        instrument_code: calibrationForm.instrument_code.trim(),
        calibration_frequency_months: Number(calibrationForm.calibration_frequency_months),
        last_calibration_date: calibrationForm.last_calibration_date || null,
        pin: calibrationPin,
      }
      const isEditing = editingCalibrationId !== null
      const response = await fetch(
        isEditing
          ? `http://192.168.8.163:3001/api/calibration-plans/${editingCalibrationId}`
          : 'http://192.168.8.163:3001/api/calibration-plans',
        {
          method: isEditing ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      )
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Unable to save calibration plan.')
      setCalibrationMessage(result.message || 'Calibration plan saved successfully.')
      setCalibrationMessageError(false)
      resetCalibrationForm()
      await loadCalibrationPlans()
    } catch (error) {
      setCalibrationMessage(error.message || 'Unable to save calibration plan.')
      setCalibrationMessageError(true)
    } finally {
      setCalibrationBusy(false)
    }
  }

  function editCalibrationPlan(plan) {
    setEditingCalibrationId(plan.id)
    setCalibrationForm({
      instrument_name: plan.instrument_name || '',
      instrument_code: plan.instrument_code || '',
      location: plan.location || '',
      calibration_frequency_months: String(plan.calibration_frequency_months || 12),
      last_calibration_date: plan.last_calibration_date ? String(plan.last_calibration_date).slice(0, 10) : '',
      due_date: plan.due_date ? String(plan.due_date).slice(0, 10) : '',
      assigned_to: plan.assigned_to || plan.responsible_person || '',
      calibration_agency: plan.calibration_agency || '',
      status: plan.status || plan.display_status || 'Planned',
      remarks: plan.remarks || '',
    })
    setCalibrationMessage('Plan loaded. Verify PIN before saving your changes.')
    setCalibrationMessageError(false)
    setCalibrationUnlocked(false)
  }

  async function deleteCalibrationPlan(plan) {
    if (!calibrationPin || calibrationPin.length !== 4) {
      setCalibrationMessage('Enter the 4-digit PIN before removing a plan.')
      setCalibrationMessageError(true)
      return
    }
    if (!window.confirm(`Remove calibration plan ${plan.instrument_code} — ${plan.instrument_name}?`)) return
    setCalibrationBusy(true)
    setCalibrationMessage('')
    setCalibrationMessageError(false)
    try {
      const response = await fetch(`http://192.168.8.163:3001/api/calibration-plans/${plan.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: calibrationPin }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Unable to remove calibration plan.')
      setCalibrationMessage(result.message || 'Calibration plan removed.')
      await loadCalibrationPlans()
    } catch (error) {
      setCalibrationMessage(error.message || 'Unable to remove calibration plan.')
      setCalibrationMessageError(true)
    } finally {
      setCalibrationBusy(false)
    }
  }

  const filteredMachines = machineRows.filter((machine) =>
    machine.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-symbol">O</div>
          <div>
            <strong>OEE<span>MONITOR</span></strong>
            <small>INDUSTRIAL INTELLIGENCE</small>
          </div>
        </div>

        <div className="plant-selector">
          <div className="plant-avatar">VP</div>
          <div>
            <strong>Virar Plant</strong>
            <small>Manufacturing Unit</small>
          </div>
          <span className="plant-chevron">⌄</span>
        </div>

        <nav className="sidebar-nav">
          {navGroups.map((group) => (
            <div className="nav-group" key={group.title}>
              <div className="nav-group-title">{group.title}</div>

              {group.items.map(([icon, label]) => (
                <button
                  key={label}
                  className={`nav-item ${
                    activePage === label ? 'active' : ''
                  }`}
                  onClick={() => setActivePage(label)}
                >
                  <span className="nav-icon">{icon}</span>
                  <span>{label}</span>
                  {label === 'PLC Status' && <i className="nav-dot" />}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="server-status">
            <span className="pulse-dot" />
            <div>
              <strong>Internal Server</strong>
              <small>Local network active</small>
            </div>
          </div>

          <div className="user-profile">
            <div className="user-avatar">AD</div>
            <div>
              <strong>Administrator</strong>
              <small>System Admin</small>
            </div>
            <span className="plant-chevron">•••</span>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Manufacturing</span>
            <span>/</span>
            <strong>{activePage}</strong>
          </div>

          <div className="topbar-right">
            <div className="connection-label">
              <span className="pulse-dot" /> LOCAL NETWORK
            </div>
            <button className="icon-button" title="Notifications">
              ♧<i />
            </button>
            <div className="top-date">◷ &nbsp; {selectedDate}</div>
          </div>
        </header>

        <div className="page-content">
          <div className="page-title-row">
            <div>
              <div className="eyebrow">FACTORY PERFORMANCE CENTER</div>
              <h1>
                {activePage === 'Dashboard'
                  ? 'Industrial OEE Dashboard'
                  : activePage}
              </h1>
              <p className="page-subtitle">
                Real-time production visibility and manufacturing performance
              </p>
            </div>

            <div className="page-filters">
              <label className="filter-box">
                <span>Production date</span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(event) =>
                    setSelectedDate(event.target.value)
                  }
                />
              </label>

              <label className="filter-box">
                <span>Production period</span>
                <select
                  value={selectedPeriod}
                  onChange={(event) =>
                    setSelectedPeriod(event.target.value)
                  }
                >
                  <option>Today</option>
                  <option>Yesterday</option>
                  <option>This week</option>
                  <option>This month</option>
                </select>
              </label>

              <button
                className="primary-button"
                onClick={() => window.print()}
              >
                ⇩ <span>Export</span>
              </button>
            </div>
          </div>

          {activePage === 'Utilization' ? (
            <section className="panel" style={{ marginTop: 20 }}>
              <SectionTitle
                title="Machine Utilization"
                subtitle="Hourly running time compared with the 60-minute production-hour window."
                right={<span className="live-label"><span className="pulse-dot" /> AUTO REFRESH · 10 SEC</span>}
              />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'end', marginTop: 20, marginBottom: 18 }}>
                <label className="filter-box">
                  <span>Production date</span>
                  <input type="date" value={utilizationDate} onChange={(event) => setUtilizationDate(event.target.value)} />
                </label>
                <label className="filter-box">
                  <span>Machine code</span>
                  <input value={utilizationMachine} onChange={(event) => setUtilizationMachine(event.target.value.toUpperCase())} placeholder="AA1" />
                </label>
                <div style={{ color: '#475569', fontSize: 13, paddingBottom: 8 }}>
                  <strong>Last updated:</strong> {utilizationUpdatedAt || 'Waiting for data...'}
                </div>
              </div>
              {utilizationError && <p role="alert" style={{ color: '#b91c1c' }}>{utilizationError}</p>}
              {(() => {
                const validHours = utilizationData.filter((hour) => hour.running_minutes != null)
                const totalRunning = validHours.reduce((sum, hour) => sum + Math.max(0, Number(hour.running_minutes) || 0), 0)
                const availableMinutes = validHours.length * 60
                const utilization = availableMinutes > 0 ? Math.min(100, (totalRunning / availableMinutes) * 100) : null
                const totalProduction = utilizationData.reduce((sum, hour) => sum + (Number(hour.total_quantity) || 0), 0)
                const totalDowntime = utilizationData.reduce((sum, hour) => sum + Math.max(0, Number(hour.downtime_minutes) || 0), 0)
                return (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 16, marginTop: 12 }}>
                      <div className="kpi-card">
                        <div className="kpi-label">Machine Utilization</div>
                        <div className="kpi-value">{utilization == null ? '—' : utilization.toFixed(1)}<span>{utilization == null ? '' : '%'}</span></div>
                        <div className="kpi-bottom">Running minutes ÷ recorded hours × 60</div>
                      </div>
                      <div className="kpi-card">
                        <div className="kpi-label">Total Running Time</div>
                        <div className="kpi-value">{totalRunning.toLocaleString()}<span> min</span></div>
                        <div className="kpi-bottom">{Math.floor(totalRunning / 60)} h {String(totalRunning % 60).padStart(2, '0')} min</div>
                      </div>
                      <div className="kpi-card">
                        <div className="kpi-label">Recorded Downtime</div>
                        <div className="kpi-value">{totalDowntime.toLocaleString()}<span> min</span></div>
                        <div className="kpi-bottom">From available hourly records</div>
                      </div>
                      <div className="kpi-card">
                        <div className="kpi-label">Total Production</div>
                        <div className="kpi-value">{totalProduction.toLocaleString()}<span> parts</span></div>
                        <div className="kpi-bottom">Actual quantity in hourly records</div>
                      </div>
                    </div>
                    <div style={{ marginTop: 24 }}>
                      <SectionTitle title="Hourly Utilization Details" subtitle="Utilization is calculated per hour as running minutes ÷ 60, capped at 100%. Missing hourly records are not counted as available time." />
                      {utilizationLoading && utilizationData.length === 0 && !utilizationError ? <p style={{ color: '#475569' }}>Loading utilization data...</p> : (
                        <div className="table-scroll" style={{ marginTop: 12 }}>
                          <table>
                            <thead><tr><th>Production Hour</th><th>Running Time</th><th>Available Time</th><th>Utilization</th><th>Production</th><th>Downtime</th></tr></thead>
                            <tbody>
                              {utilizationData.slice().sort((a, b) => Number(a.hour_no) - Number(b.hour_no)).map((hour) => {
                                const hourNo = Number(hour.hour_no) || 1
                                const running = Math.max(0, Number(hour.running_minutes) || 0)
                                const percent = Math.min(100, (running / 60) * 100)
                                const color = percent < 60 ? '#dc2626' : percent < 80 ? '#f97316' : '#16a34a'
                                const start = (6 * 60 + 45 + (hourNo - 1) * 60) % (24 * 60)
                                const end = (start + 60) % (24 * 60)
                                const fmt = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
                                return <tr key={hour.hour_no}>
                                  <td><strong>{fmt(start)}–{fmt(end)}</strong></td>
                                  <td>{running} min</td>
                                  <td>60 min</td>
                                  <td style={{ minWidth: 150 }}>
                                    <strong style={{ display: 'block', color: '#102a43' }}>{percent.toFixed(1)}%</strong>
                                    <div style={{ height: 8, marginTop: 6, background: '#e2e8f0', borderRadius: 6, overflow: 'hidden' }}><div style={{ height: '100%', width: `${percent}%`, background: color, borderRadius: 6 }} /></div>
                                  </td>
                                  <td>{(Number(hour.total_quantity) || 0).toLocaleString()}</td>
                                  <td>{(Number(hour.downtime_minutes) || 0).toLocaleString()} min</td>
                                </tr>
                              })}
                              {utilizationData.length === 0 && <tr><td colSpan="6" className="empty-state">No hourly records found for this machine and date.</td></tr>}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </>
                )
              })()}
            </section>
          ) : activePage === 'Maintenance' ? (
            <section className="panel" style={{ marginTop: 20 }}>
              <SectionTitle
                title="Maintenance Center"
                subtitle="Utility meters and calibration schedule management."
                right={<span className="muted-small">Maintenance · Internal database</span>}
              />
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18, marginBottom: 20 }}>
                {['Utility Meters', 'Calibration Planning'].map((tab) => (
                  <button key={tab} type="button" className={maintenanceTab === tab ? 'primary-button' : 'secondary-button'} onClick={() => { setMaintenanceTab(tab); setCalibrationMessage(''); }}>
                    {tab}
                  </button>
                ))}
              </div>

              {maintenanceTab === 'Utility Meters' ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginTop: 12 }}>
                    <div className="kpi-card"><div className="kpi-label">Configured LT Panels</div><div className="kpi-value">{utilityMeters.length}<span> meters</span></div><div className="kpi-bottom">Active utility meters loaded from database</div></div>
                    <div className="kpi-card"><div className="kpi-label">Selected Meter</div><div className="kpi-value" style={{ fontSize: 24 }}>{utilityMeterCode}</div><div className="kpi-bottom">{utilityMeters.find((meter) => meter.meter_code === utilityMeterCode)?.meter_name || 'Electricity meter'}</div></div>
                    <div className="kpi-card"><div className="kpi-label">Saved Readings</div><div className="kpi-value">{utilityReadings.length}<span> records</span></div><div className="kpi-bottom">Latest 100 readings for selected meter</div></div>
                  </div>
                  <div className="panel" style={{ marginTop: 22, border: '1px solid #cbd5e1' }}>
                    <SectionTitle title="Enter Utility Meter Reading" subtitle="Enter the cumulative kWh value displayed on the physical LT panel meter." />
                    <form onSubmit={saveUtilityReading} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 16, marginTop: 18 }}>
                      <label className="filter-box"><span>LT Panel</span><select value={utilityMeterCode} onChange={(event) => { setUtilityMeterCode(event.target.value); setUtilityMessage(''); }} required>{utilityMeters.map((meter) => <option key={meter.id} value={meter.meter_code}>{meter.meter_name} ({meter.meter_code})</option>)}</select></label>
                      <label className="filter-box"><span>Reading date and time</span><input type="datetime-local" value={utilityReadingTime} onChange={(event) => setUtilityReadingTime(event.target.value)} required /></label>
                      <label className="filter-box"><span>Cumulative meter reading (kWh)</span><input type="number" min="0" step="0.001" value={utilityReadingValue} onChange={(event) => setUtilityReadingValue(event.target.value)} placeholder="Enter meter display value" required /></label>
                      <label className="filter-box"><span>Remarks (optional)</span><input value={utilityReadingRemarks} onChange={(event) => setUtilityReadingRemarks(event.target.value)} placeholder="e.g. Monthly reading" maxLength={500} /></label>
                      <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <button className="primary-button" type="submit" disabled={utilitySaving || utilityMeters.length === 0}>{utilitySaving ? 'Saving...' : 'Save Meter Reading'}</button>
                        <button className="secondary-button" type="button" onClick={() => loadUtilityReadings(utilityMeterCode)} disabled={utilityLoading}>{utilityLoading ? 'Refreshing...' : 'Refresh History'}</button>
                      </div>
                      {utilityMessage && <p role="status" style={{ gridColumn: '1 / -1', color: utilityMessageError ? '#b91c1c' : '#047857', margin: 0 }}>{utilityMessage}</p>}
                    </form>
                    <div className="panel-footnote" style={{ marginTop: 14 }}>Consumption is calculated by the backend using the previous cumulative reading. If a new reading is lower than the previous reading, check the meter reset/rollover before relying on consumption.</div>
                  </div>
                  <div style={{ marginTop: 26 }}>
                    <SectionTitle title={`${utilityMeterCode} — Reading History`} subtitle="Most recent 100 records returned by the backend." />
                    {utilityLoading ? <p style={{ color: '#475569', marginTop: 16 }}>Loading meter history...</p> : (
                      <div className="table-scroll" style={{ marginTop: 12 }}>
                        <table><thead><tr><th>Reading Date / Time</th><th>Meter Reading (kWh)</th><th>Consumption (kWh)</th><th>Source</th><th>Remarks</th></tr></thead>
                          <tbody>{utilityReadings.map((reading) => <tr key={reading.id}><td>{reading.reading_time ? String(reading.reading_time).replace('T', ' ').slice(0, 19) : '—'}</td><td><strong>{Number(reading.reading_value).toLocaleString(undefined, { maximumFractionDigits: 3 })}</strong></td><td>{reading.consumption_value == null ? '—' : Number(reading.consumption_value).toLocaleString(undefined, { maximumFractionDigits: 3 })}</td><td>{reading.source || 'Manual'}</td><td>{reading.remarks || '—'}</td></tr>)}
                          {utilityReadings.length === 0 && <tr><td colSpan="5" className="empty-state">No readings saved for this meter yet. Enter the first reading above.</td></tr>}</tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginTop: 12 }}>
                    <div className="kpi-card"><div className="kpi-label">Total Plans</div><div className="kpi-value">{calibrationPlans.length}</div><div className="kpi-bottom">Plans matching the selected filter</div></div>
                    <div className="kpi-card"><div className="kpi-label">Due Soon</div><div className="kpi-value">{calibrationPlans.filter((p) => (p.display_status || p.status) === 'Due Soon').length}</div><div className="kpi-bottom">Due within 30 days</div></div>
                    <div className="kpi-card"><div className="kpi-label">Overdue</div><div className="kpi-value">{calibrationPlans.filter((p) => (p.display_status || p.status) === 'Overdue').length}</div><div className="kpi-bottom">Past due date</div></div>
                  </div>
                  <div className="panel" style={{ marginTop: 20, border: '1px solid #cbd5e1' }}>
                    <SectionTitle title={editingCalibrationId ? 'Edit Calibration Plan' : 'Add Calibration Plan'} subtitle="Use unique instrument codes. Editing, saving, and deleting are PIN-protected by the backend." right={<button type="button" className="secondary-button" onClick={loadCalibrationPlans} disabled={calibrationLoading}>{calibrationLoading ? 'Refreshing...' : 'Refresh Plans'}</button>} />
                    <form onSubmit={saveCalibrationPlan} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14, marginTop: 18 }}>
                      <label className="filter-box"><span>Instrument name *</span><input value={calibrationForm.instrument_name} onChange={(e) => updateCalibrationField('instrument_name', e.target.value)} maxLength={150} required placeholder="e.g. Pressure Gauge" /></label>
                      <label className="filter-box"><span>Instrument code *</span><input value={calibrationForm.instrument_code} onChange={(e) => updateCalibrationField('instrument_code', e.target.value.toUpperCase())} maxLength={100} required placeholder="e.g. PG-001" /></label>
                      <label className="filter-box"><span>Location</span><input value={calibrationForm.location} onChange={(e) => updateCalibrationField('location', e.target.value)} maxLength={150} placeholder="Shop / machine location" /></label>
                      <label className="filter-box"><span>Calibration frequency (months)</span><input type="number" min="1" max="120" value={calibrationForm.calibration_frequency_months} onChange={(e) => updateCalibrationField('calibration_frequency_months', e.target.value)} required /></label>
                      <label className="filter-box"><span>Last calibration date</span><input type="date" value={calibrationForm.last_calibration_date} onChange={(e) => updateCalibrationField('last_calibration_date', e.target.value)} /></label>
                      <label className="filter-box"><span>Next due date *</span><input type="date" value={calibrationForm.due_date} onChange={(e) => updateCalibrationField('due_date', e.target.value)} required /></label>
                      <label className="filter-box"><span>Responsible person</span><input value={calibrationForm.assigned_to} onChange={(e) => updateCalibrationField('assigned_to', e.target.value)} maxLength={150} /></label>
                      <label className="filter-box"><span>Calibration agency</span><input value={calibrationForm.calibration_agency} onChange={(e) => updateCalibrationField('calibration_agency', e.target.value)} maxLength={150} /></label>
                      <label className="filter-box"><span>Status</span><select value={calibrationForm.status} onChange={(e) => updateCalibrationField('status', e.target.value)}><option>Planned</option><option>Due Soon</option><option>Overdue</option><option>Completed</option></select></label>
                      <label className="filter-box" style={{ gridColumn: '1 / -1' }}><span>Remarks</span><textarea value={calibrationForm.remarks} onChange={(e) => updateCalibrationField('remarks', e.target.value)} maxLength={5000} rows={3} placeholder="Notes, certificate details, etc." /></label>
                      <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'end' }}>
                        <label className="filter-box" style={{ flex: '0 1 220px' }}><span>4-digit PIN</span><input type="password" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} value={calibrationPin} onChange={(e) => { setCalibrationPin(e.target.value.replace(/\D/g, '').slice(0, 4)); setCalibrationUnlocked(false); }} autoComplete="off" placeholder="Enter PIN" /></label>
                        {!calibrationUnlocked ? <button type="button" className="primary-button" disabled={calibrationBusy || calibrationPin.length !== 4} onClick={unlockCalibrationEditing}>{calibrationBusy ? 'Checking...' : 'Verify PIN'}</button> : <span className="live-label"><span className="pulse-dot" /> PIN VERIFIED</span>}
                        <button type="submit" className="primary-button" disabled={calibrationBusy || !calibrationUnlocked}>{calibrationBusy ? 'Saving...' : editingCalibrationId ? 'Update Plan' : 'Save Plan'}</button>
                        <button type="button" className="secondary-button" onClick={() => { resetCalibrationForm(); setCalibrationMessage(''); }}>Clear Form</button>
                      </div>
                      {calibrationMessage && <p role="status" style={{ gridColumn: '1 / -1', color: calibrationMessageError ? '#b91c1c' : '#047857', margin: 0 }}>{calibrationMessage}</p>}
                    </form>
                  </div>
                  <div className="panel" style={{ marginTop: 20, border: '1px solid #cbd5e1' }}>
                    <SectionTitle title="Calibration Gantt Schedule" subtitle="Schedule bars are positioned by due date. This is a date overview, not a task-duration forecast." right={<label className="filter-box"><span>Status filter</span><select value={calibrationFilter} onChange={(e) => setCalibrationFilter(e.target.value)}><option>All</option><option>Planned</option><option>Due Soon</option><option>Overdue</option><option>Completed</option></select></label>} />
                    {calibrationLoading ? <p>Loading calibration plans...</p> : calibrationPlans.length === 0 ? <p className="empty-state" style={{ marginTop: 14 }}>No calibration plans found. Add your first plan above.</p> : (
                      <div style={{ overflowX: 'auto', marginTop: 16 }}>
                        {calibrationPlans.slice().sort((a,b) => String(a.due_date || '').localeCompare(String(b.due_date || ''))).map((plan) => {
                          const status = plan.display_status || plan.status || 'Planned'
                          const due = plan.due_date ? new Date(`${String(plan.due_date).slice(0,10)}T00:00:00`) : new Date()
                          const today = new Date(); today.setHours(0,0,0,0)
                          const days = Math.round((due.getTime() - today.getTime()) / 86400000)
                          const offset = Math.max(0, Math.min(90, 90 - Math.max(0, days)))
                          const barColor = status === 'Overdue' ? '#dc2626' : status === 'Due Soon' ? '#f59e0b' : status === 'Completed' ? '#16a34a' : '#2563eb'
                          return <div key={plan.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(170px, 1.2fr) minmax(220px, 2fr) minmax(130px, .8fr)', gap: 12, alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #e2e8f0', minWidth: 620 }}>
                            <div><strong>{plan.instrument_name}</strong><div style={{ color: '#64748b', fontSize: 12 }}>{plan.instrument_code} · {plan.location || 'No location'}</div></div>
                            <div style={{ background: '#e2e8f0', height: 18, borderRadius: 8, overflow: 'hidden', position: 'relative' }} title={`Due ${String(plan.due_date || '').slice(0,10)}`}><div style={{ position: 'absolute', left: `${offset}%`, width: `${Math.max(8, 100-offset)}%`, height: '100%', borderRadius: 8, background: barColor }} /></div>
                            <div><strong>{String(plan.due_date || '—').slice(0,10)}</strong><div style={{ color: barColor, fontSize: 12, fontWeight: 700 }}>{status}{Number.isFinite(days) ? ` · ${days < 0 ? Math.abs(days) + ' days overdue' : days + ' days left'}` : ''}</div></div>
                          </div>
                        })}
                      </div>
                    )}
                  </div>
                  <div className="panel" style={{ marginTop: 20 }}>
                    <SectionTitle title="Calibration Plan Register" subtitle="Edit a plan or remove it using your 4-digit PIN." />
                    <div className="table-scroll" style={{ marginTop: 12 }}>
                      <table><thead><tr><th>Instrument</th><th>Code</th><th>Location</th><th>Last Calibration</th><th>Due Date</th><th>Responsible</th><th>Status</th><th>Actions</th></tr></thead>
                        <tbody>{calibrationPlans.map((plan) => <tr key={plan.id}>
                          <td><strong>{plan.instrument_name}</strong></td><td>{plan.instrument_code}</td><td>{plan.location || '—'}</td><td>{String(plan.last_calibration_date || '—').slice(0,10)}</td><td>{String(plan.due_date || '—').slice(0,10)}</td><td>{plan.assigned_to || plan.responsible_person || '—'}</td><td>{plan.display_status || plan.status || '—'}</td><td style={{ whiteSpace: 'nowrap' }}><button type="button" className="text-button" onClick={() => editCalibrationPlan(plan)}>Edit</button> <button type="button" className="text-button" onClick={() => deleteCalibrationPlan(plan)} disabled={calibrationBusy}>Remove</button></td>
                        </tr>)}
                        {calibrationPlans.length === 0 && <tr><td colSpan="8" className="empty-state">No calibration plans available.</td></tr>}</tbody>
                      </table>
                    </div>
                  </div>
                  <div className="panel-footnote" style={{ marginTop: 14 }}>PIN verification uses the existing production-plan PIN endpoint. Saving and removal also send the PIN to the calibration backend for server-side validation.</div>
                </>
              )}
            </section>
          ) : activePage === 'Reports' ? (
            <section className="panel" style={{ marginTop: 20 }}>
              <SectionTitle title="Reports Center" subtitle="Choose automatic scheduling or create a report manually." />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20, marginTop: 24 }}>
                <div className="panel" style={{ border: '1px solid #cbd5e1' }}>
                  <div style={{ fontSize: 32, color: '#2563eb' }}>◷</div>
                  <h2 style={{ color: '#102a43' }}>Automatic Report Generator</h2>
                  <p style={{ color: '#475569', lineHeight: 1.6 }}>Configure email recipients, report schedule, cell, machine, report type, and export format.</p>
                  <button className="primary-button" onClick={() => { setReportMessage(''); setActivePage('Automatic Report Generator') }}>Configure Automatic Reports</button>
                </div>
                <div className="panel" style={{ border: '1px solid #cbd5e1' }}>
                  <div style={{ fontSize: 32, color: '#2563eb' }}>▤</div>
                  <h2 style={{ color: '#102a43' }}>Manual Report Generator</h2>
                  <p style={{ color: '#475569', lineHeight: 1.6 }}>Choose a date range, cell, machine, report period, and file format.</p>
                  <button className="primary-button" onClick={() => { setReportMessage(''); setActivePage('Manual Report Generator') }}>Create Manual Report</button>
                </div>
              </div>
            </section>
          ) : activePage === 'Automatic Report Generator' ? (
            <section className="panel" style={{ marginTop: 20 }}>
              <SectionTitle title="Automatic Report Generator" subtitle="Configure when and where reports should be delivered." right={<button className="secondary-button" onClick={() => setActivePage('Reports')}>← Back to Reports</button>} />
              <form onSubmit={(event) => { event.preventDefault(); setReportMessage('Settings validated in the frontend only. Scheduled email delivery requires a backend scheduler and email service.'); }} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginTop: 22 }}>
                <label className="filter-box"><span>Recipient email</span><input type="email" value={reportEmail} onChange={(event) => setReportEmail(event.target.value)} placeholder="name@company.com" required /></label>
                <label className="filter-box"><span>Report schedule</span><select value={reportSchedule} onChange={(event) => setReportSchedule(event.target.value)}><option>Daily</option><option>Weekly</option><option>Monthly</option></select></label>
                <label className="filter-box"><span>Generation time</span><input type="time" value={reportTime} onChange={(event) => setReportTime(event.target.value)} required /></label>
                <label className="filter-box"><span>Cell / Shop</span><select value={reportCell} onChange={(event) => setReportCell(event.target.value)}><option value="A">Cell A — Press Shop</option><option value="B">Cell B — Screw Forging</option><option value="C">Cell C — Grooving</option><option value="D">Cell D — Deburring</option><option value="E">Cell E — Laser Marking</option><option value="ALL">All cells</option></select></label>
                <label className="filter-box"><span>Machine code</span><input value={reportMachine} onChange={(event) => setReportMachine(event.target.value.toUpperCase())} placeholder="AA1 or ALL" required /></label>
                <label className="filter-box"><span>Report data</span><select value={reportType} onChange={(event) => setReportType(event.target.value)}><option>Hourly</option><option>Daily</option><option>Monthly</option><option>Plan vs Actual</option><option>Running Time</option><option>Production Summary</option></select></label>
                <label className="filter-box"><span>Report format</span><select value={reportFormat} onChange={(event) => setReportFormat(event.target.value)}><option>PDF</option><option>CSV</option><option>Excel</option></select></label>
                <div style={{ gridColumn: '1 / -1' }}><button className="primary-button" type="submit">Validate Report Settings</button>{reportMessage && <p role="status" style={{ color: '#334155', marginTop: 14 }}>{reportMessage}</p>}</div>
              </form>
            </section>
          ) : activePage === 'Manual Report Generator' ? (
            <section className="panel" style={{ marginTop: 20 }}>
              <SectionTitle title="Manual Report Generator" subtitle="Select the required database report and date range." right={<button className="secondary-button" onClick={() => setActivePage('Reports')}>← Back to Reports</button>} />
              <form onSubmit={(event) => { event.preventDefault(); setReportMessage('Selection validated. Actual export requires a report-generation backend endpoint.'); }} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginTop: 22 }}>
                <label className="filter-box"><span>From date</span><input type="date" value={reportStartDate} onChange={(event) => setReportStartDate(event.target.value)} required /></label>
                <label className="filter-box"><span>To date</span><input type="date" min={reportStartDate} value={reportEndDate} onChange={(event) => setReportEndDate(event.target.value)} required /></label>
                <label className="filter-box"><span>Cell / Shop</span><select value={reportCell} onChange={(event) => setReportCell(event.target.value)}><option value="A">Cell A — Press Shop</option><option value="B">Cell B — Screw Forging</option><option value="C">Cell C — Grooving</option><option value="D">Cell D — Deburring</option><option value="E">Cell E — Laser Marking</option><option value="ALL">All cells</option></select></label>
                <label className="filter-box"><span>Machine code</span><input value={reportMachine} onChange={(event) => setReportMachine(event.target.value.toUpperCase())} placeholder="AA1 or ALL" required /></label>
                <label className="filter-box"><span>Report data</span><select value={reportType} onChange={(event) => setReportType(event.target.value)}><option>Hourly</option><option>Daily</option><option>Monthly</option><option>Plan vs Actual</option><option>Running Time</option><option>Production Summary</option></select></label>
                <label className="filter-box"><span>Export format</span><select value={reportFormat} onChange={(event) => setReportFormat(event.target.value)}><option>PDF</option><option>CSV</option><option>Excel</option></select></label>
                <div style={{ gridColumn: '1 / -1' }}><button className="primary-button" type="submit">Prepare Report</button>{reportMessage && <p role="status" style={{ color: '#334155', marginTop: 14 }}>{reportMessage}</p>}</div>
              </form>
            </section>
          ) : activePage === 'Hourly Data' ? (
            <section className="panel" style={{ marginTop: 20 }}>
              <SectionTitle
                title="Hourly Data — Live Machine Monitoring"
                subtitle="Production and running time by production hour. Data refreshes every second."
                right={
                  <span className="live-label">
                    <span className="pulse-dot" /> LIVE DATA
                  </span>
                }
              />

              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 14,
                alignItems: 'end',
                marginTop: 18,
                marginBottom: 14,
              }}>
                <label className="filter-box">
                  <span>Production date</span>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(event) => setSelectedDate(event.target.value)}
                  />
                </label>

                <label className="filter-box">
                  <span>Machine code</span>
                  <input
                    value={hourlyLiveMachine}
                    onChange={(event) => setHourlyLiveMachine(event.target.value.toUpperCase())}
                    placeholder="AA1"
                  />
                </label>

                <div style={{ color: '#334155', fontSize: 14, paddingBottom: 8 }}>
                  <strong>Last updated:</strong> {hourlyLiveUpdatedAt || 'Waiting for data...'}
                </div>
              </div>

              {hourlyLiveError && (
                <p role="alert" style={{ color: '#b91c1c', fontSize: 14 }}>
                  {hourlyLiveError}
                </p>
              )}

              {hourlyLiveLoading && hourlyLiveData.length === 0 && !hourlyLiveError ? (
                <p style={{ color: '#334155', fontSize: 14 }}>Loading hourly machine data...</p>
              ) : (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th style={{ color: '#102a43', backgroundColor: '#eaf2ff', minWidth: 180, whiteSpace: 'nowrap', visibility: 'visible', opacity: 1 }}>Production Hour</th>
                        <th>Running Time</th>
                        <th>Running Achievement</th>
                        <th>Production</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hourlyLiveData
                        .slice()
                        .sort((a, b) => Number(a.hour_no) - Number(b.hour_no))
                        .map((hour) => {
                          const hourNo = Number(hour.hour_no) || 1
                          const running = Math.max(0, Number(hour.running_minutes) || 0)
                          const production = Number(hour.total_quantity) || 0
                          const startMinutes = (6 * 60 + 45 + (hourNo - 1) * 60) % (24 * 60)
                          const endMinutes = (startMinutes + 60) % (24 * 60)
                          const formatTime = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
                          const achievement = Math.min(100, (running / 60) * 100)
                          const achievementColor = achievement < 60
                            ? '#dc2626'
                            : achievement < 80
                              ? '#f97316'
                              : '#16a34a'

                          return (
                            <tr key={hour.hour_no}>
                              <td style={{ color: '#102a43', backgroundColor: '#ffffff', minWidth: 180, width: 180, whiteSpace: 'nowrap', visibility: 'visible', opacity: 1, textAlign: 'left' }}><strong style={{ color: '#102a43', display: 'inline-block', visibility: 'visible', opacity: 1, fontWeight: 700 }}>{formatTime(startMinutes)}–{formatTime(endMinutes)}</strong></td>
                              <td>
                                <strong style={{ color: '#102a43' }}>{running} min</strong>
                                <div style={{ color: '#475569', fontSize: 13 }}>
                                  ({Math.floor(running / 60)}h {String(Math.floor(running % 60)).padStart(2, '0')}m)
                                </div>
                              </td>
                              <td style={{ minWidth: 175, color: '#102a43' }}>
                                <strong
                                  style={{
                                    display: 'block',
                                    color: '#102a43',
                                    WebkitTextFillColor: '#102a43',
                                    fontSize: 14,
                                    fontWeight: 700,
                                    lineHeight: '20px',
                                    opacity: 1,
                                    visibility: 'visible',
                                  }}
                                >
                                  {achievement.toFixed(1)}%
                                </strong>
                                <div style={{ height: 8, marginTop: 6, background: '#e2e8f0', borderRadius: 6, overflow: 'hidden' }}>
                                  <div style={{ height: '100%', width: `${achievement}%`, background: achievementColor, borderRadius: 6 }} />
                                </div>
                              </td>
                              <td>{production.toLocaleString()} parts</td>
                            </tr>
                          )
                        })}
                      {hourlyLiveData.length === 0 && !hourlyLiveError && (
                        <tr><td colSpan="4" className="empty-state">No hourly records found for this machine and date.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="panel-footnote" style={{ marginTop: 14 }}>
                Running achievement = running minutes ÷ 60 × 100%, capped at 100%. Red: below 60%; orange: 60% to below 80%; green: 80% to 100%. Display values update when the backend/database receives new data.
              </div>
            </section>
          ) : activePage === 'Production Plan' ? (
            <section className="panel" style={{ marginTop: 20 }}>
              <SectionTitle
                title="Production Plan"
                subtitle="Enter a plan manually. Editing and saving require the authorised 4-digit PIN."
                right={<span className="muted-small">MySQL · oee_monitoring</span>}
              />

              <form onSubmit={saveProductionPlan} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 16, marginTop: 18 }}>
                <label className="filter-box">
                  <span>Production date</span>
                  <input type="date" value={planDate} onChange={(event) => { setPlanDate(event.target.value); setPlanUnlocked(false); }} required />
                </label>
                <label className="filter-box">
                  <span>Shop / Cell</span>
                  <select value={planShop} onChange={(event) => setPlanShop(event.target.value)} required>
                    <option>Press Shop</option>
                    <option>Screw Forging</option>
                    <option>Grooving</option>
                    <option>Deburring</option>
                    <option>Laser Marking</option>
                  </select>
                </label>
                <label className="filter-box">
                  <span>Machine name (manual entry)</span>
                  <input value={planMachine} onChange={(event) => setPlanMachine(event.target.value)} placeholder="e.g. AA1" maxLength={100} required />
                </label>
                <label className="filter-box">
                  <span>Planned quantity (parts)</span>
                  <input type="number" min="0" step="1" value={planQuantity} onChange={(event) => setPlanQuantity(event.target.value)} placeholder="Enter planned quantity" required />
                </label>

                <div style={{ gridColumn: '1 / -1', borderTop: '1px solid rgba(148,163,184,.25)', paddingTop: 16 }}>
                  {!planUnlocked ? (
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'end' }}>
                      <label className="filter-box" style={{ flex: '0 1 220px' }}>
                        <span>4-digit edit PIN</span>
                        <input type="password" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} value={planPin} onChange={(event) => setPlanPin(event.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="Enter PIN" autoComplete="off" />
                      </label>
                      <button type="button" className="primary-button" onClick={unlockPlanEditing} disabled={planBusy || planPin.length !== 4}>
                        {planBusy ? 'Checking...' : '🔒 Edit Production Plan'}
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span className="live-label"><span className="pulse-dot" /> EDITING UNLOCKED</span>
                      <button type="submit" className="primary-button" disabled={planBusy || !planDate || !planMachine.trim() || planQuantity === '' || !Number.isInteger(Number(planQuantity)) || Number(planQuantity) < 0}>
                        {planBusy ? 'Saving...' : 'Save Production Plan'}
                      </button>
                      <button type="button" className="secondary-button" onClick={() => { setPlanUnlocked(false); setPlanPin(''); setPlanMessage('Editing locked.'); setPlanMessageError(false); }}>Lock Editing</button>
                    </div>
                  )}
                  {planMessage && <p role="status" style={{ marginTop: 12, color: planMessageError ? '#f87171' : '#34d399' }}>{planMessage}</p>}
                </div>
              </form>

              <div style={{ marginTop: 28 }}>
                <SectionTitle title={`Saved Plans — ${planDate}`} subtitle="Select Edit to load a saved plan into the form; PIN verification is required to save changes." />
                <div className="table-scroll" style={{ marginTop: 12 }}>
                  <table>
                    <thead><tr><th>Date</th><th>Shop / Cell</th><th>Machine</th><th>Planned Quantity</th><th>Action</th></tr></thead>
                    <tbody>
                      {planRows.map((row) => (
                        <tr key={row.id}>
                          <td>{String(row.plan_date).slice(0, 10)}</td>
                          <td>{row.shop_name}</td>
                          <td><strong>{row.machine_name}</strong></td>
                          <td>{Number(row.planned_quantity).toLocaleString()}</td>
                          <td><button type="button" className="text-button" onClick={() => { setPlanDate(String(row.plan_date).slice(0, 10)); setPlanShop(row.shop_name); setPlanMachine(row.machine_name); setPlanQuantity(String(row.planned_quantity)); setPlanUnlocked(false); setPlanPin(''); setPlanMessage('Plan loaded. Verify the PIN to save changes.'); setPlanMessageError(false); }}>Edit</button></td>
                        </tr>
                      ))}
                      {planRows.length === 0 && <tr><td colSpan="5" className="empty-state">No production plans saved for this date.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="panel-footnote" style={{ marginTop: 16 }}>Plans are saved in oee_monitoring.production_plan. The PIN is checked by the backend. Set PLAN_EDIT_PIN in the backend .env file before use.</div>
            </section>
          ) : (
            <>
          <div className="shift-banner">
            <div className="shift-icon">◷</div>
            <div>
              <strong>Production Day: 06:45 AM – 06:45 AM</strong>
              <p>
                24-hour production window · Day boundary follows the factory schedule
              </p>
            </div>
            <div className="shift-right">
              <span className="live-dot" /> UI PREVIEW
            </div>
          </div>

          <SectionTitle
            title="Plant Performance Overview"
            subtitle="Key performance indicators across the manufacturing plant"
            right={<span className="demo-tag">DEMO VALUES</span>}
          />

          <div className="kpi-grid">
            <KpiCard
              title="Overall OEE"
              value="—"
              unit="%"
              detail="Awaiting validated production inputs"
              color="blue"
              icon="◉"
            />
            <KpiCard
              title="Availability"
              value="—"
              unit="%"
              detail="Requires planned and running time"
              color="green"
              icon="◷"
            />
            <KpiCard
              title="Performance"
              value="—"
              unit="%"
              detail="Requires ideal cycle time"
              color="purple"
              icon="↗"
            />
            <KpiCard
              title="Quality"
              value="—"
              unit="%"
              detail="Requires good and reject counts"
              color="orange"
              icon="✓"
            />
          </div>

          <SectionTitle
            title="Production Cells"
            subtitle="Select a cell to inspect machine-level information"
            right={
              <span className="muted-small">
                10 cells · 100 planned machine slots
              </span>
            }
          />

          <div className="cell-grid">
            {cells.map((cell) => (
              <button
                key={cell.id}
                className={`cell-card ${
                  selectedCell === cell.id ? 'selected' : ''
                } ${cell.oee === null ? 'reserved' : ''}`}
                onClick={() => setSelectedCell(cell.id)}
              >
                <div className="cell-card-top">
                  <span className="cell-letter">CELL {cell.id}</span>
                  <span
                    className={`cell-status ${
                      cell.oee === null ? 'status-muted' : ''
                    }`}
                  >
                    {cell.oee === null
                      ? 'SETUP PENDING'
                      : 'CONFIGURED AREA'}
                  </span>
                </div>

                <strong className="cell-name">{cell.name}</strong>

                <div className="cell-metrics">
                  <div>
                    <strong>{cell.machines}</strong>
                    <span>Machine slots</span>
                  </div>
                  <div>
                    <strong>
                      {cell.oee === null ? '—' : `${cell.oee}%`}
                    </strong>
                    <span>OEE preview</span>
                  </div>
                </div>

                <div className="cell-progress">
                  <span style={{ width: `${cell.oee ?? 0}%` }} />
                </div>

                <div className="cell-footer">
                  <span>
                    {cell.oee === null
                      ? 'Not configured'
                      : 'Sample value only'}
                  </span>
                  <span>→</span>
                </div>
              </button>
            ))}
          </div>

          <div className="two-column">
            <section className="panel">
              <SectionTitle
                title="Machine Status"
                subtitle={`Cell ${selectedCell} · Machine availability overview`}
                right={
                  <span className="live-label">
                    <span className="pulse-dot" /> LOCAL VIEW
                  </span>
                }
              />

              <div className="status-legend">
                <span><i className="legend-running" /> Running</span>
                <span><i className="legend-idle" /> Idle</span>
                <span><i className="legend-down" /> Downtime</span>
                <span><i className="legend-unknown" /> Not configured</span>
              </div>

              <div className="machine-matrix">
                {Array.from({ length: 20 }, (_, index) => {
                  const machineName =
                    `${selectedCell}${String(index + 1).padStart(2, '0')}`

                  const isAA1 = selectedCell === 'A' && index === 0

                  return (
                    <button
                      key={machineName}
                      className={`machine-tile ${
                        isAA1 ? 'machine-running' : 'machine-unknown'
                      }`}
                      title={
                        isAA1
                          ? 'AA1: Connected sample machine'
                          : `${machineName}: Not configured`
                      }
                      onClick={() => setSearch(machineName)}
                    >
                      <span className="machine-indicator" />
                      <strong>{machineName}</strong>
                      <small>
                        {isAA1 ? 'Connected' : 'Unconfigured'}
                      </small>
                    </button>
                  )
                })}
              </div>

              <div className="panel-footnote">
                Only AA1 is currently configured in the database. Other machine tiles are placeholders.
              </div>
            </section>

            <section className="panel production-trend-panel">
              <SectionTitle
                title="Production Trend"
                subtitle="Database-driven production analysis"
                right={
                  <span className="live-label">
                    <span className="pulse-dot" /> LIVE DATA
                  </span>
                }
              />

              <div
                className="trend-controls"
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '10px',
                  margin: '14px 0 18px',
                  alignItems: 'end',
                }}
              >
                <label
                  className="filter-box"
                  style={{ flex: '1 1 120px' }}
                >
                  <span>Analysis</span>
                  <select
                    value={chartScope}
                    onChange={(event) => setChartScope(event.target.value)}
                  >
                    <option value="machine">Machine-wise</option>
                    <option value="cell">Cell-wise</option>
                  </select>
                </label>

                <label
                  className="filter-box"
                  style={{ flex: '1 1 120px' }}
                >
                  <span>Chart period</span>
                  <select
                    value={chartPeriod}
                    onChange={(event) => setChartPeriod(event.target.value)}
                  >
                    <option value="hourly">Hourly</option>
                    <option value="daily">Daily</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </label>

                {chartScope === 'machine' ? (
                  <label
                    className="filter-box"
                    style={{ flex: '1 1 100px' }}
                  >
                    <span>Machine</span>
                    <select
                      value={chartMachine}
                      onChange={(event) => setChartMachine(event.target.value)}
                    >
                      <option value="AA1">AA1</option>
                    </select>
                  </label>
                ) : (
                  <label
                    className="filter-box"
                    style={{ flex: '1 1 150px' }}
                  >
                    <span>Cell</span>
                    <select
                      value={chartCell}
                      onChange={(event) => setChartCell(event.target.value)}
                    >
                      <option value="A">Cell A — Press Shop</option>
                      <option value="B">Cell B — Screw Forging</option>
                      <option value="C">Cell C — Grooving</option>
                      <option value="D">Cell D — Deburring</option>
                      <option value="E">Cell E — Laser Marking</option>
                      <option value="F">Cell F</option>
                      <option value="G">Cell G</option>
                      <option value="H">Cell H</option>
                      <option value="I">Cell I</option>
                      <option value="J">Cell J</option>
                    </select>
                  </label>
                )}

                {chartPeriod === 'daily' && (
                  <label
                    className="filter-box"
                    style={{ flex: '1 1 120px' }}
                  >
                    <span>Month</span>
                    <input
                      type="month"
                      value={chartMonth}
                      onChange={(event) => setChartMonth(event.target.value)}
                    />
                  </label>
                )}

                {chartPeriod === 'monthly' && (
                  <label
                    className="filter-box"
                    style={{ flex: '1 1 100px' }}
                  >
                    <span>Year</span>
                    <select
                      value={chartYear}
                      onChange={(event) => setChartYear(event.target.value)}
                    >
                      <option value="2025">2025</option>
                      <option value="2026">2026</option>
                      <option value="2027">2027</option>
                    </select>
                  </label>
                )}
              </div>

              <div className="chart-summary">
                <div>
                  <span>Machine / Cell</span>
                  <strong>
                    {chartScope === 'machine'
                      ? chartMachine
                      : `Cell ${chartCell}`}
                  </strong>
                </div>

                <div>
                  <span>Chart period</span>
                  <strong>
                    {chartPeriod === 'hourly'
                      ? selectedDate
                      : chartPeriod === 'daily'
                        ? chartMonth
                        : chartYear}
                  </strong>
                </div>

                <div>
                  <span>Total production shown</span>
                  <strong>
                    {trendData
                      .reduce((sum, item) => sum + item.production, 0)
                      .toLocaleString()} parts
                  </strong>
                </div>
              </div>

              {trendLoading ? (
                <p
                  className="trend-message"
                  style={{
                    padding: '24px 12px',
                    textAlign: 'center',
                  }}
                >
                  Loading production data...
                </p>
              ) : trendError ? (
                <p
                  className="trend-message trend-error"
                  style={{
                    padding: '24px 12px',
                    textAlign: 'center',
                  }}
                >
                  {trendError}
                </p>
              ) : trendData.length === 0 ? (
                <p
                  className="trend-message"
                  style={{
                    padding: '24px 12px',
                    textAlign: 'center',
                  }}
                >
                  No production records found for this selection.
                </p>
              ) : (
                <div
                  className="bar-chart"
                  style={{
                    display: 'flex',
                    alignItems: 'stretch',
                    gap: '6px',
                    overflowX: 'auto',
                    minHeight: '220px',
                    padding: '12px 4px 8px',
                  }}
                >
                  {trendData.map((item, index) => {
                    const maxProduction = Math.max(
                      ...trendData.map((entry) => entry.production),
                      1
                    )

                    return (
                      <div
                        className="bar-column"
                        key={`${item.label}-${index}`}
                        title={`${item.label}: ${item.production} parts`}
                        style={{
                          minWidth:
                            chartPeriod === 'hourly' ? '28px' : '34px',
                          flex:
                            chartPeriod === 'hourly'
                              ? '1 0 28px'
                              : '1 0 34px',
                        }}
                      >
                        <span className="bar-value">
                          {item.production.toLocaleString()}
                        </span>

                        <div className="bar-track">
                          <div
                            className="bar-fill"
                            style={{
                              height: `${
                                (item.production / maxProduction) * 100
                              }%`,
                              minHeight: item.production > 0 ? '3px' : '0',
                            }}
                          />
                        </div>

                        <span
                          className="bar-label"
                          style={{
                            whiteSpace: 'nowrap',
                            fontSize: '10px',
                          }}
                        >
                          {item.label}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}

              <div className="chart-legend">
                <i /> Actual production (parts)
              </div>

              <div className="panel-footnote">
                Production day: 06:45 to 06:45 the next day. Chart values are read from the database.
              </div>
            </section>
          </div>

          <section className="panel machine-table-panel">
            <SectionTitle
              title={`Cell ${selectedCell} — Machine Details`}
              subtitle="Machine-level production and runtime information"
              right={
                <input
                  className="table-search"
                  placeholder="Search machine..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              }
            />

            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Machine</th>
                    <th>Cell</th>
                    <th>Connection / Status</th>
                    <th>Total Parts</th>
                    <th>Running Time (min)</th>
                    <th>OEE</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredMachines
                    .filter((machine) => machine.cell === selectedCell)
                    .map((machine) => (
                      <tr key={machine.name}>
                        <td><strong>{machine.name}</strong></td>
                        <td>
                          <span className="cell-chip">{machine.cell}</span>
                        </td>
                        <td>
                          <span
                            className={`status-pill ${
                              machine.name === 'AA1'
                                ? 'pill-running'
                                : 'pill-unknown'
                            }`}
                          >
                            <i /> {machine.status}
                          </span>
                        </td>
                        <td>{machine.production}</td>
                        <td>{machine.running}</td>
                        <td>
                          {machine.oee === null
                            ? '—'
                            : `${machine.oee}%`}
                        </td>
                        <td>
                          <button
                            className="text-button"
                            onClick={() => setActivePage('Machines')}
                          >
                            View details →
                          </button>
                        </td>
                      </tr>
                    ))}

                  {filteredMachines.filter(
                    (machine) => machine.cell === selectedCell
                  ).length === 0 && (
                    <tr>
                      <td colSpan="7" className="empty-state">
                        No matching configured machine. This cell may be awaiting setup.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel graph-panel">
            <SectionTitle
              title="Graph Analysis"
              subtitle="Live database analysis using the Production Trend filters above"
              right={
                <span className="live-label">
                  <span className="pulse-dot" /> DATABASE DATA
                </span>
              }
            />

            <div className="graph-tabs">
              {[
                'Production',
                'Running Time',
                'OEE',
                'Availability',
                'Performance',
                'Plan vs Actual',
              ].map((tab) => (
                <button
                  key={tab}
                  className={
                    selectedGraph === tab ? 'graph-tab active' : 'graph-tab'
                  }
                  onClick={() => setSelectedGraph(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>

            {(() => {
              const graphMetrics = {
                Production: {
                  field: 'production',
                  unit: 'parts',
                  description: 'Actual production',
                },
                'Running Time': {
                  field: 'running_minutes',
                  unit: 'minutes',
                  description: 'Machine running time',
                },
                Downtime: {
                  field: 'downtime_minutes',
                  unit: 'minutes',
                  description: 'Recorded downtime',
                },
              }

              const metric = graphMetrics[selectedGraph]

              if (selectedGraph === 'Plan vs Actual') {
                const planned = planActualData?.planned_quantity == null
                  ? null
                  : Number(planActualData.planned_quantity)
                const actual = planActualData?.actual_quantity == null
                  ? null
                  : Number(planActualData.actual_quantity)
                const achievement = planActualData?.achievement_percentage == null
                  ? null
                  : Number(planActualData.achievement_percentage)
                const maxValue = Math.max(planned || 0, actual || 0, 1)

                return (
                  <div className="plan-actual-graph">
                    <div className="plan-actual-filters" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'end', margin: '18px 0' }}>
                      <label className="filter-box" style={{ display: 'grid', gap: 6, color: '#334155', fontSize: 14, fontWeight: 600 }}>
                        <span style={{ color: '#334155' }}>Production date</span>
                        <input type="date" value={planActualDate} onChange={(event) => { setPlanActualDate(event.target.value); setPlanActualRequested(false); setPlanActualData(null); setPlanActualError(''); }} />
                      </label>
                      <label className="filter-box" style={{ display: 'grid', gap: 6, color: '#334155', fontSize: 14, fontWeight: 600 }}>
                        <span style={{ color: '#334155' }}>Machine code</span>
                        <input value={planActualMachine} onChange={(event) => { setPlanActualMachine(event.target.value.toUpperCase()); setPlanActualRequested(false); setPlanActualData(null); setPlanActualError(''); }} placeholder="AA1" />
                      </label>
                      <button type="button" className="primary-button" disabled={planActualLoading || !planActualDate || !planActualMachine.trim()} onClick={() => setPlanActualRequested(true)}>
                        {planActualLoading ? 'Loading...' : 'Load Comparison'}
                      </button>
                    </div>

                    {planActualError && <div className="empty-state" role="alert" style={{ color: '#b91c1c', fontSize: 14 }}>{planActualError}</div>}
                    {!planActualRequested && !planActualLoading && !planActualError && (
                      <div className="graph-placeholder">
                        <div className="graph-placeholder-icon">⇄</div>
                        <strong style={{ color: '#102a43', fontSize: 16 }}>Plan vs Actual comparison</strong>
                        <p style={{ color: '#475569', fontSize: 14 }}>Select a production date and machine, then click Load Comparison.</p>
                      </div>
                    )}
                    {planActualLoading && <div className="graph-placeholder"><strong style={{ color: '#102a43', fontSize: 15 }}>Loading Plan vs Actual...</strong></div>}
                    {planActualData && !planActualLoading && (
                      <>
                        <div className="chart-summary" style={{ color: '#16324f' }}>
                          <div><span style={{ color: '#475569', fontSize: 13, fontWeight: 600 }}>Production date</span><strong style={{ color: '#102a43', fontSize: 16 }}>{planActualData.date}</strong></div>
                          <div><span style={{ color: '#475569', fontSize: 13, fontWeight: 600 }}>Machine</span><strong style={{ color: '#102a43', fontSize: 16 }}>{planActualData.machine?.machine_code || planActualMachine}</strong></div>
                          <div><span style={{ color: '#475569', fontSize: 13, fontWeight: 600 }}>Hourly records</span><strong style={{ color: '#102a43', fontSize: 16 }}>{Number(planActualData.hourly_records || 0).toLocaleString()}</strong></div>
                        </div>
                        <div className="chart-summary" style={{ marginTop: 12, color: '#16324f' }}>
                          <div><span style={{ color: '#475569', fontSize: 13, fontWeight: 600 }}>Planned Quantity</span><strong style={{ color: '#102a43', fontSize: 16 }}>{planned == null ? 'No plan saved' : `${planned.toLocaleString()} parts`}</strong></div>
                          <div><span style={{ color: '#475569', fontSize: 13, fontWeight: 600 }}>Actual Production</span><strong style={{ color: '#102a43', fontSize: 16 }}>{actual == null ? 'No hourly records' : `${actual.toLocaleString()} parts`}</strong></div>
                          <div><span style={{ color: '#475569', fontSize: 13, fontWeight: 600 }}>Achievement</span><strong style={{ color: '#102a43', fontSize: 16 }}>{achievement == null ? '—' : `${achievement.toLocaleString()}%`}</strong></div>
                        </div>
                        <div style={{ marginTop: 26 }}>
                          <h3 style={{ color: '#102a43', fontSize: 18, margin: '0 0 6px' }}>
                            Hourly Running Time &amp; Achievement
                          </h3>
                          <p style={{ color: '#475569', fontSize: 14, lineHeight: 1.5, margin: '0 0 14px' }}>
                            Each production hour is measured against 60 minutes. Running achievement = running minutes ÷ 60 × 100%, capped at 100%.
                          </p>
                          <div className="table-scroll">
                            <table>
                              <thead>
                                <tr>
                                  <th>Production Hour</th>
                                  <th>Running Time</th>
                                  <th>Running Achievement</th>
                                  <th>Production</th>
                                </tr>
                              </thead>
                              <tbody>
                                {planActualHours
                                  .slice()
                                  .sort((a, b) => Number(a.hour_no) - Number(b.hour_no))
                                  .map((hour) => {
                                    const hourNo = Number(hour.hour_no) || 1
                                    const running = Math.max(0, Number(hour.running_minutes) || 0)
                                    const production = Number(hour.total_quantity) || 0
                                    const startMinutes = (6 * 60 + 45 + (hourNo - 1) * 60) % (24 * 60)
                                    const endMinutes = (startMinutes + 60) % (24 * 60)
                                    const formatTime = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
                                    const hoursPart = Math.floor(running / 60)
                                    const minutesPart = Math.floor(running % 60)
                                    const achievementByHour = Math.min(100, (running / 60) * 100)
                                    const achievementColor = achievementByHour < 60
                                      ? '#dc2626'
                                      : achievementByHour < 80
                                        ? '#f97316'
                                        : '#16a34a' 

                                    return (
                                      <tr key={hour.hour_no}>
                                        <td><strong>{formatTime(startMinutes)}–{formatTime(endMinutes)}</strong></td>
                                        <td>
                                          <strong style={{ color: '#102a43' }}>{running.toLocaleString()} min</strong>
                                          <div style={{ color: '#475569', fontSize: 13 }}>({hoursPart}h {String(minutesPart).padStart(2, '0')}m)</div>
                                        </td>
                                        <td style={{ minWidth: 175, color: '#102a43' }}>
                                          <strong
                                            style={{
                                              display: 'block',
                                              color: '#102a43',
                                              WebkitTextFillColor: '#102a43',
                                              fontSize: 14,
                                              fontWeight: 700,
                                              lineHeight: '20px',
                                              opacity: 1,
                                              visibility: 'visible',
                                            }}
                                          >
                                            {achievementByHour.toFixed(1)}%
                                          </strong>
                                          <div style={{ height: 8, marginTop: 6, background: '#e2e8f0', borderRadius: 6, overflow: 'hidden' }}>
                                            <div style={{ height: '100%', width: `${achievementByHour}%`, background: achievementColor, borderRadius: 6 }} />
                                          </div>
                                        </td>
                                        <td>{production.toLocaleString()} parts</td>
                                      </tr>
                                    )
                                  })}
                                {planActualHours.length === 0 && (
                                  <tr><td colSpan="4" className="empty-state">No hourly records found for this machine and date.</td></tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                        {planned != null && actual != null && (
                          <div style={{ marginTop: 24 }}>
                            {[{ label: 'Planned', value: planned }, { label: 'Actual', value: actual }].map((item) => (
                              <div key={item.label} style={{ marginBottom: 18 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 7 }}>
                                  <strong style={{ color: '#102a43', fontSize: 14 }}>{item.label}</strong><span style={{ color: '#334155', fontSize: 14 }}>{item.value.toLocaleString()} parts</span>
                                </div>
                                <div style={{ height: 18, borderRadius: 9, background: 'rgba(148,163,184,.18)', overflow: 'hidden' }}>
                                  <div style={{ width: `${(item.value / maxValue) * 100}%`, height: '100%', background: item.label === 'Planned' ? '#64748b' : '#22c55e', borderRadius: 9 }} />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {planned == null && <p className="panel-footnote">No production plan exists for this machine and date. Add it in Production Plan.</p>}
                        {actual == null && <p className="panel-footnote">No hourly production records exist for this machine and date.</p>}
                        {actual != null && planned != null && actual > planned * 2 && <p className="panel-footnote">Actual production is more than twice the plan. Verify the hourly PLC totals before using this percentage in reports.</p>}
                      </>
                    )}
                  </div>
                )
              }

              const graphRows = metric
                ? trendData.map((item) => ({
                    label: item.label,
                    value: Number(item[metric.field]) || 0,
                  }))
                : []
              const graphTotal = graphRows.reduce(
                (sum, item) => sum + item.value,
                0
              )
              const graphMax = Math.max(
                ...graphRows.map((item) => item.value),
                1
              )

              if (!metric) {
                return (
                  <div className="graph-placeholder">
                    <div className="graph-placeholder-icon">ⓘ</div>
                    <strong>{selectedGraph} data is not available yet</strong>
                    <p>
                      The current trend API supplies production, running time,
                      and downtime only. Validated source fields and calculation
                      rules are required before this metric can be displayed.
                    </p>
                  </div>
                )
              }

              if (trendLoading) {
                return (
                  <div className="graph-placeholder">
                    <strong>Loading {selectedGraph.toLowerCase()} data...</strong>
                  </div>
                )
              }

              if (trendError) {
                return (
                  <div className="graph-placeholder">
                    <strong>Unable to load graph data</strong>
                    <p>{trendError}</p>
                  </div>
                )
              }

              if (graphRows.length === 0) {
                return (
                  <div className="graph-placeholder">
                    <strong>No records found</strong>
                    <p>Try another date, month, year, machine, or cell.</p>
                  </div>
                )
              }

              return (
                <>
                  <div className="chart-summary">
                    <div>
                      <span>Metric</span>
                      <strong>{metric.description}</strong>
                    </div>
                    <div>
                      <span>Machine / Cell</span>
                      <strong>
                        {chartScope === 'machine'
                          ? chartMachine
                          : `Cell ${chartCell}`}
                      </strong>
                    </div>
                    <div>
                      <span>Total {metric.description.toLowerCase()}</span>
                      <strong>
                        {graphTotal.toLocaleString()} {metric.unit}
                      </strong>
                    </div>
                  </div>

                  <div
                    className="bar-chart"
                    style={{
                      display: 'flex',
                      alignItems: 'stretch',
                      gap: '6px',
                      overflowX: 'auto',
                      minHeight: '220px',
                      padding: '12px 4px 8px',
                    }}
                  >
                    {graphRows.map((item, index) => (
                      <div
                        className="bar-column"
                        key={`${item.label}-${index}`}
                        title={`${item.label}: ${item.value.toLocaleString()} ${metric.unit}`}
                        style={{
                          minWidth: chartPeriod === 'hourly' ? '28px' : '34px',
                          flex:
                            chartPeriod === 'hourly'
                              ? '1 0 28px'
                              : '1 0 34px',
                        }}
                      >
                        <span className="bar-value">
                          {item.value.toLocaleString()}
                        </span>
                        <div className="bar-track">
                          <div
                            className="bar-fill"
                            style={{
                              height: `${(item.value / graphMax) * 100}%`,
                              minHeight: item.value > 0 ? '3px' : '0',
                            }}
                          />
                        </div>
                        <span
                          className="bar-label"
                          style={{
                            whiteSpace: 'nowrap',
                            fontSize: '10px',
                          }}
                        >
                          {item.label}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="chart-legend">
                    <i /> {metric.description} ({metric.unit})
                  </div>
                  <div className="panel-footnote">
                    This graph uses the same machine/cell, period, and date
                    filters as Production Trend above.
                  </div>
                </>
              )
            })()}
          </section>

            </>
          )}

          <footer className="footer">
            <span>Industrial OEE Monitoring System</span>
            <span>
              Standalone internal-network application · UI Preview
            </span>
          </footer>
        </div>
      </main>
    </div>
  )
}

export default App
