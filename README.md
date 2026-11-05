# Test Infrastructure Platform

This is Jose Ramirez's personal portfolio project built to demonstrate test infrastructure skills. It combines a small PostgreSQL task app with containers, local Kubernetes, browser and mobile tests, and local AI test drafting with a human review gate. Local verification and the first successful hosted GitHub Actions run are documented below.

[![CI](https://github.com/jsayram/test-infrastructure-platform/actions/workflows/ci.yml/badge.svg)](https://github.com/jsayram/test-infrastructure-platform/actions/workflows/ci.yml)

## Problem

A test setup is hard to trust if a fresh checkout behaves differently from the developer's machine. This project starts with a versioned runtime, a known health response, and commands to start, test, and stop the app. The app stays small so the infrastructure and the evidence it produces are easy to inspect.

## Architecture overview

Docker Compose runs an Nginx web client, a Node.js API, and PostgreSQL. The browser uses same-origin API requests through the web proxy. SwiftUI and Kotlin clients call the same API from local simulators and emulators. kind runs two API replicas behind a Service. Terraform defines a separate AWS health demo using ECS Fargate. See [ARCHITECTURE.md](ARCHITECTURE.md) for the request and verification flows.

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
| [Playwright](https://github.com/microsoft/playwright/releases/tag/v1.64.1) | 1.64.1 | Runs the four browser journeys. |
| [PostgreSQL](https://www.postgresql.org/support/versioning/) | 17.11 | Pinned for the local database and the AWS demo. |
| Xcode and iOS Simulator | 27.1 and 26.5 | Builds and runs the SwiftUI client locally. |
| Gradle, Android Gradle Plugin, Kotlin | 8.13, 8.13.2, 2.2.21 | Builds the Android client with SDK 35 for an API 32 emulator. |
| Temurin JDK and Maestro | 21.0.11+10 and 2.11.0 | Runs the shared local mobile journey. |
| Ollama | 0.40.11 | Drafts with a pinned local Llama 3.2 digest documented in the eval runbook. |

The frontend uses plain HTML and JavaScript. Health-only mode has no third party runtime dependencies. The full app runs with Docker and PostgreSQL.

## Run the full app locally

Clone the public repository, install the pinned Node and Docker tools, and start the stack with a disposable password for a fresh database volume.

```sh
git clone https://github.com/jsayram/test-infrastructure-platform.git
cd test-infrastructure-platform
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

## Browser and mobile tests

Keep Compose running on loopback and use the pinned Node version. Install Chromium and run the browser suite.

```sh
npm ci --ignore-scripts
npx --no-install playwright install chromium
npm run test:e2e
npm run test:e2e:report
```

Playwright uses two workers and one disposable workspace per test. The four journeys cover create, complete, delete, and recovery from a failed API call. See `playwright-report/index.html` for the HTML report and `test-results/playwright.json` for raw outcomes and retry attempts. The dashboard at `.local/playwright/dashboard.md` adds a row per recorded run and averages hosted Playwright runner duration when hosted reports are imported. Import a downloaded hosted report with `npm run test:e2e:report -- path/to/playwright.json`. Use `CI=true npm run test:e2e` locally to exercise the retry settings. It still records a local run.

See the [mobile runbook](tests/mobile/README.md) for building and testing both apps with the same Maestro 2.11.0 journey. The iOS and Android apps use simulator or emulator addresses to reach the Compose API.

## AI drafts, humans verify, metrics decide

The local model proposes a constrained test recipe. The renderer uses shared page objects and a fresh synthetic workspace. The eval runs the candidate against the healthy app and a controlled regression, then scores execution, intended behavior, selector stability, and cleanup.

The actual completion draft scored 3/4 because it checked only that the title stayed visible. The worked revision checked Completed and scored 4/4. The candidate remains in review until a person approves its exact evaluated digest. See the [full worked example](tests/ai-evals/worked-example.md) and [generator, eval, and review commands](tests/ai-evals/README.md).

## Local verification results

The final verification used the pinned tools on macOS on November 5, 2026. Health-only startup and teardown, lint, workflow syntax, container builds, and the checks below passed. The local stack uses disposable data. Final proof containers, volumes, kind cluster, port forward, simulator, and emulator were removed.

| Check | Observed result | Reproduce or inspect |
| --- | --- | --- |
| Node unit tests | 7 passed, 0 failed | `npm test` |
| Compose smoke | CRUD, cross-user isolation, persistence after API restart passed | `npm run smoke -- --restart-api` |
| Terraform | Format and validate passed, 3 mock plans passed | [AWS runbook](infra/terraform/README.md) |
| Kubernetes | 2 API replicas ready, pod replacement and Service smoke passed | [kind runbook](infra/kubernetes/README.md) |
| Playwright | 4 passed, 0 failed, 0 flaky, 0 retries in the latest real run | `playwright-report/index.html`, `test-results/playwright.json` |
| Mobile | iOS 1/1 passed in 25.47 s, Android 1/1 passed in 34.56 s, both with persisted state | [mobile runbook](tests/mobile/README.md) |
| AI eval | Draft 3/4, worked revision 4/4, both cleanup checks passed | [worked example](tests/ai-evals/worked-example.md) |

The latest recorded local Playwright runner duration was 1.18 seconds. Earlier real local runs were 3.48, 1.28, and 1.22 seconds, all with four passing tests and zero flakes. A separate temporary retry probe confirmed one retry and failure screenshot and trace capture. It was removed before the real suite was rerun. The dashboard labels source and counts every attempt. The first hosted Playwright run passed all four cases with zero failures, flakes, or retries in 2.70 seconds. The local dashboard includes this imported hosted result.

To demo the project, start Compose, open a disposable workspace, and create and complete a task. Run the browser suite and inspect its report. Then use the kind runbook to delete an API pod and observe the replacement, or the mobile runbook to run the same task journey on a simulator.

## CI and scope

The [CI workflow](.github/workflows/ci.yml) runs on every push. It runs ESLint and Node tests, builds the containers, runs the Compose smoke test, runs Playwright with one retry and uploads the reports and failure screenshots, and validates Terraform with the mocked plan tests. The commands passed locally and in the [first hosted CI run](https://github.com/jsayram/test-infrastructure-platform/actions/runs/42081253333). The run verified source commit `514a3a8`. GitHub recorded 1 minute 31 seconds from run start to completion, with the app job taking 1 minute 26 seconds and the parallel Terraform job 17 seconds. These are measurements from one hosted run.

Download the [Playwright report artifact](https://github.com/jsayram/test-infrastructure-platform/actions/runs/42081253333/artifacts/13440093704) to inspect its HTML report, raw JSON, and dashboard. GitHub requires sign-in to download artifacts. The workflow retains artifacts for seven days. Regenerate reports with the documented commands after they expire.

This is an independent personal project built to demonstrate test infrastructure skills. The local app, Docker Compose, and Kubernetes checks use synthetic data. The AWS stack is defined and validated locally. Live planning, deployment, and teardown require account access and approval. Local verification has zero cloud cost. The browser suite and mobile automation use the local stack. AI evals run against the local stack and the pinned local model.

## Review in five minutes

With the pinned prerequisites installed and images available, use the full local startup commands above, then check the following.

- [ ] Open the web app, create a disposable workspace, and create and complete a task.
- [ ] Run `npm test` and `npm run smoke -- --restart-api` to check API behavior and persistence.
- [ ] Run `npm run test:e2e` and inspect the [generated browser report](playwright-report/index.html).
- [ ] Inspect the [Kubernetes manifests](infra/kubernetes/app.yaml), [Terraform configuration](infra/terraform), and their reproducible runbooks.
- [ ] Read the [actual AI draft and revised candidate](tests/ai-evals/worked-example.md), then inspect the [human promotion gate](tests/ai-evals/README.md#human-review-gate).
- [ ] Read the [two-minute walkthrough](docs/interview-walkthrough.md) and [personal-project resume bullets](docs/resume-bullets.md).
- [ ] Tear down the Compose stack with `docker compose down --volumes`.

The first tool and image downloads take additional time. The browser report is generated locally and is ignored by Git. The [CI workflow](.github/workflows/ci.yml), [successful hosted run](https://github.com/jsayram/test-infrastructure-platform/actions/runs/42081253333), and [downloadable report](https://github.com/jsayram/test-infrastructure-platform/actions/runs/42081253333/artifacts/13440093704) provide public verification links.

## Honest scope and future work

The app is for synthetic test data, and the workspace name flow provides no authentication. The local Kubernetes proof uses one kind node and two API replicas. The browser suite runs four critical journeys with two workers. Mobile proof comes from local simulator and emulator runs. These measurements describe the environment that was actually exercised.

The AWS resources have been validated with mock plans. A real account-backed plan, apply, endpoint check, and destroy remain pending account and cost approval. The public repository and hosted CI are available on GitHub. Future extensions include authenticated shared environments, multi-node recovery exercises, measured CI sharding, whole-workflow runtime collection, and longer report history.

The repository keeps separate native build files and runbooks so each platform can be reproduced independently. Generated dependencies, build products, reports, environment files, and Terraform state stay outside Git.

## License

[MIT](LICENSE)
