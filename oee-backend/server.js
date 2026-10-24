
require('dotenv').config();

const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const crypto = require('crypto');

const app = express();

app.use(cors());
app.use(express.json({ limit: '100kb' }));

// ==========================================
// MySQL connection pool
// ==========================================
const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'oee_monitoring',
    waitForConnections: true,
    connectionLimit: 5,
    dateStrings: true
});

// ==========================================
// Common validation functions
// ==========================================
function isValidDate(value) {
    if (
        typeof value !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(value)
    ) {
        return false;
    }

    const parsed = new Date(`${value}T00:00:00Z`);

    return (
        !Number.isNaN(parsed.getTime()) &&
        parsed.toISOString().slice(0, 10) === value
    );
}

function isValidMonth(value) {
    if (
        typeof value !== 'string' ||
        !/^\d{4}-\d{2}$/.test(value)
    ) {
        return false;
    }

    const month = Number(value.slice(5, 7));
    return month >= 1 && month <= 12;
}

function getConfiguredPin() {
    const pin = String(process.env.PLAN_EDIT_PIN || '');

    return /^\d{4}$/.test(pin) ? pin : null;
}

function pinMatches(inputPin) {
    const configuredPin = getConfiguredPin();

    if (!configuredPin) return false;

    const input = String(inputPin || '');

    if (!/^\d{4}$/.test(input)) return false;

    return crypto.timingSafeEqual(
        Buffer.from(input),
        Buffer.from(configuredPin)
    );
}

// Separate PIN for machine configuration; never reuse PLAN_EDIT_PIN here.
function getConfiguredMachineConfigPin() {
    const pin = String(process.env.MACHINE_CONFIG_PIN || '');
    return /^\d{4}$/.test(pin) ? pin : null;
}

function machineConfigPinMatches(inputPin) {
    const configuredPin = getConfiguredMachineConfigPin();
    if (!configuredPin) return false;
    const input = String(inputPin || '');
    if (!/^\d{4}$/.test(input)) return false;
    return crypto.timingSafeEqual(Buffer.from(input), Buffer.from(configuredPin));
}

// ==========================================
// API 1: Health check
// ==========================================
app.get('/api/health', async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT 1 AS database_connected'
        );

        res.json({
            status: 'OK',
            application: 'OEE Backend',
            database:
                rows[0].database_connected === 1
                    ? 'Connected'
                    : 'Unknown'
        });
    } catch (error) {
        console.error(
            'Database connection error:',
            error.message
        );

        res.status(500).json({
            status: 'ERROR',
            message: 'Database connection failed.'
        });
    }
});

