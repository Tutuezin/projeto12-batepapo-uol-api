import express from "express";
import cors from "cors";
import chalk from "chalk";
import dotenv from "dotenv";
import { MongoClient } from "mongodb";
import joi from "joi";
import dayjs from "dayjs";

//CONFIGS
dotenv.config();
const server = express();
server.use([cors(), express.json()]);

//DATABASE
const client = new MongoClient(process.env.MONGO_URI);
let db;
client.connect().then(() => {
  console.log(chalk.bold.yellow("Conectado ao DataBase..."));
  db = client.db("batePapoUol");
});

//SCHEMA
const participantSchema = joi.object({
  name: joi.string().required(),
});

const messageSchema = joi.object({
  to: joi.string().required(),
  text: joi.string().required(),
  type: joi.string().valid("private_message", "message").required(),
});

//PARTICIPANTS
async function checkCadastre(req, res, next) {
  const participant = req.body;

  const validation = participantSchema.validate(participant, {
    abortEarly: false,
  });

  if (validation.error) {
    res.sendStatus(422);
    return;
  }

  const participantExists = await db
    .collection("participants")
    .findOne({ name: participant.name });

  if (participantExists) {
    res.sendStatus(409);
    return;
  }

  next();
}

server.post("/participants", checkCadastre, async (req, res) => {
  const participant = req.body;

  const enterRoom = {
    from: participant.name,
    to: "Todos",
    text: "entra na sala...",
    type: "status",
    time: dayjs().format("HH:mm:ss"),
  };

  participant.lastStatus = Date.now();

  try {
    await db.collection("participants").insertOne(participant);
    await db.collection("messages").insertOne(enterRoom);

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

//MESSAGES

async function checkMessage(req, res, next) {
  const message = req.body;
  const username = req.header("User");

  const validation = messageSchema.validate(message, {
    abortEarly: false,
  });

  if (validation.error) {
    res.sendStatus(422);
    return;
  }

  const participantExists = await db
    .collection("participants")
    .findOne({ name: username });

  if (!participantExists) {
    res.sendStatus(422);
    return;
  }

  next();
}

server.post("/messages", checkMessage, async (req, res) => {
  const message = req.body;
  const username = req.header("User");

  const sendMessage = {
    from: username,
    ...message,
    time: dayjs().format("HH:mm:ss"),
  };

  await db.collection("messages").insertOne(sendMessage);

  res.sendStatus(201);

  console.log(username);
});

server.get("/messages", async (req, res) => {
  const { limit } = req.query;
  const messages = await db.collection("messages").find().toArray();

  if (limit) {
    const messagesFiltradas =
      limit < messages.length
        ? messages.splice(messages.length - limit)
        : messages;
    return res.send(messagesFiltradas);
  }

  try {
    res.send(messages);
  } catch (error) {
    console.error(error);
    res.sendStatus(500);
  }
});

server.listen(5000, () => {
  console.log(chalk.bold.green("Rodando..."));
});
