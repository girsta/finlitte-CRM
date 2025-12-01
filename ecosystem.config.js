module.exports = {
  apps: [{
    name: "finlitte-crm",
    script: "./server/server.js",
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: "development",
      PORT: 3000
    },
    env_production: {
      NODE_ENV: "production",
      PORT: 3000,
      // Persist data outside the repo folder to prevent data loss on deployment
      DATA_DIR: "/var/lib/finlitte/data", 
      SESSION_SECRET: "replace_this_with_a_long_random_string_in_prod"
    }
  }]
}