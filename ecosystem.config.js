module.exports = {
  apps: [
    {
      name: "wedding",
      script: "npm",
      args: "start -- -p 3001",
      cwd: "/var/www/wedding",
      env: {
        NODE_ENV: "production",
        PORT: 3001,
      },
    },
  ],
};
