# Frontend Docker And K8s Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the `frontend` Next.js app into a production Docker image and add Kubernetes manifests for Deployment, Service, and Ingress, using `default.conf` as the source of proxy routing requirements.

**Architecture:** Run the app as a single `Next.js standalone` container on port `3000`. Keep Nginx out of the application Pod. Translate the `/defaultApi/` and `/scp-product/defaultApi/` proxy intent from `default.conf` into Kubernetes Ingress rules. Add a lightweight health endpoint so probes do not depend on a full UI page.

**Tech Stack:** Next.js 16, React 19, pnpm, Docker multi-stage build, Kubernetes Deployment/Service/Ingress.

---

### Task 1: Enable Standalone Next.js Output

**Files:**
- Modify: `frontend/next.config.ts`

**Step 1: Update Next.js config**

Add `output: "standalone"` to the exported config. Keep the rest of the config unchanged.

**Step 2: Verify build contract**

Run: `cd frontend && pnpm build`

Expected:
- Build completes successfully
- `.next/standalone` is generated

**Step 3: Commit**

```bash
git add frontend/next.config.ts
git commit -m "build: enable standalone next output"
```

### Task 2: Add Health Endpoint For Kubernetes Probes

**Files:**
- Create: `frontend/src/app/api/health/route.ts`

**Step 1: Add a minimal route**

Return HTTP `200` with a small JSON body such as:

```ts
{ "status": "ok" }
```

Use Next.js route handler primitives only. No external dependencies.

**Step 2: Verify locally**

Run after the app starts:

```bash
cd frontend && pnpm dev
curl -i http://127.0.0.1:3000/api/health
```

Expected:
- HTTP `200`
- JSON response body

**Step 3: Commit**

```bash
git add frontend/src/app/api/health/route.ts
git commit -m "feat: add frontend health endpoint"
```

### Task 3: Add Docker Build Context Hygiene

**Files:**
- Create: `frontend/.dockerignore`

**Step 1: Add ignore rules**

Include at least:
- `node_modules`
- `.next`
- `.git`
- `docs`
- `*.log`
- `.DS_Store`
- local env files that should not be baked into images unless intentionally included

**Step 2: Sanity check**

Run:

```bash
cd frontend && docker build -f Dockerfile .
```

Expected:
- Build context stays small
- No missing runtime files due to over-aggressive ignore rules

**Step 3: Commit**

```bash
git add frontend/.dockerignore
git commit -m "build: add docker ignore rules"
```

### Task 4: Add Production Dockerfile

**Files:**
- Create: `frontend/Dockerfile`

**Step 1: Build multi-stage image**

Use stages like:
- `base`
- `deps`
- `builder`
- `runner`

Requirements:
- Use Node 20 base image
- Use `pnpm-lock.yaml`
- Install with `pnpm install --frozen-lockfile`
- Run `pnpm build`
- Copy only:
  - `.next/standalone`
  - `.next/static`
  - `public`
- Expose `3000`
- Run `node server.js`

**Step 2: Decide base image**

Start with Alpine. If build or runtime fails due to native compatibility, switch to Debian slim.

**Step 3: Verify image build**

Run:

```bash
cd frontend && docker build --platform=linux/amd64 -t bizdevops-crepo.trinasolar.com/z5a9f1/docker-local/robot_monitoring:1.1 .
```

Expected:
- Image builds successfully
- No dependency install drift

**Step 4: Verify container runtime**

Run:

```bash
docker run --rm -p 3000:3000 bizdevops-crepo.trinasolar.com/z5a9f1/docker-local/robot_monitoring:1.1
```

Check:
- `http://127.0.0.1:3000/api/health`
- `http://127.0.0.1:3000/global-operations`
- `http://127.0.0.1:3000/sites/qinghai-gonghexian/2d`

**Step 5: Commit**

```bash
git add frontend/Dockerfile
git commit -m "build: add frontend production dockerfile"
```

### Task 5: Add Kubernetes Deployment Manifest

**Files:**
- Create: `frontend/k8s/deployment.yaml`

**Step 1: Define Deployment**

Requirements:
- `replicas: 2`
- container port `3000`
- image placeholder for CI/CD substitution
- `readinessProbe` and `livenessProbe` on `/api/health`
- initial resources:
  - requests: `cpu: 250m`, `memory: 512Mi`
  - limits: `cpu: 1`, `memory: 1Gi`

**Step 2: Add environment variable placeholders**

Include non-secret env structure for:
- `NEXT_PUBLIC_ROBOT_BASE_URL`
- `NEXT_PUBLIC_ROBOT_VIDEO_BASE_URL`

Use `ConfigMap` references instead of hardcoding values.

**Step 3: Validate manifest syntax**

Run:

```bash
kubectl apply --dry-run=client -f frontend/k8s/deployment.yaml
```

Expected:
- No schema errors

**Step 4: Commit**

