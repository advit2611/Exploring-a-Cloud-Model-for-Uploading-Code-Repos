const express = require("express");
const { generateSlug } = require("random-word-slugs");
const { ECSClient, RunTaskCommand } = require("@aws-sdk/client-ecs");
const { Server } = require("socket.io");
const { z } = require("zod");
const { PrismaClient } = require("@prisma/client");
const { createClient } = require("@clickhouse/client");
const { Kafka } = require("kafkajs");
const { v4: uuid } = require("uuid");
const fs = require("fs");
const path = require("path");

const io = new Server({ cors: "*" });

const prisma = new PrismaClient();

const kafka = new Kafka({
  clientId: `api-server`,
  brokers: ["kafka-199061c3-advit214-ea63.a.aivencloud.com:19651"],
  ssl: { ca: [fs.readFileSync(path.join(__dirname, "kafka.pem"), "utf-8")] },
  sasl: {
    username: "avnadmin",
    password: "AVNS_D8D3Gm2lfaiMRRGv0Va",
    mechanism: "plain",
  },
});

const clickHouseClient = createClient({
  host: "https://clickhouse-1a88e59b-advit214-ea63.a.aivencloud.com:19639",
  database: "default",
  username: "avnadmin",
  password: "AVNS_2g6i7e1-NpqZUjecpyE",
});

const consumer = kafka.consumer({
  groupId: "api-server-logs-consumer",
});

io.on("connection", (socket) => {
  socket.on("subscribe", (channel) => {
    socket.join(channel);
    socket.emit("message", `Joined ${channel}`);
  });
});

io.listen(9001, () => console.log(`Socket Server 9001 Started`));

const app = express();
PORT = 9000;

const ecsClient = new ECSClient({
  region: "us-east-1",
  credentials: {
    accessKeyId: "AKIA6FC6O5YWGDLGRIX4",
    secretAccessKey: "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",
  },
});

const config = {
  CLUSTER: "arn:aws:ecs:us-east-1:973008203308:cluster/builder-cluster",
  TASK: "arn:aws:ecs:us-east-1:973008203308:task-definition/builder-task",
};

app.use(express.json());

app.post("/project", async (req, res) => {
  const schema = z.object({
    name: z.string(),
    gitURL: z.string(),
  });
  const safePassResult = schema.safeParse(req.body);
  if (safePassResult.error)
    return res.status(404).json({ error: safePassResult.error });
  const { name, gitURL } = req.body;
  const project = await prisma.project.create({
    data: {
      name,
      gitURL,
      subDomain: generateSlug(),
    },
  });
  return res.json({ status: "success", data: { project } });
});

app.post("/deploy", async (req, res) => {
  const { projectId } = req.body;

  const project = await prisma.project.findUnique({ where: { id: projectId } });

  if (!project) return res.status(404).json({ error: "Project Not found !!!" });

  const deployment = await prisma.deployments.create({
    data: {
      project: { connect: { id: projectId } },
      status: "QUEUED",
    },
  });

  // Spin up a new task
  const command = new RunTaskCommand({
    cluster: config.CLUSTER,
    taskDefinition: config.TASK,
    launchType: "FARGATE",
    count: 1,
    networkConfiguration: {
      awsvpcConfiguration: {
        assignPublicIp: "ENABLED",
        subnets: [
          "subnet-0efb62d80568ba061",
          "subnet-00b7cffe8e864d1f0",
          "subnet-0153856fb676d833b",
        ],
        securityGroups: ["sg-0a09f5f8da1a0d1d5"],
      },
    },
    overrides: {
      containerOverrides: [
        {
          name: "builder-image",
          environment: [
            { name: "GIT_REPOSITORY_URL", value: project.gitURL },
            { name: "PROJECT_ID", value: projectId },
            { name: "DEPLOYMENT_ID", value: deployment.id },
          ],
        },
      ],
    },
  });
  await ecsClient.send(command);

  return res.json({
    staus: "queued",
    data: { deploymentId: deployment.id },
  });
});

app.get("/logs/:id", async (req, res) => {
  const id = req.params.id;
  const logs = await clickHouseClient.query({
    query: `SELECT event_id, deployment_id, log, timestamp \
            FROM log_events\
            WHERE deployment_id = {deployment_id : String}`,
    query_params: {
      deployment_id: id,
    },
    format: "JSONEachRow",
  });
  const rawLogs = await logs.json();
  return res.json({ logs: rawLogs });
});

async function initKafkaConsumer() {
  await consumer.connect();
  await consumer.subscribe({
    topics: ["container-logs"],
    fromBeginning: true,
  });

  await consumer.run({
    eachBatch: async function ({
      batch,
      heartbeat,
      commitOffsetsIfNecessary,
      resolveOffset,
    }) {
      const messages = batch.messages;
      console.log(`Recieved ${messages.length} messages ...`);
      for (const message of messages) {
        const stringMessages = message.value.toString();
        const { PROJECT_ID, DEPLOYMENT_ID, log } = JSON.parse(stringMessages);
        console.log({ log, DEPLOYMENT_ID });
        const { queryId } = await clickHouseClient.insert({
          table: "log_events ",
          values: [
            { event_id: uuid(), deployment_id: DEPLOYMENT_ID, log: log },
          ],
          format: "JSONEachRow",
        });
        resolveOffset(message.offset);
        await commitOffsetsIfNecessary(message.offset);
        await heartbeat();
      }
    },
  });
}

initKafkaConsumer();

app.listen(PORT, () => console.log(`API Server Started...${PORT}!!!`));
