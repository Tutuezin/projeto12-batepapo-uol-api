import express from "express";
import cors from "cors";
import chalk from "chalk";

const server = express();
server.use([cors(), express.json()]);

server.listen(5000, () => {
  console.log(chalk.bold.green("Rodando..."));
});
