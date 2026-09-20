const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { query } = require('./db');

async function initDb() {
  if (!process.env.DATABASE_URL) {
    console.warn('DATABASE_URL not configured; skipping database initialization.');
    return false;
  }

  try {
    const schemaPath = path.join(__dirname, '../../database/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    await query(schema);

    const seeds = [
      ['student', 'student', null, 'Demo Student', 'student@kare.edu', 'student', 'Demo Department', '1', 'A'],
      [null, null, 'faculty', 'Demo Faculty', 'faculty@kare.edu', 'faculty', 'Demo Department', null, null],
      [null, null, 'admin', 'Demo Administrator', 'admin@kare.edu', 'admin', null, null, null]
    ];

    for (const [registerNo, employeeId, identifier, fullName, email, role, department, semester, section] of seeds) {
      const passwordHash = await bcrypt.hash(identifier, 12);
      await query(
        `INSERT INTO users(register_no, employee_id, full_name, email, password_hash, role, department, semester, section)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT DO NOTHING`,
        [registerNo, employeeId, fullName, email, passwordHash, role, department, semester, section]
      );
    }

    // KARE academic master-data starter set. Department names are based on KARE's publicly listed academic areas.
    const departments = [
      ['CSE','Computer Science and Engineering'],['IT','Information Technology'],['CIT','Computer and Information Technology'],
      ['ECE','Electronics and Communication Engineering'],['EEE','Electrical and Electronics Engineering'],
      ['MECH','Mechanical Engineering'],['CIVIL','Civil Engineering'],['AERO','Aeronautical Engineering'],
      ['AUTO','Automobile Engineering'],['AGRI','Agricultural Sciences'],['FT','Food Technology'],
      ['MATH','Mathematics'],['PHYS','Physics'],['CHEM','Chemistry'],['FORENSIC','Forensic Science'],['BIOMED','Biomedical Engineering']
    ];
    for (const [code,name] of departments) {
      await query(`INSERT INTO departments(code,name) VALUES($1,$2) ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name`,[code,name]);
    }

    // Starter subjects are deliberately common/foundation subjects; exact programme curriculum remains editable by Admin.
    const starterSubjects = [
      ['CSE101','Programming in C','CSE','1'],['CSE102','Engineering Mathematics I','CSE','1'],['CSE103','Engineering Physics','CSE','1'],['CSE104','Engineering Chemistry','CSE','1'],
      ['CSE201','Data Structures','CSE','2'],['CSE202','Object Oriented Programming','CSE','2'],['CSE203','Discrete Mathematics','CSE','2'],['CSE204','Digital Logic Design','CSE','2'],
      ['CSE301','Database Management Systems','CSE','3'],['CSE302','Operating Systems','CSE','3'],['CSE303','Computer Networks','CSE','3'],['CSE304','Software Engineering','CSE','3'],
      ['CSE401','Compiler Design','CSE','4'],['CSE402','Artificial Intelligence','CSE','4'],['CSE403','Machine Learning','CSE','4'],['CSE404','Cloud Computing','CSE','4'],
      ['IT101','Programming in C','IT','1'],['IT201','Data Structures','IT','2'],['IT301','Database Management Systems','IT','3'],['IT401','Cloud Computing','IT','4'],
      ['ECE101','Engineering Mathematics I','ECE','1'],['ECE201','Electronic Devices','ECE','2'],['ECE301','Digital Signal Processing','ECE','3'],['ECE401','Communication Systems','ECE','4'],
      ['EEE101','Engineering Mathematics I','EEE','1'],['EEE201','Electrical Machines','EEE','2'],['EEE301','Power Electronics','EEE','3'],['EEE401','Power Systems','EEE','4'],
      ['ME101','Engineering Graphics','MECH','1'],['ME201','Engineering Mechanics','MECH','2'],['ME301','Thermodynamics','MECH','3'],['ME401','Manufacturing Technology','MECH','4'],
      ['CE101','Engineering Mechanics','CIVIL','1'],['CE201','Strength of Materials','CIVIL','2'],['CE301','Fluid Mechanics','CIVIL','3'],['CE401','Structural Analysis','CIVIL','4'],
      ['AE101','Engineering Mathematics I','AERO','1'],['AE201','Aerodynamics','AERO','2'],['AE301','Aircraft Structures','AERO','3'],['AE401','Propulsion','AERO','4'],
      ['AU101','Engineering Mechanics','AUTO','1'],['AU201','Automotive Engines','AUTO','2'],['AU301','Vehicle Dynamics','AUTO','3'],['AU401','Automotive Design','AUTO','4'],
      ['AG101','Agricultural Science Fundamentals','AGRI','1'],['AG201','Soil Science','AGRI','2'],['AG301','Crop Production','AGRI','3'],['AG401','Agricultural Engineering','AGRI','4'],
      ['FT101','Food Science Fundamentals','FT','1'],['FT201','Food Microbiology','FT','2'],['FT301','Food Processing','FT','3'],['FT401','Food Packaging','FT','4'],
      ['BM101','Biomedical Engineering Fundamentals','BIOMED','1'],['BM201','Biomaterials','BIOMED','2'],['BM301','Biomedical Instrumentation','BIOMED','3'],['BM401','Medical Imaging','BIOMED','4']
    ];
    for (const [code,name,department,semester] of starterSubjects) {
      await query(`INSERT INTO subjects(code,name,department,semester) VALUES($1,$2,$3,$4) ON CONFLICT(code) DO NOTHING`,[code,name,department,semester]);
    }

    console.log('KARE ONE database schema and development users are ready.');
    return true;
  } catch (error) {
    console.warn('Database initialization skipped:', error.code || error.message);
    return false;
  }
}

module.exports = { initDb };
