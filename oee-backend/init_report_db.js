const mysql = require('mysql2/promise');
require('dotenv').config();

async function initTables() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '12345',
    database: process.env.DB_NAME || 'oee_monitoring'
  });

  console.log('Connected to MySQL. Ensuring tables...');

  // 1. Check if production_plan has plan_name and status columns, add if missing
  const [planCols] = await conn.execute('DESCRIBE production_plan');
  const existingPlanFields = planCols.map(c => c.Field);
  
  if (!existingPlanFields.includes('plan_name')) {
    console.log('Adding plan_name column to production_plan...');
    await conn.execute("ALTER TABLE production_plan ADD COLUMN plan_name VARCHAR(120) NOT NULL DEFAULT 'Standard Production Plan' AFTER id");
  }
  if (!existingPlanFields.includes('status')) {
    console.log('Adding status column to production_plan...');
    await conn.execute("ALTER TABLE production_plan ADD COLUMN status ENUM('Active', 'In Progress', 'Completed', 'Pending') NOT NULL DEFAULT 'Active' AFTER planned_quantity");
  }

  // 2. Create scheduled_reports table
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS scheduled_reports (
      id INT AUTO_INCREMENT PRIMARY KEY,
      report_name VARCHAR(120) NOT NULL DEFAULT 'Production & Plan Report',
      primary_email VARCHAR(255) NOT NULL,
      additional_emails TEXT NULL,
      schedule_cadence ENUM('Daily', 'Weekly', 'Monthly') NOT NULL DEFAULT 'Daily',
      generation_time VARCHAR(10) NOT NULL DEFAULT '18:00',
      cell_id VARCHAR(50) NOT NULL DEFAULT 'ALL',
      machine_code VARCHAR(50) NOT NULL DEFAULT 'ALL',
      plan_name VARCHAR(120) NOT NULL DEFAULT 'ALL',
      plan_status VARCHAR(50) NOT NULL DEFAULT 'ALL',
      time_breakdown ENUM('shift_wise', 'day_wise', 'both') NOT NULL DEFAULT 'both',
      shift_selection VARCHAR(50) NOT NULL DEFAULT 'ALL',
      include_plan_vs_actual BOOLEAN NOT NULL DEFAULT TRUE,
      report_format ENUM('Excel', 'CSV', 'PDF') NOT NULL DEFAULT 'Excel',
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      last_run_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  console.log('Table scheduled_reports initialized successfully.');
  await conn.end();
}

initTables().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
