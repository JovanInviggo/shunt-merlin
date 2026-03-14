# Shunt Wizard — Cluster Documentation

Everything you need to know about how the infrastructure works, why decisions were made, what
to watch out for, and what still needs to be done.

---

## Table of Contents

1. [What is this cluster?](#1-what-is-this-cluster)
2. [Installed components and why](#2-installed-components-and-why)
3. [How traffic flows from the internet to your app](#3-how-traffic-flows-from-the-internet-to-your-app)
4. [The repository structure](#4-the-repository-structure)
5. [CI/CD — how deployments work](#5-cicd--how-deployments-work)
6. [Secrets — what they are and how to recreate them](#6-secrets--what-they-are-and-how-to-recreate-them)
7. [TLS certificates — current state and plan](#7-tls-certificates--current-state-and-plan)
8. [The 503 problem — what it was and why it's fixed](#8-the-503-problem--what-it-was-and-why-its-fixed)
9. [Why tunnel mode and not native routing](#9-why-tunnel-mode-and-not-native-routing)
10. [Things you must never do](#10-things-you-must-never-do)
11. [Things to watch out for](#11-things-to-watch-out-for)
12. [Prod deployment checklist](#12-prod-deployment-checklist)
13. [Recovery procedures](#13-recovery-procedures)
14. [Future improvements](#14-future-improvements)

---

## 1. What is this cluster?

A 3-node Kubernetes cluster running on **Hetzner Cloud** in Nuremberg (`nbg1`).

| Node | Role | Internal IP | External IP |
|------|------|-------------|-------------|
| shuntmerlin-control-plane-5sv6k | control-plane | 10.0.0.3 | 178.104.21.171 |
| shuntmerlin-md-0-spr28-4gkpk | worker | 10.0.0.4 | 178.104.19.210 |
| shuntmerlin-md-0-spr28-8x44w | worker | 10.0.0.5 | 178.104.42.61 |

- **Kubernetes version:** v1.31.6
- **CPU architecture:** ARM64 (all nodes) — Docker images must be built for `linux/arm64`
- **Private network:** `10.0.0.0/16`, gateway `10.0.0.1` (Hetzner-managed)
- **Kubeconfig:** `/Users/jovan/Downloads/shuntmerlin`

The cluster was provisioned by Hetzner via Cluster API (CAPI). Hetzner manages the VMs,
the private network, and the load balancers. We manage everything inside Kubernetes.

---

## 2. Installed components and why

### Cilium 1.19.1 — the network brain

**What it does:** Cilium is the CNI (Container Network Interface). Every pod in the cluster
gets an IP address from Cilium, and all traffic between pods goes through Cilium. It also
completely replaces `kube-proxy` (the traditional Kubernetes networking component).

**Why Cilium specifically:**
- It has built-in support for Kubernetes Gateway API (described below), so you don't need
  a separate nginx or Traefik ingress controller
- It uses eBPF (a Linux kernel technology) to handle networking at the kernel level — faster
  and more observable than traditional iptables-based approaches
- It includes an external Envoy proxy (the `cilium-envoy` DaemonSet) that handles Layer 7
  (HTTP/HTTPS) traffic, enabling things like TLS termination and HTTP→HTTPS redirects

**Why version 1.19.1 specifically:** Earlier versions (1.16.x, 1.17.x) had a bug where the
Envoy proxy on one worker node couldn't make connections to pods on another worker node
through the VXLAN tunnel. This caused ~1/3 of requests to fail with a 503. Cilium 1.19.1
fixed this bug. See [section 8](#8-the-503-problem--what-it-was-and-why-its-fixed) for details.

**Configuration file:** `k8s/cilium-values.yaml`

Key settings explained:
```yaml
routingMode: tunnel       # VXLAN encapsulation for cross-node traffic (see section 9)
tunnelProtocol: vxlan     # Standard UDP-based overlay networking
kubeProxyReplacement: true  # Cilium handles all service routing, no kube-proxy needed
gatewayAPI.enabled: true  # Enables Cilium's Gateway API controller
devices: enp7s0           # The Hetzner private network interface on each node
cgroup.autoMount.enabled: false  # Hetzner nodes pre-mount cgroupv2, don't remount
```

---

### Gateway API v1.4.1 — how external traffic enters

**What it does:** Gateway API is the modern way to configure how traffic from the internet
reaches your services. It replaces the older Kubernetes `Ingress` resource.

It's a set of CRDs (Custom Resource Definitions — basically new Kubernetes object types)
that you install into the cluster. Cilium's controller then watches these objects and
configures Envoy accordingly.

**The three objects that matter:**

1. **GatewayClass** (`k8s/gateway-class.yaml`) — cluster-scoped, applied once.
   Tells Kubernetes "the controller named `io.cilium/gateway-controller` handles Gateways".
   Think of it as registering Cilium as the traffic manager.

2. **Gateway** (`k8s/overlays/dev/gateway.yaml`) — one per environment.
   Defines the actual entry points: port 80 (HTTP), port 443 for the dashboard,
   port 443 for the API. When applied, Cilium creates a Kubernetes Service of type
   `LoadBalancer`, which triggers Hetzner CCM to provision a real Hetzner Load Balancer.

3. **HTTPRoute** — also in `gateway.yaml`.
   Rules that say "traffic for this hostname goes to this backend service".
   There are three: HTTP→HTTPS redirect, dashboard route, API route.

**Why Gateway API and not Ingress?** The older `Ingress` resource is limited — it can't
express things like HTTP→HTTPS redirects natively, and many controllers implement it
differently. Gateway API is the official Kubernetes standard going forward.

---

### Hetzner CCM (Cloud Controller Manager)

**What it does:** Runs inside the cluster and talks to the Hetzner API on your behalf.
Its main job here is **provisioning Load Balancers**.

When Cilium creates a Service of type `LoadBalancer` (triggered by your Gateway), CCM
sees it and calls the Hetzner API to create a real Hetzner LB. It then writes the public
IP back to the Service's `status.loadBalancer.ingress` field.

**Critical annotation:** The Gateway YAML contains:
```yaml
annotations:
  load-balancer.hetzner.cloud/location: "nbg1"
  load-balancer.hetzner.cloud/use-private-ip: "true"
```
These tell CCM **where** to create the LB and **how** to connect it to your nodes.
Without `location`, CCM refuses to create the LB. Without `use-private-ip`, the LB
tries to connect to nodes via their public IPs, which doesn't work with Cilium's routing.

**Important gotcha:** These annotations on the Gateway YAML sometimes don't propagate
to the Service that Cilium creates. If you ever recreate a Gateway (or it disappears),
you must manually re-annotate the Cilium-generated Service:
```bash
kubectl annotate svc cilium-gateway-dev-gateway -n shunt-wizzard-dev \
  "load-balancer.hetzner.cloud/location=nbg1" \
  "load-balancer.hetzner.cloud/use-private-ip=true" \
  --kubeconfig=/Users/jovan/Downloads/shuntmerlin
```

---

### Hetzner CSI (Container Storage Interface)

**What it does:** Provisions Hetzner Cloud Volumes (block storage) when a pod requests
persistent storage via a PVC (PersistentVolumeClaim).

**Where it's used:** Postgres has a 10Gi PVC defined in `k8s/base/postgres.yaml` via
`volumeClaimTemplates`. When the StatefulSet starts, Hetzner CSI creates a real cloud
volume and mounts it at `/var/lib/postgresql/data/pgdata` inside the postgres container.

**Why this matters:** Postgres data survives pod restarts and node reboots. But if the
**namespace** is deleted, the PVC is deleted too, and the cloud volume gets released.
The data is gone. See [section 10](#10-things-you-must-never-do).

---

### cert-manager v1.20.0 — TLS certificate automation

**What it does:** Watches for `Certificate` resources (or annotations) and automatically
requests, renews, and stores TLS certificates. Works with Let's Encrypt.

**Current state:** Installed and configured with a `ClusterIssuer` pointing at Let's Encrypt
production (`k8s/cert-manager-issuer.yaml`). However, real certificates are not yet issued
— we're currently running a self-signed cert (browser shows a security warning).

**See section 7** for the full cert situation and what needs to happen.

---

## 3. How traffic flows from the internet to your app

```
User's browser
     │
     │  HTTPS request to dev-api.shuntwizard.com
     ▼
Hetzner Load Balancer (46.225.41.252, port 443)
     │
     │  Forwards to NodePort on one of the 3 nodes
     ▼
Node's network interface (enp7s0)
     │
     │  Cilium's eBPF programs intercept and DNAT to correct service
     ▼
cilium-envoy (DaemonSet pod on this node)
     │
     │  Terminates TLS, reads the hostname, applies routing rules from HTTPRoute
     │  If destination pod is on ANOTHER node → VXLAN tunnel to that node
     ▼
Backend pod (port 3000)
```

**Why Envoy is in the middle:** Envoy is an L7 (application-layer) proxy. It understands
HTTP/HTTPS, can terminate TLS (decrypt the connection), read the `Host` header, and route
based on hostname or path. This is what enables having two different hostnames
(`dev-api` vs `dev-dashboard`) on the same IP address and port.

**What "VXLAN tunnel" means:** When a pod on worker1 needs to talk to a pod on worker2,
the packet is wrapped ("encapsulated") inside a UDP packet and sent across the private
network. The receiving node unwraps it and delivers to the pod. This is invisible to the
pods themselves.

---

## 4. The repository structure

```
shunt-wizzard/
├── k8s/
│   ├── cilium-values.yaml          # Helm values for Cilium (document of truth)
│   ├── gateway-class.yaml          # GatewayClass — applied once, cluster-scoped
│   ├── cert-manager-issuer.yaml    # ClusterIssuer for Let's Encrypt — applied once
│   ├── secret-templates/           # TEMPLATES ONLY — never contains real values
│   │   ├── backend-secret.yaml
│   │   └── postgres-secret.yaml
│   ├── base/                       # Shared resources for all environments
│   │   ├── kustomization.yaml
│   │   ├── backend.yaml            # Deployment + Service for NestJS backend
│   │   ├── dashboard.yaml          # Deployment + Service for React dashboard
│   │   └── postgres.yaml           # StatefulSet + Service for PostgreSQL
│   └── overlays/
│       ├── dev/
│       │   ├── kustomization.yaml          # Composites base + dev resources
│       │   ├── namespace.yaml              # shunt-wizzard-dev namespace
│       │   ├── gateway.yaml                # Dev Gateway + HTTPRoutes
│       │   └── backend-configmap-patch.yaml # Dev-specific env vars
│       └── prod/
│           ├── kustomization.yaml
│           ├── namespace.yaml
│           ├── gateway.yaml
│           └── backend-configmap-patch.yaml
├── .github/workflows/
│   └── deploy.yml                  # CI/CD pipeline
└── packages/
    ├── backend/                    # NestJS API
    └── dashboard/                  # React + Vite
```

**Kustomize** is how the base + overlay system works. Running `kubectl apply -k k8s/overlays/dev`
merges `base/` with `overlays/dev/` and applies the result. The `backend-configmap-patch.yaml`
overrides specific ConfigMap values for each environment (e.g., different `ALLOWED_ORIGINS`).

**What is NOT in git (intentionally):**
- All secrets (`postgres-secret`, `backend-secret`, `ghcr-pull-secret`, TLS secrets)
- The `secret-templates/` folder has the shape of secrets but with placeholder values

---

## 5. CI/CD — how deployments work

**Trigger:** Push to `develop` → deploy to dev. Push to `main` → deploy to prod.

**What the pipeline does** (`.github/workflows/deploy.yml`):
1. Builds the backend Docker image for `linux/arm64`
2. Builds the dashboard Docker image for `linux/arm64`
3. Pushes both to GHCR (GitHub Container Registry) tagged with:
   - `dev-latest` (or `prod-latest`) — floating tag, always points to newest
   - `<git-sha>` — immutable tag for that specific commit
4. Runs `kubectl apply -k k8s/overlays/dev` — applies all Kubernetes manifests
5. Runs `kubectl set image` with the SHA tag — updates the deployment to use the exact
   new image, not the floating `latest` tag
6. Waits for rollout to complete

**Why SHA tags?** If a pod restarts and pulls `latest`, it might get a stale cached image
or a different version than what's deployed. SHA tags are immutable — a pod always gets
exactly the image that was deployed.

**Required GitHub secrets** (must exist in the repo settings):
- `KUBECONFIG_DATA` — base64-encoded kubeconfig for the cluster
- `VITE_API_URL_DEV` — `https://dev-api.shuntwizard.com` (baked into dashboard build)
- `VITE_API_URL_PROD` — `https://api.shuntwizard.com`

**The `VITE_API_URL` note:** The dashboard is a static React SPA. The API URL is baked
into the JavaScript bundle at build time (Vite replaces `import.meta.env.VITE_API_URL`
with the actual string). This means if the API URL ever changes, you must rebuild the
dashboard image and redeploy. There is no way to change it at runtime.

---

## 6. Secrets — what they are and how to recreate them

Secrets are never in git. They must be created manually in each namespace.

### postgres-secret

Credentials for the PostgreSQL database.

```bash
kubectl create secret generic postgres-secret \
  --namespace shunt-wizzard-dev \
  --from-literal=POSTGRES_USER=postgres \
  --from-literal=POSTGRES_PASSWORD=YOUR_PASSWORD \
  --from-literal=POSTGRES_DB=shunt_wizzard \
  --kubeconfig=/Users/jovan/Downloads/shuntmerlin
```

### backend-secret

Everything the NestJS backend needs that isn't in the ConfigMap (sensitive values).

```bash
kubectl create secret generic backend-secret \
  --namespace shunt-wizzard-dev \
  --from-literal=DATABASE_USER=postgres \
  --from-literal=DATABASE_PASSWORD=YOUR_PASSWORD \
  --from-literal=JWT_SECRET=YOUR_JWT_SECRET \
  --from-literal=S3_STORAGE_BUCKET_NAME=shunt-dev \
  --from-literal=S3_STORAGE_ACCESS_KEY=YOUR_SCW_ACCESS_KEY \
  --from-literal=S3_STORAGE_SECRET_KEY=YOUR_SCW_SECRET_KEY \
  --kubeconfig=/Users/jovan/Downloads/shuntmerlin
```

`DATABASE_PASSWORD` must match `POSTGRES_PASSWORD` in `postgres-secret`.

`JWT_SECRET` signs all JWT tokens. If you change it, all existing sessions are invalidated.
Generate a strong one with: `openssl rand -base64 64`

### ghcr-pull-secret

Allows nodes to pull Docker images from GHCR (GitHub Container Registry).

```bash
kubectl create secret docker-registry ghcr-pull-secret \
  --docker-server=ghcr.io \
  --docker-username=JovanInviggo \
  --docker-password=YOUR_GITHUB_PAT \
  --namespace shunt-wizzard-dev \
  --kubeconfig=/Users/jovan/Downloads/shuntmerlin
```

`YOUR_GITHUB_PAT` is a GitHub Personal Access Token with `read:packages` scope.
These tokens can expire — see [section 11](#11-things-to-watch-out-for).

### dev-tls-secret

The TLS certificate for HTTPS. Currently self-signed:

```bash
openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
  -keyout /tmp/tls.key -out /tmp/tls.crt \
  -subj "/CN=dev-dashboard.shuntwizard.com" \
  -addext "subjectAltName=DNS:dev-dashboard.shuntwizard.com,DNS:dev-api.shuntwizard.com"

kubectl create secret tls dev-tls-secret \
  --cert=/tmp/tls.crt --key=/tmp/tls.key \
  -n shunt-wizzard-dev \
  --kubeconfig=/Users/jovan/Downloads/shuntmerlin
```

Replace with a real cert once certs are sorted (see section 7).

---

## 7. TLS certificates — current state and plan

### Current state

Both dev endpoints use a **self-signed certificate**. This means:
- HTTPS works (traffic is encrypted)
- Browsers show a security warning ("Your connection is not private")
- The mobile app and any API clients will reject it unless configured to skip verification
- Not acceptable for production

### Why cert-manager's automatic issuance isn't working yet

cert-manager can automatically request certificates from Let's Encrypt using an **HTTP-01
challenge**: Let's Encrypt visits `http://dev-api.shuntwizard.com/.well-known/acme-challenge/...`
to verify you control the domain.

For this to work, cert-manager creates a temporary HTTPRoute in your Gateway. This requires
cert-manager to have Gateway API support enabled (`enableGatewayAPI=true`). However, in
previous Cilium versions this caused cert-manager to interfere with the TLS secret. This
has NOT been retested with Cilium 1.19.1 + cert-manager v1.20.0.

### Option A — Test HTTP-01 with current setup (try first)

cert-manager is already configured (`k8s/cert-manager-issuer.yaml`). To trigger certificate
issuance you need `Certificate` resources or annotations on the Gateway. This needs to be
attempted and tested.

### Option B — Manual DNS-01 with certbot (works today, manual renewal)

```bash
brew install certbot
sudo certbot certonly --manual --preferred-challenges dns \
  -d dev-dashboard.shuntwizard.com \
  -d dev-api.shuntwizard.com
```

certbot will ask you to add a DNS TXT record (`_acme-challenge.dev-dashboard.shuntwizard.com`).
Add it in Squarespace, wait for it to propagate (can take 10-30 min), then press Enter.

After certbot succeeds:
```bash
sudo kubectl create secret tls dev-tls-secret \
  --cert=/etc/letsencrypt/live/dev-dashboard.shuntwizard.com/fullchain.pem \
  --key=/etc/letsencrypt/live/dev-dashboard.shuntwizard.com/privkey.pem \
  -n shunt-wizzard-dev \
  --dry-run=client -o yaml | \
  kubectl apply -f - --kubeconfig=/Users/jovan/Downloads/shuntmerlin
```

Downside: Let's Encrypt certs expire every 90 days. You must repeat this manually.

### Option C — Cloudflare DNS + cert-manager DNS-01 (recommended long-term)

Move DNS from Squarespace to Cloudflare. cert-manager can use Cloudflare's API to
automatically create/delete DNS TXT records, making certificate renewal fully automatic.

Steps (when you have a company Cloudflare account):
1. Transfer DNS zones to Cloudflare (change nameservers at Squarespace)
2. Create a Cloudflare API token with `Zone:DNS:Edit` permission
3. Store it as a Kubernetes secret
4. Update `cert-manager-issuer.yaml` to use `dns01` solver with Cloudflare
5. Apply `Certificate` resources for each environment

This is the production-grade solution. No manual work ever again.

---

## 8. The 503 problem — what it was and why it's fixed

When the cluster was first set up, ~1/3 of all requests returned:
```
503 upstream connect error or disconnect/reset before headers
```

**Root cause:** Cilium uses an external Envoy proxy (the `cilium-envoy` DaemonSet) as a
Layer 7 load balancer. When a request arrives at worker1's Envoy but the destination pod
is on worker2, Envoy needs to make an outgoing TCP connection from worker1 to the pod on
worker2 through the VXLAN tunnel.

In Cilium versions 1.16.x and 1.17.x, this specific path (Envoy-originated cross-node
connections in VXLAN mode) was broken. Envoy's outgoing connections had 100% failure rate
to pods on the other worker. Since the load balancer distributes requests across all 3 nodes,
and only 1 of the 3 was problematic, exactly 1/3 of requests failed.

**Things that did NOT fix it:**
- `bpf.hostLegacyRouting=true` — helped with other issues but not this one
- Upgrading to Cilium 1.17.13 — partially fixed (some nodes), not all
- WireGuard encryption — no effect on this specific bug
- Switching to native routing — doesn't work on Hetzner anyway (see section 9)

**What fixed it:** Upgrading to Cilium 1.19.1. The bug was resolved in the 1.19 release.
After the upgrade, all 6/6 test requests succeed on both endpoints consistently.

---

## 9. Why tunnel mode and not native routing

**Native routing** means pods on different nodes talk to each other directly, without
any encapsulation. The Linux kernel on each node needs a route like:
```
10.244.1.0/24 via 10.0.0.4 dev enp7s0   # "pods on worker1 are reachable at 10.0.0.4"
```

For Cilium to install these routes (`autoDirectNodeRoutes=true`), it requires that the
node IPs (10.0.0.3, 10.0.0.4, 10.0.0.5) are **directly reachable** — meaning on the same
L2 network segment with no router in between.

On Hetzner, the private network routes through a gateway at `10.0.0.1`. So the route to
`10.0.0.4` looks like `via 10.0.0.1 dev enp7s0`. Cilium detects this and refuses:
```
Unable to install direct node route: route to destination 10.0.0.4 contains
gateway 10.0.0.1, must be directly reachable.
```

**VXLAN tunnel mode** solves this by encapsulating pod-to-pod traffic in UDP. Cilium
doesn't need kernel routes for pod CIDRs — it just sends a UDP packet to the other node's
IP (which IS routable via the Hetzner gateway), and the receiving node unwraps it.

**Could native routing ever work on Hetzner?** Yes, with CCM route management. Hetzner CCM
has a route controller that can create routes in Hetzner's private network directly (not
kernel routes, but Hetzner's software-defined routing). This would make pods on each node
reachable at the node's IP. However, it requires configuring CCM with `--allocate-node-cidrs`
and enabling the route controller. This is possible but adds complexity — VXLAN works fine
for this cluster size.

---

## 10. Things you must never do

### Never delete the namespace

```bash
# DO NOT RUN THIS
kubectl delete namespace shunt-wizzard-dev
kubectl delete -k k8s/overlays/dev   # This also deletes the namespace
```

Deleting the namespace destroys **everything** inside it:
- The Hetzner Load Balancer (you lose the public IP)
- All secrets (postgres-secret, backend-secret, ghcr-pull-secret, dev-tls-secret)
- The Postgres PVC — Hetzner releases the cloud volume — **all database data is gone**
- The Gateway and all services

The IP assignment from Hetzner is random on recreation. You will have to update all DNS
records and wait for propagation. The database data cannot be recovered.

### Never delete the Gateway without understanding consequences

Deleting the Gateway deletes the Cilium-generated LoadBalancer Service, which tells
Hetzner CCM to delete the Load Balancer. New LB = new IP = update DNS.

### Never use `--no-verify` on git hooks or `--force` push to main

Standard practice — leaving it here as a reminder.

---

## 11. Things to watch out for

### GitHub PAT expiry

The `ghcr-pull-secret` uses a GitHub Personal Access Token. If this token expires,
pods will fail with `ImagePullBackOff`. Check the token's expiry in GitHub → Settings →
Developer Settings → Personal Access Tokens. Rotate it and recreate the secret before
it expires.

### Self-signed TLS cert expiry (365 days from March 2026)

The current self-signed cert expires in March 2027. Before that, replace it with a real
cert (see section 7). Calendar reminder recommended.

### Hetzner LB annotation on Cilium service

The `load-balancer.hetzner.cloud/location=nbg1` annotation is on the Gateway YAML.
Cilium creates a Service from the Gateway, and this annotation **may or may not**
propagate automatically. If you ever recreate the Gateway or the Cilium-generated
Service disappears, you must manually re-annotate:

```bash
kubectl annotate svc cilium-gateway-dev-gateway -n shunt-wizzard-dev \
  "load-balancer.hetzner.cloud/location=nbg1" \
  "load-balancer.hetzner.cloud/use-private-ip=true" \
  --kubeconfig=/Users/jovan/Downloads/shuntmerlin
```

### Cilium upgrades

Cilium upgrades can be disruptive. Always:
1. Check the Cilium upgrade notes for your target version
2. Do not skip minor versions (1.17 → 1.19 is risky; 1.17 → 1.18 → 1.19 is safer)
3. Do not use `--reuse-values` across major/minor upgrades — always specify all values explicitly
4. After upgrade, restart both DaemonSets: `kubectl rollout restart ds/cilium ds/cilium-envoy`

### S3 bucket names on Scaleway

Scaleway S3 bucket names must follow DNS naming rules — **no underscores**. Use dashes.
`shunt_dev` is invalid; `shunt-dev` is correct. This caused a backend crash on initial deploy.

---

## 12. Prod deployment checklist

When you're ready to go to production, do these steps in order:

**Prerequisites:**
- [ ] Real TLS certs obtained for `dashboard.shuntwizard.com` and `api.shuntwizard.com`
- [ ] Strong prod database password generated (not the same as dev)
- [ ] Strong prod JWT secret generated: `openssl rand -base64 64`
- [ ] Prod S3 bucket created on Scaleway (e.g., `shunt-prod`)

**Deploy:**

```bash
# 1. Create prod namespace, gateway, configmap
kubectl apply -k k8s/overlays/prod --kubeconfig=/Users/jovan/Downloads/shuntmerlin

# 2. Annotate the Cilium-generated LoadBalancer service (do this immediately)
kubectl annotate svc cilium-gateway-prod-gateway -n shunt-wizzard-prod \
  "load-balancer.hetzner.cloud/location=nbg1" \
  "load-balancer.hetzner.cloud/use-private-ip=true" \
  --kubeconfig=/Users/jovan/Downloads/shuntmerlin

# 3. Wait for the LB to get an external IP
kubectl -n shunt-wizzard-prod get svc cilium-gateway-prod-gateway -w \
  --kubeconfig=/Users/jovan/Downloads/shuntmerlin

# 4. Create secrets (use PROD values, not dev values)
kubectl create secret generic postgres-secret \
  --namespace shunt-wizzard-prod \
  --from-literal=POSTGRES_USER=postgres \
  --from-literal=POSTGRES_PASSWORD=STRONG_PROD_PASSWORD \
  --from-literal=POSTGRES_DB=shunt_wizzard \
  --kubeconfig=/Users/jovan/Downloads/shuntmerlin

kubectl create secret generic backend-secret \
  --namespace shunt-wizzard-prod \
  --from-literal=DATABASE_USER=postgres \
  --from-literal=DATABASE_PASSWORD=STRONG_PROD_PASSWORD \
  --from-literal=JWT_SECRET=$(openssl rand -base64 64) \
  --from-literal=S3_STORAGE_BUCKET_NAME=shunt-prod \
  --from-literal=S3_STORAGE_ACCESS_KEY=YOUR_SCW_ACCESS_KEY \
  --from-literal=S3_STORAGE_SECRET_KEY=YOUR_SCW_SECRET_KEY \
  --kubeconfig=/Users/jovan/Downloads/shuntmerlin

kubectl create secret docker-registry ghcr-pull-secret \
  --docker-server=ghcr.io \
  --docker-username=JovanInviggo \
  --docker-password=YOUR_GITHUB_PAT \
  --namespace shunt-wizzard-prod \
  --kubeconfig=/Users/jovan/Downloads/shuntmerlin

# 5. Create prod TLS secret (from real cert)
kubectl create secret tls prod-tls-secret \
  --cert=/path/to/fullchain.pem \
  --key=/path/to/privkey.pem \
  -n shunt-wizzard-prod \
  --kubeconfig=/Users/jovan/Downloads/shuntmerlin

# 6. Update DNS A records for dashboard.shuntwizard.com and api.shuntwizard.com
#    to point at the prod LB IP (from step 3)

# 7. Push to main to trigger prod CI/CD
git push origin main
```

**Verify:**
- [ ] All pods running: `kubectl get pods -n shunt-wizzard-prod`
- [ ] Dashboard returns 200: `curl -I https://dashboard.shuntwizard.com`
- [ ] API responds: `curl https://api.shuntwizard.com/auth/login`
- [ ] No 503 errors under load

---

## 13. Recovery procedures

### Scenario: Backend is in CrashLoopBackOff

```bash
# Check logs
kubectl -n shunt-wizzard-dev logs deploy/backend --previous --kubeconfig=/Users/jovan/Downloads/shuntmerlin

# Common causes:
# - Wrong secret values (DATABASE_PASSWORD mismatch, S3 bucket not found)
# - Database not ready yet (postgres still starting)
# - Missing secret
```

### Scenario: Can't reach the app (connection timeout, no response)

```bash
# Check pods are running
kubectl -n shunt-wizzard-dev get pods --kubeconfig=/Users/jovan/Downloads/shuntmerlin

# Check Gateway has an IP
kubectl -n shunt-wizzard-dev get svc --kubeconfig=/Users/jovan/Downloads/shuntmerlin

# Check LB annotation is present
kubectl -n shunt-wizzard-dev get svc cilium-gateway-dev-gateway -o yaml --kubeconfig=/Users/jovan/Downloads/shuntmerlin | grep annotation -A5

# Check Gateway status
kubectl -n shunt-wizzard-dev get gateway --kubeconfig=/Users/jovan/Downloads/shuntmerlin
```

### Scenario: ImagePullBackOff

```bash
# Check if it's an auth error
kubectl -n shunt-wizzard-dev describe pod <pod-name> --kubeconfig=/Users/jovan/Downloads/shuntmerlin | grep -A5 Events

# If "unauthorized" — ghcr-pull-secret is expired or wrong
# Delete and recreate with a fresh GitHub PAT:
kubectl delete secret ghcr-pull-secret -n shunt-wizzard-dev --kubeconfig=/Users/jovan/Downloads/shuntmerlin
kubectl create secret docker-registry ghcr-pull-secret ...
```

### Nuclear option — return cluster to factory state

This restores the cluster to exactly how it was before any of our work: only Cilium 1.16.5
with default settings, nothing else.

```bash
# 1. Delete everything we added
kubectl delete namespace shunt-wizzard-dev shunt-wizzard-prod --ignore-not-found --kubeconfig=/Users/jovan/Downloads/shuntmerlin
kubectl delete namespace cert-manager --ignore-not-found --kubeconfig=/Users/jovan/Downloads/shuntmerlin
kubectl delete clusterissuer letsencrypt-prod --ignore-not-found --kubeconfig=/Users/jovan/Downloads/shuntmerlin
kubectl delete gatewayclass cilium --ignore-not-found --kubeconfig=/Users/jovan/Downloads/shuntmerlin
helm uninstall cert-manager -n cert-manager --ignore-not-found --kubeconfig=/Users/jovan/Downloads/shuntmerlin
helm uninstall cilium -n kube-system --kubeconfig=/Users/jovan/Downloads/shuntmerlin
kubectl delete -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.4.1/experimental-install.yaml --ignore-not-found --kubeconfig=/Users/jovan/Downloads/shuntmerlin

# 2. Reinstall Cilium at the original version
helm install cilium cilium/cilium --version 1.16.5 --namespace kube-system \
  --set gatewayAPI.enabled=true \
  --kubeconfig=/Users/jovan/Downloads/shuntmerlin
```

---

## 14. Future improvements

### Real TLS certificates (next priority)

See section 7. The self-signed cert needs to be replaced before the mobile app or any
real users access the service.

### Cloudflare DNS migration

Move DNS from Squarespace to Cloudflare. Enables cert-manager DNS-01 auto-renewal and
gives you a proper dashboard for DNS management. Do this when a company Cloudflare account
is available.

### WireGuard pod-to-pod encryption

WireGuard encrypts traffic between nodes (pod-to-pod). On Hetzner's private network
this is defense-in-depth. It was disabled because it conflicted with routing in our
Cilium versions — specifically, WireGuard encryption causes cross-node routes to go
through BPF programs that host processes (like kube-apiserver) can't use when in
"Host: Legacy" routing mode.

This should be retested with Cilium 1.19.1 in tunnel mode to see if the conflict exists
in this configuration. If it works cleanly, it's worth enabling for production.

### Resource limits on pods

Currently none of the pods have CPU/memory requests or limits defined. This means a
misbehaving pod could consume all resources on a node and starve other pods. Add
`resources.requests` and `resources.limits` to all Deployments in `k8s/base/`.

### Hubble observability

Cilium includes Hubble, a network observability tool. It provides a UI where you can
see real-time traffic flows, dropped packets, and per-service metrics. Useful for
debugging connectivity issues. Can be enabled with:
```bash
helm upgrade cilium cilium/cilium --version 1.19.1 -n kube-system \
  --reuse-values --set hubble.relay.enabled=true --set hubble.ui.enabled=true
```

### Horizontal Pod Autoscaler

For the backend, consider adding an HPA (HorizontalPodAutoscaler) to automatically scale
pods based on CPU/memory. Relevant once the app has real user traffic.
