const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { query } = require('./db');

const KARE_CSE_2021_SOURCE = 'https://kalasalingam.ac.in/wp-content/uploads/Curriculum/CSE%20CURRICULUM%20AND%20SYLLABUS%202021.pdf';

function semesterFromCode(code) {
  const m = String(code).match(/CSE([0-9])/);
  if (!m) return null;
  const first = Number(m[1]);
  return first >= 1 && first <= 4 ? String(first) : null;
}

async function initDb() {
  if (!process.env.DATABASE_URL) {
    console.warn('DATABASE_URL not configured; skipping database initialization.');
    return false;
  }

  try {
    const schemaPath = path.join(__dirname, '../../database/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    await query(schema);

    // Keep the academic master data auditable: these fields identify the published curriculum source.
    await query("ALTER TABLE subjects ADD COLUMN IF NOT EXISTS curriculum_year VARCHAR(20)");
    await query("ALTER TABLE subjects ADD COLUMN IF NOT EXISTS course_type VARCHAR(40)");
    await query("ALTER TABLE subjects ADD COLUMN IF NOT EXISTS stream VARCHAR(120)");
    await query("ALTER TABLE subjects ADD COLUMN IF NOT EXISTS credits NUMERIC(5,2)");
    await query("ALTER TABLE subjects ADD COLUMN IF NOT EXISTS source_url TEXT");

    const seeds = [
      ['student', 'student', null, 'Demo Student', 'student@kare.edu', 'student', 'Computer Science and Engineering', '1', 'A'],
      [null, null, 'faculty', 'Demo Faculty', 'faculty@kare.edu', 'faculty', 'Computer Science and Engineering', null, null],
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

    // Public KARE programme catalogue (program codes published by KARE).
    const programs = [
      ['30','B.Tech. – Aeronautical Engineering','Aeronautical Engineering','B.Tech',4],
      ['10','B.Tech. – Automobile Engineering','Automobile Engineering','B.Tech',4],
      ['20','B.Tech. – Biomedical Engineering','Biomedical Engineering','B.Tech',4],
      ['1','B.Tech. – Bio Technology','Biotechnology','B.Tech',4],
      ['2','B.Tech. – Chemical Engineering','Chemical Engineering','B.Tech',4],
      ['3','B.Tech. – Civil Engineering','Civil Engineering','B.Tech',4],
      ['4','B.Tech. – Computer Science and Engineering','Computer Science and Engineering','B.Tech',4],
      ['181','B.Tech. Computer Science and Engineering (Artificial Intelligence and Machine Learning)','Computer Science and Engineering','B.Tech',4],
      ['182','B.Tech. Computer Science and Engineering (Cyber Security)','Computer Science and Engineering','B.Tech',4],
      ['183','B.Tech. Computer Science and Engineering (Data Science)','Computer Science and Engineering','B.Tech',4],
      ['184','B.Tech. Computer Science and Engineering (Internet of Things and Cyber Security including Block Chain Technology)','Computer Science and Engineering','B.Tech',4],
      ['5','B.Tech. Electronics and Communication Engineering','Electronics and Communication Engineering','B.Tech',4],
      ['6','B.Tech. – Electrical and Electronics Engineering','Electrical and Electronics Engineering','B.Tech',4],
      ['11','B.Tech. – Food Technology','Food Technology','B.Tech',4],
      ['8','B.Tech. – Information Technology','Information Technology','B.Tech',4],
      ['9','B.Tech. – Mechanical Engineering','Mechanical Engineering','B.Tech',4]
    ];
    for (const [code,name,department,degree,duration] of programs) {
      await query(
        `INSERT INTO programs(code,name,department,degree,duration_years)
         VALUES($1,$2,$3,$4,$5)
         ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name,department=EXCLUDED.department,degree=EXCLUDED.degree,duration_years=EXCLUDED.duration_years`,
        [code,name,department,degree,duration]
      );
    }

    // Official KARE B.Tech CSE Curriculum-2021 course catalogue.
    // Source: KARE published curriculum PDF; course type/stream are preserved where published.
    const officialCse = [
      ['211CSE1401','Problem Solving using Computer Programming','Foundation Core',null,3],
      ['211CSE1402','Python Programming','Foundation Core',null,3],

      ['214CSE1301','Windows Programming','University Elective','University Elective',3],
      ['214CSE2302','Getting Started with Data Structure','University Elective','University Elective',3],
      ['214CSE2303','Object Oriented Programming','University Elective','University Elective',3],
      ['214CSE2304','Network Programming','University Elective','University Elective',3],
      ['214CSE2305','Cloud Computing','University Elective','University Elective',3],
      ['214CSE2306','Android Programming','University Elective','University Elective',3],
      ['214CSE3307','Data Analytics with R','University Elective','University Elective',3],
      ['214CSE3308','Introduction to Cyber Security','University Elective','University Elective',3],
      ['214CSE3309','Introduction to Machine Learning','University Elective','University Elective',3],
      ['214CSE4310','Ethical Hacking','University Elective','University Elective',3],

      ['212CSE1101','IT Infrastructure Landscape Overview','Program Core','Program Core',3],
      ['212CSE2301','Data Structures','Program Core','Program Core',4],
      ['212CSE2302','Digital Principles and System Design','Program Core','Program Core',4],
      ['212CSE2403','Java Programming','Program Core','Program Core',4],
      ['212CSE2303','Software Engineering','Program Core','Program Core',3],
      ['212CSE2101','Discrete Mathematics','Program Core','Program Core',4],
      ['212CSE2304','Machine Learning','Program Core','Program Core',4],
      ['212CSE2305','Database Management Systems','Program Core','Program Core',4],
      ['212CSE2102','Computer Architecture and Organization','Program Core','Program Core',3],
      ['212CSE3301','Design and Analysis of Algorithms','Program Core','Program Core',4],
      ['212CSE3302','Computer Networks','Program Core','Program Core',4],
      ['212CSE3303','Operating Systems','Program Core','Program Core',4],
      ['212CSE3304','Automata and Compiler Design','Program Core','Program Core',4],
      ['212CSE3305','Secured Computing','Program Core','Program Core',3],

      ['213CSE1301','Introduction to Artificial Intelligence and Machine Learning','Program Elective','Artificial Intelligence and Machine Learning',4],
      ['213CSE2301','Predictive Analytics','Program Elective','Artificial Intelligence and Machine Learning',4],
      ['213CSE2302','Algorithms for Intelligent Systems and Robotics','Program Elective','Artificial Intelligence and Machine Learning',4],
      ['213CSE2303','Computational Linguistics and Natural Language Processing','Program Elective','Artificial Intelligence and Machine Learning',4],
      ['213CSE3301','Deep Learning','Program Elective','Artificial Intelligence and Machine Learning',4],
      ['213CSE4301','Pattern and Anomaly Detection','Program Elective','Artificial Intelligence and Machine Learning',4],

      ['213CSE1303','Introduction to Data Analytics','Program Elective','Data Analytics',4],
      ['213CSE2305','Data Warehousing and Multidimensional Modeling','Program Elective','Data Analytics',4],
      ['213CSE2306','Data Visualization for Analytics','Program Elective','Data Analytics',4],
      ['213CSE3305','Descriptive Analytics','Program Elective','Data Analytics',4],
      ['213CSE3306','Big Data Analytics','Program Elective','Data Analytics',4],
      ['213CSE4305','Social, Web and Mobile Analytics','Program Elective','Data Analytics',4],

      ['213CSE1302','Information Security Fundamentals','Program Elective','Cyber Security and Forensics',4],
      ['213CSE2309','IT Physical Security and System Security','Program Elective','Cyber Security and Forensics',4],
      ['213CSE3309','IT Application Security','Program Elective','Cyber Security and Forensics',4],
      ['213CSE4307','Digital Forensics','Program Elective','Cyber Security and Forensics',4],
      ['213CSE4308','IT Network Security','Program Elective','Cyber Security and Forensics',4],
      ['213CSE4309','IT Data Security','Program Elective','Cyber Security and Forensics',4],
      ['213CSE4310','Ethical Hacking & Penetration Testing','Program Elective','Cyber Security and Forensics',4],

      ['213CSE1304','Introduction to Internet of Things','Program Elective','Internet of Things and Smart City',4],
      ['213CSE3310','Introduction to Sensor Technology and Instrumentation','Program Elective','Internet of Things and Smart City',4],
      ['213CSE3311','Wireless Sensor Networks and IoT Standards','Program Elective','Internet of Things and Smart City',4],
      ['213CSE3312','Cloud Computing Architecture and Deployment Models','Program Elective','Internet of Things and Smart City',4],
      ['213CSE4311','Analytics for IoT','Program Elective','Internet of Things and Smart City',4],
      ['213CSE4312','Smarter City','Program Elective','Internet of Things and Smart City',4],

      ['213CSE1305','Network and Information Security','Program Elective','Networks and Security',4],
      ['213CSE2305-NU','Pervasive and Ubiquitous Computing','Program Elective','Networks and Security',4],
      ['213CSE2311','Virtualization','Program Elective','Networks and Security',4],
      ['213CSE2312','Mobile and Wireless Security','Program Elective','Networks and Security',4],
      ['213CSE3313','Graph Theory and its Applications','Program Elective','Networks and Security',4],

      ['213CSE2313','Embedded Systems','Program Elective','Electrical and Electronics Communication',4],
      ['213CSE2314','RFID and its Applications','Program Elective','Electrical and Electronics Communication',4],
      ['213CSE3314','Cognitive Radio','Program Elective','Electrical and Electronics Communication',4],
      ['213CSE3315','Principles of Communication','Program Elective','Electrical and Electronics Communication',4],
      ['213CSE3316','Signal and Image Processing','Program Elective','Electrical and Electronics Communication',4],

      ['213CSE1306','Web Technology','Program Elective','Software Development',4],
      ['213CSE2315','Software Testing','Program Elective','Software Development',4],
      ['213CSE2316','Mobile Application Development','Program Elective','Software Development',4],
      ['213CSE3317','Free and Open Source Software','Program Elective','Software Development',4],
      ['213CSE3318','User Interface Design','Program Elective','Software Development',4],
      ['213CSE3319','Agile Methodology','Program Elective','Software Development',4],

      ['216CSE4301','Applications of Machine Learning in Industries','Experiential Elective',null,4],
      ['216CSE4302','BA for Industries','Experiential Elective',null,4],
      ['216CSE4303','IoT for Industries (Use Case Scenarios)','Experiential Elective',null,4],
      ['216CSE4304','Information Security Governance, Management Practices, Security Audit & Monitoring','Experiential Elective',null,4],
      ['216CSE2201','Competitive Programming','Experiential Elective',null,2],
      ['216CSE3201','Micro Project','Experiential Elective',null,2],

      ['213CSE2101','Advanced Web Frameworks','Honors Elective',null,2],
      ['213CSE2102','Blockchain Technology','Honors Elective',null,2],
      ['213CSE2103','Video Analytics','Honors Elective',null,2],
      ['213CSE3101','Advanced Computer Architecture','Honors Elective',null,3],
      ['213CSE3102','Augmented Reality','Honors Elective',null,3],
      ['213CSE3103','Advanced Databases','Honors Elective',null,3],
      ['213CSE4101','High Performance Computing','Honors Elective',null,4],
      ['213CSE4102','Next Generation Networks','Honors Elective',null,4],
      ['213CSE4103','Visual Cryptography','Honors Elective',null,4]
    ];

    for (const [rawCode,name,courseType,stream,credits] of officialCse) {
      const code = rawCode === '213CSE2305-NU' ? '213CSE2305NS' : rawCode;
      const semester = semesterFromCode(code);
      await query(
        `INSERT INTO subjects(code,name,department,semester,curriculum_year,course_type,stream,credits,source_url)
         VALUES($1,$2,'CSE',$3,'2021',$4,$5,$6,$7)
         ON CONFLICT(code) DO UPDATE SET
           name=EXCLUDED.name,department=EXCLUDED.department,semester=EXCLUDED.semester,
           curriculum_year=EXCLUDED.curriculum_year,course_type=EXCLUDED.course_type,
           stream=EXCLUDED.stream,credits=EXCLUDED.credits,source_url=EXCLUDED.source_url`,
        [code,name,semester,courseType,stream,credits,KARE_CSE_2021_SOURCE]
      );
    }

    // Keep the existing cross-school starter catalogue for programmes where we have not yet imported
    // a complete published curriculum in this deployment.
    const starterSubjects = [
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
      await query(
        `INSERT INTO subjects(code,name,department,semester)
         VALUES($1,$2,$3,$4) ON CONFLICT(code) DO NOTHING`,
        [code,name,department,semester]
      );
    }

    // Make the development faculty account actually usable with the published CSE subject catalogue.
    // This is an assignment in our portal, not a claim that this demo faculty member is a real KARE faculty member.
    const faculty = await query("SELECT id FROM users WHERE role='faculty' AND employee_id='faculty' LIMIT 1");
    const facultyId = faculty.rows[0]?.id;
    if (facultyId) {
      await query(
        `INSERT INTO faculty_subjects(faculty_id,subject_id)
         SELECT $1,s.id FROM subjects s
         WHERE s.department='CSE' AND s.curriculum_year='2021'
         ON CONFLICT DO NOTHING`,
        [facultyId]
      );
    }

    console.log('KARE ONE database schema, public programme catalogue, CSE 2021 curriculum and faculty subject assignments are ready.');
    return true;
  } catch (error) {
    console.warn('Database initialization skipped:', error.code || error.message);
    return false;
  }
}

module.exports = { initDb };