// ==========================================
// API 2: Machine list
// ==========================================
app.get('/api/machines', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                id,
                machine_code,
                machine_name,
                cell_id,
                plc_ip,
                plc_port,
                active
            FROM machines
            ORDER BY cell_id, machine_name
        `);

        res.json(rows);
    } catch (error) {
        console.error(
            'Machine query error:',
            error.message
        );

        res.status(500).json({
            message: 'Unable to load machines.'
        });
    }
});

// ==========================================
// Machine configuration APIs (PIN protected)
// ==========================================
app.post('/api/machines/verify-pin', (req, res) => {
    if (!getConfiguredMachineConfigPin()) {
        return res.status(503).json({ message: 'MACHINE_CONFIG_PIN is not configured as a 4-digit PIN in the backend .env file.' });
    }
    if (!machineConfigPinMatches(req.body?.pin)) {
        return res.status(401).json({ verified: false, message: 'Incorrect machine configuration PIN.' });
    }
    return res.json({ verified: true, message: 'Machine configuration PIN verified.' });
});

function validMachinePayload(body) {
    const machine_code = String(body.machine_code || '').trim().toUpperCase();
    const machine_name = String(body.machine_name || '').trim();
    const cell_id = String(body.cell_id || '').trim().toUpperCase();
    const plc_ip = String(body.plc_ip || '').trim();
    const plc_port = Number(body.plc_port || 7012);
    if (!/^[A-Z0-9_-]{2,30}$/.test(machine_code)) return { error: 'Machine code must contain 2–30 letters, numbers, _ or -.' };
    if (!machine_name || machine_name.length > 100) return { error: 'Enter a machine name (maximum 100 characters).' };
    if (!/^[A-J]$/.test(cell_id)) return { error: 'Cell must be A to J.' };
    if (plc_ip && !/^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/.test(plc_ip)) return { error: 'Enter a valid IPv4 PLC address.' };
    if (!Number.isInteger(plc_port) || plc_port < 1 || plc_port > 65535) return { error: 'PLC port must be between 1 and 65535.' };
    return { value: { machine_code, machine_name, cell_id, plc_ip: plc_ip || null, plc_port } };
}

app.post('/api/machines', async (req, res) => {
    if (!getConfiguredMachineConfigPin()) return res.status(503).json({ message: 'Configure MACHINE_CONFIG_PIN as a 4-digit PIN in the backend .env file.' });
    if (!machineConfigPinMatches(req.body.pin)) return res.status(403).json({ message: 'Invalid machine configuration PIN.' });
    const checked = validMachinePayload(req.body);
    if (checked.error) return res.status(400).json({ message: checked.error });
    try {
        const m = checked.value;
        const [result] = await pool.execute('INSERT INTO machines (machine_code, machine_name, cell_id, plc_ip, plc_port, active) VALUES (?, ?, ?, ?, ?, 1)', [m.machine_code, m.machine_name, m.cell_id, m.plc_ip, m.plc_port]);
        res.status(201).json({ message: 'Machine added successfully.', id: result.insertId });
    } catch (error) {
        console.error('Add machine error:', error.message);
        res.status(error.code === 'ER_DUP_ENTRY' ? 409 : 500).json({ message: error.code === 'ER_DUP_ENTRY' ? 'Machine code already exists.' : 'Unable to add machine.' });
    }
});

app.put('/api/machines/:id', async (req, res) => {
    if (!getConfiguredMachineConfigPin()) return res.status(503).json({ message: 'Configure MACHINE_CONFIG_PIN as a 4-digit PIN in the backend .env file.' });
    if (!machineConfigPinMatches(req.body.pin)) return res.status(403).json({ message: 'Invalid machine configuration PIN.' });
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ message: 'Invalid machine ID.' });
    const checked = validMachinePayload(req.body);
    if (checked.error) return res.status(400).json({ message: checked.error });
    try {
        const m = checked.value;
        const [result] = await pool.execute('UPDATE machines SET machine_code=?, machine_name=?, cell_id=?, plc_ip=?, plc_port=? WHERE id=?', [m.machine_code, m.machine_name, m.cell_id, m.plc_ip, m.plc_port, id]);
        if (!result.affectedRows) return res.status(404).json({ message: 'Machine not found.' });
        res.json({ message: 'Machine updated successfully.' });
    } catch (error) {
        console.error('Update machine error:', error.message);
        res.status(error.code === 'ER_DUP_ENTRY' ? 409 : 500).json({ message: error.code === 'ER_DUP_ENTRY' ? 'Machine code already exists.' : 'Unable to update machine.' });
    }
});

app.patch('/api/machines/:id/active', async (req, res) => {
    if (!getConfiguredMachineConfigPin()) return res.status(503).json({ message: 'Configure MACHINE_CONFIG_PIN as a 4-digit PIN in the backend .env file.' });
    if (!machineConfigPinMatches(req.body.pin)) return res.status(403).json({ message: 'Invalid machine configuration PIN.' });
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1 || typeof req.body.active !== 'boolean') return res.status(400).json({ message: 'Valid machine ID and active status are required.' });
    try {
        const [result] = await pool.execute('UPDATE machines SET active=? WHERE id=?', [req.body.active ? 1 : 0, id]);
        if (!result.affectedRows) return res.status(404).json({ message: 'Machine not found.' });
        res.json({ message: req.body.active ? 'Machine activated.' : 'Machine deactivated. Historical data is preserved.' });
    } catch (error) {
        console.error('Machine status error:', error.message);
        res.status(500).json({ message: 'Unable to change machine status.' });
    }
});

app.get('/api/machines/:id/tags', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ message: 'Invalid machine ID.' });
    try {
        const [rows] = await pool.execute('SELECT id, machine_id, tag_type, hour_no, register_address, data_type, active FROM plc_tags WHERE machine_id=? ORDER BY tag_type, hour_no', [id]);
        res.json(rows);
    } catch (error) {
        console.error('Machine tags query error:', error.message);
        res.status(500).json({ message: 'Unable to load PLC tags. Confirm the plc_tags table exists.' });
    }
});

app.post('/api/machines/:id/tags', async (req, res) => {
    if (!getConfiguredMachineConfigPin()) return res.status(503).json({ message: 'Configure MACHINE_CONFIG_PIN as a 4-digit PIN in the backend .env file.' });
    if (!machineConfigPinMatches(req.body.pin)) return res.status(403).json({ message: 'Invalid machine configuration PIN.' });
    const machineId = Number(req.params.id);
    const tag_type = String(req.body.tag_type || '');
    const hour_no = Number(req.body.hour_no);
    const register_address = String(req.body.register_address || '').trim().toUpperCase();
    const data_type = String(req.body.data_type || 'WORD').trim().toUpperCase();
    if (!Number.isInteger(machineId) || machineId < 1 || !['production', 'running_time'].includes(tag_type) || !Number.isInteger(hour_no) || hour_no < 1 || hour_no > 24 || !/^[D][0-9]{1,5}$/.test(register_address) || !['WORD', 'UWORD', 'INT', 'UINT', 'DWORD', 'UDWORD'].includes(data_type)) return res.status(400).json({ message: 'Invalid tag. Use production/running_time, hour 1–24, a D-register address and supported data type.' });
    try {
        const [result] = await pool.execute('INSERT INTO plc_tags (machine_id, tag_type, hour_no, register_address, data_type, active) VALUES (?, ?, ?, ?, ?, 1)', [machineId, tag_type, hour_no, register_address, data_type]);
        res.status(201).json({ message: 'PLC tag added.', id: result.insertId });
    } catch (error) {
        console.error('Add PLC tag error:', error.message);
        res.status(error.code === 'ER_DUP_ENTRY' ? 409 : 500).json({ message: error.code === 'ER_DUP_ENTRY' ? 'A tag already exists for this hour/type.' : 'Unable to add PLC tag. Check plc_tags schema and machine ID.' });
    }
});

app.put('/api/machines/:id/tags/:tagId', async (req, res) => {
    if (!getConfiguredMachineConfigPin()) return res.status(503).json({ message: 'Configure MACHINE_CONFIG_PIN as a 4-digit PIN in the backend .env file.' });
    if (!machineConfigPinMatches(req.body.pin)) return res.status(403).json({ message: 'Invalid machine configuration PIN.' });
    const machineId = Number(req.params.id), tagId = Number(req.params.tagId);
    const tag_type = String(req.body.tag_type || ''), hour_no = Number(req.body.hour_no);
    const register_address = String(req.body.register_address || '').trim().toUpperCase();
    const data_type = String(req.body.data_type || 'WORD').trim().toUpperCase();
    if (!Number.isInteger(machineId) || !Number.isInteger(tagId) || !['production', 'running_time'].includes(tag_type) || !Number.isInteger(hour_no) || hour_no < 1 || hour_no > 24 || !/^D[0-9]{1,5}$/.test(register_address) || !['WORD', 'UWORD', 'INT', 'UINT', 'DWORD', 'UDWORD'].includes(data_type)) return res.status(400).json({ message: 'Invalid PLC tag values.' });
    try {
        const [result] = await pool.execute('UPDATE plc_tags SET tag_type=?, hour_no=?, register_address=?, data_type=? WHERE id=? AND machine_id=?', [tag_type, hour_no, register_address, data_type, tagId, machineId]);
        if (!result.affectedRows) return res.status(404).json({ message: 'PLC tag not found.' });
        res.json({ message: 'PLC tag updated.' });
    } catch (error) {
        console.error('Update PLC tag error:', error.message);
        res.status(error.code === 'ER_DUP_ENTRY' ? 409 : 500).json({ message: error.code === 'ER_DUP_ENTRY' ? 'A tag already exists for this hour/type.' : 'Unable to update PLC tag.' });
    }
});

app.patch('/api/machines/:id/tags/:tagId/active', async (req, res) => {
    if (!getConfiguredMachineConfigPin()) return res.status(503).json({ message: 'Configure MACHINE_CONFIG_PIN as a 4-digit PIN in the backend .env file.' });
    if (!machineConfigPinMatches(req.body.pin)) return res.status(403).json({ message: 'Invalid machine configuration PIN.' });
    const machineId = Number(req.params.id), tagId = Number(req.params.tagId);
    if (!Number.isInteger(machineId) || !Number.isInteger(tagId) || typeof req.body.active !== 'boolean') return res.status(400).json({ message: 'Invalid tag ID or active status.' });
    try {
        const [result] = await pool.execute('UPDATE plc_tags SET active=? WHERE id=? AND machine_id=?', [req.body.active ? 1 : 0, tagId, machineId]);
        if (!result.affectedRows) return res.status(404).json({ message: 'PLC tag not found.' });
        res.json({ message: 'PLC tag status updated.' });
    } catch (error) {
        console.error('PLC tag status error:', error.message);
        res.status(500).json({ message: 'Unable to change PLC tag status.' });
    }
});

// ==========================================
// API 3: Hourly data for one machine
// ==========================================
app.get('/api/hourly-data', async (req, res) => {
    try {
        const productionDate = req.query.date;
        const machineCode = req.query.machine || 'AA1';

        if (!isValidDate(productionDate)) {
            return res.status(400).json({
                message:
                    'Date must be a valid YYYY-MM-DD date.'
            });
        }

        const [machines] = await pool.execute(
            `SELECT
                id,
                machine_code,
                machine_name,
                cell_id
             FROM machines
             WHERE machine_code = ?
               AND active = 1
             LIMIT 1`,
            [machineCode]
        );

        if (machines.length === 0) {
            return res.status(404).json({
                message: 'Machine not found or inactive.'
            });
        }

        const [hours] = await pool.execute(
            `SELECT
                production_date,
                machine_id,
                cell_id,
                hour_no,
                hour_start,
                hour_end,
                planned_quantity,
                total_quantity,
                good_quantity,
                reject_quantity,
                running_minutes,
                downtime_minutes,
                availability,
                performance,
                quality,
                oee,
                plc_read_time
             FROM machine_hourly_data
             WHERE production_date = ?
               AND machine_id = ?
             ORDER BY hour_no`,
            [productionDate, machines[0].id]
        );

        res.json({
            machine: machines[0],
            productionDate,
            productionDay: {
                start: '06:45',
                end: '06:45 next day'
            },
            recordCount: hours.length,
            hours
        });
    } catch (error) {
        console.error(
            'Hourly data query error:',
            error.message
        );

        res.status(500).json({
            message:
                'Unable to load hourly production data.'
        });
    }
});

// ==========================================
// API 4: Production trend
// ==========================================
app.get('/api/production-trend', async (req, res) => {
    try {
        const scope = req.query.scope || 'machine';
        const period = req.query.period || 'hourly';
        const machineCode = req.query.machine || 'AA1';
        const cellId = Number(req.query.cell || 1);

        if (!['machine', 'cell'].includes(scope)) {
            return res.status(400).json({
                message: 'Scope must be machine or cell.'
            });
        }

        if (
            !['hourly', 'daily', 'monthly'].includes(period)
        ) {
            return res.status(400).json({
                message:
                    'Period must be hourly, daily, or monthly.'
            });
        }

        let startDate;
        let endDate;

        // Resolve date range
        if (period === 'hourly') {
            const date = req.query.date;

            if (!isValidDate(date)) {
                return res.status(400).json({
                    message:
                        'Provide a valid date in YYYY-MM-DD format.'
                });
            }

            startDate = date;
            endDate = date;
        } else if (period === 'daily') {
            const month = req.query.month;

            if (!isValidMonth(month)) {
                return res.status(400).json({
                    message:
                        'Provide month in YYYY-MM format.'
                });
            }

            const [year, monthNumber] =
                month.split('-').map(Number);

            startDate = `${month}-01`;

            const nextYear =
                year + (monthNumber === 12 ? 1 : 0);

            const nextMonth =
                monthNumber === 12 ? 1 : monthNumber + 1;

            endDate =
                `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
        } else {
            const year = String(req.query.year || '');

            if (!/^\d{4}$/.test(year)) {
                return res.status(400).json({
                    message:
                        'Provide year in YYYY format.'
                });
            }

            startDate = `${year}-01-01`;
            endDate =
                `${Number(year) + 1}-01-01`;
        }

        // Resolve machine or cell
        let selectedMachine = null;
        let filterSql;
        let filterParams;

        if (scope === 'machine') {
            const [machines] = await pool.execute(
                `SELECT
                    id,
                    machine_code,
                    machine_name,
                    cell_id
                 FROM machines
                 WHERE machine_code = ?
                   AND active = 1
                 LIMIT 1`,
                [machineCode]
            );

            if (machines.length === 0) {
                return res.status(404).json({
                    message:
                        'Machine not found or inactive.'
                });
            }

            selectedMachine = machines[0];
            filterSql = 'machine_id = ?';
            filterParams = [selectedMachine.id];
        } else {
            if (
                !Number.isInteger(cellId) ||
                cellId < 1 ||
                cellId > 10
            ) {
                return res.status(400).json({
                    message:
                        'Cell must be between 1 and 10.'
                });
            }

            filterSql = 'cell_id = ?';
            filterParams = [cellId];
        }

        let rows;

        // Hourly data
        if (period === 'hourly') {
            const [hourRows] = await pool.execute(
                `SELECT
                    hour_no AS group_key,
                    TIME_FORMAT(
                        hour_start,
                        '%H:%i'
                    ) AS label,
                    SUM(
                        COALESCE(total_quantity, 0)
                    ) AS production,
                    SUM(
                        COALESCE(running_minutes, 0)
                    ) AS running_minutes,
                    SUM(
                        COALESCE(downtime_minutes, 0)
                    ) AS downtime_minutes,
                    COUNT(*) AS record_count
                 FROM machine_hourly_data
                 WHERE ${filterSql}
                   AND production_date = ?
                 GROUP BY hour_no, hour_start
                 ORDER BY hour_no`,
                [...filterParams, startDate]
            );

            rows = hourRows;
        }

        // Daily data
        else if (period === 'daily') {
            const [dailyRows] = await pool.execute(
                `SELECT
                    production_date AS group_key,
                    DATE_FORMAT(
                        production_date,
                        '%d %b'
                    ) AS label,
                    SUM(
                        COALESCE(total_quantity, 0)
                    ) AS production,
                    SUM(
                        COALESCE(running_minutes, 0)
                    ) AS running_minutes,
                    SUM(
                        COALESCE(downtime_minutes, 0)
                    ) AS downtime_minutes,
                    COUNT(*) AS record_count
                 FROM machine_hourly_data
                 WHERE ${filterSql}
                   AND production_date >= ?
                   AND production_date < ?
                 GROUP BY production_date
                 ORDER BY production_date`,
                [
                    ...filterParams,
                    startDate,
                    endDate
                ]
            );

            rows = dailyRows;
        }

        // Monthly data
        else {
            const [monthlyRows] = await pool.execute(
                `SELECT
                    DATE_FORMAT(
                        MIN(production_date),
                        '%Y-%m'
                    ) AS group_key,
                    DATE_FORMAT(
                        MIN(production_date),
                        '%b'
                    ) AS label,
                    SUM(
                        COALESCE(total_quantity, 0)
                    ) AS production,
                    SUM(
                        COALESCE(running_minutes, 0)
                    ) AS running_minutes,
                    SUM(
                        COALESCE(downtime_minutes, 0)
                    ) AS downtime_minutes,
                    COUNT(*) AS record_count
                 FROM machine_hourly_data
                 WHERE ${filterSql}
                   AND production_date >= ?
                   AND production_date < ?
                 GROUP BY
                    YEAR(production_date),
                    MONTH(production_date)
                 ORDER BY
                    YEAR(production_date),
                    MONTH(production_date)`,
                [
                    ...filterParams,
                    startDate,
                    endDate
                ]
            );

            rows = monthlyRows;
        }

        res.json({
            scope,
            period,
            machine: selectedMachine,
            cellId: scope === 'cell' ? cellId : null,
            startDate,
            endDate,
            recordCount: rows.length,
            data: rows
        });
    } catch (error) {
        console.error(
            'Production trend API error:',
            error
        );

        res.status(500).json({
            message:
                'Unable to load production trend.'
        });
    }
});

