pipeline {
  agent any

  options {
    timestamps()
    disableConcurrentBuilds()
  }

  environment {
    DB_PASSWORD = credentials('scoutops-test-db-password')
    DB_HOST = '127.0.0.1'
    DB_PORT = '5432'
    DB_NAME = 'scoutops_test'
    DB_USER = 'scoutops_test'
    JWT_SECRET = credentials('scoutops-test-jwt-secret')
    METRICS_TOKEN = credentials('scoutops-test-metrics-token')
    ADMIN_USERNAME = 'jenkins-admin'
    ADMIN_PASSWORD = credentials('scoutops-test-admin-password')
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
        script {
          if (!fileExists('scoutops/package.json')) {
            error('ScoutOps package.json was not found at scoutops/package.json.')
          }
          env.SCOUTOPS_IMAGE_TAG = "${env.BUILD_NUMBER}-${sh(script: 'git rev-parse --short=12 HEAD', returnStdout: true).trim()}"
        }
      }
    }

    stage('Install and unit test') {
      steps {
        dir('scoutops') {
          sh 'npm ci'
          sh 'npm test'
        }
      }
    }

    stage('PostgreSQL integration tests') {
      steps {
        sh 'docker compose -f scoutops/docker-compose.test.yml up -d --wait'
        dir('scoutops') {
          sh 'npm run migrate'
          sh 'npm run user:bootstrap'
          sh 'npm run test:integration'
        }
      }
    }

    stage('Build and publish image') {
      when {
        anyOf {
          branch 'main'
          branch 'SHARK02'
        }
      }
      steps {
        script {
          if (!env.SCOUTOPS_IMAGE_REPOSITORY) {
            error('Configure SCOUTOPS_IMAGE_REPOSITORY in Jenkins before publishing deployment images.')
          }
        }
        withCredentials([usernamePassword(
          credentialsId: 'scoutops-registry',
          usernameVariable: 'REGISTRY_USERNAME',
          passwordVariable: 'REGISTRY_PASSWORD'
        )]) {
          dir('scoutops') {
            sh '''
              set -eu
              printf '%s' "$REGISTRY_PASSWORD" | docker login "${SCOUTOPS_REGISTRY_URL:-https://index.docker.io/v1/}" \
                --username "$REGISTRY_USERNAME" --password-stdin
              docker build --pull --build-arg VCS_REF="$GIT_COMMIT" \
                -t "$SCOUTOPS_IMAGE_REPOSITORY:$SCOUTOPS_IMAGE_TAG" .
              docker push "$SCOUTOPS_IMAGE_REPOSITORY:$SCOUTOPS_IMAGE_TAG"
              docker logout "${SCOUTOPS_REGISTRY_URL:-https://index.docker.io/v1/}"
            '''
          }
        }
      }
    }

    stage('Deploy') {
      when {
        branch 'main'
      }
      steps {
        script {
          if (!env.SCOUTOPS_DEPLOY_HOST || !env.SCOUTOPS_DEPLOY_PATH || !env.SCOUTOPS_IMAGE_REPOSITORY) {
            error('Configure SCOUTOPS_DEPLOY_HOST, SCOUTOPS_DEPLOY_PATH, and SCOUTOPS_IMAGE_REPOSITORY in Jenkins.')
          }
        }
        withCredentials([
          sshUserPrivateKey(
            credentialsId: 'scoutops-deploy-ssh',
            keyFileVariable: 'DEPLOY_KEY',
            usernameVariable: 'DEPLOY_USER'
          )
        ]) {
          sh '''
            set -eu
            target="$DEPLOY_USER@$SCOUTOPS_DEPLOY_HOST"
            ssh -i "$DEPLOY_KEY" -o StrictHostKeyChecking=yes "$target" \
              "mkdir -p '$SCOUTOPS_DEPLOY_PATH/nginx' '$SCOUTOPS_DEPLOY_PATH/scripts'"
            scp -i "$DEPLOY_KEY" -o StrictHostKeyChecking=yes \
              scoutops/docker-compose.prod.yml "$target:$SCOUTOPS_DEPLOY_PATH/"
            scp -i "$DEPLOY_KEY" -o StrictHostKeyChecking=yes \
              scoutops/nginx/nginx.conf "$target:$SCOUTOPS_DEPLOY_PATH/nginx/"
            scp -i "$DEPLOY_KEY" -o StrictHostKeyChecking=yes \
              scoutops/scripts/deploy.sh scoutops/scripts/rollback.sh "$target:$SCOUTOPS_DEPLOY_PATH/scripts/"
            ssh -i "$DEPLOY_KEY" -o StrictHostKeyChecking=yes "$target" \
              "cd \\"$SCOUTOPS_DEPLOY_PATH\\" && \
               SCOUTOPS_IMAGE_REPOSITORY=\\"$SCOUTOPS_IMAGE_REPOSITORY\\" \
               SCOUTOPS_IMAGE_TAG=\\"$SCOUTOPS_IMAGE_TAG\\" bash scripts/deploy.sh"
          '''
        }
      }
    }
  }

  post {
    always {
      sh 'docker compose -f scoutops/docker-compose.test.yml down -v || true'
    }
    success {
      echo 'ScoutOps build and verification completed successfully.'
    }
    failure {
      echo 'ScoutOps pipeline failed. Review the failed stage output.'
    }
  }
}
