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

//SCHEMAS
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
  try {
    const message = req.body;
    const username = req.header("User");

    const sendMessage = {
      from: username,
      ...message,
      time: dayjs().format("HH:mm:ss"),
    };
    await db.collection("messages").insertOne(sendMessage);

    res.sendStatus(201);
  } catch (error) {
    console.error(error);

    res.sendStatus(500);
  }
});

server.get("/messages", async (req, res) => {
  try {
    const { limit } = req.query;
    const username = req.header("User");
    const messages = await db.collection("messages").find().toArray();

    const privateMessages = messages.filter((msg) => {
      if (msg.to === "Todos" || msg.to === username || msg.from === username)
        return true;
      return false;
    });

    if (limit) {
      const messagesFiltradas =
        limit < privateMessages.length
          ? privateMessages.splice(privateMessages.length - limit)
          : privateMessages;
      return res.send(messagesFiltradas);
    }

    res.send(privateMessages);
  } catch (error) {
    console.error(error);

    res.sendStatus(500);
  }
});

//STATUS
async function checkParticipant(req, res, next) {
  const username = req.header("User");

  const participantExists = await db
    .collection("participants")
    .findOne({ name: username });

  if (!participantExists) {
    res.sendStatus(404);
    return;
  }

  next();
}

server.post("/status", checkParticipant, async (req, res) => {
  try {
    const username = req.header("User");

    const lastStatus = await db
      .collection("participants")
      .findOne({ name: username });

    await db.collection("participants").updateOne(
      {
        name: username,
      },
      {
        $set: { lastStatus: Date.now() },
      }
    );

    res.sendStatus(200);
  } catch (error) {
    console.error(error);

    res.sendStatus(500);
  }
});

//AUTOMATIC REMOVAL OF PARTICIPANT
setInterval(async () => {
  const checkStatus = Date.now();
  const participants = await db.collection("participants").find().toArray();

  participants.forEach(async (element) => {
    const leaveRoom = {
      from: element.name,
      to: "Todos",
      text: "sai da sala...",
      type: "status",
      time: dayjs().format("HH:mm:ss"),
    };

    if (checkStatus - element.lastStatus > 10000) {
      await db.collection("participants").deleteOne({ _id: element["_id"] });
      await db.collection("messages").insertOne(leaveRoom);
    }
  });
}, 15000);

server.listen(5000, () => {
  console.log(chalk.bold.green("Rodando..."));
});
