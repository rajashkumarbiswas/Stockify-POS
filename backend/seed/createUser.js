/**
 * Creates a user from the terminal (used to create the first ADMIN).
 *
 *   npm run user:create
 *   npm run user:create -- --name "Rajesh" --email admin@shop.com --password "Admin12345" --role ADMIN
 */
const readline = require('readline/promises');
const mongoose = require('mongoose');
require('../config/env');
const { connectDB, disconnectDB } = require('../config/db');
const { User } = require('../models');
const { ROLES } = require('../config/constants');

const parseArgs = (argv) => {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith('--')) {
      parsed[argv[i].slice(2)] = argv[i + 1];
      i += 1;
    }
  }
  return parsed;
};

const collectInput = async () => {
  const args = parseArgs(process.argv.slice(2));
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  try {
    const ask = async (question, fallback = '') => {
      const answer = (await rl.question(question)).trim();
      return answer || fallback;
    };

    const name = args.name || (await ask('Full name: '));
    const email = (args.email || (await ask('Email: '))).toLowerCase();
    const password =
      args.password || (await ask('Password (min 8 chars, letters + numbers; visible while typing): '));
    const role = (
      args.role || (await ask(`Role [${Object.values(ROLES).join(' / ')}] (default ADMIN): `, 'ADMIN'))
    ).toUpperCase();

    return { name, email, password, role };
  } finally {
    rl.close();
  }
};

const run = async () => {
  const { name, email, password, role } = await collectInput();

  if (!Object.values(ROLES).includes(role)) {
    throw new Error(`Invalid role "${role}". Use one of: ${Object.values(ROLES).join(', ')}`);
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw new Error('Password must contain at least one letter and one number');
  }

  await connectDB();

  const existing = await User.findOne({ email });
  if (existing) throw new Error(`A user with email ${email} already exists`);

  const user = await User.create({ name, email, password, role });
  console.log(`\n✔ Created ${user.role} user: ${user.name} <${user.email}>`);
  console.log('  You can now sign in from the login page.');
};

run()
  .catch((error) => {
    if (error.name === 'ValidationError') {
      console.error('\n✘ Validation failed:');
      Object.values(error.errors).forEach((e) => console.error(`  - ${e.message}`));
    } else {
      console.error(`\n✘ ${error.message}`);
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDB().catch(() => {});
    await mongoose.connection.close().catch(() => {});
    process.exit(process.exitCode || 0);
  });