"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv").config();
const node_cluster_1 = __importDefault(require("node:cluster"));
const logger_1 = __importDefault(require("./modules/logger"));
if (node_cluster_1.default.isPrimary) {
    node_cluster_1.default.fork();
    node_cluster_1.default.on("exit", (worker, code, signal) => {
        if (process.env.SAFE_MODE != "false") {
            setTimeout(() => {
                (0, logger_1.default)("&cProcess stopped, restarting in 3 seconds...");
                node_cluster_1.default.fork();
            }, 3000);
        }
    });
}
if (node_cluster_1.default.isWorker) {
    require("./index");
}
