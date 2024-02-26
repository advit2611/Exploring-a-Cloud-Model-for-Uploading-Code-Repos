const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const mime = require("mime-types");
const { Kafka } = require("kafkajs");

// Create S3 Client for uploads
const s3Client = new S3Client({
  region: "us-east-1",
  credentials: {
    accessKeyId: "AKIA6FC6O5YWGDLGRIX4",
    secretAccessKey: "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",
  },
});

const PROJECT_ID = process.env.PROJECT_ID;
const DEPLOYMENT_ID = process.env.DEPLOYMENT_ID;

const kafka = new Kafka({
  clientId: `docker-build-server-${DEPLOYMENT_ID}`,
  brokers: ["kafka-199061c3-advit214-ea63.a.aivencloud.com:19651"],
  ssl: { ca: [fs.readFileSync(path.join(__dirname, "kafka.pem"), "utf-8")] },
  sasl: {
    username: "avnadmin",
    password: "AVNS_D8D3Gm2lfaiMRRGv0Va",
    mechanism: "plain",
  },
});

const producer = kafka.producer();

async function publishLog(log) {
  await producer.send({
    topic: "container-logs",
    messages: [
      { key: "log", value: JSON.stringify({ PROJECT_ID, DEPLOYMENT_ID, log }) },
    ],
  });
}

async function init() {
  await producer.connect();

  console.log("Executing script.js");
  await publishLog("Build Started...");
  const outDirPath = path.join(__dirname, "output");

  const p = exec(`cd ${outDirPath} && npm install && npm run build`);

  p.stdout.on("data", async function (data) {
    console.log(data.toString());
    await publishLog(data.toString());
  });

  p.stdout.on("error", async function (data) {
    console.log("Error", data.toString());
    await publishLog(`Error: ${data.toString()}`);
  });

  p.on("close", async function () {
    console.log("Build Complete!!!");
    await publishLog("Build Complete");
    const distFolderPath = path.join(__dirname, "output", "dist");
    const distFolderPathConents = fs.readdirSync(distFolderPath, {
      recursive: true,
    });

    await publishLog("Starting to Upload");

    for (const file of distFolderPathConents) {
      const filePath = path.join(distFolderPath, file);
      if (fs.lstatSync(filePath).isDirectory()) continue;

      console.log("Uploading", file);
      publishLog(`Uploading ${file}`);
      const command = new PutObjectCommand({
        Bucket: "vercel-clone-advit",
        Key: `__outputs/${PROJECT_ID}/${file}`,
        ContentType: mime.lookup(filePath),
        Body: fs.createReadStream(filePath),
      });

      await s3Client.send(command);
      console.log("Uploaded", file);
      publishLog(`Uploaded ${file}`);
    }
    publishLog("Done");
    console.log("Done...");
    process.exit(0);
  });
}

init();
