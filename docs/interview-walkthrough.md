# Interview walkthrough

## Two-minute script

This is my personal test infrastructure project. I built a small task app so the repository could focus on reproducible environments, useful tests, and evidence someone else can inspect.

A clean checkout has pinned tools and commands to start the API, web, and PostgreSQL together. The smoke test creates disposable users and tasks, checks cross-workspace access, restarts the API, and verifies that the completed task is still in the database.

I used Terraform to describe the AWS resources and their dependencies because a reviewed plan makes infrastructure changes repeatable and visible. The stack defines ECS Fargate, ECR, RDS, S3, networking, and scoped IAM. Its formatting, validation, and three mocked plans pass locally. A real account-backed plan and deployment are pending.

For Kubernetes, I used kind locally. I deployed two API replicas, deleted one pod, and watched a new ready pod replace it while the other kept running. The database volume stayed bound. That demonstrates the desired-state controller and Service routing with a small, inspectable setup.

Playwright covers four journeys with page objects and one isolated workspace per test. The reports record failures, retries, flakes, and runner duration. The first hosted GitHub Actions run passed the app and Terraform jobs. The SwiftUI and Kotlin clients use the same API, and Maestro verifies create, complete, and persisted state on both local platforms.

The AI example uses a local model to draft a constrained test recipe. Its first candidate passed the healthy app but missed a completion regression and scored 3/4. The worked revision checked Completed and scored 4/4. It stays in review until a person approves the exact evaluated candidate. AI drafts, humans verify, metrics decide.

## Debugging evidence

- Terraform validation passed before the first mocked plan rejected an overlong S3 bucket prefix. I shortened the prefix and reran the plan tests. Syntax and schema validation alone had missed a value constraint.
- Kubernetes needed numeric UID and GID 1000 to verify the Node image's named user under runAsNonRoot. The API pods then became ready.
- Nginx's dynamic resolver needed the full Kubernetes Service DNS name. I kept the proxy address separate from the web image through configuration.
- A request could reach Docker's forwarded port before Node was ready. The smoke command uses bounded readiness checks, and the container probe uses bounded retries.
- A title-only AI assertion passed during a completion regression. The mutation result showed exactly which behavior the stronger assertion detects.

## Tradeoffs

The cloud demo uses Fargate to run the container and local kind for the Kubernetes proof. This keeps an EKS control plane out of the demo cost. The direct Fargate task IP can change on replacement, so the runbook includes address refresh and teardown steps.

The name-based workspace is for synthetic demo data and provides no authentication. PostgreSQL runs as one local instance. The local kind cluster has one node. The observed browser runtime measures the Playwright runner. The first hosted workflow took 1 minute 31 seconds. AWS deployment evidence still requires a separately authorized run.

## At ten times the workload

I would first measure queue time, browser worker saturation, database connections, and flake causes. I would then shard independent browser cases across CI workers, retain report history outside one runner, and keep deterministic fixtures per worker. Each API replica has a small connection pool, so I would size total connections against the database before adding replicas.

For a shared service, I would add authentication, TLS, controlled migrations, and an explicit environment lifecycle. I would test node loss and database recovery in an environment sized for that purpose, and review costs alongside the reliability goals.

## Show the evidence

Use the README's five-minute checklist, the Kubernetes and mobile runbooks, and the complete [AI worked example](../tests/ai-evals/worked-example.md). The local reports can be regenerated from the documented commands.
