# Test Infrastructure Platform

This is Jose Ramirez's personal portfolio project for test infrastructure. Phase 0 runs entirely on your machine. The first milestone gives later infrastructure and test work a small, repeatable service to build on.

## Problem

A test setup is hard to trust if a fresh checkout behaves differently from the developer's machine. This project starts with a versioned runtime, a known health response, and commands to start, test, and stop the app. The app stays small so the infrastructure and the evidence it produces are easy to inspect.

## Architecture overview

One Node.js process listens on loopback. It serves the frontend at `/` and responds to `GET /health` with JSON. The browser calls the health endpoint on the same origin. The health response shows that the process can serve requests. See [ARCHITECTURE.md](ARCHITECTURE.md) for the request flow and boundaries.

## Tech stack and version pins

| Tool | Version | Scope |
| --- | --- | --- |
| [Node.js](https://nodejs.org/en/download/archive/v22.23.1) | 22.23.1 | Local HTTP server and built-in test runner. Pinned in `.nvmrc` and `package.json`. |
| [Terraform](https://releases.hashicorp.com/terraform/1.17.1/) | 1.17.1 | Planned for the AWS phase. |
| [Docker](https://docs.docker.com/engine/release-notes/29/#2993) | 29.9.3 | Planned for container builds. |
| [Playwright](https://github.com/microsoft/playwright/releases/tag/v1.64.1) | 1.64.1 | Planned for web end to end tests. |
| [PostgreSQL](https://www.postgresql.org/support/versioning/) | 17.11 | Planned for local persistence and RDS, subject to availability in the selected AWS region. |

The frontend uses plain HTML and JavaScript. Phase 0 has no third party dependencies and requires no Python, database, or container engine. The planned pins identify target releases for later phases. Those tools are not exercised in Phase 0.

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

## Honest scope

This is an independent personal project built to demonstrate test infrastructure skills. The implemented scope is the local health endpoint, web page, unit tests, and lifecycle scripts. The current phase has zero cloud cost. AWS, Kubernetes, CI, browser and mobile suites, and AI evals are future work. There are no measured scale or CI results yet.

## Future work

- **Phase 1.** Use Terraform to demonstrate deployment on AWS ECS Fargate with RDS. Review the plan, cost estimate, and destroy procedure before applying anything.
- **Phase 2.** Add task and user CRUD, PostgreSQL persistence, Docker images, local Kubernetes, and CI. ECS Fargate will provide the cloud deployment proof. A local Kubernetes cluster will demonstrate replicas and rollouts without the cost of an EKS control plane.
- **Phase 3.** Add Playwright critical journey tests, retry and timing reports, and iOS and Android apps with mobile tests.
- **Phase 4.** Add AI assisted test drafting, an eval harness, and a human review gate.
- **Phase 5.** Add the interview walkthrough, personal project resume bullets, and a reviewer checklist backed by actual results.

The `.gitkeep` files preserve directories for later phases. The workflow and interview files will be added when they have working content.

## License

[MIT](LICENSE)
