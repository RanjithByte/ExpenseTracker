
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
            rsync -av --no-owner --no-group \
            --chmod=Du=rwx,Dg=rwx,Fu=rw,Fg=rw \
            --delete dist/ /var/www/html/MyExpenseApp/
        '''
    }
}

    }
}
