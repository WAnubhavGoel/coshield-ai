import app from "./app.js";

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`   CoShield AI Enterprise Compliance Server       `);
  console.log(`   Listening on port: ${PORT}                      `);
  console.log(`   Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`==================================================`);
});

const gracefulShutdown = () => {
  server.close(() => {
    process.exit(0);
  });
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);
