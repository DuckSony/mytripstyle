module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
    'jest': true
  },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'react-app',
    'react-app/jest'
  ],
  parserOptions: {
    ecmaFeatures: {
      jsx: true
    },
    ecmaVersion: 2022,
    sourceType: 'module'
  },
  plugins: [
    'react'
  ],
  rules: {
    'no-unused-vars': 'warn',
    'no-undef': 'warn',
    'react/react-in-jsx-scope': 'off', // React 17+ 에서는 import React 가 필요 없음
    'react/prop-types': 'off' // 필요에 따라 활성화
  },
  settings: {
    react: {
      version: 'detect'
    }
  },
  ignorePatterns: [
    'node_modules/',
    'build/',
    'dist/',
    'public/'
  ]
};
