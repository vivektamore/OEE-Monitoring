import React, { useState, useEffect } from 'react';
import './ManpowerManagement.css';

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

export default function ManpowerManagement() {
  const [selectedShift, setSelectedShift] = useState('Shift A');
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));

  // Data states
  const [summary, setSummary] = useState(null);
  const [allocations, setAllocations] = useState([]);
  const [swaps, setSwaps] = useState([]);
  const [matrixData, setMatrixData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // UI interaction states
  const [search, setSearch] = useState('');
  const [shortageOnly, setShortageOnly] = useState(false);
  const [expandedCells, setExpandedCells] = useState(new Set(['Press Shop']));
  const [swapTab, setSwapTab] = useState('All');

  // Modal / Drawer states
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [swapSubmitting, setSwapSubmitting] = useState(false);
  const [swapForm, setSwapForm] = useState({
    operator_name: '',
    operator_id: '',
    operator_role: 'Operator Gr. II',
    from_cell: 'Press Shop',
    to_cell: 'Screw Forging',
    shift: 'Shift A',
    request_date: new Date().toISOString().slice(0, 10),
    swap_type: 'Shift Swap',
    reason: ''
  });

  // Plan Edit Modal
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [planPin, setPlanPin] = useState('');
  const [planPinUnlocked, setPlanPinUnlocked] = useState(false);
  const [planShop, setPlanShop] = useState('Press Shop');
  const [planCount, setPlanCount] = useState('');
  const [planMessage, setPlanMessage] = useState('');

  // Department Allocation Edit Modal (Direct DB update)
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editMessage, setEditMessage] = useState('');
  const [editForm, setEditForm] = useState({
    shop_name: '',
    cell_code: '',
    cell_manager: '',
    required_count: 0,
    allocated_count: 0,
    present_count: 0,
    swap_in: 0,
    swap_out: 0
  });

  // Roster View Modal
  const [rosterModalDept, setRosterModalDept] = useState(null);

  // Fetch summary and allocations
  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [sumRes, allocRes, swapRes, matrixRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/manpower/summary?date=${selectedDate}&shift=${encodeURIComponent(selectedShift)}`),
        fetch(`${API_BASE_URL}/api/manpower/allocations?date=${selectedDate}&shift=${encodeURIComponent(selectedShift)}`),
        fetch(`${API_BASE_URL}/api/manpower/swaps?status=${swapTab}`),
        fetch(`${API_BASE_URL}/api/manpower/monthly-matrix?month=${selectedMonth}`)
      ]);

      if (sumRes.ok) {
        const sumData = await sumRes.json();
        setSummary(sumData);
      }
      if (allocRes.ok) {
        const allocData = await allocRes.json();
        setAllocations(allocData.allocations || []);
      }
      if (swapRes.ok) {
        const swapData = await swapRes.json();
        setSwaps(swapData.swaps || []);
      }
      if (matrixRes.ok) {
        const matData = await matrixRes.json();
        setMatrixData(matData);
      }
    } catch (err) {
      console.error('Failed to load manpower data:', err);
      setError('Unable to connect to manpower services.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedDate, selectedShift, swapTab, selectedMonth]);

  // Toggle cell machine subrow
  const toggleCellExpand = (deptName) => {
    setExpandedCells(prev => {
      const next = new Set(prev);
      if (next.has(deptName)) {
        next.delete(deptName);
      } else {
        next.add(deptName);
      }
      return next;
    });
  };

  // Open Quick Swap prefilling from_cell
  const openQuickSwap = (cellName) => {
    setSwapForm(prev => ({
      ...prev,
      from_cell: cellName,
      shift: selectedShift,
      request_date: selectedDate
    }));
    setDrawerOpen(true);
  };

  // Submit swap request
  const handleSwapSubmit = async (e) => {
    e.preventDefault();
    setSwapSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/manpower/swaps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(swapForm)
      });
      const data = await res.json();
      if (res.ok) {
        setDrawerOpen(false);
        setSwapForm({
          operator_name: '',
          operator_id: '',
          operator_role: 'Operator Gr. II',
          from_cell: 'Press Shop',
          to_cell: 'Screw Forging',
          shift: selectedShift,
          request_date: selectedDate,
          swap_type: 'Shift Swap',
          reason: ''
        });
        loadData();
      } else {
        alert(data.message || 'Error submitting swap');
      }
    } catch (err) {
      console.error(err);
      alert('Network error submitting swap');
    } finally {
      setSwapSubmitting(false);
    }
  };

  // Approve / Reject Swap Action
  const handleSwapAction = async (id, action) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/manpower/swaps/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      if (res.ok) {
        loadData();
      } else {
        const d = await res.json();
        alert(d.message || 'Error updating swap');
      }
    } catch (err) {
      console.error(err);
      alert('Error updating swap status');
    }
  };

  // Save Manpower Target Plan
  const handleSavePlan = async (e) => {
    e.preventDefault();
    setPlanMessage('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/manpower/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pin: planPin,
          plan_date: selectedDate,
          shop_name: planShop,
          manpower_count: planCount
        })
      });
      const d = await res.json();
      if (res.ok) {
        setPlanMessage('Manpower plan saved successfully!');
        loadData();
        setTimeout(() => setPlanModalOpen(false), 1200);
      } else {
        setPlanMessage(d.message || 'Failed to save plan');
      }
    } catch (err) {
      setPlanMessage('Network error saving plan');
    }
  };

  // Export Shift Roster as CSV
  const handleExportRoster = () => {
    if (!allocations.length) return;
    let csv = 'Department,Cell Code,Manager,Required,Allocated,Present,Shortage,Swap In,Swap Out,Effective Util %\n';
    allocations.forEach(a => {
      csv += `"${a.deptName}","${a.cellCode}","${a.manager}",${a.required},${a.allocated},${a.present},${a.shortage},${a.swapIn},${a.swapOut},"${a.effectiveUtilization}%"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Manpower_Roster_${selectedDate}_${selectedShift.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Open Department Edit Modal
  const openDeptEditModal = (dept) => {
    setEditForm({
      shop_name: dept.deptName,
      cell_code: dept.cellCode,
      cell_manager: dept.manager,
      required_count: dept.required,
      allocated_count: dept.allocated,
      present_count: dept.present,
      swap_in: dept.swapIn,
      swap_out: dept.swapOut
    });
    setEditMessage('');
    setEditModalOpen(true);
  };

  // Save Department Edit directly to DB
  const handleSaveDeptEdit = async (e) => {
    e.preventDefault();
    setEditLoading(true);
    setEditMessage('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/manpower/allocations/${encodeURIComponent(editForm.shop_name)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_date: selectedDate,
          cell_manager: editForm.cell_manager,
          required_count: Number(editForm.required_count),
          allocated_count: Number(editForm.allocated_count),
          present_count: Number(editForm.present_count),
          swap_in: Number(editForm.swap_in),
          swap_out: Number(editForm.swap_out)
        })
      });
      const d = await res.json();
      if (res.ok) {
        setEditMessage('Database updated successfully!');
        loadData();
        setTimeout(() => setEditModalOpen(false), 900);
      } else {
        setEditMessage(d.message || 'Error updating database');
      }
    } catch (err) {
      setEditMessage('Network error updating database');
    } finally {
      setEditLoading(false);
    }
  };

  // Filter allocations
  const filteredAllocations = allocations.filter(a => {
    const matchesSearch = a.deptName.toLowerCase().includes(search.toLowerCase()) ||
                          a.manager.toLowerCase().includes(search.toLowerCase());
    const matchesShortage = shortageOnly ? a.shortage < 0 : true;
    return matchesSearch && matchesShortage;
  });

  return (
    <div className="manpower-container">
      {/* Header and Controls */}
      <div className="mp-header">
        <div className="mp-header-top">
          <div className="mp-title-group">
            <span className="mp-eyebrow">Factory Performance Center</span>
            <h1>Manpower Management</h1>
            <p className="mp-subtitle">
              Real-time workforce deployment, shift balancing, and swap approvals across production cells
            </p>
          </div>
          <div className="mp-actions-group">
            <button className="btn-secondary" onClick={() => setPlanModalOpen(true)}>
              ⚙ Configure Target
            </button>
            <button className="btn-secondary" onClick={handleExportRoster}>
              ⬇ Export Shift Roster
            </button>
            <button className="btn-primary" onClick={() => setDrawerOpen(true)}>
              + Initiate Swap Request
            </button>
          </div>
        </div>

        <div className="mp-controls-bar">
          <div className="shift-selector-pills">
            {['Shift A', 'Shift B', 'Shift C'].map(shift => (
              <button
                key={shift}
                className={`shift-pill ${selectedShift === shift ? 'active' : ''}`}
                onClick={() => setSelectedShift(shift)}
              >
                {shift}
              </button>
            ))}
          </div>

          <div className="date-input-group">
            <span>Date:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
        </div>
      </div>

      {error && <div className="error-banner" style={{ background: '#fee2e2', color: '#b91c1c', padding: '10px 14px', borderRadius: '6px' }}>{error}</div>}

      {/* KPI Cards Grid */}
      <div className="mp-kpi-grid">
        <div className="mp-kpi-card blue">
          <div className="mp-kpi-label">
            <span>Planned Manpower</span>
            <span>👥</span>
          </div>
          <div className="mp-kpi-value">{summary?.plannedManpower ?? '—'}</div>
          <div className="mp-kpi-footer">Standard Target Roster</div>
        </div>

        <div className="mp-kpi-card emerald">
          <div className="mp-kpi-label">
            <span>Present On-Floor</span>
            <span>⚡</span>
          </div>
          <div className="mp-kpi-value">{summary?.presentOnFloor ?? '—'}</div>
          <div className="mp-kpi-footer">
            {summary?.plannedManpower ? `${Math.round((summary.presentOnFloor / summary.plannedManpower) * 100)}% of target` : 'Active headcount'}
          </div>
        </div>

        <div className="mp-kpi-card rose">
          <div className="mp-kpi-label">
            <span>Net Shortage</span>
            <span>⚠</span>
          </div>
          <div className="mp-kpi-value" style={{ color: (summary?.netShortage ?? 0) < 0 ? '#dc2626' : '#16a34a' }}>
            {summary?.netShortage !== undefined ? (summary.netShortage > 0 ? `+${summary.netShortage}` : summary.netShortage) : '—'}
          </div>
          <div className="mp-kpi-footer">Across all active cells</div>
        </div>

        <div className="mp-kpi-card amber">
          <div className="mp-kpi-label">
            <span>Active Swaps</span>
            <span>⇄</span>
          </div>
          <div className="mp-kpi-value">{summary?.activeSwaps ?? '—'}</div>
          <div className="mp-kpi-footer">Pending approval chain</div>
        </div>

        <div className="mp-kpi-card indigo">
          <div className="mp-kpi-label">
            <span>Avg. Utilization</span>
            <span>📊</span>
          </div>
          <div className="mp-kpi-value">{summary?.avgUtilization != null ? `${summary.avgUtilization}%` : '—'}</div>
          <div className="mp-kpi-footer">Effective headcount efficiency</div>
        </div>

        <div className="mp-kpi-card rose">
          <div className="mp-kpi-label">
            <span>Critical Cells</span>
            <span>🚨</span>
          </div>
          <div className="mp-kpi-value">{summary?.criticalCells ?? 0}</div>
          <div className="mp-kpi-footer">Below 90% staffing threshold</div>
        </div>
      </div>

      {/* Section: Department-Wise Manpower Allocation & Real-Time Tracking */}
      <div className="mp-card-section">
        <div className="mp-section-bar">
          <div className="mp-section-title-wrap">
            <h2>Department-Wise Manpower Allocation & Real-Time Tracking</h2>
            <p>Live operational staffing balance, net shift swaps, and assigned cell supervisors</p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div className="mp-search-box">
              <input
                type="text"
                placeholder="Search cell or manager..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="mp-filter-tabs">
              <button
                className={`filter-tab ${!shortageOnly ? 'active' : ''}`}
                onClick={() => setShortageOnly(false)}
              >
                All ({allocations.length})
              </button>
              <button
                className={`filter-tab ${shortageOnly ? 'active' : ''}`}
                onClick={() => setShortageOnly(true)}
              >
                Shortage Only ({allocations.filter(a => a.shortage < 0).length})
              </button>
            </div>
          </div>
        </div>

        <div className="mp-table-wrapper">
          <table className="mp-table">
            <thead>
              <tr>
                <th>Department / Cell</th>
                <th style={{ textAlign: 'center' }}>Req.</th>
                <th style={{ textAlign: 'center' }}>Alloc.</th>
                <th style={{ textAlign: 'center' }}>Present</th>
                <th style={{ textAlign: 'center' }}>Shortage</th>
                <th style={{ textAlign: 'center' }}>Swap In</th>
                <th style={{ textAlign: 'center' }}>Swap Out</th>
                <th>Effective Utilization</th>
                <th>Cell Manager</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAllocations.map(dept => {
                const isExpanded = expandedCells.has(dept.deptName);
                const utilClass = dept.effectiveUtilization >= 95 ? 'high' : dept.effectiveUtilization >= 85 ? 'medium' : 'low';
                return (
                  <React.Fragment key={dept.deptName}>
                    <tr>
                      <td>
                        <div className="cell-name-box">
                          {dept.machines && dept.machines.length > 0 ? (
                            <span
                              className={`expand-chevron ${isExpanded ? 'open' : ''}`}
                              onClick={() => toggleCellExpand(dept.deptName)}
                              title="Toggle machine operators"
                            >
                              ▶
                            </span>
                          ) : (
                            <span style={{ width: 16 }} />
                          )}
                          <span>{dept.deptName}</span>
                          <span className="cell-code-badge">{dept.cellCode}</span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="number-cell">{dept.required}</span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="number-cell">{dept.allocated}</span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="number-cell" style={{ fontWeight: 700 }}>{dept.present}</span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`badge-shortage ${dept.shortage < 0 ? 'negative' : dept.shortage === 0 ? 'zero' : 'positive'}`}>
                          {dept.shortage > 0 ? `+${dept.shortage}` : dept.shortage}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {dept.swapIn > 0 ? (
                          <span className="badge-swap-in">+{dept.swapIn}</span>
                        ) : (
                          <span style={{ color: '#64748b', fontWeight: 600 }}>0</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {dept.swapOut > 0 ? (
                          <span className="badge-swap-out">-{dept.swapOut}</span>
                        ) : (
                          <span style={{ color: '#64748b', fontWeight: 600 }}>0</span>
                        )}
                      </td>
                      <td>
                        <div className="util-bar-container">
                          <div className="util-bar-bg">
                            <div className={`util-bar-fill ${utilClass}`} style={{ width: `${Math.min(dept.effectiveUtilization, 100)}%` }} />
                          </div>
                          <span className="number-cell" style={{ fontSize: 11 }}>{dept.effectiveUtilization}%</span>
                        </div>
                      </td>
                      <td>
                        <span className="cell-manager-text">{dept.manager}</span>
                      </td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', gap: 5 }}>
                          <button
                            className="action-btn-sm quick-swap"
                            onClick={() => openQuickSwap(dept.deptName)}
                            title="Quick swap request for this cell"
                          >
                            + Quick Swap
                          </button>
                          <button
                            className="action-btn-sm roster"
                            onClick={() => setRosterModalDept(dept)}
                            title="View roster"
                          >
                            Roster
                          </button>
                          <button
                            className="action-btn-sm edit-btn"
                            onClick={() => openDeptEditModal(dept)}
                            title="Update department column in database"
                          >
                            Edit
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expandable sub-row for machines */}
                    {isExpanded && dept.machines && dept.machines.length > 0 && (
                      <tr className="machine-subrow">
                        <td colSpan={10}>
                          <div style={{ marginBottom: 6, fontSize: 11, fontWeight: 700, color: '#475569' }}>
                            Assigned Machine Station Operators ({dept.deptName}):
                          </div>
                          <div className="machine-grid">
                            {dept.machines.map(m => (
                              <div key={m.code} className="machine-card-mini">
                                <div className="top">
                                  <span className="machine-code">{m.code} · {m.name}</span>
                                  <span style={{ fontSize: 9, background: '#dcfce7', color: '#166534', padding: '1px 5px', borderRadius: 3, fontWeight: 600 }}>
                                    {m.status}
                                  </span>
                                </div>
                                <div className="operator-name">{m.operator}</div>
                                <div className="operator-role">{m.role} · {m.shift}</div>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section: Active Manpower Swap Requests & Approvals Workflow */}
      <div className="mp-card-section">
        <div className="mp-section-bar">
          <div className="mp-section-title-wrap">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2>Active Manpower Swap Requests & Approvals Workflow</h2>
              <span style={{ background: '#dbeafe', color: '#1e40af', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 12 }}>
                Multi-tier Gateway
              </span>
            </div>
            <p>Dual approval chain required: Releasing Cell Manager → Receiving Cell Manager → Plant Admin</p>
          </div>

          <div className="mp-filter-tabs">
            {['All', 'Pending', 'Approved', 'Rejected'].map(tab => (
              <button
                key={tab}
                className={`filter-tab ${swapTab === tab ? 'active' : ''}`}
                onClick={() => setSwapTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="mp-table-wrapper">
          <table className="mp-table">
            <thead>
              <tr>
                <th>Req. ID</th>
                <th>Operator / Employee</th>
                <th>From Cell</th>
                <th>To Cell</th>
                <th>Swap Type</th>
                <th>Date & Shift</th>
                <th>Approval Chain Stages</th>
                <th style={{ textAlign: 'right' }}>Action Gate</th>
              </tr>
            </thead>
            <tbody>
              {swaps.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', color: '#94a3b8', padding: 24 }}>
                    No swap requests found for status "{swapTab}".
                  </td>
                </tr>
              ) : (
                swaps.map(req => (
                  <tr key={req.id}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#2563eb' }}>{req.req_id}</td>
                    <td>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{req.operator_name}</div>
                      <div style={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace' }}>
                        {req.operator_id} · {req.operator_role}
                      </div>
                    </td>
                    <td>
                      <span style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4, fontWeight: 500 }}>
                        {req.from_cell}
                      </span>
                    </td>
                    <td>
                      <span style={{ background: '#eff6ff', color: '#1e40af', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>
                        {req.to_cell}
                      </span>
                    </td>
                    <td>
                      <span style={{ background: '#f5f3ff', color: '#6d28d9', border: '1px solid #ddd6fe', padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700 }}>
                        {req.swap_type}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: 11 }}>
                      {req.request_date ? req.request_date.slice(5) : ''} ({req.shift})
                    </td>
                    <td>
                      <div className="approval-chain">
                        <span className={`approval-node ${req.releasing_approval?.toLowerCase() || 'approved'}`}>
                          {req.releasing_manager || 'Releasing'} ✓
                        </span>
                        <span className="chain-arrow">→</span>
                        <span className={`approval-node ${req.receiving_approval?.toLowerCase() || 'pending'}`}>
                          {req.receiving_manager || 'Receiving'} {req.receiving_approval === 'Approved' ? '✓' : req.receiving_approval === 'Rejected' ? '✗' : '⏳'}
                        </span>
                        <span className="chain-arrow">→</span>
                        <span className={`approval-node ${req.admin_approval?.toLowerCase() || 'pending'}`}>
                          Plant Admin {req.admin_approval === 'Approved' ? '✓' : req.admin_approval === 'Rejected' ? '✗' : '⏳'}
                        </span>
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {req.status === 'Pending' ? (
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          <button
                            className="action-btn-sm approve"
                            onClick={() => handleSwapAction(req.id, 'approve')}
                          >
                            Approve
                          </button>
                          <button
                            className="action-btn-sm reject"
                            onClick={() => handleSwapAction(req.id, 'reject')}
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: 4,
                          background: req.status === 'Approved' ? '#dcfce7' : '#fee2e2',
                          color: req.status === 'Approved' ? '#15803d' : '#b91c1c'
                        }}>
                          {req.status}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section: Monthly Manpower Attendance & Cell Shortage Matrix */}
      <div className="mp-card-section">
        <div className="mp-section-bar">
          <div className="mp-section-title-wrap">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2>Monthly Manpower Attendance & Cell Shortage Matrix</h2>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                style={{ padding: '2px 8px', fontSize: 11, border: '1px solid #cbd5e1', borderRadius: 4 }}
              />
            </div>
            <p>Day-by-day cell compliance and shift staffing variance throughout the month</p>
          </div>

          <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#475569' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span className="matrix-day-pill compliant" style={{ width: 14, height: 14 }}></span> Compliant
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span className="matrix-day-pill shortage" style={{ width: 14, height: 14 }}></span> Shortage
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span className="matrix-day-pill excess" style={{ width: 14, height: 14 }}></span> Excess
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span className="matrix-day-pill off" style={{ width: 14, height: 14 }}></span> Off
            </span>
          </div>
        </div>

        <div className="matrix-container">
          {matrixData && matrixData.matrix ? (
            <table className="matrix-grid-table">
              <thead>
                <tr>
                  <th className="matrix-cell-header">Cell Name</th>
                  {Array.from({ length: matrixData.daysCount }, (_, i) => i + 1).map(d => (
                    <th key={d}>{d}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrixData.matrix.map(row => (
                  <tr key={row.cell.cellCode}>
                    <td className="matrix-cell-header">{row.cell.deptName}</td>
                    {row.days.map(d => (
                      <td key={d.day}>
                        <span
                          className={`matrix-day-pill ${d.status}`}
                          title={`Day ${d.day}: ${d.status.toUpperCase()} ${d.variance !== 0 ? `(${d.variance > 0 ? '+' : ''}${d.variance})` : ''}`}
                        >
                          {d.variance !== 0 ? (d.variance > 0 ? `+${d.variance}` : d.variance) : '✓'}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ textAlign: 'center', padding: 20, color: '#94a3b8' }}>Loading monthly attendance matrix...</div>
          )}
        </div>
      </div>

      {/* Swap Request Modal Drawer */}
      {drawerOpen && (
        <div className="drawer-overlay" onClick={() => setDrawerOpen(false)}>
          <div className="drawer-panel" onClick={e => e.stopPropagation()}>
            <div className="drawer-header">
              <div>
                <h3>Request Manpower Shift Swap</h3>
                <p>Automated impact analysis will run prior to manager signoff</p>
              </div>
              <button className="drawer-close" onClick={() => setDrawerOpen(false)}>✕</button>
            </div>

            <form onSubmit={handleSwapSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div className="drawer-body">
                <div className="form-group">
                  <label>Operator / Employee Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Suresh Chauhan"
                    value={swapForm.operator_name}
                    onChange={e => setSwapForm({ ...swapForm, operator_name: e.target.value })}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div className="form-group">
                    <label>Employee ID</label>
                    <input
                      type="text"
                      placeholder="e.g. EMP-4092"
                      value={swapForm.operator_id}
                      onChange={e => setSwapForm({ ...swapForm, operator_id: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Designation / Role</label>
                    <input
                      type="text"
                      placeholder="e.g. Operator Gr. II"
                      value={swapForm.operator_role}
                      onChange={e => setSwapForm({ ...swapForm, operator_role: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div className="form-group">
                    <label>Releasing Cell (From) *</label>
                    <select
                      value={swapForm.from_cell}
                      onChange={e => setSwapForm({ ...swapForm, from_cell: e.target.value })}
                    >
                      {allocations.map(a => (
                        <option key={a.deptName} value={a.deptName}>{a.deptName}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Receiving Cell (To) *</label>
                    <select
                      value={swapForm.to_cell}
                      onChange={e => setSwapForm({ ...swapForm, to_cell: e.target.value })}
                    >
                      {allocations.map(a => (
                        <option key={a.deptName} value={a.deptName}>{a.deptName}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div className="form-group">
                    <label>Shift</label>
                    <select
                      value={swapForm.shift}
                      onChange={e => setSwapForm({ ...swapForm, shift: e.target.value })}
                    >
                      <option value="Shift A">Shift A (06:45 - 14:45)</option>
                      <option value="Shift B">Shift B (14:45 - 22:45)</option>
                      <option value="Shift C">Shift C (22:45 - 06:45)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Date</label>
                    <input
                      type="date"
                      value={swapForm.request_date}
                      onChange={e => setSwapForm({ ...swapForm, request_date: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Swap Type</label>
                  <select
                    value={swapForm.swap_type}
                    onChange={e => setSwapForm({ ...swapForm, swap_type: e.target.value })}
                  >
                    <option value="Shift Swap">Shift Swap (Standard)</option>
                    <option value="Emergency">Emergency Absenteeism</option>
                    <option value="Skill Alignment">Tooling / Skill Alignment</option>
                    <option value="Line Balance">Line Balancing</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Justification / Reason</label>
                  <textarea
                    rows={2}
                    placeholder="Provide operational reason for transfer..."
                    value={swapForm.reason}
                    onChange={e => setSwapForm({ ...swapForm, reason: e.target.value })}
                  />
                </div>

                <div className="impact-check-box">
                  <div style={{ fontWeight: 700, color: '#1e293b' }}>⚡ Automated Impact Check:</div>
                  <div>• Releasing Cell ({swapForm.from_cell}) staffing will decrease by 1</div>
                  <div>• Receiving Cell ({swapForm.to_cell}) shortage will be alleviated</div>
                  <div>• Gateway requires approvals from both unit managers & plant admin</div>
                </div>
              </div>

              <div className="drawer-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setDrawerOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={swapSubmitting}
                >
                  {swapSubmitting ? 'Submitting...' : 'Submit Swap Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Plan Target Configuration Modal */}
      {planModalOpen && (
        <div className="drawer-overlay" onClick={() => setPlanModalOpen(false)}>
          <div
            style={{
              background: '#ffffff',
              borderRadius: 10,
              width: 440,
              margin: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
              overflow: 'hidden'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="drawer-header">
              <div>
                <h3>Configure Target Manpower</h3>
                <p>Protected setting: Requires 4-digit supervisor PIN</p>
              </div>
              <button className="drawer-close" onClick={() => setPlanModalOpen(false)}>✕</button>
            </div>

            <form onSubmit={handleSavePlan} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {planMessage && (
                <div style={{
                  padding: '8px 12px',
                  borderRadius: 6,
                  fontSize: 11,
                  background: planMessage.includes('success') ? '#dcfce7' : '#fee2e2',
                  color: planMessage.includes('success') ? '#166534' : '#b91c1c'
                }}>
                  {planMessage}
                </div>
              )}

              <div className="form-group">
                <label>Supervisor PIN (Default: 5837) *</label>
                <input
                  type="password"
                  maxLength={4}
                  required
                  placeholder="Enter 4-digit PIN"
                  value={planPin}
                  onChange={e => setPlanPin(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Department / Shop *</label>
                <select value={planShop} onChange={e => setPlanShop(e.target.value)}>
                  {allocations.map(a => (
                    <option key={a.deptName} value={a.deptName}>{a.deptName}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Planned Headcount (Manpower Count) *</label>
                <input
                  type="number"
                  min="0"
                  required
                  placeholder="e.g. 36"
                  value={planCount}
                  onChange={e => setPlanCount(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button type="button" className="btn-secondary" onClick={() => setPlanModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Target
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Direct Database Department Edit Modal */}
      {editModalOpen && (
        <div className="drawer-overlay" onClick={() => setEditModalOpen(false)}>
          <div
            style={{
              background: '#ffffff',
              borderRadius: 10,
              width: 480,
              margin: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)',
              overflow: 'hidden'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="drawer-header">
              <div>
                <h3>Update Department in Database</h3>
                <p>Modify headcount, active present staff, or assigned supervisor</p>
              </div>
              <button className="drawer-close" onClick={() => setEditModalOpen(false)}>✕</button>
            </div>

            <form onSubmit={handleSaveDeptEdit} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {editMessage && (
                <div style={{
                  padding: '8px 12px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 600,
                  background: editMessage.includes('success') ? '#dcfce7' : '#fee2e2',
                  color: editMessage.includes('success') ? '#166534' : '#b91c1c'
                }}>
                  {editMessage}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="form-group">
                  <label>Department</label>
                  <input type="text" readOnly value={editForm.shop_name} style={{ background: '#f8fafc', fontWeight: 600 }} />
                </div>
                <div className="form-group">
                  <label>Cell Code</label>
                  <input type="text" readOnly value={editForm.cell_code} style={{ background: '#f8fafc' }} />
                </div>
              </div>

              <div className="form-group">
                <label>Cell Manager / Supervisor *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. M. Khan"
                  value={editForm.cell_manager}
                  onChange={e => setEditForm({ ...editForm, cell_manager: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div className="form-group">
                  <label>Required</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={editForm.required_count}
                    onChange={e => setEditForm({ ...editForm, required_count: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Allocated</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={editForm.allocated_count}
                    onChange={e => setEditForm({ ...editForm, allocated_count: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Present</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={editForm.present_count}
                    onChange={e => setEditForm({ ...editForm, present_count: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="form-group">
                  <label>Swap In</label>
                  <input
                    type="number"
                    min="0"
                    value={editForm.swap_in}
                    onChange={e => setEditForm({ ...editForm, swap_in: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Swap Out</label>
                  <input
                    type="number"
                    min="0"
                    value={editForm.swap_out}
                    onChange={e => setEditForm({ ...editForm, swap_out: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button type="button" className="btn-secondary" onClick={() => setEditModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={editLoading}>
                  {editLoading ? 'Saving...' : 'Save to MySQL DB'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Roster View Modal */}
      {rosterModalDept && (
        <div className="drawer-overlay" onClick={() => setRosterModalDept(null)}>
          <div
            style={{
              background: '#ffffff',
              borderRadius: 10,
              width: 580,
              margin: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)',
              overflow: 'hidden'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="drawer-header">
              <div>
                <h3>{rosterModalDept.deptName} — Shift Roster</h3>
                <p>Cell Supervisor: <strong>{rosterModalDept.manager}</strong> · Shift: {selectedShift}</p>
              </div>
              <button className="drawer-close" onClick={() => setRosterModalDept(null)}>✕</button>
            </div>

            <div style={{ padding: 20 }}>
              <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                <div style={{ flex: 1, padding: 10, background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0', textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600 }}>REQUIRED</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>{rosterModalDept.required}</div>
                </div>
                <div style={{ flex: 1, padding: 10, background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0', textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600 }}>PRESENT</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>{rosterModalDept.present}</div>
                </div>
                <div style={{ flex: 1, padding: 10, background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0', textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600 }}>SHORTAGE</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: rosterModalDept.shortage < 0 ? '#b91c1c' : '#15803d' }}>
                    {rosterModalDept.shortage > 0 ? `+${rosterModalDept.shortage}` : rosterModalDept.shortage}
                  </div>
                </div>
              </div>

              <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>
                Assigned Operators & Machine Stations:
              </div>

              {rosterModalDept.machines && rosterModalDept.machines.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
                  {rosterModalDept.machines.map(m => (
                    <div key={m.code} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 12, color: '#0f172a' }}>{m.operator}</div>
                        <div style={{ fontSize: 10, color: '#64748b' }}>{m.role} · Station: {m.code} ({m.name})</div>
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700, background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: 4 }}>
                        {m.status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: 14, background: '#f8fafc', borderRadius: 6, color: '#64748b', fontSize: 11, textAlign: 'center' }}>
                  No station-level sub-machines mapped for this department. Standard floor rotation active.
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                <button type="button" className="btn-secondary" onClick={() => setRosterModalDept(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