// ==========================================
// API 5: Verify Production Plan PIN
// ==========================================
app.post(
    '/api/production-plan/verify-pin',
    (req, res) => {
        const configuredPin = getConfiguredPin();

        if (!configuredPin) {
            return res.status(503).json({
                message:
                    'PLAN_EDIT_PIN is not configured.'
            });
        }

        if (!pinMatches(req.body?.pin)) {
            return res.status(401).json({
                verified: false,
                message: 'Incorrect 4-digit PIN.'
            });
        }

        res.json({
            verified: true,
            message: 'PIN verified successfully.'
        });
    }
);

// ==========================================
// API 6: Get Production Plans
// ==========================================
app.get('/api/production-plans', async (req, res) => {
    try {
        const planDate = req.query.date;

        if (planDate && !isValidDate(planDate)) {
            return res.status(400).json({
                message:
                    'Date must use YYYY-MM-DD format.'
            });
        }

        let sql = `
            SELECT
                id,
                plan_date,
                shop_name,
                machine_name,
                planned_quantity,
                created_at,
                updated_at
            FROM production_plan
        `;

        const params = [];

        if (planDate) {
            sql += ' WHERE plan_date = ?';
            params.push(planDate);
        }

        sql += `
            ORDER BY
                plan_date DESC,
                shop_name,
                machine_name
            LIMIT 500
        `;

        const [rows] = await pool.execute(
            sql,
            params
        );

        res.json({
            recordCount: rows.length,
            data: rows
        });
    } catch (error) {
        console.error(
            'Production plan list error:',
            error.message
        );

        res.status(500).json({
            message:
                'Unable to load production plans.'
        });
    }
});

