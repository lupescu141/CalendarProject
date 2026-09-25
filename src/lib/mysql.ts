import mysql, { type Pool, type ResultSetHeader, type RowDataPacket } from "mysql2/promise";

export interface UserRecord extends RowDataPacket {
  id: number;
  firstname: string;
  surname: string;
  username: string;
  admin: boolean;
  facility: string;
  email: string;
  password?: string;
}

export interface AssignmentRecord extends RowDataPacket {
  id: number;
  name: string;
  description: string;
  feedback: string | null;
  user_id: number | null;
  status: number;
  facility: string;
  end_date: string;
  date_created: string;
  important: boolean;
}

export interface FacilityRecord extends RowDataPacket {
  id: number;
  name: string;
  location: string;
}

export interface UserInput {
  firstname: string;
  surname: string;
  password: string;
  username: string;
  admin?: boolean;
  facility: string;
  email: string;
}

export interface AssignmentInput {
  name: string;
  description: string;
  feedback?: string | null;
  user_id?: number | null;
  status?: number;
  facility: string;
  end_date: string;
  important?: boolean;
}

export interface FacilityInput {
  name: string;
  location: string;
}

let pool: Pool | undefined;

export function getPool(): Pool {
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

export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

export async function testConnection(): Promise<boolean> {
  const connection = await getPool().getConnection();
  connection.release();
  return true;
}

export async function createTables(): Promise<void> {
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
      user_id INT NULL,
      status INT NOT NULL DEFAULT 0,
      facility VARCHAR(150) NOT NULL,
      end_date DATETIME NOT NULL,
      date_created DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      important BOOLEAN NOT NULL DEFAULT FALSE,
      PRIMARY KEY (id)
    )
  `);

  try {
    await database.execute("ALTER TABLE assignments ADD COLUMN user_id INT NULL");
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("Duplicate column name")) {
      throw error;
    }
  }

  await database.execute(`
    CREATE TABLE IF NOT EXISTS facilities (
      id INT NOT NULL AUTO_INCREMENT,
      name VARCHAR(255) NOT NULL,
      location VARCHAR(255) NOT NULL,
      PRIMARY KEY (id)
    )
  `);
}

export async function listUsers(): Promise<UserRecord[]> {
  const [rows] = await getPool().execute<RowDataPacket[]>(
    "SELECT id, firstname, surname, username, admin, facility, email FROM users ORDER BY id DESC",
  );

  return rows as UserRecord[];
}

export async function getUserById(id: number): Promise<UserRecord | null> {
  const [rows] = await getPool().execute<RowDataPacket[]>(
    "SELECT id, firstname, surname, username, admin, facility, email, password FROM users WHERE id = ?",
    [id],
  );

  const users = rows as UserRecord[];
  return users[0] ?? null;
}

export async function getUserByUsername(username: string): Promise<UserRecord | null> {
  const [rows] = await getPool().execute<RowDataPacket[]>(
    "SELECT id, firstname, surname, username, admin, facility, email, password FROM users WHERE username = ?",
    [username],
  );

  const users = rows as UserRecord[];
  return users[0] ?? null;
}

export async function createUser(user: UserInput): Promise<UserRecord | null> {
  const [result] = await getPool().execute<ResultSetHeader>(
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

export async function updateUser(id: number, user: UserInput): Promise<UserRecord | null> {
  const [result] = await getPool().execute<ResultSetHeader>(
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

export async function deleteUser(id: number): Promise<boolean> {
  const [result] = await getPool().execute<ResultSetHeader>(
    "DELETE FROM users WHERE id = ?",
    [id],
  );

  return result.affectedRows > 0;
}

export async function listAssignments(facility?: string): Promise<AssignmentRecord[]> {
  const query = facility
    ? "SELECT * FROM assignments WHERE facility = ? ORDER BY end_date ASC"
    : "SELECT * FROM assignments ORDER BY end_date ASC";

  const [rows] = await getPool().execute<RowDataPacket[]>(query, facility ? [facility] : []);
  return rows as AssignmentRecord[];
}

export async function getAssignmentById(id: number): Promise<AssignmentRecord | null> {
  const [rows] = await getPool().execute<RowDataPacket[]>(
    "SELECT * FROM assignments WHERE id = ?",
    [id],
  );

  const assignments = rows as AssignmentRecord[];
  return assignments[0] ?? null;
}

export async function createAssignment(assignment: AssignmentInput): Promise<AssignmentRecord | null> {
  const [result] = await getPool().execute<ResultSetHeader>(
    `INSERT INTO assignments
      (name, description, feedback, user_id, status, facility, end_date, important)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      assignment.name,
      assignment.description,
      assignment.feedback ?? null,
      assignment.user_id ?? null,
      assignment.status ?? 0,
      assignment.facility,
      assignment.end_date,
      assignment.important ?? false,
    ],
  );

  return getAssignmentById(result.insertId);
}

