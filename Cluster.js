require("dotenv").config();

const cluster = require("node:cluster");

const $      = require("./Modules/Logger.js");

if (cluster.isPrimary) {
    cluster.fork();
  
    cluster.on("exit", (worker, code, signal) => {
        if (process.env.SAFE_MODE != "false") {
            $("&cProcess stopped, restarting...");
            cluster.fork();
        }
    });
}

if (cluster.isWorker) {
    require("./Main.js");
}