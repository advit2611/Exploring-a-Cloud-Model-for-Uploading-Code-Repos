const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const mime = require("mime-types");

const s3Client = new S3Client({
  region: "us-east-1",
  credentials: {
    accessKeyId: "AKIA6FC6O5YWGDLGRIX4",
    secretAccessKey: "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",
  },
});

const PROJECT_ID = process.env.PROJECT_ID;

async function init() {
  console.log("Executing script.js");
  const outDirPath = path.join(__dirname, "output");

  const p = exec(`cd ${outDirPath} && npm install && npm run build`);

  p.stdout.on("data", function (data) {
    console.log(data.toString());
  });

  p.stdout.on("error", function (data) {
    console.log("Error", data.toString());
  });

  p.on("close", async function () {
    console.log("Build Complete!!!");
    const distFolderPath = path.join(__dirname, "output", "dist");
    const distFolderPathConents = fs.readdirSync(distFolderPath, {
      recursive: true,
    });
    for (const filePath of distFolderPathConents) {
      const file = path.join(distFolderPath, filePath)
      if (fs.lstatSync(file).isDirectory()) continue;

      console.log("Uploading", file);

      const command = new PutObjectCommand({
        Bucket: "vercel-clone-advit",
        Key: `__outputs/${PROJECT_ID}${file}`,
        ContentType: mime.lookup(file),
        Body: fs.createReadStream(file),
      });

      await s3Client.send(command);
      console.log("Uploaded", file);
    }
    console.log("Done...");
  });
}

init();
