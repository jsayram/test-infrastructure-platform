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
| [Docker](https://docs.docker.com/engine/release-notes/29/#2992) | 29.9.2 | Builds the API and web images with Buildx 0.38.1. |
| [Docker Compose](https://github.com/docker/compose/releases/tag/v5.6.1) | 5.6.1 | Runs the three local services. |
| [kind](https://github.com/kubernetes-sigs/kind/releases/tag/v0.32.0) and kubectl | 0.32.0 and 1.36.1 | Runs and inspects local Kubernetes 1.36.1. |
| [node-postgres](https://github.com/brianc/node-postgres) and [Nginx](https://nginx.org/) | 8.23.0 and 1.30.6 | Connects to PostgreSQL and serves the web UI. |
| [ESLint](https://eslint.org/) | 10.14.0 | Checks the Node and browser code. |
| [Playwright](https://github.com/microsoft/playwright/releases/tag/v1.64.1) | 1.64.1 | Planned for web end to end tests. |
| [PostgreSQL](https://www.postgresql.org/support/versioning/) | 17.11 | Pinned for the local database and the AWS demo. |

The frontend uses plain HTML and JavaScript. Health-only mode has no third party runtime dependencies. The full app runs with Docker and PostgreSQL.

## Run the full app locally

Install the pinned Node and Docker tools. Start the stack from the repository root with a disposable password for a fresh database volume.

```sh
nvm install
nvm use
npm ci --ignore-scripts
export POSTGRES_PASSWORD="$(openssl rand -hex 24)"
docker compose up --build --wait
npm run smoke -- --restart-api
```

Open http://127.0.0.1:8080/. Enter a demo name to open its workspace, then create, complete, and delete a task. Use synthetic names only. The demo name selects a test workspace without authentication. The web service is the only service published on the host, and it binds to loopback. The smoke test exercises the same HTTP API, checks that a task ID cannot be accessed through a different user route, and checks that a completed task survives an API restart.

Stop the stack from the same shell with the same database password. This command deletes the demo volume.

```sh
docker compose down --volumes
unset POSTGRES_PASSWORD
```

A plain `docker compose down` retains the database volume and expects the same password on the next startup. Use the generated password only on your machine. If you save it in a local `.env` file, Git ignores that file. Use `WEB_PORT=8082` to select another host port and `BASE_URL=http://127.0.0.1:8082` when you run the smoke test.

See the [Kubernetes runbook](infra/kubernetes/README.md) for deployment, logs, API pod replacement, image updates, and cluster teardown.

## Health-only mode

Use macOS or Linux with Bash and Node.js 22.23.1. If you have nvm, install and select the version from the repository root with `nvm install` and `nvm use`. The Node.js download linked above is another way to install the same version.

Run these commands from the repository root.

```sh
./scripts/setup.sh
curl --fail --silent --show-error http://127.0.0.1:3000/health
npm test
./scripts/teardown.sh
```

Setup prints `Listening at http://127.0.0.1:3000`. Open that address before teardown and confirm the page displays **API is healthy.** The health command returns HTTP 200 and `{"status":"ok"}`. The unit tests cover the health response, the public route boundary, and the data API input and ownership rules. Expect seven passing tests. The task workspace needs the Compose or Kubernetes database.

If port 3000 is in use, run `PORT=3100 ./scripts/setup.sh` and use port 3100 in the browser and health command. You can also copy `.env.example` to `.env` and set `PORT` there. The setup script binds only to `127.0.0.1`. The same teardown command works with either port.

## AWS demo

Terraform defines a VPC, private ECR repository, one ECS Fargate task, private RDS PostgreSQL instance, private S3 artifact bucket, and scoped execution IAM. ECS Fargate provides the cloud container proof without maintaining EC2 workers. The local kind cluster demonstrates replicas and rollouts without the cost of an EKS control plane.

The [AWS runbook](infra/terraform/README.md) includes credential-free validation, both real plan commands, image publishing and deployment instructions, a cost breakdown, and teardown. For the default sizes, the illustrative N. Virginia estimate is about $0.035 per hour before credits and usage-based charges. The AWS account and actual region determine coverage and rates. The demo teardown command is `terraform -chdir=infra/terraform destroy -var='resolve_api_url=false'`.

## CI and scope

The [CI workflow](.github/workflows/ci.yml) runs on every push. It runs ESLint and Node tests, builds the containers, runs the Compose smoke test, and validates Terraform with the mocked plan tests. The same commands were verified locally. A hosted GitHub Actions run remains pending.

This is an independent personal project built to demonstrate test infrastructure skills. The local app, Docker Compose, and Kubernetes checks use synthetic data. The AWS stack is defined and validated locally. Live planning, deployment, and teardown require account access and approval. Local verification has zero cloud cost. The web browser suite, mobile automation, and AI evals are future phases.

## Future work

- **Phase 3.** Add Playwright critical journey tests, retry and timing reports, and iOS and Android apps with mobile tests.
- **Phase 4.** Add AI assisted test drafting, an eval harness, and a human review gate.
- **Phase 5.** Add the interview walkthrough, personal project resume bullets, and a reviewer checklist backed by actual results.

The `.gitkeep` files preserve directories for later phases. The workflow and interview files will be added when they have working content.

## License

[MIT](LICENSE)
