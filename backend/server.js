import app from "./app.js";
import "./services/worker.js";

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {

});

const gracefulShutdown = () => {
  server.close(() => {
    process.exit(0);
  });
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);
