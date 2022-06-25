module.exports = {
  env: {
    browser: true,
    es2021: true,
  },
  extends: [
    'airbnb-base',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: [
    '@typescript-eslint',
  ],
  rules: {
    'import/extensions': 0,
    'import/no-unresolved': 0,
    'no-console': 0,
    'no-shadow': 0,
    'no-await-in-loop': 0,
    'no-promise-executor-return': 0,
  },
};