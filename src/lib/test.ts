import * as database from "./mysql";
import * as passwordAuth from "./passwordAuth";

export async function main(): Promise<void> {
  try {
    await database.testConnection();
    await database.createTables();

    const timestamp = Date.now();

    const facility = await database.facilities.create({
      name: `Test Facility ${timestamp}`,
      location: "Test Location",
    });

    if (!facility) {
      throw new Error("Failed to create facility");
    }

    const user = await passwordAuth.createUser({
      firstname: "Test",
      surname: "User",
      password: "test-password",
      username: `testuser_${timestamp}`,
      admin: false,
      facility: facility.name,
      email: `test_${timestamp}@example.com`,
    });

    if (!user) {
      throw new Error("Failed to create user");
    }

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

    if (!assignment) {
      throw new Error("Failed to create assignment");
    }

    const authenticatedUser = await passwordAuth.authenticateUser(
      user.username,
      "test-password",
    );

    const loadedFacility = await database.facilities.getById(facility.id);
    const loadedAssignment = await database.assignments.getById(assignment.id);

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

if (require.main === module) {
  void main();
}

export default main;
