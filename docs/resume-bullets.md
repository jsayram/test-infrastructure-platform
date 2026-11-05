# Personal project resume bullets

These bullets describe Test Infrastructure Platform as a personal project. Pair them with the repository and the local verification evidence in the README.

- Built a personal test infrastructure project with pinned Terraform and AWS provider versions, defining a VPC, ECS Fargate service, ECR, private RDS PostgreSQL, S3, and scoped IAM, with three passing mocked plan tests.
- Containerized a PostgreSQL-backed Node API and web client with separate multi-stage Docker images, verifying user and task CRUD, cross-workspace isolation, and task persistence across an API restart.
- Deployed the personal-project app on local Kubernetes with two API replicas and demonstrated automatic pod replacement while retaining database state.
- Built four Playwright critical-journey tests with parallel execution, isolated data, page objects, retry evidence, HTML reports, and a run-history dashboard, with all four tests passing locally and in GitHub Actions.
- Built SwiftUI and Kotlin clients for the same API and ran a shared Maestro flow on local iOS and Android devices to verify task creation, completion, and persistence after app relaunch.
- Evaluated a local-model Playwright draft against a healthy app and a controlled regression, identifying a missed completion assertion at 3/4 and verifying a revised review candidate at 4/4 before human promotion.

The AWS deployment remains pending. The [first hosted GitHub Actions run](https://github.com/jsayram/test-infrastructure-platform/actions/runs/42081253333) passed for source commit `514a3a8`. Keep the local mobile and Kubernetes scope explicit when discussing this project.
