require("dotenv").config();

import cluster from "node:cluster";

import $ from "./modules/logger";

if (cluster.isPrimary) {
  cluster.fork();

  cluster.on("exit", (worker, code, signal) => {
    if (process.env.SAFE_MODE != "false") {
      setTimeout(() => {
        $("&cProcess stopped, restarting in 3 seconds...");
        cluster.fork();
      }, 3000);
    }
  });
}

if (cluster.isWorker) {
  require("./index");
}
