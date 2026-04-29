# Hello World Full-Stack App on K3s

A production-like full-stack Hello World:

- **Backend:** Java 17 + Spring Boot 3 (Maven), REST endpoint `GET /api/hello`
- **Frontend:** React 18 served by Nginx; proxies `/api/*` to the backend via K8s Service DNS
- **Containerization:** Multi-stage Dockerfiles for both services
- **Orchestration:** K3s (single-node), `ClusterIP` for backend, `NodePort 30080` for frontend

---

## Folder Structure

```
hello-world-app/
├── backend/
│   ├── src/
│   │   └── main/
│   │       ├── java/com/example/helloworld/
│   │       │   ├── HelloWorldApplication.java
│   │       │   └── controller/
│   │       │       └── HelloController.java
│   │       └── resources/
│   │           └── application.properties
│   ├── pom.xml
│   ├── .dockerignore
│   └── Dockerfile
│
├── frontend/
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── App.js
│   │   ├── App.css
│   │   ├── index.js
│   │   └── index.css
│   ├── package.json
│   ├── nginx.conf
│   ├── .dockerignore
│   └── Dockerfile
│
├── k8s/
│   ├── backend-deployment.yaml
│   └── frontend-deployment.yaml
│
└── README.md
```

---

## How Frontend Talks to Backend

The React app runs in the **user's browser**, so it cannot resolve the in-cluster DNS name `backend-service` directly. To satisfy the requirement that the frontend communicates with the backend using the Kubernetes Service name `backend-service:8080`, the frontend container runs **Nginx**, which:

1. Serves the built React static files on port `3000`.
2. Reverse-proxies any request to `/api/*` to `http://backend-service:8080` **from inside the cluster** (where DNS resolves).

The React code simply calls `/api/hello` (same-origin) — Nginx forwards it to the backend Service. See `frontend/nginx.conf`.

---

## Prerequisites

- A Linux VM with K3s installed (single-node is fine).
- `kubectl` configured to talk to the cluster (K3s writes its config to `/etc/rancher/k3s/k3s.yaml`).
- Docker installed on the same VM (for building images).

> If you haven't installed K3s yet:
> ```bash
> curl -sfL https://get.k3s.io | sh -
> sudo chmod 644 /etc/rancher/k3s/k3s.yaml
> export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
> kubectl get nodes
> ```

---

## Step 1 — Build the Docker Images

From the project root (`hello-world-app/`):

```bash
# Backend image
docker build -t backend-app:latest ./backend

# Frontend image
docker build -t frontend-app:latest ./frontend
```

Verify:

```bash
docker images | grep -E "backend-app|frontend-app"
```

---

## Step 2 — Load Images into K3s

K3s uses **containerd**, not Docker, so images built with `docker build` must be imported into K3s's containerd image store. Export each image as a tar and import it with `k3s ctr`:

```bash
# Save and import backend
docker save backend-app:latest -o backend-app.tar
sudo k3s ctr images import backend-app.tar

# Save and import frontend
docker save frontend-app:latest -o frontend-app.tar
sudo k3s ctr images import frontend-app.tar
```

Verify the images are now visible to K3s:

```bash
sudo k3s ctr images ls | grep -E "backend-app|frontend-app"
```

> The manifests use `imagePullPolicy: IfNotPresent` so Kubernetes will use the locally imported image and will **not** try to pull from a remote registry.

---

## Step 3 — Apply the Kubernetes Manifests

```bash
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/frontend-deployment.yaml
```

(Or apply the whole folder at once: `kubectl apply -f k8s/`)

---

## Step 4 — Verify Pods and Services

```bash
kubectl get pods -o wide
kubectl get deployments
kubectl get svc
```

Expected output (names/IPs will differ):

```
NAME                                  READY   STATUS    RESTARTS   AGE
backend-deployment-xxxxxxxxxx-xxxxx   1/1     Running   0          30s
frontend-deployment-xxxxxxxxxx-xxxxx  1/1     Running   0          30s

NAME               TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)          AGE
backend-service    ClusterIP   10.43.x.x       <none>        8080/TCP         30s
frontend-service   NodePort    10.43.x.x       <none>        3000:30080/TCP   30s
kubernetes         ClusterIP   10.43.0.1       <none>        443/TCP          10m
```

Tail logs if a pod is not ready:

```bash
kubectl logs -l app=backend --tail=100
kubectl logs -l app=frontend --tail=100
kubectl describe pod -l app=backend
```

---

## Step 5 — Test the Backend from Inside the Cluster

```bash
kubectl run curl --rm -it --image=curlimages/curl --restart=Never -- \
  curl -s http://backend-service:8080/api/hello
```

You should see:

```
Hello from Java Backend running on K3s
```

---

## Step 6 — Access the Frontend in a Browser

Find the VM's IP:

```bash
hostname -I | awk '{print $1}'
```

Then open:

```
http://<VM_IP>:30080
```

You should see the **"React Frontend on K3s"** page displaying the backend message:

> *Hello from Java Backend running on K3s*

Also works directly against the backend API through the frontend's proxy:

```
http://<VM_IP>:30080/api/hello
```

---

## Useful Commands

```bash
# Watch pods
kubectl get pods -w

# Roll out a new image (after rebuilding + re-importing)
kubectl rollout restart deployment/backend-deployment
kubectl rollout restart deployment/frontend-deployment

# Port-forward (alternative to NodePort)
kubectl port-forward svc/frontend-service 3000:3000

# Tear everything down
kubectl delete -f k8s/
```

---

## Troubleshooting

| Symptom                                                       | Likely cause / fix                                                                                                      |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Pods stuck in `ErrImagePull` / `ImagePullBackOff`             | Image wasn't imported into K3s. Re-run `sudo k3s ctr images import <image>.tar`.                                         |
| Frontend loads but shows *"Error: Network Error"*             | Backend pod not ready yet, or Service name mismatch. Check `kubectl get svc` — it must be named exactly `backend-service`. |
| Cannot reach `http://<VM_IP>:30080`                           | Firewall. Open the port: `sudo ufw allow 30080/tcp` (or equivalent).                                                     |
| Backend `/api/hello` works from inside cluster but not browser| Hit the frontend URL (`:30080`), not the backend — the browser cannot resolve `backend-service`. That's by design.       |