```bash
git add frontend/k8s/deployment.yaml
git commit -m "deploy: add frontend deployment manifest"
```

### Task 6: Add Kubernetes Service Manifest

**Files:**
- Create: `frontend/k8s/service.yaml`

**Step 1: Define ClusterIP service**

Requirements:
- service port `80`
- target port `3000`
- selector matches Deployment labels

**Step 2: Validate manifest**

Run:

```bash
kubectl apply --dry-run=client -f frontend/k8s/service.yaml
```

Expected:
- No schema errors

**Step 3: Commit**

```bash
git add frontend/k8s/service.yaml
git commit -m "deploy: add frontend service manifest"
```

### Task 7: Add Kubernetes ConfigMap Manifest

**Files:**
- Create: `frontend/k8s/configmap.yaml`

**Step 1: Define runtime config placeholders**

Include keys for:
- `NEXT_PUBLIC_ROBOT_BASE_URL`
- `NEXT_PUBLIC_ROBOT_VIDEO_BASE_URL`

Keep values non-production placeholders.

**Step 2: Validate manifest**

Run:

```bash
kubectl apply --dry-run=client -f frontend/k8s/configmap.yaml
```

Expected:
- No schema errors

**Step 3: Commit**

```bash
git add frontend/k8s/configmap.yaml
git commit -m "deploy: add frontend config map"
```

### Task 8: Add Kubernetes Ingress Manifest

**Files:**
- Create: `frontend/k8s/ingress.yaml`
- Reference: `frontend/default.conf`

**Step 1: Translate app route**

Map `/` to the frontend service.

**Step 2: Translate proxy intent from `default.conf`**

Preserve these two path families:
- `/defaultApi/`
- `/scp-product/defaultApi/`

Implementation note:
- If the cluster Ingress controller supports external upstream or gateway-level proxy rules, encode them there.
- If it does not, record that limitation clearly and leave TODO comments in the manifest or add annotations expected by the actual controller in use.

**Step 3: Add host and TLS placeholders**

Do not hardcode final production secrets. Use placeholders that can be patched per environment.

**Step 4: Validate manifest**

Run:

```bash
kubectl apply --dry-run=client -f frontend/k8s/ingress.yaml
```

Expected:
- No schema errors

**Step 5: Commit**

```bash
git add frontend/k8s/ingress.yaml
git commit -m "deploy: add frontend ingress manifest"
```

### Task 9: End-To-End Local Verification

**Files:**
- Verify only

**Step 1: Build image**

Run:

```bash
cd frontend && docker build --platform=linux/amd64 -t bizdevops-crepo.trinasolar.com/z5a9f1/docker-local/robot_monitoring:1.1 .
```

**Step 2: Start container**

Run:

```bash
docker run --rm -p 3000:3000 bizdevops-crepo.trinasolar.com/z5a9f1/docker-local/robot_monitoring:1.1
```

**Step 3: Verify endpoints**

Check:
- `curl -i http://127.0.0.1:3000/api/health`
- open `http://127.0.0.1:3000/global-operations`
- open `http://127.0.0.1:3000/sites/qinghai-gonghexian/2d`

**Step 4: Verify static assets**

Confirm `.glb` and image assets load without `404`.

**Step 5: Run lint**

Run:

```bash
cd frontend && pnpm lint
```

Expected:
- clean pass

### Task 10: Kubernetes Manifest Verification

**Files:**
- Verify only

**Step 1: Dry-run all manifests**

Run:

```bash
kubectl apply --dry-run=client -f frontend/k8s/configmap.yaml
kubectl apply --dry-run=client -f frontend/k8s/deployment.yaml
kubectl apply --dry-run=client -f frontend/k8s/service.yaml
kubectl apply --dry-run=client -f frontend/k8s/ingress.yaml
```

**Step 2: Verify routing assumptions**

Check with platform owner or cluster docs:
- which Ingress controller is in use
- whether external upstream proxy is supported
- whether `/defaultApi` needs rewrite annotations

**Step 3: Capture unresolved platform dependencies**

Document any controller-specific fields still needing environment values.

### Task 11: Final Integration Commit

**Files:**
- All changed files from Tasks 1-8

**Step 1: Stage final set**

```bash
git add frontend/next.config.ts \
  frontend/src/app/api/health/route.ts \
  frontend/.dockerignore \
  frontend/Dockerfile \
  frontend/k8s/configmap.yaml \
  frontend/k8s/deployment.yaml \
  frontend/k8s/service.yaml \
  frontend/k8s/ingress.yaml \
  frontend/docs/plans/2026-04-03-frontend-docker-k8s.md
```

**Step 2: Commit**

```bash
git commit -m "build: add frontend docker and k8s deployment assets"
```

**Step 3: Record validation in PR description**

Include:
- `pnpm build`
- `pnpm lint`
- `docker build`
- `docker run`
- `kubectl apply --dry-run=client`
