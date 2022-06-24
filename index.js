import express from "express";
import cors from "cors";
import chalk from "chalk";
import dotenv from "dotenv";
import { MongoClient } from "mongodb";
import joi from "joi";

dotenv.config();
const server = express();
server.use([cors(), express.json()]);

const client = new MongoClient(process.env.MONGO_URI);
let db;

client.connect().then(() => {
  db = client.db("batePapoUol");
});

//TODO: Tirar essa variavel global e por no banco de dados
// const participants = [];

server.post("/participants", async (req, res) => {
  try {
    const participant = req.body;
    participant.lastStatus = Date.now();

    await db.collection("participants").insertOne(participant);

    res.sendStatus(201);
  } catch (error) {
    console.error(error);
    res.sendStatus(500);
  }
});

server.get("/participants", async (req, res) => {
  try {
    const participants = await db.collection("participants").find().toArray();

    res.send(participants);
  } catch (error) {
    console.error(error);
    res.sendStatus(500);
  }
});

server.listen(5000, () => {
  console.log(chalk.bold.green("Rodando..."));
});
