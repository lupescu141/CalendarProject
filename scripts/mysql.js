const mysql = require("mysql2/promise");

let pool;

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.MYSQL_HOST || "localhost",
      port: Number(process.env.MYSQL_PORT || 3306),
      user: process.env.MYSQL_USER || "root",
      password: process.env.MYSQL_PASSWORD || "Qwerty",
      database: process.env.MYSQL_DATABASE || "Calendar",
      waitForConnections: true,
      connectionLimit: Number(process.env.MYSQL_CONNECTION_LIMIT || 10),
      dateStrings: true,
    });
  }

  return pool;
}

async function closeDatabase() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

async function testConnection() {
  const connection = await getPool().getConnection();
  connection.release();
  return true;
}

async function createTables() {
  const database = getPool();

  await database.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INT NOT NULL AUTO_INCREMENT,
      firstname VARCHAR(100) NOT NULL,
      surname VARCHAR(100) NOT NULL,
      password VARCHAR(255) NOT NULL,
      username VARCHAR(100) NOT NULL,
      admin BOOLEAN NOT NULL DEFAULT FALSE,
      facility VARCHAR(150) NOT NULL,
      email VARCHAR(255) NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_users_username (username),
      UNIQUE KEY uq_users_email (email)
    )
  `);

  await database.execute(`
    CREATE TABLE IF NOT EXISTS assignments (
      id INT NOT NULL AUTO_INCREMENT,
      name VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      feedback TEXT,
      status INT NOT NULL DEFAULT 0,
      facility VARCHAR(150) NOT NULL,
      end_date DATETIME NOT NULL,
      date_created DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      important BOOLEAN NOT NULL DEFAULT FALSE,
      PRIMARY KEY (id)
    )
  `);

  await database.execute(`
    CREATE TABLE IF NOT EXISTS facilities (
      id INT NOT NULL AUTO_INCREMENT,
      name VARCHAR(255) NOT NULL,
      location VARCHAR(255) NOT NULL,
      PRIMARY KEY (id)
    )
  `);
}

async function listUsers() {
  const [rows] = await getPool().execute(
    "SELECT id, firstname, surname, username, admin, facility, email FROM users ORDER BY id DESC",
  );
  return rows;
}

async function getUserById(id) {
  const [rows] = await getPool().execute(
    "SELECT id, firstname, surname, username, admin, facility, email FROM users WHERE id = ?",
    [id],
  );
  return rows[0] || null;
}

async function getUserByUsername(username) {
  const [rows] = await getPool().execute(
    "SELECT id, firstname, surname, username, admin, facility, email, password FROM users WHERE username = ?",
    [username],
  );
  return rows[0] || null;
}

async function createUser(user) {
  const [result] = await getPool().execute(
    `INSERT INTO users
      (firstname, surname, password, username, admin, facility, email)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      user.firstname,
      user.surname,
      user.password,
      user.username,
      user.admin ?? false,
      user.facility,
      user.email,
    ],
  );
  return getUserById(result.insertId);
}

async function updateUser(id, user) {
  const [result] = await getPool().execute(
    `UPDATE users
      SET firstname = ?, surname = ?, password = ?, username = ?,
          admin = ?, facility = ?, email = ?
      WHERE id = ?`,
    [
      user.firstname,
      user.surname,
      user.password,
      user.username,
      user.admin ?? false,
      user.facility,
      user.email,
      id,
    ],
  );
  return result.affectedRows > 0 ? getUserById(id) : null;
}

async function deleteUser(id) {
  const [result] = await getPool().execute(
    "DELETE FROM users WHERE id = ?",
    [id],
  );
  return result.affectedRows > 0;
}

async function listAssignments(facility) {
  const query = facility
    ? "SELECT * FROM assignments WHERE facility = ? ORDER BY end_date ASC"
    : "SELECT * FROM assignments ORDER BY end_date ASC";
  const [rows] = await getPool().execute(query, facility ? [facility] : []);
  return rows;
}

async function getAssignmentById(id) {
  const [rows] = await getPool().execute(
    "SELECT * FROM assignments WHERE id = ?",
    [id],
  );
  return rows[0] || null;
}

async function createAssignment(assignment) {
  const [result] = await getPool().execute(
    `INSERT INTO assignments
      (name, description, feedback, status, facility, end_date, important)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      assignment.name,
      assignment.description,
      assignment.feedback ?? null,
      assignment.status ?? 0,
      assignment.facility,
      assignment.end_date,
      assignment.important ?? false,
    ],
  );
  return getAssignmentById(result.insertId);
}

async function updateAssignment(id, assignment) {
  const [result] = await getPool().execute(
    `UPDATE assignments
      SET name = ?, description = ?, feedback = ?, status = ?,
          facility = ?, end_date = ?, important = ?
      WHERE id = ?`,
    [
      assignment.name,
      assignment.description,
      assignment.feedback ?? null,
      assignment.status ?? 0,
      assignment.facility,
      assignment.end_date,
      assignment.important ?? false,
      id,
    ],
  );
  return result.affectedRows > 0 ? getAssignmentById(id) : null;
}

async function deleteAssignment(id) {
  const [result] = await getPool().execute(
    "DELETE FROM assignments WHERE id = ?",
    [id],
  );
  return result.affectedRows > 0;
}

async function listFacilities() {
  const [rows] = await getPool().execute(
    "SELECT id, name, location FROM facilities ORDER BY name ASC",
  );
  return rows;
}

async function getFacilityById(id) {
  const [rows] = await getPool().execute(
    "SELECT id, name, location FROM facilities WHERE id = ?",
    [id],
  );
  return rows[0] || null;
}

async function createFacility(facility) {
  const [result] = await getPool().execute(
    "INSERT INTO facilities (name, location) VALUES (?, ?)",
    [facility.name, facility.location],
  );
  return getFacilityById(result.insertId);
}

async function updateFacility(id, facility) {
  const [result] = await getPool().execute(
    "UPDATE facilities SET name = ?, location = ? WHERE id = ?",
    [facility.name, facility.location, id],
  );
  return result.affectedRows > 0 ? getFacilityById(id) : null;
}

async function deleteFacility(id) {
  const [result] = await getPool().execute(
    "DELETE FROM facilities WHERE id = ?",
    [id],
  );
  return result.affectedRows > 0;
}

module.exports = {
  getPool,
  closeDatabase,
  testConnection,
  createTables,
  users: {
    list: listUsers,
    getById: getUserById,
    getByUsername: getUserByUsername,
    create: createUser,
    update: updateUser,
    remove: deleteUser,
  },
  assignments: {
    list: listAssignments,
    getById: getAssignmentById,
    create: createAssignment,
    update: updateAssignment,
    remove: deleteAssignment,
  },
  facilities: {
    list: listFacilities,
    getById: getFacilityById,
    create: createFacility,
    update: updateFacility,
    remove: deleteFacility,
  },
};