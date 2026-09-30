const database = require("./mysql");
const passwordAuth = require("./passwordAuth");

async function main() {
  try {
    await database.testConnection();
    await database.createTables();

    const timestamp = Date.now();

    const facility = await database.facilities.create({
      name: `Test Facility ${timestamp}`,
      location: "Test Location",
    });

    const user = await passwordAuth.createUser({
      firstname: "Test",
      surname: "User",
      password: "test-password",
      username: `testuser_${timestamp}`,
      admin: false,
      facility: facility.name,
      email: `test_${timestamp}@example.com`,
    });

    const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 19)
      .replace("T", " ");

    const assignment = await database.assignments.create({
      name: `Test Assignment ${timestamp}`,
      description: "Test assignment description",
      feedback: "Test feedback",
      status: 0,
      facility: facility.name,
      end_date: endDate,
      important: false,
    });

    const authenticatedUser = await passwordAuth.authenticateUser(
      user.username,
      "test-password",
    );

    const loadedFacility = await database.facilities.getById(facility.id);
    const loadedAssignment = await database.assignments.getById(
      assignment.id,
    );

    console.log("Entries loaded from the database:");
    console.dir(
      {
        facility: loadedFacility,
        user: authenticatedUser,
        assignment: loadedAssignment,
      },
      { depth: null },
    );
  } catch (error) {
    console.error("Failed to create and load test data:", error);
    process.exitCode = 1;
  } finally {
    await database.closeDatabase();
  }
}

main();