export async function updateAssignment(
  id: number,
  assignment: AssignmentInput,
): Promise<AssignmentRecord | null> {
  const [result] = await getPool().execute<ResultSetHeader>(
    `UPDATE assignments
      SET name = ?, description = ?, feedback = ?, user_id = ?, status = ?,
          facility = ?, end_date = ?, important = ?
      WHERE id = ?`,
    [
      assignment.name,
      assignment.description,
      assignment.feedback ?? null,
      assignment.user_id ?? null,
      assignment.status ?? 0,
      assignment.facility,
      assignment.end_date,
      assignment.important ?? false,
      id,
    ],
  );

  return result.affectedRows > 0 ? getAssignmentById(id) : null;
}

export async function deleteAssignment(id: number): Promise<boolean> {
  const [result] = await getPool().execute<ResultSetHeader>(
    "DELETE FROM assignments WHERE id = ?",
    [id],
  );

  return result.affectedRows > 0;
}

export async function listFacilities(): Promise<FacilityRecord[]> {
  const [rows] = await getPool().execute<RowDataPacket[]>(
    "SELECT id, name, location FROM facilities ORDER BY name ASC",
  );

  return rows as FacilityRecord[];
}

export async function getFacilityById(id: number): Promise<FacilityRecord | null> {
  const [rows] = await getPool().execute<RowDataPacket[]>(
    "SELECT id, name, location FROM facilities WHERE id = ?",
    [id],
  );

  const facilities = rows as FacilityRecord[];
  return facilities[0] ?? null;
}

export async function createFacility(facility: FacilityInput): Promise<FacilityRecord | null> {
  const [result] = await getPool().execute<ResultSetHeader>(
    "INSERT INTO facilities (name, location) VALUES (?, ?)",
    [facility.name, facility.location],
  );

  return getFacilityById(result.insertId);
}

export async function updateFacility(
  id: number,
  facility: FacilityInput,
): Promise<FacilityRecord | null> {
  const [result] = await getPool().execute<ResultSetHeader>(
    "UPDATE facilities SET name = ?, location = ? WHERE id = ?",
    [facility.name, facility.location, id],
  );

  return result.affectedRows > 0 ? getFacilityById(id) : null;
}

export async function deleteFacility(id: number): Promise<boolean> {
  const [result] = await getPool().execute<ResultSetHeader>(
    "DELETE FROM facilities WHERE id = ?",
    [id],
  );

  return result.affectedRows > 0;
}

export const users = {
  list: listUsers,
  getById: getUserById,
  getByUsername: getUserByUsername,
  create: createUser,
  update: updateUser,
  remove: deleteUser,
};

export const assignments = {
  list: listAssignments,
  getById: getAssignmentById,
  create: createAssignment,
  update: updateAssignment,
  remove: deleteAssignment,
};

export const facilities = {
  list: listFacilities,
  getById: getFacilityById,
  create: createFacility,
  update: updateFacility,
  remove: deleteFacility,
};
