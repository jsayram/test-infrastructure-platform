# Phase 1 AWS demo

This stack runs the project's existing health API on one Linux ARM64 Fargate task. RDS PostgreSQL and an S3 artifact bucket are provisioned independently of the API. The health probe checks HTTP only. The full local task app uses PostgreSQL in Compose and kind. The AWS demo does not pass database credentials to ECS.

The stack has two public subnets for ECS and two isolated database subnets across two availability zones. The task's public IPv4 address supports outbound HTTPS for image pulls and logs. Its inbound HTTP port allows one approved reviewer address. The database has no public address. Its only inbound rule allows PostgreSQL from the task security group. RDS creates and manages the master password in Secrets Manager. The app and Terraform never read the password.

The API image is stored in private ECR under an immutable Git SHA tag. The ECS execution role can pull from that repository and write to that task's CloudWatch log streams. ECR requires a wildcard resource for its authorization token call. The container has no task role or S3 access.

Official implementation references include the [pinned AWS provider documentation](https://github.com/hashicorp/terraform-provider-aws/tree/v6.64.0/website/docs), [Fargate networking](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/fargate-task-networking.html), [Fargate ARM64 availability](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/ecs-arm64.html), and [RDS password management](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/rds-secrets-manager.html).

## Verify without AWS access

Install [Terraform 1.17.1](https://releases.hashicorp.com/terraform/1.17.1/) and run these commands from the repository root.

```sh
terraform -chdir=infra/terraform init -backend=false -input=false
terraform -chdir=infra/terraform fmt -check -recursive
terraform -chdir=infra/terraform validate
terraform -chdir=infra/terraform test -verbose
```

The provider lockfile pins AWS provider 6.64.0 and records package checksums. Init downloads the provider. The test file substitutes a mock AWS provider, so its plan output describes Terraform's graph using simulated values. These checks verify the task size, the reviewer rule, the private database and bucket, the image tag policy, and the cleanup path. Local verification passed all three cases. The default mocked plan showed 27 to add, 0 to change, and 0 to destroy. A mocked plan cannot verify account permissions, region availability, AWS service quotas, or deployment.

To build and run the same container locally, use Docker 29.9.2 with Buildx 0.38.1. An ARM64 Docker engine can run it natively. An x86 engine needs ARM64 emulation.

```sh
docker build --platform linux/arm64 --provenance=false \
  -f apps/api/Dockerfile -t test-infrastructure-api:local .
docker run --rm -d --name test-infrastructure-api \
  -p 127.0.0.1:3100:3000 test-infrastructure-api:local
curl -fsS --retry 5 --retry-all-errors --max-time 3 http://127.0.0.1:3100/health
docker stop test-infrastructure-api
```

Expect `{"status":"ok"}`. The container listens on all its own interfaces. The Docker port mapping exposes it only on your machine. The regular setup script still binds directly to loopback.

## Review cost before AWS access

There is no AWS cost for the local checks. The following is an illustrative estimate for the default sizes in `us-east-1` before credits, not a choice of deployment region or a quote for your account. Prices checked on November 4, 2026.

| Item | Approximate rate |
| --- | --- |
| Fargate Linux ARM64, 0.25 vCPU and 0.5 GB | $0.0099 per task hour |
| One public IPv4 address | $0.005 per hour |
| RDS PostgreSQL db.t4g.micro, Single-AZ | $0.016 per instance hour |
| 20 GB of RDS gp3 storage | $2.30 per month, prorated |
| One RDS-managed secret | $0.40 per month, prorated |

The fixed portions total roughly $0.035 per hour, or $0.07 for two hours, before usage-based ECR storage, CloudWatch logs, S3 requests and storage, Secrets Manager requests, CPU credits, and data transfer. Provisioning, teardown, minimum billing periods, and account terms affect actual charges. Verify the selected region's rates and the account's coverage first. If a strict $0 limit applies, proceed only when coverage is confirmed. Destroy the demo immediately after verification.

Rates come from [Fargate pricing](https://aws.amazon.com/fargate/pricing/), [VPC pricing](https://aws.amazon.com/vpc/pricing/), the [AWS RDS N. Virginia public price list](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonRDS/current/us-east-1/index.json), and [Secrets Manager pricing](https://aws.amazon.com/secrets-manager/pricing/). Account coverage depends on [AWS Free Tier terms](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/free-tier.html).

## Prepare a real plan

Use these steps only after the account and region are approved. Set `AWS_PROFILE` to your authorized AWS CLI v2 profile. Sign in locally through your account's approved workflow. Use a clean project commit so the image tag identifies the source that was built. Set the following values in the same shell from the repository root and replace the sample region and IPv4 with the approved values. Never copy credentials into Terraform variables or the repository.

```sh
export AWS_PROFILE='approved-profile'
export TF_VAR_aws_region='approved-region'
export TF_VAR_project_name='test-infrastructure-platform'
export TF_VAR_reviewer_cidr='192.0.2.10/32'
export TF_VAR_api_image_tag="$(git rev-parse HEAD)"
export AWS_DEFAULT_REGION="$TF_VAR_aws_region"
export AWS_REGION="$TF_VAR_aws_region"

aws sts get-caller-identity
aws rds describe-orderable-db-instance-options --engine postgres \
  --engine-version 17.11 --db-instance-class db.t4g.micro \
  --query 'OrderableDBInstanceOptions[].DBInstanceClass'

terraform -chdir=infra/terraform init -input=false
terraform -chdir=infra/terraform plan -input=false \
  -target=aws_ecr_repository.api -out=ecr.tfplan
terraform -chdir=infra/terraform show -no-color ecr.tfplan
terraform -chdir=infra/terraform plan -input=false -out=demo.tfplan
terraform -chdir=infra/terraform show -no-color demo.tfplan
```

The PostgreSQL check must return the selected instance class in the selected region. Stop if the identity, region, class availability, plan, or cost differs from what was approved. Review both plan outputs before applying anything. On an empty state, the bootstrap plan should create only ECR. The full plan should create the stack and defer the API address lookup until the task is running.

Keep the plan files and local Terraform state on your machine. The repository ignores them. They contain infrastructure details and can be sensitive even when passwords are managed by AWS.

## Run the approved demo

First apply the ECR bootstrap plan after review and approval. The scoped target creates the registry before the service tries to pull the image.

```sh
terraform -chdir=infra/terraform apply ecr.tfplan
repository="$(aws ecr describe-repositories \
  --repository-names "$TF_VAR_project_name-api" \
  --query 'repositories[0].repositoryUri' --output text)"
registry="${repository%%/*}"
image="$repository:$TF_VAR_api_image_tag"
aws ecr get-login-password | docker login --username AWS --password-stdin "$registry"
docker build --platform linux/arm64 --provenance=false \
  -f apps/api/Dockerfile -t "$image" .
docker push "$image"
docker logout "$registry"
```

Regenerate the main plan because the bootstrap changed state. Review the new plan before applying it. The ECR resource should now be present with no changes.

```sh
terraform -chdir=infra/terraform plan -input=false -out=demo.tfplan
terraform -chdir=infra/terraform show -no-color demo.tfplan
```

After approval of the deployment plan, apply it and probe from the allowed reviewer address.

```sh
terraform -chdir=infra/terraform apply demo.tfplan
api_url="$(terraform -chdir=infra/terraform output -raw api_url)"
curl -fsS --max-time 10 "$api_url/health"
```

Expect HTTP 200 with `{"status":"ok"}`. The database output is the private DNS name, and the artifact output is the S3 bucket name. The API URL points directly to the running task. It can change on task replacement. If it stops responding after a replacement, run and review `terraform -chdir=infra/terraform plan -refresh-only` to see the current address. This simple HTTP endpoint is suitable only for a temporary health demo using synthetic data.

## Tear down

Run this from the same checkout and shell after the demo, including when deployment fails after bootstrap. Disable the address lookup so teardown works without a running API task.

```sh
terraform -chdir=infra/terraform destroy -var='resolve_api_url=false'
terraform -chdir=infra/terraform state list
```

Review the destroy prompt and confirm it for this demo only. An empty state list confirms Terraform tracks no remaining resources. Check the selected region for remaining demo resources if Terraform reports a deletion error. The demo deletes ECR images and S3 objects and skips the RDS final snapshot. Use disposable demo data only. AWS can retain inactive task definition records and account-level service-linked roles. These are separate from the running tasks and storage that the teardown removes.
