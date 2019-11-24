module.exports = {
  apps : [{
    name: 'NodeMeidaServer',
    script: 'app.js',

    // Options reference: https://pm2.io/doc/en/runtime/reference/ecosystem-file/
    args: '',
    instances: 1,
    autorestart: true,
    watch: true,
    max_memory_restart: '2G',
    env: {
      NODE_ENV: 'development'
    },
    env_production: {
      NODE_ENV: 'production'
    }
  }],

  deploy : {
    production : {
      user : 'root',
      host : '212.83.163.1',
      ref  : 'origin/master',
      repo : 'git@github.com:duzeng/Node-Media-Server.git',
      path : '~/var/www/production',
      'post-deploy' : 'npm install && pm2 reload ecosystem.config.js --env production'
    }
  }
};