// ==========================================
// API 7: Save or Update Production Plan
// ==========================================
app.post('/api/production-plans', async (req, res) => {
    try {
        if (!getConfiguredPin()) {
            return res.status(503).json({
                message:
                    'PLAN_EDIT_PIN is not configured.'
            });
        }

        if (!pinMatches(req.body?.pin)) {
            return res.status(401).json({
                message:
                    'Incorrect 4-digit PIN. Plan not saved.'
            });
        }

        const {
            plan_date,
            shop_name,
            machine_name
        } = req.body || {};

        const plannedQuantity =
            Number(req.body?.planned_quantity);

        if (!isValidDate(plan_date)) {
            return res.status(400).json({
                message:
                    'Choose a valid production date.'
            });
        }

        if (
            typeof shop_name !== 'string' ||
            !shop_name.trim() ||
            shop_name.trim().length > 100
        ) {
            return res.status(400).json({
                message:
                    'Enter a valid shop name.'
            });
        }

        if (
            typeof machine_name !== 'string' ||
            !machine_name.trim() ||
            machine_name.trim().length > 100
        ) {
            return res.status(400).json({
                message:
                    'Enter a valid machine name.'
            });
        }

        if (
            !Number.isSafeInteger(plannedQuantity) ||
            plannedQuantity < 0 ||
            plannedQuantity > 2147483647
        ) {
            return res.status(400).json({
                message:
                    'Planned quantity must be a valid non-negative whole number.'
            });
        }

        const shopName = shop_name.trim();
        const machineName = machine_name.trim();

        await pool.execute(
            `INSERT INTO production_plan
                (
                    plan_date,
                    shop_name,
                    machine_name,
                    planned_quantity
                )
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                planned_quantity =
                    VALUES(planned_quantity),
                updated_at =
                    CURRENT_TIMESTAMP`,
            [
                plan_date,
                shopName,
                machineName,
                plannedQuantity
            ]
        );

        const [rows] = await pool.execute(
            `SELECT
                id,
                plan_date,
                shop_name,
                machine_name,
                planned_quantity,
                created_at,
                updated_at
             FROM production_plan
             WHERE plan_date = ?
               AND shop_name = ?
               AND machine_name = ?
             LIMIT 1`,
            [
                plan_date,
                shopName,
                machineName
            ]
        );

        res.json({
            message: 'Plan saved successfully.',
            data: rows[0]
        });
    } catch (error) {
        console.error(
            'Production plan save error:',
            error.message
        );

        res.status(500).json({
            message:
                'Unable to save production plan.'
        });
    }
});

