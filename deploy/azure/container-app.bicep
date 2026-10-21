// STARTER TEMPLATE. Azure Container Apps environment + one external app on port 8080.
// For a purely static site, Azure Static Web Apps is a cheaper alternative to a container.
// Deploy: az deployment group create -g <rg> -f container-app.bicep -p image=<registry>/health-pulse:1

param name string = 'health-pulse'
param location string = resourceGroup().location
@description('Full image reference, e.g. myacr.azurecr.io/health-pulse:1')
param image string
@description('Registry host for private images, e.g. myacr.azurecr.io. Leave empty for a public image.')
param registryServer string = ''
param registryUsername string = ''
@secure()
param registryPassword string = ''
@description('0 allows scale-to-zero (cold start on first request).')
param minReplicas int = 1
param maxReplicas int = 2

resource logs 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: '${name}-logs'
  location: location
  properties: { sku: { name: 'PerGB2018' }, retentionInDays: 30 }
}

resource env 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: '${name}-env'
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logs.properties.customerId
        sharedKey: logs.listKeys().primarySharedKey
      }
    }
  }
}

resource app 'Microsoft.App/containerApps@2024-03-01' = {
  name: name
  location: location
  properties: {
    managedEnvironmentId: env.id
    configuration: {
      ingress: {
        external: true
        targetPort: 8080 // nginx-unprivileged port
        transport: 'auto'
      }
      registries: empty(registryServer) ? [] : [
        { server: registryServer, username: registryUsername, passwordSecretRef: 'registry-password' }
      ]
      secrets: empty(registryServer) ? [] : [
        { name: 'registry-password', value: registryPassword }
      ]
    }
    template: {
      containers: [
        {
          name: 'web'
          image: image
          resources: { cpu: json('0.25'), memory: '0.5Gi' }
          probes: [
            { type: 'Liveness', httpGet: { path: '/healthz', port: 8080 } }
          ]
        }
      ]
      scale: { minReplicas: minReplicas, maxReplicas: maxReplicas }
    }
  }
}

output url string = 'https://${app.properties.configuration.ingress.fqdn}'
