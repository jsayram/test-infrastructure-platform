# Local Kubernetes demo

Use Docker Engine 29.9.2, Buildx 0.38.1, [kind 0.32.0](https://github.com/kubernetes-sigs/kind/releases/tag/v0.32.0), and [kubectl 1.36.1](https://kubernetes.io/docs/tasks/tools/). The pinned kind image runs Kubernetes 1.36.1. This demo uses one kind node, two API replicas, one web pod, and one PostgreSQL pod. The database uses kind's local persistent volume. It survives API pod replacement but is deleted with the cluster.

Run the following from the repository root in a dedicated shell. The temporary kubeconfig keeps the commands separate from other clusters.

```sh
tip_kind_dir="$(mktemp -d)"
export KUBECONFIG="$tip_kind_dir/kubeconfig"
kind create cluster --name tip-demo \
  --image kindest/node:v1.36.1@sha256:3489c7674813ba5d8b1a9977baea8a6e553784dab7b84759d1014dbd78f7ebd5 \
  --wait 120s

docker build -f apps/api/Dockerfile -t tip-api:local .
docker build -f apps/web/Dockerfile -t tip-web:local .
kind load docker-image tip-api:local tip-web:local --name tip-demo

kubectl create namespace tip-demo
(umask 077; printf 'POSTGRES_PASSWORD=%s\n' "$(openssl rand -hex 24)" > "$tip_kind_dir/db.env")
kubectl -n tip-demo create secret generic db-password --from-env-file="$tip_kind_dir/db.env"
rm "$tip_kind_dir/db.env"
kubectl -n tip-demo create configmap db-schema --from-file=apps/api/schema.sql
kubectl -n tip-demo apply -f infra/kubernetes/app.yaml

kubectl -n tip-demo rollout status deployment/db --timeout=150s
kubectl -n tip-demo rollout status deployment/api --timeout=120s
kubectl -n tip-demo rollout status deployment/web --timeout=60s
kubectl -n tip-demo get pods,pvc
kubectl -n tip-demo logs -l app=api --tail=10
```

PostgreSQL initializes a fresh volume from the SQL ConfigMap. The app ConfigMap supplies nonsecret connection settings. The generated Secret provides the disposable local database password. The API's readiness probe checks that it can query the schema. Its liveness probe checks that Node can serve HTTP.

Forward only the web Service on loopback. Keep this command running in its shell while you open http://127.0.0.1:8081/ or run the smoke test in another shell.

```sh
kubectl -n tip-demo port-forward --address 127.0.0.1 service/web 8081:8080
```

```sh
BASE_URL=http://127.0.0.1:8081 npm run smoke
```

## Verify API pod replacement

Stop the port forward to return to the dedicated shell, or use its temporary kubeconfig from a second shell. Delete one API pod and compare the names before and after. The replacement gets a new name, the surviving pod keeps its name, and both current pods become ready.

```sh
kubectl -n tip-demo get pods -l app=api
api_pod="$(kubectl -n tip-demo get pods -l app=api -o jsonpath='{.items[0].metadata.name}')"
kubectl -n tip-demo delete "pod/$api_pod"
kubectl -n tip-demo wait --for=condition=Ready pod -l app=api --timeout=90s
kubectl -n tip-demo get pods -l app=api
```

## Roll out a new image

Build and load a new tag before changing the Deployment. Kubernetes replaces the pods and waits for readiness. The API Service address stays the same.

```sh
image_tag="$(git rev-parse --short HEAD)"
docker build -f apps/api/Dockerfile -t "tip-api:$image_tag" .
kind load docker-image "tip-api:$image_tag" --name tip-demo
kubectl -n tip-demo set image deployment/api "api=tip-api:$image_tag"
kubectl -n tip-demo rollout status deployment/api --timeout=120s
```

If startup fails, inspect the events and logs with `kubectl -n tip-demo describe pod POD_NAME` and `kubectl -n tip-demo logs POD_NAME`. An image error usually means the Deployment tag differs from the tag loaded into kind. A failed API readiness probe usually points to database connectivity, the generated Secret, or the schema on the volume.

## Teardown

Stop the port forward with Ctrl+C and run the following in the dedicated shell. Deleting the kind cluster removes its demo database.

```sh
kind delete cluster --name tip-demo --kubeconfig "$KUBECONFIG"
rm -f "$KUBECONFIG"
rmdir "$tip_kind_dir"
exit
```

References are available in the official [kind quick start](https://kind.sigs.k8s.io/docs/user/quick-start/), [Deployment documentation](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/), and [probe documentation](https://kubernetes.io/docs/concepts/workloads/pods/probes/).
