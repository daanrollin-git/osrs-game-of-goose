function validateEnv(required) {
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(`\nMissing required environment variables:\n  ${missing.join('\n  ')}`);
    console.error('\nCopy .env.example to .env and fill in the values.\n');
    process.exit(1);
  }
}

module.exports = { validateEnv };
