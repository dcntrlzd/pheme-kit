module.exports = {
  out: './docs',
  readme: 'none',
  includes: './',
  exclude: [
    './src/test/**/*',
    './src/**/test.ts',
  ],
  excludeExternals: true,
  excludeNotExported: true,
  excludePrivate: true
};
