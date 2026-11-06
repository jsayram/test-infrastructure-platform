# Test Infrastructure Platform

[![CI](https://github.com/jsayram/test-infrastructure-platform/actions/workflows/ci.yml/badge.svg)](https://github.com/jsayram/test-infrastructure-platform/actions/workflows/ci.yml)

Jose Ramirez's personal portfolio project demonstrating reproducible test environments, CI, browser and mobile automation, and evaluation of AI-generated tests. This is independent personal work, not Abbott production work.

The application is a small task manager with a web UI and native iOS and Android clients. Open a synthetic workspace, create a task, mark it complete, and delete it on the web. The infrastructure around those actions is the focus: repeatable containers, isolated test data, useful failure evidence, local Kubernetes recovery, and a human gate for AI drafts.

**Start here:** [Requirements](#what-you-need) | [Run the app](#run-the-full-app-locally) | [Run tests](#browser-and-unit-tests) | [Clean up](#stop-and-clean-up) | [Demo](#review-in-five-minutes) | [Verified results](#verification-results)

## Problem

A passing test is useful when another engineer can reproduce its environment and understand what it actually checked. This project makes the environment, tests, and evidence inspectable in one repository. A code change goes through lint, unit tests, real container builds, API smoke tests, and four browser journeys in GitHub Actions.

The public repository shares source and CI evidence. The application itself runs locally; there is no hosted public app and no AWS deployment requirement.

## Architecture overview

The default demo runs three services with Docker Compose. Only the web service is published on the host, bound to loopback. PostgreSQL and the API stay on the container network.

```text
Browser / Playwright ----+
                        |
iOS Simulator ----------+--> 127.0.0.1:8080
                        |         |
Android Emulator -------+         v
  via 10.0.2.2:8080        Nginx web container
                          serves HTML + JavaScript
                          proxies /api, /health, /ready
                                  |
                                  v
                           Node.js API container
                                  |
                                  v
                           PostgreSQL container
                                  |
                                  v
                           Named database volume
```

Local Kubernetes is a separate deployment of the same images. The [kind runbook](infra/kubernetes/README.md) uses one node, a web pod, two API replicas behind a Service, and PostgreSQL with a persistent volume claim. A port forward exposes its web Service on `127.0.0.1:8081`. Deleting one API pod demonstrates replacement while the other replica remains ready.

```text
Push to GitHub
     |
     +--> App job: lint -> unit tests -> build containers
     |                              -> Compose smoke + API restart
     |                              -> Playwright -> report artifact
     |
     +--> Terraform job: fmt -> init -> validate -> 3 mocked plans

Local optional demos: kind recovery | iOS/Android + Maestro | AI evals
Terraform configuration: local validation only; no AWS resources created
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for API routes and implementation details. CI tests container images; it does not deploy them to AWS or Kubernetes.

## What you need

For the web demo and browser tests:

- macOS or Linux, a shell with Bash, Git, `curl`, and `openssl`. The full local verification ran on macOS; core CI runs on Ubuntu 24.04. Native Windows execution has not been verified.
- Node.js **22.23.1** with its bundled npm. [Install the pinned Node release](https://nodejs.org/en/download/archive/v22.23.1), or use an existing nvm installation with the commands below. This repository does not install nvm.
- A running Docker Engine **29.9.2**, Compose **5.6.1**, and Buildx **0.38.1**. Confirm with `docker version`, `docker compose version`, and `docker buildx version`.
- Internet access for the first dependency, container-image, and Chromium downloads. The initial setup takes longer than the prepared demo.

PostgreSQL and Nginx run in containers; no host database installation is needed. No AWS account, cloud credentials, paid AI API, or device farm is needed. Optional tools are listed below; install only those needed for the demo you choose.

## Tech stack and version pins

| Tool | Version | What it does here |
| --- | --- | --- |
| Node.js / plain HTML and JavaScript | 22.23.1 | API, web UI, scripts, and built-in unit test runner. |
| Docker / Buildx / Compose | 29.9.2 / 0.38.1 / 5.6.1 | Build separate API and web images; start the local stack. |
| PostgreSQL / node-postgres / Nginx | 17.11 / 8.23.0 / 1.30.6 | Persist tasks, query the database, and serve/proxy the web UI. |
| ESLint / Playwright | 10.14.0 / 1.64.1 | Lint source and test four browser journeys. |
| kind / kubectl / Kubernetes | 0.32.0 / 1.36.1 / 1.36.1 | Exercise two API replicas, recovery, and rollouts locally. |
| Terraform / AWS provider | 1.17.1 / 6.64.0 | Validate the AWS infrastructure configuration with mocked plans. |
| SwiftUI / Xcode / iOS Simulator | Xcode 27.1 / iOS 26.5 | Native iOS task client and local simulator proof. |
| Gradle / Android Gradle Plugin / Kotlin | 8.13 / 8.13.2 / 2.2.21 | Build the native Android task client. |
| Android SDK / Build Tools / test emulator | 35 / 35.0.0 / API 32 | Compile Android and run the local mobile journey. |
| Temurin JDK / Maestro | 21.0.11+10 / 2.11.0 | Run one shared create/complete/reopen flow on both mobile platforms. |
| Ollama / local Llama 3.2 | 0.40.11 / pinned model digest | Draft constrained test recipes without a paid model API. |

Runtime and package pins are in `.nvmrc`, `package.json`, and the lockfile. Container base images and CI actions use immutable digests or commit SHAs. Native build pins and the exact model digest are in their linked runbooks. Python is not required.

## Run the full app locally

From a fresh checkout, select Node 22.23.1 and install dependencies. If using nvm, run `nvm install` and `nvm use` after entering the repository; otherwise select the pinned Node installation yourself.

```sh
git clone https://github.com/jsayram/test-infrastructure-platform.git
cd test-infrastructure-platform
node --version
npm ci --ignore-scripts
export POSTGRES_PASSWORD="$(openssl rand -hex 24)"
docker compose up --build --wait
curl --fail --silent --show-error http://127.0.0.1:8080/health
```

Expect `v22.23.1` from Node and `{"status":"ok"}` from the health endpoint. `docker compose ps` should show the database, API, and web services healthy. `curl -fsS http://127.0.0.1:8080/ready` also checks database readiness.

Open **http://127.0.0.1:8080/** and use the UI:

1. Enter a synthetic demo name and select **Continue** to create or reopen its workspace.
2. Enter a task title and select **Add task**.
3. Select **Complete** or **Reopen**, then **Delete** to remove a task.
4. Select **Switch workspace** to return to workspace entry. Use **Check API health** to inspect the API status.

The demo name selects test data and provides no authentication. Use synthetic names and tasks only. Reopening a workspace reloads its persisted tasks.

Run the API smoke check while Compose remains up:

```sh
npm run smoke -- --restart-api
```

It verifies CRUD, cross-workspace task isolation, and persistence after restarting the API. Keep Compose running while you use the demo and run browser tests. Keep this shell and its disposable database password for smoke checks and teardown.

If port 8080 is occupied, export `WEB_PORT=8082` and `BASE_URL=http://127.0.0.1:8082` before starting Compose and running tests. The mobile runbook uses the default port 8080. For startup problems, inspect `docker compose ps` and `docker compose logs --tail=50 api db web`; verify Docker is running and the password is set.

## Browser and unit tests

Run from the repository root. Unit tests do not need a running database. Browser and smoke tests require the Compose stack above.

```sh
npm run lint
npm test
npx --no-install playwright install chromium
npm run test:e2e
npm run test:e2e:report
```

On Linux, use `npx --no-install playwright install --with-deps chromium` for missing browser system libraries; installing those OS packages may require administrator access. The recorded suite has four journeys: create, complete, delete, and recover from an API error. Page objects share role and label selectors. Two workers use a fresh synthetic workspace per test and remove it afterward.

Inspect these generated local files; they are ignored by Git:

| File | Contents |
| --- | --- |
| `playwright-report/index.html` | Browser test report; open it locally. |
| `test-results/playwright.json` | Outcomes, runtime, and retry attempts. |
| `.local/playwright/dashboard.md` | Run history, pass/fail/flake counts, and timing averages. |

CI retries a failed browser test once and retains failure screenshots and traces. `CI=true npm run test:e2e` exercises that retry setting locally and still records a local run. A retry is recorded rather than silently counted as an initial pass.

### Import completed CI timing

The dashboard separates Playwright runner time from completed workflow elapsed time. GitHub CLI (`gh`) and GitHub sign-in are needed only to download hosted artifacts. Choose a successful completed run whose `playwright-results` artifact has not expired and an empty download directory. This example uses the verified main run.

```sh
RUN_ID=42104343998
RUN_DIR=".local/hosted-ci/$RUN_ID"
mkdir -p "$RUN_DIR"
gh run download "$RUN_ID" --repo jsayram/test-infrastructure-platform \
  --name playwright-results --dir "$RUN_DIR"
gh run view "$RUN_ID" --repo jsayram/test-infrastructure-platform \
  --json databaseId,url,headSha,startedAt,updatedAt,status,conclusion,jobs > "$RUN_DIR/run.json"
npm run test:e2e:report -- "$RUN_DIR/test-results/playwright.json" \
  .local/playwright/history.json .local/playwright/dashboard.md "$RUN_DIR/run.json"
```

The optional final argument verifies hosted provenance, workflow URL and ID, commit SHA, completed state, and timestamps. Workflow elapsed time is completed-run `updatedAt - startedAt`, including setup, parallel jobs, and cleanup. Averages count each workflow ID once using its newest metadata. The in-workflow artifact contains runner timing; add full elapsed time after completion. Existing report-only imports still work, and reimporting without metadata preserves previously imported workflow timing.

## Stop and clean up

After the demo and tests, run these commands in the same shell used to start Compose:

```sh
docker compose down --volumes
unset POSTGRES_PASSWORD
```

This deletes the demo database volume. Plain `docker compose down` retains the volume and requires its original password on the next startup. Real `.env` files are ignored; [`.env.example`](.env.example) contains placeholders only.

## Optional demos and requirements

| Demo | Additional tools and instructions |
| --- | --- |
| Local Kubernetes | Install kind and kubectl versions above. The [kind runbook](infra/kubernetes/README.md) covers deployment, pod deletion/recovery, logs, image rollout, and cluster teardown. |
| iOS | macOS, Xcode 27.1, iOS 26.5 runtime, Maestro, and JDK. The [mobile runbook](tests/mobile/README.md#ios) builds a simulator target without signing and removes the dedicated simulator afterward. |
| Android | JDK, Gradle, Android SDK and emulator, and Maestro. The [mobile runbook](tests/mobile/README.md#android) covers SDK paths, APK installation, create/complete proof, and emulator shutdown. |
| AI test drafting | Ollama 0.40.11 with the exact local model digest, Chromium, and Compose. Follow the [AI runbook](tests/ai-evals/README.md) to generate, evaluate, review, and preview promotion. |
| Terraform | Terraform 1.17.1; no AWS credentials required for the local commands below. See the [infrastructure runbook](infra/terraform/README.md#verify-without-aws-access). |

### Health-only mode

For the original API health proof without Docker or a database, use Node 22.23.1 and Bash from the repository root:

```sh
./scripts/setup.sh
curl --fail --silent --show-error http://127.0.0.1:3000/health
./scripts/teardown.sh
```

Open `http://127.0.0.1:3000/` before teardown to see the health UI. This mode does not support persistent task workspaces. Use `PORT=3100 ./scripts/setup.sh` if port 3000 is occupied, then probe port 3100. The same teardown command stops it.

### Terraform without deployment

```sh
terraform -chdir=infra/terraform init -backend=false -input=false
terraform -chdir=infra/terraform fmt -check -recursive
terraform -chdir=infra/terraform validate
terraform -chdir=infra/terraform test
```

Terraform defines VPC networking, ECR, ECS Fargate, private RDS PostgreSQL, S3, and scoped IAM. These checks download the pinned provider and use simulated AWS values; they create no cloud resources. Live AWS planning and deployment are outside the requested project scope and have not been run. The retained runbook describes a possible cloud health demo, not evidence of an executed deployment. Fargate was chosen for that design to avoid an EKS control plane; Kubernetes proof runs locally with kind. Local verification incurs no cloud charges.

## AI drafts, humans verify, metrics decide

The local model selects a constrained journey and observation. A deterministic renderer supplies the shared page objects and isolated workspace fixture. Evaluation checks execution, intended behavior under a controlled regression, selector stability, and cleanup.

The actual draft scored **3/4**: its assertion checked that a task stayed visible and missed a broken completion response. The worked revision checked **Completed** and scored **4/4**. Neither was silently added to the main suite. The candidate remains outside the suite until a person reviews and approves its exact evaluated digest. Read the full [worked example](tests/ai-evals/worked-example.md) and [human review gate](tests/ai-evals/README.md#human-review-gate).

## Verification results

The following evidence was recorded on November 5, 2026. The [successful main CI run](https://github.com/jsayram/test-infrastructure-platform/actions/runs/42104343998) verified commit `4181ae8`. Hosted and local results are labeled separately.

| Check | Observed result | Evidence or reproduction |
| --- | --- | --- |
| Lint and unit tests | Hosted CI passed; 14 unit tests, 0 failed. | `npm run lint` and `npm test` |
| Compose | Hosted builds and CRUD/isolation/persistence smoke passed. | `npm run smoke -- --restart-api` |
| Playwright | Hosted: 4 passed, 0 failed, 0 flaky, 0 retries; 2.04 s runner time. | [Browser report artifact](https://github.com/jsayram/test-infrastructure-platform/actions/runs/42104343998/artifacts/13452180286) |
| Terraform | Hosted format and validate passed; 3 mocked plans passed. | Local commands above and the CI Terraform job. |
| Kubernetes | Local: 2 API replicas ready; deleted pod replaced; Service smoke and rollout passed. | [kind runbook](infra/kubernetes/README.md) |
| Mobile | Local: iOS 1/1 in 25.47 s; Android 1/1 in 34.56 s; persisted state verified. | [Mobile runbook](tests/mobile/README.md) |
| AI eval | Local: draft 3/4, worked revision 4/4; cleanup checks passed. | [Actual worked example](tests/ai-evals/worked-example.md) |

The main workflow elapsed **88 seconds**, including setup and cleanup. Four imported hosted runs averaged **235.25 seconds** of whole-workflow elapsed time and **2.10 seconds** of Playwright runtime. One slow run spent most of its time downloading Ubuntu font packages. These are a small observed sample, not throughput or large-scale reliability claims. The latest recorded local browser run took 1.18 seconds.

GitHub requires sign-in to download artifacts and retains them for seven days. After expiry, regenerate reports locally or use a newer successful run. The [CI workflow](.github/workflows/ci.yml) runs on every push, uploads HTML/JSON reports and failure evidence, and tears down its Compose stack. Mobile and Kubernetes proofs are local and are not represented as hosted CI runs.

## Review in five minutes

With the pinned tools installed and images/Chromium downloaded:

- [ ] Open the [repository](https://github.com/jsayram/test-infrastructure-platform) and [green CI run](https://github.com/jsayram/test-infrastructure-platform/actions/runs/42104343998).
- [ ] Start Compose, open the web UI, and create, complete, and delete a synthetic task.
- [ ] Run `npm test` and `npm run smoke -- --restart-api` to show checks and persistence.
- [ ] Run `npm run test:e2e` and inspect the generated `playwright-report/index.html` locally.
- [ ] Pick one deeper example: pod replacement, the mobile flow, or the AI regression that exposed a weak assertion.
- [ ] Use the [two-minute walkthrough](docs/interview-walkthrough.md) and [personal-project resume bullets](docs/resume-bullets.md) for interview preparation.
- [ ] Clean up with `docker compose down --volumes`, then `unset POSTGRES_PASSWORD`. Follow optional demo teardown too.

## Repository guide

```text
apps/                  API, web UI, SwiftUI and Kotlin clients
infra/terraform/       AWS configuration and mocked tests
infra/kubernetes/      Local kind manifests and recovery runbook
tests/playwright/      Browser journeys, page objects and reporting
tests/mobile/          Shared Maestro flow and local runner
tests/ai-evals/        Local generation, evaluation and human gate
.github/workflows/     Push-triggered CI
scripts/               Health setup/teardown and API smoke checks
docs/                  Interview walkthrough and project resume bullets
```

## Honest scope and future work

This is a personal demonstration using synthetic data. The workspace name flow has no authentication. Kubernetes proof uses one local node and two API replicas; browser proof uses four journeys and two workers. Native mobile proof uses local simulators/emulators. Terraform validation with mocks does not prove AWS permissions, regional availability, or deployment. No live AWS deployment is needed to use or demonstrate this project.

Future work includes authenticated shared environments, multi-node recovery exercises, measured CI sharding, and longer report history. This repository makes no claims of production cloud operations or scale that was not exercised. `.gitignore` excludes real environment files, dependencies, reports, native builds, and Terraform state/plans. Never add credentials or real user data.

## License

[MIT](LICENSE)
