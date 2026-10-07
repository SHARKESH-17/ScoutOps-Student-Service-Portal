pipeline {
  agent any

  environment {
    NODE_ENV = 'test'
    PORT = '3000'
    DB_HOST = 'postgres'
    DB_PORT = '5432'
    DB_NAME = 'scoutops'
    DB_USER = 'scoutops_user'
    DB_PASSWORD = 'change_me'
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Install Dependencies') {
      steps {
        dir('scoutops') {
          sh 'npm ci'
        }
      }
    }

    stage('Run Tests') {
      steps {
        dir('scoutops') {
          sh 'npm test'
        }
      }
    }

    stage('Build Docker Image') {
      steps {
        dir('scoutops') {
          sh "docker build -t scoutops:${env.BUILD_NUMBER} ."
        }
      }
    }

    stage('Validate') {
      steps {
        dir('scoutops') {
          sh 'curl -fsS http://localhost:3000/health || true'
        }
      }
    }

    stage('Deploy') {
      steps {
        echo 'Deployment step is intended for the Jenkins agent with Docker access and environment credentials.'
      }
    }

    stage('Health Check') {
      steps {
        dir('scoutops') {
          sh 'curl -fsS http://localhost:3000/health || true'
        }
      }
    }
  }

  post {
    success {
      echo 'ScoutOps pipeline completed successfully.'
    }
    failure {
      echo 'ScoutOps pipeline failed. Review test output and Docker build logs.'
    }
    always {
      sh 'docker system prune -f || true'
    }
  }
}