// ==========================================
// API 8: Plan vs Actual
// ==========================================
app.get('/api/plan-vs-actual', async (req, res) => {
    try {
        const date = req.query.date;
        const machineCode = req.query.machine || 'AA1';

        if (!isValidDate(date)) {
            return res.status(400).json({
                message:
                    'Provide a valid production date.'
            });
        }

        const [machines] = await pool.execute(
            `SELECT
                id,
                machine_code,
                machine_name,
                cell_id
             FROM machines
             WHERE machine_code = ?
               AND active = 1
             LIMIT 1`,
            [machineCode]
        );

        if (machines.length === 0) {
            return res.status(404).json({
                message:
                    'Machine not found or inactive.'
            });
        }

        const machine = machines[0];

        // Read one daily plan for the machine.
        // Do not join plan rows directly to hourly
        // rows, which could multiply the plan.
        const [plans] = await pool.execute(
            `SELECT
                SUM(planned_quantity) AS planned_quantity
             FROM production_plan
             WHERE plan_date = ?
               AND machine_name = ?`,
            [date, machineCode]
        );

        // Sum the actual hourly production once.
        const [actualRows] = await pool.execute(
            `SELECT
                SUM(
                    COALESCE(total_quantity, 0)
                ) AS actual_quantity,
                COUNT(*) AS hourly_records
             FROM machine_hourly_data
             WHERE production_date = ?
               AND machine_id = ?`,
            [date, machine.id]
        );

        const planValue =
            plans[0]?.planned_quantity;

        const plannedQuantity =
            planValue === null
                ? null
                : Number(planValue);

        const actualQuantity =
            Number(
                actualRows[0]?.actual_quantity || 0
            );

        const hourlyRecords =
            Number(
                actualRows[0]?.hourly_records || 0
            );

        const achievement =
            plannedQuantity !== null &&
            plannedQuantity > 0 &&
            hourlyRecords > 0
                ? Number(
                    (
                        actualQuantity /
                        plannedQuantity *
                        100
                    ).toFixed(2)
                )
                : null;

        res.json({
            date,
            machine,
            planned_quantity: plannedQuantity,
            actual_quantity:
                hourlyRecords > 0
                    ? actualQuantity
                    : null,
            achievement_percentage: achievement,
            hourly_records: hourlyRecords,
            has_plan: plannedQuantity !== null,
            has_actual_data: hourlyRecords > 0
        });
    } catch (error) {
        console.error(
            'Plan vs Actual error:',
            error.message
        );

        res.status(500).json({
            message:
                'Unable to load Plan vs Actual data.'
        });
    }
});

// ==========================================
// API 9: List utility meters (LT Panels)
// ==========================================
app.get('/api/utility-meters', async (req, res) => {
    try {
        const [rows] = await pool.execute(`
            SELECT id, meter_code, meter_name, utility_type,
                   location, machine_code, meter_serial_no, unit,
                   meter_type, is_active
            FROM utility_meters
            WHERE is_active = 1
            ORDER BY meter_name
        `);
        res.json({ recordCount: rows.length, data: rows });
    } catch (error) {
        console.error('Utility meter list error:', error.message);
        res.status(500).json({ message: 'Unable to load utility meters.' });
    }
});

// ==========================================
// API 10: Get utility reading history
// Optional query: ?meter_code=LT-PANEL-01
// ==========================================
app.get('/api/utility-readings', async (req, res) => {
    try {
        const meterCode = req.query.meter_code;
        const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
        let sql = `
            SELECT r.id, m.meter_code, m.meter_name, m.unit,
                   r.reading_time, r.reading_value, r.consumption_value,
                   r.source, r.remarks, r.entered_by, r.created_at
            FROM utility_readings r
            INNER JOIN utility_meters m ON m.id = r.meter_id
        `;
        const params = [];
        if (meterCode) {
            if (typeof meterCode !== 'string' || !/^LT-PANEL-(0[1-9]|1[0-9]|2[0-5])$/.test(meterCode)) {
                return res.status(400).json({ message: 'Invalid LT Panel code.' });
            }
            sql += ' WHERE m.meter_code = ?';
            params.push(meterCode);
        }
        sql += ' ORDER BY r.reading_time DESC, r.id DESC LIMIT ?';
        params.push(limit);
        const [rows] = await pool.execute(sql, params);
        res.json({ recordCount: rows.length, data: rows });
    } catch (error) {
        console.error('Utility reading history error:', error.message);
        res.status(500).json({ message: 'Unable to load utility reading history.' });
    }
});

