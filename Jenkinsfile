
pipeline {
    agent any

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Install Dependencies') {
            steps {
                sh 'npm install'
            }
        }

        stage('Build Website') {
            steps {
                sh 'npm run build'
            }
        }
        
        stage('Deploy to Apache') {
            steps {
                sh '''
                rsync -rltv --no-perms --no-owner --no-group \
                --omit-dir-times \
                --chmod=Du=rwx,Dg=rwx,Fu=rw,Fg=rw \
                --delete dist/ /var/www/html/MyExpenseApp/
                '''
            }
        }
    }
}
