# Test Infrastructure Platform

This is Jose Ramirez's personal portfolio project for test infrastructure. The local foundation gives the infrastructure and test work a small, repeatable service to exercise.

## Problem

A test setup is hard to trust if a fresh checkout behaves differently from the developer's machine. This project starts with a versioned runtime, a known health response, and commands to start, test, and stop the app. The app stays small so the infrastructure and the evidence it produces are easy to inspect.

## Architecture overview

In the local workflow, one Node.js process listens on loopback. It serves the frontend at `/` and responds to `GET /health` with JSON. The browser calls the health endpoint on the same origin. The health response shows that the process can serve requests. Phase 1 adds a Terraform configuration for a temporary AWS deployment of that same service. See [ARCHITECTURE.md](ARCHITECTURE.md) for the request flow and boundaries.

## Tech stack and version pins

| Tool | Version | Scope |
| --- | --- | --- |
| [Node.js](https://nodejs.org/en/download/archive/v22.23.1) | 22.23.1 | Local HTTP server and built-in test runner. Pinned in `.nvmrc` and `package.json`. |
| [Terraform](https://releases.hashicorp.com/terraform/1.17.1/) | 1.17.1 | AWS infrastructure configuration and mock plans. |
| [Terraform AWS provider](https://github.com/hashicorp/terraform-provider-aws/tree/v6.64.0/website/docs) | 6.64.0 | AWS resource definitions. |
| [Docker](https://docs.docker.com/engine/release-notes/29/#2992) | 29.9.2 | Builds the demo image with Buildx 0.38.1. |
| [Playwright](https://github.com/microsoft/playwright/releases/tag/v1.64.1) | 1.64.1 | Planned for web end to end tests. |
| [PostgreSQL](https://www.postgresql.org/support/versioning/) | 17.11 | Pinned for RDS. Phase 2 adds app persistence. |

The frontend uses plain HTML and JavaScript. Phase 0 has no third party dependencies and requires no Python, database, or container engine. Docker and Terraform are needed only for the infrastructure workflow.

## Run locally

Use macOS or Linux with Bash and Node.js 22.23.1. If you have nvm, install and select the version from the repository root with `nvm install` and `nvm use`. The Node.js download linked above is another way to install the same version.

From the repository root:

```sh
./scripts/setup.sh
curl --fail --silent --show-error http://127.0.0.1:3000/health
npm test
./scripts/teardown.sh
```

Setup prints `Listening at http://127.0.0.1:3000`. Open that address before teardown and confirm the page displays **API is healthy.** The health command returns HTTP 200 and `{"status":"ok"}`. The unit tests cover the health response, unsupported methods, and access to paths outside the public routes. Expect three passing tests.

If port 3000 is in use, run `PORT=3100 ./scripts/setup.sh` and use port 3100 in the browser and health command. You can also copy `.env.example` to `.env` and set `PORT` there. The server binds only to `127.0.0.1`. The same teardown command works with either port.

## AWS demo

Terraform defines a VPC, private ECR repository, one ECS Fargate task, private RDS PostgreSQL instance, private S3 artifact bucket, and scoped execution IAM. ECS Fargate provides the cloud container proof without maintaining EC2 workers. A local Kubernetes cluster will demonstrate replicas and rollouts without the cost of an EKS control plane.

The [AWS runbook](infra/terraform/README.md) includes credential-free validation, both real plan commands, image publishing and deployment instructions, a cost breakdown, and teardown. For the default sizes, the illustrative N. Virginia estimate is about $0.035 per hour before credits and usage-based charges. The AWS account and actual region determine coverage and rates. The demo teardown command is `terraform -chdir=infra/terraform destroy -var='resolve_api_url=false'`.

## Honest scope

This is an independent personal project built to demonstrate test infrastructure skills. The local health app, unit tests, and lifecycle scripts are implemented. The AWS stack is defined in Terraform for local validation and review. Live planning, deployment, and teardown require account access and approval. Local verification has zero cloud cost. Kubernetes, CI, browser and mobile suites, and AI evals are future work. There are no measured scale or CI results yet.

## Future work

- **Phase 2.** Add task and user CRUD, PostgreSQL persistence, API and web container builds, local Kubernetes, and CI.
- **Phase 3.** Add Playwright critical journey tests, retry and timing reports, and iOS and Android apps with mobile tests.
- **Phase 4.** Add AI assisted test drafting, an eval harness, and a human review gate.
- **Phase 5.** Add the interview walkthrough, personal project resume bullets, and a reviewer checklist backed by actual results.

The `.gitkeep` files preserve directories for later phases. The workflow and interview files will be added when they have working content.

## License

[MIT](LICENSE)