// ==========================================
// API 11: Save manual utility reading
// Body: { meter_code, reading_time, reading_value, remarks?, entered_by? }
// ==========================================
app.post('/api/utility-readings', async (req, res) => {
    let connection;
    try {
        const { meter_code, reading_time, reading_value, remarks, entered_by } = req.body || {};
        if (typeof meter_code !== 'string' || !/^LT-PANEL-(0[1-9]|1[0-9]|2[0-5])$/.test(meter_code)) {
            return res.status(400).json({ message: 'Select a valid LT Panel.' });
        }
        // Require local date/time in YYYY-MM-DD HH:mm[:ss] format.
        if (typeof reading_time !== 'string' || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(?::\d{2})?$/.test(reading_time)) {
            return res.status(400).json({ message: 'Reading time must be YYYY-MM-DD HH:mm or YYYY-MM-DD HH:mm:ss.' });
        }
        const readingDate = reading_time.slice(0, 10);
        const readingClock = reading_time.slice(11, 16);
        if (!isValidDate(readingDate) || Number(readingClock.slice(0, 2)) > 23 || Number(readingClock.slice(3, 5)) > 59) {
            return res.status(400).json({ message: 'Enter a valid reading date and time.' });
        }
        const value = Number(reading_value);
        if (reading_value === '' || reading_value === null || reading_value === undefined || !Number.isFinite(value) || value < 0 || value > 999999999999.999) {
            return res.status(400).json({ message: 'Reading value must be a valid non-negative number.' });
        }
        if (remarks != null && (typeof remarks !== 'string' || remarks.length > 500)) {
            return res.status(400).json({ message: 'Remarks must be 500 characters or fewer.' });
        }
        if (entered_by != null && (typeof entered_by !== 'string' || entered_by.length > 100)) {
            return res.status(400).json({ message: 'Entered by must be 100 characters or fewer.' });
        }

        connection = await pool.getConnection();
        await connection.beginTransaction();
        const [meters] = await connection.execute(
            'SELECT id, meter_code, meter_name, unit FROM utility_meters WHERE meter_code = ? AND is_active = 1 LIMIT 1',
            [meter_code]
        );
        if (meters.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'LT Panel meter not found or inactive.' });
        }
        const meter = meters[0];
        const [previousRows] = await connection.execute(
            `SELECT id, reading_time, reading_value
             FROM utility_readings
             WHERE meter_id = ? AND reading_time <= ?
             ORDER BY reading_time DESC, id DESC LIMIT 1 FOR UPDATE`,
            [meter.id, reading_time]
        );
        const previous = previousRows[0] || null;
        let consumption = null;
        let warning = null;
        if (previous) {
            const difference = value - Number(previous.reading_value);
            if (difference >= 0) consumption = Number(difference.toFixed(3));
            else warning = 'This reading is lower than the previous reading. It was saved for history, but consumption was left blank. Verify the meter value or meter reset.';
        }
        const [result] = await connection.execute(
            `INSERT INTO utility_readings
                (meter_id, reading_time, reading_value, consumption_value, source, remarks, entered_by)
             VALUES (?, ?, ?, ?, 'Manual', ?, ?)`,
            [meter.id, reading_time.length === 16 ? `${reading_time}:00` : reading_time,
             value, consumption, remarks ? remarks.trim() : null,
             entered_by ? entered_by.trim() : null]
        );
        await connection.commit();
        res.status(201).json({
            message: 'Utility reading saved successfully.',
            data: {
                id: result.insertId,
                meter_code: meter.meter_code,
                meter_name: meter.meter_name,
                reading_time: reading_time.length === 16 ? `${reading_time}:00` : reading_time,
                reading_value: value,
                consumption_value: consumption,
                unit: meter.unit,
                warning
            }
        });
    } catch (error) {
        if (connection) await connection.rollback().catch(() => {});
        console.error('Utility reading save error:', error.message);
        res.status(500).json({ message: 'Unable to save utility reading.' });
    } finally {
        if (connection) connection.release();
    }
});


// ==========================================
// API 12: List calibration plans
// ==========================================
app.get('/api/calibration-plans', async (req, res) => {
    try {
        const status = req.query.status;
        const allowedStatuses = ['Planned', 'Due Soon', 'Overdue', 'Completed', 'All'];
        if (status && !allowedStatuses.includes(status)) {
            return res.status(400).json({ message: 'Invalid calibration status.' });
        }

        let sql = `
            SELECT id, instrument_name, instrument_code, instrument_type,
                   department, location, serial_no,
                   calibration_interval_days,
                   calibration_frequency_months,
                   last_calibration_date,
                   next_calibration_date AS due_date,
                   responsible_person AS assigned_to,
                   responsible_email, calibration_agency, status,
                   remarks, created_at, updated_at
            FROM calibration_plans
        `;
        const params = [];
        if (status && status !== 'All') {
            sql += ' WHERE status = ?';
            params.push(status);
        }
        sql += ' ORDER BY next_calibration_date ASC, instrument_name ASC LIMIT 1000';

        const [rows] = await pool.execute(sql, params);
        const today = new Date().toISOString().slice(0, 10);
        const data = rows.map(row => {
            const dueDate = row.due_date;
            const daysRemaining = dueDate
                ? Math.floor((new Date(`${dueDate}T00:00:00Z`) -
                               new Date(`${today}T00:00:00Z`)) / 86400000)
                : null;
            let computedStatus = row.status;
            if (row.status !== 'Completed' && daysRemaining !== null) {
                if (daysRemaining < 0) computedStatus = 'Overdue';
                else if (daysRemaining <= 30) computedStatus = 'Due Soon';
                else computedStatus = 'Planned';
            }
            return { ...row, days_remaining: daysRemaining, display_status: computedStatus };
        });
        res.json({ recordCount: data.length, data });
    } catch (error) {
        console.error('Calibration plan list error:', error.message);
        res.status(500).json({ message: 'Unable to load calibration plans.' });
    }
});

