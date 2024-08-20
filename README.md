### Cloud model to store code repositories on S3

- This repository is an implementaion of a Cloud project that does following tasks
    - Makes a Docker Image that is uploaded to AWS ECR
    - The Docker Image run tasks in an AWS ECR Cluster
    - The Image contains a script which takes the github url and clones to store in a given key to AWS S3

    - There is also an implementation of reverse proxy to get objects from AWS S3
    - Added api-server that helps in serving post requests to an ECS task
      
- This Branch implements the Database integeration with Prisma which hosts a PostgresSQL on aivan.io
    - The prisma has 2 Schemas
        - 1 Schema for storing Projects stats
        - 1 Schema for Deployments with a foreign key to Projects table
    - Other Table for Real time logs are implemented via clickhouse
        - These logs are polled from kafka hosted in aivan.io
        - The api-server acts as a consumer and build-server has docker image that runs to act as a producer
     
![vercel-clone](https://github.com/user-attachments/assets/3ba29284-3950-4417-8fe1-88f823afe1aa)
