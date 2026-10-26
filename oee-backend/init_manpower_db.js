const mysql = require('mysql2/promise');

async function init() {
  const pool = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: '12345',
    database: 'oee_monitoring'
  });

  console.log('Connected to oee_monitoring');

  // 1. Create or alter shop_manpower table with all required columns
  await pool.query(`
    CREATE TABLE IF NOT EXISTS shop_manpower (
      id INT NOT NULL AUTO_INCREMENT,
      plan_date DATE NOT NULL,
      shop_name VARCHAR(100) NOT NULL,
      cell_code VARCHAR(20) DEFAULT NULL,
      cell_manager VARCHAR(100) DEFAULT NULL,
      required_count INT NOT NULL DEFAULT 0,
      allocated_count INT NOT NULL DEFAULT 0,
      present_count INT NOT NULL DEFAULT 0,
      swap_in INT NOT NULL DEFAULT 0,
      swap_out INT NOT NULL DEFAULT 0,
      manpower_count INT NOT NULL DEFAULT 0,
      created_time TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
      modified_time TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY unique_daily_shop (plan_date, shop_name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Add columns if table already existed without them
  const alterColumns = [
    { name: 'cell_code', def: 'VARCHAR(20) DEFAULT NULL AFTER shop_name' },
    { name: 'cell_manager', def: 'VARCHAR(100) DEFAULT NULL AFTER cell_code' },
    { name: 'required_count', def: 'INT NOT NULL DEFAULT 0 AFTER cell_manager' },
    { name: 'allocated_count', def: 'INT NOT NULL DEFAULT 0 AFTER required_count' },
    { name: 'present_count', def: 'INT NOT NULL DEFAULT 0 AFTER allocated_count' },
    { name: 'swap_in', def: 'INT NOT NULL DEFAULT 0 AFTER present_count' },
    { name: 'swap_out', def: 'INT NOT NULL DEFAULT 0 AFTER swap_in' }
  ];

  for (const col of alterColumns) {
    try {
      await pool.query(`ALTER TABLE shop_manpower ADD COLUMN ${col.name} ${col.def}`);
      console.log(`Added column ${col.name} to shop_manpower`);
    } catch (err) {
      if (!err.message.includes('Duplicate column name')) {
        console.log(`Column check (${col.name}):`, err.message);
      }
    }
  }

  console.log('shop_manpower schema updated successfully');

  // Seed / update today's department allocations directly into MySQL
  const today = new Date().toISOString().slice(0, 10);
  const departments = [
    { name: 'Press Shop', code: 'CELL-A', manager: 'Rajesh S.', req: 36, alloc: 36, pres: 32, sin: 3, sout: 0 },
    { name: 'Screw Forging', code: 'CELL-B', manager: 'K. Sharma', req: 42, alloc: 42, pres: 40, sin: 0, sout: 2 },
    { name: 'Grooving', code: 'CELL-C', manager: 'V. Nair', req: 30, alloc: 30, pres: 26, sin: 1, sout: 2 },
    { name: 'Deburring', code: 'CELL-D', manager: 'Sunita M.', req: 28, alloc: 28, pres: 27, sin: 1, sout: 0 },
    { name: 'Laser Marking', code: 'CELL-E', manager: 'D. Patil', req: 24, alloc: 24, pres: 24, sin: 0, sout: 0 },
    { name: 'Assembly Line 1', code: 'CELL-F', manager: 'R. Verma', req: 55, alloc: 55, pres: 48, sin: 4, sout: 2 },
    { name: 'Quality Assurance', code: 'SUPPORT', manager: 'Priya S.', req: 22, alloc: 22, pres: 22, sin: 1, sout: 0 },
    { name: 'Maintenance', code: 'UTILITY', manager: 'K. Joshi', req: 18, alloc: 18, pres: 16, sin: 0, sout: 1 },
    { name: 'Packaging', code: 'CELL-G', manager: 'M. Khan', req: 35, alloc: 35, pres: 31, sin: 1, sout: 0 }
  ];

  for (const d of departments) {
    await pool.query(`
      INSERT INTO shop_manpower 
        (plan_date, shop_name, cell_code, cell_manager, required_count, allocated_count, present_count, swap_in, swap_out, manpower_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        cell_code = VALUES(cell_code),
        cell_manager = VALUES(cell_manager),
        required_count = VALUES(required_count),
        allocated_count = VALUES(allocated_count),
        present_count = VALUES(present_count),
        swap_in = VALUES(swap_in),
        swap_out = VALUES(swap_out),
        manpower_count = VALUES(required_count)
    `, [today, d.name, d.code, d.manager, d.req, d.alloc, d.pres, d.sin, d.sout, d.req]);
  }
  console.log(`Seeded/Updated ${departments.length} department allocations for ${today} in shop_manpower`);

  // 2. Create manpower_swaps table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS manpower_swaps (
      id INT NOT NULL AUTO_INCREMENT,
      req_id VARCHAR(30) NOT NULL,
      operator_name VARCHAR(100) NOT NULL,
      operator_id VARCHAR(50) DEFAULT NULL,
      operator_role VARCHAR(100) DEFAULT 'Operator Gr. II',
      from_cell VARCHAR(100) NOT NULL,
      to_cell VARCHAR(100) NOT NULL,
      shift VARCHAR(20) NOT NULL DEFAULT 'Shift A',
      request_date DATE NOT NULL,
      swap_type VARCHAR(50) DEFAULT 'Shift Swap',
      reason VARCHAR(255) DEFAULT NULL,
      status ENUM('Pending', 'Approved', 'Rejected') NOT NULL DEFAULT 'Pending',
      releasing_manager VARCHAR(100) DEFAULT NULL,
      releasing_approval ENUM('Pending', 'Approved', 'Rejected') DEFAULT 'Approved',
      receiving_manager VARCHAR(100) DEFAULT NULL,
      receiving_approval ENUM('Pending', 'Approved', 'Rejected') DEFAULT 'Approved',
      admin_approval ENUM('Pending', 'Approved', 'Rejected') DEFAULT 'Pending',
      created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_req_id (req_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  console.log('manpower_swaps table ensured');

  await pool.end();
  console.log('Database setup complete');
}

init().catch(console.error);