// ==========================================
// API 13: Add calibration plan (PIN protected)
// ==========================================
app.post('/api/calibration-plans', async (req, res) => {
    try {
        if (!getConfiguredPin()) {
            return res.status(503).json({ message: 'PLAN_EDIT_PIN is not configured as a 4-digit PIN.' });
        }
        if (!pinMatches(req.body?.pin)) {
            return res.status(401).json({ message: 'Incorrect 4-digit PIN. Calibration plan not saved.' });
        }

        const body = req.body || {};
        const instrumentName = typeof body.instrument_name === 'string' ? body.instrument_name.trim() : '';
        const instrumentCode = typeof body.instrument_code === 'string' ? body.instrument_code.trim() : '';
        const instrumentType = typeof body.instrument_type === 'string' ? body.instrument_type.trim() : null;
        const department = typeof body.department === 'string' ? body.department.trim() : null;
        const location = typeof body.location === 'string' ? body.location.trim() : null;
        const serialNo = typeof body.serial_no === 'string' ? body.serial_no.trim() : null;
        const assignedTo = typeof body.assigned_to === 'string' ? body.assigned_to.trim() :
                           (typeof body.responsible_person === 'string' ? body.responsible_person.trim() : null);
        const responsibleEmail = typeof body.responsible_email === 'string' ? body.responsible_email.trim() : null;
        const agency = typeof body.calibration_agency === 'string' ? body.calibration_agency.trim() : null;
        const remarks = typeof body.remarks === 'string' ? body.remarks.trim() : null;
        const frequency = Number(body.calibration_frequency_months || 12);
        const intervalDays = Number(body.calibration_interval_days || frequency * 30);
        const lastDate = body.last_calibration_date || null;
        const dueDate = body.due_date || body.next_calibration_date;
        const status = body.status || 'Planned';

        if (!instrumentName || instrumentName.length > 150) {
            return res.status(400).json({ message: 'Instrument name is required (maximum 150 characters).' });
        }
        if (!instrumentCode || instrumentCode.length > 50) {
            return res.status(400).json({ message: 'Instrument code is required (maximum 50 characters).' });
        }
        if (!isValidDate(dueDate)) {
            return res.status(400).json({ message: 'Enter a valid next calibration date (YYYY-MM-DD).' });
        }
        if (lastDate !== null && !isValidDate(lastDate)) {
            return res.status(400).json({ message: 'Last calibration date must be YYYY-MM-DD.' });
        }
        if (!Number.isInteger(frequency) || frequency < 1 || frequency > 120 ||
            !Number.isInteger(intervalDays) || intervalDays < 1 || intervalDays > 36500) {
            return res.status(400).json({ message: 'Calibration frequency/interval is invalid.' });
        }
        if (!['Planned', 'Due Soon', 'Overdue', 'Completed'].includes(status)) {
            return res.status(400).json({ message: 'Invalid calibration status.' });
        }
        for (const [field, value, max] of [
            ['instrument_type', instrumentType, 100], ['department', department, 100],
            ['location', location, 150], ['serial_no', serialNo, 100],
            ['assigned_to', assignedTo, 100], ['responsible_email', responsibleEmail, 255],
            ['calibration_agency', agency, 150], ['remarks', remarks, 500]
        ]) {
            if (value !== null && value.length > max) {
                return res.status(400).json({ message: `${field} must be ${max} characters or fewer.` });
            }
        }

        const [result] = await pool.execute(
            `INSERT INTO calibration_plans
                (instrument_code, instrument_name, instrument_type, department,
                 location, serial_no, calibration_agency, calibration_interval_days,
                 calibration_frequency_months, last_calibration_date,
                 next_calibration_date, responsible_person, responsible_email,
                 status, remarks)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [instrumentCode, instrumentName, instrumentType || null, department || null,
             location || null, serialNo || null, agency || null, intervalDays, frequency,
             lastDate, dueDate, assignedTo || null, responsibleEmail || null,
             status, remarks || null]
        );

        const [rows] = await pool.execute(
            `SELECT id, instrument_name, instrument_code, instrument_type, department,
                    location, serial_no, calibration_interval_days,
                    calibration_frequency_months, last_calibration_date,
                    next_calibration_date AS due_date,
                    responsible_person AS assigned_to, responsible_email,
                    calibration_agency, status, remarks, created_at, updated_at
             FROM calibration_plans WHERE id = ?`,
            [result.insertId]
        );
        res.status(201).json({ message: 'Calibration plan saved successfully.', data: rows[0] });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Instrument code already exists.' });
        }
        console.error('Calibration plan save error:', error.message);
        res.status(500).json({ message: 'Unable to save calibration plan.' });
    }
});

// ==========================================
// API 14: Update calibration plan (PIN protected)
// ==========================================
app.put('/api/calibration-plans/:id', async (req, res) => {
    try {
        if (!getConfiguredPin()) {
            return res.status(503).json({ message: 'PLAN_EDIT_PIN is not configured as a 4-digit PIN.' });
        }
        if (!pinMatches(req.body?.pin)) {
            return res.status(401).json({ message: 'Incorrect 4-digit PIN. Calibration plan not updated.' });
        }

        const id = Number(req.params.id);
        if (!Number.isSafeInteger(id) || id < 1) {
            return res.status(400).json({ message: 'Invalid calibration plan ID.' });
        }
        const body = req.body || {};
        const instrumentName = typeof body.instrument_name === 'string' ? body.instrument_name.trim() : '';
        const instrumentCode = typeof body.instrument_code === 'string' ? body.instrument_code.trim() : '';
        const instrumentType = typeof body.instrument_type === 'string' ? body.instrument_type.trim() : null;
        const department = typeof body.department === 'string' ? body.department.trim() : null;
        const location = typeof body.location === 'string' ? body.location.trim() : null;
        const serialNo = typeof body.serial_no === 'string' ? body.serial_no.trim() : null;
        const assignedTo = typeof body.assigned_to === 'string' ? body.assigned_to.trim() :
                           (typeof body.responsible_person === 'string' ? body.responsible_person.trim() : null);
        const responsibleEmail = typeof body.responsible_email === 'string' ? body.responsible_email.trim() : null;
        const agency = typeof body.calibration_agency === 'string' ? body.calibration_agency.trim() : null;
        const remarks = typeof body.remarks === 'string' ? body.remarks.trim() : null;
        const frequency = Number(body.calibration_frequency_months || 12);
        const intervalDays = Number(body.calibration_interval_days || frequency * 30);
        const lastDate = body.last_calibration_date || null;
        const dueDate = body.due_date || body.next_calibration_date;
        const status = body.status || 'Planned';

        if (!instrumentName || instrumentName.length > 150 ||
            !instrumentCode || instrumentCode.length > 50 ||
            !isValidDate(dueDate) ||
            (lastDate !== null && !isValidDate(lastDate)) ||
            !Number.isInteger(frequency) || frequency < 1 || frequency > 120 ||
            !Number.isInteger(intervalDays) || intervalDays < 1 || intervalDays > 36500 ||
            !['Planned', 'Due Soon', 'Overdue', 'Completed'].includes(status)) {
            return res.status(400).json({ message: 'Check the instrument name/code, dates, frequency, interval, and status.' });
        }

        const [result] = await pool.execute(
            `UPDATE calibration_plans
             SET instrument_name = ?, instrument_code = ?, instrument_type = ?,
                 department = ?, location = ?, serial_no = ?, calibration_agency = ?,
                 calibration_interval_days = ?, calibration_frequency_months = ?,
                 last_calibration_date = ?, next_calibration_date = ?,
                 responsible_person = ?, responsible_email = ?, status = ?, remarks = ?
             WHERE id = ?`,
            [instrumentName, instrumentCode, instrumentType || null, department || null,
             location || null, serialNo || null, agency || null, intervalDays, frequency,
             lastDate, dueDate, assignedTo || null, responsibleEmail || null,
             status, remarks || null, id]
        );
        if (!result.affectedRows) {
            const [exists] = await pool.execute('SELECT id FROM calibration_plans WHERE id = ?', [id]);
            if (!exists.length) return res.status(404).json({ message: 'Calibration plan not found.' });
        }
        res.json({ message: 'Calibration plan updated successfully.' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Instrument code already exists.' });
        }
        console.error('Calibration plan update error:', error.message);
        res.status(500).json({ message: 'Unable to update calibration plan.' });
    }
});

// ==========================================
// API 15: Delete calibration plan (PIN protected)
// ==========================================
app.delete('/api/calibration-plans/:id', async (req, res) => {
    try {
        if (!getConfiguredPin()) {
            return res.status(503).json({ message: 'PLAN_EDIT_PIN is not configured as a 4-digit PIN.' });
        }
        if (!pinMatches(req.body?.pin)) {
            return res.status(401).json({ message: 'Incorrect 4-digit PIN. Calibration plan not deleted.' });
        }
        const id = Number(req.params.id);
        if (!Number.isSafeInteger(id) || id < 1) {
            return res.status(400).json({ message: 'Invalid calibration plan ID.' });
        }
        const [result] = await pool.execute('DELETE FROM calibration_plans WHERE id = ?', [id]);
        if (!result.affectedRows) return res.status(404).json({ message: 'Calibration plan not found.' });
        res.json({ message: 'Calibration plan deleted successfully.' });
    } catch (error) {
        if (error.code === 'ER_ROW_IS_REFERENCED_2') {
            return res.status(409).json({ message: 'This plan has calibration history and cannot be deleted. Keep it for audit history.' });
        }
        console.error('Calibration plan delete error:', error.message);
        res.status(500).json({ message: 'Unable to delete calibration plan.' });
    }
});

// ==========================================
// API 16: Calibration history for a plan
// ==========================================
app.get('/api/calibration-plans/:id/history', async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isSafeInteger(id) || id < 1) {
            return res.status(400).json({ message: 'Invalid calibration plan ID.' });
        }
        const [rows] = await pool.execute(
            `SELECT id, calibration_plan_id, calibration_date, result,
                    certificate_number, next_due_date, remarks, recorded_by, created_at
             FROM calibration_history
             WHERE calibration_plan_id = ?
             ORDER BY calibration_date DESC, id DESC`,
            [id]
        );
        res.json({ recordCount: rows.length, data: rows });
    } catch (error) {
        console.error('Calibration history query error:', error.message);
        res.status(500).json({ message: 'Unable to load calibration history.' });
    }
});

// ==========================================
// API 17: Record completed calibration (PIN protected)
// ==========================================
app.post('/api/calibration-plans/:id/history', async (req, res) => {
    let connection;
    try {
        if (!getConfiguredPin()) {
            return res.status(503).json({ message: 'PLAN_EDIT_PIN is not configured as a 4-digit PIN.' });
        }
        if (!pinMatches(req.body?.pin)) {
            return res.status(401).json({ message: 'Incorrect 4-digit PIN. Calibration history not saved.' });
        }
        const planId = Number(req.params.id);
        if (!Number.isSafeInteger(planId) || planId < 1) {
            return res.status(400).json({ message: 'Invalid calibration plan ID.' });
        }
        const body = req.body || {};
        const calibrationDate = body.calibration_date;
        const resultValue = body.result;
        const nextDueDate = body.next_due_date || null;
        const certificate = typeof body.certificate_number === 'string' ? body.certificate_number.trim() : null;
        const remarks = typeof body.remarks === 'string' ? body.remarks.trim() : null;
        const recordedBy = typeof body.recorded_by === 'string' ? body.recorded_by.trim() : null;

        if (!isValidDate(calibrationDate) ||
            (nextDueDate !== null && !isValidDate(nextDueDate)) ||
            !['Pass', 'Fail', 'Conditional'].includes(resultValue)) {
            return res.status(400).json({ message: 'Provide a valid calibration date, optional next due date, and result Pass, Fail, or Conditional.' });
        }
        if ((certificate && certificate.length > 100) ||
            (remarks && remarks.length > 5000) ||
            (recordedBy && recordedBy.length > 100)) {
            return res.status(400).json({ message: 'Certificate, remarks, or recorded-by value is too long.' });
        }

        connection = await pool.getConnection();
        await connection.beginTransaction();
        const [plans] = await connection.execute(
            'SELECT id FROM calibration_plans WHERE id = ? FOR UPDATE', [planId]
        );
        if (!plans.length) {
            await connection.rollback();
            return res.status(404).json({ message: 'Calibration plan not found.' });
        }

        await connection.execute(
            `INSERT INTO calibration_history
                (calibration_plan_id, calibration_date, result,
                 certificate_number, next_due_date, remarks, recorded_by)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [planId, calibrationDate, resultValue, certificate || null,
             nextDueDate, remarks || null, recordedBy || null]
        );
        await connection.execute(
            `UPDATE calibration_plans
             SET last_calibration_date = ?,
                 next_calibration_date = COALESCE(?, DATE_ADD(?, INTERVAL calibration_interval_days DAY)),
                 due_date = COALESCE(?, DATE_ADD(?, INTERVAL calibration_frequency_months MONTH)),
                 status = ?
             WHERE id = ?`,
            [calibrationDate, nextDueDate, calibrationDate, nextDueDate, calibrationDate,
             resultValue === 'Pass' ? 'Planned' : 'Due Soon', planId]
        );
        await connection.commit();
        res.status(201).json({ message: 'Calibration history saved successfully.' });
    } catch (error) {
        if (connection) await connection.rollback().catch(() => {});
        console.error('Calibration history save error:', error.message);
        res.status(500).json({ message: 'Unable to save calibration history.' });
    } finally {
        if (connection) connection.release();
    }
});

// API 18: Test route
// ==========================================
app.get('/api/test-route', (req, res) => {
    res.json({
        status: 'OK',
        message: 'This server.js file is running'
    });
});

// ==========================================
// Start backend server
// ==========================================
const port = Number(process.env.PORT || 3001);

app.listen(port, '0.0.0.0', () => {
    console.log(
        `OEE backend running at http://127.0.0.1:${port}`
    );
});
