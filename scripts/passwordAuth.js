const crypto = require("node:crypto");
const { promisify } = require("node:util");
const database = require("./mysql");

const scrypt = promisify(crypto.scrypt);

const SALT_LENGTH = 16;
const KEY_LENGTH = 64;

const SCRYPT_OPTIONS = {
  N: 1 << 15,
  r: 8,
  p: 1,
  maxmem: 64 * 1024 * 1024,
};

async function hashPassword(password) {
  if (typeof password !== "string" || password.length === 0) {
    throw new Error("Invalid password");
  }

  const salt = crypto.randomBytes(SALT_LENGTH);

  const derivedKey = await scrypt(
    password,
    salt,
    KEY_LENGTH,
    SCRYPT_OPTIONS
  );

  return [
    "scrypt",
    "v=1",
    `N=${SCRYPT_OPTIONS.N},r=${SCRYPT_OPTIONS.r},p=${SCRYPT_OPTIONS.p}`,
    salt.toString("hex"),
    derivedKey.toString("hex"),
  ].join("$");
}

function parseStoredPassword(value) {
  if (typeof value !== "string") return null;

  const parts = value.split("$");
  if (parts.length !== 5) return null;

  const [algorithm, version, parameters, saltHex, keyHex] = parts;

  if (algorithm !== "scrypt" || version !== "v=1") return null;
  if (parameters !== "N=32768,r=8,p=1") return null;

  if (!/^[0-9a-fA-F]+$/.test(saltHex) ||
      !/^[0-9a-fA-F]+$/.test(keyHex)) {
    return null;
  }

  if (saltHex.length !== SALT_LENGTH * 2 ||
      keyHex.length !== KEY_LENGTH * 2) {
    return null;
  }

  return {
    salt: Buffer.from(saltHex, "hex"),
    key: Buffer.from(keyHex, "hex"),
  };
}

async function verifyPassword(password, storedPassword) {
  const parsed = parseStoredPassword(storedPassword);
  if (!parsed) return false;

  const derivedKey = await scrypt(
    password,
    parsed.salt,
    KEY_LENGTH,
    SCRYPT_OPTIONS
  );

  return crypto.timingSafeEqual(parsed.key, derivedKey);
}

async function createUser(user) {
  const password = await hashPassword(user.password);

  return database.users.create({
    ...user,
    password,
  });
}

async function authenticateUser(username, password) {
  const user = await database.users.getByUsername(username);

  if (!user || !(await verifyPassword(password, user.password))) {
    return null;
  }

  const { password: storedPassword, ...publicUser } = user;
  return publicUser;
}

module.exports = {
  createUser,
  authenticateUser,
};