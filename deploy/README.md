# Container and cloud deploy blueprints

These are **starter templates** for running one isolated, single-tenant instance of the app. The app is a static site, so a container is optional: GitHub Pages, S3 + CloudFront, or Azure Static Web Apps also work and cost less. Review IAM, networking, TLS and logging against your own policies before use.

## Build the image

Run from the repo root (the build needs both `app/` and `config/`).

```bash
# Default city (Greater Austin), served at "/"
docker build -t health-pulse:1 .

# Second city using a preset
docker build -t health-pulse-partner:1 \
  --build-arg CITY_CONFIG=presets/partner-city-demo.json .
```

Build args: `BASE_PATH` (default `/`), `CITY_CONFIG` (path relative to `config/`, default `city.config.json`), `VITE_SERVICE_GUIDE_URL`, `VITE_ENABLE_PERSONAL_CALCULATOR` (default `false`). The build bakes these in, so a different city or setting needs a different image. The estimator flag defaults to off here, unlike the GitHub Pages workflow, which turns it on for the Austin demo.

Run locally: `docker compose up --build`, then open http://localhost:8080/. Compose reads the same args from the environment (for example `CITY_CONFIG=presets/partner-city-demo.json docker compose up --build`).

Verify: `curl -i localhost:8080/` returns 200 with a CSP header, and `curl localhost:8080/healthz` returns `ok`.

The container runs as UID 101 (nginx), listens on 8080, and serves files from the image only. The CSP allows same-origin resources plus OpenStreetMap map tiles (`tile.openstreetmap.org`, images only). Fonts are bundled, so no font host is needed. If you add other external resources, edit `deploy/nginx.conf`.

## AWS (ECS Fargate behind an ALB)

```bash
aws ecr create-repository --repository-name health-pulse --region us-east-2
aws ecr get-login-password --region us-east-2 | docker login --username AWS --password-stdin <acct>.dkr.ecr.us-east-2.amazonaws.com
docker tag health-pulse:1 <acct>.dkr.ecr.us-east-2.amazonaws.com/health-pulse:1
docker push <acct>.dkr.ecr.us-east-2.amazonaws.com/health-pulse:1

cd deploy/aws
terraform init
terraform apply -var image_uri=<acct>.dkr.ecr.us-east-2.amazonaws.com/health-pulse:1 \
  -var vpc_id=vpc-... -var 'public_subnet_ids=["subnet-a","subnet-b"]' -var 'private_subnet_ids=["subnet-c","subnet-d"]'
```

Verify: `curl -i $(terraform output -raw url)/`. The ALB listener is HTTP only; add an ACM certificate and an HTTPS listener before real use.

## Azure (Container Apps)

```bash
az acr create -g <rg> -n <acrname> --sku Basic
az acr login -n <acrname>
docker tag health-pulse:1 <acrname>.azurecr.io/health-pulse:1
docker push <acrname>.azurecr.io/health-pulse:1

# Registry credentials: enable the ACR admin user or use a token; pass them as parameters
az deployment group create -g <rg> -f deploy/azure/container-app.bicep \
  -p image=<acrname>.azurecr.io/health-pulse:1 registryServer=<acrname>.azurecr.io \
     registryUsername=<user> registryPassword=<password>
```

Verify: `curl -i <url output>/`.

## GCP (Cloud Run)

```bash
gcloud artifacts repositories create health-pulse --repository-format=docker --location=us-central1
gcloud auth configure-docker us-central1-docker.pkg.dev
docker tag health-pulse:1 us-central1-docker.pkg.dev/<project>/health-pulse/health-pulse:1
docker push us-central1-docker.pkg.dev/<project>/health-pulse/health-pulse:1

# Replace IMAGE_URI in deploy/gcp/cloud-run.yaml, then:
gcloud run services replace deploy/gcp/cloud-run.yaml --region us-central1
gcloud run services add-iam-policy-binding health-pulse --region us-central1 --member=allUsers --role=roles/run.invoker
```

Verify: `curl -i $(gcloud run services describe health-pulse --region us-central1 --format='value(status.url)')/`.

## What was validated

| Item | Status |
|---|---|
| `deploy/nginx.conf` + runtime image (headers, caching, non-root UID 101, healthcheck, read-only rootfs with tmpfs /tmp) | Run locally against a stub `dist/`, not the real build |
| Full `docker build` of the app | Not yet validated end to end; it depends on `npm run validate:data` and the `BASE_PATH`/`CITY_CONFIG` support in `app/` |
| `docker compose config` | Passed |
| `deploy/azure/container-app.bicep` | Compiled with `az bicep build`; not deployed |
| `deploy/gcp/cloud-run.yaml` | YAML parses; not checked with gcloud, not deployed |
| `deploy/aws/ecs-fargate.tf` | Not validated (terraform not installed); not applied |
