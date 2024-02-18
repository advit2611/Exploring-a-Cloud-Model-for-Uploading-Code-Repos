const express = require("express");
const { generateSlug } = require("random-word-slugs");
const { ECSClient, RunTaskCommand } = require("@aws-sdk/client-ecs");

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
  const { gitURL } = req.body;
  const projectSlug = generateSlug();

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
            { name: "GIT_REPOSITORY_URL", value: gitURL },
            { name: "PROJECT_ID", value: projectSlug },
          ],
        },
      ],
    },
  });
  await ecsClient.send(command);

  return res.json({ staus: "queued", data: { projectSlug, url: `http://${projectSlug}.localhost:8080` } });
});

app.listen(PORT, () => console.log(`API Server Started...${PORT}!!!`));
