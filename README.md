# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.


## MySQL boilerplate

The database helper in `scripts/mysql.js` is intended for a Node.js server or
API layer, not for importing into the Expo client. Configure these environment
variables before using it:

```text
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your-password
MYSQL_DATABASE=calendar
MYSQL_CONNECTION_LIMIT=10
```

```js
const database = require("./scripts/mysql");

await database.testConnection();
await database.createTables();
const assignments = await database.assignments.list("main facility");
await database.closeDatabase();
```

## Admin API

The Expo client cannot import the Node-only `mysql2` driver directly. Start the
database API in a separate terminal before opening the admin screen:

```bash
npm run api
npx expo start
```

Android emulators use `http://10.0.2.2:3000` by default. For a physical device,
set `EXPO_PUBLIC_API_URL` to the computer's LAN address before starting Expo.

The helper uses parameterized queries. Store hashed passwords in `users.password`
before calling `users.create` or `users.update`.
