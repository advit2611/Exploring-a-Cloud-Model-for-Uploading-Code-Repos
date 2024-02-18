### Cloud model to store code repositories on S3

- This repository is an implementaion of a Cloud project that does following tasks
    - Makes a Docker Image that is uploaded to AWS ECR
    - The Docker Image run tasks in an AWS ECR Cluster
    - The Image contains a script which takes the github url and clones to store in a given key to AWS S3
    - There is also an implementation of reverse proxy to get objects from AWS S3
    - Added api-server that helps in serving post requests to an ECS task
