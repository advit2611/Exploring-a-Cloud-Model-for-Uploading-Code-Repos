const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const mime = require("mime-types");
const Redis = require("ioredis");

const publisher = new Redis(
  "rediss://default:AVNS_4-C4hF49AxftNHDFaJB@redis-2f0074d3-advit214-ea63.a.aivencloud.com:19639"
);

const s3Client = new S3Client({
  region: "us-east-1",
  credentials: {
    accessKeyId: "AKIA6FC6O5YWGDLGRIX4",
    secretAccessKey: "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",
  },
});

const PROJECT_ID = process.env.PROJECT_ID;

function publishLog(log) {
  publisher.publish(`logs:${PROJECT_ID}`, JSON.stringify({ log }));
}

async function init() {
  console.log("Executing script.js");
  publishLog("Build Started...");
  const outDirPath = path.join(__dirname, "output");

  const p = exec(`cd ${outDirPath} && npm install && npm run build`);

  p.stdout.on("data", function (data) {
    console.log(data.toString());
    publishLog(data.toString());
  });

  p.stdout.on("error", function (data) {
    console.log("Error", data.toString());
    publishLog(`Error: ${data.toString()}`);
  });

  p.on("close", async function () {
    console.log("Build Complete!!!");
    publishLog("Build Complete");
    const distFolderPath = path.join(__dirname, "output", "dist");
    const distFolderPathConents = fs.readdirSync(distFolderPath, {
      recursive: true,
    });

    publishLog("Starting to Upload");

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
  });
}

init();
